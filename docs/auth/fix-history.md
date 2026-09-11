# Auth refresh 503 与 Service JWT issuer 漂移

## 状态

- Root cause：已确认
- 代码修复：已完成
- 自动化验证：已完成
- 运行态验证：Auth → Phoenix 已通过；浏览器当前为未登录态，Save 的最终写入验证需重新登录后补做
- 原影响范围：本地 Dev Hub 启动的 Dash → Auth → Phoenix refresh 链路

## 结论

本地出现的 `Auth refresh failed with status 503` 不是 Auth 或 Phoenix 未启动，也不是当前 Browser Session 已过期，而是 Auth 签发的 Service JWT 与 Phoenix 验证器使用了不同的 issuer：

```text
Auth 签发：    iss=http://127.0.0.1:3004
Phoenix 校验：issuer=https://auth.groupher.localhost
```

JWT 的 audience 与 scope 均正确：

```text
aud=phoenix:auth-api
scope=auth:session:refresh
```

Phoenix 因 issuer 不一致而拒绝 Service Token，请求没有进入 `BrowserSessions.refresh/1`。issuer 检查本身位于 `Verifier.validate_claims/1`，失败结果是 `invalid_claims`；但错误在到达 GraphQL 响应前连续丢失了两次：

1. `Verifier.verify/1` 的通配 `else` 把 `invalid_claims`、`unknown_kid`、`jwks_unavailable`、`verify_strict` 签名验证失败等细分原因统一归一成 `invalid_service_token`。
2. `Context.authorize_context/3` 再次忽略 Verifier 返回的具体 reason，只写入通用 `auth_failure`，且不设置 `:service_actor`。

随后 `ServiceScope.call/2` 命中“没有 service actor”的兜底子句，返回数字 GraphQL 错误码 `4017`。因此 `4017` 表示“本次请求没有可用的 Service Identity”，既可能来自 token 验证失败，也可能来自完全缺少 actor；它不能证明 token 已通过验证后仅仅 scope 不足。

Auth 又只保留字符串类型的 `extensions.code`，数字 `4017` 被丢弃，最终降级为 `REFRESH_UNAVAILABLE / HTTP 503`。

这包含两个问题：

1. 主因：本地运行时存在两个互相冲突的 Service Auth 配置来源。
2. 错误放大器：Verifier 与 Context 先后吞掉细分验证原因，ServiceScope 再统一返回 `4017`，Auth 最后又无法透传数字错误码。

## 可见症状

Dash 中的 GraphQL 请求发现浏览器 access token 缺失、失效或过期后，会按 Auth V1 协议请求 canonical Auth refresh。当前故障下可以观察到：

- 浏览器重复请求 `auth.groupher.localhost/api/auth/token/refresh`；
- refresh 返回 HTTP 503；
- 控制台打印 `AuthRequestError: Auth refresh failed with status 503`；
- 原 GraphQL 操作无法完成 refresh 后的一次重试；
- Wallpaper Save 等写操作保持失败状态，保存成功后的 touched 复位不会发生。

错误链路为：

```text
业务 GraphQL 请求命中可 refresh 的认证错误
  -> frontend/core 发起 single-flight refresh
  -> Auth 获取 auth:session:refresh Service Token
  -> Auth 调用 Phoenix RefreshBrowserSession
  -> Phoenix Service JWT verifier 拒绝 issuer
  -> Verifier 将 invalid_claims 归一成 invalid_service_token
  -> Context 丢弃 reason，且没有设置 service_actor
  -> ServiceScope 无 actor 兜底返回 code=4017
  -> Auth 丢弃非 string code
  -> mapBrowserSessionError 使用 REFRESH_UNAVAILABLE fallback
  -> Auth 返回 HTTP 503
  -> 前端不再重试原业务请求
```

## 已确认的证据

诊断时同时满足以下条件：

- Auth `/health` 返回 200；
- Phoenix `/health` 返回 200；
- Auth 可以成功签发 `auth:session:refresh` Service Token；
- 当前 Browser Session 在数据库中为 `active`，绝对有效期未到；
- refresh 请求到达 Phoenix，但期间没有执行 `account.browser_sessions` 查询；
- 使用当前 Auth 实际签发的 token 请求 Phoenix，稳定返回：

```json
{
  "message": "service identity is not authorized for this operation",
  "extensions": {
    "code": 4017
  }
}
```

仅凭这个 `4017` 不能区分 issuer、签名、JWKS、audience 或 scope 问题。决定性对照探针使用同一份 Auth RSA 签名密钥，保持 audience、scope、subject、TTL 不变，只将 issuer 改为 Phoenix 期望的 `https://auth.groupher.localhost`。该 token 成功越过 Verifier 与 ServiceScope、进入 Browser Session resolver，最终因诊断用 Session ref 不存在而返回：

```json
{
  "message": "Browser Session no longer exists.",
  "extensions": {
    "code": "SESSION_REVOKED"
  }
}
```

这组 A/B 探针同时证明：

- 当前 RSA 签名密钥与 `kid` 可被 Phoenix 接受；
- Phoenix 能通过配置的 HTTPS JWKS URL 获取有效公钥，Gateway/JWKS 链路可用；
- audience 与 `auth:session:refresh` scope 正确；
- 将 issuer 从 HTTP 改为 Phoenix 期望的 HTTPS 后，请求即可进入 resolver。

因此 issuer 漂移已由动态对照坐实，不只是根据 `.env.local` 与 `runtime.exs` 做出的静态推断。

## 配置为何发生漂移

Dev Hub 为 Phoenix 注入了 loopback Service Auth 配置：

```text
SERVICE_AUTH_ISSUER=http://127.0.0.1:3004
SERVICE_AUTH_JWKS_URL=http://127.0.0.1:3004/.well-known/jwks.json
SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:3004/oauth2/token
```

但 `make be.start` 随后无条件加载 `backend/api/.env.local`：

```make
cd ./backend/api && if [ -f .env.local ]; then set -a; . .env.local; set +a; fi; MIX_ENV=mock mix phx.server
```

`.env.local` 中又声明：

```text
SERVICE_AUTH_ISSUER=https://auth.groupher.localhost
SERVICE_AUTH_JWKS_URL=https://auth.groupher.localhost/.well-known/jwks.json
```

Shell `source` 会覆盖父进程已经注入的同名变量，因此 Dev Hub 展示的配置并不是 Phoenix 最终实际使用的配置。Auth 进程仍使用 Dev Hub 注入的 HTTP issuer，Phoenix 却被 `.env.local` 改成 HTTPS issuer，最终形成 split-brain。

## 已实施的修复

本次采用方案 A：稳定 issuer，并将 Dev Hub 作为编排运行时配置的唯一权威。

1. Dev Hub 新增稳定的 `LOCAL_SERVICE_AUTH_ISSUER=https://auth.groupher.localhost`；Auth、Phoenix、Assets Hub、Content Import、Press 与 Dash 统一使用该 issuer。
2. JWKS 与 token endpoint 继续使用 loopback 地址，身份与网络拓扑不再共用同一个常量。
3. `be.start.managed` 不加载 `.env.local`；原 `be.start` 保留独立启动时的本地 fallback 行为。Dev Hub
   进程管理层仅为 Phoenix 白名单补充 `SERVICE_AUTH_CLIENT_ID` / `SERVICE_AUTH_CLIENT_SECRET`，合并顺序为
   service definition > parent env > file fallback，网络和身份拓扑变量不从文件读取。
4. Dash、Auth、Assets Hub、Content Import、Press 的 `.env.example` 已统一 issuer 语义。
5. Verifier 保留 claims、unknown kid、JWKS 等内部错误；Context 使用独立的 `service_auth_failure`，不再污染浏览器 `auth_failure`。
6. ServiceScope、DelegatedScope 与 BodyBagTrust 将验证失败、scope/audience 不足、JWKS 临时失败分别输出为共享字符串机器码。
7. Auth 将 `SERVICE_TOKEN_INVALID`、`SERVICE_SCOPE_FORBIDDEN`、`SERVICE_JWKS_UNAVAILABLE` 分别映射为 401、403、503；内部 Service Auth 错误不再误清理 Browser Session Cookie。
8. Auth 提供仅由 Dev Hub 启用的 Service Auth contract probe；Dash/Apply chain 在 Auth、Phoenix ready 后必须通过真实签发与验证链路才能继续启动。
9. Auth 仅兼容含义明确的历史数字码 4018–4022；歧义 4017、临时签发错误 4023 与业务 changeset 4102 不做猜测性映射。

## 环境影响

### 本地开发

本次已确认事故属于本地启动链问题，因为 `make be.start` 才会显式加载 `backend/api/.env.local`。

### 生产与预览环境

当前仓库中的生产默认值是一致的：Auth 与 Phoenix 均以 `https://auth.groupher.com` 作为 issuer，Phoenix release 启动脚本也不会加载本地 `.env.local`。因此没有证据表明线上正在受到这次具体覆盖问题影响。

但下面三个风险与环境无关：

1. 任意环境只要为 Auth 与 Phoenix 配置了不同 issuer，都会发生相同的 Service Token 拒绝。
2. Verifier 与 Context 丢失细分错误的行为存在于共享运行时代码中，生产发生 Service Auth 错误时同样会误报。
3. 数字 `4017` 被 Auth 丢弃并伪装成 503 的行为同样不是本地专属。

## 修复目标

修复需要同时满足：

1. issuer 是稳定的逻辑身份，不随 loopback、Portless、容器地址或内部网络拓扑变化。
2. issuer 与实际访问 Auth 的 token/JWKS endpoint 分开配置。
3. Dev Hub 展示的运行时配置与子进程最终使用的配置一致。
4. `.env.local` 只能作为独立启动 fallback，不能静默覆盖编排器注入值。
5. Service Auth 验证失败必须保留可诊断的机器码，不能统一伪装成 503。
6. 修复不得改变 Browser Session 的 90 天绝对有效期、30 分钟 access token 和 single-flight refresh 协议。
7. 全仓库示例配置必须统一 issuer 语义，不能只修 Dev Hub 当前入口。

## 方案比较

### 方案 A：稳定 issuer，Dev Hub 作为编排运行时唯一权威（推荐）

将身份与网络地址显式分离：

```text
SERVICE_AUTH_ISSUER=https://auth.groupher.localhost
SERVICE_AUTH_JWKS_URL=http://127.0.0.1:3004/.well-known/jwks.json
SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:3004/oauth2/token
```

Dev Hub 启动的服务完全使用 Dev Hub 注入的拓扑配置；`be.start.managed` 不读取
`backend/api/.env.local`。未跟踪的 client id/secret 由 Dev Hub 在 spawn 前从该文件白名单补缺，任何父进程或
service definition 的同名值仍优先；Dev Hub 不从文件读取 endpoint、issuer、JWKS 或 token endpoint。

优点：

- issuer 语义稳定；
- 配置所有权清楚；
- Dev Hub UI 与真实进程一致；
- 后续切换 Portless、Docker 或内部网络时不需要改变 token 身份。

代价：

- Makefile 需要区分“Dev Hub 编排启动”和“终端独立启动”；
- 需要收敛本地 Service Auth 常量的命名，避免再次把 issuer 当作 endpoint。

### 方案 B：`.env.local` 只补充缺失变量

保留统一启动入口，但把环境优先级固定为：

```text
编排器/父进程 env > .env.local > runtime 默认值
```

需要使用明确的 env loader，仅填充父进程尚未定义的变量，不能继续直接 `source` 后覆盖。

优点：独立启动与 Dev Hub 可以共用一个入口。

缺点：加载逻辑更复杂；新增变量时仍可能重新引入优先级错误；Dev Hub 与本地文件仍然是两个配置来源。

### 方案 C：只删除 `.env.local` 中冲突的三个变量

让 Service Auth issuer、JWKS URL 和 token endpoint 仅由 Dev Hub 或 `runtime.exs` 默认值提供。

优点：改动最小，可快速止血。

缺点：只消除当前冲突，不能阻止将来其他变量被 `.env.local` 再次覆盖，不适合作为最终机制。

## 推荐实施路径

### 1. 分离身份常量与访问 endpoint

在 Dev Hub 本地服务配置中分别表达：

```text
LOCAL_SERVICE_AUTH_ISSUER=https://auth.groupher.localhost
LOCAL_SERVICE_ENDPOINTS.auth=http://127.0.0.1:3004
```

所有 Service Token 签发方与验证方使用前者；token 获取、JWKS 拉取和服务间调用使用后者。

这不是 Dev Hub 单点清理。当前以下示例文件都把 issuer 写成了 loopback endpoint，需要随方案 A 一并审计和统一：

- `frontend/dash/.env.example`
- `backend/auth/.env.example`
- `backend/assets-hub/.env.example`
- `backend/content-import/.env.example`
- `backend/press/.env.example`

这些消费者应使用稳定 issuer；只有 `SERVICE_AUTH_TOKEN_ENDPOINT` 与 `SERVICE_AUTH_JWKS_URL` 根据各自运行拓扑选择 loopback、Portless、容器名或公网地址。

### 2. 收敛 Dev Hub 配置所有权

新增明确的 Phoenix 编排启动入口，Dev Hub 使用该入口且不加载 `backend/api/.env.local`。保留现有独立启动能力时，应由独立入口加载 `.env.local`。

不建议在 Makefile 中保存父变量、source 文件后再逐个恢复，因为这种方式会随配置项增加而持续漂移。

### 3. 保留 Verifier 到 HTTP 边界的错误分类

修复不能只在 ServiceScope 或 Auth 末端兼容 `4017`。需要先打通 Verifier → Context → GraphQL/HTTP 边界的错误传播，使现有细分原因不再被吞掉：

下表描述的是修复后需要恢复的目标分类，不是当前 GraphQL 可观察结果。当前 `Verifier.verify/1` 的通配 `else` 会让包括 4019、4020、4021、4022 在内的内部原因首先收敛为 4018；随后 Context 又丢弃 4018，ServiceScope 最终统一暴露 4017。

| 内部错误分类                | 数字码 | 期望 HTTP 语义   | 备注                                        |
| --------------------------- | ------ | ---------------- | ------------------------------------------- |
| `service_auth`              | 4017   | 不能直接固定映射 | 当前同时覆盖无 actor 与 scope/audience 拒绝 |
| `invalid_service_token`     | 4018   | 401              | 当前 `Verifier.verify/1` 的统一 fallback    |
| `malformed_token`           | 4019   | 401              | 应保留具体认证失败原因                      |
| `unknown_kid`               | 4020   | 401              | 公钥集合中没有 token 的 `kid`               |
| `jwks_unavailable`          | 4021   | retryable 503    | 临时基础设施失败                            |
| `invalid_claims`            | 4022   | 401              | 包括 issuer、audience、subject、时间等声明  |
| `service_token_unavailable` | 4023   | retryable 503    | Service Token 签发端暂时不可用              |

- malformed token、unknown kid、签名或 claims 无效：认证失败，映射 401；
- token 已验证但 audience/scope 不满足当前操作：授权失败，映射 403；
- JWKS 拉取失败、Auth/Phoenix 网络不可用：临时基础设施失败，映射 retryable 503；
- Session revoked/expired：沿用 Browser Session 协议的 401 与 Cookie 清理行为。

`jwks_unavailable` 当前已经标记为 retryable；修复时必须保留这项语义，不能把所有 verifier failure 都压成 401。

跨服务公开边界优先返回共享字符串协议码，例如：

```text
SERVICE_TOKEN_INVALID
SERVICE_SCOPE_FORBIDDEN
SERVICE_JWKS_UNAVAILABLE
```

Auth 再根据这些机器码分类：

- token 无效或过期：401；
- audience/scope 不允许：403；
- JWKS 或 Phoenix 确实不可用：503。

迁移期间 Auth 兼容识别含义明确的 4018、4019、4020、4021、4022，并将它们归一为共享字符串协议码。数字码不继续作为跨服务协议的长期真值。尤其不把 `4017` 直接固定映射成 403，因为它当前同时覆盖“没有 actor”和“actor 不满足 audience/scope”两种情况；4023 与 4102 也需要各自的公开协议决策，不能仅做字符串化。

### 4. 启动契约检查

Auth 的 `/health/service-auth` 使用保留的虚构 Session ref 执行真实 `auth:session:refresh` 调用。只有 Phoenix 返回 `SESSION_REVOKED` 才表示 Service Token 已通过 issuer、签名、JWKS、audience 与 scope 验证并进入 resolver，此时 probe 返回 `health.v1 / ok`。

该 probe 默认关闭，仅由 Dev Hub 为本地 Auth 进程启用。Dash 与 Apply 的 chain startup 会先等待 Auth、Phoenix ready，再调用 probe；任何 Service Auth 机器码或无效 health contract 都会阻止目标应用启动并保留具体失败原因。普通 `/health` 仍只负责单进程存活检查，不引入 Auth/Phoenix 循环 readiness。

## 验证与验收

本次验证结果：

1. 已通过：Dev Hub 启动 Auth、Phoenix、Dash 后，两个实际进程的 issuer 均为 `https://auth.groupher.localhost`。
2. 已通过：运行中的 Auth 签发 token 携带预期 issuer、audience 与 scope，并成功越过 Phoenix Verifier 与 ServiceScope、进入 resolver。
3. 已通过：issuer/claims、签名、unknown kid、缺失 token、scope/audience 与 JWKS 失败的自动化分类测试。
4. 已通过：Session revoked/expired 的既有 401 与 Cookie 清理行为，以及内部 Service Auth 401/403 不清理 Cookie 的测试。
5. 已通过：Phoenix 聚焦回归 19 项、Auth 测试 61 项、Dev Hub 测试 48 项、Contracts 测试 7 项，以及相关 TypeScript 类型检查和 Phoenix warnings-as-errors 编译。
6. 已通过：重启 Dev Hub 后以 chain 模式启动 Dash；Auth、Phoenix ready 后 contract probe 返回 `health.v1 / ok`，随后 Dash 才进入启动并最终 running。
7. 已通过：浏览器重载后不再出现 Groupher Auth refresh 500/502/503 日志。
8. 待登录后补验：access token 失效时 single-flight refresh 返回 204，并只重试原 GraphQL 操作一次。
9. 待登录后补验：Wallpaper Save 成功后 touched 状态复位。当前 Chrome 会话已被修复前的故障清成未登录态，本次没有代替用户执行登录。

## 独立问题

诊断期间还观察到 `PagedPosts` 因 `tag.slug` 与 `nil` 比较而返回 500。该错误位于 CMS 查询构建链路，与 Service JWT issuer 漂移无关，应单独跟踪，不能把它作为 Auth refresh 503 的原因或通过本次修复一并掩盖。

## 防回归规则

- `iss` 表达稳定身份，禁止直接复用可能变化的内部访问 URL。
- issuer、audience、scope 属于签发方与验证方的共享协议，修改时必须进行跨服务契约验证。
- Verifier 的细分错误不得在 Context 边界被归一或丢弃；认证失败、授权失败和临时上游失败必须保持可区分。
- 编排器注入的运行时变量优先级必须高于开发者本地 fallback。
- Dev Hub 显示的配置必须等于真实子进程配置，不能只展示启动前的期望值。
- 禁止把跨服务协议错误统一降级为 503；401、403 与 503 必须保持语义区分。
- `/health` 不能替代 Auth-to-Phoenix 的认证链路健康检查。
