import { BaseValueObject, DomainException } from 'src/libs/core/domain';

export class TicketId extends BaseValueObject {
  private readonly _value: string;

  private constructor(value: string) {
    super();
    this._value = value;
  }

  static create(id: string): TicketId {
    if (!id || !id.startsWith('SC-') || id.length < 5) {
      throw new DomainException(
        `Invalid ticket ID format: ${id}. Expected SC-XXXXXX`,
        'INVALID_TICKET_ID',
      );
    }
    return new TicketId(id);
  }

  get value(): string {
    return this._value;
  }

  protected getEqualityComponents(): unknown[] {
    return [this._value];
  }
}
