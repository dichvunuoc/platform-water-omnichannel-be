/** BroadcastModule port + token + mock adapter (thông báo chủ động → broadcast service). */
import { Injectable, NotFoundException } from '@nestjs/common';
import { cskhBroadcasts, type Broadcast } from '../cskh-bff/cskh-fixture';

export const BROADCAST_PORT_TOKEN = 'CSKH_BROADCAST_PORT';
export interface IBroadcastPort {
  list(): Broadcast[];
  create(input: {
    title: string;
    channels: string[];
    area: string;
    window: string;
  }): Broadcast;
  send(id: string): Broadcast;
}

@Injectable()
export class MockBroadcastAdapter implements IBroadcastPort {
  list(): Broadcast[] {
    return cskhBroadcasts;
  }
  create(input: {
    title: string;
    channels: string[];
    area: string;
    window: string;
  }): Broadcast {
    const newBc: Broadcast = {
      id: `bc${Date.now()}`,
      title: input.title,
      status: 'draft',
      channels: input.channels,
      area: input.area,
      window: input.window,
      audience: 0,
      sent: 0,
      opened: 0,
      scheduled: '—',
    };
    cskhBroadcasts.push(newBc);
    return newBc;
  }
  send(id: string): Broadcast {
    const bc = cskhBroadcasts.find((b) => b.id === id);
    if (!bc) throw new NotFoundException('Không tìm thấy broadcast.');
    bc.status = 'sending';
    return bc;
  }
}
