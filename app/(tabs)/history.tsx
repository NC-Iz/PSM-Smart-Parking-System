// File: app/(tabs)/history.tsx
// CREATE this NEW file in app/(tabs)/ folder

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ParkingSession {
  id: string;
  location: string;
  date: string;
  entryTime: string;
  exitTime: string;
  duration: string;
  licensePlate: string;
  fee: number;
  status: 'completed';
}

export default function HistoryScreen() {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const sessions: ParkingSession[] = [
    {
      id: '1',
      location: 'UTHM FKEE Parking',
      date: '21 Nov 2025',
      entryTime: '09:15 AM',
      exitTime: '11:50 AM',
      duration: '2h 35m',
      licensePlate: 'ABC 1234',
      fee: 4.20,
      status: 'completed'
    },
    {
      id: '2',
      location: 'UTHM G3',
      date: '20 Nov 2025',
      entryTime: '02:00 PM',
      exitTime: '04:30 PM',
      duration: '2h 30m',
      licensePlate: 'ABC 1234',
      fee: 4.20,
      status: 'completed'
    },
    {
      id: '3',
      location: 'UTHM FSKTM',
      date: '19 Nov 2025',
      entryTime: '10:00 AM',
      exitTime: '02:30 PM',
      duration: '4h 30m',
      licensePlate: 'ABC 1234',
      fee: 8.20,
      status: 'completed'
    },
  ];

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ];

  const handleViewReceipt = (sessionId: string) => {
    router.push({
      pathname: '/receipt',
      params: { sessionId }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking History</Text>
      </View>

      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterTab,
              selectedFilter === filter.id && styles.filterTabActive
            ]}
            onPress={() => setSelectedFilter(filter.id)}
          >
            <Text style={[
              styles.filterText,
              selectedFilter === filter.id && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>
          {sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.locationText}>{session.location}</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              </View>

              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{session.date}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entry Time</Text>
                  <Text style={styles.detailValue}>{session.entryTime}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Exit Time</Text>
                  <Text style={styles.detailValue}>{session.exitTime}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{session.duration}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Licence Plate</Text>
                  <Text style={styles.detailValue}>{session.licensePlate}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.feeText}>RM {session.fee.toFixed(2)}</Text>
                <TouchableOpacity 
                  style={styles.receiptButton}
                  onPress={() => handleViewReceipt(session.id)}
                >
                  <Text style={styles.receiptButtonText}>Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { backgroundColor: '#3498db', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  filterContainer: { flexDirection: 'row', padding: 15, gap: 10, backgroundColor: '#fff' },
  filterTab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#e1e8ed' },
  filterTabActive: { backgroundColor: '#3498db', borderColor: '#3498db' },
  filterText: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  scrollContainer: { flex: 1 },
  content: { padding: 15 },
  sessionCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  locationText: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', flex: 1 },
  statusBadge: { backgroundColor: '#d5f4e6', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  statusText: { fontSize: 12, color: '#27ae60', fontWeight: '600' },
  detailsContainer: { marginBottom: 15 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#7f8c8d' },
  detailValue: { fontSize: 14, color: '#2c3e50', fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f5f6fa' },
  feeText: { fontSize: 20, fontWeight: 'bold', color: '#3498db' },
  receiptButton: { backgroundColor: '#3498db', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8 },
  receiptButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});