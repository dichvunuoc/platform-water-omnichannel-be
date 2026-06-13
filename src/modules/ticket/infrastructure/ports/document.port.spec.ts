import { MockDocumentAdapter } from './document.port';
import {
  GetUploadUrlResponseSchema,
  GetUploadUrlRequestSchema,
} from '../../application/dtos/ticket.dto';

describe('MockDocumentAdapter', () => {
  let adapter: MockDocumentAdapter;

  beforeEach(() => {
    adapter = new MockDocumentAdapter();
  });

  // ── AC#2: get-upload-url ────────────────────────────────────────────────────

  describe('execute - get-upload-url', () => {
    it('should read and validate get-upload-url.json mock data', async () => {
      const result = await adapter.execute('get-upload-url', {
        customerId: 'USR-001',
        fileName: 'photo1.jpg',
        fileType: 'image/jpeg',
      });

      expect(result).toBeDefined();
      const parsed = GetUploadUrlResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.uploadUrl).toMatch(/^https?:\/\//);
        expect(parsed.data.fileKey).toBeDefined();
        expect(parsed.data.expiresAt).toBeDefined();
      }
    });

    it('should return a valid presigned upload URL', async () => {
      const result = await adapter.execute('get-upload-url', {
        customerId: 'USR-001',
        fileName: 'leak-photo.png',
        fileType: 'image/png',
      });

      const parsed = GetUploadUrlResponseSchema.safeParse(result);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.uploadUrl).toContain('storage.ioc.local');
        expect(parsed.data.fileKey).toContain('tmp/');
      }
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('execute - missing method', () => {
    it('should throw for missing mock file', async () => {
      await expect(adapter.execute('nonexistent', {})).rejects.toThrow();
    });
  });

  // ── Schema validation: GetUploadUrlRequestSchema ───────────────────────────

  describe('GetUploadUrlRequestSchema', () => {
    it('should accept valid request with jpeg', () => {
      const result = GetUploadUrlRequestSchema.safeParse({
        fileName: 'photo.jpg',
        fileType: 'image/jpeg',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid request with png', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: 'photo.png',
        fileType: 'image/png',
      }).success).toBe(true);
    });

    it('should accept valid request with webp', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: 'photo.webp',
        fileType: 'image/webp',
      }).success).toBe(true);
    });

    it('should reject missing fileName', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileType: 'image/jpeg',
      }).success).toBe(false);
    });

    it('should reject missing fileType', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: 'photo.jpg',
      }).success).toBe(false);
    });

    it('should reject invalid fileType', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
      }).success).toBe(false);
    });

    it('should reject empty fileName', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: '',
        fileType: 'image/jpeg',
      }).success).toBe(false);
    });

    it('should reject fileName exceeding 255 chars', () => {
      expect(GetUploadUrlRequestSchema.safeParse({
        fileName: 'a'.repeat(256) + '.jpg',
        fileType: 'image/jpeg',
      }).success).toBe(false);
    });
  });

  // ── Schema validation: GetUploadUrlResponseSchema ──────────────────────────

  describe('GetUploadUrlResponseSchema', () => {
    it('should accept valid response', () => {
      const result = GetUploadUrlResponseSchema.safeParse({
        uploadUrl: 'https://storage.ioc.local/upload/tmp/file?sig=abc',
        fileKey: 'tmp/file',
        expiresAt: '2026-06-10T10:30:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid uploadUrl', () => {
      expect(GetUploadUrlResponseSchema.safeParse({
        uploadUrl: 'not-a-url',
        fileKey: 'tmp/file',
        expiresAt: '2026-06-10T10:30:00Z',
      }).success).toBe(false);
    });

    it('should reject missing fileKey', () => {
      expect(GetUploadUrlResponseSchema.safeParse({
        uploadUrl: 'https://storage.ioc.local/upload/tmp/file',
        expiresAt: '2026-06-10T10:30:00Z',
      }).success).toBe(false);
    });

    it('should reject missing expiresAt', () => {
      expect(GetUploadUrlResponseSchema.safeParse({
        uploadUrl: 'https://storage.ioc.local/upload/tmp/file',
        fileKey: 'tmp/file',
      }).success).toBe(false);
    });
  });
});
