import { useCartStore } from '../../../src/store/cartStore';
import type { MenuItem } from '../../../src/types';

const item: MenuItem = {
  id: 'wrap', name: 'Chicken Wrap', category: 'Wraps', price: 10,
  icon: 'restaurant-outline', itemDescription: null, imageURL: null,
};

describe('cart store', () => {
  beforeEach(() => useCartStore.getState().clear());

  it('merges identical configured items and calculates totals', () => {
    const selections = [{ groupId: 'size', groupTitle: 'Size', choiceNames: ['Large'], priceDelta: 2 }];
    useCartStore.getState().add(item, 'al-taib', selections);
    useCartStore.getState().add(item, 'al-taib', selections);

    const state = useCartStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].quantity).toBe(2);
    expect(state.restaurantID).toBe('al-taib');
    expect(state.subtotal()).toBe(24);
    expect(state.deliveryFee()).toBe(5);
    expect(state.total()).toBe(29);
  });

  it('keeps differently configured items separate and clears the restaurant after removal', () => {
    useCartStore.getState().add(item, 'al-taib', [{ groupId: 'sauce', groupTitle: 'Sauce', choiceNames: ['Mild'], priceDelta: 0 }]);
    useCartStore.getState().add(item, 'al-taib', [{ groupId: 'sauce', groupTitle: 'Sauce', choiceNames: ['Hot'], priceDelta: 0 }]);
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(2);

    useCartStore.getState().removeLine(lines[0].lineId);
    useCartStore.getState().removeLine(lines[1].lineId);
    expect(useCartStore.getState().restaurantID).toBeNull();
    expect(useCartStore.getState().total()).toBe(0);
  });
});
