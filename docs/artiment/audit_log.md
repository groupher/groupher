# AuditLog 与 ActivityLog：责任历史和产品操作记录

> 状态：设计雏形。`CMS.Audit` 和 `AuditLog` 已存在；面向产品的 `ActivityLog` 尚未实现。

相关文档：

- [Report 与审核聚合设计](../community/report_design.md)
- [Community Lifecycle](../community/lifecycle.md)
- [Command：复杂领域操作的组织边界](./command.md)
- [Post Solution](./post_solution.md)

## 1. 背景

Groupher 已有 append-only `CMS.Audit` 边界和 `audit_logs` 表，用于记录重要 CMS 操作。现有模型已经包含：

```text
community_id
actor_type / actor_id / actor_snapshot
action
resource_type / resource_ref / resource_snapshot
operation_ref
source
metadata
occurred_at
```

现有 `CMS.Audit.list/2` 主要按 Community、action 和 resource type 提供内部审计读取。产品侧未来需要在 Post、Comment、Doc 等资源页面展示一部分主要操作，例如：

```text
谁在什么时候修改了标题
谁置顶或取消置顶了评论
谁标记、替换或撤销了最佳回复
谁归档、恢复或删除了资源
```

内部审计和产品操作记录来源相关，但受众、字段和权限不同，不能直接把完整 AuditLog 暴露给前端。

## 2. 核心边界

```text
AuditLog
  -> 内部 append-only 责任事实
  -> 回答“谁通过什么入口对什么资源做了什么”

ActivityLog
  -> 面向产品的受控操作记录
  -> 从 AuditLog 筛选、鉴权、脱敏、聚合和展示转换
```

两者都不拥有当前业务状态：

| 当前状态 | 权威来源 |
| --- | --- |
| Article/Comment 是否可用 | Lifecycle |
| 当前最佳回复 | PostSolution |
| 当前置顶 Comment | PinnedComment / pin 权威关系 |
| 当前审核工作单 | ReviewCase |
| 当前 reaction | Interaction fact |

不能读取最后一条 AuditLog 或 ActivityLog 推断当前状态。恢复、撤销和重新打开都必须执行新的领域 command 并追加新记录。

## 3. AuditLog

### 3.1 职责

AuditLog 用于：

- 责任追踪；
- 安全与运维调查；
- 关键领域操作历史；
- 将同一次跨模块操作通过 `operation_ref` 关联；
- 在资源永久删除后保留必要的 actor/resource snapshot。

AuditLog 不用于：

- 保存可变业务状态；
- 替代 Revision、Snapshot 或 Draft 历史；
- 替代 Notification；
- 记录所有普通 page view 或低价值技术日志；
- 直接生成前端任意查询能力。

### 3.2 Action 命名

Action 使用稳定的领域过去式，不使用 controller 或数据库动词：

```text
post.title_changed
comment.pinned
comment.unpinned
solution.accepted
solution.replaced
solution.revoked
article.archived
article.restored
review.resolved
```

Action registry 继续由代码控制，新增 action 必须说明：

- 由哪个 command 产生；
- primary resource 是什么；
- 是否允许进入 ActivityLog；
- 对哪些 audience 可见；
- metadata 的允许字段；
- retention 是否有特殊要求。

### 3.3 一次业务操作与 `operation_ref`

一个 command 可能产生多条内部记录。例如 ReviewCase resolution 触发 Comment fold：

```text
review.resolved
comment.folded
```

它们共享一个 `operation_ref`。ActivityLog 可以根据产品语义将其合并为一条主要动态，AuditLog 仍保留完整责任链。

`operation_ref` 由业务 command 入口创建并传递，不由每个下游模块各自生成。

### 3.4 Snapshot 与 metadata

`actor_snapshot` 和 `resource_snapshot` 用于资源或账号删除后保持基本可读性，不是实时用户资料。

metadata 只保存解释该 action 必需的结构化字段。禁止无约束地塞入整个 schema、request body、正文或敏感上下文。

标题修改可以保存受控 before/after：

```elixir
%{
  changes: %{
    title: %{from: "旧标题", to: "新标题"}
  }
}
```

正文修改通常只记录“正文被编辑”和关联 revision ref。正文版本由 Draft/Revision/Snapshot owner 保存，不能复制进 AuditLog。

敏感信息如内部审核备注、IP、风控分数或技术错误只能进入明确的 operations-only metadata，并且不能透传到 ActivityLog。

### 3.5 原子性

Audit 必须与其描述的权威业务变更处于同一事务：

```text
业务写入成功 + Audit 失败 -> 整体回滚
业务写入失败              -> 不产生成功 Audit
```

对于提交后 Notification/Search 等异步副作用，Audit 记录业务 command 的成功事实；异步投递和重试使用自己的 delivery/operation 记录，不能篡改原 Audit。

## 4. ActivityLog

### 4.1 定位

ActivityLog 是产品接口，不等同于当前已经实现了一张 `activity_logs` 表。

初期目标可以只是：

```elixir
CMS.ActivityLog.list(actor, resource_ref, filters)
```

内部从 AuditLog 读取后完成：

1. 资源访问权限检查；
2. action allowlist；
3. audience 过滤；
4. metadata 脱敏；
5. 同一 `operation_ref` 的展示聚合；
6. actor/resource snapshot 转换；
7. 分页和稳定排序。

只有查询成本或跨事件源聚合被实际证明成为瓶颈时，才建立独立的 ActivityLog projection/table。

### 4.2 产品返回模型

ActivityLog 返回稳定的结构化数据，而不是由后端拼接最终自然语言：

```elixir
%{
  id: "...",
  action: :solution_accepted,
  actor: %{id: "...", nickname: "张三", avatar: "..."},
  resource: %{type: :post, ref: "..."},
  target: %{type: :comment, ref: "..."},
  occurred_at: ~U[...],
  changes: %{}
}
```

前端根据 action 做本地化文案和跳转。后端必须保证 action 和 payload shape 稳定，前端不能读取未声明的 Audit metadata。

### 4.3 Audience 与权限

建议至少区分：

```text
public
  当前可读取资源的用户可见

community_management
  owner/moderator 可见

operations
  平台运维可见
```

action 是否允许进入某个 audience 必须由 registry 或 presenter policy 明确声明，不能根据“metadata 看起来不敏感”临时决定。

ActivityLog 读取必须先经过资源 Gate/Scope。能够读取一篇 Post 不自动意味着能够读取其所有 moderation history。

### 4.4 Post 操作记录示例

```text
张三 · 修改了标题                         10:21
李四 · 置顶了一条评论                     11:03
张三 · 将一条回复标记为最佳回复           11:20
管理员王五 · 关闭了评论区                 14:10
```

建议首批只开放少量高价值 action：

- title changed；
- pin/unpin；
- solution accepted/replaced/revoked；
- archive/restore；
- comment area locked/unlocked（如果存在正式 command）。

编辑正文可以记录“编辑了内容”，但内容 diff 应链接到正式 Revision/DraftDiff，而不是读取 Audit metadata 拼装。

## 5. API 边界

建议分开内部和产品接口：

```text
CMS.Audit.record(action, attrs)
CMS.Audit.list(community, internal_filters)

CMS.ActivityLog.list(actor, resource_ref, product_filters)
```

`CMS.ActivityLog` 不能暴露：

- 任意 action 查询；
- 原始 metadata；
- operations-only actor/resource 信息；
- 无 Gate 的跨 Community 查询；
- 通过最后一条记录计算当前状态的 helper。

GraphQL 只暴露 ActivityLog DTO，不直接暴露 `AuditLog` schema。

## 6. 保留、删除与隐私

- AuditLog append-only 不等于无限保留所有 metadata；保留期应按合规和产品需要定义；
- 用户或资源永久删除后，snapshot 是否匿名化应有明确策略；
- ActivityLog 可以隐藏某条产品动态，但不能通过产品隐藏操作删除审计事实；
- action payload 不保存密钥、token、完整 request header 或无关个人信息；
- 管理员内部原因和普通用户可见原因应使用不同字段或不同 action presenter。

## 7. 渐进落地

### Phase 1：Audit action 收口

1. 盘点现有 action 和写入位置；
2. 补充主要 Post/Comment action；
3. 为 action 定义 resource、metadata 和 audience；
4. 确认 Audit 与 command 同事务；
5. 确认 `operation_ref` 能贯穿跨模块操作。

### Phase 2：ActivityLog 只读接口

1. 实现按 resource ref 查询；
2. 加入 Gate/Scope 和 audience 过滤；
3. 定义稳定 DTO；
4. 只开放首批 action allowlist；
5. 增加分页、脱敏和 operation 聚合测试。

### Phase 3：按证据决定 projection

只有在 AuditLog 直接读取不能满足延迟、索引或跨事件源需求时，建立可重建 ActivityLog projection。不能为了命名完整提前复制所有 Audit 数据。

## 8. 验收标准

- AuditLog 只记录责任历史，不拥有当前状态；
- 重要 command 的业务写入与 Audit 原子提交；
- action 名称稳定且在 registry 中声明；
- metadata 有明确 schema/allowlist，不保存无关敏感数据；
- ActivityLog 是产品边界，不直接暴露 Audit schema；
- ActivityLog 经过资源准入、audience 过滤和脱敏；
- `operation_ref` 能关联或聚合一次完整业务操作；
- 当前状态由 Lifecycle、PostSolution、ReviewCase、Interaction 等 owner 查询；
- 初期不引入没有性能证据的 ActivityLog 数据表。

