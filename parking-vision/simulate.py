"""
simulate.py — Test the full detection pipeline on a saved image.

Usage:
  py simulate.py                          # uses most recent debug image
  py simulate.py path/to/image.jpg        # specific image
  py simulate.py --coords                 # load spot coords from Firestore
"""

import sys
import glob
import cv2
import numpy as np
from ultralytics import YOLO

# ── Spot config ────────────────────────────────────────────────────────────────
# Default hardcoded coords — matches SPOT_COORDS in parking_vision_server.py
DEFAULT_SPOT_COORDS = [
    [5,    388,  850,  1100],  # left spot
    [850,  388,  1650, 1100],  # middle spot
    [1650, 388,  2550, 1100],  # right spot
]
SPOT_NAMES = ["A4", "A5", "A6"]
IOU_THRESHOLD = 0.55

# ── Load models ────────────────────────────────────────────────────────────────
print("Loading YOLO vehicle detector...")
yolo = YOLO("yolov8n.pt")
print("  ✓ yolov8n.pt loaded")

try:
    plate_model = YOLO("plate_detector.pt")
    print("  ✓ plate_detector.pt loaded")
except:
    plate_model = None
    print("  ⚠ plate_detector.pt not found")

try:
    from fast_plate_ocr import LicensePlateRecognizer
    fast_ocr = LicensePlateRecognizer(hub_ocr_model='global-plates-mobile-vit-v2-model')
    print("  ✓ fast-plate-ocr loaded")
except:
    fast_ocr = None

try:
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
    print("  ✓ EasyOCR loaded")
except:
    reader = None

print()


# ── Detection helpers ──────────────────────────────────────────────────────────

def detect_vehicles(image):
    vehicles = []
    for r in yolo(image, conf=0.2, verbose=False):
        for box in r.boxes:
            if int(box.cls[0]) == 2:  # car
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                vehicles.append({"bbox": [x1, y1, x2, y2], "confidence": float(box.conf[0])})
    return vehicles


def read_plate(vehicle_crop):
    # Stage 1: YOLO plate detector
    if plate_model:
        try:
            res = plate_model(vehicle_crop, conf=0.3, verbose=False)
            if res and len(res[0].boxes) > 0:
                best = max(res[0].boxes, key=lambda b: float(b.conf[0]))
                px1, py1, px2, py2 = map(int, best.xyxy[0])
                h, w = vehicle_crop.shape[:2]
                plate_crop = vehicle_crop[max(0,py1-5):min(h,py2+5), max(0,px1-5):min(w,px2+5)]
                if plate_crop.size > 0:
                    if plate_crop.shape[0] < 96:
                        scale = 96 / plate_crop.shape[0]
                        plate_crop = cv2.resize(plate_crop, (int(plate_crop.shape[1]*scale), 96), interpolation=cv2.INTER_CUBIC)
                    if fast_ocr:
                        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                        res2 = fast_ocr.run(gray)
                        if res2 and res2[0]:
                            text = res2[0].plate if hasattr(res2[0], 'plate') else str(res2[0])
                            return ''.join(c for c in text.upper() if c.isalnum())
        except:
            pass

    # Fallback: bottom 40% crop
    h, w = vehicle_crop.shape[:2]
    fallback = vehicle_crop[int(h*0.6):h, int(w*0.05):int(w*0.95)]
    if fallback.size == 0:
        return None
    if fallback.shape[0] < 96:
        scale = 96 / fallback.shape[0]
        fallback = cv2.resize(fallback, (int(fallback.shape[1]*scale), 96), interpolation=cv2.INTER_CUBIC)
    if fast_ocr:
        try:
            gray = cv2.cvtColor(fallback, cv2.COLOR_BGR2GRAY)
            res = fast_ocr.run(gray)
            if res and res[0]:
                text = res[0].plate if hasattr(res[0], 'plate') else str(res[0])
                return ''.join(c for c in text.upper() if c.isalnum())
        except:
            pass
    return None


def is_spot_occupied(coords, vehicles):
    x1, y1, x2, y2 = coords
    for v in vehicles:
        vx1, vy1, vx2, vy2 = v["bbox"]

        # Center-point check
        cx, cy = (vx1+vx2)/2, (vy1+vy2)/2
        center_inside = x1 <= cx <= x2 and y1 <= cy <= y2

        # IoU check
        vehicle_area = (vx2-vx1) * (vy2-vy1)
        if vehicle_area == 0:
            continue
        ix1, iy1 = max(x1,vx1), max(y1,vy1)
        ix2, iy2 = min(x2,vx2), min(y2,vy2)
        if ix2 > ix1 and iy2 > iy1:
            overlap = (ix2-ix1) * (iy2-iy1) / vehicle_area
        else:
            overlap = 0.0

        if center_inside and overlap >= IOU_THRESHOLD:
            return True, v, overlap
        elif center_inside:
            print(f"      ⚠ Center inside but IoU too low ({overlap:.0%} < {IOU_THRESHOLD:.0%}) → rejected")

    return False, None, 0.0


# ── Main simulation ────────────────────────────────────────────────────────────

def simulate(image_path, spot_coords=None):
    if spot_coords is None:
        spot_coords = DEFAULT_SPOT_COORDS

    print(f"{'='*60}")
    print(f"Image : {image_path}")
    print(f"Spots : {SPOT_NAMES}")
    print(f"{'='*60}")

    image = cv2.imread(image_path)
    if image is None:
        print("✗ Could not load image")
        return

    h, w = image.shape[:2]
    print(f"Image size: {w}x{h}")

    # ── Step 1: Combined crop
    print(f"\n── Step 1: Combined Crop ──")
    crop_x1 = max(0, min(c[0] for c in spot_coords))
    crop_y1 = max(0, min(c[1] for c in spot_coords))
    crop_x2 = min(w, max(c[2] for c in spot_coords))
    crop_y2 = min(h, max(c[3] for c in spot_coords))
    detection_region = image[crop_y1:crop_y2, crop_x1:crop_x2]
    crop_h, crop_w = detection_region.shape[:2]
    print(f"  Full image : {w}x{h} = {w*h:,} pixels")
    print(f"  Crop region: [{crop_x1},{crop_y1} → {crop_x2},{crop_y2}]")
    print(f"  Crop size  : {crop_w}x{crop_h} = {crop_w*crop_h:,} pixels ({crop_w*crop_h/(w*h)*100:.0f}% of full image)")

    # ── Step 2: YOLO on crop
    print(f"\n── Step 2: YOLO Detection (on crop) ──")
    vehicles = detect_vehicles(detection_region)
    print(f"  {len(vehicles)} vehicle(s) found")

    # ── Step 3: Adjust coords to full image
    for v in vehicles:
        vx1, vy1, vx2, vy2 = v["bbox"]
        v["bbox"] = [crop_x1+vx1, crop_y1+vy1, crop_x1+vx2, crop_y1+vy2]

    for i, v in enumerate(vehicles):
        print(f"  Vehicle {i+1}: bbox={v['bbox']}, conf={v['confidence']:.2f}")

    # ── Step 4: ANPR
    print(f"\n── Step 3: ANPR (on full image) ──")
    for i, v in enumerate(vehicles):
        vx1, vy1, vx2, vy2 = v["bbox"]
        pad = 20
        crop = image[max(0,vy1-pad):min(h,vy2+pad), max(0,vx1-pad):min(w,vx2+pad)]
        plate = read_plate(crop)
        v["plate"] = plate
        print(f"  Vehicle {i+1}: plate = {plate if plate else '(not read)'}")

    # ── Step 5: Spot occupancy
    print(f"\n── Step 4: Spot Occupancy Check ──")
    results = {}
    for i, (name, coords) in enumerate(zip(SPOT_NAMES, spot_coords)):
        print(f"\n  Spot {name} {coords}:")
        occupied, veh, overlap = is_spot_occupied(coords, vehicles)
        if occupied:
            plate = veh.get("plate", "unknown")
            print(f"    🔴 OCCUPIED — plate: {plate}, overlap: {overlap:.0%}")
            results[name] = {"status": "occupied", "plate": plate, "overlap": overlap}
        else:
            print(f"    🟢 AVAILABLE")
            results[name] = {"status": "available"}

    # ── Summary
    print(f"\n── Summary ──")
    for name, r in results.items():
        if r["status"] == "occupied":
            print(f"  {name}: 🔴 OCCUPIED  (plate: {r['plate']}, overlap: {r['overlap']:.0%})")
        else:
            print(f"  {name}: 🟢 AVAILABLE")

    # ── Save debug image
    debug = image.copy()
    colors = [(255, 0, 0), (0, 255, 0), (239, 68, 68)]
    for i, (name, coords) in enumerate(zip(SPOT_NAMES, spot_coords)):
        x1, y1, x2, y2 = coords
        status = results[name]["status"]
        color = (0, 0, 255) if status == "occupied" else (0, 255, 0)
        cv2.rectangle(debug, (x1, y1), (x2, y2), color, 3)
        cv2.putText(debug, f"{name}: {status.upper()}", (x1+8, y1+30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

    for v in vehicles:
        vx1, vy1, vx2, vy2 = v["bbox"]
        cv2.rectangle(debug, (vx1, vy1), (vx2, vy2), (255, 165, 0), 2)
        label = v.get("plate") or f"car {v['confidence']:.2f}"
        cv2.putText(debug, label, (vx1, vy1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 165, 0), 2)
        cx, cy = int((vx1+vx2)/2), int((vy1+vy2)/2)
        cv2.circle(debug, (cx, cy), 6, (0, 0, 255), -1)

    # Draw crop boundary
    cv2.rectangle(debug, (crop_x1, crop_y1), (crop_x2, crop_y2), (255, 255, 0), 2)
    cv2.putText(debug, "CROP", (crop_x1+8, crop_y1+25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    out_path = "debug_images/simulate_result.jpg"
    import os; os.makedirs("debug_images", exist_ok=True)
    cv2.imwrite(out_path, debug)
    print(f"\n  Debug image saved: {out_path}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if args:
        image_path = args[0]
    else:
        # Find most recent debug image
        images = sorted(glob.glob("debug_images/debug_*.jpg"))
        if not images:
            images = sorted(glob.glob("../parking-vision/debug_*.jpg"))
        if not images:
            print("No debug images found. Pass an image path as argument.")
            print("Usage: py simulate.py path/to/image.jpg")
            sys.exit(1)
        image_path = images[-1]
        print(f"No image specified — using most recent: {image_path}\n")

    simulate(image_path)
