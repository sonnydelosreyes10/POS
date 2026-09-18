import type { MovementType } from './inventory';

/** FR-INV-04. */
export const ADJUSTMENT_REASONS = ['DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'CORRECTION'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** DAMAGED/EXPIRED write-offs get their own movement type — spec 6.4. Everything else posts as ADJUSTMENT. */
export function movementTypeForReason(reason: AdjustmentReason): MovementType {
  if (reason === 'DAMAGED' || reason === 'EXPIRED') return reason;
  return 'ADJUSTMENT';
}

/** Fixed direction per reason; CORRECTION is the one reason a user can point either way. */
export function directionForReason(reason: AdjustmentReason): 1 | -1 | null {
  if (reason === 'FOUND') return 1;
  if (reason === 'DAMAGED' || reason === 'EXPIRED' || reason === 'LOST') return -1;
  return null;
}
