import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { auth, db } from './config/firebaseConfig'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ParkingSpots from './pages/ParkingSpots'
import Transactions from './pages/Transactions'
import Analytics from './pages/Analytics'
import CameraSetup from './pages/CameraSetup'
import Users from './pages/Users'

export interface AdminUser {
  uid: string
  fullName: string
  email: string
  userType: string
}

export default function App() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists() && snap.data().userType === 'admin') {
          setAdminUser({
            uid: firebaseUser.uid,
            fullName: snap.data().fullName,
            email: firebaseUser.email || '',
            userType: 'admin',
          })
        } else {
          await auth.signOut()
          setAdminUser(null)
        }
      } else {
        setAdminUser(null)
      }
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={adminUser ? <Navigate to="/" /> : <Login />} />
        <Route element={adminUser ? <Layout admin={adminUser} /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/spots" element={<ParkingSpots />} />
          <Route path="/users" element={<Users />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/camera-setup" element={<CameraSetup />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
