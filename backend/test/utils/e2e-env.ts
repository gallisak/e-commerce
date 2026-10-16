import { existsSync } from 'node:fs';

export function e2eDatabaseUrl(): string {
  if (existsSync('.env')) process.loadEnvFile('.env');
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}_test`;
  return url.toString();
}
