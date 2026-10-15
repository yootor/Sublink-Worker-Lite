import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { registerHooks } from 'node:module';

// 1. 让原生 Node.js 支持直接 import '.yaml' 文件（与 Cloudflare Worker 100% 兼容）
registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('.yaml') || url.endsWith('.yml')) {
            const content = fs.readFileSync(new URL(url), 'utf8');
            return {
                format: 'module',
                shortCircuit: true,
                source: `export default ${JSON.stringify(content)};`
            };
        }
        return nextLoad(url, context);
    }
});

// 2. 加载你的 worker.js 核心逻辑
const { default: worker } = await import('./src/worker.js');

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
// 从服务器本地环境变量读取密钥，源码中绝不硬编码任何密码！
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * 校验 GitHub Webhook 的 HMAC-SHA256 加密签名（防篡改、防伪造、防时序攻击）
 */
function verifyGitHubSignature(payloadText, signatureHeader, secret) {
    if (!secret || !signatureHeader) return false;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payloadText).digest('hex');
    if (signatureHeader.length !== digest.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(digest));
}

const server = http.createServer(async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host || `${HOST}:${PORT}`;
        const fullUrl = new URL(req.url, `${protocol}://${host}`);

        // 3. 处理 GitHub Webhook 自动更新请求 (仅接受加密签名的 POST 请求)
        if (fullUrl.pathname === '/webhook' && req.method === 'POST') {
            // 如果服务器没有配置 WEBHOOK_SECRET 环境变量，直接拒绝服务
            if (!WEBHOOK_SECRET) {
                res.statusCode = 403;
                return res.end('Webhook is disabled');
            }

            // 读取请求体并验证 GitHub 加密签名
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString('utf8');
            const signature = req.headers['x-hub-signature-256'];

            if (!verifyGitHubSignature(rawBody, signature, WEBHOOK_SECRET)) {
                res.statusCode = 401;
                return res.end('Unauthorized: Invalid HMAC signature');
            }

            // 签名验证通过，拉取最新代码并触发 PM2 重启
            exec('git fetch --all && git reset --hard origin/main && npm install --omit=dev', (err, stdout, stderr) => {
                if (err) {
                    res.statusCode = 500;
                    return res.end(`Update failed:\n${stderr || err.message}`);
                }
                res.statusCode = 200;
                res.end(`Update successful:\n${stdout}`);
                setTimeout(() => process.exit(0), 500);
            });
            return;
        }

        // 4. 正常订阅转换请求桥接 (GET)
        const webReq = new Request(fullUrl.toString(), {
            method: req.method,
            headers: req.headers
        });

        const webRes = await worker.fetch(webReq, process.env);

        res.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
        });

        const bodyText = await webRes.text();
        res.end(bodyText);
    } catch (err) {
        console.error('Server Internal Error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`服务器内部错误: ${err.message}`);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Sublink Server listening on http://${HOST}:${PORT}`);
});