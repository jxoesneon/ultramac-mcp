# UltraMac MCP — Enterprise & Monetization Plan (Draft)

Strategic framing to position UltraMac MCP in the enterprise/security lane and
define a sustainable business model. **Draft for discussion — not a commitment.**

---

## 1. Positioning statement

> **UltraMac MCP is the enterprise-grade, secure macOS desktop-automation layer
> for AI agents.** Where most MCP desktop tools optimize for breadth or reach,
> UltraMac optimizes for **governance, reliability, and trust** — so
> organisations can let agents drive a Mac without giving up auditability.

Target buyer: **platform/infrastructure teams** and **AI-powered automation
leads** who want SOC2-adjacent controls over agent desktop access, plus
**power users** who value security and deterministic behavior.

---

## 2. Competitive wedge (why someone switches to UltraMac)

| Competitor | Strength | UltraMac's counter-position |
| --- | --- | --- |
| ToolPiper (300+ tools, local AI) | Breadth + on-device inference | Leaner but **security-first**: audit log, rate limit, sanitize, encrypted history, self-host/Docker |
| Peekaboo (screen + GUI) | Fast, focused, 4.7k⭐ | Same category, **adds governance + visual intelligence (OCR/icon find) + API keys** |
| LMCP (269 tools, work apps) | Work-stack integrations | macOS-native automation + enterprise trust surface |
| Apple `xcrun mcpbridge` | OS-level, free | Cross-AI-client, portable, vendor-neutral; not Apple-locked |

---

## 3. Monetization model (recommended)

**Free OSS core + paid "Enterprise" tier.** Pay-per-call (x402) is a poor fit for
an on-device local automation server (agents call tools locally; per-call billing
is awkward). A subscription aligns with the security/productivity-value story.

**Pricing bands** (aligned with MCP market willingness-to-pay):

| Tier | Price | Scope |
| --- | --- | --- |
| **Core** (OSS) | Free (ISC) | All 22+ tools, stdio + HTTP, Docker, security controls. |
| **Enterprise** | **$19–49/mo** | Priority support, SSO/team key management, policy/permission profiles, audit-log export (JSON/SIEM), on-prem advisory, guaranteed SLA on macOS update support. |
| **Site / OEM** | Custom | Embed as a managed service for orgs deploying many Macs. |

- **Dev-tool category range:** $9–29/mo (Pro) → $99–199/mo (Enterprise) per MCPize.
- **Willingness-to-pay concentration:** $9–29/mo is the proven band; >$49 needs
  enterprise features + support — hence the $19–49/mo Enterprise set.
- **Distribution**: open marketplace? Not required. Listing on registries +
  strong README + release tags is the primary channel.

---

## 4. Roadmap to enterprise readiness (0–6 months)

1. **Security as documented product** — ship `SECURITY.md` + threat model
   (done). Add "SOC2-ready" posture note (audit trail, access control, data
   encryption, no data egress).
2. **Registry distribution sprint** — submit to PulseMCP/Glama/Smithery/mcp.so/
   Official Registry (see `docs/REGISTRY_SUBMISSION.md`).
3. **Token efficiency** — tool-category filtering (`--category=mouse,vison,...`)
   shipped (this PR).
4. **Hardening follow-ups** (from ROADMAP.md): fail CI on high audit, wire
   bun.lock into dependency review, add SBOM export.
5. **Team/enterprise features** — key rotation, audit-log export, permission
   profiles (track as separate milestones).

---

## 5. Metrics to track adoption (North Star)

- **Distribution funnel:** # of registry listings → installs → weekly active
  servers.
- **Quality signals:** stars, forks, GitHub sponsored-tier signups, dependency
  download counts.
- **Security credibility:** advisories handled, documented audit trail adoption,
  enterprise trial → conversion.

---

## 6. Open questions / decisions

- [ ] **OSS license:** keep ISC (permissive) or move core to Apache-2.0/BSL for
      enterprise-sell-through? (ISC is fine for now; revisit if pro features added.)
- [ ] **Enterprise feature scope** — which felt features ship first: SSO/team keys
      or audit-log export?
- [ ] **Pricing validation** — validate $19–49/mo with 3–5 target buyers before
      committing.
- [ ] **Apple WWDC 2026** — decide build-on-App-Intents vs differentiate once
      native MCP support lands.

---

*Draft · 2026-09-12 · companion to `docs/MARKET_ANALYSIS.md`*