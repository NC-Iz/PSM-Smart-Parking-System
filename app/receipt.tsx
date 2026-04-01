// File: app/receipt.tsx
// REPLACE your existing receipt.tsx with this

import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../src/config/firebaseConfig";
import { ParkingSession } from "../src/services/parkingService";

export default function ReceiptScreen() {
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ParkingSession | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Load real session from Firestore ───────────────────
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const sessionRef = doc(db, "parkingSessions", sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (sessionDoc.exists()) {
          setSession({
            sessionId: sessionDoc.id,
            ...sessionDoc.data(),
          } as ParkingSession);
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  // ─── Format helpers ──────────────────────────────────────
  const formatDateTime = (timestamp: any): string => {
    if (!timestamp) return "—";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "—";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatDuration = (startTime: any, endTime: any): string => {
    if (!startTime || !endTime) return "—";
    try {
      const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
      const end = endTime.toDate ? endTime.toDate() : new Date(endTime);
      const diffMs = end.getTime() - start.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return "—";
    }
  };

  // ─── Share receipt ───────────────────────────────────────
  const handleShare = async () => {
    if (!session) return;
    try {
      const receiptText = `
Smart Parking - Digital Receipt
================================
Receipt: #${session.sessionId.slice(-8).toUpperCase()}
Date: ${formatDateTime(session.startTime)}
Spot: ${session.spotId}
Licence Plate: ${session.licensePlate}
Entry: ${formatTime(session.startTime)}
Exit: ${formatTime(session.endTime)}
Duration: ${formatDuration(session.startTime, session.endTime)}
Total: RM ${session.fee?.toFixed(2) ?? "0.00"}
Payment: Digital Wallet
Status: ${session.paymentStatus?.toUpperCase() ?? "PAID"}
================================
Thank you for using Smart Parking!
      `.trim();

      await Share.share({ message: receiptText });
    } catch (error) {
      Alert.alert("Error", "Could not share receipt");
    }
  };

  // ─── Loading state ───────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading receipt...</Text>
      </View>
    );
  }

  // ─── Session not found ───────────────────────────────────
  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="receipt-outline" size={60} color="#bdc3c7" />
        <Text style={styles.errorTitle}>Receipt Not Found</Text>
        <Text style={styles.errorText}>This receipt could not be loaded.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const receiptNumber = `#PKG${session.sessionId.slice(-8).toUpperCase()}`;
  const duration = formatDuration(session.startTime, session.endTime);
  const hourlyRate = 2.0; // Match your system's rate

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parking Receipt</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Receipt Card */}
          <View style={styles.receiptCard}>
            {/* Logo & Status */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Ionicons name="car" size={48} color="#3498db" />
              </View>
              <Text style={styles.brandName}>Smart Parking</Text>
              <Text style={styles.brandSubtitle}>Digital Receipt</Text>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                <Text style={styles.successText}>Payment Successful</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Receipt Info */}
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Receipt Number</Text>
                <Text style={styles.detailValue}>{receiptNumber}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(session.startTime)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Spot</Text>
                <Text style={styles.detailValue}>{session.spotId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Licence Plate</Text>
                <Text style={styles.detailValue}>{session.licensePlate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Detection</Text>
                <Text style={styles.detailValue}>
                  {session.detectionMethod === "anpr" ? "🔍 ANPR" : "✋ Manual"}
                </Text>
              </View>
            </View>

            {/* Duration Box */}
            <View style={styles.durationBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Entry Time</Text>
                <Text style={styles.detailValue}>
                  {formatTime(session.startTime)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Exit Time</Text>
                <Text style={styles.detailValue}>
                  {formatTime(session.endTime)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Duration</Text>
                <Text style={styles.detailValue}>{duration}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hourly Rate</Text>
                <Text style={styles.detailValue}>
                  RM {hourlyRate.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Total */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                RM {session.fee?.toFixed(2) ?? "0.00"}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Payment Info */}
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>Digital Wallet</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={styles.detailValue}>{receiptNumber}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Status</Text>
                <Text
                  style={[
                    styles.detailValue,
                    session.paymentStatus === "paid"
                      ? styles.statusPaid
                      : styles.statusPending,
                  ]}
                >
                  {session.paymentStatus?.toUpperCase() ?? "PAID"}
                </Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footerMessage}>
              <Text style={styles.thankYouText}>
                Thank you for using Smart Parking!
              </Text>
              <Text style={styles.transactionText}>{receiptNumber}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#3498db" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.push("/(tabs)/history")}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  loadingText: { marginTop: 10, color: "#7f8c8d" },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#f5f6fa",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 15,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: { color: "#fff", fontWeight: "bold" },
  header: {
    backgroundColor: "#3498db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  scrollContainer: { flex: 1 },
  content: { padding: 20 },
  receiptCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logoSection: { alignItems: "center", marginBottom: 20 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  brandSubtitle: { fontSize: 14, color: "#7f8c8d", marginBottom: 12 },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d5f4e6",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 15,
    gap: 6,
  },
  successText: { fontSize: 12, color: "#27ae60", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#e1e8ed", marginVertical: 20 },
  section: { marginBottom: 15 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  detailLabel: { fontSize: 14, color: "#7f8c8d" },
  detailValue: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 10,
  },
  durationBox: {
    backgroundColor: "#f5f6fa",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  totalAmount: { fontSize: 26, fontWeight: "bold", color: "#3498db" },
  statusPaid: { color: "#27ae60" },
  statusPending: { color: "#f39c12" },
  footerMessage: {
    alignItems: "center",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e1e8ed",
  },
  thankYouText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "600",
    marginBottom: 4,
  },
  transactionText: { fontSize: 12, color: "#7f8c8d" },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
    marginBottom: 30,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3498db",
    gap: 8,
  },
  shareButtonText: { color: "#3498db", fontSize: 14, fontWeight: "600" },
  doneButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3498db",
    padding: 15,
    borderRadius: 10,
    gap: 8,
  },
  doneButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
