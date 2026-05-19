import { signOut } from 'firebase/auth'
import { BarChart2, Camera, Car, CreditCard, LayoutDashboard, LogOut, ParkingCircle, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { auth } from '../config/firebaseConfig'
import type { AdminUser } from '../App'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/spots',        icon: ParkingCircle,   label: 'Parking Spots'  },
  { to: '/users',        icon: Users,           label: 'Users'          },
  { to: '/transactions', icon: CreditCard,      label: 'Transactions'   },
  { to: '/analytics',    icon: BarChart2,       label: 'Analytics'      },
]

const NAV_SETTINGS = [
  { to: '/camera-setup', icon: Camera,          label: 'Camera Setup'   },
]

export default function Layout({ admin }: { admin: AdminUser }) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Car size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>SmartParking</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 8 }}>MENU</div>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
              background: isActive ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          {NAV_SETTINGS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
              background: isActive ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + signout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {admin.fullName?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin.fullName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Administrator</div>
            </div>
          </div>
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'var(--muted)', fontSize: 14, fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)' }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
