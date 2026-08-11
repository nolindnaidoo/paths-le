# paths-le-mcp

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/OffensiveEdge/paths-le">
    <img src="https://img.shields.io/open-vsx/dt/OffensiveEdge/paths-le?style=for-the-badge&label=Open%20VSX&color=blue" alt="Open VSX downloads" />
  </a>
  <a href="https://www.npmjs.com/package/paths-le-mcp">
    <img src="https://img.shields.io/npm/v/paths-le-mcp?style=for-the-badge&label=MCP%20server&color=blue&logo=npm" alt="paths-le-mcp on npm" />
  </a>
  <a href="https://letools.dev/tools/paths-le">
    <img src="https://img.shields.io/badge/LE%20Tools-letools.dev-blue?style=for-the-badge" alt="LE Tools" />
  </a>
</p>

An [MCP](https://modelcontextprotocol.io) server that extracts URLs from
documentation, configuration and code — the extraction engine behind the
[Paths-LE](https://letools.dev/tools/paths-le)
editor extension, exposed as a tool an agent can call.

No dependencies, no network calls, no filesystem access. Content goes in,
structured results come out.

## Use it

Point any MCP host at `npx paths-le-mcp`.

**Claude Code**

```bash
claude mcp add paths-le -- npx -y paths-le-mcp
```

**Anything with a JSON config** — Cursor, Windsurf, Claude Desktop:

```json
{
  "mcpServers": {
    "paths-le": {
      "command": "npx",
      "args": ["-y", "paths-le-mcp"]
    }
  }
}
```

**VS Code and Zed** need nothing here. Install the extension instead — it
carries this server and registers it for you:
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)
· [Open VSX](https://open-vsx.org/extension/OffensiveEdge/paths-le)
· [Zed](https://zed.dev/docs/ai/mcp) *(no listing yet — add it by hand)*

**No Node?** The same `extract_paths` tool ships in a static Rust binary:
`cargo install paths-le`, then `paths-le mcp`
([crates.io](https://crates.io/crates/paths-le)). The two servers answer
identically — one fixture corpus runs against both and CI fails if they
diverge — so pick on runtime, not behaviour. The binary additionally
offers `paths_le_audit`, which resolves the paths it finds against the
filesystem; **this server deliberately reads no files**, which is what
lets an agent call it anywhere.

Prefer a global install to `npx` on every launch:

```bash
npm install -g paths-le-mcp
```

```json
{
  "mcpServers": {
    "paths-le": { "command": "paths-le-mcp" }
  }
}
```

No environment variables, no API key, no configuration of its own. To check it
before wiring it into anything:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y paths-le-mcp
```

If that prints the tool name, the server works.

## The tool

### `extract_paths`

| argument | type | |
|---|---|---|
| `content` | string | **required.** The text to scan. |
| `format` | string | One of `csv`, `toml`, `dotenv`, `javascript`, `typescript`, `json`, `html`, `css`. Common extensions and aliases (`ts`, `tsx`, `jsonc`, `scss`, `env`…) are accepted. Required unless `filename` is given. |
| `filename` | string | Used to infer `format` when it is absent — `tsconfig.json` resolves to `json`, and `.env` to `dotenv`. |
| `dedupe` | boolean | Collapse repeats to the first occurrence. Default `false`. |
| `maxResults` | number | Default `500`, ceiling `5000`. |

Returns each path with its kind — `file`, `relative`, `absolute` or
`url` — and 1-based line and column, plus `meta.truncated` so a capped
result is never mistaken for a complete one. **Columns count UTF-16 code
units**, which is what an editor reports, so a position lines up with
the file open in front of you.

```json
{
  "ok": true,
  "data": {
    "paths": [
      { "value": "./dist/index.js", "type": "relative", "line": 2, "column": 12 },
      { "value": "guide/setup.md", "type": "file", "line": 3, "column": 12 }
    ],
    "fileType": "json"
  },
  "diagnostics": [],
  "meta": { "tool": "extract_paths", "count": 2, "truncated": false }
}
```

**Paths are reported as written.** Nothing is resolved against a
workspace or the filesystem, and this server reads no files — that is
the property that lets an agent call it anywhere. If you want to know
whether a path still *points* at anything, that is the Rust CLI's
`paths_le_audit` tool, above.

Extraction is heuristic, and what it deliberately does **not** match is
documented as carefully as what it does — see the
[extension README](https://github.com/nolindnaidoo/paths-le#readme) and
the CLI's [SPEC.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/SPEC.md).

## Also in the MCP registry

`io.github.nolindnaidoo/paths-le` —
[registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io)

## Nine more like it

One tool each, same shape: content in, structured data out, no network and no
filesystem. Every one is on npm as `<name>-mcp` and in the MCP registry as
`io.github.nolindnaidoo/<name>`.

| Package | Tool | Extracts |
|---|---|---|
| [`urls-le-mcp`](https://www.npmjs.com/package/urls-le-mcp) | `extract_urls` | URLs, with protocol and position |
| [`colors-le-mcp`](https://www.npmjs.com/package/colors-le-mcp) | `extract_colors` | colors from stylesheets and code |
| [`dates-le-mcp`](https://www.npmjs.com/package/dates-le-mcp) | `extract_dates` | dates and timestamps |
| [`numbers-le-mcp`](https://www.npmjs.com/package/numbers-le-mcp) | `extract_numbers` | numeric values |
| [`string-le-mcp`](https://www.npmjs.com/package/string-le-mcp) | `extract_strings` | string values |
| [`regex-le-mcp`](https://www.npmjs.com/package/regex-le-mcp) | `extract_patterns` | regexes, with a ReDoS verdict |
| [`secrets-le-mcp`](https://www.npmjs.com/package/secrets-le-mcp) | `detect_secrets` | credentials, masked — never the value |
| [`envsync-le-mcp`](https://www.npmjs.com/package/envsync-le-mcp) | `compare_env_files` | dotenv key drift, names only |
| [`scrape-le-mcp`](https://www.npmjs.com/package/scrape-le-mcp) | `analyze_robots_txt` | whether a path may be crawled |

Two of them also ship a Rust CLI, which carries the same MCP tool in a
static binary: `cargo install paths-le`
([crates.io](https://crates.io/crates/paths-le)) and
`cargo install scrape-le`
([crates.io](https://crates.io/crates/scrape-le)).

Every tool in the family, one page: **[letools.dev](https://letools.dev)**

## Built by

**[Nolin Naidoo](https://nolindnaidoo.com)** — Chief Engineer, AI/ML & Platform
Architecture. [nolindnaidoo.com](https://nolindnaidoo.com) ·
[GitHub](https://github.com/nolindnaidoo) ·
[LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

### Also from the same workshop

Ten Rust tools built the same way: small, single-purpose, and driven by a
machine rather than a person. pixelcoords and pixelactions make up one loop —
pixelcoords answers *where*, pixelactions *acts* there. The eight LE crates are
the terminal half of the extensions they sit in: the same detection, held to
the extension's own corpus, and an exit code instead of a results editor.

| | | |
|---|---|---|
| **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** | Freeze your screen, mark regions, get pixel-exact coordinates and crops | [site](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords) |
| **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** | Consume human-verified coordinates, perform the interaction, confirm it landed | [site](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions) |
| **[paths-le](https://github.com/nolindnaidoo/paths-le/tree/main/crate)** | Find every path in a codebase and report whether it still points at anything | [crates.io](https://crates.io/crates/paths-le) |
| **[secrets-le](https://github.com/nolindnaidoo/secrets-le/tree/main/crate)** | Find hardcoded credentials, and never print one | [crates.io](https://crates.io/crates/secrets-le) |
| **[urls-le](https://github.com/nolindnaidoo/urls-le/tree/main/crate)** | Extract every URL from a codebase, with its protocol and exact position | [crates.io](https://crates.io/crates/urls-le) |
| **[regex-le](https://github.com/nolindnaidoo/regex-le/tree/main/crate)** | Find every regex in a codebase and report which can be driven into catastrophic backtracking | [crates.io](https://crates.io/crates/regex-le) |
| **[string-le](https://github.com/nolindnaidoo/string-le/tree/main/crate)** | Get every string in a codebase out where a person can read them | [crates.io](https://crates.io/crates/string-le) |
| **[numbers-le](https://github.com/nolindnaidoo/numbers-le/tree/main/crate)** | Find every hardcoded number in a codebase so a person can check them | [crates.io](https://crates.io/crates/numbers-le) |
| **[envsync-le](https://github.com/nolindnaidoo/envsync-le/tree/main/crate)** | Compare the dotenv files in a tree and say which keys are missing from which | [crates.io](https://crates.io/crates/envsync-le) |
| **[scrape-le](https://github.com/nolindnaidoo/scrape-le/tree/main/crate)** | Check whether a page is scrapeable before the scraper is written | [crates.io](https://crates.io/crates/scrape-le) |

## Licence

MIT © [Nolin Naidoo](https://nolindnaidoo.com)
