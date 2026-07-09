import { IQuery } from '@core/application';
import type { GetCustomerLocationResponse } from '../dtos/gis.dto';

export class GetCustomerLocationQuery extends IQuery<GetCustomerLocationResponse> {
  constructor(public readonly customerId: string) {
    super();
  }
}
export type GetCustomerLocationResult = GetCustomerLocationResponse;
