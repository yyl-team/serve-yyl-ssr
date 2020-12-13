/*!
 * serve-yyl-ssr cjs 0.3.5
 * (c) 2020 - 2020 jackness
 * Released under the MIT License.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var yylUtil = require('yyl-util');
var dayjs = _interopDefault(require('dayjs'));
var redis = _interopDefault(require('redis'));

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

/** 日志-类型 */
(function (LogType) {
    LogType["Info"] = "info";
    LogType["Error"] = "error";
    LogType["Warn"] = "warn";
})(exports.LogType || (exports.LogType = {}));

const ssrRedis = {
    isSupported: true,
    inited: false,
    log: () => { },
    client: undefined,
    init({ port, log }) {
        if (!this.inited) {
            const iPort = port || 6379;
            this.client = redis.createClient({ port: iPort });
            this.client.on('ready', () => {
                if (this.client) {
                    this.client.flushall(() => {
                        this.isSupported = true;
                        log({
                            type: exports.LogType.Info,
                            path: 'system',
                            args: ['redis 准备好了']
                        });
                    });
                }
            });
            this.client.on('error', (er) => {
                if (`${er === null || er === void 0 ? void 0 : er.message}`.indexOf('ECONNREFUSED') !== -1) {
                    this.isSupported = false;
                    log({
                        type: exports.LogType.Warn,
                        path: 'system',
                        args: [`系统 redis 未启动, 端口: ${iPort}`]
                    });
                }
                else {
                    log({
                        type: exports.LogType.Error,
                        path: 'system',
                        args: ['redis 发生错误', er]
                    });
                }
            });
        }
        this.log = log;
        this.inited = true;
        return {
            get: (key) => {
                return new Promise((resolve) => {
                    if (!this.isSupported) {
                        log({
                            type: exports.LogType.Warn,
                            path: 'system',
                            args: [`redis 获取 [${key}] 失败, redis 未启动`]
                        });
                        resolve(undefined);
                    }
                    else if (this.client) {
                        this.client.hgetall(key, (err, reply) => {
                            if (err) {
                                resolve(undefined);
                            }
                            resolve(reply);
                        });
                    }
                    else {
                        log({
                            type: exports.LogType.Error,
                            path: 'system',
                            args: [`redis 获取 [${key}] 失败, this.client 未初始化`]
                        });
                    }
                });
            },
            set: (key, val) => {
                Object.keys(val).forEach((subKey) => {
                    if (!this.isSupported) {
                        log({
                            type: exports.LogType.Warn,
                            path: 'system',
                            args: [`redis 设置 [${key}] 失败, redis 未启动`]
                        });
                    }
                    else if (this.client) {
                        this.client.hmset(key, subKey, val[subKey]);
                    }
                    else {
                        log({
                            type: exports.LogType.Error,
                            path: 'system',
                            args: [`redis 设置 [${key}] 失败, this.client 未初始化`]
                        });
                    }
                });
            }
        };
    },
    end() {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.flushdb(resolve);
            }
            this.inited = false;
        });
    }
};

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/;
/** url 格式化 */
function formatUrl(url) {
    const r = url.replace(/#.*$/g, '');
    return {
        key: encodeURIComponent(r),
        pathname: r
    };
}
(function (CacheType) {
    CacheType["Redis"] = "redis";
    CacheType["None"] = "none";
})(exports.CacheType || (exports.CacheType = {}));
function toCtx(ctx) {
    return ctx;
}
/** yylSsr - 类 */
class YylSsr {
    /** 初始化 */
    constructor(option) {
        /** 日志函数 */
        this.logger = () => { };
        /** 渲染函数 */
        this.render = () => [new Error('render 未赋值'), undefined];
        /** 缓存有效时间 */
        this.cacheExpire = 1000 * 60;
        /** 缓存类型 */
        this.cacheType = exports.CacheType.Redis;
        /** 对外函数 */
        this.apply = () => {
            return (req, res, next) => {
                this.ssrRender({ req, res, next });
            };
        };
        const { dev, redisPort, logger, cacheExpire, render, cacheType } = option;
        if (dev) {
            this.apply = () => {
                return (req, res, next) => {
                    if (typeof req.url === 'string') {
                        if (/^\/__webpack_hmr/.test(req.url)) {
                            next();
                        }
                        else if (/^\/webpack-dev-server/.test(req.url)) {
                            next();
                        }
                        else {
                            this.ssrRender({ res, req, next });
                        }
                    }
                    else {
                        next();
                    }
                };
            };
        }
        // 緩存有效時間
        if (cacheExpire !== undefined) {
            this.cacheExpire = cacheExpire;
        }
        // 日志接口
        if (logger) {
            this.logger = logger;
        }
        // render 赋值
        if (render) {
            this.render = render;
        }
        // 缓存类型
        if (cacheType) {
            this.cacheType = cacheType;
        }
        // redis 初始化
        this.redis = ssrRedis.init({
            port: redisPort,
            log: (props) => {
                this.logger(props);
            }
        });
    }
    ctxRender(props) {
        const { ctx, res, pathname, next } = props;
        let iCtx;
        let r;
        switch (yylUtil.type(ctx)) {
            case 'string':
                iCtx = toCtx(ctx);
                this.setCache(pathname, iCtx);
                res.send(iCtx);
                break;
            case 'promise':
                iCtx = toCtx(ctx);
                iCtx.then((val) => {
                    this.ctxRender(Object.assign(Object.assign({}, props), { ctx: val }));
                });
                break;
            case 'array':
                iCtx = toCtx(ctx);
                // error
                if (iCtx[0]) {
                    this.log({
                        type: exports.LogType.Error,
                        path: pathname,
                        args: ['渲染出错', iCtx[0]]
                    });
                    if (iCtx[1]) {
                        this.log({
                            type: exports.LogType.Info,
                            path: pathname,
                            args: ['读取后备 html', iCtx[1]]
                        });
                    }
                    else {
                        this.log({
                            type: exports.LogType.Warn,
                            path: pathname,
                            args: ['没有设置后备 html, 跳 server error 逻辑']
                        });
                        next(iCtx[0]);
                    }
                }
                else {
                    if (yylUtil.type(iCtx[1]) === 'string') {
                        r = toCtx(iCtx[1]);
                        this.setCache(pathname, r);
                        res.send(r);
                    }
                    else if (yylUtil.type(iCtx[1]) === 'string') {
                        r = toCtx(iCtx[1]);
                        if (r.pipe) {
                            r.pipe(res);
                        }
                        else {
                            next();
                        }
                    }
                    else {
                        next();
                    }
                }
                break;
            default:
                next();
                break;
        }
    }
    ssrRender(op) {
        return __awaiter(this, void 0, void 0, function* () {
            const { req, res, next } = op;
            const { pathname } = formatUrl(req.url);
            if (['', '.html', '.htm'].includes(path.extname(pathname))) {
                const curCache = yield this.getCache(pathname);
                if (curCache) {
                    res.send(curCache);
                }
                else {
                    this.ctxRender({
                        res,
                        next,
                        pathname,
                        ctx: this.render({ req, res, next })
                    });
                }
            }
            else {
                this.log({
                    type: exports.LogType.Warn,
                    path: pathname,
                    args: ['不命中规则, next']
                });
                next();
            }
        });
    }
    /** 缓存保存 */
    setCache(url, context) {
        const { cacheExpire, cacheType } = this;
        if (!cacheExpire || cacheType === exports.CacheType.None) {
            return;
        }
        const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const { pathname, key } = formatUrl(url);
        if (this.redis) {
            this.redis.set(key, {
                date: nowStr,
                context: `${context}<!-- rendered at ${nowStr}  -->`
            });
            this.log({
                type: exports.LogType.Info,
                path: pathname,
                args: ['写入缓存成功']
            });
        }
    }
    /** 缓存提取 */
    getCache(url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { cacheExpire, cacheType } = this;
            if (!cacheExpire || cacheType === exports.CacheType.None) {
                return;
            }
            const { pathname, key } = formatUrl(url);
            const now = new Date();
            const nowStr = dayjs(now).format('YY-MM-DD HH:mm:ss');
            const curCache = yield ((_a = this.redis) === null || _a === void 0 ? void 0 : _a.get(key));
            const cacheSecond = cacheExpire / 1000;
            if (curCache) {
                // 缓存已失效
                if (+now - +new Date(curCache.date) > cacheExpire) {
                    this.log({
                        type: exports.LogType.Info,
                        path: pathname,
                        args: [
                            `读取缓存失败:缓存已失效(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`
                        ]
                    });
                }
                else {
                    if (!curCache.context.match(HTML_FINISHED_REG)) {
                        this.log({
                            type: exports.LogType.Warn,
                            path: pathname,
                            args: [`读取缓存失败，缓存内容不完整`, curCache.context]
                        });
                    }
                    else {
                        this.log({
                            type: exports.LogType.Info,
                            path: pathname,
                            args: [
                                `读取缓存成功(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`
                            ]
                        });
                        return curCache.context;
                    }
                }
            }
        });
    }
    /** 日志 */
    log(props) {
        if (this.logger) {
            this.logger(props);
        }
    }
}

function serveYylSsr(option) {
    const ssr = new YylSsr(option);
    return ssr.apply();
}

exports.YylSsr = YylSsr;
exports.serveYylSsr = serveYylSsr;
exports.ssrRedis = ssrRedis;
