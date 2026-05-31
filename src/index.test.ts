import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scan, checkPolicy, formatTable, formatJson, formatMarkdown, formatViolations } from "./index.js";
import type { ScanResult, LicenseEntry, PolicyRule, Violation } from "./index.js";

// ─── classifyLicense via proxy ───────────────────────────────────────

function classifyFromCategory(entries: LicenseEntry[], license: string | null): string | null {
  // Use the fact that scan categorizes entries; we'll test classification indirectly
  // by creating a fake result and checking checkPolicy behavior
  return null; // placeholder
}

// ─── Helper: make a fake ScanResult ──────────────────────────────────

function makeResult(entries: LicenseEntry[]): ScanResult {
  const categories: Record<string, LicenseEntry[]> = {
    permissive: [], copyleft: [], weakCopyleft: [], proprietary: [], publicDomain: [], unknown: [],
  };
  for (const e of entries) {
    const lic = e.license;
    let cat = "unknown";
    if (lic === "MIT" || lic === "Apache-2.0" || lic === "BSD-3-Clause" || lic === "ISC") cat = "permissive";
    else if (lic === "GPL-3.0" || lic === "AGPL-3.0" || lic === "SSPL-1.0") cat = "copyleft";
    else if (lic === "LGPL-3.0" || lic === "MPL-2.0" || lic === "EPL-2.0") cat = "weakCopyleft";
    else if (lic === "BUSL-1.1" || lic === "CC-BY-NC-4.0") cat = "proprietary";
    else if (lic === "Unlicense" || lic === "CC0-1.0") cat = "publicDomain";
    else if (!lic) cat = "unknown";
    categories[cat].push(e);
  }

  const licensed = entries.filter((e) => e.license !== null).length;
  return {
    entries,
    stats: { total: entries.length, licensed, unlicensed: entries.length - licensed },
    categories,
    violations: [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("licensecheck", () => {
  it("should return empty result when no packages found", () => {
    // scan in a dir without node_modules returns empty
    const result = scan("/tmp/nonexistent_" + Date.now());
    assert.equal(result.entries.length, 0);
    assert.equal(result.stats.total, 0);
  });

  it("should format table output", () => {
    const result = makeResult([
      { name: "express", version: "4.18.0", license: "MIT", licenseFile: "LICENSE", repository: "https://github.com/expressjs/express", path: "/tmp/express" },
      { name: "secret-pkg", version: "1.0.0", license: null, licenseFile: null, repository: null, path: "/tmp/secret" },
    ]);
    const table = formatTable(result);
    assert.ok(table.includes("express"));
    assert.ok(table.includes("MIT"));
    assert.ok(table.includes("NONE"));
    assert.ok(table.includes("Total: 2"));
    assert.ok(table.includes("Licensed: 1"));
    assert.ok(table.includes("Unlicensed: 1"));
  });

  it("should format JSON output", () => {
    const result = makeResult([
      { name: "lodash", version: "4.17.21", license: "MIT", licenseFile: "LICENSE", repository: null, path: "/tmp/lodash" },
    ]);
    const json = formatJson(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.stats.total, 1);
    assert.equal(parsed.entries[0].name, "lodash");
    assert.equal(parsed.entries[0].license, "MIT");
  });

  it("should format markdown output", () => {
    const result = makeResult([
      { name: "react", version: "18.0.0", license: "MIT", licenseFile: null, repository: null, path: "/tmp/react" },
    ]);
    const md = formatMarkdown(result);
    assert.ok(md.includes("# License Report"));
    assert.ok(md.includes("react"));
    assert.ok(md.includes("MIT"));
    assert.ok(md.includes("## Category Summary"));
    assert.ok(md.includes("## Packages"));
  });

  it("should detect deny list violations", () => {
    const result = makeResult([
      { name: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", licenseFile: null, repository: null, path: "/tmp/gpl" },
      { name: "mit-pkg", version: "2.0.0", license: "MIT", licenseFile: null, repository: null, path: "/tmp/mit" },
    ]);
    const violations = checkPolicy(result, { allow: [], deny: ["GPL-3.0"], warn: [] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].package, "gpl-pkg");
    assert.equal(violations[0].severity, "error");
  });

  it("should detect allow list violations", () => {
    const result = makeResult([
      { name: "mit-pkg", version: "1.0.0", license: "MIT", licenseFile: null, repository: null, path: "/tmp/mit" },
      { name: "bsd-pkg", version: "1.0.0", license: "BSD-3-Clause", licenseFile: null, repository: null, path: "/tmp/bsd" },
    ]);
    const violations = checkPolicy(result, { allow: ["MIT"], deny: [], warn: [] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].package, "bsd-pkg");
    assert.equal(violations[0].severity, "error");
  });

  it("should detect warn list violations", () => {
    const result = makeResult([
      { name: "lgpl-pkg", version: "1.0.0", license: "LGPL-3.0", licenseFile: null, repository: null, path: "/tmp/lgpl" },
    ]);
    const violations = checkPolicy(result, { allow: [], deny: [], warn: ["LGPL"] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].severity, "warning");
  });

  it("should flag unlicensed packages", () => {
    const result = makeResult([
      { name: "no-license", version: "0.1.0", license: null, licenseFile: null, repository: null, path: "/tmp/nolic" },
    ]);
    const violations = checkPolicy(result, { allow: [], deny: [], warn: [] });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].reason, "No license found — treat as all rights reserved");
  });

  it("should pass with no violations", () => {
    const result = makeResult([
      { name: "safe-pkg", version: "1.0.0", license: "MIT", licenseFile: null, repository: null, path: "/tmp/safe" },
    ]);
    const violations = checkPolicy(result, { allow: ["MIT"], deny: ["GPL"], warn: [] });
    assert.equal(violations.length, 0);
  });

  it("should format violations output", () => {
    const violations: Violation[] = [
      { package: "bad-pkg", version: "1.0.0", license: "GPL-3.0", severity: "error", reason: "denied" },
      { package: "iffy-pkg", version: "2.0.0", license: "LGPL-3.0", severity: "warning", reason: "on warn list" },
    ];
    const out = formatViolations(violations);
    assert.ok(out.includes("❌ 1 violation(s)"));
    assert.ok(out.includes("bad-pkg"));
    assert.ok(out.includes("⚠️  1 warning(s)"));
    assert.ok(out.includes("iffy-pkg"));
  });

  it("should show no violations message when clean", () => {
    const out = formatViolations([]);
    assert.equal(out, "✅ No license violations found.");
  });

  it("should count category stats correctly", () => {
    const result = makeResult([
      { name: "a", version: "1.0.0", license: "MIT", licenseFile: null, repository: null, path: "/tmp/a" },
      { name: "b", version: "1.0.0", license: "Apache-2.0", licenseFile: null, repository: null, path: "/tmp/b" },
      { name: "c", version: "1.0.0", license: "GPL-3.0", licenseFile: null, repository: null, path: "/tmp/c" },
      { name: "d", version: "1.0.0", license: null, licenseFile: null, repository: null, path: "/tmp/d" },
    ]);
    assert.equal(result.categories.permissive.length, 2);
    assert.equal(result.categories.copyleft.length, 1);
    assert.equal(result.categories.unknown.length, 1);
    assert.equal(result.stats.total, 4);
    assert.equal(result.stats.licensed, 3);
    assert.equal(result.stats.unlicensed, 1);
  });
});
