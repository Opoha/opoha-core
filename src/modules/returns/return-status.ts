/** RMA lifecycle statuses (Phase 3 E-01). */
export const RETURN_STATUSES = [
  'requested',
  'approved',
  'received',
  'refunded',
  'exchanged',
  'cancelled',
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export function isReturnStatus(value: string): value is ReturnStatus {
  return (RETURN_STATUSES as readonly string[]).includes(value);
}

export const RETURN_RESOLUTIONS = ['refund', 'exchange'] as const;

export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

export function isReturnResolution(value: string): value is ReturnResolution {
  return (RETURN_RESOLUTIONS as readonly string[]).includes(value);
}

/**
 * Allowed status transitions.
 * Terminal: refunded, exchanged, cancelled.
 */
export const RETURN_STATUS_TRANSITIONS: Readonly<Record<ReturnStatus, readonly ReturnStatus[]>> = {
  requested: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['refunded', 'exchanged'],
  refunded: [],
  exchanged: [],
  cancelled: [],
};

export function canTransitionReturnStatus(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_STATUS_TRANSITIONS[from].includes(to);
}
