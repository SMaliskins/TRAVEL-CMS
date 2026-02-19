import { apiClient } from './client'

export interface Booking {
  id: string
  order_code: string
  status: string
  date_from: string | null
  date_to: string | null
  amount_total: number | null
  amount_paid: number | null
  countries_cities: string | null
  client_display_name: string | null
  created_at: string
}

export interface BookingService {
  id: string
  category: string
  service_name: string
  service_date_from: string | null
  service_date_to: string | null
  res_status: string
  client_price: number | null
  supplier_name: string | null
}

export const bookingsApi = {
  getAll: (): Promise<Booking[]> =>
    apiClient.get('/bookings').then((r) => r.data.data),

  getUpcoming: (): Promise<Booking[]> =>
    apiClient.get('/bookings/upcoming').then((r) => r.data.data),

  getHistory: (): Promise<Booking[]> =>
    apiClient.get('/bookings/history').then((r) => r.data.data),

  getById: (id: string): Promise<Booking & { services: BookingService[] }> =>
    apiClient.get(`/bookings/${id}`).then((r) => r.data.data),

  getItinerary: (id: string): Promise<BookingService[]> =>
    apiClient.get(`/bookings/${id}/itinerary`).then((r) => r.data.data),

  getDocuments: (id: string): Promise<unknown[]> =>
    apiClient.get(`/bookings/${id}/documents`).then((r) => r.data.data),

  getProfile: (): Promise<{
    id: string
    displayName: string | null
    email: string | null
    phone: string | null
    avatarUrl: string | null
    referralCode: string
  }> => apiClient.get('/profile').then((r) => r.data.data),
}
