<p align="center">
  <img src="src/assets/images/icon.png" alt="Paths-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Paths-LE: Zero Hassle Path Extraction</h1>
<p align="center">
  <b>Pull every file path out of the current file in one keystroke</b><br/>
  <i>JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and Environment files</i>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
  <a href="https://letools.dev">
    <img src="https://img.shields.io/badge/LE%20Tools-letools.dev-blue?style=for-the-badge" alt="LE Tools" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Paths-LE Demo" style="max-width: 100%; height: auto;" />
</p>

> **Useful?** A star or rating is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/paths-le) ·
> [★ Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le&ssr=false#review-details) ·
> [★ Open VSX](https://open-vsx.org/extension/OffensiveEdge/paths-le/reviews)

## What it does

Open a file, press `Ctrl+Alt+P` (`Cmd+Alt+P` on Mac), and every file path in the document lands in a new editor — deduplicate and sort it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Import analysis** — extract local imports from JS/TS, including multi-line import statements; npm package names are filtered out
- **Asset auditing** — every `src`, `href`, `srcset`, `url()`, and `@import` in HTML/CSS
- **Config review** — path-like values from JSON/JSONC, TOML, CSV, and `.env` files

## Supported formats

| Format | Language IDs | What gets extracted |
|---|---|---|
| JavaScript / TypeScript | `javascript`, `javascriptreact`, `typescript`, `typescriptreact` | `import`/`export … from`, side-effect imports, dynamic `import()`, `require()` — file paths only, package names excluded |
| JSON / JSONC | `json`, `jsonc` | Path-like string values (comments and trailing commas supported) |
| HTML | `html` | `src`, `href`, `srcset` (each entry), `action`, `poster`, and similar attributes |
| CSS / SCSS / LESS | `css`, `scss`, `less` | `url()` and `@import` |
| TOML | `toml` | Path-like values and keys |
| CSV | `csv` | Path-like cells |
| Environment | `dotenv`, `env` | Path-like variable values and names |

Positions are real source positions for JS/TS, JSON/JSONC, HTML, and CSS (exact line and column of the path); TOML positions are located in the source text and can be approximate for repeated identical values; CSV positions are row/cell coordinates. Version strings (`1.8.1`) and IP addresses are never treated as paths, and `data:`/`javascript:` URLs are excluded from HTML/CSS extraction. Known limitation: bare domains like `example.com` are indistinguishable from filenames and are extracted.

## Commands

| Command | Description |
|---|---|
| `Paths-LE: Extract Paths` (`Ctrl+Alt+P` / `Cmd+Alt+P`) | Extract all paths from the active document |
| `Paths-LE: Deduplicate Paths` | Remove duplicate lines from the results |
| `Paths-LE: Sort Paths` | Sort results alphabetically or by length |
| `Paths-LE: Open Settings` | Open Paths-LE settings |
| `Paths-LE: Help` | Built-in documentation |

## Settings

| Setting | Default | Description |
|---|---|---|
| `paths-le.openResultsSideBySide` | `true` | Open results beside the current editor |
| `paths-le.postProcess.openInNewFile` | `true` | Open results in a new file (when not side-by-side) |
| `paths-le.copyToClipboardEnabled` | `false` | Also copy results to the clipboard |
| `paths-le.notificationsLevel` | `silent` | `all` = every notification, `important` = warnings + errors, `silent` = errors only |
| `paths-le.safety.enabled` | `true` | Guardrails for very large files |
| `paths-le.safety.fileSizeWarnBytes` | `1000000` | Refuse extraction above this file size |
| `paths-le.safety.largeOutputLinesThreshold` | `50000` | Warn above this line count |
| `paths-le.statusBar.enabled` | `true` | Show the status bar item |
| `paths-le.telemetryEnabled` | `false` | Local-only event log (see Privacy) |
| `paths-le.resolution.resolveSymlinks` | `false` | ⚠️ Resolve symlinks to canonical paths |
| `paths-le.resolution.resolveWorkspaceRelative` | `false` | ⚠️ Resolve paths against workspace folders |

The settings UI is translated into 12 languages besides English.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Paths-LE Telemetry`).
- **Canonical resolution is opt-in and warned.** Resolving symlinks/workspace-relative paths can put absolute filesystem paths into the results document; the extension warns before first use. Leave both `resolution.*` settings off unless you need them.
- Error notifications redact home directories and credential-shaped fragments.

## Development

```bash
bun install
bun run build            # esbuild bundle -> dist/extension.js
bun run typecheck        # tsc --noEmit (includes tests)
bun run test             # vitest unit suite
bun run test:integration # real VS Code extension host
bun run lint             # biome
bun run package          # VSIX into release/
```

Architecture and conventions live in [AGENTS.md](AGENTS.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Performance

<!-- performance:start -->
| Input | Size | Found | Time | Rate | Scan speed |
| --- | --- | --- | --- | --- | --- |
| TypeScript imports | 2.10 MB | 40,000 | 20.4 ms | 1,960,564/sec | 103.1 MB/s |
| JSON config | 1.17 MB | 40,001 | 25.1 ms | 1,593,917/sec | 46.7 MB/s |
| HTML document | 1.27 MB | 40,000 | 17.57 ms | 2,277,234/sec | 72 MB/s |
| CSS stylesheet | 1.57 MB | 40,000 | 18.59 ms | 2,151,130/sec | 84.5 MB/s |
| CSV data | 2.09 MB | 60,000 | 57.33 ms | 1,046,485/sec | 36.5 MB/s |

Median of 7 runs after warmup, on Apple M5 Pro, 24 GB RAM, Node 24.3.0. Inputs are generated
by `scripts/benchmark.ts` rather than checked in, so the sizes above are
exactly what was measured. Reproduce with `bun run benchmark`.

These are machine-specific and are not asserted in CI — a benchmark that gates
a build only tells you how busy the runner was.
<!-- performance:end -->

## Testing

<!-- coverage:start -->
| Metric | Coverage |
| --- | --- |
| Statements | 82.18% |
| Branches | 73.58% |
| Functions | 88.18% |
| Lines | 82.49% |

142 test cases across 16 files, plus an integration suite that runs
in a real VS Code extension host and an end-to-end test that installs the
built `.vsix` into a clean profile.

Generated from `coverage/coverage-summary.json` by
`scripts/coverage-readme.js`; CI fails if this section drifts from a fresh
run. Reproduce with `bun run test:coverage`.
<!-- coverage:end -->

## More from the LE Family

Every tool in the family, one page: **[letools.dev](https://letools.dev)**

- **[String-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)** - Extract string values for i18n from JSON, YAML, CSV, TOML, INI, and .env
- **[Numbers-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)** - Extract numeric values from JSON, YAML, CSV, TOML, INI, and .env
- **[EnvSync-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)** - Spot missing keys across your .env files, with a markdown report
- **[Regex-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.regex-le)** - Find, test, and validate regular expressions with ReDoS screening
- **[Secrets-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.secrets-le)** - Detect and sanitize credentials locally, before you commit
- **[Scrape-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)** - Check whether a page is scrapeable before you write the scraper
- **[Colors-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)** - Extract and analyze colors from CSS, SCSS, LESS, Stylus, HTML, JS/TS, and SVG
- **[URLs-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)** - Extract URLs from documentation, configs, and code
- **[Dates-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)** - Extract and analyze dates from logs, configs, and code

## Also by nolindnaidoo

**Rust**

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** - Mark pixel-exact coordinates machines can use · [pixelcoords.dev](https://pixelcoords.dev)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** - Perform the interaction and confirm it landed · [pixelactions.dev](https://pixelactions.dev)

**Contact Developer** — [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
