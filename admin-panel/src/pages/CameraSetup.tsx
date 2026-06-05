import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Camera, Move, Plus, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { db } from "../config/firebaseConfig";

interface CameraDoc {
  id: string;
  label: string;
  ip: string;
  spots: string[];
  enabled: boolean;
  lotId?: string;
  spotCoords?: number[][];
}

interface LotOption {
  id: string;
  name: string;
}

const DEFAULT_COORDS: number[][] = [
  [5, 388, 850, 1100],
  [850, 388, 1650, 1100],
  [1650, 388, 2550, 1100],
];

const BOX_COLORS = ["#4f8ef7", "#22c55e", "#f59e0b"];
const HANDLE_SIZE = 8;
const EMPTY_FORM = { id: "", label: "", spots: "", lotId: "" };

function getEffectiveCoords(cam: CameraDoc): number[][] {
  const saved = (cam as any).spotCoords;
  if (saved?.length > 0) {
    return saved.map((c: any) =>
      Array.isArray(c) ? c : [c.x1, c.y1, c.x2, c.y2]
    );
  }
  return DEFAULT_COORDS.slice(0, cam.spots.length);
}

function spotLabel(s: string) {
  return s.includes("_") ? s.split("_").slice(1).join("_") : s;
}

export default function CameraSetup() {
  const isMobile = useIsMobile();
  const [cameras, setCameras]   = useState<CameraDoc[]>([]);
  const [activeCamIdx, setActiveCamIdx] = useState(0);
  const [online, setOnline]     = useState<boolean | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");
  const [lots, setLots]         = useState<LotOption[]>([]);

  // Edit mode
  const [editMode, setEditMode]         = useState(false);
  const [workingCoords, setWorkingCoords] = useState<number[][]>([]);
  const [savingCoords, setSavingCoords] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement>(null);

  // Refs for stable callbacks (avoid stale closures in interval)
  const editModeRef       = useRef(false);
  const workingCoordsRef  = useRef<number[][]>([]);
  const camRef            = useRef<CameraDoc | null>(null);
  const renderInfoRef     = useRef({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });
  const dragRef           = useRef<{
    boxIdx: number;
    type: "move" | "resize";
    handle: number;
    startMouseX: number;
    startMouseY: number;
    origCoord: number[];
  } | null>(null);

  const cam = cameras[activeCamIdx] ?? null;

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);
  useEffect(() => { workingCoordsRef.current = workingCoords; }, [workingCoords]);
  useEffect(() => { camRef.current = cam; }, [cam]);

  // ── Live camera list
  useEffect(() => {
    return onSnapshot(collection(db, "cameras"), (snap) => {
      const docs = snap.docs
        .map((d) => ({ ...d.data(), docId: d.id } as any))
        .filter((d) => d.id && d.label && Array.isArray(d.spots)) as CameraDoc[];
      setCameras(docs);
      setActiveCamIdx((i) => Math.min(i, Math.max(docs.length - 1, 0)));
    });
  }, []);

  // ── Live parking lots
  useEffect(() => {
    return onSnapshot(collection(db, "parkingLots"), (snap) => {
      setLots(snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id })));
    });
  }, []);

  // ── Reset on camera change
  useEffect(() => {
    setEditMode(false);
    setWorkingCoords([]);
    if (imgRef.current) imgRef.current.src = "";
    setOnline(null);
    setStreaming(false);
  }, [activeCamIdx]);

  // ── Camera status check
  const checkStatus = useCallback(() => {
    const c = camRef.current;
    if (!c?.ip) return;
    setChecking(true);
    const img   = new Image();
    img.onload  = () => { setOnline(true);  setChecking(false); };
    img.onerror = () => { setOnline(false); setChecking(false); };
    img.src = `http://${c.ip}/capture?t=${Date.now()}`;
  }, []);

  useEffect(() => {
    if (cam) checkStatus();
  }, [activeCamIdx, cam, checkStatus]);

  const stopStream = () => {
    if (imgRef.current) imgRef.current.src = "";
    setStreaming(false);
    setEditMode(false);
  };

  // ── Draw boxes — reads from refs, stable callback
  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    const c      = camRef.current;
    if (!canvas || !img || img.naturalWidth === 0 || !c) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const natRatio  = img.naturalWidth / img.naturalHeight;
    const cW = img.clientWidth, cH = img.clientHeight;
    const cRatio = cW / cH;
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (cRatio > natRatio) {
      renderedH = cH; renderedW = cH * natRatio; offsetX = (cW - renderedW) / 2; offsetY = 0;
    } else {
      renderedW = cW; renderedH = cW / natRatio; offsetX = 0; offsetY = (cH - renderedH) / 2;
    }

    if (canvas.width !== cW || canvas.height !== cH) { canvas.width = cW; canvas.height = cH; }

    const scaleX = renderedW / 2560;
    const scaleY = renderedH / 1920;
    renderInfoRef.current = { scaleX, scaleY, offsetX, offsetY };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isEditing = editModeRef.current;
    const coords    = isEditing ? workingCoordsRef.current : getEffectiveCoords(c);

    coords.forEach(([x1, y1, x2, y2], i) => {
      const sx1   = offsetX + x1 * scaleX;
      const sy1   = offsetY + y1 * scaleY;
      const sw    = (x2 - x1) * scaleX;
      const sh    = (y2 - y1) * scaleY;
      const color = BOX_COLORS[i % BOX_COLORS.length];
      const label = c.spots[i] ? spotLabel(c.spots[i]) : `S${i + 1}`;

      ctx.strokeStyle = color;
      ctx.lineWidth   = isEditing ? 2.5 : 2;
      ctx.strokeRect(sx1, sy1, sw, sh);
      ctx.fillStyle = `${color}${isEditing ? "22" : "18"}`;
      ctx.fillRect(sx1, sy1, sw, sh);

      // Label badge
      const fs = 13;
      ctx.font = `bold ${fs}px 'DM Sans', sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(sx1, sy1 - fs - 6, tw + 16, fs + 8);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, sx1 + 8, sy1 - 4);

      // Corner handles
      if (isEditing) {
        [[sx1, sy1], [sx1 + sw, sy1], [sx1 + sw, sy1 + sh], [sx1, sy1 + sh]].forEach(([hx, hy]) => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(hx - HANDLE_SIZE, hy - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2);
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.strokeRect(hx - HANDLE_SIZE, hy - HANDLE_SIZE, HANDLE_SIZE * 2, HANDLE_SIZE * 2);
        });
      }
    });
  }, []); // stable — reads from refs

  // ── Streaming interval
  useEffect(() => {
    if (streaming) {
      const id = setInterval(drawBoxes, 100);
      return () => clearInterval(id);
    }
    canvasRef.current?.getContext("2d")?.clearRect(
      0, 0, canvasRef.current?.width ?? 0, canvasRef.current?.height ?? 0
    );
  }, [streaming, activeCamIdx, drawBoxes]);

  // ── Immediate redraw when coords change during drag
  useEffect(() => {
    if (editMode && streaming) drawBoxes();
  }, [workingCoords, editMode, streaming, drawBoxes]);

  // ── Edit mode
  const startEditMode = () => {
    if (!cam) return;
    setWorkingCoords(getEffectiveCoords(cam as any));
    setEditMode(true);
  };

  const cancelEditMode = () => { setEditMode(false); setWorkingCoords([]); };

  const handleSaveCoords = async () => {
    if (!cam) return;
    setSavingCoords(true);
    try {
      await setDoc(doc(db, "cameras", (cam as any).docId), {
        spotCoords: workingCoords.map(c => ({ x1: Math.round(c[0]), y1: Math.round(c[1]), x2: Math.round(c[2]), y2: Math.round(c[3]) })),
      }, { merge: true });
      setEditMode(false);
      setWorkingCoords([]);
    } catch (err: any) {
      console.error("Save coords error:", err);
      alert(`Failed to save coordinates: ${err?.message || err}`);
    } finally {
      setSavingCoords(false);
    }
  };

  // ── Mouse helpers
  const getCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hitTest = (x: number, y: number) => {
    const { scaleX, scaleY, offsetX, offsetY } = renderInfoRef.current;
    for (let i = workingCoordsRef.current.length - 1; i >= 0; i--) {
      const [nx1, ny1, nx2, ny2] = workingCoordsRef.current[i];
      const sx1 = offsetX + nx1 * scaleX, sy1 = offsetY + ny1 * scaleY;
      const sx2 = offsetX + nx2 * scaleX, sy2 = offsetY + ny2 * scaleY;
      const corners: [number, number][] = [[sx1, sy1], [sx2, sy1], [sx2, sy2], [sx1, sy2]];
      for (let h = 0; h < 4; h++) {
        const [hx, hy] = corners[h];
        if (Math.abs(x - hx) <= HANDLE_SIZE + 4 && Math.abs(y - hy) <= HANDLE_SIZE + 4)
          return { boxIdx: i, type: "resize" as const, handle: h };
      }
      if (x >= sx1 && x <= sx2 && y >= sy1 && y <= sy2)
        return { boxIdx: i, type: "move" as const, handle: -1 };
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode) return;
    const { x, y } = getCanvasXY(e);
    const hit = hitTest(x, y);
    if (!hit) return;
    dragRef.current = { ...hit, startMouseX: x, startMouseY: y, origCoord: [...workingCoordsRef.current[hit.boxIdx]] };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode) return;
    const { x, y } = getCanvasXY(e);
    const { scaleX, scaleY } = renderInfoRef.current;

    if (dragRef.current) {
      const { boxIdx, type, handle, startMouseX, startMouseY, origCoord } = dragRef.current;
      const dx = (x - startMouseX) / scaleX;
      const dy = (y - startMouseY) / scaleY;
      const [ox1, oy1, ox2, oy2] = origCoord;
      let newCoord: number[];

      if (type === "move") {
        const w = ox2 - ox1, h = oy2 - oy1;
        const nx1 = Math.max(0, Math.min(2560 - w, ox1 + dx));
        const ny1 = Math.max(0, Math.min(1920 - h, oy1 + dy));
        newCoord = [nx1, ny1, nx1 + w, ny1 + h];
      } else {
        let [nx1, ny1, nx2, ny2] = [ox1, oy1, ox2, oy2];
        if (handle === 0) { nx1 = Math.max(0, ox1 + dx);    ny1 = Math.max(0, oy1 + dy); }
        if (handle === 1) { nx2 = Math.min(2560, ox2 + dx); ny1 = Math.max(0, oy1 + dy); }
        if (handle === 2) { nx2 = Math.min(2560, ox2 + dx); ny2 = Math.min(1920, oy2 + dy); }
        if (handle === 3) { nx1 = Math.max(0, ox1 + dx);    ny2 = Math.min(1920, oy2 + dy); }
        if (nx2 - nx1 < 50) { if (handle === 0 || handle === 3) nx1 = nx2 - 50; else nx2 = nx1 + 50; }
        if (ny2 - ny1 < 50) { if (handle === 0 || handle === 1) ny1 = ny2 - 50; else ny2 = ny1 + 50; }
        newCoord = [nx1, ny1, nx2, ny2];
      }

      setWorkingCoords(prev => { const n = [...prev]; n[boxIdx] = newCoord; return n; });
    }

    if (canvasRef.current) {
      const hit = hitTest(x, y);
      const cursors = ["nw-resize", "ne-resize", "se-resize", "sw-resize"];
      canvasRef.current.style.cursor = hit?.type === "resize"
        ? (cursors[hit.handle] ?? "nwse-resize")
        : hit?.type === "move" ? "move" : "default";
    }
  };

  const onMouseUp = () => { dragRef.current = null; };

  // ── Add camera
  const handleAdd = async () => {
    setFormError("");
    const id       = form.id.trim().toUpperCase().replace(/\s/g, "_");
    const label    = form.label.trim();
    const lotId    = form.lotId.trim();
    const rawSpots = form.spots.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

    if (!id || !label || !lotId || rawSpots.length === 0) { setFormError("All fields are required."); return; }
    if (rawSpots.length > 3) { setFormError("Maximum 3 spots per camera."); return; }
    if (cameras.some((c) => c.id === id)) { setFormError(`Camera ID "${id}" already exists.`); return; }

    const spotIds = rawSpots.map((s) => `${lotId}_${s}`);
    setSaving(true);
    try {
      await setDoc(doc(db, "cameras", id), { id, label, lotId, spots: spotIds, enabled: true }, { merge: true });
      for (const spotId of spotIds) {
        const spotNumber = spotId.replace(`${lotId}_`, "");
        await setDoc(doc(db, "parkingSpots", spotId), {
          spotNumber, lotId, rowId: spotNumber.replace(/[0-9]/g, ""),
          status: "available", esp32CamId: id, licensePlate: null,
          coordinates: { x: 0, y: 0 }, lastUpdated: serverTimestamp(),
        }, { merge: true });
      }
      setForm(EMPTY_FORM); setShowModal(false);
    } catch { setFormError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  const toggleEnabled = async (docId: string, current: boolean) => {
    await updateDoc(doc(db, "cameras", docId), { enabled: !current });
  };

  const handleDelete = async (docId: string) => {
    const camToDelete = cameras.find((c) => (c as any).docId === docId);
    const spotIds = camToDelete?.spots ?? [];
    const spotLabel2 = spotIds.length > 0
      ? `\n\nThis will also delete ${spotIds.length} spot(s): ${spotIds.map(spotLabel).join(", ")}`
      : "";
    if (!confirm(`Delete this camera?${spotLabel2}`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, "cameras", docId));
    for (const s of spotIds) batch.delete(doc(db, "parkingSpots", s));
    await batch.commit();
  };

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Camera Setup</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>Manage cameras and calibrate spot overlays</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
          borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={15} /> Add Camera
        </button>
      </div>

      {/* Camera selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {cameras.map((c, i) => (
          <button key={c.id} onClick={() => setActiveCamIdx(i)} style={{
            padding: "10px 20px", borderRadius: 8, border: "1px solid",
            borderColor: activeCamIdx === i ? "var(--accent)" : "var(--border)",
            background: activeCamIdx === i ? "rgba(79,142,247,0.12)" : "var(--bg2)",
            color: activeCamIdx === i ? "var(--accent)" : "var(--muted)",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8, opacity: c.enabled ? 1 : 0.45,
          }}>
            <Camera size={15} />
            {c.label}
            <span style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: 0.7 }}>
              ({c.spots.map(spotLabel).join(", ")})
            </span>
            {!c.enabled && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700 }}>DISABLED</span>}
          </button>
        ))}
        {cameras.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No cameras registered yet.</p>}
      </div>

      {cam && (
        <>
          {/* Info bar */}
          <div style={{
            display: "flex", alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "12px 20px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {online === null || checking
                  ? <RefreshCw size={14} color="var(--muted)" style={{ animation: "spin 0.8s linear infinite" }} />
                  : online ? <Wifi size={14} color="var(--green)" /> : <WifiOff size={14} color="var(--red)" />}
                <span style={{ fontSize: 13, fontWeight: 500, color: online ? "var(--green)" : online === false ? "var(--red)" : "var(--muted)" }}>
                  {checking ? "Checking..." : online ? "Camera Online" : online === false ? "Camera Offline" : "Unknown"}
                </span>
              </div>
              {cam.ip
                ? <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>http://{cam.ip}/stream</span>
                : <span style={{ fontSize: 12, color: "var(--yellow, #f59e0b)", fontWeight: 600 }}>Waiting for camera to register IP...</span>}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => toggleEnabled((cam as any).docId, cam.enabled)} style={{
                padding: "7px 14px", borderRadius: 7,
                border: `1px solid ${cam.enabled ? "var(--border)" : "var(--accent)"}`,
                background: cam.enabled ? "var(--bg3)" : "rgba(79,142,247,0.12)",
                color: cam.enabled ? "var(--muted)" : "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>{cam.enabled ? "Disable" : "Enable"}</button>

              <button onClick={() => handleDelete((cam as any).docId)} style={{
                padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)",
                background: "var(--bg3)", color: "var(--red)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}><Trash2 size={13} /></button>

              <button onClick={checkStatus} style={{
                padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)",
                background: "var(--bg3)", color: "var(--muted)", cursor: "pointer", fontSize: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}><RefreshCw size={12} /> Refresh</button>

              <button onClick={() => streaming ? stopStream() : setStreaming(true)} disabled={!online} style={{
                padding: "7px 16px", borderRadius: 7, border: "none",
                cursor: online ? "pointer" : "not-allowed",
                background: streaming ? "var(--red)" : "var(--accent)",
                color: "#fff", fontSize: 12, fontWeight: 600, opacity: online ? 1 : 0.4,
              }}>{streaming ? "Stop Stream" : "Start Stream"}</button>

              {streaming && !editMode && (
                <button onClick={startEditMode} style={{
                  padding: "7px 14px", borderRadius: 7,
                  border: "1px solid var(--accent)", background: "rgba(79,142,247,0.1)",
                  color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                }}><Move size={12} /> Edit Boxes</button>
              )}

              {editMode && <>
                <button onClick={() => setWorkingCoords(DEFAULT_COORDS.slice(0, cam.spots.length))} style={{
                  padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "var(--bg3)", color: "var(--muted)", cursor: "pointer", fontSize: 12,
                }}>Reset</button>
                <button onClick={cancelEditMode} style={{
                  padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)",
                  background: "var(--bg3)", color: "var(--muted)", cursor: "pointer", fontSize: 12,
                }}>Cancel</button>
                <button onClick={handleSaveCoords} disabled={savingCoords} style={{
                  padding: "7px 16px", borderRadius: 7, border: "none",
                  background: "var(--green)", color: "#fff",
                  cursor: savingCoords ? "not-allowed" : "pointer",
                  fontSize: 12, fontWeight: 600, opacity: savingCoords ? 0.6 : 1,
                }}>{savingCoords ? "Saving..." : "Save Boxes"}</button>
              </>}
            </div>
          </div>

          {/* Edit mode banner */}
          {editMode && (
            <div style={{
              background: "rgba(79,142,247,0.1)", border: "1px solid var(--accent)",
              borderRadius: 8, padding: "10px 16px", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Move size={14} color="var(--accent)" />
              <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>
                {'Edit mode — drag boxes to move, drag corners to resize. Click "Save Boxes" when done.'}
              </span>
            </div>
          )}

          {/* Stream + overlay */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
            {!streaming ? (
              <div style={{ height: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(79,142,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: editMode ? "auto" : "none",
                  }}
                />
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            {cam.spots.map((spot, i) => (
              <div key={spot} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: BOX_COLORS[i % BOX_COLORS.length] }} />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Spot {spotLabel(spot)}
                  {(cam as any).spotCoords ? " ✓" : ""}
                </span>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div style={{ marginTop: 20, background: "rgba(79,142,247,0.06)", border: "1px solid rgba(79,142,247,0.2)", borderRadius: 10, padding: "16px 20px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>How to calibrate:</p>
            <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Run the admin panel locally (npm run dev) — stream requires local network access to the camera",
                'Start the stream then click "Edit Boxes" to enter calibration mode',
                "Drag each coloured box to align with its parking spot on the camera feed",
                "Drag the white corner handles to resize a box",
                'Click "Save Boxes" — the vision server picks up the new coordinates immediately',
                'Click "Reset" to restore the default coordinates',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* Add Camera Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: isMobile ? "90vw" : 420, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Add Camera</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>Parking Facility</label>
              <select value={form.lotId} onChange={(e) => setForm((f) => ({ ...f, lotId: e.target.value }))} style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg3)", color: form.lotId ? "var(--text)" : "var(--muted)",
                fontSize: 14, boxSizing: "border-box", cursor: "pointer",
              }}>
                <option value="">Select a facility...</option>
                {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name} ({lot.id})</option>)}
              </select>
            </div>

            {[
              { label: "Camera ID", key: "id", placeholder: "e.g. CAM_VISION_003" },
              { label: "Camera Label", key: "label", placeholder: "e.g. CAM 3" },
              { label: "Spots (comma separated)", key: "spots", placeholder: "e.g. A7, A8, A9" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
                <input value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg3)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
                  }} />
              </div>
            ))}

            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
              The Camera ID must match the one hardcoded in the Arduino sketch. The camera will register its own IP automatically on first boot.
            </p>

            {formError && <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 12 }}>{formError}</p>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormError(""); }} style={{
                padding: "9px 18px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg3)", color: "var(--muted)", cursor: "pointer", fontSize: 13,
              }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} style={{
                padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--accent)",
                color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1,
              }}>{saving ? "Saving..." : "Add Camera"}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
