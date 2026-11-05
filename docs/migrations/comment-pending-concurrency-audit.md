# 并行测试 command_resolution_pending 原因审计

> 后续状态：本页保留原因确认阶段的历史结论和原始证据。用户随后授权修复测试隔离；`TestMate` 默认串行及显式 async 写入用例的调整见[测试隔离与联合验收](comment-test-isolation.md)。下文“未修复常规并行测试配置”描述原诊断时点，不作为后续实施状态。业务全局 revision 热点和真实发布仍分别受原有边界约束。

> 2026-11-05。范围：只诊断上轮 GraphQL 并行回归的 pending，未修改业务代码、测试框架或生产配置，未发布；仅使用新建私有库 `groupher_pending_audit_20261105` 和临时诊断测试。原有脏工作区及其他 session 保持。

## 1. 结论

已复现的 pending 来自 **并行 SQL Sandbox 长事务争抢 MentionsGraph 的全局版本单例行**。不是本次评论 count/快照更新出现了漏计或重复执行；捕获到的失败发生在 `mock_article` 创建夹具阶段，尚未执行该用例的 emotion 操作。

这同时暴露一个真实业务设计限制：`mentions_graph_state(id=1)` 是全局串行写热点。Sandbox 将持锁时间扩大到整个测试生命周期，触发当前失败；生产中若有长事务占用此行，其他业务事务超过4秒也会收到 pending。因此不能将结果解释为“业务永远没有并发问题”。本次真实提交对照没有复现计数损坏，也不是生产负载容量证明。

## 2. 原始错误与链路

[固定证据 manifest](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/manifest.json) 保存源码正文/SHA、诊断脚本和原始日志。

```text
并行 GraphQL test A
  -> Sandbox outer transaction（直到 on_exit 才 rollback）
  -> Article/Comment 写入 -> UPDATE mentions_graph_state(id=1)
  -> 业务内层事务返回，但 outer transaction 仍持有行锁

并行 test B -> mock_article -> CMS.Articles.create
  -> 同一全局行等待
  -> lock_timeout=4000ms -> PostgreSQL lock_not_available
  -> Receipt.Runner normalize_transaction_error -> command_resolution_pending
  -> Factory 模式匹配 {:ok, article} 失败，测试尚未进入自己的业务断言
```

对应源码：

- [MentionsGraphRevision.bump](../../backend/api/lib/groupher_server/cms/artiment_mentions/mentions_graph_revision.ex)：固定 id=1，在调用方事务 `inc revision`；普通文章生命周期、binding、Store、评论 capture 等均可触发。
- [ConnCase](../../backend/api/lib/support/conn_case.ex)：每个 async test 各有 Sandbox owner，on_exit 才停止 owner；隔离了可见数据，不能隔离同一已存在行的写锁。
- [Receipt.Runner](../../backend/api/lib/groupher_server/cms/command/receipt/runner.ex)：锁预算4秒、事务预算30秒；lock_not_available/query_canceled/连接错误统一映射为可重试 pending。
- [TransactionSettings](../../backend/api/lib/helper/orm/transaction_settings.ex)：使用 transaction-local `set_config`，没有把超时永久写到连接/数据库配置。
- [Factory.mock_article](../../backend/api/lib/support/factory/factory.ex)：创建夹具调用真实 `CMS.Articles.create`，不是内存 mock。

pending 是边界错误分类，本身不能区分锁超时、连接中断、receipt 等待或结果恢复失败。此次通过 SQL telemetry 捕获到被归一化前的 PostgreSQL 原因，不靠错误名称推测。

## 3. 按原场景复现

工作目录 `backend/api`；新私有库按当前 schema 初始化，未使用旧运行库。

```bash
MIX_ENV=test TEST_DB_NAME=groupher_pending_audit_20261105 \
MIX_BUILD_PATH=/private/tmp/groupher-comments-build-20261105 \
PENDING_AUDIT_OUTPUT=/tmp/pending-parallel-probe.jsonl \
mix test /tmp/pending_probe_test.exs \
  test/groupher_server_web/query/cms/comments \
  test/groupher_server_web/mutation/cms/comments \
  test/groupher_server_web/query/cms/artiment_mentions_test.exs \
  --max-cases 4 --max-failures 1 --seed 545394
```

临时文件的可恢复正文见证据目录中的 `.exs.txt`；复跑前复制回 `/tmp`。probe 只记录 SQL 错误，并用额外连接只读轮询同一私有库的 `pg_stat_activity` / `pg_blocking_pids`，不改变超时、事务、锁或业务结果，不记录 SQL params/连接密码。

[复现日志](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/pending-parallel-test.log)：19.8秒触发首个失败，达到 max-failures 后停止；2个用例通过、1个夹具失败。其他在途连接也产生错误，合计抓到3个 PostgreSQL 错误，全部是：

```sql
UPDATE "cms"."mentions_graph_state" AS m0
SET "revision" = m0."revision" + $1 WHERE (m0."id" = $2)
```

错误为 `lock_not_available`，消息 `canceling statement due to lock timeout`；其中包含 `while updating tuple (0,1) in relation "mentions_graph_state"`。

[75次阻塞采样](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/pending-parallel-probe.jsonl) 中有 `tuple` / `transactionid` 等待链，根阻塞者包含 `idle in transaction`；观察到阻塞者事务年龄最高11.65秒。没有捕获到 count SQL、receipt 唯一键或 bitmap SQL 作为这3个 pending 的失败语句，也没有捕获 deadlock_detected。

## 4. 因果对照与真实提交

[诊断测试正文](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/pending_causal_test.exs.txt) 不放入常规业务/测试运行目录，不更改产品逻辑。

| 对照               | 过程与结果                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sandbox 保留锁     | 连接A：Sandbox checkout → 内层事务 bump → 内层成功返回，保留外层 Sandbox。连接B：真实 CMS.Articles.create。B约4秒后 pending，A仍未退出。释放A外层后，B用同一 commandId 重试成功，只生成一个 Article，初始 comments_count=0、revision=1 |
| 实际提交的并发创建 | 4个独立连接、不同 Community/actor，经 barrier 同时调用真实 CMS.Articles.create，使用 unboxed_run，没有覆盖整个测试的 Sandbox 外层事务。4个命令全部提交                                                                                 |
| 同文章并发评论     | 4个独立连接、4位作者，同时向刚创建的同一文章写评论。4条事实提交；comments_count=4、参与人数=4、快照4位、comments_revision=5                                                                                                            |

用 `--repeat-until-failure 5` 重复（Mix 是首次运行加5次重复，实际6轮）：[运行日志](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/pending-repeated-test.log)、[逐轮结果](comment-reaction-snapshot-counts-audit/pending-20261105T113700Z/pending-causal-repeats.jsonl)。12次因果测试全部通过：

- 6/6 Sandbox 受阻返回 pending，等待4089–4229ms；释放持锁者后同 commandId 重试6/6成功。
- 24/24真实并发 Article 创建成功，各轮4请求整体耗时130–208ms。
- 24/24真实并发评论成功，各轮4请求整体耗时113–228ms；6轮事实、count、人数、快照和 revision 断言全部通过。

这些是低负载、4并发、固定小正文的正确性对照；未测试大正文、多目标捕获或更高持续吞吐，不能外推生产 P95/P99。

## 5. 后续处理边界

1. **测试层**：影响全局 graph revision 的 Sandbox 集成测试不能当作互不影响的 async 用例。应审计全部 singleton writer，把相冲突的 Sandbox 用例显式串行/隔离到独立测试库；不是仅在一次命令加 max-cases 1 后宣称问题已修复。
2. **业务并发验收**：保留独立连接、真实提交/barrier 的测试，不能用共享 Sandbox connection 上的 Task 或串行 GraphQL suite 代替。本轮对照已验证当前小负载事实/摘要一致性。
3. **性能设计**：全局 graph revision 热点需要独立评估事务持锁区间、所有 bump 入口、实际写入耗时及持续负载。未授权在本轮移动 bump 到事务外、改分片版本合同、取消版本栅栏或扩大锁超时。
4. **错误观测**：需要分别观测 pending 的原始锁/语句/连接原因，避免 transport 只看到统一 pending；本轮仅用临时 probe，未加入业务日志或遥测改动。

本轮只完成原因确认、因果实验与证据归档。未修复常规并行测试配置，未对全局版本热点做业务重构，未发布。此前“pending尚未查清”的状态由本记录取代，“尚未修复”和 B5 发布阻断继续保留。
