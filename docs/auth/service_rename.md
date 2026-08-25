# ServiceAuth 模块重命名与调用链

## 状态

已执行。本文保留旧名到新名的映射、调用链和迁移风险，作为后续维护的边界说明。

## 结论

本次变更前，Phoenix 出站客户端、Phoenix 入站验证器、Dashboard helper 和 Auth issuer 文件使用的是旧的身份命名；这些旧名称已从代码中移除。

Phoenix 出站客户端的实际职责是向 Auth 申请短期 service access token，并按 resource/scope 缓存；它不负责验证身份。

已统一为：

    GroupherServer.ServiceAuth.Client
    GroupherServerWeb.ServiceAuth.Verifier

命名原则：

    ServiceAuth
      -> 整套服务间认证协议

    Client
      -> 出站：向 Auth 申请并缓存 service token

    Verifier
      -> 入站：验证其他服务携带的 service token

这种命名比把 Client/Verifier 放在 ServiceToken 下更能表达完整协议边界，也让两端形成同族名称。

## 变更前后命名映射

| 变更前职责 | 变更后命名或概念 |
| --- | --- |
| Phoenix 出站 token client | `GroupherServer.ServiceAuth.Client` |
| Phoenix 入站 service token verifier | `GroupherServerWeb.ServiceAuth.Verifier` |
| TypeScript token client 工厂与类型 | `createServiceAuthClient`、`TServiceAuthClient` |
| TypeScript token verifier 工厂与类型 | `createServiceAuthVerifier`、`TServiceAuthVerifier` |
| Dashboard service-auth helper | `frontend/dashboard/src/lib/serviceAuth.ts` |
| Auth issuer 文件 | `backend/auth/src/service-auth.ts` |

TypeScript 侧的变更前导出：

    createServiceTokenProvider
    createServiceTokenVerifier
    TServiceTokenProvider
    TServiceTokenVerifier

变更后统一为：

    createServiceAuthClient
    createServiceAuthClientFromEnv
    createServiceAuthVerifier
    TServiceAuthClient
    TServiceAuthVerifier

## 当前三类角色

    +-----------------------------+
    | Auth                         |
    | ServiceAuth.Issuer           |
    | 唯一签发 service JWT          |
    +--------------+--------------+
                   |
                   | client_credentials
                   v
    +-----------------------------+
    | 调用方子服务                  |
    | ServiceAuth.Client            |
    | 申请、缓存、刷新 token         |
    +--------------+--------------+
                   |
                   | Authorization: Bearer JWT
                   v
    +-----------------------------+
    | 目标资源服务                  |
    | ServiceAuth.Verifier          |
    | JWKS 验签 + audience/scope     |
    +-----------------------------+

当前仓库的实现分布：

| 模块 | 方向 | 职责 |
| --- | --- | --- |
| GroupherServer.ServiceAuth.Client | Phoenix 出站 | 向 Auth 申请 service access JWT，并按 resource/scope 缓存 |
| GroupherServerWeb.ServiceAuth.Verifier | Phoenix 入站 | 验证其他服务发来的 service access JWT |
| @groupher/service/auth | 多个 TypeScript 服务 | 提供 token client/verifier 的工厂与类型 |

## Phoenix 出站：调用 Assets Hub

直接入口：

    backend/api/lib/groupher_server/cms/assets/deletion.ex

    CMS.Assets.Deletion.enqueue/1
      -> safe_enqueue/1
      -> do_enqueue/1
      -> ServiceAuth.Client.token/2
           resource = https://assets.groupher.com/internal
           scope    = assets:object:delete
      -> POST Auth /oauth2/token
      -> 获得 service access JWT
      -> POST Assets Hub /internal/assets/delete
      -> Assets Hub authorizeInternalRequest/2
      -> createServiceAuthVerifier/1
      -> verifier.verify/2
      -> 校验 audience + scope + subject
      -> 执行删除任务

Assets Hub 当前要求：

    subject  = service:phoenix
    audience = assets-hub:internal-api
    scope    = assets:object:delete

角色关系：

    Phoenix 是调用方
    Assets Hub 是被调用方
    Auth 是 token 签发方

## Phoenix 出站：通知 Press

直接入口：

    backend/api/lib/groupher_server/cms/press.ex

    CMS.Press.invalidate/1
      -> ServiceAuth.Client.token/2
           resource = System.get_env("PRESS_INTERNAL_RESOURCE")
                       || "https://press.groupher.com/internal"
           scope    = press:cache:invalidate
      -> POST Press /internal/invalidate
      -> Press serviceTokenVerifier.verify/2
      -> 校验 service token
      -> Press 清理对应 community cache

Press 的 resource 有默认值，但允许通过 PRESS_INTERNAL_RESOURCE 覆盖；不能把默认值写成固定协议事实。

## Phoenix 入站：接收其他服务请求

直接入口：

    backend/api/lib/groupher_server_web/context.ex

    HTTP request
      -> GroupherServerWeb.Context.call/2
      -> build_context/1
      -> authorize_context/3
      -> maybe_bind_delegated_actor/1
      -> Resolver / GraphQL middleware

authorize_context/3 的分支：

    Authorization: Bearer <service JWT>
      -> ServiceAuth.Verifier.service_token?/1
      -> ServiceAuth.Verifier.verify/1
      -> JWKS 校验 JWT 签名
      -> 写入 context.service_actor
      -> maybe_put_delegated_user/2

    Authorization: Bearer <user JWT>
      -> authorize_user_context/2
      -> 写入 context.cur_user

    service actor + cur_user
      -> maybe_bind_delegated_actor/1
      -> 写入 context.delegated_actor
      -> DelegatedScope

注意：当前 `get_token_from/1` 优先读取 `groupher-auth.token` cookie；只有没有该 cookie 时才读取 `Authorization` header。这不是并行合并两种身份：如果请求带有 cookie，Authorization 里的 service token 会被完全忽略，请求会降级成浏览器用户请求，不会产生 `service_actor`。因此排查“service 请求为什么变成了用户请求”时，应先检查是否意外携带了 `groupher-auth.token` cookie。

service token + 用户身份的实际组合通常是：请求不带浏览器 cookie，同时携带 service token 和 `x-groupher-user-authorization`。

入站实现模块当前是：

    backend/api/lib/groupher_server_web/service_auth/verifier.ex

目标命名：

    backend/api/lib/groupher_server_web/service_auth/verifier.ex

它与出站 Client 对称：

    ServiceAuth.Client
      -> 出站：申请 token

    ServiceAuth.Verifier
      -> 入站：验证 token

## Dashboard 调用 Phoenix

Dashboard 目前不使用 Elixir 的 Phoenix 出站 Client，而使用 TypeScript shared package。

入口：

    frontend/dashboard/src/lib/groupherGraphql.ts

    requestGroupherGraphQL/3
      -> dashboardToPhoenixHeaders/2
      -> serviceToken/2
      -> 惰性初始化 provider（首次调用）
      -> provider.getToken/1
      -> Map cache hit / inflight hit / acquire/1
      -> POST Auth /oauth2/token
      -> Authorization: Bearer <service token>
      -> x-groupher-user-authorization: Bearer <user token>
      -> Phoenix Context
      -> ServiceAuth.Verifier
      -> DelegatedScope / ServiceScope
      -> GraphQL resolver

当前 TypeScript 代码位置：

    frontend/dashboard/src/lib/serviceAuth.ts
    packages/service/auth/index.ts

`createServiceAuthClientFromEnv/0` 是 `serviceToken/2` 内部的惰性单例工厂，不是每次 Dashboard 请求都会重新创建 client。

当前 shared package 实际导出：

    createServiceAuthClient
    createServiceAuthClientFromEnv
    createServiceAuthVerifier
    TServiceAuthClient
    TServiceAuthVerifier

## Auth 签发链

Auth 是 Groupher service token 的唯一签发方。

入口：

    backend/auth/src/app.ts

    POST /oauth2/token
      -> issueServiceToken/2
      -> readServiceAuthConfig/1
      -> 读取 SERVICE_AUTH_CLIENTS_JSON
      -> 校验 Basic client credentials
      -> 校验 resource 是否注册
      -> 映射 resource -> audience
      -> 校验 client allowedAudiences
      -> 校验 requested scopes
      -> 签发 RS256 JWT
      -> subject = service:<serviceName>
      -> audience = 目标服务 audience
      -> scope = 被批准的 scopes
      -> expires_in = 配置的 TTL

Auth 内部的签发角色（概念名）为：

    backend/auth/src/service-auth.ts
      -> ServiceAuth.Issuer

Auth 侧本次只重命名文件/模块边界；`issueServiceToken/2`、`readServiceAuthConfig/1`、`serviceJwks/1` 等函数名保持职责不变。

它与下面的 shared package 需要区分：

    backend/auth/src/service-auth.ts
      -> Auth 服务内部，读取 client registry、签发 JWT、暴露 JWKS

    packages/service/auth/index.ts
      -> 其他 TypeScript 服务共享的 token client/verifier 工具

两者虽然都属于 service auth，目录和方向不同，没有模块冲突。

相关 endpoint：

    GET /.well-known/jwks.json
    POST /oauth2/token

Phoenix 出站 Client 配置在：

    backend/api/config/runtime.exs

    SERVICE_AUTH_TOKEN_ENDPOINT
    SERVICE_AUTH_CLIENT_ID
    SERVICE_AUTH_CLIENT_SECRET

## subject 校验层级

不同资源服务的 subject 策略并不完全相同：

    Phoenix 入站：
      sub 只要求 service: 前缀
      然后检查 issuer + audience + scope + JWT claims

    Assets Hub 删除入口：
      额外要求 sub == service:phoenix
      同时检查 audience + scope

这不是同一层面的矛盾：

    通用 ServiceAuth.Verifier
      -> 验证 token 是合法的 service token

    具体资源服务 endpoint
      -> 根据业务边界限制允许的调用方 subject

Assets Hub 删除是 Phoenix 专用能力，因此比 Phoenix 通用入口更严格。

## 重命名风险

### runtime config 漏改会静默降级

当前 runtime.exs 使用模块名作为 application environment key：

    config :groupher_server, GroupherServer.ServiceAuth.Client, ...

Client 代码运行时通过：

    Application.get_env(:groupher_server, __MODULE__, [])

读取配置。

如果只改模块名、漏改 runtime.exs：

    编译可能仍然通过
      -> Application.get_env 读取不到 token_endpoint/client_id/client_secret
      -> token 返回 {:error, :service_token_unavailable}
      -> Assets.Deletion best-effort 吞掉失败并只记录 warning
      -> Press.invalidate/1 可能直接返回 :ok
      -> 资产删除通知和 Press 缓存失效悄悄失效

因此 config key 必须和模块名作为一次性 rename 原子修改，不能只改 source 文件。

### 当前没有 Phoenix 出站 Client 测试

当前测试文件：

    backend/api/test/groupher_server_web/service_auth_verifier_test.exs

它测试的是 Phoenix 入站 ServiceAuth.Verifier，不是出站 Client；setup 使用重命名后的模块作为 config key：

    Application.put_env(:groupher_server, Verifier, ...)

这次改名同时同步了 setup、`verify/1` 和配置 key；否则 issuer/JWKS 会写入旧 key，导致验证读取不到配置。

当前没有 Phoenix 出站 Client 测试文件；现有测试只覆盖入站 verifier，因此不能把它误认为已经覆盖出站 client。重命名时应补充 Phoenix 出站 Client 测试，至少覆盖：

    Cache hit
    expires_at 提前刷新
    同一个 resource/scope 的并发 miss 只请求一次 Auth
    Auth 返回异常
    resource/scope key 隔离
    动态配置读取

## 已完成的重命名影响范围

本次统一 ServiceAuth 命名已同步：

    backend/api/lib/groupher_server/service_auth/client.ex

    backend/api/lib/groupher_server_web/service_auth/verifier.ex

    backend/api/lib/groupher_server_web/context.ex
      -> alias 和 ServiceAuth.Verifier.service_token?/1、verify/1 的调用方

    backend/api/lib/groupher_server/cms/assets/deletion.ex
    backend/api/lib/groupher_server/cms/press.ex

    backend/api/config/runtime.exs
    backend/api/test/groupher_server_web/service_auth_verifier_test.exs

    frontend/dashboard/src/lib/serviceAuth.ts

    packages/service/auth/index.ts
      -> shared client/verifier 工厂和类型已统一

Auth 侧只改了文件边界；`issueServiceToken/2`、`readServiceAuthConfig/1`、`serviceJwks/1` 等函数名保持不变。

    docs/auth/service_token.md
    docs/auth/v2.md
    其他相关文档中的旧模块名和调用链

重命名时不能把以下事项混在一起：

    模块 rename
    TypeScript public API rename
    环境变量 rename
    service scope / audience 变更

本文记录命名变更、调用链和后续风险；重命名本身已经完成。
