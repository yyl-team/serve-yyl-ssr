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
  /** 是否支持 redis */
  isSupported: boolean
  /** 日志输出设置 */
  log: Logger
  /** redis client */
  client: RedisClient | undefined
  /** 是否已经初始化 */
  inited: boolean
  /** 初始化 redis */
  init(option: SsrRedisOption): SsrRedisHandle
}

export interface RedisData {
  [key: string]: string
}

export const ssrRedis: SsrRedis = {
  isSupported: true,
  inited: false,
  log: () => {},
  client: undefined,
  init({ port, log }) {
    if (!this.inited) {
      const iPort = port || 6379
      this.client = redis.createClient({ port: iPort })
      this.client.on('ready', () => {
        this.isSupported = true
        log({
          type: LogType.Info,
          path: 'system',
          args: ['redis 准备好了']
        })
      })
      this.client.on('error', (er) => {
        if (`${er?.message}`.indexOf('ECONNREFUSED') !== -1) {
          this.isSupported = false
          log({
            type: LogType.Warn,
            path: 'system',
            args: [`系统 redis 未启动, 端口: ${iPort}`]
          })
        } else {
          log({
            type: LogType.Error,
            path: 'system',
            args: ['redis 发生错误', er]
          })
        }
      })
    }

    this.log = log
    this.inited = true

    return {
      get: <T extends RedisData = {}>(key: string) => {
        return new Promise<T | undefined>((resolve) => {
          if (!this.isSupported) {
            log({
              type: LogType.Warn,
              path: 'system',
              args: [`redis 获取 [${key}] 失败, redis 未启动`]
            })
            resolve(undefined)
          } else if (this.client) {
            this.client.hgetall(key, (err, reply) => {
              if (err) {
                resolve(undefined)
              }
              resolve(reply as T)
            })
          } else {
            log({
              type: LogType.Error,
              path: 'system',
              args: [`redis 获取 [${key}] 失败, this.client 未初始化`]
            })
          }
        })
      },
      set: (key, val) => {
        Object.keys(val).forEach((subKey) => {
          if (!this.isSupported) {
            log({
              type: LogType.Warn,
              path: 'system',
              args: [`redis 设置 [${key}] 失败, redis 未启动`]
            })
          } else if (this.client) {
            this.client.hmset(key, subKey, val[subKey])
          } else {
            log({
              type: LogType.Error,
              path: 'system',
              args: [`redis 设置 [${key}] 失败, this.client 未初始化`]
            })
          }
        })
      },
      end: () => {
        if (this.client) {
          this.client.end()
        }
        this.inited = false
      }
    }
  }
}
