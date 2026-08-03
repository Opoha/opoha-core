import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ConfigService } from '../../config/config.service';
import { generateOpaqueToken, hashOpaqueToken } from '../crypto/token-hash';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit]!;
}

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokens: Repository<RefreshTokenEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async issue(userId: string): Promise<string> {
    const raw = generateOpaqueToken('opr_');
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.config.get('JWT_REFRESH_EXPIRES_IN')),
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: hashOpaqueToken(raw),
        expiresAt,
      }),
    );
    return raw;
  }

  async rotate(
    rawRefreshToken: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const existing = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.revokedAt) {
      await this.refreshTokens.update(
        { userId: existing.userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token revoked');
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const nextRaw = generateOpaqueToken('opr_');
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(this.config.get('JWT_REFRESH_EXPIRES_IN')),
    );

    const next = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(RefreshTokenEntity, {
          userId: existing.userId,
          tokenHash: hashOpaqueToken(nextRaw),
          expiresAt,
        }),
      );
      await manager.update(RefreshTokenEntity, existing.id, {
        revokedAt: new Date(),
        replacedById: created.id,
      });
      return created;
    });

    return { userId: next.userId, refreshToken: nextRaw };
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    await this.refreshTokens.update({ tokenHash, revokedAt: IsNull() }, {
      revokedAt: new Date(),
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, {
      revokedAt: new Date(),
    });
  }
}
