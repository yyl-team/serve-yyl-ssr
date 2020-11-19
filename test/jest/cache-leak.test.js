const path = require('path')
const extFs = require('yyl-fs')
const fs = require('fs')
const FRAG_PATH = path.join(__dirname, '../../__frag')
const serveYylSsr = require('../..')

function waitFor(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, t)
  })
}

test('cache leak test', async () => {
  const HTML_Path = path.join(__dirname, '../data/cache.html').toString()
  const cachePath = path.join(FRAG_PATH, '.cache-leak-yyl-ssr-cache')
  const logs = []

  /** 清除文件 */
  await extFs.removeFiles(cachePath, true)

  const checkFn = serveYylSsr({
    cacheExpire: 1000,
    cacheLimit: 200,
    cachePath,
    render() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(fs.readFileSync(HTML_Path).toString())
        }, 200)
      })
    },
    logger(props) {
      logs.push(props)
    }
  })

  /** 检查是否会自动创建 cache 目录 */
  expect(fs.existsSync(cachePath)).toEqual(true)

  const results = []
  const visit = (url) => {
    checkFn(
      {
        url
      },
      {
        send(ctx) {
          results.push(['send', ctx])
        }
      },
      (er) => {
        results.push(['next', er])
      }
    )
  }

  const memorysUsed = []

  /** 用例执行 */
  for (let i = 0; i < 2000; i++) {
    if (i % 50 === 0) {
      memorysUsed.push(process.memoryUsage().heapUsed)
    }
    visit(`path/to/${i}`)
  }

  const checkArr = memorysUsed.map((d) => d - memorysUsed[0])

  expect(checkArr).not.toEqual(checkArr.sort())
  /** 清除文件 */
  await extFs.removeFiles(cachePath, true)
})
