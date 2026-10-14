import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ImageStorageService } from './image-storage.service.js';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('ImageStorageService', () => {
  let dir: string;
  let storage: ImageStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    storage = new ImageStorageService({
      get: () => dir,
    } as unknown as ConfigService<EnvironmentVariables, true>);
    await storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves a real PNG under a random name and returns its public URL', async () => {
    const url = await storage.saveProductImage(PNG_1x1);

    expect(url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);
    expect(existsSync(join(dir, url.replace('/uploads/', '')))).toBe(true);
  });

  it('rejects content that is not an allowed image regardless of the declared type', async () => {
    await expect(
      storage.saveProductImage(Buffer.from('<svg onload=alert(1)>')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(storage.saveProductImage(Buffer.from('GIF89a........'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('removes only files it owns', async () => {
    const url = await storage.saveProductImage(PNG_1x1);
    await storage.removeIfLocal('https://cdn.example.com/products/x.png');
    await storage.removeIfLocal('/uploads/products/../../etc/passwd');
    expect(existsSync(join(dir, url.replace('/uploads/', '')))).toBe(true);

    await storage.removeIfLocal(url);
    expect(existsSync(join(dir, url.replace('/uploads/', '')))).toBe(false);
  });
});
