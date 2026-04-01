// File: app/(tabs)/wallet.tsx
// REPLACE your existing wallet.tsx with this

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  getUserTransactions,
  Transaction,
} from "../../src/services/walletService";

// ─── CONFIG ───────────────────────────────────────────────
// Replace with your actual Flask server URL
// During development: use ngrok (e.g. https://abc123.ngrok.io)
// On same WiFi: use your laptop IP (e.g. http://192.168.1.x:5000)
const CLOUD_FUNCTIONS_URL =
  "https://us-central1-smartparkingsystem-dd7ce.cloudfunctions.net";
// ──────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { user, refreshUser } = useAuth();

  // Top up state
  const [selectedAmount, setSelectedAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("fpx");
  const [isProcessing, setIsProcessing] = useState(false);

  // Transaction history state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const presetAmounts = [10, 20, 50, 100];

  // ─── Load real transactions from Firestore ───────────────
  const loadTransactions = async () => {
    if (!user) return;
    try {
      const txns = await getUserTransactions(user.uid);
      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    await refreshUser(); // Refresh wallet balance too
    setRefreshing(false);
  };

  // ─── Handle amount selection ─────────────────────────────
  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const getFinalAmount = (): number => {
    if (customAmount) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedAmount;
  };

  // ─── Handle Top Up ───────────────────────────────────────
  const handleTopUp = async () => {
    if (!user) return;

    const amount = getFinalAmount();

    if (amount < 1) {
      Alert.alert("Invalid Amount", "Minimum top up is RM 1.00");
      return;
    }

    if (amount > 500) {
      Alert.alert(
        "Invalid Amount",
        "Maximum top up is RM 500.00 per transaction",
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Call Cloud Function to create Toyyibpay bill
      const response = await fetch(
        "https://us-central1-smartparkingsystem-dd7ce.cloudfunctions.net/createBill",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            amount: amount,
            userEmail: user.email,
            userName: user.fullName,
            userPhone: user.phone,
            paymentMethod: selectedPayment,
          }),
        },
      );

      const billData = await response.json();

      if (!billData.success) {
        throw new Error(billData.error || "Failed to create payment bill");
      }

      // Open Toyyibpay payment page in browser
      const canOpen = await Linking.canOpenURL(billData.paymentUrl);
      if (canOpen) {
        await Linking.openURL(billData.paymentUrl);
        Alert.alert(
          "Payment Page Opened",
          `Complete your RM ${amount.toFixed(2)} payment in the browser.\n\nYour wallet updates automatically after payment.`,
          [
            {
              text: "OK",
              onPress: async () => {
                await refreshUser();
                await loadTransactions();
              },
            },
          ],
        );
      } else {
        throw new Error("Cannot open payment URL");
      }
    } catch (error: any) {
      Alert.alert(
        "Top Up Failed",
        error.message || "Something went wrong. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Format transaction date ──────────────────────────────
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    try {
      // Firestore timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // ─── Payment method label ─────────────────────────────────
  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "fpx":
        return {
          icon: "business",
          title: "Online Banking (FPX)",
          subtitle: "Maybank, CIMB, RHB & more",
        };
      case "tng":
        return {
          icon: "phone-portrait",
          title: "Touch n Go eWallet",
          subtitle: "Instant Transfer",
        };
      case "card":
        return {
          icon: "card",
          title: "Credit/Debit Card",
          subtitle: "Visa, Mastercard",
        };
      default:
        return { icon: "card", title: method, subtitle: "" };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            RM {user?.walletBalance.toFixed(2) ?? "0.00"}
          </Text>
          <Text style={styles.balanceSubtext}>
            Auto-deducted on parking exit
          </Text>
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
                  selectedAmount === amount &&
                    !customAmount &&
                    styles.amountButtonActive,
                ]}
                onPress={() => handleAmountSelect(amount)}
              >
                <Text
                  style={[
                    styles.amountText,
                    selectedAmount === amount &&
                      !customAmount &&
                      styles.amountTextActive,
                  ]}
                >
                  RM {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Amount */}
          <View
            style={[
              styles.customAmountContainer,
              customAmount ? styles.customAmountActive : null,
            ]}
          >
            <Text style={styles.rmPrefix}>RM</Text>
            <TextInput
              style={styles.customAmountInput}
              placeholder="Enter custom amount"
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

          {(["fpx", "tng", "card"] as const).map((method) => {
            const info = getPaymentMethodLabel(method);
            return (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentOption,
                  selectedPayment === method && styles.paymentOptionActive,
                ]}
                onPress={() => setSelectedPayment(method)}
              >
                <View style={styles.paymentInfo}>
                  <Ionicons
                    name={info.icon as any}
                    size={24}
                    color={selectedPayment === method ? "#3498db" : "#7f8c8d"}
                  />
                  <View style={styles.paymentText}>
                    <Text style={styles.paymentTitle}>{info.title}</Text>
                    <Text style={styles.paymentSubtitle}>{info.subtitle}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radio,
                    selectedPayment === method && styles.radioActive,
                  ]}
                >
                  {selectedPayment === method && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Top Up Button */}
          <TouchableOpacity
            style={[
              styles.topUpButton,
              isProcessing && styles.topUpButtonDisabled,
            ]}
            onPress={handleTopUp}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.topUpButtonText}>
                Top Up RM {getFinalAmount().toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.poweredBy}>
            Powered by Toyyibpay • Secured by FPX / TNG
          </Text>
        </View>

        {/* Transaction History */}
        <View style={styles.transactionsCard}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          {loadingTransactions ? (
            <ActivityIndicator color="#3498db" style={{ marginVertical: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Ionicons name="receipt-outline" size={40} color="#bdc3c7" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((txn) => (
              <View key={txn.transactionId} style={styles.transactionItem}>
                <View
                  style={[
                    styles.txnIconContainer,
                    txn.type === "topup"
                      ? styles.txnIconTopup
                      : styles.txnIconPayment,
                  ]}
                >
                  <Ionicons
                    name={txn.type === "topup" ? "arrow-down" : "arrow-up"}
                    size={18}
                    color={txn.type === "topup" ? "#27ae60" : "#e74c3c"}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>{txn.description}</Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(txn.timestamp)}
                  </Text>
                  {txn.metadata?.paymentMethod && (
                    <Text style={styles.transactionMethod}>
                      via {txn.metadata.paymentMethod}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    txn.type === "topup"
                      ? styles.amountPositive
                      : styles.amountNegative,
                  ]}
                >
                  {txn.type === "topup" ? "+" : ""}RM{" "}
                  {Math.abs(txn.amount).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { backgroundColor: "#3498db", padding: 20, paddingTop: 50 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scrollContainer: { flex: 1 },

  // Balance card
  balanceCard: {
    backgroundColor: "#3498db",
    margin: 20,
    marginBottom: 15,
    padding: 25,
    borderRadius: 15,
    alignItems: "center",
  },
  balanceLabel: { fontSize: 14, color: "#fff", opacity: 0.9, marginBottom: 8 },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  balanceSubtext: { fontSize: 12, color: "#fff", opacity: 0.7 },

  // Top up card
  topUpCard: {
    backgroundColor: "#fff",
    margin: 20,
    marginTop: 0,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 12,
    marginTop: 8,
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  amountButton: {
    width: "48%",
    backgroundColor: "#f5f6fa",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e8ed",
  },
  amountButtonActive: { backgroundColor: "#3498db", borderColor: "#3498db" },
  amountText: { fontSize: 16, fontWeight: "600", color: "#2c3e50" },
  amountTextActive: { color: "#fff" },
  customAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e8ed",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 8,
    height: 52,
  },
  customAmountActive: { borderColor: "#3498db", backgroundColor: "#f0f8ff" },
  rmPrefix: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "600",
    marginRight: 8,
  },
  customAmountInput: { flex: 1, fontSize: 16, color: "#2c3e50" },

  // Payment options
  paymentOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderWidth: 1,
    borderColor: "#e1e8ed",
    borderRadius: 10,
    marginBottom: 10,
  },
  paymentOptionActive: { borderColor: "#3498db", backgroundColor: "#f0f8ff" },
  paymentInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  paymentText: { marginLeft: 15 },
  paymentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  paymentSubtitle: { fontSize: 12, color: "#7f8c8d" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e1e8ed",
    justifyContent: "center",
    alignItems: "center",
  },
  radioActive: { borderColor: "#3498db" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3498db",
  },

  // Top up button
  topUpButton: {
    backgroundColor: "#3498db",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  topUpButtonDisabled: { opacity: 0.6 },
  topUpButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  poweredBy: {
    textAlign: "center",
    fontSize: 11,
    color: "#bdc3c7",
    marginTop: 10,
  },

  // Transactions
  transactionsCard: {
    backgroundColor: "#fff",
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  emptyTransactions: { alignItems: "center", paddingVertical: 30 },
  emptyText: { color: "#bdc3c7", marginTop: 10, fontSize: 14 },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f6fa",
  },
  txnIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txnIconTopup: { backgroundColor: "#d5f4e6" },
  txnIconPayment: { backgroundColor: "#fde8e8" },
  transactionInfo: { flex: 1 },
  transactionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  transactionDate: { fontSize: 12, color: "#7f8c8d" },
  transactionMethod: { fontSize: 11, color: "#bdc3c7", marginTop: 2 },
  transactionAmount: { fontSize: 15, fontWeight: "bold" },
  amountPositive: { color: "#27ae60" },
  amountNegative: { color: "#e74c3c" },
});
