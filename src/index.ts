import { Req, Res } from './types'
import { YylSsr, YylSsrOption } from './yylSsr'
export { ssrRedis } from './redis'
export function serveYylSsr<O extends Res = Res, I extends Req = Req>(option: YylSsrOption<O, I>) {
  const ssr = new YylSsr(option)
  return ssr.apply()
}
