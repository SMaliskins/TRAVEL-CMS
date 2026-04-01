/**
 * Deadline Calculator for Service Terms
 * Calculates internal deadlines (+1 business day before real deadline)
 */

/**
 * Calculate internal deadline - 1 business day before the given deadline
 * If the result lands on a weekend, move to the previous Friday
 */
export function calculateInternalDeadline(deadline: Date | string | null): Date | null {
  if (!deadline) return null;
  
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  
  if (isNaN(deadlineDate.getTime())) return null;
  
  // Subtract 1 day
  const internal = new Date(deadlineDate);
  internal.setDate(internal.getDate() - 1);
  
  // If lands on weekend, move to Friday
  const day = internal.getDay();
  if (day === 0) {
    // Sunday -> move to Friday (-2 days)
    internal.setDate(internal.getDate() - 2);
  } else if (day === 6) {
    // Saturday -> move to Friday (-1 day)
    internal.setDate(internal.getDate() - 1);
  }
  
  return internal;
}

/**
 * Get the earliest deadline from multiple dates
 * Used to determine the most urgent internal deadline
 */
export function getEarliestDeadline(...dates: (Date | string | null | undefined)[]): Date | null {
  const validDates = dates
    .filter((d): d is Date | string => d != null)
    .map(d => typeof d === 'string' ? new Date(d) : d)
    .filter(d => !isNaN(d.getTime()));
  
  if (validDates.length === 0) return null;
  
  return validDates.reduce((earliest, current) => 
    current < earliest ? current : earliest
  );
}

/**
 * Calculate days until deadline
 * Returns negative number if deadline has passed
 */
export function daysUntilDeadline(deadline: Date | string | null): number | null {
  if (!deadline) return null;
  
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  if (isNaN(deadlineDate.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Get urgency level based on days until deadline
 */
export type UrgencyLevel = 'safe' | 'warning' | 'urgent' | 'overdue';

export function getDeadlineUrgency(deadline: Date | string | null): UrgencyLevel {
  const days = daysUntilDeadline(deadline);
  
  if (days === null) return 'safe';
  if (days < 0) return 'overdue';
  if (days <= 1) return 'urgent';
  if (days <= 3) return 'warning';
  return 'safe';
}

/**
 * Format date for display (DD.MM format)
 */
export function formatDeadlineShort(date: Date | string | null): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  
  return `${day}.${month}`;
}

/**
 * Format date with day of week for tooltip
 */
export function formatDeadlineFull(date: Date | string | null): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const dayName = days[d.getDay()];
  
  return `${day}.${month}.${year} (${dayName})`;
}

/**
 * Refund policy types
 */
export type RefundPolicy = 'non_ref' | 'refundable' | 'fully_ref';
export type PriceType = 'ebd' | 'regular' | 'spo';

/**
 * Get display label for refund policy
 */
export function getRefundPolicyLabel(policy: RefundPolicy | null): string {
  switch (policy) {
    case 'non_ref': return 'Non-refundable';
    case 'refundable': return 'Refundable';
    case 'fully_ref': return 'Fully Refundable';
    default: return 'Not set';
  }
}

/**
 * Get short badge text for refund policy
 */
export function getRefundPolicyBadge(policy: RefundPolicy | null, freeCancellationUntil?: Date | string | null): string {
  switch (policy) {
    case 'non_ref': return 'NR';
    case 'fully_ref': return 'FR';
    case 'refundable': 
      if (freeCancellationUntil) {
        return `R ${formatDeadlineShort(freeCancellationUntil)}`;
      }
      return 'R';
    default: return '';
  }
}

/**
 * Get display label for price type
 */
export function getPriceTypeLabel(priceType: PriceType | null): string {
  switch (priceType) {
    case 'ebd': return 'Early Booking';
    case 'regular': return 'Regular';
    case 'spo': return 'Special Offer';
    default: return 'Regular';
  }
}
