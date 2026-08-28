# Auth Refresh Issue

## 当前结论

本次只修复认证恢复链路，不改变 Community/Dash 的 SSR 取数边界、缓存策略或叶子
页面的数据加载方式。

登录状态由两层组成：

| 状态                 | 保存位置               | 作用                          |
| -------------------- | ---------------------- | ----------------------------- |
| Browser Session      | Auth host-only cookie  | 维持长期登录会话              |
| Phoenix access token | Groupher 共享域 cookie | 供 GraphQL 请求鉴权，短期有效 |

access token 过期不等于 Browser Session 已退出。浏览器已有的
`refreshSession()`、`withAuthRetry()` 和 `createAuthFetch()` 负责刷新并重放请求。

本次实际复现的是 access token 自然过期后的另一条路径：浏览器仍保留 Browser Session
和可读的 `groupher-auth.signed-in=1` hint，但短期 access token 已不再随请求发送。SSR
因此不能调用 `loadAccount`，过去会把账户 seed 固定成 `{ loading: false, user: null }`；
客户端又把这个 SSR seed 当作已确认的匿名状态，账户探测不会启动，页面就静默显示为未登录。

## 已确认的故障边界

SSR loader 使用过期 access token 时可能抛出 `TOKEN_MISSING` 或 `TOKEN_EXPIRED`，使
TanStack SSR 请求以 500 结束。`RouteError` 会尝试从 GraphQL 错误中解析认证语义，
但 SSR boundary 稳定传输的是 `Error.message`，自定义 `code` 不是可靠的序列化契约。
因此字段丢失时，`resolveAuthFailure({})` 会得到 `'none'`，错误会落入普通错误态，
而不是被识别为 refresh。

这次不通过迁移所有 loader 来解决上述 SSR 架构问题；先修复已有恢复边界自身的去重
和生命周期问题，避免多个 recovery 挂载点互相触发或被旧状态永久拦截。

## 本次修复

### 自然过期、access cookie 缺失

`frontend/dash/src/server/community.ts` 和 `frontend/community/src/server/community.ts` 在
没有 access token 但仍有登录 hint 时，返回 `{ loading: true, user: null }`，并让 Community
请求保持 private；这不会改变现有缓存边界。`frontend/core/stores/account/hooks.tsx` 在
hydration 完成后识别该 seed，显式执行一次 `sessionState` probe。该 probe 不依赖全局
`staleTime=60s`：通过 `query.refetch()` 强制进入现有 `createAuthFetch`，再沿用
`refreshSession()` single-flight 和一次 replay。SSR 与客户端首帧也不再直接读取 cookie，
避免 hydration mismatch。

登录 hint 只表示“可能存在 Browser Session”，不代表 access token 有效；只有 probe 成功
返回有效用户后才恢复账户态，probe/refresh 失败仍进入既有登录流程。

`frontend/dash/src/components/AuthRouteRecovery.tsx` 使用模块级活动 recovery attempt：

```text
同一活动窗口内的多个 AuthRouteRecovery
  -> 共享一次 refreshSession()
  -> refresh 成功 -> 当前 URL 最多 reload 一次
  -> reload 后仍失败 -> 不再 refresh，直接 requestLogin
  -> refresh 失败 -> 只 invalidate + requestLogin 一次
  -> attempt 完成（成功或失败）后清理模块状态
```

模块级状态只负责同一 JS runtime 内的挂载去重；按当前 URL 保存的短生命周期
`sessionStorage` marker 负责跨 `window.location.reload()` 熔断。它不是永久登录状态：
正常页面成功挂载后由 `DsbShell` 清理，恢复 attempt 成功或失败后模块级状态也会清理。
因此 refresh 返回成功但新 SSR 请求仍认证失败时，最多经历一次 reload，随后进入登录，
不会形成无限循环。`refreshSession()` 自身继续提供跨请求的 single-flight。

### Marker 的清理边界

当前 marker 的清理点是 `frontend/dash/src/components/DsbShell.tsx` 的成功挂载 effect：

```text
/$community 成功加载
  -> DsbShell 挂载
  -> 清理当前 URL 的 recovery marker
```

这与当前认证 loader 全部位于 `/$community` 子树的事实一致。如果未来 recovery 壳或
认证 loader 上移到 `__root` 的 `defaultErrorComponent`，清理点也必须同步上移到 root
level 的成功挂载点，或抽成统一的 auth lifecycle 组件；否则 marker 可能残留，导致同一
URL 下一次 token 过期时跳过 refresh 直接进入 login。

refresh 失败并进入 login 时 marker 会保留，直到用户成功回到原 URL 并完成
`DsbShell` 挂载。这是有界的 fail-closed 行为，不会形成 reload 循环；用户取消登录时
保留该 marker 也属于当前设计。

## 独立的安全维护

`backend/auth/package.json` 中 `@auth/core` 从 `0.41.0` 升级到 `0.41.3` 是独立的安全
维护项，不是本次 access-token refresh/replay 逻辑的修复。该升级应独立审查和发布，
不能作为本问题已解决的证据。

## 非本次范围

- 不迁移 Community 或 Dash 的 SSR 数据到客户端。
- 不删除现有 `RouteError` 的 refresh 分支。
- 不把 `@auth/core` 安全升级混入 refresh 修复的因果链。
- 不改 CDN、`Cache-Control`、全局 TanStack `staleTime` 或叶子 loader；账户恢复 probe 只在
  需要时显式绕过全局 staleTime。
- 不把“SSR 500 + recovery 壳”描述成已经解决；若要消除该状态码，需要另一个明确的
  SSR 公共壳/typed loader 方案，并单独评估其影响范围。

## 验收重点

1. access token 过期但 Browser Session 有效时，同一 recovery 窗口最多 refresh 一次。
2. refresh 成功后当前 URL 最多 reload 一次；reload 后仍失败直接进入 login。
3. refresh 失败时只进入一次 `requestLogin({ returnTo })`。
4. 同一 URL 的 recovery marker 在正常页面成功挂载后清理，未来新的过期窗口仍可恢复。
5. 模块级 coordinator 在 attempt 结束后清理，并发挂载仍只执行一次 refresh。

已验证：auth E2E 的两个 P0 协议场景通过：一条覆盖“access cookie 缺失时 SSR 返回 200，
客户端受保护请求触发一次 refresh 并成功 replay”，另一条真实拦截 refresh 为 204 但不写
cookie，覆盖“reload 后 SSR 再次认证失败 → 不再 refresh → 直接进入 login”。账户 hook
单测覆盖“SSR 没有 user 但仍有登录 hint 时，hydration 后执行 probe”；recovery guard
单测覆盖 marker 的单 URL 一次性语义、URL 隔离和成功清理。
