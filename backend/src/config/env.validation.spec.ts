import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_HOST: 'localhost',
  JWT_ACCESS_SECRET: 'access-secret-that-is-long-enough-123456',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-long-enough-12345',
  CORS_ORIGIN: 'http://localhost:5173',
};

const placeholders = {
  JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-chars',
  JWT_REFRESH_SECRET: 'change-me-refresh-secret-at-least-32-chars',
};

describe('validateEnv', () => {
  it('accepts placeholder secrets outside production', () => {
    expect(() => validateEnv({ ...base, ...placeholders })).not.toThrow();
  });

  it('refuses placeholder secrets and insecure cookies in production', () => {
    expect(() => validateEnv({ ...base, ...placeholders, NODE_ENV: 'production' })).toThrow(
      /JWT_ACCESS_SECRET must be replaced[\s\S]*JWT_REFRESH_SECRET must be replaced[\s\S]*COOKIE_SECURE must be true/,
    );
  });

  it('requires different access and refresh secrets in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  });

  it('accepts a real production configuration', () => {
    const env = validateEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true' });
    expect(env).toMatchObject({ COOKIE_SECURE: true, DEMO_MODE: false });
  });

  it('allows the demo stack to run in production mode with demo secrets', () => {
    const env = validateEnv({
      ...base,
      ...placeholders,
      NODE_ENV: 'production',
      DEMO_MODE: 'true',
    });
    expect(env.DEMO_MODE).toBe(true);
  });

  it('caps the upload size at what nginx accepts', () => {
    expect(() => validateEnv({ ...base, UPLOAD_MAX_FILE_SIZE_MB: '10' })).toThrow(
      /UPLOAD_MAX_FILE_SIZE_MB/,
    );
  });
});
