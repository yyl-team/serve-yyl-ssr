/** 日志-接收函数 */
export type Logger = (props: LoggerProps) => void

/** 日志-类型 */
export enum LogType {
  Info = 'info',
  Error = 'error',
  Warn = 'warn'
}

/** 日志-参数 */
interface LoggerProps {
  /** 类型 */
  type: LogType
  /** 请求url */
  path: string
  /** 参数 */
  args: any[]
}
