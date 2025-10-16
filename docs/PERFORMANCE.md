# Paths-LE Performance Test Results

**Test Environment:**
- Node.js: v22.19.0
- Platform: darwin arm64
- Date: 2025-10-16T01:10:33.208Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 2474.15ms
- **Average Extraction Time:** 206.18ms
- **Fastest Format:** JAVASCRIPT
- **Slowest Format:** CSV

## Detailed Results

| Format | File | Size | Lines | Time (ms) | Extracted | Paths/sec | MB/sec | Memory (MB) |
|--------|------|------|-------|-----------|-----------|-----------|--------|-----------|
| JSON | 100kb.json | 0.12MB | 3,929 | 3.11 | 2,499 | 803,537 | 39 | 0.9199999999999999 |
| CSV | 500kb.csv | 0.5MB | 4,497 | 40.62 | 22,475 | 553,299 | 12.31 | 8.89 |
| JAVASCRIPT | 1k.js | 0.01MB | 268 | 0.22 | 201 | 913,636 | 45.42 | 0.14999999999999858 |
| JSON | 1mb.json | 1.21MB | 39,327 | 19.33 | 25,025 | 1,294,620 | 62.83 | 0.060000000000002274 |
| CSV | 3mb.csv | 3MB | 26,975 | 143.49 | 134,865 | 939,891 | 20.91 | 28.090000000000003 |
| TOML | 3k.toml | 0.02MB | 1,113 | 5.29 | 556 | 105,104 | 3.77 | 2.2900000000000063 |
| JSON | 5mb.json | 6.07MB | 196,660 | 56.06 | 125,146 | 2,232,358 | 108.35 | 35.7 |
| CSV | 10mb.csv | 10MB | 89,912 | 445.4 | 449,550 | 1,009,317 | 22.45 | 63.21000000000001 |
| HTML | 4k.html | 0.03MB | 675 | 0.34 | 667 | 1,961,765 | 88.21 | 0.3100000000000023 |
| JSON | 20mb.json | 24.3MB | 786,590 | 243.8 | 0 | 0 | 99.66 | 0 |
| CSV | 30mb.csv | 30MB | 269,732 | 1483.73 | 0 | 0 | 20.22 | 239.28 |
| CSV | 10k.csv | 0.5MB | 4,497 | 32.76 | 22,475 | 686,050 | 15.26 | 6.699999999999989 |

## Performance Analysis

**JSON:** Average 80.58ms extraction time, 38,168 paths extracted on average.

**CSV:** Average 429.2ms extraction time, 125,873 paths extracted on average.

**JAVASCRIPT:** Average 0.22ms extraction time, 201 paths extracted on average.

**TOML:** Average 5.29ms extraction time, 556 paths extracted on average.

**HTML:** Average 0.34ms extraction time, 667 paths extracted on average.