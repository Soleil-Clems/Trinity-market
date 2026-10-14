import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const commonPasswords = new Set(
  readFileSync(new URL('./common-passwords.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
);

export function isCommonPassword(password: string): boolean {
  return commonPasswords.has(password.toLowerCase());
}

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .refine((password) => !isCommonPassword(password), {
    message: 'This password is too common',
  });
