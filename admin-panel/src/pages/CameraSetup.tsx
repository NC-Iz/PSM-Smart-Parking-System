import { Camera, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CAMERAS = [
  {
    id: "CAM_VISION_001",
    label: "CAM 1",
    streamUrl: "http://10.11.115.113/stream",
    statusUrl: "http://10.11.115.113/status",
    spots: ["A4", "A5", "A6"],
  },
  {
    id: "CAM_VISION_002",
    label: "CAM 2",
    streamUrl: "http://10.200.84.82/stream",
    statusUrl: "http://10.200.84.82/status",
    spots: ["A1", "A2", "A3"],
  },
];

// Shared spot coordinates (must match SPOT_COORDS in parking_vision_server.py)
// These are in original 2560x1920 pixel space
const SPOT_COORDS = [
  [5, 388, 850, 1100],
  [850, 388, 1650, 1100],
  [1650, 388, 2550, 1100],
];

const BOX_COLORS = ["#4f8ef7", "#22c55e", "#f59e0b"];

export default function CameraSetup() {
  const [activeCam, setActiveCam] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [checking, setChecking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const animRef = useRef<number>(0);

  const cam = CAMERAS[activeCam];

  // Check camera status
  const checkStatus = async () => {
    setChecking(true);
    try {
      const img = new Image();
      img.onload = () => {
        setOnline(true);
        setChecking(false);
      };
      img.onerror = () => {
        setOnline(false);
        setChecking(false);
      };
      img.src = `${cam.streamUrl.replace("/stream", "/capture")}?t=${Date.now()}`;
    } catch {
      setOnline(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    setOnline(null);
    setStreaming(false);
    checkStatus();
  }, [activeCam]);

  // Draw boxes on canvas over the stream frame
  const drawBoxes = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || img.naturalWidth === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get actual rendered image size (excluding letterbox)
    const naturalRatio = img.naturalWidth / img.naturalHeight;
    const containerW = img.clientWidth;
    const containerH = img.clientHeight;
    const containerRatio = containerW / containerH;

    let renderedW, renderedH, offsetX, offsetY;
    if (containerRatio > naturalRatio) {
      renderedH = containerH;
      renderedW = containerH * naturalRatio;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    } else {
      renderedW = containerW;
      renderedH = containerW / naturalRatio;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    }

    canvas.width = containerW;
    canvas.height = containerH;

    const scaleX = renderedW / 2560;
    const scaleY = renderedH / 1920;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    SPOT_COORDS.forEach(([x1, y1, x2, y2], i) => {
      const sx1 = offsetX + x1 * scaleX;
      const sy1 = offsetY + y1 * scaleY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;
      const color = BOX_COLORS[i];
      const label = cam.spots[i];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
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
  };

  useEffect(() => {
    if (streaming) {
      const interval = setInterval(drawBoxes, 100);
      return () => clearInterval(interval);
    } else {
      cancelAnimationFrame(animRef.current);
      const canvas = canvasRef.current;
      if (canvas)
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [streaming, activeCam]);

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
          Camera Setup
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
          Live stream with parking spot overlays — physically adjust camera
          position until cars fit inside the boxes
        </p>
      </div>

      {/* Camera selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {CAMERAS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setActiveCam(i)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: activeCam === i ? "var(--accent)" : "var(--border)",
              background:
                activeCam === i ? "rgba(79,142,247,0.12)" : "var(--bg2)",
              color: activeCam === i ? "var(--accent)" : "var(--muted)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Camera size={15} />
            {c.label}
            <span
              style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: 0.7 }}
            >
              ({c.spots.join(", ")})
            </span>
          </button>
        ))}
      </div>

      {/* Info bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 20px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {online === null || checking ? (
              <RefreshCw
                size={14}
                color="var(--muted)"
                style={{ animation: "spin 0.8s linear infinite" }}
              />
            ) : online ? (
              <Wifi size={14} color="var(--green)" />
            ) : (
              <WifiOff size={14} color="var(--red)" />
            )}
            <span
              style={{
                fontSize: 13,
                color: online
                  ? "var(--green)"
                  : online === false
                    ? "var(--red)"
                    : "var(--muted)",
                fontWeight: 500,
              }}
            >
              {checking
                ? "Checking..."
                : online
                  ? "Camera Online"
                  : online === false
                    ? "Camera Offline"
                    : "Unknown"}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              fontFamily: "var(--mono)",
            }}
          >
            {cam.streamUrl}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={checkStatus}
            style={{
              padding: "7px 14px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--bg3)",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => setStreaming((s) => !s)}
            disabled={!online}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              cursor: online ? "pointer" : "not-allowed",
              background: streaming ? "var(--red)" : "var(--accent)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              opacity: online ? 1 : 0.4,
              transition: "all 0.15s",
            }}
          >
            {streaming ? "Stop Stream" : "Start Stream"}
          </button>
        </div>
      </div>

      {/* Stream + canvas overlay */}
      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!streaming ? (
          <div
            style={{
              height: 480,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: "rgba(79,142,247,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={28} color="var(--accent)" />
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              {online === false
                ? "Camera is offline — check connection"
                : 'Click "Start Stream" to view live feed'}
            </p>
          </div>
        ) : (
          <div
            style={{ position: "relative", lineHeight: 0, background: "#000" }}
          >
            <img
              ref={imgRef}
              src={`${cam.streamUrl}?t=${Date.now()}`}
              style={{
                width: "100%",
                display: "block",
                maxHeight: 600,
                objectFit: "contain",
              }}
              alt="Live stream"
              onLoad={() => {
                if (streaming) drawBoxes();
              }}
              onError={() => setOnline(false)}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
        {cam.spots.map((spot, i) => (
          <div
            key={spot}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: BOX_COLORS[i],
              }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Spot {spot}
            </span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: 20,
          background: "rgba(79,142,247,0.06)",
          border: "1px solid rgba(79,142,247,0.2)",
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          📷 How to calibrate:
        </p>
        <ol
          style={{
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[
            "Start the stream for the camera you want to calibrate",
            "Physically move or tilt the camera until each car is inside its colored box",
            "Stop the stream when satisfied with the positioning",
            "The same coordinates are shared by both cameras — adjust mounting angle to match",
          ].map((step, i) => (
            <li
              key={i}
              style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}
            >
              {step}
            </li>
          ))}
        </ol>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
