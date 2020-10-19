const path = require('path')
const fs = require('fs')
const FRAG_PATH = path.join(__dirname, '../../__frag')
const serveYylSsr = require('../../')
const extFs = require('yyl-fs')

function waitFor(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, t)
  })
}

test('usage test', async () => {
  const HTML_STR = '<html>hello test</html>'
  const cachePath = path.join(FRAG_PATH, '.index-yyl-ssr-cache')
  const logs = []
  const checkFn = serveYylSsr({
    cacheExpire: 1000,
    cachePath,
    render() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(HTML_STR)
        }, 200)
      })
    },
    logger(type, args) {
      logs.push([type, args])
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

  /** 用例执行 */
  visit('path/to/abc')
  await waitFor(100)
  visit('path/to/abc')
  await waitFor(300)
  visit('path/to/abc')
  await waitFor(1000)
  visit('path/to/abc')

  await waitFor(500)
  expect(
    logs.map((arr) => {
      return arr[1].join(' ').replace(/\([^)]*\)/, '')
    })
  ).toEqual([
    '[path/to/abc] - 读取缓存失败:缓存不存在',
    '[path/to/abc] - 读取缓存失败:缓存不存在',
    '[path/to/abc] - 写入缓存成功',
    '[path/to/abc] - 写入缓存成功',
    '[path/to/abc] - 读取缓存成功',
    '[path/to/abc] - 读取缓存失败:缓存已失效',
    '[path/to/abc] - 写入缓存成功'
  ])

  const cacheTagetPath = path.join(cachePath, 'path/to/abc')

  expect(fs.existsSync(cacheTagetPath)).toEqual(true)
  expect(fs.readFileSync(cacheTagetPath).toString()).toEqual(HTML_STR)
  await extFs.removeFiles(cachePath, true)
})
