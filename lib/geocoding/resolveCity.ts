/**
 * MAP-01: city resolver with automatic growth.
 *
 * Design constraints (hard requirements from the previous outage):
 *  - Must complete well under the Vercel serverless 10s budget, even when
 *    the dashboard asks about 200+ unique destinations.
 *  - On a cold city_geocache, it must NOT call Nominatim in series for every
 *    miss — that was what timed out last time.
 *
 * Resolution pipeline (fastest → slowest):
 *   1. Batch SELECT city_geocache for every unique (query_norm, country_norm).
 *   2. In-memory LOCALE_ALIASES → canonical English name.
 *   3. In-memory BUILTIN_CITIES coordinate table.
 *   4. Nominatim (OpenStreetMap) — hard cap MAX_NOMINATIM_PER_REQUEST per
 *      request, throttled to 1 call/sec. Unresolved entries fall through to
 *      country-fallback on this request, and get resolved by Nominatim on
 *      later requests (≤ cap again) until the cache is fully warm.
 *   5. COUNTRY_FALLBACK centroid (marker still appears on the country).
 *   6. "unmapped" — recorded so we don't keep pinging Nominatim for the
 *      same miss; next refresh still shows a country-centroid pin.
 *
 * Writes to the cache happen in ONE batch UPSERT at the end of the request.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ResolvedCity {
  lat: number;
  lng: number;
  city: string;
  country: string;
  approximate: boolean;
  source: "builtin" | "alias" | "nominatim" | "manual" | "unmapped" | "country-fallback";
}

export function normalizeCityQuery(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolverCacheKey(city: string, country?: string): string {
  return `${normalizeCityQuery(city)}|${normalizeCityQuery(country || "")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Locale aliases: normalized(lv/ru/…) → canonical English city name.
// ────────────────────────────────────────────────────────────────────────────
const LOCALE_ALIASES: Record<string, string> = {
  // Turkey
  antalija: "Antalya",
  antalja: "Antalya",
  stambula: "Istanbul",
  stambul: "Istanbul",
  // Egypt
  kaira: "Cairo",
  hurgada: "Hurghada",
  "sarm es seiha": "Sharm El Sheikh",
  "sarm el seiha": "Sharm El Sheikh",
  // Spain
  barselona: "Barcelona",
  maljorka: "Palma de Mallorca",
  mallorca: "Palma de Mallorca",
  alikante: "Alicante",
  seviija: "Seville",
  malaga: "Malaga",
  // France
  parize: "Paris",
  nica: "Nice",
  // Italy
  roma: "Rome",
  milana: "Milan",
  venecija: "Venice",
  florencija: "Florence",
  kalabrija: "Calabria",
  // Germany
  minhene: "Munich",
  berline: "Berlin",
  berlina: "Berlin",
  hamburga: "Hamburg",
  // UK / Ireland
  londona: "London",
  dublina: "Dublin",
  // Greece
  atenas: "Athens",
  krita: "Crete",
  kreta: "Crete",
  korfu: "Corfu",
  mikonas: "Mykonos",
  santorini: "Santorini",
  rodosa: "Rhodes",
  peloponese: "Peloponnese",
  peloponesa: "Peloponnese",
  // Austria / CH / CZ
  vene: "Vienna",
  wien: "Vienna",
  praga: "Prague",
  // Portugal
  lisabona: "Lisbon",
  // Balkans / Adriatic
  tivata: "Tivat",
  kotora: "Kotor",
  splita: "Split",
  dubrovnika: "Dubrovnik",
  pula: "Pula",
  // Bulgaria
  burgasa: "Burgas",
  burgas: "Burgas",
  nesebar: "Nesebar",
  sofija: "Sofia",
  // Central / Eastern Europe
  varsava: "Warsaw",
  krakova: "Krakow",
  krakow: "Krakow",
  budapeste: "Budapest",
  // Baltics & neighbours
  riga: "Riga",
  rigas: "Riga",
  tallina: "Tallinn",
  viljnus: "Vilnius",
  // CIS / Caucasus / Central Asia
  tbilisi: "Tbilisi",
  tbilisa: "Tbilisi",
  batumi: "Batumi",
  baku: "Baku",
  jerevana: "Yerevan",
  biskeka: "Bishkek",
  taskenta: "Tashkent",
  taskensa: "Tashkent",
  taskent: "Tashkent",
  tashkent: "Tashkent",
  samarkanda: "Samarkand",
  almaata: "Almaty",
  almaty: "Almaty",
  astana: "Astana",
  ulaanbaatara: "Ulaanbaatar",
  ulanbator: "Ulaanbaatar",
  // Middle East / Africa
  beiruta: "Beirut",
  beirut: "Beirut",
  dubaija: "Dubai",
  abudabi: "Abu Dhabi",
  "abu dabi": "Abu Dhabi",
  doha: "Doha",
  musketa: "Muscat",
  maskate: "Muscat",
  telaviva: "Tel Aviv",
  jeruzaleme: "Jerusalem",
  agadira: "Agadir",
  agadir: "Agadir",
  marakesa: "Marrakech",
  marakesha: "Marrakech",
  casablanka: "Casablanca",
  // Asia
  puketa: "Phuket",
  pukteta: "Phuket",
  "koh samui": "Koh Samui",
  bangkoka: "Bangkok",
  singapura: "Singapore",
  kualalumpur: "Kuala Lumpur",
  nusadua: "Nusa Dua",
  "nusa dua": "Nusa Dua",
  hanoja: "Hanoi",
  hosminiminh: "Ho Chi Minh City",
  deli: "Delhi",
  mumbaja: "Mumbai",
  kolombo: "Colombo",
  pekina: "Beijing",
  sanhaja: "Shanghai",
  tokija: "Tokyo",
  seulas: "Seoul",
  // Americas / Oceania
  "nju jorka": "New York",
  losangdelosa: "Los Angeles",
  majami: "Miami",
  lasvegasa: "Las Vegas",
  vankuvera: "Vancouver",
  meksika: "Mexico City",
  kankunas: "Cancun",
  kanka: "Cancun",
  cancun: "Cancun",
  riodezaneiro: "Rio de Janeiro",
  buenosairesa: "Buenos Aires",
  sidneja: "Sydney",
  // Monaco / micro
  monako: "Monaco",
  montekarlo: "Monte Carlo",
  // Other
  salou: "Salou",
};

// ────────────────────────────────────────────────────────────────────────────
// Built-in coordinates (seed). Used if the cache table has no row yet.
// Keeps the API working offline / if Nominatim is unreachable.
// ────────────────────────────────────────────────────────────────────────────
const BUILTIN_CITIES: Record<string, { lat: number; lng: number; canonical: string; country: string }> = {
  london: { lat: 51.5074, lng: -0.1278, canonical: "London", country: "United Kingdom" },
  paris: { lat: 48.8566, lng: 2.3522, canonical: "Paris", country: "France" },
  rome: { lat: 41.9028, lng: 12.4964, canonical: "Rome", country: "Italy" },
  barcelona: { lat: 41.3874, lng: 2.1686, canonical: "Barcelona", country: "Spain" },
  madrid: { lat: 40.4168, lng: -3.7038, canonical: "Madrid", country: "Spain" },
  "palma de mallorca": { lat: 39.5696, lng: 2.6502, canonical: "Palma de Mallorca", country: "Spain" },
  alicante: { lat: 38.3452, lng: -0.481, canonical: "Alicante", country: "Spain" },
  seville: { lat: 37.3891, lng: -5.9845, canonical: "Seville", country: "Spain" },
  malaga: { lat: 36.7213, lng: -4.4214, canonical: "Malaga", country: "Spain" },
  salou: { lat: 41.0771, lng: 1.1417, canonical: "Salou", country: "Spain" },
  amsterdam: { lat: 52.3676, lng: 4.9041, canonical: "Amsterdam", country: "Netherlands" },
  berlin: { lat: 52.52, lng: 13.405, canonical: "Berlin", country: "Germany" },
  munich: { lat: 48.1351, lng: 11.582, canonical: "Munich", country: "Germany" },
  hamburg: { lat: 53.5511, lng: 9.9937, canonical: "Hamburg", country: "Germany" },
  frankfurt: { lat: 50.1109, lng: 8.6821, canonical: "Frankfurt", country: "Germany" },
  vienna: { lat: 48.2082, lng: 16.3738, canonical: "Vienna", country: "Austria" },
  prague: { lat: 50.0755, lng: 14.4378, canonical: "Prague", country: "Czech Republic" },
  budapest: { lat: 47.4979, lng: 19.0402, canonical: "Budapest", country: "Hungary" },
  warsaw: { lat: 52.2297, lng: 21.0122, canonical: "Warsaw", country: "Poland" },
  krakow: { lat: 50.0647, lng: 19.945, canonical: "Krakow", country: "Poland" },
  bucharest: { lat: 44.4268, lng: 26.1025, canonical: "Bucharest", country: "Romania" },
  sofia: { lat: 42.6977, lng: 23.3219, canonical: "Sofia", country: "Bulgaria" },
  burgas: { lat: 42.5048, lng: 27.4626, canonical: "Burgas", country: "Bulgaria" },
  nesebar: { lat: 42.6591, lng: 27.7229, canonical: "Nesebar", country: "Bulgaria" },
  zagreb: { lat: 45.815, lng: 15.9819, canonical: "Zagreb", country: "Croatia" },
  split: { lat: 43.5081, lng: 16.4402, canonical: "Split", country: "Croatia" },
  dubrovnik: { lat: 42.6507, lng: 18.0944, canonical: "Dubrovnik", country: "Croatia" },
  pula: { lat: 44.8683, lng: 13.8481, canonical: "Pula", country: "Croatia" },
  belgrade: { lat: 44.7866, lng: 20.4489, canonical: "Belgrade", country: "Serbia" },
  tivat: { lat: 42.4314, lng: 18.6963, canonical: "Tivat", country: "Montenegro" },
  kotor: { lat: 42.4247, lng: 18.7712, canonical: "Kotor", country: "Montenegro" },
  budva: { lat: 42.2914, lng: 18.8401, canonical: "Budva", country: "Montenegro" },
  lisbon: { lat: 38.7223, lng: -9.1393, canonical: "Lisbon", country: "Portugal" },
  porto: { lat: 41.1579, lng: -8.6291, canonical: "Porto", country: "Portugal" },
  faro: { lat: 37.0194, lng: -7.9322, canonical: "Faro", country: "Portugal" },
  madeira: { lat: 32.6669, lng: -16.9241, canonical: "Madeira", country: "Portugal" },
  istanbul: { lat: 41.0082, lng: 28.9784, canonical: "Istanbul", country: "Turkey" },
  antalya: { lat: 36.8969, lng: 30.7133, canonical: "Antalya", country: "Turkey" },
  bodrum: { lat: 37.0344, lng: 27.4305, canonical: "Bodrum", country: "Turkey" },
  athens: { lat: 37.9838, lng: 23.7275, canonical: "Athens", country: "Greece" },
  crete: { lat: 35.2401, lng: 24.4709, canonical: "Crete", country: "Greece" },
  corfu: { lat: 39.6243, lng: 19.9217, canonical: "Corfu", country: "Greece" },
  mykonos: { lat: 37.4467, lng: 25.3289, canonical: "Mykonos", country: "Greece" },
  santorini: { lat: 36.3932, lng: 25.4615, canonical: "Santorini", country: "Greece" },
  rhodes: { lat: 36.4349, lng: 28.2176, canonical: "Rhodes", country: "Greece" },
  kos: { lat: 36.8933, lng: 26.9836, canonical: "Kos", country: "Greece" },
  zakynthos: { lat: 37.7872, lng: 20.8983, canonical: "Zakynthos", country: "Greece" },
  peloponnese: { lat: 37.5, lng: 22.5, canonical: "Peloponnese", country: "Greece" },
  milan: { lat: 45.4642, lng: 9.19, canonical: "Milan", country: "Italy" },
  venice: { lat: 45.4408, lng: 12.3155, canonical: "Venice", country: "Italy" },
  florence: { lat: 43.7696, lng: 11.2558, canonical: "Florence", country: "Italy" },
  naples: { lat: 40.8518, lng: 14.2681, canonical: "Naples", country: "Italy" },
  verona: { lat: 45.4384, lng: 10.9916, canonical: "Verona", country: "Italy" },
  rimini: { lat: 44.0678, lng: 12.5695, canonical: "Rimini", country: "Italy" },
  sicily: { lat: 37.5994, lng: 14.0154, canonical: "Sicily", country: "Italy" },
  sardinia: { lat: 40.1209, lng: 9.0129, canonical: "Sardinia", country: "Italy" },
  calabria: { lat: 38.91, lng: 16.59, canonical: "Calabria", country: "Italy" },
  cannes: { lat: 43.5528, lng: 6.9264, canonical: "Cannes", country: "France" },
  nice: { lat: 43.7102, lng: 7.262, canonical: "Nice", country: "France" },
  lyon: { lat: 45.764, lng: 4.8357, canonical: "Lyon", country: "France" },
  marseille: { lat: 43.2965, lng: 5.3698, canonical: "Marseille", country: "France" },
  monaco: { lat: 43.7384, lng: 7.4246, canonical: "Monaco", country: "Monaco" },
  "monte carlo": { lat: 43.7384, lng: 7.4246, canonical: "Monte Carlo", country: "Monaco" },
  zurich: { lat: 47.3769, lng: 8.5417, canonical: "Zurich", country: "Switzerland" },
  geneva: { lat: 46.2044, lng: 6.1432, canonical: "Geneva", country: "Switzerland" },
  brussels: { lat: 50.8503, lng: 4.3517, canonical: "Brussels", country: "Belgium" },
  dublin: { lat: 53.3498, lng: -6.2603, canonical: "Dublin", country: "Ireland" },
  edinburgh: { lat: 55.9533, lng: -3.1883, canonical: "Edinburgh", country: "United Kingdom" },
  copenhagen: { lat: 55.6761, lng: 12.5683, canonical: "Copenhagen", country: "Denmark" },
  stockholm: { lat: 59.3293, lng: 18.0686, canonical: "Stockholm", country: "Sweden" },
  oslo: { lat: 59.9139, lng: 10.7522, canonical: "Oslo", country: "Norway" },
  helsinki: { lat: 60.1699, lng: 24.9384, canonical: "Helsinki", country: "Finland" },
  riga: { lat: 56.9496, lng: 24.1052, canonical: "Riga", country: "Latvia" },
  tallinn: { lat: 59.437, lng: 24.7536, canonical: "Tallinn", country: "Estonia" },
  vilnius: { lat: 54.6872, lng: 25.2797, canonical: "Vilnius", country: "Lithuania" },
  minsk: { lat: 53.9006, lng: 27.559, canonical: "Minsk", country: "Belarus" },
  moscow: { lat: 55.7558, lng: 37.6173, canonical: "Moscow", country: "Russia" },
  "saint petersburg": { lat: 59.9343, lng: 30.3351, canonical: "Saint Petersburg", country: "Russia" },
  tbilisi: { lat: 41.7151, lng: 44.8271, canonical: "Tbilisi", country: "Georgia" },
  batumi: { lat: 41.6168, lng: 41.6367, canonical: "Batumi", country: "Georgia" },
  baku: { lat: 40.4093, lng: 49.8671, canonical: "Baku", country: "Azerbaijan" },
  yerevan: { lat: 40.1792, lng: 44.4991, canonical: "Yerevan", country: "Armenia" },
  tashkent: { lat: 41.2995, lng: 69.2401, canonical: "Tashkent", country: "Uzbekistan" },
  samarkand: { lat: 39.6542, lng: 66.9597, canonical: "Samarkand", country: "Uzbekistan" },
  bukhara: { lat: 39.7681, lng: 64.4556, canonical: "Bukhara", country: "Uzbekistan" },
  bishkek: { lat: 42.8746, lng: 74.5698, canonical: "Bishkek", country: "Kyrgyzstan" },
  almaty: { lat: 43.2389, lng: 76.8897, canonical: "Almaty", country: "Kazakhstan" },
  astana: { lat: 51.1694, lng: 71.4491, canonical: "Astana", country: "Kazakhstan" },
  ashgabat: { lat: 37.9601, lng: 58.3261, canonical: "Ashgabat", country: "Turkmenistan" },
  dushanbe: { lat: 38.5598, lng: 68.787, canonical: "Dushanbe", country: "Tajikistan" },
  ulaanbaatar: { lat: 47.8864, lng: 106.9057, canonical: "Ulaanbaatar", country: "Mongolia" },
  dubai: { lat: 25.2048, lng: 55.2708, canonical: "Dubai", country: "United Arab Emirates" },
  "abu dhabi": { lat: 24.4539, lng: 54.3773, canonical: "Abu Dhabi", country: "United Arab Emirates" },
  doha: { lat: 25.2854, lng: 51.531, canonical: "Doha", country: "Qatar" },
  muscat: { lat: 23.588, lng: 58.3829, canonical: "Muscat", country: "Oman" },
  amman: { lat: 31.9454, lng: 35.9284, canonical: "Amman", country: "Jordan" },
  petra: { lat: 30.3285, lng: 35.4444, canonical: "Petra", country: "Jordan" },
  "tel aviv": { lat: 32.0853, lng: 34.7818, canonical: "Tel Aviv", country: "Israel" },
  jerusalem: { lat: 31.7683, lng: 35.2137, canonical: "Jerusalem", country: "Israel" },
  beirut: { lat: 33.8938, lng: 35.5018, canonical: "Beirut", country: "Lebanon" },
  cairo: { lat: 30.0444, lng: 31.2357, canonical: "Cairo", country: "Egypt" },
  hurghada: { lat: 27.2579, lng: 33.8116, canonical: "Hurghada", country: "Egypt" },
  "sharm el sheikh": { lat: 27.9158, lng: 34.33, canonical: "Sharm El Sheikh", country: "Egypt" },
  marrakech: { lat: 31.6295, lng: -7.9811, canonical: "Marrakech", country: "Morocco" },
  agadir: { lat: 30.4278, lng: -9.5981, canonical: "Agadir", country: "Morocco" },
  casablanca: { lat: 33.5731, lng: -7.5898, canonical: "Casablanca", country: "Morocco" },
  "cape town": { lat: -33.9249, lng: 18.4241, canonical: "Cape Town", country: "South Africa" },
  nairobi: { lat: -1.2921, lng: 36.8219, canonical: "Nairobi", country: "Kenya" },
  zanzibar: { lat: -6.1659, lng: 39.1989, canonical: "Zanzibar", country: "Tanzania" },
  maldives: { lat: 3.2028, lng: 73.2207, canonical: "Maldives", country: "Maldives" },
  mauritius: { lat: -20.3484, lng: 57.5522, canonical: "Mauritius", country: "Mauritius" },
  phuket: { lat: 7.8804, lng: 98.3923, canonical: "Phuket", country: "Thailand" },
  bangkok: { lat: 13.7563, lng: 100.5018, canonical: "Bangkok", country: "Thailand" },
  "koh samui": { lat: 9.512, lng: 100.0136, canonical: "Koh Samui", country: "Thailand" },
  krabi: { lat: 8.0863, lng: 98.9063, canonical: "Krabi", country: "Thailand" },
  bali: { lat: -8.3405, lng: 115.092, canonical: "Bali", country: "Indonesia" },
  "nusa dua": { lat: -8.8, lng: 115.23, canonical: "Nusa Dua", country: "Indonesia" },
  singapore: { lat: 1.3521, lng: 103.8198, canonical: "Singapore", country: "Singapore" },
  "kuala lumpur": { lat: 3.139, lng: 101.6869, canonical: "Kuala Lumpur", country: "Malaysia" },
  hanoi: { lat: 21.0285, lng: 105.8542, canonical: "Hanoi", country: "Vietnam" },
  "ho chi minh city": { lat: 10.8231, lng: 106.6297, canonical: "Ho Chi Minh City", country: "Vietnam" },
  colombo: { lat: 6.9271, lng: 79.8612, canonical: "Colombo", country: "Sri Lanka" },
  delhi: { lat: 28.7041, lng: 77.1025, canonical: "Delhi", country: "India" },
  mumbai: { lat: 19.076, lng: 72.8777, canonical: "Mumbai", country: "India" },
  goa: { lat: 15.2993, lng: 74.124, canonical: "Goa", country: "India" },
  beijing: { lat: 39.9042, lng: 116.4074, canonical: "Beijing", country: "China" },
  shanghai: { lat: 31.2304, lng: 121.4737, canonical: "Shanghai", country: "China" },
  "hong kong": { lat: 22.3193, lng: 114.1694, canonical: "Hong Kong", country: "Hong Kong" },
  tokyo: { lat: 35.6762, lng: 139.6503, canonical: "Tokyo", country: "Japan" },
  seoul: { lat: 37.5665, lng: 126.978, canonical: "Seoul", country: "South Korea" },
  larnaca: { lat: 34.9003, lng: 33.6232, canonical: "Larnaca", country: "Cyprus" },
  paphos: { lat: 34.7754, lng: 32.4218, canonical: "Paphos", country: "Cyprus" },
  limassol: { lat: 34.6786, lng: 33.0413, canonical: "Limassol", country: "Cyprus" },
  malta: { lat: 35.8989, lng: 14.5146, canonical: "Malta", country: "Malta" },
  tenerife: { lat: 28.2916, lng: -16.6291, canonical: "Tenerife", country: "Spain" },
  ibiza: { lat: 38.9067, lng: 1.4206, canonical: "Ibiza", country: "Spain" },
  "new york": { lat: 40.7128, lng: -74.006, canonical: "New York", country: "United States" },
  "los angeles": { lat: 34.0522, lng: -118.2437, canonical: "Los Angeles", country: "United States" },
  miami: { lat: 25.7617, lng: -80.1918, canonical: "Miami", country: "United States" },
  "las vegas": { lat: 36.1699, lng: -115.1398, canonical: "Las Vegas", country: "United States" },
  "san francisco": { lat: 37.7749, lng: -122.4194, canonical: "San Francisco", country: "United States" },
  toronto: { lat: 43.6532, lng: -79.3832, canonical: "Toronto", country: "Canada" },
  vancouver: { lat: 49.2827, lng: -123.1207, canonical: "Vancouver", country: "Canada" },
  "mexico city": { lat: 19.4326, lng: -99.1332, canonical: "Mexico City", country: "Mexico" },
  cancun: { lat: 21.1619, lng: -86.8515, canonical: "Cancun", country: "Mexico" },
  "rio de janeiro": { lat: -22.9068, lng: -43.1729, canonical: "Rio de Janeiro", country: "Brazil" },
  "buenos aires": { lat: -34.6037, lng: -58.3816, canonical: "Buenos Aires", country: "Argentina" },
  sydney: { lat: -33.8688, lng: 151.2093, canonical: "Sydney", country: "Australia" },
};

// Country-level fallback — only when the city itself cannot be resolved.
const COUNTRY_FALLBACK: Record<string, { lat: number; lng: number; country: string }> = {
  "united kingdom": { lat: 54.0, lng: -2.0, country: "United Kingdom" },
  "lielbritanija": { lat: 54.0, lng: -2.0, country: "United Kingdom" },
  uk: { lat: 54.0, lng: -2.0, country: "United Kingdom" },
  france: { lat: 46.2, lng: 2.2, country: "France" },
  francija: { lat: 46.2, lng: 2.2, country: "France" },
  spain: { lat: 40.0, lng: -4.0, country: "Spain" },
  spanija: { lat: 40.0, lng: -4.0, country: "Spain" },
  italy: { lat: 42.5, lng: 12.5, country: "Italy" },
  italija: { lat: 42.5, lng: 12.5, country: "Italy" },
  germany: { lat: 51.0, lng: 10.5, country: "Germany" },
  vacija: { lat: 51.0, lng: 10.5, country: "Germany" },
  netherlands: { lat: 52.1, lng: 5.3, country: "Netherlands" },
  nederlande: { lat: 52.1, lng: 5.3, country: "Netherlands" },
  belgium: { lat: 50.5, lng: 4.5, country: "Belgium" },
  portugal: { lat: 39.4, lng: -8.2, country: "Portugal" },
  portugale: { lat: 39.4, lng: -8.2, country: "Portugal" },
  greece: { lat: 39.0, lng: 22.0, country: "Greece" },
  griekija: { lat: 39.0, lng: 22.0, country: "Greece" },
  turkey: { lat: 39.0, lng: 35.0, country: "Turkey" },
  turcija: { lat: 39.0, lng: 35.0, country: "Turkey" },
  bulgaria: { lat: 42.7, lng: 25.5, country: "Bulgaria" },
  bulgarija: { lat: 42.7, lng: 25.5, country: "Bulgaria" },
  romania: { lat: 45.9, lng: 24.9, country: "Romania" },
  croatia: { lat: 45.1, lng: 15.2, country: "Croatia" },
  horvatija: { lat: 45.1, lng: 15.2, country: "Croatia" },
  serbia: { lat: 44.0, lng: 21.0, country: "Serbia" },
  montenegro: { lat: 42.7, lng: 19.4, country: "Montenegro" },
  melnkalne: { lat: 42.7, lng: 19.4, country: "Montenegro" },
  albania: { lat: 41.2, lng: 20.2, country: "Albania" },
  albanija: { lat: 41.2, lng: 20.2, country: "Albania" },
  slovenia: { lat: 46.1, lng: 14.9, country: "Slovenia" },
  slovakia: { lat: 48.7, lng: 19.7, country: "Slovakia" },
  austria: { lat: 47.5, lng: 14.5, country: "Austria" },
  austrija: { lat: 47.5, lng: 14.5, country: "Austria" },
  "czech republic": { lat: 49.8, lng: 15.5, country: "Czech Republic" },
  cehija: { lat: 49.8, lng: 15.5, country: "Czech Republic" },
  poland: { lat: 52.0, lng: 19.0, country: "Poland" },
  polija: { lat: 52.0, lng: 19.0, country: "Poland" },
  hungary: { lat: 47.2, lng: 19.5, country: "Hungary" },
  ungarija: { lat: 47.2, lng: 19.5, country: "Hungary" },
  switzerland: { lat: 46.8, lng: 8.2, country: "Switzerland" },
  sveice: { lat: 46.8, lng: 8.2, country: "Switzerland" },
  denmark: { lat: 56.3, lng: 9.5, country: "Denmark" },
  danija: { lat: 56.3, lng: 9.5, country: "Denmark" },
  sweden: { lat: 60.1, lng: 18.6, country: "Sweden" },
  zviedrija: { lat: 60.1, lng: 18.6, country: "Sweden" },
  norway: { lat: 60.5, lng: 8.5, country: "Norway" },
  finland: { lat: 61.9, lng: 25.7, country: "Finland" },
  somija: { lat: 61.9, lng: 25.7, country: "Finland" },
  ireland: { lat: 53.4, lng: -8.2, country: "Ireland" },
  irija: { lat: 53.4, lng: -8.2, country: "Ireland" },
  latvia: { lat: 56.9, lng: 24.6, country: "Latvia" },
  latvija: { lat: 56.9, lng: 24.6, country: "Latvia" },
  lithuania: { lat: 55.2, lng: 23.9, country: "Lithuania" },
  estonia: { lat: 58.6, lng: 25.0, country: "Estonia" },
  belarus: { lat: 53.7, lng: 27.9, country: "Belarus" },
  russia: { lat: 61.5, lng: 105.0, country: "Russia" },
  krievija: { lat: 61.5, lng: 105.0, country: "Russia" },
  ukraine: { lat: 48.4, lng: 31.2, country: "Ukraine" },
  georgia: { lat: 42.3, lng: 43.4, country: "Georgia" },
  gruzija: { lat: 42.3, lng: 43.4, country: "Georgia" },
  armenia: { lat: 40.1, lng: 45.0, country: "Armenia" },
  azerbaijan: { lat: 40.1, lng: 47.6, country: "Azerbaijan" },
  kazakhstan: { lat: 48.0, lng: 66.9, country: "Kazakhstan" },
  uzbekistan: { lat: 41.4, lng: 64.6, country: "Uzbekistan" },
  uzbekistana: { lat: 41.4, lng: 64.6, country: "Uzbekistan" },
  kyrgyzstan: { lat: 41.2, lng: 74.8, country: "Kyrgyzstan" },
  kirgizija: { lat: 41.2, lng: 74.8, country: "Kyrgyzstan" },
  mongolia: { lat: 46.9, lng: 103.8, country: "Mongolia" },
  china: { lat: 35.9, lng: 104.2, country: "China" },
  japan: { lat: 36.2, lng: 138.3, country: "Japan" },
  thailand: { lat: 15.9, lng: 100.9, country: "Thailand" },
  taizeme: { lat: 15.9, lng: 100.9, country: "Thailand" },
  vietnam: { lat: 14.1, lng: 108.3, country: "Vietnam" },
  indonesia: { lat: -0.8, lng: 113.9, country: "Indonesia" },
  indonezija: { lat: -0.8, lng: 113.9, country: "Indonesia" },
  malaysia: { lat: 4.2, lng: 101.9, country: "Malaysia" },
  singapore: { lat: 1.35, lng: 103.8, country: "Singapore" },
  philippines: { lat: 12.9, lng: 121.8, country: "Philippines" },
  india: { lat: 20.6, lng: 78.9, country: "India" },
  indija: { lat: 20.6, lng: 78.9, country: "India" },
  "sri lanka": { lat: 7.9, lng: 80.8, country: "Sri Lanka" },
  "united arab emirates": { lat: 23.4, lng: 53.8, country: "United Arab Emirates" },
  uae: { lat: 23.4, lng: 53.8, country: "United Arab Emirates" },
  aae: { lat: 23.4, lng: 53.8, country: "United Arab Emirates" },
  qatar: { lat: 25.4, lng: 51.2, country: "Qatar" },
  oman: { lat: 21.5, lng: 55.9, country: "Oman" },
  omana: { lat: 21.5, lng: 55.9, country: "Oman" },
  israel: { lat: 31.0, lng: 34.9, country: "Israel" },
  izraela: { lat: 31.0, lng: 34.9, country: "Israel" },
  jordan: { lat: 30.6, lng: 36.2, country: "Jordan" },
  jordanija: { lat: 30.6, lng: 36.2, country: "Jordan" },
  lebanon: { lat: 33.9, lng: 35.9, country: "Lebanon" },
  egypt: { lat: 26.8, lng: 30.8, country: "Egypt" },
  egipte: { lat: 26.8, lng: 30.8, country: "Egypt" },
  morocco: { lat: 31.8, lng: -7.1, country: "Morocco" },
  maroka: { lat: 31.8, lng: -7.1, country: "Morocco" },
  tunisia: { lat: 33.9, lng: 9.5, country: "Tunisia" },
  tunisija: { lat: 33.9, lng: 9.5, country: "Tunisia" },
  kenya: { lat: -0.0, lng: 37.9, country: "Kenya" },
  "south africa": { lat: -30.6, lng: 22.9, country: "South Africa" },
  mauritius: { lat: -20.3, lng: 57.6, country: "Mauritius" },
  maldives: { lat: 3.2, lng: 73.2, country: "Maldives" },
  maldivija: { lat: 3.2, lng: 73.2, country: "Maldives" },
  "united states": { lat: 37.1, lng: -95.7, country: "United States" },
  usa: { lat: 37.1, lng: -95.7, country: "United States" },
  asv: { lat: 37.1, lng: -95.7, country: "United States" },
  canada: { lat: 56.1, lng: -106.3, country: "Canada" },
  kanada: { lat: 56.1, lng: -106.3, country: "Canada" },
  mexico: { lat: 23.6, lng: -102.6, country: "Mexico" },
  meksika: { lat: 23.6, lng: -102.6, country: "Mexico" },
  brazil: { lat: -14.2, lng: -51.9, country: "Brazil" },
  argentina: { lat: -38.4, lng: -63.6, country: "Argentina" },
  australia: { lat: -25.3, lng: 133.8, country: "Australia" },
  cyprus: { lat: 35.1, lng: 33.4, country: "Cyprus" },
  kipra: { lat: 35.1, lng: 33.4, country: "Cyprus" },
  malta: { lat: 35.9, lng: 14.4, country: "Malta" },
  monaco: { lat: 43.7, lng: 7.4, country: "Monaco" },
};

// ────────────────────────────────────────────────────────────────────────────
// Nominatim client (OpenStreetMap). Free, 1 req/s hard limit, UA required.
// Hard-capped per request so we cannot blow the serverless budget.
// ────────────────────────────────────────────────────────────────────────────
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  "TravelCMS/1.0 (https://travel-cms.local; contact@travel-cms.local)";
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAX_NOMINATIM_PER_REQUEST = 3;
const NOMINATIM_FETCH_TIMEOUT_MS = 2500;
/** Hard ceiling on the whole external-geocoding phase per request. Guarantees
 *  the serverless function cannot exceed this no matter how many times
 *  Nominatim times out. */
const NOMINATIM_TOTAL_BUDGET_MS = 5000;

let lastNominatimCallAt = 0;
async function throttleNominatim(): Promise<void> {
  const now = Date.now();
  const waitMs = lastNominatimCallAt + NOMINATIM_MIN_INTERVAL_MS - now;
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  lastNominatimCallAt = Date.now();
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country?: string };
}

async function callNominatim(city: string, country?: string): Promise<NominatimHit | null> {
  await throttleNominatim();
  const q = country ? `${city}, ${country}` : city;
  const url =
    `${NOMINATIM_ENDPOINT}?format=jsonv2&limit=1&accept-language=en&addressdetails=1` +
    `&q=${encodeURIComponent(q)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), NOMINATIM_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_UA, Accept: "application/json" },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!resp.ok) return null;
    const arr = (await resp.json()) as NominatimHit[];
    return arr[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Cache I/O
// ────────────────────────────────────────────────────────────────────────────
interface CacheRow {
  query_norm: string;
  country_norm: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  approximate: boolean;
}

interface PendingWrite {
  queryNorm: string;
  countryNorm: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  source: ResolvedCity["source"];
  approximate: boolean;
}

function tryLocalResolve(queryNorm: string, rawCity: string, rawCountry: string): ResolvedCity | null {
  const alias = LOCALE_ALIASES[queryNorm];
  const candidates: string[] = [];
  if (alias) candidates.push(normalizeCityQuery(alias));
  candidates.push(queryNorm);
  for (const key of candidates) {
    const b = BUILTIN_CITIES[key];
    if (!b) continue;
    return {
      lat: b.lat,
      lng: b.lng,
      city: b.canonical,
      country: b.country || rawCountry,
      approximate: false,
      source: alias && key === normalizeCityQuery(alias) ? "alias" : "builtin",
    };
  }
  // Pure alias without builtin hit
  if (alias) {
    return {
      lat: 0,
      lng: 0,
      city: alias,
      country: rawCountry,
      approximate: true,
      source: "alias",
    };
  }
  // Allow raw city name passthrough (for logging); caller will still fallback.
  void rawCity;
  return null;
}

function applyCountryFallback(rawCity: string, countryNorm: string, rawCountry: string): ResolvedCity | null {
  const cf = COUNTRY_FALLBACK[countryNorm];
  if (!cf) return null;
  return {
    lat: cf.lat,
    lng: cf.lng,
    city: rawCity,
    country: cf.country || rawCountry,
    approximate: true,
    source: "country-fallback",
  };
}

/**
 * Batch-resolve a list of (city, country) pairs.
 *
 * Guarantees:
 *  - At most ONE SELECT against city_geocache (covers all queries).
 *  - At most ONE UPSERT against city_geocache (covers all new rows).
 *  - At most MAX_NOMINATIM_PER_REQUEST calls to the external API per request.
 *
 * Returns Map<key, ResolvedCity | null> where key = resolverCacheKey(city, country).
 */
export async function resolveCitiesBatch(
  pairs: { city: string; country?: string }[]
): Promise<Map<string, ResolvedCity | null>> {
  const out = new Map<string, ResolvedCity | null>();
  if (pairs.length === 0) return out;

  // 0) De-duplicate inputs (one entry per unique key).
  type Task = { key: string; rawCity: string; rawCountry: string; queryNorm: string; countryNorm: string };
  const tasks: Task[] = [];
  const seenKeys = new Set<string>();
  for (const p of pairs) {
    const rawCity = (p.city || "").trim();
    if (!rawCity) continue;
    const rawCountry = (p.country || "").trim();
    const queryNorm = normalizeCityQuery(rawCity);
    const countryNorm = normalizeCityQuery(rawCountry);
    const key = `${queryNorm}|${countryNorm}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    tasks.push({ key, rawCity, rawCountry, queryNorm, countryNorm });
  }
  if (tasks.length === 0) return out;

  // 1) Batch SELECT in fixed-size chunks (URL length / PostgREST IN-list limit safety).
  //    A single round-trip is preferred but we cap at 200 keys per call to stay well
  //    under the HTTP URL limit; even with 500+ unique cities this is at most a few calls.
  const cacheByKey = new Map<string, CacheRow>();
  const queryNorms = Array.from(new Set(tasks.map((t) => t.queryNorm)));
  const SELECT_CHUNK = 200;
  for (let i = 0; i < queryNorms.length; i += SELECT_CHUNK) {
    const slice = queryNorms.slice(i, i + SELECT_CHUNK);
    try {
      const { data, error } = await supabaseAdmin
        .from("city_geocache")
        .select("query_norm, country_norm, city, country, lat, lng, source, approximate")
        .in("query_norm", slice);
      if (error) {
        console.error("[resolveCitiesBatch] cache SELECT error:", error);
      } else if (data) {
        for (const row of data as CacheRow[]) {
          cacheByKey.set(`${row.query_norm}|${row.country_norm}`, row);
        }
      }
    } catch (err) {
      console.error("[resolveCitiesBatch] cache SELECT threw:", err);
    }
  }

  const pendingWrites: PendingWrite[] = [];
  const needNominatim: Task[] = [];

  // 2) First pass: resolve from cache + in-memory tables.
  for (const t of tasks) {
    const row = cacheByKey.get(t.key);
    if (row && row.lat !== null && row.lng !== null) {
      out.set(t.key, {
        lat: Number(row.lat),
        lng: Number(row.lng),
        city: row.city || t.rawCity,
        country: row.country || t.rawCountry,
        approximate: row.approximate,
        source: (row.source as ResolvedCity["source"]) || "manual",
      });
      continue;
    }
    if (row && row.source === "unmapped") {
      // Known miss: skip Nominatim, hand a country centroid to the caller.
      out.set(t.key, applyCountryFallback(t.rawCity, t.countryNorm, t.rawCountry));
      continue;
    }

    const local = tryLocalResolve(t.queryNorm, t.rawCity, t.rawCountry);
    if (local && local.source === "builtin") {
      out.set(t.key, local);
      continue;
    }
    if (local && local.source === "alias") {
      // Alias pointed at a builtin → caller already got lat/lng. If not (lat=0),
      // fall through to Nominatim using the canonical English name.
      if (local.lat !== 0 || local.lng !== 0) {
        out.set(t.key, local);
        continue;
      }
    }
    needNominatim.push(t);
  }

  // 3) Nominatim — two ceilings so the function cannot blow the 10s budget:
  //      a) MAX_NOMINATIM_PER_REQUEST — never more than N calls per request.
  //      b) NOMINATIM_TOTAL_BUDGET_MS — hard wall-clock limit for the whole phase.
  //    Anything beyond either ceiling gets a country-fallback now and will be
  //    retried on the next request until the cache is fully warm.
  let nomCalls = 0;
  const nominatimDeadline = Date.now() + NOMINATIM_TOTAL_BUDGET_MS;
  for (const t of needNominatim) {
    if (nomCalls >= MAX_NOMINATIM_PER_REQUEST || Date.now() >= nominatimDeadline) {
      const fb = applyCountryFallback(t.rawCity, t.countryNorm, t.rawCountry);
      out.set(t.key, fb);
      continue;
    }
    nomCalls++;
    const alias = LOCALE_ALIASES[t.queryNorm];
    const queryCity = alias || t.rawCity;
    const hit = await callNominatim(queryCity, t.rawCountry);
    if (hit && hit.lat && hit.lon) {
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const city = alias || t.rawCity;
        const country = hit.address?.country || t.rawCountry || "";
        out.set(t.key, {
          lat,
          lng,
          city,
          country,
          approximate: false,
          source: "nominatim",
        });
        pendingWrites.push({
          queryNorm: t.queryNorm,
          countryNorm: t.countryNorm,
          city,
          country,
          lat,
          lng,
          source: "nominatim",
          approximate: false,
        });
        continue;
      }
    }

    // Nominatim miss: record as unmapped so we stop retrying, but still show
    // a country-centroid marker on this response.
    pendingWrites.push({
      queryNorm: t.queryNorm,
      countryNorm: t.countryNorm,
      city: t.rawCity,
      country: t.rawCountry,
      lat: null,
      lng: null,
      source: "unmapped",
      approximate: true,
    });
    out.set(t.key, applyCountryFallback(t.rawCity, t.countryNorm, t.rawCountry));
  }

  // 4) One batch UPSERT for everything we learned this request.
  if (pendingWrites.length > 0) {
    try {
      const { error } = await supabaseAdmin.from("city_geocache").upsert(
        pendingWrites.map((w) => ({
          query_norm: w.queryNorm,
          country_norm: w.countryNorm,
          city: w.city,
          country: w.country,
          lat: w.lat,
          lng: w.lng,
          source: w.source,
          approximate: w.approximate,
        })),
        { onConflict: "query_norm,country_norm" }
      );
      if (error) console.error("[resolveCitiesBatch] UPSERT error:", error);
    } catch (err) {
      console.error("[resolveCitiesBatch] UPSERT threw:", err);
    }
  }

  return out;
}
