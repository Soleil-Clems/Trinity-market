import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_TOKEN_TTL_MS } from './auth.constants.js';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export type RotationResult =
  | { status: 'rotated'; userId: string; refreshToken: IssuedRefreshToken }
  | { status: 'rejected' };

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: RefreshTokenService.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async rotate(token: string): Promise<RotationResult> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenService.hashToken(token) },
      include: { user: { select: { deletedAt: true } } },
    });

    if (!stored) {
      return { status: 'rejected' };
    }

    if (stored.revokedAt || stored.user.deletedAt) {
      await this.revokeFamily(stored.familyId);
      return { status: 'rejected' };
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      return { status: 'rejected' };
    }

    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count !== 1) {
      await this.revokeFamily(stored.familyId);
      return { status: 'rejected' };
    }

    return {
      status: 'rotated',
      userId: stored.userId,
      refreshToken: await this.issue(stored.userId, stored.familyId),
    };
  }

  async revoke(token: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenService.hashToken(token) },
      select: { familyId: true },
    });

    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
