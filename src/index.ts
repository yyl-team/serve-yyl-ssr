import { Req, Res } from './types'
import { YylSsr, YylSsrOption } from './yylSsr'
function serveYylSsr<O extends Res = Res, I extends Req = Req>(option: YylSsrOption<O, I>) {
  const ssr = new YylSsr(option)
  return ssr.apply()
}

export default serveYylSsr
