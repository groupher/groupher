# R4：Docs 审批、预览计划与 Release 结构化校验

日期：2026-11-12。范围：当前 `doc-redesign` 工作区，尚未提交；目标环境未切换。

依据：[Article 基座](../feature/article/working-copy-snapshot-target.md)、[Docs 合同](./docs-publish-queue-refactor.md)。只实施 R4，不改变 D 生命周期、审批 UI / 通知、完整站点预览或旧 Branch 清理。

## 实现边界

- `Plan` 不再生成摘要，只返回 `format_version / payload / target`。V1 payload 保留公开 Release、完整公开树、Article / Q / revision 成员、目录净操作；输入归一化和依赖排序沿用同一 planner，未知输入字段拒绝。整数使用领域整数约束，不再依赖 JCS 的浮点安全整数限制。
- 审批 `tree_plan` 存储结构化 JSONB 值。比较使用规范化 map / list 的严格结构比较；不比较 JSON 字符串，不计算摘要。对象键顺序无关，数组使用 planner 的确定顺序，null、空串、空数组及整数类型不混同。
- `ApprovalStatus` 先检查队列和策略 revision，再检查受支持的格式版本集合 `[1]` 和实际计划。同 revision 下计划或 Snapshot 来源不符返回 `needs_reapproval` 和一致性错误；格式不支持要求重新审批。planner 实现版本不是批准身份。
- 队列查询核对审批归属、sealed、公开基线，以及审批成员引用的不可变 Snapshot 的 Article / source_working_copy_id / source_revision；锁内发布独立复核，不信任查询结果。
- Release 继续逐项核对公开目录基线、实际队列净操作、Q 成员与 revision、获批 Snapshot ID、实际发布 Snapshot 来源和 Public head、删除成员及完整最终目录。无审批模式也执行这些检查。Receipt、权限、事务、锁序和 R3 PublicBody 原子投影边界不变。
- 只读预览计划和锁内发布计划仍调用相同的 `Approval.build_plan` / `Plan`，验证脚本改为比较结构化 payload。完整站点预览 UI、跨请求版本固定不属于本批。

## 迁移

新增 `20261112150000_remove_docs_plan_digests`，独占锁审批和 Release 表，要求两者为空，再移除两表的 `plan_hash / hash_algorithm`。非空拒绝，不重算、不转换旧批准、不删除历史。迁移不可逆，不提供摘要兼容回退。

此前建表迁移保持历史原貌；空库按完整迁移链最终得到无摘要字段的目标表。`docs_queue_b0_ddl.exs` / `docs_queue_b0_ddl_verify.exs` 是旧 B0 隔离模型脚本，不代表 R4 目标验收；当前验收使用正式迁移和新的 Release / Workspace 验证脚本。社区存续期间的历史永久保留规则不变。

## 验证

| 检查                        | 实际结果                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新空库完整迁移              | `groupher_r04_20261112`、`groupher_docs_b0_r04` 通过；确认两张目标表均无摘要列                                                                                                                 |
| 非空迁移拒绝                | 正式迁移在已有审批 / Release 的隔离库拒绝执行，事务回滚；未转换或删除历史                                                                                                                      |
| 聚焦测试及 R2 / R3 回归     | **67 tests / 0 failures**；Plan、ApprovalStatus、TreeOperations、TreeCodec、TargetTree、BodyStorage、PublicBody、WorkingCopy GraphQL、DeleteWorkingCopy、ContentState / ContentMerge / Discard |
| Release 真实数据库演练      | 通过；格式不支持、未知字段、目录 before / target / 操作篡改、成员缺失、Q ID / 来源 revision 不符、浮点 revision 均拒绝；审批快照发布、回放、权限和回滚继续通过                                 |
| Queue 消费演练              | `Docs Queue publication consumption passed`                                                                                                                                                    |
| Workspace 真实 GraphQL 演练 | 工作区 / Release / Review / 移动 / 确认出队、发布后冲突解决、审批及获批 Snapshot 发布通过；包含只读 REPEATABLE READ 快照计划与锁内发布计划结构相同的断言                                       |
| 编译、变更文件格式          | `MIX_ENV=test mix compile --warnings-as-errors`、格式检查通过                                                                                                                                  |
| `mix lint.context`          | 14 scanner tests 通过，0 findings                                                                                                                                                              |
| GraphQL generated smoke     | 通过，59 source files；本批未改变 wire schema                                                                                                                                                  |
| `pnpm run docs:check`       | scanner 11 tests 通过，仍被既有 7 项覆盖缺口阻断：OneOfValidation 的 ASCII 流程，以及 Gate load / queries 的 6 个公共函数文档；后续聚合检查未运行                                              |
| `mix lint.style`            | 仍有既有 56 项样式问题；本批新增 alias 问题已修复，后续 inline-do 子检查未运行                                                                                                                 |
| `git diff --check`          | 通过                                                                                                                                                                                           |

聚焦测试在 `backend/api` 使用 `TEST_DB_NAME=groupher_r04_20261112 MIX_ENV=test mix test`，文件见上表。真实连接演练使用 `TEST_DB_NAME=groupher_docs_b0_r04 DOCS_B0_DISPOSABLE_DATABASE=groupher_docs_b0_r04 MIX_ENV=test mix run`，依次执行 `scripts/docs_release_verify.exs`、`scripts/docs_queue_consume_verify.exs`、`scripts/docs_workspace_verify.exs`。

Release 演练故意制造结构不符时会记录一致性错误；Workspace 的拒绝场景仍出现既有 `Unstructured GraphQL error` 警告，断言均通过。非空迁移拒绝必须在独立事务测试，不能让预期的 SQL 失败污染后续发布验证。

未运行全量后端套件、真实浏览器 / 服务认证、外部 Search / CDN 投递或目标环境切换。这里验证的是后端计划和现有入口，不代表完整预览产品或审批产品流程完成。旧 B0 脚本及主合同附录继续保留为历史证据。
