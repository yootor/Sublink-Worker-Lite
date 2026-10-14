import yaml from 'js-yaml';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { addProxyWithDedup } from './helpers/proxyHelpers.js';
import adblockTemplateYaml from '../config/Adblock.yaml';
import openwrtTemplateYaml from '../config/openwrt.yaml';

// 项目内置模板字典（忽略大小写，支持带或不带 .yaml 后缀）
const BUILTIN_TEMPLATES = {
    'adblock': adblockTemplateYaml,
    'adblock.yaml': adblockTemplateYaml,
    'openwrt': openwrtTemplateYaml,
    'openwrt.yaml': openwrtTemplateYaml,
};

function getClashUdpValue(proxy, defaultEnabled = true) {
    if (typeof proxy?.udp !== 'undefined') {
        return proxy.udp;
    }
    return defaultEnabled;
}

/**
 * 将包含 (?i) 的正则安全转换为 JS RegExp
 */
function createSafeRegExp(pattern) {
    const cleanPattern = String(pattern).replace(/^\(\?i\)/i, '');
    return new RegExp(cleanPattern, 'i');
}

export class ClashConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, configParam, excludeParam, env, userAgent) {
        super(inputString, { proxies: [] }, userAgent);
        this.configParam = configParam;
        this.excludeParam = excludeParam;
        this.env = env;
    }

    getProxies() {
        return this.config.proxies || [];
    }

    convertProxy(proxy) {
        switch (proxy.type) {
            case 'shadowsocks':
                return {
                    name: proxy.tag,
                    type: 'ss',
                    server: proxy.server,
                    port: proxy.server_port,
                    cipher: proxy.method,
                    password: proxy.password,
                    udp: getClashUdpValue(proxy),
                    ...(proxy.plugin ? { plugin: proxy.plugin } : {}),
                    ...(proxy.plugin_opts ? { 'plugin-opts': proxy.plugin_opts } : {})
                };
            case 'vmess':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    alterId: proxy.alter_id ?? 0,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    servername: proxy.tls?.server_name || '',
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    network: proxy.transport?.type || proxy.network || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'http-opts': proxy.transport?.type === 'http'
                        ? (() => {
                            const opts = {
                                method: proxy.transport.method || 'GET',
                                path: Array.isArray(proxy.transport.path) ? proxy.transport.path : [proxy.transport.path || '/'],
                            };
                            if (proxy.transport.headers && Object.keys(proxy.transport.headers).length > 0) {
                                opts.headers = proxy.transport.headers;
                            }
                            return opts;
                        })()
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    'h2-opts': proxy.transport?.type === 'h2'
                        ? { path: proxy.transport.path, host: proxy.transport.host }
                        : undefined,
                    udp: getClashUdpValue(proxy)
                };
            case 'vless':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    servername: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    udp: getClashUdpValue(proxy),
                    ...(proxy.alpn ? { alpn: proxy.alpn } : {}),
                    ...(proxy.packet_encoding ? { 'packet-encoding': proxy.packet_encoding } : {}),
                    flow: proxy.flow ?? undefined,
                };
            case 'hysteria2':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    ...(proxy.ports ? { ports: proxy.ports } : {}),
                    obfs: proxy.obfs?.type,
                    'obfs-password': proxy.obfs?.password,
                    password: proxy.password,
                    auth: proxy.auth,
                    up: proxy.up,
                    down: proxy.down,
                    'recv-window-conn': proxy.recv_window_conn,
                    sni: proxy.tls?.server_name || '',
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    ...(proxy.hop_interval !== undefined ? { 'hop-interval': proxy.hop_interval } : {}),
                    ...(proxy.alpn ? { alpn: proxy.alpn } : {}),
                    ...(proxy.fast_open !== undefined ? { 'fast-open': proxy.fast_open } : {}),
                };
            case 'trojan':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    cipher: proxy.security,
                    tls: proxy.tls?.enabled || false,
                    'client-fingerprint': proxy.tls?.utls?.fingerprint,
                    sni: proxy.tls?.server_name || '',
                    network: proxy.transport?.type || 'tcp',
                    'ws-opts': proxy.transport?.type === 'ws'
                        ? { path: proxy.transport.path, headers: proxy.transport.headers }
                        : undefined,
                    'reality-opts': proxy.tls?.reality?.enabled
                        ? { 'public-key': proxy.tls.reality.public_key, 'short-id': proxy.tls.reality.short_id }
                        : undefined,
                    'grpc-opts': proxy.transport?.type === 'grpc'
                        ? { 'grpc-service-name': proxy.transport.service_name }
                        : undefined,
                    tfo: proxy.tcp_fast_open,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    ...(proxy.alpn ? { alpn: proxy.alpn } : {}),
                    flow: proxy.flow ?? undefined,
                    udp: getClashUdpValue(proxy),
                };
            case 'tuic':
                return {
                    name: proxy.tag,
                    type: proxy.type,
                    server: proxy.server,
                    port: proxy.server_port,
                    uuid: proxy.uuid,
                    password: proxy.password,
                    'congestion-controller': proxy.congestion_control,
                    'skip-cert-verify': !!proxy.tls?.insecure,
                    ...(proxy.disable_sni !== undefined ? { 'disable-sni': proxy.disable_sni } : {}),
                    ...(proxy.tls?.alpn ? { alpn: proxy.tls.alpn } : {}),
                    sni: proxy.tls?.server_name,
                    'udp-relay-mode': proxy.udp_relay_mode || 'native',
                    ...(proxy.zero_rtt !== undefined ? { 'zero-rtt': proxy.zero_rtt } : {}),
                    ...(proxy.reduce_rtt !== undefined ? { 'reduce-rtt': proxy.reduce_rtt } : {}),
                    ...(proxy.fast_open !== undefined ? { 'fast-open': proxy.fast_open } : {}),
                };
            case 'anytls': {
                const idleSessionCheckInterval = proxy['idle-session-check-interval'] ?? proxy.idle_session_check_interval;
                const idleSessionTimeout = proxy['idle-session-timeout'] ?? proxy.idle_session_timeout;
                const minIdleSession = proxy['min-idle-session'] ?? proxy.min_idle_session;
                return {
                    name: proxy.tag,
                    type: 'anytls',
                    server: proxy.server,
                    port: proxy.server_port,
                    password: proxy.password,
                    udp: getClashUdpValue(proxy),
                    ...(proxy.tls?.utls?.fingerprint ? { 'client-fingerprint': proxy.tls.utls.fingerprint } : {}),
                    ...(proxy.tls?.server_name ? { sni: proxy.tls.server_name } : {}),
                    ...(proxy.tls?.insecure !== undefined ? { 'skip-cert-verify': !!proxy.tls.insecure } : {}),
                    ...(proxy.tls?.alpn ? { alpn: proxy.tls.alpn } : {}),
                    ...(idleSessionCheckInterval !== undefined ? { 'idle-session-check-interval': idleSessionCheckInterval } : {}),
                    ...(idleSessionTimeout !== undefined ? { 'idle-session-timeout': idleSessionTimeout } : {}),
                    ...(minIdleSession !== undefined ? { 'min-idle-session': minIdleSession } : {}),
                };
            }
            default:
                return proxy;
        }
    }

    addProxyToConfig(proxy) {
        this.config.proxies = this.config.proxies || [];
        addProxyWithDedup(this.config.proxies, proxy, {
            getName: (item) => item?.name,
            setName: (item, name) => {
                if (item) item.name = name;
            },
            isSame: (a = {}, b = {}) => {
                const { name: _name, ...restOfProxy } = b;
                const { name: __name, ...restOfExisting } = a;
                return JSON.stringify(restOfProxy) === JSON.stringify(restOfExisting);
            }
        });
    }

    /**
     * 获取模板内容：支持 ?config=远程链接、?config=KV键名、默认内置 Adblock.yaml
     */
    /**
     * 获取模板内容：
     * 1. 不传参数 -> 默认使用内置 Adblock.yaml
     * 2. ?config=openwrt 或 adblock -> 使用对应内置模板
     * 3. ?config=https://... -> 拉取远程模板
     * 4. ?config=kv_key -> 读取 Cloudflare KV
     */
    async loadTemplateString() {
        // 1. 未传 config 参数时，默认使用 Adblock.yaml
        if (!this.configParam) {
            return adblockTemplateYaml;
        }

        const target = decodeURIComponent(this.configParam).trim();
        const lowerKey = target.toLowerCase();

        // 2. 优先匹配项目内置的本地模板
        if (BUILTIN_TEMPLATES[lowerKey]) {
            return BUILTIN_TEMPLATES[lowerKey];
        }

        // 3. 如果是 http/https 链接，从远程拉取
        if (target.startsWith('http://') || target.startsWith('https://')) {
            const resp = await fetch(target);
            if (!resp.ok) {
                throw new Error(`无法拉取远程模板 (${resp.status}): ${target}`);
            }
            return await resp.text();
        }

        throw new Error(`未找到指定的配置模板: ${target}（内置可用模板: adblock）`);
    }
    
    async formatConfig() {
            // 1. 定义全局黑名单：默认剔除版本号、流量、到期时间、官网公告等假节点
            const GLOBAL_EXCLUDE_REGEX = /禁|业务|更新|剩余流量|距离下次重置|套餐到期|到期时间|官网|群组|公告|网址/i;
    
            // 2. 解析 URL 传入的 &exclude= 动态排除正则
            let userExcludeRegex = null;
            if (this.excludeParam && this.excludeParam.trim() !== '') {
                try {
                    userExcludeRegex = createSafeRegExp(this.excludeParam.trim());
                } catch (e) {
                    throw new Error(`exclude 参数正则表达式无效 "${this.excludeParam}": ${e.message}`);
                }
            }
    
            // 3. 过滤节点（同时满足不命中内置黑名单、也不命中 URL exclude 参数）
            const proxies = this.getProxies().filter(p => {
                if (GLOBAL_EXCLUDE_REGEX.test(p.name)) return false;
                if (userExcludeRegex && userExcludeRegex.test(p.name)) return false;
                return true;
            });
    
            // 4.同步回写过滤后的节点列表，确保外层统计准确
            this.config.proxies = proxies;
            const proxyNames = proxies.map(p => p.name);
    
            // 5. 加载模板并填入有效节点
            const templateString = await this.loadTemplateString();
            const finalConfig = yaml.load(templateString);
            finalConfig.proxies = proxies;

        // 遍历策略组，在后端直接完成节点筛选、排除并写入 proxies 列表
        if (Array.isArray(finalConfig['proxy-groups'])) {
            finalConfig['proxy-groups'].forEach(group => {
                if (!Array.isArray(group.proxies)) {
                    group.proxies = [];
                }

                // 只要策略组配置了 include-all、filter 或 regex，就在后端展开节点
                const filterPattern = group.filter || group.regex || (group['include-all'] ? '.*' : null);

                if (filterPattern) {
                    try {
                        const includeRegex = createSafeRegExp(filterPattern);
                        let matchedNodes = proxyNames.filter(name => includeRegex.test(name));

                        // 如果策略组配置了 exclude-filter（排除特定节点），进一步过滤
                        if (group['exclude-filter']) {
                            const excludeRegex = createSafeRegExp(group['exclude-filter']);
                            matchedNodes = matchedNodes.filter(name => !excludeRegex.test(name));
                        }

                        // 将筛选出的节点名写入策略组并去重
                        group.proxies = [...new Set([...group.proxies, ...matchedNodes])];
                    } catch (e) {
                        console.error(`策略组 ${group.name} 正则解析失败:`, e);
                    }

                    // 节点已实打实写入 proxies，清理掉模板中的动态筛选字段
                    delete group['include-all'];
                    delete group.filter;
                    delete group.regex;
                    delete group['exclude-filter'];
                }

                // 防空兜底：如果某地区（如美国）没有任何匹配节点，填入 DIRECT 防止 Clash 报错
                if (group.proxies.length === 0) {
                    group.proxies.push('DIRECT');
                }
            });
        }

        return yaml.dump(finalConfig, { lineWidth: -1, noRefs: true });
    }
    
}