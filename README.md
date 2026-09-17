# UltraMac MCP

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Test Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen.svg)]()
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/jxoesneon)

**UltraMac MCP is the enterprise-grade, secure macOS desktop-automation layer
for AI agents.** It gives model-context-protocol (MCP) clients — Claude Desktop,
Claude Code, Cursor, Windsurf, Gemini, and any MCP-enabled assistant — the ability
to see, click, type, and drive the whole Mac: mouse, keyboard, screenshots, OCR,
icon finding, window management, and UI-tree inspection.

Where other desktop-automation servers chase breadth, UltraMac leads with
**governance and trust**: audit logging, rate limiting, input sanitization, and
AES-256-GCM-encrypted action history — so organisations can let agents control a
Mac without giving up control themselves.

---

## 🚀 Features

- **🖱️ Precision Mouse Control** — click, double-click, drag, scroll, and smooth
  path movement with pixel-perfect accuracy.
- **⌨️ Advanced Keyboard Input** — type text, execute system shortcuts, and manage
  key states.
- **📸 Intelligent Vision** — high-performance screen capture, real-time OCR, and
  icon/text detection.
- **🪟 Window Management** — list, focus, move, resize, and minimize application
  windows.
- **🔍 UI Inspection** — analyze screen content, detect colors, and wait for visual
  elements to appear.
- **🛡️ Enterprise Security** — built-in input sanitization, rate limiting,
  API-key auth, AES-256-GCM-encrypted action history, and comprehensive audit
  logging. See [SECURITY.md](SECURITY.md).

---

## 🏗️ Architecture

UltraMac MCP is built on a modular, service-oriented architecture:

- **Core:** centralized error handling, security, logging, metrics.
- **Services:** OCR, Vision, UI, and System interop.
- **Tools:** decoupled, type-safe MCP tools (mouse, keyboard, screen, automation).
- **Server:** robust `FastMCP` wrapper with resilient connection handling.

The desktop-automation layer (mouse/keyboard/screen) is provided by the
[`@nut-tree-fork/nut-js`](https://www.npmjs.com/package/@nut-tree-fork/nut-js)
dependency (the maintained community fork of the subscription-gated official
nut.js) — installed as a pinned npm package and covered by the Bun lockfile and
CI dependency auditing.

**Token efficiency.** Tool definitions cost context window. UltraMac supports
`--category=` filtering so you expose only the tools you need:

```bash
# Serve only mouse + keyboard tools
bun run index.ts --stdio --category=mouse,keyboard
```

Categories: `mouse`, `keyboard`, `vision` (screen/OCR/UI), `admin` (system/
window), `automation` (misc, default).

---

## 📊 Why UltraMac MCP?

| Capability | **UltraMac MCP** | Peekaboo | ToolPiper | LMCP |
| --- | :---: | :---: | :---: | :---: |
| **macOS-native automation** (mouse/keyboard/apps) | ✅ | ✅ (screen/GUI) | ✅ | ✅ |
| **OCR + vision / icon finding** | ✅ | partial | ✅ | — |
| **Audit logging** | ✅ | — | — | — |
| **Rate limiting** | ✅ | — | — | — |
| **Input sanitization / path allowlist** | ✅ | — | — | — |
| **AES-256-GCM-encrypted action history** | ✅ | — | — | — |
| **API-key auth** | ✅ | — | — | — |
| **Docker / self-host** | ✅ | — | — | ✅ (native) |
| **On-device local model inference** | — | — | ✅ | — |
| **Open source (ISC)** | ✅ | ✅ (MIT) | ❌ (closed) | — |
| **Browser automation** | — | — | ✅ | — |

**The takeaway:** UltraMac MCP is the only one of these that is *macOS-native +
protected by an enterprise security surface*. Choose it when governance and
trust matter.

---

## 📦 Installation

### Option 1: Quick Start (with `furi`)

The easiest way to install and manage UltraMac MCP.

```bash
furi add jxoesneon/ultramac-mcp
furi start jxoesneon/ultramac-mcp
```

### Option 2: Manual Installation

**Prerequisites:**

- macOS (verified on macOS 14+)
- [Bun](https://bun.sh) runtime (`curl -fsSL https://bun.sh/install | bash`)

**Steps:**

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/jxoesneon/ultramac-mcp.git
    cd ultramac-mcp
    ```

2.  **Install dependencies:**

    ```bash
    bun install
    ```

3.  **Start the server:**

    ```bash
    # HTTP Transport (Recommended for web apps)
    bun run index.ts

    # Stdio Transport (For CLI integration)
    bun run index.ts --stdio

    # Filter to a subset of tool categories (reduce context overhead)
    bun run index.ts --stdio --category=mouse,keyboard
    ```

4.  **Run Tests:**

    ```bash
    bun run test          # Run all tests
    bun run test:coverage # Generate coverage report
    ```

---

## ⚙️ Configuration

UltraMac MCP works out of the box for local development. For production
environments, the following variables are supported:

| Variable | Purpose | Default | Required (Prod) |
| :--- | :--- | :--- | :--- |
| `ULTRAMAC_MCP_API_KEY` | API Key for client authentication. | _None_ | Yes |
| `ULTRAMAC_MCP_HISTORY_SECRET` | Secret key for encrypting action history logs. | `dev_secret...` | Yes |
| `ULTRAMAC_MCP_DISABLE_AUTH` | Disable authentication checks (Dev only). | `false` | No |
| `PORT` | Port for the HTTP server. | `3010` | No |
| `SENTRY_DSN` | DSN for Sentry error tracking. | _Disabled_ | No |
| `NODE_ENV` | Environment mode (`development`/`production`). | `development` | No |

---

## 🔒 Permissions & Security

On the first launch, macOS will request the following permissions. **These are
required for automation functionality:**

1.  **Accessibility** — for controlling the mouse and keyboard.
2.  **Screen Recording** — for capturing screenshots and analyzing screen content.

> **Security Note:** UltraMac MCP ships with built-in safeguards against
> injection attacks, strict input validation, rate limiting, API-key auth, and
> encrypted action history. Read the full [SECURITY.md](SECURITY.md) and the
> [threat model](SECURITY.md#threat-model).

---

## 🛠️ Tool Reference

### Automation

- `mouseClick`, `mouseDoubleClick`, `mouseDrag`, `mouseMove`, `mouseScroll`
- `type`, `keyControl`, `systemCommand`

### Vision & Inspection

- `screenshot`, `screenInfo`, `screenHighlight`
- `find_text_on_screen`, `find_icon`, `colorAt`

### Management

- `list_windows`, `recent_process_logs`
- `get_action_history`, `replay_action`, `clear_action_history`, `metrics` (Admin)

### Tool naming

Canonical tool names by purpose — prefer these when calling tools:

- Clicks: `mouseClick` (alias `click`), `click_element`, `click_in_window`
- Typing: `type`, `type_into_element`
- Discovery: `list_windows`, `get_ui_tree`, `find_element`, `find_text_on_screen`
- Verify: `element_contains_text`, `assert_element_exists`, `wait_for_ui_element`
- Logs: `recent_process_logs`

---

## 📈 Roadmap

See [ROADMAP.md](ROADMAP.md) for the living product plan and
[MARKET_ANALYSIS.md](docs/MARKET_ANALYSIS.md) for the competitive landscape.

---

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md)
for details on our code of conduct and the process for submitting pull requests.

## 💖 Support

If you find this project useful, you can support future development here:

<a href='https://ko-fi.com/jxoesneon' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---

<p align="center">
  <small>© 2025 UltraMac MCP Authors. Maintained by jxoesneon.</small>
</p>