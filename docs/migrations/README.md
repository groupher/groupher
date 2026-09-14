# Migrations

> 状态：current

本目录保留跨应用或跨框架的阶段性迁移记录；稳定的当前合同应回到所属应用、Feature
或 Architecture。

- [`tanstack/`](./tanstack)：Community、Landing、Inspire Me 等应用的 TanStack rewrite。
- [CMS Command Receipt 重构](./cms-command-receipt-refactor.md)：从 `CommandReceipt.run_user_command/8`
  迁移到 `CMS.Command`、统一结果恢复并移除产品端 replay 状态。
