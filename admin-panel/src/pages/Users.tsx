import { collection, doc, onSnapshot, updateDoc, where, query } from 'firebase/firestore'
import { Search, ShieldOff, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../config/firebaseConfig'

interface User {
  uid: string
  fullName: string
  email: string
  phone: string
  licensePlate: string
  userType: string
  walletBalance: number
  isActive: boolean
  totalBookings?: number
}

export default function Users() {
  const [users, setUsers]     = useState<User[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'users'), where('userType', '==', 'customer')),
      snap => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)))
        setLoading(false)
      }
    )
  }, [])

  const filtered = users.filter(u =>
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.licensePlate?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleActive = async (user: User) => {
    setUpdating(user.uid)
    try {
      await updateDoc(doc(db, 'users', user.uid), { isActive: !user.isActive })
    } finally {
      setUpdating(null)
    }
  }

  const adjustWallet = async (user: User) => {
    const input = window.prompt(`Adjust wallet for ${user.fullName}\nCurrent: RM ${user.walletBalance.toFixed(2)}\n\nEnter new balance:`)
    if (input === null) return
    const newBal = parseFloat(input)
    if (isNaN(newBal) || newBal < 0) { alert('Invalid amount'); return }
    setUpdating(user.uid)
    try {
      await updateDoc(doc(db, 'users', user.uid), { walletBalance: newBal })
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--muted)' }}>Loading...</div>

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Users</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{users.length} registered customer{users.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 24 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or plate..."
          style={{
            width: '100%', padding: '9px 12px 9px 36px',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'License Plate', 'Wallet Balance', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No users found</td></tr>
            ) : filtered.map((user, i) => (
              <tr key={user.uid} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg3)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
              >
                {/* User */}
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {user.fullName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user.email}</div>
                    </div>
                  </div>
                </td>
                {/* Plate */}
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', background: 'rgba(79,142,247,0.1)', padding: '3px 8px', borderRadius: 4 }}>
                    {user.licensePlate || '—'}
                  </span>
                </td>
                {/* Wallet */}
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: user.walletBalance > 0 ? 'var(--green)' : 'var(--red)' }}>
                    RM {(user.walletBalance || 0).toFixed(2)}
                  </span>
                </td>
                {/* Status */}
                <td style={{ padding: '14px 20px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: user.isActive !== false ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: user.isActive !== false ? 'var(--green)' : 'var(--red)',
                  }}>
                    {user.isActive !== false ? 'Active' : 'Suspended'}
                  </span>
                </td>
                {/* Actions */}
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => adjustWallet(user)} disabled={updating === user.uid}
                      title="Adjust wallet balance"
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Wallet size={13} /> Wallet
                    </button>
                    <button onClick={() => toggleActive(user)} disabled={updating === user.uid}
                      title={user.isActive !== false ? 'Suspend user' : 'Activate user'}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', color: user.isActive !== false ? 'var(--red)' : 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      {user.isActive !== false ? <><ShieldOff size={13} /> Suspend</> : <><ShieldCheck size={13} /> Activate</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
