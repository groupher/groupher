# 旧 Audit 逐文件扫描清单

> 状态：2026-10-22 仓库工作树静态证据；不是已删除清单。
> 行号是扫描快照，后续并行改动可能移动。总览和明确替代方向见[退役计划](./legacy-content-audit-removal.md)。

## 扫描方法

初扫通过 `rg --files --hidden` 枚举仓库可见文件（排除 .git、依赖、构建和 crash dump），
按以下字面词族搜索，再读取关键实现。配置补扫包含被 ignore 的本地 .env/config 示例类文件，
仅记录键名与位置。没有读取远端 secrets/队列，没有调用旧 provider。

```text
AuditBot | audition | audit_failed | auditFailed | is_legal | isLegal
illegal_reason | illegalReason | illegal_words | illegalWords | moderation_state
illegal_articles | illegal_comments | hasIllegal | illegalArticles | illegalComments
include_illegal | includeIllegal | article.moderate | comment.illegal
IllegalWarning | IllegalBar | BAIDU | baidubce | baidu.com/ai-doc | :audit
```

后续定点补扫 Article.pending（含 GraphQL 声明、生成 SDL 与 fixture）、Comment.pending、
Public/Binding 可见性初始化与写入、Moderate command、i18n、salon、共享依赖；
显式纳入被 rg 默认枚举忽略的 GraphQL 生成目录与 pipeline_graph.json。
这是指定协议词族加关键链路核对，不能证明无任意动态引用；切换时仍需编译、契约与运行行为验证。
直接配置扫描只发现 prod/runtime 的 AUDIT_TOKEN、test 的 :audit 和 config 两条 audition cron。
未在其余配置模板/CI 找到额外专用键；线上配置未验证。

## 分类与删除合同

内容 Audit 的生产、执行、存储、过滤、对外契约、前端展示和专用测试全部删除；不保留别名、wrapper、默认值占位、旧状态映射或 fallback。表内“替代”指删除后按新合同独立实现，不表示渐进兼容。

同名命中按语义分类：通用 Activity.log、Lifecycle write_audit、`audit.read` 社区操作日志权限、Moderator 身份及 Community.pending 保留；内容审核预留的 Activity actions `moderation_review_started/resolved` 删除；Article.pending 对外字段和 Comment.pending 数据库审核字段删除。禁止只按 audit/pending 字样批量删除。

## 逐文件证据

本表去重后共 133 个文件（每个路径一行），包含历史文档和保留项，不表示需要修改 133 个代码文件。初扫的 131 条定位实际对应 129 个唯一路径；本次去重并补齐遗漏文件。

表内链接相对本文件；行号单独列出。生成文件只列部分定位点，生成输出不是手工修改目标。

### 运行时消费者

| 文件                                                                                                                                             | 定位（源码行 / 文档说明）                 | 处理方向                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [backend/api/lib/groupher_server/cms.ex](../../backend/api/lib/groupher_server/cms.ex)                                                           | 302, 303, 305, 578, 579, 581              | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles.ex](../../backend/api/lib/groupher_server/cms/articles.ex)                                         | 528, 530, 531, 535, 536, 537              | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles/article_view.ex](../../backend/api/lib/groupher_server/cms/articles/article_view.ex)               | 39, 48                                    | 删除旧审核 meta 与 Article.pending 透传，不保留占位                                                                         |
| [backend/api/lib/groupher_server/cms/articles/binding_persist.ex](../../backend/api/lib/groupher_server/cms/articles/binding_persist.ex)         | 242                                       | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles/draft/store.ex](../../backend/api/lib/groupher_server/cms/articles/draft/store.ex)                 | 281, 812, 822                             | 删除旧审核字段初始化；812 的 visible: true 是 binding 创建默认值而非旧枚举换算，纳入 N2 初始化重算，不删除 binding 创建能力 |
| [backend/api/lib/groupher_server/cms/articles/effects/publish.ex](../../backend/api/lib/groupher_server/cms/articles/effects/publish.ex)         | 7, 49                                     | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles/public.ex](../../backend/api/lib/groupher_server/cms/articles/public.ex)                           | 41                                        | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles/publish/doc.ex](../../backend/api/lib/groupher_server/cms/articles/publish/doc.ex)                 | 234                                       | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/articles/revision_projection.ex](../../backend/api/lib/groupher_server/cms/articles/revision_projection.ex) | 169, 178, 242–292                         | 删除 pending: 0 占位及旧审核字段投影；保留通用 revision 投影                                                                |
| [backend/api/lib/groupher_server/cms/artiment/const.ex](../../backend/api/lib/groupher_server/cms/artiment/const.ex)                             | 37, 45, 46                                | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/comments.ex](../../backend/api/lib/groupher_server/cms/comments.ex)                                         | 564, 566, 567                             | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/comments/commands/create.ex](../../backend/api/lib/groupher_server/cms/comments/commands/create.ex)         | 12, 118, 271, 445                         | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/comments/commands/update.ex](../../backend/api/lib/groupher_server/cms/comments/commands/update.ex)         | 8, 32, 94                                 | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/comments/effects.ex](../../backend/api/lib/groupher_server/cms/comments/effects.ex)                         | 54, 56                                    | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| `backend/api/lib/groupher_server/cms/comments/required_jobs.ex` (removed)                                                                        | 6, 21, 29, 32, 33, 36, 43, 45, 47, 55, 63 | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/communities/tags/stats.ex](../../backend/api/lib/groupher_server/cms/communities/tags/stats.ex)             | 183, 374                                  | 删除旧常量及 visible? 的 pending 判定；新可见性统计另按新合同实现                                                           |
| [backend/api/lib/groupher_server/cms/events.ex](../../backend/api/lib/groupher_server/cms/events.ex)                                             | 54                                        | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/cms/query_builder.ex](../../backend/api/lib/groupher_server/cms/query_builder.ex)                               | 22, 23, 94–98                             | 删除旧常量、pending/失败列表过滤分支及调用参数                                                                              |
| [backend/api/lib/groupher_server/cms/search_artiments/capacity.ex](../../backend/api/lib/groupher_server/cms/search_artiments/capacity.ex)       | 23, 84                                    | 删除旧常量及 Comment.pending == legal 的实际过滤                                                                            |
| [backend/api/lib/groupher_server/jobs.ex](../../backend/api/lib/groupher_server/jobs.ex)                                                         | 30, 34, 36                                | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/jobs/comments.ex](../../backend/api/lib/groupher_server/jobs/comments.ex)                                       | 21                                        | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server/jobs/workflow.ex](../../backend/api/lib/groupher_server/jobs/workflow.ex)                                       | 131, 135, 137, 138                        | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server_web/schema/account/account_types.ex](../../backend/api/lib/groupher_server_web/schema/account/account_types.ex) | 51 (`reported_count`)                     | 删除旧账号举报计数字段/投影；新账号视图如需该值，由 AlertBoard reports 派生                                                 |
| [backend/api/lib/groupher_server_web/schema/cms/cms_types.ex](../../backend/api/lib/groupher_server_web/schema/cms/cms_types.ex)                 | 1859, 1860, 1861, 2136, 2137, 2138        | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/helper/scheduler.ex](../../backend/api/lib/helper/scheduler.ex)                                                                 | 48, 54, 56, 61, 69, 74, 75                | 删除旧调用、字段与映射；新机制独立实现，不保留转发或兼容分支                                                                |
| [backend/api/lib/groupher_server_web/schema/helper/fields.ex](../../backend/api/lib/groupher_server_web/schema/helper/fields.ex)                 | 128                                       | 删除 Article.pending 共享 GraphQL 字段，不保留恒定值                                                                        |
| [backend/api/lib/groupher_server_web/schema/cms/cms_metrics.ex](../../backend/api/lib/groupher_server_web/schema/cms/cms_metrics.ex)             | 29                                        | 删除 Article interface 的 pending 字段；Community.pending 不属于此合同                                                      |

### 删除/替代

| 文件                                                                          | 定位（源码行 / 文档说明）                             | 处理方向                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `backend/api/lib/groupher_server/cms/articles/commands/moderate.ex` (removed) | 12, 26, 31, 50, 62                                    | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/groupher_server/cms/articles/moderation.ex` (removed)        | 45, 48, 49, 53, 60, 75, 80, 139, 140, 141, 142, 147 … | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/groupher_server/cms/comments/audit.ex` (removed)             | 5, 8, 20, 21                                          | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/groupher_server/cms/comments/commands/moderate.ex` (removed) | 28, 29, 30, 38, 39                                    | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/groupher_server/cms/comments/moderation.ex` (removed)        | 27, 28, 29, 58, 64, 67, 70, 94, 99, 102, 103, 107 …   | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/groupher_server/cms/events/audition.ex` (removed)            | 1, 5, 12, 13, 26, 30, 34, 36, 41, 45, 48, 51 …        | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |
| `backend/api/lib/helper/audit_bot.ex` (removed)                               | 1, 5, 14, 15, 16, 17, 18, 24, 41, 43, 47, 58 …        | 整体删除旧模块与协议；新领域 Command 独立实现，不包装旧入口 |

### Gate

| 文件                                                                                                                                         | 定位（源码行 / 文档说明）   | 处理方向                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| [backend/api/lib/groupher_server/cms/gate/access/policy/article.ex](../../backend/api/lib/groupher_server/cms/gate/access/policy/article.ex) | 108, 129, 133, 134          | 替换旧审核条件/选项/权限映射，保留原加载与 Scope 边界                        |
| [backend/api/lib/groupher_server/cms/gate/context/scope/article.ex](../../backend/api/lib/groupher_server/cms/gate/context/scope/article.ex) | 27, 35, 70                  | 替换旧审核条件/选项/权限映射，保留原加载与 Scope 边界                        |
| [backend/api/lib/groupher_server/cms/gate/context/scope/doc.ex](../../backend/api/lib/groupher_server/cms/gate/context/scope/doc.ex)         | 23, 32, 72                  | 替换旧审核条件/选项/权限映射，保留原加载与 Scope 边界                        |
| [backend/api/lib/groupher_server/cms/gate/scope/article.ex](../../backend/api/lib/groupher_server/cms/gate/scope/article.ex)                 | 78, 321, 327, 333, 360, 366 | 替换旧审核条件/选项/权限映射，保留原加载与 Scope 边界                        |
| [backend/api/lib/groupher_server/cms/gate/scope/comment.ex](../../backend/api/lib/groupher_server/cms/gate/scope/comment.ex)                 | 28, 138, 144                | 删除 pending != illegal 与作者例外的旧条件；保留 Gate scope 边界，新限制另建 |

### 数据模型

| 文件                                                                                                                                                       | 定位（源码行 / 文档说明）                                              | 处理方向                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [backend/api/lib/groupher_server/accounts/model/embeds/user_meta.ex](../../backend/api/lib/groupher_server/accounts/model/embeds/user_meta.ex)             | 56–57 (`reported_count`, `reported_user_ids` defaults); 83–84 (fields) | 移除旧举报计数、举报者 ID 数组及 embed keys；配新 migration，其他 meta 保留                                |
| [backend/api/lib/groupher_server/accounts/model/embeds/user_contribute.ex](../../backend/api/lib/groupher_server/accounts/model/embeds/user_contribute.ex) | 22 (`@optional_fields ~w(reported_count)a`)                            | 移除旧贡献摘要中的举报计数字段；配新 migration 清理 `account.users.contributes.reported_count`，不迁移旧值 |
| [backend/api/lib/groupher_server/cms/model/article.ex](../../backend/api/lib/groupher_server/cms/model/article.ex)                                         | 25, 26, 27, 72, 73, 74, 93                                             | 移除旧字段/default/embed keys，保留非审核字段；配新 migration                                              |
| [backend/api/lib/groupher_server/cms/model/comment.ex](../../backend/api/lib/groupher_server/cms/model/comment.ex)                                         | 44, 51, 134                                                            | 移除旧字段/default/embed keys，保留非审核字段；配新 migration                                              |
| [backend/api/lib/groupher_server/cms/model/doc_branch_state.ex](../../backend/api/lib/groupher_server/cms/model/doc_branch_state.ex)                       | 23, 24, 25, 33, 34, 35                                                 | 移除旧字段/default/embed keys，保留非审核字段；配新 migration                                              |
| [backend/api/lib/groupher_server/cms/model/embeds/article_meta.ex](../../backend/api/lib/groupher_server/cms/model/embeds/article_meta.ex)                 | 27, 45, 46, 47, 71, 72, 73                                             | 移除旧字段/default/embed keys，保留非审核字段；配新 migration                                              |
| [backend/api/lib/groupher_server/cms/model/embeds/comment_meta.ex](../../backend/api/lib/groupher_server/cms/model/embeds/comment_meta.ex)                 | 20, 31, 32, 33, 47, 48, 49                                             | 移除旧字段/default/embed keys，保留非审核字段；配新 migration                                              |

### 配置

| 文件                                                                   | 定位（源码行 / 文档说明） | 处理方向                                                   |
| ---------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| [backend/api/config/config.exs](../../backend/api/config/config.exs)   | 258, 260                  | 删除专用 :audit/AUDIT_TOKEN 或 audition cron，保留其他配置 |
| [backend/api/config/prod.exs](../../backend/api/config/prod.exs)       | 84                        | 删除专用 :audit/AUDIT_TOKEN 或 audition cron，保留其他配置 |
| [backend/api/config/runtime.exs](../../backend/api/config/runtime.exs) | 237                       | 删除专用 :audit/AUDIT_TOKEN 或 audition cron，保留其他配置 |
| [backend/api/config/test.exs](../../backend/api/config/test.exs)       | 58                        | 删除专用 :audit/AUDIT_TOKEN 或 audition cron，保留其他配置 |

### 前端消费者

| 文件                                                                                                                                                       | 定位（源码行 / 文档说明）               | 处理方向                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| [frontend/core/lib/i18n/en/main.ts](../../frontend/core/lib/i18n/en/main.ts)                                                                               | 43, 44, 45                              | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/lib/i18n/zh/main.ts](../../frontend/core/lib/i18n/zh/main.ts)                                                                               | 43, 44, 45                              | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/spec/article.d.ts](../../frontend/core/spec/article.d.ts)                                                                                   | 34, 35, 36, 206, 207, 208               | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| `frontend/core/ui/IllegalWarning/index.tsx` (removed)                                                                                                      | 6, 7, 10, 17, 20, 27, 37                | 已按退役计划 5.2 删除旧专用组件，不保留兼容 UI                               |
| `frontend/core/ui/IllegalWarning/salon/index.ts` (removed)                                                                                                 | 17                                      | 已随旧组件删除，不保留兼容 salon                                             |
| [frontend/core/unit/ArticleEditor/schema.ts](../../frontend/core/unit/ArticleEditor/schema.ts)                                                             | 63, 64, 65, 195, 196, 197               | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/ChangelogThread/ChangelogItem/ClassicLayout/index.tsx](../../frontend/core/unit/ChangelogThread/ChangelogItem/ClassicLayout/index.tsx) | 61                                      | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/ChangelogThread/ChangelogItem/SimpleLayout/index.tsx](../../frontend/core/unit/ChangelogThread/ChangelogItem/SimpleLayout/index.tsx)   | 57                                      | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/Comments/Comment/Actions.tsx](../../frontend/core/unit/Comments/Comment/Actions.tsx)                                                   | 92                                      | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/Comments/Comment/DesktopView/DefaultLayout.tsx](../../frontend/core/unit/Comments/Comment/DesktopView/DefaultLayout.tsx)               | 15, 37, 63, 73                          | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/Comments/Comment/DesktopView/FoldLayout.tsx](../../frontend/core/unit/Comments/Comment/DesktopView/FoldLayout.tsx)                     | 14, 29, 42, 51                          | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| `frontend/core/unit/Comments/Comment/DesktopView/IllegalBar.tsx` (removed)                                                                                 | 9, 10, 14, 22, 23, 26, 29, 35           | 已随旧评论审核 UI 删除，不保留兼容组件                                       |
| [frontend/core/unit/Comments/Comment/Footer.tsx](../../frontend/core/unit/Comments/Comment/Footer.tsx)                                                     | 33, 35, 73                              | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/Comments/Comment/salon/desktop_view/illegal_bar.ts](../../frontend/core/unit/Comments/Comment/salon/desktop_view/illegal_bar.ts)       | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 … | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/Comments/fragments.ts](../../frontend/core/unit/Comments/fragments.ts)                                                                 | 28, 29, 30                              | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |
| [frontend/core/unit/EmotionSelector/index.tsx](../../frontend/core/unit/EmotionSelector/index.tsx)                                                         | 17, 22, 30                              | 按退役计划 5.2 成对更新 query/type/UI；删除旧专用组件及 salon，不保留兼容 UI |

### 生成契约

| 文件                                                                                                   | 定位（源码行 / 文档说明）                                                            | 处理方向                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [frontend/core/lib/graphql/generated/graphql.ts](../../frontend/core/lib/graphql/generated/graphql.ts) | 4357, 4358, 4359, 4483, 4484, 4485, 4642, 4643, 4644, 4673, 4674, 4675 …             | 修改 schema/query/Command 来源后重新生成，不手工维持旧协议                                           |
| [frontend/core/lib/graphql/generated/gql.ts](../../frontend/core/lib/graphql/generated/gql.ts)         | 112, 118, 129, 445, 457, 479, 1317, 1318, 1353, 1354, 1419, 1420                     | 修改 schema/query/Command 来源后重新生成，不手工维持旧协议                                           |
| `backend/api/priv/pipeline_graph.json`（被 `.gitignore` 排除的本地生成产物）                           | 14539, 14546, 14553, 81249, 81928, 82600, 83482, 83517, 83531, 83538, 83545, 83559 … | 由 pipeline graph 生成任务本地重建；不作为仓库内可点击证据，也不提交忽略产物                         |
| [backend/api/priv/pipeline_contracts.json](../../backend/api/priv/pipeline_contracts.json)             | 450, 451                                                                             | 修改来源后重新生成，移除旧字段/operation；不手工制造兼容                                             |
| [backend/api/schema.graphql](../../backend/api/schema.graphql)                                         | pending：2621, 2655, 2684, 2714, 3706；meta：3327–3329, 3680–3682, 4341–4344         | 从来源删除 Article.pending 与旧审核 meta 后重新生成；3225 是 Community.pending，保留，不纳入删除定位 |

### 旧专用测试

| 文件                                                                              | 定位（源码行 / 文档说明）                      | 处理方向                                |
| --------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `backend/api/test/groupher_server/cms/events/audition/comment_test.exs` (removed) | 1                                              | 随旧执行器删除；新 adapter/任务测试另建 |
| `backend/api/test/groupher_server/cms/events/audition/post_test.exs` (removed)    | 1                                              | 随旧执行器删除；新 adapter/任务测试另建 |
| `backend/api/test/helper/audit_bot_test.exs` (removed)                            | 1, 8, 11, 12, 13, 14, 15, 20, 23, 24, 25, 26 … | 随旧执行器删除；新 adapter/任务测试另建 |

### 测试

| 文件                                                                                                                                                                           | 定位（源码行 / 文档说明）                               | 处理方向                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [backend/api/lib/support/factory/articles.ex](../../backend/api/lib/support/factory/articles.ex)                                                                               | 371                                                     | 删除 article_base 的 pending: 0 fixture 占位；保留其他通用 factory 数据，不以常量维持旧 Article.pending 合同 |
| `backend/api/test/groupher_server/cms/articles/moderation/blog_pending_flag_test.exs` (removed)                                                                                | 44, 45, 46, 53, 76, 77, 78, 119, 120, 121, 128, 134 …   | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/articles/moderation/changelog_pending_flag_test.exs` (removed)                                                                           | 47, 48, 49, 56, 83, 84, 85, 126, 127, 128, 135, 141 …   | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/articles/moderation/doc_pending_flag_test.exs` (removed)                                                                                 | 45, 46, 47, 60, 83, 84, 85, 127, 128, 129, 142, 156 …   | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/articles/moderation/post_pending_flag_test.exs` (removed)                                                                                | 45, 50, 70, 71, 72, 79, 109, 110, 111, 152, 153, 154 …  | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/articles/revision_target_test.exs](../../backend/api/test/groupher_server/cms/articles/revision_target_test.exs)                         | 277, 981                                                | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/articles/trash_test.exs](../../backend/api/test/groupher_server/cms/articles/trash_test.exs)                                             | 177, 180, 190                                           | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/artiment_mentions_test.exs](../../backend/api/test/groupher_server/cms/artiment_mentions_test.exs)                                       | 680                                                     | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/comments/moderation/blog_pending_test.exs` (removed)                                                                                     | 7, 8, 32, 33, 34, 42, 43, 44, 64, 65, 66, 67 …          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/comments/moderation/changelog_pending_test.exs` (removed)                                                                                | 7, 8, 32, 33, 34, 42, 43, 44, 64, 65, 66, 67 …          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/comments/moderation/doc_pending_test.exs` (removed)                                                                                      | 7, 8, 32, 33, 34, 42, 43, 44, 64, 65, 66, 67 …          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/comments/moderation/post_pending_test.exs` (removed)                                                                                     | 7, 8, 32, 33, 34, 42, 43, 44, 64, 65, 66, 67 …          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server/cms/comments/required_jobs_test.exs` (removed)                                                                                               | 30, 32, 51, 64, 81, 94, 130, 135                        | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/communities/tags/post_tag_test.exs](../../backend/api/test/groupher_server/cms/communities/tags/post_tag_test.exs)                       | 856, 857, 858                                           | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/gate/g1_surface_consistency_test.exs](../../backend/api/test/groupher_server/cms/gate/g1_surface_consistency_test.exs)                   | 35, 116                                                 | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/gate/scope/article_test.exs](../../backend/api/test/groupher_server/cms/gate/scope/article_test.exs)                                     | 43                                                      | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/cms/interactions/scope_test.exs](../../backend/api/test/groupher_server/cms/interactions/scope_test.exs)                                     | 22                                                      | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server/jobs/comments_test.exs](../../backend/api/test/groupher_server/jobs/comments_test.exs)                                                       | 30                                                      | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server_web/query/cms/articles/moderation/blogs_flags_test.exs` (removed)                                                                            | 41, 42, 43, 51                                          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server_web/query/cms/articles/moderation/changelogs_flags_test.exs` (removed)                                                                       | 43, 44, 45, 53                                          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server_web/query/cms/articles/moderation/docs_flags_test.exs` (removed)                                                                             | 39, 40, 41, 54                                          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| `backend/api/test/groupher_server_web/query/cms/articles/moderation/posts_flags_test.exs` (removed)                                                                            | 41, 42, 43, 51                                          | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/articles/read/blog_test.exs](../../backend/api/test/groupher_server_web/query/cms/articles/read/blog_test.exs)                 | 38, 39, 40, 75, 76, 77, 80, 81, 82, 88, 89, 97 …        | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/articles/read/changelog_test.exs](../../backend/api/test/groupher_server_web/query/cms/articles/read/changelog_test.exs)       | 38, 39, 40, 75, 76, 77, 80, 81, 82, 88, 89, 97 …        | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/articles/read/doc_test.exs](../../backend/api/test/groupher_server_web/query/cms/articles/read/doc_test.exs)                   | 38, 39, 40, 75, 76, 77, 80, 81, 82, 88, 89, 98 …        | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/articles/read/post_test.exs](../../backend/api/test/groupher_server_web/query/cms/articles/read/post_test.exs)                 | 38, 39, 40, 98, 99, 100, 103, 104, 105, 111, 112, 120 … | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/comments/blog_comment_test.exs](../../backend/api/test/groupher_server_web/query/cms/comments/blog_comment_test.exs)           | 191                                                     | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/comments/changelog_comment_test.exs](../../backend/api/test/groupher_server_web/query/cms/comments/changelog_comment_test.exs) | 191                                                     | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/comments/doc_comment_test.exs](../../backend/api/test/groupher_server_web/query/cms/comments/doc_comment_test.exs)             | 192                                                     | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/groupher_server_web/query/cms/comments/post_comment_test.exs](../../backend/api/test/groupher_server_web/query/cms/comments/post_comment_test.exs)           | 215                                                     | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/helper/schema/article.ex](../../backend/api/test/helper/schema/article.ex)                                                                                   | 689, 690, 691                                           | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |
| [backend/api/test/helper/schema/comment.ex](../../backend/api/test/helper/schema/comment.ex)                                                                                   | 408, 409, 410                                           | 删除旧状态断言、fixture 和专用用例；保留非审核用例，新合同测试独立建立                                       |

### 依赖：删除专用项、保留共享项

| 文件                                               | 定位（源码行 / 文档说明） | 处理方向                                                                                                          |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [backend/api/mix.exs](../../backend/api/mix.exs)   | 80, 106                   | 删除 AuditBot 专用 html_sanitize_ex 及 lock 项；用依赖工具清理孤立传递项，保留 Tesla（Umami/Algolia/Assets 使用） |
| [backend/api/mix.lock](../../backend/api/mix.lock) | 41, 87                    | 删除 AuditBot 专用 html_sanitize_ex 及 lock 项；用依赖工具清理孤立传递项，保留 Tesla（Umami/Algolia/Assets 使用） |

### 历史 migration

| 文件                                                                                                                                                                                             | 定位（源码行 / 文档说明）                   | 处理方向                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------ |
| [backend/api/priv/repo/migrations/20260930090000_create_article_revision_draft_target.exs](../../backend/api/priv/repo/migrations/20260930090000_create_article_revision_draft_target.exs)       | 18, 19, 20, 83, 85, 175, 176, 177, 191, 193 | 保留历史；新 migration 处理旧列/JSON，不改写历史 |
| [backend/api/priv/repo/migrations/20260930150000_normalize_stable_article_illegal_reason.exs](../../backend/api/priv/repo/migrations/20260930150000_normalize_stable_article_illegal_reason.exs) | 1, 11, 13, 14, 19, 26, 27, 28, 30, 31       | 保留历史；新 migration 处理旧列/JSON，不改写历史 |

### 保留

| 文件                                                                                                                                                       | 定位（源码行 / 文档说明） | 处理方向                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| [frontend/core/lib/analytics/baidu.ts](../../frontend/core/lib/analytics/baidu.ts)                                                                         | 10                        | 保留：百度网站统计/SEO 展示，非百度内容审核；不删除其配置                      |
| [frontend/core/spec/index.ts](../../frontend/core/spec/index.ts)                                                                                           | 51                        | 保留：百度网站统计/SEO 展示，非百度内容审核；不删除其配置                      |
| [frontend/landing/src/widgets/Landing/DashboardIntros/SeoTab/WebCard.tsx](../../frontend/landing/src/widgets/Landing/DashboardIntros/SeoTab/WebCard.tsx)   | 22                        | 保留：百度网站统计/SEO 展示，非百度内容审核；不删除其配置                      |
| [backend/api/lib/groupher_server/accounts/front_desk/query.ex](../../backend/api/lib/groupher_server/accounts/front_desk/query.ex)                         | 60                        | 非法 read-mode :audit 分支/测试，与内容检测无关                                |
| [backend/api/test/groupher_server/accounts/front_desk/front_desk_test.exs](../../backend/api/test/groupher_server/accounts/front_desk/front_desk_test.exs) | 52                        | 非法 read-mode :audit 分支/测试，与内容检测无关                                |
| [backend/api/lib/groupher_server/cms/docs/trash.ex](../../backend/api/lib/groupher_server/cms/docs/trash.ex)                                               | 360                       | 保留 opts[:audit]：Activity.log 操作日志开关，与内容审核无关                   |
| [backend/api/lib/groupher_server/cms/communities/lifecycle.ex](../../backend/api/lib/groupher_server/cms/communities/lifecycle.ex)                         | 271                       | 保留 :audit_action / write_audit：Lifecycle 操作审计，缺失会回滚，不是内容检测 |

### 文档

| 文件                                                                                                                       | 定位（源码行 / 文档说明）    | 处理方向                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| [docs/architecture/cms-facade-directory.md](../../docs/architecture/cms-facade-directory.md)                               | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/architecture/resource-loading-boundary.md](../../docs/architecture/resource-loading-boundary.md)                     | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/content-import/article-publish-import-refactor.md](../../docs/content-import/article-publish-import-refactor.md)     | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/activity/v1.md](../../docs/feature/activity/v1.md)                                                           | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/article/revision-draft-target.md](../../docs/feature/article/revision-draft-target.md)                       | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/gate/lifecycle-cleanup.md](../../docs/feature/gate/lifecycle-cleanup.md)                                     | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/gate/v4.md](../../docs/feature/gate/v4.md)                                                                   | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/interaction/v1.md](../../docs/feature/interaction/v1.md)                                                     | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/post/current-contract.md](../../docs/feature/post/current-contract.md)                                       | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/feature/post/solution-v2.md](../../docs/feature/post/solution-v2.md)                                                 | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/infra/diagnostics/sentinel-v1.md](../../docs/infra/diagnostics/sentinel-v1.md)                                       | 全文：superseded 重定向      | 已收敛为新设计入口，不再引用收敛前行号                                       |
| [docs/migrations/backend-non-command-write-entry-audit.md](../../docs/migrations/backend-non-command-write-entry-audit.md) | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/migrations/cms-command-entry-and-naming-fix.md](../../docs/migrations/cms-command-entry-and-naming-fix.md)           | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/migrations/cms-command-phase-5-legacy-workflows.md](../../docs/migrations/cms-command-phase-5-legacy-workflows.md)   | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/migrations/gate-admission-convergence.md](../../docs/migrations/gate-admission-convergence.md)                       | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/migrations/legacy-content-audit-removal.md](../../docs/migrations/legacy-content-audit-removal.md)                   | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |
| [docs/migrations/policy-boundary-fix.md](../../docs/migrations/policy-boundary-fix.md)                                     | 当前正文（按旧协议词族定位） | 历史事实仅作退役证据；当前目标以 AlertBoard/ReviewBot 为准，不据此保留旧实现 |

## 扫描外的实施核实

- 生产 Oban/cron 执行状态、百度账户与部署 secret store：本轮未访问。
- 数据库实际旧列、CHECK/index 和 JSON 残留规模：本轮未连接数据库。
- `frontend/mock-server/schema.graphql` 的共享 schema 链接随来源检查，不能单独保留旧协议。
- 举报迁入 AlertBoard 的命令/权限矩阵见 [实施合同](../feature/alert-board/implementation.md) §5/§8/§11；代码迁移尚未实施。
- Tesla 的共享消费者包含 Umami、Algolia、Assets provider deletion，保留对应业务；html_sanitize_ex 是旧 Audit 专用依赖，删除。
