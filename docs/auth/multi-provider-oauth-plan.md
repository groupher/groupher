# 多平台 OAuth 登录、注册与手动绑定

> Dev Hub 本地存储路径正在调整，本文中的旧路径及文件名可能已失效。当前实现状态和目标路径见 [Dev Hub 本地存储整理](../architecture/dev-hub-storage-reorganization.md)。

状态：本地实施与验收进行中。目标平台为 GitHub 和 Linux DO，生产开放前须通过第 5 节验收。Auth 验证平台身份，Phoenix 管理站内用户、绑定及 Browser Session。本地使用 Phoenix 短期流程表，登录入口读取平台状态。

## 1. 先验证回调

GitHub 开发应用分别登记登录路径 `/api/auth/callback/github` 和 Link 路径 `/api/auth/accounts/github/callback` 的完整 URI，两条均关闭通配匹配。GitHub OAuth App 可登记最多 10 条 URI，见 [GitHub 更新说明](https://github.blog/changelog/2026-08-14-multiple-redirect-uris-and-token-refresh-for-oauth-apps/)。对每条地址分别完成授权及换码，记录登记 URI、实际 redirect_uri 和结果，隐去 code、token 和 secret。通过后沿用 GitHub 独立 Link 回调。第一批接通开发凭据后，Linux DO 单独检查 Connect 能否登记两条地址，并实际验证换码。

Linux DO 开发应用界面只有一个回调字段，采用登录与 Link 共用回调。Link 使用带随机引用和 nonce 的独立 state，Phoenix 原子领取换码机会，并核对原会话；普通登录继续由 Auth.js 验证自身 state 和 PKCE。两个标签页交叉发起的两种顺序已在本地真实浏览器验证：会话变化时旧绑定被拒，普通登录未误入绑定；被覆盖的普通登录提示重试。实测结果记录在 [Auth README](../../backend/auth/README.md#local-oauth-verification)。

## 2. 登录与平台准入

Auth 使用静态平台配置表，每项包含固定 ID（github、linuxdo）、Auth.js 配置和资料映射，统一输出 provider、平台稳定 ID 和可选资料。GitHub 保持历史 ID；Linux DO 使用 id，username 用作取名建议，头像模板替换尺寸并校验来源。按“所有 Linux DO 用户可登录”的产品要求，在 Connect 验证普通版和青春版最低等级为 0。Linux DO 的 S256 支持以真实换码结果判定，若不支持需评审协议配置。

Phoenix 配置并执行每个平台的准入状态。Auth 和产品界面读取 Phoenix 公开的平台列表展示入口。Phoenix 在登录、创建身份及确认绑定时按当前状态裁决。

| 平台状态   | 已绑定身份登录 | 新身份注册、添加绑定 | 登录入口                 |
| ---------- | -------------- | -------------------- | ------------------------ |
| 关闭       | 拒绝           | 拒绝                 | 隐藏                     |
| 仅已有用户 | 允许           | 拒绝                 | 显示并说明仅限已绑定用户 |
| 开放       | 允许           | 允许                 | 显示                     |

解绑时 Phoenix 在现有用户锁内确认绑定归属，并按同一份准入配置检查删除后是否仍有至少一个允许登录的平台。

开发 e2e 身份继续走内部入口。外部身份按平台和稳定 ID 查找，每个用户每个平台限绑一个账号；同名、同邮箱均不自动关联。

## 3. 注册与重名

已绑定直接登录；合法且可用的用户名直接注册；重名、缺失或不合法时返回 registration_required。在补全页建议可编辑用户名，用户可创建新账号，或取消、登录已有账号后主动绑定。补全前不创建用户或业务会话。Community、Dash 的安全返回地址保留至完成。

Auth 生成随机 flow_ref 并通过 HttpOnly cookie 持有引用。Phoenix/Postgres 在本地及生产使用同一短期流程表，按引用幂等创建，按用户或浏览器持有的引用、用途、状态和有效期推进。批次二一次建齐流程表，含可空的 `code_verifier`、`nonce` 和存放已校验 `returnTo` 的 `return_to` 列。注册补全按需保存返回地址，换码专用字段留空。批次三直接使用这些列。统一 TTL 为 10 分钟。Helper.Scheduler 清理过期行，检查有效期无需等待清理。按客户端限流。auth:oauth:flow 仅授予 Auth，落实到 Phoenix 字段、Dev Hub services.ts 和 Worker 凭据授权配置。

独立 Link 回调使用 S256 时，Auth 在发起授权前生成 verifier，并在 Phoenix 流程行保存 `code_verifier`、用于绑定 state 的 nonce 和已校验的 `returnTo`。仅受信任的 Auth 服务回调操作可取得换码资料，公开摘要和日志不含这些字段。回调校验平台、原会话、state、有效期及前置状态，原子领取本次换码机会；重复回调不能再次领取。授权码由平台一次性使用。换码结束即清除 verifier 和 nonce，安全返回地址保留到最终跳转，再随流程清理。换码成功且目标未绑定时仅推进到待确认；用户确认才在事务中消费整个流程并写绑定。换码被拒或结果不明时终止该流程，重新授权取得新的 code。Linux DO 共用回调路径时，普通登录的协议凭据由 Auth.js 管理；Link 使用独立 state，仍由 Auth 和 Phoenix 管理其 verifier、nonce 及流程状态。

**登录结果与迁移。** 直接更新现有 GraphQL 字段 `signinOauth` 的返回类型，同批更新 Auth、内部 e2e 入口及相关测试。Auth 在已验证平台身份后、写会话 cookie 前调用该字段一次，按结果处理。已登录结果沿用现有 cookie 签发及失败补偿，待补全结果由 Auth 设置流程 cookie 并跳转选名页。这两条路径互斥，JWT 回调不得再次调用登录命令。以下为拟定响应，令牌及引用均为占位值。

```json
{
  "data": {
    "signinOauth": {
      "status": "SIGNED_IN",
      "session": {
        "accessToken": "<token>",
        "accessExpiresAt": "<utc>",
        "browserSessionRef": "<ref>",
        "sessionAbsoluteExpiresAt": "<utc>"
      },
      "registration": null
    }
  }
}
```

```json
{
  "data": {
    "signinOauth": {
      "status": "REGISTRATION_REQUIRED",
      "session": null,
      "registration": { "suggestedLogin": "alice" }
    }
  }
}
```

Auth 随解析请求提交随机 `flow_ref` 和已校验的返回地址。需要补全时 Phoenix 持久化已验证身份，Auth 才把该引用写入流程 cookie。提交选名时 Auth 从 cookie 取引用，调用需要 `auth:oauth:register` 的 `completeOauthRegistration`。Phoenix 重查平台准入，在事务中按该引用消费流程并写用户、绑定；名字被抢占时保留流程并留在表单供重选。取消注册使用同源和 CSRF 校验，清除浏览器持有的流程及 CSRF cookie，未消费的服务端记录到期清理。直接注册继续使用现有身份锁及唯一约束。注册与 Link 共用流程表、到期清理，各自使用独立业务命令。

**失败恢复。** 直接注册和补全注册都必须在同一事务中写入用户与 OAuth 绑定。任一写入失败，整笔回滚。注册行的写入在事务内完成，禁止移入提交后的 `present` 阶段；Browser Session 在提交后创建。会话签发失败或完成响应丢失时，用户可重新授权，按已绑定身份登录原账号；重复提交已消费的引用不得再次创建用户、绑定或签发会话。首版无需额外的注册 attempt 或同一会话重放机制。平台换码结果不明时重新授权。

## 4. 手动 Link

用户在账号设置发起绑定。近期认证定义为最近 10 分钟内通过已绑定方式登录当前站内账号；平台可能复用已有登录态。Auth 从当前浏览器受保护的 Auth cookie 读取 `browserSessionRef`。Phoenix 按该引用定位会话，验证其有效且属于当前用户，仅以该行的 `inserted_at` 计算认证年龄。每次登录创建新行，刷新沿用原行。满 10 分钟或缺少可信时间时，要求重新登录，返回设置页后再次发起。重新登录得到其他站内用户时结束原绑定流程。

Link 回调跳过 signinOauth，按已验证身份查询归属。已属当前用户则将流程标为完成并提示“已绑定”；已属其他用户则终止流程并返回失败页，仅未绑定身份进入确认页。Dash 从 Auth 域读取平台账号摘要，确认时以登录用户、原会话、HttpOnly flow 引用、Origin/CSRF 和待确认状态校验。确认请求携带页面上展示的平台和目标账号稳定 ID，和服务端记录比对，防止旧页面确认另一个目标；身份归属只取服务端验证结果。Phoenix 在确认事务中重新检查归属，以覆盖打开页面后身份被其他用户绑定的情况，再消费流程并写绑定。同一身份重复绑定当前用户幂等成功；已归属其他用户则拒绝。唯一约束保障最终绑定唯一；过期流程重新开始。

1. GitHub 登录后绑定 Linux DO，退出再分别登录，两次得到同一站内 user.id。
2. 回调与确认均不创建用户或 Browser Session，不写、删当前登录 cookies。
3. 同名不自动绑定；不同名也能手动绑定；已属其他用户、同平台第二账号均拒绝。
4. 认证后第 9 分钟刷新，第 10 分钟仍要求重新登录。此时用另一设备登录同一账号，原浏览器发起绑定仍须重新认证；在原浏览器重新登录原账号后再次发起可完成绑定。
5. 取消、到期、会话变化、旧页面目标变化均不能误绑。并发确认只落一条绑定，不能解绑最后一种可用登录方式。已绑定 GitHub 和 Linux DO 时关闭 Linux DO，验证解绑 GitHub 被拒；并发解绑两个开放平台后仍保留一种。
6. 解绑仅移除登录方式，保留站内账号和全部已有会话，包括此前经该平台创建的会话。用原浏览器验证账号仍可访问，另开无会话浏览器用已解绑身份授权：不得回到原 user.id。建议名已占用时进入 registration_required；建议名可用且开放注册时可创建新的独立用户。
7. 若共用回调，交叉测试两个标签页发起登录和 Link，两种顺序都不得将普通登录身份误绑或切换 Link 发起用户。失败提示允许用户重试。
8. 对每个采用独立回调和 PKCE 的平台，验证正确 verifier 可换码、错误 verifier 被拒；失败无绑定、无待确认记录，新授权可重新发起。回调并发重放只有一次能领取换码机会。已属当前用户的回调幂等结束，下一次绑定不受残留流程阻挡。

## 5. 实施顺序与验收

| 批次               | 交付范围                                                                                                                                               | 通过条件                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 一：开发应用验证   | 接通开发凭据、Dev Hub 白名单与静态平台映射。实测 GitHub 双回调、Linux DO 回调数量、S256 及两类账号准入                                                 | 将登记地址、换码与准入结果写回 Auth README。GitHub 历史 ID 不变，内部 e2e 登录可用；分别记录 Linux DO 登录、Link 是否具备实施条件                                                       |
| 二：完整登录与注册 | 原位更新 signinOauth，同批接入 Auth 分流、内部 e2e、选名页和两个产品入口。按 §3 一次建齐流程表，再按下列顺序切换登录合约。无冲突首登可先在开发环境验收 | 已绑定登录、直接注册、重名补全均通过；并发抢名可重选；签发失败或响应丢失后重新授权得到原 user.id；无 scope 无法补全。Community、Dash 均返回发起页。完成上述验收后方可公开 Linux DO 注册 |
| 三：手动绑定与解绑 | 按实测选择回调，接入确认页、设置页与可用登录方式检查，修正 AccountUnit 列表、点击目标、via_github 和双语文案                                           | Dev Hub 通过第 4 节适用验收。旧 Durable Object 残留的核对与清理以 [V2 第 4 节](./multi-provider-oauth-v2.md#4-执行顺序)为准；不以当前流程存在 DO 在途回调为前提                         |

**批次二发布顺序**

1. 暂停新 OAuth 授权和本地 e2e 登录任务。已经跳转至平台的用户仍可能在切换期间回调；受影响的用户在入口恢复后重新发起一次授权。
2. 发布新版 Phoenix。通过 Dev Hub 重启已更新至本批版本的本地 Auth 服务，使普通登录查询和 `development-session.ts` 内部登录路径都使用新返回形状，再发布新版 Auth。
3. 恢复入口前，通过本地内部 e2e 登录做一次冒烟，确认能建立有效 Browser Session，并在发布环境验证新版 Auth 能消费 Phoenix 的登录结果。通过后恢复登录入口和 e2e 任务。

各能力上线前，单独配置生产 callback、secret 和开放状态，记录已验收平台、返回页、冲突和失败恢复结果。

每批同步本方案和 [roadmap](../roadmap.md)，登录合约同步 [Auth V1](./v1.md)，绑定行为同步 [Link/Unlink](./link-unlink-oauth.md)。本轮不合并两个已有站内用户。

## 6. 凭据准备与环境配置

Client Secret 不需要通过聊天发送，不进入文档、仓库、前端变量或日志。
开发环境使用 Linux DO 的独立开发应用：

```dotenv
AUTH_LINUXDO_ID=
AUTH_LINUXDO_SECRET=
```

上述键已接入 Auth 和 Dev Hub 白名单。本地开发凭据通过 Dev Hub Auth 配置面板维护，保存到 Git 忽略的 `local/dev-hub/config/auth.env`。保留其中既有凭据，不整文件覆盖，不回显 secret。

保存正式配置不会自动重启服务；需要启动或重启时统一通过 Dev Hub 执行。

| 环境 | Linux DO callback                                           | 凭据来源                                  |
| ---- | ----------------------------------------------------------- | ----------------------------------------- |
| 本地 | `https://auth.groupher.localhost/api/auth/callback/linuxdo` | Auth 集中本地配置                         |
| 生产 | `https://auth.groupher.com/api/auth/callback/linuxdo`       | Auth Worker 的部署 secret，独立于开发应用 |

本地规范见 [Dev Hub 集中本地配置](../architecture/dev-hub-local-config.md)。
生产通过现有部署渠道配置同名 secret，并补齐 Worker binding 声明；不上传本地 env 文件。
应用主页可以是产品主页，它不决定 OAuth 回调，也不要求静态 Landing 支持登录。
