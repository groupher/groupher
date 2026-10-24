# Migrations

> 状态：current

本目录保留跨应用或跨框架的阶段性迁移记录；稳定的当前合同应回到所属应用、Feature
或 Architecture。

- [FrontDesk 与 Query 读取边界收口](./frontdesk-query-convergence.md)：单资源、批量转发、list/pagi、统一查询能力合同与资源加载 lint；整改已实施，验收见本文档与执行记录。
- [Gate 读取与操作准入收口](./gate-admission-convergence.md)：复用当前 Gate 合同，补齐调用覆盖、唯一可见集合和跨入口验收；整改已实施，验收见执行记录。
- [旧内容 Audit 链路退役](./legacy-content-audit-removal.md)：已执行静态扫描，列出旧外部接口、配置、前后端消费者与替代/切换清单；实现待执行。
- [旧 Audit 逐文件扫描](./legacy-content-audit-inventory.md)：逐文件证据与保留分类。
- [ErrorCat 全链路收口](./errorcat-chain-convergence.md)：领域错误、FrontDesk 错误传播与协议 formatter 的收口方案及实施结果，不擅自扩展 GraphQL 输出合同。
- [基础模块清理与源码文档审计](./backend-foundation-cleanup-and-codedoc.md)：已核实的兼容层、死代码候选、错误示例/调用图，以及 F/G/E/N/D 批次依赖与退出条件。
- [基础模块源码文档清单](./backend-foundation-codedoc-inventory.md)：166 个文件范围的 AST 候选清单，逐模块列出缺注释、隐藏文档与示例覆盖；不等同于违规判定。

- [`tanstack/`](./tanstack)：Community、Landing、Inspire Me 等应用的 TanStack rewrite。
- [Policy Boundary 修复](./policy-boundary-fix.md)：清理 Policy 中的隐式加载、配置读取、重复决策和副作用，并收敛 Gate、Facts 与领域 capability 边界。
- [CMS Command Receipt 重构](./cms-command-receipt-refactor.md)：从 `CommandReceipt.run_user_command/8`
  迁移到 `CMS.Command`、统一结果恢复并移除产品端 replay 状态。
- [CMS Command 入口、用例命名与 Elixir block style 修复](./cms-command-entry-and-naming-fix.md)：纠正
  facade/Command 边界，清理重复 use-case 命名，并增加折行 inline `do:` 的仓库约束。
- [CMS Command、Gate、Lifecycle 与 Persistence 边界](./cms-command-gate-lifecycle-persist-boundary.md)：统一
  写入入口、授权与状态职责，盘点遗漏的 Command，并收口 Writer/Persist 边界。
- [CMS Context Module Refactor](./cms-context-module-refactor.md)：按照 context module rule 盘点
  Commands、Query、Persist、Effects、Workflow、Lifecycle、Projection 及 Assets、DocTree、ContentImport
  的后续重构和验收范围。
- [CMS Command Phase 5：Legacy Mutation 分类与迁移](./cms-command-phase-5-legacy-workflows.md)：详细分类
  Tag/TagGroup、Assets 与后续 CMS mutation，冻结 one-shot、Receipt、领域 workflow、Outbox identity 和验收边界。
- [CMS Assets：现状审计与独立重构完成记录](./cms-assets-refactor.md)：单独梳理 Assets 的用户 Command、Query、Persist、Article refs、Upload、Provider 和 Replacement workflow，以及已完成的 workflow recovery、partial-success 与 lease 收口结果。
- [CMS Facade 边界修复](./cms-facade-fix.md)：Context 根 Facade、internal capability、Outbox 与结构门禁的阶段性修复记录。
- [CMS DocTree / ContentImport：现状审计与独立重构计划](./cms-doctree-refactor.md)：单独梳理 Docs tree、publish/trash workflow、ContentImport Job、Gate、事务 owner、identity/recovery 和目标目录边界。
- [CMS Command 客户端 Identity 边界修复](./cms-command-client-identity-fix.md)：保留 GraphQL
  `commandId`，将创建、retry 复用和 unknown outcome 恢复统一收回 mutation executor。
- [Backend Business Return Shape 收敛](./backend-business-return-shape.md)：统一业务层
  `{:ok, value}` / `{:error, reason}` 返回协议，扫描并分批清理裸 `:ok` 与混合 `with` 形状。
- [Backend 非 Commands 写入口审计](./backend-non-command-write-entry-audit.md)：在已完成的
  Accounts/Messaging 21 个显式 Command 之外，记录 job、maintenance、workflow、facade 与 transaction
  owner 的简化决策；默认保留现有 owner，只迁移真正的顶层业务 Command。
  Command 化分类已收口；新增授权、状态、错误与事务边界的定点复核要求，不恢复全仓证明型 manifest。
- [Article Binding 命名与存储重构](./article-binding-naming-and-storage.md)：统一
  `ArticleBinding`、`ArticleView`、`Articles.Bindings` 命名，收拢 FrontDesk 路径边界，并规划物理表重命名。
- [Backend Read / Write Owner 命名与职责修复](./backend-read-write-owner-naming-fix.md)：已完成禁止含糊
  `Read` / `Reader` / `Write` / `Writer` 名称的 gate；`Profiles.Read` 与 Interaction Projection 的职责拆分是
  文档中的后续目标，不应误读为全部完成。
- [Profile ViewTracker](./profile-view-tracker.md)：Profile view 显式 mutation、稳定 actor identity、
  滑动窗口去重、同步计数、有界清理和旧 ProfileVisit Job 删除的实施记录；当前合同见
  [`feature/view-tracker/profile-view-counting.md`](../feature/view-tracker/profile-view-counting.md)。
- [PR 594 review remediation](./pr-594-review-remediation.md)：本次架构重构 review 问题的核实、
  长期修复方式、验证证据与远端收敛状态。
- [Alias 与 Strict Null 修复记录](./alias-and-strict-null-remediation.md)：记录后端 alias 规则归属修正、
  前端 `strictNullChecks` 启用与清零结果，以及 React Doctor、Credo 和 GraphQL 合同的后续批次。
- [Backend Direct Repo Boundary](./backend-direct-repo-boundary.md)：盘点 96 个受保护边界中的直接 Repo finding，
  并按 Support、resource resolution、Persist ownership 与 Comments replay 拆分迁移。
- [Backend Cyclomatic Complexity](./backend-cyclomatic-complexity.md)：26 个复杂函数已按一致性/副作用、
  查询、校验与 seed 分批完成具名拆分；22 个文件的 `CyclomaticComplexity` finding 已从 26 个降至 0。
