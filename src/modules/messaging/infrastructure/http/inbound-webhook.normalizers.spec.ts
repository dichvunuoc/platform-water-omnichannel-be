/**
 * Channel Normalizers — test HÀM THẬT từ controller (normalizers giờ export;
 * spec cũ re-implement inline nên chỉ tự-test chính nó). Thêm block class-validator
 * cho AppWebhookPayloadDto: global pipe (whitelist + forbidNonWhitelisted) dựa
 * vào các decorator này để 400 body thiếu userId/messageId — đóng bucket
 * customerChannelId='unknown' của channel APP.
 */
import { validate } from 'class-validator';
import { ChannelEnum } from '../../domain';
import {
  appToDto,
  zaloToDto,
  facebookToDto,
  emailToDto,
  AppWebhookPayloadDto,
} from './inbound-webhook.controller';

describe('Channel Normalizers', () => {
  describe('App → DTO', () => {
    it('maps userId → customerChannelId, messageId → externalMessageId, text → content', () => {
      const dto = appToDto({
        userId: 'app-user-456',
        messageId: 'm-789',
        text: 'Hóa đơn tháng này cao quá',
      });
      expect(dto.channel).toBe(ChannelEnum.APP);
      expect(dto.customerChannelId).toBe('app-user-456');
      expect(dto.externalMessageId).toBe('m-789');
      expect(dto.content).toBe('Hóa đơn tháng này cao quá');
      expect(dto.attachments).toEqual([]);
    });

    it('maps attachments [{url}] → string[]', () => {
      const dto = appToDto({
        userId: 'u1',
        messageId: 'm1',
        attachments: [{ url: 'https://x/a.jpg' }, { url: 'https://x/b.jpg' }],
      });
      expect(dto.attachments).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    });

    it('text thiếu → empty content ( KHÔNG còn fallback userId=unknown — DTO bắt buộc)', () => {
      const dto = appToDto({ userId: 'u1', messageId: 'm1' });
      expect(dto.content).toBe('');
    });
  });

  describe('AppWebhookPayloadDto — class-validator (global pipe dựa vào đây)', () => {
    it('body thiếu userId → validation error (identity không được phép thiếu)', async () => {
      const errors = await validate(Object.assign(new AppWebhookPayloadDto(), { messageId: 'm1' }));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('userId');
    });

    it('body thiếu messageId → validation error (idempotency key của receiver)', async () => {
      const errors = await validate(Object.assign(new AppWebhookPayloadDto(), { userId: 'u1' }));
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('messageId');
    });

    it('body đủ field → pass', async () => {
      const errors = await validate(
        Object.assign(new AppWebhookPayloadDto(), { userId: 'u1', messageId: 'm1', text: 'hi' }),
      );
      expect(errors).toEqual([]);
    });

    it('userId rỗng string → validation error (IsNotEmpty)', async () => {
      const errors = await validate(
        Object.assign(new AppWebhookPayloadDto(), { userId: '', messageId: 'm1' }),
      );
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Zalo → DTO', () => {
    it('extracts customerChannelId from sender.id + msg_id', () => {
      const dto = zaloToDto({
        sender: { id: 'zalo-user-123' },
        message: { msg_id: 'msg-001', text: 'Chào tổng đài' },
      });
      expect(dto.channel).toBe(ChannelEnum.ZALO);
      expect(dto.customerChannelId).toBe('zalo-user-123');
      expect(dto.externalMessageId).toBe('msg-001');
      expect(dto.content).toBe('Chào tổng đài');
    });

    it('missing message text → empty content', () => {
      const dto = zaloToDto({ sender: { id: 'z1' }, message: { msg_id: 'msg-002' } });
      expect(dto.content).toBe('');
    });
  });

  describe('Facebook → DTO', () => {
    it('extracts from nested entry[0].messaging[0]', () => {
      const dto = facebookToDto({
        entry: [
          {
            messaging: [
              {
                sender: { id: 'fb-sender-abc' },
                message: { mid: 'mid.123', text: 'Page ơi giúp em' },
              },
            ],
          },
        ],
      });
      expect(dto.channel).toBe(ChannelEnum.FACEBOOK);
      expect(dto.customerChannelId).toBe('fb-sender-abc');
      expect(dto.externalMessageId).toBe('mid.123');
      expect(dto.content).toBe('Page ơi giúp em');
    });
  });

  describe('Email → DTO', () => {
    it('extracts from + messageId, prefers textBody over subject', () => {
      const dto = emailToDto({
        from: 'khach@example.com',
        messageId: '<mail-1>',
        subject: 'Hóa đơn',
        textBody: 'Chi tiết hóa đơn',
      });
      expect(dto.channel).toBe(ChannelEnum.EMAIL);
      expect(dto.customerChannelId).toBe('khach@example.com');
      expect(dto.externalMessageId).toBe('<mail-1>');
      expect(dto.content).toBe('Chi tiết hóa đơn');
    });

    it('fallback subject khi thiếu textBody', () => {
      const dto = emailToDto({ from: 'a@b.c', messageId: 'm', subject: 'Chủ đề' });
      expect(dto.content).toBe('Chủ đề');
    });
  });
});
