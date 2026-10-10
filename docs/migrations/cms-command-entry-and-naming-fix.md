# CMS Command 入口、用例命名与 Elixir block style 修复

> 状态：implemented（2026-10-05）
>
> 范围：修正 CMS 多入口、领域 facade、concrete use case 与 `CMS.Command` 的概念边界；统一
> Command use-case 模块命名；禁止折行的 inline `do:`。本文同时记录已完成迁移及其验收结果。

相关长期合同：

- [CMS Command](../architecture/cms-command.md)：Receipt、Confirmation、事务与恢复语义；
- [CMS 多入口与领域用例边界](../architecture/cms-multi-entry-boundary.md)：transport、facade 与 use case 边界；
- [CMS Command V3](../architecture/cms-command-v3.md)：Confirmation 与 result builder 边界；
- [命名规则](../rules/naming.md)：仓库级稳定术语。

## 1. 问题摘要

当前代码的业务调用层级总体正确，但术语与命名使三类不同职责看起来像同一个 “Command 入口”：

```text
GraphQL Resolver / future CLI / MCP / Agent
  -> CMS public facade
  -> concrete domain use case
  -> CMS.Command when retry-safe execution is required
```

实际统一对外业务入口是 `CMS.Articles`、`CMS.DocTree`、`CMS.Comments` 等 facade。
`CMS.Command` 不统一领域 API；它只统一需要抵抗 ambiguous commit 的执行协议。

同时，当前 use-case 命名存在三类问题：

1. 模块与函数完全重复，例如 `Commands.Publish.publish`；
2. 模块只是模糊容器，例如 `Commands.Node` 同时承载 create、update、delete、duplicate、move；
3. 模块名称与实际动作不匹配，例如 `Commands.Publish.move_doc_to_draft`。

此外，仓库目前没有规则禁止 formatter 折行后的 inline `do:`：

```elixir
def publish(article, actor, opts),
  do: Commands.Publish.publish(article, actor, opts)
```

当前基线不是零：`backend/api/lib` 口径已发现 1,063 处折行 inline `do:`，分布在 239 个文件；Credo
还覆盖 `test/` 等 first-party 路径，当前测试代码约再增加 14 处、9 个文件。精确总量必须在实施前按
Credo 实际 include/exclude scope 重新计算，但已经足以排除“先启用失败级 Credo、再顺手修受影响文件”
的方案。Hard check 上线前必须先完成独立、机械化的存量清扫。

这三类问题需要在同一轮修复中收口，否则重命名后仍会保留含混的层级和不一致的代码形状。

实施时在当时工作树的 `backend/api/lib` 与 `backend/api/test` 上重复执行 AST audit，共识别并转换
1,033 处、239 个文件；数量与评审快照的差异来自同期工作树变化。迁移后相同 audit 为 0。

## 2. 决策摘要

### 2.1 多入口共享 facade，不直接共享 `CMS.Command`

冻结以下调用关系：

```text
Transport adapter
  GraphQL Resolver / CLI / MCP Tool / Agent Tool
  -> 解析协议参数与认证上下文

CMS public facade
  CMS.Articles / CMS.DocTree / CMS.Comments
  -> 所有 transport 共享的唯一业务 API

Concrete use case
  Commands.<BusinessAction>.execute
  -> Gate / Lifecycle / version / 领域写入与结果构造

Reliable execution boundary
  CMS.Command.execute
  -> command identity / Receipt / transaction / Confirmation recovery
```

因此不再使用“`CMS.Command` 是 resolver、CLI、Agent 的统一入口”这一表述。准确术语为：

```text
CMS facade       统一调用什么业务动作
CMS.Command      统一需要幂等恢复的动作如何可靠执行
```

Resolver、CLI、MCP 或 Agent 不得直接构造 `%CMS.Command{}`、定义 `action` callback 或选择
Confirmation codec。否则 transport 会获得 Gate、Lifecycle、写入顺序和结果恢复的所有权。

### 2.2 Public write facade 只委托 concrete use case

Public write facade 不判断是否进入 Receipt 协议，也不直接调用 Writer、TargetDraft 等 use-case
内部 primitive：

```elixir
def publish(article, actor, opts) do
  Commands.Publish.execute(article, actor, opts)
end
```

`Commands.Publish.execute/3` 是 Article Publish 的唯一用例入口。它负责根据最终合同选择：

```text
存在 commandId
  -> CMS.Command.execute

允许 one-shot 且 commandId 缺失
  -> 同一个 use case 内执行 one-shot 路径
```

是否继续允许 one-shot 不是本次纯命名迁移可以默认决定的事项。后续必须逐项审计外部 mutation：

- 若需要 ambiguous-commit 保护，transport 合同必须要求稳定 `commandId`；
- 若无需恢复原结果，可以保留 one-shot；
- 两条路径必须返回同一种 canonical business result；
- facade 不得根据 `commandId` 自己选择不同领域实现。

### 2.3 一个 use-case 模块只表达一个完整业务动作

统一规则：

```text
CMS.<Domain>.<business_action>(...)
  -> Commands.<BusinessAction>.execute(...)
```

- facade 函数使用产品/业务动作名；
- use-case 模块使用 facade 业务动作名的 PascalCase 形式；
- use-case 唯一公共执行函数使用 `execute`；
- 一个模块只负责一个完整业务动作；
- 私有 helper 使用具体阶段或数据含义命名；
- 禁止 `Publish.publish`、`Create.create` 等模块名与函数名重复；
- 禁止用 `Node`、`Trash`、`Publish` 作为多个不同动作的容器。

`CMS.Command.execute/2` 不违反该规则：`Command` 是执行机制名，`execute` 是机制动作；它不是
`Commands.Publish.publish` 这种同义重复。

## 3. 当前问题清单与目标命名

以下清单冻结本次 Command-adjacent 修复范围，不声称已经列出整个 CMS 的所有 facade/primitive bypass。
Phase 1 必须重新审计 Articles、DocTree 以及直接进入 Article Command 的 Assets 写路径；其他领域现存的
简单 Writer facade 由独立 facade-directory 审计处理，不能因为未列在本文就被描述为已经符合长期边界。

### 3.1 Articles

| Facade 业务动作              | 当前调用                                    | 目标调用                                    |
| ---------------------------- | ------------------------------------------- | ------------------------------------------- |
| `create`                     | `Commands.Create.create`                    | `Commands.Create.execute`                   |
| `update`                     | `Commands.Update.update`                    | `Commands.Update.execute`                   |
| `publish`                    | `Commands.Publish.publish`                  | `Commands.Publish.execute`                  |
| `CMS.Assets.replace_use`     | `Articles.Commands.ReplaceAssetUse.replace` | `Assets.Commands.ReplaceUse.execute`        |
| `trash`                      | `Commands.Trash.trash`                      | `Commands.Trash.execute`                    |
| `restore_trashed`            | `Commands.Trash.restore`                    | `Commands.RestoreTrashed.execute`           |
| `permanently_delete_trashed` | `Commands.Trash.permanently_delete`         | `Commands.PermanentlyDeleteTrashed.execute` |
| `create_stable_draft`        | direct `TargetDraft.create`                 | `Commands.CreateStableDraft.execute`        |
| `update_draft`               | direct `TargetDraft.update`                 | `Commands.UpdateDraft.execute`              |
| `discard_draft`              | direct `TargetDraft.discard`                | `Commands.DiscardDraft.execute`             |

Article 使用 `RestoreTrashed`，DocTree 使用 `RestoreTrashItem`，不是同一源动作的任意分叉：它们分别严格
对应现有 facade 的 `restore_trashed` 与 `restore_trash_item`。如果后续决定统一产品术语，应先重命名 facade，
然后同步 use case；不能只在内部随意缩写成裸 `Restore`。

`CMS.Articles.permanently_delete/3` 与 `permanently_delete_trashed/3` 当前指向同一能力。迁移时必须选择
`permanently_delete_trashed` 作为 canonical facade action，并审计、删除或明确保留另一入口；不能让两个
facade 名字长期映射同一个 use case 而没有合同说明。

`ReplaceAssetUse` 的迁移单元不只有 facade。`CMS.Assets.ReplacementPlan.apply_locators/5` 也直接调用
`ReplaceAssetUse.replace/4`，因此移动到 `CMS.Assets.Commands.ReplaceUse` 时必须同步迁移：

- `CMS.Assets.replace_use/4`；
- `CMS.Assets.ReplacementPlan` 内部调用；
- `ReplaceAssetUse` 模块及其测试；
- `ReplaceAssetUseConfirmation` 到 `CMS.Assets.Commands.ReplaceUseConfirmation`；
- operation tag、Confirmation codec 和 Receipt 恢复测试保持兼容。

`CMS.Articles.Commands.Trash` 当前还 alias 了 `CMS.Articles.Trash`，形成难以辨认的
`Trash.trash`、`Trash.restore` 调用。拆分后 `Commands.Trash` 内若仍依赖 aggregate 模块
`CMS.Articles.Trash`，必须显式使用 `alias CMS.Articles.Trash, as: TrashAgg`；不得让当前模块尾名与依赖
alias 尾名相同。

#### Articles 已知但延后处理的 write facade

以下路径同样没有完整 concrete use-case module，但它们当前既不进入 `CMS.Command`，也不与本次待移动的
Command/Confirmation 模块共享实现，因此记录到 facade-directory 审计，不混入本次 Command 命名迁移：

- States：`archive`、`sink`、`undo_sink`、`set_cat`、`set_status`、`update_active_timestamp`、
  `lock_comments`、`undo_lock_comments`；
- Moderation：`set_illegal`、`unset_illegal`、`set_audit_failed`；
- 历史 Article actions（已删除）：`move_to_blackhole`、`mirror_to_home`。

> 历史记录说明：下方旧 mutation 名称保留用于记录当时的迁移范围；当前 GraphQL contract 已删除这些
> mutation，现行 ArticleCommunity 命令以 `mirror_article` / `move_article` 等入口为准。

分类规则固定为：已经接入 `CMS.Command`、携带 `commandId`、共享本次迁移的 Confirmation/Command module，
或已在上表显式列为代表性 facade bypass 的路径进入本文；其余 direct States/Moderation/Writer 路径进入
facade-directory 审计。若 Phase 1 发现其中某项存在 ambiguous-commit 风险，必须先更新本文目标表和测试
合同，再把它提升到本次迁移范围，不能在实施中临时顺带修改。

### 3.2 DocTree

| 当前调用                                 | 目标调用                              |
| ---------------------------------------- | ------------------------------------- |
| `Commands.Publish.publish_changes`       | `Commands.PublishChanges.execute`     |
| `Commands.Publish.move_doc_to_draft`     | `Commands.MoveDocToDraft.execute`     |
| `Commands.Publish.move_subtree_to_draft` | `Commands.MoveSubtreeToDraft.execute` |
| `Commands.Node.create_node`              | `Commands.CreateNode.execute`         |
| `Commands.Node.create_page`              | `Commands.CreatePage.execute`         |
| `Commands.Node.update_node`              | `Commands.UpdateNode.execute`         |
| `Commands.Node.update_draft`             | `Commands.UpdateDraft.execute`        |
| `Commands.Node.delete_node`              | `Commands.DeleteNode.execute`         |
| `Commands.Node.duplicate_node`           | `Commands.DuplicateNode.execute`      |
| `Commands.Node.move_node`                | `Commands.MoveNode.execute`           |
| `Commands.Trash.restore`                 | `Commands.RestoreTrashItem.execute`   |
| direct `Writer.create_tab`               | `Commands.CreateTab.execute`          |
| direct `Writer.create_group`             | `Commands.CreateGroup.execute`        |
| direct `Writer.create_link`              | `Commands.CreateLink.execute`         |
| direct `Writer.create_pin`               | `Commands.CreatePin.execute`          |

共享的 command construction、参数 canonicalization 或 Confirmation presentation 不得通过重新制造
一个 `Node`/`Publish` 大模块解决。确有重复时应提取职责明确的 private support，例如 command input
normalization 或 result reconstruction；support 本身不能成为 facade 可调用的业务入口。

### 3.3 Comments 与 Reactions

以下形状符合目标规则，作为迁移样板：

```elixir
Comments.Commands.UpdateComment.execute(...)
Comments.Commands.DeleteComment.execute(...)
```

`Interactions.Reactions.Upvote.add/remove` 与 `Emotion.add/remove` 表达的是同一 reaction 类型下的两个
方向，不属于 `Publish.publish` 式重复。本次不为了机械统一而把所有模块改成 `execute`；只有 concrete
use-case 模块采用统一 `execute` 入口。

## 4. Elixir inline `do:` 规则

冻结仓库级规则：

> `do:` 只允许整个定义保持在同一物理行时使用。只要函数头或函数体需要折行，必须使用完整的
> `do ... end`。

允许：

```elixir
def published?(article), do: article.stage == :published
```

禁止：

```elixir
def publish(article, actor, opts),
  do: Commands.Publish.execute(article, actor, opts)
```

正确写法：

```elixir
def publish(article, actor, opts) do
  Commands.Publish.execute(article, actor, opts)
end
```

该规则至少覆盖 `def`、`defp`、`defmacro`、`defmacrop`。对于 `if`、`unless`、`case`、`with` 等表达式
同样遵循：inline 形式只能保持在一个物理行；发生折行时使用 block form。

### 4.1 规则落点

修复最终必须同时具备两层约束：

1. 在根 `AGENTS.md` 增加 Elixir block style，指导人工与编码 Agent；
2. 新增自定义 Credo check，例如 `GroupherServer.Credo.Check.NoWrappedInlineDo`；存量归零后，才以
   失败级别接入 `backend/api/.credo.exs` 的默认 CI config。

check 沿用当前项目惯例，放在 `backend/api/credo_checks/no_wrapped_inline_do.ex`，在
`backend/api/.credo.exs` 的 `requires:` 中注册，并在 `checks:` 中以 `exit_status: 2` 配置失败级别；
不另建第二套 lint 入口。

`mix format` 不会把折行的 inline `do:` 自动转换为 `do/end`；现有 `MaxLineLength` 也只检查行宽，
不能替代该规则。

Credo check 至少覆盖：

- definition head 与 `do:` 位于不同物理行；
- inline body 被 formatter 折到下一行；
- 多行 `if/unless/case/with` 仍使用 keyword `do:`；
- 合法的单行 definition 不报错；
- heredoc、quoted AST 和 generated/deps 文件不产生误报。

## 5. 实施阶段

### Phase 1（已完成）：冻结规则、实现 check 与建立可重复 baseline

- 更新 `AGENTS.md` 与 `docs/rules/naming.md`；
- 新增并测试 `NoWrappedInlineDo`，但暂不以失败级别接入默认 CI config；
- 提供可重复运行的 audit/codemod，分别报告 `lib/`、`test/` 和完整 first-party Credo scope 的文件数与
  issue 数；
- 完整盘点 Articles、DocTree 及 command-adjacent Assets facade 的 Writer/Store/Target bypass，补齐目标表；
- 为代表性 Article、Comment、DocTree facade/use-case 调用链补充结构测试或 focused contract tests；
- 记录当前 Command-backed 与 one-shot 路径，不在命名提交中改变行为。

验收：check 的正反例测试通过；baseline 数量可重复；默认 CI 尚不因历史 1,063 处问题失败；架构文档
不再称 `CMS.Command` 为 transport 统一入口。

### Phase 2（已完成）：独立完成全仓 wrapped-inline-`do:` sweep

- 使用 token/AST-aware codemod 将 Credo 覆盖范围内的存量违规转换为 block form；
- codemod 后统一运行 `mix format`，不得依赖 formatter 自行改变 AST form；
- 该 sweep 使用独立提交或 PR，不夹带 Command 命名、业务逻辑或 GraphQL 合同变化；
- 对 codemod 无法安全判断的 quoted/generated/source-building 场景人工复核，不用宽泛路径 exclude 掩盖；
- 清扫后重新运行 audit，要求 issue 数归零。

验收：所有 first-party Credo input 中 wrapped inline `do:` 为零；compile、测试、format 与现有 Credo
通过；diff 只包含语法形状变化。

### Phase 3（已完成）：启用 hard Credo gate

- 将 `NoWrappedInlineDo` 以失败级别加入 `backend/api/.credo.exs` 默认 config；
- CI 运行真实 check，不保留任何仅为迁就历史存量而新增的 legacy file/path exclude 清单；现有标准 scope
  exclusions（`_build/`、`deps/`、`node_modules/`）保持不变；
- 验证新引入的折行 inline `do:` 会导致 CI 失败。

验收：存量为零且 CI 可以阻止回归；不存在“check 上线当天因历史问题全红”的窗口。

### Phase 4（已完成）：收敛单动作模块与 direct primitive facade

- `Create.create`、`Update.update`、`Publish.publish` 改为对应 use case 的 `execute`；
- `CMS.Assets.replace_use` 改为委托 `Assets.Commands.ReplaceUse.execute`；
- `CMS.Assets.ReplacementPlan` 同步改调 `Assets.Commands.ReplaceUse.execute`，并迁移
  `ReplaceAssetUseConfirmation` 的 owner、引用和恢复测试；
- `create_stable_draft`、`update_draft`、`discard_draft` 改为委托对应 concrete use case；
- DocTree `create_tab/group/link/pin` 改为委托对应 concrete use case；
- 更新 facade、测试、文档和引用；
- facade 使用完整 `do/end` 委托，不保留旧函数 alias 或 compatibility wrapper。

验收：生产代码不存在上述重复命名；public write facade 不直连 Writer/TargetDraft；业务行为、返回形状
和 Receipt 合同不变。

### Phase 5（已完成）：拆分 Articles 多动作容器

- 将 Article Trash、RestoreTrashed、PermanentlyDeleteTrashed 拆成独立 use case；
- 消除 `Commands.Trash` 与 `Articles.Trash` 的尾名冲突；
- `Commands.Trash` 对 aggregate 使用 `TrashAgg` 等显式 alias；
- 共享私有逻辑放入职责明确的 support，不建立新的万能 dispatcher；
- 保持 Gate、Activity、Confirmation、FrontDesk result builder 与 Receipt 行为不变。

验收：每个模块只有一个公共 `execute` 用例；首次执行、恢复、冲突和失败回滚测试均通过。

### Phase 6（已完成）：拆分 DocTree 多动作容器

- 拆分 `Commands.Publish` 的 PublishChanges、MoveDocToDraft、MoveSubtreeToDraft；
- 拆分 `Commands.Node` 的 create/update/delete/duplicate/move use cases；
- 拆分 `Commands.Trash.restore`；
- 将 create tab/group/link/pin 与其他写入一样保持为独立 use case，不因它们当前不使用 Receipt 而绕过
  facade/use-case 边界；
- 保留现有 Confirmation owner 与 command operation tag。

验收：DocTree facade 的每个公开写动作只委托一个同名 use-case module 的 `execute`。

### Phase 7（已完成）：统一 facade delegation 与 commandId 合同审计

- facade 不再根据 `commandId` 选择 `publish_now` 或 receipt-backed module；
- concrete use case 成为 one-shot 与 receipt-backed 路径的唯一 owner；
- 审计每个外部 mutation 是否必须要求 `commandId`；
- 合同需要强制 `commandId` 的变更单独实施和发布，不混入纯命名提交。

验收：Resolver、未来 CLI/MCP/Agent 只调用 facade；transport 和 facade 都不直接构造 `%CMS.Command{}`。

## 6. 非目标

- 不建立全局 Command Bus；
- 不增加 `DomainCommand.run(type, attrs)` 万能 dispatcher；
- 不要求所有 CRUD 进入 `CMS.Command`；
- 不把 Gate、Lifecycle、version 或领域结果构造移入 `CMS.Command`；
- 不在纯命名阶段改变 GraphQL schema、Receipt identity 或 Confirmation payload；
- 不在本文中重构 read facade、Query 或只读 `TargetDraft.get` 路径；本文的 facade/use-case 约束针对写操作；
- 不在本文中顺带迁移与 Command 无关的全部 CMS 简单 Writer facade；它们进入独立 facade-directory 审计；
- 不保留旧 use-case 函数 alias，避免迁移后继续存在两套命名。

## 7. 验收清单

- [x] 架构文档明确 facade 是共享业务入口，`CMS.Command` 是可靠执行边界；
- [x] Resolver/CLI/MCP/Agent 示例只调用 `CMS.<Domain>` facade；
- [x] use-case 模块统一为 `Commands.<BusinessAction>.execute`；
- [x] 不存在 `Publish.publish`、`Create.create`、`Update.update` 等重复命名；
- [x] `ReplacementPlan`、`ReplaceUse` 与 `ReplaceUseConfirmation` 已迁移到同一个 Assets owner；
- [x] 不存在 `Node`、`Publish`、`Trash` 承载多个不同业务动作的容器模块；
- [x] Article 与 DocTree public write facade 不直接调用 Writer、TargetDraft 等持久化 primitive；
- [x] facade 不决定 one-shot 与 Receipt 路径；
- [x] `AGENTS.md` 包含 inline `do:` 规则；
- [x] 独立 sweep 将存量 wrapped inline `do:` 清零；
- [x] 存量清零后 Credo 才在 CI 中拒绝折行的 inline `do:`，且没有存量 suppression；标准
      `_build/deps/node_modules` scope exclusion 保持不变；
- [x] Command 首次执行、恢复、identity conflict、失败回滚与 Confirmation 测试通过；
- [x] GraphQL 与领域返回形状保持不变；
- [ ] 显式 first-party source glob 的 `mix format --check-formatted`、Credo、focused tests 和完整后端测试通过。

### 7.1 实施验证

- wrapped-inline AST audit：0；`NoWrappedInlineDo` 测试：6/6；全部自定义 Credo check 测试：19/19；
- `mix format --check-formatted "lib/**/*.{ex,exs}" "test/**/*.{ex,exs}" "credo_checks/**/*.ex" "scripts/**/*.exs"`、
  `mix compile --warnings-as-errors`、`git diff --check`：通过；仓库没有 `.formatter.exs`，不能裸跑
  `mix format --check-formatted`；
- 当前工作树重新验证的 Command/Articles/Assets/DocTree focused tests：146 个通过；
- 完整后端测试（`mix test --max-cases 8`）：2,164 个通过，1 个按标签排除；
- `pnpm run docs:check`：通过；
- 全量 `mix credo --strict` 仍被当前工作树中 58 个既有 refactoring、11 个 readability 和 181 个
  design finding 阻断；默认 `mix credo` 也有 54 个既有高优先级 finding。新 hard check 自身已启用且无违规，
  但在既有 Credo baseline 清零前，本清单最后一项不能标记完成。
