import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttemptLimiterService } from './attempt-limiter.service.js';
import type { AuthenticatedUser } from './current-user.decorator.js';
import { activationMail, passwordResetMail } from './password-mails.js';
import { PasswordTokenService } from './password-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

const RECIPIENT_FIELDS = { id: true, email: true, firstName: true } as const;

@Injectable()
export class PasswordManagementService {
  private readonly logger = new Logger(PasswordManagementService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly passwordTokens: PasswordTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly limiter: AttemptLimiterService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  async sendActivation(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId, deletedAt: null },
      select: RECIPIENT_FIELDS,
    });
    const token = await this.passwordTokens.issue(user.id, 'ACTIVATION');

    await this.mail.send(activationMail(user, this.link('activate', token)));
  }

  async requestReset(email: string, ip: string): Promise<void> {
    await this.limiter.assertAllowed('forgot-password', [ip, email]);
    await this.limiter.record('forgot-password', [ip, email]);

    void this.sendResetLink(email).catch((error: unknown) =>
      this.logger.error(
        `Password reset mail failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await this.passwords.hash(password);
    const userId = await this.passwordTokens.consume(token);

    if (!userId) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.passwordTokens.invalidateAll(userId);
    await this.refreshTokens.revokeAllForUser(userId);
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.limiter.assertAllowed('password-change', [user.id]);

    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!(await this.passwords.verify(account.passwordHash, currentPassword))) {
      await this.limiter.record('password-change', [user.id]);
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        details: [
          {
            path: 'currentPassword',
            message: 'Current password is incorrect',
          },
        ],
      });
    }

    await this.limiter.reset('password-change', [user.id]);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(newPassword) },
    });
    await this.passwordTokens.invalidateAll(user.id);
    await this.refreshTokens.revokeAllForUser(user.id, user.sessionId);
  }

  private async sendResetLink(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: RECIPIENT_FIELDS,
    });

    if (!user) {
      return;
    }

    const token = await this.passwordTokens.issue(user.id, 'PASSWORD_RESET');

    await this.mail.send(
      passwordResetMail(user, this.link('reset-password', token)),
    );
  }

  private link(page: string, token: string): string {
    return `${this.appUrl}/${page}?token=${token}`;
  }
}
