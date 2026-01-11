// File: app/receipt.tsx
// CREATE this NEW file in app/ folder (not in tabs)

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ReceiptScreen() {
  const params = useLocalSearchParams();
  const sessionId = params.sessionId || '1';

  // Mock receipt data (in real app, fetch from Firestore using sessionId)
  const receipt = {
    receiptNumber: '#PKG2025112201',
    dateTime: '22 Nov 2025, 11:50AM',
    location: 'UTHM FKEE',
    parkingSpot: 'A2',
    licensePlate: 'ABC 1234',
    entryTime: '10:15 AM',
    exitTime: '12:45 PM',
    duration: '2h 30m',
    hourlyRate: 2.00,
    totalAmount: 4.20,
    paymentMethod: 'Digital Wallet',
    transactionId: 'TXN987654321',
    paymentStatus: 'Paid',
  };

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
            {/* Logo & Title */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Ionicons name="car" size={48} color="#3498db" />
              </View>
              <Text style={styles.brandName}>Smart Parking</Text>
              <Text style={styles.brandSubtitle}>Digital Receipt</Text>
              <View style={styles.successBadge}>
                <Text style={styles.successText}>Payment Successful</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Receipt Details */}
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Receipt Number</Text>
                <Text style={styles.detailValue}>{receipt.receiptNumber}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>{receipt.dateTime}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{receipt.location}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Parking Spot</Text>
                <Text style={styles.detailValue}>{receipt.parkingSpot}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Licence Plate</Text>
                <Text style={styles.detailValue}>{receipt.licensePlate}</Text>
              </View>
            </View>

            {/* Parking Duration Box */}
            <View style={styles.durationBox}>
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Entry Time</Text>
                <Text style={styles.durationValue}>{receipt.entryTime}</Text>
              </View>
              
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Exit Time</Text>
                <Text style={styles.durationValue}>{receipt.exitTime}</Text>
              </View>
              
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Total Duration</Text>
                <Text style={styles.durationValue}>{receipt.duration}</Text>
              </View>
              
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Hourly Rate</Text>
                <Text style={styles.durationValue}>RM {receipt.hourlyRate.toFixed(2)}</Text>
              </View>
            </View>

            {/* Total Amount */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>RM {receipt.totalAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            {/* Payment Details */}
            <View style={styles.paymentSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>{receipt.paymentMethod}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={styles.detailValue}>{receipt.transactionId}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment Status</Text>
                <Text style={[styles.detailValue, styles.statusPaid]}>
                  {receipt.paymentStatus}
                </Text>
              </View>
            </View>

            {/* Footer Message */}
            <View style={styles.footerMessage}>
              <Text style={styles.thankYouText}>Thank you for using Smart Parking!</Text>
              <Text style={styles.transactionText}>
                Transaction ID: {receipt.transactionId}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.shareButton}>
              <Ionicons name="share-outline" size={20} color="#3498db" />
              <Text style={styles.shareButtonText}>Share Receipt</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.downloadButton}>
              <Ionicons name="download-outline" size={20} color="#3498db" />
              <Text style={styles.downloadButtonText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
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
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  successBadge: {
    backgroundColor: '#d5f4e6',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 15,
  },
  successText: {
    fontSize: 12,
    color: '#27ae60',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e1e8ed',
    marginVertical: 20,
  },
  detailsSection: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  detailValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'right',
  },
  durationBox: {
    backgroundColor: '#f5f6fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  durationLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  durationValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  paymentSection: {
    marginBottom: 20,
  },
  statusPaid: {
    color: '#27ae60',
  },
  footerMessage: {
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  thankYouText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  shareButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  downloadButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});