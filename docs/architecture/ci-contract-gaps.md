# CI Contract Gaps: GraphQL Operations, Command Receipts and Runtime Semantics

> 状态：P0 已部分落地；本文继续记录剩余缺口与目标门禁。

## 1. 背景与结论

PR [#593](https://github.com/groupher/groupher/pull/593) 的 `commandId` 迁移期间暴露出一个重要边界：CI 通过并不等于所有 GraphQL operation、命令幂等语义和跨资源查询语义都经过验证。相关问题是在 review 期间及其相邻改动中发现的，并不意味着 PR 文件列表本身包含 Apply 侧变更。

最典型的是 `commandId` 与 `idempotencyKey`：后端 schema 的字段参数已经是 `commandId`，但 Apply 侧曾经保留旧的内部命名和未纳入 schema 校验的 raw GraphQL 文本。现有 TypeScript/build/test 因此可以全部通过，而问题在 review 或真实请求时才暴露。

核心结论：仓库已有 GraphQL schema freshness 和部分 generated operation 检查，但还没有覆盖所有前端入口的“每个 GraphQL operation 都必须能 against 当前 SDL 校验”的统一门禁。

## 2. 当前 CI 实际检查的范围

| 检查                     | 当前覆盖                                                                                                         | 当前不能保证                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Backend schema freshness | 生成 `backend/api/schema.graphql`，并检查生成结果无未提交 diff                                                   | 不验证所有客户端 operation 的字段、参数和 response selection                                          |
| Core GraphQL contract    | 对 `codegen.ts` 清单中的 operation 做静态 GraphQL 检查、codegen 和生成文件 freshness 检查                        | 不覆盖清单外的 raw GraphQL 文本                                                                       |
| Apply type-check/build   | 检查 TypeScript 类型和构建产物                                                                                   | `clientGraphQL(query: string)` 的 operation 名、字段、参数仍是普通字符串；build 不会执行 GraphQL 请求 |
| Backend tests            | 运行 `mix test --exclude skip_ci`，并在 workflow 中执行变更文件 format 检查和 `mix compile --warnings-as-errors` | Credo 仍未作为硬门禁，也没有覆盖全部 Receipt/outbox/scope/concurrency 组合                            |
| 命令静态检查             | 已有若干仓库级脚本，例如 command identity、facade boundary、business return shape                                | 静态脚本不能替代运行时协议和数据库状态转换测试                                                        |

因此，“有 schema 检查”与“所有客户端请求都经过 schema 校验”是两件不同的事。

## 3. 为什么 `commandId` / `idempotencyKey` 没有在 CI 报错

当前 Apply 请求链路的关键特征是：

1. operation 以 raw template string 写在 Apply 代码中；
2. `clientGraphQL` 和 server-side GraphQL helper 接收的是 `string`，返回值也是由调用方指定的泛型；
3. Apply operation 不在 Core 的 `codegen.ts` operation manifest 中；
4. `commandId` 和 `idempotencyKey` 在 TypeScript 层都只是 `string`，变量名的语义差异不会触发类型错误；
5. 构建和普通单元测试不会自动向当前 GraphQL schema 发请求。

所以 CI 能证明“代码可以编译、已纳入的 GraphQL 文档与 schema 一致”，但不能证明“Apply 的每一段 raw GraphQL 文本与 schema 一致”。这正是本次低级错误逃逸的直接原因，而不是 schema 本身没有任何检查。

## 4. 哪些问题可以在 test/CI 阶段发现

| 问题类别                                                | 适合的自动检查                                                                           | 当前缺口                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| operation、字段、参数或 response field 与 schema 不一致 | 对所有 GraphQL 文档执行 `parse + validate`；最好同时生成 typed documents                 | Apply raw GraphQL 未纳入统一清单                                                                                        |
| `commandId` 丢失、首次执行与 replay 结果不一致          | 同一 `commandId` 执行两次，断言第二次返回 canonical first result，且不依赖资源仍存在     | 已有 Receipt 单测和业务级 replay integration；仍缺统一 command contract suite，且尚未纳入除 `mix test` 外的专项 CI 门禁 |
| replay 前 lookup 导致已删除资源时失败                   | 首次成功后删除/改变资源，再用同一 command replay                                         | `recovery_test.exs`、`trash_test.exs` 已覆盖；仍缺统一 command contract suite，且尚未纳入除 `mix test` 外的专项 CI 门禁 |
| outbox 重复、失败后重试或 dead record 处理错误          | 相同 identity 重复提交、模拟 dispatch 失败并断言最终唯一性及重试状态                     | 缺少系统化 outbox contract suite                                                                                        |
| community/binding/visible/thread scope 串数据           | 建立跨 community、多 binding、隐藏 binding 和 thread fixture，断言结果集合与计数         | 现有测试覆盖分散，缺少统一 scope matrix                                                                                 |
| `total_count`、分页和 projection 不一致                 | 一条 Article 多个 binding、多页数据的 integration test                                   | 缺少覆盖多入口组合的分页合同测试                                                                                        |
| 并发订阅、置顶、容量或唯一约束问题                      | 并发 task/transaction test，断言唯一结果、锁和最终状态                                   | 普通串行测试无法发现这类问题                                                                                            |
| N+1 或隐式重复查询                                      | query count/telemetry assertion 或受控性能测试                                           | 普通业务断言不会发现查询数量回退                                                                                        |
| error tuple 被吞掉、错误被当成功处理                    | failure injection、Repo/provider mock 或错误路径 integration test                        | 依赖具体失败条件，不能只靠 happy path                                                                                   |
| Elixir 编译警告、格式和 lint 回退                       | `mix compile --warnings-as-errors`、`mix format --check-formatted`、`mix credo --strict` | backend workflow 当前不是完整质量门禁                                                                                   |

## 5. 建议的门禁顺序

### P0：先堵住 GraphQL contract 漏洞

- 已落地：Apply operation 已集中到 `frontend/apply/src/lib/graphql-documents.ts`，纳入 `codegen.ts`，由 GraphQL Codegen against 当前 SDL 校验；运行时使用 Apply-specific generated documents。
- 已落地：`graphql-contract.yml` 已覆盖 `frontend/apply/**`，并执行 Apply type-check。修改该 workflow 时仍需分别核对 `push` 和 `pull_request` 两组 `paths`：`push` 目前不带 `branches` filter，而 `build-apply.yml` 的 `push` 仅限 `dev`，两者触发语义不同，不能直接照搬配置。
- 已落地：验证既有真实回归测试对 Receipt replay、资源删除后的恢复、outbox retry 的覆盖；本次新增/修正的是 Outbox identity upsert 测试，以及无 community scope 时 PostgreSQL `NULL` 参数类型无法推断的问题。
- 后续应继续扩展统一 operation inventory，确保新增 Apply、SSR 和 test fixture 中的 GraphQL 文本不会重新绕过 SDL 校验。
- 保留 generated artifact freshness 检查，避免 schema、operation 和生成类型发生漂移。
- 对 `commandId` 建立明确的跨层命名合同；内部可以有不同领域名，但边界转换必须有显式测试，不能依赖两个 `string` 恰好兼容。

### P1：把协议语义变成可回归的 integration contract

- 将既有 command replay、资源删除后的 replay、错误重试和 outbox identity 测试统一收口为 command contract suite，并纳入专项 CI 门禁。
- 增加 scope/pagination contract suite：多 community、多 binding、隐藏/可见状态、thread 和分页计数。
- 已落地：backend CI 增加变更 Elixir 文件的 `mix format --check-formatted` 和 `mix compile --warnings-as-errors`；workflow 会比较 PR/push 的变更文件，不要求一次性重排整个历史基线。
- 待落地：Credo 硬门禁；当前全量 `mix credo --strict` 仍有大量既有建议，需单独清理基线后再启用。

### P2：补充运行时质量回归

- 对关键查询增加 query-count/telemetry 断言，防止 N+1 和 projection 回退。
- 对高风险写路径增加并发测试，并将数据库唯一约束、锁和最终状态纳入断言。
- 建立跨入口 operation inventory，确保 Core、Apply、SSR、test fixture 中的 GraphQL 文本不会脱离 manifest。

## 6. 验收标准

这份 gap analysis 对应的后续改造完成后，至少应满足：

- 任一客户端 GraphQL operation 与当前 SDL 不一致时，CI 在 build/test 之前失败；
- `commandId` 的字段名、变量传递和 Receipt replay 语义均有自动化覆盖；
- backend workflow 能在提交阶段发现编译警告、格式回退和 lint 回退；
- 关键 scope、分页、outbox 和并发合同不再只依赖 review 或线上行为发现。

本文只记录问题边界和实施顺序；具体门禁落地应按 P0、P1、P2 分批提交，并在每批提交中补充对应的失败用例。
