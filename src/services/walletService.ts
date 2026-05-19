// File: src/services/walletService.ts

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";

export interface Transaction {
  transactionId: string;
  userId: string;
  type: "topup" | "payment" | "refund";
  amount: number;
  description: string;
  timestamp: any;
  status: "pending" | "completed" | "failed";
  metadata?: {
    sessionId?: string;
    paymentMethod?: string;
    referenceId?: string;
  };
}

// ==================== NOTIFICATION HELPER ====================

const createNotification = async (
  userId: string,
  type: "vehicle" | "session" | "payment" | "warning",
  title: string,
  message: string,
): Promise<void> => {
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Failed to create notification:", error);
  }
};

// ==================== WALLET OPERATIONS ====================

export const getWalletBalance = async (userId: string): Promise<number> => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data().walletBalance || 0;
    }
    return 0;
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    throw error;
  }
};

export const topUpWallet = async (
  userId: string,
  amount: number,
  paymentMethod: string,
  referenceId: string,
): Promise<string> => {
  try {
    const transactionId = `txn_${Date.now()}`;
    const transaction: Transaction = {
      transactionId,
      userId,
      type: "topup",
      amount,
      description: "Wallet Top Up",
      timestamp: serverTimestamp(),
      status: "completed",
      metadata: { paymentMethod, referenceId },
    };

    await setDoc(doc(db, "transactions", transactionId), transaction);
    await updateDoc(doc(db, "users", userId), {
      walletBalance: increment(amount),
    });

    // Note: For Toyyibpay top-ups, notification is handled in Cloud Function (paymentCallback)
    // This function handles manual/direct top-ups only

    return transactionId;
  } catch (error) {
    console.error("Error topping up wallet:", error);
    throw error;
  }
};

export const deductFromWallet = async (
  userId: string,
  amount: number,
  description: string,
  sessionId?: string,
  skipNotification?: boolean, // Pass true when called from parking session — avoids duplicate notification
): Promise<string> => {
  try {
    const balance = await getWalletBalance(userId);
    if (balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    const transactionId = `txn_${Date.now()}`;
    const transaction: Transaction = {
      transactionId,
      userId,
      type: "payment",
      amount: -amount,
      description,
      timestamp: serverTimestamp(),
      status: "completed",
      metadata: { sessionId },
    };

    await setDoc(doc(db, "transactions", transactionId), transaction);
    await updateDoc(doc(db, "users", userId), {
      walletBalance: increment(-amount),
    });

    // Skip notification if called from parking session
    // endParkingSession already sends "Parking Session Ended" notification
    if (!skipNotification) {
      await createNotification(
        userId,
        "payment",
        "Payment Deducted",
        `RM ${amount.toFixed(2)} has been deducted from your wallet. ${description}`,
      );
    }

    return transactionId;
  } catch (error) {
    console.error("Error deducting from wallet:", error);
    throw error;
  }
};

// ==================== TRANSACTION HISTORY ====================

export const getUserTransactions = async (
  userId: string,
  limit: number = 20,
): Promise<Transaction[]> => {
  try {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) => ({ transactionId: doc.id, ...doc.data() }) as Transaction,
    );
  } catch (error) {
    console.error("Error getting user transactions:", error);
    throw error;
  }
};

export const getTransaction = async (
  transactionId: string,
): Promise<Transaction | null> => {
  try {
    const transactionDoc = await getDoc(doc(db, "transactions", transactionId));
    if (transactionDoc.exists()) {
      return {
        transactionId: transactionDoc.id,
        ...transactionDoc.data(),
      } as Transaction;
    }
    return null;
  } catch (error) {
    console.error("Error getting transaction:", error);
    throw error;
  }
};
