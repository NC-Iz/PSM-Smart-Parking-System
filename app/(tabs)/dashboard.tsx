// File: app/(tabs)/dashboard.tsx

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/contexts/AuthContext";
import { subscribeToSpots } from "../../src/services/parkingService";

export default function DashboardScreen() {
  const { user, loading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("demo");
  const [availableSpots, setAvailableSpots] = useState(0);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const parkingLocations = [
    { id: "demo", name: "Demo Parking" },
    { id: "uthm", name: "UTHM FKEE Parking" },
  ];

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false),
    );
    return onSnapshot(q, (snap) => setUnreadCount(snap.size));
  }, [user]);

  useEffect(() => {
    if (unreadCount === 0) {
      shakeAnim.stopAnimation();
      shakeAnim.setValue(0);
      return;
    }
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 4,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -4,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ]),
      { iterations: -1 },
    );
    shake.start();
    return () => shake.stop();
  }, [unreadCount]);

  useEffect(() => {
    if (!user) return;
    return subscribeToSpots(selectedLocation, (spots) => {
      setAvailableSpots(spots.filter((s) => s.status === "available").length);
    });
  }, [user, selectedLocation]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hello, {user?.fullName?.split(" ")[0]} 👋
          </Text>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
          >
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <Ionicons name="notifications" size={24} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.container}>
          <View style={styles.walletCard}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletBalance}>
              RM {user?.walletBalance?.toFixed(2) ?? "0.00"}
            </Text>
            <TouchableOpacity
              style={styles.topUpButton}
              onPress={() => router.push("/(tabs)/wallet")}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.topUpButtonText}>Top Up Wallet</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.parkingCard}>
            <Text style={styles.parkingTitle}>Parking Availability</Text>
            <TouchableOpacity
              style={styles.locationSelector}
              onPress={() => setShowLocationDropdown(!showLocationDropdown)}
            >
              <Text style={styles.locationText}>
                {parkingLocations.find((l) => l.id === selectedLocation)?.name}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#2c3e50" />
            </TouchableOpacity>
            {showLocationDropdown && (
              <View style={styles.dropdown}>
                {parkingLocations.map((location) => (
                  <TouchableOpacity
                    key={location.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedLocation(location.id);
                      setShowLocationDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{location.name}</Text>
                    {selectedLocation === location.id && (
                      <Ionicons name="checkmark" size={20} color="#3498db" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.spotsDisplay}>
              <Text style={styles.spotsNumber}>{availableSpots}</Text>
              <Text style={styles.spotsLabel}>Spots Available</Text>
            </View>
            <TouchableOpacity
              style={styles.findParkingButton}
              onPress={() =>
                router.push({
                  pathname: "/parking-map",
                  params: { locationId: selectedLocation },
                })
              }
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.findParkingText}>Find Parking Now</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.vehicleCard}>
            <Text style={styles.vehicleTitle}>My Vehicle</Text>
            <View style={styles.vehicleInfo}>
              <Text style={styles.licensePlate}>{user?.licensePlate}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#f5f6fa" },
  headerSection: { backgroundColor: "#3498db", padding: 20, paddingTop: 50 },
  scrollContainer: { flex: 1, backgroundColor: "#f5f6fa" },
  container: { flex: 1, padding: 20 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#7f8c8d" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
  walletCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  walletLabel: { fontSize: 14, color: "#7f8c8d", marginBottom: 5 },
  walletBalance: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 15,
  },
  topUpButton: {
    backgroundColor: "#3498db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
  },
  topUpButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },
  parkingCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  parkingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 15,
  },
  locationSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f5f6fa",
    borderRadius: 10,
    marginBottom: 15,
  },
  locationText: { fontSize: 14, color: "#2c3e50", fontWeight: "500" },
  dropdown: {
    backgroundColor: "#f5f6fa",
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e8ed",
  },
  dropdownItemText: { fontSize: 14, color: "#2c3e50" },
  spotsDisplay: {
    backgroundColor: "#27ae60",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
  },
  spotsNumber: { fontSize: 48, fontWeight: "bold", color: "#fff" },
  spotsLabel: { fontSize: 14, color: "#fff", opacity: 0.9 },
  findParkingButton: {
    backgroundColor: "#3498db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 10,
  },
  findParkingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  vehicleCard: { backgroundColor: "#fff", borderRadius: 15, padding: 20 },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 15,
  },
  vehicleInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f5f6fa",
    borderRadius: 10,
  },
  licensePlate: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
});
