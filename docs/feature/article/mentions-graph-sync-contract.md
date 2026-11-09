# MentionsGraph 当前关系合同

> 状态：2026-11-08 工作区简化实现，尚未部署。发布目标必须是全新空库；B4 内容和旧边不带入。本合同描述当前代码；产品决策与剩余验收见[简化清单](./mentions-graph-simplification-plan.md)。2026-11-06 的同步 set 实现与初始化步骤已失效，保留在[设计评审](./mentions-graph-design-review.md)中作为历史。

> 图节点 ID、资源 URL 入口及 Effects 文件收口已在工作区实现；发布验收仍按简化清单执行。FrontDesk 在本轮提供资源 URL 与 Artiment 状态读取，并继续承担原有的资源读取边界；普通外链规范化留在 Mentions 的关系键处理流程。

## 写入

```text
Article / Doc main / Comment（含回复）/ Ticket 所属 Command 事务
  保存已发布正文
  -> Parser.mentions：只提取结构化 Plate mention 与 a/link
  -> 批量确认稳定目标或普通 URL
  -> 锁来源 Mention endpoint（FOR UPDATE）
  -> 比较旧边与本次正文，更新当前边
  -> 为新增或仍未送达的 User 提及写入 mention.notify Outbox
  -> 提交正文、关系和通知意图
```

普通草稿编辑和 Doc 非 main branch 发布不替换关系。Doc 的 main 和 preview 共用稳定 Doc ID；只有公开 main 的正文产生 Doc 出边。Comment 软删写入 tombstone，但保留删除前的关系；永久删除清理该 endpoint 的入边、出边和从属 Comment 关系。其他状态变化保留边并推进全局图 revision。

关系键区分目标身份、mention case 和规范化 URL。两个独立 Plate 节点指向同一关系时只存一条边，`occurrences_count` 为 2。编辑后仍在的边沿用 `mentioned_at`；移除后重新加入使用新发布时间。正文和关系提交在同一所属事务，失败回滚。结构化 `@ Article` 以稳定 ID 和类型确认，目标即使处于 draft 也保存关系；普通链接按当前 URL 确认规则处理，不沿用旧版本事实。Ticket 不产生 User 提及通知。

## 存储和接口

Ecto schema 位于 `CMS.Model.Mentions`：`Endpoint` 保存稳定资源身份，`Edge` 保存当前可查询关系，`GraphState` 保存全局图 revision。数据库对应 `cms.mention_endpoints`、`cms.mention_current_edges`、`cms.mentions_graph_state`。没有历史 set、occurrence 表、current set 指针、parser version、水位或异步关系投影。新结构由 `20261107100000_simplify_mention_current_edges` 在空目标库建立；迁移明确拒绝非空旧关系库，不提供旧数据兼容或回填。

`mentions`、`mentionedBy` 和 `mentionsGraph` 从当前边分页读取。`mentionsGraph(community, focus, after, first)` 只返回 focus 资源与 Article／Doc／Ticket／Comment 之间直接发出的和直接收到的边；相邻节点的其他边不属于本次结果。普通 URL target 和 User target 仍保存在当前关系中，由一跳 `mentions` 列表按各自目标类型返回，不进入图节点或图边；本轮不扩展图的 Artiment 节点类型。点相邻 Article／Comment 节点跳转对应资源页，不在图内继续展开。`after` 只给当前 focus 的直接关系翻页，单页 `first` 最多 20。图中的已存 Artiment 边及两端节点会返回；受限状态不裁剪可取得的 `title`、`url`、`status`。资源页的 Gate 决定正文能否显示。有可用 locator 的节点可在自己的资源页作为新的图查询起点；GraphQL 节点不再提供 `canExpand`。Comment 图节点 ID 使用父 Article／Doc 在本 Community 的公开编号加 Comment `inner_id`；父资源无 binding 时使用父资源稳定 ID 加 Comment `inner_id`，不使用内部自增 `Comment.id`。`floor` 是线性评论展示序号；Comment 和回复的 `inner_id` 是父 Article／Doc 内的公开定位编号，Graph URL 锚点与稳定 locator 继续使用它，二者不能因通常同时递增就视为同一字段。父 Article 在本 Community 无 binding、但 C 有相邻已存关系时，Comment 使用父资源稳定 ID 路径、非空 URL 和 locator。Doc 只返回稳定 main 身份，没有 branch locator。图页和一跳列表使用全局 revision 保护 cursor 和前端缓存；分页仍有 `first` 上限，数据库超时由 Repo 配置管理，不在业务调用链上传递执行参数，也不维护请求级 SQL 次数或累计时长预算。

`READABLE`、`UNAVAILABLE`、`DELETED` 的对外状态走共享 Artiment GraphQL enum 和资源 lifecycle/Gate 边界。稳定 ID 指向 draft 目标时，图立即返回边和 `UNAVAILABLE` 节点；目标发布后关系不变，状态变为 `READABLE`。Community 的 Post、Blog、Changelog、Doc、Ticket 详情页在公开正文读取被 Gate 拒绝时，直接通过 `CMS.FrontDesk.artiment_status/2`（GraphQL `artimentStatus`）按资源身份读取标题、URL、状态，不渲染正文；无需先查询图。MentionsGraph 批量节点读取也调用 `CMS.FrontDesk.artiment_status/2`，传入已解析身份列表；单项传 locator、批量传列表，不存在另一套 `artiment_statuses/3`。图层只补节点 ID 与 locator。状态页不以 Mention 边或 binding 为准入条件，永久删除的资源不返回状态页。尚无公开编号的 Article／Doc／Ticket 用稳定 Article ID 构造状态页 URL 和图 locator，发布后转用 Community 编号；失去全部 binding 的资源也可凭稳定 ID 打开状态页，无论是否存在提及关系。图查询的稳定 ID locator 仍只接受本 Community 有 binding 或有已存相邻关系的端点；状态页读取与图定位是不同入口。

**Comment 定点访问**：`mentionedComment` 先确认 C 在本 Community 有已存相邻关系，再只按 C 自身的 Comment Gate 读取正文。父资源受限时，状态页显示父标题和状态，不显示父正文及其他评论；点击 `#comment-<C.inner_id>` 后客户端只加载指定 C。C 自身受限或软删时只显示状态，不显示原正文。Comment URL 由 FrontDesk 的完整父路径加锚点：Doc 有 binding 时为 `/<community>/doc/<B.inner_id>/<slug>#comment-<C.inner_id>`（slug 缺失用 `doc`），无 binding 的稳定路径为 `/<community>/doc/<B.article_id>/doc#comment-<C.inner_id>`；普通 Article 不需要 slug。父 B 的状态页凭稳定资源 ID 独立可达；C 的定点正文读取仍要求本 Community 有经 C 可达的已存关系。Doc owner binding 受数据库删除保护，真实 Doc 解绑端到端用例仍待核实；Doc 稳定路径生成已有定向断言。

缺失 Comment 正文行但仍残留 endpoint 时，批量状态读取返回 `UNAVAILABLE` 且不构造标题、URL 或公开定位；如果当前图边仍指向这个无效 endpoint，图查询返回 `mentions_graph_integrity_error`，不伪造可点击 Comment 节点，也不抛运行时异常。该错误表示需要清理的关系完整性问题，不属于普通隐藏或软删状态。

## 通知

每个来源、每个已发布正文 revision 身份至多有一条 `mention.notify` 事件；事件冻结拟通知的 User ID 与本次 Community。worker 投递时复查当前 revision、当前 User 关系、来源与父级的通知准入和 Community binding。隐藏、审核、私密、draft、Trash、Comment 软删或父级受限时不投递。暂时受限的事件保持待投递并延后重试；公开恢复后仍需通过上述核对才投递一次。正文 revision 已变化、关系已移除或来源永久删除时旧事件结束，不复活过期意图。延续关系不重复通知；移除后再加入属于新提及。自我提及、作者和 Ticket 排除规则沿用现有行为。

## 验证与发布边界

本地严格编译、关系定向测试、跨模块测试和完整后端测试是发布前门禁。此前 2026-11-08 模块收口与 Comment 定点访问后代码快照的全量后端原始结果为 **2632/2634 通过、1 excluded、2 项失败**；两项均为普通 Article 稳定 locator 被附加 `comment_inner_id: nil` 的形状回归。修复后含这两项的关系／图定向测试 **48/48 通过**；该次结果不能称为全量全绿。此前 2629/2632 等数字属于较早代码快照。PG17 性能资格、首次成功率、完整发布 p95、锁等待和生产验收尚未完成；不能把本地测试写成生产部署。前端编辑器 Article 搜索仍是后续接入，后端只确认结构化节点的稳定 ID 和类型。

2026-11-08 单资源一跳图与 Comment 公共节点 ID 收口后的全量后端原始结果为 **2638 通过、1 excluded、0 失败**（2639 项）；全量启动后增加的双 Comment ID 断言经相关后端定向测试 **44/44** 验证；随后仅将 Query 内部多 frontier 列表处理收为单页处理，图页／分页／GraphQL 定向 **53/53** 通过。前端 Core 图与恢复测试 **15/15**，Community 受限资源测试 **4/4**；严格编译、Core／Community 类型检查及 `docs:check` 通过。此结果仍不包含 PG17 资格、真实浏览器端到端或生产验收。

本轮缺失 Comment 行的 fail-closed 修复及图目标类型文档收口后，图页／分页／GraphQL 定向测试 **54/54** 通过，严格编译与 `docs:check` 通过。上述 2638 项全量结果属于本轮修复前的代码快照；修复后尚未再跑全量，不把旧结果当作本轮最终全量验收。

单 focus 图页已进一步收为 `revision`、`nodes`、`edges`、`hasNextPage`、`endCursor`；旧的 `neighborhoods` 包装及 frontier 状态枚举不再属于运行时 GraphQL 合同。前端用一个无限分页查询保存当前资源的已读取页，revision 变化或游标失效后从首批重读。性能脚本继续记录 SQL 次数与耗时，但不再按旧的 32 SQL／5 秒应用层预算裁决；历史 B2 测量保持原样。
