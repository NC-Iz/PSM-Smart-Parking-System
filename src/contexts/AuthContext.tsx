// File: src/contexts/AuthContext.tsx

import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
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
  // Tracks the UID that the latest onAuthStateChanged fired with.
  // When signOut fires onAuthStateChanged(null) this becomes null immediately,
  // so any in-flight getDocFromServer callback can detect it is stale.
  const expectedUid = useRef<string | null>(null);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string): Promise<UserData | null> => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
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
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down any previous snapshot listener
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;

      expectedUid.current = firebaseUser?.uid ?? null;

      if (firebaseUser) {
        setLoading(true);
        const userData = await fetchUserData(firebaseUser.uid);
        if (expectedUid.current !== firebaseUser.uid) return;
        if (userData && !userData.isActive) {
          await firebaseSignOut(auth);
          setUser(null);
          setLoading(false);
          Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
          return;
        }
        if (userData) {
          setUser(userData);
        } else {
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
        }
        setLoading(false);
        registerPushToken(firebaseUser.uid);

        // Real-time listener — kicks user out immediately if suspended while logged in
        unsubscribeSnapshot = onSnapshot(doc(db, "users", firebaseUser.uid), (snap) => {
          if (snap.exists() && snap.data().isActive === false) {
            firebaseSignOut(auth);
            setUser(null);
            Alert.alert("Account Suspended", "Your account has been suspended. Please contact support.");
          } else if (snap.exists()) {
            setUser(snap.data() as UserData);
          }
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
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
