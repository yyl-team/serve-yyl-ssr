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

export interface CtxRenderProps<O extends Res> {
  res: O
  ctx: Promise<RenderResult> | RenderResult
  pathname: string
  next: NextFunction
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

  /** 对外函数 */
  public apply: YylSsrHandler<O, I> = () => {
    return (req, res, next) => {
      this.ssrRender({ req, res, next })
    }
  }

  /** 初始化 */
  constructor(option: YylSsrOption<O, I>) {
    const { dev, redisPort, logger, cacheExpire, render, cacheType } = option
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

    // redis 初始化
    this.redis = ssrRedis.init({
      port: redisPort,
      log: (props) => {
        this.logger(props)
      }
    })
  }

  private ctxRender(props: CtxRenderProps<O>) {
    const { ctx, res, pathname, next } = props
    let iCtx
    let r
    switch (type(ctx)) {
      case 'string':
        iCtx = toCtx<string>(ctx)
        this.setCache(pathname, iCtx)
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
            this.setCache(pathname, r)
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

    if (['', '.html', '.htm'].includes(path.extname(pathname))) {
      const curCache = await this.getCache(pathname)
      if (curCache) {
        res.send(curCache)
      } else {
        this.ctxRender({
          res,
          next,
          pathname,
          ctx: this.render({ req, res, next })
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
  private setCache(url: string, context: string) {
    const { cacheExpire, cacheType } = this
    if (!cacheExpire || cacheType === CacheType.None) {
      return
    }

    const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const { pathname, key } = formatUrl(url)
    if (this.redis) {
      this.redis.set<CacheData>(key, {
        date: nowStr,
        context: `${context}<!-- rendered at ${nowStr}  -->`
      })
      this.log({
        type: LogType.Info,
        path: pathname,
        args: ['写入缓存成功']
      })
    }
  }

  /** 缓存提取 */
  private async getCache(url: string) {
    const { cacheExpire, cacheType } = this
    if (!cacheExpire || cacheType === CacheType.None) {
      return
    }
    const { pathname, key } = formatUrl(url)
    const now = new Date()
    const nowStr = dayjs(now).format('YY-MM-DD HH:mm:ss')
    const curCache = await this.redis?.get<CacheData>(key)
    const cacheSecond = cacheExpire / 1000
    if (curCache) {
      // 缓存已失效
      if (+now - +new Date(curCache.date) > cacheExpire) {
        this.log({
          type: LogType.Info,
          path: pathname,
          args: [
            `读取缓存失败:缓存已失效(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`
          ]
        })
      } else {
        if (!curCache.context.match(HTML_FINISHED_REG)) {
          this.log({
            type: LogType.Warn,
            path: pathname,
            args: [`读取缓存失败，缓存内容不完整`, curCache.context]
          })
        } else {
          this.log({
            type: LogType.Info,
            path: pathname,
            args: [
              `读取缓存成功(现: ${nowStr}, 创建时间:${curCache.date}, 缓存时长: ${cacheSecond}s)`
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
