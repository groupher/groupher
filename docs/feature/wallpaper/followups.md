# Wallpaper 后续工作

> 文档角色：Backlog；不定义当前 Active runtime contract
>
> 日期：2026-09-06
>
> 当前契约：[当前 theme 单独保存重构](./current-theme-save-refactor.md) ·
> [保存链路与数据边界](./save-pipeline-contract.md) ·
> [Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md) ·
> [响应式 Profile](./responsive-revisions.md) ·
> [实时预览架构](./preview-architecture.md)

本文记录已经确认、但不阻塞当前 Wallpaper 保存与 Root/Content 绘制收敛的后续事项。
这里的条目不应被实现为旧 v1 链路的兼容分支。

## 当前状态摘要（2026-09-05）

当前 Wallpaper 重构的核心链路已经完成：当前 theme 单独保存、非 `NONE` 统一导出四张 Profile 图片、
`NONE` 不生成图片、Snapshot/Images/Receipt 事务提交、Settings codec、GraphQL typed metadata、
Root/Content 条件绘制、SSR→GPU 的 Profile/DPR 构图接管，以及 Static/Editor 共用一个
`WallpaperSnapshot` 持久化模型均已落地。

下面列出的未完成项不代表保存模型或 fallback 核心逻辑仍缺实现，主要是：

- fallback 的 SSR、预览宿主、布局和真实浏览器验收；
- 保存链路的部署后联调和编辑器脏状态体验；
- Upload、history/restore、remove 等编辑器 UI；
- WebGPU 跨浏览器、真实设备和性能矩阵（由 §4 的独立文档管理）。

## 1. 编辑器功能接线

### 1.1 Upload

Upload 面板目前只完成 UI 占位。后续需要接入既有 Assets Hub 上传协议：

1. 用户选择图片并完成上传、校验和 finalize；
2. 将返回的 `assetPublicRef` 写入当前 theme 的 `customWallpaper` 图片分支；
3. 保存时沿用当前 theme 的 Settings → 导出/上传 → Snapshot 流程。

Upload 不新增独立的 static/editor 数据模型，也不把临时 `uploadRef` 保存到 Wallpaper
设置中。

### 1.2 History 与 restore

编辑器需要补齐 `wallpaperHistory(theme)` 查询和 `restoreWallpaperSnapshot` 的 UI 调用方。
历史只跟随当前 theme tab 查询；恢复使用公开的 Snapshot `id`，由后端在同一事务内更新当前
theme 指针和全局 `version`。

### 1.3 删除 Wallpaper

`removeWallpaper` 对应保存 `type: 'none'`。后续补 UI 入口，确认保存后：

- 当前 theme 的 Wallpaper branch 变为 `null`；
- Root 页面基础色仍由页面自身绘制；
- 不生成或上传纯色占位图片；
- 不影响另一 theme 的 Wallpaper。

## 2. Static 与 Editor 的边界

Static 和 Editor 分开的是消费模型与运行时，不是数据库里的两套版本模型：

| 层     | 读取内容                                               | 运行时职责                    |
| ------ | ------------------------------------------------------ | ----------------------------- |
| Editor | 当前 theme 的 settings draft、active Snapshot、history | GPU 实时预览、保存、恢复      |
| Static | 已发布 `dashboard.wallpaper` 的当前 theme 图片引用     | 按 theme/profile 显示静态图片 |

持久化层只有一种 `WallpaperSnapshot`。一次保存产生一个 Snapshot，Snapshot 同时承载
settings 和对应的静态 Profile 图片；active 指针按 theme 分开。不要新增
`StaticWallpaperRevision`、`EditorWallpaperRevision` 或类似的平行表。

`static_revision` 是旧的 Dashboard embed 字段，已经从当前 Wallpaper embed 和默认字段定义中
移除。后续不应新增 `editor_revision` 作为替代；静态消费直接读取 `dashboard.wallpaper`，
编辑器通过 settings/history API 读取编辑所需数据。

## 3. 核心链路剩余验收与编辑器接线

### 3.1 Root/Content fallback 与预览验收

- [x] Global/Auth Preview host 复用 Root page color，并使用 `hasPreviewWallpaper` 控制 Content surface；真实浏览器验收仍待完成。
- [x] SSR 首次 paint 前同步确定当前 theme 的 Wallpaper/Content surface 状态；Editor CSS draft 同时输出
      light/dark 分支，并通过阻断 hydration 脚本的 system-dark Playwright 测试确认首帧不回退 light。
- [ ] theme 切换分别验证 light-only、dark-only、NONE 和未初始化 `version: 0`。
- [x] 补齐 `StaticWallpaper` 四态单测：light-only、dark-only、双 nil、version 0；确认无 `url()`，且 dark
      不引用 light 分支。
- [x] 补齐 `Main.background` 布局集成测试：双 nil 时 Root 仍有页面基础色，Content surface 为透明且无
      `backdrop-filter`。
- [x] 普通页面不加载 editor settings/history；`PageCommunity` 已删除 `wallpaperSettings`，GPU runtime 继续保持
      Static/Editor 运行时边界。
- [x] 已发布 Wallpaper 的 SSR static 与 client GPU 使用同一 responsive Profile、逻辑画布和 `cover center`；
      backing store 按 DPR（上限 2）提高清晰度，Pattern repeat 不随 DPR 改变。
- [x] resize 跨 `desktop/wide` Profile 后重置 GPU ready identity，等待新 Profile 首帧后再接管；无已发布图片
      时 CSS draft 与 GPU 共同使用 viewport 构图。
- [x] active Profile 立即跟随 CSS，GPU renderer Profile 在边界稳定 `150ms` 后替换；等待期显示静态层，避免
      `16/10` 附近反复初始化 renderer，同时不引入 CSS↔TS 状态性迟滞。
- [x] Profile contract test 读取 `utils.css`，锁定 base `wide`、light/dark media variable、cascade 顺序与 TS
      resolver 的 `16/10` 边界；真实 computed-style 浏览器矩阵仍随跨浏览器验收执行。
- [ ] 消除 hydration 后首次 `wide -> client Profile` 也等待 `150ms`、可能先初始化 wide renderer 的额外工作：
      首次 client render 继续复用 SSR snapshot，commit 后立即解析并只挂载真实 client Profile；禁止使用
      render-time `typeof window` 分支制造 hydration 差异。
- [ ] 记录 resize settle pending 期间隐藏 renderer 的 GPU frame/资源成本；只有 trace 显示预算压力时才暂停其
      rAF/提交，当前不为最多 `150ms` 的隐藏窗口增加生命周期状态机。
- [ ] 在长页面和真实 Preview host 完成浏览器验收：Root 颜色覆盖全高，无重复 alpha 合成造成的色块。

### 3.2 保存链路的部署后验收

- [ ] 在部署环境完成 GraphQL smoke，覆盖当前 theme 保存、NONE 删除和并发版本错误。
- [ ] 使用真实 Assets Hub 完成 prepare、presign、PUT、finalize、claim、Receipt 全链路验收。
- [ ] 在部署环境验证 CDN 返回的 Profile 图片切换，以及有 Wallpaper、NONE、未初始化三种状态下的
      Content surface 行为；这与 §3.1 已完成的本地 SSR→GPU Profile 接管测试是两个验收层级。

### 3.3 编辑器请求与状态体验

- [ ] 完成 Upload 面板真实上传和 `assetPublicRef` 写回。
- [ ] 完成当前 theme 的 history 列表、restore 和 remove UI。
- [ ] 补两支独立 dirty draft 的切换、离开 route 提示和恢复后的 baseline 更新。
- [x] 离开 Wallpaper route 的 blocker 已接入本地化确认文案；仍需补真实跨 route remount 的 draft
      浏览器用例，store-level reconcile 用例不能替代 route 生命周期验证。
- [x] Assets Hub cleanup/授权回归：实际 DO cleanup 的 probe-unknown 保留、`/cleanup` 的 503 映射、
      register/claim/cleanup 的 401/403 service-auth 矩阵，以及 Browser `/cancel` 的无效 capability 400
      均已落地并有测试。
- [ ] 为 publish loser cleanup 补真实并发时序测试；Phoenix 与 Hub 的双 probe 只缩小竞态窗口，不能
      代替后续 publish-finalization/cleanup lease 的跨系统原子协议。
- [x] `WallpaperEditor` route-only 请求已存在；普通 `PageCommunity` 已删除 `wallpaperSettings` 选择和解析链路。
- [x] `contentShadow` draft 已从 Wallpaper store/savable patch 拆出，Dashboard 普通字段 mutation、baseline
      reconcile，以及 Appearance Save 两 mutation 的部分成功语义已落地。
- [x] 完成历史 hard cut：不迁移或兼容 pre-cutover Snapshot/Receipt，history/restore 只接受四键 post-cutover
      Snapshot；post-cutover 新 Snapshot 才进入最近 5 次 history 与 `deleteAfter` 配额。
- [x] 迁移范围外仍保留 v1 `static_revision` 语义的文档已明确标注为 incident/archive；仅历史归档文档保留原术语，
      不作为当前实现依据。

## 4. 明确不属于本 backlog

WebGPU 的 Safari/移动端矩阵、连续导出、device loss、WebGL/WebGPU A/B 和 shader 性能验收，
继续由 [`shaders_v1.md`](./shaders-v1.md) 管理；它们不应反向改变 Static/Editor 的持久化边界。
