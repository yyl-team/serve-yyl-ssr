const path = require('path')

function handleRender({ res, req, next, render }) {
  const check = (c) => {
    if (typeof c === 'string' || typeof c === 'number') {
      res.send(c)
    } else if (typeof c === 'object' && typeof c.then === 'function') {
      c.then(check)
    } else {
      next()
    }
  }
  if (['', '.html', '.htm'].includes(path.extname(req.url))) {
    check(render({ req, res, next }))
  } else {
    next()
  }
}

const serveYylSsr = (op) => {
  const { render, isProduct } = op
  if (isProduct) {
    return (req, res, next) => {
      handleRender({ res, req, next, render })
    }
  } else {
    return (req, res, next) => {
      if (/^\/__webpack_hmr/.test(req.url)) {
        next()
      } else if (/^\/webpack-dev-server/.test(req.url)) {
        next()
      } else {
        handleRender({ res, req, next, render })
      }
    }
  }
}

module.exports = serveYylSsr
