/**
 * Airline check-in URLs
 * These are the official online check-in pages for each airline
 */

export interface AirlineCheckinInfo {
  code: string;           // IATA code (e.g., "BA")
  name: string;           // Full name
  checkinUrl: string;     // Check-in page URL
  checkinHoursBefore: number; // How many hours before departure check-in opens
  checkinHoursClose: number;  // How many hours before departure check-in closes
}

export const AIRLINE_CHECKIN: Record<string, AirlineCheckinInfo> = {
  // British Airways
  BA: {
    code: "BA",
    name: "British Airways",
    checkinUrl: "https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb/",
    checkinHoursBefore: 24,
    checkinHoursClose: 1,
  },
  // Lufthansa
  LH: {
    code: "LH",
    name: "Lufthansa",
    checkinUrl: "https://www.lufthansa.com/online-check-in",
    checkinHoursBefore: 23,
    checkinHoursClose: 1,
  },
  // Air France
  AF: {
    code: "AF",
    name: "Air France",
    checkinUrl: "https://wwws.airfrance.fr/en/check-in/overview",
    checkinHoursBefore: 30,
    checkinHoursClose: 1,
  },
  // KLM
  KL: {
    code: "KL",
    name: "KLM",
    checkinUrl: "https://www.klm.com/check-in",
    checkinHoursBefore: 30,
    checkinHoursClose: 1,
  },
  // airBaltic
  BT: {
    code: "BT",
    name: "airBaltic",
    checkinUrl: "https://www.airbaltic.com/en/online-check-in",
    checkinHoursBefore: 72,
    checkinHoursClose: 1,
  },
  // LOT Polish Airlines
  LO: {
    code: "LO",
    name: "LOT Polish Airlines",
    checkinUrl: "https://www.lot.com/online-check-in",
    checkinHoursBefore: 24,
    checkinHoursClose: 1,
  },
  // Finnair
  AY: {
    code: "AY",
    name: "Finnair",
    checkinUrl: "https://www.finnair.com/check-in",
    checkinHoursBefore: 36,
    checkinHoursClose: 1,
  },
  // SAS Scandinavian
  SK: {
    code: "SK",
    name: "SAS",
    checkinUrl: "https://www.flysas.com/en/check-in",
    checkinHoursBefore: 22,
    checkinHoursClose: 1,
  },
  // flydubai
  FZ: {
    code: "FZ",
    name: "flydubai",
    checkinUrl: "https://www.flydubai.com/en/plan/check-in",
    checkinHoursBefore: 48,
    checkinHoursClose: 4,
  },
  // Emirates
  EK: {
    code: "EK",
    name: "Emirates",
    checkinUrl: "https://www.emirates.com/english/manage-booking/online-check-in/",
    checkinHoursBefore: 48,
    checkinHoursClose: 1.5,
  },
  // Turkish Airlines
  TK: {
    code: "TK",
    name: "Turkish Airlines",
    checkinUrl: "https://www.turkishairlines.com/en-int/any-content/online-check-in/",
    checkinHoursBefore: 24,
    checkinHoursClose: 1,
  },
  // Ryanair
  FR: {
    code: "FR",
    name: "Ryanair",
    checkinUrl: "https://www.ryanair.com/gb/en/check-in",
    checkinHoursBefore: 24, // Was 48 for some fares, now typically 24
    checkinHoursClose: 2,
  },
  // easyJet
  U2: {
    code: "U2",
    name: "easyJet",
    checkinUrl: "https://www.easyjet.com/en/manage-your-bookings/check-in",
    checkinHoursBefore: 720, // 30 days
    checkinHoursClose: 2,
  },
  // Wizz Air
  W6: {
    code: "W6",
    name: "Wizz Air",
    checkinUrl: "https://wizzair.com/en-gb/information-and-services/booking-information/check-in",
    checkinHoursBefore: 48,
    checkinHoursClose: 3,
  },
  // Swiss
  LX: {
    code: "LX",
    name: "Swiss",
    checkinUrl: "https://www.swiss.com/online-check-in",
    checkinHoursBefore: 23,
    checkinHoursClose: 1,
  },
  // Austrian
  OS: {
    code: "OS",
    name: "Austrian",
    checkinUrl: "https://www.austrian.com/at/en/online-check-in",
    checkinHoursBefore: 47,
    checkinHoursClose: 1,
  },
  // Iberia
  IB: {
    code: "IB",
    name: "Iberia",
    checkinUrl: "https://www.iberia.com/check-in/",
    checkinHoursBefore: 24,
    checkinHoursClose: 1,
  },
  // Vueling
  VY: {
    code: "VY",
    name: "Vueling",
    checkinUrl: "https://www.vueling.com/en/your-booking/check-in-online",
    checkinHoursBefore: 168, // 7 days
    checkinHoursClose: 4,
  },
  // Qatar Airways
  QR: {
    code: "QR",
    name: "Qatar Airways",
    checkinUrl: "https://www.qatarairways.com/en/online-check-in.html",
    checkinHoursBefore: 48,
    checkinHoursClose: 1.5,
  },
  // Etihad
  EY: {
    code: "EY",
    name: "Etihad",
    checkinUrl: "https://www.etihad.com/en/manage/check-in",
    checkinHoursBefore: 24,
    checkinHoursClose: 1.5,
  },
  // Norwegian
  DY: {
    code: "DY",
    name: "Norwegian",
    checkinUrl: "https://www.norwegian.com/check-in",
    checkinHoursBefore: 24,
    checkinHoursClose: 0.5,
  },
  // Aer Lingus
  EI: {
    code: "EI",
    name: "Aer Lingus",
    checkinUrl: "https://www.aerlingus.com/manage-trip/check-in/",
    checkinHoursBefore: 24,
    checkinHoursClose: 2,
  },
  // TAP Portugal
  TP: {
    code: "TP",
    name: "TAP Portugal",
    checkinUrl: "https://www.flytap.com/en-us/check-in-online",
    checkinHoursBefore: 36,
    checkinHoursClose: 1,
  },
  // Aegean
  A3: {
    code: "A3",
    name: "Aegean Airlines",
    checkinUrl: "https://en.aegeanair.com/plan/web-check-in/",
    checkinHoursBefore: 48,
    checkinHoursClose: 1,
  },
};

/**
 * Get check-in URL for an airline by flight number or airline code
 */
export function getCheckinUrl(airlineCodeOrFlightNumber: string): string | null {
  // Extract airline code from flight number (e.g., "BA123" -> "BA")
  const match = airlineCodeOrFlightNumber.match(/^([A-Z]{2})/i);
  const code = match ? match[1].toUpperCase() : airlineCodeOrFlightNumber.toUpperCase();
  
  return AIRLINE_CHECKIN[code]?.checkinUrl || null;
}

/**
 * Get airline info by code
 */
export function getAirlineCheckinInfo(code: string): AirlineCheckinInfo | null {
  return AIRLINE_CHECKIN[code.toUpperCase()] || null;
}

/**
 * Check if online check-in is available for a flight
 */
export function isCheckinAvailable(flightNumber: string, departureDateTime: Date): boolean {
  const match = flightNumber.match(/^([A-Z]{2})/i);
  if (!match) return false;
  
  const info = AIRLINE_CHECKIN[match[1].toUpperCase()];
  if (!info) return false;
  
  const now = new Date();
  const hoursUntilDeparture = (departureDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilDeparture <= info.checkinHoursBefore && hoursUntilDeparture >= info.checkinHoursClose;
}
