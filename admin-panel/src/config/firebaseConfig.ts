// src/config/firebaseConfig.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBdgeKonHOCgXL9W0qhXgFHLB6Y8nuaW2E",
  authDomain: "smartparkingsystem-dd7ce.firebaseapp.com",
  projectId: "smartparkingsystem-dd7ce",
  storageBucket: "smartparkingsystem-dd7ce.firebasestorage.app",
  messagingSenderId: "880528409042",
  appId: "1:880528409042:web:56746ecd9c5cbf5149480b",
}

const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)
