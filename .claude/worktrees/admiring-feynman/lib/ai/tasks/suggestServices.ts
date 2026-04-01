/**
 * AI Task: Suggest Services
 *
 * Automatic service suggestions based on:
 * - Route
 * - Existing services
 * - Historical data
 */

import { aiJSON } from "../client";

export interface ServiceSuggestion {
  category: "flight" | "hotel" | "transfer" | "tour" | "insurance" | "visa";
  name: string;
  reason: string;
  priority: "high" | "medium" | "low";
  estimatedPrice?: string;
  details?: Record<string, string>;
}

export interface SuggestServicesResult {
  success: boolean;
  suggestions: ServiceSuggestion[];
  error?: string;
}

interface OrderContext {
  destinations: string[];
  dateFrom: string;
  dateTo: string;
  existingServices: Array<{
    category: string;
    name: string;
  }>;
  travellersCount: number;
}

const SYSTEM_PROMPT = `You are a travel agency assistant helping to suggest additional services for client trips.

Based on the trip details, suggest relevant services that might be missing or useful.

Consider:
1. If no flights - suggest flights
2. If no hotels - suggest hotels for each destination
3. If no transfers - suggest airport/hotel transfers
4. If destination requires visa - suggest visa service
5. Suggest travel insurance if not present
6. Suggest relevant tours based on destination

Return JSON:
{
  "suggestions": [
    {
      "category": "transfer",
      "name": "Airport Transfer FCO - Hotel",
      "reason": "Client has flight arriving at FCO but no transfer booked",
      "priority": "high",
      "estimatedPrice": "45-60 EUR",
      "details": {
        "from": "FCO Airport",
        "to": "Hotel in Rome"
      }
    }
  ]
}

Prioritize:
- high: Essential missing services
- medium: Recommended additions
- low: Nice to have`;

/**
 * Get service suggestions
 */
export async function suggestServices(
  context: OrderContext
): Promise<SuggestServicesResult> {
  const prompt = `Trip details:
- Destinations: ${context.destinations.join(", ")}
- Dates: ${context.dateFrom} to ${context.dateTo}
- Travellers: ${context.travellersCount}
- Existing services: ${context.existingServices.map(s => `${s.category}: ${s.name}`).join("; ") || "None"}

Suggest additional services for this trip.`;

  const result = await aiJSON<{ suggestions: ServiceSuggestion[] }>(
    prompt,
    SYSTEM_PROMPT
  );

  if (!result.success || !result.data) {
    return { success: false, suggestions: [], error: result.error };
  }

  return {
    success: true,
    suggestions: result.data.suggestions || [],
  };
}

/**
 * Suggest transfer time based on flight
 */
export async function suggestTransferTime(
  flightInfo: {
    type: "arrival" | "departure";
    time: string; // HH:mm
    airport: string;
  },
  destination: string
): Promise<{ suggestedTime: string; note: string }> {
  if (flightInfo.type === "arrival") {
    // +15-30 minutes after landing
    const [hours, minutes] = flightInfo.time.split(":").map(Number);
    const pickupMinutes = minutes + 30;
    const pickupHours = hours + Math.floor(pickupMinutes / 60);
    const finalMinutes = pickupMinutes % 60;
    
    return {
      suggestedTime: `${String(pickupHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`,
      note: `Pickup at ${flightInfo.airport} approximately 30 minutes after landing`,
    };
  } else {
    // -2h 10min before departure
    const [hours, minutes] = flightInfo.time.split(":").map(Number);
    let pickupHours = hours - 2;
    let pickupMinutes = minutes - 10;
    
    if (pickupMinutes < 0) {
      pickupMinutes += 60;
      pickupHours -= 1;
    }
    if (pickupHours < 0) {
      pickupHours += 24;
    }
    
    return {
      suggestedTime: `${String(pickupHours).padStart(2, "0")}:${String(pickupMinutes).padStart(2, "0")}`,
      note: `Pickup to arrive at ${flightInfo.airport} 2h 10min before departure`,
    };
  }
}
