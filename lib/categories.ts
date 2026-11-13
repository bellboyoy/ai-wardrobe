export const CATEGORIES = [
  { id: 'tshirt', label: 'T-shirts', one: 'T-shirt', group: 'top' },
  { id: 'shirt', label: 'Shirts', one: 'Shirt', group: 'top' },
  { id: 'hoodie', label: 'Hoodies', one: 'Hoodie', group: 'top' },
  { id: 'jumper', label: 'Jumpers', one: 'Jumper', group: 'top' },
  { id: 'jacket', label: 'Jackets', one: 'Jacket', group: 'outerwear' },
  { id: 'trousers', label: 'Trousers', one: 'Trousers', group: 'bottom' },
  { id: 'jeans', label: 'Jeans', one: 'Jeans', group: 'bottom' },
  { id: 'shorts', label: 'Shorts', one: 'Shorts', group: 'bottom' },
  { id: 'dress', label: 'Dresses', one: 'Dress', group: 'one-piece' },
  { id: 'shoes', label: 'Shoes', one: 'Shoes', group: 'shoes' },
  { id: 'accessory', label: 'Accessories', one: 'Accessory', group: 'accessory' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type Group = 'top' | 'outerwear' | 'bottom' | 'one-piece' | 'shoes' | 'accessory';

export const GROUPS: { id: Group; label: string }[] = [
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'outerwear', label: 'Jackets' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'one-piece', label: 'Dresses' },
];

const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
// Older items used broad categories; map them onto the new ones.
const LEGACY: Record<string, CategoryId> = { top: 'tshirt', bottom: 'trousers', outerwear: 'jacket', 'one-piece': 'dress' };

export function category(id: string) {
  return byId[id] || byId[LEGACY[id]] || byId.tshirt;
}
export const groupOf = (id: string): Group => category(id).group as Group;

export function guessCategory(text: string): CategoryId {
  const n = (text || '').toLowerCase();
  const rules: [RegExp, CategoryId][] = [
    [/hood(ie|y)|zip[- ]?up/, 'hoodie'],
    [/jumper|sweater|knit|cardigan|crew ?neck sweat|sweatshirt|pullover/, 'jumper'],
    [/jacket|coat|blazer|parka|puffer|gilet|bomber|trench|overshirt/, 'jacket'],
    [/jean|denim/, 'jeans'],
    [/short/, 'shorts'],
    [/trouser|pant|chino|jogger|cargo|legging|slacks|skirt/, 'trousers'],
    [/dress|jumpsuit|playsuit|romper/, 'dress'],
    [/shoe|trainer|sneaker|boot|heel|sandal|loafer|slide|mule/, 'shoes'],
    [/bag|hat|cap|beanie|belt|scarf|necklace|earring|ring|bracelet|sunglass|watch|tote|wallet/, 'accessory'],
    [/shirt|blouse|oxford|button/, 'shirt'],
  ];
  for (const [re, id] of rules) if (re.test(n)) return id;
  return 'tshirt';
}
