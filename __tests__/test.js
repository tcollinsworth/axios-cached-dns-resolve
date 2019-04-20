import { serial as test } from 'ava'
import delay from 'delay'
import dns from 'dns'
import URL from 'url'
import net from 'net'
import LRUCache from 'lru-cache'

import axios from 'axios'
import stringify from 'json-stringify-safe'

import * as axiosCachingDns from '../index'

const util = require('util')
const dnsResolve = util.promisify(dns.resolve)

let axiosClient
let reqHeaders

test.beforeEach(() => {
  axiosCachingDns.config.dnsTtlMs = 1000
  axiosCachingDns.config.dnsIdleTtlMs = 5000
  axiosCachingDns.config.cacheGraceExpireMultiplier = 2
  axiosCachingDns.config.backgroundScanMs = 100

  axiosCachingDns.cacheConfig.maxAge = (axiosCachingDns.config.dnsTtlMs * axiosCachingDns.config.cacheGraceExpireMultiplier)

  axiosCachingDns.config.cache = new LRUCache(axiosCachingDns.cacheConfig)

  axiosClient = axios.create({
    timeout: 5000,
  })

  axiosCachingDns.registerInterceptor(axiosClient)

  axiosCachingDns.startBackgroundRefresh()
  axiosCachingDns.startPeriodicCachePrune()
})

test.after.always(() => {
  axiosCachingDns.config.cache.reset()
})

test('query google with baseURL and relative url', async t => {
  axiosCachingDns.registerInterceptor(axios)

  const { data } = await axios.get('/finance', {
      baseURL: 'http://www.google.com',
      //headers: { Authorization: `Basic ${basicauth}` },
    })
  t.truthy(data)
})

test('query google caches and after idle delay uncached', async t => {
  const resp = await axiosClient.get('https://amazon.com')
  t.truthy(resp.data)
  t.truthy(axiosCachingDns.config.cache.get('amazon.com'))
  await delay(6000)
  t.falsy(axiosCachingDns.config.cache.get('amazon.com'))
})

test('query google caches and refreshes', async t => {
  await axiosClient.get('https://amazon.com')
  const updatedTs = axiosCachingDns.config.cache.get('amazon.com').updatedTs
  const timeoutTime = Date.now() + 5000
  while (true) {
    const dnsEntry = axiosCachingDns.config.cache.get('amazon.com')
    if (!dnsEntry) t.fail('dnsEntry missing or expired')
    //console.log(dnsEntry)
    if (updatedTs != dnsEntry.updatedTs) break
    if (Date.now() > timeoutTime) t.fail()
    await delay(10)
  }
})

test('query two servies, caches and after one idle delay uncached', async t => {
  await axiosClient.get('https://amazon.com')

  await axiosClient.get('https://microsoft.com')
  const lastUsedTs = axiosCachingDns.config.cache.get('microsoft.com').lastUsedTs
  t.is(1, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

  await axiosClient.get('https://microsoft.com')
  t.is(2, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

  t.truthy(lastUsedTs < axiosCachingDns.config.cache.get('microsoft.com').lastUsedTs)

  t.is(2, axiosCachingDns.config.cache.length)
  await axiosClient.get('https://microsoft.com')
  t.is(3, axiosCachingDns.config.cache.get('microsoft.com').nextIdx)

  t.falsy(lastUsedTs === axiosCachingDns.config.cache.get('microsoft.com').lastUsedTs)

  t.is(2, axiosCachingDns.config.cache.length)
  await delay(4000)
  t.is(1, axiosCachingDns.config.cache.length)
  await delay(1000)
  t.is(0, axiosCachingDns.config.cache.length)
})
