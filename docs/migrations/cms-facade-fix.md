# CMS Facade 边界修复

> 状态：Phase 1 已实施；Phase 2–3 仍待后续审计。
>
> 范围：`backend/api/lib/groupher_server/cms` 下产品 facade、concrete use case、领域 owner
> 和 CMS 基础设施之间的职责边界。

相关规则：

- [Backend Rules](../rules/be.md)
- [CMS Facade 与实现目录收口](../architecture/cms-facade-directory.md)
- [CMS 多入口与领域用例边界](../architecture/cms-multi-entry-boundary.md)
- [CMS Domain Outbox](../architecture/cms-outbox.md)

## 1. 背景

CMS 根目录下的模块名称并不都代表同一种边界。有些模块是对外稳定的产品 facade，有些模块是
concrete use case 或领域 projection owner，还有些模块是可靠 effect 基础设施。

当前问题不是“所有 `cms/*.ex` 都不能直接使用 Repo”，而是部分模块在文档和命名上被定义为
facade，却仍然把查询、事务、membership 判断和完整业务动作实现放在根文件中。这样会导致：

- facade 的公开合同和内部算法一起变化；
- 同一个业务动作无法被 GraphQL、Job、CLI 或未来 MCP 统一复用；
- 领域用例的 Gate、Lifecycle、资源加载和写入顺序散落在 facade 私有函数中；
- review 时无法判断某段代码是稳定 API、use case 还是持久化 primitive；
- 新功能继续堆入根模块，逐渐形成“伪 facade”。

## 2. 已确认的问题

以下小节记录 Phase 1 实施前的代码基线和问题证据；当前状态以各节后续的“当前实施结果”和
Phase 1 验收项为准。

### 2.1 历史问题：`CMS.Kanban` facade 越界

文件：`backend/api/lib/groupher_server/cms/kanban.ex`

该模块的 moduledoc 将自己定义为 `Community-local Kanban command facade`，但 Phase 1 之前的实现直接：

- alias `Repo`；
- 通过 `Repo.get/2` 加载 Article 和 Community；
- 通过 `Repo.get_by/3` 检查 `ArticleCommunity` membership；
- 读取 `KanbanState`；
- 在根模块私有函数中完成 Article 加载、membership 校验和状态写入编排；
- 由 facade 自己决定 `Access.with_community_check/5` 与 `States.set_status/3` 的调用顺序。

这违反 facade 的既定边界。修复后的 `CMS.Kanban` 只保留稳定的产品动作入口：

```text
CMS.Kanban.add_post/4
  -> CMS.Kanban.Commands.Add.execute/4

CMS.Kanban.move_post/4
  -> CMS.Kanban.Commands.Move.execute/4

CMS.Kanban.remove_post/3
  -> CMS.Kanban.Commands.Remove.execute/3
```

具体 Command 是否需要继续拆出 Query、Membership 或 Writer，应以实际调用关系和事务边界为准，
不能把原有私有函数机械搬家后继续让 Command 直接承担模糊职责。

`set_status/4` 是现有兼容入口。Phase 1 保留其公开行为，并让它通过 Articles 边界解析
canonical Article/Community 后路由到同一个 concrete use case：

- 保留 GraphQL `set_post_status` 的既有调用链；
- 不让 Kanban facade 再接收 Article ID 并自行查询；
- 将错误映射统一放在 Articles 边界。

不能新增第二套 Kanban 状态写入路径。

### 2.2 `CMS.Outbox`：不是同类 facade 问题

文件：`backend/api/lib/groupher_server/cms/outbox.ex`

`CMS.Outbox` 是 CMS 可靠 effect 基础设施 owner，不是普通产品 facade。根据
`docs/architecture/cms-outbox.md`，它应该拥有：

- Event 写入；
- Oban wakeup 入队；
- event claim；
- lease；
- retry/failure；
- completion 状态机。

因此它直接使用 Repo 并不构成本文所说的 facade 违规。正确的边界是：

```text
CMS domain transaction
  -> CMS.Outbox.send/1
       -> Event + Oban wakeup

CMS.Outbox.Workers.<Domain>.<Task>
  -> CMS.Outbox.execute/2
       -> worker-owned domain effect
```

`CMS.Outbox` 不应继续扩展为业务 dispatcher、通用 event registry 或领域 use case；但现有
可靠执行协议应保留在该模块及其 `outbox/` 目录内。

### 2.3 Query 命名说明

本文不再使用旧的 `Reader` 作为新实现目录命名。CMS Query V2 已将读取侧统一收口为
`query.ex` / `CMS.<Domain>.Query`；例如 Press、Wallpaper、Snapshot 和 Articles 当前都应以
`Query` 作为读取 owner 的判断依据。

`cms-facade-directory.md` 的历史阶段说明仍使用 `Reader`，但该文档自身已经声明该命名被 Query V2
取代。因此本文引用该文档时，`Reader` 均按当前 `Query` 语义理解，不在新代码中新增
`reader.ex`。

### 2.4 历史问题：`CMS.Kanban` 的资源加载与公开参数

Backend Rules 的“资源加载”规则要求：同步 mutation 的入口应先通过 `CMS.FrontDesk` 或明确的
领域加载边界得到 canonical resource，不能把已加载资源降级为 ID，再由 facade 或 Writer 重复加载。

Phase 1 之前 `CMS.Kanban` 的 `article_id` 参数和私有 `load_article/1` 正好形成该反模式：公开
facade 接收 ID，再自行 `Repo.get(Article, article_id)`。修复没有把 `load_article/1` 原样搬到
`Commands.*`，而是将 add/move/remove 改为接收 canonical Article struct。

迁移前需要确认调用者和边界，再决定公开 API 是否从：

```elixir
CMS.Kanban.move_post(community, article_id, status, actor)
```

调整为接收 canonical Article struct，或保留 ID 形状但把解析责任固定在 transport / FrontDesk
入口。无论最终是否保持兼容签名，都必须保证：

- facade/use case 不重复加载已经解析的 Article；
- Gate 返回的 canonical resource 成为后续写入和结果构造的依据；
- 不为了保持旧参数形状而继续在 Kanban facade 内部直接查 Article。

这是已在 Phase 1 明确记录的 API 合同决策，而不是迁移后的隐含行为。

### 2.5 Phase 1 前的调用者事实

Phase 1 前，`add_post/4`、`move_post/4`、`remove_post/3` 除测试外没有生产调用者。它们在修复后
作为新的稳定 facade surface，但没有以“已有生产兼容性”为理由保留多余的内部加载或 wrapper。

`set_status/4` 的唯一生产调用链是：

```text
GraphQL set_post_status
  -> CMS resolver Articles.set_post_status
  -> CMS.Articles.set_status_result/3
  -> CMS.Articles.set_status/4
  -> CMS.Kanban.set_status/4
```

因此 Phase 1 优先保证了 `set_status/4` 的现有 GraphQL 行为，并让它路由到明确的 Kanban command
owner。没有因为 add/move/remove 当前没有生产 caller，就删除或改变 `set_status/4` 的公共行为。

### 2.6 历史问题：Community 不存在时的错误语义

Phase 1 前 `kanban.ex:53` 在 `community_id` 找不到 Community 时返回：

```elixir
CMS.Articles.ErrorCat.article_not_found("community not found")
```

这是资源类型与错误消息不一致的语义问题。Phase 1 已移除这条 Kanban facade 内的 Community ID
查询，并由 Articles 边界统一映射为 resource-not-found。

迁移前需要明确的兼容选择是：

- 保留错误 code 以兼容现有 GraphQL contract，只修正内部消息或映射；或
- 使用 Community 对应的 canonical ErrorCat，并同步更新 contract/test。

不能把这个错误当作单纯的代码搬迁细节而继续无说明地保留。

### 2.7 Kanban membership 错误语义

Phase 1 后的 `CMS.Kanban.Query.ensure_membership/2` 仍需要表达“Article placement 不在 Kanban”
这一业务事实，但不应使用 `article_not_found`。当前已改用 Article context 的通用 `not_exist`
catalog；后续 Phase 2 仍应评估是否需要建立更明确的 Kanban-owned ErrorCat。

## 3. 审计分类

后续审计按职责分类，不以“根文件是否存在 Repo”作为唯一判据。

| 类型                      | 允许拥有的职责                                           | 典型模块                                    | 审计结论                                    |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 产品 facade               | 稳定公开函数、参数归一化、轻量路由                       | `CMS.Articles`、`CMS.Comments`、`CMS.Press` | 不直接拥有复杂查询、事务或副作用            |
| Concrete use case         | 一个完整业务动作的 Gate、Lifecycle、版本、写入和结果编排 | `Articles.Commands.*`、`DocTree.Commands.*` | 业务顺序集中在这里                          |
| Domain owner              | 明确领域 projection、query、writer 或状态能力            | `CMS.ArticleStats`、`CMS.DocTree.Writer`    | 可直接持久化，但不能伪装成产品 facade       |
| Infrastructure owner      | 可靠执行协议、事件状态机、provider 边界                  | `CMS.Outbox`                                | 直接 Repo 是职责的一部分，不迁入产品 facade |
| Coordinator / maintenance | 跨领域 action 路由或后台维护                             | `CMS.Trash`、`CMS.Seeds`                    | 单独判断，不自动套用 facade 规则            |

## 4. 相关模块的当前处理策略

以下模块已有 facade 目录整改决策或实现 owner，后续只做现状复核，不在本 fix 文档中重新设计
公开 API：

- `CMS.Articles`：继续使用 `Articles.Commands.*`、Query、Writer 等 owner；
- `CMS.DocTree`：继续使用 `DocTree.Commands.*`、Query、Writer、Publish、Trash；
- `CMS.Assets`：删除实现归 `Assets.Deletion`；
- `CMS.Press`：由 Query、Projection、ConfigWriter、Invalidation 承担实现；
- `CMS.Wallpaper`：由 Query、Upload、Publisher、Retention 承担实现；
- `CMS.FrontDesk`：按 Article、Comment、Community、Relation 等资源 owner 拆分；
- `CMS.Snapshot`：由 Query、Cache、Projection、Refresh 承担实现。

这些模块不能因为根文件仍然有较多函数，就直接判定为未修复；需要检查每个公开函数的实际调用
目标和是否仍持有不应存在的私有算法。

以下模块暂不纳入本 fix 的自动迁移：

- `CMS.Outbox`：可靠 effect 基础设施；
- `CMS.Trash`：跨 Trash action coordinator 和 scheduler；
- `CMS.ArticleStats`：ArticleStats projection owner；
- `CMS.DocPublishRelease`、`CMS.QueryBuilder`、`CMS.Marker`、`CMS.Seeds`：分别按领域实现、
  查询支撑、值对象/校验和维护入口单独判断。

## 5. 修复顺序

### Phase 0：冻结判断标准

- 以 `docs/rules/be.md` 和本文件作为审计入口；
- 记录每个根模块的类型：facade、use case、domain owner、infrastructure 或 coordinator；
- 不以模块文件长度作为唯一标准；
- 不为了形式给纯数据契约或基础设施增加空 facade。

### Phase 1：收口 `CMS.Kanban`

- 先确认 `add_post`、`move_post`、`remove_post`、`set_status` 的全部生产调用者；
- 确认 canonical Article / Community 的资源加载边界、目标 Community admission、membership 检查和状态写入的 owner；
- 明确 `article_id` 是否保留为公开参数；如果保留，必须由入口完成解析，不能由 Kanban facade
  再次 `Repo.get`；如果改为 Article struct，必须同步更新调用者、contract 和测试；
- 建立 concrete use case 模块，统一 Gate 和 KanbanState 的写入顺序；
- 让 `CMS.Kanban` 只保留稳定动作入口；
- 保持现有返回值、ErrorCat 和 ArticleCommunity-local Kanban 语义；
- 保证 `set_status/4` 的 GraphQL 调用链行为；
- 明确 Community 不存在时的 ErrorCat 兼容策略；
- 不增加第二套 compatibility facade 或万能 Command dispatcher。

当前实施结果：

- `CMS.Kanban` 已只保留稳定入口，不再直接 alias 或调用 Repo；
- `add/move/remove/set_status` 已路由到 `CMS.Kanban.Commands.*`；
- membership 查询已下沉到 `CMS.Kanban.Query`；
- `CMS.Articles` 的 ArticleCommunity-scoped status 入口通过 FrontDesk 获取 Article/Community，再交给 Kanban
  facade；GraphQL projection 形状保留了明确的 canonicalization 分支；
- `add/move/remove` 的调用合同已改为传递 canonical Article struct；
- Community 不存在时不再从 `CMS.Kanban` 返回 `article_not_found("community not found")`，而由
  Articles 边界统一映射为 resource-not-found；
- ArticleCommunity-scoped Kanban tests 和 GraphQL status mutation tests 已通过。

#### ArticleCommunity naming debt

以下是当前代码中保留的历史命名，不代表存在第二个 Placement 实体；它们列入后续 facade-directory
审计，暂不在本轮文档收口中改动：

- `delete_source_placement/3`：ArticleCommunity 关系迁移时的内部删除 helper；
- `:current_path_placement`：已移除的历史错误 atom，仅保留在迁移记录中；
- `with_authorized_placement/4`：按 ArticleCommunity 关系执行 Gate admission 的现有函数名。

后续若重命名这些代码标识，必须同步调用者、测试和错误协议；文档统一不等于本轮已经完成代码 API
重命名。

### Phase 2：结构审计

按下列维度检查 CMS 根模块：

- facade 是否直接调用 Repo、transaction、HTTP、cache 或外部 provider；
- facade 是否包含多个私有 helper 才能表达的完整业务动作；
- facade 是否直接调用 Writer、Store、Target 或 model primitive；
- command 是否承担一个完整业务动作，而不是一组可选步骤；
- domain owner 是否被错误描述为 facade；
- Outbox、Trash、Snapshot、ArticleStats 等特殊 owner 是否有明确文档归类。

### Phase 3：补充结构门禁

在不误伤 Outbox、projection owner 和 maintenance owner 的前提下，增加 focused 检查：

- 产品 facade 不直接调用 Repo；
- 产品 facade 不直接构造 `%CMS.Command{}`；
- transport、GraphQL、Job 不直接调用内部 Writer、Store 或 Command；
- `CMS.Outbox` 的基础设施入口保留 allowlist 或独立 owner 规则；
- facade 的公开动作必须有对应合同测试或调用者证据。

## 6. 验收标准

### `CMS.Kanban`

- `CMS.Kanban` 不再拥有 Kanban Article 查询和 membership 查询实现；
- `CMS.Kanban` 不再直接调用 Repo；
- add/move/remove 使用明确的 concrete use case；
- 公开参数的 ID/struct 选择已形成明确合同，且不发生已解析 Article 的 ID 降级重载；
- Gate 按目标 ArticleCommunity 关系执行 admission；
- 不同 Community 的 KanbanState 互不影响；
- `set_status/4` 没有产生第二套写入逻辑；
- `set_post_status` 的 GraphQL 调用链保持通过；
- Community 不存在时的错误 code、消息和测试期望已明确处理；
- 现有 GraphQL contract、ErrorCat、返回形状和 focused tests 保持通过。

### CMS 总体

- 产品 facade、concrete use case、domain owner、infrastructure owner 的职责可从目录和文档中
  直接判断；
- Outbox 的 event 状态机仍由 `CMS.Outbox` 统一拥有；
- 不把所有根模块机械改造成一行 `defdelegate`；
- 不新增只为转发而存在的长期 compatibility facade；
- 每个修复 phase 独立验证，不吸收工作区无关修改。

## 7. 当前工作区注意事项

当前工作区已有与 ArticleCommunity Kanban 相关的未提交修改。Phase 1 已修改 `kanban.ex`、
`articles.ex` 和 Kanban focused test，并新增 Kanban Commands/Query 实现；以下 placement 文件仍
属于不可覆盖的工作区资产，未被本 fix 重写：

- `backend/api/lib/groupher_server/cms/model/kanban_state.ex`
- `backend/api/priv/repo/migrations/20261006091000_move_kanban_state_to_article_community.exs`

这些 placement 文件没有被覆盖或重置。
