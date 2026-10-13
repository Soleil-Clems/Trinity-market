import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto.js';

export class LoginDto extends createZodDto(
  z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
    password: z.string().min(1).max(1024),
  }),
) {}
