# Passport Permission、Admin 与 Messaging 收口

> 状态：P1 基线、P2 Admin 请求 / 管理接口、P2B 非 Doc 本站 Trash 与 P3 Notices 已完成本地实现及定向验收，尚未发布。P4 全消费方清理 / 最终迁移验收未开始；它依赖 C3、D1 / D2 消费者切换和 D3 验收。四份文档边界与跨模块依赖复审记录见 §7.1。2026-11-17 更新。
>
> 本文拥有权限目录 / Action 一一对应、Admin 命名、Community ref、Passport 并发写入、Community Admin 请求以及 Notices 接入。Article 成员合同见 [Co-Authors](../feature/article/co-authors.md)，内容追溯见 [修改历史 / Diff](../feature/article/edit-history-diff.md)，后续站点修复见 [Docs Mirror Fix](./docs-mirror-fix.md)。
>
> 直接切换目标名称和协议，不保留旧 alias、双读、双写或兼容字段。不默认建设旧授权数据迁移流程；实际需要保留的数据另做一次性转换，不借切换删除正文、编辑历史或审计。

## 实施原则

本轮按已确认设计直接实现，不要求逐键审批或签字。旧权限 / 写入口清单用于定位调用方、替换旧路径和防止漏改，不是额外产品决策流程。新协议直接切换，不提供历史键兼容、别名、双读双写、fallback 或过渡入口；现有数据仅在实际需要保留时安排一次性转换及针对性验证，不默认要求生产副本或迁移演练才能开发。确有未决定的用户行为才提出具体场景讨论。实现与发布分别验证，不用尚未实现功能的测量结果阻塞其开发。

## 1. 目标及当前差距

| 当前定位                                                        | 已核实基线 / 待改目标                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Helper.PermissionConfig / PermissionRegistry                    | 现有权限目录及 action → requirement → grant 映射；目标目录在 Passport 内部，无别名映射  |
| CMS.Passport.Registry / Assignment / Authorization              | 多层 delegate；目标公开 Passport，内部 Catalog / Store，消除纯转发链                    |
| CMS.Communities.Moderators、CommunityModerator                  | 改为 Admins / CommunityAdmin；表 communities_admins                                     |
| GraphQL addModerator / updateModeratorPassport、Dash admins     | 前端页面已叫 Admin；剩余 schema / operation / types / state / query key 统一 Admin 名称 |
| cms.passports.rules                                             | 旧每用户 JSON 退出权威；Community 授权迁入 communities_admins，Global 授权独立存储      |
| global.god、社区 root                                           | 直接转换为系统 root、社区 lord；owner 归属不变                                          |
| Messaging.Model.Notification / Messaging.Notifications.Delivery | 改为 Notice / Notices.Dedup；公开入口 notify，Inbox 唯一收件箱概念                      |
| Accounts.Mailbox                                                | 用户上只保留 Inbox 摘要；读 / 已读 / 未读事实归 Messaging                               |

上表是改造输入，不是完成声明。现有源码入口：cms/passport/、cms/communities/moderators/、helper/permission_config.ex、helper/permission_registry.ex、groupher_server_web/middleware/passport.ex、schema/cms/mutations/community.ex、frontend/core/unit/PassportEditor/、unit/DsbThread/logic/useAdmins.ts、messaging/、accounts/mailbox/。实现先盘点这些入口及 facade / GraphQL / generated / seeds / tests / job 消费者，不能只替换 UI 文案。

## 2. 固定术语与特权

- Passport 统一回答谁在指定 scope 拥有什么 Permission。
- Action 是当前业务操作；字符串与 Permission 相同，不交替使用其他授权术语。
- grant / revoke 是授予 / 撤销；Review 是内容审核，approve / reject / hide / restore 是具体动作。
- 分类字段一律 type 或领域限定的 *_type。

| 身份            | 授权含义                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------ |
| 系统 root       | Groupher 系统管理者；独立 Global 授权行的 is_root 是平台 Passport 特权，由系统运维流程设置 |
| Community lord  | 本 Community 全部 Passport 权限的 Admin；不是 Article owner                                |
| Community admin | 当前管理成员，只持有明确授予的权限                                                         |
| Article owner   | Article.author_id 表达归属，默认 Article 权限由 Passport 统一推导                          |

普通 Admin 不可邀请、移除 Admin 或改他人授权；这些管理动作只允许该 Community lord / 系统 root。相关动作在目录中存在，但不进入普通可授予列表，不再出现“勾选可管理、Gate 又拒绝”的矛盾。Community 的 lord 不自动获得 Article 权限。root 特权只解决 Passport 判断，不跳过 Gate 的资源状态、Review 和领域 revision / 发布条件。

lord 的设置 / 取消及系统 root 的设置不开放给普通权限编辑 payload。现有社区 lord 转移若无产品入口，本批不新增；初始化流程建立首个 lord，系统运维可显式维护。系统 operations 内部身份保留独立可信工作流，不伪造普通用户授权。

## 3. 统一授权与按资源存储

```text
外部 Community.ref / 明确的 slug 路由
  -> FrontDesk 定位 canonical Community
       ref 对外稳定标识
       id  内部 FK / SQL / lock
  -> Passport 从对应授权行读取
       Global    -> global_passports
       Community -> communities_admins
       Article   -> article_co_authors
  -> Gate 准入 -> 领域命令
```

### 3.1 Community ref

新增 communities.ref：text NOT NULL UNIQUE，不可修改；服务端使用 CSPRNG 生成 cm_ 前缀加至少 128 位随机量，冲突重试。不是内部递增 ID 的可逆编码。FrontDesk.community 增加明确 ref locator（如 {:ref, ref}）；现有 slug 路由仍明确按 slug 解析，不猜测自由字符串类型。新增管理命令 / 请求输入使用 communityRef，加载后使用内部 id，不额外持久化 ref 副本到成员关系。

存量迁移必须支持非空数据库：先增加可空 ref 列和唯一索引（允许多个 NULL），仅为 ref 为空的社区逐行生成随机值；唯一冲突重新生成并重试，不覆盖已填值。校验零 NULL、零重复后再落 NOT NULL 和不可修改约束；回填与约束脚本同属 P1，重跑保留既有 ref。P1 的隔离数据库测试覆盖非空数据、冲突重试、重复 ref 被约束阻断及重跑稳定性；不要求 P0 先完成克隆演练。

Community GraphQL 输出新增非空 ref，已获准读取该 Community 的客户端可取得它；同步前端 Community 类型、生成协议与 fixture。管理命令传 communityRef，缓存的资源身份部分采用 ref，路由展示部分仍使用 slug，不全局机械替换所有 cache key。改 slug 测试须证明管理请求仍命中同一资源，不暴露内部 Community.id。

ref 服务稳定外部定位与内部 ID 隔离，与权限存储无关；它不代替授权，也不处理 slug 复用 / 重定向。社区改 slug 后同一 ref 仍解析到同一 Community，管理命令 / 请求无需随 slug 改写；不因此新增公网 permalink 路由，旧 slug 是否跳转由路由合同另管。

### 3.2 Community Admin 与 Global DDL

```text
cms.communities_admins
  id bigint PK                         沿用旧成员 PK，避免无关迁移
  community_id bigint NOT NULL FK communities RESTRICT
  user_id bigint NOT NULL FK account.users RESTRICT
  is_lord boolean NOT NULL DEFAULT false
  permissions jsonb NOT NULL DEFAULT '{}'
  revision bigint NOT NULL DEFAULT 1 CHECK > 0
  joined_at timestamptz NOT NULL
  inserted_at / updated_at
  UNIQUE(community_id, user_id)
  INDEX(user_id, community_id)

cms.global_passports
  id uuid PK
  user_id bigint NOT NULL UNIQUE FK account.users RESTRICT
  is_root boolean NOT NULL DEFAULT false
  permissions jsonb NOT NULL DEFAULT '{}'
  revision bigint NOT NULL DEFAULT 1 CHECK > 0
  inserted_at / updated_at
```

日期时间使用 timestamptz / Ecto :utc_datetime，timestamps() 沿用 Repo 默认。Community 关系行即当前 Admin；没有成员行便没有本站普通授权。移除 / 退出删除该行，权限一起消失。lord 属于 Admin 的标记，不需要枚举全部目录权限。允许同一 Community 有多个 lord，沿用旧多 root 的能力，不增加单 lord partial unique。allowed? 先验证 Action 存在及其 scope，再检查系统 root；Community scope 再检查该社区 is_lord，否则检查 permissions[action]。lord 不能短路另一个社区或 Article 的权限判断。Global 行只保存系统权限，缺行视为非 root、无 Global 权限，不影响其他资源关系。

Article 继续用 article_co_authors.permissions / revision，与 Community 一致。permissions 值只接受 boolean，持久化只保留 true；只接受对应目录合法可授予权限，未知键拒绝。is_root / is_lord 不接受普通权限编辑输入。只读用户无需预建空 Global 行。

权限编辑 / 移除必须携带 memberId + revision；防止退出再加入后旧操作命中新成员。CAS 在同一 SQL 按 id / scope / subject / revision 条件更新并递增 revision，0 行返回 permission_revision_conflict。不同社区不同成员行独立推进，不再有单用户跨社区整份 JSON 覆盖问题。首次 grant 建行 revision = 1，唯一竞争重读并按业务命令重试或报冲突，不覆盖赢家权限。Global 首次创建同样由 user_id 唯一约束保护；后续携带行身份与 revision。

grant 为增补、revoke 为删除明确权限集合，目录依赖由 Passport 统一校验；授权编辑器可完整替换指定成员的 permissions，但不得修改其他行。成员 / 请求 / 授权事件由同一领域事务提交。客户端可接收按 scope 汇集的有效权限视图，但不再读取或回传旧整用户 passportString JSON 作为写协议；派生视图不持久化为第二份授权权威。

### 3.3 为什么选择成员行

不考虑迁移成本，成员行更贴合按资源授予权限：成员与权限在同一行，删除成员即移除权限，不同社区不竞争同一用户行，与 Article co-author 存储一致。旧每用户 JSON 一次取得全部授权方便，但需要维持成员与授权两份事实，且写冲突范围较大；本轮已确认改用关系行，不再把 JSON 留作可选目标或 fallback。Global 权限仍独立，Passport 对外统一接口不变。落成员行仍须校验 permissions map，不能认为数据库关系自动验证权限目录。

### 3.4 其他结构选择的取舍

- Admin / Article 请求按领域分表保留真实资源 FK 和各自授权边界；共享字段验证、状态转换、过期判断及重复决定规则。增加一套请求类型不意味着复制整套逻辑。单表更容易跨领域列表，但多态资源引用不能直接靠一个 FK 校验；当前不为跨领域收件箱反查而改变领域权威。
- CMS Mention 关系存在 cms.mention_current_edges；Messaging Mention 是另一张带 recipient / read 的收件箱表。不能因两者都叫 Mention 就将其当作同一事实。独立物理消息流是首批范围选择，未来合并 Notice 存储需另定迁移；现有 type 筛选参数因此暂时保留。
- RESTRICT 防止误删，不等于资源永远不能销毁。成员移除、单站删除和 Trash 保留历史；真正全局销毁必须由专用流程明确处理依赖及历史处置，不能靠 CASCADE 绕过。

## 4. Permission 目录与唯一公开入口

```text
Passport
  +-- Catalog  合法权限、scope、可授予集合、依赖
  +-- Store    Global / Community / Article 授权行读取及事务内 grant、revoke

调用方 -> Passport -> 目录与授权事实
Gate    -> Passport 结果 + Lifecycle / Review / 关系 -> admission
```

不建立另一层 Requirement；Catalog 不把一个 Action 翻译成另一个权限。未知 Action 失败关闭。Gate 的内部 atom dispatch 可以保留实现形式，但进入 Passport 的业务 Action 必须与目录权限同名，不建立跨层别名授权。

伪代码只冻结边界，不代表现有 API：

```elixir
Passport.catalog(scope)
Passport.allowed?(actor, loaded_scope, action)
Passport.grant_in_transaction(subject, loaded_scope, permissions, revision)
Passport.revoke_in_transaction(subject, loaded_scope, permissions, revision)
```

catalog 返回合法权限与可授予集合；subject 指被授权账号，actor 由外层领域 Command 显式校验。allowed? 返回 {:ok, boolean} / {:error, reason}，读取已加载的稳定事实；不得内部重新定位别的资源。grant / revoke 是受领域 Command 使用的事务内能力，不是可跳过 Gate 的外部 mutation。资源锁、处理人检查、事件及 Outbox 由领域 Command 组织，Store 不另开事务。避免 Registry → Helper / Authorization → Registry / Assignment → Communities 的转发链，也不把 CMS Gate 移到全局。

旧权限清单用于替换调用方：post.update / blog.update / changelog.update / doc.update 及旧 draft 正文动作在 C3 / D1 退役；旧 post.edit / blog.edit / changelog.edit / doc.edit 的社区正文授权也退出，不能自动授予 article.update。新的正文调用方使用 article.update / article.publish，并重新按 owner / co-author 判断。

post.set_category 明确保留：Community scope、grantable = true、requires = []，只服务 setCategory mutation 的本站分类管理，不写正文。post.edit 过去同时覆盖正文和分类不构成新授权设计；它退出后，分类调用方用 post.set_category，正文只走 Article 关系授权。旧 moderator.set / unset / update 直接改成 lord-only admin.invite / remove / permissions.update，不给普通 Admin 创造管理权。

必须同时核对普通 Article 编辑策略、Docs、评论 owner-only、Review、资产与上传、Ticket、全局 Community 管理、mirror / unmirror / move、Dash theme / RSS / insights 等当前权限消费者。不能只迁移几个示例就删除目录映射。

### 4.1 前后端只有一个合同源

packages/contracts/gate.contract.json 是唯一 Permission / Action 合同源，定义名称、scope、可授予规则及依赖，Phoenix Catalog 与前端目录均从该源生成，不再另维护手写目录。例如新增 article.publish，必须先加入该合同及合法 scope / 可授予规则，再由 packages/contracts/scripts/generate-gate-contract.mjs 生成 TypeScript GATE_ACTION 和 Phoenix CMS.GateAction。现有生成器会生成 grantAliases / requirement 等映射结构；本次一一对应改造必须同步调整生成器和消费者，不能手改生成文件或只在 Phoenix Catalog 加键。

目标合同为 permissions 条目集合，每条包含 action（全局唯一字符串）、scope（global / community / article）、grantable（boolean）、requires（同 scope Action 集合）、requires_thread（按已注册 thread 限定的同 scope 依赖，默认 {}）。Action 与存储权限键同名，无 grant / grantByThread / grantAliases / ownerFallback 的旧映射字段；owner、lord、root 的规则由已加载资源身份与合法 scope 决定。禁止按 article.* 等字符串前缀猜 scope：例如 mirror 的权限范围应按它自己的业务合同明确列出。

Action / Permission 使用同一份封闭枚举值集合，不另建两套枚举。生成器输出 TypeScript 常量与字面量 union、Elixir 有限合法值及 scope / grantable / requires 元数据；GraphQL 枚举从同源生成，或由 parity 检查保证完全一致。边界只接受合同中的规范值，未知值、大小写错误和错误 scope 均返回明确错误，不在运行时 upper / lower 猜测，也不对外部字符串调用 String.to_atom。

若需持久化单值 Action 字段，Schema 使用同源生成的 Ecto.Enum 映射；permissions 仍是 jsonb map，不能把整个 map 声明为 Ecto.Enum。Passport 统一校验 map 的键均属该 scope 的合法目录、值为 boolean，以及可授予性与依赖；前端受控类型不能代替后端校验。底层使用 text / jsonb 和所需 CHECK，不引入 PostgreSQL 原生 ENUM。

| 输入变更                                                                            | 生成器输出                                                                      | 必须同时改的消费者                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| global / context 改为 global / community / article                                  | TS scope union、每项 Action metadata、Phoenix 同源目录                          | Passport Catalog / Store 的三种授权事实读取                                                                                                |
| 现有八项 article.* 加新增六项的十四项基线，以及三项独立 Community 操作，逐项见 §4.3 | GATE_ACTION、CMS.GateAction、完整 scope / grantable / requires 元数据及迁移去向 | Article / Doc Gate、Trash / Binding、insights、Editor、请求权限编辑及 parity                                                               |
| 全部 Global / Community 目录及写入者                                                | 全量目录与旧键处置清单，不限于 article.*                                        | global_grants / cms_grants、stamp_passport、system_notification.publish、community.request_destroy、Moderators.Persist 及其生产者 / 消费者 |
| 移除 grantAliases / threadGrantSuffixes / requirement 协议                          | 不再生成另一份 Action→grant requirement map                                     | 旧 PermissionRegistry、middleware、前端 TGateRequirement 消费者                                                                            |
| grantable 与 scope 作为目录字段                                                     | 前后端相同可授予集合                                                            | root / lord / owner-only 动作不得进入普通成员授权 payload                                                                                  |

Gate.Access.Load 的 typed Article / Doc Context 增加当前 actor 的成员实例及 permissions / revision、owner 稳定身份；Community Context 读取 Admin 行，Global 事实读取 Global 行。Scope 构造对应 SQL EXISTS / 关系条件，不逐行调用 allowed?；Context 缺失或 scope 不匹配失败关闭。P1 提供类型 / 目录，C3 只接普通 Article，D1 接 Doc，不能提前改变共用函数的 Doc 分支。

P1 同批执行 packages/contracts 的 generate:gate、generate:gate:check 和后端 GateAction / Passport parity tests，P4 验证所有消费方。GraphQL codegen 处理的是另一份协议，不能替代这些生成检查。比如后端允许 article.publish、前端常量仍没有此 Action，或生成检查再次生成旧 grant 映射，都属于未完成切换。

### 4.2 本轮写入共享锁序（唯一维护位置）

本表覆盖 P / H / C / D 中会组合的业务写入；其它文档仅列本次需要的资源并引用本表，不再定义相反顺序。只取得本命令真正需要的锁，不为纯 Article 操作强制取得 Community。读取用于规划锁集合可以先执行，但写入准入事实必须在锁内重查。

| 顺序 | 锁资源                                                                                                                                           | 多行规则                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1    | Community / site admission / 站点 Queue 根锁                                                                                                     | 先取得涉及的全部站点锁，按 community_id 升序                     |
| 2    | Article                                                                                                                                          | 按 article_id 升序                                               |
| 3    | account.users → cms.authors → Global 授权行（本次若需修改 / 创建）                                                                               | 每类按稳定 user_id / id 升序；不因只读取 actor 而增加写锁        |
| 4    | Binding（含本站 Binding Trash 行，先 Binding 后 Trash）→ ArticleLifecycle → WorkingCopy → Public → Snapshot → 版本独占 Body / Cover / asset refs | 按固定表序，表内按主键升序；锁内写入步骤不可反向补取前序资源     |
| 5    | CommunityAdmin / ArticleCoAuthor 当前成员授权行                                                                                                  | 按 scope 与 subject 稳定身份排序；缺行由上层资源锁及 UNIQUE 保护 |
| 6    | 领域请求                                                                                                                                         | 按 request_id 升序；先取得主资源锁再决定 / 过期                  |

纯 Admin 请求跳过 Article 及正文行，纯 co-author 请求可从 Article 开始；如果某个 Article 命令稍后确实需要站点锁，必须在规划阶段收集站点并从第 1 类开始，不能 Article 首锁后再请求站点。多资源命令先收齐同一层所需锁再进入下一层，不能逐 Article 取得整条链后回头锁另一个 Article。

P0 / H0 必须记录各入口的实际 FOR UPDATE / SHARE、advisory lock、FK 引发锁与事务内 callback，按此表逐项核对后实施；发现现有低层 helper 隐式补取前序锁，须在所属批次将锁提升到外层 owner，不能仅改文档箭头。P1 / H1 / C1 / D1-D2 使用独立连接测试交叉请求、发布与站点清理竞争。Outbox / Notice 投递是提交后的独立事务，不持有原 Article / site 锁跨越网络或 worker；若新增同步跨域写，必须先纳入同一锁图。

### 4.3 Article 与社区展示操作的完整 Action 清单

以下十四项基线来自现有八项 article.* 与新增六项；拆出三项 Community 操作后，本组目标共十七项，不代表项目全部权限只有十七项。所有行进入唯一合同；“不可授予”仍须生成枚举和 Gate metadata。requires 只表示同 scope 的静态授权依赖，跨资源条件由 Gate 在实际命令中逐一检查，不恢复 Action→其他权限的别名映射。

| Action                       | scope     | grantable | requires                                                   | 消费者与操作边界                                                                                               |
| ---------------------------- | --------- | --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| article.read_draft           | article   | true      | []                                                         | WorkingCopy / 只读编辑器                                                                                       |
| article.update               | article   | true      | [article.read_draft]                                       | 正文及 typed 字段保存、fork / 工作副本操作                                                                     |
| article.publish              | article   | true      | [article.read_draft]                                       | Article Publisher；选历史版本另查 history.read                                                                 |
| article.history.read         | article   | true      | []                                                         | 历史、Snapshot、Diff                                                                                           |
| article.history.restore      | article   | true      | [article.history.read, article.update, article.read_draft] | 恢复为新 WorkingCopy 修改                                                                                      |
| article.author.manage        | article   | false     | []                                                         | owner / root 管理 co-author、请求和授权                                                                        |
| article.trash                | article   | false     | [article.trash.read]                                       | owner / root 全局回收；影响所有入口                                                                            |
| article.restore              | article   | false     | [article.trash.read]                                       | owner / root 恢复全局状态，不重建本站页面                                                                      |
| article.permanent_delete     | article   | false     | [article.trash.read]                                       | owner / root 永久删除及既有保护检查                                                                            |
| article.trash.read           | article   | false     | []                                                         | owner 读取自己的全局 Trash；root 可读全部；集合走下述身份过滤 SQL（非 Gate Scope），无 Community 授权 fallback |
| article.insights.read        | community | true      | []                                                         | 本站 insights，按 Community / Binding 限定，不授权草稿或编辑历史                                               |
| article.mirror               | community | true      | []                                                         | 目标 Community 创建展示 Binding；仅既有可公开 Public，Doc 另查目标 doc.queue.write                             |
| article.unmirror             | community | true      | []                                                         | 移除指定 Binding 所在 Community 的展示关系；Doc 另查该社区 doc.queue.write 并经 Release；不全局删除            |
| article.move                 | community | true      | [article.unmirror]                                         | 来源 Community 的 move；另查目标 article.mirror，Doc 两端分别查 doc.queue.write                                |
| community.article.hide       | community | true      | [community.article.trash.read]                             | 本站下线；Posts / Blogs 等走本站 Binding Trash，Doc 走目录删除计划并另查 doc.queue.write                       |
| community.article.restore    | community | true      | [community.article.trash.read]                             | 本站恢复；Doc 恢复到工作区且另查 doc.queue.write，公开需 Release                                               |
| community.article.trash.read | community | true      | []                                                         | 本站 Trash 列表 / 详情；只返回本站下线事实，不读全局正文私有历史                                               |

owner 的 Article 默认集合在原九项基础上增加 article.trash.read，共十项；不因拥有文章而自动获得任何 Community scope 权限。lord 只短路当前社区的 Community 行，不能执行 owner-only 的全局 Trash / 永久删除。普通 Admin 可以持有上述 grantable Community 行；root 仍不跳过状态、版本和引用保护。move 的两端授权在同一命令、同一事务内重查，按共享锁序锁全部涉及社区及 Article；来源通过、目标拒绝时整笔不写。

以下 thread 条件也属于 gate.contract.json 的唯一合同源：

| Action                       | requires_thread                                                               |
| ---------------------------- | ----------------------------------------------------------------------------- |
| article.mirror               | {doc: [doc.queue.write]}（目标社区）                                          |
| article.unmirror             | {doc: [doc.queue.write]}（被移除 Binding 所在社区）                           |
| article.move                 | {doc: [doc.queue.write]}（来源社区）；目标另按 article.mirror 合同检查        |
| community.article.hide       | {doc: [doc.queue.write]}                                                      |
| community.article.restore    | {doc: [doc.queue.write]}；恢复工作区不公开，Release 独立查 doc.queue.publish  |
| community.article.trash.read | {}；所有支持的 thread 共用，只读 Trash 摘要，不依赖 preview / write / publish |

其余行 requires_thread = {}。生成器验证 thread 合法、被依赖 Action 存在且同 scope，输出 TS / Elixir 同源 metadata；Gate 对实际已加载 thread 统一组合 requires + requires_thread，作用于列表 Scope、单读和 mutation，不允许每个命令手写一份 Doc 特例。授权编辑器消费同源 metadata 展示该权限对不同 thread 的有效范围：缺 doc.queue.write 不妨碍具备静态依赖的非 Doc hide，但不能执行 Doc hide；不能因此暗中补授目录写权。P1 的 parity / 合同测试覆盖漏项、错误 thread、错误 scope，以及 Doc 缺 thread 依赖拒绝 / 非 Doc 不误要求 Doc 权限。

article.trash.read 保持 Article scope，单条记录按 canonical Article 检查 owner / root 及对应资源限制。全局 Trash 集合使用 Articles.Query 的 identity-scoped query：入口校验登录身份，普通用户在 SQL 中限定 Article.author_id 对应当前稳定账号，root 可返回全部全局 Trash；不存在 Author 时普通用户返回空集合，不为读取创建 Author。该集合及其 count / 详情的身份查询不经过 Gate Scope，不 join Binding / Community，缺少当前 Binding 也不能使记录消失；详情加载后仍执行 Article owner / root 和对应资源限制的准入检查。Gate Scope 在本文另行承担按 Binding / Community 的公共 / 站点管理读，不能拿它替代全局 Trash 的身份查询。集合、count、分页、详情使用同一身份过滤 helper，范围外详情返回 not-found；不能以一个样本 Article 的允许结果放行全部记录，也不能接收客户端任意 author_id。root 的列表范围例外不取消资源限制。

### 4.4 社区侧下线、恢复与 Trash

```text
owner / root + article.trash
  -> 全局 ArticleLifecycle / 全局 Trash -> 所有站点退出公开读取
Community Admin + community.article.hide（指定 Community.ref）
  -> 本站展示关系下线 -> 其他站点、共享正文 / 评论 / 历史不变
```

Posts / Blogs / Changelogs 等无 Docs Tree 的 thread 必须保留本站下线入口。采用独立 cms.article_binding_trash 记录：id uuid PK、community_id bigint FK communities RESTRICT、article_id uuid FK articles RESTRICT、binding_id（与实际 Binding PK 同型）FK RESTRICT、revision bigint NOT NULL DEFAULT 1 CHECK > 0、actor_id bigint FK account.users RESTRICT、hidden_at timestamptz、inserted_at / updated_at timestamptz（迁移 timestamps()，Schema :utc_datetime），以上 NOT NULL，UNIQUE(community_id, article_id)、UNIQUE(binding_id)；数据库复合 FK / 唯一约束保证绑定记录与 community_id / article_id 一致。行存在表示该 Binding 本站下线；保留原 Binding / inner_id，不把全局 TrashedArticle 复用为本站状态。P0 确认 Binding 实际 PK / 复合约束及所有 thread 消费者后形成可执行 DDL，不由实施者改用全局 Lifecycle 代替。

下线 / 恢复命令锁定 Community、Article、Binding 及本站记录，遵循 §4.2；恢复携带记录 id + revision，删除本站记录，不重置全局 Lifecycle / Review。两者不能绕过全局 Trash：全局仍被回收时，即使本站恢复也不公开。重复 commandId 沿用 Receipt；不同 commandId 并发 hide 同一 Binding 时，由 Binding 锁串行化，已有下线事实则返回该现有 row / revision，作为幂等成功，不重复插行、推进 revision 或写 Activity。唯一竞争使用 ON CONFLICT / 保存点后重读，不在已失败的数据库事务里继续查询。当前非 Doc Trash 行只有 hide 插入 / restore 删除，无 update 路径，revision 固定为 1，recordRevision 返回字符串 "1"；它只为将来明确引入的隐藏事实修订预留，不构成当前多版本并发保护。未来若允许非 Doc 状态修订，必须先更新 token 生成 / 校验规则、接口和旧 id 的有效性语义及对应验收，不能只在存储层偷偷增加 revision。restore 按记录 id + revision 及 community / article / binding 条件删除；实际防止旧请求误删的是每次重新 hide 生成的新记录 id，不能仅按 Binding 查当前行再删除。不同 commandId 的 stale 请求因旧 id 已不存在而返回 binding_trash_revision_conflict；人为提交非 "1" token 在输入校验时拒绝，不把它当真实版本竞争。成功 Receipt 重放仍返回原结果。旧恢复请求不得删除一次重新下线产生的新记录。只有全局 Trash 的旧记录不能自动转换为所有站点的本站记录。

该本站状态的公共过滤唯一归 Gate Scope：各 thread 的详情、列表 / count、搜索、feed、互动入口及投影均消费相同条件，不让单篇已下线而列表仍返回。本站恢复只在当前 Public / Lifecycle / Review 等全部条件通过后重新可见，不能复活正文。失效意图只针对本社区，提交后可靠重试；不发全局 Article 删除效果。Binding 删除前显式清理本站记录，不让 RESTRICT 变成不可解释的失败，不能因此清理共享正文。

Docs 不同时写这张普通 Binding Trash 表：目录工作区 Trash / tree deletion / Release 是唯一本站状态权威。community.article.hide / restore 负责对应本站操作准入，doc.queue.write 校验目录写入；article.unmirror 负责最终移除 Binding 的意图，Release 仍按 doc.queue.publish / approval 合同检查，不要求发布人继承每位目录贡献者的权限。真正提交的每项移除 / move 意图须在执行时重查其授权，授权撤销后不能靠旧计划继续移除。恢复工作区不立即恢复公网，详见 Mirror §3。

GraphQL / Dash 必须拆开两类入口：全局 trashArticle / restoreTrashedArticle 只检查对应 Article 动作；本站 hide / restore 和 pagedCommunityArticleTrash / communityArticleTrash 检查 Community 动作并明确 communityRef。旧带 community 的 trashedArticles / trashedArticle 不能只换权限键后继续返回全局记录：分别迁移全局 owner 视图和本站视图，不保留旧歧义 alias。本站 Trash 允许清除本站回收事实 / 撤除展示关系，不能调用 article.permanent_delete；Doc 仍需先满足 Release 与引用保护条件。

#### 4.4.1 Activity 投影与审计社区

本站 hide / restore 在目标 Community 的对应 thread community_log 写 trashed / restored，actor 是实际操作人，operation_ref 与命令一致；只记录本站，不向其他 Binding 社区广播活动，不把本站恢复额外投影为全局 article_log restored。P2B 负责非 Doc，D2 负责 Doc，领域状态、Activity 写入与 Outbox 意图同事务提交；任一步失败回滚，重放 / 重复 hide 不新增 Activity。

Activity 合同同批显式增加 operation_scope（article / community）及 effect（pending / effective）这两个有限字段，并更新 producer / 投影 / 消费者和合同测试，不向当前空 payload 偷塞字段。全局回收 / 恢复为 article + effective；非 Doc 本站下线 / 恢复为 community + effective。Doc 删除 / 恢复计划记录 community + pending，并显示“提交本站删除计划”/“恢复工作区”，不得称已从公网删除；Release 真正改变公开成员时按 Release operation 记录 community + effective 的 trashed / restored，actor 为执行发布人，目录计划与 Release 是不同事实，不互相去重。未公开节点删除只记工作区操作，不声称公网状态改变。已删除的树项在清理 Trash 时不再重复记 trashed。

存量 Activity payload 缺少 operation_scope / effect 时，解码 / 投影按 NULL 处理，使用旧措辞；不猜测历史记录属本站还是全局，也不回填成 effective。新合同仅要求本次新写的 Trash / restore、目录删除 / 恢复计划，以及 Release 的 trashed / restored 状态投影同时提供这两个字段；其它事件可缺省或为 NULL，不要求所有 producer 增加字段。历史缺省是已写入数据的解释规则，不是旧写接口 alias；新相关事件漏字段必须被合同校验拒绝。P0 对账各 thread 的历史缺字段 / 已有字段分布与展示样本，P2B / D2 验收历史可读、新事件必填、其他事件不受影响。

本站恢复成功但 Article 仍处于全局 Trash 时，写 restored、operation_scope = community、effect = effective，表示本站展示关系已恢复，不表示公网可访问；活动投影明确显示“已恢复本站展示关系，仍受全局回收限制”。effect 不是 publicVisible 的替代字段，详情和链接仍按当前公开可见性返回 404。Doc 工作区恢复仍使用 pending 语义并注明待 Release。

全局 article.trash 的命令必须明确提交实际入口 communityRef，经 FrontDesk / Gate 验证该 Article 在此处有真实可用 Binding / 工作流上下文，写入全局 Trash 的 community_id；不能任选第一个 Binding 或广播全部社区。article.restore 固定采用被恢复全局 Trash 记录原有 Community，删除记录前捕获上下文。全局 trashed / restored 的 community_log 只落该社区，actor 为当前操作人；其他站点读取仍立即受全局 Lifecycle 影响，但不伪造本站操作记录。无真实可用 Community 时返回 article_trash_context_required，全事务不写；有 root 特权也不伪造社区或默默省略 Activity。本期不增设无社区审计通道，permanent_delete 继续沿用同一实际 Trash 上下文。

#### 4.4.2 本站 Trash 组合视图与 GraphQL

pagedCommunityArticleTrash(communityRef, thread, pagi) / communityArticleTrash(communityRef, thread, id) 是 per-thread 的本站回收视图，operation 名为 PagedCommunityArticleTrash / CommunityArticleTrash。thread 入参必填且使用独立 CommunityArticleTrashThread!（仅 post / blog / changelog / doc），不实现混合来源的跨 thread 游标；详情 id 按显式 thread 定位，不能猜 ID 所属表。全局 owner 视图命名 pagedArticleTrash / articleTrash（PagedArticleTrash / ArticleTrash），不接受 community 参数，使用上述 Articles.Query identity-scoped query，不经过 Gate Scope；旧 trashedArticles / trashedArticle 直接退役，不留下歧义 alias。schema / operation / codegen / Dash 路由、Query key、fixtures 同批切换并列入 P0 清单。

组合视图的 GraphQL item 使用 interface CommunityArticleTrashItem，而不是按 thread 返回未声明的不同对象：

| interface 公共字段 | 类型 / 语义                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                 | ID!，对应基础 Trash 记录的稳定公开身份，不使用数组序号 / Article ID 替代                                                                                                                                                                                                                                                                        |
| thread             | CommunityArticleTrashThread!，与入参相同的受支持 thread 子集枚举                                                                                                                                                                                                                                                                                |
| status             | CommunityArticleTrashStatus!，封闭枚举 pending / effective，协议按现有 GraphQL enum 规范生成                                                                                                                                                                                                                                                    |
| publicVisible      | Boolean!，目标社区是否还有任何可读公开页；当前非 Doc 恒 false，Doc 按下述同查询批量规则计算，不能仅从 status 推导                                                                                                                                                                                                                               |
| recordRevision     | String!，非空版本 token；非 Doc 当前恒为 "1"，重下线以新 id 区分；Doc 为服务端生成 / 校验的不透明 token，绑定 action 身份与真实 tree / Queue 版本事实；客户端只原样传回，禁止解析或拼接；独立 treeRevision / queueRevision 仍按命令合同校验，非 Doc 输入只接受字面字符串 "1"，缺失、NULL、其它字符串或值类型一律拒绝，不作默认值 / 类型转换回退 |
| createdAt          | 项目现有 UTC datetime scalar，非空；非 Doc 为 inserted_at，Doc 为 TrashAction 创建时间，不用请求时间                                                                                                                                                                                                                                            |

两个具体 GraphQL 对象均实现上述 interface：CommunityArticleBindingTrashItem 的 status 恒 effective、publicVisible 恒 false，增加 bindingId: ID!、hiddenAt（UTC datetime，非空）；CommunityDocTreeTrashItem 增加 treePath（非空原树位置段列表，根为 []）。treePath 每段只含已授权目录展示所需的 nodeId 和 title，不带正文。Doc 回收单元就是一个 TrashAction（root_type = doc_tree_node），公开 item.id = cms.trash_actions.hash_id，内部 groupKey 与此公开 id 相同且不单独暴露。成员来自 cms.trashed_doc_tree_nodes（DocsTrashedTreeNode）和 cms.trashed_doc_articles（DocsTrashedArticle），通过内部 trash_action_id 归组；不新建 DocTreeTrashItem 权威表，也不使用根 node_id、成员 hash_id 或内部递增 action.id 作为公开单元 id。详情 / restore / purge 均按 Community + action hash_id 定位整个动作，恢复复用 CMS.DocTree.WorkspaceRestore.run/8 的 action_id 语义，purge 复用 WorkspaceTrashPurge 的 action_id 语义，不另造根节点解析协议。一个 action 对应一个可整体恢复的 subtree，root_ref 指向该单元的根节点，不允许内部多个根独立恢复；P0 检查 root_ref、成员与根数，发现历史多根 / 孤儿 / 错归组 action 时逐项给出处置方案，不能悄悄丢成员或拆成多个可恢复列表项。重新删除生成新 action hash_id，旧 id 不得命中新单元。publicVisible 对 Doc group 表示任一所属页面当前仍在本站公开可读，空 group 为 false；未公开节点的工作区删除可为 effective + publicVisible=false。Doc item 另增只读 pendingMemberCount: Int! / removedMemberCount: Int!，均非负，按下述规则与详情成员状态同时生成。

Doc restore 的目标输入保留 targetParentNodeId / targetIndex，并同时携带 action hash_id 与 tree / Queue 的预期版本 token。未提供这两个目标字段时，从 action.root_ref 对应的 DocsTrashedTreeNode 回收快照取原 parent_node_id / index，按原父节点和原顺序恢复；原父缺失或不属于本站当前可恢复树，返回现有 CMS.ErrorCat.docs_restore_parent_missing()，不自动挂树根、不寻找存活祖先。原父只是移动了位置但稳定 node id 仍存在且可作为合法父节点时允许恢复，不把“移动过”本身判为错误。默认和显式目标父均须存在于本站当前保存树，且不位于任何有效未 Release 删除计划覆盖的子树内：既检查父本身，也检查其所有祖先，涵盖本单元及其它 action 的删除计划；目标不能位于本次恢复 subtree 内形成环。默认目标处于待删除子树时同样返回 docs_restore_parent_missing，提示重新选择；显式目标也按相同规则拒绝，不允许“恢复后随父计划再次删除”。这些事实在恢复写事务取得站点 / 树 / Queue 锁后重查，不依赖打开详情时的快照。

显式提供 targetParentNodeId 时使用该目标；显式 NULL 表示用户选择树根，仅在节点类型和现有树约束允许时接受，不能与字段缺省混淆。只提供 targetIndex、未提供目标父字段时按现有输入合同拒绝；未提供 index 时沿用回收快照原 index，由现有 TreeOrder 规则处理合法插入及同级重排。adapter 必须在 GraphQL args 中保留字段是否提供的信息，先解析默认目标和校验，再调用 WorkspaceRestore.run/8；不能继续仅 Map.get 后把未提供 / 显式 NULL 都交给 nil 默认分支。tree / Queue 版本冲突、目标非法、跨社区目标及缺失父节点均整笔回滚，TrashAction 与成员仍可恢复。恢复写命令仍遵循站点锁、授权和版本合同，以下无锁规则只适用于读。

D2 恢复验收：原父仍在时按原位置恢复；父移动但合法时恢复到同一父 id；原父删除 / 不在当前树时明确 parent_missing 且 action 保留；显式选择合法新父 / 树根时按用户目标恢复；缺省与显式 NULL 不混淆；并发版本冲突或非法目标不得部分恢复成员；父自身 pending、父的祖先 pending、跨 action 删除计划覆盖，以及显式选中上述目标均拒绝，action / 成员和 Queue 不被部分修改。

Doc 组合视图列表 / count / 详情 / pagedMembers 为快照读，不获取 docs_site:<community_id> advisory lock，不调用 SiteLock.acquire，也不对 Queue / Trash / 成员行获取 FOR UPDATE 等写锁；不能照抄旧 WorkspaceTrashRead 的站点锁事务。单条 SQL 使用其语句一致快照；需要跨 entries / count / members 保证同一响应版本时，在同连接只读 REPEATABLE READ 事务内执行，权限查询也不申请站点写锁。pending / effective、计数与 publicVisible 直接读取该快照的 Queue / Release 事实；跨请求状态变化通过版本检查、重读 / 刷新处理，不持锁等待用户操作、不缓存旧结果。D2 使用独立连接分别持有站点写锁与执行 listing，验证读请求不等待 docs_site 锁；反向并发验证 listing 不阻塞 Release / Queue 写、正常完成无该锁导致的超时。该验收只承诺没有站点锁互斥，不宣称数据库没有任何资源等待。

Doc subtree 的聚合采用 effective 优先：removedMemberCount > 0 时 status = effective；否则 pendingMemberCount > 0 时 status = pending；两者都为 0 时表示工作区删除已生效，status = effective（含未公开 page / 空 group），不暗示曾公开或已从公网移除。pendingMemberCount 计仍在本次有效待 Release 删除计划中的去重 page；removedMemberCount 计本次回收单元内已被 Release 实际移除公开成员的去重 page。group 容器不计数，未曾公开的工作区删除不计 removed，同一 page 不能同时计入两项。依据当前 Queue / Release 及该回收单元的真实操作证据判断，不从 publicVisible=false 反推 removed（全局 Trash / Review 也可导致不可读）。两个计数在与 entries 相同的批量单行子查询中求值，不能逐成员查询。

详情返回 pagedMembers(pagi)（沿用项目分页 envelope；operation / fragment 按 PagedXxx 规则命名），每个 page 包含稳定成员身份、deletionStatus（pending / effective）、removedFromPublic（boolean，是否因本次 Release 实际移除）；按与列表相同的规则分类，列表计数覆盖整个 subtree，不能仅汇总详情当前页。removed>0 且 pending>0 时 UI 显示“部分已下线、N 项待 Release”；pending>0 且 removed=0 显示“N 项待 Release”；无 pending 的工作区删除不能一律称“已从公网下线”。publicVisible 独立计算，可能因剩余 pending 页面而为 true，也可能因全局限制为 false。D2 必验同一 subtree 一页已 Release、一页 pending：status=effective、removedMemberCount=1、pendingMemberCount=1；前者详情 effective / removedFromPublic=true，后者 pending / false，且公开条件允许时 publicVisible=true。再叠加全局 Trash / Review 阻断时只改变 publicVisible，不改变删除事实计数；列表与详情需用一致的当前版本事实，跨请求已发生变更时重读 / 刷新，不缓存旧计数冒充同一版本。

| thread 枚举值 | GraphQL 具体 item                | 权威来源                                                                           |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| post          | CommunityArticleBindingTrashItem | cms.article_binding_trash                                                          |
| blog          | CommunityArticleBindingTrashItem | cms.article_binding_trash                                                          |
| changelog     | CommunityArticleBindingTrashItem | cms.article_binding_trash                                                          |
| doc           | CommunityDocTreeTrashItem        | TrashAction + DocsTrashedTreeNode / DocsTrashedArticle + 当前 Queue / Release 状态 |

CommunityArticleTrashThread 的支持集合明确放在 packages/contracts/community-article-trash.contract.json 的 threads 条目，值固定为 [post, blog, changelog, doc]；由独立 packages/contracts/scripts/generate-community-article-trash-contract.mjs 生成 TS / Elixir 支持集合及 GraphQL enum 所需值，并校验每值均存在于项目共享 thread 目录。它是 Trash 视图输入合同，不属于 gate.contract.json 权限目录，不扩展 generate-gate-contract.mjs 的职责；不手写第二份支持集合。GraphQL 输入 / item、TS 枚举、Elixir adapter dispatch 与映射表做 parity。ticket 等其余共享 thread 值不进入该入参枚举，GraphQL 在输入校验时拒绝；内部绕过 GraphQL 的调用也必须按同一支持集合返回 unsupported_thread。P0 清单明确列出共享枚举全集、支持四项与排除项，codegen 不能把完整 Thread 误用为此接口输入。

| P0 codegen 合同项           | 唯一来源 / 固定值                                                                                 | 生成 / 核对职责                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| CommunityArticleTrashThread | packages/contracts/community-article-trash.contract.json → threads = [post, blog, changelog, doc] | generate-community-article-trash-contract.mjs；TS / Elixir / GraphQL 与 adapter parity，排除其余共享 thread 值 |
| Trash 视图生成检查          | generate:community-article-trash / generate:community-article-trash:check（P2B 新增）             | P0 登记文件及生成目标，P2B 落地并纳入检查；独立于 generate:gate                                                |

P2B 的生成检查接入是退出条件，不止新增脚本文件：

- packages/contracts/package.json 注册 generate:community-article-trash（node scripts/generate-community-article-trash-contract.mjs）与 generate:community-article-trash:check（同脚本 --check），并把 --check 加入该包 test 的生成检查串联，原有检查保留。
- 根 package.json 注册 contract:community-article-trash，转发 pnpm --filter @groupher/contracts run generate:community-article-trash:check；现有执行 contracts test 的 CI 链必须覆盖该检查。P2B 记录实际 workflow / job；若当前没有执行该包 test 的 job，须同批把此根检查加到合同 CI，并让合同 / 生成器 / TS / Elixir 产物变动触发，不能只增加本地可选命令。
- Elixir 新增 test/groupher_server/cms/articles/community_article_trash_contract_test.exs，参照 cms/passport/gate_action_contract_test.exs 的合同 parity 形态，核对 JSON threads、Elixir 生成值、GraphQL input / item 枚举与 adapter 映射一致。接入后端正常测试发现和相关 CI，不仅放在生成器的 JS 测试中。
- P2B 运行生成后再 --check、包 test、根检查、Elixir parity 和 GraphQL codegen / freshness；故意修改合同而不重生成时，包 test / 根检查必须失败。P0 只登记这些实施落点，不声称命令已存在或 CI 已接入。四篇文档验证列表引用同一组命令，不把未实施的新检查报告为本轮已通过。

publicVisible 的计算属于 adapter 的 entries SQL：非 Doc 直接投影 false，因为本站 Binding Trash 行存在即表示该社区此 Binding 已下线；不能因它仍保留 Binding 而修成 true。Doc page / group 在同一条 entries 查询内用相关 EXISTS 或先聚合到每个 Trash 单元一行的子查询组合 Gate 的可组合公开 Scope，检查目标 Community 可公开、Binding、Public / PublicBody 一致、Lifecycle / Review 与本站当前公开树成员；group 为任一所属页面满足条件，空 group 为 false。每条基础 Trash 记录 / Doc subtree 单元在 entries 中恰好一行；禁止将一对多页面直接展开 join 到 entries，不能靠事后 DISTINCT 掩盖分页前的行数变化。游标按 Trash 根记录 createdAt DESC、id DESC 的稳定顺序，不按页面、treePath 或成员序；count 计同一 Trash 单元集合。即使用 LEFT JOIN，也只能连接已聚合为每单元最多一行的结果。不重复手写公共条件，不把该公开 Scope 用来过滤必须保留的 Trash 外层行。禁止每个 item / 每个 group 调 Gate、补 Repo 查询或逐项加载页面；不缓存跨请求结果。常规分页 count 可按既有合同单独查询，但不能为了 publicVisible 按条新增查询。若未来允许本站多个公开页面共用 Binding，字段仍表示“该社区是否还有任何公开页”，不能改成“Binding 是否存在”；当前非 Doc 模型不实现此扩展。

P2B / D2 必须验证一页多个 Doc group 的 publicVisible 在一次 entries SQL 中完成，group 成员数 / item 数增加不增加查询次数，无 per-row Gate / 无 N+1；非 Doc 固定 false，无当前公开页 / 部分仍公开 / 全局 Trash / Review 阻断的结果正确。非 Doc 版本验收以 hide → restore → 再 hide 得到新 id 为场景，证明旧 id + "1" 不能删新记录，不编造当前同一 id 的 revision 竞争；Doc 另验真实 Trash / Queue 版本变化。D2 增加多页面同 group 恰好一行、静态数据跨页无重复 / 无遗漏、count 与单元数一致；详情 / restore / purge 使用同一 TrashAction.hash_id，跨社区 / workspace / subtree 串用 id、成员 id 冒充根 id，以及旧 id 与新 token 混用均拒绝，不改变别的 subtree。

分页结果 entries 为 [CommunityArticleTrashItem!]!，沿用项目统一分页 envelope；详情为 CommunityArticleTrashItem，越权 / 不存在均 not-found。GraphQL interface 的 resolve_type 只按服务端 adapter 确定具体类型，与已校验 thread 一致；前端按生成 __typename / fragments 取具体字段，不读一个带大量可空字段的万能 item。P0 把 interface、两个对象、status 枚举、thread 映射、版本 token 编解码与分页 envelope 纳入 schema / codegen 清单，P2B / D2 验收 enum / __typename / fragment parity、跨 thread ID 串用拒绝、group 和原树位置的展示与恢复版本校验。

- 非 Doc：唯一来源是 cms.article_binding_trash；按 Community 和 thread 限定，使用 community.article.trash.read。
- Doc：唯一回收单元是现有 TrashAction 及其两类归组成员，附加当前 tree Queue 中与其对应的 pending deletion 状态；pending 删除计划计入本站 Trash，但只展示一次，不同时拼接成两条。读取只检查目标 Community 的 community.article.trash.read，无 Doc 附加读取权限，不要求 doc.queue.preview / write / publish。返回必要的 tree / 页面展示摘要、原树位置、记录 revision、是否仍公开及 pending / effective 状态，不附带草稿正文、共享 Snapshot 或编辑历史。恢复仍另查 community.article.restore + doc.queue.write。
- Doc 已公开 page 的删除计划尚未 Release 时，该成员标 pending；Release 移除该公开成员后仍保留该 TrashAction 与成员，该成员标 effective。subtree 单行 status 按上述计数聚合，不把所有成员强制标成同一状态。未公开节点删除为工作区 Trash，无“已下线公网”的含义。旧计划已取消或状态不一致时按当前权威重读，不依赖通知 / 缓存推测；恢复 / purge 只操作对应权威记录，不写普通 Binding Trash。Doc group Trash 按既有 subtree 单元返回，不能拆成重复页面行。

Doc Trash 的固定产品边界：community.article.trash.read 对四种支持 thread 授权本站回收摘要（标题、路径、删除时间、成员状态及计数），不授权待发布正文、Snapshot、编辑历史或完整发布预览。不得让 Trash 的只读摘要 adapter 顺带调用 preview 内容接口；即使 Trash 字段属于 preview 字段子集，也不因此增加 preview 依赖。不新增 community.article.trash.doc.read；P0 核对所有字段与消费者遵守此边界，不再决定是否复用 preview。旧授权的数据转换仍须列出资源 / thread 范围差异，但不补授 preview 或通过旧键 fallback 放行。

D2 详情跨请求验收：用户打开详情后，另一连接改变 Queue / Release 或恢复 / purge 同一 action；后续 pagedMembers 请求须携带该详情 recordRevision，在生成新成员页前校验版本，版本变化时返回明确冲突并由客户端刷新详情、计数和成员游标，不将旧摘要与新成员页拼成同一版本。action 已不存在时返回 not-found，界面结束当前操作并刷新列表；restore 的旧 token / 独立 treeRevision / queueRevision 不匹配时拒绝并提示刷新，不按旧页面自动重试写入。Doc token 由服务端生成和验证，客户端不得解码后自行换版本字段；首次详情建立新快照，后续跨请求不能延续原数据库快照。

Doc recordRevision 必须可跨节点无状态重算：服务端对规范序列化的协议版本、Community 稳定身份、action hash_id、tree_revision、queue_revision（及确有必要的等价版本事实）使用共享服务端密钥作带领域隔离的 HMAC，再编码为不透明 token；所有节点使用同一格式及当前密钥配置，从已加载的当前事实重算并校验。不得用进程内随机串 / 缓存保存 token，不为 token 新建持久化记录，不加入随机 nonce 或当前时间使相同事实无法重算；token 不是授权凭证，读取 / 写入仍独立检查当前权限与版本。密钥按全节点协调方式轮换，旧 token 不保留兼容验证：返回明确版本冲突，要求重新读取详情取得新 token；不自动重放恢复写入。D2 验收跨节点读取 / 成员分页 / 恢复校验一致，事实变更、篡改或密钥轮换后旧 token 被拒绝并刷新；同密钥同事实重算一致，无节点本地状态依赖。

P2B 拥有非 Doc resolver / Scope 与公共接口形态，D2 实现 Doc adapter、去重 / 状态、目录读取准入和 Dash Doc 入口；共享字段生成及两分支集成验收共同完成后才能宣称组合视图就绪。P2B 不提前启用未实现的 Doc 分支，D2 不另造一套同名记录或读权限；未上线分支显式拒绝，不能回退全局 TrashedArticle。

P0 / D2 的旧 Doc Trash 入口清单必须包含 schema 字段 doc_tree_trash_items（GraphQL docTreeTrashItems）、R.CMS.Docs.doc_tree_trash_items、WorkspaceTrashRead.list 及 frontend/core/unit/DsbThread/schema/docs.ts 的查询与 Dash 回收抽屉。当前 schema 有 login / FrontDesk / PutCurrentUser，领域 WorkspaceTrashRead 已执行 Gate.Access.Check.community(..., :docs_trash_read, ...)，故不能仅凭缺少 Passport middleware 就认定可越权；实际 policy 映射已确认 :docs_trash_read → doc.trash；P0 盘点该键全部读 / 删除动作等消费者及低权限用例。当前读取已按 TrashAction 分页再投影节点快照，不能把旧响应的 nodeId 当新单元 id。D2 由新组合视图接管并删除旧 GraphQL 字段 / resolver 入口、前端查询与失效类型，不留过渡 alias；只保留改造后受控的内部 reader。验收匿名 / 登录但缺新权限账号不能从新入口读标题 / 删除时间，旧字段已从 schema 消失，Dash / codegen 无旧消费者，详情 / restore / purge 不接受 nodeId / 成员 id 冒充 action hash_id。

P0 列出 Doc Trash 查询的数据关系、预期规模和验证用例即可。D2 实现查询后，在隔离测试数据上检查数百页面 subtree 的 entries / count / pagedMembers、查询次数、延迟和 EXPLAIN；禁止 N+1 和页面展开导致重复行。实际测量用于发现和修复退化，不预先发明毫秒阈值，不要求生产副本或先完成性能预算才能开发。已有适用的性能要求继续验证。

### 4.5 P0：Article Trash 与 Binding 授权归属

P0 按本节既定边界整理旧键、调用方、目标 Action 和所属批次，由实施者直接替换或删除。未知旧键记录为待定位代码，不自动变成新权限；新运行时仍拒绝未注册 Action。清单不要求用户逐键审批。

| 旧授权 / 入口                                              | 目标与明确变化                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| thread.trash 与 owner_fallback                             | owner 路径改为 article.trash；旧社区 trash 授权转换为对应社区 community.article.hide + community.article.trash.read，只下线本站，不再全局回收他人文章                                                                                                                                            |
| thread.restore                                             | 对应社区 community.article.restore + community.article.trash.read；owner 的 article.restore 由身份推导，不能从旧社区授权复制                                                                                                                                                                     |
| doc.trash（含内部 :docs_trash_read）                       | 新读路径只用 community.article.trash.read，P0 清点旧键所有读 / 删除命令、policy / generated / seed / 前端消费者和资源 / thread 范围差异；D2 同批切换全部消费者并删除旧键、内部映射及旧入口，不提供过渡 alias / 双读 / fallback，不补授 preview。消费者未迁移完整时阻断切换，不能部署半套新旧规则 |
| article.trash.read 原 Community 语义                       | 拆为本站 community.article.trash.read；article.trash.read 改为 owner-only，旧带 Community 查询分流                                                                                                                                                                                               |
| thread.permanent_delete                                    | 旧普通 Admin / lord 失去全局永久删除权；不得复制到 co-author。owner / root 走专用命令，测试旧社区管理权限不能绕过此边界                                                                                                                                                                          |
| 全局 community.mirror / move / unmirror 的 threaded grants | 调用方改为明确社区的 article.mirror / move / unmirror，move 分别检查源 / 目标权限；不自动建 Admin 或授权所有社区。旧 threaded Global 键退出运行时                                                                                                                                                |
| article.insights.read 原 Community grant                   | 保留对应 Community 的同名权限，查询范围不扩展；原有 thread 范围较窄时不得自动扩大                                                                                                                                                                                                                |
| 已存在的全局 TrashedArticle                                | 保留实际全局状态和审计；不改写为本站下线。owner / root 可恢复；本站 Admin 无权通过新恢复入口恢复整篇 Article                                                                                                                                                                                     |

Global / Community 其余目录也要查漏，包含 stamp_passport 在 Moderators.Persist 的调用，以及 system_notification.publish、community.request_destroy、doc._、review._、ticket.*；按已确认的资源边界实现，不保留旧映射层。root / lord 设置不作为普通可授予键。

P1 的覆盖检查验证唯一合同、生成物、公共 Passport 判断及本批消费者一致，并将其余实际调用方明确归入 P2 / P2B / P3 / C3 / D1 / D2；不要求尚未实施的消费方提前切换。未定位的宏 / middleware / 别名调用方必须在该调用方改动时补齐，未核对部分不能宣称全覆盖。所有实际调用方使用新合同、旧运行时入口无残留是 P4 的退出条件，不能反过来阻塞 P1；它是实现检查，不是等待 149 行签字的审批门槛。新旧目录不要求数量相同，清单中的 grant-only 键也不能一律生成 Action。

## 5. Community Admin 请求

模块归 CMS.Communities.Admins.Requests；独立表 cms.community_admin_requests，保留 community_id 外键。与 [Article 请求](../feature/article/co-authors.md#22-请求) 共享字段及状态约定，不新增 Passport.Requests 或通用工作流引擎。

列与 Article 请求相同；article_id 换为 community_id bigint FK communities RESTRICT，双方均使用 subject_user_id bigint FK account.users RESTRICT，不要求已有 Author。所有外部 API 使用 communityRef，内部 SQL 使用 community_id。UNIQUE(community_id, subject_user_id) WHERE status = 'pending'，invite / apply 共用；列表索引为 community / subject + status / inserted_at / id。type = invite / apply，status = pending / decided / cancelled / expired，decision = accept / reject，期限 7 天。请求 / 决定组合 CHECK、revision、不可变提议、先过期再新建均沿用 Article 合同。

```text
lord invite -> subject 决定
user apply  -> 当前 lord / 系统 root 决定
accept      -> membership + Passport 增补 permissions + 决定 + 事件 + Outbox
remove/exit -> DELETE 当前 membership + revoke 该社区普通授权 + 取消 pending 请求
```

- 首版 Admin 请求不申请或授予 lord / 系统 root。community 不可申请时拒绝，不泄露私有社区信息；公开可读且可管理的 Community 才允许外部 apply。
- 普通 Admin 可申请增权；批准集合为提议子集，必须满足目录依赖。邀请接受原提议；变更邀请先取消重发。
- 现有管理页 addAdmin 行为改为 invite，不再点击即加入；不以 addAdmin 旧字段继续直接建成员。初始化首个 lord 属于可信 setup，不走邀请。
- Admin 请求所需锁为 Community、涉及的 User、Admin 行、请求，顺序统一遵循 [共享锁序](#42-本轮写入共享锁序唯一维护位置)；不在本节另定义跨域顺序。
- 接受后只增补本次批准权限，移除成员直接删除关系及当前授权，不恢复旧授权。退出只允许普通 Admin 删除自己，lord 不通过此入口放弃特权。
- actor / subject / proposed / approved / UTC 时间 / operation_ref / request / 前后权限均独立记事件。成员删除不删除历史；相同 commandId 重试不重新创建成员。

授权与请求事件复用 Activity 公共写入口，为 Community 合同增加 admin_joined / admin_removed / admin_permissions_changed / admin_request_created / admin_request_decided / admin_request_cancelled / admin_request_expired，记录稳定 subject、request、前后权限、member_id（bigint，非 FK，保留已删除 Admin 实例）及 operation_ref / operation_index；setup 也记录可信来源。加入 / 授权 / 移除记录具体 member_id，请求尚未产生成员时为空；不能用用户身份代替本次成员实例。记录和授权同事务，通知意图经 Admins.Effects 写 Outbox，Persist 不直接发消息。Article 的无 Binding 授权事件由其领域表保存，见 Co-authors 合同，不为满足 Activity 的 Community 约束伪造站点。

目标 GraphQL 字段：pagedCommunityAdmins、adminCandidates、pagedCommunityAdminRequests、createCommunityAdminRequest、decideCommunityAdminRequest、cancelCommunityAdminRequest、updateAdminPermissions、removeAdmin、leaveCommunityAdmins。写入带 commandId，变更带 request revision 或 memberId + member revision；分页遵循 Pagi，operation 命名无页面前缀。界面只为 lord / root 提供邀请与授权编辑，用户可处理自己的请求。

pagedCommunityAdmins 每项返回 memberId、revision、isLord、有效权限摘要及 User 展示信息。adminCandidates 接收 name，仅按 login / nickname 搜索有效可邀请账号，不按邮箱搜索，不要求已订阅社区；排除本站当前 Admin（含 lord）及已有 pending 请求者。调用者必须是本站 lord / 系统 root，结果最多 15 条，是固定上限的搜索型候选集合，不是分页资源，故不用 paged 前缀；不返回账号私有字段。系统 root 身份不等同于本站成员，不凭该身份全局排除候选；已有成员增权使用 apply，不重复邀请。

### 5.1 请求过期与重放

两类请求均有 INDEX(expires_at, id) WHERE status = 'pending'。创建和决定时的惰性过期必须在资源锁 / 请求锁内检查；已过期不能接受，也不能留下 pending 占住唯一键。各领域提供 ExpireRequest Command；定时 Job 按索引有界扫描候选（每批最多 100 条，以 expires_at / id 游标推进），只调用领域入口，按正常资源首锁重查。扫描阶段不持有 Request 行锁再反向取得资源锁；不为使用 SKIP LOCKED 破坏既定锁序。多 Job 并发由领域锁和终态幂等保证，失败可重试。重复执行已过期请求返回既有结果，不重复事件或 Notice；到期事件 / Outbox 与状态同事务。系统 actor 明确标注，不伪造决定人。共享过期及状态判断函数，不建设通用工作流引擎。

## 6. Messaging 收口与 Community Admin 请求

```text
CMS Mention 关系 / 领域请求与决定 / 活动事实
  -> 同事务 Outbox
  -> 可靠 worker -> Messaging.notify(notice)
  -> Notices（type 分类，内部 Dedup）
  -> Inbox（列表 / 已读 / 未读摘要）
```

- Outbox、embed users 聚合、delivery_key claim 和 User.mailbox 未读摘要已存在；本批复用可靠性机制并改正命名 / 归属，不新建平行投递框架。完成本批前已搜索前端运行时代码，没有实际 Inbox 列表 / badge 消费者；因此更新 GraphQL 契约与生成类型，不凭空增加 UI。后续若新增消费者，归入对应消费端批次，不阻塞本通知存储闭环。
- CMS Mention 是内容关系，保留原权威。“mention 类型通知”是统一 Inbox 的产品分类，首批物理写入仍是 messaging.mentions，不表示还要再写一条 notices。邀请不伪装正文 Mention，不受正文必须公开的投递条件约束。
- 明确使用 Messaging.Notices / Model.Notice、Messaging.notify、Messaging.Notices.Dedup；现有 Notify.dispatch 空壳由真实命令入口替代。Notifications.Delivery 只改职责准确的内部命名，不扩大成通用投递框架。
- Inbox 统一公开 list / mark_read / mark_read_all / unread_counts；Accounts 不再拥有另一套收件箱路由。User 的 Inbox 摘要可继续为 Session 提供读取投影，计数事实和重建归 Messaging，Accounts 仅通过自身边界保存 / 失效用户投影。
- 首批保留独立 mention 与 notice 物理存储。提及按现有内容版本 + recipient 唯一键；普通活动仍用 embed users 合并及稳定身份去重；对同一聚合的并发合并需锁或原子合并，不能读后覆盖。
- Dedup key 必须稳定到业务事件和 recipient，claim、Notice 写入、未读更新同事务；已读或跨聚合窗口后重试也不得新建第二条。Outbox 执行完但未确认的故障仍靠消息幂等避免重复。
- 请求类 Notice 在 notices 表新增 request_type（article_co_author / community_admin）、request_id uuid、event_type、subject scope 的公开定位信息；不添加跨两个请求表的伪多态 FK。详情重读领域请求并检查 viewer，不能以 notice payload 决定授权。
- 请求独立展示，禁止套用点赞聚合。幂等身份 request_type + request_id + revision + event_type + recipient；部分唯一索引只适用于请求通知，原活动聚合唯一索引必须排除此分支。
- invite / apply 反馈接收规则沿用各领域；决定 / 取消 / 过期发给另一参与方。延迟 pending 提醒若已终态则不显示可操作按钮；可抑制过期提醒，但决定事件本身可靠投递，通知已读不改变请求。
- GraphQL 从 pagedNotifications / mailbox 状态统一为 pagedNotices / inboxStatus，保留 pagedMentions 作为明确类型筛选入口；markRead 的 type 明确区分原物理流。同步 codegen / Inbox UI / badge / 任务 / 撤销逻辑；无旧字段 alias。
- Notice 详情不包含草稿正文或超出 viewer 权限的标题 / 私有资源信息。相同原因不同时发一条 Mention 和一条重复 Notice。

### 6.1 Notice / Dedup 列级迁移

下列 rename 和约束调整用于落实新存储；旧行值转换仅在确有数据需要保留时执行。可以用隔离合成数据验证转换和去重机制，不要求先取得生产副本，也不在运行时保留历史键兼容分支。

- 采用原表 rename：messaging.notifications → messaging.notices，action → type；read、thread、article_id、comment_id、from_users、from_users_count、user_id、原主键及时间保留。不新建平行 type 列，不留下 action / type 双分类。
- 合法旧 action 按 P0 统计的实际存量值和完整对照表一次性转换为规范 type；例如 upvote → upvote，实际存在的 UPVOTE → upvote。现有写入路径包含大写转换，不能假定历史已全为小写；其余配置内活动逐项列明，未知值阻断，不能盲目 lower。已有普通活动保留聚合成员及已读状态，不重发。该转换仅用于迁移，新运行时移除 normalize_action_attr 的大小写转换。
- 若存量旧 action 中出现提及类 / 未知行，先确定 producer 和稳定投递身份；不能自动向 messaging.mentions 补写，也不能靠删除行掩盖重复。无法分类则阻断切换，输出逐项处置清单。
- messaging.notification_deliveries → messaging.notice_dedup，notification_id → notice_id；delivery_key、已有 claim 主键和 claim / attach 幂等语义不变。rename 后 FK 指向 notices，维持现有可空及删除通知时置空的行为；即便 notice_id 为空，已有 key 仍阻止该事件重新投递。索引 / 约束名、Schema、Query / Persist、worker payload 及 fixture 同批更新，无旧字段 alias。
- rename 与 action 值转换、请求分支列 / CHECK / 部分唯一索引切换在停写窗口和同一迁移单元内完成；P0 列出旧聚合唯一索引、依赖 SQL 和外部消费者。P3 同批直切全部 Messaging 生产者 / 消费者、worker payload、schema / codegen 及 Inbox，验证旧读状态、embed users、claim 和新请求分支后恢复写入；不能等待 H / C / D 或 P4 才恢复 Messaging 写入。P4 只做最终查漏、生成检查及旧层清理。回退使用整套匹配备份，不提供双写。

Notice type 的唯一合同源为 packages/contracts/notice.contract.json；P0 枚举全部现有 producer / 存量值，合同覆盖其合法活动类型及 invite / apply / result，不凭示例裁掉其他活动。新增生成器输出 TS 常量 / union、Elixir Ecto.Enum values 与数据库 text CHECK 所需值；GraphQL 从同源生成或做 parity 检查。Schema 使用 Ecto.Enum，内部调用传明确枚举值，外部解析仅接受规范值，禁止运行时字符串大小写修正及不受控 atom 转换，不引入 PostgreSQL 原生 ENUM。P3 提供 generate:notice / generate:notice:check 与前后端 parity 检查，P4 纳入生成检查及迁移后全量值校验。

### 6.2 唯一写入、查询及未读事实

```text
一次正文 @用户
  -> cms.mention_current_edges            内容关系，不含 read 状态
  -> messaging.mentions                  该次提及唯一收件箱记录
  -> 不再为同一提及原因写 notices

评论 / 回复等独立活动、invite / apply / result
  -> messaging.notices                   独立活动收件箱记录

Inbox
  pagedMentions -> messaging.mentions
  pagedNotices  -> messaging.notices
  unreadTotal  = unreadMentions + unreadNotices
```

| Inbox 接口                   | 唯一读取 / 写入来源                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| pagedMentions                | messaging.mentions，仅 viewer 的提及收件箱                                               |
| pagedNotices                 | messaging.notices，仅 viewer 的活动 / 请求通知                                           |
| inboxStatus                  | 从两流事实重建的 unreadMentions / unreadNotices / unreadTotal 摘要                       |
| markRead / markReadAll(type) | type = mention 只改 mentions，type = notice 只改 notices；校验 viewer 归属后重建两流计数 |

markRead(type, ids) 只修改对应物理流中属于 viewer 的行，type = mention / notice；然后在同事务从两类真实行重建各自未读数和总数。User Inbox 摘要不是第三份未读权威。标记 Mention 已读不改 Notice，反之亦然；重复标记不重复扣数。一次 @ 重试保留既有 read 状态，不能再出现第二条提醒。回复和直接提及若是两个真实不同原因，可分别有记录，但不能把同一个提及重复投递两次。

请求通知在 messaging.notices 新增以下字段（旧活动行均为空）：request_type text NULL CHECK IN ('article_co_author', 'community_admin')、request_id uuid NULL、request_revision bigint NULL CHECK > 0、event_type text NULL CHECK (event_type IN ('created', 'decided', 'cancelled', 'expired'))。请求通知要求这四项同时非空，普通活动全部为空；索引 UNIQUE(request_type, request_id, request_revision, event_type, user_id) WHERE request_id IS NOT NULL，INDEX(user_id, request_type, request_id)。type = invite / apply / result 与 request_type 的资源类别分别表达，不拼接组合枚举。旧活动聚合唯一索引排除 request_id 非空行，request 分支永不按 embed users 聚合。

请求事件枚举同源输出 Elixir / TS 值与数据库 CHECK：created 仅允许 Notice.type IN (invite, apply)，资源类别由 request_type 表达；decided / cancelled / expired 仅允许 Notice.type = result。数据库 CHECK 只限制本行的值域、type / event_type 组合及四字段全空 / 全非空，不校验跨请求表的一致性。领域 Effects 从已锁定并确认的请求事件构造通知，校验 invite / apply 与真实请求 type 一致；accept / reject 存于请求 decision，不扩展为互不一致的 event_type。非法拼写、错误 type 组合及半空请求行必须被数据库拒绝。

请求 Notice 的展示和构造合同：

- invite 的 from_users 为实际邀请人，apply 为申请人；人工 result 为实际决定 / 取消操作人，不固定使用原发起人。单个用户 actor 的 from_users_count = 1，仅作展示，不参与活动式聚合或幂等身份。
- 系统过期等 result 使用明确 system actor 展示；仅 type = result、请求字段齐全且经验证为系统事件的分支允许 from_users 为空、from_users_count = 0，不伪造用户。普通活动和用户发起的请求通知仍要求 from_users 非空；changeset 按类型与事件校验，不全局放宽 required。系统事件身份由可信领域事件给出，不能由客户端任意声明。
- community_admin 请求的 thread / article_id / comment_id 均为空，定位只依赖 request_type + request_id；thread 不扩充为社区请求枚举。文章请求也不能依赖通知携带的旧状态决定授权。
- Messaging.notify 增加明确请求分支，处理用户 / 系统 actor、接收方及请求字段；迁移现有只接受 User、排除自己和仅允许活动 action 的入口 / Persist 校验，不能只给表加列就宣称请求可投递。保持普通活动原有校验，请求规则由领域接收方合同约束。验收覆盖邀请、申请、人工结果、系统过期、社区请求无 thread，以及活动行缺 actor 被拒绝。

首批不合并两张收件箱表，不引入额外用户可见流；未来若统一物理存储，需另定迁移与 type 过滤协议，不能在当前实现中一边写两张、一边只统计一张。

## 7. 实施批次与切换

| 批次 | 内容                                                                                       | 退出条件                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0   | 旧权限 / 调用方与目标实现清单                                                              | 用于查漏并直接进入 P1；未定位调用方在改动时补齐，不要求逐键审批                                                                                                                                                                            |
| P1   | 唯一生成合同 / Catalog / Store、Admin / Global 授权 DDL、root / lord、FrontDesk ref        | 十四项基线及拆分项、全 Global / Community 清单覆盖检查、枚举生成 / parity、权限事实与并发测试通过；ref 回填可重跑，改 slug 不影响授权                                                                                                      |
| P2   | Admin 关系、请求、Receipt / Gate、事件与接口                                               | 不可委派规则、invite / apply 并发、请求事件与 Outbox 意图同事务验证通过；GraphQL 查询 / 写入及 Dash 管理与用户自助请求入口接通；旧直接 addModerator(s) GraphQL 写入口移除。通知投递及 Inbox 闭环归 P3，不作为 P2 的依赖                    |
| P2B  | 非 Doc 本站 Binding 下线 / 恢复 / Trash、Scope、GraphQL / Dash、失效效果                   | 已完成本地实现及定向验收，尚未发布。双社区只影响本站，目标社区 Activity 正确、其他社区无新增；并发 hide 只一条事实 / 活动、stale restore 拒绝；普通 Admin 下线 / 恢复保留，不能全局回收 / 销毁；依赖 P1，必须在旧 Trash 社区入口退役前完成 |
| P3   | Notices / Dedup / Inbox、请求通知和实际存在的前端消费者；Messaging 生产者 / 消费者原子直切 | Notice 枚举生成 / parity、已读后重试、聚合、未读、请求 actor / 空 thread 与处理闭环通过；同批恢复 Messaging 写入，不等 P4。已完成本地实现与定向测试；当前无前端 Inbox 消费者，不据此新增 UI                                                |
| P4   | 全消费方切换核验、DDL / 数据迁移演练、旧层退役                                             | P2B、C3、D1 / D2 消费者切换及 D3 验收完成；schema / generated / jobs / seeds / 文档无旧运行时入口，正式切换独立记录                                                                                                                        |

跨文档批次顺序与并行边界统一见 [Docs Mirror Fix §6](./docs-mirror-fix.md#6-实施批次与依赖)。P1 完成后，P2、P2B 与 H2 可并行开发，共用 Gate / Scope 修改须串行合入。P3 在 P2 后完成 Community Admin 通知闭环。Co-Authors 复用 P1 的目录与接口，C1 独立验收 Article 请求和 Outbox 意图，再用 P3 的投递基础设施验收 Article 通知。P4 放在 D3 后，至少不能早于 D2 的旧 doc.trash 消费者和查询入口退役。批次完成不等于可独立发布：P1 删除旧生成协议涉及的消费者尚未迁移时，该开发中间态不可发布，也不引入兼容映射。

### 7.1 四份文档独立边界复审（2026-11-17）

| 文档 / 批次          | 唯一领域所有权                                                                                                                                   | 本次决定                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport P1–P3 / P2B | Permission Catalog / Store、Global / Community Admin 身份与请求、Admin Gate、Messaging Notices / Inbox 基础与传递合同、非 Doc 本站 Binding Trash | 保留 P2 / P2B / P3；管理请求 UI 只处理 Admin 请求，不新增通用 Inbox。直接 addModerator(s) 写入口已从 GraphQL schema 移除；其他 Moderator 旧读写入口仍按 P4 清理，不在本批扩大迁移 |
| History H1–H3        | Article 事件冻结、Diff、受保护历史引用及历史 UI                                                                                                  | 按 History 自身批次验收。C2 验证普通 Article 写入口实际消费的历史能力                                                                                                             |
| Co-authors C0–C3     | Article 成员 / Article 请求、Article 授权消费与共同作者 UI                                                                                       | C1、C2 以 C0 为基础并行，C2 可用测试成员联调。C3 交付普通 Article 授权给 D1。Passport 提供 Catalog 和授权判断                                                                     |
| Docs Mirror D0–D3    | DocTree / Mirror / Queue / Binding Trash / 旧 Q 处置与 Doc 写入口                                                                                | 保留 D0 只读盘点及其独立代码；D1 等 C3、H3、P2 和 D0 必要处置，D2 / D3 按 Docs 合同推进。Docs 消费 Passport / History / Co-author 结果，不另造授权事实                            |

P1 提供 C0 所需的权限合同。C1 的 Article 通知实际投递依赖 P3 的 Notices 基础设施，其请求事务和 C2 多人联调各自验收。H1 可按 H0 / P1 合同并行，H2 等 H1 + P1。C3 → D1 → D2 → D3，D1 同时要求 H3、P2 和 D0 的必要处置。P4 负责最后清零及迁移验收。

共享文件不是各文档独立所有权：Permission 合同与生成物由 Passport 维护；Gate / Scope 的共享入口按 P2 → C → D 串行合入；DocTree 授权入口按 C3 → D1 → D2 串行合入。Article 保存 / 发布、历史保护与资产引用按 History / Co-authors 的锁序合同衔接。经本次对照，没有发现需要回退 H / C / D 独立领域实现的合同冲突；保留这些已有局部代码并分别归回各自批次，调整共享入口时遵守上述串行边界，不把未完成批次标成已验收或可发布。当前根 `docs:check` 只剩 P2B 的 `CommunityArticleTrashContract` 模块文档缺 ASCII 流程；该问题不属于 P2 / P3，独立归回 P2B 修复，不据此回退 Passport / History / Co-authors / Docs Mirror 的领域代码。

P0 清单供 P1–P4 实施查漏，不以全量历史数据迁移报告作为开发前置。按新关系行实现 Global / Community 权限与 root / lord，旧 cms.passports / passportString 及别名映射退出运行时。部署若确需保留已有授权，使用一次性转换将旧身份 / 授权写入新行，处理不明确的数据后再切换；不长期保留双读 / 双写，不在普通运行时兼容旧 JSON。

测试以明确的新权限组合、跨 scope 负例、并发请求、Notice 枚举 / 去重 / 未读和 ref 非空数据迁移为主，隔离合成数据可以验证机制。生产 / 预发副本仅在确有真实数据转换任务时使用，不要求无条件取得。ref 的回填 / 约束检查属于该 DDL 实施，不要求 P0 先跑完。

代码清单继续覆盖 Gate loader / Scope / access、Insights、Account 输出、PassportEditor、成员索引 / FK、旧 Moderator 字段、缓存键、seed / fixture / job，以及通知 action / Delivery claim / 未读投影；只清除待退役代码，不为了兼容旧写法引入新层。

management_binding_allowed? / base_command_binding_allowed? 中仅凭成员身份或任意登录身份放行的路径必须按对应 Action 迁移到显式 permission；不能只改 Moderator 字符串而保留身份旁路。P1 提供目录与判断，P2 改 Community 管理入口；旧 Doc 正文相关旁路由 Docs D1 在新正文入口同批退出，具体归属见 Docs 的唯一批次表。

验收还必须覆盖：带本站 Binding Trash 的 Article 经合法永久删除后无残留 FK，保护未解除时全部回滚；Doc pending / effective / 工作区 Trash 组合视图、无重复与只读用户权限；owner / root 全局 Trash 集合和单读范围一致；全局无审计上下文明确拒绝，Activity 社区与 effect 正确；非 Doc X / Y 同文，X Admin 下线 / 恢复只影响 X，列表 / count / 详情 / 搜索一致；owner 全局 Trash 同时影响 X / Y，本站恢复不能绕过；旧社区永久删除授权不再可用；move 两端任一拒绝全事务回滚；非法 co-author event type / Notice event_type 与错误组合被 DB CHECK 拒绝。

验收：系统 root / 社区 lord / Admin 跨 scope 正反例；普通 Admin 不能邀请或改权限；系统 root 不能经社区编辑 payload 被授予；owner 与 lord 分离；未知权限失败；同用户不同社区授权行独立更新、同一行竞争允许一方成功、另一方明确 revision_conflict，不静默覆盖；ref 不变且改 slug 可用；双 pending 竞争、响应丢失、终态重试、成员删除后旧请求不复活；事件 / Outbox / 授权写失败回滚；embed users 并发、已读后重复投递、Mention 单次提醒、私有邀请不漏正文；同一 Admin updateAdminPermissions 对 removeAdmin 并发仅有符合锁 / revision 顺序的合法结果，重新加入后旧 memberId 不命中新成员；markRead 双流、已读后重试和请求独立展示的计数正确。

执行 mix compile --warnings-as-errors、focused Passport / Gate / Admins / FrontDesk / Messaging 数据库与集成测试；make be.gen.schema、pnpm graphql:codegen、pnpm contract:graphql:generated、受影响 frontend type-check、pnpm run docs:check（文档链接 / 结构及现有静态门禁，不证明业务语义）。浏览器使用 /home/xx，验证 lord 发 invite、subject 接受、apply 决定及 badge。每批记录实际检查、环境、失败 / 未运行项；不得以计划表代替验收。

P2B 验收记录（2026-11-17）：`mix compile --warnings-as-errors` 通过；Binding Trash 持久化 / CAS、社区命令、全局 Trash、永久删除历史保护、生成 parity 与 Gate Scope 本站隔离相关测试合计 31 项通过。`packages/contracts` 的 `pnpm test` 通过（4 个 Node 测试、30 个 Vitest 测试）；根 `pnpm run contract:community-article-trash`、`pnpm graphql:codegen`、`pnpm run contract:graphql:generated`（60 个源文件）、Core / Dash type-check 及 Trash hook 4 项测试均通过。合同 freshness 已加入 `.github/workflows/graphql-contract.yml` 并覆盖 `packages/contracts/**` 变更。`pnpm run docs:check` 未通过：唯一 finding 是 Docs 所有的 `backend/api/lib/groupher_server/cms/doc_tree/commands/queue_access.ex:22` `transaction_owner` 边界；这不是 P2B 代码，但全仓静态门禁仍待 Docs 处理后复验。P2B 尚未发布。
