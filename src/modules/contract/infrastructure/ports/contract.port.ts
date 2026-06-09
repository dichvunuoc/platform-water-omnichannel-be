/**
 * Contract Port Interface & Mock Adapter
 *
 * Defines the contract for downstream contract service communication.
 * MockContractAdapter returns mock data during development.
 *
 * AC: #1 (getContracts), #2 (getContractDetail), #3 (getContractVersions), #4 (getContractPDF)
 */

import { Injectable, Logger } from '@nestjs/common';
import { MockAdapterBase } from '@shared/port/mock-adapter.base';
import { IPortAdapter } from '@shared/port/port.interface';
import {
  ContractListResponseSchema,
  ContractDetailResponseSchema,
  ContractVersionsResponseSchema,
  ContractPDFResponseSchema,
} from '../../application/dtos/contract.dto';

/**
 * Contract Port Interface
 *
 * Methods: get-contracts, get-contract-detail, get-contract-versions, get-contract-pdf
 * Each method is dispatched via PortRegistry.execute('contract', method, params).
 */
export interface IContractPort extends IPortAdapter {
  // Methods are invoked via execute(method, params) from IPortAdapter
}

/**
 * Mock Contract Adapter
 *
 * Returns mock contract responses from JSON files for development.
 * Extends MockAdapterBase for consistent mock behavior.
 */
@Injectable()
export class MockContractAdapter extends MockAdapterBase implements IContractPort {
  constructor() {
    super(
      'contract',
      {
        'get-contracts': ContractListResponseSchema,
        'get-contract-detail': ContractDetailResponseSchema,
        'get-contract-versions': ContractVersionsResponseSchema,
        'get-contract-pdf': ContractPDFResponseSchema,
      },
      new Logger('contract-mock-adapter'),
    );
  }
}
