/**
 * Aggregation Service
 *
 * Fan-out call wrapper using Promise.allSettled.
 * Handles partial failures gracefully — returns what succeeded,
 * logs what failed.
 *
 * AC: #4 — Zero-core-change port addition (aggregation works with any registered port)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PortRegistry } from './port-registry.service';
import type { PortResult } from './port.interface';

/**
 * Individual call specification for fan-out execution.
 */
export interface AggregationCall {
  /** Port name to call */
  portName: string;
  /** Method to invoke */
  method: string;
  /** Parameters for the call */
  params?: Record<string, unknown>;
}

/**
 * Result of an individual call within an aggregation.
 */
export interface AggregationResult<T = unknown> {
  /** Port name */
  portName: string;
  /** Whether the call succeeded */
  success: boolean;
  /** Result data (if success) */
  data?: T;
  /** Error message (if failure) */
  error?: string;
  /** Execution duration in ms */
  duration: number;
}

/**
 * Overall aggregation result.
 */
export interface AggregationResponse<T = unknown> {
  /** All individual results */
  results: AggregationResult<T>[];
  /** How many calls succeeded */
  succeeded: number;
  /** How many calls failed */
  failed: number;
  /** Total execution duration in ms */
  totalDuration: number;
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly portRegistry: PortRegistry) {}

  /**
   * Execute multiple port calls in parallel via Promise.allSettled.
   * Returns all results (successes AND failures) — never throws on individual failures.
   *
   * AC: #4 — works with any registered port combination.
   */
  async executeAll<T = unknown>(calls: AggregationCall[]): Promise<AggregationResponse<T>> {
    const startTime = Date.now();

    const promises = calls.map((call) =>
      this.portRegistry.execute<T>(call.portName, call.method, call.params ?? {}),
    );

    const settled = await Promise.allSettled(promises);

    const results: AggregationResult<T>[] = settled.map((result, index) => {
      const call = calls[index];
      if (result.status === 'fulfilled') {
        return {
          portName: call.portName,
          success: true,
          data: result.value.data,
          duration: result.value.duration,
        };
      }

      const errorMessage = (result.reason as Error)?.message ?? 'Unknown error';
      this.logger.warn(
        `Aggregation call failed [${call.portName}/${call.method}]: ${errorMessage}`,
      );

      return {
        portName: call.portName,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    });

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = Date.now() - startTime;

    this.logger.log(
      `Aggregation completed: ${succeeded} succeeded, ${failed} failed in ${totalDuration}ms`,
    );

    return {
      results,
      succeeded,
      failed,
      totalDuration,
    };
  }

  /**
   * Resolve individual settled results into a convenient map.
   * fulfilled → value, rejected → null + warning log.
   *
   * Useful for callers that need a simple key-value map by port name.
   */
  resolveToMap<T = unknown>(response: AggregationResponse<T>): Map<string, T | null> {
    const map = new Map<string, T | null>();
    for (const result of response.results) {
      map.set(result.portName, result.success ? result.data ?? null : null);
    }
    return map;
  }

  /**
   * Get only successful results as a map.
   */
  resolveSuccessful<T = unknown>(response: AggregationResponse<T>): Map<string, T> {
    const map = new Map<string, T>();
    for (const result of response.results) {
      if (result.success && result.data !== undefined) {
        map.set(result.portName, result.data);
      }
    }
    return map;
  }
}
