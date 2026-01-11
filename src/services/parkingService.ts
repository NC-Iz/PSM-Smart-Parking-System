// File: src/services/parkingService.ts
// CREATE this NEW file in src/services/ folder

import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Types
export interface ParkingLot {
  lotId: string;
  name: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
  };
  totalSpots: number;
  availableSpots: number;
  managerId: string;
  isActive: boolean;
  operatingHours: {
    open: string;
    close: string;
    timezone: string;
  };
  pricing: {
    hourlyRate: number;
    currency: string;
  };
}

export interface ParkingSpot {
  spotId: string;
  lotId: string;
  spotNumber: string;
  rowId: string;
  status: 'available' | 'occupied' | 'disabled';
  lastUpdated: any;
  esp32CamId: string | null;
  coordinates: { x: number; y: number };
}

export interface ParkingSession {
  sessionId: string;
  userId: string;
  spotId: string;
  licensePlate: string;
  startTime: any;
  endTime: any | null;
  status: 'active' | 'completed';
  detectionMethod: 'anpr' | 'manual';
  duration: number | null;
  fee: number | null;
  paymentStatus: 'pending' | 'paid' | 'failed';
}

// ==================== PARKING LOTS ====================

export const getParkingLots = async (): Promise<ParkingLot[]> => {
  try {
    const lotsRef = collection(db, 'parkingLots');
    const q = query(lotsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      lotId: doc.id,
      ...doc.data()
    } as ParkingLot));
  } catch (error) {
    console.error('Error getting parking lots:', error);
    throw error;
  }
};

export const getParkingLot = async (lotId: string): Promise<ParkingLot | null> => {
  try {
    const lotRef = doc(db, 'parkingLots', lotId);
    const lotDoc = await getDoc(lotRef);
    
    if (lotDoc.exists()) {
      return { lotId: lotDoc.id, ...lotDoc.data() } as ParkingLot;
    }
    return null;
  } catch (error) {
    console.error('Error getting parking lot:', error);
    throw error;
  }
};

// ==================== PARKING SPOTS ====================

export const getParkingSpots = async (lotId: string): Promise<ParkingSpot[]> => {
  try {
    const spotsRef = collection(db, 'parkingSpots');
    const q = query(spotsRef, where('lotId', '==', lotId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      spotId: doc.id,
      ...doc.data()
    } as ParkingSpot));
  } catch (error) {
    console.error('Error getting parking spots:', error);
    throw error;
  }
};

export const updateSpotStatus = async (
  spotId: string, 
  status: 'available' | 'occupied' | 'disabled'
): Promise<void> => {
  try {
    const spotRef = doc(db, 'parkingSpots', spotId);
    await updateDoc(spotRef, {
      status,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating spot status:', error);
    throw error;
  }
};

// Real-time listener for parking spots
export const subscribeToSpots = (
  lotId: string, 
  callback: (spots: ParkingSpot[]) => void
) => {
  const spotsRef = collection(db, 'parkingSpots');
  const q = query(spotsRef, where('lotId', '==', lotId));
  
  return onSnapshot(q, (snapshot) => {
    const spots = snapshot.docs.map(doc => ({
      spotId: doc.id,
      ...doc.data()
    } as ParkingSpot));
    callback(spots);
  });
};

// ==================== PARKING SESSIONS ====================

export const createParkingSession = async (
  userId: string,
  spotId: string,
  licensePlate: string,
  detectionMethod: 'anpr' | 'manual' = 'manual'
): Promise<string> => {
  try {
    const sessionId = `session_${Date.now()}`;
    const sessionData: ParkingSession = {
      sessionId,
      userId,
      spotId,
      licensePlate,
      startTime: serverTimestamp(),
      endTime: null,
      status: 'active',
      detectionMethod,
      duration: null,
      fee: null,
      paymentStatus: 'pending'
    };

    await setDoc(doc(db, 'parkingSessions', sessionId), sessionData);
    
    // Update spot status to occupied
    await updateSpotStatus(spotId, 'occupied');
    
    return sessionId;
  } catch (error) {
    console.error('Error creating parking session:', error);
    throw error;
  }
};

export const endParkingSession = async (
  sessionId: string,
  fee: number
): Promise<void> => {
  try {
    const sessionRef = doc(db, 'parkingSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) {
      throw new Error('Session not found');
    }

    const sessionData = sessionDoc.data() as ParkingSession;
    
    await updateDoc(sessionRef, {
      endTime: serverTimestamp(),
      status: 'completed',
      fee,
      paymentStatus: 'paid'
    });

    // Update spot status to available
    await updateSpotStatus(sessionData.spotId, 'available');
  } catch (error) {
    console.error('Error ending parking session:', error);
    throw error;
  }
};

export const getActiveSession = async (userId: string): Promise<ParkingSession | null> => {
  try {
    const sessionsRef = collection(db, 'parkingSessions');
    const q = query(
      sessionsRef, 
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { sessionId: doc.id, ...doc.data() } as ParkingSession;
  } catch (error) {
    console.error('Error getting active session:', error);
    throw error;
  }
};

export const getUserSessions = async (
  userId: string,
  limit: number = 20
): Promise<ParkingSession[]> => {
  try {
    const sessionsRef = collection(db, 'parkingSessions');
    const q = query(
      sessionsRef,
      where('userId', '==', userId),
      orderBy('startTime', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      sessionId: doc.id,
      ...doc.data()
    } as ParkingSession));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

export const calculateParkingFee = (
  startTime: Date,
  endTime: Date,
  hourlyRate: number
): number => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  return Math.ceil(durationHours * hourlyRate * 100) / 100; // Round up to 2 decimals
};

export const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};