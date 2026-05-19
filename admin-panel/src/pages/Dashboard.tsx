import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Activity, Camera, Car, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "../config/firebaseConfig";

interface Spot {
  spotId: string;
  spotNumber: string;
  status: string;
  licensePlate?: string;
  esp32CamId?: string;
}
interface Session {
  sessionId: string;
  userId: string;
  fee: number;
  startTime: any;
  endTime: any;
  status: string;
  spotId: string;
}
interface User {
  uid: string;
  fullName: string;
  walletBalance: number;
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div
    style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${color}18`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

export default function Dashboard() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recent, setRecent] = useState<Session[]>([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "parkingSpots"), (snap) =>
        setSpots(snap.docs.map((d) => ({ spotId: d.id, ...d.data() }) as Spot)),
      ),
      onSnapshot(collection(db, "parkingSessions"), (snap) => {
        const all = snap.docs.map(
          (d) => ({ sessionId: d.id, ...d.data() }) as Session,
        );
        setSessions(all);
        setRecent(all.filter((s) => s.status === "completed").slice(0, 8));
      }),
      onSnapshot(
        query(collection(db, "users"), where("userType", "==", "customer")),
        (snap) =>
          setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as User)),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const demoSpots = spots.filter((s) => s.spotId.startsWith("demo_"));
  const occupied = demoSpots.filter((s) => s.status === "occupied").length;
  const available = demoSpots.filter((s) => s.status === "available").length;
  const totalRev = sessions
    .filter((s) => s.status === "completed")
    .reduce((a, s) => a + (s.fee || 0), 0);
  const activeSess = sessions.filter((s) => s.status === "active").length;
  const cam1Online = demoSpots.some((s) => s.esp32CamId === "CAM_VISION_001");
  const cam2Online = demoSpots.some((s) => s.esp32CamId === "CAM_VISION_002");

  // Revenue trend (last 7 completed sessions)
  const revData = sessions
    .filter((s) => s.status === "completed" && s.fee)
    .slice(-7)
    .map((s, i) => ({ name: `S${i + 1}`, revenue: s.fee || 0 }));

  const CameraStatus = ({ id, online }: { id: string; online: boolean }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "var(--bg3)",
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Camera size={16} color="var(--muted)" />
        <span
          style={{
            fontSize: 13,
            color: "var(--text)",
            fontFamily: "var(--mono)",
          }}
        >
          {id}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: online ? "var(--green)" : "var(--red)",
            boxShadow: online ? "0 0 6px var(--green)" : "none",
          }}
        />
        <span
          style={{
            fontSize: 12,
            color: online ? "var(--green)" : "var(--red)",
            fontWeight: 500,
          }}
        >
          {online ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );

  const spotColor = (status: string) => {
    if (status === "occupied") return "var(--red)";
    if (status === "disabled") return "var(--muted)";
    return "var(--green)";
  };

  const spotBg = (status: string) => {
    if (status === "occupied") return "rgba(239,68,68,0.15)";
    if (status === "disabled") return "rgba(107,122,153,0.15)";
    return "rgba(34,197,94,0.15)";
  };

  const spotBorder = (status: string) => {
    if (status === "occupied") return "rgba(239,68,68,0.4)";
    if (status === "disabled") return "rgba(107,122,153,0.4)";
    return "rgba(34,197,94,0.4)";
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
          Live overview of Smart Parking System
        </p>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon={Car}
          label="Occupied Spots"
          value={occupied}
          sub={`${available} available`}
          color="var(--accent)"
        />
        <StatCard
          icon={Activity}
          label="Active Sessions"
          value={activeSess}
          color="var(--amber)"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={`RM ${totalRev.toFixed(2)}`}
          color="var(--green)"
        />
        <StatCard
          icon={Users}
          label="Registered Users"
          value={users.length}
          color="var(--accent2)"
        />
      </div>

      {/* Spot Occupancy Grid + Revenue Trend */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Spot Occupancy Grid */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 20,
            }}
          >
            Spot Occupancy
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 10,
            }}
          >
            {demoSpots
              .sort((a, b) => a.spotNumber.localeCompare(b.spotNumber))
              .map((spot) => (
                <div
                  key={spot.spotId}
                  style={{
                    background: spotBg(spot.status),
                    border: `1px solid ${spotBorder(spot.status)}`,
                    borderRadius: 10,
                    padding: "14px 8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      fontFamily: "var(--mono)",
                      color: spotColor(spot.status),
                    }}
                  >
                    {spot.spotNumber}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: spotColor(spot.status),
                    }}
                  >
                    {spot.status}
                  </div>
                  {spot.licensePlate && (
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--mono)",
                        color: "var(--muted)",
                        textAlign: "center",
                      }}
                    >
                      {spot.licensePlate}
                    </div>
                  )}
                </div>
              ))}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            {[
              { label: "Available", color: "var(--green)" },
              { label: "Occupied", color: "var(--red)" },
              { label: "Disabled", color: "var(--muted)" },
            ].map(({ label, color }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: color,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 20,
            }}
          >
            Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={revData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`RM ${v.toFixed(2)}`, "Revenue"]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--green)"
                strokeWidth={2}
                dot={{ fill: "var(--green)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Camera Status */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            Camera Status
          </h3>
          <CameraStatus id="CAM_VISION_001" online={cam1Online} />
          <CameraStatus id="CAM_VISION_002" online={cam2Online} />
          <div
            style={{
              marginTop: 12,
              padding: "10px 16px",
              background: "rgba(79,142,247,0.08)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span style={{ color: "var(--accent)" }}>Note: </span>
            Status reflects last Firebase write from each camera
          </div>
        </div>

        {/* Recent Sessions */}
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 16,
            }}
          >
            Recent Sessions
          </h3>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              No completed sessions yet
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.slice(0, 5).map((s) => (
                <div
                  key={s.sessionId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--mono)",
                        color: "var(--text)",
                      }}
                    >
                      {s.spotId.replace("demo_", "")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {s.endTime?.toDate
                        ? s.endTime.toDate().toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--green)",
                    }}
                  >
                    RM {(s.fee || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
