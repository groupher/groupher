# 多平台 OAuth V2：平台接入收敛与流程验收

状态：**V2 本地实施与验收进行中；平台定义和展示映射已收拢，仍需完成真实平台及生产验收**。本文件是 [多平台 OAuth 方案](./multi-provider-oauth-plan.md)的后续，不替代 [Auth V2 服务身份与用户委托](./v2.md)。当前本地实现支持 GitHub 和 Linux DO；本地 mock 与自动化测试不能代替真实平台、真实 Phoenix 事务和生产验证。

## 1. 目标与边界

登录、注册、Link 和 Unlink 复用现有业务流程。新增常规 OAuth 平台时，改动应集中在该平台的 Auth 接入、Phoenix 准入配置、前端展示、环境配置和测试；不再修改每个流程中的平台二选一分支。第三方协议差异必须实际适配和验证，不能承诺所有平台都只需填几个配置项。

不引入插件系统、动态加载、通用认证框架或多余的中间层；不保留旧接口、旧页面或兼容分支。已有 OAuth 协议和安全检查保持不变。本轮不合并站内账号，不重设计登录和绑定业务，不增加注册 attempt 表，不因增加平台默认引入数据库迁移。

## 2. 当前问题

- Phoenix 已按 `provider + provider_id` 管理身份，注册、绑定、解绑和会话的核心业务可复用；但 `OauthProviders` 的公开平台列表和运行时准入状态仍需逐个平台配置。
- 原实现的登录资料映射及 Link 发起、回调和换码含 GitHub/Linux DO 分支；目前 Auth 已引入静态定义表，未知平台被拒。遗留 Durable Object 的解析仍需按第 4 节核对后清理。
- 前端已使用统一展示映射，并在运行时过滤不认识的平台；未知绑定显示中性名称，不再误显示为 GitHub。
- 旧的独立注册页面 E2E 已改为经过 mock GitHub 授权、Auth callback、原页面 modal 的浏览器流程；Community、Dash、占名取消和过期场景已运行。真实平台和真实 Phoenix 事务仍须分别验证。
- 现有方案和 Auth README 仍有旧注册页面或历史验收描述；生产配置和开放验收未完成。当前工作区的 Link 运行路径使用 Phoenix `oauth_flows`，`LINK_INTENTS` 已无调用方，但 Worker 声明、导出和 binding 仍在；生产部署和其他 Worker 的实际依赖尚未核实。

## 3. 最小实现设计

### 3.1 Auth：一个静态平台定义表

Auth 在现有服务内维护固定注册表，键为明确允许的 provider ID，不接收客户端提供的 endpoint、回调或执行代码。每项就近组织：

- Auth.js 登录 provider 配置，以及将**已验证的**登录资料转换为统一身份的函数。
- Link 所需的授权 URL、code 换取已验证身份的函数，以及该平台使用的回调模式和精确路径。需要 S256 的平台生成和使用现有 verifier；不支持或有特殊要求的平台单独验证并明确处理。
- 授权、token、userinfo 等平台端点由平台定义指定。为独立 E2E 栈提供仅服务端控制的测试配置覆盖；生产使用固定可信端点，禁止从客户端或请求参数接受端点。测试端点限定到受控测试环境，使用测试凭据，生产启动时拒绝测试覆盖，禁止将生产凭据发送至 mock。
- 从服务端环境读取的凭据配置；secret 不进入响应、浏览器、日志或文档。

统一身份至少包含固定 provider ID 和平台稳定账号 ID；login、nickname、avatar 等是经校验的可选展示资料。平台映射只负责协议和资料转换，不能决定站内账号归属、绕过 Phoenix 准入或直接写用户。GitHub 和 Linux DO 各自迁入此结构，删除现有散落的二选一分支；不为每个 provider 复制登录、注册、Link 或 Unlink 流程。

未知或未注册的平台在发起登录、Link 和回调边界明确拒绝；回调路径必须与其注册的平台及 state 匹配。GitHub 保持当前独立 Link 回调；Linux DO 保持普通登录和 Link 共用回调，按现有 state 机制分流。若未来平台有其他回调能力或 PKCE 要求，应在该平台接入定义中表达并验证，不能假设均与已有平台一致。保留当前 flow 的原子领取、单次换码、nonce/state、会话归属与过期检查；不得用动态 URL 或未经验证的 profile 推断平台身份。

GitHub OAuth App 支持并推荐 S256 PKCE；现有 GitHub Link 路径由 Groupher 显式发送 challenge 和 verifier，应继续保留并验证，不能假定 GitHub 忽略这些参数。GitHub 登录路径使用 Auth.js provider，当前安装的 `@auth/core` 0.41.3 在未显式配置 checks 时默认使用 PKCE；实际授权请求和回调行为仍需测试验证，是否显式调整登录检查另行决定。先前错误 verifier 的本地试验没有捕获平台响应，只能确认换码失败，不能独立证明平台拒绝的原因。其他平台按其实际协议能力验证，不默认所有平台都支持 S256。参见 [GitHub OAuth App 授权文档](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)。

静态注册表是实现方向，不要求引入基类、工厂或一套通用适配器接口。只有两处以上确实相同的代码才考虑进一步共享；如果某平台协议特殊，保持局部实现即可。

### 3.2 Phoenix：准入与身份业务

在现有 `OauthProviders` 中用一处配置登记公开 OAuth 平台及各环境的 `open`、`existing`、`closed` 状态，`public_list` 从该配置派生，未知平台默认关闭。公开属性和准入状态是两个维度：本地和独立 E2E 环境的内部 `e2e` 身份必须保持 `open` 且 `public = false`，生产保持 `closed`。可用公开属性标记或将内部身份从公开配置中剥离，但不能通过关闭 `e2e` 达到隐藏目的，否则内部登录会失败。禁止简单返回现有状态 map 的全部非关闭项，否则会暴露本地 `e2e`。新增平台只需在此处登记一次并配置对应环境状态。状态在登录、创建身份、确认绑定和解绑后剩余可用方式检查时由 Phoenix 再次裁决，不能仅依赖前端列表或 Auth 注册表。

复用现有 `signinOauth`、注册补全、Link 和 Unlink 业务及数据表；新增 provider 不改变用户与绑定的唯一约束。注册的用户和 OAuth 绑定仍须同事务提交，提交后的 `present` 只创建 Browser Session 等事务后效果，不能写注册行。不可按邮箱、用户名自动关联或合并已有账号。

### 3.3 前端：一份展示映射

在 Core 的现有 OAuth 常量附近集中维护支持平台的 ID、显示名称和 SVG 图标；登录按钮、加载态、注册 modal 和登录方式列表统一读取，避免各自写平台判断。平台开关仍以 Phoenix 返回状态为准，前端映射只管展示，不授予平台准入。

保留明确的 TypeScript provider 联合类型和运行时校验：未识别平台不得出现在登录或绑定操作中；对已有绑定等只读展示，显示中性的未知平台提示而不是冒充 GitHub。新增平台只需增加对应展示项和图标，不新建通用 UI 系统。

注册回调返回用户发起登录的安全地址，在原页面打开 modal；flow ref 保留在 Auth 的 HttpOnly cookie，不放 URL、前端存储或日志。注册成功刷新当前页面登录状态；取消、用户名占用、到期和失败有明确反馈。登录、注册及账号操作沿用已确认的 modal 宽度与主题样式。

### 3.4 新增平台的实际改动清单

1. 在 Auth 添加该平台协议配置、身份映射和 Link 所需的授权/换码处理，并注册到静态定义表。
2. 在 Phoenix 单处登记公开 provider ID 和环境准入，生产默认关闭；为新平台配置独立的开发与生产凭据和实际支持的精确 callback。检查 Auth Worker 的 secret binding、`TWorkerEnv`、Dev Hub 的 `externalEnvKeys` 和相关断言，并通过本地 Auth 的 `config/auth.env` 配置面板提供开发凭据；不得把 secret 放入仓库或输出日志。
3. 在前端增加平台类型、展示名称、图标及必要的双语文案；统一映射消费这些资料。
4. 覆盖该平台的授权、资料映射、回调、错误和安全行为；在真实开发应用验证平台特有要求，再决定是否开放。

除该平台确有特殊限制，不修改通用登录、注册、确认绑定、解绑、Browser Session、数据表或公共 API；如果实施中必须修改，记录原因并补充覆盖。新增平台仍需多处明确登记，不要求跨前后端共享一份自动生成的配置。

## 4. 执行顺序

1. **建立可运行的 mock 基线。** 先最小化落地 §3.1 的服务端端点测试配置，将 GitHub 和 Linux DO 的现有授权、换码及 userinfo 硬编码地址接入对应配置，不先重构其他流程。仅覆盖 client ID 和 secret 不能使请求指向 mock。独立 E2E 栈复用 `github` provider ID，仅向该 E2E Auth 实例注入 mock 授权、token 和 userinfo 端点及测试 `AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`（当前 Playwright 配置未提供这两项），前端和公开列表不增加 mock 平台；测试能力参考现有 `createApp` 可选注入约定，只在 E2E 入口接入，不新增生产测试路由。受控 mock provider 实现 authorize、token、userinfo、state、一次性 code 和 PKCE 检查；mock GitHub profile 提供邮箱，或覆盖 Auth.js 的额外邮箱查询；测试请求不能提供 endpoint，生产不能使用 mock 覆盖。mock Phoenix 的 `signinOauth` 须按测试场景返回 `REGISTRATION_REQUIRED`，记录 Auth 实际生成的随机 flow ref、已验证身份和 returnTo；摘要与完成注册消费同一测试流程，并提供重名、到期及重复提交场景。现有固定 flow ref 的摘要/完成桩不构成完整往返；`/api/auth/test-login` 仅可用于独立会话冒烟。修复旧 E2E，从 Community、Dash 的发起页面分别走登录 → mock 授权 → Auth callback → 原页面 modal → 完成注册，验证 cookie、登录状态和原地址，以及取消、占名重试、到期和缺少 flow cookie。mock 测试不冒充真实平台或真实 Phoenix 事务验证。
2. **收拢平台差异。** 将上述最小端点配置纳入 Auth 静态定义表，迁移 GitHub/Linux DO；合并前端展示映射，整理 Phoenix 公开平台与内部测试身份配置。同步删除被替代的分支，检查运行配置及测试身份入口，不得新增旧接口兼容层。
3. **回归现有两平台。** 覆盖登录、直接注册、重名 modal、Link/Unlink 和平台准入；在本地以 Dev Hub 运行的真实入口验证原页面返回、两平台授权换码及共享回调分流。所有真实账号操作应记录影响，不自动合并账号。
4. **独立清理旧 Durable Object。** 先核对生产和预览环境的实际部署版本、所有引用该 namespace 的 Worker、存量数据和回滚要求。当前工作区的 Link 不调用该 binding，不以当前代码中存在在途 DO 回调为前提。确认没有线上依赖后删除 `LINK_INTENTS` binding、Worker 类型和 `LinkIntentObject` 导出及其仅供 DO 使用的代码；保留 `link-intent.ts` 中仍供 Link 使用的 state/PKCE helper。namespace 是否删除另行确认：删除会永久移除存储，需按环境当前部署方式执行相应 class 生命周期变更，并验证部署结果；仅移除 binding 不等于删除 namespace。参见 [Cloudflare Durable Object class lifecycle](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)。
5. **新增平台验证。** 选择有明确需求的第三个平台时才做真实接入；先用测试证明通用流程无需增添平台分支，再以其开发应用验证协议差异。没有第三个平台需求时，不为演示而上线虚构平台。
6. **生产切换及回滚。** 原有登录合约切换遵循 [原方案第 5 节](./multi-provider-oauth-plan.md#5-实施顺序与验收)的批次二顺序，暂停入口、处理在途请求并完成内部登录冒烟。新增平台必须先部署识别该平台的 Auth 和前端版本，此时 Phoenix 保持 `closed`；再配置并核实该环境的精确 callback、独立 secret 和 Auth 服务 scope；随后切到 `existing`，验证已有绑定用户可以实际登录并回到发起页面；通过后才可按产品决策切到 `open`。没有已有绑定用户时应通过受控验收身份或环境完成 `existing` 验证，不能假装已验证。若 Phoenix 仍为 `existing/open` 且有用户依赖该平台，不得直接回滚到不识别它的 Auth 或前端；先评估用户的替代登录方式及影响，调整准入后再回滚。部署、公开开放及生产验收分别记录。

## 5. 验收

以下标签描述当前工作区代码状态，不代表完整端到端或生产验收通过。每次执行应记录具体测试、环境和结果。

- **需新增**：新增平台无需修改已有平台分支或复制业务流程；未知 provider、未登记回调、关闭的平台均在服务端被拒，前端不误标已有平台。公开列表不得包含内部 `e2e`，本地和独立 E2E 中 `e2e` 仍可通过内部登录，生产为关闭状态。需要特殊处理时记录原因。
- **已部分实现，需新增 E2E 并复验**：两平台的已绑定登录、直接注册、重名 modal；Community、Dash 均返回发起页面，保留路径、查询和 fragment。整页跳转不保证保留未持久化的页面内存状态。mock 的完整往返、真实 provider 及真实 Phoenix 事务分别记录，不互相替代。
- **已实现待复验**：注册失败可重选，取消和过期不创建账号或会话；签发失败或响应丢失后重新授权进入原账号。用户和绑定单事务提交；重复消费 flow 不产生重复账号、绑定或会话。
- **已实现待复验**：Link 以当前 Auth cookie 指向的有效 Browser Session 行的 `inserted_at` 判断近期认证。另一设备新登录不能刷新本浏览器认证年龄；过期后须在本浏览器重新认证原账号。身份已属其他用户、同平台第二账号、目标变更、会话变化、过期或取消都不能误绑。
- **已部分实现，需完整回归**：Link 回调/确认不新建用户或 Browser Session；并发确认不重复绑定；共享回调的登录与 Link 交叉标签页两种顺序均不误绑或切换用户。逐平台验证 callback、state、实际支持的 PKCE、失败和重新授权，记录证据及未验证项。
- **已实现待复验**：Unlink 不能移除最后一种仍允许登录的方式，并发解绑仍保留一种；解绑不删除账号或现有会话，已解绑身份再次授权不能回到原账号，除非之后主动重新绑定。
- **已部分实现，需回归**：注册和绑定保持精确 Origin/CORS、CSRF、HttpOnly cookie、短期 flow、服务 scope 和限流；前端与日志不暴露 secret、token、flow ref、verifier 或 nonce。未授权 scope、重放和错误 state/verifier 被拒。flow ref 在服务端和 HttpOnly cookie 中使用，不能写入 URL 或交给前端脚本。
- **需新增**：发布及回滚检查覆盖前端/Auth 不认识平台时 Phoenix 不得启用该平台；`existing` 到 `open` 前实际验证；生产配置、scope、回调和 DO 清理按环境记录，不以本地结果替代。
- **部分更新**：本目录 [README](./README.md) 已明确 V2 优先级；[多平台方案](./multi-provider-oauth-plan.md)、[Auth V1](./v1.md) 和 [Link/Unlink](./link-unlink-oauth.md) 已补充 V2 关系。实施时继续同步 [Auth README](../../backend/auth/README.md) 和 [roadmap](../roadmap.md)，保留历史验证并标明版本与范围，不把旧独立页面 E2E 当作新 modal 验收。记录未运行或受阻的检查。
