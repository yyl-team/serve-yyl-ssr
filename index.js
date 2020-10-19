const YylSsr = require('./lib/yylSsr')

const serveYylSsr = (op) => {
  const ssr = new YylSsr(op)
  return ssr.handler()
}

module.exports = serveYylSsr
