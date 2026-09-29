# Article Insights V1：业务指标趋势

> 状态：V1 主体已实现；生产调度、权限和第三方统计边界仍需按本文完成部署验收。
>
> 本文独立于 [ViewTracker V1](../view-tracker/v1.md)。ViewTracker 只负责有效阅读；本文负责把 View、
> Upvote、Collect、Comment 等共同建模为可查询的时间趋势。

## 1. 产品目标

作者和管理员可以查看一篇 Article 最近 48 小时的小时趋势：

```text
hour                 views  upvotesAdded  collectsAdded  commentsCreated
2026-09-15 08:00Z       31             4              1                2
2026-09-15 09:00Z       46             7              3                1
```

View 额外支持 `actor_type` 和 `is_authenticated` 筛选。`actor_type` 区分 human、agent、crawler 和
unknown；登录状态使用独立 boolean，不编码进类型。是否把筛选公开给作者是产品展示决定；后台数据
模型必须保留这两个维度。

## 2. 领域边界

```text
业务 owner transaction
├─ ViewTracker       counted view
├─ Interactions      upvote / collect / emotion add/remove
└─ Comments          comment create/delete
          |
          v
    Analysis.MetricEvent        append-only 指标事实
          |
          v
    Analysis.Aggregator         异步小时聚合
          |
          v
    Analysis.ArticleInsights    权限、查询和产品 DTO
```

- 业务领域决定事件是否发生，并在自己的事务内追加 MetricEvent；
- Analysis 不回写或修复业务事实；
- ViewTracker 不聚合其他 Interaction；
- Activity 保存可解释的业务历史，不承载高频 pageview 或报表计算；
- 当前 Article totals 继续从各业务 owner 的当前投影读取，不能用历史趋势之和替代。
- MetricEvent 是业务 mutation 的事务内必写项；append 失败时整个 mutation 回滚，不能 commit 后
  best-effort 发送。未来若要解除可用性耦合，应设计业务 owner 的 transactional outbox。

## 3. 为什么需要 append-only 指标事件

当前 upvote/collect 等 fact 在撤销时可能被删除或改变，只能回答“现在有多少”，不能回答“某小时发生过
多少次增加和撤销”。趋势需要保存动作：

```text
MetricEvent
  id
  operation_id            # producer 幂等键
  community_id
  article_type            # post / blog / changelog / doc
  article_id
  metric                  # article_view / upvote_added / ...
  value                   # 每次动作固定为 1
  actor_type              # NOT NULL；非 View 使用 all
  is_authenticated        # NOT NULL；非 View 使用 false
  policy_version          # NOT NULL；无策略版本使用 0
  occurred_at             # UTC
  aggregated_at?
  attempts / last_error
```

首版指标：

```text
article_view
upvote_added / upvote_removed
collect_added / collect_removed
emotion_added / emotion_removed
comment_created / comment_deleted
```

同一业务 operation 对同一 metric 只能写一次：

```text
UNIQUE(operation_id, metric)
```

`operation_id` 由 producer 明确定义，不能用 `(actor, target)` 代替一次业务操作：

| producer    | 仅何时 append    | operation_id 来源            |
| ----------- | ---------------- | ---------------------------- |
| ViewTracker | `counted = true` | counted `ViewEvent.event_id` |

View 指标由独立 `trackArticleView` 请求产生的 counted ViewEvent 进入指标流；Article 内容 query、SSR
`loadPost`、预取与 hover 都不是 producer。
| Upvote | fact `changed` | command receipt ID |
| Emotion | fact `changed` | command receipt ID |
| Comment create/delete | command 首次生效 | comment command ID |
| Collect | fact `changed` | 在同一事务内生成的新 UUID |

Collect 的 unchanged 重试不产生事件；collect → undo → collect 是三次独立 changed operation，必须使用
三个不同 ID。ViewEvent 与 MetricEvent 是为统一指标管道而有意保存的两种记录：前者是 ViewTracker 的
判定与投影事实，后者是 Analysis 的聚合输入；只有 counted ViewEvent 才产生 MetricEvent。

Interaction 的 Upvote/Emotion producer 首版只对 Article append 指标；Comment reaction 明确不进入
Article Insights。Comment 自身只通过 comment create/delete 影响所属 Article 的趋势，避免把 Comment id
误写进 `article_id`。

## 4. 小时聚合

```text
ArticleHourlyMetric
  community_id
  article_type
  article_id
  bucket_started_at       # UTC hour
  metric
  actor_type              # NOT NULL；非 View 为 all
  is_authenticated        # NOT NULL；非 View 为 false
  policy_version          # NOT NULL；无版本为 0
  value
  updated_at

UNIQUE(article_type, article_id, bucket_started_at, metric, actor_type, is_authenticated, policy_version)
```

不使用可空维度参与唯一键，也不依赖 PostgreSQL 的 NULL uniqueness 语义。真实 actor type 由平台级
[`GroupherServer.RequestActor.Const`](../../architecture/request-actor.md) 定义；请求入口通过
`RequestActor.classify/1` 生成唯一 `RequestActor.Classification`，ViewTracker、Interaction、Comment 和 Analysis
producer 只消费该结果，不重复分类。`all` 不是访问者类型，只由
`Analysis.Const.actor_dimension` 在真实词表之外额外定义，并且只用于不按访问者分类的非 View 指标。
`policy_version = 0` 是无版本指标的显式哨兵值。

Aggregator 分批锁定 pending events，在一个事务中完成：

```text
SELECT ... FOR UPDATE SKIP LOCKED
  -> group by dimensions
  -> INSERT ... ON CONFLICT DO UPDATE value = value + event.value
  -> mark the same events aggregated_at
  -> commit
```

因此并发 worker 可以横向扩展；事务回滚不会留下“聚合已加、事件未完成”的半状态。每批大小使用
`aggregation_batch_size` 配置；一次 Job 最多执行 `aggregation_max_batches`。最后一批仍满载时
worker 返回 `{:snooze, aggregation_snooze_seconds}` 复用当前 Job，而不是从 executing Job 自我 enqueue。
如果一批聚合抛错，事务会同时回滚小时聚合和 `aggregated_at`，并在事务外为本批 pending event 增加
`attempts`、记录 `last_error`；Job 返回错误交给 Oban 的 retry 策略处理。每次 drain 后发出
`[:groupher, :analysis, :article_insights, :metrics]` telemetry，包含 pending、failed 和最老 pending
年龄，供 backlog 告警使用。
当前 `unique: [period: 30, keys: []]` 会把自我 enqueue 视为重复并丢弃，不能一边保留该 unique 配置一边依赖
新 Job 继续 drain。若未来改为自我 enqueue，必须同步调整 unique states/period 并用集成测试证明后继 Job
不会被 executing Job 阻挡。首版只有一个消费者，
不需要额外 receipt 表；出现多个独立 consumer 时再引入 consumer receipt/outbox offset。

迟到事件按其 `occurred_at` 回写原小时桶。所有时间均为 UTC；GraphQL 可按 viewer timezone 仅做展示转换。

原始 MetricEvent 默认保留 90 天，小时聚合默认保留 13 个月；更长期历史在后续版本增加 daily rollup，
不通过永久保留高频 raw event 实现。

Analysis 使用以下明确配置名，不保留 Maintenance 内的散落硬编码：

```text
metric_event_retention_days: 90
hourly_metric_retention_months: 13
aggregation_batch_size: 100
aggregation_max_batches: 10
aggregation_snooze_seconds: 5
```

保留窗口的关系是：ViewEvent 默认保留 30 天，只服务 ViewTracker 判定与投影诊断；ViewTracker dedupe
state 也默认保留 30 天，并按 `last_counted_at` 独立清理；MetricEvent 保留 90 天，是 Analysis 重建来源，
因此小时聚合只能在这 90 天内从 raw metric 重建；超过 90 天后只保留 ArticleHourlyMetric 聚合，不能再
声称可由原始事实重算。

### 4.1 Added、Removed 与 Net

动作方向由 metric 名表达，event value 始终为正数 1，禁止同时用 removed metric 和负 delta 双重表达：

```text
upvotesAdded    = SUM(upvote_added)
upvotesRemoved  = SUM(upvote_removed)
upvotesNet      = upvotesAdded - upvotesRemoved
```

首版作者图表默认展示 views、upvotesAdded、collectsAdded、commentsCreated。管理面可以额外展示 Removed
和 Net；某小时撤销了窗口外的旧点赞时 `upvotesNet` 可以为负数，但不能显示为“新增点赞 -N”。

## 5. 查询合同

建议公共入口：

```text
Analysis.ArticleInsights.trend(article, viewer,
  from: DateTime,
  to: DateTime,
  interval: :hour,
  metrics: [...],
  actor_types: [...],
  is_authenticated: boolean
)
```

规则：

- GraphQL `article_insights` 不得复用只支持 public lifecycle 的 `M.FrontDesk, :article`。必须使用专用
  `:article_insights` loader，或由 resolver 直接通过 `:read_insights` scope 解析 path 并加载 canonical
  Article；否则 suspended/archived Community 会在进入 Insights 授权前被 public loader 拒绝；

- 使用 `Gate.scope(Article, actor, :read_insights, ArticleContext.insights(thread, opts))` 在一次 SQL 中限定全部
  可读 Article，再加载 canonical Article；`:read_insights` 和 `:insights_management` 是本版本新增合同，
  不能假设现有 `owner_management` 已经包含 Article author，也不能由 resolver 在 author 与 moderator
  mode 之间二选一；
- 默认窗口最近 48 小时，首版只提供 hour interval；
- 返回连续时间桶，缺失桶补零；
- actor/auth filter 只作用于支持该维度的 metric，首版至少是 `article_view`；
- 默认将同一小时、metric、actor type、认证状态下的不同 `policy_version` 求和后返回；`policy_version` 是诊断和
  口径追踪维度，不得让普通图表产生重复时间桶；
- DTO 同时返回 `policyVersions` 与 `hasMixedPolicy`。管理面可按版本过滤，普通作者界面在窗口内存在
  多个版本时显示口径变化提示；
- 查询从 `article_hourly_metrics` 读取，禁止在线扫描 raw events；
- 默认查询最近 48 小时，单次查询最多 720 个小时桶；超过上限 fail closed，禁止生成无界响应或扫描；
- API 返回固定 Groupher DTO，不暴露表结构。

actor/auth filter 不能误删使用 `actor_type = all`、`is_authenticated = false` 哨兵的非 View 指标。组合谓词
等价于：

```sql
WHERE metric != 'article_view'
   OR (
        metric = 'article_view'
        AND actor_type IN (...)
        AND is_authenticated = ...
      )
```

只有调用方实际传入的过滤条件才加入 View 分支；未传 `actor_types` 或 `is_authenticated` 时省略对应
条件。Upvote、Collect、Emotion 和 Comment 指标不受 View 访问者筛选影响。

ViewTracker 使用配置化滑动窗口判断一次访问是否 counted；Insights 使用固定 UTC 小时桶展示已 counted
事件。二者不得混淆：滑动窗口决定“算不算”，固定时间桶决定“显示在哪一小时”。跨过整点不会绕过
ViewTracker 的去重规则。

`ArticleContext.insights(thread, opts)` 固定构造（`opts` 只由服务端注入 Passport grant slug）：

```text
thread:       目标 Article thread
stage:        :public
policy_mode:  :insights_management
```

Insights 不查询 draft；尚未发布的草稿没有公开阅读数据。现有 public stage 包含符合 Lifecycle 规则的
published/archived Article。

完整 actor matrix：

| actor           | Scope 条件                                               | API 边界                         |
| --------------- | -------------------------------------------------------- | -------------------------------- |
| Article author  | `article.author_id == actor.id`                          | 已登录                           |
| Community owner | Community owner chain 命中                               | 已登录                           |
| operations      | operations policy 命中                                   | operations authority             |
| moderator       | 同一 Community moderator，且持有 `article.insights.read` | Passport grant 参与 scope policy |
| 普通用户        | 不进入结果集                                             | 拒绝                             |

同一 actor 可以在 Community A 是 moderator、同时是 Community B 的 Article author。`:insights_management`
必须在一个 scope 内对以下条件求并集，不能选择“优先视角”或发两次查询后在应用层拼接：

```text
article.author_id == actor.id
OR community.user_id == actor.id
OR actor has operations authority
OR (
  actor is moderator of article.community_id
  AND actor has Passport action article.insights.read for that community
)
```

Passport 仍由服务端认证和 API 边界建立可信授权事实，但不能简化成无作用域的
`has_analytics_passport: true`。API 边界从归一化后的 `actor.cur_passport` 提取持有
`article.insights.read` 的 Community slug 集合，并写入 typed context：

```text
ArticleContext.insights(thread,
  passport_granted_community_slugs: [...]
)
```

该字段默认是空列表，只能由受信 API/domain boundary 构造，不进入 GraphQL input；写入前去重并校验
slug。Gate scope 同时验证 moderator membership，并编译
`community.slug IN ^passport_granted_community_slugs`。当前 Passport 是内存中的 slug-keyed map，没有可供
SQL join 的 grants 表，因此 V1 不使用 correlated `EXISTS`；只有未来建立持久化 grant 关系后才能另行设计。

Gate 实施范围必须包括：

1. `Gate.Scope.Article` 的 action 列表增加 `:read_insights`；
2. `Gate.Const.gate_action` 注册 `read_insights: :read_insights`；
3. `Gate.Const.passport_action` 注册
   `article_insights_read: "article.insights.read"`，不与 Moderation review 权限共用；
4. `Helper.PermissionConfig.cms_grants/0` 增加 `"article.insights.read"`，使 Passport 写入校验和
   `PermissionRegistry.all_rules(:cms)` / Dashboard 授权目录可以识别它；
5. `Helper.PermissionConfig.action_requirements/0` 注册
   `"article.insights.read" => %{scope: :context, context: :cms, grant: "article.insights.read"}`，不复用
   `community.update`；
6. `Gate.Context.Scope.Article` 增加 `:insights_management` mode、grant slug 集合字段与 `insights/2`
   constructor，强制 `stage: :public`；
7. 新 scope policy 在一次查询中合并 article author、Community owner、operations 和带 Community-scoped
   Passport 的 moderator，不改变旧 `owner_management` / `moderator_management` 语义；
8. `CommunityChain.apply_community_lifecycle/2` 增加 `:insights_management` 分支，复用
   `:owner_management` 的 management-readable Community lifecycle 状态集合；因此 suspended/archived
   Community 中，author/owner 仍可读取其有权 Article 的 Insights，moderator 仍需 membership 与
   `article.insights.read`，普通用户不可读；
9. 增加 grant 的 `valid_permission?`、`all_rules(:cms)`、Community 隔离和 root/god 测试；
10. 覆盖 active/suspended/archived Community，确保 `:insights_management` 不落入
    `unknown_policy_mode`；
11. 增加每类 actor allow/deny、跨 Community 隔离、作者仅可读自己 Article、moderator 有无 Passport，
    以及同一 actor 跨 Community 同时作为 author + moderator 时返回权限并集的 scope/API 测试。

## 6. 与 Umami 的取舍

两套统计并存且互不冒充：

| Groupher Article Insights                      | Umami Web Analysis                           |
| ---------------------------------------------- | -------------------------------------------- |
| 有效阅读、互动与业务趋势                       | pageview、visitor、session、来源、设备、地域 |
| ViewTracker 的配置化滑动去重与 actor/auth 分类 | Umami 自己的访客和会话口径                   |
| Article 是明确业务实体                         | URL/path 是主要分析对象                      |
| 原始指标与聚合由 Groupher 保存                 | 原始数据与聚合保存在 Umami                   |

作者需要设备、外链或地理信息时，展示 Umami 对应区块，并明确它与“有效阅读”数字可能不同。不尝试
用 URL 维度强行 join 成逐个 viewer 的统一事实。

如用户需要更完整的访问归因、转化漏斗或自定义报表，可使用已经实现的
[第三方分析集成](../../umami/integration.md) 接入自有统计平台。

## 7. 实施顺序与验收

1. 建立 MetricEvent、小时聚合表与 Aggregator；
2. 接入 ViewTracker counted view；
3. 在 Interaction/Comment 的权威事务中追加事件；
4. 建立 `Analysis.ArticleInsights` 查询、Gate、专用 GraphQL loader 和 DTO，不能由 public FrontDesk 提前
   收窄 management-readable lifecycle；
5. 实现最近 48 小时图表与 actor/auth filter；
6. 增加 backlog、消费延迟、失败次数和最老 pending event 指标；retention 与 aggregation budget 使用
   `metric_event_retention_days`、`hourly_metric_retention_months`、`aggregation_batch_size`、
   `aggregation_max_batches` 和 `aggregation_snooze_seconds`，不保留散落硬编码。

必须测试 producer 幂等、MetricEvent 失败导致业务回滚、并发聚合、added/removed/net、迟到事件、
负 net、不可空唯一维度、策略版本合并、权限隔离、补零、UTC 小时边界、最大查询窗口和 actor/auth
filter。GraphQL 端到端必须覆盖 active/suspended/archived Community，证明专用 loader 不会先于
`:read_insights` scope 拒绝 author/owner/moderator/operations；聚合测试必须覆盖 bounded drain、满批后通过
`snooze` 在 60 秒内继续消费，以及 backlog 不持续失控；查询测试必须证明 actor/auth filter 不删除非 View
指标。可以保留只检测
不修复的采样一致性指标；不得建立扫描全库并覆盖聚合结果的永久 repair Job。
