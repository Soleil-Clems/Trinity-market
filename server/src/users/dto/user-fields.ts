import { z } from 'zod';
import { emailSchema } from '../../auth/dto/login.dto.js';

export const MAX_CONTRACT_MINUTES_PER_WEEK = 48 * 60;

export const nameSchema = z.string().trim().min(1).max(100);

export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s.()-]/g, ''))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{6,14}$/,
        'Phone number must be in international format, for example +33612345678',
      ),
  );

export const contractMinutesSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_CONTRACT_MINUTES_PER_WEEK);

export const timezoneSchema = z
  .string()
  .refine((zone) => Intl.supportedValuesOf('timeZone').includes(zone), {
    message: 'Unknown IANA time zone',
  });

export { emailSchema };
