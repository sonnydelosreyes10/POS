export type StockStatus = 'Out of stock' | 'Below reorder' | 'Overstocked' | 'Healthy';

/** README §8 status derivation. */
export function stockStatus(onHand: number, reorder: number, max: number): StockStatus {
  if (onHand === 0) return 'Out of stock';
  if (onHand <= reorder) return 'Below reorder';
  if (onHand > max) return 'Overstocked';
  return 'Healthy';
}

/** Suggested order quantity — spec 7.4. */
export function suggestedOrder(onHand: number, max: number): number {
  return Math.max(max - onHand, 0);
}

/** Physical count variance — FR-INV-03. Positive means more on hand than the system expected. */
export function variance(systemQty: number, countedQty: number): number {
  return countedQty - systemQty;
}

export type MovementType =
  | 'OPENING' | 'PURCHASE_IN' | 'SALE' | 'ADJUSTMENT' | 'RETURN_IN'
  | 'DAMAGED' | 'EXPIRED' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface Movement {
  date: string;
  type: MovementType;
  doc: string;
  qty: number;
}

/** Running balance; on-hand is derived, never edited — FR-INV-06. */
export function withBalance(movements: Movement[]) {
  let bal = 0;
  return movements.map((m) => {
    bal += m.qty;
    return { ...m, balance: bal };
  });
}
