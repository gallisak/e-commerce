import { Global, Module } from '@nestjs/common';
import { CatalogCacheService } from './catalog-cache.service.js';

@Global()
@Module({
  providers: [CatalogCacheService],
  exports: [CatalogCacheService],
})
export class CatalogCacheModule {}
