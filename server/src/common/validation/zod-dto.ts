import { z } from 'zod';

export interface ZodDto<T extends z.ZodType = z.ZodType> {
  new (): z.infer<T>;
  schema: T;
}

export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  abstract class Dto {
    static readonly schema = schema;
  }

  return Dto as unknown as ZodDto<T>;
}
