// 只读检查已发布目录，避免验证命令意外覆盖数据。
const fs = require('node:fs');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'dishes.json'), 'utf8'));
const merchantIds = new Set();
const dishIds = new Set();
const merchantNames = new Set();
for (const merchant of data.merchants) {
  if (!Number.isSafeInteger(merchant.id) || merchantIds.has(merchant.id) || !merchant.name || merchantNames.has(merchant.name))
    throw new Error(`无效或重复商家：${merchant.name}`);
  merchantIds.add(merchant.id); merchantNames.add(merchant.name);
  const names = new Set();
  for (const dish of merchant.dishes) {
    if (!Number.isSafeInteger(dish.id) || dishIds.has(dish.id) || dish.merchant_id !== merchant.id || !dish.name || names.has(dish.name))
      throw new Error(`无效或重复菜品：${merchant.name} / ${dish.name}`);
    dishIds.add(dish.id); names.add(dish.name);
  }
}
if (data.stats.merchants !== merchantIds.size || data.stats.dishes !== dishIds.size)
  throw new Error('目录统计与实际数量不一致');
console.log(`目录检查通过：${merchantIds.size} 家商家，${dishIds.size} 道菜`);
