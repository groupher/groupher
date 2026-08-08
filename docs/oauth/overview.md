# OAuth Overview

本文梳理 Groupher 里几类容易混淆的 auth / OAuth 场景。核心原则是：
Phoenix 继续作为用户身份、账号绑定和业务权限的 source of truth；其它 auth 组件只负责
协议、会话或授权令牌边界。

## 三类场景

```text
1. 人登录 Groupher
   GitHub / Google / Apple / Customer IdP
     -> Groupher Auth
     -> Phoenix signin/link
     -> Browser session + groupher-auth.token

2. 外部客户端访问 Groupher
   MCP / Agent / third-party API client
     -> Groupher OAuth Provider
     -> User consent + scoped bearer token
     -> Protected MCP/API routes

3. 客户平台账号登录 Groupher
   Customer OIDC/SAML IdP
     -> Groupher Auth
     -> Phoenix tenant user mapping
     -> Browser session + groupher-auth.token
```

这三类共享 Phoenix 的用户和权限体系，但入口协议不同。

## 现有 Web 登录

当前 `backend/auth` 是独立的 Hono + Auth.js Core 应用，不依赖 Next.js runtime，也不使用
`next-auth` 包。它直接调用 `@auth/core` 来处理 OAuth provider、callback、state、PKCE
和 Auth.js browser session。

现有链路：

```text
Browser
  -> auth.groupher.com/api/auth/*
  -> @auth/core
  -> GitHub OAuth
  -> Phoenix signinOauth
  -> Set-Cookie: groupher-auth.token
  -> Main / Dashboard / Apply
```

`@auth/core` 在这里只承担很窄的协议职责：

- 发起和完成第三方登录。
- 管理 OAuth callback、state、CSRF、PKCE。
- 维护 Auth.js 自己的 browser session cookie。
- callback 成功后把 provider identity 交给 Phoenix。

它不负责 Groupher 用户模型、passport、community role、ownership 或业务权限。

## Phoenix 的边界

无论 Web 登录底层继续使用 Auth.js Core，还是未来改成 Better Auth，Phoenix 都继续拥有
最终业务身份和权限：

- Groupher user。
- External identity / OAuth provider account。
- 账号绑定、冲突、合并和封禁状态。
- Community membership、passport、moderator、root 等权限。
- Post、doc、asset 等资源 ownership 和可见性。
- 面向内部子服务的 delegation token 或 service trust 判断。

Auth 服务只证明“这个浏览器用户来自某个外部身份来源”。Phoenix 决定“这个外部身份对应
哪个 Groupher 用户，以及这个用户能做什么”。

## Auth.js Core 与 Better Auth

`@auth/core` 是 Auth.js 的底层 core API，适合当前这种轻量、集中、Web 标准
`Request -> Response` 的 Hono 集成。它的优点是当前迁移面小，已经和现有 cookie /
Phoenix exchange 逻辑对齐。

需要注意的是，`@auth/core` 是偏底层的 adapter API，不应在业务代码里到处直接依赖。
当前直接调用应限制在 `backend/auth/src/auth.ts` 这一层。

Better Auth 可以视为更完整的 application auth framework，覆盖 email/password、
social login、session、account linking、2FA、passkey、organization 等能力。但这些能力
不等于 Groupher 一定需要迁移过去：

- 如果只是把多个第三方登录 provider 标准化为 Phoenix user，Better Auth 的收益有限。
- 如果希望 Auth 服务自己承担更多账号能力，Better Auth 才更有价值。
- 如果 Phoenix 继续是用户和权限中心，不应让 Better Auth 再建立一套业务用户 authority。

因此 Better Auth 是 Web 登录层的候选替换或增强，不是 API/Agent OAuth provider 的替代。

## MCP、Agent 与第三方 API 授权

这是另一条线：不是“人如何登录 Groupher”，而是“外部客户端如何被用户授权访问 Groupher
资源”。

```text
MCP/API Client
  -> /authorize
  -> Groupher user login + consent
  -> /token
  -> issued scoped bearer token
  -> protected /mcp or API routes
```

这里更适合使用 `@cloudflare/workers-oauth-provider` 一类 OAuth Provider 库。它的定位是
在 Cloudflare Workers 上实现 OAuth 2.1 provider / protected resource 相关协议，尤其适合
MCP server、agent client 和外部 API client。

这条线需要的能力包括：

- OAuth authorization server metadata。
- Protected resource metadata。
- `client_id`、`redirect_uri` 和 client capability 管理。
- Authorization code + PKCE。
- Scope、resource、audience 校验。
- Token issue、refresh、revoke。
- User consent 页面和授权记录。
- MCP/Agent client 的 bearer token 验证。

这些能力不是 `@auth/core` 的主场。用 Auth.js Core 硬扩 `/authorize` 和 `/token` 会把
网页登录 session 框架改造成 OAuth authorization server，边界不清晰。

## API Token 与 OAuth Provider

Personal API Token 可以保留，但它适合开发者和内部自动化：

```text
User manually creates token
  -> copy token
  -> script / CI / server-to-server integration
```

Agent、Skill、MCP 或第三方客户端更适合 OAuth Provider：

```text
Client requests access
  -> user reviews requested scopes
  -> Groupher issues scoped token
  -> user can revoke per client
```

两者可以并存：

| 场景                         | 推荐方式           |
| ---------------------------- | ------------------ |
| 个人脚本、CI、内部服务       | Personal API Token |
| MCP client、AI agent、skill  | OAuth Provider     |
| 第三方平台代表用户访问资源   | OAuth Provider     |
| Server-to-server 固定集成    | API Token 或 OAuth |

API Token 简单，但缺少标准 consent、client identity、redirect validation、refresh/revoke
和 MCP 生态需要的发现协议。面向普通用户或第三方 client 时，OAuth Provider 是更正确的产品
和协议边界。

## Groupher 作为 OAuth Host

一旦 Groupher 管理 `client_id` 和 `redirect_uri`，就意味着 Groupher 成为 OAuth
authorization server，也就是 OAuth host。

这不必然表示“别人可以用 Groupher 登录任意网站”。更准确的第一阶段语义是：

```text
第三方应用使用 Groupher 授权访问 Groupher 资源
```

也就是：

- Connect to Groupher。
- Authorize this client to access your Groupher data。
- Grant `docs:read`、`posts:write`、`assets:read`、`community:moderate` 等 scopes。

只有当产品目标变成让第三方网站把 Groupher 当身份提供方时，才需要设计
`Sign in with Groupher` 这种 identity provider 语义。当前更合理的是先做授权访问
Groupher API/MCP，而不是做通用社交登录平台。

## 客户账号登录 Groupher

客户平台自己的账号登录 Groupher 是第三种场景，通常是 Enterprise SSO、BYOID 或 IdP
federation。它属于 Web/Auth 登录体系，不属于 MCP/API OAuth Provider。

推荐链路：

```text
Browser
  -> Groupher Auth
  -> Customer OIDC/SAML IdP
  -> Groupher Auth callback
  -> Normalize external identity
  -> Phoenix signin/link
  -> Set-Cookie: groupher-auth.token
```

OIDC 适合作为第一阶段，因为它和现有 OAuth/OIDC provider 模型接近。SAML 配置和调试成本
更高，除非有明确客户需求，否则不应优先实现。

这类能力需要一个多租户 SSO connection 模型：

```text
sso_connections
  id
  tenant_id / customer_id
  type: oidc | saml
  issuer
  client_id
  client_secret
  discovery_url
  domains
  enabled
  claim_mapping
```

客户 IdP 只负责证明“这个人是客户平台里的某个账号”。Phoenix 仍负责把这个 external
identity 映射到 Groupher user，并计算这个用户在 Groupher 中的权限。

## 建议分层

```text
Groupher Auth
  - 给人用
  - Web login / logout / callback
  - GitHub, Google, Apple, OIDC customer IdP
  - Browser session + groupher-auth.token

Groupher OAuth Provider
  - 给外部 client 用
  - MCP / Agent / third-party API authorization
  - client_id / redirect_uri / scope / token lifecycle
  - scoped bearer token

Phoenix
  - source of truth
  - user, external identity, account state
  - membership, passport, ownership, business permission
```

短期建议：

1. 保留现有 `backend/auth` 作为 Web 登录入口。
2. 多第三方登录 provider 继续通过 Auth 服务进入 Phoenix。
3. 客户账号登录优先设计 OIDC SSO connection，不急于引入 SAML。
4. MCP/Agent/API client 授权单独引入 OAuth Provider 层，不复用 browser session。
5. Personal API Token 作为开发者能力保留，但不替代面向普通用户和第三方 client 的 OAuth
   consent flow。
