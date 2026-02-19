import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { bookingsApi, Booking } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, calcDaysNights, calcDaysUntil } from '../../utils/dateFormat'

export function HomeScreen() {
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [profile, setProfile] = useState<{ displayName: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const logout = useAuthStore((s) => s.logout)

  const loadData = async () => {
    try {
      const [trips, prof] = await Promise.all([
        bookingsApi.getUpcoming(),
        bookingsApi.getProfile(),
      ])
      setUpcoming(trips)
      setProfile(prof)
    } catch {
      // Token refresh handles auth; other errors silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

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
        <Text style={styles.greeting}>
          Hi, {profile?.displayName ?? 'traveler'} 👋
        </Text>
        <Text style={styles.headerSub}>MyTravelConcierge</Text>
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
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
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
