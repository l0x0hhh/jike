# 动效设计说明 · 春晖园菜品评价面板

> 本文说明「设计系统 + 动效体系」升级的**范围、节奏、风格统一方向、交互逻辑清晰性**，
> 以及支撑这一切的**分层架构**与**性能实测数据**。
> 所有动效参数集中在 **`src/lib/motion-tokens.ts`（唯一真源）**，
> JS（`src/lib/motion.ts`）与 CSS（`tailwind.config.ts`）都从它取值，改一处即两处同步。

---

## 0. 一句话结论

三层动效架构（**令牌层 → 原语层 → 业务层**）：
**入场 = 纯 CSS**（默认态即可见，SSR / 无 JS 都可见），
**交互与布局 = 按需懒加载的 motion**（弹窗外壳 + 布局重排）。
motion 运行时**不进首屏**，且完整支持 `prefers-reduced-motion`。

---

## 0.1 本轮（v2）关键变更 —— 修复 SSR 隐藏缺陷 + motion 移出首屏

### 问题（QA 报告 P2-1）

v1 把入场写成 motion 的 `initial={{ opacity: 0 }}`，这个隐藏态被渲染进 **SSR HTML**，导致：

1. **禁用 JS 时前 12 张卡片永久停在 `opacity:0`**（内容不可见）；
2. 弱网下首屏有 ~400–630ms 空白窗口（要等 `domMax` chunk 加载 + IntersectionObserver 触发）。

**违反渐进增强原则：无 JS 也必须能看到内容。**

### 修复：入场改为 CSS 驱动

- 元素**默认态就是可见的**（`opacity:1 / transform:none`）；隐藏态只存在于 CSS 关键帧
  的 `from`，靠 `animation-fill-mode: backwards` 在**延迟期间**临时应用。
- CSS 动画**不需要等 JS chunk**，首帧即开始播放 → 空白窗口消失。
- `prefers-reduced-motion: reduce` 下由 `globals.css` 把 `animation-delay/duration` 归零 → 立即呈现终态。
- 不再使用 `whileInView` / IntersectionObserver（那要求隐藏态作为初始态，与渐进增强冲突）；
  动画在挂载时即播放，下方区块在用户滚到之前早已播完，效果等价且更稳。

**验收**（CDP `Emulation.setScriptExecutionDisabled(true)`）：`371` 张卡片中
**opacity 为 0 的数量 = 0**（修复前为 12）。见 §6。

### 同时：motion 移出首屏

把非浮层动效全部改为 CSS，只保留两处必须 JS 编排的 motion（弹窗外壳 + 布局重排），
并用 `next/dynamic(ssr:false)` + 空闲预取懒加载它们 → **motion 运行时不进首屏**（见 §6）。

---

## 1. 优化涉及的页面与交互范围

本项目是单页应用，范围为**整页**，按区块拆成下列交互面：

| 区块 | 组件 | 动效 |
|---|---|---|
| 页头 | `DishPanel` sticky header | 滚动后**浮现阴影**（原生 scroll 监听 + CSS `transition-shadow`） |
| 概览统计 | `OverviewSection` / `StatCard` | 4 张卡错峰入场（CSS）；大数字滚动计数（rAF）；覆盖率进度条 `scaleX` 生长（CSS） |
| 商家 Tab | `MerchantTabs` | 选中态**静态高亮**（CSS；见 §5 说明，已不再滑动） |
| 评分门槛 | `RatingFilter` | `radiogroup` 语义 + 选中反馈 |
| 菜品墙 | `DishWall` / `DishCard` | 前 12 张错峰入场（CSS）；筛选/排序后 ≤60 张 `layout` 重排（motion，懒加载）；卡片 hover 轻浮起 |
| 评价填写 | `ReviewDialog` → `MotionSheet` | 弹窗**弹簧缩放入场**、背景遮罩淡入、**成功态**弹簧图标、乐观提交 |
| 评价流抽屉 | 复用 `MotionSheet` 的 `drawer` | **右侧滑入 / 移动端底部上滑**；移动端可**下拉关闭** |
| 数字量表（评分） | `NumericScale` | 选中格 `pop`（CSS 关键帧） |
| 反馈 | `Toast` | 底部**滑入淡入**，淡出下移（CSS） |
| 加载态 | 全局 | 骨架屏 ↔ 内容的**交叉淡入淡出**（CSS） |

**范围原则**：只新增动效与令牌，**不删减任何既有功能**；
`<article>` 仍是 `<article>`（371 张），所有 `role` / `aria-*` 原样保留。

---

## 2. 动效的触发与节奏

### 2.1 触发时机（何时动）

| 触发器 | 用在哪 | 实现 |
|---|---|---|
| **挂载即播放（CSS animation）** | 概览卡、菜品墙前 12 张、抽屉评价项 | 元素带 `animate-enter` + 内联 `--chy-enter-delay`；首帧开始，无需等 JS |
| **出现/消失（AnimatePresence）** | 弹窗、抽屉 | 打开播入场、关闭播 `exit`（motion，懒加载） |
| **状态变化（CSS transition / motion animate）** | 数字量表、进度条、Toast、抽屉把手 | 值变才动 |
| **布局变化（layout）** | 菜品墙筛选/排序 | motion `layout`（懒加载，≤60 张） |
| **指针交互（CSS :hover/:active）** | 按钮、卡片 | CSS `transform`，只过渡 transform/opacity |

### 2.2 节奏（时长与缓动）

- **时长**：`instant 0.1s` / `fast 0.16s` / `base 0.24s` / `slow 0.36s` / `slower 0.52s`
- **缓动**：`out [0.22,1,0.36,1]`（快出慢收）、`in`、`inOut`、`emphasized`
- **弹簧**：`snappy`（控件）、`soft`（列表/布局）、`gentle`（抽屉/大浮层）
- **节奏记忆点**：**"入场稍慢、反馈秒回、退出利落"**

### 2.3 错峰（stagger）—— 371 张卡不能全动

- 步长：`tight 0.03s` / `base 0.05s` / `loose 0.08s`
- **`MAX_STAGGER_ITEMS = 12`**：索引 ≥ 12 的条目**不加动画类**，直接以最终态渲染。

### 2.4 映射表

| 场景 | 实现 | 时长/曲线 | 驱动 |
|---|---|---|---|
| 概览卡入场 | `animate-enter` + 错峰 | `base` / `ease.out` | CSS |
| 大数字滚动 | rAF + cubic-bezier | `slow` / `ease.out` | JS(rAF) |
| 覆盖率进度条 | `scaleX`（origin left） | `slow` / `ease.out` | CSS transition |
| 商家 Tab 高亮 | 静态 class | `colors` | CSS |
| 菜品墙前 12 张 | `animate-enter` + 错峰 | `base` / `ease.out` | CSS |
| 菜品墙重排 | `layout`（≤60 张） | `spring.soft` | motion（懒） |
| 卡片 hover | `translateY(-2px)` + 阴影 | `fast` / `ease.out` | CSS |
| 评分选中 | `chy-pop` [1,1.18,1] | `fast` / `ease.out` | CSS |
| 按钮按下 | `scale(0.97)` / hover `1.02` | `fast` / `ease.out` | CSS |
| 弹窗出入场 | `dialogPop`（scale 0.94→1 + y） | `spring.snappy` | motion（懒） |
| 抽屉出入场 | `slideInRight` / `slideUp` | `spring.gentle/snappy` | motion（懒） |
| 遮罩 | `backdrop`（opacity） | `base` / `fast` | motion（懒） |
| 成功态图标 | `scaleIn` + 弹簧 | `spring.snappy` | motion（懒） |
| Toast | 上滑淡入 / 淡出下移 | `base` / `ease.out` | CSS |
| 骨架→内容 | 交叉 opacity | `base` / `ease.out` | CSS |
| 页头阴影 | class 切换 | `fast` | CSS |

---

## 3. 视觉风格的统一方向

三张令牌表（`tailwind.config.ts`，与 `motion-tokens.ts` 同源）：

### 3.1 圆角（`borderRadius`）
| 令牌 | 值 | 用途 |
|---|---|---|
| 令牌 | 取值 | 用途 |
|---|---|---|
| `rounded-control` | 0px | 按钮、输入框、chip（方向 B 起圆角归零） |
| `rounded-card` | 0px | 卡片、概览格 |
| `rounded-sheet` | 2px | 弹窗、抽屉 |

### 3.2 高度层次（方向 B 起改为硬偏移阴影，替代模糊投影）
| 令牌 | 语义 | 用途 |
|---|---|---|
| `shadow-elevation-1` | 无 | 普通卡片默认（靠 2px 实底描边承担边界） |
| `shadow-elevation-2` | 硬偏移 `4px 4px 0` | 滚动后的吸顶报头、卡片 hover |
| `shadow-elevation-3` | 硬偏移 `8px 8px 0` | 弹窗、抽屉 |

> 说明：原 `shadow-brand-glow`（主色辉光）已随方向 B 移除 —— 本方向的形状语言是
> **直角 + 实底描边 + 硬阴影**，辉光与它冲突。

### 3.3 过渡令牌（与 `motion-tokens.ts` 同源）
`transitionTimingFunction`（`out-soft / in-soft / in-out-soft / emphasized`）
与 `transitionDuration`（`instant / fast / base / slow / slower`）
让 **CSS 过渡** 与 **motion 动画** 共享同一套节奏。

> **保留**：品牌色 `brand`、中性 `ink`、状态色 `ok / warn / err` 全部沿用。

---

## 4. 如何体现交互逻辑的清晰性

1. **操作路径直观**：弹窗上下双 sticky（头部常驻菜品信息 + 底部常驻提交操作条）；
   **必填 / 选填**用徽标事前分清。
2. **状态可感知**：乐观提交（先见自己的评价，失败回滚）；骨架 ↔ 内容交叉淡入。
3. **空间关系可读**：菜品墙筛选/排序 `layout` 平滑重排（≤60 张），卡片"飞到位"。
4. **反馈即时且有轻重**：hover/按下 `fast` 轻反馈；入场 `base` 重反馈；关闭 `fast` 收尾。
5. **失败可恢复**：内联校验提示"还差：昵称、总体评分"；未达标 CTA `disabled` 但仍可聚焦看到原因。

---

## 5. 分层架构（便于后续升级）

```
┌──────────────────────────────────────────────────────────────┐
│ 业务层  src/components/dish/*  + DishPanel / ReviewDialog      │
│ （只消费令牌与原语；入场用 CSS，布局用懒加载 motion）             │
├──────────────────────────────────────────────────────────────┤
│ 原语层  src/components/motion/*                                │
│  CSS 原语：FadeIn · StaggerGroup/StaggerItem · Pressable · AnimatedNumber │
│  motion 原语（懒加载）：MotionSheet · LayoutItem · MotionProvider(配置)  │
├──────────────────────────────────────────────────────────────┤
│ 令牌层  src/lib/motion-tokens.ts  （纯数值 · 唯一真源）          │
│  duration · ease · spring · distance · stagger · MAX_STAGGER_ITEMS │
│  LAYOUT_ANIMATION_LIMIT · bezierToCss · secondsToMs            │
│        ├──▶ src/lib/motion.ts      （re-export + variants）     │
│        └──▶ tailwind.config.ts     （生成 CSS 令牌）             │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 令牌单一真源（JS / CSS 如何同步）

- `src/lib/motion-tokens.ts`：**只导出纯数值 / 纯类型，禁止 import `motion/react`**
  （因为 `tailwind.config.ts` 在构建期 Node 环境里也要 import 它）。
- `src/lib/motion.ts`：`import` 令牌后 re-export，并追加 `variants`（供 motion 编排）。
- `tailwind.config.ts`：`import` 令牌，用 `secondsToMs()` / `bezierToCss()` 生成
  `transitionDuration` / `transitionTimingFunction` / `keyframes` / `animation`。

→ **改 `motion-tokens.ts` 一处数值，JS 动效与 CSS 动效同步生效。**

### 5.2 入场为什么用 CSS 而不是 motion

| 维度 | motion `whileInView`（旧） | CSS animation（新） |
|---|---|---|
| SSR 首帧 | ❌ 隐藏态进 HTML | ✅ 默认可见 |
| 无 JS | ❌ 永久不可见 | ✅ 动画照播 → 可见 |
| 弱网首屏 | ❌ 等 chunk，~400–630ms 空白 | ✅ 首帧即播 |
| 首屏体积 | ❌ motion 运行时进首屏 | ✅ 不进 |

### 5.3 motion 只负责"真正需要 JS 编排"的两处

| 原语 | 职责 | 加载方式 |
|---|---|---|
| `MotionSheet` | 弹窗/抽屉唯一外壳：进出场、遮罩、Esc/遮罩关闭、焦点陷阱、焦点归还、`role=dialog`+`aria-modal`、滚动锁、移动端下拉关闭 | `next/dynamic(ssr:false)` + 空闲预取 |
| `LayoutItem` | 菜品墙 ≤60 张时的 `layout` 平滑重排 + hover 上浮 | `next/dynamic(ssr:false)` + 空闲预取 |

- `MotionProvider` 不再是根布局的 LazyMotion，而是一个轻量 `MotionConfig reducedMotion="user"`
  边界，由上面两个懒加载原语各自使用 —— 这样 motion 运行时只随它们进入客户端。
- 空闲预取（`requestIdleCallback`，降级 `setTimeout`）：保证**首次打开弹窗/抽屉仍是即时的**
  （QA 实测首次打开有完整进场动画，未退化）。

### 5.4 已知取舍：商家 Tab 高亮不再滑动

`MerchantTabs` 是 SSR 导航，若它静态 import motion 会把 motion 拉回首屏。
为让 motion 彻底移出首屏，这里改用**纯 CSS 静态高亮**（激活态视觉一致），
代价是切换时高亮不再"滑动"。如后续更看重该滑动效果，可将其做成独立懒加载小岛。

---

## 6. 性能实测与体积账（本轮实测）

### 6.1 首屏 JS（`qa-bundle.mjs`，gzip level 9）

| 指标 | v1 | v2（本轮） | 变化 |
|---|---|---|---|
| 首屏 raw | 937.9 KB | **777.0 KB** | **−160.9 KB** |
| 首屏 gzip | 282.2 KB | **226.8 KB** | **−55.4 KB** |
| motion 是否在首屏 | ✅ 在 | ❌ **不在**（`featureChunkInFirstLoad: []`） | — |

- motion 特征 chunk（含 `drag*` / `layoutId` 标记）：~129 KB raw / ~43 KB gzip，**已不在首屏列表**。
- 首屏 gzip 的 55.4 KB 降幅与 motion 核心 gzip 体积（~43–56 KB）同量级。

### 6.2 无 JS 可见性（`qa-fouc.mjs`，CDP 禁用脚本）

| 指标 | v1 | v2（本轮） |
|---|---|---|
| `totalArticles` | 371 | 371 |
| **`zeroOpacityArticles`** | 12 ❌ | **0 ✅** |
| `zeroSizeArticles` | 0 | 0 |
| `zeroOpacityOverview` | 0 | 0 |

### 6.3 交互 / 布局红线（`qa-layout2.mjs` + `qa-motion.mjs`）

- 布局重排门槛：`371 → 0` 项位移（瞬切）、`62 → 0`（瞬切）、`9 → 9`、`15 → 15`、`31 → 28`（有过渡）—— **门槛未回退**。
- 弹窗/抽屉：`opened=true`、`handlePresent=true`（移动）、`dragClose.closedAfterDrag=true`、
  移动端首次打开 `initialY≈67.5`（进场动画在）、滚动锁 `bodyOverflow=hidden`、焦点在主面板内。
- 无 console 报错 / 无异常（desktop / reduce / mobile 三个上下文）。
- 六档断点 `320/390/768/1024/1440/1920`：`docW == clientW`，**无横向溢出**。

### 6.4 运行时要点

- 错峰截断 + CSS 动画 ⇒ 长列表不重复触发、无长尾。
- `layout` 限制 60 张 ⇒ 只补间可视区附近卡片。
- 页头阴影用原生 scroll 监听 + 布尔阈值，不做逐帧 React 重渲染。
