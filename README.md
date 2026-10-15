<div align="center">
  <h1><b>Sublink Worker Lite</b></h1>
  <h5><i>One Worker, All Subscriptions</i></h5>
</div>

Based on the [sublink-worker](https://github.com/sublink-network/sublink) project and refactored with the assistance of **Gemini**, this is a minimalist, high-performance subscription converter and node processing tool supporting both **Cloudflare Workers** and **VPS (Node.js)** deployments. It strips away bulky web UIs and redundant components, focusing entirely on **"protocol parsing + remote template merging + intelligent node filtering"**, with full support for modern proxy protocols like AnyTLS (including `sni` retention).

---

## 🚀 Usage Guide

Once deployed to your Cloudflare Worker or VPS, you can dynamically control the subscription conversion via URL parameters.

| Feature / Scenario | Parameter Description | Request URL Example |
| :--- | :--- | :--- |
| **Default Conversion** (Uses built-in `Adblock.yaml`) | Pass the subscription link via `sub` | `https://your-domain.com/?sub=<url-encoded-sub-link>` |
| **Switch to OpenWrt Template** | Use `config=openwrt` | `https://your-domain.com/?sub=<sub-link>&config=openwrt` |
| **Specify Adblock Template** | Explicitly load built-in `Adblock` template | `https://your-domain.com/?sub=<sub-link>&config=adblock` |
| **Fetch Remote GitHub Template** | Pass a complete remote YAML link | `https://your-domain.com/?sub=<sub-link>&config=https%3A%2F%2Fraw.githubusercontent.com%2F...` |
| **Dynamic Node Filtering** | Use `exclude` with regex (supports `\|`) | `https://your-domain.com/?sub=<sub-link>&exclude=multiplier%7Cgame%7CIPLC` |
| **Custom Config Filename** | Use `filename` to set profile/download name | `https://your-domain.com/?sub=<sub-link>&filename=Nikki_Home` |
| **Multi-Subscription Merge** | Use `\|` to combine multiple links | `https://your-domain.com/?sub=<sub1>%7C<sub2>&config=openwrt` |

> **⚠️ Notes**:
> 1. **URL Encoding**: Separators like `:`, `/`, `?`, `&`, `=`, and `|` in parameters must be URL-encoded (e.g., via `encodeURIComponent`), while non-reserved characters like `.` and `-` do not need encoding.
> 2. **Automatic Blacklist & Country Flags**: A built-in global blacklist automatically removes invalid info nodes (e.g., version, traffic, expiration, announcements) and automatically prepends country flag emojis to valid nodes.

---

## 🛠️ Built-in Configuration Templates

The project comes with two ready-to-use Mihomo (Clash Meta) YAML templates located in the `src/config/` directory:

1. **`Adblock.yaml`** (Default):
   * Includes comprehensive ad-blocking rules, routing rule sets, and full regional auto-test proxy groups.
2. **`OpenWrt.yaml`**:
   * A streamlined template optimized for soft routers and specific routing requirements.

---

## ☁️ Option 1: Cloudflare Workers Deployment

You can easily deploy this project using Cloudflare's native Git integration:

1. Authorize GitHub in your Cloudflare dashboard and select your forked `sublink-worker` repository.
2. In **Build settings**:
   * **Framework preset**: `None`
   * **Build command**: `npm run deploy`
   * **Build output directory**: Keep default
3. Bind a custom domain (optional) to avoid `*.workers.dev` accessibility issues in certain regions.

> **💡 Tip**: Make sure the `name` field in `wrangler.toml` matches the Worker name created in your Cloudflare dashboard.

---

## 🖥️ Option 2: VPS (Node.js + Nginx) Deployment

If certain upstream providers block Cloudflare Worker IPs, you can deploy the exact same codebase directly on a Linux VPS using `server.js`.

### 1. Install Node.js (v22+) & PM2
```bash
sudo apt update && sudo apt install -y curl git nginx
curl -fsSL [https://deb.nodesource.com/setup_current.x](https://deb.nodesource.com/setup_current.x) | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Clone Repository & Start Service
```bash
cd /opt
sudo git clone https://github.com/yootor/Sublink-Worker-Lite
# 2. Enter the project directory and install dependencies
cd /opt/sublink-worker-Lite
sudo npm install --omit=dev

# Generate a random secret key for GitHub Webhook auto-updates
openssl rand -hex 16

# Start the server with PM2 (default port: 8787)
PORT=25500 WEBHOOK_SECRET="your_generated_secret_key" pm2 start server.js --name "sublink" --update-env
pm2 save && pm2 startup
```

### 3. Enable Automatic GitHub Updates (Optional)
Go to your GitHub repository Settings -> Webhooks -> Add webhook.

Payload URL: https://your-domain.com/webhook

Content type: application/json

Secret: Enter the WEBHOOK_SECRET set in Step 2.

Select Just the push event and save. Every git push will now automatically verify the HMAC-SHA256 signature, pull the latest changes, and reload the service.

## 💻 Local Development & Debugging
### 1. Install dependencies:

```Bash
npm install
Run locally in Node.js mode (server.js):
```
### 2. Run locally in Node.js mode
```Bash
npm start
```
### 3. Run locally in Cloudflare Worker mode
```bash
npm run dev
```

✨ Features
Supported Protocols: ShadowSocks • VMess • VLESS • Hysteria2 • Trojan • TUIC • AnyTLS

Client Support: Clash / Mihomo (Clash.Meta)

Input Formats:

Base64 encoded subscriptions

Standalone proxy share links (vless://, anytls://, hy2://, etc.)

Full configuration files (Sing-Box JSON, Clash YAML)

Core Capabilities:

Multi-subscription merging and automatic node deduplication

Built-in & remote YAML template injection

Regex-based node filtering and automatic country flag emoji generation

🙏 Acknowledgments & Credits
This lightweight project is derived from sublink-worker and customized with Gemini. Huge thanks to the original authors and contributors for their outstanding protocol parsing modules and community contributions!

🤝 Contributing
Issues and Pull Requests are welcome to improve this project.

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

⚠️ Disclaimer
This project is for learning and exchange purposes only. Please do not use it for illegal purposes. All consequences resulting from the use of this project are solely the responsibility of the user and are not related to the developer.