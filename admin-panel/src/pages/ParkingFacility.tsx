import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Building2, Edit2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../config/firebaseConfig'

interface Lot {
  id: string
  name: string
  hourlyRate: number
  isActive: boolean
}

const EMPTY_FORM = { lotId: '', name: '', hourlyRate: '' }

export default function ParkingFacility() {
  const [lots, setLots]         = useState<Lot[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editLot, setEditLot]   = useState<Lot | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Live list from Firestore
  useEffect(() => {
    return onSnapshot(collection(db, 'parkingLots'), (snap) => {
      setLots(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? d.id,
          hourlyRate: d.data().pricing?.hourlyRate ?? d.data().hourlyRate ?? 0,
          isActive: d.data().isActive ?? true,
        }))
      )
    })
  }, [])

  const openAdd = () => {
    setEditLot(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (lot: Lot) => {
    setEditLot(lot)
    setForm({ lotId: lot.id, name: lot.name, hourlyRate: String(lot.hourlyRate) })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setError('')
    const lotId = form.lotId.trim().toLowerCase().replace(/\s+/g, '-')
    const name  = form.name.trim()
    const rate  = parseFloat(form.hourlyRate)
    if (!editLot && !lotId)          { setError('Lot ID is required.'); return }
    if (!editLot && !/^[a-z0-9-_]+$/.test(lotId)) {
      setError('Lot ID can only contain lowercase letters, numbers, hyphens and underscores.')
      return
    }
    if (!name)                        { setError('Facility name is required.'); return }
    if (isNaN(rate) || rate <= 0)     { setError('Enter a valid hourly rate.'); return }

    setSaving(true)
    try {
      if (editLot) {
        await updateDoc(doc(db, 'parkingLots', editLot.id), {
          name,
          pricing: { hourlyRate: rate, currency: 'MYR' },
        })
      } else {
        await setDoc(doc(db, 'parkingLots', lotId), {
          name,
          isActive: true,
          pricing: { hourlyRate: rate, currency: 'MYR' },
        })
      }
      setShowModal(false)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (lot: Lot) => {
    if (!confirm(`Delete "${lot.name}"?\n\nThis will not remove associated spots or sessions.`)) return
    setDeleting(lot.id)
    try {
      await deleteDoc(doc(db, 'parkingLots', lot.id))
    } finally {
      setDeleting(null)
    }
  }

  const toggleActive = async (lot: Lot) => {
    await updateDoc(doc(db, 'parkingLots', lot.id), { isActive: !lot.isActive })
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Parking Facilities</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
            Manage parking lots and hourly rates
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Add Facility
        </button>
      </div>

      {/* Lot cards */}
      {lots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)', fontSize: 14 }}>
          No parking facilities yet. Add one to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {lots.map((lot) => (
            <div
              key={lot.id}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20,
                opacity: lot.isActive ? 1 : 0.55,
              }}
            >
              {/* Icon + actions */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(79,142,247,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={20} color="var(--accent)" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openEdit(lot)}
                    title="Edit"
                    style={{
                      padding: '6px 10px', borderRadius: 7,
                      border: '1px solid var(--border)', background: 'var(--bg3)',
                      color: 'var(--muted)', cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(lot)}
                    disabled={deleting === lot.id}
                    title="Delete"
                    style={{
                      padding: '6px 10px', borderRadius: 7,
                      border: '1px solid var(--border)', background: 'var(--bg3)',
                      color: 'var(--red)', cursor: 'pointer',
                      opacity: deleting === lot.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{lot.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 14 }}>
                ID: {lot.id}
              </div>

              {/* Rate badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 6, padding: '4px 10px',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>
                    RM {lot.hourlyRate.toFixed(2)} / hr
                  </span>
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(lot)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${lot.isActive ? 'var(--border)' : 'var(--accent)'}`,
                    background: lot.isActive ? 'var(--bg3)' : 'rgba(79,142,247,0.12)',
                    color: lot.isActive ? 'var(--muted)' : 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  {lot.isActive ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 28, width: 400,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              {editLot ? 'Edit Facility' : 'Add Facility'}
            </h2>

            {/* Lot ID — add only */}
            {!editLot && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Lot ID <span style={{ fontWeight: 400, opacity: 0.7 }}>(used in camera & spot docs)</span>
                </label>
                <input
                  value={form.lotId}
                  onChange={(e) => setForm((f) => ({ ...f, lotId: e.target.value }))}
                  placeholder="e.g. demo  or  uthm-fkee"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg3)',
                    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                    fontFamily: 'var(--mono)',
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                  Lowercase letters, numbers, hyphens and underscores only. Cannot be changed later.
                </p>
              </div>
            )}

            {/* Facility name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Facility Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Demo Parking"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg3)',
                  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Hourly rate */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Hourly Rate (RM)
              </label>
              <input
                value={form.hourlyRate}
                onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                placeholder="e.g. 2.00"
                type="number"
                min="0"
                step="0.50"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg3)',
                  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg3)',
                  color: 'var(--muted)', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : editLot ? 'Save Changes' : 'Add Facility'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
