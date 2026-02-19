import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { bookingsApi, Booking } from '../../api/bookings'

export function DocumentsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.getAll()
      .then(setBookings)
      .catch(() => {/* silent */})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Documents</Text>
      <Text style={styles.subtitle}>Tap a trip to view documents</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bookingRow}>
            <Text style={styles.bookingName}>{item.countries_cities ?? 'Trip'}</Text>
            <Text style={styles.bookingCode}>{item.order_code}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No documents found</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', color: '#222', padding: 24, paddingBottom: 4, paddingTop: 56 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginBottom: 8 },
  list: { padding: 16 },
  bookingRow: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingName: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  bookingCode: { fontSize: 12, color: '#999' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15 },
})
