# Import / Converter 运行时

> 状态：current

两个服务已迁移到 Cloudflare；本文件描述当前运行形态。执行记录、部署版本与未验收项见 [迁移记录](./cloudflare-workers-migration-plan.md)。

## 统一命名

| 项目      | 目录                | 包名                  | 本地端口 | 生产域名                 |
| --------- | ------------------- | --------------------- | -------- | ------------------------ |
| converter | `backend/converter` | `@groupher/converter` | 8000     | `converter.groupher.com` |
| import    | `backend/import`    | `@groupher/import`    | 8001     | `import.groupher.com`    |

Dev Hub ID、Worker 名称、开发入口均使用 `converter` / `import`。线上域名也已统一为 `converter.groupher.com` / `import.groupher.com`。Auth resource URI 随域名更新为 `https://import.groupher.com/internal`；audience/scope 等授权语义保持不变。

## 运行链路

```text
Browser -> Dashboard proxy -> Import Worker
                               |-> Converter Worker -> AnyDoc WASM -> Markdown
                               |-> Cloudflare Workflows -> R2 artifacts
                               `-> Phoenix -> Job / BodyBag / Apply -> PostgreSQL
```

- Converter 只处理 DOCX、PPTX、XLSX；不支持 PDF/OCR、HTML 上传。
- URL 来源只探测 `Accept: text/markdown` 和 `.md` 路径；两者都失败就拒绝，不增加浏览器抓取服务。
- Import 的 HTTP、分析和 Apply 编排运行在 Workers/Workflows，临时数据保存到 R2。
- Phoenix 负责授权、ImportJob、幂等、BodyBag staging 和最终数据库写入。
- 本地使用 `cf dev` 的 workerd 与 R2/Workflow 模拟；没有另外一套 Python 或 Node 服务。

## 开发、部署与验证

```sh
pnpm dev:converter
pnpm dev:import
pnpm test:converter
pnpm test:import
pnpm --filter @groupher/import run test:worker
pnpm --filter @groupher/converter run deploy:dry-run
pnpm --filter @groupher/import run deploy:dry-run
```

Import 的 `.env` 提供本地服务客户端凭据及 preview signing secret；不把生产凭据写进仓库。非密钥 endpoint 由 `cloudflare.config.ts` 明确声明。默认 `cf dev` 只使用本地模拟资源。

部署时同步 Converter、Auth resource registry、Import converter endpoint 和 Dashboard Import endpoint/resource，确保新域名和服务鉴权一致。

## 已完成与后续

已在生产 `home` 验证六篇仓库文档的 Preview、Apply、编辑器与 GraphQL 回读；URL 导入和 DOCX 浏览器上传也完成保存、刷新验证。三个格式的生产转换请求均通过。

旧 Python 项目、旧部署配置、Workflow SDK/Blob adapter、POC 模式和对比用 Node 服务已移除。没有专属的旧平台项目可删除，共享项目不在本次范围内。

CPU、真实大文件、并发容量和告警通知送达验证后置，不把小样本通过视为性能验收。
