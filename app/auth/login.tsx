// File: app/auth/login.tsx
// Replace your entire login.tsx with this code

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/contexts/AuthContext";

export default function LoginScreen() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user]);

  // Reset spinner if auth completes with no user (e.g. suspended account)
  useEffect(() => {
    if (!loading && !user) {
      setIsLoading(false);
    }
  }, [loading, user]);

  // Handle login
  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter your email or phone number");
      return;
    }

    if (!password) {
      Alert.alert("Required", "Please enter your password");
      return;
    }

    setIsLoading(true);

    try {
      // Only authenticate — AuthContext loads user data and triggers navigation
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
    } catch (error: any) {
      console.error("Login error:", error);

      let errorMessage = "Login failed. Please try again.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      }

      Alert.alert("Login Failed", errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Smart Parking</Text>
          <Text style={styles.subtitle}>Find. Park. Pay. Easy</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          {/* Email/Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email or Phone Number</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email or phone"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() =>
              Alert.alert(
                "Forgot Password",
                "Password reset feature coming soon!",
              )
            }
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>{"Don't have an account? "}</Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  formContainer: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: "#0EA5E9",
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: "#6B7280",
    fontSize: 15,
  },
  signupLink: {
    color: "#0EA5E9",
    fontSize: 15,
    fontWeight: "700",
  },
});
