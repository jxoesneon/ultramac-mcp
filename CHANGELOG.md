# Changelog

All notable changes to ultramac-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-17

### ✨ Features

- **Added** `click_element` — semantic find-and-click in one call (name/label/role)
- **Added** `type_into_element` — resolve element, focus, and type in one call
- **Added** `click_in_window` — window-relative pixel clicks with bounds validation
- **Added** `list_windows` — discover window targets (id, title, owner, pid, bundleId, bounds)
- **Added** `element_contains_text` — parent-scoped subtree text assertion
- **Added** `assert_element_exists` — structured pass/fail existence checks
- **Added** `recent_process_logs` — macOS `log show` retrieval for in-MCP verification
- **Added** `click` alias for `mouseClick` plus canonical tool names in server instructions
- **Added** process/window targeting (`process`, `pid`, `window`) to `find_element`,
  `get_ui_tree`, `wait_for_ui_element`, and all new element tools — background apps
  are no longer limited to the frontmost window
- **Added** `description` and `value` fields to `findElement` results

### 📝 Changed

- **Improved** window matching: case-insensitive across title, owner name, and bundleId
- **Improved** `findElement`/`getUITree` JXA: resolves pid → process name/bundleId →
  frontmost fallback, then window index → title substring → first window
- **Improved** `wait_for_ui_element` to fail fast on unrecoverable errors
- **Updated** tool categorization to cover all 34 registered tool names

### 🔒 Security

- **Fixed** JXA injection via `appName` in `scanAppMenus`/`triggerMenuCommand`
- **Hardened** all JXA input embedding through `JSON.stringify` encoding
- **Hardened** `runJXA` to pass scripts via `execFileSync` stdin instead of a
  heredoc, removing the EOF-breakout vector
- **Fixed** window-scoped element searches leaking results from other windows

### ✅ Testing

- **Added** 219 tests (309 total, up from 90)
- **Achieved** 100% line coverage across all modules (99.89% statements,
  99.44% functions, 93.19% branches)
- **Added** coverage `include` so unloaded files count toward the report

## [1.0.0] - 2025-12-22

### 🎉 Initial Stable Release

First production-ready release with comprehensive enterprise features.

### 🔒 Security

- **Added** API key authentication with rate limiting (10 req/sec per client)
- **Added** Input sanitization for all shell commands
- **Added** Command whitelist (screencapture, osascript, system_profiler)
- **Added** Path validation (whitelist: /tmp, user home, /var/tmp)
- **Added** Winston audit logging with JSON formatting and 30-day rotation
- **Added** Automated dependency scanning via Dependabot
- **Added** GitHub Actions security workflows
- **Fixed** 4 npm audit vulnerabilities (2 HIGH, 1 MODERATE, 1 LOW)

### ✨ Features

- **Added** 30+ desktop automation tools across 7 categories:
  - Mouse control (click, move, drag, scroll, doubleClick)
  - Keyboard input (type, keyPress, systemCommand)
  - Window management (getWindows, windowControl, focus)
  - Screenshots (full/region/window modes)
  - UI tree access (get_ui_tree, find_element, click_element)
  - OCR text recognition (find_text_on_screen, Tesseract.js)
  - AI visual search (find_icon via Transformers.js)
- **Added** Action history with replay capability
- **Added** OCR caching (10-second TTL)
- **Added** Focus Guard for safe automation
- **Added** Confidence scores for text matching

### 📊 Monitoring & Observability

- **Added** Prometheus metrics endpoint with 8 custom metrics
- **Added** Health check endpoints (liveness, readiness, full health)
- **Added** Graceful shutdown handlers (SIGTERM, SIGINT)
- **Added** Uncaught exception/rejection logging
- **Added** Winston audit logger with daily rotation

### 🐳 DevOps

- **Added** Multi-stage Dockerfile with Alpine base
- **Added** docker-compose.yml for local development
- **Added** GitHub Actions CI/CD pipeline (test/lint/build/deploy)
- **Added** Automated Docker image publishing to GHCR
- **Added** Security options (non-root user, read-only filesystem)

### 📚 Documentation

- **Added** API Key Management guide
- **Added** Architecture documentation with diagrams
- **Added** API Versioning strategy
- **Added** Contributing guidelines
- **Added** Security badge in README

### ✅ Testing

- **Added** Vitest testing framework
- **Added** 74 comprehensive unit tests
- **Achieved** 97.61% code coverage
- **Added** Coverage reporting in CI

### 🏗️ Infrastructure

- **Added** TypeScript type safety throughout
- **Added** Modular architecture (security-utils, audit-logger, auth, health, metrics)
- **Added** FastMCP integration for MCP protocol
- **Added** HTTP Stream and STDIO transport support

### 📝 Changed

- **Refactored** ActionLogger into separate module
- **Refactored** OCRCache into separate module
- **Refactored** withLogging helper into module
- **Updated** README with security status section

### 🐛 Fixed

- All TypeScript compilation errors
- npm audit vulnerabilities
- OCR parsing edge cases
- Test coverage gaps

---

## [Unreleased]

### Planned

- E2E test suite
- GDPR compliance documentation
- Additional code quality improvements
- Performance optimizations

---

## Version History

- **1.0.0** (2025-12-22): Initial stable release
- **0.x**: Development versions (unsupported)

---

## Upgrade Guide

### From Development (0.x) to 1.0.0

**New Requirements:**

1. Set `ULTRAMAC_MCP_API_KEY` environment variable
2. Update to Bun 1.3+ if using older version
3. Review security settings in docker-compose.yml

**Breaking Changes:**

- None (first stable release)

**New Features:**

- API authentication now required (set API key)
- Health checks available at /health, /liveness, /readiness
- Metrics available at /metrics for Prometheus

**Migration Steps:**

```bash
# 1. Generate API key
export ULTRAMAC_MCP_API_KEY=$(openssl rand -hex 32 | awk '{print "umcp_"$1}')

# 2. Update dependencies
bun install

# 3. Run tests
bun test

# 4. Start server
bun run index.ts
```

---

## Support

- **Issues**: [GitHub Issues](https://github.com/jxoesneon/ultramac-mcp/issues)
- **Security**: See [SECURITY.md](SECURITY.md)
- **Documentation**: [docs/](./ docs/)

---

[1.0.0]: https://github.com/jxoesneon/ultramac-mcp/releases/tag/v1.0.0
