# Docs 公共读取 Scope 实施与验收记录

> 状态：本地 R0–R3 实施与专项验收完成，17 文件 173 项通过；未部署，目标环境刷新 / 外部缓存仍须发布时核验。2026-11-16。
>
> 依据：[专项合同](./docs-public-read-scope-fix.md)、[R0 及隔离库准备](./docs-public-read-scope-r0.md)。本文记录实际代码与证据，不拥有 Mirror Fix 整体产品合同，不表示 D2 完成。
>
> 环境：`doc-redesign` 工作区，使用 `groupher_docs_public_read_r0_20261116`，localhost:5432。现有 dev/test 库及参考库只做只读基线核对，未迁移或写入。工作区已有其他未提交变更，未提交、推送或部署本次修改。

## 1. 已完成的实现

| 路径                                                                                               | 最终行为                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Gate.Scope.Article](../../backend/api/lib/groupher_server/cms/gate/scope/article.ex)              | 仅 `%DocContext{}` 且 policy_mode: public 的 public stage 新增两个相关 EXISTS：本行 Community 的 public page，以及与当前 Public article_id / snapshot_id 相同的 Body。保持管理 / insights / draft、Review actor 差异和其他 thread 的既有合同 |
| [FrontDesk.Article](../../backend/api/lib/groupher_server/cms/front_desk/article.ex)               | 删除 public_doc_page? 后置查询。无本站 page 在 Scope 内成为未匹配，返回 article_not_found / 6008，消除 false 未匹配的 WithClauseError 路径；Public.current 失败映射保持现状                                                                  |
| [Locator](../../backend/api/lib/groupher_server/cms/articles/query/locator.ex)                     | 删除额外 tree join，复用 Scope；有效重复地址和顺序仍保留，不可见地址省略                                                                                                                                                                     |
| [Pagination](../../backend/api/lib/groupher_server/cms/articles/pagination.ex)                     | 继续经 Binding ID 子查询消费 Scope；删除公共 public_tree 开关、树分支及 pinned 相关传递。旧调用残留 option 也不能关闭条件                                                                                                                    |
| Pagination fingerprint                                                                             | 保留原五元组，tree 位内部固定为 thread == :doc。普通 Post / Blog / Changelog 原默认 false 字节不变；旧 Doc false 为 4203，旧 true 保持原绑定兼容                                                                                             |
| [Press.Query](../../backend/api/lib/groupher_server/cms/press/query.ex)                            | 删除单读后置树 exists 及列表 public_tree 传递，详情 / feed / manifest 共同消费 Scope；没有逐行新增 Gate 或树查询                                                                                                                             |
| [PublicReadReport](../../backend/api/lib/groupher_server/cms/articles/query/public_read_report.ex) | 独立报告 Doc Body 缺失、版本不匹配、无 Public 的孤立 Body、Snapshot 缺失与 Doc extension 缺失；输出社区 / 作者计数刷新候选，既不回退历史正文也不自动修复                                                                                     |
| [Mix 报告入口](../../backend/api/lib/mix/tasks/docs.public_read.report.ex)                         | `mix docs.public_read.report --json`，拒绝 MIX_ENV=prod，仅启动 Repo 依赖；输出实际 database / migration_version / elapsed_ms，不迁移、不更新计数、不重建 Body、不清外部缓存                                                                 |

Gate README / V5 入口已补当前读取实施说明及合同链接，历史 branch / owner 说明不再被当作当前读取实现依据。没有新增公开 Scope facade、请求 Community 参数、feature flag、schema / DDL、GraphQL 字段或前端状态管理。额外过滤没有施加到 management / insights，BindingPersist 的 Doc 不可达边界保持不变。

## 2. fixture 与针对性覆盖

[双站 fixture](../../backend/api/test/support/docs_public_read_fixture.ex) 仍通过真实 Seeds.Docs 命令在 X 发布两篇 Doc，再在 Y 建立 peer Binding；Y 没有公开 page。原 R0 冒烟文件已转为 [DocsPublicReadScopeTest](../../backend/api/test/groupher_server/cms/articles/docs_public_read_scope_test.exs)，更新了整改前断言，不再要求 Y 的泄漏基线继续成立。

初版专项 15 个数据库用例直接覆盖如下场景；本轮复核增加双向地址、投影诊断、手工 meta 差异、跨进程 telemetry 隔离及 task 验收，最终数量见下方复核记录：

- 双站关系 / 编号 / 当前 Body；Y 列表 count / entries 为空，X 保留，两类 actor 和遗留 true / false option 均不能绕过。
- 真实旧五元组 false cursor 在当前代码返回 namespace:pagi、reason:cursor_query_mismatch、code:4203；true 绑定继续续页，profile 的 author / pinned 位分别验证。
- docPage 与 pagedPublishedDocs 的 GraphQL 签发、续页、4203 和无 after 首屏重取，协议不泄露服务端 atom reason。
- 单读 6008、批量顺序 / 重复地址、Press Markdown；查询捕获证明树 SQL 仅在统一 Scope 的 EXISTS 内，不再有单篇后置树查询。
- public SQL 含 tree / Body；owner_management / insights SQL 不含新增条件，Y 的管理单读正常；draft SQL 不误加公共条件。
- Sandbox 内临时缺 Body / 错 Snapshot 的失败关闭，报告能定位被 Scope 排除的数据；无 Public 的 Body 亦可独立诊断。坏状态不提交，不禁用约束。
- hidden page 保持直读，导航隐藏；普通三个 thread 的指纹与旧默认 false 精确相同。
- 社区 count、作者 count、索引 sync_binding、status 和 snapshot summaries 的 X/Y 语义；公共评论读 Y 不放行，mentioned_target 保持独立规则。
- count manifest 不自动修复；显式使用既有更新入口后，社区 / 作者差异消失，但 Body 完整性问题仍可报告。
- Press feed / manifest 的 Y 空集合及 X 正文投影。

覆盖证据不能混用，17 文件回归通过不等于专项用例覆盖了矩阵每一行：

| 证据类型                           | 实际范围                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本专项直接新断言                   | 双站单读 / 批量 / count / entries、两个 cursor API、Press、hidden 导航、management / insights、Body 与 extension 诊断、作者 / 社区计数、sync_binding、status、summaries、公共评论；复核新增两站相同 inner_id 指向不同 Article 的双向断言 |
| 既有测试回归 + 未改消费方代码      | Gate / FrontDesk / Locator / Pagination / PublicBody / codec、共享评论、Snapshot、社区 count、Upvotes / CollectFolders、Mention endpoint / Doc Comment 联合测试；这些既有用例并非全部具备新的 X-vs-Y fixture                             |
| 源码继承，无本轮专门 X-vs-Y 新断言 | DocCover、ArticleStats、Capacity、Articles.Query.Mentions / Mention 重建及完整 Article 索引重建；通过统一 Scope / public_binding_ids 继承条件，不宣称 15 个新用例逐项直接覆盖                                                            |
| 结构性保证与边界                   | 同站 public page doc_id 唯一由索引保证，EXISTS 兜底；当前外键禁止缺 Snapshot，测试断言拒绝并核对报告 SQL 的 owner-pair LEFT JOIN / NULL 分支，未禁用约束造旧坏库                                                                         |

评论读 fixture 通过 before_bind hook 在单站创建评论，再建立 Y Binding。实际验证仍发现既有 Doc 评论创建的 Mention 唯一历史归属假设：多站点之后创建可能返回 comment_mention_owner_missing_or_ambiguous。它属于 Mirror Fix D2 写入整改，本次没有修复，也没有靠修改生产写入代码使读取用例通过。

## 3. 实际运行的验证

所有后端命令显式设置：

```bash
MIX_ENV=test TEST_DB_NAME=groupher_docs_public_read_r0_20261116 TEST_DB_PORT=5432 \
  ASSETS_PUBLIC_ENDPOINT=https://assets.test CI=true mix test <下列文件> --seed 0
```

最终组合运行的文件（路径相对 backend/api）：

```text
test/groupher_server/cms/articles/docs_public_read_scope_test.exs
test/groupher_server/cms/gate/scope/article_test.exs
test/groupher_server/cms/gate/scope/comment_test.exs
test/groupher_server/cms/press_test.exs
test/groupher_server/cms/articles/pagination_test.exs
test/groupher_server/cms/articles/query/locator_test.exs
test/groupher_server/cms/front_desk_test.exs
test/groupher_server/cms/articles/public_body_test.exs
test/helper/orm/pagi_cursor_codec_test.exs
test/groupher_server/cms/comments/shared_doc_test.exs
test/groupher_server/cms/snapshot_test.exs
test/groupher_server/cms/communities/count/update_count_field_test.exs
test/groupher_server/accounts/upvotes/reacted_articles_test.exs
test/groupher_server/accounts/collect_folders/pagi_test.exs
test/groupher_server_web/query/cms/articles/list/paged_docs_test.exs
test/groupher_server_web/query/cms/artiment_mentions_test.exs
test/groupher_server/cms/mentions_doc_comment_joint_test.exs
```

初版共享工作区组合运行结果为 166 passed、exit 0（90.7 秒）；本轮 HEAD + 独立代码补丁组合运行结果为 173 passed、exit 0（110.6 秒）。`mix compile --warnings-as-errors`、指定文件 `mix format --check-formatted`、`mix lint.style`、`mix lint.context`、`docs:check` 完整脚本链及 `git diff --check` 均通过；Context 报告 0 findings。根目录 pnpm 启动器受当前工作区包管理器变更影响，本次按 package.json 展开执行 docs:check 全链，exit 0，日志位于 /tmp/docs-public-read-docs-check.log；此前分组 80、53、46 项均通过，存在重复用例，不能直接求和为独立用例数量。早期两处 SQL 大小写断言、alias / inline-do 风格问题已修正；没有通过修改业务准入来迎合错误断言。

未改 schema / generated 文件，未运行 schema/codegen 或前端 type-check；没有把静态门禁作为业务集合证明。没有执行整个 backend suite 或生产 / 外部平台测试。

## 4. HTTP 与真实页面

浏览器验证遵循 fe / Playwright 流程，使用任务库的 xx 社区与隔离第二站 yy-r3。独立 Community host 的实际路由为 `/xx/doc/...`；没有为了旧的 `/home/xx` 路径描述新增路由或改写产品入口。

临时 Phoenix 使用 14031，Community 使用 13007，均指向任务库；没有启动默认 Dev Hub 服务。任务库为这次验证保留两篇正常 Public Doc 及两站 Binding，浏览器不是在回滚掉的测试身份上运行。

| 验证                 | 实测                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| X 详情               | 正文、目录和标题正常渲染，截图 `.playwright/docs-public-read/x-public.png`                                                                                                     |
| Y 无公开 page 的详情 | FrontDesk / GraphQL 返回 6008；Community 现有 loader 再取 status，页面显示标题与 Content unavailable 状态卡，不显示正文；截图 `.playwright/docs-public-read/y-unavailable.png` |
| 真实 HTTP Doc 列表   | X entries/count=2，Y entries/count=0；GraphQL HTTP 为 200，业务错误与 HTTP 状态分开判断                                                                                        |
| 真实 HTTP 旧 cursor  | 两个 API 均签发当前 cursor；用同环境密钥签发旧 false 五元组，网络请求返回 extensions.code=4203，移除 after 后首屏重取成功                                                      |
| HTTP 证据            | `.playwright/docs-public-read/http-acceptance.json`，只保存 API、状态码和条目数，不含签名密钥或 cursor token                                                                   |

HTTP 旧 cursor 验证是请求层协议验证，不证明仓库外客户端或不存在的 Doc 列表 UI 已实现自动恢复。当前仓库仍未找到实际 Doc cursor 产品 UI 调用。此结论来自 R0 的手写源码 / operation 调用检索，不来自浏览器穷举；浏览器只验证本文列出的 X/Y 详情。

用户已确认保留 Y 的既有 Content unavailable 状态卡展示，不要求页面 HTTP 404；后端 6008 与不渲染正文均通过。Review / restricted-resource 的展示逻辑保持现状。

临时浏览器会话及两个监听进程已停止，13007 / 14031 已无监听；任务库保留供继续验证。默认 dev/test 库不作为该页面的数据源。最终只读复核 dev / test / 参考库的最高 migration 和 PublicBody 表基线均与准备前一致；此核对是 schema 基线核对，不宣称全库数据逐字节比对。

## 5. 计数刷新与诊断操作顺序

报告是全库扫描，没有 thread / community 参数，耗时随 Doc、Community、User 数及目标 I/O 增长，不能从小 fixture 外推生产耗时。优先在有当前 schema / 数据的副本或隔离拷贝上运行，以输出 elapsed_ms 及外部计时评估实际成本；本地两篇 Doc 小样本报告扫描为 55ms（不含 VM / Repo 启动），仅作本机样本记录，无生产耗时承诺。MIX_ENV=prod 被拒绝，使用非 prod 配置显式指定副本连接；仅启动 Repo 及其依赖，不启动 Endpoint / Oban 应用树。先确认输出 target.database / migration_version，再使用报告。

在本任务隔离库运行：

```bash
MIX_ENV=test TEST_DB_NAME=groupher_docs_public_read_r0_20261116 \
  ASSETS_PUBLIC_ENDPOINT=https://assets.test mix docs.public_read.report --json
```

报告按 issue 输出，不按 Article 去重：旧库同一 Article 可同时报 snapshot_mismatch / snapshot_missing 等多条原因，消费方按 article_id 聚合并保留全部 issue。JSON 同时输出 target.database、target.migration_version 和 elapsed_ms；任务库健康数据实测返回三个空列表：projection_issues、community_counts、author_counts。空结果不代替损坏 fixture 测试；专项用例已分别制造并识别 body_missing / snapshot_mismatch / public_missing / extension_missing；snapshot_missing 通过查询形状与当前 FK 拒绝验证，未在完整约束下伪造可提交的缺 Snapshot。报告并非对所有投影失败的穷尽证明：Snapshot 结构损坏、资产读取等仍由投影层报告。

报告中的社区期望值保留 Communities.Count 的 ordinary Trash 排除，作者期望值保持原按 Scope Binding 行统计，不强行统一去重单位。后续目标环境放行顺序：

1. 核对 schema / 双向 FK、显式目标库和客户端兼容；先保存 report 输出及目标标识，不对默认旧库自动迁移。
2. projection_issues 非空时先定位原因，不把数据损坏当权限拒绝，也不从旧 Snapshot 自动补正文。Public.rebuild 仅是已有的显式事务写入能力，本任务没有对外部环境执行它。
3. 复核 community_counts / author_counts 中的目标；通过既有 `CMS.Communities.update_count_field(community, :doc)` 与 `Accounts.publish_update_states(user, :doc)` 重算当前值。更新入口重新查询当前集合，不把报告里的旧数字直接写回。本地专项已验证这两条路径。
4. 按既有 Outbox / cache tags 安排受影响站点、作者摘要和实际外部缓存失效，重新报告差异并验证页面。清缓存不等于重算，计数重算也不等于外部缓存已清空。

本次只在 Sandbox 验证刷新路径；没有执行目标生产环境全量重算、Search 删除身份改造、CDN purge 或发布。后续 Mirror Fix 的 Binding 清理 / Trash / 发布拆分仍按 D2 合同，不属于本次完成范围。

## 6. 本地完成与发布时事项

- R1：本地已实现并通过专项集合 / SQL / 非 Doc 回归。
- R2：四个消费方已收口；旧指纹字节与两个 API 的 4203 协议已验证，未新增未接线的前端恢复 helper 或产品 UI。
- R3：独立诊断、计数刷新路径、消费者测试、真实 HTTP 与页面行为已验证；本地可验证证据不等于首次生产放行。
- 用户确认没有已知外部 Doc cursor 消费者，仓库亦无运行时 Doc cursor UI。两个 API 已通过请求层 4203 / 首屏重取验证；没有宣称不存在的客户端已支持自动恢复。后续新接入或发现的客户端应按专项合同补验。
- 用户确认 Y 页面保留 Content unavailable；该展示与不输出正文已通过，不要求 Doc host 返回 HTTP 404。
- 真正目标环境的计数刷新 / Search / CDN 状态和生产 URL 未验收。当前未部署，不能宣称专项或 Mirror Fix D2 已完成生产验收。

回滚本次读取代码需整体 revert Scope / 消费方 / 指纹变更，会恢复原缺口并改变 Doc cursor 绑定；无 DDL、无双写、无 feature flag。该回退说明不能用于后续 Mirror Fix 写入 / schema 直切。

## 7. 复核修复与提交边界

本轮不改变 Scope 谓词或对外错误协议。helper 改名为 doc_public_read_scope，注释明确 Public/Body 对齐的准入边界、docs_tree_nodes 四字段及唯一索引依赖；队列切换必须维持这些语义。PublicReadReport 增加 snapshot_missing / extension_missing；extension 缺失仍沿用 article_snapshot_projection_missing，经 GeneralError 归为 unexpected_error；Community loadDoc 抛错，而该场景的 READABLE status 不产生状态卡，最终进入路由错误边界。本批保留该服务器错误协议，不映射成 6008。PublicBody 缺失和投影完整性不是同一判断。

变更说明：public_tree 已删除为有效公共开关；遗留调用继续传入时被忽略，不能关闭必需条件。非 Doc 的原默认 false 指纹仍保持不变。

提交须按以下边界分别进行，不得执行 git add .：

1. 公共读取实现 / 验收：Scope、Pagination、Press、报告与 task、专项测试 / fixture、两处计数公式注释、两份 Gate 文档、专项合同 / R0 / 实施记录；迁移索引仅选公共读取条目。R1/R2 必须保留在同一代码提交，不能把删除消费方条件与 Scope 分开。
2. 既有设计合同：Mirror Fix 等合同及它们的跨文档引用，独立整理；迁移 README 中 Passport / History / Mirror 的条目不能整块混入读取提交。本文不提交其他任务的合同变更。
3. 发布队列重构：QueueAccess / QueueRelease / Release / Lifecycle / Trash、模型删除、seed 及关联测试，另行验证与提交。其测试结果不能使用本读取专项的 166 项旧结果作替代；更改树形状时必须重跑读取集合验收。
4. 包管理 / 生成文件 / 前端 / 其他文档及工具噪声：均留给各自任务，不纳入公共读取回滚。

本轮只修复并生成独立代码补丁供复核，不改共享暂存区，不提交或推送无关任务。补丁验证需说明是共享工作区还是只含 HEAD + 公共读取补丁的导出目录，避免把两者混称为独立提交已通过。

### 7.1 上轮运行证据（交付物已作废）

- 工作区专项已从 15 增至 22 项，22/22 通过；初次 FK 用例使用手工 savepoint 与 Sandbox 的语句隔离冲突，已改为既有 mode: :savepoint 协议，未改数据库约束。
- 历史测试导出基线为 0430b839f918aecab1e0b30fa0568a0239b8c8bf，重新编译 1288 文件；17 文件命令 173 passed / 110.6s / exit 0，未引入发布队列重构、模型删除、seed 或其他未提交测试。
- 随后仅关闭报告查询 SQL 日志以保持 JSON 输出干净，最终补丁再跑专项 22 项及 warnings-as-errors；最终日志 /tmp/docs-public-read-review-isolated-final.log。完整组合日志 /tmp/docs-public-read-review-isolated-tests.log。
- 随后发现最终代码补丁实际 14 路径、文档补丁 11 路径，均包含 5 个无关前端反向改动；旧 manifest 的 9 / 6 路径声明与实物不符。根因为 index 固定旧基线，但 diff --cached 未指定基线，默认比较前移后的 HEAD；缺少路径集合断言。上述测试结果保留为历史记录，不能证明作废补丁的范围正确。
- 编译 warnings-as-errors、格式、lint.style、lint.context（0 findings）、docs:check 完整链及 diff 空白检查通过；文档门禁日志 /tmp/docs-public-read-review-docs-check.log。未运行整个 backend suite。
- 报告 CLI 正常输出实际任务库名、migration_version=20261115094000、elapsed_ms 及三个空列表；没有输出 SQL / 正文。dev/test/参考库 schema 基线再次只读核对一致。

### 7.2 补丁交付重建

固定基线为 3f0497568dc5f94cd8845eca9e95ab2a5bab0edd，新导出目录定义严格为该 SHA 的 git archive + 9 路径代码补丁 + 6 路径文档补丁，不随共享工作区 HEAD 前移而切换。实际目录、补丁 SHA-256 和验证状态登记于 /tmp/docs-public-read-review-manifest.json。旧污染补丁及 manifest 另存于 /var/folders/fy/7mkqxmwj7kx_y_rm8l291l5m0000gn/T/docs-public-read-rejected-jqtyim6k，不得应用。

生成器 /tmp/docs-public-read-rebuild.py 使用独立临时 index，显式执行 git diff --cached <固定完整 SHA> -- <白名单路径>；同时断言实际路径集合与白名单完全相等、5 个无关前端文件零 hunk、代码文件字节与工作区所选文件一致。文档补丁的 README 只包含公共读取条目，不携带 Passport / History / Mirror 条目。共享暂存区及其他任务文件保持原状。

补丁通过独立导出目录上的 git apply --check 才应用；5 个前端文件需与固定基线逐字节一致。实际验证结果见下方及 manifest；本轮不改变业务代码、准入谓词或错误映射。独立代码补丁不依赖未提交队列重构；文档中的 Mirror Fix 及其他设计合同仍属单独设计批次，不能把链接存在当作那些合同已随本补丁交付。

最终验证：固定基线 3f0497568dc5f94cd8845eca9e95ab2a5bab0edd 的干净 archive 应用重建补丁后，重新编译 1288 文件；原 17 文件命令 173 passed / 99.1s / exit 0（其中专项 22 项），日志 /tmp/docs-public-read-rebuilt-tests.log。该次测试的代码补丁 SHA-256 与最终 manifest 一致；warnings-as-errors 与 9 文件格式检查通过，日志 /tmp/docs-public-read-rebuilt-compile.log。未重复声明早先的 173 结果代表新交付物。

测试后仅补入本段运行记录，重新生成文档补丁，在同一导出目录回退初版文档补丁再应用最终文档补丁，并再次验证全部 tracked 差异恰好为 9 个 backend + 6 个 docs 路径；其余 tracked 文件及 5 个前端文件与固定基线一致。两份补丁实际路径与各自 manifest.paths 完全一致，README 仍只含公共读取条目。最终 SHA-256 以 manifest 为准，不在本文嵌入本文补丁自身的哈希。

docs:check 完整链在共享工作区执行通过，日志 /tmp/docs-public-read-rebuilt-docs-check.log；该检查不代表未包含的设计合同已由独立文档补丁交付。原 dev / test / 参考库仅只读核对 schema 基线，结果均保持不变，记录 /tmp/docs-public-read-rebuilt-protected-db-check.json。本轮未修改业务代码、共享暂存区，未提交、推送或部署。

### 7.3 分批本地提交

本轮用户授权分批提交且不 push。公共读取代码提交为 d376b0b9488153e305a67072ad603e695a8dac4a，恰好 9 个代码 / 测试文件，暂存 diff 的 SHA-256 与已通过 173 项隔离回归的代码补丁一致；提交前检查及 commitlint 正常通过。无业务代码二次改动，无需重复运行相同回归。

第二批同步提交原 6 文件公共读取文档与 Docs Mirror Fix，共 7 个路径。迁移 README 只加入公共读取和 Mirror Fix 两条索引，不包含 Passport / History 条目。Mirror Fix 对尚未纳入的 Passport / History / Co-authors 合同保留待合入路径而不生成死链；这三份文件及其他文档、发布队列改动和模型删除均留在工作区。相对链接按最终暂存文件树核对，不能借工作区额外文件掩盖缺失依赖。

后续阶段仍须分别提交发布队列及依赖合同，不得把本次 173 项证据当成那些实现已验证。补丁 manifest 的 base_commit 是历史验证基线，提交后 HEAD 前移不应重写历史证据。两个本地提交作为本轮整体文档 / 代码交付，当前未 push 或部署。
