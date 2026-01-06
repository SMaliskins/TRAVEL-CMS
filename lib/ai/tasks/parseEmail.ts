/**
 * AI Task: Parse Email
 * 
 * Извлекает информацию о бронированиях из email:
 * - Подтверждения бронирования
 * - Изменения рейсов
 * - Отмены
 */

import { aiJSON } from "../client";

export interface EmailBookingInfo {
  type: "flight" | "hotel" | "transfer" | "tour" | "other";
  action: "confirmation" | "change" | "cancellation" | "reminder";
  
  // Common
  confirmationNumber?: string;
  supplierName?: string;
  guestName?: string;
  totalPrice?: string;
  currency?: string;
  
  // Flight specific
  flightNumber?: string;
  departure?: string;
  arrival?: string;
  departureDate?: string;
  departureTime?: string;
  
  // Hotel specific
  hotelName?: string;
  checkIn?: string;
  checkOut?: string;
  
  // Transfer specific
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
}

export interface ParseEmailResult {
  success: boolean;
  bookings: EmailBookingInfo[];
  summary?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an email parser for a travel agency CRM.
Extract booking information from email content.

Identify:
1. Type of booking (flight, hotel, transfer, tour, other)
2. Action (confirmation, change, cancellation, reminder)
3. All relevant details

Return JSON:
{
  "bookings": [
    {
      "type": "flight",
      "action": "confirmation",
      "confirmationNumber": "ABC123",
      "supplierName": "Turkish Airlines",
      "guestName": "John Doe",
      "flightNumber": "TK1234",
      "departure": "RIX",
      "arrival": "IST",
      "departureDate": "2026-01-15",
      "departureTime": "08:30",
      "totalPrice": "450.00",
      "currency": "EUR"
    }
  ],
  "summary": "Flight booking confirmation from Turkish Airlines for Jan 15"
}

Dates in YYYY-MM-DD format. Times in HH:mm format.
Extract multiple bookings if email contains several.`;

/**
 * Парсинг email с бронированием
 */
export async function parseEmail(emailContent: string): Promise<ParseEmailResult> {
  const result = await aiJSON<{
    bookings: EmailBookingInfo[];
    summary?: string;
  }>(
    `Parse this booking email:\n\n${emailContent}`,
    SYSTEM_PROMPT
  );

  if (!result.success || !result.data) {
    return { success: false, bookings: [], error: result.error };
  }

  return {
    success: true,
    bookings: result.data.bookings || [],
    summary: result.data.summary,
  };
}

/**
 * Определить тип email
 */
export async function classifyEmail(
  subject: string,
  preview: string
): Promise<{ isBookingRelated: boolean; type?: string }> {
  const result = await aiJSON<{
    isBookingRelated: boolean;
    type?: string;
  }>(
    `Subject: ${subject}\nPreview: ${preview}`,
    `Classify if this email is related to travel bookings.
Return JSON: { "isBookingRelated": true/false, "type": "flight_confirmation" | "hotel_booking" | "change_notification" | "cancellation" | "other" | null }`
  );

  return result.data || { isBookingRelated: false };
}
