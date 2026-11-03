# Reference Map M0 inventory 与切换记录

2026-11-03 后续扩展：Article MiniMap 经 `referenceMapArticleComments` 按公开 Comment innerId 分页发现本篇可读且有内部引用事实或待同步水位的 Comment，再使用原 `referenceMap` 邻接查询展示实际方向。`Store.mentioning_itself?/2` 保留 Comment→父 Article，Article→自身仍过滤；无父子虚构边。GraphQL 与前端定向回归覆盖 C→父 Article、C→其他 Article、已同步无引用 Comment、待同步 Comment、分页与公开 ID。该扩展仅在本地实现，未纳入此前 M5 生产切换。

本文件登记 `article-community.md` 与 `reference-map.md` 的实现入口和验收证据。事实来源是稳定 Article/Comment 身份；Community 只参与公开投影与 Gate。目标环境切换须按第 10.2 节单独执行，不能因本地测试通过而跳过 report。

## 原事务写入口

| 资源或变化                                       | Command / Persist 入口                                                                            | 同事务意图与可见性版本                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post / Blog / Changelog 发布                     | `cms/articles/workflow.ex`；`articles/commands/{create,update,publish}.ex`                        | `SyncProgress.mark_pending_in_transaction`、`article.mention_sync`、`GraphRevision.bump_for_article`。普通 Article 只按稳定 Article ID 建一份来源意图，binding 数量不参与幂等键。 |
| Doc main 发布                                    | `cms/articles/publish/doc.ex`、`cms/articles/workflow.ex`                                         | 来源为 Article UUID + main branch ID；token 来自 branch version/publication version。                                                                                             |
| User Ticket 发布                                 | `cms/tickets/persist.ex`                                                                          | Ticket 仍为独立公开 locator，沿用 Article 级同步意图；非 User Ticket 不进入一跳公开列表。                                                                                         |
| Comment 创建/回复/编辑/删除                      | `cms/comments/commands/{create,update,delete}.ex`、`comments/effects.ex`、`comments/lifecycle.ex` | 正文事务写 Comment token、水位、专用 Outbox；删除撤销事实并推进图版本。缺正文/入队失败返回错误，不能将 best-effort Job 视为同步成功。                                             |
| mirror / move / unmirror                         | `cms/articles/binding_persist.ex`                                                                 | 只推进受影响 Community revision；不复制 Article 事实、水位或 Mention 通知。                                                                                                       |
| Article / Doc / Comment / Community Lifecycle    | 各 `lifecycle.ex`、`cms/articles/trash.ex`                                                        | 公开可见性变化推进受影响 Community revision；终结删除移除来源与目标事实。                                                                                                         |
| 人工 Review / ReviewBlock / Community 展示元数据 | `cms/review/decisions.ex`、`cms/review_blocks.ex`、`cms/communities/commands/update.ex`           | 审核与标题/slug/权限相关变更推进图版本。直接 SQL 维护公开状态须先停止 Map 并执行 report/apply。                                                                                   |

## 专用 Outbox 合同

| Event                  | payload                                                                           | 幂等 identity / key                                                                   | 消费者                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `article.mention_sync` | `source_type`、`content_token`；Doc 另含 `branch_id`；resource ID 是 Article UUID | 原 Command 或 Workflow identity；`article.mention_sync:<type>:<article_uuid>:<token>` | `Outbox.Workflow.Article.sync_mentions` 重新选当前 canonical 公共版本；旧 token 终结，无发布通知、Activity、cache/search 重放。 |
| `comment.mention_sync` | `content_token`；resource ID 是稳定 Comment ID                                    | 原 Command identity；effect key 是 token                                              | `Outbox.Workflow.Comment` 重新加载 Comment 与当前正文。                                                                         |

`article.projections` 仍由原发布副作用消费。Mention 任务不复制这一事件。`sync/1` 旧调用与返回合同保留，适配器只提取稳定身份并重读 canonical；迟到的 `article.mention_sync` token 仅作诊断，消费者追赶当前公开版本。Doc 同步在来源锁内比较 branch version/publication token，拒绝用并发更新前的正文覆盖事实；公开图只信任 `sync_public` / `sync_current` 的 canonical 版本与水位。

## 公开读取与 Comment 共享

- `cms/artiment_mentions/parser.ex` 与 `public_locator.ex` 接受平台 `/<community>/<thread>/<innerId>`、Comment fragment；custom-domain 绝对链接作为 external URL。输出 URL 由 `public_url.ex` 按当前 binding 组装，Doc 空 slug 使用 `/<community>/doc/<innerId>/doc`。不返回旧 UUID URL。
- 普通 Comment 公开 Gate 由父 Article 的当前 binding 决定；`cms/front_desk/relation.ex` 的 `article_of/1` 继续保留 origin 侧 public 投影语义。Create/Update/Delete、reply、reconcile、互动与通知的公开上下文从本次请求 binding 传递。Doc Comment 仍按 main branch Scope。
- 普通 Comment 的 ReviewBlock 是全局决策；Doc Comment 仍按 branch/Community。`alert_wall/commands/submit_report.ex` 与 `alert_wall/persist.ex` 分离举报发生地和决定 Scope；mirror Community 的管理员不能借本地举报执行全局隐藏。Community 删除对仍有关联的 Doc Comment 保持事务约束。
- `cms/artiment_mentions/reference_map/read_model.ex` 批量应用匿名 public Gate；`page_facts.ex` 在 SQL 中按 frontier、方向和 cursor 分区读取最多 40 条事实，再由 `batch.ex` 筛 READY 来源与公开端点并按需继续扫描窗口，隐藏目标不占页。revision 和 Comment 发现页仅验证 focus，不装载邻接端点。一跳列表在 SQL 中先按匿名 public Scope 筛端点，使用数据库流式 cursor；offset 精确总数仍需扫描全部可见事实。

### 旧调用合同与 `article_of/1` 调用清单

| 调用方                                                                                           | 保留/迁移结果                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `FrontDesk.article_of/1` → `CMS.front_desk_article_of/1` → `CMS.FrontDesk.Relation.article_of/1` | 保留原签名与 origin 侧 public 投影职责；不可用于推断跨 mirror 请求 Community。                                                                  |
| `CMS.Gate.Access.{Check,Query}.parent_article/1`                                                 | 规范 Comment 带 `article_id` 时直接载入稳定父 Article 并使用请求 Community 的 Gate context；仅非规范 fallback 仍调用 origin 侧 `article_of/1`。 |
| `CMS.ArtimentMentions.Store`                                                                     | Comment 事实同步不再调用 origin 侧 `article_of/1`；按稳定 Comment ID 读取当前正文，公开路径在读取时使用请求 binding。                           |
| `CMS.Events.SyncMentions` 与 `CMS.DocTree.Persist`                                               | 保留已加载对象调用 `sync/1`；适配器只提取稳定身份，重读当前公开选版。未发布 Doc 草稿返回 `{:ok, :pass}`，不写公开事实。                         |

## DDL、GraphQL 与路由

| 范围       | 文件 / 结果                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 事实和水位 | `20261102100000` 至 `20261102105000` migrations；`artiment_mention.ex`、`model/sync_state.ex`；typed source/target、完整 edge key 唯一、双向部分索引、归属 trigger、UTC 时间。旧 Community-bound Mention 表被新事实表替换，需 current-source rebuild。`20261102110000` 将 Activity `recorded_at` 默认值改为实际插入时钟；`20261102111000` 把历史普通 Comment 社区审核块转为全局并阻止再写入；`20261102112000` 增加按方向和 edge key 的窗口索引。 |
| GraphQL    | `cms_types.ex`、`cms_queries.ex`、`resolvers/cms/artiment_mentions.ex`；一跳 `mentions`/`mentionedBy`、TicketPathInput、`referenceMap`/`referenceMapRevision`；`schema.graphql` 和 frontend generated 类型同步。公开响应不含内部 Article/Comment/Community/branch ID、token、snapshot、occurrences 明细；Trash 旧 Mention 历史字段及前端消费者已移除。                                                                                           |
| 页面       | `frontend/community/src/routes/$community/{post,blog,changelog,doc,ticket}`；Blog `$id.tsx` 与 `-BlogDetail.tsx` 为新增公开路由；Doc 空 slug fallback 使用现有 `$id/$slug.tsx` 的固定 `doc` 占位。`frontend/core/unit/ReferenceMap` 在 Article/Doc/Ticket/Comment 接入；Comment `oneComment` overlay 定位首屏外目标。                                                                                                                            |
| 缓存       | GraphQL `no-store`；前端 `referenceMapQueries` 以 Community 前缀索引。成功的内容/审核 mutation 取消旧图查询并重建，view/reaction/upvote 不触发；pending 转 READY 后先清前缀缓存再重载；可见/在线时 30 秒先验 revision。                                                                                                                                                                                                                          |

## 运行与验收

- `mix cms.mentions.rebuild --report|--apply|--force|--after|--only-failed` 使用全局来源 keyset；report/apply 自动沿 checkpoint 遍历所有批次，`--after` 是人工续跑的起点。`--apply` 每来源事务；失败项 manifest 记录来源键/类别/次数；`--only-failed` 逐项续跑。生产环境必须配置指向持久卷的绝对路径 `MENTION_REBUILD_FAILURE_MANIFEST`。
- `Jobs.CMSMentionHealth` 每 15 分钟扫描全部来源，检查缺水位、落后、漂移、缺正文、失败 Outbox 与失败 manifest；按来源去重计数，异常发 telemetry `[:groupher_server, :cms, :mention_health]`、error 日志并令 Oban Job 失败。运维告警接收方是 Oban 失败 Job/服务 error 日志的现有采集链，目标环境须验证实际通知送达。
- 本地测试：后端本轮全量 2491 通过/1 原有排除、0 失败；后续发现并修复多批次 CLI 后 `artiment_mentions_test.exs` 定向 29 通过，包含 keyset 逐批遍历与 `--after` 断点；同步、DocTree 与 Map/一跳聚焦曾 47 通过，包含过期 body/Outbox token 追赶与 canonical drift 修复；Community type-check、相关 Vitest（6 个用例）、oxlint、`mix compile --warnings-as-errors`、`pnpm docs:check` 通过。GraphQL 测试覆盖 Doc `branchId` 与 Comment ID 的 opaque 响应、User Ticket 双向一跳、缺水位/漂移 pending、重复 frontier。
- 隔离库 `groupher_reference_map_smoke`：全量迁移、`home` seed、浏览器 `/home/post/8` → `/home/post/2` 有向边、`/home/blog/9` 与 `/home/changelog/5` 空图、`/home/post/2#comment-25` 首屏外 Comment overlay 成功；30 秒未变 revision 只发 1 次 GraphQL 请求。report 扫描 33 个来源零问题。删一条水位后 report 报 `missing_watermark`、health 返回 `{:error, :mention_health_unhealthy}`，`--apply` 修复后 report 清零。隔离库已清理。
- 用户指定的 M5 目标为本地隔离库 `groupher_reference_map_m5_20261103`，全部迁移后以真实 Phoenix 4011 与 Community 3011 验收。切换前 `--report` 扫描 37 个来源并发现待同步项；`--apply --batch-size 100` 处理 37 个来源、失败清单为空；切换后 report 扫描 37 个来源且 `issues=[]`。六类 GraphQL 焦点均 READY，Post 来源到 Blog、Changelog、Doc、公开 User Ticket、Comment 共五条出边，URL 均为公开路径，revision 可读。浏览器六类页面均挂载 Map；`/home/post/10#comment-25` 的目标位于第二页，`oneComment` overlay 在第一页显示目标，点击其 Map 入口可展开 Comment 的引用关系。
- M5 故障注入：将该 Comment 正文暂时替换为无效 JSON，`--apply --force` 非零退出并留下仅含 `source_key=comment:00000000000000000025`、`category=invalid_json`、`attempts=2` 的失败项；巡检返回 `{:error, :mention_health_unhealthy}`，本地 telemetry 接收器实际收到 `issues=1, scanned=37`。修复正文后 `--apply --only-failed` 只处理 1 项并清空 manifest；最终 report `issues=[]`，巡检返回 `{:ok, :pass}`，同一接收器收到 `issues=0, scanned=37`。故障注入还发现失败清单可能通过 `inspect(reason)` 暴露无效正文，已改为稳定错误类别并增加回归测试。浏览器控制台仅有隔离环境未提供的图片资源错误。
- M5 全链路 review 发现 CLI 曾只处理首批来源；修复后使用 `--batch-size 10` 在隔离库验证四批遍历：`--report` 汇总 `scanned=37, issues=[]`，`--apply --force` 汇总 `processed=37, failures=[]`。全量 apply 不保留逐项成功结果，避免重建大库时输出和内存随来源数增长；失败项仍在持久 manifest。从 `comment:00000000000000000001` 断点运行 `--report --after` 扫描余下 32 项、零问题。对应真实 DB keyset 回归 29 个定向测试通过。
- 原 `groupher_server_dev` 库在 Ticket V2 的 `ticket_v2_article_cutover_requires_content_reset` 保护点停止；未清空现有内容。本地 Phoenix/Community 服务已恢复到原启动状态。

### 2026-11-03 正确性与成本复核

- Comment 软删除在原事务记录 tombstone token 与 `comment.mention_sync`，真实 DB 用例验证 worker 清边、水位追平、report 无漂移；创建 Comment 对 X/Y 当前 binding 分别发 `comment.changed`。普通共享 Comment 的 AI 初始和结果块均为全局；两社区请求分别 clear 时，先完成的一条不会解除另一条的块。审核块迁移已在隔离 test 库执行。
- Community pending 包含 `synced_content_token=NULL`；origin 为 NULL 的作者公开评论列表从现存公开 binding 投影。旧 direct Comment 命令通过当前 binding 稳定解析，不使用已删除的 origin；GraphQL 请求仍使用显式路径。45 条事实的真实 DB 用例跨窗口验证 Map 与一跳 cursor 三页均无漏边；10 frontier 常规 SQL 预算仍通过。
- 前端 `client.test.ts` 与 `ReferenceMap/index.test.tsx` 共 26 用例通过，Core type-check 通过；view/upvote 不再发 Map 内容变更事件，pending READY 后清除查询前缀。后端 Comments、Review、Mention 与 GraphQL 聚焦回归 357 用例通过。全套 2500 用例首次运行 2498/2499 通过、1 排除，唯一失败是 Assets 101 draft refs 的 60 秒超时；单独首次也超时，延长上限后 14.3 秒通过。待低并发全套复核前，不把该次全量执行记为全绿。
- 随后后端全套以 `mix test --timeout 120000` 复核：2499 通过、1 原有排除、0 失败（223.3 秒）。组合索引迁移后 17 个 GraphQL 引用用例再次通过。`pnpm docs:check`、`git diff --check` 通过。最新 R17 使用新的隔离库 `groupher_reference_map_r17_20261103` 和 Phoenix 4011、Community 3011 验收：`/home/post/8` 的 Map 实际显示 Comment→父 Post 和 Comment→其他 Blog；从 Comment 的 Map 入口可展开相同方向的两条引用。软删除该 Comment 并刷新后，页面保留 tombstone，但 Map 变为只有 Post 焦点和“无可见引用”，没有旧边或持续 pending；重建 report 扫描 10 个来源，`issues=[]`。控制台错误仅为隔离环境未提供的图片资源。浏览器和服务已停止，隔离库已删除。该隔离环境验收不代表生产切换。
- 最终改动后的全量再跑（与前端、文档检查及隔离库验收并发）耗时 367.2 秒，2499/2500 通过、1 原有排除，唯一失败是原有 Press 跨页站点清单用例在数据库查询中达到 120 秒超时；停止并发负载后单独复跑该用例 7.1 秒通过。无并发验收任务时又一次 `--timeout 120000` 全套运行仍在同一用例超时；`mix test --timeout 300000` 最终全套 2500 通过、1 原有排除、0 失败（212.8 秒）。前端 26 用例、Core type-check、`pnpm docs:check` 均通过。

## 目标环境切换前置条件

2026-11-03 只读核对 Fly `groupher-api`：机器运行且健康检查通过；Secret 列表尚无 `REFERENCE_MAP_KEY` 与 `MENTION_REBUILD_FAILURE_MANIFEST`，应用尚无持久卷，`fly.toml` 未配置 mount。用户将本轮 M5 目标指定为本地隔离环境，因此生产环境未执行 Reference Map migration、report/apply 或 Map 验收。未来部署前须为失败清单提供持久存储路径与对应 mount，设置至少 32 字节的 Map 签名密钥及版本，确认 Oban 失败 Job/error 日志的实际告警接收方，再按合同 10.2 节执行 report→apply→故障注入→report 复核。本地遥测送达证据不等于生产告警链送达。
