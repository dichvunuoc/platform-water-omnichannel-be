import { ChannelEnum } from '../../domain';

/**
 * Outbound Send Result
 */
export interface OutboundResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Outbound Channel Adapter Port (FR5)
 *
 * Per-channel implementations send messages TO the customer.
 * Wave-1: Zalo real (API call); App/FB/Email mock.
 */
export interface IOutboundChannelAdapter {
  /**
   * Send a message to a customer on this channel.
   *
   * @param customerChannelId — the channel-side customer id (e.g. zalo_user_id)
   * @param content — message text
   * @param attachments — attachment URLs
   * @returns external message id on success, error on failure
   */
  send(
    customerChannelId: string,
    content: string,
    attachments?: string[],
  ): Promise<OutboundResult>;

  /** Which channel this adapter handles. */
  readonly channel: ChannelEnum;
}
