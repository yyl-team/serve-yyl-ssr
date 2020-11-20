import redis, { RedisClient } from 'redis'
import { Logger, LogType } from './types'

export interface SsrRedisOption {
  port?: number
  log: Logger
}

export interface SsrRedisHandle {
  /** 获取 缓存 */
  get<T extends RedisData = {}>(key: string): Promise<T | undefined>
  /** 设置缓存 */
  set<T extends RedisData = {}>(key: string, val: T): void
  /** 停止 redis */
  end(): void
}

/** ssr redis */
export interface SsrRedis {
  /** 日志输出设置 */
  log: Logger
  /** redis client */
  client: RedisClient | undefined
  /** 是否已经初始化 */
  inited: boolean
  /** 初始化 redis */
  init(option: SsrRedisOption): SsrRedisHandle
}

interface RedisData {
  [key: string]: string
}

export const ssrRedis: SsrRedis = {
  inited: false,
  log: () => {},
  client: undefined,
  init({ port, log }) {
    if (!this.inited) {
      this.client = redis.createClient({ port: port || 6379 })
      this.client.on('error', (er) => {
        log({
          type: LogType.Error,
          path: 'system',
          args: ['redis 发生错误', er]
        })
      })
    }

    this.log = log
    this.inited = true

    return {
      get: <T extends RedisData = {}>(key: string) => {
        return new Promise<T | undefined>((resolve) => {
          this.client?.hgetall(key, (err, reply) => {
            if (err) {
              resolve(undefined)
            }
            resolve(reply as T)
          })
        })
      },
      set: (key, val) => {
        Object.keys(val).forEach((subKey) => {
          this.client?.hmset(key, subKey, val[subKey])
        })
      },
      end: () => {
        this.client?.end()
      }
    }
  }
}
