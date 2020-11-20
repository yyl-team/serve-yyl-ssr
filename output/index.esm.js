/*!
 * serve-yyl-ssr esm 0.3.0
 * (c) 2020 - 2020 jackness
 * Released under the MIT License.
 */
import path from 'path';
import { type } from 'yyl-util';
import dayjs from 'dayjs';
import redis from 'redis';

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
var LogType;
(function (LogType) {
    LogType["Info"] = "info";
    LogType["Error"] = "error";
    LogType["Warn"] = "warn";
})(LogType || (LogType = {}));

const ssrRedis = {
    inited: false,
    log: () => { },
    client: undefined,
    init({ port, log }) {
        if (!this.inited) {
            this.client = redis.createClient({ port: port || 6379 });
            this.client.on('error', (er) => {
                log({
                    type: LogType.Error,
                    path: 'system',
                    args: ['redis 发生错误', er]
                });
            });
        }
        this.log = log;
        this.inited = true;
        return {
            get: (key) => {
                return new Promise((resolve) => {
                    var _a;
                    (_a = this.client) === null || _a === void 0 ? void 0 : _a.hgetall(key, (err, reply) => {
                        if (err) {
                            resolve(undefined);
                        }
                        resolve(reply);
                    });
                });
            },
            set: (key, val) => {
                Object.keys(val).forEach((subKey) => {
                    var _a;
                    (_a = this.client) === null || _a === void 0 ? void 0 : _a.hmset(key, subKey, val[subKey]);
                });
            },
            end: () => {
                var _a;
                (_a = this.client) === null || _a === void 0 ? void 0 : _a.end();
            }
        };
    }
};

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/;
/** url 格式化 */
function formatUrl(url) {
    let r = url.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/&.*$/g, '');
    if (/\/$/.test(r)) {
        r = `${r}index.html`;
    }
    return r;
}
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
        this.render = () => [new Error('not ready'), undefined];
        /** 缓存有效时间 */
        this.cacheExpire = 1000 * 60;
        /** 对外函数 */
        this.apply = () => {
            return (req, res, next) => {
                this.handleRender({ req, res, next });
            };
        };
        const { dev, redisPort, logger, cacheExpire, render } = option;
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
                            this.handleRender({ res, req, next });
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
        // redis 初始化
        this.redis = ssrRedis.init({
            port: redisPort,
            log: (props) => {
                this.logger(props);
            }
        });
    }
    handleRender(op) {
        return __awaiter(this, void 0, void 0, function* () {
            const { req, res, next } = op;
            const pathname = formatUrl(req.url);
            let iCtx;
            let r;
            const typeHandler = (ctx) => __awaiter(this, void 0, void 0, function* () {
                switch (type(ctx)) {
                    case 'string':
                        iCtx = toCtx(ctx);
                        this.setCache(pathname, iCtx);
                        break;
                    case 'promise':
                        iCtx = toCtx(ctx);
                        iCtx.then(typeHandler);
                        break;
                    case 'array':
                        iCtx = toCtx(ctx);
                        // error
                        if (iCtx[0]) {
                            this.log({
                                type: LogType.Error,
                                path: pathname,
                                args: ['渲染出错', iCtx[0]]
                            });
                            if (iCtx[1]) {
                                this.log({
                                    type: LogType.Info,
                                    path: pathname,
                                    args: ['读取后备 html', iCtx[1]]
                                });
                            }
                            else {
                                this.log({
                                    type: LogType.Warn,
                                    path: pathname,
                                    args: ['没有设置后备 html, 跳 server error 逻辑']
                                });
                                next(iCtx[0]);
                            }
                        }
                        else {
                            if (type(iCtx[1]) === 'string') {
                                r = toCtx(iCtx[1]);
                                this.setCache(pathname, r);
                                res.send(r);
                            }
                            else if (type(iCtx[1]) === 'string') {
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
            });
            if (['', '.html', '.htm'].includes(path.extname(pathname))) {
                const curCache = yield this.getCache(pathname);
                if (curCache) {
                    res.send(curCache);
                }
                else {
                    typeHandler(this.render({ req, res, next }));
                }
            }
            else {
                this.log({
                    type: LogType.Warn,
                    path: pathname,
                    args: ['不命中规则, next']
                });
                next();
            }
        });
    }
    /** 缓存保存 */
    setCache(url, context) {
        var _a;
        const { cacheExpire } = this;
        if (!cacheExpire) {
            return;
        }
        const nowStr = dayjs().format('YYYY-MM-DD hh:mm:ss');
        const pathname = formatUrl(url);
        (_a = this.redis) === null || _a === void 0 ? void 0 : _a.set(pathname, {
            date: nowStr,
            context: `${context}<!-- rendered at ${nowStr}  -->`
        });
        this.log({
            type: LogType.Info,
            path: pathname,
            args: ['写入缓存成功']
        });
    }
    /** 缓存提取 */
    getCache(url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { cacheExpire } = this;
            if (!cacheExpire) {
                return;
            }
            const pathname = formatUrl(url);
            const now = new Date();
            const curCache = yield ((_a = this.redis) === null || _a === void 0 ? void 0 : _a.get(pathname));
            if (curCache) {
                // 缓存已失效
                if (+now - +new Date(curCache.date) > cacheExpire) {
                    this.log({
                        type: LogType.Info,
                        path: pathname,
                        args: [`读取缓存失败:缓存已失效(创建时间:${curCache.date})`]
                    });
                }
                else {
                    if (curCache.context.match(HTML_FINISHED_REG)) {
                        this.log({
                            type: LogType.Warn,
                            path: pathname,
                            args: [`读取缓存失败，缓存内容不完整`]
                        });
                    }
                    else {
                        this.log({
                            type: LogType.Info,
                            path: pathname,
                            args: [`读取缓存成功`]
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

export default serveYylSsr;
