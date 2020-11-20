import path from 'path'
import extFs from 'yyl-fs'
import fs from 'fs'
import { type } from 'yyl-util'
import dayjs from 'dayjs'
import { ssrRedis, SsrRedisHandle } from './redis'
import { OutgoingMessage, IncomingMessage } from 'http'
import { Stream } from 'stream'
import { Logger } from './types'

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/

/** url 格式化 */
function formatUrl(url: string) {
  let r = url.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/&.*$/g, '')
  if (/\/$/.test(r)) {
    r = `${r}index.html`
  }
  return r
}

/** next function 定义 */
export type NextFunction = (err?: any) => void

/** render 结果 */
export type RenderResult = [Error | undefined, string | undefined | Stream]

/** 渲染-参数 */
interface ServeYylSsrOptionRenderOption<O extends OutgoingMessage, I extends IncomingMessage> {
  res: O
  req: I
  next: NextFunction
}

/** yylSsr - option */
export interface YylSsrOption<O extends OutgoingMessage, I extends IncomingMessage> {
  /** 渲染 */
  render: (op: ServeYylSsrOptionRenderOption<O, I>) => Promise<RenderResult> | RenderResult
  /** 是否处于开发环境 */
  dev: boolean
  /** 日志输出回调 */
  logger?: Logger
}

export type YylSsrProperty<O extends OutgoingMessage, I extends IncomingMessage> = Required<
  YylSsrOption<O, I>
>

export type YylSsrHandler<O extends OutgoingMessage, I extends IncomingMessage> = () => (
  req: I,
  res: O,
  next: NextFunction
) => void

/** yylSsr - 类 */
export class YylSsr<
  O extends OutgoingMessage = OutgoingMessage,
  I extends IncomingMessage = IncomingMessage
> {
  /** 对外函数 */
  public apply: YylSsrHandler<O, I> = () => {
    return (req, res, next) => {
      this.handleRender({ req, res, next })
    }
  }

  /** 日志函数 */
  private logger: YylSsrProperty<O, I>['logger'] = () => {}
  /** 缓存操作句柄 */
  private redis?: SsrRedisHandle
  constructor(option: YylSsrOption<O, I>) {
    const { dev } = option
    if (dev) {
      this.apply = () => {
        return (req, res, next) => {
          if (typeof req.url === 'string') {
            if (/^\/__webpack_hmr/.test(req.url)) {
              next()
            } else if (/^\/webpack-dev-server/.test(req.url)) {
              next()
            } else {
              this.handleRender({ res, req, next })
            }
          } else {
            next()
          }
        }
      }
    }
    // TODO:
  }

  private handleRender(op: ServeYylSsrOptionRenderOption<O, I>) {
    // TODO:
  }
}
