/** KnowledgeModule port + token + mock adapter (tri thức & kịch bản → kb service). */
import { Injectable } from '@nestjs/common';
import { cskhKnowledge, type KnowledgeBase } from '../cskh-bff/cskh-fixture';

export const KNOWLEDGE_PORT_TOKEN = 'CSKH_KNOWLEDGE_PORT';
export interface IKnowledgePort {
  list(): KnowledgeBase;
}

@Injectable()
export class MockKnowledgeAdapter implements IKnowledgePort {
  list() {
    return cskhKnowledge;
  }
}
