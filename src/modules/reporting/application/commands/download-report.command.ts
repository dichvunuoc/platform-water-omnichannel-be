import { ICommand } from '@core/application';
import type { DownloadReportResult } from '../dtos/reporting.dto';

export class DownloadReportCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly period: string,
    public readonly format: string,
  ) {}
}
export type DownloadReportResultType = DownloadReportResult;
