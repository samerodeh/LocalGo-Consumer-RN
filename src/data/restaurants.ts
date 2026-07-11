import type { Restaurant } from '../types';
import { Partner } from './partner';

/** Partners the app is currently integrated with. */
export const alTaib: Restaurant = {
  id: 'al-taib',
  name: Partner.name,
  cuisine: Partner.tagline,
  logoURL: Partner.logoURL,
  heroImageURL:
    'https://betterresto.s3.us-west-1.wasabisys.com/production/13125/all_dressed_pizza_bb4e2f9ccd.png',
  heroIcon: 'flame',
  rating: Partner.rating,
  reviewCount: '2k+',
  distance: '400 m',
  deliveryTime: Partner.etaMinutes,
  deliveryFee: '$0.49 delivery fee',
  hasMenu: true,
};

export const restaurants: Restaurant[] = [alTaib];

export function restaurantById(id: string): Restaurant | undefined {
  return restaurants.find((r) => r.id === id);
}
