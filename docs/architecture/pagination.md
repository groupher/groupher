# Pagination 与列表读取合同

本文件是 Pagi 全量收口的有效设计。分页业务统一使用一个输入、两种执行方式和标准 PageInfo；不设置历史数据兼容窗口，不保留旧接口、response adapter、Generic fallback 或双写路径。实现验收以源码、生成 schema、调用方和回归测试为准。

## 1. 配置与访问方式

技术层同时支持 offset 和 cursor。管理员配置只决定访问时的默认 API、交互和默认数量，不禁止另一种 API。

Dashboard 保存社区级 `pagi_mode` / `pagi_mobile_mode`（GraphQL/Core 为 `pagiMode` / `pagiMobileMode`），取值 `page / load_more / infinite_scroll`；Posts、Changelogs 和主评论列表共同遵循它，不提供按资源覆盖。服务端 `pagi_revision` 用于并发控制与缓存隔离，不是产品选项。桌面默认 page，手机和平板布局默认 infinite_scroll；两项原子保存、共享 revision。每批默认 20，硬上限 100，由平台策略拥有。

| 当前布局选中的 mode | 主要列表默认 API / 交互 | 展开的回复            |
| ------------------- | ----------------------- | --------------------- |
| page                | offset / 页码           | cursor / 点击加载更多 |
| load_more           | cursor / 点击加载更多   | cursor / 点击加载更多 |
| infinite_scroll     | cursor / 自动加载       | cursor / 点击加载更多 |

管理表格可显式选择 offset。回复技术层仍接受 offset/cursor，但当前产品展开列表固定 cursor 手动追加。设置在社区级“浏览体验”中统一呈现，不放到各 thread 行为页。

布局使用现有 xl 断点：宽度小于 1280px 采用 pagiMobileMode，否则采用 pagiMode，不按 UA 判断。每个列表进入时确定布局，窗口缩放不重置已加载位置；切换列表身份后重新选择。SSR 无可靠 viewport 时，默认访问只输出列表加载占位，hydration 后按真实宽度注册唯一的分页查询，不先请求桌面 Page 再切 cursor；显式 offset 位置链接仍可 SSR；cursor 链接保留位置，交互模式在视口确定后选择，避免 hydration 前后 query identity 改变。

优先级：显式 URL 位置 > 当前布局默认值。Articles 的 `pagiApi=offset|cursor`、`page`、`after` 保存位置；comments 对应 `commentsApi`、`commentsPage`、`commentsAfter`。带 page 的链接明确表示 offset，带 after 的链接明确表示 cursor。切换后台默认值后，原链接继续使用其指定方式。URL 不冻结 revision，调用方从最新 bootstrap 获取 revision；cursor 签名不绑定默认 API/mode/revision。

两种方式指向同一可见集合和排序，可以共同访问，但不是无成本的随机位置换算：第 N 页不能凭空变出同位置的 keyset cursor。改 sort/filter 必须回起点；分享 cursor 链接必须保留相同查询条件。集合是 live 数据，不保证插入、删除或排序指标变化后页面内容完全不变。

## 2. 输入、执行与输出

业务 filter 不得包含 page/size/first/after。所有 GraphQL 分页参数放在独立 oneOf `PagiInput` 中：

```graphql
pagi: {offset: {page: 2, size: 20, configRevision: 7}}
pagi: {cursor: {first: 20, after: "opaque-signed-cursor", configRevision: 7}}
```

同一请求只能选择一种方式。省略 pagi 按资源有效配置读取第一页。配置存在时显式请求必须携带当前 revision；没有社区配置的资源不接收伪造的 revision。

```text
GraphQL / Domain
  -> canonical Pagi Params
  -> domain Gate + Lifecycle + business filter
  -> Pagi.Order + query fingerprint
  -> ORM.pagi
  -> Flop (private execution dependency)
  -> Page.Offset / Page.Cursor
  -> resource projection + entries / pageInfo
```

`Params` 统一校验正整数、size、深度、revision、oneOf 形状。SQL schema 必须声明 Flop sortable/cursor 字段，不提供未登记 schema 的 offset 降级。Order descriptor 是唯一 ORDER BY owner，查询不得预置 order。稳定顺序包含唯一决胜字段；NULL 方向显式定义，应用时间使用 UTC。

Offset PageInfo：`page, size, totalCount, totalPages, hasPreviousPage, hasNextPage`。Cursor PageInfo：`startCursor, endCursor, hasPreviousPage, hasNextPage`。GraphQL 以 `__typename` 区分两个 PageInfo 类型；Core 可增加 api discriminator。cursor 不伪造 count 或页码。

Offset count 来自同一个已授权、已过滤集合，join 去重后的 entry identity 决定 count；cursor SQL 使用 keyset + 多取一条判断终点，不执行 count。空结果同样返回正确类型和完整边界信息。

### 2.1 Cursor 与安全边界

CursorCodec 提供版本化、URL-safe、签名且有长度上限的 envelope。外部 cursor 不能暴露裸 Flop 或未签名位置。绑定 surface、完整 order identity、查询 fingerprint；fingerprint 包括资源/所有者、关系方向、filter/sort 和权限范围。变更收件人、root、文章、community 或筛选条件必须拒绝复用 cursor。

签名 key 轮换由显式 keyring 管理。伪造、损坏、未知版本、查询不匹配、超限、过期 revision 分别返回 Pagi 错误，不悄悄改为第一页。只有明确的 revision mismatch 可刷新 bootstrap 后重试一次；cursor 失效由界面提供回到起点的操作。

### 2.2 外部排序服务

Algolia 的 relevance 排序由 provider 执行（[offset](https://www.algolia.com/doc/api-reference/api-parameters/offset) / [length](https://www.algolia.com/doc/api-reference/api-parameters/length) 官方合同），不假装成 SQL keyset。`Pagi.Window` 是 Pagi 的有限排名窗口执行器：复用 Params、CursorCodec 和 Page；callback 接收绝对 offset/size，直接返回可访问结果及总数。cursor 保存经过签名和查询绑定的 provider 位置，允许改变本次 size。

Algolia 索引的排名窗口为 1000。两种 API 都受这个 provider 深度限制，不能承诺无限遍历；cursor 响应不暴露 total，但 provider 本身可在查询响应中附带 total。外部请求不会为了 cursor 另发 count 请求。权限和过滤必须由 provider 的查询条件完成，不能先分页再客户端丢弃不可见结果。

## 3. 资源范围与 identity

| 集合                                               | 处理                   | 验收重点                                                                  |
| -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| Article 各普通 thread、用户发表                    | Pagi                   | 资源身份和状态 filter 绑定分页查询                                        |
| Ticket Kanban 各状态列                             | Ticket Query Page      | 每列按 Ticket 状态独立分页，filter 与查询 key 一起变化                    |
| 评论主列表、回复、用户发表、折叠、审核失败、参与者 | Pagi                   | 真正 entry identity；预览不充当第一页                                     |
| 登录设备会话                                       | Pagi                   | 当前有效会话确定 owner，分页先排除已撤销/过期记录；Auth 网关透传标准 Page |
| 用户、关注者、关注中、订阅社区、可管理社区         | Pagi                   | 以返回的 User/Community 为分页实体，不对关联表排序后读取另一实体的 cursor |
| 收藏夹、收藏条目、赞过的文章、点赞/收藏用户        | Pagi                   | 关联条目拥有顺序时先对真实条目生成 cursor，再 batch hydrate               |
| 通知、提及、文章提及关系                           | Pagi                   | cursor 绑定收件人/关系方向和 filter                                       |
| 社区、订阅者、管理员                               | Pagi                   | viewer enrichment 不改变页边界和数量                                      |
| 资源库、引用记录、举报、回收站、审核队列           | Pagi                   | 权限范围先于 count/分页；空结果也有完整 PageInfo                          |
| Docs 版本历史、Docs 回收站操作                     | Pagi                   | branch/doc identity、统一读权限和批量不可变内容装配                       |
| 文章/社区活动记录、公开搜索结果                    | Pagi                   | 不能以手写 offset 或第三方旧响应逃逸统一合同；明确 provider 能力          |
| 默认社区推荐、autocomplete、回复预览               | 有界集合               | 显式固定上限，不伪造 PageInfo/count                                       |
| 分类配置、导航树、OAuth 绑定等有界配置             | 普通集合               | 不强制分页；检查真实数据与产品约束                                        |
| 统计汇总、后台完整扫描/导出                        | aggregate / 具名 batch | 不提供假分页；批处理不冒充产品列表                                        |

社区申请的 owned history、review queue、event history 同样使用 Pagi；删除 first/after 自制游标及 edges/connection 转换。审核授权仍由领域 facade 负责，events 在已授权 application 下读取。

User/Community 关系页以返回实体为排序和 cursor owner，关联表只筛选 membership。收藏、upvote 等顺序由关联条目拥有时，以关联身份分页再批量读取 Lite；多 binding 场景 cursor 的唯一身份包含 binding id。不得按 A 表排序却从 B 表对象取 cursor 值。

静态配置、分类、导航树、明确有界的建议/搜索 picker/回复预览使用普通集合，显式规定上限。统计是 aggregate，导出/完整扫描是具名 batch；两者不制造假 PageInfo。新增集合必须先归类，不能用“底层调用已归零”证明全量迁移完成。

## 4. Article Lite 与批量边界

Posts、Blogs、Changelogs、Docs 与用户发表读取 ArticleLite Page，返回真实路径身份、title/digest、author、community/tags、时间和所需 cat/status。Ticket Kanban 使用独立 Ticket Page 与 Ticket 专属 projection，不把 Ticket 伪装成 ArticleLite。正文、assets、完整 operational state、aggregate stats 和 viewer state 不混入普通 Article 列表。

普通社区 feed 的 pinnedEntries 在第一页独立返回，与普通 entries/count/cursor 分开；owner Post list 需要全部身份时以明确 include_pinned 策略参与该集合。Ticket Kanban 按 TicketState 读取，不把 Post pin 策略移植为 Ticket 状态。不能在前端把 Lite 伪装成富 Article 或补造 meta.thread。

Press 读取不可变 published revision/body 的专用 publication batch；完整发布内容不通过普通列表旧响应 adapter 获取。ArticleStats、viewer batches 和正文读取分别拥有自己的权限与缓存。

每页可使用一次主查询加固定次数 batch/preload。禁止 Enum.map 中逐 entry 调 FrontDesk、逐根评论查回复、逐条 asset 查引用；批量大小由页大小或显式集合上限约束。

## 5. Comments：两层展示与未来树形扩展

### 5.1 集合与关系

- 当前产品展示根评论和一层平铺回复；回复可以回复任意同文章评论，真实 `reply_to_comment_id` 不得被改写为 root。
- `root_comment_id` 表示讨论串归属，服务端从 canonical parent 推导；parent/root 不由客户端指定。根评论的两者均为空。
- `commentPage(article, mode: REPLIES|TIMELINE, filter, pagi)`：REPLIES 分页根评论；TIMELINE 分页全部可见评论。
- `commentReplyPage(comment, filter, pagi)`：分页该根评论的全部可见后代，排除 root 本身；初期默认时间正序，以 id 决胜。
- 回复关系与展示深度分离。未来直接子评论集合使用 `reply_to_comment_id = parent.id`，继续复用 Pagi，不把整树塞进单个 Page，也不预建递归 DTO。
- root/parent 必须同文章；cursor fingerprint 绑定 article、root、集合类型、filter/sort。配置 revision 与默认 api/mode 不绑定 cursor。
- 删除父节点时保留后代关系；响应不能泄漏不可见父节点正文，客户端提供缺失上下文提示，不因展示平铺修改存储关系。

### 5.2 响应与批量预览

- `CommentPage` 返回 `entries/pinnedEntries/pageInfo`，置顶和解决方案只在集合起点独立返回，不污染普通 count 和 cursor。
- 根评论的 `repliesCount` 表示当前读权限/过滤口径下的全部可见后代数，不冒充未来的直接子节点数。
- `replies` 是有界 reply preview，最多 3 条、时间正序，从真实 Comment 行按 root 批量生成；嵌入投影不是分页或权限 authority。
- 预览使用与展开列表相同的可见性范围；对本页所有根评论一次 window query + 一次 grouped count，不逐 root 查询。
- 回复页不再嵌入下一层 preview。body、author、reply target 和 interaction 按本页批量装配；不可见 reply target 不返回正文。
- 预览不属于正式分页。点击展开请求正式第一页并替换预览；offset 后续翻页、cursor 后续累积，均以 PageInfo 判断终点。不要从预览长度推导下一页。
- 摘要先使用回复数量和截断的预览正文，不引入生成式摘要。没有预览但数量非零时仍显示展开入口。

### 5.3 前端所有权

- 根评论列表和每个 root 的回复列表拥有独立 TanStack Query cache、分页位置、loading/error/retry；禁用模块级 replies 页码和跨 root 的共享请求序号。
- finite/infinite query 使用不同 key，包含完整 article path、root、mode、sort、size、显式 api、schema/revision；SSR 与 browser 共用 builder。
- 公共回复数据与 viewer state 分开。新增 cursor chunk 只 batch 该 chunk 的 viewer IDs，不重取历史全部 IDs。
- 写操作继续使用现有 Command/receipt 管道；公共 projection 更新、临时记录、回滚、receipt reconciliation 与失效覆盖 root/timeline、preview 和独立 replies cache，包括 infinite pages。
- offset/cursor 同时支持；管理员设置是默认值。主列表遵循当前布局的 pagiMode / pagiMobileMode 和显式 URL；展开回复始终 cursor 点击加载更多，不继承主列表 offset 或 infinite_scroll。
- api/config 切换不改变回复关系；query key 隔离旧请求，切文章或卸载不会把迟到结果写入其他列表。

### 5.4 删除与验收

- 同批删除主列表/回复旧 GraphQL 字段、document、分页手工合并 helper 和对应 legacy response conversion；所有其他分页资源遵守同一删除规则。
- roots/timeline/replies 均覆盖 offset/cursor、空页、末页、同时间戳和稳定顺序。
- 覆盖多层真实回复的两层展示、跨 root cursor 拒绝、权限/折叠范围、三条预览和正式第一页替换。
- 覆盖多个 root 并发、失败重试、文章切换、mutation/receipt 对 finite/infinite cache 的一致性。
- 覆盖配置默认 api 改变后的显式双模式访问；验证 batch preview SQL 数量不随 root 数增加。

## 6. 前端缓存和界面

TanStack Query 保存服务端 canonical Page。finite 与 infinite query 分开命名，key 包含资源路径、集合类型/root、filter/sort、size、显式 API、schema/revision 和初始位置。SSR、browser、预取共用这些 builder。删除 toLegacyPagi、toPagedPosts/toPagedChangelogs 和旧平铺 metadata 类型。

置顶组合和 live cursor 去重属于展示阶段，不改写缓存协议。去重按完整 public path，保留每页 chunk；stats/viewer batch 随 chunk 加载，后续页不重新请求已加载全部身份。未登录公共数据不能夹带私人 viewer flags。

每个实际列表都有独立 position、pending、error/retry 和终点；筛选、资源身份变化重置位置，迟到响应不得覆盖新集合。offset 控件读取 PageInfo 边界且限制跳页范围；cursor 用签名 endCursor，失败只重试该集合。独立回复列表、资源引用列表和 Kanban 列不能共用一个全局页码。通用分页控件不依赖社区配置 Provider，宿主可直接传入本地化标签；Apply 等独立应用无需伪造社区上下文。

Mutation/Command receipt 对所有相关 finite/infinite cache、preview、summary 和 stats 采用一致失效或精确更新，失败回滚也覆盖同一集合。默认设置切换不改变数据关系，旧 cache 与新配置通过 key 隔离。

## 7. 验收与可观测性

- 覆盖 pagiMode / pagiMobileMode 的独立默认值、原子保存和 revision 冲突；1279/1280px 边界、SSR/hydration、显式双模式链接、缩放不丢失位置，以及所有布局下回复固定手动加载。
- 对每类资源覆盖 offset/cursor、空页/末页、相同时间戳、稳定身份、筛选和权限范围，以及跨资源/跨条件 cursor 拒绝。
- GraphQL 不再接受旧分页 filter/字段；生成 schema、typed documents、SSR、mock-server fixtures 与所有运行时 consumers 一起切换。
- 覆盖管理员切换默认 API 后显式双模式链接的 SSR/browser 一致性、独立回复分页、重试、切换资源和 mutation receipt。
- SQL cursor 查询不执行 count；多根预览及 Lite/batch hydration 查询数不随 entry 数线性增长。外部 provider 使用独立受限窗口预算。
- Pagi telemetry 记录 resource、surface、API/config identity、order、query count、count/db/overall duration、entry count 与错误类别，不记录正文、私人身份、完整 filter 或原始 cursor。
- 检查真实分页索引和 EXPLAIN；配置迁移、开发环境部署与测试通过属于不同验收项，不能相互替代。
- 不迁移历史数据、不保留兼容中间层；本轮开发库只执行社区 Pagi 偏好相关 DDL，不顺带执行其他待迁移项。

静态 inventory 与 N+1 扫描只是防回归辅助手段，不能替代完整调用链与行为测试。收口报告必须列出实际执行的检查和未完成的验证，不能把设计目标写成已经验证的结果。

Docs 的版本历史、单版本读取和 diff 统一先按 canonical branch/community 经 Gate 的 Docs 访问策略，再校验 Article binding；分页前授权，不在投影中逐条检查。此改造不更改 Gate 现有角色策略。Docs 导航树仍为完整配置树；回收站按 TrashAction 身份分页，不以子节点数量计数。

## 8. 管理员与分类边界

管理员列表按 CommunityModerator membership 分页（offset/cursor），批量 preload User/Passport，返回 isRoot 与权限摘要；Common Community 不再嵌入全量 moderators，详情与 mutation 不再整体 preload。About 页和 Dash 管理页分别拥有分页位置。权限编辑器只按选中的 login 加载权限，当前操作者身份判断来自 Account Passport；新增/移除/权限更新失效对应账号、社区的管理员 Page。候选搜索为有界 picker，必须在 limit 前排除现有成员。

Category 的数据库关联保持；无消费者的 GraphQL Category.communities 删除。未来分类社区列表复用 pagedCommunities 的 category filter，不另造未分页数组入口。
