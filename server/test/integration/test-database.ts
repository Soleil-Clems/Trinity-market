const SUFFIX = '_test';

export interface TestDatabase {
  name: string;
  url: string;
  adminUrl: string;
}

export function testDatabase(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): TestDatabase {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required: run the integration tests with `make test-int`',
    );
  }

  const url = new URL(databaseUrl);
  const current = url.pathname.slice(1);
  const base = current.endsWith(SUFFIX)
    ? current.slice(0, -SUFFIX.length)
    : current;
  const admin = new URL(databaseUrl);

  url.pathname = `/${base}${SUFFIX}`;
  admin.pathname = `/${base}`;

  return {
    name: `${base}${SUFFIX}`,
    url: url.toString(),
    adminUrl: admin.toString(),
  };
}
