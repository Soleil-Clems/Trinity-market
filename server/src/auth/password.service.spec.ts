import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes with argon2id and never stores the password', async () => {
    const hash = await passwords.hash('TimeManager-Demo-2026');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('TimeManager-Demo-2026');
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await passwords.hash('TimeManager-Demo-2026');

    await expect(passwords.verify(hash, 'TimeManager-Demo-2026')).resolves.toBe(
      true,
    );
    await expect(passwords.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('rejects any password when the account has no hash', async () => {
    await expect(passwords.verify(null, 'anything')).resolves.toBe(false);
  });

  it('rejects a malformed hash instead of throwing', async () => {
    await expect(passwords.verify('not-a-hash', 'anything')).resolves.toBe(
      false,
    );
  });
});
