/**
 * Setup Auto Debit Command (AC#1)
 *
 * Registers a bank account for automatic bill payment.
 * Payment port uses cacheTier: transaction — NO CACHING (FR35).
 */

import { ICommand } from '@core/application';
import type { BankAccount, SetupAutoDebitResponse } from '../dtos/payment.dto';

export class SetupAutoDebitCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly bankAccount: BankAccount,
  ) {}
}

export type SetupAutoDebitResult = SetupAutoDebitResponse;
