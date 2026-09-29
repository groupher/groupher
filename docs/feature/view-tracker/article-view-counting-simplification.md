# Article View 计数简化方案

> 状态：代码与本地合同已按 direct cutover 落地；Cloudflare 独立待办未实施
>
> 日期：2026-09-26
>
> 当前运行时协议：[Article View 计数写链路](./article-view-counting.md)
>
> 后续边缘防滥用：[Article View Cloudflare 防滥用待办](./cloudflare-abuse-protection-todo.md)
>
> 当前写后同步：
> [ArticleStats 与 private state 写后同步](../../architecture/article-stats-and-viewer-state-sync.md)

本文记录 Article View 计数链路已经落地的简化 cutover。改造继续保留同步计数、actor/article 时间窗口去重和
ArticleStats 字段级 ownership，但删除 View 专属 transport receipt、客户端 `eventId`、误导性的 watermark
术语以及前端各 surface 重复的状态组装。

本文不是兼容迁移设计。实现按一次 hard cut 同步修改数据库、GraphQL、前端和测试，不双写、不双读，也不保留旧
字段或 wrapper。

## 1. 结论

目标链路只保留四类长期状态：

```text
ArticleStats
ViewDedupeState
ViewerState
MetricEvent
```

一次请求的目标流程：

```text
Article 达到有效阅读条件
        |
        v
trackArticleView(article)
        |
        v
RequestActor.classify
        |
        v
Policy.allowed?
  ├─ false -> tracked=false
  └─ true
        |
        v
ViewCounter.increment_if_needed
  ├─ duplicate
  |    -> views 不变
  |    -> tracked=true
  |
  └─ counted
       -> ArticleStats.views +1
       -> authenticated ViewerState
       -> MetricEvent
       -> tracked=true
        |
        v
返回 ArticleStats + ViewerState
        |
        v
applyViewResult
        |
        v
Detail / Posts / Changelogs / Kanban 使用同一状态
```

公开 API 只回答本次阅读是否被 ViewTracker 接受：

```text
counted             -> tracked=true
duplicate in window -> tracked=true
excluded by policy  -> tracked=false
```

`counted`、`duplicate_in_window` 和 `excluded_by_policy` 继续作为后端内部 telemetry/debug 信息，不再要求前端恢复
第一次执行的精确 decision。

## 2. 保留与删除

### 2.1 保留

- 浏览器正文连续可见达到共享阈值后才触发 tracking；
- RequestActor 统一分类 human、agent、crawler 和 unknown；
- human 与 agent 使用各自的 actor/article 去重窗口；
- 一次 counted view 在同步事务内更新 ArticleStats、ViewerState 和 MetricEvent；
- GraphQL 返回提交后的完整 ArticleStats 与 ViewerState；
- Analysis 可以异步聚合 counted MetricEvent，但不拥有公开 views 当前值；
- 单次 view 不 purge HTML/CDN，也不通过本地 `views + 1` 猜测服务端结果。

### 2.2 删除

- 后端 `ViewCountReceipt`；
- View tracking 的客户端 `eventId`；
- receipt claim/finalize/replay 和 identity mismatch；
- receipt pending/finalized 状态；
- View receipt TTL 及对应清理；
- `ViewWatermark`、`claim_watermark` 和 watermark retention 术语；
- GraphQL 公开的 `counted`、`decisionReason` 和 `eventId`；
- 前端各 surface 手工拼 Article key、stats Map、viewer overlay 和 view receipt overlay；
- 公开的 `useArticleStateIndex` 或其他要求调用方理解内部 Map 的抽象。

### 2.3 不重新引入

- `ViewEvent -> Oban projector -> ViewSummary`；
- per-view Oban job；
- 当前 views 的事件重放或历史重算；
- 同步/异步双写；
- 旧字段 fallback 或兼容读取；
- 通用 rule engine、通用 counter framework 或 sharded counter 预实现。

## 3. Policy 与同步计数

### 3.1 Policy

Policy 只判断 actor 和 read purpose 是否允许进入业务去重：

```elixir
Policy.allowed?(identity, read_purpose)
# true | false
```

Policy 不提前返回 `counted`，也不包装 `policy_outcome: :counting_admitted` 一类重复 key/value。规则版本由内部
`Policy.version/0` 提供，只在 counted MetricEvent 中记录。

### 3.2 ViewCounter

去重判断和 ArticleStats 增量通过一个能够直接说明业务效果的 API 暴露：

```elixir
ViewCounter.increment_if_needed(article, identity, received_at)
# {:counted, stats} | {:duplicate, stats}
```

`ViewCounter` 内部负责：

1. 读取或建立 actor/article 的 `ViewDedupeState`；
2. 原子判断当前请求是否仍在去重窗口内；
3. 只有窗口已经结束时推进 `last_counted_at` 并增加 `ArticleStats.views`；
4. 返回提交链路继续使用的 ArticleStats。

调用方不接触 UPSERT、锁、watermark 或 `claim` 术语。

### 3.3 同步事务

目标事务：

```text
Policy.allowed? == true
  -> transaction
       ViewCounter.increment_if_needed
         ├─ duplicate
         |    -> 读取当前 ArticleStats / ViewerState
         |
         └─ counted
              -> ArticleStats.views +1
              -> authenticated human ViewerState
              -> counted MetricEvent
       -> 返回完整结果
```

`ViewDedupeState`、ArticleStats、ViewerState 或 MetricEvent 任一写入失败时，counted 分支整体回滚。

## 4. 为什么 View 不再使用后端 Receipt

当前 `ViewCountReceipt` 保证相同 `eventId` 在 TTL 内重放第一次的精确结果。但 View 的产品调用方只需要：

```text
请求已经被 ViewTracker 接受
+ 最新 ArticleStats
+ 最新 ViewerState
```

它不需要区分第一次执行是 `counted=true`，还是丢失响应后的 retry 被判为 duplicate。

```text
第一次请求
  -> counted，views +1
  -> 响应在网络中丢失

客户端立即 retry
  -> 同 actor/article 仍在去重窗口内
  -> duplicate，views 不变
  -> 返回当前 ArticleStats
```

这已经满足 View 的业务幂等。正常客户端的最大 retry 生命周期必须小于最短 actor 去重窗口。恶意调用方即使拥有
`eventId` 也可以不断创建新 ID，因此洪泛保护属于 actor 去重与 Edge rate limit，而不属于 View receipt。

Receipt 边界保持为：

```text
Backend
├─ CommandReceipt             保留：CMS 命令的 ambiguous-commit 恢复
├─ WallpaperPublishReceipt    保留：Wallpaper 发布与外部资产恢复
└─ ViewCountReceipt           删除

Frontend
├─ Article interaction receipt  保留
├─ Comment feed receipt         保留
├─ Comment reaction receipt     保留
└─ ViewAck                      保留，不再叫 receipt
```

本次改造不得扩大为 CommandReceipt 或 WallpaperPublishReceipt 重构。

## 5. ViewDedupeState

### 5.1 命名

```text
ViewWatermark      -> ViewDedupeState
claim_watermark    -> 删除，由 ViewCounter.increment_if_needed 内部处理
watermark cleanup  -> ViewDedupeCleanup
```

这里不是流处理 watermark。状态只表示一个 actor 对一篇 Article 最近一次真正增加 views 的时间。

### 5.2 数据模型

目标表：

```text
article_view_dedupe_states
├─ thread
├─ article_id
├─ viewer_tracking_key
├─ last_counted_at
├─ expires_at
├─ inserted_at
└─ updated_at

UNIQUE(thread, article_id, viewer_tracking_key)
```

`last_counted_at` 服务业务去重；`expires_at` 只服务清理。`expires_at` 应由以下值计算：

```text
last_counted_at
+ 当前 actor dedupe window
+ cleanup safety margin
```

不继续使用缺少业务依据的固定 30 天保留期。当前 safety margin 为 24 小时，结合 hourly Cleanup、50,000 rows/run 和
25 秒 time budget 使用；它只吸收调度延迟和数据库 churn，不能改变有效阅读窗口。

## 6. Cleanup

命名：

```text
ViewDedupeCleanup
Jobs.ViewDedupeCleanup
ViewDedupeCleanup.cleanup_expired/0
```

Cleanup 必须处理完当前预算内的多批数据，不能每天只删除一批后退出：

```text
cleanup_expired
  -> delete one batch ordered by expires_at
  -> still has expired rows?
       yes -> next batch
       no  -> done
  -> stop safely when time budget or row budget is reached
```

并发更新安全要求：删除时重新检查 `expires_at`，不能删除已经被新的 counted view 推进的状态。

观测至少包含：

```text
deleted rows
batch count
duration
budget exhausted
remaining expired rows
```

## 7. GraphQL 与前端 tracking

### 7.1 GraphQL

目标 mutation：

```graphql
trackArticleView(article: ArticlePathInput!) {
  tracked
  articleStats {
    # 完整 ArticleStats
  }
  viewerState {
    # 当前 Article viewer state
  }
}
```

删除 input/output 中的 `eventId`、`counted` 和 `decisionReason`。MetricEvent 的 operation ID 仅在真正 counted 时由
服务端生成。

### 7.2 前端调用

```typescript
const result = await trackArticleView(article)
applyViewResult(queryClient, result)
```

`applyViewResult` 负责：

- 将 `articleStats` 写入 canonical ArticleStats entity；
- 将 `viewerState` 写入当前 viewer cache；
- `tracked=true` 时写入本地 ViewAck；
- `tracked=false` 时不制造已阅读状态。

### 7.3 ViewAck

前端 sessionStorage 状态不是 transport idempotency receipt，统一改称 ViewAck：

```text
viewReceipt.ts            -> viewAck.ts
TArticleViewReceipt       -> TArticleViewAck
readArticleViewReceipt    -> readArticleViewAck
writeArticleViewReceipt   -> writeArticleViewAck
clearArticleViewReceipt   -> clearArticleViewAck
```

ViewAck 只用于匿名/缓存尚未收敛时的页面状态确认；服务端 ViewerState 已经确认后应清除。它不是 views 总数权威，也不
参与后端去重。

## 8. 统一 Article 状态组装

> 当前实现按
> [ArticleStats 与 private state 写后同步](../../architecture/article-stats-and-viewer-state-sync.md) 使用真实 Detail/Batch query，
> view、interaction 和 comment mutation 返回并应用完整公共 ArticleStats 与各 owner private state，不建立 entity 中转层。

### 8.1 公共 API

前端调用方只使用：

```typescript
useArticleState(article)
useArticleStates(articles)
```

Detail：

```typescript
const article = useArticleState(articleQuery.data)
```

List：

```typescript
const entries = useArticleStates(query.data?.entries ?? [])
```

如果确实需要导出返回类型，使用能够直接表达结构的名称：

```typescript
type TArticleState<T> = {
  article: T
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}
```

单篇 Article 使用 `viewerState`；批量 query/map 才使用 `viewerStates`。如果类型只在 hook 内部使用，让 TypeScript
推导，不额外导出名称。

### 8.2 内部职责

`useArticleStates` 内部统一完成：

```text
Articles
  -> 提取内部 Article ref/key
  -> 按 community/thread batch ArticleStats
  -> 订阅 canonical ArticleStats entity
  -> batch ViewerState
  -> ViewAck overlay
  -> Article interaction receipt overlay
  -> 返回顺序与输入一致的 ArticleState[]
```

状态优先级：

```text
canonical entity
  > batch query snapshot
```

Article content 不再携带 stats 兼容快照；entity 与 batch 都缺失时返回 `stats: null`，由查询层按正常失败/刷新语义处理。

以下实现细节不得暴露给调用方：

- `articlePathKey`；
- stats/viewer Map；
- batch 与 entity 的覆盖顺序；
- receipt/ViewAck storage key；
- `useArticleStateIndex` 一类中间 API。

### 8.3 接入范围

统一替换以下位置的重复组装：

- `ArticleQueryProvider`；
- `usePagedPosts`；
- `usePagedChangelogs`；
- `useKanbanPosts`。

分页、URL filter、列表刷新和 Kanban 分组继续由宿主 hook 负责，不进入 `useArticleStates`。

## 9. RequestActor 可信证据边界

这部分已经作为公共边界落地，不只存在于 ViewTracker 内部。登录态、匿名会话、service 和 delegation 的原始凭证由请求入口
验证；入口把已经验证的完整业务对象交给 RequestActor。RequestActor 内部再收敛为唯一 typed evidence，并在一次请求中只分类一次。
ViewTracker 和其他需要 human/agent 判断的模块只复用 `RequestActor.Classification`，不各自解析 token、header 或 ID。

Crawler 的可信 Edge verifier 仍未接入，因此当前没有 verified crawler 的生产输入；只有 User-Agent 时按 self-reported unknown
处理。这一剩余项与 Cloudflare 待办一起实施。

公共边界以 [`request-actor.md`](../../architecture/request-actor.md) 为准。本节只规定 ViewTracker 如何接入，不另建一套公开
`ActorEvidence` API。

### 9.1 切换前问题（已解决）

当前链路在 Context 中完成了部分验证，但进入 RequestActor 前又被压平成可自由拼装的 keyword/裸值：

```text
cookie / JWT / delegation / edge headers
                    |
                    v
             Request Context
          验证部分外部凭证
                    |
                    v
         Resolver 重新拼 keyword
  user / anonymous_id / agent_credential_id /
        delegation_id / crawler_family(*)
                    |
                    v
           RequestActor.classify
       按字段是否存在决定 actor 类型
                    |
                    v
           ViewTracker identity/policy
```

`(*) crawler_family` 当前没有生产者；它只是 RequestActor 已预留、但尚未由可信 Edge crawler verifier 接入的输入。当前已经存在的
信任信息压平问题主要发生在 account、anonymous、service 和 delegation 路径。

主要问题不是当前调用方一定会伪造这些值，而是信任来源在类型和 API 上丢失了：

- `agent_credential_id` 或 `crawler_family` 只是字符串，RequestActor 无法证明它们经过 verifier；
- precedence 和冲突处理藏在分类函数中，多种证据同时出现时语义不直观；
- 新调用方可以绕开验证层，靠传入某个字段获得 `verified` 分类；
- 其他模块如果也需要 human/agent/crawler 判断，只能复制这套拼装和优先级。

### 9.2 当前落地链路

公开 API 使用完整业务名称；typed evidence 是 RequestActor 内部实现，不通过给每个类型加 `Verified` 前缀表达，也不暴露给
resolver 或领域消费者：

```text
request authentication / context
  ├─ verified account session
  ├─ signed anonymous session
  ├─ verified service credential + audience/scope
  ├─ verified delegation + user + audience/scope
  └─ verified crawler result（未来 Edge 接入）
                         |
                         v
RequestActor.classify(
  account_session: account_session,
  anonymous_session: anonymous_session,
  service_credential: service_credential,
  delegation: delegation,
  crawler: crawler
)
                         |
                         v
RequestActor 内部 Evidence.select
  -> exactly one AccountSession | AnonymousSession | ServiceCredential |
                 Delegation | Crawler | Unknown
  -> 冲突的可信输入返回错误
                         |
                         v
RequestActor.Classification（每个 request 一份）
          |                         |                         |
          v                         v                         v
   ViewTracker                authorization             analytics/其他模块
  identity/policy               等消费者                  只读分类结果
```

内部 `Evidence` 是封闭 union，而不是一个所有字段都 optional 的大 struct：

```text
Evidence =
  AccountSession
  | AnonymousSession
  | ServiceCredential
  | Delegation
  | Crawler
  | Unknown
```

每个 request 最多选择一个 evidence。无效凭证在认证层拒绝；多个互斥的已验证输入由 RequestActor 返回冲突错误；只有确实
没有可信输入时才产生 `Unknown`。不能把无效 service token 静默降级成匿名请求，也不能让 RequestActor 通过裸 ID 的字段
优先级猜测。

### 9.3 分类合同

```text
Evidence.AccountSession      -> human   / verified / authenticated   / account_session
Evidence.AnonymousSession    -> human   / probable / unauthenticated / signed_anonymous_session
Evidence.ServiceCredential   -> agent   / verified / unauthenticated / agent_credential
Evidence.Delegation          -> agent   / verified / authenticated   / delegation_credential
Evidence.Crawler             -> crawler / verified / unauthenticated / verified_crawler
Evidence.Unknown             -> unknown / unknown  / unauthenticated / fallback
User-Agent self report       -> unknown / probable / unauthenticated / self_reported
```

`probable human` 只表示匿名会话签名有效且身份稳定，不表示已经证明是真人。ViewTracker Policy 可以允许它参与计数，但速率限制
和异常流量防护仍应在 Edge/入口层完成。

### 9.4 各层职责

```text
Request authentication / context
  - 读取和验证 cookie、JWT、delegation、scope、edge signature
  - 产出完整的已验证业务对象，不产出裸 credential id

RequestActor
  - classify(account_session:, anonymous_session:, service_credential:, delegation:, crawler:)
  - 内部选择唯一 typed Evidence 并解决冲突
  - 不解析原始 token/header
  - 不根据裸 ID 是否存在推导 verified
  - 将 Classification 放入 request context，供消费者复用

ViewTracker.Identity
  - 从已验证身份 handle 派生稳定 dedupe key
  - 读取 Classification 的 actor 维度
  - 不再判断 human/agent/crawler

ViewTracker.Policy
  - 根据 Classification 决定是否计数以及使用 human/agent 哪个窗口
  - 不再验证凭证或猜测可信度
```

该边界是共享基础能力，但不要把 ViewTracker 的窗口、计数或 dedupe 规则塞进 RequestActor。RequestActor 只回答“请求主体是谁、
可信程度是什么”，各业务模块继续拥有自己的 policy。

### 9.5 安全约束与 Cloudflare 边界

- `trackArticleView` 对 browser/anonymous 仍是公开 mutation，不能直接挂现有“必须存在 service”的 `ServiceScope`；需要增加
  conditional scope check：请求含 service/delegation 时强制校验专用 audience/scope，没有 service 时继续走 browser/anonymous；
- 专用 service 合同应一次性确定并加入允许列表，例如 `aud=phoenix:view-api`、`scope=view:track`；scope 缺失、audience 不符或
  service 验证失败时必须拒绝整次 mutation，不能降级成匿名；
- Delegation 必须同时验证 service、user 绑定关系和 scope，不能只凭 `delegation_id`；
- Crawler 不能相信公网请求直接携带的 `crawler_family` 或类似 header；只有 Edge 签名证据可以产生
  `Evidence.Crawler`；
- Origin 必须拒绝绕过 Edge 的直连，否则攻击者可以伪造或跳过 Edge 结论；
- 匿名会话签名只用于稳定身份和防篡改，不能替代 bot detection；
- evidence 中的原始 token、签名和外部凭证不得写入 MetricEvent 或业务表。

Cloudflare 的 crawler evidence、Edge rate limit 与 origin 收口仍按独立 TODO 实施。在它落地前，无法验证的 crawler 一律按
`Unknown` fail closed，不能靠 User-Agent 猜成 `verified crawler`。

## 10. 测试合同

### 10.1 Backend

- 同 actor/article 的并发请求最多增加一次；
- 第一次提交成功但响应丢失后立即 retry 不重复增加；
- 窗口内 duplicate 返回 `tracked=true` 和当前状态；
- Policy excluded 返回 `tracked=false`；
- 窗口结束后可以再次增加；
- human/agent 使用各自配置窗口；
- counted 分支任一写入失败时 dedupe、stats、viewer 和 metric 全部回滚；
- Cleanup 不删除仍在有效窗口或并发中已推进的状态；
- 过期数据超过单批大小后继续处理下一批；
- Cleanup 达到预算时安全退出并可由下一次运行继续；
- service agent 缺少 View scope 时 fail closed；
- signed anonymous session 只能分类为 `human/probable`，不能升级为 `verified`；
- 裸 `agent_credential_id`、`delegation_id` 或 `crawler_family` 不能构造 verified actor；
- 多种互斥的可信输入同时出现时 RequestActor 返回冲突错误，不能变成 `Unknown`；
- 伪造的公网 crawler header 被忽略；
- User-Agent-only 输出 `unknown/probable/self_reported`，无可信输入输出 `unknown/unknown/fallback`；
- RequestActor 每个 request 只分类一次，ViewTracker 等消费者复用同一个 `Classification`。

### 10.2 Frontend

- tracking 不再生成或发送 `eventId`；
- counted/duplicate 的成功结果都写 ViewAck；
- `tracked=false` 不写 ViewAck；
- Detail、Posts、Changelogs、Kanban 使用同一组装语义；
- mutation 更新 canonical stats 后所有 surface 收敛；
- 匿名 ViewAck 在同一 tab 的页面切换/刷新中有效；
- ViewerState 追上后清除 ViewAck；
- Article interaction、Comment feed 和 Comment reaction receipts 不受影响。

### 10.3 Contract 与容量

- GraphQL schema/generated types 不再包含 View `eventId`、`counted` 或 `decisionReason`；
- ViewCountReceipt schema/table/config/job 的 runtime 引用完全删除；仅历史设计记录与执行 drop 的 migration 可以保留旧名；
- 旧 ViewWatermark runtime 名称完全删除；仅历史设计记录与执行 drop 的 migration 可以保留旧名；
- Cleanup 用超过一个 batch 的数据证明吞吐闭环；
- 保留并扩展 Postgres 并发测试，而不是只依赖单线程单测。

## 11. 实施切片

本次按以下顺序实施并分别验证：

1. [x] 后端删除 ViewCountReceipt，建立 `ViewDedupeState`、`ViewCounter.increment_if_needed` 和新 Cleanup；
2. [x] 同一切片 hard-cut GraphQL，删除 `eventId/counting detail`，增加 `tracked`；
3. [x] 前端切换到 `trackArticleView(article)`、`applyViewResult` 和 ViewAck；
4. [x] 建立 `useArticleState/useArticleStates`，接入 Detail、Posts、Changelogs 和 Kanban；
5. [x] 收敛 RequestActor 内部 evidence 与 agent scope：删除 resolver 裸 ID 拼装，增加 service/delegation conditional scope check，
       并把唯一 `Classification` 写入 request context；
6. [ ] 按独立 TODO 完成 Cloudflare 限流、crawler evidence 和 origin 收口。

每个切片都必须保留当前同步计数语义，不允许为了分阶段发布增加长期兼容层。若 GraphQL hard cut 无法在同一部署中完成，
应调整发布编排，而不是在运行时代码中保留两套协议。

## 12. 完成定义

- 后端只依赖 ViewDedupeState 完成 View 业务幂等；
- ViewCountReceipt、客户端 eventId 和对应 Cleanup 全部删除；
- 没有 watermark/claim/retention 等误导性 View 命名；
- `ViewCounter.increment_if_needed` 是同步计数的唯一内部入口；
- GraphQL 只公开 `tracked + ArticleStats + ViewerState`；
- Detail、Posts、Changelogs 和 Kanban 只通过 `useArticleState/useArticleStates` 组装状态；
- ViewAck 与 Command/Interaction receipts 的职责清晰且互不复用；
- RequestActor 公共 API 只接收完整、已验证的业务对象；typed Evidence 只存在于其内部，不再接收裸 ID keyword bag；
- human/agent/crawler 分类在请求入口完成一次，ViewTracker 不再重复判断；
- Cleanup 在持续高于单批大小的过期数据下仍能收敛；
- 并发、重试、窗口、回滚和四种前端 surface 均有关键测试；
- Cloudflare 防滥用仍作为独立部署工作，不被错误包装成 ViewTracker 业务逻辑。
