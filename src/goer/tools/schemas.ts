import { menuCategories } from '../../data/menu';
import type { GoerAgentId, ToolDef } from '../types';

/**
 * Anthropic tool definitions for each specialist. The handoff tool is shared:
 * calling it swaps which agent (system prompt + toolset) answers next.
 */

const HANDOFF: ToolDef = {
  name: 'handoff_to_agent',
  description:
    'Transfer the conversation to another specialist. concierge: browsing/recommending menu items. cart: adding/removing/updating cart items. checkout: tip, delivery address, and staging the order confirmation. tracker: status of the active or past orders. Hand off as soon as the request belongs to another specialist.',
  input_schema: {
    type: 'object',
    properties: {
      agent: { type: 'string', enum: ['concierge', 'cart', 'checkout', 'tracker'] },
      reason: { type: 'string', description: 'One short sentence on why.' },
    },
    required: ['agent'],
  },
};

const CONCIERGE_TOOLS: ToolDef[] = [
  {
    name: 'show_menu_items',
    description:
      'Display rich cards (photo, price, add button) for up to 6 menu items you are recommending or the user asked about. Use the exact item ids from your menu data.',
    input_schema: {
      type: 'object',
      properties: {
        item_ids: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      },
      required: ['item_ids'],
    },
  },
  {
    name: 'show_category',
    description: 'Display the items of one menu category as cards.',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string', enum: [...menuCategories] } },
      required: ['category'],
    },
  },
];

const CART_TOOLS: ToolDef[] = [
  {
    name: 'add_to_cart',
    description:
      'Add one or more menu items to the cart. Prefer item_id (exact id from menu data); use query only when unsure — an ambiguous query returns candidates to ask the user about instead of guessing.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string' },
              query: { type: 'string', description: 'Free-text item name if id unknown.' },
              quantity: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
            },
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'remove_from_cart',
    description: 'Remove an item line from the cart entirely.',
    input_schema: {
      type: 'object',
      properties: { item_id: { type: 'string' }, query: { type: 'string' } },
    },
  },
  {
    name: 'set_quantity',
    description: 'Set the exact quantity of a cart line (0 removes it).',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        query: { type: 'string' },
        quantity: { type: 'integer', minimum: 0, maximum: 20 },
      },
      required: ['quantity'],
    },
  },
  {
    name: 'view_cart',
    description: 'Show the user their current cart as a card and get its contents.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'clear_cart',
    description: 'Empty the cart. Only after the user clearly asks.',
    input_schema: { type: 'object', properties: {} },
  },
];

const CHECKOUT_TOOLS: ToolDef[] = [
  {
    name: 'get_checkout_state',
    description: 'Fresh totals: cart lines, subtotal, delivery fee, tip, total, and delivery address.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'set_tip',
    description: 'Set the driver tip: a preset percent of the subtotal, or a custom dollar amount.',
    input_schema: {
      type: 'object',
      properties: {
        percent: { type: 'integer', enum: [0, 15, 18, 20, 25] },
        amount: { type: 'number', minimum: 0, maximum: 200, description: 'Custom dollar tip.' },
      },
    },
  },
  {
    name: 'list_addresses',
    description: "The user's saved delivery addresses.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'select_address',
    description: 'Choose which saved address this order is delivered to.',
    input_schema: {
      type: 'object',
      properties: { address_id: { type: 'string' } },
      required: ['address_id'],
    },
  },
  {
    name: 'stage_order_confirmation',
    description:
      'Show the user the final order-confirmation card (items, fees, tip, total, address). This does NOT place the order — only the user tapping Confirm on the card does.',
    input_schema: { type: 'object', properties: {} },
  },
];

const TRACKER_TOOLS: ToolDef[] = [
  {
    name: 'get_active_order',
    description: "Status of the user's most recent order, including live driver acceptance when available.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_past_orders',
    description: 'Recent order history.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 } },
    },
  },
  {
    name: 'get_order_details',
    description: 'Items and totals of one past order by its id (from get_past_orders).',
    input_schema: {
      type: 'object',
      properties: { order_id: { type: 'string' } },
      required: ['order_id'],
    },
  },
];

export const AGENT_TOOLSETS: Record<GoerAgentId, ToolDef[]> = {
  concierge: [...CONCIERGE_TOOLS, HANDOFF],
  cart: [...CART_TOOLS, HANDOFF],
  checkout: [...CHECKOUT_TOOLS, HANDOFF],
  tracker: [...TRACKER_TOOLS, HANDOFF],
};

export function toolsForAgent(agent: GoerAgentId): ToolDef[] {
  return AGENT_TOOLSETS[agent];
}
