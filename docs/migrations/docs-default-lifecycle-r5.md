# R5：Docs D 按需保留与生命周期

日期：2026-11-12。范围：`doc-redesign` 工作区；未提交，目标环境未切换。

依据：[Article 基座](../feature/article/working-copy-snapshot-target.md)、[Docs 合同](./docs-publish-queue-refactor.md)。只完成 R5；R6–R8、完整预览、审批 UI / 通知和旧 Branch 清理不在本批。

## 实现

```text
Q 固定为 Snapshot -> Public / PublicBody 原子更新
                      |
                      +-> 比较入队基线、发布 Snapshot 与当前 D 的完整状态
                            |
                            +-- 无未发布编辑 -> 消费 Q / 成员 -> 清 Lifecycle 引用 -> 删除 D
                            +-- 有未发布编辑 -> 合入可合入内容，保留同一个 D
                            +-- 有冲突       -> 保留 D，登记冲突

公开 Doc 无 D -> docsEditor 只读 Public Snapshot（不创建 D）
             -> 点击编辑 -> beginDocsEdit -> 锁内复核当前 Public -> 新 ID 的 D
旧 ID 保存失败 -> 保留客户端未保存内容；不自动初始化或套用旧 patch
```

- `AlignDefault` 比较标题、正文、slug、摘要、typed fields、标签、Cover 等完整内容；正文采用已有语义比较与 schema_version。干净结果不先保存一个马上要删除的 D。Queue 消费在解除 Q / 成员引用之后删除干净 D；所有步骤与 Public / PublicBody、Release、Lifecycle、冲突和队列消费处于同一事务。
- `DefaultCopy` 负责可空引用的读取、创建和删除；从未发布的 Doc 仍必须有 D。非空引用必须指向同 Article 的默认副本；无 D 要有当前 Public，且不能有 Q 成员或冲突。删除 D 同步删除独占 ArticleBody、标签、资产引用与 CoverEdit；Snapshot 及其正文、公开投影不随 D 删除。
- `BeginEdit` 使用既有 Gate / CommandPipeline / Receipt，按站点、Article / Lifecycle / WorkingCopy / Public 锁复核当前身份、权限和 Trash。并发初始化返回同一 D；新会话使用新 ID。Receipt 保存原命令的 ID / revision，重放不重新创建已删除 D，也不删除后来创建的 D。
- 冲突解决必须提供 D ID、revision 与 Public Snapshot；选择后无未发布编辑则清冲突并删除 D，返回空 `workingCopyRevision`。仍有编辑则保留。客户端同步处理空 revision，不能把旧 ID 与新 D 的同值 revision 混同。
- Trash 软删除和读取不创建 D。删除发布在移除最后 Public 前，若无 D，先从该 Snapshot 创建恢复 D；恢复不自动入队。永久清理接受 D 可空，仍保留历史 Snapshot。
- 编辑器 loader 从 `docsEditor` 读取 D 或当前公开 Snapshot；公开无 D 时只读，显式开始编辑后才可保存。保存使用当前会话 ID；发布、初始化及失败后的异步响应不能覆盖本地 dirty 内容或把旧会话自动绑定到新 D。

## 迁移与接口

新增 `20261112160000_allow_optional_doc_default_copy`：移除 `default_working_copy_id` 的 NOT NULL，增加 `default_working_copy_id IS NOT NULL OR first_published_at IS NOT NULL` CHECK。原归属 FK 保留；当前 Public、Q 和冲突约束在事务内复核。没有历史转换、回填或兼容逻辑，回滚迁移不重建已删除 D。

新增 `docsEditor` 查询与 `beginDocsEdit` mutation；冲突查询返回 `workingCopyId`，解决 mutation 要求该字段。SDL、静态 GraphQL 操作和 generated types 同批更新。普通 WorkingCopy 删除仍拒绝直接删除 Docs D；内容发布服务的认证协议不因本批改变。

## 验证

| 检查                   | 实际结果                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 空隔离库完整迁移       | `groupher_docs_b0_r05` 通过；目标环境未执行                                                                                                                                                                            |
| R5 生命周期演练        | `scripts/docs_default_lifecycle_r5_verify.exs`：干净删除、独占正文清理、只读无 D、显式初始化、并发重复初始化、未发布编辑保留、冲突和 Receipt 重放通过                                                                  |
| Trash / 回滚 / 并发    | 删除发布前补恢复 D、发布前后恢复、永久清理保留 Snapshot、整事务回滚通过；两条数据库连接以 `pg_blocking_pids` 确认保存 / 发布互相等待，覆盖两种提交顺序                                                                 |
| 既有真实数据库脚本回归 | Release、Queue consume、Queue members、Workspace 通过；Workspace 包含真实 GraphQL 冲突解决和审批 Snapshot 发布。旧 D 长期保留断言改为新生命周期，Queue members 空正文 fixture 改为可发布正文                           |
| 后端聚焦套件           | **67 tests / 0 failures**：计划 / 审批状态 / 目录操作、ArticleBody / PublicBody、WorkingCopy GraphQL、删除 Pipeline、内容比较与丢弃规则                                                                                |
| 前端聚焦测试           | **29 tests / 6 files 通过**：loader、显式初始化、保存、会话身份、公开回退、发布、空 revision 冲突解决和旧冲突重读及公开 Snapshot 已变更后的迟到初始化响应                                                              |
| 浏览器检查             | Chrome `/home/xx` 隔离 harness 加载实际 editor state / loader / begin-edit / save hooks、模拟后端接口：无 D 只读不创建；点击后新 D；保存发布后回到公开内容；再次编辑新 ID；旧 D 消失后保存失败保留本地编辑，未自动重建 |
| 类型与 GraphQL         | Core type-check、GraphQL repository / static / urql / generated 检查通过（59 source files）                                                                                                                            |
| Core lint              | 通过（exit 0），仍有既有 React 等警告                                                                                                                                                                                  |
| 后端编译 / 格式 / diff | `mix compile --warnings-as-errors`、变更文件格式、`git diff --check` 通过                                                                                                                                              |
| `mix lint.context`     | scanner 14 tests 通过，0 findings                                                                                                                                                                                      |
| `mix lint.style`       | 仍被既有 56 项样式问题阻断；本批新增 alias 问题已修复，后续 inline-do 子检查未运行                                                                                                                                     |
| `pnpm run docs:check`  | scanner 11 tests 通过；既有 7 项覆盖缺口阻断：OneOfValidation 的 ASCII 流程及 Gate load / queries 的公共函数文档，后续聚合检查未运行                                                                                   |

复跑生命周期脚本（仅限已完整迁移的可丢弃库，工作目录 `backend/api`）：

```sh
TEST_DB_NAME=groupher_docs_b0_r05 \
DOCS_B0_DISPOSABLE_DATABASE=groupher_docs_b0_r05 \
MIX_ENV=test mix run scripts/docs_default_lifecycle_r5_verify.exs
```

浏览器 harness 位于本机临时目录，不是生产 UI 的端到端测试。真实服务认证、完整产品浏览器验收、目标环境切换、全量后端套件及 R6–R8 未运行 / 未完成；不能据此放行正式切换。历史继续随社区永久保留，不新增 Snapshot 定时清理。
