// File: app/(tabs)/history.tsx
// REPLACE your existing history.tsx with this

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  getUserSessions,
  ParkingSession,
} from "../../src/services/parkingService";

export default function HistoryScreen() {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filters = [
    { id: "all", label: "All" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
  ];

  // ─── Load real sessions from Firestore ──────────────────
  const loadSessions = async () => {
    if (!user) return;
    try {
      const data = await getUserSessions(user.uid);
      setSessions(data);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  // ─── Filter sessions ─────────────────────────────────────
  const getFilteredSessions = () => {
    if (selectedFilter === "all") return sessions;

    const now = new Date();
    return sessions.filter((session) => {
      if (!session.startTime) return false;
      try {
        const sessionDate = session.startTime.toDate
          ? session.startTime.toDate()
          : new Date(session.startTime);

        if (selectedFilter === "week") {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return sessionDate >= weekAgo;
        }

        if (selectedFilter === "month") {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return sessionDate >= monthAgo;
        }
      } catch {
        return false;
      }
      return true;
    });
  };

  // ─── Format helpers ──────────────────────────────────────
  const formatDateTime = (timestamp: any): { date: string; time: string } => {
    if (!timestamp) return { date: "—", time: "—" };
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return {
        date: date.toLocaleDateString("en-MY", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: date.toLocaleTimeString("en-MY", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    } catch {
      return { date: "—", time: "—" };
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

  const handleViewReceipt = (session: ParkingSession) => {
    router.push({
      pathname: "/receipt",
      params: { sessionId: session.sessionId },
    });
  };

  const filteredSessions = getFilteredSessions();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking History</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterTab,
              selectedFilter === filter.id && styles.filterTabActive,
            ]}
            onPress={() => setSelectedFilter(filter.id)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.content}>
            {filteredSessions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={60} color="#bdc3c7" />
                <Text style={styles.emptyTitle}>No parking history</Text>
                <Text style={styles.emptyText}>
                  Your completed parking sessions will appear here
                </Text>
              </View>
            ) : (
              filteredSessions.map((session) => {
                const start = formatDateTime(session.startTime);
                const end = formatDateTime(session.endTime);
                const duration = formatDuration(
                  session.startTime,
                  session.endTime,
                );

                return (
                  <View key={session.sessionId} style={styles.sessionCard}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color="#3498db" />
                        <Text style={styles.locationText}>
                          {session.spotId || "Parking Spot"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          session.status === "active"
                            ? styles.statusActive
                            : styles.statusCompleted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            session.status === "active"
                              ? styles.statusTextActive
                              : styles.statusTextCompleted,
                          ]}
                        >
                          {session.status === "active" ? "Active" : "Completed"}
                        </Text>
                      </View>
                    </View>

                    {/* Details */}
                    <View style={styles.detailsContainer}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{start.date}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Entry Time</Text>
                        <Text style={styles.detailValue}>{start.time}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Exit Time</Text>
                        <Text style={styles.detailValue}>
                          {session.endTime ? end.time : "—"}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Duration</Text>
                        <Text style={styles.detailValue}>
                          {session.endTime ? duration : "In Progress"}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Licence Plate</Text>
                        <Text style={styles.detailValue}>
                          {session.licensePlate}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Detection</Text>
                        <Text style={styles.detailValue}>
                          {session.detectionMethod === "anpr"
                            ? "🔍 ANPR"
                            : "✋ Manual"}
                        </Text>
                      </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                      <Text style={styles.feeText}>
                        {session.fee != null
                          ? `RM ${session.fee.toFixed(2)}`
                          : "Pending"}
                      </Text>
                      {session.status === "completed" && (
                        <TouchableOpacity
                          style={styles.receiptButton}
                          onPress={() => handleViewReceipt(session)}
                        >
                          <Ionicons
                            name="receipt-outline"
                            size={16}
                            color="#fff"
                          />
                          <Text style={styles.receiptButtonText}>Receipt</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { backgroundColor: "#3498db", padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  filterContainer: {
    flexDirection: "row",
    padding: 15,
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#f5f6fa",
    borderWidth: 1,
    borderColor: "#e1e8ed",
  },
  filterTabActive: { backgroundColor: "#3498db", borderColor: "#3498db" },
  filterText: { fontSize: 14, color: "#7f8c8d", fontWeight: "500" },
  filterTextActive: { color: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  loadingText: { marginTop: 10, color: "#7f8c8d" },
  scrollContainer: { flex: 1 },
  content: { padding: 15 },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: { fontSize: 14, color: "#7f8c8d", textAlign: "center" },
  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f6fa",
  },
  locationRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  locationText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2c3e50",
    marginLeft: 6,
  },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  statusCompleted: { backgroundColor: "#d5f4e6" },
  statusActive: { backgroundColor: "#fef3cd" },
  statusText: { fontSize: 12, fontWeight: "600" },
  statusTextCompleted: { color: "#27ae60" },
  statusTextActive: { color: "#f39c12" },
  detailsContainer: { marginBottom: 15 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  detailLabel: { fontSize: 13, color: "#7f8c8d" },
  detailValue: { fontSize: 13, color: "#2c3e50", fontWeight: "500" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f5f6fa",
  },
  feeText: { fontSize: 20, fontWeight: "bold", color: "#3498db" },
  receiptButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3498db",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
  },
  receiptButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
