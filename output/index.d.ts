import { Req, Res } from './types';
import { YylSsrOption } from './yylSsr';
export * from './yylSsr';
export * from './redis';
export * from './types';
export declare function serveYylSsr<O extends Res = Res, I extends Req = Req>(option: YylSsrOption<O, I>): (req: I, res: O, next: import("./yylSsr").NextFunction) => void;
