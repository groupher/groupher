# Backend 基础模块清理与源码文档审计

> 状态：F/G、E1–E4、N1–N3 与 D1 有定点实现；整体验收未完成。最近一次串行全量为 2380/2444 passed、64 failures，发生在普通 Article/Docs 发布后 Binding 可见性同步变更之前；该修复后的 G1 + locator 定向测试 6/6 通过，但全量尚未复跑。D2 源码文档候选仍未逐项处置。Audit/Sentinel 暂停，不属于本轮范围。
> 清单仍是 2026-10-21 的基线快照，不代表 166 个文件全部完成源码注释整改；本轮新增、修改的 public API 已补齐对应合同，D2 附录其余候选需按下表继续分批处理。

## 1. 审计口径与证据强度

本次检查 Command/Pipeline、Gate、Passport、FrontDesk、ErrorCat、Interaction 及 CMS Query/Pagination/
Lifecycle/Policy/Workflow/Transaction。Elixir CodeGraph 查询返回了无关 TS 符号，不能用于证明本次 Elixir 调用关系；
改用当前源码、静态引用与 Code.string_to_quoted! AST 清单。动态调用仍需按具体注册点检查，不把 grep 零引用直接当死代码证明。

[逐模块源码文档清单](./backend-foundation-codedoc-inventory.md)列出 166 个匹配文件，131 个文件含本次识别的公共声明，
639 个按模块 name/arity 合并的声明：478 个有 doc、107 个未见直接 doc/impl、42 个 doc false、12 个 impl；
有 doc 的声明中 341 个未见函数级 `## Examples`。这些是静态候选计数，不是“107 个业务 API 全部违规”的结论：
行为回调、宏生成和模块级示例需人工分类，生成在 quote 内的函数未展开。清单不等于全后端所有函数的完整语义认证。

额外人工检查了相交的 Commands、Jobs、transport middleware、Helper 和 schema；其明确问题在下表列出。
上述 AST 基线审计未运行数据库/外部服务行为验证；后续实施和 Review 的实际测试证据分别见第 6 节及末尾补充。

## 2. 模块保留、删除与拆分决定

| 项目                                                                                        | 当前证据                                                                                                           | 执行动作                                                                                                                     | 完成标准                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `cms/communities/categories.ex`、`categories/workflow.ex`                                   | Workflow 明确标为 legacy compatibility；生产 Communities facade 已直接 alias 五个 Commands                         | 已删除两模块；测试改走 Communities facade/Command                                                                            | 收尾核对 lib/config/priv/test 无引用，并跑 category create/update/delete/set/unset 测试  |
| `cms/interactions/transaction.ex`                                                           | 静态扫描 lib/test/config 未发现消费者；reactions 已进入 receipt/direct pipeline，模块无 behaviour、注册或 use 扩展 | 已删除；未搬入通用工具箱                                                                                                     | 收尾跑 compile、pipeline graph 与 interaction mutation/replay 测试，并确认无动态注册引用 |
| `cms/insights/query.ex` legacy numeric-id authorize                                         | UUID 路径调用错误 Gate 入口，legacy 分支独立 SQL                                                                   | 按 G3 统一 typed Insights scope，删除 authorize_legacy 与类型猜测分流                                                        | loaded/path 两入口权限对照通过                                                           |
| Articles/Communities/Comments Query 通用 lookup 与 branch helper                            | 多个 Commands/replay 调用，不能直接删                                                                              | 按 F1 成对迁移 caller 和 owner；binding 留具名 facts，Docs branch 归 Docs；Moderate 只迁移读取，不改变审核语义               | 所有旧 lookup caller 清零、replay 仍正常、无新增 N+1                                     |
| FrontDesk 批量 SQL                                                                          | 被 Projection/ViewTracker/Press 使用，不是死代码                                                                   | 按 F2 移至 Articles.Query.Locator，经 CMS.Articles.locators/1 暴露；删除无生产 caller 的 Root/FrontDesk 批量转发             | 批量语义与查询数量测试通过                                                               |
| `CMS` root facade、Gate.Access、Receipt Runner/Store、Policy、typed Context                 | 这些转发/分层具有 Context 隔离、事务/重放、纯决策等实际责任                                                        | 保留；纠正文档，不因“代码只有 delegate”一概删除。Gate.Access.Query 的命名虽不直观，已属现有 owner 合同，本轮不再重命名整棵树 | 文档写清委托原因；caller 不越过封装边界                                                  |
| `Communities.Transaction`、`CommunityApplications.Transaction`、`ContentImport.Transaction` | 有实际 Lifecycle/workflow 调用                                                                                     | 保留领域事务 adapter；说明已有事务分支与返回嵌套，不合并成一个隐藏 owner 的通用 transaction 层                               | rollback 与调用方返回形状测试保留                                                        |
| ArticleView/ArticleTransportResult                                                          | 注释含 compatibility，但属于仍被 transport 使用的结果形状                                                          | 不凭关键词删除；产品输出迁移另案，不属于已确认死代码                                                                         | 不把当前客户端合同误删                                                                   |

源码路径均相对 `backend/api/lib/groupher_server/`。上表“删除候选”与“确定冗余兼容层”刻意区分，避免给实现者错误授权。

## 3. 明确错误或失真的文档：逐模块修复

| 文件/符号                                                                                                                       | 已确认问题                                                                                       | 应写成什么，如何验证                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `cms/articles/pagination.ex` `page`                                                                                             | 示例调用 page/2，但实现至少 page/3；把 page/size 放 filter，而 validate_filter 明确拒绝          | 改成 thread、业务 filter、独立 Pagi 参数的真实调用；spec 对齐实际 arity/default 参数。以分页测试中的有效输入作示例，正常调用和非法 filter 对照 |
| `cms/communities/commands/update.ex`、`cms/dashboard/commands/{select_theme_preset,save_custom_theme_preset,update_section}.ex` | `execute(...)` 是占位示例，不能指导调用且可能连函数名都与 execute_pipeline 不符                  | 用真实 facade/Command 签名、必要 actor/resource/command_id 参数；解释哪些 fixture 已加载。禁止为过检查复制相同模板                             |
| `cms/gate/access/query.ex`                                                                                                      | 模块声称 Policy 返回裸 :ok，与实际 tagged tuple 不符；access_check 被泛称 compatibility          | 写清 check-only、join-existing-transaction、with-callback 三种入口、stage guard 与锁范围；指向具体 typed Policy 返回                           |
| `cms/gate/access/policy/article.ex`                                                                                             | 声称权限由 API Passport 独立负责，与目标 Gate 权威冲突                                           | 随 G2 改为 Gate 组合 Passport/action 与 Lifecycle；当前未修代码前不可只把注释写成已经安全                                                      |
| `cms/gate/access/policy/comment.ex`                                                                                             | @spec 返回 :ok，实际返回 {:ok, :pass}                                                            | 修 spec；示例包含拒绝和父状态限制，不只写 happy path                                                                                           |
| `cms/front_desk/article.ex`                                                                                                     | 模块图仍把 batch 和可见性实现放 FrontDesk；read/3 文档只描述 public，首个分支实际是 internal ID  | 随 F2/G1 写单体解析->Gate->projection；分别说明 public path、internal ID、mode/actor/view、缺失错误                                            |
| `cms/front_desk/comment.ex` read/3、read/4；root/CMS FrontDesk 多 arity                                                         | 部分 arity 没有直接 doc，actor-bearing overload 没有清楚模式合同                                 | 每个对外 arity 或有明确关联的函数族写 actor、mode、默认值、支持 locator、返回与示例；不能 doc false 隐藏调用合同                               |
| `cms/articles/query.ex`、`cms/communities/query.ex`                                                                             | 图中出现 Repo/domain event、Repo/Oban，实际集合查询不拥有这些写副作用                            | 改成 Query->Gate scope->filter/order/Pagi->Repo->projection；不能把 event/Oban 当模板尾部                                                      |
| `cms/insights/query.ex`、`cms/gate/access.ex`                                                                                   | `caller -> module -> result` 没有业务信息                                                        | 展示 Analysis 调用/typed scope/授权结果；Gate 图展示 loader、policy、lock、Decision，按真实实现写                                              |
| `cms/command/confirmation.ex`                                                                                                   | 多个公共 codec helper 无 doc；原子解析错误与业务错误边界未说明                                   | 说明 JSON key/type 严格校验、错误在 decode 出口归一化；用一个有效和一个缺字段 payload，不给每字段机械造例子                                    |
| `command_pipeline.ex` 与 `command_pipeline/{runner,stage_context,rejected}.ex`                                                  | 宏、stage API、内部 runtime 公共函数的文档覆盖不完整                                             | 用户 DSL 用完整可编译 pipeline 示例；内部支持 API 说明仅 runner 调用、stage/transaction 约束。宏生成函数与 callback 采用明确例外，不用空示例   |
| `error_cat/{domain,registry,validator,workflow}.ex`                                                                             | catalog 查找/校验/format/reserved 构造缺少部分函数文档和错误说明                                 | 覆盖 definition 不存在、valid? false、format raise 与 domain tagged result 区别；DSL 示例可编译且使用测试 namespace                            |
| `cms/communities/lifecycle.ex` can_write/2、can_manage/2、can_destroy/2；`cms/docs/lifecycle.ex` transition/2                   | 深层 overload 未纳入全面文档覆盖                                                                 | 说明已加载状态、是否要求锁、版本与错误；不能把 actor 权限写进 Lifecycle 示例                                                                   |
| `cms/communities/setup.ex`、`jobs/community_setup.ex`                                                                           | worker 图仍是 Client/reviewer->Setup->Repo，未说明重试与 exhaustion；retry spec 与可选参数不完整 | 随 N2 展示 Oban->facade->operation fence->幂等阶段->activate/mark_failed；外部 provision 与事务分开画                                          |
| `cms/outbox/workflow.ex`、`cms/outbox/workflow/{article,comment,community,press,asset,interaction}.ex`                          | perform 未明确返回与终态处理；图中 Article.Cleanup 与实际 delivery owner 不一致                  | 随 N3 写 event claim/lease->effect->complete/failed，busy snooze、exhausted 与 execute/3 内部 fenced terminal failure 分支                     |
| `cms/passport/authorization.ex` authorize/2、`passport/registry.ex` all_rules/2                                                 | 深层公共函数直接 doc 缺失                                                                        | 说明 action registry、scope 和错误归属；Passport 权限事实不等于完整资源准入                                                                    |

## 4. 深层文档覆盖如何执行

D1：先完成 F/G/E/N 中的行为与 owner 迁移，删除不再需要的接口。不要先给待删除 helper 写大量示例。

D2：按附录逐文件处理 missing/hidden/no-example 候选，顺序为 Gate/FrontDesk/ErrorCat -> Command/Pipeline -> Lifecycle/Passport -> Query/Interaction。
每项选择：补真实文档；改为 private；随既定迁移删除；明确 callback/宏内部例外。例外需写明继承哪个 behaviour 或由哪个宏生成，
不能只写“内部函数”。同名多 clause 合并，同名不同 arity 不自动继承错误的参数说明。

D3：扩展 `scripts/check-documentation.mjs` 的基础模块覆盖与测试：

- 公共函数按模块/name/arity 识别，正确处理无括号 def、default args、pipeline 宏和 quote-generated 定义；不把注释里的 def 当代码。
- 在本次基础模块范围对 doc false/无实例提出报告，先区分 callback/DSL/private；修完再严格阻止新增缺口。
- 拒绝 `execute(...)` 这类占位例子，补例子 arity 与 Pagi 参数错误的回归样例。
- ASCII 检查仍只验证语法；真实调用图由此表的人工审计及对应行为测试验收，不宣称箭头存在即语义正确。
- 公共入口示例以现有测试 fixture 或可编译纯函数例子为来源；数据库写入例子不在 docs gate 中直接执行线上操作。

D4：删除兼容层/死代码后跑 compile、pipeline graph 和对应行为测试；文档改动执行 docs:check、diff --check。
源码 @doc/@moduledoc 的修复留待代码实施批次，本次仅记录计划。

## 5. 可执行顺序和退出条件

```text
E1 错误定义 + F1 lookup caller 迁移
                |
                +-> G2 写授权 / G3 Insights
                |
                +-> G1 读 scope + F2 batch
                |                  |
                |                  v
                |             F3 查询能力
                v
          E2/E3 transport 收口
                |
          N1/N2/N3 定点修复（可独立或按错误依赖并行）
                |
          删除兼容层/确认死代码 -> D2 源码文档 -> F4/D3 门禁
```

Moderate 的资源读取随 F1 迁到 FrontDesk/Docs Store，旧 Query helper 与调用方一起删除；冻结范围是审核语义，不为旧 lookup 保留豁免。G2、G3、E2/E3、N1–N3 按各自依赖执行。

退出标准：每个已确认问题有具体修改及行为测试；附录候选有处理结果；不存在占位例子或错误调用签名；
文档图包含真实 authority、transaction 和 effects 边界；未验证的动态死代码候选不得冒充已清理。
不需要再讨论这些整改原则；若实现发现产品权限/审核语义冲突，只停该冲突项，其余批次继续。

## 6. 2026-10-22 实施与验证记录

此前实施记录列出的范围（历史子集验证，不代表当前整体通过）：F1–F4（单资源与批量加载边界、Query 合同、FrontDesk 调用迁移及 lint）、G1–G4（Gate 读取/写入准入与 surface 一致性）、E1–E4（ErrorCat producer、transport adapter、FrontDesk 错误传播及真实 middleware-chain 集成测试）、N1–N3（archive lock recheck、Setup operation fence、六类 Outbox 终态 fencing）、D1（删除冗余 Categories facade/workflow 与无调用方的 Interactions.Transaction）。
Gate 最终复核还发现 thread-scoped `grant_by_thread` action 未从 Article.thread 展开；已让 Gate 调用 Passport `/4` 并补 Registry 与 Command 授权测试。Outbox `mark_failed` 零引用结论只针对 CMS Outbox；PublicCache 的独立 `mark_failed` 是另一项 lease API，不在删除范围。

此前记录的验证结果（本次 Review 未复跑的项目不视为当前通过证据）：

- `mix compile --warnings-as-errors`
- 相关 Accounts/Article/Comment/Community/Gate/Outbox/ErrorCat/Web middleware/PermissionRegistry ExUnit：198 tests, 0 failures
- `mix cms.command.pipeline --check`：roots=334、edges=18323、pipelines=139，unreached/unresolved/unpipelined 均为 0
- `mix lint.style`：Elixir module style passed；wrapped inline `do:` 为 0
- `pnpm docs:check`：Documentation coverage、CMS Query/context、Policy、backend context、facade、resolver、business return shape、command identity gates 全部通过
- `git diff --check`

D2 尚未逐条完成 AST 清单中的全部源码文档候选。清单保留为后续逐文件任务：按第 4 节顺序补真实合同/示例、改 private、删除或注明宏/callback 继承；不要把静态候选数量当作已确认缺陷数。Audit/Sentinel 仍未实施或设计。

2026-10-22 D2 复核补充：为 `CMS.Gate` 的全部公开 arity 补齐事务/锁/显式 Community 与 Docs branch 合同和调用例；为 Articles、Comments、Communities collection Query 补充可读的列表示例与真实流程图，其中 Comments participant offset count 的 best-effort reconciliation Job 已明确列为 Query 的副作用。`CMS.Interactions` facade 的 command-result 与 public/private projection 函数补上逐函数示例；Community Applications Query 的读取、关系预加载、Command target/replay lookup 也补上返回形状和用途，原隐藏的两个 Query 函数现在明确标注文档说明其仅供 Command 内部使用。上述源码改动通过编译与相关测试，但不代表附录其余 Query/Interaction 内部函数的候选已全部处理；清单仍是 2026-10-21 的 AST 基线，必须在 D2 收尾重新生成或标注逐项当前处置结果。

E4 的 middleware-chain 合同验收位于 `test/groupher_server_web/middleware/errorcat_chain_test.exs`：按生产顺序直接运行真实 middleware 模块，覆盖 FrontDesk/Passport、GQLResultFmt、ChangesetErrors、GeneralError、单错误、多错误、changeset、Decision、Pagi mismatch 和结构化 FrontDesk 失败；它不启动完整 GraphQL server。相邻的 `test/groupher_server_web/error_response_test.exs` 覆盖错误 payload 投影边界。

## 2026-10-22 Review 补充

复核曾实际复现 Passport 错误身份不一致（4616/4353）和 Web 直接访问内部 Gate ErrorCat 的严格边界失败，另发现 Asset/Interaction 的 producer 裸错误。现已修复这两个 delivery owner 的已确认错误并统一 Passport 出口。E1 其余 Outbox producer 和 D2 清单仍未结案；Audit/Sentinel 继续暂缓。

本批实际验证：

- 52 项 ExUnit 测试通过，覆盖 ErrorResponse、middleware chain、ChangesetErrors、Accounts FrontDesk、Comment 加载/replay、Outbox、ErrorCat registry 与 Assets endpoints。
- `mix compile --warnings-as-errors` 通过。
- `pnpm docs:check` 全部通过，backend-context-v2 为 0 findings。
- `mix lint.style` 通过，wrapped inline `do:` 为 0；修正了 middleware 测试的 ErrorCat alias 写法和 Gate loader 两处跨行 inline `do:`，后者仅做 block 格式调整。
- `git diff --check` 通过。

上述为本批定点验证；没有重跑全量后端测试，也不代表 E1 其他迁移表条目或 D2 候选全部完成。

## 2026-10-22 本轮实现补充

- N1：`Articles.Lifecycle.archive_before/2` 在 Article 行锁后重读 `active_at` 与 Lifecycle 状态，返回单层 `{:ok, count}`；`blog_archive_test.exs` 覆盖过期阈值跳过、锁竞争期间变活跃及重复运行。
- N2：复核现有 `Community.Setup` operation fence 与 retry 后旧 worker/exhaustion 测试；`community_applications_test.exs` 已覆盖当前 operation、旧 operation、重复 setup 和重试状态。
- N3：`Outbox.execute/3` 增加 `:classify`，根据结构化 ErrorCat retryable metadata 在当前 lease 下选择 retrying/failed；六个 worker 已移除 worker-side `mark_failed` 兜底。`outbox_test.exs` 覆盖 stale lease、Asset terminal failure、Interaction retry 和六类 worker ack。
- E1：将 Gate stage/transaction、Article binding、Article/Comment/Community/Press Outbox producer、Insights 输入错误以及本批 Articles Commands 的裸错误改为 owner catalog；结构化不可重试 Outbox 错误现在立即终止，可重试 ErrorCat 与非结构化瞬时错误保留 retry。`ErrorCat.Error.code` 以字符串写入 Outbox last_error_code。
- 定点验证：`blog_archive_test.exs` 5 tests、E1 受影响 suites 55 tests、Outbox/Gate/Pipeline 30 tests 均通过；整合变更后的全量 suite、`mix compile --warnings-as-errors`、`mix lint.style` 与 `pnpm docs:check` 尚待最终复跑。
- D2 仍未完成：2026-10-21 AST 快照覆盖的深层 Query/Interaction/Lifecycle/Passport/Command/Pipeline 源码文档候选未逐项重新生成及处置。不能以 checker 通过宣称源码文档审计收尾。Audit/Sentinel 仍按用户决定暂停。

历史验收记录：曾有一次 `mix test` 2485 passed、1 excluded、0 failures；该结果已被 2026-10-22 当前工作树的串行重跑推翻，不得作为当前验收证据。`mix compile --warnings-as-errors`、`mix lint.style` 与 `mix cms.command.pipeline --check` 是历史通过记录，须在当前树重跑。最近一次 `pnpm docs:check` 在 Documentation coverage 阶段失败 4 项：Alert Board README 使用非标准状态词，Audit inventory 有 3 个指向已删除前端文件的链接；因此该次命令未运行后续 boundary checks。此前另一次检查曾到达 strict backend-context-v2 并报告 `alert_board/`、`alert_board.ex`、`review_bot/` 未注册 root；该结果仍需在 coverage 修复后复核。Audit/Sentinel 按用户决定暂缓，本轮不改其内容。`git diff --check` 在本次文档修订后单独验证。D2 源码文档候选仍未逐项处置。

### 2026-10-22 最终复核阻塞补充

- 串行 `mix test --max-cases 1`：491.3 秒，2380/2444 passed、64 failures、1 excluded。之后当前源码加入/呈现了普通 Article 与 Docs main branch 发布时的 Binding 可见性同步；定向 `mix test test/groupher_server/cms/gate/g1_surface_consistency_test.exs test/groupher_server/cms/articles/query/locator_test.exs --max-cases 1` 6/6 passed。全量结果早于这项变更，必须重跑后才能验收。
- 根因定位：普通发布先创建 Draft 和 `ArticleBinding.visible = false`；原 `Articles.Publish.Target` 选择 ArticlePublic 并将 Lifecycle 转为 published，却未同步该 Binding。FrontDesk 的 Gate scope 因 Binding 不可见而拒绝 canonical projection，导致 Article create、G1/locator fixtures 和大量 factory/GraphQL setup 失败。当前实现把同步放在发布事务中；Gate 仍是唯一准入边界。Docs main branch 同步时按 DocLifecycle 与 active DocReviewRestriction 计算 Binding 可见性。
- 上述记录是 2026-10-22 的修复历史，不再代表当前模型：2026-10-23 移除 ArticleBinding.visible 与 ArticlePublic.visible。普通 Article 的 Gate 直接根据 Lifecycle/ReviewRestriction 事实过滤；Doc main branch 不再写 ArticleBinding 可见标记，DocPublic 继续承载 branch 发布投影。
- locator 的 101 项专用 reason、direct binding fixture、E1 六类 Outbox producer catalog 与 Passport 4353/`TOKEN_INVALID` 断言已复核源码；六个 Outbox worker 未命中裸 `{:error, :atom}`。Binding 可见性同步变更后的 G1 + locator 定向测试为 6/6 通过；测试与文档的旧成功记录不能替代全量验证。
- 本轮最终只保留文档修订；工作树中的业务实现按当前状态记录，不在本轮新增代码。下一步是重跑串行全量、修复残余失败并重跑 docs gate；Audit/Sentinel 继续暂停。
- 当前 `pnpm docs:check` 在 Documentation coverage 阶段失败 4 项：Alert Board README 状态词不符合规则，Audit inventory 有 3 个失效前端链接；因此本次命令未运行后续 boundary checks。不可将 docs gate 标为通过。

## 2026-10-22 Outbox producer follow-up

`Article`、`Comment`、`Community`、`Press`、`Asset`、`Interaction` 六类 worker 的终态测试现逐个校验其 owner catalog code（6024、4418、5538、4544、5604、4914），避免仅以 `status == :failed` 作为结构化错误迁移的验收。`mix test test/groupher_server/cms/outbox_test.exs --max-cases 1`：18 passed, 0 failures；worker 表使用第 1 次 attempt（上限 5），断言五个不可重试 ErrorCat 立即 fenced terminal；Interaction 的可重试 ErrorCat 先 retrying、耗尽后 fenced terminal；六者都核对预期 catalog code。当前 `pnpm docs:check` 已通过；全量 `mix lint.style` 仍因本工作树其他 Alert Board/review 文件报告 78 项失败，不属于本次 Outbox producer 范围。
