const redis = require('redis')

const redisHandle = {
  inited: false,
  init({ port, log }) {
    if (!redisHandle.inited) {
      if (!port) {
        port = 6379
      }
      this.client = redis.createClient({ port })

      this.client.on('error', (er) => {
        log({
          type: 'error',
          path: 'system',
          args: ['redis 发生错误', er]
        })
      })
      this.log = log
      this.inited = true
    }

    return {
      get: (key) => {
        return this.client.hgetall(key)
      },
      set: (key, val) => {
        return this.client.hmset(key, val)
      },
      end: () => {
        this.client.end()
      }
    }
  },
  get(key) {
    const { client } = redisHandle
    if (client) {
      return new Promise((resolve) => {
        client.get(key, (err, res) => {
          if (err) {
            this.log({
              type: 'error',
              path: 'system',
              args: [`redis 读取失败 - [${key}]`, err]
            })
          }
          resolve(res)
        })
      })
    } else {
      this.log({
        type: 'error',
        path: 'system',
        args: [`redis 读取失败 - [${key}]`, '服务未启动']
      })
    }
  },
  set(key, val) {
    const { client } = this
    if (client) {
      this.client.set(key, val)
    } else {
      this.log({
        type: 'error',
        path: 'system',
        args: [`redis 写入失败 - [${key}]`, '服务未启动']
      })
    }
    // TODO:
  }
}
