# ArticleCommunity `inner_id` Fix

> 状态：已完成。R1–R5 数据归属、显式 binding context、`Articles.Bindings` API、旧
> `Articles.Communities` 删除、物理表改名和 tracked-files 命名门禁均已落地。
> 当前运行时代码已完成 `ArticleCommunity → ArticleBinding` Schema、
> `ArticleResult → ArticleView` DTO、FrontDesk 单/批量路径读取、`get/1` 删除和物理存储 rename。
> 历史 migration 与迁移文档仍可保留旧数据库对象名作为来源说明。
> `ArticleCommunity` 未暴露为 GraphQL 类型，GraphQL schema 无需改动。
>
> 本文修复公共路径编号与 ArticleCommunity 关系归属不一致的问题。项目不要求保留历史
> 数据，实施时直接切换到目标模型，不增加双写、shadow read、backfill 或长期兼容层。
>
> Binding 命名、FrontDesk 路径边界与物理表重命名已单列在
> [`Article Binding 命名与存储重构`](../../migrations/article-binding-naming-and-storage.md)，本文继续作为
> `inner_id` 数据归属和 R1–R5 迁移合同的主文档。

术语约定：本文在描述迁移前实现和历史数据库对象时保留 `ArticleCommunity`；描述当前领域模型、
目标合同和新增代码时统一使用 `ArticleBinding`。本文合同中的字段和返回值统一使用 `binding`；
ArticleBinding 相关运行时命名已统一为 `binding`；`relationship` 等非 ArticleBinding 语义的通用词不属于
本次 rename 范围。

当前实现已完成绑定编号的写入与主要公共读取切换：`ArticleBinding.inner_id` 由 Community
counter 分配，发布、mirror、move 使用绑定编号，FrontDesk（含有界批量读取）、普通列表、Kanban、
Search、Press、Stats、Interaction、Comments、Mentions、异步事件和 Outbox payload 都使用显式
ArticleBinding context。`Article.community_id`、`Article.inner_id` 和 `ArticleView.community_id`
已从运行时模型中移除；旧 preload/fallback join 也已清理。路径批量读取已迁入
`CMS.FrontDesk.articles/1`，原 `Articles.PathResolver` 已删除。具体分批合同和验收证据见 §8。

## 1. 问题

迁移前公共编号保存在 `Article`：

```text
Article
├── community_id
└── inner_id
```

但一篇 Article 可以通过多个 `ArticleCommunity` 出现在多个 Community 中：

```text
Article A
├── ArticleCommunity(A, Home)
└── ArticleCommunity(A, Mobile)
```

迁移前行为存在三个问题：

1. `mirror` 只新增 Mobile ArticleCommunity 关系，不给 Mobile 分配编号；Mobile 复用
   `Article.inner_id`。
2. `move` 修改 Article 的 `community_id` 和 `inner_id`，把稳定 Article 身份和当前 URL
   锚点绑在一起。
3. Path Resolver 按 `relation.community_id + article.inner_id` 查询，但数据库没有保证
   镜像 Article 在目标 Community 内的编号唯一。

因此迁移前实现既不是可靠的共享编号模型，也不是独立 ArticleCommunity 编号模型。

## 2. 目标模型

公共编号属于具体的 `ArticleBinding`，而不是稳定的 `Article`：

```text
Article
├── id          稳定内容身份
├── thread
├── lifecycle
└── moderation

ArticleBinding
├── id
├── article_id
├── community_id
├── inner_id    Community 内公共编号，可为空直到 binding 公开
├── visible
└── timestamps
```

同一篇 Article 在不同 Community 中拥有不同编号：

```text
Article A
├── Home ArticleBinding:   inner_id = 12
├── Mobile ArticleBinding: inner_id = 37
└── Design ArticleBinding: inner_id = 8
```

对应路径为：

```text
/home/post/12
/mobile/post/37
/design/post/8
```

`Article` 不再承担公共路径的 `community_id` 或 `inner_id`。`Article.id` 仍是 Comment、
Interaction、Stats、Activity、Revision 等共享事实的稳定外键。

## 3. 编号约束

本 fix 采用 Community-wide 编号，而不是 Community + thread 分开编号：

```text
UNIQUE(article_id, community_id)
UNIQUE(community_id, inner_id) WHERE inner_id IS NOT NULL
```

Community-wide 编号避免把 `thread` 冗余复制到 `ArticleBinding`，也避免跨表 join 无法
表达唯一约束的问题。URL 仍保留 `thread`，但编号在同一 Community 内不重复。

编号分配必须在同一事务内锁定 Community counter、写入 binding、推进 counter。发布前
的 binding 可以暂时没有 `inner_id`；binding 公开时必须先分配编号，再产生依赖该路径
的 Projection、Search 或 PublicCache 事件。

## 4. 命令语义

### 4.1 Create / Publish

```text
create Article
  -> create ArticleBinding
  -> binding 公开时分配 ArticleBinding.inner_id
```

### 4.2 Mirror / Add

```text
mirror(article, Mobile)
  -> lock stable Article and target Community
  -> insert ArticleBinding(article, Mobile)
  -> allocate Mobile.inner_id
  -> write Mobile-local tags (pin/Kanban require explicit later commands)
```

Mirror 不修改 Article 的稳定字段，也不持久化 `home` / `mirror` role。

### 4.3 Move

Move 是目标 ArticleBinding 添加与来源 binding 删除的原子组合：

```text
move(article, Home, Mobile)
  -> create Mobile ArticleBinding and allocate Mobile.inner_id
  -> apply explicit local-data policy
  -> delete Home ArticleBinding
```

Move 不修改 Article.id、Revision、Comment、Interaction 或其他 Article-global facts。
Move 的 source Community 必须由调用方显式传入；命令不得从 `Article.community_id` 推导 source。
本阶段 local-data policy：source binding 的 tags、pin、KanbanState 显式删除且不复制到 destination；
destination tags 由 move 参数写入，pin/Kanban 由后续显式命令设置。

### 4.4 Unmirror / Remove

```text
unmirror(article, Mobile)
  -> delete ArticleBinding(article, Mobile)
  -> cascade Mobile-local tags / pin / Kanban state
  -> keep Article and other ArticleBindings
```

路径合同切换后不再依赖 `Article.community_id` 的临时删除守卫。删除已发布 Article 的
公开 binding 时，必须检查删除后仍至少保留一个公开 binding；目标 binding 若为 hidden
或 `inner_id` 为空，则不触发该守卫。不能通过隐含的 home 角色表达。

## 5. 读取与副作用

### Public Path

FrontDesk 的公共路径读取必须使用：

```text
binding.community_id = requested_community
binding.inner_id     = requested_inner_id
article.thread        = requested_thread
```

`CMS.Helper.ArticlePath` 是共享的纯 parse/validate helper，不访问数据库，也不查询 binding；
Passport middleware、resolver、FrontDesk 和其他边界可以复用它规范化 `ArticlePathInput`。
FrontDesk 独占公共路径的 Community/ArticleBinding/Article lookup、Article 加载与 thread 校验，
并组装 ArticleView。
GraphQL Article、List、Detail、Search、Feed、Press 和 PublicCache 都从明确的 ArticleBinding
context 读取公共 `inner_id`。binding lookup 不下沉到 `Articles.Bindings`，也不引入 binding
locator 查询 API、`Articles.Path` 或 `Articles.PublicPath` 领域模块。

### Community-local facts

以下数据继续以 `article_binding_id` 为外键：

```text
ArticleBinding
├── ArticleBindingTag
├── PinnedArticle
├── KanbanState
├── Dependency / Schedule（后续能力）
└── 其他 Community-local projection
```

Kanban 状态不因 mirror 或 move 自动复制到其他 ArticleBinding；Move 的局部数据保留、复制或
清理策略必须由命令显式决定。

## 6. 实施顺序

1. 在关系记录（当前领域名 `ArticleBinding`）增加 nullable `inner_id`，增加 Community-wide counter
   和唯一约束。
2. 将 Numbering owner 从 stable Article 改为 target ArticleBinding / Community counter。
3. 修改 create、publish、mirror、move、unmirror，使所有路径编号写入 ArticleBinding。
4. 修改 FrontDesk、GraphQL、List、Detail、Search、Feed、Press 和 PublicCache，使读取统一使用
   ArticleBinding `inner_id`；批量读取调用方统一经过 `CMS.FrontDesk.articles/1`。
5. 删除 `Article.community_id`、`Article.inner_id` 作为公共路径字段及其相关兼容代码。
6. 删除当前 `Article.community_id` 路径锚点守卫，补充 published ArticleBinding 不变量。
7. 更新测试、GraphQL contract、seed、fixture 和源级文档。（已完成）

不在本 fix 中引入 `ArticleCommunity.role`、`home` 特殊关系、双写、shadow read、历史
backfill 或 UUID public locator。

## 7. 验收

- 同一 Article 在两个 Community 中可以同时存在，且拥有不同 `inner_id`。
- 同一 Community 内任何两个公开 ArticleBinding 不得拥有相同 `inner_id`。
- Mirror 不修改 stable Article 的公共路径字段，因为这些字段已不存在。
- Move 只改变 ArticleBinding 集合，不改变 Article.id、Revision、Comment 或 Interaction。
- Unmirror 只删除目标 ArticleBinding 及其局部数据，不影响其他 bindings。
- 已发布 Article 删除公开 binding 时，删除后至少保留一个公开 binding；删除 hidden 或
  `inner_id` 为空的 binding 不触发该检查。
- Unmirror 在同一事务内先锁定 Article 行，再统计公开 binding，串行化同一 Article 的并发删除。
- FrontDesk 能分别解析 `/home/post/12` 与 `/mobile/post/37` 到同一个 Article，并组装对应
  ArticleView。
- 两个 Community 的 Kanban status、tags、pin、dependency 和 schedule 互不串写。
- 所有业务 API 遵循 `{:ok, value}` / `{:error, reason}` 返回协议。

## 8. ArticleBinding context 迁移计划

### 8.1 统一上下文合同

公共路径相关代码不得再从裸 `Article` 推导 Community 或 `inner_id`。FrontDesk、写入命令和事件优先接收显式
binding 上下文，或传入已经 materialize 的 ArticleView：

```elixir
%{article: %Article{}, community: %Community{}, binding: %ArticleBinding{}}
%ArticleView{article_id: article.id, community: community, inner_id: binding.inner_id}
```

规则：

- `Article.id` 只表示稳定内容身份；`ArticleBinding.community_id` 和
  `ArticleBinding.inner_id` 是公共路径唯一来源。
- 公共路径和 binding-local 命令永远要求显式 Community/binding 参数，不得根据 binding 数量猜测
  Community，也不得回退到 `Article.community_id` 或 `Article.inner_id`。不保留单 binding 兼容路径；
  `Bindings.get_with_context/1` 与 `resolve_unambiguous/1` 必须删除。
- 事件、Search、Press、Stats、Interaction 和 ViewTracker payload 必须携带 binding 上下文；只需要
  稳定内容身份的事实才允许只携带 `article_id`。
- mirror/move 必须分别读取目标 binding，禁止复用 source binding 的 `inner_id`。

### 8.2 分批迁移顺序

每一批都先迁生产代码，再迁测试/fixture，最后推进下一批；不得通过双写或 shadow read 掩盖
缺失的关系上下文。

#### R1：公共读取和投影

范围：FrontDesk（包括 DocBranch 分支）、Article list/detail、Kanban query、Search、Press、Snapshot。

验收：public locator 使用 `community_id + thread + binding.inner_id`；Search、Press、Snapshot
输出都能定位到明确 ArticleBinding；同一 Article 在两个 Community 中生成不同 locator 的回归
测试通过；生产代码不再从 Ecto Article 直接读取 `inner_id` 构造公共路径。

#### R2：统计、Interaction 与 ViewTracker

范围：ArticleStats、ReadState、upvote/collect、view receipt、Interaction event、viewer state。

验收：统计仍按 `{thread, article_id}` 聚合，但公共返回显式使用目标 binding；mirror Article 的不同
Community 不共享错误 path/innerId；相关 mutation result、event、query tests 通过。

#### R3：Comments、Mentions 与异步事件

范围：Comment writer/commands、Comment result、Artiment Mentions、Activity、通知和 Outbox payload。

验收：Comment 编号、通知路径和 mention context 来自显式 binding；异步 Job 用稳定 Article id 加载
当前 binding 并重新确认 authority；comment/mention/activity/notification tests 通过。

#### R4：Article 写入和发布链路

范围：Article writer、publish、draft、moderation、DocTree/DocCover、Press invalidation、Search
enqueue，以及 Publish Target 的 binding lookup、compat `inner_id` 写入和 publish Outbox payload。

验收：create/publish/mirror/move/unmirror 的绑定编号统一由 ArticleBinding owner 负责；move 的
source 必须是显式参数，facade 与 `Articles.Communities` 都不得读取 `Article.community_id`；Gate
需要 Community 时显式接收 canonical Community；move/unmirror 不留下错误旧路径事件；Article
旧字段的生产运行时引用归零。publish target 不再把 `locked_article.inner_id` 写回 compat 字段，
binding lookup、publish Outbox event 和 invalidation payload 均使用显式 ArticleBinding context。
`Numbering.assign_binding_inner_id/1` 的所有调用点都必须位于事务边界内，并有回归测试保护。

#### R5：删除兼容字段

仅在 R1–R4 全部通过后执行：

1. 删除 Article schema 的 `community_id`、`inner_id`；
2. 删除 `ArticleView.community_id` 兼容字段、旧 preload/fallback join 和旧 fixture 字段；
3. 增加 migration/compile grep 门禁，禁止新代码重新读取旧字段；
4. 更新 GraphQL contract、seed、fixture、文档和回归测试。

### 8.3 每批固定验证

```text
mix format --check-formatted <changed files>
mix compile --warnings-as-errors
mix test <affected focused tests>
pnpm docs:check
git diff --check
```

验收报告必须列出已迁移模块、仍保留的旧字段引用、失败测试和下一批入口。没有 binding 上下文的
模块不得标记为“已完成”。

### 8.4 收口结果

R1–R5 的数据归属迁移主体已经落地。本轮已完成的收口包括：

1. `CMS.Helper.ArticlePath` 保留为共享纯 parse/validate helper；批量 binding/database lookup
   已迁入 `CMS.FrontDesk.articles/1`，`Articles.PathResolver` 已删除；没有新增
   `Articles.Path`、`Articles.PublicPath` 或 binding locator 查询 API。
2. Move 的失效事件分别使用 source/destination binding 的 `inner_id`，并有不同编号回归测试。
3. Publish 在 multi-binding Article 上要求显式 Community，不再从裸 Article 猜测唯一 Community。
4. published Article 的删除守卫只统计 `visible=true` 且已分配 `inner_id` 的公开 binding。
5. FrontDesk ordinary/Doc 单路径与批量路径均有直接回归测试。

已完成的命名与存储主体：

1. 阶段 3 已迁移全部 `Bindings.get/1` 调用，删除 `get_single_binding/1` 和 `get/1`。
   同批将内部错误 atom 收口为 `:article_binding_context_required`、
   `:article_binding_not_found` 和 `:source_article_binding_not_found`；这些 atom 未进入
   ErrorCat、GraphQL 或 frontend 合同。
2. `CMS.Articles.Commands.StateChange` 的 Doc `sink/undo_sink`、`States.set_status/2` 和
   `CMS.Articles.Writer.notify_admin_new_article/1` 已停止调用旧 `Bindings.get/1`。
3. 阶段 4 已执行物理表、join 字段、FK、PK、唯一索引和约束名 rename；运行时 schema/query/fixture
   与 migration 同 release 切换。
4. 阶段 5 已收口 Gate、FrontDesk、Stats、Metric、Factory 等语义名称，并将 ArticleBinding 相关
   runtime map、payload 和局部变量的 `relation` 统一为 `binding`；移除旧 UUID tag fallback 后
   直接删除 `legacy_article_community/1`。

阶段 3–5 的最终收口也已完成：

1. `Bindings.get_with_context/1`、`resolve_unambiguous/1` 和所有单 binding 猜测路径已删除；调用方使用
   显式 Community/ArticleBinding context，不保留兼容中间层。
2. `Bindings.all/1`、`Bindings.Tags.list/1` 和 `Bindings.Tags.replace/2` 已实现并覆盖测试。
3. 旧 `Articles.Communities` 的写入口已按现有 Command 体系收口为
   `Articles.Commands.Mirror/Move/Unmirror/Pin/Unpin`；`CMS.Articles` 只保留薄 facade。
   `pin/unpin` 的容量检查与 `PinnedArticle` 持久化是对应 Command 的内部实现，不再暴露
   `Articles.Pins`；binding tags 仍由 `Articles.Bindings.Tags` 负责。
4. `ArticleBindingTag` 复合唯一约束显式绑定 `article_binding_tags_pkey`，重复插入返回 changeset
   错误。
5. tracked-files 命名门禁已接入 `docs:check`；历史 migration 和迁移文档通过显式白名单保留来源名。

关系与置顶写命令统一要求调用方提供 `command_id`。GraphQL 的 `mirror_article`、`move_article`、
`unmirror_article`、各 thread 的 `pin_*` 与 `undo_pin_*` mutation 均将 `command_id: ID!` 传入
`CMS.Command`；receipt replay 不重复执行 Gate 后的数据库写入和副作用。

## 9. 后续命名重构合同

后续命名、FrontDesk 路径边界、`Articles.Bindings` 目标 API 和物理存储重命名，统一以
[`Article Binding 命名与存储重构`](../../migrations/article-binding-naming-and-storage.md) 为准，
本文不再复制其阶段状态和 API 清单。

命名重构不得改变本文件确立的数据归属：`ArticleBinding.inner_id` 仍是公共路径编号的唯一来源，
`Article.id` 仍是 Article-global facts 的稳定身份；也不得恢复 `Article.community_id`、
`Article.inner_id`、ArticleView fallback 或从裸 Article 推导 Community 的代码。
