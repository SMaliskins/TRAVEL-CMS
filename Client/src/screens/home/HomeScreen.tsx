import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { bookingsApi, Booking } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, calcDaysNights, calcDaysUntil } from '../../utils/dateFormat'
import type { HomeStackParamList } from '../../navigation/MainStack'

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>()
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [profile, setProfile] = useState<{ displayName: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const logout = useAuthStore((s) => s.logout)

  const loadData = useCallback(async () => {
    try {
      const [trips, prof] = await Promise.all([
        bookingsApi.getUpcoming(),
        bookingsApi.getProfile(),
      ])
      setUpcoming(trips)
      setProfile(prof)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          Hi, {profile?.displayName ?? 'traveler'}
        </Text>
        <Text style={styles.greetingSub}>MyTravelConcierge</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {upcoming.length > 0 ? `Upcoming trips (${upcoming.length})` : 'Upcoming trips'}
        </Text>
        {upcoming.length > 0 ? (
          upcoming.map((trip) => {
            const td = parseDestination(trip.countries_cities)
            const dn = calcDaysNights(trip.date_from, trip.date_to)
            const du = calcDaysUntil(trip.date_from)
            return (
              <TouchableOpacity
                key={trip.id}
                style={styles.tripCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('TripDetailFromHome', { bookingId: trip.id })}
              >
                <Text style={styles.tripDestination}>{td?.label ?? '—'}</Text>
                {td?.route ? <Text style={styles.tripRoute}>{td.route}</Text> : null}
                <Text style={styles.tripDates}>
                  {formatDateRange(trip.date_from, trip.date_to)}
                  {dn ? `  (${dn})` : ''}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{trip.status}</Text>
                  </View>
                  {du != null && du > 0 && (
                    <Text style={styles.daysUntil}>{du} days before trip</Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No upcoming trips</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: {
    backgroundColor: '#1a3a5c',
    padding: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  greetingText: { fontSize: 24, fontWeight: '300', color: '#fff', letterSpacing: 0.5 },
  greetingSub: {
    fontSize: 11,
    color: '#c9a96e',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
  },
  section: { margin: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#1a3a5c',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a96e',
  },
  tripDestination: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.3 },
  tripRoute: { fontSize: 12, color: '#8a8a9a', marginTop: 3 },
  tripDates: { fontSize: 13, color: '#5a5a6a', marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  statusBadge: { backgroundColor: '#e8edf2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600', color: '#1a3a5c', letterSpacing: 0.3 },
  daysUntil: { fontSize: 11, color: '#8a8a9a', fontWeight: '500' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyText: { color: '#a0aab4', fontSize: 14, fontWeight: '300', letterSpacing: 0.5 },
})
