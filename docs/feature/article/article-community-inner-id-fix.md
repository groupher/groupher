# ArticleCommunity `inner_id` Fix

> 状态：核心模型、普通 Article 路径与 published 关系不变量已切换；Article 旧字段尚保留
> 在 schema 中，作为非权威兼容字段。
>
> 本文修复公共路径编号与 ArticleCommunity 关系归属不一致的问题。项目不要求保留历史
> 数据，实施时直接切换到目标模型，不增加双写、shadow read、backfill 或长期兼容层。

当前实现已完成关系编号的写入与主要公共读取切换：`ArticleCommunity.inner_id` 由 Community
counter 分配，发布、mirror、move 使用关系编号，FrontDesk、Path Resolver、普通列表和
Kanban 读取关系编号。`Article.community_id` / `Article.inner_id` 仍暂留在 schema 和少数
内部投影中，作为代码迁移期间的非权威字段；它们不再由 mirror/move 写入，也不再作为公共
路径查询条件。后续清理这些字段前，需要继续迁移 Search、Press、Stats、Interaction 和
其他事件 payload 的 relation context。

## 1. 问题

当前公共编号保存在 `Article`：

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

当前行为存在三个问题：

1. `mirror` 只新增 Mobile ArticleCommunity 关系，不给 Mobile 分配编号；Mobile 复用
   `Article.inner_id`。
2. `move` 修改 Article 的 `community_id` 和 `inner_id`，把稳定 Article 身份和当前 URL
   锚点绑在一起。
3. Path Resolver 按 `relation.community_id + article.inner_id` 查询，但数据库没有保证
   镜像 Article 在目标 Community 内的编号唯一。

因此当前实现既不是可靠的共享编号模型，也不是独立 ArticleCommunity 编号模型。

## 2. 目标模型

公共编号属于具体的 `ArticleCommunity`，而不是稳定的 `Article`：

```text
Article
├── id          稳定内容身份
├── thread
├── lifecycle
└── moderation

ArticleCommunity
├── id
├── article_id
├── community_id
├── inner_id    Community 内公共编号，可为空直到关系公开
├── visible
└── timestamps
```

同一篇 Article 在不同 Community 中拥有不同编号：

```text
Article A
├── Home ArticleCommunity:   inner_id = 12
├── Mobile ArticleCommunity: inner_id = 37
└── Design ArticleCommunity: inner_id = 8
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

Community-wide 编号避免把 `thread` 冗余复制到 `ArticleCommunity`，也避免跨表 join 无法
表达唯一约束的问题。URL 仍保留 `thread`，但编号在同一 Community 内不重复。

编号分配必须在同一事务内锁定 Community counter、写入关系、推进 counter。发布前
的关系可以暂时没有 `inner_id`；关系公开时必须先分配编号，再产生依赖该路径
的 Projection、Search 或 PublicCache 事件。

## 4. 命令语义

### 4.1 Create / Publish

```text
create Article
  -> create ArticleCommunity
  -> 关系公开时分配 ArticleCommunity.inner_id
```

### 4.2 Mirror / Add

```text
mirror(article, Mobile)
  -> lock stable Article and target Community
  -> insert ArticleCommunity(article, Mobile)
  -> allocate Mobile.inner_id
  -> write Mobile-local tags / pin / Kanban facts
```

Mirror 不修改 Article 的稳定字段，也不持久化 `home` / `mirror` role。

### 4.3 Move

Move 是目标 ArticleCommunity 关系添加与来源关系删除的原子组合：

```text
move(article, Home, Mobile)
  -> create Mobile ArticleCommunity and allocate Mobile.inner_id
  -> apply explicit local-data policy
  -> delete Home ArticleCommunity
```

Move 不修改 Article.id、Revision、Comment、Interaction 或其他 Article-global facts。

### 4.4 Unmirror / Remove

```text
unmirror(article, Mobile)
  -> delete ArticleCommunity(article, Mobile)
  -> cascade Mobile-local tags / pin / Kanban state
  -> keep Article and other ArticleCommunity relations
```

路径合同切换后不再需要依赖 `Article.community_id` 的临时删除守卫。若产品要求已发布
Article 至少保留一个公开关系，应在删除命令中显式检查该不变量；不能通过隐含的 home
角色表达。

## 5. 读取与副作用

### Public Path

Path Resolver 必须使用：

```text
relation.community_id = requested_community
relation.inner_id     = requested_inner_id
article.thread        = requested_thread
```

返回值应同时携带 stable Article 与当前 ArticleCommunity context；GraphQL Article、List、Detail、
Search、Feed、Press 和 PublicCache 都从 ArticleCommunity context 读取公共 `inner_id`。

### Community-local facts

以下数据继续以 `article_community_id` 为外键：

```text
ArticleCommunity
├── ArticleCommunityTag
├── PinnedArticle
├── KanbanState
├── Dependency / Schedule（后续能力）
└── 其他 Community-local projection
```

Kanban 状态不因 mirror 或 move 自动复制到其他 ArticleCommunity 关系；Move 的局部数据保留、复制或
清理策略必须由命令显式决定。

## 6. 实施顺序

1. 在 `ArticleCommunity` 增加 nullable `inner_id`，增加 Community-wide counter 和唯一约束。
2. 将 Numbering owner 从 stable Article 改为 target `ArticleCommunity` / Community counter。
3. 修改 create、publish、mirror、move、unmirror，使所有路径编号写入 ArticleCommunity 关系。
4. 修改 Path Resolver、FrontDesk、GraphQL、List、Detail、Search、Feed、Press 和
   PublicCache，使读取统一使用 ArticleCommunity `inner_id`。
5. 删除 `Article.community_id`、`Article.inner_id` 作为公共路径字段及其相关兼容代码。
6. 删除当前 `Article.community_id` 路径锚点守卫，补充 published ArticleCommunity 关系不变量。（已完成）
7. 更新测试、GraphQL contract、seed、fixture 和源级文档。（已完成）

不在本 fix 中引入 `ArticleCommunity.role`、`home` 特殊关系、双写、shadow read、历史
backfill 或 UUID public locator。

## 7. 验收

- 同一 Article 在两个 Community 中可以同时存在，且拥有不同 `inner_id`。
- 同一 Community 内任何两个公开 ArticleCommunity 关系不得拥有相同 `inner_id`。
- Mirror 不修改 stable Article 的公共路径字段，因为这些字段已不存在。
- Move 只改变 ArticleCommunity 关系集合，不改变 Article.id、Revision、Comment 或 Interaction。
- Unmirror 只删除目标 ArticleCommunity 关系及其局部数据，不影响其他关系。
- Path Resolver 能分别解析 `/home/post/12` 与 `/mobile/post/37` 到同一个 Article。
- 两个 Community 的 Kanban status、tags、pin、dependency 和 schedule 互不串写。
- 所有业务 API 遵循 `{:ok, value}` / `{:error, reason}` 返回协议。
