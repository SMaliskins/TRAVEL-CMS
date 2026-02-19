import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity, AppState } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { bookingsApi, Booking } from '../../api/bookings'
import { notificationsApi } from '../../api/notifications'
import { useAuthStore } from '../../store/authStore'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, calcDaysNights, calcDaysUntil } from '../../utils/dateFormat'
import type { RootStackParamList } from '../../navigation/MainStack'

const POLL_INTERVAL = 30_000

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [profile, setProfile] = useState<{ displayName: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const logout = useAuthStore((s) => s.logout)

  const loadData = useCallback(async () => {
    try {
      const [trips, prof, notifs] = await Promise.all([
        bookingsApi.getUpcoming(),
        bookingsApi.getProfile(),
        notificationsApi.getAll().catch(() => ({ data: [], unreadCount: 0 })),
      ])
      setUpcoming(trips)
      setProfile(prof)
      setUnreadCount(notifs.unreadCount)
    } catch {
      // Token refresh handles auth; other errors silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Poll for new notifications every 30s
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useFocusEffect(
    useCallback(() => {
      const pollBadge = () => {
        notificationsApi.getAll()
          .then((res) => setUnreadCount(res.unreadCount))
          .catch(() => {})
      }
      pollBadge()
      intervalRef.current = setInterval(pollBadge, POLL_INTERVAL)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, [])
  )

  // Refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadData()
    })
    return () => sub.remove()
  }, [loadData])

  const insets = useSafeAreaInsets()
  const nextTrip = upcoming[0]
  const dest = nextTrip ? parseDestination(nextTrip.countries_cities) : null
  const daysNights = nextTrip ? calcDaysNights(nextTrip.date_from, nextTrip.date_to) : null
  const daysUntil = nextTrip ? calcDaysUntil(nextTrip.date_from) : null

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Hi, {profile?.displayName ?? 'traveler'}
            </Text>
            <Text style={styles.headerSub}>MyTravelConcierge</Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Trip</Text>
        {nextTrip && dest ? (
          <View style={styles.tripCard}>
            <Text style={styles.tripDestination}>{dest.label}</Text>
            {dest.route && (
              <Text style={styles.tripRoute}>{dest.route}</Text>
            )}
            <Text style={styles.tripDates}>
              {formatDateRange(nextTrip.date_from, nextTrip.date_to)}
              {daysNights ? `  (${daysNights})` : ''}
            </Text>
            <View style={styles.cardFooter}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{nextTrip.status}</Text>
              </View>
              {daysUntil != null && daysUntil > 0 && (
                <Text style={styles.daysUntil}>{daysUntil} days before trip</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No upcoming trips</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming trips</Text>
        <Text style={styles.statNumber}>{upcoming.length}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a73e8', padding: 24, paddingTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  bellBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ff3b30',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  section: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  tripCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  tripDestination: { fontSize: 20, fontWeight: '700', color: '#222' },
  tripRoute: { fontSize: 13, color: '#888', marginTop: 2 },
  tripDates: { fontSize: 14, color: '#666', marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusBadge: { backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1a73e8' },
  daysUntil: { fontSize: 12, color: '#888' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 15 },
  statNumber: { fontSize: 32, fontWeight: '700', color: '#1a73e8' },
})
