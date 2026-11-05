> 后续授权与实施：用户已明确授权进入共享评论业务实现；下面保留 07:55 的历史漂移观察。当前实现、验收和发布剩余项见 [实施记录](comment-reaction-snapshot-counts-implementation.md)，不再以本页历史“未进入 B1”描述当前进度。原快照正文和 SHA 不变。

# B0 捕获后剩余差异

> 观察时点：2026-11-05T07:55:39+00:00。这是时间点记录，不宣称后续工作区无变化；仅记录差异，没有复核/运行它们，也没有干预其他 session。

权威复核输入仍为 [20261105T074802Z](comment-reaction-snapshot-counts-audit/20261105T074802Z/manifest.json)。本次观测的 [机器清单](comment-reaction-snapshot-counts-audit/after-20261105T075539Z/differences.json) 保存新正文、可恢复的逐行 patch、scope 与匹配状态；不覆盖原快照。

- 固定复核输入 49 项，其中 48 项在本次观察仍匹配；捕获后 scope 内 1 项发生变化或新增/删除。
- 未变的原 scope 文件只留哈希；若它们后来首次变化，标记为待下一快照纳入，不能伪造旧正文 patch。
- 下表所有项均为“捕获后尚未复核”，ledger/case 是影响归属，不是通过结论。

| 文件                                                                   | 状态                   | SHA（快照 → 本次观察）                                                                                                                  | Ledger / case                         | 新正文 / patch                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/api/test/groupher_server/cms/mentions_b1_acceptance_test.exs` | changed_after_snapshot | `d2fe615fca2033d15d4c431b7409977a6600f30c6dd818955889a47195906b10` → `9a79b93bfd861cd7fb1b3e41b315e557350fec0e78fff6542e77f67945933fed` | M08/M09/M10；MENT-03、MENT-04、MSG-03 | [正文](comment-reaction-snapshot-counts-audit/after-20261105T075539Z/files/backend/api/test/groupher_server/cms/mentions_b1_acceptance_test.exs.txt)、[patch](comment-reaction-snapshot-counts-audit/after-20261105T075539Z/diffs/backend/api/test/groupher_server/cms/mentions_b1_acceptance_test.exs.patch.txt) |

## 仍未完成的设计与运行验收

固定复核发现的 F01–F10 见 [snapshot review](comment-reaction-snapshot-counts-snapshot-review.md#3-对方案与验收的影响)。尤其唯一 binding owner、最后 branch 保留讨论、Comment 通知 branch 元数据、旧盘点 script，以及新 CommentContext/count/snapshot/版本链，仍由原实施批次负责。本轮文档与静态核对没有完成这些业务实现。

后续消费流程：以本快照为起点读取以上 patch/正文，单独冻结下一批变化并追加复核记录；已有结论继续只绑定原 SHA。不以“最新 current”覆盖历史，不把其他 session 的测试通过数并入本计划。B0 整体未通过，不进入共享评论 B1。

## 后续实施阶段的剩余项（2026-11-05）

MentionsGraph 已完成[Doc Comment 本地联合验收](../feature/article/mentions-graph-doc-comment-joint-acceptance.md)，不能继续列为等待实现。后续测试调度调整与当前复跑结果见[测试隔离与联合验收](comment-test-isolation.md)；下文关于未修复 pending 的观察保留为先前验收时点记录。

用户后续已授权业务实现，B1–B4/B6 的工作区交付及本轮测试见实施记录。原49项输入与07:55观测不作覆盖；实施期的新来源指纹/正文差异在 `implementation-20261105T111200Z` 目录按观察批次保存。

当前外部前置仍是 B5 的真实目标新库 manifest/执行人、旧数据处置授权、旧 API/worker drain、旧 repair Job 清理、统一构建/缓存失效和目标 URL 验收。私有测试库和本地浏览器不替代这些条件。Transport 首轮并行夹具创建出现 pending 的历史观察保留在实施记录；后续测试隔离修复及393项联合、28项并发/摘要/guard 与准入回归另见上述新记录，不用早先串行通过数替代该修复证据。

最终 transport 192项串行回归通过；其固定输入5717项的结束观察差异为0，22项实施期差异的正文/SHA及 ledger/case 映射已归档。原 B0 剩余差异仍是历史记录；当前发布阻塞与并行 transport 夹具 pending 观察见实施记录，不复写原快照。
