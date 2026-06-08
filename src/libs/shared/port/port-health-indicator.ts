/**
 * Port Health Indicator
 *
 * Reports the health of all port circuit breakers to the /health endpoint.
 * UP if all circuits are CLOSED, DEGRADED if any is HALF_OPEN, DOWN if any is OPEN.
 */

import { Injectable } from '@nestjs/common';
import { PortRegistry } from './port-registry.service';
import { CircuitState } from '../resilience/circuit-breaker.decorator';
import type { IHealthIndicator, HealthCheckResult } from '../health/health.interface';
import { HealthStatus } from '../health/health.interface';

@Injectable()
export class PortHealthIndicator implements IHealthIndicator {
  constructor(private readonly portRegistry: PortRegistry) {}

  async check(): Promise<HealthCheckResult> {
    const states = this.portRegistry.getAllCircuitBreakerStates();

    if (states.length === 0) {
      return {
        status: HealthStatus.UP,
        message: 'No ports registered',
        timestamp: new Date().toISOString(),
      };
    }

    const openPorts = states.filter((s) => s.state === CircuitState.OPEN);
    const halfOpenPorts = states.filter((s) => s.state === CircuitState.HALF_OPEN);
    const closedPorts = states.filter((s) => s.state === CircuitState.CLOSED);

    const circuits = states.map((s) => ({
      port: s.portName,
      state: s.state,
      failureRate: s.metrics.failureRate,
    }));

    if (openPorts.length > 0) {
      return {
        status: HealthStatus.DOWN,
        message: `${openPorts.length} circuit breaker(s) OPEN: ${openPorts.map((p) => p.portName).join(', ')}`,
        timestamp: new Date().toISOString(),
        circuits,
        total: states.length,
        open: openPorts.length,
        halfOpen: halfOpenPorts.length,
        closed: closedPorts.length,
      };
    }

    if (halfOpenPorts.length > 0) {
      return {
        status: HealthStatus.DEGRADED,
        message: `${halfOpenPorts.length} circuit breaker(s) in HALF_OPEN probe: ${halfOpenPorts.map((p) => p.portName).join(', ')}`,
        timestamp: new Date().toISOString(),
        circuits,
        total: states.length,
        open: 0,
        halfOpen: halfOpenPorts.length,
        closed: closedPorts.length,
      };
    }

    return {
      status: HealthStatus.UP,
      message: `All ${states.length} port circuit breakers healthy`,
      timestamp: new Date().toISOString(),
      circuits,
      total: states.length,
      open: 0,
      halfOpen: 0,
      closed: closedPorts.length,
    };
  }
}
