/**
 * Authenticated staff principal attached to GraphQL/HTTP request after JWT or API-key validation.
 * Customers are out of MVP scope — any authenticated user is staff.
 */
export type AuthUser = {
  userId: string;
  email: string;
  /** Present when authenticated via API key — scopes RBAC to key grants. */
  apiKeyId?: string;
  /** Explicit permission keys (API-key scoped); omit for JWT (load from roles). */
  permissions?: string[];
};

export type JwtPayload = {
  sub: string;
  email: string;
};
