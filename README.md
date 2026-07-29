<p align="center">
  <img src="src/assets/images/icon.png" alt="Paths-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Paths-LE: Zero Hassle Path Extraction</h1>
<p align="center">
  <b>Pull every file path out of the current file in one keystroke</b><br/>
  <i>JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and Environment files</i>
</p>

<p align="center">
  <a href="https://open-vsx.org/extension/nolindnaidoo/paths-le">
    <img src="https://img.shields.io/badge/Install%20from-Open%20VSX-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from Open VSX" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Paths-LE Demo" style="max-width: 100%; height: auto;" />
</p>

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

## More from the LE Family

- **[String-LE](https://open-vsx.org/extension/nolindnaidoo/string-le)** - Extract user-visible strings for i18n and validation • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)
- **[Numbers-LE](https://open-vsx.org/extension/nolindnaidoo/numbers-le)** - Extract and analyze numeric data with statistics • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)
- **[EnvSync-LE](https://open-vsx.org/extension/nolindnaidoo/envsync-le)** - Keep .env files in sync with visual diffs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)
- **[Regex-LE](https://open-vsx.org/extension/nolindnaidoo/regex-le)** - Test and validate regex patterns with live feedback • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.regex-le)
- **[Secrets-LE](https://open-vsx.org/extension/nolindnaidoo/secrets-le)** - Detect and sanitize secrets before you commit • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.secrets-le)
- **[Scrape-LE](https://open-vsx.org/extension/nolindnaidoo/scrape-le)** - Validate scraper targets before debugging • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)
- **[Colors-LE](https://open-vsx.org/extension/nolindnaidoo/colors-le)** - Extract and analyze colors from stylesheets • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)
- **[URLs-LE](https://open-vsx.org/extension/nolindnaidoo/urls-le)** - Extract URLs from any codebase with precision • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)
- **[Dates-LE](https://open-vsx.org/extension/nolindnaidoo/dates-le)** - Extract temporal data from logs and APIs • [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
