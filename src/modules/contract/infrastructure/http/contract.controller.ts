/**
 * Contract Controller
 *
 * REST endpoints for contract operations.
 * Thin pass-through: validates input → dispatches CQRS → returns result.
 *
 * AC: #1 (contracts list), #2 (detail), #3 (versions), #4 (PDF)
 */

import { Controller, Get, Param, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QUERY_BUS_TOKEN } from '@core/constants/tokens';
import type { IQueryBus } from '@core/application';
import { GetContractsQuery } from '../../application/queries/get-contracts.query';
import { GetContractDetailQuery } from '../../application/queries/get-contract-detail.query';
import { GetContractVersionsQuery } from '../../application/queries/get-contract-versions.query';
import { GetContractPDFQuery } from '../../application/queries/get-contract-pdf.query';
import { ValidationException } from '@core/common';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { ContractQuerySchema, ContractIdParamSchema } from '../../application/dtos/contract-query.dto';

@ApiTags('Contract')
@ApiBearerAuth('JWT-auth')
@Controller('contracts')
export class ContractController {

  constructor(
    @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus,
  ) {}

  /**
   * GET /contracts
   * Get customer's contract list (AC#1)
   */
  @Get()
  @ApiOperation({ summary: 'Get customer contracts' })
  async getContracts(@CurrentUser('id') userId: string, @Query() query: unknown) {
    const parsed = ContractQuerySchema.safeParse(query);
    const filters = parsed.success ? parsed.data : undefined;
    return this.queryBus.execute(new GetContractsQuery(userId, filters));
  }

  /**
   * GET /contracts/:contractId
   * Get contract detail (AC#2)
   */
  @Get(':contractId')
  @ApiOperation({ summary: 'Get contract detail' })
  async getContractDetail(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
  ) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetContractDetailQuery(userId, contractId));
  }

  /**
   * GET /contracts/:contractId/versions
   * Get contract version history (AC#3)
   */
  @Get(':contractId/versions')
  @ApiOperation({ summary: 'Get contract version history' })
  async getContractVersions(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
  ) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetContractVersionsQuery(userId, contractId));
  }

  /**
   * GET /contracts/:contractId/pdf
   * Get contract PDF download URL (AC#4)
   */
  @Get(':contractId/pdf')
  @ApiOperation({ summary: 'Get contract PDF download URL' })
  async getContractPDF(
    @CurrentUser('id') userId: string,
    @Param('contractId') contractId: string,
  ) {
    this.validateContractId(contractId);
    return this.queryBus.execute(new GetContractPDFQuery(userId, contractId));
  }

  /**
   * Validate contractId param format — alphanumeric, dashes, underscores only.
   */
  private validateContractId(contractId: string): void {
    const parsed = ContractIdParamSchema.safeParse(contractId);
    if (!parsed.success) {
      throw new ValidationException('Invalid contract ID format');
    }
  }
}
