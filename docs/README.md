# Groupher 文档

> 状态：current

本目录按长期主题和系统边界组织。文档状态不会改变文件位置；进行中和待办事项统一记录在
[`roadmap.md`](./roadmap.md)，连续版本的当前状态由各主题目录的 `README.md` 说明。

## 应用

能够独立运行或部署的应用直接位于 `docs/` 一级目录：

- [`auth/`](./auth)、[`dash/`](./dash)、[`community/`](./community)、[`apply/`](./apply)
- [`assets-hub/`](./assets-hub)、[`import/`](./import)、
  [`converter/`](./converter)
- [`gateway/`](./gateway)、[`press/`](./press)、[`umami/`](./umami)、[`widget/`](./widget)
- [`ai/`](./ai)、[`posthouse/`](./posthouse)、[`risk-center/`](./risk-center)

应用划分原则及运行时边界见 [`architecture/apps.md`](./architecture/apps.md)。

## 主要逻辑链路

[`feature/`](./feature) 按业务能力组织跨前后端设计，包括 Activity、Article、Gate、
Lifecycle、Interaction、Post、Docs、Wallpaper、Reporting 和 Search。

## 工程与交付

- [`architecture/`](./architecture)：跨领域的工程规则和架构决策。
- [`infra/`](./infra)：本地开发、服务寻址、公共协议、诊断和工程工具。
- [`deploy/`](./deploy)：部署拓扑、发布、切流、回滚和生产验收。
- [`migrations/`](./migrations)：跨应用或跨框架的阶段性迁移记录。

新增文档应优先进入所属应用或 Feature，不再按前端/后端或完成状态划分目录。

## 文档角色与命名

每个业务能力只能有一个无需拼接历史版本即可阅读的当前入口，通常是目录 `README.md` 或语义明确的
`*-contract.md`、`*-counting.md`、`*-boundary.md`：

```text
README / current semantic document
  -> current runtime contract
  -> optional in-progress proposal
  -> migration and historical records
```

- 当前合同使用稳定语义命名，不使用 `v1/v2/v3`、`target`、`fix` 或 `refactor` 作为唯一含义；
- 版本文件可以保留产品阶段或实施历史，但目录 README 必须明确哪个合同当前有效；
- `migrations/` 只记录从 A 到 B 的有限迁移、删改清单和验收证据；迁移完成后，长期合同回到所属
  Application、Feature 或 Architecture；
- `architecture/` 回答跨能力的长期边界，不把一次性 audit、cutover 和完成清单当作新的当前合同；
- historical 文档不得覆盖 current 文档；仍有效的结论应先合并到 current 文档，再把旧文降级；
- 文件名统一使用 kebab-case，目录入口统一使用 `README.md`。

## 状态约定

以下五种状态用于目录 `README.md` 等索引文档，表达该目录或索引的整体权威性。
具体方案正文可以继续使用“已实现”“实施中”“待生产验收”等更细的中文进度说明，
但不得用它们替代目录索引中的标准状态值。

- `current`：当前实现或合同以本文为准。
- `in-progress`：目标已确认，但仍有实施或验收未完成。
- `planned`：处于设计或规划阶段，尚未实施。
- `superseded`：存在明确的新文档取代本文，必须链接到替代文档。
- `historical`：仅保留历史背景，不再作为当前依据。
