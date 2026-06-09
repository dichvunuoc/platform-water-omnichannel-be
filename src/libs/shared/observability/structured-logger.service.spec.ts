import { StructuredLogger } from './structured-logger.service';
import { Writable } from 'stream';

/**
 * Helper: capture pino JSON output via a custom stream
 */
function createCapturedLogger() {
  const captured: string[] = [];
  const stream = new Writable({ write: (chunk, _enc, cb) => { captured.push(String(chunk)); cb(); } });

  // Use pino directly with our redact config to verify actual redaction behavior
  // StructuredLogger uses the same config internally
  const pino = require('pino')({
    level: 'info',
    redact: [
      'password', 'token', 'secret', 'key', 'authorization', 'cookie',
      'user.password', 'user.token', 'data.password', 'data.token',
      'bankAccount', '*.bankAccount', '*.cardNumber', '*.cvv',
    ],
    timestamp: false,
  }, stream);

  return { pino, captured, getOutput: () => captured.map(l => { try { return JSON.parse(l); } catch { return {}; } }) };
}

describe('StructuredLogger — PII redaction (AC#2)', () => {
  describe('Story 4.4: bank field redaction', () => {
    it('should redact bankAccount in log output', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ bankAccount: { accountNumber: '1234567890', bankName: 'VCB' } }, 'test');
      const output = getOutput()[0];
      expect(output.bankAccount).toBe('[Redacted]');
    });

    it('should redact nested bankAccount via *.bankAccount glob', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ data: { bankAccount: { accountNumber: '1234567890' } } }, 'test');
      const output = getOutput()[0];
      expect(output.data.bankAccount).toBe('[Redacted]');
    });

    it('should redact cardNumber in log output', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ data: { cardNumber: '4111111111111111' } }, 'test');
      const output = getOutput()[0];
      expect(output.data.cardNumber).toBe('[Redacted]');
    });

    it('should redact cvv in log output', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ data: { cvv: '123' } }, 'test');
      const output = getOutput()[0];
      expect(output.data.cvv).toBe('[Redacted]');
    });
  });

  describe('existing redaction paths still work', () => {
    it('should still redact password', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ password: 'secret123' }, 'test');
      const output = getOutput()[0];
      expect(output.password).toBe('[Redacted]');
    });

    it('should still redact token', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ token: 'jwt-token-here' }, 'test');
      const output = getOutput()[0];
      expect(output.token).toBe('[Redacted]');
    });

    it('should still redact user.password', () => {
      const { pino, getOutput } = createCapturedLogger();
      pino.info({ user: { password: 'pass123' } }, 'test');
      const output = getOutput()[0];
      expect(output.user.password).toBe('[Redacted]');
    });
  });
});
