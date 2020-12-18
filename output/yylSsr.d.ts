/// <reference types="node" />
import { Stream } from 'stream';
import { Logger, Req, Res } from './types';
/** next function 定义 */
export declare type NextFunction = (err?: any) => void;
/** render 结果 */
export declare type RenderResult = [Error | undefined, string | undefined | Stream];
/** 渲染-参数 */
interface ServeYylSsrOptionRenderOption<O extends Res, I extends Req> {
    res: O;
    req: I;
    next: NextFunction;
}
/** cache 类型 */
export declare enum CacheType {
    Redis = "redis",
    None = "none"
}
/** yylSsr - option */
export interface YylSsrOption<O extends Res, I extends Req> {
    /** 渲染 */
    render: (op: ServeYylSsrOptionRenderOption<O, I>) => Promise<RenderResult> | RenderResult;
    /** 是否处于开发环境 */
    dev?: boolean;
    /** 日志输出回调 */
    logger?: Logger;
    /** redis 服务端口 */
    redisPort?: number;
    /** 缓存有效时间 */
    cacheExpire?: number;
    /** 缓存类型 */
    cacheType?: CacheType;
    /** 缓存标识 */
    cacheMark?: string | ((req: I) => string);
}
export declare type YylSsrProperty<O extends Res, I extends Req> = Required<YylSsrOption<O, I>>;
export declare type YylSsrHandler<O extends Res, I extends Req> = () => (req: I, res: O, next: NextFunction) => void;
export interface CtxRenderProps<I extends Req, O extends Res> {
    req: I;
    res: O;
    ctx: Promise<RenderResult> | RenderResult;
    pathname: string;
    next: NextFunction;
    cacheMark: string;
}
/** yylSsr - 类 */
export declare class YylSsr<O extends Res = Res, I extends Req = Req> {
    /** 日志函数 */
    private logger;
    /** 渲染函数 */
    private render;
    /** 缓存操作句柄 */
    private redis?;
    /** 缓存有效时间 */
    private cacheExpire;
    /** 缓存类型 */
    private cacheType;
    /** 缓存标识 */
    private cacheMark;
    /** 对外函数 */
    apply: YylSsrHandler<O, I>;
    /** 初始化 */
    constructor(option: YylSsrOption<O, I>);
    private parseCacheMark;
    private ctxRender;
    private ssrRender;
    /** 缓存保存 */
    private setCache;
    /** 缓存提取 */
    private getCache;
    /** 日志 */
    private log;
}
export {};
