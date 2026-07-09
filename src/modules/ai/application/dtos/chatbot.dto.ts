import { z } from 'zod';

export const ChatbotReplySchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  reply: z.string(),
  intent: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ChatbotReply = z.infer<typeof ChatbotReplySchema>;

export const ConversationSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'bot']),
      content: z.string(),
      at: z.string(),
    }),
  ),
});
export type Conversation = z.infer<typeof ConversationSchema>;
