import { z } from 'zod';

type OpenApiProperties = Record<string, Record<string, unknown>>;

export interface ZodDto<T extends z.ZodType = z.ZodType> {
  new (): z.infer<T>;
  schema: T;
  _OPENAPI_METADATA_FACTORY(): OpenApiProperties;
}

export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  abstract class Dto {
    static readonly schema = schema;

    static _OPENAPI_METADATA_FACTORY(): OpenApiProperties {
      const { properties = {}, required = [] } = z.toJSONSchema(schema, {
        io: 'input',
        unrepresentable: 'any',
      }) as {
        properties?: OpenApiProperties;
        required?: string[];
      };

      return Object.fromEntries(
        Object.entries(properties).map(([name, property]) => [
          name,
          { ...property, required: required.includes(name) },
        ]),
      );
    }
  }

  return Dto as unknown as ZodDto<T>;
}
