import dns from 'dns'
import URL from 'url'
import net from 'net'
import stringify from 'json-stringify-safe'
import cloneDeep from 'lodash/cloneDeep'
import LRUCache from 'lru-cache'
import { init as initLogger } from './logging'

const util = require('util')

const dnsResolve = util.promisify(dns.resolve)

export const config = {
  disabled: process.env.AXIOS_DNS_DISABLE === 'true',
  dnsTtlMs: process.env.AXIOS_DNS_CACHE_TTL_MS || 5000, // when to refresh actively used dns entries (5 sec)
  cacheGraceExpireMultiplier: process.env.AXIOS_DNS_CACHE_EXPIRE_MULTIPLIER || 2, // maximum grace to use entry beyond TTL
  dnsIdleTtlMs: process.env.AXIOS_DNS_CACHE_TTL_MS || 1000 * 60 * 10, // when to remove entry entirely if not being used (10 min)
  backgroundScanMs: process.env.AXIOS_DNS_BACKGROUND_SCAN_MS || 2400, // how frequently to scan for expired TTL and refresh (2.4 sec)
  dnsCacheSize: process.env.AXIOS_DNS_CACHE_SIZE || 100, // maximum number of entries to keep in cache
  // pino logging options
  logging: {
    name: 'kafka-publisher',
    // enabled: true,
    // level: 'debug', // default 'info' //comment out or set to 'info'
    // timestamp: true,
    prettyPrint: process.env.NODE_ENV === 'DEBUG' || false,
    useLevelLabels: true,
  },
  cache: undefined,
}

export const cacheConfig = {
  max: config.dnsCacheSize,
  maxAge: (config.dnsTtlMs * config.cacheGraceExpireMultiplier), // grace for refresh
}

let log
let backgroundRefreshId
let cachePruneId

init()

export function init() {
  log = initLogger(config.logging)

  if (config.cache) return

  config.cache = new LRUCache(cacheConfig)

  startBackgroundRefresh()
  startPeriodicCachePrune()
  cachePruneId = setInterval(() => config.cache.prune(), config.dnsIdleTtlMs)
}

export function startBackgroundRefresh() {
  if (backgroundRefreshId) clearInterval(backgroundRefreshId)
  backgroundRefreshId = setInterval(backgroundRefresh, config.backgroundScanMs)
}

export function startPeriodicCachePrune() {
  if (cachePruneId) clearInterval(cachePruneId)
  cachePruneId = setInterval(() => config.cache.prune(), config.dnsIdleTtlMs)
}

// const dnsEntry = {
//   host: 'www.amazon.com',
//   ips: [
//     '52.54.40.141',
//     '34.205.98.207',
//     '3.82.118.51',
//   ],
//   nextIdx: 0,
//   lastUsedTs: 1555771516581, Date.now()
//   updatedTs: 1555771516581,
// }

export function registerInterceptor(axios) {
  if (config.disabled || !axios || !axios.interceptors) return // supertest
  axios.interceptors.request.use(async (reqConfig) => {
    let url
    if (reqConfig.baseURL) {
      url = URL.parse(reqConfig.baseURL)
    } else {
      url = URL.parse(reqConfig.url)
    }

    if (net.isIP(url.hostname)) return reqConfig // skip

    const reqConfigCopy = cloneDeep(reqConfig) // do not modify original which has hostname instead of IP address
    reqConfigCopy.headers.Host = url.hostname // set hostname in header

    url.hostname = await getAddress(url.hostname)
    delete url.host // clear hostname

    if (reqConfigCopy.baseURL) {
      reqConfigCopy.baseURL = URL.format(url)
    } else {
      reqConfigCopy.url = URL.format(url)
    }

    return reqConfigCopy
  })
}

export async function getAddress(host) {
  let dnsEntry = config.cache.get(host)
  if (dnsEntry) {
    dnsEntry.lastUsedTs = Date.now()
    // eslint-disable-next-line no-plusplus
    const ip = dnsEntry.ips[dnsEntry.nextIdx++ % dnsEntry.ips.length] // round-robin
    config.cache.set(host, dnsEntry)
    return ip
  }

  const ips = await dnsResolve(host)
  dnsEntry = {
    host,
    ips,
    nextIdx: 0,
    lastUsedTs: Date.now(),
    updatedTs: Date.now(),
  }
  // eslint-disable-next-line no-plusplus
  const ip = dnsEntry.ips[dnsEntry.nextIdx++ % dnsEntry.ips.length] // round-robin
  config.cache.set(host, dnsEntry)
  return ip
}

let backgroundRefreshing = false
export async function backgroundRefresh() {
  if (backgroundRefreshing) return // don't start again if currently iterating slowly
  backgroundRefreshing = true
  try {
    config.cache.forEach(async (value, key) => {
      try {
        if (value.updatedTs + config.dnsTtlMs > Date.now()) {
          return // continue/skip
        }
        if (value.lastUsedTs + config.dnsIdleTtlMs <= Date.now()) {
          config.cache.del(key)
          return // continue
        }

        const ips = await dnsResolve(value.host)
        value.ips = ips
        value.updatedTs = Date.now()
        config.cache.set(key, value)
      } catch (err) {
        // best effort
        log.error(err, `Error backgroundRefresh host: ${key}, ${stringify(value)}`)
      }
    })
  } catch (err) {
    log.error(err, 'Error backgroundRefresh')
  } finally {
    backgroundRefreshing = false
  }
}
