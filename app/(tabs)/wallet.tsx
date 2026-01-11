// File: app/(tabs)/wallet.tsx
// CREATE this NEW file in app/(tabs)/ folder

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';

interface Transaction {
  id: string;
  type: 'topup' | 'payment';
  amount: number;
  date: string;
  time: string;
  description: string;
}

export default function WalletScreen() {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('card');

  // Mock transaction data
  const transactions: Transaction[] = [
    { id: '1', type: 'topup', amount: 20.00, date: '20 Nov 2025', time: '10:30 AM', description: 'Wallet Top Up' },
    { id: '2', type: 'payment', amount: -5.00, date: '19 Nov 2025', time: '03:45 PM', description: 'Parking Payment' },
    { id: '3', type: 'payment', amount: -10.00, date: '18 Nov 2025', time: '09:15 AM', description: 'Parking Payment' },
    { id: '4', type: 'topup', amount: 15.00, date: '15 Nov 2025', time: '02:20 PM', description: 'Wallet Top Up' },
  ];

  const presetAmounts = [10, 20, 50, 100];

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleTopUp = () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    console.log(`Top up RM ${amount} via ${selectedPayment}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView style={styles.scrollContainer}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>RM {user?.walletBalance.toFixed(2)}</Text>
        </View>

        {/* Top Up Section */}
        <View style={styles.topUpCard}>
          <Text style={styles.sectionTitle}>Top Up Amount</Text>
          
          {/* Preset Amounts */}
          <View style={styles.amountGrid}>
            {presetAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.amountButton,
                  selectedAmount === amount && !customAmount && styles.amountButtonActive
                ]}
                onPress={() => handleAmountSelect(amount)}
              >
                <Text style={[
                  styles.amountText,
                  selectedAmount === amount && !customAmount && styles.amountTextActive
                ]}>
                  RM {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Amount */}
          <View style={[styles.customAmountButton, customAmount && styles.customAmountButtonActive]}>
            <TextInput
              style={styles.customAmountInput}
              placeholder="Custom Amount"
              placeholderTextColor="#7f8c8d"
              keyboardType="numeric"
              value={customAmount}
              onChangeText={(text) => {
                setCustomAmount(text);
                setSelectedAmount(0);
              }}
            />
          </View>

          {/* Payment Method */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <TouchableOpacity 
            style={[styles.paymentOption, selectedPayment === 'card' && styles.paymentOptionActive]}
            onPress={() => setSelectedPayment('card')}
          >
            <View style={styles.paymentInfo}>
              <Ionicons name="card" size={24} color={selectedPayment === 'card' ? '#3498db' : '#7f8c8d'} />
              <View style={styles.paymentText}>
                <Text style={styles.paymentTitle}>Credit/Debit Card</Text>
                <Text style={styles.paymentSubtitle}>Visa, Mastercard</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedPayment === 'card' && styles.radioActive]}>
              {selectedPayment === 'card' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.paymentOption, selectedPayment === 'banking' && styles.paymentOptionActive]}
            onPress={() => setSelectedPayment('banking')}
          >
            <View style={styles.paymentInfo}>
              <Ionicons name="business" size={24} color={selectedPayment === 'banking' ? '#3498db' : '#7f8c8d'} />
              <View style={styles.paymentText}>
                <Text style={styles.paymentTitle}>Online Banking</Text>
                <Text style={styles.paymentSubtitle}>FPX</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedPayment === 'banking' && styles.radioActive]}>
              {selectedPayment === 'banking' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.paymentOption, selectedPayment === 'ewallet' && styles.paymentOptionActive]}
            onPress={() => setSelectedPayment('ewallet')}
          >
            <View style={styles.paymentInfo}>
              <Ionicons name="phone-portrait" size={24} color={selectedPayment === 'ewallet' ? '#3498db' : '#7f8c8d'} />
              <View style={styles.paymentText}>
                <Text style={styles.paymentTitle}>Touch n Go eWallet</Text>
                <Text style={styles.paymentSubtitle}>Instant Transfer</Text>
              </View>
            </View>
            <View style={[styles.radio, selectedPayment === 'ewallet' && styles.radioActive]}>
              {selectedPayment === 'ewallet' && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>

          {/* Top Up Button */}
          <TouchableOpacity style={styles.topUpButton} onPress={handleTopUp}>
            <Text style={styles.topUpButtonText}>
              Top Up RM {(customAmount ? parseFloat(customAmount) || 0 : selectedAmount).toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>{transaction.description}</Text>
                <Text style={styles.transactionDate}>{transaction.date}, {transaction.time}</Text>
              </View>
              <Text style={[
                styles.transactionAmount,
                transaction.type === 'topup' ? styles.amountPositive : styles.amountNegative
              ]}>
                {transaction.type === 'topup' ? '+' : ''}RM {Math.abs(transaction.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f6fa' 
},
  header: { backgroundColor: '#3498db', padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollContainer: { flex: 1 },
  balanceCard: { backgroundColor: '#3498db', margin: 20, marginBottom: 15, padding: 25, borderRadius: 15, alignItems: 'center' },
  balanceLabel: { fontSize: 14, color: '#fff', opacity: 0.9, marginBottom: 8 },
  balanceAmount: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  topUpCard: { backgroundColor: '#fff', margin: 20, marginTop: 0, marginBottom: 15, padding: 20, borderRadius: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15, marginTop: 10 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  amountButton: { width: '48%', backgroundColor: '#f5f6fa', padding: 15, borderRadius: 10, alignItems: 'center' },
  amountButtonActive: { backgroundColor: '#3498db' },
  amountText: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
  amountTextActive: { color: '#fff' },
  customAmountButton: { borderWidth: 1, borderColor: '#e1e8ed', borderRadius: 10, padding: 15, marginBottom: 10 },
  customAmountButtonActive: { borderColor: '#3498db', backgroundColor: '#f0f8ff' },
  customAmountInput: { fontSize: 16, color: '#2c3e50', textAlign: 'center' },
  paymentOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#e1e8ed', borderRadius: 10, marginBottom: 10 },
  paymentOptionActive: { borderColor: '#3498db', backgroundColor: '#f0f8ff' },
  paymentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  paymentText: { marginLeft: 15 },
  paymentTitle: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 2 },
  paymentSubtitle: { fontSize: 12, color: '#7f8c8d' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#e1e8ed', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#3498db' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3498db' },
  topUpButton: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  topUpButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  transactionsCard: { backgroundColor: '#fff', margin: 20, marginTop: 0, padding: 20, borderRadius: 15 },
  transactionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  viewAllText: { fontSize: 14, color: '#3498db', fontWeight: '600' },
  transactionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f5f6fa' },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 4 },
  transactionDate: { fontSize: 12, color: '#7f8c8d' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold' },
  amountPositive: { color: '#27ae60' },
  amountNegative: { color: '#e74c3c' },
});