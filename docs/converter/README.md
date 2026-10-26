# Converter

> 运行形态：Cloudflare Worker + AnyDoc WASM
>
> UI：Dashboard Import content
>
> 状态：current

Converter 接收 DOCX、PPTX、XLSX，完成格式、大小和内容校验，返回 Markdown、来源 metadata 与 diagnostics。它不负责用户、社区、正文发布或数据库写入。

```text
Dashboard -> Import -> Converter Worker -> AnyDoc WASM -> Markdown
```

## 入口

- 目录：`backend/converter`；包：`@groupher/converter`；Worker / Dev Hub ID：`converter`。
- `POST /convert`：multipart 单文件字段 `file`。
- `GET /health`：服务名 `converter`。
- 本地：`http://127.0.0.1:8000`，Portless：`https://converter.groupher.localhost`。
- 线上：`https://converter.groupher.com`。

本地和生产运行同一 Worker；本地 `cf dev` 使用 workerd，无需 Python、Node 原生转换服务、Container 或 POC Token。

## 支持边界

只支持 DOCX、PPTX、XLSX；PDF/OCR、上传 HTML/HTM 返回不支持。默认上传限制为 25 MiB；真实大文件、CPU 与并发容量未作为本次迁移验收。

线上 URL 由 Import 探测原地址的 Markdown 响应或 `.md` 路径，不经过 Converter，也不抓取 HTML。Cloudflare Browser Run `/markdown` 可以作为未来选项，当前不接入。

## 开发与部署

```sh
pnpm dev:converter
pnpm test:converter
pnpm --filter @groupher/converter run type-check
pnpm --filter @groupher/converter run deploy:dry-run
pnpm --filter @groupher/converter run deploy
```

详见 [项目 README](../../backend/converter/README.md)、[运行时边界](../import/runtime-migration.md) 和 [迁移验收记录](../import/cloudflare-workers-migration-plan.md)。
