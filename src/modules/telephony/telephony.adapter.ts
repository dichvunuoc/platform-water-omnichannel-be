/** TelephonyModule port + token + mock adapter (tổng đài/softphone → telephony/PBX). */
import { Injectable } from '@nestjs/common';
import {
  cskhTelephony,
  cskhTickets,
  type CallSummary,
  type ActiveCall,
  type CallLogEntry,
  type CallerProfile,
  type CallRecording,
} from '../cskh-bff/cskh-fixture';

export const TELEPHONY_PORT_TOKEN = 'CSKH_TELEPHONY_PORT';
export interface ITelephonyPort {
  queue(): CallSummary[];
  activeCall(): ActiveCall | null;
  log(): CallLogEntry[];
  lookupPhone(phone: string): CallerProfile | null;
  recording(callId: string): CallRecording | null;
}

@Injectable()
export class MockTelephonyAdapter implements ITelephonyPort {
  queue(): CallSummary[] {
    return cskhTelephony.queue;
  }
  activeCall(): ActiveCall | null {
    return cskhTelephony.activeCall;
  }
  log(): CallLogEntry[] {
    return cskhTelephony.log;
  }
  lookupPhone(phone: string): CallerProfile | null {
    const t = cskhTickets.find((x) => x.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));
    if (!t) return null;
    return {
      phone: t.phone,
      name: t.name,
      maHb: t.maHb,
      custType: t.custType,
      addr: `${t.addr}, ${t.phuong}`,
      status: 'Đang dùng nước',
    };
  }
  recording(callId: string): CallRecording | null {
    return cskhTelephony.recordings.find((r) => r.callId === callId) ?? null;
  }
}
