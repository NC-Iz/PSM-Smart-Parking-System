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
  lotId: string;
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
interface CameraDoc {
  id: string;
  label: string;
  lotId: string;
}
interface LotOption { id: string; name: string }

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div style={{
    background: "var(--bg2)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "20px 24px",
    display: "flex", alignItems: "center", gap: 16,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 10, background: `${color}18`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// Strip lotId prefix from spotId — e.g. "demo_A1" → "A1"
const stripLot = (spotId: string) =>
  spotId.includes("_") ? spotId.split("_").slice(1).join("_") : spotId;

export default function Dashboard() {
  const [spots, setSpots]             = useState<Spot[]>([]);
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [cameras, setCameras]         = useState<CameraDoc[]>([]);
  const [lots, setLots]               = useState<LotOption[]>([]);
  const [selectedLot, setSelectedLot] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "parkingLots"), snap => {
      const l = snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id }))
      setLots(l)
      setSelectedLot(prev => prev === "" && l.length > 0 ? l[0].id : prev)
    })
  }, [])

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "parkingSpots"), snap =>
        setSpots(snap.docs.map(d => ({ spotId: d.id, ...d.data() }) as Spot)),
      ),
      onSnapshot(collection(db, "parkingSessions"), snap => {
        setSessions(snap.docs.map(d => ({ sessionId: d.id, ...d.data() }) as Session));
      }),
      onSnapshot(
        query(collection(db, "users"), where("userType", "==", "customer")),
        snap => setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as User)),
      ),
      onSnapshot(collection(db, "cameras"), snap =>
        setCameras(snap.docs.map(d => d.data() as CameraDoc)),
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Filter everything by selected lot
  const filteredSpots    = spots.filter(s => s.lotId === selectedLot);
  const filteredSessions = sessions.filter(s => s.spotId.startsWith(selectedLot + "_"));
  const filteredCameras  = cameras.filter(c => c.lotId === selectedLot);

  const occupied    = filteredSpots.filter(s => s.status === "occupied").length;
  const available   = filteredSpots.filter(s => s.status === "available").length;
  const totalRev    = filteredSessions.filter(s => s.status === "completed").reduce((a, s) => a + (s.fee || 0), 0);
  const activeSess  = filteredSessions.filter(s => s.status === "active").length;
  const recent      = filteredSessions.filter(s => s.status === "completed").slice(0, 5);

  // Revenue trend (last 7 completed sessions for this lot)
  const revData = filteredSessions
    .filter(s => s.status === "completed" && s.fee)
    .slice(-7)
    .map((s, i) => ({ name: `S${i + 1}`, revenue: s.fee || 0 }));

  const CameraStatus = ({ cam }: { cam: CameraDoc }) => {
    const isOnline = filteredSpots.some(s => s.esp32CamId === cam.id);
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "var(--bg3)", borderRadius: 8, marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Camera size={16} color="var(--muted)" />
          <span style={{ fontSize: 13, color: "var(--text)", fontFamily: "var(--mono)" }}>
            {cam.label || cam.id}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: isOnline ? "var(--green)" : "var(--red)",
            boxShadow: isOnline ? "0 0 6px var(--green)" : "none",
          }} />
          <span style={{ fontSize: 12, color: isOnline ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    );
  };

  const spotColor  = (s: string) => s === "occupied" ? "var(--red)"  : s === "disabled" ? "var(--muted)" : "var(--green)";
  const spotBg     = (s: string) => s === "occupied" ? "rgba(239,68,68,0.15)" : s === "disabled" ? "rgba(107,122,153,0.15)" : "rgba(34,197,94,0.15)";
  const spotBorder = (s: string) => s === "occupied" ? "rgba(239,68,68,0.4)"  : s === "disabled" ? "rgba(107,122,153,0.4)"  : "rgba(34,197,94,0.4)";

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>Live overview of Smart Parking System</p>
        </div>
        <select
          value={selectedLot}
          onChange={e => setSelectedLot(e.target.value)}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg2)", color: "var(--text)", fontSize: 13,
            cursor: "pointer", minWidth: 180,
          }}
        >
          {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Car}       label="Occupied Spots"    value={occupied}                  sub={`${available} available`} color="var(--accent)"  />
        <StatCard icon={Activity}  label="Active Sessions"   value={activeSess}                color="var(--amber)"  />
        <StatCard icon={TrendingUp} label="Total Revenue"    value={`RM ${totalRev.toFixed(2)}`} color="var(--green)"  />
        <StatCard icon={Users}     label="Registered Users"  value={users.length}              color="var(--accent2)" />
      </div>

      {/* Spot Occupancy Grid + Revenue Trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Spot grid */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 20 }}>Spot Occupancy</h3>
          {filteredSpots.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No spots for this facility.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {filteredSpots
                .sort((a, b) => a.spotNumber.localeCompare(b.spotNumber))
                .map(spot => (
                  <div key={spot.spotId} style={{
                    background: spotBg(spot.status), border: `1px solid ${spotBorder(spot.status)}`,
                    borderRadius: 10, padding: "14px 8px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--mono)", color: spotColor(spot.status) }}>
                      {spot.spotNumber}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: spotColor(spot.status) }}>
                      {spot.status}
                    </div>
                    {spot.licensePlate && (
                      <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)", textAlign: "center" }}>
                        {spot.licensePlate}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            {[{ label: "Available", color: "var(--green)" }, { label: "Occupied", color: "var(--red)" }, { label: "Disabled", color: "var(--muted)" }]
              .map(({ label, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 20 }}>Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={revData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
                formatter={(v: number) => [`RM ${v.toFixed(2)}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} dot={{ fill: "var(--green)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Camera Status */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>Camera Status</h3>
          {filteredCameras.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No cameras for this facility.</p>
          ) : (
            filteredCameras.map(cam => <CameraStatus key={cam.id} cam={cam} />)
          )}
          <div style={{
            marginTop: 12, padding: "10px 16px", background: "rgba(79,142,247,0.08)",
            borderRadius: 8, fontSize: 12, color: "var(--muted)",
          }}>
            <span style={{ color: "var(--accent)" }}>Note: </span>
            Status reflects last Firebase write from each camera
          </div>
        </div>

        {/* Recent Sessions */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>Recent Sessions</h3>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No completed sessions yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map(s => (
                <div key={s.sessionId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text)" }}>
                      {stripLot(s.spotId)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {s.endTime?.toDate ? s.endTime.toDate().toLocaleString() : "N/A"}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
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
