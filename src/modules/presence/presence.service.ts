import { Injectable, Optional, Inject, Logger } from '@nestjs/common';
import type { ICacheService } from 'src/libs/core/infrastructure';
import { CACHE_SERVICE_TOKEN } from 'src/libs/core/constants';

/**
 * Agent availability status (FR16).
 */
export enum AgentStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
}

/**
 * Presence Service (FR16)
 *
 * Tracks agent availability in Redis (or in-memory fallback).
 * Used by:
 *   - Routing: assign new conversations to AVAILABLE agents.
 *   - Realtime gateway (story 1.6 refinement): target pushes to the assigned agent.
 *   - Dashboard (story 8): show who's online.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly PRESENCE_PREFIX = 'presence:agent:';
  private readonly AVAILABLE_SET = 'presence:available';
  private readonly TTL = 300; // 5 min — agent must heartbeat to stay available

  constructor(
    @Optional()
    @Inject(CACHE_SERVICE_TOKEN)
    private readonly cache?: ICacheService,
  ) {
    if (!cache) {
      this.logger.warn('PresenceService initialized without Redis — using in-memory fallback');
    }
  }

  /**
   * Set agent availability status.
   */
  async setStatus(agentId: string, status: AgentStatus): Promise<void> {
    const key = `${this.PRESENCE_PREFIX}${agentId}`;

    if (this.cache) {
      await this.cache.set(key, status, this.TTL);

      // Maintain the available-agents set
      if (status === AgentStatus.AVAILABLE) {
        await this.cache.set(`${this.AVAILABLE_SET}:${agentId}`, '1', this.TTL);
      } else {
        await this.cache.delete(`${this.AVAILABLE_SET}:${agentId}`);
      }
    } else {
      this.memoryStore.set(key, { status, expiresAt: Date.now() + this.TTL * 1000 });
      if (status === AgentStatus.AVAILABLE) {
        this.memoryAvailable.add(agentId);
      } else {
        this.memoryAvailable.delete(agentId);
      }
    }

    this.logger.debug(`Agent ${agentId} → ${status}`);
  }

  /**
   * Get an agent's current status.
   */
  async getStatus(agentId: string): Promise<AgentStatus | null> {
    const key = `${this.PRESENCE_PREFIX}${agentId}`;

    if (this.cache) {
      return (await this.cache.get<AgentStatus>(key)) ?? null;
    }

    const entry = this.memoryStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.status as AgentStatus;
    }
    this.memoryStore.delete(key);
    this.memoryAvailable.delete(agentId);
    return null;
  }

  /**
   * Get all currently-available agents (for routing).
   */
  async getAvailableAgents(): Promise<string[]> {
    if (this.cache) {
      // Scan the available set — MVP: we track individual keys.
      // In production: use SCAN or a Redis SET.
      // For now: we can't enumerate Redis keys cheaply; return empty + rely on
      // the routing logic to check specific agents.
      // TODO wave-2: use a Redis SET (SADD/SREM/SMEMBERS) for the available pool.
      return [];
    }

    // In-memory: filter by expiry
    const now = Date.now();
    const available: string[] = [];
    for (const agentId of this.memoryAvailable) {
      const key = `${this.PRESENCE_PREFIX}${agentId}`;
      const entry = this.memoryStore.get(key);
      if (entry && entry.expiresAt > now) {
        available.push(agentId);
      } else {
        this.memoryAvailable.delete(agentId);
        this.memoryStore.delete(key);
      }
    }
    return available;
  }

  /**
   * Pick the next available agent for routing (round-robin).
   * MVP: picks the first available. Wave-2: round-robin / least-loaded.
   */
  async pickAgentForRouting(): Promise<string | null> {
    const available = await this.getAvailableAgents();
    if (available.length === 0) {
      // Fallback: broadcast to all (MVP — story 1.3 already broadcasts)
      return null;
    }
    return available[0];
  }

  // --- In-memory fallback ---

  private readonly memoryStore = new Map<string, { status: string; expiresAt: number }>();
  private readonly memoryAvailable = new Set<string>();
}
