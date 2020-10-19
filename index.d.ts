/** render option */
export interface ServeYylSsrOptionRenderOption {
  res: Response
  req: Request
  next: (err?: any) => void
}
export type LoggerType = 'info' | 'error' | 'warn' | 'success'
export type Logger = (type: LoggerType, args: any[]) => void
/** serveYylSss option */
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
}
type ServeYylSsr = (op: ServeYylSsrOption) => {}

declare const serveYylSsr: ServeYylSsr
export = serveYylSsr