import { Readable } from 'node:stream';
import { Controller, Get, Header, Logger, Query, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { AnalyticsService } from './analytics.service.js';
import { DateRangeQueryDto, SummaryQueryDto } from './dto/analytics-query.dto.js';
import { SalesByDayDto, SalesSummaryDto } from './dto/analytics-response.dto.js';

@ApiTags('admin / analytics')
@ApiBearerAuth()
@ApiForbiddenResponse()
@ApiBadRequestResponse({ description: 'Invalid or too long date range' })
@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOkResponse({ type: SalesSummaryDto })
  getSummary(@Query() query: SummaryQueryDto): Promise<SalesSummaryDto> {
    return this.analyticsService.getSummary(query);
  }

  @Get('sales-by-day')
  @ApiOkResponse({ type: SalesByDayDto })
  getSalesByDay(@Query() query: DateRangeQueryDto): Promise<SalesByDayDto> {
    return this.analyticsService.getSalesByDay(query);
  }

  @Get('sales-report.csv')
  @Header('Cache-Control', 'no-store')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV file, one row per sold order item',
    schema: { type: 'string' },
  })
  exportSalesReport(
    @Query() query: DateRangeQueryDto,
    @CurrentUser() admin: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const report = this.analyticsService.exportSalesReport(query, admin);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    return new StreamableFile(Readable.from(report.rows), {
      type: 'text/csv; charset=utf-8',
    }).setErrorHandler((error) => {
      this.logger.error(`Sales report export failed: ${error.message}`);
      res.destroy(error);
    });
  }
}
