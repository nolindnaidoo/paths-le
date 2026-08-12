# Paths in prose

`markdown` is advertised in the tool schema, so both frontends have to
read it the same way — by the generic scan, which is what this pins.

A link like [the architecture](./docs/architecture.md) is an undelimited
run carrying a separator, and so is a bare mention of docs/scan.md.
A backticked name such as `README.md` is a delimited token and counts;
the same name written plainly is not claimed.

Absolute references work too: see /var/log/service and C:\Temp\out for
the two shapes, and https://example.com/spec.html for the third.

- ./scripts/setup.sh runs first.
- A version like 1.8.1 and an address like 192.168.1.1 are not paths.
- A glob such as src/**/*.md is rejected whole, not split into pieces.
