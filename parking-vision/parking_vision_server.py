"""
File: parking_vision_server.py
Location: C:/Users/faiza/parking-vision/parking_vision_server.py

Smart Parking System — Multi-Camera Vision Server
- ESP32-CAM OV5640 (QSXGA 2560x1920), one thread per camera
- Cameras and facilities loaded dynamically from Firestore (cameras collection)
- YOLOv8n vehicle detection (one model per camera, true parallel)
- Plate detection model + EasyOCR ANPR
- Firebase Firestore real-time updates
"""

from flask import Flask, jsonify
from ultralytics import YOLO
import cv2
import numpy as np
import requests
from requests.adapters import HTTPAdapter
import math
from datetime import datetime, timedelta, timezone
import firebase_admin
from firebase_admin import credentials, firestore
import time
import os
import threading
import queue
import easyocr
import glob
import re

# =============================================================
#  CONFIG
# =============================================================

CAPTURE_TIMEOUT  = 10   # seconds per HTTP request
POLLING_INTERVAL = 30   # seconds between polls per camera

# Shared spot coordinates (QSXGA 2560x1920) — same mounting angle for all cameras
SPOT_COORDS = [
    [5,    388,  850,  1100],  # left spot
    [850,  388,  1650, 1100],  # middle spot
    [1650, 388,  2550, 1100],  # right spot
]


VEHICLE_CLASSES  = [2]   # YOLO class: car
MAX_DEBUG_IMAGES = 20
MIN_IMAGE_SIZE   = 10000 # bytes — reject suspiciously small images

# =============================================================
#  APP + FIREBASE
# =============================================================

app          = Flask(__name__)
startup_time = time.time()

try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✓ Firebase initialized")
except Exception as e:
    print(f"✗ Firebase init failed: {e}")
    db = None

# =============================================================
#  MODELS
# =============================================================

yolo_models = {}  # cam_id -> YOLO model, loaded dynamically per camera
yolo_lock   = threading.Lock()

# =============================================================
#  CAMERA REGISTRY
# =============================================================

cameras_lock   = threading.Lock()
active_cameras = {}  # cam_id -> {url, spots, thread, stop_event}


def build_spots_config(spots_list, lot_id):
    """
    Build spot config dict keyed by full spot ID.
    Handles both formats stored by Camera Setup:
      - raw:    ["A4", "A5", "A6"]       → keys: demo_A4, demo_A5, demo_A6
      - prefixed: ["demo_A4", "demo_A5"] → same keys (strips duplicate prefix)
    """
    result = {}
    prefix = lot_id + "_"
    for i, spot in enumerate(spots_list):
        if i >= len(SPOT_COORDS):
            break
        # Strip lot prefix if Camera Setup already included it
        spot_num = spot[len(prefix):] if spot.startswith(prefix) else spot
        result[f"{prefix}{spot_num}"] = {"coords": SPOT_COORDS[i], "spotNumber": spot_num}
    return result


def get_or_load_yolo(cam_id):
    with yolo_lock:
        if cam_id not in yolo_models:
            print(f"[Config] Loading YOLO model for {cam_id}...")
            yolo_models[cam_id] = YOLO("yolov8n.pt")
            print(f"[Config] ✓ YOLO loaded for {cam_id}")
        return yolo_models[cam_id]


def start_camera_thread(cam_id, cam_url, spots_config, lot_id=None):
    with cameras_lock:
        if cam_id in active_cameras:
            active_cameras[cam_id]["stop_event"].set()

    get_or_load_yolo(cam_id)

    stop_event = threading.Event()
    thread = threading.Thread(
        target=camera_polling_worker,
        args=(cam_url, cam_id, spots_config, stop_event, lot_id),
        name=f"{cam_id}-poller",
        daemon=True,
    )
    with cameras_lock:
        active_cameras[cam_id] = {
            "url": cam_url, "spots": spots_config,
            "thread": thread, "stop_event": stop_event,
        }
    thread.start()
    print(f"[Config] ✓ Polling thread started: {cam_id} (lot: {lot_id})")


def stop_camera_thread(cam_id):
    with cameras_lock:
        if cam_id in active_cameras:
            active_cameras[cam_id]["stop_event"].set()
            del active_cameras[cam_id]
            print(f"[Config] ✓ Polling thread stopped: {cam_id}")




def load_cameras_from_firestore():
    if db is None:
        print("[Config] ✗ No Firebase connection — cannot load cameras")
        return
    try:
        docs = db.collection("cameras").where("enabled", "==", True).get()
        if not docs:
            print("[Config] No enabled cameras found in Firestore")
            return
        for doc in docs:
            data   = doc.to_dict()
            cam_id = data.get("id", doc.id)
            ip     = data.get("ip", "")
            spots  = data.get("spots", [])
            lot_id = data.get("lotId", "")
            if not ip or not spots:
                print(f"[Config] ⚠ Skipping {cam_id} — missing ip or spots")
                continue
            start_camera_thread(cam_id, f"http://{ip}/capture", build_spots_config(spots, lot_id), lot_id)
    except Exception as e:
        print(f"[Config] ✗ Failed to load cameras: {e}")


def on_cameras_snapshot(col_snapshot, changes, read_time):
    for change in changes:
        data    = change.document.to_dict()
        cam_id  = data.get("id", change.document.id)
        ip      = data.get("ip", "")
        spots   = data.get("spots", [])
        enabled = data.get("enabled", True)
        lot_id  = data.get("lotId", "")

        if change.type.name in ("ADDED", "MODIFIED"):
            if enabled and ip and spots:
                print(f"[Config] Camera {change.type.name.lower()}: {cam_id}")
                start_camera_thread(cam_id, f"http://{ip}/capture", build_spots_config(spots, lot_id), lot_id)
            else:
                stop_camera_thread(cam_id)
        elif change.type.name == "REMOVED":
            stop_camera_thread(cam_id)


# =============================================================
#  MODELS (continued)
# =============================================================

print("Loading plate detection model...")
try:
    plate_model = YOLO("plate_detector.pt")
    print("✓ Plate detection model loaded")
except Exception as e:
    print(f"⚠ Plate model failed: {e} — using bottom-crop fallback")
    plate_model = None

print("Loading fast-plate-ocr...")
fast_ocr = None
try:
    from fast_plate_ocr import LicensePlateRecognizer
    fast_ocr = LicensePlateRecognizer(hub_ocr_model='global-plates-mobile-vit-v2-model')
    print("✓ fast-plate-ocr loaded")
except Exception as e:
    print(f"⚠ fast-plate-ocr failed: {e} — falling back to EasyOCR")

print("Loading EasyOCR...")
try:
    reader = easyocr.Reader(['en'], gpu=False)
    print("✓ EasyOCR loaded")
except Exception as e:
    print(f"⚠ EasyOCR failed: {e}")
    reader = None

# =============================================================
#  THREADING
# =============================================================

result_queue = queue.Queue()
stats_lock   = threading.Lock()
latest_data_lock = threading.Lock()

# Tracks the last known status per spot to detect entry/exit events
previous_spot_statuses = {}  # spot_id -> "available" | "occupied"

# Persists last validated plate per spot across polls — once a good read
# is obtained, it is reused on subsequent frames where OCR fails or returns
# an unvalidated result, until the car leaves (status -> available).
confirmed_plates = {}  # spot_id -> validated plate string

stats = {
    "total_polls": 0,
    "successful_captures": 0,
    "failed_captures": 0,
    "total_vehicles_detected": 0,
    "total_plates_detected": 0,
    "valid_malaysian_plates": 0,
    "last_poll_time": None,
    "next_poll_time": None,
    "polling_active": False,
    "average_latency_seconds": 0,
    "total_processing_time": 0,
}

latest_parking_data = {
    "timestamp": None,
    "spots": {},
    "vehicles_detected": 0,
    "processing_time_seconds": 0,
}

# =============================================================
#  HELPER FUNCTIONS
# =============================================================

def check_esp32_status(url):
    try:
        r = requests.get(url.replace("/capture", "/status"), timeout=3)
        return r.status_code == 200
    except:
        return False


def fetch_image_from_esp32(cam_url, cam_id, retries=3, session=None):
    """Fetch image from ESP32-CAM. Reuses session if provided (per-thread pooling)."""
    owns_session = session is None
    if owns_session:
        session = requests.Session()
        session.mount('http://', HTTPAdapter(pool_connections=1, pool_maxsize=1, max_retries=0))

    for attempt in range(retries):
        try:
            print(f"  [{cam_id}] 📸 Attempt {attempt+1}/{retries}...", end=" ")
            r = session.get(cam_url, timeout=CAPTURE_TIMEOUT)

            if r.status_code != 200:
                print(f"✗ HTTP {r.status_code}")
                continue
            if len(r.content) < MIN_IMAGE_SIZE:
                print(f"✗ Too small ({len(r.content)} bytes)")
                continue

            img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
            if img is None or img.size == 0:
                print("✗ Invalid image")
                continue

            h, w = img.shape[:2]
            print(f"✓ {w}x{h}, {len(r.content)} bytes")
            if w != 2560 or h != 1920:
                print(f"  [{cam_id}] ⚠ Expected QSXGA (2560x1920), got {w}x{h}")

            if owns_session:
                session.close()
            return img

        except requests.exceptions.Timeout:
            print("✗ Timeout")
        except requests.exceptions.ConnectionError:
            print("✗ Connection error")
        except Exception as e:
            print(f"✗ {e}")

        if attempt < retries - 1:
            time.sleep(2)

    if owns_session:
        session.close()
    print(f"  [{cam_id}] ⚠ All attempts failed")
    return None


def detect_vehicles(image, model):
    """Run YOLOv8 vehicle detection."""
    try:
        vehicles = []
        for r in model(image, conf=0.2, verbose=False):
            for box in r.boxes:
                if int(box.cls[0]) in VEHICLE_CLASSES:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    vehicles.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": float(box.conf[0]),
                        "class_name": model.names[int(box.cls[0])],
                    })
        return vehicles
    except Exception as e:
        print(f"  ✗ Detection error: {e}")
        return []


def enhance_image_for_ocr(image, strength='normal'):
    """CLAHE + denoise + sharpen for better OCR.
    'light'  — gentle enhancement, preserves open letter shapes (C, E, A)
    'normal' — moderate enhancement for low-contrast/dark plates
    """
    try:
        gray     = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clip     = 1.5 if strength == 'light' else 2.5
        enhanced = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8)).apply(gray)
        denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
        sharpened = cv2.filter2D(denoised, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]))
        alpha    = 1.2 if strength == 'light' else 1.3
        beta     = 5   if strength == 'light' else 15
        final    = cv2.convertScaleAbs(sharpened, alpha=alpha, beta=beta)
        return cv2.cvtColor(final, cv2.COLOR_GRAY2BGR)
    except:
        return image


def validate_malaysian_plate(text):
    """Validate common Malaysian plate formats."""
    patterns = [
        r'^[A-Z]{1,3}\d{1,4}[A-Z]?$',
        r'^\d[A-Z]{2,3}\d{1,4}$',
        r'^[A-Z]{2}\d{1,4}[A-Z]$',
    ]
    return any(re.match(p, text.upper().replace(' ', '').replace('-', '')) for p in patterns)


def correct_plate_characters(text):
    """Position-aware character correction for Malaysian plates.

    Malaysian plates are always [Letters][Numbers][OptionalLetter] or
    [Digit][Letters][Numbers]. Corrections are applied based on whether
    the position is expected to be a letter or a digit.
    """
    if not text or len(text) < 2:
        return text

    digit_to_letter = {'0': 'O', '1': 'I', '5': 'S', '8': 'B', '6': 'G', '2': 'Z', '3': 'E'}
    letter_to_digit = {'O': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'G': '6', 'Z': '2'}

    # True digit-first format: single digit then letters e.g. "1ABC1234"
    # Distinguished by having a letter at position 1.
    if text[0].isdigit() and len(text) > 1 and text[1].isalpha():
        result = [text[0]]
        i = 1
        while i < len(text) and not text[i].isdigit():
            c = text[i]
            result.append(digit_to_letter.get(c, c) if c.isdigit() else c)
            i += 1
        while i < len(text):
            c = text[i]
            result.append(letter_to_digit.get(c, c) if c.isalpha() else c)
            i += 1
        return ''.join(result)

    # If text starts with digit(s) but position 1 is also a digit, the letter
    # prefix was likely misread as digits — fall through to standard correction
    # which will convert leading digits to letters using digit_to_letter.

    # Standard format: [Letters][Numbers][OptionalLetter]
    first_digit = next((i for i, c in enumerate(text) if c.isdigit()), -1)
    if first_digit == -1:
        return ''.join(digit_to_letter.get(c, c) for c in text)

    last_digit = max(i for i, c in enumerate(text) if c.isdigit())

    result = []
    for i, c in enumerate(text):
        if i < first_digit:
            result.append(digit_to_letter.get(c, c) if c.isdigit() else c)
        elif i <= last_digit:
            result.append(letter_to_digit.get(c, c) if c.isalpha() else c)
        else:
            result.append(digit_to_letter.get(c, c) if c.isdigit() else c)
    return ''.join(result)


def detect_license_plate(vehicle_crop):
    """
    2-stage ANPR:
    1. plate_model (YOLO) finds exact plate bounding box
    2. EasyOCR reads text from tight plate crop
    Fallback: bottom 35% of vehicle crop if plate_model unavailable
    """
    if reader is None and fast_ocr is None:
        return None, None, None

    try:
        plate_crop = None
        method     = "bottom_crop"

        # Stage 1: YOLO plate localization
        if plate_model is not None:
            try:
                res = plate_model(vehicle_crop, conf=0.3, verbose=False)
                if res and len(res[0].boxes) > 0:
                    best = max(res[0].boxes, key=lambda b: float(b.conf[0]))
                    px1, py1, px2, py2 = map(int, best.xyxy[0])
                    pad = 5
                    h, w = vehicle_crop.shape[:2]
                    plate_crop = vehicle_crop[
                        max(0, py1-pad):min(h, py2+pad),
                        max(0, px1-pad):min(w, px2+pad)
                    ]
                    method = "yolo_plate_detection"
            except Exception as e:
                print(f"    ⚠ Plate model error: {e}")

        # Fallback: bottom 40% — wider to catch rear plates that sit higher
        if plate_crop is None or plate_crop.size == 0:
            h, w = vehicle_crop.shape[:2]
            plate_crop = vehicle_crop[int(h*0.60):h, int(w*0.05):int(w*0.95)]
            method = "bottom_crop"

        if plate_crop.size == 0:
            return None, None, None

        # Upscale small crops for better OCR
        min_height = 96
        h, w = plate_crop.shape[:2]
        if h < min_height:
            scale = min_height / h
            plate_crop = cv2.resize(
                plate_crop, (int(w * scale), min_height), interpolation=cv2.INTER_CUBIC
            )

        # Stage 2a: fast-plate-ocr (primary — trained specifically for license plates)
        if fast_ocr is not None:
            try:
                gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                fp_results = fast_ocr.run(gray)
                if fp_results and fp_results[0]:
                    fp_text = fp_results[0].plate if hasattr(fp_results[0], 'plate') else str(fp_results[0])
                    raw  = ''.join(c for c in fp_text.upper() if c.isalnum())
                    text = correct_plate_characters(raw)
                    if len(text) >= 3:
                        if validate_malaysian_plate(text):
                            return text, 0.95, f"{method}_fast_ocr"
                        return f"{text}*", 0.95, f"{method}_fast_ocr"
            except Exception as e:
                print(f"    ⚠ fast-plate-ocr error: {e}")

        # Stage 2b: EasyOCR fallback — try light → raw → normal enhancement.
        # Lighter passes go first since aggressive enhancement closes letter gaps.
        if reader is None:
            return None, None, None

        def _ocr_pass(img):
            res = reader.readtext(
                img,
                allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                width_ths=0.5,
            )
            if not res:
                return None, 0.0
            res  = sorted(res, key=lambda x: x[0][0][0])
            raw  = ''.join(c for r in res for c in r[1].upper() if c.isalnum())
            conf = sum(r[2] for r in res) / len(res)
            return correct_plate_characters(raw), conf

        best_text, best_conf = None, 0.0
        for variant in [
            enhance_image_for_ocr(plate_crop, 'light'),
            plate_crop,
            enhance_image_for_ocr(plate_crop, 'normal'),
        ]:
            t, c = _ocr_pass(variant)
            if not t or len(t) < 3 or c < 0.25:
                continue
            if validate_malaysian_plate(t):
                return t, c, method
            if c > best_conf:
                best_text, best_conf = t, c

        if best_text:
            return f"{best_text}*", best_conf, f"{method}_unvalidated"
        return None, None, None

    except Exception as e:
        print(f"    ⚠ ANPR error: {e}")
        return None, None, None


def process_vehicles_with_anpr(image, vehicles):
    """Run ANPR on all detected vehicles."""
    if reader is None and fast_ocr is None:
        return vehicles

    print("  🔢 Running ANPR...")
    plates_found = valid_plates = 0

    for i, v in enumerate(vehicles):
        x1, y1, x2, y2 = v["bbox"]
        pad  = 20
        crop = image[max(0,y1-pad):min(image.shape[0],y2+pad),
                     max(0,x1-pad):min(image.shape[1],x2+pad)]

        if crop.size == 0:
            v["plate_number"] = v["plate_confidence"] = v["detection_method"] = None
            continue

        plate, conf, method = detect_license_plate(crop)
        v["plate_number"]     = plate
        v["plate_confidence"] = round(conf, 2) if conf else None
        v["detection_method"] = method

        if plate:
            plates_found += 1
            validated = not plate.endswith('*')
            if validated:
                valid_plates += 1
                with stats_lock:
                    stats["valid_malaysian_plates"] += 1
            mark = "✓" if validated else "⚠️"
            print(f"    📋 Vehicle {i+1}: {plate} {mark} (conf: {conf:.2f}, method: {method})")
        else:
            print(f"    📋 Vehicle {i+1}: No plate detected")

    if plates_found > 0:
        with stats_lock:
            stats["total_plates_detected"] += plates_found
        print(f"  ✓ {plates_found} plate(s) detected ({valid_plates} validated)")
    else:
        print(f"  ⚠ No plates detected")

    return vehicles


def is_spot_occupied(coords, vehicles):
    """Center-point check: is any vehicle center inside the spot box?"""
    x1, y1, x2, y2 = coords
    for v in vehicles:
        vx1, vy1, vx2, vy2 = v["bbox"]
        cx, cy = (vx1+vx2)/2, (vy1+vy2)/2
        if x1 <= cx <= x2 and y1 <= cy <= y2:
            return True, v["confidence"], v
    return False, None, None


def prepare_firestore_data(spot_id, spot_number, status, confidence, cam_id, lot_id=None, vehicle_info=None):
    """Build Firestore document data for a parking spot."""
    data = {
        "status":      status,
        "lastUpdated": firestore.SERVER_TIMESTAMP,
        "esp32CamId":  cam_id,
        "spotNumber":  spot_number,
        "lotId":       lot_id,
        "rowId":       spot_number[0],
    }
    if confidence:
        data["detectionConfidence"] = round(confidence, 2)

    if vehicle_info:
        data["vehicleType"] = vehicle_info.get("class_name", "unknown")
        plate = vehicle_info.get("plate_number")
        if plate:
            data["licensePlate"]    = plate.rstrip('*')
            data["plateConfidence"] = vehicle_info.get("plate_confidence")
            data["plateValidated"]  = not plate.endswith('*')
            data["detectionMethod"] = vehicle_info.get("detection_method")
        else:
            data.update({"licensePlate": None, "plateConfidence": None,
                         "plateValidated": False, "detectionMethod": None})
    else:
        data.update({"vehicleType": None, "licensePlate": None,
                     "plateConfidence": None, "plateValidated": False,
                     "detectionMethod": None})
    return data


def draw_debug(image, vehicles, spot_statuses, spots_config):
    """Draw spot boxes and vehicle detections on a copy of the image."""
    img = image.copy()

    for spot in spots_config.values():
        x1, y1, x2, y2 = spot["coords"]
        num    = spot["spotNumber"]
        status = spot_statuses.get(num, {}).get("status", "unknown")
        color  = (0, 255, 0) if status == "available" else (0, 0, 255)
        label  = f"{num}: {status.upper()}"

        cv2.rectangle(img, (x1, y1), (x2, y2), color, 4)
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 3)
        cv2.rectangle(img, (x1, y1-lh-15), (x1+lw+15, y1), color, -1)
        cv2.putText(img, label, (x1+8, y1-8), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255,255,255), 3)

    for v in vehicles:
        x1, y1, x2, y2 = v["bbox"]
        plate = v.get("plate_number", "")
        cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 0), 3)
        cv2.putText(img, f"{v['class_name']} {v['confidence']:.2f}", (x1, y1-50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,0,0), 2)
        if plate:
            color = (0,255,0) if not plate.endswith('*') else (0,255,255)
            cv2.putText(img, f"Plate: {plate}", (x1, y1-20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        else:
            cv2.putText(img, "No plate", (x1, y1-20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)
        cx, cy = int((x1+x2)/2), int((y1+y2)/2)
        cv2.circle(img, (cx, cy), 8, (255,0,0), -1)

    return img


def save_debug_image(image, vehicles, spot_statuses, spots_config, cam_id):
    try:
        os.makedirs("debug_images", exist_ok=True)
        filename = f"debug_images/debug_{cam_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        cv2.imwrite(filename, draw_debug(image, vehicles, spot_statuses, spots_config))
        print(f"  [{cam_id}] 💾 Debug saved: {filename}")
    except Exception as e:
        print(f"  [{cam_id}] ✗ Debug save failed: {e}")


def cleanup_old_debug_images():
    """Keep last MAX_DEBUG_IMAGES per camera independently."""
    try:
        for cam_id in yolo_models:
            files = sorted(glob.glob(f"debug_images/debug_{cam_id}_*.jpg"))
            for f in files[:-MAX_DEBUG_IMAGES]:
                try: os.remove(f)
                except: pass
    except Exception as e:
        print(f"  ⚠ Cleanup error: {e}")


def get_disabled_spots(spot_ids):
    """Return the set of spot IDs currently marked as disabled in Firestore."""
    disabled = set()
    if db is None:
        return disabled
    try:
        docs = db.collection("parkingSpots").where("status", "==", "disabled").get()
        for doc in docs:
            if doc.id in spot_ids:
                disabled.add(doc.id)
    except Exception as e:
        print(f"  [Firebase] ⚠ Could not fetch disabled spots: {e}")
    return disabled


def send_push_notification(user_id, title, body):
    """Send a push notification via Expo Push API using the token stored in Firestore."""
    if db is None:
        return
    try:
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            return
        push_token = user_doc.to_dict().get("pushToken")
        if not push_token:
            print(f"  [PUSH] No push token for user {user_id}")
            return
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={"to": push_token, "title": title, "body": body,
                  "sound": "default", "priority": "high"},
            timeout=10,
        )
        print(f"  [PUSH] Sent to {user_id}: {response.json()}")
    except Exception as e:
        print(f"  [PUSH] Failed for user {user_id}: {e}")


def find_user_by_plate(plate):
    """Find a user in Firestore by their license plate number."""
    if db is None or not plate:
        return None
    try:
        results = db.collection("users").where("licensePlate", "==", plate.upper()).limit(1).get()
        return results[0].to_dict() if results else None
    except Exception as e:
        print(f"  [NOTIF] ⚠ User lookup failed: {e}")
        return None


def create_parking_session(user_id, spot_id, spot_number, license_plate):
    """Create a parkingSessions doc and notify user that their session has started."""
    if db is None:
        return
    try:
        session_id = f"session_{int(time.time() * 1000)}"
        notif_id   = f"notif_{int(time.time() * 1000)}_entry"

        batch = db.batch()
        batch.set(db.collection("parkingSessions").document(session_id), {
            "sessionId":       session_id,
            "userId":          user_id,
            "spotId":          spot_id,
            "licensePlate":    license_plate,
            "startTime":       firestore.SERVER_TIMESTAMP,
            "endTime":         None,
            "status":          "active",
            "detectionMethod": "anpr",
            "duration":        None,
            "fee":             None,
            "paymentStatus":   "pending",
        })
        batch.set(db.collection("notifications").document(notif_id), {
            "userId":    user_id,
            "type":      "vehicle",
            "title":     "Parking Session Started",
            "message":   f"Your vehicle {license_plate} entered spot {spot_number}. Parking charges are now being tracked.",
            "read":      False,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        batch.commit()
        print(f"  [SESSION] ✓ Session started: {session_id} — {license_plate} at {spot_number}")
    except Exception as e:
        print(f"  [SESSION] ✗ Failed to create session: {e}")


def end_parking_session(spot_id, spot_number, lot_id=None):
    """Find the active session for a spot, calculate fee, deduct wallet, notify user."""
    if db is None:
        return
    try:
        sessions = db.collection("parkingSessions") \
            .where("spotId", "==", spot_id) \
            .where("status", "==", "active") \
            .limit(1).get()

        if not sessions:
            print(f"  [SESSION] ⚠ No active session found for spot {spot_number}")
            return

        session_doc  = sessions[0]
        session_data = session_doc.to_dict()
        session_id   = session_doc.id
        user_id      = session_data["userId"]
        plate        = session_data["licensePlate"]
        start_time   = session_data["startTime"]  # UTC-aware datetime from Firestore

        # Duration
        end_dt        = datetime.now(tz=timezone.utc)
        duration_secs = max(0, (end_dt - start_time).total_seconds())
        duration_mins = int(duration_secs / 60)
        hours         = duration_mins // 60
        mins          = duration_mins % 60

        # Hourly rate from parkingLots (fallback: RM 2.00/hr)
        hourly_rate = 2.0
        try:
            lot_doc = db.collection("parkingLots").document(lot_id).get()
            if lot_doc.exists:
                hourly_rate = lot_doc.to_dict().get("pricing", {}).get("hourlyRate", 2.0)
        except Exception:
            pass

        fee = round(math.ceil((duration_secs / 3600) * hourly_rate * 100) / 100, 2)

        # Read user for current balance and booking count
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            print(f"  [SESSION] ✗ User {user_id} not found")
            return
        user_data      = user_doc.to_dict()
        new_balance    = max(0, user_data.get("walletBalance", 0) - fee)
        total_bookings = user_data.get("totalBookings", 0) + 1

        txn_id   = f"txn_{int(time.time() * 1000)}"
        notif_id = f"notif_{int(time.time() * 1000)}_exit"

        batch = db.batch()
        batch.update(db.collection("parkingSessions").document(session_id), {
            "endTime":       firestore.SERVER_TIMESTAMP,
            "status":        "completed",
            "duration":      duration_mins,
            "fee":           fee,
            "paymentStatus": "paid",
        })
        batch.update(db.collection("users").document(user_id), {
            "walletBalance": new_balance,
            "totalBookings": total_bookings,
        })
        batch.set(db.collection("transactions").document(txn_id), {
            "transactionId": txn_id,
            "userId":        user_id,
            "type":          "payment",
            "amount":        -fee,
            "description":   f"Parking at Spot {spot_number}",
            "timestamp":     firestore.SERVER_TIMESTAMP,
            "status":        "completed",
            "metadata": {
                "sessionId":    session_id,
                "spotId":       spot_id,
                "licensePlate": plate,
            },
        })
        batch.set(db.collection("notifications").document(notif_id), {
            "userId":    user_id,
            "type":      "session",
            "title":     "Parking Session Ended",
            "message":   f"Your vehicle {plate} exited spot {spot_number}. Duration: {hours}h {mins}m. RM {fee:.2f} deducted from your wallet.",
            "read":      False,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        batch.commit()
        print(f"  [SESSION] ✓ Session ended: {session_id} — {hours}h {mins}m — RM {fee:.2f} deducted")
    except Exception as e:
        print(f"  [SESSION] ✗ Batch failed, retrying once: {e}")
        try:
            time.sleep(2)
            batch.commit()
            print(f"  [SESSION] ✓ Session ended on retry: {session_id}")
        except Exception as e2:
            print(f"  [SESSION] ✗ FAILED permanently — session {session_id} may need manual fix: {e2}")


def update_firestore_batch(spot_data):
    """Write all spot updates in a single Firestore batch."""
    if db is None:
        return
    try:
        batch = db.batch()
        for spot_id, data in spot_data.items():
            batch.set(db.collection("parkingSpots").document(spot_id), data, merge=True)
        batch.commit()
        print(f"  [Firebase] ✓ Batch update complete ({len(spot_data)} spots)")
    except Exception as e:
        print(f"  [Firebase] ✗ Batch error: {e}")
        for spot_id, data in spot_data.items():
            try:
                db.collection("parkingSpots").document(spot_id).set(data, merge=True)
            except Exception as e2:
                print(f"    ✗ Failed {spot_id}: {e2}")


# =============================================================
#  CORE DETECTION PIPELINE
# =============================================================

def analyze_single_camera(image, spots_config, cam_id, lot_id=None):
    """Full detection pipeline for one camera frame."""
    start = time.time()

    cam_model = yolo_models.get(cam_id, next(iter(yolo_models.values())))
    print(f"  [{cam_id}] 🔍 Running YOLO...", end=" ")
    vehicles = detect_vehicles(image, cam_model)
    print(f"✓ {len(vehicles)} vehicles found")

    with stats_lock:
        stats["total_vehicles_detected"] += len(vehicles)

    if vehicles:
        for i, v in enumerate(vehicles, 1):
            print(f"  [{cam_id}]   {i}. {v['class_name']} (conf: {v['confidence']:.2f})")
        vehicles = process_vehicles_with_anpr(image, vehicles)

    print(f"  [{cam_id}] 📊 Analysing spots...")
    results         = {}
    firestore_batch = {}

    disabled_spots = get_disabled_spots(list(spots_config.keys()))
    if disabled_spots:
        print(f"  [{cam_id}] ⛔ Skipping {len(disabled_spots)} disabled spot(s): {disabled_spots}")

    for spot_id, spot in spots_config.items():
        if spot_id in disabled_spots:
            results[spot["spotNumber"]] = {"status": "disabled", "confidence": None, "vehicleType": None}
            print(f"  [{cam_id}]   ⛔ {spot['spotNumber']}: DISABLED — skipped")
            continue

        occupied, conf, veh = is_spot_occupied(spot["coords"], vehicles)
        status = "occupied" if occupied else "available"

        firestore_batch[spot_id] = prepare_firestore_data(
            spot_id, spot["spotNumber"], status, conf, cam_id, lot_id, veh
        )

        result = {
            "status":      status,
            "confidence":  round(conf, 2) if conf else None,
            "vehicleType": veh.get("class_name") if veh else None,
        }
        if veh and veh.get("plate_number"):
            p = veh["plate_number"]
            result.update({
                "licensePlate":    p.rstrip('*'),
                "plateConfidence": veh.get("plate_confidence"),
                "plateValidated":  not p.endswith('*'),
                "detectionMethod": veh.get("detection_method"),
            })

        results[spot["spotNumber"]] = result

        sym        = "🔴" if occupied else "🟢"
        conf_str   = f" (det: {conf:.2f})" if conf else ""
        veh_str    = f" - {veh['class_name']}" if veh else ""
        plate_str  = ""
        if veh and veh.get("plate_number"):
            p = veh["plate_number"]
            plate_str = f" [{p}] {'✓' if not p.endswith('*') else '⚠️'}"
        print(f"  [{cam_id}]   {sym} {spot['spotNumber']}: {status.upper()}{conf_str}{veh_str}{plate_str}")

    save_debug_image(image, vehicles, results, spots_config, cam_id)
    cleanup_old_debug_images()

    return results, firestore_batch, len(vehicles), time.time() - start


# =============================================================
#  THREADS
# =============================================================

def camera_polling_worker(cam_url, cam_id, spots_config, stop_event=None, lot_id=None):
    """Background thread: poll one camera repeatedly."""
    print(f"\n[{cam_id}] Polling thread started — interval: {POLLING_INTERVAL}s")

    session = requests.Session()
    session.mount('http://', HTTPAdapter(pool_connections=1, pool_maxsize=1, max_retries=0))

    while not (stop_event and stop_event.is_set()):
        loop_start = time.time()
        print(f"\n[{cam_id}] {'='*50}")
        print(f"[{cam_id}] Poll at {datetime.now().strftime('%H:%M:%S')}")
        print(f"[{cam_id}] {'='*50}")

        with stats_lock:
            if cam_id not in stats:
                stats[cam_id] = {"polls": 0, "success": 0, "failed": 0, "last_poll": None, "online": False}
            stats[cam_id]["polls"]    += 1
            stats[cam_id]["last_poll"] = datetime.now().isoformat()
            stats["total_polls"]      += 1
            stats["last_poll_time"]    = datetime.now().isoformat()
            stats["next_poll_time"]    = (datetime.now() + timedelta(seconds=POLLING_INTERVAL)).isoformat()

        image = fetch_image_from_esp32(cam_url, cam_id, session=session)

        if image is None:
            with stats_lock:
                if cam_id not in stats:
                    stats[cam_id] = {"polls": 0, "success": 0, "failed": 0, "last_poll": None, "online": False}
                stats[cam_id]["failed"]  += 1
                stats[cam_id]["online"]   = False
                stats["failed_captures"] += 1
            print(f"[{cam_id}] ❌ Skipping — no image")
        else:
            with stats_lock:
                stats[cam_id]["success"]     += 1
                stats[cam_id]["online"]       = True
                stats["successful_captures"] += 1

            results, fb_batch, veh_count, proc_time = analyze_single_camera(image, spots_config, cam_id, lot_id)

            with stats_lock:
                stats["total_processing_time"]  += proc_time
                stats["average_latency_seconds"] = (
                    stats["total_processing_time"] / max(stats["total_polls"], 1)
                )

            # Temporal plate memory — patch results/fb_batch with last confirmed plate
            # when the current frame fails OCR or returns an unvalidated reading.
            for spot_id, spot_cfg in spots_config.items():
                spot_number    = spot_cfg["spotNumber"]
                spot_result    = results.get(spot_number, {})
                current_plate  = spot_result.get("licensePlate")
                current_status = spot_result.get("status")

                if current_status == "occupied":
                    if current_plate and not current_plate.endswith('*'):
                        # Correct read — save to memory
                        if confirmed_plates.get(spot_id) != current_plate:
                            print(f"  [MEMORY] ✓ Confirmed plate {current_plate} for {spot_number}")
                        confirmed_plates[spot_id] = current_plate
                    elif confirmed_plates.get(spot_id):
                        # OCR failed this frame — patch with last correct read
                        mem = confirmed_plates[spot_id]
                        results[spot_number]["licensePlate"] = mem
                        if spot_id in fb_batch:
                            fb_batch[spot_id]["licensePlate"] = mem
                        print(f"  [MEMORY] 📋 Using remembered plate {mem} for {spot_number}")
                elif current_status == "available" and spot_id in confirmed_plates:
                    print(f"  [MEMORY] 🗑 Cleared plate {confirmed_plates.pop(spot_id)} for {spot_number}")

            # Snapshot old statuses before updating, so both loops use the same baseline.
            old_statuses = {sid: previous_spot_statuses.get(sid) for sid in spots_config}
            for spot_id, spot in spots_config.items():
                previous_spot_statuses[spot_id] = results.get(spot["spotNumber"], {}).get("status")

            # Run exit sessions BEFORE pushing spot status to Firestore so the wallet
            # balance is already updated when the mobile app's listener fires.
            for spot_id, spot in spots_config.items():
                if old_statuses.get(spot_id) == "occupied" and previous_spot_statuses.get(spot_id) == "available":
                    end_parking_session(spot_id, spot["spotNumber"], lot_id)

            result_queue.put({
                "firestore_batch":  fb_batch,
                "results":          results,
                "cam_id":           cam_id,
                "vehicle_count":    veh_count,
                "processing_time":  proc_time,
            })

            # Detect entry events
            for spot_id, spot in spots_config.items():
                spot_number = spot["spotNumber"]
                spot_result = results.get(spot_number, {})
                new_status  = previous_spot_statuses.get(spot_id)

                if old_statuses.get(spot_id) == "available" and new_status == "occupied":
                    plate = spot_result.get("licensePlate")

                    # Burst reads: if entry frame returned no correct plate, take up to
                    # 2 quick extra frames hoping for a cleaner read before giving up.
                    if not plate or plate.endswith('*'):
                        print(f"  [BURST] No correct plate on entry for {spot_number} — trying burst reads")
                        for attempt in range(2):
                            time.sleep(1.5)
                            burst_img = fetch_image_from_esp32(cam_url, cam_id, session=session)
                            if burst_img is None:
                                continue
                            b_results, b_batch, _, _ = analyze_single_camera(burst_img, spots_config, cam_id, lot_id)
                            b_plate = b_results.get(spot_number, {}).get("licensePlate")
                            if b_plate and not b_plate.endswith('*'):
                                plate = b_plate
                                confirmed_plates[spot_id] = plate
                                result_queue.put({
                                    "firestore_batch":  {spot_id: b_batch[spot_id]} if spot_id in b_batch else {},
                                    "results":          {spot_number: b_results[spot_number]},
                                    "cam_id":           cam_id,
                                    "vehicle_count":    0,
                                    "processing_time":  0,
                                })
                                print(f"  [BURST] ✓ Got plate {plate} for {spot_number} on attempt {attempt + 1}")
                                break
                        if not plate or plate.endswith('*'):
                            print(f"  [BURST] ✗ No correct plate for {spot_number} after burst")

                    if plate:
                        user = find_user_by_plate(plate.rstrip('*'))
                        if user:
                            # Session creation handled by parking.tsx via onSnapshot
                            print(f"  [SESSION] Plate {plate} matched user {user['uid']} — session will be created by app")
                        else:
                            print(f"  [SESSION] No user found for plate {plate.rstrip('*')} — session not created")

        elapsed    = time.time() - loop_start
        sleep_time = max(0, POLLING_INTERVAL - elapsed)
        print(f"[{cam_id}] Done in {elapsed:.1f}s, sleeping {sleep_time:.0f}s")
        deadline = time.time() + sleep_time
        while time.time() < deadline:
            if stop_event and stop_event.is_set():
                session.close()
                print(f"[{cam_id}] Polling thread stopped")
                return
            time.sleep(1)

    session.close()
    print(f"[{cam_id}] Polling thread stopped")


def firebase_writer_worker():
    """Drain result_queue and write to Firestore (serialized)."""
    print("[Firebase writer] Started")
    while True:
        try:
            payload = result_queue.get(timeout=5)
            update_firestore_batch(payload["firestore_batch"])
            with latest_data_lock:
                latest_parking_data["spots"].update(payload["results"])
                latest_parking_data["timestamp"]               = datetime.now().isoformat()
                latest_parking_data["vehicles_detected"]       = payload["vehicle_count"]
                latest_parking_data["processing_time_seconds"] = round(payload["processing_time"], 2)
            result_queue.task_done()
        except queue.Empty:
            continue
        except Exception as e:
            print(f"[Firebase writer] Error: {e}")


# =============================================================
#  FLASK ROUTES
# =============================================================

@app.route("/analyze", methods=["GET"])
def manual_analyze():
    with cameras_lock:
        snapshot = {cid: {"url": v["url"], "spots": v["spots"]} for cid, v in active_cameras.items()}
    for cam_id, cam in snapshot.items():
        image = fetch_image_from_esp32(cam["url"], cam_id, retries=1)
        if image is not None:
            results, fb_batch, _, _ = analyze_single_camera(image, cam["spots"], cam_id)
            result_queue.put({"firestore_batch": fb_batch, "results": results,
                              "cam_id": cam_id, "vehicle_count": 0, "processing_time": 0})
    with latest_data_lock:
        return jsonify(latest_parking_data)


@app.route("/analyze/<cam_id>", methods=["GET"])
def manual_analyze_cam(cam_id):
    with cameras_lock:
        cam = active_cameras.get(cam_id)
    if not cam:
        with cameras_lock:
            valid = list(active_cameras.keys())
        return jsonify({"error": f"Unknown camera: {cam_id}", "valid": valid}), 404
    image = fetch_image_from_esp32(cam["url"], cam_id, retries=1)
    if image is None:
        return jsonify({"error": f"{cam_id} not reachable"}), 503
    results, fb_batch, _, _ = analyze_single_camera(image, cam["spots"], cam_id)
    result_queue.put({"firestore_batch": fb_batch, "results": results,
                      "cam_id": cam_id, "vehicle_count": 0, "processing_time": 0})
    return jsonify({"cam": cam_id, "results": results})


@app.route("/status", methods=["GET"])
def get_status():
    with cameras_lock:
        snapshot = {cid: v["url"] for cid, v in active_cameras.items()}
    cam_online = {cid: check_esp32_status(url) for cid, url in snapshot.items()}
    with stats_lock:
        stats_copy = dict(stats)
    with latest_data_lock:
        latest_copy = dict(latest_parking_data)
    return jsonify({
        "server":   "online",
        "polling":  {"active": stats_copy["polling_active"],
                     "interval_seconds": POLLING_INTERVAL,
                     "last_poll": stats_copy["last_poll_time"],
                     "next_poll": stats_copy["next_poll_time"]},
        "cameras":  {cid: {"url": url, "online": cam_online.get(cid, False),
                            **stats_copy.get(cid, {})} for cid, url in snapshot.items()},
        "firebase": "connected" if db else "disconnected",
        "anpr":     "enabled" if (fast_ocr or reader) else "disabled",
        "plate_model": "loaded" if plate_model else "fallback (bottom crop)",
        "statistics": stats_copy,
        "latest_data": latest_copy,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/latest", methods=["GET"])
def get_latest():
    with latest_data_lock:
        if latest_parking_data["timestamp"]:
            return jsonify(latest_parking_data)
    return jsonify({"error": "No data yet"}), 503


@app.route("/metrics", methods=["GET"])
def get_metrics():
    uptime = time.time() - startup_time
    with stats_lock:
        tp = stats["total_polls"]
        sc = stats["successful_captures"]
        tv = stats["total_vehicles_detected"]
        tpl = stats["total_plates_detected"]
        vp = stats["valid_malaysian_plates"]
        al = stats["average_latency_seconds"]
    return jsonify({
        "uptime_formatted":            f"{int(uptime//3600)}h {int((uptime%3600)//60)}m",
        "capture_success_rate":        round(sc/tp*100 if tp else 0, 2),
        "plates_per_vehicle":          round(tpl/tv if tv else 0, 2),
        "valid_malaysian_plate_rate":  round(vp/tpl*100 if tpl else 0, 2),
        "avg_vehicles_per_poll":       round(tv/tp if tp else 0, 2),
        "avg_processing_time_seconds": round(al, 2),
        "total_malaysian_plates_validated": vp,
    })


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"}), 200


# =============================================================
#  MAIN
# =============================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("SMART PARKING — MULTI-CAMERA VISION SERVER")
    print("="*60)
    print(f"  Poll interval : {POLLING_INTERVAL}s")
    print(f"  Plate model   : {'loaded' if plate_model else 'fallback'}")
    print(f"  Firebase      : {'connected' if db else 'DISCONNECTED'}")
    print("="*60)

    load_cameras_from_firestore()

    if db is not None:
        db.collection("cameras").on_snapshot(on_cameras_snapshot)
        print("[Config] Watching cameras collection for live changes")

    stats["polling_active"] = True

    threading.Thread(target=firebase_writer_worker, name="firebase-writer", daemon=True).start()

    print("\n" + "="*60)
    print("ENDPOINTS")
    print("="*60)
    print("  GET /status             — system status")
    print("  GET /metrics            — performance metrics")
    print("  GET /latest             — latest detection results")
    print("  GET /analyze            — trigger all cameras")
    print("  GET /analyze/<cam_id>   — trigger one camera")
    print("  GET /health             — health check")
    print("="*60 + "\n")

    app.run(host="0.0.0.0", port=5000, debug=False)