import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';

export default function WelcomeScreen() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (user) return null;

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Smart Parking</Text>
      <Text style={styles.subtitle}>Find and manage parking easily</Text>

      <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/auth/login')}>
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.registerButton} onPress={() => router.replace('/auth/register')}>
        <Text style={styles.registerButtonText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    borderWidth: 2,
    borderColor: '#3498db',
    paddingHorizontal: 60,
    paddingVertical: 15,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
  },
});
