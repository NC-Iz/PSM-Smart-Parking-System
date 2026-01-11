// File: app/parking-map.tsx
// REPLACE your existing parking-map.tsx with this

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getParkingSpots, subscribeToSpots } from '../src/services/parkingService';

interface ParkingSpot {
  spotId: string;
  spotNumber: string;
  status: 'available' | 'occupied' | 'disabled';
  rowId: string;
}

interface ParkingRow {
  rowId: string;
  rowName: string;
  spots: ParkingSpot[];
}

export default function ParkingMapScreen() {
  const params = useLocalSearchParams();
  const locationId = params.locationId || 'demo';
  
  const [rows, setRows] = useState<ParkingRow[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullLayout, setShowFullLayout] = useState(false);

  const locationNames: { [key: string]: string } = {
    demo: 'Demo Parking',
    uthm: 'UTHM FKEE Parking',
  };

  // Fetch parking data from Firestore
  const fetchParkingData = async () => {
    try {
      const spots = await getParkingSpots(locationId as string);
      
      // Group spots by row
      const rowsMap = new Map<string, ParkingSpot[]>();
      spots.forEach((spot) => {
        const rowId = spot.rowId;
        if (!rowsMap.has(rowId)) {
          rowsMap.set(rowId, []);
        }
        rowsMap.get(rowId)!.push(spot);
      });

      // Convert to rows array
      const rowsArray: ParkingRow[] = Array.from(rowsMap.entries()).map(([rowId, spots]) => ({
        rowId,
        rowName: `Row ${rowId}`,
        spots: spots.sort((a, b) => a.spotNumber.localeCompare(b.spotNumber))
      }));

      setRows(rowsArray);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching parking data:', error);
      setLoading(false);
    }
  };

  // Set up real-time listener
  useEffect(() => {
    const unsubscribe = subscribeToSpots(locationId as string, (spots) => {
      // Group spots by row
      const rowsMap = new Map<string, ParkingSpot[]>();
      spots.forEach((spot) => {
        const rowId = spot.rowId;
        if (!rowsMap.has(rowId)) {
          rowsMap.set(rowId, []);
        }
        rowsMap.get(rowId)!.push(spot);
      });

      // Convert to rows array
      const rowsArray: ParkingRow[] = Array.from(rowsMap.entries()).map(([rowId, spots]) => ({
        rowId,
        rowName: `Row ${rowId}`,
        spots: spots.sort((a, b) => a.spotNumber.localeCompare(b.spotNumber))
      }));

      setRows(rowsArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [locationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchParkingData();
    setRefreshing(false);
  };

  const toggleRow = (rowId: string) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  };

  const getSpotColor = (status: string) => {
    switch (status) {
      case 'available': return '#27ae60';
      case 'occupied': return '#e74c3c';
      case 'disabled': return '#95a5a6';
      default: return '#bdc3c7';
    }
  };

  const totalSpots = rows.reduce((sum, row) => sum + row.spots.length, 0);
  const availableSpots = rows.reduce((sum, row) => 
    sum + row.spots.filter(s => s.status === 'available').length, 0
  );
  const occupiedSpots = rows.reduce((sum, row) => 
    sum + row.spots.filter(s => s.status === 'occupied').length, 0
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading parking data...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{locationNames[locationId as string]}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#27ae60' }]}>{availableSpots}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#e74c3c' }]}>{occupiedSpots}</Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#7f8c8d' }]}>{totalSpots}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.layoutSection}>
            <View style={styles.layoutHeader}>
              <Text style={styles.layoutTitle}>Parking Layout</Text>
              <TouchableOpacity 
                style={styles.viewLayoutButton}
                onPress={() => setShowFullLayout(true)}
              >
                <Ionicons name="map-outline" size={16} color="#3498db" />
                <Text style={styles.viewLayoutText}>View Full Layout</Text>
              </TouchableOpacity>
            </View>

            {rows.length === 0 ? (
              <Text style={styles.noDataText}>No parking spots available</Text>
            ) : (
              rows.map((row) => {
                const rowAvailable = row.spots.filter(s => s.status === 'available').length;
                const isExpanded = expandedRow === row.rowId;

                return (
                  <View key={row.rowId} style={styles.rowCard}>
                    <TouchableOpacity 
                      style={styles.rowHeader}
                      onPress={() => toggleRow(row.rowId)}
                    >
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{row.rowName}</Text>
                        <Text style={styles.rowAvailable}>{rowAvailable} available</Text>
                      </View>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={24} 
                        color="#7f8c8d" 
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.spotsContainer}>
                        {row.spots.map((spot) => (
                          <View 
                            key={spot.spotId}
                            style={[styles.spotBox, { backgroundColor: getSpotColor(spot.status) }]}
                          >
                            <Text style={styles.spotNumber}>{spot.spotNumber}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#27ae60' }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.legendText}>Occupied</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#95a5a6' }]} />
              <Text style={styles.legendText}>Disabled</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <Modal visible={showFullLayout} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Full Parking Layout</Text>
            <TouchableOpacity onPress={() => setShowFullLayout(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.fullLayoutContainer}>
              {rows.map((row) => (
                <View key={row.rowId} style={styles.fullLayoutRow}>
                  <Text style={styles.fullLayoutRowLabel}>{row.rowName}</Text>
                  <View style={styles.fullLayoutSpots}>
                    {row.spots.map((spot) => (
                      <View
                        key={spot.spotId}
                        style={[styles.fullLayoutSpot, { backgroundColor: getSpotColor(spot.status) }]}
                      >
                        <Text style={styles.fullLayoutSpotText}>{spot.spotNumber}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f6fa' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#7f8c8d' },
  header: { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  statsBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#7f8c8d', marginTop: 4 },
  scrollContainer: { flex: 1 },
  layoutSection: { padding: 20 },
  layoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  layoutTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  viewLayoutButton: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#3498db' },
  viewLayoutText: { fontSize: 12, color: '#3498db', marginLeft: 4, fontWeight: '600' },
  noDataText: { textAlign: 'center', color: '#7f8c8d', fontSize: 16, marginTop: 20 },
  rowCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  rowAvailable: { fontSize: 14, color: '#27ae60', fontWeight: '500' },
  spotsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, paddingTop: 0, gap: 10 },
  spotBox: { width: 70, height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  spotNumber: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  legend: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', margin: 20, marginTop: 0, padding: 15, borderRadius: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendColor: { width: 16, height: 16, borderRadius: 8, marginRight: 6 },
  legendText: { fontSize: 12, color: '#7f8c8d' },
  modalContainer: { flex: 1, backgroundColor: '#f5f6fa' },
  modalHeader: { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalContent: { flex: 1 },
  fullLayoutContainer: { padding: 20 },
  fullLayoutRow: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15 },
  fullLayoutRowLabel: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  fullLayoutSpots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fullLayoutSpot: { width: 70, height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fullLayoutSpotText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
});