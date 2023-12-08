import type { AxiosInstance } from 'axios'
import type * as LRUCache from 'lru-cache'
import type { LoggerOptions } from 'pino'

declare module 'axios-cached-dns-resolve' {
    export interface DnsEntry {
        host: string
        ips: string[]
        nextIdx: number
        lastUsedTs: number
        updatedTs: number
    }

    export interface Config {
        disabled: boolean
        dnsTtlMs: number
        cacheGraceExpireMultiplier: number
        dnsIdleTtlMs: number
        backgroundScanMs: number
        dnsCacheSize: number
        logging: LoggerOptions
        cache?: LRUCache<string, DnsEntry>
    }

    export const config: Config

    export interface CacheConfig {
        max: number
        ttl: number
    }

    export const cacheConfig: CacheConfig

    export interface Stats {
        dnsEntries: number
        refreshed: number
        hits: number
        misses: number
        idleExpired: number
        errors: number
        lastError: number | Error | string
        lastErrorTs: number
    }

    export const stats: Stats

    export function init(): void

    export function reset(): void

    export function startBackgroundRefresh(): void

    export function startPeriodicCachePrune(): void

    export function getStats(): Stats

    export function getDnsCacheEntries(): DnsEntry[]

    export function registerInterceptor(axios?: AxiosInstance): void

    export function getAddress(host: string): Promise<string>

    export function backgroundRefresh(): Promise<void>
}
