# Article / Ticket / Comment 引用 Map 实施合同

> 状态：M0–M4 已在本地实现并回归；M5 按用户指定的本地隔离环境完成 report/apply、失败续跑、巡检遥测和六类公开入口验收（2026-11-03）。生产环境尚未切换。本文定义存储、同步、读取、展示与验收合同；文件级落点与环境证据见 [实施 inventory](reference-map-inventory.md)。不要求兼容旧 Mention 数据或旧 GraphQL/URL 合同；后续生产切换仍须按第 10.2 节执行。
> 后续 [ArticleLifecycle 与 Comment 社区解耦重构合同](article-lifecycle-comment-decoupling.md) 统一替换本文对普通 Comment 创建地审核权限及持久归属的现行要求；该重构尚未实施。

## 1. 目标、范围与完成定义

进入一篇内容时，默认看见它在引用网络中的位置、引用了什么、被什么引用。能力归属 CMS.ArtimentMentions，不要求存在 Ticket。

最终验收涵盖 Post、Blog、Changelog、Doc、公开 User Ticket 和 Comment 的引用输入、存储、出入边读取与页面入口。Post 作为首个 UI 验证入口，完成 Post 页面不能宣称整个合同完成。

| Map 节点 `type`         | 最终支持范围                                                                     | 当前基础与需要新增的适配                                               |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| POST / BLOG / CHANGELOG | Article 级当前公开版本；请求 Community 有有效 binding                            | 已有 Mention 基础；改为每 Article 一份事实/水位，补完整触发点和图查询  |
| DOC                     | 指定 Community 的官方 main branch 当前公开版本                                   | 已有 Doc/branch 身份；补选版、水位、分支隔离和页面入口                 |
| TICKET                  | 通过 Ticket public Gate 的 User Ticket 当前公开正文                              | 显式补 Ticket 解析、选版、同步和读取；不扩大 `Threads.article_enums()` |
| COMMENT                 | Post/Blog/Changelog 与 Doc main branch 下的公开 Comment；自身与父 Article 均可读 | 已有 Comment Mention 与 Body version；补独立图节点、水位和入口         |

首版只读取**一个 Community 内的当前公开图**，且对匿名与登录用户使用同一套匿名 public Scope；viewer 的 Passport/内部授权不扩大此图。非 main Doc branch、内部 Draft 图、Worker/Case 图、跨 Community 图、User/外部 URL 节点不在本轮；本文不新增 Ticket 评论能力。上述 Comment 可以引用公开 User Ticket，User Ticket 正文也可以引用上述 Article/Doc 下的 Comment，包括 Doc main branch 的 Comment。

Comment 是独立节点，不冒充 Article。Comment 的父 Article、回复关系、选中文字批注的锚点只作为定位上下文；没有显式正文引用就不产生图边。Article 焦点的 MiniMap 分页发现其自身公开 Comment 中有内部引用事实或待同步水位的节点，再沿用原邻接查询展开这些 Comment 的真实入边和出边。Comment C 提及父 Article A 时保留 C→A；C 提及 B 时保留 C→B；Article A 提及自身的 A→A 不显示。父子归属本身不伪造为引用边。Article `thread` 与 Ticket `type` 保持原合同，图 DTO 的资源分类字段统一使用 `type`。

本功能不包含 TicketSource、User/Worker 依赖、Timeline 连线、自动排期、Post Merge、duplicate 或手动“相关讨论”。TicketSource 的边界以 [Ticket V2](../tickets/v2.md) 为准。

## 2. 已确认的产品边界

### 2.1 常驻上下文地图

MiniMap 默认呈现当前 Article 的引用上下文，并高亮当前位置。用户无需从根节点逐个点击，才能首次发现周围关系。点击节点用于定位、查看摘要、跳转内容或切换关注中心。

```text
Article B ----引用----> [Article A * 当前] ----引用----> Article C
                              ^
                              |
                             引用
                              |
                           Article D
```

- `mentions`：当前内容引用了哪些对象。
- `mentionedBy`：哪些内容引用了当前内容。
- 两个方向来自同一份引用事实，反向读取不另写一条镜像关系。
- 没有可展示关系时，显示当前节点与空态；加载中、数据不完整与确实没有引用必须区分。

### 2.2 图是基础，布局是视图

节点是独立资源，边表达有方向的引用。树状、星状、局部网络图等布局使用同一份关系数据，坐标、缩放、当前焦点和展开路径属于视图状态，不作为第二份引用权威。

```text
A ----引用----> B ----引用----> C
               ^              |
               +----引用------+
```

这个环是合法的引用上下文。地图可以直接画出 B/C 间的回路，同一个上下文中的资源节点只保留一个身份。树状布局中，缩进表达本次浏览路径，同一 Article 可以经不同路径出现：

```text
Article A
  +-- Article B
        +-- Article C
              +-- 回引 Article B（已出现在本路径，定位到原节点）
```

当前路径再次遇到已有节点时，用回引入口终止该分支；其他路径遇到相同节点时保留关系，不因全局去重而丢边。底层资源不因树状显示而获得父帖/子帖归属。

产品不设固定引用层级上限。大图采用自动分批加载与呈现预算，初次进入即展示可用上下文，后续批次自动补齐；超出范围时明确标注并提供继续查看或切换中心的入口。不能将整个站点一次性拉入浏览器，也不能把截断结果称为完整网络。

鱼骨图等布局可以作为后续视图探索；如果图形还要表达分类或因果，必须另有明确数据，不能把普通引用画成已确认的因果关系。首发具体布局、尺寸、交互和移动端形式留待原型验证。

### 2.3 引用不自动传递业务关系

```text
Post A ----引用----> Post B ----引用----> Post C
   ^
   |
TicketSource
   |
User Ticket T
```

T 的直接来源仍只有 A。地图中的 B/C 仅提供引用上下文；它们不会自动进入 T 的来源列表、票数/评论聚合、通知受众或处理进度。

正文提及、手动“相关讨论”、duplicate、工作阻塞和 TicketSource 各有不同语义。本方案只处理正文引用 Map，不新增通用关系类型集合，也不将 Post 引用推导为 Ticket 依赖。手动相关关系和 duplicate 如要加入图，须另立产品合同并明确区分边的含义。

### 2.4 “生成地图”分为三步

```text
发布正文时：
A 正文引用 B ──解析并持久化──> 引用事实 A -> B

打开页面时：
请求 A ──查询已存入边/出边──> nodes + edges + 分页/同步状态

浏览器展示：
nodes + edges ──布局算法──> 节点坐标、方向线、当前节点高亮
```

关系维护发生在内容变化时；请求只读取已有关系和当前可读摘要，不重新解析正文。前端负责坐标，布局不写回引用事实。读取时组装的是有范围的局部网络，不在每次请求中遍历全站。

## 3. 当前事实与实施入口

以下路径相对 `backend/api/lib/groupher_server/`，只描述已核对的基础，不表示图功能完成。

| 现有入口                                                                                | 当前职责                                                                          | 本合同增量                                                                          |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `cms/model/artiment_mention.ex`                                                         | 一条提及事实、两端身份/Community/branch、occurrences、快照；包括 Comment/User/URL | 删除 Community FK/快照，拆分 typed ID；增加 Ticket 适配、唯一边键与同步水位         |
| `cms/artiment_mentions/{config,parser,store}.ex`                                        | 解析、来源关系重建、方向列表、删除状态维护                                        | 当前普通 Article 集合不自动包含 Ticket；增加批量邻接、版本过滤和 Article 级事实身份 |
| `cms/articles/workflow.ex`、`articles/effects/publish.ex`、`outbox/workflow/article.ex` | Publish 事务记录 projection Outbox，提交后加载公开投影并同步 Mention              | 接入 Article 级 current-source 同步协议；mirror 只推进图 revision                   |
| `cms/comments/effects.ex`、`outbox/workflow/comment.ex`                                 | Comment 创建/回复/编辑经 Outbox 和任务同步 Mention                                | 最终任务成功须代表事实与水位均已提交；不能以 best-effort 入队失败作为成功           |
| `cms/tickets/persist.ex`、`tickets/effects.ex`、`outbox/workflow/ticket.ex`             | Ticket 独立内容/发布命令及事务 Effects                                            | 新增 Ticket 正文 Mention 的同步意图，保持现有发布与工作 Lifecycle 分工              |
| `cms/articles/trash.ex`、`cms/artiment_mentions/store.ex`                               | 删除状态与 outgoing 清理                                                          | 继续由原 owner 维护；硬删除终结在途任务，图不展开已删除节点                         |

普通 Article 发布已有“事务 Outbox → projection → Mention sync”的基础；Comment 已有任务链。现有 `Store.do_sync` 的来源删除/插入事务不足以单独证明选版、Article 级身份、零引用、并发和图刷新均正确，这些是 M1 的强制出口。

相关合同：[Revision/Draft](./revision-draft-target.md)、[Mention 与 Trash](./trash-audit-refactor.md#12-mention-契约)、[Article/Community](./article-community.md)、[Gate](../gate/README.md)。

## 4. 存储、身份与同步水位

### 4.1 一份正文，一份引用事实

复用 `cms.artiment_mentions`，由 CMS.ArtimentMentions 唯一写入；不新增平行边表、每篇内容一份 Map JSON 或持久化图坐标。Article/Comment/Ticket/Doc 的引用事实归正文 owner，不归公开 URL 或 mirror binding。反向列表只反查同一条有向事实，不写反向边。

普通 Post/Blog/Changelog 的来源键为 `type + Article UUID`；无论有多少 Community binding，一份 ArticlePublic 正文只解析一次、保存一组 outgoing 边。User Ticket 来源键为 Ticket Article UUID；Ticket 仅有一个 Community binding。Doc 来源键为 `Doc Article UUID + 实际 main branch ID`，因为不同 branch 的正文选版由 Doc owner 决定。Comment 来源键为 `Comment ID`，Doc Comment 还包含实际 branch ID；普通 Article Comment 的目标 `origin_community_id` 只是创建归属/入口元数据，不因父 Article mirror 而复制事实或水位；Doc Comment 的 Community/main branch 仍按 Doc owner 校验。目标同样以稳定资源身份和必要的 Doc branch 标识，不以 Community binding、innerId 或 URL 为边身份。Comment 目标身份包含 Comment ID，读取时再验证其父 Article。URL/User 事实继续由原 Mention owner 管理，不进入首版 Map。

```text
Article A 的同一正文引用 Article B
  事实：A -> B                         只存一次
  X 图：两端在 X 都可读 -> 显示 X 路径
  Y 图：任一端在 Y 不可读 -> 不显示
mirror/unmirror A 或 B -> 只改变对应 Community 的图投影，不改 A -> B
```

平台公开链接必须带明确 Community、thread、innerId；解析时用该 Community 的 binding 把目标固定为 Article UUID，之后不得因来源被 mirror 到另一 Community 而重新解释链接。Map 请求中的 `articleInnerId` 只用于在指定 Community 解析当前节点；它和 Article UUID、Comment 内部 ID 不可互换。普通 Article 不接受 branch；Doc/Doc Comment 由服务端选择当前 main branch。A→B 与 B→A 是不同边，A→A 沿用现有忽略规则；同一正文版本中的重复 A→B 合并 occurrences。

逻辑边唯一键为“完整稳定来源身份 + internal/external + 完整稳定目标身份或 URL hash + mention_case”。`merge_occurrences` 和数据库唯一约束必须使用同一个键；尤其要读 `mentioned_article_id`，不能只读 `mentioned_id`。Community、公开 URL、binding innerId 不参与普通 Article **事实边键**；Map DTO 的 opaque ID 另含请求 Community，避免不同 Community 的响应被关联。新事实不持久化来源/目标 Community 专属 URL；Map 在当前 Community 读取时生成相对路径。第 4.3 节列出最终列、约束和 GraphQL 字段；来源/目标 Community 与内部目标 URL 不再存入事实。现有 `mentions/mentionedBy` 一跳列表改为必须带 Community 读取上下文，内部 URL 从该 Community 当前 binding 生成；不可读目标不返回，外部 URL 保留绝对地址。旧调用形状直接移除。

### 4.2 同步水位与图刷新版本

新增 `cms.artiment_mention_sync_states`，仍由 Mention owner 管理。每个来源键只有一行：`desired_content_token`、`synced_content_token`、`synced_at`；零引用也必须有成功水位。来源硬删除时水位清除；隐藏但仍存在的来源可以保留事实与水位，由 Gate 决定展示。该表只记录派生投影进度，不决定正文版本或 Lifecycle。

| 来源                | 水位唯一键                             | 内部 token                                            |
| ------------------- | -------------------------------------- | ----------------------------------------------------- |
| Post/Blog/Changelog | `type + Article UUID`                  | ArticlePublic 的 `revision_id + publication_version`  |
| User Ticket         | `Ticket Article UUID`                  | Ticket 当前公开正文 revision/version                  |
| Doc                 | `Doc Article UUID + main branch ID`    | `branch_id + branch_version_id + publication_version` |
| Comment             | `Comment ID`，Doc Comment 附 branch ID | `comment_id + CommentBody.version + body_hash`        |

token 只在 owner、水位表、Outbox、任务内流转，不进入公开 GraphQL。数据库以来源种类分别建立 partial unique index；可空 branch 使用明确的 NULL/非 NULL 谓词。事实表对当前完整身份建立逻辑边唯一索引和双向查询索引；CHECK/owner 内校验身份二选一、type 与 branch 组合、Comment 父 Article/branch 归属。不要用 FK 存在性替代归属校验。待同步索引仅按 `desired_content_token IS DISTINCT FROM synced_content_token` 加来源 type/ID；Community pending 查询经当前 Article binding 或 Comment 父 Article binding 连接可读来源，不能在水位表复制 Community 行。直接 SQL 负向测试须证明重复当前边、错身份、错 branch 被拒绝。

新增 `cms.reference_map_revisions`：每 Community 一行 `community_id` 主键、单调 `revision` bigint、UTC 时间戳，由 CMS.ArtimentMentions.GraphRevision owner 在使该 Community 的公开图可能变化的原事务中递增。全局 Article 正文/desired token 改变时，按当前有效 binding 枚举 Community 并递增各行；事实与 synced token 同事务提交时再次递增；Comment/Ticket/Doc 同理按当前可读入口递增。binding 增减、公开标题/slug、Article/Comment/Ticket/Doc/Community Lifecycle、ReviewBlock、审核或公开权限规则变化，也由各资源 owner 在原事务调用 GraphRevision；看似无关的 Community 内变更允许多递增一次，不能漏可见变化。M0 inventory 必须逐入口列出原事务、调用点和测试；缺任一触发点不得开放 `referenceMapRevision` 与 30 秒轮询。图只使用匿名 public Scope，因此 viewer Passport/授权版本不参与 revision；若未来支持 viewer 专属图，须另设计 viewer 授权版本，不能复用此 revision。

revision 响应为 `HMAC(map_key_version, community_id, revision)`，不暴露计数。节点/边 ID 与 cursor 使用独立目的标签的 HMAC；密钥版本轮换时增加全体 Community 的 revision、使旧 cursor 失效，旧 node/edge ID 随新密钥变化。轮换先以旧密钥服务并批量推进、审计全 Community revision；完成后原子切换持久密钥版本与签发配置，再开放新签发。切换失败继续使用旧密钥；任何实例版本不一致时关闭轻量轮询与图 API，不能只更换密钥却返回旧 revision。

### 4.3 `cms.artiment_mentions` 最终 DDL 与 GraphQL 出口

M1 的 migration、Schema 和导出的 SDL 必须与下表一致；没有历史数据/旧 API 兼容要求。普通 Article 的任意 Community 删除，不能级联删除全局 Mention 事实。

| 列                                                                    | 类型与约束                                                                                                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                  | bigint 主键，仅内部使用；Map edge ID 从逻辑键 HMAC 生成                                                                                                               |
| `mentioner_type`                                                      | 非空 Post/Blog/Changelog/Doc/Ticket/Comment enum                                                                                                                      |
| `mentioner_article_id` / `mentioner_comment_id`                       | UUID / bigint，可空且恰好一个非空，FK 到 Article/Comment，来源硬删除 `ON DELETE CASCADE`                                                                              |
| `mentioner_branch_id`                                                 | bigint，可空；Doc/Doc Comment 必填且为实际 main branch，其余必须为空                                                                                                  |
| `mentioned_scope` / `mentioned_type`                                  | 非空 internal/external 与显式 Post/Blog/Changelog/Doc/Ticket/Comment/User/URL 类型，类型组合 CHECK                                                                    |
| `mentioned_article_id` / `mentioned_comment_id` / `mentioned_user_id` | UUID / bigint / bigint；internal 恰好一个非空，按 type 匹配，FK 到目标，目标硬删除 `ON DELETE CASCADE`                                                                |
| `mentioned_branch_id`                                                 | bigint，可空；Doc/Doc Comment 目标须为实际 main branch，其他目标为空                                                                                                  |
| `external_url` / `external_url_hash`                                  | text，可空；仅 external URL 两者非空且全部内部目标列为空；hash 为规范 URL 的 SHA-256                                                                                  |
| `mention_case` / `occurrences`                                        | 非空 inline_mention/link enum；非空 JSONB 数组，至少一个位置，位置只属于当前正文 token                                                                                |
| `edge_key`                                                            | 非空 text，由 DB `BEFORE INSERT/UPDATE` trigger 从 type、完整来源/目标稳定 ID、branch、scope、URL hash 与 mention_case 以长度前缀规范序列化计算；不得信任调用方传入值 |
| `mentioned_at` / timestamps                                           | `:timestamptz`；Schema 对应 `:utc_datetime`，migration 的 timestamps 使用默认类型                                                                                     |

删除 `mentioner_community_id`、`mentioned_community_id` 及其 `ON DELETE` FK，删除 `mentioner_url`、旧内部 `mentioned_url`、`mentioner_snapshot`、`mentioned_snapshot`、`meta`；旧 `mentioner_id`/`mentioned_id` 拆成上表的 typed ID 列。外部 URL 只存 `external_url`。目标被永久删除时 incoming 边随目标 FK 删除；不保留 deleted snapshot 或占位边。GraphRevision 在目标删除事务按其原有效 binding 推进。

DB CHECK/trigger 必须验证 source 身份二选一、target 内部身份三选一、internal/external 互斥、type/ID/branch 匹配、Comment 所属父 Article/branch 与目标归属；`edge_key` 的 SQL 生成与应用层 `merge_occurrences` 使用同一规范键。禁止以某个 mirror binding ID 或 Community ID 充当来源身份。索引明确为：`UNIQUE(edge_key)`；`(mentioner_type, mentioner_article_id, mentioner_branch_id, id)` 的 Article/Doc/Ticket 部分索引；`(mentioner_comment_id, id)` 的 Comment 部分索引；目标 Article、Comment、User 各自以 typed ID 和 `id` 建反向部分索引；external URL 建 `(external_url_hash)` 部分索引。旧按 `mentioner_community_id` / `mentioned_community_id` 的索引删除。DB 负向测试直接 INSERT/UPDATE 伪造社区、错 type/branch、冲突 edge_key、空 occurrences，均须失败。

`cms.artiment_mention_sync_states` 按第 4.2 节每稳定来源一行；事实与水位同事务提交。新 GraphQL 一跳 `artiment_mention` 只公开 `id`（Community + edge_key 的 opaque HMAC）、`mentioner_type`、`mentioner_url`（本次 Community 相对路径）、`mentioned_scope`、`mentioned_type`、`mentioned_url`（内部为本次 Community 相对路径，外部为原绝对 URL）、`mention_case`、`occurrences_count` 和 `mentioned_at`。不公开内部 row ID、Article UUID、Comment ID、Community ID、branch ID、URL hash、原始 occurrences、snapshot、meta 或 token。根 `mentions`/`mentionedBy` 各增必填 `community: String!`，与输入 path 的 Community 不符时拒绝；User target 同样按该 Community 过滤来源。另新增独立 `TicketPathInput { community: String!, innerId: ID! }`，在 `MentionSourceInput`/`MentionTargetInput` 各增 `ticket` 字段并保持恰好一个 locator 非空；只接受公开 User Ticket，按当前 Ticket public Gate 和 Community binding 的数值 innerId 解析，不扩充普通 `Threads.enums()` 或复用 ArticlePathInput。Ticket 可作为两条一跳列表的 root，而不只是邻居。删除 `trashed_article.mentions`、`trashed_article.mentionedBy` 和 `trashed_article.mentionedByCount` 字段及对应 resolver：Trash 不再从已删除事实提供历史引用列表。M1 的出口工件是最终 migration SQL/索引谓词、Schema、导出 SDL 与每个删除字段的消费者清单，GraphQL codegen 和真实 DB/查询测试均须通过。

一跳接口的目标 SDL（M1 先落入实际 schema、导出 SDL/codegen；M2 的 Map SDL 另见第 6.2 节）：

```graphql
input TicketPathInput {
  community: String!
  innerId: ID!
}
input MentionSourceInput {
  article: ArticlePathInput
  comment: CommentPathInput
  ticket: TicketPathInput
}
input MentionTargetInput {
  article: ArticlePathInput
  comment: CommentPathInput
  ticket: TicketPathInput
  userLogin: String
}
extend type Query {
  mentions(community: String!, source: MentionSourceInput!, pagi: PagiInput): ArtimentMentionPage
  mentionedBy(community: String!, target: MentionTargetInput!, pagi: PagiInput): ArtimentMentionPage
}
```

输入恰好选择一个 locator。Ticket 的 `innerId` 按现有公开 `ticket(community, innerId)` 的 Community-local 正整数解析：先要求完整字符串匹配十进制正整数格式，再按 ArticleBinding `inner_id` 的 DB 类型做范围检查，最后查询；非数字、`0`、负数和超范围均拒绝，不得宽松 cast、截断或回退默认值。Ticket public Gate 只允许 User Ticket；`TicketPathInput.community` 与根 `community` 不同直接拒绝。普通 `ArticlePathInput.thread` 和 `Threads.enums()` 不加 `ticket`。

| 对象                      | M1 负向证据                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| 一篇 Article 两个 binding | 一组边、一行水位；删除任一 Community/binding 不删除 Article 事实                     |
| 两个不同 Article 目标     | 保留两条边；同目标重复位置才合并 occurrences                                         |
| 硬删除来源/目标           | FK 与 owner 顺序正确、在途同步不复活、无历史占位                                     |
| 一跳列表和 Trash          | 只返回当前 Community 可读路径；旧内部 ID/snapshot 字段和 Trash 嵌套 Mention 均不存在 |

## 5. 内容命令到引用事实的完整链路

### 5.1 持久意图、选版与原子更新

```text
创建/编辑普通 Article
  ├─ 只保存 Draft -> 不同步公开引用
  └─ Publish -> 原内容事务：
       保存 ArticlePublic 当前版本
       Mention owner 标记 Article 级 desired token（一次）
       写一条 article.mention_sync 持久 Outbox 意图
       对所有当前有效 binding 的 Community 递增图 revision
       commit
          └─ 可重试任务加载 canonical 公开正文、解析稳定目标
             锁来源并重查当前 token
             同一事务替换该 Article 的全部 outgoing 边和 synced token
             对当前有效 binding 的 Community 递增图 revision
             commit 后才报告成功
mirror/unmirror -> 只变 binding 和相应 Community 图 revision；不产生 Mention 任务
```

新增 `CMS.ArtimentMentions.sync_current(locator, opts)`，返回 tagged tuple。普通 Article locator 是 thread + Article UUID，不含 Community；Doc 是 Article UUID + 实际 main branch；Ticket 是自身 Article UUID；Comment 是 Comment ID（Doc Comment 附 branch）。现有 `CMS.ArtimentMentions.sync/1` 保留已加载资源入参和 `{:ok, :pass | {count, nil}} | {:error, reason}` 返回合同；它可在 owner 内提取稳定身份、重读 canonical 正文并委托 `sync_current/2`，不得要求 Event、DocTree 等原调用方改传 locator，也不能以调用方传入的旧 body 覆盖当前关系。解析结果只来自 canonical 当前公开正文。重复/迟到事件追赶当前版本；触发 token 用于诊断，不强迫恢复旧内容。

新增 `mark_pending_in_transaction(locator, token)`，由资源 Effects 在提交公开正文的原事务内写 desired token 与持久 Outbox；它不另起事务、不写业务 Lifecycle。首次公开须建水位；Draft 保存不触发。普通 Article Publish 不论调用入口在哪个 Community 都只产生一条来源级同步意图；同一 Command/版本重复提交须由 Outbox 幂等键去重。专用事件 `article.mention_sync` 由 Article Outbox workflow 直达 Mention owner，不经过 `article.projections` 或 `CMS.Articles.Effects.Publish.run`；payload 仅含 type、Article UUID、触发 token、Command/Workflow identity，幂等键为 `article.mention_sync:type:article_uuid:token`。Comment/Ticket/Doc 各自事务 owner 记录同等持久意图；Comment 不得用 best-effort 入队失败作为最终成功。M0 inventory 固定各事件名、payload、幂等键和 worker 路由。任务不重复管理员通知、Activity、cache/search 或 Mention 通知；Messaging 继续消费事实和独立 delivery identity。

解析可在锁外完成；落库前必须按原资源锁序锁定来源并重查 canonical token，保持锁到事实/水位提交。token 已同步的重复任务成功终止，force rebuild 除外。来源已永久删除时终止为 `{:ok, :source_gone}`，不得重建边；普通 Article 的某个 binding 被移除不表示来源已删除，不终止也不重试该来源任务。来源仍存在但 canonical 正文缺失、解析失败、FK/插入失败是可重试错误，整次替换回滚，水位不前移；现有缺 CommentBody 时 `{:ok, :pass}` 不得沿用。不得先删旧边再在另一个事务插入新边。

### 5.2 来源锁与并发边界

| 来源         | 序列化边界                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| 普通 Article | 现有 Article/ArticlePublic 选版锁；所有 mirror 入口竞争同一 Article 来源锁，锁后不再按 Community 拆分 |
| Doc          | Community / branch / Article 聚合锁与 DocPublic 选版锁                                                |
| Ticket       | Ticket canonical Article/State/Lifecycle 锁                                                           |
| Comment      | 父 Article/branch 聚合锁，再锁 Comment / CommentBody                                                  |

在资源锁之后锁来源水位行；同一来源的任务串行。目标只解析稳定身份，不沿图递归锁目标，避免 A→B→A 锁环。GraphRevision 按 Community ID 升序更新受影响的行；M0 需验证与 Article binding/资源锁的实际顺序，不凭文档假定无死锁。

mirror 新建 binding 时，原事务只推进目标 Community 图 revision，使既有 Article 边按新 binding 与 Gate 显示；unmirror/move 只推进受影响 Community 的 revision，使该入口立即退出图。它们不改 Article 级 desired/synced、outgoing 或 Mention 通知。普通 Article 全局正文变化需一次同步和对所有有效 binding 的 Community 失效；缺任一绑定的 revision 触发即不得启用轻量轮询。永久删除与同步并发时，删除持有同一来源锁，清水位/outgoing 后，迟到任务检测来源不存在并终止。

### 5.3 身份解析与可见性分开

复用 Plate AST parser 与现有 `CMS.ArtimentMentions.PublicUrl.article/1`、`comment/2` 公开相对路径 builder；只新增平台 URL 到稳定目标的 locator 解析能力。`Config.article_url/2` 保留旧函数语义，不改成新签名；M1 逐调用点移除 `/<thread>/<uuid>` fallback，新 Map/一跳公开输出一律经 `PublicUrl` 生成并以 R01 防止内部 UUID/Comment ID 回退。平台受信 host 上只解析带 Community 的 `/<community>/<thread>/<innerId>` 路径（Doc 带 slug）；相对链接也必须带 Community。解析时按链接中的 Community binding 定位稳定目标 ID，之后来源 mirror 到别处也不重新解释。编辑器结构化 mention 若已携带受信稳定目标身份可直接归一；不得猜测无 Community 的裸相对路径。Phoenix 没有 host→Community registry，且边缘路由环境变量不是后台 parser 的可信数据源；因此首版 custom-domain 绝对链接按 external URL 保存，不解析成内部边。M0/R01 同时提供 platform 正例、custom-domain external 反例和伪造 host 反例。未来要支持 custom-domain 内部解析，先建设后端 owner registry 并另立合同。

builder 在 Map 读取时返回当前 Community 的平台规范相对路径。custom-domain 页面由前端校验 Community 后调用 `communityPublicPath` 转为无 Community slug 的浏览器路径；后端不把绝对平台 URL 拼到 custom domain。Comment 深链用公开 `commentInnerId`，不得输出内部 `comment_id`。新 Mention GraphQL URL 字段采用相同相对路径合同；外部 URL 保留原绝对 URL。没有旧绝对 URL 兼容层。

合法链接的身份解析不以目标当前公开性为删除事实的依据：解析链接中的 Community binding 与稳定目标身份，图读取才用当前 Gate/公开版本过滤。目标隐藏后恢复，原引用可重新投影，无需编辑来源正文。目标已永久删除或 locator 无效时按明确的跳过/终结规则处理，不伪造节点。一跳列表与 Messaging 按新稳定事实身份读取；公开列表执行两端 Gate，不依赖 snapshot。

Post/Blog/Changelog、Ticket URL、Community-local innerId、Comment fragment、带 slug 与空 slug fallback 的 Doc main branch，以及平台链接正例/custom-domain external 反例都需有 fixtures；Blog 公开页面路由当前缺失，M4 必须补页面路由后才验收其 Map 入口。Comment 首版使用父 Article 页面内的 `#comment-<commentInnerId>` 锚点定位；若新增独立 permalink 路由，须另在 M0 登记。稳定 UUID、展示 innerId、Comment 内部 ID 不可互换。来源正文只读 canonical BodyBag；引用出现位置属于来源 token，正文版本不匹配时不跳转到旧位置。

### 5.4 公开图与水位的一致性

图读取只允许 desired、synced 和 canonical 当前 token 三者相等的来源边；版本已变但同步未完成时，旧边立即退出图投影，不能等待任务到达后才隐藏。正常同步与 rebuild 都必须在来源锁内核对/修正 desired token，再原子替换事实和 synced token。

节点返回 `syncState: READY | PENDING`。批量响应 `projectionPending = true` 当且仅当以下任一条件成立：同 Community 存在当前可读且 `desired != synced` 的来源，或本批任一已请求可读节点缺水位、`desired/synced/canonical` token 不一致。保持 Community 级候选判断，因为尚未同步的入边可能来自当前 frontier 外，不得只按已到达节点计算完整性。该 boolean 经过 public Scope 过滤，不返回隐藏来源数量或身份。Community 级查询从 pending partial index 中取候选，再组合各类 public Scope 做 EXISTS；不在每次请求对全 Community 的所有公开版本重新做完整差异扫描，更不加载所有正文。缺水位/漂移不会出现在该 partial index 中，开放前 report 必须拦住，开放后以定期健康巡检 report 和持久重建任务修复；本批检查仍须立即使响应 pending，不能等巡检。

入边可能来自尚未同步的其他来源，因此仅当前焦点 READY 不足以承诺全图完整。`projectionPending` 为 true 且仍在自动追赶窗口时，UI 显示“引用关系尚未同步完成”，包括零边结果；追赶超时仍为 true 时显示“引用关系暂未完整”与“重新检查”。前端“重新检查”仅重新查询，不能伪装成重新入队；失败任务由持久 Outbox 重试，耗尽后经第 10.2 节失败清单定向续跑。无论其他来源是否与当前 frontier 相连，不能显示“没有任何引用”。这个标记独立于分页是否读完。

## 6. 图读取与 GraphQL 合同

### 6.1 公开范围与授权

首版入口强制 `PUBLIC_CURRENT` 语义，调用者不能用参数切换内部读取。无论用户是否登录，查询固定以 `actor=nil` 组合资源 typed anonymous public Scope：Article、Doc main、Ticket public、Comment 及父 Article Scope。使用 `CMS.Gate.scope/4` 批量查询，不逐行调用 access check；Gate 不执行 Repo，也不接管同步状态。若产品以后需要 viewer 专属授权图，须另设计缓存和授权 revision，本合同不开放该模式。

只返回指定 Community 的有效节点与边。事实解析保留链接明确指向的稳定目标；图在请求 Community 只投影两端均有当前可读 binding 的边，跨 Community 事实不在单 Community 图展示。本响应不返回另一 Community 的标题、边、计数或“还有隐藏节点”提示，也不跨不可读节点继续遍历。

Comment 父 Article 隐藏时自身也退出图；普通 Article 的 Comment 在父 Article 的任一可读 mirror binding 下共享同一 Comment ID。M1 按 Article/Community 合同将普通 Comment 的归属改为可空 `origin_community_id`；M2 将普通 Comment public Scope 改为请求 Community 的父 Article binding、Comment Lifecycle 与全局 ReviewBlock 的交集，不能再由 origin 决定。Doc Comment 继续按 Doc main branch 的 Community/branch Scope 和 ReviewBlock 判定；不能把普通 Comment 的 `community_id=NULL` 审核规则套到 Doc Comment。Ticket 仅 public Gate 可读的 User Ticket；Worker/Case 即使管理员有权限也不进入本公开端点。事实不存历史快照，当前读取授权由两端 Gate 决定。

公开图首版不投影被删除节点占位；一跳 Mention 列表按第 4.3 节直接切换；Trash 不再提供嵌套 Mention 历史列表。未知 type、非法 branch、locator 错配 fail closed，不能猜测目标。

### 6.2 目标 GraphQL

下列为当前 SDL 合同。`mentions/mentionedBy` 列表仍为一跳查询；Ticket 可作 source/target root。这两条列表不伪装成多跳 Map API。

```graphql
enum ReferenceMapNodeType {
  POST
  BLOG
  CHANGELOG
  DOC
  TICKET
  COMMENT
}
enum ReferenceMapSyncState {
  READY
  PENDING
}
enum ReferenceMapFrontierState {
  AVAILABLE
  UNAVAILABLE
}

input ReferenceMapLocatorInput {
  type: ReferenceMapNodeType!
  articleInnerId: ID!
  commentInnerId: ID
}
input ReferenceMapFrontierInput {
  node: ReferenceMapLocatorInput!
  after: String
}

type ReferenceMapNode {
  id: ID!
  type: ReferenceMapNodeType!
  articleInnerId: ID!
  commentInnerId: ID
  branchId: ID
  title: String!
  url: String!
  syncState: ReferenceMapSyncState!
}
type ReferenceMapEdge {
  id: ID!
  from: ID!
  to: ID!
  occurrencesCount: Int!
}
type ReferenceMapNeighborhood {
  requestIndex: Int!
  state: ReferenceMapFrontierState!
  nodeId: ID
  edgeIds: [ID!]!
  hasNextPage: Boolean!
  endCursor: String
}
type ReferenceMapPage {
  nodes: [ReferenceMapNode!]!
  edges: [ReferenceMapEdge!]!
  neighborhoods: [ReferenceMapNeighborhood!]!
  projectionPending: Boolean!
}
type ReferenceMapLocator {
  type: ReferenceMapNodeType!
  articleInnerId: ID!
  commentInnerId: ID
}
type ReferenceMapArticleCommentsPage {
  comments: [ReferenceMapLocator!]!
  hasNextPage: Boolean!
  endCursor: ID
}

extend type Query {
  referenceMap(
    community: String!
    focus: ReferenceMapLocatorInput!
    frontiers: [ReferenceMapFrontierInput!]!
    first: Int = 20
  ): ReferenceMapPage!
  referenceMapRevision(community: String!, focus: ReferenceMapLocatorInput!): ID!
  referenceMapArticleComments(
    community: String!
    focus: ReferenceMapLocatorInput!
    after: ID
    first: Int = 20
  ): ReferenceMapArticleCommentsPage!
}
```

`articleInnerId` 是指定 Community 的公开 Article binding ID；对 Comment 表示父 Article 的公开 `innerId`，且 `commentInnerId` 必填，其他类型禁止后者。两者沿用现有 `ArticlePathInput`/`CommentPathInput` 的 GraphQL `ID` 标量，服务端验证其实际 Community-local 数值身份。输入不接受 Article UUID、内部 Comment ID 或 branch ID；Doc/Doc Comment 由服务端解析实际 main branch。响应 `branchId` 仅这两类非空，`commentInnerId` 仅 Comment 非空。标题使用当前公开标题；Comment 使用安全 digest，最多 140 字符，空正文由前端按 locale 显示资源类型，不从服务端返回固定中文，也不回退到旧 snapshot。`url` 是平台规范相对路径：Doc 使用当前非空 slug；`DocPublic.slug` 为空时以固定 `doc` 占位，形成 `/<community>/doc/<innerId>/doc`，页面仍按 innerId 加载；Comment 使用父 Article 路由和 `#comment-<commentInnerId>` 锚点。custom domain 页面按第 5.3 节转换路径。

节点 `id` 和边 `id` 都是服务端用独立密钥对“请求 Community + 带类型标签的完整稳定资源身份/有向逻辑边键”计算的 opaque HMAC digest，不直接拼接或只作无密钥 hash；密钥轮换按第 4.2 节推进 Community revision 并使旧 cursor 失效。边 `id` 不使用每次重建会变化的行 ID，`from/to` 必须引用本响应节点，`occurrencesCount >= 1`。内部 `contentToken` 不在 SDL 中；节点展示来自当前资源 Reader。Map 响应、错误、URL 和游标均不返回正文、邮箱、快照、内部 Comment ID 或原始 token；测试夹具使内部 ID 与公开 innerId 不同，并检查完整 JSON。

`focus` 在每次批量请求中显式传入，是客户端当前关注节点，不写进共享节点身份；服务端验证其当前可读，首次及后续请求都不能从 `frontiers[0]` 猜焦点。图边不额外携带定位 token/正文片段；首版点击节点跳转当前公开内容，出现位置继续由 Mention owner 保存，精确定位作为后续附加字段。

`referenceMapRevision` 先用匿名 public Scope 验证 focus，不可读时返回 not-found；成功时从第 4.2 节的 `cms.reference_map_revisions` 读取该 Community 版本并 HMAC 化。登录用户也使用同一匿名 public 图，Passport 变化不会改变本查询结果；若查询实现使用 actor 专属 Scope，验收直接失败。revision 允许因无关的 Community 变化而前进，但任一公开图变化都必须推进。M0 逐入口验证原事务递增；覆盖不足不得开放本字段或 30 秒轮询。

`referenceMapArticleComments` 仅接受 Post/Blog/Changelog/Doc 的公开 Article 焦点，用相同匿名 public Scope 选出其当前 Community、Doc main branch 下可读且有内部引用事实或待同步水位的 Comment。按公开 `commentInnerId` 递增分页，`first` 为 1–20；响应只给公开 locator，不给内部 Comment ID。前端将 locator 排入原邻接队列，沿用节点/边/请求预算，剩余页显示“继续加载”。待同步 Comment 使图保持 pending；没有可展示边的 Comment 不单独画成孤立节点。Comment 焦点仍只看其自身图，不自动聚合所在文章的其他评论。

### 6.3 邻接查询、分页与一致性

单个 frontier 读取**入边和出边的并集**，每条边保留实际方向；返回该节点的邻接分页，不在后端递归完整连通分量。每次 1–10 个不同 frontier，先把公开 locator 解析为完整稳定身份并拒绝重复身份，即使两个输入写法不同；`first` 为每个 frontier 的边数，范围 1–20；非法值拒绝，不静默改值。一个批次最多 200 条邻接结果，节点/边按稳定身份去重。

逻辑边按有序 `(from 稳定来源身份, to 稳定目标身份, mention_case)` 和必要的稳定 tie-breaker 字典序排序；不得先把两端排序成无向 pair，A→B 与 B→A 的键、ID 和游标位置必须不同。游标签名载荷保存 contract revision、Community、frontier key 和最后有向逻辑边键，公开游标不可解出内部 ID。使用现有签名 cursor 能力或同等级的 owner 内实现；禁止使用 offset 或重建后变化的行 ID。输入 Community/frontier 不符、游标损坏或未知 contract revision 返回明确的 invalid cursor 错误。

先应用两端 Scope 和来源水位过滤，再分页和计算 `hasNextPage`；隐藏边既不占页大小，也不贡献 total 或“更多”提示。取 `first + 1` 条**合格结果**判断下一页；批量 SQL 按 frontier 分区限制，不能先全表拉取再内存分页。

邻接响应顺序按 `requestIndex` 对应输入。显式 `focus` 不可读时返回与不存在一致的 not-found；其他失效 frontier 返回 UNAVAILABLE、空 edgeIds、false hasNextPage、null nodeId/endCursor，不回显隐藏内容。每个 AVAILABLE frontier 返回一个节点，即使没有边。

同一请求的资源投影、Scope、水位、边与分页信息使用同一个只读 REPEATABLE READ 事务。跨请求是实时、最终一致的分页，不承诺全图同一快照；游标不是权限凭证，也不是快照锚点。已知 mutation 或重新进入页面必须从焦点重新读取，不能复用旧分页拼成“当前完整网络”。

批量查询须限制查询次数：满批次不超过 32 条 SQL（不计 BEGIN/COMMIT），1→10 个 frontier 不按节点线性增加 Reader/Gate 查询。使用真实数据库计数验证，不能用 mock 通过代替。

## 7. 前端加载、布局与刷新

### 7.1 自动分批生成上下文

```text
焦点 A
  -> 请求 A 邻接
  -> 合并 nodes/edges
  -> 未读完的邻接页 + 新节点进入队列
  -> 批量读取下一批
  -> 到队列为空、预算用完或请求失败时停止
```

队列按广度优先轮转，入/出边一并探索。只去重节点不丢弃新边；某节点尚有下一页时保留其 cursor，同一页请求不能重复入队。A→B→C→B、菱形和反向引用都应终止正确。

默认一次自动加载预算为 **150 个节点、300 条边、10 次请求**，并发 1。每批最多 10 个 frontier；根据剩余节点/边预算缩小批次和 `first`，利用“一条邻接边最多引入一个新节点”的上界，不能先无限下载再隐藏溢出节点。预算耗尽显示具体原因和“继续加载”；继续加载增加一份相同预算，资源层级没有固定上限。

界面区分 loading、同步 pending、邻接已读完、预算暂停、请求失败。队列为空、`projectionPending=false` 且已请求的可读节点全部 READY，才可以显示“当前 Community 可见引用已加载”；不能称作全站完整图。空态须同时满足首次查询成功、无边、无 pending 节点及批量 pending。后续页失败保留已读图并给重试入口，不能清为空图。

### 7.2 画图与布局

后端负责节点/边/覆盖，前端负责坐标。首版提供有向网络 MiniMap；首屏无需逐层点击，高亮焦点，标明方向与类型，提供节点摘要、当前资源跳转、缩放和回到焦点。布局算法只在图数据或布局模式变化时执行；hover、滚动、缩放不重新查关系或全量布局。

环合法，同一节点只画一次；新增批次尽量固定已有节点。布局运算单次超过 50 ms 时必须分帧或转 Worker；以 150 节点/300 边夹具在浏览器记录证据。窄屏提供紧凑 Map 与可访问的引用列表；键盘和读屏用户可读取相同方向与节点信息。

Comment 节点由前端按 locale 标明资源类型和所属文章入口；所属文章不因这个标签自动进入图。评论中的 Map 入口把页面共享图切换到该 Comment 焦点，公开 URL 用父 Article 页面内的 `#comment-<commentInnerId>` 定位。目标 Comment 不在已加载分页时，使用现有 `oneComment(CommentPathInput{article: ArticlePathInput, innerId: commentInnerId})` 按公开路径取单条；深链读取须同时满足 Comment 与父 Article public Scope，随后在独立焦点 overlay 显示并定位，不把它伪装成分页列表成员；不可读/不存在时不显示旧摘要。首版不依赖尚未实现的独立 Comment permalink 路由，也不在列表每一行挂载独立自动加载地图。引用树作为后续布局使用相同图数据，按当前路径回引，不制造父子内容归属。星图/鱼骨图不在首版验收范围。

Article 焦点额外发现所属 Comment 的显式引用，不将父子归属画成边。Comment C→父 Article A 与 C→其他节点都保留实际方向；只过滤 Article A→A。评论过多时继续分页，不把尚未发现的评论误判为空图。

### 7.3 首版缓存与更新时效

**首版不增加服务端图结果缓存，也不新增公共 CDN graph tag。**GraphQL 图响应必须 no-store，并覆盖网关/SSR 层；Map 在客户端独立查询，不把整张图混入已有 Article/Ticket SSR 缓存。当前节点页面本身仍遵守原缓存合同。

客户端统一经 core query 工厂读取，query key 以 `['reference-map', community, 'public-current', focusKey]` 为前缀，完整 key 包含规范化 frontiers/cursors/first；不把 focus 或坐标写成数据库事实。失效采用整个 Community 的前缀，避免只刷新 A/B 却漏掉包含 B 的多跳图。

| 触发                                                              | 客户端行为                                                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 本浏览器发布、Comment 正文提交、可见性/删除/binding mutation 成功 | 对该资源当前有效 binding 的所有 Community 取消旧请求、丢弃图批次与游标、失效完整前缀，从焦点重读                                                             |
| 最新响应有 projectionPending                                      | 显示未完成，2/4/8/16/30 秒退避验证焦点首批；状态前进后重建图，不反复抓取整张图；最多自动追赶 2 分钟，仍 pending 则保留“暂未完整”和“重新检查”，后者只重新查询 |
| 其他浏览器/后台变化                                               | 页面可见且 online 时每 30 秒先请求 `referenceMapRevision`；revision 未变即停止本轮，变化后从焦点按原 10 请求预算重建；窗口重新聚焦/网络恢复立即验证          |
| scope/account/Community 变化                                      | 丢弃前一上下文的图与请求；不得保留跨身份数据                                                                                                                 |

定时验证在 revision 变化后从焦点重新取邻接，不沿用旧 cursors；新一轮首批成功后整体替换旧节点/边，后续自动补齐，不能把尚未重新验证的远端旧节点一直留在图上。新一轮完成后比较规范化的节点 ID、边 ID、方向与展示字段；若图数据完全相同，保留原坐标且不运行布局。若仅标题/URL 等展示字段变化，只更新显示，不重排拓扑。revision 未变的一轮最多 1 次 GraphQL 请求，不下载邻接、不重新布局；revision 变化的一轮最多 1 次验证请求加第 7.1 节的 10 次图请求预算。焦点 not-found 时立即清图；网络失败时标明旧数据时间和失败态，不声称权限仍然有效。自己的隐藏/删除操作成功后立即移除旧图数据。

首版没有跨浏览器实时推送承诺，在线其他客户端受下一次验证和网络时延影响；离线/失败时不承诺撤回已经送达浏览器的数据。服务端每次请求都执行当前 Gate，不等待轮询才生效。常规轮询不重新启动连续两分钟的 pending 追赶计时，只有水位追平或新的本地内容提交才重置。

## 8. 内容变化与效果矩阵

各资源 owner 在原事务记录持久同步意图或递增 GraphRevision；任务消费仍由 CMS.ArtimentMentions 管理。读取、重建、mirror 不发送 Mention 通知。

| 变化                                                   | Mention 事实/水位                                                      | GraphRevision 与读取                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 创建普通 Article/Ticket Draft、SaveDraft               | 不变                                                                   | 公开图不变                                                                                     |
| 首次/再次 Publish、正式选定版本                        | 每 Article 一次 desired 与持久同步意图，包括零引用；Doc 按 main branch | 原事务推进所有有效 binding Community；旧 token 边立即过滤，事实提交后再推进                    |
| 仅公开标题/slug 修改                                   | 正文 token 未变则不重建边                                              | 原事务推进受影响 Community；节点读取新标题/路径                                                |
| User Ticket 工作状态/排期                              | 不重建正文边                                                           | 只有改变公开 Gate/节点展示时推进；TicketSource 仍归原 owner                                    |
| 新建/回复/编辑 Comment                                 | 每 Comment 一次当前 CommentBody 同步                                   | 按父 Article 当前有效 binding 推进；回复本身不制造引用边                                       |
| Comment/父 Article 隐藏、恢复                          | 事实可保留；若 owner 清 outgoing，恢复须持久记录重建任务               | 原事务推进可受影响 Community，读取执行两端 Gate                                                |
| Article/Ticket ReviewBlock、MoveToDraft、Trash/Restore | 公开选版变才更新 desired；隐藏不复制事实                               | 原事务推进所有受影响 Community，Draft 不公开                                                   |
| Community Lifecycle/公开权限规则                       | 不改变正文边                                                           | 原事务推进该 Community；恢复后重查当前 Gate                                                    |
| mirror/move/unmirror                                   | **不改 Article 级事实、水位或通知**                                    | 原事务推进加入/移除的 Community；仅改变图投影及路径；仍遵守 TicketSource 的 move/unmirror 禁令 |
| 来源永久删除                                           | 同来源锁内清 outgoing/水位，在途任务终止                               | 原事务推进原有效 binding Community；不复活事实                                                 |
| 目标永久删除                                           | 已失效目标不得进入公开图；事实清理由 Mention owner 完成                | 原事务推进其原有效 binding Community；不保留 snapshot 或展开                                   |
| 目标隐藏后恢复                                         | 无需来源重编正文                                                       | Gate 允许后，原边重新可见                                                                      |
| 同步失败/重建中                                        | synced 不前移，任务可重试                                              | 旧 token 边不展示，pending 不伪装成空图                                                        |

M0 必须逐一枚举 Article/Comment/Ticket/Doc/Community 的 Command、人工与 AI Review、Lifecycle、binding 和公开投影写入口，固定原事务调用点。任何直接 SQL 写入公开版本或可见性的维护入口，必须关闭 Map/revision 轮询并完成同一 owner 的 report/apply 后才能开放；不承诺绕过 owner 的 SQL 自动维护。

## 9. 文件级实施清单

路径相对仓库根目录；“新增”是计划入口，M0 固定最终路径。

| 范围                      | 文件/模块入口                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 修改责任                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 事实与水位                | `backend/api/lib/groupher_server/cms/model/artiment_mention.ex`；新增 `cms/artiment_mentions/model/sync_state.ex` 和 migration；现有 `20260602090000_create_artiment_mentions.exs` 仅作当前约束 inventory                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 第 4.3 节最终列、Community FK/索引删除、typed ID、edge_key trigger、GraphQL 字段清单及 pending 索引                                                                                                                                                                                                                                                                                                                                   |
| 图 revision               | 新增 `cms/artiment_mentions/model/graph_revision.ex`、`cms/artiment_mentions/graph_revision.ex` 与 `cms.reference_map_revisions` migration；资源 Command/Effects 原事务调用点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 每 Community 单调版本、所有公开图触发、密钥轮换推进；M0 inventory 列出具体调用文件                                                                                                                                                                                                                                                                                                                                                    |
| 解析/同步                 | `cms/artiment_mentions/{config,parser,public_url,store}.ex`；新增 `cms/artiment_mentions/sync.ex`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 平台 locator 解析、复用 PublicUrl 相对路径并移除旧 UUID fallback、custom-domain external、canonical token、来源锁、全局 Article 替换与终结删除任务；`sync/1` 入参/返回合同不变                                                                                                                                                                                                                                                        |
| public facade/图读取      | `cms.ex`、`cms/artiment_mentions.ex`；新增 `cms/artiment_mentions/graph.ex`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | anonymous public typed Scope、双端过滤、Community 内批量邻接与水位                                                                                                                                                                                                                                                                                                                                                                    |
| 资源效果                  | `cms/articles/{workflow,effects/publish}.ex`、`cms/comments/effects.ex`、`cms/tickets/{persist,effects}.ex` 及对应 Outbox workflow，尤其 `cms/outbox/workflow/article.ex`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 原事务只记录一次 Article 级 `article.mention_sync`；Comment 可靠交接，不复制 `article.projections` 副作用                                                                                                                                                                                                                                                                                                                             |
| binding/Comment Gate/删除 | `cms/{articles/binding_persist,articles/trash,review_blocks,comments/lifecycle,communities/lifecycle}.ex`；`cms/{model/comment,model/comment_review_block,gate/scope/comment,gate/scope/community_chain,front_desk/comment,front_desk/relation,comments/query,comments/numbering,comments/commands/create,article_stats,events/notify,review/decisions,review/requests,review/target,review/notice}.ex`；`backend/api/lib/groupher_server_web/resolvers/cms/review.ex`；`backend/api/lib/groupher_server/alert_wall/{model/item,model/user_report,commands/submit_report,commands/resolve,persist}.ex`；Comment/AlertWall migration；Doc/Ticket Lifecycle/Review | 保留现有 origin 侧 public `article_of/1` 的签名/职责；跨 mirror 调用方复用 `FrontDesk.comment(path)`、`FrontDesk.article(path)`、`FrontDesk.resolve_binding/2` 或既有 internal Article/Comment view，不改成 `/2`；普通/Doc Comment 的 CHECK/FK 删除约束、origin 删除后操作、Comment 举报在 UserReport/Item 现有 community_id 列上的不同写入与权限语义、相关 FK/索引、Doc Comment 独立 Scope；mirror 只推进 revision，硬删除与同步共锁 |
| GraphQL/Trash             | `backend/api/lib/groupher_server_web/{schema/cms/cms_metrics,schema/cms/cms_queries,schema/cms/cms_types,resolvers/cms/artiment_mentions}.ex`；`backend/api/schema.graphql`；Ticket public Query/Reader                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 第 4.3/6 节新一跳字段、必填 Community、TicketPathInput 的双向 root、删除 Trash 嵌套 Mention、opaque ID/revision、导出与 codegen                                                                                                                                                                                                                                                                                                       |
| 前端 query                | 新增 `frontend/core/{schemas/pages/referenceMap,query/referenceMap}.ts`，现有 query key/client/factory；`frontend/community/src/server/public-path.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Community 前缀失效、轻量 revision、custom domain 展示路径、相同图不重排                                                                                                                                                                                                                                                                                                                                                               |
| 前端组件与路由            | 新增 `frontend/core/unit/ReferenceMap/`、`hooks/useReferenceMapGraph/`、`frontend/community/src/routes/$community/blog/` route/page；现有 Post/Changelog/Doc/Ticket 路由与 `frontend/core/unit/Comments/`                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 分批队列与布局、六类入口；首屏外 Comment 用 `oneComment` 独立焦点 overlay                                                                                                                                                                                                                                                                                                                                                             |
| 重建/巡检                 | 新增 `backend/api/lib/mix/tasks/cms.mentions.rebuild.ex`、`backend/api/lib/groupher_server/jobs/cms_mention_health.ex`，登记 `backend/api/config/config.exs` Oban Cron                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 全局来源 report/apply、持久失败清单、`--only-failed`、每 15 分钟巡检与告警                                                                                                                                                                                                                                                                                                                                                            |

后端不新增 custom-domain registry；首版 custom-domain 绝对链接按 external URL 处理。若未来要解析为内部引用，另补后端 domain owner、受信映射来源及路由一致性测试。

## 10. 实施阶段与切换

### 10.1 依赖阶段

| 阶段               | 产出                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 出口，未满足不得进入下一阶段                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 基线与 manifest | 新增 `docs/feature/article/reference-map-inventory.md`；逐入口列出六类资源的 Command/Effects/锁/事务、`sync/1` 的 Event/DocTree 等现有调用与返回合同、PublicUrl/旧 Config URL fallback 全调用点、全局 Article 身份、Comment 的 `FrontDesk.article_of/1`/`Relation.article_of/1` 全调用方及保留 origin 语义或迁往既有 public path/internal API 的目标、reply/upvote/emotion/edit/通知 Job、Review.Decisions/Requests/Target/Notice、Review resolver 与 AlertWall 的 Comment target/scope/授权、现有 UserReport/Item community_id 两列的写入/FK/索引及 Comment 可选输入、决策 scope 提升和 Community 删除时的审核历史保留、Doc Comment 独立 Scope 与 thread 非空/允许值 CHECK、origin 行内 CHECK/跨表并发保护、`cms.artiment_mentions` 最终 DDL/GraphQL 删除字段消费者、GraphRevision 触发、真实路由、专用事件 payload/幂等键与告警接收方 | 提交失败用例：同 Article 双目标、同 Article 双 binding 仍只有一份事实/水位、X 创建 Comment 后 Y 读取/回复/upvote/emotion/edit/oneComment、X 删除后上述操作与通知仍可用、仍有 Doc Comment 时 Community 硬删整笔失败、Y 举报进入平台队列且不能由 Y 管理员全局隐藏、Doc Comment 保持 branch Scope、Ticket 一跳双向 root 与非法票号拒绝、旧任务与硬删除竞态、平台正例/custom-domain external 反例、现有 PublicUrl 正例与旧 UUID URL fallback 不出公开响应；六类入口和受影响 Community 的 revision 调用点全部列出，无“后补入口” |
| M1 事实与可靠同步  | Article 级边/水位、`sync_current/2` 与保留签名/返回合同的 `sync/1` 适配、复用 PublicUrl、第 4.3 节最终 DDL/导出 SDL、普通 Comment nullable origin FK/全局 ReviewBlock/单次通知/统计、跨 mirror 调用方迁往现有 FrontDesk public path/internal API，`article_of/1` 合同不变、Comment 举报分别写入现有 UserReport/Item community_id、定向扩展 SubmitReport.Target 输入并保留 execute/5 合同、Doc Comment branch Scope 不变、Doc/Ticket 适配、专用 Outbox、canonical 选版/来源锁、终结删除任务、report/续跑/巡检、GraphRevision 存储及写入点                                                                                                                                                                                                                                                                                                | R01–R05、R07、R11/R12 的事实部分通过；mirror/unmirror 不改边/水位、不发 Mention 通知；目标列/索引/CHECK、Trash 字段移除与消费者清单验收；X 删除后 Y 的共享 Comment 可操作且通知链接不回退 origin，Doc Comment 未清理时 Community 删除整笔失败；跨 mirror 举报走平台、origin 为空走平台，普通 Comment 全局块与 Doc Comment branch 块分别正确；Ticket 一跳双向 root 与非法票号拒绝可用；Comment 缺正文失败、队列失败可重试；每类 revision 触发与密钥轮换通过真实事务测试                                                     |
| M2 授权图 API      | SDL、普通 Comment 跨 mirror Gate/FrontDesk、Doc Comment branch Gate 与匿名 public 批量 Scope、游标、全局事实的 Community 投影、水位过滤、opaque ID/revision、SQL 计数、导出/生成类型                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | R06/R08/R09/R13 及 R12 图过滤通过；登录与匿名同图，X 创建 Comment 在 Y 可定位且 origin 删除后仍能从请求 binding 读取；Doc Comment 仍按 Doc main branch 授权，内部 ID/token 不出响应；缺水位/漂移使批量 pending；所有可见图变化推进 revision                                                                                                                                                                                                                                                                                |
| M3 Post MiniMap    | 共享 query/队列/布局、默认上下文与 30 秒轻量刷新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | R10/R14/R15 的 Post 验证通过；revision 未变仅 1 次请求，变了但图相同不重排                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M4 其余页面        | Blog 公开路由，Blog/Changelog/Doc/User Ticket/Comment 入口、导航与 Comment `oneComment` 深链                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | R01/R10/R14/R15 对六类通过；首屏外 Comment 和 Doc 空 slug fallback 可导航                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| M5 目标环境切换    | 新模型初始化、全量 current-source rebuild、健康告警和环境 smoke                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | R16 及 R01–R15 全绿；目标环境 report、巡检与告警真实运行后才能标记实施                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

任何“未运行”“环境阻断”“仅 mock”均不是验收通过。密钥轮换、revision 覆盖或匿名 Scope 未完成时，不开放 30 秒轮询；图 API 本身仍须通过 Gate。

### 10.2 重建、巡检与切换

计划新增命令：

```bash
# 在 backend/api 执行。
mix cms.mentions.rebuild --report
mix cms.mentions.rebuild --apply --batch-size 100
mix cms.mentions.rebuild --apply --batch-size 100 --after <checkpoint>
mix cms.mentions.rebuild --apply --force --batch-size 100
mix cms.mentions.rebuild --apply --only-failed <failure-manifest>
```

report/apply 遍历**全局来源键**，普通 Article 无论有多少 binding 只扫描一次。checkpoint 为稳定 type/source/必要 branch 的字典序键，不包含 Community，也不用 offset；已永久删除来源可终结并从 failure manifest 移除。`--report` 只读，列出缺失/落后/漂移水位、重复边、身份异常、unsupported locator、耗尽事件与失败清单，不输出正文/私有标题。`--apply` 每来源一个原子同步事务，最多 100 项一批；`--force` 重新解析已同步来源，不发送通知。失败项写入持久 manifest，只含来源键、错误类别、重试次数；checkpoint 可越过已登记失败项继续扫描，但本轮退出非零，普通 `--after` 不能把失败项视为完成。`--only-failed` 逐项追赶当前 canonical token，成功或来源已删除后移出清单；未清零时退出非零。

新增 `GroupherServer.Jobs.CMSMentionHealth`，Oban Cron 每 15 分钟触发；全局来源分页检查缺失/落后/漂移水位、耗尽 Outbox 与失败清单，再按受影响 Community 汇总，不把正常 hard delete/unmirror 误报为缺正文。异常发结构化 telemetry 并使任务失败；M0 inventory 固定告警接收方和阈值，M5 做目标环境故障注入。巡检只报告，不修复或发 Mention 通知；一轮未扫完要继续 checkpoint，不能把未扫部分报为健康。

切换顺序：先落新事实身份/水位/revision 约束和可靠同步；在目标环境用 `--report` 验证新模型，再用 `--apply` 按当前 canonical 正文建立事实；确认零引用来源也 READY、所有有效 Community revision 可推进、六类 GraphQL/Gate/路由/性能 smoke 通过后开放 Map。无旧数据兼容、双写、旧 URL 回退或历史行迁移要求；遇到问题先关闭 Map/轮询入口，修复新 owner 后重新 report/apply。本文不授权执行目标环境切换或销毁其他内容数据。

## 11. 验收矩阵与证据

以下测试文件已在本地实施中新增/扩展；实际运行结果与本地隔离环境的验收记录见 [实施 inventory](reference-map-inventory.md)。

| ID                            | 必须通过的用例                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 证据位置                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| R01 类型与来源边界            | Map 六类均可 root/source/target，Ticket 另可作 `mentions/mentionedBy` 的 root；`TicketPathInput` 的 Community/innerId 错配、非数字、`0`、负数、超出 ArticleBinding inner_id DB 范围及 Worker/Case 均拒绝，不得 cast 为默认票号；真实平台 URL/GraphQL locator 正反向 fixtures 含 Community innerId、Doc slug/fallback、Ticket、Doc Comment 和 Comment 焦点；custom-domain 绝对链接和伪造 host 均作为 external，不解析为内部边；完整 JSON 不含内部 Comment ID 或旧 UUID URL fallback；Worker/Case、User/URL、非 main、跨 Community 不进入公开图                                                                                                                                                                            | inventory + GraphQL/页面集成测试        |
| R02 DB / 零引用               | 普通 Article 同一正文在两个 binding 下仅一组事实和一行水位；mirror/unmirror 不改事实/水位；身份/branch/唯一性直接 SQL 负向；同来源不同 Article 目标保留两边，同目标 occurrences 合并；零引用 READY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | migration/真实 DB 测试                  |
| R03 公开与 Draft              | SaveDraft 不改公开边；Publish 立即滤掉旧版本，异步完成后显示新版本；选定旧 Revision 为当前公开版时按该 canonical token 重建                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | sync 测试                               |
| R04 幂等与乱序                | 同一 Article 级事件重复、v1/v2 反序、同步中 Publish、Comment 连续编辑最终追到当前 token；既有 `sync/1` 已加载资源调用与 `{:ok, :pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | {count, nil}}                           | {:error, reason}` 返回合同保持；mirror/unmirror 前、任务中、任务后都不重复同步或通知；X/Y 共用 Comment 只生成一次通知；永久删除在任务之前/中途均终结且不复活边；不重复管理员通知、Activity、cache/search | 并发真实 DB + Outbox 效果计数 |
| R05 原子性与失败              | 原内容事务回滚无任务/desired；首次公开有水位；来源仍存在但正文缺失、解析/FK/插入失败回滚且可重试；来源硬删除终止为成功 no-op，unmirror 不终结全局任务；下游投递失败重试并进入失败清单，`--only-failed` 可恢复；force 不发通知                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Outbox/worker 故障注入                  |
| R06 Gate                      | 登录与匿名使用相同 anonymous public Scope；两端与 Comment 父 Article 分别可读，X 创建的 Comment 在 Y 的可读 mirror 中仍是同一节点；普通 Comment 的全局 ReviewBlock 同时隐藏 X/Y；Y 举报 X 创建的 Comment 时现有 UserReport 的 `community_id=Y`、Item 的 `community_id=NULL`（平台队列），Y 管理员不能决定或生成全局块；origin 为 null 时 Item 的 `community_id` 也必须为 NULL；若 X/Y 举报合并到同一 item，Item 的 `community_id` 提升为 NULL 后不得回落到 Y 的权限；Doc Comment 保持 Community/main branch ReviewBlock；隐藏目标恢复后旧边可见，隐藏中间节点不可穿透；未知 type/错 branch fail closed；响应、错误、游标不含内部 Comment ID/token/snapshot；权限与可见性变化推进相应 Community revision                  | graph/Gate + AlertWall 真实 DB 测试     |
| R07 全入口效果                | Publish、人工/AI Review、Trash/Restore、MoveToDraft、Community lifecycle、binding、永久删除和公开 title/slug 都按第 8 节在原事务更新意图或 GraphRevision；mirror 只更新受影响 Community revision；Comment 计数全 Article 一份、Community 活动计数只归创建地，审核/恢复推进所有 binding revision                                                                                                                                                                                                                                                                                                                                                                                                                          | inventory 每行对应事务测试              |
| R08 分页                      | focus 不可读 not-found；重复 frontier 拒绝；入/出边并集、B↔C 两个有向 key、first+1、授权后分页、cursor 错配、失效 frontier、跨请求变更；本批任一可读节点缺水位/漂移时 `projectionPending=true`，Community 内未到达来源且 `synced_content_token=NULL` 的 pending 也保留                                                                                                                                                                                                                                                                                                                                                                                                                                                   | GraphQL query 测试                      |
| R09 图语义                    | A→B→C、B↔C、菱形、环、长链、宽图；节点去重不丢边；同一 A→B 全局事实在 X/Y 分别经两端 Gate 投影，B 只在 X 可见时 Y 不显示该边；mirror 不写反向或复制边                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Mention + Graph/队列测试                |
| R10 生成与 UI                 | 默认 Map、方向、六类真实路由；Doc 空 slug、首屏外 Comment 经 `oneComment` overlay 定位；custom domain 展示路径无重复 Community slug；预算/继续/失败/空态/pending、窄屏与键盘可用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | UI + 浏览器深链                         |
| R11 业务隔离                  | 引用不增加 TicketSource、处理进度、票数/评论聚合或通知受众；mirror、读取、布局、rebuild 不发 Mention 通知；Ticket 工作状态不重建正文边                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Ticket/Messaging 集成                   |
| R12 删除与恢复                | 硬删除清来源边/水位，在途同步成功终止且巡检不误报；unmirror 前/中/后全局事实不变；X origin Community 硬删后，Y 的同一 Comment/边、回复、upvote、emotion、编辑、`oneComment` 仍可用，跨 mirror public path 与 internal `FrontDesk.article(..., mode: :internal)` 均不回退 origin，origin 侧 `article_of/1` 不用于该路径；后台通知只一次并选当前有效 binding 链接或无深链，origin FK 置空；仍有 Doc Comment 时真实 DB Community 删除整笔失败且 Community/Comment 未改变，Doc owner 清理后才可删除；所有仍引用已删 Community 的审核 item 当前 scope 转入 platform，已结案的实际决定者/原 scope 保留在审核历史；隐藏目标恢复后旧边可见；一跳 Mention 列表按必填 Community、新相对 URL/授权合同工作，Messaging 不泄露私有信息 | 真实 DB、Trash、Mention、Messaging 回归 |
| R13 性能                      | 1/10 frontier 的真实 SQL 计数；每请求≤10 frontier、每个≤20 邻接；常规 10 frontier SQL≤32、不逐节点解析正文；45 边以上真实 DB 用例跨有界窗口分页不漏边；一跳列表在 SQL 过滤匿名 public Scope，cursor 页流式读取至 first+1，offset 页流式统计精确总数且仅保留当前页；全局 pending 索引经 binding join 筛 Community，不全表重算                                                                                                                                                                                                                                                                                                                                                                                             | SQL 计数 + 高扇出真实 DB + EXPLAIN      |
| R14 刷新                      | 本浏览器内容/审核 mutation 失效所有有效 binding Community 图，view、reaction、upvote 等非内容 mutation 不触发全图重载；ReviewBlock/binding/公开 title/slug/权限规则变化使受影响 revision 前进；密钥轮换使 revision 与 node/edge ID 变化、旧 cursor 失效；pending 退避、READY 后清除旧查询缓存再加载、失败续跑、focus/online 正确                                                                                                                                                                                                                                                                                                                                                                                         | query/浏览器 + 故障注入                 |
| R15 展示成本                  | 150 节点/300 边分帧、窄屏/键盘/读屏；30 秒 revision 未变时≤1 次 GraphQL、零邻接/布局；revision 变但新图 ID/方向/展示字段相同则≤1 次验证加 10 次预算内图请求、**零布局**；仅展示字段变则更新 UI、不重排拓扑；hover/缩放不取数或重排                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 浏览器网络/性能                         |
| R16 切换与门禁                | 全局 report→apply→失败清单 `--only-failed`→续跑→force；每 15 分钟巡检覆盖所有全局来源与对应 Community，告警真实投递；无历史数据兼容步骤，六类端到端与目标环境 smoke 全绿                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 命令/退出码/测试数/环境/告警证据        |
| R17 Article 所属 Comment 引用 | Article A 焦点分页发现自身可读 Comment 的引用；C→父 A、C→其他 B 均按真实方向展示，Article A→A 不展示，父子归属不造边；已同步且无引用的 Comment 不入发现页，待同步的 Comment 使图 pending；mirror 使用当前 Community 公开 locator，Doc main branch 可用；无效 cursor/Comment 焦点拒绝，公开响应不含内部 Comment ID；多页在客户端继续加载且无可展示边的节点不作孤点                                                                                                                                                                                                                                                                                                                                                        | GraphQL 真实 DB + MiniMap 组件回归      |

R06/R12/R17 的补充回归：普通共享 Comment 的 AI 初始 hold 与 AI 结果限制均为全局 ReviewBlock，X/Y 各有未完成审核请求时，完成其中一条不能解除另一条；历史社区作用域块迁移为全局并由数据库拒绝再次写入。软删除 Comment 在原事务写入 tombstone desired token 和专用 Mention sync 事件；worker 清除旧出边并推进 synced，重建 report 不留下 canonical drift，Article MiniMap 不会因旧边持续 pending。创建共享 Comment 后，每个当前 ArticleBinding 都有独立的 `comment.changed` 缓存失效事件。

后端既有回归入口包括 `backend/api/test/groupher_server/cms/artiment_mentions_test.exs`、`test/groupher_server_web/query/cms/artiment_mentions_test.exs`、Ticket/Trash/Comment/Messaging 相关测试。新增 sync/graph 测试放在 `backend/api/test/groupher_server/cms/artiment_mentions/`，GraphQL 图测试新增在 `test/groupher_server_web/query/cms/reference_map_test.exs`。

文档修改阶段运行 `pnpm docs:check`、修改文件的链接/表格/代码围栏检查与 `git diff --check`。实现阶段另需 `mix compile --warnings-as-errors`、上述真实数据库测试、GraphQL SDL/type generation、相关 frontend Vitest、type-check 和浏览器验收；只修改文档时不得把这些实现检查记为已通过。

本轮按本合同完成本地实现与隔离环境验收；生产部署和生产数据切换需单独执行。Timeline 与 Ticket 依赖继续独立讨论。
