# CMS Gate

本文与 [Community Lifecycle](./lifecycle.md) 配套阅读。Lifecycle 拥有 Community 状态及其转换，Gate 消费 Lifecycle 投影出的能力，但不接管 Lifecycle 状态机。

## 背景

当前后端中，决定一个 CMS 操作能否继续的逻辑分散在多个模块和目录中：

```text
CMS.Communities.Passport
CMS.Policy.PublishThrottle
CMS.CanCan
GroupherServerWeb.Middleware.Passport
GroupherServerWeb.Middleware.PublishThrottle
Helper.PermissionRegistry
CMS.Model.Embeds.Dashboard.Enable
```

这些模块分别处理权限、频率限制、社区功能开关和资源状态，单独看都有明确用途，但缺少一个共同的产品边界。开发者为了理解“为什么这次 CMS 操作被允许或拒绝”，需要同时了解 Passport、Policy、CanCan、Dashboard Enable 和 GraphQL middleware 等多个概念。

`CMS.CanCan` 的名称也会产生额外误导。CanCan 通常让人联想到基于用户或角色的授权系统，但当前模块实际上只负责三类功能可用性检查：

- 社区是否开放指定 Thread。
- 文章或评论是否允许指定 Emotion。
- 文章是否锁定评论。

真正的角色和操作权限已经由 Passport 负责；发布频率限制则由 `CMS.Policy.PublishThrottle` 负责。现有命名没有呈现这三类能力共同服务于“CMS 操作准入”这一事实。

## 目标

引入统一的 `CMS.Gate` 功能块，集中表达“一个 CMS 操作是否可以进入后续业务流程”。

Gate 统一模块入口和概念归属，但不把不同规则揉进同一个实现。Passport、发布限流和功能可用性继续分别维护自己的数据与判断逻辑。

业务实现、配置、Registry 和模型统一迁入 `CMS.Gate` 目录；CMS domain、Web adapter 和其他调用方只依赖 `CMS.Gate` facade，不直接依赖其内部子模块。

目标结构如下：

```text
GroupherServer.CMS.Gate
├── Access
│   ├── Article
│   ├── Comment
│   └── Community
├── Passport
├── PublishThrottle
└── Allow
```

四者共同回答操作准入问题：

```text
Access           组合 actor、resource、action 与其他 Gate 判断
Passport         操作者是否有权限
PublishThrottle  操作是否超过频率限制
Allow            社区或资源当前是否开放该能力
```

建议目录结构：

```text
backend/main/lib/groupher_server/cms/
├── gate.ex
└── gate/
    ├── access.ex
    ├── access/
    │   ├── article.ex
    │   ├── comment.ex
    │   └── community.ex
    ├── allow.ex
    ├── allow/
    │   └── community.ex
    ├── passport.ex
    ├── passport/
    │   ├── config.ex
    │   └── registry.ex
    ├── publish_throttle.ex
    ├── publish_throttle/
    │   └── config.ex
    └── model/
        ├── passport.ex
        └── publish_throttle.ex
```

## 模块职责

### `CMS.Gate`

`CMS.Gate` 是 CMS 操作准入的统一 context。

它的主要职责是：

- 为开发者提供单一、可发现的模块入口。
- 说明完整的准入模型和检查顺序。
- 作为 Access、Passport、PublishThrottle 和 Allow 的共同 namespace。
- 通过 `defdelegate` 暴露稳定的公共 API，隐藏内部目录和实现模块。

它不应成为包含所有判断逻辑的万能模块。具体规则仍由对应子模块拥有。

业务调用方统一使用：

```elixir
alias GroupherServer.CMS.Gate
```

调用方不直接 alias `Gate.Access`、`Gate.Allow`、`Gate.Passport` 或
`Gate.PublishThrottle`。这些子模块可以独立测试，但属于 Gate context 的内部实现边界。

Facade 的目标形状：

```elixir
defmodule GroupherServer.CMS.Gate do
  alias __MODULE__.{Access, Allow, Passport, PublishThrottle}

  defdelegate can(user, action, resource), to: Access
  defdelegate check(user, action, resource), to: Access

  defdelegate allow_thread(community, thread), to: Allow, as: :thread
  defdelegate allow_emotion(community, scope, thread, emotion), to: Allow, as: :emotion
  defdelegate allow_comment(article), to: Allow, as: :comment

  defdelegate check_passport(user, passport_action, context), to: Passport, as: :check
  defdelegate get_passport(user), to: Passport
  defdelegate stamp_passport(rules, user), to: Passport
  defdelegate erase_passport(path, user), to: Passport
  defdelegate delete_passport(user), to: Passport
  defdelegate paged_passports(community, key), to: Passport
  defdelegate all_passport_rules(), to: Passport

  defdelegate check_publish_throttle(user, opts), to: PublishThrottle, as: :check
  defdelegate log_publish_action(user), to: PublishThrottle
end
```

Facade 可以覆盖现有稳定业务入口，但不能为了隐藏子模块而导出内部查询、changeset 或测试辅助函数。

`can/3` 是读取、查询投影和 UI 预判使用的统一入口：

```elixir
Gate.can(user, :read, article)
Gate.can(user, :archive, community)

{:ok, true}       # 已完成判断，允许
{:ok, false}      # 已完成判断，不允许
{:error, reason}  # 缺少判断所需事实或查询失败
```

`check/3` 服务真正执行 command 或 mutation 的入口。它复用同一套判断，但把不允许映射为稳定
的 domain error，调用方不能只依赖前端根据 `can/3` 隐藏按钮：

```elixir
Gate.check(user, :archive, article)

{:ok, true}
{:error, :article_under_review}
{:error, :permission_denied}
```

### `CMS.Gate.Access`

Access 负责回答“这个 actor 对这个 resource 能否执行这个 action”。它是操作级组合器，不拥有
被消费的业务事实：

- 委托 Passport 判断 actor 权限。
- 委托 Allow 判断 Thread、Emotion、评论锁定等功能状态。
- 消费已经存在的资源 Lifecycle 投影；尚未建立 Lifecycle Aggregate 的资源只消费其当前事实。
- 识别 actor 与 resource 的关系，例如 Article/Comment author、Community owner 或 moderator。
- 在 `can/3` 保留 `{:ok, boolean}`，在 `check/3` 形成稳定 domain error。

不同资源的关系提取保留在 Access 内部适配器中：

```text
Gate.Access.Article     Article author 等关系
Gate.Access.Comment     Comment author 等关系
Gate.Access.Community   Community owner / moderator 等关系
```

这些适配器可以理解各自资源的数据结构，但不能修改资源，也不能成为业务调用方的新 facade。
例如，现有 GraphQL middleware 中私有的 `passport_is_owner` 推断和 Articles Read 中重复的作者
比较，迁移后应共享 Access 内部的 Article 关系判断，而不是继续在 Web 和 CMS 两层各写一次。

Access 不把 owner、author、manager 简化成一个全局角色。Author/Owner 是资源关系；manager、
moderator、reviewer 是否拥有某项操作仍由 Passport 的具体 action 规则决定。

#### Gate action 与 Passport action

Gate 对外使用表达产品操作的 atom，Passport 继续使用现有字符串 action key。两套词汇都通过
`CMS.Const` 集中定义，业务代码不能散落裸 atom/string：

```elixir
CMS.Const.gate_action(:read)
CMS.Const.gate_action(:trash)

CMS.Const.passport_action(:article_trash)
# => "article.trash"
```

Const 只拥有合法词汇，不拥有权限政策。`Gate.Access.Article/Comment/Community` 负责将具体
resource 的 Gate action 映射到 Passport action key；`Gate.Passport.Registry` 再沿用现有机制，
把 Passport action key 解析为 scope、grant、`grant_by_thread` 和 `owner_fallback`：

```text
Gate action
  :trash
     |
     | Gate.Access.Article
     v
Passport action key
  "article.trash"
     |
     | Gate.Passport.Registry
     v
scope + grant_by_thread + owner_fallback
```

Gate action 必须对应具体产品操作和已注册的 Passport action/grant。V1 不新增泛化的
`update_dashboard`，也不把 Community `:write` 解释成普通成员权限；Dashboard、Article 和
Comment 的具体写操作应分别使用已有或后续明确注册的资源 action。`Lifecycle.can_write/1`
只表示 Community 当前状态是否允许写入，不是某个 actor 的授权结果。

Access 不能直接返回底层 grant，否则会重复 Registry 已有的 thread expansion 和 owner fallback。
每个 resource/action 必须穷举测试为以下三种结果之一：映射到已注册的 Passport action、显式
声明不需要 Passport，或返回 `{:error, :unknown_action}`。所有 Gate action 和 Passport action
key 还必须分别来自 `CMS.Const`。

#### Article V1 与 V2 边界

V1 不实现 `CMS.Articles.Lifecycle`。`Gate.Access.Article` 直接消费当前已经存在的 Article 资源
事实：`TrashedArticle` membership、`article.pending`、`article.is_archived`、author relationship
和 Passport。文档中的 “Article Lifecycle” 不能被写成 V1 已存在的 Aggregate。

V2 才考虑将 Article 的归档、Trash/恢复/销毁和 Moderation Blocker 收敛到
`CMS.Articles.Lifecycle`，再由 Access 消费其资源能力投影。Draft、Publish、Snapshot 属于内容
工作流，保持现有实现，不迁入 Resource Lifecycle。

### `CMS.Gate.Passport`

Passport 负责回答“这个操作者是否有权执行该操作”。

它拥有：

- Passport 规则的读取、签发、更新和删除。
- action 到权限要求的解析。
- global、community、root、god 等权限范围判断。
- owner fallback 等资源所有者规则。

Passport 是角色和操作权限的唯一权威。`Allow` 和 `PublishThrottle` 不重复实现角色判断，也不直接解释 Passport 规则。

Web middleware 只是 Gate 的 GraphQL adapter：它提取 `cur_user`、action 和资源定位信息，并把
加载后的资源交给 `CMS.Gate.can/3` 或 `check/3`。Owner/Author 关系由 `Gate.Access` 根据真实资源
判断，middleware 不再生成 `passport_is_owner` 作为另一份关系权威。纯 Passport 管理入口仍可
通过 `CMS.Gate.check_passport/3` 判断 Passport action。

`check_passport/3` 是 Passport 专项检查，不执行 Lifecycle、Allow 或限流判断：

```elixir
Gate.check_passport(
  reviewer,
  CMS.Const.passport_action(:community_retry_setup),
  %{}
)

{:ok, true}
{:error, :permission_denied}
{:error, :unknown_passport_action}
```

`stamp_passport/2` 保留“签发或写入 Passport rule”的修改语义，不能复用为权限检查名称。

### `CMS.Gate.PublishThrottle`

PublishThrottle 负责回答“这个操作者当前是否还能继续发布”。

它拥有：

- 最短发布间隔。
- 每小时发布上限。
- 每日发布上限。
- 用户发布计数和最后发布时间等可变状态。
- 发布成功后的计数更新。

发布限流不是权限，也不是分析指标。它属于 CMS 操作准入，因此从宽泛的 `CMS.Policy` 收敛到 `CMS.Gate.PublishThrottle`。

### `CMS.Gate.Allow`

Allow 负责回答“当前社区或资源状态是否允许这个能力”。

首批职责来自现有 `CMS.CanCan`：

- `thread/2`：根据社区 Dashboard 配置判断 Thread 是否开放。
- `emotion/4`：根据系统白名单、系统默认值和社区覆盖配置判断 Emotion 是否允许。
- `comment/1`：根据文章的评论锁定状态判断是否允许评论或回复。

Allow 内部实现 API：

```elixir
CMS.Gate.Allow.thread(community, thread)
CMS.Gate.Allow.emotion(community, scope, thread, emotion)
CMS.Gate.Allow.comment(article)
```

业务调用方通过根 facade 使用：

```elixir
CMS.Gate.allow_thread(community, thread)
CMS.Gate.allow_emotion(community, scope, thread, emotion)
CMS.Gate.allow_comment(article)
```

这些函数保留带原因的 domain result，而不是使用 `?` 后缀：

```elixir
{:ok, value}
{:error, :thread_not_visible}
{:error, :emotion_not_allowed}
{:error, :article_comments_locked}
```

Elixir 中带 `?` 的函数通常返回布尔值。准入入口需要保留具体失败原因，以便调用方直接形成稳定错误，因此主 API 不使用 `thread?/2`、`emotion?/4` 或 `comment?/1`。如果未来存在纯展示或查询场景，可以额外提供布尔谓词，但不能用它们替代带错误原因的准入检查。

`comment/1` 不接收 `user`。现有 `allow_comment/2` 的 `user` 参数没有参与判断，继续保留会让人误以为这里包含角色授权。若未来需要管理员绕过评论锁定，应先明确产品规则，再由 Gate 组合 Passport 结论和资源状态，而不是留下一个未使用参数。

## 配置与规则所有权

Passport、PublishThrottle 及其 Config、Registry、Model 属于 Gate 自身实现，应随实现迁入 Gate。统一 namespace 仍不意味着把所有事实来源的数据模型都搬进 Gate。

`CMS.Model.Embeds.Dashboard.Enable` 仍然属于 Dashboard 配置，因为它描述社区开启了哪些产品能力。`CMS.Gate.Allow` 读取这些配置并作出准入判断，但不拥有 Dashboard 配置的写入和持久化。

同样：

- Passport 规则由 `CMS.Gate.Passport` 拥有。
- 发布限流记录由 `CMS.Gate.PublishThrottle` 拥有。
- Thread 和 Emotion 的系统默认值仍由 CMS Artiment 配置提供。
- 文章评论锁定状态仍由文章模型拥有。

Gate 拥有的是“如何根据这些事实作出准入结论”，而不是所有事实本身。

## 与 Community Lifecycle 的关系

Community Lifecycle 适合接入 Gate，但不适合迁入 Gate。

二者回答的是两类不同问题：

```text
Lifecycle：Community 现在处于什么状态，如何转换到下一状态？
Gate：这次操作在当前上下文中能否执行？
```

`CMS.Communities.Lifecycle` 是 Community 长期状态的 owner，负责：

- `setting_up/setup_failed/active/read_only/suspended/archived/scheduled_reclaim/destroy` 等状态。
- Lifecycle Blocker 的创建、释放和组合。
- 状态转换、并发控制、Audit 与回收流程。
- 将当前状态投影为 `can_read/can_write/can_manage/can_reclaim` 等资源能力；其中
  `can_write/1` 只表达状态能力，Gate action 仍需映射具体 Passport rule。

`CMS.Gate.Allow` 不保存或转换 Lifecycle 状态。`Gate.Access` 在操作准入时组合 Lifecycle 能力、
Passport、资源关系和必要的 Allow 结果；`Gate.check/3` 再将“不允许”映射为稳定的 domain error。

例如，Lifecycle 先根据当前状态和 Blocker 投影资源能力，Gate 再把能力结果解释为本次操作的准入结果：

```text
Lifecycle.can_write(community)
          |
          v
     {:ok, false}
          |
          v
Gate.can(user, :archive, community)
          |
          v
     {:ok, false}

Gate.check(user, :archive, community)
          |
          v
{:error, :permission_denied}
```

Actor 权限仍然由 `CMS.Gate.Passport` 判断，actor 与 resource 的关系由 `Gate.Access` 内部适配器
判断。Access 负责组合结论，但不能取代各事实来源的权威：

```text
Gate.Passport          Gate.Access.*          Resource Lifecycle       Gate.Allow
actor 是否有权限       actor 与资源的关系       当前状态是否允许          功能是否开放
       |                      |                        |                     |
       +----------------------+------------------------+---------------------+
                                      |
                                      v
                              Gate.can / Gate.check
```

因此，Lifecycle 与 Gate 的关系是“状态权威与准入消费者”，不是父子模块关系：

```text
CMS.Communities.Lifecycle   # 状态、Blocker、转换、能力投影
CMS.Gate                    # 公共 facade，形成操作准入结论
CMS.Gate.Access             # 内部组合 actor、resource、action 与各项判断
CMS.Gate.Allow              # 内部判断功能状态
CMS.Gate.Passport           # 内部检查 actor 权限
```

### Lifecycle 不作为 Gate 子模块的理由

#### 1. Lifecycle 是状态权威，不是检查器

`CMS.Gate.Lifecycle` 会让人误以为 Lifecycle 只是 Gate 的一种准入检查。实际上，Lifecycle 是独立的状态机和 Aggregate：它保存当前状态，管理 Blocker，执行带锁转换，并负责 Audit；V1 不把后续 Job 纳入核心状态机制。

Gate 不拥有这些状态，也不能直接改变被判断对象。Gate 只根据已有事实作出一次操作是否准入的结论。

#### 2. 避免把状态写入与准入判断放进同一个边界

如果 Lifecycle 成为 Gate 子模块，同一个 namespace 会同时出现：

```text
Gate.Allow       判断操作是否可以执行
Gate.Lifecycle   修改状态、创建 Blocker、安排回收
```

这会模糊“谁产生状态”和“谁消费状态”的依赖方向，也容易让普通准入路径绕过 Lifecycle transition facade 直接改状态。

正确方向只能是 Lifecycle 先产生可靠状态和能力投影，Gate 再消费它；Gate 不能反向驱动 Lifecycle 转换。

#### 3. Lifecycle 服务的不只是普通 CMS 准入

Lifecycle 还有多类状态转换调用方：

```text
Community Application / Setup
Billing
Moderation
Owner archive / restore
Reclaim Job
Audit
Ops
```

这些模块调用 Lifecycle 是为了创建或释放 Blocker、执行状态转换、恢复或销毁 Community，并不是在检查一次普通 CMS 操作能否通过。把 Lifecycle 放进 Gate 会错误地把整个 Community 长期状态领域降格为准入功能的内部实现。

完整依赖方向是：

```text
Apply / Billing / Moderation / Owner / Ops
                    |
                    v
       CMS.Communities.Lifecycle
          状态与转换的唯一权威
                    |
                    v
            Lifecycle 能力投影
                    |
                    v
                CMS.Gate
          facade -> Gate.Access
                    |
                    v
               CMS 操作
```

因此，两份文档放在同一个 `docs/community` 目录并相互引用，但代码模块不形成 `CMS.Gate.Lifecycle` 父子关系：

```text
Lifecycle 决定资源是什么状态以及该状态原则上允许什么；
Gate 再结合 actor 与资源关系、Passport 和其他准入条件决定操作能否通过。
```

公开列表和搜索仍应使用 `CMS.Communities.Read.scope/1` 在 SQL 层过滤，不能逐行调用 Gate。Dashboard、Reviewer、Setup Job 和运维命令等显式操作，才根据各自语义组合 Passport 与 Lifecycle 能力检查。

### 读取与输出

默认列表和搜索必须通过 SQL scope 过滤，不能把每一行加载后再调用 `Gate.can/3`。单条读取需要
支持 Owner、Author、Manager 或 Reviewer 查看受限资源时，由领域 Read 在加载判断所需的最小
上下文后调用 Gate：

```text
Articles.read(..., user)
          |
          v
查询 Article、author 与 Lifecycle
          |
          v
Gate.can(user, :read, article)
          |
     +----+----+
     |         |
 {:ok, true} {:ok, false}
     |         |
 返回内容    对外 Not Found
```

Lifecycle 不识别 `user`，Resolver 也不自行判断 owner/manager。Resolver 只把 `cur_user` 交给
CMS Read；Read 调用 Gate 完成最终可见性判断。Gate 只决定能否返回，不负责拼接 GraphQL Meta
或前端 Banner 文案。允许读取后，领域 Read/GraphQL 可以通过现有 Meta 输出当前 viewer 可见的
稳定状态代码和提示数据；被拒绝的访问不能返回资源内容、内部 Blocker 或审核原因。

## 调用流程

一次需要权限和限流的发布操作大致经过：

```text
GraphQL mutation
      |
      v
Authorize
  确认已经登录
      |
      v
FrontDesk / CMS Read
  加载 Community / Article 等必要上下文
      |
      v
Gate.check(user, action, resource)
  Access 组合 Passport、资源关系、Lifecycle 和 Allow
      |
      v
Gate facade -> PublishThrottle
  需要发布限流时检查间隔、小时上限、每日上限
      |
      v
CMS domain
  执行写入
      |
      v
Gate facade -> PublishThrottle
  发布成功后记录本次操作
```

读取社区文章时，Allow 在领域读取之前检查 Thread：

```text
Articles.Read / Articles.List
      |
      v
Gate.allow_thread
      |
      +-- disabled --> {:error, :thread_not_visible}
      |
      `-- enabled ---> 查询文章
```

进行评论或 Emotion 操作时，Allow 使用加载后的真实资源状态：

```text
FrontDesk
  加载 Article / Comment / Community
      |
      v
Gate.allow_comment / Gate.allow_emotion
      |
      +-- denied ---> 返回具体 domain error
      |
      `-- allowed --> 执行数据库事务和后续事件
```

不同检查不要求每次全部执行。读取文章不需要 PublishThrottle，普通用户发布内容不一定需要额外 Passport grant，评论锁定也必须等文章加载后才能判断。Gate 提供统一归属，但调用方仍按实际操作选择所需检查。

对需要同时判断 actor、资源关系和 Lifecycle 的操作，调用方统一使用根 facade：

```text
GraphQL mutation / CMS command
          |
          v
加载 action 所需的 resource 上下文
          |
          v
Gate.check(user, action, resource)
          |
          +-- denied --> 稳定 domain error
          |
          `-- allowed -> 调用领域 command
```

例如 V1 Article 正在整改时，author 是否仍可编辑、是否可以评论、归档或永久删除，都由同一个
调用形状表达：

```elixir
Gate.can(user, :read, article)
Gate.check(user, :edit, article)
Gate.check(user, :comment, article)
Gate.check(user, :archive, article)
```

V1 Access 消费 Article 当前的 Trash、`pending`、`is_archived` 等资源事实，并组合 Article author
关系和 Passport；V2 才改为消费 `CMS.Articles.Lifecycle`。资源状态允许某项操作不代表当前 actor
有权限；Passport 允许某项操作也不代表资源当前状态允许，最终必须同时满足。

## Web 层边界

GraphQL middleware 保持 adapter 身份，不成为业务规则权威：

```text
GroupherServerWeb.Middleware.Passport
  -> 迁移期兼容 CMS.Gate.check_passport

Resource resolver / middleware
  -> 加载 resource
  -> CMS.Gate.can / CMS.Gate.check

GroupherServerWeb.Middleware.PublishThrottle
  -> CMS.Gate.check_publish_throttle
```

是否进一步合并为单个 `Middleware.Gate` 不属于本次方案。不同操作需要的检查和上下文加载时机不同，先统一业务 namespace，避免为了表面上的单一 middleware 把执行顺序隐藏起来。

## 建议迁移

模块迁移目标：

```text
CMS.Communities.Passport      -> CMS.Gate.Passport
CMS.CommunityApplications.ReviewAuth
                              -> CMS.Gate.Passport
CMS.Policy.PublishThrottle    -> CMS.Gate.PublishThrottle
CMS.CanCan                    -> CMS.Gate.Allow
CMS.CanCan.Communities        -> CMS.Gate.Allow.Community
Helper.PermissionRegistry     -> CMS.Gate.Passport.Registry
Helper.PermissionConfig       -> CMS.Gate.Passport.Config
CMS.Model.Passport            -> CMS.Gate.Model.Passport
CMS.Policy.Config             -> CMS.Gate.PublishThrottle.Config
CMS.Policy.Model.PublishThrottle
                              -> CMS.Gate.Model.PublishThrottle
```

API 迁移目标：

```text
CanCan.allow_thread/2         -> Gate.allow_thread/2
CanCan.allow_emotion/4        -> Gate.allow_emotion/4
CanCan.allow_comment/2        -> Gate.allow_comment/1
Communities.get_passport/1    -> Gate.get_passport/1
Communities.stamp_passport/2  -> Gate.stamp_passport/2
CommunityApplications.ReviewAuth.authorize/2
                              -> Gate.check_passport/3
Policy.load_publish_throttle/1
                              -> Gate.check_publish_throttle/2
Policy.log_publish_action/1   -> Gate.log_publish_action/1

新增统一操作准入入口：

Gate.can(user, action, resource)
Gate.check(user, action, resource)
```

`ReviewAuth.authorize/2 -> check_passport/3` 有意增加显式运行时 context，并将原来的 grant 字符串
参数改为 `CMS.Const` 中注册的 Passport action key。global action 传空 map；community/thread 等
动态上下文只在对应 action 需要时传入，scope 仍由 Registry 决定，调用方不能覆盖。
`check_passport/3` 只检查 Passport；普通资源操作优先使用 `Gate.can/3` 或 `check/3`。

`load_publish_throttle/1 -> check_publish_throttle/2` 也不是单纯 arity 重命名。新增的 `opts` 用于
接收 interval/hour/day 覆盖值；当前 Web middleware 中的 record load/reset 和三项限制判断一起
迁入 `Gate.PublishThrottle`。

TODO(V2)：评估 `PublishThrottle.check/2` 是否统一为 `{:ok, boolean}`。当前 V1 保留
`{:ok, :publish}`，因为它是独立的发布频率检查合同，不属于资源 `Gate.can/3` 的 boolean 合同。

`CMS.Policy` 当前只有 PublishThrottle 一个真实子域。完成迁移后应移除这个空泛 facade，避免同时存在 `CMS.Policy` 和 `CMS.Gate` 两个看似都负责操作规则的入口。

迁移时还需要同步：

- GraphQL middleware 对业务模块的调用。
- Articles 和 Comments 中的 CanCan 调用。
- Passport 管理和 Moderator 相关调用。
- 在 `CMS.Const` 增加 Gate action 与 Passport action key，并让 Access 映射和 Passport Config
  共同消费；补齐 action 穷举、Registry 存在性和 unknown action 测试。
- 模型、配置、测试辅助函数和测试模块名称。
- 模块文档及 `docs/reorg_be_modules.md` 中旧的 `CMS.Policy` 边界描述。

这是模块和调用边界重构，不改变现有数据库表、Passport 规则格式、GraphQL error code 或 GraphQL
公开行为；内部 ReviewAuth/Passport 返回合同按上述目标统一。

## 非目标

本方案不做以下事情：

- 不把 Passport、PublishThrottle 和 Allow 合并为一个实现文件。
- 不让 Access 成为新的状态或权限权威；它只组合其他模块的判断结果。
- 不让 `CMS.Const` 拥有 action 到权限的映射政策；Const 只集中合法词汇。
- 不让 Allow 解析角色和权限。
- 不让 Passport 读取 Dashboard Enable 或文章评论锁定状态。
- 不把 `CMS.Communities.Lifecycle` 迁入 `CMS.Gate`。
- 不让 Gate 直接更新 Lifecycle state 或 Blocker。
- 不把 Web middleware 搬进 CMS domain 目录；middleware 继续作为 Gate 的协议 adapter。
- 不通过根 facade 导出 `mock_publish_throttle_attr/3` 等测试辅助函数。
- 不把发布限流重新归入 Analysis 或 Audit。
- 不用 Gate 替代 `FrontDesk` 的上下文加载职责。
- 不在本次重构中修改具体权限、限流或社区开关规则。

## 设计原则

- 所有 CMS 操作准入能力都应优先在 `CMS.Gate` 下寻找。
- 子模块按判断依据拆分，而不是按 GraphQL mutation 拆分。
- Passport 是权限权威，Lifecycle 是资源状态权威，Allow 解释功能状态，PublishThrottle 是频率
  状态权威，Access 只形成操作级组合结论。
- Gate 统一概念和可发现性，但不隐藏必要的检查顺序和资源加载过程。
- `can/3` 统一返回 `{:ok, boolean} | {:error, reason}`；`check/3` 为执行入口返回带稳定原因的
  domain result，避免把错误解释分散到调用方。
