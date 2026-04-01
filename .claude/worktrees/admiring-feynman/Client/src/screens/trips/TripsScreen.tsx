import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { bookingsApi, Booking } from '../../api/bookings'
import { TripsStackParamList } from '../../navigation/MainStack'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, calcDaysNights } from '../../utils/dateFormat'

type Props = NativeStackScreenProps<TripsStackParamList, 'TripsList'>

function TripCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const dest = parseDestination(booking.countries_cities)
  const daysNights = calcDaysNights(booking.date_from, booking.date_to)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <Text style={styles.destination}>{dest.label}</Text>
        <Text style={styles.code}>{booking.order_code}</Text>
      </View>
      {dest.route && (
        <Text style={styles.route}>{dest.route}</Text>
      )}
      <Text style={styles.dates}>
        {formatDateRange(booking.date_from, booking.date_to)}
        {daysNights ? `  (${daysNights})` : ''}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.status}>{booking.status}</Text>
        {booking.amount_total != null && booking.amount_total > 0 && (
          <Text style={styles.amount}>€{booking.amount_total.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export function TripsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [history, setHistory] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [u, h] = await Promise.all([bookingsApi.getUpcoming(), bookingsApi.getHistory()])
      setUpcoming(u)
      setHistory(h)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const data = tab === 'upcoming' ? upcoming : history

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            Past ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a3a5c" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripCard
              booking={item}
              onPress={() => navigation.navigate('TripDetail', { bookingId: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}
            </Text>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#d0d8e0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#c9a96e' },
  tabText: { fontSize: 13, color: '#8a8a9a', fontWeight: '500', letterSpacing: 0.5 },
  tabTextActive: { color: '#1a3a5c', fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#1a3a5c',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a96e',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  destination: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', flex: 1, letterSpacing: 0.2 },
  code: { fontSize: 11, color: '#a0aab4', marginLeft: 8, fontWeight: '500', letterSpacing: 0.5 },
  route: { fontSize: 12, color: '#8a8a9a', marginTop: 3 },
  dates: { fontSize: 13, color: '#5a5a6a', marginTop: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  status: {
    fontSize: 11,
    color: '#1a3a5c',
    fontWeight: '600',
    backgroundColor: '#e8edf2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 0.3,
  },
  amount: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  empty: { textAlign: 'center', color: '#a0aab4', fontSize: 14, marginTop: 48, fontWeight: '300', letterSpacing: 0.5 },
})
