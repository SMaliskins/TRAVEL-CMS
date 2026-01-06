/**
 * AI Task: Parse Document
 * 
 * Извлекает структурированные данные из документов:
 * - Паспорта
 * - Визы
 * - Брони отелей
 * - Страховки
 */

import { aiVision } from "../client";

export interface PassportData {
  type: "passport";
  firstName: string;
  lastName: string;
  nationality: string;
  passportNumber: string;
  dateOfBirth: string;
  expiryDate: string;
  gender: string;
  issuingCountry: string;
}

export interface HotelBookingData {
  type: "hotel_booking";
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  roomType: string;
  confirmationNumber: string;
  totalPrice?: string;
  currency?: string;
}

export interface InsuranceData {
  type: "insurance";
  policyNumber: string;
  insuredName: string;
  coverageStart: string;
  coverageEnd: string;
  destination?: string;
  provider: string;
}

export interface VisaData {
  type: "visa";
  visaType: string;
  country: string;
  holderName: string;
  validFrom: string;
  validUntil: string;
  entries: string; // single, multiple
}

export type ParsedDocument = PassportData | HotelBookingData | InsuranceData | VisaData;

export interface ParseDocumentResult {
  success: boolean;
  documentType?: string;
  data?: ParsedDocument;
  error?: string;
}

const SYSTEM_PROMPT = `You are a document parser for a travel agency CRM.
Analyze the image and extract structured data based on document type.

First identify the document type:
- passport
- hotel_booking
- insurance
- visa

Then extract relevant fields based on type.

Return JSON:
{
  "documentType": "passport" | "hotel_booking" | "insurance" | "visa",
  "data": { ... fields based on type ... }
}

For passport:
{
  "type": "passport",
  "firstName": "John",
  "lastName": "Doe",
  "nationality": "USA",
  "passportNumber": "AB1234567",
  "dateOfBirth": "1990-05-15",
  "expiryDate": "2030-05-14",
  "gender": "M",
  "issuingCountry": "USA"
}

For hotel_booking:
{
  "type": "hotel_booking",
  "hotelName": "Grand Hotel Rome",
  "address": "Via Roma 123, Rome, Italy",
  "checkIn": "2026-01-10",
  "checkOut": "2026-01-15",
  "guestName": "John Doe",
  "roomType": "Deluxe Double",
  "confirmationNumber": "HB123456",
  "totalPrice": "850.00",
  "currency": "EUR"
}

Dates in YYYY-MM-DD format. Leave empty string for unknown values.`;

/**
 * Парсинг документа из изображения
 */
export async function parseDocument(
  imageBase64: string,
  mimeType: string
): Promise<ParseDocumentResult> {
  const result = await aiVision(
    imageBase64,
    mimeType,
    "Identify the document type and extract all relevant information. Return JSON only.",
    SYSTEM_PROMPT
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  try {
    const jsonMatch = result.content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      documentType: parsed.documentType,
      data: parsed.data,
    };
  } catch (err) {
    return { success: false, error: "Failed to parse response" };
  }
}
