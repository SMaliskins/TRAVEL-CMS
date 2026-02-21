// Cities database with coordinates and country codes for flags
// Flag emojis are generated from ISO 3166-1 alpha-2 country codes

export interface City {
  name: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
  iataCode?: string; // Airport code if applicable
}

// Convert ISO country code to flag emoji
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Popular travel destinations with coordinates
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
  
  // France
  { name: "Paris", country: "France", countryCode: "FR", lat: 48.8566, lng: 2.3522, iataCode: "CDG" },
  { name: "Lyon", country: "France", countryCode: "FR", lat: 45.7640, lng: 4.8357, iataCode: "LYS" },
  { name: "Marseille", country: "France", countryCode: "FR", lat: 43.2965, lng: 5.3698, iataCode: "MRS" },
  { name: "Nice", country: "France", countryCode: "FR", lat: 43.7102, lng: 7.2620, iataCode: "NCE" },
  { name: "Bordeaux", country: "France", countryCode: "FR", lat: 44.8378, lng: -0.5792, iataCode: "BOD" },
  { name: "Toulouse", country: "France", countryCode: "FR", lat: 43.6047, lng: 1.4442, iataCode: "TLS" },
  
  // Spain
  { name: "Barcelona", country: "Spain", countryCode: "ES", lat: 41.3851, lng: 2.1734, iataCode: "BCN" },
  { name: "Madrid", country: "Spain", countryCode: "ES", lat: 40.4168, lng: -3.7038, iataCode: "MAD" },
  { name: "Seville", country: "Spain", countryCode: "ES", lat: 37.3891, lng: -5.9845, iataCode: "SVQ" },
  { name: "Valencia", country: "Spain", countryCode: "ES", lat: 39.4699, lng: -0.3763, iataCode: "VLC" },
  { name: "Malaga", country: "Spain", countryCode: "ES", lat: 36.7213, lng: -4.4214, iataCode: "AGP" },
  { name: "Palma de Mallorca", country: "Spain", countryCode: "ES", lat: 39.5696, lng: 2.6502, iataCode: "PMI" },
  { name: "Ibiza", country: "Spain", countryCode: "ES", lat: 38.9067, lng: 1.4206, iataCode: "IBZ" },
  
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
  
  // Turkey
  { name: "Istanbul", country: "Turkey", countryCode: "TR", lat: 41.0082, lng: 28.9784, iataCode: "IST" },
  { name: "Antalya", country: "Turkey", countryCode: "TR", lat: 36.8969, lng: 30.7133, iataCode: "AYT" },
  { name: "Kadriye", country: "Turkey", countryCode: "TR", lat: 36.7689, lng: 31.3917 },
  { name: "Bodrum", country: "Turkey", countryCode: "TR", lat: 37.0343, lng: 27.4305, iataCode: "BJV" },
  { name: "Cappadocia", country: "Turkey", countryCode: "TR", lat: 38.6431, lng: 34.8289, iataCode: "NAV" },
  
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
  
  // Monaco
  { name: "Monaco", country: "Monaco", countryCode: "MC", lat: 43.7384, lng: 7.4246 },
  
  // Philippines
  { name: "Manila", country: "Philippines", countryCode: "PH", lat: 14.5995, lng: 120.9842, iataCode: "MNL" },
  { name: "Cebu", country: "Philippines", countryCode: "PH", lat: 10.3157, lng: 123.8854, iataCode: "CEB" },
  { name: "Boracay", country: "Philippines", countryCode: "PH", lat: 11.9674, lng: 121.9248, iataCode: "MPH" },
  
  // Cambodia
  { name: "Siem Reap", country: "Cambodia", countryCode: "KH", lat: 13.3671, lng: 103.8448, iataCode: "REP" },
  { name: "Phnom Penh", country: "Cambodia", countryCode: "KH", lat: 11.5564, lng: 104.9282, iataCode: "PNH" },
  
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

// Search cities by name or country
export function searchCities(query: string): City[] {
  if (!query || query.length < 2) return [];
  const lowerQuery = query.toLowerCase();
  return CITIES.filter(
    (city) =>
      city.name.toLowerCase().includes(lowerQuery) ||
      city.country.toLowerCase().includes(lowerQuery)
  ).slice(0, 15);
}

// Get city by name
export function getCityByIATA(iataCode: string): City | undefined {
  if (!iataCode) return undefined;
  const code = iataCode.toUpperCase();
  return CITIES.find(city => city.iataCode?.toUpperCase() === code);
}

export function getCityByName(name: string): City | undefined {
  if (!name) return undefined;
  return CITIES.find(
    (city) => city.name.toLowerCase() === name.toLowerCase()
  );
}

// Get all unique countries with flags
export function getCountriesWithFlags(): { name: string; code: string; flag: string }[] {
  const countriesMap = new Map<string, { name: string; code: string }>();
  
  CITIES.forEach((city) => {
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
