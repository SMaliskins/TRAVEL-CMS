import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { bookingsApi, BookingService } from '../../api/bookings'
import { TripsStackParamList } from '../../navigation/MainStack'

type Props = NativeStackScreenProps<TripsStackParamList, 'TripDetail'>

export function TripDetailScreen({ route }: Props) {
  const { bookingId } = route.params
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof bookingsApi.getById>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    bookingsApi.getById(bookingId)
      .then(setBooking)
      .catch(() => {/* silent */})
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  if (!booking) {
    return <View style={styles.centered}><Text style={styles.error}>Бронирование не найдено</Text></View>
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.destination}>{booking.countries_cities ?? 'Поездка'}</Text>
        <Text style={styles.code}>{booking.order_code}</Text>
        <Text style={styles.dates}>
          {booking.date_from ? new Date(booking.date_from).toLocaleDateString('ru-RU') : '?'}
          {' — '}
          {booking.date_to ? new Date(booking.date_to).toLocaleDateString('ru-RU') : '?'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Статус</Text>
          <Text style={styles.infoValue}>{booking.status}</Text>
        </View>
        {booking.amount_total != null && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Итого</Text>
            <Text style={styles.infoValue}>€{booking.amount_total.toFixed(2)}</Text>
          </View>
        )}
        {booking.amount_paid != null && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Оплачено</Text>
            <Text style={styles.infoValue}>€{booking.amount_paid.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {booking.services && booking.services.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Маршрут</Text>
          {booking.services.map((s: BookingService) => (
            <View key={s.id} style={styles.serviceCard}>
              <Text style={styles.serviceName}>{s.service_name}</Text>
              <Text style={styles.serviceCategory}>{s.category}</Text>
              {s.service_date_from && (
                <Text style={styles.serviceDate}>
                  {new Date(s.service_date_from).toLocaleDateString('ru-RU')}
                </Text>
              )}
              <Text style={styles.serviceStatus}>{s.res_status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#999', fontSize: 16 },
  hero: { backgroundColor: '#1a73e8', padding: 24, paddingTop: 32 },
  destination: { fontSize: 22, fontWeight: '700', color: '#fff' },
  code: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  dates: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  infoRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, gap: 16, marginBottom: 2 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 2 },
  section: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  serviceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#1a73e8' },
  serviceName: { fontSize: 15, fontWeight: '600', color: '#333' },
  serviceCategory: { fontSize: 12, color: '#888', marginTop: 2 },
  serviceDate: { fontSize: 13, color: '#666', marginTop: 4 },
  serviceStatus: { fontSize: 12, color: '#1a73e8', fontWeight: '600', marginTop: 4 },
})
