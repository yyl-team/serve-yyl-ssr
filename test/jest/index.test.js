const fs = require('fs')
const path = require('path')
const util = require('yyl-util')
const express = require('express')
const http = require('http')
const { serveYylSsr, ssrRedis } = require('../../')
const supertest = require('supertest')
const HTML_PATH = path.join(__dirname, '../../data/cache.html')

test('usage test', async () => {
  // prepare
  const app = express()
  const logs = []
  app.get('/*', serveYylSsr({
    cacheExpire: 1000,
    async render ({ req, res }) {
      await util.waitFor(200)
      return fs.readFileSync(HTML_PATH).toString()
    },
    logger({ type, path, args}) {
      logs.push(`[${type}] - [${path}] ${args.join(' ')}`)
    }
  }))


  // + test
  const request = supertest(app)
  const pathnames = [
    '/a',
    '/b',
    '/c',
    '/d',
    '/a'
  ]

  await util.waitFor(1000)
  pathnames.forEach((pathname) => {
    request.get(pathname)
  })

  await util.waitFor(1000)
  // - test

  expect(logs).toEqual([])

  // end
  ssrRedis.end()
})