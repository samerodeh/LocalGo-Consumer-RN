import type { CartLine } from '../types';

/** Base item price plus every selected option's price delta. */
export function cartLineUnitPrice(line: CartLine): number {
  const deltas = (line.selections ?? []).reduce((sum, s) => sum + s.priceDelta, 0);
  return line.item.price + deltas;
}

/** Human-readable name including selected options, e.g. `Cheese Pizza (14", Extra Cheese, Coke)` — what the cart, receipt, and driver feed all show for a customized line. */
export function cartLineDisplayName(line: CartLine): string {
  const parts = (line.selections ?? [])
    .filter((s) => s.choiceNames.length > 0)
    .flatMap((s) => s.choiceNames);
  if (line.notes) parts.push(`Note: ${line.notes}`);
  return parts.length > 0 ? `${line.item.name} (${parts.join(', ')})` : line.item.name;
}
