/**
 * Bork Data Optimizer
 * Extracts only essential fields from Bork API tickets to reduce storage.
 * Sanitizes $-prefixed keys (e.g. $type) so MongoDB can store the document.
 *
 * @exports-to:
 *   ✓ app/lib/services/salesSyncService.ts => optimizeBorkTickets, calculateStorageReduction
 */

const ESSENTIAL_TICKET_FIELDS = [
  'ActualDate',
  'Key',
  'TicketNumber',
  'Date',
  'PaymentMethod',
  'Internal',
  'CenterKey',
  'CenterName',
  'CenterNr',
] as const;

/**
 * Recursively remove keys that start with `$` (MongoDB reserved).
 * Bork API can return .NET-style fields like Orders[].$type; MongoDB rejects them.
 */
function sanitizeDollarKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeDollarKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$')) continue;
      out[k] = sanitizeDollarKeys(v);
    }
    return out;
  }
  return value;
}

export function extractEssentialBorkFields(ticket: Record<string, unknown>): Record<string, unknown> {
  const essential: Record<string, unknown> = {};

  for (const field of ESSENTIAL_TICKET_FIELDS) {
    if (ticket[field] !== undefined && ticket[field] !== null) {
      essential[field] = ticket[field];
    }
  }

  if (Array.isArray(ticket.Orders)) {
    essential.Orders = sanitizeDollarKeys(ticket.Orders) as unknown[];
  } else if (Array.isArray(ticket.orders)) {
    essential.Orders = sanitizeDollarKeys(ticket.orders) as unknown[];
  }

  if (ticket.TotalPrice !== undefined && ticket.TotalPrice !== null) {
    essential.TotalPrice = ticket.TotalPrice;
  }

  return sanitizeDollarKeys(essential) as Record<string, unknown>;
}

export function optimizeBorkTickets(tickets: Record<string, unknown>[]): Record<string, unknown>[] {
  return tickets.map((t) => extractEssentialBorkFields(t));
}

export function calculateStorageReduction(
  original: unknown[],
  optimized: unknown[]
): number {
  const originalSize = JSON.stringify(original).length;
  const optimizedSize = JSON.stringify(optimized).length;
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - optimizedSize) / originalSize) * 100);
}
