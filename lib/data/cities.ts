// Cities database with coordinates and country codes for flags
// Flag emojis are generated from ISO 3166-1 alpha-2 country codes

import { getAirportByIata } from "@/lib/airports";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

export interface City {
  name: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
  iataCode?: string; // Airport code if applicable
}

// ISO 3166-1 alpha-2 to country name (for "XX City" format parsing)
export const ISO_TO_COUNTRY: Record<string, string> = {
  TR: "Turkey", BG: "Bulgaria", UZ: "Uzbekistan", SE: "Sweden", LV: "Latvia",
  ES: "Spain", EG: "Egypt", IT: "Italy", FR: "France", DE: "Germany", AE: "UAE",
  GR: "Greece", PT: "Portugal", NL: "Netherlands", CH: "Switzerland", AT: "Austria",
  CZ: "Czech Republic", BE: "Belgium", TH: "Thailand", MV: "Maldives", HR: "Croatia",
  ME: "Montenegro", CY: "Cyprus", MA: "Morocco", TN: "Tunisia", LK: "Sri Lanka",
  ID: "Indonesia", MX: "Mexico", DO: "Dominican Republic", CU: "Cuba", US: "USA",
  IN: "India", JP: "Japan", CN: "China", KR: "South Korea", AU: "Australia",
  NZ: "New Zealand", BR: "Brazil", AR: "Argentina", CA: "Canada", NO: "Norway",
  FI: "Finland", DK: "Denmark", IS: "Iceland", IE: "Ireland", PL: "Poland",
  HU: "Hungary", RO: "Romania", GE: "Georgia", AM: "Armenia", AZ: "Azerbaijan",
  IL: "Israel", JO: "Jordan", OM: "Oman", QA: "Qatar", BH: "Bahrain", SA: "Saudi Arabia",
  KW: "Kuwait", TZ: "Tanzania", KE: "Kenya", ZA: "South Africa", MU: "Mauritius",
  SC: "Seychelles", MT: "Malta", EE: "Estonia", LT: "Lithuania", SG: "Singapore",
  MY: "Malaysia", VN: "Vietnam", PH: "Philippines", KH: "Cambodia", KZ: "Kazakhstan",
  KG: "Kyrgyzstan", TJ: "Tajikistan", TM: "Turkmenistan", GB: "United Kingdom",
};

// Reverse map: country name -> ISO code (for "City, Country" format when getCityByName fails)
export const COUNTRY_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(ISO_TO_COUNTRY).map(([iso, name]) => [name, iso])
);

// Convert ISO country code to flag emoji
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Extended cities loaded from /data/world-cities.json (all countries' cities)
let worldCitiesCache: City[] | null = null;
let customCitiesCache: City[] = [];

function normalizeCityNameForKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Load extended world cities from public data + custom cities from DB */
export async function loadWorldCities(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (!worldCitiesCache) {
    promises.push(
      fetch("/data/world-cities.json")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: City[]) => { worldCitiesCache = data; })
        .catch(() => {})
    );
  }

  if (customCitiesCache.length === 0) {
    promises.push(
      fetchWithAuth("/api/geo/cities-cache")
        .then((res) => (res.ok ? res.json() : { cities: [] }))
        .then((data: { cities: City[] }) => { customCitiesCache = data.cities || []; })
        .catch(() => {})
    );
  }

  await Promise.all(promises);
}

let worldCitiesEnsurePromise: Promise<void> | null = null;

/** Deduplicate concurrent loads; safe to call from many components. */
export function ensureWorldCitiesLoaded(): Promise<void> {
  if (worldCitiesEnsurePromise) return worldCitiesEnsurePromise;
  worldCitiesEnsurePromise = loadWorldCities().finally(() => {
    worldCitiesEnsurePromise = null;
  });
  return worldCitiesEnsurePromise;
}

function getAllCities(): City[] {
  const existingKeys = new Set(
    CITIES.map((c) => `${normalizeCityNameForKey(c.name)}|${(c.countryCode || "").toUpperCase()}`)
  );
  const result = [...CITIES];

  for (const c of customCitiesCache) {
    const key = `${normalizeCityNameForKey(c.name)}|${(c.countryCode || "").toUpperCase()}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      result.push(c);
    }
  }

  if (worldCitiesCache) {
    for (const w of worldCitiesCache) {
      const key = `${normalizeCityNameForKey(w.name)}|${(w.countryCode || "").toUpperCase()}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        result.push(w);
      }
    }
  }

  return result;
}

// Popular travel destinations with coordinates (always available)
export const CITIES: City[] = [
  // Italy
  { name: "Rome", country: "Italy", countryCode: "IT", lat: 41.9028, lng: 12.4964, iataCode: "FCO" },
  { name: "Milan", country: "Italy", countryCode: "IT", lat: 45.4642, lng: 9.1900, iataCode: "MXP" },
  { name: "Venice", country: "Italy", countryCode: "IT", lat: 45.4408, lng: 12.3155, iataCode: "VCE" },
  { name: "Florence", country: "Italy", countryCode: "IT", lat: 43.7696, lng: 11.2558, iataCode: "FLR" },
  { name: "Naples", country: "Italy", countryCode: "IT", lat: 40.8518, lng: 14.2681, iataCode: "NAP" },
  { name: "Turin", country: "Italy", countryCode: "IT", lat: 45.0703, lng: 7.6869, iataCode: "TRN" },
  { name: "Bologna", country: "Italy", countryCode: "IT", lat: 44.4949, lng: 11.3426, iataCode: "BLQ" },
  { name: "Palermo", country: "Italy", countryCode: "IT", lat: 38.1157, lng: 13.3615, iataCode: "PMO" },
  { name: "Amalfi", country: "Italy", countryCode: "IT", lat: 40.6340, lng: 14.6027 },
  { name: "Positano", country: "Italy", countryCode: "IT", lat: 40.6281, lng: 14.4850 },
  { name: "Sorrento", country: "Italy", countryCode: "IT", lat: 40.6263, lng: 14.3758 },
  { name: "Capri", country: "Italy", countryCode: "IT", lat: 40.5507, lng: 14.2222 },
  { name: "Sardinia", country: "Italy", countryCode: "IT", lat: 39.2238, lng: 9.1217, iataCode: "CAG" },
  { name: "Catania", country: "Italy", countryCode: "IT", lat: 37.5079, lng: 15.0830, iataCode: "CTA" },
  { name: "Verona", country: "Italy", countryCode: "IT", lat: 45.4384, lng: 10.9916, iataCode: "VRN" },
  { name: "Pisa", country: "Italy", countryCode: "IT", lat: 43.7228, lng: 10.4017, iataCode: "PSA" },
  { name: "Genoa", country: "Italy", countryCode: "IT", lat: 44.4056, lng: 8.9463, iataCode: "GOA" },
  { name: "Rimini", country: "Italy", countryCode: "IT", lat: 44.0593, lng: 12.5653, iataCode: "RMI" },
  { name: "Como", country: "Italy", countryCode: "IT", lat: 45.8081, lng: 9.0852 },
  { name: "Taormina", country: "Italy", countryCode: "IT", lat: 37.8526, lng: 15.2866 },
  { name: "Siena", country: "Italy", countryCode: "IT", lat: 43.3188, lng: 11.3308 },
  { name: "Bari", country: "Italy", countryCode: "IT", lat: 41.1171, lng: 16.8719, iataCode: "BRI" },
  
  // France
  { name: "Paris", country: "France", countryCode: "FR", lat: 48.8566, lng: 2.3522, iataCode: "CDG" },
  { name: "Lyon", country: "France", countryCode: "FR", lat: 45.7640, lng: 4.8357, iataCode: "LYS" },
  { name: "Marseille", country: "France", countryCode: "FR", lat: 43.2965, lng: 5.3698, iataCode: "MRS" },
  { name: "Nice", country: "France", countryCode: "FR", lat: 43.7102, lng: 7.2620, iataCode: "NCE" },
  { name: "Cannes", country: "France", countryCode: "FR", lat: 43.5528, lng: 7.0174 },
  { name: "Antibes", country: "France", countryCode: "FR", lat: 43.5808, lng: 7.1239 },
  { name: "Saint-Tropez", country: "France", countryCode: "FR", lat: 43.2727, lng: 6.6406 },
  { name: "Monaco", country: "Monaco", countryCode: "MC", lat: 43.7384, lng: 7.4246 },
  { name: "Bordeaux", country: "France", countryCode: "FR", lat: 44.8378, lng: -0.5792, iataCode: "BOD" },
  { name: "Toulouse", country: "France", countryCode: "FR", lat: 43.6047, lng: 1.4442, iataCode: "TLS" },
  { name: "Strasbourg", country: "France", countryCode: "FR", lat: 48.5734, lng: 7.7521, iataCode: "SXB" },
  { name: "Montpellier", country: "France", countryCode: "FR", lat: 43.6108, lng: 3.8767, iataCode: "MPL" },
  { name: "Biarritz", country: "France", countryCode: "FR", lat: 43.4832, lng: -1.5586, iataCode: "BIQ" },
  { name: "Ajaccio", country: "France", countryCode: "FR", lat: 41.9192, lng: 8.7386, iataCode: "AJA" },
  { name: "Avignon", country: "France", countryCode: "FR", lat: 43.9493, lng: 4.8055 },
  { name: "Chamonix", country: "France", countryCode: "FR", lat: 45.9237, lng: 6.8694 },
  { name: "Courchevel", country: "France", countryCode: "FR", lat: 45.4154, lng: 6.6347 },
  
  // Spain
  { name: "Barcelona", country: "Spain", countryCode: "ES", lat: 41.3851, lng: 2.1734, iataCode: "BCN" },
  { name: "Madrid", country: "Spain", countryCode: "ES", lat: 40.4168, lng: -3.7038, iataCode: "MAD" },
  { name: "Seville", country: "Spain", countryCode: "ES", lat: 37.3891, lng: -5.9845, iataCode: "SVQ" },
  { name: "Valencia", country: "Spain", countryCode: "ES", lat: 39.4699, lng: -0.3763, iataCode: "VLC" },
  { name: "Malaga", country: "Spain", countryCode: "ES", lat: 36.7213, lng: -4.4214, iataCode: "AGP" },
  { name: "Palma de Mallorca", country: "Spain", countryCode: "ES", lat: 39.5696, lng: 2.6502, iataCode: "PMI" },
  { name: "Ibiza", country: "Spain", countryCode: "ES", lat: 38.9067, lng: 1.4206, iataCode: "IBZ" },
  { name: "Tenerife", country: "Spain", countryCode: "ES", lat: 28.2916, lng: -16.6291, iataCode: "TFS" },
  { name: "Gran Canaria", country: "Spain", countryCode: "ES", lat: 27.9202, lng: -15.3876, iataCode: "LPA" },
  { name: "Lanzarote", country: "Spain", countryCode: "ES", lat: 28.9638, lng: -13.5464, iataCode: "ACE" },
  { name: "Fuerteventura", country: "Spain", countryCode: "ES", lat: 28.3587, lng: -14.0537, iataCode: "FUE" },
  { name: "Marbella", country: "Spain", countryCode: "ES", lat: 36.5109, lng: -4.8826 },
  { name: "San Sebastian", country: "Spain", countryCode: "ES", lat: 43.3183, lng: -1.9812, iataCode: "EAS" },
  { name: "Alicante", country: "Spain", countryCode: "ES", lat: 38.3452, lng: -0.4810, iataCode: "ALC" },
  { name: "Bilbao", country: "Spain", countryCode: "ES", lat: 43.2630, lng: -2.9350, iataCode: "BIO" },
  { name: "Menorca", country: "Spain", countryCode: "ES", lat: 39.9496, lng: 4.1105, iataCode: "MAH" },
  
  // United Kingdom
  { name: "London", country: "United Kingdom", countryCode: "GB", lat: 51.5074, lng: -0.1278, iataCode: "LHR" },
  { name: "Edinburgh", country: "United Kingdom", countryCode: "GB", lat: 55.9533, lng: -3.1883, iataCode: "EDI" },
  { name: "Manchester", country: "United Kingdom", countryCode: "GB", lat: 53.4808, lng: -2.2426, iataCode: "MAN" },
  { name: "Liverpool", country: "United Kingdom", countryCode: "GB", lat: 53.4084, lng: -2.9916, iataCode: "LPL" },
  { name: "Glasgow", country: "United Kingdom", countryCode: "GB", lat: 55.8642, lng: -4.2518, iataCode: "GLA" },
  
  // Germany
  { name: "Berlin", country: "Germany", countryCode: "DE", lat: 52.5200, lng: 13.4050, iataCode: "BER" },
  { name: "Munich", country: "Germany", countryCode: "DE", lat: 48.1351, lng: 11.5820, iataCode: "MUC" },
  { name: "Hamburg", country: "Germany", countryCode: "DE", lat: 53.5511, lng: 9.9937, iataCode: "HAM" },
  { name: "Frankfurt", country: "Germany", countryCode: "DE", lat: 50.1109, lng: 8.6821, iataCode: "FRA" },
  { name: "Cologne", country: "Germany", countryCode: "DE", lat: 50.9375, lng: 6.9603, iataCode: "CGN" },
  { name: "Dusseldorf", country: "Germany", countryCode: "DE", lat: 51.2277, lng: 6.7735, iataCode: "DUS" },
  
  // Netherlands
  { name: "Amsterdam", country: "Netherlands", countryCode: "NL", lat: 52.3676, lng: 4.9041, iataCode: "AMS" },
  { name: "Rotterdam", country: "Netherlands", countryCode: "NL", lat: 51.9244, lng: 4.4777, iataCode: "RTM" },
  
  // Belgium
  { name: "Brussels", country: "Belgium", countryCode: "BE", lat: 50.8503, lng: 4.3517, iataCode: "BRU" },
  { name: "Bruges", country: "Belgium", countryCode: "BE", lat: 51.2093, lng: 3.2247 },
  
  // Austria
  { name: "Vienna", country: "Austria", countryCode: "AT", lat: 48.2082, lng: 16.3738, iataCode: "VIE" },
  { name: "Salzburg", country: "Austria", countryCode: "AT", lat: 47.8095, lng: 13.0550, iataCode: "SZG" },
  { name: "Innsbruck", country: "Austria", countryCode: "AT", lat: 47.2692, lng: 11.4041, iataCode: "INN" },
  
  // Switzerland
  { name: "Zurich", country: "Switzerland", countryCode: "CH", lat: 47.3769, lng: 8.5417, iataCode: "ZRH" },
  { name: "Geneva", country: "Switzerland", countryCode: "CH", lat: 46.2044, lng: 6.1432, iataCode: "GVA" },
  { name: "Bern", country: "Switzerland", countryCode: "CH", lat: 46.9480, lng: 7.4474, iataCode: "BRN" },
  
  // Czech Republic
  { name: "Prague", country: "Czech Republic", countryCode: "CZ", lat: 50.0755, lng: 14.4378, iataCode: "PRG" },
  
  // Poland
  { name: "Warsaw", country: "Poland", countryCode: "PL", lat: 52.2297, lng: 21.0122, iataCode: "WAW" },
  { name: "Krakow", country: "Poland", countryCode: "PL", lat: 50.0647, lng: 19.9450, iataCode: "KRK" },
  { name: "Gdansk", country: "Poland", countryCode: "PL", lat: 54.3520, lng: 18.6466, iataCode: "GDN" },
  
  // Hungary
  { name: "Budapest", country: "Hungary", countryCode: "HU", lat: 47.4979, lng: 19.0402, iataCode: "BUD" },
  
  // Greece
  { name: "Athens", country: "Greece", countryCode: "GR", lat: 37.9838, lng: 23.7275, iataCode: "ATH" },
  { name: "Thessaloniki", country: "Greece", countryCode: "GR", lat: 40.6401, lng: 22.9444, iataCode: "SKG" },
  { name: "Santorini", country: "Greece", countryCode: "GR", lat: 36.3932, lng: 25.4615, iataCode: "JTR" },
  { name: "Mykonos", country: "Greece", countryCode: "GR", lat: 37.4467, lng: 25.3289, iataCode: "JMK" },
  { name: "Rhodes", country: "Greece", countryCode: "GR", lat: 36.4349, lng: 28.2176, iataCode: "RHO" },
  { name: "Crete", country: "Greece", countryCode: "GR", lat: 35.2401, lng: 24.8093, iataCode: "HER" },
  { name: "Corfu", country: "Greece", countryCode: "GR", lat: 39.6243, lng: 19.9217, iataCode: "CFU" },
  { name: "Zakynthos", country: "Greece", countryCode: "GR", lat: 37.7870, lng: 20.8979, iataCode: "ZTH" },
  { name: "Kos", country: "Greece", countryCode: "GR", lat: 36.8935, lng: 27.0914, iataCode: "KGS" },
  { name: "Lefkada", country: "Greece", countryCode: "GR", lat: 38.8337, lng: 20.7069 },
  { name: "Kefalonia", country: "Greece", countryCode: "GR", lat: 38.1794, lng: 20.4894, iataCode: "EFL" },
  { name: "Skiathos", country: "Greece", countryCode: "GR", lat: 39.1617, lng: 23.4918, iataCode: "JSI" },
  { name: "Paros", country: "Greece", countryCode: "GR", lat: 37.0858, lng: 25.1522, iataCode: "PAS" },
  { name: "Naxos", country: "Greece", countryCode: "GR", lat: 37.1036, lng: 25.3762, iataCode: "JNX" },
  { name: "Chania", country: "Greece", countryCode: "GR", lat: 35.5138, lng: 24.0180, iataCode: "CHQ" },
  { name: "Heraklion", country: "Greece", countryCode: "GR", lat: 35.3387, lng: 25.1442, iataCode: "HER" },
  
  // Turkey
  { name: "Istanbul", country: "Turkey", countryCode: "TR", lat: 41.0082, lng: 28.9784, iataCode: "IST" },
  { name: "Antalya", country: "Turkey", countryCode: "TR", lat: 36.8969, lng: 30.7133, iataCode: "AYT" },
  { name: "Kadriye", country: "Turkey", countryCode: "TR", lat: 36.7689, lng: 31.3917 },
  { name: "Bodrum", country: "Turkey", countryCode: "TR", lat: 37.0343, lng: 27.4305, iataCode: "BJV" },
  { name: "Cappadocia", country: "Turkey", countryCode: "TR", lat: 38.6431, lng: 34.8289, iataCode: "NAV" },
  { name: "Fethiye", country: "Turkey", countryCode: "TR", lat: 36.6515, lng: 29.1225 },
  { name: "Marmaris", country: "Turkey", countryCode: "TR", lat: 36.8550, lng: 28.2740 },
  { name: "Kemer", country: "Turkey", countryCode: "TR", lat: 36.5983, lng: 30.5608 },
  { name: "Alanya", country: "Turkey", countryCode: "TR", lat: 36.5437, lng: 31.9994, iataCode: "GZP" },
  { name: "Side", country: "Turkey", countryCode: "TR", lat: 36.7666, lng: 31.3891 },
  { name: "Belek", country: "Turkey", countryCode: "TR", lat: 36.8597, lng: 31.0558 },
  { name: "Kusadasi", country: "Turkey", countryCode: "TR", lat: 37.8579, lng: 27.2610 },
  { name: "Dalaman", country: "Turkey", countryCode: "TR", lat: 36.7668, lng: 28.7959, iataCode: "DLM" },
  { name: "Cesme", country: "Turkey", countryCode: "TR", lat: 38.3236, lng: 26.3030 },
  { name: "Ankara", country: "Turkey", countryCode: "TR", lat: 39.9334, lng: 32.8597, iataCode: "ESB" },
  { name: "Izmir", country: "Turkey", countryCode: "TR", lat: 38.4192, lng: 27.1287, iataCode: "ADB" },
  
  // Portugal
  { name: "Lisbon", country: "Portugal", countryCode: "PT", lat: 38.7223, lng: -9.1393, iataCode: "LIS" },
  { name: "Porto", country: "Portugal", countryCode: "PT", lat: 41.1579, lng: -8.6291, iataCode: "OPO" },
  { name: "Faro", country: "Portugal", countryCode: "PT", lat: 37.0194, lng: -7.9322, iataCode: "FAO" },
  { name: "Madeira", country: "Portugal", countryCode: "PT", lat: 32.6669, lng: -16.9241, iataCode: "FNC" },
  
  // Croatia
  { name: "Dubrovnik", country: "Croatia", countryCode: "HR", lat: 42.6507, lng: 18.0944, iataCode: "DBV" },
  { name: "Split", country: "Croatia", countryCode: "HR", lat: 43.5081, lng: 16.4402, iataCode: "SPU" },
  { name: "Zagreb", country: "Croatia", countryCode: "HR", lat: 45.8150, lng: 15.9819, iataCode: "ZAG" },
  
  // UAE
  { name: "Dubai", country: "United Arab Emirates", countryCode: "AE", lat: 25.2048, lng: 55.2708, iataCode: "DXB" },
  { name: "Abu Dhabi", country: "United Arab Emirates", countryCode: "AE", lat: 24.4539, lng: 54.3773, iataCode: "AUH" },

  // Oman
  { name: "Muscat", country: "Oman", countryCode: "OM", lat: 23.5880, lng: 58.3829, iataCode: "MCT" },
  
  // Thailand
  { name: "Bangkok", country: "Thailand", countryCode: "TH", lat: 13.7563, lng: 100.5018, iataCode: "BKK" },
  { name: "Phuket", country: "Thailand", countryCode: "TH", lat: 7.8804, lng: 98.3923, iataCode: "HKT" },
  { name: "Pattaya", country: "Thailand", countryCode: "TH", lat: 12.9236, lng: 100.8825 },
  { name: "Chiang Mai", country: "Thailand", countryCode: "TH", lat: 18.7883, lng: 98.9853, iataCode: "CNX" },
  
  // Indonesia
  { name: "Bali", country: "Indonesia", countryCode: "ID", lat: -8.3405, lng: 115.0920, iataCode: "DPS" },
  { name: "Jakarta", country: "Indonesia", countryCode: "ID", lat: -6.2088, lng: 106.8456, iataCode: "CGK" },
  
  // Singapore
  { name: "Singapore", country: "Singapore", countryCode: "SG", lat: 1.3521, lng: 103.8198, iataCode: "SIN" },
  
  // Malaysia
  { name: "Kuala Lumpur", country: "Malaysia", countryCode: "MY", lat: 3.1390, lng: 101.6869, iataCode: "KUL" },
  { name: "Langkawi", country: "Malaysia", countryCode: "MY", lat: 6.3500, lng: 99.8000, iataCode: "LGK" },
  
  // Vietnam
  { name: "Ho Chi Minh City", country: "Vietnam", countryCode: "VN", lat: 10.8231, lng: 106.6297, iataCode: "SGN" },
  { name: "Hanoi", country: "Vietnam", countryCode: "VN", lat: 21.0278, lng: 105.8342, iataCode: "HAN" },
  
  // Japan
  { name: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.6762, lng: 139.6503, iataCode: "NRT" },
  { name: "Osaka", country: "Japan", countryCode: "JP", lat: 34.6937, lng: 135.5023, iataCode: "KIX" },
  { name: "Kyoto", country: "Japan", countryCode: "JP", lat: 35.0116, lng: 135.7681 },
  
  // South Korea
  { name: "Seoul", country: "South Korea", countryCode: "KR", lat: 37.5665, lng: 126.9780, iataCode: "ICN" },
  { name: "Busan", country: "South Korea", countryCode: "KR", lat: 35.1796, lng: 129.0756, iataCode: "PUS" },
  
  // China
  { name: "Beijing", country: "China", countryCode: "CN", lat: 39.9042, lng: 116.4074, iataCode: "PEK" },
  { name: "Shanghai", country: "China", countryCode: "CN", lat: 31.2304, lng: 121.4737, iataCode: "PVG" },
  { name: "Hong Kong", country: "China", countryCode: "HK", lat: 22.3193, lng: 114.1694, iataCode: "HKG" },
  
  // India
  { name: "Mumbai", country: "India", countryCode: "IN", lat: 19.0760, lng: 72.8777, iataCode: "BOM" },
  { name: "Delhi", country: "India", countryCode: "IN", lat: 28.7041, lng: 77.1025, iataCode: "DEL" },
  { name: "Goa", country: "India", countryCode: "IN", lat: 15.2993, lng: 74.1240, iataCode: "GOI" },
  
  // Maldives
  { name: "Male", country: "Maldives", countryCode: "MV", lat: 4.1755, lng: 73.5093, iataCode: "MLE" },
  
  // Sri Lanka
  { name: "Colombo", country: "Sri Lanka", countryCode: "LK", lat: 6.9271, lng: 79.8612, iataCode: "CMB" },
  
  // USA
  { name: "New York", country: "United States", countryCode: "US", lat: 40.7128, lng: -74.0060, iataCode: "JFK" },
  { name: "Los Angeles", country: "United States", countryCode: "US", lat: 34.0522, lng: -118.2437, iataCode: "LAX" },
  { name: "Miami", country: "United States", countryCode: "US", lat: 25.7617, lng: -80.1918, iataCode: "MIA" },
  { name: "Las Vegas", country: "United States", countryCode: "US", lat: 36.1699, lng: -115.1398, iataCode: "LAS" },
  { name: "San Francisco", country: "United States", countryCode: "US", lat: 37.7749, lng: -122.4194, iataCode: "SFO" },
  { name: "Chicago", country: "United States", countryCode: "US", lat: 41.8781, lng: -87.6298, iataCode: "ORD" },
  { name: "Orlando", country: "United States", countryCode: "US", lat: 28.5383, lng: -81.3792, iataCode: "MCO" },
  { name: "Washington DC", country: "United States", countryCode: "US", lat: 38.9072, lng: -77.0369, iataCode: "IAD" },
  { name: "Boston", country: "United States", countryCode: "US", lat: 42.3601, lng: -71.0589, iataCode: "BOS" },
  { name: "Seattle", country: "United States", countryCode: "US", lat: 47.6062, lng: -122.3321, iataCode: "SEA" },
  { name: "Honolulu", country: "United States", countryCode: "US", lat: 21.3069, lng: -157.8583, iataCode: "HNL" },
  
  // Canada
  { name: "Toronto", country: "Canada", countryCode: "CA", lat: 43.6532, lng: -79.3832, iataCode: "YYZ" },
  { name: "Vancouver", country: "Canada", countryCode: "CA", lat: 49.2827, lng: -123.1207, iataCode: "YVR" },
  { name: "Montreal", country: "Canada", countryCode: "CA", lat: 45.5017, lng: -73.5673, iataCode: "YUL" },
  
  // Mexico
  { name: "Cancun", country: "Mexico", countryCode: "MX", lat: 21.1619, lng: -86.8515, iataCode: "CUN" },
  { name: "Mexico City", country: "Mexico", countryCode: "MX", lat: 19.4326, lng: -99.1332, iataCode: "MEX" },
  { name: "Los Cabos", country: "Mexico", countryCode: "MX", lat: 22.8905, lng: -109.9167, iataCode: "SJD" },
  
  // Caribbean
  { name: "Havana", country: "Cuba", countryCode: "CU", lat: 23.1136, lng: -82.3666, iataCode: "HAV" },
  { name: "Punta Cana", country: "Dominican Republic", countryCode: "DO", lat: 18.5601, lng: -68.3725, iataCode: "PUJ" },
  { name: "Nassau", country: "Bahamas", countryCode: "BS", lat: 25.0343, lng: -77.3963, iataCode: "NAS" },
  { name: "Aruba", country: "Aruba", countryCode: "AW", lat: 12.5211, lng: -69.9683, iataCode: "AUA" },
  
  // Brazil
  { name: "Rio de Janeiro", country: "Brazil", countryCode: "BR", lat: -22.9068, lng: -43.1729, iataCode: "GIG" },
  { name: "Sao Paulo", country: "Brazil", countryCode: "BR", lat: -23.5505, lng: -46.6333, iataCode: "GRU" },
  
  // Argentina
  { name: "Buenos Aires", country: "Argentina", countryCode: "AR", lat: -34.6037, lng: -58.3816, iataCode: "EZE" },
  
  // Australia
  { name: "Sydney", country: "Australia", countryCode: "AU", lat: -33.8688, lng: 151.2093, iataCode: "SYD" },
  { name: "Melbourne", country: "Australia", countryCode: "AU", lat: -37.8136, lng: 144.9631, iataCode: "MEL" },
  { name: "Brisbane", country: "Australia", countryCode: "AU", lat: -27.4698, lng: 153.0251, iataCode: "BNE" },
  { name: "Perth", country: "Australia", countryCode: "AU", lat: -31.9505, lng: 115.8605, iataCode: "PER" },
  { name: "Gold Coast", country: "Australia", countryCode: "AU", lat: -28.0167, lng: 153.4000, iataCode: "OOL" },
  
  // New Zealand
  { name: "Auckland", country: "New Zealand", countryCode: "NZ", lat: -36.8509, lng: 174.7645, iataCode: "AKL" },
  { name: "Queenstown", country: "New Zealand", countryCode: "NZ", lat: -45.0312, lng: 168.6626, iataCode: "ZQN" },
  
  // South Africa
  { name: "Cape Town", country: "South Africa", countryCode: "ZA", lat: -33.9249, lng: 18.4241, iataCode: "CPT" },
  { name: "Johannesburg", country: "South Africa", countryCode: "ZA", lat: -26.2041, lng: 28.0473, iataCode: "JNB" },
  
  // Egypt
  { name: "Cairo", country: "Egypt", countryCode: "EG", lat: 30.0444, lng: 31.2357, iataCode: "CAI" },
  { name: "Sharm El Sheikh", country: "Egypt", countryCode: "EG", lat: 27.9158, lng: 34.3300, iataCode: "SSH" },
  { name: "Hurghada", country: "Egypt", countryCode: "EG", lat: 27.2579, lng: 33.8116, iataCode: "HRG" },
  
  // Morocco
  { name: "Marrakech", country: "Morocco", countryCode: "MA", lat: 31.6295, lng: -7.9811, iataCode: "RAK" },
  { name: "Casablanca", country: "Morocco", countryCode: "MA", lat: 33.5731, lng: -7.5898, iataCode: "CMN" },
  
  // Kenya
  { name: "Nairobi", country: "Kenya", countryCode: "KE", lat: -1.2921, lng: 36.8219, iataCode: "NBO" },
  { name: "Mombasa", country: "Kenya", countryCode: "KE", lat: -4.0435, lng: 39.6682, iataCode: "MBA" },
  
  // Tanzania
  { name: "Zanzibar", country: "Tanzania", countryCode: "TZ", lat: -6.1659, lng: 39.2026, iataCode: "ZNZ" },
  
  // Mauritius
  { name: "Mauritius", country: "Mauritius", countryCode: "MU", lat: -20.3484, lng: 57.5522, iataCode: "MRU" },
  
  // Seychelles
  { name: "Seychelles", country: "Seychelles", countryCode: "SC", lat: -4.6796, lng: 55.4920, iataCode: "SEZ" },
  
  // Nordic Countries
  { name: "Stockholm", country: "Sweden", countryCode: "SE", lat: 59.3293, lng: 18.0686, iataCode: "ARN" },
  { name: "Copenhagen", country: "Denmark", countryCode: "DK", lat: 55.6761, lng: 12.5683, iataCode: "CPH" },
  { name: "Oslo", country: "Norway", countryCode: "NO", lat: 59.9139, lng: 10.7522, iataCode: "OSL" },
  { name: "Helsinki", country: "Finland", countryCode: "FI", lat: 60.1699, lng: 24.9384, iataCode: "HEL" },
  { name: "Reykjavik", country: "Iceland", countryCode: "IS", lat: 64.1466, lng: -21.9426, iataCode: "KEF" },
  
  // Baltic States
  { name: "Riga", country: "Latvia", countryCode: "LV", lat: 56.9496, lng: 24.1052, iataCode: "RIX" },
  { name: "Tallinn", country: "Estonia", countryCode: "EE", lat: 59.4370, lng: 24.7536, iataCode: "TLL" },
  { name: "Vilnius", country: "Lithuania", countryCode: "LT", lat: 54.6872, lng: 25.2797, iataCode: "VNO" },
  
  // Russia
  { name: "Moscow", country: "Russia", countryCode: "RU", lat: 55.7558, lng: 37.6173, iataCode: "SVO" },
  { name: "St. Petersburg", country: "Russia", countryCode: "RU", lat: 59.9343, lng: 30.3351, iataCode: "LED" },
  
  // Israel
  { name: "Tel Aviv", country: "Israel", countryCode: "IL", lat: 32.0853, lng: 34.7818, iataCode: "TLV" },
  { name: "Jerusalem", country: "Israel", countryCode: "IL", lat: 31.7683, lng: 35.2137 },
  
  // Jordan
  { name: "Amman", country: "Jordan", countryCode: "JO", lat: 31.9454, lng: 35.9284, iataCode: "AMM" },
  { name: "Petra", country: "Jordan", countryCode: "JO", lat: 30.3285, lng: 35.4444 },
  
  // Cyprus
  { name: "Paphos", country: "Cyprus", countryCode: "CY", lat: 34.7720, lng: 32.4297, iataCode: "PFO" },
  { name: "Larnaca", country: "Cyprus", countryCode: "CY", lat: 34.9229, lng: 33.6232, iataCode: "LCA" },
  
  // Malta
  { name: "Malta", country: "Malta", countryCode: "MT", lat: 35.9375, lng: 14.3754, iataCode: "MLA" },
  
  // Montenegro
  { name: "Podgorica", country: "Montenegro", countryCode: "ME", lat: 42.4304, lng: 19.2594, iataCode: "TGD" },
  { name: "Budva", country: "Montenegro", countryCode: "ME", lat: 42.2914, lng: 18.8400 },
  
  // Albania
  { name: "Tirana", country: "Albania", countryCode: "AL", lat: 41.3275, lng: 19.8187, iataCode: "TIA" },
  
  // Slovenia
  { name: "Ljubljana", country: "Slovenia", countryCode: "SI", lat: 46.0569, lng: 14.5058, iataCode: "LJU" },
  { name: "Bled", country: "Slovenia", countryCode: "SI", lat: 46.3683, lng: 14.1146 },
  
  // Slovakia
  { name: "Bratislava", country: "Slovakia", countryCode: "SK", lat: 48.1486, lng: 17.1077, iataCode: "BTS" },
  
  // Romania
  { name: "Bucharest", country: "Romania", countryCode: "RO", lat: 44.4268, lng: 26.1025, iataCode: "OTP" },
  
  // Bulgaria
  { name: "Sofia", country: "Bulgaria", countryCode: "BG", lat: 42.6977, lng: 23.3219, iataCode: "SOF" },
  { name: "Burgas", country: "Bulgaria", countryCode: "BG", lat: 42.5696, lng: 27.5152, iataCode: "BOJ" },
  { name: "Varna", country: "Bulgaria", countryCode: "BG", lat: 43.2141, lng: 27.9147, iataCode: "VAR" },
  
  // Serbia
  { name: "Belgrade", country: "Serbia", countryCode: "RS", lat: 44.7866, lng: 20.4489, iataCode: "BEG" },
  
  // Georgia
  { name: "Tbilisi", country: "Georgia", countryCode: "GE", lat: 41.7151, lng: 44.8271, iataCode: "TBS" },
  { name: "Batumi", country: "Georgia", countryCode: "GE", lat: 41.6168, lng: 41.6367, iataCode: "BUS" },
  
  // Armenia
  { name: "Yerevan", country: "Armenia", countryCode: "AM", lat: 40.1792, lng: 44.4991, iataCode: "EVN" },
  
  // Azerbaijan
  { name: "Baku", country: "Azerbaijan", countryCode: "AZ", lat: 40.4093, lng: 49.8671, iataCode: "GYD" },
  
  // Ukraine
  { name: "Kyiv", country: "Ukraine", countryCode: "UA", lat: 50.4501, lng: 30.5234, iataCode: "KBP" },
  { name: "Lviv", country: "Ukraine", countryCode: "UA", lat: 49.8397, lng: 24.0297, iataCode: "LWO" },
  { name: "Odessa", country: "Ukraine", countryCode: "UA", lat: 46.4825, lng: 30.7233, iataCode: "ODS" },
  
  // Ireland
  { name: "Dublin", country: "Ireland", countryCode: "IE", lat: 53.3498, lng: -6.2603, iataCode: "DUB" },
  
  // Luxembourg
  { name: "Luxembourg", country: "Luxembourg", countryCode: "LU", lat: 49.6116, lng: 6.1319, iataCode: "LUX" },
  
  // Philippines
  { name: "Manila", country: "Philippines", countryCode: "PH", lat: 14.5995, lng: 120.9842, iataCode: "MNL" },
  { name: "Cebu", country: "Philippines", countryCode: "PH", lat: 10.3157, lng: 123.8854, iataCode: "CEB" },
  { name: "Boracay", country: "Philippines", countryCode: "PH", lat: 11.9674, lng: 121.9248, iataCode: "MPH" },
  
  // Cambodia
  { name: "Siem Reap", country: "Cambodia", countryCode: "KH", lat: 13.3671, lng: 103.8448, iataCode: "REP" },
  { name: "Phnom Penh", country: "Cambodia", countryCode: "KH", lat: 11.5564, lng: 104.9282, iataCode: "PNH" },
  
  // Mongolia
  { name: "Ulaanbaatar", country: "Mongolia", countryCode: "MN", lat: 47.8864, lng: 106.9057, iataCode: "ULN" },

  // Nepal
  { name: "Kathmandu", country: "Nepal", countryCode: "NP", lat: 27.7172, lng: 85.3240, iataCode: "KTM" },
  
  // Fiji
  { name: "Fiji", country: "Fiji", countryCode: "FJ", lat: -17.7134, lng: 178.0650, iataCode: "NAN" },
  
  // French Polynesia  
  { name: "Tahiti", country: "French Polynesia", countryCode: "PF", lat: -17.6509, lng: -149.4260, iataCode: "PPT" },
  { name: "Bora Bora", country: "French Polynesia", countryCode: "PF", lat: -16.5004, lng: -151.7415, iataCode: "BOB" },
];

// Legacy export for backwards compatibility
export const POPULAR_CITIES = CITIES;

// Search cities by name or country (uses extended world cities when loaded)
export function searchCities(query: string): City[] {
  if (!query || query.length < 2) return [];
  const lowerQuery = query.toLowerCase();
  return getAllCities()
    .filter(
      (city) =>
        city.name.toLowerCase().includes(lowerQuery) ||
        city.country.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 20);
}

// Get city by IATA (CITIES first, then @nwpr/airport-codes at runtime)
export function getCityByIATA(iataCode: string): City | undefined {
  if (!iataCode) return undefined;
  const code = iataCode.toUpperCase().trim();
  const fromCities = CITIES.find((city) => city.iataCode?.toUpperCase() === code);
  if (fromCities) return fromCities;
  // Runtime fallback: airports database (7,698 airports worldwide)
  const airport = getAirportByIata(code);
  if (airport?.latitude != null && airport?.longitude != null) {
    return {
      name: airport.city || airport.name || code,
      country: airport.country || "",
      countryCode: airport.countryCode || "",
      lat: airport.latitude,
      lng: airport.longitude,
      iataCode: airport.iata || code,
    };
  }
  return undefined;
}

export function getCityByName(name: string): City | undefined {
  if (!name) return undefined;
  return getAllCities().find(
    (city) => city.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Resolve an unknown city via Nominatim API.
 * Validates it's a real place, caches in custom_cities, and adds to local cache.
 * Returns null if the name is not a valid city.
 */
export async function resolveCity(name: string, countryHint?: string): Promise<City | null> {
  if (!name || name.length < 2) return null;
  try {
    const res = await fetchWithAuth("/api/geo/resolve-city", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, countryHint }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.city) return null;
    const city: City = {
      name: data.city.name,
      country: data.city.country,
      countryCode: data.city.countryCode,
      lat: data.city.lat,
      lng: data.city.lng,
    };
    // Add to local cache so subsequent getCityByName calls find it
    const key = `${normalizeCityNameForKey(city.name)}|${city.countryCode.toUpperCase()}`;
    const existing = customCitiesCache.find(
      (c) => `${normalizeCityNameForKey(c.name)}|${c.countryCode.toUpperCase()}` === key
    );
    if (!existing) {
      customCitiesCache.push(city);
    }
    return city;
  } catch {
    return null;
  }
}

// Get all unique countries with flags (uses extended list when loaded)
export function getCountriesWithFlags(): { name: string; code: string; flag: string }[] {
  const countriesMap = new Map<string, { name: string; code: string }>();

  getAllCities().forEach((city) => {
    if (!countriesMap.has(city.countryCode)) {
      countriesMap.set(city.countryCode, {
        name: city.country,
        code: city.countryCode,
      });
    }
  });
  
  return Array.from(countriesMap.values())
    .map((c) => ({
      ...c,
      flag: countryCodeToFlag(c.code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Format city with flag
export function formatCityWithFlag(city: City): string {
  return `${countryCodeToFlag(city.countryCode)} ${city.name}`;
}

// Format city and country with flag
export function formatCityCountryWithFlag(city: City): string {
  return `${countryCodeToFlag(city.countryCode)} ${city.name}, ${city.country}`;
}
