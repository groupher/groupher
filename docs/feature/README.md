# Features

> 状态：current

本目录按主要业务能力和完整逻辑链路组织文档。一个 Feature 可以同时覆盖前端交互、
后端 Context、GraphQL、数据模型、权限、生命周期和测试，不再按技术层拆分。

- [`activity/`](./activity)：业务事件、产品活动日志与审计面。
- [`analysis/`](./analysis)：Article 业务指标事件、小时趋势与产品查询。
- [`article/`](./article)：Article 版本、Trash 与 Audit。
- [`artiment/`](./artiment)：Artiment 公共命令边界。
- [`community/`](./community)：Community 成员、计费和产品能力。
- [`docs/`](./docs)：Docs Tree、Snapshot、Cover 和 ID 模型。
- [`front-desk/`](./front-desk)：顶层资源单条读取、全局入口与领域委托边界。
- [`gate/`](./gate)：读取范围、操作准入和 typed context。
- [`interaction/`](./interaction)：Upvote、Collect、Emotion 与同步读取投影。
- [`view-tracker/`](./view-tracker)：Article 有效阅读的身份识别、分类、去重与计数。
- [`lifecycle/`](./lifecycle)：资源状态、转换和 blocker。
- [`post/`](./post)：Post 合同、Solution 与 Merge。
- [`reporting/`](./reporting)：举报事实与审核聚合。
- [`search/`](./search)：搜索链路与重构。
- [`wallpaper/`](./wallpaper)：编辑、保存、SSR、渲染和导出。
