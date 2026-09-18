import { DELIVERY_ZONE } from '../../../src/lib/deliveryZone';
import { deliveryLocationProblem, hasVerifiedCoordinates, isValidDeliveryLocation } from '../../../src/lib/deliveryLocation';
import type { Address } from '../../../src/types';

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: 'address-1', ownerEmail: 'ada@example.com', isDefault: true,
    latitude: DELIVERY_ZONE.latitude, longitude: DELIVERY_ZONE.longitude, sortOrder: 0,
    addressLine: '1510 De Maisonneuve Ouest', postalCode: 'H3G 1N1', addressType: 'Apartment',
    apartmentSuite: '', entryCode: '', buildingName: '', deliveryPreference: 'Leave at door',
    instructions: '', personalLabel: 'Home', customLabelName: '', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('delivery-location validation', () => {
  it('accepts a geocoded address in the delivery zone', () => {
    expect(hasVerifiedCoordinates(address())).toBe(true);
    expect(isValidDeliveryLocation(address())).toBe(true);
    expect(deliveryLocationProblem(address())).toBeNull();
  });

  it('rejects a missing, ungeocoded, or out-of-zone address', () => {
    expect(deliveryLocationProblem(null)).toMatch(/add a delivery address/i);
    expect(deliveryLocationProblem(address({ latitude: 0, longitude: 0 }))).toMatch(/couldn.t verify/i);
    expect(deliveryLocationProblem(address({ latitude: 45.7, longitude: -73.8 }))).toMatch(/only deliver within/i);
  });
});
