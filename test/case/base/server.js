const fs = require('fs')
const path = require('path')
const express = require('express')
const serveYylSsr = require('../../..')
const util = require('yyl-util')

const FRAG_PATH = path.join(__dirname, '../../__frag')
const HTML_PATH = path.join(__dirname, '../../data/cache.html')

const app = express()

app.get('/*', serveYylSsr({
  cachePath: path.join(FRAG_PATH, '.cache-cba'),
  cacheExpire: 10000,
  async render ({ req, res}) {
    await util.waitFor(200)
    return fs.readFileSync(HTML_PATH).toString()
  },
  logger({ type, path, args}) {
    console.log(`[${type}] - [${path}]`, ...args)
  }
}))

app.listen(5000)