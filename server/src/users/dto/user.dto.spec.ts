import { CreateUserDto, UpdateMeDto, UpdateUserDto } from './user.dto.js';

const VALID = {
  firstName: 'Léa',
  lastName: 'Martin',
  email: 'Lea.Martin@TrinityMarket.example',
  contractMinutesPerWeek: 2100,
};

describe('user DTOs', () => {
  it('normalizes the email and defaults teamIds', () => {
    expect(CreateUserDto.schema.parse(VALID)).toMatchObject({
      email: 'lea.martin@trinitymarket.example',
      teamIds: [],
    });
  });

  it.each(['+33 6 12 34 56 78', '+33.6.12.34.56.78', '+1 (415) 555-0100'])(
    'accepts and normalizes the international phone %s',
    (phone) => {
      const { phone: parsed } = CreateUserDto.schema.parse({ ...VALID, phone });

      expect(parsed).toMatch(/^\+\d+$/);
    },
  );

  it.each(['0612345678', '+0612345678', '+33', 'not a phone'])(
    'rejects the phone %s',
    (phone) => {
      expect(CreateUserDto.schema.safeParse({ ...VALID, phone }).success).toBe(
        false,
      );
    },
  );

  it('rejects a contract above the 48 hour legal maximum', () => {
    expect(
      CreateUserDto.schema.safeParse({
        ...VALID,
        contractMinutesPerWeek: 48 * 60 + 1,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown time zone', () => {
    expect(
      CreateUserDto.schema.safeParse({ ...VALID, timezone: 'Mars/Olympus' })
        .success,
    ).toBe(false);
  });

  it('rejects duplicate team ids', () => {
    const id = '0199d8a0-0000-7000-8000-000000000001';

    expect(
      CreateUserDto.schema.safeParse({ ...VALID, teamIds: [id, id] }).success,
    ).toBe(false);
  });

  it('refuses an empty update', () => {
    expect(UpdateUserDto.schema.safeParse({}).success).toBe(false);
  });

  it('refuses a role change through the user update', () => {
    expect(UpdateUserDto.schema.safeParse({ role: 'ADMIN' }).success).toBe(
      false,
    );
  });

  it.each(['email', 'contractMinutesPerWeek', 'role'])(
    'refuses %s in a self update',
    (field) => {
      expect(
        UpdateMeDto.schema.safeParse({ firstName: 'Léa', [field]: 'x' })
          .success,
      ).toBe(false);
    },
  );

  it('lets a user remove their phone', () => {
    expect(UpdateMeDto.schema.parse({ phone: null })).toEqual({ phone: null });
  });
});
