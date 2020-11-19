const path = require('path')
const extFs = require('yyl-fs')
const fs = require('fs')
const { type } = require('yyl-util')
const redis = require('./redis')
const dayjs = require('dayjs')

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/

function formatUrl(url) {
  let r = url.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/&.*$/g, '')
  if (/\/$/.test(r)) {
    r = `${r}index.html`
  }
  return r
}

class YylSsr {
  constructor({
    render,
    isProduct,
    cachePath,
    cacheExpire,
    logger,
    cacheLimit
  }) {
    if (cacheExpire) {
      const cacheRoot = path.resolve(
        process.cwd(),
        cachePath || '.yyl-ssr-cache'
      )
      if (!fs.existsSync(cacheRoot)) {
        extFs.mkdirSync(cacheRoot)
      }
      this.cacheRoot = cacheRoot
      this.cacheExpire = cacheExpire
      this.cacheLimit = cacheLimit || 200
      this.redis = redis.init()
    }

    this.render = render

    if (isProduct) {
      this.handler = () => {
        return (req, res, next) => {
          this.handleRender({ req, res, next })
        }
      }
    } else {
      this.handler = () => {
        return (req, res, next) => {
          if (/^\/__webpack_hmr/.test(req.url)) {
            next()
          } else if (/^\/webpack-dev-server/.test(req.url)) {
            next()
          } else {
            this.handleRender({ res, req, next })
          }
        }
      }
    }
    this.logger = logger
  }
  /** 渲染操作 */
  async handleRender({ req, res, next }) {
    const pathname = formatUrl(req.url)
    const check = (c) => {
      switch (type(c)) {
        case 'string':
          this.setCache(pathname, c)
          res.send(c)
          break

        case 'promise':
          c.then(check)
          break

        case 'object':
          // stream
          if (c.pipe) {
            c.pipe(res)
          } else {
            next()
          }
          break

        case 'array':
          if (c[0]) {
            this.logger({
              type: 'error',
              path: pathname,
              args: ['渲染出错', c[0]]
            })
            if (type(c[1]) === 'string') {
              this.logger({
                type: 'info',
                path: pathname,
                args: [`读取后备 html`, c[1]]
              })
              res.send(c[1])
            } else {
              this.logger({
                type: 'warn',
                path: pathname,
                args: ['没有设置后备 html, 跳 server error 逻辑']
              })
              next(c[0])
            }
          } else {
            if (type(c[1]) === 'string') {
              this.setCache(pathname, c[1])
              res.send(c[1])
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
    if (['', '.html', '.htm'].includes(path.extname(pathname))) {
      const cacheData = await this.getCache(pathname)
      if (cacheData) {
        res.send(cacheData)
      } else {
        check(this.render({ req, res, next }))
      }
    } else {
      this.logger({
        type: 'warn',
        path: pathname,
        args: ['不命中规则, next']
      })
      next()
    }
  }
  /** 写入缓存 */
  setCache(url, context) {
    const { cacheExpire } = this
    if (!cacheExpire) {
      return
    }
    const nowStr = dayjs().format('YYYY-MM-DD hh:mm:ss')
    const iUrl = formatUrl(url)

    this.redis.set(url, {
      date: nowStr,
      context: `${context}<!-- rendered at ${nowStr}  -->`
    })
    this.log({
      type: 'info',
      path: iUrl,
      args: ['写入缓存成功']
    })
  }
  /** 获取缓存 */
  async getCache(url) {
    const { cacheMap, cacheExpire } = this
    if (!cacheExpire) {
      return
    }
    const iUrl = formatUrl(url)
    const curCache = await cacheMap.get(iUrl)
    if (curCache) {
      if (dayjs().subtract(curCache.date, 'ms') > this.cacheExpire) {
        this.log({
          type: 'info',
          path: iUrl,
          args: [
            `读取缓存失败:缓存已失效(创建时间:${curCache.date.toLocaleString()})`
          ]
        })
        return
      }
      if (typeof curCache.context === 'string') {
        if (!curCache.context.match(HTML_FINISHED_REG)) {
          this.log({
            type: 'warn',
            path: iUrl,
            args: ['读取缓存失败:缓存内容不完整']
          })
          return
        } else {
          this.log({
            type: 'info',
            path: iUrl,
            args: ['读取缓存成功']
          })
          return curCache.context
        }
      }
      this.log({
        type: 'error',
        path: iUrl,
        args: [
          `缓存格式不正确typeof cache[${iUrl}].context = ${typeof curCache.context}`
        ]
      })
      return
    }
  }
  log({ type, args, path }) {
    if (this.logger) {
      this.logger({ type, args, path })
    }
  }
  clear() {
    redis.end()
  }
}

module.exports = YylSsr
