import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto.js';
import { Role } from '../../generated/prisma/enums.js';
import {
  contractMinutesSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
  timezoneSchema,
} from './user-fields.js';

const atLeastOneField = (value: Record<string, unknown>) =>
  Object.values(value).some((field) => field !== undefined);

export class ListUsersQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    teamId: z.uuid().optional(),
    role: z.enum(Role).optional(),
  }),
) {}

export class CreateUserDto extends createZodDto(
  z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: phoneSchema.optional(),
    contractMinutesPerWeek: contractMinutesSchema,
    timezone: timezoneSchema.optional(),
    role: z.enum(Role).optional(),
    teamIds: z
      .array(z.uuid())
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Duplicate team id',
      })
      .default([]),
  }),
) {}

export class UpdateUserDto extends createZodDto(
  z
    .object({
      firstName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      email: emailSchema.optional(),
      phone: phoneSchema.nullable().optional(),
      contractMinutesPerWeek: contractMinutesSchema.optional(),
    })
    .strict()
    .refine(atLeastOneField, { message: 'At least one field is required' }),
) {}

export class UpdateMeDto extends createZodDto(
  z
    .object({
      firstName: nameSchema.optional(),
      lastName: nameSchema.optional(),
      phone: phoneSchema.nullable().optional(),
    })
    .strict()
    .refine(atLeastOneField, { message: 'At least one field is required' }),
) {}
