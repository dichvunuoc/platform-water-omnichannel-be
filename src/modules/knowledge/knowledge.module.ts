/** KnowledgeModule — tri thức & kịch bản port. Mock default. */
import { Module } from '@nestjs/common';
import { KNOWLEDGE_PORT_TOKEN } from '../messaging/constants/cskh-aggregation.tokens';
import { MockKnowledgeAdapter } from '../messaging/infrastructure/adapters/mock/mock-cskh-aggregation.adapters';

@Module({
  providers: [MockKnowledgeAdapter, { provide: KNOWLEDGE_PORT_TOKEN, useExisting: MockKnowledgeAdapter }],
  exports: [KNOWLEDGE_PORT_TOKEN],
})
export class KnowledgeModule {}
