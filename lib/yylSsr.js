const path = require('path')
const extFs = require('yyl-fs')
const fs = require('fs')

/** html 结束标识 */
const HTML_FINISHED_REG = /<\/html>/

class YylSsr {
  constructor({ render, isProduct, cachePath, cacheExpire, logger, activeCache }) {
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
      this.cache = {}
      this.render = render

      if (activeCache) {
        /** 定时主动缓存初始化 */
        this.initActiveCache()
      }
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
    const { cache, cacheRoot } = this
    const now = new Date()
    const nowStr = now.toLocaleString()
    cache[url] = {
      date: now,
      context: `${context}<!-- cached at ${nowStr} -->`
    }
    const writePath = path.join(cacheRoot, url)
    extFs.mkdirSync(path.dirname(writePath)).catch((er) => {
      this.log('error', [`[${url}] - 写入缓存失败：创建目录出错 ${er.message}`])
    })
    try {
      fs.writeFileSync(writePath, `${context}<!-- rendered at ${nowStr}  -->`)
      this.log('info', [`[${url}] - 写入缓存成功`])
    } catch (er) {
      this.log('error', [`[${url}] - 写入缓存失败：写入文件出错 ${er.message}`])
    }
  }
  /** 获取缓存 */
  getCache(url) {
    const { cache, cacheExpire } = this
    if (!cacheExpire) {
      return
    }
    const now = new Date()
    const curCache = cache[url]
    if (curCache) {
      if (now - curCache.date > this.cacheExpire) {
        this.log('info', [
          `[${url}] - 读取缓存失败:缓存已失效(创建时间:${curCache.date.toLocaleString()})`
        ])
        return
      }
      if (typeof curCache.context === 'string') {
        if (!curCache.context.match(HTML_FINISHED_REG)) {
          this.log('warn', [`[${url}] - 读取缓存失败:缓存内容不完整`])
          return
        } else {
          this.log('info', [`[${url}] - 读取缓存成功`])
          return curCache.context
        }
      }
      this.log('error', [
        `[${url}] - 缓存格式不正确typeof cache[${url}].context = ${typeof cache.context}`
      ])
      return
    }
    this.log('info', [`[${url}] - 读取缓存失败:缓存不存在`])
    return
  }
  log(type, args) {
    if (this.logger) {
      this.logger(type, args)
    }
  }
  /** 定时主动缓存初始化 */
  initActiveCache() {
    const { cacheExpire, cache } = this
    clearInterval(this.initActiveCacheKey)
    this.initActiveCacheKey = setInterval(() => {
      const now = new Date()
      Object.keys(cache).forEach((pathname) => {
        if (now - cache[pathname].date > cacheExpire) {
          delete cache[pathname]
          // TODO: 更新 html
        }
      })
    }, cacheExpire)
  }
}

module.exports = YylSsr
