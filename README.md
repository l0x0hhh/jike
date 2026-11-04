<!-- 架构说明：目录、评价读写、数据库升级与导入密钥的实际边界。 -->
# 春晖园菜品评价面板

把原来那份只能横向滚动的 WPS 表格，变成一个**手机上能顺手填、电脑上看得清**的面板。

- 16 家商家 · 371 道菜，菜品目录来自 [春晖园商家菜品评价表](https://www.kdocs.cn/l/ckihNLEyzhdS)
- 免登录，填个昵称就能写评价
- 评价不可修改、不可删除（对应原表"请勿随意删除或修改他人的评价"）
- `/news` 提供安智前沿「安全与 AI 日报」站内阅读，每天北京时间 08:05 后更新

---

## 设计方向：编辑式数字评分（方向 B）

设计走过一轮**三方向探索**（初稿与决策依据见 `design-demos/`，落档在 `design-demos/direction-approved.md`），
最终选定「编辑式数字评分」，灵感来自 The Infatuation 的设计系统（Brooklyn 的 Center 操刀）：

| 决策 | 内容 |
|---|---|
| **数字，不是星星** | 评分从 ★☆ 换成 **1–5 数字量表**（大数字当视觉主角）——分数才是决策依据，星星是模糊表达；且 ★☆ 是 AI 产出里最常见的视觉最大公约数之一 |
| **一个字体家族撑层级** | 拉丁与数字用 **Archivo / Archivo Black**（`next/font` 自托管），中文回落系统字、靠字重与字距承层级 |
| **冷色强调** | 主色是**被拉满的蓝 `#1B44E8`**，不是暖橙——食堂环境已经全是暖色，界面再用暖色会被环境吞掉 |
| **直角 + 实底描边** | 圆角归零，改用 2px 实底描边与硬偏移阴影；状态靠**反白**区分而非圆角与淡色底 |
| **去掉 emoji** | 空态、搜索框等处的 emoji 全部移除，改用排印表达 |

完整规范（色板与对比度、字号刻度、形状语言、断点、组件状态、无障碍清单）见 **[DESIGN.md](./DESIGN.md)**。

> 落地时守住的一条硬约束：**不为视觉牺牲可用性**。搜索、5 种排序、商家筛选、评分门槛、
> 空态、整卡可点、双 sticky 操作条、乐观提交、键盘 `/` 聚焦等功能均保留。

---

## 技术栈与选型理由

| 层 | 选型 | 为什么 |
|---|---|---|
| 框架 | **Next.js 16.4**（App Router）| Netlify 官方支持最完整；静态化 + 边缘缓存开箱即用 |
| 语言 | TypeScript 5.8 | 菜品 id / 统计字段全链路有类型，避免改价改错行 |
| 样式 | Tailwind CSS 3.4 | 设计 token 化，改主题只动 `tailwind.config.ts` |
| 数据库 | **Supabase**（PostgreSQL）| 托管数据库，支持 RLS 行级权限 |
| 部署 | **Netlify** | CDN 全球节点，`s-maxage` 静态缓存扛读并发 |

> 依赖安全状态会随时间变化，应定期检查并更新 Next.js 等依赖。

---

## 数据流与容量边界

菜品目录随代码发布；评价及评分统计从 Supabase 读取，评价直接写入 Supabase。容量和成本取决于实际在线人数、写入频率、套餐和网络情况，需要压测后再确定。

**1. 只有菜品目录不查数据库**

菜品目录是构建期就确定的静态数据，页面 `force-static` 全量静态化。
页面可以利用 Netlify CDN 缓存；浏览器仍会请求数据库获取评价和评分。

**2. 写路径浏览器直连 Supabase，不过 Functions**

评价提交由浏览器直接打 Supabase REST（PostgREST），不绕 Netlify Functions。
菜品评价首页订阅评价通知，合并通知后刷新统计与最新评价，并每 30 秒补查；在线人数增加会增加读取、订阅及网络开销。

**3. 聚合预计算，不做实时 COUNT**

执行 `supabase/hardening.sql` 后，`dish_stats` 由触发器维护评分总和和数量，并从评价明细重建历史统计。
面板读统计 = 一次 `SELECT`，与评价总量无关。否则每次打开面板都要扫全表算 COUNT，并发一上来必慢。

**4. 索引覆盖实际查询**

| 索引 | 服务的查询 |
|---|---|
| `idx_dishes_merchant_sort` | 数据库目录按商家及顺序查询（当前页面筛选在本地完成） |
| `idx_reviews_dish_created` | 单道菜的评价列表（倒序） |
| `idx_reviews_client_created` | 设备维度限流查询 |
| `idx_dishes_name` (gin_trgm) | 数据库菜名模糊查询（当前页面搜索在本地完成） |

**5. 基础防刷与限制**

- 前端：60 秒内最多 5 条，超限直接拦（`checkRateLimit`）
- 数据库 RLS：昵称 ≤20 字、正文 ≤500 字、标签 ≤6 个，不开放普通用户 UPDATE / DELETE policy。
- `hardening.sql` 对同一客户端标识在数据库侧限制 60 秒 5 条，并由数据库确定提交时间。标识由客户端提供，可以更换或伪造，不能阻止有意刷写；公开推广仍需要可信入口、限流及内容治理。

同一热门菜品的统计更新会竞争同一行；实时通知也会引起客户端刷新。项目尚无可证明具体并发容量的压测结果。

**6. 日报由服务端读取，不进浏览器跨域请求**

`/news` 通过安智前沿公开的 `/api/v1/dailies/latest` 获取结构化日报，匿名只读、无需 API Key，
使用 Next.js 缓存：上游数据缓存至下一个北京时间 08:05，页面每 5 分钟检查是否到达刷新点；
08:05 后的首次访问触发更新，无访问时不会请求上游。页面只渲染文本、来源及经 HTTP(S) 校验的链接，不注入第三方 HTML。
接口异常时显示可行动的失败状态与外部日报入口；外部链接均使用 `noopener noreferrer`。

---

## 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
```

**没配数据库也能跑**：未设置 Supabase 环境变量时自动降级为 localStorage 模式，
全部功能可用（数据存本地浏览器），菜品内容区会显示"本地演示模式 · 评价仅保存在此浏览器"。

<!-- 自动更新说明：区分云端实时通知、本地标签页同步及定时补查。 -->
**评价自动更新**：云端收到新评价通知后刷新评价流、菜品评分和统计，通知按 600ms 合并。
前台页面每 30 秒补查一次，并在切回前台或网络恢复时刷新；更新失败时保留已显示的数据。
本地演示模式可同步同一浏览器、同一站点的多个标签页，跨设备共享评价需要配置 Supabase。
适合先看 UI、给同学演示。

### 想直接打开看、不起服务？

可以产出一份**纯静态版本**，不依赖任何服务，双击 `preview/index.html` 即可打开：

```bash
NEXT_STATIC_EXPORT=1 npm run build && cp -r .build-export preview
```

- 由 `next.config.ts` 里的 `NEXT_STATIC_EXPORT=1` 分支控制：该模式下启用
  `output: 'export'` 且资源改用**相对路径**（`./_next/...`），所以不经服务器也能正确加载。
- 静态导出不支持 `headers()`（CDN 缓存头）与图片优化器，故这两个能力仅在该模式下关闭；
  **Netlify 部署走默认模式，不受影响。**
- 静态预览中的站内链接使用 `./news.html` / `./index.html`，双击也可来回导航；日报是**构建时快照**，
  纯静态文件无法在后台定时更新。
- `preview/` 与 `.build-export/` 是构建产物，已在 `.gitignore` 中忽略。

---

## 接入真实数据库（3 步）

### 1. 建表

新数据库依次执行 `supabase/schema.sql` 和 `supabase/hardening.sql`。已有数据库先备份，再执行 `supabase/hardening.sql`：它会在事务中锁定评价表、根据明细重建统计并启用基础限流，执行期间评价写入会等待。正式执行前请先在测试库验证，并在低峰操作。

<!-- 已有项目只需启用 reviews 的实时发布，无需重新执行整份建表脚本。 -->
已有数据库如果尚未启用实时通知，还需执行 `schema.sql` 末尾的「实时评价」SQL 块，或者在 Supabase 的
Publications 设置中，将 `public.reviews` 加入 `supabase_realtime`。
配置依据：[Supabase Postgres Changes 官方文档](https://supabase.com/docs/guides/realtime/postgres-changes)。
完成后在两台设备打开网页，在其中一台提交评价，另一台应自动显示新评价和最新统计。

### 2. 灌菜品数据

```bash
cp .env.example .env.local
# 填入 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
```

> 灌数据需要私有密钥，放在本机 `.env.local` 的 `SUPABASE_SERVICE_ROLE_KEY` 中；前端的 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 只放 publishable key。私有密钥不要放进任何 `NEXT_PUBLIC_` 变量或前端部署环境。

```bash
npm run seed:db
```

导入前脚本会检查已有 ID 的名称及所属商家，发现不一致即停止。商家、菜品和历史评价分多次请求写入，导入失败可能部分完成，需检查错误后重试。

### 3. 部署到 Netlify

```bash
npm i -g netlify-cli
netlify init      # 关联仓库，build 命令会自动读 netlify.toml
netlify deploy --prod
```

Netlify 后台需配置两个环境变量（Settings → Environment variables）：
`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 项目结构

```
├── data/dishes.json           # 解析出的菜品数据（371 道，随代码发布）
├── supabase/schema.sql        # 建表 + 索引 + RLS + 聚合触发器
├── supabase/hardening.sql     # 评分回填、精确聚合与基础限流
├── scripts/
│   ├── parse.cjs              # 解析原表，保留既有 ID
│   ├── check-data.cjs         # 只读校验目录
│   └── seed.mjs               # 校验 ID 后导入数据库
├── src/
│   ├── app/                   # layout / page / globals.css
│   │   └── news/page.tsx      # 站内安全与 AI 日报（每天 08:05 后更新）
│   ├── components/
│   │   ├── DishPanel.tsx      # 主面板：概览 + 商家 Tab + 菜品墙 + 评价流（编排层）
│   │   ├── SiteNav.tsx        # 两页共用的紧凑双按钮导航（全端吸顶）
│   │   ├── ReviewDialog.tsx   # 评价填写弹窗
│   │   ├── NumericScale.tsx   # 数字评分（弹窗内弹簧反馈，随弹窗懒加载）
│   │   ├── dish/              # 业务层：区块组件（只消费令牌与原语）
│   │   │   ├── OverviewSection.tsx  StatCard.tsx  RatingFilter.tsx
│   │   │   ├── MerchantTabs.tsx  DishWall.tsx  DishCard.tsx  ScoreReadout.tsx
│   │   │   └── ReviewFeed.tsx  Toast.tsx
│   │   └── motion/            # 原语层：动效组件
│   │       ├── FadeIn.tsx  Stagger.tsx  AnimatedNumber.tsx  Pressable.tsx   # 纯 CSS / rAF
│   │       ├── MotionSheet.tsx  LayoutItem.tsx  MotionProvider.tsx         # motion（按需懒加载）
│   │       └── index.ts
│   ├── lib/
│   │   ├── data.ts            # 评价数据访问层（含 localStorage 降级）
│   │   ├── daily.ts           # 服务端日报读取 / 缓存 / 异常状态
│   │   ├── news.ts            # 日报类型、外部地址与安全链接校验
│   │   ├── motion-tokens.ts   # 动效令牌（纯数值 · 唯一真源，JS 与 CSS 共用）
│   │   └── motion.ts          # re-export 令牌 + JS 侧 variants（供 motion 编排）
│   └── types/
│       ├── dishes.ts          # 数据结构定义
│       └── dish-panel.ts      # 面板 UI 类型（SortKey / MinRating / 表单草稿）
├── DESIGN.md                  # 视觉与无障碍设计说明
├── MOTION.md                  # 动效设计说明（范围 / 节奏 / 风格 / 分层架构）
└── netlify.toml               # 构建配置 + CDN 缓存策略 + 安全响应头
```

---

## 动效系统

整站动效建立在 **三层架构**（令牌层 → 原语层 → 业务层）之上，
**唯一真源**是 [`src/lib/motion-tokens.ts`](src/lib/motion-tokens.ts)（纯数值），
`tailwind.config.ts`（CSS）与 [`src/lib/motion.ts`](src/lib/motion.ts)（JS）都从它取值，改一处即两处同步。

- **令牌层**：`duration / ease / spring / distance / stagger / MAX_STAGGER_ITEMS`
- **原语层**（`src/components/motion/`）：
  - **纯 CSS / rAF**：`FadeIn`、`StaggerGroup` / `StaggerItem`、`AnimatedNumber`、`Pressable`（按压后轻量回弹）
  - **motion（按需懒加载）**：`MotionSheet`（**弹窗与抽屉的统一外壳**：进出场、遮罩、Esc/遮罩关闭、焦点陷阱与归还、滚动锁、移动端下拉回弹）、`LayoutItem`（菜品墙弹簧布局重排）、`NumericScale`（评分选中与按压回弹，随评价弹窗加载）
- **业务层**（`src/components/dish/`）：只消费令牌与原语，**不写裸数字**

**渐进增强**：入场动效是**纯 CSS**，元素默认态可见 —— **禁用 JS 时 371 张卡片全部可见**
（v1 的 SSR `opacity:0` 缺陷已修复）。

**性能红线**：只动 `transform / opacity`；进度条走 `scaleX`；
错峰上限 `MAX_STAGGER_ITEMS = 12`（371 张卡不会全动）；
布局重排上限 60 张；**motion 运行时不进首屏**（弹窗 / 布局重排按需懒加载 + 空闲预取）；
`prefers-reduced-motion` 下动效关闭且内容可见。

> 完整的范围、节奏、风格统一方向与实测体积账，见 **[MOTION.md](MOTION.md)**。

**原表菜品有更新时**：

```bash
# 1. 改 .tools/payload.json 里的链接，重新拉取
./.tools/kdocs-cli.exe call read_file --file .tools/payload.json --silent > .tools/raw_doc.json
# 2. 重新解析
npm run seed:parse
# 3. 重新灌库
npm run check:data
npm run seed:db
```

解析时按商家名和同一商家下的菜名匹配已有 ID，顺序变化不会重编号；新增菜品分配新 ID。商家或菜品消失、改名、重名时会停止，需人工核对并维护 `data/dishes.json` 中的身份后再继续。导入数据库与发布新版前端应协调进行，避免两边目录暂时不一致。

---

## 界面与无障碍

- **移动优先**：320px 起单列，`repeat(auto-fill, minmax(280px, 1fr))` 免媒体查询自动扩列
- **对比度**：正文 ≥4.5:1，大字号与 UI 组件 ≥3:1（WCAG 2.2 AA）
- **键盘可达**：全流程可 Tab 导航，焦点环可见；`/` 键快速聚焦搜索
- **语义化**：评分用 `radiogroup`，进度条用 `progressbar`，弹窗用 `dialog` + `aria-modal`
- **不靠颜色单独传达信息**：评分同时有星星图形和数字文本
- **动效克制**：只动 `transform` / `opacity`，时长 0.1–0.36s（见 [MOTION.md](MOTION.md)），并尊重 `prefers-reduced-motion`

---

## 已知边界

- 昵称无鉴权，同一设备可换名重复提交（需登录体系才能根治，当前场景够用）
- 「价格待补充」的两道菜（自选酸奶水果捞、酸奶纤体瓶）原表就无价格，需在原表补
- 云端实时通知依赖 Supabase 发布配置和网络连接；前台页面每 30 秒补查。通知不可用时更新可能延迟。
