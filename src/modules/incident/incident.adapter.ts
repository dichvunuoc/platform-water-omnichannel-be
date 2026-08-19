/** IncidentModule port + token + mock adapter (sự cố hiện trường → incident-service). */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { cskhIncidents, type Incident } from '../cskh-bff/cskh-fixture';

export const INCIDENT_PORT_TOKEN = 'CSKH_INCIDENT_PORT';
export interface IIncidentPort {
  list(): Incident[];
  triage(id: string): Incident;
  setKind(id: string, kind: string): Incident;
  dispatch(id: string): Incident;
}

const VALID_KINDS = new Set([
  'vo_ong',
  'ro_ri',
  'nuoc_duc',
  'mat_nuoc',
  'yeu_ap',
  'dong_ho',
]);

@Injectable()
export class MockIncidentAdapter implements IIncidentPort {
  list(): Incident[] {
    return cskhIncidents;
  }
  triage(id: string): Incident {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'new') {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: 'Trạng thái không hợp lệ để phân loại.',
      });
    }
    inc.status = 'triaged';
    return inc;
  }
  setKind(id: string, kind: string): Incident {
    if (!VALID_KINDS.has(kind.toLowerCase())) {
      throw new BadRequestException({
        code: 'INVALID_KIND',
        message: 'Loại sự cố không hợp lệ.',
      });
    }
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    inc.kind = kind.toLowerCase();
    return inc;
  }
  dispatch(id: string): Incident {
    const inc = cskhIncidents.find((i) => i.id === id);
    if (!inc) throw new NotFoundException('Không tìm thấy sự cố.');
    if (inc.status !== 'triaged') {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: 'Trạng thái không hợp lệ để điều phối.',
      });
    }
    inc.status = 'dispatched';
    return inc;
  }
}
