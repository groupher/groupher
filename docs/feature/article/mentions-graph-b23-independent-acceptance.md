# MentionsGraph B2 / B3 独立验收记录

> 本文仅保留设计和历史结论。原始源码快照、测试日志与测量输出已从仓库移除；历史数字不作为当前发布验收证据。

> **历史证据（2026-11-04 至 2026-11-06）：**本文的 set／occurrence／初始化／重建、请求级 SQL 预算及按资源状态裁剪图标题、URL 或边的条款均不适用于 2026-11-07 当前关系实现。现行代码合同见[当前关系合同](./mentions-graph-sync-contract.md)，新目标只用全新空库，不迁 B4 内容。下文原始测量与当时的执行事实保留供追溯，不能作为本轮发布指引。

> 状态：2026-11-05 独立切片通过；随后 [Doc Comment 联合验收](mentions-graph-doc-comment-joint-acceptance.md) 已补齐，B1/B3 隔离环境出口通过。B2 仍缺代表性目标负载。本文以下通过数与未完成描述保留当时范围；2026-11-06 B4 改走全新空库并执行目标切换，当前状态见[切换手册](../../deploy/runbooks/mentions-graph-cutover.md)。外部候选搜索继续暂缓。

## B2：一跳与有界读取

本轮 B2 定向 **34 passed**（领域 15 项 + GraphQL 19 项），通过真实 Phoenix GraphQL 请求核验 offset/cursor 结果一致、SQL 精确 count、稳定分页与无重复、
不可读 target 占位、隐藏 source 在 LIMIT/count 前过滤、canonical drift 返回 pending，
以及 root/direction/revision 不匹配游标拒绝。覆盖普通 Article、Doc 正文、User 和已发布 User Ticket；
所有带 Comment 的联合场景单独保留，不以旧结论代替。

修正了一跳 PENDING 来源直接返回空页而跳过 cursor 校验的问题：来源尚未追平也必须验证游标，
跨根、跨方向或旧 revision 不得变成空页成功。新增失败用例先复现，修正后通过。

SQL telemetry 从 HTTP 入口计数，含 Community/Scope、状态、pending、revision fence 与设置 statement timeout，
仅排除事务控制语句。双方向 offset 各 **13 SQL**，双方向 cursor 各 **12 SQL**，均低于 32。
这组预算证据适用于本轮覆盖的非 Comment 组合，不代表六类混合最坏路径已联合签收。

完整图查询原先使用 source/target 的 `OR`，3,000 边场景会扫描整个邻域再排序。
现在出/入方向分别先取 `first + 1`，以 Ecto subquery / UNION 去重后再取合并页；
保留每方向公开来源过滤、cursor 和自引用去重。SQL 次数不增加，不改用裸 SQL 读取。
验收中的 EXPLAIN 使用 telemetry 捕获的实际完整查询及参数，单独的简化索引查询不再作为完整计划证据。

| 本地 3,000 边场景               | 图首批     | 一跳出边 cursor |
| ------------------------------- | ---------- | --------------- |
| 请求 SQL 数                     | 12         | 12              |
| 本次完整请求耗时                | 186.829 ms | 112.980 ms      |
| 邻接 SQL EXPLAIN execution time | 1.864 ms   | 0.473 ms        |
| lookahead 输出行数              | 21         | 21              |
| 计划中最大 scan 节点处理行数    | 21         | 21              |

改动前同一图计划的最大 scan 节点处理行数为 3,000；改动后出/入窗口索引均出现在完整计划中。
“最大 scan 节点”是本次计划中 `(Actual Rows + Rows Removed by Filter) × Actual Loops` 的最大值，
不是整条请求所有表的累计扫描量；不声称数据库总共只访问 21 行。
以上是一次本机合成运行，包含大量不可用占位 target，不能推导目标环境 p95 或生产容量。
指标来源见 摘要，
完整计划见 gzip JSON。

### 目标环境阻塞

只读 Fly RPC 盘点发现目标仍只有旧 `artiment_mentions` / `artiment_mention_sync_states`，旧关系共 27 行。
它们不是新 current sets 的代表性验收分母。目标未部署新图表，未建立指定的代表性隔离数据集，
因此不能在该目标证明新查询的扫描量、延迟及全局 revision 锁等待。
本轮没有为取得数据而执行迁移、初始化、复制正文、停机或切换。该性能出口保持未通过，不能用合成结果替代。

## B3：真实宿主与隔离

[浏览器脚本](../../../frontend/e2e/scripts/mentions-graph-host-check.js) 通过真实 Community router、
ArticleQueryProvider、Footer、TanStack Query 和浏览器 fetch 执行，HTTP 边界使用受控 GraphQL fixtures。
它没有 mock Footer/路由组件；后端权限与持久化由 Phoenix 用例验证，不将 fixture 响应当成权限证据。
测试路径统一使用 `home` 社区。

浏览器证据 包含 **23 项检查**：

- Post / Blog / Changelog / Doc 正文页未选中 Mentions 时零图请求，点击后只发该 route 的 canonical focus 和一个 frontier；切走移除图。
- Article 1 → Article 2 不串 focus/cache；图、Activity 的在途浏览器 fetch 在移除最后一个 tab observer 时原生拒绝为 AbortError。
- 通过实际 CommunityPreviewLink 打开 Post mask route 抽屉，按需加载图，浏览器后退移除 Footer。
- User Ticket 初始收起且没有 Article Activity 请求；展开只查 TICKET locator，收起移除图。

修正三个前端问题：

1. 图组件展开状态原先只按 local focus 保存，相同 innerId 跨 Community 会带入上一社区的 frontier；改为 Community + focus 共同绑定。
2. revision/content-change 失效时原先只 invalidate，重载期间继续保留旧标题/链接；现在先 reset 图/seed cache，再重载。
3. Ticket 宿主使用不存在的 `THREAD.TICKET`，导致 focus.type 实际缺失；改用图协议的 `'TICKET'`，不扩大全局 Article thread 集合。

组件回归另验证共享 QueryClient 的单次请求，以及仅在最后一个观察者离开时取消，避免为了 tab 清理而
中断另一个仍挂载的消费者。Activity 通过现有 viewer scope 隔离账户缓存；实际 AccountProvider + Activity hook 回归证明换号后旧数据立即消失，
旧 scope cache 被清理且新账户请求能完成。修正 AccountProvider 清理时误删新 scope 的风险，只移除其他 scope 的 viewer 数据。
后端另以 source owner 与 guest 对照证明图及一跳仍为同一匿名公开投影，不因登录身份扩大披露。
Comment callback/focus 与 Doc Comment 全链路仍须联合签收。

### Activity / Ticket

新增公开 ArticleLogs HTTP 用例覆盖同时间戳 cursor 分页、audit-only 动作不进入公开面、私有 metadata 不披露、
隐藏 root 拒绝及跨 Article cursor 拒绝。真实 Command 用例覆盖 Post 创建/关联 Ticket、receipt 重放去重及隐藏 Ticket target。
定向 **7 passed**。前轮较宽的 Activity + Ticket 回归为 **55 passed / 2 failed**；两处失败均为 Ticket 通知消费者
调用 Comment scope 时缺 `community_id`。2026-11-05 后续复核时，当前通知消费者已使用
`CommentScope.for_thread(:post, community_id: community_id)`，沿用 Ticket 所属社区限定公开 Post 与评论参与者，
未改成跨社区 `all_public()`，也未绕过 Gate。原两项测试已单独复跑 **2 passed**；同一较宽组合重新运行
**57 passed / 0 failed**，通知阻塞关闭。该结果不等于完成 Doc Comment 联合验收，后者仍保持等待。

## 重跑与边界

```sh
cd backend/api
MIX_ENV=test mix test \
  test/groupher_server/cms/mentions_graph_query_test.exs \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs --only b2_independent
MIX_ENV=test mix test \
  test/groupher_server_web/query/cms/article_activity_acceptance_test.exs \
  test/groupher_server/cms/tickets/commands/mutate_test.exs --only b3_independent
```

设置 `CMS_MENTIONS_B2_EVIDENCE_DIR` 可导出合成场景的完整计划；EXPLAIN ANALYZE 只运行测试捕获的 SELECT。
浏览器复跑需先启动当前 schema 的 mock server（4191，无 `E2E_AUTH_STACK`）和 Community dev（3191，
两个 GraphQL endpoint 指向 mock server），再执行：

```sh
~/.codex/skills/playwright/scripts/playwright_cli.sh -s=mentions-b3 open http://127.0.0.1:3191/
~/.codex/skills/playwright/scripts/playwright_cli.sh -s=mentions-b3 run-code \
  --filename frontend/e2e/scripts/mentions-graph-host-check.js
```

在仓库根目录运行上述浏览器命令。mock fixture 保留 route 的 numeric innerId/thread，避免随机内容身份掩盖宿主错误。
前端定向 **52 passed**，Core / Community 类型检查通过；GraphQL SDL/generated 已同步。
B1 总出口、完整 B2/B3、B4 均未宣布通过。

前轮 `pnpm docs:check` 的 5 项问题（ActivityTime、SchemaGeneration.Startup、Comment Scope、MemberRef 的模块 flow，
以及已删除 Participants 文件链接）已在当前源码/文档中修正。后续复验继续暴露本线程一处测试标题命名问题：
一跳图测试的 `relation set` 更正为准确的 `edge set`，未修改检查器或放宽规则。当前完整 `pnpm docs:check`
链路通过，`MIX_ENV=test mix compile --warnings-as-errors`、`git diff --check` 也通过。

上述是阻塞项的独立复验与关闭，不继承另一条会话的测试结论；B2 目标代表性性能出口及 Doc Comment 联合验收仍保留。

通知/Activity 复验命令：

```sh
cd backend/api
MIX_ENV=test mix test \
  test/groupher_server/cms/tickets/commands/mutate_test.exs \
  test/groupher_server/activity_test.exs \
  test/groupher_server_web/query/cms/article_activity_acceptance_test.exs
MIX_ENV=test mix compile --warnings-as-errors
```
