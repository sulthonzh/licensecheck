# licensecheck

> Scan your npm dependencies for license compliance — catch GPL contamination, missing licenses, and policy violations before they bite you.

## Why?

You `npm install` a package. Cool. But what license is it? What about its dependencies? Is there a GPL hiding in your dependency tree that could force you to open-source your entire project?

This tool answers those questions. Fast, zero-config, works everywhere.

## Install

```bash
npm install -g licensecheck
```

## Usage

### Basic scan

```bash
cd your-project
licensecheck
```

Output:
```
Package         Version   License        Category
──────────────  ────────  ─────────────  ───────────────
express         4.18.2    MIT            permissive
lodash          4.17.21   MIT            permissive
some-gpl-thing  1.0.0     GPL-3.0        copyleft
mystery-pkg     0.1.0     NONE           unknown

Total: 142 packages | Licensed: 139 | Unlicensed: 3
  permissive: 128
  copyleft: 2
  unknown: 3
```

### Policy check

Create a policy file (`license-policy.json`):

```json
{
  "allow": ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "0BSD"],
  "deny": ["GPL-3.0", "AGPL-3.0", "SSPL-1.0"],
  "warn": ["LGPL", "MPL-2.0", "EPL"]
}
```

Then run:

```bash
licensecheck --policy license-policy.json --check
```

Exit code 1 if any violations found — perfect for CI:

```yaml
# GitHub Actions
- name: License check
  run: licensecheck --policy license-policy.json --check
```

### Output formats

```bash
licensecheck --json          # JSON output
licensecheck --markdown      # Markdown report
licensecheck --json --policy license-policy.json  # JSON with violations
```

## How it works

1. Runs `npm ls --json --all` to get your full dependency tree
2. Reads each package's `license` field from `package.json`
3. Falls back to detecting licenses from `LICENSE`/`LICENCE`/`COPYING` files
4. Classifies each license into categories: permissive, copyleft, weak copyleft, proprietary, public domain, unknown
5. If you provide a policy, checks every package against your allow/deny/warn lists

## License categories

| Category | Examples | Risk |
|----------|----------|------|
| **Permissive** | MIT, Apache-2.0, BSD-3-Clause, ISC | Low — use freely |
| **Copyleft** | GPL-3.0, AGPL-3.0, SSPL-1.0 | High — may require source disclosure |
| **Weak Copyleft** | LGPL-3.0, MPL-2.0, EPL-2.0 | Medium — depends on how you use it |
| **Proprietary** | BUSL-1.1, CC-BY-NC-4.0 | High — restrictions apply |
| **Public Domain** | Unlicense, CC0-1.0 | None — do whatever |
| **Unknown** | (no license found) | Unknown — treat as all rights reserved |

## Programmatic API

```typescript
import { scan, checkPolicy, formatJson } from "licensecheck";

const result = scan("/path/to/project");
console.log(`Found ${result.stats.total} packages`);

const violations = checkPolicy(result, {
  allow: ["MIT", "Apache-2.0"],
  deny: ["GPL-3.0"],
  warn: [],
});

console.log(formatJson(result, violations));
```

## Options

```
--json, -j          Output as JSON
--markdown, -m      Output as markdown
--policy, -p <file> Policy file (allow/deny/warn lists)
--check, -c         Only show violations (exit 1 on errors)
--help, -h          Show help
```

## License

MIT
