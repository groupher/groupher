# Error Code 与 ErrorCat

## 1. 文档状态

本文记录错误码机制已经确定的目标契约。当前仓库仍可能存在旧的
`Helper.Const.error_code/1` 和 `Helper.ErrorCode.ecode/1` 实现；它们不是目标架构，
也不保留兼容层。

本文描述的是尚未完成实现的目标设计，不代表 `ErrorCat` 当前已经存在。
旧的数字 code 只作为迁移盘点，不属于新协议的历史兼容范围；切换时可以为新 catalog
重新分配 code。新 ErrorCat code 一旦发布，才进入不可复用规则。

目标是一次性切换到 `ErrorCat`：

- `GroupherServer.ErrorCat` 负责全局机制、namespace、编号区间和校验；
- 每个 context 的 `*.ErrorCat` 负责本 context 的错误定义；
- 一个错误只在所属 context 的 `ErrorCat` 中声明一次；
- 业务代码使用生成的错误构造函数，不手写 raw atom；
- 所有跨 context 的编号和定义冲突在编译阶段失败。

## 2. 现状与问题

现有机制主要是一个全局数字码表：

```elixir
enum(error_code,
  do: [
    account_login: 4301,
    pagination: 4002,
    article_archived: 4609
  ]
)
```

业务代码通过以下方式取数字码：

```elixir
Helper.ErrorCode.ecode(:article_archived)
# => 4609
```

当前链路大致是：

```text
业务模块
  -> {:error, reason}
  -> Helper.ErrorCode.ecode(reason)
  -> Helper.Const.error_code(reason)
  -> GraphQL extensions.code
```

但同一个 reason 的其他信息还散落在业务模块、Decision、GraphQL formatter、resolver
和 Gettext 中：

```text
reason
  -> code
  -> source
  -> retryable
  -> actions
  -> message_key
  -> priority
```

这样会产生以下问题：

- reason 和 code 只有同名约定，没有单一声明来源；
- 新增错误时容易漏改 known reason、message 或 action；
- domain 层、协议层和用户文案职责混在一起；
- 所有 context 共享一个无边界的 atom 命名空间；
- 数字码重复、越界和 message 缺失通常只能在运行时暴露。

## 3. 核心职责边界

```text
GroupherServer.ErrorCat
  全局机制、namespace、code range、catalog registry、编译校验

GroupherServer.CMS.Gate.ErrorCat
  CMS.Gate 的错误定义和错误构造函数

业务代码
  返回所属 context 的 ErrorCat 错误

Web adapter
  翻译 message_key，生成 GraphQL / HTTP payload
```

`GroupherServer.ErrorCat` 不拥有 CMS、Account 或其他产品领域的具体错误。
它只拥有编号所有权和注册校验机制。

## 4. 模块和目录结构

`ErrorCat` 是一个目录级机制，不是一个文件包办全部逻辑：

```text
backend/main/lib/groupher_server/error_cat.ex
backend/main/lib/groupher_server/error_cat/
├── domain.ex       # ErrorCat.Domain DSL
├── error.ex        # ErrorCat.Error 结构
├── registry.ex     # catalog registry
└── validator.ex    # 全局校验

backend/main/lib/mix/tasks/compile/error_cat.ex
  # Mix.Tasks.Compile.ErrorCat
```

领域 catalog 放在所属 context 下：

```text
backend/main/lib/groupher_server_web/error_cat.ex
backend/main/lib/groupher_server/accounts/profiles/error_cat.ex
backend/main/lib/groupher_server/accounts/collect_folders/error_cat.ex
backend/main/lib/groupher_server/cms/error_cat.ex
backend/main/lib/groupher_server/cms/gate/error_cat.ex
backend/main/lib/groupher_server/cms/gate/rate_limit/error_cat.ex
backend/main/lib/groupher_server/cms/passport/error_cat.ex
backend/main/lib/groupher_server/cms/comments/error_cat.ex
backend/main/lib/groupher_server/cms/communities/error_cat.ex
backend/main/lib/groupher_server/cms/articles/error_cat.ex
```

对应模块为：

```elixir
GroupherServer.ErrorCat
GroupherServerWeb.ErrorCat
GroupherServer.Accounts.Profiles.ErrorCat
GroupherServer.Accounts.CollectFolders.ErrorCat
GroupherServer.CMS.ErrorCat
GroupherServer.CMS.Gate.ErrorCat
GroupherServer.CMS.Gate.RateLimit.ErrorCat
GroupherServer.CMS.Passport.ErrorCat
GroupherServer.CMS.Comments.ErrorCat
GroupherServer.CMS.Communities.ErrorCat
GroupherServer.CMS.Articles.ErrorCat
```

## 5. 全局 namespace 和 code range

namespace 必须体现 context，不能只使用含义不明确的 `:gate`。

使用结构化 tuple：

```elixir
{:web}
{:cms, :gate, :rate_limit}
{:account, :authentication}
{:account, :collection}
{:cms}
{:cms, :gate}
{:cms, :passport}
{:cms, :comment}
{:cms, :community}
{:cms, :article}
```

namespace 只是错误的稳定身份标识，不要求与 catalog module 的完整模块名逐段一致。
例如 `{:account, :authentication}` 可以由
`GroupherServer.Accounts.Profiles.ErrorCat` 实现，`{:cms, :comment}` 可以由
`GroupherServer.CMS.Comments.ErrorCat` 实现。模块名遵循仓库目录和 context 组织，
namespace 遵循错误协议语义；两者通过 catalog 注册关系连接。

所有 namespace 和编号区间只在全局 `GroupherServer.ErrorCat` 声明一次：

```elixir
defmodule GroupherServer.ErrorCat do
  @ranges %{
    {:web} => 4000..4199,
    {:cms, :gate, :rate_limit} => 4200..4299,
    {:account, :authentication} => 4300..4349,
    {:cms, :passport} => 4350..4399,
    {:cms, :comment} => 4400..4499,
    {:cms} => 4500..4599,
    {:cms, :gate} => 4600..4699,
    {:account, :collection} => 4700..4799,
    {:cms, :community} => 5500..5599,
    {:cms, :article} => 6000..6099
  }

  @reserved_codes %{
    {:web} => %{
      4000 => :default,
      4001 => :custom
    },
    {:cms, :gate} => %{
      4699 => :gate_unknown
    }
  }

  @catalogs [
    GroupherServerWeb.ErrorCat,
    GroupherServer.Accounts.Profiles.ErrorCat,
    GroupherServer.Accounts.CollectFolders.ErrorCat,
    GroupherServer.CMS.ErrorCat,
    GroupherServer.CMS.Gate.ErrorCat,
    GroupherServer.CMS.Gate.RateLimit.ErrorCat,
    GroupherServer.CMS.Passport.ErrorCat,
    GroupherServer.CMS.Comments.ErrorCat,
    GroupherServer.CMS.Communities.ErrorCat,
    GroupherServer.CMS.Articles.ErrorCat
  ]
end
```

领域 catalog 不重复声明 `code_range`：

```elixir
use GroupherServer.ErrorCat.Domain,
  namespace: {:cms, :gate}
```

`code_range` 表示编号所有权，不是某个错误的属性。

`{:account, :authentication}` 和 `{:cms, :passport}` 分别拥有 `4300..4349` 与
`4350..4399`，不能使用两个相互重叠的 43xx range。`40xx`、`41xx`、`42xx`、`55xx`
和 `60xx` 也必须有明确的 namespace 和 catalog，不能只在文字说明中出现。

当前 `{:cms}` 的 `4500..4599` range 暂无 entry。它是 CMS 核心/通用错误的预留空间，
不是 catalog 遗漏；第 13 节中尚未完成 producer 审计的旧错误，后续可以在确认属于 CMS
核心后落入该 range。

旧的 `general`、`validation`、`rate_limit` 是 `Helper.Const` 的数字码分类，不是
自动生成的 context。当前目标中，Web 协议错误归 `{:web}`，CMS Gate 的限流错误归
`{:cms, :gate, :rate_limit}`；其他错误必须按实际 producer 归入 Accounts、CMS 或 Web
的具体 catalog。

namespace tuple 的前缀关系只是命名关系，不是继承或所有权关系：

```text
{:cms}            != {:cms, :gate}
{:cms, :gate}     != {:cms, :gate, :rate_limit}
```

namespace 重复只比较完整 tuple 是否相等；range 冲突只比较 numeric range 是否重叠，
不根据 namespace 前缀判断冲突。

保留 code 不通过普通 `error` entry 声明。它们在全局 `@reserved_codes` 中声明用途，
不生成业务错误构造函数：

```elixir
@reserved_codes %{
  {:web} => %{4000 => :default, 4001 => :custom},
  {:cms, :gate} => %{4699 => :gate_unknown}
}
```

Validator 必须拒绝普通 entry 占用这些数字，也必须拒绝 reserved code 重复或超出
所属 namespace range。需要返回兜底错误时，使用 `ErrorCat` 的保留错误查询 API，不能
把 `custom` 或 `gate_unknown` 当作普通领域错误重新声明。

## 6. 领域错误的单一声明

以 CMS Gate 为例：

```elixir
defmodule GroupherServer.CMS.Gate.ErrorCat do
  use GroupherServer.ErrorCat.Domain,
    namespace: {:cms, :gate}

  error :article_archived,
    code: 4609,
    retryable: false,
    actions: [:read_only_notice]
end
```

`error` 的 key 是该 context 自己定义的 error atom，并且只在这一处出现：

```elixir
:article_archived
```

这条声明是完整错误定义的唯一来源，包含：

| 字段          | 职责                                              |
| ------------- | ------------------------------------------------- |
| `reason`      | context 内部的领域语义                            |
| `code`        | 对外稳定的数字错误码                              |
| `retryable`   | 是否允许重试，默认 `false`                        |
| `actions`     | 客户端或 UI 的补救动作，默认 `[]`                 |
| `message_key` | Web 层本地化 key，默认由 namespace 和 reason 生成 |

业务模块、Decision 和 Web formatter 不再重复维护这些字段。

`source` 不属于公共 ErrorCat 字段：当前没有稳定消费者，而且它和 namespace 的子领域
职责重叠。需要错误分组时，使用完整 namespace；Gate 的内部决策可以保留自己的分类，
但不能再复制成公共 catalog metadata。

默认情况下：

```text
retryable: false
actions: []
message_key: "#{namespace_path}.#{reason}"
```

例如：

```text
{:cms, :gate} + :article_archived
  -> "cms.gate.article_archived"
```

如果多个错误需要共用一条用户文案，可以显式提供同 namespace 下的 message key，
但 key 必须以该 namespace path 加 `.` 为前缀，并符合下方格式规则。例如
`cms.gate.read_only` 合法，`gate.read_only` 和 `web.read_only` 不合法。

## 7. 业务代码如何使用

`ErrorCat.Domain` 根据声明生成错误构造函数：

```elixir
alias GroupherServer.CMS.Gate.ErrorCat, as: GateErrorCat

{:error, GateErrorCat.article_archived()}
```

构造出的错误值概念上为：

```elixir
%GroupherServer.ErrorCat.Error{
  namespace: {:cms, :gate},
  reason: :article_archived
}
```

业务代码不应该手写：

```elixir
{:error, :article_archived}
```

这样拼写错误会在调用未生成的构造函数时直接编译失败：

```elixir
GateErrorCat.article_archvied()
# undefined function / compile error
```

外部输入不能直接通过 `String.to_atom/1` 变成 error atom。动态错误必须经过
`ErrorCat` 提供的受控解析和校验 API。

## 8. ErrorCat API

对外提供的核心查询 API：

```elixir
GroupherServer.ErrorCat.definition(error)
GroupherServer.ErrorCat.code(error)
GroupherServer.ErrorCat.valid?(error)
```

`valid?(error)` 表示错误值的结构和 catalog 定义都有效，等价于校验
`declared?(error.namespace, error.reason)` 以及字段完整性；它不是另一个错误目录。

`declared?/2` 只用于校验和测试，表示某个 reason 是否在指定 namespace 的 catalog 中
声明过：

```elixir
GroupherServer.ErrorCat.declared?({:cms, :gate}, :article_archived)
```

它不是业务控制流 API。

## 9. 目标调用链

```text
CMS.Gate domain
  -> Gate.ErrorCat.article_archived()
  -> {:error, %GroupherServer.ErrorCat.Error{namespace: {:cms, :gate}, reason: :article_archived}}
  -> ErrorCat.definition(error)
  -> Web adapter
  -> Gettext.translate(message_key)
  -> GraphQL / HTTP error payload
```

内部领域控制流、机器消费者和用户展示分别依赖不同字段：

| 消费者                 | 稳定字段                 |
| ---------------------- | ------------------------ |
| 领域控制流             | `ErrorCat.Error`         |
| 日志、监控、客户端判断 | `code`                   |
| 重试和交互策略         | `retryable`、`actions`   |
| Web 展示               | `message_key` 的翻译结果 |

`namespace` 是 catalog 的内部身份，默认只进入日志和监控，不放进 GraphQL / HTTP
对外 payload；numeric `code` 已经是全局唯一的机器标识。只有协议明确需要诊断 context
时，adapter 才额外输出 namespace。

## 10. Decision 和 priority

如果一次 Gate 检查产生多个错误：

```text
多个 ErrorCat.Error
  -> 去重
  -> 按 Gate 自己的 priority 选择 primary error
  -> 从 ErrorCat 读取完整定义
```

`priority` 是 Gate 的决策规则，不是公共错误字段，也不能放进全局 ErrorCat 的通用
定义中。Gate 可以维护自己的 priority，但只能引用已声明的错误构造函数或 reason。

## 11. 编译期校验

校验分为两层。

### 11.1 单个 catalog 编译时

`ErrorCat.Domain` 在当前领域模块编译时校验：

- reason 不重复；
- 必填字段存在；
- 字段类型正确；
- code 是整数；

这里不读取 `GroupherServer.ErrorCat.@ranges`。Elixir/Mix 可能并行编译 catalog
和全局模块，单个 catalog 编译时不能假定全局 module attribute 已经可用。
namespace、range 和跨 catalog 的校验全部推迟到全局阶段。

### 11.2 所有 catalog 编译完成后

通过 `Mix.Tasks.Compile.ErrorCat` 在 `mix compile` 中统一执行：

```elixir
# mix.exs，概念示例
def project do
  [compilers: Mix.compilers() ++ [:error_cat]]
end
```

`error_cat` compiler 必须排在普通 Elixir compiler 之后，确保所有 catalog module
已经编译完成，再读取它们的 entries 执行全局校验。

```text
加载所有 catalog
  -> 校验全局 namespace
  -> 校验所有 code range
  -> 校验所有 error code
  -> 校验保留 code
```

必须在编译阶段失败的情况包括：

- namespace 重复；
- 两个 namespace 的 code range 重叠；
- numeric code 被多个错误使用；
- error code 超出所属 namespace 的 range；
- 保留 code 被普通错误占用；
- catalog entry 缺少必填字段；
- `message_key` 格式不正确。

例如，下面是一个故意错误的配置：

```elixir
{:cms, :gate}      => 4600..4699
{:cms, :community} => 4650..4750
```

两个 range 重叠，`mix compile` 必须失败。

数字 code 也必须全局唯一，即使 namespace 不同：

```text
{:cms, :gate}.article_archived -> 4609
{:account, :authentication}.login_failed -> 4609
```

这种情况同样必须失败。

同名 reason 在不同 namespace 中可以存在，因为完整错误身份是：

```text
namespace + reason
```

但 numeric code 仍然不能重复。

`message_key` 必须符合：

```text
^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$
```

默认 key 为 `namespace` 各 segment 用 `.` 连接后，再连接 `reason`，例如：

```text
{:cms, :gate} + :article_archived
  -> cms.gate.article_archived
```

显式覆盖的 key 也必须使用相同的 segment 和分隔符规则。
此外，显式 key 必须以 `namespace_path.` 开头；对 `{:cms, :gate}` 而言，合法前缀是
`cms.gate.`。

## 12. 数字码规则

数字码按 context 或 subdomain 分配区间：

```text
4000..4199  Web protocol
4200..4299  CMS Gate rate limit
4300..4349  Account authentication
4350..4399  CMS Passport
4400..4499  CMS Comment
4500..4599  CMS core
4600..4699  CMS Gate
4700..4799  Account collection
5500..5599  CMS Community
6000..6099  CMS Article
```

规则：

- range 只在全局 `GroupherServer.ErrorCat` 声明；
- code 必须在所属 range 内；
- numeric code 全局唯一；
- 新 ErrorCat code 发布后不得重新分配给其他错误；
- `default`、`custom`、`gate_unknown` 等保留 code 不能被普通业务错误占用。

旧 `Helper.Const` 中的数字值不视为新 ErrorCat 的已发布 code。由于本次不要求历史
数据或旧客户端兼容，迁移时可以在目标 range 内重新分配数字值，也不需要 alias、旧 code
转译或双轨 API。

## 13. 现有错误清单的迁移落点

以下清单盘点 `backend/main/lib/helper/const.ex` 当前的 reason，并给出新 catalog
的目标 namespace。表中的旧 code 只用于定位现状，迁移时不要求保留。
“按 producer 拆分”不是一个 namespace，而是明确的迁移待办：必须逐个检查调用点，
不提供默认的 `{:web}` 归属，避免把 Accounts 或 CMS 的领域错误误归到 Web。

| 目标 namespace                | 当前 reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 旧 code 盘点                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `{:web}`                      | `pagination`、`changeset`、`service_auth`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `4002`、`4102`、`4017`                                     |
| 按 producer 拆分（迁移待办）  | `not_exist`、`already_did`、`self_conflict`、`react_fails`、`already_exist`、`update_fails`、`delete_fails`、`create_fails`、`editor_data_parse`                                                                                                                                                                                                                                                                                                                                                                                                                            | `4003..4010`、`4014`                                       |
| `{:cms, :gate, :rate_limit}`  | `throttle_interval`、`throttle_hour`、`throttle_day`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `4201..4203`                                               |
| `{:account, :authentication}` | `account_login`、`oauth_unlink`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `4301`、`4018`                                             |
| `{:cms, :passport}`           | `passport`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `4302`                                                     |
| `{:cms, :comment}`            | `create_comment`、`comment_already_upvote`、`comment_pin_limit`、`require_questioner`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `4401..4403`、`4509`                                       |
| `{:account, :collection}`     | `already_collected_in_folder`、`delete_no_empty_collect_folder`、`private_collect_folder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `4502..4504`                                               |
| `{:cms, :community}`          | `invalid_domain_tag`、`community_root_only`、`passport_community_not_match`、`one_community_only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `4506`、`5501..5503`                                       |
| `{:cms, :article}`            | `too_much_pinned_article`、`mirror_article`、`undo_sink_old_article`、`archived`、`invalid_blog_title`、`already_upvoted`、`pending`、`article_not_found`、`emotion_not_allowed`、`thread_not_visible`                                                                                                                                                                                                                                                                                                                                                                      | `4501`、`4505`、`4507`、`4511`、`4513..4516`、`6001..6002` |
| `{:cms, :gate}`               | `resource_not_found`、`gate_resource_mismatch`、`doc_branch_required`、`lifecycle_not_found`、`ancestor_community_not_writable`、`ancestor_article_archived`、`ancestor_article_deleted`、`ancestor_article_destroyed`、`article_archived`、`article_deleted`、`article_destroyed`、`article_not_mutable`、`comment_deleted`、`comment_destroyed`、`article_comments_locked`、`permission_denied`、`unknown_action`、`lifecycle_not_loaded`、`scope_root_mismatch`、`scope_binding_conflict`、`scope_context_missing`、`unknown_policy_mode`、`scope_policy_actor_mismatch` | `4601..4623`、另有重复旧 code `4508`                       |

当前 `article_comments_locked` 在旧 `Helper.Const` 中同时出现为 `4508` 和 `4615`。
它不能作为两个 catalog entry 迁移；目标只保留一条 Gate 错误定义，旧的重复数值不保留。
`default`（`4000`）、`custom`（`4001`）和 `gate_unknown`（`4699`）属于保留/兜底编号，
不是普通业务错误。

这张表是迁移的 context 落点清单，不是历史 code 兼容表。真正实现时，各调用方必须改用
目标 catalog 的生成构造函数；未列入表中的新错误不能继续扩展 `Helper.Const`。

## 14. message 与本地化

ErrorCat 只保存稳定的 `message_key`，不保存中文或英文文案：

```text
ErrorCat
  {:cms, :gate} + :article_archived
  -> "cms.gate.article_archived"

Web / Gettext
  "cms.gate.article_archived"
  -> 当前内容处于只读状态。
```

因此：

- domain 层不依赖具体语言；
- GraphQL、HTTP 和其他 adapter 可以采用不同展示策略；
- 客户端依赖 numeric code 和 actions，不依赖 message 文本。

## 15. 测试与 CI

除 `mix compile` 的编译校验外，还需要测试：

- 所有 catalog 都能被完整遍历；
- 所有 catalog entry 都能通过 `definition/1` 查询；
- 所有对外错误都有对应 Gettext msgid；
- 已发布 code 的 snapshot 没有被静默改写；
- GraphQL / HTTP payload 正确输出 `code`、`retryable` 和 `actions`。

## 16. 明确不做的事情

- 不保留 `Helper.ErrorCode` 兼容层；
- 不在全局 ErrorCat 中维护所有业务 error atom；
- 不在领域模块中重复声明 code range；
- 不让业务代码直接手写 raw error atom；
- 不把中文或英文文案放进 ErrorCat；
- 不把 Gate 的 priority 变成公共错误字段；
- 不把所有业务异常强行建模成同一种错误。
