# Paths-LE Performance Test Results

**Test Environment:**
- Node.js: v24.3.0
- Platform: darwin arm64
- Date: 2025-10-15T18:17:42.581Z

## Summary

- **Total Files Tested:** 12
- **Total Extraction Time:** 2681.48ms
- **Average Extraction Time:** 223.46ms
- **Fastest Format:** JAVASCRIPT
- **Slowest Format:** CSV

## Detailed Results

| Format | File | Size | Lines | Time (ms) | Extracted | Paths/sec | MB/sec | Memory (MB) |
|--------|------|------|-------|-----------|-----------|-----------|--------|-----------|
| JSON | 100kb.json | 0.12MB | 3,929 | 2.95 | 2,499 | 847,119 | 41.11 | 0 |
| CSV | 500kb.csv | 0.5MB | 4,496 | 43.12 | 22,470 | 521,104 | 11.6 | 0 |
| JAVASCRIPT | 1k.js | 0.01MB | 267 | 0.53 | 200 | 377,358 | 18.82 | 0 |
| JSON | 1mb.json | 1.21MB | 39,327 | 21.72 | 25,025 | 1,152,164 | 55.92 | 5.109999999999999 |
| CSV | 3mb.csv | 3MB | 26,973 | 184.69 | 134,855 | 730,169 | 16.24 | 33.67 |
| TOML | 3k.toml | 0.02MB | 1,113 | 2.91 | 556 | 191,065 | 6.86 | 0 |
| JSON | 5mb.json | 6.07MB | 196,638 | 99.17 | 125,132 | 1,261,793 | 61.25 | 0 |
| CSV | 10mb.csv | 10MB | 89,906 | 610.01 | 449,520 | 736,906 | 16.39 | 81.32999999999998 |
| HTML | 4k.html | 0.03MB | 675 | 0.59 | 667 | 1,130,508 | 50.86 | 0 |
| JSON | 20mb.json | 24.3MB | 786,590 | 433.93 | 500,556 | 1,153,541 | 55.99 | 32.06999999999999 |
| CSV | 30mb.csv | 30MB | 269,740 | 1249.22 | 0 | 0 | 24.01 | 0 |
| CSV | 10k.csv | 0.5MB | 4,495 | 32.64 | 22,465 | 688,266 | 15.32 | 46.670000000000016 |

## Performance Analysis

**JSON:** Average 139.44ms extraction time, 163,303 paths extracted on average.

**CSV:** Average 423.94ms extraction time, 125,862 paths extracted on average.

**JAVASCRIPT:** Average 0.53ms extraction time, 200 paths extracted on average.

**TOML:** Average 2.91ms extraction time, 556 paths extracted on average.

**HTML:** Average 0.59ms extraction time, 667 paths extracted on average.