# Gate 读取与操作准入收口

> 状态：Gate Scope 是唯一读取准入实现。2026-10-23 普通 Article 不再在 ArticleBinding/ArticlePublic 保存可见性投影，Gate 直接依据 Lifecycle 与 active ReviewRestriction 过滤；Doc 保留 branch-scoped DocPublic 投影。下列历史验收快照中的普通 Article visible-field 检查已由 Lifecycle/ReviewRestriction 场景替代。不得添加 FrontDesk/list 的可见性绕行判断。细项见 [基础模块执行记录](./backend-foundation-cleanup-and-codedoc.md#6-2026-10-22-实施与验证记录)。本文沿用现有 Gate 合同，不代表另建框架。

当前合同仍是 [Gate](../feature/gate/README.md)、其 typed context 细则及各资源 Lifecycle 合同。
本文定义调用覆盖、重复规则清理和可执行验收；不设计 Sentinel 或新 Moderation 模型。

## 1. 唯一准入边界

```text
Lifecycle 权威状态/限制 + actor + membership/Passport 等已加载事实
                              |
                              v
                            Gate
                    +---------+---------+
                    |                   |
                read scope         write admission
                    |                   |
          +---------+--------+      同一事务内
          |         |        |      canonical resource
        详情      list     batch        |
                   count                v
                                   业务写入
```

- Lifecycle 拥有资源状态与限制；Gate 消费事实并组合 actor/action 准入，不迁移资源状态。
- FrontDesk、Query、Projection、Resolver 不另写“合法才可读”“作者可例外”的决策。
- 读取 scope 可组合，不由 Gate 执行最终 Repo 查询；filter/sort/page 归 Query。
- 写入必须在 Command 的事务/锁合同内完成 Gate admission，并使用返回的 canonical resource。
- Passport/GraphQL middleware 的预检查不能替代领域入口准入；Job、内部服务入口也要覆盖。
- canonical loader 可为授权加载必要事实，但不是产品读取入口；`internal` 不是通用绕过权限的开关。
- operations/audit 查询使用明确能力和模式，不以“后台调用”为隐式放行条件。

## 2. 具体例子

```text
文章 A 不允许普通访客读取
       |
       +-> 详情：不返回内容
       +-> 列表：不出现
       +-> batch：不泄漏内容，按该接口合同处理不可见项
       +-> count：不计入普通访客的可见集合

作者/管理员是否能看 A？
  -> 由对应 actor + mode 的 Gate 合同决定
  -> 不能由详情入口临时添加 owner 特例
```

上述一致性比较必须固定 actor、mode、父级/branch 与业务 filter；管理查询与公开查询不必返回相同集合。
待审只作为未来状态的测试场景，不在本文决定审核数据模型和发布规则。

## 3. 本轮已发现的缺口与核查范围

| 范围             | 待收口问题                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Article          | Gate scope、FrontDesk stable detail、Pagination public path query 存在不同的审核/可见性判断 |
| Comment          | FrontDesk 单资源路径需要补齐 Comment 自身准入，不能仅因父 Article 可读就返回 Comment        |
| Batch/count      | 与详情、列表消费同一可见集合，保留批量实现                                                  |
| 写入入口         | 不依赖 transport Passport 已检查；按 action 核对 owner、moderator、operations 等权限        |
| 已加载资源       | 核对 Article Insights 等 struct 入口的上下文与授权调用合同，不能只验证 ID 入口              |
| 非 Commands 入口 | Job、maintenance、workflow、内部服务逐项分类；不能把已有 Command 迁移完成视为它们也完成     |

旧审核字段仍参与运行时判断，但其最终删除另见 [旧内容 Audit 退役](./legacy-content-audit-removal.md)。
统一 Gate 时不得擅自选择“检测失败默认公开”或“默认隐藏”；审核替代合同尚未确定。

## 4. 防回归与验收

1. 建立入口清单：资源、action、actor/mode、入口、scope/admission、canonical loader、事务 owner。
2. 对已发现的分歧补场景测试，再迁移到 Gate 权威实现，删除重复条件。
3. 以“匿名/作者/无关用户/管理员/系统身份 × 资源状态 × 父级状态 × branch”建立适用矩阵。
4. 同时检查 list/detail/batch/count；写入检查未授权拒绝、状态变化后的锁内重验及 canonical resource 复用。
5. lint 限制 Gate internal 调用、领域外重复准入及加载绕行；测试证明语义，不能把正则扫描当授权正确性证明。

不要为所有组合机械生成无意义测试；选取能暴露准入差异、并发变化和跨父级/分支问题的场景。
验收需要真实查询/事务测试，纯 AST 或无数据库探针不能代替这些证据。

## 5. 可执行批次与具体接口迁移

源码位置相对 `backend/api/lib/groupher_server/`；测试位置相对 `backend/api/test/`。
本轮不重定义旧 Audit 字段，不引入待审状态；相应冲突不能通过选择默认放行来掩盖。

### G1：读取权威只保留一份

| 模块                                                                                         | 修改方式                                                                                                                                                                                       | 验收             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `cms/gate/scope/article.ex`、`cms/gate/scope/query.ex` 与现有 Article/Doc Scope Context      | 保留 typed Context 和 SQL scope owner；统一公开 binding/public projection/lifecycle 条件，禁止 Query 自行复制。public 必须有可用公开版本及有效路径；management 的 owner 例外只能在 Gate 内表达 | 覆盖下文统一矩阵 |
| `cms/front_desk/article.ex` `read_stable/stable_article_visible/stable_public_projection`    | 先在明确 Community、thread/branch 的 Gate scope 中按 identity 选择 Article，再组装 projection；删自有 visible/owner/moderation 分支。projection 缺失是领域错误，不二次放宽 scope               | 见下文统一矩阵   |
| `cms/articles/pagination.ex` `public_path_query`、public list 基础查询、`public_binding_ids` | 从 Gate scoped Article/Binding identity 派生 Lite projection，复用同一授权子查询；保留业务 join/filter/order，不能因 join alias 不同再复制权限 SQL                                             | 见下文统一矩阵   |
| `cms/articles/query.ex` `count_published` 与 F2 Article locator query                        | 使用相同授权 binding 集合；对多 tag/join 用 distinct identity，避免计数膨胀                                                                                                                    | 见下文统一矩阵   |
| `cms/front_desk/comment.ex` public `read/4`                                                  | 父 Article 解析后，再以 `Scope.Comment.for_thread` 构造 Comment scope，按 article_id/thread/inner_id 查询；Doc 明确 branch_policy: main；不再直接 ORM.find_by identity map                     | 见下文统一矩阵   |
| `cms/gate/scope/comment.ex`                                                                  | 保持现有 deleted tombstone 合同，destroy 不返回；不能误把“接入 Gate”变成“删除所有 deleted 行”。验证返回内容脱敏/墓碑由现有投影负责                                                             | 见下文统一矩阵   |

表内统一验收：相同 actor/mode/filter/branch 下，detail 可读集合 = list/batch 可读集合，count 对应同一计数单位；
覆盖 active/ended ReviewRestriction、无 ArticlePublic、父社区不可读、Doc 非 main、Comment destroy。旧 `binding.visible` / `ArticlePublic.visible` 组合仅留作历史基线，不再是现行数据模型。Doc 仍保留分支级 `DocPublic.visible`。
`audit_failed` 场景只记录现有分歧与冻结依赖；其新产品语义待审核机制解冻，不以本计划批准新行为。

当前发布事实不变量也必须纳入矩阵：普通 Article 在 `Publish.Target` 提交 Lifecycle 与 ArticlePublic 版本后，Gate 按 Lifecycle 和当前 ReviewRestriction 决定 binding 读取资格；ArticleBinding 仅表示 Article–Community 关系。Doc main branch 在 `Publish.Doc` 发布后仍由 DocPublic 与 DocReviewRestriction 共同决定。测试确认添加和结束 active restriction 后 detail/list/count/locator/search/side effects 同步更新；author 例外由 Gate 明确定义。不得在 FrontDesk 或 list 查询里补写可见性兜底。

实现可用 Gate scoped identity 子查询连接现有 Lite join，避免为了共享 alias 大规模重写 projector；
禁止逐行 Gate.check 和额外 N+1。测试查看 SQL/query count，不只对比最终列表长度。

G1 最小验证（backend/api，先加入本批矩阵场景）：

```sh
mix test test/groupher_server/cms/gate/scope_test.exs test/groupher_server/cms/gate/scope/article_test.exs test/groupher_server/cms/front_desk_test.exs test/groupher_server/cms/articles/pagination_test.exs
```

### G2：把 actor/action 权限真正放进领域准入

证据：`cms/gate/access/policy/article.ex` 普通 action 分支使用 `_actor`，模块注释宣称 Passport 在 API 边界负责权限；
`cms/gate/access/policy/comment.ex` 的 edit/delete/pin 与互动共用无 owner 检查的放行分支。不能只修 GraphQL middleware。

1. 修改 `cms/gate/access/load.ex` 及其现有子模块、`cms/gate/context/access/article.ex`、`cms/gate/context/access/doc.ex`、`cms/gate/context/access/comment.ex`：
   加载并传递 owner、community、branch、规范化 Passport 所需事实。Policy 不自己查 Repo。
2. 修改 Article/Comment Access Policy：先 action 权限、再资源/祖先状态；复用 `CMS.Passport.Authorization.allowed?/3`；
   资源 action 若 registry 标为 `grant_by_thread`，必须把已加载 Article.thread 显式传给 `/4`，扩展为
   `"#{thread}.#{suffix}"` 后按 Passport registry 检查。transport middleware 与领域 Gate 共用同一 expansion 语义，
   不允许 Gate 对 mirror/move/unmirror 这类 thread-scoped action 静默拒绝或另造权限表。
   直接调用领域 Command/Policy 的测试需证明有 grant 放行、无 grant/错误 thread 拒绝。
3. 使用 `cms/passport/gate_action_contract_test.exs` 对照 GraphQL 的当前权限映射：编辑/删除归 owner 或明确授权角色；
   pin/category/status 等管理动作要求对应权限；互动允许符合现有产品条件的登录用户，不误要求文章所有权；solution 保留 QA 与文章作者约束。
4. 系统身份仅保留当前声明 action（例如 maintenance delete），未知 action、缺失 typed context 拒绝。
5. 修正 Article Policy“API 负责权限”的过时注释，以及 Comment Policy 的 `:ok` spec（实际成功是 `{:ok, :pass}`）。

测试必须直接调用领域 Command/Policy，绕开 GraphQL 预检查：无关用户 edit/delete/pin 拒绝；owner、被授权 moderator 按 action 放行；
权限正确但父社区只读/资源 deleted 仍拒绝；同一 Command 的 GraphQL 与服务调用结果一致。
对每个 action 的角色映射以现有 Passport 合同为准，不在实现时自由扩大管理员或 owner 权限。

G2 最小验证（backend/api，先加入本批矩阵场景）：

```sh
mix test test/groupher_server/cms/gate/access_test.exs test/groupher_server/cms/gate/check_in_transaction_test.exs test/groupher_server/cms/passport/gate_action_contract_test.exs
```

### G3：修复已加载 Article Insights 授权

确定调用链：`cms/insights/query.ex` 的 UUID Article `authorize_with_scope` 调用 `Gate.access_check/3`；
后者到 `Access.Check.article/3`，该函数当前对 stable Article 直接返回 resource_not_found。
这不是“管理员没有权限”，而是入口选错：已加载合法 Article 也走到拒绝分支。

目标：让 `authorize` 与 `resolve` 都使用现有 `insights_scope/scope_query` 的 typed Insights scope；
对已加载 Article 按 ID 和显式 community/branch 约束执行 exists。不要借 authorize 建立新 public-ref lookup；
作用域缺少所需 branch/community 时返回准确错误。删除 `authorize_legacy` 及按 UUID/旧数字 ID 分流，
保留 owner、community owner、授权 passport/global role 规则的一致性，不把管理权限转换成匿名 public 查询。

测试：`analysis/article_insights_test.exs` 增加同资源 resolve/authorize 对照，覆盖 Post/Doc、作者/社区 owner/
受授权用户/无关用户、错误 branch、无 lifecycle。成功返回 `{:ok, :pass}`，拒绝返回正式错误，不返回假 not-found 掩盖接口错误。

G3 最小验证（backend/api，先加入本批矩阵场景）：

```sh
mix test test/groupher_server/analysis/article_insights_test.exs
```

### G4：调用覆盖与执行门

同步检查 `cms/gate/access/query.ex` 的 stage/transaction guard；不得为了让新调用通过而移除 guard。
非 Command 路径只按 [既定复核](./backend-non-command-write-entry-audit.md) 执行，不让 Outbox delivery 再走用户权限。

```sh
# backend/api
mix test test/groupher_server/cms/gate/scope_test.exs test/groupher_server/cms/gate/scope/article_test.exs
mix test test/groupher_server/cms/gate/access_test.exs test/groupher_server/cms/gate/check_in_transaction_test.exs test/groupher_server/cms/gate/access/with_check_test.exs
mix test test/groupher_server/cms/passport/gate_action_contract_test.exs test/groupher_server/analysis/article_insights_test.exs
mix cms.pipeline.check --check
mix cms.command.pipeline --check
mix compile --warnings-as-errors
```

G1 与 F2 共同交付，G2 可独立推进，G3 与 ErrorCat 的对应错误迁移同批。完成证据必须包含数据库查询/事务测试；
当前文档阶段只有源码证据，不能把上述命令当作本轮已通过的结果。
