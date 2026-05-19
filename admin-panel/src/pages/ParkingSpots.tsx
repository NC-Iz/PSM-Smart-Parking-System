import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { Camera, CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../config/firebaseConfig'

interface Spot {
  spotId: string
  spotNumber: string
  status: 'available' | 'occupied' | 'disabled'
  lotId: string
  rowId: string
  esp32CamId?: string
  licensePlate?: string
  detectionConfidence?: number
  lastUpdated?: any
}

const STATUS_COLOR: Record<string, string> = {
  available: 'var(--green)',
  occupied:  'var(--red)',
  disabled:  'var(--muted)',
}

const STATUS_BG: Record<string, string> = {
  available: 'rgba(34,197,94,0.12)',
  occupied:  'rgba(239,68,68,0.12)',
  disabled:  'rgba(107,122,153,0.12)',
}

export default function ParkingSpots() {
  const [spots, setSpots]   = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'parkingSpots'), snap => {
      setSpots(snap.docs
        .map(d => ({ spotId: d.id, ...d.data() } as Spot))
        .filter(s => s.spotId.startsWith('demo_'))
        .sort((a, b) => a.spotNumber.localeCompare(b.spotNumber))
      )
      setLoading(false)
    })
  }, [])

  const toggleDisable = async (spot: Spot) => {
    setUpdating(spot.spotId)
    try {
      const newStatus = spot.status === 'disabled' ? 'available' : 'disabled'
      await updateDoc(doc(db, 'parkingSpots', spot.spotId), { status: newStatus })
    } finally {
      setUpdating(null)
    }
  }

  const occupied  = spots.filter(s => s.status === 'occupied').length
  const available = spots.filter(s => s.status === 'available').length
  const disabled  = spots.filter(s => s.status === 'disabled').length

  if (loading) return <div style={{ padding: 32, color: 'var(--muted)' }}>Loading...</div>

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Parking Spots</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Live status — updates in real time from ESP32-CAM</p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Available', count: available, color: 'var(--green)' },
          { label: 'Occupied',  count: occupied,  color: 'var(--red)'   },
          { label: 'Disabled',  count: disabled,  color: 'var(--muted)' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            padding: '8px 18px', borderRadius: 20, border: `1px solid ${color}40`,
            background: `${color}12`, fontSize: 13, fontWeight: 600, color,
          }}>
            {count} {label}
          </div>
        ))}
      </div>

      {/* Spots grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {spots.map(spot => (
          <div key={spot.spotId} style={{
            background: 'var(--bg2)', border: `1px solid ${STATUS_COLOR[spot.status]}30`,
            borderRadius: 12, padding: 20, transition: 'all 0.2s',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: STATUS_BG[spot.status],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: STATUS_COLOR[spot.status],
                  fontFamily: 'var(--mono)',
                }}>
                  {spot.spotNumber}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Spot {spot.spotNumber}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Row {spot.rowId} · {spot.lotId}</div>
                </div>
              </div>
              <div style={{
                padding: '4px 10px', borderRadius: 20,
                background: STATUS_BG[spot.status],
                fontSize: 11, fontWeight: 600, color: STATUS_COLOR[spot.status],
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {spot.status}
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {spot.licensePlate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Plate</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>{spot.licensePlate}</span>
                </div>
              )}
              {spot.detectionConfidence && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Confidence</span>
                  <span style={{ color: 'var(--text)' }}>{(spot.detectionConfidence * 100).toFixed(0)}%</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Camera</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text)', fontSize: 11, fontFamily: 'var(--mono)' }}>
                  <Camera size={12} /> {spot.esp32CamId || 'N/A'}
                </span>
              </div>
              {spot.lastUpdated?.toDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Last updated</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{spot.lastUpdated.toDate().toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Action */}
            <button
              onClick={() => toggleDisable(spot)}
              disabled={updating === spot.spotId || spot.status === 'occupied'}
              style={{
                width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg3)', cursor: spot.status === 'occupied' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 12, fontWeight: 500,
                color: spot.status === 'disabled' ? 'var(--green)' : spot.status === 'occupied' ? 'var(--muted)' : 'var(--red)',
                opacity: spot.status === 'occupied' ? 0.5 : 1, transition: 'all 0.15s',
              }}
            >
              {updating === spot.spotId ? (
                <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : spot.status === 'disabled' ? (
                <><CheckCircle size={13} /> Enable Spot</>
              ) : (
                <><XCircle size={13} /> Disable Spot</>
              )}
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
