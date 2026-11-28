# Backend Context Convention over Configuration

> 状态：active（v2，2026-10-11）

## 1. 决策

Backend 以 Phoenix 级业务或平台能力作为 Context：Accounts、Activity、Analysis、Auth、CMS、ErrorCat、Jobs、
Messaging、PublicCache、RequestActor 和 ServiceAuth。

每个 Context 只有一种声明方式：

```text
<context>/      # 内部实现
<context>.ex    # 对外唯一 Facade
```

Registry 只登记一级 Context 名称和 `strict | report_only` mode；Facade、Owner 和 internal capability 全部由路径推导，
不配置路径白名单。当前 registry 全部为 `strict`。

## 2. 边界层级

### 2.1 Context Facade

`accounts.ex` / `GroupherServer.Accounts` 是 Accounts 对外唯一入口。GraphQL、HTTP、Worker 和其他 Context 不应知道
`accounts/**` 的实现结构。

### 2.2 Internal Facade

`accounts/profiles.ex + accounts/profiles/` 建立 Accounts 内部的 Profiles 能力入口。它在 Elixir 语言层面是 public module，
但架构层面只允许 `accounts/**` 调用。

### 2.3 Owner

Owner 表示具体职责，不是新的 Context：

| Owner      | 职责                                     | 禁止                           |
| ---------- | ---------------------------------------- | ------------------------------ |
| Commands   | 一个用户意图、授权后的写操作             | 外部 I/O、隐式重试             |
| Query      | 读 authoritative data                    | 修改事实                       |
| Persist    | 已授权事务内的持久化 primitive           | 开 transaction、授权、外部 I/O |
| Workflow   | transaction、lease、retry、recovery 编排 | transport 适配                 |
| Effects    | commit 后副作用或 intent                 | 主数据授权                     |
| Lifecycle  | 资源状态转换、前置条件和终态约束         | 外部投递、绕过授权             |
| Outbox     | 持久化 effect intent、lease、retry 状态  | 修改业务事实、直接执行外部 I/O |
| Projection | 可由 authoritative facts 重建的数据      | 成为第二事实源                 |
| Policy     | 纯准入判断                               | Repo、transaction、外部 I/O    |
| Gate       | 资源解析、锁与 Policy 协作               | 对外发布业务 API               |
| Cache      | 缓存读写和失效                           | 成为 authoritative source      |
| Model      | schema 和 data shape                     | 业务编排                       |

集合型 Owner `commands/`、`model/`、`workflows/` 不需要同名 Facade。单数 Owner 拆成目录时必须配对，例如
`query.ex + query/`、`gate.ex + gate/`、`outbox.ex + outbox/`。

Outbox 是 Effects 背后的 CMS 级持久化 Owner，不是供 Command 随意调用的第二套 Effects API，也不需要物理放进某个
`effects/` 目录。多个 capability 的 Effects 共享它：

```text
Command / Workflow
  -> capability Effects
     -> CMS.Outbox.send             # 同事务保存 intent 和 Job
        -> Job -> CMS root Facade
           -> CMS.Outbox.Workflow
              -> execute / mark_failed
```

- `send/1` 只能由 Effects Owner 调用；
- `execute/2`、`mark_failed/1` 只能由 `CMS.Outbox.Workflow` 调用；
- Outbox 可以访问 Repo/transaction，但只能维护 outbox event、lease、retry、done/failed 和对应 Job；
- Outbox 不修改 Article、Comment、Community 等业务事实，也不直接调用外部 provider；
- 上述调用方向由 v2 checker 自动检查；“只写 Outbox 自有数据”等运行时语义仍由测试、数据库约束和 review 保证。

### 2.4 Organizational namespace

Owner 子树中的无 Facade 目录只用于整理文件，并继承最近 Owner role：

```text
accounts/model/embeds/        # 合法，继承 Model
cms/gate/rate_limit/          # 合法，继承 Gate scope
```

Owner 之外的普通目录必须有同名 Facade。不能创建空 Facade 只为通过 lint；Facade 应代表真实、稳定的能力入口。

## 3. 调用规则

```text
runtime / Context A
  -> Context B root Facade
     -> Context B internal Facade / Owner
```

- Context 内部可调用本 Context 的 internal Facade 或 Owner；
- Context 内部不能反向调用自己的根 Facade；
- Context A 可以调用 Context B 根 Facade，不能进入 B 的 internal module；
- Web 和其他 Context 只能调用根 Facade；Worker 也遵守这一规则，但可调用目标 Context 中明确声明
  `@pipeline ... access: :internal` 的 internal Command，用于可恢复 workflow；
- `%OtherContext.Model{}`、remote type 与 ErrorCat `error_pattern` 只表达数据形状，不是 behavior call；
- 通过 foreign schema 自行 Repo/ORM 查询或 changeset 写入仍属于 authority 穿透，不因持有 struct 而合法；
- root `FrontDesk` 是项目级稳定引用查询入口，通过各 Context 根 Facade 委托到其 FrontDesk seam；其他 caller 仍走
  root Facade。
- root `FrontDesk` 通过 `Accounts` / `CMS` 根 Facade 委托，不直接返回或暴露内部 seam module。

Context 根 API 用清晰的动作和资源名称避免冲突。业务动作优先使用动词开头、完整资源名和符合实际基数的单复数；保留请求、成员、资源范围等影响语义的限定词。迁移前检查整个 Context 的现有导出与所有调用方，逐批直接切换。尚未迁移的能力前缀名称按既有调用保留，不能据此引入新别名：

```elixir
CMS.articles_page(:post, filter)
Accounts.profiles_user(user)
PublicCache.cloudflare_purge(tags)
CMS.create_community(attrs, user, command_id)
CMS.remove_community_admin(community_ref, member_id, revision, actor, command_id)
```

## 4. Facade 实现

一对一、参数顺序不变、无 guard、无 pattern dispatch、无输入输出转换时必须使用 `defdelegate`：

```elixir
defdelegate profiles_user(user),
  to: GroupherServer.Accounts.Profiles,
  as: :user
```

需要 guard、pattern dispatch 或轻量 shape adaptation 时使用 `def`。业务编排必须下沉到 Command/Workflow，Facade 不访问
Repo、ORM、transaction、provider 或 cache store。

Facade 返回的是具体业务结果，不返回内部 module 供调用方继续调用：

```elixir
FrontDesk.revalidate_user(login)          # 合法
FrontDesk.revalidate().user(login)        # 非法：泄漏 internal module
```

编译期 enum 宏也必须从根 Facade 暴露；调用方 `require` 根 Context，而不是 require internal module。
禁止 `import` Context 根 Facade，因为裸函数调用会隐藏跨 Context 依赖；普通调用显式写根 Facade，只有编译期宏按需
`require` 根 Context。

## 5. Worker

Worker 是 runtime entrypoint，不是业务 Owner：

```text
jobs/<job>.ex
  -> Target Context Facade
     -> Workflow / Effects / Persist
```

Worker 只做 job 参数解码、调用根 Facade 或目标 Context 的 internal Command，以及 Oban result 映射。Repo、transaction、
provider delivery 和 recovery policy 属于目标 Context。所有 `use Oban.Worker` 模块必须位于 Jobs Context。

## 6. Registry

`backend/api/.context-registry-v2.json`：

```json
{
  "version": 2,
  "contexts": {
    "accounts": { "mode": "strict" },
    "cms": { "mode": "strict" },
    "jobs": { "mode": "strict" }
  }
}
```

Context key 必须是不含 `/` 的一级 snake_case 目录名。Registry 不允许 `facade`、`files`、`directories` 或 exception 字段。

固定 root modules 为 `application.ex`、`const.ex`、`front_desk.ex`、`release.ex` 和 `repo.ex`；其他 root `.ex` 必须由
registry 中的 Context 推导。

## 7. Lint 原理

```bash
cd backend/api
mix lint.context
```

该命令先运行 `scripts/check-backend-context-v2.test.mjs`，再执行
`scripts/check-backend-context-v2.mjs --fully-strict`。Checker 扫描完整 production `groupher_server/` 与
`groupher_server_web/`，不是只看 staged files。

Checker 的实现步骤：

1. 校验 registry schema、一级 Context 和 mode；
2. 检查 root closure、Context 目录与同名 Facade；
3. 先识别 Owner scope，再判断 internal capability 配对和 organizational namespace；
4. 校验由路径推导的 Context、capability 和 Owner Facade 模块名；
5. 对 Elixir 源码先屏蔽注释与字符串，再识别 fully-qualified call、直接/重命名/grouped alias、带括号或无括号调用、
   function capture、`import/require/use` 与 `defdelegate to:`；
6. 检查跨 Context behavior、internal 反调根 Facade、root Facade import、Facade 基础设施访问；
7. 检查 `Outbox.send` 只能来自 Effects，`execute/mark_failed` 只能来自 Outbox Workflow；
8. 通过 `use Oban.Worker` 识别 Worker，并检查位置与 Repo/ORM/transaction/network/cache 基础设施访问；
9. 只对 Context 根 Facade 之间的依赖建图并检查环；Jobs 的运行时触发关系由 Worker rule 单独约束。

这不是逐文件 allowlist。新增符合约定的普通模块、Command 或 Model 文件无需改 registry；新增边界或 Owner 仍需通过结构、
依赖、编译、文档和测试验证。

`mix lint.context` 是本文规则的独立强制验收入口。`mix lint` 会先运行它，再运行 module-style 和全量
`mix credo --strict`；后者仍有仓库历史基线，尚未作为 Backend CI 的全仓硬门禁。因此 Context 违规一定会阻断
`mix lint`，但不能反过来把当前 `mix lint` 的非零结果都归因于 Context 结构。Credo 的清理与启用状态见
[CI Contract Gaps](./ci-contract-gaps.md)。

### 7.1 自动检查与 review contract

| 规则                                      | v2 checker           | 其他执行入口                            |
| ----------------------------------------- | -------------------- | --------------------------------------- |
| Context、internal Facade、Owner 目录结构  | 自动                 | checker 单元测试                        |
| 跨 Context behavior 与反向根调用          | 自动                 | resolver/CMS 专用 boundary gate         |
| Facade、Worker 基础设施访问与 module 泄漏 | 自动                 | Credo、编译                             |
| Outbox 调用方向、Context 根 Facade import | 自动                 | checker 单元测试、Outbox 测试           |
| Context 根 Facade 依赖环                  | 自动                 | checker 单元测试                        |
| Query/Persist/Effects 等业务语义纯度      | 不能只靠路径完全证明 | CMS boundary gate、测试、review         |
| `@moduledoc`、`@doc`、`@spec` 与示例      | 不属于 v2 checker    | `pnpm docs:check`、module-style checker |

因此 `0 findings` 表示结构和可静态识别的依赖规则成立，不等于 Owner 的全部业务语义已由单个脚本证明。

## 8. 合法与非法示例

合法：

```text
cms/articles.ex + cms/articles/
cms/articles/query.ex
cms/articles/commands/create.ex
cms/model/embeds/article_meta.ex
```

非法：

```text
cms/articles/random/foo.ex
  -> unknown_internal_directory

cms/articles/query/by_id.ex（缺 query.ex）
  -> missing_owner_facade

groupher_server/new_context/（未登记）
  -> unknown_root_directory
```

行为违规：

```elixir
CMS.Articles.page(:post, filter) # -> context_boundary
def user(id), do: Repo.get(User, id) # Facade -> facade_infrastructure_access
CMS.articles_page(:post, filter) # CMS internal -> reverse_context_facade_call
def revalidate, do: Accounts.FrontDesk.Revalidate # -> facade_internal_module_escape
CMS.Outbox.send(attrs) # Command 中 -> outbox_write_outside_effects
CMS.Outbox.execute(id, callback) # Effects 中 -> outbox_delivery_outside_workflow
import GroupherServer.CMS # -> root_context_import
```

## 9. Finding 与后果

Finding 包含路径、行号（适用时）、mode、category 和 message。

- `strict` finding：退出码非零；
- `report_only` finding：打印但不阻断，仅用于将来的受控迁移；
- `--fully-strict`：registry 出现任何 `report_only` 本身就是 finding。

当前公开入口固定使用 `--fully-strict`，因此违规会阻断 `mix lint.context`、`mix lint`、Backend CI 和 pre-commit。

## 10. 新增代码清单

新增 Context 时创建 `<context>.ex + <context>/`、登记一级目录、发布稳定根 API，并运行 lint、编译和 focused tests。
新增 capability 时确认存在真实稳定入口，同时创建 `foo.ex + foo/`，不修改 registry。新增 Worker 时放入 `jobs/`，只调用
目标 Context 根 Facade，并覆盖成功、失败后重试或延后执行，以及达到最大尝试次数后的处理。

## 11. v1 迁移结果

v1 的 `.context-layout-manifest.json`、完整文件 allowlist、report-only 迁移命令和旧 layout/boundary checker 已删除。
v2 的 `pnpm report:backend-context-v2` 仅用于非门禁诊断；它不会替代下面任何 strict 入口。
`mix lint.context`、CI、Lefthook 和 `pnpm docs:check` 均使用同一个 v2 strict gate。
