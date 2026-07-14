# Search Artiments 重构方案

> Status: Phase 0 tooling and Phase 1 Article search implemented; Phase 2 Comment
> search and Phase 4 AI search remain planned.
>
> 本方案建立 Article 与 Comment 的统一搜索投影，并通过平台无关的适配层接入
> Algolia、语义搜索服务或未来的 Native Search。搜索索引是可重建的派生数据，
> 不取代现有业务模型和数据真相源。

## 1. 背景

Groupher 当前搜索能力主要有两部分：

- `CMS.Search.Article` 直接对不同 Thread 的 Article 表执行标题模糊查询；
- `ArticleDocument` 保存 Article 的结构化正文、`plain_text`、`content_hash` 等
  派生内容。

当前实现存在以下限制：

- 只能搜索 Article 标题，不能统一搜索正文和 Comment；
- 搜索查询直接依赖数据库模型，难以切换 Algolia、Typesense 或自建搜索；
- Article 和 Comment 字段结构不同，缺少统一的搜索投影协议；
- `ArticleDocument` 是 Article 正文模型，不能自然承载 Comment；
- 缺少增量同步、删除同步、全量重建和一致性检查机制；
- 后续增加语义搜索时，没有 Chunk、Embedding 和引用来源等模型边界。

因此需要建立独立的 `CMS.SearchArtiments` 派生搜索层。

## 2. 目标

1. 使用统一协议表达可搜索的 Article 和 Comment。
2. 支持跨 Post、Doc、Changelog、Blog 和 Comment 的全文搜索。
3. 搜索平台可以从 Algolia 切换到其他商业服务或 Native Search。
4. Article、ArticleDocument 和 Comment 继续保持独立业务存储。
5. 支持可靠的全量索引、增量更新、删除、重试和一致性检查。
6. 让互动指标参与结果展示和受约束的排序加权。
7. 为后续语义搜索、混合检索和带引用的 AI Answer 保留清晰边界。
8. GraphQL 只暴露搜索 `ref` 和结构化业务 Locator，不暴露数据库 `id` 或平台
   内部字段。

## 3. 非目标

- 不把 Article 和 Comment 合并到一张业务表。
- 不把 Comment 写入 `ArticleDocument`。
- 第一阶段不建立保存完整正文的本地 `search_artiments` 表。
- 不让 Algolia 或其他搜索平台成为内容数据真相源。
- 不在第一阶段实现 Embedding、语义检索或 AI Answer。
- 不把 Community 搜索混入 Artiment 搜索。
- 不让前端业务代码直接依赖某个搜索平台的数据结构。

## 4. 术语

| 名称             | 含义                                                         |
| ---------------- | ------------------------------------------------------------ |
| Artiment         | Groupher 中 Article 与 Comment 的统一称呼                    |
| Search Artiment  | 从 Article 或 Comment 投影得到的平台无关搜索记录             |
| Search Chunk     | 为语义检索从 Search Artiment 正文拆分出的文本片段            |
| Projection       | 从业务模型提取并标准化搜索数据的过程                         |
| Platform Adapter | Groupher 搜索层与具体搜索平台之间的统一契约                  |
| Indexer          | 执行 upsert、delete、backfill、retry 和 reconcile 的后台能力 |
| Retriever        | 统一关键字、语义和混合检索的查询入口                         |
| Answerer         | 基于检索结果生成带来源引用的 AI 回答                         |

## 5. 核心不变量

1. Article、ArticleDocument 和 Comment 是业务数据真相源。
2. 搜索平台中的记录是可删除、可重建的派生数据。
3. 一个 Article 投影为一个页面级 Search Artiment。
4. 一条 Comment 独立投影为一个 Search Artiment，不拼接进所属 Article 正文。
5. Comment 的 `thread` 仍然是所属 Article 的 Post、Doc、Changelog 或 Blog，
   不使用 Comment 作为 Thread。
6. `type` 区分 Article 和 Comment，`thread` 区分 Article 产品。
7. Public Article 才能进入公共索引；Draft 不进入公共索引。
8. 已删除、待审核或不可见 Comment 不得留在公共索引。
9. 搜索结果必须能定位到具体 Article 或 Comment。
10. 正文是否需要重建索引由 `contentHash` 判断，互动指标更新不触发重新分块。
11. 搜索平台凭据和管理操作只存在于服务端。
12. GraphQL 和前端不暴露内部数据库 ID。
13. Post、Blog、Changelog 和 Doc 都使用 `article_hash_id` 作为逻辑 Article
    身份；它不是 Docs 专属字段。
14. Search `ref` 只负责索引身份，不能替代现有 ArticlePath 或 CommentPath。
15. Reply 也是 `comments` 表中的独立 Comment 行；`embeds_many(:replies)` 只作
    展示缓存，不能作为搜索投影数据源。
16. 后端 Elixir `Artiment` struct 和 typespec 是 canonical contract；TypeScript
    类型只描述 GraphQL wire contract。

## 6. 总体架构

```text
Article + ArticleDocument ─┐
                           ├─ Projection ─> Artiment
Comment ───────────────────┘                     │
                                                v
                                            Indexer
                                                │
                                                v
                                       PlatformAdapter
                                                │
                     ┌──────────────────────────┼───────────────────────┐
                     v                          v                       v
                  Algolia                    Upstash                 Native
```

业务模型保持独立：

```text
Article
├─ Post
├─ Doc
├─ Changelog
└─ Blog

ArticleDocument
└─ Article 的结构化正文和 plain_text

Comment
└─ 评论正文、回复关系、审核状态和互动数据
```

后端 `Artiment` 是平台无关的 canonical contract，`TSearchArtiment` 是对应的
GraphQL wire type。两者都不代表必须创建同名数据库表。

## 7. 模块边界

```text
CMS.SearchArtiments
├─ Artiment
├─ Chunk
├─ Projection
├─ Indexer
├─ PlatformAdapter
├─ Platforms
│  ├─ Algolia
│  ├─ Upstash
│  └─ Native
├─ Ranking
├─ Retriever
└─ Answerer
```

- `Artiment`：统一搜索协议、校验和字段规范；
- `Chunk`：AI 和语义搜索使用的文本分块协议；
- `Projection`：把 Article、ArticleDocument 和 Comment 转成 Artiment；
- `Indexer`：负责增量更新、删除、全量重建和失败重试；
- `PlatformAdapter`：所有搜索平台必须实现的统一契约；
- `Platforms.*`：具体平台实现；
- `Ranking`：定义 Groupher 自己控制的排序信号；
- `Retriever`：统一关键字、语义和混合检索；
- `Answerer`：根据检索结果生成带引用的 AI 回答。

命名统一使用 `PlatformAdapter` 和 `Platforms`，不使用
`Provider` / `Providers`。

## 8. Search Artiment 协议

### 8.1 Canonical contract

实际实现以 Elixir 后端定义为准：

```text
CMS.SearchArtiments.Artiment
├─ struct
├─ @type
├─ validation
└─ serialization
```

下方 TypeScript 只用于清晰表达 GraphQL wire contract，不是后端实现语言。

### 8.2 Ref 与 Locator

所有 Article Thread 当前都拥有 `article_hash_id`：

```text
Post       ─┐
Blog        ├─ article_version_fields() ─> article_hash_id
Changelog   │
Doc        ─┘
```

Search `ref` 使用确定性规则生成，并映射为 Algolia `objectID`：

```text
Article:
  ARTICLE:{thread}:{article_hash_id}

Comment:
  COMMENT:{thread}:{article_hash_id}:{comment_inner_id}
```

`thread` 必须参与 Search Ref，明确 Article 产品命名空间。Community slug 可能
修改，不放入稳定 Ref；Community 继续作为独立过滤字段和 Locator 字段。

`ref` 不能被前端解析为业务路由。搜索结果必须同时返回结构化 Locator：

```ts
type TArticleLocator = {
  community: string
  thread: TArticleThread
  innerId: string
}

type TCommentLocator = {
  article: TArticleLocator
  innerId: string
  rootInnerId?: string
}
```

### 8.3 Artiment 类型

```ts
type TSearchArtimentType = 'ARTICLE' | 'COMMENT'

type TBaseSearchArtiment = {
  ref: string
  type: TSearchArtimentType

  communityRef: string
  thread: TArticleThread
  articleRef: string

  digest?: string
  authorRef?: string
  locale?: string

  upvotesCount: number
  publishedAt?: string
  insertedAt: string
  updatedAt: string

  contentHash: string
  schemaVersion: number
}

type TArticleSearchArtiment = TBaseSearchArtiment & {
  type: 'ARTICLE'
  title: string
  locator: TArticleLocator
  commentsCount: number
}

type TCommentSearchArtiment = TBaseSearchArtiment & {
  type: 'COMMENT'
  title?: never
  locator: TCommentLocator
  repliesCount: number
}

type TSearchArtiment = TArticleSearchArtiment | TCommentSearchArtiment
```

字段约定：

- `type` 区分 Article 和 Comment；
- `thread` 是 Post、Doc、Changelog 或 Blog；
- Article 的 `articleRef` 等于自身 `ref`；
- Comment 的 `articleRef` 指向所属 Article 的 Search Ref；
- `locator` 负责业务读取和前端跳转，`ref` 只负责搜索索引身份；
- `plainText` 是 canonical Artiment 进入搜索平台的标准纯文本，但不通过 GraphQL
  结果返回；列表展示使用 `digest` 和 `highlights`；
- `contentHash` 用于识别正文变化，避免无效索引；
- `commentsCount` 只属于 Article，`repliesCount` 只属于 Comment；
- 互动指标既可用于结果展示，也可作为受约束的排序信号。

Article 和 Comment 使用 discriminated union，避免一个 Comment 结果同时携带
`commentsCount` 与 `repliesCount`。

### 8.4 Search Query 与 Result

Platform Adapter 不接受 Algolia 原生查询结构，而是使用 Groupher 自己的协议：

```ts
type TSearchQuery = {
  text: string
  scope: {
    communityRef?: string
    articleRef?: string
  }
  filters?: {
    types?: TSearchArtimentType[]
    threads?: TArticleThread[]
    authorRefs?: string[]
    locales?: string[]
  }
  sort?: 'RELEVANCE'
  page: number
  size: number
  highlight?: boolean
}

type TSearchHighlight = {
  field: 'TITLE' | 'PLAIN_TEXT'
  fragments: string[]
}

type TSearchHit = {
  artiment: TSearchArtiment
  highlights: TSearchHighlight[]
}

type TSearchResult = {
  entries: TSearchHit[]
  totalPages: number
  totalCount: number
  pageSize: number
  pageNumber: number
}
```

Algolia 的 `_highlightResult`、`nbHits` 和内部 score 必须在
`Platforms.Algolia` 中转换，不能直接穿透 GraphQL。

## 9. Projection

### 9.1 Article Projection

Article 搜索记录由两个数据源共同组成：

```text
Article
├─ title
├─ thread
├─ community
├─ author
├─ lifecycle / visibility
├─ engagement counters
└─ ArticlePath locator

ArticleDocument
├─ plain_text
├─ digest
├─ content_hash
└─ schema_version
```

只有可公开访问的 Public Article 进入公共搜索索引。Draft 和已进入 Trash 的
Article 不得进入公共索引。

### 9.2 Comment Projection

Comment 搜索记录来自：

```text
Comment
├─ body / body_html
├─ thread
├─ parent Article
├─ author
├─ upvotes_count
├─ replies_count
├─ delete / fold / archive / moderation state
└─ inner_id
```

Comment 索引规则：

- 已删除 Comment 从索引删除；
- Pending、审核不可见或无权访问的 Comment 不进入公共索引；
- 归档内容是否保留由搜索产品范围决定；
- 折叠内容可以保留，但默认降权；
- Projection 从 `comments` 表真实行读取，不能遍历 `embeds_many(:replies)`；
- Reply 与顶层 Comment 使用同一套独立投影规则；
- `repliesCount` 读取 Comment 行上的计数器，不使用 embedded replies 长度；
- Reply Locator 额外携带 `rootInnerId`，用于打开 Root Comment 后定位具体 Reply；
- 结果通过结构化 Comment Locator 跳转到具体评论。

每条 Comment 都是独立记录，以支持精确命中、单独删除、独立排序、评论定位
和 AI 来源引用。

Comment 的 `body` 是编辑器 JSON，`body_html` 是派生结果。`plainText` 必须复用
现有 `ContentPipeline.parse(%{body: comment.body})` 的 `payload.plain_text`，不能
通过简单 strip HTML 生成，以免丢失换行、Mention、列表和编辑器节点语义。

接入具体平台前需要统计 Comment 正文字节长度的 P50、P95 和 P99。超出平台
单记录限制时，由 Platform Adapter 按 UTF-8 字节安全截断并标记
`plainTextTruncated`；
不能改变 canonical Artiment 的完整正文语义。

## 10. 索引设计

第一阶段只创建一个逻辑索引：

```text
groupher_artiments_v1
```

需要支持以下过滤维度：

```text
type
thread
communityRef
articleRef
authorRef
locale
```

典型查询：

```text
全部内容：
  communityRef = xxx

只搜文章：
  communityRef = xxx AND type = ARTICLE

只搜评论：
  communityRef = xxx AND type = COMMENT

只搜文档：
  communityRef = xxx AND thread = DOC

某篇文章内搜索：
  articleRef = xxx
```

跨 Thread 搜索本质上是不增加 `thread` 过滤。跨 Community 搜索必须由产品
入口和访问权限共同决定。

## 11. 容量与成本评估

在 Algolia 技术接入前先完成一次 Phase 0 容量评估。至少收集：

```text
articleCount
commentsCount
searchableCommentRatio
averageArticleRecordBytes
averageCommentRecordBytes
commentRecordBytesP95 / P99
monthlyCommentCreates
monthlyCommentUpdates
monthlyMetricUpdates
monthlySearchRequests
```

成本模型至少包含：

```text
indexedRecords = articleCount + searchableCommentCount

monthlyIndexOperations =
  creates + contentUpdates + deletes + metricPartialUpdates

monthlySearchRequests =
  submittedQueries * queriedIndices
```

批量 upsert 只能减少网络请求，不能减少按 Record 计算的 indexing operation。
Search-as-you-type 必须设置最小查询长度和 debounce，避免每次按键产生无效请求。

Phase 0 需要输出：

- 当前数据量和未来 12 个月的低、中、高三档预测；
- Build 环境能否容纳完整 Article 与 Comment 投影；
- Grow 环境的月度 Records、Search Requests 和 Index Operations 预算；
- 是否需要只索引可见或高质量 Comment；
- 达到何种阈值时切换到其他商业平台或 `Platforms.Native`。

## 12. 同步机制

搜索同步不能只依赖定时全量上报，而应由以下四层机制组成。

### 12.1 初始全量同步

```text
读取可搜索 Article 和 Comment
  -> Projection
  -> batch upsert
  -> 搜索平台
```

全量同步也用于新索引版本的初始化和灾难恢复。

### 12.2 事件驱动增量同步

```text
Article publish / update / unpublish / trash
Comment create / update / delete / moderate
                         │
                         v
                    Search Event
                         │
                         v
                       Indexer
                         │
                         v
                     Projection
                         │
                         v
                 PlatformAdapter
```

Phase 1 起索引操作就通过现有 Rihanna 持久后台任务执行，不使用 `Task.async`，
也不在用户请求事务中直接同步调用外部搜索平台。

所有任务必须满足：

- 使用确定性 `ref` 实现幂等 upsert 和 delete；
- 对平台暂时性错误进行有限重试；
- 记录 enqueue failure、retry count、last error 和 indexing lag；
- 任务失败不能回滚已经成功的内容发布、评论或互动事务；
- enqueue 丢失最终由 reconcile 修复。

`SearchArtiments.Queues.Rihanna` 在 enqueue 失败时记录 Logger/Telemetry，但始终向
业务调用方返回 `{:ok, :pass}`，避免搜索基础设施回滚内容事务。这意味着数据库
commit 与 job enqueue 之间仍存在一致性窗口，最终由 reconcile 修复；Phase 3 使用
Transactional Outbox 关闭该窗口。

平台契约在后端定义为 Elixir behaviour，至少包含：

```elixir
@callback upsert([Artiment.t()], keyword()) :: :ok | {:error, term()}
@callback delete([String.t()]) :: :ok | {:error, term()}
@callback update_metrics([{String.t(), map()}]) :: :ok | {:error, term()}
@callback search(Query.t()) :: {:ok, Result.t()} | {:error, term()}
```

`CMS.SearchArtiments.Query` 和 `CMS.SearchArtiments.Result` 分别对应前文的
`TSearchQuery` 和 `TSearchResult` wire type。

业务层只认识搜索 `ref`；具体平台实现负责将其映射为 Algolia `objectID` 等
平台内部标识。

### 12.3 指标批量同步

`upvotesCount`、`commentsCount` 和 `repliesCount` 变化频率更高，不需要每次变化都
重新提交完整正文。Phase 1 已为 Article 点赞与评论计数接入 Algolia partial
update；数据量扩大后再增加短时间窗口聚合。

- 可以按短时间窗口聚合更新；
- 优先使用平台的 partial update；
- 正文未变化时不重新分块或生成 Embedding；
- 指标同步失败不应阻断用户点赞或评论事务。

### 12.4 定期一致性检查

```text
业务数据 contentHash
        <->
搜索平台 contentHash
```

默认执行频率：

```text
Rihanna failed job retry:
  按任务 retry policy 执行

Recent-window reconcile:
  每小时检查最近 2 小时发生变化的数据

Full inventory/hash reconcile:
  每天低峰期执行一次

Manual rebuild:
  index version 切换、平台迁移或事故恢复时执行
```

定期任务检查缺失、过期和多余记录并自动修复。数据规模扩大后，完整检查需要
按 Community 或时间窗口分片。定时同步是兜底机制，不是主要同步方式。

## 13. 本地存储边界

第一阶段不建立保存完整正文的 `search_artiments` 表。

如需记录同步状态，可以增加轻量状态或 Outbox：

```text
SearchIndexState
├─ ref
├─ type
├─ platform
├─ contentHash
├─ status
├─ indexedAt
├─ retryCount
└─ lastError
```

该模型只负责同步状态、重试和可观测性，不再次保存完整搜索正文。因此即使
Comment 数量很大，也不会在 Groupher 数据库中复制一份所有可搜索内容。

未来实现 `Platforms.Native` 时，再决定是否建立 Postgres FTS 专用投影表。

## 14. 排序策略

排序以文本相关性为主，权威性、互动和时效为辅：

```text
finalScore =
  textRelevance
  * typeWeight
  * contentAuthorityWeight
  * boundedEngagementBoost
  * recencyBoost
```

建议规则：

- `typeWeight` 只区分 Article 和 Comment；
- `contentAuthorityWeight` 区分正式内容、Article 作者/采纳回答和普通用户内容；
- Doc、Changelog 等正式内容可以拥有更高 `contentAuthorityWeight`；
- Comment 默认轻微降权，避免大量评论淹没正式内容；
- Article 的 `upvotesCount`、`commentsCount` 可以提升权重；
- Comment 的 `upvotesCount`、`repliesCount` 可以提升权重；
- 互动指标使用 `log(1 + count)` 等方式压缩，不能覆盖文本相关性；
- `isSolution`、`isPinned`、`isArticleAuthor` 后续可以成为额外质量信号。

## 15. AI 搜索扩展

`TSearchArtiment` 负责页面级结果，AI 和语义检索使用独立 Chunk：

```ts
type TArtimentChunk = {
  ref: string
  artimentRef: string
  type: TSearchArtimentType

  communityRef: string
  thread: TArticleThread
  articleRef: string

  index: number
  plainText: string
  heading?: string

  locator: TArticleLocator | TCommentLocator
  contentHash: string
}
```

- Article 按标题、段落或 Token 长度拆成多个 Chunk；
- 短 Comment 通常只有一个 Chunk；
- 长 Comment 可以拆分，但仍归属于同一个 `artimentRef`；
- 语义检索命中 Chunk 后，按 `artimentRef` 聚合和去重；
- Answerer 使用 Chunk 生成回答，并引用 Article 或具体 Comment；
- 正式内容与用户内容使用不同的权威权重和来源标签。

未来检索模式：

```text
KEYWORD
  -> TSearchArtiment

SEMANTIC
  -> TArtimentChunk

HYBRID
  -> Keyword + Semantic + Rerank
```

因此第一阶段接入 Algolia 不会封死 AI 搜索。后续可以给 `Retriever` 增加语义
平台，或者同时组合多个平台。

## 16. API 边界

```text
Frontend
   │
   v
GraphQL SearchArtiments
   │
   v
CMS.SearchArtiments
   │
   v
PlatformAdapter
   │
   v
Algolia / Upstash / Native
```

前端通过 Groupher API 使用搜索，不直接依赖 Algolia 的业务结构：

- 切换平台不需要重写前端；
- 服务端统一执行权限和可见性过滤；
- 排序参数和平台字段不成为公共 API；
- AI 和混合检索可以继续复用同一入口；
- 搜索结果只暴露搜索 `ref` 和结构化 Locator，不暴露数据库 `id`。

本次 GraphQL API 采用一次性切换，不保留 deprecated Query、兼容 wrapper、
双读、双写或运行时 fallback：

```text
ADD
  searchArtiments

REMOVE
  searchPosts
  searchDocs
  searchBlogs
  searchChangelogs
```

仓库内调用与 schema 在同一个变更中完成迁移。

## 17. 与现有模块的关系

- 保留 `ArticleDocument`，继续作为 Article 正文派生模型；
- `Projection.Article` 使用 Article 和 ArticleDocument 生成搜索数据；
- Comment 不写入 ArticleDocument；
- 新增 `CMS.SearchArtiments` 后直接删除 `CMS.Search.Article` 和
  `CMS.Search.article/2`；
- 删除生成 `searchPosts`、`searchDocs`、`searchBlogs`、`searchChangelogs` 的
  `article_search_queries`；
- `CMS.Search.Community` 不属于 Artiment 搜索，应迁移到 Community 自己的搜索
  边界，本次 Search Artiments 切换不改变 `searchCommunities`；
- 不保留旧标题模糊搜索作为降级路径。

## 18. 分阶段实施

### Phase 0：容量与成本评估

- 统计 Article、Comment 数量、增长速度和可搜索比例；
- 统计投影记录大小及 Comment 正文 P50、P95、P99；
- 估算 Records、Index Operations 和 Search Requests；
- 给出 Build 可行性、Grow 月度预算和平台切换阈值；
- 确认 Comment 全量索引还是质量过滤策略。

### Phase 1：协议与 Algolia 跑通

- 建立 `CMS.SearchArtiments` 模块边界；
- 定义 Elixir canonical `Artiment`、GraphQL wire types、`Projection`、
  `TSearchQuery`、`TSearchResult` 和 `PlatformAdapter`；
- 实现 `Platforms.Algolia`；
- 先完成 Article 的全量和增量索引；
- 使用 Rihanna 执行持久、幂等、可重试的后台索引任务；
- 新增 `searchArtiments` 并一次删除旧 Thread Search Query；
- 验证正文搜索、过滤、高亮、删除和索引重建。

当前实现已经完成上述 Article 范围，包括：

- Elixir canonical `Artiment`、`Query`、`Result` 和 `PlatformAdapter`；
- Algolia 批量 upsert/delete、全文查询、过滤、高亮和索引 settings；
- Public Article + `ArticleDocument` Projection；
- Rihanna 增量任务，以及 publish、moderation、trash、restore、永久删除钩子；
- Article 全量 keyset reindex；
- GraphQL `searchArtiments` 一次切换并删除旧 Thread Search Query；
- Phase 0 数据量与 Comment 正文字节分位数统计命令；
- 可注入的 Search Queue：生产使用 Rihanna，测试使用可检查、可 drain 的 Fake Queue；
- Algolia 写任务校验 `objectIDs/taskID`；增量 Rihanna job 在任务被平台接受后结束，
  configure/reindex 运维路径才等待 task published，避免占用共享 worker；
- GraphQL Phase 1 只暴露实际支持的 `RELEVANCE`，搜索结果不返回完整正文；
- Article 点赞数和评论数使用 partial update 增量同步。

部署前配置：

```text
ALGOLIA_APPLICATION_ID
ALGOLIA_SEARCH_API_KEY
ALGOLIA_ADMIN_API_KEY
ALGOLIA_INDEX_NAME
```

运维命令：

```bash
# 统计 Article、ArticleDocument、Comment 数量和正文体积
mix search_artiments.capacity

# 初始化 Algolia settings，并重建全部 Public Article 索引
mix search_artiments.reindex --configure

# settings 已存在时，只重建 Article 索引
mix search_artiments.reindex
```

这些命令当前只重建 Article；Comment 要等 Phase 2 Projection 和生命周期同步完成后
才会进入同一逻辑索引。

### Phase 2：Comment 搜索

- 增加 Comment Projection；
- 增加 Comment 增量同步和删除同步；
- 将 Reply 作为独立 Comment 行投影，不读取 embedded replies；
- 使用 ContentPipeline 生成 Comment `plainText`；
- 支持 `type`、`thread` 和 `articleRef` 过滤；
- 支持 Locator 跳转到具体 Comment 和 Reply；
- 调整 Article 与 Comment 的混合排序。

### Phase 3：一致性窗口与可观测性

- 增加 Transactional Outbox，关闭 DB commit 与 Rihanna enqueue 之间的窗口；
- 增加 `SearchIndexState` 和同步状态查询；
- 增加 `contentHash` 一致性检查；
- 增加全量重建和索引版本切换；
- 补充索引延迟、失败量和重试量监控。

### Phase 4：AI 搜索

- 增加 Chunk Projection；
- 接入语义搜索平台；
- 实现 Hybrid Retriever；
- 增加 Answerer 和来源引用；
- 为正式内容和用户内容设计不同权威权重。

## 19. 已确认决策

1. 模块名使用 `CMS.SearchArtiments`。
2. 统一协议名使用 `TSearchArtiment`。
3. Article 和 Comment 进入同一个逻辑索引，通过 `type` 区分。
4. 不创建保存完整正文的本地 `search_artiments` 表。
5. 第一阶段使用 Algolia，只实现关键字搜索。
6. 前端通过 Groupher API 搜索，不直接绑定 Algolia SDK。
7. AI Chunk 独立建模，不放入 `TSearchArtiment`。
8. `CMS.Search.Community` 与 Artiment 搜索拆开。
9. 实施顺序为先 Article、后 Comment，但从一开始使用同一份协议。
10. 所有 Article Thread 都使用 `article_hash_id` 作为逻辑身份。
11. Search Ref 使用 `ARTICLE:{thread}:{article_hash_id}` 和
    `COMMENT:{thread}:{article_hash_id}:{comment_inner_id}`。
12. Search Ref 不承担业务定位；GraphQL 同时返回结构化 Locator。
13. GraphQL 新旧 Search Query 一次切换，不保留兼容逻辑。
14. Phase 1 使用 Rihanna 持久后台任务，Phase 3 再引入 Transactional Outbox。
15. Reply 作为独立 Comment 行投影，embedded replies 不参与 Projection。
