import { ClashConfigBuilder } from './builders/ClashConfigBuilder.js';

// 仅允许接收这五个查询参数
const ALLOWED_PARAMS = new Set(['sub', 'url', 'config', 'exclude', 'filename']);

/**
 * 从原始查询字符串中提取未经解码的参数值
 */
function getRawQueryParam(search, key) {
    const query = search.startsWith('?') ? search.slice(1) : search;
    if (!query) return null;
    for (const part of query.split('&')) {
        const eqIdx = part.indexOf('=');
        const k = eqIdx === -1 ? part : part.slice(0, eqIdx);
        if (decodeURIComponent(k) === key) {
            return eqIdx === -1 ? '' : part.slice(eqIdx + 1);
        }
    }
    return null;
}

/**
 * 校验参数是否符合标准 URL Encode 规范（禁止出现未编码的保留分隔符 : / ? & = |）
 */
function isStrictUrlEncoded(rawValue) {
    if (!rawValue) return false;
    return !/[:/?&=|]/.test(rawValue);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. 拦截未知参数
        for (const key of url.searchParams.keys()) {
            if (!ALLOWED_PARAMS.has(key)) {
                return new Response(
                    `错误: 不支持的参数 "${key}"。仅支持 sub (或 url)、config、exclude、filename。`,
                    { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
                );
            }
        }

        // 2. 获取原始未解码的参数并校验 URL Encode
        const subKey = getRawQueryParam(url.search, 'sub') !== null ? 'sub' : 'url';
        const rawSub = getRawQueryParam(url.search, subKey);
        const rawConfig = getRawQueryParam(url.search, 'config');
        const rawExclude = getRawQueryParam(url.search, 'exclude');
        const rawFilename = getRawQueryParam(url.search, 'filename');

        if (!rawSub) {
            return new Response(
                '用法: /?sub=<URL编码后的订阅链接>&config=<可选:模板名或远程链接>&exclude=<可选:排除正则>&filename=<可选:自定义文件名>',
                { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        if (!isStrictUrlEncoded(rawSub)) {
            return new Response(
                `错误: 参数 "${subKey}" 未进行 URL Encode 编码！\n请先将订阅链接编码（例如 https:// 应为 https%3A%2F%2F）后再调用。`,
                { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        if (rawConfig !== null && !isStrictUrlEncoded(rawConfig)) {
            return new Response(
                '错误: 参数 "config" 包含未编码的特殊字符！\n如果传入的是远程模板链接，请先进行 URL Encode 编码。',
                { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        if (rawExclude !== null && !isStrictUrlEncoded(rawExclude)) {
            return new Response(
                '错误: 参数 "exclude" 包含未编码的特殊字符（如 |）！\n请先使用 encodeURIComponent 编码后再调用。',
                { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        if (rawFilename !== null && !isStrictUrlEncoded(rawFilename)) {
            return new Response(
                '错误: 参数 "filename" 包含未编码的特殊字符！',
                { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
            );
        }

        // 3. 校验通过后，读取解码后的参数值执行转换
        const subParam = url.searchParams.get(subKey);
        const configParam = url.searchParams.get('config');
        const excludeParam = url.searchParams.get('exclude');
        const filenameParam = url.searchParams.get('filename');

        try {
            const userAgent = 'subconverter/0.9.2'
            const builder = new ClashConfigBuilder(subParam, configParam, excludeParam, env, userAgent);
            const yamlText = await builder.build();

            // 4. 处理自定义文件名（如果不传 filename，默认叫 config.yaml；如果传了但没写 .yaml 后缀，自动补齐）
            let finalFileName = (filenameParam && filenameParam.trim() !== '')
                ? filenameParam.trim()
                : 'config.yaml';

            // 提取不带后缀的纯名称用于客户端 Profile Title 显示
            const profileTitle = finalFileName.replace(/\.(ya?ml)$/i, '');

            // 确保下载的文件名带有 .yaml 后缀
            if (!/\.(ya?ml)$/i.test(finalFileName)) {
                finalFileName += '.yaml';
            }

            // 对文件名进行 UTF-8 URL 编码，兼容中文文件名与各类 Clash/Mihomo 客户端
            const encodedFileName = encodeURIComponent(finalFileName);
            const base64Title = btoa(unescape(encodeURIComponent(profileTitle)));

            return new Response(yamlText, {
                status: 200,
                headers: {
                    'Content-Type': 'text/yaml; charset=utf-8',
                    'Cache-Control': 'no-store',
                    // 标准文件下载名 + RFC 5987 UTF-8 扩展名（浏览器保存与 OpenClash/Nikki 识别用）
                    'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
                    // Clash Verge / Mihomo Party 等桌面客户端自动识别订阅名称用
                    'profile-title': `base64:${base64Title}`
                }
            });
        } catch (err) {
            return new Response(`转换失败: ${err.message}\n${err.stack || ''}`, {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    }
};