import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import type { EnvironmentVariables } from '../config/env.validation.js';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const UPLOADS_URL_PREFIX = '/uploads/';
const PRODUCT_IMAGES_DIR = 'products';

@Injectable()
export class ImageStorageService implements OnModuleInit {
  private readonly logger = new Logger(ImageStorageService.name);
  private readonly rootDir: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.rootDir = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  async onModuleInit(): Promise<void> {
    await mkdir(join(this.rootDir, PRODUCT_IMAGES_DIR), { recursive: true });
  }

  async saveProductImage(buffer: Buffer): Promise<string> {
    const detected = await fileTypeFromBuffer(buffer);
    const extension = detected ? ALLOWED_TYPES[detected.mime] : undefined;
    if (!extension) {
      throw new BadRequestException('Only JPEG, PNG and WebP images are allowed');
    }

    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(join(this.rootDir, PRODUCT_IMAGES_DIR, fileName), buffer);
    return `${UPLOADS_URL_PREFIX}${PRODUCT_IMAGES_DIR}/${fileName}`;
  }

  async removeIfLocal(url: string | null): Promise<void> {
    if (!url?.startsWith(`${UPLOADS_URL_PREFIX}${PRODUCT_IMAGES_DIR}/`)) return;
    const fileName = url.slice(url.lastIndexOf('/') + 1);
    if (!/^[\w-]+\.(jpg|png|webp)$/.test(fileName)) return;

    await unlink(join(this.rootDir, PRODUCT_IMAGES_DIR, fileName)).catch((error: Error) =>
      this.logger.warn(`Failed to remove image ${fileName}: ${error.message}`),
    );
  }
}
