/** CsatModule port + token + mock adapter (khảo sát hài lòng → csat service). */
import { Injectable } from '@nestjs/common';
import { cskhCsat, type CsatAggregate } from '../cskh-bff/cskh-fixture';

export const CSAT_PORT_TOKEN = 'CSKH_CSAT_PORT';
export interface ICsatPort {
  aggregate(): CsatAggregate;
  submit(input: {
    ticketId: string;
    score: number;
    ch: string;
    agent: string;
    topic: string;
    text?: string;
  }): { ok: true; reopened: boolean };
}

@Injectable()
export class MockCsatAdapter implements ICsatPort {
  aggregate() {
    return cskhCsat;
  }
  submit(input: { score: number }): { ok: true; reopened: boolean } {
    return { ok: true, reopened: input.score < 3 };
  }
}
