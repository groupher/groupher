# Auth

> 运行形态：独立 Next.js + Auth.js 应用
>
> UI：独立的系统级登录 UI
>
> 当前状态：Main 和 Dashboard 复用同一套函数，但分别部署 Auth handler

## 定位

`auth` 统一处理 Groupher 各前端应用的 OAuth、登录、登出和 Browser Session。
Main、Dashboard、Apply 以及后续前端应用不再分别部署一套 provider 和 callback
handler，只消费统一登录结果。

该子应用拆分的是认证协议和会话运行边界，不是 Phoenix 的用户领域。用户、
External Identity、账号状态、community membership 和业务权限继续由 Phoenix
管理。

名称使用 `auth` 而不是 `session`，因为 Session 只是其能力之一；OAuth provider、
callback 和登录流程同样属于这个边界。

## 当前状态

当前 Main 和 Dashboard 各自提供：

```text
/api/auth/[...nextauth]
/api/auth/logout
/oauth
```

两个应用共享 `frontend/core/app/auth` 中的 Auth.js handler，但运行时仍各自初始化
provider、处理 callback、读取 secret 和同步 Phoenix token。这属于代码级复用，
不是统一认证服务。独立 `Apply` 出现后会形成第三个认证入口，因此适合收敛成一个
部署。

## 提供的服务

- GitHub 等 OAuth provider 的授权发起和 callback。
- OAuth state、错误和安全返回地址处理。
- 登录、登出、Session 签发、刷新和失效。
- 统一的 Cookie 名称、作用域和生命周期。
- 登录及 callback 所需的少量系统 UI。
- 向 Main、Dashboard 和 Apply 提供一致的用户登录状态。

## 领域边界

### `auth` 负责

- 外部 OAuth/OIDC 协议。
- Browser Session 的生命周期。
- Provider credential 和 callback 配置。
- 登录完成后返回原始前端应用。

### Phoenix Accounts 负责

- 用户和 External Identity。
- Provider identity 的绑定、冲突与账号合并。
- 账号状态、封禁和风险检查。
- Community membership、角色和业务授权。
- Phoenix access identity 和面向子应用的 delegation token。

### Main、Dashboard 和 Apply 负责

- 触发登录或登出。
- 本地读取并验证登录状态。
- 根据 Session 展示用户 UI。
- 把需要领域数据或权限判断的操作提交给 Phoenix。

前端应用不再分别维护 OAuth provider、callback 和 Session 签发逻辑。

## 基本流程

```mermaid
sequenceDiagram
  participant U as Browser
  participant A as auth
  participant O as OAuth Provider
  participant P as Phoenix Accounts
  participant F as Main / Dashboard / Apply

  U->>A: 登录并携带安全的 returnTo
  A->>O: 发起 OAuth authorization
  O-->>A: callback 与 authorization result
  A->>P: 提交标准化 provider identity
  P->>P: 绑定用户并检查账号状态
  P-->>A: 用户和 Phoenix access identity
  A-->>U: 设置 Groupher Browser Session
  U->>F: 访问目标应用
  F->>F: 本地验证 Session
  F->>P: 执行需要领域数据或授权的操作
```

## 公共入口

用户可见 URL 继续由 Gateway 保持稳定：

```text
https://groupher.com/login
https://groupher.com/logout
https://groupher.com/api/auth/*
```

Gateway 把这些路径 rewrite 到独立 `auth` 部署。OAuth provider 只配置一组 canonical
callback，不感知 Main、Dashboard 和 Apply 的实际部署地址。

## Session 与 Delegation Token

Browser Session 表达“用户已经完成登录”，用于 Main、Dashboard 和 Apply 的登录态。
Delegation token 表达“某个服务可以代表该用户，在限定范围内执行某项操作”，由
Phoenix 面向具体下游服务签发。

两者不能混用，也不能把 Browser Session 直接传给 `content-import`、`assets-hub`
等执行应用充当服务授权。

## 关键约束

- 统一签发 Session，但业务应用应能本地验证，不能每次请求都同步查询 `auth`。
- `auth` 不缓存或复制 Phoenix 的完整用户和权限数据。
- 敏感业务操作仍由 Phoenix 检查最新账号状态和权限。
- `returnTo` 必须限制在允许的 Groupher 地址内，避免开放重定向。
- 登录、callback 和 logout 必须使用固定 canonical URL。
- 自定义社区域名不能直接共享 `groupher.com` Cookie；后续应使用安全的跳转和一次性
  交换流程解决跨域登录。

## 迁移方向

首期继续使用现有 Auth.js 实现，只移动运行边界：

1. 建立独立 `auth` Next.js 应用并复用现有 handler。
2. Gateway 将统一登录、callback 和 logout 路径转发到 `auth`。
3. Main 和 Dashboard 删除各自的 Auth route，只保留 Session 消费能力。
4. `Apply` 从开始就使用统一入口。

认证框架、Session 格式和密钥轮换方式等实现选择留到迁移阶段决定。
