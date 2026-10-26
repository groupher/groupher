# ErrorCat 全链路收口

> 状态：E2–E4 已有定点实现与合同测试；E1 的 Gate/Article binding/Command/六类 Outbox producer 迁移在当前源码中已实现，仍需完整回归验收。对六个 worker 的源码复核未发现裸 `{:error, :reason_atom}` 返回；Article/Comment/Community/Press 与 Asset/Interaction 都调用所属 catalog。Passport 测试断言内部错误 4353，GraphQL 公开错误断言 `TOKEN_INVALID`；当前测试中未发现旧的 4351 断言。全量测试尚未通过，不能据此宣布 E1 全链路验收完成。middleware-chain 合同测试按生产顺序直接运行 FrontDesk、Passport、GQLResultFmt、ChangesetErrors、GeneralError，并覆盖 Pagi mismatch；它验证中间件错误形状与输出，不启动完整 GraphQL server。已完成项与验证命令见 [基础模块执行记录](./backend-foundation-cleanup-and-codedoc.md#6-2026-10-22-实施与验证记录)。

沿用 [ErrorCat 当前架构](../architecture/error-cat.md) 和 [V2 合同](../infra/diagnostics/error-catalog-v2.md)，
不新建错误框架、不新增通用兼容层。目标是让 producer、领域传播、Gate/Command、transport 和调用方遵守同一错误合同。

## 1. 权威链路

```text
Repo / 外部适配器 / 领域校验
        |
        v
有业务上下文的 owner
  -> 在所属 ErrorCat 声明、构造错误
        |
        v
{:error, structured_error}
  -> Command / Workflow / Gate：按领域身份分支，保留原始语义
        |
        +-> Job：区分重试、终止、补偿
        |
        v
transport adapter / formatter
  -> 校验 catalog 定义
  -> 映射 GraphQL / HTTP 协议
        |
        v
客户端按正式协议处理
```

Catalog 构造函数仍直接返回结构化 Error；业务函数返回 tagged tuple。
Ecto changeset、Repo rollback、框架 callback 的专用返回形状按现有合同处理，不机械替换全部 atom/tuple。

## 2. 已确认的缺口

| 位置/模式                            | 当前问题                                                              | 收口方向                                                             |
| ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ErrorCat.Domain.normalize_result/1` | fallback 原样返回值，不会把任意裸 atom 变成合法领域错误               | 修复 producer；文档与测试说明它不是猜测错误归属的万能转换器          |
| `ErrorCat.Workflow.gq_format/1`      | 预格式化 `[message: ..., code: ...]` 分支直接通过，绕开结构化错误校验 | 迁移调用方，删除该绕行入口；formatter 不接受任意数字 code            |
| FrontDesk middleware                 | 部分路径将所有加载失败覆盖成 not_exist                                | 保留已结构化的错误；只对真实缺失或明确的隐藏存在性策略映射 not-found |
| 通用 ORM/custom 包装                 | `custom(details.reason = not_exist)` 等丢失真实领域身份               | 由掌握业务语义的 owner 映射正式 reason，通用 ORM 不猜测资源 catalog  |
| 裸 atom 错误传播                     | formatter 链可能原样放过，形成出口不完整                              | 逐调用链迁移 producer 和 consumer，明确处理未知/无效错误             |

例：查询超时不能变成“文章不存在”，否则调用方可能终止重试或删除本地缓存；参数错误也不应伪装成不存在。
公开接口若为防止资源枚举而隐藏拒绝原因，必须由明确的 Gate/transport 合同执行，不得把任意失败都隐藏。

## 3. 不混入本次整改的协议变更

V2 明确规定普通 GraphQL 错误输出 message/code，Gate Decision 另外输出 retryable/actions。
两者差异本身不是缺陷。本次不擅自扩展所有 GraphQL payload，也不把内部 details 原样公开。
若业务调用方需要更多字段，作为独立协议变更设计并同步调用方，而不是在 formatter 中临时加字段。

稳定业务错误必须有正式 reason；不可用 custom 长期承接。未知基础设施失败由确定的边界处理，
保留诊断信息并输出已声明的安全协议错误，不用 not-found 掩盖，也不让无效 code 获得信任。

## 4. 实施批次

1. 按实际问题链列 producer、传播点、formatter 和 consumer，补齐缺失 catalog 定义与回归场景。
2. 按领域迁移裸错误、通用 custom/not-found 和控制流判断；producer/consumer 同批更新。
3. 统一 FrontDesk、Resolver、middleware、Gate Decision 的出口映射，删除预格式化绕行及旧适配分支。
4. 补 lint/测试防止新增裸业务错误、未声明 code 和任意错误覆盖；区分业务错误与框架合法形状。

不建立凭 code 反推领域或凭 atom 猜测 namespace 的中间层。已有成功结果、分页协议和 Command identity 不改变。

## 5. 验收

- catalog 的 namespace/range/reason/code 定义一致；伪造、未声明或被篡改的错误不能通过 formatter。
- 同一失败从领域入口到 GraphQL/Job 保持正确身份；不存在、拒绝、参数错误、冲突、可重试失败分别验证。
- `gq_format` 拒绝任意预格式化 keyword；正常声明错误和合法 changeset/Decision 路径仍有测试。
- 运行真实 middleware 链的测试，不能只证明单独 formatter 可用；包含 FrontDesk 加载失败场景。
- Job 的 retry/terminal/compensation 使用明确错误语义，不因统一格式而改变业务恢复行为。
- 静态检查只证明可检查的语法边界，不声称覆盖所有错误语义；不保留兼容双协议。

## 6. 可执行批次与错误迁移表

下列源码路径相对 `backend/api/lib/`；测试路径 `test/...` 相对 `backend/api/`，脚本 `scripts/...` 相对仓库根目录。新 reason 在对应 catalog 的已分配 range 内取未占用 code，运行 validator；
禁止按文件顺序随意分配或复用已有不同语义 code。数值分配是实现步骤，不需要再次讨论错误归属。

### E1：修 producer，保持语义

| producer                                                                                                     | 当前输入/失败                                                                                            | 目标与 consumer                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupher_server/front_desk.ex` user mode                                                                    | `:unsupported_user_read_mode`                                                                            | 新增 `Accounts.front_desk_user/2 -> Accounts.FrontDesk.user/2 -> Accounts.FrontDesk.Query.user/2`，由 Query 校验 mode/view；在 `groupher_server/accounts/profiles/error_cat.ex` 新增 `invalid_user_read_options`，明确复用现有 `{:account, :authentication}` namespace 和 4300..4349 range，分配未占用 code；具体合同见下文。Root FrontDesk.user/2 仅委托并传播 |
| `groupher_server/cms/front_desk/article.ex`                                                                  | `:stable_article_not_found`                                                                              | 使用现有 `Articles.ErrorCat.article_not_found/1`；FrontDesk middleware 不二次覆盖                                                                                                                                                                                                                                                                               |
| `groupher_server/cms/articles/query.ex` branch helper                                                        | `:article_binding_not_found` 混淆 branch 与 Community                                                    | 随 F1 拆分：Docs branch not-found、Communities not_exist、Gate resource mismatch；Moderate 的资源读取随 F1 迁移，审核语义保持冻结，不保留旧 Query helper                                                                                                                                                                                                        |
| `groupher_server/cms/insights/query.ex`                                                                      | `:unsupported_artiment`、`:insights_not_authorized`                                                      | G3 删除 legacy 分支；不支持类型归 Articles 输入错误，权限失败归 Gate permission_denied；不得靠 UUID 分流制造 resource_not_found                                                                                                                                                                                                                                 |
| `groupher_server/cms/gate/access/query.ex`                                                                   | `:gate_transaction_required`、`:gate_stage_required`、`:article_binding_context_required`                | Gate catalog 声明同义正式 reason；返回结构化错误，保留 transaction/stage 拒绝；同步 pipeline runner 和 Decision 测试                                                                                                                                                                                                                                            |
| Articles Commands `create_stable_draft`、`discard_draft`、`trash`、`publish`、`state_change`、`comment_lock` | invalid_actor、缺少 binding context、缺失资源等裸错误                                                    | 身份拒绝使用 Gate 错误；输入/binding 语义归 Articles；缺失 Article 用现有 article_not_found。检查 else/case，不能将下游任意错误统一改为 not-found                                                                                                                                                                                                               |
| Comments Commands `create` 及 F1 涉及的 replay                                                               | 缺少 parent binding、恢复结果不存在                                                                      | context 缺失归所属领域正式 reason；replay payload 缺失继续用 CMS.command_result_unavailable，不伪装业务对象原本不存在                                                                                                                                                                                                                                           |
| `groupher_server/cms/outbox/workflow/{article,comment,community,press,asset,interaction}.ex`                 | projection/target/actor 缺失、无效 payload、未知 event，以及 Asset 的 unsupported_asset_cleanup_resource | owner catalog 正式 reason；未知 event/无效 payload 为 terminal，瞬时外部错误保留 retry；目标删除只有明确 obsolete 证据才 no-op，不能一律吞错                                                                                                                                                                                                                    |
| `helper/utils/utils.ex` 的 done/normalize_error、ORM 业务边界调用方                                          | custom 包装 reason atom、nil                                                                             | 在当前整改调用链的 owner 显式 case 映射；通用 helper 不猜 catalog。其余调用链报告后逐批迁移，不将整个 Helper.done 全局改义                                                                                                                                                                                                                                      |

Accounts read-options 的实施合同（本批不拆分现有 Profiles catalog）：

- 修改 `groupher_server/accounts.ex`，新增 `front_desk_user(ref, opts)` 委托；
  修改 `groupher_server/accounts/front_desk.ex`，新增 `user(ref, opts)` 委托；
  修改 `groupher_server/accounts/front_desk/query.ex`，实现 `user/2` 的参数校验。
- 仅接受 `mode: :public | :internal` 与 `view: :default`，默认 public/default；合法选项调用既有 Query.user/1，
  保持缓存、ID/login 与缺失资源行为。保留现有 /1 合同；不能令 /1 和 /2 互相递归。
- 非法 mode/view 返回 `{:error, Accounts.Profiles.ErrorCat.invalid_user_read_options()}`；Root FrontDesk 不自行构造错误。
- 明确复用 authentication range：当前 Profiles catalog 已同时拥有 profile/session/not_exist，本批沿用这个已注册 owner，
  不新建 Accounts 全局兜底 catalog 或启动 namespace 重命名。新 reason 表达读取选项错误，不代表登录失败；不复用 account_login code。
- 在 `test/groupher_server/accounts/front_desk/front_desk_test.exs` 对 root /2、Accounts facade /2 和 /1 既有行为做对照；
  断言非法 mode、非法 view 的 namespace/reason，合法 internal/public 结果不变；错误 code 通过 registry 校验。

`CMS.Command.Confirmation` 的 codec 错误需区分内部解析 token 与外部业务错误：内部 token 可在 decode 边界映射为
command confirmation 错误，不能让 token 穿透 Context/transport；不要因本表扫描到 atom 就改坏 codec 控制流。

### E2：消除两个数字 code 绕行口

1. `groupher_server/error_cat/workflow.ex` 删除 `gq_format({:error, [message: ..., code: ...]})` 直接通过分支，收窄 spec；
   继续校验结构化 Error 定义，未声明/篡改值保持编程错误拒绝，不能反查整数 code“修复”错误身份。
2. `helper/utils/utils.ex` 的 `handle_absinthe_error/3` 还有 string/tuple + 任意 code 分支，是另一个独立绕行口。
   新建 `groupher_server_web/error_response.ex`，模块 `GroupherServerWeb.ErrorResponse`：
   `format_error(error_or_decision)` 返回合法 Absinthe `{:error, keyword}`；`put_error(resolution, error_or_decision)` 只校验并将 typed Error/Decision 写入 resolution，由后续 formatter 序列化。
   两者只接受经过验证的 Error/Decision；changeset 继续由 ChangesetErrors 解析，再构造声明的 Web 错误，不把原始 changeset 塞入该接口。
   FrontDesk/Passport 与下面的所有 caller 同批迁移，不再新建第二个 formatter。
   完整调用方清单（位于 `groupher_server_web/middleware/`）：`front_desk.ex`、`passport.ex`、`authorize.ex`、
   `body_bag_trust.ex`、`changeset_errors.ex`、`conditional_service_scope.ex`、`debug.ex`、`delegated_scope.ex`、`service_scope.ex`、`publish_throttle.ex`。
   每个 raw message/code 在其真实 producer 或 Web catalog 转为正式错误；不能由 ErrorResponse 猜测错误归属。
   在仓库根目录执行 `rg -n 'handle_absinthe_error' backend/api/lib`，逐项核查 import、远程调用、delegate 和 arity；
   lint 加入旧 overload 引用负例（包括 alias），确认迁移范围没有新增 caller。
   迁完全部 transport callers 后删除旧 string/tuple/code overload，不只修 gq_format。
3. `groupher_server_web/middleware/gql_result_fmt.ex` 去掉把任意 message/code keyword 当领域错误的识别分支；调用 `ErrorResponse.format_error/1`，Decision 输出前由同一 owner 校验其 primary Error。`ErrorResponse.put_error/2` 只校验并把 typed Error/Decision 放入 Absinthe resolution，不提前序列化；schema middleware 顺序中的 `GQLResultFmt` 或 `GeneralError` 负责最终序列化。现有 public_error/graphql_error 逻辑迁入 ErrorResponse：Decision payload 由 `format_error/1` 的 Decision 分支组装，
   对外仅保留 `format_error/1`、`put_error/2`，不新增兼容的 public_error/graphql_error 转发函数。
   `GQLResultFmt` 按 Error/Decision struct 分派到 ErrorResponse，changeset 保持交给 ChangesetErrors；
   原 `formattable_domain_error?/1` 整体删除（包括 keyword 放行），不在新 owner 中重建 keyword 兜底。
   原 `GQLResultFmt.domain_extensions/2` 的 Pagi mismatch 投影逻辑迁到 `groupher_server_web/error_response.ex`，收口为接收已验证 `%Error{}` 的 private `domain_extensions/1`，由 `ErrorResponse.format_error/1` 调用；不要保留旧 `/2` 入口或让调用方传入任意 message/code。
   先校验 Error，再仅对 namespace `{:pagi}`、reason `:config_mismatch` 且 `details.mismatch` 为 `:revision` 或 `:api`
   输出字符串 mismatch；其他值只输出 code，任意 details 不透出。Decision 分支继续按既定协议输出 actions/retryable。
   `test/groupher_server/cms/gate/decision_test.exs` 删除对 `GQLResultFmt.public_error/1`、`GQLResultFmt.graphql_error/1` 的直接调用及 alias，保留领域 Decision 断言；
   其两组 transport 断言迁到新增 `test/groupher_server_web/error_response_test.exs`，并在该文件覆盖 Pagi `config_mismatch` 的受限扩展（`:revision`/`:api` 输出白名单字符串，其余值与 details 不外泄）。测试通过 `ErrorResponse.format_error/1` 的最终 payload
   验证中文 message、code、actions、retryable，不测试 private helper。删除原方法前扫描全部生产及测试引用，不留下孤儿调用。
4. `groupher_server_web/middleware/general_error.ex` 不再作为业务错误的第二 formatter。保留真正框架错误的安全适配并明确来源；
   无效领域值进入已声明 Web unexpected-error 路径并记录诊断，不把原始 details/异常栈输出给客户端。
5. 对 errors 数组逐项处理；不得仅支持单错误列表，导致多个错误绕过校验。已格式化的 transport payload 不再交回领域 formatter。

### E3：FrontDesk 错误传播

修改 `groupher_server_web/middleware/front_desk.ex` 的 fetch_community/article/article_editor/comment/user 与 invalid-input 分支：
失败将结构化错误交给统一 transport adapter；只对实际身份缺失做 owner not-found。
`groupher_server_web/middleware/passport.ex` 的错误输出同步迁移，但保留其既定权限判定，不因错误重构改变准入策略。Passport 预检查拒绝通过 `CMS.passport_error_cat_permission_denied/1` 输出 `{:cms, :passport}` 的 code 4353；领域 Gate 拒绝仍使用 `{:cms, :gate}` 的 code 4616。
明确隐藏存在性的场景由 Gate 合同产生对应结果；middleware 不把 timeout、invalid context、permission denial 一律覆盖。

```text
FrontDesk 查询失败
  -> article_not_found    -> 原样映射正式 code
  -> invalid input       -> 输入错误，不伪装不存在
  -> Gate Decision       -> code + retryable/actions（现有协议）
  -> infrastructure error -> 边界安全错误 + 内部诊断，不公开原始异常
```

### E4：验收文件与通过条件

- 扩展 `test/groupher_server/error_cat_test.exs`：有效 Error、伪造 code、篡改 namespace/reason、keyword code 绕行被拒绝。
- 扩展 `test/groupher_server_web/middleware/general_error_test.exs`；新增
  `test/groupher_server_web/middleware/errorcat_chain_test.exs`，真实执行 middleware 顺序，覆盖 FrontDesk 与 Passport、单条/多条错误、changeset、Decision、普通 Error。
- 新增 FrontDesk 错误传播场景：缺失/错误参数/准入拒绝/基础设施失败不能全部得到同一个 not-found code。
- 保留 Pagi `config_mismatch` 的受限 `mismatch` 输出和 Gate Decision 的 actions/retryable；普通错误仍 message/code。
- 新增 `test/groupher_server_web/error_response_test.exs`：Pagi mismatch 的 :revision/:api 输出 "revision"/"api"；
  缺失、未知 atom、字符串等非白名单值均不输出 mismatch；无关 details 不泄漏；伪造 Error 在投影前被拒绝。
  同时覆盖迁入的 Decision transport 断言与普通 Error；middleware chain 测试验证 Pagi 扩展穿过完整链后仍保留。
- 扩展 Gate pipeline guard 测试及 Article/Comment/Community/Press/Asset/Interaction 六类 Outbox terminal/retry 测试，证明错误结构变化未破坏恢复行为。
- 扩展 `scripts/check-elixir-module-style.mjs` 或同类边界 lint：业务源码不得新增预格式化 code、禁止捕获任意错误转 not-found 的已知模式；
  正反例区分框架返回、codec 内部 token 与领域错误。静态扫描不能证明所有 catch-all 的语义。

```sh
# backend/api
mix test test/groupher_server/error_cat_test.exs test/groupher_server_web/middleware/general_error_test.exs
# E4 完整 transport chain 与相关 facade 回归
mix test test/groupher_server_web/middleware/errorcat_chain_test.exs test/groupher_server_web/error_response_test.exs test/groupher_server/cms/gate/decision_test.exs test/groupher_server/accounts/front_desk/front_desk_test.exs
mix test test/groupher_server/cms/gate/check_in_transaction_test.exs test/groupher_server/cms/outbox_test.exs
mix compile --warnings-as-errors
mix lint.style
```

E1 先于严格出口 E2；E2/E3 必须同批保证 callers 不被留在旧协议。退出条件是本表涉及的运行时裸错误/keyword 绕行清零、
错误传播场景通过；不是“registry validate 通过”就宣布全链路完成。Audit/Sentinel 的 producer 本轮不迁移。

## 2026-10-22 Review 修复与剩余范围

- Passport 预检查通过 CMS facade 返回原 Passport 错误 4353，middleware-chain 测试同时核对序列化前的 namespace 和最终 code。
- Asset 的 `unsupported_asset_cleanup_resource` 迁到 Assets catalog（5604）；Interaction 的 target-not-found、target-invalid、actor-not-found、actor-invalid 迁到 Interactions catalog（4913–4916）。Outbox 继续按现有 attempt/exhaustion 协议处理，未更改 retry/terminal 策略；新增 worker 测试覆盖结构化错误、retrying 与 exhausted failed。
- E1 的六类 Outbox producer 已使用各自 ErrorCat reason；静态复核未发现裸 error atom。`outbox_test.exs` 现在逐个断言 Article/Comment/Community/Press/Asset/Interaction worker 持久化各自预期的终态 code（6024/4418/5538/4544/5604/4914）；测试在第 1 次 attempt（max_attempts=5）运行：五个不可重试 ErrorCat 由 `:classify` 立即进入终态；Interaction 的可重试错误先进入 retrying，到第 5 次才进入终态，并分别断言 owner code。N3 终态 fencing 不替代 E1 其余迁移表条目与全量回归验收。
