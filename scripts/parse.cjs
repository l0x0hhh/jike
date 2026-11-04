// 保留已发布的菜品 ID，任何无法安全匹配的变更先停止供人工检查。
/**
 * 解析春晖园菜品评价表（WPS 表格导出 markdown）→ 结构化种子数据 JSON
 * 商家列是合并单元格，markdown 导出时后续行为空，需向下继承。
 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', '.tools', 'raw_doc.json'), 'utf8'));
const lines = raw.content.split('\n');

const merchants = [];
let current = null;

for (const line of lines) {
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) =>
    c.replace(/<br\s*\/?>/g, '').replace(/&nbsp;/g, ' ').trim()
  );
  if (cells.length < 4) continue;

  const [mRaw, dishRaw, priceRaw, reviewRaw] = cells;

  // 跳过表头与分隔行
  if (mRaw === '商家' || mRaw.startsWith('---')) continue;

  // 商家名：把竖排字符拼回（"久<br/>岛<br/>烧<br/>肉" 已去 br → "久岛烧肉"）
  if (mRaw) {
    // 首行是导语说明（单独占一行的引言），不是商家，跳过
    if (mRaw.length > 20) continue;
    current = { name: mRaw.replace(/\s+/g, ''), dishes: [] };
    merchants.push(current);
  }
  if (!current) continue;

  // 商家段落分隔行（商家/菜品/价格/评价 重复出现）
  if (dishRaw === '菜品') continue;
  if (!dishRaw && !priceRaw && !reviewRaw) continue;

  // 解析价格：19.90 元 / 25.80 元/500g / 空
  let price = null;
  let unit = '份';
  let priceNote = null;
  if (priceRaw) {
    const m = priceRaw.match(/([\d.]+)\s*元(?:\s*\/\s*(.+))?/);
    if (m) {
      price = parseFloat(m[1]);
      if (m[2]) {
        unit = m[2].trim();
        priceNote = priceRaw.trim();
      }
    } else {
      priceNote = priceRaw.trim();
    }
  }

  // 已有评价：表格里是口语短评（如"夯爆了"）
  const existing = reviewRaw ? reviewRaw.trim() : '';

  current.dishes.push({
    name: dishRaw,
    price,
    unit,
    priceNote,
    existingReview: existing || null,
  });
}

const dest = path.join(__dirname, '..', 'data', 'dishes.json');
if (!fs.existsSync(dest)) throw new Error('缺少已发布目录，不能安全分配 ID');
const previous = JSON.parse(fs.readFileSync(dest, 'utf8'));
const oldMerchants = new Map(previous.merchants.map(m => [m.name, m]));
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    if (!item.name || seen.has(item.name)) throw new Error(`${label}存在空名称或重名：${item.name}`);
    seen.add(item.name);
  }
};
unique(previous.merchants, '旧商家');
unique(merchants, '新商家');
for (const old of previous.merchants) {
  unique(old.dishes, `旧商家 ${old.name} 的菜品`);
  const currentMerchant = merchants.find(m => m.name === old.name);
  if (!currentMerchant) throw new Error(`商家消失或改名：${old.name}，请先人工核对 ID`);
  unique(currentMerchant.dishes, `新商家 ${old.name} 的菜品`);
  for (const dish of old.dishes) {
    if (!currentMerchant.dishes.some(d => d.name === dish.name))
      throw new Error(`菜品消失或改名：${old.name} / ${dish.name}，请先人工核对 ID`);
  }
}
let nextMerchantId = Math.max(0, ...previous.merchants.map(m => m.id)) + 1;
let nextDishId = Math.max(0, ...previous.merchants.flatMap(m => m.dishes.map(d => d.id))) + 1;
const stableMerchants = merchants.map(m => {
  unique(m.dishes, `商家 ${m.name} 的菜品`);
  const old = oldMerchants.get(m.name);
  const id = old?.id ?? nextMerchantId++;
  const oldDishes = new Map((old?.dishes ?? []).map(d => [d.name, d]));
  return { id, name: m.name, dishes: m.dishes.map(d => ({
    id: oldDishes.get(d.name)?.id ?? nextDishId++, merchant_id: id, ...d,
  })) };
});
const out = {
  source: raw.name,
  sourceUrl: 'https://www.kdocs.cn/l/ckihNLEyzhdS',
  exportedAt: new Date().toISOString(),
  stats: {
    merchants: merchants.length,
    dishes: merchants.reduce((s, m) => s + m.dishes.length, 0),
    withReview: merchants.reduce(
      (s, m) => s + m.dishes.filter((d) => d.existingReview).length,
      0
    ),
  },
  merchants: stableMerchants,
};

console.log('商家数:', out.stats.merchants);
console.log('菜品数:', out.stats.dishes);
console.log('已有评价:', out.stats.withReview);
console.log('→', dest);
console.log('\n商家列表:');
out.merchants.forEach((m) => console.log(`  ${m.id}. ${m.name} (${m.dishes.length} 道)`));
const noPrice = out.merchants.flatMap((m) => m.dishes.filter((d) => d.price === null));
if (noPrice) {
  console.log('\n无价格条目:');
  noPrice.forEach((d) => console.log(`  ${d.name} (${d.priceNote || '空'})`));
}

// 完整性自检：字段缺失会让前端筛选静默失效（曾踩坑），宁可在这里炸掉
const problems = [];
for (const m of out.merchants) {
  if (!m.name) problems.push(`商家 ${m.id} 缺 name`);
  for (const d of m.dishes) {
    if (d.merchant_id !== m.id) problems.push(`菜品「${d.name}」merchant_id=${d.merchant_id}，应为 ${m.id}`);
    if (!d.name) problems.push(`菜品 ${d.id} 缺 name`);
    if (typeof d.id !== 'number') problems.push(`菜品「${d.name}」id 非数字`);
  }
}
const dupIds = out.merchants.flatMap((m) => m.dishes.map((d) => d.id));
const dupSet = new Set();
const dup = dupIds.filter((id) => (dupSet.has(id) ? true : (dupSet.add(id), false)));
if (dup.length) problems.push(`菜品 id 重复: ${[...new Set(dup)].join(', ')}`);

if (problems.length) {
  console.error('\n✗ 数据自检未通过:');
  problems.slice(0, 20).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('\n✓ 数据自检通过（merchant_id 关联正确、id 唯一、字段完整）');
// 校验全部通过后才覆盖目录，避免中断时写入无效数据。
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n', 'utf8');
