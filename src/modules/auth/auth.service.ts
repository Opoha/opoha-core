import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { AuditAction } from './audit/audit-actions';
import { AuditLogsService } from './audit/audit-logs.service';
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
    private readonly auditLogs: AuditLogsService,
    private readonly eventBus: EventBusService,
  ) {}

  async login(email: string, password: string): Promise<AuthPayload> {
    const normalized = email.trim().toLowerCase();
    const user = await this.usersService.findByEmailWithHash(normalized);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await this.auditLogs.append({
        action: AuditAction.LOGIN_FAILURE,
        metadata: { email: normalized },
      });
      await this.eventBus.publish({
        eventName: CoreEventName.LoginFailed,
        aggregateType: 'user',
        aggregateId: user?.id ?? normalized,
        data: {
          email: normalized,
          reason: 'invalid_credentials' as const,
          ...(user ? { userId: user.id } : {}),
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      await this.auditLogs.append({
        action: AuditAction.LOGIN_FAILURE,
        actorUserId: user.id,
        resourceType: 'user',
        resourceId: user.id,
        metadata: { email: normalized, reason: 'inactive' },
      });
      await this.eventBus.publish({
        eventName: CoreEventName.LoginFailed,
        aggregateType: 'user',
        aggregateId: user.id,
        data: {
          email: normalized,
          reason: 'inactive' as const,
          userId: user.id,
        },
        metadata: { actorId: user.id },
      });
      throw new UnauthorizedException('User account is inactive');
    }
    const tokens = await this.issueTokens(user);
    await this.auditLogs.append({
      action: AuditAction.LOGIN_SUCCESS,
      actorUserId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      metadata: { email: user.email },
    });
    await this.eventBus.publish({
      eventName: CoreEventName.LoginSucceeded,
      aggregateType: 'user',
      aggregateId: user.id,
      data: {
        userId: user.id,
        email: user.email,
      },
      metadata: { actorId: user.id },
    });
    return tokens;
  }

  /**
   * Rotate refresh token and issue a new access + refresh pair.
   * Revoked or replayed refresh tokens are rejected.
   */
  async refresh(rawRefreshToken: string): Promise<AuthPayload> {
    const { userId, refreshToken } = await this.refreshTokensService.rotate(rawRefreshToken);
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive or not found');
    }
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    await this.auditLogs.append({
      action: AuditAction.REFRESH,
      actorUserId: user.id,
      resourceType: 'user',
      resourceId: user.id,
    });
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

  /** Revoke a refresh token (idempotent). */
  async logout(rawRefreshToken: string): Promise<boolean> {
    await this.refreshTokensService.revoke(rawRefreshToken);
    await this.auditLogs.append({
      action: AuditAction.LOGOUT,
      metadata: { revoked: true },
    });
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
