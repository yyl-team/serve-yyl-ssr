const http = require('http')

for (var i = 0; i < 200; i++) {
  let url = `http://127.0.0.1:5000/${i}`
  http.get(url)
  console.log(`request: ${url}`)
}
console.log('all is done')