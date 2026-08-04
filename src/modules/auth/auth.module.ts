import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { EventBusModule } from '../event-bus/event-bus.module';
import { ApiKeysResolver } from './api-keys/api-keys.resolver';
import { ApiKeysService } from './api-keys/api-keys.service';
import { AuditLogsResolver } from './audit/audit-logs.resolver';
import { AuditLogsService } from './audit/audit-logs.service';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { authEntities } from './entities';
import { AuthEventsRegistrar } from './events/auth-events.registrar';
import { GqlAuthGuard } from './jwt/gql-auth.guard';
import { JwtStrategy } from './jwt/jwt.strategy';
import { PermissionsGuard } from './permissions/permissions.guard';
import { PermissionsResolver } from './permissions/permissions.resolver';
import { PermissionsService } from './permissions/permissions.service';
import { RefreshTokensService } from './refresh/refresh-tokens.service';
import { RolesResolver } from './roles/roles.resolver';
import { RolesService } from './roles/roles.service';
import { UsersResolver } from './users/users.resolver';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ConfigModule,
    EventBusModule,
    TypeOrmModule.forFeature([...authEntities]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    UsersService,
    UsersResolver,
    RolesService,
    RolesResolver,
    PermissionsService,
    PermissionsResolver,
    PermissionsGuard,
    RefreshTokensService,
    ApiKeysService,
    ApiKeysResolver,
    AuditLogsService,
    AuditLogsResolver,
    AuthEventsRegistrar,
    JwtStrategy,
    GqlAuthGuard,
  ],
  exports: [
    AuthService,
    UsersService,
    RolesService,
    PermissionsService,
    PermissionsGuard,
    ApiKeysService,
    AuditLogsService,
    RefreshTokensService,
    GqlAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
