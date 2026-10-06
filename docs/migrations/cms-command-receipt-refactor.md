# CMS Command Receipt 重构

> 状态：completed（API、Receipt 字段命名、GraphQL、前端 replay 状态和 DocTree command 映射均已收口）

本文记录从历史 `CMS.CommandReceipt.run_user_command/8` 迁移到 `CMS.Command` 目标架构的
实施范围、阶段和验收条件。稳定业务合同见
[Groupher Action Matrix 与 Transition Contract](../feature/lifecycle/transition-contract-improvement.md)，
长期 API 与所有权边界见 [CMS Command](../architecture/cms-command.md)。

发生冲突时，业务语义以 Transition Contract 为准，长期模块/API 边界以 CMS Command 为准，
本文只决定迁移顺序与阶段完成状态。

## 1. 当前问题

当前调用形态为：

```elixir
CommandReceipt.run_user_command(
  actor,
  command_id,
  command,
  target_type,
  target_key,
  intent_params,
  execute,
  replay
)
```

主要问题不是单纯参数数量，而是协议边界泄漏：

- command 描述被拆成多个无名称的位置参数，并在 facade、Runner、Store 间重复传递；
- 已加载资源又被调用点重复编码成 `target_type/target_key`；
- 每个领域调用点必须理解和实现 replay callback；
- Runner 通过 `attach_command_meta/3` 嗅探领域结果形状；
- `command_replayed` 被挂到领域 struct、GraphQL 和前端 mutation 状态机；
- 首次执行和 Receipt 恢复没有统一经过同一条结果投影路径；
- user command 提前携带尚未落地的 job/system initiator 抽象。

## 2. 目标状态

```text
CMS domain Command
  -> CMS.Command user API
       -> internal Receipt / Store
       -> first execution or confirmed-result recovery
       -> FrontDesk / owner codec result projection
  -> unchanged domain result shape
```

终态必须满足：

- 公共入口使用 `commandId` 表达一次逻辑用户意图；
- `command` 是固定、受控的服务端命令类型；
- 已存在实体直接传 struct，不手工重复 type/id；
- create、现存实体 mutation、Trash restore 和 batch/job 不共用万能 target API；
- 普通领域代码不知道 replay、Receipt、result key 或 result payload；
- 首次和恢复路径返回相同 canonical business result；
- `commandReplayed` 不再属于 GraphQL/前端产品合同；
- job/system 在真实需求出现前不进入 user API。

## 3. 非目标

- 不建立全局 Command Bus 或通用 CRUD framework；
- 不把 Gate、Lifecycle、Versioning、Activity 或领域 codec 移入共享 Runner；
- 不让 FrontDesk 负责 Receipt claim；
- 不把完整或敏感领域资源序列化进 Receipt；
- 不借本重构改变既有领域 transition 行为；
- 不吸收工作树中与本迁移无关的改动。

## 4. 迁移原则

重构以代表性路径验证 API，而不是先机械迁移所有调用点：

1. Comment Update：已加载实体、FrontDesk 结果投影；
2. Article Create：实体尚不存在，使用明确 create API；
3. Trash Restore：首次成功后输入资源消失；
4. DocTree mutation：无法重读时使用 owner-owned versioned payload。

四条路径都成立后才能批量迁移。任何阶段不得保留两套公开产品语义；本次不提供旧 transport
字段兼容，内部 adapter 只能作为实现细节存在。

## 5. 分阶段计划

### Phase 0：冻结合同与测试基线

- 更新 Transition Contract，移除对 `run_user_command/8` 和 replay callback 的长期冻结；
- 新增 `docs/architecture/cms-command.md`；
- 固定首次执行、相同 commandId 重试、不同 intent params 冲突、失败回滚和 retention 测试；
- 盘点所有 `run_user_command/8`、`command_replayed` 和前端消费点。

验收：文档权威边界明确，现有行为测试可重复执行。

### Phase 1：建立 `CMS.Command` 内核

- 建立 user-only 公共入口；
- 将 Receipt、Store、timeout 和 IntentCodec 编码收口为内部实现；
- `command` 直接编码为 Receipt 的文本字段；本次不迁移历史 Receipt，也不提供 fingerprint 兼容；
- 定义统一成功结果，不向领域 result 注入 replay 字段；
- 不保留旧入口或兼容 adapter；Receipt runner 仅作为 `CMS.Command` 的内部实现。

验收：`CMS.Command` 共享同一 claim/finalize 事务算法，失败路径不留下 Receipt。

### Phase 2：完成四个代表性样板

- Comment Update 直接接收 `%Comment{}`，首次/恢复都由 FrontDesk 返回 canonical Comment；
- Article Create 使用独立 create 入口，保存新 Article ref；
- Trash Restore 在 Trash item 消失后仍由 Receipt result ref 返回 restored Article；
- DocTree codec 继续由 DocTree owner 持有，`CMS.Command` 不解释 payload。

验收：四条路径的 transport/UI 调用代码均不出现 replay-status 分支或手工 result loading；必要的
recovery projection/codec 只作为领域 Command owner 的声明存在，不向产品层暴露 replay 状态。

### Phase 3：迁移后端用户命令

- 按 owner 迁移 Community、Article、Comment、Interaction、Docs、DocTree；
- 已加载资源不再手工传 `target_type/target_key`；
- post-commit effect 的首次执行判断收回 `CMS.Command` 编排；
- 删除领域 struct 上的 `command_replayed` 虚拟字段与 Map 装配；
- 保留 Gate、Lifecycle、Activity 和 codec 的既有 owner。

验收：生产代码不再调用历史 `CommandReceipt.run_user_command/8`；当前调用统一经过 `CMS.Command`。

### Phase 4：收口 GraphQL 与前端

- 请求字段由最终命名合同统一为 `commandId`；
- 删除 GraphQL response 中的 `commandReplayed`；
- 删除生成类型、query fragment 和 mutation result 中对应字段；
- 保留前端 Browser Receipt 持久化、reconcile hook、account cleanup 和对应测试；它们负责 optimistic
  read-your-writes，不是服务端 Receipt 状态机；
- 只删除前端依据 `commandReplayed` 跳过 Browser Receipt 写入、optimistic reconcile 或 follow-up 的分支；
- 前端 mutation framework 以本地 commandId 管理一次用户意图，并统一消费 canonical result。
- 直接切换部署合同：客户端只发送 `commandId`，服务端只声明 `commandId`；不保留旧字段 alias、fallback
  或双读双写。
- 部署窗口采用协调切换：服务端与客户端必须作为同一发布单元上线；混合的“旧客户端 + 新服务端”或“新客户端 +
  旧服务端”不属于受支持组合，不通过增加兼容分支来兜底。

验收：前端代码不存在 `commandReplayed` 或 `commandKey`；Browser Receipt/reconcile 机制仍存在；
首次响应和重试响应走同一 receipt 写入与 reconcile 路径；发布演练确认
协调切换期间没有把任一混合版本当作受支持合同，旧字段请求按 GraphQL schema 直接失败。

当前实现已删除 GraphQL schema、生成类型和 mutation reconcile 中的 `commandReplayed`；
transport 已完成 `commandKey` 到 `commandId` 的直接重命名。本次继续把 Receipt 的内部字段统一为
`command` 与 `command_id`，不保留旧字段 alias、fallback 或双读双写。

### Phase 5：删除旧协议与更新权威文档（completed）

- 删除 `run_user_command/8` 及其旧 facade/迁移 adapter；保留的 `CMS.Command.Receipt` 仅是
  `CMS.Command` 调用的内部 Receipt facade，当前内部入口为 `execute`，不对领域调用方开放；
- 删除 Runner 对领域 result shape 的嗅探；
- 复核 Receipt schema、retention job 和 ErrorCat 命名；
- 将 Transition Contract 从实施描述更新为稳定业务合同；
- 将本文状态改为 completed，并把仍然有效的长期结论保留在 Feature/Architecture 文档。

验收：代码、GraphQL、前端、测试和三份权威文档使用同一套术语与边界。

## 6. 数据与存储边界

Receipt 保留窗口为 24 小时。这个窗口只保证同一发布版本内，相同用户、相同 `commandId`、相同
`command`、目标和 input 可以恢复已确认结果；本次不承诺历史 Receipt 跨版本恢复。

- Receipt 字段统一使用 `command` 与 `command_id`；数据库字段、Ecto schema、Store 参数和领域 opts 不再保留
  `command_name` / `command_key`；
- `command` 在 `CMS.Command` 边界编码为文本保存；每个 operation 的 IntentCodec policy 明确哪些标量
  可诊断存储，正文和动态属性只保存逐字段 digest；
- contract migration 主动清空历史 Receipt 并删除 legacy 结果列与 fingerprint 列；不提供旧字段
  alias、fallback 或双读双写。历史 migration 文件仍保留，不改写；
- 发布时客户端与服务端仍作为同一发布单元切换，混合 GraphQL 字段不属于受支持合同；
- 内部 adapter 已删除，共享测试已迁移到 `CMS.Command` 内部入口。

Receipt 过期或发布版本切换后，旧 command 不再承诺恢复；客户端必须以新的 `commandId` 发起新的业务意图。

## 7. 验收矩阵

| 场景                               | 必须结果                                        |
| ---------------------------------- | ----------------------------------------------- |
| 首次成功                           | 领域写入、Receipt finalize 和事务内事实一起提交 |
| 相同 actor/id/input 重试           | 不重复写入，返回与首次相同的业务结果            |
| 相同 id、不同 input/target/version | ErrorCat command identity conflict              |
| Gate/version/领域写入失败          | 全事务回滚，不保留 completed Receipt            |
| 首次成功后输入资源消失             | 仍可由结果引用返回已确认结果                    |
| 当前结果不可见                     | 不泄漏旧快照，也不把历史成功改写成未执行        |
| post-commit effect                 | 同一次 commandId 最多触发一次                   |
| Receipt 过期                       | 可清理；新尝试仍通过 Gate/version/领域约束      |
| 前端                               | 不判断 executed/replayed，只处理业务成功或错误  |

## 8. 验证范围

每个实施 Phase 至少执行对应 owner 的 focused tests，并在最终阶段执行：

```bash
cd backend/api
mix format --check-formatted <changed Elixir files>
mix compile --warnings-as-errors
mix test test/groupher_server/cms/command_receipt_test.exs

pnpm run graphql:codegen
pnpm --filter @groupher/frontend-core run type-check
pnpm exec vitest --config frontend/core/vitest.config.mts run <affected mutation tests>

git diff --check
```

具体领域测试继续负责 Gate、Lifecycle、version、Trash、Release 和 effect 不变量；共享 Command
测试只负责 identity、canonical intent params、事务、结果恢复、冲突与 retention。
