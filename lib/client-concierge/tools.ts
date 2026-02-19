import Anthropic from '@anthropic-ai/sdk'

export const conciergeTools: Anthropic.Messages.Tool[] = [
  {
    name: 'search_hotels',
    description: 'Search for available hotels at a destination for given dates',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'City or destination name' },
        check_in: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
        guests: { type: 'number', description: 'Number of guests' },
        rooms: { type: 'number', description: 'Number of rooms, default 1' },
      },
      required: ['city', 'check_in', 'check_out', 'guests'],
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
    description: "Get the client's upcoming trips from the CRM",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]
