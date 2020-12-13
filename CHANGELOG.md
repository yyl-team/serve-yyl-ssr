# 版本信息

## 0.3.5 (2020-12-13)

- feat: 新增 `option.cacheType` 属性

## 0.3.4 (2020-12-02)

- feat: 兼容 `a?asdf` 带 ? 的请求

## 0.3.3 (2020-11-26)

- feat: 优化 render 部分逻辑

## 0.3.2 (2020-11-23)

- feat: 缓存失效时间 bugfix

## 0.3.1 (2020-11-23)

- feat: 输出 types

## 0.3.0 (2020-11-23)

- feat: 引入 redis 处理缓存

## 0.2.1 (2020-11-17)

- feat: 调整 logger 参数

## 0.2.0 (2020-11-17)

- feat: 调整 logger 参数

## 0.1.5 (2020-11-05)

- fix: 修复 serveYylSsr({}) 对于 `path/to/a.html?asdf` 不命中问题

## 0.1.4 (2020-10-22)

- fix: 修复 serveYylSsr({ cacheExpire }) cacheExpire 为 0 时报错的问题

## 0.1.3 (2020-10-22)

- feat: serveYylSsr({ render }) render 补充 error 的返回类型处理

## 0.1.2 (2020-10-20)

- feat: 调整 types

## 0.1.1 (2020-10-20)

- feat: 兼容 url 上带有 `?` `#` `&` 的处理
- feat: 补充 读取缓存， 读取 html 的 区别 log
- feat: 补充 `option.cacheLimit` 缓存长度限制

## 0.1.0 (2020-10-20)

- feat: 诞生
