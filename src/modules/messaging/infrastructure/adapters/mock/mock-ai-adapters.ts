import { Injectable, Logger } from '@nestjs/common';
import type {
  IAiVisionPort,
  IAudioAiPort,
  INlpPort,
} from '../../../application/ports/ai-vision.port';

/**
 * Mock AI Vision Adapter (wave-1)
 *
 * Returns a static incident classification simulating YOLOv8 output.
 * Real adapter (wave-3) calls an external AI vision microservice.
 */
@Injectable()
export class MockAiVisionAdapter implements IAiVisionPort {
  private readonly logger = new Logger(MockAiVisionAdapter.name);

  async classify(imageUrl: string) {
    this.logger.debug(`Mock AI Vision classify: ${imageUrl}`);
    // Simulate a burst-pipe detection
    return {
      tag: 'Vỡ / bể ống',
      confidence: 0.97,
      rationale: 'Phát hiện cột nước phun + vũng ngập lớn → khả năng vỡ ống cấp 1',
    };
  }
}

/**
 * Mock Audio AI Adapter (wave-1)
 *
 * Returns a static transcript simulating speech-to-text output.
 */
@Injectable()
export class MockAudioAiAdapter implements IAudioAiPort {
  private readonly logger = new Logger(MockAudioAiAdapter.name);

  async transcribe(audioUrl: string) {
    this.logger.debug(`Mock Audio AI transcribe: ${audioUrl}`);
    return {
      transcript: 'Cháu chào cô, công ty nước xin báo cáo tình hình xử lý sự cố vỡ ống tại phường Hòa Bình. Đội hiện trường đã có mặt và đang tiến hành sửa chữa.',
      confidence: 0.92,
    };
  }
}

/**
 * Mock NLP Adapter (wave-1)
 *
 * Returns a static intent classification.
 */
@Injectable()
export class MockNlpAdapter implements INlpPort {
  private readonly logger = new Logger(MockNlpAdapter.name);

  async classifyIntent(text: string) {
    this.logger.debug(`Mock NLP classifyIntent: ${text.slice(0, 50)}...`);
    return {
      intent: 'BAO_SU_CO',
      confidence: 0.94,
    };
  }
}
