import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @IsInt()
  REDIS_PORT: number = 6379;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  QUEUE_PREFIX: string = 'bull';

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsInt()
  @Min(300)
  JWT_REFRESH_TTL_SECONDS: number = 604800;

  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY: number = 0;

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:5173';

  @IsString()
  UPLOAD_DIR: string = 'uploads';

  @IsInt()
  @Min(1)
  @Max(50)
  UPLOAD_MAX_FILE_SIZE_MB: number = 5;

  @IsInt()
  @Min(1)
  CATALOG_CACHE_TTL_SECONDS: number = 300;

  @IsInt()
  @Min(0)
  @Max(60_000)
  PAYMENT_MOCK_DELAY_MS: number = 1500;

  @IsNumber()
  @Min(0)
  @Max(1)
  PAYMENT_MOCK_FAILURE_RATE: number = 0;

  @IsInt()
  @Min(0)
  ORDER_RECOVERY_INTERVAL_SECONDS: number = 60;

  @IsTimeZone()
  STORE_TIMEZONE: string = 'Europe/Kyiv';

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 300;

  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS: number = 60;

  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_LIMIT: number = 5;

  @IsInt()
  @Min(1)
  LOGIN_THROTTLE_TTL_SECONDS: number = 60;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    { ...config, COOKIE_SECURE: config.COOKIE_SECURE === 'true' || config.COOKIE_SECURE === true },
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return validated;
}
