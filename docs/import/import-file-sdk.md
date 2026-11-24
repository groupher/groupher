# Import PreviewStore 与临时对象存储

> 状态：current

本文负责 PreviewStore、R2、Files SDK 和 Phoenix staging 边界。产品流程见 [Bulk Import](./bulk-import.md)，实际部署与证据见 [迁移记录](./cloudflare-workers-migration-plan.md)。

## 当前架构

```text
Import Worker / Workflow
  -> PreviewStore contract
     -> FilesPreviewStore -> Files SDK R2 adapter -> R2 binding
  -> Phoenix Job / BodyBag staging -> atomic Apply -> PostgreSQL
```

`backend/import/src/lib/content-import/core/preview-store/cloudflare.ts` 是本地和生产 Worker 的 composition root。两种环境都注入 `ARTIFACTS` R2 binding；本地由 `cf dev` 模拟，不调用线上存储。

`store.ts` / Files SDK fs adapter 仅供隔离的 Node 单元测试使用，不是另一套产品运行时，也不作为生产失败时的回退。设置 `DOCS_IMPORT_PREVIEW_DIR` 可隔离测试目录；该适配器仅接受 `DOCS_IMPORT_PREVIEW_STORE=local`。

## 权威边界

- R2 保存来源片段、SourceAnalysis、SourceTree、Dataset、Preview、诊断和 attempt artifacts。
- Phoenix 保存 ImportJob、JobItem、BodyBag staging 和最终 Docs 数据；Worker 不直连数据库。
- Dashboard 是用户授权代理，不持有或读取 R2 对象凭据。
- 业务层只调用 PreviewStore；存储 key、Files SDK 和 provider binding 留在适配层。

## 不可变对象契约

Preview 绑定 `previewRef`、owner、community、来源与 TTL；Workflow 和 attempt 引用分开持久化。读取和 Apply 都重新验证用户与社区归属，不能把随机引用当作授权。

```text
content-import/previews/
  _preview-records/v1/<previewRef>.json
  <previewRef>/
    analysis-run.json
    attempts/<attemptRef>/
      dataset/...
      review/...
      ready.json
```

- 已有不可变对象通过 create-or-assert-same 校验，重试不能静默覆盖不同内容。
- 同一 attempt 的持久化结果完成后才写 `ready.json`，读取方拒绝半成品。
- 原始输入不能直接拼入 object key；来源引用必须经过领域 contract 校验。
- 下载和解析的内存工作集有界，跨步骤传对象引用，避免把整个文件放进 Workflow step result。
- R2 bucket 为 `groupher-content-import`；现有 key namespace 是存储契约，不随服务目录重命名。

## 生命周期

Preview 的应用 TTL 是一小时；取消、Apply 完成和过期路径使用 PreviewStore cleanup。来源片段等临时对象另由 R2 lifecycle 兜底：`content-import/` prefix 三天过期。

Multipart 未完成上传的七天 abort 规则继续保留。生命周期不负责 Phoenix 业务状态；历史数据迁移与历史 Job 清理按明确范围排除。

## Apply

用户确认后创建 Phoenix ImportJob。Apply Workflow 每篇文档单独 staging，最后调用一次原子 Apply。Phoenix 重新校验目标 revision、权限和 staging 完整性，再写入最终 Docs。

验证应覆盖 immutable artifact、一致性检查、ready receipt、用户归属、失败/取消/过期，以及 staging → Apply → 正文与 TOC 回读。实际生产小样本结果见迁移记录。

## 开发与测试

```sh
pnpm dev:import
pnpm --filter @groupher/import run test
pnpm --filter @groupher/import run test:worker
pnpm --filter @groupher/import run type-check:workers
```

本地启动无需对象存储账号或旧平台 CLI。需要联调 Phoenix 写入时，使用已注册的开发 service client 和本地 Phoenix/Auth；不要借用其他服务的凭据。
