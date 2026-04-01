// File: parking.tsx - FINAL FIXED VERSION
// - Uses licensePlate field (matches Python)
// - No getSessionLocation error
// - Simple and working!

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  calculateLiveCharges,
  ParkingSpot,
  subscribeToSpots
} from '../../src/services/parkingService';

interface ActiveSession {
  spotId: string;
  spotNumber: string;
  licensePlate: string;
  startTime: Date;
  lotId: string;
  locationName: string;
}

export default function ActiveParkingScreen() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ActiveSession | null>(null);
  
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [currentCharge, setCurrentCharge] = useState(0);
  const [duration, setDuration] = useState('0 Hours');

  useEffect(() => {
    if (!user || !user.licensePlate) {
      setLoading(false);
      return;
    }

    console.log('🚀 Monitoring parking for plate:', user.licensePlate);

    const userPlateNormalized = user.licensePlate.replace(/\s/g, '').toUpperCase();

    const unsubscribe = subscribeToSpots('demo', async (spots: ParkingSpot[]) => {
      console.log('📡 Spots update:', spots.length);

      // Find user's vehicle - check licensePlate field
      const userSpot = spots.find(spot => {
        if (spot.status !== 'occupied') return false;
        
        // Read licensePlate field (from Python)
        const plateValue = spot.licensePlate;
        
        if (!plateValue) return false;

        const spotPlateNormalized = plateValue.replace(/\s/g, '').toUpperCase();
        const matches = spotPlateNormalized === userPlateNormalized;

        console.log(`  ${spot.spotNumber}: ${plateValue} → ${matches ? 'MATCH!' : 'no match'}`);

        return matches;
      });

      if (userSpot) {
        console.log('✅ Found vehicle at:', userSpot.spotNumber);

        // Simple location name mapping (no async call needed!)
        const locationName = userSpot.lotId === 'demo' ? 'Demo Parking' : 'UTHM FKEE Parking';
        
        const startTime = userSpot.lastUpdated?.toDate ? 
          userSpot.lastUpdated.toDate() : 
          new Date();

        const newSession: ActiveSession = {
          spotId: userSpot.spotId,
          spotNumber: userSpot.spotNumber,
          licensePlate: userSpot.licensePlate || user.licensePlate,
          startTime: startTime,
          lotId: userSpot.lotId,
          locationName: locationName
        };

        setSession(newSession);
        setLoading(false);
        
      } else {
        console.log('❌ No vehicle found');
        setSession(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!session) return;

    const timer = setInterval(() => {
      const charges = calculateLiveCharges(session.startTime, 2.00);
      
      setHours(charges.hours);
      setMinutes(charges.minutes);
      setSeconds(charges.seconds);
      setCurrentCharge(charges.fee);
      setDuration(`${charges.hours + (charges.minutes / 60).toFixed(1)} Hours`);
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Checking for active parking...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parking</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={80} color="#bdc3c7" />
          <Text style={styles.emptyTitle}>No Active Parking</Text>
          <Text style={styles.emptyText}>
            Drive to a parking spot and we'll automatically detect your vehicle
          </Text>
          <Text style={styles.emptySubtext}>
            Your plate: {user?.licensePlate}
          </Text>
          <TouchableOpacity 
            style={styles.findParkingButton}
            onPress={() => router.push('/(tabs)/dashboard')}
          >
            <Text style={styles.findParkingText}>View Parking Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const entryTimeStr = session.startTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  const sessionDate = session.startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Parking</Text>
        <View style={{ width: 24 }} />
      </View>

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
              <Text style={styles.timerNumber}>{String(hours).padStart(2, '0')}</Text>
              <Text style={styles.timerText}>Hours</Text>
            </View>
            <Text style={styles.timerColon}>:</Text>
            <View style={styles.timerUnit}>
              <Text style={styles.timerNumber}>{String(minutes).padStart(2, '0')}</Text>
              <Text style={styles.timerText}>Minutes</Text>
            </View>
            <Text style={styles.timerColon}>:</Text>
            <View style={styles.timerUnit}>
              <Text style={styles.timerNumber}>{String(seconds).padStart(2, '0')}</Text>
              <Text style={styles.timerText}>Seconds</Text>
            </View>
          </View>
        </View>

        <View style={styles.chargesCard}>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Rate per Hour</Text>
            <Text style={styles.chargeValue}>RM 2.00</Text>
          </View>
          
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Duration</Text>
            <Text style={styles.chargeValue}>{duration}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.chargeRow}>
            <Text style={styles.totalLabel}>Current Charge</Text>
            <Text style={styles.totalValue}>RM {currentCharge.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={[
            styles.walletBalance,
            user && user.walletBalance < currentCharge && styles.walletBalanceLow
          ]}>
            RM {user?.walletBalance.toFixed(2)}
          </Text>
          {user && user.walletBalance < currentCharge && (
            <View style={styles.warningBadge}>
              <Ionicons name="warning" size={16} color="#e74c3c" />
              <Text style={styles.warningText}>Insufficient balance - Please top up</Text>
            </View>
          )}
        </View>

        <View style={styles.sessionInfo}>
          <Text style={styles.sessionInfoText}>
            💡 Your parking session will automatically end when you exit the spot
          </Text>
          <Text style={styles.sessionInfoText}>
            📍 Detected at {session.spotNumber} by ESP32-CAM
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f6fa' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#7f8c8d' },
  header: { backgroundColor: '#3498db', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { padding: 20 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginTop: 20, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginBottom: 10, lineHeight: 20 },
  emptySubtext: { fontSize: 12, color: '#3498db', fontWeight: '600', marginBottom: 30 },
  findParkingButton: { backgroundColor: '#3498db', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 10 },
  findParkingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  spotCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15 },
  spotNumber: { fontSize: 32, fontWeight: 'bold', color: '#3498db', textAlign: 'center', marginBottom: 5 },
  locationText: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  infoLabel: { fontSize: 14, color: '#7f8c8d' },
  infoValue: { fontSize: 14, color: '#2c3e50', fontWeight: '600' },
  anprBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e3f2fd', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, marginTop: 15, alignSelf: 'center' },
  anprBadgeText: { fontSize: 12, color: '#3498db', fontWeight: '600', marginLeft: 6 },
  timerCard: { backgroundColor: '#3498db', borderRadius: 15, padding: 20, marginBottom: 15 },
  timerLabel: { fontSize: 14, color: '#fff', textAlign: 'center', marginBottom: 15, opacity: 0.9 },
  timerDisplay: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  timerUnit: { alignItems: 'center' },
  timerNumber: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  timerText: { fontSize: 10, color: '#fff', opacity: 0.8, marginTop: 4 },
  timerColon: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginHorizontal: 10 },
  chargesCard: { backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15 },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  chargeLabel: { fontSize: 14, color: '#7f8c8d' },
  chargeValue: { fontSize: 14, color: '#2c3e50', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f5f6fa', marginVertical: 10 },
  totalLabel: { fontSize: 16, color: '#2c3e50', fontWeight: 'bold' },
  totalValue: { fontSize: 18, color: '#3498db', fontWeight: 'bold' },
  walletCard: { backgroundColor: '#ecf0f1', borderRadius: 15, padding: 20, alignItems: 'center', marginBottom: 15 },
  walletLabel: { fontSize: 14, color: '#7f8c8d', marginBottom: 5 },
  walletBalance: { fontSize: 24, fontWeight: 'bold', color: '#3498db' },
  walletBalanceLow: { color: '#e74c3c' },
  warningBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fadbd8', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 15, marginTop: 10 },
  warningText: { fontSize: 12, color: '#e74c3c', fontWeight: '600', marginLeft: 6 },
  sessionInfo: { backgroundColor: '#fff', borderRadius: 15, padding: 15, alignItems: 'center' },
  sessionInfoText: { fontSize: 12, color: '#7f8c8d', textAlign: 'center', marginBottom: 8, lineHeight: 18 },
});