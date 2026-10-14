import { ClashConfigBuilder } from './builders/ClashConfigBuilder.js';

const ALLOWED_PARAMS = new Set(['sub', 'url', 'config', 'exclude']);

/**
 * 从原始 query string 中提取未解码的参数值
 */
function getRawQueryParam(search, key) {
    const query = search.startsWith('?') ? search.slice(1) : search;
    for (const pair of query.split('&')) {
        if (!pair) continue;
        const eqIdx = pair.indexOf('=');
        const k = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
        if (k === key) {
            return eqIdx === -1 ? '' : pair.slice(eqIdx + 1);
        }
    }
    return null;
}

/**
 * 校验参数是否已经过 URL Encode (encodeURIComponent)
 * 编码后的链接不应出现明文的 : / ? & = | 等字符
 */
function isStrictUrlEncoded(rawValue) {
    if (!rawValue) return false;
    return !/[:/?&=|]/.test(rawValue);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. 检查是否存在因未编码 & 符号而泄漏的非法参数
        for (const key of url.searchParams.keys()) {
            if (!ALLOWED_PARAMS.has(key)) {
                return new Response(
                    `错误: 检测到未知参数 "${key}"。请确保订阅链接和配置链接已完整进行 URL Encode (encodeURIComponent) 编码！`,
                    { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
                );
            }
        }

       // 2. 获取原始未解码的参数并强制校验 URL Encode
       const subKey = getRawQueryParam(url.search, 'sub') !== null ? 'sub' : 'url';
       const rawSub = getRawQueryParam(url.search, subKey);
       const rawConfig = getRawQueryParam(url.search, 'config');
       const rawExclude = getRawQueryParam(url.search, 'exclude');

       if (!rawSub) {
           return new Response(
               '用法: /?sub=<URL编码后的订阅链接>&config=<可选:模板链接或KV键名>&exclude=<可选:URL编码后的排除正则>',
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
               '错误: 参数 "config" 未进行 URL Encode 编码！\n请先将远程模板链接编码后再调用。',
               { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
           );
       }

       if (rawExclude !== null && !isStrictUrlEncoded(rawExclude)) {
           return new Response(
               '错误: 参数 "exclude" 未进行 URL Encode 编码！\n由于排除规则常包含 | 等特殊符号，请先使用 encodeURIComponent 编码后再调用。',
               { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
           );
       }

       // 3. 校验通过后，读取解码后的参数值执行转换
       const subParam = url.searchParams.get(subKey);
       const configParam = url.searchParams.get('config');
       const excludeParam = url.searchParams.get('exclude');

       try {
           const userAgent = request.headers.get('User-Agent') || 'ClashMeta';
           // 将 excludeParam 传入 Builder
           const builder = new ClashConfigBuilder(subParam, configParam, excludeParam, env, userAgent);
           const yamlText = await builder.build();
           
            if (!builder.getProxies().length) {
                return new Response('未能从订阅链接中解析出任何有效节点，请检查订阅链接是否有效。', {
                    status: 400,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }

            const headers = {
                'Content-Type': 'text/yaml; charset=utf-8',
                'Cache-Control': 'no-store'
            };

            const userinfo = builder.getSubscriptionUserinfo();
            if (userinfo) {
                headers['subscription-userinfo'] = userinfo;
            }

            return new Response(yamlText, { headers });
        } catch (err) {
            return new Response(`转换失败: ${err.message}\n${err.stack || ''}`, {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    }
};