# Wallpaper 保存、SSR 静态图与 Hydration 连环故障复盘

> 文档角色：Incident archive；记录 2026-09-05 至 2026-09-06 的本地联调过程。
>
> 状态：保存链路、SSR 静态图、system-dark hydration、编辑器 Pattern 清晰度及 SSR→client Profile
> 接管一致性已修复并完成本地验证。
>
> 当前正式协议以 [Wallpaper 保存链路与数据边界](./save-pipeline-contract.md)、
> [静态 Wallpaper](./static-wallpaper.md) 和
> [Theme source of truth](./theme-source.md) 为准。

## 1. 摘要

这次故障不是一个 root-cause 反复产生不同错误，而是一条尚未完全接通的跨服务链路逐层暴露问题：

```text
Browser export
  -> Assets Hub create Batch
  -> presign / PUT / finalize
  -> finalize 向 Batch 注册四张图片
  -> Phoenix publishWallpaper
  -> Phoenix 使用 service token claim Batch
  -> DB transaction 发布 Snapshot
  -> SSR 查询已发布 Profile 图片
  -> 浏览器按 theme/profile 显示静态图
  -> Editor GPU renderer ready 后接管
```

前四轮错误发生在保存事务之前：内部 endpoint、进程环境、service-auth 和 Generated Batch 协议没有
同时闭环。保存成功后又暴露出两个独立问题：Phoenix SSR 生成了错误的生产 Assets URL，以及 React
streaming hydration 的不同 Suspense boundary 没有使用同一个服务端 theme seed。第一版修复只靠显式
配置绕开了 endpoint fallback，并且编辑态静态层仍只输出一个主题分支；后续审计才把这两个复发入口
从代码契约中移除。

最终确认的根因共有五类：

1. 浏览器 public endpoint 与服务间 batch endpoint 混用；本地 Node/Phoenix 内部请求不应绕到公开 HTTPS host。
2. Dev Hub 管理的 Phoenix 没有同时得到 endpoint 和未跟踪的 service credential；进程启动方式与手动启动不一致。
3. Generated Batch 的 create、register、claim、cleanup 及对应 service scope/subject 没有作为一套协议完整落地。
4. SSR 静态资源 URL、编辑态 CSS 首帧与每个 streaming boundary 的 hydration seed 分别不稳定；
   它们不是 GPU renderer 本身的问题。
5. 编辑器全屏 GPU 预览先错误复用了 `1200×630` 固定尺寸且把 DPR 固定为 1；第一轮清晰度修复又直接改成
   视口逻辑尺寸，破坏了与 SSR responsive profile 的构图一致性。正确边界需要同时分离 profile logical size、
   backing-store pixel size 和 CSS cover presentation。

## 2. 错误时间线

| 轮次 | 表面错误                                                                                 | 实际失败位置                                                 | 最终结论                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `GENERATED_IMAGE_FINALIZE_FAILED: fetch failed`，`/uploads/:uploadRef/finalize` 返回 400 | Assets upload service 在 finalize 后向 Batch 注册生成图片    | finalize 不只是 R2 校验；它还需要访问内部 Batch API。服务间请求误用 public HTTPS endpoint，且 Batch register 边界尚未完整接通                                                                |
| 2    | `assets_hub_batch_endpoint_missing`                                                      | Phoenix `publishWallpaper` 准备 claim Batch                  | Phoenix 进程没有 `ASSETS_HUB_BATCH_ENDPOINT`；修前端 URL 或 upload service 环境不能解决 Phoenix 自己的配置缺失                                                                               |
| 3    | `service_token_unavailable`                                                              | Phoenix 获取 claim/cleanup 所需 service token                | Dev Hub 的 `be.start.managed` 没有读取 `backend/api/.env.local`，因此 endpoint 虽然存在，未跟踪的 client credential 没进入真实运行进程                                                       |
| 4    | `assets_hub_claim_failed`，随后 `/cancel` 400                                            | Phoenix 调 Assets Hub claim；失败后浏览器 best-effort cancel | `assets_hub_claim_failed` 只是包装错误。Batch 必须已经创建且 manifest 完整，同时 verifier 必须按 claim/register/cleanup 的真实 scope 和调用方 subject 校验                                   |
| 5    | 保存成功，但 SSR 阶段静态图片不显示                                                      | Phoenix 返回的 Wallpaper Profile URL                         | Phoenix 本地环境缺少 `ASSETS_PUBLIC_ENDPOINT`，回退成 `https://assets.groupher.com`；同一 `assetPublicRef` 在生产 host 为 404，在本地 host 为 200                                            |
| 6    | client 加载后出现大量 hydration mismatch                                                 | theme-dependent JSX、inline style 与延迟 Suspense boundary   | pre-paint 已经把 DOM 切成 dark，但部分 boundary hydration 时读到运行时 dark，而服务端 HTML 使用稳定 light seed；两次 render 不一致                                                           |
| 7    | 无 WebGPU 的自动化浏览器中 fallback 空白                                                 | `EditorStaticWallpaper`                                      | `composeWallpaperBgCss()` 返回的是 `background` shorthand，却被写入 `backgroundImage`，浏览器判定整个值无效                                                                                  |
| 8    | 修复后仍存在复发风险                                                                     | managed env 与 Assets endpoint 配置                          | managed 入口曾无条件 source 整份 `.env.local`；public、Batch、Delete 代码仍保留跨职责或生产 host fallback，当前成功只是配置恰好一致                                                          |
| 9    | 无已发布产物、system-dark 时首帧仍可能闪 light                                           | `EditorStaticWallpaper` 单分支 inline style                  | hydration latch 只保证 React tree 匹配，pre-paint CSS 无法切换只存在 light 内容的 inline background；编辑态静态层必须 SSR 同时输出双主题分支                                                 |
| 10   | Pattern 在宽屏 Wallpaper 上明显发糊                                                      | 编辑器 WebGPU canvas 尺寸                                    | 全屏实时预览复用 `1200×630` 导出目标且 DPR 上限为 1，浏览器将低分辨率 canvas 放大；修复必须分离 logical、backing-store 与 presentation 三类尺寸，不能用 Pattern 参数掩盖整画布放大           |
| 11   | SSR 与 client 接管后 Pattern 尺寸跳变                                                    | SSR profile 与 client VGPU 构图坐标系                        | SSR 选择 `wide/desktop/tablet/phone` 图片并 `cover center`，第一轮清晰度修复后的 client 却按实际视口重新构图；client 必须选择相同 profile logical size，只把 backing store 提升到 DPR 分辨率 |

每一轮修复后错误向后移动，说明前一处 gate 已经被打通；不能因为错误名称变化就把后一轮错误当成前一轮修复无效。

## 3. 保存链路：尝试、误区与最终根因

### 3.1 只看 finalize 400 不足以定位

最初浏览器只看到：

```text
POST http://127.0.0.1:8002/uploads/<uploadRef>/finalize -> 400
GENERATED_IMAGE_FINALIZE_FAILED: fetch failed
```

容易产生的误判是 R2 PUT、checksum 或文件 metadata 不正确。但当前 finalize 的职责已经超过“确认对象存在”：

```text
R2 HEAD / checksum
  -> completePhoenixUpload
  -> registerGeneratedAsset
  -> POST internal Batch /assets
```

因此 `fetch failed` 发生在 finalize handler 内部时，必须结合 server timing/log 判断是 `r2Head`、
`phoenixComplete` 还是 `batchAssetRegister`，不能只根据浏览器的 finalize URL 判断。

本轮的 root-cause 是 endpoint 拓扑混用：

- `ASSETS_PUBLIC_ENDPOINT=https://assets.groupher.localhost` 面向浏览器读取静态资源；
- `ASSETS_HUB_BATCH_ENDPOINT=http://127.0.0.1:8787` 面向本地服务间 Batch 调用；
- Node/Phoenix 不应通过 Portless 的公开 HTTPS host 回调本机 Worker，否则本地 TLS、路由和进程就绪状态都会被折叠成普通 `fetch failed`。

### 3.2 只给 Assets Hub 配 endpoint 仍然不够

补齐 upload service 的 Batch endpoint 后，错误变成：

```text
assets_hub_batch_endpoint_missing
```

这个错误来自 Phoenix，而不是浏览器或 upload service。`publishWallpaper` 最终由 Phoenix 发起 claim，
所以 Phoenix 自己也必须知道 Batch API 地址。最终将以下环境作为本地运行契约显式注入：

```text
ASSETS_HUB_BATCH_ENDPOINT=http://127.0.0.1:8787
ASSETS_PUBLIC_ENDPOINT=https://assets.groupher.localhost
```

其中 Batch endpoint 用于服务间 register/claim/cleanup；Delete endpoint 用于 provider object 删除；浏览器
仍通过 browser upload/batch host 发起 create/cancel，并通过 public read host 读取静态资源。
`ASSETS_PUBLIC_ENDPOINT` 只用于构造浏览器可读取的不可变图片 URL，三种服务端职责不允许互相 fallback。

### 3.3 endpoint 存在不代表 service-auth 可用

补完 endpoint 后出现 `service_token_unavailable`。这一次请求甚至还没有通过 Assets Hub verifier；Phoenix
无法取得 claim 请求所需的 token。

真正的问题是两种启动路径环境不一致。中间修复曾让 managed 入口也无条件 source `.env.local`：

```text
手动 make be.start
  -> 读取 backend/api/.env.local

Dev Hub be.start.managed（错误的中间修复）
  -> 继承 Dev Hub env
  -> 再 source 整份 .env.local
  -> 同名 endpoint / issuer 被本地文件覆盖
```

Shell 的 `source` 发生在继承父环境之后，同名值一定由文件覆盖；不存在“之后再由 Dev Hub 覆盖”。这会让
Dev Hub UI 中的期望配置与真实 Phoenix 进程 split-brain，并直接违反
[Auth 事故结论](../../auth/fix-history.md)“编排器 env 优先于本地 fallback”的约定。

最终边界恢复为：`be.start.managed` 完全不读取 `.env.local`。Dev Hub 进程管理层只从该文件白名单读取
`SERVICE_AUTH_CLIENT_ID`、`SERVICE_AUTH_CLIENT_SECRET` 两项，并按以下顺序合并：

```text
Dev Hub service definition > Dev Hub parent env > allow-listed .env.local fallback
```

网络 endpoint、issuer、JWKS 和 token endpoint 只由 Dev Hub service definition 注入。这里没有改变
`auth.md` 的 managed 入口约定；只是把 credential fallback 放在编排器内部、且限定为两个 key。

只检查 `.env.local` 文件内容不够；必须确认占用 Phoenix 端口的真实进程是用哪条启动命令和哪组环境启动的。
本次还遇到旧 Phoenix 进程长期占用端口，使新配置启动失败。只有停止精确的旧进程组并重新启动，浏览器才会
真正访问新配置。

### 3.4 `assets_hub_claim_failed` 是包装错误，不是根因

取得 token 后，错误继续移动到 claim。这里必须同时满足三组条件：

```text
Batch state
  create 已完成
  -> 四个 expected variant 均已 register
  -> manifest 可冻结

Service auth
  Phoenix claim: subject=service:phoenix
  scope=assets:generated-batch:claim

  Assets Hub register: subject=service:assets-hub
  scope=assets:generated-batch:register

  Phoenix cleanup: subject=service:phoenix
  scope=assets:generated-batch:cleanup

Capability
  batchRef / requestDigest / policyVersion / signingKeyId 一致
```

最终实现把 Generated Batch 作为 Durable Object 的完整生命周期落地，并让内部授权 helper 接受每个 route
自己的 scope 和允许的 subject。Phoenix 只消费冻结后的 signed publish capability，再在数据库事务中写入
Snapshot、Images、active theme pointer、version 和 Receipt。

浏览器在 publish 失败后会 best-effort 调用 `/cancel`。因此控制台里的 cancel 400 通常是前一个失败造成的
清理噪声，例如 Batch 已被 claim、未创建完成或状态不允许删除；它不能替代前一个 claim/finalize 响应作为
root-cause 证据。

## 4. SSR 静态图：无效尝试与最终根因

### 4.1 尝试：在 Editor route 增加 `StaticWallpaper`

这个方向只解决了 DOM 层缺少已发布静态图的问题，但首轮没有解决图片读取：SSR HTML 即使包含
`StaticWallpaper`，其 URL 仍然是：

```text
https://assets.groupher.com/a/<assetPublicRef>/original
```

本地保存的对象位于本地 Assets runtime。实测同一个 ref：

```text
assets.groupher.com       -> 404 asset_not_found
assets.groupher.localhost -> 200 image/webp
```

因此“组件已经 SSR 出来了”不能证明静态图可见。最终 root-cause 是 Phoenix 构造 GraphQL Wallpaper
响应时没有读取到本地 `ASSETS_PUBLIC_ENDPOINT`，使用了生产 fallback。只补当前本地 env 不能算完成修复，
因为下一次漏配仍会静默请求生产。

最终实现删除了 public URL 的生产默认值，也删除了 Batch/Delete 对 public/read URL 的解析链：

```text
ASSETS_PUBLIC_ENDPOINT      -> public URL only
ASSETS_HUB_BATCH_ENDPOINT   -> generated Batch only
ASSETS_HUB_DELETE_ENDPOINT  -> provider deletion only
```

Phoenix 非 test/seed runtime 在 supervision tree 启动前验证三项配置，缺失立即失败；Assets Hub 的 Batch
register 同样只接受 `ASSETS_HUB_BATCH_ENDPOINT`。Dev Hub 明确给相关进程注入对应地址。
真实 SSR 响应已经包含：

```html
<div
  data-wallpaper-version="1"
  style='--wallpaper-dark-wide:url("https://assets.groupher.localhost/a/.../original")'
></div>
```

四个 Profile URL 均指向本地 host，抽查返回 `200 image/webp`。

### 4.2 Editor 的三层接管顺序

Editor route 不能在 SSR 阶段只输出 GPU canvas。当前接管顺序是：

```text
SSR / renderer loading
  已发布 StaticWallpaper + light/dark 双分支 CSS-only Editor fallback 可见

GPU first frame ready
  GPU EditorWallpaperLayer 淡入
  两个 static layer 淡出

GPU failure
  CSS-only Editor fallback 保持可见
  已发布静态图作为加载期底层，失败态由 CSS draft 接管
```

Editor fallback 外层只负责 GPU 接管透明度，内部同时 SSR 输出 `.theme-light-branch` 和
`.theme-dark-branch`。pre-paint 在第一次绘制前写入 `html[data-theme]`，CSS 选择可见分支；React 不再用
运行时 theme 决定“只输出哪一支”。因此无已发布产物的 system-dark 首帧也不会先显示 light draft。
这个结论依赖 pre-paint script 以同步 inline script 留在 `<head>`、并在 `</head>`/`<body>` 与首次绘制前执行；
React 可能把 stylesheet link hoist 到它前面，因此不能用两者的 HTML 顺序作为契约。关键是浏览器首次绘制时
`data-theme` 已经确定，所以不会触发双分支的 200ms transition。若以后把脚本移动到 body 尾部或改成异步，
必须重新做帧级验证。Editor fallback 外层也不得复用 `.static-wallpaper`，避免继承已发布图片的 CSS variable
背景规则形成第三个、隐式的绘制层。

验证 GPU failure 时又发现一个独立错误：`composeWallpaperBgCss()` 产生的值包含 pattern repeat 和 gradient，
属于完整 `background` shorthand；把它赋给 `backgroundImage` 会得到无效 CSS。改为 `background` 后，无 WebGPU
环境也能显示 pattern + gradient fallback。

### 4.3 Pattern 模糊不是 Pattern 强度或 Blur 配置造成的

故障现场的 `Blur=0`，Pattern 纹理在 shader blur 之前合成，因此调低 Blur 不能解决问题。真正的缩放链是：

```text
Editor 全屏元素（例如 1800×1000 CSS px）
  <- 1200×630 WebGPU canvas（同时 DPR 固定为 1）
  <- 浏览器 cover 放大整张输出
  => gradient、Pattern 和细线一起变糊；Pattern 最明显
```

`1200×630` 是此前误用的固定输出尺寸，不是当前 Wallpaper responsive profile，也不是实时视口尺寸。
第一轮修复先把两类尺寸分开：

- 响应式实时预览：`logicalSize = element.getBoundingClientRect()`；`pixelSize = logicalSize × min(DPR, 2)`；
- 显式导出目标：logical/pixel size 均严格使用 profile 指定尺寸，不受屏幕 DPR 影响；
- Pattern 的 `260px auto` 按 `logicalSize` 计算 repeat，shader resolution 使用 `pixelSize`。否则 DPR=2 后
  Pattern 会错误缩成 130 CSS px，虽然更密但并不更清晰。

没有修改 Pattern asset、默认 tile 大小、intensity、sampler 或 Blur 语义。这一轮只消除错误的整画布低分辨率放大，
避免用视觉参数掩盖渲染表面尺寸错误。

### 4.4 只按实际视口重绘仍会破坏 SSR/client 构图一致性

第一轮清晰度修复把全屏 client VGPU 的 logical size 直接改成元素 rect。画布变清晰了，但 SSR 静态图使用的是
responsive profile 图片，两边仍不是同一个构图坐标系。以复现视口为例：

```text
viewport: 1720×1250 @ DPR 2
SSR media query: desktop
SSR image: 1440×900, background-size: cover
cover scale: max(1720/1440, 1250/900) = 1.389
SSR visible Pattern width: 260 × 1.389 ≈ 361 CSS px

错误的 client logical size: 1720×1250
client visible Pattern width: 260 CSS px
=> GPU 接管后 Pattern 密度跳变约 39%
```

最终运行时规则是：

- 有当前主题的 published Wallpaper 时，client 用与 CSS media query 相同的规则选择 profile；
- VGPU `logicalSize` 使用 profile 的 `1920×1080 / 1440×900 / 1024×1366 / 390×844`；
- `pixelSize = logicalSize × min(DPR, 2)`，canvas 在实际视口内继续 `object-fit: cover; object-position: center`；
- 没有 published Wallpaper 时，Editor CSS fallback 和 client renderer 都按实际视口构图；
- Editor CSS fallback 不再把 Pattern PNG 直接塞进 shorthand。它复用 canonical render spec 的独立 mask layer，
  因而恢复 `260px auto`、tone 和 intensity 语义。

这不是 React tree hydration mismatch；DOM 可以完全匹配，但 SSR bitmap 与 client canvas 在接管时发生视觉跳变。

## 5. Hydration mismatch：为什么前两次处理没有奏效

### 5.1 服务端不应该猜用户最终主题

服务端没有可靠能力知道 `system` 当前解析为 light 还是 dark，也不需要知道。正确边界是：

```text
SSR
  -> 返回稳定 theme seed
  -> 同时返回 light/dark 两套 Wallpaper 资源

pre-paint script
  -> 浏览器读取 themeMode + matchMedia
  -> 首次绘制前写 html[data-theme]

CSS
  -> 根据 data-theme 立即选择正确 token 和静态 Wallpaper
```

所以问题不是“服务端选错了 dark/light 分支”，而是 React hydration 时服务端 HTML 与客户端第一次 render
没有使用同一个 seed。

### 5.2 尝试一：Provider 直接使用 pre-paint DOM 初始化 Store

这能让普通、同步 hydration 的组件立即得到 dark，也能解决部分首屏闪烁。但页面使用 streaming SSR 和 lazy
Suspense boundary：Provider 已经建立运行时 dark store 后，后到的 boundary 才开始 hydrate。

```text
Server boundary HTML = light seed
Provider/runtime store = dark（已由 pre-paint 解析）
Delayed boundary first client render = dark
=> React 报 hydration mismatch
```

只测试一个没有 Suspense 的同步组件会得到错误的“已经修复”结论。

### 5.3 尝试二：在 Provider 的 layout effect 再同步系统主题

把切换推迟到 layout effect 仍然不是可靠边界。根 layout effect 执行时，不代表所有 streamed/lazy boundary
都已经 hydrate；后到的 boundary 依然可能读到已经切换的全局 Store。

因此“整棵树 hydration 完成后统一切换”在 streaming React 中没有一个简单的 Provider 级时刻。

### 5.4 最终方案：每个消费者保留自己的 hydration server snapshot

最终通过 `useSyncExternalStore` 的 server/client snapshot 语义解决：

- `ServerThemeContext` 保存本次 SSR 的不可变 theme seed；
- runtime Theme Store 可以在浏览器创建时立即接受 pre-paint 的真实 dark/light；
- 每个 `useTheme()` 消费者在自己的第一次 hydration render 中返回 server seed；
- 该消费者 hydration 完成后，React 再切换到 runtime Store。

```text
                    root boundary          delayed Suspense boundary
SSR                 light seed             light seed
pre-paint DOM       dark CSS               dark CSS
first hydration     light React snapshot   尚未开始
after root commit   dark runtime           尚未开始
delayed hydration   dark runtime           light React snapshot
after delayed commit dark runtime          dark runtime
```

这不会产生白闪：屏幕实际颜色由 pre-paint 已写入的 `html[data-theme=dark]` 和 CSS 双分支控制；React 的 server
snapshot 只用于确保每个 boundary 第一次 virtual tree 对得上服务端 HTML。它不是把根 DOM 或 CSS 临时改回 light。
这个机制已封装为 theme 模块私有的 `useHydrationLatch()`，不作为通用 `useMounted()` 使用；它只保护
通过 `useTheme()` 读取主题的消费者，直接读取 store/context 的主题分支仍不在保护范围内。

## 6. 最终验证

本次不是只运行单测，还验证了真实 SSR 和暗色浏览器路径。

### 保存与静态资源

- Phoenix 使用新环境重启后，Wallpaper SSR 请求返回 `200`。
- SSR HTML 包含 `data-wallpaper-editor-preview` 和 `data-wallpaper-version="1"`。
- SSR 中四个已发布 Profile URL 全部使用 `assets.groupher.localhost`。
- 抽查已发布 URL 返回 `200`、`content-type: image/webp`。

### Hydration、首帧与 fallback

- 新浏览器页强制 `colorScheme: dark`，等待 lazy boundary 后未捕获任何 hydration mismatch。
- 根节点最终 `data-theme=dark`。
- 已发布静态层解析到本地 Assets URL。
- 自动化浏览器没有 WebGPU 时，Editor CSS fallback 的 computed `background-image` 仍包含 pattern 与 gradient。
- Playwright 在 dark 系统下阻断客户端外部脚本，只保留 SSR 与 pre-paint；首帧断言 light branch
  `opacity: 0`、dark branch `opacity: 1` 且 background 非空。
- `EditorStaticWallpaper` 改为 editor mode 才触发的 lazy import；上述无 hydration 首帧测试仍通过，普通共享
  route 的静态 import graph 不再直接进入 editor composer/store。

### Pattern 清晰度与 SSR→client Profile 接管

- 真实 Chrome/WebGPU 在 `1720×1250 @ DPR 2` 下与 SSR 同样命中 desktop profile：SSR 图片为
  `1440×900`，client canvas backing store 为 `2880×1800`，两者均 `cover center`。
- 同一浏览器 resize 到 `1800×1000` 后命中 wide profile，client backing store 同步变为 `3840×2160`。
- 同页预览卡片的 `247×174` CSS canvas 对应 `494×348` backing store。
- Editor CSS fallback 的 computed style 已恢复 Pattern mask、`260px auto`、`opacity: 0.3` 和正确 tone。
- TS resolver 单测锁定 Profile 边界；CSS source contract test 同时读取 `utils.css`，校验 base `wide`、
  light/dark media variable 和 `wide -> desktop` cascade 顺序。它锁定源码映射，但不替代真实浏览器
  computed-style matrix，也不执行完整 cascade 或证明任意规则重排后的行为等价。DPR 上限、显式导出目标和
  profile HiDPI backing store 也有独立单测；Pattern repeat 始终基于 logical size，不会因 DPR 改变构图。
- resize 跨 Profile 时 active Profile 立即与 CSS 对齐并撤销旧 GPU handoff；renderer Profile 仅在 `150ms`
  稳定后替换，避免边界抖动反复执行 vgpu init/prepare。等待期间静态层保持可见。
- Chromium 在 `1600×1000`（desktop）与 `1601×1000`（wide）间以 `50ms` 往返时复用同一个
  `1440×900` canvas，并在 pending wide 阶段将 GPU 设为 `opacity-0`、静态层设为 `opacity-100`；稳定后才替换为
  `1920×1080` canvas。

这里的 `150ms` 仅用于后续 resize 的 Profile replacement debounce，不是 SSR 或首帧必须等待的协议值。当前实现
仍把 hydration 后首次 `wide -> client Profile` 校正纳入 settle，可能先启动一次 wide renderer；后续应保留首次
hydration tree 一致，在 commit 后直接初始化真实 client Profile，不能用 render-time `window` 分支规避等待。
这段等待的目的只是防止窗口在 `desktop/wide` 边界来回拖动时连续 remount GPU renderer；旧 renderer 在
pending 期间保持 mounted 但不可见，最多持续一个 settle 窗口。
pending 期间旧 renderer 保持 mounted 且不可见属于已知短时成本，是否暂停其提交必须由 GPU trace 决定。

### 自动化检查

- Phoenix endpoint 配置单测覆盖职责隔离、缺失 fail-fast 与 test/seed 例外。
- Dev Hub 进程测试真实启动 child process，证明 parent/orchestrator 值不能被 allow-listed file fallback 覆盖。
- Assets Hub 回归测试证明只有 public endpoint 时 Batch register 会直接报缺失，而不会发向 public host。
- 新增 delayed Suspense hydration 回归测试，覆盖 server light seed、pre-paint dark、boundary 延迟 hydrate。
- Editor static SSR 测试同时防止单主题输出和把 background shorthand 再写回 `backgroundImage`。
- E2E 启动 Dash 会先执行 assets sync 和 revision worker build。同步脚本采用 content-aware mirror，
  worker 也先在内存构建再按字节差异落盘；内容相同的图标、preview、wallpaper runtime asset、manifest
  和 worker 不再删除或改写，只清理真实 stale 文件。否则另一个正在监听同一 worktree 的 Vite 实例会
  收到数千次无意义失效，浏览器可能以 `Failed to fetch dynamically imported module` 落入 route error
  boundary，即使该模块随后已经恢复 `200`。
- Frontend Core 与 Local Dev Hub TypeScript 检查通过。
- 相关前端文件 lint 零告警，目标 diff whitespace 检查通过。

浏览器控制台仍可能存在与本事故无关的噪声，例如 mock `PagedPosts` 500、旧 community logo 404，或自动化
Chromium 不支持 WebGPU 的 adapter 错误。验收时必须按错误来源分类，不能把“控制台不为零”重新等同于
Wallpaper hydration 失败。

## 7. 后续排查清单

再次遇到 Wallpaper 保存或刷新问题时，按 hop 顺序取证，不要跨层猜测：

1. 确认当前 theme 是否 touched；NONE 不应导出图片。
2. 确认 `prepareWallpaperUpload` 返回 batch capability 和四个 upload intent。
3. 确认 Assets Hub Batch create 成功。
4. 对每个 Profile 分别确认 presign、PUT、finalize 和 batch register。
5. claim 失败时读取 Assets Hub 原始响应，区分 401、403、manifest incomplete、claim conflict 和 capability invalid。
6. 检查占用端口的真实进程及其启动命令；改动 endpoint/credential 后，核对真实进程的非敏感 env
   或配置 fingerprint，不要只看 `.env.local`。禁止把 secret 通过 `ps eww` 或日志完整输出。
7. 保存成功后直接请求 GraphQL 返回的静态 URL；不要先从 React renderer 猜原因。
8. 检查 SSR 原始 HTML 中是否存在静态层、实际 URL、light/dark CSS variables 和 version。
9. hydration 问题必须用 system-dark 和延迟 Suspense boundary 复现；普通同步 render 测试不够。
10. GPU failure 与静态读取分开测试；静态运行态不应依赖 WebGPU。
11. 搜索 Assets 网络代码中的生产 host 和 `||` fallback；确认剩余生产 host 只用于稳定的 auth
    resource/audience 或示例，不是请求 endpoint。
12. 并行运行 managed dev server 与 E2E 时，如出现瞬时 dynamic import 失败，先核对报错时间戳是否与
    `sync:assets:*` 重合；重复同步必须满足目标文件改写数为 0。
13. Pattern 发糊或接管时跳变，先记录 active profile、canvas attribute size、`getBoundingClientRect()` 和 DPR；
    有 published Wallpaper 时应满足 `canvas size = profile logical size × min(DPR, 2)` 并使用 cover，不能只比较 rect。

## 8. 防回归原则

- public read、browser upload、internal Batch 和 internal Delete 是独立职责，不能因为都属于 Assets Hub 就
  用解析链互相兜底。
- managed Makefile 入口不读取 `.env.local`；编排器如需本地 credential fallback，只能白名单补缺，且
  合并优先级必须是 orchestrator/parent env 高于文件。
- Dev Hub 管理的服务必须同时声明网络环境和 credential 来源；readiness 不能只证明端口打开。
- Generated Batch 是 create → register → claim → cleanup 的协议整体，不能只实现其中一个 endpoint。
- 聚合错误码必须保留底层响应用于日志；toast 错误名称不能作为 root-cause。
- SSR 返回双主题数据，不根据 `system` 猜用户主题。
- pre-paint 可以提前改变 DOM/CSS；React 的每个 hydration boundary 仍必须使用服务端 seed 完成首次匹配。
- 任何 SSR/theme 修复必须覆盖 delayed Suspense hydration。
- 编辑态 theme-dependent 静态视觉必须 SSR 双分支并由 pre-paint CSS 选择；hydration latch 不能替代视觉双分支。
- 编辑器静态 fallback 消费 CSS composer 时，应尊重返回值是 shorthand 还是单一 image value。
- 实时 GPU preview 的 profile logical size、backing-store pixel size 与 CSS presentation size 必须分离；
  published SSR 与 client 必须选择同一个 responsive profile，Pattern repeat 必须基于 logical size 计算。
- 生成资产同步必须保留字节未变化文件的时间戳；独立端口不能隔离共享 worktree 的 file-watcher 副作用。

## 9. 相关文档

- [Assets 静态资源读取链路：空白背景与解耦方案](../../assets-hub/read-path.md)
- [Theme source of truth and SSR/first-paint contract](./theme-source.md)
- [TanStack Start SSR 首屏样式闪烁](../../architecture/ssr-flash.md)
- [Wallpaper 保存链路与数据边界](./save-pipeline-contract.md)
- [Wallpaper 后续工作](./followups.md)
