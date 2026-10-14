import { isCommonPassword, newPasswordSchema } from './password-policy.js';

describe('newPasswordSchema', () => {
  it('accepts a long and uncommon password', () => {
    expect(newPasswordSchema.safeParse('Pointage-Entrepot-42').success).toBe(
      true,
    );
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(newPasswordSchema.safeParse('Testtest1#').success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    expect(newPasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('rejects a common password whatever its case', () => {
    const result = newPasswordSchema.safeParse('Password1234');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('This password is too common');
  });
});

describe('isCommonPassword', () => {
  it.each(['qwerty123456', 'AZERTYUIOP123', '1q2w3e4r5t6y'])(
    'flags %s',
    (password) => {
      expect(isCommonPassword(password)).toBe(true);
    },
  );

  it('lets an unknown password through', () => {
    expect(isCommonPassword('Pointage-Entrepot-42')).toBe(false);
  });
});
