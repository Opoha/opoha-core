import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { loadEnv } from '../../config/env.schema';
import { UsersService } from '../users/users.service';
import type { AuthUser, JwtPayload } from './auth-user';

/** Passport JWT strategy. Secret via loadEnv() — PassportStrategy breaks ConfigService DI. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    const { JWT_SECRET } = loadEnv();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive or not found');
    }
    return {
      userId: user.id,
      email: user.email,
      ...(payload.storeId ? { storeId: payload.storeId } : {}),
      ...(payload.storeCode ? { storeCode: payload.storeCode } : {}),
    };
  }
}
