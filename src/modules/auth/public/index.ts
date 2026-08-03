/**
 * Public auth surface for other core modules.
 */
export { AuthModule } from '../auth.module';
export { AuthService } from '../auth.service';
export { GqlAuthGuard } from '../jwt/gql-auth.guard';
export { CurrentUser } from '../jwt/current-user.decorator';
export type { AuthUser, JwtPayload } from '../jwt/auth-user';
export { UsersService } from '../users/users.service';
export { RolesService } from '../roles/roles.service';
export { PermissionsService } from '../permissions/permissions.service';
export { hashPassword, verifyPassword } from '../seed/password';
export {
  DEFAULT_ADMIN_ROLE_NAME,
  DEFAULT_PERMISSIONS,
  seedAuth,
} from '../seed/seed-auth';
