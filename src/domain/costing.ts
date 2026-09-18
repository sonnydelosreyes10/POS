import { round2 } from './money';

/** Moving-average cost on goods receipt — spec 7.3, TC-08. */
export function movingAverage(onHand: number, avgCost: number, recvQty: number, recvCost: number) {
  const newQty = onHand + recvQty;
  if (onHand <= 0) return { newQty, newAvg: round2(recvCost) };
  if (newQty <= 0) return { newQty, newAvg: round2(avgCost) };
  return { newQty, newAvg: round2((onHand * avgCost + recvQty * recvCost) / newQty) };
}
