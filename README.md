# serve-yyl-ssr

yyl-ssr 用 服务端 中间件

## usage

直接看 types

### entry

```typescript
import { Req, Res } from './types'
import { YylSsrOption } from './yylSsr'
export { ssrRedis } from './redis'
export declare function serveYylSsr<O extends Res = Res, I extends Req = Req>(
  option: YylSsrOption<O, I>
): (req: I, res: O, next: import('./yylSsr').NextFunction) => void
```

### redis

```typescript
import { RedisClient } from 'redis'
import { Logger } from './types'
export interface SsrRedisOption {
  port?: number
  log: Logger
}
export interface SsrRedisHandle {
  /** 获取 缓存 */
  get<T extends RedisData = {}>(key: string): Promise<T | undefined>
  /** 设置缓存 */
  set<T extends RedisData = {}>(key: string, val: T): void
}
/** ssr redis */
export interface SsrRedis {
  /** 是否支持 redis */
  isSupported: boolean
  /** 日志输出设置 */
  log: Logger
  /** redis client */
  client: RedisClient | undefined
  /** 是否已经初始化 */
  inited: boolean
  /** 初始化 redis */
  init(option: SsrRedisOption): SsrRedisHandle
  /** 终止 链接 redis */
  end(): void
}
export interface RedisData {
  [key: string]: string
}
export declare const ssrRedis: SsrRedis
```

### yylSsr

```typescript
/// <reference types="node" />
import { Stream } from 'stream'
import { Logger, Req, Res } from './types'
/** next function 定义 */
export declare type NextFunction = (err?: any) => void
/** render 结果 */
export declare type RenderResult = [Error | undefined, string | undefined | Stream]
/** 渲染-参数 */
interface ServeYylSsrOptionRenderOption<O extends Res, I extends Req> {
  res: O
  req: I
  next: NextFunction
}
/** yylSsr - option */
export interface YylSsrOption<O extends Res, I extends Req> {
  /** 渲染 */
  render: (op: ServeYylSsrOptionRenderOption<O, I>) => Promise<RenderResult> | RenderResult
  /** 是否处于开发环境 */
  dev: boolean
  /** 日志输出回调 */
  logger?: Logger
  /** redis 服务端口 */
  redisPort?: number
  /** 缓存有效时间 */
  cacheExpire?: number
}
export declare type YylSsrProperty<O extends Res, I extends Req> = Required<YylSsrOption<O, I>>
export declare type YylSsrHandler<O extends Res, I extends Req> = () => (
  req: I,
  res: O,
  next: NextFunction
) => void
/** yylSsr - 类 */
export declare class YylSsr<O extends Res = Res, I extends Req = Req> {
  /** 日志函数 */
  private logger
  /** 渲染函数 */
  private render
  /** 缓存操作句柄 */
  private redis?
  /** 缓存有效时间 */
  private cacheExpire
  /** 对外函数 */
  apply: YylSsrHandler<O, I>
  /** 初始化 */
  constructor(option: YylSsrOption<O, I>)
  private handleRender
  /** 缓存保存 */
  private setCache
  /** 缓存提取 */
  private getCache
  /** 日志 */
  private log
}
export {}
```

### types

```typescript
/// <reference types="node" />
import { IncomingMessage, OutgoingMessage } from 'http'
/** 日志-接收函数 */
export declare type Logger = (props: LoggerProps) => void
/** 日志-类型 */
export declare enum LogType {
  Info = 'info',
  Error = 'error',
  Warn = 'warn'
}
/** 日志-参数 */
export interface LoggerProps {
  /** 类型 */
  type: LogType
  /** 请求url */
  path: string
  /** 参数 */
  args: any[]
}
export interface Res extends OutgoingMessage {
  send(ctx: string): void
}
export interface Req extends IncomingMessage {
  url: string
}
```
