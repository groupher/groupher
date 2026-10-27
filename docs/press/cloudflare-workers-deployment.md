# Press Workers 部署记录

> 2026-10-26：生产已硬切到 Cloudflare，旧 `groupher-press` Fly 应用已删除。保持 Workers Free；超限拒绝服务，不升级、不回源到 Fly。

## 发布证据

- [PR #602](https://github.com/groupher/groupher/pull/602)、[PR #603](https://github.com/groupher/groupher/pull/603)、[PR #604](https://github.com/groupher/groupher/pull/604) 已合并。Phoenix 当前修复基线为 `9f6e1eb856020eaeb7780a0c5af058d6228cf1b9`。
- [Phoenix 生产部署](https://github.com/groupher/groupher/actions/runs/40338349954) 成功。更正 Search adapter/queue 的旧模块名，并将 review visibility delivery 的 Press invalidation 放在 Search 前面。
- [Press + edge-router 生产部署](https://github.com/groupher/groupher/actions/runs/40339266045) 成功；production analysis migration 在窗口前已单独成功执行，Worker 不持有 migration owner credential。
- 归档社区的线上检查发现 Absinthe 的 `extensions.code=5504` 被误报为 502。Worker 修正为读取 canonical error code，并识别 Community/Article 的公开资源缺失；该次历史发布时 40 项 Press 测试、type-check/lint 通过（收尾后本地为 42 项，尚未部署）。已实际发布 source `b9c9ff99eaeecfc41758f7040a18fa4ebbe0bfe2`，Press version `2fcd728b-cd73-497c-95f1-84e88ff8d496`。
- 窗口从 `2026-10-26T14:23:09.551Z` 到 `2026-10-26T14:51:00.799Z`（UTC）。窗口为 best-effort，接受中断、不保证输出；上述结束时间表示最终稳态验收完成，不表示整个窗口持续不可用。
- 没有执行 AlertBoard V2 production cutover；生产 Gate/ReviewBlocks 使用当前生产实现。

## 当前生产拓扑

| 项目                 | 实际状态                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| 用户公开内容         | 平台/社区路由 → edge-router → `press#Public` Service Binding                                              |
| `press.groupher.com` | Worker Custom Domain；default 仅 health/internal，内容路径 404                                            |
| edge-router          | version `0504ca9e-97a6-4695-b95e-1c466fef7971`；`PRESS` 指向 `press` 的 named `Public`；已无 `PRESS_SITE` |
| 公开开关             | Press/edge-router 的 `PRESS_PUBLIC_DISABLED=false`                                                        |
| 免费限额             | Workers Free；平台及 Auth 的 routes 均为 `request_limit_fail_open=false`，超限不绕过 Worker、不升级       |
| Hyperdrive           | `press-analysis-production` / `32a99d5d789043f09c39d728d9ae2aeb`；query cache disabled 已复核             |
| 数据库角色           | `press_worker_cf`，UTC；仅三个 `analysis.press_*` 表及所需 sequence，无 CMS 表访问权限                    |
| 领域数据             | Worker 经生产 Phoenix Press projection 读取，Gate/Lifecycle/review 的权威仍在 Phoenix                     |
| 旧 Press Fly         | app、Machine、IP 已删除，certificate 已解除；旧 DNS 已移除，没有备用 origin                               |
| Phoenix              | 继续运行在 `groupher-api` Fly 应用，未迁移到 Worker                                                       |

生产三张 analysis 表与 ORM schema 一致，不需要删除重建；它们保留在现有数据库中。旧 output cache 已清空后切换，未增加兼容读取逻辑。迁移前备份及验收原始报告保存在受保护的本地运维目录，不含于仓库。

## 已完成生产验收

- 公开 HTTP 23/23：四种 Article Markdown、RSS/Atom/JSON Feed、Doc Feed、llms、sitemap、弱 ETag 的空 304；default 内容 404；unsigned invalidation 401。
- Phoenix 使用真实 service credential/JWT 调用生产 `/internal/invalidate` 成功，补足签名失效链路验收。
- Post/Doc 各自开始、结束 review restriction 共四次，均通过真实 CMS transaction → Outbox → Press invalidation；在 PDX、LAX 两个 colo 复验 Markdown 与 Feed。预先将 warm pointer/negative entry 的 TTL 延长至 5 分钟，再确认 pointer 被删除，未读到旧正文或旧 404。
- raw metrics 与 hourly aggregate 已实际写入；查询确认 runtime role 为 `press_worker_cf`、timezone UTC。
- 删除旧 Fly 应用后，真实公开 Markdown 仍返回 200；随后归档生产合成社区 `press-acceptance`（id 10），签名失效成功，取消了 3 个该测试社区自己的 review retry jobs。
- 最终稳态 HTTP 12/12：真实 home llms/sitemap 200、disabled Feed 404、已归档测试社区的 Markdown/Feed/llms 404、default 内容 404；平台首页、Auth 和 Phoenix health 正常。
- 两次生产角色/schema 检查均通过；临时只读 DB probe Worker 已删除。迁移未向 Worker 注入数据库 owner credential。

### Search 的独立遗留项

生产部署记录中的 Algolia credentials 尚未配置，Search 同步返回 `4529`。当时串行执行，CDN purge 也受阻；上述验收只证明 Press invalidation 成功。

本批工作区代码已将发布、更新与可见性事件改为事务性分发：Press、Search、CDN 各自独立 Outbox 记录和重试，分别使用 `press`、`search`、`public_cache` 队列。此变更需要部署 Phoenix 后生效，不需修改 Press Worker 或数据库结构。按用户确认，旧线上队列和数据不提供兼容、不 drain、不回填或重投；只保证新版生成事件的正确性。旧 projections/已完成事实事件不能当作新版三子任务已完成的证据。每个子任务最多尝试 8 次，失败只记录自身错误；不配置 Algolia 不会阻塞 Press/CDN。

不能把历史验收写成 Search/CDN 均成功。部署独立任务版本后，应分别观察三个子任务的完成/失败状态；Algolia 接入仍属于独立事项。

## Free 上限实测与运行约束

在隔离 preview 中，使用实际 Press Worker、Hyperdrive、L2 cache、metrics 和 Auth，以临时合成 GraphQL origin 提供上限 DTO；不把合成 origin 当作 Phoenix Gate 验收。共 14 个冷热请求全部返回 200，包含 5 MiB Markdown、500 项 manifest、50 项 RSS/Atom/JSON Feed。

Cloudflare live-tail 记录的 CPU 样本为 6–75ms，其中 5 MiB 为 61/75ms。**这些样本超过 Free 的标称 10ms/invocation，不能声称满足 10ms，也不能由本轮 HTTP 200 推导大内容持续可用。** 按用户确认的策略保持 Free，接受平台 CPU/每日请求/Hyperdrive SQL 超限时拒绝服务，不升级；不设置 Fly fallback。

临时合成 origin `press-load-origin` 已删除，preview 已恢复真实 Phoenix endpoint。全账号共享额度和峰值下的拒绝率仍需通过后续真实流量观察；本次收尾已提供独立于 Workers 的 `Press Free guard` workflow：账号调用估算 ≥70k、近期错误率 ≥1%（至少100次）、任一 CPU 拒绝与外部可用性异常会使 run 失败。合并到默认分支并成功运行前不标记为已启用；GitHub Actions 通知依赖接收者设置。采样调用数不等于计费余额，Hyperdrive/Phoenix 专项告警尚未配置。操作与 route 复核命令见 [运维说明](../../ops/press/README.md#free-监控与-route-复核)。

## 隔离环境与验证边界

保留用于后续发布前验收的独立环境：

- Neon project `groupher-press-preview` / `spring-dew-46030887`：业务 DB `groupher_preview`，analysis DB `press_preview`；不复制生产业务数据。
- Hyperdrive `press-analysis-preview` / `b68f73b9cd9a4642819365c707ae3146`，query cache disabled，独立最小权限角色。
- Phoenix `groupher-press-preview-api.fly.dev`，Auth `auth-press-preview.groupher.workers.dev`，Press `press-preview.groupher.workers.dev`，edge-router `edge-router-preview.groupher.workers.dev`；各自使用 preview endpoint、数据与 secret。
- [preview migration/deploy](https://github.com/groupher/groupher/actions/runs/40318711856) 已成功，临时 GitHub migration secret 已移除。staging 常规 24/24、review 四次 transition、四种 maintenance guard 组合及恢复 smoke 均通过。
- Retention 在 preview 使用真实清理函数验证过期数据删除，6 次并发覆盖成功/SQL 失败，另覆盖连接失败，测试连接无残留；生产 Cron 已部署，尚未以生产定时执行记录宣称验收。
- Phoenix 冷启动验收约 8.2 秒首次返回 200，因此回源期限为 15 秒，token 获取仍为 5 秒。
- preview Assets endpoints 为 `.invalid`，CDN purge 为无权限占位配置；fixture 期间临时 Search sink 在成功/异常后恢复原配置。此类外围集成不代表生产 CDN purge 已通过。

## 后续观察

至少 7 天的实际 CPU、请求量、Hyperdrive SQL、连接数、错误率与账单观察仍待进行；不存在自动升级步骤。日额度用尽即拒绝服务，额度重置后由平台恢复。运行实现和验收命令见 [迁移方案](./cloudflare-workers-migration.md) 与 [运维工具](../../ops/press/README.md)。

## 收尾代码状态（待生产部署）

Press health 显式使用 `CF_VERSION_METADATA.id` 和环境 binding（production/preview）；不再从构建期 process.env 推断。metadata 缺失显示 unknown。edge-router 对 Press binding 抛错返回 no-store 503 + Retry-After，其他目标异常及已有 HTTP 响应保持原行为。账号整体限流时 router 可能无法执行，接受平台 1027/资源限制错误，不承诺应用 503。

这些代码及外部 Free guard 的本地验证不代表生产版本已更新；部署后必须分别核对 production/preview `/health` 的 version/environment、记录对应 release，以及 guard 的 GitHub run。保持 Free，没有升级或 fallback。

### 收尾监控只读预检（2026-10-27）

本地使用新 cf CLI 会话授权执行 `free-guard.mjs` 的 Cloudflare Analytics/route 只读请求：核心三个 routes 显式 fail-closed，账号当日采样 invocation 估算 162、最近30分钟6次调用/0错误/0 CPU拒绝，五个外部探针均通过。此记录不证明 GitHub Environment token 已具备相同权限，也不表示 schedule 已启用；尚需合并后的首个 run 证据。预检没有变更订阅、生产版本或 route。

Search 发布/更新同步所有公开 bindings，visibility 同步指定 binding，unmirror 删除对应 entry；fixture 在临时 sink 下收敛三子任务并清理遗留 jobs。语义、ASCII 图与旧队列边界见 [独立投递说明](./effect-delivery.md)。

## 隔离 preview 真实队列验收（2026-10-27）

本轮已部署并实跑，生产版本未更新。Phoenix 从当前候选后端工作区构建，未提交代码不能标成
已合并 release；没有数据库结构变更，preview 发布跳过 release migration。cleanup 候选范围未扩展。

- Phoenix app：`groupher-press-preview-api`，唯一 Machine `0807979a271ed8`（sin）。
- 镜像：`registry.fly.io/groupher-press-preview-api:press-outbox-preview-20261027`；
  digest `sha256:637514cf715357f66b67a42b46cedb1af5f3af8f1f7f55703bd45632f0154b06`。
- Press Worker：通过当前 `cf@1.0.0-beta.21` 发布 `press-preview`；version
  `acfae7d6-bd4c-4e47-a35a-d2068c4b120e`。真实 health 返回同一 version 与 `environment:"preview"`。
  本轮未发布 edge-router；其既有 preview Service Binding 继续调用 Press named `Public`。
- RPC 每次检查 Fly Machine 总数为 1，再通过 fixture 的 hostname/database guard；
  `seed`、四次 hold/restore 和三次公开 probe 全部成功。

### 本轮实际部署与本地测试命令

以下部署命令从仓库根目录执行，先进入 `backend/api`，并明确使用 `--skip-release-command`。
`fly.press-preview.toml` 仍保留默认 `release_command = '/app/bin/migrate'`；省略该参数会执行
migration。本轮无数据库结构变更，使用命令行覆盖跳过；不能把跳过 migration 当作后续有 DDL
变更时的默认流程。本命令只部署隔离 preview。

```sh
cd backend/api
fly deploy --app groupher-press-preview-api \
  --config fly.press-preview.toml \
  --remote-only --ha=false --strategy immediate \
  --image-label press-outbox-preview-20261027 \
  --skip-release-command
```

本轮本地相关测试在同一目录执行，结果为 **15 passed**：

```sh
MIX_ENV=test mix test \
  test/groupher_server/cms/press/preview_fixture_test.exs \
  test/groupher_server/cms/search_artiments/outbox_test.exs \
  test/groupher_server/cms/press/invalidation_test.exs
```

上述测试覆盖手动投递、Search 范围、失败隔离与 cleanup；实际暂停/恢复路径的证据是下述真实
preview 验收，不以 `testing: :manual, queues: false` 的本地测试替代。

### 三个 child 的实际结果

| 操作           | 父事件 ID                              | Press child | Search child（测试 sink） | CDN child                            |
| -------------- | -------------------------------------- | ----------- | ------------------------- | ------------------------------------ |
| `hold:post`    | `deb3cadb-d37b-4620-a8e9-5258451689b0` | done        | done                      | failed / cloudflare_rejected（预期） |
| `restore:post` | `1ac5b9bc-d866-4aa4-b276-73481161d2eb` | done        | done                      | failed / cloudflare_rejected（预期） |
| `hold:doc`     | `7f7f890e-0445-4f4a-813b-08e06572ceab` | done        | done                      | failed / cloudflare_rejected（预期） |
| `restore:doc`  | `ba144baa-01bb-4edb-bf00-07a2f13936fc` | done        | done                      | failed / cloudflare_rejected（预期） |

CDN 的 preview token/zone 是隔离占位配置，预期拒绝后将该 child 终止，不留自动重试。
这证明三个任务可独立收敛，不证明生产 CDN purge 成功或真实 Algolia 已接入。
Search adapter 在每次 RPC 返回前恢复原配置；脚本的配置泄漏检查全部通过。

### 四个真实队列的恢复结果

以下值来自 `Oban.check_queue` 的实际 paused 状态，而非通知发送结果。
`seed`、`hold:post`、`restore:post`、`hold:doc`、`restore:doc` 五次结果完全一致：

| Queue        | 调用前 paused | 操作期间检查              | 恢复后 paused |
| ------------ | ------------- | ------------------------- | ------------- |
| cms_outbox   | false         | paused=true 且 running=[] | false         |
| press        | false         | paused=true 且 running=[] | false         |
| search       | false         | paused=true 且 running=[] | false         |
| public_cache | false         | paused=true 且 running=[] | false         |

五次结果均返回 `queues.confirmed=true`，`queues.before == queues.after`，四个 key 均存在。
pause/resume 的 `:ok`、cancel 的 `{:ok, count}` 检查均通过；恢复确认有 20 秒超时，
未收到非成功返回值，也未发生恢复超时。此记录覆盖真实生产式 Oban queues 的成功路径；
不把此前 `testing: :manual, queues: false` 的测试冒充真实队列验收。

### 公开输出与最终状态

从 Singapore Phoenix 对 staging edge-router 执行实际 HTTP probe，全部 `passed=true`：

| 场景                      | Post Markdown | Doc Markdown | Doc Feed 条目 | 总 Feed 条目 |
| ------------------------- | ------------- | ------------ | ------------- | ------------ |
| Post hold 后              | 404           | 200          | 1             | 3            |
| Post restore、Doc hold 后 | 200           | 404          | 0             | 3            |
| Doc restore 后最终状态    | 200           | 200          | 1             | 4            |

最终 Post/Doc 限制均已结束，没有留下本轮 hold。以上为 SIN 的功能验收，不新增跨 colo
或账号额度耗尽演练的声明。脱敏操作明细为 `seed.out`、`hold-post.out`、`restore-post.out`、
`hold-doc.out`、`restore-doc.out` 和三份 probe；原始报告与汇总保存在仓库外受保护的
`press-migration/preview-acceptance-20261027` 运维目录。

保持 Workers Free；只读 subscription 检查未见 Workers Paid（已有 R2 Paid 不属于本轮变更），
没有修改订阅或生产域名/路由。生产 health/503、Phoenix 独立任务和 Free guard 的正式上线仍待发布。
