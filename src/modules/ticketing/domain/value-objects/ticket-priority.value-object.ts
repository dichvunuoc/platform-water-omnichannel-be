import { BaseValueObject, DomainException } from 'src/libs/core/domain';

export enum TicketPriorityEnum {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export type SlaSchedule = '24/7' | 'BUSINESS_HOURS';

export const SLA_POLICIES: Record<TicketPriorityEnum, {
  ackMs: number;
  resolveMs: number;
  schedule: SlaSchedule;
}> = {
  P0: { ackMs: 1 * 3600 * 1000,      resolveMs: 4 * 3600 * 1000,        schedule: '24/7' },
  P1: { ackMs: 2 * 3600 * 1000,      resolveMs: 8 * 3600 * 1000,        schedule: '24/7' },
  P2: { ackMs: 24 * 3600 * 1000,     resolveMs: 7 * 24 * 3600 * 1000,  schedule: 'BUSINESS_HOURS' },
  P3: { ackMs: 48 * 3600 * 1000,     resolveMs: 14 * 24 * 3600 * 1000, schedule: 'BUSINESS_HOURS' },
};

export class TicketPriority extends BaseValueObject {
  private readonly _value: TicketPriorityEnum;

  private constructor(value: TicketPriorityEnum) {
    super();
    this._value = value;
  }

  static create(value: TicketPriorityEnum | string): TicketPriority {
    const upper = (typeof value === 'string' ? value.toUpperCase() : value) as TicketPriorityEnum;
    if (!Object.values(TicketPriorityEnum).includes(upper)) {
      throw new DomainException(`Invalid ticket priority: ${value}`, 'INVALID_PRIORITY');
    }
    return new TicketPriority(upper);
  }

  get value(): TicketPriorityEnum {
    return this._value;
  }

  get schedule(): SlaSchedule {
    return SLA_POLICIES[this._value].schedule;
  }

  get ackMs(): number {
    return SLA_POLICIES[this._value].ackMs;
  }

  get resolveMs(): number {
    return SLA_POLICIES[this._value].resolveMs;
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
