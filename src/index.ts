import { OutgoingMessage, IncomingMessage } from 'http'
import { YylSsr, YylSsrOption } from './yylSsr'
function serveYylSsr<
  O extends OutgoingMessage = OutgoingMessage,
  I extends IncomingMessage = IncomingMessage
>(option: YylSsrOption<O, I>) {
  const ssr = new YylSsr(option)
  return ssr.apply()
}

export default serveYylSsr
