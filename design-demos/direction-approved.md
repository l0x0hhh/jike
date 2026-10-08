# 设计方向确认（Gate 文件）

## 三方向展示记录

| 方向 | 逻辑 | 风格 / 参照 / 设计师 | 初稿 |
|---|---|---|---|
| A | 秒数轮盘（`date +%S`=57 → 57%20+1=**18**） | 网页风格库 #18「深色画廊裱框 Gallery Dark」（安静派·深色） | `design-demos/A-gallery-dark.html` + `.png` |
| B | 现实参照（标杆迁移） | **The Infatuation**（餐厅评论产品；设计系统由 Brooklyn 的 Center 操刀，全文只用 Klim National 2 一款字体的多字重撑层级，评分用 1–10 数字而非星星） | `design-demos/B-infatuation-editorial.html` + `.png` |
| C | 最佳设计师（顶级定制） | **Massimo Vignelli** · 导视信息设计（Helvetica／严格栅格／1px 规则线／可用性即美） | `design-demos/C-vignelli-wayfinding.html` + `.png` |

参照案例真实性已用 WebSearch 核实（The Infatuation 品牌刷新由 Center 设计，字体为 Klim Type Foundry 的 National 2，见 the-brandidentity.com 报道）。

## 用户选择原话

> 「B感觉不错，你可以往这方面设计，不过记得设计的初衷是为了更好的表达，不要让原本的功能难用」

**选定：方向 B（编辑式数字评分）**，并附加一条硬约束——**不得为了视觉表达牺牲原有功能可用性**。

## 品牌资产

用户在确认环节明确「没有，你自由发挥」→ 无 logo／VI／指定字体，故不产出 `brand-spec.md`；
色彩走风格库的「色彩推导协议」（采样 → 收敛 → 论证），论证写入 `DESIGN.md`。

## 落地时的可用性红线（由用户附加约束推导，实现期必须逐条守住）

1. 搜索（`/` 聚焦）、5 种排序、商家筛选、评分门槛筛选、空态 —— 全部保留且置于首屏可达
2. 371 道菜的分组浏览效率不降：卡片保持紧凑，2px 描边不得让版面变噪
3. 评价填写路径不增加步数；必填校验与提交按钮始终可见（沿用双 sticky）
4. 无障碍不回退：`role=radiogroup`／`role=progressbar`／skip link／`lang=zh-CN`／`role=dialog`+`aria-modal`
5. `.tools/verify.mjs` 全项通过；六档断点（320/390/768/1024/1440/1920）无横向溢出
6. 动效红线不破：错峰仅前 12 项、layout 重排仅 ≤60 项、只动 transform/opacity、`prefers-reduced-motion` 生效

## 评分量表：决策与理由

方向 B 的灵魂之一是「数字评分」而非星星。落地时采用 **1–5 数字量表**而**非** 1–10 十级量表，理由：
- 数据库现有约束为 `rating int check (rating between 1 and 5)`，`dish_stats` 聚合与 RLS 均基于 5 级；改成 1–10 属数据模型变更，会扩大改动面并破坏既有验收基线
- 用户附加约束明确「不要让原本的功能难用」，此处以**稳妥**为优先
- 视觉上「数字当主角」的目标由**呈现方式**达成（巨大 tabular 数字 + 无星星字形），与量级无关
- 1–10 十级量表作为**待用户决策项**在交付说明中提出，不擅自实施
