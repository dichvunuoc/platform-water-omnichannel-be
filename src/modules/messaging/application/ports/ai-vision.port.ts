/**
 * AI Vision Port (FR15) — classify an incident/attachment image.
 * AI is 100% external (locked ai_strategy); the core only calls + displays.
 */
export interface IAiVisionPort {
  classify(imageUrl: string): Promise<{
    tag: string;
    confidence: number;
    rationale?: string;
  }>;
}

/**
 * Audio AI Port (FR15) — transcribe a call/voice attachment.
 */
export interface IAudioAiPort {
  transcribe(audioUrl: string): Promise<{
    transcript: string;
    confidence?: number;
  }>;
}

/**
 * NLP Port (FR15) — classify the intent of a text message.
 */
export interface INlpPort {
  classifyIntent(text: string): Promise<{
    intent: string;
    confidence: number;
  }>;
}

/**
 * Union type for AI insights displayed on a message.
 */
export interface AiInsight {
  type: 'VISION' | 'AUDIO' | 'NLP';
  tag?: string;
  transcript?: string;
  intent?: string;
  confidence: number;
  rationale?: string;
}
