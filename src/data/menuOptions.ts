import type { MenuOptionGroup } from '../types';

/** Shared "recommended" upsell groups, reused across (almost) every item on each restaurant's real ordering site. */

export const AL_TAIB_RECOMMENDED_DRINKS: MenuOptionGroup = {
  id: 'al-taib-drinks',
  title: 'Recommended drinks',
  selectionType: 'multiple',
  required: false,
  maxSelect: 12,
  choices: [
    { id: 'al-taib-drinks-ayran', name: 'Ayran', priceDelta: 5.5 },
    { id: 'al-taib-drinks-coke', name: 'Coke', priceDelta: 2 },
    { id: 'al-taib-drinks-diet-coke', name: 'Diet coke', priceDelta: 2 },
    { id: 'al-taib-drinks-pepsi', name: 'Pepsi', priceDelta: 2 },
    { id: 'al-taib-drinks-diet-pepsi', name: 'Diet Pepsi', priceDelta: 2 },
    { id: 'al-taib-drinks-fanta', name: 'Fanta', priceDelta: 2 },
    { id: 'al-taib-drinks-sprite', name: 'Sprite', priceDelta: 2 },
    { id: 'al-taib-drinks-7-up', name: '7 up', priceDelta: 2 },
    { id: 'al-taib-drinks-redbull', name: 'Redbull', priceDelta: 4 },
    { id: 'al-taib-drinks-apple-juice', name: 'Apple Juice', priceDelta: 4.5 },
    { id: 'al-taib-drinks-perrier', name: 'Perrier', priceDelta: 3 },
    { id: 'al-taib-drinks-water', name: 'Water', priceDelta: 2 },
  ],
};

export const AL_TAIB_RECOMMENDED_SIDES: MenuOptionGroup = {
  id: 'al-taib-sides',
  title: 'Recommended sides',
  selectionType: 'multiple',
  required: false,
  maxSelect: 14,
  choices: [
    { id: 'al-taib-sides-1-small-garlic-sauce', name: '1 small garlic sauce', priceDelta: 2.49 },
    { id: 'al-taib-sides-2-small-garlic-sauce', name: '2 small garlic sauce', priceDelta: 4.99 },
    { id: 'al-taib-sides-4-small-garlic-sauce', name: '4 small garlic sauce', priceDelta: 9.99 },
    { id: 'al-taib-sides-hummus', name: 'Hummus', priceDelta: 4.5 },
    { id: 'al-taib-sides-small-fries', name: 'Small Fries', priceDelta: 5 },
    { id: 'al-taib-sides-large-fries', name: 'Large Fries', priceDelta: 8.5 },
    { id: 'al-taib-sides-small-poutine', name: 'Small Poutine', priceDelta: 12 },
    { id: 'al-taib-sides-large-poutine', name: 'Large Poutine', priceDelta: 14 },
    { id: 'al-taib-sides-tabouleh', name: 'Tabouleh', priceDelta: 4.5 },
    { id: 'al-taib-sides-fattoush', name: 'Fattoush', priceDelta: 4.5 },
    { id: 'al-taib-sides-small-hot-potato', name: 'Small Hot Potato', priceDelta: 6 },
    { id: 'al-taib-sides-large-hot-potato', name: 'Large Hot Potato', priceDelta: 11 },
    { id: 'al-taib-sides-basmati-rice', name: 'Basmati Rice', priceDelta: 4.5 },
    { id: 'al-taib-sides-cabbage-salad', name: 'Cabbage Salad', priceDelta: 4.5 },
  ],
};

export const AL_TAIB_RECOMMENDED_DESSERTS: MenuOptionGroup = {
  id: 'al-taib-desserts',
  title: 'Recommended desserts',
  selectionType: 'multiple',
  required: false,
  maxSelect: 2,
  choices: [
    { id: 'al-taib-desserts-cheesecake-slice', name: 'Cheesecake Slice', priceDelta: 6 },
    { id: 'al-taib-desserts-baklava-patisserie', name: 'Baklava Patisserie', priceDelta: 3.5 },
  ],
};

export const CK_RECOMMENDED_APPETIZERS: MenuOptionGroup = {
  id: 'ck-appetizers',
  title: 'Recommended appetizers',
  selectionType: 'multiple',
  required: false,
  maxSelect: 17,
  choices: [
    { id: 'ck-appetizers-hummus', name: 'Hummus', priceDelta: 6.99 },
    { id: 'ck-appetizers-baba-ghanouj', name: 'Baba ghanouj', priceDelta: 7.99 },
    { id: 'ck-appetizers-mirza-kasemi', name: 'Mirza kasemi', priceDelta: 10.99 },
    { id: 'ck-appetizers-vine-leaves', name: 'Vine Leaves', priceDelta: 6.99 },
    { id: 'ck-appetizers-tabbouleh', name: 'Tabbouleh', priceDelta: 9.99 },
    { id: 'ck-appetizers-house-salad', name: 'House Salad', priceDelta: 9.99 },
    { id: 'ck-appetizers-1-tanour-bread', name: '1 Tanour Bread', priceDelta: 1.49 },
    { id: 'ck-appetizers-2-tanour-bread', name: '2 Tanour Bread', priceDelta: 2.98 },
    { id: 'ck-appetizers-4-tanour-bread', name: '4 Tanour Bread', priceDelta: 5.96 },
    { id: 'ck-appetizers-soup', name: 'Soup', priceDelta: 5.99 },
    { id: 'ck-appetizers-maast-o-khiyar', name: 'Maast o khiyar', priceDelta: 7.99 },
    { id: 'ck-appetizers-kibbe-2-pieces', name: 'Kibbe (2 pieces)', priceDelta: 7.99 },
    { id: 'ck-appetizers-fries', name: 'Fries', priceDelta: 5.99 },
    { id: 'ck-appetizers-garlic-potatoes', name: 'Garlic Potatoes', priceDelta: 5.99 },
    { id: 'ck-appetizers-poutine', name: 'Poutine', priceDelta: 7.99 },
    { id: 'ck-appetizers-mixed-maza', name: 'Mixed Maza', priceDelta: 12.99 },
    { id: 'ck-appetizers-samoussa', name: 'Samoussa', priceDelta: 6.99 },
  ],
};

export const CK_RECOMMENDED_EXTRA_RICES: MenuOptionGroup = {
  id: 'ck-extra-rices',
  title: 'Recommended extra rices',
  selectionType: 'multiple',
  required: false,
  maxSelect: 2,
  choices: [
    { id: 'ck-extra-rices-rice', name: 'Rice', priceDelta: 4.99 },
    { id: 'ck-extra-rices-baghali-rice', name: 'Baghali Rice', priceDelta: 6.99 },
  ],
};

export const CK_RECOMMENDED_DRINKS: MenuOptionGroup = {
  id: 'ck-drinks',
  title: 'Recommended drinks',
  selectionType: 'multiple',
  required: false,
  maxSelect: 9,
  choices: [
    { id: 'ck-drinks-laban-ayran', name: 'Laban Ayran', priceDelta: 3.5 },
    { id: 'ck-drinks-coke', name: 'Coke', priceDelta: 2.5 },
    { id: 'ck-drinks-diet-coke', name: 'Diet Coke', priceDelta: 2.5 },
    { id: 'ck-drinks-sprite', name: 'Sprite', priceDelta: 2.5 },
    { id: 'ck-drinks-orange-fanta', name: 'Orange Fanta', priceDelta: 2.5 },
    { id: 'ck-drinks-sprite-zero', name: 'Sprite Zero', priceDelta: 2.5 },
    { id: 'ck-drinks-canada-dry', name: 'Canada Dry', priceDelta: 2.5 },
    { id: 'ck-drinks-bottled-water', name: 'Bottled Water', priceDelta: 2 },
    { id: 'ck-drinks-juice', name: 'Juice', priceDelta: 3 },
  ],
};

export const CK_RECOMMENDED_DESSERTS: MenuOptionGroup = {
  id: 'ck-desserts',
  title: 'Recommended desserts',
  selectionType: 'multiple',
  required: false,
  maxSelect: 2,
  choices: [
    { id: 'ck-desserts-basboussa', name: 'Basboussa', priceDelta: 3.99 },
    { id: 'ck-desserts-baklava', name: 'Baklava', priceDelta: 3.99 },
  ],
};
