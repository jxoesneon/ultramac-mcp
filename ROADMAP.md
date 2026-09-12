# Roadmap

UltraMac MCP's forward plan. Items are grouped by theme and roughly ordered
by priority. This is a living document — update it as direction shifts.

Legend: `[x]` done, `[ ]` planned.

---

## ✅ Recently Completed

- [x] **Public-ready cleanup** — remove stray build artifacts (`:memory:`,
      `coverage_report.txt`, empty OCR partial) and ignore the
      `.fastembed_cache/` runtime cache.
- [x] **Replace vendored nut.js with a managed dependency** — the 446-file
      hand-copied `nutjs/` tree (committed `node_modules`, `dist`, and prebuilt
      native binaries) was replaced with the pinned npm package
      `@nut-tree-fork/nut-js@^4.2.6`. This restores content-addressable
      integrity, brings the library under the Bun lockfile + CI dependency
      auditing, and removes ~85% of the tracked repo surface.

---

## 🧹 Hygiene & Correctness

- [x] **Update ARCHITECTURE.md** to point the automation layer at the
      `@nut-tree-fork/nut-js` dependency (tech-stack table + README). The
      Mermaid diagram's generic "nut.js" node remains accurate.
- [ ] **Document migration notes** in `docs/` (why the fork, how to upgrade,
      how the native bindings load) for future maintainers.
- [ ] **Add a reproducibility check** for the security test suite so the
      `security-utils.test.ts` path-sanitization assertion no longer depends
      on the repo's location relative to `os.homedir()`.

---

## 🔐 Security Hardening

- [ ] **Wire `depfu`/Dependabot into `bun.lock`** — the current dependency
      review scans the npm lockfile; ensure the Bun lockfile (which now
      includes nut.js) is also covered for automated upgrade PRs.
- [ ] **Fail CI on `npm audit`** — today security-scan runs `npm audit` with
      `continue-on-error: true`. Tighten to fail on high/critical once the
      dev-toolchain transitive vulnerabilities (vite/undici) are cleared or
      scoped.
- [ ] **Add a SBOM export** (e.g. `bun bun`/`cyclonedx`) for reproducible
      supply-chain attestation.
- [ ] **Timestamp/audit-log retention** — define retention policy for the
      action-history and audit-log databases.

---

## 🚀 Features

- [ ] **Cross-platform support** (Windows/Linux) for the mouse/keyboard/screen
      tools now that nut.js providers are standard npm deps.
- [ ] **Streaming screenshots / region capture** — add configurable framerate
      capture for smoother remote-control UX.
- [ ] **Plugin system** — allow third-party tools to register via the same
      typed `addTool` contract.
- [ ] **CLI polish** — a documented `systemCommand` allow-list UX and an
      explicit `--stdio`/`--http` flag surface.

---

## ✅ Definition of Done for New Work

- [ ] Fixes applied (not just findings), with a markdown report under `docs/`
      when an audit is involved.
- [ ] Headless test verification for any Godot/SceneTree changes; standard
      `bun run test` for this repo.
- [ ] All tests green before merge.