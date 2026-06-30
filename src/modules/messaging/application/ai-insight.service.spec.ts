import { AiInsightService } from './ai-insight.service';
import type { IAiVisionPort, IAudioAiPort, INlpPort } from './ports/ai-vision.port';

function createMockPorts() {
  const vision: IAiVisionPort = {
    classify: jest.fn().mockResolvedValue({
      tag: 'Vỡ / bể ống',
      confidence: 0.97,
      rationale: 'Cột nước phun + vũng ngập',
    }),
  };
  const audio: IAudioAiPort = {
    transcribe: jest.fn().mockResolvedValue({
      transcript: 'Cháu chào cô, báo sự cố vỡ ống',
      confidence: 0.92,
    }),
  };
  const nlp: INlpPort = {
    classifyIntent: jest.fn().mockResolvedValue({
      intent: 'BAO_SU_CO',
      confidence: 0.94,
    }),
  };
  return { vision, audio, nlp };
}

describe('AiInsightService', () => {
  it('classifyImage returns VISION insight from the port', async () => {
    const { vision, audio, nlp } = createMockPorts();
    const svc = new AiInsightService(vision, audio, nlp);

    const insight = await svc.classifyImage('https://cdn.example.com/photo.jpg');

    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('VISION');
    expect(insight!.tag).toBe('Vỡ / bể ống');
    expect(insight!.confidence).toBe(0.97);
    expect(vision.classify).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg');
  });

  it('transcribeAudio returns AUDIO insight', async () => {
    const { vision, audio, nlp } = createMockPorts();
    const svc = new AiInsightService(vision, audio, nlp);

    const insight = await svc.transcribeAudio('https://cdn.example.com/call.wav');

    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('AUDIO');
    expect(insight!.transcript).toContain('báo sự cố');
  });

  it('classifyIntent returns NLP insight', async () => {
    const { vision, audio, nlp } = createMockPorts();
    const svc = new AiInsightService(vision, audio, nlp);

    const insight = await svc.classifyIntent('ống nước vỡ trước nhà');

    expect(insight).not.toBeNull();
    expect(insight!.type).toBe('NLP');
    expect(insight!.intent).toBe('BAO_SU_CO');
  });

  it('returns null on AI port failure (NFR22 safe degradation)', async () => {
    const { vision, audio, nlp } = createMockPorts();
    vision.classify = jest.fn().mockRejectedValue(new Error('AI service down'));
    const svc = new AiInsightService(vision, audio, nlp);

    const insight = await svc.classifyImage('broken-url');

    expect(insight).toBeNull(); // never throws — degrades gracefully
  });

  it('returns null on timeout (3s circuit-breaker)', async () => {
    const { vision, audio, nlp } = createMockPorts();
    // Simulate a slow AI that never resolves within the timeout
    vision.classify = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ tag: 'late', confidence: 0.5 }), 5000)),
    );
    const svc = new AiInsightService(vision, audio, nlp);

    const insight = await svc.classifyImage('slow-url');

    expect(insight).toBeNull(); // timed out — safe degradation
  }, 10000); // allow up to 10s for this test
});
