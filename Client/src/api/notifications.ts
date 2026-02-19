import { apiClient } from './client'

export interface AppNotification {
  id: string
  title: string
  body: string | null
  type: string
  ref_id: string | null
  read: boolean
  created_at: string
}

export interface NotificationsResponse {
  data: AppNotification[]
  unreadCount: number
}

export const notificationsApi = {
  getAll: (): Promise<NotificationsResponse> =>
    apiClient.get('/notifications').then((r) => r.data),

  markRead: (ids: string[]): Promise<void> =>
    apiClient.post('/notifications/read', { ids }),

  markAllRead: (): Promise<void> =>
    apiClient.post('/notifications/read', { all: true }),
}
