import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = keyof typeof Ionicons.glyphMap;

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  logoURL: string | null;
  heroImageURL: string | null;
  /** Ionicon shown when there's no hero/logo image (placeholder partners). */
  heroIcon: IoniconName;
  rating: string;
  reviewCount: string;
  distance: string;
  deliveryTime: string;
  deliveryFee: string;
  /** Only Al Taib has a real menu today; placeholders show "coming soon". */
  hasMenu: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  icon: IoniconName;
  itemDescription: string | null;
  /** Remote product photo; null falls back to `icon`. */
  imageURL: string | null;
}

export interface CartLine {
  item: MenuItem;
  quantity: number;
}

export interface StoredUser {
  firstName: string;
  lastName: string;
  email: string;
  /** Salted hash + salt for password accounts (hex-encoded). */
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: string;
  failedLoginAttempts: number;
  /** ISO timestamp; account is locked until this instant after too many failures. */
  lockoutUntil: string | null;
}

export type AddressType = 'House' | 'Apartment' | 'Office' | 'Other';
export type DeliveryPreference = 'Leave at door' | 'Meet at door';
export type PersonalLabel = 'None' | 'Home' | 'Work' | 'Custom';

export interface Address {
  id: string;
  ownerEmail: string;
  isDefault: boolean;
  latitude: number;
  longitude: number;
  sortOrder: number;
  addressLine: string;
  addressType: AddressType;
  apartmentSuite: string;
  entryCode: string;
  buildingName: string;
  deliveryPreference: DeliveryPreference;
  instructions: string;
  personalLabel: PersonalLabel;
  customLabelName: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'Placed'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface OrderItemRecord {
  id: string;
  menuItemID: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

/** One placed order. Money in cents so totals can't drift from float rounding. */
export interface OrderRecord {
  id: string;
  ownerEmail: string;
  restaurantID: string;
  restaurantName: string;
  placedAt: string;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentIntentID: string;
  items: OrderItemRecord[];
  // Delivery address snapshot, copied at checkout time.
  deliveryAddressLine: string;
  deliveryApartmentSuite: string;
  deliveryInstructions: string;
  deliveryPreference: string;
}
