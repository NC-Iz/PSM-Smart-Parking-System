// File: app/(tabs)/parking.tsx

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  calculateLiveCharges,
  createParkingSession,
  endParkingSession,
  getActiveSession,
  getParkingLot,
  ParkingSpot,
  subscribeToOccupiedSpotByPlate,
} from "../../src/services/parkingService";
import { deductFromWallet } from "../../src/services/walletService";

interface ActiveSession {
  sessionId: string;
  spotId: string;
  spotNumber: string;
  licensePlate: string;
  startTime: Date;
  lotId: string;
  locationName: string;
}

export default function ActiveParkingScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [hourlyRate, setHourlyRate] = useState(2.0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [currentCharge, setCurrentCharge] = useState(0);
  const [duration, setDuration] = useState("0 Hours");

  const creatingSession = useRef(false);

  useEffect(() => {
    if (!user || !user.licensePlate) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToOccupiedSpotByPlate(
      user.licensePlate,
      async (userSpot: ParkingSpot | null) => {
        if (userSpot) {
          const lot = await getParkingLot(userSpot.lotId);
          const locationName = lot?.name ?? userSpot.lotId;
          let sessionId = "";
          let startTime = new Date();
          let rate = 2.0;
          try {
            const activeSession = await getActiveSession(user.uid);
            if (activeSession) {
              sessionId = activeSession.sessionId;
              startTime = activeSession.startTime?.toDate
                ? activeSession.startTime.toDate()
                : new Date();
              rate = activeSession.hourlyRate ?? 2.0;
            } else if (!creatingSession.current) {
              creatingSession.current = true;
              try {
                const lot = await getParkingLot(userSpot.lotId);
                if (lot) rate = lot.pricing.hourlyRate;
              } catch { }
              try {
                sessionId = await createParkingSession(
                  user.uid,
                  userSpot.spotId,
                  userSpot.licensePlate || user.licensePlate,
                  "anpr",
                  rate,
                );
              } finally {
                creatingSession.current = false;
              }
              startTime = new Date();
            } else {
              return;
            }
          } catch {
            creatingSession.current = false;
            sessionId = `session_${userSpot.spotId}_${Date.now()}`;
          }
          setHourlyRate(rate);
          setSession((prev) => {
            if (
              prev &&
              prev.sessionId === sessionId &&
              prev.spotId === userSpot.spotId
            )
              return prev;
            return {
              sessionId,
              spotId: userSpot.spotId,
              spotNumber: userSpot.spotNumber,
              licensePlate: userSpot.licensePlate || user.licensePlate,
              startTime,
              lotId: userSpot.lotId,
              locationName,
            };
          });
          setLoading(false);
        } else {
          setSession(null);
          setLoading(false);
          refreshUser();
        }
      },
    );
    return () => unsubscribe();
  }, [user, refreshUser]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      const charges = calculateLiveCharges(session.startTime, hourlyRate);
      setHours(charges.hours);
      setMinutes(charges.minutes);
      setSeconds(charges.seconds);
      setCurrentCharge(charges.fee);
      setDuration(`${(charges.hours + charges.minutes / 60).toFixed(1)} Hours`);
    }, 1000);
    return () => clearInterval(timer);
  }, [session, hourlyRate]);

  const handleEndParking = () => {
    if (!user || !session) return;
    if (user.walletBalance < currentCharge) {
      Alert.alert(
        "Insufficient Balance",
        `Your wallet balance (RM ${user.walletBalance.toFixed(2)}) is not enough to pay RM ${currentCharge.toFixed(2)}.\n\nPlease top up your wallet first.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Top Up Now", onPress: () => router.push("/(tabs)/wallet") },
        ],
      );
      return;
    }
    Alert.alert(
      "End Parking Session",
      `Are you sure you want to end your parking?\n\nSpot: ${session.spotNumber}\nDuration: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}\nTotal Charge: RM ${currentCharge.toFixed(2)}\n\nRM ${currentCharge.toFixed(2)} will be deducted from your wallet.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End & Pay",
          style: "destructive",
          onPress: () => processEndParking(),
        },
      ],
    );
  };

  const processEndParking = async () => {
    if (!user || !session) return;
    setEnding(true);
    try {
      const finalCharge = currentCharge;
      await endParkingSession(session.sessionId, finalCharge);
      await deductFromWallet(
        user.uid,
        finalCharge,
        `Parking at ${session.spotNumber} - ${session.locationName}`,
        session.sessionId,
        true,
      );
      await refreshUser();
      Alert.alert(
        "Parking Ended ✅",
        `RM ${finalCharge.toFixed(2)} has been deducted from your wallet.\n\nThank you for using Smart Parking!`,
        [
          {
            text: "View Receipt",
            onPress: () => router.replace("/(tabs)/history"),
          },
        ],
      );
    } catch (error: any) {
      if (error.message === "Insufficient wallet balance") {
        Alert.alert(
          "Insufficient Balance",
          "Your wallet balance is not enough. Please top up first.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Top Up", onPress: () => router.push("/(tabs)/wallet") },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to end parking session. Please try again.",
        );
      }
    } finally {
      setEnding(false);
    }
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Checking for active parking...</Text>
      </View>
    );

  if (!session)
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parking</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={80} color="#bdc3c7" />
          <Text style={styles.emptyTitle}>No Active Parking</Text>
          <Text style={styles.emptyText}>
            Drive to a parking spot and we will automatically detect your
            vehicle
          </Text>
          <Text style={styles.emptySubtext}>
            Your plate: {user?.licensePlate}
          </Text>
          <TouchableOpacity
            style={styles.findParkingButton}
            onPress={() => router.push("/(tabs)/dashboard")}
          >
            <Text style={styles.findParkingText}>View Parking Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  const entryTimeStr = session.startTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const sessionDate = session.startTime.toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const isBalanceLow = user ? user.walletBalance < currentCharge : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Parking</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>
          <View style={styles.spotCard}>
            <Text style={styles.spotNumber}>{session.spotNumber}</Text>
            <Text style={styles.locationText}>{session.locationName}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>License Plate</Text>
              <Text style={styles.infoValue}>{session.licensePlate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Entry Time</Text>
              <Text style={styles.infoValue}>{entryTimeStr}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Session Started</Text>
              <Text style={styles.infoValue}>{sessionDate}</Text>
            </View>
            <View style={styles.anprBadge}>
              <Ionicons name="camera" size={14} color="#3498db" />
              <Text style={styles.anprBadgeText}>Auto-detected by camera</Text>
            </View>
          </View>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Parking Duration</Text>
            <View style={styles.timerDisplay}>
              <View style={styles.timerUnit}>
                <Text style={styles.timerNumber}>
                  {String(hours).padStart(2, "0")}
                </Text>
                <Text style={styles.timerText}>Hours</Text>
              </View>
              <Text style={styles.timerColon}>:</Text>
              <View style={styles.timerUnit}>
                <Text style={styles.timerNumber}>
                  {String(minutes).padStart(2, "0")}
                </Text>
                <Text style={styles.timerText}>Minutes</Text>
              </View>
              <Text style={styles.timerColon}>:</Text>
              <View style={styles.timerUnit}>
                <Text style={styles.timerNumber}>
                  {String(seconds).padStart(2, "0")}
                </Text>
                <Text style={styles.timerText}>Seconds</Text>
              </View>
            </View>
          </View>
          <View style={styles.chargesCard}>
            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>Rate per Hour</Text>
              <Text style={styles.chargeValue}>
                RM {hourlyRate.toFixed(2)}
              </Text>
            </View>
            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>Duration</Text>
              <Text style={styles.chargeValue}>{duration}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.chargeRow}>
              <Text style={styles.totalLabel}>Current Charge</Text>
              <Text style={styles.totalValue}>
                RM {currentCharge.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text
              style={[
                styles.walletBalance,
                isBalanceLow && styles.walletBalanceLow,
              ]}
            >
              RM {user?.walletBalance?.toFixed(2) ?? "0.00"}
            </Text>
            {isBalanceLow && (
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={16} color="#e74c3c" />
                <Text style={styles.warningText}>
                  Insufficient balance — Please top up
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.endParkingButton,
              (isBalanceLow || ending) && styles.endParkingButtonDisabled,
            ]}
            onPress={handleEndParking}
            disabled={ending}
          >
            {ending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="stop-circle" size={22} color="#fff" />
                <Text style={styles.endParkingButtonText}>
                  End Parking & Pay RM {currentCharge.toFixed(2)}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {isBalanceLow && (
            <TouchableOpacity
              style={styles.topUpShortcutButton}
              onPress={() => router.push("/(tabs)/wallet")}
            >
              <Ionicons name="wallet" size={18} color="#3498db" />
              <Text style={styles.topUpShortcutText}>Top Up Wallet</Text>
            </TouchableOpacity>
          )}
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionInfoText}>
              💡 Tap End Parking to manually end your session and pay
            </Text>
            <Text style={styles.sessionInfoText}>
              🔄 Session will also end automatically when you exit through the
              gate
            </Text>
            <Text style={styles.sessionInfoText}>
              📍 Detected at {session.spotNumber} by ESP32-CAM
            </Text>
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
  loadingText: { marginTop: 10, fontSize: 16, color: "#7f8c8d" },
  header: {
    backgroundColor: "#3498db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scrollContainer: { flex: 1 },
  content: { padding: 20 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 20,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#3498db",
    fontWeight: "600",
    marginBottom: 30,
  },
  findParkingButton: {
    backgroundColor: "#3498db",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  findParkingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  spotCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  spotNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#3498db",
    textAlign: "center",
    marginBottom: 5,
  },
  locationText: {
    fontSize: 14,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f6fa",
  },
  infoLabel: { fontSize: 14, color: "#7f8c8d" },
  infoValue: { fontSize: 14, color: "#2c3e50", fontWeight: "600" },
  anprBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e3f2fd",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 15,
    alignSelf: "center",
  },
  anprBadgeText: {
    fontSize: 12,
    color: "#3498db",
    fontWeight: "600",
    marginLeft: 6,
  },
  timerCard: {
    backgroundColor: "#3498db",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  timerLabel: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    marginBottom: 15,
    opacity: 0.9,
  },
  timerDisplay: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  timerUnit: { alignItems: "center" },
  timerNumber: { fontSize: 36, fontWeight: "bold", color: "#fff" },
  timerText: { fontSize: 10, color: "#fff", opacity: 0.8, marginTop: 4 },
  timerColon: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginHorizontal: 10,
  },
  chargesCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  chargeLabel: { fontSize: 14, color: "#7f8c8d" },
  chargeValue: { fontSize: 14, color: "#2c3e50", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#f5f6fa", marginVertical: 10 },
  totalLabel: { fontSize: 16, color: "#2c3e50", fontWeight: "bold" },
  totalValue: { fontSize: 18, color: "#3498db", fontWeight: "bold" },
  walletCard: {
    backgroundColor: "#ecf0f1",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
  },
  walletLabel: { fontSize: 14, color: "#7f8c8d", marginBottom: 5 },
  walletBalance: { fontSize: 24, fontWeight: "bold", color: "#3498db" },
  walletBalanceLow: { color: "#e74c3c" },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fadbd8",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 10,
  },
  warningText: {
    fontSize: 12,
    color: "#e74c3c",
    fontWeight: "600",
    marginLeft: 6,
  },
  endParkingButton: {
    backgroundColor: "#e74c3c",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    gap: 10,
    shadowColor: "#e74c3c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  endParkingButtonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  endParkingButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  topUpShortcutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#3498db",
    gap: 8,
  },
  topUpShortcutText: { color: "#3498db", fontSize: 15, fontWeight: "600" },
  sessionInfo: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    marginBottom: 30,
  },
  sessionInfoText: {
    fontSize: 12,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 18,
  },
});
