import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash a password with Node scrypt.
 * Format: `scrypt$<saltHex>$<hashHex>`
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verify a plaintext password against a stored `scrypt$…` hash.
 * Returns false for unknown formats or mismatched lengths (no throw).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const computedHex = scryptSync(password, salt, 64).toString('hex');
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const computed = Buffer.from(computedHex, 'hex');
    if (expected.length !== computed.length) {
      return false;
    }
    return timingSafeEqual(expected, computed);
  } catch {
    return false;
  }
}
