console.log(process.memoryUsage().heapUsed)

setTimeout(() => {
  console.log(process.memoryUsage().heapUsed)
}, 1000)
// let padding = 0
// for (var i = 0; i < 1000; i++) {
//   padding += 1
// }
// console.log(padding)
