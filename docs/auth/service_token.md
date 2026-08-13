# Service Token 运行机制

## 状态

本文记录当前 service token 的运行机制和调用边界，重点说明调用方如何从 Auth 获取 token、如何缓存和刷新，以及资源服务如何验证 token。

协议层定义见 docs/auth/v2.md。当前 Phoenix 出站客户端是：

    GroupherServer.ServiceAuth.Client

命名变更记录见 docs/auth/service_rename.md。

## 一句话模型

服务之间不直接共享长期密钥，也不把用户 token 当成服务身份。

    调用方子服务
      -> 向 Auth 申请短期 service access JWT
      -> 按目标 resource + scope 缓存 JWT
      -> 携带 JWT 调用目标服务
      -> 目标服务通过 JWKS、本地 audience 和 scope 校验 JWT

Auth 是唯一的 service token 签发方。

## 每次调用都要向 Auth 申请吗？

不需要。

同一个调用方、同一个目标 resource、同一组 scopes，可以复用缓存中的 token：

    第一次调用 Assets Hub
      -> 本地 token cache miss
      -> Phoenix 向 Auth 申请 token
      -> 缓存 token
      -> 调用 Assets Hub

    后续调用 Assets Hub
      -> 本地 token cache hit
      -> 复用 token
      -> 调用 Assets Hub

但是，不同目标服务或不同权限范围不能混用同一个 token：

    Phoenix -> Assets Hub
      resource = https://assets.groupher.com/internal
      scope    = assets:object:delete

    Phoenix -> Press
      resource = https://press.groupher.com/internal
      scope    = press:cache:invalidate

这两组请求的 resource、audience 或 scope 不同，因此使用不同的缓存条目和 token。

缓存逻辑上的 key 是：

    {resource, sorted(scopes)}

scope 排序是为了让同一组 scope 在请求顺序不同时仍然命中同一个 key。

## Phoenix 出站调用链

Phoenix 当前的出站 token 客户端：

    GroupherServer.ServiceAuth.Client.token/2
      -> 读取本地 ETS token cache
      -> 命中且未接近过期
           -> 返回 token
      -> 未命中或接近过期
           -> 按 {resource, scopes} 进入并发锁
           -> 锁内再次检查 ETS
           -> 仍然没有可用 token
           -> POST Auth /oauth2/token
           -> 保存 token 和 expires_at
           -> 返回 token

代码位置：

    backend/main/lib/groupher_server/service_auth/client.ex

配置位置：

    backend/main/config/runtime.exs
      SERVICE_AUTH_TOKEN_ENDPOINT
      SERVICE_AUTH_CLIENT_ID
      SERVICE_AUTH_CLIENT_SECRET

## 一个 token 如何被用于调用其他服务？

以 Assets Hub 为例：

    +---------------------+
    | Phoenix             |
    | CMS.Assets.Deletion |
    +----------+----------+
               |
               | 1. token(resource, scope)
               v
    +---------------------+
    | Phoenix ETS cache   |
    +----------+----------+
               |
               | miss 或即将过期
               v
    +---------------------+       client_credentials       +------------------+
    | Auth                | <----------------------------- | Phoenix          |
    | /oauth2/token       |                                | client_id/secret |
    +----------+----------+                                +------------------+
               |
               | 2. 短期 service access JWT
               v
    +---------------------+
    | Phoenix             |
    +----------+----------+
               |
               | 3. Authorization: Bearer <JWT>
               |    POST /internal/assets/delete
               v
    +---------------------+
    | Assets Hub          |
    | 资源服务             |
    +---------------------+
               |
               | 4. 本地 JWKS 验签
               |    检查 issuer / audience / scope / subject
               v
           接受或拒绝请求

Phoenix 取得 token 后，真正发送内部请求的是业务模块：

    CMS.Assets.Deletion
      -> ServiceAuth.Client.token/2
      -> POST Assets Hub /internal/assets/delete

    CMS.Press.invalidate/1
      -> ServiceAuth.Client.token/2
      -> POST Press /internal/invalidate

Token client 只负责拿凭证，不负责目标服务的业务请求。

## Token 的身份含义

service token 表示：

    哪个子服务正在调用哪个目标服务，以及它被授予了哪些操作权限

典型 claims：

    sub   = service:phoenix
    aud   = assets-hub:internal-api
    scope = assets:object:delete
    iss   = Auth issuer
    exp   = token 过期时间
    jti   = token 唯一标识

它不是：

    用户登录 token
    浏览器 session
    当前用户的 Passport 权限

如果一个服务代表用户调用 Phoenix，需要同时携带：

    service token
      = 哪个子服务在调用

    x-groupher-user-authorization
      = 该子服务代表哪个用户

服务身份和用户身份是两条独立链路，不能用 service token 代替用户授权。

## Token 什么时候刷新？

Phoenix 不会把刷新时间写死成“每 30 分钟”。

Auth 返回：

    access_token = ...
    expires_in   = 600
    token_type   = Bearer

Phoenix 根据实际的 expires_in 计算过期时间：

    expires_at = acquired_at + expires_in

当前 Phoenix client 使用 30 秒 refresh skew：

    expires_at - 30 秒 > 当前时间
      -> 继续复用 token

    expires_at - 30 秒 <= 当前时间
      -> 重新向 Auth 申请 token

因此，如果 Auth 返回 expires_in = 1800：

    token 有效期约 30 分钟
    大约在到期前 30 秒刷新

如果 Auth 返回其他有效期，Phoenix 会按返回值计算。30 秒是提前刷新量，不是 token 的固定生命周期。

当前 Auth 服务的默认 service token TTL 配置为 10 分钟，并有 15 分钟上限；实际行为仍以 Auth 部署配置和返回的 expires_in 为准。

## 并发刷新如何避免重复申请？

多个请求同时发现 token miss 或接近过期时，不应该让每个请求都打 Auth：

    请求 A ─┐
    请求 B ─┼─ 同一个 {resource, scopes}
    请求 C ─┘

Phoenix 当前的处理：

    请求 A
      -> ETS miss
      -> 获得 :global.trans 锁
      -> 锁内再次检查 ETS
      -> 向 Auth 申请新 token
      -> 写入 ETS
      -> 释放锁

    请求 B/C
      -> ETS miss
      -> 等待同一个 :global.trans 锁
      -> 获得锁后再次检查 ETS
      -> 命中 A 写入的新 token
      -> 直接复用，不再请求 Auth

关键是锁内的第二次检查。没有第二次检查时，排队请求拿到锁后仍然会重复申请 token。

## Token 请求失败和下游 401

当前机制需要区分三种情况：

    情况 A：token 正常接近过期
      -> 提前刷新
      -> 使用新 token 调用下游

    情况 B：向 Auth 申请 token 失败
      -> 返回 :service_token_unavailable
      -> 当前 Phoenix client 不自动重试 Auth 请求

    情况 C：下游服务返回 401
      -> 当前 Phoenix 业务调用不会统一清除 token 并自动重试一次
      -> 错误直接由业务调用方处理

当前 Auth token 请求明确配置 retry: false。

因此目前具备：

    预防性刷新        有
    并发刷新合并      有
    Auth 请求自动重试  无
    下游 401 自动重试  无

不能把所有下游 401 都当成 token 过期。401 也可能由以下原因造成：

    client credential 配置错误
    issuer 不匹配
    audience 不匹配
    scope 未授予
    subject 不被目标服务允许
    JWT 签名或 JWKS 问题

如果未来增加重试，边界应当是“一次、带条件”的：

    下游返回明确的 token 失效 401
      -> 删除 {resource, scopes} 对应缓存
      -> 重新向 Auth 申请 token
      -> 原请求最多重试一次
      -> 仍失败则返回错误

不能对所有 401 无条件重试，也不能无限重试。

## 其他子服务是否也向 Auth 申请？

是，但是否申请取决于它是否需要发起出站的受保护请求。

    需要调用其他内部服务
      -> 需要 ServiceAuthClient
      -> 向 Auth /oauth2/token 申请自己的 service token

    只提供内部 API
      -> 需要 ServiceAuthVerifier
      -> 验证调用方发来的 service token

    既调用别人又提供 API
      -> 两者都需要

当前实现分布：

    Phoenix
      -> Elixir GroupherServer.ServiceAuth.Client
      -> 申请 token 并缓存

    Dashboard
    Content Import
    Assets Hub
    Press
      -> @groupher/service/auth
      -> 共用 TypeScript provider/verifier

TypeScript provider 的并发模型也是按请求 key 复用 token，并用 inflight promise 合并同一 key 的并发申请：

    getToken(request)
      -> Map cache hit
      -> 返回已有 token
      -> cache miss 或接近过期
      -> 检查 inflight[key]
      -> 已有请求：等待同一个 Promise
      -> 没有请求：acquire 一次

因此共同的协议模型是：

    Auth
      -> 唯一签发方

    Provider / TokenClient
      -> 调用方申请、缓存、刷新 token

    Verifier
      -> 目标服务本地验签和检查权限

## 目标服务为什么会拒绝没有 token 的请求？

只要目标内部入口启用了 service-token 校验，请求必须带有效 token。

目标服务通常会检查：

    是否存在 Bearer token
    JWT 类型是否为 service_access+jwt
    issuer 是否可信
    签名是否能通过 Auth JWKS 验证
    audience 是否是当前服务
    scope 是否覆盖当前操作
    subject 是否是允许的调用服务
    token 是否过期

例如 Assets Hub 的删除入口要求：

    subject  = service:phoenix
    audience = assets-hub:internal-api
    scope    = assets:object:delete

缺少 token、token 过期、audience 错误或 scope 错误都会拒绝；这不是因为“每次调用都必须重新申请”，而是因为每次调用都必须携带一个当前有效且适用于目标操作的 token。

## 总结图

                              +----------------------+
                              | Auth                 |
                              | 唯一 token issuer    |
                              | /oauth2/token        |
                              | /.well-known/jwks    |
                              +----------+-----------+
                                         |
                     client_credentials  | 申请短期 JWT
                                         |
           +-----------------------------+-----------------------------+
           |                             |                             |
           v                             v                             v
    +--------------+             +--------------+              +--------------+
    | Phoenix      |             | Dashboard    |              | Content      |
    | TokenClient  |             | TS Provider  |              | Import       |
    | ETS cache    |             | Map cache    |              | TS Provider  |
    +------+-------+             +------+-------+              +------+-------+
           |                            |                             |
           | Bearer JWT                 | Bearer JWT                   | Bearer JWT
           v                            v                             v
    +--------------+             +--------------+              +--------------+
    | Assets Hub   |             | Phoenix      |              | Phoenix      |
    | Verifier     |             | Verifier     |              | Verifier     |
    +--------------+             +--------------+              +--------------+
           |
           +--> Press / other protected internal services
                 each resource server verifies locally

规则：

1. 同一 resource + scope 在有效期内复用 token。
2. 不同 resource 或 scope 使用不同 token。
3. 接近过期时提前刷新，不是每次请求都刷新。
4. 同一 key 的并发 miss 只允许一个申请请求。
5. 当前没有 Auth 失败自动重试，也没有下游 401 统一自动重试。
6. token 是服务身份；用户授权需要单独携带。
