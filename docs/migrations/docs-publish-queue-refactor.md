# Docs 独立发布队列与去 Branch 重构

> 状态：生产切换执行中，真实身份验收尚未完成。本文定义产品与架构目标、迁移边界和验收条件；当前交付状态见 §0，运行时行为以实现和对应验证为准；旧 DocTree 阶段文档仅用于依赖与退役盘点。
>
> 范围：每个 Community 的 Docs 站点只有一个活动发布队列。取消 Doc 的 branch 维度及旧 branch API，不提供双写、旧参数兼容、旧数据迁移或 preview branch 合并。新合同从空的 Docs 数据状态启动；本文所说的 Release 历史均指新合同上线后产生的记录。

> 前置：[Article WorkingCopy / Snapshot 基座](../feature/article/working-copy-snapshot-target.md)已完成实现和聚焦验收。Docs 已在其上实施；生产清理、迁移和后端部署见 [R8 切换记录](./docs-production-cutover-r8.md)，最终整链验收仍未收口。

## 0. 当前状态与阅读顺序

> 2026-11-12 本轮设计修订：正文采用 ArticleBody / ArticlePublicBody；发布后无未发布编辑时删除 D，再次编辑按需创建；参数使用 revision / queue_revision 等具体名称。本轮同时确认 ArticleBody 分类字段为 type、发布计划使用结构化校验、历史随社区永久保留且 Snapshot 不按时间清理。本轮按 R0–R8 分批实施，R1–R7 状态见下方更新；生产切换及真实身份整链验收仍待完成。附录中的既有实施证据仍对应当时正文内联、D 长期保留版本；新的 R2 / R3 / R4 / R5 / R6 证据另列，不能用于宣称全部本轮设计已经交付。

> R0 / R1 实施更新：已形成 [入口与迁移清单](./article-docs-r0-r1-inventory.md)，并移除 Snapshot 时间清理链路、增加存量任务取消迁移；目标环境尚未执行。此项不代表正文分表、结构化审批或 D 按需保留已交付。

> R2 实施更新：[ArticleBody 与保存 / 固定 / fork](./article-body-r2.md)已改接，并完成所列范围的隔离验证。Docs 完整正文读取和合入同步改接，D 生命周期、plan_hash / 审批算法不变；独立 PublicBody 当时留给 R3，当前状态见下一条更新。现有 D/Q 发布消费和 Release 隔离演练通过不等于目标环境验收。

> R3 实施更新：[ArticlePublicBody 与原子公开投影](./article-public-body-r3.md)已实施；整队发布沿共用 Public 选择步骤同事务写入公开正文，删除 Public 同事务清其正文。公开详情 / Search / Press 已改读 PublicBody，所列隔离验证通过。目标环境、真实外部投递和后续批次未放行。

> R4 实施更新：[审批 / 预览计划 / Release 结构化校验](./docs-structured-plan-r4.md)已移除计划摘要生成、存储和比较，保留格式版本并逐项核对计划与获批 Snapshot 来源。D 生命周期、完整预览 UI、审批 UI / 通知和正式切换不在本批。

> R5 实施更新：[D 按需保留与生命周期](./docs-default-lifecycle-r5.md)已改接。发布和冲突解决在无未发布编辑时删除 D；有编辑或冲突则保留。公开 Doc 无 D 可读，开始编辑显式从当前 Public Snapshot 创建新 D；Trash 删除发布前补恢复副本。隔离数据库、前端聚焦测试和使用实际 hooks 的模拟接口浏览器检查通过；真实服务认证及目标环境验收未完成。

> R6 实施更新：[预览 / 审批 / 历史体验](./docs-publication-r6.md)已接入只读版本化站点投影、审批策略 / 比较 / 通知、历史分页和单 Snapshot 显式恢复。新增历史社区归属；迁移、隔离数据库和浏览器覆盖范围见独立记录。旧模型清理、真实认证联调及正式切换仍未完成。

> R7 / R8 实施更新：[旧机制清理](./docs-legacy-cleanup-r7.md)已补齐普通 Article 的历史归属、Trash 保留及社区销毁，并完成新空隔离库单并发全量后端回归（2,574 通过、0 失败、1 排除）。并行全量中的 Press 大样本用例曾因数据库锁等待超时，单独及单并发重跑通过。[生产切换](./docs-production-cutover-r8.md)的新鲜克隆清理和最新 DDL 演练通过；获授权的生产旧内容清理、最新 DDL、新后端、Dash 和 Community Worker 已执行。匿名公开读取与权限拒绝通过，真实身份整链验收尚未完成。

截至 2026-11-12，**最小发布闭环已在隔离数据库和测试浏览器中跑过；生产后端与两个前端 Worker 已切换，完整 Docs 新机制仍待真实身份整链验收**。本表以下部分保留本轮切换前的交付状态摘要；涉及 R8 的当前状态和证据以 [生产切换记录](./docs-production-cutover-r8.md)为准。“已实现”不等于目标环境验收完成。历史验证来自实施阶段记录；本轮数据库验证见 R2 / R3 / R4 / R5 / R6 独立记录；R5 浏览器检查使用隔离 hooks harness 和模拟接口，不等于完整产品或真实服务认证验收。

- §1、§3、§4 定义产品语义、目标约束及切换要求，不以段落存在表示已经交付。
- §2 是重构前基线；§5 是实施批次、盘点与 DDL 约束；§6 是待逐项签收的验收清单。
- 附录 A 保存本次整理时的详细进展与验证边界；附录 B、C 保存较早的阶段证据，其中“当时未接入”不代表当前状态。
- 后续实现改变状态时，同步更新本表及对应验证记录；不要继续在目标约束中追加无阶段标记的进度。

| 工作项                          | 当前状态及证据范围                                                                                               | 剩余边界                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 本轮正文与 D 生命周期修订       | R1 时间清理退役、R2 ArticleBody、R3 ArticlePublicBody、R4 结构化校验与 R5 D 按需保留已实施，验证范围见各批次记录 | 剩余版本参数改名、真实服务联调及后续批次验收                                   |
| Article 通用基座                | WorkingCopy / Snapshot / Public 已实现，B0–B4 聚焦验证完成；Article Gate 指定本地验收完成                        | 全量后端已通过；不替代生产 Docs 整链验收                                       |
| 正式建表与切换迁移              | 正式迁移已实现；空隔离库建表和发布通过，非空旧数据拒绝                                                           | 实际环境清理、切换和剩余旧存储退役未执行                                       |
| 新建 Doc 与默认副本 D           | 创建目录、Doc、D 及保存已接入；隔离库和测试浏览器闭环通过                                                        | 真实身份和目标环境验收                                                         |
| 入队、出队、Q 保存与 D → Q 合入 | 命令、GraphQL 和前端主路径已接入；已有权限、revision、Receipt、冲突等隔离验证及前端测试                          | Q 编辑、合入的真实浏览器及真实服务认证联调，完整入口权限和过期版本验收         |
| 目录与 Trash                    | 新建、更新、移动、删除、恢复和永久清理新路径已接入；已有隔离验证                                                 | 原始目录操作审计、旧路径清理、并发交错及目标环境验收                           |
| 整队 Release 与公开读取         | Snapshot、ArticlePublic、公开目录、Release、队列消费和 D 对齐已有实现；隔离 GraphQL 与测试浏览器最小闭环通过     | 必要副作用矩阵、真实身份及目标环境完整验收                                     |
| 发布后 D 冲突                   | 读取、解决命令、GraphQL 与前端入口已接入；已有隔离验证和前端测试                                                 | 真实浏览器及目标环境联调                                                       |
| 队列审批                        | R4 结构化校验及 R6 审批界面、策略配置 / Activity、两类 diff 和持久状态通知已接入                                 | 真实身份 / 完整产品联调和目标环境验收待完成；B2 不据隔离测试整体放行           |
| 完整站点预览                    | R6 已接入目标目录、正文、链接 / Cover / FAQ、跨请求具体版本校验及只读界面                                        | 隔离验证见 R6，真实认证 / 完整宿主及目标环境验收待完成；出队确认仍不是站点预览 |
| 发布副作用与 Review             | Snapshot 身份 Review、Mention 与 Search / Press / CDN Outbox 分发已有实现和部分隔离验证                          | 真实外部投递、真实删除入口审核清理及其余副作用逐项验证                         |
| Snapshot / Release 历史         | R6 新增历史归属、授权分页 / 详情、前端历史及单 Snapshot 恢复                                                     | R7 已清理旧 Revision 并验证社区历史聚合删除；目标环境验收待完成                |
| 去 Branch 与旧机制清理          | R7 已完成模型 / 接口 / 消费者 / 旧测试清理，全量后端通过                                                         | 生产尚未部署；无兼容逻辑或历史转换                                             |
| 切换与最终验收                  | R8 已完成明确内容清单、生产基线、克隆清理与最新 DDL 演练                                                         | 实际生产暂停 / 排空、备份、重建、部署及整链验收仍待完成                        |

后续执行 R8：在克隆发布验证与最终静态门禁通过后，完成生产暂停 / 排空、备份、旧内容清理、迁移、部署及真实身份验收。最小闭环已经跑过，不应把尚未完成的最终交付项目写成该闭环从未成立，也不能反过来据此放行正式切换。

### 文档职责

| 文档                                                                                                                             | 用途与验收边界                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 本文                                                                                                                             | Docs 专属 D/Q、目录、预览、审批、Release、去旧机制与切换的目标合同和实施状态  |
| [Article 基座](../feature/article/working-copy-snapshot-target.md)                                                               | 通用内容存储与命令边界；其验收不替代 Docs 编排验收                            |
| [Article Gate 收尾](./article-working-copy-gate-policy-fix.md)                                                                   | 普通 Article 编辑策略及指定本地验收；Docs 权限与锁序另按本文核验              |
| [旧 Revision / Draft](../feature/article/revision-draft-target.md)、[旧 DocTree / ContentImport 盘点](./cms-doctree-refactor.md) | 识别旧入口、存储和消费者的历史材料，不作为新 Docs 模型的实施依据              |
| 切换盘点与 runbook                                                                                                               | §4–§5 定义要求；R8 记录保存明确清单、克隆及实际切换证据，不从候选扫描推定放行 |

### 历史保留与社区删除

社区存在期间，审批记录（包括失效或被后续批准替代的记录）、Release、目录快照、正式 ArticleSnapshot 及正文 / 封面 / 资产引用永久保留。不设置期限、数量上限、分级保留，也不按时间清理 Snapshot；不因旧记录退出 Queue 的当前指针或不再被 Public 选中就删除。单篇 Doc 的 Trash 永久清理只清理编辑与公开入口，保留历史所需的 Article 身份和内容。查看历史与从指定 Snapshot 创建副本分别授权，恢复不修改旧 Snapshot，也不自动回滚整站 Release。

社区删除才进入历史聚合清理：停写并处理任务，解除本站 Queue 当前指针、Public 和跨历史引用，再按依赖清理审批 / Release / 目录快照及其专属内容。共享 Article / Asset 或其他社区正式引用仍须保护，不能按表批量删除。实际清理顺序需独立实现和验收；既有外键不能用无条件 CASCADE 绕开。D/Q 生命周期清理、Trash 到期清理和异常孤儿修复不等于历史 Snapshot 清理。

### 本轮确认的基座接入与验收增量

```text
D / Q WorkingCopy -> 各自独占 ArticleBody（可变）
审批 / Release Snapshot -> 各自独占 ArticleBody（不可变）
                              |
                            发布复制
                              v
ArticlePublic + ArticlePublicBody（每篇公开 Doc 一份正文）
                              |
                  公开详情 / Search / Press
```

字段、owner、可变性、FK 与删除约束以 [Article 基座 §4 / §6](../feature/article/working-copy-snapshot-target.md) 为唯一正文存储合同。Docs 不另建正文表：Q 保存原地更新 Q 的 Body，Freeze / Fork 创建独立正文行；PublicBody 有自己的完整字段，没有 body_id，不以引用历史正文代替公开副本。Public.snapshot_id 与 PublicBody.snapshot_id 必须同事务一致，公开删除同步移除 PublicBody。预览中的 Q / 历史审批读取 ArticleBody，当前公开基线正文读取 PublicBody；整个预览仍要求一致的读取快照。

新增验收须覆盖发布中途失败、审批 Snapshot 复用、整队多个正文投影原子提交、删除 / 恢复、公开正文缺失拒绝而非回退、Search / Press 重试不恢复旧公开正文，以及干净 D 删除 / 首次编辑初始化 / 并发保存 / 旧 ID 拒绝。既有隔离验证不能代替这些新增场景。

版本参数使用 `revision`、`queue_revision`，分别指具体 WorkingCopy 与站点队列；同时涉及 D / Q 时使用 `default_revision` / `queue_copy_revision` 明确对象。GraphQL 按 camelCase 映射，不添加表示预期值的前缀。目录版本用 `tree_lock_version`，展示版本用 `public_presentation_revision`，公开基线用 `public_release_id` / Snapshot ID；分别描述版本或身份，不统称一个抽象进度。既有代码和生成接口的重命名尚未实施。

## 1. 决策与产品语义

面向作者的概念是**草稿、发布队列、预览、审核、发布、历史、回收站**。普通作者不需要创建或切换 Branch。

```text
Docs（正文 WorkingCopy + 目录树）
  → Publish.Queue（正文显式入队，符合条件的目录变更自动入队）
  → Publish.Release（整队原子发布并记录结果）
```

- 发布始终消费**整条队列**，请求只携带站点、`command_id` 和预期队列 revision，不在请求中临时选子集。“单篇发布”指作者调整队列后只剩一篇 Doc 及其必要目录依赖；多篇文档和目录变更共享同一条发布路径。
- 保存正文草稿不自动入队。未入队草稿不参与队列预览、审核状态或发布。编辑器显示“草稿未入队”（小圆点）；入队后显示“待发布”（小飞机），并提供文字标签，不仅依赖图标。
- 作者可以“移出队列”，保留默认副本 D；若丢弃队列副本 Q 上的独有编辑，命令必须收到显式确认。目录变更默认自动入队，但可通过“撤销改动”恢复公开状态，或“暂缓发布”保留工作区目录草稿并移出队列。两种操作都必须重算目录依赖；被其他队列成员依赖的变更不能单独暂缓。队列预览与发布只使用仍在队列中的目录变更，不能泄漏暂缓的工作区状态。
- 已有公开页面的目录排序、重命名、移动及删除默认自动入队。创建空文档只建立工作区节点和正文草稿，不进入队列，也不出现在公开或队列预览；内容达到可发布条件并由作者入队时，正文和目录位置一起入队。新建 Group / Tab 默认只留在工作区；被入队文档引用的父级壳节点自动作为依赖入队。
- V1 可发布条件：新 Doc 有非空白标题和非空白的语义正文（纯空段落、空格不算）；新 Group / Tab 有非空白名称且父级链可发布。没有入队子项的空 Group / Tab 不自动入队；若产品允许刻意发布空容器，须另加显式确认命令，不借自动目录入队隐式发布。
- 删除已公开文档或目录时，公开内容的删除进入队列；发布前公开站点保持原状。删除范围内从未公开的草稿进入可恢复回收站，不凭空生成“公开删除”队列项。确认界面列出受影响的公开文档和未公开草稿数量。
- 已入队但从未公开的 Doc 被删除时先出队，再将 D 及稳定节点关系移入 Trash。恢复只取回 D 和目录关系，重新发布需再次入队。目录混合删除拆为公开节点的待发布删除和未公开草稿的回收，不把后者记成公开删除。发布前恢复删除事件会撤销相应队列效果；若恢复牵涉未公开草稿，还须恢复其稳定 `doc_id` / `node_id` 关系。永久删除仍被活动队列引用的实体应拒绝，要求先完成出队 / 撤销；审批必须持有不可变 ArticleSnapshot，历史引用不能因工作区实体删除而级联消失。
- 目录位置属于稳定的 `node_id` / `doc_id` 关系，正文草稿不另存一份目录位置。目录发布后，未入队的正文草稿仍跟随同一个文档身份；父节点被删除时，其下未公开草稿进入 Trash，恢复保留原 Doc / 节点身份及父链。
- 工作区保留原始目录操作审计；队列成员与审核预览按“公开树 → 队列树”的**净效果**归并。A→B→A、删除后恢复到原位不留下有效待发布变更，连续重命名只显示最终名字；改变队列净结果的归并、撤销或恢复推进队列 revision，获批后审批状态据此显示为 `pending`。
- 读者可见的产品文档版本（如 1.0 / 2.0）与发布队列、单篇修订和整站 Release 是不同概念；本文不设计读者版本切换。

## 2. 重构前基线与目标差距

> 本节记录重构前旧链路，供去旧机制盘点使用；不是当前工作区实现状态。当前进展见 §0。

| 已有能力 | 重构前事实                                                                                        | 目标变化                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Doc 内容 | 稳定 `Article` 身份、可变 `DocDraft`、不可变 `ArticleRevision` / `DocBranchVersion`、`DocPublic`  | 稳定 Article 身份；内容接入 ArticleWorkingCopy / ArticleSnapshot / ArticlePublic，Doc Lifecycle 去 Branch |
| 目录     | Draft / Public `DocTreeNode`，带正反 payload 的 staged `DocTreeEvent`                             | 保留两种视图与可审阅事件；以站点而非 branch 为作用域，定义哪些事件属于队列                                |
| 发布     | `Checklist` 临时汇总所有草稿和 staged 目录事件；前端用本地 state 勾选；请求省略选择时默认选择全部 | 服务端持久队列成为唯一成员 authority；成员通过入队 / 出队 / 暂缓命令维护，发布只消费整队                  |
| 并发     | `DocDraft.version`、`DocsSiteState.tree_lock_version`、`site_draft_version` / checklist revision  | 正文用 WorkingCopy revision；目录用 Queue 行的 `tree_lock_version`；`queue_revision` 独立控制队列并发     |
| 发布结果 | 选中的文档和目录事件在一个事务内发布，写入 `DocPublishRelease`、树快照及成员记录                  | 保留事务与 Release；队列锁定、核对、消费纳入同一个发布事务                                                |
| 审核     | `PublishRequest` 是未来审核模型预留，不是可用的队列审批；已有 Doc 正文 diff 和目录事件            | 退役 `PublishRequest`，建立队列专属审批记录与不可变内容快照，提供“最近获批 → 当前队列”的增量 diff         |

历史依据：[旧 Article Revision / Draft 盘点](../feature/article/revision-draft-target.md)、[DocTree 现状](./cms-doctree-refactor.md)、`Checklist`（旧路径已在 R7 退场）、`Selection`（旧路径已在 R7 退场）、`Publish Workflow`（旧路径已在 R7 退场）、`Release`（旧路径已在 R7 退场）。旧前端选择状态已移除，当前队列入口见 [发布队列控制器](../../frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/usePublishQueue.ts)。

## 3. 目标事实与 authority

### 3.1 Docs → `Publish.Queue`

Docs 的站点身份就是整数 `community_id`。目录、Release、Trash 和公开状态均归属 Community。Gate 从认证 actor、Community、Doc Binding 和目标操作构建上下文，再核对队列及成员归属。

每个 Community 至多有一条队列。未初始化时读为空，`tree_lock_version`、`queue_revision`、`public_presentation_revision` 和 `approval_policy_revision` 均为 0，审批开关和自批开关均为 false，Release 和审批指针为 null。首个成功写入工作区目录、队列成员、审批策略或公开展示状态的命令在站点锁内幂等插入，`UNIQUE (community_id)` 是并发兜底。发布后清空成员并保留队列 UUID 及计数。现有 `CMS.DocTree.Publish` 下的发布编排接入 `Publish.Queue` 与 `Publish.Release`；前者管理待发成员，后者记录不可变发布结果。发布抽屉直接查询 Queue，旧 `Checklist`、`Selection` 和前端本地待发勾选状态退役。工作区自身可以显示未入队的改动。

| 数据             | 主键、引用与约束                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue            | `id` UUID 主键，`community_id` 为匹配 Community 主键类型的非空外键且唯一。同一 Queue 行持有 `tree_lock_version`、`queue_revision`、`public_presentation_revision`、`approval_policy_revision` 四个非负版本，以及审批开关、公开 Release 和最近审批指针；版本初始为 0，开关初始为 false，指针初始为 null 且只能指向本站对应记录。旧 `DocsSiteState` 及其目录版本退役，不迁移旧计数；其他 Docs 站点设置仍按自身职责持久化。                                                                                                                     |
| Doc 工作区       | 每个 Doc 至多有一份 D；创建新 Doc 时建立 D，发布后没有未发布编辑时允许无 D。无 Branch 的 DocLifecycle 保存可空、非空时唯一的 `default_working_copy_id`，以 `RESTRICT` 引用 D。非空时必须同 Article 且为 `default` scope；新建 Doc、D 和 Lifecycle 同事务，已公开且无 D 时首次编辑在锁内从当前 Public Snapshot 创建 D。                                                                                                                                                                                                                       |
| 正文成员         | `(queue_id, article_id)` 唯一；保存独立队列 `working_copy_id` 与最近一次吸收的默认内容 `source_snapshot_id`，两条引用均为 `RESTRICT`。两者必须属于同一篇本站 Doc；队列副本使用通用 `workspace` scope，`scope_id = queue.id`。默认副本沿用 `default` scope。记录 `enqueued_by_id`，内容变更操作者按成员和 actor 去重记录。                                                                                                                                                                                                                    |
| 目录成员         | `(queue_id, node_id)` 唯一；存相对公开树的目标节点状态或删除标记，以及用于溯源的工作区事件标识。节点状态包含父节点、整数 `index`、节点类型、名称、href、绑定的 Doc ID、`marker`、`badge`、`hidden` 以及产生该目录变更的操作者（按类型适用）。`node_id` 与 `parent_node_id` 沿用节点合同的字符串类型。按节点归并，回到公开状态时移除成员；原始工作区事件保留审计。                                                                                                                                                                            |
| 发布后待解决冲突 | `(community_id, article_id)` 唯一，`RESTRICT` 引用同一 Article 的合入基线 Snapshot 和已发布 Snapshot，记录触发时的 D revision。存在该行时禁止入队。解决后解除引用；Trash 保留该状态，永久清理时与工作区一并处置。                                                                                                                                                                                                                                                                                                                            |
| 审批与 Release   | 各自保存站点、队列 revision、公开基线 Release ID、操作者、时间、计划格式版本及可核对的结构化发布事实。审批持有正文成员的 `(article_id, snapshot_id)`、目录净计划和公开树基线引用（首次为空）；Release 持有实际发布的 `(article_id, snapshot_id)`、已公开删除的 Doc ID、不可变完整公开树快照和可空的 `approval_snapshot_id`。每种历史的正文成员按历史 ID 和 Article ID 唯一；Release 发布与删除成员集合互斥。Snapshot、树快照及审批引用使用 `RESTRICT`；所有正式历史随社区永久保留，退出当前指针不触发删除。同站点、同 Article 归属必须校验。 |

只有 Queue 的成员增减、目录净计划或正文输入 revision 变化才推进 `queue_revision`。一次原子命令最多加 1；相同请求的 Receipt 重放和队列无变化的操作不推进。默认副本保存只推进自己的 `ArticleWorkingCopy.revision`，哪怕该 Doc 已经入队。工作区目录写命令在 Community 站点锁内校验预期 `tree_lock_version`，过期时整笔拒绝。一次事务实际改变工作区目录时，该版本推进一次；纯工作区变更只推进它。若同一操作改变队列成员或净计划，须在同一事务校验依赖并另行推进 `queue_revision`。仅变更队列目录成员而未写工作区目录时，`tree_lock_version` 保持原值。Receipt 重放和无实际目录变更的命令不推进目录版本。旧 `site_draft_version`、`published_version`、`staged_event_count` 与前端 dirty 标志退出发布判断；发布抽屉只读队列 revision、正文成员和目录净变更。

| 操作                                              | 输入、写入与结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 入队（单篇或批量）                                | 输入站点、预期队列 revision 和 `[{article_id, default_revision}]`。逐篇校验 Gate、Lifecycle、来源 revision、是否有未解决的发布后冲突和可发布性；用内部 `FreezeWork` 固定默认内容，再按 fork 规则创建队列副本并登记成员和来源 Snapshot。重复 Article ID 或已入队项拒绝整批。返回新队列 revision 和成员。                                                                                                                                                                                                                                                                                                                                                                            |
| 开始编辑 / 保存默认副本                           | 编辑工作读写 D；已公开且无 D 时，通过 Docs 初始化命令在站点锁和内容锁内复核当前 Public，按基座 fork 规则创建唯一 D，再返回其 ID / revision。仅查看公开内容不创建 D。已有 D 的保存复用通用 `saveWorkingCopy`；旧 D 已删除的请求明确拒绝，不自动创建或将旧 patch 应用到新 D。发布预览继续读 Q。                                                                                                                                                                                                                                                                                                                                                                                      |
| 保存队列副本                                      | 输入站点、Article ID、预期队列 revision、队列副本 revision 和 patch；仅从发布队列的编辑入口进入，由队列成员解析 Q，复用基座保存步骤与可信正文入口，同事务推进队列 revision。通用写入口不得绕过 Docs 队列编排直接保存、删除或发布该副本。                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 合入默认内容                                      | 输入站点、Article ID、预期队列 revision、默认及队列副本 revision。固定当前默认副本，比较最近吸收的来源 Snapshot（基线）、本次来源 Snapshot 和当前队列副本。按内容字段合入，正文 Body Document、tag 集合和 CoverEdit 画布分别作为整体比较。同一字段只有来源变更时取来源，只有队列变更时保留队列，双方结果相同时保留该值。双方改成不同值时返回冲突字段和当前版本，整个命令回滚；作者可按冲突字段显式选择取来源或保留队列后，以同一组预期版本重新提交新命令。成功时更新来源引用；只更新合入基线时不推进队列 revision。相等比较按实际保存内容，忽略副本身份、画布行 ID 和审计字段。保留选中版本的整份 Body Document，复制可变画布时使用队列自己的画布，重新按合入结果同步 Asset 引用。 |
| 出队                                              | 输入站点、Article ID 和预期队列 revision。按下方统一的 Q 丢弃规则确认。服务端解除成员引用、回收无其他成员依赖的目录壳节点并删除队列副本；保留默认副本与已固定历史。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 目录暂缓 / 恢复入队 / 撤销 / 删除 / 从 Trash 恢复 | 输入站点、节点或删除事件 ID 及预期目录与队列 revision。暂缓仅移除队列变更，恢复入队把当前工作区中指定的可发布目录改动重新纳入队列，撤销将工作区对应改动恢复到公开状态。删除、恢复按 §1 维护 Trash、稳定节点身份和队列效果。任何因该操作被移除的 Q 都适用下方统一的丢弃规则。队列受影响时，成员、目录、Trash 和 revision 同成同败。                                                                                                                                                                                                                                                                                                                                                 |

以上写命令沿用已认证 actor 与 `command_id` / Receipt。批量导入 apply 原子写工作区和来源映射；显式批量入队走同一入队命令。正文入队只把新页面及缺失的父链作为目录依赖；对已有公开节点，目录位置以队列树或公开树为准。每次队列目录变化以公开树叠加持久目录成员求出目标树，校验父链闭合、无环、节点与 Doc 归属、顺序、路径唯一性，以及未公开页面必须有对应正文成员。若自动入队依赖已暂缓的节点变化，拒绝该次队列变更并返回阻塞项；作者可先恢复依赖入队。批量导入留下的目录变更通过正文显式入队纳入必要依赖，其余可发布目录改动由作者单独显式纳入。已公开节点被排入删除时，同一事务先移出受影响的正文成员，保留默认副本供恢复。恢复节点时不自动重新加入正文。发布后以新公开树为基线重算工作区差异，保留未入队和暂缓的编辑。

**D 的生命周期（R5 已实施，验证边界见 R5 记录）。** D 是按需存在的默认编辑副本，不是每篇已公开 Doc 的必有记录。新建未公开 Doc 必须创建 D；入队、Q 编辑 / 合入和冲突期间 D 必须存在。只要没有未发布编辑，整队发布可以在同一事务解除 Lifecycle 对 D 的引用并删除 D 及其正文、tag、CoverEdit 和 Asset 引用。判断使用下文三方比较及完整文章状态，不能只看正文、dirty 标志或 revision 是否变化。只允许 Docs 发布内部步骤和聚合永久清理删除 D；通用删除和普通工作区命令仍拒绝直接删除 D。

再次编辑已公开且无 D 的 Doc 时，在站点锁、Article / Lifecycle / Public 等内容锁内复核权限、Trash 状态和当前公开 Snapshot，再从该 Snapshot 创建 D 及其独占 ArticleBody，写回 Lifecycle 引用；并发初始化只产生一个 D，不另开嵌套 Receipt 命令。保存 D 与发布删除 D 通过同一 Article / WorkingCopy 锁串行；先保存则发布比较最新内容，先删除则旧 ID 保存失败，不能自动重建并套用旧 patch。新 D 使用新的 ID，旧 ID 加旧 revision 不能命中新 D。

Trash 软删除保留已有 D、Lifecycle、节点关系和冲突，不为无 D 的干净公开 Doc 凭空创建草稿。删除发布撤销 Public / PublicBody 前，若 Trash 中没有 D，必须从最后公开 Snapshot 创建恢复用 D 并登记引用，与公开删除同事务提交；避免删除公开投影后丢失恢复来源。发布前恢复干净 Doc 可继续无 D；发布后恢复使用保留的 D，重新发布需显式入队。永久清理解除引用并销毁允许删除的工作区，审批 / Release 保护的 Article 身份及 Snapshot 保留；无 D 时跳过副本清理。未公开且不可从 Public 初始化、活动 Q 或冲突存在却无 D，以及 D 归属不匹配，仍属于不变量错误并回滚。

**Q 的丢弃确认。** 出队、单 Doc 删除、单节点删除、父节点级联和批量删除共用同一前置校验。用下方字段比较规则逐项比较 Q、最近吸收的来源 Snapshot S 和当前 D。存在字段同时满足 `Q[field] != S[field]` 且 `Q[field] != D[field]` 时，该 Doc 有 Q 独有编辑。仅 D 改过、或 D 已保存与 Q 相同的修改时无需确认。命令锁定受影响副本并复核队列 revision，返回需确认的 Doc ID 和 D revision。确认请求绑定原操作、队列 revision 和该批 Doc 的 D revision；受影响集合或版本变化时重新校验。缺少确认时整批无写入。成功发布已将 Q 固定为历史，消费队列适用发布流程。

出队、删除或发布消费先解除队列引用，再用基座删除步骤清理副本。出队和删除保留已有默认副本供继续编辑或随 Trash 恢复，使无 Public 时删除 Q 不触发 `last_unpublished_work`；成功发布清理 Q 后可按上述规则删除干净 D，此时已有 Public。仍有活动外部引用时回滚并返回 `work_in_use`。通用删除同时命中最后一份未公开副本和活动引用时，沿用基座的 `last_unpublished_work` 优先级。若永久清理会碰到审批或 Release 保护的 Snapshot，保留历史所需的 Article 身份及 Snapshot，仅清理允许删除的工作区记录。用真实 FK 行为测试验收，业务读写使用 Ecto。

队列写入必须区分过期版本、已入队或成员不存在、合入冲突、依赖阻塞、内容不可发布、权限拒绝和受引用保护；B0 把这些结果映射到现有或新增的稳定 API 错误。调用端遇到过期版本需重新读取，遇到合入冲突按字段提示作者。Queue 读取至少返回站点、队列 revision、正文成员及其副本 revision、目录净改动及推导的审批状态。旧发布时勾选子集的交互改为先调整队列，再提交整队。

#### 目录类型、排序与依赖

工作区和队列目录使用相同的完整节点状态。节点的 `marker`、`badge`、`hidden` 变更与名称、链接和排序一样参与净效果、审批 diff、结构化计划、公开树快照及发布。公开读取和队列预览按各自的节点状态渲染这些字段，回到公开值时不保留净成员。

Link 是 Group 下的导航链接，Pin 是 Tab 下的独立链接。创建、改名、改 href 或排序时，父链可发布且 href 合法才自动入队。移除已公开节点时，删除自动入队。Link 和 Pin 可为外部 URL；本轮按 href 保存，两者没有 Doc 目标外键，删除 Doc 不按 URL 猜测并删除链接。若独立 Link / Pin 的 href 恰好指向被删除的 Doc，链接仍保留，访问原地址可返回 404；作者可单独修改或删除链接。父节点删除时按真实父子关系处理子 Link / Pin。父链尚未就绪的变更留在工作区，父链纳入队列时重算依赖。批量导入仍按 §4 的显式入队规则。

发布目标树的合法 href 为有非空主机且无用户信息的 HTTP / HTTPS 绝对地址，或无 scheme、无 authority 的相对地址（包括路径、query 和 fragment）。不接受协议相对地址、其他 scheme、反斜杠、空白或控制字符，以及格式错误的 URI；长度最多 400 字符。该校验适用于 Link 和 Pin，工作区可保留不合规值供作者修正，但不得入队或发布。

沿用整数 `index`。根 Tab 单独排序，同父 Group / Page / Link 共用导航顺序，同 Tab 的 Pin 单独排序。移动、插入或删除从各视图自己的兄弟集合计算顺序，并在同一事务写回受影响组；跨父移动同时重排源组与目标组。队列视图用公开树和队列成员计算，暂缓节点的工作区顺序不参与。纯编号挪动归入触发操作，审批展示实际增删和相对顺序变化。

发布保持既有节点的物理行身份；为满足即时生效的兄弟位置、名称和 Page 绑定唯一索引，事务内先将受影响行暂存到不冲突的临时状态，再写入完整目标，失败全部回滚。

沿用现有目录的 Group 优先规则：同父导航中 Group 排在 Page / Link 之前，插入和移动的位置限制在对应区间；Pin 不与导航共用位置。当前 [纯排序计算](../../backend/api/lib/groupher_server/cms/doc_tree/publish/tree_order.ex) 返回完整目标树和所有受影响节点，接入命令时仍须在站点锁内持久化净变更、处理 Trash 和确认，并验证事务回滚。

#### 合入比较与发布后 D 处理

合入和发布后 D 处理使用同一份字段比较规则。先构造类型明确的完整内容值，再对结构化值用 RFC 8785 规范化。JSON 对象忽略键序，数组保留顺序，tag ID 集合按 ID 排序；保留 Plate 节点 ID。Body Document 是原子合并单元，以 ArticleBody 的规范化 Plate JSON 和 `schema_version` 判等。Markdown、HTML、TOC、纯文本和缩略图等派生输出不参与冲突判定；选择一侧时整份复制，派生输出与所选内容一起保存。正文语义相同时，普通合入保留目标侧已保存的完整正文；发布后需保留的合并结果采用所选侧的完整正文；无未发布编辑的 D 直接清理。CoverEdit 比较画布尺寸、格式和实际图层及背景，忽略持久行 ID 与审计字段。缺省值先按基座字段定义补齐，`null`、空字符串和空数组按字段类型保留区别。

普通浅色封面的 URL 与对应 `cover` Asset 引用构成一个比较和选择单元，深色封面的 URL 与 `cover_dark` 引用构成另一个单元；同一单元的 URL 和资源身份从同一侧选取，不能在合入时混搭。附件引用另作为整体比较。封面 Asset ID 单独改变也属于 Q 内容变更，需要登记贡献者，并参与出队确认与合入冲突；保存应在同一事务同步对应引用。

Article 基座的 `asset_refs` 输入只接受独立的 attachment；正文、类型封面与 CoverEdit 引用由最终内容派生。attachment 集合作为原子比较单元，比较每条引用的 `asset_id`、`usage`、`position`、`block_id`、`block_type`、`alt`、`title`、`source`、`meta`，忽略引用行身份并按内容排序；选择来源或目标时保留整组 attachment。合入时由保存步骤从选定内容重建正文和封面引用，并校验最终引用及站点资产准入；失败则整笔回滚，不能静默丢弃独立引用编辑。

正文派生的引用使用保留的 `source = "plate"`；独立 attachment 输入不得使用该来源。重建引用时只保留非 `plate` 的独立 attachment，并从当前正文重新派生正文引用；内容比较同样排除正文派生 attachment，避免重复计入或正文删除后残留。此规则属于新基座合同，不补历史数据兼容。

已有正文内联实现的阶段说明：`WorkingCopy.Store.save_loaded` 从外部 BodyBag 构造正文，会将 `body_xml` 和 `body_rss` 置空，不能直接用于复制已保存的完整 Body Document。基座内部 `save_stored_body_loaded` 从同 Article 已保存 WorkingCopy 或 Snapshot 读取完整正文，复用 revision、typed 字段、tag、CoverEdit 与引用同步；WorkingCopy 来源还需匹配其 revision，通用外部输入继续走 BodyBag 验证。本轮改接 ArticleBody 后仍须保留完整正文复制语义；Docs 调用方必须在站点锁内校验来源 / 目标归属、前置 revision 和授权，跳过完全相同的写入；整笔命令的并发与回滚须单独验收。

内部 `save_merged_loaded` 额外接收合并步骤选中的完整封面引用，保留引用的资源身份和元数据，并重新校验本站资产准入；它不是通用输入入口。调用者须在锁内从已校验的内容持有者读取选择结果，不得信任外部提供的引用。重复封面类型、无效或跨站资源使保存失败，调用事务须回滚正文、revision 和所有引用。

对本次发布的正文成员，发布锁定 D 和 Q，以 Q 最近吸收的来源 Snapshot 为基线，比较当前 D 与实际发布 Snapshot。D 相对基线没有变化，或双方完整结果相同时，D 没有独有未发布编辑：发布成功后删除 D，不先做无意义的 fast-forward 保存。双方修改不同字段时合并；合并结果仍区别于发布内容则保存并保留 D，否则删除 D。双方把同一字段改成不同值时，保留 D 原样并登记待解决冲突，发布照常提交。判定覆盖标题、正文、tags、封面、CoverEdit 和资产引用等完整状态；普通比较沿用前述规范化规则。

D 保留、删除、Lifecycle 引用更新、冲突登记、Public / PublicBody 和 Queue 消费必须在同一发布事务中完成。保留且实际写入 D 时复用基座保存步骤，推进一次 D.revision；没有内容变化则不写入。删除 D 后旧编辑器的保存必须失败。冲突解决命令核对当前 D ID / revision、Public Snapshot 和冲突记录，以最新 D 重新比较并逐字段选择；仍有未发布内容则保存并保留 D，结果已与公开内容一致则清除冲突并删除 D。冲突期间允许继续保存 D，不允许重新入队。

R5 的 `AlignDefault` 先比较完整状态并标记干净结果；Queue 消费解除 Q 与成员引用后，才删除干净 D 并清空 Lifecycle 引用。`ResolveConflict` 的结果已公开时同事务清冲突并删除 D，否则保留未发布编辑。隔离验证覆盖无 D 读取、显式初始化、旧 ID 拒绝、Receipt 重放及保存 / 发布交错；详见 R5 记录。

#### 队列写入边界

通用 Article Command 层对 Doc 拒绝删除 D，并拒绝创建、fork 到、保存或删除**任意** `workspace` scope，包括客户端传入的任意 UUID。普通编辑器通过 Docs 初始化入口取得 D 后，只通过通用保存入口写该 D。每篇 Doc 至多一份按需 D，以及在活动成员存在期间由 Docs 内部命令创建并登记的 Q；内部目标 scope 由服务端从本站 Queue ID 推导。直接发布 Doc 一律走 Docs 整队命令，包括用 Snapshot ID 的通用发布请求。校验适用于 GraphQL、Publisher 和其他通用调用入口。Docs 命令校验队列归属和版本后复用同事务内部步骤。Q 的删除仍须先解开成员引用，通用拒绝之外再用真实外键验证删除保护。

**读入口。** 通用 `article_working_copies` 对 Doc 最多返回经 `:edit` 准入的 D，通用 `article_snapshots` 和按 ID 的通用管理读取不返回 Doc Snapshot。管理侧 Doc Snapshot 查询经 Docs 专属入口执行，按来源和用途校验权限。读取 Q、队列预览和审批正文使用站点级队列预览准入，并逐 Doc 校验 Gate 可见性；编辑 Q 还须有队列写权限和该 Doc 的编辑权限。读取 Release 历史另行校验 Docs 历史读取权限；公开正文读取 ArticlePublicBody，其内容与 ArticlePublic 选中的 Snapshot 在发布事务内保持一致。B0 在 Gate 盘点中逐项列出具体 action、resolver、直接 ID / 嵌套入口和拒绝用例。只拥有 Doc `:edit` 时，无法通过通用或专属入口读取 Q 或审批 Snapshot。

队列权限按站点定义为以下独立 Gate action / Passport grant；这些名字是新合同，B1 / B2 需同时登记 Gate、Passport registry、跨端生成合同和管理授权界面。站点读还须通过 Community 生命周期读取准入，站点写须通过写入准入；不从一个 grant 推导另一个 grant，也不因 Doc 作者身份自动获得站点权限。

| Gate action             | Passport grant        | 适用入口和额外准入                                                                                               |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `:docs_queue_preview`   | `doc.queue.preview`   | Queue、Q、计划预览及审批正文读取；逐 Doc 校验管理侧可见性。                                                      |
| `:docs_queue_write`     | `doc.queue.write`     | 入队、出队、Q 保存和合入；凡读取或修改 Doc 内容的命令同时检查该 Doc 的 `:edit`；返回队列内容时还须检查预览准入。 |
| `:docs_queue_approve`   | `doc.queue.approve`   | 固定审批 Snapshot；同时检查预览准入、各成员可见性及贡献者自批限制。                                              |
| `:docs_queue_publish`   | `doc.queue.publish`   | 发布整队；同时检查各成员的发布准入、依赖与审批状态。                                                             |
| `:docs_queue_configure` | `doc.queue.configure` | 修改是否要求审批和是否允许自批；仅配置权限不能批准或发布。                                                       |
| `:docs_history_read`    | `doc.history.read`    | Release 历史及关联 Snapshot；逐 Doc 校验历史内容可见性，已永久清理的身份只能在此授权入口解析。                   |

重构前权限盘点：旧 Community `:manage_docs` 的 `docs_member?` 分支对任何已登录用户返回 true，它只代表旧目录管理准入，不能作为上述权限的替身。当时旧 `article_working_copies` / `article_snapshots` / `article_snapshot` resolver 均只检查 Article `:edit`，其底层 Query 按 Article 返回所有 scope 或 Snapshot。新合同要求在可复用的授权查询边界过滤 Doc 的非 D 副本，拒绝通用 Doc Snapshot 列表和单项；同时审计按 WorkingCopy / Snapshot ID 的直接获取、嵌套字段及命令确认恢复，不能只在列表 resolver 过滤。专属入口根据来源重新加载并校验，不信任客户端传入的 ID 或预先加载的 struct。权限拒绝、跨站 ID、仅有 `:edit`、只有预览、只有历史权限和授权撤销后重放 Receipt 都应通过真实 GraphQL / Command 路径验收，且不得通过错误差异泄露受限正文。

通用 Query 已对 Doc 限定 D 并隐藏 Snapshot；通用保存拒绝 workspace，删除、Snapshot fork 和发布拒绝 Doc，错误为 `docs_managed_content`。Doc 保存结果呈现时重新检查 `:edit` 和 D scope。真实 GraphQL 已验证仅有 Doc 编辑权限时只能读取 D、无法按 ID 读取 Snapshot 或保存 Q，以及撤销权限后 Receipt 重放不返回 D 内容；专属 Queue 入口已接入，仍需补齐权限、跨站和所有嵌套入口的完整验收。Doc Gate 的新主路径已改接无 Branch Lifecycle / Public；其他旧 Access 调用与接口仍须逐项清理，不能由此推断 Branch 已完全退役。

### 3.2 审核与增量 diff

批准命令输入站点和预期队列 revision，在站点写入锁内检查审批 Gate、审核已启用、队列非空、版本匹配、各 Doc 与目录的准入及可发布性，对队列每篇 Doc 的确切 WorkingCopy revision 调用内部 `FreezeWork`。同一事务写入审批记录及其 `queue_revision`、计划格式版本与结构化计划、目录基线与净计划及 ArticleSnapshot 引用，固定审批后更新 Queue 的 `latest_approval_id`，返回 `approval_snapshot_id`。该指针是最近一次成功审批的确定性来源，不按时间或 UUID 推断先后；失败事务和 Receipt 重放不改变指针。正文、元数据、CoverEdit 和已有 Asset ID 引用由 ArticleSnapshot 固定并受其引用保护。队列 revision 变化或发布消费后指针仍保留以供增量 diff，审批是否有效仍按当前 revision 等条件推导；日常清理、出队和 Trash 不得移除被引用的历史。

首次审核没有获批快照时，以**当前公开站点 → 当前队列**为比较基线；再次审核默认比较**最近一次获批快照 → 当前队列**，包括正文、标题等元数据、目录净效果以及新增 / 移出成员。再次批准后更新基线；在此之前继续修改时，比较基线不前移。作者仍可查看“当前公开内容 → 当前队列”的发布效果 diff，两种比较不能混用。关闭审核的站点只有发布效果 diff，没有虚构的获批基线。

站点默认不要求审核，以支持随写随发；启用审核时，具有独立批准权限的人才能批准，默认不得批准自己的入队改动（若站点确需自批，须显式配置并留痕）。审批在锁内取当前待发成员的贡献者并集。正文计入入队者和实际改变 Q 内容的保存或合入操作者；仅保存 D 的操作者不计入。正文贡献者在本次成员存续期间累计，回改内容不移除作者；例如 B 修改 Q、C 改回原值，B 和 C 仍受自批限制。出队或发布消费后清空该成员的贡献记录。目录净变更计入产生当前净变更的操作方，重排派生项沿用触发者。成员移除或目录净变更消失后，其贡献退出并集。A 入队、B 改 Q，默认两人都不能批准。审批记录固定参与判定的作者集合。批准只对应快照，不授予额外发布权限；发布者仍须通过 Gate。审核启用时的状态枚举固定为 `idle / pending / approved / needs_reapproval`：空队列为 `idle`；有成员而获批 revision 不符为 `pending`；revision 对齐、计划格式受支持且当前结构化计划与批准事实逐项相符才是 `approved`；计划格式不受支持或结构化核对不符为 `needs_reapproval`，禁止发布，同 revision 下结构化事实不符另记一致性错误。`approved` 只表示审核成立，实际发布仍须通过 Gate、源版本和目录依赖检查。关闭审核的站点不生成批准状态或快照，审核状态字段为空。批准成功或队列写命令使审批从有效变为 `pending` 时，在事务内登记 Outbox 并于提交后通知相关队列参与者。计划格式支持范围变更或读时检测到计划不一致导致的 `needs_reapproval` 由查询返回提示，读取不发通知；发布在锁内复核并拒绝。通知失败不改变审核事实或阻止发布。审批策略、权限、通知接收人和无审核模式的状态值须在 B0 固定为合同。

Queue 持有 `approval_required`、`allow_self_approval` 和非负 `approval_policy_revision`，初始分别为 false、false、0。配置命令取得 `:docs_queue_configure`、站点锁和预期策略 revision 后写入；任一策略值实际变化时 revision 加 1，同事务记录操作者、旧值、新值和命令 ID 的 Activity。无变化或 Receipt 重放不推进。审批记录固定当时的策略 revision 和 `allow_self_approval`；有队列成员且当前策略 revision 与最近审批不一致时状态为 `pending`，即使队列 revision 未变。关闭审批时状态为 null，再启用时必须重新审批，不能复用关闭前的批准。策略修改不推进 `queue_revision` 或公开展示版本；有效批准因策略变更失效时由配置命令在事务内登记 Outbox，提交后通知当前队列参与者。状态缓存键和发布锁内校验都包含策略 revision。

状态查询先用队列是否为空、获批队列 revision 和策略 revision 是否对齐做廉价判断；仅对齐时才校验版本与结构化计划。计算结果可按站点、`queue_revision`、`approval_policy_revision`、`approval_snapshot_id`、`public_release_id`、`plan_format_version`、`planner_version` 和受支持计划格式集合的配置版本短期缓存，不写回 Queue；重新审批、策略或计划格式支持配置改变后旧缓存不可命中。发布仍在锁内独立重建并校验计划，不能信任状态查询缓存。

现有 `publish_requests` 的通用 `target_type + target_id` 和单条状态不承载站点队列 revision、逐次批准快照及历史。目标模型**退役 `PublishRequest` / `publish_requests`，新建队列专属审批记录与快照**；不复用旧表，不迁旧审批行，也不设置旧状态读取回退。

现有 `正文修订 diff`（旧路径已在 R7 退场）可复用计算能力，但它当前只建立正文比较对；目录增量可由 `DocTreeEvent`（旧路径已在 R7 退场） 的操作 payload 呈现。审核的权限、审批状态及内容锁与内容治理的 ReviewBot / AlertWall 分属不同业务流程，不共用一个含糊的 `review` 状态。

### 3.3 队列预览与公开读取

队列预览以**当前公开站点**为基线，仅叠加队列 WorkingCopy 和队列目录成员。新站点首次发布前没有 Release，统一使用 `public_release_id: null` 加规范化空树快照作为初始公开基线；没有 Release 却存在 Public head / 非空公开树时属于不一致错误，不能当作空站点。预览、首次审核 diff、结构化计划 和首次发布共用该基线，不创建虚构的空 Release。未入队 Doc 使用已公开版本；从未公开且未入队的文档在预览中不可见。预览必须包含导航、正文、链接 / 封面等会影响发布结果的投影，不能只预览单篇编辑器正文。

预览读取要求 actor-aware Gate 准入；公开查询、搜索、评论和 Press 继续只见已发布内容。**单次预览在 PostgreSQL `REPEATABLE READ` 只读事务中**读取公开 Release / ArticlePublic、队列 revision、队列副本 revision 和目录有效计划，不能依赖默认 `READ COMMITTED` 下的多次查询取得同一快照。跨页面预览请求携带固定的公开 Release、队列 revision 与公开展示版本；版本变化后提示刷新或整体重试，不能拼出跨 revision 的页面。预览缓存至少按站点、授权范围、公开 Release、队列 revision、`public_presentation_revision` 和 `planner_version` 隔离；planner 实现版本变化时清理旧预览缓存，**不因此自动撤销格式与结构化计划均未改变的审批**。ReviewBlock 可在没有新 Release 时改变公开可见性：每次队列预览及公开 Cover 响应仍须按当前 Gate 与可见性事实过滤，`article.visibility_changed` 同时触发相关预览与公开 Cover 缓存失效；异步失效尚未完成时也不能仅凭缓存命中返回受限内容。公开可见性变化不推进 `queue_revision` 或 `public_presentation_revision`。发布前在锁内再次验证队列 revision、成员源版本、目录依赖、Gate 与批准要求。

[DocCover 当前合同](../../backend/api/lib/groupher_server/cms/doc_cover.ex)没有 draft 层，写入立即改变公开 Cover；[Cover Query](../../backend/api/lib/groupher_server/cms/doc_cover/query.ex) 还从公开树和 `DocPublic.title/slug/visible` 派生 Card / Pinned 内容，而现有 [publish hook](../../backend/api/lib/groupher_server/cms/doc_cover/sync.ex) 不写 Cover 行。本轮保留作为**独立公开展示投影**：DocCover Card / Item / PinnedDoc 或影响预览的 Docs 站点设置写入时，同事务推进站点 `public_presentation_revision`；**每次成功发布也在发布事务内推进该 revision**，即使没有 Cover 行写入。该 revision 按站点独立，新合同空站点初始为 `0`，首次展示变更后为 `1`；不沿用旧版本，也不因发布 Release 而重置。队列预览从同一读取快照取得当前 Cover / 设置，并以该 revision 隔离缓存；公开 Docs Cover / 设置读取若使用缓存，也必须以同一 revision 隔离，否则不缓存。包含可见内容的公开 Cover 缓存响应返回前仍须重新核验当前可见性 / Gate；做不到则关闭该响应缓存。这些展示变更不因自身进入队列、不因 Cover 写入单独推进 `queue_revision`、不改变审批快照或有效结构化计划。DocCover 仍只能引用已公开节点；B4 停写必须一并冻结 Cover 与 Docs 站点设置写入。

队列按固定的公开 Release、持久成员、队列副本 revision 和稳定排序规则**确定性重建有效发布计划**，其中只包含带依赖顺序的“公开树 → 队列树”净操作。Queue 不持久化派生计划；审批固定结构化计划与正文 Snapshot 关联，Release 固定实际发布成员、删除成员和完整目录结果。新合同不计算或存储计划摘要，不提供预览计划摘要字段，不维护摘要算法版本或支持集合。请求仍只提交站点、command_id 和 queue_revision，不让客户端提供计划替代服务端计算。

结构化核对包括：站点 / Queue 归属、queue_revision、approval_policy_revision、公开基线 Release、计划格式、正文成员集合及每个 Q 的 ID / revision、批准 Snapshot 的 ID 与来源副本 / source_revision、完整目录基线及净操作。审批成员已有的 `(article_id,snapshot_id)` 通过不可变 Snapshot 的来源字段确定获批 Q 身份与 revision，不依赖 Q 日后仍存在。目录计划保存在审批 tree_plan 中，基线树由其 base_release_id 引用的不可变 Release 提供；首次基线为空。发布在锁内重新构建并逐项比较，不能只检查 revision；同 revision 下内容或成员不符仍拒绝并记录一致性错误。Release 的实际成员、Snapshot 与最终目录也须在记录步骤再次核对。

V1 计划对象的键为 `plan_format_version`、`base_release_id`、`public_tree`、`articles`、`tree_operations`。正文成员按 Article ID 排序，成员记录 `{article_id,working_copy_id,revision}`；公开节点按 node_id 排序；目录操作记录 node_id、action、before、target。UUID 统一大小写表示，缺省值按字段类型补齐，null、空字符串和空数组保持区别；对象键序不影响比较，数组按字段语义比较，不能按序列化后的 JSON 字符串判等。依赖拓扑排序确定操作顺序：创建先父后子，删除先子后父，移动先满足新父节点，再移除旧父节点，同层按稳定节点 ID 排序。数据库返回顺序不影响结果。非法节点、整数、字段及路径返回领域错误，不静默修正批准内容。

保留 `plan_format_version` 以表达计划结构与语义兼容性；不支持获批格式或结构化核对不符时要求重新审批，不静默转换旧批准。仅 planner 实现版本变化但格式受支持且计划等价时，旧批准仍有效；预览缓存按 planner_version 失效。预览、审批和发布使用同一计划解释规则，不能重放全部原始事件或跳过删除、移动等领域副作用。[纯计划实现](../../backend/api/lib/groupher_server/cms/doc_tree/publish/plan.ex)及审批 / Release 调用方已在 R4 改为结构化校验；实际验证与未覆盖范围见 [R4 记录](./docs-structured-plan-r4.md)，历史摘要测试不作为新设计证据。正文合入的字段比较独立于此处计划校验。

新 Release 的 `tree_json` 固定为 `{ "version": 1, "nodes": [...] }`，节点使用 `node_id` 及本合同列出的完整 snake_case 字段，空值明确存为 JSON `null`，类型使用小写字符串；节点按 `node_id` 排序。Queue upsert 的 `target` 使用相同节点字段但不重复存储 `node_id`；delete 的 target 为 null。[编码与解码](../../backend/api/lib/groupher_server/cms/doc_tree/publish/tree_codec.ex)只接受这套新格式，拒绝未知字段和版本；旧 branch 树不回读。数据库 CHECK 校验顶层对象、整数版本 1 与 nodes 数组，完整节点、父链及未知字段由编码器和命令校验。业务写入须先完成目标树验证，再保存 JSONB；驱动直接接收 map，不预先把它编码成 JSON 字符串。

计划计算额外接收同一站点、同一读取快照下的全部 Doc Public head 身份，用于一致性和依赖校验，不作为独立摘要输入：无 Release 却存在 Public head 必须失败；公开树 Page 缺少 Public head 必须失败；目标树中未公开的 Page 必须有正文成员，未公开正文成员必须有目标 Page；已公开 Page 排入删除时不得同时保留其正文成员。该输入不能使用按访问者权限过滤后的公开页面列表。站点归属、Public head 与当前 Release 是否匹配、路径唯一性、内容可发布性和 Gate 仍须由事务调用方验证。

当前公开路径以 Community 和 Binding 的 `inner_id` 为定位，slug 不是读取身份；公开编号跨 Article thread 共享。新 Doc 在首发事务前没有公开编号，而其他 Article 也可能推进同一计数器，预览不能通过读取当前计数器猜测最终 URL。队列预览导航须用受权限保护的预览路由和 Article ID 定位，新发布时在锁内分配实际编号并由 Release / 公开投影读取；目录 Link / Pin 的外部 href 不据此改写。B0/B3 仍须核实预览与实际发布的链接投影、编号分配和切换时不复用旧编号的端到端行为，纯计划尚不能证明路径唯一。

### 3.4 Publish.Queue → Publish.Release

发布请求 `PublishDocs(site, command_id, queue_revision)` 消费整条队列。成功返回 `release_id` 和消费后的队列 revision。

1. 按现有 Command Receipt 身份恢复已确认结果。首次执行时通过站点 Gate，取得站点写入锁，读取队列、当前公开基线和审核策略。拒绝空队列或过期 revision。
2. 锁内重建确定性计划，逐项校验 Gate、Lifecycle、成员版本、可发布性和目录依赖。需审批时校验获批队列与策略 revision、公开基线、计划格式和完整结构化计划，再使用获批记录持有的同一批 ArticleSnapshot，并核对 Snapshot 的来源副本与 revision；无需审批时在本事务固定每个队列副本的精确版本。失败返回权限、revision、依赖或需重新审批等对应领域错误。
3. 调用 Docs 改接后的内部 `SelectPublic`，将选中 Snapshot 的 ArticleBody 完整复制到 ArticlePublicBody，同时更新 ArticlePublic.snapshot_id；两者来源必须一致。首次发布同时完成稳定公开定位和必需的运行时初始化。应用目录领域操作与公开删除；记录实际发布的 Snapshot、删除项和完整树结果，写入 `Publish.Release` 并更新 `public_release_id`。目录删除先处理其依赖，按 §1 保留未公开草稿的回收关系。

4. 按 §3.1 保留有未发布编辑的 D 或登记冲突，解除队列引用并清理 Q；无未发布编辑时解除 Lifecycle 引用并删除 D，清空成员，推进 `queue_revision` 与 `public_presentation_revision`，确认 Receipt 并登记提交后 Effects / Outbox。步骤 1–4 的新写入由同一事务提交；失败时保留原 Public / PublicBody、D、目录、队列与审批结果。搜索、Press、缓存和通知消费提交后的事件。

实现与验证进展见 §0 和附录 A；内部原语、外层命令及正式表接入的早期证据见附录 B。以下继续定义删除、锁序、历史读取与副作用约束。

已公开 Doc 排队删除后、Release 提交前，公开 Lifecycle / Public 与读者 Gate 保持当前公开状态；工作区 Trash 以 Trash 记录和目录草稿表达，不提前把公开 Lifecycle 标成 deleted。整队发布删除时在同一事务撤销公开读取并转入 deleted；发布前恢复则撤销待发布删除并维持公开状态。从未公开的 Doc 可在进入 Trash 时转入 deleted。上述状态转移由 Doc Lifecycle 命令执行，审核限制仍由 Review 负责。

入队、队列保存、合入、目录、Trash、审批、发布和发布后冲突解决共享站点写入锁。冲突解决先取站点锁，再锁定 Article、D、Public，最后锁定冲突记录；在锁内复核 D revision、Public Snapshot 与冲突记录仍匹配，再复用基座内部保存步骤写入 D。实际写入时推进一次 D revision 并同步 tag、CoverEdit 和 Asset 引用；解析结果与已保存状态相同则跳过写入并保留 revision。保存与解除阻塞同成同败。先取得站点准入与站点锁，再读取队列及目录状态；随后按稳定 ID 获取涉及的资源锁，内容锁沿用 Article 基座顺序。涉及多个 Article 时先按 Article ID 获取同层锁，执行前复核无锁阶段发现的归属。B0 用现行 Gate / Lifecycle、Import、Cover、清理和任务写入口核对完整锁序，列出每条命令的锁与事务归属；在任何会逆序获取站点锁的入口完成调整前，不接入 B1 写入。默认副本保存只用基座的资源锁，持有资源锁后不反向获取队列锁。

锁入口盘点与目标顺序（旧入口描述用于识别待清理路径，不代表新工作区命令仍使用 branch 锁）：

| 入口                 | 当前锁或事务事实                                                                                   | 新合同要求                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Receipt 命令         | `Command.Receipt.Runner` 在事务内先认领 / 恢复 Receipt，再执行 Gate 回调；恢复分支不重跑写入回调。 | Receipt 认领排在领域锁前；站点锁内不得再发起另一条独立 Receipt 命令。恢复结果若含受限内容，present 阶段重新执行对应读取准入。                                |
| Community Gate       | `Gate.Access.Load.Query.community` 加载 Passport 并对 Community Lifecycle 取 `FOR SHARE`。         | 写命令在 Receipt 之后先做站点 Gate，再在同一事务取得 `SiteLock`；后续只调用已授权的内部步骤。生命周期变更不得持有站点锁后反向请求 Receipt。                  |
| D 保存 / Freeze      | `WorkingCopy.Store` 和 `Snapshotter` 先锁 Article 行，再锁 WorkingCopy；Freeze 然后固定 Snapshot。 | D 保存不请求站点锁；站点命令先取站点锁，再按 Article ID 稳定顺序取 Article / 工作副本等基座锁，不在持有 D 锁时反向取得站点锁。                               |
| Content Import apply | 目前先锁 Import Job，再取 `doc_tree:<community>:<branch>`，随后锁 items / bodies 并写目录。        | 改为站点准入、站点锁、Queue 后再锁 Job / items / bodies 并复核状态；纯 staging / cancel 只锁 Job，不得在持锁后进入站点写路径。完成态重放不重新执行导入。     |
| Tree、Trash、Cover   | 旧 Tree 使用 branch 目录锁；Trash 下还取 Doc 锁；Cover 在自身 Persist 中锁 Cover 行。              | 均先获取同一 Community 站点锁，移除 branch 锁，再按 Queue、受影响 Article、目录 / Trash / Cover 的确定顺序锁行；父子批量操作先枚举并排序后锁定，再复核集合。 |
| Snapshot 清理        | 按 Article → Public → Snapshot 锁定并检查引用，不取站点锁。                                        | 保持该方向，清理不得反向请求站点锁；审批、Release 和冲突记录的 FK `RESTRICT` 是最终引用保护。                                                                |

站点锁原语为 `DocTree.Publish.SiteLock.acquire/1`，key 为 `docs_site:<community_id>`，必须运行在调用者事务内。两条独立数据库连接的隔离测试验证同站点串行、不同站点可并行及回滚释放。上述入口表尚未覆盖所有 Gate、投影、维护与导入调用方，也不证明新命令已遵守该顺序；B0 全量盘点和实际命令并发验收仍是接入前置条件。

公开详情正文读取 ArticlePublicBody，元数据和当前公开目录按 ArticlePublic 选中的 Snapshot 及当前 Gate 解析，Release 用于发布历史及站点发布基线。新合同下单篇永久清理保留正式历史所需的 Article 身份与 Snapshot，直至社区删除，不以是否仍被审批或 Release 引用作为到期判断。清理事务移除 Public / PublicBody、公开定位与绑定，并关闭 Doc 的读权限；剩余身份仅供授权的 Docs 历史入口解析。通用详情、按 ID 查询、Search 和 Press 返回前按当前公开事实过滤，待处理的投影失效与缓存命中均不能绕过该检查。投影任务重试时复核公开事实，防止旧任务重建已删除页面。历史按本次发布涉及的 Doc、删除和完整树结果查看。单篇内容恢复从 ArticleSnapshot fork 到可编辑副本；Trash 恢复与 Receipt 恢复沿用各自命令。

普通 Article 基座的 [WorkingCopy Publisher](../../backend/api/lib/groupher_server/cms/articles/working_copy/publisher.ex#L29) 仅支持 Post / Blog / Changelog，Docs 新路径由整队 Release 编排内部 Public 选择；`旧 Doc 发布路径`（旧路径已在 R7 退场）仍是退役盘点对象。以下矩阵用于核对新路径的副作用覆盖，具体已验证范围见 §0 和附录 A。矩阵须逐项补齐拥有命令、触发条件、同步写入或 Outbox、去重键、失败与重试验证。

| 领域                          | 首发、再发布及公开删除要验证的边界                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| 公开定位、Lifecycle、评论父级 | 首发建立稳定定位和公开资格；再发布保留身份；删除撤销可见性，验证旧入口及嵌套评论读取。     |
| ArticleStats                  | 首发初始化且 Receipt 重试不重复；再发布保留计数；删除按统计读路径收口。                    |
| ArtimentMentions              | 同事务按实际选中的 Snapshot 更新来源；再发布核对边增减；删除清理来源并验证图读取及失效。   |
| 内容审核                      | 按 Doc 内容和可见性规则登记审核；再发布和删除校验旧审核任务不能覆盖新状态。                |
| Search、Press、缓存           | 同事务登记提交后投影或失效；验证首发可检索、再发布刷新、删除移除，以及重复执行和失败重试。 |
| Activity、通知                | 逐项确认哪些发布事件需要记录或通知，固定事件身份、接收人和去重；事务回滚后无对外事件。     |

重构前旧路径的盘点证据（不代表新 Release 使用这些身份）：`Articles.Publish.Doc.publish/4` 在事务内分配主站公开定位、创建版本和 Public、调用 `ArticleStats.initialize`、更新 Lifecycle、登记 Review、调用 `ArtimentMentions.update`，并登记 `article.published` / `article.updated` 和 `article.projections` Outbox；这些事件当前的键与 payload 包含 branch 或旧 revision。`Articles.Effects.Publish` 在提交后处理首发管理员通知、作者投影和 Doc Activity，`Articles.Effects.Outbox` 再扇出 Press、Search 和 CDN。新链路必须重新定义基于 Release / ArticleSnapshot 的身份和去重，不得复用 branch 身份；以上只是旧路径证据，还不代表删除路径、接收人或重试语义已盘点完成。

下表固定新合同的事务和重试边界；它描述 B3 / B4 的交付要求，不是逐项验收结果；已实现和已验证的范围见 §0 与附录 A。`release_id` 由同一发布事务创建，单 Doc 的发布成员身份为 `(release_id, article_id, action)`；所有 Outbox 的 `identity` 使用原发布命令 ID，`effect_key` 带此成员身份和效果类型，Receipt 重放不得再次登记。派生子事件使用父 Outbox ID 和子效果类型，不能只以 Article ID 覆盖不同 Release。

| 效果                                  | 所有者与首发 / 再发 / 删除规则                                                                                                                                        | 原子性、重试和验收                                                                                                                                                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 公开定位、Public、Lifecycle、评论父级 | 整队发布 Command：首发分配 Binding inner ID 并选择 Snapshot；再发保留定位并切换 Snapshot；删除撤销 Public 和读者可见资格，评论身份保留或清理由 Trash / 永久清理负责。 | 与完整树、Release 和 Receipt 同一事务；任何一项失败全部回滚。评论及其嵌套读取由当前父级 Gate 判定，不以缓存中的旧父级放行。                                                                                                                            |
| ArticleStats                          | 整队发布 Command 对首发执行 `ArticleStats.initialize`；再发不覆盖计数；删除后读取按公开资格过滤，永久清理按聚合处置。                                                 | 现有 initialize 使用 `(thread, article_id)` 冲突忽略；同事务执行，失败回滚。重复发布与 Receipt 重放不能重置计数。                                                                                                                                      |
| Mentions                              | 整队发布 Command 以实际选中的 Snapshot 更新 Doc 来源；删除时在发布事务内撤销来源可见性并使图版本失效，永久清理再按端点保留策略处理。评论来源分别受父级可见性约束。    | 复用 `ArtimentMentions` 的事务内捕获与持久化，身份改为 Release / Snapshot；同事务登记 Mention 通知 Outbox。重复、乱序、删除后旧任务重试均不得恢复已隐藏关系或重复通知。                                                                                |
| 内容治理                              | 整队发布 Command 基于实际 Snapshot 注册 Review；首发和再发分别使用 publish / edit，删除及永久清理令旧请求失效并关闭 AlertWall 目标。                                  | 审核事实与发布同事务，异步执行以固定 Snapshot / 请求身份去重；过期任务必须复核当前作用域和版本，不能覆盖新 Public。发布队列审批与 ReviewBot 为独立流程。                                                                                               |
| Search / Press / CDN                  | 发布与删除事务分别登记可区分 action 的 Outbox；提交后消费者按当前 Public、Lifecycle、Gate 和绑定重新判断 upsert / delete 与缓存失效。                                 | 父事件按成员身份和类型去重；Search、Press、CDN 使用各自子事件，失败独立重试，旧 upsert 不得复活删除或受限页面。验收包含回滚、乱序、重复和投影停机恢复。                                                                                                |
| Activity                              | 发布 Command 在事务内按每个发布 / 删除成员记录事件，元数据包含 Release 与 Snapshot；不能用消费时的最新 Public 代替该次事实。Trash 和永久清理由各自命令记录。          | 以命令 ID + 成员 + 事件类型作为稳定身份；同一事务回滚或 Receipt 重放不得重复。历史按真实提交顺序和受限读取权限展示。                                                                                                                                   |
| 发布通知                              | 首发向当时符合接收条件的社区管理员发一次通知，再发不发首发通知；队列审批变化通知当前相关贡献者。删除不复用首发通知。                                                  | 事务内固定事件身份并登记 Outbox；投递按事件 + 接收者去重，失败可重试，撤权或删除后发送前复核可见性。当前 `Messaging.Notify.dispatch/2` 只是返回成功的占位实现，没有实际投递或去重；B3 须接入真正的通知持久化与接收者判定，不能将占位调用当成验收通过。 |

上表确定事件与事务边界，但现有 Search / Press 的删除事件、通知持久化和 Review 新身份尚未实现；B0 仍需逐个映射具体调用与表并完成端到端演练，不能依据此表宣称切换就绪。

已核对的切换风险与改接要求：

- `DocTree.Persist.Trash.trash_subtree` 目前删除 draft 和 public 子树、使 Doc Lifecycle 进入 deleted，并直接提交搜索删除；`Docs.Trash` 永久删除旧 branch 数据时撤销 Review / AlertWall 和隐藏 Mentions。这些是旧合同，B1 / B3 必须拆除前者对公开事实的即时修改：已公开 Doc 入 Trash 到删除 Release 提交前，公开节点、Public、Lifecycle、Mentions 和搜索资格保持不变；真正的公开删除由整队发布在同一事务撤销公开资格并登记必要的异步失效。未公开 Doc 与永久清理按各自生命周期处理。父节点、单节点和单篇 Doc 删除均覆盖此规则。
- `CMS.Outbox.Workflow.Article` 的旧 Doc `article.projections` 会按事件中的 branch 重读当前 DocPublic 和版本，无法证明重试时读取的是该事件产生的版本。新发布事件必须携带 Release、Article 和实际 Snapshot 身份；Activity 和通知按该提交的事实及稳定事件身份去重，不能以消费时的最新正文替代。Search、Press 和缓存刷新则复核**当前**公开资格与当前 head，过期发布事件不得重新暴露已删除或受限内容。Receipt 重放不得再产生新的事实事件，乱序及重复投递必须验证。
- 切换前排空清单至少包括 `CMSOutboxArticle` / `CMSOutboxComment` / `CMSOutboxCommunity` / `CMSOutboxInteraction`、`CMSOutboxSearch`、`CMSOutboxPress`、`CMSOutboxCDN`、`CMSMentionNotifier`、审核任务和直接 SearchIndex 任务；Interaction 事件会投递通知并可能入队搜索更新。这些 worker 使用共享队列，必须按事件或任务的 Doc 归属筛选并核对进行中工作，不能清空共享队列或取消其他内容的任务。上述清单仍须与 Import、Trash 定时清理及所有投影生产者的全量扫描结果合并，不能作为已完成的排空证明。

## 4. 去 Branch 的边界

本轮正文表修订的切换盘点增量：ArticleBody / ArticlePublicBody 属于共享 Article 基座，Docs 清理必须按 Doc Article ID 与 owner 归属定位行，不能整表清空；保护其他 thread 的正文与公开投影基线。旧 ArticleBodyDraft / ArticleBodySnapshot 的消费者、FK 和任务须随旧 Draft / Revision 一起盘点并退役，不保留正文 hash 去重或兼容读取。现有盘点脚本及 FK 基线尚未覆盖新表设计，需在实施后重新生成和评审，不能沿用既有报告放行。

最终一个 Community 只有一套 Docs 工作区和公开站点。移除 `DocBranch` 及所有 Doc `branch_id` / `branch_policy: :main` 选择；旧 GraphQL 字段和参数直接退役，不保留 fallback。主要波及：

1. **持久层**：`DocDraft`、`DocPublic`、`DocLifecycle`、`DocBranchState`、`DocBranchVersion` / counter、`DocTreeNode` / Event / Snapshot、`DocsSiteState`、`DocPublishRelease` 及成员、Trash、`PublishRequest` 和内容审核限制的唯一键、外键与作用域。旧 Doc 内容版本、公开正文 head 和 branch 版本计数退役。删除旧 `docs_site_states` 表及 `DocsSiteState` 读写入口，新 Queue 行从 0 初始化目录版本，旧计数不迁移。审批及 Release 统一引用 ArticleSnapshot；切换时清空并按新结构重建 `doc_publish_releases`、`doc_publish_release_articles` 和 `doc_tree_snapshots`，沿用表名。旧 `doc_publish_release_tree_events` 退役，Release 直接记录完整公开树结果及删除项。重建时去除 branch / branch version 及旧事件 FK，正文成员改为 ArticleSnapshot 的 `RESTRICT` 引用。B0 的 DDL 清单列出所有入向 FK、拆除与重建顺序、索引和约束校验。
2. **写入与读取**：`CMS.Docs` / `CMS.DocTree` Commands、Draft Store、Publish Workflow、Query / Projection、FrontDesk、Gate Access / Scope、Lifecycle、内容审核及评论准入、Interactions、Search、Press、Activity、Import、seed 和维护入口。旧 `PublishBranch` 命令须由站点队列发布命令替换，不能只改名。`Doc` 与普通 Article 可共享内容机制，但仍保留 Docs 的目录、Release、Trash 和资源专属 Gate Context；公开正文使用 ArticlePublic；Doc 专属目录、可见性及定位按各自运行时职责保留。
3. **协议与前端**：Docs GraphQL 查询 / mutation / types、生成类型、编辑器路由与 store、目录、旧 Checklist / Selection API 与状态、修订历史、LocalDraftHistory 的工作区 key、回收站、队列预览及审核界面。`branchId` 不能只在 UI 隐藏而在合同中继续传播。LocalDraftHistory 存于客户端 IndexedDB：新 key 使用新命名空间，旧 branch key 不再读取，客户端启动时清理旧 key；服务端 dry-run 无法计数客户端数据，也不迁移草稿。B0 还须盘点非 schema 作用域：advisory lock key、缓存 tag / invalidation、Outbox / Activity ref、Command Receipt / Confirmation payload、审核类型、DocCover projection 及持久化 JSON / 字符串引用。
4. **导入边界**：[Content Import](../import/content-import-architecture.md) 的 `target_branch` 是目标 Doc 工作区，应随队列合同退场；源仓库的 Git `source branch` 是外部来源信息，继续保留。批量 Import apply **默认只生成工作区草稿，不自动入队或发布**；这是交互式目录改动自动入队规则的明确例外。导入完成后由作者显式发起一次“批量加入发布队列”命令，可选择本批中的文档，并原子校验正文可发布性、父级壳节点和目录依赖；失败不留下半批入队结果。
5. **合同文档**：按下方逐节清单更新当前合同，历史设计只标注“已被替代”，不机械改写其历史事实。代码切换后再同步写成新事实，不能提前把本文写成已实现。

| 合同范围                                                                                                                                                               | B0 标记与 B4/B5 更新点                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Gate 入口](../feature/gate/README.md)、[V3](../feature/gate/v3.md)、[V4](../feature/gate/v4.md) 及现行后续版本                                                        | Doc / Comment Scope、Lifecycle、公开 main 选择、preview 管理读取、发布准入和 Trash 定位 |
| [Article Revision / Draft](../feature/article/revision-draft-target.md)、[DocTree](./cms-doctree-refactor.md)、[Docs ID 统一](../feature/docs/id-unification-plan.md)  | Doc 身份、Draft/Public/Revision、目录事件、Release 与 branch / version 假设             |
| [AlertWall](../feature/alert-wall/README.md) 及其当前实施合同、[评论联合验收](../feature/article/mentions-graph-doc-comment-joint-acceptance.md)                       | Doc 审核限制作用域、Doc 评论父级与公开可见性；区分内容审核和发布队列审批                |
| [Mentions Graph](../feature/article/mentions-graph-sync-contract.md) 及相关现行设计、[Article Stats](../architecture/article-stats-target.md)、[Press](../press/v1.md) | main / preview 读取边界、公开投影、缓存和统计口径                                       |

以上是已知清单，不代替 B0 全量扫描；B0 为每处记录“当前合同需更新 / 历史记录仅标注 / 无运行时影响”和对应章节。

本轮**不迁移或兼容任何旧 Docs 数据**：旧 main / preview 的草稿、公开 head、目录、Trash、审核记录和 Release 均不转入新合同，不设计导出、回填、双写、旧版读取 fallback 或回滚到旧合同。新架构从空的 Docs 数据状态启动；旧 Doc URL 返回 404，不做跳转。B0 用只读 dry-run 清单列出将清理的服务端 Docs 与关联行数，覆盖 Doc 评论 / 互动 / 统计 / Mentions、Doc 专用 Assets 与覆盖图、`ArticleAssetRef`、Search 与 Press / CDN 索引、通知、Import source mapping、旧 Command Receipt / Confirmation payload、旧审批记录、Outbox / Activity 和缓存；**不把客户端 IndexedDB 计入服务端行数**。清单只用于完整清理和无孤儿验证，**不迁移旧讨论历史**；共享 Article 与共享资产只能按经确认的 Doc 归属解绑或清理，不波及其他资源。若目标环境有真实用户数据，B0 记录一次产品负责人对破坏范围和用户通知安排的确认；没有真实用户数据则不增加通知步骤。

服务端清理的根集合以 `Article.thread = :doc` 的稳定 Article ID 确定，再沿其 `ArticleBinding`、Doc Tree、评论父级及各投影引用扩展；`ArticleBinding.thread` 与 Article 类型不一致或引用归属无法确定时停止清理，不用模糊的社区 ID 批量删除。dry-run 按实体与阶段保存目标 ID 集合摘要、预期行数和实际行数；任一未分类引用、实际数量超出清单或非 Doc 基线变化均阻止完成。普通 Article 的正文、评论、统计和资产逐项保持不变；共享资产只解除旧 Doc 引用，不删除仍被其他资源使用的文件。

| 旧状态                                                                      | 新合同切换时的处置                                                                                    |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DocCoverCard`、`DocCoverItem`、`DocCoverPinnedDoc`                         | 关联旧目录节点，删除旧行；新站点发布后按新树重建 Cover 投影                                           |
| 旧 `DocsSiteState`                                                          | 清理入向引用并删除旧表。目录版本与公开状态由新 Queue 行按需初始化。                                   |
| 旧 Doc Tree / Release / 审批状态                                            | 清空旧记录并按新合同重建所需结构。旧节点 ID 和旧队列 revision退役。                                   |
| 旧 Doc 的 `Article` 根行、`ArticlePublic`、WorkingCopy、Snapshot 及其从属行 | 按旧 Doc 根集合解除旧历史及派生引用并删除。新合同的历史保护仅适用于切换后创建的 Doc 身份。            |
| Doc 的 `ArticleBinding`、alias / locator                                    | 按 Doc 根集合删除旧绑定与定位；旧 URL 返回 404，不映射到新内容                                        |
| Docs 站点设置                                                               | 无 Doc / 旧 branch 引用的站点级配置可保留；包含旧 Doc ID、节点 ID 或 branch 的字段重置，B0 逐字段列出 |
| `ArticleAssetRef`、Doc 专用资产                                             | 删除旧 Doc 引用；物理文件仅在确认为无其他引用且符合资产清理规则时处理，共享文件保留                   |

旧 Doc 的公开 URL 以 Community、`doc` 和 `ArticleBinding.inner_id` 定位；当前读取不以 URL 中的 slug 作为身份。该编号由 [Community 共享计数器](../../backend/api/lib/groupher_server/cms/articles/numbering.ex)分配，Post、Blog、Changelog 等也使用它。切换必须保留 `community_inner_id_counters` 的现有版本，禁止删除、重置或回退计数器；新 Doc 首发继续分配新编号。否则旧 URL 即使携带旧 slug，也可能命中新 Doc。dry-run 将计数器纳入共享基线，并检查所有仍有公开编号的 Binding 是否存在计数器及其 `next_inner_id` 是否严格大于编号；不满足则停止。此检查无法证明已删除 Binding 的历史最高编号，实际切换还须核实计数器从未回退且有可信版本；缺乏证据时不能仅按当前行的最大值判断旧 URL 不会复用。验收须在删除旧 Doc 后创建并发布新 Doc，再用旧编号和旧 slug 验证 404。

切换是一次性新合同部署：先在隔离环境演练清空 Docs 作用域、重建 schema / 投影和冒烟验证；实际切换先禁止新 Doc 内容、目录、Cover、Docs 站点设置、评论、互动及导入写入与任务入队，再暂停并排空或明确取消在途的 Doc 相关 Oban Job、Outbox effects、通知、Import Job、Trash 定时删除和缓存失效任务。验证无旧任务能再次写入或重建公开页面后，执行同一清理与新建步骤，核对外键、队列空状态、旧 URL 的 404、公开索引失效和新建 / 入队 / 预览 / 审核 / 发布流程，然后恢复写入与任务消费。清理按数据库事实、外部投影 / 缓存失效、新合同初始化分阶段记录完成标记与验证查询；每阶段可重试且幂等，完成门禁要求所有阶段通过。同一 PostgreSQL 内可合并的清理优先在事务内完成，不假定跨表清理无法入事务。失败时保持停写并修复或重跑未完成阶段，**不部署旧读写合同作为兼容回退，也不把冷备份设为门禁**。窗口与 go / no-go 条件由演练确定；不需要旧数据迁移回退点或 Release 对齐检查。

dry-run 清单、Doc 归属与数量判定、阶段完成标记和验证结果必须写入**不在清理范围内的独立 control schema 或外部持久 runbook 记录**，不能只输出日志或存入将被清空的表。记录包含切换 ID、目标环境、生成时间、清理规则版本、每阶段计数与校验结果；保留期限在 B0 runbook 中写明，至少覆盖切换和后续验收。它是删除审计轨迹，不保存旧 Doc 正文或提供数据恢复能力。

## 5. 实施批次与前置条件

这些批次是开发和验收边界。B0 的放行条件是逐表 DDL、完整锁序、Doc 首发副作用矩阵及切换清单均可评审和演练。实现可分批完成，对外一次启用完整新合同。旧数据、旧 API、旧发布逻辑在切换时退役。

| 批次                | 交付物与完成条件                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B0 · 盘点和切换准备 | 报告模式扫描 Branch、Checklist / Selection、旧内容模型和所有写入、读取、投影、任务与外键；逐项列保留、改接或删除，按 §3–§4 补逐表 DDL、完整锁序、审批权限和通知对象，并交付 Doc 首发 / 再发布 / 删除副作用矩阵。输出只读 dry-run、实体处置表、任务排空及持久切换 runbook；隔离演练确定清理范围、非 Doc 基线和 go / no-go 条件。 |
| B1 · 队列事实       | 实现队列和正文 / 目录成员、入队 / 出队、独立保存与显式合入、目录依赖和 Trash。以真实命令验证 revision 隔离、双侧编辑冲突、整批失败回滚和 FK 保护。                                                                                                                                                                              |
| B2 · 预览与审批     | 同一 planner 生成队列预览与审核 diff；审批固定 ArticleSnapshot 并保护引用。验收快照一致性、增量基线、权限、缓存隔离及失效。                                                                                                                                                                                                     |
| B3 · 原子发布       | 在锁内消费整队，切换 ArticlePublic 与目录，记录 Release 和 Receipt。验收有 / 无审核、首次和再次发布、重复提交、并发冲突、事务回滚和提交后投影。                                                                                                                                                                                 |
| B4 · 去 Branch 切换 | 按 §4 停写、排空任务、清理旧 Docs 数据并启用新读写协议。移除旧 branch 实现、Checklist / Selection、PublishRequest 及旧内容读写。清空后验证旧 URL 为 404、旧 Article ID 无法通过通用详情、Search 或 Press 返回内容、非 Doc 基线完整、新链路冒烟通过，再恢复写入。                                                                |
| B5 · 全链验收       | 在目标环境记录新建 → 保存 → 入队 → 预览 → 审批 → 发布 → 历史的验证结果，覆盖 §6；更新现行合同并标记历史设计，不延长 B4 停写窗口。                                                                                                                                                                                               |

B0 入口盘点可运行 `node scripts/report-docs-queue-inventory.mjs > /tmp/docs-queue-inventory.json`。该报告列出源码、迁移、测试及前端中相关 branch、发布清单、旧发布模型和跨域符号的文件与行号。宽泛的 `branch_id` 等匹配是候选，必须逐项核对是否属于 Doc；报告不改变严格门禁，也不替代数据库引用盘点、运行时路径追踪或逐项处置表。报告记录生成时间、HEAD、分支、工作树状态摘要以及每个命中文件的 SHA-256；评审时须保存报告并核对文件摘要，工作树状态摘要只代表 Git 状态，不代表所有工作区文件内容。

历史 B0 的 `docs_cutover_root_report.exs` 依赖旧模型，已在 R7 删除，不再是可运行入口。其不完整报告只能作为历史证据。R8 按[生产切换记录](docs-production-cutover-r8.md)重新核对实际库、全部内容及入向引用；本轮用户已明确授权清除非 Doc 旧内容，保护账号、社区配置和范围外共享资源。

外键来源表的初步作用域线索固定在 [FK 作用域盘点](../../backend/api/scripts/docs_cutover_fk_scope.json)，报告记录该文件 SHA-256、每个来源表及目标；发现未知来源表、登记表在当前数据库未出现、根表缺失时设置 `schema_inventory_requires_stop`。扫描根包含共享正文、CoverEdit、CommunityAsset 和 Mention endpoint；当前本地 test schema 的 109 个来源表均有线索分类，隔离演练注入新入向 FK 后确认会标记停止。分类仅区分 Doc 专属、共享 Article / 内容 / 评论 / 资产、多资源以及其他 thread 的候选来源；它**不是行级删除决策**，尤其其他 thread 表中指向 Doc / branch 的异常引用仍需检查并阻止清理。无 FK 的 JSON、字符串、索引和外部投影不在此清单范围，`complete: false` 仍禁止放行。

[FK 结构基线](../../backend/api/scripts/docs_cutover_fk_baseline.json) 记录本地 test schema 扫到的 177 条外键名称、源 / 目标、定义及延迟属性，并固定该库 migration 版本集合的计数、最高值与摘要。报告固定 PostgreSQL search path 并逐条比较；migration 版本集合不符、已登记表新增外键、外键消失或定义变化均设置停止标记。隔离 fixture 验证了已登记表新增 FK、改变删除动作，以及仅 migration 版本集合变化的情形。基线只是本地结构快照，目标环境必须先核对实际 migration 内容与版本并评审差异；更新基线不能代替逐行归属、删除顺序或非 FK 引用盘点。

报告还对有明确 Doc 根谓词的目标表逐条统计入向外键候选行，并单列尚无根谓词的外键；同一行可能命中多条外键，计数不能相加。共享正文和资产目标会标注为可能共享，来源表的分类也不等于该行可删除。隔离 fixture 以 Doc / Post 混合数据核对了评论、统计、评论反应和 Mention 两个方向的计数；这不证明全部引用、非 FK 引用或清理顺序已覆盖。该扫描逐外键执行计数，尚未对目标规模做性能验证；上线环境须先评估执行成本。报告仍为 `complete: false`，不能作为清理授权。

补充的 Cover 子项以旧 Cover Card 为目标；通知投递候选通过通知的 Doc Article、Doc 评论或非空旧 branch 定位，未关联通知的 delivery key 不在此范围。Ticket 更新若指向 Doc Article 属于跨资源异常，报告设置 `ownership_anomalies_require_stop`，其 supersedes 入向计数仅用于调查，不能删除 Ticket 数据。通知的 delivery 外键是 `ON DELETE SET NULL`，仅删除通知会留下去重键：切换 runbook 必须在停写并确认任务无法重放后，逐项决定关联 delivery 的清理；无法归属的键不得按候选计数批量处理。隔离 fixture 覆盖 Doc / 非 Doc 通知和跨资源 Ticket 引用，但不能证明无孤儿或无 FK 引用。

报告的 `doc_article_outbox_by_event_and_status` 只统计 `resource_type = article` 且 `resource_id` 能关联到 Doc 根行的事件，按事件名和状态分组。Community 级目录 / Press 事件、评论 / Mentions / Review 事件、直接 Oban 任务以及已失去根行的事件均不在此计数内；它不能代替完整排空清单，也不能因为结果为空而判定无在途任务。

补充的 `doc_comment_outbox_by_event_and_status` 按评论父 Article 定位，`doc_tree_outbox_by_event_and_status` 仅统计 `doc_tree.changed` Community 事件。Receipt 分别统计 Article / Comment 可直接归属 Doc 的资源，以及操作名以 `doc.` 开头的候选命令；这些集合可能重叠，不能简单相加或按命令名前缀直接删除。历史 confirmation / intent、资源已消失的行、其他事件类型及 Outbox 对应 Oban 执行状态仍须逐项解析与核对。隔离 fixture 已验证这些候选计数不混入非 Doc Article / Comment，但不构成完整排空证明。

`doc_outbox_jobs_by_worker_queue_state_and_event` 使用 `event_id` 关联上述 Article / Comment / 目录事件，按 worker、队列、Oban 状态与事件名分组；`direct_doc_search_jobs_by_queue_state_and_action` 另按 `thread = doc` 统计直接 SearchIndex Job，包括其根 Article 已不存在的情况。报告同时列出已完成及未完成状态，实际排空须分别核对 executing、available、scheduled、retryable 等可运行状态与持有中的 Outbox lease；不得只看一个汇总数字。隔离 fixture 验证了 Doc 与非 Doc 评论任务及直接搜索任务的区分。这仍未覆盖未知 worker、Review / Mention 的其他 resource 形状、Import / Trash / 全局维护任务及同一队列中共享任务，因此不能单独用于宣告排空。

报告还按共享 Outbox / Review / Mention worker、队列和状态列出 event ID 缺失或引用已不存在事件的任务；这些任务无法从当前事实确定是否属于 Doc，出现时设置 `unattributed_outbox_jobs_require_review` 和归属异常停止标记。隔离库注入了缺失 event ID、失效 event ID 和无关 worker，验证前两类被报告、无关 worker 不被误判；不得据此取消共享任务，须逐项调查。此检查不覆盖未知 worker 或不使用 Outbox 的其他任务。

`doc_outbox_locks_by_resource_event_and_status` 对当前可关联的 Doc 事件、目录事件及一层派生事件统计仍带 `locked_at` 或 `locked_by` 的行，并记录最早锁定时间；它是待核查候选，不能单凭时间判断 lease 已失效。隔离库注入了目录锁与无关 Community 事件，前者被统计、后者未被归为 Doc；孤儿和多层派生仍须调查。

直接的 `SnapshotRefresh` 任务另按队列、状态、type、version 和 `refs.thread` 汇总；Doc 和其他 thread 分别保留，不能清空共享队列。Article / Comment 缺少可识别的 thread，或任务 type / version 无法识别时设置 `unclassified_snapshot_refresh_jobs_require_review` 和归属异常停止标记。隔离库覆盖 Doc、Post、缺 thread 的 Comment 及 User 任务；该统计仍不说明其他类型的直接 Job 已全部盘点。

`all_jobs_by_worker_queue_and_state` 是全库 worker 分组清单，用于对照源代码、Cron 和运行环境逐项识别直接任务及共享维护任务；它不表示这些任务都属于 Doc，也不是取消清单。旧 `ArticleSnapshotCleanup` 曾只清理 Post / Blog / Changelog，现已在 R1 移除；存量任务取消迁移及部署顺序见 [R0 / R1 清单](./article-docs-r0-r1-inventory.md)。其他全局任务是否触达 Doc 仍须按实际调用链和参数继续判断。

报告还列出执行报告进程加载的 Oban Cron 和 `Helper.Scheduler` 配置，只记录调度表达式及目标，不记录任务参数；`purge_expired_trash` 会对 `doc_tree_` 根类型调用 Doc Tree 永久清理，`archive_artiments` 会遍历 Doc Branch 执行归档。`trash_actions_by_root_type_and_due` 按根类型统计回收站记录及报告时间已到期的数量；隔离数据验证了到期与未到期的区分，不能把其他 Article 的回收站当作 Doc 清理。配置是报告进程的事实，不能证明其他节点加载了相同配置、调度器正在运行或已经暂停；切换时必须逐节点核对运行实例和外部调度，再验证停写排空。

以上任务和 lease 分类可在已迁移的隔离 test 数据库执行 `MIX_ENV=test TEST_DB_NAME=<库名> MIGRATION_EXPECTED_DATABASE=<库名> mix run scripts/docs_cutover_jobs_verify.exs` 复验；脚本只接受名称以 `groupher_docs_b0_` 开头且与连接目标一致的数据库，注入独立队列和事件后运行只读报告，并在结束时删除本次 fixture。该演练只验证列出的形状，不能代替未知 worker、全局维护任务和目标环境的排空核对。

报告进一步按 `mention_source → Mention endpoint` 和 `artiment_review → Review request → Doc / Doc 评论` 定位 Outbox 及关联 Job，并沿 `identity_type = workflow`、`command_id = 父事件 ID` 识别一层派生子事件，以覆盖 Article fanout 的 Press / Search / CDN 候选。Mention endpoint 或 Review request 已缺失而无法确定归属的 Outbox 按全库异常计数并标记停止，不能假定其属于或不属于 Doc。隔离 fixture 覆盖 Doc / 非 Doc 来源、孤儿事件与共享 Community 类型子事件；任意其他事件身份、多层 fanout 或已删除父事件仍需单独盘点，现有结果不证明完整排空。

报告也对根 Article 或 Comment 已不存在的 Outbox 事件按全库计数并标记停止，包括已完成的历史事件；它们可能属于其他 thread，须按事件和任务证据逐项判定，不能按 Doc 清除。Doc 的 Interaction 事件使用 `article` / `comment` 资源身份，现有对应根集合与关联任务计数可以发现仍有根行的事件；根行缺失时不能用空的 Doc 计数推断无旧任务。

报告还按 Doc 根及其评论统计 ArticleStats、Article / Comment 情绪、评论点赞和 Mention endpoints / 出向边；来自非 Doc 来源而指向 Doc 或 Doc 评论的 Mention 边单列为入向候选，不将其归类为 Doc 来源内容。评论或统计行的 thread 与所属 Article 不一致时标记停止。该统计仍不覆盖全部互动类型、Mention 通知 / 历史及孤儿端点，也没有给出入向边的处置决策，不能据此直接删除。

`non_doc_baseline` 对非 Doc Article、Binding、Public、WorkingCopy、Snapshot、旧 Draft / Revision、共享正文、Comment / CommentBody，以及 WorkingCopy / Snapshot 的类型子表、标签、CoverEdit 和资产引用的实际持久字段按主键排序生成计数和 SHA-256；不输出正文。编码为有长度前缀的 Erlang deterministic external term，报告记录运行时版本和各表字段，只有同编码、运行时、字段和数据库事实版本才能直接比较。隔离演练须在无其他写入的条件下取得前后基线；实际切换如仍有非 Doc 合法写入，必须建立可核验的变更版本或隔离该写入后再比较，不能把自然并发修改解释为清理结果。该基线仍未包含所有旧类型子表、资产实体、全部互动和其他派生状态，不是完整非 Doc 保全证明。隔离 fixture 已验证 Doc 修改不改变 Article 基线，以及非 Doc Article、类型子表、画布、标签和资产引用变更会改变对应摘要。

基线另覆盖非 Doc 的 ArticleStats、Article upvote / collect / emotion、emotion count 以及 Comment upvote / emotion；Doc Article 的 upvote 和 collect 单独计数。隔离 fixture 验证修改 Doc 统计和互动不改变非 Doc 对应摘要，修改 Post 统计、Article upvote / collect 或评论 upvote 会改变摘要。其余互动、关联的收藏夹、异步投影和外部状态仍须盘点，以上结果不能作为完整保全证明。

### B0 已核对的入口与处置

以下是当前代码的局部盘点，不能当成全量盘点完成。每项列的是切换后的目标处置，具体调用方、锁及测试仍须在 B0 逐个登记。

| 入口 / 事实                                                                                                                                                             | 当前职责                                                                                        | 目标处置                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [Docs resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/docs.ex) 和 [GraphQL 查询](../../backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex) | 暴露发布 Checklist 和选中项发布                                                                 | 退役 Checklist 查询及选择参数，改接 Queue 查询、成员命令和整队发布；按 Gate 合同分层读取。                                             |
| `Checklist`（旧路径已在 R7 退场） 与 `Selection`（旧路径已在 R7 退场）                                                                                                  | 即时汇总 branch 草稿及 staged 事件，规范化前端选中项                                            | 删除两套临时选择逻辑；工作区和 Queue 各自保留明确读入口。                                                                              |
| `PublishChanges`（旧路径已在 R7 退场）                                                                                                                                  | 对 Community 执行 `:manage_docs` 准入和 Receipt，当前确认结果中的发布结果仍会重新读取 Checklist | 改为单站整队命令；Receipt 先恢复原 Release 和原确认结果，不重新选择成员。                                                              |
| `Publish Workflow`（旧路径已在 R7 退场）                                                                                                                                | 解析 branch，取得 branch advisory lock，比较 `site_draft_version` 并基于 Selection 发布         | 去 branch / 旧锁键和 Checklist 版本；以 Community 站点锁、Queue revision 和 ArticleSnapshot 执行整队发布。                             |
| `Doc UpdateDraft`（旧路径已在 R7 退场） 与 `PublishBranch`（旧路径已在 R7 退场）                                                                                        | 以 branch 定位内容和 Gate，后者调用 Doc 旧发布流程                                              | D 保存接入 Article 基座；退役 branch 发布命令，Doc 公开选择改接整队事务。                                                              |
| `DocTree node`（旧路径已在 R7 退场）、`tree projection`（旧路径已在 R7 退场） 和 `tree snapshot`（旧路径已在 R7 退场）                                                  | 当前节点标识为字符串，目录投影及历史包含 `marker`、`badge`、`hidden`                            | 保留完整节点产品字段，去除 branch，Queue 预览、计划和 Release 树按 §3 使用同一内容。                                                   |
| 旧前端发布控制器（已移除）                                                                                                                                              | 本地维护被选择的正文和目录 ID                                                                   | 已改为[服务端 Queue 成员](../../frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/usePublishQueue.ts)；发布不提交临时子集。 |
| `Doc Lifecycle`（旧路径已在 R7 退场）、`DocsSiteState`（旧路径已在 R7 退场）                                                                                            | 以整数 Community / branch 标识作用域；旧站点状态维护树与草稿版本                                | 重建无 branch Lifecycle，保护 D；Queue 用 UUID 标识并以唯一 Community 归属，承载四个版本。                                             |

B0 的逐表 DDL 至少固定下列约束及验证查询。

| 项目                      | 必须落入 DDL 的规则                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue、目录版本与公开状态 | UUID 主键、非空 `community_id` 外键及唯一键；目录、队列、公开展示、审批策略版本均为非空 bigint，默认 0，各有非负 CHECK；审批策略开关默认 false；可空 Release 和最近审批指针通过复合外键约束到本站对应记录。首次目录写入、入队、策略、Cover 或影响预览的设置写入共用 Community 锁和初始化步骤，按唯一键处理并发并读取获胜行。纯工作区目录写入只推进目录版本，Cover / 设置只推进展示版本，策略写入只推进策略版本；首发同事务写入 Release 指针并推进队列与展示版本，只有实际写入工作区目录时才推进目录版本。读空队列不插行；首次写入失败时变更及初始化行一并回滚。 |
| D 生命周期                | 固定无 Branch 的 DocLifecycle 到 D 的非空唯一 `RESTRICT` FK，以及同 Article / default scope 的可执行约束。列出创建顺序、永久清理顺序与并发验证。                                                                                                                                                                                                                                                                                                                                                                                                                |
| Release 删除成员          | 在重建的 `doc_publish_release_articles` 存储，`(release_id, article_id)` 为主键。行类型为 `publish` 或 `delete`；CHECK 要求 `publish` 持有非空 Snapshot，`delete` 的 Snapshot 为空。Article 身份及实际发布的 Snapshot 受 `RESTRICT` 保护，验证同站点与同 Article 归属。                                                                                                                                                                                                                                                                                         |
| 审批贡献者                | 正文和目录的活动贡献者按成员与 actor ID 去重；删除成员时清理对应活动贡献。审批记录以 `(approval_snapshot_id, actor_id)` 固定本次自批判定使用的并集，随审批历史保留并独立于活动队列清理。                                                                                                                                                                                                                                                                                                                                                                        |

### B0 逐表 DDL 草案

以下是迁移拆分依据。数据库约束、Ecto changeset 和 Command 校验都必须按此执行；B0 仍须完成入向 FK、现有写入口与锁序的全量盘点及隔离演练。表名均位于 `cms`，时间列为 `timestamptz`，Ecto 对应 `:utc_datetime`。现有 Community、User ID 为 bigint，Article、WorkingCopy 和 ArticleSnapshot ID 为 UUID，目录逻辑节点 ID 为字符串。UUID 不使用社区整数 ID 充当 scope。

| 表                                     | 列、键和约束                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs_publish_queues`                  | `id uuid PK`、`community_id bigint NOT NULL UNIQUE` 引用 `cms.communities(id) ON DELETE RESTRICT`；`tree_lock_version`、`queue_revision`、`public_presentation_revision`、`approval_policy_revision bigint NOT NULL DEFAULT 0 CHECK (>= 0)`；`approval_required`、`allow_self_approval boolean NOT NULL DEFAULT false`；`public_release_id bigint NULL`、`latest_approval_id uuid NULL`；`inserted_at/updated_at timestamptz NOT NULL`。对 `(id, community_id)` 建唯一键供跨表归属校验。Release 表创建后以 `(public_release_id, community_id)` 外键引用 Release 的 `(id, community_id)`；审批表创建后以 `(latest_approval_id, id, community_id)` 引用审批的 `(id, queue_id, community_id)`，均为 `ON DELETE RESTRICT`。首次写入在同一事务按 Community 锁初始化；无行读取返回四个 0、两个 false 和空指针。社区删除时须先在站点锁内解除指针，再按依赖处理本站历史及其受保护引用；社区存续期间不得清理历史。                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs_queue_articles`                  | `queue_id uuid`、`article_id uuid` 联合主键；`working_copy_id uuid NOT NULL UNIQUE`、`source_snapshot_id uuid NOT NULL`、`enqueued_by_id bigint NOT NULL`、`inserted_at/updated_at timestamptz NOT NULL`。Queue 外键级联删除成员；`(article_id, working_copy_id)` 和 `(article_id, source_snapshot_id)` 分别引用基座已存在的 `article_working_copies(article_id, id)`、`article_snapshots(article_id, id)`，均为 `ON DELETE RESTRICT`；操作者引用 `account.users(id) ON DELETE RESTRICT`。Command 在站点锁内同时核验 Doc Binding 归属、Q 的 `workspace` scope 和 `scope_id = queue_id`。额外建立 `(working_copy_id)`、`(source_snapshot_id)` 引用索引。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs_queue_article_contributors`      | `queue_id uuid`、`article_id uuid`、`user_id bigint` 联合主键；`(queue_id, article_id)` 引用正文成员并在其移出时级联；用户引用 `account.users` 使用 `RESTRICT`。作者从入队及实际写 Q 的成功命令登记，成员存续期间累计。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs_queue_tree_changes`              | `queue_id uuid`、`node_id text` 联合主键；`community_id bigint NOT NULL`、`change_kind text NOT NULL CHECK (change_kind IN ('upsert','delete'))`，`target jsonb NULL`，`source_event_id bigint NULL`，`inserted_at/updated_at timestamptz NOT NULL`。以 `(queue_id, community_id)` 引用同站 Queue 并级联，以 `(source_event_id, community_id)` 引用同站事件 `RESTRICT`。CHECK 约束 upsert 必须有对象类型 target，delete 必须无 target；target 完整保存 `type,parent_node_id,index,title,href,doc_id,marker,badge,hidden`。应用层按节点类型校验形状、Doc 所属和目标树，目录成员及 revision 同事务提交。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs_queue_tree_contributors`         | `queue_id uuid`、`node_id text`、`field_name text` 联合主键，`user_id bigint NOT NULL`；复合外键引用目录成员并级联删除，用户外键 `RESTRICT`。`field_name` 由 CHECK 限定为 `existence`、`parent_node_id`、`index`、`title`、`href`、`doc_id`、`marker`、`badge`、`hidden`。每个有效净字段仅记录最后产生当前值的操作者；派生 reindex 的 `index` 归属触发操作者。字段回到公开值时删除其贡献行，节点净变更消失时删除成员及全部贡献。新建节点记录 `existence` 和各字段的创建者，后续改动只替换对应字段作者；删除节点只记录 `existence` 的删除者。审批取这些行与正文贡献者的去重并集。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs_publish_approvals`               | `id uuid PK`、`community_id bigint NOT NULL`、`queue_id uuid NOT NULL`、`queue_revision` 和 `approval_policy_revision bigint NOT NULL CHECK (>= 0)`、`allow_self_approval boolean NOT NULL`、`base_release_id bigint NULL`、`plan_format_version integer NOT NULL CHECK (> 0)`、`tree_plan jsonb NOT NULL`、`approved_by_id bigint NOT NULL`、`approved_at timestamptz NOT NULL`；`UNIQUE(id, community_id)` 和 `UNIQUE(id, queue_id, community_id)`。以 `(queue_id, community_id)` 引用 Queue、`(base_release_id, community_id)` 引用 Release，均 `RESTRICT`；用户 `RESTRICT`。审批正文和参与者放在子表，`sealed boolean NOT NULL DEFAULT false` 仅用于同事务内装配，提交前必须固定；不可变计划包含目录净效果与公开树基线，资产经 ArticleSnapshot owner 引用保护。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs_publish_approval_articles`       | `approval_id uuid`、`article_id uuid` 联合主键，`snapshot_id uuid NOT NULL`。审批外键 `ON DELETE CASCADE`，`(article_id, snapshot_id)` 引用基座 Snapshot 复合唯一键 `RESTRICT`；建立 snapshot 引用索引。审批命令校验该成员属于同站点及当前队列。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs_publish_approval_contributors`   | `approval_id uuid`、`user_id bigint` 联合主键；审批外键 `ON DELETE CASCADE`，用户外键 `RESTRICT`，记录批准时的去重作者集合；活动队列被消费后仍保留。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `doc_tree_snapshots`（重建）           | `id bigint PK`、`community_id bigint NOT NULL`、`tree_json jsonb NOT NULL`、`created_at timestamptz NOT NULL`；`UNIQUE(id, community_id)`；Community 外键 `RESTRICT`；CHECK 要求 tree_json 顶层对象、数字版本 1 和 nodes 数组。快照保存完整公开树及全部节点字段、稳定顺序，无 branch 列；内容不可更新。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `doc_publish_releases`（重建）         | `id bigint PK`、`community_id bigint NOT NULL`、`tree_snapshot_id bigint NOT NULL`、`queue_revision bigint NOT NULL CHECK (>= 0)`、`base_release_id bigint NULL`、`approval_id uuid NULL`、`plan_format_version integer NOT NULL CHECK (> 0)`、`sealed boolean NOT NULL DEFAULT false`、`published_by_id bigint NOT NULL`、`published_at timestamptz NOT NULL`；`UNIQUE(id, community_id)`。树快照、上一 Release、审批均通过各自的 `(id, community_id)` 复合键引用，外键 `RESTRICT`；发布者和 Community 引用 `RESTRICT`。首发 base 为 null；无审核 approval 为 null。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `doc_publish_release_articles`（重建） | `release_id bigint`、`article_id uuid` 联合主键，`action text NOT NULL CHECK (action IN ('publish','delete'))`、`snapshot_id uuid NULL`；CHECK 要求 publish 的 snapshot 非空、delete 的 snapshot 为空。Release 外键 `ON DELETE CASCADE`，Article 和 `(article_id, snapshot_id)` Snapshot 引用均为 `RESTRICT`；增加 snapshot 引用索引。同一 Release / Article 只能有一行动作；事务中校验 Article 属于 Release 的 Community。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docs_post_publish_conflicts`          | `community_id bigint`、`article_id uuid` 联合主键；`base_snapshot_id uuid NOT NULL`、`published_snapshot_id uuid NOT NULL`、`default_revision bigint NOT NULL CHECK (> 0)`、`inserted_at/updated_at timestamptz NOT NULL`。Community 和 Article 外键 `RESTRICT`，两份 Snapshot 使用 `(article_id, snapshot_id)` 复合外键 `RESTRICT`，分别建引用索引。解决冲突前禁止入队；Trash 保留此行，永久清理先解除本行引用。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `doc_lifecycles`（重建）               | `id bigint PK`、`community_id bigint NOT NULL`、`article_id uuid NOT NULL UNIQUE`、`default_working_copy_id uuid NULL UNIQUE`、`default_working_copy_scope text NOT NULL DEFAULT 'default' CHECK (= 'default')`、`state text NOT NULL CHECK (state IN ('draft','published','archived','deleted','destroy'))`、`version bigint NOT NULL DEFAULT 1 CHECK (> 0)`、`changed_at timestamptz NOT NULL`、`first_published_at/archived_at/deleted_at/destroyed_at timestamptz NULL`、`inserted_at/updated_at timestamptz NOT NULL`。published 必须有 `first_published_at`；`(article_id, default_working_copy_id, default_working_copy_scope)` 引用 WorkingCopy 的 `(article_id, id, scope_kind)` 唯一键，删除和修改均为 `RESTRICT`。基座的默认作用域 CHECK 同时保证 `scope_id = article_id`；因此数据库拒绝把 Lifecycle 指向 Q 或将受保护的 D 改成 workspace。Community 和 Article 外键均为 `ON DELETE RESTRICT`；聚合清理须先删除 Lifecycle。站点和 Doc Binding 归属由事务内校验。新建 Doc 时 D 与 Lifecycle 同事务；非空引用必须指向同 Article 的 default 副本，空值仅用于符合 §3.1 的无编辑状态。发布清理干净 D 前先将引用置空，按需初始化时同事务写回；普通删除拒绝删除 D。永久清理处理有 D / 无 D 两种情况。R5 追加迁移 `20261112160000_allow_optional_doc_default_copy` 移除 NOT NULL，并以 CHECK 保证从未发布的 Doc 必须有 D；归属、当前 Public、队列 / 冲突约束由锁内命令复核。 |
| `doc_tree_nodes`（重建）               | `id bigint PK`、`community_id bigint NOT NULL`、`node_id text NOT NULL`、`stage text NOT NULL CHECK (stage IN ('draft','public'))`、`type text NOT NULL CHECK (type IN ('tab','group','page','link','pin'))`、`parent_node_id text NULL`、`doc_id uuid NULL`、`title text NULL`、`index integer NOT NULL DEFAULT 0`、`href text NULL`、`marker jsonb NULL`、`badge text NULL`、`hidden boolean NOT NULL DEFAULT false`、`inserted_at/updated_at timestamptz NOT NULL`。唯一键 `(community_id, stage, node_id)` 供同视图父节点复合 FK 使用，该 FK 为 `DEFERRABLE INITIALLY DEFERRED`；按 `(community_id, stage, doc_id)` 对非空 Page 建唯一索引。节点形状 CHECK 固定 Tab 无父 / Doc / href，Group 有父且无 Doc / href，Page 有父和 Doc 且无 href，Link / Pin 有父和 href 且无 Doc；父节点类型、环和深度由写命令校验。Community 引用 `RESTRICT`，Page 的 Doc 引用 `RESTRICT` 并在事务内验证同 Community。                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 目录排序索引                           | 在 `doc_tree_nodes` 上分别以根 Tab 的 `(community_id, stage, index)`、同父 Group / Page / Link 的 `(community_id, stage, parent_node_id, index)`、同 Tab Pin 的相同键建立类型限定的部分唯一索引；根 Tab 和同父导航标题也分别唯一。跨父移动在站点锁内先为受影响行分配不冲突的临时 index，再写最终连续顺序，同一事务内复核源 / 目标组和父链，失败回滚。临时值不得跨事务可见；B0 用真实唯一索引覆盖交换、跨父移动和并发冲突。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `doc_tree_events`（重建）              | `id bigint PK`、`community_id bigint NOT NULL`、`tree_lock_version bigint NOT NULL CHECK (> 0)`、`ordinal integer NOT NULL CHECK (>= 0)`、`event_type text NOT NULL`、`node_id text NOT NULL`、`node_type text NOT NULL`、`doc_id uuid NULL`、`payload/inverse_payload jsonb NOT NULL`、`actor_id bigint NULL`、`command_id uuid NOT NULL`、`reverts_event_id bigint NULL`、`inserted_at timestamptz NOT NULL`；`UNIQUE(community_id, tree_lock_version, ordinal)` 与 `UNIQUE(id, community_id)`。Community 外键 `RESTRICT`，actor 删除时置空；`(reverts_event_id, community_id)` 引用同站点事件 `RESTRICT`。事件只追加；撤销用新事件指向原事件，不更新原 payload。目录成员的来源事件必须经同站点复合外键验证，事件、目录和队列版本在外层命令同事务提交。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `trash_actions`                        | 复用共享表，保留 `id bigint PK`、`hash_id uuid UNIQUE`、`community_id bigint NOT NULL`、`actor_id bigint NULL`、`root_type/root_ref text NOT NULL`、`deleted_at/scheduled_permanent_deletion_at/inserted_at/updated_at timestamptz NOT NULL`。为 `(id, community_id)` 增唯一键，Doc Trash 子表以复合键 `RESTRICT` 引用；与其他 Article 共享的记录按根资源类型处理。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `trashed_doc_articles`（重建）         | `id bigint PK`、`hash_id uuid NOT NULL UNIQUE`、`trash_action_id bigint NOT NULL`、`community_id bigint NOT NULL`、`article_id uuid NOT NULL UNIQUE`、`restore_state text NOT NULL CHECK (restore_state IN ('draft','published','archived'))`、`deleted_by_id bigint NULL`、`deleted_at/inserted_at/updated_at timestamptz NOT NULL`。Trash Action 以 `(trash_action_id, community_id)` 复合外键 `RESTRICT`，Article、Community 引用 `RESTRICT`，操作者删除时置空。D、Lifecycle 与待解决冲突继续持有，恢复依赖关系全部成功才删 Trash 行。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `trashed_doc_tree_nodes`（重建）       | `id bigint PK`、`hash_id uuid NOT NULL UNIQUE`、`trash_action_id bigint NOT NULL`、`community_id bigint NOT NULL`、`node_id text NOT NULL`、`doc_id uuid NULL`、`type text NOT NULL`、`draft_snapshot/public_snapshot/queue_snapshot jsonb NULL`、`deleted_by_id bigint NULL`、`deleted_at/inserted_at/updated_at timestamptz NOT NULL`；`UNIQUE(trash_action_id, node_id)`；CHECK 至少一份快照非空且 type 属于目录节点类型。Trash Action 同站点复合外键及 Doc 引用 `RESTRICT`，操作者删除时置空；按 `(community_id, deleted_at)` 和 `trash_action_id` 建索引。快照包含完整节点字段和原父链；`queue_snapshot` 固定删除前实际队列状态，供发布前恢复时保留既有目录改动，不能重建已丢弃的 Q。恢复前先校验父链、身份和位置冲突。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

外键引用的资源若需要新增复合唯一索引，迁移先建唯一索引再建外键；Queue 与 Release 的循环引用先创建表，再添加可空 `public_release_id` 外键。仅在社区删除时解除 Queue 的当前 Release / 审批指针，再按依赖顺序处理本站历史，不允许级联删除仍被审批或 Release 正式引用的 Snapshot。Queue 成员的父表级联只用于删除空站点聚合，日常出队和发布必须按事务顺序先解除成员、再清理 Q。

正式迁移已实现并完成空隔离库演练，实际环境尚未切换。B0 临时表、约束原型和存储原语的阶段记录见附录 C；其中的临时表替换步骤不属于正式部署 runbook。

审批和 Release 以一个事务创建未固定父行、插入内容成员与贡献者，再将 `sealed` 从 false 置为 true。数据库延迟约束触发器要求事务提交时父行已固定；父行触发器只允许内容不变的 false → true，其他更新被拒绝。成员插入先锁定父行且只允许父行未固定时执行，成员更新、提交后的追加或单独删除均被拒绝。成员删除触发器核对对应父记录是否已被当前完整删除操作移除，不以触发器调用深度作为放行依据，避免其他嵌套触发器绕过限制。社区删除中的历史聚合清理先检查外部引用，再删除父记录及其级联成员，Snapshot 的 `RESTRICT` 保护不变。树快照禁止更新。该字段是事务内固定屏障，不是对外审批状态。隔离演练以两个独立 PostgreSQL 连接验证了未提交审批与并发成员插入，并验证固定后拒绝追加、父记录清理级联及 Snapshot 保留。账户表当前在外键检查前禁止物理删除；演练核对了贡献者外键为 `RESTRICT`，并验证账户物理删除由账户层拒绝。账户其他生命周期变化与完整业务命令并发仍须验收；仅靠 Ecto changeset 不能保证不可变。B0 评审还要锁定实际 DDL 对每项约束的实现、迁移运行顺序、错误映射以及隔离环境下的真实 FK 行为测试。

## 6. 必须验收的场景

- 社区存续期间推进时间、切换 Public、重新审批、出队及单篇 Trash 永久清理均不删除正式 Snapshot、旧审批、Release 或目录历史；无当前业务引用的正式 Snapshot 也不按时间删除。社区删除按明确归属与引用顺序清理，其他社区共享内容不受影响。
- ArticleBody.type 及结构化计划校验均按本轮合同验收；旧实现的摘要一致性测试不能替代成员、来源 revision、Snapshot 和目录事实逐项不匹配的拒绝测试。

- 通用命令对 Doc 的任意 `workspace` UUID 都拒绝创建、fork、保存和删除。仅有 `:edit` 的用户可读 D，按列表、直接 ID 或嵌套字段均读不到 Q 或审批 Snapshot；授予队列预览权限后只可从 Docs 入口读取获准内容。
- 冲突解决实际写入 D 后，旧 revision 保存失败，tag、CoverEdit 与资产引用同步更新。注入从属写入失败时，D 和冲突记录均保留原状。
- 新站点首次创建一个留在工作区的空 Group / Tab 时，初始化唯一 Queue 行，`tree_lock_version` 从 0 到 1，`queue_revision` 和 `public_presentation_revision` 保持 0，Release 指针为空。过期目录版本拒绝写入，Receipt 重放不重复推进。目录写入若同时改变队列，两项版本与成员变更同成同败。
- 首次目录写入、Cover、审批策略或入队并发执行时只得到一条 Queue。Cover 单独首写时只推进展示版本；首发在同一行设置 Release 指针并推进队列与展示版本。注入首次目录写入失败后，目录改动和初始化行均回滚，读取仍返回四个零版本、两个 false 和空指针。
- 新 Doc 永久清理后，即使审批 / Release 仍持有其 Article ID 和 Snapshot，通用详情、Search、Press 和原公开地址均不能返回正文。模拟缓存命中、投影失效未完成及旧任务重试，授权的 Docs 历史读取仍可解析受保护内容。

- 一篇已发布 Doc 的未入队草稿保存后，公开站点、队列预览、队列 revision 和已获批状态均不变；入队后预览只显示该草稿。
- 队列有 Doc A、Doc B 和自动入队的目录改动时，先移出 B 并撤销或暂缓与 A 无关的目录改动，再发布整队；Release 只含 A 及其必要目录依赖，B 的草稿和暂缓目录改动仍在工作区。若目录改动是 A 的依赖，单独暂缓被拒绝。
- 首次审核比较公开站点与队列；获批后保存同一 Doc 的默认副本，队列 revision、预览和审批保持原样；显式合入改变队列内容、编辑队列副本或有效目录变化后状态为 `pending`，审核 diff 仍从获批 Snapshot 起算；再次批准后基线前移。无需审核模式只显示发布效果 diff，不能产生虚假获批记录。
- 合入基线为 S0，默认副本改标题、队列副本改正文时，队列得到新标题并保留队列正文；双方改成不同标题时，未提交冲突选择的命令整体失败。用过期的任一副本 revision 重试也失败，原 Receipt 重放返回原结果。
- 发布后无未发布编辑时删除 D 并清空 Lifecycle 引用；双方只改不同字段时保留合并后的未发布内容；冲突时保留 D 并阻止入队。解决结果与 Public 完整一致时删除 D，否则保留。再次编辑从当前 Public Snapshot 创建新 D / Body；并发初始化唯一。保存与删除交错不丢编辑，旧 D ID 保存明确失败且不自动重建。Receipt 重放不删除后来新建的 D。
- 通用入口直接删除 D 仍被拒绝；Docs 发布 / 冲突解决只在没有未发布编辑时可解除引用并删除，永久清理走聚合命令。验证干净公开 Doc 无 D 的查看、Trash 删除和发布前恢复；删除 Release 前创建恢复用 D，发布后恢复不丢内容。活动 Q / 冲突缺少 D 必须拒绝。失败事务不得留下部分引用变更。
- fast-forward 和三方合并实际写入 D 时，旧 D revision 保存被拒，tag、CoverEdit 和资产同步。完全无写入时 revision 保持原值。冲突解决和入队共享站点锁，入队只能读到提交前的阻塞或提交后的新 D。
- 出队、单 Doc 删除、单节点删除、父节点级联和批量删除都验证 Q 丢弃确认。D 已含相同修改时无需确认，仅 D 改动也无需确认；Q 独有字段存在时必须确认，任一受影响 D revision 或队列 revision 变化后重新校验。出队保留 D；Trash 恢复 D 和节点关系，不恢复 Q 或自动入队。未公开 Doc 移除 Q 后仍有 D。
- A 入队、B 编辑 Q 时拒绝 A 和 B 自批；C 仅编辑 D 时不计入；若 C 把 Q 改回原值，B 和 C 仍受自批限制。移除成员后活动贡献退出，审批历史保留原贡献集合。对象键序、画布行 ID 或仅派生输出变化不造成合入冲突，正文数组换序或正文 schema version 不同仍是改动。
- 已公开目录节点由 A 改标题、B 改位置；C 将位置恢复为公开值后，活动贡献只剩 A，B 和 C 不再因该字段受自批限制。若 C 把标题改成另一未公开值，则该字段贡献者由 A 替换为 C；派生 sibling 重排的 `index` 贡献归属触发该操作的人。新节点的创建者通过 `existence` 留在并集中，直到节点不再构成净新增。
- 修改节点的 `marker`、`badge` 或 `hidden` 后，队列预览、审核 diff、Release 树快照和公开读取都反映同一结果。暂缓时不进入预览或发布，恢复为公开值后无净目录成员；失败回滚不留下部分字段。
- 独立 Link / Pin 恰好指向被删除的 Doc 时，保留链接且旧地址可返回 404。Link 和 Pin 走各自的父链与 href 校验，跨父移动同时重排两个组。暂缓改动不会影响队列排序；删除父节点将未公开草稿移入 Trash，恢复保留身份。
- 通用保存、删除、fork 与发布入口拒绝绕过队列，包含通过 Snapshot ID 尝试直接公开 Doc。内部删除有真实活动 FK 时失败，解除引用且保留 D 后删除成功。基座同时命中两种保护时验证 `last_unpublished_work` 优先。审批与 Release 使用的 Snapshot 在队列副本删除后仍可读，受保护的 Snapshot 无法被清理。
- 新站点尚无 Release 时，预览、首次审核 diff、结构化计划 和首次发布均使用 `public_release_id: null` 与同一规范化空树；新 Release 的计划格式版本、输入版本和结构化发布事实 可追溯，不能为首发虚构上一笔 Release。
- 新合同空站点的 `queue_revision` 与 `public_presentation_revision` 均为 `0`；首次 Doc 入队只推进前者，首次 Cover / 设置变更只推进后者。首发消费队列后前者继续递增；后续 Release 不重置两者，旧站点版本不沿用。
- 批准快照引用的封面和正文图片在资产替换、清理后仍可读取；受管理 Asset 必须拥有 Snapshot 对应的 Asset 引用。外部 URL 仍按基座作为普通内容值。
- 并发保存队列 WorkingCopy 或修改目录时，正文 / 树与队列 revision 同成同败；模拟任一步失败后不留下“内容已变、仍被推导为 approved”或“目录已变、未入队”的状态。社区存续期间不清理正式 Snapshot / 树快照，过期审批和旧 Release 仍可按权限读取。
- 同一秒内连续批准两次时，增量 diff 和状态从 Queue 指向的后一次审批读取，而不依赖时间或 UUID 排序；审批写入失败、事务回滚及 Receipt 重放不误改指针。跨站 / 跨 Queue 的审批指针被外键拒绝，指向中的审批不能被清理，解除指针不使审批到期，只有社区删除才进入历史聚合清理。
- 允许自批时作者批准后，关闭自批使该批准变为 `pending`，即使队列 revision 不变；随后发布须拒绝直到重新批准。关闭审批后状态为空，再启用不能复用旧批准。无变更与 Receipt 重放不推进策略 revision，策略配置、Activity 和 Outbox 同成同败；只拥有审批权限不能更改策略。
- 创建空文档、空 Group / Tab 不自动进入队列或预览；标题与语义正文就绪后入队，必要的父级壳节点与正文不可分割地发布；缺少依赖、空白正文或空白名称被拒绝。
- 移动已公开文档后，其未入队正文草稿仍跟随稳定 `doc_id`；删除包含未公开草稿的目录后，草稿可从回收站恢复。
- 已入队但从未公开的 Doc 被删除后出队并可从回收站恢复；混合目录删除将公开删除入队、未公开草稿回收。发布前恢复删除事件，队列 revision 前进、审批状态被推导为 `pending`；永久删除仍被活动队列引用的实体被拒绝，历史审核快照与 Release 不被级联删除。
- 删除已公开 Doc 后，发布前公开详情、目录、评论准入、Search 和 Press 保持原公开状态；从工作区 Trash 恢复后撤销待发布删除。确认整队发布后公开 Lifecycle 与 Public 同事务切换，公开读取不再返回该 Doc。
- 删除已公开文档 / 目录后，发布前公开内容不变，发布后整批移除；A→B→A、连续重命名和删除后恢复的审核 diff 显示最终净效果，原始操作仍可审计。
- 多篇文档加目录改动一次提交，任一过期版本、依赖缺失或权限拒绝均不留下部分公开内容或被消费的队列成员。
- 公开详情、目录、列表、搜索、评论、Press 以及无权限的预览请求均不能读取队列草稿；预览过程中并发编辑只返回一个 revision 的一致结果或整体重试，有权限预览与同 revision 的实际 Release 内容一致。
- 预览多次查询在 REPEATABLE READ 下共享公开基线与队列 revision；相同输入得到结构等价的计划。发布前任何获批成员、Q 来源 revision、Snapshot 或目录操作不匹配均拒绝，不能产生部分 Release。
- 队列 revision 与获批记录相同，但计划格式不支持或结构化内容不符时显示 needs_reapproval 并拒绝发布；同版本事实不符记录一致性错误，不能因 revision 相同跳过核对。
- 只升级 planner_version 且格式受支持、结构化计划等价时旧批准仍有效；获批计划格式不受支持时显示 needs_reapproval。状态仍为 idle / pending / approved / needs_reapproval，无审批时为空。
- ReviewBlock 在没有新 Release / queue revision 时改变公开可见性，队列预览仍按当前 Gate / 可见性隐藏受限页面；即使 `article.visibility_changed` 失效任务尚未完成，旧缓存也不能泄漏该页面。
- 已纳入 Cover 的 Doc 发布新标题或 slug 后，即使 publish hook 不写 Cover 行，`public_presentation_revision` 仍在发布事务前进，公开 Cover 与队列预览读取新展示。ReviewBlock 隐藏该 Doc 后，公开 Cover 立即不再返回它；异步失效尚未完成时旧缓存也不得泄漏。
- DocCover 或影响预览的 Docs 站点设置独立写入后，`public_presentation_revision` 同事务前进，队列 revision、批准快照与结构化计划 不变；预览读取新公开展示投影且旧缓存不可命中。切换停写覆盖 Cover 与这些设置。
- 公开 Docs Cover / 站点设置若有缓存，变更后使用与预览相同的 `public_presentation_revision` 读取新值；无该版本或无法在返回前复核可见性的 Cover 响应缓存必须关闭。成功发布即推进展示版本，不因 Cover 写入单独推进队列 revision。
- 计划格式支持范围变更后审批状态缓存不可命中旧 approved，查询返回需要重新审批且不发送通知；发布仍在锁内独立核验。
- 不同运行时 / 部署批次对同一计划做结构化比较得到相同结论；对象键序与数据库行序变化不影响结果，真实字段、成员或操作变化必须被检测；不按 JSON 字符串比较。
- 有审核时，审批、Release 和 ArticlePublic 持有同一批实际发布的 Snapshot ID。发布后删除队列副本并运行清理，审批与 Release 仍能读取这些 Snapshot；后续发布原子更新 Public 指向及 ArticlePublicBody。
- 发布命令消费队列后，以同一 `command_id` 和旧 `queue_revision` 重试，先命中 Receipt，返回相同 Release 且不重复消费；Release 仍能定位精确的 ArticleSnapshot 与树快照。
- 无需审批时仍在锁内构建并校验完整计划，再固定 Q Snapshot；有审批时逐项核对批准事实并复用同一批 Snapshot。Release 保存 queue_revision、plan_format_version、基线、实际 Snapshot / 删除成员、目录快照与可空审批引用；消费后队列 revision 继续递增。
- 一次导入 100 篇 Doc 后，工作区有草稿而队列仍为空；作者显式批量入队后，Doc 与父级依赖同成同败，发布整队一次完成，apply 本身不触发发布。
- 未入队草稿保存不改变发布抽屉的队列计数、审批与缓存键；暂缓目录改动仅显示为工作区待处理，不计入队列。切换演练用持久 dry-run 计数和阶段验证确认旧 Docs 数据与跨域派生状态清理完整，重复执行清理不改变结果；新队列从空状态启动，旧 URL 为 404，不读取旧合同。
- 切换前 Doc 相关异步任务已暂停并排空或取消，恢复消费后不会重建旧 Doc；普通 Article 的正文、评论、统计与资产计数 / 内容在清理前后逐项不变，共享资产文件仍可由非 Doc 引用读取。
- 旧 Doc 根行及相关 Public、WorkingCopy、Snapshot 和定位清空后，按旧 URL 和旧 Article ID 验证无法读取，并验证隔离环境的 Doc 首发副作用矩阵。
- 服务端 dry-run 不包含客户端 IndexedDB 行数；新前端不读取旧 LocalDraftHistory branch key，客户端启动清理后只使用新命名空间。

## 7. 不在本轮范围

- 多个并行发布队列、额外协作工作区、跨队列合并或 Git 同步语义。
- 面向读者的 1.0 / 2.0 文档版本选择；整站 Release 的流水号不能冒充产品版本号。
- 整站 Release 级回滚；单篇 Snapshot fork、Trash 和 Command Receipt 恢复仍按本轮合同保留。
- 旧 main / preview 数据、旧 Release、旧审批记录、旧评论 / 互动 / 统计 / Mentions 历史的迁移、兼容读取或双写。
- 把普通 Post / Blog / Changelog 一并改成 Docs 的队列发布产品流程。
- 把全部 Doc 专属字段、目录和 Release 塞进普通 Article 的可选字段大表。

## 附录 A：详细实施进展与验证边界（2026-11-12 整理）

本附录保留正文内联、D 长期保留和旧计划摘要校验版本的既有进展；不覆盖本轮 ArticleBody.type / PublicBody、D 按需生命周期、结构化计划校验或历史永久保留修订。下文提到 hash 的测试仅为旧实现证据，不属于新合同要求。参数术语按本轮规范编辑，不表示旧运行时已改名。本附录为 §0 状态表提供证据说明，记录既有隔离验证和测试浏览器结果，不是本次重新验收，也不是目标环境放行记录。后续新增验证应注明环境、身份、入口、结果和未覆盖项。

当前工作区读取仅返回是否已有 Public；已公开文档的 D 与 Public 内容差异在刷新后的状态提示尚未接入，不能把该提示视为完整的草稿差异判断。

目录元数据更新和移动已接入新工作区命令：针对公开或已入队节点的变更同时更新 Queue，隔离库验证了权限拒绝、无变化不推进版本，以及移动到未公开父级时的依赖入队和发布前后目录。删除和恢复的新路径及其尚未完成项见下文。

出队已接入权限检查、Receipt、GraphQL 和前端确认。隔离库覆盖了无权限拒绝、Q 独有编辑需要确认、确认后 D revision 变化导致确认失效、保留 D，以及 D 已有相同修改时无需确认。新目录删除复用相同的 Q 丢弃检查；其他旧删除入口仍需清理。

D → Q 合入已接入带权限与 Receipt 的命令、GraphQL 和队列界面；冲突按字段要求选择草稿或队列内容，三种 revision 不符时拒绝。隔离库通过真实 GraphQL 验证双侧标题冲突、选择草稿、过期版本与无变化合入；前端测试覆盖冲突选择、未保存草稿和过期队列。目标环境联调尚未完成。

发布后冲突已接入站点锁、Doc 编辑权限、Receipt、GraphQL 与工作区入口。隔离库通过真实 Release 验证冲突发现、无权限拒绝、旧 D revision 拒绝、选择发布内容后 D revision 推进、重复命令重放及冲突清除；前端测试覆盖逐字段选择和请求期间新编辑保留。真实浏览器与目标环境联调尚未完成。

Q 保存已接入带权限、站点锁和 Receipt 的命令、GraphQL、Content Publisher 适配器及队列编辑抽屉，并复用 Article 内容保存和 BodyBag 服务认证。隔离库验证了标题保存、D 不受影响、队列版本推进、命令重放，以及正文请求无服务身份拒绝、有测试服务身份成功；适配器测试覆盖两个版本的传递。浏览器联调、过期版本及权限的完整入口验收和真实服务认证仍待完成。

队列审批命令已接入站点审批 / 预览权限、逐 Doc 准入、Receipt 和 GraphQL；Queue 读取推导审批状态，Release 在修改 Public 前校验审批计划和 Snapshot。隔离库验证了入队者不能自批、另一贡献者编辑后两人均不能自批、第三人批准、批准后修改导致重新审批、同版本计划 hash 异常时提示并记录一致性错误，以及 Release 与审批引用同一 Snapshot。审批界面、完整站点预览、策略配置的对外入口及审批状态通知尚未接入，不能视为 B2 完成或据此开放正式切换。

预览的只读快照前置：Gate 增加仅在 `REPEATABLE READ READ ONLY` 事务中可调用的无锁 Community / Doc 准入，复用现有策略；计划构建支持在该快照中读取公开基线。隔离库验证了许可与拒绝、事务外拒绝及快照计划 hash 与锁内发布计划一致。完整站点内容、跨请求版本一致性与预览界面尚未接入。

Review 进展：新 Release 在事务内登记基于 Snapshot 的 Doc 审核请求；举报、审核结果、人工处理和 Gate 使用无 Branch 的 Article 身份与 `ArticleReviewBlock`。隔离库验证了真实 GraphQL 举报、审核结果、重复发布使旧请求和举报版本标记失效、可疑结果隐藏公开详情，以及 GraphQL 人工批准后恢复和重新审核。旧 Review 路径及相关死代码仍需清理，删除发布的审核清理尚未通过真实删除入口验证。

不兼容旧数据的切换保护：迁移还检查旧 Doc 审核请求及 AlertWall 记录。隔离库注入旧 Doc AlertWall 记录后，迁移按 `docs_cutover_requires_empty_docs_domain` 拒绝；旧记录、旧审核列和迁移版本记录保持不变。实际切换仍须先完成全量清理盘点，不自动删除共享数据库记录。

提及通知进展：Doc 消息按稳定 Article 身份和当前公开 Snapshot 生成投递身份；隔离库通过真实发布事件及 worker 验证投递和重放去重。其他发布后派生效果仍须分别核验。

公开投影接入范围：正文发布和公开删除分别产生 Article 发布 / 可见性事件；目录发布产生站点目录事件。审核限制的施加与解除也产生可见性事件。Article 事件在源事务落 Outbox，提交后分发 Search、Press 缓存和 CDN 清理；目录事件清理公开目录缓存。Search 消费者按当前 Public 与 Gate 重读；缓存任务清理受影响的标签，失败按 Outbox 重试。草稿保存、入队与未发布目录编辑不改变公开视图，不发这些公开事件。Trash 删除、恢复和永久清理入口切换时须分别验证公开删除、恢复和缓存失效，不能假设目录事件覆盖所有正文路径。

隔离库已验证首次 Release 写入正文和目录 Outbox 事件，并通过 Article worker 两次执行验证 Search、Press、CDN 子任务各只创建一次；该次 Outbox 演练未验证真实外部 Search / CDN 服务的投递或真实目录删除入口；后续 Trash 隔离验证见下文，外部投递仍待验收。

正式切换前的阻塞项：新 Release 尚未接通全部发布后派生数据与效果，需按实际读写路径逐项验证。旧 Branch / Checklist 等 GraphQL 入口仍存在，且部分旧目录删除入口仍被前端调用；必须完成替换及清理后才能宣称去除旧机制。隔离环境闭环验证不能替代这些检查或真实身份、服务认证下的切换验收。

删除状态边界：已公开 Doc 删除后、删除 Release 前，公开 Public 和 Lifecycle 必须仍可读；工作区已移入 Trash，则不能只凭 `Lifecycle.state == published` 放行默认副本保存或重新入队。Gate 已读取 Trash 成员并拒绝编辑和重复删除；隔离库覆盖直接 ID 保存、入队拒绝、公开详情仍可读及解除成员后的保存。新删除和恢复命令在站点锁事务内维护成员，删除 Release 后才按公开删除推进 Lifecycle；并发交错仍需进一步验收。

新删除、Trash 列表、整组恢复和永久清理已接入无 Branch 模型、GraphQL 与前端。隔离库覆盖混合子树、Q 独有编辑确认及 D revision 变更、命令重放、发布前恢复原队列目录改动、发布后恢复 D 并重新入队发布、原父节点缺失时选新父节点、列表权限，以及永久清理的权限、活动引用阻止和历史身份保留。公开详情、Press 和 Search 的数据库读取过滤已做聚焦验证；真实外部 Search / CDN 和前端最终联调仍待验证。若队列子树仍包含已移出工作区删除范围的节点，删除返回 `docs_delete_diverged_tree`，作者需先处理该目录依赖。原始目录操作审计和旧 Trash 路径清理仍未完成。

旧通用 Trash 永久清理拒绝新的 Docs Trash action，避免按旧模型误删；用户操作由 Docs 工作区命令执行。定时清理通过内部 Docs 命令取得相同站点锁、重新检查到期时间，并复用工作区的引用保护及清理事务。隔离库覆盖未到期拒绝、公开或其他 Trash 引用阻止、到期清理和清理后的重复执行；并发交错和真实调度环境尚未验证。到期批次的长期失败重试与饥饿治理仍待后续处理。

工作区读取额外返回站点 `queue_revision`，仅作为删除 / 恢复的并发版本，不返回队列成员或预览内容；读取队列计划与 Q 内容仍需队列预览权限。删除 / 恢复实际修改队列时还会检查队列写入权限。

## 附录 B：发布链路早期阶段记录

以下是本轮正文与 D 生命周期修订前的证据，不作为新规则的验收。按原记录顺序保留内部步骤、命令、读取和建表的接入过程；原始段落没有逐条时间戳，本次不补造日期。每段的“尚未接入”“仍待切换”均指该阶段，不能作为当前待办清单。后续状态见 §0、附录 A：创建与发布前端、审批命令、Review / Mention 和新目录主路径已有后续接入；正式环境切换仍未完成。

**历史阶段记录：** `SelectPublic` 的内部步骤现已验证同站队列成员、Q revision、Snapshot 来源和公开 head，并以 Article 基座选择 Snapshot；它不独立构成发布。Release Command 仍须负责 Gate、Lifecycle、首次初始化、目录、Release、D 对齐、Receipt 与效果，并在失败时回滚整个事务。

**历史阶段记录：** `Release.record` 使用目标表结构记录完整树、实际发布 Snapshot 和删除成员；锁内复核公开基线、Queue 目录与正文计划、计划 hash 及 ArticlePublic，再固定 Release 并更新公开指针。`PublicTree.apply` 将核对后的目标应用到公开节点，保持既有物理行身份；隔离库在目标约束下验证新建、回滚、位置 / 名称互换及 Page 绑定互换。隔离库将 B0 演练表临时切换到目标表名验证上述步骤；正式同名旧表的清理重建、权限、Lifecycle 与对外命令仍未接通，不能据此视为发布完成。

**历史阶段记录：** `QueueRelease.run` 将计划重建、审批 Snapshot 选择或 Q 固定、公开选择、D 对齐、公开目录、Release 记录与队列消费编排到同一调用事务，并处理首次公开编号、Stats 初始化和 Doc Lifecycle 状态转移。它按 Article ID 锁定 Lifecycle，校验同站点及发布前状态，并对正文和目录受影响的 Doc 逐项检查发布 Gate；首次公开由 draft 转为 published，公开删除由 published 转为 deleted；正文公开状态与 Lifecycle 不一致时拒绝。发布按实际 Snapshot 更新 Mention 来源，删除使图版本失效；Mention 的当前内容选择读取 ArticlePublic Snapshot，隔离演练验证外链捕获、选中内容、删除和回滚。Mention 通知投递仍须完成新路径验收。隔离环境还验证逐 Doc 权限拒绝、有 / 无审批、首次发布、目录删除、非法状态和整体回滚；该内部核心仍须由外层命令完成站点 Gate、Review、事件与通知、Receipt 和目标表切换，不能作为可对外调用的完整发布。

**历史阶段记录：** `Docs.Content.create_workspace` 在调用方事务内创建 Doc Article、站点 Binding、基座默认 WorkingCopy 和指向该副本的无 branch Lifecycle；调用方仍负责 Gate、站点锁、目录、Receipt 和失败回滚。隔离目标表演练覆盖创建后入队与发布及创建事务回滚；旧创建入口尚未切换。

**历史阶段记录：** `ReleaseQueue` 命令已将站点发布 Gate、逐 Doc Gate、整队事务和 Receipt 串联，GraphQL 提供 `releaseDocsQueue` 和独立授权的 `docsPublishQueue`；隔离演练通过真实 GraphQL 验证队列读取和发布、权限拒绝、同命令重放返回同一 Release，以及同命令不同 revision 拒绝。前端尚未接入；正式 schema、编辑 / 入队入口和必要发布效果仍待切换，不能单独部署新接口。

**历史阶段记录：** Doc 的 Article Gate Scope 已改为通过站点 Binding 加载无 branch Lifecycle 和 ArticlePublic，并使用 `ArticleReviewBlock` 检查平台及站点审核限制；Article 路径定位和 Mention 投影不再读取 Doc branch join。评论公开 Scope 的 Doc 和跨类型查询同样使用站点 Lifecycle，并复用父 Doc Scope 判断公开资格。单资源 Gate 的显式站点入口和默认副本编辑准入已加载相同的 Lifecycle、公开头和审核事实；评论单资源准入也改用同一无 branch Article 锁。隔离目标表演练覆盖真实 Article 命令保存 D、评论编辑准入、草稿不可见、发布可见、审核限制、社区限制和删除不可见，以及评论跟随父 Doc 的审核和删除状态。Doc 审核请求 / 限制的写入与结果消费、其他旧 branch Access 调用与命令仍未改接，不能将当前局部改动作为可上线的权限切换。

**历史阶段记录：** 公开详情投影已改用 ArticlePublic 指向的 ArticleSnapshot 和无 branch Lifecycle；Doc 读取 Scope 不再接受 branch 选择器。Doc 列表及批量路径查询改用 ArticlePublic 和站点公开目录，活动排序使用 Article 的活动时间及发布时间回退。隔离演练验证真实 FrontDesk 详情、列表和批量路径返回发布 Snapshot 的内容，删除发布后详情及批量路径不可读取；普通 Article 分页的定向回归测试通过。旧数据和旧读取合同不提供兼容；剩余旧 Doc 测试、调用和前端仍须随切换更新。

**历史阶段记录：** 公开目录入口读取新站点公开树，并以 Doc Gate 筛选页面；隔离演练验证发布后的导航、审核限制下的页面隐藏以及删除后不再出现。编辑目录及其旧 branch 写入路径仍待替换。

**历史阶段记录：** 正式迁移 `20261112110000_cutover_docs_publish_queue.exs` 已建立无 branch Lifecycle、目录、树快照、Release 和 Trash 目标表，并重建 Queue 的历史引用与 Cover 节点外键。迁移要求旧 Docs 根数据及已有 Queue 均为空，发现数据即在事务内拒绝；不搬迁历史数据。空隔离库从完整迁移运行到目标表后通过真实 GraphQL 发布演练，另一个隔离库验证非空时拒绝且保留旧结构。实际环境的数据清理、剩余旧表 / 代码退役及前端接入仍未完成，不能把演练视为实际切换。

**历史阶段记录：** `Approval.approve` 在站点锁内重建计划，与发布共用受影响 Article 的有序锁定及站点归属校验，再复核正文成员和受影响页面的 Lifecycle 状态。受影响集合包括变更节点在公开树和目标树下的页面后代，因此父节点改动不能漏掉子页面；该集合将供对外命令逐项检查权限。审批按正文与目录贡献者并集检查自批，固定 Q Snapshot 和作者集合，再固定审批并更新 Queue 指针，不改变 Queue revision。Release 记录步骤在站点要求审批时，复核最近一次已固定审批的站点 / Queue 归属、策略和队列 revision、公开基线、计划格式与 hash，以及逐篇批准的 Snapshot；不要求审批时拒绝传入审批记录。隔离演练验证父节点修改识别子页面、已删除正文成员和状态不再公开的待删除页面不能审批、A 入队和 B 编辑时两人均不得自批、C 批准并固定作者集合，以及缺少批准或 Snapshot 不匹配时发布被拒。对外审批命令和逐项权限链仍待接入。

**历史阶段记录：** `Queue.consume_release` 复核已固定 Release 与完整 Queue 的正文和目录结果：正文必须验证当前 Q revision、Snapshot 来源、ArticlePublic head，以及 D 已对齐或持有与当前发布和 D revision 一致的冲突记录；目录必须能从上一 Release 叠加当前净变更得到本次 Release 树。成功解除正文成员、清理 Q 与目录成员，并各推进一次 Queue 和公开展示版本。不存在绕过 Release 的消费入口。此步骤不要求丢弃确认；调用方仍必须完成公开目录写入、Lifecycle、权限及副作用。隔离事务演练使用封存的测试 Release 覆盖缺少 Release、未对齐拒绝、部分消费、错误 Snapshot、冲突保留及 Q 清理后的冲突解决和整队回滚；独立 Release 演练覆盖真实计划、正文与目录一起消费及仅目录发布。

## 附录 C：B0 约束原型与存储原语阶段记录

以下保留本轮修订前的临时表 DDL、内部原语与约束演练证据，均不代表完整业务命令或目标环境验收。涉及 `docs_b0_`、临时改表名及中间 CHECK 的步骤只适用于当时的隔离演练，不能用于正式切换；正式迁移状态见 §0，部署必须使用完成评审的 runbook。入队、合入、出队、Q 保存及新 Trash 主路径已有后续接入，原文待办只反映当时阶段。

**历史阶段记录：** B0 的剩余审批 / Release 等 Ecto DDL 与可重复约束验证分别位于 `backend/api/scripts/docs_queue_b0_ddl.exs` 和 `backend/api/scripts/docs_queue_b0_ddl_verify.exs`，只接受显式指定且名称以 `groupher_docs_b0_` 开头的 test 数据库。隔离环境先执行正式 Queue、目录成员和冲突记录迁移，再执行 B0 DDL 和验证；B0 脚本不属于发布迁移。验证覆盖同 Article 复合外键、活动引用拒绝删除、单站唯一、审批和 Release 跨站引用拒绝、发布成员形状、历史 Snapshot 保护、目录事件同站约束、成员移除后的贡献者级联，以及冲突记录的 Snapshot 同 Article 保护和解除引用后的清理。为避免与隔离库中的旧表冲突，Release、目录事件、树快照、Lifecycle、目录节点和 Trash 子表使用 `docs_b0_` 演练表名。演练还验证了 D 的同 Article 外键与删除保护、目录父链和排序约束、Trash 同站点外键与快照约束；演练包含历史固定事务和不可变触发器。

**历史阶段记录：** Queue 和正文成员的正式迁移为 `backend/api/priv/repo/migrations/20261111100000_create_docs_publish_queue.exs`；当时尚未接入用户命令。`20261112100000_create_docs_publish_approvals.exs` 创建审批和成员表、同站 Queue 外键及固定后不可变约束；新 Release 表落地前，数据库 CHECK 强制 Queue 的公开 Release 指针及审批的基线 Release 指针为空，切换迁移必须以实际外键替换这些 CHECK。隔离库执行正式迁移及上述 B0 DDL 后可用 `MIX_ENV=test TEST_DB_NAME=<库名> DOCS_B0_DISPOSABLE_DATABASE=<库名> mix run scripts/docs_queue_state_verify.exs` 验证空读不初始化、目录与队列版本独立推进、审批配置和策略版本同写、配置不变不推进、过期版本拒绝、计数溢出拒绝、失败回滚以及首次并发初始化的提交和回滚。事务中由 Docs Command 先完成 Gate，再通过 Queue 入口调用站点锁和存储；配置变化后的通知仍由所属 Command 在同事务登记，提交后投递。这些原语不授予访问权限，不能单独代表 B1 已完成。外键盘点基线对应迁移前结构，新迁移应用后必须重新评审并固定基线，不能忽略报告的结构漂移。

**历史阶段记录：** 目录成员和字段贡献者的正式迁移为 `backend/api/priv/repo/migrations/20261111110000_create_docs_queue_tree_changes.exs`。在无 Branch 的目录事件表及同站外键建立前，CHECK 强制 `source_event_id` 为空；切换迁移必须用该外键替换 CHECK。内部目录队列存储可在调用方持有站点锁并确认公开基线后，按完整目标树重算净成员和字段贡献；隔离库 `scripts/docs_queue_tree_verify.exs` 验证回退、重排归属、无变化、并发和失败回滚。当前尚未接入真实目录命令；调用方必须校验基线、节点归属、正文依赖，记录来源事件并处理 Gate、Receipt、通知和回滚。

**历史阶段记录：** 正文成员存储原语可登记一批已由调用方固定并 fork 的 Q，按 Article / Binding / WorkingCopy / Snapshot 的稳定 ID 顺序锁定并复核站点、D revision、Q scope 与来源内容；整批写成员及入队者后只推进一次队列版本。内容实际变更的贡献者去重登记，成员移除时由外键清理活动贡献记录。隔离库执行 DDL 后运行 `MIX_ENV=test TEST_DB_NAME=<库名> DOCS_B0_DISPOSABLE_DATABASE=<库名> mix run scripts/docs_queue_members_verify.exs`，覆盖跨站、错误来源、过期 D、错误 Q scope、Q 内容不符、批次回滚及 D 并发保存。调用方须完成 Gate / Lifecycle、可发布性、目录依赖、待解决冲突和事务回滚编排。现已接入入队命令；上述存储演练本身不能代表完整 B1 验收。

**历史阶段记录：** 批量入队内部原语在同一调用事务校验整批 D revision、同站点 Lifecycle 状态及其 D 引用，再固定 Snapshot、fork Q 和登记成员；失败须由外层回滚，不能留下部分副本或 Snapshot。隔离演练覆盖删除状态拒绝入队、后项 scope 占用导致前项全部回滚、批次成功时只推进一次 Queue、重复请求拒绝及独立连接并发保存 D 后拒绝过期入队。该原语不承担 Gate、目录依赖或 Receipt，尚不是用户命令。成员演练要求先将隔离库的 B0 Lifecycle 表切换到目标表名；消费演练还要求切换 Release 和树快照目标表。

**历史阶段记录：** 显式合入内部原语在同一调用事务中锁定成员和副本，校验 Queue、D、Q 的预期版本，固定 D Snapshot 并执行三方字段选择。冲突返回字段与三个 revision，调用方回滚；成功而内容变化时保存 Q、登记贡献者并推进 Queue，只有来源基线变化时不写 Q 或推进 Queue。隔离演练覆盖版本过期、冲突回滚 Snapshot、显式选择、正文复制与封面和标签保留、仅前移基线、版本溢出导致的完整回滚，以及独立连接并发保存 D / Q 后拒绝过期合入；完整命令的 Gate、Receipt、并发及通知仍待接入验证。

**历史阶段记录：** 出队存储原语在同一站点锁内读取完整受影响集合，对操作、队列版本、各 D revision 和 Q 独有字段生成确定性确认凭据；确认过期时拒绝，Q 与 D 相同的变更不要求确认。验证通过后先移除成员，再调用基座清理 Q，整批只推进一次队列版本。隔离演练覆盖错误操作、D 修改使确认失效、外部 FK 阻止清理时整批回滚、D / 来源 Snapshot 保留以及无需确认的相同修改。出队命令已接入外部入口和目录依赖回收；Trash、父节点删除等路径尚未切换，必须共享同一确认检查，调用方仍负责 Gate、Lifecycle、完整操作和事务边界。

**历史阶段记录：** Q 保存内部原语从成员解析副本，锁定并校验站点、D、来源 Snapshot 和 Q revision 后复用基座保存；基座每次成功保存都会推进 Q revision，因此即使规范化内容相同也推进 Queue revision，但仅当内容实际变化时登记贡献者。隔离演练覆盖双版本冲突、并发保存、保存失败回滚以及 CoverEdit 和附件引用的隔离与回滚。外部命令仍须提供 Gate、Receipt、生命周期和审批失效通知，不能把内部原语视为已可供客户端调用。

**历史阶段记录：** 排序演练在真实部分唯一索引下先将源、目标两侧受影响节点移到各自不冲突的临时位置，再变更父级和最终位置；跨父移动成功，故意写入重复位置时整笔事务回滚并保留原状态。演练的临时位置仅对受控 fixture 成立；业务命令须在站点锁内先验证当前节点没有负索引、为全部受影响行分配不冲突且不溢出的临时值，并检查更新行数。此演练尚未覆盖真实命令、独立连接的并发重排或上限规模。

**历史阶段记录：** 根 Tab 与同父导航的标题唯一索引也立即生效：两个节点交换标题时，即使最终标题不重复，直接批量更新仍会冲突。隔离演练先将两个标题置为不同的临时值，再写最终标题并验证成功。实际发布执行器须在站点锁与单个事务内为所有受影响行选择与当前及目标标题均不冲突、满足长度限制的临时值，再写最终值；这些中间值不进入事件、快照或提交结果。注入失败应恢复原标题和位置；此项仍待真实命令及并发测试。

**历史阶段记录：** 2026-11-11 在本地 `groupher_server_test` 使用临时表和回滚事务验证了 Queue / Release 同站点复合外键、WorkingCopy 与 Snapshot 同 Article 复合外键、Queue 单站唯一、零版本默认值和活动引用的 `RESTRICT` 拒绝。该验证只覆盖 PostgreSQL 约束原型，不代表迁移已实现，也不覆盖应用命令、并发与完整切换。
