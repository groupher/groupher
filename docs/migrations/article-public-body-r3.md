# R3：ArticlePublicBody、发布事务与公开读取

日期：2026-11-12。范围：`doc-redesign` 当前工作区；未提交，目标环境未迁移。

依据：[Article 基座](../feature/article/working-copy-snapshot-target.md)、[Docs 编排合同](./docs-publish-queue-refactor.md)、[R0 入口清单](./article-docs-r0-r1-inventory.md)。R4 的结构化审批、R5 的 D 生命周期、后续预览和去 Branch 等批次未在本次实施。

## 1. 发布和存储

```text
已保存 WorkingCopy -- Freeze --> Snapshot + 独占 ArticleBody
                                      |
                                      | 同事务选择 / 再发布
                                      v
                           锁 Article -> 锁 Public
                                      |
                         从持久化 Snapshot 读取完整正文
                                      |
                   +------------------+------------------+
                   |                                     |
            更新 ArticlePublic                  更新 ArticlePublicBody
            article_id / snapshot_id            article_id / snapshot_id
            公开元数据和列表投影                 完整正文独立副本
                   |                                     |
                   +--------- 提交时身份约束 --------------+
                                      |
                        事务成功后原有 Outbox 副作用
```

- 新 `article_public_bodies` 按 article_id 唯一保存完整正文和 snapshot_id，无 body_id，不引用历史 ArticleBody。
- `ArticleBodyDocument` 共用字段声明、校验和完整正文转换。两张正文表不分别维护字段规则；XML / RSS 与其他格式一起复制，不在公开读取或发布时重算。
- `Articles.Public.select_snapshot` 必须处于调用方事务，锁 Article / Public 后重新读取指定的持久化 Snapshot；内部事务保证正文写失败不会留下已改动的 Public。普通 Article、Docs Release 和 Ticket 原发布入口共用这一步。
- Public 与 PublicBody 的 article_id / snapshot_id 有双向、提交时检查的复合外键：不能提交缺正文的 Public、无 Public 的正文、或新旧版本混合状态。Public 删除级联删除当前正文，保留历史 Snapshot / ArticleBody。原 Lifecycle 隐藏 / 软删除策略不在此批次改写。
- `Public.rebuild(article, snapshot_id)` 是内部事务能力，无新增外部 mutation 或异步任务；按同一锁序检查当前 Public，只重建相同 snapshot_id，过期请求返回 public_conflict，并保留发布人和发布时间。
- 首发编号、Lifecycle、Review、Mention、Receipt 和副作用继续由原发布命令 / Release 编排；R3 没有重新定义它们，也没有改审批算法或 D 保留策略。

## 2. 公开读取

| 入口                  | 当前实现                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FrontDesk 公开详情    | Gate 通过后，Public.current 在同一 SQL 查询中读取 Public、匹配的 PublicBody 和所选 Snapshot 元数据；SnapshotProjection 从 PublicBody 提供完整正文。Snapshot 仍用于 typed fields、Cover 和资产身份 |
| Search 投影 / Indexer | 沿原 FrontDesk / Gate 读取当前公开 DTO，正文来自 PublicBody；旧任务仍重新加载当前公开内容，不从任务载荷恢复旧正文                                                                                 |
| Article 搜索容量统计  | `Capacity.article_documents` 在 Gate 可见 Article ID 集合中聚合 PublicBody，不扫描历史正文；按 Article 去重，避免多 Binding 重复计算                                                              |
| Press 详情            | 沿 FrontDesk 读取；输出保持原形状                                                                                                                                                                 |
| Press feed / manifest | 已通过原 Gate 的条目批量 join Public + PublicBody，两者身份同时匹配，不逐篇查询历史正文                                                                                                           |
| Ticket 公开读取       | 批量读取匹配 PublicBody；内部 WorkingCopy 编辑与未发布比较仍使用 ArticleBody。GraphQL 正文字段读取规范正文 map，不把 owner schema 当正文                                                          |

缺失或身份不匹配的公开正文不回退到历史 ArticleBody。公开列表继续使用 Public 中的 title / digest / plain_text / thumbnail 等现有轻量投影，符合主合同。历史、审批、Review 与基于 Snapshot 的复制操作仍读 ArticleBody；这些不属于公开正文读取。

## 3. 迁移与部署边界

新增 `20261112140000_create_article_public_bodies`：锁定 Public 表，非空即拒绝；不回填现有公开正文，不提供兼容读写。空隔离库按 R2 -> R3 顺序迁移。down 明确拒绝自动回退，不能启动依赖旧正文路径的旧构建。

目标环境必须在 R8 的清理 / 切换流程确认后执行，不能把本次空库验证当作放行。R3 未进行真实服务身份、浏览器、外部 Search / CDN 投递或全量后端验收。

## 4. 验证记录

| 检查                                                                                                                  | 结果与边界                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新空库完整迁移                                                                                                        | `groupher_r03_20261112`、`groupher_r03_concurrency_20261112`、`groupher_docs_b0_r03` 均通过；非空 Public 拒绝另有回归测试                                                                 |
| R3 PublicBody、R2 BodyStorage、WorkingCopy GraphQL API、DeleteWorkingCopy、Docs ContentState / ContentMerge / Discard | **41 tests / 0 failures**；包含完整格式复制、再发布与 Receipt 重放、已有 Snapshot 发布、正文写失败的快照 / 投影 / Outbox 回滚、重建冲突、提交约束、公开删除、权限、Ticket 公开 / 内部正文 |
| 公开读取 SQL 跟踪                                                                                                     | 详情、Search 投影和 Indexer、Press feed、Article 容量统计均查询 PublicBody，不查询 article_bodies；缺投影不回退                                                                           |
| 独立连接并发脚本                                                                                                      | 两个请求争同一公开版本：一个成功、另一个明确 public_conflict；过期重建被拒绝；另一连接不能看到未提交的新指针，回滚后正文与指针保持原样                                                    |
| Docs 队列消费 / Release 脚本                                                                                          | `Docs Queue publication consumption passed`、`Docs Release recording passed`；未变更现有审批与 D 策略                                                                                     |
| `MIX_ENV=test mix compile --warnings-as-errors`、本次 Elixir 文件格式检查                                             | 通过                                                                                                                                                                                      |
| `MIX_ENV=test mix lint.context`                                                                                       | 14 个 scanner tests 通过，0 findings                                                                                                                                                      |
| `pnpm run contract:graphql:generated`                                                                                 | 通过，59 source files；没有 wire schema 变化                                                                                                                                              |
| `pnpm run docs:check`                                                                                                 | scanner 11 tests 通过；仍有 7 项既有覆盖缺口（one_of_validation 与 Gate load / queries），后续聚合检查未运行                                                                              |
| `MIX_ENV=test mix lint.style`                                                                                         | 仍有 56 项既有样式问题；R3 新增模型、测试及 Public 实现无新增 scanner 报告，后续 inline-do 子检查未运行                                                                                   |
| `git diff --check`                                                                                                    | 通过                                                                                                                                                                                      |

聚焦测试在 `backend/api` 执行：

```sh
TEST_DB_NAME=groupher_r03_20261112 MIX_ENV=test mix test \
  test/groupher_server/cms/articles/public_body_test.exs \
  test/groupher_server/cms/articles/body_storage_test.exs \
  test/groupher_server_web/mutation/cms/articles/working_copy_api_contract_test.exs \
  test/groupher_server/cms/articles/commands/delete_working_copy_pipeline_test.exs \
  test/groupher_server/cms/doc_tree/publish/content_state_test.exs \
  test/groupher_server/cms/doc_tree/publish/content_merge_test.exs \
  test/groupher_server/cms/doc_tree/publish/discard_test.exs
```

真实数据库连接并发验证（只用于显式隔离库，会写 fixture）：

```sh
TEST_DB_NAME=groupher_r03_concurrency_20261112 \
ARTICLE_R3_DISPOSABLE_DATABASE=groupher_r03_concurrency_20261112 \
MIX_ENV=test mix run scripts/article_public_body_concurrency_verify.exs
```

Docs 两个脚本在 `groupher_docs_b0_r03` 上执行，设置同名 `TEST_DB_NAME`、`DOCS_B0_DISPOSABLE_DATABASE` 和 `MIX_ENV=test`：`scripts/docs_queue_consume_verify.exs`、`scripts/docs_release_verify.exs`。均经过空库迁移后执行，未操作目标环境。

这里的 Search 验收覆盖本地真实加载 / 投影 / Indexer 与测试平台 adapter，不代表真实外部索引投递；Press 验收也不代表生产 Workers / CDN 投递。全量后端套件、真实浏览器、真实服务身份和正式切换未执行。

已知范围外问题：Search 总容量接口的 Comment 分支仍存在错误 join 绑定及对已删除 comment.community_id 的依赖。修正第一处后发现第二处，因此未继续扩展 Comment 改造，保留原代码；R3 的 Article 容量能力单独验收，不能宣称整个 Comment 容量接口已修复。R2 记录的生产社区创建旧 Docs 初始化、Assets usage 的 branch_id 依赖也未改动。
