# MentionsGraph 全链路设计与实现评审

> 状态：第 1–12 节保留阶段性设计与复核；当前工作区简化边界见第 13 节及[当前关系合同](./mentions-graph-sync-contract.md)。B4 空库切换已执行；本轮简化改造尚未部署。
>
> 范围：正文提及的提取、目标确认、版本记录、当前关系、通知、查询、前端缓存、初始化与恢复，以及模块和测试边界。B4 已发生的切换事实见[切换手册](../../deploy/runbooks/mentions-graph-cutover.md)；旧[重构执行合同](./mentions-graph-refactor.md)、[联合验收](./mentions-graph-doc-comment-joint-acceptance.md)与[B2 性能记录](./mentions-graph-b2-performance-acceptance.md)是各自阶段的证据，不是下一轮简化改造的验收合同。

> 2026-11-07 已按[简化重构清单](./mentions-graph-simplification-plan.md)在工作区改造：全新空库上线，不带入 B4 旧内容或旧边，不做旧 parser 版本兼容；Doc 仅公开 main 参与 Mention，非 main branch 不作为独立来源或目标。本文第 1–12 节关于初始化、历史 set、重建、状态脱敏和请求级 SQL 预算的结论均为阶段记录，不是当前发布合同。

## 1. 结论与边界

当前实现**确有过度复杂之处**。主要复杂度不是文件长度或表数量本身，而是：一次正文变更先保存关系事实，再由 Outbox 把另一份“当前关系”改为新版本；为两份状态的时间差又增加水位、全局 revision、待投影检查、前端轮询和恢复分支。`Parser`、`Store`、`MentionsGraph.Query` 还分别混合了多种职责，使这种复杂度难以局部验证。

以下能力有明确产品或安全用途，不能因为代码复杂就直接删除：稳定的 Article/Doc `article_id` 和 Comment `comment_id`、Comment 稳定父级、公开来源与不可读目标的非对称披露规则、批量 Gate 校验、有界分页、可靠通知、旧已确认引用在目标隐藏后的受限沿用、初始化和重建能力。这些是重构时必须保持的**行为**，不等于必须保留现有模块与状态表。

本评审建议将“**正文提交与当前关系同时生效**”作为首选目标方案，通过代表性写入负载验证后再决定是否实施。若写事务延迟或锁竞争不可接受，则保留异步投影，但应明确它是经实测选择的架构，而非默认叠加的复杂度。任何方案都要修正 occurrence 位置唯一性和前端跨页版本一致性。

## 2. 当前链路：为什么难以理解

```text
Article / Doc / Comment / Ticket 的写入
  └─ Commands.CaptureCurrentVersion
       ├─ Parser：多次扫描 Plate AST；检查 URL/身份；查询目标；初始化另走一套解析
       ├─ Store：继承旧绑定；保存 set 与 occurrence；计算通知对象；设置 desired 水位
       └─ Outbox：稍后投影
            ├─ 再核对当前正文 token
            ├─ 删除并重建该来源的 current edge；设置 synced 水位；递增 revision
            └─ 投递 User 通知

GraphQL 图页 / 列表
  ├─ 读取全局 revision
  ├─ 批量校验节点、查当前边、组装结果
  ├─ 检查 Community 内任何公开来源是否仍待投影
  └─ 再读全局 revision；变化则整页失败

前端 Mentions tab
  ├─ 缓存并合并多张图页
  └─ 独立轮询 revision；变化后清空并重查
```

这条链路中的 `set` 是某版正文的完整引用记录，`occurrence` 是引用在正文中的一次出现，`current edge` 是当前图/列表实际查询的关系。`desired/synced` 表示作业期望投影的版本与已经投影的版本。它们各有含义，但整体让“正文已经发布、图仍显示上一版”成为常态可能性，因而需要一套额外的对账协议。

## 3. 已确认问题

### P0：text 节点 URL 的位置冲突，须按已决定的输入合同移除触发路径

当前 [`Parser.extract_links_from_text/1`](../../../backend/api/lib/groupher_server/cms/artiment_mentions/parser.ex) 用 `Enum.uniq(hrefs ++ urls)` 按 URL 值去重。同一 text 节点中重复写同一 URL 时，第二次出现会在提取阶段消失，`occurrences_count` 因而少算。对两条**不同** URL，text 扫描把相同的 `block_id` 和 AST `path` 传给两条引用；旧 `Store.base_occurrence/2`（现见 [Persist](../../../backend/api/lib/groupher_server/cms/artiment_mentions/persist.ex)）用 `block_id:path` 生成 `occurrence_key`；`Occurrence`（历史文件，已删除） 对 `(set_id, occurrence_key)` 设唯一约束，保存同一 set 时可能冲突并使正文写入回滚。

更早的故障发生在旧引用沿用阶段：旧 `Store.inherit_candidates/4`（已删除）以该 key 执行 `Map.put`，位置相同的两条内部引用可能互相覆盖，造成丢失或错配；不能只靠数据库唯一约束发现问题。

**当时决定、现已在工作区实施的输入合同**：三类输入分别处理。① canonical Plate AST 中带 `url/href` 的 `a/link` 节点和带 key 的 `mention` 节点建立关系；② text 节点中的 raw HTML `<a>`；③ text 节点中的裸 URL，后两类均为普通文字，不产生内部边、URL target 或 occurrence，也不参与初始化。实施时只移除 `extract_links_from_text/1` 及 text 中的 URL/HTML 提取，**保留 `children` 递归**，不能把 text 分支里的 `collect_children_mentions` 一同删掉而漏掉嵌套的结构化引用。若未来支持裸链接，应由 Content Publisher 将其转换成结构化 link 后再交给 Mentions，另行定义历史正文处理。

结构化 link 的 URL 来自节点属性；label 的**纯文本部分**即使也是 URL 也不独立计数，label 内的结构化子节点仍按各自节点规则处理。因此 `<a href=A>A</a>` 与 `<a href=A>B</a>` 都各算**一条**；两个独立的 `a/link` 节点，即便 URL 相同，也按各自 AST 路径算**两条**。text 节点中相同或不同的两个裸 URL、raw HTML anchor 及其纯文本 label 均不计数。这里的“同一链接”以一个结构化节点及其完整渲染跨度为边界，不按 URL 值合并两个节点，也不在 text HTML 字符串里比较正则起点。验收要覆盖 Article、Doc、Comment、Ticket 与初始化的真实 canonical 输入，避免仅用手写 Store fixture 证明位置与继承。

### P1：图页未携带用于合并的版本

后端 [`MentionsGraph.Query.page/4`](../../../backend/api/lib/groupher_server/cms/artiment_mentions/mentions_graph/query.ex) 在请求前后校验全局 revision，并把 revision 写入 cursor；但图页返回值没有该 revision。前端 [`useMentionsGraph`](../../../frontend/core/unit/MentionsGraph/useMentionsGraph.ts) 按节点/边 ID 合并多张缓存页，另由 [`mentionsGraph.ts`](../../../frontend/core/query/mentionsGraph.ts) 每 30 秒独立查询 revision。后端能证明**单页**读取期间 revision 未变，前端却不能证明**多页**属于同一 revision。目标或来源失去可读性后，旧页可能仍带有此前可见的标题和 URL；这是隐私问题。`staleTime: 30_000` 只控制新鲜度，不能当作最坏暴露窗口：缓存保留、后台暂停轮询、离线及在途响应都会影响旧内容的存留。

**目标合同**：每张图页、评论入口页和相关列表页返回生成该页时使用的、与 `mentionsGraphRevision` 同格式的 **opaque revision**，不暴露数据库整数；同一视图只合并相同 revision 的页。发现变化后清除旧节点展示数据和 cursor；修订前发起、修订后才返回的请求也不得重新写回旧标题或 URL。重新打开或切回 tab 时，应在展示已缓存的敏感字段前完成版本核验；无法核验时显示中性占位。旧请求可取消，但仍须在响应进入缓存及组图时检查版本。当前 cursor 拒绝后的 `restart` 仅 `exact` 重置默认首批 query key，而 revision 变化才重置整个 Community 前缀；需专项测试其他已缓存 frontier 页和在途响应。独立轮询可帮助发现变化，不能代替页自身校验。服务端已交付给浏览器的数据无法瞬时撤回；若产品要求有界的实时撤回时限，须单独规定主动通知及离线行为，不能虚构一个 30 秒上限。

### P1：全局 revision 让无关写入影响当前图读取

[`MentionsGraphRevision`](../../../backend/api/lib/groupher_server/cms/artiment_mentions/mentions_graph/revision.ex) 使用单行整数；图页/列表读取前后比较，两次之间任何影响 Mentions 结果或公开状态的 revision bump 都可能让当前请求失败，旧 cursor 也随之失效。这是现行[执行合同](./mentions-graph-refactor.md)明确规定的保守一致性策略，不能悄悄更改；但它的影响是全局的，而查询只展示一个 Community 中的有限邻接。单行递增还使写事务经过同一个更新点。[B2 记录](./mentions-graph-b2-performance-acceptance.md)已有并发改版下首次成功率不足的证据，总性能出口仍为 `PARTIAL`。

**建议**：先把 revision 随页返回，记录真实的重启率、失败率和该行锁等待；逐一审计 Article/Doc/Comment 的审核、Community binding、父级可读性、软删/恢复和其他影响披露的写入路径是否在同一事务 bump。普通发布可能在 `Store.mark_desired_set` 和 Article/Doc/Comment 收尾各 bump 一次，worker 在另一事务追平时再 bump；一次发布事务内的多次更新只有一次对外可见提交，却增加 SQL 和持锁时间。完整发布压测须计入真实 bump 次数，不得用一次人工 bump 代替。随后再比较全局版本、按可见查询范围版本、或稳定快照分页的成本。不能仅把一行拆成多行：跨 Community 链接及目标权限变化仍需正确失效。也不能把客户端重试后的成功率当作首次成功率。

### P1：每次读取都扫描 Community 范围的 pending 来源

[`MentionsGraph.Query.projection_pending/3`](../../../backend/api/lib/groupher_server/cms/artiment_mentions/mentions_graph/query.ex) 不使用传入的节点，构造 Post、Blog、Changelog、Doc、Ticket、Comment 多路公开来源查询，回答“此 Community 有没有任何公开来源待投影”。一个无关来源未完成，就可以让当前图页显示 pending。它扩大了查询成本，也没有表达“当前焦点的关系是否已完成”。

**建议**：同步维护当前关系若通过写入验收，删除这条读取路径及 desired/synced 状态。若保留异步方案，pending 应明确是产品所需的全 Community 状态，还是当前焦点/返回来源的状态；按该语义重新设计查询和 UI 文案，不要保留一个误导性布尔值。

## 4. 结构与命名问题

| 现状                                                                                                        | 问题                                                                                          | 建议归属                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CurrentSource.load` 单独负责读取 Article/Doc/Comment 当前正文及 token，且被投影、通知、重建调用            | 它是资源读取，不是一个独立的 Mentions 业务对象；`load` 也看不出返回什么                       | 优先复用 `CMS.FrontDesk` 的可信内部读取。核对其现有 Article/Comment view 是否足以返回 Doc 当前 main 及正文版本；不足时补通用资源读取视图，避免在 Mentions 下另造同义入口。                                             |
| `Commands.CaptureCurrentVersion.execute_in_transaction` 被 Article、Doc、Comment、Ticket 的其他写入流程调用 | 它不是独立的完整业务 Command；名称暴露了实现步骤，且六七个位置参数难辨                        | 由 `CMS.ArtimentMentions` 提供一个表达业务动作的内部入口，例如 `record_mentions(body, source)`；实际输入结构应按现有写入 Command 的正文和身份对象确定，不先引入万能参数包。独立初始化、重建仍保留各自授权入口。        |
| `Parser.candidates`、`parse`、`validate_url_lengths`、`validate_identity_types`、`parse_for_initialization` | 多次遍历 AST；解析、数据库确认、初始化特例放在同一大文件内；`candidates` 不是调用方关心的概念 | `Parser.mentions(ast)` 一次取得结构化 `a/link` 与 `mention` 输入。Content Publisher 负责 Plate/Markdown 转换；Mentions 只读 canonical Plate，不扫描 text 节点中的裸 URL/HTML。                                         |
| `Store` 保存事实、沿用旧关系、计算通知名单、更新当前边、负责多种事务入口                                    | 1158 行中混合规则、持久化和作业编排；`*_in_transaction` 与自开事务函数同时存在                | `Store` 只保留关系表的锁、读写和原子替换；旧引用资格属于记录正文提及的用例规则，通知对象由通知流程确定。发布 Command 拥有发布主事务；独立维护/作业拥有自己的事务。不要把 `Store` 简单改名成 `Persist` 而保留混杂职责。 |
| `MentionsGraph.Query.one_hop(direction, ...)`                                                               | 对外业务语义被方向参数隐藏；同文件还有图分页、评论入口、pending、cursor 和 SQL 预算           | 对外用 `mentions`、`mentioned_by`；图展开保留 `MentionsGraph.Query.page`。列表按原[结构合同](./mentions-graph-refactor.md)归 `ArtimentMentions.Query`，与图查询共用批量可读状态，避免复制 Gate 规则。                  |

建议的**目标目录**只表达已有业务边界，不为每个处理阶段建模块：

```text
cms/front_desk/                  # Article / Comment 可信内部读取
cms/artiment_mentions.ex         # 领域入口；正文写入调用 record_mentions
cms/artiment_mentions/
  parser.ex                      # mentions(ast)；只处理 Plate AST 中的引用输入
  query.ex                       # mentions / mentioned_by 与本领域关系查询
  store.ex                       # 关系持久化，加入调用者事务
  notifications.ex               # Outbox 后的 User 通知
  mentions_graph.ex              # 图公开入口
  mentions_graph/
    query.ex                     # 图分页、cursor、预算
    node_status.ex               # 批量状态与 Gate 结果
    graph.ex                     # 纯内存组装
  commands/                      # 独立的初始化、重建等维护动作
  model/                         # 只保留目标方案实际需要的表 schema
```

这是职责图，不是删除清单；现有 `effects.ex`、`config.ex`、`link_path.ex`、初始化与维护模块在各自职责核对前继续保留。`Query`、`Store` 和 `Parser` 最终文件数应由真实的独立变更原因决定；不要因为超过行数阈值就造 `Resolver`、`Selection`、`FactStore` 等中间层。产品及领域名称用 `mentions`、`mentioned_by`，不用 `one_hop` 或 `read/write` 目录。

现行[执行合同](./mentions-graph-refactor.md)部分段落仍使用旧称：`CanonicalSource` 对应当前的 `CurrentSource`，`SyncProgress` 对应当前 `ProjectionState`/`mention_sync_states`；`PublicLocator` 等旧模块名也应逐项核对。该映射只帮助阅读，不能把旧称理解成另一套并存实现。实施定稿时应同步修订执行合同的过时名称与代码结构描述。

## 5. 目标写入方案与取舍

### 首选：正文与当前关系在同一事务生效

```text
发布 / 更新正文的现有 Command 事务
  1. 保存正文及其稳定版本身份
  2. Parser.mentions(ast) 一次取得结构化引用和位置
  3. 批量确认新目标；`@ Article` 按稳定 ID 的存在和类型确认，普通 URL 和其他 `@` 按公开资格确认；
     只对本来源上一版合格的旧引用沿用已确认身份
  4. 保存本版完整引用记录
  5. 原子替换本来源的当前关系，并递增读版本
  6. 写 Outbox 通知事件
提交后：通知作业发送；图已可读到新关系
```

这样正文与图没有 desired/synced 之间的空档。当前关系仍可作为有界查询索引；版本记录是否永久保留应由重试、恢复、审计和保留期合同决定。**不可直接删掉上一版已确认引用**：若目标在上次发布后隐藏，编辑来源的其他段落时，只能从同一来源的上一版恢复原链接的已确认身份；新加的隐藏目标链接不能因此获得资格。链接值、稳定 ID 和重复位置的匹配优先级须写成可测试规则，不依赖显示文字猜测。

上述不建边是目标不可读时的预期业务降级，不覆盖格式损坏、数据库故障、旧绑定歧义或事实完整性错误；这些错误仍应使拥有正文的事务回滚，不能静默发布不完整事实。

同步方案的风险是发布事务会多做关系替换，并可能与全局 revision 行竞争。进入实施前，使用现有 B2 标准/大集补测**完整发布 Command**、Comment 更新、删改恢复、热点来源、多并发 writer：记录事务 p95/p99、锁等待、回滚率、读请求首次成功率和 Outbox 通知。现有 B2 的 writer 事务 p95 250ms、约定负载下首次成功率至少 95% 是候选门槛；正式到达率、代表性分布、锁等待上限和其余阈值须在压测前冻结，不得测试后调整口径。**若超出冻结的写入预算或显著压低有效吞吐，暂停同步方案**，不要只靠调高超时通过。

### 备选：保留异步投影，但收紧合同

若实测必须异步，保留 set、occurrence、current edge 和最小 desired/synced 水位；投影作业只处理当前期望版本，幂等地替换关系。将“正文已发布但图可能仍旧”的一致性语义明确交给产品：pending 的范围、显示时长、失败处理、恢复入口和可观测指标都要定义。通知与投影的顺序和重复发送防护继续保留。此方案仍需修复位置键、页 revision 和全局 pending 问题，不能把现状原封不动作为备选。

### 版本与隐私的共同要求

不论哪种写入方案，查询应在请求 Community 上重新判定节点公开状态：不可读目标只能作为不可展开的脱敏终点；不可读来源不能泄露其出边；Comment 必须连同稳定父 Article/Doc 完成公开准入。图页携带 revision，前端只合并同版本结果。全局 revision 是否继续使用是独立决策，需要在跨 Community 可见性变化、cursor 失效和并发写入数据下评估，不能仅因同步投影就直接删除。

## 6. 初始化、恢复与生产迁移

初始化仍从 canonical 当前正文读取，不读取旧 Mentions 关系；Doc 只取 owner 当前 main，Comment 绑定稳定父 Article/Doc。`report → preflight → apply` 的环境身份、版本/正文指纹和分页核对有实际切换价值，不应因运行时代码精简而删除。同步方案可让初始化按来源事务写完整关系；重建应从当前正文及可信已存引用重新生成/核对，做到幂等且不发新通知。

当前 B4 已切独立空库并开放服务，但数据驱动的内容页、tab、Activity 和正常写入验收尚未完成；新设计不能引用 B4 切换成功作为生产数据或容量验收。现有合同已规定异步投影及全局 revision。改为同步方案需要另开设计决策，移除或改造投影事件与投影作业，并完成表结构、GraphQL 和部署验证；通知 Outbox 保留并单独验证。必须证明旧投影事件不会在新版本生效后改写当前关系。不得通过删除现有表或直接清空共享队列完成切换。

## 7. 测试整理原则与验收清单

现有测试覆盖许多重要边界，不能按文件长度成批删除。重构时先把测试按**可观察行为**归组，再删除只验证已移除内部步骤、字段或中间状态的重复用例。输入合同须用真实 Plate AST 测试，不能只用手写 occurrence fixture。

必须保留或补齐：

1. 结构化 `a/link` 与 `mention` 建边；text 节点内的 raw HTML `<a>` 和裸 URL 均不产生内部边、URL target 或 occurrence，初始化同样不生成候选。真实 Plate AST 分别覆盖结构化 `<a href=A>A</a>`、`<a href=A>B</a>`、两个相同 URL 的独立 anchor，以及 text 中两个相同和两个不同的裸 URL、raw HTML anchor。两个独立 link 各有唯一位置，保存后的 occurrence 和 `occurrences_count` 为两条；同值纯文本 label 只算一条；继承不能按冲突的 key 覆盖另一条。另用 Parser 层用例验证 text/link 节点下有结构化 `mention` 子节点时仍递归提取；若 canonical Plate 禁止 text 带 children，该异常结构只作为遍历器单测，真实输入用合法容器/link 节点验收。发布失败时正文和关系一起回滚。
2. 普通 URL 或非 Article 提及指向隐藏/未知目标不建立新内部边；`@ Article` 在目标保存前隐藏时仍按稳定 ID 保留关系；同一来源的旧已确认链接在目标隐藏后编辑时仍保留；更换 URL 或从其他来源借用旧绑定均不成立。
3. Doc main 变更、Comment 稳定父级、共享评论读取；隐藏来源不泄露边，隐藏目标不泄露标题、URL、父级信息或可展开入口。
4. 正文连续两次改版、删除/恢复、初始化重试和重建均幂等；旧作业不能覆盖新版本；通知不重复。
5. 图首批、游标页、一跳列表、评论入口返回 opaque revision；只合并同版本页。旧 cursor、其他已缓存 frontier、修订前发出而修订后返回的请求均不能重新显示敏感数据；切回 tab 和离线场景按规定重新核验。
6. 审核、Community binding、父级可读性、软删/恢复等路径导致的图可见性变化均能使旧 revision 失效；完整写入与查询在代表性数据集下满足压测前冻结的延迟、SQL 预算、锁等待和**首次成功率**门槛；重试成功单独报告。

## 8. 可执行改造顺序

| 阶段              | 工作                                                                                                                                                                                                                                                  | 出口                                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A：正确性         | 第一项先核对 Article、Doc、Comment、Ticket、初始化等全部写入入口的 canonical Plate 输入；按已决定合同只移除 text URL/HTML 提取并保留 `children` 递归，更新原 raw HTML/裸 URL 兼容测试；验证重复 link 的位置、计数与继承；页返回 revision 并按版本合并 | raw HTML/裸 URL text 不产生边、URL target 或 occurrence；嵌套结构化引用仍可提取；结构化同 URL 独立 link 各自计数且继承不覆盖，最终 occurrence 数正确；`href` 与同值纯文本 label 只算一条；权限变更后旧展示数据不残留；现有隐私测试通过 |
| B：架构决策       | 对同步关系更新做隔离环境原型和完整写入压测，与现有异步方案同分母比较                                                                                                                                                                                  | 明确选择同步或异步，记录写入延迟、锁、读取首次成功率与恢复成本；修订执行合同                                                                                                                                                           |
| C：边界整理       | 复用 FrontDesk；Parser 一次扫描；`record_mentions` 作为领域入口；Store 只持久化；列表与图查询按业务 API 分开                                                                                                                                          | 发布、初始化、重建、通知与 GraphQL 调用链可逐段说明；无重复准入规则                                                                                                                                                                    |
| D：状态与测试清理 | 仅删除被选定方案淘汰的表、作业、前端轮询/待投影状态和对应内部测试                                                                                                                                                                                     | 无旧事件晚到写入；迁移、回退与数据驱动验收通过；B2 性能出口重新评审                                                                                                                                                                    |

## 9. 本地实施与全链路复核（2026-11-06）

第 1–8 节描述的是改造前状态，不能据其中的 `desired/synced`、`projectionPending`、text URL 扫描或旧目录名推断当前工作区行为。已实施的新合同见[同步实现合同](./mentions-graph-sync-contract.md)。

| 链路       | 已实施                                                                                                                       | 复核重点                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 输入       | 只从 canonical Plate `a/link` 的 `url/href` 和 `mention` 的 key 建立引用；text 中裸 URL/raw HTML 不建事实，保留子节点递归    | 两个独立同 URL link 各计一次；label 纯文本不另计；初始化同规则                  |
| 写入       | Article、Doc、Comment、Ticket 所属 Command 事务内保存 set/occurrence 并替换 current edge；独立初始化及重建不发通知           | 正文失败一起回滚；旧隐藏目标只从本来源已确认事实沿用；新隐藏/未知目标不阻止发布 |
| 通知       | Outbox 仅承载新 User 提及通知，晚到事件核对当前 set 与正文 token                                                             | 同一 set 不重复投递；旧 set 不能复活边或发送通知                                |
| 读取       | `ArtimentMentions.Query.mentions/mentioned_by` 负责列表，`MentionsGraph.Query` 负责有界图页和 Comment 入口，共用公开来源 SQL | 隐藏来源无边；不可读目标为脱敏终点；Doc/Comment 稳定父级                        |
| 版本与 UI  | GraphQL 每类页返回 opaque revision；前端只合并同版本页，切回时先核验；移除待投影 UI                                          | 在途旧响应和旧 frontier 不重新显示标题或 URL；无法核验时显示占位                |
| 数据与恢复 | `mention_current_sets` 指向唯一当前 set；迁移要求旧投影队列排空；重建从事实修复边                                            | PG17 目标容量、真实内容和发布后生产验收仍需单独执行                             |

本地隔离验证已覆盖 391 个跨 Article、Doc、Comment、Ticket、GraphQL 及相邻写入口的用例，前端类型检查和 15 个图 UI 用例通过；完整后端测试在同一非空测试库复跑得到 **2747 passed、1 excluded、0 failures**，Elixir `mix compile --warnings-as-errors` 通过。全量复跑前发现并修正了旧测试对全库 MentionSet、Outbox 数量及 revision 初值的依赖，改为核对当前来源或事件；这些失败不是关系写入回归。一次本地 2 writer/4 reader 完整发布负载中，40/40 写入成功、writer p95 163.608 ms、reader 首次成功 3459/3605（95.95%）；这是 PG 本地样本，不是目标 PG17 容量或 B2 三轮每场景 1,000 次资格结论。新表从空库迁移、回退并重新迁移均通过；目标 Neon PG17 数据快照上的隔离迁移也通过，37 个 current set 与 27 条边保持不变，演练分支已删除，详见[切换手册](../../deploy/runbooks/mentions-graph-cutover.md#6-同步关系版本的后续发布尚未执行)。生产仍保持旧版本，不能把本地验证当作上线完成。

### 最终结构复核

**代码量复核。** 相对当前分支的 HEAD，`artiment_mentions/` 从 17 个 Elixir 文件、4278 行变为 27 个、6576 行；`Parser` 从 875 行到 1610 行，`Store` 从 625 行到约 1137 行。新旧能力范围不同，不能把这些数值直接当作复杂度评分；但它们明确排除了“代码量已经收敛”的结论。旧投影作业和水位路径被删除后，初始化目标身份确认主要集中在 `Parser` 的约 111–725 行；`Store` 仍同时处理 endpoint 生命周期、上一版目标沿用、set/occurrence 写入和当前边重建。当前收益是**状态与提交顺序减少**，不是这两个文件已经足够小。后续结构调整必须以减少重复身份查询或消除独立变更原因的耦合为目标；只把几百行搬到新文件不算完成。

进一步按代码分段审查：Plate 节点遍历、结构化 link/mention 与 URL 分类主要在 `Parser` 约 725–985 行；约 985–1610 行是发布目标的批量查询和公开资格，约 111–725 行是初始化时对稳定身份、隐藏目标与 Doc/Comment 父级的批量确认。因此 `Parser` 的名字掩盖了大量数据库读取。现有 `CMS.ArticlePath` 只接受结构化路径，`CMS.FrontDesk.article/comment` 可以按路径逐个执行 Gate 读取；`CMS.Articles.Query.Locator.resolve` 已提供部分公开 Article/Doc 批量路径能力，但不覆盖初始化的隐藏目标、Ticket/Comment 和 Mentions 所需的完整返回形态。后续应优先复用或补齐这些现有查询合同，保留批量 SQL 与隐藏目标的不同权限规则；把逐个 `FrontDesk` 调用直接放进每个链接的循环会引入 N+1，不能仅因代码变短就当作简化。`Store` 的业务含义是原子保存“某版正文的引用清单”并替换当前查询边；`set` 是历史命名，不代表按 URL 去重。其上一版引用资格和通知对象计算仍需继续核对归属。

本轮输入语义从 v1 改为 v2 后还发现 parser version 未同步递增，会使同一正文 token 的新旧不可变事实发生键冲突。当时工作区将 `Parser.version()` 升为 2，并新增旧 v1 当前清单经初始化产生 v2 清单、再选为当前版本的回归测试；切换手册已把首次初始化预期从 `unchanged` 改为 `applied`。该阶段尚未进入生产；当前实施版本为 4，见第 12 节及[同步实现合同](./mentions-graph-sync-contract.md)。

| 边界                                               | 复核结论                                                                                                                                                                                                                                            | 保留理由或后续条件                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ArtimentMentions`、`RecordMentions`、所属 Command | 业务入口只表达“记录本次正文提及”；调用方传稳定来源身份、明列 token/AST/社区/时间的已选正文和 Outbox 身份，移除了六七个位置参数。正文、事实、当前边和通知意图进入同一写入事务。Article/Doc/Comment/Ticket 各自仍拥有正文选择和最后的 revision bump。 | 保留所属 Command 的事务所有权，避免 Mentions 自己发布正文或调用方分步维护 set 与 edge。                                                          |
| `Parser`                                           | 生产路径一次遍历 AST 并批量确认目标；text URL/HTML 分支已删。旧 `parse`、`parse_for_initialization` 等仅供测试的公开入口已移除，目标资格矩阵改为通过实际 `mentions` 入口验收。文件仍包含多种既有身份和公开资格规则，行数本身不足以证明需要再分层。  | 新增来源类型时先检查 Plate 输入、稳定身份、可读资格与旧目标沿用是否都已有明确合同，再决定拆分，不为每个转换步骤创建模块。                        |
| `Store`、关系表                                    | set/occurrence 记录版本事实，current set 指定唯一当前版本，current edge 作为有界读取索引；同步提交后不需要 desired/synced 或投影作业。Store 仍有旧目标沿用、事实写入与索引重建三组代码，属于最重的维护点。                                          | 旧目标沿用依赖同来源上一 set 和稳定位置，重建依赖不可变事实，不能只为缩短文件而删除。后续若有独立修改频率和测试边界，再将沿用规则从 Store 移出。 |
| `Query` 与 `MentionsGraph.Query`                   | 列表业务 API 明确为 `mentions`/`mentioned_by`；图页单独负责 frontier 与 cursor；公开来源 SQL 共用。两处仍有少量事务、revision fence 和 Community 查找的重复代码。                                                                                   | 这部分重复很短，当前不新增通用查询框架；若未来第三个查询入口也需要完全相同的预算与 fence，再合并。                                               |
| GraphQL、前端                                      | 图页、列表及 Comment 入口都带 opaque revision；客户端核验后才显示缓存、按版本合页。前端仍轮询 revision，用于发现打开期间的权限变化。                                                                                                                | 轮询不是实时撤回保证；浏览器离线和两次轮询之间，已交付的数据无法立即收回。若产品要求严格撤回时限，需要另设主动失效合同。                         |
| 初始化、重建、迁移                                 | 初始化重用同一 Parser 合同并保持报告、预检、断点；重建只用当前 set 修复边；迁移阻止未排空的旧投影队列。                                                                                                                                             | 运维边界复杂但有数据安全用途；上线前必须核查旧 dead 事件和目标库，而不是在代码里加兼容消费。                                                     |

**仍未关闭的门槛**：全局 revision 单行更新在完整发布链路仍可能多次发生；本轮只移除了 Store 同一写入中的重复 bump，不能据此宣称锁竞争已解决。当前本地 40 次写入只证明小样本可运行；目标 PG17 容量下仍需预先冻结负载和锁等待门槛，完成 B2 三轮每场景 1,000 次与真实内容、通知、删除恢复验收，再决定生产发布。此前空库 B4 切换记录也不能替代这次同步合同的上线验证。

## 10. Parser 与 Persist 职责调整（2026-11-06，工作区）

第 9 节的 Parser/Store 行数和“沿用规则仍在 Store”是该轮的历史快照，不代表本节调整后的代码。

```text
已选中的 canonical Plate 正文
  -> Parser.mentions(ast)                   结构化节点、URL 语法、AST 位置；无 Repo/Gate
  -> Query.confirm(written, community_id)     批量确认公开目标及已选 Article 稳定 ID
     或 Query.confirm_initialization(written)           维护初始化核实既有稳定身份
  -> Persist.lock_source(identity)         在所属 Command 的事务内锁来源
  -> Persist.current_mentions(source)      取这篇正文原有的引用事实
  -> RecordMentions                       判断原有隐藏目标是否继续沿用、通知谁
  -> Persist.update_mentions(source, body)    同事务保存版本事实和当前边
  -> 通知 Outbox / 所属 Command revision
```

旧 `Store.inherit_prior_targets` 混合锁、查询和业务匹配，现由 `RecordMentions.keep_existing_links` 对本来源旧事实作决定；`Persist.current_mentions` 只提供锁内事实。旧 `save_facts_and_select_in_transaction` 把持久化和收件人计算混合，现由 `Persist.update_mentions` 负责落库，`RecordMentions` 调用 `Notifications.recipients`。这使两条业务规则可以独立于数据库写入逻辑验收。生产写入不再调用独立事务的 `save_current_version`。

通知前态直接使用 `Persist.current_mentions` 已读取的当前 set 与 occurrence，避免为了计算 User 收件人再次查询同一 set 和 occurrence。若旧版有待投递通知，仍查询其 Outbox 消费状态；这项查询不能仅凭正文引用推断。

Parser 的 Plate 遍历保留简单递归；无需引入遍历库。目标确认的 SQL 仍需批量执行，不能逐个链接调用 FrontDesk。`TargetQuery` 已删除：Article/Doc、Ticket、Comment 的公开 Gate 查询分别进入资源所属的 `Query.Mentions`；初始化的历史身份查询在 `ArtimentMentions.Query.Initialization`，只由维护入口调用。普通发布先验证目标类型；初始化已从自己加载的稳定身份事实验证类型，不再额外运行公开目标的 Article/binding 类型查询。Ticket URL 由原来的逐条 `Tickets.get_public` 改为同 Community 批量 Gate 查询。Article/Doc/Ticket 标题直接取 Gate 已连接的当前公开投影，不再为同一标题额外 join revision。定向 151 项和图查询预算 26 项通过；尚未做目标 PG17 容量下的写入压测，不能据此宣称发布性能改善。

本次收尾后的严格编译、177 项 Mention 相关定向测试、文档门禁和 diff 检查通过。完整后端套件在并发运行中为 2747/2748 通过、1 excluded：唯一失败是 CMS Assets 的 101 个草稿引用压力用例触及 60 秒测试超时；该用例单独复跑 12.7 秒通过。它与本次改动没有直接调用关系，但全套结果仍应如实记录为有 1 次超时，不能写成全绿。

初始化仍需批量核对 URL 所指的历史 binding、稳定 Article/Comment、Doc main owner、Ticket 类型和 Comment 父级。`Query.Initialization` 因这组维护期身份规则仍有约 570 行；单纯把 SQL 搬到 FrontDesk 或改成逐链接 `FrontDesk.article/2` 不会减少规则，后者还会使初始化查询随链接数增长。本轮删掉了未使用的覆盖映射、重复的公开类型查询，并只为实际 Ticket/Doc 加载其附加事实。落库、旧目标沿用和初始化的 AST 位置 key 已统一由 `Model.Occurrence.key/1` 生成。保留的批量查询应以不同目标数量增长时的 SQL 预算验收；稳定 Article 的批量身份读取现由 `FrontDesk.articles(ids, mode: :internal)` 转发到 Articles Query；公开路径和 Comment 批量读取也由 FrontDesk 的复数入口转发到所属资源 Query。

`ArtimentMentions.Query` 仍约 900 行：其中公开来源 SQL 同时被一跳列表和图页使用，不能搬到图模块而让列表反向依赖图；其余包括选中正文版本、列表分页和写入时的目标确认。`Persist` 仍约 890 行，覆盖 endpoint 生命周期、不可变版本事实、当前边替换及重建。这两个文件的长度仍是维护成本，不能标为“已经简洁”。本轮核对后没有发现可安全删除的第二套状态或无调用方的事实表；继续拆目录前，应先给出能减少重复查询、重复状态或公开 API 的具体改动，而不是按行数迁移函数。

`Persist` 仍含端点生命周期、版本事实、当前边索引和维护重建。它们都是数据库操作，但独立维护入口应由对应 Command 拥有事务。此次已将来源隐藏交给 `Commands.HideSource`，重建交给 `Commands.RebuildCurrentSet`；发布继续由 Article/Doc/Comment/Ticket Command 拥有事务。底层事实写入与索引替换的直接入口仍被部分数据层测试使用，后续要把这些测试改为通过 `update_mentions` 或维护 Command 验收，再收紧公开函数集合。不能把底层测试入口称为对业务开放的发布 API。

### 目标读取后续合同与现状

沿用现有 [FrontDesk 当前合同](../../feature/front-desk/README.md)的 `mode`：默认 `:public`；`:internal` 只供受信任的后端命令、恢复和初始化读取，不表示对请求者公开。本次没有新增单项 URL FrontDesk 读取；`CMS.Articles.locators/1` 已由 `CMS.FrontDesk.articles(paths)` 取代，公开路径仍由 Articles Query 批量 Gate 解析；`FrontDesk.articles(ids, mode: :internal)` 批量确认编辑器已选 Article 的稳定身份。如果其他业务需要通用完整 URL 读取，再定义 `FrontDesk.article(url, opts)` / `FrontDesk.comment(url, opts)` 的结果形状、mode 权限和缺失项语义；批量入口应委托资源 Query，不能靠循环单项 FrontDesk 实现。该通用 API 属于后续扩展，不是删除 `TargetQuery` 的前提。

当前绝对 URL 只按部署配置的站点 host 识别，相对站内路径按结构化 ArticlePath 处理；不要在新 API 硬编码 `groupher.com`。后续 self-host 的站点 host 可能是客户域名。未登记为该部署或 Community 所属的自定义域名即使路径形似平台路径，也不能直接获得内部身份；启用客户自定义域名识别前必须有可信的域名归属配置或注册表。目前保持现有默认 host 解析，未知 host 仍按外部 URL 处理。

普通 URL、Comment/Ticket 等新目标按 public Gate 确认；`@ Article` 先走公开资格，未通过时按稳定 ID 的存在与类型确认，保存后图仍按当前 Gate 状态脱敏。初始化补建既有正文关系时，即使目标 B 后来隐藏，维护 Command 也需从 URL 对应的旧 binding 查回稳定身份，并保存为关系事实；图对普通读者仍按 Gate 返回脱敏状态。当前这一步由 `Query.Initialization` 的受信任批量查询执行，不是调用 `FrontDesk.article(url, mode: :internal)`：现有 FrontDesk internal Article/Comment 入口只接受稳定 ID，不能直接从完整 URL 找到隐藏资源。若将来抽成通用 FrontDesk URL API，必须先补 URL→binding→稳定 ID 的受信任批量能力，且普通发布和 GraphQL 不能调用它。

## 11. 阶段性收口（2026-11-06）

第 9 节的 Parser/Store 行数与第 10 节部分阶段性测试数是历史快照；当前行为以[同步实现合同](mentions-graph-sync-contract.md)和源码为准。`Parser.version()` 已升至 3，以隔离本轮 `@ Article` 隐藏目标确认后的不可变事实；部署后必须对全部当前正文重新初始化，不能只部署代码。`FrontDesk.articles/comments` 是复数批量入口，公开路径用默认模式，稳定 ID 只供受信任的 `:internal` 模式。普通 `a/link` 不继承这项 `@ Article` 新规则。

产品入口复核：`@groupher/rich-editor` v0.0.35 提供 `mentionOptions` 与 `onMentionSearch`，Core 的 RichEditor wrapper 也透传，但仓库内尚无给 Article 编辑器填充 Article 选项的调用方；Comment 搜索回调仍是 TODO。现有后端测试与 Publisher JSON 测试证明结构化 key 的保存能力，不能证明用户已经能从产品界面搜索并选择 Article。若将来接入选项，选择时保存 `thread:stable-article-id`，再验收“选中后目标隐藏、保存仍有边、公开图只显状态”的真实路径。

## 12. 本轮落地后的边界复核（2026-11-06）

本节取代第 9–10 节中 `RecordMentions`、`Query.confirm`、`Persist.update_mentions`、`Commands.HideSource` 和“普通链接沿用旧目标”的中间方案；这些名称及规则不是当前 API。

- 业务入口是 `ArtimentMentions.update/3`；Command 内部 `Commands.Update.execute/3` 从 Plate 抽取结构化节点，调用资源 Query/FrontDesk 批量确认，再调用 `Persist.update_graph/2` 同事务保存事实和当前边。Parser 不再查 Repo/Gate；Persist 不做目标资格和通知名单决定。
- 普通结构化链接在目标审核隐藏后不会因旧 set 而继续绑定隐藏目标，保留 URL target；携带稳定 ID 的 `@ Article` 可以记录隐藏目标，读取时由 Gate 脱敏。这一选择不依赖旧引用位置匹配。当前 parser version 为 4，v1–v3 的当前来源须重新初始化。
- Comment 顶层创建和回复创建均从 `Comments.Commands.Create` 更新关系；更新/删除也从所属 Command 执行。Ticket 发布从 `Tickets.Commands.Publish` 执行。`Comments.Effects` 与 `Tickets.Persist` 不再负责关系解析。回复路径曾漏接，十个 frontier 的联合验收暴露了不可展开节点，补齐后该用例通过（21 条 SQL）。
- `mention.notify` 仍是 Outbox，worker 核对当前 set/token 和来源 Gate 后才投递。GraphQL 沿用共享的 Gate 来源查询、opaque revision 和有界 SQL。Mentions 不自建 Lifecycle；审核、父级和资源生命周期仍以原资源机制为权威。
- 本轮定向关系、图页、Doc Comment、Ticket 和评论回复测试合计 199/199 通过；补充 GraphQL/恢复 88/88。全量测试原始结果为 2750/2753、1 excluded；三项失败在修正旧 Trash 断言及隔离复跑后各自通过，Press/Assets 的批量建文出现间歇性数据库等待，详见切换手册。它不等于正式 B2 容量或生产验收；旧 B0–B4 记录也不覆盖 v4 语义。

产品边界：当前 `@ Article` key 来自正文 AST；服务端核对稳定 ID 和类型，但没有“用户曾在编辑器搜索并选中”的签名凭据。Article 搜索选项尚未接线，因此本轮只验收已有结构化 key 的后端语义。接线时须从真实选择到保存、隐藏状态及伪造 key 的权限边界做联合验收；不能把客户端节点本身写成不可伪造的选择证明。

后续发布按[同步实现合同](./mentions-graph-sync-contract.md)与[切换手册](../../deploy/runbooks/mentions-graph-cutover.md#6-同步关系版本的后续发布尚未执行)执行。

## 13. 当前关系简化实现复核（2026-11-07，工作区）

本节取代第 12 节的历史 set、CurrentSet、初始化和读端脱敏规则；细节以[当前关系合同](./mentions-graph-sync-contract.md)为准。本轮只在工作区实现，未部署。

- 已发布正文所在 Command 直接更新当前关系。来源 endpoint 的行锁串行处理同一来源；按关系键比较旧边与新正文，延续关系保留 `mentioned_at`，移除后再加入按新关系处理。Comment 软删保留旧边，永久删除清理双向及从属 Comment 边。
- 运行时只保留稳定 endpoint、当前 edge 和全局图 revision；Ecto schema 收敛到 `CMS.Model.Mentions`。旧 set、occurrence、current set、parser version、补建／重建命令、专用鉴权和请求级 Budget 已移除。迁移只适用于全新空库，拒绝带旧关系的目标库；不迁 B4 内容或旧边。
- 图和一跳列表直接分页读已存边，受限节点仍返回可取得的标题、URL、状态；有 locator 的节点可作为查询起点。资源页 Gate 负责正文准入；Community 的五类资源详情页已接入受限状态回退。结构化稳定 ID 可以指向 draft 目标；尚无公开编号或目标 binding 已解绑时，若本 Community 有相邻已绑定节点，图使用稳定 ID 的状态页 URL 与 locator。Comment 定点访问已在工作区补齐：无 binding 时使用本 Community 稳定父资源路径与 Comment locator；`mentionedComment` 在图关系确认后只按 C 自身 Gate 读取，受限父页仅显示指定 C。资源状态页经 `CMS.FrontDesk.artiment_status/2`（GraphQL `artimentStatus`）读取，图节点批量复用 `artiment_status/2`（已解析身份列表）；二者不依赖 B 的 Mention 边或 binding；永久删除仍返回不存在。Doc owner binding 受数据库删除保护，真实 Doc 解绑端到端用例仍待核实。目标发布后关系保留并显示 `READABLE`。Doc 仅公开 main 参与 Mention，非 main branch 不建立独立节点或出边。
- User 通知按来源与已发布正文 revision 身份去重；投递时核对当前 revision、关系和通知准入。暂时受限时事件延后，恢复后仍符合条件才送达；过期事件结束。
- 本轮较早的全量后端结果为 2632 通过、1 excluded、0 失败；最新全量原始结果为 **2629/2632 通过、1 excluded**：两项批量建文测试超时，一项沿用“Comment 软删即移除提及”的旧断言。修正断言后三项隔离复跑均通过；随后新增稳定 ID locator 与资源页状态回退，相关后端定向测试先通过 48/48，最后一轮更改后的图／当前关系定向测试通过 27/27。前端 Core 图组件 13/13、Community 回退／Ticket 路由 5/5 通过。Core、Community type-check、后端严格编译和文档／架构扫描通过；最新代码未再次跑全量后端。PG17 性能资格和生产验收仍未完成。
- 2026-11-08 资源状态入口已从 MentionsGraph 移至 `CMS.Artiment.Status`，由 `CMS.FrontDesk.artiment_status/2`（单项 locator 或已解析身份列表） 对外提供；GraphQL `artimentStatus` 使用 Artiment 输入与状态枚举，资源详情页直接查询状态，图节点批量复用同一读取结果。全量后端原始结果为 **2636/2637 通过、1 excluded、1 失败**：无公开编号的 draft 目标 URL 回归；修复稳定路径回退后，该用例及关联图测试 26/26、随后 Artiment 状态与当前关系定向 33/33 通过。最新代码未再次跑全量，不称全绿。
- 2026-11-08 模块收口与 Comment 定点访问后的全量后端原始结果：2632/2634 通过、1 excluded、2 项失败；两项是普通 Article 稳定 locator 多出 `comment_inner_id: nil`。修复后相关定向 48/48 通过，最新代码未重跑全量。Community 类型检查、相关 lint、严格编译及架构边界扫描通过；这不等于 PG17 性能资格或生产验收。

普通隐藏若由资源增加，仍需定义通知准入谓词；图边、标题和 URL 不依赖该谓词。发布验收还须验证目标库确为空，并完成 PG17 的写锁等待、p95 与首次成功率测量。

### 2026-11-08 单资源一跳图收口（工作区）

产品只需查看当前 Article 或 Comment 直接提及了谁、被谁提及。`mentionsGraph` 因此改为单 `focus` 加 `after` 游标，一页只返回该资源的直接入边和出边；相邻节点的其他边不返回。用户点击相邻节点跳到资源页，由该页决定是否再查自己的关系。GraphQL 移除多 frontier 输入及 `canExpand` 字段，前端移除图内展开按钮和多节点并发请求调度；分页仍只针对当前资源。Comment 的公开定位与图节点 ID 均使用所属资源的公开定位及 Comment 在该资源内的 `inner_id`，不暴露数据库自增 `Comment.id`。同一无 binding 父 Article 下的多个 Comment 以各自 `comment_inner_id` 区分稳定 locator，避免互相覆盖。旧 B2 的十 frontier 性能记录仅是历史证据，后续资格须按一跳查询重新测量。

这次全量后端测试原始结果为 2638 通过、1 excluded、0 失败（2639 项）；全量开始后补入的双 Comment ID 断言经定向 44/44 验证；随后 Query 内部改为单页处理，相关定向 53/53 通过。Core 图和恢复测试 15/15，Community 受限资源测试 4/4，严格编译与文档／架构门禁通过。仍未执行 PG17 资格、真实浏览器端到端或生产发布。
