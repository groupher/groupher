# Optimistic Operation：乐观执行器的失败降级与清理

> 状态：A（失败闭环）与 B（Toggle 错误反馈）已实现并完成自动验证；C 仅完成无变化引用保持等窄改动，
> 尚未实施统一评论 adapter。Community 列表、详情、点赞失败/重试、文章置顶成功/失败及嵌套回复已在隔离 E2E 栈走查；嵌套评论使用临时浏览器 fixture 注入，不代表后端集成验收。
>
> 更新日期：2026-11-17
>
> 当前写后统计合同以 [ArticleStats 与 private state 写后同步](../../architecture/article-stats-and-viewer-state-sync.md)
> 为准；跨刷新确认记录以 [Optimistic Read Your Writes](./optimistic-read-your-writes.md) 为准。
> 本文取代此前关于整体 snapshotAt 排序、collect 与 reaction 共用 lane、独立 phase 状态和
> apply 后才取得恢复计划的旧描述，不重开已经完成的历史迁移。

## 1. 问题、范围与非目标

### 1.1 当前问题

当前 executor 在取消读取后调用领域 apply。apply 边计算边写缓存，返回 changes 后，
executor 才登记 ownership marker，然后发送请求。

如果 apply 在修改第一份缓存后、处理第二份缓存时抛错，已写入位置缺少 marker，现有
transport catch 也不会运行：请求没有发出，临时项或乐观值可能残留。执行器返回 rejected
Promise；Action 会保存并抛出错误，Toggle 包装入口则会捕获后丢弃错误，不能把两者都描述为静默失败。

另有两个需要明确的边界：

- 取消读取发生在准备之前；准备失败后仍须有可用的校准目标。
- 服务端已确认成功后，本地 reconcile、恢复读取或订阅通知失败，不得把业务结果改成失败。
  当前 reconcile catch 中的校准调用也可能抛错，现有实现尚不构成完整保证。

### 1.2 本轮实际影响面

| 操作                         | 当前乐观写入                           | 本轮处理                                           |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- |
| Article upvote/undo          | 活跃 ArticleStats count 与 viewer flag | 拆出只读准备，保留统计提交方式与值/revision 守卫   |
| Comment upvote/emotion       | public aggregate 与 viewer flag        | 拆准备，保留 public refetch 与 private 恢复的差异  |
| Comment create/reply         | 临时实体                               | 准备插入位置，按 command identity 清理临时项       |
| Comment update               | body 字段                              | 准备字段变化与恢复依据                             |
| Comment delete               | 通过 `entity-delete` 动作移除实体      | 保证删除位置与安全恢复                             |
| Article collect/emotion      | 空 plan，无乐观写入                    | 失败校准；不要求实现 prepare                       |
| ArticleStats confirmed merge | 按 owner revision 合并成功结果         | 保持现有 owner 语义，不改成通用 prepare/collection |

主要实现位于：

- [executor](../../../frontend/core/query/mutation/optimistic/execute.ts)、
  [effects](../../../frontend/core/query/mutation/optimistic/effects.ts)、
  [types](../../../frontend/core/query/mutation/optimistic/types.ts)；
- [Article upvote](../../../frontend/core/query/mutation/article/upvote.ts)、
  [collect](../../../frontend/core/query/mutation/article/collect.ts)、
  [emotion](../../../frontend/core/query/mutation/article/emotion.ts)；
- [Comment cache](../../../frontend/core/query/mutation/comment/cache.ts)、
  [lifecycle](../../../frontend/core/query/mutation/comment/lifecycle.ts)、
  [reaction](../../../frontend/core/query/mutation/comment/reaction.ts)。

### 1.3 边界

TanStack Query 继续拥有 confirmed server state；领域继续拥有 shape、版本语义、恢复条件、
响应归一化和 receipt 规则。列表排序、筛选归属及跨页位置仍由服务端读取校准。

本轮不引入 TanStack DB、第二份实体 store、运行时 registry、通用事务引擎、任意操作 DSL、
全局可订阅 phase 或错误广播系统；不重做 SSR hydration、后端命令幂等或所有 Query 工厂。
不承诺多缓存 all-or-nothing，也不把文件或行数下降作为正确性证据。

## 2. 职责、身份与执行流程

### 2.1 四个职责

| 责任方         | 负责                                                 | 不负责                                       |
| -------------- | ---------------------------------------------------- | -------------------------------------------- |
| 领域 operation | 解析目标、准备乐观变化、给出恢复依据、处理服务端结果 | 重复编写通用排队与清理流程                   |
| 准备阶段       | 只读计算位置、预期值、比较对象及领域恢复策略         | 修改缓存、嵌套输入、marker 或存储            |
| executor       | lane 调度、取消、登记、提交、失败清理、安排校准      | 猜测领域 shape、统一不同 owner 的 merge 规则 |
| 展示入口       | pending/error 展示与一次失败提示的消费               | 决定缓存恢复是否安全                         |

现有 operation 对象就是静态描述符，不新增平行配置表。必要的类型调整随实现完成，
不提前设计完整框架 API。只有 Toggle 需要意图合并身份；恢复条件由本次准备结果生成，
不能把运行期值和位置静态填进另一张表。

### 2.2 身份必须区分

| 身份            | 含义                                                                  |
| --------------- | --------------------------------------------------------------------- |
| entity identity | 定位领域实体，不使用页码、排序或组件实例代替                          |
| intent identity | 在 QueryClient 和 accountScope 内，合并同一 Toggle 能力的最后期望状态 |
| lane identity   | 确定哪些操作必须串行，领域 queueKey 优先，name + entityKey 只是兜底   |
| commandId       | 服务端命令幂等、日志和 receipt 关联；同一命令的恢复可以复用           |

当前 Article upvote 与 emotion 共用 reaction lane；collect 按 folder 使用 collect lane。
同一 Article 的 Comment lifecycle/reaction 共用 comments lane。不同 operation 的意图不会因此合并。

lane 隔离不代替 marker，也不等于会话复验。commandId 不作为跨前端执行生命周期的永久
“已提示”键；被合并的点击及 no-op 不生成新的命令。

### 2.3 目标流程

```text
进入现有 accountScope + lane
  -> 解析 cancel targets 与 authority targets
  -> 等待取消相关在途读取
  -> 若新操作取消了恢复中的校准读取，将其目标延后到本次操作结束后重新校准
  -> 只读准备
  -> 对即将提交的变化提前登记 ownership
  -> 通过领域提交方式写入乐观变化
  -> 执行服务端命令
       |
       +-> 确认成功：应用 typed result 与既有 receipt 规则
       |
       +-> 拒绝/未取得成功响应：按领域条件恢复
  -> 清理仍归自身的 marker
  -> 必要时按精确目标安排校准
  -> 交付业务结果；异常诊断写入现有日志入口
```

登记必须早于对应的、可能触发通知的写入。登记与该次提交之间不增加异步等待；
这不消除同步订阅者重入或提交后抛错的可能，仍须执行安全恢复检查。

ArticleStats 乐观提交目前使用与 confirmed structuralSharing 不同的路径。拆准备时保留该差异，
不得为了统一 setter 而破坏同 revision 冲突保护、活跃查询范围或 dataUpdatedAt 语义。

## 3. 准备、提交、恢复与失败合同

### 3.1 只读准备

准备阶段读取取消完成后的当前缓存，计算本次需要的变更；不得在取消前算好整份值、
等待取消后再无条件覆盖新缓存。

准备结果应足以回答：会尝试修改哪些位置、预期写入什么、恢复需要哪些旧值/位置/revision、
谁执行对应恢复。比较对象只按动作需要捕获，不要求每个字段都有 revision。

准备失败时：

- 缓存内容和 marker 与准备前一致；
- 不允许就地 sort/splice、修改嵌套对象或写 receipt；
- 不留下部分乐观提交；
- 先前取消读取的后续处理由 executor 负责，不属于准备函数的“无痕”保证。

读取依赖应尽量只暴露准备所需能力；类型约束不能替代不变性测试。

### 3.2 取消目标与校准目标

两类目标必须在取消读取之前解析完成，均不依赖准备成功：

| 目标              | 用途                                               |
| ----------------- | -------------------------------------------------- |
| cancel targets    | 防止在途读取覆盖本次乐观效果                       |
| authority targets | 本地降级、请求失败或成功结果同步异常时安排权威校准 |

可以共享领域身份解析，但不能把两个列表机械合并。成功结果可能已经更新部分 owner；
不要求每个被取消的查询都立即发网络请求。各操作须说明哪些读取由返回值收敛、哪些需要校准。
取消与校准必须由职责分开的 resolver 暴露；底层可以共享 query identity 查询，但调整取消范围不能顺带扩大校准范围。

查询目标应精确、去重并保留 public/viewer 隔离。inactive 查询可能只标 stale、待后续读取；
“已安排校准”不表示请求成功或所有订阅者渲染完成。

### 3.3 三类变更与恢复依据

| 变化         | 恢复动作             | 领域安全依据                                             |
| ------------ | -------------------- | -------------------------------------------------------- |
| 字段修改     | 恢复本次字段         | ownership、当前预期值，以及该 owner 需要的 revision 比较 |
| 实体删除     | 按领域位置恢复删除项 | ownership、实体身份、捕获位置及当前结构是否允许安全恢复  |
| 临时实体插入 | 移除自己的临时项     | command 派生的 pending identity 与对应 ownership         |

删除路径必须保存实体身份、稳定页身份与恢复依据，不能按普通字段恢复来验收。InfiniteData 按 pageParam 找回原页，
有限页按 pageInfo.page 或单页身份匹配；原页已不存在时不把实体插入其他页，并依靠失败路径的 authority 校准追平。
Comment 删除已使用显式 `entity-delete` 动作，不再通过 `innerId` 字段修改表达。
不得为了延期再建长期兼容模型，或把新接口永久锁定为只能表达字段修改。
不能为形式统一而给所有动作添加值或 revision 检查，也不能以仅比较值替代 marker。

当前 Comment public count/emotions 失败主要走 refetch；Article upvote 的 count 则保留
marker + 预期值 + beforeRevision 的守卫恢复，再安排权威校准。两者不能强行统一。

字段守卫检查与恢复应在读取当前值的更新逻辑中完成。marker 缺失、被接管，或领域证据不足时，
不以“执行到了某阶段”授权恢复。保留其他实体、字段和 owner 在此期间的更新。

### 3.4 提交失败与清理

纯准备只能减少异常，不能使提交不可失败。结构共享可能在落地前抛错，订阅者也可能在
数据已经落地后抛错。因此不能把“提交调用抛错”当成“没有写入”。

提前登记 ownership 是首选实现；准备结果与尝试范围用于提供比较对象和诊断，不授权盲目回放。
不实施 PREPARED/WRITING/MARKED 通用恢复状态机；首选路线若不能满足验收，再评估必要的局部记录。

清理必须处理多位置写入：

- 后一位置失败时，前面的位置按各自恢复规则处理；
- 一个恢复动作失败，不应阻止其余位置收尾；
- 只清理仍属于本次操作的 marker，不能删除后来者的归属；
- 无法安全恢复的位置使用预先解析的 authority targets；
- 清理或诊断异常不能把已确认成功的业务结果改为失败；marker 清理异常记录诊断并安排校准。

提前登记和安全恢复必须形成同一发布闭环。单独收紧恢复条件也需保证被跳过的位置仍能收敛，
不能以“条件更严格”为由认定独立发布必然安全。

对于允许降级的 commit 故障，先尝试条件化恢复和自身 marker 清理，再发送有效命令。
清理失败须记录诊断并记下对应位置的权威校准目标；命令及成功后的 reconcile settle 后才启动校准，
不得等待网络校准完成才返回命令结果。若故障不允许降级、命令不会发送，则在本地收尾后安排校准再返回原错误。
一个位置清理失败仍须继续其余位置的收尾。身份或业务输入错误不适用这条降级路径。
prepare 失败没有乐观写入；它仍先发送有效命令，命令 settle 后再校准此前取消的读取。

### 3.5 错误分类与降级

执行器按阶段、限定的故障来源、领域可区分的错误/结果和是否取得有效响应共同判断。
阶段只是线索：不能把 prepare/commit 中的所有异常都当成缓存故障，也不能把 execute 中的所有异常
都当成服务端拒绝。领域输入校验必须返回可区分的错误/结果；普通未知异常默认不获得降级发送资格。

缓存故障采用共享的内部 OptimisticCacheError 标识，由领域限定的缓存准备/提交边界产生并保留原始
cause；执行器只据该标识授予降级资格。不得把整个 operation 的任意异常统一包装成缓存故障，
业务校验错误保持可区分，不能只因异常发生在 prepare/commit 就补上这个标识。

| 情况                     | 可观察判据                                                                     | 行为                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 可以降级的 prepare 故障  | 来自限定的缓存读取/shape 准备边界，带 OptimisticCacheError 标识                | 本次未写入乐观值或 marker，无需撤销；记录降级并发送有效命令，命令 settle 后安排取消读取的校准                   |
| 可以降级的 commit 故障   | 乐观提交边界带 OptimisticCacheError 标识，可能已经部分落地                     | 先尝试条件化恢复并清理自身 marker，再降级发送有效命令；命令及 reconcile settle 后安排校准，不阻断其余收尾和发送 |
| 身份、目标或业务输入无效 | 领域返回可区分的无效输入/目标结果；包括发送前的内容编码校验失败                | 中止并返回错误，不作为缓存故障吞掉                                                                              |
| 服务端明确拒绝           | 收到协议明确表示拒绝的有效响应，由对应 transport/领域边界解释                  | 按领域策略恢复并交付失败结果                                                                                    |
| 提交结果不确定           | 请求可能已经发送，但没有取得可信的提交结果；仅收到 HTTP 响应不构成提交结果证明 | 不推断服务端未执行，不自动续发，保留既有 command 恢复边界                                                       |
| 服务端成功后的本地失败   | 已取得有效成功结果，随后 reconcile、校准或通知异常                             | 业务结果仍成功，记录诊断并安排可行的后续校准                                                                    |

现有 GraphQLRequestError 同时覆盖 GraphQL errors、HTTP 错误及部分无效响应；不能按这个类名
统一认定明确拒绝。ContentPublishError 也可能来自请求发送前的 plateSourceFromJson 校验。
这些协议差异在对应边界解释，B 消费分类后的结果，不自行猜底层异常。此处不新增全局错误解释器。

不得用包住所有异常的 catch 实现“不带乐观地发送”。分类规则必须有业务输入错误仍然中止的反向用例。
降级发送不自动生成第二次请求，也不更换同一次命令的 identity。

默认 invalidateQueries 的 Promise 可以在重取失败、Query 已进入 error 后正常 resolve；
因此要区分刷新请求失败与校准调用本身拒绝，不能仅靠 catch 判断是否收敛。
普通断网本身也不会自动触发本地 reconcile 的 catch。

### 3.6 诊断出口

诊断写入现有日志入口，缺少专用入口时使用 console.warn/error；测试可以断言这些记录。
仅在乐观降级、清理失败、成功后的同步/校准异常等异常路径记录必要的操作、阶段和原因，
已有 commandId 时用于关联；不记录正文、token 或完整 viewer 数据。

诊断在开发和生产中均可记录，但不持有状态、不提供订阅、不承诺保留，也不作为 UI 返回协议。
不新建 diagnostic store、广播通道或长期“已提示”集合；日志出口异常不得改写业务结果。

## 4. 交付包、依赖与范围控制

### 4.1 A：失败闭环（已实现）

包含必要的 operation/change 类型、两类目标前置、只读准备、提前登记、
安全恢复、失败清理与校准。迁移 §1.2 中的实际调用路径；不把空 plan 或 confirmed merge
扩展成新的乐观算法。

内部可按“恢复守卫 → 准备与登记 → 清理 → 校准”拆提交，涉及提前登记的改动须整体闭环后发布。
“恢复守卫 + 对应字段校准”可先作为更小的切片验证或发布：拒绝本地恢复时，在本次操作收尾中
为该字段对应的精确 authority owner 安排校准，测试断言目标正确、去重且实际完成安排。
不以等待网络刷新成功作为业务结果返回的前提，不保留两套并行机制。
显式删除类型按 §3.3 决定是否随 A 整理，不先摘掉守卫或校准来缩小范围。
字段条件、临时项移除和删除位置恢复同时具有明确合同，不把关键安全行为推迟到类型整理。

A 已将 operation 迁移到只读 `prepare`、分开的 `authorityTargets`、预登记 ownership、逐项提交和条件化清理；
Comment 删除使用独立 `entity-delete` 动作。prepare 失败跳过乐观效果并发送有效命令，commit 部分失败
先做安全清理并记录校准目标，再按故障标识决定是否降级发送；校准在命令结束后安排。

A 不要求新建可观察 phase、通用策略组合器、错误订阅 Map 或任意操作解释器。没有实际用途的
intent 字段、空 callbacks 和重复配置不作为新接口的强制项。
没有本地乐观变更的操作可以省略 `prepare`；执行器按空 plan 继续，不要求领域代码提供空 prepare。

### 4.2 B：Toggle 错误反馈（已实现）

依赖 A 的错误分类与执行结果约定，可独立验收和发布：

- 一次共享执行产生一个失败结果；失败后结束本轮，不自动续发期间累积的意图；
- 用户手动重试建立新的执行，不因 commandId 恢复复用而永久抑制提示；
- 参与执行的 hook 实例各自保留 error，toast 只由创建共享意图的入口负责一次；行内 live status 常驻 DOM、只更新文本，使用 visually hidden 样式避免改变列表和 footer 高度；
- 不要求所有显示同一实体的组件同步一份 error，不新增共享错误广播；
- 明确新执行开始、目标/账号切换及卸载后的错误清理，避免错误残留到其他实体；
- 队列入口向调用方提供本次是否创建共享意图的 created 信息；参与者获得同一 Promise，但只有创建者消费 toast；
- no-op 不算创建意图；手动重试的新执行重新获得提示资格，不设置长期去重键；
- 错误展示由 hook 实例状态承载；各实例可记录共享拒绝，但只有创建者弹 toast；
- created 信息从 enqueueOptimisticToggle 传给 hook 即可，不要求改变组件使用的 toggle() 返回值；
- 创建者卸载后不要求由另一个组件接管 toast，不为此新增通知转交机制。

范围包含 useOptimisticToggle、useArticleUpvote、useCommentUpvote、直接调用队列的
useCommentEmotion，以及实际展示入口。只增加 hook.error 而没有展示消费者，不算完成。

这包含队列返回形状的变更：enqueueOptimisticToggle 从直接返回 Promise，改为提供共享 Promise
和本次调用的 created 信息。两个生产调用点 useOptimisticToggle、useCommentEmotion 同步适配；
直接依赖返回值的 execute.test.ts、article.test.ts 也须更新，hook/交互测试另行验证。
组件层 toggle(): void 保持现有形状，不把内部执行 handle 暴露给展示组件。

当前 intent Map 以条目存在表示执行中，失败后删除；不得直接长期保留 error 条目，
让下一次点击命中旧的 rejected Promise。保留点赞与 emotion 合适的展示方式，共享结果合同即可。

B 验收必须覆盖：两个入口参与同一次共享执行，只弹一条失败 toast；参与者可各自展示错误；
下一轮执行失败仍可提示；no-op 不产生创建者提示；新执行及目标/账号切换不残留旧错误。

实现已覆盖共享失败的单次 toast、每个参与 hook（包括创建者）的本地 error、重试清错、no-op 和创建者卸载后的提示抑制；
Toast 使用既有全局 Toaster。行内 live status 不参与布局，提示文案使用 `operation.failed_retry` 中英文案。账号/目标切换清除 hook error。

### 4.3 C：评论 adapter（整体待收益评估）

A/B 后再评估，不作为 A 的发布前置。以实际消费者派生的 shape 清单为边界：
有限/无限分页、置顶、嵌套 replies、replyToComment，以及 create/reply 的插入形态。
Query 工厂数量不等于实体 shape 数量，不为非实体查询伪造 adapter。

只集中“同一 shape 有哪些实体路径”这份知识，删除被替代的重复规则。查找、不可变更新和位置恢复
允许不同算法；不为统一算法失去提前返回能力或增加全量路径收集。

验收直接检查 adapter 输出，不依赖 Query 的结构共享兜底：

- 无变化返回输入引用；
- 只有变化路径创建新引用，未变分支保持引用；
- 纯函数对相同输入产生相同内容，不要求两次新结果引用相等；
- set、重复删除、同 command 临时项插入按各自合同验证重复效果；count + 1 不要求幂等。

例如 mapCommentPages 的 callback 全部返回原 page 时，外层对象及 pages 数组也应保持引用。
声明路径用例还须对照真实消费者检查漏声明。只增加包装、旧遍历仍然并存，或没有减少修改点，
则停止扩大 adapter 范围，不上提全局 collection。

本轮只落地 mapCommentPages、mapCommentEntries 与 patchEntries 的无变化/未变分支引用保持，
并由单测直接断言其身份；没有集中评论实体路径，也没有声称完成 adapter。

### 4.4 独立跟进

- **Dashboard 成功/同步边界**：复用服务端成功优先的原则，并覆盖校准也失败；
  标签重排的两条独立命令可能部分成功，前端不能提供后端原子性。
- **账号切换与晚到结果**：分别验证旧会话排队任务发送前的有效性、晚到结果/receipt、
  异常退出后的 marker。队列按账号隔离不等于会话复验；检查后到请求间的竞态需结合认证链路评估。
  public marker 不机械增加 accountScope，viewer key 已自带账号作用域。
- **其他清理候选**：Dashboard 保存动作分组、文章设置 helper 的 AST/path 推断、
  显式删除类型、重复展示优先级和失效指标命名，按各自消费者另行收口，不自动并入 A。

目录批量调整、查询层全面重写和新的统一 view 层不属于上述交付包。

## 5. 验收与验证方式

表格用于说明责任与判断依据，不要求每个操作填写所有字段。验收按四组行为证据执行，
不按概念或表格项计数。

### 5.1 四组必需证据

| 组别         | 必须覆盖                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 真实复现     | 异常结构的评论缓存；多位置写入时第二处失败；分别覆盖结构共享写前失败和订阅通知写后失败，断言第一处的恢复/校准及请求是否发送 |
| 安全反向用例 | 准备失败无写入；非法业务输入不降级发送；ownership 被接管、当前值变化、revision 推进时拒绝旧值恢复；清理异常不阻断其余收尾   |
| 成功与校准   | reconcile 异常、刷新请求失败、校准 API 拒绝均不改写已确认业务结果；精确目标、去重、public/viewer 隔离及 §3.6 日志记录       |
| 既有行为     | 连点合并、同 lane 串行、无关实体并发、账号 lane 隔离；列表/详情、统计、viewer、分页、revision、hook 和 SSR/hydration        |

原内存故障注入须转成持久回归测试；不能全部替换成合成 updater 抛错，丢掉领域结构覆盖。
测试必须断言处理结果，不能仅断言“不抛错”或“请求数没有明显增加”。

降级用例分别断言：prepare 失败没有乐观恢复动作；commit 部分失败的清理尝试先于发送；
清理动作失败仍处理其他位置，并发送有效命令。两条路径都只发送一次，且保留精确校准安排。

不同账号 lane 隔离只验调度；旧任务在新会话下发送属于 §4.4 的单独验收，不得相互代替。

### 5.2 准备只读与恢复测试口径

准备测试同时检查缓存写接口、marker 写接口及输入内容；使用独立快照和递归冻结的代表性夹具。
前后 deep-equal 只能发现最终内容变化，不能发现修改后又改回；写入拦截用于验证中间写入。
Proxy 是定位复杂问题的可选工具，不建设运行时写入追踪框架。

恢复按字段/实体和领域语义断言，不要求整份缓存等于操作前快照，因为其他操作可以合法更新。
更新后的无关实体、字段、pageParams、分页元数据及 viewer owner 必须保留。

不把所有故障与所有 shape 做全排列：executor 测共同失败行为，领域测真实 shape 与恢复规则，
hook/页面测提示和交互。

### 5.3 既有测试入口

既有验证入口如下。当前 dev 基线不存在 `dsbShell/tests/index.test.ts` 和
`query/queryClient.test.ts`，因此从命令中移除；验收固定文件与场景，不固定用例数量：

```sh
pnpm exec vitest --config frontend/core/vitest.config.mts run \
  frontend/core/query/mutation/optimistic/execute.test.ts \
  frontend/core/query/mutation/optimistic/useOptimisticToggle.test.tsx \
  frontend/core/query/mutation/article.test.ts \
  frontend/core/query/mutation/comment.test.ts \
  frontend/core/query/invalidation.test.ts \
  frontend/core/query/mutation/dsb/types.test.ts \
  frontend/core/unit/DsbThread/logic/useHelper/useEdit.test.ts \
  frontend/core/hooks/useArticleStates/index.test.tsx
```

根据实际改动纳入以下直接相关入口，不以基线通过代替它们：

| 合同                      | 测试入口                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 评论 shape 与分页         | frontend/core/query/mutation/comment/pages.test.ts、frontend/core/query/comment.test.ts                                                                                                                        |
| owner revision 与确认结果 | frontend/core/query/articleStats.test.ts、frontend/core/query/revisionGuard.test.ts、frontend/core/query/viewer.test.ts                                                                                        |
| 评论交互                  | frontend/core/query/mutation/useCommentUpvote.test.tsx、useCommentEmotion.test.tsx、useCommentModeration.test.tsx、frontend/core/unit/EmotionSelector/index.test.tsx、frontend/core/unit/Upvote/index.test.tsx |
| SSR/hydration 与 surface  | frontend/core/query/ArticleQueryProvider.test.tsx、frontend/community/src/query/articleSurface.test.ts、commentSurface.test.ts                                                                                 |

### 5.4 本轮验证记录

- Core type-check 与 Community type-check 通过。
- 改动文件的 oxlint、oxfmt 检查通过，文档覆盖检查通过。
- 21 个相关测试文件、124 个用例全部通过。走查时发现文章 surface 的缓存重置仍使用旧的 `article` key 前缀，
  与现行 `article-shared-comments-v1` key 不匹配；已改为匹配 `articleQueryKeys` 的分页族，并更新断言验证重启后保留新页、失败恢复时清除目标社区旧页。
- executor、domain、toggle 和局部错误提示覆盖准备/提交失败、条件恢复、命令 settle 后校准、共享失败、手动重试、卸载与列表/详情控件错误展示；command-only 操作可省略 prepare。
- 评论删除回滚覆盖 InfiniteData 页数变化时按 pageParam 恢复，以及原页消失时不误插入其他页。
- 使用本地 Phoenix 的 E2E Community 配置读取验证了 `/home/post` 列表与 `/home/post/3` 详情；`/home/xx` 不是有效内容路由，在当前 fixture 下会 404。
- 隔离 mock GraphQL + E2E Auth 浏览器验证中，测试登录与 Auth session/refresh 均成功；页面 SSR 首个 GraphQL 请求遇到 `TOKEN_MISSING` 后，客户端刷新并重放成功。列表、详情点赞的显式拒绝均显示错误状态且计数回滚；详情请求挂起时快速连点只发送一个点赞命令，失败后手动再点会新发一个命令。文章置顶成功后显示“设置完成”并切换为“取消置顶”；拒绝时显示“设置失败”且操作保持可重试。所有写请求均由浏览器路由注入，未写真实后端或持久 mock 状态。
- mock server 的 `commentPage`、`commentReplyPage` 固定返回空列表，所以用 Playwright 浏览器路由临时注入一条根评论和一条嵌套回复，未修改仓库 fixture。回复点赞与情绪请求在显式拒绝后都保留嵌套回复，并显示局部错误状态；情绪失败还显示一次 toast。这个走查验证 UI 和 hook 边界，缓存路径的细节仍以评论缓存单测为准。

先运行 Core type-check；共享 hook API 影响 Community 时也运行其 type-check。
其余检查按实际受影响的消费者选择，不因文档中的历史门禁盲跑全部构建。

实现后的手工页面走查使用 `home` 社区的 `/home/post` 列表与 `/home/post/3` 详情。点赞失败/重试、快速点击、文章置顶成功/失败及嵌套回复的点赞/情绪失败已用隔离 E2E mock 完成；评论 pinnedEntries 的真实后端集成仍由自动测试验证。
SSR 的真实 key、public-only dehydrate 和私有状态隔离主要由自动测试验证；
截图如有需要放在 .playwright/，不放项目根目录。

## 6. 完成标准与关联合同

每个交付包须能从操作定义、结果和测试回答：

1. 服务端已确认成功、明确拒绝，还是尚不确定？
2. 哪些缓存位置可能已被修改？
3. 谁负责安全恢复，恢复不了如何安排校准？

不要求把领域实现复制到描述符中；操作入口应能发现这些规则的责任方与测试。
A 的实现完成证据包括真实复现回归、安全反向用例、既有相关测试与适用类型检查；产品发布验收还需完成
5.4 所列手工交互走查。不能只提交 marker 顺序调整，不能以文档勾选代替行为证据。

当前数据与领域边界继续遵循：

- [Query / Store 边界](../../architecture/query-store-boundary.md)：Query owner、working copy 与禁止新增状态层；
- [ArticleStats 写后同步](../../architecture/article-stats-and-viewer-state-sync.md)：真实 detail/batch、三个 owner 独立 revision、保留 dataUpdatedAt；
- [Query invalidation](../../architecture/query-invalidation.md)：typed 失效目标与列表排序/成员校准；
- [Optimistic Read Your Writes](./optimistic-read-your-writes.md)：只保存带账号作用域、TTL 和版本的 confirmed receipt，
  不持久化未确认操作，不把 receipt 当事务日志；
- [公共缓存失效](../../architecture/public-cache-invalidation.md)：业务提交与 CDN 传播各自收口；
- [命名规则](../../rules/naming.md)：沿用 type 分类词汇及现有领域命名。

Article 与 Comment 的同 revision 接受规则保持各自合同；正常成功路径继续应用服务端完整结果，
不退回常规全量 refetch，也不新增 batch 到实体中转 cache。统一优先级时只收口纯函数规则，
不建设新的展示层。

文档只记录当前合同、待实施边界和验收证据。历史 O0–O5 的主链接线不等于本次 A/B/C 已完成；
后续更新状态时分别记录实现、测试和发布证据。

历史迁移阶段仍被 RYW 与 Query Sync Cache 文档引用，定义如下；它们是已完成的基础迁移，不是本轮 A/B/C 的子阶段：

| 历史阶段 | 已完成的基础范围                           |
| -------- | ------------------------------------------ |
| O0       | 冻结现状、operation 合同与回归基线         |
| O1       | Article upvote 竖切与 optimistic operation |
| O2a      | 后端 commandId 幂等                        |
| O2b      | Article revision 与权威写后同步            |
| O3       | Comment reaction                           |
| O4       | Comment create/update/delete 生命周期      |
| O5       | View operation identity                    |
