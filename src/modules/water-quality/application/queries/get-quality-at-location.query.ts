import { IQuery } from '@core/application';
import type { QualityAtLocation } from '../dtos/water-quality.dto';

export class GetQualityAtLocationQuery extends IQuery<QualityAtLocation> {
  constructor(public readonly location: string) {
    super();
  }
}
export type GetQualityAtLocationResult = QualityAtLocation;
