# Content Import 错误处理复盘

> 状态：记录 2026-07-22 公开 GitHub Repo → Groupher Docs 联调期间已定位、已修复和仍待产品闭环的问题。
>
> 范围：Preview 分析、Workflow 错误投影、Back/reset 清理、重复来源覆盖、Docs Writer 与 archive 下载/解压。不重新定义总体架构。
>
> 关联文档：产品流程见 [`bulk-import.md`](./bulk-import.md)；总体边界见 [`content-import-architecture.md`](./content-import-architecture.md)；过程投影见 [`import-process-log.md`](./import-process-log.md)；Files SDK 与临时对象生命周期见 [`import-file-sdk.md`](./import-file-sdk.md)。

## 1. 结论

本轮暴露的问题不是同一种异常，而是四类边界没有同时闭环：

1. **契约错误**：Phoenix 内部 map 可以正常使用，但 GraphQL non-null DTO 需要稳定、明确的公开字段投影。
2. **生命周期错误**：页面 Back 不能只切换 UI；它必须先取消并清理 Preview，再清除 URL、本地引用和 idempotency key。
3. **来源身份错误**：已导入来源应通过 Connection + Mapping 更新同一批 Docs；映射目标进入 Trash 时也不能退化为重复 create。
4. **错误语义丢失**：下载、解压和 Workflow 已经知道具体原因时，不能在外层统一折叠成“Repository analysis failed”。

统一原则：

- 最靠近失败源的位置生成稳定 `code / stage / message / retryable`。
- 技术重试只处理可恢复错误；确定性错误直接结束 Workflow。
- 每一层只补充上下文，不覆盖下层已有的领域错误。
- Preview 是临时工作集，Back/reset 必须清理；已完成 ImportJob 和正式 Docs 数据不属于 Preview 清理范围。
- 已映射来源的再次导入是“更新/覆盖”，不是未关联目标碰撞；允许执行，但必须在 Apply 前显式告知用户。

## 2. 本轮问题总览

| 现象                                                                                               | 根因                                                                                                                 | 处理                                                                                                                  | 防回归重点                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `[GraphQL] Cannot return null for non-nullable field`，路径落在 `contentImportJob.sourceInfo.repo` | Job 内部 `source_info` 与 GraphQL `sourceInfo` DTO 的字段投影不完整/不稳定                                           | Job 查询统一投影公开的 repo、repo URL、branch、commit、framework、config paths、content root                          | GraphQL Job 查询覆盖全部 non-null 字段                                       |
| Back 后重新导入出现旧 Preview/旧任务影响                                                           | Back 只离开页面，没有完成服务端 Preview 删除和客户端引用重置                                                         | Back 注册异步清理；DELETE Preview 成功后才离开，并重置 URL、状态和 idempotency key                                    | 清理失败阻止离开；in-flight apply 先收敛再删除                               |
| Apply 报 `article_hash_id: 已经存在了`                                                             | Mapping 指向的 Doc 已进入 Trash；Draft 读不到它，Writer 误走 create，撞上物理 Article 唯一键                         | Writer 先按 mapped target ref 找到并恢复完整 Trash action，再对同一 `article_hash_id` 做 source-wins update           | 已映射 Doc 被删除后再次导入的集成测试                                        |
| 合法仓库被报 archive 含不支持 entry                                                                | GitHub archive 中存在合法 symlink/hardlink，但导入器把所有 link 当危险 entry                                         | link 不解析、不落盘，直接跳过并计入文件数上限；路径穿越、device、FIFO 和未知 entry 仍阻断                             | link 目标不物化；link storm 不能绕过文件数限制                               |
| 活跃下载超过总时长后被报“archive invalid”                                                          | fetch timeout 在返回 headers 后仍绑定 response body，流式下载被总时长中止；extractor 又把中止包装成 archive 格式错误 | headers 使用可取消 timeout；body 使用每个 chunk 的 idle timeout，不限制持续有进度的总下载时长；流中断保留下载错误语义 | 多 chunk 总耗时超过 timeout 仍成功；单个 chunk stall 返回 retryable 下载错误 |
| UI 只显示 `Repository analysis failed.`                                                            | 确定性错误被 Workflow 重试并包上 Step 前缀，Preview 投影没有读取最终 cause                                           | 非 retryable `DocsImportError` 转为 `FatalError`；投影读取 `WorkflowRunFailedError.cause` 并去除 Workflow 包装前缀    | 原始安全 message 能通过轮询 API 到达 UI                                      |

## 3. 详细处理

### 3.1 GraphQL sourceInfo non-null

`ImportJob.source_info` 是 Phoenix 内部持久结构，允许使用数据库/Elixir 习惯的字段形态；`contentImportJob.sourceInfo` 是 GraphQL 公共 DTO，不能把内部 map 原样交给 Absinthe 猜字段。

查询投影必须显式生成：

```text
repo
repoUrl
branch
commit
framework
configPaths
contentRoot
```

这样内部 `repo_url / config_paths / content_root` 的保存方式变化不会破坏 GraphQL non-null contract。测试不能只断言 Job status，还要查询完整 `sourceInfo`。

### 3.2 Back/reset 是一个有失败结果的异步操作

正确顺序：

```text
用户点击 Back
  -> 等待正在提交的 apply admission 收敛
  -> DELETE 当前 Preview（取消 Workflow + 删除 Preview artifacts）
  -> 清空 previewRef / jobRef / Preview / Process / error
  -> 生成新的 idempotency key
  -> 删除 URL 中的 preview/job
  -> 允许路由离开
```

若 DELETE 失败，Back 返回 `false` 并留在当前页显示错误。不能先离开再 best-effort 清理，否则用户下一次进入时仍可能恢复旧 Preview。

边界：Back/reset 只清理临时 Preview。已经完成并落库的 ImportJob、Docs 和 ImportSourceMapping 是正式事实，不应随页面返回而删除。

### 3.3 Mapping 命中、Trash 与 source-wins

同一来源 Page 的稳定身份是：

```text
(connection_id, thread=doc, external_ref) -> thread_ref
```

再次导入同一 Repo/branch 时，Target Validator 应复用 `thread_ref`。Writer 必须按以下顺序处理：

1. 锁定当前 Draft/Tree 与 staging items。
2. 查找 mapped target refs 是否属于某个完整 Docs Trash action。
3. 若属于 Trash，先恢复该 action；如果 tree revision 冲突则整体失败。
4. 对已有 Draft update；只有 Draft/Public/Trash 都不存在时才 create。
5. 写入成功后更新 Mapping 的来源基线和 `groupher_hash`。

恢复以完整 Trash action 为单位，避免只恢复一篇 Doc 却留下残缺的 Tab/Group/Tree。

### 3.4 Archive link 的安全边界

symlink/hardlink 本身不需要进入 SourceWorkspace。安全做法不是解析 target，而是：

- 校验并统计 entry；
- 不创建 link，不读取 link target，不复制 target 内容；
- 继续按真实 entry 数执行 5,000 文件上限；
- 普通文件仍执行 path traversal、单文件、展开总量和 retained bytes 限制；
- device、FIFO、绝对路径、`..` 和逃出临时根目录仍直接失败。

这使包含 `CLAUDE.md -> AGENTS.md` 一类仓库内辅助链接的公开仓库可以分析，同时不会把 link 变成工作区逃逸通道。

### 3.5 下载 timeout 与错误归属

流式下载需要区分：

- **headers timeout**：连接/响应头长期没有返回，可以取消整个 request。
- **chunk idle timeout**：body 已开始后，只有连续一段时间没有任何新 chunk 才视为 stalled。
- **总下载时长**：只要仍有进度，不应被固定总时长误杀；大小由 compressed bytes 上限控制。

extractor 只负责 gzip/tar 与 entry 安全。若输入流以 `DocsImportError` 结束，必须原样上抛；不能把下载中断改写成“archive invalid”。

### 3.6 Workflow 重试与 UI 错误投影

错误策略：

| 类型                                           | Workflow 行为                | UI 行为                              |
| ---------------------------------------------- | ---------------------------- | ------------------------------------ |
| retryable platform/network error               | 有界重试，耗尽后失败         | 显示具体安全 message，并允许重新分析 |
| non-retryable contract/archive/framework error | `FatalError`，不做无意义重试 | 直接显示具体原因                     |
| 未知异常                                       | 保留通用兜底并记录服务端诊断 | 不暴露 stack、绝对路径或上游原始正文 |

Preview 投影读取失败 run 的 cause，去掉 `Step "..." failed after N retries:` 这类执行器前缀，再通过现有轮询响应返回。Browser 不需要为了取错误再发一条旁路请求。

## 4. 同一仓库重复导入与覆盖警告

### 4.1 当前已经能探测到什么

当前服务端以以下唯一身份查找或创建 Connection：

```text
(community_id, platform=github, source_ref=owner/repo, connection_key=branch)
```

Target Validator 随后读取该 Connection 下的 Doc mappings。只要至少一个 Mapping 命中，就能确定这个 Repo/branch 曾导入到当前社区，并能统计将更新的 mapped Pages。因此，连续两次导入 `aklinker1/vitepress-knowledge` 没有报重复键是预期行为：第二次复用了已有 Doc refs，并执行 source-wins update。

当前缺口是 Preview DTO 只返回 TargetTree/conflicts/counts，没有把“命中了已有 Connection/Mapping”投影给 UI，所以页面无法显示覆盖警告。

### 4.2 产品语义

需要分开两类情况：

1. **已映射来源更新**：同 Repo/branch + 同 external refs 命中 Mapping。这是允许的覆盖路径，不应伪装成目标冲突。
2. **未映射目标碰撞**：新的来源碰到已有 Tab/Group/slug/route，且没有 Mapping 证明它们属于同一来源。这仍是阻断型冲突。

即使 commit 与上次完全相同，也应显示已导入提示；后续可以增加“内容无变化，跳过 Apply”，但不能因为是 no-op 就隐藏来源身份。

### 4.3 目标交互

Target Preview 增加只读摘要，例如：

```text
existingImport:
  mode: overwrite
  repo: aklinker1/vitepress-knowledge
  branch: main
  mappedPages: 42
  lastImportedAt: 2026-07-22T...
  sameRevision: true | false
```

用户点击 Import 时，如果 `mode=overwrite`，弹出一次风险说明。它用于让用户知道本地修改可能被覆盖，不是阻断型冲突；用户选择继续后必须进入 source-wins Apply：

```text
这个仓库已经导入过

继续操作会用 GitHub 当前版本覆盖 42 篇已关联文档的标题、slug 和正文，
并按本次 Review 更新 Docs 结构。此操作不会创建第二套重复文档。

[取消] [继续并覆盖]
```

“继续并覆盖”本身就是 acknowledgement，结果必须进入 Apply intent。Phoenix 在 apply 前重新检查来源身份、Mapping 和 `targetRevision`；校验通过后直接覆盖，不能再因为命中已有 Mapping 或检测到同来源内容而禁止导入。acknowledgement 只证明用户已经看过风险，不是让服务端重新做一次是否允许覆盖的产品决策。

首期按已确认的 source-wins 策略覆盖受来源管理字段。`groupher_hash` 与 `source_hash` 继续保留为未来三方 diff 基线，但本轮不新增逐篇 merge UI。

## 5. 清理与保留矩阵

| 场景                            | Preview/Workflow                   | Files SDK artifacts         | ImportJob/staging                    | 正式 Docs/Mapping           |
| ------------------------------- | ---------------------------------- | --------------------------- | ------------------------------------ | --------------------------- |
| 分析中 Back                     | cancel                             | delete                      | 无                                   | 不变                        |
| Review 中 Back                  | cancel/no-op                       | delete                      | 无                                   | 不变                        |
| apply admission 尚未返回时 Back | 先等待 admission，再按实际状态清理 | 由 Preview/Job 收尾规则处理 | 不并发删除正在创建的 Job             | 不变                        |
| 确定性分析失败后重新选择仓库    | delete failed Preview              | delete 或短诊断 TTL         | 无                                   | 不变                        |
| ImportJob failed                | Preview 按短 TTL 清理              | 短诊断 TTL                  | 保留安全错误摘要，staging 按策略清理 | 原子 apply 保证不留下半棵树 |
| ImportJob completed 后 Back     | Preview 可清理                     | delete                      | 保留 Job 事实                        | 保留导入结果与 Mapping      |

## 6. 回归测试清单

- GraphQL：`contentImportJob.sourceInfo` 所有 non-null 字段可读。
- Back：cleanup 成功才允许离开；失败阻止离开；URL 与新 idempotency key 已重置。
- 重复来源：同 Repo/branch 第二次 Preview 复用 mapped target refs；Apply 不创建第二套 Docs。
- 覆盖确认：存在 Mapping 时返回 overwrite 摘要；点击“继续并覆盖”后携带 acknowledgement，并成功 Apply 到原 mapped Docs。
- Trash：mapped Doc/完整 Trash action 恢复后更新同一 `article_hash_id`。
- Archive：symlink/hardlink 被安全跳过且计数；device、FIFO、路径穿越继续阻断。
- Downloader：活跃多 chunk 下载可超过单次 timeout；stalled/interrupted body 返回 retryable 下载错误。
- Workflow：non-retryable 错误不重复三次；最终安全 cause 能通过 Preview polling 显示。
- E2E：至少覆盖一个含 link 的真实公开仓库和同一仓库连续导入两次。

## 7. 后续项

1. 在 Phoenix Target Preview 投影 `existingImport`，并把 Mapping 命中数纳入 `targetRevision`。
2. 在 Review/Import 操作上增加“继续并覆盖”风险确认；Apply contract 携带 overwrite acknowledgement，校验通过后不得因同来源重复而阻断。
3. 同 commit/source hash 全部未变化时给出 no-op 提示，避免无意义转换和 staging。
4. 后续实现三方 diff 时，将“来源变化 + Groupher 本地变化”升级为逐篇 Review；在此之前保持明确的全量 source-wins 警告。
5. 把上述真实仓库、Back、Trash 和错误投影场景纳入固定 Browser/集成回归。
