/** Canonical audit action strings for auth / identity events (AC-MVP-021). */
export const AuditAction = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  REFRESH: 'auth.refresh',
  LOGOUT: 'auth.logout',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_ASSIGN: 'role.assign',
  ROLE_REMOVE: 'role.remove',
  API_KEY_CREATE: 'api-key.create',
  API_KEY_REVOKE: 'api-key.revoke',
} as const;

export type AuditActionValue =
  (typeof AuditAction)[keyof typeof AuditAction];
