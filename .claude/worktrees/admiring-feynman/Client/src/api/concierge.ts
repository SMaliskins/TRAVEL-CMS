import { apiClient } from './client'

export interface ChatResponse {
  sessionId: string
  message: string
  stopReason: string
}

export const conciergeApi = {
  sendMessage: (message: string, sessionId?: string, language = 'en'): Promise<ChatResponse> =>
    apiClient
      .post('/concierge/chat', { message, sessionId, language }, { timeout: 60000 })
      .then((r) => r.data.data),
}
