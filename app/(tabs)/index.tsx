// File: app/(tabs)/index.tsx
// Replace your existing index.tsx with this code

import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';

export default function HomeScreen() {
  const { user, loading } = useAuth();

  // Auto-navigate based on auth state
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // User not logged in - stay on this welcome screen
        return;
      }
      // User is logged in - they can stay on this screen
      // In the future, this will show parking spots
    }
  }, [user, loading]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If user not logged in, show welcome screen
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>🚗</Text>
        <Text style={styles.title}>Smart Parking System</Text>
        <Text style={styles.subtitle}>Find and manage parking spots easily</Text>
        
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.registerButton}
          onPress={() => router.push('/auth/register')}
        >
          <Text style={styles.registerButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // User is logged in - show main dashboard
  return (
    <View style={styles.container}>
      <Text style={styles.welcomeTitle}>Welcome, {user.fullName}!</Text>
      <Text style={styles.userInfo}>Email: {user.email}</Text>
      <Text style={styles.userInfo}>License Plate: {user.licensePlate}</Text>
      <Text style={styles.userInfo}>User Type: {user.userType}</Text>
      <Text style={styles.userInfo}>Wallet Balance: RM {user.walletBalance.toFixed(2)}</Text>
      
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Parking spots will appear here
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 40,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 60,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '80%',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 60,
    paddingVertical: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  userInfo: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  placeholder: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e1e8ed',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
  },
});