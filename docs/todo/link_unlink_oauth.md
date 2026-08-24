# OAuth 帐户链接和取消链接

> 状态：设计方案；本文件不暗示任何实施。
>
> 本文档涵盖链接和取消链接外部 OAuth 身份
> 已通过身份验证的 Groupher 用户。初始登录和 Browser Session
> 生命周期仍然由 [`Auth V1`](../auth/v1.md) 定义。第一方服务身份
> 和用户委托仍然由 [`Auth V2`](../auth/v2.md) 定义。

## 目标

Groupher用户需要管理多个外部登录身份而无需
创建重复的 Groupher 用户，允许外部身份移动
用户之间，或者让浏览器提供的提供商数据成为身份证明。

目标合约必须明确回答五个问题：

1. 谁证明了外部提供商的身份？
2. 哪个经过身份验证的 Groupher 用户请求了更改？
3. 哪些服务可以执行账户操作？
4. 哪个组件拥有提供者绑定及其不变量？
   5、用户如何保留至少一种可用的登录方式？

简短的回答是：

```text
Auth proves the OAuth provider identity and orchestrates the browser flow.
Phoenix owns the Groupher user, provider binding, uniqueness, and unlink rules.
Dashboard/Main/Apply only render account settings and start the Auth flow.
```

## 范围

本文档涵盖：

- 列出与当前 Groupher 用户关联的外部身份。
- 将新的 OAuth 身份链接到当前用户。
- 幂等地处理已链接到当前用户的身份。
- 拒绝已链接到其他用户的身份。
- 取消一个身份的链接，而不删除最后一个可用的登录方法。
- Auth 到 Phoenix 呼叫的服务身份和委派用户要求。
- Browser Session 链接和取消链接后的行为。
- 事务、并发、审计和故障语义。

本文档不涵盖：

- 初始OAuth登录和新用户注册。
- 根据电子邮件地址自动帐户合并。
- 合并两个现有的 Groupher 用户及其内容。
- MCP、代理、第三方客户或 Groupher-as-OAuth-提供商拨款。
- 企业租户 OIDC/SAML 连接管理。
- 提供者访问令牌存储，用于在登录后调用提供者 API。

## 术语

```text
Groupher user
  The Phoenix-owned application account.

External identity
  One provider/provider-account-id pair, for example github/123456.

Provider profile
  Provider-returned display metadata such as login, avatar, and nickname.
  It is not the authority for selecting a Groupher user.

Link intent
  A short-lived, one-time Auth-owned record binding an authenticated Browser
  Session to a requested provider-link flow.

Provider binding
  The Phoenix-owned persistent association between one external identity and
  one Groupher user.

Login method
  A credential or external identity through which a Groupher user can establish
  a new Browser Session. In the first release, OAuth provider bindings are the
  only implemented login-method type.

Account merge
  A separate destructive workflow for combining two existing Groupher users.
  Linking must never perform an implicit merge.
```

## 当前架构

### 登录

`backend/auth` 使用 `@auth/core` 和 JWT Session 策略，并且没有 Auth.js
数据库适配器。 Auth.js 拥有 OAuth 协议处理，而 Phoenix 拥有
实际用户和提供者行：

```text
Browser
  -> Auth /api/auth/*
  -> Provider authorization + callback
  -> Auth normalizes account/profile
  -> Phoenix signinOauth
  -> Phoenix creates or resolves User + OauthProvider + BrowserSession
  -> Auth sets its Session Cookie and groupher-auth.token
```

这意味着 Auth.js `Adapter.linkAccount` 不是持久性边界
Groupher。没有 Auth.js `User`/`Account` 数据库可以替代
Phoenix 的 `account.users` 和 `account.oauth_providers` 表。

### 持久模型

Phoenix 将外部身份存储在 `Accounts.Model.OauthProvider` 中：

```text
oauth_providers
  user_id
  provider
  provider_id
  login
  nickname
  avatar
  email / locale / location metadata
  raw provider profile
```

该数据库在 `(provider, provider_id)` 上有一个全局唯一索引。这是
正确的基本身份不变：一个外部提供者身份可能
最多属于一个 Groupher 用户。

该模型当前没有不透明的公共绑定引用或时间戳，因此它
尚无法提供建议的 `publicRef` 或 `linkedAt` 投影。它还
允许一名 Groupher 用户拥有来自同一提供商的多个身份
因为没有 `(user_id, provider)` 唯一索引。目标V1产品
模型拒绝这种情况：一个 Groupher 用户最多可以绑定一个帐户
每个提供商。

### 当前的 GraphQL 操作

旧的面向浏览器的 `linkOauth` 和 `unlinkOauth` 字段已被删除。
Phoenix 现在仅公开 Auth 范围的账户管理合约：

```graphql
linkedOauthAccounts: LinkedOauthAccounts!
linkOauthIdentity(identity: VerifiedOauthIdentityInput!): LinkedOauthAccounts!
unlinkOauthIdentity(publicRef: ID!): LinkedOauthAccounts!
```

这些操作需要：

```text
audience phoenix:auth-api
scope    auth:oauth:read | auth:oauth:link | auth:oauth:unlink
delegated current user
```

Auth 是唯一的预期呼叫者。剩下的不完整部分是
提供者授权编排，在之前获取经过验证的身份
呼叫`linkOauthIdentity`。

## 目前的问题

### 1.旧的服务合同有错误（已解决）

Dashboard 无法证明 GitHub、Google 或其他提供商验证了
特定的外部身份。只有Auth拥有提供者授权，回调，
状态、PKCE 和标准化提供者结果。旧的 Dashboard 范围字段已被删除。 Dashboard 不再呼叫
Phoenix直接用于帐户链接或取消链接。

目标所有者：

```text
service:auth
audience phoenix:auth-api
scope    auth:oauth:link | auth:oauth:unlink | auth:oauth:read
```

### 2.浏览器可以描述身份但无法证明它

`OauthProviderInput` 接受 `provider`、`providerId`、`login`、`avatar` 和
任意配置文件字段。仅当 Auth 完成后才可以接受
提供者回调，并且本身已通过 Phoenix 进行身份验证。

相同的输入绝不能成为面向浏览器的帐户管理合约。
特别是：

- `providerId` 必须来自经过验证的提供商回调。
- `login`、`email` 和配置文件元数据是属性，而不是链接权限。
- 匹配的电子邮件地址不得触发自动链接或合并。
- `raw` 不得接受任意浏览器 JSON 或提供商令牌集。

### 3. 删除旧代币发行

旧的 GraphQL 字段和遗留令牌行为都消失了。关联身份
返回更新后的提供者绑定投影并且不创建 Phoenix
不记名令牌或创建一个Browser Session。

目标结果是更新的提供者绑定投影，而不是凭证。

### 4. Link 可以在比赛期间重新分配身份

当前流程首先检查 `(provider, provider_id)` 是否属于
不同的用户，然后调用通用的 `ORM.upsert_by/3` 帮助程序。

该 upsert 使用 `(provider, provider_id)` 作为冲突目标并更新所有
其他更改的字段，包括 `user_id`。两个并发的链接请求可以
因此通过预检查并让冲突更新移动外部
身份从一个 Groupher 用户到另一个用户。

这违反了最重要的帐户链接不变量。提供者绑定
绝不能通过更新插入来更改所有者。

目标写入必须使用仅插入冲突语义：

```text
insert binding for current user
  conflict, same user      -> idempotent success
  conflict, another user   -> OAUTH_IDENTITY_ALREADY_LINKED
  provider slot occupied   -> OAUTH_PROVIDER_ALREADY_LINKED
  never update user_id on conflict
```

### 5. 链接不是一个原子域事务

提供程序创建和 GitHub 派生的 `Social` 更新执行为
单独的步骤。如果在提供程序插入后派生配置文件更新失败，
即使突变返回错误，该帐户仍会被链接。

绑定持久性、所需的派生状态更新和审核事件必须
共享一笔交易。当前隐含的部分成功合约不是
可以接受。

### 6.并发unlink可以去掉最后登录的方法

当前的取消链接流程对提供者行进行计数并随后删除。两个
并发请求都可以观察到计数为 2，然后删除不同的
行，使用户没有登录方法。

目标操作必须先在一个事务内锁定拥有用户行
检查最后一个提供者不变量并删除。链接使用相同的用户级别
序列化点，因此插入、删除和派生状态写入不能交错。

### 7.取消链接接受太多输入

取消链接只需要识别当前用户拥有的一个现有绑定。
它不应该接受完整的可变提供者配置文件。

browser/API 引用是不透明的绑定 `publicRef`。如果Groupher
决定只允许每个用户每个提供商使用一个身份，提供商枚举是
对于内部查找也足够了，但是公共突变仍然使用稳定的
绑定参考。原始提供商帐户 ID 绝不是公共突变标识符。

### 8. 派生的配置文件状态可能会变得过时

链接 GitHub 当前写入 `Social.github`。取消链接 GitHub 会删除
提供者行，但不清除或重新计算派生的社会价值。

产品必须区分：

```text
login identity binding
user-authored social profile link
provider-derived profile suggestion
```

取消链接不得默默删除用户创作的社交URL，但也不得
留下提供者派生的状态，假装身份仍然经过验证。
因此，每个派生字段的来源都需要明确。

### 9. 链接编排必须与登录分开（在 Auth 中解决）

Auth 现在使用专用链接端点和回调。它从不重复使用普通的
链接请求的登录回调，链接回调失败时关闭
意图、Session、提供商或状态不匹配。### 10.测试覆盖率仍然有较低级别的绕过

一些较低级别的 Phoenix 测试仍然注入编译时门控通配符
测试服务参与者并直接调用Phoenix。专用 Auth 和规范
Phoenix 测试现在涵盖目标流程；剩余的旁路仅用于测试并且
不代表生产调用者。下层套房还需要
如果要完全删除旁路，则需要迁移。

规范安全合约涵盖以下测试：

- Auth拥有的链接意图和回调绑定。
- 提供商回调验证。
- 修正`service:auth`受众和范围。
- 委托当前用户证明。
- 并发下的跨用户冲突行为。
- 并发取消链接下最后提供者的安全性。
- 链接/取消链接后的Browser Session行为。

## 业务不变量

以下是必需的，而不是可选的实现细节：

1. 1个`(provider, provider_account_id)`最多属于1个Groupher用户。
2. 一个Groupher用户最多为每个提供商绑定一个提供商。
3. 链接永远不会改变现有提供者绑定的所有者。
4. 链接永远不会自动合并两个 Groupher 用户。
5. 电子邮件平等并不能证明两个帐户属于同一个人。
6. 目标 Groupher 用户始终来自经过验证的委托用户参与者。
7. 提供商身份数据始终来自 Auth 验证的提供商回调。
   8、用户解除关联后保留至少一种可用的登录方式。
8. 链接和取消链接是原子的并且是并发安全的。
9. 链接不会创建或替换 Browser Session。
10. 链接不返回新的旧访问令牌。
11. 过期或撤销的 Browser Session 无法完成陈旧的链接意图。
12. 链接意图是提供商绑定的、短暂的、一次性的和重放安全的；
    原子服务器端记录是消费权限。
13. 提供商令牌和完整的原始有效负载永远不会写入日志或审计
    元数据。
14. 每个链接/取消链接成功和拒绝都是可审计的，无需存储
    凭据。

## 所有权决策

### Auth 拥有

- 帐户管理 HTTP 端点。
- 当前 Auth Session 和 Browser Session 连续性。
- 链接意图创建、过期、一次性消耗、返回URL。
- OAuth 提供商选择和授权重定向。
- 提供者回调、状态、随机数和 PKCE 验证。
- 提供商帐户/个人资料标准化。
- 在需要时按需刷新当前 Phoenix 用户凭证。
- Auth到Phoenix服务身份和用户委托传输。
- Browser-面向重定向和错误呈现。

### Phoenix 拥有

- Groupher 用户和外部提供商绑定。
- 稳定/不透明的绑定参考。
- 全球提供商身份的唯一性。
- 同用户幂等性和跨用户冲突拒绝。
- 最后登录方法不变量。
- 原子链接/取消链接事务和行锁定。
- 帐户状态、阻止和删除政策。
- 派生的配置文件状态所有权和清理规则。
- 链接/取消链接审核记录。

### 产品应用拥有

- 显示链接的提供者及其状态。
- 将浏览器发送到规范 Auth 以开始链接/取消链接。
- 渲染成功、冲突、取消和错误 UI。

产品应用程序不接收提供商凭据，也不调用
Phoenix 直接链接/取消链接突变。

## 登录方法模型

第一个版本有一个登录方法类型：持久的 OAuth 提供程序绑定。
Groupher 没有密码、密钥或提供商禁用状态。确切的第一-
因此，释放谓词是：

```text
usable(binding)
  = the binding exists
  AND its owning Groupher user is active

usable_login_method_count(user)
  = count of that active user's oauth_providers rows
```

Phoenix 是 `usable_login_method_count` 和 `canUnlink` 的唯一所有者：

```text
canUnlink(binding) = usable_login_method_count(binding.user) > 1
```

Phoenix 包括规范链接账户投影中的 `canUnlink`。 Auth
传递它并由产品应用程序呈现它；既不独立
叙述方法。投影只是 UI 提示。取消链接交易必须
重新计算用户锁下的谓词并拒绝最后方法删除
即使客户端持有陈旧的 `canUnlink: true` 响应。## 提供商绑定和配置文件所有权

提供者绑定元数据和用户创作的配置文件状态是单独的模型：

```text
OAuth provider binding metadata
  provider account login, nickname, avatar, verified email, locale, location
  owned by the binding and refreshable from an Auth-verified callback

Groupher user/profile state
  Groupher login, nickname, avatar, bio, company, location, social links
  owned by the user and never overwritten merely because a binding is linked
```

将身份链接到现有用户会写入或刷新绑定元数据。它
不会覆盖用户、个人资料或社交字段。同用户幂等链接可能
还只刷新允许列表中的绑定元数据。

如果 Groupher 选择将提供商数据投影到用户可见的配置文件字段中，
投影必须存储足以区分的字段级来源：

```text
user-authored
provider-derived(provider, binding publicRef)
system-generated
```

用户编辑将该字段更改为 `user-authored`。取消链接清除或重新计算
仅当前来源仍指向已删除绑定的值。它
既不能删除用户创作的数据，也不能保留提供者衍生的数据
在其源绑定消失后进行验证。 `Social.github`、`bio`、`company`、
`country`、`city`、`link`、头像、昵称和派生字段均遵循
本政策； GitHub 不是一种特殊的单字段异常。

新用户登录/注册可以使用提供商元数据进行初始化，否则
单独记录的注册政策下的空 Groupher 字段。那
不授权链接到现有用户覆盖这些字段。

## 目标持久绑定模型

每个提供者绑定都会收到一个不透明的、稳定的`public_ref`。公共Auth和
GraphQL合同仅通过此引用来识别约束力；原料供应商
帐户 ID 不是公共突变标识符。

目标绑定还记录 UTC 时间戳，以便投影可以提供
`linkedAt`：

```text
oauth_providers
  public_ref       unique, not null, opaque
  user_id
  provider
  provider_id
  nullable provider metadata
  inserted_at      UTC
  updated_at       UTC

UNIQUE(provider, provider_id)
UNIQUE(user_id, provider)
```

Phoenix 将 `inserted_at` 和 `updated_at` 声明为 `:utc_datetime`；迁移
通过存储库的 UTC 时间戳约定使用 `:timestamptz`。

第一个索引防止一个外部身份属于两个 Groupher
用户。第二个强制执行 V1 产品决策，而一个 Groupher 用户无法
链接来自同一提供商的两个不同帐户。

## 目标链接流量

```text
Browser                 Auth                  Provider               Phoenix
   |                      |                       |                      |
   | POST link(provider)  |                       |                      |
   |--------------------->| validate Origin/CSRF |                      |
   |                      | validate Session     |                      |
   |                      | create link intent   |                      |
   |                      |---------------------->| authorize + PKCE     |
   |<---------------------| redirect              |                      |
   |---------------------- OAuth ---------------->|                      |
   |                      |<----------------------| verified callback    |
   |                      | validate intent/state |                      |
   |                      | refresh user proof if needed                 |
   |                      | service:auth + delegated user                |
   |                      |--------------------------------------------->|
   |                      |                       | atomic link          |
   |                      |<---------------------------------------------|
   |<---------------------| clear intent + redirect                      |
```

### 链接意向合约

链接意图至少绑定：

```text
action: link
target provider
current Phoenix browserSessionRef
random intent nonce
PKCE code verifier
validated return URL
created-at and short expiry
one-time consumption status
```

每个意图都是服务器端记录。签名或加密的无状态 Cookie 是
不是一个意图，因为它不能强制执行一次性消费并且可以重放
直至到期。浏览器可能只在一个随机不透明的`intentRef`
仅主机、HttpOnly、安全 Auth Cookie 或完整性保护 OAuth 状态；全部
提供者、用户、Session、过期时间、随机数和消费权限保留在
服务器端记录。

意图状态转换是原子的：

```text
pending -> consumed
```

只有一个回调可以将 `pending` 更改为 `consumed`。回调观察任何
其他状态失败关闭，并且没有Cookie删除或客户端状态更改
视为消费证明。

意图引用、意图随机数和提供者 OAuth `state` 具有不同的
角色：

```text
intentRef
  Opaque reference to exactly one Auth-owned intent.

intentNonce
  Random secret stored with the intent and used to prevent substitution.

OAuth state
  Opaque provider round-trip correlation carrying the intentRef and nonce;
  the server-side record supplies the integrity and replay authority.
```

回调首先验证 OAuth 状态，然后准确定位一个意图
并在处理提供者结果之前自动消耗它。它验证了
提供商和当前的`browserSessionRef`违背了这一意图。状态值来自
一个流不能与另一个意图组合，并且消耗的回调不能
被重播。短暂的故障会启动一个新的意图，而不是恢复一个新的意图
消耗状态。

之前必须区分正常的登录回调和链接回调
Phoenix身份交换：

```text
no valid link intent -> signinOauth
valid link intent    -> linkOauthIdentity for current delegated user
```

格式错误、过期、已消耗、提供者不匹配或 Session 不匹配
意图失败关闭，并且永远不会退回到登录或帐户创建。

### 链接结果规则

```text
identity not linked
  -> insert for current user
  -> success

identity already linked to current user
  -> idempotent success
  -> refresh allowed display metadata according to explicit policy

current user already has another identity from this provider
  -> OAUTH_PROVIDER_ALREADY_LINKED
  -> no replacement or ownership change

identity linked to another user
  -> conflict
  -> no ownership change
  -> no account merge

current user blocked/deleted/session revoked
  -> reject
  -> consume or invalidate intent
```

### 提供商更换

`OAUTH_PROVIDER_ALREADY_LINKED` 永远不会取代现有的提供商插槽。至
链接提供商帐户 B，用户必须首先通过以下方式取消链接提供商帐户 A：
正常的最后登录方法规则。公认的 V1 结果是唯一的
GitHub、Google 或其他提供商帐户不能被其他帐户替换
来自该提供者，因为 A 无法首先取消链接。## 目标取消链接流程

```text
Browser                 Auth                               Phoenix
   |                      |                                    |
   | POST unlink(ref)     |                                    |
   |--------------------->| validate Origin/CSRF               |
   |                      | validate Session                    |
   |                      | service:auth + delegated user       |
   |                      |----------------------------------->|
   |                      | lock user row, then bindings         |
   |                      | check ownership + remaining method  |
   |                      | delete + derived state + audit      |
   |                      |<-----------------------------------|
   |<---------------------| updated provider list               |
```

取消链接需要有效的当前 Auth Session、有效的 Phoenix 用户凭证，
确切的起源，以及CSRF证明。 V1 不需要最近的身份验证或
提供商重新验证。

取消链接提供商不会终止当前的 Browser Session 或撤销
其他Browser会议。响应使提供商列表立即更新
可用，因此每个产品 UI 都可以呈现相同的状态。

## 拟议的公开 Auth HTTP 合约

Canonical Auth 是唯一面向浏览器的帐户管理来源。

### 列表

```http
GET /api/auth/accounts
```

回应：

```json
{
  "accounts": [
    {
      "publicRef": "oauth_account_xxx",
      "provider": "github",
      "login": "octocat",
      "avatar": "https://...",
      "canUnlink": false,
      "linkedAt": "2026-08-11T00:00:00Z"
    }
  ]
}
```

### 开始链接

```http
POST /api/auth/accounts/:provider/link
Origin: https://groupher.com
X-Groupher-CSRF: 1

{ "returnTo": "https://groupher.com/account/connections" }
```

端点创建链接意图并返回受控重定向或
提供商授权URL。然后浏览器导航到该 URL。 `returnTo`
使用与常规登录相同严格的第一方验证合同
重定向。响应是：

```json
{ "authorizationUrl": "https://github.com/login/oauth/authorize?..." }
```

自定义 CSRF 标头有意强制执行 CORS 预检。对于每一个
有凭据的帐户管理端点，规范 Auth 必须允许凭据
并且该标头仅适用于第一方来源的确切白名单，返回
`Vary: Origin`，并拒绝通配符、`null`、未知和未经批准的同级-
子域起源。如果没有 CORS 策略，标头就不是 CSRF 边界。

### 取消链接

```http
POST /api/auth/accounts/:publicRef/unlink
Origin: https://groupher.com
X-Groupher-CSRF: 1
```

浏览器从不发送 `provider_id`、提供商配置文件 JSON 或目标用户。

## 拟议的 Phoenix GraphQL 合同

这些字段是内部 Auth 到 Phoenix 操作，不是一般浏览器
突变。

```graphql
input VerifiedOauthIdentityInput {
  provider: OauthProvider!
  providerAccountId: String!
  login: String
  nickname: String
  avatar: String
  email: String
  locale: String
  link: String
  bio: String
  country: String
  city: String
  company: String
  profile: Json
}

type LinkedOauthAccount {
  publicRef: ID!
  provider: OauthProvider!
  login: String
  nickname: String
  avatar: String
  canUnlink: Boolean!
  linkedAt: Datetime!
}

type LinkedOauthAccounts {
  entries: [LinkedOauthAccount!]!
}

query linkedOauthAccounts: LinkedOauthAccounts!

mutation linkOauthIdentity(
  identity: VerifiedOauthIdentityInput!
): LinkedOauthAccounts!

mutation unlinkOauthIdentity(
  publicRef: ID!
): LinkedOauthAccounts!
```

精确的标量和命名约定应遵循以下架构约定：
实施时间。重要的合同变更是：

- 提供者证明输入与公共绑定引用分开。
- 没有突变返回访问令牌。
- 没有突变接受目标用户。
- 取消链接不接受可变的提供商配置文件数据。
- 响应返回规范的当前结合投影。

## 服务身份和委托

Auth 请求 Phoenix Auth 资源的范围服务令牌：

```text
resource https://api.groupher.com/auth
audience phoenix:auth-api
```

经营范围：

```text
auth:oauth:read
auth:oauth:link
auth:oauth:unlink
```

每个请求还通过标准化携带当前用户凭证
代表团交通：

```http
Authorization: Bearer <service:auth token>
X-Groupher-User-Authorization: Bearer <current user access token>
```

Phoenix 在构建 `delegated_actor` 之前使用不同的方法验证两者
每个令牌的验证配置文件：

```text
service token
  issuer/signature/type
  audience = phoenix:auth-api
  exact auth:oauth:* operation scope
  service subject and client grant

user token
  issuer/signature/browser-token type
  its own browser-access audience, for example phoenix:browser-api
  expiry, user subject, sid, active user, and active Browser Session
```

用户token是身份和当前-Session委托证明；它不是
需要拥有服务令牌的 `phoenix:auth-api` 受众。 Phoenix必须
仍然验证用户令牌自己的确切受众而不是禁用
观众验证。无法从输入字段、提供商中选择用户
电子邮件、提供商登录、Browser Session 公共引用或任意用户引用
标头。

Auth.js Session 是稳定 Phoenix 受保护的 Auth 侧载体
`browserSessionRef`;它不是第二个独立账户机构。的
短暂的 `groupher-auth.token` 源自 Phoenix Browser Session
并具有与 `sid` 相同的参考号。链接完成之前：

```text
intent.browserSessionRef
  = current Auth.js Session.browserSessionRef
  = delegated user token.sid
  = an active Phoenix BrowserSession owned by the delegated user
```

Auth.js Cookie 单独的有效性是不够的，因为 Auth 不知道
Phoenix Browser Session 仅通过解码其 JWT Session 就被撤销。 Phoenix
必须在每个链接完成时检查引用的 Browser Session，即使
短期用户令牌尚未过期。 `browserSessionRef` 只是一个
验证两个凭证后的绑定约束；它从不创造
用户权限本身。

Auth 客户端注册表必须仅授予三个确切的 OAuth 帐户范围
除了现有的 Browser Session 范围之外。 Dashboard，Content Import，
Assets Hub、新闻和调度程序客户端都不会收到任何消息。

## 数据和交易合约

### 用户级序列化和锁定顺序这是帐户范围的交易规则，而不是 OAuth 本地约定。每个

写入两个或多个这些记录类的事务使用相同的锁
并写出顺序：

```text
1. current account.users row FOR UPDATE
2. relevant oauth_providers rows
3. derived User/Profile/Social rows
4. audit row
```

即使链接插入了一个绑定，用户行也是序列化点
尚不存在。仅锁定现有绑定集无法序列化此类
防止取消链接的插入，并首先在一个路径上锁定社交/个人资料会创建一个
顺序冲突。链接、取消链接、提供商元数据同步、普通
个人资料/社交编辑以及任何其他多行帐户交易必须遵循
这种用户至上的顺序。单行更新不需要获取无关的锁，但是
它不得持有下游配置文件/社交锁并随后获取上游
用户或提供者绑定锁。

现有绑定登录可能保持只读状态。任何登录或注册路径
写入绑定元数据或派生配置文件状态必须遵循相同的锁
订单；新用户注册将所有必需的写入保留在一个 `Ecto.Multi` 中。
在实施之前，审核现有的个人资料和社交更新交易
反转或不一致的多行写入顺序。

###链接交易

一笔交易必须：

1. 锁定委派用户的`account.users`行`FOR UPDATE`。
2. 验证委派用户和绑定的 Browser Session 是否处于活动状态。
3. 尝试仅插入提供者绑定写入。
4. 在唯一冲突上，对现有绑定进行分类：幂等地返回
   相同的身份/当前用户，拒绝另一个用户的所有权，并拒绝
   当当前用户已经拥有该提供商时不同的身份。
5. 切勿通过更新插入或冲突更新来更新 `user_id`。
6. 仅刷新配置文件所有权策略下列入许可名单的绑定元数据。
7. Apply同一事务中任何所需的派生状态更改。
8. 插入审核事件。
9. 返回规范的当前提供商列表，包括Phoenix-计算的
   `canUnlink`。

唯一的数据库索引仍然是最终的仲裁者。申请预检查是
为了错误质量，而不是并发正确性。

迁移为两个索引提供了稳定的约束名称，例如：

```text
oauth_providers_provider_provider_id_index
oauth_providers_user_id_provider_index
```

Phoenix 显式处理两个 PostgreSQL 约束名称，然后重新查询
之前用户锁下的外部身份密钥和用户/提供商插槽
对结果进行分类。仅约束名称是不够的，因为相同-
身份/当前用户重试可能满足两个唯一密钥和PostgreSQL的选择
所报告的约束不得将幂等成功更改为提供程序槽
冲突。

### 取消关联交易

一笔交易必须：

1. 锁定委托用户的`account.users`行`FOR UPDATE`。
2. 验证委派用户和绑定的 Browser Session 是否处于活动状态。
3. 解决不透明绑定引用并验证所有权。
4. 使用集中式首次发布谓词计算可用登录方法：
   活动用户的 `oauth_providers` 行。
5. 拒绝删除最后一个可用的方法。
6. 精确删除一个绑定。
7. 仅清除或重新计算仍源自该绑定的配置文件字段。
8. 插入审核事件。
9. 返回规范的剩余提供商列表。

### 取消链接重试语义

Phoenix 突变不会将缺失的绑定视为幂等成功。
提交一次取消链接后，对同一 `publicRef` 的第二个请求返回
`404 OAUTH_BINDING_NOT_FOUND`，使用与任何其他相同的非公开响应
绑定对当前用户不可见。

Auth 不得在出现不明确的网络故障后盲目重播取消链接。它
首先重新获取规范的链接帐户列表：

```text
publicRef absent  -> the desired state is reached; report unlink success
publicRef present -> retry unlink once under the normal authorization checks
```

这可以保持 Phoenix 所有权/错误契约的精确性，同时防止 UI
当第一次删除提交但其响应时报告错误失败
迷路了。

Auth 针对网络/5xx 故障实现此协调：它重新获取
规范帐户列表，将不存在的 `publicRef` 视为成功，然后重试
Phoenix 当绑定仍然存在时取消链接一次。明确的Phoenix
`OAUTH_BINDING_NOT_FOUND` 仍然是正常的 404 并且不会重试。### 当前 Phoenix 实现边界

第一个实现切片具有用户行锁、仅插入绑定
写入、冲突分类和上次登录方法检查。两份合同
步骤仍然明确推迟，而不是默默暗示：

- 尚未发出链接/取消链接审核事件。帐户域没有
  合适的仅附加审计接收器；添加一个是后续交易步骤，
  这段代码假装已经完成了。
- 字段级出处尚未保留。 GitHub 当前的社会清理
  使用保守的值相等检查作为临时 V1 后备。它必须
  在投影其他提供者派生字段之前被替换，因为
  无法将用户创作的相同值与提供者衍生的值区分开来
  没有出处的价值观。

现在，该实现公开了内部 Phoenix 规范投影以及
Auth 帐户列表、取消链接和 GitHub 开始链接/回调端点。链接
意图持久化在每个意图的持久对象中并以原子方式消耗；
没有生产过程中的后备。当前的 Auth 提供程序集有
GitHub 已配置，因此端点拒绝未配置的提供程序。
回调执行一次需求驱动的 Phoenix 令牌刷新并重试，OAuth
帐户操作使用专用的速率限制存储桶，并且 Auth 进行协调
在重试之前，针对规范帐户列表的模糊取消链接失败。

## 待办事项

这些是当前实施的剩余后续行动；他们是
不是上面已经描述的 V1 链接/取消链接流程的先决条件：

- 添加帐户拥有的仅附加审计接收器，然后实施事务步骤
  8.所以链接和取消链接持久化审核事件。
- 在投影任何新的提供商数据之前添加持久的字段级来源
  进入个人资料/社交。替换当前的 GitHub 值相等清理
  一旦出处存在就回退； GitHub 是唯一源自提供商的字段
  当前V1切片。
- 完成产品 UI：帐户连接入口点、规范链接
  帐户列表、可空登录/头像回退、基于 Auth 的链接/取消链接操作、
  取消/冲突/最后方法反馈，以及唯一提供商
  更换限制。

### 不支持账户合并

当一个身份链接到另一个 Groupher 用户时，链接端点返回一个
冲突。它不得移动提供商所有权、按活动选择一个用户，或者
合并内容。

## 提供商资料政策

Auth 规范化来自已验证回调的允许列表 DTO。它不发送
将提供者令牌集或无界原始回调对象设置为 Phoenix。

推荐的初始字段：

```text
provider
providerAccountId
login
nickname
avatar
verified email when available
locale/location display hints
bounded provider-profile metadata required for debugging
```

只有 `provider` 和 `providerAccountId` 需要身份。提供者`login`，
`nickname`、`avatar`、电子邮件和其他个人资料字段可为空，因为不
每个 OAuth/OIDC 提供商都提供稳定的用户名或显示配置文件。他们的
缺席永远不会阻止链接到现有的 Groupher 用户。

初始注册仍然需要唯一的Groupher`User.login`，但那就是
一个单独的帐户创建问题，而不是提供商绑定要求。
注册规范化器从提供商登录中导出候选者，然后
昵称/名称，然后验证电子邮件本地部分，最后是提供商/帐户 ID
基于后备； Phoenix 应用其正常登录规范化和唯一性
创建用户之前进行分配。

提供程序回调刷新仅更新允许列表中的绑定元数据。确实如此
不覆盖用户创建的用户/个人资料/社交字段。保留有限的原始数据
元数据仍然是一个明确的产品决策，但提供者令牌和完整的
回调有效负载永远不是该元数据的一部分。

明确排除：

```text
access_token
refresh_token
id_token
authorization code
client secret
full HTTP callback payload
```

提供者凭证不在此设计范围内，并且永远不会存储在
`OauthProvider.raw`。切换会清除每个现有的 `OauthProvider.raw` 值，而不是尝试
保留或拒绝未知密钥。割接后，仅限制范围内的白名单
可以写入上面定义的提供者简档元数据。

清理是在编写器更改后进行的，而不仅仅是捆绑到一个
无序释放：

```text
1. Auth stops sending the complete provider profile.
2. Phoenix accepts and persists only bounded allowlisted profile metadata.
3. All old Auth and Phoenix instances are drained.
4. Operations confirms no unbounded raw writer remains.
5. An operator explicitly runs the one-time data cleanup that sets every
   existing oauth_providers.raw to null.
```

当旧的编写器仍然存在时运行清理是无效的，因为新的编写器
注册或链接可以在清理后再次写入无界 `raw`。

此清理是显式运行的部署后数据操作。一定不能是
放置在 `priv/repo/migrations` 或任何自动启动时或发布迁移中
设置。启动第一个新实例绝不能在旧实例时触发它
可能仍在提供流量。

## Session 语义

### 链接

- 现有的Auth Session仍然是当前的浏览器权限。
- 现有的 Phoenix Browser Session 保持活动状态。
- 没有创建新的Browser Session。
- GraphQL 不返回旧版 Phoenix 访问令牌。
- Auth 可能会刷新短暂的 Phoenix 访问权限 Cookie 如果在
  提供商往返，使用正常的 V1 刷新合约。回调
  刷新一次，更新Cookie，并重试Phoenix链接操作；
  第二次到期失败关闭。
- 成功的链接会更新帐户设置，但不会更改当前用户。
- V1 不需要最近的身份验证。如果添加升级认证，
  在取消链接之前保护链接，因为链接会添加持久登录凭据。

### 取消链接

- 当前的 Session 保持活动状态。
- 仅当另一个提供商使用时才允许删除用于当前登录的提供商
  可用的登录方法仍然存在。
- 其他Browser会话保持活动状态。
- V1 不提供“取消链接和撤销会话”组合操作。

## 错误合约

建议的机器可读错误：

```text
OAUTH_LINK_INVALID_INTENT
OAUTH_LINK_REPLAYED
OAUTH_PROVIDER_CANCELLED
OAUTH_PROVIDER_UNAVAILABLE
OAUTH_IDENTITY_ALREADY_LINKED
OAUTH_PROVIDER_ALREADY_LINKED
OAUTH_BINDING_NOT_FOUND
OAUTH_BINDING_NOT_OWNED
OAUTH_LAST_LOGIN_METHOD
SESSION_MISSING
SESSION_EXPIRED
SESSION_REVOKED
ACCOUNT_BLOCKED
SERVICE_TOKEN_INVALID
PERMISSION_DENIED
```

V1 回调行为使用 `OAUTH_LINK_INVALID_INTENT` 来表示格式错误、过期、
或不匹配的意图/状态输入，以及 `OAUTH_LINK_REPLAYED` 当已经
再次提交消耗的意图。提供商取消表示为
受控的 `oauthLink=cancelled` 重定向结果。

状态语义：

```text
400  malformed provider/action/input
401  missing, expired, or revoked user/Session proof
403  wrong service actor or scope
404  binding ref not found for the current user where non-disclosure is needed
409  provider identity belongs to another user, the user already has another
     identity for that provider, or a concurrent state conflict occurred
400  invalid, expired, or consumed one-time link intent in the V1 Auth callback
429  rate limited
502/503 provider or Auth/Phoenix dependency unavailable
```

浏览器错误页面不得泄露登录名、电子邮件或用户身份
其他帐户持有冲突的提供商绑定。

## 用户界面合约

账户设置显示：

```text
provider icon/name
linked provider display label/avatar
linked time
link action for unlinked providers
unlink action when canUnlink=true
why the final provider cannot be removed
```

由于提供商登录名和头像可为空，因此每个产品都使用规范
显示后备：

```text
display label
  provider login
  -> provider nickname
  -> localized "Connected <provider> account"

avatar
  provider avatar
  -> provider icon
```

电子邮件不是显示标签的后备方案，因为它可能会暴露更多身份数据
超过帐户连接 UI 的需要。

UI 在规范 Auth 处开始所有突变。它从不发送提供商资料
数据到 Phoenix 并且从不在 URL 或客户端状态中嵌入提供者凭据。

提供商取消返回到帐户设置，具有稳定、非致命的
状态。跨用户冲突说明外部身份已经存在
使用但无法识别其他Groupher帐户。

## 可观察性和审计

记录以下非敏感事件：

```text
link intent created / expired / consumed / rejected
provider callback success / cancellation / failure category
link idempotent success
cross-user binding conflict
same-user provider-slot conflict
unlink success
unlink retry reconciled from canonical state
last-login-method rejection
service audience/scope rejection
concurrent database conflict
correlation/request id
```

审计记录可能包含稳定的Groupher用户ID、提供商名称、绑定公共
参考、服务主题和结果类别。它们不得包含提供者
令牌、服务令牌、浏览器凭据、完整配置文件 JSON、授权
代码或任意提供程序错误体。

## 速率限制

Auth通过`AUTH_OAUTH_RATE_LIMITER`将独立逻辑桶应用到：

- 每个用户、Session、提供商和源 IP 创建链接意图。
- 每个意图和源 IP 的提供商回调尝试，包括失败。
- 取消每个用户和Session的链接尝试。
- 每个 Auth 客户端和用户的帐户列表和 Auth 到 Phoenix 帐户操作。

速率限制绝不能成为唯一的重放防御。链接意图仍然
一次性使用、受提供商限制、Session 受限制且寿命短暂。## 迁移计划

### 第 1 阶段：冻结不安全路径

- 删除过时的 `linkOauth`/`unlinkOauth` 字段及其
  `dashboard:oauth:write`授权合同。
- 不要为现有突变添加 Dashboard 代理。
- 添加记录当前全球唯一提供商身份索引的测试。
- 强制执行已接受的 V1 产品规则，即一个用户最多可以链接一个帐户
  来自每个提供商。

### 第 2 阶段：正确的 Phoenix 域操作

- 将可为空的 `public_ref` 和 UTC 时间戳添加到 `oauth_providers`。
- 使用唯一的不透明 `public_ref` 回填每个现有绑定，验证否
  如果存在空值或重复项，请创建唯一索引，然后使该列不为空。
- 使用明确记录的现有行填充 `inserted_at`
  迁移时间戳，因为遗留表没有历史链接时间；
  不要将回填值显示为原始提供商链接事件时间。
- 在创建`UNIQUE(user_id, provider)`之前，查询并报告每个重复项
  组及其绑定 ID 和提供者 ID。预计产量不会
  重复；这是一个防御性断言，而不是兼容性工作流程。
- 如果断言失败，则中止迁移和部署。请勿删除或
  重写任何提供者绑定以使索引通过。
- 报告冲突的行以进行明确的人工审核。部署可能会恢复
  仅在经过产品批准的单独数据迁移解决事件后；
  本文档不授权删除、存档、合并或其他修复
  算法。
- 断言通过后创建并强制执行 `UNIQUE(user_id, provider)`。
- 更改Auth和Phoenix以停止发送和接受无限的`raw`，耗尽所有
  旧实例，确认没有无限制的写入者剩余，然后有一个操作员
  显式清除每个现有的 `oauth_providers.raw` 值。本次数据清理
  不是 `priv/repo/migrations` 或任何自动启动/发布迁移的一部分。
  不要保留未知密钥或清除拒绝列表。
- 将期望 `raw` 镜像完整提供商配置文件的测试替换为
  有界允许列表和凭据排除断言。
- 在投影任何提供商数据之前引入现场级源跟踪
  进入用户可见的个人资料/社交字段。
- 用插入/冲突分类替换所有权更改更新插入。
- 使并发首次登录恢复唯一的 `create_user` 或
  `create_profile` 通过重新查询提交的外部身份和
  重用其所有者来创建 Browser Session。
- 明确命名两个唯一约束并使用
  PostgreSQL 约束名称，后跟锁定下的规范键重新查询。
- 使链接和解除链接首先锁定用户行并共享一个锁定顺序。
- 审核普通配置文件/社交多行交易并将其与
  帐户范围内的用户 -> 绑定 -> 个人资料/社交 -> 审核顺序。
- 集中第一个版本的可用登录方法谓词和 `canUnlink`。
- 将经过验证的提供者 DTO 与取消链接的参考输入分开。
- 使非权威提供商配置文件字段可为空。
- 从链接中删除旧代币生成。
- 添加规范的链接帐户预测和机器可读错误。

### 第 3 阶段：添加 Auth 编排

- 帐户列表/链接/取消链接 HTTP 端点在规范 Auth 中实现。
- 短暂的、一次性的链接意图保存在持久对象中，并且
  原子消耗；浏览器状态仅携带不透明的引用。
- OAuth 状态绑定到一个意图随机数、提供者和意图绑定
  Phoenix `browserSessionRef`;回调重放失败关闭。
- 已验证的 GitHub 回调通过以下方式调用 Phoenix
  `auth:oauth:link`委托合约并返回控制成功，
  取消或错误重定向。
- Auth到Phoenix委托仅转发标准化用户凭证，并且
  与服务令牌分开验证它。
- 剩余的第 3 阶段工作是添加任何未来的提供商适配器和生产
  配置的提供程序的烟雾覆盖范围。### 第 4 阶段：产品 UI

- 在选定的产品界面中添加帐户连接 UI。
- 从规范投影渲染链接帐户。
- Apply 规范的可空登录/头像显示后备。
- 仅通过 Auth 端点启动链接/取消链接。
- 解释冲突、最后提供者保护和提供者取消。
- 解释 V1 不能取代单一提供商帐户。

### 第 5 阶段：删除过时的合同

- 旧的`dashboard:oauth:write`模式契约被删除。
- 旧的 `linkOauth: TokenInfo` 和 `unlinkOauth(provider profile)` 字段是
  删除； `OauthProviderInput` 仅保留用于登录。
- `service:test-suite` 通配符角色仅保留为编译时，
  用于较低级别 Phoenix 测试的测试环境兼容性帮助程序。它是
  不是生产身份，在生产配置中不可用，并且
  不是浏览器/Auth链接合同的一部分。删除它是一个单独的
  测试套件清理，不是完成 Auth 流程的先决条件。
- 验证没有浏览器或产品服务器直接调用 Phoenix 链接/取消链接。

## 切换操作手册

版本控制的 [OAuth V1 切换操作手册](./link_unlink_oauth_runbook.md)
和审查的执行工件定义了这些操作。他们一定不存在
仅作为操作员的本地 SQL 文件或未记录的一次性脚本。

该操作手册涵盖两个独立的操作：

```text
required
  Explicit post-deploy cleanup of oauth_providers.raw.

conditional
  Independently approved data migration after the duplicate assertion blocks
  deployment. The runbook does not define a generic delete or repair algorithm.
```

脚本和操作员命令被签入存储库、进行审查并
由版本或校验和标识。它们没有放置在 `priv/repo/migrations` 中
并且在应用程序启动或发布启动期间永远不会自动执行。

执行清单至少记录：

```text
release and commit
operator and approver
reviewed script version or checksum
dry-run queries and expected affected-row counts
duplicate groups and exact conflicting binding ids, when applicable
proof that the new Auth and Phoenix versions are fully deployed
proof that all old instances and unbounded raw writers are drained
transaction, timeout, and failure-handling settings
actual affected-row counts
post-run duplicate count
post-run non-null raw count
registration, Link, Unlink, and sign-in smoke results
monitoring results, execution time, and final status
```

`raw` 清理有意只向前：不复制无限制的原始数据
到备份表中或在回滚期间恢复它。如果重复的断言
不合格，操作员出具报告后停止；仅单独审查
产品批准的数据迁移可能会改变这些绑定。

## 测试计划

### Auth 协议测试

- 前端 Auth 助手覆盖帐户列表，开始链接 `authorizationUrl`
  导航、不透明引用取消链接和机器可读的错误传播。
- 链接需要当前的Auth Session、确切的来源和CSRF证明。
- 取消链接需要当前的 Auth Session、确切的来源、CSRF 证明和有效的
  Phoenix 用户凭证；它不需要最近的身份验证或提供商
  重新验证。
  -intentRef Cookie 仅限主机；它的服务器端意图是短暂的，
  提供商绑定、Session 绑定和一次性。
- 重放签名/加密的浏览器值无法消耗服务器端意图
  不止一次。
- 并发回调仅允许一次 `pending -> consumed` 转换。
- 来自一个流的 OAuth 状态不能消耗或与另一意图组合。
- 无效/过期/已消耗的意图永远不会退回到登录。
- 提供者取消返回受控结果。
- 回调提供者不匹配失败关闭。
- 过期的 Phoenix 用户凭证使用 V1 请求刷新路径一次。
- 回调刷新将刷新的 Phoenix 访问 Cookie 写入之前
  受控成功重定向。
- 不明确的取消链接失败与规范帐户列表一致，并且
  最多重试一次。
- 已撤销的Browser Session无法完成链接。
- `returnTo` 无法逃脱经批准的第一方来源。
- 经过认证的 CORS 预检仅允许准确的第一方来源和
  帐户管理 CSRF 标头；通配符、`null` 和同级起源失败。

### Phoenix 授权测试

- 缺少服务证明将被拒绝。
- 错误的服务主题、受众或范围将被拒绝。
- 有效的浏览器用户令牌会根据其自己的受众进行检查，并且不会
  需要携带服务令牌的 Auth API 受众。
- 令牌类型或浏览器受众错误的用户令牌将被拒绝。
- 没有委托用户的服务证明被拒绝。
- 没有Auth服务证明的用户证明将被拒绝。
- Auth链接范围无法取消链接； Auth 取消链接范围无法链接。
- Dashboard/Content Import/按/Assets Hub令牌无法管理提供商。### 链接域测试

- 指向当前用户的新身份链接。
- 相同身份/当前用户是幂等的。
- 另一个用户拥有的身份会返回冲突，而无需更改所有权。
- 来自两个用户的并发链接永远不会移动`user_id`。
- 同一用户的链接和取消链接在用户行上序列化并保留两者
  绑定所有权和最终登录方法不变量。
- 并发链接/取消链接路径获取用户、绑定、派生配置文件和审核
  锁定记录的顺序。
- 普通个人资料/社交多行编辑遵循相同的帐户范围顺序
  并且不要通过链接/取消链接引入反向锁死锁。
- Link 永远不会创建 Browser Session 或返回旧令牌。
- 所需的派生状态更改在事务上是一致的。
- 同用户幂等链接刷新绑定元数据而不覆盖
  用户创建的配置文件字段。
- 没有`login`、昵称或头像的提供商可以链接到现有用户。
- 将同一提供商的第二个帐户链接到一个用户将被拒绝，而无需
  替换现有的绑定。
- 违反外部身份和用户/提供者约束
  通过它们的稳定名称来识别并规范地重新查询为不同的
  机器错误。
- 无论哪种身份/当前用户重试都保持幂等性
  唯一约束PostgreSQL报告。
- 提供商令牌字段不会保留在配置文件 JSON 或日志中。

### 取消链接域测试

- 当存在另一个可用方法时，可以取消链接拥有的绑定。
- 外部绑定无法取消链接。
- 最后可用的方法无法取消链接。
- 并发取消链接无法删除所有登录方法。
- 提供者派生的配置文件状态遵循所选的清理策略。
- 取消链接保留用户创作的字段并仅清除源自
  删除了绑定。
- 当前的Session行为符合记录的政策。
- 取消链接使当前和其他 Browser 会话保持活动状态。
- 重复提交的取消链接从 Phoenix 返回 `OAUTH_BINDING_NOT_FOUND`。
- 在模糊的取消链接响应之后，Auth 重新获取绑定列表并处理
  缺席的 `publicRef` 视为成功完成。

### 迁移测试

- 每个现有的提供者绑定都会收到一个唯一的非空`publicRef`。
- 全局 `(provider, provider_id)` 身份不变在迁移后仍然存在。
- 重复断言报告确切的冲突行并中止，而无需
  删除或重写绑定。
- 失败的断言需要明确批准的独立数据迁移
  重试之前；链接/取消链接版本不执行自动修复。
- 迁移会在之后为每个 `(user_id, provider)` 创建并强制执行一个绑定
  断言通过。
- 在部署后 `raw` 清理运行之前，旧编写器已被耗尽。
- 自动启动时和发布迁移从不执行 `raw` 清理；
  操作员在推出验证后显式调用它。
- 签入的切换操作手册记录了已审核的工件版本、试运行
  计数、推出/耗尽证明、受影响的行、运行后验证和烟雾
  结果。
- 每个现有的 `oauth_providers.raw` 值都被清除，后续的
  注册/链接写入仅包含有限的允许列表元数据。
- 新绑定公开 UTC `linkedAt`；遗留回填时间戳被处理为
  迁移时间值而不是声明的历史链接事件。

### Browser E2E

- 登录用户链接到不同的提供商并保持相同的 Groupher 用户。
- 刷新和新登录可以使用新链接的提供商。
- Unlink 一致更新每个产品帐户菜单。
- 最后一个提供者 UI 被禁用并且服务器独立地拒绝它。
- 缺少提供商登录/头像使用昵称/本地化提供商标签和
  提供商图标而不暴露电子邮件。
- 提供商取消和冲突不会使用户注销。
- 跨用户冲突永远不会暴露其他帐户。## 验收标准

- Auth 是唯一面向浏览器的链接/取消链接协议所有者。
- Phoenix 仍然是唯一持久的提供者绑定权限。
- 产品应用程序从不转发浏览器断言的提供商配置文件。
- 只有具有确切 Auth 受众/范围的 `service:auth` 才能调用突变。
- Phoenix 独立验证委派的当前用户。
- 服务和用户凭证使用单独的精确受众验证配置文件。
- 链接完成会重新验证意图绑定 Phoenix Browser Session，即使
  委托的访问令牌尚未过期。
- 提供者身份所有权不能通过更新插入或竞赛来更改。
- 在用户行上链接和取消链接序列化并共享一个锁定顺序。
- 并发取消链接无法删除最终可用的登录方法。
- 在第一个版本中，可用的登录方法正是活动用户的OAuth
  提供者行； Phoenix 单独计算 `canUnlink` 并在锁定状态下重新检查它。
- 电子邮件平等永远不会自动链接或合并用户。
- 链接不会铸造旧代币或创建 Browser Session。
- 取消链接接受不透明的拥有的绑定引用，而不是提供者配置文件。
- 每个绑定都有回填的不透明 `publicRef` 和 UTC 时间戳；提供者
  除提供商/帐户 ID 之外的配置文件属性可为空。
- 提供者元数据刷新不会覆盖用户创作的配置文件字段，并且
  unlink 仅清除仍源自已删除绑定的字段。
- 提供者令牌和无限回调有效负载不会被保留或记录。
- 现有无界 `oauth_providers.raw` 值在切换时被清除；新的
  值仅包含有限的允许列表配置文件元数据。
- `raw` 清理仅在所有无界写入器被替换且旧后运行
  实例已耗尽。
- 清理是显式运行的数据操作，而不是自动启动时
  或释放迁移。
- 必需和有条件的切换操作使用经过审查、版本控制的
  工件和完整的执行清单；一旦脚本没有未记录的
  接受了。
- OAuth 状态仅与一个意图绑定；重播，提供商不匹配，Session
  不匹配、替换和过期失败关闭。
- 一次性意图消费是由原子服务器端记录强制执行的，从不
  由无状态的Cookie。
- 一个Groupher用户不能绑定同一提供商的两个帐户。
- 意外的重复绑定停止部署并需要单独
  批准的数据迁移；此版本永远不会自动修复它们。
- V1 永远不会取代现有的提供商位置；单一提供商帐户不能
  自助服务被该提供商的另一个帐户取代。
- V1不需要最近的认证；任何后续的逐步强化都会保护 Link
  在取消链接之前，因为链接添加了持久登录凭据。
- 取消链接不需要最近的身份验证，并且不会撤销任何 Browser 会话。
- 所有多行帐户写入都遵循共享的用户优先锁定顺序。
- 取消链接重试行为将 Phoenix 的缺失绑定响应与
  Auth 的故障后期望状态协调。
- 帐户设置可以列出绑定并一致地呈现 `canUnlink`。
- 旧的 Dashboard 范围和直接 GraphQL 帐户管理路径被删除。

## 开放决策

1. 保留哪些规范化提供商资料字段以及保留多长时间？
2. Main、Dashboard、Dash 和 Main 时帐户连接 UI 位于何处
   Apply共存？

## 相关文档

- [`docs/auth/v1.md`](../auth/v1.md)：Browser Auth 和 Session 生命周期。
- [`docs/auth/v2.md`](../auth/v2.md)：服务身份和用户委托。
- [`docs/oauth/overview.md`](../oauth/overview.md)：OAuth场景边界。
- [Auth.js 数据库模型]([[[K188]]]): Auth.js
  用户/帐户适配器语义和帐户链接上下文。
- [Auth.js 提供商参考]([[[K189]]]):
  提供商回调数据和自动电子邮件链接安全警告。
