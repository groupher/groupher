# Docs 公共读取 R0 盘点记录

> 状态：本文保留 R0 当时的盘点和补验证据；后续 R1–R3 本地实施与验证已完成，当前结果见 [实施记录](./docs-public-read-scope-implementation.md)。2026-11-16。
>
> 本文是 [公共读取 Scope 收口](./docs-public-read-scope-fix.md) 的 R0 证据与待办记录，不新增产品权威或实施批次。基线为本地 `doc-redesign`，HEAD `c93211e20`；工作区有既有未提交代码和文档，结论针对该工作区，不代表该 commit 的纯净源码或生产状态。
>
> 初次 R0 为只读盘点，仅写文档、查询本地 schema / 服务状态；以下 §1–§8 保留该阶段的证据口径，补验后的当前状态以 §9 为准。随后用户明确授权准备本任务隔离库和 fixture，§9 记录创建与测试结果；仍未修改业务代码、启动 Dev Hub 服务、改动现有 dev/test 库或进入 R1 / R2。

> 以下“未开始 / 未验收”均描述 R0 时点。§9 的原冒烟文件后来更名为 docs_public_read_scope_test.exs，并更新为整改后断言；历史命令及结果不代表当前测试仍断言泄漏基线。

## 1. 结论与边界

- 仓库内未找到实际发起 `docPage` / `pagedPublishedDocs` cursor 请求的产品 UI；已存在的 GraphQL 声明、测试 helper、合同清单不是运行时客户端。公开 API 仍允许调用，仓库外消费者与存量 cursor 使用情况未知。
- 默认 test / dev 数据库落后于源码，不能直接用于当前 Doc / PublicBody 数据库测试。已有迁移齐全的参考 test 库，能用作后续隔离环境的准备依据，未将其当作本任务可随意写入的数据库。
- 单站 Doc 发布 fixture 已有命令链；初次盘点缺少具名双站 fixture，后续已在 §9 新增并验证。同一 Doc 的 Y peer binding 由测试内 changeset / Numbering 创建，不能据此宣称普通 Article mirror / unmirror 支持 Doc。
- 社区和作者公开计数均是持久化投影；QueueRelease 会重算，但 Scope 改动本身不会扫描所有旧数据重算，Outbox 清缓存也不等于重算。
- Public / PublicBody 双向延迟 FK 要求提交时两者存在且版本一致。缺 Body / 版本不匹配可在 Sandbox 事务内临时构造并最终回滚，不能称为合法的已提交数据库 fixture。读侧防御与提交约束须分开验收。

## 2. 真实 Doc cursor 消费面

| 入口 / 证据                                                                                                                                                                                                                                                                                        | 当前接线与选项                                                                                                                          | R0 结果及后续落点                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [docPage schema](../../backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex)、[resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/articles.ex)                                                                                                                             | `thread: :doc` 默认，`article_page/3` 不传 opts，进入 Pagination，`public_tree` 默认为 false                                            | 可接受 cursor 的真实公开 API；R2 需要旧 false 指纹 → 4203 的服务端 / GraphQL 集成用例                                  |
| [published_article_queries 宏](../../backend/api/lib/groupher_server_web/schema/helper/queries.ex)、[Accounts resolver](../../backend/api/lib/groupher_server_web/resolvers/accounts/profiles.ex)、[Accounts.Publish.Articles](../../backend/api/lib/groupher_server/accounts/publish/articles.ex) | 宏包含 Doc，生成 `pagedPublishedDocs`；经 Articles.Query.paged_published → Pagination，`include_pinned: true`、`public_tree` 默认 false | 第二个真实 cursor API，不因没找到独立 `docPage` 调用就遗漏；profile filter / pinned 位与普通 docPage 分开生成旧 cursor |
| [Core Doc operation](../../frontend/core/schemas/pages/doc.ts)、[合同登记](../../frontend/core/schemas/pages/contract-inventory.ts)                                                                                                                                                                | 定义 `PagedDocs`，选择 CursorPageInfo；仅确认被合同清单引用                                                                             | CodeGraph 未找到 `docPage` 调用者；源码字面检索未找到运行时请求该 operation 的产品代码，不能据声明宣称客户端恢复存在   |
| `pagedPublishedDocs` 前端调用                                                                                                                                                                                                                                                                      | 检索 frontend / packages / backend/press 的手写 TS / JS / GraphQL，排除 generated / node_modules / dist                                 | 未找到运行时调用；API 及后端 generic adapter 确实存在，外部调用未知                                                    |
| [Community articleSurface](../../frontend/community/src/query/articleSurface.ts)                                                                                                                                                                                                                   | surface 只接受 posts / changelogs，恢复仅识别 `4211 + mismatch: revision`                                                               | 不是 Doc 4203 恢复证据；不得把它的恢复分支直接当作本项通过                                                             |
| [Press.Query.article_paths](../../backend/api/lib/groupher_server/cms/press/query.ex)                                                                                                                                                                                                              | 固定 Offset 参数和 offset Config，Doc 显式 `public_tree: true`                                                                          | 是 Doc 列表消费者，但不签发 / 使用 cursor；R2 删除 option，保留 feed / sitemap 行集合验收，无需虚构旧 Press cursor     |
| 后端 `articles/list/doc_test.exs` 与 GraphQL `paged_docs_test.exs`                                                                                                                                                                                                                                 | 测试名仍含 paged_docs；[schema helper](../../backend/api/test/helper/schema/article.ex) 实际生成 `docPage`，现有用例主要是 offset       | 属于测试消费者，不能当作已运行产品 UI；增加真实 cursor 请求及双站负例                                                  |

检索范围：手写 frontend / packages / backend/press / local 的 `docPage`、`PagedDocs`、`pagedDocs`、`pagedPublishedDocs` 等文字，以及后端宏、generic profile adapter 和 Press 接线；排除依赖、构建物、生成文件及 crash dump。没有从“零运行时引用”推断公网零流量，也没有查询生产访问日志。

### 2.1 4203 验证的可执行输入与未完成项

1. 在迁移齐全的隔离库内准备至少两条符合公开读取条件的 Doc，分页 Config / Dashboard 使用 cursor API，first 设为 1；不足两条无法得到可用于续页的 end cursor。
2. 当前源码对 docPage 和 pagedPublishedDocs 分别发起首屏请求，记录 end cursor、filter、order、surface、pinned 位、Config revision 和密钥版本。也可按旧五元组生成 fingerprint 并用现有 codec 签名；不能使用不同密钥环境的 cursor。
3. R2 build 保持除 Doc tree 位以外的绑定及配置不变，请求旧 cursor：服务端断言 `%GroupherServer.ErrorCat.Error{namespace: {:pagi}, reason: :cursor_query_mismatch, code: 4203}`，GraphQL 断言 `errors[].extensions.code == 4203`。若得到 4200 / 4201 / 4202 / 4204 / 4211，则尚未证明 fingerprint 不匹配路径。
4. 由 R0 已找到的实际客户端验证清除 cursor 并从集合头重新请求。本轮仓库内未找到此类 Doc 产品客户端，故浏览器“旧链接 / 旧会话恢复”未验证；后续使用真实 API 请求层集成用例记录 4203 → 无 after 重取，不能称为既有产品 UI 已处理，也不为验收新建 UI。

R2 发布前还须确认仓库外消费者是否存在及其 4203 行为；当前没有外部消费证据可给出结论。API 协议测试可先准备，不依赖新建产品页面，但不能代替真实消费者的恢复证据。此项是发布待确认项，不阻止 R1 的后端实现准备。

## 3. 环境核查结果

| 项目                                                        | 实测结果                                                                                  | 含义                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Elixir / OTP                                                | Elixir 1.20.3，OTP 29                                                                     | 本地命令可执行，不代表整个应用编译已通过                                       |
| PostgreSQL                                                  | localhost:5432 接受连接，psql 只读探针成功                                                | 数据库进程可用；不是 schema 已就绪                                             |
| 默认 `groupher_server_test`                                 | 最新已登记迁移 `20261112100000`；缺 `cms.article_public_bodies`；公开树索引仍带 branch_id | 不兼容当前源码，不运行数据库 suite 或试图补写 fixture                          |
| `groupher_server_dev`                                       | 最新已登记迁移 `20261101130000`；缺 `article_public_bodies` 与 `article_snapshots`        | 不能用于当前 Doc HTTP / 浏览器验收；本轮未迁移                                 |
| 参考 `groupher_server_r9_clean` / `groupher_server_r9_test` | 最新迁移 `20261115094000`，存在 PublicBody 和两条有效双向 FK                              | 可作为后续准备隔离库的参考，不是本任务已建立的写入目标                         |
| 参考 `groupher_server_r9_test` 的完整迁移集合               | 与当前 migrations 文件集合比较，无缺失迁移                                                | 比只比较最大版本更强的 schema 证据，仍未执行 R1 / R2 业务测试                  |
| 同参考库的数据                                              | Doc、Doc Public、公开 page、slug=xx 社区均为 0                                            | 零缺失投影结果是空数据结果，不能证明业务修复有效；没有现成 /home/xx 浏览器数据 |
| 另一参考 `groupher_docs_r7_guard_20261112_final`            | 最新迁移 `20261112234000`，有 PublicBody 双向 FK                                          | 不等同当前最新 schema，不直接选为测试目标                                      |
| Dev Hub GET /api/services                                   | Phoenix / Community / Dash / Press 均报告 stopped                                         | 未做服务启动或重启；不是浏览器验证已失败                                       |

`config/test.exs` 默认使用 localhost 与独立 test 数据库名，支持 TEST_DB_NAME / TEST_DB_PORT，Repo 使用 SQL Sandbox；Endpoint 的 server 为 false。后续测试只对显式指定的隔离 test 库执行。

特别注意：[mix.exs](../../backend/api/mix.exs) 的 `test` alias 会先执行 `ecto.create --quiet` 与 `ecto.migrate`。`20261112140000_create_article_public_bodies` 要求空 Public 且不可逆，Docs cutover 也有一次性数据前提，不能为了跑测试直接对现有默认 test / dev 库运行 `mix test`。R0 未执行创建、迁移、克隆、清库或种子命令。

### 3.1 已执行的最小无数据库检查

从 backend/api 运行如下命令，只在内存重新编译本次核对的 codec 与 catalog，跳过应用启动、普通编译和 test alias；不加载 test_helper，不连接 Repo：

```bash
MIX_ENV=test mix run --no-start --no-compile -e 'ExUnit.start(); Code.compile_file("lib/groupher_server/pagi/error_cat.ex"); Code.compile_file("lib/helper/orm/pagi/cursor_codec.ex"); Code.require_file("test/helper/orm/pagi_cursor_codec_test.exs")'
```

结果：6 passed，exit 0。出现预期的内存模块重定义 warning；未修改源码或写入 beam。该结果仅验证 codec 现有合同，不验证 Doc Pagination、新旧 fingerprint、GraphQL 客户端恢复或 fixture。

## 4. fixture 盘点与准备路径

| 需求                                      | 已有能力 / 约束                                                                                                                                            | 后续测试准备，不是本轮已执行                                                                                                                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单站已发布 Doc                            | [Factory.mock_article(:doc)](../../backend/api/lib/support/factory/factory.ex) → Seeds.Docs.create → workspace / queue / Release / Public                  | 优先复用命令链；需要空 Queue。它会写全局 Mentions revision，使用 TestMate 默认同步用例，不能随意 async                                                                                                                                                         |
| 最小社区                                  | [ArticleContentFixture.community](../../backend/api/test/support/article_content_fixture.ex) 创建 core、Lifecycle、review configs、root moderator          | 可用于聚焦内容测试，不是生产 Community 创建验收；其 article helper 的说明是 ordinary Article，不能直接当作已验证的 Doc 双站 helper                                                                                                                             |
| 同一 Doc，X/Y Binding，只有 X public page | 单站 helper 存在；普通 BindingPersist mirror / unmirror 对 Doc 返回 unsupported_for_doc；CreateWorkspaceNode 的 page 会新建内容                            | 在同一 Sandbox 内创建 X 的完整已发布 Doc、Y 的独立可读社区，再按当前 ArticleBinding changeset / Numbering 准备 Y peer binding，保留相同 article_id，Y 不插入公开 page。这是读路径夹具，不声称 Doc mirror 写入合同已验收                                        |
| 双站都有 page / hidden / link / pin       | 同站同 stage 的 page doc_id 唯一；非页节点不以 doc_id 引用 Article；导航主动排除 hidden                                                                    | 双站正例各一个合法 page，完整导航用 tab / group / page 结构；hidden 的直读与导航行为分开断言，不插重复 page                                                                                                                                                    |
| PublicBody 缺失 / 版本不匹配              | 双向 FK 是 DEFERRABLE INITIALLY DEFERRED，正常提交必须完整                                                                                                 | 沿用 [public_body_test.exs](../../backend/api/test/groupher_server/cms/articles/public_body_test.exs) 的 Sandbox 内临时删除 / 修改方式后调用读路径，最终回滚；提交保护用 savepoint + SET CONSTRAINTS ALL IMMEDIATE 断言拒绝，不禁用约束、不向 dev 库提交坏数据 |
| 旧 cursor 的可续页输入                    | [pagination_test.exs](../../backend/api/test/groupher_server/cms/articles/pagination_test.exs) 已有普通 Article cursor 用例；Doc 既有列表用例可借鉴 helper | 增加两篇 Doc、两站和 cursor Config 的具名 fixture，分别覆盖 docPage / pagedPublishedDocs；本轮未声称已存在此 fixture                                                                                                                                           |

当前模型关系已具备双 Binding 表达能力，`20261115093000_drop_doc_single_owner_index` 已退役 Doc 单 owner 索引。仍需在本任务隔离库内验证 changeset / numbering / fixture 全链路；“表可表达”不等于 helper 已跑通。只读 R0 未插入任何 fixture。

## 5. 计数刷新与缓存路径

| 投影 / 入口                                   | 当前刷新职责                                                                                                                                                                                                                                       | R1–R3 必须记录的差距                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pagination count / entries                    | 同一 public_scope，经 public_binding_ids，count 即时查询                                                                                                                                                                                           | R1 统一条件后验证 SQL / 实际集合，不需要按另一个维护表推导                                                                         |
| Community.meta.docs_count / articles_count    | [Communities.Count.update](../../backend/api/lib/groupher_server/cms/communities/count.ex) 按本站 Binding 查询，再持锁更新 meta 与 articles_count                                                                                                  | 改 Scope 不会主动更新已存数字；要记录受影响站点清单、更新前后值和现有 update_count_field 的受控执行安排                            |
| Doc 发布后的本站计数                          | [QueueRelease](../../backend/api/lib/groupher_server/cms/doc_tree/publish/queue_release.ex) 在 PublicTree.apply 后调用 update_publication_counts                                                                                                   | 现有 Release 路径会更新本站；不是部署时全部站点自动重算。Trash purge 内未找到相同计数更新调用，后续仍按 D2 写入合同核对            |
| User.meta.published_docs_count                | QueueRelease 收集 affected.article_ids 的作者 → Accounts.publish_update_states → [Projection](../../backend/api/lib/groupher_server/accounts/publish/projection.ex) → [Persist](../../backend/api/lib/groupher_server/accounts/publish/persist.ex) | 既存作者摘要也不会因 Scope 代码变动自动刷新；按受影响作者登记重算。原作者 count 按 Scope Binding 行统计，不能擅自去重成 Article 数 |
| 普通 Article 首次发布 / mirror / move / trash | 已有各自 update_count_field / publish_update_states 调用                                                                                                                                                                                           | 仅作非 Doc 回归，不混入本次 Doc 发布拆分                                                                                           |
| DocTree Outbox / CDN                          | DocTree.Effects 发 doc_tree.changed，Community Outbox workflow 仅做缓存清理；[Tags](../../backend/api/lib/groupher_server/public_cache/tags.ex) 覆盖 doc_tree / doc article_list                                                                   | 清缓存不重算数据库计数，也不能证明旧 CDN / feed 条目已全部消失                                                                     |

R0 没有执行 Count.update、Accounts.publish_update_states 或缓存 purge。R3 发布前须确定一次性重算目标及现有入口的执行记录；不能仅等未来有人发布该站点，也不能把 schema 数据迁移与计数投影刷新混称。

## 6. PublicBody 完整性诊断

### 6.1 已存在的能力

- [Public.current / body](../../backend/api/lib/groupher_server/cms/articles/public.ex) 按当前 article_id / snapshot_id 精确读；current 无匹配返回内部 public_not_found，body 返回 public_body_missing。FrontDesk 会把 current 失败映射为 6008，单靠该结果不能定位完整性损坏。
- 同模块 Public.rebuild/2 是写操作，需要调用方事务、锁 Article 与当前 Public，旧 Snapshot 返回 public_conflict；不是 report-only 诊断入口。本轮未调用，也不在公共读取中自动修复。
- 迁移定义 PublicBody → Public 与 Public → PublicBody 两条复合 FK，均在事务提交核验。兼容参考库只读查询确认两条约束 validated / deferrable / initially deferred 均为 true。
- 检查的现有 Mix tasks 没有独立 PublicBody 完整性 report 命令；Search reindex / capacity 不应代替该报告。R3 的诊断形式仍需实施，不能宣称已有日志能从 404 区分权限与损坏。

### 6.2 可复用的只读核查 SQL

先确认目标库 schema、双向约束和版本，不对缺表库执行查询。以下不含修复、历史正文读取或内容输出：

```sql
BEGIN READ ONLY;

SELECT p.article_id, p.snapshot_id AS expected_snapshot_id,
       b.snapshot_id AS actual_snapshot_id,
       CASE WHEN b.article_id IS NULL THEN 'body_missing'
            ELSE 'snapshot_mismatch' END AS issue
FROM cms.article_publics p
LEFT JOIN cms.article_public_bodies b ON b.article_id = p.article_id
WHERE b.article_id IS NULL OR b.snapshot_id IS DISTINCT FROM p.snapshot_id;

SELECT b.article_id, b.snapshot_id, 'public_missing' AS issue
FROM cms.article_public_bodies b
LEFT JOIN cms.article_publics p ON p.article_id = b.article_id
WHERE p.article_id IS NULL;

ROLLBACK;
```

参考 `groupher_server_r9_test` 的 Public → Body anti-join 和“公开 page + Public 无匹配 Body”计数均为 0，但该库没有 Doc / Doc Public / 公开 page，不能据此证明正负例通过。默认 dev / test 缺表，未执行这些 Body 查询，不能记录为零损坏。

双向 FK 完整生效的正常已提交数据不会出现上述缺失 / 不匹配。PublicTree.validate_pages 虽没有显式 Body join，也不能据此断言该环境能提交“Public 存在、Body 缺失”的永久坏节点；仍需区分事务内暂态、未完成迁移 / 约束缺失的旧库、以及导航 / Lifecycle / Review 等其他不可读原因。D2 保留提交一致性与候选页面验证边界验收，是否需要业务层提前报错另行按真实用例决定，不新增重复权限权威。

## 7. 其余消费者与迁移去向

以下为源码盘点；actor / Community 限定仍以专项合同为准，不表示所有入口已运行复现：

| 消费者                                                      | 当前 Scope / 过滤                                                                        | 实施 / 验收去向                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| FrontDesk 单读                                              | actor + typed Doc public / owner_management；另外 Repo.exists? 检查 tree，false 分支缺口 | R2 删除后置树查询，public 无页稳定返回 6008；management 保持原准入                     |
| Locator 批量                                                | nil actor + Doc public + 本站 inner_id，额外 tree join                                   | R2 去语义重复，保留输入顺序 / 重复地址及无效地址省略行为                               |
| Pagination / profile Doc 列表 / Press                       | public_binding_ids；分页 / Press 有可选树条件，Press 还有后置检查                        | R1/R2 同批；仅真正 cursor 路径处理旧指纹，Press 验证 offset / feed                     |
| Community count / Search Indexer                            | public_binding_ids，外层限定 Binding / Community                                         | R1 自动继承；R3 验证计数刷新、sync_binding / Article 重建，不执行外部 Search 改造      |
| ArticleStats / DocCover / upvotes / collect folders         | public_binding_ids，部分经零参全 thread union，默认 nil actor                            | 保留本站关联和各自跨站去重单位，不能借 X 公开使 Y 路径可见                             |
| DocTree public navigation                                   | 直接 Doc public Scope，限定 binding.community_id，再剔除 hidden / 无投影 page            | R1 自动继承 Body 条件；R3 导航及 hidden 独立验收                                       |
| Comments.Query / Gate.Scope.Comment                         | 公共讨论依父 Doc Scope，本站 Context / Binding；mentioned_target 另按 Comment 自身准入   | R3 分开验收列表、summary / count、replies / pinned；不收紧 mentioned_target 特殊分支   |
| ArtimentMentions / Artiment.Status                          | source endpoint / type:doc 状态经 Doc public Scope + Community                           | R3 验证本站 source 集合；status 不可读为 unavailable，可保留元数据，不统一断言 404     |
| Articles.Query.Mentions / count_published / Search Capacity | 直接 Doc public Scope；容量正文按 Article distinct，其他部分按 Binding 行计数            | R3 固定现有统计单位和 identity pair，不因收口统一改去重口径                            |
| Snapshot summaries                                          | 直接 Doc public Scope，无请求 Community；不可见结果补 unavailable_article                | R3 全部不可读才 unavailable；X 可读 / Y 无页不能推导全局摘要消失；地址选择保留残留边界 |
| Insights / draft / management                               | 独立 policy_mode，有些 stage 仍为 public                                                 | R1 不加入本批 public tree / Body 条件，R3 保留授权正反例                               |
| BindingPersist                                              | unmirror 只允许普通 Article；Doc 返回 unsupported_for_doc                                | 非 Doc 回归；不为不可达 Doc 新增保护查询                                               |

## 8. 阻塞项、完成条件及下一步

| 编号                       | 当前状态 / 影响                                                               | 解除方式与归属                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| B1 数据库测试目标          | 已解除：§9 已创建本任务专用库，默认 dev/test 不变                             | 以后显式设置同一 TEST_DB_NAME；继续禁止对原 dev/test 跑迁移                                                                   |
| B2 双站 / cursor fixture   | 已解除：§9 的具名 fixture、两个 API 旧 cursor 签发 / 续页及 4203 协议冒烟通过 | 后续 R1/R2 更新这些明确的整改前基线，保留双站与旧指纹输入，不改写成生产 mirror 已支持                                         |
| B3 实际客户端 / 仓库外消费 | 仓库内无 Doc cursor 产品请求调用；外部消费未知，4203 自动恢复未验证           | R2 发布前登记外部使用事实；在真实请求层完成 4203 → 无 cursor 重取验证。未有消费者证据时标明边界，不虚构 UI 或宣称全消费面完成 |
| B4 已存计数投影            | 有本站 Release / 作者计数更新入口，无本次 Scope 部署自动全量刷新              | R3 确定受影响站点 / 作者 manifest、受控重算与缓存失效的顺序和前后值；本轮不执行                                               |
| B5 完整性诊断              | 已有精确读取 / 显式重建，没有独立 report 命令；坏 Body 不能作为合法已提交状态 | R3 确定只读诊断交付形式，以事务内回滚 fixture 验证定位；保留提交约束测试，不禁用 FK                                           |
| B6 浏览器 / HTTP 环境      | 本地服务未启动，参考库无 /home/xx 数据                                        | 后续在指定隔离环境启动所需服务并准备 /home/xx 与第二站点；不是本次已执行验证                                                  |

R0 盘点与 §9 fixture 补验已完成，不等于 R1/R2 或发布验收完成。可以据此准备后续实现；不依赖 Passport / co-authors / D1，不因普通 BindingPersist 再设置 Doc 产品决策。B1/B2 已由 §9 补验解除；B3/B4/B5/B6 的相关证据仍须在专项首次发布前落实。

本轮实际验证：本地版本命令、Dev Hub 只读状态、五个数据库的相关 schema 元数据探针、参考 test 库迁移集合与空数据计数、codec 6/6。docs:check 完整脚本链直接执行通过（避免 pnpm 自动安装依赖），四份变更文档空白检查通过。未执行正常 mix test alias、业务数据库 tests、完整 mix compile、schema/codegen、前端 type-check、浏览器、生产或外部 Search / CDN 验收；静态门禁不作为 R1/R2 运行证据。

## 9. 隔离测试库与 fixture 补验

本节记录初次只读盘点后的明确授权执行，不覆盖 §3 的原始环境快照。范围仅为新任务库、测试 fixture / 冒烟及记录；业务实现未变，R1 / R2 未开始。

### 9.1 数据库建立与隔离

- 专用库：`groupher_docs_public_read_r0_20261116`，localhost:5432。
- 创建前确认同名库不存在、参考 `groupher_server_r9_clean` 无活动会话；使用 PostgreSQL `CREATE DATABASE ... TEMPLATE groupher_server_r9_clean` 建立独立副本，没有连接终止、清库或覆盖已有目标。
- 新库基线迁移为 `20261115094000`，Public / PublicBody 两条复合 FK 的 validated / deferrable / initially deferred 均为 true。新库初始 Article / Community / Public 数量均为 0。
- 测试命令全部显式设置 `MIX_ENV=test TEST_DB_NAME=groupher_docs_public_read_r0_20261116 TEST_DB_PORT=5432`；用例还核对环境变量、Repo.config 和 SQL current_database。R0 专用用例在其他数据库名下 skip，避免混入默认 suite 后向旧库写 fixture。
- 正常 mix test alias 仅在新库执行，报告 `Migrations already up`；没有对现有 dev/test 库执行 create / migrate / test。前后只读核对：原 dev 仍为 `20261101130000` 且无 PublicBody，原 test 仍为 `20261112100000` 且无 PublicBody，参考库基线不变。
- 库予以保留，便于后续显式使用；测试数据在 Sandbox 内生成并回滚，测试后 Article / Community / Public / Binding / tree node 数量均为 0。没有保留含失效数据身份的旧 cursor 链接，也没有初始化可浏览的 /home/xx。

### 9.2 可复用 fixture 与实际断言

新增 [DocsPublicReadFixture](../../backend/api/test/support/docs_public_read_fixture.ex) 与 [R0 冒烟用例](../../backend/api/test/groupher_server/cms/articles/docs_public_read_scope_test.exs)，均位于 test/，不修改 lib/ 中的生产 factory / query / Scope / 指纹实现。

fixture 使用当前真实 Seeds.Docs 发布链在 X 建立两篇 Doc；在 Y 创建同 article_id 的 peer ArticleBinding，并通过现有 Numbering 分配互异 inner_id。每篇 Doc 在 X 恰有一个 public page，Y 无 public page；当前 PublicBody 存在且 snapshot_id 匹配。每个用例使用同步 TestMate / SQL Sandbox。

| 断言                                  | 实测结果                                                                                                                                     | 证据边界                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 同一 Doc 在 X/Y 的 Binding 与当前投影 | 每篇两个 Binding；Y 编号有效且互异；X 一个 public page、Y 零个；Public / Body 版本一致                                                       | 读路径 fixture 跑通，不是 Doc mirror 产品写入验收                                      |
| 当前 Y 列表基线                       | 默认 public_tree:false 返回两条，count=2；显式 true 返回空，count=0                                                                          | 证实整改前缺口，不声称修复；R1/R2 时必须更新该基线断言                                 |
| 当前旧 false / true cursor            | 普通列表和 author + include_pinned 两种输入均可签发 / 续页；真实 cursor 的 fingerprint 与旧五元组一致，true 与 false 不同                    | 旧 true 仅在当前显式 public_tree:true 路径验证，R2 新代码尚不存在                      |
| 两个实际 GraphQL API                  | docPage、pagedPublishedDocs 均签发 cursor，携带 after 能取第二条，指纹分别匹配对应 filter / pinned 位                                        | 进程内 Absinthe schema / middleware / resolver / Repo 集成，不是网络 HTTP 或浏览器验收 |
| 新绑定模拟与 4203                     | 纯测试计算 tree=true 指纹；旧 false cursor 用该预期值解码返回 namespace:pagi / reason:cursor_query_mismatch / code:4203                      | 未修改 query_fingerprint/4，不是 R2 build 的运行结果                                   |
| GraphQL 错误与重取                    | 将模拟 true payload 重新合法签名后发送给仍期望 false 的当前 API，两个 API 均返回 extensions.code=4203 且不公开 reason；去掉 after 可重取首屏 | 故意反向制造查询绑定不匹配来核对协议；重取由测试驱动，不证明客户端已有自动恢复         |

fixture 可重复生成，因此未来 R2 可按旧五元组重新签发与当前 fixture 身份对应的旧 cursor；不能直接复用本轮 Sandbox 回滚前的 cursor 去引用已经不存在的测试内容。

### 9.3 验证命令与结果

从 backend/api 执行：

```bash
MIX_ENV=test TEST_DB_NAME=groupher_docs_public_read_r0_20261116 TEST_DB_PORT=5432 \
  ASSETS_PUBLIC_ENDPOINT=https://assets.test CI=true \
  mix test test/groupher_server/cms/articles/docs_public_read_r0_fixture_test.exs \
    test/helper/orm/pagi_cursor_codec_test.exs --seed 0
```

结果：10 passed（新增 R0 冒烟 4 项 + 既有 codec 6 项），exit 0；新库迁移无待执行项。初次 3 项、随后 4 项的定向运行也通过，最终结果以上述组合命令为准。

同一隔离配置下 `mix compile --warnings-as-errors` 通过；两份新增测试文件的 `mix format --check-formatted` 通过。docs:check 完整脚本链直接执行通过，四份变更文档空白检查通过。最终只读复核确认专用库五类业务表仍为空、原 dev/test 与参考库 schema 基线未变。

本轮未修改 Gate.Scope.Article、Pagination、FrontDesk、Locator、Press 或前端恢复代码。实际客户端自动恢复、R2 新 build 旧 cursor 回放、计数全量刷新、坏 Body fixture / 独立诊断、HTTP / 浏览器及外部 Search / CDN 仍未验收，不因本节结果标记专项完成。

## 10. 复核补充：旧损坏库的诊断边界

snapshot_missing 只可能出现在缺失 / 未生效对应 FK 的旧损坏库，当前兼容库不能合法提交该状态。本次验证为 owner-pair 查询形状 + FK 拒绝，不关闭或修改约束伪造旧损坏数据。extension_missing 使用 Sandbox 内删除 extension 并回滚的 fixture。报告按 issue 输出，同一 Article 可以同时有 snapshot_mismatch 与 snapshot_missing 等多条诊断；消费方须按 article_id 聚合，保留全部原因。
