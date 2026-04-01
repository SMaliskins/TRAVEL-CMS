import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { bookingsApi } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = SCREEN_W - 40
const CARD_H = CARD_W * 0.58

type Profile = Awaited<ReturnType<typeof bookingsApi.getProfile>>

function formatCardNumber(code: string): string {
  const digits = code.replace(/\D/g, '').padEnd(12, '0').slice(0, 12)
  return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8, 12)}`
}

function LoyaltyCard({ profile }: { profile: Profile }) {
  const name = (profile.displayName ?? 'Guest').toUpperCase()
  const cardNum = formatCardNumber(profile.referralCode ?? profile.id ?? '000000000000')

  return (
    <View style={cardStyles.wrapper}>
      <View style={cardStyles.card}>
        <View style={cardStyles.cardOverlay} />
        <View style={cardStyles.cardShine} />

        <View style={cardStyles.topRow}>
          <Text style={cardStyles.brandName}>MyTravelConcierge</Text>
          <View style={cardStyles.chipIcon}>
            <View style={cardStyles.chipLine} />
            <View style={cardStyles.chipLine} />
            <View style={cardStyles.chipLine} />
          </View>
        </View>

        <View style={cardStyles.balanceSection}>
          <Text style={cardStyles.balanceLabel}>Balance</Text>
          <Text style={cardStyles.balanceAmount}>0 Points</Text>
          <Text style={cardStyles.balanceSub}>0.00 USD</Text>
        </View>

        <View style={cardStyles.bottomRow}>
          <View style={cardStyles.nameBlock}>
            <Text style={cardStyles.cardName}>{name}</Text>
            <Text style={cardStyles.cardNumber}>{cardNum}</Text>
          </View>
          <View style={cardStyles.statusBadge}>
            <Text style={cardStyles.statusText}>Silver</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress?: () => void
}

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={menuStyles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={menuStyles.iconCircle}>
        <Feather name={icon} size={20} color="#4a6d8c" />
      </View>
      <Text style={menuStyles.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  )
}

export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const logout = useAuthStore((s) => s.logout)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    bookingsApi.getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  const comingSoon = () => Alert.alert('Coming Soon', 'This feature is under development.')

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a3a5c" /></View>
  }

  const initials = (profile?.displayName ?? 'U').charAt(0).toUpperCase()

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.userName}>{profile?.displayName ?? 'Guest'}</Text>
          {profile?.email && <Text style={styles.userEmail}>{profile.email}</Text>}
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      {profile && <LoyaltyCard profile={profile} />}

      <View style={menuStyles.grid}>
        <MenuItem icon="phone" label="Contact Details" onPress={comingSoon} />
        <MenuItem icon="briefcase" label="Bookings" onPress={comingSoon} />
        <MenuItem icon="award" label="Membership" onPress={comingSoon} />
        <MenuItem icon="lock" label="Change Password" onPress={comingSoon} />
        <MenuItem icon="file-text" label="Terms and Conditions" onPress={comingSoon} />
        <MenuItem icon="info" label="About" onPress={comingSoon} />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  userEmail: {
    fontSize: 13,
    color: '#8a8a9a',
    marginTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8edf2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d0d8e0',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4a6d8c',
  },
  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#1a3a5c',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
})

const cardStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: '#1a3a5c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2a5f8f',
    opacity: 0.4,
    borderRadius: 16,
  },
  cardShine: {
    position: 'absolute',
    top: -CARD_H * 0.3,
    right: -CARD_W * 0.15,
    width: CARD_W * 0.7,
    height: CARD_H * 0.9,
    borderRadius: CARD_W * 0.35,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-30deg' }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
    fontStyle: 'italic',
  },
  chipIcon: {
    width: 36,
    height: 26,
    borderRadius: 4,
    backgroundColor: 'rgba(212,175,55,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  chipLine: {
    height: 1.5,
    backgroundColor: 'rgba(180,140,30,0.6)',
    borderRadius: 1,
  },
  balanceSection: {
    marginTop: 4,
  },
  balanceLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: '300',
    color: '#fff',
    marginTop: 2,
  },
  balanceSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  nameBlock: {
    flex: 1,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1.5,
  },
  cardNumber: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(192,192,192,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(192,192,192,0.4)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d4d4d4',
    letterSpacing: 0.5,
  },
})

const menuStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  item: {
    width: (SCREEN_W - 28 - 12) / 2,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2a2a3e',
    lineHeight: 18,
  },
})
