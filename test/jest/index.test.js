const fs = require('fs')
const path = require('path')
const util = require('yyl-util')
const express = require('express')
const http = require('http')
const serveYylSse = require('../../')
const { serveYylSsr, ssrRedis } = require('../../')
const request = require('supertest')
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
  const pathnames = [
    '/a',
    '/b',
    '/c',
    '/d',
    '/a'
  ]

  await util.waitFor(1000)
  pathnames.forEach((pathname) => {
    request(app).get(pathname).end()
  })


  await util.waitFor(1000)
  console.log(logs)
  // - test

  expect(logs).toEqual([])

  // end
  ssrRedis.end()
})