// No-delivery exclusion zone. Deliveries are refused for any location within a
// fixed radius of a protected address (Concordia's downtown campus, 1510 Blvd.
// De Maisonneuve Ouest). Checkout and the address form both consult this so a
// blocked address can neither be saved nor ordered to.

/** Center of the exclusion zone: 1510 Blvd. De Maisonneuve Ouest, Montreal, QC. */
export const RESTRICTED_ZONE = {
  label: '1510 Blvd. De Maisonneuve Ouest, Montreal',
  latitude: 45.496339,
  longitude: -73.578666,
  /** Radius of the no-delivery zone, in kilometers. */
  radiusKm: 3,
} as const;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two lat/lon points, in kilometers. */
export function distanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** True when the given coordinates fall inside the no-delivery zone. */
export function isInRestrictedZone(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return (
    distanceKm(latitude, longitude, RESTRICTED_ZONE.latitude, RESTRICTED_ZONE.longitude) <
    RESTRICTED_ZONE.radiusKm
  );
}
