# Paths-LE Performance Test Results

**Test Environment:**
- Node.js: v22.19.0
- Platform: darwin arm64
- Date: 2025-10-16T04:56:47.483Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 2359.86ms
- **Average Extraction Time:** 196.66ms
- **Fastest Format:** JAVASCRIPT
- **Slowest Format:** CSV

## Detailed Results

| Format | File | Size | Lines | Time (ms) | Extracted | Paths/sec | MB/sec | Memory (MB) |
|--------|------|------|-------|-----------|-----------|-----------|--------|-----------|
| JSON | 100kb.json | 0.12MB | 3,929 | 2.78 | 2,499 | 898,921 | 43.63 | 3.6899999999999995 |
| CSV | 500kb.csv | 0.5MB | 4,497 | 41.52 | 22,475 | 541,305 | 12.04 | 8.420000000000002 |
| JAVASCRIPT | 1k.js | 0.01MB | 267 | 0.25 | 200 | 800,000 | 39.9 | 0.1599999999999966 |
| JSON | 1mb.json | 1.21MB | 39,327 | 19.97 | 25,025 | 1,253,130 | 60.82 | 0.6200000000000045 |
| CSV | 3mb.csv | 3MB | 26,974 | 155.73 | 134,860 | 865,986 | 19.26 | 23.199999999999996 |
| TOML | 3k.toml | 0.02MB | 1,113 | 5.29 | 556 | 105,104 | 3.77 | 2.279999999999994 |
| JSON | 5mb.json | 6.07MB | 196,649 | 56.58 | 125,139 | 2,211,718 | 107.35 | 35.8 |
| CSV | 10mb.csv | 10MB | 89,915 | 481.72 | 449,565 | 933,250 | 20.76 | 59.94 |
| HTML | 4k.html | 0.03MB | 675 | 0.33 | 667 | 2,021,212 | 90.85 | 0.28999999999999204 |
| JSON | 20mb.json | 24.3MB | 786,579 | 253.36 | 0 | 0 | 95.9 | 126.53999999999999 |
| CSV | 30mb.csv | 30MB | 269,735 | 1307.2 | 0 | 0 | 22.95 | 48.690000000000055 |
| CSV | 10k.csv | 0.5MB | 4,497 | 35.13 | 22,475 | 639,767 | 14.23 | 6.740000000000009 |

## Performance Analysis

**JSON:** Average 83.17ms extraction time, 38,166 paths extracted on average.

**CSV:** Average 404.26ms extraction time, 125,875 paths extracted on average.

**JAVASCRIPT:** Average 0.25ms extraction time, 200 paths extracted on average.

**TOML:** Average 5.29ms extraction time, 556 paths extracted on average.

**HTML:** Average 0.33ms extraction time, 667 paths extracted on average.