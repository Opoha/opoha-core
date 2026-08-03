import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './jwt/gql-auth.guard';
import { JwtStrategy } from './jwt/jwt.strategy';
import { PermissionsResolver } from './permissions/permissions.resolver';
import { PermissionsService } from './permissions/permissions.service';
import { RolesResolver } from './roles/roles.resolver';
import { RolesService } from './roles/roles.service';
import { UsersResolver } from './users/users.resolver';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ConfigModule,
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
    JwtStrategy,
    GqlAuthGuard,
  ],
  exports: [
    AuthService,
    UsersService,
    RolesService,
    PermissionsService,
    GqlAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
