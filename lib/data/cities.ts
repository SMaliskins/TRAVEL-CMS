// Temporary in-memory list of popular cities
// TODO: Replace with database/API lookup

export interface City {
  name: string;
  country: string;
  code?: string; // Optional IATA/ICAO code
}

export const POPULAR_CITIES: City[] = [
  { name: "Rome", country: "Italy" },
  { name: "Milan", country: "Italy" },
  { name: "Venice", country: "Italy" },
  { name: "Florence", country: "Italy" },
  { name: "Naples", country: "Italy" },
  { name: "Paris", country: "France" },
  { name: "Lyon", country: "France" },
  { name: "Marseille", country: "France" },
  { name: "Nice", country: "France" },
  { name: "Barcelona", country: "Spain" },
  { name: "Madrid", country: "Spain" },
  { name: "Seville", country: "Spain" },
  { name: "Valencia", country: "Spain" },
  { name: "London", country: "United Kingdom" },
  { name: "Edinburgh", country: "United Kingdom" },
  { name: "Manchester", country: "United Kingdom" },
  { name: "Berlin", country: "Germany" },
  { name: "Munich", country: "Germany" },
  { name: "Hamburg", country: "Germany" },
  { name: "Amsterdam", country: "Netherlands" },
  { name: "Vienna", country: "Austria" },
  { name: "Prague", country: "Czech Republic" },
  { name: "Budapest", country: "Hungary" },
  { name: "Warsaw", country: "Poland" },
  { name: "Dubai", country: "United Arab Emirates" },
  { name: "Abu Dhabi", country: "United Arab Emirates" },
  { name: "Athens", country: "Greece" },
  { name: "Thessaloniki", country: "Greece" },
  { name: "Istanbul", country: "Turkey" },
  { name: "Antalya", country: "Turkey" },
  { name: "New York", country: "United States" },
  { name: "Los Angeles", country: "United States" },
  { name: "Miami", country: "United States" },
  { name: "Tokyo", country: "Japan" },
  { name: "Bangkok", country: "Thailand" },
  { name: "Singapore", country: "Singapore" },
];

export function searchCities(query: string): City[] {
  if (!query || query.length < 2) return [];
  const lowerQuery = query.toLowerCase();
  return POPULAR_CITIES.filter(
    (city) =>
      city.name.toLowerCase().includes(lowerQuery) ||
      city.country.toLowerCase().includes(lowerQuery)
  ).slice(0, 10);
}

export function getCityByName(name: string): City | undefined {
  return POPULAR_CITIES.find(
    (city) => city.name.toLowerCase() === name.toLowerCase()
  );
}

