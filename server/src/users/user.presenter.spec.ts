import { presentUser } from './user.presenter.js';

const USER = {
  id: '0199d8a0-0000-7000-8000-000000000001',
  firstName: 'Camille',
  lastName: 'Laurent',
  email: 'camille.laurent@trinitymarket.example',
  phone: '+33612345678',
  role: 'EMPLOYEE' as const,
  contractMinutesPerWeek: 2100,
  timezone: 'Europe/Paris',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$secret',
  microsoftId: 'microsoft-oid',
  createdAt: new Date('2026-10-01T08:00:00.000Z'),
  updatedAt: new Date('2026-10-02T08:00:00.000Z'),
  memberships: [{ team: { id: 'team-id', name: 'Service client' } }],
};

describe('presentUser', () => {
  it('never exposes the password hash or the Microsoft id', () => {
    const presented = presentUser(USER);

    expect(presented).not.toHaveProperty('passwordHash');
    expect(presented).not.toHaveProperty('microsoftId');
    expect(JSON.stringify(presented)).not.toContain('argon2id');
  });

  it('flattens the teams', () => {
    expect(presentUser(USER).teams).toEqual([
      { id: 'team-id', name: 'Service client' },
    ]);
  });

  it.each([
    ['a password', { passwordHash: 'hash', microsoftId: null }, 'ACTIVE'],
    [
      'a Microsoft account',
      { passwordHash: null, microsoftId: 'oid' },
      'ACTIVE',
    ],
    ['neither', { passwordHash: null, microsoftId: null }, 'INVITED'],
  ])(
    'reports the status of an account with %s',
    (_case, credentials, status) => {
      expect(presentUser({ ...USER, ...credentials }).status).toBe(status);
    },
  );
});
