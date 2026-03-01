/**
 * Smart Hints Generator for Travel Services
 * 
 * Analyzes services in an order and generates intelligent suggestions
 * for missing services or potential issues.
 */

export interface SmartHint {
  id: string;
  type: 'warning' | 'suggestion' | 'question';
  category: 'transfer' | 'visa' | 'insurance' | 'connection' | 'upgrade' | 'seats' | 'meals' | 'linked_services';
  message: string;
  priority: number; // 1 = high, 2 = medium, 3 = low
  action?: {
    label: string;
    serviceCategory?: string; // For quick service creation
    prefillData?: Record<string, unknown>;
    editServiceId?: string; // Open edit modal for this service (e.g. to link services)
  };
  afterServiceId: string; // Show after this service
  relatedServiceIds?: string[]; // Services this hint relates to
  dismissed?: boolean;
}

export interface FlightSegment {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  departureDate: string;
  departureTimeScheduled: string;
  arrivalDate: string;
  arrivalTimeScheduled: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
}

export interface ServiceForHint {
  id: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  name: string;
  resStatus: string;
  flightSegments?: FlightSegment[];
  transferRoutes?: { linkedFlightId?: string }[];
}

type OrderSource = 'TA' | 'TO' | 'CORP' | 'NON';

/**
 * Countries that typically require visas for EU citizens
 * This is a simplified list - in production would use a proper API
 */
const VISA_REQUIRED_COUNTRIES = new Set([
  'Russia', 'China', 'India', 'Vietnam', 'Australia', 'USA', 'Canada',
  'Brazil', 'Cuba', 'Saudi Arabia', 'Iran', 'Egypt', 'Kenya', 'Tanzania',
  'Myanmar', 'Cambodia', 'Indonesia', 'Sri Lanka', 'Nepal', 'Mongolia',
]);

/**
 * Parse destination countries from service names (simplified)
 */
function extractCountryFromServiceName(name: string): string | null {
  // Common patterns: "Flight to Paris, France", "Hotel in Rome, Italy"
  const patterns = [
    /(?:to|in|at)\s+[\w\s]+,\s+(\w+)/i,
    /\b(France|Italy|Spain|Germany|UK|USA|Japan|China|India|Thailand|Vietnam|Egypt|Morocco|Turkey|Greece|Portugal|Netherlands|Belgium|Austria|Switzerland|Czech Republic|Poland|Hungary|Croatia|Slovenia|Montenegro|Albania|Serbia|North Macedonia|Bulgaria|Romania|Moldova|Ukraine|Belarus|Russia|Georgia|Armenia|Azerbaijan|Kazakhstan|Uzbekistan|Tajikistan|Kyrgyzstan|Turkmenistan|Afghanistan|Pakistan|Nepal|Bhutan|Bangladesh|Myanmar|Laos|Cambodia|Malaysia|Singapore|Indonesia|Philippines|Taiwan|South Korea|North Korea|Mongolia|Australia|New Zealand|Fiji|Papua New Guinea|Samoa|Tonga|Vanuatu|Solomon Islands|Micronesia|Palau|Marshall Islands|Kiribati|Tuvalu|Nauru|Canada|Mexico|Guatemala|Belize|Honduras|El Salvador|Nicaragua|Costa Rica|Panama|Colombia|Venezuela|Ecuador|Peru|Bolivia|Chile|Argentina|Uruguay|Paraguay|Brazil|Guyana|Suriname|French Guiana|Cuba|Jamaica|Haiti|Dominican Republic|Puerto Rico|Bahamas|Trinidad and Tobago|Barbados|Saint Lucia|Grenada|Saint Vincent|Antigua|Dominica|Saint Kitts|Morocco|Algeria|Tunisia|Libya|Egypt|Sudan|South Sudan|Ethiopia|Eritrea|Djibouti|Somalia|Kenya|Uganda|Rwanda|Burundi|Tanzania|Mozambique|Madagascar|Mauritius|Seychelles|Comoros|Malawi|Zambia|Zimbabwe|Botswana|Namibia|South Africa|Lesotho|Eswatini|Angola|Democratic Republic of the Congo|Republic of the Congo|Gabon|Equatorial Guinea|Cameroon|Central African Republic|Chad|Niger|Nigeria|Benin|Togo|Ghana|Ivory Coast|Liberia|Sierra Leone|Guinea|Guinea-Bissau|Senegal|Gambia|Mauritania|Mali|Burkina Faso|Cape Verde|Sao Tome|Saudi Arabia|Yemen|Oman|UAE|Qatar|Bahrain|Kuwait|Iraq|Syria|Lebanon|Jordan|Israel|Palestine|Cyprus|Iran)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Check if two dates are consecutive (within 1 day)
 */
function areDatesConsecutive(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffDays = Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 1;
}

/**
 * Calculate connection time in minutes between two flight segments
 * Returns null if segments are not connected (different airports or dates don't match)
 */
function calculateConnectionTime(
  lastSegment: FlightSegment,
  firstSegment: FlightSegment
): number | null {
  // Check if segments are connected (arrival airport matches departure airport)
  if (lastSegment.arrival !== firstSegment.departure) {
    return null; // Not a connection
  }
  
  // Parse dates and times
  const lastArrivalDate = lastSegment.arrivalDate;
  const lastArrivalTime = lastSegment.arrivalTimeScheduled;
  const firstDepartureDate = firstSegment.departureDate;
  const firstDepartureTime = firstSegment.departureTimeScheduled;
  
  if (!lastArrivalDate || !lastArrivalTime || !firstDepartureDate || !firstDepartureTime) {
    return null; // Missing time data
  }
  
  // Parse time strings (HH:mm)
  const [lastArrH, lastArrM] = lastArrivalTime.split(':').map(Number);
  const [firstDepH, firstDepM] = firstDepartureTime.split(':').map(Number);
  
  // Create Date objects
  const lastArrival = new Date(`${lastArrivalDate}T${lastArrivalTime}:00`);
  const firstDeparture = new Date(`${firstDepartureDate}T${firstDepartureTime}:00`);
  
  // Calculate difference in minutes
  const diffMinutes = (firstDeparture.getTime() - lastArrival.getTime()) / (1000 * 60);
  
  // If negative, it might be next day connection (shouldn't happen for same-day connections)
  // Return null if time difference is negative (invalid connection)
  if (diffMinutes < 0) {
    return null;
  }
  
  return diffMinutes;
}

/**
 * Check if connection time is too short
 * Minimum times:
 * - Domestic/Schengen: 1 hour (60 minutes)
 * - International: 1.5 hours (90 minutes)
 * - Different terminals: +30 minutes
 */
function isConnectionTimeTooShort(
  lastSegment: FlightSegment,
  firstSegment: FlightSegment
): boolean {
  const connectionTime = calculateConnectionTime(lastSegment, firstSegment);
  
  if (connectionTime === null) {
    return false; // Can't determine, don't show warning
  }
  
  // Basic minimum: 60 minutes (1 hour)
  let minimumTime = 60;
  
  // Check if different terminals (add 30 minutes)
  if (lastSegment.arrivalTerminal && firstSegment.departureTerminal &&
      lastSegment.arrivalTerminal !== firstSegment.departureTerminal) {
    minimumTime = 90; // 1.5 hours for terminal change
  }
  
  // For international connections, we could check countries, but for now use 90 minutes
  // This is a simplified check - in production would use airport data
  
  return connectionTime < minimumTime;
}

/**
 * Main function to generate smart hints based on services and order type
 */
export function generateSmartHints(
  services: ServiceForHint[],
  orderSource: OrderSource
): SmartHint[] {
  const hints: SmartHint[] = [];
  
  // Filter out cancelled services
  const activeServices = services.filter(s => s.resStatus !== 'cancelled');
  
  if (activeServices.length === 0) return hints;
  
  // Sort by date
  const sortedServices = [...activeServices].sort((a, b) => 
    new Date(a.dateFrom).getTime() - new Date(b.dateFrom).getTime()
  );
  
  // Find services by category
  const flights = sortedServices.filter(s => s.category === 'Flight');
  const hotels = sortedServices.filter(s => s.category === 'Hotel');
  const transfers = sortedServices.filter(s => s.category === 'Transfer');
  const insurances = sortedServices.filter(s => s.category === 'Insurance');
  const visas = sortedServices.filter(s => s.category === 'Visa');

  // --- LINKED SERVICES HINT ---
  // Transfer exists + flights/hotels exist + transfer routes are not (fully) linked
  for (const transfer of transfers) {
    if (flights.length === 0 && hotels.length === 0) continue;
    const routes = transfer.transferRoutes || [];
    if (routes.length === 0) continue;
    const unlinkedCount = routes.filter(r => !r.linkedFlightId).length;
    if (unlinkedCount > 0) {
      hints.push({
        id: `linked-services-${transfer.id}`,
        type: 'suggestion',
        category: 'linked_services',
        message: 'Potential linked services detected (flight, hotel, or Meet & Greet). We recommend opening the Transfer to link them.',
        priority: 1,
        action: {
          label: 'Open Transfer',
          editServiceId: transfer.id,
        },
        afterServiceId: transfer.id,
        relatedServiceIds: [transfer.id],
      });
      break; // One hint per order for linked services
    }
  }

  // --- TRANSFER HINTS ---
  // Check if there's a flight and hotel but no transfer
  if (flights.length > 0 && hotels.length > 0 && transfers.length === 0) {
    const firstFlight = flights[0];
    const firstHotel = hotels[0];
    
    // Suggest transfer from airport to hotel
    if (areDatesConsecutive(firstFlight.dateTo, firstHotel.dateFrom)) {
      hints.push({
        id: `transfer-arrival-${firstFlight.id}`,
        type: 'suggestion',
        category: 'transfer',
        message: 'How will the client get from the airport to the hotel?',
        priority: 1,
        action: {
          label: 'Add Airport Transfer',
          serviceCategory: 'Transfer',
          prefillData: {
            name: 'Airport → Hotel Transfer',
            dateFrom: firstFlight.dateTo,
            dateTo: firstFlight.dateTo,
          }
        },
        afterServiceId: firstFlight.id,
        relatedServiceIds: [firstFlight.id, firstHotel.id],
      });
    }
    
    // Suggest transfer from hotel to airport (return)
    const lastHotel = hotels[hotels.length - 1];
    const lastFlight = flights[flights.length - 1];
    
    if (flights.length >= 2 && areDatesConsecutive(lastHotel.dateTo, lastFlight.dateFrom)) {
      hints.push({
        id: `transfer-departure-${lastHotel.id}`,
        type: 'suggestion',
        category: 'transfer',
        message: 'How will the client get from the hotel to the airport?',
        priority: 1,
        action: {
          label: 'Add Return Transfer',
          serviceCategory: 'Transfer',
          prefillData: {
            name: 'Hotel → Airport Transfer',
            dateFrom: lastHotel.dateTo,
            dateTo: lastHotel.dateTo,
          }
        },
        afterServiceId: lastHotel.id,
        relatedServiceIds: [lastHotel.id, lastFlight.id],
      });
    }
  }
  
  // --- CONNECTION HINTS ---
  // Check flight connections
  for (let i = 0; i < flights.length - 1; i++) {
    const currentFlight = flights[i];
    const nextFlight = flights[i + 1];
    
    // If flights are on the same day, check connection time
    if (currentFlight.dateTo === nextFlight.dateFrom) {
      // Get flight segments if available
      const currentSegments = currentFlight.flightSegments || [];
      const nextSegments = nextFlight.flightSegments || [];
      
      // Check if we have segment data to calculate connection time
      if (currentSegments.length > 0 && nextSegments.length > 0) {
        const lastSegment = currentSegments[currentSegments.length - 1];
        const firstSegment = nextSegments[0];
        
        const connectionTime = calculateConnectionTime(lastSegment, firstSegment);
        
        // Only show warning if connection time is too short
        if (connectionTime !== null && isConnectionTimeTooShort(lastSegment, firstSegment)) {
          const hours = Math.floor(connectionTime / 60);
          const minutes = connectionTime % 60;
          const timeStr = hours > 0 
            ? `${hours}h ${minutes}m` 
            : `${minutes}m`;
          
          hints.push({
            id: `connection-${currentFlight.id}-${nextFlight.id}`,
            type: 'warning',
            category: 'connection',
            message: `Short connection time: ${timeStr} between flights. Is this enough?`,
            priority: 1, // High priority for short connections
            action: {
              label: 'Add Meet & Greet',
              serviceCategory: 'Other',
              prefillData: {
                name: 'Meet & Greet Service',
                dateFrom: currentFlight.dateTo,
                dateTo: currentFlight.dateTo,
              }
            },
            afterServiceId: currentFlight.id,
            relatedServiceIds: [currentFlight.id, nextFlight.id],
          });
          
          // Suggest Fast Track for short connections
          hints.push({
            id: `fasttrack-${currentFlight.id}`,
            type: 'suggestion',
            category: 'upgrade',
            message: 'Consider Fast Track service for quicker transit',
            priority: 2, // Higher priority for short connections
            action: {
              label: 'Add Fast Track',
              serviceCategory: 'Other',
              prefillData: {
                name: 'Fast Track Airport',
                dateFrom: currentFlight.dateTo,
                dateTo: currentFlight.dateTo,
              }
            },
            afterServiceId: currentFlight.id,
            relatedServiceIds: [currentFlight.id],
          });
        } else if (connectionTime !== null) {
          // Connection time is OK, but still suggest Fast Track as optional upgrade
          hints.push({
            id: `fasttrack-${currentFlight.id}`,
            type: 'suggestion',
            category: 'upgrade',
            message: 'Consider Fast Track service for quicker transit',
            priority: 3,
            action: {
              label: 'Add Fast Track',
              serviceCategory: 'Other',
              prefillData: {
                name: 'Fast Track Airport',
                dateFrom: currentFlight.dateTo,
                dateTo: currentFlight.dateTo,
              }
            },
            afterServiceId: currentFlight.id,
            relatedServiceIds: [currentFlight.id],
          });
        } else {
          // Can't calculate connection time (different airports or missing data)
          // Show general question
          hints.push({
            id: `connection-${currentFlight.id}-${nextFlight.id}`,
            type: 'question',
            category: 'connection',
            message: 'Is there enough time between these connecting flights?',
            priority: 2,
            action: {
              label: 'Add Meet & Greet',
              serviceCategory: 'Other',
              prefillData: {
                name: 'Meet & Greet Service',
                dateFrom: currentFlight.dateTo,
                dateTo: currentFlight.dateTo,
              }
            },
            afterServiceId: currentFlight.id,
            relatedServiceIds: [currentFlight.id, nextFlight.id],
          });
        }
      } else {
        // No segment data available, show general question
        hints.push({
          id: `connection-${currentFlight.id}-${nextFlight.id}`,
          type: 'question',
          category: 'connection',
          message: 'Is there enough time between these connecting flights?',
          priority: 2,
          action: {
            label: 'Add Meet & Greet',
            serviceCategory: 'Other',
            prefillData: {
              name: 'Meet & Greet Service',
              dateFrom: currentFlight.dateTo,
              dateTo: currentFlight.dateTo,
            }
          },
          afterServiceId: currentFlight.id,
          relatedServiceIds: [currentFlight.id, nextFlight.id],
        });
      }
    }
  }
  
  // --- VISA HINTS ---
  // Check if destination requires visa
  if (visas.length === 0) {
    for (const flight of flights) {
      const country = extractCountryFromServiceName(flight.name);
      if (country && VISA_REQUIRED_COUNTRIES.has(country)) {
        hints.push({
          id: `visa-${flight.id}-${country}`,
          type: 'warning',
          category: 'visa',
          message: `Does the client need a visa for ${country}?`,
          priority: 1,
          action: {
            label: 'Add Visa Service',
            serviceCategory: 'Visa',
            prefillData: {
              name: `${country} Visa`,
            }
          },
          afterServiceId: flight.id,
          relatedServiceIds: [flight.id],
        });
        break; // Only show one visa hint
      }
    }
  }
  
  // --- TA-SPECIFIC HINTS (Tour Operator package) ---
  if (orderSource === 'TA') {
    // Insurance check
    if (insurances.length === 0 && sortedServices.length > 0) {
      const lastService = sortedServices[sortedServices.length - 1];
      hints.push({
        id: 'insurance-ta',
        type: 'question',
        category: 'insurance',
        message: 'Is travel insurance included in the tour package?',
        priority: 2,
        action: {
          label: 'Add Insurance',
          serviceCategory: 'Insurance',
        },
        afterServiceId: lastService.id,
      });
    }
    
    // Seats and meals for flights
    if (flights.length > 0) {
      const firstFlight = flights[0];
      hints.push({
        id: 'seats-ta',
        type: 'question',
        category: 'seats',
        message: 'Are specific seats in the airplane selected?',
        priority: 3,
        afterServiceId: firstFlight.id,
        relatedServiceIds: [firstFlight.id],
      });
      
      hints.push({
        id: 'meals-ta',
        type: 'question',
        category: 'meals',
        message: 'Is special meal preference noted?',
        priority: 3,
        afterServiceId: firstFlight.id,
        relatedServiceIds: [firstFlight.id],
      });
    }
    
    // Individual transfer suggestion
    if (transfers.length === 0 && hotels.length > 0) {
      hints.push({
        id: 'individual-transfer-ta',
        type: 'suggestion',
        category: 'transfer',
        message: 'Would the client prefer an individual transfer instead of group transfer?',
        priority: 2,
        action: {
          label: 'Add Individual Transfer',
          serviceCategory: 'Transfer',
        },
        afterServiceId: hotels[0].id,
      });
    }
  }
  
  // --- TO-SPECIFIC HINTS (Travel Organizer - custom packages) ---
  if (orderSource === 'TO') {
    // More aggressive transfer suggestions
    if (flights.length > 0 && hotels.length > 0 && transfers.length === 0) {
      hints[0] = {
        ...hints[0],
        type: 'warning',
        message: 'No transfer booked! How will the client reach the hotel from the airport?',
        priority: 1,
      };
    }
    
    // Insurance is more critical for custom packages
    if (insurances.length === 0 && sortedServices.length > 0) {
      hints.push({
        id: 'insurance-to',
        type: 'warning',
        category: 'insurance',
        message: 'No travel insurance! This is recommended for custom travel packages.',
        priority: 1,
        action: {
          label: 'Add Insurance',
          serviceCategory: 'Insurance',
        },
        afterServiceId: sortedServices[0].id,
      });
    }
  }
  
  // Sort hints by priority
  hints.sort((a, b) => a.priority - b.priority);
  
  return hints;
}

/**
 * Get hint icon based on type
 */
export function getHintIcon(type: SmartHint['type']): string {
  switch (type) {
    case 'warning': return '⚠️';
    case 'suggestion': return '💡';
    case 'question': return '❓';
    default: return '📋';
  }
}

/**
 * Get hint color class based on type
 */
export function getHintColorClass(type: SmartHint['type']): string {
  switch (type) {
    case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'suggestion': return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'question': return 'bg-purple-50 border-purple-200 text-purple-800';
    default: return 'bg-gray-50 border-gray-200 text-gray-800';
  }
}
