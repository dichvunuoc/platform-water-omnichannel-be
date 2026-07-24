/** AiInsightModule — AI vision/audio/NLP ports (mock wave-1; real AI wave-3). */
import { Module } from '@nestjs/common';
import { AiInsightService } from './ai-insight.service';
import { MockAiVisionAdapter, MockAudioAiAdapter, MockNlpAdapter } from './mock-ai-adapters';

@Module({
  providers: [
    AiInsightService,
    MockAiVisionAdapter,
    MockAudioAiAdapter,
    MockNlpAdapter,
    { provide: 'IAiVisionPort', useExisting: MockAiVisionAdapter },
    { provide: 'IAudioAiPort', useExisting: MockAudioAiAdapter },
    { provide: 'INlpPort', useExisting: MockNlpAdapter },
  ],
  exports: [AiInsightService],
})
export class AiInsightModule {}
