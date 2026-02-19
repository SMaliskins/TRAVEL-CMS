import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { bookingsApi, Booking } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, calcDaysNights, calcDaysUntil } from '../../utils/dateFormat'
import type { RootStackParamList } from '../../navigation/MainStack'

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
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
        <ActivityIndicator size="large" color="#1a73e8" />
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
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { backgroundColor: '#1a73e8', padding: 20 },
  greetingText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  greetingSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  section: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  tripCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, marginBottom: 12 },
  tripDestination: { fontSize: 20, fontWeight: '700', color: '#222' },
  tripRoute: { fontSize: 13, color: '#888', marginTop: 2 },
  tripDates: { fontSize: 14, color: '#666', marginTop: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusBadge: { backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1a73e8' },
  daysUntil: { fontSize: 12, color: '#888' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 15 },
})
