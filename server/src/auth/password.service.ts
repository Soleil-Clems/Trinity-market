import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  private placeholderHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(
    passwordHash: string | null,
    password: string,
  ): Promise<boolean> {
    if (!passwordHash) {
      await this.spendVerificationTime(password);
      return false;
    }

    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  private async spendVerificationTime(password: string): Promise<void> {
    this.placeholderHash ??= hash('placeholder-password-never-matches');
    await verify(await this.placeholderHash, password);
  }
}
