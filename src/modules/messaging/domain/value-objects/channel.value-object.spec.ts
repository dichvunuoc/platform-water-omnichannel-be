import { Channel, ChannelEnum } from './channel.value-object';

describe('Channel Value Object', () => {
  describe('create()', () => {
    it('creates from string (case-insensitive)', () => {
      expect(Channel.create('zalo').value).toBe(ChannelEnum.ZALO);
      expect(Channel.create('APP').value).toBe(ChannelEnum.APP);
      expect(Channel.create('Facebook').value).toBe(ChannelEnum.FACEBOOK);
    });

    it('creates from ChannelEnum', () => {
      expect(Channel.create(ChannelEnum.EMAIL).value).toBe(ChannelEnum.EMAIL);
    });

    it('throws on unsupported channel', () => {
      expect(() => Channel.create('TWITTER')).toThrow();
      expect(() => Channel.create('telegram')).toThrow();
    });

    it('supports all 5 channels', () => {
      const channels = [ChannelEnum.ZALO, ChannelEnum.APP, ChannelEnum.FACEBOOK, ChannelEnum.EMAIL, ChannelEnum.VOIP];
      for (const c of channels) {
        expect(Channel.create(c).value).toBe(c);
      }
    });
  });

  describe('factory methods', () => {
    it('Channel.zalo() creates ZALO', () => {
      expect(Channel.zalo().value).toBe(ChannelEnum.ZALO);
    });
    it('Channel.voip() creates VOIP', () => {
      expect(Channel.voip().value).toBe(ChannelEnum.VOIP);
    });
  });

  describe('isVoice', () => {
    it('returns true for VOIP', () => {
      expect(Channel.voip().isVoice).toBe(true);
    });
    it('returns false for ZALO', () => {
      expect(Channel.zalo().isVoice).toBe(false);
    });
    it('returns false for EMAIL', () => {
      expect(Channel.email().isVoice).toBe(false);
    });
  });

  describe('equality', () => {
    it('two ZALO channels are equal', () => {
      expect(Channel.zalo().equals(Channel.zalo())).toBe(true);
    });
    it('ZALO and APP are not equal', () => {
      expect(Channel.zalo().equals(Channel.app())).toBe(false);
    });
  });
});
