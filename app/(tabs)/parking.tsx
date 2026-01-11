// File: app/(tabs)/parking.tsx
// CREATE this file (rename parking-map.tsx to this)

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';

export default function ActiveParkingScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  
  // Session data
  const [spotNumber, setSpotNumber] = useState('A2');
  const [location, setLocation] = useState('UTHM FKEE Parking');
  const [licensePlate, setLicensePlate] = useState('ABC 1234');
  const [entryTime, setEntryTime] = useState('10:15 AM');
  const [sessionDate, setSessionDate] = useState('Today, 22 Nov 2025');
  
  // Timer state (hours:minutes:seconds)
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(35);
  const [seconds, setSeconds] = useState(55);
  
  // Charges
  const [ratePerHour, setRatePerHour] = useState(2.00);
  const [currentCharge, setCurrentCharge] = useState(5.00);
  const [duration, setDuration] = useState('2.5 Hours');

  useEffect(() => {
    // Check if user has active parking session
    // TODO: Replace with real Firestore query
    const checkActiveSession = async () => {
      // Mock: User has active session
      setHasActiveSession(true);
      setLoading(false);
    };

    checkActiveSession();
  }, []);

  // Live timer
  useEffect(() => {
    if (!hasActiveSession) return;

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev === 59) {
          setMinutes(m => {
            if (m === 59) {
              setHours(h => h + 1);
              return 0;
            }
            return m + 1;
          });
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasActiveSession]);

  // Calculate current charge based on duration
  useEffect(() => {
    const totalMinutes = hours * 60 + minutes;
    const totalHours = totalMinutes / 60;
    const charge = totalHours * ratePerHour;
    setCurrentCharge(parseFloat(charge.toFixed(2)));
    setDuration(`${totalHours.toFixed(1)} Hours`);
  }, [hours, minutes, ratePerHour]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  // No active session
  if (!hasActiveSession) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parking</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={80} color="#bdc3c7" />
          <Text style={styles.emptyTitle}>No Active Parking</Text>
          <Text style={styles.emptyText}>
            You don't have any active parking session
          </Text>
          <TouchableOpacity 
            style={styles.findParkingButton}
            onPress={() => router.push('/(tabs)/dashboard')}
          >
            <Text style={styles.findParkingText}>Find Parking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Active session view
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Parking</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* Spot Info Card */}
        <View style={styles.spotCard}>
          <Text style={styles.spotNumber}>{spotNumber}</Text>
          <Text style={styles.locationText}>{location}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>License Plate</Text>
            <Text style={styles.infoValue}>{licensePlate}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Entry Time</Text>
            <Text style={styles.infoValue}>{entryTime}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Session Started</Text>
            <Text style={styles.infoValue}>{sessionDate}</Text>
          </View>
        </View>

        {/* Timer Card */}
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

        {/* Charges Card */}
        <View style={styles.chargesCard}>
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Rate per Hour</Text>
            <Text style={styles.chargeValue}>RM {ratePerHour.toFixed(2)}</Text>
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

        {/* Wallet Balance Card */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletBalance}>RM {user?.walletBalance.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
  },
  findParkingButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  findParkingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spotCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  spotNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3498db',
    textAlign: 'center',
    marginBottom: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f6fa',
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  infoValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  timerCard: {
    backgroundColor: '#3498db',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  timerLabel: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
    opacity: 0.9,
  },
  timerDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerUnit: {
    alignItems: 'center',
  },
  timerNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  timerText: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.8,
    marginTop: 4,
  },
  timerColon: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 10,
  },
  chargesCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  chargeLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  chargeValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f5f6fa',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    color: '#3498db',
    fontWeight: 'bold',
  },
  walletCard: {
    backgroundColor: '#ecf0f1',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  walletLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  walletBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
});