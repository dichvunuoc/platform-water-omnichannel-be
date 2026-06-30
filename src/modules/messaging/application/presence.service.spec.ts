import { PresenceService, AgentStatus } from './presence.service';

describe('PresenceService (in-memory fallback)', () => {
  let svc: PresenceService;

  beforeEach(() => {
    // Create without Redis (cache = undefined → in-memory fallback)
    svc = new PresenceService(undefined as any);
  });

  it('sets and gets agent status', async () => {
    await svc.setStatus('agent-001', AgentStatus.AVAILABLE);
    expect(await svc.getStatus('agent-001')).toBe(AgentStatus.AVAILABLE);
  });

  it('returns null for unknown agent', async () => {
    expect(await svc.getStatus('unknown-agent')).toBeNull();
  });

  it('updates status from AVAILABLE to BUSY', async () => {
    await svc.setStatus('agent-001', AgentStatus.AVAILABLE);
    await svc.setStatus('agent-001', AgentStatus.BUSY);
    expect(await svc.getStatus('agent-001')).toBe(AgentStatus.BUSY);
  });

  it('lists available agents', async () => {
    await svc.setStatus('agent-001', AgentStatus.AVAILABLE);
    await svc.setStatus('agent-002', AgentStatus.AVAILABLE);
    await svc.setStatus('agent-003', AgentStatus.OFFLINE);

    const available = await svc.getAvailableAgents();
    expect(available).toContain('agent-001');
    expect(available).toContain('agent-002');
    expect(available).not.toContain('agent-003');
  });

  it('removes from available when set to OFFLINE', async () => {
    await svc.setStatus('agent-001', AgentStatus.AVAILABLE);
    expect(await svc.getAvailableAgents()).toContain('agent-001');

    await svc.setStatus('agent-001', AgentStatus.OFFLINE);
    expect(await svc.getAvailableAgents()).not.toContain('agent-001');
  });

  it('pickAgentForRouting returns first available agent', async () => {
    await svc.setStatus('agent-001', AgentStatus.AVAILABLE);
    const picked = await svc.pickAgentForRouting();
    expect(picked).toBe('agent-001');
  });

  it('pickAgentForRouting returns null when no agents available', async () => {
    const picked = await svc.pickAgentForRouting();
    expect(picked).toBeNull();
  });
});
