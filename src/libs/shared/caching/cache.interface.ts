/**
 * Cache service interface
 * Provides abstraction for different caching implementations
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /**
   * Atomic SET-if-not-exists (SETNX). Returns true if THIS call set the key
   * (caller "wins" → proceed), false if the key already existed (caller should
   * treat as duplicate and drop). Used for idempotency claims.
   */
  setIfNotExist<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void>;
  mdelete(keys: string[]): Promise<void>;
  incr(key: string, by?: number): Promise<number>;
  decr(key: string, by?: number): Promise<number>;
  ttl(key: string): Promise<number>;
  /**
   * Delete all keys matching a glob-style pattern.
   * Pattern uses glob matching (e.g., "cache:v2:port:invoice:*").
   * Returns the number of keys deleted.
   */
  deleteByPattern(pattern: string): Promise<number>;
}

/**
 * Cache options interface
 */
export interface CacheOptions {
  defaultTtl?: number;
  keyPrefix?: string;
  maxEntries?: number;
  cleanupInterval?: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
}

/**
 * Cache decorator options
 */
export interface CacheDecoratorOptions {
  key?: string | ((...args: any[]) => string);
  ttl?: number;
  condition?: (result: any, args: any[]) => boolean;
  cacheNull?: boolean;
  invalidateOn?: string[];
}
