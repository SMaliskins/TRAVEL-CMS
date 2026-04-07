import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { referralApi, ReferralOverview } from '../../api/referral'
import { formatDate } from '../../utils/dateFormat'

function money(amount: number, currency: string) {
  const n = Math.round(amount * 100) / 100
  return `${n.toFixed(2)} ${currency}`
}

function CurrencyTotals({ title, by }: { title: string; by: Record<string, number> }) {
  const keys = Object.keys(by).filter((k) => Math.abs(by[k] ?? 0) > 0.0001)
  if (keys.length === 0) {
    return (
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>{title}</Text>
        <Text style={styles.cardValueMuted}>—</Text>
      </View>
    )
  }
  return (
    <View style={styles.cardBlock}>
      <Text style={styles.cardSectionTitle}>{title}</Text>
      {keys.map((c) => (
        <View key={c} style={styles.cardRow}>
          <Text style={styles.cardLabel}>{c}</Text>
          <Text style={styles.cardValue}>{money(by[c] ?? 0, c)}</Text>
        </View>
      ))}
    </View>
  )
}

export function ReferralScreen() {
  const [data, setData] = useState<ReferralOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await referralApi.getOverview()
      setData(d)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setError('Referral is not enabled for your account.')
      } else {
        setError('Could not load referral data.')
      }
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load])
  )

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No data</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!data.hasReferralRole && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Referral partner setup is not complete yet. Your agency will link rates here; totals may stay empty until then.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your profile</Text>
        <Text style={styles.profileName}>{data.partnerProfile.displayName}</Text>
        {data.partnerProfile.email ? (
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{data.partnerProfile.email}</Text>
          </View>
        ) : null}
        {data.partnerProfile.phone ? (
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Phone</Text>
            <Text style={styles.profileValue}>{data.partnerProfile.phone}</Text>
          </View>
        ) : null}
        {data.partnerProfile.partyType ? (
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Account type</Text>
            <Text style={styles.profileValue}>{data.partnerProfile.partyType}</Text>
          </View>
        ) : null}
        <View style={styles.profileRow}>
          <Text style={styles.profileLabel}>Default currency</Text>
          <Text style={styles.profileValue}>{data.defaultCurrency}</Text>
        </View>
        {data.agencyName ? (
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Agency</Text>
            <Text style={styles.profileValue}>{data.agencyName}</Text>
          </View>
        ) : null}
        {data.referralNotes ? (
          <View style={styles.profileNotes}>
            <Text style={styles.profileNotesTitle}>Note from the agency</Text>
            <Text style={styles.profileNotesBody}>{data.referralNotes}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Balances</Text>
        <CurrencyTotals title="Planned" by={data.plannedByCurrency} />
        <CurrencyTotals title="Accrued" by={data.accruedByCurrency} />
        <CurrencyTotals title="Settled" by={data.settledByCurrency} />
        <CurrencyTotals title="Available" by={data.availableByCurrency} />
      </View>

      <Text style={styles.sectionHeading}>Commission lines</Text>
      {data.lines.length === 0 ? (
        <Text style={styles.muted}>No lines yet.</Text>
      ) : (
        data.lines.map((line) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineTop}>
              <Text style={styles.lineAmount}>{money(line.commissionAmount, line.currency)}</Text>
              <Text style={[styles.badge, line.status === 'accrued' ? styles.badgeAccrued : styles.badgePlanned]}>
                {line.status}
              </Text>
            </View>
            {line.orderCode ? <Text style={styles.lineMeta}>Order {line.orderCode}</Text> : null}
            <Text style={styles.lineMeta}>Base {money(line.baseAmount, line.currency)} · {formatDate(line.createdAt)}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionHeading}>Settlements</Text>
      {data.settlements.length === 0 ? (
        <Text style={styles.muted}>No settlements recorded.</Text>
      ) : (
        data.settlements.map((s) => (
          <View key={s.id} style={styles.lineCard}>
            <Text style={styles.lineAmount}>{money(s.amount, s.currency)}</Text>
            <Text style={styles.lineMeta}>{formatDate(s.entryDate)}</Text>
            {s.note ? <Text style={styles.lineNote}>{s.note}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f0f4f8' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f0f4f8' },
  errorText: { color: '#8b4513', textAlign: 'center', fontSize: 15 },
  banner: {
    backgroundColor: '#fff8e6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0e0b2',
  },
  bannerText: { fontSize: 13, color: '#5c4a21', lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1a3a5c', marginBottom: 10 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#1a3a5c', marginBottom: 10 },
  profileRow: { marginBottom: 8 },
  profileLabel: { fontSize: 12, fontWeight: '600', color: '#6b7c8f', marginBottom: 2 },
  profileValue: { fontSize: 14, color: '#1a3a5c' },
  profileNotes: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f6f8fa',
    borderRadius: 8,
  },
  profileNotesTitle: { fontSize: 11, fontWeight: '700', color: '#6b7c8f', textTransform: 'uppercase', marginBottom: 4 },
  profileNotesBody: { fontSize: 14, color: '#1a3a5c', lineHeight: 20 },
  cardSectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7c8f', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  cardBlock: { marginBottom: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  cardLabel: { fontSize: 14, color: '#4a5a6a' },
  cardValue: { fontSize: 14, fontWeight: '600', color: '#1a3a5c' },
  cardValueMuted: { fontSize: 14, color: '#a0aab4' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#1a3a5c', marginBottom: 8, marginTop: 4 },
  muted: { fontSize: 14, color: '#a0aab4', marginBottom: 12 },
  lineCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8eef4',
  },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineAmount: { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  lineMeta: { fontSize: 12, color: '#6b7c8f', marginTop: 4 },
  lineNote: { fontSize: 13, color: '#4a5a6a', marginTop: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', textTransform: 'capitalize' },
  badgePlanned: { backgroundColor: '#e8eef4', color: '#4a5a6a' },
  badgeAccrued: { backgroundColor: '#e6f4ea', color: '#1b5e20' },
})
