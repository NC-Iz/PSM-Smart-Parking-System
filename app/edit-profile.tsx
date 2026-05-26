import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../src/config/firebaseConfig';
import { useAuth } from '../src/contexts/AuthContext';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName]       = useState(user?.fullName ?? '');
  const [phone, setPhone]             = useState(user?.phone ?? '');
  const [licensePlate, setLicensePlate] = useState(user?.licensePlate ?? '');
  const [saving, setSaving]           = useState(false);

  const handleSave = async () => {
    if (!user) return;

    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }
    if (!licensePlate.trim()) {
      Alert.alert('Required', 'Licence plate cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName:     fullName.trim(),
        phone:        phone.trim(),
        licensePlate: licensePlate.trim().toUpperCase().replace(/\s/g, ''),
      });
      await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#fff" />
          </View>

          {/* Fields */}
          <View style={styles.card}>
            <Field
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
            />
            <Field
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 0123456789"
              keyboardType="phone-pad"
            />
            <Field
              label="Licence Plate"
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="e.g. ABC1234"
              autoCapitalize="characters"
              note="This must match your registered vehicle exactly — the ANPR system uses this to detect your car."
              last
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveButtonText}>Save Changes</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, note, last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  note?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldWrapper, !last && styles.fieldBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#bdc3c7"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
      {note && <Text style={styles.fieldNote}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f6fa' },
  header: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle:    { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollContainer: { flex: 1 },
  content:        { padding: 20 },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  fieldWrapper:   { paddingVertical: 16 },
  fieldBorder:    { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fieldLabel:     { fontSize: 12, color: '#7f8c8d', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput:     { fontSize: 16, color: '#2c3e50' },
  fieldNote:      { fontSize: 12, color: '#f39c12', marginTop: 6, lineHeight: 17 },
  saveButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
