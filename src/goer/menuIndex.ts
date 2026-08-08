import { menuCategories, menuItems } from '../data/menu';
import type { MenuItem } from '../types';

/**
 * Deterministic menu intelligence shared by the tool executors and the offline
 * NLU: normalization, fuzzy item/category resolution, quantity parsing, and the
 * compact menu text injected into agent prompts.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokenize = (s: string) => normalize(s).split(' ').filter(Boolean);

/** Levenshtein distance with early exit — tokens are short so O(n·m) is fine. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** How well one query token matches one name token: 1 exact, 0.8 prefix, ~0.6 typo. */
function tokenAffinity(query: string, target: string): number {
  if (query === target) return 1;
  if (target.startsWith(query) && query.length >= 3) return 0.8;
  if (query.length >= 4) {
    const d = editDistance(query, target);
    const allowed = query.length >= 6 ? 2 : 1;
    if (d <= allowed) return d === 1 ? 0.7 : 0.6;
  }
  return 0;
}

// Filler words that shouldn't count against a match ("a large pepperoni pizza please").
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'some', 'please', 'me', 'my', 'and', 'with', 'large', 'small', 'order',
]);

/** 0–100 score of how well `query` names this menu item. */
export function scoreMatch(query: string, item: MenuItem): number {
  const qTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  if (qTokens.length === 0) return 0;
  const nameTokens = tokenize(item.name);

  const q = qTokens.join(' ');
  if (q === normalize(item.name) || q === normalize(item.id)) return 100;

  let qCovered = 0;
  const usedName = new Set<number>();
  for (const qt of qTokens) {
    let best = 0;
    let bestIdx = -1;
    nameTokens.forEach((nt, idx) => {
      if (usedName.has(idx)) return;
      const a = tokenAffinity(qt, nt);
      if (a > best) {
        best = a;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && best > 0) {
      usedName.add(bestIdx);
      qCovered += best;
    } else if (tokenAffinity(qt, normalize(item.category)) > 0.7) {
      // Query token names the category ("pizza slice", "drink") — half credit.
      qCovered += 0.5;
    }
  }

  const qCoverage = qCovered / qTokens.length;
  if (qCoverage < 0.5) return 0;
  const nameCoverage = usedName.size / nameTokens.length;
  return Math.round(qCoverage * 60 + nameCoverage * 25 + (qCoverage === 1 ? 10 : 0));
}

export type MenuResolution =
  | { kind: 'match'; item: MenuItem }
  | { kind: 'ambiguous'; candidates: MenuItem[] }
  | { kind: 'none' };

const MATCH_THRESHOLD = 45;
const MATCH_GAP = 8;

/**
 * Resolves free text to one menu item, a short candidate list, or nothing.
 * Never guesses: a near-tie between "Cheese Pizza" and "Cheese Pizza Slice"
 * comes back ambiguous so the agent can ask.
 */
export function resolveMenuItem(query: string, pool: MenuItem[] = menuItems): MenuResolution {
  const scored = pool
    .map((item) => ({ item, score: scoreMatch(query, item) }))
    .filter((s) => s.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { kind: 'none' };
  if (scored.length === 1 || scored[0].score - scored[1].score >= MATCH_GAP) {
    return { kind: 'match', item: scored[0].item };
  }
  return {
    kind: 'ambiguous',
    candidates: scored.filter((s) => scored[0].score - s.score < MATCH_GAP).slice(0, 4).map((s) => s.item),
  };
}

/** Ranked browse search (looser than resolveMenuItem — includes description hits). */
export function searchMenu(query: string, limit = 6): MenuItem[] {
  const qTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t));
  return menuItems
    .map((item) => {
      let score = scoreMatch(query, item);
      if (score === 0 && item.itemDescription) {
        const desc = normalize(item.itemDescription);
        const hits = qTokens.filter((t) => desc.includes(t)).length;
        if (hits > 0) score = Math.round((hits / qTokens.length) * 40);
      }
      return { item, score };
    })
    .filter((s) => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}

/** Fuzzy category lookup: "pizzas" → "Pizza", "drink" → "Drinks". */
export function resolveCategory(query: string): string | null {
  const q = normalize(query);
  if (!q) return null;
  for (const cat of menuCategories) {
    const c = normalize(cat);
    if (c === q || c === `${q}s` || `${c}s` === q || c.includes(q)) return cat;
  }
  // Token-level fallback ("show me the manakish").
  const qTokens = tokenize(q);
  for (const cat of menuCategories) {
    const catTokens = tokenize(cat);
    if (qTokens.some((t) => catTokens.some((ct) => tokenAffinity(t, ct) >= 0.8))) return cat;
  }
  return null;
}

export function itemsByCategory(category: string): MenuItem[] {
  return menuItems.filter((i) => i.category === category);
}

export function menuItemById(id: string): MenuItem | undefined {
  return menuItems.find((i) => i.id === id);
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Pulls a leading quantity out of text like "2", "two", "a couple of". */
export function parseQuantity(text: string): number {
  const t = normalize(text);
  const digit = t.match(/\b(\d{1,2})\b/);
  if (digit) return Math.max(1, Math.min(20, parseInt(digit[1], 10)));
  if (/\bcouple\b/.test(t)) return 2;
  if (/\bfew\b/.test(t)) return 3;
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n;
  }
  return 1;
}

const MEAT_WORDS = /pepperoni|chicken|beef|kafta|sojuk|sojok|shawarma|taouk|lahmbajine|tuna|steak|merguez|poulet|boeuf/i;

/** Keyword heuristic — good enough for "what's vegetarian?" quick answers. */
export function vegetarianItems(): MenuItem[] {
  return menuItems.filter((i) => !MEAT_WORDS.test(`${i.name} ${i.itemDescription ?? ''}`));
}

/** One line per item, compact enough to live inside an agent's system prompt. */
export function compactMenuForPrompt(withDescriptions: boolean): string {
  return menuItems
    .map((i) => {
      const base = `${i.id} | ${i.name} | $${i.price.toFixed(2)} | ${i.category}`;
      return withDescriptions && i.itemDescription ? `${base} | ${i.itemDescription}` : base;
    })
    .join('\n');
}
