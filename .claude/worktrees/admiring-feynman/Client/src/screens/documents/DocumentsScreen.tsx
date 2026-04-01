import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { bookingsApi, Booking } from '../../api/bookings'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange, formatDate } from '../../utils/dateFormat'

interface BoardingPass {
  id: string
  fileName: string
  downloadUrl: string
  clientName: string
  flightNumber: string
}

interface Invoice {
  id: string
  type: 'invoice'
  fileName: string
  invoiceNumber: string
  invoiceDate: string | null
  dueDate: string | null
  totalAmount: number | null
  currency: string
  invoiceStatus: string | null
}

function BoardingPassRow({ bp }: { bp: BoardingPass }) {
  const handleOpen = async () => {
    try { await Linking.openURL(bp.downloadUrl) }
    catch { Alert.alert('Error', 'Could not open document') }
  }
  return (
    <TouchableOpacity style={styles.docRow} onPress={handleOpen} activeOpacity={0.7}>
      <View style={[styles.iconCircle, { backgroundColor: '#e8edf2' }]}>
        <Feather name="file" size={16} color="#1a3a5c" />
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{bp.fileName}</Text>
        <Text style={styles.docMeta}>{bp.flightNumber} · {bp.clientName}</Text>
      </View>
      <Feather name="download" size={16} color="#c9a96e" />
    </TouchableOpacity>
  )
}

const INV_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid: { bg: '#dcfce7', text: '#16a34a' },
  sent: { bg: '#e8edf2', text: '#1a3a5c' },
  draft: { bg: '#f0f2f5', text: '#8a8a9a' },
  overdue: { bg: '#fee2e2', text: '#dc2626' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
}

function InvoiceRow({ inv }: { inv: Invoice }) {
  const sc = INV_STATUS_COLORS[inv.invoiceStatus?.toLowerCase() ?? ''] ?? INV_STATUS_COLORS.draft
  return (
    <View style={styles.docRow}>
      <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
        <Feather name="file-text" size={16} color="#d97706" />
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{inv.invoiceNumber}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {inv.invoiceDate && <Text style={styles.docMeta}>{formatDate(inv.invoiceDate)}</Text>}
          {inv.totalAmount != null && (
            <Text style={styles.docMeta}>{inv.currency} {Number(inv.totalAmount).toFixed(2)}</Text>
          )}
        </View>
        {inv.dueDate && <Text style={styles.docMeta}>Due: {formatDate(inv.dueDate)}</Text>}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
        <Text style={[styles.statusText, { color: sc.text }]}>{inv.invoiceStatus ?? 'draft'}</Text>
      </View>
    </View>
  )
}

function TripDocuments({ booking }: { booking: Booking }) {
  const [expanded, setExpanded] = useState(false)
  const [boardingPasses, setBoardingPasses] = useState<BoardingPass[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const dest = parseDestination(booking.countries_cities)

  const toggle = useCallback(async () => {
    if (!expanded && !loaded) {
      setLoading(true)
      try {
        const result = await bookingsApi.getDocuments(booking.id)
        setBoardingPasses(result?.boardingPasses ?? [])
        setInvoices(result?.invoices ?? [])
      } catch {
        setBoardingPasses([])
        setInvoices([])
      } finally {
        setLoading(false)
        setLoaded(true)
      }
    }
    setExpanded((v) => !v)
  }, [expanded, loaded, booking.id])

  const totalDocs = boardingPasses.length + invoices.length

  return (
    <View style={styles.tripSection}>
      <TouchableOpacity style={styles.tripHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.tripHeaderLeft}>
          <Text style={styles.tripName}>{dest.label}</Text>
          <Text style={styles.tripDates}>
            {formatDateRange(booking.date_from, booking.date_to)}
            {loaded ? ` · ${totalDocs} doc${totalDocs !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#a0aab4" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.docsContainer}>
          {loading && <ActivityIndicator size="small" color="#1a3a5c" style={{ padding: 12 }} />}
          {!loading && totalDocs === 0 && (
            <Text style={styles.noDocs}>No documents available</Text>
          )}

          {!loading && invoices.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Invoices</Text>
              {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
            </>
          )}

          {!loading && boardingPasses.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Boarding Passes</Text>
              {boardingPasses.map((bp) => <BoardingPassRow key={bp.id} bp={bp} />)}
            </>
          )}
        </View>
      )}
    </View>
  )
}

export function DocumentsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await bookingsApi.getAll()
      setBookings(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading && bookings.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a3a5c" /></View>
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TripDocuments booking={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        ListEmptyComponent={<Text style={styles.empty}>No trips found</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { textAlign: 'center', color: '#a0aab4', marginTop: 48, fontSize: 14, fontWeight: '300', letterSpacing: 0.5 },

  tripSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#1a3a5c',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#c9a96e',
  },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  tripHeaderLeft: { flex: 1, marginRight: 8 },
  tripName: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.2 },
  tripDates: { fontSize: 12, color: '#8a8a9a', marginTop: 3 },

  docsContainer: { borderTopWidth: 0.5, borderTopColor: '#e8edf2' },
  noDocs: { padding: 16, textAlign: 'center', color: '#a0aab4', fontSize: 13, fontWeight: '300' },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8a8a9a',
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    textTransform: 'uppercase',
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f2f5',
    gap: 10,
  },
  iconCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', letterSpacing: 0.2 },
  docMeta: { fontSize: 11, color: '#8a8a9a', marginTop: 1 },

  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
})
