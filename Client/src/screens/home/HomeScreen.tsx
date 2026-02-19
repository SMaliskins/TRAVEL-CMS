import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { bookingsApi, Booking } from '../../api/bookings'
import { useAuthStore } from '../../store/authStore'

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

  const nextTrip = upcoming[0]

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
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hi, {profile?.displayName ?? 'traveler'} 👋
        </Text>
        <Text style={styles.headerSub}>MyTravelConcierge</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Trip</Text>
        {nextTrip ? (
          <View style={styles.tripCard}>
            <Text style={styles.tripDestination}>{nextTrip.countries_cities ?? '—'}</Text>
            <Text style={styles.tripDates}>
              {nextTrip.date_from ? new Date(nextTrip.date_from).toLocaleDateString('en-US') : '?'}{' '}
              —{' '}
              {nextTrip.date_to ? new Date(nextTrip.date_to).toLocaleDateString('en-US') : '?'}
            </Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{nextTrip.status}</Text>
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
  header: { backgroundColor: '#1a73e8', padding: 24, paddingTop: 56 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  section: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  tripCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  tripDestination: { fontSize: 20, fontWeight: '700', color: '#222' },
  tripDates: { fontSize: 14, color: '#666', marginTop: 6 },
  statusBadge: { marginTop: 12, backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1a73e8' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 15 },
  statNumber: { fontSize: 32, fontWeight: '700', color: '#1a73e8' },
})
