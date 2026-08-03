/**
 * Rule-based segment membership (Phase 4 E-02).
 * Order count / spend use caller-supplied stubs for v0.5 — live aggregation can wire later.
 */

export type SegmentTagRules = {
  /** Match if the customer has at least one of these tags. */
  any?: string[];
  /** Match if the customer has every tag in this list. */
  all?: string[];
};

export type SegmentOrderCountRules = {
  /** Inclusive lower bound. */
  min?: number;
  /** Inclusive upper bound. */
  max?: number;
};

export type SegmentSpendRules = {
  /** Inclusive lower bound in minor units (string bigint). */
  min?: string;
  /** Inclusive upper bound in minor units (string bigint). */
  max?: string;
};

/**
 * Stored on {@link CustomerSegmentEntity.rules}.
 * When all condition groups are absent, an active segment matches everyone.
 */
export type SegmentRules = {
  /**
   * How to combine present condition groups (`tags` / `orderCount` / `spendMinor`).
   * Default: `all` (every present group must match).
   */
  match?: 'all' | 'any';
  tags?: SegmentTagRules;
  orderCount?: SegmentOrderCountRules;
  spendMinor?: SegmentSpendRules;
};

/** Evaluation input — tags/orderCount/spendMinor are stubs acceptable for v0.5. */
export type SegmentMembershipContext = {
  customerId: string;
  tags?: readonly string[];
  orderCount?: number;
  /** Lifetime spend in minor units (string bigint). */
  spendMinor?: string;
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function parseMinor(raw: string | undefined): bigint | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function evaluateTags(
  rules: SegmentTagRules,
  tags: readonly string[] | undefined,
): boolean {
  const customerTags = new Set((tags ?? []).map(normalizeTag).filter(Boolean));
  const any = (rules.any ?? []).map(normalizeTag).filter(Boolean);
  const all = (rules.all ?? []).map(normalizeTag).filter(Boolean);

  if (any.length === 0 && all.length === 0) {
    return true;
  }

  const anyOk = any.length === 0 || any.some((t) => customerTags.has(t));
  const allOk = all.length === 0 || all.every((t) => customerTags.has(t));
  return anyOk && allOk;
}

function evaluateOrderCount(
  rules: SegmentOrderCountRules,
  orderCount: number | undefined,
): boolean {
  const count = orderCount ?? 0;
  if (rules.min !== undefined && count < rules.min) return false;
  if (rules.max !== undefined && count > rules.max) return false;
  return true;
}

function evaluateSpend(
  rules: SegmentSpendRules,
  spendMinor: string | undefined,
): boolean {
  const spend = parseMinor(spendMinor) ?? 0n;
  const min = parseMinor(rules.min);
  const max = parseMinor(rules.max);
  if (min !== null && spend < min) return false;
  if (max !== null && spend > max) return false;
  return true;
}

function hasConditionGroup(rules: SegmentRules): boolean {
  return (
    rules.tags !== undefined ||
    rules.orderCount !== undefined ||
    rules.spendMinor !== undefined
  );
}

/**
 * Returns true when `context` satisfies `rules`.
 * Empty / null rules match everyone.
 */
export function evaluateSegmentRules(
  rules: SegmentRules | null | undefined,
  context: SegmentMembershipContext,
): boolean {
  if (!rules || !hasConditionGroup(rules)) {
    return true;
  }

  const results: boolean[] = [];

  if (rules.tags !== undefined) {
    results.push(evaluateTags(rules.tags, context.tags));
  }
  if (rules.orderCount !== undefined) {
    results.push(evaluateOrderCount(rules.orderCount, context.orderCount));
  }
  if (rules.spendMinor !== undefined) {
    results.push(evaluateSpend(rules.spendMinor, context.spendMinor));
  }

  if (results.length === 0) {
    return true;
  }

  const mode = rules.match ?? 'all';
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}
