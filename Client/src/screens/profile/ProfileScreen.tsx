import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { bookingsApi } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'
import { formatDate } from '../../utils/dateFormat'

export function ProfileScreen() {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof bookingsApi.getProfile>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    bookingsApi.getProfile()
      .then((p) => {
        setProfile(p)
        setEditName(p.displayName ?? '')
        setEditPhone(p.phone ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))

  }, [])

  const handleEdit = () => {
    setEditing(true)
    setEditName(profile?.displayName ?? '')
    setEditPhone(profile?.phone ?? '')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { apiClient } = await import('../../api/client')
      await apiClient.patch('/profile', {
        displayName: editName.trim(),
        phone: editPhone.trim(),
      })
      setProfile((p) => p ? { ...p, displayName: editName.trim(), phone: editPhone.trim() } : p)
      setEditing(false)
    } catch {
      Alert.alert('Error', 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    )
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.displayName ?? 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        {editing ? (
          <TextInput
            style={styles.editNameInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Your name"
            placeholderTextColor="rgba(255,255,255,0.5)"
          />
        ) : (
          <Text style={styles.name}>{profile?.displayName ?? 'User'}</Text>
        )}
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
        {profile?.createdAt && (
          <Text style={styles.memberSince}>Member since {formatDate(profile.createdAt)}</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          {!editing ? (
            <TouchableOpacity onPress={handleEdit}>
              <Feather name="edit-2" size={16} color="#1a73e8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={styles.saveButton}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Phone</Text>
              <TextInput
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Phone number"
                placeholderTextColor="#ccc"
                keyboardType="phone-pad"
              />
            </View>
          </>
        ) : (
          <>
            {profile?.phone && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Phone</Text>
                <Text style={styles.rowValue}>{profile.phone}</Text>
              </View>
            )}
            {profile?.referralCode && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Referral Code</Text>
                <Text style={styles.rowValue}>{profile.referralCode}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {editing && (
        <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a73e8', padding: 32, paddingTop: 24, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  memberSince: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  editNameInput: { fontSize: 20, fontWeight: '700', color: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)', paddingBottom: 4, textAlign: 'center', minWidth: 150 },

  section: { backgroundColor: '#fff', margin: 16, marginBottom: 0, borderRadius: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  saveButton: { fontSize: 14, fontWeight: '700', color: '#1a73e8' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowLabel: { fontSize: 14, color: '#888' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#333' },

  editInput: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'right', flex: 1, marginLeft: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 2 },

  cancelButton: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  logoutButton: { margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
})
