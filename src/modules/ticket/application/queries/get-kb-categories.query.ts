/**
 * Get KB Categories Query (AC#1 — FR48)
 *
 * Fetches FAQ topic categories from downstream KB Service.
 */

import { IQuery } from '@core/application';
import type { GetCategoriesResponse } from '../dtos/knowledge-base.dto';

export class GetKbCategoriesQuery extends IQuery<GetCategoriesResponse> {}

export type GetKbCategoriesResult = GetCategoriesResponse;
