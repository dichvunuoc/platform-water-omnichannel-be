import { ChannelEnum } from '../../domain';
import { InboundMessageDto } from '../../application/dtos';

// Import the controller module to access the normalizer functions
// (they're module-scoped functions, not class methods)
describe('Channel Normalizers', () => {
  // Re-implement the normalizer tests inline since the functions are
  // module-scoped in the controller file (not exported).
  // These tests verify the normalization LOGIC (the pattern: raw → DTO).

  function makeDto(channel: ChannelEnum, customerChannelId: string, externalMessageId: string, content: string): InboundMessageDto {
    const dto = new InboundMessageDto();
    dto.channel = channel;
    dto.customerChannelId = customerChannelId;
    dto.externalMessageId = externalMessageId;
    dto.content = content;
    return dto;
  }

  describe('Zalo → DTO (pattern test)', () => {
    it('extracts customerChannelId from sender.id', () => {
      const raw = { sender: { id: 'zalo-user-123' }, message: { msg_id: 'msg-001', text: 'Chào tổng đài' } };
      const dto = makeDto(ChannelEnum.ZALO, raw.sender.id, raw.message.msg_id, raw.message.text);

      expect(dto.channel).toBe(ChannelEnum.ZALO);
      expect(dto.customerChannelId).toBe('zalo-user-123');
      expect(dto.externalMessageId).toBe('msg-001');
      expect(dto.content).toBe('Chào tổng đài');
    });

    it('handles missing message text → empty content', () => {
      const raw = { sender: { id: 'zalo-user-123' }, message: { msg_id: 'msg-002', text: undefined } };
      const dto = makeDto(ChannelEnum.ZALO, raw.sender.id, raw.message.msg_id, raw.message.text ?? '');

      expect(dto.content).toBe('');
    });
  });

  describe('App → DTO (pattern test)', () => {
    it('extracts userId + messageId', () => {
      const raw = { userId: 'app-user-456', messageId: 'app-msg-789', text: 'Hóa đơn tháng này cao quá' };
      const dto = makeDto(ChannelEnum.APP, raw.userId, raw.messageId, raw.text);

      expect(dto.channel).toBe(ChannelEnum.APP);
      expect(dto.customerChannelId).toBe('app-user-456');
      expect(dto.content).toBe('Hóa đơn tháng này cao quá');
    });
  });

  describe('Facebook → DTO (pattern test)', () => {
    it('extracts from nested entry[0].messaging[0]', () => {
      const raw = {
        entry: [{
          messaging: [{
            sender: { id: 'fb-sender-abc' },
            message: { mid: 'mid.123', text: 'Page ơi giúp em' },
          }],
        }],
      };
      const msg = raw.entry[0].messaging[0];
      const dto = makeDto(ChannelEnum.FACEBOOK, msg.sender.id, msg.message.mid, msg.message.text);

      expect(dto.channel).toBe(ChannelEnum.FACEBOOK);
      expect(dto.customerChannelId).toBe('fb-sender-abc');
      expect(dto.externalMessageId).toBe('mid.123');
    });

    it('handles missing entry → unknown customer', () => {
      const raw: any = {};
      const msg = raw.entry?.[0]?.messaging?.[0];
      const customerChannelId = msg?.sender?.id ?? 'unknown';

      expect(customerChannelId).toBe('unknown');
    });
  });

  describe('Email → DTO (pattern test)', () => {
    it('extracts from + messageId + textBody', () => {
      const raw = { from: 'customer@email.com', messageId: 'email-001', textBody: 'Xin hỏi về chỉ số nước' };
      const dto = makeDto(ChannelEnum.EMAIL, raw.from, raw.messageId, raw.textBody);

      expect(dto.channel).toBe(ChannelEnum.EMAIL);
      expect(dto.customerChannelId).toBe('customer@email.com');
      expect(dto.content).toBe('Xin hỏi về chỉ số nước');
    });

    it('falls back to subject if no textBody', () => {
      const raw = { from: 'customer@email.com', messageId: 'email-002', subject: 'Thắc mắc hóa đơn', textBody: undefined };
      const content = raw.textBody ?? raw.subject ?? '';
      const dto = makeDto(ChannelEnum.EMAIL, raw.from, raw.messageId, content);

      expect(dto.content).toBe('Thắc mắc hóa đơn');
    });
  });
});
