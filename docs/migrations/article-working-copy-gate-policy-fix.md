# Article WorkingCopy Gate 与已发布编辑策略收口

> 状态：**Article Gate 实施与指定本地验收完成**。本文冻结作者专属 `:edit_article`、必有 Dashboard 行、策略/生命周期错误顺序、Receipt 结果披露及 Asset workflow 恢复合同。F4 记录实际命令、结果和未覆盖项；全量后端套件未运行。Docs 发布队列不属于本文实施范围。
>
> 本文只覆盖 Post、Blog、Changelog 的 Article WorkingCopy / Snapshot 基座和 Gate。Docs 发布队列合同与实现均不在范围内；须待 Article 基座 B0–B4 验收后，另行重写 Docs 合同并评审。

相关合同：

- [Article WorkingCopy / Snapshot 通用基座](../feature/article/working-copy-snapshot-target.md)
- [Community Gate 当前合同](../feature/gate/README.md)
- [Gate V4 typed Access Context](../feature/gate/v4.md)
- [Article / Doc Lifecycle 与 Versioning 边界](../feature/gate/v3.md)
- [CMS Command、Gate、Lifecycle 与 Persist 写入边界](./cms-command-gate-lifecycle-persist-boundary.md)

## 1. 产品要求和不变量

1. Post、Blog、Changelog 的 WorkingCopy 内容**只能由 canonical Article 的作者修改**。Passport grant、Community 管理权限或从其他 binding 发起的请求都不能授予非作者内容编辑权。
2. 内容编辑只写入目标 `ArticleWorkingCopy`。已发布 `ArticleSnapshot` 不可变；`ArticlePublic` 继续选择原 Snapshot，直到独立发布命令选择新 Snapshot。
3. 发布后编辑开关是产品策略，只能限制作者，不能授予非作者编辑权，也不改变 Article 或 Community Lifecycle。策略按 Community/thread 配置并对共享 Article 的 bindings 采用 deny-wins；Community 在此处是配置 owner 和请求 binding 上下文，不是 Article 作者权限的来源。
4. `ArticleWorkingCopy.revision` 是并发序号。保存提交当前 `revision`，成功后推进；它不是 `ArticleRevision` 实体、ID 或历史版本。命令名和结果使用 Article 基座合同中的 `saveWorkingCopy`、`forkSnapshot` 等既定名称。
5. Asset 在本基座中是内容 owner 对既有 Asset 的引用。替换 Asset 会改写 WorkingCopy 内容及引用，故须经过内容编辑策略；此合同不扩展上传、对象存储或清理流程。
6. Docs 使用独立队列 WorkingCopy、Doc branch 和 Doc Lifecycle。Article 策略不在本文直接接入 Docs，也不改变 Docs 发布队列合同。

## 2. 已确认缺陷：Gate Policy 收到了两份资源事实

已发布 Post 的保存行为测试中，actor 是 Article 作者，但 Passport 没有 `post.edit` grant。事务内 Gate Loader 加载 canonical Article 并从其 author 做 owner fallback，保存可提交；Receipt 结果呈现又走普通 access path。旧的普通路径把调用方未 preload author 的 Article 和 Loader 生成的 Context 同时交给 Policy，owner fallback 因调用方关联未加载而失败，呈现返回 `permission_denied`。用户看到命令失败，但 WorkingCopy 的保存和 `revision` 推进已经提交。

根因是 Policy API 允许 `caller_resource + loaded_context` 两套资源事实并存。普通 Gate 与事务内 Gate 因此可能对同一操作得出不同结论。修复必须由 typed Context 的单一资源入口消除差异，不能靠给测试 actor 增 grant、补传 author 或在 presenter 单独增加 owner 特判。

## 3. Gate 内部合同

### 3.1 Policy 只读取 typed Access Context

Article Policy 的普通 Article 入口固定为：

```elixir
Policy.Article.check_access(actor, action, %Gate.Context.Access.Article{} = context)
```

Docs 现有 Access Policy 分支继续使用 `%Gate.Context.Access.Doc{}`，不得为统一签名而把 Doc 转成 Article Context，也不得丢失 branch、DocLifecycle 或 DocBranchState。Article Policy 不再接受独立 caller Article 参数；author、thread、Community、Lifecycle、产品策略只能从 Loader 构造并验证的 Context 读取。

### 3.2 Gate 入口共享 evaluator

普通 `access_check`、事务内 `check_in_transaction`、`with_check`、Receipt 首次执行和 Receipt 结果呈现的资源准入都必须调用同一 Policy evaluator。入口可以拥有不同的事务/锁编排，但 Context 构造后不能各自复制 owner、Passport、Lifecycle 或产品策略判断。

```text
entry point
  -> owning transaction / Article aggregate lock
  -> Loader validates identities and loads canonical typed Context
  -> one Policy evaluator
  -> allow: return canonical resource or execute authorized callback
  -> deny: return typed Gate Decision
```

### 3.3 身份不变量

- Loader 校验 Article ID、thread、请求 Community 与 ArticleBinding 一致；Policy 不用 caller struct 上的 author/thread/community/status 做准入判断。
- Gate 通过后，Command 写入的 Article ID 必须与 Context 的 canonical Article ID 相同。
- 扫描 Access.Check 的其他 resource policy；只移除确实存在的双资源输入，不顺手重命名或重构无关 Gate。

## 4. 发布后编辑策略

### 4.1 动作边界

Gate action 拆分为“操作者权限”和“改变可编辑内容的准入”两层：

| Gate action     | 含义                                                      | 操作者授权                                                       | 检查发布后策略                     |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `:edit`         | 有权访问/管理此 Article 的既有能力                        | 现有作者 owner fallback、Passport/thread grant                   | 否                                 |
| `:edit_article` | 创建或改变 Post/Blog/Changelog 的完整 Article WorkingCopy | 仅当 actor 是 canonical Article 作者；不接受 Passport 编辑 grant | 仅当 Article 有 `ArticlePublic` 时 |
| `:publish`      | 选择/发布 Snapshot                                        | 现有发布权限及发布条件                                           | 否                                 |

必须按以下映射接入，不得把策略挂在通用 `:edit` 上：

| 调用                                                         | 准入动作               | 说明                                                                                                  |
| ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `saveWorkingCopy` 首次执行                                   | `:edit_article`        | 包含标题、digest、正文、tag ID、thread 内容字段、封面选择和 CoverEdit 引用的 WorkingCopy 保存         |
| `forkSnapshot` 首次执行                                      | `:edit_article`        | 创建从 Snapshot 派生的独立 WorkingCopy                                                                |
| Article Asset 替换 Receipt 与 workflow 新写入路径            | `:edit_article`        | 改变 WorkingCopy 的引用/内容并推进 `revision`                                                         |
| WorkingCopy/Snapshot/activity 查询、`createArticle` 结果重建 | `:edit` 或对应读取动作 | 产品开关不能阻止读取；仍按操作者权限授权                                                              |
| `saveWorkingCopy` / `forkSnapshot` Receipt presenter         | `:edit`                | 重建确认需重新校验读取该结果的权限，但不重跑 mutation，也不因编辑开关刚关闭而把已提交命令伪装成未提交 |
| `deleteWorkingCopy`                                          | `:edit`                | 按独立权限和引用约束删除；不受发布后编辑策略阻止，不接收 `revision`                                   |
| `publishArticle`                                             | `:publish`             | 编辑策略关闭不自动禁止发布已有 Snapshot；仍校验发布权、Lifecycle 和可发布条件                         |

Receipt presenter 必须只按确认身份重建其应返回的结果，并对当前读取权限重新授权。若已提交的命令因权限撤销而不能呈现结果，统一返回 `CMS.ErrorCat.command_result_unavailable()`（4534，动作 `reconcile`），不能返回会让客户端误判“写入未提交”的 `permission_denied`。首次执行在提交前被 Gate 拒绝仍返回具体 `permission_denied` 或 `published_article_editing_disabled`。presenter 不执行 `:edit_article`，也不重复写入。

### 4.2 配置 owner、取值和解析

**唯一 owner：** `CommunityDashboard.enable`（存于 `community_dashboards` 的 enable embed）。管理员通过既有 Dashboard `enable` section 更新入口配置，不新增独立策略表、通用策略引擎或 Article 字段。

在 `CMS.Dashboard.Fields.macro_schema(:enable)` 增加三个 nullable Boolean 字段：

| 字段                          | 适用 thread | 空值含义     |
| ----------------------------- | ----------- | ------------ |
| `post_published_editing`      | Post        | 继承平台默认 |
| `blog_published_editing`      | Blog        | 继承平台默认 |
| `changelog_published_editing` | Changelog   | 继承平台默认 |

取值语义为 `nil = inherit`、`true = allow`、`false = deny`。平台默认由 `:groupher_server, :published_article_editing_default` 提供；缺省值固定为 `true`。因此旧 Community 的 enable JSON 缺字段以及新 Community 默认值都解析为 allow。不得把字段默认写成 `true` 后再把“从未设置”解释为 deny，也不得将 `nil` 转成 false。

策略解析规则唯一如下：

```text
if ArticlePublic row does not exist:
  policy = allow                 # 首次发布前不适用“已发布后编辑”开关
else:
  bindings = every ArticleBinding row for this Article
  values = each binding Community's thread-specific override
  if any value is false: deny    # deny-wins
  else if any value is true: allow
  else: platform default         # all nil / no binding override
```

当前 ArticleBinding 是 peer binding，没有公开/私有可见性列；所以规则明确为 Article 已发布时汇总该 Article **全部现存 bindings**。请求 Community 仍用于检查当前 actor 对该 Article 的既有权限，不能用某个宽松 Community 的 override 覆盖其他 binding 的 deny。Article 没有 `ArticlePublic` 时不聚合出“已发布”状态；不得用 Lifecycle、Snapshot 是否存在或 `published_at` 代替 Public 行判断。

### 4.3 Dashboard 更新语义

- Dashboard Enable GraphQL 输入/输出沿用已有 `enable` section；新增字段以 nullable Boolean 暴露。
- 更新采用字段 patch 语义：未提交字段保持当前值；显式 `null` 清除 override；`true/false` 设置覆盖。不能因客户端只更新一项就把其他 Enable 字段重置为 schema 默认值。
- Enable 更新必须在 Gate `:update` 成功后，重新读取 Dashboard 行并在该行 `FOR UPDATE` 锁内合并字段、保存 embed。不能用 Gate 前读取的旧 embed 覆盖并发更新。
- 新字段不得改变现有 `post/blog/changelog` 启用开关的含义；它们分别控制产品入口可用性，不等同于已发布内容是否可编辑。

### 4.4 Loader、策略和错误顺序

仅 `:edit_article` 需要加载发布后编辑策略。`Access.Check` 在 Gate admission transaction 中加载 typed Article Context 后调用 `Articles.EditingPolicy.load(context, action)`；它只对 `:edit_article` 读取配置，不改 `Load.article/4` 签名，也不让 `Policy` 查询数据库。Article Access Context 使用 `published_article_editable?: boolean | nil` 和 `published_article_editing_error`；`:edit_article` 下编辑事实缺失或不是 `true` 必须 fail closed。若 Dashboard 不变量损坏，Loader 将错误记入 Context，Policy 在 actor 身份和 Lifecycle 检查后返回 `dashboard_not_found`，确保非作者只得到 `permission_denied`。对其他 action 不加载此事实。

拒绝优先顺序固定如下，Decision 必须选择列表中最靠前的失败：

1. identity / binding / branch context 无效：`resource_not_found`、`gate_resource_mismatch` 等既有错误；
2. actor 身份授权失败：`permission_denied`；不得让无权限用户探测策略；
3. Community 与 Article Lifecycle 拒绝：使用现有具体 Lifecycle reason；
4. 对已识别的 Article action，Lifecycle 检查之后再执行产品策略；有效 action 中策略 deny 返回 `published_article_editing_disabled`。

`unknown_action` 是 Gate action 合同的校验结果，不属于上述“有效 action 的 actor/Lifecycle/产品策略优先级”。入口应先将未注册 action 返回 `unknown_action`；不得先查 Dashboard 再决定 action 是否存在。对于 `:edit_article`，actor 检查必须先于策略拒绝，确保非作者只得到 `permission_denied`，不会探测发布后编辑设置。

`published_article_editing_disabled` 使用 Gate code 4633；`dashboard_not_found` 使用 Gate code 4634，表示必有 Dashboard 行不变量损坏。两者必须注册于 Gate ErrorCat 和 `Gate.Decision` 的 `@known_reasons` 与 priority，配置 message key、客户端文案和恢复动作，并同步错误目录/GraphQL 映射。发布后编辑拒绝不能降级成 `gate_unknown`、`permission_denied` 或 Lifecycle 错误。

## 5. 数据读取与并发锁合同

### 5.1 内容写入准入锁序

对 `:edit_article`，一次准入及相应内容写入处于同一数据库事务。所有 Community 创建时必须持久化默认 `CommunityDashboard` 行；此为既有数据不变量，不为缺行增加 advisory lock 或懒创建分支。按现有 Article aggregate admission 序列获取锁：

1. owning Command 先取得按 Article ID 定位的 advisory transaction lock；同一 Article 在所有 Community 使用同一 key；
2. `MutationLock.lock_community_admission(article_id)` 按 `community_id ASC` 锁 Article 当前所有 binding 的 `CommunityLifecycle` 行 `FOR SHARE`；
3. Loader 锁 Article 行 `FOR UPDATE`，校验当前 Article 及 bindings；
4. Loader 锁请求 binding `FOR SHARE`、请求 CommunityLifecycle `FOR SHARE` 与 ArticleLifecycle `FOR UPDATE`；策略 Loader 按 `community_id ASC` 锁所有对应 `ArticleBinding` 行 `FOR SHARE`；
5. 只有 `:edit_article` 且 Article 有 Public 时，按 `community_id ASC` 锁所有 binding 对应的 `CommunityDashboard` 行 `FOR SHARE` 并读取 enable embed；Dashboard 行数量必须与 binding Community 数量一致，否则将 `dashboard_not_found` 记入 Context 并在 Policy 的 actor / Lifecycle 检查之后拒绝，不得当作 `nil = inherit` 放行；
6. 在锁仍有效时执行 Policy 和 WorkingCopy/asset-ref 写入，成功后提交；任一步失败整笔回滚。

实现必须验证所有 ArticleBinding 增删/迁移写入都先取得同一 Article aggregate lock；若存在绕过该锁的 binding writer，必须纳入此锁合同后才能声称 deny-wins 无竞态。Community 创建事务在插入 Community 时一并保存 `CommunityDashboard.default()`；缺 Dashboard 是不变量损坏，不能由 Gate Loader 或普通配置更新静默修复。

### 5.2 策略更新与死锁约束

Dashboard Enable 更新顺序为：Community Gate admission → 读取该 Community 已存在的 Dashboard 行并按主键 `FOR UPDATE` → 在锁定的新鲜 embed 上 patch 并更新。该更新不得再取得 Article 行锁或 Article advisory lock；缺行返回 `dashboard_not_found`，不调用 `get_or_insert_dashboard`。

内容编辑按 Community ID 升序取得所有 Dashboard `FOR SHARE`；Dashboard 更新只锁一个 Community 的 Dashboard `FOR UPDATE`。两者在 Dashboard 行上串行化，不增加独立策略锁。任何实现若改变锁序，必须更新本文和死锁测试。

策略更新与内容保存通过 Dashboard 行锁串行化：内容保存取得各 Dashboard `FOR SHARE` 后，Enable 更新等待到保存提交；更新提交后开始的新保存读取新值。保存先取得锁时，策略更新不能追溯撤销已提交保存。多 Community 内容编辑按 ID 升序锁 Dashboard；单 Community 更新只锁对应一行。

## 6. Receipt 执行、重放和恢复

Receipt 的首次执行与恢复不是同一过程：

| 阶段               | Gate / 策略行为                                                                | 持久化结果                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 首次执行           | 在写事务中运行 `:edit_article`，读取当前锁定策略；策略拒绝则事务不写入         | 成功时保存 WorkingCopy、revision 和 Receipt Confirmation 后一同提交                                                 |
| 同 commandId 恢复  | Receipt Runner 取回已确认的 Confirmation，不重新执行 mutation Gate，不重复写入 | 原提交不回滚、不再推进 revision                                                                                     |
| presenter          | 用 canonical Article identity 检查当前读取/披露权限；不检查 `:edit_article`    | 权限仍有效则返回已确认结果；权限已撤销则返回 `command_result_unavailable`（4534 / `reconcile`），不披露 WorkingCopy |
| 用户恢复当前编辑器 | 通过受读取权限保护的 WorkingCopy 查询读取服务端当前内容和 `revision`           | 作者以读到的最新 revision 恢复编辑；下一次保存再按当前 `:edit_article` 策略准入                                     |

因此策略关闭后重放一个已提交命令，不能谎报“事务回滚”或重新执行保存。若作者仍有读取权限，presenter 返回原确认结果；之后新的内容写入会因策略关闭得到 `published_article_editing_disabled`。若作者读取权限被撤销，Receipt 不得成为旁路；presenter 返回 `command_result_unavailable`，客户端用 commandId/Receipt 对账，待读取权限恢复后再查询当前 WorkingCopy 和 `revision`。首次执行在提交前被策略拒绝则明确返回 `published_article_editing_disabled`，两类结果由不同错误区分。

Asset workflow retry 在 Gate 阶段先检查当前 WorkingCopy revision、locator 和目标 Asset：精确匹配已完成效果时走 `:edit` 读取/准入并在 change 阶段只返回恢复结果；否则按新写入执行 `:edit_article`，再更新 WorkingCopy、revision 和引用。新 step 使用当前 revision 时会被作为新写入，受当前策略限制；若当前状态不能证明给定旧 revision 的替换已完成，也按新写入处理。恢复分支不在 change 阶段二次调用 Gate。

## 7. 实施批次

各批次在同一 Article Gate 范围内连续实施和验收。该文档是本次策略工作的合同，不授权提前实施 Docs 队列。

### F0：本合同和影响面冻结

1. 实施采用本文的 `:edit_article` 作者限定、CommunityDashboard nullable Boolean、platform default、deny-wins 和 Receipt 语义。
2. ArticleBinding 写入由 `BindingPersist` 持久化；mirror、move、unmirror Command 经 Gate 获取同一 Article ID aggregate advisory lock，持久层再锁 canonical Article 行。初次创建的 Article 与 binding 在同一事务提交前不可被其他事务读取。`saveWorkingCopy`、`forkSnapshot`、Asset replaceUse Receipt/workflow 的准入点已明确；查询、删除、发布及 presenter 分别保留读取、`:edit`、`:publish` 或 reconciliation 语义。
3. 新错误已接入 Gate ErrorCat、Decision、错误目录和 GraphQL 通用错误映射，并增加中英文 message key。
4. `Dashboard.Enable` nullable 字段沿用 Ecto embed/GraphQL nullable Boolean/patch 写入；`nil = inherit`，现有与新建 Community 均从默认 Dashboard embed 读取。策略 Loader 不插入缺失行，缺行在 Policy 的 actor 与 Lifecycle 校验之后 fail closed。

### F1：Canonical Context 修复

已移除 Article / Doc Policy 的独立资源参数，普通准入与事务内准入共用 typed Context evaluator，并合并普通 Article Loader 的重复实现；Comment Policy 原先未使用的独立资源参数也已移除。Loader 重新读取 Community 身份后解析 Passport，并检查 canonical Article 和 Binding 的 thread。已有未 preload 作者、伪造作者、伪造 Community slug 及 thread 不匹配行为测试；ArticleBinding 与 Dashboard 行锁并发由 F2 覆盖。

1. Article Policy 删除独立 Article 参数，Policy 只读 `Access.Article.article`；保留现有 `Access.Doc` 分支。
2. 普通 Article access、事务内 access 和 `with_check` 使用同一 Policy evaluator。
3. 修复/去重 Loader 重复实现，但保留 `article/4` 与 `article_in_community/4` 的公共语义；补 canonical author、未 preload caller resource、资源 ID 不匹配和 DocContext 行为测试。

### F2：策略配置与锁定事实

实施核对发现原锁序先调用 `lock_community_admission` 再获取 Article advisory lock，原 key 还包含 Community ID。普通 Article 已改为按 Article ID 共享锁，事务内 Gate 先取得该锁再锁绑定 Community；Mirror、Move、Unmirror 经 Gate 后写 binding，首次创建在新 Article 尚不可见的事务内写入。多 binding 增删与内容写入用真实 Repo/Postgres 并发用例覆盖。

Community 创建事务持久化默认 Dashboard，因此 Gate 不以缺行作为正常状态，也不增加 Community policy advisory lock。内容准入直接按 binding 锁定现存 Dashboard 行 `FOR SHARE`；Enable 更新按行 `FOR UPDATE` 后合并最新 embed。缺行记录为 typed Context 错误，由 Policy 在 actor / Lifecycle 检查后 fail closed。PostgreSQL 并发测试覆盖 Dashboard 更新与保存串行化，以及 Mirror 在途时的 binding 集合可见性。

1. 在 Dashboard Enable 新增三项 nullable Boolean，默认/旧记录按 nil 继承平台 allow；管理员更新执行保留未提交字段的 patch。依赖 Community 创建时已有 Dashboard 行，不创建缺行兼容分支或 advisory lock。
2. 增加 Article EditingPolicy 单一解析边界；输入只接受已锁定的 Public、bindings 和 Dashboard enable 值。
3. `:edit_article` 经 `EditingPolicy.load(context, action)` 按本文顺序读取/锁定策略所需记录并把结果写入 typed Article Access Context；作者检查先于产品策略判断。
4. 增加 Gate reason/code/message/Decision priority/GraphQL 映射。

### F3：命令接入

1. `saveWorkingCopy`、`forkSnapshot` 的首次写入接入 `:edit_article`；保留读取/结果呈现的读取授权。
2. Article Asset replaceUse Receipt 与 workflow 新写入接入 `:edit_article`；workflow 已提交重试走只读恢复后返回，不能被新策略关闭卡住。
3. `deleteWorkingCopy` 保留 `:edit`，无 revision 输入，不受策略关闭影响；`publishArticle` 保留 `:publish`。
4. 不改变 Snapshot 内容、公开选择、CoverEdit 独立 WorkingCopy/Snapshot 身份和 Asset 引用 owner 合同。

### F4：全链验收

#### 本地验证记录

- 环境：`backend/api` 的 Mix test / compile 环境，连接本地测试 PostgreSQL；测试日志显示 `Migrations already up`。未使用生产数据，也未做部署验收。
- Article Gate / Dashboard / Receipt / Doc 边界 / Asset workflow 并发：在 `backend/api` 执行 `mix test test/groupher_server/cms/articles/commands/recovery_test.exs test/groupher_server/cms/articles/commands/editing_policy_concurrency_test.exs test/groupher_server/cms/articles/commands/delete_working_copy_pipeline_test.exs test/groupher_server/cms/articles/doc_workspace_boundary_test.exs test/groupher_server/cms/communities/enable_test.exs test/groupher_server/cms/gate/access_test.exs test/groupher_server/cms/gate/decision_test.exs test/groupher_server/cms/assets/replace_use_workflow_concurrency_test.exs`，结果 **64 passed / 0 failures**。
- Article 目录全套：此前运行 `mix test test/groupher_server/cms/articles` 曾得 **134/135**；唯一失败是 Asset workflow 并发测试通过 `Sandbox.unboxed_run` 提交数据，而清理未删除该测试创建的 Article/WorkingCopy，导致全局 WorkingCopy 数量从预期 0 变为 7。现测试用唯一标题标记当前 WorkingCopy，在 `on_exit` 中先删除关联 Asset refs，再删除 Article（级联 WorkingCopy），并清理该测试早先遗留的同名数据。清理后重跑同一命令，结果 **136 passed / 0 failures**。这次结果覆盖 Articles 目录，不代表全量 backend suite。
- Asset 全模块：`mix test --timeout 120000 test/groupher_server/cms/assets_test.exs`，结果 **44 passed / 0 failures**；独立 Article 锁并发恢复用例也包含在上一条 64 项中。
- GraphQL / 错误适配：`mix test test/groupher_server_web/error_response_test.exs test/groupher_server_web/mutation/cms/crud_test.exs`，结果 **42 passed / 0 failures**。这覆盖错误适配与 CMS CRUD，不等于全套 GraphQL API 测试。
- 编译：`mix compile --warnings-as-errors`，退出码 **0**。
- 格式、文档与差异检查：对本次修改的 8 个 Elixir 源码/测试文件执行 `mix format --check-formatted`，退出码 **0**；`node scripts/check-documentation.mjs` 输出 `Documentation coverage passed.`；`git diff --check` 退出码 **0**。
- 未覆盖：未运行全量 backend test suite；未做生产环境并发/负载或部署验收；受保护文章以外的历史数据迁移不属于本次 Gate 修复。上述结果仅代表本地指定范围，不声称全链路生产验收。

以上每项必须在实际命令执行后填写通过数量 / 失败数或退出码；不能仅凭历史运行或目标测试清单将状态标为完成。并发策略更新、binding 变化与 workflow 恢复均使用真实 Repo/PostgreSQL 行为测试。Article 基座/Gate 引用更新完毕；不编辑 Docs 队列合同或 Docs 队列运行时代码。

## 8. 验收矩阵

| 场景                                                         | 预期                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Article 作者通过未 preload author 的 Article 保存已发布 Post | canonical Context 做 owner fallback；保存成功，revision 推进一次                                                                   |
| Article 作者保存 WorkingCopy                                 | canonical Context 识别作者；无需 `post.edit` grant，保存成功且 revision 推进                                                       |
| 非作者持有 `post.edit` Passport grant                        | `:edit_article` 仍返回 `permission_denied`；WorkingCopy、revision、tag、Asset refs、Public 不变                                    |
| 普通非作者无有效编辑 grant                                   | `permission_denied`；WorkingCopy、revision、tag、Asset refs、Public 不变                                                           |
| Article 作者，所有策略 nil                                   | 按 platform default allow 保存                                                                                                     |
| 作者的多个 binding 中策略值为 true + nil                     | 策略 allow；作者可写                                                                                                               |
| platform default false 且任一 binding 显式 true、其余 nil    | deny-wins 下无 false，故策略 allow；作者可写                                                                                       |
| 任意一个 Article binding 的对应策略为 false                  | save、fork、asset replace 新写入返回 `published_article_editing_disabled`；所有内容及引用不变                                      |
| 全部 nil 且 platform default false                           | 三种内容写入口被策略拒绝；读取、删除及按权限发布不被该开关阻止                                                                     |
| Article 无 ArticlePublic，但有 Snapshot                      | 视为未发布；策略不阻止 WorkingCopy 内容写入                                                                                        |
| `deleteWorkingCopy` 在产品策略 deny 下执行                   | 仍按 `:edit` 和外部 RESTRICT/FK 合同处理，不被策略拒绝                                                                             |
| WorkingCopy/Snapshot 查询、Receipt presenter 在策略 deny 下  | 仍按读取者权限 `:edit` 授权；产品编辑开关不阻止恢复服务端内容                                                                      |
| Receipt 确认后关闭策略再以同 commandId 重放                  | 不重复写入、不推进 revision；有读取权限时返回已确认结果，之后新的保存被拒绝                                                        |
| Receipt 确认后撤销 actor 结果读取权限再重放                  | 返回 `command_result_unavailable`（4534 / `reconcile`），不披露 WorkingCopy；已提交写入保持不变，权限恢复后可重新读取当前 revision |
| Community Dashboard 缺失                                     | 返回 `dashboard_not_found` 并回滚；不按 nil allow、不懒创建、不取得额外 advisory lock                                              |
| 同时更新策略和保存                                           | 以 Dashboard `FOR SHARE` / `FOR UPDATE` 行锁取得顺序确定结果；策略更新提交后开始的新写入读到新值                                   |
| 两个 binding Community 的 Dashboard 锁顺序                   | 始终按 community_id 升序，无锁序反转；ArticleBinding 并发增删由 Article aggregate lock 串行化                                      |
| Article archived/deleted/destroy 或 Community 只读           | 返回相应 Lifecycle 错误；产品 allow 不覆盖 Lifecycle                                                                               |
| `forkSnapshot`                                               | 通过策略时生成内容、CoverEdit 和 Asset 引用均独立的新 WorkingCopy；拒绝时无残留副本                                                |
| Asset replaceUse Receipt 和 workflow                         | 两路径同策略、同事务更新 WorkingCopy 和 refs；拒绝或保存失败时两者都不变                                                           |
| Asset workflow 替换已提交后策略关闭再重试同 step             | 精确确认原替换已完成时走只读恢复，不推进 revision；新 step 仍被策略拒绝                                                            |
| Article/Doc typed Access Context                             | Article Policy 只消费 Article Context；Docs 原有 DocContext/branch 准入行为保持并通过测试                                          |

验收必须包括真实 Repo/Gate/Command 行为、两条 Asset 替换路径、Receipt 首次执行与恢复、Dashboard 更新并发和错误 contract。Policy 函数单测、静态扫描或仅 GraphQL middleware 测试不能代替全链验收。
