# MentionsGraph B0：实施清单与失败基线

> 本文仅保留设计和历史结论。原始源码快照、测试日志与测量输出已从仓库移除；历史数字不作为当前发布验收证据。

> **历史证据（2026-11-04 至 2026-11-06）：**本文的 set／occurrence／初始化／重建、请求级 SQL 预算及按资源状态裁剪图标题、URL 或边的条款均不适用于 2026-11-07 当前关系实现。现行代码合同见[当前关系合同](./mentions-graph-sync-contract.md)，新目标只用全新空库，不迁 B4 内容。下文原始测量与当时的执行事实保留供追溯，不能作为本轮发布指引。

> 2026-11-06 后续决策：目标输入合同改为只识别结构化 Plate `a/link` 和 `mention` 节点；text 节点 raw HTML anchor、裸 URL 不再作为目标能力。工作区已按此修改；下文 B0/B1 的 text 输入记录仍是历史实现与验收快照，不能作为新合同的通过证据。当前实现见[同步实现合同](mentions-graph-sync-contract.md)和[设计评审 §11](mentions-graph-design-review.md#11-本轮落地后的边界复核2026-11-06)。

> 状态：B0 原盘点及稳定 Doc 身份补充基线通过；B1 隔离环境出口通过（来源/状态、通知、重建与删除恢复见 §9.35，目标 Auth 实签见 §9.36，Doc Comment 联合见 §9.39）；B2 功能与请求 SQL 预算已验收，PG17 本地扫描/延迟/锁诊断通过，但代表性目标容量和首次成功率性能出口仍为 `PARTIAL`；B3 隔离环境接口/产品及 Community 生产构建通过。2026-11-06 决定记录 B2 缺口并推进 B4 准备与隔离演练；生产切换仍 BLOCKED，未部署/初始化/切换；外部候选搜索继续暂缓。最新证据见 §9.42 与 [B2 性能记录](mentions-graph-b2-performance-acceptance.md)。
> 本文记录原 B0–B4 历史代码证据与执行落点；当前运行时权威是[同步实现合同](mentions-graph-sync-contract.md)。旧目标设计或 expected-failure 测试不得记作本轮功能通过。
> 2026-11-04 决策修订：Mentions 查询一致性统一使用单行表中的整数列 `revision`；不按 Community 分桶，不使用 projection epoch 或外部 epoch 配置。
> 2026-11-05 命名同步：单行全局图版本表为 `mentions_graph_state`（只含 `id` 和 `revision`）；新迁移将当前 `mentions_graph_revisions` 改名，运行时模型为 `Model.MentionsGraphState`、owner 为 `MentionsGraphRevision`，GraphQL 入口为 `mentionsGraphRevision`。旧 `reference_map_revisions` 表仍保留到 B4 writer 停机、排空和旧表清理步骤，不再读写。
> 2026-11-04 已在本地测试库执行创建 `mentions_graph_revisions` 的迁移及定向验证；§9.25 新增的 `mentions_graph_state` 改名迁移尚未执行。没有运行生产数据初始化、队列终止、旧表删除或发布操作。

> §9.1–§9.35 为当时执行记录，保留原模块名、路径和命令；当前命名与 Auth 状态以 §9.36 为准。

## 1. 本轮固定的三条边界

1. 初始化 A→Comment C 时，即使父 Article 没有 public selection、不在来源 S，仍按 canonical article_id/thread 创建稳定父 auxiliary endpoint，再创建 C endpoint。同一事务、唯一身份幂等；辅助身份进入 manifest，不计入 S，不生成虚构 set/水位。
2. Article UUID / Comment ID 是全局稳定身份；mirror 到多个 Community 不造成歧义。只有 Community-local locator/URL 在指定 Community 内不能唯一定位才报歧义。Doc 验证唯一 owner 和正文当前 main 选版，branch 不参与 endpoint 身份。
3. mentioned_at 在保存 set 前验证同关系 occurrence 一致，失败整事务回滚；投影前再校验。不可变坏 set 不得先落库再仅回滚投影。

## 2. 写入、删除与投影落点

以下路径均相对 `backend/api/lib/groupher_server/`。新 set 写入嵌入原 Command 事务；表中的后置同步入口不另行成为业务写入口。

| 当前落点                                                                                        | 当前行为/风险                                                                                                | B1/B2 工作                                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `cms/articles/workflow.ex` publish / enqueue_mention_sync                                       | 普通 Article 与 Doc 选版后写 desired token、Outbox、revision                                                 | 发布选版后保存不可变 set；事件只带 set 身份，不带 epoch；token 公式保持                               |
| `cms/articles/publish/doc.ex`                                                                   | Doc 发布独立分支与同步事件                                                                                   | 与 workflow 一并覆盖，不能漏 Doc publish 路径                                                         |
| `cms/tickets/persist.ex`                                                                        | User Ticket publication token / article.mention_sync                                                         | 纳入 User Ticket 的 set、全局 revision 和公开准入；Worker/Case 不入图                                 |
| `cms/comments/commands/create.ex`、`reply.ex`、`update.ex`、`delete.ex` → `comments/effects.ex` | canonical CommentBody + 评论 effect；delete 写 tombstone 后发同步                                            | 正文版本与 set 同事务；delete 保留入边，修改/回复继承绑定与时间                                       |
| `cms/comments/persist.ex` update_content / tombstone                                            | CommentBody 原位 version+1，无正文历史                                                                       | 先读旧绑定再保存新 set；回收按 desired/synced 与锁规则                                                |
| `cms/doc_tree/persist.ex:477` duplicate 路径                                                    | 直接 `ArtimentMentions.sync(duplicate)`                                                                      | 明确复制后的 canonical 选版，走新 set 保存，禁止留下即时重解析旁路                                    |
| `cms/artiment_mentions/parser.ex` parse / collect / resolve / load                              | AST 输入、URL 分类和目标解析分支不等价；解析失败当前可能直接丢弃                                             | 按 §2.1 分支矩阵实现；普通发布与初始化绑定模式明确分离                                                |
| `cms/production_seed/cleanup.ex:423–443` purge_article! Ticket 分支                             | move_to_draft 后直接 ArtimentMentions.purge；保留 Ticket aggregate/历史，并非硬删                            | B1 同步适配撤回语义：撤公开出边，保留 endpoint/set/合法入边，不写删除墓碑；B4 停旧 cleanup 后才删旧表 |
| `cms/artiment_mentions/canonical_source.ex`                                                     | 读当前 public/body 后进 Store；含 author preload                                                             | 重建读 set；初始化独立读取 canonical 正文，不依赖旧 author preload/通知                               |
| `cms/artiment_mentions/store.ex`                                                                | sync_public / sync_comment_public 重新 parse、删后插；mark_target_state / preserve_incoming_deleted 为 no-op | 分离 set 保存与当前索引投影；source 锁、水位、revision 同事务；入口不再解析已删除目标                 |
| `cms/articles/trash.ex` trash/restore/permanent delete                                          | mark_target_state、purge_article_comments、purge                                                             | 冻结受影响来源 Community，更新墓碑，撤出边而保入边                                                    |
| `cms/docs/trash.ex` purge_branch                                                                | 删 draft/public/branch version/state/lifecycle，最后可删 Article                                             | branch/Comment auxiliary 身份不能被活体 FK 删除；删除事件覆盖此路径                                   |
| `cms/articles/lifecycle.ex`、`docs/lifecycle.ex`、`comments/lifecycle.ex`                       | 旧状态变化按 binding bump GraphRevision                                                                      | 改为影响 Mentions 结果时同事务递增唯一全局 `revision`；不按 Community 分桶                            |
| `cms/review_blocks.ex`、`review/decisions.ex`                                                   | 审核变化 bump                                                                                                | 不公开审核原因，NodeStatus 仅 UNAVAILABLE；恢复保身份                                                 |
| `cms/articles/binding_persist.ex`、`communities/lifecycle.ex`、`communities/commands/update.ex` | binding/Community 变化 bump                                                                                  | 拆镜像、删 Community 不丢全局事实；更新相关缓存                                                       |
| `cms/artiment_mentions/sync_progress.ex`                                                        | Article→Comment 等锁顺序、canonical token 和 desired/synced                                                  | 增加 set/解析版本维度；source/set composite FK；worker 完成必须 bump                                  |
| `messaging/mentions/persist.ex`                                                                 | 通知 delivery identity、insert_all                                                                           | 初始化/重建不调用；只在正常发布新增提及触发，不修改旧通知记录                                         |

`cms/content_import` 等上游发布入口应复用上述发布 owner；B1 测试必须通过导入/普通发布各一例证明没有绕过。若实施中新增直接写入口，先补入此表。

### 2.1 Parser 输入、分支与结果矩阵

落点均为 `cms/artiment_mentions/parser.ex`，类型集合由 `config.ex` 提供。当前 `parse/2` 先收集候选，再批量解析；未命中内部资源的候选会被丢弃，不能据此认为“没有引用”。下表“当前结果”保留 B1 实现快照；“新合同”列按 2026-11-06 待实施决定修订。以下 URL 行，包括平台公开 URL、Doc URL、Comment fragment、旧 UUID URL、custom domain 和外部 URL，**仅指结构化 Plate `a/link` 节点的 `url/href`**。text 节点中的 raw HTML anchor 与裸 URL 只描述旧实现；目标合同中它们是普通文字，不生成内部边、URL target 或 occurrence，初始化同样不扫描。

| 输入 / 当前分支                                                                                                    | 当前结果                                                                                                                                      | 新合同：正常发布 / 编辑                                                                                                                                                                                                      | 新合同：当前正文初始化                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Plate `type=mention`：`parse_inline_mention` / `inline_mention_type/value`                                         | 从编辑器通用 `key`（`type:stable-id`）提取身份；`value` 只作显示；保留 block/path/display                                                     | CMS 校验稳定身份及匿名完整 public Scope；不读取目标 Community/branch 字段                                                                                                                                                    | 从 canonical AST 的同一 `key` 提取身份；稳定身份验证后绑定，不读取旧关系                                                                       |
| 嵌套 children / text：`collect_mentions_from_node` / `extract_links_from_text`                                     | 递归 children；text 中同时提取 HTML anchor href 和 HTTP(S) 裸 URL，去重；结构化 `a/link` 已可读取 `url/href`                                  | 保留对所有节点 `children` 的递归，只移除 text 中的 URL/HTML 提取；结构化 `a/link` 的 `url/href` 每个节点计一次，label 的纯文本部分即使与 URL 同值也不另计，结构化子节点仍按节点规则处理；不同节点即使 URL 相同仍保留各自位置 | 同一结构遍历规则；text 中 raw HTML/裸 URL 不生成候选；结构化 link 与 mention 仍进入报告，重复节点各有唯一位置                                  |
| 结构化 Article 稳定 ID：`load_stable_articles` / `public_article_scope`                                            | Parser 按 `key` 中的全局 UUID 批量执行匿名 public Scope；多个 mirror 只选一个公开展示投影，不改变目标身份                                     | 校验 UUID 与 thread；至少一个公开 binding 可读才新建边；不借用 source Community；不可读的新 ID 留普通文本                                                                                                                    | 全局 UUID 唯一定位 Article，不要求 mirror binding 唯一；hidden/no public selection 仍可创建 endpoint                                           |
| 结构化 `a/link` 的平台公开 URL / 相对路径：`public_article_link` / `load_public_articles`                          | 已按 URL 中 Community + thread + inner ID 定位，并经匿名 Article/Doc Gate Scope 检查 Lifecycle、ReviewBlock、Community 和 Doc main branch     | 按 `url/href` 目标 Community 的完整 Scope 绑定；不可读保留普通链接，不建内部图边；locator 错配报错                                                                                                                           | 以 `url/href` 指定 Community 唯一定位 canonical binding；验证身份，不用目标 public selection 过滤                                              |
| 结构化 `a/link` 的 Doc URL（可含 slug）/ `mention` 的 Doc ID：`load_public_articles(:doc)` / `load_articles(:doc)` | main branch + DocPublic + branch version；缺投影时丢弃                                                                                        | 校验 main branch、真实归属和完整 Doc Scope；不可读按结构化 ID/URL 规则降级                                                                                                                                                   | 必须能验证 branch；不猜测其他 branch，父/target 可不在 S                                                                                       |
| 结构化 `a/link` 的 `#comment-N`：`public_article_link` / `load_public_comments`                                    | Comment 经匿名 Comment Scope，父 Article/Doc 再按 URL 指定 Community 经完整 public Scope；Doc 校验 main branch 与 Comment branch 一致         | Comment 自身、父级、binding、Doc branch 全部通过才新绑定；父隐藏则保留普通链接                                                                                                                                               | canonical Comment 唯一定位后创建/复用 parent endpoint，即使父不在 S；同事务记 auxiliary manifest                                               |
| 结构化 Comment ID：`load_comments`                                                                                 | Parser 按 `key` 中的全局 Comment ID 批量校验 Comment 与同一 binding 下父 Article/Doc 的完整 Scope；Doc branch 从 canonical Comment 与父级确定 | Comment 与父级都公开才新建边；不借用 source Community，不要求编辑器给出 branch                                                                                                                                               | 全局 Comment ID 不因多个父 binding 报歧义；核验 canonical 父/branch，先父 endpoint 后子                                                        |
| 结构化 `a/link` 的旧 UUID URL / `?comment_id=`：`site_article_link?` / `internal_mention_from_url`                 | Config 站点 `/thread/` 前缀；Article 取 path 第 2 段 UUID，Comment 仅 query 以 comment_id= 开头时识别；后续走稳定 ID 解析                     | 仅把结构化 link 的 `url/href` 语法归一化，不保留旧查询逻辑；无可信目标 Community 时 ID 链接降为普通链接，不猜 binding                                                                                                        | 从当前正文结构化 link 的 `url/href` 验证稳定身份；Comment 用 canonical 父归属；不读旧 mention 数据                                             |
| 结构化 `a/link` 的 custom domain / 非信任 host：`classify_url`                                                     | 无 host registry，即使路径像平台地址也当 external URL + hash                                                                                  | 保留 URL target/occurrence，不按路径识别 CMS 身份；同内容的 text URL 不生成 target/occurrence                                                                                                                                | 同左，不在初始化中引入隐式域名信任                                                                                                             |
| Ticket：`load_public_articles(:ticket)` / ID 的 `load_articles`                                                    | URL 分支调用 Tickets.get_public；ID 分支走通用 ArticlePublic join，两者校验不同                                                               | 两分支统一验证 User Ticket 和匿名 public Scope；Worker/Case 不入图，Ticket Comment 不支持                                                                                                                                    | 仅 User Ticket；稳定身份校验 TicketState.type，不以当下 public 可读性过滤                                                                      |
| User：`inline_mention_value(:user)` / `load_users_by_login`                                                        | `key=user:<login>`，按 login 查 User；`value` 只用于展示；普通 `/u/login` URL 不自动变 User                                                   | 保留 User target，按公开资料规则绑定/展示，不建图节点；通知只由正常命令触发                                                                                                                                                  | 保留可验证 User target；无用户的文本记 ordinary_text；绝不发通知                                                                               |
| 结构化 `a/link` 的外部 URL：`do_parse_link_mention`                                                                | URL + SHA256 hash；不探测网络                                                                                                                 | 按现有 URL 安全规则保存 URL target/occurrence，不建图节点、不探测远端；裸外部 URL text 不生成 target/occurrence                                                                                                              | 相同；不抓取网页恢复身份，裸外部 URL text 不进入报告                                                                                           |
| 缺失/无效输入：parse 非 list、未知 type、无 ID、非法 inner ID/fragment、查无资源                                   | 非 list 返回 []；无效 inline/内部未解析候选可丢弃；URL 分类失败可能转 external                                                                | 区分普通 text（包括裸 URL/raw HTML）与结构化 link 的身份伪造/错配；后者显式错误，不静默吞掉；合法空正文保存空 set                                                                                                            | 结构化 link/mention 无法验证身份时记录 ordinary_link/text 及原因；裸 URL/raw HTML text 不生成候选；冲突/损坏为 error，阻断 apply；不得伪造墓碑 |

跨全部分支的测试维度：source/target 同 Community 与跨 Community；可读、审核隐藏、软删除、永久删除、父级隐藏；main/非 main Doc；UUID 多 mirror 与 local locator 歧义。正常编辑还必须覆盖同 source 可信旧 set 的 endpoint + mentioned_at 继承，不能重新按公开解析丢边；初始化没有旧 set 可继承，按合同 §9.2 从当前正文验证。上述是正文输入覆盖，不是旧 API/旧关系数据兼容层。

B1 当前测试归属为 `backend/api/test/groupher_server/cms/mention_version_facts_test.exs`（Parser、Capture、Store 继承与初始化）及相邻的 `mentions_graph_query_test.exs`。后续若矩阵用例继续增长，再按 Parser 与 InitializeCurrentSets 责任拆文件；不为目录形状复制现有用例。每个矩阵行至少需要一个结果断言，失败/降级分支也须覆盖，不只验证 happy path。

## 3. 旧异步写入停机清单

| 入口                                                       | 队列/标识                                                                                                                | B4 处理                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Jobs.CMSMentionHealth`                                    | config/config.exs 的 `*/15 * * * *`；cms_outbox                                                                          | 先关 cron，处理已排队 health；它虽 report-only 也不能在删表期间继续查询                                                              |
| `Jobs.CMSOutboxArticle`                                    | cms_outbox，args.event_id → Outbox `article.mention_sync`                                                                | 用 event_id 关联过滤事件，不能取消该 worker 的全部业务事件                                                                           |
| `Jobs.CMSOutboxComment`                                    | cms_outbox，args.event_id → `comment.mention_sync`                                                                       | 同上，核对 waiting/processing/retry 与已执行事务                                                                                     |
| **`Jobs.Comments`**                                        | **default**，args.type=`sync_mentions`、version=1                                                                        | 额外旧入口；通过 `Comments.Effects.deliver` 直达 sync_comment_public，必须单独排空/终结                                              |
| `Jobs.Workflow.sync_mentions`                              | 创建上述 Comments job                                                                                                    | 停旧 producer；新逻辑删除这条 sync 分支或只转入新事件，不支持旧 payload                                                              |
| `CMS.Events.SyncMentions.handle`                           | CMS event bus `:sync_mentions`                                                                                           | 停旧发布进程，替换直接 sync 入口；不能只停 Oban                                                                                      |
| `mix cms.mentions.rebuild`                                 | CLI report/apply/only-failed + 失败 manifest                                                                             | 停运维调度和存活 CLI，旧失败 manifest 不导入新数据集                                                                                 |
| Outbox Workflow Article/Comment                            | `cms/outbox/workflow/{article,comment}.ex`                                                                               | 新切换不做 epoch 比较；B4 按事件类型终结旧 Mentions event，确认不可领取/重试后再删旧表                                               |
| `cms/production_seed/cli.ex` → `cleanup.ex` purge_article! | `backend/api/scripts/production_seed.sh` → release CLI 的 cleanup-apply / delete-tmp 同步运维进程，Ticket 分支直接 purge | B4 停旧 cleanup 调度/CLI/release 执行并确认在途事务结束；B1 适配后随新构建恢复，不永久删除该部署能力；不得把撤回 Ticket 标成 DELETED |
| `cms/production_seed/map_failure.ex`                       | 调用 Rebuild 的故障演练                                                                                                  | B4 不允许运行旧演练脚本；不改生产 seed 业务范围                                                                                      |

停止领取不等于执行事务结束；验收清单须记录活跃旧 writer=0、在途事务=0、可领取/可重试旧任务=0。不能清空共享 cms_outbox/default 队列。B4 按明确的旧 Mentions event/job 类型终结待处理项并记录计数；新 payload 不增加 epoch 字段。只有上述门禁全部通过才允许删旧表及开放新 writer。

## 4. 数据结构与初始化输入

### 4.1 旧 DDL 删除范围

路径前缀 `backend/api/priv/repo/migrations/`：

| 文件                                                     | 必须处理的旧约束                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `20261102100000_create_reference_map_progress.exs`       | artiment_mention_sync_states 对 Article/Comment/branch 的级联 FK；reference_map_revisions        |
| `20261102104000_rebuild_artiment_mentions.exs`           | source/target 对活体的级联 FK；prepare_artiment_mention trigger、mention_key_part / prepare 函数 |
| `20261102105000_validate_mention_resource_ownership.exs` | validate_mention_resource_ownership 函数/trigger 依赖旧身份列与活体                              |
| `20261102112000_index_reference_map_edge_windows.exs`    | 旧 typed identity 邻接索引，替换 endpoint+edge_key 双向索引                                      |

直接建立新表和约束，无 nullable 过渡/旧行回填。保留 Article、Comment、正文、账户、通知与无关 Outbox 数据。新模型必须添加 set/source 和 endpoint/type composite FK；时间一致性在 Store 保存 set 前校验。旧历史 migration 文件保留为历史。

### 4.2 来源 S 与辅助身份

来源扫描按资源类型 + stable identity 排序、keyset 分页，每页≤100：

- Article：ArticlePublic→Article，thread 为 post/blog/changelog；Ticket 再 join TicketState.type=user。
- Doc：DocPublic→DocBranch，branch.type=main；再 join branch version/revision/body。
- Comment：Comment→父 Article，普通父存在 ArticlePublic 或 Doc 父在该 main branch 存在 DocPublic；再 LEFT JOIN CommentBody 检测缺正文。不以审核隐藏筛除来源。
- 缺 revision/body/CommentBody 是错误；仅 draft、非 main branch、Worker/Case 不进 S。
- target 可以不在 S。Comment target 先由 canonical Comment 确定父身份，再创建 auxiliary parent endpoint。不能用父有没有 public selection 决定是否能创建 endpoint。
- Article 多 mirror 不扩大 S，不产生多个 endpoint。Doc source 则按 Article+branch 区分。

新增 [report-only 脚本](../../../backend/api/scripts/mentions_graph_b0_report.exs) 仅用 Ecto SELECT 汇总当前来源、缺正文、旧关系/水位及候选 worker/event 数；不读取私有正文、不初始化、不清队列。候选 worker 数含无关事件，不是可直接删除数量。

本地 `groupher_server_test` 报告：Article/Doc/Comment 来源均 0，缺正文 0，旧关系/水位 0，候选任务和提及事件为空。仅说明 sandbox 测试结束后的本地环境，**不代表生产没有内容**。生产 manifest/counts 在 B4 暂停写入后生成。

### 4.3 Manifest v2 与可执行入口

当前 CLI 输出 schema v2。顶层 manifest 只保存页文件摘要、来源数和 checkpoint；每个页文件保存有限数量的来源 identity、token/hash 和解析候选，不含正文。v1（带 epoch 的旧格式）会被拒绝：

```json
{
  "schema_version": 2,
  "parser_version": 1,
  "database_identity": "<environment identifier>",
  "pages": [
    {
      "file": "articles-1.json",
      "sha256": "<page hash>",
      "count": 1,
      "category": "articles",
      "cursor": null,
      "limit": 100
    }
  ],
  "source_count": 1,
  "checkpoint": null
}
```

大集合按页存储，顶层 manifest 保存页文件 hash/count 和 checkpoint，不把全部正文/来源留在内存。resolution 限定 bound / ordinary_link / ordinary_text / error，非 bound 要有原因码；identity conflict 为 error，不能减少分母。apply 复核 database identity、page hash、canonical token、稳定 parent/type 和正文选版，幂等创建身份和 set。全局稳定 ID 不要求 binding 唯一；URL 在指定 Community 中必须唯一。辅助身份按 identity 排序去重，先父后子；数据库唯一冲突后验证归属，不覆盖。

CLI 已实现：`mix cms.mentions.initialize --report --manifest <path>`、`--apply --manifest <path>`、`--preflight --manifest <path>`，通过 `Commands.InitializeCurrentSets` 执行。认证不复用 production seed bypass：Auth 的 SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE / SERVICE_AUTH_RESOURCES_JSON 注册运维资源 `https://api.groupher.com/cms-maintenance`，audience=`phoenix:cms-maintenance`，scope=`cms:mentions:initialize`。目标 Auth 已登记两个独立 client，真实 token 已分别在本机和目标 Fly 独立 BEAM 进程验证；正在服务的旧 Phoenix release 尚未接入该 capability，详见 §9.36。令牌从受控环境读取，不写 argv、manifest 或日志。

### 4.4 全局 revision 与切换关闭策略

- 全局图版本存储为单行表 `mentions_graph_state`：固定 `id = 1`，只含 `id` 和全局整数列 `revision`，不存 Community、来源、epoch、时间戳或其他状态；初始行是 `{id: 1, revision: 0}`。已有旧表由后续迁移改名，历史建表迁移保留原名。
- 专表承载跨来源、跨 worker 的同事务图版本；现有 Community/branch/资源状态表均有各自 owner，不能复用为唯一全局行。来源正文 revision 与 mention set 的 `source_token` 属于来源投影就绪判断，不进入该表。B2/B4 的代表性负载验收记录单行更新的锁等待，防止全局 revision 写入成为未评估的串行瓶颈。
- 影响 Mentions 查询结果的 set、current edge 或公开状态变化，与全局 `revision` 在同一事务递增；幂等 no-op 不递增。图/列表请求读前/读后各读一次该行，值变化则整页失败；cursor 绑定读取时的 revision，变化后要求从首批重载。`mentionsGraphRevision` 只返回由该整数派生的 opaque revision，不加载关系或 Comment seeds。
- 初始化 manifest 由 database identity、来源 token/hash 和分页 checkpoint 校验，不依赖环境配置版本。
- 初始化无通知副作用，以通知 Outbox、Messaging.Mention 和 Activity 前后数量/身份比对验收。
- B4 先停止旧 producer/worker 和任务领取，等待在途事务结束，逐类终结旧 Mentions 任务；验证活跃 writer、在途事务、可领取/可重试任务均为零后才删表。共享队列其他事件不得清理。

## 5. 查询落点和 32 SQL 的具体计划

### 5.1 原生 SQL、fragment 与隐式查询清单

路径前缀为 `backend/api/lib/groupher_server/cms/artiment_mentions/`，清单覆盖图、列表、维护和写入查询，不只图读取：

| 当前落点                                                                 | 类别 / 用途                                     | 后续处理                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `reference_map/page_facts.ex:65` Repo.query!                             | 图邻接 LATERAL 原生查询                         | B2 Ecto union/subquery 有界分页                                                                          |
| `reference_map/read_model.ex:342` Repo.query!                            | endpoint 聚合原生查询                           | B2 Ecto 批量 endpoint/parent 读取                                                                        |
| `reference_map/batch.ex:128`、`public_list.ex:57` Repo.query!            | SET TRANSACTION 原生语句                        | B2 用合同 revision fence；移除两处 raw SQL，不在 helper 中隐藏事务语句                                   |
| `rebuild.ex:124` Repo.query!                                             | 维护 CLI 的来源 union/keyset 查询               | B1 重建改为读新 set 的 Ecto 查询；初始化按 S 单独 Ecto 扫描。维护任务不计图请求 32 SQL，但每批必须有上限 |
| `reference_map/batch.ex:174` fragment                                    | branch 的 NULL-safe equality，是局部 SQL 表达式 | B2 按 branch 是否 nil 构造 is_nil 或等值 Ecto 条件，不保留该 fragment                                    |
| `store.ex:300` fragment                                                  | DISTINCT mentioned_user_id，是写入/通知辅助查询 | B1 改为 Ecto distinct/select，不改通知语义                                                               |
| `canonical_source.ex:59,78` Repo.preload                                 | 加载 author.user                                | 初始化/图读取不经此 preload；既有写入通知需求单独保留审查                                                |
| PublicList.source_ready?/projected_url、PublicLocator/FrontDesk 间接调用 | 每项 Repo 查询或隐式 preload                    | B2 批量读取，图和列表禁止 Repo.preload/Ecto preload，间接调用成本也计预算                                |

本清单区分“整段裸 SQL”和“Ecto 局部 fragment”；不将后者一律称为裸 SQL。新实现原则上使用 Ecto，必要 fragment 要单列用途，禁止以 fragment 包装完整查询。

### 5.2 图请求预算

目标每批 Ecto query 的分工如下，**设计计划，不冒充实测新实现**：

| 编号   | Ecto 查询形状                                                                                                                     | 最大 SQL |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q01    | Community + 匿名准入字段                                                                                                          | 1        |
| Q02–07 | focus/frontiers 合并去重，按 post/blog/changelog/doc/ticket/comment 六类查询；join binding/endpoint，Comment join 父 Scope        | 6        |
| Q08–17 | 每 frontier 出/入边各 limit(first+1)，Ecto union/subquery 再排序 limit；来源 Scope、canonical token/set readiness 在 LIMIT 前过滤 | 10       |
| Q18    | 本批 endpoint + parent identity/墓碑一次查询                                                                                      | 1        |
| Q19–24 | 六类公开标题/路径/状态一次每类；只 select 当前公开字段，Comment 父级在同查询中约束                                                | 6        |
| Q25    | 六类 public 来源 union + LEFT JOIN SyncState/set 的 exists，含缺水位/解析版本变化                                                 | 1        |
| Q26–27 | 请求前后 revision fence                                                                                                           | 2        |
| Q28–32 | 预留 5；新增查询必须在 inventory 写出用途，不能隐式 preload                                                                       | 5        |

预算按实际执行累计，空类型不发 SQL；focus 在 frontiers 内只校验一次，计入 10 个。frontiers 不含 focus 时最多 11 个定位身份，仍按类型批量查询；只展开指定 frontier。NodeStatus 复用 Q02–07 已加载的公开资源，不能再次做单项 FrontDesk 请求。

Comment seed：Q01 + focus 准入≤6 + 选 Comment IDs/水位的分页1 + pending1 + fence2 =≤11；不为 seed 查询正文。独立 revision 查询：仅读取全局 revision，不按 focus 或 Community 查询版本。

### 5.3 一跳列表独立预算

`mentions` / `mentionedBy` 各自作为完整请求核算；同一个 Query 预算贯穿 resolver、定位、状态与分页，不能在子调用重置。下表为保守上界，不预先扣除根节点复用收益：

| 编号     | 用途 / 查询形状                                                                         | 最大 SQL |
| -------- | --------------------------------------------------------------------------------------- | -------- |
| L01      | 请求 Community + 匿名准入                                                               | 1        |
| L02–07   | 内部 source/target 根定位 + 完整 Scope，沿用六类批量计划；单根通常仅执行其类型          | 6        |
| L08      | 当前方向关系：来源公开 Scope、token/readiness 在 LIMIT 前约束，按 edge key 取 first+1   | 1        |
| L09      | 本页 source/target endpoint、parent、墓碑合并读取                                       | 1        |
| L10–15   | source/target 合并去重后的 NodeStatus，按六类型批量公开字段；Comment 同查询校验父 Scope | 6        |
| L16      | User 根或本页 User target 的公开资料；两场景互斥，最多一批；USER 反向根先验证再查邻接   | 1        |
| L17      | Community 全量 public 来源 pending exists，与图 Q25 同 Scope，含缺水位/set              | 1        |
| L18      | offset count，使用与邻接完全一致的来源 Scope/readiness；cursor 模式不执行               | 1        |
| L19–20   | 请求前后全局 revision fence，变化则明确失效；不偷偷重跑整页                             | 2        |
| **合计** | **已分配上界；请求硬上限仍为 32**                                                       | **20**   |

空类型不发 SQL；根节点公开资料复用；URL 无远端查询。隐藏 target 保留占位并占分页位置，hidden source 在 SQL 中过滤；source/target 状态不能按行查。预留 12 条不得隐式消费，新增用途先登记。实际执行顺序允许把 User 根准入前置，但总预算不变；事务额外语句（除 BEGIN/COMMIT/ROLLBACK）也计入预算。

B2 在 `backend/api/test/groupher_server/cms/mentions_graph_budget_test.exs` 覆盖两个方向 × offset/cursor、混合六类、User/URL、隐藏目标、隐藏来源、空页但 projectionPending=true、全局 revision 变化；同时断言内容/计数、实际 SQL 总数≤32、没有逐项查询/隐式 preload。不得因列表未进入图入口而漏算 L17 或 NodeStatus。

所有查询发出前消费同一请求预算，禁止 Repo.preload/Ecto preload。此设计的正确性/索引和执行计划是 B2 验收，不在 B0 执行新 DDL 或伪造性能通过。

## 6. 前端/API 文件级清单

| 落点                                                                                                                                                                           | 现状                                                                              | B3 目标                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `frontend/core/unit/ArticleView/index.tsx`                                                                                                                                     | Viewer 与 Comments 为兄弟子树，另有常驻 ReferenceMap                              | 移除常驻图；本地 state 保存 tab/查看对象，通过 props/callback 连接两个子树                                               |
| `frontend/core/unit/ArticleView/Viewer.tsx`、`PostViewer/index.tsx:138`、`ChangelogViewer/index.tsx:113`                                                                       | 两个 Viewer 才是 ArticleFooter 的实际挂载点；PostViewer 同时承载 Blog             | 明确传参链，保留当前组件层次；不误写成 ArticleView 直接挂 Footer                                                         |
| `frontend/core/unit/ArticleView/ArticleFooter/index.tsx`、`constant.ts`                                                                                                        | Activity/Members tabs，默认 Activity                                              | 增加 Mentions；所有 tab 统一选中才挂载，数据查询在各面板内部                                                             |
| `frontend/core/unit/ArticleView/ArticleFooter/Activities/index.tsx`                                                                                                            | mock 活动，未接真实查询                                                           | 本轮接独立 articleLogs 查询，删除演示数据，支持分页、重试、取消；不预设 Doc 空态                                         |
| `frontend/core/unit/Comments/List/List.tsx`                                                                                                                                    | 本地选择评论并在行内挂图                                                          | 通过 onShowMentions 回调切 Footer；移除行内图，正文列表不查询提及关系                                                    |
| `frontend/community/src/routes/$community/doc/$id/$slug.tsx` → `frontend/core/unit/DocThread/Article/index.tsx`                                                                | 路由常驻图，Doc 正文没有 Comments List                                            | 路由移除图；Doc Article 在反馈区后挂 Footer，Mentions 内提供 Comment seeds/选择入口                                      |
| `frontend/community/src/routes/$community/ticket/$id.tsx` TicketDetail                                                                                                         | 独立公开 updates 区域和常驻图                                                     | updates 保持独立；常驻图改为默认收起的独立 Mentions 按钮/条件面板，不新增 Ticket Activity，见 §6.1                       |
| `frontend/core/unit/PostTicketProgress/index.tsx`、`ArticleView/PostViewer/index.tsx`                                                                                          | 展示 Post 关联 Ticket 的状态、完成数量和链接                                      | 文章详情中放在 Footer 上方的独立区域；先用简洁 UI；不受 Footer tab 控制，不影响其他列表卡片用途                          |
| `frontend/core/query/referenceMap.ts`、`unit/ReferenceMap/useReferenceMap.ts`                                                                                                  | 三个查询未传 signal；hook 自动 seeds/BFS                                          | 改为 query/mentionsGraph.ts、MentionsGraph/useMentionsGraph.ts；挂载自动查一页，seeds/展开由操作触发；完整取消           |
| `frontend/core/unit/ReferenceMap/index.tsx`                                                                                                                                    | 节点均为链接，逐边查 nodes                                                        | Graph 索引查找，状态占位，按组件/salon 拆分                                                                              |
| `backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex`、`resolvers/cms/activity.ex`、`backend/api/lib/groupher_server/activity/{article_log,post,ticket,artiment}.ex` | articleLogs 已有；Post 活动与 Ticket 日志属于不同流；Artiment handler 不含 Ticket | 接真实日志；B3 新增 PostLog.ticket_created / ticket_linked 及安全 target 投影，落点和验收按主合同 §8.3，不合并 TicketLog |
| `frontend/core/hooks/useArticleStates/index.ts`、`unit/Comments/pagination/usePages.ts`                                                                                        | 多页状态组合分别叫 useArticleStatesByChunks / useCommentPages                     | 收口为 usePagedArticleStates / usePagedCommentStates，详见 §6.3；不重做 Query/store 分层                                 |
| `frontend/core/query/comment.ts`、`query/viewer.ts`                                                                                                                            | 评论 page/infinite/reconcile 未传 signal，viewerStates 已传                       | B3 补齐前者网络取消，保留按页批量 viewerState 和账户缓存隔离                                                             |
| GraphQL cms 查询/类型/resolver、`frontend/core/lib/graphql/client.ts`                                                                                                          | 旧图命名与一跳 DTO；transport 已支持 signal                                       | 图改名、一跳新 DTO、生成物同步；所有新增/改动 queryFn 显式传 signal                                                      |

### 6.1 tab 宿主与组件接口（B3 实现）

**统一加载规则。** ArticleFooter 的 Activity、Mentions、Members，以及后续增加的 tab，全部只挂载选中面板；面板内 hook 自动查询自身数据，Footer 和页面 loader 不预先获取未选中面板的数据，不通过 CSS 隐藏常驻面板。默认 Activity 选中即挂载，可以首屏查询；“未点击零请求”专指未选中面板，不能错误禁止默认 Activity 请求。切回时遵守 TanStack Query 的 stale/cache 策略，不强制清空缓存重查。React 创建面板元素不等于挂载；数据 hook 必须位于实际被条件挂载的子组件内部。

```text
ArticleView                         本地 state: activeTab + focus
├── Viewer
│   ├── PostViewer（Post/Blog）
│   │   ├── PostTicketProgress      独立状态区，在 Footer 上方
│   │   └── ArticleFooter
│   └── ChangelogViewer → ArticleFooter
└── Comments → Content → List → 评论提及按钮
                               └── onShowMentions(locator)

ArticleFooter
├── Activity 选中 → Activities 挂载 → articleLogs 查询
├── Mentions 选中 → MentionsGraph 挂载 → useMentionsGraph 查询
└── Members 选中 → Members 挂载 → 该面板自己的数据查询
```

**状态和接口。** 保留现有 TanStack Query、store、Provider 分层。本轮不新增 Mentions Context、全局事件或另一份服务端缓存。ArticleView 用一份本地 state 保存 `{activeTab, focus}`；`articleFocus` 为页面所属文章的 locator，来自显式 community/thread/innerId，在查看评论时不变。Footer 为受控组件，不另存 tab/focus：

| 参数 / 回调             | 合同                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| community、articleFocus | 当前请求 Community、页面所属文章；Activity/Members 始终使用它们，不能因查看评论改查另一份文章数据 |
| activeTab、focus        | 当前 tab 和 Mentions 正在查看的文章/评论；focus 不改变正文页面身份                                |
| onTabChange(tab)        | 切换选中面板；离开后卸载旧面板并清理其任务                                                        |
| onShowMentions(locator) | 一次 state 更新同时选择 Mentions 和目标；从评论按钮进入直接查询 Comment，不能先误查 Article       |
| onReturnToArticle()     | 保持 Mentions，恢复 articleFocus，取消旧对象请求、清空旧图                                        |

ArticleView → Viewer → PostViewer/ChangelogViewer → Footer 传上述参数；Comments → Content → List/index → List/List 传 onShowMentions，回复/深链接展示中存在同类按钮时也必须转发。不将 salon 作为 props。各 tab 自己挂查询 hook，取消此前 activityContent/membersContent 携带父层已查询数据的方案；Members 仅在宿主支持该能力时展示，显示即遵守同一生命周期，不为占位 tab 伪造数据。

| 资源        | 状态 owner / 实际挂载点                                                    | 数据与交互                                                                                                                     |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Post/Blog   | ArticleView 本地 state；PostViewer 挂 Footer                               | Activity 查 articleLogs；Post 的关联 Ticket 状态独立显示在 Footer 上方；Comments 按钮通过 callback 打开对应评论提及            |
| Changelog   | ArticleView 本地 state；ChangelogViewer 挂 Footer                          | 同一 props/callback 链，Activity 查 articleLogs                                                                                |
| Doc         | `DocThread/Article/index.tsx` 本地 state，在 FeedbackFooter 后挂 Footer    | 使用传入的 community/innerId；Activity 查真实 articleLogs；Doc 不新增完整 Comments List，Comment seeds 入口归 Mentions 面板    |
| User Ticket | TicketDetail 本地 mentionsOpen，常驻图位置改为独立 Mentions 按钮及条件面板 | 默认收起，点击挂载共享 MentionsGraph，收起卸载；focus 固定当前 Ticket；无 Activity/Members tab、无 Comment seeds；updates 独立 |

**Doc Comment 的入口。** MentionsGraph 内提供“查看评论提及”按钮及 `MentionsGraph/CommentSeeds.tsx` 选择列表；仅点击按钮才调用 mentionsGraphArticleComments，使用 `articleFocus`，不使用正在查看的 Comment focus。选择一个可查看的 Comment locator 调用 onShowMentions；“返回文章提及”调用 onReturnToArticle。Doc branch 始终由服务端验证，不从前端补造 branch。Post/Blog/Changelog 可复用该面板入口，也可从正文评论按钮直接进入；Ticket 不显示该入口。

**活动接入纳入本轮 B3。** 现有 `articleLogs(article: ArticlePathInput!, pagi: PagiInput): ArticleLogPage!` 经 FrontDesk → Resolvers.CMS.Activity → Activity.ArticleLog 权限与分页投影。Activities 内新增 `useArticleActivity`，query 定义在 `frontend/core/query/articleActivity.ts`，按 article path、分页和接口权限语义隔离缓存并传 signal；不得把管理员/私有响应放进跨账户公共缓存。Post/Blog/Changelog/Doc 替换演示数据，查询成功且确实为空才显示空态；加载、失败、空结果分别处理。前端只按后端活动顺序展示和格式化，不合并不同业务流，不通过查询 Ticket 当前状态推导历史。

Post Activity 涉及 Ticket 的部分仅包含“这个 Post 何时创建或关联 Ticket”的事实。Ticket work status 变化、Ticket 文字更新不属于 Post Activity，后端负责事件流归属和公开投影过滤；现有 PostLog 确实缺少创建/关联事件，B3 按主合同 §8.3 在 create_user / link_source 事务中分别写入 PostLog.ticket_created / ticket_linked；同步 Activity.Post contract、PostLog 枚举与数据库约束。ArticleLog 保持读取 PostLog，不合并 TicketLog；前端不合成。`postTicketProgress` 的 TODO/WIP/DONE、完成数量、关联链接则用于独立状态区，跟随该区挂载加载，先保持简洁 UI，不增加时间线功能。

**Ticket 页范围已冻结。** `Activity.Artiment.handlers` 当前只有 post/blog/changelog/doc；Ticket 的 `tickets.activity` resolver 在 public_query 下返回 nil。本轮只补 Post 创建/关联 Ticket 的公开事件，不新增 Ticket 自身的公开 Activity API。撤销 Ticket 新增 Footer/default Activity 的旧目标，`frontend/community/src/routes/$community/ticket/$id.tsx` 的 TicketDetail 用本地 `mentionsOpen: boolean`（初始 false）控制独立“Mentions”展开/收起按钮和共享 MentionsGraph；focus 固定为当前 User Ticket。展开才查询，收起卸载、停止轮询并取消无人使用的请求，切 Community/Ticket 重置收起。已有 updates 区域独立保留；不创建空 Activity/Members tab、不调用内部 Activity、不提供 seeds。Post/Blog/Changelog/Doc 的 Footer 默认 Activity 及统一挂载查询规则保持不变。此处为明确的本轮范围收口，不代表 Ticket 公开 Activity 已实现；未来该能力需独立冻结读取与披露合同。

普通 Footer 切 Community 或页面所属 Article 时重置为默认 tab；Ticket 的独立 Mentions 重置为收起；显式切 Comment/返回文章时保留 Mentions。每个页面/抽屉实例本地 state 独立，无效 locator 不开放入口。useMentionsGraph 挂载首批只查询当前 focus 一页，不自动查 seeds/revision/一跳列表或 BFS；后续规则沿主合同。离开 tab、切对象或卸载时清理 timers/代次，传 signal 取消无人继续使用的请求，不能按 Community 前缀误取消另一实例仍使用的共享查询。浏览器取消不保证终止已执行的后端工作。

### 6.2 重命名与错误目录

待处理的重命名落点：`cms.ex` facade 中其余图入口、`artiment_mentions/reference_map*`、`opaque.ex`、i18n reference_map.*、其余 test fixture queries。全局 revision 链路已先行命名为 `artiment_mentions/mentions_graph_revision.ex`、`Model.MentionsGraphState`、`cms.mentions_graph_state` 与 `mentionsGraphRevision`；历史 `create_mentions_graph_revisions` 迁移保留原名，新增迁移改名已有表，不保留 `GraphRevision` 别名。外部 epoch 配置、事件字段、worker 校验与 `projection_epoch.ex` 已移除。B4 仍需停旧 writer 后删除旧 `reference_map_revisions`；一跳 API 名不是残留。新增 schema/operation 后执行生成物 freshness，不手改 generated。

`backend/api/lib/groupher_server/cms/error_cat.ex:69–73` 必须加入 B3/B4 清单：

| 旧错误函数                       | 新错误函数                        | 保留编号 |
| -------------------------------- | --------------------------------- | -------- |
| reference_map_not_found          | mentions_graph_not_found          | 4549     |
| reference_map_invalid_locator    | mentions_graph_invalid_locator    | 4550     |
| reference_map_invalid_cursor     | mentions_graph_invalid_cursor     | 4551     |
| reference_map_duplicate_frontier | mentions_graph_duplicate_frontier | 4552     |
| reference_map_invalid_request    | mentions_graph_invalid_request    | 4553     |

五项含义和 fail-closed 行为不变，编号仍由 ErrorCat 声明生成；修改定义、全部调用、测试/错误快照及有引用的前端消费者，不另写数字分支。新预算/超时等错误经 ErrorCat 正式分配，不复用上述编号。B3 构建只包含新函数名，B4 切换后不保留旧函数别名。

### 6.3 状态组合 hook 命名与 Comments 边界

| 用途                                    | B3 名称 / 落点                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 单篇文章组合状态                        | 保留 `hooks/useArticleState`                                                                                                                   |
| 当前一组文章组合状态                    | 保留 `useArticleStates`，例如普通分页当前页                                                                                                    |
| 多页累积，保留每页查询身份              | `useArticleStatesByChunks` 改为 `usePagedArticleStates`；仍由 `hooks/useArticleStates/index.ts` 导出，调用/测试同步改名，不新增同职责包装层    |
| 评论按页组合 viewerState/已确认写入结果 | `unit/Comments/pagination/usePages.ts` 移为同目录 `usePagedCommentStates.ts`，函数改为 usePagedCommentStates；OffsetFeed/CursorFeed 及测试同步 |
| 引用图组件内查询                        | `MentionsGraph/useMentionsGraph.ts`，不保留 useReferenceMap 别名                                                                               |

普通翻页只替换当前页时，Article 使用 useArticleStates；多页累积展示时使用 usePagedArticleStates。是否需要保留多页由 UI 的累积行为决定，不由 cursor/offset 协议决定；多页缓存过期时仍可重取，不能承诺“旧页永不请求”。Comments 单页输入也可复用同一个 usePagedCommentStates，无需为了名称对称新增无人使用的单条 hook。分页容器负责 pageInfo/翻页，状态组合负责 viewerState/回执；重命名不改变现有输出分页边界、排序及去重语义。

当前 Comments 已将公开内容与个人状态分开：分页 Query 返回正文、作者和公开计数，按页收集 ID 批量查 viewerState，组合后展示；store 只负责编辑器、回复对象、折叠等 UI。保留此分层，不把组合页面写回 store。评论头部 commentsState 仍混合公共 summary 与 isViewerJoined，现有查询按账户隔离；本轮记录此现状，不顺带重新设计 summary API。

本轮 B3 同时补齐 `query/comment.ts` 的 page/infinite/reconcile 从 queryFn 到 browserGraphQLRequest 的 AbortSignal，viewerStates 已支持应保留。场景验收：A 评论页请求未完成就切 B，A 无消费者后停止浏览器请求，B 正常加载；仍被另一消费者使用的同 key 请求不误取消。正文可先展示，viewerState 不阻塞正文，账户切换不复用另一账户的个人状态。

## 7. 已执行的失败基线

### 7.1 后端

原新增 B0 红基线 `mentions_graph_b0_test.exs` 已在新 Query/NodeStatus 测试落地后删除；其结果仅作为历史证据保留，不再是当前可执行测试入口。现行覆盖见 `mentions_graph_query_test.exs`、`mentions_graph_budget_test.exs` 与 `mention_version_facts_test.exs`。默认排除的历史红基线不算验收通过。

```sh
cd backend/api
mix test test/groupher_server_web/query/cms/artiment_mentions_test.exs --seed 0
mix test test/groupher_server/cms/mentions_graph_b0_test.exs --include later --seed 0
MIX_ENV=test mix run scripts/mentions_graph_b0_report.exs
```

实测：旧 GraphQL 基线 18 passed；B0 3/3 失败，均执行到业务断言：

| 用例                    | 当前证据                                                                                                     | 对应修复                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 隐藏目标仍保留边        | 期望1条，实际0条                                                                                             | B1事实/墓碑 + B2占位            |
| Comment父文章被 hold    | hold 后必须恰好1条、edge ID不变；当前仍返回正常 URL；后续还须满足 UNAVAILABLE/READY、字段清空及不可打开/展开 | B2 完整父级 Scope 与 NodeStatus |
| 121个隐藏目标，请求20条 | **109条 SQL，超过32**；fixture建数不计                                                                       | B2 SQL分页+批量状态+预算        |

数据通过 TestMate/Ecto sandbox 回滚；测试库 `groupher_server_test`，未触碰生产。临时执行日志保存在本次环境的 `/tmp/mentions-b0-baseline.log`、`/tmp/mentions-b0-red.log`、`/tmp/mentions-b0-report.log`，核心结果已记录于本文，不依赖临时文件长期存在。

### 7.2 前端

[历史 B0 红基线](../../../frontend/core/unit/MentionsGraph/index.test.tsx)：当时的 ReferenceMap 测试文件已随 B3 重命名移除，4 个 `it.fails` 结果仅作为历史记录；当前文件保留 MentionsGraph 挂载、展开和取消查询的普通断言，不再报告 expected failure。

```sh
pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/unit/MentionsGraph/index.test.tsx
```

- 首次挂载的首个请求是 Comment seeds，不是 focus page。
- page/revision/articleComments 三个取消均没有把 aborted signal 送到 transport。

B3 必须创建/更新以下测试（**尚未作为新功能执行验收**），仓库根目录执行；新增文件尚未创建，不得以 passWithNoTests 掩盖：

```sh
pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/unit/ArticleView/ArticleFooter/mentions-tab.test.tsx frontend/core/unit/ArticleView/ArticleFooter/tabs-loading.test.tsx
pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/unit/DocThread/Article/mentions-tab.test.tsx frontend/community/src/components/mentions-tab-hosts.test.tsx
pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/unit/ArticleView/ArticleFooter/Activities/index.test.tsx frontend/core/query/articleActivity.test.ts
pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/hooks/useArticleStates/index.test.tsx frontend/core/unit/Comments/pagination/usePagedCommentStates.test.tsx frontend/core/query/comment.test.ts
```

- Footer 全 tab：默认 Activity 可查询，未选中 Members/Mentions 零请求；切换只挂对应组件，卸载后停止 poll/无消费者的 fetch；缓存有效切回可复用，过期按策略重取；不能在父组件提前请求所有数据。
- Mentions：首次严格一次 focus page；seeds/revision 不混入首批；直接从评论按钮进入不先请求 Article；切 focus/返回文章取消旧请求且不合并旧响应。
- Doc：挂实际 Article + Footer，保留反馈区；Activity 有真实结果则展示、成功空结果才空态；从 Mentions 的“查看评论提及”→ seeds → 选择 Doc Comment → 返回 Doc，验证 locator 和调用次数，不依赖不存在的 Comments List。
- 宿主集成：通过实际 PostViewer/ChangelogViewer 到 Footer，覆盖 Post/Blog/Changelog；列表与 Footer callback 联通，页面与抽屉实例不串 state。路由首次/SSR 不发 Mentions；Ticket 无 Comment seeds。Post 关联 Ticket 状态在 Footer 上方独立区，切 tab 不改变该区；ticket.updates 不出现在 Post Activity，也不当作 Ticket Activity 的输入。TicketDetail 实际宿主初始无图和 Activity 请求，点击 Mentions 只请求一次 Ticket focus page，收起卸载/取消，切 Ticket/Community 重置；断言不存在 Ticket Activity tab 和内部查询，不以 stub 证明接口存在。
- Activity：接真实 articleLogs；加载、分页、错误、真实空态、权限/账户隔离、AbortSignal；前端仅展示响应，不额外查询 Ticket 状态/updates 来拼活动。后端在 `backend/api/test/groupher_server_web/query/cms/article_logs_test.exs` 新增或更新 Post 创建/关联 Ticket 有对应事件、Ticket 改状态/发布文字更新不会新增 Post Activity 的用例；从 backend/api 执行 `mix test test/groupher_server_web/query/cms/article_logs_test.exs`。用权限允许的用户发起相应命令，不能只手写前端 fixture 证明后端边界。该文件还须覆盖主合同 §8.3 的 PostLog 单次创建、不附带 link 事件、重复关联/命令回放、事务失败回滚、重新关联、mirror Community、隐藏 target 去敏、Post 准入及批量 target 查询；不从 TicketLog 合并补齐结果。
- 命名/Comments：原 Article 单组/多页与 Comments 页边界测试随改名保留；追加新页不改变旧页 key，普通换页不累积历史页；公开内容与 viewerState 分离、写入回执合并不回退；page/infinite/reconcile 取消到达 transport，共享消费者仍可继续请求。

## 8. B1 必须新增的具体边界用例

这些用例依赖尚不存在的 endpoint/set/initializer，B0 冻结 fixture 与断言，不用 skip/no-op 测试伪装执行：

- **Auxiliary parent**：建公开A、没有public selection的父B及其Comment C，A canonical正文引用C；S不含B，初始化先建B endpoint再建C parent FK；无B set/水位；重跑身份不变，B发布后C恢复可读，mentioned_at不变。
- **Mirror**：同Article UUID有两个Community binding；稳定ID初始化只一个endpoint；URL分别按指定Community定位同一身份；同Community locator冲突才错误。
- **时间一致性**：人为输入同一edge两个不同mentioned_at；保存set前拒绝，数据库无set/occurrence；另用受控损坏fixture证明投影前防御校验失败。
- **初始化隐藏目标**：分别review hold、soft delete、parent hidden，初始化仍保边；恢复不换node/edge，零通知/Activity/发布版本变化。
- **全局 revision**：单行递增与图变更同事务；读前/读后变化使整页失效；manifest 使用 database identity/token/hash/checkpoint 校验，不含 epoch。
- **FK**：直接Repo写错source_set/source endpoint、target type由数据库拒绝。
- **Seed cleanup 撤回**：走 production_seed cleanup 的 Ticket 分支；Ticket aggregate/历史仍在，公开出边撤下，其他公开来源指向它的边保留为 UNAVAILABLE，endpoint 不写 deleted_at；重复 cleanup 幂等，重新发布后节点身份不变。B4 验收旧 cleanup CLI/调度及在途事务为零后才删表。

## 9. 出口与剩余执行责任

B0 交付为：合同三条边界已冻结、上述文件级清单与SQL计划、初始化/全局 revision/停机设计、只读报告脚本、3项后端红基线与4项前端expected-failure基线。B0 不意味着这些缺陷已修复。2026-11-04 的合同修订曾要求 B1 收口旧 per-Community `GraphRevision` / projection epoch 实现；该代码收口见 §9.6，B0 通过本身不代表后端实现完成。

B1负责新结构和初始化命令实现；B2负责≤32 SQL与状态正确性；B3负责全部 tab 按需挂载、真实 Activity 接入、独立 Ticket 状态区、hook 命名/取消/生成物；B4才生成真实目标环境manifest、停止旧writer并切换。生产数据规模、环境credential、暂停窗口与真实运行进程清单必须在目标环境取得，本文的空测试库报告不能代替它们。

前次盘点阶段辅助检查记录（不代表后续每次检查结果，最新实跑见 §9.3）：`pnpm --filter @groupher/frontend-core run type-check`、`pnpm docs:check`、新增 Elixir 测试/脚本的 `mix format --check-formatted`、`git diff --check`。这些检查与第 7 节的目标行为失败结果分别记录；没有执行 B1 初始化命令或新结构迁移。

### 9.1 前次六项收口与实跑记录（2026-11-04）

此处保存前次证据；后续发现的宿主与活动边界按 §6 修订；§9.2 保留当时未通过的检查，当前状态仅以 §9.3 为准。

| 项目               | 出口证据                                                                                             | 结论                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Parser 分支        | §2 写入落点 + §2.1 当前/正常发布/初始化矩阵，含全部指定输入及失败分支、B1 测试归属                   | 盘点通过；新解析尚未实现                               |
| Seed cleanup purge | §2、§3、§8：撤回非硬删、B1 适配、B4 停旧 CLI/release/在途事务；主合同 §9.3 同步                      | 边界明确；未执行 cleanup                               |
| 一跳 SQL 预算      | §5.3 独立 L01–20，source/target 状态、pending、count、fence 均列明；硬上限 32                        | 设计通过；性能留 B2 实测                               |
| 红基线与前端宿主   | Comment 红断言保留；Viewer 实际挂载、Doc seeds、父 state/callback、全部 tab 生命周期按最新 §6.1 修正 | 红基线有效；当时设计待复核，最新结论见 §9.3；UI 未实现 |
| SQL/fragment 清单  | §5.1 同时覆盖图/列表/维护/写入查询，补 Rebuild、Batch 和 Store                                       | 盘点通过；没有改业务 SQL                               |
| 错误名重命名       | §6.2 列五项函数、保留编号、定义/调用/测试范围，主合同 §8.1 对齐                                      | 计划通过；旧运行时仍用旧名                             |

本轮实跑结果：

- `mix test test/groupher_server_web/query/cms/artiment_mentions_test.exs --seed 0`：**18 passed**。
- `mix test test/groupher_server/cms/mentions_map_b0_test.exs --include later --seed 0`：**3 个预期业务失败，退出码 2**。隐藏边 0≠1；Comment 的长度/同边/类型检查先通过，再失败于正常 URL 未清空（新 target DTO 断言尚未执行到）；高隐藏率 **109 SQL >32**。不存在编译或 fixture 错误。
- §7.2 当前 `b0-contract.test.tsx` 命令：**4 expected fail**，runner 退出码 0；不记为新产品行为通过。
- Core type-check、文档检查、B0 Elixir 测试/报告脚本格式检查、tracked/untracked 修改的 whitespace 检查通过。

本轮日志为 `/tmp/mentions-b0-close-baseline.log`、`/tmp/mentions-b0-close-red.log`、`/tmp/mentions-b0-close-fe.log`、`/tmp/mentions-b0-close-typecheck.log`、`/tmp/mentions-b0-close-docs.log`；上文固化了必要结果，不依赖临时日志长期存在。只读报告脚本及空测试库结果沿用 §4.2 的既有证据，本轮未重跑，也不扩充为生产证据。

**此轮历史结论：盘点与红基线证据保留，前端设计曾待复核。** 最新范围及验证结论由 §9.3 接管。实际占位展示、32 SQL、tab、Activity、初始化及生产切换仍受对应批次门禁约束。

### 9.2 前次讨论后的文档修订与检查失败记录

- 已写入：所有 Footer tab 按挂载加载；Activity 本轮 B3 接真实接口；Post 关联 Ticket 状态区独立在 Footer 上方；Post Activity 仅含创建/关联 Ticket 的事件，前端不合并 Ticket 状态/文字更新。
- 已修正：Footer 实际位于两个 Viewer；普通文章 state/callback 贯通兄弟子树，不新增 Context；Doc Comment 从 Mentions seed 列表选择，不假设有 Comments List。
- 已冻结命名：useMentionsMap、usePagedArticleStates、usePagedCommentStates；普通换页与累积多页行为分别说明；Comments 保留现有 Query/store 分层并补取消。
- 当时待复核：Ticket 公开 Activity 读取合同，现有 articleLogs handler 不支持 Ticket；本轮范围已在 §6.1 / §9.3 收口，不再作为隐含交付项。
- 本次只改文档并执行文档/差异检查；没有重跑或新增业务红基线，没有把 §7 的未来测试计为通过，B1–B4 未开始。

本次文档验证：三个改动 Markdown 的本地链接及 whitespace 检查通过。`pnpm docs:check` 的检查器单测 11 项通过，但总命令退出 1：`backend/api/lib/groupher_server/cms/search_artiments/disabled.ex` 的模块文档缺 ASCII business-position flow；这是本轮未修改的文件。后续串行门禁未继续执行，不能记作通过。日志：`/tmp/mentions-docs-tabs-update.log`。本次没有重跑 §9.1 的业务测试。

### 9.3 本轮范围收口与验证（2026-11-04）

本轮修改仅为合同、两级文档索引和 SearchArtiments.Disabled 的模块流程说明；没有改业务实现，没有进入 B1。

| 收口项                     | 冻结结果                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket Activity 与 B0 范围 | Ticket 自身公开 Activity 不属于本轮；TicketDetail 保留独立 updates，Mentions 默认收起，点击才挂载共享图。撤销原 Ticket Footer 默认 Activity 承诺；Post/Blog/Changelog/Doc 仍接真实 Activity |
| Post Ticket 事件来源       | 主合同 §8.3 固定 PostLog.ticket_created / ticket_linked、持久化事务、幂等、action 约束、安全公开 target 投影及命令到查询的测试；不合并 TicketLog                                            |
| 文档检查历史               | §9.2 的退出 1 保留；本轮修改前重跑再次复现 disabled.ex 缺 ASCII flow，其余串行门禁当时未执行；修复后重新跑完整命令，以以下记录为准                                                          |
| 索引                       | Article 与全局 Feature README 同步 MentionsMap/B0、本轮范围及 B1–B4 未实施；B4 前旧合同仍为运行时权威                                                                                       |

本次实际验证：

- 修改前 `pnpm docs:check`：退出 1，11 项检查器单测通过，唯一失败为 disabled.ex 缺 ASCII 流程；日志 `/tmp/mentions-b0-docs-baseline.log`。
- 补齐模块流程说明后 `pnpm docs:check`：**退出 0**，文档检查器及所有后续串行边界门禁均通过；日志 `/tmp/mentions-b0-final-docs.log`。这条最新结果取代 §9.2 的当前失败状态，保留原失败记录。
- 从 `backend/api` 执行 `mix format --check-formatted lib/groupher_server/cms/search_artiments/disabled.ex`：退出 0。源码 diff 仅增加模块流程说明，无可执行逻辑变化。
- 四份修改 Markdown 的本地链接检查、tracked 修改的 `git diff --check` 及两份未跟踪合同的独立 whitespace 检查通过。
- §7/§9.1 的后端 18 passed、3 个业务红基线和前端 4 expected fail 为既有证据，本轮未重跑；本轮未跑前端 type-check，也未把未来测试或 expected failure 记为新功能通过。

**当前结论：B0 验收通过，范围为盘点、失败基线和本轮已明确的设计出口。** Ticket 自身公开 Activity 明确排除，Post 创建/关联 Ticket 的活动仍是 B3 必做项。实际占位展示、32 SQL 上限、UI/Activity、初始化和生产切换尚未实现/验收；B1–B4 未开始，生产切换仍 blocked。本次没有提交或推送。

### 9.4 B1 开工记录：版本事实地基（2026-11-04）

新增 `20261104130000_create_mention_version_facts.exs`，只建立空的 `mention_endpoints`、`mention_sets`、`mention_occurrences`；`20261104131000_create_mention_sync_states.exs` 建立唯一 desired/synced set 水位及复合外键；`20261104132000_create_mention_current_edges.exs` 建立隔离的新当前边投影表及唯一键/复合外键。对应 Ecto schema 为 `Endpoint`、`MentionSet`、`Occurrence`、`ProjectionState`、`CurrentEdge`。没有迁移旧 mention 行，也没有替换当前旧图索引、水位或运行时入口。endpoint 不建指向 Article/Comment/DocBranch 的活体 FK；set 版本唯一，occurrence/current edge target type 与 endpoint、set 与 source endpoint 均由数据库复合 FK 约束。

本段原为 2026-11-04 B1 首次落地时的历史快照：当时记录了 per-Community `GraphRevision`、`ProjectionEpoch` 和 11 项测试。当前实现状态以 §9.6 为准；该历史描述保留用于解释迁移过程，不表示 epoch 仍是运行时合同。

Store 已增加 `ensure_endpoint_in_transaction/1`：按全局 Article/Comment 身份幂等创建，Comment 必须引用 branch 匹配的父 endpoint；重用时身份冲突会报错。`save_parsed_version/6` 将现有 Parser 输出转为 occurrence 并先创建/复用 Comment 的 auxiliary parent；指定同源 `previous_set_id` 后，按 target 身份继承原 `mentioned_at`，不随位置变化重置时间。`save_version_facts/4` 按 source endpoint 锁定，同一 endpoint/token/parser version 重试只接受完全相同的 occurrences；不同事实返回冲突；同一 edge 的 `mentioned_at` 统一到 UTC 秒精度后在 set 落库前校验，不一致整笔拒绝。`MentionSet.changeset/2` 和 `Occurrence.changeset/2` 拒绝更新持久化后的版本事实。测试覆盖解析结果到 Comment/父 Article endpoints、父级/branch 冲突、mirror Article endpoint 幂等、移动位置后的时间继承、set/occurrence 不可改写、时刻冲突零落库、精确重试幂等和禁止覆盖；定向测试 **8 passed**。

这仍不是 B1 出口。下一步是将 set 保存与 projector effect 接入发布和 Comment Commands，并补齐隐藏/删除目标从旧 set 继承 endpoint；Comment 来源 parent 状态变化递增全局 revision 也尚未覆盖真实命令用例。之后还要完成初始化 report/apply、受控认证和旧入口停机适配。在这些完成前不运行新公开读取或 B4 切换。B0 的历史结论保留，当前阶段以本节为准。

### 9.5 B1 命令接入进度（2026-11-04）

新增 Commands.CaptureCurrentVersion，要求调用方已处于业务事务；在同一事务内完成解析、不可变 set 保存、desired set 水位推进及不带 epoch 的 mention.set_project Outbox intent。Article、Doc、User Ticket 发布/公开事务，以及 Comment create/update/delete 路径已接入。删除 Comment 使用命令写入的当前 tombstone body 生成空/当前 set，使投影移除其出边；Article/Ticket 删除与恢复以及 production seed Ticket cleanup 尚未适配新端点模型。

初始化专用 `binding_mode: :initialize_current` 只允许领域初始化命令调用：它按 Ecto 有界页扫描 Article/Doc/Comment 当前正文，生成不含正文的 manifest entry；apply 重读对应页、比较来源 fingerprint，并在每个来源事务中保存 set、desired/synced 水位与 current edge。该路径同步投影，不创建 `mention.set_project` Outbox，不调用发布、通知或 Activity。CLI `mix cms.mentions.initialize --report|--preflight|--apply --manifest <path>` 已接入，token 只能从 `CMS_MENTIONS_INITIALIZE_TOKEN` 环境变量读取；Auth 的 resource 示例与最小权限 client 合同已补。Article permanent delete 与 Doc branch permanent delete 已墓碑化相应 endpoint 和 Comment 子 endpoint；production seed Ticket cleanup 已调用新模型撤回路径。

Parser 现在暴露候选提取入口，并读取 Plate `a/link` 节点的 `url/href`、文本 URL 与 HTML anchor；Store 可在当前解析无法解析目标时，按稳定结构化 ID 或完整规范化链接，从同源上一 set 继承 target endpoint；唯一匹配时保留 endpoint 与 mentioned_at，歧义会失败。测试覆盖链接位置移动与目标不再能由当前解析解析的 Store 路径。正常发布时，未命中当前解析且没有可信上一 set 的候选仍不会形成内部边。

当前验证：

- `MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs test/groupher_server/cms/articles/trash_test.exs --seed 0`：**38 passed**。覆盖服务 capability 正反例、来源分页、manifest fingerprint、隐藏目标初始化保边、apply 幂等、零新增投影 Outbox、Article 永久删除等边界。
- 单独运行 `mention_version_facts_test.exs`：**25 passed**；覆盖候选解析入口、初始化 Mix task 鉴权、manifest 校验、checkpoint 中断续跑；恢复时跳过已完成页，未触发网络或凭证写入。
- Article/Doc/Comment/Ticket 相关命令与版本事实分组最新为 **227 passed**；加入 Comment 新建/删除命令断言后的另一组为 **116 passed**。这些分组有重叠。
- Auth 当前仅更新本地资源配置模板与 client 合同，未向任何部署环境注册 client，也未验证生产 token 签发。

未完成的 B1：全量来源 report/apply/preflight 的 E2E 覆盖（尤其 Doc main、User Ticket、Doc Comment、辅助 parent、mirror 与坏正文）；完整 Parser 分支及歧义矩阵（当前新增的是 Plate link URL 提取与代表性候选断言，不等于矩阵验收）；普通 Article 与 Comment 多 Community binding 下 Doc 稳定 ID 的歧义策略验证；真实 Command 场景下隐藏/软删除目标继承恢复；Comment parent 状态变化递增全局 revision；乱序/重复投影、parser 升级、通知幂等、删除恢复/rebuild 边界；真实 Auth 部署注册与 token 签发/验证；最终 B1 全量门禁。旧同步事件、Rebuild/health/seed CLI writer 的完整停机和删除属于 B4 操作，尚未执行。

B1 出口尚未通过；B2–B4 未开始。初始化只从保留的当前正文生成新事实，不迁移旧关系数据或保留旧逻辑兼容。

### 9.6 全局 revision 与 epoch 移除（2026-11-04）

新增 `20261104134000_create_mentions_map_revisions.exs`：创建 `cms.mentions_map_revisions`，以 check constraint 固定唯一合法 ID 为 `1`，并预置 `{id: 1, revision: 0}`。`Model.MentionsMapRevision` 映射到新表；`MentionsMap.Revision.current/0` 读取全局值，`bump/0` 用 Ecto `update_all inc` 原子递增，要求调用方处于事务内；Article、Doc、Comment、Community lifecycle/review、binding 和 Ticket 可见性 writer 都已改用这一入口。旧迁移不改写，旧 `cms.reference_map_revisions` 表不再由运行时代码访问，待 B4 停旧 writer 后删除。

已删除 `ProjectionEpoch` 模块、runtime/dev/test 配置、启动校验、CMS facade、Outbox effect/worker 的 epoch 字段与验证、初始化 CLI/report 的 epoch 字段和 epoch 错误。初始化 manifest/page schema 从 `1` 升为 `2`，明确拒绝旧格式；projection worker 也明确拒绝带旧 epoch 字段的事件，不做旧 payload 兼容。parser version 与 source token 公式保持不变。投影 worker 仍以 Outbox lease、source/set 身份和 desired watermark 防止过期 set 覆盖。

`project_set/2` 在 desired set 已同步时返回 no-op，不更新边、不 bump revision；第一次完成投影（包括零边 set）才与 edge 和 synced watermark 在同一事务递增 revision。测试断言固定单行、首次非空投影递增、重复投影不递增、零边投影递增，以及初始化 schema v1 被拒绝。

本次只完成 revision 的存储、写入和旧 epoch 移除；`Batch.page` 还没有在同一页查询前后读取并比较全局 revision。该一致性 fence 属于 B2，实施时需移除当前图读取事务中的 `REPEATABLE READ` 快照，否则前后读取可能看不到并发提交；不得把本节通过记为 B2 通过。

验证结果：新 migration 已在本地 `MIX_ENV=test` 数据库执行；`mention_version_facts_test.exs` + `articles/bindings_test.exs` 为 **37 passed**。Community lifecycle/meta + Review decision 为 **37 passed**。扩展运行 `artiment_mentions_test.exs` 与上述路径共 **63 passed / 5 failed**；失败来自该旧测试文件对 legacy `SyncState`、旧 Parser `mention_case` 和查询数的断言。本轮未把该扩展组整体标为通过。`mix format` 已覆盖本次修改的 Elixir 文件。B1 其他未完成项与 B2–B4 状态不变。

本节记录的是 2026-11-04 的实现快照；当前全局版本表和 API 名称已按 §6.2 更新。

### 9.7 Parser 完整公开 Scope（2026-11-05）

正常解析的 Article/Doc candidate 现在复用 `CMS.Gate.scope/4` 的匿名 public Article/Doc Scope；显式平台 URL 先按 URL 的 Community + inner ID 定位，再经同一 Scope 验证 Community Lifecycle、Article/Doc Lifecycle、ReviewBlock、公开 selection 和 Doc main branch。Comment candidate 先通过匿名 Comment Scope，再验证父 Article/Doc 的同一 Community public Scope；因此父级被审核限制或隐藏时不会新建内部引用。初始化模式仍独立读取 canonical 身份，不因目标当前不可读丢失正文所表达的边；同源可信上一 set 的继承仍由 Capture/Store 完成。

新增 command capture 回归：Article ReviewBlock 后新引用不绑定；Comment 创建于 Article ReviewBlock 前，父级被限制后 Comment 引用也不绑定；测试文件当前 **31 passed**。`mix compile --warnings-as-errors` 通过。`artiment_mentions_test.exs` 当前为 **20 passed / 11 failed**：其中旧 `SyncState` 和 `sync/1` 返回值检查依赖即将被 B4 删除的运行时协议；解析结果数量/`mention_case` 断言也仍需逐项迁移到新 set/occurrence 合同，不能据此宣称 Parser 全矩阵通过。

该段记录了当时的 locator 方案，已由 §9.26 的通用 `key` 合同替代。目标 Community 和 Doc branch 不再由编辑器节点提供；跨 Community 的稳定 ID 在后端按完整匿名公开 Scope 校验。

### 9.8 分页预算与全局 revision fence（2026-11-05）

旧图 Batch 的 Article/Comment seeds 现在在请求开始和返回成功前各读一次唯一全局 `revision`；变化时明确返回 `reference map changed during query`。读取事务改用 PostgreSQL 默认 `READ COMMITTED`，移除了旧 `REPEATABLE READ READ ONLY` 设置，以便末尾 fence 看见并发已提交的 revision。Telemetry 用例在第一条 revision 读取后注入一次 bump，确认请求不会返回混合版本页。

`PageFacts.raw_window/1` 与 `ReadModel.endpoints/2` 已改为 Ecto 查询；`reference_map/` 目录不再调用 `Repo.query!/2`。每个请求至多扫描一个 40 条候选窗口；窗口耗尽后仍有未处理候选时返回 `reference map scan budget exceeded`，不返回截断页面或伪造末页。无 Comment locator/候选时跳过空 Comment 与 CommentBody 查询。高隐藏密度回归的准确行为为“显式预算错误”，Ecto telemetry 统计 **30 条 SQL（上限 32）**；它不声称在预算内成功生成该高隐藏率页面。

验证：`mention_version_facts_test.exs` 当前 **32 passed**，包含正常 Capture 对 ReviewBlock Article 及其 Comment 父级的完整 public Scope、revision bump/no-op 和并发 revision fence；`mentions_map_b0_test.exs:78 --include later` **1 passed**，确认高隐藏密度预算错误及 SQL≤32；`mix compile --warnings-as-errors` 通过。全量新 GraphQL/API、页内 cursor、SQL 预算分项、B2 的真实结果覆盖和执行计划仍未验收，因此本节不表示 B2 完成。

### 9.9 Comment capture 的请求 Community（2026-11-05）

Comment 创建/编辑的 set 捕获现在接收原 Command 已验证的 `community_id`；删除路径也将当前请求 Community 传入 tombstone 捕获。普通 Comment 缺少该上下文时 fail-closed 返回 `scope_context_missing`，不再尝试 origin 推断；Doc Comment 从 branch 读取所属 Community，并校验传入上下文一致。这样 Parser 的匿名 public Scope 与 Comment 写入命令使用同一请求范围。

当时验证：`mix compile --warnings-as-errors` 通过；`mentions_map_b0_test.exs`、`mention_version_facts_test.exs` 与 Article Trash 测试组合 **49 passed / 3 excluded**；Article binding 命令测试 **8 passed**。当时旧 `artiment_mentions_test.exs` 为 **20 passed / 11 failed**；其运行时 API 及断言仍待迁移，当前结果见 §9.11。

### 9.10 全局 revision owner 命名收口（2026-11-05）

运行时 revision API 已从 `CMS.ArtimentMentions.GraphRevision` 改为 `CMS.ArtimentMentions.MentionsMap.Revision`，schema 改为 `Model.MentionsMapRevision`；调用者和测试同步改名，不保留旧 alias。旧 `reference_map_revisions` 仅在历史 migration 中存在，等待 B4 停旧 writer 后删除。

验证：`mix compile --warnings-as-errors` 通过；revision 写入者、初始化/事实、binding、trash、Review 与 Community lifecycle 测试合计 **94 passed**。这只证明全局 revision owner 及调用点，不代表 B1/B2/B3/B4 出口通过。

### 9.11 初始化隐藏 URL 与旧结构化 locator（2026-11-05 历史记录）

本节下述测试数字为当时快照。结构化 locator 方案已由 §9.26 替代；当前编辑器依赖 `@groupher/rich-editor@0.0.35`，其通用 mention option 为 `key/text`。仓库内仍没有面向 Article/Comment 的 option producer，因此真实选中目标到正文 `key` 的前端链路尚未完成。

初始化现覆盖 `inline_mention` 与平台 Article/Doc/Comment URL 候选：按 URL 的 Community、thread、inner ID/fragment 验证当前 canonical identity，不受目标当前公开投影隐藏影响；正常发布仍按 public Scope 不新建该边。新增“目标 Article 当前不可读时，隐藏 URL 在初始化中仍建立同一目标身份”的测试。

验证：`mix compile --warnings-as-errors` 通过；Mentions facts、B0 预算、Article Trash/Binding/Revision、Comment Command、Ticket、DocTree 共 **170 passed / 3 excluded**；`pnpm run docs:check` 与 `git diff --check` 通过。旧 `artiment_mentions_test.exs` 当前 **17 passed / 14 failed**：失败混有旧 `SyncState`/`sync/1` 协议断言、旧查询结果断言，以及脱离 Command 直接调用 `BindingPersist` 的测试；逐项迁移到新合同前不将其计为通过。初始化每 source 的候选解析仍有逐目标 SQL，需在 B4 初始化规模验收前批量化并测 query budget。

### 9.12 旧结构化 locator 校验与 URL 索引边界（2026-11-05 历史记录）

以下 locator 实现与测试数字仅记录当时状态；结构化 mention 的当前合同见 §9.26。URL 长度限制仍有效。

正常 Capture Command 在保存 set 前批量验证显式 target Community、资源 thread/type、Article binding、Doc main branch/版本、Comment 父资源及 User Ticket 类型；locator 缺失时仍不从来源 Community 猜测。错误通过 `CMS.ErrorCat.invalid_mention_target_locator` 返回。结构化 User Ticket target 已走 Ticket Gate public Scope，不再因稳定 UUID 分支返回空结果。外部 URL 的规范化值限制为 1200 UTF-8 bytes；Capture/初始化入口提前拒绝超限 URL，Occurrence 与 CurrentEdge 的 CHECK 提供数据库防线，避免 URL 唯一索引项超出 PostgreSQL 限制。

验证：`mention_version_facts_test.exs` **36 passed**，覆盖结构化 User Ticket 解析、Doc branch locator 的 Command 级拒绝和超限 URL 拒绝；`mix compile --warnings-as-errors` 通过。完整 Article/Comment/Ticket 命令矩阵、编辑器 locator 产出、Parser 全分支矩阵和初始化逐目标 SQL 批量化仍未完成，故 B1 仍未验收。

### 9.13 删除墓碑与初始化来源锁定（2026-11-05）

父 Article/Doc 永久删除会撤下其 Comment endpoint 的当前出边，但不再给 Comment 写自己的 `deleted_at`；只有 Comment 自身的删除操作能产生 Comment 墓碑。初始化 apply 对每个 source 在同一事务锁定 ArticlePublic、DocPublic 或 CommentBody，并校验 manifest 对应的 canonical token，再保存 set，避免应用扫描后的旧正文或未经 manifest 核对的新版本。

验证：Mention facts 与 Article Trash 定向测试 **53 passed**；覆盖父级删除保留 Comment 自身删除状态、初始化 canonical token 一致/不一致以及初始化幂等。`mix compile --warnings-as-errors` 通过。B1 仍未验收：Parser 完整分支矩阵、编辑器 locator 端到端、初始化逐目标解析 SQL 批量化及旧 Mention 测试迁移仍未完成。

### 9.14 Comment 初始化命令级覆盖（2026-11-05）

扩展初始化来源扫描测试：在同一命令级流程中创建普通 Article Comment 与 Doc Comment，验证两者都进入 Comment manifest；对整页执行 report/apply 后，分别断言 Comment endpoint 已建立且 desired/synced set 水位追平。它补上 Comment 来源的初始化命令路径证据，不代表 Doc main、User Ticket、mirror、多页大数据量或坏正文的全来源初始化矩阵已通过。

验证：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs --seed 0`：**36 passed**。`artiment_mentions_test.exs` 仍是 **17 passed / 14 failed**，失败原因及新旧合同边界见 §9.12；该文件的测试迁移仍是 B1 未完成项。B1–B4 当前状态不变。

### 9.15 初始化稳定身份批量查询（2026-11-05）

`Parser.parse_for_initialization/2` 现在先对正文内稳定 Article UUID 候选批量读取 Article、User Ticket 类型和 Doc main branch 元数据，再在内存中逐 occurrence 解析；重复目标不再重复访问数据库。此批量化目前只覆盖稳定 Article UUID。带 Community 的 Article URL、Comment ID/fragment、Ticket URL 和多来源页的候选仍需批量化及代表性数据预算验证。

验证：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs --seed 0`：**37 passed**。新增 25 个同目标稳定 Article UUID occurrence 的 telemetry 断言，数据库查询数不超过 12。该阈值仅证明重复稳定身份不形成 N+1，不代表初始化总 SQL 预算或完整 parser 矩阵通过；B1–B4 状态不变。

### 9.16 隐藏 Comment fragment 初始化修复（2026-11-05）

修正初始化解析普通 Article 的 Comment fragment 时将 `branch_id: nil` 传给 Ecto 等值过滤的问题；普通 Article 显式用 `is_nil(comment.branch_id)`，Doc Comment 按真实 main branch 定位。解析结果补齐 parent endpoint 所需的 thread/article/branch 身份。新增端到端用例覆盖父 Article 当前不可读时，report 保留 Comment target、apply 建立 Comment 与 auxiliary parent endpoint，且不改写父 endpoint 原水位。

验证：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs --seed 0`：**38 passed**。该用例只闭合一种 Comment fragment 路径；B1 完整 parser/来源矩阵、初始化 URL/Comment 候选批量查询和其他未完成项仍开放，B1–B4 状态不变。

### 9.17 合并 frontier 扫描窗与初始化候选批量化（2026-11-05）

旧 ReferenceMap 的 Ecto 候选扫描现在先合并并按 frontier 去重，再按 `request_index` 和 `edge_key` 排序取 40 条候选及 1 条 lookahead。四个 Article/Comment 出入边分支各自最多取 41 条只是保证合并后 Top 41 完整；状态解析最多处理每 frontier 40 个候选。若 lookahead 证明还有候选而当前窗口仍不足以生成完整页，则返回明确预算错误，不把窗口截断伪装成末页。

初始化解析不再先用旧的单 Ticket URL 查询解析 `ticket` link candidates；这些稳定 URL 与其他 Article/Comment locator 一起经批量身份加载，再按 occurrence 合并。新增 25 个不同 Ticket locator 的 telemetry 用例，避免只用重复同一 locator 掩盖逐目标查询。

验证：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs --seed 0`：**42 passed**；高隐藏密度 B0 预算用例单独运行 **1 passed**，统计 30 条 SQL（≤32）。完整 `mentions_map_b0_test.exs --include later` 仍有 2 个既有预期红基线失败（隐藏目标边保留、Comment target DTO 隐藏 URL）；不能将它们计为新行为通过。旧 ReferenceMap 扫描窗和 Ticket URL 查询边界已收口；新 MentionsMap GraphQL/API、B1 全矩阵、B3、B4 仍未完成。

### 9.18 MentionsMap 读取、预算与 Activity 接入（2026-11-05）

新增 `MentionsMap.Query`、`NodeStatus`、`Graph` 的 GraphQL 读取路径，提供 `mentionsMap` 一页邻接和 `mentionsMapArticleComments` Comment seeds；读取限定公开 Article/Doc/Ticket/Comment Scope，Doc 绑定 main branch。页首、页尾 revision、Community、locator、邻接、endpoint/status、pending、seed rows 均显式使用 Ecto 查询；图读取没有 `Repo.preload` 或原生 SQL。focus 同时作为首批 frontier 时只允许这一个重复身份，其他重复 frontier 拒绝。

`MentionsMap.Budget` 在每个 SQL 发出前预留整个领域请求的 32 次额度，按剩余时间把单条 Repo timeout 限到 2 秒及请求总时限 5 秒；超额/超时返回明确 ErrorCat，不产生成功空页。查询页测试现通过 Ecto telemetry 统计完整领域调用。预算错误单元测试证明第 33 次回调未执行及 deadline 到期时不执行 SQL。

Post Ticket 创建与新关联现在在原 Ticket Command 事务内新增 `PostLog.ticket_created` / `ticket_linked`；PostLog CHECK、schema、GraphQL 与 generated DTO 同步。ArticleLog 按请求 Community 过滤日志，并通过 Ticket public Gate 一次批量读取当前公开标题、inner ID 和 URL；不可公开时返回事件但将 target 置空，不对外投影写入快照。前端 Activity 使用 `useArticleActivity` 与 `query/articleActivity.ts`，Ticket 不可用态不展示内部标识。

验证：`mix compile --warnings-as-errors` 通过；Query、预算、Activity、Ticket Command 定向组合 **59 passed**，包含单 frontier 完整 Query telemetry ≤32、Post Ticket 公开 target 和 Ticket 不公开时 target 为空；测试数据库对新增 migration 执行 rollback/reapply 后，Activity action CHECK parity 通过。Core MentionsMap 测试 **3 passed**，Core TypeScript type-check 通过。该 SQL telemetry 还没有覆盖 10 个最坏 frontier；预算超时目前验证了发出前 deadline 检查，尚未注入真实 PostgreSQL statement timeout。

B2 尚未验收：缺 10-frontier 最坏组合/隐藏率下总 SQL 断言、cursor 顺序与过期 revision 并发测试、真实 timeout 结果映射和隔离 PostgreSQL `EXPLAIN` 数据规模证据；一跳 `mentions` / `mentionedBy` DTO 替换及旧 API 的 B4 cutover 仍未实施。B3 尚未验收：当前 MentionsMap component 测试不覆盖真实 Post/Blog/Changelog/Doc host 与 Comments callback；缺未选中 tab 零请求、多个消费者取消、评论 focus 恢复、Activity 分页/错误/权限隔离及 Post Ticket Activity 全命令回放测试。B1 剩余项见 §9.17 以前各节；B4 仍须停旧 writers、排空队列并在目标环境初始化与验收，不得视为已执行。

### 9.19 本轮回归修复与复验（2026-11-05）

- 修正 `MentionsMap.NodeStatus` Comment locator 查询的 Ecto named binding：Comment scope 实际提供 `gate_comment_binding`，查询不再引用不存在的 `gate_article_binding`。`mentions_map_query_test.exs` 中 Comment target 位于隐藏父 Article 下的用例此前因 `Ecto.QueryError` 失败，现在验证边保留、Comment 状态不可用且 URL 为空。
- `ArticleQueryProvider` 的 Footer tab/focus 现在按 `community + thread + innerId` 身份派生；同一路由切到另一篇 Article/Community 时，旧 Comment focus 和旧 tab 不会在新身份的首轮 render 继续发请求。新增 Provider props 更新回归测试。
- 复验：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs test/groupher_server/cms/mentions_map_query_test.exs test/groupher_server/cms/mentions_map_budget_test.exs --seed 0` 为 **51 passed**；Provider 与 MentionsMap 前端测试为 **4 passed**；Core TypeScript type-check 与 `git diff --check` 通过。
- 这些修复关闭两个具体回归，不改变批次出口：B1、B2、B3 仍未验收，B4 未开始；上节列出的预算、cursor、Activity 和真实路由集成证据仍缺。

### 9.20 数据库语句超时与图组装复杂度（2026-11-05）

`Repo` 的 `timeout` 参数在 SQL Sandbox 中不会中断正在执行的 PostgreSQL 语句；原 `pg_sleep(2.5)` 用例证实传入 2 秒后仍返回成功。现在每个 MentionsMap 读取事务开始时，通过 Ecto 查询调用 PostgreSQL `set_config('statement_timeout', ..., true)` 设置事务局部 2 秒限制；这一条设置查询也经过共享 `Budget.run!/2` 预留额度。PostgreSQL `query_canceled` 与 DBConnection timeout 均映射为明确的 Mentions query timeout 错误。真实 `pg_sleep(2.5)` 测试验证事务回滚与错误映射。

前端边列表组装已将节点数组预建为 ID Map，再按常量时间查找端点，避免每条边重复线性搜索节点。

验证：该时点 `MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs test/groupher_server/cms/mentions_map_query_test.exs test/groupher_server/cms/mentions_map_budget_test.exs --seed 0`：**54 passed**。Query 测试包括 10 个 frontier、隐藏 target 及完整调用 SQL ≤32；包含事务局部语句超时设置的预算计数。MentionsMap 与 Provider 前端定向测试 **4 passed**；`pnpm --filter @groupher/frontend-core run type-check` 退出 0；本轮修改及新增的 Elixir 文件 `mix format --check-formatted` 退出 0。后续 §9.21 增补 stale cursor 测试后的结果为准。

这只关闭 B2 的最坏 frontier SQL 与实际单条数据库语句超时证据，并优化图列表组装；查询期间并发 revision 变化的页失效测试、隔离 PostgreSQL `EXPLAIN`/代表性规模证据仍未完成。B1、B2、B3 出口仍未通过；B4 未开始。

### 9.21 Cursor revision 失效用例（2026-11-05）

新增 Query 命令级测试：先取得有下一页的 cursor，在事务内递增全局 Mentions revision，再使用旧 cursor 请求续页；服务必须返回 `mentions_map_invalid_cursor`，不返回新 revision 下的混合页。另用 Ecto telemetry 在请求的首个 revision 读取完成后、查询进行中递增 revision，证明末尾 fence 返回 `mentions_map_invalid_request` 而不是返回混合页。新增 3,000 条当前边的 Ecto fixture：实际 GraphQL-domain page 只返回首批 20 条并有续页；`Repo.explain(:all, ..., analyze: true, buffers: true)` 对 source + edge_key + limit 21 查询断言使用 `mention_current_edge_source_window_index` 与 Limit。

验证：`MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs test/groupher_server/cms/mentions_map_query_test.exs test/groupher_server/cms/mentions_map_budget_test.exs --seed 0`：**57 passed**。包括 3,000 条数据的 `EXPLAIN ANALYZE` 索引与 LIMIT 断言、10 frontier ≤32 SQL、超时、stale cursor 及同页并发 revision 变化。该计划覆盖合成但真实 PostgreSQL 表数据，不代表生产分布；仍需记录实际 PostgreSQL 版本、代表性数据分布的候选/扫描行数与延迟分位。B2 的一跳 `mentions` / `mentionedBy` DTO 与旧读取逻辑仍未切换，故 B2 未验收；B1、B3 未验收，B4 未开始。

### 9.22 Mentions revision 刷新与 Comment 取消链路（2026-11-05）

Mentions tab 挂载时轮询 `mentionsGraphRevision`（30 秒，页面不可见时暂停）；同一 Community/focus 的 revision 变化后失效当前图与 Comment seed 查询。revision 查询和图组件同生命周期，离开 tab 后停止轮询；首屏仍只发一条 focus page，revision 是独立的刷新查询。Comment offset page、cursor infinite page 与 reconcile 现将 TanStack Query 的 `AbortSignal` 传至 `browserGraphQLRequest`。Root `codegen.ts` 的 Article Activity 文档入口同步到实际 `articleActivity.ts`，生成 DTO 不再依赖已删除的旧文件路径。

验证：`pnpm graphql:codegen` 成功；MentionsMap 与 Comment query 定向测试 **9 passed**；`pnpm --filter @groupher/frontend-core run type-check` 通过。新测试覆盖 revision 变化触发图重取、focus 首屏只取一页，以及 page/infinite/reconcile 将取消信号传给 transport。

仍未闭合 B3 的真实宿主卸载/共享消费者取消测试、Post/Blog/Changelog/Doc/Ticket 路由集成及 Activity 全边界验收。B2 的一跳 Query 已有实现和领域测试，但 GraphQL/预算验收与生产代表性分布证据仍需核实；B1 剩余矩阵未变，B4 未开始。

### 9.23 全链路 review 回归收口（2026-11-05）

全链路 review 复现并修复了两个基础设施问题：初始化 manifest 的 `database_identity` 改为读取 Repo 当前会话的 `current_database()`，并在设置 `MIGRATION_EXPECTED_DATABASE` 时与实际连接名比较；B0 只读报告不再引用已删除的旧 Ecto schema，而是对仍存在的旧表执行 Ecto aggregate、对已删除的旧表报告零计数。该报告脚本现可在已应用新迁移的隔离测试库运行，并报告实际数据库名。

新增 [MentionsMap 一次性切换运行手册](../../deploy/runbooks/mentions-graph-cutover.md)，明确该手册尚未在目标环境执行。删旧表确认值增加 `:writers-drained` 后缀，表达操作员须先证明 API/worker/CLI、在途事务及旧任务/outbox 已停止/终结；它是人工确认，不伪装成自动检测。移除空的旧 `reference_map` 目录。

验证：`MIX_ENV=test mix test test/groupher_server/release_test.exs test/groupher_server/cms/mention_version_facts_test.exs --seed 0`：**46 passed**；`MIX_ENV=test mix run scripts/mentions_map_b0_report.exs`：退出 0，report-only，当前测试库旧表计数为零；Core 目标测试 **33 passed**，Core type-check 通过；`mix format --check-formatted`、`git diff --check` 通过；`pnpm docs:check` 全部通过。

这轮未执行生产迁移、停机、初始化或 cutover。B1 的 Parser/locator/Auth/初始化矩阵、B2 的一跳 GraphQL 与生产分布证据、B3 的真实宿主/共享取消/Activity 边界均未因此验收；B4 仍未开始，需按 runbook 补齐目标环境证据后再执行。

### 9.24 全链路计划对照与定向复验（2026-11-05）

对照主合同检查后，B1–B3 仍不能标记验收通过：Parser/初始化完整来源矩阵、真实编辑器 locator 产出和 Auth 部署凭据链尚缺；生产代表性 PostgreSQL 扫描/延迟证据尚缺；真实路由宿主、共享查询消费者取消与 Activity 全边界用例尚缺。B4 继续 BLOCKED：runbook 已列出停机、核验和迁移条件，但还没有给出 app machines 全部停止后如何启动一次性 release initializer，以及运维机与该进程之间安全传递 manifest/pages 的实际命令和文件传输路径；不得据现有 runbook 执行目标环境切换。

全链路复验发现 Parser 候选测试对 external URL map 使用点访问 `type`，而该候选以 `mentioned_type: :url` 表示，没有 `type` 键；断言扫描到 external URL 时抛 `KeyError`。改为 `Map.get/2` 后复验通过。后端提及版本/图查询/预算和 Ticket Activity 定向组：**93 passed**；Core MentionsMap、ArticleQueryProvider、PostTicketProgress、GraphQL client 和 Comment query 定向测试：**34 passed**；Core type-check、`pnpm docs:check`、`git diff --check` 通过。

### 9.25 全局图 revision 命名落地（2026-11-05）

新增后续迁移，将已建的 `cms.mentions_map_revisions` 改名为 `cms.mentions_graph_state`，并同步重命名 check 与主键约束；历史建表迁移保留。运行时 Ecto 模型为 `Model.MentionsGraphState`，全局读写 owner 为 `MentionsGraphRevision`，表内仍只有 `id` 和 `revision`。后端 GraphQL 字段与 CMS facade 为 `mentionsGraphRevision`，前端轮询 operation 为 `MentionsGraphRevision`，TanStack Query key 前缀为 `mentions-graph-revision`；其余 `MentionsMap` 图页命名按 B4 切换计划处理。本项是版本命名与存储收口，不代表 B1–B4 验收或生产迁移已执行。

验证：`pnpm graphql:codegen`、Core type-check、`pnpm docs:check`、本次 Elixir 文件的 `mix format --check-formatted` 和所涉已跟踪文件的 `git diff --check` 通过。`mix compile --warnings-as-errors` 被同期 Parser 的 `CMS.Gate.Context.Scope.Ticket.all_public/0` 未定义告警阻断；该 Parser 文件不属于本次 revision 命名改动。新增迁移尚未在本地或目标数据库执行。

### 9.26 通用 mention key 与稳定身份（2026-11-05）

编辑器包的 mention option 只有 `key/text`，选中时把 `key` 原样写入节点、`text` 写入显示用 `value`；Content Publisher 的 Plate JSON 序列化保留节点字段。业务层提供 `type:stable-id` 形式的 `key`，编辑器不理解 CMS 类型或身份。Parser 仅从 `key` 读取结构化提及的目标类型与稳定 ID；已移除 `target_type`、`target_id`、`target_community_slug`、`target_branch_id` 的读取和 locator 验证。目标 Community 不属于引用身份；普通平台 URL 仍按 URL 自身的 Community 定位。

正常发布按目标稳定 ID 批量查询匿名 public Scope。Article 多个 mirror 仍是同一 UUID；Doc branch 从公开主分支取；Comment 须同时满足自身和同一 binding 下父 Article/Doc 的公开 Scope。目标不可读时，新引用不建边，同来源可信上一 set 的继承不变。受控初始化继续按 canonical 身份恢复当前正文关系，不要求目标当前公开。

本地验证：`mix compile --warnings-as-errors` 通过；`mention_version_facts_test.exs`、`mentions_map_query_test.exs` 和 GraphQL mentions 测试共 **78 passed**。测试覆盖跨 Community 的 Article/Doc key、Comment 父级隐藏、User key、真实 Article 发布和 Comment 创建 Command 保存 occurrence、正常 Capture 的隐藏目标继承和初始化。外部候选搜索按本轮用户决定暂缓；仓库内不新建搜索索引或候选 API，前端候选选中到 `key` 的宿主集成不计入本轮完成范围。B4 生产切换状态不变。

### 9.27 B1 跨 Community Doc Comment 初始化父级（2026-11-05）

新增命令级用例：来源 Post 在 Community A，目标 Doc Comment 属于 Community B；目标公开时正常 Parser 可绑定，撤下其 DocPublic 后正常 Parser 不新建边，但受控初始化仍须从 canonical Comment.branch_id 和 DocBranchVersion 识别 B 的 main branch，建立 Comment endpoint 与 Doc 父 endpoint。该用例先复现 `mention_comment_parent_mismatch`：初始化原先把来源 Community A 当作父 Doc branch 的 Community。修复后父级返回真实目标 Community，不从来源推断目标归属；隐藏 Doc Comment 的边和辅助父 endpoint 均保存。

另补正常 Capture 的跨 Community Doc 隐藏继承用例：同一 `key` 的第二版本继续指向原 endpoint，`mentioned_at` 沿用首次绑定时间。聚焦用例通过。B1 仍需完成第 2.1 节其余来源/状态矩阵及命令出口验收；本修复不代表 B1 全绿。

### 9.28 真实 Trash 期间的来源再发布（2026-11-05）

扩展 Article Trash 命令级用例：来源 Blog 已引用目标 Post，目标进入回收站后，来源修改正文并再次执行 `CMS.Articles.update/5`。新 set 仍保存同一目标 endpoint，继承原 `mentioned_at`；投影后当前边仍在，目标恢复及永久删除后也保留引用身份。这里验证的是实际更新、回收站和投影命令串联，不仅是手工删除公开投影后的 Parser/Store 单元路径。

验证：`mix test test/groupher_server/cms/articles/trash_test.exs` **17 passed**；该文件的 `mix format --check-formatted` 和 `git diff --check` 通过。投影会重建 current edge 行，因此用例按 source/target endpoint 查新边，不把 edge 行 ID 当作稳定身份。B1 其余矩阵与目标环境 Auth 凭据链仍未验收；外部候选搜索继续暂缓。

### 9.29 跨 Community 平台 URL 的绑定与初始化（2026-11-05）

新增来源 Community A 的正文引用目标 Community B 的公开 Blog URL 的命令级用例：正常 Parser 使用 URL 中的 B 定位，`CaptureCurrentVersion` 保存目标 Blog endpoint/occurrence；目标撤下公开选版后，普通 Parser 不新建边，受控初始化仍从 B 的现存 binding 验证并绑定稳定身份。该用例与结构化稳定 `key` 的跨 Community 测试分别覆盖两条输入路径。

验证：完整 `mention_version_facts_test.exs` **48 passed**，该文件格式检查通过。本项没有发现新的实现缺陷；B1 的其他输入/状态组合与目标环境 Auth 凭据验证仍待完成。

### 9.30 三类来源的初始化 report/apply（2026-11-05）

将现有扫描测试扩展为 Article（含已公开 User Ticket）、Doc main、Comment 三类来源的 `report_page` 与 `apply_page` 全路径。新增用例首先发现 Doc 扫描结果缺少 `community_count`，导致 `report_page(:docs)` 计算 fingerprint 时抛 `KeyError`；Doc scanner 现返回单一 owner Community 的计数 `1`，与 Article/Comment 来源字段形状一致。测试逐来源检查 desired/synced set 水位相等，并确认 Article/Doc 初始化没有新增 Outbox 事件。

本节记录当时的修复过程；§9.33 已移除初始化扫描中的来源 `community_count` 与 `community_id` 字段，不能把这里的临时字段当作当前合同。

验证：完整 `mention_version_facts_test.exs` **48 passed**。这是本地测试库的命令级证据，尚不代表目标环境完整 S 覆盖或 Auth 部署验收；B1 仍进行中。

### 9.31 Parser 升级的水位与旧投影拒绝（2026-11-05）

新增同一 source/token 先保存 parser v1 空 set、投影追平，再保存 parser v2 set 的用例。两个不可变 set 分别存在；v2 成为 desired 后，synced 仍指向 v1，晚到的 v1 投影返回 `mention_projection_set_not_desired`，只有 v2 投影成功才追平。此前测试仅证明不同 parser version 可以共存，未覆盖投影水位切换。

验证：完整 `mention_version_facts_test.exs` **49 passed**。该用例覆盖 Store 的乱序边界；真实 worker 的重复/晚到任务矩阵仍须单独验收，B1 未标全绿。

### 9.32 真实 projector 晚到与重复任务（2026-11-05）

补充 Outbox/Oban 命令级用例：旧 publication set 有一条引用，新 publication set 已移除该引用；先交付旧 `CMSMentionSetProjector` job，不得写入旧边或推进 synced，再交付新 job 得到空当前边，重复交付新 job 不重复递增全局 revision。这样将 9.31 的 Store 拒绝扩展到实际 worker/event 入口。

验证：定向 worker 用例通过。B1 的完整来源/状态矩阵、通知与重建等其余出口，以及目标环境 Auth 凭据链仍待验收。

### 9.33 初始化目标身份与来源 binding 解耦（2026-11-05）

移除初始化扫描为普通 Article/Comment 计算 `min(binding.community_id)` 与 `community_count` 的子查询，Doc 来源也不再补固定计数；来源页只读取 canonical 身份、当前选版与正文。初始化 report/apply 的 Parser 改为无来源 Community 入参。稳定 Article/Comment ID 按目标 canonical 身份解析；Doc UUID 从目标自身唯一的 main owner 取得 branch 和目标 Community。只有目标本身存在多个可选 main owner 才报歧义，来源 mirror 数量不参与判断。平台 URL 继续按 URL 自带 Community 的 binding 定位。来源 fingerprint 不含来源绑定信息。

镜像来源回归同时包含结构化 `doc:UUID` 与旧 `.../doc/UUID` 链接：新增来源 binding 前后，目标候选及来源 fingerprint 完全相同，原 manifest 的 `preflight_page` 仍通过。验证：版本事实与 Article Trash 测试 **67 passed**；`mix compile --warnings-as-errors` 与所涉 Elixir 文件格式检查通过。B1 其余出口与目标环境 Auth 状态不变。

### 9.34 Doc 稳定身份：新增基线与联合修正（2026-11-05）

本项承接当天新增身份决策；不追溯改写 §9.1–9.33 的历史测试结论，也不将旧 branch 身份下的通过数作为新合同证据。B0 原验收保留，新增身份基线单独登记。

| 影响位置                                         | 本轮修正 / 验收                                                                                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint DDL / schema / Store                    | 移除 branch 列、Doc branch 唯一键及 CHECK；所有 Article 类型统一 `(type, article_id)`，Comment 为 `comment_id` + 稳定 parent；拒绝带 branch selector 的身份；重复 Doc 的数据库唯一约束生效           |
| Parser / Capture / Doc publish / Comment Effects | Doc 自引用按稳定 Article 排除；Comment 目标与父级不以 Comment.branch 定位；Doc 发布仍仅 main 捕获，真实 branch/version 保留在 source_token；Comment 捕获从目标 Doc 的唯一 main owner 验证 Community  |
| 当前正文初始化                                   | 来源身份、候选 target_identity / parent_identity 不携带 branch；Doc 正文扫描仍按真实 main 选版及 token；Comment 来源扫描通过父 Doc 当前 main public selection 纳入 S，不通过 Comment.branch 选择来源 |
| Query / NodeStatus / 一跳 / seeds                | endpoint join、节点身份、pending 与父级关联均去 branch；公开正文和父级仍复用 Gate 的 main public Scope，不开放 preview 图                                                                            |
| Docs.Trash.purge_branch                          | main 正文分支移除时撤下 Doc 出边；其他 branch 仍保留稳定 Article 时不写墓碑；只有最后一个 branch 被清理并真正删除 Article 时才标记稳定 Doc endpoint                                                  |

新增迁移 `20261105130000_stabilize_mention_doc_identity.exs` 只允许空的新事实数据集；非空时明确失败，不自动合并、清空或回填旧 endpoint。已应用旧实验 DDL 的环境须在隔离空数据集验收；本轮不处理目标环境数据，也不提供 branch 身份兼容路径。回退仍按切换前整体快照恢复，不伪造 branch 身份。

红基线：在业务修改前运行 `MIX_ENV=test mix test test/groupher_server/cms/mention_version_facts_test.exs --only stable_doc_identity --seed 0`，新增 3 个用例全部失败，分别证明 schema 仍有 branch、无 branch Doc 被拒绝、带 branch Doc 仍可创建；随后同命令 **3 passed**。后续新增稳定 self-reference、真实 Doc 图/一跳/seeds、main 正文删除但 preview 生命周期仍保留 Article 的回归。最终复验结果见本节末尾。

范围边界：本项修改 Mentions endpoint/父级身份及其选版调用，不实施共享评论计划中的 Comment 表 branch 删除、编号/参与者/count、通用 Gate CommentContext 与 Reader 切换。当前仓库通用 Comment Gate 仍使用 branch_policy；共享评论计划完成后须再验无 branch canonical Comment 的真实创建/读取入口。此依赖与 B1 全来源/状态矩阵、通知幂等、重建、Auth 目标环境登记、B2 代表性负载、B3 真实宿主等出口继续开放；B1–B3 未验收，B4 未开始且 BLOCKED。外部候选搜索继续暂缓。

最终验证（本地 `groupher_server_test`，seed 0）：以下第一组 **156 passed**，第二组 **17 passed**，共 **173 passed**。包括 6 个 `stable_doc_identity` 用例；preview-only Doc 发布后不创建公开 Mention endpoint。`MIX_ENV=test mix compile --warnings-as-errors`、本轮 Elixir 文件 `mix format --check-formatted`、`pnpm docs:check` 与 `git diff --check` 均通过。测试库已执行稳定身份迁移；目标环境未运行迁移、初始化、停机或切换。

```sh
cd backend/api
MIX_ENV=test mix test \
  test/groupher_server/cms/mention_version_facts_test.exs \
  test/groupher_server/cms/mentions_map_query_test.exs \
  test/groupher_server/cms/mentions_map_budget_test.exs \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs \
  test/groupher_server/cms/doc_tree/trash_action_test.exs \
  test/groupher_server/cms/articles/trash_test.exs \
  test/groupher_server/cms/docs/platform_review_test.exs \
  test/groupher_server/cms/comments/write/doc_comment_test.exs --seed 0
MIX_ENV=test mix test test/groupher_server/cms/doc_tree/publish/release_test.exs --seed 0
```

### 9.35 B1 来源状态矩阵、通知、重建与删除恢复验收（2026-11-05）

承接 §9.34 稳定 Doc endpoint，本轮补齐以下本地验收并修复实际缺口。历史通过数保持原日期和范围；
本节不据此宣布 B1 整体或目标环境已通过，也不执行 B4。外部候选搜索继续暂缓。

| 验收面                 | 具体证据与结果                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 来源种类               | Post / Blog / Changelog / Doc main / User Ticket 经真实发布 owner 保存 User、URL、内部目标事实；普通 Comment 经 create/update 保存，Doc Comment 使用稳定父 endpoint；按各类实际 canonical token 追平                                                                                                         |
| 输入语法               | 通用 key、Plate a/link 的 url/href、嵌套正文、HTML anchor、裸 URL、相对平台 URL、Comment fragment、旧 UUID 与 comment_id 语法、User 和外链；custom host 不按路径猜内部身份；同一个 link 的 href 与 URL label 不重复 occurrence，不同位置仍分别记录                                                           |
| Article/Doc 目标状态   | 四类目标各覆盖 public / review hidden / soft deleted / no public selection / Community hidden；正常新绑定只接受完整匿名 public Scope，初始化保留可验证 canonical 身份；来源 Community 不替代目标 Community                                                                                                   |
| Comment 目标状态       | 普通 Article 和 Doc 父级各覆盖公开、Comment review、Comment deleted、父级 review / deleted、Community hidden；初始化验证稳定父级，不携带 branch；Mentions 对删除占位正文不新绑定或展开，不改变通用 Comments 的 tombstone 读取能力                                                                            |
| Ticket 边界            | 真实 User / Worker / Case Command 数据；只有公开 User Ticket 正常入图，Draft/hidden User 身份可初始化；Worker/Case 不绑定且明确拒绝初始化；不通过破坏 public-number CHECK 构造伪造内部 Ticket                                                                                                                |
| 身份错误               | 已存在稳定 ID 的 type 与 key 不符，以及 Community-local URL 路径 type 与真实 binding 不符，Capture / 初始化明确失败；未知或不存在的普通输入仍按文本/链接降级；无新增 set/Outbox 的歧义失败用例                                                                                                               |
| 时间与聚合             | 同一内部 endpoint 的不同 URL 写法使用同一个关系身份，继承同一个 mentioned_at；保存校验与投影聚合共用 identity，不能用 URL 差异绕过冲突校验。新增两个用例先真实失败，再修复通过；相同位置替换链接及旧绑定歧义不任选目标                                                                                       |
| 通知幂等               | 真实发布 → Capture → Outbox projector → Messaging；User 重复 occurrence 只投递一次；命令 Receipt / worker 回放不重复，不重置已读；普通 Comment 改显示文案、移除、再出现时仅新增关系投递；快速连续保存不丢首次未投递意图，Mailbox 提交后 ACK 丢失不重复；隐藏来源、回滚、移除后的过期事件、初始化及重建零新增 |
| 重建                   | 新增独立 maintenance scope 的 Command；从当前选版对应不可变 set 修复索引，目标已隐藏仍保留 endpoint/time；不解析 URL，不修改正文/版本，不发通知；相同索引 no-op，缺失/过期 set 返回不完整错误；initialize token 不能调用 rebuild                                                                             |
| 删除与恢复             | 原有 Article Trash/restore/hard-delete 及 Doc Tree/branch 用例继续跑；Doc 恢复前后公开节点 ID、入边、mentioned_at 与已读通知保持；永久来源删除清水位/无引用 set，保留入边和稳定 endpoint；仅父级删除不伪造 Comment 永久删除墓碑                                                                              |
| Comment 回收与晚到任务 | 来源 endpoint 在继承和保存前加锁；新 set 追平后回收旧 Comment set，保留当前/desired/synced；任务先核对 desired set，旧 set 已回收仍结束为 stale，不重试复活；worker 另在锁内检查 canonical token/main selection                                                                                              |
| 初始化零副作用         | 各种来源从清空的新事实状态重新初始化并重跑；set 幂等、desired/synced 相同、正文 token/选版不变、Outbox 和收件箱记录不变；Doc Comment 单独验证同样路径                                                                                                                                                        |
| 导入入口               | 真实 ContentImport staging/apply 只生成 Doc Draft，尚不创建 Mention endpoint；正式 DocTree publish Command 后才生成同一套 set，Receipt 重放不重复 set/事件                                                                                                                                                   |

实现位置：`artiment_mentions/current_source.ex`、`notifications.ex`、`commands/rebuild_current_set.ex`、
`maintenance_authorization.ex`、Parser、Capture、Store、Effects 与 MentionProjection workflow；
读取只增加 Mentions 的 Comment visible 约束，不迁移通用 Comment Gate/Reader。
正常通知仍复用原有 Messaging Command、delivery identity 与 mailbox 投影，没有第二套收件箱数据。

重建凭据合同见 [Auth 说明](../../auth/README.md)。本轮只用本地 JWKS/签名 token 验证精确 audience/scope；
目标环境 maintenance registry、短时 token 签发/验证证据仍未取得。共享评论存储、编号、计数及通用 Gate
切换仍属独立依赖，不能将当前 branch 记录下的运行态验收扩展为 branchless canonical Comment 全入口已完成。
B2 代表性目标负载、一跳预算，B3 真实宿主/缓存/Activity 全出口亦不在本轮完成范围。B4 仍未开始且 BLOCKED。

通知追加红基线：首次 User 提及尚未投递就保存同一 Comment 新版时，原先实际得到零条收件箱记录；
新增用例先 **1 failed** 复现。现已在 Capture 时仅继承仍在正文中的待投递意图，并将收件箱行与
Outbox `consumed_user_ids` 同事务提交。新增 ACK 丢失模拟证明不会把已投递意图再次带入新版本。
该消费标记属于原有 Outbox delivery，不增加 Mention endpoint 身份或正文业务版本，也不创建新的通知入口。

最终本地复验：B1 验收文件 **60 passed**；下面 15 文件组合 **299 passed**（包含该 60 项），seed 0。
`MIX_ENV=test mix compile --warnings-as-errors`、所涉 Elixir 文件的格式与 wrapped-inline-do 检查、
`pnpm docs:check`、`git diff --check` 通过。没有运行目标环境迁移、初始化、Auth 登记或发布操作。
本地四项验收已补齐；B1 总出口仍受上文目标 Auth 和共享评论运行态依赖限制。

```sh
cd backend/api
MIX_ENV=test mix compile --warnings-as-errors
MIX_ENV=test mix test \
  test/groupher_server/cms/mentions_b1_acceptance_test.exs \
  test/groupher_server/cms/mention_version_facts_test.exs \
  test/groupher_server/cms/mentions_map_query_test.exs \
  test/groupher_server/cms/mentions_map_budget_test.exs \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs \
  test/groupher_server/cms/articles/trash_test.exs \
  test/groupher_server/cms/doc_tree/trash_action_test.exs \
  test/groupher_server/cms/doc_tree/publish/release_test.exs \
  test/groupher_server/cms/docs/platform_review_test.exs \
  test/groupher_server/cms/comments/write/doc_comment_test.exs \
  test/groupher_server/cms/tickets/commands/mutate_test.exs \
  test/groupher_server/cms/content_import_flow_test.exs \
  test/groupher_server/messaging/mention_test.exs \
  test/groupher_server/cms/articles/commands/recovery_test.exs \
  test/groupher_server/jobs/comments_test.exs --seed 0
```

### 9.36 MentionsGraph 命名及目标 Auth 实签验证（2026-11-05）

当前运行时已从 `MentionsMap` 联合改名为 `MentionsGraph`：后端模块/文件、CMS facade、resolver、
GraphQL 字段/类型、前端目录/hook/query、generated、i18n key、事件/缓存 key、错误名与配置键同步。
当前入口为 `mentionsGraph` / `mentionsGraphArticleComments`，revision 仍为 `mentionsGraphRevision`；
当前配置为 `MENTIONS_GRAPH_KEY` / `MENTIONS_GRAPH_KEY_VERSION`，release 确认为
`MENTIONS_GRAPH_CUTOVER_CONFIRMATION`。既有错误编号保留，不增加旧名别名或 fallback。
当前文档和 B0 只读脚本已同改名；历史 DDL、审计快照及 §9.1–§9.35 中原始执行命令保留旧名，
用于说明当时运行的内容，不是当前 API/配置。没有执行目标环境 key 切换或新 API/UI 发布。

目标 Auth 已完成维护 resource 与两个独立 client 登记、真实签发和鉴权验证，详见
[目标 Auth 证据与重跑命令](../../deploy/runbooks/mentions-graph-maintenance-auth.md)。
initialize/rebuild 均取得精确 scope 的 600 秒 token；错误 scope/resource/credential 均拒绝；
本机和目标 Fly 独立 BEAM 进程各 **5 checks passed**，包括交叉 scope 与篡改签名拒绝。
Auth 启用版本为 `c2aaea5b-5c5b-4db1-9e59-9d7c37d71ca7`；复核原有 22 个 binding、其他 settings
及两个未改模块均保留，仅 app bundle 增加一行 registry 合并和新增 maintenance resource/binding。
正在服务的 Phoenix 仍是旧 release；隔离验证不等于已升级现网接收配置。这属于后续发布核验，
不再把 client 登记与真实签发笼统记作“Auth 未解决”。

本轮定向结果：后端 Mentions/release 6 文件 **157 passed**，另有 Snapshot 2 文件 **19 passed**；
前端 **33 passed**；Auth **6 passed**。
GraphQL SDL/generated 重生成、Core/Auth TypeScript、GraphQL 合同与 generated 检查通过。
改名不改变关系事实，不计作 B1 总出口、B2 代表性数据或 B3 真实宿主验收通过。

为完成本地检查，修正了工作区共享评论迁移中两个 JSONB array default 的 Ecto 表达形式
（`default: fragment("'[]'::jsonb")`），补了 `user_summaries/1` 文档示例，并使 Snapshot 的用户摘要
查询通过 Accounts facade；未改变它们的业务语义。

B4 的目标 migration、初始化、重建、旧 writer 排空、删表和切换均未执行；外部候选搜索继续暂缓。

### 9.37 B2 / B3 不依赖 Doc Comment 的独立验收（2026-11-05）

详细范围、指标定义、完整计划与浏览器证据见
[B2/B3 独立验收记录](mentions-graph-b23-independent-acceptance.md)。

- B2 独立切片 34 passed：一跳 GraphQL 的 offset/cursor、公开过滤、占位、pending、scope/revision cursor 和 SQL 预算已验收；
  offset 双向各 13 SQL、cursor 双向各 12 SQL。PENDING 分支曾跳过 cursor 校验，新增失败用例后修正。
- 完整图邻接曾使用 OR 扫描再排序；改成双方向分别 LIMIT 后 Ecto UNION 去重。
  3,000 边用例的完整实际计划使用出/入窗口索引，最大 scan 节点处理行数从 3,000 降为 21；
  图/一跳请求各 12 SQL。该指标不等于所有表总扫描量，不能作为目标 p95/容量证据。
- B3：真实 Community 路由下 Post/Blog/Changelog/Doc 正文、Post drawer 与 User Ticket 共 23 项浏览器检查通过，
  包含未选中零图请求、规范 focus、卸载与原生 fetch AbortError，以及 Ticket 默认收起且不请求 Activity。
- 修正跨 Community 沿用已展开 frontier、revision 失效仍显示旧标题/链接，以及 Ticket 使用不存在的 THREAD.TICKET。
  Activity query 接入已有 viewer scope；换号清理旧数据并保留新 scope 请求。AccountProvider/QueryClient 集成验收通过。
- Activity HTTP 公开投影/分页/隐藏 root 与真实 Post Ticket 创建/关联、receipt 去重、隐藏 target 共 7 项定向通过。
  当时较宽 Activity/Ticket 回归 55 passed / 2 failed，失败均为 Ticket 通知 Comment scope 缺 community_id；后续已关闭，见 §9.38。

目标只读盘点仍只有旧 mention 表，未建立新图代表性隔离数据集，因此 B2 目标扫描量、延迟和锁等待出口未通过。
Doc Comment 与 callback 联合验收继续等待另一条评论实现；本节不宣告 B1、完整 B2/B3 或 B4 通过。
本轮没有执行目标迁移、当前正文初始化、重建、旧 writer 排空、停机、删表、发布或外部候选搜索。

### 9.38 Ticket 通知与文档门禁阻塞关闭（2026-11-05）

本次复核发现当前通知消费者已补齐请求社区：
`CommentScope.for_thread(:post, community_id: community_id)`；原 4 处模块 flow 与 Participants 失效链接
也已由共享评论变更补齐。没有重复改写其实现，也不采用 all_public 绕过社区准入。

- 原两项通知用例按当前实际位置独立复跑：**2 passed**。
- Tickets.Commands.MutateTest、ActivityTest、公开 ArticleActivityAcceptanceTest 完整组合：**57 passed / 0 failed**，替代前轮 55/2 结果。
- 文档门禁继续运行时暴露本线程一处测试标题命名，将图的 `relation set` 改为 `edge set`；未修改检查器或业务行为。
- 完整 `pnpm docs:check`、`MIX_ENV=test mix compile --warnings-as-errors` 与 `git diff --check` 通过。原两组阻塞已关闭。

[独立验收记录](mentions-graph-b23-independent-acceptance.md) 已同步当前结果及复跑命令。
B2 的目标代表性性能证据仍未通过；Doc Comment 联合验收继续等待另一条会话完成。
本次不宣告 B1 或 B2/B3 总出口通过；未执行 B4、目标环境变更或外部候选搜索。

### 9.39 Replies 完成后的 Doc Comment 联合出口（2026-11-05）

Replies 会话已完成，本轮在当前代码独立重跑并补齐 [联合验收记录](mentions-graph-doc-comment-joint-acceptance.md)。
不继承另一条会话的通过数；§9.34–§9.38 中的“共享评论等待”是历史状态，由本节关闭。

- B1：main/preview 输入共用稳定 Doc parent；Comment 不含 branch。真实 Command/worker 的重复投影、编辑已读通知、迟到旧任务、旧 set 回收、重建与无通知初始化通过。
- B2：Doc + 9 Comment 的 10-frontier 为 21 SQL；六类混合 10-frontier（含 Doc reply）为 22 SQL。Doc Comment 双方向一跳 HTTP：offset 各 14 SQL、cursor 各 13 SQL，均 ≤32。
- B3：实际 Community → BFF → Phoenix → 专用本地持久化库的 12 项浏览器检查通过，包含 Doc seeds、Comment canonical URL、返回文章及 native fetch abort、Post 评论按钮回调，无响应替身。
- 实际修复：Post 评论 Mentions 按钮被收起回复点击区遮挡；按钮按现有 salon 移出该区域，普通浏览器点击复验通过，没有 force click。
- 后端联合 171 passed，评论 GraphQL 读写另有 168 passed；前端定向 31 passed。Community 生产构建、Phoenix production release 构建、Core/Community/Dash 类型、GraphQL/generated、完整 docs:check、维护 Auth 实签与隔离 verifier 通过；没有部署到目标环境。

B1 与 B3 的隔离环境出口可签收，B2 功能/预算切片可签收。B2 目标代表性扫描量、时延和全局 revision 锁等待仍缺证据，
因此整个顺序门禁仍不能放行至 B4。[切换手册](../../deploy/runbooks/mentions-graph-cutover.md) 保持 BLOCKED；B4 和外部候选搜索均未执行。
完整命令、通过数、首次失败及复跑边界以联合记录为准。

### 9.40 B2 性能方案、代表性分母与可执行验收（2026-11-05）

[性能验收方案](mentions-graph-b2-performance-acceptance.md) 已落地为 read-only target probe、canonical fixture builder、完整 SQL/EXPLAIN/latency/lock runner、独立 review 及隔离 PG17 compose。
目标只读盘点为 33 Article / 5 Comment，旧关系 27，新图表不存在；可选正文 census 只在目标进程内输出 38 份当前 JSON 的长度/语法数量，不导出正文，不做外部候选搜索。

目录数量校准集 38 来源 / 561 边已执行；标准压力集为 486 来源 / 11,241 边。每读取场景 100 次采样，含实际 Phoenix GraphQL handler。
大压力集另有 1,944 来源 / 89,870 边、380 隐藏父 Article，HTTP 首批/十 frontier p95 为 439.128/815.879ms，最多 22 SQL；paced 首次成功为 68/80 = 85%。标准集读取门槛通过：HTTP 首批 p95 442.614ms、十 frontier p95 802.476ms，最大 22 SQL；计划/索引/扫描量、pool queue 与 revision 等待曾有原始测量文件，现已移除。
独立进程实际观察到同一 revision 行的 transactionid 锁等待，持锁时图读通过；但 paced 诊断约 4.29 次 revision 更新/秒的读取窗口内，首次读取成功率为 72/80 = 90%，低于建议 95%，review 为 PARTIAL，不能据低 writer 延迟放行容量。

曾尝试共享 Scope 的 materialized CTE，3,000 边回归拦住全邻域扫描退化，原型已撤回，保留原有窗口/索引断言；恢复后的同组 171 项通过。未保留未证实的性能“修复”。
本机 PG14 与目标 PG17 不同；正式代表集/容量及读写速率未冻结，充分样本和同环境签收仍待执行。独立 PG17 验收可先于 B4，不建立循环依赖。
B1/B3 隔离出口不变；B2 总性能继续未签收，B4 与外部候选搜索继续暂缓。

### 9.41 B2 首次失败后的限次恢复与实测（2026-11-05）

MentionsGraph 首批 GraphQL 仅在全局 revision 错误 4553 时限一次重试；cursor 4551/4553 会舍弃过期展开页，在当前版本/内容周期内按作用域最多自动重启一次。永久错误不重试、不展示先前缓存的图；手动重试从首批开始。前端定向 18 passed，Core 类型检查通过。

标准受控集 10 秒顺序对照：单次 HTTP 成功 563/632（89.1%）；允许一次重试的完整交互成功 573/573（100%），52 次使用第二次请求，交互 p95 113.04ms；两组实际 revision 完成速率均约 3.97/s，单次请求 SQL 最多 13、最长 121.551ms（重试组）。完整原始摘要及[验收边界](mentions-graph-b2-performance-acceptance.md)保留首次失败、请求数和端到端延迟，不把两次请求的 26 SQL 误当作单次指标。

此为本地 PG14、受控图和 10 秒 `load_only` 诊断。PG17、目标容量/代表性来源、约定到达率和正式三轮样本仍未签收，B2 总出口与 B4 状态不变。

后续 60 秒同负载诊断将样本扩到单次阶段 3,241、限次恢复阶段 3,506 个完整交互：单次阶段成功 88.58%，恢复阶段成功 99.66%，仍有 12 次两次请求都被 revision 拒绝；重试组交互 p95 126.306ms，单次服务端最多 13 SQL / 最慢 288.913ms，两阶段实际更新均约 4/s。`load_only` 明确不签收 B2；正式验收需先约定成功率是首试还是完整交互，并保留两个分母。

真实 Community Post 宿主恢复检查通过：一条注入的 4553 触发恰好一次首批重试；注入的 4551 只请求一次过期 cursor，随后重取首批。其余请求走本地真实 Phoenix fixture。`/home/xx` 在该 fixture 是 404，使用同一 `home` 社区、作者 `xx` 的 `/home/post/3` 验收实际 Article 宿主。B3 此新增恢复路径有浏览器证据，原 B3 隔离出口不变。

### 9.42 B2 隔离 PG17.11 标准 pilot（2026-11-05）

使用校验 SHA 的 PG17.11 Homebrew bottle 和本地编译的 roaringbitmap 1.2，在独立 127.0.0.1:5548 与新建测试库完成完整迁移及标准集。13 个各 100 次读取场景的本地延迟、SQL 和全计划扫描门槛通过；HTTP 首批 p95 396.3ms，六类型十 frontier p95 899.271ms，单次最多 22 SQL。revision 锁等待实测 41.159ms，持锁读取通过。历史环境、摘要、计划与复核结论保留于本文，原始文件已移除。

显式关联目标只读 profile 后，review 不再报 PG 主版本不符；但 paced 领域首试只有 73/80 = 91.25%，HTTP 单次 76/80 = 95%，限次恢复交互 80/80。各组实际 revision 到达率分别约 4.71/5.44/4.98 次每秒，不作配对比较。review 仍为 `PARTIAL`：本机容量不是目标 SKU、受控图并非目标当前正文图，正式负载和三轮充分样本未签收。B2 总出口不变，B4 与外部候选搜索继续暂缓。

同版本大集摘要、计划和复核也已保存：1,944 来源 / 89,870 边、380 隐藏父 Article；13 场景本地门槛通过，非 offset 最大边表 scan work 1,109，HTTP 首批/六类型十 frontier p95 420.527/899.854ms。paced 领域首试 68/80 = 85%，HTTP 单次 73/80 = 91.25%，限次恢复交互 80/80；review 继续 `PARTIAL`。这只补充同版本压力边界，不改变目标数据/容量缺口。

PG17 标准集 60 秒对照：单次 HTTP 成功 3,165/3,513 = 90.09%，限一次重试的完整交互成功 3,928/3,928，276 次发出第二请求；两阶段实际 revision 更新均约 4/s，重试交互 p95 102.612ms，单次服务端最多 13 SQL / 最慢 186.123ms。独立复核仍为 `PARTIAL`，因为 `load_only` 无完整读取场景且正式容量/分布/负载未签。PG14 同方法仍有 12 次双重拒绝，因此不宣称绝对零失败。
