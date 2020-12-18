import path from 'path'
import { type } from 'yyl-util'
import dayjs from 'dayjs'
import { ssrRedis, SsrRedisHandle, RedisData } from './redis'
import { Stream } from 'stream'
import { Logger, LoggerProps, LogType, Req, Res } from './types'

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/

/** url 格式化 */
function formatUrl(url: string) {
  const r = url.replace(/#.*$/g, '')
  return {
    key: encodeURIComponent(r),
    pathname: r
  }
}

/** next function 定义 */
export type NextFunction = (err?: any) => void

/** render 结果 */
export type RenderResult = [Error | undefined, string | undefined | Stream]

/** 渲染-参数 */
interface ServeYylSsrOptionRenderOption<O extends Res, I extends Req> {
  res: O
  req: I
  next: NextFunction
}

/** cache 数据 */
interface CacheData extends RedisData {
  date: string
  context: string
}

/** cache 类型 */
export enum CacheType {
  Redis = 'redis',
  None = 'none'
}

/** yylSsr - option */
export interface YylSsrOption<O extends Res, I extends Req> {
  /** 渲染 */
  render: (op: ServeYylSsrOptionRenderOption<O, I>) => Promise<RenderResult> | RenderResult
  /** 是否处于开发环境 */
  dev?: boolean
  /** 日志输出回调 */
  logger?: Logger
  /** redis 服务端口 */
  redisPort?: number
  /** 缓存有效时间 */
  cacheExpire?: number
  /** 缓存类型 */
  cacheType?: CacheType
  /** 缓存标识 */
  cacheMark?: string | ((req: I) => string)
}

function toCtx<T>(ctx: any) {
  return ctx as T
}

export type YylSsrProperty<O extends Res, I extends Req> = Required<YylSsrOption<O, I>>

export type YylSsrHandler<O extends Res, I extends Req> = () => (
  req: I,
  res: O,
  next: NextFunction
) => void

export interface CtxRenderProps<I extends Req, O extends Res> {
  req: I
  res: O
  ctx: Promise<RenderResult> | RenderResult
  pathname: string
  next: NextFunction
  cacheMark: string
}

/** yylSsr - 类 */
export class YylSsr<O extends Res = Res, I extends Req = Req> {
  /** 日志函数 */
  private logger: YylSsrProperty<O, I>['logger'] = () => {}
  /** 渲染函数 */
  private render: YylSsrProperty<O, I>['render'] = () => [new Error('render 未赋值'), undefined]
  /** 缓存操作句柄 */
  private redis?: SsrRedisHandle
  /** 缓存有效时间 */
  private cacheExpire: number = 1000 * 60
  /** 缓存类型 */
  private cacheType: YylSsrProperty<O, I>['cacheType'] = CacheType.Redis
  /** 缓存标识 */
  private cacheMark: YylSsrProperty<O, I>['cacheMark'] = ''

  /** 对外函数 */
  public apply: YylSsrHandler<O, I> = () => {
    return (req, res, next) => {
      this.ssrRender({ req, res, next })
    }
  }

  /** 初始化 */
  constructor(option: YylSsrOption<O, I>) {
    const { dev, redisPort, logger, cacheExpire, render, cacheType, cacheMark } = option
    if (dev) {
      this.apply = () => {
        return (req, res, next) => {
          if (typeof req.url === 'string') {
            if (/^\/__webpack_hmr/.test(req.url)) {
              next()
            } else if (/^\/webpack-dev-server/.test(req.url)) {
              next()
            } else {
              this.ssrRender({ res, req, next })
            }
          } else {
            next()
          }
        }
      }
    }

    // 緩存有效時間
    if (cacheExpire !== undefined) {
      this.cacheExpire = cacheExpire
    }

    // 日志接口
    if (logger) {
      this.logger = logger
    }

    // render 赋值
    if (render) {
      this.render = render
    }

    // 缓存类型
    if (cacheType) {
      this.cacheType = cacheType
    }

    // 缓存标识
    if (cacheMark) {
      this.cacheMark = cacheMark
    }

    // redis 初始化
    this.redis = ssrRedis.init({
      port: redisPort,
      log: (props) => {
        this.logger(props)
      }
    })
  }

  // 解析 cacheMark
  private parseCacheMark(req: I): string {
    const { cacheMark } = this
    if (typeof cacheMark === 'string') {
      return cacheMark
    } else {
      return cacheMark(req)
    }
  }

  private ctxRender(props: CtxRenderProps<I, O>) {
    const { ctx, res, pathname, next, req, cacheMark } = props
    let iCtx
    let r
    switch (type(ctx)) {
      case 'string':
        iCtx = toCtx<string>(ctx)
        this.setCache(pathname, iCtx, cacheMark)
        res.send(iCtx)
        break

      case 'promise':
        iCtx = toCtx<Promise<RenderResult>>(ctx)
        iCtx.then((val) => {
          this.ctxRender({
            ...props,
            ctx: val
          })
        })
        break

      case 'array':
        iCtx = toCtx<RenderResult>(ctx)
        // error
        if (iCtx[0]) {
          this.log({
            type: LogType.Error,
            path: pathname,
            args: ['渲染出错', iCtx[0]]
          })
          if (iCtx[1]) {
            this.log({
              type: LogType.Info,
              path: pathname,
              args: ['读取后备 html', iCtx[1]]
            })
          } else {
            this.log({
              type: LogType.Warn,
              path: pathname,
              args: ['没有设置后备 html, 跳 server error 逻辑']
            })
            next(iCtx[0])
          }
        } else {
          if (type(iCtx[1]) === 'string') {
            r = toCtx<string>(iCtx[1])
            this.setCache(pathname, r, this.parseCacheMark(req))
            res.send(r)
          } else if (type(iCtx[1]) === 'string') {
            r = toCtx<Stream>(iCtx[1])
            if (r.pipe) {
              r.pipe(res)
            } else {
              next()
            }
          } else {
            next()
          }
        }
        break

      default:
        next()
        break
    }
  }

  private async ssrRender(op: ServeYylSsrOptionRenderOption<O, I>) {
    const { req, res, next } = op
    const { pathname } = formatUrl(req.url as string)
    const cacheMark = this.parseCacheMark(req)

    if (['', '.html', '.htm'].includes(path.extname(pathname))) {
      const curCache = await this.getCache(pathname, cacheMark)
      if (curCache) {
        res.send(curCache)
      } else {
        this.ctxRender({
          req,
          res,
          next,
          pathname,
          ctx: this.render({ req, res, next }),
          cacheMark
        })
      }
    } else {
      this.log({
        type: LogType.Warn,
        path: pathname,
        args: ['不命中规则, next']
      })
      next()
    }
  }

  /** 缓存保存 */
  private setCache(url: string, context: string, cacheMark?: string) {
    const { cacheExpire, cacheType } = this
    if (!cacheExpire || cacheType === CacheType.None) {
      return
    }

    const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const { pathname, key } = formatUrl(url)
    const cacheKey = cacheMark ? `${cacheMark}-${key}` : key
    if (this.redis) {
      this.redis.set<CacheData>(cacheKey, {
        date: nowStr,
        context: `${context}<!-- rendered at ${nowStr}  -->`
      })
      this.log({
        type: LogType.Info,
        path: pathname,
        args: ['写入缓存成功', `缓存标识: [${cacheMark}]`]
      })
    }
  }

  /** 缓存提取 */
  private async getCache(url: string, cacheMark?: string) {
    const { cacheExpire, cacheType } = this
    if (!cacheExpire || cacheType === CacheType.None) {
      return
    }
    const { pathname, key } = formatUrl(url)
    const cacheKey = cacheMark ? `${cacheMark}-${key}` : key
    const now = new Date()
    const nowStr = dayjs(now).format('YY-MM-DD HH:mm:ss')
    const curCache = await this.redis?.get<CacheData>(cacheKey)
    const cacheSecond = cacheExpire / 1000
    if (curCache) {
      // 缓存已失效
      if (+now - +new Date(curCache.date) > cacheExpire) {
        this.log({
          type: LogType.Info,
          path: pathname,
          args: [
            `读取缓存失败:缓存已失效(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`,
            `缓存标识: [${cacheMark}]`
          ]
        })
      } else {
        if (!curCache.context.match(HTML_FINISHED_REG)) {
          this.log({
            type: LogType.Warn,
            path: pathname,
            args: [`读取缓存失败，缓存内容不完整`, curCache.context, `缓存标识: [${cacheMark}]`]
          })
        } else {
          this.log({
            type: LogType.Info,
            path: pathname,
            args: [
              `读取缓存成功(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`,
              `缓存标识: [${cacheMark}]`
            ]
          })
          return curCache.context
        }
      }
    }
  }

  /** 日志 */
  private log(props: LoggerProps) {
    if (this.logger) {
      this.logger(props)
    }
  }
}
