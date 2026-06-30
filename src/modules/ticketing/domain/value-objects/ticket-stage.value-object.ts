import { BaseValueObject, DomainException } from 'src/libs/core/domain';

export enum TicketStageEnum {
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export const STAGE_TRANSITIONS: Record<TicketStageEnum, TicketStageEnum[]> = {
  RECEIVED:    [TicketStageEnum.IN_PROGRESS],
  IN_PROGRESS: [TicketStageEnum.WAITING, TicketStageEnum.RESOLVED, TicketStageEnum.CLOSED],
  WAITING:     [TicketStageEnum.IN_PROGRESS, TicketStageEnum.RESOLVED, TicketStageEnum.CLOSED],
  RESOLVED:    [TicketStageEnum.CLOSED, TicketStageEnum.IN_PROGRESS],
  CLOSED:      [TicketStageEnum.IN_PROGRESS],
};

export class TicketStage extends BaseValueObject {
  private readonly _value: TicketStageEnum;

  private constructor(value: TicketStageEnum) {
    super();
    this._value = value;
  }

  static create(value: TicketStageEnum | string): TicketStage {
    const upper = (typeof value === 'string' ? value.toUpperCase() : value) as TicketStageEnum;
    if (!Object.values(TicketStageEnum).includes(upper)) {
      throw new DomainException(`Invalid ticket stage: ${value}`, 'INVALID_STAGE');
    }
    return new TicketStage(upper);
  }

  canTransitionTo(target: TicketStageEnum): boolean {
    return STAGE_TRANSITIONS[this._value]?.includes(target) ?? false;
  }

  get value(): TicketStageEnum {
    return this._value;
  }

  get isClosed(): boolean {
    return this._value === TicketStageEnum.CLOSED;
  }

  get isResolved(): boolean {
    return this._value === TicketStageEnum.RESOLVED || this._value === TicketStageEnum.CLOSED;
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
