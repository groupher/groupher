# Article Binding 命名与存储重构

> 状态：已完成。运行时 Schema/DTO、`relation → binding`、FrontDesk 路径边界、显式 binding
> context、`Articles.Bindings` API、旧 `Articles.Communities` 拆分删除、物理表 rename migration
> 和 tracked-files 命名门禁均已落地。
>
> 本文承接 [ArticleCommunity `inner_id` Fix](../feature/article/article-community-inner-id-fix.md)，只记录
> Binding 相关的运行时命名、模块边界和数据库对象重命名。`inner_id` 从 Article 迁移到关系记录的
> R1–R5 合同仍以原文档为准。

## 1. 背景

`ArticleCommunity` 这个名字最初准确描述了 Article 与 Community 的关系，但现在这条记录还承担了
Community-local 的编号、标签、置顶、Kanban 等绑定状态。继续把它称为 `ArticleCommunity`，会让调用方
误以为它只处理 Community，而无法表达“Article 在不同公共上下文中的一条绑定记录”。

同时，运行时名称、物理表名称和历史 API 名称目前不一致：

```text
历史运行时名称   ArticleCommunity / ArticleCommunityTag / ArticleResult
当前物理对象     article_communities / article_community_tags
目标运行时名称   ArticleBinding / ArticleBindingTag / ArticleView
目标物理对象     article_bindings / article_binding_tags
```

这次重构不改变数据归属，也不重新设计 Article 的稳定身份。它只把已经确立的 binding 模型用一致名称
表达出来，并把路径解析边界放回 FrontDesk。

## 2. 目标边界

```text
CMS.Helper.ArticlePath
  └── 共享纯 parse / validate，不访问数据库

FrontDesk
  ├── 接收共享 ArticlePath 规范化后的公共路径
  ├── binding / database lookup
  ├── 加载 Article 并校验 thread / Community
  └── 组装 ArticleView

Articles.Bindings
  ├── 查询 ArticleBinding
  ├── 查询 Article 的全部 bindings
  └── 管理 binding 下的 Tags

Articles.Commands.Mirror / Move / Unmirror / Pin / Unpin
  ├── 复用现有 CMS.Command receipt / replay 机制
  ├── 通过 Gate 执行授权后的 binding 写入
  └── pin 容量检查属于 Commands.Pin 内部步骤，不单独暴露 Pins API

Article
  └── 只保存稳定内容身份和 Article-global facts

ArticleBinding
  └── 保存 Article 在一个公共上下文中的 Community-local 状态
```

`CMS.Helper.ArticlePath` 保留为共享纯 parser，负责 `ArticlePathInput` 的 parse/validate 和 resolver /
middleware 参数规范化；它不访问 Repo，也不查询 ArticleBinding。这里的 public locator 指 transport
输入形状，不代表对外暴露 binding locator 查询 API。

`Articles.Bindings` 不负责路径解析，也不引入 `PublicPath`、`Articles.Path` 或 binding locator
查询 API。
公共路径的 binding/database lookup 归 FrontDesk。批量路径读取已由
`CMS.FrontDesk.articles/1` 承接，原 `Articles.PathResolver` 已删除。
旧 `Articles.Communities` 同时混合 binding 生命周期、pin、tag 和查询职责，必须在调用方迁移后删除；
不保留 alias、转发函数或兼容 facade。

目标调用关系：

```text
FrontDesk.article(path)
  -> CMS.Helper.ArticlePath.parse / validate
  -> Community
  -> ArticleBinding
  -> Article + thread validation
  -> ArticleView

Articles.Bindings.get(article, community)
  -> explicit ArticleBinding context (`binding` + `community`)

Articles.Bindings.all(article)
  -> [ArticleBinding]
```

## 3. 运行时命名

### 3.1 Schema 与 DTO

```text
ArticleCommunity       -> ArticleBinding
ArticleCommunityTag    -> ArticleBindingTag
ArticleResult          -> ArticleView
relation               -> binding
```

含义保持不变：

- `Article` 是稳定内容身份，Comments、Stats、Interaction、Revision 等共享事实继续使用
  `article_id`。
- `ArticleBinding` 是一篇 Article 在一个 Community 中的绑定记录，负责该上下文的 `inner_id` 和
  Community-local 状态。
- `ArticleView` 是面向 GraphQL、Search、Press、Snapshot 和 Outbox projection 的公共读取 DTO，
  不再从裸 Article 推导 Community 或 `inner_id`。

### 3.2 查询 API

目标 API 使用返回值表达“返回什么”，不使用含义模糊的 `one`、`for_article` 或 `from_path`：

```elixir
Articles.Bindings.get(article, community)
  # 返回指定 Article 在指定 Community 中的 ArticleBinding

Articles.Bindings.all(article)
  # 返回该 Article 的全部 ArticleBinding

Articles.Bindings.Tags.list(binding)
  # 返回指定 binding 的 tags

Articles.Bindings.Tags.replace(binding, tag_ids)
  # 替换指定 binding 的 tags
```

`get/2` 返回显式 ArticleBinding context（包含 `binding`、`community` 和 `inner_id`）；需要 Article
与 binding 组成公共读取结果时，由 FrontDesk 组装 `ArticleView`。所有业务函数遵循
`{:ok, value}` / `{:error, reason}` 返回协议。

`Articles.Bindings.get/1`、`get_single_binding/1`、`get_with_context/1` 和
`resolve_unambiguous/1` 全部删除。所有调用方必须携带显式 `Community` 或 `ArticleBinding` context；
不得通过 binding 数量猜测 Community，也不保留单 binding 兼容路径。

### 3.3 语义错误名与内部命名分批

以下三类名称必须分开处理：

| 类别            | 范围                                                                                                         | 批次                                |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| C：错误 atom    | `:article_community_context_required`、`:article_community_not_found`、`:source_article_community_not_found` | 阶段 3；改为 binding 名称并同步测试 |
| A：物理镜像字段 | `belongs_to(:article_community, ...)`、`article_community_id` 及其 changeset/query 参数                      | 阶段 4；与 rename migration 同批    |
| B：语义内部 API | Gate scope/query、FrontDesk/Stats/Metric helper、factory 和旧 fallback 命名                                  | 阶段 5；不与物理字段 rename 混淆    |

C 类 atom 当前没有 ErrorCat、GraphQL 或 frontend 消费者；删除 `Bindings.get/1` 时一起改名即可。
B 类的 `legacy_article_community/1` 仍由旧 UUID tag fallback 使用，必须先移除该 fallback，再直接删除
函数，不能只把它改名为 `legacy_article_binding/1`。

## 4. 数据库对象重命名

运行时 Schema 名称与物理数据库名称最终保持一致：

```text
article_communities      -> article_bindings
article_community_tags   -> article_binding_tags
article_community_id     -> article_binding_id
```

物理迁移必须单独执行并覆盖：

1. 表、索引、唯一约束和 foreign key 的名称；
2. `ArticleBindingTag`、Pinned、Kanban 等依赖关系的 join 字段；
3. migration、schema、query、fixture、seed 和测试工厂；
4. 运行时 SQL、preload 和残留的 `article_community_id` 文本引用。

PostgreSQL forward migration 使用 `ALTER TABLE ... RENAME TO`、`ALTER TABLE ... RENAME COLUMN`、
`ALTER INDEX ... RENAME TO` 和 `ALTER TABLE ... RENAME CONSTRAINT`，在同一 migration 事务内完成。
这些操作保留数据，不需要 backfill 或双写，但仍会取得表级锁；没有兼容层时不得让旧 schema 和新
schema 在滚动发布中混跑。

Ecto schema 的 `belongs_to` 不会自动创建数据库 FK/index 名称。migration 必须显式 rename 数据库
对象，changeset 中的 `foreign_key_constraint/unique_constraint` 预期名称也必须与新名称一致，尤其是
`ArticleBinding.inner_id` 的唯一索引。

迁移前必须确认没有依赖旧表名的外部 SQL 或部署脚本。物理表改名不采用长期双写；迁移完成后旧表名
和旧字段名不得继续作为运行时兼容别名保留。历史 migration 文件不改写，只允许在 rename migration
的来源对象和历史文档中保留旧名。

## 5. 实施顺序

```text
1. 运行时命名（Schema/DTO 与 ArticleBinding 相关 relation -> binding 已完成）
   ArticleBinding / ArticleBindingTag / ArticleView / Articles.Bindings
                 |
                 v
2. FrontDesk 路径读取收口（单路径和批量路径读取均已具备，PathResolver 已删除）
                 |
                 v
3. 全后端调用方迁移到显式 binding / ArticleView；删除 `get_with_context/1` 和所有唯一 binding
   推导路径；拆分并删除旧 `Articles.Communities`。
                 |
                 v
4. 物理表、join 字段、外键、索引和约束已由同 release migration 重命名
                 |
                 v
5. 旧 API、旧表名、旧语义 fallback 和旧兼容引用删除；tracked-files 命名门禁生效；历史
   migration/doc 来源名按白名单保留
```

阶段 3 不得重新引入 `Article.community_id`、`Article.inner_id`、`ArticleView.community_id` 或
从裸 Article 回退读取公共路径字段。阶段 4 与业务返回值统一工作是独立事项，不与本重构混合。

## 6. 验收

- 生产代码中的关系 Schema、DTO、局部变量和新增/迁移代码统一使用 Binding / ArticleView 命名。
- `CMS.Helper.ArticlePath` 只做共享 parse/validate，不访问 Repo 或查询 binding。
- FrontDesk 是公共路径 binding/database lookup、Article 加载与 thread 校验、ArticleView 组装的
  唯一入口；`CMS.Helper.ArticlePath` 仅负责共享纯 parse/validate。
- 生产代码不再存在 `Articles.PathResolver`、`Articles.Path`、`Articles.PublicPath` 或 Binding
  locator 查询 API；`ArticlePathInput` 和纯解析 helper 不属于该门禁。
- `Articles.Bindings` 只暴露 binding 查询和 binding 局部数据操作，不承担路径解析或 binding locator
  lookup。
- `Articles.Bindings.get/2` 返回指定 binding context；`all/1` 返回 Article 的全部 bindings；
  `Bindings.Tags.list/1` 和 `replace/2` 管理 binding-local tags；`get/1`、`get_single_binding/1`、
  `get_with_context/1`、`resolve_unambiguous/1` 和三个 `article_community_*` 内部错误 atom 已删除或改名。
- 生产代码和测试不再引用 `CMS.Articles.Communities` 或 `ArticleCommunities`；旧模块已删除且没有
  兼容 alias。
- mirror、move、unmirror、pin、unpin 分别由 `Articles.Commands.*` 承接；GraphQL mutation
  要求 `command_id: ID!`，facade 不保留无 `command_id` 的兼容 arity；生产代码不再存在
  `Articles.BindingCommands` 或 `Articles.Pins`。
- 同一个 Article 在多个 Community 中可以通过不同 binding 得到不同 `inner_id`。
- 物理表、join 字段、索引、fixture 和测试工厂完成同名迁移。
- 门禁脚本基于 tracked files 扫描 active runtime、测试和 fixture；不再发现新的
  `ArticleCommunity`、`ArticleCommunityTag`、`ArticleResult`、`article_community_id`、
  `Bindings.get/1`、`Bindings.get_with_context/1`、`Articles.Communities` 或 ArticleBinding 语义的
  `relation` 运行时引用。
- `backend/api/priv/repo/migrations/**`、迁移类历史文档、`_build`、`deps` 和生成的
  `erl_crash.dump` 属于显式白名单；历史 migration 不得为了满足 grep 而改写。
- `mix compile --warnings-as-errors`、受影响测试、完整 backend test、`pnpm docs:check` 和
  `git diff --check` 均通过。

## 7. 与原迁移文档的关系

原文档继续负责：

- `inner_id` 从 Article 迁移到关系记录的原因和 R1–R5 批次；
- create、publish、mirror、move、unmirror 的数据语义；
- 公共读取、事件、Search、Press、Stats、Interaction、Comments 和 Outbox 的 binding 上下文合同。

本文只负责：

- Binding 命名；
- `Articles.Bindings` 与 FrontDesk 的边界；
- ArticleView 及相关返回对象命名；
- 物理表、join 字段和旧名称的最终清理。
