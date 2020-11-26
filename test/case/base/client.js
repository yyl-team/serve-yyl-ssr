const http = require('http')

setInterval(() => {
  console.log('============')
  for (var i = 0; i < 50; i++) {
    let url = `http://127.0.0.1:5000/${i}`
    http.get(url)
    console.log(`request: ${url}`)
  }
  console.log('============')
  console.log('done')
}, 1000)
