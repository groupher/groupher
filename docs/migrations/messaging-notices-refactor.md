# Messaging Notices 与 Inbox 收口

> 状态：实施中，M1 / M2 已有本地实现（Notice 合同、`notices` 模块及切换迁移），尚未发布。
>
> 本文只定义 Messaging 的 Notice / Dedup / Inbox 基础设施、迁移及通用投递边界。Passport owns Community Admin 请求事件与通知意图；Co-authors owns Article 请求事件与通知意图。各领域生产者的事件语义、接收对象和资源授权由其领域文档及独立验收负责，不由 Messaging 推断。
>
> 相关文档：[Passport Permission 与 Admin](./passport-permissions-refactor.md)、[Co-authors](../feature/article/co-authors.md)、[Passport P0 消费者盘点](./evidence/passport-p0-consumers.md)。

## 范围与独立验收

- Messaging 核心可独立验收：Notice 合同 / 生成 parity、旧表迁移、Dedup / Outbox 重试、双物理 Inbox 读取与已读事实、GraphQL / codegen 和当前生产者 / 消费者切换。使用隔离合成数据验证迁移及重试，不依赖 Co-authors C1 的 Article producer。
- M0：只读盘点现存 type/action、producer、consumer、DB 约束和外部依赖；输出迁移映射及未知值处置，不要求生产数据副本。
- M1：Notice 合同、Notice / Dedup schema、唯一键和 Delivery claim；用合成数据验证旧值迁移、并发去重和故障重试。
- M2：Mentions / Notices 双流 Inbox、未读摘要、GraphQL / codegen 与当前生产者 / 消费者原子切换；验证读取、已读、重试不重发及旧消费者清零。M1 / M2 的开发检查可独立执行，实际 schema / writer 切换按同一迁移单元原子验收。
- 领域行为由各自批次独立验收，不另设为 M1 / M2 的完成门槛；已接入的 Community Admin 请求 producer 仍属于 M2 切换范围。
- Passport P3 验收 Community Admin 请求生产者与此基础设施的集成，覆盖 invite / apply / decided / cancelled / expired 的 recipient、稳定请求身份、投递去重及详情授权。M2 切换后由 P3 按新 schema 复跑该定向验收，不等待 Co-authors。
- Co-authors C1 单独验收 Article 请求生产者接入同一 Notice 合同、Outbox 投递和详情准入。它验证 Article 专属语义，不回头阻塞 Messaging 核心或 Passport 的完成。
- 如果共享 Notice schema 提前声明 `article_co_author` 类型，只代表基础设施接纳该稳定分类；不代表 C1 producer 已完成或已验收。

## Messaging 基础设施合同

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

## Notice / Dedup 列级迁移

下列 rename 和约束调整用于落实新存储；旧行值转换仅在确有数据需要保留时执行。可以用隔离合成数据验证转换和去重机制，不要求先取得生产副本，也不在运行时保留历史键兼容分支。

- 采用原表 rename：messaging.notifications → messaging.notices，action → type；read、thread、article_id、comment_id、from_users、from_users_count、user_id、原主键及时间保留。不新建平行 type 列，不留下 action / type 双分类。
- 合法旧 action 按 P0 统计的实际存量值和完整对照表一次性转换为规范 type；例如 upvote → upvote，实际存在的 UPVOTE → upvote。现有写入路径包含大写转换，不能假定历史已全为小写；其余配置内活动逐项列明，未知值阻断，不能盲目 lower。已有普通活动保留聚合成员及已读状态，不重发。该转换仅用于迁移，新运行时移除 normalize_action_attr 的大小写转换。
- 若存量旧 action 中出现提及类 / 未知行，先确定 producer 和稳定投递身份；不能自动向 messaging.mentions 补写，也不能靠删除行掩盖重复。无法分类则阻断切换，输出逐项处置清单。
- messaging.notification_deliveries → messaging.notice_dedup，notification_id → notice_id；delivery_key、已有 claim 主键和 claim / attach 幂等语义不变。rename 后 FK 指向 notices，维持现有可空及删除通知时置空的行为；即便 notice_id 为空，已有 key 仍阻止该事件重新投递。索引 / 约束名、Schema、Query / Persist、worker payload 及 fixture 同批更新，无旧字段 alias。
- rename 与 action 值转换、请求分支列 / CHECK / 部分唯一索引切换在停写窗口和同一迁移单元内完成；M0 列出旧聚合唯一索引、依赖 SQL 和外部消费者。M2 同批直切当前 Messaging 生产者 / 消费者（包括已接入的 Community Admin 请求 producer）、worker payload、schema / codegen 及 Inbox，验证旧读状态、embed users、claim 和新请求分支后恢复写入；不能等待 H / C / D 或 Passport P4 才恢复 Messaging 写入。尚未实现的 Article co-author producer 由 Co-authors C1 单独接入，不阻塞 M2。Messaging 后续只做最终查漏、生成检查及旧层清理。回退使用整套匹配备份，不提供双写。

Notice type 的唯一合同源为 packages/contracts/notice.contract.json；M0 枚举全部现存 producer / 存量值，合同覆盖其合法活动类型及 invite / apply / result，不凭示例裁掉其他活动。新增生成器输出 TS 常量 / union、Elixir Ecto.Enum values 与数据库 text CHECK 所需值；GraphQL 从同源生成或做 parity 检查。Schema 使用 Ecto.Enum，内部调用传明确枚举值，外部解析仅接受规范值，禁止运行时字符串大小写修正及不受控 atom 转换，不引入 PostgreSQL 原生 ENUM。M1 提供 generate:notice / generate:notice:check 与前后端 parity 检查；M2 检查迁移后全量值和旧消费者清理。

## 唯一写入、查询及未读事实

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
