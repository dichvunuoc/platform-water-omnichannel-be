# Story 1.7: AI Insight Display (Port)

Status: ready-for-dev

## Story

As an agent,
I want external AI tags + transcripts displayed on the conversation,
so that I get context (incident type, urgency, speech-to-text) without the system owning AI (FR15, NFR22).

## Acceptance Criteria

1. **AI tag display:** when a customer message has an image/audio attachment, the system calls the AI Vision / Audio-AI port → displays the returned classification tag (e.g. `{ tag: "Vỡ ống", confidence: 0.97 }`) alongside the message.
2. **Transcript display:** for VoIP calls, the Audio-AI port returns a transcript → displayed on the conversation timeline.
3. **Safe degradation:** if the AI port fails or times out, the system degrades gracefully (no tag shown; **inbound handling never blocks**) via a circuit-breaker (NFR22).
4. **Mock adapters (wave-1):** AI Vision + Audio-AI + NLP ports return static/mock results; real AI services wired in wave 3.

## Tasks / Subtasks

- [ ] **Port interfaces** (AC: 1, 2)
  - [ ] Create `src/modules/messaging/application/ports/ai-vision.port.ts` — `IAiVisionPort { classify(imageUrl: string): Promise<{ tag, confidence, rationale? }> }`
  - [ ] Create `src/modules/messaging/application/ports/audio-ai.port.ts` — `IAudioAiPort { transcribe(audioUrl: string): Promise<{ transcript }> }`
  - [ ] Create `src/modules/messaging/application/ports/nlp.port.ts` — `INlpPort { classifyIntent(text: string): Promise<{ intent, confidence }> }`
- [ ] **Mock adapters** (AC: 4)
  - [ ] `MockAiVisionAdapter` — returns `{ tag: "Vỡ / bể ống", confidence: 0.97 }` for any image
  - [ ] `MockAudioAiAdapter` — returns `{ transcript: "[mock transcript]" }` for any audio
  - [ ] `MockNlpAdapter` — returns `{ intent: "BAO_SUC", confidence: 0.92 }` for any text
  - [ ] Register adapters in `MessagingModule` providers (swap for real in wave 3)
- [ ] **Integration into conversation flow** (AC: 1)
  - [ ] When a message with an image attachment arrives (in `ReceiveInboundMessageHandler` or a post-ingest consumer), call `aiVisionPort.classify(attachmentUrl)` → store the tag on the message (new field `aiInsights` or a separate read model)
  - [ ] The BFF conversation endpoint (1.4) includes `aiInsights` in the response → FE renders the tag
- [ ] **Circuit breaker** (AC: 3)
  - [ ] Wrap AI port calls with a circuit-breaker (timeout 3s; on failure → skip tag, don't block). Use a simple try/catch + timeout for MVP; upgrade to `opossum` or similar in wave 3.
- [ ] **Tests** (AC: 1, 3)
  - [ ] Unit: mock adapter returns expected result
  - [ ] Unit: circuit-breaker → port failure → no tag, no crash

## Dev Notes

- **AI is 100% external** (locked `ai_strategy`). The Omnichannel service only **calls + displays**. The ports abstract the AI services; mock adapters simulate them for wave-1.
- The AI call happens **after** the message is ingested (non-blocking). It enriches the message asynchronously; the result is pushed via the realtime gateway when ready.
- For MVP: the mock returns immediately (static data). The real pipeline (YOLOv8 etc.) is wave 3 — and it's a DIFFERENT service, called via API.
- The `Message` entity may need an optional `aiInsights` field (or store in a separate `message_insights` table / read model). For MVP: add to the BFF response as a computed field (call the mock adapter at query time if not yet processed).

## References
- **PRD:** FR15 (AI display), NFR22 (AI safe-degradation) — [prd.md §2](../../_bmad-output/planning-artifacts/prd.md)
- **Architecture:** §0 ADR-5 (AI external), §3.1 incident module (AI-tag relay) — [architecture.md](../../_bmad-output/planning-artifacts/architecture.md)
- **PRD scope note:** AI vision classification, NLP, speech-to-text are **external AI services** (mock → real wave 3).
