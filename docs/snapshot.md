# CMS Snapshot

`GroupherServer.CMS.Snapshot` 用于刷新 CMS 中冗余保存的展示快照。它解决的是
“列表已经拿到一组轻量展示数据，但其中的昵称、头像、标题或评论摘要可能过期”这一类问题。

它不保存业务事实，也不决定关系成员、顺序、数量或权限。

## 背景

文章、评论、通知、动态等读模型经常内嵌少量关联对象信息，例如：

- `latest_upvoted_users` 中的用户昵称和头像；
- 引用卡片中的文章标题；
- 回复预览中的评论摘要。

这些数据能避免列表查询为每个条目重复 join 或 preload，但它们只是权威数据的副本：
用户修改 nickname/avatar、文章修改标题、评论被编辑或删除后，旧副本不会自行变化。

Snapshot 在 CMS read flow 内批量收集这些副本的内部 ID，用权威表中的最新 summary
刷新展示字段，并保持调用方已经选好的关系集合不变。

```text
业务查询选出关系和顺序
  -> CMS.Snapshot 批量刷新展示字段
  -> GraphQL 按公开类型白名单输出
```

## 权责边界

Snapshot 只负责 denormalized display data：

- 用户展示信息的权威来源是 `account.users`；
- 文章展示信息的权威来源是对应 thread 的公开 article 表；
- 评论展示信息的权威来源是 `comments`；
- Snapshot cache 只是短期加速层，不是新的事实来源。

Snapshot 不会：

- 判断某个用户是否点过 emotion、upvote 或 collect；
- 修改 `latest_*_users` 的成员、长度或顺序；
- 修改 count、权限、审核结果或业务状态；
- 把缺少于输入关系中的新成员补进响应。

例如输入为 `[user1, user2]`，刷新期间 user3 新增了 reaction，本次调用仍只刷新
user1/user2 的展示字段。user3 是否进入列表由 reaction 的业务查询决定。

## 内部 ID 与公开 API

快照需要稳定身份才能从权威表取回最新记录。当前 user snapshot 同时兼容 `id` 和
`user_id`，article/comment snapshot 使用 `id`。这些值用于后端内部的：

- 批量查询；
- 去重与原位置回填；
- cache key；
- 判断两个 snapshot 是否指向同一条权威记录。

内部关系和快照定位优先使用数据库 ID，而不是 login：数据库 ID 不随展示资料变化，
比较成本也更低；login 应作为公开账号标识或展示字段，而不是后端关系主键。

数据库 ID 是后端实现细节，不能因为它存在于 embed、summary 或 cache 中就直接返回前端。
当前 GraphQL `common_user` 只公开 `login/avatar/nickname/bio/shortbio`，没有公开
`id/user_id`。后续新增 Snapshot 消费方时也必须由 GraphQL 类型或显式 presenter
白名单投影，不能把内部 map 通过 JSON 字段原样序列化。

如果前端需要一个公开引用，应使用产品定义的 public ref，例如 login、hash id 或
thread + inner id，而不是数据库 ID。

## 两种读取模式

### stale-first（默认）

`stale_first` 面向列表、feed 和搜索等延迟敏感场景：

1. 批量收集输入 snapshot 的 ID；
2. 命中 cache 的条目立即 patch 到响应；
3. cache miss 保留调用方传入的旧 snapshot；
4. 将同一批 misses 合并为一个后台刷新任务，供后续请求命中。

因此首次 miss 不保证当前请求拿到最新展示值，目标是低延迟并最终收敛。

```elixir
CMS.Snapshot.users(simple_users)
```

### blocking

`blocking` 在当前请求中批量读取权威表、更新 cache，再返回最新展示值。它适合详情页、
后台或确实需要当前展示值的流程，但会把数据库查询延迟加入请求。

```elixir
CMS.Snapshot.users(simple_users, mode: :blocking)
```

article/comment 在 blocking 模式下遇到不存在或不可用的记录时，会返回
`unavailable` placeholder；删除的评论使用删除提示摘要。

## API

| API                 | 用途                                            |
| ------------------- | ----------------------------------------------- |
| `users/2`           | 刷新一组轻量 user snapshot                      |
| `users_in/3`        | 批量刷新多个 item 的指定 user snapshot 路径     |
| `articles/3`        | 按 thread 刷新一组 article snapshot             |
| `articles_in/4`     | 按 thread 批量刷新多个 item 的指定 article 路径 |
| `comments/3`        | 按 thread 刷新一组 comment snapshot             |
| `comments_in/4`     | 按 thread 批量刷新多个 item 的指定 comment 路径 |
| `refresh_async/3`   | 由事件或 read miss 发起 best-effort 批量刷新    |
| `perform_refresh/3` | Oban worker 使用的同步执行入口                  |

`*_in` 的字段既可写成顶层 atom，也可写成嵌套 path：

```elixir
articles =
  CMS.Snapshot.users_in(articles, [
    [:meta, :latest_upvoted_users],
    [:meta, :latest_collected_users]
  ])
```

一次调用会跨所有 items 和所有指定路径收集 ID、去重、批量 resolve，再按原位置 patch。
不要在 `Enum.map` 中为每一个 item 或每一个字段分别调用 Snapshot，否则会重新制造
N+1 cache lookup / job / query。

## Cache 与后台任务

当前 snapshot cache 配置为：

- pool: `:snapshot`；
- 最大项数：50,000；
- 默认 TTL：5 分钟；
- key: `snapshot:{kind}:{thread?}:{internal_id}`。

stale-first miss 通过 `GroupherServer.Jobs.SnapshotRefresh` 投递 Oban 任务，worker 调用
`CMS.Snapshot.perform_refresh/3` 批量读取权威数据并写入 cache。该路径是 best-effort：
投递异常不会让原业务读取失败；test 和 seed 环境不会投递后台任务。

调用方可通过 `ttl:` 覆盖某次写 cache 的 TTL，但正常业务应优先保持统一配置，避免相同
key 因调用点不同而呈现难以推断的过期行为。

## 当前覆盖范围

截至当前实现，生产 read flow 中已经接入的是文章列表：

```elixir
[:meta, :latest_upvoted_users]
[:meta, :latest_collected_users]
```

以下能力已经有通用 API 和测试，但尚未看到生产 read flow 接入：

- article snapshot；
- comment snapshot；
- comment/reply preview；
- article/comment emotion 的 `latest_<emotion>_users`。

所以不能把“存在通用 Snapshot 模块”等同于“所有嵌入用户资料都会自动更新”。新增场景时，
需要在对应 CMS read flow 中显式调用合适的 `*_in` API。

## 与 emotion / upvote 数据的关系

`latest_*_users` 是有上限的展示缓存，适合保存内部 `user_id` 以支持稳定刷新；完整的参与
关系则不应由它承担。

当前几类数据的差异如下：

| 场景                    | 完整参与关系                                           | 最近用户展示缓存              | Snapshot 接入  |
| ----------------------- | ------------------------------------------------------ | ----------------------------- | -------------- |
| article upvote/collect  | `*_user_ids`                                           | `latest_*_users`              | 已接入文章列表 |
| comment upvote/report   | `*_user_ids`                                           | 当前没有对应通用 latest users | 未接入         |
| article/comment emotion | 独立 fact row，同时 embed 中还保存完整 `*_user_logins` | `latest_<emotion>_users`      | 未接入         |

对 emotion 而言，改进方向不是简单把不断增长的 `*_user_logins` 换成同样不断增长的
`*_user_ids`。更清晰的边界是：

- 独立 fact row 负责“谁对什么做了哪种 emotion”；
- count 由事实聚合或独立的稀疏计数投影负责；
- viewer state 按当前用户从 fact table 批量判断；
- `latest_<emotion>_users` 只保存固定数量的展示 snapshot；
- Snapshot 只负责刷新这几个 snapshot 的展示字段。

这样内部 ID 能解决身份稳定性，但不会把无上限数组、整块 JSONB 重写和热点行锁继续保留。

## 使用准则

适合使用 Snapshot：

- 已经存在关系结果，只需更新其中的展示字段；
- 展示对象有稳定内部 ID；
- stale-first 或 blocking 的一致性语义能被调用方明确选择；
- 能在 CMS read flow 中一次收集、一次批量处理。

不适合使用 Snapshot：

- 判断权限或当前用户是否参与；
- 维护 reaction 成员集合、计数或排序；
- 需要不可变历史记录；
- GraphQL 响应完成后再做全局隐式遍历和 patch。

## 与其他 Snapshot 的区别

仓库中还有 article immutable snapshot 和 doc tree snapshot，它们用于版本历史或发布状态，
语义与本模块不同。`CMS.Snapshot` 是可丢弃、可重建的展示刷新服务，不是内容版本模型。

更早的设计过程保留在 [`snapshot_update_system.md`](./todo/snapshot_update_system.md)。本文描述
当前模块的实际行为和使用边界，应作为接入该模块时的入口文档。
