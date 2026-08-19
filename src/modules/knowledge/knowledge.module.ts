/** KnowledgeModule — tri thức & kịch bản port. Mock default. */
import { Module } from '@nestjs/common';
import {
  KNOWLEDGE_PORT_TOKEN,
  MockKnowledgeAdapter,
} from './knowledge.adapter';

@Module({
  providers: [
    MockKnowledgeAdapter,
    { provide: KNOWLEDGE_PORT_TOKEN, useExisting: MockKnowledgeAdapter },
  ],
  exports: [KNOWLEDGE_PORT_TOKEN],
})
export class KnowledgeModule {}
