# Document Converter

> 运行形态：Python 3.12 + FastAPI
>
> UI：无独立 UI
>
> 当前状态：已存在于 `backend/document-converter`，并已接入 Dev Hub / Portless

## 定位

`document-converter` 是无业务状态的单文档格式转换服务。它接收一个外部文档，
完成安全校验后输出 Markdown 和结构化 diagnostics。

它不知道 Groupher 的用户、社区、文章、GraphQL 和 Rich Editor 状态，也不负责
把 Markdown 写入任何 Thread。

## 当前服务

- `GET /health`：返回运行状态。
- `POST /convert`：接收名为 `file` 的 `multipart/form-data` 文件。
- 支持 PDF、DOCX、PPTX、XLSX、HTML 和 HTM。
- 使用 MarkItDown 的 stream API 转换，不把用户输入当作本地路径或 URI。
- 返回 Markdown、原文件元数据和有界 diagnostics。
- 本地由 Dev Hub 作为 `document-converter` 管理，固定端口 `8000`；Portless alias 为
  `https://converter.groupher.localhost`。

当前成功响应：

```json
{
  "markdown": "# Converted document",
  "source": {
    "filename": "document.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "sizeBytes": 1234
  },
  "diagnostics": []
}
```

## 提供的能力

- 文件名、扩展名、MIME type 和实际大小校验。
- PDF/OOXML 文件签名校验。
- Office archive 展开大小、条目数量和路径安全校验。
- 大文件从内存自动 spool 到临时磁盘。
- 转换异常到稳定错误码的映射。
- 可选的浏览器 Origin allowlist。

## 基本流程

```text
Caller
  -> upload one file
  -> validate origin, name, MIME, size and signature
  -> validate archive safety when applicable
  -> MarkItDown stream conversion
  -> Markdown + source metadata + diagnostics
  -> close and discard temporary stream
```

## 边界

`document-converter` 不负责：

- 用户登录、社区权限和配额。
- 外部 Platform OAuth 或来源分页。
- 多文档 Dataset、Preview、Review 和 Apply。
- Markdown 到 Rich Editor AST/BodyBag 的转换。
- 原文件或转换结果的长期存储。

调用方必须在进入服务前完成业务权限和容量判断，并在返回后决定 Markdown 如何进入
Groupher。批量导入由 `content-import` 编排；直接上传单篇文档也应由对应业务入口
负责。

调用方可以携带 Phoenix 签发的短期 delegation token。`document-converter` 在本地
验证签名、目标服务和允许的转换范围，不为鉴权回访 Phoenix。

## 部署与演进

关于从当前 Vercel project 迁移到 Fly、以及它和 `content-import` 的边界，见
[`../todo/migrate_doc_import_runtime.md`](../todo/migrate_doc_import_runtime.md)。

本地首次启动前先安装 Python 3.12 virtualenv：

```sh
make be.document-converter.install
```

之后可以直接运行：

```sh
make be.document-converter.start
```

Dev Hub 使用同一个 Makefile 入口；如果 `backend/document-converter/.venv` 不存在，
服务会显示为不可启动，避免把缺少依赖误判为运行时故障。

该服务作为独立 Vercel project 部署，Root Directory 为
`backend/document-converter`，不修改 Groupher 其他前端项目的根部署配置。

未来若加入 URL-to-Markdown，仍应保持“单输入到 Markdown”的纯转换边界。网页抓取
策略、登录态、来源同步和动态页面识别若逐渐变成复杂来源逻辑，应由
`content-import` 或专门 adapter 编排，而不是把本服务扩展成 crawler。
