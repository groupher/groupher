# Article Co-Authors 与权限授权

> 状态：后端实现与 focused 验收已通过；多人编辑尚未正式启用或发布。C0 Passport 成员目录与授权、C1 请求/成员 Receipt Command、授权事件、Notice Outbox、GraphQL 读写字段，以及 C2 普通 Article `edit_article` 准入、历史贡献者归因和 Review 自审保护均已实现。独立测试用户已通过 GraphQL 邀请/接受，并实际保存 WorkingCopy；移除后写入被拒绝。Dash 的 Post / Changelog 列表已接入 Article 协作者管理面板；Docs 编辑器已接入同一面板，普通 Post 的双账号保存验收已通过。后端按 Article 和测试账号可闭环验收，不等待邀请 UI、P3、M2 或 Dev Hub 改造。
>
> Co-Authors 使用 [Passport](../../migrations/passport-permissions-refactor.md) 的 Article 权限合同。正文联调可用测试成员独立开展，启用时验证编辑入口实际使用的 [历史与归因能力](./edit-history-diff.md)。[Docs Mirror Fix](../../migrations/docs-mirror-fix.md) 的 D1 消费本批交付的 Article 授权。
>
> 本文拥有 Article 成员、请求与权限变更流程；Passport 统一授权，不新建 ArticleAuthorization、独立 grant 表或 Passport.Requests。

本轮按已确认设计直接实现，不要求逐键审批或签字。旧权限 / 写入口清单用于定位调用方、替换旧路径和防止漏改，不是额外产品决策流程。新协议直接切换，不提供历史键兼容、别名、双读双写、fallback 或过渡入口；现有数据仅在实际需要保留时安排一次性转换及针对性验证，不默认要求生产副本或迁移演练才能开发。确有未决定的用户行为才提出具体场景讨论。实现与发布分别验证，不用尚未实现功能的测量结果阻塞其开发。

## 1. 领域边界

```text
Article.author_id -> owner
Article.co_authors -> has_many ArticleCoAuthor -> permissions map
Articles.CoAuthors.Requests -> invite / apply -> decision
Passport -> permission facts
Gate -> resource admission
Article history -> actor / time / before / after
```

- owner 表达归属，不等于 Community lord；co-author 不替换 owner。
- 成员数无产品上限，列表分页；准入只查询当前用户关系，不加载全名单。
- 成员可持有空 permissions。关系在所有 Binding 上共享，不复制到用户 Passport JSON 或站点。
- Community Admin / lord 不自动获得 Article 正文编辑、历史、发布权限。
- 移除成员直接删除当前关系行；请求、授权事件、贡献者及修改历史独立保留。再次加入走新请求。写入必须匹配 memberId，不能因新成员 revision 再次从 1 开始而误用旧操作。
- owner 离职、封禁或其他不可用情况暂不纳入本期；不新增系统 root 接管邀请、维护者恢复或所有权转移入口，也不作为 C3 / D1 放行前置。后续按独立所有权转移方案处理，Community lord 本期不自动获得 Article 正文权限。
- 不实现实时光标 / 字符级协同，继续使用 WorkingCopy revision 检测并发覆盖。[co-edit POC](../../architecture/co-edit.md) 是独立未启用计划，不作为本批前置。

## 2. 数据合同

datetime 列用 timestamptz，Ecto 用 :utc_datetime；timestamps() 沿用 Repo 默认值。成员、请求和授权事件表已按以下合同定义迁移；部署前仍须按验证矩阵运行迁移及 focused tests。

### 2.1 当前成员

```text
cms.article_co_authors
  id uuid PK
  article_id uuid NOT NULL FK articles RESTRICT
  author_id bigint NOT NULL FK authors RESTRICT
  permissions jsonb NOT NULL DEFAULT '{}'
  revision bigint NOT NULL DEFAULT 1 CHECK > 0
  joined_at timestamptz NOT NULL
  inserted_at / updated_at
  UNIQUE(article_id, author_id)
  INDEX(author_id, article_id)
```

当前行即有效成员，无 invited / revoked 状态或 revoked_at。Article.author_id 不变，禁止 owner 加入自己。Author.user_id 提供持久化层的稳定账号映射，不为协作创建重复 Author。GraphQL 邀请入口使用公开 login 定位接收者，并在服务端解析为内部 User ID；成员与请求存储仍只使用 ID 关联。

permissions 仅允许目录内可授予的 Article 键和 boolean 值，false 不持久化；未知键报错，不静默丢弃。移除成员不得级联删除请求、Snapshot、历史或事件。成员 revision 防止过期权限编辑。

### 2.2 请求

模块归 CMS.Articles.CoAuthors.Requests，表为 cms.article_co_author_requests；不建多态通用请求表。

```text
id uuid PK
article_id uuid NOT NULL FK articles RESTRICT
subject_user_id bigint NOT NULL FK account.users RESTRICT
created_by_id bigint NOT NULL FK account.users RESTRICT
type text NOT NULL CHECK IN ('invite', 'apply')
status text NOT NULL DEFAULT 'pending'
  CHECK IN ('pending', 'decided', 'cancelled', 'expired')
decision text NULL CHECK IN ('accept', 'reject')
proposed_permissions jsonb NOT NULL
approved_permissions jsonb NULL
revision bigint NOT NULL DEFAULT 1 CHECK > 0
decided_by_id bigint NULL FK account.users RESTRICT
decided_at timestamptz NULL
cancelled_by_id bigint NULL FK account.users RESTRICT
cancelled_at timestamptz NULL
expires_at timestamptz NOT NULL
reason text NULL
inserted_at / updated_at
UNIQUE(article_id, subject_user_id) WHERE status = 'pending'
INDEX(article_id, inserted_at, id)
INDEX(subject_user_id, status, inserted_at, id)
INDEX(expires_at, id) WHERE status = 'pending'
```

- invite：owner 发起，subject 决定；apply：subject 发起，当前 owner 决定。
- proposed_permissions 在请求创建后不可修改。邀请权限有变，取消后新建，重新确认。
- decided 必须同时具有 decision / decided_by / decided_at；只有 accept 具有 approved_permissions。其他状态决定字段为空；cancelled 必须有取消人和时间。数据库 CHECK 固定这些组合。
- 有效期首版固定 7 天，服务端 UTC 计算。决定和新建请求时在锁内检查期限；旧 pending 先置 expired，才能建立新请求。
- 同资源同用户最多一个 pending，invite / apply 共用唯一约束；冲突返回已有请求身份，不自动接受或改写类型。
- 公开 Article 可申请；非公开 Article 仅已有成员可申请增权，其余通过 owner 邀请。不得借 apply 探测隐藏资源。
- 请求以 User 为主体，未写过文章的有效账号也能收到邀请；创建 / 拒绝请求不要求 Author。接受请求在同事务 ensure_author_exists(subject_user)，取得或创建真实 Author 后建立成员，不创建假文章。Author.user_id 唯一竞争重读，整个接受失败则回滚。
- 请求无成员外键，成员删除后请求终态保留。article.permanent_delete 显式处理这些 RESTRICT 引用，不依赖关系级联。

## 3. 权限与读取

所有 thread 共用 Article 目录，每篇独立授权；Action 与 Permission 字符串一致。

| Permission              | 操作                                                                                                     | 授予依赖                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| article.read_draft      | 读取 WorkingCopy / 编辑区                                                                                | 无                                                              |
| article.update          | 保存正文、标题、typed 字段、标签、封面、附件引用；创建编辑副本、fork、丢弃未公开工作副本（按其生命周期） | article.read_draft                                              |
| article.publish         | 发布 WorkingCopy 或选择 Snapshot                                                                         | article.read_draft；选择历史 Snapshot 另需 article.history.read |
| article.history.read    | 历史列表、Snapshot 与 Diff                                                                               | 无                                                              |
| article.history.restore | 历史恢复为新修改                                                                                         | article.history.read + article.update + article.read_draft      |

article.publish 的权限依赖不是完整发布前置：既有发布入口仍须加载实际 Community / Binding、校验资源可写、预期 Public head、内容完整性及 Review 等对应规则。D1 只解除正文发布与站点 Queue 的耦合，不增加零站点入口发布；缺少有效产品入口应拒绝，不能因拥有 permission 就自动创建公开入口。

“打开编辑器但只读”只需 read_draft；从 Public 新建 WorkingCopy、fork 或写入需要 update，读取来源历史 Snapshot 另需 history.read。放弃副本执行其现有生命周期保护，不表示可删除共享 Article 或 Public。

缺依赖报 permission_dependency_missing，界面展示缺少项，不隐式加权。revoke 必须一并撤销依赖它的权限，确认页展示完整集合。首版不拆 asset / cover / tag 权限，上传仍执行资产域准入。

owner 首版默认集合明确为：article.read_draft、article.update、article.publish、article.history.read、article.history.restore、article.author.manage、article.trash.read、article.trash、article.restore、article.permanent_delete，共十项；仅对已注册且支持的 Article Action 生效，未知 Action 仍拒绝，不把未来所有权转移动作算入默认集合。

owner 权限在一个地方统一推导。article.author.manage 为共同作者管理动作，article.trash.read 为 owner 全局 Trash 读取，article.trash / article.restore / article.permanent_delete 为全局 Article 删除 / 恢复动作，均不进入普通 co-author 可授予集合。删除语义以 Diff 基座 §6.1 为准，本站页面移除不使用这些 Article 全局动作。不再新增 article.delete / article.destroy 这类同义键，article.owner.transfer 也不列入首版目录；所有权转移及 owner 不可用处置后续单独设计。系统 root 特权不绕过资源状态或版本。

完整十四项基线及社区拆分动作的 scope / grantable / requires / 消费者统一见 [Passport §4.3–§4.5](../../migrations/passport-permissions-refactor.md#43-article-与社区展示操作的完整-action-清单)。社区 Admin 使用 community.article.hide / restore / trash.read 管本站展示，不能从 co-author 身份推导；owner 也不自动获得社区权限。

```text
FrontDesk 加载 canonical Article
  -> Gate 加载 actor 的稳定 Author 与当前成员授权事实
  -> Passport.allowed?(actor, article_scope, action)
       owner -> 默认权限集合
       other -> 按 article_id + author_id 查询 permissions[action]
  -> Gate 组合 Lifecycle / Review
  -> Command 校验 revision 并原子写入
```

授权编辑 / 历史入口独立于 Community Binding。公开路由仍按请求 Community 过滤，不能用正文权限绕过站点可见性。list 用可组合 Scope query，不做逐行 Gate 检查。

## 4. 请求、移除与事务

| 场景                           | 处理                                                      |
| ------------------------------ | --------------------------------------------------------- |
| owner 邀请                     | subject accept / reject；接受原提议全部权限               |
| 用户申请加入或增权             | owner accept / reject；批准可缩减但不超出提议，且依赖完整 |
| apply 未处理时 owner 再 invite | 返回已有请求，不创建第二条，不自动同意                    |
| 已有编辑权限再申请发布         | 接受仅增补 approved_permissions，保留已有权限             |
| owner 移除成员                 | DELETE 当前关系；取消该 subject 的 pending 请求；记录事件 |
| 成员主动退出                   | 同样删除自己的关系；owner 不可用退出放弃归属              |
| 再次加入                       | 新请求、新成员行，只持有本次批准权限                      |

invite 发起 owner / subject、apply 发起人 / 当前 owner 可取消 pending 请求；reject 仅由本次决定人执行。每次以当前资源归属重新校验。

```text
AcceptRequest / Receipt commandId
  -> 按 Passport 共享锁序取得所需 Article、账号 / Author、成员及请求锁
  -> 当前处理人 / pending / request revision / 期限 / 资源准入
  -> 校验最终权限及依赖；ensure_author_exists(subject_user)
  -> 建立成员或 Passport 增补权限（同事务）
  -> 写决定及 approved_permissions
  -> 记录成员 / 授权事件 + 通知 Outbox
  -> commit -> Confirmation
```

所有成员 / 请求 / grant / revoke 命令遵循 [共享锁序](../../migrations/passport-permissions-refactor.md#42-本轮写入共享锁序唯一维护位置)；纯协作请求不需要站点锁，不存在的成员也由 Article 锁串行化。若入口还要站点锁，必须先取得所需站点锁，不能事后补取。Passport 不另开事务，领域 Command 是事务 owner。取消、拒绝与过期不改成员；移除 / 退出取消该用户 pending 请求，避免随后复活。

六类 Receipt operation（请求创建 / 决定 / 取消、权限更新、成员移除 / 退出）使用 co-author 专属 closed-set identity policy；identity 保留 Article、请求或成员选择器，并对权限 map 做摘要处理，不复用 Community Admin 命令身份。

账号资格检查执行 Accounts 当前有效账号合同；新增 RESTRICT 引用不得绕过现有禁止非受控账号物理删除的规则，未来受控删除须显式处理请求 / 事件，不把 Author 懒创建误解为 Author 可随成员删除。请求过期索引与领域 ExpireRequest / 系统 Job 规则复用 Passport 文档 §5.1。

同 commandId 重试返回原决定，不重做授权 / 通知；另一个命令再次决定终态返回 request_already_decided。旧 accept 在成员删除后重放返回旧决定及当前成员状态，不重新加入。重复接受不同 commandId 不视为新授权。

通知按 request ID + revision + event + recipient 去重；invite 到 subject，apply 到 owner，决定 / 取消 / 过期反馈另一方。通知不含草稿；请求详情仅允许当前 owner / subject 查看必要信息。状态重读，通知已读不代替业务决定。

授权事件独立记录 article、subject 稳定身份、actor、UTC 时间、operation_ref、request_id、before / after permissions、加入 / 移除 / exit / grant / revoke 原因。内容修改必须执行 Diff 基座合同。

事件表固定为 cms.article_co_author_events：id uuid PK、article_id uuid FK articles RESTRICT、subject_user_id bigint FK account.users RESTRICT、member_id uuid NULL（非 FK，记录本次成员实例）、actor_type text（user / system）、actor_id bigint NULL FK account.users RESTRICT、type text（join / remove / exit / grant / revoke / request_create / request_decide / request_cancel / request_expire）、before_permissions / after_permissions jsonb、request_id uuid NULL FK article_co_author_requests RESTRICT、operation_ref uuid、operation_index integer、occurred_at timestamptz、inserted_at timestamptz，字段除 request_id / actor_id / member_id 外 NOT NULL；user actor 必须有 actor_id，system actor 的 actor_id 为空，UNIQUE(operation_ref, operation_index)，INDEX(article_id, occurred_at, id)。请求创建 / 终结也记事件，无成员变化时 before / after 相同。数据库声明 type、actor_type、actor 与 member_id 组合 CHECK，不只靠 changeset 约束；成员变更事件必须带 member_id，请求事件允许其为空。事件不可更新；member_id 保留已删除关系的身份但不建立外键，执行成功的全局 article.permanent_delete 按 Diff 基座 §6.1 显式清理；本站删除 / 成员移除不得触发。无站点归属的成员 / 授权事件只进该领域事件表，不要求 Community Activity，也不为此伪造站点；现有真实社区活动如需显示，只能使用明确、授权后的独立投影。通知意图由领域 Effects 写 Outbox，Command 调用该 Effects；Persist 不直接发消息。

## 5. Review、GraphQL 与 Dash

正文 Review 接入归 C2。目标正文不自审规则覆盖 owner、当前 co-author 和被审版本的实际历史贡献者；历史读取按目标发布 Snapshot 的同 Article lineage 判断，已退出的成员仍按其实际贡献判断。Docs 站点审批按目录贡献者判断，由 D1 负责。

### 5.1 读取及请求处理权限

| 接口 / 操作                                               | 准入与返回范围                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pagedArticleCoAuthors、完整成员 permissions、协作授权记录 | article.author.manage；owner / 系统特权按目录规则推导，不向普通登录用户暴露全名单权限                                                                                                   |
| pagedArticleCoAuthorRequests / 单请求详情                 | article.author.manage 可看该 Article 全部请求；subject 仅看自己的必要信息，SQL 先按身份过滤，不漏其他请求 count / 权限                                                                  |
| articlePermissions                                        | 已登录 actor 查询自己的有效集合，不接收任意 targetUser；Article 可公开读取或 actor 是 owner / 当前成员才可查询，否则 not-found。无需先有 article.read_draft，避免查询自身权限的循环依赖 |
| 请求决定                                                  | invite 仅 subject、apply 仅当前有管理权者；可读取请求不等于可决定                                                                                                                       |
| 请求取消                                                  | 按 §4 的发起人 / subject / 当前管理者规则，终态和 revision 校验不省略                                                                                                                   |
| 公开共同作者摘要（如展示）                                | 跟随 Article 可读性，只输出账号展示信息，不含 permissions、请求或审计；不用于授权                                                                                                       |

article.author.manage 明确包含完整成员 / 请求管理读取、邀请、apply 决定、管理者取消及 grant / revoke / 移除；subject 自己的请求读取 / 取消是身份限定路径，不将该管理权限授给 subject。历史正文权限仍是 article.history.read，与管理读取分开。

编辑器首版只展示当前用户自己的有效权限，不展示他人成员名单或“当前 N 人可编辑”计数；若以后增加公共协作者摘要，必须单独定义字段和可见性，不能顺手放宽 pagedArticleCoAuthors。Action / permissions map 校验直接复用 Passport 同源枚举目录，不维护 Co-author 私有权限枚举。

### 5.2 GraphQL 与 Dash

目标字段：pagedArticleCoAuthors、pagedArticleCoAuthorRequests、articleCoAuthorCandidates、articlePermissions、createArticleCoAuthorRequest、decideArticleCoAuthorRequest、cancelArticleCoAuthorRequest、updateArticleCoAuthorPermissions、removeArticleCoAuthor、leaveArticleCoAuthors。候选人搜索仅供 Article 管理者使用，直接返回统一的 `common_user` 列表（与 Community Admin 候选搜索一致），并排除 owner、当前成员和已有 pending 请求。邀请 mutation 沿用现有 Community Admin 命令的 `subjectLogin` 身份约定，由后端解析为内部 User id；GraphQL 不暴露 account user id。命令带 commandId，决定 / 取消带 request revision；权限修改 / 移除 / 退出带 memberId + member revision。type / status / decision 使用 enum；列表沿用 Pagi。operation 命名遵循命名规则，无页面前缀。

decide 接收 decision，apply accept 带 approvedPermissions，invite accept 使用持久化提议。响应含 requestId / revision / decision 及当前 member 身份 / revision，不以收到通知推断成功。

Dash 的 Post / Changelog 列表已接入协作者管理面板，支持 Article 管理者搜索邀请、查看与调整成员权限、移除成员，并支持请求处理；Docs 编辑器复用同一面板。C2 后端已按当前 Article scope 准入 `edit_article` 并执行历史贡献者和 Review 自审检查；当前用户权限 GraphQL 字段已提供。Dash 编辑器接线仍需保留本地脏内容和 revision 冲突提示。后端按当前 Article ID 校验成员与历史访问权限，发布仍需有效产品入口。

## 6. 实施与验收

| 批次 | 交付                                                                      | 独立验收                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0   | Article 成员 / 请求数据、Passport scope 及 Article grant/revoke facade    | schema、permission contract、grant/revoke 和 fail-closed 范围检查已落地，co-author Passport/Gate focused tests 通过                                                                                                                                                                                                                                                               |
| C1   | 请求 / 成员 Command、Receipt、授权事件、Outbox 意图及 GraphQL / Dash      | GraphQL invite→subject read→accept、currentMember、成员/请求隐私、命令/事件/Notice 去重与并发 focused suite 通过（15 passed、2 skipped）。Post / Changelog 列表已接入管理面板；Docs 编辑器已接入；owner 邀请与成员移除已在浏览器验证。共用基础设施见 [Messaging Notices 与 Inbox 收口](../../migrations/messaging-notices-refactor.md)，不要求 Passport P3 或 Messaging M2 已验收 |
| C2   | 普通 Article 的多人读取草稿、保存、发布、Review 和编辑器联调              | 双用户通过真实 co-author 授权保存 WorkingCopy，移除后写入拒绝；Article Gate 3 例、历史/Review 2 例及 Docs fixture 2 例通过。普通 Post 的浏览器正文保存验收已通过                                                                                                                                                                                                                  |
| C3   | 正式切换普通 Article 授权入口并退役旧动作，交付供 D1 复用的 Passport 判断 | 用正式入口通过 C1、C2 的相关场景，旧社区正文权限退役，Doc 写入继续由 D1 切换                                                                                                                                                                                                                                                                                                      |

### 6.1 开发与联调

- C1 采用 Passport 共享锁序和请求状态约定。用命令响应和请求查询验证状态，事务内验证授权事件和 Outbox 意图；GraphQL execution 验证字段与 resolver。Article 请求事件与 producer 的事件语义、接收方和实际投递归 C1；复用独立验收的 Messaging M1 / M2 Notice / Dedup 基础设施。Article 通知验收不阻塞 Passport P3。
- C2 已在隔离测试环境用两个不同测试账号从邀请 / 接受建立成员关系，再通过真实 `save_working_copy` 验证编辑和移除后的失权；不需要先完成邀请 UI、Dev Hub 或其他模块。浏览器验收可后续按产品界面单独推进。夹具及替身仅限测试。
- C1、C2 的开发、后端验收和管理 UI 可分别交付，不等待 Passport P4 或 Docs D1–D3。C3 是普通 Article 正式授权入口切换，完成自身 C2 / H3 验收后即可独立交付；它是 Docs D1 的输入，不要求等待 D1–D3。Passport P4 的全局残留检查与最终切换是后续汇总门槛，不把其未完成状态反向作为 C 批次的开发阻塞。
- History 按自身批次交付和验收。C2 用真实保存和发布生成的事件验收本文要求的 actor、版本来源、授权读取和 Review 归因。H3 的完整界面验收按 History 计划推进。

### 6.2 正式启用

普通 Article 启用时，用真实成员管理和编辑入口验收加入、读取草稿、保存冲突、发布、移除后失权，以及本入口实际依赖的历史记录、读取准入和正文不自审规则。请求通知在开放投递前，单独验证 Article 事件从 Outbox 到 Notice、重试去重及详情准入；通用 Notice / Inbox 机制按 [Messaging Notices 与 Inbox 收口](../../migrations/messaging-notices-refactor.md) 独立验收。Docs 站点写入由 D1 独立验收；共用 DocTree / Gate Scope 的入口按 C3 → D1 → D2 串行合入。跨文档排期见 [Docs Mirror Fix §6](../../migrations/docs-mirror-fix.md#6-实施批次与依赖)。

必验场景：

1. read_draft + update 可编辑不能发布；加 publish 可发布，不能管理站点；缺依赖授予被拒绝。
2. 同 Article 多 Binding 读取同一成员 / 内容；20 个以上成员分页，单用户准入不加载全名单。
3. invite / apply 并发仅一个 pending；过期后可创建；accept 对 cancel、accept 对移除、双 accept 使用独立连接竞争只有合法结果。
4. Passport / 事件 / Outbox 任一步失败全事务回滚；成功响应丢失重试不重复写；旧 accept 不复活已删除成员。
5. 删除关系后历史仍在，再加入不恢复旧权限；revoke 不修改 Binding 或 Public。
6. A 改正文、B 改标题、owner 发布，分别归因；成员删除不清 Review 贡献者。
7. 请求 ID / Article / subject 串用拒绝，旧通知不能授权，非公开邀请接受前不暴露正文。
8. 历史记录和读取不依赖当前 Binding；不新增无站点入口继续发布的产品功能。公开 Doc 仍按站点可见性过滤。

C3 退役旧社区正文 Action / grant，不把它们的持有者自动转成 co-author 或授予 article.update。post.set_category 保留为 Community 分类管理，不能作为正文准入；Doc 的对应正文切换由 D1 处理。

C3 修改共用 Scope / Access helper 时必须明确普通 Article 与 Doc 分支：普通 Article 在 C3 切换，Doc 继续保持原已保护路径，直到 D1 同时切换其正文入口与准入；不得因修改 Post / Doc 共用函数提前放开旧 Doc Queue 写入。

新增 / 迁移账号、首次受邀且尚无 Author、删除成员后保留具体 member_id 历史也是 C1 必验场景。

按交付范围执行定向验证。C1 跑请求、成员、Receipt 和 Outbox 事务测试，实际投递接入时跑 Article 请求的 Messaging 测试。C2 跑 Passport / Gate、WorkingCopy、History 和 Review 的相关测试，并在 `/home/xx` 用测试成员走真实双账号浏览器流程。C3 用正式入口复验本节的启用条件。后端变更执行 `mix compile --warnings-as-errors`，Gate 合同变更执行 `generate:gate`、`generate:gate:check` 及 parity，GraphQL 变更执行 `make be.gen.schema`、`pnpm graphql:codegen`、`pnpm contract:graphql:generated` 和受影响前端的 type-check。

共用 Gate / Scope 或全局永久删除改动影响本站 Trash 时，按 Passport §4.4.2 验证其合同。在 packages/contracts 执行 pnpm run generate:community-article-trash、pnpm run generate:community-article-trash:check 和 pnpm test，在根目录执行 pnpm run contract:community-article-trash，在 backend/api 执行 mix test test/groupher_server/cms/articles/community_article_trash_contract_test.exs。涉及 GraphQL 字段时执行 pnpm graphql:codegen 和 pnpm contract:graphql:generated。

### 2026-11-24 普通 Post 正文验收

在本地社区 `coauthor-final24`，owner 通过 Dash 邀请 editor，editor 通过 fixture 的正式命令接受邀请，仅获 `article.read_draft` 和 `article.update`。editor 从独立 Community 会话打开 Post 设置，插入提示块并保存。owner 复查同一 WorkingCopy 的 revision 从 1 增至 2，公开 Snapshot 保持 `b010f7ac-f159-4c1f-9483-22154c775c3e`。owner 在 Dash 确认请求已处理并移除了该成员。

2026-11-24 收尾清理通过 Dev Hub fixture 工具完成。预览无 blocker，apply 返回 cleaned、errors 为空，Admin、Global grant、co-author 和 pending request 均为 0。随后 close 返回 closed、actors 为 2。测试社区已归档，账号、Article、Snapshot 和审计历史按现有保留合同留存。
