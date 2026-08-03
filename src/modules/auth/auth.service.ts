import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AuthPayload } from './auth.types';
import type { JwtPayload } from './jwt/auth-user';
import { RefreshTokensService } from './refresh/refresh-tokens.service';
import { verifyPassword } from './seed/password';
import { UsersService } from './users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  async login(email: string, password: string): Promise<AuthPayload> {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersService.findByEmailWithHash(normalized);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }
    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthPayload> {
    const { userId, refreshToken } =
      await this.refreshTokensService.rotate(rawRefreshToken);
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive or not found');
    }
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async logout(rawRefreshToken: string): Promise<boolean> {
    await this.refreshTokensService.revoke(rawRefreshToken);
    return true;
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AuthPayload> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.refreshTokensService.issue(user.id),
    ]);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}
