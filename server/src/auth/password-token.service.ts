import { Injectable } from '@nestjs/common';
import type { TokenPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACTIVATION_TTL_MS, PASSWORD_RESET_TTL_MS } from './auth.constants.js';
import { generateOpaqueToken, hashOpaqueToken } from './opaque-token.js';

const TTL_BY_PURPOSE: Record<TokenPurpose, number> = {
  ACTIVATION: ACTIVATION_TTL_MS,
  PASSWORD_RESET: PASSWORD_RESET_TTL_MS,
};

@Injectable()
export class PasswordTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, purpose: TokenPurpose): Promise<string> {
    const token = generateOpaqueToken();

    await this.invalidateAll(userId);
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + TTL_BY_PURPOSE[purpose]),
      },
    });

    return token;
  }

  async consume(token: string): Promise<string | null> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      select: { id: true, userId: true, user: { select: { deletedAt: true } } },
    });

    if (!stored || stored.user.deletedAt) {
      return null;
    }

    const now = new Date();
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    return count === 1 ? stored.userId : null;
  }

  async invalidateAll(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
