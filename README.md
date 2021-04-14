# axios-cached-dns-resolve

Axios uses node.js dns.lookup to resolve host names.
dns.lookup is synchronous and executes on limited libuv thread pool.
Every axios request will resolve the dns name in kubernetes, openshift, and cloud environments that intentionally set TTL low or to 0 for quick dynamic updates.
The dns resolvers can be overwhelmed with the load.
There is/was a bug in DNS resolutions that manifests as very long dns.lookups in node.js.

From the kubernetes [documentation](https://kubernetes.io/docs/concepts/services-networking/service/#why-not-use-round-robin-dns)

```
Even if apps and libraries did proper re-resolution, the load of every client re-resolving DNS over and over would be difficult to manage.
```

This library uses dns.resolve and can optionally cache resolutions and round-robin among addresses. The cache size is configurable.
If caching is enabled, a background thread will periodically refresh resolutions with dns.resolve rather than every request.
There is an idle TTL that evicts background refresh if an address is no longer being used.
This lib proxies through the OS resolution mechanism which may provide further caching.

## Objectives

  * Async requests - dns resolve vs lookup
  * Fast - local in-app memory cache lookup
  * Fresh - periodically (frequently) updated
  * Constant DNS load/latency vs random load/variable latency
  * Providing statistics and introspection

## Requirements

ECMAScript module (esm/.mjs)

Node 14+

## Getting started

```console
npm i -S axios-cached-dns-resolve
```

# Usage

```javascript
  import { registerInterceptor } from 'axios-cached-dns-resolve'

  const axiosClient = axios.create(config)

  registerInterceptor(axiosClient)

```
Use axiosClient as normal


## Configuration

```javascript
const config = {
  disabled: process.env.AXIOS_DNS_DISABLE === 'true',
  dnsTtlMs: process.env.AXIOS_DNS_CACHE_TTL_MS || 5000, // when to refresh actively used dns entries (5 sec)
  cacheGraceExpireMultiplier: process.env.AXIOS_DNS_CACHE_EXPIRE_MULTIPLIER || 2, // maximum grace to use entry beyond TTL
  dnsIdleTtlMs: process.env.AXIOS_DNS_CACHE_IDLE_TTL_MS || 1000 * 60 * 60, // when to remove entry entirely if not being used (1 hour)
  backgroundScanMs: process.env.AXIOS_DNS_BACKGROUND_SCAN_MS || 2400, // how frequently to scan for expired TTL and refresh (2.4 sec)
  dnsCacheSize: process.env.AXIOS_DNS_CACHE_SIZE || 100, // maximum number of entries to keep in cache
  // pino logging options
  logging: {
    name: 'axios-cache-dns-resolve',
    // enabled: true,
    level: process.env.AXIOS_DNS_LOG_LEVEL || 'info', // default 'info' others trace, debug, info, warn, error, and fatal
    // timestamp: true,
    prettyPrint: process.env.NODE_ENV === 'DEBUG' || false,
    useLevelLabels: true,
  },
}
```

## Statistics

Statistics are available via 

```javascript
getStats()

{
  "dnsEntries": 4,
  "refreshed": 375679,
  "hits": 128689,
  "misses": 393,
  "idleExpired": 279,
  "errors": 0,
  "lastError": 0,
  "lastErrorTs": 0
}

AND

getDnsCacheEntries()

[
  {
    "host": "foo-service.domain.com",
    "ips": [
      "51.210.235.165",
      "181.73.135.40"
    ],
    "nextIdx": 1,
    "lastUsedTs": 1604151366910,
    "updatedTs": 1604152691039
  },
  ...
]
```

### Express Statistics

```javascript
import { getStats, getDnsCacheEntries } from 'axios-cached-dns-resolve'

router.get('/axios-dns-cache-statistics', getAxiosDnsCacheStatistics)

function getAxiosDnsCacheStatistics(req, resp) {
  resp.json(getStats())
}

router.get('/axios-dns-cache-entries', getAxiosDnsCacheEntries)

function getAxiosDnsCacheEntries(req, resp) {
  resp.json(getDnsCacheEntries())
}
```
