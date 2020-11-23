const fs = require('fs')
const path = require('path')
const express = require('express')
const { serveYylSsr } = require('../../..')
const util = require('yyl-util')

const HTML_PATH = path.join(__dirname, '../../data/cache.html')

const app = express()

app.get(
  '/*',
  serveYylSsr({
    cacheExpire: 10000,
    async render({ req, res }) {
      await util.waitFor(200)
      return fs.readFileSync(HTML_PATH).toString()
    },
    logger({ type, path, args }) {
      console.log(`[${type}] - [${path}]`, ...args)
    }
  })
)

app.listen(5000)
