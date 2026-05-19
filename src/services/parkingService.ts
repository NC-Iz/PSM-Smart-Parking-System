// File: src/services/parkingService.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { createNotification } from "./notificationService";

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
  status: "available" | "occupied" | "disabled";
  lastUpdated: any;
  esp32CamId: string | null;
  coordinates: { x: number; y: number };
  licensePlate?: string;
}

export interface ParkingSession {
  sessionId: string;
  userId: string;
  spotId: string;
  licensePlate: string;
  startTime: any;
  endTime: any | null;
  status: "active" | "completed";
  detectionMethod: "anpr" | "manual";
  duration: number | null;
  fee: number | null;
  paymentStatus: "pending" | "paid" | "failed";
  hourlyRate?: number;
}

// ==================== PARKING LOTS ====================

export const getParkingLots = async (): Promise<ParkingLot[]> => {
  try {
    const q = query(
      collection(db, "parkingLots"),
      where("isActive", "==", true),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) => ({ lotId: doc.id, ...doc.data() }) as ParkingLot,
    );
  } catch (error) {
    console.error("Error getting parking lots:", error);
    throw error;
  }
};

export const getParkingLot = async (
  lotId: string,
): Promise<ParkingLot | null> => {
  try {
    const lotDoc = await getDoc(doc(db, "parkingLots", lotId));
    if (lotDoc.exists()) {
      return { lotId: lotDoc.id, ...lotDoc.data() } as ParkingLot;
    }
    return null;
  } catch (error) {
    console.error("Error getting parking lot:", error);
    throw error;
  }
};

// ==================== PARKING SPOTS ====================

export const getParkingSpots = async (
  lotId: string,
): Promise<ParkingSpot[]> => {
  try {
    const q = query(
      collection(db, "parkingSpots"),
      where("lotId", "==", lotId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) => ({ spotId: doc.id, ...doc.data() }) as ParkingSpot,
    );
  } catch (error) {
    console.error("Error getting parking spots:", error);
    throw error;
  }
};

export const updateSpotStatus = async (
  spotId: string,
  status: "available" | "occupied" | "disabled",
): Promise<void> => {
  try {
    await updateDoc(doc(db, "parkingSpots", spotId), {
      status,
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating spot status:", error);
    throw error;
  }
};

export const subscribeToSpots = (
  lotId: string,
  callback: (spots: ParkingSpot[]) => void,
) => {
  const q = query(collection(db, "parkingSpots"), where("lotId", "==", lotId));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map(
        (doc) => ({ spotId: doc.id, ...doc.data() }) as ParkingSpot,
      ),
    );
  });
};

export const subscribeToOccupiedSpotByPlate = (
  licensePlate: string,
  callback: (spot: ParkingSpot | null) => void,
) => {
  const normalized = licensePlate.replace(/\s/g, "").toUpperCase();
  const q = query(
    collection(db, "parkingSpots"),
    where("licensePlate", "==", normalized),
    where("status", "==", "occupied"),
  );
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
    } else {
      const d = snapshot.docs[0];
      callback({ spotId: d.id, ...d.data() } as ParkingSpot);
    }
  });
};

// ==================== PARKING SESSIONS ====================

export const createParkingSession = async (
  userId: string,
  spotId: string,
  licensePlate: string,
  detectionMethod: "anpr" | "manual" = "manual",
  hourlyRate: number = 2.0,
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
      status: "active",
      detectionMethod,
      duration: null,
      fee: null,
      paymentStatus: "pending",
      hourlyRate,
    };

    await setDoc(doc(db, "parkingSessions", sessionId), sessionData);
    await updateSpotStatus(spotId, "occupied");

    // Notify user that session has started
    const spotNumber = spotId.replace("demo_", "");
    await createNotification(
      userId,
      "vehicle",
      "Parking Session Started",
      `Your vehicle (${licensePlate}) has been detected at spot ${spotNumber}. Your session is now active.`,
    );

    return sessionId;
  } catch (error) {
    console.error("Error creating parking session:", error);
    throw error;
  }
};

export const endParkingSession = async (
  sessionId: string,
  fee: number,
): Promise<void> => {
  try {
    const sessionRef = doc(db, "parkingSessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      throw new Error("Session not found");
    }

    const sessionData = sessionDoc.data() as ParkingSession;

    if (sessionData.status === "completed") return;

    await updateDoc(sessionRef, {
      endTime: serverTimestamp(),
      status: "completed",
      fee,
      paymentStatus: "paid",
    });

    await updateSpotStatus(sessionData.spotId, "available");

    // Notify user that session has ended
    const spotNumber = sessionData.spotId.replace("demo_", "");
    await createNotification(
      sessionData.userId,
      "session",
      "Parking Session Ended",
      `Your parking session at spot ${spotNumber} has ended. RM ${fee.toFixed(2)} has been deducted from your wallet.`,
    );

    // Low balance warning — threshold RM5
    try {
      const userDoc = await getDoc(doc(db, "users", sessionData.userId));
      if (userDoc.exists()) {
        const balance = userDoc.data().walletBalance || 0;
        if (balance < 5.0) {
          await createNotification(
            sessionData.userId,
            "warning",
            "Low Wallet Balance",
            `Your wallet balance is RM ${balance.toFixed(2)}. Please top up to continue using Smart Parking.`,
          );
        }
      }
    } catch {
      // Non-blocking
    }
  } catch (error) {
    console.error("Error ending parking session:", error);
    throw error;
  }
};

export const getActiveSession = async (
  userId: string,
): Promise<ParkingSession | null> => {
  try {
    const q = query(
      collection(db, "parkingSessions"),
      where("userId", "==", userId),
      where("status", "==", "active"),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { sessionId: d.id, ...d.data() } as ParkingSession;
  } catch (error) {
    console.error("Error getting active session:", error);
    throw error;
  }
};

export const getUserSessions = async (
  userId: string,
  limit: number = 20,
): Promise<ParkingSession[]> => {
  try {
    const q = query(
      collection(db, "parkingSessions"),
      where("userId", "==", userId),
      orderBy("startTime", "desc"),
      firestoreLimit(limit),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) => ({ sessionId: doc.id, ...doc.data() }) as ParkingSession,
    );
  } catch (error) {
    console.error("Error getting user sessions:", error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

export const calculateParkingFee = (
  startTime: Date,
  endTime: Date,
  hourlyRate: number,
): number => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  return Math.ceil(durationHours * hourlyRate * 100) / 100;
};

export const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export const calculateLiveCharges = (startTime: Date, hourlyRate: number) => {
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  const totalHours = diffSeconds / 3600;
  const fee = totalHours * hourlyRate;

  return {
    hours,
    minutes,
    seconds,
    fee: Math.max(0, fee),
  };
};
