# Docs 公共读取 Scope 收口

> 状态：R0–R3 本地实施与专项验收完成，17 文件 173 项测试通过；未部署，目标环境计数 / 外部缓存仍须发布时核验。2026-11-16。详见 [实施与验收记录](./docs-public-read-scope-implementation.md)。用户确认没有已知外部 cursor 消费者，Y 无公开页保留既有状态卡展示。
>
> 本文是 [Docs Mirror Fix](./docs-mirror-fix.md) D2 公共读取子批次的实现细则与专项验收清单。Mirror Fix 拥有产品目标、整体依赖和 D2 完成状态；本文拥有此子批次的实施步骤与退出条件，不重复定义产品合同。该子批次可先于 Passport / co-authors 和 Docs 发布拆分上线，不代表 D2 或 Mirror Fix 整体完成。
>
> 依据：[Gate 当前合同](../feature/gate/README.md)、[V4 typed Context](../feature/gate/v4.md)、[V5 Scope Query](../feature/gate/v5.md)。本文与 Mirror Fix §3.1 / §3.2 / §6.1 同步维护归属和引用，不改变作者权限、正文发布、站点删除或历史保留的产品规则。

## 1. 问题与范围

同一篇 Article A 展示在 X / Y 两站。Y 移除公开页面而 X 保留后，Y 的详情、列表、RSS / sitemap 都应不再返回 A；X 继续可读。

以下是 R0 整改前工作区基线，保留用于解释迁移目标；当前实现与验证结果见 [实施记录](./docs-public-read-scope-implementation.md)，不将基线描述当作仍存在的缺口：

| 位置                                                                                     | 当前处理                                                                                                           | 收口目标                                                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| CMS.Gate.Scope.Article 的 Doc 分支                                                       | 组合 Binding / Public / Lifecycle / Review 等条件，未统一纳入本站公开树                                            | 统一维护 Doc 公共可见集合                                                            |
| CMS.FrontDesk.Article.public_doc_page?                                                   | 单篇读取另查本站公开树；返回 false 时 read_stable 的 else 未匹配该值，静态存在 WithClauseError 路径，尚未运行复现  | 使用相同 Gate Scope，移除重复权限查询并以明确 not-found 处理不可见项                 |
| CMS.Articles.Query.Locator.require_public_doc_page                                       | 批量定位追加树 join                                                                                                | 使用相同 Scope，保留地址解析和批量查询职责                                           |
| CMS.Articles.Pagination.maybe_add_public_tree                                            | 仅 public_tree 选项开启时过滤                                                                                      | 公共 Doc 列表无须调用方记得开启选项                                                  |
| GraphQL docPage → Articles.article_page → Pagination.page                                | 公开入口默认 thread: :doc，resolver 不传 opts，public_tree 默认为 false；静态可证缺少树过滤，尚未运行复现          | R0 首先建立“Y 有 Binding、无公开页”的负例                                            |
| 宏生成的 pagedPublishedDocs → Accounts.Publish.Articles → Articles.Query.paged_published | 真实公开 API，同样进入 Pagination，include_pinned: true，public_tree 默认 false                                    | 与 docPage 分别覆盖旧 cursor / 作者过滤，不将 operation 零引用当作 API 不存在        |
| CMS.Press.Query.validate_stable_public_doc                                               | 加载后再次查询树成员                                                                                               | 消费 FrontDesk / Scope 的结果，不重复查询                                            |
| Communities.Count / SearchArtiments.Indexer                                              | 经 public_binding_ids 读取可见 Binding，继承 Scope 条件                                                            | 按本站 Binding 计数 / 重建搜索投影，损坏 PublicBody 不进入集合                       |
| ArticleStats / DocCover.Query / Accounts.Upvotes / Accounts.CollectFolders.Articles      | 直接或经 facade 消费 public_binding_ids                                                                            | 纳入读取集合与跨社区去重回归                                                         |
| DocTree.Query 的 docPublicTree 导航                                                      | public_docs_by_doc_id 消费 Doc Scope，public_child_map 对缺失投影返回 nil                                          | 新增 Body 条件后损坏条目从导航隐去；记录用户可见变化                                 |
| Comments.Query / Gate.Scope.Comment                                                      | 父 Doc 可见集合影响评论列表、计数及置顶项；本站入口另限定 Community                                                | 验证 Y 无页不能借 X 的父 Doc 入口读取，X 的共享评论及全局存储不受误删                |
| ArtimentMentions.Query / Artiment.Status                                                 | Doc endpoint / status 经公共 Scope 并限定 Community                                                                | endpoint 及 status 使用本站入口事实，不借其他站点公开页放行                          |
| Snapshot.Query.load_summaries                                                            | Article 摘要经 Doc Scope，缺失结果补 unavailable_article                                                           | 盘点 mention / reaction 摘要退化；区分本站入口与无 Community 参数的 Article 聚合     |
| Articles.Query.Mentions / Articles.Query.count_published / SearchArtiments.Capacity      | 直接构造 Doc 公共 Scope，不经过 public_binding_ids；分别用于提及投影、作者公开计数和搜索容量估计                   | R0 登记直接消费者；保持各自 Binding / Article 统计单位，不以一个聚合口径替代全部计数 |
| Articles.BindingPersist.ensure_can_remove_published_article                              | 普通 Article 的 unmirror 使用 public_binding_ids；入口只接受 post / blog / changelog，Doc 返回 unsupported_for_doc | 作为非 Doc 回归项，保持既有删除保护；不据此为 Doc 新增保护查询或产品决策             |

这会导致规则可能改漏、列表依赖选项，以及重复数据库查询。修复应统一查询规则，不是在每个调用方继续补一次检查。

不在本文修改：Passport 存储及 Admin 命名、co-author 关系、ArticleEvent / Diff、Release / Approval、Binding 删除时机、Trash、副作用通知、评论写入、Mention 的唯一历史社区假设、Search 索引删除身份及外部缓存架构。这些仍属于各自合同。

残留风险：即使数据库公共集合已修复，RSS / sitemap / CDN 已缓存的旧条目仍可能在 TTL 内返回已移除的站点入口；数据库验收不代表外部缓存已清空。R0 记录实际缓存及失效路径，外部投递 / 缓存状态单独报告。

发布侧完整性边界：DocTree.Publish.PublicTree.validate_pages 目前只验证 Article + 本站 Binding + ArticlePublic，未显式查询 Body；但 R0 已核对迁移与兼容参考库的 Public / PublicBody 双向延迟 FK，正常提交必须两者存在且版本一致，不能仅凭缺少 Body join 断言可提交永久损坏节点。事务内暂态、旧库缺约束或 schema 落后需分别诊断；读侧防御过滤不替代提交约束，也不证明读写已闭环。D2 保留候选页面验证及事务一致性验收，不在本文修改发布校验。详见 [R0 完整性证据](./docs-public-read-scope-r0.md#6-publicbody-完整性诊断)。

## 2. 唯一权威与调用链

```text
单篇 / 批量地址 -> FrontDesk -> 内部 Locator / 单篇查询
列表 / feed / sitemap / 公开导出 -> 对应集合查询
                         |
                         v
             CMS.Gate.scope/4
                typed Doc Scope Context
                Gate Scope 的 Doc 公共查询分支
                         |
                         v
           同一可组合 Ecto.Query -> Repo 执行
                         |
                         v
             公开投影 / Articles.Public.body
```

- 对外单资源定位继续由 FrontDesk 提供。Locator 是内部将 Community + thread + inner_id 解析成稳定 Article 的批量查询模块，不是新权限入口。
- 公共条件统一归现有 Gate Scope 的 Doc 分支；可以抽取该目录下专用查询 helper，但不新增另一个公开 Scope facade。具体文件拆分遵守现有 V5 命名和 dispatch 规则。
- Scope 只构造 query，不执行 Repo，不逐行调用 Gate，不用列表加载后再过滤。
- Scope 表达每行 ArticleBinding 所属 Community 的公开可见性，不接收请求 Community；单站调用方按 binding / community 限定目标站点，社区聚合集合使用每行关系，不将“任一社区可见”当成“本站可见”。tree 条件必须关联该行 gate_community.id 与 Article.id，不为本批新增请求 Community 参数。
- typed Context 明确读取意图，不得引入自由 map 或缺 Context 的宽松 fallback。`public_binding_ids(thread, actor \\ nil)` 有 actor 参数、没有请求 Community 参数；分页传 viewer，部分消费者使用 nil，必须保留既有 actor-aware Review 语义。
- CommunityChain 拒绝 Scope 保留别名及冲突的 Community / Lifecycle joins。消费者不得将 Scope 直接套到已有这些 joins 的分页查询上；现有分页经 binding.id in subquery(public_binding_ids) 消费，外层仍可为投影 join Public / Lifecycle。“不重复过滤”指公共规则的语义去重，不要求内外查询 join 去重。

## 3. 公共可见条件

仅 Doc 且 policy_mode == :public 时附加本批 tree / 当前 PublicBody 条件。Doc 的公共读取必须在同一查询语义中满足：

```text
当前行 Binding 所属 gate_community 允许公开读取
AND ArticleBinding 关联当前 Article 与该 Community，Article.thread = doc
AND ArticlePublic 存在
AND ArticleLifecycle / Review 允许此次公共读取
AND EXISTS DocsTreeNode (
  community_id = 当前行 gate_community.id
  AND stage = public AND type = page AND doc_id = 当前 Article.id
)
AND 当前 PublicBody 与 Public 的 article_id / snapshot_id 一致
```

公开树检查使用关联 EXISTS，表达成员存在性，保持与现有 maybe_add_public_tree 一致的语义，并避免额外树 join 进入外层消费者的别名空间；它也防御性地保持外层行数，不依赖多 page 重复这一前提。TargetTree.validate_unique 已要求同一目标树全部 page 的 doc_id 唯一，公开 page 另受 (community_id, stage, doc_id) 唯一索引保护，不能构造“本站多个公开 page 指向同一 Article”的合法 fixture。hidden: true 仍算公共直读的页面凭据，沿用 FrontDesk / Locator / Press 现状，不新增 hidden Scope 过滤；docPublicTree 导航会经 hidden_node? 主动隐藏该节点，导航展示与直读准入须分别验收。公共条件同时覆盖列表 count 和实际 entries；分页接线遵守 §2 的子查询边界。

公开树之外的工作区节点、Trash、历史 Release、仅有 Binding 均不能作为本站公开凭据。移除 Y 页面只影响 Y，不能收紧仍公开的 X。

stage: :public 不等于 policy_mode: :public。FrontDesk 管理单读使用 DocContext.public(policy_mode: :owner_management)，insights 使用 stage: :public + :insights_management；两者均不新增 tree / PublicBody Scope 条件，保留现有 Public、Lifecycle、Review 与 actor 准入。管理读取是独立意图，不称为“绕过公网检查”；公网调用方仍必须构造 public Context，不允许外部参数选择管理策略。

草稿 / 预览 / 历史入口保持各自合同；stable 管理单读原本仍要求 Public，不因本批承诺支持从未发布的草稿。当前 Article 配置的非 Doc thread 是 Post / Blog / Changelog，其查询集合及既有默认 public_tree: false 的 cursor fingerprint 字节均保持不变，具体约束见 §5。Ticket 使用独立 Ticket Scope，不构造不存在的 Article Ticket 分页旧 cursor，其独立准入保持不变。

## 4. PublicBody 与错误处理

PublicBody 是公开投影，不是另一套权限来源。Scope 的存在 / 版本关联只保证公共集合中的 Public / PublicBody 对齐，不保证整个投影成功；Snapshot 归属 / 结构、typed extension 等仍由 Public.current / SnapshotProjection 校验，缺失可能在准入后失败。独立报告定位 snapshot_missing / extension_missing，不向 Scope 增加这些投影条件。Articles.Public.body 仍精确按 article_id / snapshot_id 读取，保留 public_body_missing 等既有一致性错误，不回退 Snapshot / WorkingCopy。

- 本站无公开页面、无 Binding 或不可公开读取：目标为 FrontDesk 单读返回 Articles.ErrorCat.article_not_found（6008），集合不返回该条目。R0 基线的树后置检查 false 未被 with/else 捕获；R2 已删除该分支，实测返回 6008。GraphQL 返回 errors[].extensions.code，不把业务 not-found 等同 HTTP 404；用户确认 Community 保留 Content unavailable 状态卡，页面不渲染正文。
- Public 存在但 PublicBody 缺失 / 不匹配：不输出正文，也不返回半份投影。集合排除损坏条目；内部完整性检查 / 日志必须能识别投影损坏，不将其描述为普通权限拒绝。
- R1 / R2 保持现有对外错误映射：FrontDesk.stable_public_projection 将 Public.current/1 失败映射为 article_not_found，后续 SnapshotProjection.build_stable/4 的错误按现状传播。Public.current 已 inner join 当前 Body / Snapshot，缺 Body 对外可映射为 6008；不要求该单读返回 public_body_missing。
- extension 缺失的现有端到端表现：FrontDesk 透传 :article_snapshot_projection_missing，GeneralError 将该非结构化错误归为 unexpected_error；Community loadDoc 只允许 6008，因此抛出请求错误。对于 Public / Body 对齐且 status 仍为 READABLE 的此场景，状态 fallback 返回 null，错误继续进入路由错误边界，不显示 Content unavailable 卡。本批有意保留这一投影损坏的服务器错误协议，不将它伪装成普通不可见，也不承诺固定 HTTP 状态或错误页文案。
- Scope 已匹配后投影读取仍可能因并发或其他投影错误失败，沿用上述协议，不临时读取历史正文补齐。R3 单独明确内部完整性核查入口、诊断结果和测试；若要改变对外错误协议，须先明确并验收新协议，不能用“不吞错”暗中覆盖现状。
- 本批不修改 Public / PublicBody 的写入事务，也不新增逐行诊断查询。完整性核查与公共读路径分开执行。报告以 issue 为行，一篇 Article 可同时存在多个损坏原因；消费方按 article_id 聚合并保留所有 issue，不按 Article 静默去重。snapshot_missing 在当前外键有效时不能合法提交；旧损坏库仍须可报告，extension_missing 可独立诊断且不误称必然映射为 6008。

错误验收按边界区分；以下为源码合同，实际运行范围见实施记录：

| 场景                                  | 服务端 reason / code                                                 | GraphQL / 客户端验收                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| cursor 格式无效                       | invalid_cursor / 4200                                                | extensions.code = 4200，不作为旧查询指纹测试输入                                     |
| envelope 版本 / 密钥版本不支持        | unsupported_cursor_version / 4201；unsupported_cursor_key / 4202     | 区分版本失败与查询不匹配                                                             |
| surface / order / fingerprint 不匹配  | cursor_query_mismatch / 4203                                         | extensions.code = 4203；仅服务端错误结构断言 reason                                  |
| 签名无效                              | cursor_signature_invalid / 4204                                      | extensions.code = 4204，不误当查询迁移恢复                                           |
| 分页配置 API / revision 不匹配        | config_mismatch / 4211                                               | extensions.code = 4211 + mismatch: api / revision，保留现有独立恢复合同，不代替 4203 |
| FrontDesk 单读未匹配 Article          | article_not_found / 6008                                             | extensions.code = 6008；页面 HTTP 状态另验收                                         |
| Public.current / Public.body 缺少投影 | 内部分别为 public_not_found / public_body_missing 原子，不自带错误码 | FrontDesk 对 current 失败映射 6008；不将原子直接当作 GraphQL reason / code           |

## 5. 实施顺序

R0 的环境、实际 API / 客户端、fixture、计数刷新、诊断证据及 B1–B6 待办已记录在 [盘点结果](./docs-public-read-scope-r0.md)。默认 dev / test schema 不兼容且保持不动；本任务已新建 groupher_docs_public_read_r0_20261116，双站 / 旧 cursor 冒烟通过，B1/B2 已解除。后续显式使用任务库。R0 的基线与协议模拟保留为历史证据；R1/R2 新代码及真实 HTTP 4203 / 首屏重取现已另行验证，见实施记录。

| 批次 | 改动                                                                                                                                                                                                                                                                                                                          | 退出条件                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0   | 从 docPage 开始，盘点详情、批量、列表 / count、Press、Search（含 Capacity）、stats、DocCover、upvotes、collect folders、docPublicTree、comments、Mention endpoint / Artiment status、Articles.Query.Mentions、作者公开计数、Snapshot summaries 及 BindingPersist，记录 Scope / actor / Community 限定 / opts / SQL / 缓存路径 | 每入口有当前行为、测试落点与迁移去向；确认 BindingPersist 仅普通 Article 可达并登记非 Doc 删除保护基线；记录发布校验缺口，不把静态缺口当运行复现                                                                        |
| R1   | Gate Scope Doc 分支加入统一 tree / 当前 PublicBody 条件，保持 typed public / management 边界                                                                                                                                                                                                                                  | Scope 真数据库集合、去重、分页与非 Doc 回归通过                                                                                                                                                                         |
| R2   | FrontDesk / Locator / Pagination / Press 消费统一 Scope，删除重复过滤和公共 public_tree 开关；在 fingerprint 内部按 thread 派生布尔位并保留五元组；确认客户端 4203 cursor_query_mismatch 恢复行为，缺失时同一变更补齐重置                                                                                                     | 详情 / 批量 / 列表 / feed 可见性一致，无逐行额外查询（N+1 / 后置 exists）；非 Doc 旧指纹不变，Doc 旧 false 指纹返回 cursor_query_mismatch；按下述步骤验证旧 cursor 链接 / 旧会话清除 cursor 并回到第 1 页重取后才可发布 |
| R3   | 完成其余消费者回归、独立完整性诊断与浏览器验证，清理只服务旧开关的代码并更新 fixture；错误协议调整另行明确                                                                                                                                                                                                                    | count / indexer / comments / mentions / 写入保护等专项、query-shape、公开路由及静态检查通过；回归 R2 已确认的客户端 cursor_query_mismatch 重置行为，验证既有社区计数刷新路径，诊断不增加逐行查询                        |

R1 / R2 应在同一可发布变更中完成，不能删掉调用方保护却尚未接通统一 Scope。Doc 旧 false cursor 从 R2 部署起即被拒绝，因此客户端恢复的确认或补齐及验证必须作为 R2 同一变更的发布门槛，不能推迟到 R3；R3 对客户端恢复仅作回归。R1 / R2 是原子实施单元，R3 是发布前的最终专项验收阶段；首次发布仍须满足全部 R0–R3 相关退出条件，不能把 R3 理解为上线后再补验证。管理查询若仍需要自身 tree 筛选，使用明确的管理语义，不能借保留同名公共开关造成两份权威。

该读取子批次无 feature flag、无 DDL 或数据切换；回滚采用 revert 整个读取变更（含 R1 / R2），会恢复原读取缺口，须记录风险。此回退方式不适用于 Mirror Fix 后续写入 / schema 直切。

fingerprint 用于 cursor 编解码校验，不能直接称为结果缓存 key。R2 删除调用方 public_tree option，但保留指纹原有五元组结构、字段顺序及其他字段编码，在 query_fingerprint/4 内派生 doc_tree_scoped = (thread == :doc)，用它替代原 public_tree 位。不得直接删成四元组而使所有 Article 列表 cursor 一起失效。

同输入下，非 Doc 的派生位仍为 false，须断言序列化输入及 SHA-256 与旧默认 false 指纹逐字节相同，部署前 cursor 继续有效。Doc 旧 false 指纹与新 true 不同，须断言返回 cursor_query_mismatch；旧 true 指纹可能保持匹配，按原协议校验并执行新的 Scope 查询，不复用旧结果。实际响应缓存另行核对失效 / 版本策略。R0 时尚无已验证的 4203 cursor_query_mismatch 专门恢复证据；本地实施已验证两个实际 API 的错误与首屏重取。用户确认无已知外部消费者，仓库也无运行时 Doc cursor UI；不为此新增无调用方的恢复分支。对于后续发现或接入的实际客户端，R2 发布前必须确认收到 4203 时会清除旧 cursor 并从第 1 页重取；若现有客户端不支持，须在 R2 同一可发布变更中补齐并验证。未通过不得将“自动从首页恢复”作为已支持行为，也不得发布 R1 / R2。

指纹不匹配的错误合同为 Pagi.ErrorCat.cursor_query_mismatch()，reason: :cursor_query_mismatch、code: 4203；服务端测试断言 `{:error, %ErrorCat.Error{reason: :cursor_query_mismatch}}`（ErrorCat 为 GroupherServer.ErrorCat），并核对 namespace: {:pagi}、code: 4203。GraphQL 通用 formatter 对该错误只公开 errors[].extensions.code = 4203，不公开 reason；客户端从实际响应的 extensions.code 识别，不要求接收服务端 atom reason。格式无效的 cursor 属于另一个错误 invalid_cursor（4200），不能用其客户端分支或测试断言替代本场景。

当前放行证据：用户确认无已知外部 Doc cursor 消费者；仓库无运行时 Doc cursor UI，两个真实 API 已验证 4203 响应及移除 after 的首屏重取，不将请求层手动重取等同已有 UI 自动恢复。后续接入或发现实际客户端时，须补齐并验证上述恢复路径。

R0 已确认 docPage 与宏生成的 pagedPublishedDocs 两个公开 cursor API；Core 只有 docPage operation 声明及合同登记，未找到两者的运行时产品 UI 调用。Community articleSurface 的恢复逻辑面向 posts / changelogs，且只识别 4211 + mismatch: revision，不能作为已支持 Doc 4203 恢复的证据。仓库外消费者未知；后续用真实客户端或请求层集成用例验证，明确浏览器入口与外部使用证据边界，不虚构 Doc 列表路由或为验收新建产品 UI。

R2 的恢复验证可预先复现：在改动前环境抓取一条 public_tree: false 的 Doc 列表 cursor 及其查询条件，保存旧 cursor 链接 / 旧会话；也可在测试中按旧五元组计算 fingerprint，并通过现有 cursor codec 生成有效旧 cursor。codec / 服务端测试使用 config/test.exs 已固定的签名密钥及 key_version；浏览器验证使用同一隔离环境的前后 build 和受支持的密钥版本，不把测试配置签名的 cursor 直接拿到其他密钥环境验证。固定 surface / order / fingerprint 三元绑定中的 surface / order，仅按旧五元组生成旧 fingerprint；两 build 保持相同的分页 API、config revision、filter、order 及每页大小，避免其他校验先失败。cursor envelope 仅含 cursor_version / key_version / payload / signature，没有有效期；须确保签名和版本校验通过，使失败确实来自 fingerprint 不匹配。随后在 R2 build 打开该链接或恢复旧会话，确认服务端因查询指纹不匹配返回 cursor_query_mismatch，客户端收到 errors[].extensions.code = 4203 后清除旧 cursor、回到第 1 页并发起不带旧 cursor 的新请求，成功显示新 Scope 下的结果且不循环重试旧 cursor。记录错误响应与重新取数请求；旧链接和旧会话覆盖同一错误恢复路径，无须在线拦截进行中的请求。

BindingPersist 的 public_binding_ids 消费只在普通 Article 的 unmirror 路径可达（post / blog / changelog）；Doc 与 Ticket 均被入口拒绝。本批只修改 Doc 公共 Scope，因此不为该保护复制谓词、不新增 published_binding_removal_guard_query，也不据此设置 Doc 删除策略的产品决策门槛。R0 记录 thread guard 与调用路径，R1 / R2 证明非 Doc Scope 及现有 published_article_requires_community 保护不变。Doc 的 Binding 引用清理实际位于 DocTree 发布 / Trash 路径，仍由 Mirror Fix D2 按工作树、公开树及活动 Queue 的引用合同处理，不由普通 Article 的保护推导。

R0 的消费者盘点包含 Search 的实际数据库读取 / projection source；本批只统一其读取集合，不执行索引身份、全局删除事件或 CDN 重试架构改造。已有异步效果仍以当前事实重读，不因本文增加新的公开内容入口。

在 R0–R3 相关退出条件全部满足、管理 / insights 与写入保护保持现状后，可以独立于 Passport / co-author 和 D1 上线；仅 R1 / R2 完成不等于专项验收完成。Binding 清理、Trash、多站点互动及 Search / cache 架构仍属 Mirror Fix D2，其后续 Release / Binding / Trash 改动继续消费本 Scope。

本子批次 R1 / R2 的“非 Doc Scope / fingerprint 不变”仅约束本次 Doc 读取修复。后续 Passport P2B 会为非 Doc 增加本站 Binding Trash 过滤，独立记录其游标兼容策略并验收；P2B 不得改变已收口的 Doc Scope / fingerprint。不能把本轮局部不变承诺解释为非 Doc 永远不能增加本站状态。

## 6. 验收矩阵

以下是目标验收清单；实际已运行范围及发布时仍需执行的环境操作见 [实施记录](./docs-public-read-scope-implementation.md)。§1 为整改前基线，GraphQL 业务错误与页面 HTTP 状态分别判断。

| 场景                                                                           | 单篇 / 集合 / feed 必须结果                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X / Y 都有公开 page，同一 Article                                              | 两站均可读，各按本站定位，不重复复制内容                                                                                                                                                                                                                                                          |
| Y 仅有 Binding，无 public page                                                 | Y 单读返回 article_not_found / 6008，页面保留 Content unavailable 状态卡且不渲染正文；批量 / 列表 / count / RSS / sitemap 均不包含；X 正常（不要求页面 HTTP 404）                                                                                                                                 |
| Y 只有工作树 / Trash / 旧 Release 引用                                         | 不构成公共入口，管理 / 预览保持其独立权限行为                                                                                                                                                                                                                                                     |
| 移除 public_tree option，旧调用仍传 false                                      | 必需条件不可由调用方关闭，旧调用的 false 不再生效；新调用移除该 option                                                                                                                                                                                                                            |
| public page 的 hidden 为 true                                                  | 详情 / Locator / 公共集合仍按可读 page 处理，docPublicTree 导航隐藏；不新增 hidden Scope 过滤                                                                                                                                                                                                     |
| Lifecycle / Review 限制                                                        | 匿名集合按现有规则过滤；登录 / author / 管理授权的既有 Review 差异分别回归，新增 tree / Body 条件不能被公共模式的 actor 豁免                                                                                                                                                                      |
| PublicBody 缺失或 snapshot 不匹配                                              | 不泄漏历史正文或半份投影，内部诊断可定位损坏                                                                                                                                                                                                                                                      |
| Public / PublicBody 提交约束                                                   | 缺失 / 不匹配用 Sandbox 内临时不一致并最终回滚的 fixture；提交校验拒绝损坏状态，不禁用双向 FK，不假设存在合法已提交坏数据                                                                                                                                                                         |
| 两社区 inner_id 相同但 Article 不同                                            | 不串站，不把 X 的 page 当 Y 的 page                                                                                                                                                                                                                                                               |
| 未知 / 缺失 typed Context                                                      | 失败关闭，不自动选择宽松模式                                                                                                                                                                                                                                                                      |
| 管理 / 历史 / 草稿，及普通其他 thread                                          | 保持现有各自准入，不误加 Doc public tree 要求                                                                                                                                                                                                                                                     |
| 已有 Public、无本站 public page 的 owner_management 单读及 insights_management | 保持现有授权下的结果，不因 stage: :public 新增 tree / Body 条件；未授权仍拒绝                                                                                                                                                                                                                     |
| 批量定位含重复地址 / 不可见地址                                                | 维持原顺序和重复输入语义，不可见项按既有协议处理，无 N+1                                                                                                                                                                                                                                          |
| Communities.Count 与分页 count / entries                                       | Y 无页则重新计算的本站计数排除，X 保持；按 binding.community_id 限定本站。分页 count 是即时查询，Communities.Count.update 写入 community.meta / articles_count，R3 须验证既有刷新路径及发布时刷新安排，不能只凭 SQL 断言已存计数自动更新                                                          |
| 作者公开计数 / SearchArtiments.Capacity / Articles.Query.Mentions              | Y 无页时去除 Y 的可见 Binding；X 仍有页时保留 X 投影。现有 count_published 和 Capacity.article_counts 按 Scope 行计数，Capacity.article_documents 对 Article 去重，不能要求它们彼此相等或统一改成按 Article 去重；Mentions 的 identity pair 保持本站关联                                          |
| SearchArtiments.Indexer 的 sync_binding / Article 重建                         | Y 无页不生成本站投影，X 正常；缺失 / 不匹配 Body 不进入投影 source；异步旧任务重读当前事实，既有外部条目清理另行报告                                                                                                                                                                              |
| ArticleStats / DocCover / upvotes / collect folders                            | 继承正确 Binding 可见集合，跨社区聚合保持原去重单位                                                                                                                                                                                                                                               |
| page 成员匹配与分页行数                                                        | 同一 page 节点只匹配一次，节点数不放大 count / limit / cursor；由 (community_id, stage, doc_id) 唯一索引保证，EXISTS 防御性兜底，不构造非法重复 page；使用合法唯一 page fixture 验证关联 EXISTS 与外层查询组合后的结果                                                                            |
| docPublicTree 导航遇缺失 / 不匹配 Body                                         | 损坏 Doc page 从导航隐去，不生成死链；X / Y 按本站集合，记录这是读侧用户可见变化，树中原节点未因此删除                                                                                                                                                                                            |
| Doc 公共评论列表 / replies / pinned / count                                    | Y 无页时公共父 Doc Scope 排除本站，直接 Query.page 可返回空 entries / count，comments_state 的 public_parent? 失败返回 resource_not_found（4601）；通过外层 FrontDesk 定位的接口按该入口协议拒绝，不把所有调用统一断言为 404。X 保留共享评论，持久化全局计数 / 关系不清除；跨站聚合保留原去重单位 |
| Doc source endpoint / type: :doc 的 Artiment status                            | Y 无页时不作为本站可用 source endpoint；已有 published Lifecycle 的 Doc status 为 unavailable，X 为 readable；Body 损坏同样影响可读判定。status 仍可返回元数据，不误断言整个对象 404；deleted / destroy 保留原分类优先级                                                                          |
| mentioned_target Comment Context                                               | 保留其按 Comment 自身状态准入、独立于父正文的既有合同；不把公共讨论列表的父 Doc tree 条件套到此分支                                                                                                                                                                                               |
| Snapshot mention / reaction summaries                                          | 无任何符合 Scope 的公开 Binding 时退化为 unavailable_article（unavailable: true）；Y 无页但 X 可读时，Article 聚合不得被误断言为必然 unavailable；R0 记录无 Community 参数及地址选择的残留边界                                                                                                    |
| BindingPersist 普通 Article 删除保护                                           | Post / Blog / Changelog 的 published_article_requires_community 行为与基线一致；Doc unmirror 仍为 unsupported_for_doc，不构造不可达的 Doc 删除保护 fixture                                                                                                                                        |
| Post / Blog / Changelog 部署前默认 false cursor                                | 同输入旧 / 新 fingerprint 字节相同，cursor 不因本批失效                                                                                                                                                                                                                                           |
| Doc 部署前 false / true cursor                                                 | 旧 false 返回 cursor_query_mismatch；旧 true 若原绑定校验通过，仍执行新 Scope、不复用旧结果；R2 发布前按 §5 的复现步骤验证旧 cursor 链接 / 旧会话清除 cursor 并回到第 1 页重取，两个 API 请求层已验证；用户确认无已知外部消费者，仓库无对应运行时 UI，后续实际客户端须补齐自动恢复验证            |
| 部署后的实际响应缓存 / RSS / sitemap / CDN                                     | 记录失效 / 版本 / TTL 验证；若仍返回旧条目，明确残留窗口，不以数据库测试声称缓存已清空                                                                                                                                                                                                            |

浏览器验证使用任务库 xx 社区；当前独立 Community host 的实际路径为 /xx/doc/...，已按现有路由验证，未新增 /home/xx 路由；数据库测试使用隔离 fixture：同一 Doc 在 X / Y 两社区都有 Binding，只在 X 有 stage: :public、type: :page 的节点，再扩展双站各有一个 page、非页节点（link / pin）及 hidden 场景。不得绕过唯一约束插入本站重复 page doc_id；重复 page 发布的拒绝验收归 Mirror Fix D2 写入合同。用真实数据库验证 query 与分页，不能只 mock 返回列表。

测试落点以 backend/api/ 为基准；R0 确认现有文件，缺少覆盖时在对应测试目录新增用例：

| 测试位置 / 模块                                                                                                                                                   | 必须覆盖                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| test/groupher_server/cms/gate/scope/article_test.exs                                                                                                              | 保留无 doc_branches 断言；public Doc SQL 含 doc_tree_nodes / article_public_bodies，关联行内 community / article；管理及 insights 不新增两条件；非 Doc 回归                                                                                                                                                                                                |
| test/groupher_server/cms/front_desk_test.exs、test/groupher_server/cms/articles/query/locator_test.exs                                                            | X 正例 / Y 负例、重复地址、link / pin 及 hidden、管理模式及现有投影错误映射；Y 无页稳定返回 article_not_found（6008），不抛 WithClauseError，无后置逐行树查询                                                                                                                                                                                              |
| test/groupher_server/cms/articles/pagination_test.exs、test/groupher_server_web/query/pagination_contract_test.exs                                                | resolver 不传 opts 的 docPage Y 负例；count / entries 同条件，pinned / limit / cursor 不放大；服务端非 Doc 指纹字节不变，Doc 旧 false 断言 `{:error, %ErrorCat.Error{reason: :cursor_query_mismatch}}`（ErrorCat 为 GroupherServer.ErrorCat，code: 4203）、旧 true 执行新 Scope；GraphQL 集成另断言 extensions.code = 4203，不以 Elixir tuple 断言协议输出 |
| test/helper/orm/pagi_cursor_codec_test.exs、test/groupher_server_web/error_response_test.exs；Doc 4203 客户端用例由 R0 按实际消费者登记                           | codec 区分 4200 / 4203 / 4204；formatter 仅公开 code；R2 客户端按 extensions.code = 4203 清除旧 cursor 并重取                                                                                                                                                                                                                                              |
| test/groupher_server/cms/press_test.exs                                                                                                                           | 删除 validate_stable_public_doc 后无额外 DocsTreeNode exists 查询；统一 Scope 内的树 EXISTS 保留，feed / sitemap 同集合                                                                                                                                                                                                                                    |
| test/groupher_server/cms/communities/count/update_count_field_test.exs；拟新增 test/groupher_server/cms/search_artiments/indexer_test.exs                         | 本站计数、sync_binding / Article 重建、损坏 Body 投影排除与当前事实重读                                                                                                                                                                                                                                                                                    |
| Articles.Query.Mentions / count_published / SearchArtiments.Capacity 对应测试由 R0 登记                                                                           | 直接 Doc Scope 消费者的行级 Binding 条件与原统计单位不变；区分作者 / 容量 Binding 行计数及正文 Article 去重计数                                                                                                                                                                                                                                            |
| test/groupher_server/cms/articles/bindings_test.exs；拟新增 test/groupher_server/cms/insights/query_test.exs                                                      | 普通 Article 删除保护基线及 Doc unsupported_for_doc 不变；insights 保持现有授权与无页行为                                                                                                                                                                                                                                                                  |
| test/groupher_server/cms/comments/query_test.exs、test/groupher_server/cms/gate/scope/comment_test.exs                                                            | 本站父 Doc 准入、列表 / replies / pinned / count；Y 无页负例与 X 共享评论正例                                                                                                                                                                                                                                                                              |
| test/groupher_server_web/query/cms/artiment_mentions_test.exs、test/groupher_server/cms/mentions_graph_query_test.exs；Artiment.Status 测试由 R0 登记             | Mention endpoint 与 status 按本站可见性，既有输出协议不变                                                                                                                                                                                                                                                                                                  |
| test/groupher_server/cms/snapshot_test.exs；拟新增 test/groupher_server/cms/doc_tree/query_test.exs                                                               | 摘要 unavailable 的全站不可读条件，导航隐去损坏 Body 条目；不把 Article 聚合误当本站读取                                                                                                                                                                                                                                                                   |
| test/groupher_server/accounts/upvotes/reacted_articles_test.exs、test/groupher_server/accounts/collect_folders/pagi_test.exs；stats / DocCover 测试文件由 R0 登记 | 聚合去重不变，stats / DocCover 不串站                                                                                                                                                                                                                                                                                                                      |

R3 的独立完整性检查须以损坏 PublicBody fixture 证明可定位 article_id / snapshot_id；公共单读按既有映射返回 article_not_found（6008）不算诊断失败，但不能以该结果或页面 404 证明已识别损坏。

验证命令按实际修改选取：focused Gate.Scope / FrontDesk / Locator / Pagination / Press 测试，mix compile --warnings-as-errors，公开 Community / Press 路由验证；若改变 schema 才执行 schema / codegen / generated freshness。docs:check 仅证明文档 / 静态门禁，不证明业务集合正确。实施记录必须注明分支、环境、实际通过及未运行项目；本文 planned 不表示这些验证已执行。
