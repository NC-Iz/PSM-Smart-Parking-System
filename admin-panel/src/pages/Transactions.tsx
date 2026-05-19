import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../config/firebaseConfig'

interface Transaction {
  transactionId: string
  userId: string
  type: 'topup' | 'payment'
  amount: number
  description: string
  timestamp: any
  status: string
}

export default function Transactions() {
  const [txns, setTxns]     = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'topup' | 'payment'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc')),
      snap => {
        setTxns(snap.docs.map(d => ({ transactionId: d.id, ...d.data() } as Transaction)))
        setLoading(false)
      }
    )
  }, [])

  const filtered = txns.filter(t => {
    const matchesFilter = filter === 'all' || t.type === filter
    const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) ||
                          t.transactionId?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalRevenue  = txns.filter(t => t.type === 'payment').reduce((a, t) => a + Math.abs(t.amount), 0)
  const totalTopups   = txns.filter(t => t.type === 'topup').reduce((a, t) => a + t.amount, 0)

  if (loading) return <div style={{ padding: 32, color: 'var(--muted)' }}>Loading...</div>

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Transactions</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{txns.length} total transactions</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Revenue',    value: `RM ${totalRevenue.toFixed(2)}`, color: 'var(--green)' },
          { label: 'Total Top-ups',    value: `RM ${totalTopups.toFixed(2)}`,  color: 'var(--accent)' },
          { label: 'Total Transactions', value: txns.length,                  color: 'var(--accent2)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
          {(['all', 'payment', 'topup'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--muted)',
              textTransform: 'capitalize', transition: 'all 0.15s',
            }}>
              {f === 'all' ? 'All' : f === 'payment' ? 'Payments' : 'Top-ups'}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Type', 'Description', 'Amount', 'Status', 'Date & Time'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No transactions found</td></tr>
            ) : filtered.map((txn, i) => {
              const isTopup = txn.type === 'topup'
              return (
                <tr key={txn.transactionId}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: isTopup ? 'rgba(79,142,247,0.15)' : 'rgba(34,197,94,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isTopup
                          ? <ArrowDownLeft size={14} color="var(--accent)" />
                          : <ArrowUpRight size={14} color="var(--green)" />
                        }
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isTopup ? 'var(--accent)' : 'var(--green)', textTransform: 'capitalize' }}>
                        {isTopup ? 'Top-up' : 'Payment'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>{txn.transactionId}</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isTopup ? 'var(--accent)' : 'var(--green)' }}>
                      {isTopup ? '+' : ''}RM {Math.abs(txn.amount).toFixed(2)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize',
                      background: txn.status === 'completed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      color: txn.status === 'completed' ? 'var(--green)' : 'var(--amber)',
                    }}>
                      {txn.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--muted)' }}>
                    {txn.timestamp?.toDate ? txn.timestamp.toDate().toLocaleString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
