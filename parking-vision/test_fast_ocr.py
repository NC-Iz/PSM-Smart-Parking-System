"""
test_fast_ocr.py
Quick test script to compare fast-plate-ocr vs EasyOCR on images.

Usage:
  python test_fast_ocr.py                        # runs on all debug images
  python test_fast_ocr.py image.jpg              # single image
  python test_fast_ocr.py image.jpg image2.jpg   # multiple images
"""

import sys
import glob
import cv2
import numpy as np
from ultralytics import YOLO

# ── Models ────────────────────────────────────────────────────────────────────

print("Loading YOLO vehicle detector...")
yolo = YOLO("yolov8n.pt")

print("Loading YOLO plate detector...")
try:
    plate_model = YOLO("plate_detector.pt")
    print("  ✓ plate_detector.pt loaded")
except Exception as e:
    plate_model = None
    print(f"  ⚠ plate_detector.pt not found: {e}")

print("Loading fast-plate-ocr...")
try:
    from fast_plate_ocr import LicensePlateRecognizer
    fast_ocr = LicensePlateRecognizer(hub_ocr_model='global-plates-mobile-vit-v2-model')
    print("  ✓ fast-plate-ocr loaded")
except Exception as e:
    fast_ocr = None
    print(f"  ⚠ fast-plate-ocr not available: {e}")

print("Loading EasyOCR...")
try:
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
    print("  ✓ EasyOCR loaded")
except Exception as e:
    reader = None
    print(f"  ⚠ EasyOCR not available: {e}")

print()

VEHICLE_CLASSES = [2]
MIN_HEIGHT      = 96

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_plate_crop(vehicle_crop):
    """YOLO plate detect → fallback bottom 40%."""
    method = "bottom_crop"
    plate_crop = None

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
                method = "yolo_plate"
        except Exception:
            pass

    if plate_crop is None or plate_crop.size == 0:
        h, w = vehicle_crop.shape[:2]
        plate_crop = vehicle_crop[int(h*0.60):h, int(w*0.05):int(w*0.95)]
        method = "bottom_crop"

    # Upscale
    h, w = plate_crop.shape[:2]
    if h < MIN_HEIGHT:
        scale = MIN_HEIGHT / h
        plate_crop = cv2.resize(plate_crop, (int(w*scale), MIN_HEIGHT), interpolation=cv2.INTER_CUBIC)

    return plate_crop, method


def enhance(image, strength='light'):
    try:
        gray     = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        clip     = 1.5 if strength == 'light' else 2.5
        enhanced = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8,8)).apply(gray)
        denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)
        sharpened = cv2.filter2D(denoised, -1, np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]]))
        alpha    = 1.2 if strength == 'light' else 1.3
        beta     = 5   if strength == 'light' else 15
        final    = cv2.convertScaleAbs(sharpened, alpha=alpha, beta=beta)
        return cv2.cvtColor(final, cv2.COLOR_GRAY2BGR)
    except Exception:
        return image


def read_fast_ocr(plate_crop):
    if fast_ocr is None:
        return None
    try:
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
        results = fast_ocr.run(gray)
        if results and results[0]:
            text = results[0].plate if hasattr(results[0], 'plate') else str(results[0])
            return ''.join(c for c in text.upper() if c.isalnum())
    except Exception as e:
        print(f"    fast-plate-ocr error: {e}")
    return None


def read_easyocr(plate_crop):
    if reader is None:
        return None, 0.0
    for variant in [enhance(plate_crop, 'light'), plate_crop, enhance(plate_crop, 'normal')]:
        res = reader.readtext(
            variant,
            allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            width_ths=0.5,
        )
        if not res:
            continue
        res  = sorted(res, key=lambda x: x[0][0][0])
        raw  = ''.join(c for r in res for c in r[1].upper() if c.isalnum())
        conf = sum(r[2] for r in res) / len(res)
        if raw and len(raw) >= 3 and conf >= 0.25:
            return raw, round(conf, 2)
    return None, 0.0


# ── Main ──────────────────────────────────────────────────────────────────────

def test_image(path):
    print(f"{'='*60}")
    print(f"Image: {path}")
    print(f"{'='*60}")

    image = cv2.imread(path)
    if image is None:
        print("  ✗ Could not load image")
        return

    results = yolo(image, classes=VEHICLE_CLASSES, verbose=False)
    boxes   = results[0].boxes
    vehicles = [b for b in boxes if float(b.conf[0]) >= 0.4]
    print(f"  Vehicles detected: {len(vehicles)}")

    if not vehicles:
        print("  No vehicles found — skipping")
        return

    for i, box in enumerate(vehicles):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])
        pad  = 20
        h, w = image.shape[:2]
        crop = image[max(0,y1-pad):min(h,y2+pad), max(0,x1-pad):min(w,x2+pad)]

        plate_crop, method = get_plate_crop(crop)

        fast_result  = read_fast_ocr(plate_crop)
        easy_result, easy_conf = read_easyocr(plate_crop)

        print(f"\n  Vehicle {i+1} (det conf: {conf:.2f}, plate method: {method})")
        print(f"    fast-plate-ocr : {fast_result if fast_result else '— not available —'}")
        print(f"    EasyOCR        : {easy_result if easy_result else 'No plate'} (conf: {easy_conf})")

    print()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        images = sys.argv[1:]
    else:
        images = sorted(glob.glob("debug_*.jpg"))
        if not images:
            print("No debug images found. Pass an image path as argument.")
            sys.exit(1)
        # Test only the 5 most recent
        images = images[-5:]
        print(f"No image specified — testing last {len(images)} debug images\n")

    for path in images:
        test_image(path)
