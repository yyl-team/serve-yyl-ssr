const path = require('path')
const extFs = require('yyl-fs')
const fs = require('fs')

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
      this.cacheMap = new Map()
      this.render = render
      this.cacheLimit = cacheLimit || 200
    }
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
    const check = (c) => {
      if (typeof c === 'string' || typeof c === 'number') {
        this.setCache(req.url, c)
        res.send(c)
      } else if (typeof c === 'object' && typeof c.then === 'function') {
        c.then(check)
      } else {
        next()
      }
    }
    if (['', '.html', '.htm'].includes(path.extname(req.url))) {
      const cacheData = this.getCache(req.url)
      if (cacheData) {
        res.send(cacheData)
      } else {
        check(this.render({ req, res, next }))
      }
    } else {
      next()
    }
  }
  /** 写入缓存 */
  setCache(url, context) {
    const { cacheMap, cacheRoot, cacheLimit } = this
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
    }

    const writePath = path.join(cacheRoot, iUrl)
    extFs.mkdirSync(path.dirname(writePath)).catch((er) => {
      this.log('error', [
        `[${iUrl}] - 写入缓存失败：创建目录出错 ${er.message}`
      ])
    })
    try {
      fs.writeFileSync(writePath, `${context}<!-- rendered at ${nowStr}  -->`)
      this.log('info', [`[${iUrl}] - 写入缓存成功`])
    } catch (er) {
      this.log('error', [
        `[${iUrl}] - 写入缓存失败：写入文件出错 ${er.message}`
      ])
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
        this.log('info', [
          `[${iUrl}] - 读取缓存失败:缓存已失效(创建时间:${curCache.date.toLocaleString()})`
        ])
        return
      }
      if (typeof curCache.context === 'string') {
        if (!curCache.context.match(HTML_FINISHED_REG)) {
          this.log('warn', [`[${iUrl}] - 读取缓存失败:缓存内容不完整`])
          return
        } else {
          this.log('info', [`[${iUrl}] - 读取缓存成功`])
          return curCache.context
        }
      }
      this.log('error', [
        `[${iUrl}] - 缓存格式不正确typeof cache[${iUrl}].context = ${typeof curCache.context}`
      ])
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
              this.log('info', [`[${iUrl}] - 读取本地缓存文件成功`])
              return cnt
            } else {
              this.log('warn', [
                `[${iUrl}] - 读取缓存失败:本地缓存文件内容不完整`
              ])
            }
          } catch (er) {
            this.log('error', [
              `[${iUrl}] - 读取缓存失败:本地缓存文件读取失败-${er.message}`
            ])
          }
        } else {
          this.log('info', [
            `[${iUrl}] - 读取缓存失败:本地缓存文件已失效(修改时间: ${fDate.toLocaleString()})`
          ])
        }
      } else {
        this.log('info', [`[${iUrl}] - 读取缓存失败:缓存不存在`])
      }
    }
    return
  }
  log(type, args) {
    if (this.logger) {
      this.logger(type, args)
    }
  }
}

module.exports = YylSsr
