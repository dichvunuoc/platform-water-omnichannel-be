import { Channel } from '../value-objects/channel.value-object';
import { Message, MessageDirection, SenderType } from './message.entity';

describe('Message Entity (OmniMessage)', () => {
  const zalo = Channel.zalo();

  describe('create()', () => {
    it('creates an INBOUND message with all fields', () => {
      const msg = Message.create({
        id: 'msg-1',
        conversationId: 'conv-1',
        channel: zalo,
        direction: MessageDirection.INBOUND,
        senderType: SenderType.CUSTOMER,
        content: 'Ống nước vỡ rồi!',
        externalId: 'zalo-001',
        attachments: ['https://cdn.zalo.ai/photo/123.jpg'],
      });

      expect(msg.id).toBe('msg-1');
      expect(msg.conversationId).toBe('conv-1');
      expect(msg.direction).toBe(MessageDirection.INBOUND);
      expect(msg.senderType).toBe(SenderType.CUSTOMER);
      expect(msg.content).toBe('Ống nước vỡ rồi!');
      expect(msg.externalId).toBe('zalo-001');
      expect(msg.attachments).toEqual(['https://cdn.zalo.ai/photo/123.jpg']);
      expect(msg.isInbound).toBe(true);
    });

    it('creates an OUTBOUND message (agent reply)', () => {
      const msg = Message.create({
        id: 'msg-2',
        conversationId: 'conv-1',
        channel: zalo,
        direction: MessageDirection.OUTBOUND,
        senderType: SenderType.AGENT,
        content: 'Chúng tôi đã tiếp nhận yêu cầu',
      });

      expect(msg.direction).toBe(MessageDirection.OUTBOUND);
      expect(msg.senderType).toBe(SenderType.AGENT);
      expect(msg.isInbound).toBe(false);
    });

    it('throws if conversationId is empty', () => {
      expect(() =>
        Message.create({ id: 'msg-1', conversationId: '', channel: zalo, direction: MessageDirection.INBOUND, senderType: SenderType.CUSTOMER, content: 'hello' }),
      ).toThrow();
    });

    it('throws if content is empty (non-voice)', () => {
      expect(() =>
        Message.create({ id: 'msg-1', conversationId: 'conv-1', channel: zalo, direction: MessageDirection.INBOUND, senderType: SenderType.CUSTOMER, content: '' }),
      ).toThrow();
    });

    it('allows empty content for INBOUND voice channel (VoIP call metadata)', () => {
      const voip = Channel.voip();
      const msg = Message.create({
        id: 'msg-call-1',
        conversationId: 'conv-call',
        channel: voip,
        direction: MessageDirection.INBOUND,
        senderType: SenderType.CUSTOMER,
        content: '',
      });

      expect(msg.content).toBe('');
      expect(msg.channel.isVoice).toBe(true);
    });

    it('throws if content is whitespace-only', () => {
      expect(() =>
        Message.create({ id: 'msg-1', conversationId: 'conv-1', channel: zalo, direction: MessageDirection.INBOUND, senderType: SenderType.CUSTOMER, content: '   ' }),
      ).toThrow();
    });

    it('defaults attachments to empty array if not provided', () => {
      const msg = Message.create({
        id: 'msg-1', conversationId: 'conv-1', channel: zalo,
        direction: MessageDirection.INBOUND, senderType: SenderType.CUSTOMER, content: 'hi',
      });
      expect(msg.attachments).toEqual([]);
    });
  });

  describe('attachments immutability', () => {
    it('returns a copy of attachments (readonly)', () => {
      const msg = Message.create({
        id: 'msg-1', conversationId: 'conv-1', channel: zalo,
        direction: MessageDirection.INBOUND, senderType: SenderType.CUSTOMER,
        content: 'hi', attachments: ['url1', 'url2'],
      });
      const atts = msg.attachments;
      expect(atts).toEqual(['url1', 'url2']);
      // Returned array is a copy — mutating it doesn't affect the entity
      (atts as string[]).push('url3');
      expect(msg.attachments.length).toBe(2);
    });
  });
});
