// Address search + reverse geocoding via Photon (photon.komoot.io), the free,
// key-less OpenStreetMap geocoder. CORS-enabled so it works in the Expo web
// preview as well as on device. No billing, no API key — swap the two URLs for
// Google Places / Mapbox later if you want higher-quality autocomplete.

export interface GeoResult {
  /** Full human-readable line for the suggestion list, e.g. "24 Sussex Dr, Ottawa, ON K1M 1M4". */
  label: string;
  /** Street line to store as the address (house number + street, or place name). */
  addressLine: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
}

interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProps;
}

function streetLine(p: PhotonProps): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ').trim();
  if (street) return street;
  return p.name ?? '';
}

function toResult(f: PhotonFeature): GeoResult | null {
  const p = f.properties;
  const addressLine = streetLine(p);
  if (!addressLine) return null;
  const city = p.city ?? p.district ?? '';
  const label = [addressLine, city, [p.state, p.postcode].filter(Boolean).join(' ')]
    .filter((part) => part && part.trim().length > 0)
    .join(', ');
  const [longitude, latitude] = f.geometry.coordinates;
  return {
    label,
    addressLine,
    postalCode: p.postcode ?? '',
    city,
    latitude,
    longitude,
  };
}

/** Autocomplete: returns up to 6 address suggestions for a free-text query. */
export async function searchAddresses(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? [])
      .map(toResult)
      .filter((r): r is GeoResult => r !== null);
  } catch {
    // Aborted (new keystroke) or network error — just yield no suggestions.
    return [];
  }
}

/** Reverse geocode a lat/lon (from the device GPS) into a usable address. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const first = data.features?.[0];
    return first ? toResult(first) : null;
  } catch {
    return null;
  }
}
