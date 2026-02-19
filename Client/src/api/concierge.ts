import { apiClient } from './client'

export interface ChatResponse {
  sessionId: string
  message: string
  stopReason: string
}

export const conciergeApi = {
  sendMessage: (message: string, sessionId?: string): Promise<ChatResponse> =>
    apiClient
      .post('/concierge/chat', { message, sessionId, language: 'ru' })
      .then((r) => r.data.data),
}
