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

export interface FlightSegment {
  id: string
  flightNumber: string
  airline?: string
  departure: string
  departureCity?: string
  arrival: string
  arrivalCity?: string
  departureDate: string
  departureTimeScheduled: string
  arrivalDate: string
  arrivalTimeScheduled: string
  departureTerminal?: string
  arrivalTerminal?: string
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
  ref_nr: string | null
  ticket_nr: string | null
  flight_segments: FlightSegment[] | null
  cabin_class: string | null
  ticket_numbers: { clientId: string; clientName: string; ticketNr: string }[] | null
  hotel_board: string | null
  hotel_room: string | null
  hotel_bed_type: string | null
  hotel_name: string | null
  hotel_star_rating: string | null
  transfer_type: string | null
  pickup_location: string | null
  dropoff_location: string | null
  pickup_time: string | null
  payment_deadline_deposit: string | null
  payment_deadline_final: string | null
}

export const bookingsApi = {
  getAll: (): Promise<Booking[]> =>
    apiClient.get('/bookings').then((r) => r.data.data),

  getUpcoming: (): Promise<Booking[]> =>
    apiClient.get('/bookings/upcoming').then((r) => r.data.data),

  getHistory: (): Promise<Booking[]> =>
    apiClient.get('/bookings/history').then((r) => r.data.data),

  getById: (id: string): Promise<Booking & {
    services: BookingService[]
    amount_debt: number
    payment_dates: { deposit: string | null; final: string | null }
    overdue_days: number
  }> =>
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
