import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ATTEMPT_WINDOW_MS, MAX_ATTEMPTS } from './auth.constants.js';
import { hashOpaqueToken } from './opaque-token.js';

export type AttemptScope = 'login' | 'forgot-password' | 'password-change';

@Injectable()
export class AttemptLimiterService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(scope: AttemptScope, subject: string[]): Promise<void> {
    const attempts = await this.prisma.authAttempt.count({
      where: {
        keyHash: this.keyHash(scope, subject),
        attemptedAt: { gt: this.windowStart() },
      },
    });

    if (attempts >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many attempts, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async record(scope: AttemptScope, subject: string[]): Promise<void> {
    await this.prisma.authAttempt.deleteMany({
      where: { attemptedAt: { lte: this.windowStart() } },
    });
    await this.prisma.authAttempt.create({
      data: { keyHash: this.keyHash(scope, subject) },
    });
  }

  async reset(scope: AttemptScope, subject: string[]): Promise<void> {
    await this.prisma.authAttempt.deleteMany({
      where: { keyHash: this.keyHash(scope, subject) },
    });
  }

  private keyHash(scope: AttemptScope, subject: string[]): string {
    return hashOpaqueToken(JSON.stringify([scope, ...subject]));
  }

  private windowStart(): Date {
    return new Date(Date.now() - ATTEMPT_WINDOW_MS);
  }
}
