/**
 * Zalo OA Webhook DTOs — Zod schemas for the inbound OA webhook payload.
 *
 * Reference: Zalo Official Account (OA) webhook, event `user_send_text`.
 * The exact payload shape varies slightly across Zalo API versions, so the schema
 * is lenient (captures the essential fields, passes through the rest).
 *
 * ⚠️ HMAC is verified by ZaloSignatureGuard over the RAW body BEFORE this parse.
 *    This file only runs after the payload is proven authentic.
 */

import { z } from 'zod';

/**
 * Inbound "user send text" event from a Zalo OA conversation.
 */
export const ZaloInboundMessageSchema = z
  .object({
    // Top-level event discriminator
    event_name: z.string().optional(),
    eventName: z.string().optional(),
    // Message payload — msg_id may be nested or top-level depending on version
    message: z
      .object({
        msg_id: z.string().optional(),
        text: z.string().optional(),
      })
      .optional(),
    msg_id: z.string().optional(),
    // Sender identity (the Zalo OA user id)
    sender: z
      .object({
        id: z.string().optional(),
        user_id: z.string().optional(),
      })
      .optional(),
    from: z
      .object({
        user_id: z.string().optional(),
      })
      .optional(),
    timestamp: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export type ZaloInboundMessage = z.infer<typeof ZaloInboundMessageSchema>;

/**
 * Normalised, reliable view of an inbound Zalo message — used by the worker.
 * Defensive extraction handles the version differences above.
 */
export interface NormalisedZaloInbound {
  /** Stable message id — the idempotency key (anti-duplicate on Zalo retry). */
  messageId: string;
  /** The Zalo OA user id of the sender (NOT the internal userId). */
  zaloUserId: string;
  /** The text the customer sent. */
  text: string;
  /** Original event discriminator, e.g. "user_send_text". */
  eventName?: string;
}

/**
 * Parse + normalise a raw Zalo inbound payload into a reliable view.
 * Throws if the essential identity (sender/message id) is missing.
 */
export function normaliseZaloInbound(
  raw: Record<string, unknown>,
): NormalisedZaloInbound {
  const parsed = ZaloInboundMessageSchema.parse(raw);
  const zaloUserId =
    parsed.sender?.id ??
    parsed.sender?.user_id ??
    parsed.from?.user_id ??
    '';
  const messageId = parsed.message?.msg_id ?? parsed.msg_id ?? '';
  const text = parsed.message?.text ?? '';

  if (!zaloUserId) {
    throw new Error('Zalo inbound payload missing sender id');
  }
  if (!messageId) {
    // Without a message id we cannot deduplicate Zalo retries safely.
    throw new Error('Zalo inbound payload missing message id');
  }

  return {
    messageId,
    zaloUserId,
    text,
    eventName: parsed.event_name ?? parsed.eventName,
  };
}
