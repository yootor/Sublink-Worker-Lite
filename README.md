
  <h1><b>Sublink Worker Lite</b></h1>
  <h5><i>One Worker, All Subscriptions</i></h5>

Based on [sublink-Worker](https://github.com/sublink-network/sublink), this is a minimalist, high-performance subscription converter and node processing tool running on Cloudflare Workers. It strips away bulky web UIs and redundant components, focusing entirely on **"protocol parsing + remote template merging + intelligent node filtering"**, with full support for modern proxy protocols like anytls (including `sni` retention).

---

## 🚀 Usage Guide

Once deployed to your Cloudflare Worker, you can dynamically control the subscription conversion via URL parameters.

| Feature / Scenario | Parameter Description | Request URL Example |
| :--- | :--- | :--- |
| **Default Conversion** (Uses built-in `Adblock.yaml`) | Pass the subscription link via `sub` | `https://your-worker.workers.dev/?sub=<url-encoded-sub-link>` |
| **Switch to OpenWrt Template** | Use `config=openwrt` | `https://your-worker.workers.dev/?sub=<sub-link>&config=openwrt` |
| **Specify Adblock Template** | Explicitly load built-in `Adblock` template | `https://your-worker.workers.dev/?sub=<sub-link>&config=adblock` |
| **Fetch Remote GitHub Template** | Pass a complete remote YAML link | `https://your-worker.workers.dev/?sub=<sub-link>&config=https%3A%2F%2Fraw.githubusercontent.com%2F...` |
| **Dynamic Node Filtering** | Use `exclude` with regex (supports `\|`) | `https://your-worker.workers.dev/?sub=<sub-link>&exclude=multiplier%7Cgame%7CIPLC` |
| **Multi-Subscription Merge** | Use `\|` to combine multiple links | `https://your-worker.workers.dev/?sub=<sub1>%7C<sub2>&config=openwrt` |

> **⚠️ Notes**:
> 1. **URL Encoding**: Separators like `:`, `/`, `?`, `&`, `=`, and `|` in parameters must be URL-encoded (e.g., via `encodeURIComponent`), while non-reserved characters like `.` and `-` do not necessarily need encoding.
> 2. **Automatic Blacklist**: A built-in global blacklist automatically filters out invalid nodes containing keywords like "version", "remaining traffic", "expiration", "official website", or "announcements".

---

## 🛠️ Built-in Configuration Templates

The project comes with two ready-to-use Mihomo (Clash Meta) YAML templates located in the `src/config/` directory:

1. **`Adblock.yaml`** (Default):
   * Includes comprehensive ad-blocking rules, routing rule sets, and full regional auto-test proxy groups.
2. **`openwrt.yaml`**:
   * A streamlined template optimized for soft routers and specific routing requirements.

---

## 💻 Local Development & Debugging

1. Install dependencies:
   ```bash
   npm install

## 🚀 Quick Start

### Alternative Runtimes
- **Node.js**: `npm run build:node && node dist/node-server.cjs`

## ✨ Features

### Supported Protocols
ShadowSocks • VMess • VLESS • Hysteria2 • Trojan • TUIC

### Client Support
Sing-Box • Clash • Xray/V2Ray • Surge

### Input Support
- Base64 subscriptions
- HTTP/HTTPS subscriptions
- Full configs (Sing-Box JSON, Clash YAML, Surge INI)

### Core Capabilities
- Import subscriptions from multiple sources
- Generate fixed/random short links (KV-based)
- Light/Dark theme toggle
- Flexible API for script automation
- Multi-language support (Chinese, English, Persian, Russian)
- Web interface with predefined rule sets and customizable policy groups

## 🤝 Contributing

Issues and Pull Requests are welcome to improve this project.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project is for learning and exchange purposes only. Please do not use it for illegal purposes. All consequences resulting from the use of this project are solely the responsibility of the user and are not related to the developer.