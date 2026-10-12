import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { createZodDto } from './zod-dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

class SampleDto extends createZodDto(
  z.object({
    email: z.email(),
    age: z.coerce.number().int().min(0),
  }),
) {}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('returns the parsed value when the input is valid', () => {
    const result = pipe.transform(
      { email: 'camille@trinity.fr', age: '31', extra: 'ignored' },
      { type: 'body', metatype: SampleDto },
    );

    expect(result).toEqual({ email: 'camille@trinity.fr', age: 31 });
  });

  it('throws a 422 listing every invalid field', () => {
    expect.assertions(2);

    try {
      pipe.transform(
        { email: 'not-an-email', age: -1 },
        { type: 'body', metatype: SampleDto },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as UnprocessableEntityException).getResponse()).toEqual({
        message: 'Validation failed',
        details: [
          { path: 'email', message: expect.any(String) },
          { path: 'age', message: expect.any(String) },
        ],
      });
    }
  });

  it('leaves the value untouched when the type has no schema', () => {
    const value = { anything: true };

    expect(pipe.transform(value, { type: 'param', metatype: String })).toBe(
      value,
    );
    expect(pipe.transform(value, { type: 'body' })).toBe(value);
  });
});
