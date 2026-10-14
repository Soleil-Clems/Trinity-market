import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto.js';
import { newPasswordSchema } from '../password-policy.js';
import { emailSchema } from './login.dto.js';

export class ForgotPasswordDto extends createZodDto(
  z.object({ email: emailSchema }),
) {}

export class ResetPasswordDto extends createZodDto(
  z.object({
    token: z.string().min(1).max(256),
    password: newPasswordSchema,
  }),
) {}

export class ChangePasswordDto extends createZodDto(
  z.object({
    currentPassword: z.string().min(1).max(1024),
    newPassword: newPasswordSchema,
  }),
) {}
