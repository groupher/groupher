# Press Cloudflare Workers 迁移实施方案

> 状态：Worker 实现已合并；生产 Hyperdrive/受限角色与隔离 staging 已建立，正在完成上线验收。生产域名尚未硬切。执行证据见 [部署记录](./cloudflare-workers-deployment.md)。
>
> 目标：将 Press 的公开 HTTP 输出运行时从 Fly.io Node Machine 硬切到 Cloudflare Worker。切换完成后保持 Phoenix 领域权威、公开 URL、错误语义和缓存失效合同；cutover window 为 best-effort，接受中断，不保证输出。

## 决策

采用**一次性硬切到 Cloudflare Workers**：切换后 Press 的唯一生产运行时为 Worker，`press.groupher.com` 直接绑定 Worker，旧 Fly Press 退役。Press 是只读、短请求、可缓存的 Markdown、RSS/Atom/JSON Feed、`llms.txt` 和 sitemap 输出；Worker 能直接处于现有 Cloudflare 公共入口之后，并随 Human/Agent 流量扩缩。

本方案不把迁移定义为“把 Node 服务原样搬上边缘”。Worker 不提供常驻进程保证；持久状态、数据库访问、请求后任务和周期清理必须使用明确的外部能力。

当前计划保持 **Workers Free**，不自动开通 Paid。生产能否从 Free 起步由切换前 CPU 与账号剩余额度实测决定；预检不通过时先报告结果，不执行生产硬切，也不自动升级。

### 必须保持的业务边界

- Phoenix `CMS.Press` / `CMS.Gate` 是内容读取、公开状态、可见性、Lifecycle 和 review restriction 的唯一权威。CMS resource command 根据 ReviewBot 或人工审核意见应用/结束 restriction；AlertWall 记录举报和处理事实。
- Worker 只经 Press 专用 Phoenix internal projection 读取 current public DTO；禁止直连 Phoenix `cms` 表、重新实现 Gate 或读取 Draft、历史快照、私有审核内容。
- 单纯 resolve AlertWall item 不恢复内容；Worker 不自行解释 ReviewBot、AlertWall 或 CMS restriction 状态。
- Press 自有 `analysis.press_*` 表仅承载输出缓存和机器流量指标，可经 Hyperdrive 访问；它们不是领域事实，也不能成为内容权限的第二来源。
- Gateway 保持现有 path-first 和社区自定义域名路由；切换后 `press.groupher.com` 直接绑定 Press Worker，作为 Phoenix invalidation endpoint，不成为用户 canonical URL。

## 当前实现与迁移前置项

当前源代码和文档的关键事实：

| 项目         | 当前状态                                                                                                                       | 迁移要求                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| HTTP app     | `backend/press/src/app.ts` 为 Hono；Cloudflare Worker 与本地 Node 入口都复用 `createApp`                                       | Worker 使用 `pg.Client` + Hyperdrive；Node 入口仅用于本地开发                                    |
| Worker 入口  | `backend/press/src/worker.ts` 已提供默认 health/invalidation 与 named `Public` 输出入口                                        | 已完成代码实现；生产 Worker 尚待独立环境配置与 cutover                                           |
| 内容权威     | `src/origin.ts` 调用 Phoenix GraphQL Press projection；Review invalidation 与 Doc Feed Gate 修复已随 #602 部署到生产 Phoenix   | 硬切后仍须生产复验；不把领域读取迁到 Worker                                                      |
| 数据库       | Drizzle `node-postgres` adapter；生产/preview Hyperdrive 均已关闭查询缓存；独立 runtime 角色已验证不能读取 CMS                 | 保留现有生产 `analysis.press_*` 数据；DDL 由独立 migration job 执行，Worker 无 DDL 凭据          |
| 运行时副作用 | 请求和 Cron 都使用独立 `pg.Client`；metrics 等待 durable cleanup；cache 无 per-isolate mutable L1                              | 已完成代码实现；继续验证连接关闭、Cron retention 与跨 POP invalidation                           |
| 缓存失效     | Phoenix Outbox 调用 Press `/internal/invalidate`；当前 L2 在 PostgreSQL                                                        | API、JWT resource/scope、键格式、TTL 和重试语义已保留；切换后 hostname 仍为 `press.groupher.com` |
| 公共转发     | `infra/edge-router` 已通过 Worker Service Binding 调用 named `Public`；preview 仅声明 Press binding 并只允许 Press/health 路由 | Press 与 edge-router 的 production workflow 都要求显式确认 hard cutover                          |
| 域名         | `press.groupher.com` 当前仍是生产 Fly origin，也是 Phoenix invalidation endpoint/resource                                      | best-effort 窗口内解绑 Fly 并将同一 hostname 绑定 Press Worker；不增加备用 host、代理层或双路由  |
| Fly 发布     | 仓库中的 Press Fly workflow、Dockerfile 与 fly.toml 已移除；现有 Fly Machine 在 hard cutover 前继续运行                        | 切换后停止 Fly Machine；数据库 migration 使用独立 CI job                                         |
| 当前 Gate    | Phoenix public projection 按当前已部署 Gate/Doc 可见性规则提供输出；Phoenix 修复代码已实现                                     | P0 按生产当前规则部署并验收；AlertBoard V2 生产切换单独排期，不把最终 preflight 当作只读检查     |

### Fly 发布链路

本仓库不再提供 Press Fly 发布/回退路径。生产当前已运行的 Fly Machine 会在 best-effort hard cutover 前继续服务；切换后按 runbook 停止它。Cloudflare Worker 的数据库 migration 使用独立 CI job。

### 必须先完成的 Phoenix 正确性修复

这两项决定 Worker 是否能安全输出内容，不能靠 Worker 侧绕过：

1. **Review restriction invalidation（代码及生产 API 发布已完成）：** `ReviewBlocks.apply/end_blocks` 发出 `article.visibility_changed`；对应 workflow 已在 search sync 后调用 `CMS.Press.invalidate`，再执行 PublicCache purge。Article、Community Binding、Doc branch restriction 开始/结束均保留 durable outbox retry/fail。隔离 staging 已验证限制生效与解除会清除共享 pointer；硬切后继续做生产复验。
2. **Doc Feed Gate（代码及生产 API 发布已完成）：** Doc Feed 已改为读取当前 main branch 的公共 Doc 投影并应用 Gate、`DocPublic.visible` 与 review restriction，不再直接将 release 内文章作为可见性依据。隔离 staging 已验证受限 Doc 不进入 Markdown/Feed，解除后恢复；生产仍按当前 Gate 合同验收。

AlertBoard V2 最终生产 preflight 依赖停旧写/worker，并在破坏性 DDL、新 Gate 启用前运行，不是当前可随时执行的只读检查。Press P0 以生产正在运行的 Gate 合同为准；V2 production cutover 是独立批次，需单独计划写入冻结、预检、DDL、启用与回滚。

上述两项修复必须部署到 Worker 实际读取的**生产 Phoenix Gate**。若生产仍为 V1，将修复 backport 到当前生产版本，单独发布，不依赖 V2 DDL 或 Gate 切换。记录 Phoenix 修复 release/revision、前一版本和回滚步骤；在生产受控测试数据上复验 Review restriction 开始/结束的 Outbox invalidation、Doc Feed 可见性与 Article/Binding/Doc branch 矩阵。代码合并、staging 通过均不能替代生产验收。若 Phoenix 回滚移除了任一修复，P3 门槛立即失效；已切换的 Press 先按下方停服步骤启用 `PRESS_PUBLIC_DISABLED=true`（Worker 故障则发布独立 edge-router 503 release），将平台/社区域名经 Public 入口的内容输出切为 503，default 内容路径仍为 404，直到安全的生产投影恢复。

## 目标拓扑

```text
Reader / Agent
  -> Cloudflare zone Worker Route (groupher.com/*, www.groupher.com/*)
  -> edge-router
      -> Press Service Binding (exportName: Public)
      -> Press Worker: named Public entrypoint
          -> Phoenix CMS.Press internal projection (service token; public DTO authority)
          -> Hyperdrive (query cache disabled) -> analysis.press_* PostgreSQL objects

Phoenix CMS.Outbox -> https://press.groupher.com/internal/invalidate -> Press Worker: default entrypoint
Press scheduled cleanup -> Cron Trigger -> analysis retention
```

上图是硬切后的目标拓扑。`press.groupher.com` 直接绑定到 Press Worker；Phoenix 的 `PRESS_INTERNAL_URL=https://press.groupher.com` 和 `PRESS_INTERNAL_RESOURCE=https://press.groupher.com/internal` 保持不变，因此不需要调整 Auth service resource。切换窗口内需协调 DNS/Custom Domain 绑定和 edge-router Service Binding 发布，确保 Worker 已部署且健康后再切 hostname；具体顺序见 P3。

Gateway 到 Press 的生产调用必须使用 Service Binding，不通过 `press.groupher.com` 回调自己，避免路由环路和额外公网 hop。Phoenix 通过 `press.groupher.com` 的 Custom Domain 直接调用 Worker invalidation endpoint；该子域不由 edge-router 的 `groupher.com/*` route 接管。切换完成后 hostname 始终留在 Cloudflare。故障时先返回 503，再修复或恢复已验收的 Worker version；首次切换若没有可恢复的 Worker version，就停服修复。

### 硬切边界与切换窗口

生产硬切到 Cloudflare Worker，切换完成后退役 Fly Press，不保留 Fly 兼容、备用或回退路径。

**Cutover window：best-effort / 接受中断 / 不保证输出或可见性。** 从生产路由和域名开始切换，到切换后验收完成为止，允许请求失败、内容暂不可见及缓存失效延迟。窗口内不要求验收矩阵持续成立，也不以窗口内的 probe 失败判定迁移失败；probe 仅用于判断切换进度。记录窗口起止时间和切换后验收结果即可。

验收矩阵只用于切换前预检和切换后验收。只有切换后矩阵通过，才宣布服务恢复。该约定不改变 Phoenix Gate 的可见性权威，也不增加中间路由或旧平台恢复方案。

### Worker 入口与 preview 调用链

同一个 Press Worker 导出两个入口，边界由 Cloudflare 选择的 entrypoint 决定，不依赖 URL hostname 或客户端 header：

| 入口                                | 可调用能力                                                                                          | 验收入口                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| default `fetch`                     | `/health` 与签名 `/internal/invalidate`；所有内容路径固定 no-store 404                              | production 的 `press.groupher.com` 或 preview origin URL |
| named `Public` (`WorkerEntrypoint`) | `fetch(Request)` 处理 Markdown/Feed/llms/sitemap 等 public 路由；health/internal 路径不在此入口提供 | 由 edge-router 的指定 Service Binding 调用               |

当前 `cf/config` 的 Service Binding 选项为 `exportName`；生产采用 `bindings.worker({ worker: 'press', exportName: 'Public' })`，staging 使用其独立 Worker 名，同样选择 `Public`。平台的命名入口支持见 [Named entrypoints](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#named-entrypoints)。entrypoint 的绑定权限负责调用边界，内容 Gate 权威仍由 Phoenix 承担。

preview 不是直接访问 Press origin 的内容路径：新增隔离的 staging edge-router，绑定 preview Press 的 `Public` 入口，以登记的 staging 平台/社区测试 hostname 接收真实 HTTP 请求。default origin URL 只测 health/internal 和内容拒绝；完整 Markdown/Feed、conditional request、metrics 与缓存验收经 staging edge-router 执行。命名入口本身不生成第二个公网内容 URL。

### 长期技术栈取舍

| 层             | 长期选择                                                                              | 原因与边界                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP/runtime   | TypeScript + Hono + Cloudflare Workers Fetch handler                                  | Press 是短请求的公开只读输出；Hono 路由可以复用，Node server 和 Worker entrypoint 分开。Worker 不承诺常驻进程，Cron/Queue/`waitUntil` 承担各自适合的后台工作。          |
| 内容来源       | Phoenix `CMS.Press` internal projection                                               | 领域 Gate、Lifecycle、Doc visibility 与 review restrictions 继续由唯一权威实现；不将这些规则复制到 Worker，也不让 Worker 直连 CMS PostgreSQL schema。                   |
| 分析/输出缓存  | 现有 PostgreSQL `analysis.press_*` + Hyperdrive；cache binding 禁用 query cache       | 继续复用已有持久化合同，不为短期迁移引入 D1。缓存失效需 read-after-write 一致性，因此 Hyperdrive query cache 不能用在 mutable pointer/negative cache 查询上。           |
| SQL/ORM driver | Worker 使用 Drizzle + `pg` / node-postgres adapter                                    | 与 Cloudflare 的 Drizzle + Hyperdrive 官方路径一致；Postgres.js 可单独用于 Workers，但当前与 Drizzle + Hyperdrive 组合不受支持。本地 Node 入口也使用同一 `pg` adapter。 |
| 出口缓存       | 首发保留现有 `Cache-Control`/ETag 合同；不启用 Worker Cache API 或 CDN response cache | 后续若启用缓存，需先定义全局 purge、指标语义和 stale 窗口，并做跨 POP 验收。                                                                                            |
| 静态 KV/D1     | 暂不引入                                                                              | Press cache 需要事务/原子失效与现有 PostgreSQL 合同；迁移至 KV/D1 会新增一致性和双写设计，不是 Workers 部署的必要条件。                                                 |

这意味着长期优化方向是**Worker 作为公开 HTTP 输出层，Phoenix 作为内容投影与领域规则层，PostgreSQL/Hyperdrive 作为 Press 私有缓存与指标持久层**。公开内容适合边缘运行，但缓存层必须尊重 review/Gate 状态变更的即时失效要求。

不在本次迁移里引入 D1 替代现有 analysis PostgreSQL。D1 会带来 schema/数据迁移和 Drizzle driver 分叉；Press 内容也不能因此改为直接读取业务库。Hyperdrive 是第一阶段的数据库连接边界，缓存后端是否未来替换由真实查询量、延迟和账单另行决定。

## 实施批次

### P0：完成切换准备并修复领域投影

1. Press Fly 发布 workflow、Dockerfile 与 fly.toml 已移除，禁止再从当前分支发布旧运行时；使用 `.github/workflows/deploy-press-worker.yml` 将 Press 和 edge-router 发布到隔离 preview 与 production Environment。production 目标必须勾选 `confirm_press_cutover`。需要 DDL 时勾选 `apply_migrations`，由独立 `migrate` job 使用短时 `PRESS_MIGRATION_DATABASE_URL`，失败阻断 deploy；代码发布不勾选时不需要 DDL 凭据。
2. 准备将 `press.groupher.com` Custom Domain/DNS 绑定到 Worker 的步骤；Phoenix 的 URL 与 resource 沿用。
3. 将 Review restriction Press invalidation 和 Doc Feed Gate/visibility 修复部署到当前生产 Phoenix；生产仍为 V1 时 backport，不等待 V2 切换。记录修复 release/revision、生产复验及 Phoenix 回滚步骤；回滚移除修复时阻断 P3，已上线 Press 通过 P1 停服机制返回 503。
4. 核对生产 Press DB grant、host/port、DNS、TLS/CA 与防火墙，不输出密码。PublicDatabase origin 必须从 Cloudflare 公网可达；loopback、private/link-local 地址不能直接用于本文配置。按 P2 的 cf/schema/受保护文件流程创建 cache-disabled Hyperdrive，由最小 Worker probe 以受限角色执行 `SELECT 1` 和 analysis 表只读查询，并等待连接关闭。若仅私网可达，先完成独立网络边界调整与实测验证，再退出 P0。
5. 新增隔离 preview/staging：独立 Phoenix/Auth 部署、业务数据库及迁移/种子内容、service client/resource/scopes；独立 Press Worker、analysis 数据库、Hyperdrive 和 staging edge-router。登记 origin URL、staging 平台/社区测试 hostname、路由映射、binding ID、责任人与 revision；staging hostname 仅在 staging route-contract/config 中启用，生产映射不引用它们。P0 最小 probe Worker 导出 default health/internal 与 named `Public` probe，staging edge-router 通过 `exportName: 'Public'` 调用 probe，验证入口选择、Auth、staging Phoenix、preview DB 与签名调用；P1/P2 替换为完整 Press 输出。default origin 不能作为 preview public HTTP 入口。该环境不连接生产 Outbox/数据库，不使用生产 secret。
6. 记录迁移前公开 Markdown/Feed 的 status、headers、body hash、metrics 与 invalidation 基线；记录 analysis schema/version 和数据备份。生产切换前完成 Free CPU 与账号剩余额度预检并记录 go/no-go。
7. 登记 best-effort cutover window 与执行责任人；确认 Cloudflare 停服/修复步骤可执行。

**退出条件：** Press Fly 发布入口已从仓库移除；Custom Domain 步骤与 Auth resource 已记录；生产 Hyperdrive probe 和 Phoenix 修复生产复验通过；preview Worker/DB/Hyperdrive/Phoenix/Auth 与 staging edge-router → named `Public` smoke 通过；best-effort 窗口与责任人已明确；Free 上线预检通过（否则 P3 不得开始）。V2 production cutover 独立排期。

### P1：分离 Node 与 Worker 生命周期

涉及文件：

- `backend/press/src/app.ts`
- `backend/press/src/server.ts`
- 新增 `backend/press/src/worker.ts`
- `backend/press/src/cache.ts`（移除 OutputCache L1，Worker 使用 PostgreSQL L2）
- `backend/press/src/db/client.ts`
- `backend/press/src/db/retention.ts`
- `backend/press/src/metrics.ts`
- `backend/press/package.json`
- 新增 Worker 专用 TypeScript 配置与 `backend/press/cloudflare.config.ts`
- `infra/edge-router/src/index.ts`、`infra/edge-router/cloudflare.config.ts`（预构建独立 503 emergency release）

实施要求：

1. 把 `createApp` 改为显式接收经过验证的 runtime dependencies/config；Worker binding 通过 `env` 注入，不能把请求级状态写入 module global。
2. Node `server.ts` 仅用于本地开发，注入本地依赖。Worker default `fetch` 仅分发 health/internal，导出的 named `Public extends WorkerEntrypoint` 在 `fetch(Request)` 中调用 public Hono router；通过 `this.env`/`this.ctx` 取得请求依赖与 waitUntil 能力。两个入口复用业务函数和 `pg` adapter，但分别注册路由；local Node 可组合这两组路由供开发，不增加生产公开入口。
3. 删除启动期 retention timer；清理统一由 scheduled handler 执行，本地用对应模拟事件验证。模块 import 不运行 SQL/migration。
4. 把 Node `.env` 加载、`process.env` 全局读取和启动时数据库连接改为可注入边界。Press workspace 安装与 edge-router 一致的当前 `cf` devDependency；secret/binding 由 `cf/config` 声明，通过 `cf workers types --mode production` 生成 Env 类型。
5. 服务 token 请求保持 5 秒超时；Phoenix GraphQL fetch 使用 15 秒超时，覆盖现有 Fly origin 的冷启动（隔离 staging 实测原 5 秒超时会让首个 cache miss 返回 503）。保持 service scopes 和 `502/503` 安全映射；不要把 secret 放入 `vars` 或源码。Press Worker 显式启用 `global_fetch_strictly_public`，保证同账号 Auth/JWKS Worker 的公开 HTTP 调用经过正确路由。HTTP 条件请求按弱比较处理 ETag，接受 Cloudflare 压缩产生的 `W/` 标记、ETag 列表和存在资源的 `*` 条件。
6. Worker 数据库实现使用 Drizzle `node-postgres` adapter + `pg`（Cloudflare 当前要求 `pg` >= 8.16.3），并无条件启用 `nodejs_compat`；这是 `pg` Worker driver 的要求，不只是为了身份验证中的 `Buffer`。将现有 Postgres.js adapter 替换为 `pg`，本地开发复用同一实现。
7. 每个 Worker invocation 创建并连接一个 `pg.Client`；metrics 若由 `ctx.waitUntil()` 在响应后写入，则由同一个 pending Promise 持有 client，并执行 `finally { await client.end() }`，直到关闭完成 Promise 才能 resolve。禁止 module-scope client、`pg.Pool` 或 Worker 自建连接池。逐项验证 `jose`/加密路径及 Node compatibility。
8. 在 named `Public` 的 Hono guard 与 runtime config 中实现 `PRESS_PUBLIC_DISABLED`：配置 `false` 为正常状态，`true`、缺失或非法值均使经 edge-router → `Public` 的内容路径在 cache/ETag/304/Phoenix fetch 前返回 `503`、`Cache-Control: no-store`、`Retry-After: 60`。default 入口不进入该 guard：内容路径始终 404，health 与签名 invalidation 按各自合同工作。演练 true → 平台/社区 public 路径 503、直接 origin 内容路径 404、health/internal 可用 → false 后恢复可见性矩阵；记录版本与恢复耗时。
9. 同时预构建只在事故时发布的 edge-router 503 release：沿用现有 Press route classification，对 Press public 路径直接返回上述 no-store 503，不依赖 Press Worker 或 Phoenix；其它业务路由继续工作。记录 artifact/version 与部署指令，验证启用、恢复正常 release 两个方向。Worker 不可用时使用它停服，不能依赖故障 Worker 上的 flag。
10. 用入口隔离替换 hostname allowlist：default 无 public router，其余内容路径返回 no-store 404；`Public` 无 health/internal router。Custom Domain/preview URL 只触达 default，生产和 staging edge-router binding 明确选择 `exportName: 'Public'`；不向其它 Worker 授予该绑定。验证即使给 default binding 传平台域名 URL/伪造 header 也不能得到正文；Public 入口则按绑定选择与 Phoenix Gate 处理。GET/HEAD/conditional request 均覆盖 disabled=false/true/缺失/非法组合。

**退出条件：** Node 本地入口、default/`Public` runtime smoke 与入口隔离通过；`PRESS_PUBLIC_DISABLED` 四类配置下 Public 正常/503、default 内容始终 404、health/internal 保留均通过；staging edge-router 已接到 `Public`；独立 503 release 发布/恢复演练有版本与实测耗时；无启动期副作用。

### P2：Hyperdrive、迁移与 metrics 生命周期

涉及文件：

- `backend/press/src/db/client.ts`
- `backend/press/src/cache.ts`
- `backend/press/src/metrics.ts`
- `backend/press/src/db/retention.ts`
- `backend/press/drizzle.config.ts`
- 新增 Worker binding 配置与 Cron handler
- `.github/workflows/build-press.yml` 与新增 `.github/workflows/deploy-press-worker.yml`

实施要求：

1. 为 Worker 配置专用 Hyperdrive binding，连接现有 PostgreSQL analysis database；不要复用可读写 CMS 的 Phoenix database role。
2. 使用 Hyperdrive binding + `pg` + Drizzle node-postgres adapter；不要使用 Postgres.js + Drizzle。每个 invocation 创建 `pg.Client`，由 Hyperdrive 池化；不要自行使用 `pg.Pool`。验证并发、连接释放、断连和事务行为。禁止将裸 PostgreSQL URL 放进版本控制。
3. Press cache 使用 query cache disabled 的 Hyperdrive binding。使用仓库当前 `cf` CLI，创建请求见下方完整 body 与 `@file` 命令；提供 `--body` 时它是完整请求，不依赖 `--name` 合并。创建后使用 `cf hyperdrive update <id> --caching-disabled`，读取配置确认 caching disabled 后再绑定 Worker。Hyperdrive 默认缓存只读查询（默认 max age 60s，另有 stale-while-revalidate）；数据库写入不会 purge 查询缓存。fresh read 必须使用 cache-disabled binding，不依赖 SQL 文本细节做缓存控制。Cloudflare 当前将 `NOW()` 查询识别为不可缓存，但不把此行为当成 freshness contract。Mutable pointer/negative entry 不使用 Worker L1/Cache API；首发只保留 PostgreSQL L2。
4. `drizzle-kit migrate` 在 CI 受控 Node migration job 执行，使用短时/受限 migration secret；Worker 发布和实例启动不自动执行 DDL。migration 失败阻止 Worker version promotion。
5. Metrics 不得继续 fire-and-forget。Worker handler 将持久化 Promise 交给 `ctx.waitUntil()` 并捕获结构化记录失败。若请求 SQL 与 metrics 复用同一个 `pg.Client`，该 Promise 执行 `finally { await client.end() }`；错误或无 metrics 路径也必须等待 client 关闭完成。若改用 Queue，consumer invocation 创建自己的 Client，同样在写入 Promise 中 `finally { await client.end() }`。添加连接泄漏验证，覆盖成功、SQL 失败、响应后 metrics 失败和并发请求；验证必须等到异步关闭完成，不能只断言 end 被调用。
6. 以真实 SQL 计数建立 Free 预算：当前无 L1 时，Press L2 cache hit 请求约 4 条语句（pointer SELECT、output SELECT、raw metric、hourly aggregate）；cache miss 加 cache 写入约 2 条，约 6 条。100,000 queries/day 理论上约对应 16.7k–25k 请求/日，另扣 invalidation、retention、重试和运维 SQL。
7. retention 改为显式 Cron Trigger，每日执行并复用 7 天 raw / 180 天 hourly / expired cache 清理合同。每次 scheduled invocation 创建自己的 `pg.Client`；scheduled handler 等待清理 Promise（或将完整 Promise 交给 `ctx.waitUntil()`），并在该 Promise 的 `finally` 中 `await client.end()`，连接建立失败/SQL 失败路径也执行清理。不得复用 HTTP/Queue client。清理失败可观察、可重试；连接泄漏验证覆盖 Cron 成功、连接/SQL 失败及重复 scheduled invocation。

#### 使用当前 cf CLI 创建 Hyperdrive

先从仓库根目录执行 `pnpm --filter @groupher/edge-router exec cf schema hyperdrive create`；对照 [Create Hyperdrive API](https://developers.cloudflare.com/api/resources/hyperdrive/subresources/configs/methods/create/) 核对普通 PostgreSQL origin 的字段。完整 body 至少包含 `name` 和 `origin`，本方案 origin 明确填写 `scheme`、`host`、数字 `port`、`database`、`user`、`password`：

```json
{
  "name": "press-analysis",
  "origin": {
    "scheme": "postgresql",
    "host": "<database-host>",
    "port": 5432,
    "database": "<press-database>",
    "user": "<restricted-press-role>",
    "password": "<secret>"
  }
}
```

当前仓库安装的 `cf` body parser 已确认支持 `--body @文件路径`。在受控本地运维环境创建临时目录/文件（目录 0700、文件 0600，`umask 077`），用编辑器或 secret manager 填入完整 JSON；不要把真实凭证写成 shell 命令、展开到 argv 或在 CI 执行该创建步骤。使用绝对文件路径，因为 `pnpm --filter ... exec` 会切换 workspace 工作目录：

```sh
pnpm --filter @groupher/edge-router exec cf hyperdrive create --body @/absolute/protected-temporary-directory/hyperdrive.json
pnpm --filter @groupher/edge-router exec cf hyperdrive update <id> --caching-disabled
```

运行时关闭 shell tracing/debug payload logging；不对含 secret 的请求执行会打印 body 的 dry-run，不将临时文件或终端输出纳入 CI artifact。完成后清理临时文件；只记录资源 ID、环境与 caching disabled 验证结果。preview 和 production 分别创建，不能交换 binding 或凭证。

**退出条件：** 正常内容读/cache/metrics 经 staging edge-router → named `Public` 验证；health/签名 invalidation 经 default origin 验证；直接 origin 内容路径在 disabled=false/true 下均 404，Public 路径分别正常/503；迁移失败阻断、retention 与各类 client 无泄漏验证通过；停服恢复后 review-hidden/Doc Feed 矩阵通过并记录耗时；无 CMS 直连或启动期 DDL。

**跨 POP 失效验收：** 切换前在 staging、切换后在最终 Worker 收尾验收中，从两个不同 Cloudflare colo/POP 验证 publish/review transition → Phoenix outbox invalidation → 紧接着读取；验收时旧正文和旧 404 均不得出现。此合同只在稳定运行状态验收，不适用于 best-effort cutover window。确认 freshness 来自 cache-disabled Hyperdrive + PostgreSQL L2；单 isolate 单元测试不满足最终验收条件。

### P3：边缘路由与域名切换

本批次在 best-effort cutover window 内执行；窗口中的变更和 probe 不承担可用性、缓存新鲜度或可见性同步保证。

**开始条件：** P0 环境 smoke、P1/P2 staging 完整验收与停服/恢复 smoke 通过；Phoenix 修复已生产复验并记录 revision；生产 Worker/Hyperdrive 已就绪，Free 上线预检通过。

涉及文件：

- `infra/edge-router/cloudflare.config.ts`
- `infra/edge-router/src/index.ts` 及其 route tests
- `backend/press/cloudflare.config.ts`
- `.github/workflows/deploy-press.yml`、`backend/press/Dockerfile`、`backend/press/fly.toml`（已删除旧 Press Fly 发布配置）
- `docs/deploy/README.md`
- `docs/deploy/cloudflare.md`
- `docs/architecture/apps.md`
- `backend/press/README.md`

实施要求：

1. 给 edge-router 配置 `bindings.worker({ worker: 'press', exportName: 'Public' })`，确认生成的 binding 选择 named `Public`，生产内容请求走该入口。staging 使用隔离 Worker 的同名 export。本地可用 HTTP Node 入口；生产不增加双路由开关。
2. 保留现有 Press path classification、community slug 注入、自定义域名解析、请求方法/body/query/header 透传和 response status/header 规则。
3. 将 `press.groupher.com` 直接绑定到 Press Worker，作为 Phoenix invalidation endpoint。`PRESS_INTERNAL_URL=https://press.groupher.com` 与 `PRESS_INTERNAL_RESOURCE=https://press.groupher.com/internal` 均保持原值，不调整 Auth resource。
4. 正式域名绑定 default 入口，只提供健康检查和内部签名接口。先经平台/社区域名 → `Public` 读取真实公开验收数据，再以相同路径/ID 直接请求 `press.groupher.com` 的 Markdown、Doc、RSS/Atom/JSON Feed、llms/sitemap。GET/HEAD/If-None-Match 在 disabled=false/true 下均应 no-store 404，不能用不存在的数据冒充入口拒绝；`/health` 可用、正确签名 invalidation 成功，匿名/错误签名拒绝。记录完整四组合矩阵，确认内容 URL 不能选择 named entrypoint。
5. 进入 best-effort cutover window 后，显式将 Press 与 edge-router 的 `PRESS_PUBLIC_DISABLED` 设为 `false`，先从 Fly detach `press.groupher.com` 的 domain/DNS，再运行 production 部署流程：它先为 Press Worker attach Custom Domain 并部署，再发布 edge-router → named `Public` Service Binding。两步在同一窗口内完成；不做中间态可见性验收。随后检查 TLS、health、签名 invalidation、失败 Outbox 重试及 item 4 矩阵。平台公开输出不通过 default origin，不新增 canary 或双路由。
6. 域名和 edge-router 硬切完成后停止旧 Fly Press Machines。故障处理限定在 Cloudflare：先发布 503 停服 release，再修复或恢复已验收的 Worker version；`press.groupher.com` 始终绑定 Worker。

**退出条件：** 旧 Press Fly 已退役；平台/社区内容经 Service Binding → named `Public` 输出，正式域名只触达 default；default 内容路径始终 404，Public 在 disabled=false/true 下分别正常/503，health/签名 invalidation 可用；最终验收与窗口结束时间已记录；没有 HTTP loop。上述结果是恢复后的验收，不是窗口内的连续保证。

### P4：生产容量与账单观察（cutover 后）

Cloudflare 当前公开额度（计划写作时核对，发布前需复核）：

| 用量                      | Workers Free     | Press 的实际影响                                                                                 |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| Worker request            | 100,000/day      | public Route 每个进入 Worker 的请求都会消耗请求额度                                              |
| CPU                       | 10ms/invocation  | 需用 Feed、最大 500 条 site manifest、Markdown 5 MiB 上限等真实路径测量；网络等待不等同 CPU 时间 |
| Hyperdrive SQL statements | 100,000/day      | 每个 Press L2 cache-hit 请求约 4 条 SQL；cache miss 约 6 条，另加 invalidation/retention/retry   |
| Queue operations          | 10,000/day       | 如采用 durable Queue，按消息写/读/删除通常约 3 operations，Free 约覆盖 3,333 条消息/日，重试另计 |
| Paid 起步                 | $5/month/account | 包含 10M Worker requests/month、30M CPU ms/month；超额按官方单价计费                             |

当前保留 **Workers Free**；Paid 是后续经用户确认的选项。Free staging smoke 不等于生产容量验收。Free 超限操作会失败而非自动计费；切换前须统计同账号所有 Worker、Auth、edge-router、preview 和 Hyperdrive 已有消耗，并按账号剩余额度及实测配置告警：`Press 每日请求告警线 = min(账号剩余 Worker request 预算 ÷ 实测计额 Worker requests/request, 账号剩余 Hyperdrive SQL 预算 ÷ 实测 queries/request) × 可用比例`，并为 SQL/请求和 CPU 设独立门槛。Queue Free 10,000 operations/day 按每消息约 3 operations 仅约 3,333 条消息/日，重试另计。CPU 10ms 是每次 invocation 限制，低流量无法规避；5 MiB Markdown、500 项 manifest、Feed、冷热缓存及签名失效路径必须在真实 Free Worker 测量 CPU 和错误率后给出 go/no-go；不能只用 HTTP smoke 成功证明 CPU 有余量。记录正常与突发流量估计、p95/p99 CPU、单次超限和每日预算，未完成时不得生产切换。Paid 也不自动解决数据库容量或连接延迟。

成本评估公式：

```text
Workers Free 平台基础费 = $0（受免费限额约束，数据库/Phoenix 等另计）
如以后确认升级，Workers Paid 月成本 = $5 起步 + 超额 Worker requests + 超额 CPU ms
额外平台成本 = Queue/KV/R2/observability 等按启用产品的实际用量
总成本 = Workers 平台 + 现有 PostgreSQL/Hyperdrive 对应数据库账单 + Phoenix origin 运行成本
```

对照当前 Fly 配置 `shared-cpu-1x / 512MB / auto_stop_machines=stop / min_machines_running=0`，按实际 Machine 启动时长核算，不用持续运行价冒充当前账单。首发不使用 Worker/CDN response cache，因此按实际 Worker 请求、SQL 与 Phoenix origin 调用量比较完整服务成本；以后若增加缓存，再纳入命中率和 purge 成本。Cloudflare 不按 Workers egress/带宽另收流量费，但请求、CPU、Hyperdrive 及日志/存储仍受各自限额与计价约束。

生产 cutover 后观察项：

- 生产 Worker request、CPU ms、Hyperdrive query/request、失败率、Phoenix origin 调用均有 dashboard/alerts；按至少 7 天真实流量复核容量和账单。
- Worker 请求量、Hyperdrive SQL/request、Phoenix GraphQL 回源数和 p50/p95 按真实流量记录；首发没有 Worker Cache API/CDN response cache 命中指标。
- 5 MiB Markdown 与 500 条 manifest 的 Worker CPU 测量在 preview 完成；Free 的 10ms/invocation 是生产 go/no-go 门槛，不能以流量小代替；未测或不通过时不硬切、不自动升级。
- 真实成本列出 Workers、Hyperdrive/数据库、Queue（若启用）与日志；切换完成后关闭旧 Press Fly Machine，停止其计费。
- 以至少 7 天生产请求样本和峰值日外推 Agent 突发流量，校准 Free 剩余额度和 CPU 预算；需要 Paid 时另行确认。

## 安全、缓存与可见性验收矩阵

**适用范围：切换前预检、切换后最终验收及恢复后的稳态运行。Cutover window 为 best-effort、接受中断；本矩阵不要求在窗口内持续成立，不承诺窗口内有输出或可见性即时同步。** 切换后最终验收通过才宣布恢复；业务选择仍由 Phoenix public projection/Gate 决定，Press Worker 验证输出结果。

| 场景                                                                                   | 必须结果                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公开 Article                                                                           | 单篇 Markdown 返回 canonical public body；不增加人类 Article view                                                                                                                             |
| 平台级 review restriction active                                                       | Article 对普通公开读者不出现在 Press；不能因 Agent/service identity 得到额外审核豁免                                                                                                          |
| 社区级 review restriction active                                                       | 对目标 community binding 隐藏；相同 Article 在允许公开的其他 community 不被错误全局隐藏                                                                                                       |
| Doc branch 限制/非 active public branch                                                | 该 branch 不进入 Markdown、Feed、`llms.txt` 或 sitemap                                                                                                                                        |
| AlertWall resolve 但 CMS 限制仍 active                                                 | 仍按 Gate 隐藏；不能把 resolve 当作 publish/restore                                                                                                                                           |
| 限制结束且 CMS 投影重算完成                                                            | 新请求可按 current public projection 返回；旧缓存按版本/invalidation 合同刷新                                                                                                                 |
| Unknown/private/deleted/unpublished                                                    | `404`；不缓存敏感正文、不泄漏存在性细节                                                                                                                                                       |
| Phoenix unavailable                                                                    | 无安全缓存时返回现有 `502/503`；不伪装为 `404`，不使用 stale-if-error 返回已撤回内容                                                                                                          |
| Phoenix Outbox invalidation                                                            | service credential、scope、audience 错误时返回非 2xx；Outbox 必须 retry/fail，不能伪报 done                                                                                                   |
| Public cache                                                                           | ETag/304、Content-Type、canonical Link、Cache-Control 与现行合同一致；conditional request 不重复计正文 bytes                                                                                  |
| 平台/社区域名 → edge-router → named `Public`，`PRESS_PUBLIC_DISABLED=true` 或缺失/非法 | 内容路径返回 no-store 503，不读缓存或回源；恢复 false 后重跑公开可见性矩阵                                                                                                                    |
| 直接 origin URL → default 的内容路径                                                   | 真实 Markdown/Feed/llms/sitemap 的 GET/HEAD/conditional request 在 disabled=false/true/缺失/非法下都返回 no-store 404，不返回正文、304 或 redirect；default health/签名 invalidation 独立保留 |

P1 runtime 与 P2 staging 必须覆盖以下四种基本组合，并把缺失/非法配置按 disabled=true 的语义补测：

| 调用入口                                               | disabled=false                 | disabled=true                         |
| ------------------------------------------------------ | ------------------------------ | ------------------------------------- |
| 平台/社区 HTTP → edge-router → named `Public` 内容路由 | 按 Phoenix projection 正常响应 | no-store 503，不能变成 304 或读旧正文 |
| 直接 origin HTTP → default 内容路径                    | no-store 404                   | no-store 404                          |

default `/health` 和正确签名 `/internal/invalidate` 在两种配置下都按正常合同工作；错误签名仍拒绝。named `Public` 请求 health/internal 路径则返回 404。绑定选择测试还需用 default binding 携带平台 hostname URL 调用，证明 hostname 不能使 default 进入 public router。

restriction 开始/结束均须触发 Press invalidation，且 outbox retry/fail 可观察。Press 生产流量切换按当前生产 Gate 验收。AlertBoard V2 的生产 preflight、停旧写/worker、DDL 与新 Gate 启用另立生产切换计划；本地测试通过不等于 V2 production cutover 完成。

## 生产硬切与故障恢复 Runbook

**Cutover window：best-effort / 接受中断 / 不保证输出或可见性。** 记录窗口开始时间，完成硬切后按下列清单验收；窗口内 probe 失败不要求服务持续可见。验收通过后记录结束时间并宣布恢复。

1. 确认 P0 生产 Phoenix 修复/backport、生产复验、best-effort 窗口与责任人已记录，环境 smoke 已通过；在隔离 preview/staging 部署完整 Press 两入口与 staging edge-router `Public` binding，运行 build/typecheck、unit tests 和 `cf dev` smoke。
2. 执行 preview Press Drizzle migrations；确认 preview `analysis.press_*` schema/version 与该环境一致。需要 CI migration 时，只在对应 GitHub Environment 临时设置 `PRESS_MIGRATION_DATABASE_URL`，勾选 `apply_migrations`；记录 migration job 结果后移除该 secret。migration 不放在 Worker startup/Cron 中执行，Worker runtime secret 不包含数据库 owner URL。
3. 通过 preview default origin 验证 health、签名 invalidation 与内容 404；通过 staging edge-router HTTP → named `Public` 验证真实 Markdown/Feed/llms/sitemap、cache/metrics 与四组合矩阵。确认所有请求只访问 staging Phoenix/Auth 和 preview 数据。
4. 经 staging edge-router 跑平台/社区域名路由矩阵，比对迁移前基线，并确认 Cloudflare 停服/恢复流程可执行。
5. 确认 production schema、Hyperdrive、secret、Free CPU/账号剩余额度预检与 503 release 就绪，显式将 Press 与 edge-router 的 `PRESS_PUBLIC_DISABLED` 设为 `false`，记录 cutover window 开始时间；从 Fly detach `press.groupher.com` 的 domain/DNS，然后运行 production 部署流程并勾选 `confirm_press_cutover`。流程先为 Press Worker attach Custom Domain 并部署，再发布 named `Public` binding；允许服务中断，不做中间态可见性验收。完成后复验 TLS、default health/internal、default 内容 404 与 Outbox 重试。
6. 停服/修复触发条件：任何 Draft/private/review-blocked 内容泄露；Phoenix invalidation 丢失/伪成功；5xx 或 p95 持续显著高于基线；Free CPU/账号额度告警触发（若以后升级则为对应 Paid 预算告警）；数据库连接耗尽。
7. 硬切后的运行故障按 Cloudflare 停服/修复步骤处理并保持目标 hostname 绑定 Worker。Phoenix 修复必须回滚时，先验证平台/社区内容 503，再回滚 Phoenix；修复恢复并复验后才能恢复公开输出。
8. 硬切验收后立即停止旧 Press Fly Machines。后续观察和恢复全部基于 Worker、edge-router 与 Phoenix。

### Public 停服与恢复

1. Worker 正常时，将 `PRESS_PUBLIC_DISABLED=true` 通过当前 cf CLI 发布；记录 version 和停服实测耗时，验证平台/社区域名 → `Public` 的内容路径 no-store 503，default 直接内容路径仍为 404，default health/签名 invalidation 仍按正常合同工作。Public guard 前置于 cache/304，不改变 default 的路由集合。
2. Worker 不可用或无法及时应用开关时，发布 P1 预构建的 edge-router 503 emergency release；它只使用现有 route classification，直接阻断 Press public 输出，不调用故障 Worker。记录 artifact/version 并从真实公共入口复验 503；其它业务路由不受影响。
3. 生产 Gate/网络/运行时故障恢复后，在 public 仍关闭时确认 health、签名 invalidation 与依赖恢复；用受限 service credential 直接读取生产 Phoenix projection 复验 review-hidden/Doc Feed 矩阵，再通过签名 invalidation 清除共享 L2。投影安全后将 config 恢复为 `false` 并发布正常 edge-router release，立即复验全部公开路径、conditional request 和跨 POP 失效合同；失败时重新停服。不能只恢复旧 release 就默认安全。

### Cloudflare 故障恢复

| 故障                                                             | 处理步骤                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 正式域名动作已开始后，Worker 5xx、不可用或输出错误               | 发布独立 edge-router 503 release → 修复或恢复已验收且满足当前 schema/Gate 的 Worker version → 验证 default health/internal、生产投影和安全矩阵 → 恢复正常 edge-router `Public` binding。首次切换无已验收 Worker version 时保持 503并修复。 |
| 正式域名动作已开始后，Custom Domain/DNS/TLS 或 invalidation 故障 | 必要时停服 public 输出 → 在 Cloudflare 修复域名绑定/DNS/TLS → 验证 default health/internal 与 Outbox 重试 → 清共享 L2，复验后恢复 public。域名最终绑定 Worker，不反向迁移回旧平台。                                                        |
| Phoenix 正确性修复必须回滚                                       | 启用 `PRESS_PUBLIC_DISABLED=true`；Worker 故障则发布独立 edge-router 503 release → 验证 public 503 → 回滚/修复 Phoenix → 生产复验 Gate/Doc Feed/review invalidation → 按恢复步骤重新开放。                                                 |

记录 Worker/edge-router release ID、操作责任人、故障时间与恢复验收结果。保留 analysis 数据；停服期间的 Outbox 失效事件继续按合同重试。

## 验收与交付清单

- [ ] `backend/press/src/worker.ts` 导出 default health/internal 入口与 named `Public` 内容入口；Node 入口仅用于本地开发。
- [ ] `createApp` 不在 import/startup 时运行 migration、retention timer 或未等待 Promise。
- [ ] `PRESS_PUBLIC_DISABLED` 正常/缺失/非法配置下，Public 内容正常/503、default 内容始终 404、default health/internal 保留；入口选择与四组合矩阵通过 P1/P2，独立 503 release 已演练。
- [ ] Worker 只访问 Phoenix Press internal projection 和 Press analysis schema；无 `cms` SQL/read path。
- [ ] Press mutable cache 使用 Hyperdrive query-cache-disabled binding；Worker L1/Cache API/CDN response cache 未启用；跨 POP publish/review transition → invalidate → immediate read 通过。
- [ ] Worker 使用 Drizzle node-postgres adapter + `pg`，并在 workerd/Hyperdrive runtime 验证。
- [ ] Hyperdrive binding、token secrets、observability 和 Cron Trigger 有环境级声明；本地/CI 不读取生产 secret。
- [ ] 生产 DB host/port/TLS/防火墙与受限角色已由 Hyperdrive Worker probe 实际验证；PublicDatabase 无私网/loopback origin，私网方案须先完成独立网络边界批次。
- [ ] Metrics 失败可观察，执行语义已选择 `waitUntil` 或 Queue 并有重试/丢失边界说明。
- [ ] 生产 Free 上线预检有实测记录：最大 payload/manifest、Feed、冷热缓存、失效路径的 CPU 与错误率，以及全账号剩余 Worker/Hyperdrive 额度；告警与 go/no-go 明确。Paid 未获确认前不得自动开通。
- [ ] Review restriction invalidation 与 Doc Feed Gate 修复已部署到当前生产 Phoenix（V1 时完成 backport）并复验；移除修复时阻断切流，或将平台/社区 → Public 的内容输出切为 503；default 内容仍 404。
- [ ] AlertBoard V2 production cutover 独立排期；Press 验收仅按当前 production Gate 合同，不把最终 V2 preflight 当只读门槛。
- [ ] Phoenix invalidation、HTTP cache、ETag、错误状态和无 stale-if-error 行为保持合同。
- [ ] 生产与 staging edge-router 的 Press binding 均通过 `exportName: 'Public'` 选择命名入口；正式/preview origin 只触达 default；无 HTTP compatibility path 或代理环路。
- [ ] P3 域名切换后，真实可公开 Markdown/Feed/llms/sitemap 在直接 origin 的 GET/HEAD/conditional request 全部 no-store 404；health 和签名 invalidation 正常。
- [ ] preview Worker、Hyperdrive/PostgreSQL、Phoenix/Auth、staging edge-router → Public 的 P0 smoke 已通过；P1/P2 完整 HTTP 验收经 staging edge-router 执行；不连接生产 outbox/数据库。
- [ ] Free 上线预检通过；`press.groupher.com` 和 edge-router 已切到 Worker；旧 Press Fly Machines、workflow 与部署配置已退役。
- [ ] 使用 `cf hyperdrive create --body @/absolute/protected-temporary-directory/hyperdrive.json`；完整 body 内含 `name` 和 `origin`，凭证不进入 argv/history/log；创建后 update 关闭缓存并验证配置，临时文件已清理。
- [ ] Metrics promise 由 `ctx.waitUntil()` 跟踪，在该 Promise 中执行 `finally { await client.end() }`，直到关闭完成才 resolve；成功/失败/并发情形无连接泄漏。
- [ ] Cron scheduled invocation 使用独立 Client，清理 Promise 的 `finally` 中 `await client.end()`；成功、连接/SQL 失败和重复 invocation 的泄漏验证通过。
- [ ] 已准备 Cloudflare 503 停服和 Worker 修复/版本恢复步骤，记录 Worker/edge-router release ID；域名保持绑定 Worker。
- [ ] cutover window 已明确为 best-effort/接受中断、不保证输出或可见性；记录开始/结束时间和切换后验收结果；验收矩阵只用于切换前预检与切换后验收。
- [ ] 更新 `docs/press/v1.md`、`docs/deploy/README.md`、`docs/deploy/cloudflare.md`、`docs/architecture/apps.md` 的 current state；文档与实际部署 evidence 一致。

## 官方平台资料

- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Hyperdrive: PostgreSQL](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)
- [Create Hyperdrive API](https://developers.cloudflare.com/api/resources/hyperdrive/subresources/configs/methods/create/)
- [Hyperdrive firewall and networking](https://developers.cloudflare.com/hyperdrive/configuration/firewall-and-networking-configuration/)
- [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- [Drizzle ORM with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/drizzle-orm/)
- [node-postgres with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/)
- [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Service bindings: named entrypoints](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/#named-entrypoints)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

平台价格和配额会调整；执行迁移时必须重新核对官方页面与实际 Cloudflare account tier。
