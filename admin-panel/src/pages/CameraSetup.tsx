import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Camera, Plus, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../config/firebaseConfig";

interface CameraDoc {
  id: string;
  label: string;
  ip: string;
  spots: string[];
  enabled: boolean;
}

const SPOT_COORDS = [
  [5, 388, 850, 1100],
  [850, 388, 1650, 1100],
  [1650, 388, 2550, 1100],
];

const BOX_COLORS = ["#4f8ef7", "#22c55e", "#f59e0b"];

const EMPTY_FORM = { id: "", label: "", spots: "" };

export default function CameraSetup() {
  const [cameras, setCameras]             = useState<CameraDoc[]>([]);
  const [activeCamIdx, setActiveCamIdx]   = useState(0);
  const [online, setOnline]               = useState<boolean | null>(null);
  const [streaming, setStreaming]         = useState(false);
  const [checking, setChecking]           = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement>(null);

  const cam = cameras[activeCamIdx] ?? null;

  // ── Live camera list from Firestore ──────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "cameras"), (snap) => {
      const docs = snap.docs
        .map((d) => ({ ...d.data(), docId: d.id } as any))
        .filter((d) => d.id && d.label && Array.isArray(d.spots)) as CameraDoc[];
      setCameras(docs);
      setActiveCamIdx((i) => Math.min(i, Math.max(docs.length - 1, 0)));
    });
    return unsub;
  }, []);

  // ── Camera status check ───────────────────────────────────
  const checkStatus = useCallback(() => {
    if (!cam?.ip) return;
    setChecking(true);
    const img   = new Image();
    img.onload  = () => { setOnline(true);  setChecking(false); };
    img.onerror = () => { setOnline(false); setChecking(false); };
    img.src = `http://${cam.ip}/capture?t=${Date.now()}`;
  }, [cam]);

  const stopStream = () => {
    if (imgRef.current) imgRef.current.src = "";
    setStreaming(false);
  };

  useEffect(() => {
    if (imgRef.current) imgRef.current.src = "";
    setOnline(null);
    setStreaming(false);
    if (cam) checkStatus();
  }, [activeCamIdx, cam, checkStatus]);

  // ── Spot overlay ──────────────────────────────────────────
  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || img.naturalWidth === 0 || !cam) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const naturalRatio  = img.naturalWidth / img.naturalHeight;
    const containerW    = img.clientWidth;
    const containerH    = img.clientHeight;
    const containerRatio = containerW / containerH;

    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (containerRatio > naturalRatio) {
      renderedH = containerH; renderedW = containerH * naturalRatio;
      offsetX = (containerW - renderedW) / 2; offsetY = 0;
    } else {
      renderedW = containerW; renderedH = containerW / naturalRatio;
      offsetX = 0; offsetY = (containerH - renderedH) / 2;
    }

    if (canvas.width !== containerW || canvas.height !== containerH) {
      canvas.width = containerW; canvas.height = containerH;
    }

    const scaleX = renderedW / 2560;
    const scaleY = renderedH / 1920;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    SPOT_COORDS.forEach(([x1, y1, x2, y2], i) => {
      const sx1   = offsetX + x1 * scaleX;
      const sy1   = offsetY + y1 * scaleY;
      const sw    = (x2 - x1) * scaleX;
      const sh    = (y2 - y1) * scaleY;
      const color = BOX_COLORS[i];
      const label = cam.spots[i] ?? `S${i + 1}`;

      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(sx1, sy1, sw, sh);
      ctx.fillStyle = `${color}18`;
      ctx.fillRect(sx1, sy1, sw, sh);

      const fontSize = 13;
      ctx.font = `bold ${fontSize}px 'DM Sans', sans-serif`;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(sx1, sy1 - fontSize - 6, textW + 16, fontSize + 8);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, sx1 + 8, sy1 - 4);
    });
  }, [cam]);

  useEffect(() => {
    if (streaming) {
      const interval = setInterval(drawBoxes, 100);
      return () => clearInterval(interval);
    }
    canvasRef.current?.getContext("2d")?.clearRect(
      0, 0, canvasRef.current.width, canvasRef.current.height
    );
  }, [streaming, activeCamIdx, drawBoxes]);

  // ── Add camera ────────────────────────────────────────────
  const handleAdd = async () => {
    setFormError("");
    const id    = form.id.trim().toUpperCase().replace(/\s/g, "_");
    const label = form.label.trim();
    const spots = form.spots.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

    if (!id || !label || spots.length === 0) {
      setFormError("All fields are required.");
      return;
    }
    if (spots.length > 3) {
      setFormError("Maximum 3 spots per camera (one per coordinate box).");
      return;
    }
    if (cameras.some((c) => c.id === id)) {
      setFormError(`Camera ID "${id}" already exists.`);
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "cameras", id), {
        id, label, spots, enabled: true,
      }, { merge: true });
      setForm(EMPTY_FORM);
      setShowModal(false);
    } catch {
      setFormError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle enable/disable ─────────────────────────────────
  const toggleEnabled = async (docId: string, current: boolean) => {
    await updateDoc(doc(db, "cameras", docId), { enabled: !current });
  };

  // ── Delete camera ─────────────────────────────────────────
  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this camera?")) return;
    await deleteDoc(doc(db, "cameras", docId));
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Camera Setup</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            Manage cameras and calibrate spot overlays
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={15} /> Add Camera
        </button>
      </div>

      {/* Camera selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {cameras.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setActiveCamIdx(i)}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid",
              borderColor: activeCamIdx === i ? "var(--accent)" : "var(--border)",
              background: activeCamIdx === i ? "rgba(79,142,247,0.12)" : "var(--bg2)",
              color: activeCamIdx === i ? "var(--accent)" : "var(--muted)",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
              opacity: c.enabled ? 1 : 0.45,
            }}
          >
            <Camera size={15} />
            {c.label}
            <span style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: 0.7 }}>
              ({c.spots.join(", ")})
            </span>
            {!c.enabled && (
              <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700 }}>DISABLED</span>
            )}
          </button>
        ))}
        {cameras.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>No cameras registered yet.</p>
        )}
      </div>

      {cam && (
        <>
          {/* Info bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "12px 20px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {online === null || checking ? (
                  <RefreshCw size={14} color="var(--muted)" style={{ animation: "spin 0.8s linear infinite" }} />
                ) : online ? (
                  <Wifi size={14} color="var(--green)" />
                ) : (
                  <WifiOff size={14} color="var(--red)" />
                )}
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: online ? "var(--green)" : online === false ? "var(--red)" : "var(--muted)",
                }}>
                  {checking ? "Checking..." : online ? "Camera Online" : online === false ? "Camera Offline" : "Unknown"}
                </span>
              </div>
              {cam.ip ? (
                <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                  http://{cam.ip}/stream
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "var(--yellow, #f59e0b)", fontWeight: 600 }}>
                  Waiting for camera to register IP...
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Enable / Disable toggle */}
              <button
                onClick={() => toggleEnabled((cam as any).docId, cam.enabled)}
                style={{
                  padding: "7px 14px", borderRadius: 7,
                  border: `1px solid ${cam.enabled ? "var(--border)" : "var(--accent)"}`,
                  background: cam.enabled ? "var(--bg3)" : "rgba(79,142,247,0.12)",
                  color: cam.enabled ? "var(--muted)" : "var(--accent)",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}
              >
                {cam.enabled ? "Disable" : "Enable"}
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDelete((cam as any).docId)}
                style={{
                  padding: "7px 12px", borderRadius: 7,
                  border: "1px solid var(--border)", background: "var(--bg3)",
                  color: "var(--red)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Trash2 size={13} />
              </button>

              <button
                onClick={checkStatus}
                style={{
                  padding: "7px 14px", borderRadius: 7,
                  border: "1px solid var(--border)", background: "var(--bg3)",
                  color: "var(--muted)", cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <RefreshCw size={12} /> Refresh
              </button>

              <button
                onClick={() => streaming ? stopStream() : setStreaming(true)}
                disabled={!online}
                style={{
                  padding: "7px 16px", borderRadius: 7, border: "none",
                  cursor: online ? "pointer" : "not-allowed",
                  background: streaming ? "var(--red)" : "var(--accent)",
                  color: "#fff", fontSize: 12, fontWeight: 600,
                  opacity: online ? 1 : 0.4,
                }}
              >
                {streaming ? "Stop Stream" : "Start Stream"}
              </button>
            </div>
          </div>

          {/* Stream + overlay */}
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 12, overflow: "hidden", position: "relative",
          }}>
            {!streaming ? (
              <div style={{
                height: 480, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
              }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 16,
                  background: "rgba(79,142,247,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Camera size={28} color="var(--accent)" />
                </div>
                <p style={{ fontSize: 14, color: "var(--muted)" }}>
                  {online === false ? "Camera is offline — check connection" : 'Click "Start Stream" to view live feed'}
                </p>
              </div>
            ) : (
              <div style={{ position: "relative", lineHeight: 0, background: "#000" }}>
                <img
                  ref={imgRef}
                  src={cam.ip ? `http://${cam.ip}/stream` : ""}
                  style={{ width: "100%", display: "block", maxHeight: 600, objectFit: "contain" }}
                  alt="Live stream"
                  onLoad={() => { if (streaming) drawBoxes(); }}
                  onError={() => stopStream()}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)", pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
            {cam.spots.map((spot, i) => (
              <div key={spot} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: BOX_COLORS[i] }} />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Spot {spot}</span>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div style={{
            marginTop: 20, background: "rgba(79,142,247,0.06)",
            border: "1px solid rgba(79,142,247,0.2)", borderRadius: 10, padding: "16px 20px",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>
              How to calibrate:
            </p>
            <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Start the stream for the camera you want to calibrate",
                "Physically move or tilt the camera until each car is inside its coloured box",
                "Stop the stream when satisfied with the positioning",
                "The same coordinates are shared by all cameras — adjust mounting angle to match",
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* Add Camera Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 14, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>
              Add Camera
            </h2>

            {[
              { label: "Camera ID", key: "id", placeholder: "e.g. CAM_VISION_003" },
              { label: "Camera Label", key: "label", placeholder: "e.g. CAM 3" },
              { label: "Spots (comma separated)", key: "spots", placeholder: "e.g. A7, A8, A9" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--bg3)",
                    color: "var(--text)", fontSize: 14, boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
              The Camera ID must match the one hardcoded in the Arduino sketch. The camera will register its own IP automatically on first boot.
            </p>

            {formError && (
              <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 12 }}>{formError}</p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(""); }}
                style={{
                  padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--bg3)", color: "var(--muted)", cursor: "pointer", fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                style={{
                  padding: "9px 18px", borderRadius: 8, border: "none",
                  background: "var(--accent)", color: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Add Camera"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
