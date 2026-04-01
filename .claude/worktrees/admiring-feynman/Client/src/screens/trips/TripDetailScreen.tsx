import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { bookingsApi, BookingService, FlightSegment } from '../../api/bookings'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, formatDate, calcDaysNights, calcDaysUntil } from '../../utils/dateFormat'

type Props = { route: { params: { bookingId: string } } }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#dcfce7', text: '#16a34a' },
  booked: { bg: '#e8edf2', text: '#1a3a5c' },
  active: { bg: '#e8edf2', text: '#1a3a5c' },
  pending: { bg: '#fef3c7', text: '#d97706' },
  changed: { bg: '#fef3c7', text: '#d97706' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  rejected: { bg: '#fee2e2', text: '#dc2626' },
}

const BOARD_LABELS: Record<string, string> = {
  room_only: 'Room Only',
  breakfast: 'Breakfast',
  half_board: 'Half Board',
  full_board: 'Full Board',
  all_inclusive: 'All Inclusive',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status?.toLowerCase()] ?? STATUS_COLORS.booked
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{status}</Text>
    </View>
  )
}

function TravellerBadges({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <View style={styles.travellerRow}>
      {names.map((n, i) => (
        <View key={i} style={styles.travellerBadge}>
          <Text style={styles.travellerBadgeText}>{n.split(' ').pop()}</Text>
        </View>
      ))}
    </View>
  )
}

function FlightSegmentCard({ segment, service }: { segment: FlightSegment; service: BookingService }) {
  return (
    <View style={[styles.serviceCard, styles.flightBorder]}>
      <View style={styles.flightHeader}>
        <Text style={styles.flightNumber}>{segment.flightNumber}</Text>
        {segment.airline && <Text style={styles.airline}>{segment.airline}</Text>}
        {service.cabin_class && service.cabin_class !== 'economy' && (
          <Text style={styles.cabinClass}>{service.cabin_class}</Text>
        )}
      </View>
      <View style={styles.flightRoute}>
        <View style={styles.flightPoint}>
          <Text style={styles.airportCode}>{segment.departure}</Text>
          {segment.departureCity && <Text style={styles.cityName}>{segment.departureCity}</Text>}
          <Text style={styles.flightTime}>{segment.departureTimeScheduled}</Text>
          <Text style={styles.flightDate}>{formatDate(segment.departureDate)}</Text>
        </View>
        <View style={styles.flightArrow}><Text style={styles.arrowText}>→</Text></View>
        <View style={[styles.flightPoint, { alignItems: 'flex-end' }]}>
          <Text style={styles.airportCode}>{segment.arrival}</Text>
          {segment.arrivalCity && <Text style={styles.cityName}>{segment.arrivalCity}</Text>}
          <Text style={styles.flightTime}>{segment.arrivalTimeScheduled}</Text>
          <Text style={styles.flightDate}>{formatDate(segment.arrivalDate)}</Text>
        </View>
      </View>
      {service.ref_nr && <Text style={styles.refNr}>PNR {service.ref_nr}</Text>}
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

function FlightCard({ service }: { service: BookingService }) {
  return (
    <View style={[styles.serviceCard, styles.flightBorder]}>
      <Text style={styles.categoryLabel}>FLIGHT</Text>
      <Text style={styles.serviceName}>{service.service_name}</Text>
      <Text style={styles.serviceDate}>{formatDateRange(service.service_date_from, service.service_date_to)}</Text>
      <StatusBadge status={service.res_status} />
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

function CheckinCard({ service }: { service: BookingService }) {
  const hotelName = service.hotel_name || service.service_name
  const stars = service.hotel_star_rating ? '★'.repeat(Number(service.hotel_star_rating) || 0) : null
  return (
    <View style={[styles.serviceCard, styles.hotelBorder]}>
      <Text style={styles.categoryLabel}>CHECK-IN</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.serviceName}>{hotelName}</Text>
        {stars ? <Text style={{ fontSize: 13, color: '#f59e0b' }}>{stars}</Text> : null}
      </View>
      <Text style={styles.serviceDate}>{formatDate(service.service_date_from)}</Text>
      <View style={styles.hotelDetails}>
        {service.hotel_room && <Text style={styles.hotelDetail}>{service.hotel_room}</Text>}
        {service.hotel_board && (
          <Text style={styles.hotelDetail}>{BOARD_LABELS[service.hotel_board] ?? service.hotel_board}</Text>
        )}
        {service.hotel_bed_type && <Text style={styles.hotelDetail}>{service.hotel_bed_type}</Text>}
      </View>
      {service.ref_nr && <Text style={styles.refNr}>Ref: {service.ref_nr}</Text>}
      <StatusBadge status={service.res_status} />
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

function CheckoutCard({ service }: { service: BookingService }) {
  const hotelName = service.hotel_name || service.service_name
  return (
    <View style={[styles.serviceCard, styles.hotelBorder]}>
      <Text style={styles.categoryLabel}>CHECK-OUT</Text>
      <Text style={styles.serviceName}>{hotelName}</Text>
      <Text style={styles.serviceDate}>{formatDate(service.service_date_to)}</Text>
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

function TransferCard({ service }: { service: BookingService }) {
  return (
    <View style={[styles.serviceCard, styles.transferBorder]}>
      <Text style={styles.categoryLabel}>TRANSFER</Text>
      <Text style={styles.serviceName}>{service.service_name}</Text>
      {service.transfer_type && <Text style={styles.transferType}>{service.transfer_type}</Text>}
      <Text style={styles.serviceDate}>{formatDate(service.service_date_from)}</Text>
      {(service.pickup_location || service.dropoff_location) && (
        <View style={styles.transferRoute}>
          {service.pickup_location && <Text style={styles.transferPoint}>From: {service.pickup_location}</Text>}
          {service.dropoff_location && <Text style={styles.transferPoint}>To: {service.dropoff_location}</Text>}
          {service.pickup_time && <Text style={styles.transferPoint}>Time: {service.pickup_time}</Text>}
        </View>
      )}
      {service.ref_nr && <Text style={styles.refNr}>Ref: {service.ref_nr}</Text>}
      <StatusBadge status={service.res_status} />
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

function GenericServiceCard({ service }: { service: BookingService }) {
  const cat = service.category?.toLowerCase() ?? ''
  const borderColor = cat.includes('insurance') ? '#22c55e' : cat.includes('visa') ? '#8b5cf6' : '#6b7280'
  return (
    <View style={[styles.serviceCard, { borderLeftColor: borderColor }]}>
      <Text style={styles.categoryLabel}>{(service.category ?? 'SERVICE').toUpperCase()}</Text>
      <Text style={styles.serviceName}>{service.service_name}</Text>
      <Text style={styles.serviceDate}>{formatDateRange(service.service_date_from, service.service_date_to)}</Text>
      {service.ref_nr && <Text style={styles.refNr}>Ref: {service.ref_nr}</Text>}
      <StatusBadge status={service.res_status} />
      <TravellerBadges names={service.traveller_names ?? []} />
    </View>
  )
}

interface TimelineEvent {
  key: string
  type: 'flight' | 'hotel_checkin' | 'hotel_checkout' | 'transfer' | 'other'
  sortDate: string
  service: BookingService
  segment?: FlightSegment
}

function isFlightService(cat: string): boolean {
  return cat.includes('flight') || cat.includes('air ticket')
}

function isTourWithFlights(cat: string, service: BookingService): boolean {
  return (cat.includes('tour') || cat.includes('package'))
    && Array.isArray(service.flight_segments)
    && service.flight_segments.length > 0
}

function isHotelService(cat: string): boolean {
  return cat.includes('hotel') || cat.includes('accommodation')
}

function mergeDuplicateServices(services: BookingService[]): BookingService[] {
  const groupMap = new Map<string, BookingService>()

  for (const svc of services) {
    if (svc.res_status === 'cancelled') continue
    const key = svc.split_group_id
      || `${svc.category}|${svc.service_name}|${svc.service_date_from}|${svc.service_date_to}`

    const existing = groupMap.get(key)
    if (existing) {
      const mergedIds = new Set([...(existing.traveller_ids ?? []), ...(svc.traveller_ids ?? [])])
      existing.traveller_ids = Array.from(mergedIds)
      const mergedNames = new Set([...(existing.traveller_names ?? []), ...(svc.traveller_names ?? [])])
      existing.traveller_names = Array.from(mergedNames)
      if (svc.ticket_numbers?.length) {
        const seen = new Set((existing.ticket_numbers ?? []).map(t => `${t.clientId}|${t.ticketNr}`))
        for (const t of svc.ticket_numbers) {
          if (!seen.has(`${t.clientId}|${t.ticketNr}`)) {
            existing.ticket_numbers = [...(existing.ticket_numbers ?? []), t]
          }
        }
      }
    } else {
      groupMap.set(key, { ...svc })
    }
  }

  return Array.from(groupMap.values())
}

function buildTimeline(rawServices: BookingService[]): TimelineEvent[] {
  const services = mergeDuplicateServices(rawServices)
  const events: TimelineEvent[] = []
  const seenSegmentKeys = new Set<string>()

  for (const svc of services) {
    const cat = svc.category?.toLowerCase() ?? ''

    if (isFlightService(cat) || isTourWithFlights(cat, svc)) {
      const segments = svc.flight_segments ?? []
      if (segments.length > 0) {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          const segKey = `${seg.departureDate}-${seg.departureTimeScheduled}-${seg.flightNumber}-${seg.departure}-${seg.arrival}`
          if (seenSegmentKeys.has(segKey)) continue
          seenSegmentKeys.add(segKey)
          events.push({
            key: `${svc.id}-flight-${i}`,
            type: 'flight',
            sortDate: seg.departureDate ?? svc.service_date_from ?? '',
            service: svc,
            segment: seg,
          })
        }
      } else {
        events.push({
          key: `${svc.id}-flight`,
          type: 'flight',
          sortDate: svc.service_date_from ?? '',
          service: svc,
        })
      }

      if (isTourWithFlights(cat, svc)) {
        if (svc.service_date_from) {
          events.push({ key: `${svc.id}-checkin`, type: 'hotel_checkin', sortDate: svc.service_date_from, service: svc })
        }
        if (svc.service_date_to) {
          events.push({ key: `${svc.id}-checkout`, type: 'hotel_checkout', sortDate: svc.service_date_to, service: svc })
        }
      }
    } else if (isHotelService(cat)) {
      events.push({ key: `${svc.id}-checkin`, type: 'hotel_checkin', sortDate: svc.service_date_from ?? '', service: svc })
      events.push({ key: `${svc.id}-checkout`, type: 'hotel_checkout', sortDate: svc.service_date_to ?? '', service: svc })
    } else if (cat.includes('transfer')) {
      events.push({ key: svc.id, type: 'transfer', sortDate: svc.service_date_from ?? '', service: svc })
    } else {
      events.push({ key: svc.id, type: 'other', sortDate: svc.service_date_from ?? '', service: svc })
    }
  }

  events.sort((a, b) => {
    if (a.sortDate === b.sortDate) {
      const order = { hotel_checkout: 0, transfer: 1, flight: 2, other: 3, hotel_checkin: 4 }
      return (order[a.type] ?? 3) - (order[b.type] ?? 3)
    }
    return a.sortDate.localeCompare(b.sortDate)
  })

  return events
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  if (event.type === 'flight' && event.segment) return <FlightSegmentCard segment={event.segment} service={event.service} />
  if (event.type === 'flight') return <FlightCard service={event.service} />
  if (event.type === 'hotel_checkin') return <CheckinCard service={event.service} />
  if (event.type === 'hotel_checkout') return <CheckoutCard service={event.service} />
  if (event.type === 'transfer') return <TransferCard service={event.service} />
  return <GenericServiceCard service={event.service} />
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getDay()]} ${formatDate(dateStr)}`
}

export function TripDetailScreen({ route }: Props) {
  const { bookingId } = route.params
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof bookingsApi.getById>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTraveller, setSelectedTraveller] = useState<string | null>(null)

  useEffect(() => {
    bookingsApi.getById(bookingId)
      .then(setBooking)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [bookingId])

  const dest = booking ? parseDestination(booking.countries_cities) : null
  const daysNights = booking ? calcDaysNights(booking.date_from, booking.date_to) : null
  const daysUntil = booking ? calcDaysUntil(booking.date_from) : null

  const allTravellers = useMemo(() => {
    if (!booking?.services) return []
    const nameSet = new Set<string>()
    for (const s of booking.services) {
      for (const n of (s.traveller_names ?? [])) nameSet.add(n)
    }
    return Array.from(nameSet)
  }, [booking?.services])

  const timeline = useMemo(() => {
    if (!booking?.services) return []
    let filtered = booking.services
    if (selectedTraveller) {
      filtered = filtered.filter(s =>
        !s.traveller_names?.length || s.traveller_names.includes(selectedTraveller)
      )
    }
    return buildTimeline(filtered)
  }, [booking?.services, selectedTraveller])

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a3a5c" /></View>
  }

  if (!booking || !dest) {
    return <View style={styles.centered}><Text style={styles.error}>Booking not found</Text></View>
  }

  const totalAmount = Number(booking.amount_total) || 0
  const paidAmount = Number(booking.amount_paid) || 0
  const debtAmount = Number(booking.amount_debt) || 0
  const overdue = booking.overdue_days ?? 0

  let lastDay = ''

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.destination}>{dest.label}</Text>
        {dest.route && <Text style={styles.routeText}>{dest.route}</Text>}
        <Text style={styles.code}>{booking.order_code}</Text>
        <Text style={styles.dates}>
          {formatDateRange(booking.date_from, booking.date_to)}
          {daysNights ? `  (${daysNights})` : ''}
        </Text>
        {daysUntil != null && daysUntil > 0 && (
          <Text style={styles.daysUntilHero}>{daysUntil} days before trip</Text>
        )}
      </View>

      <View style={styles.financeRow}>
        <View style={styles.financeItem}>
          <Text style={styles.financeLabel}>Total</Text>
          <Text style={styles.financeValue}>€{totalAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.financeItem}>
          <Text style={styles.financeLabel}>Paid</Text>
          <Text style={[styles.financeValue, { color: '#16a34a' }]}>€{paidAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.financeItem}>
          <Text style={styles.financeLabel}>Balance</Text>
          <Text style={[styles.financeValue, debtAmount > 0 ? { color: '#dc2626' } : {}]}>
            €{debtAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      {(booking.payment_dates?.deposit || booking.payment_dates?.final) && (
        <View style={styles.paymentSection}>
          {booking.payment_dates.deposit && (
            <Text style={styles.paymentText}>Deposit: {formatDate(booking.payment_dates.deposit)}</Text>
          )}
          {booking.payment_dates.final && (
            <Text style={styles.paymentText}>Final: {formatDate(booking.payment_dates.final)}</Text>
          )}
          {overdue > 0 && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueText}>{overdue} days overdue</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.statusRow}>
        <StatusBadge status={booking.status} />
      </View>

      {timeline.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itinerary</Text>
          {allTravellers.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedTraveller && styles.filterChipActive]}
                onPress={() => setSelectedTraveller(null)}
              >
                <Text style={[styles.filterChipText, !selectedTraveller && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {allTravellers.map((name) => {
                const surname = name.split(' ').pop() ?? name
                const active = selectedTraveller === name
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setSelectedTraveller(active ? null : name)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{surname}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
          {timeline.map((event) => {
            const day = event.sortDate?.split('T')[0] ?? ''
            let showDayHeader = false
            if (day && day !== lastDay) {
              lastDay = day
              showDayHeader = true
            }
            return (
              <View key={event.key}>
                {showDayHeader && <Text style={styles.dayHeader}>{formatDayHeader(day)}</Text>}
                <TimelineEventCard event={event} />
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#999', fontSize: 16 },

  hero: { backgroundColor: '#1a3a5c', padding: 24, paddingTop: 16 },
  destination: { fontSize: 22, fontWeight: '700', color: '#fff' },
  routeText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  code: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  dates: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  daysUntilHero: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  financeRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, gap: 8 },
  financeItem: { flex: 1, alignItems: 'center' },
  financeLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  financeValue: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 2 },

  paymentSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentText: { fontSize: 12, color: '#666' },
  overdueBadge: { backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  overdueText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },

  statusRow: { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12, marginBottom: 2 },

  section: { margin: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  filterRow: { marginBottom: 10, flexGrow: 0 },
  filterChip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  filterChipActive: { backgroundColor: '#1a3a5c' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: '#fff' },

  serviceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#1a3a5c' },
  flightBorder: { borderLeftColor: '#3b82f6' },
  hotelBorder: { borderLeftColor: '#f59e0b' },
  transferBorder: { borderLeftColor: '#f59e0b' },
  categoryLabel: { fontSize: 10, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 4 },
  serviceName: { fontSize: 15, fontWeight: '600', color: '#333' },
  serviceDate: { fontSize: 13, color: '#666', marginTop: 4 },

  badge: { marginTop: 8, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  travellerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  travellerBadge: { backgroundColor: '#e8edf2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  travellerBadgeText: { fontSize: 11, fontWeight: '600', color: '#1a3a5c' },

  flightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flightNumber: { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  airline: { fontSize: 12, color: '#888' },
  cabinClass: { fontSize: 11, color: '#1a3a5c', backgroundColor: '#e8edf2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },

  flightRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  flightPoint: { flex: 1 },
  airportCode: { fontSize: 18, fontWeight: '700', color: '#222' },
  cityName: { fontSize: 11, color: '#888', marginTop: 1 },
  flightTime: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 4 },
  flightDate: { fontSize: 11, color: '#888' },
  flightArrow: { paddingHorizontal: 12 },
  arrowText: { fontSize: 20, color: '#ccc' },
  refNr: { fontSize: 11, color: '#888', marginTop: 4 },

  hotelDetails: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  hotelDetail: { fontSize: 12, color: '#666', backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },

  transferType: { fontSize: 12, color: '#888', marginTop: 2 },
  transferRoute: { marginTop: 6 },
  transferPoint: { fontSize: 13, color: '#555', marginTop: 2 },

  dayHeader: { fontSize: 13, fontWeight: '700', color: '#1a3a5c', marginTop: 12, marginBottom: 6 },
})
