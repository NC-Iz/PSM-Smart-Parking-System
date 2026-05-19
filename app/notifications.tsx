import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../src/contexts/AuthContext";
import {
  formatNotificationTime,
  markAllAsRead,
  markAsRead,
  Notification,
  subscribeToNotifications,
} from "../src/services/notificationService";

const ICON_MAP: Record<string, string> = {
  vehicle: "car",
  session: "checkmark-circle",
  payment: "card",
  warning: "warning",
};

const COLOR_MAP: Record<string, string> = {
  vehicle: "#3498db",
  session: "#27ae60",
  payment: "#9b59b6",
  warning: "#f39c12",
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleTap = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(user.uid);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 80 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          style={{ width: 80, alignItems: "flex-end" }}
        >
          <Text
            style={[
              styles.markAllRead,
              unreadCount === 0 && styles.markAllReadDisabled,
            ]}
          >
            {markingAll ? "Updating..." : "Mark all read"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons
            name="notifications-off-outline"
            size={56}
            color="#bdc3c7"
          />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer}>
          <View style={styles.content}>
            {notifications.map((notification) => {
              const color = COLOR_MAP[notification.type] ?? "#7f8c8d";
              const icon = ICON_MAP[notification.type] ?? "notifications";
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.card, !notification.read && styles.cardUnread]}
                  onPress={() => handleTap(notification)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${color}18` },
                    ]}
                  >
                    <Ionicons name={icon as any} size={26} color={color} />
                  </View>

                  <View style={styles.notifContent}>
                    <View style={styles.notifHeader}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <Text style={styles.notifTime}>
                        {formatNotificationTime(notification.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={3}>
                      {notification.message}
                    </Text>
                  </View>

                  {!notification.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    backgroundColor: "#3498db",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  markAllRead: { fontSize: 13, color: "#fff", fontWeight: "500" },
  markAllReadDisabled: { opacity: 0.4 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { fontSize: 16, color: "#7f8c8d" },
  scrollContainer: { flex: 1 },
  content: { padding: 15 },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: "#e3f2fd",
    borderLeftWidth: 3,
    borderLeftColor: "#3498db",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
    gap: 8,
  },
  notifTitle: { fontSize: 14, fontWeight: "700", color: "#2c3e50", flex: 1 },
  notifTime: { fontSize: 11, color: "#7f8c8d", flexShrink: 0 },
  notifMessage: { fontSize: 13, color: "#7f8c8d", lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3498db",
    position: "absolute",
    top: 18,
    right: 14,
  },
});
