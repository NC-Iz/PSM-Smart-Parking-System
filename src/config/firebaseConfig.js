// File: src/config/firebaseConfig.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBdgeKonHOCgXL9W0qhXgFHLB6Y8nuaW2E",
  authDomain: "smartparkingsystem-dd7ce.firebaseapp.com",
  projectId: "smartparkingsystem-dd7ce",
  storageBucket: "smartparkingsystem-dd7ce.firebasestorage.app",
  messagingSenderId: "880528409042",
  appId: "1:880528409042:web:56746ecd9c5cbf5149480b",
  measurementId: "G-TJY3KVBV1Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;