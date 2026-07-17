import { menuCategories } from '../data/menu';
import type { MenuItem } from '../types';
import { useCartStore } from '../store/cartStore';
import {
  normalize,
  parseQuantity,
  resolveCategory,
  resolveMenuItem,
  searchMenu,
  vegetarianItems,
} from './menuIndex';
import { executeTool } from './tools/executors';
import { goerMsg, useGoerStore } from './goerStore';
import type { GoerAgentId, GoerMessage } from './types';

/**
 * On-device rule-based assistant: intent detection + fuzzy menu matching over
 * the SAME tool executors the LLM uses, so Goer keeps working with no key, no
 * network, and no deployed edge function. Sets the active agent per intent so
 * the visible-handoff UI behaves identically in both modes.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reply(agent: GoerAgentId, text: string, widgets: GoerMessage[] = []) {
  const store = useGoerStore.getState();
  store.setActiveAgent(agent, true);
  store.appendMessage(goerMsg({ kind: 'text', role: 'assistant', agent, text }));
  for (const w of widgets) store.appendMessage(w);
}

/** Strip intent verbs/fillers so "can I get two pepperoni slices" → "pepperoni slices". */
function stripIntentWords(text: string): string {
  return normalize(text)
    .replace(
      /\b(can|could) (i|you|we)\b|\b(i|we)('d|d| would)? (like|want|ll have|will have)\b|\badd|\bget me\b|\bgive me\b|\bgimme\b|\border\b|\bbuy\b|\bplease\b|\bto (the |my )?cart\b|\bme\b|\ba\b|\ban\b|\bsome\b|\bof\b|\bthe\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** "2 pepperoni slices and a coke" → resolved items with quantities, plus leftovers. */
function parseItemList(text: string): {
  resolved: { item: MenuItem; quantity: number }[];
  ambiguous: { query: string; candidates: MenuItem[] }[];
  unmatched: string[];
} {
  const resolved: { item: MenuItem; quantity: number }[] = [];
  const ambiguous: { query: string; candidates: MenuItem[] }[] = [];
  const unmatched: string[] = [];

  const segments = stripIntentWords(text)
    .split(/\band\b|,|\bplus\b|\balso\b/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const quantity = parseQuantity(segment);
    const query = segment.replace(/\b\d{1,2}\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|couple|few)\b/g, ' ').trim();
    if (!query) continue;
    // Tolerate plurals: "slices" → "slice".
    const res = resolveMenuItem(query);
    const retried = res.kind === 'none' ? resolveMenuItem(query.replace(/s\b/g, '')) : res;
    if (retried.kind === 'match') resolved.push({ item: retried.item, quantity });
    else if (retried.kind === 'ambiguous') ambiguous.push({ query, candidates: retried.candidates });
    else unmatched.push(query);
  }
  return { resolved, ambiguous, unmatched };
}

const listNames = (items: { item: MenuItem; quantity: number }[]) =>
  items.map(({ item, quantity }) => `${quantity}× ${item.name}`).join(', ');

export async function runFallbackTurn(text: string): Promise<void> {
  // Brief pause so the typing indicator reads naturally instead of flashing.
  await sleep(400);

  const t = normalize(text);
  const store = useGoerStore.getState();

  // — Checkout / place order —
  if (/\b(checkout|check out|place (my |the )?order|order now|confirm order|pay now|finish (my )?order)\b/.test(t)) {
    if (useCartStore.getState().lines.length === 0) {
      reply('checkout', 'Your cart is empty — let’s fix that first. What are you craving?', [
        goerMsg({ kind: 'quick_replies', options: ['Show me the menu', 'Show me pizzas', 'Show me grills'] }),
      ]);
      return;
    }
    const staged = await executeTool('stage_order_confirmation', {});
    if (staged.isError) {
      reply(
        'checkout',
        staged.resultText.includes('address')
          ? 'You don’t have a delivery address saved yet — add one from the home screen (“Deliver to”), then say “checkout” again.'
          : staged.resultText,
      );
      return;
    }
    reply('checkout', 'Here’s your order — give it a once-over and tap Confirm when you’re ready. Want to adjust the tip first? Just say “tip 20%”.');
    return;
  }

  // — Tip — (parse the raw text: normalize() strips '%' and '$')
  if (/\btip\b/.test(t)) {
    const raw = text.toLowerCase();
    const pct = raw.match(/(\d{1,2})\s*(%|percent)/);
    const amt = raw.match(/\$?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(dollars?|bucks?|\$)?/);
    if (/\bno tip\b|\bzero\b/.test(t)) {
      await executeTool('set_tip', { percent: 0 });
      reply('checkout', 'No tip it is. Say “checkout” when you’re ready.');
    } else if (pct && [0, 15, 18, 20, 25].includes(parseInt(pct[1], 10))) {
      await executeTool('set_tip', { percent: parseInt(pct[1], 10) });
      reply('checkout', `Tip set to ${pct[1]}%. Say “checkout” to see the full total.`);
    } else if (pct) {
      const subtotal = useCartStore.getState().subtotal();
      const amount = Math.round(subtotal * parseInt(pct[1], 10)) / 100;
      await executeTool('set_tip', { amount });
      reply('checkout', `Tip set to ${pct[1]}% ($${amount.toFixed(2)}). Say “checkout” to see the full total.`);
    } else if (amt) {
      await executeTool('set_tip', { amount: parseFloat(amt[1]) });
      reply('checkout', `Tip set to $${parseFloat(amt[1]).toFixed(2)}. Say “checkout” to see the full total.`);
    } else {
      reply('checkout', 'Sure — how much? You can say “tip 18%” or “tip $5”.');
    }
    return;
  }

  // — Order tracking —
  if (/\b(where|track|status|driver|eta|arriv\w*)\b/.test(t) && /\border\b|\bfood\b|\bdelivery\b/.test(t)) {
    const res = await executeTool('get_active_order', {});
    reply(
      'tracker',
      res.resultText.startsWith('No orders')
        ? 'You haven’t placed an order yet — once you do, I’ll track it here.'
        : 'Here’s where your latest order stands:',
      res.widgets ?? [],
    );
    return;
  }
  if (/\b(past|previous|history|last) (orders?|purchases?)\b/.test(t)) {
    const res = await executeTool('get_past_orders', {});
    reply(
      'tracker',
      res.resultText.startsWith('No past') ? 'No orders on record yet.' : `Here’s what I found: ${res.resultText}`,
    );
    return;
  }

  // — Cart views/edits —
  if (/\b(clear|empty)\b/.test(t) && /\b(cart|basket|order)\b/.test(t)) {
    await executeTool('clear_cart', {});
    reply('cart', 'Cart cleared. Starting fresh — what would you like?');
    return;
  }
  if (/\b(cart|basket)\b/.test(t) && /\b(what|whats|show|view|see|in my|check)\b/.test(t)) {
    const res = await executeTool('view_cart', {});
    reply(
      'cart',
      res.widgets?.length ? 'Here’s your cart so far:' : 'Your cart is empty — want to browse the menu?',
      res.widgets ?? [],
    );
    return;
  }
  if (/\b(remove|delete|take out|take off|drop|scratch)\b/.test(t)) {
    const query = normalize(text).replace(/\b(remove|delete|take out|take off|drop|scratch|from|my|the|cart|basket)\b/g, ' ').trim();
    const res = await executeTool('remove_from_cart', { query });
    if (res.isError) {
      reply('cart', res.resultText.startsWith('Ambiguous')
        ? `You’ve got a few things like that in the cart — which one? ${res.resultText.replace('Ambiguous within the cart: ', '').replace('. Ask the user.', '')}`
        : `Hmm — I couldn’t find “${query}” in your cart.`);
    } else {
      const viewRes = await executeTool('view_cart', {});
      reply('cart', `Done — took it out.`, viewRes.widgets ?? []);
    }
    return;
  }

  // — Add to cart —
  const wantsAdd = /\b(add|get me|give me|gimme|i want|i'?d like|i'?ll have|can i (get|have)|order|buy)\b/.test(t);
  if (wantsAdd) {
    const { resolved, ambiguous, unmatched } = parseItemList(text);
    if (resolved.length > 0) {
      await executeTool('add_to_cart', {
        items: resolved.map(({ item, quantity }) => ({ item_id: item.id, quantity })),
      });
      const cart = useCartStore.getState();
      const widgets: GoerMessage[] = [];
      let message = `Added ${listNames(resolved)} — cart’s at $${cart.subtotal().toFixed(2)} now.`;
      if (ambiguous.length > 0) {
        message += ` For “${ambiguous[0].query}”, which one did you mean?`;
        widgets.push(goerMsg({ kind: 'menu_items', itemIDs: ambiguous[0].candidates.map((c) => c.id) }));
      } else {
        widgets.push(goerMsg({ kind: 'quick_replies', options: ["What's in my cart?", 'Checkout', 'Show me drinks'] }));
      }
      reply('cart', message, widgets);
      return;
    }
    if (ambiguous.length > 0) {
      reply(
        'cart',
        `A few things match “${ambiguous[0].query}” — which one?`,
        [goerMsg({ kind: 'menu_items', itemIDs: ambiguous[0].candidates.map((c) => c.id) })],
      );
      return;
    }
    if (unmatched.length > 0) {
      const suggestions = searchMenu(unmatched[0], 4);
      reply(
        'cart',
        suggestions.length > 0
          ? `I couldn’t find “${unmatched[0]}” exactly — closest I’ve got:`
          : `“${unmatched[0]}” isn’t on Al Taib’s menu. Want to see what is?`,
        suggestions.length > 0
          ? [goerMsg({ kind: 'menu_items', itemIDs: suggestions.map((s) => s.id) })]
          : [goerMsg({ kind: 'quick_replies', options: ['Show me the menu'] })],
      );
      return;
    }
  }

  // — Browse / recommend —
  if (/\bvegetarian\b|\bveggie\b|\bno meat\b/.test(t)) {
    const veg = vegetarianItems().slice(0, 6);
    reply('concierge', 'Plenty of meat-free picks — here are some favourites:', [
      goerMsg({ kind: 'menu_items', itemIDs: veg.map((v) => v.id) }),
    ]);
    return;
  }
  const category = resolveCategory(t.replace(/\b(show|me|the|whats|what|do|you|have|got|see|browse|list)\b/g, ' ').trim());
  if (category) {
    const res = await executeTool('show_category', { category });
    reply('concierge', `Here’s the ${category} lineup:`, res.widgets ?? []);
    return;
  }
  if (/\b(menu|options|categories|what (do|does) (you|al taib)|hungry|recommend|suggest|popular|best)\b/.test(t)) {
    if (/\b(recommend|suggest|popular|best)\b/.test(t)) {
      const picks = ['pepperoni-pizza-slice', 'shish-taouk-plate', 'zaatar-manakish', 'baklava-patesserie'];
      const res = await executeTool('show_menu_items', { item_ids: picks });
      reply('concierge', 'Crowd favourites at Al Taib — the shish taouk plate is my go-to:', res.widgets ?? []);
      return;
    }
    reply('concierge', `Al Taib has ${menuCategories.length} sections: ${menuCategories.join(', ')}. Tap one to browse:`, [
      goerMsg({ kind: 'quick_replies', options: menuCategories.map((c) => `Show me ${c}`) }),
    ]);
    return;
  }

  // — Greeting —
  if (/^(hi|hey|hello|yo|sup|salut|good (morning|afternoon|evening))\b/.test(t)) {
    reply('concierge', 'Hey! Tell me what you’re craving, or take a look around:', [
      goerMsg({ kind: 'quick_replies', options: ['Show me the menu', 'Recommend something', "What's in my cart?"] }),
    ]);
    return;
  }

  // — Bare item mention ("pepperoni slice?") —
  const bare = resolveMenuItem(stripIntentWords(text));
  if (bare.kind === 'match') {
    reply('concierge', `${bare.item.name} — $${bare.item.price.toFixed(2)}. Want it?`, [
      goerMsg({ kind: 'menu_items', itemIDs: [bare.item.id] }),
      goerMsg({ kind: 'quick_replies', options: [`Add ${bare.item.name}`, 'Show me the menu'] }),
    ]);
    return;
  }
  if (bare.kind === 'ambiguous') {
    reply('concierge', 'A few things match that — which one?', [
      goerMsg({ kind: 'menu_items', itemIDs: bare.candidates.map((c) => c.id) }),
    ]);
    return;
  }

  // — Fallback help —
  reply(
    store.activeAgent,
    'I can browse the menu, build your cart, and check you out — try “add 2 pepperoni slices and a coke”.',
    [goerMsg({ kind: 'quick_replies', options: ['Show me the menu', "What's in my cart?", 'Checkout'] })],
  );
}
