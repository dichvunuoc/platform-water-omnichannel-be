import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { CheckCoverageQuery } from '../../application/queries/check-coverage.query';
import { GetNearbyIncidentsQuery } from '../../application/queries/get-nearby-incidents.query';

@ApiTags('GIS')
@ApiBearerAuth('JWT-auth')
@Controller('gis')
export class GisController {
  constructor(@Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus) {}

  @Get('coverage')
  @ApiOperation({ summary: 'Check water network coverage for an address' })
  @ApiResponse({ status: 200, description: 'Coverage result' })
  async checkCoverage(@Query('address') address: string) {
    return this.queryBus.execute(new CheckCoverageQuery(address));
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Water incidents near a location' })
  @ApiResponse({ status: 200, description: 'Nearby incidents' })
  async nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.queryBus.execute(
      new GetNearbyIncidentsQuery(Number(lat), Number(lng), radius ? Number(radius) : 2000),
    );
  }
}
