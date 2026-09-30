# Article Revision / Draft 目标架构

> 状态：planned
>
> 本文定义 Article 内容存储的下一版目标模型。当前运行时仍以
> [Gate V3](../gate/v3.md) 的 Public / Draft 双物理行方案为准；本文实施后，
> 将替代 Gate V3 中 Article 内容 head、DocSnapshot 和 publish copy 的相关部分。
> Gate、Lifecycle、Doc Tree 和 Doc Release 的职责边界继续有效。

## 0. 决策摘要

目标模型选择：

```text
Stable Article identity
        |
        +---- Mutable Draft workspace
        |
        +---- Immutable published Revision
        |             |
        |             `---- Immutable ArticleBodySnapshot
        |
        `---- ArticlePublic
                     current public revision pointer
                     + public query projection
```

核心决策：

1. `Article` 是稳定的逻辑实体。Comment、Interaction、ArticleStats、Activity 等运行时关系只引用它。
2. `Draft` 是可变工作区。自动保存只更新 Draft，不创建 Revision。
3. 普通 `ArticleRevision` 是一次不可变的已发布内容，不是产品级历史；旧
   Revision 在安全期内暂存，之后由 Cleanup 删除。
4. `ArticlePublic` 同时保存当前公开 Revision 的选择结果和公共查询所需的 Projection；不再增加独立的 `ArticlePublication`。
5. 不创建 `DraftProjection`。编辑器和管理后台直接读取 Draft。
6. 公共列表、详情和搜索不扫描 Revision 历史；它们读取 `ArticlePublic` 及必要的 thread-specific Projection。
7. 普通 Article 没有 Branch。只有 Doc 使用 `DocBranch`、branch-scoped Draft/Public、`DocBranchVersion`、Tree 和 Release；不预设尚未落地的 fork/promote 历史图。
8. Revision 公共表只保存共享版本内容；Post、Changelog、Doc 的专属字段分别进入强类型扩展表，不使用通用 `_data` 或 `_addon` JSONB。
9. 正文工作区与快照分别命名为 `ArticleBodyDraft` / `ArticleBodySnapshot`，对应 `cms.article_body_drafts` / `cms.article_body_snapshots`。只改标题时创建新 Revision，但复用原 `body_snapshot_id`。
10. 所有外部调用都经过 `CMS.Articles` 或 Doc 产品入口 `CMS.Docs`；caller 不直接写 Draft、Revision、ArticlePublic 或 Projection 表。
11. 本次是直接替换：不兼容旧数据，不保留旧逻辑、旧 GraphQL contract、双写、shadow read 或 backfill。
12. `cms.articles.id` 直接使用 UUID，取代当前 `article_hash_id` 的逻辑身份；目标模型不再同时维护两套稳定 Article id。
13. 普通 Article 不提供历史列表、历史 Diff 或 Restore；编辑事实由现有
    Activity V3 长期记录。Doc 才通过 `DocBranchVersion` 保留可浏览、可恢复的
    发布历史。
14. 服务端不保存未发布 Draft 的 checkpoint 历史；每个实际交付的 Article 编辑器都必须
    使用 Core `LocalDraftHistory`，通过 IndexedDB 提供同账号、同浏览器内的工作副本与
    有限恢复记录。Doc 是 v1 必达基线；未交付编辑器的 thread 不预建空 adapter。
    它是尽力而为的编辑体验，不是跨设备、协作或审计合同。

## 1. 当前模型

### 1.1 当前物理结构

Post、Blog、Changelog 和 Doc 的内容表同时存 Draft 与 Public，通过 `stage` 区分：

```text
                         same logical article_hash_id
                                      |
                  +-------------------+-------------------+
                  |                                       |
                  v                                       v
        ProductArticle row                         ProductArticle row
        stage = public                             stage = draft
        physical id = 101                          physical id = 208
                  |                                       |
                  v                                       v
        ArticleDocument(101)                    ArticleDocument(208)

        comments / stats / runtime              editable version fields
        attach to public row                    and versioned relations
```

第一次 Publish 会把 Draft 行提升为 Public；再次 Publish 会：

```text
Draft row
  -> copy version fields to stable Public row
  -> publish versioned relations
  -> copy ArticleDocument
  -> copy asset refs
  -> preserve Public runtime fields
  -> delete Draft row
  -> delete Draft ArticleDocument / owned cover
```

普通 Article 不创建历史 Snapshot；Doc Publish 额外创建 `DocSnapshot`。

### 1.2 当前方案解决了什么

现有设计并非错误实现。它已经解决：

- 已发布内容和编辑中内容可以同时存在；
- Public 在编辑期间保持稳定；
- Draft 使用 `expected_version` 做 optimistic concurrency guard；
- 公共运行时数据在 republish 时不会被 Draft 覆盖；
- Doc 的 branch、snapshot、tree、release 已与普通 Article 分开。

### 1.3 当前方案的问题

#### 逻辑身份与内容版本混在产品行里

一篇逻辑 Article 同时由 `article_hash_id` 和两个物理 Article row 表达。很多 caller 必须理解：

```text
logical identity != physical article.id
draft article.id   != public article.id
```

于是 Comment、Stats、Search、Assets、Document、Gate loader 和 GraphQL DTO 都要判断自己需要哪一个 id。

#### `stage` 承担了过多语义

`stage` 同时被用来表达：

- 当前行是不是编辑工作区；
- 当前行是不是公开读模型；
- 哪个物理 row 是运行时锚点；
- Publish 应复制还是提升；
- Reader 应读取 Draft、Public 还是 editor fallback。

这些不是同一个问题，却被压进一张产品表的 row role。

#### Publish 是易漏项的 aggregate copy

每新增一个版本化字段或关系，都必须同步修改 Draft 创建、Publish copy、Diff、DocSnapshot、Restore、Import、Search 和测试。遗漏其中任一环节，就会出现 Draft 正确但 Public 丢字段，或 Restore 后关系不完整。

#### 内容切换缺少不可变边界

普通 Article 不需要对用户提供完整发布历史，但当前 republish 仍是对
Public 物理行做 aggregate copy。这使公开内容切换、异步副作用和短期运维恢复
绑在一次覆盖写中。目标模型用不可变 Revision 完成原子 pointer 切换，
但普通旧 Revision 只作为短期安全缓冲；长期的“谁在何时修改了什么”
仍由 Activity 负责。

#### Draft 删除等于丢失编辑状态

Publish 成功后 Draft 被删除是合理的，但当前缺少一个明确的 `discard_draft` 领域操作。caller 若自行删 Draft row，还必须知道如何清理 Document、relations、assets 和 Doc tree staged events。

#### Public row 既是内容副本又是运行时实体

稳定 Public row 的好处是保留 comments、stats 等运行时关系；代价是每次 Publish 必须把整个版本化 aggregate 投影回这个 row。内容事实和运行时身份因此长期耦合。

## 2. 对 EmDash 的借鉴

本节基于 EmDash commit
[`584f166`](https://github.com/emdash-cms/emdash/tree/584f1661e5a2c8533c593af27b0e1852d2a8c663)
及其 [Content Lifecycle 文档](https://docs.emdashcms.com/reference/content-lifecycle/)。

### 2.1 EmDash 的核心模型

```text
Content entry (stable)
   |
   +-- live_revision_id  ------> Revision(full JSON snapshot)
   |
   `-- draft_revision_id -----> Revision(full JSON snapshot)
```

Publish 的本质是指针切换：

```text
live_revision_id  = draft_revision_id
draft_revision_id = null
```

Discard Draft 的本质是：

```text
draft_revision_id = null
live_revision_id  unchanged
```

Restore 不直接修改 live；它将选中的历史 Revision 复制成新的 Draft，再走正常 Publish。

### 2.2 值得直接借鉴的部分

- 稳定内容实体与内容版本分离；
- Revision 不可变；
- Publish 选择一个 Revision，而不是把 Draft aggregate 逐字段覆盖到 Public row；
- 需要历史的 Doc 在 Restore 时永远回到 Draft，不直接 Publish；普通 Article
  不因此引入历史 Restore；
- Autosave 与 retained history 分开；
- live/draft pointer 是显式事实，Discard Draft 是一等领域操作；
- Revision GC 从当前 live/draft 和其他永久引用出发做可达性保留。

### 2.3 不直接照搬的部分

EmDash 的 Revision 使用完整 JSON payload，适合通用 CMS。Groupher 已有明确的 Post、Changelog、Doc 领域和高频公共查询，因此目标模型不采用单个通用 JSON 内容桶：

```text
EmDash                         Groupher target
---------------------------    --------------------------------------
Revision(full JSON)            ArticleRevision common envelope
                               + PostRevision / ChangelogRevision /
                                 DocRevision typed extension

content live pointer           ArticlePublic pointer + query projection

generic content entry          stable CMS Article + product-specific data

all content follows one flow   ordinary Article has no Branch;
                               only Doc owns Branch / Tree / Release
```

借鉴的是“稳定 identity + immutable revision + explicit heads”，不是其通用 JSON schema。

## 3. 目标心智模型

### 3.1 普通 Article

```text
                              CMS.Article
                           stable article_id
                                  |
             +--------------------+--------------------+
             |                    |                    |
             v                    v                    v
      ArticleLifecycle       ArticleDraft         ArticlePublic
      resource state         mutable workspace    current public read model
                                  |                    |
                                  | publish            | revision_id
                                  v                    v
                           ArticleRevision <-----------+
                           immutable published content
                                  |
                                  v
                         ArticleBodySnapshot
```

编辑不会碰 Public：

```text
ArticlePublic(revision = r7)
        |
        +---- start editing ----> ArticleDraft(base_revision = r7)
                                         |
                                         +---- autosave in place

public readers still see r7
```

发布：

```text
ArticleDraft
  -> create immutable Revision r8
  -> ArticlePublic.revision_id = r8
  -> refresh ArticlePublic projection columns
  -> delete Draft workspace
```

### 3.2 Doc

Doc 复用 Article identity、Revision 和 ArticleBodySnapshot，但 branch workspace 只存在于 Docs：

```text
CMS.Article(thread = doc)
        |
        +-- ArticleRevision / DocRevision / ArticleBodySnapshot
        |
        `-- DocBranch
              |
              +-- DocDraft(branch)
              +-- DocBranchVersion(branch -> revision)
              +-- DocPublic(branch -> branch version)
              +-- DocLifecycle(branch)
              +-- DocTree draft/public
              `-- DocPublishRelease
```

普通 Article 不获得 `branch_id`、BranchHead、Fork、Promote 或 Release API。

## 4. 概念与职责

| 概念                        | 回答的问题                                    | 明确不负责                                   |
| --------------------------- | --------------------------------------------- | -------------------------------------------- |
| `Article`                   | 这是不是同一篇逻辑文章？                      | 当前内容、权限、生命周期状态                 |
| `ArticleDraft` / `DocDraft` | 当前正在编辑什么？                            | 历史、公共读取                               |
| `ArticleRevision`           | 某次 Publish 产生的不可变逻辑内容是什么？     | 长期历史策略、当前是否公开、Doc branch       |
| `DocRevision`               | 某个 Doc 的不可变内容是什么？                 | 它在哪个 branch 上发布                       |
| `DocBranchVersion`          | 某个 Doc 在某个 branch 上的第几个发布版本？   | 保存内容、普通 Article、预设 fork/promote 图 |
| `ArticleBodySnapshot`       | Revision 引用的不可变正文是什么？             | 标题、thread 专属字段、当前 Draft            |
| `ArticlePublic`             | 普通 Article 当前公开哪一版，公共查询读什么？ | Draft、旧 Revision 的清理策略                |
| `DocPublic`                 | 某个 Doc branch 当前发布哪一版？              | main branch 公共可见性规则                   |
| `ArticleLifecycle`          | 普通 Article 当前资源状态是什么？             | revision pointer、Draft 是否存在             |
| `DocLifecycle`              | 某 Doc 在某 branch 的资源状态是什么？         | Tree、Release、Revision 内容                 |
| Gate                        | actor 能否执行 action / query 能读哪些行？    | 保存业务数据、拥有 Lifecycle                 |
| `DocPublishRelease`         | 一次 Docs 发布精确包含哪些内容和树？          | 保存正文副本                                 |

Lifecycle 状态和内容 head 必须继续正交：

```text
ArticleLifecycle = published
ArticlePublic     = r7
ArticleDraft      = editing from r7
```

这表示文章已经公开，同时存在未发布修改；不是状态冲突。

## 5. 目标物理模型

以下字段用于固定 ownership，不是最终 migration 的逐列清单。

### 5.1 `cms.articles`：稳定 aggregate root

```text
cms.articles
├── id                  UUID / PK；唯一 canonical Article identity
├── community_id
├── thread              post | blog | changelog | doc
├── author_id
├── inner_id            community + thread 内的公共序号，可为空直到首次发布
├── moderation_state    legal | audit_failed | illegal
├── illegal_reason / illegal_words
├── active_at
├── is_sunk / last_active_at
├── is_edited            published Article 曾进入后续编辑，单调 false -> true
├── comments_locked
├── next_floor
├── next_comment_inner_id
├── inserted_at
└── updated_at
```

规则：

- 一篇文章从 Draft 创建到多次 Publish，`article.id` 永远不变；
- Comment、Interaction、ArticleStats、Trash、Activity、CommandReceipt 等引用 `article.id`；
- `cms.articles` 不保存 title、body、tags、`stage`、current revision pointer 或 branch；
- `article.id` 直接承担当前 `article_hash_id` 的稳定 UUID 语义；旧的产品行 bigint id 和 `article_hash_id` 名称不进入目标模型；
- public API 可将 UUID 作为 opaque Article ref，公共 URL 仍可使用 community + thread + `inner_id`；
- `UNIQUE(community_id, thread, inner_id) WHERE inner_id IS NOT NULL`；
- `thread` 是产品判别信息，不意味着所有产品内容合并到一张 JSON 表。

`moderation_state` 是唯一审核状态来源；不再同时保留 `pending` 与
`meta.is_legal` 两套表达。Gate/Scope 消费该事实，但不拥有它。审核变化不创建
Revision；它在同一领域事务中更新 stable Article、公共可见性和 Search。

`active_at`、sink、评论锁和评论序号属于稳定 Article 的运行状态，不随 Revision
复制。这里不为它们新建总括表；字段量或独立工作流未来确实增长时，再按具体领域拆分。

### 5.1.1 现行字段 ownership

| 当前字段/关系                                        | 目标权威来源                                                                                           | `ArticlePublic` 中的角色                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `title/digest/slug/body`                             | Draft → Revision                                                                                       | Publish 时投影                                                              |
| `cat/status`                                         | stable `PostState` operational fields                                                                  | 直接更新并刷新 Projection；不创建 Draft/Revision                            |
| `copy_right/link_addr`                               | typed Draft → typed Revision                                                                           | Publish 时投影                                                              |
| `cover_url/cover_url_dark`                           | Draft/Revision 的 immutable asset relation                                                             | Publish 时投影 URL/thumbnail                                                |
| community tags                                       | Draft relation → revision-scoped relation                                                              | 通过当前 `ArticlePublic.revision_id` join，不复制第二套 Public tag relation |
| `pending/is_legal/illegal_reason/illegal_words`      | stable Article 的 moderation fields                                                                    | 可镜像用于 public filter，但不是权威                                        |
| `active_at/is_sunk/last_active_at/can_undo_sink`     | stable Article；`can_undo_sink` 派生                                                                   | 可镜像 `active_at` 用于排序                                                 |
| `is_comment_locked/next_floor/next_comment_inner_id` | stable Article 的 comment state                                                                        | 不属于内容 Projection                                                       |
| views/comments/upvotes/collects/emotions             | `ArticleStats` + Interaction facts                                                                     | 查询时 join 或投影 count                                                    |
| `upvoted_user_ids/reported_count`                    | typed `*_reaction_infos` 等 ReadState Projection（RoaringBitmap + count），按 stable `article_id` 重建 | viewer/management projection                                                |
| `is_edited`                                          | stable Article 的单调标志                                                                              | 可投影；与 `has_unpublished_changes` 不同                                   |
| `PinnedArticle`                                      | stable `article_id` 的 placement relation                                                              | public list join/projection                                                 |
| mirrored communities / community placement           | stable `article_id` 的 placement relations                                                             | public list join/projection                                                 |
| `PostSolution`                                       | stable Article ↔ Comment relation                                                                      | Post detail projection                                                      |
| `inner_id`                                           | stable Article                                                                                         | public route/list key                                                       |

`ArticlePublic` 因而包含两类列：

```text
Revision-derived content projection
  title / digest / slug / cover / body summary ...

Operational public projection
  cat / status / moderation visibility / active_at / placement flags ...
```

第一类可从 Revision 重建；第二类从 stable Article、ArticleStats 和 placement facts
重建。更新第二类不创建 Revision，但必须在 owner transaction 中同步或失效公共 Projection。
tags 是多值 immutable relation，不作为 `ArticlePublic` scalar/json 列复制；公共列表与
详情通过 `ArticlePublic.revision_id -> {thread}_revision_tags` 读取。Search、Press 和 Feed
在各自 read model 中投影 tags。只有真实性能数据证明这条 indexed join 是热点时，才另行
设计 Public tag projection，不在本次目标模型中预建第二套关系。

Post 的即时分类/工作流状态使用 typed stable table，不塞进通用 Article：

```text
cms.post_states
├── article_id  PK / FK -> articles
├── cat
├── status
└── updated_at
```

`cat/status` 可在存在 Draft 时直接修改，不进入内容版本历史。`set_cat`
仍在同一事务内联动 Comment question flag；两者都必须刷新 Public
Projection、cache/search 和 Activity。community tags 和 cover 则是内容关系：
它们先写 Draft，Publish 后进入 Revision；Doc Restore 时一起恢复。

`is_edited` 表示“已发布 Article 曾发生后续 Draft 写入”，不是“当前存在 Draft”或
“已经发布第二版”。首次发布前保持 `false`；对已发布 Article 首次成功创建或更新
后续 Draft 时，在同一事务内单调置为 `true`。之后 Publish、Discard 或再次编辑都不
重置它。

### 5.2 Mutable Draft

普通 Article：

```text
cms.article_drafts
├── article_id              PK / FK -> articles
├── base_revision_id        创建 Draft 时观察到的 Public Revision
├── version                 optimistic concurrency token
├── title / digest / slug   shared mutable fields
├── body_draft_id
├── content_hash
├── updated_by_id
└── updated_at

cms.post_drafts             PK/FK article_id + post-only fields
cms.blog_drafts             PK/FK article_id + blog-only fields
cms.changelog_drafts        PK/FK article_id + changelog-only fields

cms.post_draft_tags         (article_id, tag_id)
cms.blog_draft_tags         (article_id, tag_id)
cms.changelog_draft_tags    (article_id, tag_id)
```

Doc 不把 branch 塞进普通 ArticleDraft：

```text
cms.doc_drafts
├── article_id
├── branch_id
├── base_revision_id
├── source_revision_id
├── version
├── title / digest / slug / subtitle
├── body_draft_id
├── content_hash
├── updated_by_id
└── updated_at

UNIQUE(article_id, branch_id)

cms.doc_draft_tags          (article_id, branch_id, tag_id)
```

`ArticleBodyDraft` 是可变正文工作区。Autosave 更新 Draft 与 ArticleBodyDraft，并递增 Draft `version`；它不写 Revision。

普通 Draft 只需 `base_revision_id`，用于发现编辑期间 Public 是否前进。
普通 Article 不提供历史 Restore，因此不保存 `source_revision_id`。Doc 的
`source_revision_id` 只表达“当前 Draft 是从哪个已发布 Revision 复制的”；
它不让 Restore 直接改变 Public。

### 5.3 Immutable Revision

```text
cms.article_revisions
├── id
├── article_id
├── title / digest / slug    shared version fields
├── body_snapshot_id
├── content_hash             diff/cache fingerprint，不做 Revision 去重键
├── schema_version
└── inserted_at
```

Thread-specific 1:1 扩展：

```text
cms.post_revisions
└── revision_id PK/FK + copyright/post content fields

cms.blog_revisions
└── revision_id PK/FK + blog fields

cms.changelog_revisions
└── revision_id PK/FK + version/release/link fields

cms.doc_revisions
└── revision_id PK/FK + subtitle/link_addr/template/doc fields
```

每次 Publish 都创建一条 Revision；不按 `content_hash` 复用 Revision。
标题、tags、cover 等小数据可以重复，真正大的正文由
`ArticleBodySnapshot` 按 `body_hash` 去重。普通 Article 的 Revision 不带线性版本号，
也不对用户提供历史时间线；发布人、发布时间和变更字段由
`ArticlePublic` 与 Activity 记录。

Revision 只知道“这篇 Article 的内容版本是什么”，不拥有：

- live/draft/stage；
- Branch head；
- Lifecycle；
- Gate policy；
- comments、views、reactions、collects；
- search index job 状态。

普通 Article 不提供 Revision drawer、历史 Diff 或 Restore。旧 Revision 在
Cleanup 安全期内仅用于失败排查和运维恢复，不构成产品合同。
Doc 的长期历史由 `DocBranchVersion` 指向 Revision 来表达。

版本化 tags、cover 和其他关系使用 revision-scoped typed tables：

```text
post_revision_tags(revision_id, tag_id)
blog_revision_tags(revision_id, tag_id)
changelog_revision_tags(revision_id, tag_id)
doc_revision_tags(revision_id, tag_id)

revision_covers(revision_id, asset_id, theme)
revision_cover_edits(revision_id, canvas_width, canvas_height, version,
                     light_background_id, light_original_background_id,
                     light_images {:array, :map},
                     dark_background_id, dark_original_background_id,
                     dark_images {:array, :map})
```

不把这些集合塞进一个 `_data` / `_addon` JSONB。

`revision_covers` 表达最终选中的 asset/URL；`revision_cover_edits` 保存当前
`CoverEditInfo` 的完整可编辑快照，包括 canvas 尺寸、版本、light/dark 背景与
有序 image layers。Doc Restore 同时恢复两者，不能只恢复 `cover_url` 而丢失裁切/布局状态。
`content_hash` 必须包含规范化后的 typed fields、tags、cover asset 与
cover edit snapshot fingerprint，否则 `has_unpublished_changes` 和 Diff 会产生假阴性。

### 5.4 ArticleBodyDraft 与 ArticleBodySnapshot

```text
cms.article_body_drafts       mutable，由 ArticleDraft / DocDraft 引用
cms.article_body_snapshots    immutable，由 ArticleRevision 引用
```

```text
ArticleBodyDraft                      ArticleBodySnapshot
-------------------------------    --------------------------------
mutable                            immutable
owned by current Draft             referenced by one or more Revisions
autosave updates in place          content-addressed / deduplicated
editor source + derived cache      canonical body + reproducible metadata
```

只改标题的例子：

```text
r41
├── title = "Old title"
└── body_snapshot_id = d7

edit title only
        |
        v
r42
├── title = "New title"
└── body_snapshot_id = d7    same body, no full-text copy
```

正文改变时才创建新的 `ArticleBodySnapshot d8`。可按 canonical body hash 唯一化：

```text
UNIQUE(body_hash, schema_version)
```

若某类派生字段可以由 canonical body 稳定重建，则不把它当作用户版本事实重复保存；若重建依赖可能变化的 renderer，则 Snapshot 必须记录 renderer/schema version。

### 5.5 `ArticlePublic`：选择 + Projection

普通 Article：

```text
cms.article_publics
├── article_id              PK / FK -> articles
├── revision_id             FK -> article_revisions
├── published_at
├── published_by_id
├── publication_version     concurrency/cache token
├── title / digest / slug
├── body_hash / excerpt / thumbnail
├── content projection fields
├── moderation visibility / active_at
├── placement/list projection fields
└── updated_at
```

`ArticlePublic` 的两种职责是刻意合并的：

1. `revision_id` 表达当前公开内容；
2. 内容列从 Revision 重建；
3. moderation、activity 和 placement 列从各自 stable facts 重建。

不再增加一张只保存 pointer 的 `ArticlePublication`，也不再给普通 Article 建 `PostPublicProjection`。只有当某个 thread 的公开列表字段明显不同且增长到不适合公共表时，才增加：

```text
PostProjection
ChangelogProjection
```

名称不带 `Public`，因为 Projection 在本模型中默认就是公共读模型。Draft 没有 Projection。

Doc 的 branch head 保留在 Doc 域：

```text
cms.doc_publics
├── article_id
├── branch_id
├── branch_version_id       FK -> doc_branch_versions
├── published_at / published_by_id
└── Doc public projection fields

UNIQUE(article_id, branch_id)
```

`branch_version_id` 通过不可变的 `DocBranchVersion.revision_id` 唯一定位内容。
`DocPublic` 不再同时保存两个可独立更改的 pointer，避免 version 和
revision 不一致。

公共 URL、Press、Feed 仍由 Gate Scope 限制到 main branch；非 main `DocPublic` 只供 Dashboard 团队读取。

## 6. 核心流程

### 6.1 创建与 Autosave

```text
CMS.Articles.create_draft
  -> create stable Article
  -> ArticleLifecycle = draft_only
  -> create ArticleDraft + typed Draft + ArticleBodyDraft
  -> return article_id + draft version

autosave(expected_version = 12)
  -> Gate.scope(:read_draft) / Gate.access_check(:edit)
  -> lock stable Article + Lifecycle as required
  -> UPDATE Draft ... WHERE version = 12
  -> version = 13
  -> no Revision
```

新建 Draft 不是 Revision。否则几秒一次的 autosave 会无限增长历史。

### 6.2 第一次 Publish

```text
Draft(version=13)
  -> Gate.access_check(:publish, article)
  -> validate expected Draft/Lifecycle version
  -> create/reuse ArticleBodySnapshot d1
  -> create ArticleRevision r1
  -> create ArticlePublic(article_id, revision_id=r1, projection...)
  -> Lifecycle.transition(:published)
  -> run first-publish finalization
  -> delete Draft workspace
  -> enqueue effects keyed by article_id + revision_id
```

首次发布不再把 Draft row 改成 Public row。稳定 identity 已由 `Article` 提供。

`first-publish finalization` 是 Publish 事务的显式步骤，包括分配
`inner_id`、community mirror、tag stats 激活、community/user publish count 与
counter、`PublishRateLimit.record` 以及 `ArticleStats.initialize`。缩略图在生成
`ArticleBodySnapshot` 时编译，再投影到 `ArticlePublic`。管理员通知等非原子
副作用在 commit 后执行。

### 6.3 Republish

```text
ArticlePublic -> r7
ArticleDraft(base_revision = r7)
        |
        v
create Revision r8
        |
        +-- ArticlePublic = r8
        +-- rebuild ArticlePublic projection
        +-- delete Draft
        `-- keep r7 until cleanup_after, then delete when unreferenced
```

Publish 事务不再逐字段覆盖带有 runtime relations 的 Public Article row。Runtime relations 已直接挂在稳定 `article.id` 上。

### 6.4 Discard Draft

`discard_draft` 表达“放弃尚未发布的编辑”，不是删除文章：

```text
published Article
  ArticlePublic -> r7
  ArticleDraft   -> editing from r7

discard_draft
  -> Gate.access_check(:discard_draft, article)
  -> delete ArticleDraft / typed Draft / ArticleBodyDraft
  -> release Draft-only asset refs
  -> ArticlePublic still points to r7
  -> Lifecycle remains published
```

边界：

- 从未发布的 `draft_only` Article 没有可回退的 Public，不能使用 `discard_draft` 留下一篇无内容 Article；UI 应走 Trash/Delete；
- Doc discard 由 `CMS.Docs` 编排，除 DocDraft 外还清理该 branch 的 doc-bound staged tree events；
- caller 不能直接删除 Draft 表。

Trash 与 Discard 的语义不同。Trash 只通过 Lifecycle 隐藏并冻结整个 aggregate：

- 已有 ArticleDraft/DocDraft、ArticleBodyDraft 和相应 asset refs 全部保留；
- deleted 状态下 Gate 拒绝 edit/publish，Public 也不再对外可见；
- restore 只恢复 Trash 前的 Lifecycle 状态，之前的 Draft 继续可编辑，不需要把
  Draft 状态塞进 `TrashedArticle.restore_state`；
- Docs Trash 同时保留恢复该 Draft 所需的 branch/tree staged state；
- 只有 permanently delete 才删除 Draft、Public、Revision、DocBranchVersion
  以及其他 aggregate 数据。

### 6.5 前端本地 Draft History 取代服务端 Checkpoint

当前 Doc 编辑器会在 autosave 后延迟约 2 分钟写一条 Draft Snapshot。它解决的
不是发布正确性，而是“找回某次自动保存前的未发布内容”：例如用户连续
编辑半小时后误删大段正文，希望回到 10 分钟前的 Draft。

这个需求适用于每个实际交付的 Article 编辑器，但不需要进入服务端 Revision 模型。
目标边界是：

```text
server
├── current mutable Draft
├── autosave + expected_version
└── immutable Revision created only by Publish

frontend/core
└── LocalDraftHistory (IndexedDB)
    ├── one overwritable Local Working Copy
    └── limited LocalDraftRecoveryPoints
```

本地历史是同账号、同浏览器内尽力而为的恢复能力。它不承诺跨设备同步、多人协作
历史、审计或法律保全；清除浏览器数据、隐私模式或浏览器存储回收都可能使记录丢失。
这些限制在当前产品范围内可接受，换取前后端统一且更简单的 Draft/Revision 合同。

#### 6.5.1 Workspace identity 与存储结构

Core 提供 host-neutral 的 `LocalDraftHistory`；每个实际交付的 thread editor 只通过统一
adapter 提供可序列化 Draft payload，不各自实现存储。一个本地 workspace 由下列字段
唯一确定：

```text
account_id + community_id + thread + article_id + branch_id
```

`account_id` 防止同一浏览器切换账号后读到其他用户记录；普通 Article 的
`branch_id = null`，Doc 使用真实 branch id。

IndexedDB 使用两个内容 object store，避免把覆盖写与追加历史混在一起；另用一个派生
usage store 维护软预算记账，避免每次约 3 秒 Working Copy 覆盖写都扫描全部记录：

```text
local_draft_working_copies
├── key: workspace_key
├── index: account_id
├── index: account_id + updated_at
└── value: latest payload + local/base-server state + byte_size + updated_at

local_draft_recovery_points
├── key: id
├── index: workspace_key + created_at
├── index: account_id + created_at
├── index: expires_at
└── value: immutable recovery point

local_draft_usage
├── key: scope_key
├── index: account_id
├── account:<account_id>
│   └── schema_version + account_id + byte_size + recovery_point_count + updated_at
└── workspace:<workspace_key>
    └── schema_version + account_id + byte_size + recovery_point_count + updated_at
```

`workspace_key` 由上述 identity 规范化生成。数据库和 record 都带 `schema_version`；
版本不兼容时丢弃旧本地记录，不为非权威缓存维护复杂 migration。

```text
LocalDraftRecoveryPoint
├── id
├── schema_version
├── account_id / community_id
├── article_id / thread / branch_id
├── base_revision_id
├── base_server_draft_version
├── base_server_content_hash
├── local_payload_hash
├── byte_size
├── created_at / expires_at
└── payload
    ├── title / digest / slug / canonical body JSON
    ├── thread-specific typed fields
    ├── tag ids
    └── cover asset ids + cover edit state
```

只保存可恢复的 canonical source 和稳定 asset id；不复制 HTML、TOC 等派生缓存，也不
把图片二进制写进 IndexedDB。恢复后重新生成派生内容。

服务端与本地不共同实现一套 hash 算法：

```text
server content_hash
  -> Elixir 根据服务端 canonical content 计算
  -> Draft DTO 原样返回
  -> TypeScript 只作为 opaque value 保存和比较

local_payload_hash
  -> TypeScript 根据 adapter 的完整规范化 payload 计算
  -> 只用于 Working Copy / Recovery Point 去重
  -> 不与 server content_hash 比较
```

Local Working Copy 除 payload 外必须保存：

```text
base_server_draft_version
base_server_content_hash
local_payload_hash
byte_size
dirty
writer_session_id
```

`schema_version` 约束 TypeScript 本地 canonicalization；版本不兼容时丢弃旧记录，因此
不需要维护 Elixir/TypeScript 跨语言 hash test vectors。adapter 的 local payload 必须覆盖
typed fields、tags 和 cover，否则本地去重仍会漏记内容变化。

#### 6.5.2 写入策略

本地存储分成两个目的不同的记录：

```text
editor onChange
  -> update in-memory state immediately
  -> throttled trailing write, at most once per about 3 seconds
  -> visibilitychange:hidden / pagehide attempts one final flush
  -> overwrite Local Working Copy

content changed for about 2 minutes
  -> append LocalDraftRecoveryPoint when local_payload_hash changed
```

Working Copy 用于刷新、崩溃或尚未完成服务端 autosave 时的最新输入恢复；Recovery Point
用于从误删、错误粘贴等操作回到较早的本地状态。IndexedDB 写入失败必须 fail open：
不能阻塞编辑器、服务端 autosave 或 Publish。fail open 不等于静默失败；重试仍失败时，
必须将本地历史标记为 unavailable，并在本地历史入口提示“本地恢复空间不足或不可用”。
不依赖异步 `beforeunload` 完成最后写入。

初始容量策略：

```text
same local_payload_hash   -> do not append duplicate point
max points per workspace  -> 30
max bytes per workspace   -> 20 MiB
max bytes per account     -> 100 MiB
expires_after             -> 7 days
over limit                -> delete oldest first, then retry once
incompatible schema       -> discard local record
```

初版保存全量 payload，不引入增量 diff、压缩链或依赖前一条记录才能恢复的 patch chain。
每条内容记录在写入前按下列统一口径计算并持久化 `byte_size`：

```text
byte_size = UTF-8 byte length(
  JSON.stringify(canonical record excluding byte_size)
)
```

这里计算的是包含 metadata 与 payload 的规范化 record JSON，不只是正文；不包含
`byte_size` 自身，也不包含只由 asset id 引用的图片二进制。它是应用层可重复计算的近似占用，
不是浏览器报告的 IndexedDB 物理空间。所有 adapter 使用 Core 提供的同一序列化与
`TextEncoder` 计量函数，不能自行选择字段或字符口径。

软预算覆盖两个内容 store：workspace 用量等于该 workspace 的 Working Copy 加全部
Recovery Points，account 用量等于该账号全部 workspace 的 Working Copies 加 Recovery
Points。`local_draft_usage` 只是从内容记录派生的记账索引，不是领域事实；内容 record 的
新增、覆盖、删除必须与 workspace/account usage 在同一 IndexedDB transaction 内完成：

```text
overwrite Working Copy -> bytes += new_byte_size - old_byte_size
append Recovery Point  -> bytes += byte_size; points += 1
delete Recovery Point  -> bytes -= byte_size; points -= 1
delete Working Copy    -> bytes -= byte_size
```

usage store 采用稀疏表示：当一个 workspace 已没有 Working Copy 和 Recovery Point 时，
在同一事务删除 `workspace:<workspace_key>` row，不保留零值；当账号已没有任何本地内容记录
时，同样删除 `account:<account_id>` row。全量重建也只创建非空 scope，保证增量结果和重建
结果可以按 row 集合直接比较。

usage row 缺失、出现负值、schema upgrade 或事务异常恢复时，通过两个内容 store 的
`account_id`/workspace 索引扫描已有 `byte_size`，一次性重建对应 workspace 与 account
记账；正常 open/write 不做全表求和。20/100 MiB 是修剪目标，不是 IndexedDB 约束。
浏览器 quota 是独立硬限制，仍可能低于软预算，因此 `QuotaExceededError` 走上述可见的
fail-open 降级。

写入前后的修剪顺序固定为：

```text
1. delete expired Recovery Points
2. workspace over budget -> delete its oldest Recovery Points
3. account over budget   -> delete this account's oldest Recovery Points across workspaces
4. delete any residual dirty = false Working Copies
5. retry once and recompute usage
```

步骤 2/3 分别使用 `workspace_key + created_at` 与 `account_id + created_at` 索引。dirty
Working Copy 计入 workspace/account 用量，但永不因软预算被自动淘汰；它自身可以让统计值
高于 20/100 MiB，此时停止新增 Recovery Point 并将本地历史标记为 unavailable，同时继续
best-effort 覆盖保存 dirty Working Copy。若浏览器 quota 连 Working Copy 也无法写入，同样
显示 unavailable，但不能影响内存编辑、服务端 autosave 或 Publish。显式 logout 通过三个
store 的 `account_id` 索引删除当前账号的内容记录和 usage rows，不做全表扫描。Permanently
Delete 在删除两个内容 store 的 article 记录时收集实际受影响的 `workspace_key`，随后按
`workspace:<workspace_key>` 主键删除空 workspace usage row，并按 delta 更新 account row；
如果无法证明增量完整，则删除该 account usage row，再从剩余内容记录重建，不能保留猜测值。

Local Working Copy 不设置 `expires_at`。`dirty = true` 表示尚未可靠同步的用户输入，可以
计入空间占用判断，但不参与 TTL、条数或字节预算的自动淘汰。被遗弃 workspace 的 dirty
copy 可以长期保留；空间不足时宁可停止新增本地历史，也不能为了回收容量删除它。

#### 6.5.3 打开与恢复流程

打开编辑器时必须先加载服务端当前 Draft，再检查对应 workspace 的本地记录：

```text
load current server Draft
  -> load Local Working Copy
  -> dirty = false: delete synced copy; do not show recovery notice
  -> dirty = true and base_server_content_hash = current server content_hash
       -> local-only unsynced changes; show recovery notice
  -> dirty = true and base_server_content_hash != current server content_hash
       -> server also advanced; show divergent recovery/conflict notice
            ├── preview / diff
            ├── restore
            └── discard local copy
```

不能自动用本地记录覆盖服务端 Draft。用户选择恢复后，只把 recovery payload 写入当前
编辑器内存并标记 dirty，再走正常 autosave。历史记录中的 `base_server_draft_version` 只用于
展示来源，不能作为新的并发 token；autosave 必须携带刚加载的当前 Draft version。
若其他设备期间再次更新 Draft，现有 optimistic concurrency 正常拒绝旧请求并进入冲突处理。

每次服务端 autosave 成功后，如果当前编辑器内容仍与该响应对应，直接删除 synced Working
Copy；Recovery Points 独立保留，因此不会丢失本地历史。如果 autosave 飞行期间又产生了
新输入，则使用响应中的 Draft `version + content_hash` 更新 Working Copy 的
`base_server_draft_version/base_server_content_hash`，并继续保持 `dirty = true`。
TypeScript 不自行推导服务端 hash。若浏览器崩溃发生在标记 synced 与删除之间，下次打开
发现 `dirty = false` 时完成删除。

Publish 或 Discard 成功后删除该 workspace 的 Working Copy 和 Recovery Points；Doc
切换 branch 使用不同 workspace key。Trash 后 Recovery Points 按 `expires_at` 自然过期，
dirty Working Copy 继续保留且不参与过期清理。
显式 logout 删除当前 `account_id` 的全部本地记录；Permanently Delete 成功后删除该
Article 所有 branch workspace。

同 workspace 多标签页采用明确的 last-writer-wins，不实现自动 merge。每个标签页生成
`writer_session_id`，并通过 `BroadcastChannel` 通知同 workspace 的其他标签页；检测到其他
writer 时展示并发编辑提示。服务端 `expected_version` 仍是最终写入保护。

Recovery Point 中的 asset id 在恢复时重新校验。失效的 cover asset 降级为无封面，失效的
inline asset 保留缺失占位；UI 汇总提示缺失资源，但 title、body、tags 和其他有效内容仍可恢复，
不能因单个 asset 缺失拒绝整个恢复操作。

过期清理由 IndexedDB `expires_at` index 驱动，在数据库打开、打开本地历史以及成功写入后
分批触发；它只扫描 Recovery Points，不扫描 Working Copies。不建立 timer 或服务端 job，
每次只删除 bounded batch，避免阻塞编辑器启动。

#### 6.5.4 产品 UI

```text
each delivered Article editor
└── Local history
    └── IndexedDB Recovery Points

Doc only
└── Published versions
    └── server DocBranchVersion
```

普通 Article 因此获得本地误操作恢复，但不重新获得服务端 Revision history API/UI。
Doc 的本地历史与已发布 branch versions 是两套来源，UI 和文案必须明确区分。
v1 明确交付 Core repository/session/recovery UI 与 Doc adapter，用它替代现有服务端
staged checkpoint；Doc 是必达基线。Post、Blog、Changelog 在各自内容编辑器真正交付时
必须同时提供 adapter 与本地历史入口，不提前创建没有 editor state/payload consumer 的空实现。

### 6.6 Doc Restore Revision to Draft

```text
selected Revision r3
  -> CMS.Docs restore command
  -> Gate.access_check(:restore_revision_to_draft, doc)
  -> copy r3 logical content into new/current DocDraft
  -> DocDraft.base_revision_id = current DocPublic revision
  -> DocDraft.source_revision_id = r3
  -> DocPublic unchanged
  -> no Revision is created yet
  -> later normal Publish creates r9 + DocBranchVersion
```

这里的 Restore 不是第二种持久化状态，而是一条拷贝命令：把历史已发布
Revision 复制到当前 Draft。恢复 r3 不会删除 r4-r8，也不会让 Public
直接倒退。只在用户之后真正 Publish 时，才创建新 Revision 与
`DocBranchVersion`。普通 Article 不提供这个命令。

### 6.7 Diff

```text
ordinary Article: current Draft vs ArticlePublic.revision

Doc: current DocDraft vs DocPublic branch version
     Revision A vs Revision B
     current DocDraft vs selected Revision
```

Diff 是按需计算，不保存 O(R²) 的 pairwise diff。先比较 `content_hash`、字段和 relation fingerprints；只有正文 hash 不同时才运行 rich-editor AST diff。

## 7. Doc 专属内容

### 7.1 Branch 只属于 Doc

Doc 的 Draft/Public head 是 branch-scoped，但 Revision 本身仍是 Article 的不可变内容桶：

```text
DocBranch A                 DocBranch B
    |                           |
    +-- DocDraft                +-- DocDraft
    +-- DocPublic -> v10        +-- DocPublic -> v12
          |                           |
          +-> Revision r10            +-> Revision r12
```

Revision 不需要理解 main/preview/public 等领域规则。Branch 只负责组织
某个 Doc 的编辑与发布空间；Revision 只保存内容。

`DocBranchVersion` 表达“某个 Doc 在某个 branch 上的第几个已发布版本”：

```text
cms.doc_branch_versions
├── id
├── article_id
├── branch_id
├── revision_id
├── version_number
├── published_by_id
├── published_at
├── message
└── inserted_at

UNIQUE(article_id, branch_id, version_number)
```

Doc 的 branch-local 编号使用独立 counter row，不放在共享 `doc_branches`
上，避免一个 branch 下的不同 Article 互相消耗编号：

```text
cms.doc_branch_version_counters
├── article_id
├── branch_id
└── next_version_number  default 1

PRIMARY KEY(article_id, branch_id)
```

普通 Article 不分配产品版本号。Doc 从上述 counter row 分配 branch-local
version number；必须在当前 mutation lock 和同一数据库事务内执行原子递增，
事务回滚时 counter 一起回滚；禁止用未加锁的 `MAX(...) + 1`。

```text
main branch
  Draft -> Revision r20 -> BranchVersion v20 -> Public v20

preview-a
  ensure Draft from source branch Public
      -> edit Draft
      -> Revision r21 -> BranchVersion v1 -> Public v1
```

`DocBranch.source_branch_id` 足以记录 preview branch 创建时的来源，且只用于
初始化 Draft。目前产品没有一条已落地的通用 fork/promote 发布协议，因此不在
`DocBranchVersion` 预建 `action/parent/source` 图。将来若真正引入“把 preview 版本
提升到 main”的产品命令，再为该命令定义最小 provenance。

RevisionDrawer 按 `article_id + branch_id` 查询 `DocBranchVersion`，展示该 branch
的已发布版本。`DocPublic.branch_version_id` 定位当前版本，Diff 通过
`DocBranchVersion.revision_id` 加载前后 Revision。

### 7.2 当前 DocSnapshot 的逐字段去向

当前一条 `DocSnapshot` 同时混合内容、正文和 branch history。目标模型拆为：

```text
DocSnapshot #501
├── branch_id = preview-a
├── revision_number = 3
├── action = publish
├── parent_snapshot_id = #490
├── source_snapshot_id = null
├── title = "Quick Start"
├── subtitle = "Install in 5 minutes"
├── document_json / body_bag
├── data = %{template: "guide", cover: ...}
└── version_hash = "abc123"

                       becomes

ArticleRevision r900
├── title / digest / slug
├── body_snapshot_id = d77
└── content_hash = "abc123"

DocRevision r900
└── subtitle / link_addr / template / typed Doc content fields

ArticleBodySnapshot d77
└── document_json / body_bag / body_hash / schema_version

DocBranchVersion v3
└── branch=preview-a / number=3 / revision=r900 /
    published_by / published_at
```

| 当前 `DocSnapshot` 字段                         | 目标位置                                                                   | 说明                                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `title/digest/slug`                             | `ArticleRevision`                                                          | 共享版本内容                                                                                                                          |
| `subtitle`                                      | `DocRevision.subtitle`                                                     | Doc 副标题                                                                                                                            |
| `data.link_addr`                                | `DocRevision.link_addr`                                                    | 外链地址是版本内容                                                                                                                    |
| `data.template` 及新增 Doc scalar               | `DocRevision` 对应 typed column                                            | 每一项都需显式列名，不保留笼统 `data` 桶                                                                                              |
| `data.cover_url/cover_url_dark`                 | `revision_covers` + `ArticlePublic` URL projection                         | Revision 保留 asset 选择，Public 只投影渲染 URL                                                                                       |
| `data.cover.canvas_width/canvas_height/version` | `revision_cover_edits`                                                     | 封面编辑 canvas 快照                                                                                                                  |
| `data.cover.light/dark.background_id`           | `revision_cover_edits`                                                     | light/dark 的当前背景                                                                                                                 |
| `data.cover.light/dark.original_background_id`  | `revision_cover_edits`                                                     | 保留原背景用于可确定恢复                                                                                                              |
| `data.cover.light/dark.images`                  | `revision_cover_edits.light_images/dark_images` 的有序 `{:array, :map}` 列 | 完整保留图片裁切/布局参数；不是独立 relation                                                                                          |
| `data.community_tag_ids`                        | `doc_revision_tags(revision_id, tag_id)`                                   | tags 是版本化关系，不是 Runtime relation                                                                                              |
| `document_json/body_bag`                        | `ArticleBodySnapshot`                                                      | 可编辑 canonical source 与可恢复正文                                                                                                  |
| `version_hash`                                  | `ArticleRevision.content_hash`                                             | 完整逻辑内容 fingerprint                                                                                                              |
| `branch_id`                                     | `DocBranchVersion`                                                         | Branch 是 Docs 历史维度                                                                                                               |
| `revision_number`                               | `DocBranchVersion.version_number`                                          | 继续保持 branch-local 编号                                                                                                            |
| `action`                                        | 不作为目标持久化枚举                                                       | publish 由 `DocBranchVersion` 的存在表达；服务端自动 checkpoint 删除并由前端 LocalDraftHistory 替代；restore 是 Revision → Draft 命令 |
| `parent_snapshot_id`                            | 不迁移                                                                     | branch 内顺序由 `version_number` 表达，不保存通用链表                                                                                 |
| `source_snapshot_id`                            | `DocDraft.source_revision_id` + Activity metadata                          | Draft 期间保留 restore 来源；Publish 后由 Activity 记录动作，不在 Revision 预建 provenance 图                                         |
| `stage`                                         | 不进入 Revision                                                            | Draft/Public 由 DocDraft/DocPublic head 表达                                                                                          |
| Release `snapshot_id`                           | `branch_version_id`                                                        | 引用某 branch 的精确已发布版本，再由它定位 Revision                                                                                   |

以当前一条 `DocSnapshot.data` 为例：

```text
%{
  link_addr: "/guide/start",
  cover_url: "...",
  cover_url_dark: "...",
  community_tag_ids: [12, 19],
  cover: %{canvas_width: 1200, canvas_height: 630, version: 1,
           light: %{background_id: 3, original_background_id: 1, images: [...]},
           dark:  %{background_id: 8, original_background_id: 6, images: [...]}}
}

  -> DocRevision.link_addr
  -> revision_covers + ArticlePublic cover URL projection
  -> doc_revision_tags(12), doc_revision_tags(19)
  -> revision_cover_edits(canvas + light/dark complete config)
```

实现时必须以这张逐字段表为 checklist；不允许用“`subtitle`、`template` 等”
代替具体映射，否则 restore 会表面成功但丢失 link、tags 或封面编辑状态。

只改标题时，新 ArticleRevision 可以继续引用同一个 ArticleBodySnapshot。
Doc 每次 Publish 创建新 Revision 和新 `DocBranchVersion`；只复用没有变化的
ArticleBodySnapshot。

### 7.3 DocPublishRelease

Release 必须引用精确 `DocBranchVersion`，而不是可变 Article 或“最新版本”：

```text
DocPublishRelease #24
├── DocTreeSnapshot t9
├── article A -> branch version main/v10 -> revision r10
├── article B -> branch version main/v31 -> revision r31
└── article C -> branch version main/v8  -> revision r8
```

这样即使 A 后来发布 r11，Release #24 仍能完整重建。

现有 `DocSnapshot` 的职责由三部分吸收：

```text
DocSnapshot content history   -> ArticleRevision + DocRevision + ArticleBodySnapshot
DocSnapshot branch timeline    -> DocBranchVersion
DocSnapshot release membership -> DocPublishReleaseArticle(branch_version_id)
```

`DocPublishRelease` 不复制正文或专属字段，只引用 immutable
`DocBranchVersion` 和 Tree Snapshot。由 BranchVersion 再定位 Revision，可同时验证
Release 成员确实来自目标 branch。

## 8. Gate、Lifecycle 与领域操作

### 8.1 ownership 不变

```text
Reader
  -> typed Gate Scope Context
  -> Gate.scope
  -> Draft/Public query

Mutation
  -> stable Article identity
  -> Gate.access_check(actor, action, article)
  -> Lifecycle transition/version guard
  -> domain transaction
```

Gate 负责 actor/action admission；Lifecycle 负责 actor-independent resource state 和合法 transition。二者都不保存 revision pointer。

### 8.2 canonical resource

Gate 的 Article Access Context 应从稳定 `Article` 加载：

```text
Gate.Access.Load.article
  -> Article
  -> Community + CommunityLifecycle
  -> ArticleLifecycle or branch-scoped DocLifecycle
  -> typed Access Context
```

Gate policy 不再依赖 caller 恰好传入 Draft row 还是 Public row，也不需要从 `stage` 推断逻辑资源。

新增领域命令对应显式 Gate action：

```text
:discard_draft
:restore_revision_to_draft   Doc only
```

它们可以在权限规则内部复用 `:edit` 的 role/passport predicate，但必须分别定义
Lifecycle state matrix、Doc branch policy 和错误语义。现有 `:restore_snapshot` 由
`:restore_revision_to_draft` 直接替代，不保留双 action。

目标 state matrix：

| Gate action                  | `draft_only`                  | `published`                   | `archived/deleted/destroy`       |
| ---------------------------- | ----------------------------- | ----------------------------- | -------------------------------- |
| `:discard_draft`             | deny；初稿使用 Trash/Delete   | allow when Draft exists       | deny                             |
| `:restore_revision_to_draft` | Doc allow when version exists | Doc allow when version exists | deny；先走对应 Lifecycle restore |

Gate 只判断 actor/action admission 和当前状态是否允许命令开始；Command 在同一事务内重新
校验 Draft/Lifecycle expected version，不能把 Gate 获得的锁当作永久冻结。

### 8.3 只允许领域操作

外部 caller 只能调用：

```text
# ordinary Article
create_draft
read_draft / read_editor
update_draft
discard_draft
publish
draft_diff
trash / restore_trashed / permanently_delete

# Doc product entrypoints
list_branch_versions / get_branch_version
diff_versions
restore_revision_to_draft
```

禁止外部 caller：

- 直接更新 `article_publics.revision_id`；
- 直接 insert/delete Revision；
- 直接 delete Draft；
- 绕过 Gate/Lifecycle 构造 Public Projection；
- 把 Revision schema 当作 GraphQL DTO 泄漏出去。

## 9. `CMS.Articles` 改造方案

### 9.1 facade 继续保留

不新增 `ArticleGateway`、`ArticleRouter` 或 `ArticleContentState`。`CMS.Articles` 已经是产品调用方认识的边界，继续承担统一 facade：

```text
GraphQL / Import / Command / Maintenance
                  |
                  v
             CMS.Articles
                  |
        +---------+----------+-------------+
        |                    |             |
        v                    v             v
      Draft               Revision       Public
        |                    |             |
        +--------- Publish transaction ----+
```

Doc branch/tree/release 入口继续放在 `CMS.Docs` / `CMS.DocTree`；它们通过内部 API 复用 Article Revision builder，但不把 branch 参数扩散到普通 Article facade。

### 9.2 目标公共 API

```elixir
# public reads
CMS.Articles.read(community, thread, inner_id, actor \\ nil)
CMS.Articles.page(thread, filter, actor \\ nil)
CMS.Articles.read_public(community, article_ref, actor \\ nil)
CMS.Articles.grouped_kanban(community, actor \\ nil)
CMS.Articles.paged_kanban(community, filter, actor \\ nil)
CMS.Articles.paged_published(thread, filter, target_user, actor \\ nil)
CMS.Articles.count_published(thread, target_user, actor \\ nil)
CMS.Articles.paged_audit_failed(thread, filter, actor)

# convenience entrypoints; create may compose Publish, update remains a Draft write
CMS.Articles.create(community, thread, attrs, actor, opts \\ [])
CMS.Articles.update(article_ref, attrs, actor, command_id)

# draft workspace
CMS.Articles.create_draft(community, thread, attrs, actor, opts \\ [])
CMS.Articles.read_draft(community, article_ref, actor, opts \\ [])
CMS.Articles.read_editor(community, article_ref, actor, opts \\ [])
CMS.Articles.has_unpublished_changes(community, article_ref, actor, opts \\ [])
CMS.Articles.draft_diff(community, article_ref, actor, opts \\ [])
CMS.Articles.update_draft(article_ref, attrs, actor, expected_version: version)
CMS.Articles.discard_draft(article_ref, actor, expected_version: version)

# publish/lifecycle
CMS.Articles.publish(article_ref, actor,
  expected_draft_version: draft_version,
  expected_lifecycle_version: lifecycle_version
)
CMS.Articles.trash(article_ref, actor, opts \\ [])
CMS.Articles.restore_trashed(item_ref, actor, opts \\ [])
CMS.Articles.permanently_delete(item_ref, actor, opts \\ [])
CMS.Articles.list_trashed(community, filter \\ %{})
CMS.Articles.get_trashed(item_ref)

# stable Post workflow/classification state; does not create Revision
CMS.Articles.set_cat(article_ref, cat, actor)
CMS.Articles.set_status(article_ref, status, actor)

# stable Article operation state; does not create Revision
CMS.Articles.sink(article_ref, actor)
CMS.Articles.undo_sink(article_ref, actor)
CMS.Articles.lock_comments(article_ref, actor)
CMS.Articles.undo_lock_comments(article_ref, actor)
CMS.Articles.update_active_timestamp(article_ref, cause)

# moderation; updates stable Article + public visibility/search
CMS.Articles.set_illegal(article_ref, attrs, actor)
CMS.Articles.unset_illegal(article_ref, attrs, actor)
CMS.Articles.set_audit_failed(article_ref, attrs, actor)

# placement relations; does not create Revision
CMS.Articles.pin(community, article_ref, actor)
CMS.Articles.undo_pin(community, article_ref, actor)
CMS.Articles.mirror(community, article_ref, target_ids, actor)
CMS.Articles.unmirror(community, article_ref, actor)
CMS.Articles.move(community, article_ref, target_ids, actor)
CMS.Articles.move_to_blackhole(community, article_ref, target_ids, actor)
CMS.Articles.mirror_to_home(community, article_ref, target_ids, actor)

# maintenance
CMS.Articles.archive(thread)

# Doc-only published history; exact arity follows the CMS.Docs command contract
CMS.Docs.list_branch_versions(doc_ref, branch, actor, filter \\ %{})
CMS.Docs.get_branch_version(doc_ref, branch, version_ref, actor)
CMS.Docs.diff_versions(doc_ref, branch, left, right, actor)
CMS.Docs.restore_revision_to_draft(doc_ref, branch, revision_ref, actor, opts \\ [])
```

具体 arity 可在实现时按现有 Command contract 调整；稳定要求是 caller 传 `article_ref`，不传物理 Draft/Public row。

`create` 可保留为“创建并发布”的领域命令组合；`update` 保持现有 Draft
语义。它们都不能直接改 Public：

```text
create and publish
  = create_draft + publish in one transaction

update published Article
  = ensure Draft + update_draft
  != mutate ArticlePublic

set_cat / set_status
  = update stable PostState directly
  = allowed whether or not a content Draft exists
  = refresh ArticlePublic projection / cache / search when needed
  != create Draft or Revision
  != publish or overwrite the user's existing Draft
```

`cat/status` 定义为 Post 的即时分类/工作流状态，而不是可恢复的文章
内容。因此看板拖拽或管理员切换分类不会制造一个发布版本，也不会因为
用户已有 Draft 而被拒绝。`set_cat` 必须在同一事务中保留现有语义：
`cat == :qa` 时设置关联 Comment `question` flag，离开 `:qa` 时清除。
`update` 仍然是内容 Draft 路径。

`has_unpublished_changes` 的快路径是比较 Draft `content_hash` 与
`ArticlePublic.revision_id` 对应 Revision 的 `content_hash`；无 Public 但存在 Draft 时为
`true`，无 Draft 时为 `false`。`draft_diff` 在 hash 不同时才进一步比较
typed fields、relation fingerprints 和 ArticleBodySnapshot，作为现有 GraphQL 与
Doc tree change detection 的明确替代。

### 9.3 内部模块

保持少量、按 ownership 拆分：

```text
CMS.Articles
├── Draft          mutable workspace CRUD and optimistic guard
├── Revision       immutable revision build/read and cleanup roots
│   └── Cleanup    stale revision and orphan resource cleanup
├── Public         current public selection and projection
├── Publish        Draft -> Revision -> Public transaction
├── Diff           transient comparisons
├── Reader         public/detail/editor read composition
├── Lifecycle      resource transitions
├── Trash          aggregate trash/restore/destroy
└── Commands       authenticated/idempotent command boundary
```

不要增加一个总括 `ArticleVersioning` facade；`CMS.Articles` 已是 facade，内部模块只表达 ownership。

### 9.4 Publish transaction

```text
CMS.Articles.publish
  -> resolve stable Article once
  -> acquire Article mutation lock
  -> load canonical Gate Access Context
  -> check :publish
  -> lock Draft + Lifecycle
  -> validate expected versions
  -> materialize immutable ArticleBodySnapshot
  -> create ArticleRevision + typed extension + relation snapshots
  -> upsert ArticlePublic(revision_id + projection)
  -> Lifecycle.transition(:published)
  -> if first publish, run first-publish finalization
  -> delete Draft aggregate
  -> append Activity
  -> commit
  -> enqueue Search/Cache/Mention/Notification effects with article_id + revision_id
```

任一步失败，Revision、ArticlePublic、Lifecycle 和 Draft
必须一起回滚。

Doc Publish 在同一事务中额外分配 branch-local `version_number`、创建
`DocBranchVersion` 并更新 `DocPublic.branch_version_id`。

### 9.5 Activity

不新建编辑历史系统，复用现有 Activity V3。当前 Publish 已会比较前后
Public 内容并写入：

```text
title_changed
├── changed_fields = ["title"]
└── payload = %{title: new_title}

body_updated
├── changed_fields = ["body_hash", "schema_version"]
└── payload = %{body_hash: new_hash, schema_version: version}
```

Activity 长期保留 actor、operation、时间、变更字段和安全 payload；不保存旧
正文全文，也不长期引用可能被 Cleanup 删除的普通 Revision。
短期 Revision 负责 Cleanup 安全期内的完整内容排查；Activity 负责长期
产品日志。

### 9.6 Reader

公共查询：

```text
ArticlePublic
  JOIN Article
  JOIN ArticleLifecycle
  [JOIN PostProjection / ChangelogProjection only when needed]
```

编辑器查询：

```text
Gate.scope(:read_draft)
  -> Draft if present
  -> otherwise ArticlePublic.revision materialized as editor baseline
```

普通 Article 不读取 Revision 历史。Doc RevisionDrawer 按 branch 分页查询
`DocBranchVersion` metadata；用户选择某条 version 时再加载对应
ArticleBodySnapshot。不要在打开编辑器时加载整个历史正文。

## 10. 搜索与性能

### 10.1 Public 查询不读历史表

Revision 表会包含普通 Article 的 Cleanup 安全窗口与 Doc 的长期历史，
但公共热路径不扫描它：

```text
list/feed/search card -> ArticlePublic / Projection
detail metadata       -> ArticlePublic
detail body           -> ArticlePublic.revision_id -> ArticleBodySnapshot
ordinary history      -> no product query; Cleanup owns stale Revisions
Doc branch history    -> DocBranchVersion ordered by version_number
```

列表所需字段应放在 `ArticlePublic` 或 typed Projection，避免每行 join Revision + ArticleBodySnapshot。

### 10.2 Search index consistency

Publish transaction 写入：

```text
article_id
revision_id
public projection
```

Search job 是“让索引收敛到当前 Public”的请求，而不是“索引 payload 中那一版”的命令。
Oban unique key 保持 stable article ref，以便合并短时间内的重复 publish；worker 必须重新
读取当前 `ArticlePublic`：

```text
publish r7 -> enqueue(article_id=A, triggered_revision_id=r7)
publish r8 -> the same unique job may be coalesced
worker
  -> reload ArticlePublic(A)
  -> current revision is r8
  -> index r8
```

`triggered_revision_id` 只用于 tracing，不得在 stale 时直接 skip；否则新 job 被 Oban 去重后，
索引可能永久停留在旧版本。搜索文档保存 `article_id + indexed_revision_id`，便于诊断和
修复索引落后。delete 与 visibility change 同样按 worker 执行时的当前 Public/moderation
事实收敛。

Draft 搜索若未来确有产品需求，应定义独立的 management query/index，不为此引入 `DraftProjection` 作为默认基础设施。

### 10.3 写入成本

Revision 是“逻辑全量快照”，但不等于物理复制所有大字段：

- shared scalar / typed fields 每次 Revision 保存一份，便于确定性恢复；
- 大正文通过 `body_snapshot_id` 复用；
- assets 和 relation sets 可按 immutable membership + hash 去重；
- ArticlePublic 只复制公共查询真正需要的字段；
- runtime stats 不复制，始终属于 stable Article。

## 11. Revision 增长与清理

Revision 会增长，但不应按键盘输入增长。

### 11.1 创建策略

| 事件                   | 是否创建 Revision | 说明                                                              |
| ---------------------- | ----------------- | ----------------------------------------------------------------- |
| Autosave               | 否                | 只更新 mutable Draft                                              |
| Publish                | 是                | 每次创建新 Revision；正文未变时复用 ArticleBodySnapshot           |
| Doc Restore to Draft   | 否                | 只复制到 DocDraft                                                 |
| Doc Restore 后 Publish | 是                | 创建新 Revision + DocBranchVersion，Activity 记录 restore publish |
| 只打开编辑器 / Diff    | 否                | 只读                                                              |

目标模型不创建服务端自动 Checkpoint，因此 Revision 按发布次数增长，不按编辑
时长或键盘输入增长。前端 Local Working Copy 和 Recovery Point 只存在于 IndexedDB，
不占用服务端 Revision 表。

### 11.2 保护引用

Cleanup 不得删除仍被下列事实引用的 Revision：

- `ArticlePublic.revision_id`；
- `ArticleDraft.base_revision_id`；
- `DocDraft.base_revision_id/source_revision_id`；
- `DocBranchVersion.revision_id`；
- `DocPublic.branch_version_id` 和 `DocPublishReleaseArticle.branch_version_id` 所间接引用的 Revision。

Public、Draft、DocBranchVersion 和 Release 的引用使用 FK `ON DELETE RESTRICT`。
Activity、Search job 与 CommandReceipt 不长期引用普通 Revision；它们引用
stable `article_id`、operation ref 和必要的快照数据。

Revision 不拥有通用的 `pin/pinned` 状态。谁需要长期保留内容，谁就建立明确的
领域引用或复制自己的不可变产物：Doc Release 引用 `DocBranchVersion`；export/source
sync 复制导出内容；Schedule 持有自己的精确内容引用或快照。若未来出现法律保全需求，
单独设计具有明确 owner 与释放规则的 `RevisionHold`，不复用文章置顶语义。

普通单 Draft/单 Publish 流程提交后，旧 Revision 通常已无引用；“先排除引用”是
数据库安全不变量，不是一套通用历史闭包。Doc 的旧 Revision 由
`DocBranchVersion` 长期引用，因此自然不进入普通 Cleanup。

### 11.3 每日 Cleanup

`CMS.Articles.Revision.Cleanup` 拥有清理规则，Oban 只每日触发一次。初始策略：

```text
cleanup_interval = 1 day
cleanup_after    = 7 days
```

`cleanup_after` 是可调策略，不写死在 schema 语义中。以后若需要更长的运维恢复
窗口，可调整为 30/90 天或停止清理；已删除的 Revision 不会因策略调整而恢复。

普通 Revision 候选条件：

```text
article.thread != doc
AND revision.inserted_at < cleanup_cutoff
AND NOT EXISTS ArticlePublic(revision_id = revision.id)
AND NOT EXISTS ArticleDraft(base_revision_id = revision.id)
```

`article.thread != doc` 已排除 Doc，因此普通候选查询不重复检查 `DocDraft` 或
`DocBranchVersion`；全局引用安全仍由 11.2 的外键与 `ON DELETE RESTRICT` 保证。

Cleanup 持有对应 mutation lock，分批删除候选 Revision，然后依次清理零引用的
`ArticleBodySnapshot`、revision relations、cover edit snapshot 和 asset refs。
Permanently Delete 可删除整个 aggregate，不受这个安全期约束。

## 12. 全链路改造范围

`cms.articles` 从“多个产品表中的逻辑 hash”变成真实 stable aggregate root，会影响整个前后端链路。即使不做兼容，也必须逐层改完整。

### 12.1 Backend schema 与写链路

- 新建 stable `cms.articles`、Draft、Revision、typed Revision、`DocBranchVersion`、
  `cms.doc_branch_version_counters`、`cms.article_body_drafts`、
  `cms.article_body_snapshots`、`cms.post_states`、ArticlePublic/DocPublic/Projection 表；
- 当前 Post/Blog/Changelog/Doc 表中的 `stage`、运行时 identity 和版本字段拆到新 owner；
- 删除 `cms.posts`、`cms.blogs`、`cms.changelogs`、`cms.docs` 旧内容表；不重命名、不复用为 Projection，也不留下第二套 authority；
- 删除/替换 `cms.article_documents` 与 `article_document_asset_refs`：可变部分进 ArticleBodyDraft，不可变部分进 ArticleBodySnapshot，asset ref 分别按 Draft/Revision ownership 重建；
- 删除可变 `cover_edit_infos` authority：Draft 保存可编辑 cover state，Publish 写 immutable `revision_covers` + `revision_cover_edits`；
- `VersionedRelations` 改为 Draft relations 与 revision-scoped immutable relations，包括
  `post_draft_tags`、`blog_draft_tags`、`changelog_draft_tags`、`doc_draft_tags`，以及
  `post_revision_tags`、`blog_revision_tags`、`changelog_revision_tags`、
  `doc_revision_tags`、cover asset 与完整 cover edit snapshot；Public tags 通过当前
  Revision join，不再复制一套 Public tag relation；
- `Publish` 删除“copy to public physical Article row”编排；
- `DraftDiff` 改为 Draft vs ArticlePublic Revision；
- 普通 Article 新增 discard，但不新增历史 list/get/diff/restore API；Doc 新增
  branch version list/get/diff/restore-to-draft；删除服务端自动 checkpoint 写链路；
- 复用现有 Activity V3 的 `title_changed/body_updated`、`changed_fields`、payload 和
  operation 记录；不引入新的 Article edit history 日志表；
- 实现 `CMS.Articles.Revision.Cleanup` 的每日分批任务，普通旧 Revision 初始
  `cleanup_after = 7 days`，DocBranchVersion 引用的 Revision 不清理；
- stable Article 创建时初始化 ArticleLifecycle 和 comment sequence；首次 Publish
  显式执行 `inner_id`、mirror、tag/community/user counters、rate limit 与
  `ArticleStats.initialize` 等 finalization；
- Trash 通过 Lifecycle 隐藏/冻结但保留整个 stable aggregate 及现有 Draft；Permanently Delete/Destroy 才删除 aggregate，Discard 只删除 Draft workspace；
- CommandReceipt recovery 以 stable `article_id` 和 canonical result DTO 恢复，不猜 Draft/Public row。

### 12.2 Gate 与 Lifecycle

- Article Access Context 的 canonical resource 改为 stable Article；
- Article/Doc Scope 从 `stage` 过滤改为 Draft/Public table ownership；
- Lifecycle FK 指向 stable Article；
- Lifecycle 状态枚举和 transition 语义不因 Revision 改造而改变；
- Doc 继续使用 branch-scoped DocLifecycle；
- mutation lock 的 ordinary key 改为 stable article id，Doc key 仍包含 branch；
- Publish、Doc Restore-to-Draft、Discard 和 cleanup 都必须获取对应 mutation lock；
- 普通 Revision 不分配产品版本号；Doc branch-local version number 在锁内由
  `doc_branch_version_counters(article_id, branch_id, next_version_number)` 单调分配，
  不使用未锁定的 `MAX(...) + 1`；
- counter 递增与 DocBranchVersion insert 处在同一事务，回滚不留假洞。

### 12.3 Runtime relations

下列关系从 Public physical row 迁到 stable `article.id`：

- Comments 与 mentions；
- ArticleStats、views、emotions、collects；
- `post_reaction_infos`、`blog_reaction_infos`、`changelog_reaction_infos`、`doc_reaction_infos` 等 typed ReadState Projection；其 `upvoted_user_ids/reported_user_ids/collected_user_ids` RoaringBitmap、counts 和 latest-user cache 全部改按 stable `article_id` 重建；
- moderation/report facts；
- Activity aggregate identity；发布编辑事件继续按 stable `article_id` 记录，不依赖
  普通旧 Revision 长期存在；
- Trash membership；
- cache tags 与 invalidation target；
- notification/work payload 中的 durable identity。

版本化关系则迁到 Draft/Revision ownership，不能继续共用 runtime relation 表。

### 12.4 GraphQL

- Article DTO 的 `id` 必须稳定，不随 Draft/Public 变化；
- public query 从 ArticlePublic 组装；draft query 从 Draft 组装；
- Draft DTO 返回服务端生成的 `version + contentHash`；前端把 `contentHash` 当作 opaque
  base value，不在 TypeScript 复刻服务端 canonicalization；
- mutation input 使用 stable article ref + expected version；
- publish payload 返回 stable Article DTO、public revision ref 和必要的 versions；
- 普通 Article 只增加 discard 与 Draft/Public diff contract，不暴露历史
  Revision list/diff/restore；Doc 增加 branch version list/diff/restore-to-draft contract；
- 显式保留 `hasUnpublishedChanges` / `draftDiff` 能力，内部改为 Draft `content_hash` vs Public Revision `content_hash`；
- 删除旧 stage row 暴露和旧 DocSnapshot contract；
- `docDraftSnapshots` 的 staged history 与 `checkpointDocDraftSnapshot` 删除，无目标服务端写 API；
- `docSnapshot -> docBranchVersion`，`restoreDocDraftSnapshot -> restoreDocRevisionToDraft`，
  并新增 `docPublishedVersions` 查询 branch 已发布版本；
- 运行 codegen 并一次性更新所有 generated consumers。

### 12.5 Frontend

- editor cache key 使用 stable article ref；Draft version 单独存储；
- autosave 只 patch Draft，并正确处理 conflict；
- `frontend/core` 提供 host-neutral `LocalDraftHistory` 与 thread adapter；每个实际交付的
  Article 编辑器以 `account + community + thread + article + branch` 隔离 IndexedDB workspace；
- v1 必须交付 Core repository/session/recovery UI 与 Doc adapter，用它替代现有服务端
  staged checkpoint；Post、Blog、Changelog 在各自内容编辑器交付时必须同步接入，不预建
  没有 editor state/payload consumer 的空 adapter；
- 编辑变化立即更新内存，最多每约 3 秒 trailing 写入 Working Copy，并在
  `visibilitychange:hidden/pagehide` 尝试 flush；达到 recovery interval 且
  `local_payload_hash` 不同时追加 Recovery Point；
- server `contentHash` 只追踪本地副本观察到的服务端基线；`local_payload_hash` 只做
  IndexedDB 去重，两者不互相比较；
- 两个内容 store 的每条记录都保存 canonical record JSON（不含 `byte_size` 自身）的
  UTF-8 `byte_size`；workspace/account 预算均统计 Working Copy 与 Recovery Points；
- `local_draft_usage` 作为派生记账，在内容 record 写入、覆盖、删除的同一 IndexedDB
  transaction 内按 delta 更新；usage store 提供 `account_id` 索引，空 workspace/account
  不保留零值 row；记账缺失或异常时从内容 store 重建，正常写入不全表扫描；
- 打开编辑器时先加载服务端 Draft，再比较本地 Working Copy；只有用户确认后才能恢复，
  恢复内容使用当前服务端 Draft version 走正常 autosave；
- 本地 payload 保存 canonical body、typed fields、tags 和 cover edit state，不保存派生
  HTML/TOC 或 asset binary；恢复时校验 asset id，缺失资源降级并提示，不阻断其他内容；
- 每 workspace 初始最多 30 条/20 MiB，每账号最多 100 MiB，保留 7 天；软预算是修剪目标，
  与浏览器 quota 的独立硬限制分开处理；超限先删最旧 Recovery Point 并重试一次，仍失败则
  显示 unavailable，但不影响服务端 autosave；两个内容 store 都提供 account 索引，账号
  超限时跨 workspace 淘汰最旧 Recovery Points，不删除
  dirty Working Copy；dirty Working Copy 不设置 `expires_at`，只计占用、不参与 TTL 或预算淘汰；
- 同 workspace 多标签页使用 `writer_session_id + BroadcastChannel` 提示竞争并采用
  last-writer-wins，不做自动 merge；显式 logout 和 Permanently Delete 清理对应本地记录；
- IndexedDB 过期清理在 open、history read 和成功 write 后按 `expires_at` index 分批执行；
- publish 成功后更新 public query，并清理 draft/editor cache 与对应 LocalDraftHistory workspace；
- discard 成功后清理对应 LocalDraftHistory workspace，并回到当前 ArticlePublic；
- 普通 Article 不增加 RevisionDrawer；Doc revision drawer 分页加载
  branch version metadata，正文和 diff lazy load；
- 每个实际交付的 Article 编辑器提供独立的“本地历史”入口；普通 Article 只显示
  IndexedDB Recovery Points，Doc 额外显示服务端 `DocBranchVersion + Revision` 已发布历史；
- 当前 `RevisionDrawer`、`DiffStatus` 及其 model/spec 删除服务端 staged snapshot，改为
  “本地 Draft history + Doc 已发布版本”；Doc 已发布版本继续使用服务端 `contentHash`
  作为 diff/cache identity，本地历史只使用 `local_payload_hash` 去重；
- public detail/list/card cache 不再被 draft autosave 污染；
- Doc editor 额外携带 branch id，普通 Article hook 不出现 branch option。

### 12.6 Search、Press、Feed 与 Import

- Search/Press/Feed 只消费 ArticlePublic/Projection；
- Indexer 以 stable article id 合并 job，并在执行时重载当前 ArticlePublic；搜索文档记录 indexed revision id；
- single Article import 写 Draft，是否 Publish 由明确 command 决定；
- Docs bulk import 写指定 branch 的 DocDraft，由 Docs publish/release 编排；
- export/source sync 若需要可复现内容，在任务创建时复制所需的不可变内容；不长期引用
  普通 Revision，也不引入通用 Revision pin。

### 12.7 Doc Tree 与 Release

- Doc tree node 引用 stable article id；
- change detection 比较 DocDraft 与 DocPublic Revision；
- Release membership 从 `doc_snapshot_id` 改为 `branch_version_id`；
- Restore Release 通过 Release 引用的精确 `DocBranchVersion` 定位 Revision，恢复为目标
  branch Draft，再走正常 Docs Publish；
- `move_doc_to_draft` / `move_subtree_to_draft` 映射为目标 branch 的
  `ensure_draft_from_public`，不创建 Revision；
- branch/tree/site-state 仍留在 Docs，不下沉到 Article Revision。

## 13. 直接替换策略

本次明确不做迁移兼容：

```text
no legacy data migration
no backfill
no dual write
no shadow read
no compatibility alias
no old GraphQL fallback
no mixed old/new database authority
```

实施顺序仍按依赖组织，但不是渐进兼容阶段：

1. 锁定目标 schema、invariants、GraphQL contract 和 public DTO；
2. 建立 stable Article、Draft、Revision、DocBranchVersion、
   `doc_branch_version_counters`、ArticleBodyDraft/ArticleBodySnapshot、`post_states`、
   `post_draft_tags`、`blog_draft_tags`、`changelog_draft_tags`、`doc_draft_tags`、
   `post_revision_tags`、`blog_revision_tags`、`changelog_revision_tags`、
   `doc_revision_tags`、ArticlePublic/DocPublic；
3. 实现新的 `CMS.Articles` Draft/Revision/Public/Publish/Discard/Cleanup；
4. 改 Gate/Lifecycle canonical identity 与 Scope；
5. 迁移 runtime relations 和 versioned relations 的 ownership；
6. 改 Doc Tree、DocBranchVersion、Doc Release 和 Doc restore；
7. 改 GraphQL、frontend editor、revision UI、Search/Press/Feed/Import；显式交付 Core
   LocalDraftHistory repository/session controller/recovery UI 与 Doc adapter，并删除 Doc
   旧 staged history；Post、Blog、Changelog adapter 随各自真实内容编辑器交付；
8. 删除旧 `stage` 双行模型、DocSnapshot 和旧 API；
9. 重建 fixtures/seeds/test database，运行全链路验收；
10. 在同一目标版本发布，不保留可运行的混合模式。

“不迁移旧数据”不等于可以漏掉 caller。所有旧 caller 必须改写或删除；区别只是无需 backfill 旧 row，也无需支持新旧数据同时在线。

## 14. 不变量与验收标准

### 数据不变量

1. 一个逻辑 Article 只有一个稳定 `article.id`。
2. 普通 Article 最多一个 Draft 和一个 ArticlePublic；Doc 每个 branch 最多一个 DocDraft 和 DocPublic。
3. Revision、ArticleBodySnapshot、revision relations 和 DocBranchVersion 创建后不可更新。
4. ArticlePublic 必须引用同一 Article 的 Revision；DocPublic 必须引用同一
   Article + Branch 的 DocBranchVersion，且该 Version 指向同一 Article 的 Revision。
5. Autosave 不创建 Revision。
6. Publish 必须原子创建新 Revision、推进 Public、转换 Lifecycle 并删除
   Draft；Doc Publish 还必须创建 DocBranchVersion。
7. Doc Restore 只写 DocDraft；Public 只能由 Publish 改变。普通 Article 不提供
   历史 Restore。
8. Discard Draft 不改变 Public 或已发布 Lifecycle。
9. Runtime relations 只引用 stable Article，不引用 Draft、Revision 或 Public projection row。
10. 普通 Article 的 schema、API 和 lock 不出现 Branch。
11. `article.id` 是唯一稳定 UUID identity；目标 schema 不再存在 `article_hash_id` 或产品行 bigint identity。
12. 普通 ArticleRevision 不分配产品版本号；DocBranchVersion 按 Article + Branch 单调编号。
13. Public、Draft、DocBranchVersion 和 Release 直接或间接引用的 Revision 不得删除；
    普通旧 Revision 只有在超过 `cleanup_after` 且无引用时才可删除。
14. 一条 Revision 必须能确定性恢复 tags、cover asset 和 light/dark cover edit state，不得仅恢复 URL。
15. LocalDraftHistory 只存在于前端 IndexedDB；其失败或缺失不能影响服务端 Draft、
    Publish 或 Revision 正确性，也不能成为服务端领域事实来源。
16. community tags 只存在于对应 thread 的 Draft/Revision relation；公共读取通过
    `ArticlePublic.revision_id` 定位 Revision tags，不存在第二套 Public tag authority。
17. 服务端 `content_hash` 只由服务端生成；前端只保存并比较服务端返回值。本地
    `local_payload_hash` 只用于 IndexedDB 去重，不与服务端 hash 比较。
18. Local Working Copy 只表达尚未可靠同步的最新输入；`dirty = false` 的 synced copy
    必须删除，不能与 Recovery Points 一起承担历史职责。
19. dirty Working Copy 不设置 `expires_at`，也不参与 TTL、条数或字节预算的自动淘汰；
    空间不足时 LocalDraftHistory 降级为 unavailable，不能删除未同步输入换取容量。
20. LocalDraftHistory 的 workspace/account 用量必须覆盖 Working Copy 与 Recovery Points；
    每条内容记录按不含 `byte_size` 自身的完整 canonical record JSON 的 UTF-8 字节数计量，
    派生 usage 与内容增删改在同一 IndexedDB transaction 内更新。
21. `local_draft_usage` 只保存非空 scope；workspace/account 内容清空时必须删除对应零值
    usage row。usage store 必须能按 `account_id` 定位账号全部 workspace rows。

### 行为验收

1. 已发布 Article 编辑时，匿名用户仍读到旧 revision。
2. 只改标题发布会创建新 Revision，但复用 ArticleBodySnapshot。
3. 正文变化发布会创建新 ArticleBodySnapshot。
4. republish 后 comments、stats、reactions 和 public id 不变。
5. discard 后 Draft 消失，Public 内容和 revision id 不变。
6. 普通 Article 发布 r2 后，r1 在安全期内保留；超过安全期且无任何
   Public/Draft/DocBranchVersion/Release 引用时，每日 Cleanup 可删除 r1。
7. 并发 Draft update/publish 使用 expected version，旧请求不能覆盖新 Draft。
8. 被 Oban 合并或延迟执行的 Search job 必须重载当前 ArticlePublic，并最终索引最新 revision。
9. Cleanup 不会删除仍被 Revision/Public/Draft/DocBranchVersion/Release 直接或
   间接引用的 ArticleBodySnapshot。
10. Doc Release 能凭精确引用的 DocBranchVersion + Tree Snapshot 重建当次站点。
11. illegal/audit-failed 变化同步更新 public visibility、tag stats、cache 和 Search，不创建 Revision。
12. 评论活动更新 `active_at` 后，公共排序 Projection 与 stable Article 一致。
13. Article placement 的 pin、mirror、move、sink、comment lock 不创建 Revision，且仍能通过原产品入口完成；这里的 pin 仅表示文章置顶，与 Revision 保留无关。
14. branch A 的 DocBranchVersion 不出现在 branch B 的 RevisionDrawer；创建
    preview branch 时只从 source branch Public 初始化 Draft。
15. 无论是否存在未发布 Draft，`set_cat/set_status` 都只更新 stable PostState，
    不创建/发布 Revision；`set_cat` 同步保留 Comment question flag 语义。
16. Trash 后 Draft 被保留但不可编辑；restore 后同一 Draft 恢复可编辑；只有 permanently delete 删除它。
17. 普通 Article 编辑发布继续写入 Activity V3 的 `title_changed/body_updated`，
    Activity 不因旧 Revision 被 Cleanup 而悬空。
18. Doc 把历史 Revision 恢复到 DocDraft 后，DocPublic 不变；再次 Publish
    创建新 Revision 和新 DocBranchVersion。
19. Doc 在 v1 交付 LocalDraftHistory adapter 与 UI；此后每个实际交付的 Article 内容
    编辑器都必须同步接入。已接入编辑器能在同账号、同浏览器内发现、预览和恢复 dirty
    Local Working Copy；未确认前不能自动覆盖服务端内容。
20. Local Recovery Point 恢复后使用当前服务端 Draft version autosave；远端版本已前进时
    正常进入 conflict，不用历史记录里的旧 version 强制覆盖。
21. Publish/Discard 成功后，对应 workspace 的 Local Working Copy 和 Recovery Points
    被清理；IndexedDB 不可用或写入失败时，服务端 autosave 和 Publish 仍然正常。
    Autosave 成功且期间没有新输入时，synced Working Copy 立即删除；Recovery Points 保留。
22. 首次发布前 `is_edited = false`；已发布 Article 首次成功写入后续 Draft 时变为
    `true`，之后 Publish、Discard 或再次编辑都不会将其重置。
23. 本地历史超出条数/字节/quota 后先清理再重试；仍失败时 UI 明确显示 unavailable，
    服务端 autosave 与 Publish 保持正常。账号级淘汰跨 workspace 删除最旧 Recovery Points，
    不自动删除 dirty Working Copy；即使该 copy 已被遗弃或超过 7 天也继续保护。
24. 同 workspace 多标签页产生可见的并发编辑提示；显式 logout、Publish、Discard 和
    Permanently Delete 按各自范围清理本地记录；Trash 只让 Recovery Points 等待过期清理，
    不删除 dirty Working Copy。
25. Recovery Point 引用的部分 asset 缺失时，其余内容仍可恢复，并明确提示降级结果。
26. Working Copy 覆盖、Recovery Point 增删后，workspace/account usage 的 delta 与从两个
    内容 store 全量重建的结果一致；20/100 MiB 软预算只淘汰 Recovery Points 和残留 synced
    Working Copies，不淘汰 dirty Working Copy，浏览器 quota 失败独立触发可见降级。清空
    workspace 后增量路径与全量重建都不存在该 workspace usage row，不以零值 row 造成假差异。
27. logout 通过 `account_id` 索引删除账号全部内容与 usage rows；Permanently Delete 使用内容
    删除过程中收集的精确 `workspace_key` 清理 workspace usage，并更新或重建 account usage，
    不依赖扫描整个 usage store。

### 架构验收

1. 外部 caller 不直接读写 Draft/Revision/Public persistence module。
2. `CMS.Articles` 是普通 Article 的唯一领域 facade；Docs 产品复杂度留在 `CMS.Docs` / `CMS.DocTree`。
3. Gate、Lifecycle、Revision、Public Projection 和 Release 各自只有一个事实来源。
4. 不存在 `ArticleGateway`、通用 BranchHead、DraftProjection 或 `_data` 内容桶。
5. 不存在兼容写、双权威或从旧 `stage` row fallback 的代码。
6. runtime code、当前 schema/model、GraphQL schema/operations 和 generated types 中，`cms.posts/blogs/changelogs/docs`、`cms.article_documents`、`article_document_asset_refs`、`cover_edit_infos`、旧 DocSnapshot contract 与 `article_hash_id` 已删除或按本文明确替换，静态扫描无残留。历史 migration 为了保留已发布 schema 演进记录，不在该扫描验收范围内。
7. `CMS.Articles` 现有 read/list、content、moderation、placement、runtime 和 maintenance 能力都有明确目标 owner 或删除决定。
8. 普通 Article 不存在 Revision history GraphQL/API/UI；只有 Doc 暴露
   `DocBranchVersion` 历史、Diff 和 Restore-to-Draft。
9. 服务端不存在 Draft checkpoint/snapshot 写 API；实际交付的 Article 编辑器都通过
   Core `LocalDraftHistory` 实现未发布内容历史，不在各 thread editor 重复实现。
10. v1 必须以 Doc adapter 替换现有服务端 staged history；未交付内容编辑器的 thread
    不预建空 adapter，Post、Blog、Changelog 在各自编辑器交付时通过同一 Core
    repository/session boundary 接入。

## 15. 结论

当前 Public/Draft 双物理行方案的复杂度，主要来自用“两个 Article row”同时表达稳定身份、可变工作区和公共读模型。目标模型把这三件事拆开：

```text
Article       = stable identity
Draft         = mutable work
Revision      = immutable published content; ordinary stale rows are cleaned
DocBranchVersion = branch-local durable published version
ArticlePublic = current public selection + public projection
Lifecycle     = resource state
LocalDraftHistory = local browser recovery; not server domain history
```

这不是为了增加一套抽象，而是让每个概念只回答一个问题。唯一保留的产品特例是 Doc branch/tree/release，因为它确实是 Docs 的业务能力；普通 Article 不为它承担抽象成本。
