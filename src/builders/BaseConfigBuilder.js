import { ProxyParser } from '../parsers/index.js';
import { deepCopy, tryDecodeSubscriptionLines, decodeBase64 } from '../utils.js';
import { parseSubscriptionContent } from '../parsers/subscription/subscriptionContentParser.js';
import { fetchSubscriptionWithFormat } from '../parsers/subscription/httpSubscriptionFetcher.js';

export class BaseConfigBuilder {
    constructor(inputString, baseConfig = {}, userAgent = 'subconverter/0.9.2') {
        this.inputString = inputString;
        this.config = deepCopy(baseConfig || { proxies: [] });
        this.userAgent = userAgent;
        this.subscriptionUserinfo = undefined;
    }

    async build() {
        const customItems = await this.parseCustomItems();
        this.addCustomItems(customItems);
        return this.formatConfig();
    }

    async parseCustomItems() {
        const input = this.inputString || '';
        const parsedItems = [];

        // 1. 尝试直接作为完整配置文件解析 (Sing-Box JSON 或 Clash YAML)
        const directResult = parseSubscriptionContent(input);
        if (directResult && typeof directResult === 'object' && directResult.type) {
            if (Array.isArray(directResult.proxies)) {
                for (const proxy of directResult.proxies) {
                    if (proxy && proxy.tag) parsedItems.push(proxy);
                }
                if (parsedItems.length > 0) return parsedItems;
            }
        }

        // 2. 尝试整段 Base64 解码后解析
        const isBase64Like = /^[A-Za-z0-9+/=\r\n]+$/.test(input) && input.replace(/[\r\n]/g, '').length % 4 === 0;
        if (isBase64Like) {
            try {
                const sanitized = input.replace(/\s+/g, '');
                const decodedWhole = decodeBase64(sanitized);
                if (typeof decodedWhole === 'string') {
                    const decodedResult = parseSubscriptionContent(decodedWhole);
                    if (decodedResult && typeof decodedResult === 'object' && decodedResult.type) {
                        if (Array.isArray(decodedResult.proxies)) {
                            for (const proxy of decodedResult.proxies) {
                                if (proxy && proxy.tag) parsedItems.push(proxy);
                            }
                            if (parsedItems.length > 0) return parsedItems;
                        }
                    }
                }
            } catch (_) { }
        }

        // 3. 逐行处理订阅链接或节点 URI (支持换行或 | 分隔多个订阅)
        const urls = input.split(/[\r\n|]+/).filter(url => url.trim() !== '');
        for (const url of urls) {
            let processedUrls = tryDecodeSubscriptionLines(url);
            if (!Array.isArray(processedUrls)) {
                processedUrls = [processedUrls];
            }

            for (const processedUrl of processedUrls) {
                const trimmedUrl = typeof processedUrl === 'string' ? processedUrl.trim() : '';
                if (!trimmedUrl) continue;

                if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
                    try {
                        const fetchResult = await fetchSubscriptionWithFormat(trimmedUrl, this.userAgent);
                        if (fetchResult) {
                            const { content, subscriptionUserinfo } = fetchResult;
                            if (subscriptionUserinfo && !this.subscriptionUserinfo) {
                                this.subscriptionUserinfo = subscriptionUserinfo;
                            }

                            const result = parseSubscriptionContent(content);
                            if (result && typeof result === 'object' && Array.isArray(result.proxies)) {
                                result.proxies.forEach(proxy => {
                                    if (proxy && typeof proxy === 'object' && proxy.tag) {
                                        parsedItems.push(proxy);
                                    }
                                });
                                continue;
                            }

                            if (Array.isArray(result)) {
                                for (const item of result) {
                                    if (item && typeof item === 'object' && item.tag) {
                                        parsedItems.push(item);
                                    } else if (typeof item === 'string') {
                                        const subResult = await ProxyParser.parse(item, this.userAgent);
                                        if (subResult) parsedItems.push(subResult);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing HTTP subscription:', error);
                    }
                    continue;
                }

                // 协议分享链接 (anytls://, vless://, ss://, hy2:// 等)
                const result = await ProxyParser.parse(trimmedUrl, this.userAgent);
                if (result && typeof result === 'object' && Array.isArray(result.proxies)) {
                    result.proxies.forEach(proxy => {
                        if (proxy && typeof proxy === 'object' && proxy.tag) {
                            parsedItems.push(proxy);
                        }
                    });
                    continue;
                }
                if (Array.isArray(result)) {
                    for (const item of result) {
                        if (item && typeof item === 'object' && item.tag) {
                            parsedItems.push(item);
                        } else if (typeof item === 'string') {
                            const subResult = await ProxyParser.parse(item, this.userAgent);
                            if (subResult) parsedItems.push(subResult);
                        }
                    }
                } else if (result) {
                    parsedItems.push(result);
                }
            }
        }

        return parsedItems;
    }

    getSubscriptionUserinfo() {
        return this.subscriptionUserinfo;
    }

    addCustomItems(customItems) {
        const validItems = customItems.filter(item => item != null);
        validItems.forEach(item => {
            if (item?.tag) {
                const convertedProxy = this.convertProxy(item);
                if (convertedProxy) {
                    this.addProxyToConfig(convertedProxy);
                }
            }
        });
    }
}