# Security & Trust

UltraMac MCP is designed with an **enterprise-grade security posture** for AI
agents that control a macOS desktop. This document covers both the security
**model** (controls, threat model) and the **vulnerability reporting policy**.

---

## Security model (defense in depth)

| Layer | Control | Where |
| --- | --- | --- |
| **Authentication** | HTTP server requires an API key (`umcp_*`) via auth middleware; can be disabled for local stdio/dev only. | `src/core/auth.ts` |
| **Rate limiting** | Token-bucket rate limiter (default 10 req/sec per client) to prevent abuse. | `src/core/security-utils.ts` |
| **Input sanitization** | Command whitelist (`screencapture`, `osascript`, `system_profiler`), shell-metacharacter stripping (`;&|`\`$(){}[]<>'"`), file-path validation/allowlisting, identifier length + charset checks. | `src/core/security-utils.ts` |
| **Audit logging** | Every tool invocation is logged (args, duration, success/failure) to a structured Winston logger. | `src/core/audit-logger.ts` |
| **Action history encryption** | Action-history records are encrypted with **AES-256-GCM** using a configured secret. | `src/core/security-utils.ts` |
| **Metrics / telemetry** | Prometheus metrics + optional Sentry error tracking (opt-in via `SENTRY_DSN`). | `src/core/metrics.ts` |
| **Error containment** | Errors sanitized before returning to the client (no stack/path leakage). | `src/core/errors.ts` |
| **Dependency integrity** | Dependencies pinned via the Bun lockfile; CI runs dependency review + `npm audit`. Vendored code eliminated (nut.js now a pinned npm dependency). | `bun.lock`, `.github/workflows/` |

---

## macOS permissions

Desktop automation requires explicit macOS grants. UltraMac MCP requests these
on first launch and degrades gracefully when they are absent:

1. **Accessibility** — for controlling the mouse and keyboard (nut.js).
2. **Screen Recording** — for capturing screenshots and analyzing the screen.

These are standard macOS privacy gates; the app never bypasses them.

---

## Threat model

UltraMac MCP is a **local** server intended to run on the user's own machine and
be consumed by trusted AI clients. Primary threat surfaces:

- **Prompt/command injection** — mitigated by the command whitelist + shell-metachar
  stripping + path allowlisting.
- **Unauthorized network access** — mitigated by API-key auth + rate limiting on
  HTTP; stdio transport requires no network.
- **Insecure storage of histories** — mitigated by AES-256-GCM encryption of
  action-history payloads with an operator-supplied key.
- **Supply-chain risk** — mitigated by lockfile pinning + CI dependency review.

**Recommended deployment:** run on the operator's machine, bind HTTP to
`127.0.0.1` or use stdio, and set `ULTRAMAC_MCP_API_KEY` +
`ULTRAMAC_MCP_HISTORY_SECRET` in production.

---

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅ |
| < 1.0   | ❌ |

---

## Reporting a vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them responsibly:

### Reporting process

1. **Email**: (To be configured — use GitHub Security Advisories for now)
2. **GitHub Security Advisories**: https://github.com/jxoesneon/ultramac-mcp/security/advisories/new
3. **Provide**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### What to expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Critical issues within 14 days, others within 30 days
- **Disclosure**: Coordinated disclosure after fix is released

### Rewards

Currently no bug bounty program, but:

- Public acknowledgment in CHANGELOG
- Listed in SECURITY.md contributors
- Our eternal gratitude 🙏

---

## Environment variables

| Variable | Purpose | Default | Production |
| --- | --- | --- | --- |
| `ULTRAMAC_MCP_API_KEY` | Client auth (`umcp_*`). | _None_ | **Required** |
| `ULTRAMAC_MCP_HISTORY_SECRET` | Encryption key for action history. | `dev_secret...` | **Required** |
| `ULTRAMAC_MCP_DISABLE_AUTH` | Disable auth (dev only). | `false` | No |
| `PORT` | HTTP port. | `3010` | No |
| `SENTRY_DSN` | Error telemetry. | Disabled | No |
| `NODE_ENV` | Runtime mode. | `development` | No |

---

© 2025 UltraMac MCP Authors.