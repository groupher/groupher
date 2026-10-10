# Migrations

> 状态：current

本目录保留跨应用或跨框架的阶段性迁移记录；稳定的当前合同应回到所属应用、Feature
或 Architecture。

- [`tanstack/`](./tanstack)：Community、Landing、Inspire Me 等应用的 TanStack rewrite。
- [CMS Command Receipt 重构](./cms-command-receipt-refactor.md)：从 `CommandReceipt.run_user_command/8`
  迁移到 `CMS.Command`、统一结果恢复并移除产品端 replay 状态。
- [CMS Command 入口、用例命名与 Elixir block style 修复](./cms-command-entry-and-naming-fix.md)：纠正
  facade/Command 边界，清理重复 use-case 命名，并增加折行 inline `do:` 的仓库约束。
- [CMS Command、Gate、Lifecycle 与 Persistence 边界](./cms-command-gate-lifecycle-persist-boundary.md)：统一
  写入入口、授权与状态职责，盘点遗漏的 Command，并收口 Writer/Persist 边界。
- [CMS Command Phase 5：Legacy Mutation 分类与迁移](./cms-command-phase-5-legacy-workflows.md)：详细分类
  Tag/TagGroup、Assets 与后续 CMS mutation，冻结 one-shot、Receipt、领域 workflow、Outbox identity 和验收边界。
- [CMS Assets：现状审计与独立重构计划](./cms-assets-refactor.md)：单独梳理 Assets 的用户 Command、Query、Persist、Article refs、Upload、Provider 和 Replacement workflow，以及目录规范和下一阶段收口顺序。
- [CMS DocTree / ContentImport：现状审计与独立重构计划](./cms-doctree-refactor.md)：单独梳理 Docs tree、publish/trash workflow、ContentImport Job、Gate、事务 owner、identity/recovery 和目标目录边界。
- [CMS Command 客户端 Identity 边界修复](./cms-command-client-identity-fix.md)：保留 GraphQL
  `commandId`，将创建、retry 复用和 unknown outcome 恢复统一收回 mutation executor。
- [Backend Business Return Shape 收敛](./backend-business-return-shape.md)：统一业务层
  `{:ok, value}` / `{:error, reason}` 返回协议，扫描并分批清理裸 `:ok` 与混合 `with` 形状。
- [Article Binding 命名与存储重构](./article-binding-naming-and-storage.md)：统一
  `ArticleBinding`、`ArticleView`、`Articles.Bindings` 命名，收拢 FrontDesk 路径边界，并规划物理表重命名。
