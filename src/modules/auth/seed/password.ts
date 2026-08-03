import { randomBytes, scryptSync } from 'node:crypto';

/**
 * Hash a password with Node scrypt for seed-time use.
 * Format: `scrypt$<saltHex>$<hashHex>` — Phase C auth may migrate to argon2/bcrypt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
