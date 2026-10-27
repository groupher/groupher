# Press、Search 与 CDN 的独立投递

> 状态：current
>
> 描述本批工作区代码；部署 Phoenix 后才生效。生产发布状态以 [部署记录](./cloudflare-workers-deployment.md) 为准。

## 三个服务如何分工

Press 负责公开内容输出与自己的缓存，Search 负责搜索索引，CDN purge 清除公共页面缓存。
三个服务消费同一次变化，不互相调用，也不以对方成功为前提。

```text
一次内容变化
    |
    v
事实事件（发布 / 更新 / 可见性变化）
    |
    +-- Press 任务  --> 独立成功 / 失败 / 重试   [press queue]
    |
    +-- Search 任务 --> 独立成功 / 失败 / 重试   [search queue]
    |
    +-- CDN 任务    --> 独立成功 / 失败 / 重试   [public_cache queue]
```

父事件只在数据库事务内创建三个子事件和对应 Oban jobs，不调用外部服务。某个子任务失败不阻止
其它子任务领取和执行。父事件 ID 是稳定的子任务 workflow identity；重复分发不会重复创建或
重跑已完成子任务。子任务各自维护 lease、状态和最多 8 次 Oban 尝试；平台凭据缺失只影响对应任务。

## 内容更新与可见性变化的范围不同

同一 Article 可以同时出现在多个社区。发布/更新改变共享内容，必须刷新所有公开 bindings。
先前拆分误用了单 binding 同步，会发生如下问题：

```text
Article A 从「旧标题」更新为「新标题」
    |
    +-- home Search: 新标题   <-- 当前社区更新了
    |
    +-- tech Search: 旧标题   <-- 其它社区漏了
```

本批根据 Search child 的 `source_event` 选择同步范围：

```text
article.published / article.updated
    |
    +-- upsert_article(article_id)
           +-- home: 当前公开内容
           +-- tech: 当前公开内容
           +-- 其它公开 binding: 当前公开内容

article.visibility_changed / article.review_changed
    |
    +-- sync_binding(article_id, community_id)
           +-- 指定 binding 可见: upsert 指定 entry
           +-- 指定 binding 隐藏: delete 指定 entry
           +-- 指定 binding 已被 unmirror 删除: delete 指定 entry
```

```text
从 tech unmirror
    |
    +-- 数据库: 删除 tech binding，Article 和 home binding 保留
    |
    +-- Search child 稍后执行
           +-- 找不到 tech binding --> 删除 tech Search entry --> 完成
           +-- home Search entry 保持不变
```

binding 不存在是这条投递路径的有效结果；Article/Community 定位失败和真实服务错误仍报告错误，
不能把所有数据库异常都当作“已经删除”。读取当前状态也保证 unmirror 后又 mirror 时，旧任务不会
盲目删除重新可见的 binding。

## 更新后的边界，不兼容旧线上队列

旧版本与新版本的职责位置不同：

```text
旧版本
    +-- 事实任务 ---------> CDN purge
    +-- projections 任务 -> Press / Search / 其它副作用

本批版本
    +-- 事实任务 ---------> 独立 Press / Search / CDN 子任务
    +-- projections 任务 -> 其它副作用
```

若旧事实任务已经完成、旧 projections 尚未完成，更新代码后可能出现：

```text
                         更新代码
                            |
旧事实任务: done -----------+--> 不再分发
旧 projections: pending ----+--> 只执行其它副作用
                            |
                            v
                     旧 Press/Search 可能遗漏
```

**这是明确接受的旧数据边界。** 按本次决策只保证新逻辑正确，不做旧队列兼容、drain、回填、
重放已完成事件或双路径。旧队列/索引不能作为新版完整性验收样本；使用新版生成的新事件与新测试数据。
本批代码不自动删除线上数据，也不把旧任务的完成状态当作新版三子任务已完成的证据。

## Preview fixture 为什么要等待三个子任务

临时 Search sink 只接收隔离 preview 的验收写入。只等待 Press 会让 Search 任务跑出隔离窗口：

```text
时间向下
安装测试 sink
    |
触发 Review 变化
    +-- Press child  --> 完成
    +-- Search child --> 还在排队
    +-- CDN child    --> 还在排队
    |
恢复真实 Search adapter
    |
Search child 开始执行 --> 可能访问真实 Search！
```

本批 fixture 的执行顺序：

```text
隔离的单节点 preview
    |
暂停本地 cms_outbox / press / search / public_cache queues
    |
等待 paused=true 且没有运行中 job
    |
安装测试 sink --> 提交真实 Review 变化 --> 手动分发
    |                                  +-- Press: 必须 done
    |                                  +-- Search: sink 下必须 done
    |                                  +-- CDN: done 或预期 provider 失败并终止
    |
返回三者状态；正常/异常退出都清理合成社区的剩余任务
    |
恢复 adapter 配置，再恢复原本未暂停的 queues
    |
轮询确认四个 queues 恢复到调用前状态，失败/超时不返回成功
```

队列暂停前等待已有 job 完成，避免真实配置与临时 sink 交叉。只处理固定 `press-preview` 合成社区
的遗留 intents/jobs，不取消其它社区任务。预期 CDN 错误为 `cloudflare_rejected` 或
`cloudflare_not_configured`；其它错误不能记为验收成功。CDN 使用最后一次尝试收敛为明确失败，
验收不留自动重试。pause/resume 检查 `:ok`，cancel 检查 `{:ok, count}`；恢复确认结果写入 `queues.before/after`，不是仅凭通知发送成功。清理失败时恢复 adapter，但保持队列暂停供排查，不能直接恢复投递。

该工具仅支持隔离的单节点 preview，不能在生产或多 Machine 部署运行。`:global.trans` 只串行化
fixture 调用，本身不能阻止 Oban worker；实际隔离依靠暂停并等待队列空闲。返回成功只证明
Press/Search 与预期 CDN 状态已收敛，不代表生产 CDN provider 已验收成功。

## Free guard 的统计口径

```text
limit: 1
    +-- 无维度 sum: 全账号聚合一行       <-- daily 查询
    +-- 带 dimensions: 返回分组的一行   <-- 不能当成全账号总量

同一个 UTC 时间窗口:
    无维度全账号 requests
             =?
    按 scriptName 分组的 requests 之和
```

本批已通过只读 Analytics 请求对照，时间窗口 `2026-10-27T00:00:00Z` 至
`2026-10-27T02:04:39.492Z`：无维度返回 1 行、483；按 scriptName 返回 10 组、合计483。
这证明该次查询的聚合口径一致，不是 Dashboard 截图或精确计费额度证明。采样和延迟边界仍保留，
不得添加分组维度后继续假设 daily 的 `limit: 1` 是全账号总量。

route API 复核只覆盖本 zone 的 core routes 及指向 edge-router/auth 的 routes。
`press.groupher.com` 是 Worker Custom Domain，不能用这份 route 清单证明其限额行为；
外部探针验证 origin 的可达性和内容拒绝，不能在未耗尽额度时证明实际 1027 行为。
保持 Free，超限拒绝，不升级、不回退；router 自身被平台拒绝执行时不承诺应用层 503。
