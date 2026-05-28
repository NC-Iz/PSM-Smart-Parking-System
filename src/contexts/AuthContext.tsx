// File: src/contexts/AuthContext.tsx

import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDocFromServer, updateDoc } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { auth, db } from "../config/firebaseConfig";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

// ── Notification handler (shows alert even when app is foregrounded) ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Define user data structure
interface UserData {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  licensePlate: string;
  userType: "customer" | "admin" | "manager";
  walletBalance: number;
  totalBookings: number;
  isActive: boolean;
}

// Define context type
interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

// ── Register push token and save to Firestore ──
const registerPushToken = async (uid: string): Promise<void> => {
  try {
    // Push notifications only work on real devices
    if (!Device.isDevice) {
      console.log("[Push] Skipping — not a real device");
      return;
    }

    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[Push] Permission denied");
      return;
    }

    // Android requires a notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Smart Parking",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3498db",
      });
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "a88bb296-beed-436a-bd2e-4dd533f56352",
    });
    const token = tokenData.data;

    // Save token to Firestore user document
    await updateDoc(doc(db, "users", uid), { pushToken: token });
    console.log("[Push] Token registered:", token);
  } catch (error) {
    // Non-blocking — don't fail login if push token fails
    console.warn("[Push] Token registration failed:", error);
  }
};

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const userDoc = await getDocFromServer(doc(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserData;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  };

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      const userData = await fetchUserData(auth.currentUser.uid);
      if (userData) setUser(userData);
    }
  }, []);

  // Sign out function
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
          // Register push token after successful login
          await registerPushToken(firebaseUser.uid);
        } else {
          // Firestore doc not written yet (race condition during registration)
          // Use Firebase Auth data as fallback
          setUser({
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            phone: "",
            licensePlate: "",
            userType: "customer",
            walletBalance: 0,
            totalBookings: 0,
            isActive: true,
          });
          await registerPushToken(firebaseUser.uid);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
