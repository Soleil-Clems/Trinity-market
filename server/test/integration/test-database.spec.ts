import { testDatabase } from './test-database.js';

describe('testDatabase', () => {
  it('derives a separate test database from the application one', () => {
    expect(
      testDatabase('postgresql://app:secret@database:5432/app?schema=public'),
    ).toEqual({
      name: 'app_test',
      url: 'postgresql://app:secret@database:5432/app_test?schema=public',
      adminUrl: 'postgresql://app:secret@database:5432/app?schema=public',
    });
  });

  it('does not add the suffix twice', () => {
    expect(
      testDatabase('postgresql://app:secret@database:5432/app_test').name,
    ).toBe('app_test');
  });

  it('explains how to run the tests when the URL is missing', () => {
    expect(() => testDatabase('')).toThrow(/make test-int/);
  });
});
