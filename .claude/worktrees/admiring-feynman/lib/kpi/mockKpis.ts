/**
 * Mock KPI values shared across Dashboard and TopBar
 * TODO: Replace with actual data from database
 */

export const monthlyProfitTarget = 36000;
export const currentMonthProfit = 8900;

/**
 * Calculate achieved percentage (clamped between 0 and 100)
 */
export function getAchievedPercentage(): number {
  return Math.min(100, Math.max(0, (currentMonthProfit / monthlyProfitTarget) * 100));
}

/**
 * Calculate remaining profit to reach target
 */
export function getRemainingProfit(): number {
  return Math.max(0, monthlyProfitTarget - currentMonthProfit);
}

