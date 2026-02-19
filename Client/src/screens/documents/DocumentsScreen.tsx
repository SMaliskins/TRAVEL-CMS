import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { bookingsApi, Booking } from '../../api/bookings'
import { parseDestination } from '../../utils/parseDestination'
import { formatDateRange } from '../../utils/dateFormat'

interface Document {
  id: string
  fileName: string
  fileUrl: string
  clientName?: string
  flightNumber?: string
}

function DocumentRow({ doc }: { doc: Document }) {
  const handleOpen = async () => {
    try {
      await Linking.openURL(doc.fileUrl)
    } catch {
      Alert.alert('Error', 'Could not open document')
    }
  }

  return (
    <TouchableOpacity style={styles.docRow} onPress={handleOpen} activeOpacity={0.7}>
      <Feather name="file" size={18} color="#1a73e8" />
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{doc.fileName}</Text>
        {doc.flightNumber && <Text style={styles.docMeta}>{doc.flightNumber}</Text>}
        {doc.clientName && <Text style={styles.docMeta}>{doc.clientName}</Text>}
      </View>
      <Feather name="download" size={16} color="#999" />
    </TouchableOpacity>
  )
}

function TripDocuments({ booking }: { booking: Booking }) {
  const [expanded, setExpanded] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const dest = parseDestination(booking.countries_cities)

  const toggle = useCallback(async () => {
    if (!expanded && !loaded) {
      setLoading(true)
      try {
        const result = await bookingsApi.getDocuments(booking.id) as Document[]
        setDocs(result ?? [])
      } catch {
        setDocs([])
      } finally {
        setLoading(false)
        setLoaded(true)
      }
    }
    setExpanded((v) => !v)
  }, [expanded, loaded, booking.id])

  return (
    <View style={styles.tripSection}>
      <TouchableOpacity style={styles.tripHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.tripHeaderLeft}>
          <Text style={styles.tripName}>{dest.label}</Text>
          <Text style={styles.tripDates}>
            {formatDateRange(booking.date_from, booking.date_to)}
          </Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#999" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.docsContainer}>
          {loading && <ActivityIndicator size="small" color="#1a73e8" style={{ padding: 12 }} />}
          {!loading && docs.length === 0 && (
            <Text style={styles.noDocs}>No documents available</Text>
          )}
          {!loading && docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </View>
      )}
    </View>
  )
}

export function DocumentsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const insets = useSafeAreaInsets()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await bookingsApi.getAll()
      setBookings(data)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading && bookings.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1a73e8" /></View>
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.header, { paddingTop: insets.top + 16 }]}>Documents</Text>
      <Text style={styles.subtitle}>Tap a trip to view its documents</Text>
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
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '700', color: '#222', paddingHorizontal: 24, paddingBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', paddingHorizontal: 24, marginBottom: 8 },
  list: { padding: 16 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 15 },

  tripSection: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  tripHeaderLeft: { flex: 1, marginRight: 8 },
  tripName: { fontSize: 15, fontWeight: '600', color: '#333' },
  tripDates: { fontSize: 12, color: '#888', marginTop: 2 },

  docsContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  noDocs: { padding: 16, textAlign: 'center', color: '#aaa', fontSize: 13 },

  docRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 10 },
  docInfo: { flex: 1 },
  docName: { fontSize: 14, fontWeight: '500', color: '#333' },
  docMeta: { fontSize: 11, color: '#888', marginTop: 1 },
})
