# Article Community

> 状态：ArticleBinding relation normalization 与公共路径编号合同已实现；Ticket 于 2026-11-01 取代 Post 的 Community-local Kanban 状态。
> 本文第 1.1 节的 Comment 跨 mirror 共享、全局审核与无 Community 持久归属是当前实现合同；实现与验收记录见 [解耦重构合同](article-lifecycle-comment-decoupling.md)。
>
> 本文是 Article 与 Community 关系的唯一产品合同。Revision、Draft、Lifecycle、
> Moderation、Kanban 等文档只能引用本文，不能重新定义一套 `home` / `mirror` 关系角色。

> Ticket V2 的来源关系与 binding 保护已落地：[Ticket V2](../tickets/v2.md)用 TicketSource / cms.ticket_sources 完整替换 TicketPost，字段统一使用 type，首批仅 POST。Post 存在任意持久化 TicketSource(type=post) 时，所有 Community binding 的 move/unmirror 均拒绝，包含非关联 Community、Draft Ticket 和隐藏来源；命令与数据库 trigger 共守该约束。实现和负向测试见 [R05/R09](../tickets/inventory.md#v2-实施追踪)。

## 1. 核心结论

`Article` 是跨 Community 共享的稳定内容身份；`ArticleBinding` 表示这篇 Article
出现在一个具体 Community 中。

```text
Article
├── ArticleBinding(article, community-a)
├── ArticleBinding(article, community-b)
└── ArticleBinding(article, community-c)
```

所有 `ArticleBinding` 关系平级：

- `home` 只是可能存在的 Community 名称，不是关系角色；
- `mirror` 是创建关系的产品命令，不是持久化关系类型；
- 一篇 Article 可以关联零到多个 Community；
- 不存在“每篇 Article 必须或最多有一个 home relation”的领域不变量；
- `ArticleBinding` 不是第二份 Article，也不复制 Draft、Revision、Comment 或 Interaction。

普通 Article 的正文引用（Mention）同样是 Article 级事实：同一公开正文只解析、同步和保存一次。`mirror`/`move`/`unmirror` 不复制、重建或清除该 Article 的引用事实，也不重新发送 Mention 通知。引用的目标按正文中的明确公开 locator 解析为稳定资源身份；不能以当前展示 Community 重新解释同一链接。

Community 的引用 Map 是读取投影：在请求的 Community 中用当前 binding、Lifecycle 和 public Gate 判断引用两端是否可见，再生成该 Community 的路径。binding 增减只改变投影可见性与缓存版本；Article 级正文或引用事实不随之改变。Comment 是挂在 Article 下的独立资源；其创建 Community 只记录操作发生的位置，不因父 Article 被 mirror 而复制 Comment 或 Comment Mention。Article MiniMap 可分页发现本篇可读 Comment 的显式引用及待同步状态，但父子归属不产生引用边；Comment 提及父 Article 是 Comment→Article，Article 自引用则过滤。Doc 的公开 main branch、Ticket 的单 Community 身份分别按其 owner 选版，不套用普通 Article 的 mirror 规则。目标合同见 [Reference Map](./reference-map.md)。

`ArticleBinding` 的最小合同是：

```text
cms.article_bindings
├── id
├── article_id
├── community_id
├── inner_id
└── timestamps

UNIQUE(article_id, community_id)
```

关系存在表示 Article 出现在该 Community；关系不存在表示它不在该 Community。

### 1.1 Comment 随 Article 共享，不随 binding 复制

在 Community X 创建的普通 Article Comment，父 Article 若也绑定到 Y，同一 Comment 在 X/Y 的公开页面使用相同 Comment ID、正文、回复、upvote、emotion 和 Article 内分配的 `commentInnerId`。请求路径提供当前 Community；读取同时检查该 Community 的父 Article binding、父 Article public Gate、Comment Lifecycle 与**全局** Comment ReviewBlock。Comment 的创建 Community 不能作为只允许 X 读取的 Gate 条件。Doc/Doc Comment 的 branch 选版仍按 Doc owner，不套用普通 Article 的 mirror 规则。

普通 Article Comment 的最终 ReviewBlock 只允许 `community_id = NULL` 的全局作用域，一次隐藏在所有可读 mirror 中生效。平台审核员可以执行全局审核决定；社区 policy/request 仍可用于本社区 AI 队列，但社区管理员决定或 AI 结果不能生成、解除普通 Comment 的全局 ReviewBlock。达到举报阈值时现有 `report_threshold_hold` 流程可以暂时隐藏；单次举报本身不隐藏。用户举报发生地记录在 UserReport，处理 Item 使用全局队列。Doc Comment 继续遵守 Doc owner 的 branch/Community 审核规则。

Article 的评论数和参与人数按全局 Comment 集合统计，在所有 mirror 页面展示同一 Article 级值；Comment 创建、回复和作者/被回复者通知只产生一次。Community 活动计数记录各次操作明确请求的 Community。共享 Comment 变化使父 Article 所有当前 binding 的评论缓存、搜索投影与 Map 版本失效。

Comment 只持久保存稳定身份、父 `article_id` 和正文等自身数据，不保存创建 Community。公开读写必须从本次 Article/Comment 路径解析 Community 并检查有效 binding；内部任务使用稳定 ID，若要产生 Community 链接必须携带明确上下文或从当前有效 binding 中按稳定规则选择。Doc Comment 的 branch 仍由 DocBranch 校验。创建 Community 删除后，只要 Article 仍绑定在 Y，同一 Article、Comment、互动与引用事实便继续从 Y 读取；当前请求和举报发生地也不会被误当作 Comment 的永久归属。

`FrontDesk.Relation.article_of/1` 没有请求 Community 参数，无法为共享 Comment 推断当前公开路径，现已废弃并在无上下文时 fail closed。公开调用方使用已有 Article/Comment path；内部父资源调用使用 `FrontDesk.article(article_id, mode: :internal, view: :command_context)`，Comment 的父 Article 摘要使用 `FrontDesk.Comment.read(comment_id, mode: :internal, view: :article_context)`。`article_of/1` 的兼容入口暂时保留以便迁移旧调用方，不允许它任选 binding 伪造请求上下文。

## 2. 为什么需要独立关系

Article 与 Community 是多对多关系，并且同一篇 Article 在不同 Community 中可以拥有
不同的运营数据：

```text
Article A
├── Community A ArticleBinding
│   ├── tags: product, urgent
│   ├── pinned: false
│
└── Community B ArticleBinding
    ├── tags: frontend
    ├── pinned: true
```

这些事实以 `article_binding_id` 为作用域：

```text
ArticleBinding
├── ArticleBindingTag     0..N
├── PinnedArticle           0..1
```

这层关系提供三个能力：

1. 统一判断 Article 是否出现在某个 Community；
2. 为 Community-local 的 Tag 与 Pin 等事实提供外键挂载点；
3. 删除关系时，通过外键级联清理该 Community 的局部数据，而不删除共享 Article。

## 3. 命令语义

### 3.1 添加到 Community

`mirror` 可以继续作为产品用语，但它只表示一个幂等命令：

```text
mirror(article, community)
  -> insert ArticleBinding(article_id, community_id)
```

命令完成后，数据库中只有一条普通、平级的 `ArticleBinding`，不保存
`role = mirror`。

### 3.2 从 Community 移除

```text
unmirror(article, community)
  -> delete ArticleBinding(article_id, community_id)
  -> cascade Community-local tags / pin
```

删除 ArticleBinding 关系不删除 Article、Revision、Comment、Interaction、Mention 或其他共享事实；只使该 Community 的对应引用 Map 投影失效。

如果 Article 已发布，至少必须保留一条 ArticleBinding 关系；最后一条关系不能被删除。

### 3.3 Move

如果产品仍保留 `move`，它只是组合命令：

```text
move(article, source, destination)
  -> add destination ArticleBinding
  -> remove source ArticleBinding
```

添加目标关系与移除来源关系必须在同一事务内原子完成；任一步失败都不得留下双关系或零
关系的中间状态。

`move` 不查找或替换特殊的 `home` relation。也可以在产品层只暴露“添加到社区”和
“从社区移除”，不再提供独立 Move 概念。

这些命令的 actor/action admission 仍由 CMS Gate 负责；关系唯一性、两端 Community
存在性和关联数据清理由 ArticleBinding owner 负责。

## 4. 可见性边界

ArticleBinding membership、Article Lifecycle、Moderation 和 Community Lifecycle 是不同事实：

```text
ArticleBinding exists
  AND Article Lifecycle is publicly readable
  AND Article moderation allows public read
  AND target Community Lifecycle allows public read
  -> Article can appear in that Community
```

如果产品需要“保留 ArticleBinding 关系，但仅在某个 Community 暂时隐藏”，可以在
`ArticleBinding` 上保留明确的 Community-local visibility 字段。否则，关系存在性本身
足以表达 membership。

不得把 Article-global moderation 复制成每条 ArticleBinding 关系的独立权威；读取时组合权威事实，
或把冗余字段明确标注为可重建 Projection。

## 5. 公共路径与编号

公开 `inner_id` 归属每条 ArticleBinding，同一 Article 在不同 Community 可以有不同 `inner_id`。当前 Community 的公开路径由该 binding 和 thread 组成；移除 binding 后该 Community 的路径不再可读。Article UUID 是共享内容身份，`inner_id` 只是该 Community 的公开定位符，不能进入普通 Article 的互动或 Mention 事实键。mirror 页面仍使用当前 Community 路径，引用 Map 的节点 URL 在读取时按当前 Community binding 生成。Doc、Ticket 的路径遵守各自资源合同。

## 6. Ticket 与 Community 的关系

Post 的社区关系仍由 `ArticleBinding` 表达；Ticket 是独立的 `Article(thread=:ticket)`，并有自己的单一 Community `ArticleBinding` 与 `TicketState`。Ticket 的 User/Worker/Case 状态不属于 Post 的 community-local projection，也不随 Post mirror 到其他 Community。

```text
Post Article
  └── ArticleBinding (one or more Communities)

User Ticket Article
  ├── one ArticleBinding
  ├── TicketState (status, priority, schedule, version)
  └── TicketSource(type=post) -> same-Community Posts
```

上图记录稳定的 Article 与 Community binding 关系。Ticket 来源另存于 `cms.ticket_sources`，不进入 ArticleBinding；Post 的处理进度从关联 Ticket 读时计算，提交后的刷新和缓存/通知效果经既有 Outbox 异步处理，不在 Post 保存第二份工作状态。

只有 User Ticket 可公开展示并关联公开 Post。Worker 和 Case 仅在内部工作台可见。Ticket link/unlink、Post 隐藏及删除由 Ticket 命令处理可见性、关系和缓存；普通 Article mirror/move/unmirror 命令拒绝 `:ticket`。旧 `KanbanState` 表、Post 状态 mutation 和 Post Kanban 查询已在 T0–T5 切换中退役。ArticleBinding 本身的普通关系、Tag、Pin、公共路径与编号合同保持不变。

## 7. Ticket 切换验证记录

- `TicketState.article_binding_id` 指向 Ticket 自己的规范 Community binding；数据库触发器禁止 Ticket 第二条 binding。
- Community Post 不再携带 Ticket 状态；Post 进度由独立 `postTicketProgress` 读取关联 User Tickets。
- 普通 ArticleBinding 迁移与 Ticket identity migration 分开，Ticket 不是 mirror 内容，不参与 ArticleBinding 多社区扩散。
- 本地验证：完整后端套件 2,438 项通过、1 项按 `:later` 排除；前端 295 个测试文件/1,241 项通过；GraphQL codegen/合同和全仓 type-check 通过。目标环境数据重建和真实 URL/CDN smoke 尚未执行，见 [Ticket V2 R01/R12](../tickets/inventory.md#v2-实施追踪)。
