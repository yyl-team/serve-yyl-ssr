/// <reference types="node" />
import { IncomingMessage, OutgoingMessage } from 'http';
/** 日志-接收函数 */
export declare type Logger = (props: LoggerProps) => void;
/** 日志-类型 */
export declare enum LogType {
    Info = "info",
    Error = "error",
    Warn = "warn"
}
/** 日志-参数 */
export interface LoggerProps {
    /** 类型 */
    type: LogType;
    /** 请求url */
    path: string;
    /** 参数 */
    args: any[];
}
export interface Res extends OutgoingMessage {
    send(ctx: string): void;
}
export interface Req extends IncomingMessage {
    url: string;
}
