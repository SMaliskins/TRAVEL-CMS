import Anthropic from '@anthropic-ai/sdk'

export const conciergeTools: Anthropic.Messages.Tool[] = [
  {
    name: 'search_hotels',
    description: 'Search for available hotels with real-time pricing via RateHawk. Returns hotel name, star rating, price, meal plan, room type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'City or destination name (e.g. "Antalya", "Paris", "Barcelona")' },
        check_in: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
        guests: { type: 'number', description: 'Number of guests, default 2' },
      },
      required: ['city', 'check_in', 'check_out'],
    },
  },
  {
    name: 'search_transfers',
    description: 'Search for airport or city transfers',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Pickup location (airport code or address)' },
        to: { type: 'string', description: 'Destination address or hotel name' },
        date: { type: 'string', description: 'Transfer date YYYY-MM-DD' },
        time: { type: 'string', description: 'Pickup time HH:MM' },
        passengers: { type: 'number', description: 'Number of passengers' },
      },
      required: ['from', 'to', 'date', 'passengers'],
    },
  },
  {
    name: 'get_client_trips',
    description: "Get the client's upcoming trips from the CRM (basic info: dates, destination, status)",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_trip_itinerary',
    description: "Get full itinerary for a specific trip: flights (airline, flight number, times, airports, cabin class), hotels (name, stars, room, board, check-in/out), transfers, and other services",
    input_schema: {
      type: 'object' as const,
      properties: {
        order_code: { type: 'string', description: 'Order code (e.g. ORD-000123)' },
      },
      required: ['order_code'],
    },
  },
]
