import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { notificationsApi, AppNotification } from '../../api/notifications'

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  order_update: 'briefcase',
  service_update: 'edit-3',
  document_uploaded: 'file-text',
  payment_received: 'credit-card',
  trip_reminder: 'clock',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB')
}

interface Props {
  navigation: { goBack: () => void }
}

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await notificationsApi.getAll()
      setNotifications(res.data)
      setUnreadCount(res.unreadCount)
    } catch (err) {
      console.error('[Notifications] Load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('[Notifications] Mark all read error:', err)
    }
  }

  const handleTapNotification = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await notificationsApi.markRead([item.id])
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {}
    }
  }

  const renderItem = ({ item }: { item: AppNotification }) => {
    const iconName = TYPE_ICONS[item.type] || 'bell'
    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.read && styles.unreadItem]}
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, !item.read && styles.unreadIcon]}>
          <Feather name={iconName} size={18} color={item.read ? '#999' : '#1a3a5c'} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadTitle]}>
            {item.title}
          </Text>
          {item.body ? (
            <Text style={styles.notifBody} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#1a3a5c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#d0d8e0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', letterSpacing: 0.3 },
  markAllBtn: { padding: 4 },
  markAllText: { fontSize: 12, color: '#c9a96e', fontWeight: '700', letterSpacing: 0.3 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  unreadItem: { backgroundColor: '#f0f4f8' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unreadIcon: { backgroundColor: '#e8edf2' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: '#1a1a2e', letterSpacing: 0.1 },
  unreadTitle: { fontWeight: '700', color: '#1a1a2e' },
  notifBody: { fontSize: 13, color: '#5a5a6a', marginTop: 2 },
  notifTime: { fontSize: 11, color: '#a0aab4', marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9a96e',
    marginLeft: 8,
  },
  separator: { height: 0.5, backgroundColor: '#e8edf2' },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyText: { fontSize: 15, color: '#a0aab4', marginTop: 12, fontWeight: '300', letterSpacing: 0.5 },
})
