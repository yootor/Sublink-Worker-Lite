import yaml from 'js-yaml';
import { deepCopy } from '../../utils.js';
import { convertYamlProxyToObject } from '../convertYamlProxyToObject.js';

const SINGBOX_NON_PROXY_TYPES = new Set(['direct', 'block', 'dns', 'selector', 'urltest']);
const SINGBOX_GROUP_TYPES = new Set(['selector', 'urltest']);

export function parseSingboxJson(content) {
    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.outbounds)) {
            const proxies = parsed.outbounds.filter(o =>
                o && typeof o === 'object' &&
                o.server && o.type &&
                !SINGBOX_NON_PROXY_TYPES.has(o.type)
            );
            if (proxies.length > 0) {
                const configOverrides = deepCopy(parsed);
                delete configOverrides.outbounds;

                const proxyGroups = parsed.outbounds
                    .filter(o => o && SINGBOX_GROUP_TYPES.has(o.type))
                    .map(o => convertSingboxGroupToClashFormat(o))
                    .filter(g => g != null);

                if (proxyGroups.length > 0) {
                    configOverrides['proxy-groups'] = proxyGroups;
                }

                return {
                    type: 'singboxConfig',
                    proxies,
                    config: Object.keys(configOverrides).length > 0 ? configOverrides : null
                };
            }
        }
    } catch (e) {
        // Not valid JSON
    }
    return null;
}

function convertSingboxGroupToClashFormat(outbound) {
    if (!outbound || !outbound.tag || !outbound.type) {
        return null;
    }

    const group = {
        name: outbound.tag,
        type: outbound.type === 'selector' ? 'select' : 'url-test',
        proxies: outbound.outbounds || []
    };

    if (outbound.type === 'urltest') {
        group.url = outbound.url || 'https://cp.cloudflare.com/generate_204';
        if (outbound.interval) {
            group.interval = parseInterval(outbound.interval);
        } else {
            group.interval = 300;
        }
    }

    return group;
}

function parseInterval(interval) {
    if (typeof interval === 'number') {
        return interval;
    }
    if (typeof interval === 'string') {
        const match = interval.match(/^(\d+)(s|m|h)?$/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2] || 's';
            switch (unit) {
                case 'h': return value * 3600;
                case 'm': return value * 60;
                default: return value;
            }
        }
        return parseInt(interval) || 300;
    }
    return 300;
}

export function parseClashYaml(content) {
    try {
        const parsed = yaml.load(content);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies)) {
            const proxies = parsed.proxies
                .map(p => convertYamlProxyToObject(p))
                .filter(p => p != null);
            if (proxies.length > 0) {
                const configOverrides = deepCopy(parsed);
                delete configOverrides.proxies;
                return {
                    type: 'yamlConfig',
                    proxies,
                    config: Object.keys(configOverrides).length > 0 ? configOverrides : null
                };
            }
        }
    } catch (e) {
        // Not valid YAML or doesn't have proxies array
    }
    return null;
}

export function parseSubscriptionContent(content) {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const trimmed = content.trim();
    if (!trimmed) {
        return [];
    }

    const singboxResult = parseSingboxJson(trimmed);
    if (singboxResult) {
        return singboxResult;
    }

    const clashResult = parseClashYaml(trimmed);
    if (clashResult) {
        return clashResult;
    }

    // Fallback: split by lines (for URI lists)
    return trimmed.split('\n').filter(line => line.trim() !== '');
}