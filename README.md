# 春晖园菜品评价面板

把原来那份只能横向滚动的 WPS 表格，变成一个**手机上能顺手填、电脑上看得清**的面板。

- 16 家商家 · 371 道菜，菜品目录来自 [春晖园商家菜品评价表](https://www.kdocs.cn/l/ckihNLEyzhdS)
- 免登录，填个昵称就能写评价
- 评价不可修改、不可删除（对应原表"请勿随意删除或修改他人的评价"）

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
> 空态、整卡可点、双 sticky 操作条、乐观提交、键盘 `/` 聚焦——全部保留，并逐项验收（见 `.tools/verify.mjs`）。

---

## 技术栈与选型理由

| 层 | 选型 | 为什么 |
|---|---|---|
| 框架 | **Next.js 16.4**（App Router）| Netlify 官方支持最完整；静态化 + 边缘缓存开箱即用 |
| 语言 | TypeScript 5.8 | 菜品 id / 统计字段全链路有类型，避免改价改错行 |
| 样式 | Tailwind CSS 3.4 | 设计 token 化，改主题只动 `tailwind.config.ts` |
| 数据库 | **Supabase**（PostgreSQL 15）| 免运维、单库支撑日十万级写入、自带 RLS 行级权限 |
| 部署 | **Netlify** | CDN 全球节点，`s-maxage` 静态缓存扛读并发 |

> 版本说明：Next 15.5.4 存在 CVE-2025-66478 安全漏洞，已升到 16.4.0（当前 latest）。

---

## 高并发是怎么扛的

这个场景的并发压力集中在**写入**（几百人同时点评），读反而很轻。所以架构这样切：

**1. 读路径完全不过数据库**

菜品目录是构建期就确定的静态数据，页面 `force-static` 全量静态化。
Netlify CDN 边缘缓存（`s-maxage=60, stale-while-revalidate=300`）——
**1 万并发和 10 并发，对源站压力完全一样**。

**2. 写路径浏览器直连 Supabase，不过 Functions**

评价提交由浏览器直接打 Supabase REST（PostgREST），不绕 Netlify Functions。
原因：Functions 有冷启动和实例数上限，突发流量下会排队；
而 PostgREST 前面是托管的 Postgres 负载均衡，横向扩容无感知。

**3. 聚合预计算，不做实时 COUNT**

`dish_stats` 表由触发器在写入时同步维护（`src` 见 `supabase/schema.sql` 的 `trg_reviews_agg`）。
面板读统计 = 一次 `SELECT`，与评价总量无关。否则每次打开面板都要扫全表算 COUNT，并发一上来必慢。

**4. 索引覆盖实际查询**

| 索引 | 服务的查询 |
|---|---|
| `idx_dishes_merchant_sort` | 商家页筛选 + 排序 |
| `idx_reviews_dish_created` | 单道菜的评价列表（倒序） |
| `idx_reviews_client_created` | 设备维度限流查询 |
| `idx_dishes_name` (gin_trgm) | 菜名模糊搜索 |

**5. 防刷三道闸**

- 前端：60 秒内最多 5 条，超限直接拦（`checkRateLimit`）
- 数据库 RLS：昵称 ≤20 字、正文 ≤500 字、标签 ≤6 个，且**不开放 UPDATE / DELETE policy**（默认拒绝 = 结构性不可改）
- 设备指纹哈希（非明文）落库，供后续做更精细限流

**并发量预估**：几百人同时提交这个量级，Postgres 单表写入余量在两个数量级以上。真正需要担心的不是数据库，是有人写脚本刷评价 —— 这由上面第 5 条兜住。

---

## 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
```

**没配数据库也能跑**：未设置 Supabase 环境变量时自动降级为 localStorage 模式，
全部功能可用（数据存本地浏览器），页面顶部会显示"本地演示模式"。
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
- `preview/` 与 `.build-export/` 是构建产物，已在 `.gitignore` 中忽略。

---

## 接入真实数据库（3 步）

### 1. 建表

Supabase 控制台 → SQL Editor，粘贴执行 `supabase/schema.sql` 全文。

### 2. 灌菜品数据

```bash
cp .env.example .env.local
# 填入 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
```

> ⚠️ 灌数据需要 **service_role key**（不是 anon key），anon key 没有写权限。
> 在 Supabase 控制台 → Project Settings → API 里拿。

```bash
node .tools/seed.mjs
```

脚本幂等：重复执行只更新不重复插入，结束时会回读校验商家数量。

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
├── .tools/
│   ├── parse.js               # 从 WPS 表格重新解析菜品（原表更新后跑）
│   └── seed.mjs               # 灌库脚本
├── src/
│   ├── app/                   # layout / page / globals.css
│   ├── components/
│   │   ├── DishPanel.tsx      # 主面板：概览 + 商家 Tab + 菜品墙 + 评价流（编排层）
│   │   ├── ReviewDialog.tsx   # 评价填写弹窗
│   │   ├── StarRating.tsx     # 星级组件（可交互 / 只读双模式）
│   │   ├── dish/              # 业务层：区块组件（只消费令牌与原语）
│   │   │   ├── OverviewSection.tsx  StatCard.tsx  RatingFilter.tsx
│   │   │   ├── MerchantTabs.tsx  DishWall.tsx  DishCard.tsx
│   │   │   └── ReviewFeed.tsx  Toast.tsx
│   │   └── motion/            # 原语层：动效组件
│   │       ├── FadeIn.tsx  Stagger.tsx  AnimatedNumber.tsx  Pressable.tsx   # 纯 CSS / rAF
│   │       ├── MotionSheet.tsx  LayoutItem.tsx  MotionProvider.tsx         # motion（按需懒加载）
│   │       └── index.ts
│   ├── lib/
│   │   ├── data.ts            # 数据访问层（含 localStorage 降级）
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
  - **纯 CSS / rAF**：`FadeIn`、`StaggerGroup` / `StaggerItem`、`AnimatedNumber`、`Pressable`
  - **motion（按需懒加载）**：`MotionSheet`（**弹窗与抽屉的统一外壳**：进出场、遮罩、Esc/遮罩关闭、焦点陷阱与归还、滚动锁、移动端下拉关闭）、`LayoutItem`（菜品墙布局重排）
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
node .tools/parse.js
# 3. 重新灌库
node .tools/seed.mjs
```

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
- 评价不实时推送，多人同时打开需刷新页面才看到最新（`stale-while-revalidate` 60s 窗口内由 CDN 缓存决定）
