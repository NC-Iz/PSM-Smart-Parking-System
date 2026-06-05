import { collection, onSnapshot } from 'firebase/firestore'
import { Activity, Clock, DollarSign, ParkingCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { db } from '../config/firebaseConfig'

interface Session {
  sessionId: string
  spotId: string
  fee: number
  startTime: any
  endTime: any
  status: string
}

interface Spot {
  spotId: string
  lotId: string
  status: string
}

interface LotOption { id: string; name: string }

type Range = '7d' | '30d' | 'all'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtMin(m: number): string {
  if (m <= 0) return '0m'
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

// Strip lotId prefix — "demo_A1" → "A1"
const stripLot = (spotId: string) =>
  spotId.includes('_') ? spotId.split('_').slice(1).join('_') : spotId

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 12,
  },
  labelStyle: { color: 'var(--text)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--text)' },
}

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div style={{
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 24px',
    display: 'flex', alignItems: 'center', gap: 16,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 10, background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={20} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 3 }}>{sub}</div>}
    </div>
  </div>
)

export default function Analytics() {
  const isMobile = useIsMobile()
  const [sessions, setSessions]       = useState<Session[]>([])
  const [spots, setSpots]             = useState<Spot[]>([])
  const [lots, setLots]               = useState<LotOption[]>([])
  const [selectedLot, setSelectedLot] = useState('all')
  const [range, setRange]             = useState<Range>('30d')

  useEffect(() => {
    return onSnapshot(collection(db, 'parkingLots'), snap => {
      setLots(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id })))
    })
  }, [])

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'parkingSessions'), snap =>
        setSessions(snap.docs.map(d => ({ sessionId: d.id, ...d.data() }) as Session)),
      ),
      onSnapshot(collection(db, 'parkingSpots'), snap =>
        setSpots(snap.docs.map(d => ({ spotId: d.id, ...d.data() }) as Spot)),
      ),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  // Filter by facility
  const lotSessions = selectedLot === 'all'
    ? sessions
    : sessions.filter(s => s.spotId.startsWith(selectedLot + '_'))

  const lotSpots = selectedLot === 'all'
    ? spots
    : spots.filter(s => s.lotId === selectedLot)

  // Filter by date range
  const cutoff = range === '7d' ? daysAgo(7) : range === '30d' ? daysAgo(30) : null

  const completed = useMemo(() => lotSessions.filter(s => {
    if (s.status !== 'completed') return false
    if (!cutoff) return true
    const t = s.endTime?.toDate ? s.endTime.toDate() : null
    return t && t >= cutoff
  }), [lotSessions, range])

  // Stat card values
  const totalRevenue = completed.reduce((a, s) => a + (s.fee || 0), 0)

  const avgDuration = useMemo(() => {
    const withBoth = completed.filter(s => s.startTime?.toDate && s.endTime?.toDate)
    if (!withBoth.length) return 0
    const totalMs = withBoth.reduce((a, s) =>
      a + (s.endTime.toDate().getTime() - s.startTime.toDate().getTime()), 0)
    return Math.round(totalMs / withBoth.length / 60000)
  }, [completed])

  const occupied     = lotSpots.filter(s => s.status === 'occupied').length
  const totalSpots   = lotSpots.filter(s => s.status !== 'disabled').length
  const occupancyPct = totalSpots > 0 ? Math.round((occupied / totalSpots) * 100) : 0

  // Chart 1: Daily revenue
  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(s => {
      const d = s.endTime?.toDate ? s.endTime.toDate() : null
      if (!d) return
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      map[key] = (map[key] || 0) + (s.fee || 0)
    })
    return Object.entries(map)
      .sort((a, b) => {
        const [am, ad] = a[0].split('/').map(Number)
        const [bm, bd] = b[0].split('/').map(Number)
        return am !== bm ? am - bm : ad - bd
      })
      .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
  }, [completed])

  // Chart 2: Sessions per spot
  const sessionsBySpot = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(s => {
      const spot = stripLot(s.spotId)
      map[spot] = (map[spot] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([spot, count]) => ({ spot, sessions: count }))
  }, [completed])

  // Chart 3: Peak usage hours
  const peakHours = useMemo(() => {
    const counts = Array(24).fill(0)
    completed.forEach(s => {
      const d = s.startTime?.toDate ? s.startTime.toDate() : null
      if (d) counts[d.getHours()]++
    })
    return counts.map((count, h) => ({ hour: `${h.toString().padStart(2, '0')}h`, sessions: count }))
  }, [completed])

  const maxPeak = Math.max(...peakHours.map(h => h.sessions), 1)

  // Chart 4: Revenue by spot
  const revenueBySpot = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(s => {
      const spot = stripLot(s.spotId)
      map[spot] = (map[spot] || 0) + (s.fee || 0)
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([spot, revenue]) => ({ spot, revenue: Math.round(revenue * 100) / 100 }))
  }, [completed])

  const RangeBtn = ({ r, label }: { r: Range; label: string }) => (
    <button onClick={() => setRange(r)} style={{
      padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)',
      cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
      background: range === r ? 'var(--accent)' : 'var(--bg3)',
      color: range === r ? '#fff' : 'var(--muted)',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Parking system performance overview</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Facility selector */}
          <select
            value={selectedLot}
            onChange={e => setSelectedLot(e.target.value)}
            style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text)', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Facilities</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {/* Date range */}
          <div style={{ display: 'flex', gap: 8 }}>
            <RangeBtn r="7d"  label="7 days"   />
            <RangeBtn r="30d" label="30 days"  />
            <RangeBtn r="all" label="All time" />
          </div>
        </div>
      </div>

      {/* 4 Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <StatCard icon={DollarSign}   label="Total Revenue"   value={`RM ${totalRevenue.toFixed(2)}`} color="var(--green)"   />
        <StatCard icon={Activity}     label="Total Sessions"  value={completed.length} sub={`${completed.length} completed`} color="var(--accent)"  />
        <StatCard icon={Clock}        label="Avg Duration"    value={fmtMin(avgDuration)} sub="per session"                  color="var(--amber)"   />
        <StatCard icon={ParkingCircle} label="Occupancy Rate" value={`${occupancyPct}%`} sub={`${occupied} of ${totalSpots} spots occupied`} color="var(--accent2)" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Chart 1: Revenue by day */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Revenue by Day</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Daily earnings from completed sessions</p>
          {dailyRevenue.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `RM${v}`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`RM ${v.toFixed(2)}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} dot={{ fill: 'var(--green)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 2: Sessions per spot */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Sessions per Spot</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Most used parking spots</p>
          {sessionsBySpot.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sessionsBySpot} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="spot" tick={{ fill: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Sessions']} />
                <Bar dataKey="sessions" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Chart 3: Peak usage hours */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Peak Usage Hours</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Sessions started per hour of day</p>
          {completed.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHours} barCategoryGap="10%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Sessions']} />
                <Bar dataKey="sessions" radius={[3, 3, 0, 0]}>
                  {peakHours.map((entry, i) => (
                    <Cell key={i} fill={entry.sessions >= maxPeak * 0.7 ? 'var(--accent)' : 'rgba(79,142,247,0.35)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 4: Revenue by spot */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Revenue by Spot</h3>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Total earnings per parking spot</p>
          {revenueBySpot.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueBySpot} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `RM${v}`} />
                <YAxis type="category" dataKey="spot" tick={{ fill: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`RM ${v.toFixed(2)}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="var(--amber)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
