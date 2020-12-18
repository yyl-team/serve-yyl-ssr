const fs = require('fs')
const path = require('path')
const util = require('yyl-util')
const express = require('express')
const http = require('http')
const { serveYylSsr, ssrRedis } = require('../../')
const supertest = require('supertest')
const dayjs = require('dayjs')
const HTML_PATH = path.join(__dirname, '../data/cache.html')
const { runCMD } = require('yyl-os')

test('usage test', async () => {
  const version = await runCMD('redis-server -v')
  if (!version) {
    throw new Error('请先启动 redis-server 再进行自测')
  }

  let padding = 0
  // prepare
  const app = express()
  const logs = []
  app.get(
    '/*',
    serveYylSsr({
      cacheExpire: 10000,
      async render({ req, res }) {
        await util.waitFor(200)
        return fs.readFileSync(HTML_PATH).toString()
      },
      logger({ type, path, args }) {
        logs.push(`[${type}] - [${path}] ${args.join(' ')}`)
      },
      cacheMark: () => {
        const mark = ++padding % 2
        return mark
      }
    })
  )

  // + test
  const request = supertest(app)
  const pathnames = ['/a', '/a', '/a', '/a', '/b']

  await util.forEach(pathnames, async (pathname) => {
    await new Promise((resolve) => {
      request.get(`${pathname}`).end(() => {
        resolve()
      })
    })
  })

  await util.waitFor(1000)
  // - test

  expect(logs.filter((x) => !/失效/.test(x)).map((x) => x.replace(/\([^)]*\)/g, ''))).toEqual([
    '[info] - [system] redis 准备好了',
    `[info] - [/a] 写入缓存成功 缓存标识: [1]`,
    `[info] - [/a] 写入缓存成功 缓存标识: [0]`,
    `[info] - [/a] 读取缓存成功 缓存标识: [1]`,
    `[info] - [/a] 读取缓存成功 缓存标识: [0]`,
    `[info] - [/b] 写入缓存成功 缓存标识: [1]`
  ])

  // end
  await ssrRedis.end()
})
