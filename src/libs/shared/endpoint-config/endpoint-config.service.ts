import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { parse as parseYaml } from 'yaml';
import { StructuredLogger } from '../observability/structured-logger.service';
import { PortEndpointConfig, EndpointConfig } from './endpoint-config.interface';
import { ApiEndpointsSchema } from '../../../../config/api-endpoints.schema';
import { NotFoundException } from '../../core/common/exceptions';

/**
 * Endpoint Configuration Service
 *
 * Loads per-service endpoint configuration from config/api-endpoints.yaml.
 * Supports hot-reload via chokidar file watching (< 100ms reload).
 * Validates config against Zod schema on load.
 * Resolves ${ENV_VAR} template variables in YAML values.
 *
 * AC: #3 — Hot-Reload via chokidar
 */
@Injectable()
export class EndpointConfigService implements OnModuleInit, OnModuleDestroy {
  private config = new Map<string, PortEndpointConfig>();
  private watcher: chokidar.FSWatcher | null = null;
  private readonly configPath: string;
  private readonly logger = new Logger(EndpointConfigService.name);

  constructor(private readonly structuredLogger: StructuredLogger) {
    // Resolve config path relative to project root (cwd)
    this.configPath = path.resolve(process.cwd(), 'config', 'api-endpoints.yaml');
  }

  async onModuleInit(): Promise<void> {
    await this.loadConfig();
    this.startWatcher();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Get configuration for a specific port/endpoint.
   * @throws Error if port name not found
   */
  getEndpointConfig(portName: string): PortEndpointConfig {
    const config = this.config.get(portName);
    if (!config) {
      throw new NotFoundException(`Endpoint config not found for port: ${portName}`, 'ENDPOINT_CONFIG_NOT_FOUND', { portName });
    }
    return config;
  }

  /**
   * Check if a port configuration exists.
   */
  hasEndpointConfig(portName: string): boolean {
    return this.config.has(portName);
  }

  /**
   * Get all loaded configurations.
   */
  getAllConfigs(): Map<string, PortEndpointConfig> {
    return new Map(this.config);
  }

  /**
   * Check if MOCK_MODE is globally enabled.
   * When true, all ports use MockAdapter regardless of individual config.
   * AC: #2
   */
  isMockMode(): boolean {
    return process.env.MOCK_MODE === 'true';
  }

  /**
   * Force reload config from disk.
   * Public for testing — production code should rely on chokidar auto-reload.
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * Resolve ${VAR_NAME} template variables in a string using process.env.
   * Fix #4: Throws fatal error on missing env var (fail-to-start principle).
   */
  private resolveEnvVars(content: string): string {
    return content.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const value = process.env[varName];
      if (value === undefined || value === null) {
        throw new Error(
          `Required environment variable not set: ${varName}. ` +
          `Check your .env file or container environment configuration.`,
        );
      }
      return value;
    });
  }

  /**
   * Load and validate the YAML config file.
   * Uses async file I/O to avoid blocking the event loop.
   * Resolves ${ENV_VAR} templates before Zod validation.
   * Validates against Zod schema — fatal on mismatch in non-production.
   */
  private async loadConfig(): Promise<void> {
    try {
      // Fix #7: async file read
      const rawContent = await fsPromises.readFile(this.configPath, 'utf-8');

      // Fix #2: resolve ${ENV_VAR} template variables
      const resolvedContent = this.resolveEnvVars(rawContent);
      const rawConfig = parseYaml(resolvedContent) as EndpointConfig;

      // Validate against Zod schema
      const result = ApiEndpointsSchema.safeParse(rawConfig);
      if (!result.success) {
        const errorMsg = `Invalid api-endpoints.yaml config: ${result.error.message}`;
        if (process.env.NODE_ENV !== 'production') {
          throw new Error(errorMsg);
        }
        this.logger.warn(errorMsg);
        return;
      }

      const validated = result.data;
      // Atomic swap: build new map first, then assign — never leave config empty
      const newConfig = new Map<string, PortEndpointConfig>();
      for (const [key, value] of Object.entries(validated.services)) {
        newConfig.set(key, value);
      }
      this.config = newConfig;

      this.logger.log(`Loaded ${this.config.size} endpoint configurations`);
    } catch (error) {
      this.logger.error(`Failed to load endpoint config: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Start chokidar file watcher for hot-reload.
   * Reloads config on file change within 100ms (stabilityThreshold).
   * AC: #3
   */
  private startWatcher(): void {
    this.watcher = chokidar.watch(this.configPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', async (filePath: string) => {
      const startTime = Date.now();
      this.logger.log(`Detected config change: ${filePath}`);

      try {
        await this.loadConfig();
        const duration = Date.now() - startTime;
        this.logger.log(`Config reloaded in ${duration}ms`);
      } catch (error) {
        this.logger.error(`Failed to reload config: ${(error as Error).message}`);
      }
    });

    this.watcher.on('error', (error: Error) => {
      this.logger.error(`Config watcher error: ${error.message}`);
    });
  }
}
