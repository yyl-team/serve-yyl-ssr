/** render option */
interface ServeYylSsrOptionRenderOption {
  res: Response
  req: Request
  next: (err?: any) => void
}
/** serveYylSss option */
interface ServeYylSsrOption {
  /** 渲染 */
  render(op: ServeYylSsrOptionRenderOption)
  /** 是否处于生产环境 */
  isProduct?: boolean
  /** 缓存持续时间 */
  cacheExpire?: number
}
type ServeYylSsr = (op: ServeYylSsrOption) => {}

declare const serveYylSsr: ServeYylSsr
export = serveYylSsr