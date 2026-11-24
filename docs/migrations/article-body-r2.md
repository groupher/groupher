# R2：ArticleBody 存储与保存 / 固定 / fork

日期：2026-11-12。范围：`doc-redesign` 当前工作区；未提交，未对目标环境执行迁移。

依据：[Article 基座](../feature/article/working-copy-snapshot-target.md)、[Docs 合同](./docs-publish-queue-refactor.md)、[R0 入口清单](./article-docs-r0-r1-inventory.md)。本次只实施 R2；ArticlePublicBody、D 按需保留、plan_hash 移除、旧 Branch / Draft 退役仍属于后续批次。

> 后续状态：独立 PublicBody 已在 [R3](./article-public-body-r3.md)实施。下文保留 R2 当时的代码和验收边界；“当前公开读经 Snapshot 读 ArticleBody”属于 R2 阶段记录，不是最新读取合同。

## 1. 已实施的存储与写链

```text
ArticleWorkingCopy --- body_id ---> ArticleBody(type=working_copy)
       |                              可修改、owner 独占
       | 保存：锁 Article / WorkingCopy，校验 revision
       |       正文全部格式 + 元数据 / tags / Cover / refs + revision 同事务
       |
       +-- Freeze ----------------> ArticleSnapshot
       |                             |
       |                             +-- body_id ---> ArticleBody(type=snapshot)
       |                                              独立复制，禁止 UPDATE
       |
       +<-- fork Snapshot -------- 新 WorkingCopy + 新可变 ArticleBody

当前公开读：Public -> Snapshot -> ArticleBody
R3 待实现：Public + 独立 ArticlePublicBody
```

- 新 `CMS.Model.ArticleBody` 集中定义完整正文字段及校验；`CMS.Articles.Body.document/1` 是内容 owner 的正文转换入口。保存链仍由可信 BodyBag 提供完整输出；读取和 Freeze 不重新生成格式。
- WorkingCopy / Snapshot 删除内联 `body_*` 存储列，改用 `body_id` 关联，不保留旧列、双写或 fallback。
- 创建、保存、Freeze、fork 使用关联 changeset 在调用方事务中写入正文。保存更新原正文行，推进 owner revision；Freeze / fork 创建独立正文行。既有 `source_working_copy_id + source_revision` Freeze 幂等身份不变。
- Docs 保存已存正文 / 合入路径改读完整 ArticleBody，包含 XML / RSS；内容比较使用正文值，不比较 body_id。D / Q 的生命周期、审批算法和发布策略不变。
- WorkingCopy 删除后数据库清除它独占的正文；Snapshot 正文及其历史资产引用不随 WorkingCopy 删除。Snapshot 自身删除时清其独占正文，但本批次没有新增历史删除入口或时间清理任务。

## 2. 数据库约束与迁移

新增 `backend/api/priv/repo/migrations/20261112130000_extract_article_bodies.exs`：

1. 排他锁定 WorkingCopy / Snapshot 表，任一非空即拒绝迁移。不回填、不搬运旧正文；失败时事务回滚。
2. 创建 `cms.article_bodies`：UUID 主键、article_id、type、完整正文列；schema_version > 0，必需格式 NOT NULL。
3. 两类 owner 增加 NOT NULL body_id；唯一约束阻止同类共享，生成的 body_type 常量与复合外键校验正文 Article 归属及类型，阻止跨文章 / 跨类型引用。
4. 数据库禁止 Snapshot body UPDATE，禁止 body 的 type / article_id / id 变化，禁止 WorkingCopy 换绑正文。删除正文前由外键保护现存 owner。
5. 删除 owner 内联正文字段，并重新建立原先与 body_schema_version 合并定义的 owner revision 正数约束。
6. down 明确拒绝：没有旧正文数据回迁方案，不用回滚脚本重新引入兼容存储。

迁移与读取代码需同步部署，不能让内联正文旧构建与新表结构混跑。正式清理和切换仍须 R8 的完整盘点及批准；本次隔离空库演练不替代该流程。

## 3. 消费者改接范围

| 范围                                                                                                     | 本批次变更                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `articles/working_copy/{store,snapshotter,query,diff}.ex`                                                | 创建 / 保存 / 固定 / fork / 读取 / diff 改为 ArticleBody；列表关联读取避免逐项加载正文               |
| `articles/{public,snapshot_projection,publishable}.ex`、`publish/target.ex`、`working_copy/publisher.ex` | 保持既有发布流程，只替换已移除的内联正文读取；不是 R3 PublicBody 交付                                |
| `doc_tree/publish/{content_state,content_merge,queue_release}.ex`                                        | 完整正文 map 使用 json / schema_version 等字段；合入选择、审批和队列消费语义不变                     |
| `assets/refs.ex`、`review/commands/recheck.ex`                                                           | 从指定 owner 的 ArticleBody 提取资产引用和审核文本，仍绑定同一 Snapshot 身份                         |
| `press/query.ex`、`search_artiments/capacity.ex`                                                         | 当前公开 Snapshot 的正文读取 join ArticleBody，Press 批量读取不逐篇查正文；后续 R3 才切换 PublicBody |
| `tickets/{query,persist,mentions}.ex`                                                                    | 保持 Ticket 产品边界；内容比较、复制、Mention 改读独占正文                                           |
| GraphQL `spec.ex` 与 CMS facade                                                                          | 保留当前 bodyJson 等 wire 字段，resolver 改取 ArticleBody；未增加兼容字段或改变 schema               |
| 测试与隔离验证脚本                                                                                       | 修改直接构造 owner 的正文 fixture，新增正文约束与事务测试                                            |

旧 ArticleBodyDraft / ArticleBodySnapshot 模型及其实际依赖未在本批次删除；它们不参与新的 WorkingCopy / Snapshot 写链。旧 BodyBag 传输校验字段也未借此批次扩展改名。

## 4. 验证与已知范围外问题

所有数据库验证仅在新建的独立测试库 `groupher_r02_20261112`、`groupher_docs_b0_r02` 执行。

| 检查                                                                                                          | 实际结果                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 空库全量迁移，包括 `20261112130000_extract_article_bodies`                                                    | 两个隔离库均通过；未对目标环境运行                                                                                                                                                                        |
| BodyStorage、WorkingCopy API、DeleteWorkingCopy pipeline、Docs ContentState / ContentMerge / Discard 聚焦测试 | **33 tests / 0 failures**。覆盖全部正文格式、独占复制、保存 revision / 重放、Freeze 幂等、fork 隔离、删除自身正文、数据库不可变 / 类型 / 跨文章 / 共享保护、失败回滚、非空迁移拒绝、GraphQL 和 Press 读取 |
| 加入原 WorkingCopySnapshot 综合测试                                                                           | 当次 **38/39 passed**，唯一失败为旧 Assets usage 查询的 branch_id 依赖；未标记跳过或删去原断言。之后新增的 Press 测试已包含在上述 33 项中                                                                 |
| `scripts/docs_queue_consume_verify.exs`                                                                       | `Docs Queue publication consumption passed`                                                                                                                                                               |
| `scripts/docs_release_verify.exs`                                                                             | `Docs Release recording passed`；这是现有发布算法回归，不是 R4 的结构化校验验收                                                                                                                           |
| `MIX_ENV=test mix compile --warnings-as-errors`、修改文件 `mix format --check-formatted`                      | 通过                                                                                                                                                                                                      |
| `MIX_ENV=test mix lint.context`                                                                               | 通过，14 个 scanner tests，0 findings                                                                                                                                                                     |
| `pnpm run contract:graphql:generated`                                                                         | 通过（59 source files）；R2 未改变 wire schema，不需新增生成字段                                                                                                                                          |
| `pnpm run docs:check`                                                                                         | scanner 11 tests 通过，覆盖检查仍有 7 项既有缺口（one_of_validation 与 Gate load / queries），后续聚合检查因此未运行                                                                                      |
| `MIX_ENV=test mix lint.style`                                                                                 | 未通过，57 项既有样式问题；后续 inline-do 子检查未运行。新 Body 模块、迁移、fixture 和测试无新增 scanner 报告                                                                                             |
| `git diff --check`                                                                                            | 通过                                                                                                                                                                                                      |

聚焦测试命令（在 `backend/api`，设置 `TEST_DB_NAME=groupher_r02_20261112 MIX_ENV=test`）：

```sh
mix test test/groupher_server/cms/articles/body_storage_test.exs \
  test/groupher_server_web/mutation/cms/articles/working_copy_api_contract_test.exs \
  test/groupher_server/cms/articles/commands/delete_working_copy_pipeline_test.exs \
  test/groupher_server/cms/doc_tree/publish/content_state_test.exs \
  test/groupher_server/cms/doc_tree/publish/content_merge_test.exs \
  test/groupher_server/cms/doc_tree/publish/discard_test.exs
```

Docs 脚本通过 `MIX_ENV=test TEST_DB_NAME=groupher_docs_b0_r02 DOCS_B0_DISPOSABLE_DATABASE=groupher_docs_b0_r02 mix run scripts/<上述脚本>` 执行。脚本会写 fixture，仅限显式隔离库；这些结果不代表真实服务身份、浏览器和外部 Search/CDN 投递验收。全量后端套件未运行。

测试新增 `test/support/article_content_fixture.ex`，只建立 Community core、Lifecycle 和 root moderator 等内容命令前置；后续保存 / 发布仍调用真实命令。原因是原 `mock_community` 调用生产社区创建，仍初始化已退役的 Docs Branch 表。该 fixture 不代表生产社区创建流程已修复或通过验收。

既有 Assets usage summary 查询仍引用 `docs_lifecycles.branch_id`。这是 R7 去旧机制缺口，本次保留该路径和失败证据，不用新正文存储掩盖它。

额外执行 `CMS.SearchArtiments.Capacity.measure/0` 时，ArticleBody 聚合查询执行后，未修改的 Comment 容量查询因将 `state` 条件绑定到 CommentBody 而非 CommentLifecycle 失败。该问题记录为范围外缺口，未在本批次修改；不能宣称 Search 容量接口整链通过。Press feed 的独立回归已通过。
