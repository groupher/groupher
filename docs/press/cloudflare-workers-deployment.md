# Press Workers 部署记录

> 2026-10-26：生产已硬切到 Cloudflare，旧 `groupher-press` Fly 应用已删除。保持 Workers Free；超限拒绝服务，不升级、不回源到 Fly。

## 发布证据

- [PR #602](https://github.com/groupher/groupher/pull/602)、[PR #603](https://github.com/groupher/groupher/pull/603)、[PR #604](https://github.com/groupher/groupher/pull/604) 已合并。Phoenix 当前修复基线为 `9f6e1eb856020eaeb7780a0c5af058d6228cf1b9`。
- [Phoenix 生产部署](https://github.com/groupher/groupher/actions/runs/40338349954) 成功。更正 Search adapter/queue 的旧模块名，并将 review visibility delivery 的 Press invalidation 放在 Search 前面。
- [Press + edge-router 生产部署](https://github.com/groupher/groupher/actions/runs/40339266045) 成功；production analysis migration 在窗口前已单独成功执行，Worker 不持有 migration owner credential。
- 归档社区的线上检查发现 Absinthe 的 `extensions.code=5504` 被误报为 502。Worker 修正为读取 canonical error code，并识别 Community/Article 的公开资源缺失；40 项 Press 测试、type-check/lint 通过。已实际发布 source `b9c9ff99eaeecfc41758f7040a18fa4ebbe0bfe2`，Press version `2fcd728b-cd73-497c-95f1-84e88ff8d496`。
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

生产尚未配置 Algolia credentials。Search 同步仍返回 `4529`；它之后的公共页面 CDN purge 也不能视为完成。Press 现在先执行 invalidation，已通过上述真实 pointer 删除和跨 colo 验收证明不被 Search 故障阻塞。

不能把这些结果写成整条 Search/CDN workflow 成功。生产正常事件仍按 Outbox 的重试规则处理；只取消了已归档合成测试社区自己的 retry jobs。Algolia 接入属于后续独立事项。

## Free 上限实测与运行约束

在隔离 preview 中，使用实际 Press Worker、Hyperdrive、L2 cache、metrics 和 Auth，以临时合成 GraphQL origin 提供上限 DTO；不把合成 origin 当作 Phoenix Gate 验收。共 14 个冷热请求全部返回 200，包含 5 MiB Markdown、500 项 manifest、50 项 RSS/Atom/JSON Feed。

Cloudflare live-tail 记录的 CPU 样本为 6–75ms，其中 5 MiB 为 61/75ms。**这些样本超过 Free 的标称 10ms/invocation，不能声称满足 10ms，也不能由本轮 HTTP 200 推导大内容持续可用。** 按用户确认的策略保持 Free，接受平台 CPU/每日请求/Hyperdrive SQL 超限时拒绝服务，不升级；不设置 Fly fallback。

临时合成 origin `press-load-origin` 已删除，preview 已恢复真实 Phoenix endpoint。全账号共享额度和峰值下的拒绝率仍需通过后续真实流量观察；未配置主动预算告警，不将其写成已完成。

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
