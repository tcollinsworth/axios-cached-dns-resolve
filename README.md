# axios-cached-dns-resolve

Axios uses the default node.js dns.resolve to resolve host names.
dns.resolve is synchronous and runs on limited libuv worker thread pool.
Every axios request will resolve the dns name in kubernetes, openshift, and cloud environments that intentionally set TTL to 0.

This library uses dns.resolve and can optionally cache resolutions and round-robin among addresses. The cache size is configurable.
If caching is enabled, a background thread will periodically refresh resolutions with dns.resolve rather than every request performing dns.lookup.

## Requirements

Node 8+

## Getting started

```console
npm i -S axios-cached-dns-resolve
```

# Usage

```javascript

```
