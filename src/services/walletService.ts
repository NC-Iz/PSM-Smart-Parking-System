// File: src/services/walletService.ts
// CREATE this NEW file in src/services/ folder

import {
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
    where
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export interface Transaction {
  transactionId: string;
  userId: string;
  type: 'topup' | 'payment' | 'refund';
  amount: number;
  description: string;
  timestamp: any;
  status: 'pending' | 'completed' | 'failed';
  metadata?: {
    sessionId?: string;
    paymentMethod?: string;
    referenceId?: string;
  };
}

// ==================== WALLET OPERATIONS ====================

export const getWalletBalance = async (userId: string): Promise<number> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data().walletBalance || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw error;
  }
};

export const topUpWallet = async (
  userId: string,
  amount: number,
  paymentMethod: string,
  referenceId: string
): Promise<string> => {
  try {
    // Create transaction record
    const transactionId = `txn_${Date.now()}`;
    const transaction: Transaction = {
      transactionId,
      userId,
      type: 'topup',
      amount,
      description: 'Wallet Top Up',
      timestamp: serverTimestamp(),
      status: 'completed',
      metadata: {
        paymentMethod,
        referenceId
      }
    };

    await setDoc(doc(db, 'transactions', transactionId), transaction);

    // Update user wallet balance
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      walletBalance: increment(amount)
    });

    return transactionId;
  } catch (error) {
    console.error('Error topping up wallet:', error);
    throw error;
  }
};

export const deductFromWallet = async (
  userId: string,
  amount: number,
  description: string,
  sessionId?: string
): Promise<string> => {
  try {
    // Check if user has sufficient balance
    const balance = await getWalletBalance(userId);
    if (balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // Create transaction record
    const transactionId = `txn_${Date.now()}`;
    const transaction: Transaction = {
      transactionId,
      userId,
      type: 'payment',
      amount: -amount,
      description,
      timestamp: serverTimestamp(),
      status: 'completed',
      metadata: {
        sessionId
      }
    };

    await setDoc(doc(db, 'transactions', transactionId), transaction);

    // Deduct from user wallet balance
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      walletBalance: increment(-amount)
    });

    return transactionId;
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    throw error;
  }
};

// ==================== TRANSACTION HISTORY ====================

export const getUserTransactions = async (
  userId: string,
  limit: number = 20
): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      transactionId: doc.id,
      ...doc.data()
    } as Transaction));
  } catch (error) {
    console.error('Error getting user transactions:', error);
    throw error;
  }
};

export const getTransaction = async (transactionId: string): Promise<Transaction | null> => {
  try {
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);
    
    if (transactionDoc.exists()) {
      return { 
        transactionId: transactionDoc.id, 
        ...transactionDoc.data() 
      } as Transaction;
    }
    return null;
  } catch (error) {
    console.error('Error getting transaction:', error);
    throw error;
  }
};