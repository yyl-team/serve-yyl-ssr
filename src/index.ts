import { Req, Res } from './types'
import { YylSsr, YylSsrOption } from './yylSsr'
export * from './yylSsr'
export * from './redis'
export * from './types'
export function serveYylSsr<O extends Res = Res, I extends Req = Req>(option: YylSsrOption<O, I>) {
  const ssr = new YylSsr(option)
  return ssr.apply()
}
