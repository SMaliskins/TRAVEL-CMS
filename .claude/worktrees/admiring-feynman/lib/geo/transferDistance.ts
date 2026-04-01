import { getCityByIATA, getCityByName } from "@/lib/data/cities";

interface TransferEstimate {
  distanceKm: number;
  durationMin: number;
  label: string;
}

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate transfer distance & time between an airport and a destination city.
 * Uses straight-line distance × 1.3 road factor, average speed ~50 km/h.
 * Returns null if distance < 2 km or airport not found.
 */
export function estimateTransfer(
  airportIata: string,
  destinationCityName?: string,
): TransferEstimate | null {
  const airportCity = getCityByIATA(airportIata);
  if (!airportCity) return null;

  let hotelLat = airportCity.lat;
  let hotelLng = airportCity.lng;

  if (destinationCityName) {
    const destCity = getCityByName(destinationCityName);
    if (destCity) {
      hotelLat = destCity.lat;
      hotelLng = destCity.lng;
    }
  }

  const straightKm = haversineKm(airportCity.lat, airportCity.lng, hotelLat, hotelLng);

  if (straightKm < 2) return null;

  const roadKm = Math.round(straightKm * 1.3);
  const avgSpeedKmh = 50;
  const durationMin = Math.max(10, Math.round((roadKm / avgSpeedKmh) * 60));

  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const timeStr = hours > 0 ? `~${hours}h ${mins}min` : `~${mins} min`;

  return {
    distanceKm: roadKm,
    durationMin,
    label: `~${roadKm} km, ${timeStr}`,
  };
}
