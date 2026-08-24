# ErrorCat v2

## 0. 文档状态

本文是 ErrorCat v2 的最终契约，也是本次一次性重构的实现依据。当前仓库已经完成
ErrorCat catalog、Gate/领域返回链路、GraphQL 边界和相关测试的切换；后续新增错误必须遵守本文，
不得重新引入 raw error atom 或 raw error tuple。

本次重构不考虑历史 API、历史模块名或历史数据兼容。完成后，业务代码、测试、文档和错误返回路径统一使用 ErrorCat。

本文是唯一实现依据；error_cat.md 中与本文冲突的 range、API、payload、code 策略和默认值均已废弃。

## 1. 目标和最终形态

ErrorCat 解决三件事：

1. 在声明处确定错误的完整定义：namespace、reason、code、重试策略、动作提示和 message key。
2. 在编译期检查所有 catalog 的完整性：namespace、数值区间、保留码和重复声明。
3. 在运行期让业务代码只返回已声明的 ErrorCat.Error，避免散落整数 code、错误 atom 或错误 tuple。

最终调用链：

    producer
      -> 具体 catalog 的 reason()
      -> ErrorCat.Error
      -> 领域控制流 / formatter / API payload

ErrorCat 只负责声明、构造、校验和格式化。它不负责猜测业务错误归属；归属必须在 catalog 和迁移清单中明确。

### 1.1 错误返回协议

凡是表示失败、拒绝、未认证、未找到、解析失败或其他业务错误的返回值，必须使用
`ErrorCat.Error`：

    {:error, GroupherServerWeb.ErrorCat.account_login()}
    {:error, GroupherServer.CMS.Articles.ErrorCat.archived()}

禁止使用以下形式表达错误：

    {:error, :actor_required}
    {:error, :article_archived}
    {:error, {:comment_not_found, message}}
    {:error, 6004}

`Decision` 不是另一套错误声明机制。Gate policy 也返回 `ErrorCat.Error`，`Decision` 只是在
此基础上增加授权结果、优先级和 actions 等策略信息：

    {:error, CMS.Gate.ErrorCat.article_archived()}
      -> %GroupherServer.CMS.Gate.Decision{error: error, ...}

普通的内部状态标记（例如 parser 的中间分支、Ecto.Multi 的 step 名称）不属于错误协议，
可以继续使用 atom；但它们在模块返回或越过 context 边界前，必须转换成完整的
`ErrorCat.Error`。因此，错误相关 raw atom / raw tuple 的存在不是允许的返回契约。

Ecto 持久化校验失败是例外：`Ecto.Changeset` 可以作为数据库层的结构化校验对象继续在
context 内流转。它不是错误码声明，也不能直接作为 GraphQL/HTTP 错误 payload；到协议边界时
由 changeset formatter 负责转换。除 changeset 和 Gate `Decision` 这两种结构化控制对象外，
业务失败不得返回其他 raw atom 或 raw tuple。

## 2. 和旧机制的差异

| 旧机制                                        | ErrorCat v2                             |
| --------------------------------------------- | --------------------------------------- |
| 全局 Helper.ErrorCode、Helper.Const 保存 code | 每个 context 的 catalog 声明自己的错误  |
| 业务代码散落整数和 reason atom                | catalog 生成构造函数                    |
| reason 可能只靠 atom 识别                     | namespace + reason 才是错误身份         |
| 保留码依赖额外数字列表                        | @reserved 也是完整的 ErrorCat 定义      |
| 运行时才发现未知错误                          | catalog 和全局注册表在编译期校验        |
| Web catalog 容纳不明确的通用业务错误          | Web catalog 只保留协议层错误            |
| valid?/1 只比较 code                          | valid?/1 比较完整定义，忽略 details     |
| formatter 猜测 raw atom 或整数含义            | formatter 只接受已构造的 ErrorCat.Error |

## 3. Namespace

### 3.1 统一使用结构化 tuple

所有 namespace 都使用 tuple，即使只有一段也不使用裸 atom：

以下列表仅用于展示 tuple 语法，非穷尽 namespace 清单；完整注册关系以全局 @ranges
和 catalog registry 为准。

    {:web}
    {:account, :fans}
    {:account, :collection}
    {:cms, :gate}
    {:cms, :article}
    {:cms, :comment}
    {:cms, :community}
    {:cms, :interaction}
    {:cms, :asset}

统一 tuple 的原因是单段和多段 namespace 可以共用同一套类型、比较、格式化和 message key 生成逻辑。裸 atom 不是合法 namespace。

namespace 只是身份标识，不必与模块名或目录名逐字一致。例如：

    {:account, :authentication}
    -> GroupherServer.Accounts.Profiles.ErrorCat

authentication 表示业务语义，Profiles 是仓库实际承载 OAuth / profile 代码的模块名。namespace 与模块名脱钩是允许且明确的。

### 3.2 前缀不是继承关系

    {:cms} != {:cms, :gate}

{:cms} 可以是 {:cms, :gate}、{:cms, :article} 等 namespace 的路径前缀，但它们仍然是不同的完整 namespace，不产生继承或 fallback。

namespace 重复检查只比较完整 tuple。range 冲突只比较数值区间。

### 3.3 reason 的身份

相同 reason 可以出现在不同 namespace：

    {:cms, :article}, :archived
    {:cms, :comment}, :archived

它们是两个不同的错误，因为 namespace + reason 不同。业务代码不能只用 :archived 判断错误类型。

## 4. Catalog 目录和模块

目录遵循仓库现有 context 约定：

    backend/main/lib/
    ├── groupher_server/
    │   ├── error_cat.ex
    │   ├── error_cat/
    │   │   ├── domain.ex
    │   │   ├── error.ex
    │   │   ├── registry.ex
    │   │   └── validator.ex
    │   ├── accounts/
    │   │   ├── profiles/error_cat.ex
    │   │   ├── collect_folders/error_cat.ex
    │   │   └── fans/error_cat.ex
    │   └── cms/
    │       ├── error_cat.ex
    │       ├── articles/error_cat.ex
    │       ├── comments/error_cat.ex
    │       ├── communities/error_cat.ex
    │       ├── interactions/error_cat.ex
    │       ├── assets/error_cat.ex
    │       ├── gate/error_cat.ex
    │       ├── gate/rate_limit/error_cat.ex
    │       ├── passport/error_cat.ex
    ├── groupher_server_web/error_cat.ex
    └── mix/tasks/compile/error_cat.ex

模块名对齐仓库现有命名：

    GroupherServer.Accounts.Profiles.ErrorCat
    GroupherServer.Accounts.CollectFolders.ErrorCat
    GroupherServer.Accounts.Fans.ErrorCat
    GroupherServer.CMS.ErrorCat
    GroupherServer.CMS.Articles.ErrorCat
    GroupherServer.CMS.Comments.ErrorCat
    GroupherServer.CMS.Communities.ErrorCat
    GroupherServer.CMS.Interactions.ErrorCat
    GroupherServer.CMS.Gate.ErrorCat
    GroupherServer.CMS.Gate.RateLimit.ErrorCat
    GroupherServer.CMS.Passport.ErrorCat
    GroupherServer.CMS.Assets.ErrorCat
    GroupherServerWeb.ErrorCat

GroupherServer.ErrorCat 是全局注册表和校验入口，不是业务错误的兜底 catalog。各 context 直接使用自己的 catalog，不保留 Helper.ErrorCode facade，也不做旧 API 兼容层。

## 5. Catalog 声明

每个 catalog 使用统一的 Domain DSL：

    defmodule GroupherServer.CMS.Articles.ErrorCat do
      use GroupherServer.ErrorCat.Domain,
        namespace: {:cms, :article}

      error :archived,
        code: 6004,
        retryable: false,
        actions: [:show_archive],
        message_key: "cms.article.archived"
    end

声明应产生：

- archived/0：构造完整 ErrorCat.Error；
- Articles.ErrorCat.definition(:archived)：返回该 catalog 内的完整定义；
- catalog 的 namespace 和 registry entry；
- 可供全局 validator 检查的 metadata。

业务代码调用 catalog：

    {:error, error} = Articles.ErrorCat.archived()

业务层不自行构造 ErrorCat.Error，也不直接返回整数或 reason atom：

    {:error, 6004}
    {:error, :archived}

拼写错误或未声明 reason 应在编译期失败；运行时动态输入必须通过 declared?/2 或 definition/2 检查。

## 6. Producer 归属

### 6.1 Web catalog 的边界

GroupherServerWeb.ErrorCat 只声明 Web / API 协议层错误：

    {:web}, :pagination
    {:web}, :changeset
    {:web}, :service_auth

以及全局保留定义：

    {:web}, :default
    {:web}, :custom

以下 8 个仍有 producer 的旧通用错误必须从 Web catalog 移除，按真实 producer 审计后落到领域 catalog：

| 旧 reason      | 迁移规则                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------ |
| :not_exist     | 已按调用点拆到 Accounts Profiles/Fans、Articles、Comments、Communities、Assets 等 producer |
| :already_did   | Accounts.Fans 的 follow producer，当前落在 {:account, :fans}                               |
| :self_conflict | Accounts.Fans 的 follow producer，当前落在 {:account, :fans}                               |
| :react_fails   | Accounts.Fans 的 follow producer，当前落在 {:account, :fans}                               |
| :already_exist | 当前落在 Accounts.CollectFolders                                                           |
| :update_fails  | 当前落在 CMS.Comments                                                                      |
| :delete_fails  | 当前落在 CMS.Comments                                                                      |
| :create_fails  | 当前落在 CMS.Comments                                                                      |

`:editor_data_parse` 已随本次重构移除，当前没有 producer，也不进入任何 catalog。

这 8 个错误已经按 producer 完成审计，不能归入 {:web}。同名 reason 以实际 producer
决定 catalog；没有 producer 的 `:editor_data_parse` 已明确移除。

### 6.2 业务层如何知道 atom 是否存在

业务层不能手写或猜测 atom，只能调用具体 catalog 已生成的构造函数：

    Accounts.Fans.already_did()
    Articles.archived()
    Comments.archived()

未声明的 reason 必须无法构造。动态输入使用 declared?/2 或 definition/2 显式检查。

### 6.3 同名 reason 的迁移

archived 可以分别属于 Article 和 Comment：

| namespace        | reason    | 目标 code |
| ---------------- | --------- | --------: |
| {:cms, :article} | :archived |      6004 |
| {:cms, :comment} | :archived |      4411 |

迁移表必须记录两条，不能因为 reason 同名而合并。

Gate 的 article_archived 是另一条决策错误：

    {:cms, :gate}, :article_archived, 4609

它不能与 Article 的 archived/6004 合并。

## 7. Code range

### 7.1 range 只在全局 ErrorCat 声明

业务 catalog 不声明 code_range。所有范围集中在 GroupherServer.ErrorCat：

    @ranges %{
      {:web} => 4000..4199,
      {:cms, :gate, :rate_limit} => 4200..4299,
      {:account, :authentication} => 4300..4349,
      {:cms, :passport} => 4350..4399,
      {:cms, :comment} => 4400..4499,
      {:cms} => 4500..4599,
      {:cms, :gate} => 4600..4699,
      {:account, :collection} => 4700..4799,
      {:account, :fans} => 4800..4899,
      {:cms, :interaction} => 4900..4999,
      {:cms, :community} => 5500..5599,
      {:cms, :asset} => 5600..5699,
      {:cms, :article} => 6000..6099
    }

这是最终 range 结构。40xx、41xx、42xx、55xx 和 56xx 都有明确 owner，不能只在分类说明中出现而没有全局 range。

{:cms} 由 GroupherServer.CMS.ErrorCat 作为 owner，即使当前没有 entry，也允许暂时为空。
“每个 range 有 catalog”要求有 owner，不要求 owner catalog 当前必须有 entry。

尚未分配 range 的新 producer 只能标记为 planned，不能加入全局 catalog 注册表，也不能在
迁移表中伪装成最终落点。Assets、Fans 和 Interactions 当前都已经有明确 range，因此属于
当前注册表的一部分。

### 7.2 range 校验

Mix.Tasks.Compile.ErrorCat 负责全局校验：

1. namespace 是合法的非空 atom tuple；
2. 每个 catalog namespace 都在 @ranges 注册；
3. 每个 @ranges 都有且只有一个对应 catalog owner，无 owner 的 range 失败；owner catalog 可以为空；
4. range 之间不能数值重叠；
5. 普通 entry 的 code 必须落在自己的 range；
6. 普通 entry 不得占用 reserved code；
7. 完整 namespace 不得重复注册；
8. 同一 catalog 内 reason 不得重复；
9. 同一 catalog 内 code 不得重复。

模块自身编译时只做本地字段校验。依赖全局 @ranges、跨模块 namespace 和 range 覆盖关系的规则全部推迟到 Mix.Tasks.Compile.ErrorCat 的全局阶段，避免 Mix 并行编译时读取不到 module attribute。

## 8. Reserved definitions

### 8.1 统一使用 @reserved

@reserved 是全局 ErrorCat 中的完整保留定义。它是 ErrorCat v2 新增的统一机制，目的是让保留 code 也遵循同一套声明和返回结构。

示意：

    @reserved [
      %{
        namespace: {:web},
        reason: :default,
        code: 4000,
        retryable: false,
        actions: [],
        message_key: "web.default"
      },
      %{
        namespace: {:web},
        reason: :custom,
        code: 4001,
        retryable: false,
        actions: [],
        message_key: "web.custom"
      },
      %{
        namespace: {:cms, :gate},
        reason: :gate_unknown,
        code: 4699,
        retryable: false,
        actions: [],
        message_key: "cms.gate.gate_unknown"
      },
    ]

每项必须包含 namespace、reason、code、retryable、actions、message_key。reserved definition/2 与普通 entry 完全同形，不能只返回 namespace、reason、code 的残缺 map。

### 8.2 Reserved code 约束

- reserved code 必须落在其 namespace 的全局 range 内；
- reserved 定义之间 namespace + reason 和 code 都不能重复；
- 普通 entry 占用 reserved code 必须编译失败；
- 普通 entry 不能伪装成 reserved entry；
- reserved reason 不能在同一 namespace 被普通 entry 再次声明；
- default、custom 和 gate_unknown 必须出现在 reserved 清单中。

## 9. Runtime API

推荐的最小 API：

    ErrorCat.definition({:cms, :article}, :archived)
    ErrorCat.definition(%ErrorCat.Error{})

    ErrorCat.code(%ErrorCat.Error{})
    ErrorCat.valid?(%ErrorCat.Error{})
    ErrorCat.declared?({:cms, :article}, :archived)

语义：

- definition(namespace, reason)：返回完整定义；未知定义统一抛出清晰的 ArgumentError，不能返回 nil，也不能出现 BadMapError；
- definition(error)：读取 error 的 namespace / reason 并返回对应完整定义；
- code(error)：只接受 ErrorCat.Error，从完整 definition 读取 code；
- valid?(error)：检查 error 是否等于 catalog 完整定义，details 不参与定义一致性；
- declared?(namespace, reason)：判断 namespace + reason 是否已声明。

valid?/1 的判断等价于：

    declared?(error.namespace, error.reason)
    and error.namespace/reason/code/retryable/actions/message_key
        == definition(error.namespace, error.reason)
    details ignored

仅 code 相等不能使错误有效。message_key、retryable、actions、namespace 或 reason 任一被修改，都必须返回 false。

不提供 reason-only lookup，也不把 code(namespace, reason) 作为业务层主 API。业务层从 catalog 构造 ErrorCat.Error，再传给 code/1 或 formatter。

## 10. Error 结构和默认值

完整结构至少包含：

    %ErrorCat.Error{
      namespace: {:cms, :article},
      reason: :archived,
      code: 6004,
      retryable: false,
      actions: [:show_archive],
      message_key: "cms.article.archived",
      details: nil
    }

默认值：

- retryable 默认为 false；
- actions 默认为 []；
- details 默认为 nil；
- source 不作为 Error 的重复身份字段。若实现保留 source，它只能是可选 metadata，不能替代 namespace，也不能改变错误 identity。

source 与 namespace 职责重叠，因此 v2 不要求每个错误填写 source。

## 11. message_key

显式 message key 必须：

1. 使用小写路径；
2. 每段以小写字母开头；
3. 后续只允许小写字母、数字和下划线；
4. 至少包含一个点；
5. 必须以完整 namespace path 为前缀。

约定正则：

    ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$

例如：

    namespace: {:cms, :gate}
    message_key: "cms.gate.article_archived"

错误示例：

    "article_archived"
    "CMS.Gate.article_archived"
    "cms.article_archived"

最后一个格式合法，但不符合 {:cms, :gate} 的 namespace 前缀约束。

namespace path 由完整 tuple 转换：

    {:cms, :gate} -> "cms.gate"
    {:account, :collection} -> "account.collection"

`GroupherServer.ErrorCat` 还提供 `gq_format/1`，负责把已声明且定义字段一致的
`ErrorCat.Error` 转换为统一的 GraphQL 错误值，并拒绝 raw atom / raw tuple 或被篡改的
ErrorCat struct。它不根据 raw atom 猜测 message key，也不根据 code 反推 namespace。
Absinthe middleware 只负责把这个统一值放入 GraphQL response。

## 12. 对外输出

内部领域控制流和机器可读 API payload 是两个消费者：

- 领域控制流：根据 namespace + reason 决定重试、终止、补偿或提示；
- 机器 / 用户输出：根据 code、message_key、retryable、actions 生成 API 响应。

`ErrorCat.Error` 内部定义包含 namespace、reason、message_key、retryable、actions 和 details。
`ErrorCat.gq_format/1` 当前生成的普通 GraphQL 错误值保持现有协议，只输出 message 与 code：

    {
      "code": 6004,
      "message": "archived"
    }

Gate Decision 的协议响应另外输出 retryable 和 actions。reason、message_key、namespace
默认只用于领域控制流、日志和监控；只有协议明确需要诊断 context 时，adapter 才额外输出它们。

details 只用于附加上下文，不参与 definition 的身份比较。是否透出 details 由 API 层按安全边界决定。

## 13. 迁移原则

### 13.1 一次性迁移

不保留旧 API 过渡层：

1. 删除 Helper.ErrorCode、Helper.Const 中的 error code 声明和调用；
2. 为每个真实 producer 建立或补齐 catalog；
3. 把所有表示错误的 `{:error, integer}`、`{:error, reason_atom}` 和 `{:error, tuple}` 改成
   `ErrorCat.Error`；保留的 atom 只能是非错误内部状态；
4. 更新 resolver、context、formatter、API payload 和测试；
5. 删除旧模块、旧 helper 和旧测试；
6. 全仓库搜索确认不再存在旧调用方式。

历史数据不需要兼容。数据库中如果保存了旧 code，按本次迁移规则直接重建或清理，不设计运行时兼容映射。

### 13.2 code 不重分配

旧 Helper.Const 中的数字值只用于迁移盘点，不视为新 ErrorCat 的已发布 code。由于本次
不要求历史数据或旧客户端兼容，迁移时可以在目标 range 内重新分配数字值，不需要 alias、
旧 code 转译或双轨 API。

新 ErrorCat code 一旦发布，才进入不可复用规则：

- 已发布 code 不得重新分配给其他错误；
- 同一个 code 不能被两个最终 namespace 同时占用；
- 新增错误只能使用对应 range 内未占用的 code；
- reserved code 永远不能被普通错误占用。

### 13.3 迁移清单

迁移表必须逐条覆盖现有 code：

| 旧 code | 旧 reason                        | 最终 namespace                      | 最终 reason                      |                               最终 code | 状态       |
| ------: | -------------------------------- | ----------------------------------- | -------------------------------- | --------------------------------------: | ---------- |
|    4000 | :default_error_code              | {:web}                              | :default                         |                                    4000 | reserved   |
|    4001 | :custom                          | {:web}                              | :custom                          |                                    4001 | reserved   |
|    4002 | :pagination                      | {:web}                              | :pagination                      |                                    4002 | migrated   |
|    4003 | :not_exist                       | 多个 producer                       | 各自的 :not_exist                | 4303 / 4412 / 4802 / 5504 / 5601 / 6011 | split      |
|    4004 | :already_did                     | {:account, :fans}                   | :already_did                     |                                    4803 | reassigned |
|    4005 | :self_conflict                   | {:account, :fans}                   | :self_conflict                   |                                    4801 | reassigned |
|    4006 | :react_fails                     | {:account, :fans}                   | :react_fails                     |                                    4804 | reassigned |
|    4007 | :already_exist                   | {:account, :collection}             | :already_exist                   |                                    4701 | reassigned |
|    4008 | :update_fails                    | {:cms, :comment}                    | :update_fails                    |                                    4404 | reassigned |
|    4009 | :delete_fails                    | {:cms, :comment}                    | :delete_fails                    |                                    4406 | reassigned |
|    4010 | :create_fails                    | {:cms, :comment}                    | :create_fails                    |                                    4405 | reassigned |
|    4014 | :editor_data_parse               | —                                   | —                                |                                       — | removed    |
|    4301 | :account_login                   | {:account, :authentication}         | :account_login                   |                                    4301 | migrated   |
|    4017 | :service_auth                    | {:web}                              | :service_auth                    |                                    4017 | migrated   |
|    4018 | :oauth_unlink                    | {:account, :authentication}         | :oauth_unlink                    |                                    4302 | reassigned |
|    4102 | :changeset                       | {:web}                              | :changeset                       |                                    4102 | migrated   |
|    4302 | :passport                        | {:cms, :passport}                   | :passport                        |                                    4351 | reassigned |
|    4201 | :throttle_interval               | {:cms, :gate, :rate_limit}          | :throttle_interval               |                                    4201 | migrated   |
|    4202 | :throttle_hour                   | {:cms, :gate, :rate_limit}          | :throttle_hour                   |                                    4202 | migrated   |
|    4203 | :throttle_day                    | {:cms, :gate, :rate_limit}          | :throttle_day                    |                                    4203 | migrated   |
|    4401 | :create_comment                  | {:cms, :comment}                    | :create_comment                  |                                    4401 | migrated   |
|    4402 | :comment_already_upvote          | {:cms, :comment}                    | :comment_already_upvote          |                                    4402 | migrated   |
|    4403 | :comment_pin_limit               | {:cms, :comment}                    | :comment_pin_limit               |                                    4403 | migrated   |
|    4501 | :too_much_pinned_article         | {:cms, :article}                    | :too_much_pinned_article         |                                    6001 | reassigned |
|    4502 | :already_collected_in_folder     | {:account, :collection}             | :already_collected_in_folder     |                                    4702 | reassigned |
|    4503 | :delete_no_empty_collect_folder  | {:account, :collection}             | :delete_no_empty_collect_folder  |                                    4703 | reassigned |
|    4504 | :private_collect_folder          | {:account, :collection}             | :private_collect_folder          |                                    4704 | reassigned |
|    4505 | :mirror_article                  | {:cms, :article}                    | :mirror_article                  |                                    6002 | reassigned |
|    4506 | :invalid_domain_tag              | {:cms, :community}                  | :invalid_domain_tag              |                                    5506 | reassigned |
|    4507 | :undo_sink_old_article           | {:cms, :article}                    | :undo_sink_old_article           |                                    6003 | reassigned |
|    4508 | :article_comments_locked         | {:cms, :gate}                       | :article_comments_locked         |                                    4615 | merged     |
|    4511 | :archived                        | {:cms, :article} / {:cms, :comment} | :archived                        |                             6004 / 4411 | split      |
|    4513 | :invalid_blog_title              | {:cms, :article}                    | :invalid_blog_title              |                                    6005 | reassigned |
|    4514 | :already_upvoted                 | {:cms, :article}                    | :already_upvoted                 |                                    6006 | reassigned |
|    4515 | :pending                         | {:cms, :article}                    | :pending                         |                                    6007 | reassigned |
|    4516 | :article_not_found               | {:cms, :article}                    | :article_not_found               |                                    6008 | reassigned |
|    4601 | :resource_not_found              | {:cms, :gate}                       | :resource_not_found              |                                    4601 | migrated   |
|    4602 | :gate_resource_mismatch          | {:cms, :gate}                       | :gate_resource_mismatch          |                                    4602 | migrated   |
|    4603 | :doc_branch_required             | {:cms, :gate}                       | :doc_branch_required             |                                    4603 | migrated   |
|    4604 | :lifecycle_not_found             | {:cms, :gate}                       | :lifecycle_not_found             |                                    4604 | migrated   |
|    4605 | :ancestor_community_not_writable | {:cms, :gate}                       | :ancestor_community_not_writable |                                    4605 | migrated   |
|    4606 | :ancestor_article_archived       | {:cms, :gate}                       | :ancestor_article_archived       |                                    4606 | migrated   |
|    4607 | :ancestor_article_deleted        | {:cms, :gate}                       | :ancestor_article_deleted        |                                    4607 | migrated   |
|    4608 | :ancestor_article_destroyed      | {:cms, :gate}                       | :ancestor_article_destroyed      |                                    4608 | migrated   |
|    4609 | :article_archived                | {:cms, :gate}                       | :article_archived                |                                    4609 | migrated   |
|    4610 | :article_deleted                 | {:cms, :gate}                       | :article_deleted                 |                                    4610 | migrated   |
|    4611 | :article_destroyed               | {:cms, :gate}                       | :article_destroyed               |                                    4611 | migrated   |
|    4612 | :article_not_mutable             | {:cms, :gate}                       | :article_not_mutable             |                                    4612 | migrated   |
|    4613 | :comment_deleted                 | {:cms, :gate}                       | :comment_deleted                 |                                    4613 | migrated   |
|    4614 | :comment_destroyed               | {:cms, :gate}                       | :comment_destroyed               |                                    4614 | migrated   |
|    4615 | :article_comments_locked         | {:cms, :gate}                       | :article_comments_locked         |                                    4615 | migrated   |
|    4616 | :permission_denied               | {:cms, :gate}                       | :permission_denied               |                                    4616 | migrated   |
|    4617 | :unknown_action                  | {:cms, :gate}                       | :unknown_action                  |                                    4617 | migrated   |
|    4618 | :lifecycle_not_loaded            | {:cms, :gate}                       | :lifecycle_not_loaded            |                                    4618 | migrated   |
|    4619 | :scope_root_mismatch             | {:cms, :gate}                       | :scope_root_mismatch             |                                    4619 | migrated   |
|    4620 | :scope_binding_conflict          | {:cms, :gate}                       | :scope_binding_conflict          |                                    4620 | migrated   |
|    4621 | :scope_context_missing           | {:cms, :gate}                       | :scope_context_missing           |                                    4621 | migrated   |
|    4622 | :unknown_policy_mode             | {:cms, :gate}                       | :unknown_policy_mode             |                                    4622 | migrated   |
|    4623 | :scope_policy_actor_mismatch     | {:cms, :gate}                       | :scope_policy_actor_mismatch     |                                    4623 | migrated   |
|    4699 | :gate_unknown                    | {:cms, :gate}                       | :gate_unknown                    |                                    4699 | reserved   |
|    5501 | :community_root_only             | {:cms, :community}                  | :community_root_only             |                                    5501 | migrated   |
|    5502 | :passport_community_not_match    | {:cms, :community}                  | :passport_community_not_match    |                                    5502 | migrated   |
|    5503 | :one_community_only              | {:cms, :community}                  | :one_community_only              |                                    5503 | migrated   |
|    6001 | :emotion_not_allowed             | {:cms, :article}                    | :emotion_not_allowed             |                                    6009 | reassigned |
|    6002 | :thread_not_visible              | {:cms, :article}                    | :thread_not_visible              |                                    6010 | reassigned |

表中没有待 producer 审计项；同名 reason 已按 producer 分别记录落点。4301 当前继续分配给
account_login 只是目标分配结果，不构成对旧 code 的兼容承诺。

## 14. 编译和测试

### 14.1 编译阶段

执行：

    mix compile.error_cat

失败条件至少包括：

- catalog namespace 未注册；
- range 没有 catalog；
- range 重叠；
- code 越界；
- code 与 reserved code 冲突；
- namespace、reason、code 重复；
- message key 格式或 namespace 前缀不正确；
- reserved definition 不完整。

### 14.2 测试阶段

每个 catalog 都应测试：

- 构造函数返回完整 ErrorCat.Error；
- catalog 级 definition/1（例如 Articles.ErrorCat.definition(:archived)）与构造函数使用同一份定义；
- reserved definition 与普通 definition 结构一致；
- 未声明 reason 不可构造；
- declared?/2 结果正确；
- valid?/1 对 code、namespace、reason、message_key、retryable、actions 任一篡改都返回 false；
- details 改变不影响 valid?/1；
- unknown definition 产生清晰 ArgumentError，不出现 BadMapError。

全局 validator 测试：

- catalog -> range；
- range -> catalog；
- range 数值重叠；
- namespace 前缀不被误判为重复；
- 普通 code 占用 reserved code；
- reserved code 不在自己的 range；
- message key 不以 namespace path 开头。

### 14.3 完成检查

重构完成前执行：

    mix compile
    mix compile.error_cat
    mix test

并进行全仓库检查，确认不再存在：

- Helper.ErrorCode；
- Helper.Const 中的旧 error code；
- {:error, integer}；
- {:error, reason_atom}；
- 只传 reason 或 code 给 formatter 的调用；
- Web catalog 中未完成 producer 审计的 8 个通用业务错误。

## 15. 完成标准

只有同时满足以下条件，才算 ErrorCat v2 完成：

1. 所有错误都有明确 producer 和完整 namespace；
2. 所有 code 都由全局 range 或 @reserved 管理；
3. 所有 catalog 都能通过编译期双向 validator；
4. 所有业务错误都由 catalog 构造；
5. valid?/1 比较完整定义；
6. formatter 不猜测 raw atom / integer；
7. Web catalog 不再承载通用业务错误；
8. 迁移表覆盖现有全部 code，并消除所有待审计项；
9. 旧 helper、旧测试和旧调用方式全部删除；
10. mix compile、mix compile.error_cat、mix test 全部通过。
