# 前端 Account、Passport 与 Gate

> 状态：current
>
> 更新：2026-10-17

## 目的

Groupher 的 Header、页面、编辑器和操作按钮必须看到同一个登录用户，不能各自读取 Cookie、
请求 `sessionState` 或维护一份 `isLogin`。前端统一由 AccountStore 保存当前用户；Passport
描述用户拥有的权限；前端 Gate 使用 Passport 提前控制页面和操作；Phoenix Gate 执行最终
授权。

```text
Phoenix sessionState
  -> AccountStore: current user + Passport
  -> frontend Gate: page, navigation and action availability
  -> component render

browser command
  -> Phoenix Passport / Gate
  -> final authorization
```

前端 Gate 改善界面体验，但不是安全边界。任何敏感读取和写入仍由 Phoenix 根据请求中的真实
用户、最新 Passport、资源和 Lifecycle 状态重新授权。

## 统一语言

```text
AccountStore  当前登录用户的前端唯一来源
Passport      用户拥有的权限
Gate          某项操作是否允许
```

不要为同一概念再引入 `passportFacts`、页面级 `isLogin` 或独立权限 Store。

### AccountStore

AccountStore 拥有当前用户、当前用户的 Passport、登录状态和恢复中的状态，以及登录、注销或
Session 失效后的统一刷新结果。

Header、AccountUnit、路由边界和业务组件只能订阅 AccountStore。它们不得重新解析 Cookie，
也不得单独请求 `sessionState` 后保存另一份用户状态。

### Passport

Passport 是 Phoenix 返回的业务权限数据。`CMS.Passport.Registry` 定义合法规则和要求，
`CMS.Passport.Assignment` 负责保存，`CMS.Passport.Authorization` 负责后端判断。

Admin 中现有 PassportEditor 是 Passport 的管理入口，不是另一套权限系统：

```text
PassportEditor
  -> updateModeratorPassport
  -> Phoenix CMS.Passport
```

当 PassportEditor 修改当前用户时，保存成功后必须重新获取 `sessionState`，以服务端返回结果
刷新 AccountStore；不得在浏览器中手工拼接 Passport。修改其他用户时只刷新管理员和目标用户
数据，不改当前 AccountStore。

### 前端 Gate

前端 Gate 只读取 AccountStore 中的用户和 Passport：

```ts
const gate = useGate()

gate.can(GATE_ACTION.DOC_UPDATE, { community })
```

它可以控制页面和导航入口、按钮状态、发起操作前是否要求登录，以及已登录但没有权限时的说明。
它不得读取 Cookie、请求当前用户、保存 Passport，或者替代 Phoenix Gate。

action 对应的 scope、Passport grant 别名、thread grant 和 owner fallback 来自 contracts 生成物；
例如 `doc.update` 会检查 `doc.edit`，不能在 hook 或页面内重新手写映射。

## 应用认证策略

不同应用有不同的匿名访问要求，不能共享一种首屏策略。

| 应用       | 匿名访问                   | SSR 用户策略                           | AccountStore       |
| ---------- | -------------------------- | -------------------------------------- | ------------------ |
| Dash       | 不允许                     | SSR 必须获取确定的当前用户和 Passport  | 必须在应用入口建立 |
| Community  | 允许                       | SSR 只读取公开数据；浏览器按需恢复用户 | 必须支持匿名初值   |
| Apply      | 页面允许，具体操作要求登录 | 公共页面不得因匿名被阻断               | 必须在应用入口建立 |
| Landing    | 允许                       | 完全公开                               | 当前不需要         |
| Inspire Me | 允许                       | 完全公开                               | 当前不需要         |
| Widget     | 允许                       | 公开嵌入                               | 当前不需要         |

### Dash

Dash 是受保护应用。正常首屏在 SSR 阶段完成 `sessionState`，再把确定的用户和 Passport 作为
AccountStore 初值输出：

```text
Dash request + Cookie
  -> Dash SSR
  -> Phoenix sessionState
  -> AccountStore seed
  -> Header and route render the same user
```

Dash 根边界统一处理三种结果：

```text
authenticated  -> create AccountStore and render Dash
recovering     -> show one shared pending state
anonymous      -> show the shared sign-in flow
```

业务页面的 server loader 仍须携带凭证，并正确区分未认证和无权限，但不得再生成独立的
`authRequired` UI 状态。`401` 使 AccountStore 进入统一的失效或恢复流程；`403` 显示无权访问。

浏览器端 `sessionState` 只用于凭证恢复、登录变化和重新校验，不是 Dash 正常首屏的主要来源。

### Community

Community 必须允许匿名阅读，并保持公开 SSR 和公共缓存：

```text
Community SSR
  -> public content only
  -> render anonymous-capable HTML
  -> browser sees signed-in hint
  -> sessionState recovery
  -> update AccountStore when a user exists
```

登录提示 Cookie 只能触发恢复，不能证明已经登录。恢复期间不得把公开页面挡在 Account loading
界面后面。

### Apply

Apply 页面本身允许匿名访问，但申请、查看自己的申请、取消申请和审核操作有明确门槛：

```text
public Apply page
  -> anonymous user may read
  -> protected action checks AccountStore
     -> anonymous: open shared sign-in flow
     -> signed in: frontend Gate checks Passport when required
     -> Phoenix performs final authorization
```

审核操作除登录外还必须检查相应 Passport。Apply 根节点统一建立 AccountStore；业务 loader
仍负责读取申请数据和执行服务端访问控制，但不得成为另一份前端登录状态来源。

## 错误与状态收口

```text
401 / invalid session
  -> clear or recover AccountStore once
  -> protected app enters shared sign-in flow

403 / forbidden
  -> keep the current user
  -> render no-permission state

public anonymous state
  -> render public content
  -> never pretend that a signed-in hint is proof
```

同一页面不得出现 Header 显示已登录、业务区域显示需要登录的状态组合。

## 实施状态

当前实现已经完成：

1. Dash 由应用级 `DashAccountBoundary` 统一处理恢复、匿名和已登录状态，Doc Editor 不再维护
   页面级 `authRequired`；
2. Apply 根节点建立 AccountStore，公共页面允许匿名，申请和审核界面消费同一账户状态；
3. `useGate` 是前端 Gate 的统一入口，Apply 审核入口和操作使用类型化 action；
4. PassportEditor 修改当前用户后重新获取 `sessionState`，修改其他用户不触碰当前 AccountStore；
5. Gate Action 已接入跨语言 contracts，生成链与 Registry 完整性测试见
   [`contracts.md`](./contracts.md#gate-action-contract)。
