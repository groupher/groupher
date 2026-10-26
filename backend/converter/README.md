# Converter

Converter 将 DOCX、PPTX、XLSX 转成 Markdown，返回来源信息与 diagnostics，供 Import 和 Dashboard 的文档导入使用。

## 运行架构

```text
Dashboard -> Import -> Converter Worker -> AnyDoc WASM -> Markdown
```

目录为 `backend/converter`，包名为 `@groupher/converter`，本地与生产 Worker 均命名为 `converter`。本地通过 `cf dev` 在 workerd 中运行同一份 `src/worker.ts`；生产入口是 `https://converter.groupher.com`。不需要 Python、Node 原生转换服务或 Container。

- `POST /convert`：multipart 文件字段 `file`，返回 `markdown`、`source`、`diagnostics`。
- `GET /health`：服务名 `converter` 和实际环境。
- 仅支持 DOCX、PPTX、XLSX；PDF、OCR、上传 HTML/HTM 不在范围内，返回 415。
- 上传上限默认 25 MiB；转换会读取完整的有界文件。真实容量、CPU 和并发测量后置，25 MiB 不代表所有文件均已容量验收。

## 开发与验证

在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm dev:converter
# http://127.0.0.1:8000/health
# https://converter.groupher.localhost/health （需要启动 Portless）
```

另一个终端：

```sh
pnpm test:converter
pnpm --filter @groupher/converter run type-check
pnpm --filter @groupher/converter run deploy:dry-run
pnpm --filter @groupher/converter run test:worker:smoke
```

HTTP smoke 覆盖三个格式、错误格式、损坏文件、超限文件和健康检查。可通过 `CONVERTER_BASE_URL` 指定已部署服务；其中包含六请求小样本突发检查，不替代容量验收。

## 部署

```sh
pnpm --filter @groupher/converter run deploy
```

`cloudflare.config.ts` 仅提供 `development` / `production`，生产域名绑定在配置中。部署使用已有 Cloudflare CLI 身份；不需要 POC Token。

[部署记录与完整验收](../../docs/import/cloudflare-workers-migration-plan.md)
