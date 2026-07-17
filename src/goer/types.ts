import type { IoniconName } from '../types';
import type { Address, CartLine } from '../types';

/** The four Goer specialists. One is "active" at a time; handoffs swap it. */
export type GoerAgentId = 'concierge' | 'cart' | 'checkout' | 'tracker';

/** Display metadata for each agent — used by the badge, typing indicator, and
 *  handoff dividers so users can see which specialist is talking. */
export const AGENT_META: Record<GoerAgentId, { name: string; icon: IoniconName }> = {
  concierge: { name: 'Menu Concierge', icon: 'restaurant' },
  cart: { name: 'Cart Manager', icon: 'cart' },
  checkout: { name: 'Checkout', icon: 'card' },
  tracker: { name: 'Order Tracker', icon: 'bicycle' },
};

// MARK: - Anthropic Messages API shapes (the subset Goer uses)

export interface ApiTextBlock {
  type: 'text';
  text: string;
}

export interface ApiToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ApiToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ApiContentBlock = ApiTextBlock | ApiToolUseBlock | ApiToolResultBlock;

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | ApiContentBlock[];
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// MARK: - Chat state

/** Tip mirrors the Cart screen: a preset % of the subtotal or a custom dollar amount. */
export type ChatTip = { kind: 'percent'; value: number } | { kind: 'amount'; value: number };

/**
 * A snapshot of everything the user is about to order, staged by the Checkout
 * agent. The order is ONLY placed when the user taps Confirm on the card —
 * `cartHash` detects cart edits between staging and confirming.
 */
export interface StagedOrder {
  id: string;
  status: 'staged' | 'placing' | 'placed' | 'stale';
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  tip: number;
  total: number;
  restaurantID: string | null;
  address: Address | null;
  cartHash: string;
}

export interface CartSummarySnapshot {
  lines: { itemID: string; name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export interface OrderStatusInfo {
  orderNumber: string | null;
  status: string;
  etaMinutes: number | null;
  placedAt: string | null;
  restaurantName: string;
  totalCents: number | null;
  driverAccepted: boolean;
}

/** Everything Goer can render in the transcript — text plus rich widgets. */
export type GoerMessage = { id: string; createdAt: string; agent?: GoerAgentId } & (
  | { kind: 'text'; role: 'user' | 'assistant'; text: string }
  | { kind: 'menu_items'; itemIDs: string[] }
  | { kind: 'cart_summary'; snapshot: CartSummarySnapshot }
  | { kind: 'order_confirmation'; stagedOrderID: string }
  | { kind: 'order_status'; info: OrderStatusInfo }
  | { kind: 'quick_replies'; options: string[] }
  | { kind: 'agent_handoff'; from: GoerAgentId; to: GoerAgentId }
  | { kind: 'system_note'; text: string }
);

/** What a tool executor hands back to whichever brain called it (LLM loop or
 *  local NLU): text for the model, optional widgets for the transcript, and an
 *  optional agent handoff. */
export interface ToolExecution {
  resultText: string;
  widgets?: GoerMessage[];
  handoffTo?: GoerAgentId;
  isError?: boolean;
}

/** Shape persisted to AsyncStorage under `localgo.goer.<email>`. */
export interface PersistedGoerChat {
  uiMessages: GoerMessage[];
  apiMessages: ApiMessage[];
  activeAgent: GoerAgentId;
  placedOrders: Record<string, StagedOrder>;
  chatTip: ChatTip;
  chatAddressId: string | null;
}
