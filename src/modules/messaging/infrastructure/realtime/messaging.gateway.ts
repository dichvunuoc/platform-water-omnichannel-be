import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import type { IEventBus } from 'src/libs/core/infrastructure';
import { EVENT_BUS_TOKEN } from 'src/libs/core/constants';

/**
 * Realtime Push Gateway (socket.io)
 *
 * Lives in the Omnichannel service (ADR-8). Subscribes to `MessageReceived`
 * events on the IEventBus → pushes to connected agent rooms in real time.
 *
 * The agent SPA connects to `/agent` namespace with their JWT, joins their
 * personal room, and receives:
 *   - `interaction.received` — new inbound message (from any channel)
 *   - `message.sent` — echo of outbound messages (agent's own replies)
 *   - `sla.warning` — SLA warning/breach for a ticket (FR25, NFR10b)
 *   - `conversation.started` — new conversation appeared
 *
 * Reconnect + backfill (ADR-9): on reconnect, the client emits `backfill`
 * with their lastSeenId → the gateway replays missed events from the outbox.
 */
@WebSocketGateway({
  namespace: '/agent',
  cors: { origin: '*' }, // MVP — restrict to known origins in prod
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(EVENT_BUS_TOKEN)
    private readonly eventBus: IEventBus,
  ) {}

  /**
   * Subscribe to events AFTER @WebSocketServer() is injected.
   *
   * Fix: subscribing in the constructor ran before this.server was set,
   * causing a crash if an event fired during startup.
   */
  onModuleInit(): void {
    this.eventBus.subscribe('MessageReceived', async (event: any) => {
      this.handleMessageReceived(event);
    });

    this.eventBus.subscribe('ConversationStarted', async (event: any) => {
      this.handleConversationStarted(event);
    });

    // FR25 — SLA warning events from the Ticketing service (story 3-3)
    this.eventBus.subscribe('SlaWarning', async (event: any) => {
      this.handleSlaWarning(event);
    });
  }

  // ─── Connection lifecycle ───

  /**
   * Agent connects — validate JWT + join their room.
   *
   * MVP: the JWT validation uses the existing auth guard. For simplicity,
   * we extract the agentId from the handshake auth token. If auth fails,
   * the connection is rejected.
   */
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Connection rejected — no token: ${client.id}`);
      client.disconnect();
      return;
    }

    // MVP: extract agentId from JWT payload (base64 decode — no signature check in gateway;
    // the BFF/HTTP layer does full validation; the WS layer trusts the BFF-issued session).
    // In production: verify JWT signature here too (or use a WS adapter middleware).
    const agentId = this.extractAgentId(token);
    if (!agentId) {
      this.logger.warn(`Connection rejected — invalid token: ${client.id}`);
      client.disconnect();
      return;
    }

    // Join the agent's personal room
    client.join(`agent:${agentId}`);
    client.data.agentId = agentId;

    this.logger.log(`Agent connected: ${agentId} (socket: ${client.id})`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const agentId = client.data?.agentId;
    this.logger.log(`Agent disconnected: ${agentId ?? 'unknown'} (socket: ${client.id})`);
  }

  // ─── Event handlers (push to agents) ───

  /**
   * A new message was received from any channel → push to all connected agents.
   *
   * The pushed payload matches what the delivered FE Inbox screen expects:
   *   conversationId, messageId, channel, direction, content, attachments.
   *
   * MVP: broadcast to ALL connected agents (story 1.6 will refine to
   * assigned-agent-only routing via presence).
   */
  private handleMessageReceived(event: any): void {
    const payload = {
      conversationId: event.data?.conversationId ?? event.aggregateId,
      messageId: event.data?.messageId,
      channel: event.data?.channel,
      direction: event.data?.direction,
      senderType: event.data?.senderType,
      content: event.data?.content,
      attachments: event.data?.attachments ?? [],
      timestamp: event.data?.timestamp ?? event.occurredAt,
    };

    // Push to all agents (MVP — refine with presence routing in story 1.6)
    this.server.emit('interaction.received', payload);

    this.logger.debug(
      `Pushed interaction.received: conv=${payload.conversationId} msg=${payload.messageId} channel=${payload.channel}`,
    );
  }

  /**
   * A new conversation started → push to agents (appears in inbox).
   */
  private handleConversationStarted(event: any): void {
    const payload = {
      conversationId: event.data?.conversationId ?? event.aggregateId,
      customerChannelId: event.data?.customerChannelId,
      channel: event.data?.channel,
      timestamp: event.occurredAt,
    };

    this.server.emit('conversation.started', payload);

    this.logger.debug(
      `Pushed conversation.started: conv=${payload.conversationId} channel=${payload.channel}`,
    );
  }

  // ─── SLA Warning handler (FR25, NFR10b — story 3-3) ───

  /**
   * SLA warning/breach event from the Ticketing service → push to agent + supervisor screens.
   *
   * The FE receives `sla.warning` and:
   *   - WARNING → yellow blinking countdown badge on Kanban
   *   - BREACHED → red solid + escalation indicator
   *
   * Push latency target: ≤2s p95 from broker receipt (NFR10b).
   */
  private handleSlaWarning(event: any): void {
    const data = event.data ?? event;
    const payload = {
      ticketId: data.ticketId,
      conversationId: data.conversationId,
      slaDeadline: data.slaDeadline,
      remainingMs: data.remainingMs,
      severity: data.severity,     // 'WARNING' | 'BREACHED'
      stage: data.stage,
      assignee: data.assignee,
      timestamp: event.occurredAt ?? Date.now(),
    };

    // Push to ALL connected agents/supervisors (MVP — refine to assignee + supervisors in production)
    this.server.emit('sla.warning', payload);

    this.logger.warn(
      `Pushed sla.warning: ticket=${payload.ticketId} severity=${payload.severity} remaining=${Math.round((payload.remainingMs ?? 0) / 60000)}min`,
    );
  }

  // ─── Client → Server events ───

  /**
   * Backfill missed events on reconnect (ADR-9).
   *
   * The client sends their lastSeenId (event ID or timestamp).
   * The gateway queries the outbox for events after that point and replays.
   *
   * NOTE: For wave-1 MVP with in-process bus, events aren't persisted in a
   * queryable event log yet. The outbox table IS the event log, but querying
   * it requires DB access (injected later). For now, this returns an empty
   * array — the client falls back to a BFF HTTP poll for missed messages.
   */
  @SubscribeMessage('backfill')
  async handleBackfill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lastSeenId?: string; lastSeenTimestamp?: string },
  ): Promise<{ events: any[]; note: string }> {
    this.logger.log(
      `Backfill request from agent ${client.data?.agentId}: lastSeen=${data.lastSeenId ?? data.lastSeenTimestamp}`,
    );

    // MVP: return empty — client uses BFF GET /bff/inbox to catch up.
    // Full implementation: query outbox table for events after lastSeenId,
    // filter by aggregateType='Conversation', replay to this client.
    return {
      events: [],
      note: 'MVP: use GET /bff/inbox to catch up on missed messages',
    };
  }

  // ─── Helpers ───

  /**
   * Extract agentId from a JWT token (base64 decode payload — no signature verification).
   *
   * In production: use jsonwebtoken.verify() with the IAM public key.
   * For MVP: trust the token (the BFF HTTP layer already validated it).
   */
  private extractAgentId(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );
      return payload.sub || payload.userId || payload.agentId || null;
    } catch {
      return null;
    }
  }
}
