/** next function */
export type NextFunction = (err?: any) => void
/** render option */
export interface ServeYylSsrOptionRenderOption {
  res: Response
  req: Request
  next: NextFunction
}
/** 日志类型 */
export type LoggerType = 'info' | 'error' | 'warn' | 'success'
/** 日志接收函数 */
export type Logger = (type: LoggerType, args: any[]) => void
/** serveYylSsr option */
export interface ServeYylSsrOption {
  /** 渲染 */
  render(op: ServeYylSsrOptionRenderOption): Promise<string> | string | void 
  /** 是否处于生产环境 */
  isProduct?: boolean
  /** 缓存持续时间 */
  cacheExpire?: number
  /** 缓存目录 */
  cachePath?: string
  /** 日志输出回调 */
  logger?: Logger
  /** 主动缓存, 缓存间隔同 cacheExpire */
  activeCache?: boolean
}
/** serveYylSsr return */
type ServeYylSsrResult = (req: Request, res: Response, next: NextFunction) => void

/** serve-yyl-ssr */
type ServeYylSsr = (op: ServeYylSsrOption) => ServeYylSsrResult

declare const serveYylSsr: ServeYylSsr
export = serveYylSsr