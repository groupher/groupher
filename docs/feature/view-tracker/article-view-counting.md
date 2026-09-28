# Article View 计数写链路

> 状态：简化后的同步协议已落地。Cloudflare crawler evidence、Edge rate limit 与 origin 收口仍是独立部署待办。
>
> 日期：2026-09-26
>
> 直接切换设计与删改清单见
> [`article-view-counting-simplification.md`](./article-view-counting-simplification.md)。
>
> 当前前端写后同步见
> [`ArticleStats 与 private state 写后同步`](../../architecture/article-stats-and-viewer-state-sync.md)。真实 Detail/Batch query 与
> owner-wise patch 已取代 canonical entity/优先级实现。

本文是 Article `views` 当前运行时合同。实现不保留旧异步投影、View transport receipt、客户端幂等 ID、双写、双读或
兼容 wrapper。

## 1. 全流程

```text
Browser Article
  content ready + 前台 + wrapper 连续可见 >= humanMinVisibleMs
        |
        v
trackArticleView(article)
        |
        v
Phoenix Context（每个 request 一次）
  verify account / anonymous session / service / delegation
  -> RequestActor.classify(完整业务对象)
  -> request_actor: Classification
        |
        v
ConditionalServiceScope
  browser / anonymous -> 允许
  service / delegation -> aud=phoenix:view-api + scope=view:track
  verifier failure / 缺 scope -> 拒绝，不降级匿名
        |
        v
CMS.ViewTracker.track
  -> lock physical Article FOR KEY SHARE
  -> Gate public-read recheck
  -> Identity.resolve
  -> Policy.allowed?
       | false
       |   -> tracked=false + 当前 ArticleStats / ViewerState
       |
       ` true
          -> ViewCounter.increment_if_needed
               | duplicate in window
               |   -> views 不变
               |
               ` counted
                   -> ArticleStats.views + 1
                   -> authenticated-human ViewerState
                   -> Analysis.MetricEvent
          -> tracked=true + 提交后的 ArticleStats / ViewerState
        |
        v
applyViewResult
  -> 已存在的真实 Detail/Batch stats query
  -> current viewer cache
  -> tracked=true 时写 ViewAck
        |
        v
useArticleState / useArticleStates
  -> Detail / Posts / Changelogs / Kanban
```

一次 counted 分支的 dedupe、stats、ViewerState 和 MetricEvent 在同一数据库事务内提交。Analysis 后续聚合失败不改变
公开 `views`。

## 2. 公开合同

```graphql
trackArticleView(article: ArticlePathInput!): ArticleViewTrackResult!

type ArticleViewTrackResult {
  tracked: Boolean!
  articleStats: ArticleStats!
  viewerState: ViewerArticleState!
}
```

`tracked` 只表示 ViewTracker 是否接受该阅读：

```text
第一次有效计数       -> true
去重窗口内重复请求   -> true
policy 排除          -> false
```

第一次执行的 counted/duplicate 明细只进入后端 telemetry。客户端不发送幂等 ID，也不依赖第一次 decision 的精确重放。
响应丢失后的立即 retry 会落入同一 actor/article 去重窗口，因此不会重复增加 views。

## 3. Actor、身份与策略

| Actor            | 可信输入                              | 去重 identity               | 当前 policy |
| ---------------- | ------------------------------------- | --------------------------- | ----------- |
| 登录 human       | 已验证 account session                | account id 的 HMAC          | 计数        |
| 匿名 human       | first-party signed anonymous session  | session id 的 HMAC          | 计数        |
| service agent    | 已验证 credential + audience/scope    | token id 或 subject 的 HMAC | 计数        |
| delegated agent  | 已验证 service + user binding + scope | service/user 组合 HMAC      | 计数        |
| verified crawler | 可信 Edge crawler evidence            | crawler family 的 HMAC      | 不计数      |
| unknown          | 无可信证据或只有 User-Agent 自报      | 无                          | 不计数      |

RequestActor 只回答主体类型、认证状态、confidence 和来源。ViewTracker 单独拥有 read purpose、identity HMAC、去重窗口和
是否计数的 policy。

请求入口只把完整且已验证的业务对象交给 RequestActor。裸 `agent_credential_id`、`delegation_id`、`crawler_family`、
caller-supplied `actor_type/confidence/classified_by` 都不能产生 verified 分类。互斥可信证据同时出现时 fail closed。

## 4. 同步事务与并发

```text
transaction
  1. SELECT physical Article FOR KEY SHARE + Gate recheck
  2. conditional UPSERT ViewDedupeState
       INSERT 新 identity              -> counted
       conflict 且窗口已结束，UPDATE   -> counted
       conflict 且仍在窗口内，不更新   -> duplicate
  3. counted 时 UPSERT ArticleStats.views/views_revision
  4. counted authenticated human 时 INSERT ViewerState ON CONFLICT NOTHING
  5. counted 时 INSERT MetricEvent（服务端生成 operation id）
  6. 读取/返回完整提交状态
```

`UNIQUE(thread, article_id, viewer_tracking_key)` 与 conditional UPSERT 是并发 authority。同一 identity/article 的并发
请求最多一个推进 dedupe state，因而最多一个增加 views。物理 Article 的 key-share lock 与永久删除串行，删除提交后旧请求
不能重新创建孤儿 projection。

不使用 IP、IP + User-Agent 或浏览器 fingerprint 作为去重 identity。匿名 session 只表示稳定浏览器会话，不承诺自然人 UV。

## 5. 长期状态

```text
cms.article_stats
  views / views_revision       ViewTracker 拥有的公开当前值

cms.article_view_dedupe_states
  thread
  article_id
  viewer_tracking_key
  last_counted_at              业务去重 authority
  expires_at                   仅用于空间清理
  UNIQUE(thread, article_id, viewer_tracking_key)

cms.article_viewer_states
  authenticated human 的私有已读状态

analysis.metric_events
  counted view 的分析输入，不拥有公开 views
```

View 链路没有后端 Receipt。Command、支付、发布等需要 ambiguous-commit 精确恢复的业务仍可拥有自己的 receipt；两者不
共享协议。

## 6. Dedupe cleanup

`ViewDedupeCleanup.cleanup_expired/0` 按 `expires_at` 删除状态：

```text
expires_at = last_counted_at + actor dedupe window + cleanup safety margin

hourly Oban cron
  -> 按 expires_at 取一批
  -> DELETE 时再次检查 expires_at
  -> 继续下一批
  -> drained / row budget / time budget 时退出
```

当前默认值：

```text
cleanup safety margin = 24 hours
batch size            = 500
row budget            = 50,000 / run
time budget           = 25 seconds / run
schedule              = hourly
```

Safety margin 只吸收调度延迟和数据库 churn，不改变有效阅读窗口。删除前重新检查 `expires_at`，因此 batch selection 后被
新 counted view 推进的状态不会误删。Telemetry 输出 deleted rows、batch count、duration、budget exhausted 和 remaining
expired rows。

## 7. 前端状态收敛

> 当前实现已删除 batch -> entity seed 和 disabled entity observers；ViewTracker 后端计数、ViewAck 与
> `useArticleState/useArticleStates` 页面 API 保持不变。

Tracking 返回后统一调用 `applyViewResult`：

```text
ArticleStats -> 已存在的真实 Detail/Batch query
ViewerState  -> 当前 viewer batches
tracked=true -> same-tab ViewAck
```

ViewAck 不包含客户端 event ID，不参与后端去重，也不是 views 总数 authority。它只在匿名状态或 viewer cache 尚未追上时
覆盖 `viewerHasViewed=true`；服务端 ViewerState 确认后清除。

所有 Article surface 通过同一 API 组装状态：

```typescript
useArticleState(article)
useArticleStates(articles)
```

公共 hook 内部统一 Article ref/key、真实 detail/batch stats、viewer batches、ViewAck 和 interaction receipt
overlay。详情与列表仍各自拥有内容查询；分页、URL filter、刷新和 Kanban 分组不进入公共状态 hook。

## 8. 安全边界

- browser/anonymous 可以调用公开 mutation；service/delegation 必须通过 conditional audience/scope 检查；
- service verifier failure、错误 audience 或缺少 `view:track` 不能降级成匿名；
- delegation verifier failure 不能降级成 service-only agent；middleware 必须在 scope 成功分支前拒绝；
- signed anonymous session 防篡改但不证明真人；
- User-Agent-only automation 只得到 `unknown/probable/self_reported`，不会成为 verified crawler；
- 原始 token、签名、IP 和 tracking key 不写入 MetricEvent；
- Gate 在持锁后重新确认 Article 仍可公开读取；
- 单次 view 不触发 HTML/CDN purge，也不本地猜测 `views + 1`。

Cloudflare crawler evidence、Edge rate limit 与 origin 只允许经 Edge 访问仍未实施，见
[`cloudflare-abuse-protection-todo.md`](./cloudflare-abuse-protection-todo.md)。在此之前 crawler 没有可信生产入口，按 unknown
fail closed；这不影响 browser/account/service 的业务去重正确性，但尚未形成完整的流量滥用防线。

## 9. 删除与测试合同

> 前端测试验证真实 Detail/Batch query 的 owner-wise functional patch，不再验证 canonical entity 优先级。

永久删除 physical Article 时，同一事务按生命周期语义删除 Article 本体及其 ArticleStats、ViewDedupeState 和 ViewerState。
Doc 多 branch 共享逻辑 identity 时，canonical/physical 删除规则仍由 Article Trash 合同负责，ViewTracker 只按实际 physical
Article id 清理自己的状态。

关键覆盖包括：

- GraphQL hard-cut 合同与同步完整结果；
- 同 actor/article 的 retry 与并发最多增加一次；
- 窗口过期后再次计数，human/agent 使用不同窗口；
- unknown/crawler/policy-excluded 不写 dedupe 或 metric；
- signed anonymous session 稳定去重；
- service scope 的允许、拒绝和 verifier-failure 路径；
- Cleanup 多批 drain、预算退出/续跑及并发推进后的 delete recheck；
- permanent delete 后不留 View projection，旧请求不能复活；
- Detail、Posts、Changelogs、Kanban 统一组装，真实 Detail/Batch stats 按 owner revision 收敛，ViewAck 收敛；
- generated GraphQL 不再包含 View 客户端幂等字段或公开 decision 明细。

生产发布仍需观察 ViewTracker outcome、Cleanup backlog、数据库写延迟，并单独完成 Cloudflare 待办和真实流量压测。
