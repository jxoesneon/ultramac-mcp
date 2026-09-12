# Registry Submission Packet

Ready-to-paste listings for the major MCP registries. Copy each section to the
corresponding registry's "Add server / Submit" form.

**Date:** 2026-09-12
**Maintainer:** jxoesneon (`https://github.com/jxoesneon`)
**Repo:** `https://github.com/jxoesneon/ultramac-mcp`

---

## Universal one-liner

```
UltraMac MCP — Enterprise-grade, secure macOS desktop automation for AI agents
(mouse, keyboard, screen/OCR/vision, window & UI control) via the Model Context
Protocol. Rust-light, Bun + TypeScript + FastMCP. SOC2-ready posture: audit
logging, rate limiting, input sanitization, AES-256-GCM-encrypted action history.
```

---

## 1. Official MCP Registry (`registry.modelcontextprotocol.io`)

- **Name:** `ultramac-mcp`
- **Description:** Enterprise-grade, secure macOS desktop automation for AI
  agents — mouse, keyboard, screen/OCR/vision, and window/UI control via MCP.
- **Telemetry URL:** _(omit)_
- **Package:** GitHub repo
- **Install command:** `git clone https://github.com/jxoesneon/ultramac-mcp && cd ultramac-mcp && bun install && bun run index.ts --stdio`
- **Homepage:** `https://github.com/jxoesneon/ultramac-mcp`
- **Keywords:** `mcp, macos, automation, accessibility, ocr, computer-use, agent`

---

## 2. PulseMCP

- **Name:** UltraMac MCP
- **Category:** Desktop Automation / macOS
- **URL:** `https://github.com/jxoesneon/ultramac-mcp`
- **Description:** Desktop automation + visual intelligence for macOS via MCP.
  Native mouse/keyboard/screen control, OCR, icon & text finding, window and UI
  tree access. Security-first: audit logging, rate limiting, input sanitization,
  AES-256-GCM-encrypted action history, API-key auth. Built on Bun + TypeScript
  + FastMCP + nut.js. stdio and HTTP transports, Docker image included.
- **Tags:** `macos`, `automation`, `ocr`, `vision`, `computer-use`

---

## 3. Glama.ai

- **Name:** ultramac-mcp
- **Description:** Enterprise-grade, secure macOS desktop automation for AI
  agents (mouse, keyboard, screen/OCR/vision, window & UI control).
- **GitHub:** `https://github.com/jxoesneon/ultramac-mcp`
- **Language:** TypeScript
- **Runtime:** Bun
- **Transports:** stdio, HTTP (streamable)
- **License:** ISC
- **Topics:** `mcp-server`, `macos`, `automation`, `accessibility`, `computer-use`

---

## 4. mcp.so

- **Name:** ultramac-mcp
- **Description:** Secure macOS desktop automation MCP server: mouse, keyboard,
  screen/OCR/vision, window & UI control. Enterprise controls (audit, rate-limit,
  sanitize, encrypted history) built in.
- **Repo:** `https://github.com/jxoesneon/ultramac-mcp`
- **Tags:** `macos`, `automation`, `vision`, `ocr`

---

## 5. Smithery.ai

- **Name:** UltraMac MCP
- **Category:** Desktop / OS Automation
- **Description:** Enterprise-grade macOS desktop automation for AI agents.
- **Install:** `bun run index.ts --stdio` (after `bun install`)
- **Env vars:** `ULTRAMAC_MCP_API_KEY`, `ULTRAMAC_MCP_HISTORY_SECRET`,
  `PORT` (default 3010).
- **Repo:** `https://github.com/jxoesneon/ultramac-mcp`

---

## Listing copy checklist

- [ ] README rewritten to lead with security + a comparison table (done this PR).
- [ ] `SECURITY.md` present (done this PR).
- [ ] A `LICENSE` (ISC) present (already in repo).
- [ ] Release tag + notes published (v1.0.0).
- [ ] Keywords/topics added to the GitHub repo (Settings → Topics: `mcp`,
  `macos`, `automation`, `ocr`, `computer-use`).