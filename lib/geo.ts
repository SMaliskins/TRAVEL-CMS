/**
 * Haversine formula for distance between two lat/lng points.
 * Returns distance in kilometers.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

const ROAD_FACTOR = 1.3;
const AVG_SPEED_KMH = 50;

/**
 * Estimate road distance and travel time between two points.
 * Uses haversine × 1.3 road factor and 50 km/h average speed.
 */
export function estimateTransfer(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): { distanceKm: number; estimatedMinutes: number } {
  const straight = haversineKm(lat1, lng1, lat2, lng2);
  const distanceKm = Math.round(straight * ROAD_FACTOR);
  const estimatedMinutes = Math.round((distanceKm / AVG_SPEED_KMH) * 60);
  return { distanceKm, estimatedMinutes };
}
