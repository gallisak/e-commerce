import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { e2eDatabaseUrl } from './e2e-env.js';

export default async function setup(): Promise<void> {
  const url = new URL(e2eDatabaseUrl());
  const database = decodeURIComponent(url.pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  maintenance.search = '';

  const client = new pg.Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
  } finally {
    await client.end();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
}
