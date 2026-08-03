/**
 * Declarative rule conditions + action refs (Phase 8 C-01/C-02).
 */

export type RuleConditionEquals = {
  /** Dot-path into event `data` (e.g. `currencyCode`, `customerId`). */
  path: string;
  value: unknown;
};

/**
 * Stored on {@link RuleDefinitionEntity.conditions}.
 * Empty / null conditions match every event of the rule's `eventName`.
 */
export type RuleConditions = {
  /**
   * How to combine `equals` clauses.
   * Default: `all` (every clause must match).
   */
  match?: 'all' | 'any';
  equals?: RuleConditionEquals[];
};

/** Action invocation stored on the rule (resolved via RuleActionRegistry). */
export type RuleActionRef = {
  /** Registry key (e.g. `customer.tag`, `notification.emit`). */
  action: string;
  params?: Record<string, unknown>;
};

function getPath(data: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) {
    return undefined;
  }
  const parts = trimmed.split('.').filter(Boolean);
  let cur: unknown = data;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left == null || right == null) {
    return left === right;
  }
  // Coerce numeric string compare for money/minor fields.
  if (
    (typeof left === 'string' || typeof left === 'number') &&
    (typeof right === 'string' || typeof right === 'number')
  ) {
    return String(left) === String(right);
  }
  return false;
}

/**
 * Returns true when `data` satisfies `conditions`.
 * Empty / null conditions match everything.
 */
export function evaluateRuleConditions(
  conditions: RuleConditions | null | undefined,
  data: unknown,
): boolean {
  if (!conditions) {
    return true;
  }
  const equals = conditions.equals ?? [];
  if (equals.length === 0) {
    return true;
  }

  const results = equals.map((clause) =>
    valuesEqual(getPath(data, clause.path), clause.value),
  );
  const mode = conditions.match ?? 'all';
  return mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

export function normalizeActionRefs(
  refs: RuleActionRef[] | null | undefined,
): RuleActionRef[] {
  if (!refs || !Array.isArray(refs)) {
    return [];
  }
  const out: RuleActionRef[] = [];
  for (const ref of refs) {
    const action =
      typeof ref?.action === 'string' ? ref.action.trim() : '';
    if (!action) {
      continue;
    }
    const params =
      ref.params &&
      typeof ref.params === 'object' &&
      !Array.isArray(ref.params)
        ? (ref.params as Record<string, unknown>)
        : undefined;
    out.push(params === undefined ? { action } : { action, params });
  }
  return out;
}
