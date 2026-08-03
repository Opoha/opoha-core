/**
 * Authenticated staff principal attached to GraphQL/HTTP request after JWT validation.
 * Customers are out of MVP scope — any authenticated user is staff.
 */
export type AuthUser = {
  userId: string;
  email: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
};
