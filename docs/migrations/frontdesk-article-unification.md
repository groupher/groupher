# FrontDesk Article 读取统一与版本接口

> 状态：实现已落入当前工作区（2026-11-20）；focused 验收进行中。本文保留原目标、实施范围和验收合同，末尾记录当前验证结果；工作区实现不代表已发布。

## 1. 已确认的目标

普通文章统一从 FrontDesk 获取，返回 `%Article{}`。FrontDesk 默认选定当前公开版本，加载当前请求社区，调用方直接使用 `article.title`、`article.body`、`article.community` 和 `article.inner_id`。

指定 Snapshot 和 WorkingCopy 分别通过新增的 `FrontDesk.article_snapshot`、`FrontDesk.article_working_copy` 读取，不给普通 `article` 入口增加版本选择参数。

- 删除 `ArticleView` 和 `with_community`；不保留另一种文章返回类型或后续补社区步骤。
- `ArticlePublic`、`ArticlePublicBody` 仅由加载、存储和发布实现使用，不要求业务调用方访问 `article.public`。
- 单篇、批量及分页中的文章统一使用 Article；加载字段可按详情、列表和专用批量用途不同。
- 所有接口使用 `{:ok, value}` / `{:error, reason}`，不增加通用结果包装。
- 所有实现落在现有模块，不新增 DTO、Reader、Assembler、版本选择器或通用加载框架。
- FrontDesk 负责读取；内容保存、发布、并发检查、事务锁和 Receipt 仍由现有 owner 负责。
- 同批完成跨资源读取命名迁移：`:management` → `:admin`、`:owner_management` → `:owner`，覆盖 Article、Community、Doc、Comment 和 ArticleLog 的相关读取链路；具体范围见第 7 节。

## 2. 实施前差异与当前落地

下表左列记录实施前基线，右列是已落地的工作区实现。后续验收发现的偏差以第 10 节为准。

| 范围             | 当前实现                                                  | 本次目标                                                |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Article schema   | 稳定身份、作者关联及运行状态；没有 title、body 等读取字段 | 同一 Article 声明读取用 virtual 字段                    |
| 公开详情         | FrontDesk 经 SnapshotProjection 返回 ArticleView          | FrontDesk 返回带当前 community 和所选公开内容的 Article |
| 公开路径批量     | 返回 `%{path, article, binding}`                          | 返回按输入顺序装配好的 Article 列表                     |
| 列表             | Pagination 返回展示 map                                   | Page entries 和 pinned_entries 使用 Article             |
| 内部文章读取     | 可按裸 ID 返回不带 community 的 Article                   | 按 ID 读取要求明确 community；Gate/Store 保留锁内加载   |
| 社区补齐         | Store.with_community 区分 Article 与 ArticleView          | 正常读取直接带 community，不再二次补齐                  |
| 指定 Snapshot    | 底层 Articles.snapshot/3 和 GraphQL 查询已存在            | FrontDesk.article_snapshot/5 复用底层能力               |
| 指定 WorkingCopy | 底层 Articles.working_copy/3 已存在，没有 FrontDesk 入口  | FrontDesk.article_working_copy/5 复用底层能力           |

当前实现入口（已删除文件只作历史说明，不再是可用代码入口）：

- [Article schema](../../backend/api/lib/groupher_server/cms/model/article.ex)
- [FrontDesk Article](../../backend/api/lib/groupher_server/cms/front_desk/article.ex)
- [Article Store](../../backend/api/lib/groupher_server/cms/articles/store.ex)
- [WorkingCopy 底层查询](../../backend/api/lib/groupher_server/cms/articles/working_copy/query.ex)
- [GraphQL 读取 resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/articles.ex)

实施前的 `SnapshotProjection`、`ArticleView` 和 `ArticleTransportResult` 仅用于解释历史形状。

## 3. 普通 Article 接口

### 3.1 参数

沿用现有 `article` 名称、actor 和 options 形式；以下为目标调用示例：

读取命名统一按以下目标切换；当前代码仍使用旧名，尚未实施：

| 层级                  | 当前名称            | 目标名称 | 权限语义                                                             |
| --------------------- | ------------------- | -------- | -------------------------------------------------------------------- |
| 管理读取 mode         | `:management`       | `:admin` | FrontDesk 及相关 Gate/Community 映射同步改名；名称本身不赋予管理权限 |
| Gate 内部 policy mode | `:owner_management` | `:owner` | 按真实所有者关系限制；当前 Article 路径核对的是社区所有者            |

命名迁移不删除管理读取，也不改变 Gate 策略本身、Lifecycle 可读状态或内容版本选择；另在 `Communities.fetch` 修正 owner 请求被扩大为管理读取的转换，见第 7.1 节。调用方使用 `mode: :admin`，不能通过传入 `:owner` 声称自己是所有者；Gate 在内部验证关系。版本接口的 `:admin` 沿用编辑准入，见第 4 节。其余内部 policy mode 不因这次命名确认自动重命名。

这里采用全局改名，不只在 Article FrontDesk 增加 `:admin` 到旧 `:owner_management` 的映射。Community FrontDesk 和 Comment FrontDesk 的管理读取入口也改为 `:admin`；Gate context、策略分支、构造函数、默认参数及 Lifecycle 模式映射同步切换。原 `CommunityContext.management/0` 和 `owner_management/0` 分别改为 `admin/0` 和 `owner/0`，不保留旧名称 alias 或双 mode 兼容。

Gate 权限集合按现有实现保持：Article 的 `:admin` 在内部映射到 `:owner`；Community 的 `:admin` 仍允许所有者或 moderator，`:owner` 仍只允许所有者，不能把两者合并。`Communities.fetch(..., policy_mode: :owner)` 必须保留 owner 策略，不转换成 `:admin`。Doc、Comment 的父级/社区准入以及 ArticleLog 的草稿可见范围保持不变。`:moderator_management`、`:insights_management`、`:operations` 等其他策略名称不改；除上述 owner 转换修正外，其转入旧 mode 的映射同步改名并保留既有转换语义。

实施时同步更新第 7 节列出的跨资源调用点、typespec、测试与当前合同；整组命名切换在 A1 一起完成，不把新旧名称分批发布。

```elixir
path = %{community: "home", thread: :post, inner_id: 12}

FrontDesk.article(path)
FrontDesk.article(path, actor)
FrontDesk.article(path, actor, mode: :admin)
FrontDesk.article(paths, [])
FrontDesk.article(paths, actor, [])
FrontDesk.article(paths, actor, mode: :admin)
FrontDesk.article(article_id, actor, community: community)
FrontDesk.article(article_id, actor, community: community, mode: :internal)
```

| 参数               | 目标合同                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `path`             | 现有 ArticlePath：community slug、thread、inner_id                                                  |
| `paths`            | ArticlePath 列表，最多 100 条；空列表返回 `{:ok, []}`                                               |
| `article_id`       | 稳定 Article UUID；按 ID 调用时必须同时传 community                                                 |
| `actor`            | 当前用户；普通公开读取允许 `nil`，省略时为 `nil`                                                    |
| `opts[:community]` | 按 ID 调用时必填，值为已解析的 `%Community{}`；路径调用以路径社区为准                               |
| `opts[:mode]`      | 默认 `:public`；管理读取使用 `:admin`，可信内部调用使用 `:internal`                                 |
| `opts[:preload]`   | 确有需要时使用普通 Ecto 关联预加载，不通过它切换内容版本；不为虚拟 title/body 建立通用 preload 协议 |

不增加 `snapshot_id`、`working_copy_id`、`stage` 或 `source` 选版参数。Article 本次不再新增具名 `view`；现有 Article view 调用随使用方迁移，不保留双形态兼容。迁移映射固定为：`:with_author` 与 `:command_context` 当前都只是预加载 `author: :user`，改用 `preload: [author: :user]`；`:with_community` 当前并不加载社区，由默认 community 填充替代。`:command_context` 没有额外读取语义；若命令确实需要上下文元数据，声明为显式 virtual 字段，不恢复 view 分支。其他资源的 view 合同不属于本次范围。

按 ID 调用和按路径调用的公开内容、权限和返回约定一致。调用方传入的 community 只是定位输入；FrontDesk 必须核实绑定关系，不能直接把它作为已授权事实。

### 3.2 返回结构

单篇返回 `{:ok, %Article{}}`，例如下面的目标结构；示例未列出全部字段：

```elixir
%Article{
  id: article_id,
  thread: :post,
  title: "文章标题",
  digest: "摘要",
  slug: "article-slug",
  body: body,
  snapshot_id: snapshot_id,
  version: version,
  published_at: published_at,
  community: community,
  inner_id: 12,
  community_tags: tags,
  is_pinned: false,
  author: author,
  lifecycle: lifecycle
}
```

其中：

- `body` 为现有完整正文格式的 map，保留 json、html、markdown、toc 数据、plain_text、digest 等当前字段语义，不新增正文类型。
- `author` 保持现有 `belongs_to :author, Author` 关联并预加载 `author: :user`，即 `%Author{user: %User{}}`，与内部现有 `article.author.user` 用法一致；GraphQL `author` 字段的 resolver 必须解包为 `%User{}` 返回，保持外部 `:user` 类型不变。不能把 Article 的 Author 关联直接改名成 User，也不能让客户端收到 Author 结构。
- `community` 为当前请求的 `%Community{}`，`inner_id` 为该社区中的编号；不新增顶层 `article_id` 别名，文章身份使用 `article.id`。
- 内容字段、snapshot_id 和资产引用均来自这次选中的同一版本；不暴露嵌套 public 对象。

批量返回 `{:ok, [%Article{}]}`，保留有效输入顺序和重复项，省略无效、不可见或禁用路径。同一 Article 在不同社区出现时，返回分别带对应 community、inner_id 的 Article 值；不能仅按 Article ID 恢复路径顺序或去重。公开路径批量加载所选正文、当前社区、标签、pin、Lifecycle、作者和 Snapshot extension；为保留有界批量查询，它不加载 `asset_refs`、`comments_participants` 和 Post `cat`。这些专用字段由详情读取或相应专用 API 提供，批量结果不能直接当作详情完整度的 GraphQL source。

分页保留现有 `%{entries: articles, pinned_entries: pinned_articles, page_info: page_info}` 容器，不另建 Page。列表、身份解析和状态查询保持各自现有加载预算，不因类型统一而默认加载所有正文；它们的最小字段要求和调用方一同迁移。

### 3.3 mode 与未发布文章

| mode        | 内容及社区合同                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:public`   | Gate 限定可见集合，加载当前公开内容和当前社区；没有可读公开版时返回现有错误                                                                                 |
| `:admin`    | 使用现有管理准入；Article 对应内部 `:owner` 策略，加载当前公开内容及明确社区，不自动改读 WorkingCopy                                                        |
| `:internal` | 仅供可信命令/维护读取；身份读取可省略 community，社区内容读取必须明确 community；按 ID 读取身份时不检查 thread 是否启用；内容字段可以未加载，不自动读取草稿 |

`:public` 和 `:admin` 的路径及 ID 读取都检查 thread 是否启用；可信 `:internal` ID 身份读取只恢复 Article/binding 身份，不做该检查，也不因此返回公开内容。

普通公开详情保证完整正文。列表和明确的身份读取不承诺正文已加载；字段省略不改变 Article 类型，也不改变同名字段含义。

旧 `article(id, mode: :internal)` 的调用逐个迁移：需要社区内容的正常读取补充明确 community；仅需要稳定身份的可信内部读取可以省略 community。版本读取使用下面两个接口，仅供锁内授权的身份加载保留在现有 Gate/Store。恢复删除等场景使用 owner 已有领域事实处理归属，不能通过猜测社区或跳过锁来适配新接口。

### 3.4 批量 actor 与 admin 合同

已实现 `article(paths, opts)` 和 `article(paths, actor, opts)` 两种批量入口。无 actor 的入口用于公开路径或可信内部 ID；带 actor 的入口支持 `:public` 和 `:admin`。Article Gate 的 public stage 忽略 actor；公开批量接受 actor 不表示按该用户扩大可见集合。`:admin` 要求 actor，并按 Article `:owner` 准入读取，不会先裁成公开集合。

批量合同如下：

| 目标调用                                            | actor / mode 语义                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `article(paths, opts)`                              | actor 为 `nil`，默认 `:public`；不能借这个形式发起无 actor 的 `:admin` 读取                       |
| `article(paths, actor, opts)`，默认或显式 `:public` | 接受 actor，但与匿名 public 使用相同可见集合；现有 public stage 忽略 actor，传入用户不会升级 mode |
| `article(paths, actor, mode: :admin)`               | actor 必填；沿用单篇管理读取的 Gate 策略，Article 内部使用 `:owner`，不选择草稿或历史版本         |

每组 community/thread 按对应 mode 构造批量 scope，不循环调用单篇接口，也不先按匿名公开集合筛掉管理者本可读取的路径。权限不足的路径按不可见路径规则省略；admin 必须校验 actor 及其真实关系，缺 actor 或未知 mode 返回错误，不降级为 public。public 的 actor 不参与可见性授权；按现有逻辑加载用户展示状态时，也不能借此增加可见文章。各 facade 显式处理列表加 actor 的分发，避免再次落入单篇解析。

`article(ids, mode: :internal)` 的现有身份消费者独立列入 A0。只需要稳定身份、没有请求社区的 owner 事实查询不伪造 community，也不当成已加载的公开 Article 展示；按现有身份查询与 canonical reload 职责迁移。正常文章资源读取仍遵守默认公开且带 community 的合同。

## 4. 新增指定版本接口

这两个接口是新增的 FrontDesk API，底层查询已经存在。本文固定参数顺序，不再增加另一套通用版本 target。

### 4.1 article_snapshot

目标签名为 `article_snapshot(article_id, snapshot_id, community, actor, opts \\ [])`：

```elixir
FrontDesk.article_snapshot(article_id, snapshot_id, community, actor)
FrontDesk.article_snapshot(article_id, snapshot_id, community, nil, mode: :internal)
```

| 参数          | 目标合同                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `article_id`  | 稳定 Article UUID                                                                                                                                                                                         |
| `snapshot_id` | 指定 Snapshot UUID，不接受 latest 或隐式公开头选择                                                                                                                                                        |
| `community`   | 必填 `%Community{}`，用于社区归属和权限检查                                                                                                                                                               |
| `actor`       | 必须显式传入；默认编辑准入要求用户，可信内部模式可显式传 `nil`                                                                                                                                            |
| `opts[:mode]` | 默认 `:admin`，语义是版本入口的编辑准入（复用 `articles_working_copy_access_check(user, :edit, ...)`），区别于普通 Article 的 `:admin` 管理读取；只额外允许可信后端的 `:internal`，不提供公开历史读取模式 |

成功返回 `{:ok, %ArticleSnapshot{}}`，失败返回 `{:error, reason}`。默认预加载其 body：

```elixir
%ArticleSnapshot{
  id: snapshot_id,
  article_id: article_id,
  title: title,
  digest: digest,
  slug: slug,
  body: article_body,
  source_working_copy_id: working_copy_id,
  source_revision: revision,
  captured_at: captured_at
}
```

`article_body` 为现有 `%ArticleBody{}`。Snapshot 保持现有完整 schema 和不可变语义；不转为 Article，不添加另一种 Snapshot DTO，不复制 community 到 Snapshot 字段。归属社区通过必填参数明确。

读取必须按 `snapshot_id + article_id` 限定。默认复用当前编辑读取准入，不新增权限 action；资源缺失或归属不符沿用现有错误协议，不回退到当前公开版。

### 4.2 article_working_copy

目标签名为 `article_working_copy(article_id, working_copy_id, community, actor, opts \\ [])`：

```elixir
FrontDesk.article_working_copy(article_id, working_copy_id, community, actor)
FrontDesk.article_working_copy(article_id, working_copy_id, community, nil, mode: :internal)
```

参数与 Snapshot 接口相同，第二个参数为明确的 WorkingCopy UUID。默认 mode 同为 `:admin`，即同一编辑准入语义，只额外允许可信内部 `:internal`。

成功返回 `{:ok, %ArticleWorkingCopy{}}`，失败返回 `{:error, reason}`。默认预加载 body：

```elixir
%ArticleWorkingCopy{
  id: working_copy_id,
  article_id: article_id,
  scope_type: scope_type,
  scope_id: scope_id,
  revision: revision,
  title: title,
  digest: digest,
  slug: slug,
  body: article_body
}
```

返回现有 WorkingCopy schema，不转为 Article，不新增包装。读取不自动创建副本，不猜测默认副本，不冻结 Snapshot，也不提供后续写入锁。保存仍由原有命令重新加载、加锁并检查 revision。

### 4.3 共同读取过程

```text
article_id + version_id + explicit Community + actor/mode
  -> load stable Article identity
  -> verify Article / Community relationship
  -> existing editing admission, or explicit trusted internal mode
  -> read version by version_id AND article_id
  -> preserve resource-specific scope restrictions
  -> preload its body
  -> return the existing Snapshot or WorkingCopy schema
```

不能先调用默认公开 `FrontDesk.article` 再读取版本，否则未发布文章的编辑读取会被错误地要求先存在公开版。身份加载发生在版本入口内部，复用已有 owner 查询能力。

`:internal` 只改变可信调用的准入路径，不改变版本归属、资源 scope 和缺失处理。GraphQL 不接收客户端传入的 mode，也不把匿名请求默认变成内部读取。

两个版本入口的 typespec、moduledoc 和实际调用处必须注明：默认 `:admin` 执行现有 `:edit` 准入，不映射成普通 Article 的 owner 读取范围。测试明确覆盖能公开读取但没有编辑权限的用户无法读取这些版本，以及普通 admin 读取成功不等于获得写操作权限。

### 4.4 Doc 的当前限制

当前底层 `snapshot` 对 Doc 返回未找到，`snapshots` 返回空列表；WorkingCopy 单条读取只允许 Doc 的 default 副本，要求 `scope_id == article.id`。通用接口不开放 Docs workspace 副本。

本次 FrontDesk 封装保留这些限制；Doc 公开文章仍按其现有 Gate 和站点可见性规则读取。新增入口不代表同时实现 Doc 历史 Snapshot 产品能力，也不替代 Docs 自身接口。

## 5. 字段声明、加载与存储

### 5.1 Article 只维护一份字段定义

| 字段组                                         | 处理方式                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id、thread、author_id、运行状态、数据库时间    | 保留现有持久化字段                                                                                                                                                                            |
| title、digest、slug、body、必要封面/扩展字段   | 在 Article 声明 virtual，由加载入口填入                                                                                                                                                       |
| snapshot_id、version、published_at             | virtual，记录本次公开内容版本信息                                                                                                                                                             |
| community、inner_id、community_tags、is_pinned | virtual，来自明确的请求社区                                                                                                                                                                   |
| author 与 lifecycle                            | author 用现有 `belongs_to :author, Author`（预加载 `author: :user`），GraphQL resolver 解包为 `%User{}`；lifecycle 由现有 Lifecycle 查询填充，Article 当前没有 lifecycle 关联，不新增 has_one |

不机械复制整张 ArticleView 字段表。`meta`、当前社区组成的 `communities` 等接口组合字段在已有 GraphQL resolver 中生成；viewer 私有状态继续走各自现有 API。需要保留的命令临时元数据明确声明为 virtual，不继续任意向 struct 塞未声明键。

virtual 字段不增加数据库列。Article changeset 只 cast 它负责的持久化字段，不通过 cast_assoc 或 Repo.update 将 virtual title/body 自动写入公开内容；WorkingCopy、Snapshot 和发布命令继续拥有内容写入权。

### 5.2 公开内容的一致性

FrontDesk 内部复用 [Public.current](../../backend/api/lib/groupher_server/cms/articles/public.ex) 的匹配条件，在同一 SQL 读取 Public、PublicBody 和所选 Snapshot。不能分别 preload 后把不同时间选中的版本混在一起。

公开正文来自 PublicBody；Snapshot 继续提供版本身份、typed extension、封面和资产身份。缺失或不匹配沿用既有错误，不读取历史正文或 WorkingCopy 补齐。

读取投影把 `inserted_at / updated_at` 映射为所选公开版本的 `published_at`，与 `published_at` 保持同一公开时间口径；该映射只作用于返回的 Article，不写回数据库。Search、Press 等其他资源仍遵守各自的时间字段合同。

### 5.3 批量和分页

- SQL 与 Gate 查询继续由现有资源 Query / Pagination 实现，FrontDesk 不接收任意 filter/sort，不接管分页策略。
- 标签、作者、置顶和正文按页或按组加载，不能循环调用单篇 FrontDesk。
- 同一文章不同社区的返回值按 binding 或完整路径区分；统计仍归稳定 Article。
- 保留 pinned_entries、普通游标集合、count 和稳定排序约定；查询私有游标列不成为新文章结果类型。
- 已有 ArticleLite 的有效 SQL 选择和排序逻辑可继续复用，但返回到业务层的文章统一为 Article。
- 当前分页的 `for: ArticleLite`、`ArticleLite.cursor_values/2` 与最终返回的 Article 类型分别承担查询配置和结果字段职责；本次不因返回值改成 Article 就机械改成 `for: Article`，也不把游标取值改为读取未加载的 virtual 字段。
- 虚拟 title、inner_id 等不是 articles 表的列；筛选与排序仍显式映射到 Public / Binding 等真实列。
- `published_at`、`inner_id`、`binding_id` 等 virtual 字段与 Article 的 Flop `join_fields` 同名；排序和筛选必须继续使用 `stable_public` / `article_binding` 绑定，不能因为 schema 新增同名字段就改走 articles 表列。
- 现有索引已覆盖三个入口：路径批量用 `article_bindings_community_inner_id_index`，Snapshot 用 `article_snapshots_article_id_id_index`，WorkingCopy 用 `article_working_copies_article_id_id_index` 和 `article_working_copies_article_id_scope_type_scope_id_index`；本次不新增数据库索引或迁移，实施时若查询计划显示缺失再单独补迁移。

## 6. 接入位置与下游迁移

### 6.1 现有 Facade 层级

```text
Web / Job / cross-domain caller
  -> GroupherServer.FrontDesk
  -> GroupherServer.CMS root facade
  -> CMS.FrontDesk
  -> existing FrontDesk.Article and owner Query / Store
```

两个新接口同步补齐上述委托。Context 内部调用自己的 FrontDesk，不绕行 CMS -> Root -> CMS。Root FrontDesk 不直接查询数据库或实现 CMS 权限。

普通 Article 在现有 FrontDesk.Article 中选版和填充。SnapshotProjection 中必要的检查和查询归入现有读取实现，删除复制展示 map、转换 ArticleView 的路径；不把该模块简单改名为另一种结果构造层。

### 6.2 调用方清单

| 范围                            | 迁移内容                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 普通文章 GraphQL                | 直接读 Article.title/body/community/inner_id；作者、meta 等保留明确字段 resolver；作者覆盖详情、Lite 和 common_article |
| GraphQL articleSnapshot         | 用新的 FrontDesk.article_snapshot 替代 resolver 中的身份读取、编辑准入和版本读取组合                                   |
| GraphQL WorkingCopy             | 保留现有列表和命令返回；本次不新增单条 GraphQL query                                                                   |
| FrontDesk / Passport middleware | 明确匹配 Article，校验当前路径与 community，不用任意 `__struct__` 代表已正确加载                                       |
| Gate Access / Loader / Check    | 按明确社区准入；锁内读取权威绑定并返回 canonical Article，不能沿用未验证输入作为授权事实                               |
| Store.with_community            | 删除；正常读取默认带 community，不留旧名转发                                                                           |
| 评论创建、回复、恢复            | 直接传 Article，删除 ArticleView 分支和删 `__struct__` 转 map；Article 分支必须继续传递当前 community                  |
| 互动、收藏、ArticleStats        | 使用稳定 id、当前 community/inner_id，删除展示对象与裸 Article 的重复处理；不改变统计和私有状态 owner                  |
| 分类、锁评论、下沉等命令        | 返回更新后的 Article，按需加载内容；删除 ActionResult 对旧展示 map 的合并                                              |
| Mirror / Move / Pin / Restore   | 返回中的 Article 保留正确社区和已刷新状态；移除动态塞 community/inner_id 的路径                                        |
| Search、Press                   | 从 Article 顶层内容与版本字段消费；保持现有搜索文档、feed、manifest 格式和批量查询                                     |
| 通知、Activity、Outbox          | 明确文章、作者和请求社区的取值；保留稳定身份及已有异步重载用途                                                         |
| 工厂、seed、测试 helper         | 返回统一 Article；使用 article.id，更新依赖 ArticleView 字段的断言和调用                                               |

尤其核对当前三个分支问题：Store 会拒绝所有 Article；Comments.Create 的 Article 分支没有沿用展示对象传入的社区；Gate 中 Article 与带 community 的展示对象可能进入不同分支。不能仅改构造点就认为调用链已经统一。

作者解析逐项覆盖现有三个位置：`general_article_fields` 中的 `author: :user`、`article_page_objects` 中的 Lite `author: :common_user`，以及 `common_article` 的 `author: :common_user`。Lite 查询层直接产出 `%User{}`；`common_article.author` 通过同一字段解析函数兼容 `%User{}` 和 `%Author{user: %User{}}`，保证 upvoted/collected 列表及可能携带 Article 关联的 Comment 来源都返回 User。验收同时覆盖 GraphQL common_article 列表和 Author/User 两种解析输入。

过渡过程中，现有字段 resolver 兼容已加载的 `%Author{user: %User{}}` 和 `%User{}`，统一向 GraphQL 返回 User；关联尚未加载时复用已有批量加载能力，不逐项 Repo 查询。无需按 ArticleView 类型另建分发。A4 清除只服务旧 ArticleView 的分支，同时保留其他既有合法来源需要的 User 处理，不建立长期双文章类型或新作者适配层。

### 6.3 命令、锁与 Receipt

FrontDesk 读取不替代 Gate 在命令事务内的 canonical reload、绑定校验、锁和版本检查。正常资源加载不机械降级成 ID 再重查，授权锁内、异步和恢复用途的重载仍按既有边界保留。

首次执行和 Receipt 恢复使用同一现有结果路径。指定版本遵守 Confirmation 中的版本锚点，不能用当前公开版冒充原指定版本；本次不改变 Receipt 恢复策略、保留窗口或幂等职责。

WorkingCopy、Snapshot、Public 的写入结果和现有业务确认仍归各自 owner；不强迫所有命令都只返回 Article。普通文章读取的统一不改变这些业务结果含义。

## 7. 范围与旧文档关系

本方案包含两个明确范围：Article 读取结构统一，以及跨资源读取 mode 命名迁移。前者替代 ArticleView、二次补社区和多返回形状约定；后者覆盖 Article、Community、Doc、Comment 和 ArticleLog 的相关读取链路。跨资源部分除第 7.1 节明确的 `Communities.fetch` owner 转换修正外，只改命名及其接入映射，不改变各资源返回结构、权限集合、Lifecycle 状态、内容版本和错误语义。

### 7.1 全局命名迁移清单

当前 `:owner_management` 涉及以下 11 个生产文件，均纳入 A0 清点和 A1 实施。路径相对于 `backend/api/lib/groupher_server/`：

| 文件                                  | 同步迁移内容                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `cms/gate/context/scope/article.ex`   | policy mode 集合及 draft 默认值                                                      |
| `cms/gate/context/scope/community.ex` | 两种旧 mode、构造函数及示例                                                          |
| `cms/gate/context/scope/doc.ex`       | policy mode 集合及 draft 默认值                                                      |
| `cms/gate/context/scope/comment.ex`   | 父级 Article/Community 读取策略允许值                                                |
| `cms/gate/scope/article.ex`           | mode 分支、guard 及 Doc 草稿 context                                                 |
| `cms/gate/scope/community.ex`         | 管理读取和 owner 分支、guard 及 Lifecycle mode                                       |
| `cms/gate/scope/community_chain.ex`   | owner 关系过滤、mode 集合和 insights 的 Lifecycle 映射                               |
| `cms/communities.ex`                  | policy 到 FrontDesk 读取 mode 的转换；owner 保持 owner，修正原先扩大为管理读取的行为 |
| `cms/communities/lifecycle.ex`        | 可读 mode、readable_states 分支及 guard，状态集合不变                                |
| `cms/front_desk/article.ex`           | 对外 admin 到内部 owner 的映射                                                       |
| `activity/article_log.ex`             | Doc 草稿读取 context 的显式 policy 参数                                              |

这 11 个文件不是全局改名的完整改动上限。还包括 `cms/front_desk/comment.ex` 的管理 mode 校验、`cms/front_desk/community.ex` 的 mode 接入验证，以及 `cms/front_desk.ex`、根 `front_desk.ex` 的 facade 合同、typespec 和示例。A0 继续清点实际委托及调用者；透传参数的 facade 不因本清单而增加新适配层。

`Communities.fetch` 的 `read_mode/1` 另有一项明确的行为修正：当前 `:owner_management -> :management` 会把 owner-only 请求转换成所有者或 moderator 可读。目标采用 `:owner -> :owner`，原样交给 FrontDesk/Gate 验证所有者关系，不采用 `:owner -> :admin`。这是修正既有转换扩大权限的行为，不是纯改名；无需修改 Gate 的 owner/admin 策略或 Lifecycle 状态集合。其余转换保持：`:public -> :public`、`:admin -> :admin`、`:moderator_management -> :admin`、`:operations -> :internal`。A0 单独记录该修正的调用影响，A1 同步更新转换及定向测试。

Community 的旧 `mode: :management` 位置分别处理（前两项为实际调用，后两项为文档示例；行号以本次核对时为准）：

- `backend/api/lib/groupher_server_web/resolvers/cms/community_trash.ex:83`：调用改为 `:admin`，保留原 actor 和回收站可见范围。
- `backend/api/lib/groupher_server/cms/communities/admins.ex:183`：调用改为 `:admin`，保留原 actor 和管理读取行为。
- `backend/api/lib/groupher_server/cms/front_desk.ex:71–72`：两个 Community 示例同步改名。
- `backend/api/lib/groupher_server/front_desk.ex:33`：根入口 Community 示例同步改名。

测试清点至少覆盖 `cms/front_desk_test.exs`、`cms/gate_test.exs`、`cms/gate/access_test.exs`、`cms/gate/scope/community_test.exs`、`cms/gate/scope/binding_trash_test.exs`、`cms/communities/lifecycle_test.exs` 和 `cms/articles/docs_public_read_scope_test.exs`（均相对于 `backend/api/test/groupher_server/`），并检查 ArticleLog 及 Comment 父级准入相关测试是否需要补充。不能只替换测试中的名称，必须保留并验证原来的角色/状态可见性断言。

### 7.2 文档与范围边界

以下当前合同在切换时同步更新，其他当前文档中的相关 API 名称也按 A0 清单迁移；历史文档保留旧名时必须标明历史语义：

- [FrontDesk 当前合同](../feature/front-desk/README.md)
- [Article 入口](../feature/article/README.md)
- [Article Binding 命名与存储](./article-binding-naming-and-storage.md)
- [FrontDesk 与 Query 收口](./frontdesk-query-convergence.md)
- [Resource Loading Boundary](../architecture/resource-loading-boundary.md)
- [Command Confirmation](../architecture/cms-command-confirmation.md)
- [Passport 请求 Scope](../architecture/passport-request-scope.md)
- [PublicBody R3](./article-public-body-r3.md)

原文档中不从裸 Article 推测 Community、inner_id 的规则继续成立：本次添加的是读取时按明确请求加载的 virtual 字段，不把这些信息重新存入 articles 表，不通过绑定数量猜测当前社区。

本文是待实施方案，不把当前 FrontDesk/Query 运行态、已完成的其他迁移改写为已实现本目标。既有列表、Gate、Lifecycle、Docs 发布和错误协议仅修改 Article 结构统一、上述全局命名迁移及 owner 转换修正所需的接入点；Community、Doc、Comment 不借本次改名重做授权或返回结构。

本次不包含 Unmirror 返回类型改为 DoneState 等独立 GraphQL 协议修正，不新增 WorkingCopy 单条 GraphQL query，不扩展 Doc 历史读取，也不新增数据库表或迁移。

## 8. 实施批次

实施按下列批次完成；没有保留 ArticleView / Article 双返回的发布阶段。

A0 先完成第 7.1 节的全局命名清单，包括 atom、构造函数、draft 默认值、映射、facade、实际调用、测试和当前文档，并单列 `Communities.fetch` owner 转换的行为修正。A1 将这些定义、消费者及该修正作为完整变更一起迁移，不允许只改 Article FrontDesk、遗漏 Community/Doc/Comment/ArticleLog。A1 的跨资源命名与 owner 转换验证通过后，A2 才切换普通 Article 返回结构；A1 不依赖 ArticleView 已删除。

A2 切换读取生产者之前，必须完成受新 Article/Author 形状影响的最低限度消费者适配，包括 Gate 分发、Store、评论和全部 GraphQL 作者位置。它们与返回值切换作为同一集成变更验证，不能因为表中列在 A3 就延后。A3 收口其余命令和后台链路；如果某项适配是 A2 正常运行的前提，立即并入 A2。A2/A3 是工作分类，不能作为允许旧消费者损坏的独立发布边界。

| 批次                    | 内容                                                                                       | 退出条件                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| A0 基线                 | 固定详情、列表、版本读取、错误与批量 SQL 基线；清点旧字段/view 和跨资源 mode 清单          | 已完成；见第 3–7 节及调用方验收范围                           |
| A1 命名、字段与版本入口 | 完成全局 admin/owner 改名、owner 转换修正、Article 字段和两个版本入口                      | 已落地；验证结果见第 10 节                                    |
| A2 普通读取             | 切换单篇、批量、分页、GraphQL 和旧返回形状消费者                                           | 已落地；测试覆盖详情、批量、分页和 GraphQL                    |
| A3 命令及后台消费       | Gate、评论、互动、收藏、状态命令、Search、Press、通知、工厂同步                            | 已落地；focused 回归发现并修复 Doc Comment Article scope 缺失 |
| A4 删除与验收           | 删除 ArticleView、with_community、旧类型分支和无调用的 transport 代码，更新文档和 typespec | 已落地；编译、测试与静态检查结果见第 10 节                    |

不按目录盲删 ArticleTransportResult、Response 等模块；先确认实际引用和仍承担的业务职责，必要逻辑迁入已有 owner 后再删除。

## 9. 验收条件

- 普通单篇、批量及分页条目为 Article；正常公开读取已经带 community，无 with_community 调用。
- 公开版已选好，article.title/body/封面/标签/资产来自匹配版本；修改 WorkingCopy 不影响公开读取。
- 同文章跨社区的 inner_id、标签和置顶正确；未提供或不匹配的社区不会被猜测补齐。
- 批量覆盖空数组、重复路径、跨社区、混合无效/不可见路径、100/101 条，以及分页重复/遗漏和置顶集合。
- 批量分别验证默认匿名 public、显式 actor 的 public 和 actor 必填的 admin：相同路径下 public 传入所有者、moderator 或普通用户均不扩大匿名 public 的可见集合、不升级 mode；admin 缺 actor 报错，Article admin 按社区 owner 策略返回管理可见项，不被预先截成 public 集合；未知 mode 不静默降级。Community admin 允许所有者或 moderator 的集合在对应 Community 入口单独验收。
- 两个新接口覆盖合法、缺失、非法 ID、跨 Article 版本 ID、跨社区、不足权限、匿名编辑读取和可信内部读取。
- 未发布 Article 的 WorkingCopy 可按已有编辑权限读取，不要求存在公开版；指定 Snapshot 不回退当前公开版。
- 两个版本接口默认 body 已加载；WorkingCopy 的 scope/revision、Snapshot 不可变元数据保持正确。
- Doc Snapshot 未支持及 default/workspace 边界有明确断言，internal mode 不能绕过。
- 评论、回复、互动、收藏、状态变更及 Receipt 首次/恢复结果正确；保存 revision 冲突及锁内重载保持有效。
- GraphQL 详情、Lite、interface、author（对外仍为 `%User{}`）、meta、正文格式和时间口径保持预期；本次不改变客户端 schema 合同。
- 作者专门覆盖详情、Lite、common_article、相关命令首次/恢复返回，以及过渡期 Author/User 来源；只通过详情测试不能作为作者链路验收。
- 管理读取使用 `:admin`、内部所有者策略使用 `:owner`；除明确的 `Communities.fetch` owner 转换修正外，角色校验、可读状态和版本入口 `:edit` 准入与命名前一致。旧名称只用于标明现状或历史的文档及拒绝旧 mode 的负向测试，不作为运行时 alias 保留。
- 全局命名覆盖第 7.1 节 11 个文件、额外 FrontDesk 接入点、Community 两个实际调用及相关 facade/构造函数；生产代码没有残留旧 atom、旧构造函数调用或 draft 默认值。负向测试中显式传入旧 mode 应拒绝，不静默降级。
- 跨资源分别验证 owner、moderator、普通用户和匿名 actor：Community admin 仍为原所有者或 moderator 集合，owner 仍仅所有者；Article 管理读取、Doc 草稿、Comment 父级准入、回收站和 ArticleLog 可见性与改名前一致。Lifecycle 各 mode 的状态集合保持不变，insights/moderator/operations 等未改名策略的转换仍正确。
- `Communities.fetch(..., policy_mode: :owner)` 定向验证真实所有者可读、仅为 moderator 的用户不可读；同一 moderator 使用 `:admin` 仍可管理读取。覆盖实际 fetch 到 FrontDesk/Gate 的查询结果，不能只断言 mode 转换；这是有意修正原 owner 请求的权限扩大，其他 policy 转换保持第 7.1 节约定。
- Search、Press、通知和资产/封面消费使用正确内容；不改变既有输出格式。
- SQL query-count / SQL-shape 覆盖同组 1/20/100 条，正文、标签、作者查询不随条数逐篇增加；不要求不同 community/thread 组仍只有一次 SQL。
- SQL-shape 同时断言绑定排序列、完整游标取值、同文章多 binding、置顶集合和跨页重复/遗漏；保留或迁移 Flop 配置都不能查不存在的 articles 列。
- virtual 内容字段不会通过 Article changeset 自动写入公开内容，也不被错误当作数据库列筛选排序。

实施时依据[验证矩阵](../infra/tooling/validation.md)运行 focused `mix test`、`mix compile --warnings-as-errors`、`mix lint.style`、`mix lint.context`，检查修改文件格式，并运行 GraphQL 合同、生成文件检查和 `pnpm docs:check`。若确需重新生成 GraphQL 文件，使用现有生成命令并审查 diff。

验证结果区分本任务失败、预先存在的工作区失败和未运行项；不把静态方案或单项通过写成完整实现验收。

## 10. 工作区实施与验证状态

代码已按 A0–A4 切换；ArticleView、SnapshotProjection、ArticleTransportResult、Store.with_community 和 Article view 分支已从运行时代码删除。所有验证均为当前工作区的本地结果，不代表合并或发布。

2026-11-20 文档验证：

- `mix compile --warnings-as-errors` 通过；修改范围内 `.ex` / `.exs` 的 `mix format --check-formatted` 通过。
- Article/GraphQL/Gate/Passport middleware 合并回归：15 个定向测试文件 94/94 通过；`Press` passport fixture 单测 1/1 通过。`communityActivity` Passport scope 复用定向测试 1/1 通过。
- FrontDesk Article focused 回归：在隔离测试库 `groupher_server_review_20261120` 上运行 `paged_docs_test.exs`、`read/post_test.exs`、`locator_test.exs`、`common_article_author_test.exs`、`upvotes_posts_test.exs`，38/38 通过；新增 Doc `activeAt` 回退、禁用 thread 的 public/admin ID 读取、Locator 批量标签/时间/社区投影，以及 `common_article.author` 的 GraphQL upvoted 列表和 Author/User 两种来源断言。
- 评论回归：初次运行 15 个相关文件为 246/248；review 确认剩余两项是 Command Operation Identity 迁移后仍查询 `Outbox.Event.command_id` 的过期断言，已改为当前字段 `operation_ref`。`post_comment_test.exs` 全文件复验 46/46 通过；其余评论回归未因这两项重跑。
- `mix lint.style` 仍因工作区其余 38 条 style 违规退出 1，主要分布在 co-author、jobs、analysis 和其他已有文件；本次 review 发现的 `@doc/@spec` 顺序、GraphQL helper alias 及新增 scope 测试 alias 问题已修正。
- `pnpm docs:check`：documentation tests 11/11、Documentation coverage、CMS Query boundary 及 Context/policy 检查通过；随后 `check:backend-context-v2` 报告 40 条既有工作区 strict 违规（包括 activity、jobs、review_bot、resolvers/cms，以及 `cms/articles/co_authors` 目录边界），命令退出 1，后续串联检查未执行。当前 Article 修改引入的 FrontDesk 反向 Context facade 调用已修复；剩余违规位于本次 Article 统一读取和 Passport scope 试点范围之外。
