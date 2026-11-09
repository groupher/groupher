# MentionsGraph Doc Comment 联合验收

> 本文仅保留设计和历史结论。原始源码快照、测试日志与测量输出已从仓库移除；历史数字不作为当前发布验收证据。

> **历史证据（2026-11-04 至 2026-11-06）：**本文的 set／occurrence／初始化／重建、请求级 SQL 预算及按资源状态裁剪图标题、URL 或边的条款均不适用于 2026-11-07 当前关系实现。现行代码合同见[当前关系合同](./mentions-graph-sync-contract.md)，新目标只用全新空库，不迁 B4 内容。下文原始测量与当时的执行事实保留供追溯，不能作为本轮发布指引。

> 状态：2026-11-05，Replies 会话完成后独立执行。本轮关闭 B1 与 B3 的隔离环境出口；B2 功能/SQL 预算通过，代表性目标数据的性能出口仍未通过。B4 与外部候选搜索继续暂缓。

## 结果与证据

Replies 会话 `01a1a980-efd7-71a1-97a0-dfd427b454fc` 已完成且空闲；其 [实施记录](../../migrations/comment-reaction-snapshot-counts-implementation.md) 提供依赖交付范围。
本轮没有将那边的通过数当作联合证据，而是在当前代码重新运行 Commands、投影、Gate、GraphQL 和实际浏览器。

| 出口                 | 本轮验证                                                                                                                                                                                | 结论                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| B1 稳定身份          | main/preview 创建共享稳定父 Doc 的 Comment；Comment 不带 branch，父 endpoint 只有一个；编辑后旧 set 回收，迟到任务不覆盖新 set                                                          | 通过                    |
| B1 通知与恢复        | 真实 projector 重复投递只产生一次收件记录；已读状态在编辑后保留；保存 set 重建恢复相同 edge key/mentioned_at，重跑为 no-op；当前正文初始化两次复用 set，正文 token、Outbox 和收件箱不变 | 通过                    |
| B1 父级准入          | main 隐藏后直接根请求拒绝、入边来源过滤；不能借可读 preview 绕过；恢复后保持同一 endpoint/node ID，且不额外通知                                                                         | 通过                    |
| B2 混合读取          | Doc + 9 Comment 的 10-frontier 请求为 **21 SQL**；Post/Blog/Changelog/Doc/User Ticket/Comment 六类、含 Doc reply 的 10-frontier 请求为 **22 SQL**                                       | 功能与预算通过          |
| B2 Comment 一跳 HTTP | Doc Comment → Doc Comment，真实 GraphQL 双方向 offset 各 **14 SQL**、cursor 各 **13 SQL**；响应 locator 为稳定 Article/Comment ID，无 branch                                            | 通过，均 ≤32            |
| B3 真实入口          | Doc seeds → Comment focus → canonical Doc Comment URL → 返回文章；Post 实际评论按钮直接打开 Comment focus；返回时保留 Mentions tab；原生在途 fetch 被取消                               | **12 项浏览器检查通过** |
| B3 构建              | 当前 Community 生产构建、Phoenix production release 构建、Core/Community/Dash 类型、GraphQL 合同/generated                                                                              | 通过；未部署            |

新增 [联合用例](../../../backend/api/test/groupher_server/cms/mentions_doc_comment_joint_test.exs) 共 **5 项**。
最终在专用本地库从空 schema 完整迁移后，原 B1、版本事实、图 Query/预算、GraphQL 加共享 Doc Comments 的 7 文件组合 **171 passed**，包含新增文件全部 5 项。
原默认库组合曾为 170 passed（仅包含新增文件最初 4 项）；新增一跳 HTTP 后以本次 171 项结果为准。
评论 GraphQL 读写另行串行复跑 **168 passed**；两组共 339 项。证据：171 项后端日志、168 项 transport 日志。不以浏览器 fixture 替代权限测试。

验收摘要 汇总本轮状态与预算；Phoenix release 构建日志 保存本地构建结果。

前端 MentionsGraph、ArticleQueryProvider、Activity 和 AccountProvider/key/invalidation 定向 **31 passed**。
既有六类宿主、共享缓存、Activity/Ticket 的证据见 [独立验收](mentions-graph-b23-independent-acceptance.md)，原次数保持原范围。

较宽组合第一次为 169/170，一项有界 merge 触发既有请求 deadline；并行测试任务停止后，单项通过，同组按原预算完整重跑 **170 passed**。
未延长 timeout 或放宽 SQL 上限。新增一跳用例曾因测试正文低于最小长度、查询未选择 locator 失败，修正 fixture/selection 后通过；没有据此改动业务验证规则。
一次重跑遭遇本地 PostgreSQL recovery；默认库两个测试进程并行时还出现 fixture Command resolution pending。随后新建独立本地验收库、迁移完整 schema 并串行重跑，不重置或清空原数据库。
空库首次运行还暴露旧测试的误报：把私有 Comment ID 的数字作为整个 JSON 的禁用子串，会误中合法 public innerId。改为检查节点 ID 字段保持 opaque，不放宽身份披露合同。

## 实际修复

Post 评论的 Mentions 按钮位于左侧收起回复点击区下方，浏览器普通点击被 `Collapse replies` 拦截。
在现有 [List salon](../../../frontend/core/unit/Comments/List/salon/list.ts) 为入口增加 `ml-12`，移出缩进线点击区；保持原回调及折叠行为。
失败先由实际页面复现，修正后以普通 Playwright click 通过，未使用 force click 或派发事件绕过遮挡。

## 浏览器环境与复跑

[浏览器脚本](../../../frontend/e2e/scripts/mentions-doc-comment-joint-check.js) 经实际 Community router、BFF、Phoenix、真实 Command 写入的持久化数据执行。
证据 JSON 保存 12 项检查及公开请求身份，不含 token 或正文。
没有 `page.route`、mock GraphQL 响应或组件替身。CDP 只增加延迟以观察真实 AbortSignal/AbortError。
测试地址为 `home` 社区，评论创建者为测试用户 `xx`。

只在本机新建专用测试库运行 [fixture 脚本](../../../backend/api/scripts/mentions_doc_comment_browser.exs)：脚本检查 `MIX_ENV=test`、库名前缀、实际连接库名和空库，拒绝复用含内容的库。
该长期浏览器 API 进程使用普通连接池，避免测试 Sandbox owner 到期；不改项目默认测试池。
每次完整复跑使用新的库名，不删除旧库或复用他人的服务。

```sh
# backend/api；以下为本地测试库，不是目标环境命令。
export MIX_ENV=test
export TEST_DB_NAME=groupher_mentions_joint_browser_local_20261105
mix ecto.create
mix ecto.migrate
mix run --no-start scripts/mentions_doc_comment_browser.exs
```

另一个终端在仓库根目录启动实际 Community，并把两个 endpoint 指向上述 4197 API：

```sh
PORT=3197 E2E_AUTH_STACK=1 \
GRAPHQL_ENDPOINT=http://127.0.0.1:4197/graphiql \
PHOENIX_GRAPHQL_ENDPOINT=http://127.0.0.1:4197/graphiql \
pnpm --filter @groupher/frontend-community run dev

~/.codex/skills/playwright/scripts/playwright_cli.sh -s=mentions-joint open http://127.0.0.1:3197/
~/.codex/skills/playwright/scripts/playwright_cli.sh -s=mentions-joint run-code \
  --filename frontend/e2e/scripts/mentions-doc-comment-joint-check.js
```

浏览器脚本中的 path/innerId 对应此空库 fixture；metadata 写在 `/tmp/mentions-joint-browser-fixture.json`，可据此核对。
静态 fixture 图片/favicon/远端表情资源存在加载失败，匿名账户探针的 `account_login` 为预期拒绝；没有 MentionsGraph GraphQL 错误。
不把该结果称为全站零 console 错误验收。

## 后端与静态门禁复跑

```sh
# backend/api；使用上文之外的专用验收库，并先执行 ecto.create / ecto.migrate。
export TEST_DB_NAME=groupher_mentions_joint_acceptance_20261105
MIX_ENV=test mix test \
  test/groupher_server/cms/mentions_b1_acceptance_test.exs \
  test/groupher_server/cms/mention_version_facts_test.exs \
  test/groupher_server/cms/mentions_graph_query_test.exs \
  test/groupher_server/cms/mentions_graph_budget_test.exs \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs \
  test/groupher_server/cms/mentions_doc_comment_joint_test.exs \
  test/groupher_server/cms/comments/shared_doc_test.exs --max-cases 1 --seed 0
MIX_ENV=test mix test \
  test/groupher_server_web/query/cms/comments \
  test/groupher_server_web/mutation/cms/comments --max-cases 1 --seed 0
MIX_ENV=test mix compile --warnings-as-errors
MIX_ENV=prod mix release --overwrite
```

本轮没有运行无 Sandbox 的并发用例，避免把此默认测试库当作其私有 fixture 库；并发验证属于 Replies 的独立证据，不虚增本轮计数。
`pnpm docs:check`、GraphQL/generated、两端类型、warnings-as-errors、作用域内 format/wrapped-do 与 `git diff --check` 全部通过。
维护 Auth 再次实际签发 initialize/rebuild token，精确 scope/600 秒 TTL、错误 scope/resource/credential 拒绝与隔离 Phoenix verifier 5 项全部通过。
没有在服务中的旧 Phoenix release 执行初始化或重建，也未改目标正文。

## 保留出口

B2 仍缺新图代表性目标分布下的扫描量、延迟及全局 revision 行锁等待。
现有生产只读盘点没有可用于该验收的新图数据集，不能用本机合成 3,000 边或本轮小 fixture 替代；该缺口不通过启动 B4 补造。
当前可以签收的是 B1/B3 隔离环境及 B2 功能/SQL 切片，不表示整个 B1→B2→B3 顺序门禁已全部放行。
[B4 手册](../../deploy/runbooks/mentions-graph-cutover.md) 继续 BLOCKED：不迁移目标环境、不初始化目标数据、不排空旧 writer、不删除旧表/入口、不部署或切换。
外部候选搜索继续暂缓。
