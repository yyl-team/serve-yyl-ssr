# serve-yyl-ssr
yyl-ssr 用 服务端 中间件

## usage
直接看types
```typescript
/// <reference types="node" />
import * as http from "http";

declare function serveYylSsr<R extends http.OutgoingMessage, I extends http.IncomingMessage>(op: serveYylSsr.ServeYylSsrOption<R, I>): serveYylSsr.RequestHandler<R, I>

declare namespace serveYylSsr {
  /** next function */
  type NextFunction = (err?: any) => void
  /** render option */
  interface ServeYylSsrOptionRenderOption<R extends http.OutgoingMessage, I extends http.IncomingMessage> {
    res: R
    req: I
    next: NextFunction
  }
  /** 日志类型 */
  type LoggerType = 'info' | 'error' | 'warn' | 'success'
  /** 日志接收函数 */
  type Logger = (type: LoggerType, args: any[]) => void
  /** serveYylSsr option */
  interface ServeYylSsrOption<R extends http.OutgoingMessage, I extends http.IncomingMessage> {
    /** 渲染 */
    render(op: ServeYylSsrOptionRenderOption<R,I>): Promise<string> | string | void 
    /** 是否处于生产环境 */
    isProduct?: boolean
    /** 缓存持续时间 */
    cacheExpire?: number
    /** 缓存目录 */
    cachePath?: string
    /** 缓存默认最大条数, 默认 200 */
    cacheLimit?: number
    /** 日志输出回调 */
    logger?: Logger
  }
  /** serveYylSsr return */

  interface RequestHandler<R extends http.OutgoingMessage, I extends http.IncomingMessage> {
    (request: I, response: R, next: () => void): any
  }
}

export = serveYylSsr
```
