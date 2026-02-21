import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { AuthStackParamList } from '../../navigation/AuthStack'
import * as SecureStore from 'expo-secure-store'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>

export function RegisterScreen({ route }: Props) {
  const invitationToken = route.params?.invitationToken ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  const handleRegister = async () => {
    if (!invitationToken) {
      Alert.alert('Error', 'Invalid invitation. Request a new link from your agent.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data } = await apiClient.post<{
        data: { accessToken: string; refreshToken: string; clientId: string }
        error: null
      }>('/auth/register', { invitationToken, password })

      const { accessToken, refreshToken, clientId } = data.data
      await SecureStore.setItemAsync('accessToken', accessToken)
      await SecureStore.setItemAsync('refreshToken', refreshToken)
      await SecureStore.setItemAsync('clientId', clientId)

      // Trigger auth state update — RootNavigator will redirect to MainStack
      await checkAuth()
    } catch {
      Alert.alert('Error', 'Registration failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>✈ MyTravelConcierge</Text>
          <Text style={styles.subtitle}>Create a password for your account</Text>
        </View>

        {!invitationToken && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Invalid invitation link. Please request a new one from your agent.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat password"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity
            style={[styles.button, (loading || !invitationToken) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading || !invitationToken}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c' },
  inner: { flexGrow: 1, padding: 28, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 24, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  subtitle: {
    fontSize: 12,
    color: '#c9a96e',
    marginTop: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(254,243,242,0.95)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { color: '#dc2626', fontSize: 14, lineHeight: 20 },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8a8a9a',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#e8edf2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1a1a2e',
  },
  button: {
    backgroundColor: '#c9a96e',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#c9a96e',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { backgroundColor: '#d0d8e0', shadowOpacity: 0 },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
