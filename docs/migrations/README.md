# Migrations

> 状态：current

本目录保留跨应用或跨框架的阶段性迁移记录；稳定的当前合同应回到所属应用、Feature
或 Architecture。

- [`tanstack/`](./tanstack)：Community、Landing、Inspire Me 等应用的 TanStack rewrite。
- [CMS Command Receipt 重构](./cms-command-receipt-refactor.md)：从 `CommandReceipt.run_user_command/8`
  迁移到 `CMS.Command`、统一结果恢复并移除产品端 replay 状态。
- [CMS Command 入口、用例命名与 Elixir block style 修复](./cms-command-entry-and-naming-fix.md)：纠正
  facade/Command 边界，清理重复 use-case 命名，并增加折行 inline `do:` 的仓库约束。
