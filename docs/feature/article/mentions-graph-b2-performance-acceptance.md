# MentionsGraph B2 性能验收方案与执行记录

> 本文仅保留设计和历史结论。原始源码快照、测试日志与测量输出已从仓库移除；历史数字不作为当前发布验收证据。

> **历史证据（2026-11-04 至 2026-11-06）：**本文的 set／occurrence／初始化／重建、请求级 SQL 预算及按资源状态裁剪图标题、URL 或边的条款均不适用于 2026-11-07 当前关系实现。现行代码合同见[当前关系合同](./mentions-graph-sync-contract.md)，新目标只用全新空库，不迁 B4 内容。下文原始测量与当时的执行事实保留供追溯，不能作为本轮发布指引。

> 状态：2026-11-06，B2 总性能出口仍未签收；首次成功率缺口保留。用户随后批准全新空库，B4 的目标环境切换已执行，详见[切换手册](../../deploy/runbooks/mentions-graph-cutover.md)。新库无代表性正文，不能将切换成功写成 B2 性能通过；外部候选搜索继续暂缓。

## 2026-11-06 流程决策

先记录并保留并发改版时首次读取成功率不足的证据，继续推进 B4 的准备和隔离演练，不为追求本轮 95% 候选门槛延误流程验证。PG17 标准/大集 paced 领域首试分别为 73/80（91.25%）和 68/80（85%）；限次恢复交互在对应短窗口均为 80/80。独立 review 仍为 `PARTIAL`，不能把重试成功写成首次成功率达标，也不能把本地试跑写成目标容量验收。

B4 的准备和演练先于正式性能资格完成；此段记录当时的流程决策。2026-11-06 实际采用独立新库，旧队列保留在旧分支，旧服务停机后完成快照、镜像与数据库身份核对并开放新服务。正式性能资格证据和首次成功率优化保留为后续工作，不修改原始测量或复核门槛。

## 验收分母

原 3,000 边用例只有少量活体来源，大量 target 仅有 endpoint，保留为单一索引回归，不能独自代表容量。
本轮 [只读 probe](../../../backend/api/scripts/mentions_perf/profile_target.mjs) 经现有 Fly release RPC 进入 `REPEATABLE READ, READ ONLY` 事务，查询计数及 PostgreSQL 设置。
不启动新 release、不执行 migration/initializer，不导出正文、标题、用户 ID 和 URL。默认只查计数；可选 `--body-census` 仅在目标 RPC 进程内遍历当前 JSON，输出长度与已识别语法数量。每条 SELECT 限时 5 秒，事务限时 15 秒。

目标当前为 **33 Article**：Post 29，Blog/Changelog/Doc/Ticket 各 1；**5 Comment**：Post 4、Doc 1。
旧关系 27 行；新 endpoint/set/current-edge/revision 表均不存在。PostgreSQL 为 **17.11**。
这是 canonical 行数，不等同于全部匿名公开且有提及的当前来源数。旧关系不能作为新图边度分布或初始化事实。
额外在目标进程内采样 38 份当前选中正文：JSON 全部有效；Post 长度 p95 为 217 bytes、最大 1,754 bytes，其余类型最大 281 bytes。已识别 `mention` 节点为零，Comment 有 1 个 link 节点。这仅覆盖已声明语法，不执行 canonical 目标绑定，也未验证 anonymous Scope，不能据此断言新图有零边。

| 数据集     | 来源与用途                                                                                                                      | 不足                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 目录校准集 | 精确匹配目标各类型 Article/Comment 行数：33 + 5；本地构造 561 条关系，三社区分布                                                | 仅来源数量校准；边度、公开状态比例、正文长度与真实到达率没有目标证据 |
| 标准压力集 | 每种普通 Article 24、User Ticket 6、Comment 384，共 486 来源、11,241 边；三社区、热点及长尾、隐藏父级、pending 尾部             | 主动放大六类与评论占比，是压力边界，不冒充生产分布                   |
| 大压力集   | `large`：普通 Article 各 96、User Ticket 24、Comment 1,536，共 1,944 来源 / 89,870 边；隐藏父 Article 380，子评论经父级一起过滤 | 与标准集单独执行，不是生产分布声明                                   |
| 正式代表集 | 新图可信来源数、边度 p50/p95/p99/max、社区偏斜、mirror/owner、公开/隐藏/删除/pending、Doc/Comment 比例均有来源；冻结分母与指纹  | 当前缺可信绑定/边度或认可的容量边界，以及相符目标容量环境，尚未建立  |

[fixture builder](../../../backend/api/scripts/mentions_perf/dataset.exs) 通过现有 Commands 创建真实 canonical Article/Doc/Comment/User Ticket，核对 token。
仅 occurrence 在本地离线构造，再用真实 saved-set rebuild 建立当前边和水位；保留 FK、稳定父级及六类 Gate 查询。
不声称这些离线 occurrence 来自目标正文；这不是 writer、捕获或通知正确性证据，相关出口沿用 [联合验收](mentions-graph-doc-comment-joint-acceptance.md)。
没有以重复边或孤立 endpoint 冒充上述 canonical 来源数量。

## 测量与门槛

机器可读门槛在 [acceptance.json](../../../backend/api/scripts/mentions_perf/acceptance.json)。2026-11-06 本轮将下一次测量的候选数字固定为：首次读取成功率至少 95%，writer 事务 p95 不超过 250ms，以及下列读取 p95；测量后不得因结果未达标再改口径。**设计负载到达率、目标容量及纯锁等待阈值仍未冻结**，所以这些数字不是完整生产签收标准；纯锁等待当前只有阻塞证明与粗粒度观测，不冒称已有精确 p95。
当时合同要求 SQL≤32、单条 2,000ms、领域累计 5,000ms；当时的脚本拒绝用配置放大这些硬预算。现行 runner 不再用这些数字裁决，SQL 次数与耗时仍作为观测数据输出。

- 图首批及 cursor、六类十 frontier、双方向一跳 cursor、offset/count/深 offset、Comment 一跳、Doc Comment seeds、revision 分开计量。
- 标准压力集增加实际 Phoenix GraphQL HTTP handler 的图首批及十 frontier，包含解析、序列化及 router；通过 Plug 调用，无 TCP/浏览器/BFF 网络成本。
- 每场景先记录首个测量请求，再 warmup 3 次，本地 pilot 各测量 100 次；输出 p50/p95/p99/max、SQL 次数、Repo queue/query 时间。首个测量请求不等于冷存储；不通过清缓存或重启数据库制造“冷读”声明。
- 下次测量固定的候选 p95：图首批/一跳/seeds 500ms，十 frontier 1,200ms，revision 200ms，writer 事务 250ms。所有错误单独计数，不能丢弃 timeout 后再计算成功率。
- 资格采样每场景每轮至少 1,000 次、独立 3 轮；并发阶段可设置 `CMS_MENTIONS_PERF_LOAD_DURATION_MS=60000` 让所有 worker 持续运行，避免短读取窗口与 writer 尾部空闲混在一起。记录 PostgreSQL major/patch、数据库容量、API CPU、连接池、统计及缓存条件，并先冻结目标读写到达率。单次本机 pilot 不能给生产 p95 容量结论。

### 实际 SQL 与扫描

[采集器](../../../backend/api/scripts/mentions_perf/measure.exs) 从完整请求 telemetry 捕获每一条实际 SELECT/WITH 及其原参数，排除事务控制；Scope/pending/revision/set_config 仍计入 SQL 次数。
在该专用本地库对捕获的全部只读查询执行 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`，不另写简化语句冒充主计划。
这里是在捕获之后重新发起 EXPLAIN，证明同一完整 SQL/参数的计划；不声称它复用了每次请求所在连接的 prepared statement 或 generic/custom 决策。正式同环境验收仍须记录 `plan_cache_mode`，补同连接 prepared/generic 计划核对，不能用单个重规划样本代替全部运行态。
计划及可重放参数保存在 gzip JSON；原生 UUID 二进制参数用 external-term/base64 编码，避免 JSON 损坏，不自动解码不可信文件。

输出每条 SQL 的 Planning/Execution Time、buffer hit/read、temp written、扫描类型/索引、最大及累计 scan work、join work。
scan work 为 `(Actual Rows + Rows Removed by Filter + Rows Removed by Index Recheck) × Actual Loops`。
最大节点工作量、各 scan 节点工作量之和均不等于“唯一物理行数”，不声称整条请求只访问 21/420 行。
解释及统计口径参考 [PostgreSQL 17 EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)。

窗口查询暂用单 scan 节点边表 work 4,200 的复核门槛（10 frontier × 双方向 × 21 lookahead × 10 倍可见性过滤放大）。
这包含 index/bitmap/seq scan，不能只检查索引名称或忽略 index scan 的过滤代价；超限需解释或优化后重跑。
offset count 和深 offset 按根 degree 增长，记录完整工作量与时延，不对它们套用 O(first) 断言。

### revision 锁与有效吞吐

独立连接持有真实 `Revision.bump()` 事务，另一个 writer 等待同一行；通过 `pg_stat_activity` 的 `Lock`/`transactionid` 和 `pg_blocking_pids` 证明阻塞。
在持锁期间执行正常图读，再释放/提交两笔事务。等待 UPDATE 的调用耗时包含执行和传输，不能冒称纯数据库锁等待精确时长。
观察器每 20ms 查询一次，保存阻塞次数/并发数；短于采样间隔的等待可能漏记，不据零采样宣称零锁竞争。
动态统计的事务快照规则见 [PostgreSQL 17 monitoring](https://www.postgresql.org/docs/17/monitoring-stats.html)。观察查询均独立 checkout，不在长事务中反复读取旧快照。

默认另外执行 4 reader + 0/2 writer（每 worker 20 请求，closed-loop）：无持锁延迟、revision 更新后持锁 10ms 的 burst，以及每 writer 500ms 间隔的 paced 诊断。
分别输出 reader/writer 的耗时、成功数、成功率、成功请求延迟、有效吞吐、fence 拒绝及意外错误、pool queue 与锁观察。
全局 revision 变化时 fail-closed 的拒绝是协议行为，但也影响可用吞吐；必须披露，不能把失败快当作性能快。
2026-11-06 用户选择下一轮先沿用这组 **4 reader、2 writer、每 writer 间隔 500ms** 的 paced 诊断负载；它是已确定的候选实验配置，仍不是生产目标流量。这个阶段的 writer 计量是 revision bump，不等于完整发布 Command TPS；完整发布另用 writer load 测量。正式容量仍需代表性目标正文、容量和真实到达率，不能把候选实验的 95% 首次成功率直接签成生产达标。
[复核器](../../../backend/api/scripts/mentions_perf/review.mjs) 独立从摘要和实际计划重算门槛，额外核验 paced 首次成功率；原始采集器的 `local_checks_passed` 只表示读取/锁诊断，不等于该可用性门槛或 B2 签收。当前标准集复核结果为 PARTIAL。

## 可执行命令

仓库根目录只读采集目标分母：

```sh
node backend/api/scripts/mentions_perf/profile_target.mjs /tmp/mentions-perf-target-profile.json --body-census
```

在 `backend/api` 执行，每次自动新建唯一命名的本地库并完整迁移；不 drop、不清空旧库，数据库保留用于核查。
runner 同时校验 `MIX_ENV=test`、`TEST_DB_NAME=groupher_mentions_perf_*`、实际配置库名和 localhost；长时间独立连接实验用正常 pool，避免 Sandbox owner 假串行。

```sh
CMS_MENTIONS_PERF_PROFILE=/tmp/mentions-perf-target-profile.json \
node scripts/mentions_perf/run.mjs catalog /tmp/mentions-perf-catalog

CMS_MENTIONS_PERF_PROFILE=/tmp/mentions-perf-target-profile.json \
node scripts/mentions_perf/run.mjs standard /tmp/mentions-perf-standard

# 同机依次运行，禁止让两个 benchmark 或构建同时争抢资源。
CMS_MENTIONS_PERF_PROFILE=/tmp/mentions-perf-target-profile.json \
node scripts/mentions_perf/run.mjs large /tmp/mentions-perf-large

# 正式候选轮次：在已经确认的隔离环境中按相同命令独立运行三轮。
CMS_MENTIONS_PERF_SAMPLES=1000 CMS_MENTIONS_PERF_LOAD_DURATION_MS=60000 \
node scripts/mentions_perf/run.mjs large /tmp/mentions-perf-qualification-1
```

重测原 fixture 使用它输出的库名和 `fixture.json`，只允许相同本地专用库；校验 current edge 分母未改变：

```sh
MIX_ENV=test TEST_DB_NAME=<fixture.database> \
CMS_MENTIONS_PERF_REUSE=/tmp/mentions-perf-standard/fixture.json \
CMS_MENTIONS_PERF_PER_TYPE=24 CMS_MENTIONS_PERF_SAMPLES=100 \
CMS_MENTIONS_PERF_OUTPUT=/tmp/mentions-perf-standard-repeat \
mix run --no-start scripts/mentions_perf/run.exs
```

完成采集后独立复核，返回 2 表示候选门槛未通过，原始测量文件现已移除，以下仅保留历史结论：

```sh
node scripts/mentions_perf/review.mjs /tmp/mentions-perf-standard
node --test scripts/mentions_perf/review.test.mjs
```

本机已有 PostgreSQL 是 14.23，与目标 17.11 不一致；当前没有 Docker/PG17，故不能以本机结果消除此差异。
[PG17 compose](../../../backend/api/scripts/mentions_perf/postgres17.compose.yml) 已准备，绑定本机 5547、独立 volume 和容量限额，不挂载目标库：

```sh
docker compose -p mentions-perf -f scripts/mentions_perf/postgres17.compose.yml up -d --wait
TEST_DB_PORT=5547 node scripts/mentions_perf/run.mjs standard /tmp/mentions-perf-pg17
```

这份 compose 未在本机执行，2 CPU/1GiB 也不等于目标数据库 SKU；正式签收必须记录实际 image digest、server version 与目标容量对应关系。
不把该命令变成 B4 的目标初始化或切换命令。

## 本轮证据与保留出口

证据存放于 目录 和 inventory §9.40；各 pilot 独立运行，没有并行 benchmark 或构建争抢资源。

| 本机 pilot（每读取场景 100 次）                  | 标准集       | 大隐藏来源集   |
| ------------------------------------------------ | ------------ | -------------- |
| 来源 / 边                                        | 486 / 11,241 | 1,944 / 89,870 |
| HTTP 首批 p95                                    | 442.614ms    | 439.128ms      |
| HTTP 十 frontier p95                             | 802.476ms    | 815.879ms      |
| 最大 SQL 次数                                    | 22           | 22             |
| 图首批最大边表 scan 节点 work                    | 366          | 1,109          |
| 图首批全部 SQL 的 scan work 之和（有重复）       | 13,154       | 45,046         |
| 十 frontier 全部 SQL 的 scan work 之和（有重复） | 64,441       | 221,028        |
| offset count 最大边表 scan work                  | 485          | 1,943          |
| paced 读窗口内实测 revision 完成速率             | 4.29/s       | 5.19/s         |
| paced 首次读取成功                               | 72/80 = 90%  | 68/80 = 85%    |
| paced writer 事务 p95                            | 6.834ms      | 15.808ms       |
| 独立 review                                      | PARTIAL      | PARTIAL        |

两套读取/扫描/锁诊断技术门槛通过，**首次成功率候选门槛未过**。读写速率是短窗口实测值，不能把配置的 500ms 间隔当作准确稳态吞吐；95% 仍为建议 design-load 口径。
目录数量校准集的 11 个领域场景也各采样 100 次，图首批 p95 347.859ms、十 frontier p95 452.833ms；该早期记录不含两项 HTTP handler 场景，不冒充完整 13 场景签收。
第一次标准集 HTTP 首批 p95 为 502.026ms，略超建议 500ms；原失败基线 保留，不删除失败样本或放宽阈值。后一次是补齐并发统计后的重复测量，不宣称吞吐提升来自业务优化。

- 标准集：摘要、完整计划、复核。
- 大压力集：摘要、完整计划、复核。
- 目标：只读计数、仅聚合正文语法 census。
- 持续时长控制验证：新进程 4 阶段各请求 2 秒并运行到截止点，所有 worker 持续发起请求，标记 `load_only`、不签收完整 pilot。该新进程没有完整预热，不拿它与热态成功率横比；60 秒正式时长尚未执行。
- 功能恢复后 171 项通过；复核器 4 项测试覆盖隐瞒 fence 拒绝、原始假通过标志、漏测场景与本地误签收风险。

曾尝试把双向窗口的可见来源共用为 materialized CTE；3,000 边回归发现该形状会退化为全邻域扫描，原索引断言阻止了它。原型已撤回，原断言和原窗口查询保留；不把后续测量波动宣称为该优化收益。恢复后的同组 171 项全部通过。
所有本地 runner 无论诊断门槛是否通过，都明确输出 B2 总性能未签收；没有根据一个布尔标志冒充代表性已确认。
剩余正式出口为可信新图分布或认可的容量边界、相符数据库环境/容量、约定到达率及充分样本的同环境验收。可以在独立 PG17 数据库用离线可信解析/匿名化分布建立代表集并签收 B2，**不要求先在生产建立新表，也不依赖 B4**。
以下为当次性能复核的历史环境限制：本机没有 PG17/Docker；Neon 插件当时需重新认证，因此该轮未新建、迁移或删除 Neon 资源。2026-11-06 插件重新连接后，用户另行批准全新空库 B4 切换，已新建 Neon 分支并迁移；这不补足本节代表性性能证据，也不是 maintenance Auth 故障。

### 版本冲突后的完整交互诊断（2026-11-05）

针对 paced 写入时首次读取被全局 revision fence 拒绝，当时前端 MentionsGraph 的无 cursor 首批请求仅在错误码 4553 时再发一次；cursor 错误码 4551/4553 会丢弃已展开页并从首批重新读取，在当前版本/内容周期内每个视图作用域最多自动重启一次。权限、预算和传输错误当时不自动重试；卸载后的 AbortSignal 仍生效。当时每次服务端请求独立遵守 32 SQL / 5 秒硬预算；完整交互记录请求总数、成功率及端到端时间。这是历史测量规则，不适用于当前 runner。

同一标准集、本地 PostgreSQL 14.23、4 reader + 2 paced revision writer、每阶段持续 10 秒的独立诊断见原始摘要。此轮使用已有受控 486 来源 / 11,241 边 fixture；读窗口中两阶段均实际完成约 3.97 次 revision 更新/秒。单次 HTTP 请求 563/632 成功（89.1%），最多 13 SQL，p95 86.762ms；限一次重试的完整交互 573/573 成功，其中 52 次发出第二请求，交互 p95 113.04ms，每次请求最多 13 SQL、最慢 121.551ms。两阶段顺序执行，成功率和延迟是各自观测值，不能把差额当成严格配对的因果效应。重试组最多 26 SQL 是**两次请求之和**，不是单次超预算；最大交互耗时 185.099ms。

前端定向 18 项覆盖首次冲突限次重试、cursor 作废后回到首批、永久失败隐藏缓存图、手动恢复与取消。此 10 秒 `load_only` 诊断不含 13 个完整读取/计划场景，也不是正式 3 次独立、每场景 1,000 样本的同环境验收。原始首次成功率和原先的 PARTIAL review 保留；95% 建议值、目标负载到达率、目标图分布及数据库容量仍待确认。PG17 的隔离获取只准备本地瓶颈验证，不会触发 B4。

随后以相同受控集各持续 60 秒，只选两个 HTTP 阶段，运行原始命令中的 `CMS_MENTIONS_PERF_LOAD_ONLY=1 CMS_MENTIONS_PERF_LOAD_PHASES=http_paced_single,http_paced_restart_once CMS_MENTIONS_PERF_LOAD_DURATION_MS=60000`。60 秒原始摘要保留了所有结果：

| 指标                   |              单次 HTTP |    限一次重试的完整交互 |
| ---------------------- | ---------------------: | ----------------------: |
| 成功 / 总数            | 2,871 / 3,241 = 88.58% |  3,494 / 3,506 = 99.66% |
| revision 拒绝          |                    370 |        12（两次均拒绝） |
| 实际完成 revision 更新 |              约 4.00/s |               约 4.00/s |
| p95 耗时               |               87.733ms |               126.306ms |
| 每次服务端请求最多 SQL |                     13 |                      13 |
| 每次服务端请求最慢     |              686.415ms |               288.913ms |
| 完整交互请求数         |                  3,241 | 3,886（380 次第二请求） |

这仍是顺序运行的两组本地 PG14 测量，不能宣称个体请求配对或目标负载匹配。第二组完整交互最多 26 SQL、最长 361.959ms，分别是两次请求合计；当时单次请求的 32 SQL / 5 秒硬预算保持原值；现行 runner 不沿用该门槛。独立复核分别列出单次与完整交互成功率，维持 `PARTIAL`，不会用恢复成功掩盖首次失败。`load_only` 和仅选两个阶段会强制 `local_checks_passed=false`，不能借这组较长测量掩盖缺失的 13 场景完整计划。下一步应把正式成功率口径明确约定为“首次请求”还是“限次恢复后的完整交互”，并同时报告两者；99.66% 只满足本机此负载下的候选交互口径。

真实 Community Post 路由的[浏览器恢复检查](../../../frontend/e2e/scripts/mentions-graph-recovery-check.js)也在新的本地独立 Phoenix fixture 上通过：请求序列与边界。第一次注入 4553 后只重发一次无 cursor 首批；第二次用真实 API 首批响应附加一条测试边和过期 cursor，注入 4551 后只请求一次旧 cursor，随后回到真实 API 首批并收敛。其余 GraphQL 查询走真实本地 API。`/home/xx` 在该 fixture 下返回 404，因此使用同一 `home` 社区、作者 `xx` 的实际 Post `/home/post/3`；未把 mock API 的页面级 500 算成 MentionsGraph 失败。

### 隔离 PostgreSQL 17.11 同主版本 pilot（2026-11-05）

本机以校验过 SHA-256 的 Homebrew PG17.11 bottle 解压到任务专用 `/tmp`，将 [pg_roaringbitmap 上游源码](https://github.com/ChenHuajun/pg_roaringbitmap) `v1.2.0` 针对该 PG17 编译到同一临时目录。由于 bottle 的共享数据、扩展与头文件路径在编译时固定，仅为本次本地运行在原先不存在的 `/opt/homebrew/{share,lib,include}/postgresql@17` 建立三个指向该临时目录的符号链接；没有安装 Homebrew formula、注册服务或连接目标库。服务仅监听本机 127.0.0.1:5548。二进制 SHA、扩展 commit、本机 CPU/内存与数据库参数见环境证明；**本机 8 核/16GiB 与目标数据库容量没有建立等价关系**。

测量完成后已停止该本地 PG17 进程，按原链接目标核对并删除上述三个临时符号链接；5548 无监听。任务专用 `/tmp` 数据目录保留供复核，未清理其他数据库或服务。

在该 PG17.11 上新建专用空库、完整迁移、重建标准受控集后，13 个读取场景各取 100 次并保存完整 `EXPLAIN (ANALYZE, BUFFERS)`：原始摘要、完整计划、独立复核。HTTP 首批 p95 396.3ms、六类型十 frontier p95 899.271ms，最大单次 22 SQL；13 场景的本地延迟/SQL/扫描门槛全过。控制性锁测试观察到 revision 更新等待 41.159ms，持锁期间读取成功。review 显式关联之前的目标只读 profile并保存其 SHA；PG 主版本不符已不再是 blocker。

从 `backend/api` 运行标准集与独立复核的命令如下；第二个路径只读，review 同时保留原始 summary 与目标 profile 各自的 SHA，不改写测量摘要：

```sh
TEST_DB_PORT=5548 node scripts/mentions_perf/run.mjs standard /tmp/mentions-perf-pg17-standard-verified
node scripts/mentions_perf/review.mjs /tmp/mentions-perf-pg17-standard-verified /tmp/mentions-perf-target-profile.json
```

该 PG17 标准 pilot 的 paced 领域读取首试 73/80（91.25%，窗口实际更新约 4.71/s）；独立 HTTP 单次 76/80（95%，约 5.44/s）；限次恢复的 HTTP 完整交互 80/80，6 次发出第二请求（约 4.98/s）。各组是顺序运行的短窗口、写入速率有差异，不能合并分母或宣称 100% 稳态可用。独立 review 维持 `PARTIAL`：目标容量和正式到达率未约定，受控图不是目标当前正文解析出的图，也缺三轮每场景 1,000 样本。该 PG17 证据只消除了数据库主版本差异，不签收 B2 总出口。

同版本大隐藏来源集也以新空库完成：原始摘要、完整计划、独立复核。1,944 来源 / 89,870 边、380 隐藏父 Article；13 个各 100 次读取场景的本地门槛全过，HTTP 首批/六类型十 frontier p95 为 420.527/899.854ms、最多 22 SQL，非 offset 场景最大边表 scan work 1,109。控制性锁等待 82.3ms，持锁读取通过。paced 领域首试 68/80 = 85%，HTTP 单次 73/80 = 91.25%，限次恢复交互 80/80、8 次第二请求；短窗口实际 revision 完成速率分别约 4.13/4.98/4.01/s。大集 review 同样为 `PARTIAL`，不把短窗口恢复 100% 当正式可用性承诺。

PG17 标准集又执行了只含两个 HTTP 阶段、各持续 60 秒的测量：原始摘要、独立复核。单次阶段 3,165/3,513 成功（90.09%），限一次重试的完整交互 3,928/3,928 成功，276 次发出第二请求；两阶段实际 revision 完成速率均约 4.00/s。单次阶段 p95 79.553ms；重试交互 p95 102.612ms、最长 208.298ms，单次服务端最多 13 SQL、最慢 186.123ms。两组顺序采集，仍非请求级配对；0/3,928 失败不能外推为零失败保证，PG14 同方法的 60 秒对照仍有 12/3,506 次双重拒绝。`load_only` 明确排除完整 pilot 13 场景，不补齐目标容量、代表图、正式到达率和三轮充分样本。

三轮正式采样的本地执行器为 [qualification.mjs](../../../backend/api/scripts/mentions_perf/qualification.mjs)。在 `backend/api`、本机 PostgreSQL 满足主版本要求时运行：

```sh
node scripts/mentions_perf/qualification.mjs /tmp/mentions-graph-qualification [target-profile.json]
```

它顺序创建三个独立的本地标准集数据库，每轮 13 场景各采样 1,000 次，并保存每轮的 summary、plans、review 和总表 `qualification.json`。数据库会保留供复核；脚本使用本地数据库，不连接目标库。标准集的 occurrence 仍由本地 fixture 构造，因此即使三轮本地门槛全过，总表也会保持 `PARTIAL`，直到补齐目标正文图或认可容量包络的来源证明、目标数据库容量和约定负载证据。脚本正常结束表示采样完成，不代表 B2 签收。

## 2026-11-06 同步关系重构后的本地复测（不替代 B2 资格）

本地工作区已把正文与当前关系改为同一事务，旧 `mention.set_project` 作业移除，通知 Outbox 保留。用隔离、全新迁移的本地数据库运行 `node backend/api/scripts/mentions_perf/writer_load.mjs /tmp/mentions-writer-load-20261106`：2 个 writer、4 个 reader，40 次完整 Article 发布，reader 同时连续读公开图；结果存于 `/tmp/mentions-writer-load-20261106/load.log`。40/40 发布成功，writer p95 **163.608 ms**；读请求首次成功 **3459/3605 = 95.95%**，reader p95 **21.939 ms**。聚焦 SQL 预算测试的图页为 11 条 SQL，列表为 11–12 条（不同 GraphQL 入口）。空库完整迁移在独立数据库 `groupher_mentions_migration_check_20261106` 通过，包含新 `mention_current_sets` 迁移。

这次复测仅说明所用本机数据库和负载未越过候选的 writer p95 250 ms、首次成功率 95% 门槛。它不是 PG17 目标容量、正式到达率/分布、锁等待阈值、三轮每场景 1,000 次或生产数据驱动验收。原异步/同步原型对照记录不能再用当前 `mentions_projection_mode` 参数复跑，因为生产写入已固定为同步；当前脚本只测新实现，不再输出虚假的模式对照。B2 总出口继续为 `PARTIAL`。

**本轮代码的本地复测（2026-11-06）：**以同一 `writer_load.mjs` 在新的隔离 PostgreSQL 14 本地库执行 40 次完整 Article 发布，40/40 成功，writer p95 160.333ms；同时的图读取首次成功 2915/3056（95.39%），reader p95 24.374ms。机器可读摘要保留命令、分母及缺口。它是候选阈值下的短窗口诊断，不证明 PG17 容量。当前机器没有 Docker 或本地 PG17；三轮本地资格脚本虽然可运行，但在这台机器上无法满足与目标同主版本的前提。目标库只有 6 个有边来源、最大出度 22，也不足以作为大图分布；目标到达率与纯锁等待阈值尚待确定。因此 B2 仍为 `PARTIAL`。

曾启动 `qualification.mjs /tmp/mentions-graph-qualification-20261106-go` 检查执行器；第 1 轮在隔离 PG14 库建立 486 来源、11,241 边，并完成首个 1,000 样本场景（HTTP 图首批 p95 291.014ms、最多 12 SQL、通过候选阈值）。由于该环境不能满足 PG17 与代表图前提，后续长采样无法签收 B2，已主动终止；`qualification.json` 未生成，**不计作三轮中的任何一轮**。本地第 1 轮数据库与 `/tmp/mentions-graph-qualification-20261106-go/run-1` 日志保留供检查。

后续又在新建的本地 PG14 隔离库运行当前 `run.mjs smoke` 与独立 `review.mjs`。13 个读取场景各取 5 次，全部满足这次短样本的 SQL、延迟与扫描门槛；并发 revision 阶段的 paced 首次成功率为 95%，HTTP 单次为 98.75%，限一次恢复交互为 100%。复核器明确输出 `pilot: PASS`、`b2_performance_accepted: false`，缺口包括目标容量/到达率、PG17 主版本、真实正文图分布和三轮充分样本。证据保留于 `/tmp/mentions-sync-perf-smoke-20261106`，其中 `summary.json` SHA256 为 `2ac8b71a145c06890a90ac38fec62c556a14bcecec9477ca7f8d4e635948c275`；这次 smoke 仅证明旧执行器在同步版本上能完整运行，不能合并入正式资格分母。

### Command 边界调整后的本地复测（2026-11-06）

使用同一 `scripts/mentions_perf/writer_load.mjs`，在新的隔离 PostgreSQL 14 本地库运行完整 Article 发布与图读取：writer 40/40 成功，p95 173.119ms；4 个并发 reader 首次成功 3732/3868（96.48%），p95 22.891ms。原始日志保存在本机 `/tmp/mentions-writer-refactor-20261106/load.log`，实验数据库在保存原始日志后已删除，未连接目标 Neon。该样本只对应这次 Command 边界调整后的短窗口诊断；与前次 160.333ms、95.39% 是两次独立运行，不能当作严格配对的性能增益，也不包含目标 PG17 锁等待或 B2 正式三轮资格。B2 状态仍为 `PARTIAL`。
