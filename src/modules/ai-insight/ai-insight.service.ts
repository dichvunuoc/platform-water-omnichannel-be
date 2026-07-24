import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IAiVisionPort, IAudioAiPort, INlpPort, AiInsight } from './ports/ai-vision.port';

/**
 * AI Insight Service (FR15)
 *
 * Orchestrates calls to external AI ports + assembles insights for display.
 * Uses circuit-breaker pattern: AI failures degrade gracefully (no tag shown,
 * never blocks inbound handling — NFR22).
 */
@Injectable()
export class AiInsightService {
  private readonly logger = new Logger(AiInsightService.name);
  private readonly TIMEOUT_MS = 3000; // 3s — never block longer than this

  constructor(
    @Inject('IAiVisionPort') private readonly visionPort: IAiVisionPort,
    @Inject('IAudioAiPort') private readonly audioPort: IAudioAiPort,
    @Inject('INlpPort') private readonly nlpPort: INlpPort,
  ) {}

  /**
   * Analyze an image attachment → return vision insight (or null on failure).
   * Non-blocking: returns null if AI fails/times out (NFR22 safe degradation).
   */
  async classifyImage(imageUrl: string): Promise<AiInsight | null> {
    try {
      const result = await this.withTimeout(this.visionPort.classify(imageUrl));
      return {
        type: 'VISION',
        tag: result.tag,
        confidence: result.confidence,
        rationale: result.rationale,
      };
    } catch (err) {
      this.logger.warn(`AI Vision failed (non-blocking): ${err}`);
      return null; // NFR22 — safe degradation, never throw
    }
  }

  /**
   * Transcribe an audio attachment → return transcript insight (or null).
   */
  async transcribeAudio(audioUrl: string): Promise<AiInsight | null> {
    try {
      const result = await this.withTimeout(this.audioPort.transcribe(audioUrl));
      return {
        type: 'AUDIO',
        transcript: result.transcript,
        confidence: result.confidence ?? 0,
      };
    } catch (err) {
      this.logger.warn(`AI Audio failed (non-blocking): ${err}`);
      return null;
    }
  }

  /**
   * Classify the intent of a text message → return NLP insight (or null).
   */
  async classifyIntent(text: string): Promise<AiInsight | null> {
    try {
      const result = await this.withTimeout(this.nlpPort.classifyIntent(text));
      return {
        type: 'NLP',
        intent: result.intent,
        confidence: result.confidence,
      };
    } catch (err) {
      this.logger.warn(`AI NLP failed (non-blocking): ${err}`);
      return null;
    }
  }

  /**
   * Race a promise against a timeout — throws on timeout.
   * Simple circuit-breaker for MVP (upgrade to opossum in wave-3).
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise.then((v) => { clearTimeout(timer); return v; }),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), this.TIMEOUT_MS);
      }),
    ]);
  }
}
