# Article Community Placement

> 状态：target contract；placement role normalization 已实现，公共路径与 Kanban 仍待对齐。
>
> 本文是 Article 与 Community 关系的唯一产品合同。Revision、Draft、Lifecycle、
> Moderation、Kanban 等文档只能引用本文，不能重新定义一套 `home` / `mirror` 关系角色。

## 1. 核心结论

`Article` 是跨 Community 共享的稳定内容身份；`ArticleCommunity` 表示这篇 Article
出现在一个具体 Community 中。

```text
Article
├── ArticleCommunity(article, community-a)
├── ArticleCommunity(article, community-b)
└── ArticleCommunity(article, community-c)
```

所有 `ArticleCommunity` 关系平级：

- `home` 只是可能存在的 Community 名称，不是关系角色；
- `mirror` 是创建关系的产品命令，不是持久化关系类型；
- 一篇 Article 可以关联零到多个 Community；
- 不存在“每篇 Article 必须或最多有一个 home relation”的领域不变量；
- `ArticleCommunity` 不是第二份 Article，也不复制 Draft、Revision、Comment 或 Interaction。

`ArticleCommunity` 的最小合同是：

```text
cms.article_communities
├── id
├── article_id
├── community_id
└── timestamps

UNIQUE(article_id, community_id)
```

关系存在表示 Article 出现在该 Community；关系不存在表示它不在该 Community。

## 2. 为什么需要独立关系

Article 与 Community 是多对多关系，并且同一篇 Article 在不同 Community 中可以拥有
不同的运营数据：

```text
Article A
├── Community A placement
│   ├── tags: product, urgent
│   ├── pinned: false
│   └── kanban: todo
│
└── Community B placement
    ├── tags: frontend
    ├── pinned: true
    └── kanban: wip
```

这些事实以 `article_community_id` 为作用域：

```text
ArticleCommunity
├── ArticleCommunityTag     0..N
├── PinnedArticle           0..1
└── KanbanState             0..1（目标能力，尚未实现）
```

这层关系提供三个能力：

1. 统一判断 Article 是否出现在某个 Community；
2. 为 Community-local 的 Tag、Pin、Kanban 等事实提供外键挂载点；
3. 删除关系时，通过外键级联清理该 Community 的局部数据，而不删除共享 Article。

## 3. 命令语义

### 3.1 添加到 Community

`mirror` 可以继续作为产品用语，但它只表示一个幂等命令：

```text
mirror(article, community)
  -> insert ArticleCommunity(article_id, community_id)
```

命令完成后，数据库中只有一条普通、平级的 `ArticleCommunity`，不保存
`role = mirror`。

### 3.2 从 Community 移除

```text
unmirror(article, community)
  -> delete ArticleCommunity(article_id, community_id)
  -> cascade Community-local tags / pin / kanban state
```

删除 placement 不删除 Article、Revision、Comment、Interaction 或其他共享事实。

当前路径合同尚未确定时，若目标 Community 等于 `Article.community_id`，命令返回
`current_path_placement`，拒绝删除这个临时路径锚点；路径合同落地后再重新评估该守卫。

### 3.3 Move

如果产品仍保留 `move`，它只是组合命令：

```text
move(article, source, destination)
  -> add destination placement
  -> remove source placement
```

添加目标 placement 与移除来源 placement 必须在同一事务内原子完成；任一步失败都不得留下
双 placement 或零 placement 的中间状态。

`move` 不查找或替换特殊的 `home` relation。也可以在产品层只暴露“添加到社区”和
“从社区移除”，不再提供独立 Move 概念。

这些命令的 actor/action admission 仍由 CMS Gate 负责；关系唯一性、两端 Community
存在性和关联数据清理由 Article Community placement owner 负责。

## 4. 可见性边界

Placement membership、Article Lifecycle、Moderation 和 Community Lifecycle 是不同事实：

```text
ArticleCommunity exists
  AND Article Lifecycle is publicly readable
  AND Article moderation allows public read
  AND target Community Lifecycle allows public read
  -> Article can appear in that Community
```

如果产品需要“保留 placement，但仅在某个 Community 暂时隐藏”，可以在
`ArticleCommunity` 上保留明确的 Community-local visibility 字段。否则，关系存在性本身
足以表达 membership。

不得把 Article-global moderation 复制成每条 placement 的独立权威；读取时组合权威事实，
或把冗余字段明确标注为可重建 Projection。

## 5. 公共路径与编号：待决合同

去掉特殊 `home` relation 后，公共路径不能再通过“home community”隐式定义。实现前必须
单独确认以下产品规则：

1. 同一 Article 在不同 Community 中是否共享 `inner_id`；
2. 还是每条 `ArticleCommunity` 分配 Community/thread-local `inner_id`；
3. mirror 页面使用当前 Community 路径，还是跳转到一个与 Community 无关的稳定路径；
4. 移除 placement 后，该 Community 下的旧路径是否立即失效或保留 redirect/tombstone。

在该决策完成前，文档和代码都不得使用 `home community`、`canonical home path` 或
`home relation` 代替正式的路径合同。

## 6. Kanban 扩展位置

Kanban 是当前 Community 中部分 Post 的工作管理能力。目标关系是：

```text
ArticleCommunity
└── KanbanState?             不存在表示未加入该 Community 的 Kanban
    ├── status               存在时必填
    └── rank
```

同一篇 mirror Post 在不同 Community 中可以独立决定是否进入 Kanban，并拥有不同的
status、rank、Subtask、Dependency 和 Schedule。KanbanState 不是第二个 Post 身份。

## 7. 当前实现偏差

截至本文修订时，当前实现仍与目标合同存在以下偏差：

- `Article.community_id` 仍承担现有公共路径与编号的当前 Community 锚点；
- `move` 为兼容现有路径/编号流程，仍会更新 `Article.community_id` 并重新编号；
- GraphQL 旧 mutation `mirror_to_home` / `move_to_blackhole` 仍暴露，但现在分别只是
  普通 placement add 和普通 Move；它们的名称与旧语义不一致，必须移除或改名；
- 在路径合同落地前，`unmirror` 拒绝删除与 `Article.community_id` 相同的当前路径 placement；
- Kanban `PostState.status` 仍以 `article_id` 为全局作用域，mirror Community 不能拥有独立状态。

这些是待修复实现，不是需要继续兼容的产品合同。项目没有历史数据要求，实施时直接切换
到最终模型，不增加双写、shadow read、backfill 或长期兼容层。

## 8. 实施验收

后续实现至少需要同时覆盖：

- 部署并验证 placement role normalization migration；
- 验证 create/mirror/unmirror/move 关系命令的原子性和级联清理；
- 验证 `unmirror` 不能删除当前路径 placement；
- 移除或重命名 `mirror_to_home` / `move_to_blackhole` GraphQL mutation，并更新 Passport、前端和测试；
- 重新确认并实现第 5 节的路径与编号合同；
- 让 List、Detail、Count、Tag、Pin、Search、Feed、Press 和 PublicCache 统一从 placement 读取；
- 将 Community-local Kanban 状态迁到 `article_community_id` 作用域；
- 更新 Gate Context、GraphQL contract、前端 cache identity、测试和源级文档；
- 验证移除一个 placement 不会删除共享 Article 或影响其他 Community placement。
