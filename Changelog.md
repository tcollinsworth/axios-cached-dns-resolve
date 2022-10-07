# Changelog

## [3.2.1] - 2022-09-06

### Fixed

- Fixed bug were getDnsCacheEntries was returning generator from lru-cache to instead return array


## [3.2.0] - 2022-09-06

### Changed

- Updated lru-cache to latest version

### Fixed

- Fixed bug were fallback from dns.resolve failure to dns.lookup was not interpreting response array
