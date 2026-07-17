// Warms the expo-image disk cache for the imagery the user is about to see,
// so restaurant heroes and menu photos render instantly instead of popping in
// one by one. Runs once per app session, shortly after login so it never
// competes with startup work. Every URL lands in the same memory+disk cache
// RemoteImage reads from; on later launches the prefetch is a cheap no-op
// (already cached on disk).
import { Image } from 'expo-image';
import { restaurants } from '../data/restaurants';
import { menuItemsForRestaurant } from '../data/menu';

/** How many menu photos to warm per restaurant — roughly the above-the-fold
 *  screenful the user sees first; the rest cache on scroll. */
const MENU_WARM_COUNT = 20;

let started = false;

export function warmImageCache(): void {
  if (started) return;
  started = true;

  // Give the first interactive frame a moment before spending bandwidth.
  setTimeout(() => {
    const urls = new Set<string>();

    for (const r of restaurants) {
      if (r.heroImageURL) urls.add(r.heroImageURL);
      if (r.logoURL) urls.add(r.logoURL);
      for (const item of menuItemsForRestaurant(r.id).slice(0, MENU_WARM_COUNT)) {
        if (item.imageURL) urls.add(item.imageURL);
      }
    }

    if (urls.size > 0) {
      // Fire-and-forget: failures just mean that image loads on demand later.
      void Image.prefetch([...urls], { cachePolicy: 'memory-disk' });
    }
  }, 1500);
}
