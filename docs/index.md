---
layout: default
title: Home
nav_order: 1
description: "UltraMac MCP: The premier Model Context Protocol server for macOS desktop automation."
---

# UltraMac MCP

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Test Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen.svg)]()
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=flat&logo=ko-fi&logoColor=white)](https://ko-fi.com/jxoesneon)

**UltraMac MCP** is the premier Model Context Protocol (MCP) server for macOS desktop automation. Engineered for enterprise-grade reliability and security, it empowers AI assistants to interact with the desktop environment with human-like precision and control.

---

## 🚀 Features

- **🖱️ Precision Mouse Control**: Click, double-click, drag, scroll, and smooth path movement with pixel-perfect accuracy.
- **⌨️ Advanced Keyboard Input**: Type text, execute system shortcuts, and manage key states.
- **📸 Intelligent Vision**: High-performance screen capture, real-time OCR (Optical Character Recognition), and icon detection.
- **🪟 Window Management**: List, focus, move, resize, and minimize application windows.
- **🔍 UI Inspection**: Analyze screen content, detect colors, and wait for visual elements to appear.
- **🛡️ Enterprise Security**: Built-in input sanitization, rate limiting, and comprehensive audit logging.

## 🏗️ Architecture

UltraMac MCP is built on a modular, service-oriented architecture designed for scalability and maintainability:

- **Core**: Centralized error handling, security, logging, and metrics.
- **Services**: Specialized domains for OCR, Vision, UI, and System interop.
- **Tools**: Decoupled, type-safe implementations of MCP tools.
- **Server**: Robust `FastMCP` wrapper with resilient connection handling.

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
    ```

4.  **Run Tests:**

    ```bash
    bun run test          # Run all tests
    bun run test:coverage # Generate coverage report
    ```

## ⚙️ Configuration

UltraMac MCP works out of the box for local development. For production environments, the following variables are supported:

| Variable                      | Description                                    | Default         | Required (Prod) |
| :---------------------------- | :--------------------------------------------- | :-------------- | :-------------- |
| `ULTRAMAC_MCP_API_KEY`        | API Key for client authentication.             | _None_          | Yes             |
| `ULTRAMAC_MCP_HISTORY_SECRET` | Secret key for encrypting action history logs. | `dev_secret...` | Yes             |
| `ULTRAMAC_MCP_DISABLE_AUTH`   | Disable authentication checks (Dev only).      | `false`         | No              |
| `PORT`                        | Port for the HTTP server.                      | `3000`          | No              |
| `SENTRY_DSN`                  | DSN for Sentry error tracking.                 | _Disabled_      | No              |
| `NODE_ENV`                    | Environment mode (`development`/`production`). | `development`   | No              |

## 🔒 Permissions & Security

On the first launch, macOS will request the following permissions. **These are required for automation functionality:**

1.  **Accessibility**: For controlling the mouse and keyboard.
2.  **Screen Recording**: For capturing screenshots and analyzing screen content.

> **Security Note**: This project undergoes regular internal security audits. It includes built-in safeguards against injection attacks and enforces strict input validation.

## 🛠️ Tool Reference

### Automation

- `mouseClick`, `mouseDoubleClick`, `mouseDrag`, `mouseMove`, `mouseScroll`
- `type`, `keyControl`, `systemCommand`

### Vision & Inspection

- `screenshot`, `screenInfo`, `screenHighlight`
- `find_text_on_screen`, `find_icon`, `colorAt`

### Management

- `getWindows`, `windowControl`
- `get_action_history` (Admin)

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 💖 Support

If you find this project useful, you can support future development here:

<a href='https://ko-fi.com/jxoesneon' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---

<p align="center">
  <small>© 2025 UltraMac MCP Authors. Maintained by jxoesneon.</small>
</p>
