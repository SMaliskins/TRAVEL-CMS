/**
 * Airport database utility
 * Uses @nwpr/airport-codes package with 7,698 airports worldwide
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const airportCodesModule = require("@nwpr/airport-codes");
const airportCodes: AirportRaw[] = airportCodesModule.airports || [];

interface AirportRaw {
  id: number;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone: number;
  dst: string;
  tz: string;
  type: string;
  source: string;
}

export interface Airport {
  iata: string;       // 3-letter IATA code (e.g., "LHR")
  icao: string;       // 4-letter ICAO code (e.g., "EGLL")
  name: string;       // Airport name (e.g., "London Heathrow Airport")
  city: string;       // City name (e.g., "London")
  country: string;    // Country name (e.g., "United Kingdom")
  countryCode: string; // 2-letter ISO country code (e.g., "GB")
  latitude: number;
  longitude: number;
  timezone: string;   // Timezone name (e.g., "Europe/London")
}

// Cache for faster lookups
const airportCache = new Map<string, Airport>();

/**
 * Get airport by IATA code
 */
export function getAirportByIata(iataCode: string): Airport | null {
  if (!iataCode) return null;
  
  const code = iataCode.toUpperCase().trim();
  
  // Check cache first
  if (airportCache.has(code)) {
    return airportCache.get(code) || null;
  }
  
  // Search in database
  const airport = airportCodes.find((a) => a.iata === code);
  
  if (airport) {
    const mapped: Airport = {
      iata: airport.iata || "",
      icao: airport.icao || "",
      name: airport.name || "",
      city: airport.city || "",
      country: airport.country || "",
      countryCode: getCountryCode(airport.country) || "",
      latitude: airport.latitude || 0,
      longitude: airport.longitude || 0,
      timezone: airport.tz || "", // Use tz field (timezone name like "Europe/London")
    };
    airportCache.set(code, mapped);
    return mapped;
  }
  
  return null;
}

/**
 * Get country code by IATA airport code
 */
export function getCountryByAirport(iataCode: string): string | null {
  const airport = getAirportByIata(iataCode);
  return airport?.countryCode || null;
}

/**
 * Get city name by IATA airport code
 */
export function getCityByAirport(iataCode: string): string | null {
  const airport = getAirportByIata(iataCode);
  return airport?.city || null;
}

/**
 * Search airports by city name, airport name, or code
 */
export function searchAirports(query: string, limit = 10): Airport[] {
  if (!query || query.length < 2) return [];
  
  const q = query.toLowerCase().trim();
  const results: Airport[] = [];
  
  for (const airport of airportCodes) {
    if (!airport.iata) continue; // Skip airports without IATA code
    
    const matches = 
      airport.iata?.toLowerCase() === q ||
      airport.city?.toLowerCase().includes(q) ||
      airport.name?.toLowerCase().includes(q) ||
      airport.country?.toLowerCase().includes(q);
    
    if (matches) {
      results.push({
        iata: airport.iata || "",
        icao: airport.icao || "",
        name: airport.name || "",
        city: airport.city || "",
        country: airport.country || "",
        countryCode: getCountryCode(airport.country) || "",
        latitude: airport.latitude || 0,
        longitude: airport.longitude || 0,
        timezone: airport.tz || "",
      });
      
      if (results.length >= limit) break;
    }
  }
  
  // Sort: exact IATA match first, then by city name
  return results.sort((a, b) => {
    if (a.iata.toLowerCase() === q) return -1;
    if (b.iata.toLowerCase() === q) return 1;
    return a.city.localeCompare(b.city);
  });
}

/**
 * Country name to ISO code mapping (for common countries)
 */
const countryCodeMap: Record<string, string> = {
  "united kingdom": "GB",
  "united states": "US",
  "france": "FR",
  "germany": "DE",
  "italy": "IT",
  "spain": "ES",
  "netherlands": "NL",
  "belgium": "BE",
  "switzerland": "CH",
  "austria": "AT",
  "portugal": "PT",
  "greece": "GR",
  "turkey": "TR",
  "russia": "RU",
  "ukraine": "UA",
  "poland": "PL",
  "czech republic": "CZ",
  "czechia": "CZ",
  "hungary": "HU",
  "romania": "RO",
  "bulgaria": "BG",
  "croatia": "HR",
  "serbia": "RS",
  "slovenia": "SI",
  "slovakia": "SK",
  "ireland": "IE",
  "denmark": "DK",
  "sweden": "SE",
  "norway": "NO",
  "finland": "FI",
  "iceland": "IS",
  "latvia": "LV",
  "lithuania": "LT",
  "estonia": "EE",
  "cyprus": "CY",
  "malta": "MT",
  "luxembourg": "LU",
  "monaco": "MC",
  "andorra": "AD",
  "montenegro": "ME",
  "albania": "AL",
  "north macedonia": "MK",
  "bosnia and herzegovina": "BA",
  "canada": "CA",
  "mexico": "MX",
  "brazil": "BR",
  "argentina": "AR",
  "chile": "CL",
  "colombia": "CO",
  "peru": "PE",
  "venezuela": "VE",
  "ecuador": "EC",
  "uruguay": "UY",
  "paraguay": "PY",
  "bolivia": "BO",
  "china": "CN",
  "japan": "JP",
  "south korea": "KR",
  "korea, south": "KR",
  "north korea": "KP",
  "taiwan": "TW",
  "hong kong": "HK",
  "macau": "MO",
  "singapore": "SG",
  "malaysia": "MY",
  "indonesia": "ID",
  "thailand": "TH",
  "vietnam": "VN",
  "philippines": "PH",
  "india": "IN",
  "pakistan": "PK",
  "bangladesh": "BD",
  "sri lanka": "LK",
  "nepal": "NP",
  "myanmar": "MM",
  "cambodia": "KH",
  "laos": "LA",
  "mongolia": "MN",
  "australia": "AU",
  "new zealand": "NZ",
  "fiji": "FJ",
  "united arab emirates": "AE",
  "saudi arabia": "SA",
  "qatar": "QA",
  "kuwait": "KW",
  "bahrain": "BH",
  "oman": "OM",
  "israel": "IL",
  "jordan": "JO",
  "lebanon": "LB",
  "syria": "SY",
  "iraq": "IQ",
  "iran": "IR",
  "egypt": "EG",
  "morocco": "MA",
  "tunisia": "TN",
  "algeria": "DZ",
  "libya": "LY",
  "south africa": "ZA",
  "kenya": "KE",
  "nigeria": "NG",
  "ethiopia": "ET",
  "tanzania": "TZ",
  "ghana": "GH",
  "uganda": "UG",
  "mozambique": "MZ",
  "zimbabwe": "ZW",
  "botswana": "BW",
  "namibia": "NA",
  "mauritius": "MU",
  "seychelles": "SC",
  "maldives": "MV",
  "madagascar": "MG",
};

function getCountryCode(countryName: string): string | null {
  if (!countryName) return null;
  return countryCodeMap[countryName.toLowerCase()] || null;
}

/**
 * Validate if IATA code exists
 */
export function isValidIataCode(code: string): boolean {
  return getAirportByIata(code) !== null;
}

/**
 * Get total number of airports in database
 */
export function getAirportCount(): number {
  return airportCodes.length;
}
