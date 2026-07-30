# 子应用地址配置

> 状态：架构约定
>
> 适用范围：Dashboard、Gateway、Node 子应用、Python 子应用和 Phoenix internal API

## 原则

- 业务代码不能硬编码 `127.0.0.1`、端口或 `.localhost` 域名。
- 调用方只读取语义化 endpoint 环境变量；本地端口由 Dev Hub 集中注入。
- 生产、Preview 和本地使用同一组变量名，只是变量值不同。
- 面向浏览器的 public endpoint 使用 `NEXT_PUBLIC_*` 或同源相对路径。
- 服务间 endpoint 使用服务名命名，避免泛名在多个运行时里语义漂移。

## 命名

| 变量                                                                       | 含义                                           | 示例                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| `CONTENT_IMPORT_APP_ENDPOINT`                                              | Dashboard 调用 content-import 的服务根地址     | `https://content-import.groupher.com` |
| `NEXT_PUBLIC_ASSETS_HUB_ENDPOINT`                                          | Dashboard 浏览器调用 assets-hub 的服务根地址   | `https://assets-hub.groupher.com`     |
| `DOCUMENT_CONVERTER_APP_ENDPOINT`                                          | 调用 document-converter 的服务根地址           | `https://converter.groupher.com`      |
| `PHOENIX_GRAPHQL_ENDPOINT`                                                 | 子应用调用 Phoenix GraphQL 的内部地址          | `https://api.groupher.com/graphiql`   |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT`                                             | 浏览器 GraphQL 地址，通常应为 Gateway 同源路径 | `/api/graphql`                        |
| `LANDING_SITE` / `MAIN_SITE` / `DASHBOARD_SITE` / `AUTH_SITE` / `API_SITE` | Gateway 后端路由目标                           | 部署平台注入的服务 URL                |

`GRAPHQL_ENDPOINT` 和 `DOCUMENT_CONVERTER_URL` 属于旧的泛名。新子应用不能继续新增
或映射这些名字；保留它们的旧应用需要在迁移到语义化 endpoint 时单独清理。

## 本地

Dev Hub 在 `local/dev-hub/src/server/service-endpoints.ts` 集中定义本地 listener
endpoint，并在启动各服务时注入对应 env。其他模块不能重新写一份端口表。

Portless 仍然负责人类可见的本地域名，例如
`https://content-import.groupher.localhost`。服务间调用首期可以继续使用 Dev Hub
listener endpoint；是否改走 Portless 域名取决于各运行时是否统一信任本地 CA。

## 生产

生产环境不使用 Dev Hub endpoint 表。每个服务由部署平台或 secret/config 管理系统
注入相同变量名，但值指向生产域名或内部 service discovery 地址。

例如：

```text
CONTENT_IMPORT_APP_ENDPOINT=https://content-import.groupher.com
NEXT_PUBLIC_ASSETS_HUB_ENDPOINT=https://assets-hub.groupher.com
DOCUMENT_CONVERTER_APP_ENDPOINT=https://converter.groupher.com
PHOENIX_GRAPHQL_ENDPOINT=https://api.groupher.com/graphiql
```

后续接入 delegation token 时，只改变鉴权凭证，不改变这些 endpoint 的命名。
