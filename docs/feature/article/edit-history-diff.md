# Article 修改历史与 Diff 公共基座

> 状态：H1 / H2 核心路径已实现并通过本轮定向验证；H3 的 Article 历史、Docs Publication 查询和发布贡献者界面已接入，前端定向测试通过。Community GEditor 发布按钮的事件接收与历史写入接线列为后续项。全局永久删除现会在检查保护引用后删除 Article 及其历史聚合，并清理本站 Trash、共同作者、收藏路径和 Ticket 来源引用；§6.2 全部依赖组合及多阶段失败注入仍需继续验收。当前 typed Diff input 与 Docs Publication 序列化修复后，未重跑真实浏览器验收；不作为整体通过或发布依据。
>
> 普通 Article 与 Doc 正文统一复用本基座。[Co-Authors](./co-authors.md#6-实施与验收) 验证多人写入口实际使用的事件、版本、权限及归因。History 自行完成 H1–H3，以 [Passport P1](../../migrations/passport-permissions-refactor.md) 为权限基础。[Docs Mirror Fix](../../migrations/docs-mirror-fix.md) 负责站点目录历史。
>
> 本文显式修订 [WorkingCopy / Snapshot 合同](./working-copy-snapshot-target.md) 中“自动保存不创建 Snapshot”和“无独立发布记录”的目标限制：实际内容变化的成功保存保留不可变状态，并记录独立修改 / 发布事件。旧合同的正文格式、独占 Body、Freeze / Fork、PublicBody 规则继续有效，不恢复旧 ArticleRevision 实体。

本轮按已确认设计直接实现，不要求逐键审批或签字。旧权限 / 写入口清单用于定位调用方、替换旧路径和防止漏改，不是额外产品决策流程。新协议直接切换，不提供历史键兼容、别名、双读双写、fallback、旧数据回填或过渡入口；上线前的历史从当前内容建立 baseline，此前未记录的修改不显示为可追溯事件。确有未决定的用户行为才提出具体场景讨论。实现与发布分别验证，不用尚未实现功能的测量结果阻塞其开发。

## 1. 产品必须回答的问题

```text
10:00 A 保存正文第 2 段变化 -> edit，A，S0 -> S1
10:05 B 保存标题变化      -> edit，B，S1 -> S2
10:10 C 发布              -> publish，C，Public S0 -> S2
```

- 修改列表能打开每次成功内容变化的 before / after Diff。
- 发布列表区分实际编辑者与发布者；发布 Diff 是两次公开选择的汇总，不将 A / B 的修改归给 C。
- 成员删除、WorkingCopy 放弃、站点移除和 Workspace Trash 不清历史；恢复历史记为恢复者的新修改。
- 粒度是服务端接受的一次保存，不是每次按键。本地未提交输入不进入共享历史；不宣称字符级 blame、实时 OT / CRDT 或未保存内容的多用户归因。
- 普通 Article、Doc default WorkingCopy 及退役前仍在用的 Doc Queue 正文写入都必须覆盖；队列退役后保留其已产生历史及来源标记。

### 1.1 事件、Snapshot 与 Diff 分别表达什么

固定名称为 ArticleEvent / cms.article_events，查询为 pagedArticleEvents、articleEvent、articleDiff。当前只覆盖 Article（包含 Doc），不使用 ArtimentEvent 泛化到尚未纳入本合同的 Comment / Ticket 独立工作流；既有 Activity.ArtimentEvent 不在本轮机械改名范围内。

Snapshot 保存“当时的完整文章”；ArticleEvent 保存“谁在什么时候执行哪次修改 / 恢复 / 发布，关联哪两份内容”；Diff 比较这两份内容。事件不复制正文，Diff 结果不作为新的版本权威。

例如 A 将第 2 段从 X 改成 Y，生成 S1；B 改标题，生成 S2；C 发布 S2。A 的事件比较 S0 / S1，B 的事件比较 S1 / S2，C 的发布事件比较之前 Public / S2。不能用 C 的发布事件替代前两人的编辑事实。

Article 即使当前无 Binding，既有历史仍然保留，不为了记事件创建假 Community。本轮不要求增加“零站点入口继续发布”的产品功能。现有 Publisher 的 Doc 正文 / 站点发布耦合由 D1 拆分；独立指正文发布不经过站点 Queue，并不等于没有站点入口也必须允许发布。社区 Activity 仍只记录确有站点归属的活动，不通过把 community_id 改成随意可空来扩大整个 Activity 模型。ArticleEvent 不依赖 Activity 成功投影，相关投影若保留应明确过滤和去重规则。

## 2. 已核实基础与缺口

| 当前实现 / 合同                                                                                        | 可复用 / 需改部分                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Articles.WorkingCopy.Store 原地更新、推进 revision / updated_by                                        | 锁和 revision 沿用；不能由最新 updated_by 还原过去贡献                                                                                       |
| Articles.WorkingCopy.Snapshotter，source_working_copy_id + source_revision 唯一                        | 复用完整不可变内容与幂等固定，不另建正文历史表                                                                                               |
| ArticleSnapshot.captured_by / captured_at                                                              | 只表达捕获事实，不能直接作为修改者 / 修改时间                                                                                                |
| Articles.WorkingCopy.Diff.compare                                                                      | JSON 节点 / 字段 / tags 有比较结果；CoverEdit / asset refs 目前主要返回是否变化的 boolean，需要新增结构化 before / after，不能当已有完整详情 |
| 现有 Activity：普通 Publisher 写 created / title_changed / body_updated，Doc QueueRelease 写 published | 不是逐次草稿历史；article_events 独立记录发布，社区活动仅保留真实站点语义                                                                    |
| DocTree.Publication.Query.diff / Publication DiffPane、diffModel                                       | 当前比较站点 Queue / 审批基线；迁移后正文比较转用本基座，站点只显示 tree diff                                                                |

实现入口包含 articles/commands/save_working_copy.ex、working_copy/store.ex、snapshotter.ex、publisher.ex、diff.ex、DocTree 保存 / 恢复 / 合入 / 发布、Content Publisher action adapters、ArticleEditor 与 Docs Publication。先枚举真实写入口，不用 grep 到的一个 save 命令代表全部。

## 3. 数据合同

### 3.1 完整内容复用 Snapshot

每个被历史引用的版本使用已有 ArticleSnapshot、独占 ArticleBody、typed 字段、tags、CoverEditSnapshot 与 asset refs。immutable owner 及同 Article 约束继续使用现有基座，不创建第二份 JSON 或补丁日志作为正文权威。相同 WorkingCopy ID / revision 仅有一个 Snapshot。

首次记录已有 WorkingCopy 时固定真实当前内容作 baseline；不伪造过去的编辑者，也不将 baseline 捕获者标记为这份正文的作者。Snapshot 捕获时间不替代历史事件时间。

### 3.2 修改 / 发布事件

新增 cms.article_events（不依赖成员行）：

```text
id uuid PK
article_id uuid NOT NULL FK articles RESTRICT
sequence bigint NOT NULL CHECK > 0
actor_type text NOT NULL CHECK IN ('user', 'system')
actor_id bigint NULL FK account.users RESTRICT
source text NOT NULL CHECK IN ('browser', 'import', 'system')
service_ref text NULL                经验证的服务身份，不是用户身份
actor_snapshot jsonb NOT NULL
occurred_at timestamptz NOT NULL
operation_ref uuid NOT NULL
operation_index integer NOT NULL DEFAULT 0 CHECK >= 0
type text NOT NULL CHECK IN ('create', 'edit', 'restore', 'fork', 'publish')
working_copy_id uuid NULL                 来源身份，不 FK 可删除的 WorkingCopy
before_revision bigint NULL CHECK > 0
after_revision bigint NULL CHECK > 0
before_snapshot_id uuid NULL
  FK (article_id, before_snapshot_id) -> article_snapshots(article_id, id) RESTRICT
after_snapshot_id uuid NOT NULL
  FK (article_id, after_snapshot_id) -> article_snapshots(article_id, id) RESTRICT
source_snapshot_id uuid NULL              fork / restore 来源，同 Article 复合 FK RESTRICT
previous_event_id uuid NULL               同 WorkingCopy 上一个内容事件，同 Article 复合 FK RESTRICT
source_community_id bigint NULL FK communities ON DELETE SET NULL
inserted_at timestamptz NOT NULL
UNIQUE(article_id, id)
UNIQUE(article_id, sequence)
UNIQUE(operation_ref, operation_index)
INDEX(article_id, sequence DESC)
CHECK ((actor_type = 'user' AND actor_id IS NOT NULL) OR
       (actor_type = 'system' AND actor_id IS NULL))
```

- occurred_at 是服务端接受本次业务操作的 UTC 时间，inserted_at 是事件行写入时间；两者首版通常相同。禁止使用客户端时间伪造修改先后，排序始终使用 sequence。
- sequence 在 Article 锁内分配，严格递增，用于排序 / 游标，不用时间或 UUID 推导先后；首次分配 1，之后从该 Article 最大值推进，索引支持查尾部。
- operation_ref 使用 Receipt 持久化的全局 operation UUID，与该次命令的 Activity / Outbox 共用；客户端 commandId 保留为 Receipt 的外部重试身份。Job / workflow 使用各自持久化的 operation UUID；一个命令可产生多个不同 type 或涉及多个 Article，operation_index 在整个 operation 内唯一分配，不能每个 Article 从 0 重置；按固定 operation_index 排列，例如 create + publish。Receipt 重试不重复插入。资产批量替换以持久化 workflow step 的 operation_ref UUID 标识单步操作，operation_index 固定为 0；租约重试和恢复复用该 UUID，不能从字符串引用临时生成或在重试时重建。
- actor 从已认证 delegated user 或真实系统 actor 确定，禁止 payload 指定任意用户。导入创建记 create，导入替换记 edit，source = import，不为入口单独增加一种修改语义；有 delegated user 时归因该用户并记录 service_ref，无 delegated user 的可信系统任务以 system actor 记录，不能将 service 名冒充作者。actor_snapshot 保存既有账号展示快照；账号删除后展示“已删除用户”，不把新账号同名 login 当历史身份。
- Snapshot 已有 UNIQUE(article_id, id)，本事件表同样声明该约束以支持自引用复合 FK。previous_event 必须是同 WorkingCopy 的较早非 publish 事件，在锁内验证，不允许环。
- before / after Snapshot 必须属于事件 Article；编辑链 before_revision < after_revision，working_copy_id 非空；before_snapshot 的内容必须等于修改前完整内容，即使 no-op 推进过 revision 也不能错误断链。publish 的 before_snapshot 可以为空（首发），不要求 WorkingCopy 或 revision 存在。
- create / fork 可无 before_snapshot；同 Article 历史 fork 有 source_snapshot_id。复制为新 Article identity 的 Docs fork 因来源 Snapshot 不属于目标 Article，记录无 source_snapshot_id 的 fork，贡献者结果明确为 unknown，不把 forker 当正文贡献者；source_snapshot_id 仍受同 Article 复合 FK 保护。restore 必须有 source_snapshot_id。previous_event_id 在锁内从同一 WorkingCopy 最后内容事件取得；publish 独立记录旧 Public，不把它串入编辑链。用数据库 CHECK 固定各 type 的必填组合。
- source_community_id 仅说明实际站点入口，不决定历史归属或授权。删除没有消费者的 source_scope_type 自由文本列；首版不预建枚举或混合 workspace / system 分类。actor FK 与协作事件统一为 account.users RESTRICT，system actor 允许为空；当前账号物理删除保护继续生效，未来受控账号删除须显式处理引用和展示快照，不暗中改变为自动删除 / 置空策略。
- 不在事件存正文副本、用户 token、生成格式全集。Snapshot 是内容权威，事件是操作归因权威，Community Activity 只记录真实站点活动；不能将它当作无站点归属文章的必需投影，也不能用它反推修改链。

## 4. 保存、恢复、发布的事务

### 4.1 成功修改

```text
Receipt / domain transaction
  -> 按 Passport 共享锁序取得本次需要的站点、Article、WorkingCopy 等资源锁
  -> Gate 使用 canonical 资源与 Passport facts
  -> 校验提交 revision，读取并固定修改前完整状态 S_before
  -> 保存完整 BodyBag / metadata / tags / cover / asset refs，推进 revision
  -> 比较完整内容
       有变化 -> 固定 S_after -> 写 edit / restore 事件
       无变化 -> 不写修改事件；继续遵守原 revision 推进协议
  -> Snapshot / 事件 / refs / Receipt 一次提交
```

冻结修改前状态必须在修改 typed fields、tags、CoverEdit、Body 或 refs 之前。现有 Store 会先修改部分关系，不能到保存完成后再尝试从同一 work 重建 before。首次无法预判是否变化可先建 baseline；无变化时允许复用 / 保留这份 baseline，但不能伪造编辑事件。失败整笔回滚，不残留半份 Snapshot 或孤立 refs。

新建 Article 的初始状态记录 create；同 Article fork 从 Snapshot 建新的 WorkingCopy 时记录 fork 及 source，不宣称操作者重写了全部正文。Docs duplicate 会建立新的 Article identity，来源 Snapshot 无法作为目标 Article 的同 Article 历史引用，因此记录无链接 fork 并将 contributors 标为 unknown；不猜源作者，也不把复制操作者算作正文贡献者。显式恢复先保存被覆盖的当前状态，记录 restore 的 before / after 与来源 Snapshot；若内容完全相同，不产生修改事件。恢复不自动 publish，也不修改来源 Snapshot。

完整锁序唯一见 [共享锁序](../../migrations/passport-permissions-refactor.md#42-本轮写入共享锁序唯一维护位置)，本节不另定义另一条锁链。记录历史不为了满足表结构强加 Community Binding；是否允许当前编辑 / 发布仍遵循对应产品入口，不新增零站点发布功能；涉及站点的旧路径保留 Community 首锁。History 内部步骤不新开事务，也不独立做第二次 Gate 加载。

### 4.2 发布

```text
当前 Public S0 -> 选择 S2 -> PublicBody + Public 原子更新
  -> publish 事件：actor C，before S0，after S2
  -> 原有 Review / Mention / Search / Press / cache Outbox
```

WorkingCopy 已由保存固定为 S2 时直接复用，不重复固定。选择历史 Snapshot 重新公开也写 publish，发布旧版本不会重写编辑事件。相同 Snapshot 的无变化公开选择不新增发布事件；同 commandId 重放返回原发布结果。一个新建并发布命令可以生成 create、publish 两事件，operation_index 固定且事务回滚一致。

发布事件只能说“C 发布了这些差异”；贡献者从修改链 / 历史恢复来源和 fork 来源追溯。正文 Review 的自审检查保留被审版本来源中的实际贡献者，不能只查当前成员或 Snapshot 捕获者。按 previous_event_id 和 fork / restore 的 source_snapshot_id 追溯实际来源；Doc Queue 合入产生的 edit 若有实际字段从 default 来源合入，也记录同 Article 的 source_snapshot_id，H2 汇总必须沿该 edit 来源追溯，避免遗漏源修改贡献者。全部保留目标值或内容无变化不编造来源事件；no-op revision 空档不截断事件链。贡献者收集 create / edit / restore 的实际操作人及其来源，纯 fork / publish 不新增内容贡献者。来源链可增加可重建的去重贡献者索引提升查询，但不是第二份权限权威，不因成员退出清除。

## 5. Diff 协议与查询

输入为同一 Article 的 beforeSnapshotId / afterSnapshotId；编辑器当前预览可比较 WorkingCopy 指定 revision 与 Snapshot，读取时同一一致性快照核对 revision，不将当前预览伪装成已提交历史。

```text
ArticleDiff
  articleId / beforeSnapshotId / afterSnapshotId
  body: added / removed / changed / moved / equal
  fields: 每字段 before / after
  tags: added / removed
  cover: 成品选择、画布属性及图层 before / after
  assetRefs: added / removed / changed
```

- Plate JSON 为正文依据；对象键顺序忽略，数组顺序保留；有稳定节点 ID 以 ID 匹配，缺 ID 按位置降级并明确提示，重复 ID 必须在写入验证时拒绝或明确标记降级，不能 Map 覆盖导致遗漏。
- 块顺序变化与文本 / 属性变化分别表达。节点移动不得误显示为作者删除后重写；嵌套块、marks、links、图片 / embed 属性参与比较。
- tags 按集合；附件比较 asset 身份、usage、位置、block、alt、title。封面不能只回 true / false，详情应可查看旧 / 新选择及结构化差异。
- HTML / Markdown / TOC / 缩略图等派生输出不单列为用户修改。正文相同但派生格式重建不伪造内容编辑事件。不新增 bodyHash / ContentFingerprint。
- 正文事件与 Diff 不包含 Docs tree、站点路径、评论、统计或 Review 状态；tree diff 由 Docs 拥有。

授权：修改历史、所有非公开 Snapshot 与 Diff 必须检查 article.history.read；访问 WorkingCopy 另需 article.read_draft。请求中任一 Snapshot 不属于该 Article 则拒绝；无权限不返回标题、数量、片段或内部 ID。Community 管理权或旧 Release 观察记录不能单独授权读取全局草稿历史。

目标字段：pagedArticleEvents(articleId, pagi, type)、articleEvent(articleId, eventId)、articleDiff(articleId, before, after)。before / after 是带 type 的输入：snapshot 分支仅带 snapshotId，working_copy 分支仅带 workingCopyId + revision；本期 before 固定 snapshot，after 可选两种分支，不支持 WorkingCopy ↔ WorkingCopy 或任意未保存的旧 WorkingCopy revision 比较，互斥字段组合由 schema / parser 校验。历史事件详情始终使用两个 Snapshot；working_copy 分支只用于当前预览，另需 article.read_draft，旧 revision 返回冲突，不强制为无变化保存补 Snapshot。列表返回事件 actor / occurredAt / type / before / after refs，详情按需加载内容，沿用 Pagi keyset 的 sequence 游标，保证新写入不使旧页重复。前端必须显示操作者和 UTC 转本地时间，区分修改 / 恢复 / 发布；可按 actor / type 筛选，筛选仍在 SQL 及授权 scope 内完成。

### 5.1 公开动态、编辑历史及协作记录

保留现有 pagedArticleLogs 作为经过公开读取 / Activity 投影规则过滤的“公开动态”；它不展示未发布编辑，不与 pagedArticleEvents 互相替代。Dash 的“编辑历史”使用 article_events 并执行 article.history.read；“协作记录”展示 article_co_author_events 并执行共同作者管理权限，不把成员权限变更当作正文编辑。两个事件表分别保存版本操作与成员授权事实，因此独立存在；页面分栏 / 分页，不强行拼成一条缺少统一顺序语义的列表。

publish 类型的 articleEvent 详情提供 contributors 分页字段，返回本次相对 before Public 的编辑来源中的稳定用户展示身份及关联编辑事件引用；按 type / previous_event / source_snapshot 的既定规则由后端汇总，去重、执行历史授权。没有已记录来源的 baseline，或无同 Article 来源引用的跨 Article fork，明确标记 unknown，不猜作者。纯 fork / publish 操作者不计作内容贡献者。owner / 发布者不因身份自动算贡献者，除非确有对应修改。前端不逐条请求和遍历事件链；H2 提供查询与无 N+1 测试，H3 展示“发布者”和“本次修改参与者”。这些来源参与者用于操作追溯，不宣称当前每个字符最终由谁撰写。

## 6. 保留与存量切换

- 本基座事件引用的 Snapshot、Body、CoverEdit、资产引用均为正式历史保护，不被时间清理、WorkingCopy 删除、单站 Trash、移除 co-author 或最后一个 Binding 删除清理。
- 资产替换 / provider 清理必须把这些 Snapshot 引用算入保护集合，不能只保留 JSON 而丢图片文件。
- 现有 retained history / history owner 和全局永久删除需增加 event FK 处置；单社区删除不能级联全局 Article 历史。全局 article.permanent_delete 与普通保留规则的边界按 §6.1 执行，不使用无条件 CASCADE。
- 历史读取不要求存在当前 WorkingCopy / Binding；仍执行 Article 历史权限及 Gate 限制。
- 切换前存量 Snapshot / Public 保留；首次编辑建立 baseline，并明确“此前逐次修改未记录”。不从 updated_by / captured_by 伪造过去编辑链；不丢弃有效存量正文。
- 保存每次实际变化会增加 Snapshot / Body 存储量，这是本合同明确的产品成本。首版不隐式按时间合并或清理以牺牲追溯粒度；实现后验证存储增长、自动保存与大正文性能；发现明显退化时修复，不额外建立逐项签字或预先冻结阈值的流程。

### 6.1 删除范围与历史结果

| 操作                                     | 历史结果                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| community.article.hide / 本站 Trash 清理 | 仅移除本站入口及本站事实；Article 正文、评论、Snapshot、两类 Article 事件保留                                             |
| community.article.restore                | 仅恢复本站展示关系；Doc 先恢复工作区、再 Release，不绕过全局 Trash / Review                                               |
| article.trash                            | 全局退出正常公开读取；历史保留，可按现有恢复合同恢复                                                                      |
| article.restore                          | 恢复 Article 状态；不自动重建已删除站点页面或回滚 Release                                                                 |
| article.permanent_delete                 | 专用永久删除命令若通过全部引用 / 历史保护条件并执行成功，清除该 Article 及其专属 Snapshot、正文和事件，不再承诺可恢复历史 |

两类 Trash 的 Action / 查询分流、非 Doc Binding Trash 结构及旧授权处置以 [Passport §4.3–§4.5](../../migrations/passport-permissions-refactor.md#43-article-与社区展示操作的完整-action-清单) 为唯一合同。本站 Admin 可下线 / 恢复本站和读取本站 Trash；全局 Article Trash / 恢复 / 永久删除仅 owner / root，移除旧社区授权的全局能力须列入 P0 差异报告，不视为纯命名变化。

全局 / 本站 Trash 的 Activity 社区选择、operation_scope / effect、Doc 计划与实际公开生效区分统一见 [Passport §4.4.1](../../migrations/passport-permissions-refactor.md#441-activity-投影与审计社区)。本站 Activity 不能投影成全局正文恢复；全局恢复从原 Trash 捕获审计社区后再删记录。永久删除验收新增“Article 带本站 Binding Trash、获准全局删除时先清记录再清 Binding”以及“其它引用仍受保护时全事务回滚”。

永久删除不是本次新建的普通 destroy / purge 入口；沿用既有明确命令，并在接入新事件表后补齐完整依赖清理与独立操作审计。仍有其他站点 / 正式历史保护引用而未获全局清理许可时必须拒绝，不能以“最后一个 Binding 没了”自动清理。执行界面 / 运维入口明确不可恢复，操作审计具体写入现有 Activity 对应 thread stream 的 permanently_deleted 事件，社区上下文固定取发起永久删除命令的 Trash 所在 Community（沿用现有 Trash 工作流），operation_ref 与删除命令一致；保留 actor / 原 Article UUID / 操作时间等既有 action contract 允许的事实，不额外保存被删除正文；若需加入删除原因，必须同批显式扩展 permanently_deleted 的 Activity contract 和安全投影，不能向当前空 payload 合同随意塞字段。20261001090000_preserve_article_activity_after_deletion 的 up() 已移除这些 stream 的 Article FK，故 Article 删除后事件保留；其 down() 恢复 CASCADE 不是当前正常迁移行为。保证范围是 Article 删除，不承诺 Community 销毁后改变 Activity 原有保留规则。旧 cms.audit_logs 已由 20260819091000_drop_legacy_cms_audit_logs 删除，禁止恢复旧表作为新审计落点。其他镜像站点不重复写 permanently_deleted；保留的 Release / 站点记录继续按各自合同管理，不能承诺依赖即将被清理的 ArticleEvent 保留永久删除审计。没有当前 Binding 不等于没有 Trash：只要有真实可用的 Trash / Community 上下文，仍可按保护引用规则执行；无此上下文时返回明确领域错误 permanent_delete_context_required，不能静默跳过，也不新增 system 审计通道或伪造社区。永久删除失败整笔回滚；其余任何普通删除都不得顺手删历史。本批不扩大永久删除权限或新增 owner 不可用的恢复流程。

### 6.2 permanent_delete 依赖处置清单

H1 按实际外键 / 消费者盘点补全处置顺序，永久删除命令必须按共享锁序、同一事务核对并处理下表；此表不是按行机械删除的 SQL 顺序。所有正式引用保护先判定，任一步失败整笔回滚。

| 对象                                                                      | 处置                                                                                                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binding、Docs 活动树 / Queue、history owner、正式 Release / Approval 引用 | 先按全局删除合同检查保护；仍需保留的引用阻断删除，不能为删 Article 擅自移除其他站点；获准全局清理才按依赖显式解除                                                                 |
| cms.article_binding_trash                                                 | 获准删除后先清目标 Article 的本站 Trash 行，再删除对应 Binding / Article；RESTRICT 不能靠 CASCADE 绕过。其它 Article / 站点事实不受影响，Doc 正常不写该表；旧异常行显式报告后处置 |
| Public / PublicBody、WorkingCopy、Lifecycle、Trash                        | 清目标 Article 的专属行；不影响其他 Article，公开失效意图和实际删除同事务落 Outbox                                                                                                |
| Review 目标 / 请求 / 限制、AlertWall                                      | 使目标失效，延迟结果不得复活已删内容；审核原责任记录按对应领域保留合同处理                                                                                                        |
| Comment / replies / reactions / read-state / counters                     | 清理目标 Article 的共享互动聚合；这是全局永久删除，不是单站移除，不能复用站点 Trash 入口                                                                                          |
| Mention endpoint / edges / 关系版本                                       | 解除目标 / 来源引用，按 Mention 当前关系合同处置；相邻未删除资源不被误删                                                                                                          |
| Article co-author members / requests / article_co_author_events           | 捕获必要删除审计后显式按 RESTRICT 依赖清理，不依赖已删除成员反查 subject                                                                                                          |
| article_events（含自引用）、Snapshot / Body / CoverEdit、asset refs       | 先解除仅属于本聚合的事件及其他受批准引用，再清专属版本；不能删除被外部正式历史引用的版本                                                                                          |
| Asset 实体与 provider 文件                                                | 只解除本 Article 的 refs；共享资产有其他引用时保留，provider 删除仍经资产域既有可靠清理，不在事务内直接发网络删除                                                                 |
| mentions / notices（含 request 分支）、Dedup、待发通知与 job              | 失效已删目标可见内容与跳转，禁止删除后延迟通知复活；保留必要幂等墓碑 / claim，避免清 key 后重放重新发出通知                                                                       |
| Search / Press / feed / CDN / cache effects                               | 事务内落失效意图，提交后可靠执行，消费者按当前不存在事实抑制旧写回                                                                                                                |
| Activity permanently_deleted                                              | 保留，无目标 Article FK；不得作为聚合清理的一部分删除                                                                                                                             |

永久删除验收须同时证明：新 RESTRICT / 自引用全部按批准清单解除、普通删除仍保留历史、共享 refs 未误删、删除后审计可查、旧 worker / Notice 不复活内容；注入任一步失败后 Article / 事件 / 引用仍一致。此清单不新增全局删除入口或 owner 接管功能。

## 7. 批次、验证与交付

### 后续项

- [ ] 接通 Community GEditor 发布按钮发出的事件与实际发布命令，使该入口发布时也写入 Article 发布历史；补充从编辑器发布到历史列表 / Diff 可见的定向联调验收。本项不阻塞 H1 / H2 定向验证，但完成前不能认定 Community GEditor 发布路径验收通过。

| 批次                   | 主要工作                                                                                                                          | 完成条件                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **H1：历史记录基础**   | 核对事件与版本模型及真实写入口；补齐 Article 保存、发布等写入路径的事件和 Snapshot 关联；落实删除清理、历史资产引用保护及共享锁序 | 每种成功写入路径都有对应事件；失败和 no-op 不产生错误事件；删除及资产保护规则明确；定向数据库测试覆盖成功、失败、回滚、并发、重放和清理 |
| **H2：Diff**           | 确定比较版本范围与输出格式；实现历史版本比较，覆盖新增、删除、修改、空版本及不兼容内容；落实历史查询权限和资源范围                | Diff 稳定、可重复；权限与资源范围正确；定向测试覆盖边界案例                                                                             |
| **H3：历史界面与联调** | 展示版本列表、选择比较版本、呈现 Diff；接入读取权限、加载和错误状态；端到端联调                                                   | 从保存版本到用户看到正确差异的链路验收通过                                                                                              |

先完成 H1 再开始 H2。H1 的事件 / Snapshot 数据合同、历史查询合同和共享锁序稳定后，H3 可与 H2 并行开发；整体端到端验收必须等待 H1、H2 都通过。Article 保存 / 发布、历史查询、锁序和资产保护等共享入口由同一责任人串行合入，避免与 Passport 或其他工作流改动相互覆盖。P1 已完成并作为当前权限前提，不等待 Passport P4、Co-authors 或 Docs Mirror 主体批次。上述批次不要求 Co-authors 写入入口先启用；多人编辑归因场景可在其接入时复用本计划验收。Docs Mirror 的站点目录历史按其自身计划推进，不阻塞 Article 正文 Diff。跨文档内容仅作领域合同参考，不改变本计划批次顺序。

验收矩阵：

| 场景                                                        | 必须结果                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 改正文、B 改标题、C 发布                                  | 用隔离测试数据独立验证三事件归因、逐次 Diff 与公开汇总 Diff。真实成员通过普通 Article 编辑入口的多人联调归 Co-Authors C2                                 |
| 同 revision 两客户端保存                                    | 一方成功；另一方冲突，没有冲突方成功事件                                                                                                                 |
| 成功响应丢失再重放                                          | Snapshot、事件、Activity / Outbox 不重复                                                                                                                 |
| typed / tag / cover / asset 任一步失败                      | work、before / after、事件、refs 全部回滚                                                                                                                |
| no-op 保存                                                  | revision 按既有合同推进，无 edit 事件                                                                                                                    |
| restore / fork / 发布旧 Snapshot                            | 来源可追溯，不改旧内容、不虚构贡献者                                                                                                                     |
| 同毫秒多个事件、跨页新写入                                  | sequence 稳定排序，无漏项或重复                                                                                                                          |
| 跨 Article Snapshot、无 history 权限、社区 Admin 读草稿历史 | 拒绝且不漏片段 / 元数据                                                                                                                                  |
| 删除成员 / 副本 / 本站页面 / Trash                          | 历史和资产仍可由有权用户读取                                                                                                                             |
| JSON 键序、marks、嵌套、块移动、媒体、tags、封面            | 正确区分内容变化及移动，派生格式无假差异                                                                                                                 |
| 大正文及连续自动保存                                        | 记录存储增量、保存延迟、分页 / diff 延迟及超时，满足仓库既有性能预算；没有现成预算时先实现，再用隔离测试数据测量并排查明显退化，不以预先冻结阈值阻塞开发 |

执行 focused Store / Snapshotter / Diff / History / Publish / Restore / Assets / Review 数据库测试，mix compile --warnings-as-errors；schema / codegen / generated freshness、Editor type-check / tests；真实浏览器 /home/xx 验证保存后的历史列表及版本比较。此前浏览器曾通过 `saveWorkingCopy` 写入标题变化并确认旧 / 新标题 Diff；之后本轮将 Diff 查询改为 typed input，因此该浏览器结果不覆盖当前合同。Docs Publication 当前通过定向前端测试，真实 GraphQL / 浏览器链路仍待验收；永久删除的核心聚合清理已接通，但 §6.2 全部依赖组合与跨步骤失败注入仍待完整验收。冲突、恢复的权限和回滚由定向数据库测试覆盖，未声称做了这些路径的浏览器验收。docs:check 仅作为文档 / 静态门禁，不验证历史归因或 Diff 语义。列出实际执行与未覆盖项，不以静态文档通过代替产品验收。
