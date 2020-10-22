const path = require('path')
const fs = require('fs')
const FRAG_PATH = path.join(__dirname, '../../__frag')
const serveYylSsr = require('../..')
const extFs = require('yyl-fs')

function waitFor(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, t)
  })
}

test('cache limit test', async () => {
  const HTML_STR = '<html>hello test</html>'
  const cachePath = path.join(FRAG_PATH, '.cache-limit-yyl-ssr-cache')
  const logs = []

  /** 清除文件 */
  await extFs.removeFiles(cachePath, true)

  const checkFn = serveYylSsr({
    cacheExpire: 1000,
    cacheLimit: 2,
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
  visit('path/to/abcd')
  await waitFor(300)
  visit('path/to/abcde')
  await waitFor(1000)
  visit('path/to/abc')

  /** 验证 */
  await waitFor(2000)
  expect(
    logs.map((arr) => {
      return arr[1].join(' ').replace(/\([^)]*\)/, '')
    })
  ).toEqual([
    '[path/to/abc] - 读取缓存失败:缓存不存在',
    '[path/to/abcd] - 读取缓存失败:缓存不存在',
    '[path/to/abc] - 写入缓存成功',
    '[path/to/abcd] - 写入缓存成功',
    '[path/to/abcde] - 读取缓存失败:缓存不存在',
    '[path/to/abcde] - 写入缓存成功',
    '[path/to/abc] - 读取缓存失败:本地缓存文件已失效',
    '[path/to/abc] - 写入缓存成功'
  ])

  /** 文件内容验证 */
  const cacheTagetPath = path.join(cachePath, 'path/to/abc')
  expect(fs.existsSync(cacheTagetPath)).toEqual(true)
  const LAST_MARK_REG = /<!-- rendered at.*$/
  const writeFileCnt = fs.readFileSync(cacheTagetPath).toString()
  expect(LAST_MARK_REG.test(writeFileCnt)).toEqual(true)
  expect(writeFileCnt.replace(LAST_MARK_REG, '')).toEqual(HTML_STR)

  /** 清除文件 */
  await extFs.removeFiles(cachePath, true)
})
