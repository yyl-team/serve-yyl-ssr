const path = require('path')
const extFs = require('yyl-fs')
const fs = require('fs')
const { type } = require('yyl-util')

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/

function formatUrl(url) {
  return url.replace(/#.*$/g, '').replace(/\?.*$/g, '').replace(/&.*$/g, '')
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
      this.cacheMap = new Map()
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
  handleRender({ req, res, next }) {
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
      const cacheData = this.getCache(pathname)
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
    const { cacheMap, cacheRoot, cacheLimit, cacheExpire } = this
    if (!cacheExpire) {
      return
    }
    const now = new Date()
    const nowStr = now.toLocaleString()
    const iUrl = formatUrl(url)

    cacheMap.delete(iUrl)
    cacheMap.set(iUrl, {
      date: now,
      context: `${context}<!-- cached at ${nowStr} -->`
    })

    const keys = Array.from(cacheMap.keys())
    if (keys.length > cacheLimit) {
      const clearPadding = Math.round(cacheLimit / 2)
      keys.slice(0, clearPadding).forEach((key) => {
        cacheMap.delete(key)
      })
      this.log({
        type: 'info',
        path: iUrl,
        args: [`到达缓存上限, 清理缓存共 ${clearPadding} 条记录`]
      })
    }

    const writePath = path.join(cacheRoot, iUrl)
    extFs.mkdirSync(path.dirname(writePath)).catch((er) => {
      this.log({
        type: 'error',
        path: iUrl,
        args: [`写入缓存失败：创建目录出错 ${er.message}`]
      })
    })
    try {
      fs.writeFileSync(writePath, `${context}<!-- rendered at ${nowStr}  -->`)
      this.log({
        type: 'info',
        path: iUrl,
        args: ['写入缓存成功']
      })
    } catch (er) {
      this.log({
        type: 'error',
        path: iUrl,
        args: [`写入缓存失败：写入文件出错 ${er.message}`]
      })
    }
  }
  /** 获取缓存 */
  getCache(url) {
    const { cacheMap, cacheExpire, cacheRoot } = this
    if (!cacheExpire) {
      return
    }
    const now = new Date()
    const iUrl = formatUrl(url)
    const curCache = cacheMap.get(iUrl)
    if (curCache) {
      if (now - curCache.date > this.cacheExpire) {
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
    } else {
      const writePath = path.join(cacheRoot, iUrl)
      if (fs.existsSync(writePath)) {
        const stat = fs.statSync(writePath)
        const fDate = new Date(stat.ctimeMs)
        if (now - fDate < this.cacheExpire) {
          try {
            const cnt = fs.readFileSync(writePath).toString()
            if (cnt.match(HTML_FINISHED_REG)) {
              this.log({
                type: 'info',
                path: iUrl,
                args: ['读取本地缓存文件成功']
              })
              return cnt
            } else {
              this.log({
                type: 'warn',
                path: iUrl,
                args: ['读取缓存失败:本地缓存文件内容不完整']
              })
            }
          } catch (er) {
            this.log({
              type: 'error',
              path: iUrl,
              args: [`读取缓存失败:本地缓存文件读取失败-${er.message}`]
            })
          }
        } else {
          this.log({
            type: 'info',
            path: iUrl,
            args: [
              `读取缓存失败:本地缓存文件已失效(修改时间: ${fDate.toLocaleString()})`
            ]
          })
        }
      } else {
        this.log({
          type: 'info',
          path: iUrl,
          args: ['读取缓存失败:缓存不存在']
        })
      }
    }
    return
  }
  log({ type, args, path }) {
    if (this.logger) {
      this.logger({ type, args, path })
    }
  }
}

module.exports = YylSsr
