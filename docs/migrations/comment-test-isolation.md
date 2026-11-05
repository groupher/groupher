# 共享评论集成测试隔离与 MentionsGraph 联合验收

> 2026-11-05。本轮只修改测试调度与文档，不调整业务事务、graph revision 语义或超时，不发布。原始 pending 诊断及其源码/SHA 保留，见[历史原因审计](comment-pending-concurrency-audit.md)。

## MentionsGraph 依赖状态

[MentionsGraph Doc Comment 联合验收](../feature/article/mentions-graph-doc-comment-joint-acceptance.md) 已完成本地 B1/B3 及 B2 功能/SQL 预算出口，包含稳定 Doc/Comment 身份、通知/恢复、main 准入、GraphQL 和真实浏览器。不能继续以“等待 MentionsGraph 实现”描述本功能的当前状态。

这些结果不等于所有工作区改动已经提交，也不等于目标环境已发布。该模块的代表性性能出口及 B4 仍按其自身验收合同执行；本轮不替代、不干预该工作。

## 测试调度合同

`TestMate` 的 Article/Comment 工厂会更新 `mentions_graph_state(id=1)`；SQL Sandbox 外层事务持续到测试结束，因此不同 owner 的数据隔离不能消除单例行写锁冲突。

- `TestMate` 默认 `async: false`。原来省略 async 的198个集成测试模块继承此策略，不再被默认当作互不影响的数据库测试。
- 三个显式 async 的写入模块改为 `async: false`：`cms/wallpaper_test.exs`、`cms/content_import_flow_test.exs`、`cms/articles/bindings_test.exs`。
- 其余4个显式 async 的 TestMate 模块保留：`cms/query_builder_test.exs`、`accounts/profiles/browser_sessions_pagi_test.exs`、Web `error_response_test.exs` 和 `middleware/errorcat_chain_test.exs`。前者只构造查询，账号分页只写用户/session，错误格式化不创建公开内容；这些用例不写 graph revision 单例。
- 另行盘点显式 async 的 Case，检查 Factory、CMS/Repo 写入与共享版本引用，未发现其他显式 async 的 graph singleton writer。以后新增 async 用例必须检查间接 fixture/Command 写入，不能仅看测试正文有没有 revision SQL。
- 真正的并发正确性仍使用 `comments/concurrency_test.exs`、`articles/doc_owner_concurrency_test.exs` 的独立连接、barrier 和实际提交/回滚；保持这些测试，不改为共用 Sandbox connection，也不延长锁预算。

写入口盘点涵盖 Article 发布/修改/绑定/Lifecycle、Comment 创建/编辑/删除/Lifecycle、Doc Lifecycle、Community 更新/删除、Ticket Persist、ReviewBlocks/Decisions，以及 ArtimentMentions.Store 的 endpoint/set/状态投影。它们当前共享一个 revision 行；测试调度修复不消除该业务热点，也不提供生产吞吐保证。

串行集成测试会增加整套测试耗时；纯函数和确认不写单例的用例仍可显式 async。后续若需要更多并行度，应使用隔离数据库或重新设计单例合同，不能通过 fixture 跳过生产 revision 更新。

## 本轮验证

新建私有库 `groupher_comments_isolation_20261105`，不复用、清空或迁移既有运行库。统一使用 `MIX_ENV=test`、`MIX_BUILD_PATH=/private/tmp/groupher-comments-build-20261105` 和显式 `TEST_DB_NAME`。

联合组合包括评论 GraphQL query/mutation、Mention GraphQL、Mentions B1/版本事实/Query/Budget/Doc Comment 联合测试、shared_doc，以及上面三组写入和四组 async 对照。以 `--max-cases 4 --seed 0` 执行，**393 passed / 0 failures**，耗时280.9秒（async 6.3秒、sync 274.6秒），未出现 command_resolution_pending。该参数允许安全用例并发，受单例影响的集成模块按新的默认策略串行，不声称这些 writer 已能同时占用共享 Sandbox。

复跑命令（工作目录 `backend/api`，先对上述新库执行 `mix ecto.create` / `mix ecto.migrate`）：

```sh
export MIX_ENV=test
export TEST_DB_NAME=groupher_comments_isolation_20261105
export MIX_BUILD_PATH=/private/tmp/groupher-comments-build-20261105
mix test \
  test/groupher_server_web/query/cms/comments \
  test/groupher_server_web/mutation/cms/comments \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs \
  test/groupher_server/cms/mentions_b1_acceptance_test.exs \
  test/groupher_server/cms/mention_version_facts_test.exs \
  test/groupher_server/cms/mentions_graph_query_test.exs \
  test/groupher_server/cms/mentions_graph_budget_test.exs \
  test/groupher_server/cms/mentions_doc_comment_joint_test.exs \
  test/groupher_server/cms/comments/shared_doc_test.exs \
  test/groupher_server/cms/wallpaper_test.exs \
  test/groupher_server/cms/content_import_flow_test.exs \
  test/groupher_server/cms/articles/bindings_test.exs \
  test/groupher_server/cms/query_builder_test.exs \
  test/groupher_server/accounts/profiles/browser_sessions_pagi_test.exs \
  test/groupher_server_web/error_response_test.exs \
  test/groupher_server_web/middleware/errorcat_chain_test.exs \
  --max-cases 4 --seed 0
```

## 真实并发与保护回归

另建私有库 `groupher_comments_isolation_concurrency_20261105`，同一 build，执行以下组合，**28 passed / 0 failures**（9.5秒）。评论并发和 Doc owner 并发仍由独立连接/barrier 驱动真实提交与回滚，不因 TestMate 串行化而被替换。

```sh
TEST_DB_NAME=groupher_comments_isolation_concurrency_20261105 mix test \
  test/groupher_server/cms/comments/concurrency_test.exs \
  test/groupher_server/cms/articles/doc_owner_concurrency_test.exs \
  test/groupher_server/cms/comments/summary_test.exs \
  test/groupher_server/accounts/physical_delete_guard_test.exs \
  test/groupher_server/cms/comments/schema_generation_test.exs \
  --max-cases 4 --seed 0
```

[本轮源码正文/SHA、两组日志和结果](comment-reaction-snapshot-counts-audit/test-isolation-20261105T141611Z/manifest.json)。4个调整文件与联合测试运行中记录的哈希相同；该观测不等于整个共享工作区的不可变 checkout，不覆盖另一会话的原始联合验收证据。

本轮已关闭的是测试调度导致的 pending 缺口；没有移动业务 revision bump、改全局版本合同、延长超时或宣称生产吞吐达标。B5 的目标新库/manifest、旧数据处置授权、旧 writer/Job drain、完整构建与缓存切换、目标 URL 验收仍未执行。提交与推送按用户单独授权执行，本轮未推送、未发布。

静态检查：完整 `pnpm docs:check`、`mix compile --warnings-as-errors`、4个调整文件的格式检查、作用域内 `git diff --check` 通过；本轮涉及的5份文档共81个本地链接有效，归档正文/日志均与 manifest SHA 相符。
