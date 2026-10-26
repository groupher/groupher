# Backend 非 Commands 写入口决策

> 状态：已收口（2026-10-20）

> 状态说明（2026-10-21）：上面的“已收口”指是否迁入 Command/pipeline 的分类决策。
> 下文新增的授权、错误传播和事务边界定点复核待实施；不重新发起全仓 Command 化，也不推翻原维护方式。

本轮检查 `Commands/` 之外的 job、maintenance、workflow、facade 与 transaction owner，目的只是发现遗漏的顶层业务 Command，不要求所有数据库写入进入 pipeline。

## 决策原则

只有同时承担下列职责的顶层动作才考虑迁入 Command/pipeline：

1. 推进 canonical domain state；
2. 拥有稳定的 command/operation identity；
3. 明确拥有 canonical load、锁和主事务；
4. 需要统一 retry、recovery 或失败补偿；
5. 是用户或内部系统可独立调用的完整业务动作。

下列实现默认保留现有 owner：

- leaf Persist、row primitive、query、codec 和 helper；
- projection、cache、search、analytics 与 Outbox delivery；
- 有界 retention、cleanup、backfill 和 reconciliation；
- 已经拥有 job identity、重试和补偿的 durable workflow；
- seed、bootstrap、migration 和测试基础设施。

出现 `Repo`、`Ecto.Multi`、Persist 调用或 `Workflow` 名称，只是写入信号，不是迁移理由。

## 收口结论

- Articles maintenance 的 user/internal 协议已经拆开；两者共享领域 owner，不使用特殊 actor、空 `command_id` 或运行时 flag 切换协议。
- Trash permanent-delete 的用户动作使用 Receipt；scheduler 使用独立 internal direct pipeline，因为两者的 actor、identity 与恢复协议不同。
- Community creation/setup 继续由 Oban Job 直接调用 `CMS.Communities` facade，再进入 `Communities.Creation` / `Setup` workflow owner。它们已经拥有 operation identity、锁、事务、重试与 exhaustion compensation，不增加纯代理 Command。
- Assets upload、Content Import、Community Application expiry、Wallpaper reconciliation 与其他 durable workflow 保留现有 owner。
- Outbox、cache、search、insights 与普通 projection/delivery job 不 Command 化。
- leaf Persist、States、Refs、Query 和 transaction helper 不 Command 化。

## 维护方式

本决策不再维护 repository-wide semantic evidence ledger、逐条 inventory 或 freshness gate。以后只在以下情况重新评估某个入口：

- 新增顶层用户或 internal action；
- 一个 facade 开始直接拥有多 owner 写入；
- user/internal 协议混用；
- 发生 identity、锁、事务、重试或 partial-success 问题；
- 现有 Workflow 开始承担新的独立业务入口职责。

评估结果记录在相关领域文档和行为测试中，不再生成全 Backend 的证明型 manifest。

## 2026-10-21：调用正确性的定点复核

本次确认的是复核原则，不表示以下每个入口已有缺陷，也不表示所有入口已完成验证。
已完成的显式 Command 迁移、上述 owner 分类与实际调用正确性是不同的验收范围。

```text
Job / maintenance / 内部服务
              |
              +-> 顶层资源业务动作
              |     -> 既定 Command 或 durable workflow owner
              |     -> 明确系统身份/权限 -> Gate admission
              |     -> 锁内 canonical resource -> Lifecycle / Persist
              |
              +-> 已提交事实的投影/投递
              |     -> 原有 projection / delivery owner
              |     -> 校验任务身份、资源版本与过期策略
              |     -> 幂等副作用 / retry
              |
              +-> retention / cleanup / reconciliation
                    -> 原有 maintenance owner
                    -> 保留期、状态条件、锁与重复执行保证
```

不能给 cache/search delivery 强塞用户 Gate，也不能把“内部任务”当成变更业务资源的免授权理由。
具体系统能力由所属领域定义，不新增万能 privileged actor。

### 应复核的合同

| 方面           | 要回答的问题                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 授权           | 入口是在执行新的资源动作，还是投递已授权决定？前者是否有领域准入，是否只依赖 GraphQL Passport？ |
| 状态           | 状态转换是否经 Lifecycle；是否直接写 visible/pending 等字段建立第二权威？                       |
| canonical load | 任务是否按稳定身份重载当前资源；是否错误复用队列里的过期 struct 或重复解析 public ref？         |
| 事务与锁       | 主事务归谁，准入与写入是否处于正确锁范围，有无重复事务 owner 或 partial-success？               |
| identity/retry | 重试是否复用 operation/job identity，重复任务是否重复写入或重复发送副作用？                     |
| 错误           | missing、obsolete、conflict、retryable failure 是否区别处理，是否吞错或一律重试？               |
| effects        | 需要持久化保障的任务是否与主写入一致提交，外部副作用是否通过既定 delivery 机制？                |

### 与本次发现的衔接

- 旧 Audition/Scheduler 路径列入 [旧内容 Audit 退役](./legacy-content-audit-removal.md)，不再为旧链单独增加新的 Command 包装。
- maintenance、Community setup、Assets/Import 等保持前述 owner 决策；出现权限、状态、恢复问题时只复核对应链路。
- 错误传播按 [ErrorCat 全链路收口](./errorcat-chain-convergence.md)；资源加载按
  [FrontDesk/Query 收口](./frontdesk-query-convergence.md)；准入按 [Gate 收口](./gate-admission-convergence.md)。
- 若复核发现真正遗漏的顶层业务动作，再按本文已有决策原则决定是否迁入 Command；不因发现 Repo 调用就迁移。

### 实施与验收

按具体 finding 在所属领域记录入口、现有 owner、实际问题、修改及场景证据，不建立永久全仓 ledger 或 freshness gate。
优先复核本次发现的旧审核写入和与 Gate/FrontDesk 整改相交的入口，其余按既有维护触发条件推进。

相关行为测试按问题选择：重复投递、任务执行前资源删除/内容更新、权限或父级状态变化、事务失败、
副作用失败、retry exhaustion。纯投影任务验证幂等和版本，不套用不相关的用户权限矩阵。
最终结果必须分别说明 owner 决策保持不变的范围、实际修复的链路及尚未验证的部分。

## 2026-10-21：既定范围复核结果与修复批次

本节是定点源码复核结果，不是全 Backend 的 semantic ledger。没有运行数据库并发测试；风险与验收分开记录。
不改动 Audit/Sentinel。源码路径相对 `backend/api/lib/groupher_server/`。

### N1：Article 自动归档——保留 maintenance owner，补锁后条件

已核实路径：`Helper.Scheduler.archive_artiments -> Articles.Maintenance.archive -> Commands.Archive -> States.archive -> Articles.Lifecycle.archive_before`。
内部 Archive pipeline 只有 change，不是普通用户动作，不能为形式统一强塞 user Gate。

实际问题：普通 Article 的 archive_before 先查候选，再逐行锁 Lifecycle；锁后只验证 transition，未重新验证
Article.active_at 仍早于 threshold。候选选择后变活跃的文章仍可能被归档。函数还匹配 `{:ok, count} = transaction(...)`
并返回裸 count，使事务错误变成 MatchError。Docs 的 archive_before 是带条件的锁定查询且返回 tagged tuple，不应一并重写。

修改：`cms/articles/lifecycle.ex` 在约定的 aggregate 锁顺序下重读 Lifecycle 和 Article 活跃时间，重验 published/threshold；
已不满足条件跳过并不计数，真实失败返回 `{:error, reason}`。去掉 `_article_model`、`_now` 无效参数，目标
`archive_before(thread, threshold)` 返回 `{:ok, count}`；同步 `articles/states.ex` 调用，不再额外 done 包装。
批量有界化，避免一次锁全库候选；保留每次实际 transition 的 Activity。

验收：候选变为未过期后跳过、重复归档、并发删除、第二条转换失败；不得误归档/重复记录，不返回 MatchError。`blog_archive_test.exs` 覆盖阈值变化、Article 行锁竞争后重读 active_at、重复归档及 tagged count。
扩展 `cms/articles/states/blog_archive_test.exs`，保留 `doc_archive_test.exs`；新增普通 Article 并发场景。

N1 最小验证（backend/api；新增并发场景随本批加入现有测试）：

```sh
mix test test/groupher_server/cms/articles/states/blog_archive_test.exs test/groupher_server/cms/articles/states/doc_archive_test.exs
```

### N2：Community Creation/Setup——保留 durable workflow，阻止过期任务副作用

已核实：`Jobs.CreateCommunity -> CMS.communities_create_from_application -> Communities.Creation` 在事务内锁申请、
校验 approved，创建资源/Lifecycle/asset/slug claim/setup job；保留 owner，不新增代理 Command。

Setup 的 `run` 先执行 ensure_root、DocTree.initialize、Analysis provision，再在 activate 锁申请检查状态；
operation_ref 被写入事件，但不是执行前的当前 operation fence。`mark_failed` 只按 application.status 判断（setup_failed 幂等成功、setting_up 进入失败转换、其他状态冲突），不校验 operation_ref。
这意味着旧任务的 setup 副作用可能先于过期判定，旧 operation 的最终失败也缺少与新 operation 的身份比较。

修改 `cms/communities/setup.ex`、`jobs/community_setup.ex`、必要的 CommunityApplication 状态/事件 owner：

1. 执行前按 application_ref + community_id 验证关联和当前 setup operation；复用已持久化 operation identity，
   如目前只在事件中保存则通过 owner 读取当前 setup 事件或物化明确字段，不从随机 UUID 推断新旧。
2. 已 created 的重投递无副作用成功；旧 operation 显式 obsolete 成功；当前状态不允许则正式错误，不先初始化再拒绝。
3. 外部 provision 不持有长数据库事务。持久化阶段和 activate/mark_failed 再校验 operation fence；ensure 类步骤继续幂等。
4. retry 创建新 operation 并原子提交状态与 job；旧任务不得把新运行标为失败。
5. 不改变 reviewer Passport 的现有权限，不用万能 system actor；补 `retry` arity/spec/doc 和准确 worker ASCII。

验收文件：`cms/community_applications_test.exs` 扩展 approved->setting_up->created、重复 setup、旧 operation 回调、
retry 后旧任务 exhaustion、provision 失败后重试。外部服务 mock，验证初始化调用次数与状态不会被旧任务覆盖。

N2 最小验证（backend/api；包含旧 operation/exhaustion 新场景）：

```sh
mix test test/groupher_server/cms/community_applications_test.exs
```

### N3：Outbox delivery——保留 delivery owner，不能吞掉终态写入失败

已核实 `cms/outbox/workflow/{article,comment,community,press,asset,interaction}.ex` 六个模块都有
`_ = Outbox.mark_failed(event_id)` 或 `_ = CMS.Outbox.mark_failed(event_id)` 后无条件成功的模式。
若标记失败本身失败，Job 却已确认完成。六者同批修复，与 E1 的错误迁移范围一致。

目标 API 扩展为 `CMS.Outbox.execute(event_id, action, on_error: :retry | :fail | :classify)`；省略选项仍默认为 :retry。
六个 worker 在最后一次尝试传 :fail，其余传 :classify：明确的不可重试 ErrorCat 立即写 failed；标记 retryable 的 ErrorCat 写 retrying；非结构化瞬时异常继续重试。lock_ref 保持在 Outbox 内部，不返回给 worker：

```text
worker -> execute/3 -> claim（生成并持有 lock_ref）-> action
                         |                         |
                         |                    action 失败
                         |                         |
                         +-> 校验 running + locked_by = lock_ref
                                    |
                       +------------+-------------+
                       |                          |
              retry / classify              fail / terminal classify
                 原子写 retrying              原子写 failed
                       |                          |
                 返回原始错误             终态写入成功才返回
                                          outbox_delivery_exhausted 错误
```

修改 `cms/outbox.ex` 的 `run_action`/失败持久化路径（包括 action 返回错误、非预期返回、异常归一化分支，不能只修一个 case）：在持有当前 lease 的 running 状态下直接 CAS 到 failed，
保存错误信息并清锁；失败转换不得先进入 retrying 再清锁后调用 mark_failed/2。
当前 fail 会清空 locked_by，execute/2 也不返回 lock_ref，因此现有 mark_failed/2 不能被 worker 直接复用。
失败终态成功持久化后才返回新增 `CMS.ErrorCat.outbox_delivery_exhausted`；六个 worker 仅对此正式 reason ack。
持久化失败、stale_lock、claim 失败均返回对应错误，不转换成 exhausted 成功；busy 仍 snooze。
不声称 exhausted job 会自动再重试，恢复继续走既有运维/重放入口。

此扩展只处理 action 失败的终态归属；complete 写入失败仍是错误，不能假报 delivery_exhausted。
旧 mark_failed/1、/2 待所有生产/测试调用方迁移后删除；若另有管理用途则改为明确管理动作，不能留作 worker 无 fencing 兜底。
Outbox facade/spec、`run_action` 调用和六类 worker 在同一批交付，六者都不得继续调用 worker 侧 mark_failed 兜底。

`run_projections` 的稳定 ID reload 是合法 async loader，不按 F1 禁止；payload 缺失、资源已删除、外部服务失败分别按 E1 分类。
Asset 已明确允许的 already_deleted 成功语义保留；Interaction 的 target/actor 校验与 effect 幂等合同保留。

验收：扩展 `cms/outbox_test.exs`，为六个 worker 参数化运行 action failure、终态持久化失败、stale lease、busy 和重复投递；
`cms/outbox_test.exs` 的 execute/3 合同测试验证 CAS。模拟另一个执行者取得新 lock_ref 后，旧执行者不能改 failed；
Asset provider failure 和 Interaction effect failure 都必须覆盖。终态持久化失败不得 ack，成功持久化 failed 后才 ack。

N3 最小验证（backend/api；新测试随本批创建）：

```sh
mix test test/groupher_server/cms/outbox_test.exs
```

### 执行依赖

N1 可独立；N2 同批测试 operation fence；N3 与 E1 Outbox 错误映射同批。完成这些定点修复不表示 Assets/Import 等其他
durable workflow 获得全链路安全认证；它们仍保持既有 owner 决策，按既有问题触发条件复核。
