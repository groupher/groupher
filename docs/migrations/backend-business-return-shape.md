# Backend Business Return Shape 收敛

> 状态：completed（2026-10-08；R1–R5 已实施并完成门禁验收）
>
> 范围：统一后端业务层的成功返回协议，清理业务函数直接返回裸 `:ok` 以及调用方使用
> `:ok <- ...` 接收业务结果的混合形状。本迁移独立于 ArticleBinding 命名重构，不改变
> Article、ArticleBinding、数据库表或 GraphQL 字段的领域语义。

## 1. 背景

仓库当前同时存在两套成功返回协议：

```elixir
# 业务层目标协议
{:ok, value}
{:error, reason}

# 当前仍大量存在的裸协议
:ok
{:error, reason}
```

这会造成几个问题：

1. 调用方无法通过统一的 `with` 组合业务步骤；
2. `:ok` 只表达“成功”，不携带步骤产物，容易在外层重新包装结果；
3. 业务 helper、验证器、Outbox effect、统计更新和写入命令的职责边界不一致；
4. 同一个函数在不同分支可能返回 `:ok`、`{:ok, value}` 或 `{:ok, result}`；
5. callback、adapter 和业务函数的合法例外没有被明确区分。

典型问题形状：

```elixir
with :ok <- validate_thread(article, thread) do
  {:ok, article}
end
```

如果验证步骤的业务结果就是继续传递 Article，应直接让验证函数返回：

```elixir
def validate_thread(article, thread) do
  if article.thread == thread do
    {:ok, article}
  else
    {:error, :thread_mismatch}
  end
end
```

调用方：

```elixir
with {:ok, article} <- validate_thread(article, thread) do
  next_step(article)
end
```

## 2. 规则

### 2.1 业务函数

业务层、领域模块、内部业务 helper 和跨模块 adapter 统一使用：

```text
成功：{:ok, value}
失败：{:error, reason}
```

即使 helper 只执行一个校验，也返回带值的成功 tuple。若没有新的领域值，应明确返回继续
传递的输入值或业务 marker：

```elixir
{:ok, article}
{:ok, :pass}
```

不得新增：

```elixir
:ok
:ok <- business_step(...)
```

### 2.2 外部协议例外

只有协议、回调或框架明确要求时，才保留裸 `:ok`，并在模块或函数文档中说明原因：

```text
- Application.config_change/3
- GenServer / Telemetry callback
- Oban perform/1 等 job callback
- Ecto Sandbox checkout 等测试框架 API
- 第三方 adapter 明确要求返回 :ok 的边界
```

第三方 `:ok` 如果进入业务链路，应在 adapter 边界转换成 `{:ok, value}`，不要让裸值继续
传播到业务模块。

### 2.3 `with` 组合

不要为了满足 `with` 而先匹配裸 `:ok`，再在末尾重新包装：

```elixir
with :ok <- side_effect() do
  {:ok, result}
end
```

应将 `side_effect/0` 改为返回 `{:ok, result}` 或 `{:ok, :pass}`，由 `with` 直接继续组合。

## 3. 扫描基线

2026-10-08 对 `backend/api/lib/**/*.ex` 做只读词法扫描，结果如下：

```text
:ok <-                         275 处，86 个文件
裸返回 :ok                     408 处，124 个文件
两类候选的并集                 126 个文件
```

基线使用 Python `re` 对每个 `backend/api/lib/**/*.ex` 文件的源码做计数；下次增量扫描应保持
以下正则不变：

```python
bare_ok_pattern = r"(?m)^\s*:ok\s*$|\bdo:\s*:ok\b|->\s*:ok\s*$"
with_pattern = r":ok\s*<-"
```

其中 `bare_ok_pattern` 分别匹配独立返回行、`do: :ok` 单行函数和以 `-> :ok` 结束的分支；
`with_pattern` 匹配所有裸 `:ok <-` 接收形状。扫描范围是源码文件，不包含测试目录；计数按正则
命中次数和包含命中的文件数分别统计。

这些数字是迁移候选基线，不是最终违规数。扫描结果包含 callback、lib 内的测试支持 helper、
注释/文档示例和第三方协议边界；实施时必须逐函数确认返回合同。

门禁实现不能直接把上述词法命中全部视为违规。正式扫描必须先排除注释、字符串和 heredoc 中的
示例，再对函数体中的命中做协议例外匹配。扫描器测试应固定以下三类样本：

- 真实业务函数返回裸 `:ok`，必须报错；
- moduledoc、注释和字符串中的 `:ok`，不得报错；
- 已登记的框架 callback 返回 `:ok`，允许通过。

### 3.1 业务高风险区域

```text
Article / Publish / Draft
- cms/articles.ex
- cms/articles/draft/store.ex
- cms/articles/revision.ex
- cms/articles/moderation.ex
- cms/articles/trash.ex
- cms/articles/publish/target.ex
- cms/articles/publish/doc.ex
- cms/articles/publish/effects.ex
- cms/article_stats.ex

Comments / Interaction / ViewTracker
- cms/comments/writer.ex
- cms/comments/commands/delete_comment.ex
- cms/comments/query/reconcile.ex
- cms/interactions/reactions/collect.ex
- cms/interactions/reactions/emotion.ex
- cms/interactions/reactions/upvote.ex
- cms/interactions/reactions/report.ex
- cms/interactions/read_state/sync.ex
- cms/view_tracker/record.ex

Community / Assets / Docs
- cms/communities/tags.ex
- cms/communities/setup.ex
- cms/communities/writer.ex
- cms/assets/*.ex
- cms/doc_tree/*.ex
- cms/doc_tree/publish/*.ex
- cms/doc_tree/writer_impl/*.ex
- cms/doc_cover/*.ex

Effects / Infrastructure-facing business code
- cms/press/*.ex
- cms/outbox/workers/*/cleanup.ex
- public_cache/*.ex
- cms/gate/access/policy/*.ex
```

本节按代码 owner 分组，不等同于迁移批次。与 R1–R4 的对应关系如下：

```text
R1  Article / Publish / Draft、Stats、FrontDesk
R2  Comments、Interaction、ViewTracker
R3  Activity、Outbox、Press、PublicCache、Cloudflare adapter
R4  DocTree、Assets、Community、Content Import、Wallpaper、Gate policy
```

因此 `cms/wallpaper` 与 `cms/content_import` 虽然属于 effects/infrastructure-facing owner，
仍在 R4 处理；Activity 已显式纳入 R3 的异步事件范围。文件分组用于定位候选，实际迁移批次以
R1–R4 为准。

数量最多的单文件基线：

```text
cms/articles/draft/store.ex             38 处
cms/wallpaper/publisher.ex              20 处
cms/communities/tags.ex                 18 处
cms/article_stats.ex                    17 处
cms/gate/access/policy/article.ex      17 处
cms/doc_cover/writer.ex                 15 处
cms/interactions/reactions/upvote.ex   15 处
cms/articles.ex                         14 处
cms/doc_tree/trash.ex                   14 处
cms/outbox/workers/comment/cleanup.ex  14 处
```

### 3.2 当前工作区基线

本迁移规划时，工作区已有 ArticleBinding、ArticleView、Gate、Facade 和相关测试的未提交修改，且
其中一部分文件与 R1–R4 重叠。它们是现有工作区资产，不属于本迁移可以覆盖或重置的内容。

每个实施批次开始前必须：

1. 记录该批文件的 `git status --short` 和 `git diff -- <paths>`；
2. 区分已有改动与本批返回协议改动，只修改必要 hunk；
3. 不对整文件或整个后端目录做机械替换、全量格式化或回滚；
4. 验证时分别报告本批失败和已有工作区失败，不把二者混为一个结论；
5. 一个批次若与尚未稳定的领域重构修改同处一个函数，先完成或拆分该领域改动，再迁移该函数。

本迁移允许在脏工作区中推进，但每个提交或交付批次必须保持功能边界清楚，不得顺带吸收
ArticleBinding 命名、表迁移、Gate 语义或 Facade 重构。

## 4. 解决方案

### 4.1 执行原则

R1–R4 是业务迁移批次，R5 是全局门禁启用批次。正式修改 R1 业务代码前，先完成一次不计入业务
迁移的门禁准备步骤，再按 R1 → R2 → R3 → R4 → R5 顺序实施：

1. 创建 `scripts/check-business-return-shape.mjs`、对应测试和空的合法例外 manifest；
2. 扫描器先提供 `--report` 模式，输出违规和已登记例外，但发现违规时不以非零状态阻断；
3. R1–R4 每批结束都运行报告模式，并把当批确认的框架 callback 直接登记到 manifest；
4. R5 在业务违规清零后启用严格模式、增加 package script，并接入 `docs:check`。

这样 R1–R4 使用的是实际 manifest，而不是尚未实现的文档格式；报告期允许业务违规逐批下降，但
合法例外从第一次确认开始就进入最终登记来源。一个批次可以继续拆成下述子批次，但不得把后续
owner 的修改提前混入当前批次。

每个子批次只允许修改：

- 本节明确列出的生产文件；
- 因返回合同变化而必须同步调整的直接调用方；
- 对应 focused tests；
- 当前迁移文档中的进度和验证记录。

如果结构追踪发现未列出的调用方，先把文件及原因补入本节，再修改代码。返回协议迁移不得借机
改变错误 atom、GraphQL shape、Outbox payload、事务边界或 canonical resource 的选择。

### R1：Article 核心写入和读取链路

范围：Article facade、Draft、Revision、Publish、Moderation、Trash、ArticleStats、FrontDesk。

要求：

- 验证函数返回 `{:ok, input}` 或明确的 `{:ok, value}`；
- Publish / Draft / Revision 的事务 helper 不再返回裸 `:ok`；
- ArticleStats 的初始化、更新和 transaction result 使用统一 tuple；
- FrontDesk 的路径校验直接返回最终 Article 读取结果；该结果在本迁移开始时沿用当前 DTO 名称，
  若 ArticleBinding 命名重构已先行落地，则使用 `ArticleView`；`ArticleResult → ArticleView` 本身
  不属于本迁移的工作项；
- 不改变现有事务 rollback 语义。

R1 按以下三个可独立验收的子批次执行。

#### R1A：Article 入口、加载和关系校验

固定生产文件：

```text
backend/api/lib/groupher_server/cms/articles.ex
backend/api/lib/groupher_server/cms/articles/commands/create.ex
backend/api/lib/groupher_server/cms/articles/commands/update.ex
backend/api/lib/groupher_server/cms/articles/communities.ex
backend/api/lib/groupher_server/cms/articles/lifecycle.ex
backend/api/lib/groupher_server/cms/front_desk/article.ex
backend/api/lib/groupher_server/cms/front_desk/community.ex
```

重点验证：Article facade、FrontDesk 加载和关系校验的成功值继续传递 canonical Article、Community
或 relation；不得用 `{:ok, :pass}` 丢失后续步骤已经需要的领域值。

#### R1B：Draft 和 Revision

固定生产文件：

```text
backend/api/lib/groupher_server/cms/articles/draft/store.ex
backend/api/lib/groupher_server/cms/articles/revision.ex
backend/api/lib/groupher_server/cms/articles/revision/cleanup.ex
```

重点验证：事务 helper 保持 rollback 原因，revision cleanup 的 no-op 分支使用明确 marker，Draft
写入仍返回当前 canonical draft/article result。

#### R1C：Publish、Moderation、Trash 和 Stats

固定生产文件：

```text
backend/api/lib/groupher_server/cms/article_stats.ex
backend/api/lib/groupher_server/cms/articles/moderation.ex
backend/api/lib/groupher_server/cms/articles/publish/doc.ex
backend/api/lib/groupher_server/cms/articles/publish/effects.ex
backend/api/lib/groupher_server/cms/articles/publish/target.ex
backend/api/lib/groupher_server/cms/articles/trash.ex
```

重点验证：Publish effect 不吞掉下游错误，ArticleStats 初始化/更新保持原 transaction result，
Moderation 和 Trash 的错误类别、状态转换及公共结果不变。

R1 完成条件：上述固定文件及其因合同变化新增的直接调用方中，不再存在业务 `:ok <-` 或业务函数
裸 `:ok`；若命中框架 callback，必须登记到前置步骤已经创建的例外 manifest，不能仅在 review 中
口头说明。R1 已完成；R1 focused tests 通过，报告模式未再发现 R1 业务违规。

R2–R4 已按 R1 格式细化固定生产文件、直接调用方、focused tests、验收重点和完成条件；以下记录
同时作为本次实施的批次边界。每批完成条件包含：固定范围内业务违规清零、合法 callback 已进入
manifest、公共返回结果与事务语义不变。

### R2：Comments、Interaction、ViewTracker

范围：Comments writer/commands/query、Reactions、ReadState、ViewTracker。

要求：

- comment side effect、metric、notification 和 invalidate helper 使用 tagged tuple；
- `unchanged` 分支返回 `{:ok, :pass}` 或继续传递的领域值；
- viewer state 和 view receipt 不使用裸成功值；
- mutation result 仍返回当前 canonical result。

#### R2 固定文件与验收

固定生产文件：

```text
backend/api/lib/groupher_server/cms/comments/writer.ex
backend/api/lib/groupher_server/cms/comments/commands/delete_comment.ex
backend/api/lib/groupher_server/cms/comments/commands/update_comment.ex
backend/api/lib/groupher_server/cms/comments/query.ex
backend/api/lib/groupher_server/cms/comments/query/reconcile.ex
backend/api/lib/groupher_server/cms/interactions/reactions/collect.ex
backend/api/lib/groupher_server/cms/interactions/reactions/emotion.ex
backend/api/lib/groupher_server/cms/interactions/reactions/report.ex
backend/api/lib/groupher_server/cms/interactions/reactions/upvote.ex
backend/api/lib/groupher_server/cms/interactions/read_state.ex
backend/api/lib/groupher_server/cms/interactions/read_state/sync.ex
backend/api/lib/groupher_server/cms/interactions/scope.ex
backend/api/lib/groupher_server/cms/view_tracker/record.ex
backend/api/lib/groupher_server_web/resolvers/cms/comments.ex
backend/api/lib/groupher_server_web/resolvers/cms/interactions.ex
backend/api/lib/groupher_server_web/resolvers/cms/view_tracker.ex
```

必要直接调用方：`cms/article_stats.ex`、ViewTracker/ReadState 的 GraphQL resolver 和对应
`MetricEvent` 写入路径；只同步返回匹配，不改变 viewer receipt、幂等键或 mutation payload。

最低 focused tests：

```text
mix test test/groupher_server/cms/interactions/read_state_test.exs test/groupher_server/cms/interactions/view_events_test.exs
mix test test/groupher_server/cms/interactions/read_state_query_test.exs
```

验收重点：重复 view/read 仍保持幂等，interaction counters 和 viewer state 的成功 marker 不被
误当作业务 payload；非法 batch 仍返回原错误。R2 完成条件：固定文件和直接调用方无业务裸成功
形状，focused tests `33 passed`。

### R3：异步事件、Outbox、Press、Cache

范围：Outbox workers、Activity、Press、PublicCache、Cloudflare adapter。

要求：

- worker 业务步骤统一返回 `{:ok, value}`；
- Oban/Telemetry callback 可以保留框架要求的返回值；
- Cloudflare 等外部 adapter 在边界完成 `:ok -> {:ok, value}` 转换；
- Outbox handler 的最终结果保持明确的 `{:ok, status}`。

#### R3 固定文件与验收

固定生产文件：

```text
backend/api/lib/groupher_server/activity/artiment_event.ex
backend/api/lib/groupher_server/activity/community_log.ex
backend/api/lib/groupher_server/activity/event.ex
backend/api/lib/groupher_server/activity/filter.ex
backend/api/lib/groupher_server/analysis/article_insights.ex
backend/api/lib/groupher_server/analysis/metric_event.ex
backend/api/lib/groupher_server/analysis/web.ex
backend/api/lib/groupher_server/cms/outbox.ex
backend/api/lib/groupher_server/cms/outbox/workers/article/cleanup.ex
backend/api/lib/groupher_server/cms/outbox/workers/asset/cleanup.ex
backend/api/lib/groupher_server/cms/outbox/workers/comment/cleanup.ex
backend/api/lib/groupher_server/cms/outbox/workers/community/cleanup.ex
backend/api/lib/groupher_server/cms/outbox/workers/interaction/cleanup.ex
backend/api/lib/groupher_server/cms/press/invalidation.ex
backend/api/lib/groupher_server/cms/press/projection.ex
backend/api/lib/groupher_server/cms/press/query.ex
backend/api/lib/groupher_server/public_cache.ex
backend/api/lib/groupher_server/public_cache/cloudflare.ex
backend/api/lib/groupher_server/public_cache/purge_worker.ex
backend/api/lib/groupher_server/public_cache/telemetry.ex
backend/api/lib/groupher_server/jobs/article_insights_aggregation.ex
backend/api/lib/groupher_server/jobs/article_insights_retention.ex
backend/api/lib/groupher_server/jobs/command_receipt_retention.ex
backend/api/lib/groupher_server/jobs/view_dedupe_cleanup.ex
backend/api/lib/groupher_server_web/service_auth/verifier.ex
```

必要直接调用方：`backend/api/lib/groupher_server/jobs/*.ex` 中调用上述业务 facade 的 worker，
以及 PublicCache/Press 的外部 adapter；Oban/Telemetry 的框架边界不把 callback 返回值误包装成
业务 payload。

最低 focused tests：

```text
mix test test/groupher_server/activity_test.exs test/groupher_server/analysis/article_insights_test.exs test/groupher_server/cms/outbox_test.exs test/groupher_server/cms/press_test.exs test/groupher_server/public_cache_test.exs
```

验收重点：事件去重、Outbox cleanup、Press projection、Cloudflare purge 和 Article Insights
aggregation 保持原状态/重试语义。R3 完成条件：focused tests `50 passed`，且 worker 业务结果
与 Oban/Telemetry callback 边界已分离。

### R4：DocTree、Assets、Community、Import、Wallpaper

范围：DocTree publish/trash/writer、DocCover、Assets、Community setup/tags、Content Import、Wallpaper。

要求：

- 内部 validator、writer helper 和 state transition 统一 tagged tuple；
- 不改变数据库事务中 `Repo.rollback/1` 的行为；
- import、upload、cleanup 的 empty/no-op 分支返回明确 marker，例如 `{:ok, :pass}`；
- Gate policy 只在既有 Gate 协议明确要求时保留裸 `:ok`。

#### R4 固定文件与验收

固定生产文件：

```text
backend/api/lib/groupher_server/cms/assets/backfill.ex
backend/api/lib/groupher_server/cms/assets/commands/replace_use.ex
backend/api/lib/groupher_server/cms/assets/completeness.ex
backend/api/lib/groupher_server/cms/assets/deletion.ex
backend/api/lib/groupher_server/cms/assets/endpoints.ex
backend/api/lib/groupher_server/cms/assets/gc.ex
backend/api/lib/groupher_server/cms/assets/generated_batch.ex
backend/api/lib/groupher_server/cms/assets/replacement_plan.ex
backend/api/lib/groupher_server/cms/assets/upload.ex
backend/api/lib/groupher_server/cms/assets/writer.ex
backend/api/lib/groupher_server/cms/communities/count.ex
backend/api/lib/groupher_server/cms/communities/jobs/release_expired_slug_claims.ex
backend/api/lib/groupher_server/cms/communities/jobs/setup.ex
backend/api/lib/groupher_server/cms/communities/lifecycle.ex
backend/api/lib/groupher_server/cms/communities/setup.ex
backend/api/lib/groupher_server/cms/communities/tag_stats.ex
backend/api/lib/groupher_server/cms/communities/tags.ex
backend/api/lib/groupher_server/cms/communities/writer.ex
backend/api/lib/groupher_server/cms/content_import/import_source_mapping.ex
backend/api/lib/groupher_server/cms/content_import/jobs.ex
backend/api/lib/groupher_server/cms/content_import/staging.ex
backend/api/lib/groupher_server/cms/content_import/threads/doc/validator.ex
backend/api/lib/groupher_server/cms/content_import/threads/doc/writer.ex
backend/api/lib/groupher_server/cms/doc_cover/query.ex
backend/api/lib/groupher_server/cms/doc_cover/writer.ex
backend/api/lib/groupher_server/cms/doc_tree/publish.ex
backend/api/lib/groupher_server/cms/doc_tree/publish/checklist.ex
backend/api/lib/groupher_server/cms/doc_tree/publish/doc_publisher.ex
backend/api/lib/groupher_server/cms/doc_tree/publish/public_projection.ex
backend/api/lib/groupher_server/cms/doc_tree/publish/restore.ex
backend/api/lib/groupher_server/cms/doc_tree/publish/selection.ex
backend/api/lib/groupher_server/cms/doc_tree/query.ex
backend/api/lib/groupher_server/cms/doc_tree/trash.ex
backend/api/lib/groupher_server/cms/doc_tree/writer.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/draft_doc.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/identity.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/index.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/node.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/operation.ex
backend/api/lib/groupher_server/cms/doc_tree/writer_impl/trash.ex
backend/api/lib/groupher_server/cms/gate/access.ex
backend/api/lib/groupher_server/cms/gate/access/check.ex
backend/api/lib/groupher_server/cms/gate/access/load.ex
backend/api/lib/groupher_server/cms/gate/access/load/queries.ex
backend/api/lib/groupher_server/cms/gate/access/policy/article.ex
backend/api/lib/groupher_server/cms/gate/access/policy/comment.ex
backend/api/lib/groupher_server/cms/gate/access/policy/community.ex
backend/api/lib/groupher_server/cms/gate/decision.ex
backend/api/lib/groupher_server/cms/gate/scope/article.ex
backend/api/lib/groupher_server/cms/gate/scope/comment.ex
backend/api/lib/groupher_server/cms/gate/scope/community.ex
backend/api/lib/groupher_server/cms/gate/scope/community_chain.ex
backend/api/lib/groupher_server/cms/wallpaper/publisher.ex
backend/api/lib/groupher_server/cms/wallpaper/settings.ex
backend/api/lib/groupher_server/cms/wallpaper/upload.ex
backend/api/lib/groupher_server/jobs/wallpaper_lifecycle.ex
```

必要直接调用方：DocTree writer/publish 的 revision 和 projection helper、Assets replacement
plan 的 Gate callback、Community setup/tag stats、Content Import writer/staging、Wallpaper
worker，以及 Gate policy 的 `Decision.from_result/2`。

最低 focused tests：

```text
mix test $(rg --files test | rg '(cms/(assets|communities/(lifecycle|tags)|content_import|doc_tree|gate|wallpaper)|web/query/cms/(assets|doc_tree)|web/wallpaper_graphql)' | sort)
```

验收重点：DocTree 的批量 reindex、publish/restore/trash、Assets replacement、社区生命周期、
导入 staging、Wallpaper 上传和 Gate allow/deny 的公共结果及 rollback 语义不变。R4 完成条件：
focused tests `252 passed`，且固定范围内无业务裸成功形状。

### R5：全局门禁和例外收口

使用 R1 前置步骤已经创建的 `scripts/check-business-return-shape.mjs`、对应测试和例外 manifest，
关闭迁移期的 report-only 语义，增加严格的 `check:business-return-shape` package script，并将该
检查接入根 `docs:check`。门禁至少禁止业务目录新增以下形状：

```text
def ... do :ok end
defp ... do :ok end
fn ... -> :ok end
... -> :ok end
else: :ok
then: :ok
:ok <- business_call(...)
```

扫描必须允许已登记的 callback、adapter 和测试框架例外，并要求例外有明确 owner。

扫描范围固定为 `backend/api/lib/**/*.ex`。测试目录不进入生产门禁；测试辅助模块即使位于 `lib/`
也在扫描范围内，只有明确受框架协议约束的函数可以登记例外。门禁检查函数体中的以下形状：

```text
独立返回行：:ok
单行函数：def/defp ... do: :ok
匿名函数/分支结果：fn ... -> :ok end、... -> :ok end
关键词分支：else: :ok、then: :ok
with 接收：:ok <- business_call(...)
```

这些规则扫描的是函数体中显式写出的裸 `:ok`，用于发现疑似业务返回，不推断每个第三方函数的
内部返回值，也不要求修改 Elixir/OTP 基础库本身。若基础库或框架 callback 的公开协议就是裸 `:ok`，
应在 Groupher 的 callback 边界按实际命中登记 manifest 例外；若 adapter 将基础库结果暴露给 Groupher
业务链路，则必须在 adapter 边界转换为 tagged tuple。例如：

```elixir
# 基础库返回 :ok，不应直接成为业务函数的公开结果。
def remove_attachment(path) do
  case File.rm(path) do
    :ok -> {:ok, :pass}
    {:error, reason} -> {:error, reason}
  end
end

# 框架明确要求裸 :ok 的 callback 可以保留，但必须登记协议、owner 和原因。
def config_change(_changed, _new, _removed), do: :ok
```

`fn ... -> :ok end`、`... -> :ok end`、`else: :ok` 和 `then: :ok` 都先作为候选命中；是否放行只由
函数所属的业务/协议边界决定。业务模块中的 `{:ok, :pass}` 是合法 marker，但扫描器测试需要防止将其
误报为裸 `:ok`。

合法例外统一登记在 `scripts/check-business-return-shape.mjs` 导出的 manifest 中。每项必须包含：

```js
{
  path: 'backend/api/lib/...',
  function: 'perform/1',
  kind: 'bare_return',
  occurrences: 1,
  protocol: 'Oban.Worker',
  owner: 'CMS.Outbox',
  reason: 'Preserve the framework callback return contract at the boundary'
}
```

例外按 `path + function + kind` 匹配，并要求实际命中数等于 `occurrences`；不使用容易随编辑漂移的
行号，也不允许仅按目录跳过。测试必须拒绝缺少字段、重复项、找不到目标函数的 stale 项，以及
超过登记数量的额外裸 `:ok`。adapter 只有在第三方协议要求其公开返回裸 `:ok` 时才能登记；基础库
调用自身返回 `:ok` 不会因为调用方使用了基础库就自动获得例外，进入 Groupher 业务链路的 adapter
函数仍应转换为 tagged tuple。

R5 不引入“历史业务违规” baseline 或 debt allowlist。R1–R4 期间通过 `--report` 运行，扫描结果
可以非零，但命令必须完整输出违规并校验 manifest 自身；所有业务违规清零、合法协议例外登记完成
后，才增加严格 package script 并接入 `docs:check`。这样合入后的门禁既阻止新增违规，也不会永久
固化迁移前债务。

实现方式沿用 `cms-facade-fix.md` Phase 3 的模式：测试文件固定违规与允许例外的正反例，主脚本
扫描生产目录，package script 负责串联测试与扫描，`docs:check` 负责在文档/结构回归时统一执行。

## 5. 验收

每个子批次在 `backend/api` 目录执行：

```text
mix format --check-formatted 'lib/**/*.ex' 'test/**/*.ex'
mix compile --warnings-as-errors
mix test <本批 focused test 路径>
mix test --exclude later
```

并在仓库根目录执行：

```text
node --test scripts/check-business-return-shape.test.mjs
node scripts/check-business-return-shape.mjs --report
pnpm docs:check
git diff --check
```

前两条从门禁准备步骤开始适用于 R1–R4；R5 改为执行严格的
`pnpm check:business-return-shape`，且 `pnpm docs:check` 必须已经包含该严格检查。

focused tests 的最低集合如下；若结构追踪发现更多直接调用方，应补充而不是替换这些集合：

| 批次 | 最低 focused tests                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1A  | `test/groupher_server/cms/front_desk_test.exs`、Article create/update 对应的 `test/groupher_server_web/mutation/cms/articles/*_test.exs`                                                        |
| R1B  | `test/groupher_server/cms/articles/revision_target_test.exs`、`test/groupher_server/cms/articles/commands/recovery_test.exs`、`test/groupher_server_web/mutation/cms/articles/*_draft_test.exs` |
| R1C  | `test/groupher_server/cms/articles/moderation/*_test.exs`、`test/groupher_server/cms/articles/trash_test.exs`、`test/groupher_server_web/mutation/cms/articles/document_flow_test.exs`          |
| R2   | `test/groupher_server/cms/comments/`、`test/groupher_server/cms/interactions/`、对应 comments/interactions GraphQL tests                                                                        |
| R3   | Activity、Outbox、Press、PublicCache 对应测试目录及 worker focused tests                                                                                                                        |
| R4   | DocTree、Assets、Community、Content Import、Wallpaper、Gate 对应 focused tests                                                                                                                  |
| R5   | `node --test scripts/check-business-return-shape.test.mjs`、`pnpm check:business-return-shape`、`pnpm docs:check`                                                                               |

通配目录只表示测试选择边界，实施记录必须写出实际执行的命令和结果。若某 owner 没有对应测试，
不能用全量测试替代说明；应先补 focused contract test，或在批次记录中明确缺口和人工验证证据。

### 5.1 2026-10-08 实施记录

- R1 focused set：`48 passed`；R2 ViewTracker/ReadState focused set：`33 passed`。
- R3 focused set：`50 passed`；R4 focused set：`252 passed`。
- `mix compile --warnings-as-errors`、`mix format --check-formatted 'lib/**/*.ex' 'test/**/*.ex'` 通过。
- `pnpm check:business-return-shape` 通过；扫描 `backend/api/lib/**/*.ex` 共发现 3 个已登记
  callback 命中，没有未登记业务违规。
- R5 follow-up：扫描器新增 `fn/分支 -> :ok`、`else: :ok`、`then: :ok` 的正反例和 callback
  manifest 放行测试，共 `8 passed`；map/status 字段中的嵌套 atom 不作为函数返回误报。
- `pnpm docs:check` 通过，其中包含严格 business-return-shape 门禁。
- 全量 `mix test --exclude later` 的一次运行结果为 `2172/2173 passed, 1 excluded`，唯一失败是
  Postgrex Sandbox client disconnect 导致的 60 秒环境超时；单独重跑该文件为 `2 passed`。
  低并发重跑时又出现同类数据库连接超时，另有 3 个测试触及工作区既有的
  `backend/api/lib/groupher_server/cms/articles/path_resolver.ex` 删除，导致
  `GroupherServer.CMS.Articles.PathResolver.resolve/1` 不可用。该删除属于并行的 ArticleBinding/
  ArticleView 重构，本迁移未恢复或覆盖它；本迁移的 focused tests、编译、格式和门禁均已通过。

最终验收：

- 生产扫描范围内不存在未登记的裸 `:ok`；
- 所有保留裸 `:ok` 的位置都属于登记过的协议/回调例外；
- `with` 不再使用裸 `:ok <-` 接收业务 helper；
- Article、Stats、Comments、Interaction、ViewTracker、Outbox 和 Publish 的迁移 focused 回归测试通过；
- 返回协议的变更不改变 GraphQL、Outbox payload 或公共路径语义。

## 6. 与其他改动的边界

本迁移只处理业务返回协议，不包含以下改动：

- `ArticleCommunity` → `ArticleBinding` 的命名收敛；
- `ArticleResult` → `ArticleView` 的命名收敛；
- `Articles.Context` → `Articles.Bindings` 的模块迁移；
- `article_communities` → `article_bindings` 的物理表迁移；
- `Article.community_id` / `Article.inner_id` 的兼容字段清理。

这些改动应按各自迁移合同独立验证，避免返回协议变化和领域命名变化同时发生时无法定位回归。
