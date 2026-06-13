import { GetUploadUrlHandler } from './get-upload-url.handler';
import { GetUploadUrlCommand } from '../get-upload-url.command';
import { PortFallbackException } from '@shared/port/port-exceptions';

describe('GetUploadUrlHandler', () => {
  let handler: GetUploadUrlHandler;
  let portRegistry: any;

  const mockUploadResponse = {
    uploadUrl: 'https://storage.ioc.local/upload/tmp/inc-2026-photo-001?signature=abc123&expires=1718010000',
    fileKey: 'tmp/inc-2026-photo-001',
    expiresAt: '2026-06-10T10:30:00Z',
  };

  beforeEach(() => {
    portRegistry = {
      execute: jest.fn(),
    };
    handler = new GetUploadUrlHandler(portRegistry);
  });

  const TEST_CUSTOMER_ID = 'USR-SESSION-001';

  // ── Success path ───────────────────────────────────────────────────────────

  describe('execute — success', () => {
    it('should call PortRegistry with correct params', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockUploadResponse });

      const result = await handler.execute(
        new GetUploadUrlCommand(TEST_CUSTOMER_ID, 'photo.jpg', 'image/jpeg'),
      );

      expect(portRegistry.execute).toHaveBeenCalledTimes(1);
      expect(portRegistry.execute).toHaveBeenCalledWith(
        'document',
        'get-upload-url',
        expect.objectContaining({
          customerId: TEST_CUSTOMER_ID,
          fileName: 'photo.jpg',
          fileType: 'image/jpeg',
          metadata: { source: 'incident_report' },
        }),
      );
      expect(result.uploadUrl).toBe(mockUploadResponse.uploadUrl);
      expect(result.fileKey).toBe('tmp/inc-2026-photo-001');
    });

    it('should handle different file types', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockUploadResponse });

      await handler.execute(
        new GetUploadUrlCommand(TEST_CUSTOMER_ID, 'photo.png', 'image/png'),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'document',
        'get-upload-url',
        expect.objectContaining({ fileType: 'image/png' }),
      );
    });

    it('should handle webp file type', async () => {
      portRegistry.execute.mockResolvedValue({ data: mockUploadResponse });

      await handler.execute(
        new GetUploadUrlCommand(TEST_CUSTOMER_ID, 'photo.webp', 'image/webp'),
      );

      expect(portRegistry.execute).toHaveBeenCalledWith(
        'document',
        'get-upload-url',
        expect.objectContaining({ fileType: 'image/webp' }),
      );
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('execute — null/undefined result', () => {
    it('should throw PortFallbackException when result.data is null', async () => {
      portRegistry.execute.mockResolvedValue({ data: null });

      await expect(
        handler.execute(new GetUploadUrlCommand(TEST_CUSTOMER_ID, 'photo.jpg', 'image/jpeg')),
      ).rejects.toThrow(PortFallbackException);
    });

    it('should throw PortFallbackException when result is undefined', async () => {
      portRegistry.execute.mockResolvedValue(undefined);

      await expect(
        handler.execute(new GetUploadUrlCommand(TEST_CUSTOMER_ID, 'photo.jpg', 'image/jpeg')),
      ).rejects.toThrow(PortFallbackException);
    });
  });
});
