// Delivery service area. Orders are only accepted for locations within a fixed
// radius of the store's base address (Concordia's downtown campus, 1510 Blvd.
// De Maisonneuve Ouest). Anything outside that radius is out of range —
// checkout and the address form both consult this so an out-of-range address
// can neither be saved nor ordered to.

/** Center of the delivery zone: 1510 Blvd. De Maisonneuve Ouest, Montreal, QC. */
export const DELIVERY_ZONE = {
  label: '1510 Blvd. De Maisonneuve Ouest, Montreal',
  latitude: 45.496339,
  longitude: -73.578666,
  /** Radius of the deliverable area, in kilometers. */
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

/** True when the coordinates fall within the deliverable radius of the store. */
export function isInDeliveryZone(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return (
    distanceKm(latitude, longitude, DELIVERY_ZONE.latitude, DELIVERY_ZONE.longitude) <=
    DELIVERY_ZONE.radiusKm
  );
}
