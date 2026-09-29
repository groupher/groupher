# 删除 `graphql-request`：前端 GraphQL Transport 收敛方案

> 状态：已实施并验证
>
> 记录日期：2026-09-03
>
> 影响范围：`frontend/core` 的浏览器 GraphQL transport，以及消费它的 Community、Dash

## 结论

前端运行时依赖 `graphql-request` 已删除，浏览器 GraphQL transport 收敛为原生 `fetch` 实现的
`browserGraphQLRequest()`。

TanStack Query 已负责查询结果缓存、并发去重、stale/GC、重新获取、网络错误重试和 SSR
hydration。Groupher 自己的 `createAuthFetch()` 已负责登录态判断、token refresh 和原请求重放。
当前只缺一层很薄的 GraphQL HTTP transport，不需要再引入一个 GraphQL client。

本方案只删除 `graphql-request`，不删除 `graphql`。生成的 `TypedDocumentNode` 仍需要
`graphql.print()` 序列化为请求字符串。

## 移除前的调用链

```text
TanStack Query queryFn / imperative mutation
  -> browserGraphQLRequest(document, variables, options)
  -> new GraphQLClient(...).rawRequest(...)
  -> createAuthFetch(...)
  -> fetch('/api/graphql')
  -> Community/Dash same-origin GraphQL facade
  -> Phoenix GraphQL
```

移除前，`browserGraphQLRequest()` 每次调用都会创建一个新的 `GraphQLClient`。调用方传入的
`DocumentNode` 又会先被 `print()` 成字符串，随后 `graphql-request` 为了识别 operation name
和 query/mutation，再用 GraphQL parser 解析这段字符串。

Groupher 始终显式使用 `POST`，也没有消费 operation name，因此这次二次解析没有业务价值，
却把 parser、lexer 和 `graphql-request` transport runtime 带入默认浏览路径。

## 职责边界

| 能力 | 责任方 | `graphql-request` 是否必要 |
| --- | --- | --- |
| 查询结果缓存与并发去重 | TanStack Query | 否 |
| `staleTime`、GC、失焦重取 | TanStack Query | 否 |
| 查询网络错误重试 | TanStack Query `QueryClient` policy | 否 |
| mutation 是否重试 | TanStack Query，当前为不重试 | 否 |
| SSR dehydration/hydration | TanStack Query | 否 |
| Cookie、CSRF header | `GRAPHQL_FETCH_OPTIONS()` | 否 |
| token refresh 与单次 replay | `createAuthFetch()` / `withAuthRetry()` | 否 |
| 请求取消 | 原生 `fetch` 的 `AbortSignal` | 否 |
| Typed document 类型 | GraphQL Codegen / `TypedDocumentNode` | 否 |
| AST 序列化 | `graphql.print()` | 否 |
| GraphQL response/error 解码 | 小型本地 transport | 否 |

`graphql-request` 可以提供 batch request、GET query、request/response middleware、动态 headers、
自定义 JSON serializer 和多种 error policy。当前 Groupher 浏览器调用没有使用这些能力。
`graphql-request` 也不提供 TanStack Query 意义上的结果缓存。

## Bundle 证据

本文的体积统一使用原始字节（`B`）作为验收口径；同时出现的 `KB` 均为十进制换算，
即 `1 KB = 1,000 B`，不使用 `KiB`。

以 2026-08-27 的 `79d795a94` 为 V2 基准，并对 2026-09-03 当前实现执行 production build、
source-map 归属分析和临时 A/B 构建：

| 指标 | 移除前 | 临时 A/B | 最终实现 |
| --- | ---: | ---: | ---: |
| Community 全部 client assets gzip | 992,357 B | 983,417 B | 983,580 B |
| 相对移除前变化 | - | **-8,940 B** | **-8,777 B** |

A/B 只替换 `browserGraphQLRequest()` 内部 transport，其余源码和依赖版本保持一致。最终实现
还包含 `GraphQLResponseError`、运行时 envelope 校验和错误上下文保留，因此比最小 A/B 多
`163 B gzip`。最终减少量集中在默认加载的 query chunk，主要来自 GraphQL parser/lexer 和
`graphql-request` request runtime。

`/home/post` 当前 root preload 的 JS+CSS 为 `376,055 B gzip`。如果 A/B 的 `8,940 B`
减少量 100% 落在该页面 root preload 的 query chunk，且删除依赖没有触发新的分块扰动，
则页面体积的推算为：

```text
当前 /home/post root preload       376,055 B
graphql-request A/B 减少量          -8,940 B
-------------------------------------------
推算 root preload                  367,115 B = 367.115 KB
V2 基准                            390,814 B
推算相对 V2 累计变化                -23,699 B = -23.699 KB
```

这里的“全部减少量都进入 root preload”是实施前的估算假设。完成实现后，以当前本地 Phoenix
schema 和已执行 migration 的 production Worker 请求 `/home/post`，页面返回 200；浏览器实际
加载的 30 个 root JS 和 1 个 CSS 均返回 200。最终结果为：

```text
移除前 /home/post root preload     376,055 B
最终 root preload                  367,345 B = 367.345 KB
实际变化                            -8,710 B = -8.710 KB
实施前推算                         367,115 B
实测与推算差异                         +230 B
V2 基准                            390,814 B
实测相对 V2 累计变化                -23,469 B = -23.469 KB
```

页面 hydration 仍会暴露一个既存的 wallpaper-null 错误，favicon 请求也为 404；它们不影响上述
root resource 计数，也不属于 GraphQL transport 删除范围。

这也解释了 `cnfast` 数字与页面净变化的关系：

```text
V2 /home/post JS+CSS              390,814 B
useTwBelt/cnfast                  -15,760 B
graphql-request                    +8,940 B
其余变化合计                       -7,939 B
-------------------------------------------
当前 /home/post JS+CSS            376,055 B
净变化                            -14,759 B
```

单个 chunk 的减少不能直接等同于页面总量；页面最终结果还会受实际资源可达性和重新分块影响。

## 替换后的 transport 契约

`browserGraphQLRequest()` 继续作为唯一公共入口，不允许调用方散落地直接拼装 GraphQL
`fetch`。内部原生 transport 必须保持以下行为：

1. 请求 same-origin `API_ROUTE.GRAPHQL`，使用 `POST`。
2. 保留 `credentials: 'include'`、CSRF header 和 `cache: 'no-store'`。
3. 将 `DocumentNode`/`TypedDocumentNode` 通过 `print()` 转为字符串，并序列化
   `{ query, variables }`。
4. 将调用方的 `AbortSignal` 原样传给 `fetch`。
5. 所有请求继续经过 `createAuthFetch()`，保持一次 refresh 和一次 replay。
6. `fetch()` 在收到 `Response` 前失败时，保留原始 `TypeError`；这是当前 query policy 唯一会
   自动重试的错误类别。
7. 非 2xx 响应和 GraphQL `errors` 继续抛出 `GraphQLRequestError`，不进入 query 网络重试。
8. 2xx 非法 JSON 或缺少 `data` 属于响应解码/协议错误，抛出独立的
   `GraphQLResponseError`。它不继承 `GraphQLRequestError`，避免调用方把没有 GraphQL
   `errors` 数组的解码错误误当成业务错误展示；它也不伪装成可重试网络错误。
9. `GraphQLRequestError` 保留 GraphQL `errors`、原始 `Response` 和结构化 changeset message；
   `GraphQLResponseError` 保留原始 `Response` 及可用的 cause/payload。
10. 使用 `payload.data === undefined` 判断字段缺失，允许合法的顶层 `data: null`。

Community 和 Dash 的 server-side fetcher 已经使用相同的最小 wire body：
`{ query, variables }`，没有发送 `operationName`。浏览器 transport 沿用该生产路径的请求格式，
不会引入新的服务端协议形态。

## 错误分类与重试语义

当前 `QueryClient` 并不是“除 GraphQL 错误外全部重试”，而是只重试 `TypeError`：当
`failureCount >= 2`，或错误是 `GraphQLRequestError` 时立即停止；其余错误也只有
`error instanceof TypeError` 才允许重试。因此，当前 2xx + 非法 JSON 由
`GraphQLClient.rawRequest()` 抛出的裸 `SyntaxError` **同样不会重试**。

替换后必须保持这条语义边界：

| 失败类型 | 当前外部错误 | 替换后错误 | Query 自动重试 |
| --- | --- | --- | --- |
| `fetch()` reject，尚未收到响应 | 通常为 `TypeError` | 保留原始 `TypeError` | 是，直到现有 policy 上限 |
| HTTP 非 2xx | `ClientError` 被映射为 `GraphQLRequestError` | `GraphQLRequestError` | 否 |
| 2xx + GraphQL `errors` | `ClientError` 被映射为 `GraphQLRequestError` | `GraphQLRequestError` | 否 |
| 2xx + 非法 JSON | 裸 `SyntaxError` | `GraphQLResponseError` | 否 |
| 2xx + 缺少 `data` 和 `errors` | transport 返回 `undefined`；query-core 再抛通用错误 | `GraphQLResponseError` | 否 |

这里把“传输失败”限定为尚未收到 HTTP 响应的 `fetch` reject。HTTP 状态失败、JSON 解码失败和
GraphQL envelope 不完整都说明服务端已经产生了响应，不能通过继承 `TypeError` 意外进入网络
重试。新增测试必须与 `queryClient.ts` 的 policy 联动，验证网络 `TypeError` 会重试，而
`GraphQLRequestError` 和 `GraphQLResponseError` 都不会重试。

## 有意的行为收紧

删除依赖本身不要求改变 GraphQL 成功响应语义。`{ errors }` 在当前实现中已经会抛错，替换后
只是本地重现该行为；真正的新行为发生在 2xx + `{}`：

- mutation 或 imperative 调用今天会直接收到 `undefined`，替换后改为明确的
  `GraphQLResponseError`；
- query 调用今天会先收到 `undefined`，随后由 TanStack Query 5.102.8 的 query-core 抛出
  `<queryHash> data is undefined`。替换后错误会在 transport 层提前成为携带原始 `Response`
  及 cause/payload 的 `GraphQLResponseError`。

这是本方案有意接受的行为变更。它避免 Query 层只能提供缺乏响应上下文的通用错误，同时让
mutation 和 imperative 路径不再静默吞掉 `undefined`。它可能更早暴露服务端或代理返回的不完整
GraphQL envelope；这种暴露是预期结果，而不是 transport 兼容性回归。

原生 `fetch` 不应额外实现 TanStack Query 已拥有的结果缓存、请求去重或通用网络重试。
鉴权 replay 仍属于 transport，因为它发生在单次逻辑 GraphQL operation 内。

## 已完成的实施

1. 已将 `frontend/core/lib/graphql/client.ts` 中的 `GraphQLClient.rawRequest()` 替换为原生
   `fetch` 请求与本地响应解析。
2. 已增加独立的 `GraphQLResponseError`，明确承载 JSON 解码失败和 GraphQL envelope 缺失；
   它不得继承 `GraphQLRequestError`。
3. 已删除 `ClientError`、`GraphQLClient` import。
4. 已从根 `package.json` 删除 `graphql-request` 并更新 `pnpm-lock.yaml`。
5. 保留了 `graphql` 和 `@graphql-typed-document-node/core`。
6. 已扩充 transport tests 和 QueryClient retry policy 联动测试，并完成共享前端验证。

## 测试矩阵

现有测试必须继续通过：

- 成功返回 typed data；
- `AbortSignal` 透传；
- token 过期后 refresh 一次并 replay 一次；
- permission failure 不 refresh；
- signed-in hint 下缺失 token 时 refresh；
- nullable public `me` 不触发 refresh；
- GraphQL business error 抛出 `GraphQLRequestError`；
- 结构化 changeset message 不被折叠。

新增测试：

- 非 2xx 且 body 包含 GraphQL errors → `GraphQLRequestError`；
- 非 2xx 且 body 不是合法 JSON → `GraphQLRequestError`；
- 2xx 但 body 不是合法 JSON → `GraphQLResponseError`；
- 2xx 但缺少 `data` → `GraphQLResponseError`；
- `data: null` 被视为合法 GraphQL data；
- refresh replay 后仍失败时保留最终 `Response` 和 errors；
- query 文本和 variables 被准确序列化；
- CSRF、credentials、`cache: 'no-store'` 均未丢失；
- QueryClient 对网络 `TypeError` 按当前上限重试；
- QueryClient 对 `GraphQLRequestError` 和 `GraphQLResponseError` 均不重试；
- `GraphQLResponseError` 不是 `GraphQLRequestError` 的实例。

## 验证结果

- Core 聚焦测试：2 个文件、21 项通过；
- Core 全量测试：185 个文件、749 项通过；
- Core、Community、Dash type-check 通过；
- Community、Dash production build 通过；
- 文档覆盖检查通过；
- 仓库源码、`package.json`、`pnpm-lock.yaml` 和最终 client assets 均不再包含
  `graphql-request` / `GraphQLClient`；
- Community 全部 client assets 为 `983,580 B gzip`，比移除前减少 `8,777 B`；
- `/home/post` 浏览器实测 root JS+CSS 为 `367,345 B gzip`，比移除前减少 `8,710 B`。

## 验收

- 仓库生产代码和 `package.json` 不再引用 `graphql-request`；
- Core GraphQL transport 测试全部通过；
- QueryClient retry policy 与 transport error taxonomy 的联动测试通过；
- Core、Community、Dash type-check 通过；
- Community、Dash production build 通过；
- 使用当前 Phoenix schema 和 migration 实测 Community `/home/post` production Worker；
- Community root preload 不包含 GraphQL parser/lexer；
- 同口径 Community client assets 至少减少 `8.5 KB gzip`；
- 重新记录 `/home/post` 200 页面实际引用的 JS+CSS，不用推算值替代最终结果。

## 非目标

- 不改变 TanStack Query 的 query key、缓存时间或重试策略；
- 除“缺少 `data` 和 `errors` 时由 transport 抛出结构化错误”外，不改变现有错误与成功语义；
- 不改变 GraphQL schema、Codegen 输出或 Phoenix API；
- 不合并 Community/Dash 的 server-side GraphQL fetcher；
- 不在本次工作中继续处理 wallpaper renderer 的全量构建可达性；
- 不删除 `graphql`，只删除 `graphql-request`。
