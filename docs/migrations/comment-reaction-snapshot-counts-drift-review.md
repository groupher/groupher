# B0：六个 drift 文件的源码静态复核

> 日期：2026-11-05；仅文档与只读源码核查。未执行业务测试、编译、迁移、初始化或任何数据库操作；不进入共享评论计划 B1。

> 历史记录：本文件仅对应当时表内 SHA，之后工作区继续变化；不再作为“当前源码已复核”的证据。当前固定输入与全范围映射见 [20261105T074802Z 快照复核](comment-reaction-snapshot-counts-snapshot-review.md)。

## 1. 比对证据与限制

原 [baseline](comment-reaction-snapshot-counts-baseline.json) 只有文件 SHA256/Git 状态，没有文件正文。五个目标文件当前未跟踪，Parser 已跟踪但 HEAD 正文指纹与基线不同；已核对现有 worktree 副本，也没有找到基线 SHA 对应的正文。因此不能从哈希还原精确逐行 diff，不能把 HEAD→工作区 diff 冒充 B0→当前 diff。这里完成的是六个文件的**当前源码静态复核**、与已记录旧行为的对照以及 ledger/方案/用例影响判定；历史逐行 delta 未恢复。

下表同时保留原基线、上一轮 drift 观察和本轮读取指纹；三者不同表示文件继续变化，不覆盖旧证据。正文历史对照另参考 [MentionsMap inventory §9.27/9.33/9.34](../feature/article/mentions-graph-b0-inventory.md#934-doc-稳定身份新增基线与联合修正2026-11-05)，这些记录不是本轮重新执行的测试结果。

| 文件                                                                                                                          | 原 baseline SHA256                                                 | 上轮观察 SHA256                                                    | 本轮复核 SHA256                                                    | Ledger / case                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| [capture_current_version.ex](../../backend/api/lib/groupher_server/cms/artiment_mentions/commands/capture_current_version.ex) | `06bb177a8dd5c78bf7ea31f9fd8de71b3065b21ca203d5dd0ba3af6b25275828` | `0808cee06a78347ce5975b5beac84013ca0ed7bb7ce615ef82c80cfcd8a2019a` | `ab5b071b2c073d04ddd18fe6946fbc1656bfa88900c6ff583e95b37eb5facc61` | M01/M02；MSG-01、MENT-01、MENT-03                           |
| [initialize_current_sets.ex](../../backend/api/lib/groupher_server/cms/artiment_mentions/commands/initialize_current_sets.ex) | `a9a66791979e381a583c3fc8b4b1968258e849a27c811a446a41b512f3691cda` | `afb334da9a0d7b8e46598d4664b219725ddde9b0a8646dea2aa3b5907e05d80f` | `9a56a026339208ae57ed80ee7d127e10ba2aed6b10322a6fd5730a8044560dac` | M04；MENT-02、MENT-03                                       |
| [initialization_workflow.ex](../../backend/api/lib/groupher_server/cms/artiment_mentions/initialization_workflow.ex)          | `68bbf005de6a9ebcd056a4f0d7f23f0a65d3065fa6a14f5316da17a458754bec` | `99ebf4ebc1508aee2ba6029585a45c3bdf8c3cef9dee11f7746f357d2ecc79f0` | `682aa32d3c288a56d43293417a64bbb65fc3a8819758904a36e72afa34e45425` | M04；MENT-02、MENT-03                                       |
| [initialize_source_scan.ex](../../backend/api/lib/groupher_server/cms/artiment_mentions/initialize_source_scan.ex)            | `d59d4e0117911affbb1fe30136bbebc6db4fdd7fd6ed20be5db70f80f0ff07d0` | `376e7fbbc151346bb9b6efeabb8518a718db99c8e2e56b0714c4bbe9dae1bc47` | `ec12653231eca372b3fbddd2083fd4cd9ea178e9fba6f9ef51d42a517a88d8a4` | M04；MENT-02、GATE-01                                       |
| [parser.ex](../../backend/api/lib/groupher_server/cms/artiment_mentions/parser.ex)                                            | `93561f9315fea8211e8c375ac65b8443f97f05ac937f69074494c32b2ea82010` | `b261c084b2391f184a332828880a608aa9328d7caff327ae8bfd93850079b6a7` | `57e2fb2b62b90737b4212b44123b517a6844e3a34c662ed3464e1eb9b31652b3` | M02；MENT-01、MENT-02、GATE-01                              |
| [mention_version_facts_test.exs](../../backend/api/test/groupher_server/cms/mention_version_facts_test.exs)                   | `750d4b3356e8bdccae5542eb9f7424c0a169286c5ef6ed2d9189b9caf4055e37` | `0dab23f8f59093cb6a98b155c4b3998d5fa1e030f0b5986dfb3520157587e874` | `bc538e5ce49c8eff8157b99dde767ad1946a44c8ab133c79bf4e7d289ac229e7` | M01/M02/M04 验收；MSG-01、MENT-01、MENT-02、MENT-03、DEL-01 |

## 2. 逐文件结论

### CaptureCurrentVersion → M01/M02

当前 execute_in_transaction 先断言事务、校验 URL 长度，按 binding_mode 分流解析，再保存 immutable set 与投影：正常路径使用 Parser.parse、继承同来源可信旧目标并 enqueue；initialize_current 使用 parse_for_initialization、不走旧目标继承，直接同步 project_set，已同步同 set 时 unchanged。self_reference 按稳定 Article/Comment ID 排除 Doc 自引用，不再以正文 branch 区分自己。

影响：不能继续把它漏在“Parser/Store 流程”背后，也不能把初始化 inline 投影误改成正常写入行为。稳定 identity 已有局部实现；source_token 仍独立表达真实正文版本。保留 MENT-01 的跨 token 单 endpoint，新增 MENT-03 验证两种模式、权限入口、错误回滚与 invalid mode；MSG-01 覆盖真实评论捕获。当前函数不直接访问 Comment.branch，不等于上游 Comments.Effects/通用 Gate 已完成去 branch。

本轮检查末尾再次发生源码变化：本轮首读 SHA 为 `c3fa5129201ffaba1e6997c18bb41dc3c89995f3752bad577fc31e8bac7e34ea`，复读 SHA 为 `ab5b071b2c073d04ddd18fe6946fbc1656bfa88900c6ff583e95b37eb5facc61`。这一次两份正文均已读取，能明确对照：正常 dispatch 从三参数 Effects.enqueue_projection 改为附带 saved.new_user_ids 的四参数调用；Effects 将其写入 Outbox data.notify_user_ids，Store 当前返回新出现的 user ID 差集。其余分流保持。MSG-01/MENT-03 因此增加通知 recipient delta、重试不重复投递、初始化 inline 路径不触发正常通知的验收要求；不是把 User 建成图节点，不影响评论 count 的 owner。这里的精确观察仅限本轮两次读取，不能外推为原 baseline→当前的完整 diff。

### InitializeCurrentSets → M04

report/preflight/apply 使用 schema_version=2、parser_version=1；manifest 包含 identity、canonical_token、body_hash、mentioned_at、候选身份和 source_fingerprint。source_identity 与 Comment parent_identity 只保留稳定 type/article_id/comment_id，不再把 branch 固化到身份；source 的 Doc branch 仅用于扫描 cursor 与正文 token。apply_page 重读 report 集合并逐 source 交给 InitializationWorkflow，结果 applied/unchanged 分开。

影响：主计划“不新增摘要 marker”不禁止 Mentions 自有 manifest 版本；这里不是 comments 数据兼容机制。MENT-02 必须覆盖 report/preflight/apply 的稳定身份一致性、候选/选版变化导致 stale manifest 拒绝、辅助 parent 不伪造 public set、重复执行幂等。normal Capture 的拒绝隐藏新绑定规则不能被初始化入口绕过。分页 apply 是逐 source 事务，不能把整个 page 描述为一个事务全部回滚；失败重试必须验证已经完成的 source 不重复生效。

### InitializationWorkflow → M04

当前每 source 一个 Repo.transaction，先 InitializeSourceScan.lock_and_verify，再调用 CaptureCurrentVersion(binding_mode: :initialize_current)。Doc source identity 为稳定 article_id；Comment 为稳定 comment_id + source.parent；传入解析的 community_id 为 nil，不从来源社区猜目标 owner。

影响：身份目标已部分对齐，需保留 source token 锁内复核、失败 Repo.rollback 和重复投影 unchanged；不能把维护 capability 校验（上层 InitializeCurrentSets）误当该内部 helper 自带授权。MENT-03 从授权入口验证拒绝缺 capability；MENT-02 验证 token 在 report 后变化、单 source 回滚及 page 重试。内部 helper 不是新增公开 API。

### InitializeSourceScan → M04

旧审计记录描述通过 Comment.branch 选源；当前 query_page(:comments) 改为 Comment→stable Article，再经父 ArticlePublic 或 DocPublic + main DocBranch 纳入 S，返回稳定 parent，不读取 comment.branch_id。Doc 正文扫描及 lock_and_verify 仍携带真实 branch/version/publication token；Comment token 仍为 comment_id:body_version:body_hash。

影响：原 ledger“扫描带评论 branch”已过时，应改成“该局部依赖已移除、owner/main 关系待联合验证”。当前 Comment DocPublic join 以 article_id 开始，尚不能凭此证明单 owner invariant：B1–B3 必须在多个 owner/非法 binding 的负向 fixture 下验证拒绝或无重复，并以 canonical owner 限定 main；不要把扫描里的正文 branch 也删掉。MENT-02 覆盖同 Comment 不重不漏、无 public 父不纳入 source 集合、辅助 target parent 仍可解释，GATE-01 覆盖公开准入。仅 source_body token 锁定不替代父身份与 owner 校验。

### Parser → M02

当前初始化候选先去重/批量加载 Community/binding/Article/Comment/Ticket/main DocBranchVersion facts，再用 facts map 解析；歧义显式报错。initialize_comment_parent 已返回稳定 article_id/thread，Doc 附 owner community_id 上下文而非 branch 身份；普通解析继续匿名 public Scope，受控初始化才允许当前不可读但身份合法的目标。

保留边界：Doc 的 branch_id 仍可出现在正文解析 artiment 元数据中，不能据 literal grep 将合法正文选版字段全部删除。当前 Doc owner 发现仍来自 main DocBranchVersion + DocBranch.community_id，不是本计划拟定的唯一稳定 binding resolver；“无当前公开选版”与“完全没有 main version”不是同一情形。B1–B3 要按稳定 owner 合同核对无 main version/删分支后的辅助身份、歧义和 wrong-owner 情形，不能任取一个 branch 或伪造版本。

影响：不改变一篇 stable Doc 一个讨论区的方案；M02 需要从“全是旧 branch endpoint”收敛为分层描述。MENT-02 增加重复 stable Article/Comment 与 Community URL 的 SQL 数量预算、隐藏/缺发布/缺 main-version 的区分及稳定父级。性能断言只说明新代码有待执行用例，不表示本轮已证明无 N+1。

### MentionVersionFactsTest → M01/M02/M04 的证据

当前文件已有 stable_doc_identity 用例：无 branch schema、稳定 Doc parent、拒绝另一套 branch identity、跨 token 同一 endpoint、自引用排除，以及 main purge 保留另一 preview lifecycle 时不写稳定墓碑。初始化还覆盖 25 个重复 Article/Comment 候选的 telemetry SQL 预算（分别 <=12 / <=14）、来源普通 mirror 不改变 manifest fingerprint、辅助 parent、隐藏 Doc Comment、inline 投影无 Outbox、重放/回滚。

影响：不得再将整个文件称为“只有旧 branch 必填测试”；但“测试存在”不是“本轮测试通过”。现有 Doc Comment fixture 仍通过当前 branch-aware Comments.create_comment/Gate 创建；不能代替删除 Comment.branch 后的真实链路验收。末尾 main purge 测试只覆盖还有其他 branch 保留 Article，不覆盖执行计划要求的“删除最后 branch 仍不隐式删讨论”；DEL-01 继续开放。保留并扩展这些测试，不重复重建同一身份能力。

## 3. 关联证据与结论

- 为解释六文件当前语义，额外只读检查 Store/Effects 的通知 recipient 数据流、Endpoint 模型与新增 `20261105130000_stabilize_mention_doc_identity.exs`。模型已无 branch；新增迁移对非空事实集拒绝，然后删 branch/旧 Doc unique 并建立稳定 Article identity 的 CHECK/unique。旧 create migration 仍有 branch 是历史迁移步骤，不能单独据它判断最终 schema；本轮未查询实际数据库，不能宣称迁移已应用。
- 上述依赖文件不属于原六文件清单，本轮未扩大为全仓 drift 审计，也未更改原 JSON。MentionsMap §9.34 报告的本地测试结果仅作关联记录，不移植为共享评论 C14/B1–B3 的通过证据。
- **方案无需改向，ledger 与验收范围需要更新。** 稳定 endpoint 的部分能力已由其他在途工作实现；本轮只记录事实，不能重复宣称这里完成了共享评论 B1。单 owner DB guards、Comment 表去 branch、通用 CommentContext、count/snapshot/revision 和最后 branch 删除边界仍按主计划待实施。
- 六文件当前源码静态复核完成；历史逐行差异因没有匹配旧正文仍不可还原。新旧身份联合运行测试未执行，B0 总体验收仍不放行 B1。
