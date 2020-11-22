import { RedisClient } from 'redis';
import { Logger } from './types';
export interface SsrRedisOption {
    port?: number;
    log: Logger;
}
export interface SsrRedisHandle {
    /** 获取 缓存 */
    get<T extends RedisData = {}>(key: string): Promise<T | undefined>;
    /** 设置缓存 */
    set<T extends RedisData = {}>(key: string, val: T): void;
    /** 停止 redis */
    end(): void;
}
/** ssr redis */
export interface SsrRedis {
    /** 是否支持 redis */
    isSupported: boolean;
    /** 日志输出设置 */
    log: Logger;
    /** redis client */
    client: RedisClient | undefined;
    /** 是否已经初始化 */
    inited: boolean;
    /** 初始化 redis */
    init(option: SsrRedisOption): SsrRedisHandle;
}
export interface RedisData {
    [key: string]: string;
}
export declare const ssrRedis: SsrRedis;
