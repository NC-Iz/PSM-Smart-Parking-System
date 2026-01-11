// File: app/notifications.tsx
// CREATE this NEW file in app/ folder (not in tabs)

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Notification {
  id: string;
  type: 'vehicle' | 'session' | 'payment' | 'warning';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function NotificationsScreen() {
  const notifications: Notification[] = [
    {
      id: '1',
      type: 'vehicle',
      title: 'Vehicle Entry Detected',
      message: 'Your vehicle ABC 1234 entered UTHM FKEE Parking at 10:15 AM. Parking session has started at Spot A2.',
      time: '10 min ago',
      read: false,
    },
    {
      id: '2',
      type: 'session',
      title: 'Parking Session Ended',
      message: 'You exited UTHM FSKTM at 2:30 PM. Total parking duration: 4h 30m.',
      time: '1 hour ago',
      read: false,
    },
    {
      id: '3',
      type: 'payment',
      title: 'Payment Successful',
      message: 'RM 5.20 deducted from your wallet for parking at UTHM FSKTM. Receipt generated in history.',
      time: '2 hours ago',
      read: true,
    },
    {
      id: '4',
      type: 'warning',
      title: 'Low Balance Warning',
      message: 'Your wallet balance is low (RM 5.00). Please top up to avoid payment issues.',
      time: 'Yesterday',
      read: true,
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'vehicle':
        return 'car';
      case 'session':
        return 'checkmark-circle';
      case 'payment':
        return 'card';
      case 'warning':
        return 'warning';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'vehicle':
        return '#3498db';
      case 'session':
        return '#27ae60';
      case 'payment':
        return '#9b59b6';
      case 'warning':
        return '#f39c12';
      default:
        return '#7f8c8d';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <TouchableOpacity>
          <Text style={styles.markAllRead}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>
          {notifications.map((notification) => (
            <TouchableOpacity 
              key={notification.id} 
              style={[
                styles.notificationCard,
                !notification.read && styles.notificationUnread
              ]}
            >
              <View style={[
                styles.iconContainer,
                { backgroundColor: `${getIconColor(notification.type)}15` }
              ]}>
                <Ionicons 
                  name={getIcon(notification.type) as any} 
                  size={28} 
                  color={getIconColor(notification.type)} 
                />
              </View>
              
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationTime}>{notification.time}</Text>
                </View>
                <Text style={styles.notificationMessage} numberOfLines={3}>
                  {notification.message}
                </Text>
              </View>

              {!notification.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  markAllRead: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 15,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  notificationUnread: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  notificationTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#7f8c8d',
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3498db',
    position: 'absolute',
    top: 20,
    right: 15,
  },
});