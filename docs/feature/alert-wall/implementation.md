# AlertBoard / ReviewBot 实施合同

> 版本说明：本文是 V1 实施基线；新一轮重构按 [V2：ReviewBot / AlertWall](./v2.md) 的边界、接口、迁移和验收执行。下文“冻结”仅指 V1，不覆盖 V2。

> 状态：实施合同，2026-10-22；本文件冻结目标决策，D1–D5 与 N1–N7 运行时代码及本地自动化回归已完成；真实浏览器验收与 N8 维护切换证据见 [delivery.md](./delivery.md)，这些步骤完成前不可视为已上线。
> 与 [产品合同](./design.md)、[批次和验收](./delivery.md)、[旧链删除清单](../../migrations/legacy-content-audit-removal.md) 配套。
> 下文标为“新增”的表、模块、接口描述本轮最终合同；代码实现状态以批次文档为准。无旧 Audit 兼容层。

## 1. 当前源码依据与明确改动

所有源码路径相对 `backend/api/lib/groupher_server/`，除非另有完整前缀。

| 当前源码                                                      | 核对事实                                                                                     | 实施决定                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `cms/model/article_lifecycle.ex`                              | article_id UUID 唯一；draft_only/published/archived/deleted/destroy                          | 保持主状态；审核限制独立组成 Lifecycle 有效状态                             |
| `cms/model/comment_lifecycle.ex`、`cms/comments/lifecycle.ex` | comment_id 整数；visible/deleted/destroy；删除保留 tombstone                                 | 不把待审写成 deleted；新增限制表，不新增 Comment 产品版本                   |
| `cms/model/doc_lifecycle.ex`                                  | article_id + branch_id 唯一                                                                  | 平台检查按 branch 隔离，不改 Doc 发布/恢复语义                              |
| `cms/model/community_lifecycle_blocker.ex`                    | 有 cause、operation_ref、结束记录                                                            | 复用 blocker 的归属与独立解除原则；它只适用于 Community，不能拿来存内容限制 |
| `cms/model/article_binding.ex`                                | 每个 binding 都是 peer，article_id + community_id 唯一                                       | 社区限制作用于一个 binding；不假设主社区/镜像等级                           |
| `cms/comments/commands/update.ex`                             | receipt_pipeline、父聚合 Gate、expected_version、事务内 RequiredJobs 与 Outbox               | 在同一事务替换旧 audition 登记，保留父聚合锁和 Receipt                      |
| `cms/articles/commands/moderate.ex`                           | direct_pipeline、旧 :moderate 准入                                                           | 整体删除；新 ApplyReviewDecision 独立定义，不改名包装                       |
| `cms/outbox.ex`                                               | send 同事务写 Event + Oban；已有 claim/lease/retry、command/workflow identity                | CMS 传播继续复用；ReviewBot 直接用 Oban，不复制 Outbox 执行引擎             |
| `cms/interactions/reactions/report.ex`                        | 内容举报经 receipt_pipeline、嵌入 AbuseReport、Projection；确有 threshold -> fold_for_report | 删除旧写入与阈值折叠；AlertBoard 从零建立举报事实，不回填旧 Report          |
| `cms/abuse_reports/report.ex`                                 | 账号举报另走嵌入列表及账号 meta                                                              | 统一为 AlertBoard 举报事实；账号举报不等于授权账号处罚                      |
| `cms/gate_action.ex`                                          | 由 contracts 生成；现有 :moderate 映射 article.trash                                         | 修改契约来源、生成 action，不手改生成文件，不复用 trash grant               |
| `backend/api/lib/helper/permission_registry.ex`               | 支持 global grant、community root/context grant                                              | 复用权限注册机制，新增明确的 review grant；不建立全局 CMS Gate              |

源码事实修正：此前只核对 `abuse_reports/report.ex` 不足以判断评论是否按举报数折叠。
真实调用在 `interactions/reactions/report.ex` 的 add_report -> maybe_fold_comment -> fold_for_report，必须一起删除。

## 2. V1 范围与不变量

V1 完成 Article（Post/Blog/Changelog）、Comment、平台 Doc 检查、内容/账号举报、管理员事项处理。
账号举报可受理、驳回、记录已人工处理；不提供封号、禁言或自动账号处罚动作。该范围是明确的产品边界，
不是留空接口；GraphQL、Policy、adapter 均不得返回这些处罚动作。需要处理被举报用户的具体内容时，创建独立内容事项。

每次普通 Article/Comment 提交后只有一个当前内容；审核不引入公开旧版或待审历史列表。
平台与社区限制可并存；一项批准只解除明确列出的限制。AI 不解除人工限制，社区不解除平台限制。
审核不会把 published 变成 deleted，也不会恢复 archived/deleted/destroy。

旧 Audit 与旧 Report 运行时及旧存储 D1–D5 先完成；AlertBoard/ReviewBot 新实现 N1–N8 随后实施。不存在旧状态翻译、历史举报回填、双写、fallback、旧接口转发。
已有内容按 N8 的新规则重新检查；旧 Report 记录直接删除，不导入新 reports，也不影响新系统对后续举报的处理。

## 3. 标识、数据类型与数据库约束

新 Context 使用 PostgreSQL schema `alert_board`、`review_bot`；CMS 限制留在 `cms`。
新行主键统一 UUID；引用现有 Article 为 UUID，User/Community/Comment/DocBranch 为其现有整数 ID。
所有时间 Ecto `:utc_datetime`、DDL `:timestamptz`，默认 `timestamps()`；使用 UTC。
下表未标 `?` 的字段 NOT NULL；每表含 id、inserted_at、updated_at，追加事实不修改业务字段。
枚举使用字符串列 + CHECK，Ecto.Enum 映射；禁止借用旧 moderation enum。

### 3.1 AlertBoard 表

| 表               | 字段                                                                                                                                                                                                                                                  | 约束与索引                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review_configs` | scope_key text；community_id? FK；subject_kind article/comment/doc；version bigint；publish_mode；edit_mode；background_check bool；ruleset_id? UUID FK                                                                                               | UNIQUE(scope_key,subject_kind)；platform 的 community_id 为 NULL，community:<id> 必须对应 FK；version > 0                                              |
| `rule_sets`      | scope_key；version bigint；rules jsonb；prompt text；provider_profile text；required_modalities text[]；created_by_id FK；operation_ref UUID                                                                                                          | UNIQUE(scope_key,version)；内容不可变；配置通过 ruleset_id 选择版本；数组只接受 text/image                                                             |
| `cases`          | target_key；article_id? FK；comment_id? FK；user_id? FK；branch_id? FK；scope_key；content_token；status open/resolved/superseded；priority normal/high；resolution?；version bigint；opened_at；resolved_at?                                         | target 三选一；Doc 是 article + branch；UNIQUE(target_key,scope_key,content_token) WHERE status='open'；索引(scope_key,status,priority,inserted_at,id) |
| `reports`        | target_key；article_id? FK；comment_id? FK；user_id? FK；branch_id? FK；scope_key；content_token；reporter_id FK；case_id FK；reason_code；details text；withdrawn_at?；operation_ref UUID                                                            | target 三选一；UNIQUE(target_key,scope_key,reporter_id) WHERE withdrawn_at IS NULL；索引(case_id,withdrawn_at)、(reporter_id,inserted_at,id)           |
| `decisions`      | case_id? FK；target_key；scope_key；content_token；action；source human/policy；actor_id? FK；check_id? UUID FK；restriction_ids bigint[]（CMS restriction 行 integer ID）；reason_code；note text；operation_ref UUID；expected_case_version? bigint | human 必须 actor_id；policy 必须 check_id；UNIQUE(operation_ref)；不可变；只在资源变更成功的同事务插入                                                 |

`target_key` 由服务端构造，客户端不能自填：`article:<uuid>`、`comment:<id>`、`doc:<uuid>:<branch>`、`user:<id>`。
`scope_key` 是 `platform` 或 `community:<id>`；从已授权社区构造，不接受字符串拼装绕过授权。
CHECK + changeset 校验 target_key 与实体列对应；所有关联 FK 均 RESTRICT，销毁流程先删除短期 payload、
按现有资源保留策略保留 tombstone；不级联抹除报告与决定。无正文、无举报人详情的历史决定保留 365 天，
365 天后定时脱敏 note/details；报告正文 90 天后清空 details，保留原因、身份引用和撤销事实。

rules JSON 的固定结构：`{"items":[{id, kind: word|judge, value, category, action}]}`；word 只允许 `restrict`，judge 允许 `restrict|review`。精确词条命中不是不确定信号，不接受 `word + review` 组合。
word.value 是 NFKC + Unicode casefold 后的非空字面串，不支持正则；只匹配规范化标题/可见文本，忽略富文本 markup。
词条最多 10,000 条、单条 128 字符；Prompt 最多 8,000 字符；reason_code 必须取配置的 category，不接受模型任意动作。
平台词库和社区词库分别执行、分别产生决定。明确词库命中必须 restrict，不能配置成仅提示。

### 3.2 ReviewBot 表

| 表         | 字段                                                                                                                                                                                                                                                                                                                                                                                        | 约束与索引                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `checks`   | target_key；scope_key；content_token；ruleset_id FK；config_version bigint；effective mode immediate/ai_first/human_first；generation int；trigger submit/edit/report/manual；state queued/running/completed/failed/superseded；result? pass/restrict/review；coverage jsonb；signals jsonb；payload jsonb?；payload_expires_at；active_attempt int；human_epoch bigint；operation_ref UUID | UNIQUE(target_key,scope_key,content_token,ruleset_id,config_version,generation)；索引(state,inserted_at)、(payload_expires_at) |
| `attempts` | check_id FK；number int；state running/succeeded/retryable_error/terminal_error/abandoned；started_at；finished_at?；provider_profile；request_id UUID；error_code? text；latency_ms? int                                                                                                                                                                                                   | UNIQUE(check_id,number)、UNIQUE(request_id)；不存 token、原始响应或完整请求                                                    |

Check 是业务检查记录；Attempt 是有限调用记录，不拥有资源可见性。
ReviewBot.Check 使用 UUID 主键，使 Decision/Restriction 能跨 schema 建立真实 FK；Attempt.check_id 同类型。
规则集 JSON 固定为 `{"items":[{id, kind: word|judge, value, category, action}]}`；word 只允许 `restrict`，judge 允许 `restrict|review`。配置校验拒绝 `word + review`，避免确定命中只创建 Case 而不施加限制。
纯词库执行在提交事务内创建 completed Check（generation 1、active_attempt 0），逐条保存仅含 rule ID/category/action/verdict 的 pass/hit signals，Policy 决定引用该 Check，
不创建 provider Attempt/Oban Job；有模型规则时另登记 queued Check，generation 区分确定性与完整执行。
确定性 Check 不能作为 AI 初审完整通过依据；模型执行仍包含同版本词库结果，必须覆盖全部 requiredModalities/规则。Oban 负责执行、重试、进程崩溃恢复；
不在 ReviewBot 新建通用 lease/队列系统。人工 Retry 创建 generation+1，deterministic Check 的 operation_ref 也包含 generation，避免同一快照重检冲突。
提交快照使用 canonical 文本 + 资产 ID/不可变对象版本（不持久化 signedReadUrl，调用前生成）；禁止任务执行时从当前正文重新构造旧快照。
payload 最多保留 24 小时，终态后即清空；signals 只保留规则 ID、category、action、verdict 与 coverage，不保留命中文本片段；
queued Check 在创建 Attempt 前校验 `payload_expires_at`；缺失或已过期则不调用 provider，在资源事务中清空 payload、置 failed/review，并按终态 provider 失败策略转人工；
Attempt 30 天清理，Check 元数据 90 天清理（被 Decision 引用的保留无 payload 墓碑）。
超过 24 小时未完成直接 failed/转人工，不能无输入默认为通过。

### 3.3 CMS 有效限制与并发标识

新增三张同结构资源表：`article_review_restrictions`、`comment_review_restrictions`、`doc_review_restrictions`。
分别 FK 指向 article_lifecycles、comment_lifecycles、doc_lifecycles；Doc 的 branch 随 Lifecycle，不另存第二份 branch。
共同字段：`lifecycle_id, scope_key, cause_key, kind, content_token, source, case_id?, check_id?,
created_by_operation_ref, applied_at, ended_at?, ended_by_operation_ref?, end_reason?, version`。

- kind：`awaiting_ai / awaiting_human / rule_hit / manual_hold`；source：`submission / policy / human`。
- cause_key：提交为 `submission:<content_token>:<mode>`，词规则为 `rule:<rule_id>`，人工为 `decision:<uuid>`。
- UNIQUE(lifecycle_id,scope_key,cause_key) WHERE ended_at IS NULL；索引(lifecycle_id,scope_key) WHERE ended_at IS NULL。
- ended_at 与 ended_by_operation_ref、end_reason 必须同时为空或同时有值；结束后不可重新启用。
- Community 范围 Article 限制必须存在对应 binding；移除 binding 时结束该社区限制，重新绑定按首次提交规则处理。
- Doc 限制 V1 仅 platform；评论社区范围只能等于 comment.community_id。
- Lifecycle 模块拥有 apply/end/recompute；Persist 只操作行，AlertBoard 不直接 update 限制表。

三类 Lifecycle 新增 `review_content_token text?` 和 `review_epoch bigint default 0`。
首次提交设置 token，草稿可为空。token = `sha256(canonical title/body + immutable asset versions + submitted revision/body identity)`；
Article/Doc 使用已有 revision ID；Comment 使用当前 body identity 与 expected_version 保护的写入结果，不新增历史表。
部署新审核链路时，新增 Lifecycle 字段的迁移先为所有已有 Article、Comment、Doc Lifecycle 写入稳定的 `legacy:<kind>:<resource-id>` 基线 token，epoch 保持 0；这让存量内容在首次编辑前也可举报并可按当前配置重检。此合成 token 只标识迁移时已有快照，下一次真实内容提交会替换为 canonical token。
每次内容提交、人工决定和使旧检查失效的配置切换递增 epoch；Check 捕获当前 epoch。
同事务纯自动结果应用不递增 epoch，防止平台检查误使社区检查失效。
Article 编辑要为全部现有 binding 分别固定社区配置并登记 Check；锁定 binding 按 community_id 升序，
不能只检查当前编辑页面的社区。新增 binding 按该社区首次发布模式登记等待项，已有 binding 不重置。
每个范围还必须比较最新 generation、ruleset_id 与 config_version，不能只检查 hash。

人工决定将其他在途 Check 标为 superseded，按仍需检查的范围重新登记；已手动批准的范围不重复初审同一内容，
平台不能被社区批准豁免。epoch 是技术并发令牌，不是产品内容版本。

## 4. 配置与状态转换

### 4.1 固定默认值

| 配置                              | 默认 / 有效值                                                               |
| --------------------------------- | --------------------------------------------------------------------------- |
| 社区 article/comment publish_mode | immediate；可选 ai_first / human_first                                      |
| 社区 edit_mode                    | immediate；可选 ai_first                                                    |
| 社区 background_check             | false；词库一经配置始终执行，开关只控制模型检查                             |
| 平台 article/comment publish_mode | immediate；平台词库始终执行；平台模型检查按平台配置启用                     |
| 平台 doc                          | immediate + 平台后台检查；社区不得配置 Doc；命中后限制对应 branch           |
| 平台与社区叠加                    | 分别生成限制，任一有效限制即普通不可见；不采用“更宽松模式覆盖”              |
| 无规则/无 AI profile              | immediate 可运行；ai_first 返回 invalid_review_config；human_first 无需模型 |

平台必须配置其规则后才宣称启用平台检测；未配置不是“检查通过”。不提供旧百度 token 回退。
确定性词匹配在提交事务内使用预加载的不可变规则，命中同事务施加 rule_hit；模型调用在提交后。
平台 Doc V1 固定发布后检测，用户需求没有要求 Doc 先审后发；不增加待审 Doc release 流程。

配置更新需要 expectedVersion；新配置只作用于后续提交、人工 Retry 和明确的 Recheck 操作。
既有 Check 继续使用已固定的规则版本，既有人工待审和限制不自动解除。更新返回受影响对象数量但不批量回写内容。
`recheckReviewTarget` 显式采用目标 scope 的最新配置、递增该 scope 的 Check generation、使同一 scope 的旧 Check 失效并登记新任务；它不递增 Article/Comment Lifecycle 的共享 `review_epoch`，因此不会让其他 scope 的在途 Check 失效或遗留等待限制。无全站隐式重扫。

### 4.2 行为矩阵

| 事件                     | 限制处理                                                                                          | 事项处理                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| immediate 首发/编辑      | 无等待限制；词命中新增 rule_hit；模型按配置登记                                                   | 无命中不建 Case                                                  |
| ai_first 首发/编辑       | 新增 awaiting_ai；即刻普通不可见                                                                  | 检测期间由作者 DTO 展示，不单独建 Case                           |
| human_first 首发         | 新增 awaiting_human；AI 通过不解除                                                                | 立即创建 open Case                                               |
| AI pass 且 coverage 完整 | 结束同范围当前内容 awaiting_ai；允许结束同规则的 policy rule_hit                                  | 无剩余人工/规则问题且无 active report 时 resolve                 |
| AI restrict              | 结束 awaiting_ai，新增对应 rule_hit；不能覆盖其他 scope                                           | 创建/关联 open Case                                              |
| AI review / 图片未覆盖   | ai_first 的 awaiting_ai 转 awaiting_human；immediate 不因不确定而隐藏                             | 创建 open Case                                                   |
| AI 超时重试耗尽          | ai_first 转 awaiting_human；immediate 不新增限制                                                  | 创建 open Case，reason check_unavailable                         |
| 人工 approve             | 必须列出 restrictionIds；结束当前范围 awaiting_ai/awaiting_human/rule_hit；manual_hold 需 release | 写 Decision，满足处理条件时 resolved                             |
| 人工 restrict            | 结束该范围等待限制并新增 manual_hold                                                              | 写 Decision，Case 保持 open，后续可在同 Case release             |
| 人工 release             | 只结束指定 manual_hold/rule_hit；仍有其他限制则保持隐藏                                           | 写 Decision；不是自动批准所有待审                                |
| 编辑已有人工待审         | 旧内容等待项结束为 superseded；当前内容重建 awaiting_human                                        | 旧 Case superseded，新 Case open                                 |
| 编辑已有 policy rule_hit | 限制保持至同规则对新内容完整 pass；无对应规则时转人工，不自动释放                                 | 旧 Case superseded，新 Case open                                 |
| 编辑已有 manual_hold     | 保持隐藏，不因新 AI pass 解除                                                                     | 旧 Case superseded；新快照建立 open Case，人工重新查看后 release |
| 删除/销毁                | Check superseded；限制留作历史或随领域销毁终止；不得恢复资源                                      | Case superseded                                                  |

普通 Article 的正文修订由所有 ArticleBinding 共享。发布和编辑在同一资源事务内读取全部当前 Binding，加载平台及每个社区的 Article 配置，并对每个 scope 独立登记检查与限制；平台限制影响所有 Binding，社区限制只影响自己的 Binding。镜像在目标 Binding 创建事务内，用现有 Public 修订和目标社区的 `publish_mode` 登记新 scope，不推进正文 token/epoch；迁移在同一事务结束源社区 scope 的限制、supersede 其 queued/running Check，再按目标社区首次发布策略登记目标 scope。失败时 Binding 与审核事实一起回滚。`binding` 是 Check 的独立触发类型；同一 token 再次绑定时继续递增该 scope 的 generation，避免检查身份冲突。

Check：queued -> running -> completed；可重试错误回 queued；耗尽 -> failed；任一非终态可 -> superseded。
Attempt：running -> succeeded/retryable_error/terminal_error/abandoned。Oban 后续 attempt 大于 Check.active_attempt 时，在资源锁下将遗留 Attempt 置 abandoned 并重新 claim；若最终 worker 仍未恢复，`ReviewBotCheckRecovery` 每分钟检查超过 240 秒的 running Attempt，同事务将 Check 置 failed、结束 awaiting_ai 并转入人工 Case。过期 token 只会 supersede，不得影响新版本。
Case：open -> resolved 或 superseded；终态不重开，新举报/新检测产生新 open Case；旧已处理记录可查。
新举报即使内容未变，也可创建新 Case；数据库唯一约束仅限制一个 open Case。

## 5. 权限与读取合同

新增 action 的契约来源为 `packages/contracts` 的 gate.contract.json，沿用生成 GateAction/前端常量和 Passport 校验。
社区 action 使用 context grant；平台 action 使用 global grant。全局 god 仍按已有 Registry 行为处理，
但自批禁止作为业务条件，即使 god 也不能批准自己的 UGC。

| Action / grant                      | Actor                   | 边界                                                                           |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `review.read`                       | 社区 root 或显式 grant  | 本社区 Case 与受限内容；不能读取平台内部证据                                   |
| `review.decide`                     | 社区 root 或显式 grant  | 本社区 approve/restrict/release/dismiss；不可自批                              |
| `review.configure`                  | 社区 root 或显式 grant  | 本社区配置、词库、Prompt                                                       |
| `review.platform.read`              | global grant/god        | 平台事项、证据、平台限制内容                                                   |
| `review.platform.decide`            | global grant/god        | 平台决定，仍受业务并发/自批条件限制                                            |
| `review.platform.configure`         | global grant/god        | 平台配置与 provider profile 选择；密钥不在 UI                                  |
| `report.submit` / `report.withdraw` | 已登录用户              | submit 需当前可读目标、禁止举报自己；withdraw 只校验本人事实，不要求目标仍公开 |
| worker `apply_review_result`        | 内部 ReviewBot 执行身份 | 必须加载 check/attempt 并校验 Policy；不能由 GraphQL 传 :operations 获得权限   |

Board 自有 Authorization 只使用已加载身份、范围与 Passport facts；读取 Case 时先限制 scope 再分页。
CMS 正式动作新增 `:review_approve/:review_restrict/:review_release/:apply_review_result`，由 CMS Gate 检查对应 grant，
随后资源 Lifecycle 校验并发与状态。检查结果不是“拥有管理员权限的用户”，必须走专用内部入口。
User 举报的读取/受理权限由 AlertBoard Authorization + Accounts 当前身份读取负责，不调用 CMS Gate 授权账号修改。

Gate Scope 的新 SQL 条件是：父资源/社区可读 AND 基础 Lifecycle 可读 AND
（无有效范围限制 OR 当前 actor 是作者 OR actor 有覆盖全部命中范围的 review.read）。
作者豁免只针对自己的审核限制，不能穿透私有社区、父资源不可读或删除正文；deleted Comment 仍是原有 tombstone。
社区审核员可以看社区限制内容，但仅有社区权限不能穿透平台限制。平台证据不会出现在普通社区页面。

列表、详情、批量和 count 使用同一 NOT EXISTS 限制谓词；不逐行查询 Check/Case，不调用 provider。
审核列表是有权限的 Scope 模式，不是 policy_mode 字符串旁路。typed Article/Comment/Doc Context 保留。
平台搜索只收无平台限制且至少一个可公开 binding 的 Article；社区搜索同时考虑对应 binding 限制。
普通 Article 的 ArticlePublic 与 ArticleBinding 不存 `visible` 列。Gate 在同一 SQL scope 中读取 ArticleLifecycle 与 ArticleReviewRestriction，按 platform/community scope 判断可见性；查询、搜索、计数和副作用使用同一 Gate scope，不从缓存或 Binding 推断审核状态。DocPublic 仍有 branch-scoped `visible` 发布投影，并由 DocLifecycle/DocReviewRestriction 更新。

## 6. 事务、锁序与副作用

### 6.1 提交 / 编辑

继续使用原资源 receipt_pipeline（commandId 必填），runner 为唯一事务 owner。

1. Gate 在事务内加载、锁定 canonical resource；评论复用父 Article aggregate 锁。
2. 校验 expected_version、Lifecycle、binding/branch；加载平台与社区不可变配置快照。
3. 写当前内容，更新 review_content_token/epoch；结束旧等待项、使旧 Check superseded。
4. Lifecycle 应用当前模式等待项、确定性词命中、保留已有人工/自动限制。
5. `ReviewBot.register_in_transaction` 插入 Check + Oban Job；任一失败使整笔提交回滚。
6. AlertBoard 同事务创建必要 Case 与决定记录；Article/Comment 可见性由提交后的 Lifecycle/Restriction 事实直接供 Gate 查询，Doc 只刷新对应 branch 的 DocPublic 投影。
7. 通过既有 CMS.Outbox 同事务登记 visibility/content 事件；Receipt confirmation；commit。
8. 异步检查、搜索/缓存/通知消费；提交响应返回当前内容和 review DTO，不等待 AI。

不新增独立发布入口；Article publish effect 中直接 audition emit 删除。mentions 的解析/关系登记可保留，
对外通知必须走公开 eligibility。

Mention 有三个不同职责，不能让 AlertBoard 重建或复用成另一个投递系统：

- `CMS.ArtimentMentions` / `cms.artiment_mentions` 是内容引用关系事实；`sync_mentions` 负责重算，不负责通知。
- `Messaging.Model.Mention` / `Messaging.Commands.SendMention` 是收件箱提及事实与 unread projection。
- `CMS.Outbox` 是 CMS 状态提交后的可靠副作用唤醒；`Messaging.Notifications.Delivery` 是通知去重 claim，二者都不是 Mention 事实 owner。

`Messaging.Notifications.Delivery` 只关联 `messaging.notifications`，不能作为 `messaging.mentions` 的幂等机制，也不决定内容是否可见。Mention inbox 由 `Messaging.Commands.SendMention` 写入；N6 必须为该链路单独实现“首次变为公开后投递”的幂等和读状态保留规则，不能在每次重放 `review_changed` 时无条件替换已读 Mention。一次提及只创建 Mention inbox 项，不再为同一提及 recipient 额外创建一条 Notification；评论/回复活动通知是独立事件，仍走 `SendNotification` 与 `Notifications.Delivery`，并按各自事件 key 去重。

Article 的 `Articles.Effects.Publish` 当前同步 emit `:sync_mentions`；Comment 的 Outbox workflow 在 create/reply/update 后 enqueue `sync_mentions`。
代码落点分别是 `cms/articles/effects/publish.ex`、`cms/outbox/workflow/comment.ex` 和 `cms/events/sync_mentions.ex`；该 handler 只调用 `CMS.ArtimentMentions.sync/1`，维护正文提及关系，不写 `Messaging.Model.Mention`。内容发布链路现在由 `CMS.Review.Effects` 在确认当前内容公开后，调用 `Messaging.send_mention` 写收件箱 Mention；Comment 的 `notify_comment/notify_reply` 则另写活动 Notification。因此关系同步和 inbox delivery 是两个步骤，不能删掉 `sync_mentions`，也不能让旧 publish/comment worker 再投递同一 Mention。
N6 必须把 hidden content 的 Mention Query 纳入 Gate：`mentions` 先校验 mentioner 对当前 actor 可读，`mentioned_by` 在 SQL 中排除当前不可读的 mentioner；
否则关系存在、快照或 count 会泄漏待审正文结构。关系事实可以按提交同步，但受限期间不对普通 actor 返回。

`CMS.ArtimentMentions.sync` 可以在提交后重算关系事实，但 N6 的 `mentions` / `mentioned_by` 读取必须先按 Gate Scope 排除当前不可读的 mentioner。收件箱 `Messaging.Model.Mention` 和正文通知则只能在内容满足公开 eligibility 后产生；ai_first/human_first 等待期间不投递，旧的 `Messaging.send_mention` 写入口也必须受同一 eligibility 检查约束。

Article/Comment 首次满足公开 eligibility 时，由单一 `review_changed` 幂等消费者重新加载 canonical 内容，先幂等运行 `CMS.ArtimentMentions.sync/1` 再读取收件人，最后写入收件箱 Mention。Article 的 publish emit 与 Comment 的 `sync_mentions` job 和 `review_changed` 消费是独立调度，不能假定顺序，也不能读取可能滞后的关系事实。相同 target + scope + epoch 的事件重放不重复写入、不重置已读状态。只有另有明确定义的活动通知时才调用 `SendNotification`，使用 `Messaging.Notifications.Delivery` 的 `review:<target_kind>:<target_id>:<event_kind>` key；Comment 的通知接收者由评论类型唯一确定，delivery key 随该目标活动稳定，因此 Outbox 重放和后续编辑不会重复创建同一种评论活动通知。不能为已由 Mention inbox 表达的同一提及再发重复 Notification。Mention 使用其自身以 target + content token + recipient 为身份的去重规则，不复用 Notification Delivery 表。新 token 的编辑可产生新一轮 Mention；活动通知则按其事件语义独立决定是否重发。

Mention 写入基础已实施：`Messaging.Commands.SendMention` 先对匿名公共 actor 执行 `CMS.Gate.scope/4`，不可公开读取时返回 `:content_not_public`；Mention 行以 target + content token + recipient 唯一，重放使用 `ON CONFLICT DO NOTHING`，因此保留原 read 状态。Article token 优先使用当前 review token、否则用 `ArticlePublic.revision_id`；Comment 优先使用 review token、否则用 `CommentBody.body_hash`。新 migration 增加 `target_key/content_token` 与唯一索引，不回填旧投递记录。

N6 剩余闭环：`review_changed` consumer 到 SendMention 的生产接线已实现，但整批 N6 仍待验收。Notification 仍走 `Messaging.Notifications.Delivery`，不能用它给 Mention 去重。验收覆盖受限拒绝、公开后写入、Outbox 重放、相同 token 重放不重置已读状态，以及新 token 编辑产生新投递；另需覆盖通知失败后的 Outbox 重试和资源删除后的过期事件。

Doc restriction 只重算命中的 branch `DocPublic.visible`，并 enqueue `article.visibility_changed` 清理该 community 的 Doc 页面与列表 cache。Doc 的 main/preview BranchVersion 与 DocPublic 是独立发布合同，不作为普通 Article/Comment 的 Mention inbox 投递入口。

Comment embedded replies 不能复制受限正文给公开父评论：同步时写安全引用，读取/组装时沿同一批量 Gate scope 过滤；禁止仅遮挡 Comment 主列表。

### 6.2 Worker

Oban worker `GroupherServer.Jobs.ReviewBotCheck`，queue `review_bot`，并发 5，max_attempts 3；
每次 provider 调用总预算 30 秒，连接预算 5 秒；重试间隔 10 秒、60 秒；429/5xx/timeout 可重试，
认证/协议错误终止并转人工。禁用 adapter 内重试，防止与 Oban 叠加。worker 的超时总预算 45 秒。

短事务把 Check queued -> running、增加 active_attempt、插入 Attempt；commit 后调用 provider。后续 Oban attempt 可以接管仍为 running 的上次 Attempt；每分钟运行的 `GroupherServer.Jobs.ReviewBotCheckRecovery` 兜底处理超过 240 秒的孤儿 Attempt，将不确定结果交给人工审核。
返回后进入资源领域 ApplyReviewDecision 的 direct_pipeline，锁资源并重读 Check；锁序统一为：
父 Article（若有）-> 目标资源/Lifecycle -> Check -> Case -> 限制行（ID 升序）。
所有人工与 worker 路径沿相同锁序；禁止先锁 Case 再调资源 Command。

有效性要求 token、epoch、active_attempt、generation 和固定配置版本全匹配（与 Check 登记快照比较，不与后来更新的配置头比较）；基础状态仍允许处理。
失效结果仅标记 superseded，不写限制、不发公开效果。有效结果归一化后由纯 Policy 产生决定。
同一事务更新 Check/Attempt、Case、Decision、Lifecycle 限制、投影、Outbox；失败整体回滚，Oban 重试。
外部调用可能至少一次，资源决定恰好一次：operation_ref 由 check_id + attempt number 确定生成 UUID，
Decision UNIQUE(operation_ref) 防重复，重复消费返回既有结果，不重复解除或通知。

### 6.3 人工决定

GraphQL -> AlertBoard.decide -> 对应资源 Commands.ApplyReviewDecision（receipt_pipeline）。
Case 预读只用于解析 target，不授权、不锁；正式事务按上述顺序重新读事实。
检查 expectedContentToken、expectedCaseVersion、restrictionIds 所属范围、actor 不等于作者、最新权限。
Decision、资源变化、Case version +1、Activity 与 Outbox 全部同事务。approve、restrict、release 先在当前资源锁下 supersede 同 scope 所有 queued/running Check；不增加资源级全局 epoch，避免一个社区的人工决定使其他绑定社区检查失效。restrict 同事务结束本 Case 对应 token 的 awaiting_ai/awaiting_human 限制并新增 manual_hold；Case 保持 open，让后续 reviewer 可在同 Case 显式 release 该人工限制。
无嵌套的第二个 receipt；AlertBoard facade 不提前写“决定成功”。失败时没有已批准记录。
响应 confirmation 使用 decision_id/case_id/command_id，重放同 commandId 不重复执行。

### 6.4 公开传播

旧 Moderation 的搜索删除、用户缓存、标签统计、Press invalidation 不能随模块删除而丢失。
新 `article.review_changed` / `comment.review_changed` 经现有 Outbox workflow 投递，effect_key 含 target + scope + epoch。
消费者读取最新 token/有效可见性；过期 publish event 不可重新推送隐藏正文。
隐藏事件删除索引并失效社区/公共缓存；公开事件才生成通知、Feed、搜索文档；多次批准不重复首发通知。
通知投递使用 `Messaging.Notifications.Delivery` 的 `delivery_key`，评论活动 key 固定为 `review:<target_kind>:<target_id>:<event_kind>`；
该 key 与 Mention 的版本身份分开，不用来去重 `messaging.mentions`。隐藏前已发的外部通知无法撤回，
immediate 模式不承诺异步检测前零曝光。新公开 read 必须在缓存返回正文前检查当前 Scope，禁止仅依赖异步失效保证权限。
媒体若已有永久公开 URL，事后隐藏不能收回外部副本；ai_first/human_first 未公开内容必须使用已有 Assets 授权访问路径，
未具备私有访问能力的 provider 配置不得用于这两种模式。严格模式的图片发布是 N6 必测上线条件。

## 7. Provider adapter 合同

ReviewBot 编排在 Phoenix；模型与判断引擎通过统一 HTTP adapter，不引入 provider 对资源的回调写入。
Jev 采用 `judge_http` profile：接收下面的固定 judge wire 合同；Jev 服务实现适配层，不假设它原生支持 OpenAI 协议。
OpenAI 使用独立 adapter 将同一输入转换为该 provider 请求；两者均只返回信号。具体 SDK 不进入领域合同。

```text
CheckInput {
  requestId, checkId, contentToken,
  rules: [{id, kind, value, category, action}], prompt,
  text: {title, body}, images: [{assetId, immutableVersion, signedReadUrl}],
  requiredModalities: [text, image]
}
CheckOutput {
  requestId, contentToken,
  coverage: {text: complete|unsupported|failed, image: complete|unsupported|failed},
  findings: [{ruleId, verdict: pass|hit|uncertain}],
  providerRequestId
}
```

judge_http：`POST /v1/judge`，JSON，Bearer service credential，HTTPS；返回 200 + 严格 schema。
请求体最多 2 MiB，图片最多 10 张、单张 10 MiB；超出上限标 coverage failed/转人工，禁止静默截断后 pass。
Jev 后端不需要直接访问应用数据库。signedReadUrl 有效期 120 秒、仅指定对象只读；超时重试重新签名同一 immutableVersion。
远程图片先通过已有 Assets 接入生成不可变版本；无法固定字节的外链标 unsupported，不允许完整 pass。
Policy 按 restrict > review > pass 聚合：任一明确 hit 可先限制，即使其他 modality 未覆盖；
没有明确 hit 但有 uncertain/缺覆盖则 review；只有全部必需 ruleId 都有结果且 coverage 完整才能 pass。
被关闭的模型规则不执行，也不能因此解除该模型之前产生的 rule_hit；必须用新检查或人工解除。
缺项、额外动作字段、错 token、错误枚举视为 protocol_error。
文字命中优先 restrict；模型 hit 按对应规则 action；uncertain 转 review；不使用跨模型通用分数阈值。

新增运行时配置 `:review_bot`：profiles map（adapter, base_url, model, credential_env, modalities），由 `ReviewBot.Config.profiles_from_env/1` 构造。`REVIEW_BOT_JUDGE_URL` 与 `REVIEW_BOT_JUDGE_TOKEN` 同时存在时注册 `judge_http` profile（可选 `REVIEW_BOT_JUDGE_MODEL`）；`REVIEW_BOT_OPENAI_TOKEN` 存在时注册 `openai` profile（endpoint 固定为 Responses API，可选 `REVIEW_BOT_OPENAI_MODEL`，默认 `gpt-5-mini`）。未配置凭据的 provider 不注册 profile，因此社区配置会被拒绝；不会从社区输入创建 endpoint 或读取任意环境变量。
只允许运维定义 URL/凭据，社区只能选择平台批准的 profile；不能填写任意 HTTP 地址。
不保存 token/URL 到 RuleSet，只存 profile ID。日志只记录 requestId、profile、耗时、错误码。
启动校验所选 profile 必需配置；能力 contract tests 验证文本/图文 fixture，未通过不能启用 ai_first。
本合同不声称 Jev 当前版本的性能或多模态能力已验证，验收使用实际部署 adapter 的可重复测试。

## 8. 领域接口与 GraphQL

业务函数统一 `{:ok, value} | {:error, structured_error}`，不向 transport 泄漏 Ecto changeset/provider body。
新增 public facade（签名中的 target/scope 均为已校验 typed value）：

```elixir
AlertBoard.update_config(scope, attrs, expected_version, actor, command_id)
AlertBoard.submit_report(target, reason, details, actor, command_id)
AlertBoard.withdraw_report(report_id, actor, command_id)
AlertBoard.decide(case_id, attrs, actor, command_id)
AlertBoard.recheck(target, scope, actor, command_id)
AlertBoard.list_cases(scope, filter, pagi, actor)
AlertBoard.get_case(case_id, actor)
ReviewBot.register_in_transaction(target, content, config_snapshot, operation_ref)
ReviewBot.execute_check(check_id)
CMS.Articles.apply_review_decision(target, decision_input, actor, command_id)
CMS.Comments.apply_review_decision(target, decision_input, actor, command_id)
CMS.Docs.apply_review_decision(target, decision_input, actor, command_id)
```

register_in_transaction 必须验证 Repo.in_transaction?；无事务调用返回错误。它只登记任务，不查资源或做授权。
资源 apply facade 委托新增 Commands.ApplyReviewDecision；内部 worker 使用明确的 execute_result 入口，不伪造 commandId。
AlertBoard 的配置/报告/账号事项采用通用 CommandPipeline + 新 AlertBoard adapter，复用执行引擎，不复制 CMS Gate。
其 adapter 提供 Board Authorization；内容资源变更仍调用 CMS adapter 的领域 Command，不能跨 Context 直写。

### 8.1 GraphQL 字段

| Query / Mutation      | 必填输入                                                                                               | 返回                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `reviewConfig`        | scope: ReviewScopeInput，subjectKind                                                                   | ReviewConfig（仅配置权限可见）                                           |
| `reviewCases`         | scope，filter，分页参数沿现有 Pagi                                                                     | ReviewCasePage：entries/pageInfo；默认 open，createdAt desc + id desc    |
| `reviewCase`          | id                                                                                                     | ReviewCaseDetail，含授权后的证据/决定                                    |
| `updateReviewConfig`  | scope, subjectKind, expectedVersion, config, commandId                                                 | ReviewConfigResult                                                       |
| `submitReport`        | target, reasonCode, details, commandId                                                                 | ReportResult：reportId, viewerHasReported, commandId                     |
| `withdrawReport`      | reportId, commandId                                                                                    | ReportResult；重复撤销成功，撤销他人报告拒绝                             |
| `decideReviewCase`    | caseId, expectedCaseVersion, expectedContentToken, action, restrictionIds, reasonCode, note, commandId | ReviewDecisionResult：decisionId, caseId, caseVersion, review, commandId |
| `recheckReviewTarget` | target, scope, commandId                                                                               | ReviewCheckResult：checkIds, review, commandId                           |

ReviewScopeInput：kind PLATFORM/COMMUNITY；COMMUNITY 必须 communityId，PLATFORM 禁止 communityId。
ReviewTargetInput：kind ARTICLE/COMMENT/DOC/USER；id 为现有公开 locator（不暴露 Comment 数据库 ID），由 FrontDesk/Accounts 解析为 canonical target；DOC 必须 branchId；ARTICLE 必须 communityId；
COMMENT 的 community 从 canonical comment 取得，客户端不得覆盖；USER 和 DOC 举报仅 platform，DOC 管理仍按 branch。
USER 的 content_token 固定为 user:<id>（账号举报不批准内容），不会因头像/昵称变化使举报失效。报告详情最长 2,000 字符，note 同限。
filter 固定 status、kind、priority；不接受任意 JSON 查询。分页输入为 Pagi offset {page,size} 或 cursor {first,after}，
大小默认 20、最大 100，两种位置不能混用；使用 Pagi.from_input 与现有签名游标验证，排序固定 inserted_at DESC,id DESC。

`ReviewConfig` 包含 version、publishMode、editMode、backgroundCheck、rulesetId、规则/Prompt、profileId、requiredModalities。
`ReviewConfigResult` = {config, commandId}；ReviewCheckResult 中 checkIds 是本次登记的检查 UUID 列表。
reasonCode 举报枚举固定 SPAM/HARASSMENT/ILLEGAL_CONTENT/IMPERSONATION/OTHER；OTHER 要求非空 details。
`ReviewCaseDetail` 包含 id、target 引用、scope、contentToken、status、version、priority、safeSummary、
activeRestrictions、signals、reports、decisions、allowedActions。reports 身份仅相应 scope 的 review.read 可见，不公开。
allowedActions 与写入验证使用相同的限制条件：APPROVE 要求当前 contentToken 下至少一个非 manual_hold 限制；RELEASE 要求至少一个 manual_hold 或 policy rule_hit；DISMISS 在存在 awaiting_ai/awaiting_human/manual_hold 时隐藏。REPORT-only case 不暴露 APPROVE/RELEASE。
账号 Case action 只有 DISMISS / RECORD_HANDLED；后者要求 note，不修改账号。内容 action 为 APPROVE / RESTRICT / RELEASE / DISMISS。
DISMISS 只驳回报告，不解除限制；有 waiting/manual_hold 时不得用 DISMISS 隐式批准。

Article/Comment 新增 `review: ContentReview!`，Doc 仅在授权的管理响应暴露；普通公共内容只返回 public 状态：
`{status: PUBLIC|CHECKING|WAITING_HUMAN|RESTRICTED, contentToken?, checkUnavailable, canEdit, canRequestReview, reasonCodes[]}`。
优先级 RESTRICTED > WAITING_HUMAN > CHECKING > PUBLIC；status 是当前有效限制投影，不是另一个持久化状态。
contentToken、reasonCodes 仅作者/有权限审核员可见；普通用户不可读取受限内容响应。
canRequestReview 为本范围 review.decide 能力，不授权作者反复触发检查；作者修改内容触发正常流程。
旧 Article.pending、isLegal/illegalReason/illegalWords 及作者违规数组从 schema/query/UI 删除，不返回固定值。

### 8.2 错误合同

新增 ErrorCat namespace `{:alert_board}` 范围 6300..6349、`{:review_bot}` 6350..6399；在全局 workflow 注册并通过 validate!。
已有 Gate/CMS 错误直接传递，不重新包装 permission_denied/resource_not_found。

| code | reason                         | 客户端行为                              |
| ---- | ------------------------------ | --------------------------------------- |
| 6300 | invalid_review_config          | 显示字段问题，不保存                    |
| 6301 | content_changed                | 重新读取当前内容，不自动重发批准        |
| 6302 | case_version_conflict          | 刷新事项                                |
| 6303 | restriction_scope_mismatch     | 拒绝并刷新允许动作                      |
| 6304 | self_review_forbidden          | 隐藏自批动作                            |
| 6305 | report_already_active          | 显示已举报，沿事实恢复 UI               |
| 6306 | unsupported_review_action      | 不降级成别的处罚                        |
| 6307 | review_config_version_conflict | 重载配置                                |
| 6350 | check_registration_failed      | 提交回滚，可用同 commandId 重试         |
| 6351 | provider_unavailable           | 仅管理员诊断；用户得到 checkUnavailable |
| 6352 | provider_protocol_error        | 不当作 pass                             |
| 6353 | check_payload_expired          | 转人工，手工 Recheck 使用当前内容       |

## 9. 前端落点

`frontend/core/unit/Comments/fragments.ts`、`ArticleEditor/schema.ts` 删除旧字段并请求 review；
`Comments/Comment/DesktopView/{DefaultLayout,FoldLayout,IllegalBar}.tsx` 删除旧 IllegalBar，新增 ReviewNotice；
`Actions.tsx`、`Footer.tsx`、`EmotionSelector` 使用现有能力响应与 review，不传 isLegal。
`frontend/core/ui/IllegalWarning` 及 salon 删除；两种 Changelog layout 删除硬编码 isLegal=true。
`frontend/core/spec/article.d.ts` 改为生成的新 DTO 引用；en/zh 删除旧 key，新增四种状态及冲突提示。

新增 `frontend/core/unit/AlertBoard` 作为社区 Dash/平台管理共用视图；列表 -> 详情 -> 明确动作。
UI 分别管理 scope，默认显示 open；详情保存打开时的 token/version，提交使用该值，冲突后必须重新确认。
新增审核配置单元 `ReviewSettings`，分别配置 Article/Comment，AI 模式无合格 profile 时禁用并显示原因。
每个组件单独文件与 salon，复用现有 Pagi、Gate action、commandId/recovery 交互，不创建第二个请求客户端。
所有 mutation 同一用户意图重试复用 commandId，修改输入/重新确认生成新 commandId。

## 10. 公开投影的精确接入点

`articles/public.ex`、`binding_persist.ex` 删除 == legal / != illegal；由 Lifecycle 有效限制计算取代。
`articles/draft/store.ex:812` 的 visible: true 属于 binding 初始化，不是旧枚举转换；创建能力保留，
初始化也必须调用同一有效可见性计算，draft_only 为 false，发布事务再按状态与限制重算。
`revision_projection.ex`、`article_view.ex` 删除 pending: 0/透传，不复制旧 meta。
`gate/scope/article.ex`、`gate/scope/comment.ex` 增加对应 NOT EXISTS，保留 typed Context 和父级可读条件。
`communities/tags/stats.ex`、`search_artiments/capacity.ex` 通过同一公开查询合同统计，不重新手写另一套枚举。
`cms/query_builder.ex` 删除旧 pending filter 参数与分支；审核工作台查询走 Board 自己的 Case Query。
`articles/effects/publish.ex`、`comments/commands/create.ex`、`update.ex` 与 `comments/effects.ex` 改成第 6 节登记/传播合同。
Gate Loader 只为新动作按需装载 restrictions/epoch；公开 Scope 不加载 Case/Attempt。FrontDesk locator 与资源加载骨架保留。

## 11. 举报归属切换与历史边界

Report 与 Audit 一样在 D5 删除旧应用链、接口、GraphQL 类型、生成契约、嵌入存储和数据库表；不保留旧 model 作为迁移输入，不导入或转换任何历史举报。
新举报功能由 AlertBoard 从零接管。旧 `report_cases`、账号 `reported_user_ids/reported_count` 与旧 Interaction 举报投影均随 D5 清除；不生成 archive、回填脚本、双读或双写。
旧 `CMS.Model.AbuseReport`、`CMS.AbuseReports`、`abuse_reports/query.ex`、`abuse_reports/report.ex` 全部删除。通用 `Projection.add_report/remove_report` mechanics 可保留，只有在 AlertBoard 新事实成为 owner 后才重新接线；举报阈值 fold 永久删除，手动 fold 独立保留。

| 当前入口/存储                                                                                                                                                                                                                         | 清理与新实现                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CMS.AbuseReports.article/comment -> Interactions.Reactions.Report                                                                                                                                                                     | D5 删除旧 facade/Report/ReportConfirmation；N4 接入 AlertBoard 新 SubmitReport/WithdrawReport              |
| CMS.AbuseReports.account/undo_account -> AbuseReports.Report                                                                                                                                                                          | D5 删除旧 facade/Report 与嵌入写入；N4 以 User typed target 建立全新举报事实                               |
| `cms/interactions.ex`、Reactions 中 report delegates/result                                                                                                                                                                           | 删除举报 delegates；非举报 reactions 不动                                                                  |
| `schema/cms/cms_queries.ex` paged_abuse_reports + `web/resolvers/cms/reporting.ex`                                                                                                                                                    | D5 删除旧 field/resolver；N5 建立 AlertBoard resolver，无旧 query alias                                    |
| `schema/cms/cms_metrics.ex:280` report_filter；`schema/cms/cms_types.ex:1889/1895/2008` abuse_report_case/abuse_report/report_page                                                                                                    | D5 删除旧 GraphQL 类型/输入，N5 生成新 Board 类型                                                          |
| `backend/api/lib/groupher_server_web/schema/account/account_types.ex:51` + `backend/api/lib/groupher_server/accounts/model/embeds/user_meta.ex:83-84` + `backend/api/lib/groupher_server/accounts/model/embeds/user_contribute.ex:22` | D5 删除旧账号举报计数、举报者 ID 数组和贡献摘要计数；N5 的 `reported_count` 由 AlertBoard reports 聚合派生 |
| Article/Comment 旧 report/undo_report mutations                                                                                                                                                                                       | 删除旧 schema 声明/生成 helper 分支；N7 只生成新 submitReport/withdrawReport 合同                          |
| AbuseReport 表、report_cases embed、viewer_has_reported 旧投影                                                                                                                                                                        | D5 直接 DROP/移除，不迁移；N4 从空的新 facts 建立 Interaction 投影                                         |
| maybe_fold_comment、fold_for_report、report_threshold_for_fold                                                                                                                                                                        | 删除仅由举报阈值驱动的路径；手动 fold 独立保留                                                             |

清理后数据库中不得保留旧举报表/列/JSON key；新举报只从 N4 上线后的命令产生。新 Check/Decision 也不从旧 audit/report 状态构造。

### 11.1 举报前后端接线与投影

已定位的后端消费者：`groupher_server_web/schema/helper/mutations.ex`、`schema/cms/mutations/{post,blog,changelog,doc}.ex`、
`resolvers/cms/interactions.ex`、`resolvers/cms/comments.ex`、`resolvers/cms/reporting.ex`、`schema/account/account_types.ex`。
删除旧报告 mutation/query 生成分支，不删除同文件 upvote/emotion 等独立行为。
前端 `frontend/core/unit/Comments/schema.ts`、`Comments/Comment/Actions.tsx`、
`frontend/core/query/mutation/comment/moderation.ts`、`query/mutation/comment.ts`、`query/mutation/useCommentModeration.ts`
统一接新 submitReport/withdrawReport；保留现有乐观 viewerHasReported、回滚和队列串行机制，结果改用 ReportResult。
不再把举报结果强转为整个 Comment；客户端需要 reportId 进行撤销，作者 viewer 查询新增 `viewerReportId`（仅本人）。

跨内容版本的 active report 保持有效，仍关联原始 content_token/Case；新版本不伪造“同一人又举报一次”。
当前 open Case 聚合只纳入相同 token 的报告/信号；历史 active report 在详情的历史证据区域展示，不自动判定新内容违规。
viewerHasReported 由当前 viewer 对 target + scope 的 active report 存在性得出，reportedCount 为该范围 active 数；
报告增删与对应 Interaction 投影同事务，账号视图从新 reports 聚合，不写旧 reported_user_ids 数组。
ReviewCasePage 使用现有 `pagi_fields()`：entries + 非空 pageInfo，由 Helper.ORM.Pagi.Page.info 生成，不引入另一套分页协议。
