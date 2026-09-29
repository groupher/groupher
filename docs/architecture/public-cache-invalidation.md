# 公共缓存可靠失效

> 状态：Phoenix outbox、Oban worker、Cloudflare adapter、领域写入接线和跨语言 tag contract 已落地；真实 Cloudflare purge、告警和生产验收见文末清单。
>
> 本文定义 Phoenix 领域写入提交后，如何通过 typed `PublicCache.Invalidation`、transactional outbox、Oban
> `PurgeWorker` 和 Cloudflare adapter 可靠失效公共 HTML。目标架构不保留 Community/Dash mutation proxy purge、
> operation-name mapping、Edge executor 或其他兼容入口。

## 1. 结论

公共 CDN 失效由 Phoenix 完整拥有：

```text
Phoenix domain command
        │
        v
Repo.transaction
  ├─ write domain state
  ├─ insert PublicCache.Invalidation outbox row
  └─ insert Oban purge trigger job
        │
        v commit
Oban PublicCache.PurgeWorker
  ├─ claim one pending invalidation
  ├─ invalidation type -> semantic cache scopes
  ├─ PublicCache.Tags -> canonical cache tags
  ├─ retry / dead-letter
  └─ PublicCache.Cloudflare.purge(tags)
        │
        v
Cloudflare evicts matching public objects
        │
        v
next public GET -> MISS/EXPIRED -> Community SSR -> fresh HTML + hydration
```

Community 只负责在自己生成的公共 response 上输出 canonical `Cache-Tag` 和 `Cache-Control`；它不决定何时 purge，
也不调用 Cloudflare。浏览器、Dash、Community GraphQL proxy 和 mutation response 都不参与 CDN 失效执行。

领域状态、invalidation row 与 Oban trigger job 在同一个数据库事务内提交，因此不会出现“业务写入成功，但进程在
enqueue 前崩溃，永久漏掉 purge”。Cloudflare 请求失败不回滚已经提交的业务事务，而是由 outbox 状态和 Oban 重试
最终收敛。

## 2. 所有权

### 2.1 Phoenix 拥有

- 哪些领域变化需要失效公共缓存；
- typed invalidation type 与封闭 Const；
- domain transaction 内写入 invalidation outbox；
- invalidation type 到 semantic cache scope 的映射；
- canonical tag 的 Elixir 生成实现；
- claim、retry、dead-letter、replay；
- Cloudflare API token 与 purge API 调用；
- health、metrics、告警和审计。

### 2.2 Community 拥有

- 哪些公共 HTML/RSC response 可以被 CDN 缓存；
- 在 response 上输出共享 contract 生成的 `Cache-Control`；
- 根据当前页面组合输出共享 contract 生成的 `Cache-Tag`；
- SSR miss/revalidate 时重新生成 content 与 public hydration。

### 2.3 不再拥有 CDN purge 的模块

```text
Browser mutation hooks
frontend/core/query/cacheInvalidation.ts
Community /api/graphql proxy
Dash /api/graphql proxy
Dash -> Community revalidation bridge
Community internal revalidation endpoint
Cloudflare Worker / Edge executor
```

这些模块不能作为 fallback 保留。切换完成后，绕过 Community/Dash、通过任何合法 Phoenix command 完成的领域写入
都必须产生相同 invalidation。

## 3. Cloudflare cache-tag 语义

Cloudflare 官方流程：

1. Community origin response 输出 `Cache-Tag: tag-a,tag-b`；
2. Cloudflare 将 tag 与缓存对象关联；
3. Phoenix 调用 `POST /zones/{zone_id}/purge_cache`，body 为 `{ "tags": [...] }`；
4. Cloudflare 删除带任一目标 tag 的缓存对象；
5. 后续请求不再命中旧对象，通常返回 `MISS`，Tiered Cache 下也可能先看到 `EXPIRED`。

官方资料：

- [Purge cache by cache-tags](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/)
- [Purge Cached Content API](https://developers.cloudflare.com/api/resources/cache/methods/purge/)
- [Purge cache availability and limits](https://developers.cloudflare.com/cache/how-to/purge-cache/#availability-and-limits)

Cloudflare 当前约束必须进入 contract validation 和 `PublicCache.Policy`，不能只留在运维备注里：

- 单个 API request 最多 100 个 tag；`max_tags_per_request` 必须 `<= 100`；
- 单个 purge API tag 最长 1,024 字符；response 上所有 `Cache-Tag` header 的总值最长 16 KB；
- tag 只能使用 printable ASCII、不能包含空格，并按大小写不敏感处理；contract 必须输出唯一 canonical case；
- purge rate limit 按 account 和 plan 共享，worker 必须把当前 plan 的速率/突发容量作为部署配置，并对 429 退避；
- Cloudflare 会在边缘消费并移除 `Cache-Tag` response header，不能用浏览器是否看到该 header 作为 tagging 验收。

Cloudflare HTTP 200 只表示接受了请求，不证明此前存在目标对象，也不证明下一次请求已经返回新业务内容。adapter 必须
同时检查 HTTP status 和 Cloudflare response body 的 `success`；生产验收还要请求真实 URL，确认
`CF-Cache-Status` 不再是旧对象的 `HIT`，并验证页面版本或 hydration 已更新。

purge 不修改 `ArticleStats.snapshotAt`，也不主动生成 HTML。它只删除边缘对象；下一次回源会读取当前 content
和持久化的 ArticleStats snapshot 并重新生成 HTML/hydration。`snapshotAt` 只会在 ArticleStats owner transaction
成功同步统计时推进，不会因为 purge 本身推进。

## 4. 模块结构

```text
GroupherServer.PublicCache
├─ Invalidation       持久化的确定失效记录，不叫 Intent
├─ Const              invalidation type/status 封闭词表
├─ Tags               generated canonical tag constructors
├─ Scope              invalidation type 到 cache scopes 的穷举映射
├─ PurgeWorker        Oban claim、retry、dead-letter
├─ Policy             timeout/retry/max-attempts/tag-count 参数
└─ Cloudflare         唯一外部 API adapter
```

`PublicCache.Invalidation` 表示已经确定需要执行的缓存失效，不使用模糊的 `Intent` 命名。

公共写入 API：

```elixir
PublicCache.invalidate(
  multi,
  PublicCache.Const.article_published(),
  article
)
```

`invalidate/3` 返回追加了 outbox insert 与 Oban trigger insert 的 `Ecto.Multi`；领域 command 只调用这一入口，不能自行
拼 Oban args 或 outbox changeset。

调用方不能提交原始 tag：

```elixir
# 禁止
PublicCache.purge(["community[home]-thread[POST]-articles"])
```

## 5. Invalidation Const

invalidation type 是 Phoenix 内部持久化协议，必须通过 `PublicCache.Const` 封闭，不允许任意 atom/string：

```elixir
defmodule GroupherServer.PublicCache.Const do
  @invalidation_types [
    :article_published,
    :article_content_changed,
    :article_visibility_changed,
    :comments_content_changed,
    :community_presentation_changed,
    :taxonomy_changed,
    :doc_tree_changed
  ]

  def invalidation_types, do: @invalidation_types

  def article_published, do: :article_published
  def article_content_changed, do: :article_content_changed
  def article_visibility_changed, do: :article_visibility_changed
  def comments_content_changed, do: :comments_content_changed
  def community_presentation_changed, do: :community_presentation_changed
  def taxonomy_changed, do: :taxonomy_changed
  def doc_tree_changed, do: :doc_tree_changed
end
```

约束：

- `Invalidation.type` 使用 `Ecto.Enum, values: Const.invalidation_types()`；
- 领域调用只使用 `Const` 函数，不写裸 atom/string；
- `PublicCache.Scope` 穷举全部 type；
- 新增 type 时必须同时增加 scope mapping、contract fixture、事务测试和端到端 purge 测试；
- 未知 type/version 直接 dead-letter 并告警，不能猜测或降级为 community-wide purge。

`article_published` 等 type 描述已经发生的领域变化，不描述 Cloudflare 动作。`PublicCache.Scope` 决定该变化影响哪些
cache scope。

## 6. Invalidation 到 cache scope

| Invalidation type                | Semantic cache scopes                             | Canonical tags                      |
| -------------------------------- | ------------------------------------------------- | ----------------------------------- |
| `article_published`              | article list；Doc 可附加 doc tree                 | `articleList`；可选 `docTree`       |
| `article_content_changed`        | article detail + article list                     | `articleDetail` + `articleList`     |
| `article_visibility_changed`     | article detail + article list                     | `articleDetail` + `articleList`     |
| `comments_content_changed`       | comments；只有 HTML 内嵌 comments 时才附加 detail | `comments`；可选 `articleDetail`    |
| `community_presentation_changed` | community public shell                            | `community`                         |
| `taxonomy_changed`               | tags + article list                               | `tags` + `articleList`              |
| `doc_tree_changed`               | doc tree；必要时 docs list                        | `docTree` + 可选 `articleList(DOC)` |

以下高频变化不创建 HTML invalidation：

```text
article viewed
article upvoted/unupvoted
article collected/uncollected
article emotion changed
comment count changed
comment upvoted/reported/reacted
```

它们通过浏览器 TanStack Query invalidation、mutation receipt、owner revision 和正常 HTML TTL 收敛。若产品以后要求
某个统计变化立即影响 HTML，必须新增明确的 invalidation type、容量评估和测试，不能把全部 count mutation 改成全页 purge。

## 7. 跨语言 Public Cache contract

Phoenix 生成 purge tag，Community 生成 response tag；两端必须消费同一个语言无关 contract。沿用现有
`packages/contracts` 的共享目录，不建立第二套 contract 系统：

```text
packages/contracts/public-cache.contract.json
  ├─ packages/contracts/src/public-cache.ts
  │    └─ Community / Core 的 canonical constructors
  ├─ backend/api/lib/groupher_server/public_cache/tags.ex
  │    └─ Phoenix 的同构实现
  └─ fixtures/public-cache-tags-v1.json
       └─ 两端共同验证的 golden vectors
```

职责：

- `public-cache.contract.json`：tag version、scope 名称、template 和输入规则的唯一来源；
- `public-cache.ts`：Community/Core 使用的 TypeScript constructors 和 validator；
- `tags.ex`：Phoenix 使用的同构实现和 validator；
- `public-cache-tags-v1.json`：跨语言 golden vectors；contract 变更必须同时更新两端测试。

contract 示例：

```json
{
  "version": 1,
  "tagTemplates": {
    "community": "community[{community}]",
    "articleList": "community[{community}]-thread[{thread}]-articles",
    "articleDetail": "community[{community}]-thread[{thread}]-article[{innerId}]",
    "comments": "community[{community}]-thread[{thread}]-article[{innerId}]-comments",
    "tags": "community[{community}]-thread[{thread}]-tags",
    "docTree": "community[{community}]-doc-tree"
  }
}
```

跨语言 golden vectors 放在：

```text
packages/contracts/fixtures/public-cache-tags-v1.json
```

例如：

```json
{
  "articleDetail": {
    "input": { "community": "home", "thread": "POST", "innerId": "42" },
    "expected": "community[home]-thread[POST]-article[42]"
  }
}
```

TypeScript 和 Elixir contract tests 必须消费同一 fixture。fixture 是生成结果的 parity/behavior 验证；runtime 不从
仓库相对路径读取 JSON。

`article_published` 等 invalidation type 仅属于 Phoenix outbox，不需要暴露给 TypeScript。跨语言 contract 只共享
Community response tagging 与 Phoenix purge tagging 都需要的 tag wire protocol。

## 8. Outbox 数据模型

```text
public_cache_invalidations
├─ id                     UUID PK；delivery idempotency key
├─ contract_version       smallint
├─ type                   Ecto.Enum <- PublicCache.Const
├─ aggregate_type
├─ aggregate_id
├─ community_id
├─ payload                versioned typed encoding
├─ causation_id           command id
├─ status                 pending | delivering | delivered | dead
├─ attempts
├─ available_at
├─ locked_at
├─ locked_by
├─ delivered_at
├─ last_error_code
├─ last_error_at
├─ inserted_at
└─ updated_at
```

`payload` 由每个 invalidation type 的 changeset/codec 验证，不是开放 event bag。相同 command replay 使用：

```text
UNIQUE(causation_id, type, aggregate_type, aggregate_id)
```

避免重复创建逻辑 invalidation。即使 worker timeout 后重复调用 Cloudflare，相同 tag purge 也必须安全。

`PublicCache.invalidate/4` 和 `invalidate_now/3` 必须显式接收 `causation_id`，不再为调用方隐式生成 UUID。当前尚未接入
命令 receipt 的社区设置、Dashboard section、taxonomy、moderation 和 Docs tree publish 入口仍使用一次事务内生成的
operation id，因此被标记为 non-replayable；它们不能宣称跨请求 replay 去重。后续接入 `CMS.Command` 或 release receipt
时，必须把稳定 command/release id 传到这里并删除这些随机 operation id。

## 9. 事务边界

### 9.1 发布 Article

```text
CreatePost command
      │
      v
Repo.transaction
  ├─ insert canonical Article
  ├─ insert Post content
  ├─ initialize ArticleStats
  └─ PublicCache.invalidate(multi, Const.article_published(), article)
       ├─ insert Invalidation row
       └─ insert PurgeWorker trigger job
      │
      v
commit succeeds
  ├─ Article visible
  └─ invalidation guaranteed pending

rollback
  ├─ no Article
  └─ no invalidation
```

### 9.2 修改 Article

```text
UpdatePost command
  -> transaction updates content
  -> insert article_content_changed invalidation
  -> commit
  -> PurgeWorker removes detail + list tags
```

不能在领域事务内调用 Cloudflare：网络延迟会延长数据库锁，Cloudflare 故障也不应把合法领域写入变成事务失败。

`invalidation_id` 在构造 `Ecto.Multi` 前生成，因此 outbox row 与 Oban job 可以原子引用同一个 id。Oban job 只是 durable
wakeup，不复制 invalidation payload，也不是第二个业务 owner。若 trigger job 重试或重复执行，worker 以 outbox status
和 row lock 判定是否仍需发送。Oban Lifeline 负责把 node/process crash 后遗留的 `executing` job 重新置为可执行；worker
若在 lease 到期前被再次唤醒，必须 snooze 到剩余 lease 到期，而不能把 job 标记 completed。当前实现不引入独立
sweeper；若 trigger 被运维删除或发生存储外损坏，由 health 指标和显式 replay 处理，replay 仍复用同一个 invalidation row
和 `PurgeWorker`。
正常路径和 repair path 最终都进入同一个 `PurgeWorker`，不建立另一套 purge executor。

该原子性要求 Oban job table 与领域数据使用同一个 PostgreSQL Repo/transaction。若未来把 queue 移到外部系统，必须重新引入
真正的 outbox relay；不能保留“同事务 enqueue”的表述却跨两个存储提交。trigger job 以 `invalidation_id` 配置唯一性，
command replay 不创建并行有效 trigger。

## 10. PurgeWorker

```text
Oban PublicCache.PurgeWorker
  -> load trigger invalidation id
  -> SELECT the trigger's invalidation row
       FOR UPDATE
  -> decode + validate version/type/payload
  -> PublicCache.Scope.resolve(invalidation)
  -> PublicCache.Tags generate canonical tags
  -> PublicCache.Cloudflare.purge(tags)
  -> mark delivered or schedule retry/dead-letter
```

默认策略集中在 `PublicCache.Policy`：

```text
max_tags_per_request
request_timeout
retry_base_delay_seconds
max_retry_delay_seconds
max_attempts
delivery_lease_seconds
pending_slo_seconds
```

Oban 的 `backoff/1` 合同单位是秒；重试使用 second-based exponential backoff + jitter，并由
`max_retry_delay_seconds` 封顶。不能把毫秒配置原样返回给 Oban。

- timeout、network、HTTP 429、HTTP 5xx：可重试；
- contract version/type/payload 无效：dead-letter；
- HTTP 400：dead-letter 并记录安全的 Cloudflare error code；
- HTTP 401/403：配置/凭据故障，立即 degraded + 告警；
- response body `success=false`：按 error code 分类，不能因 HTTP 200 标记 delivered。

人工 replay 复用原 invalidation id，或记录明确的 parent id；不能复制成无法追踪的新记录。

Oban trigger job 与 outbox 状态的配合规则：

- transaction rollback 时两者都不存在；
- job retry 只重新唤醒 worker，不增加 outbox `attempts` 之外的第二套业务重试语义；
- 未过期 lease 返回剩余秒数，worker 使用 `{:snooze, seconds}` 保留同一个 trigger job；
- worker crash 在 Cloudflare 返回前保持 `delivering`；`locked_at` 超过 `delivery_lease_seconds` 后，新的 worker
  可以在行锁内重新 claim，并使用新的 fencing token；Oban Lifeline 保证 orphaned `executing` job 会再次运行，旧 worker
  不能再 mark delivered/failed；
- worker crash 在 Cloudflare 成功后、标记 delivered 前可能重复 purge；cache-tag purge 必须按幂等删除处理；
- trigger 对应 row 已 delivered/dead 时 job 直接成功退出；
- replay 只重新唤醒同一个 row，不直接调用 Cloudflare。

trigger job 的 uniqueness 只覆盖 Oban incomplete states。completed job 不得在 uniqueness period 内阻止同一 invalidation 的显式
replay；outbox row 的 `delivered/dead` 状态仍是是否需要实际发送的最终判定。

## 11. Cloudflare adapter

`PublicCache.Cloudflare` 是唯一网络 adapter：

```text
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
Authorization: Bearer <token scoped to Cache Purge on one zone>
Content-Type: application/json

{"tags": ["community[home]-thread[POST]-articles"]}
```

约束：

- token 使用最小 `Cache Purge` 权限，禁止 Global API Key；
- token、完整 Authorization、Cookie、正文不进入日志；
- validate HTTP status + Cloudflare body `success`；
- 单次 tags 数量不得超过 `PublicCache.Policy.max_tags_per_request`，且该值不得超过 Cloudflare 当前上限 100；
- tag 必须通过共享 contract 的 ASCII、空格、长度和 canonical-case validation；
- adapter 不解释领域 type，不访问 Article/Community 数据库；
- Phoenix secret/config 缺失时启动或 readiness 失败，不能静默跳过。

## 12. 与 TanStack Query invalidation 的边界

两种 invalidation 共享领域语义，但不共用执行器：

```text
Public CDN invalidation
  owner: Phoenix PublicCache + outbox + Oban
  target: public HTML/hydration object
  trigger: content/publish/visibility/config changes

TanStack Query invalidation
  owner: frontend/core/query/invalidation
  target: current browser QueryClient
  trigger: mutation/view receipt flow
```

Upvote：

```text
mutation confirmed
  -> no PublicCache.Invalidation
  -> write confirmed receipt
  -> QueryInvalidation.article.stats(ref)
  -> refetch active ArticleStats entity + matching statsBatch
  -> clear receipt when interactionRevision catches up
```

发布 Article：

```text
Phoenix transaction
  -> Article + article_published invalidation commit together
  -> PurgeWorker eventually purges article-list CDN tag

current browser
  -> QueryInvalidation.article.lists(scope)
```

浏览器 invalidation 不修改 `snapshotAt`；Cloudflare purge 也不修改 `snapshotAt`。只有新的源站 ArticleStats response
可以生成新的 `snapshotAt`。

前端 target、executor、refetch policy 和静态门禁的 canonical 合同见
[`query-invalidation.md`](./query-invalidation.md)。

## 13. 可观测性

必须提供：

```text
public_cache_invalidations_total{type,status}
public_cache_oldest_pending_age_seconds
public_cache_oldest_delivering_age_seconds
public_cache_delivering_without_lease
public_cache_purge_requests_total{result,error_code}
public_cache_purge_attempts_total{type,result}
public_cache_purge_duration_ms
public_cache_tags_per_request
public_cache_dead_letter_total{type,reason}
public_cache_last_success_at
public_cache_last_failure_at
```

Health/readiness：

- zone id/token 缺失或凭据被拒绝：配置错误；
- oldest pending age 超过 SLO：degraded；
- oldest delivering age 超过 lease：degraded；Oban Lifeline 唤醒 orphaned job 后允许 worker reclaim；
- dead-letter 非零：degraded 并告警；
- production 缺少 Cloudflare zone/token：启动/readiness 失败，不把确定性配置错误排队重试；
- Cloudflare 429/5xx 短暂重试：记录指标，不让 public read 失效；
- PurgeWorker 长期无法 claim/drain：告警，即使 Cloudflare API 自身健康。

每条记录可从 `causation_id -> invalidation id -> Oban job -> Cloudflare result` 追踪。`:telemetry` 事件由
`GroupherServer.PublicCache.Telemetry` 接到结构化日志 sink，并保留给未来 metrics exporter；日志只包含安全 locator、type、
tag、attempt、duration 和 error code。command-backed 写入必须传稳定的 command/release operation id；没有稳定 operation
id 的旧式入口必须被标记为 non-replayable，不得把每次随机 UUID 宣称为 replay dedupe。

## 14. 直接切换

不设置兼容中间层：

1. 增加 `public-cache.contract.json`、双端生成器、stale check 和 golden vectors；
2. 建立 `PublicCache.Const/Invalidation/Scope/Tags/Policy/Cloudflare`；
3. 建立 outbox migration 和 `PurgeWorker`；
4. 所有 content/publish/visibility/config command 在事务内写 typed invalidation；
5. coverage audit 证明每个需要立即 purge 的领域写入口都有且只有一个 invalidation；
6. 非生产环境验证 tag mapping、重试、Cloudflare body error 和 dead-letter；
7. 生产切换 Phoenix outbox 为唯一 purge owner；
8. 同一次发布删除 Community/Dash proxy purge、operation-name mapping、internal revalidation endpoint 和相关配置；
9. 验证真实 URL 的 `CF-Cache-Status`、业务版本、outbox drain 和 health metrics。

如果第 5 步 coverage 不完整，阻止切换并补齐 command；不能保留 proxy fallback 掩盖遗漏。

## 15. 测试与验收

Contract：

- JSON contract 生成 TypeScript 与 Elixir；
- stale check 拒绝手改或过期生成文件；
- 两端消费同一 golden vectors 并生成完全相同 tag；
- 非法 community/thread/innerId 在两端一致拒绝；
- contract version 改变必须显式升级。

事务与 outbox：

- domain write 与 invalidation 同时 commit/rollback；
- Invalidation 与 Oban trigger 在同一 Repo transaction 提交，trigger identity 按 invalidation id 唯一；
- command replay 不重复创建逻辑 invalidation；
- type 来自 `PublicCache.Const`，schema 不接受任意值；
- `PublicCache.Scope` 穷举全部 type；
- 高频 ArticleStats mutation 不创建 HTML invalidation。

Worker 与 adapter：

- 并发 worker 使用 row lock 不重复 claim；
- 一个 invalidation 解析出的 tags 经过 contract 校验后一次发送；
- 429/5xx/timeout 重试，400/401/403/invalid payload 正确分类；
- crash/restart 后 pending/delivering record 可恢复；
- Cloudflare HTTP 200 + `success=false` 不标记 delivered；
- token 不进入日志。

端到端：

- 发布 Article 后，旧列表 purge 后下一请求为 `MISS`/`EXPIRED` 并包含新 Article；
- 修改 Article 后 detail/list 失效，其他 community/thread 不受影响；
- 单次 view/upvote/comment/collect/emotion 不 purge HTML；
- Cloudflare 暂时失败时 mutation 仍成功，record 保持 pending 并在恢复后 drain；
- 绕过 Community/Dash、直接通过合法 Phoenix command 写入时仍产生 invalidation；
- repository 不再存在 CDN operation-name mapping、proxy purge、Edge executor 或第二 owner。

## 16. 明确禁止

```text
在领域数据库事务内调用 Cloudflare
由 GraphQL operation name 承担领域失效语义
让浏览器、Community 或 Dash 提交任意 purge tags
用 waitUntil 代替 durable outbox
用 Intent 表示已经确定的 invalidation
使用裸 article_published 等 atom/string
Cloudflare HTTP 200 就假定 purge 成功
purge 时手动推进 ArticleStats.snapshotAt
为每次 count 增量 purge 整页 HTML
同时运行 proxy purge 和 Phoenix outbox 两套 owner
保留旧链路作为 fallback
```
