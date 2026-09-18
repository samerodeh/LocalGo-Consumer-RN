import { cartLineDisplayName, cartLineUnitPrice } from '../../../src/lib/cartLine';
import type { CartLine, MenuItem } from '../../../src/types';

const item: MenuItem = {
  id: 'pizza', name: 'Cheese Pizza', category: 'Pizza', price: 12.5,
  icon: 'pizza-outline', itemDescription: null, imageURL: null,
};

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { lineId: 'line-1', item, quantity: 1, ...overrides };
}

describe('cart line helpers', () => {
  it('adds every selected option to the unit price', () => {
    expect(cartLineUnitPrice(line({ selections: [
      { groupId: 'size', groupTitle: 'Size', choiceNames: ['Large'], priceDelta: 3 },
      { groupId: 'extra', groupTitle: 'Extras', choiceNames: ['Olives'], priceDelta: 1.5 },
    ] }))).toBe(17);
  });

  it('formats selected choices and notes for receipts', () => {
    expect(cartLineDisplayName(line({ selections: [
      { groupId: 'size', groupTitle: 'Size', choiceNames: ['Large'], priceDelta: 3 },
      { groupId: 'drink', groupTitle: 'Drink', choiceNames: ['Coke'], priceDelta: 0 },
    ], notes: 'No onions' }))).toBe('Cheese Pizza (Large, Coke, Note: No onions)');
  });

  it('uses the item name when no meaningful options exist', () => {
    expect(cartLineDisplayName(line({ selections: [
      { groupId: 'empty', groupTitle: 'Empty', choiceNames: [], priceDelta: 0 },
    ] }))).toBe('Cheese Pizza');
  });
});
