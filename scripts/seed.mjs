// 仅从服务端私有变量读取导入密钥，并在写入前核对已有 ID 的归属。
/**
 * 种子数据导入：把 data/dishes.json 灌进 Supabase
 *
 * 用法：
 *   1) 配置 URL 和仅供本地导入的 SUPABASE_SERVICE_ROLE_KEY
 *   2) npm run seed:db
 *
 * 幂等：merchant/dish 用显式 id，重复执行会 upsert 覆盖，不会产生重复行。
 * 注意：不要把私有密钥放在 NEXT_PUBLIC_ 环境变量中。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'dishes.json'), 'utf8')
);

// 优先读 .env.local，其次 .env
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('✗ 缺少环境变量。请先配置 .env.local：');
  console.error('  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(url, key, { auth: { persistSession: false } });

const merchantRows = data.merchants.map((m, i) => ({
  id: m.id,
  name: m.name,
  sort_order: i + 1,
}));

const dishRows = data.merchants.flatMap((m) =>
  m.dishes.map((d, i) => ({
    id: d.id,
    merchant_id: m.id,
    name: d.name,
    price: d.price,
    unit: d.unit || '份',
    price_note: d.priceNote,
    sort_order: i + 1,
  }))
);

// 原表已有的口语短评 → seed_reviews
const seedReviewRows = data.merchants.flatMap((m) =>
  m.dishes
    .filter((d) => d.existingReview)
    .map((d) => ({ dish_id: d.id, content: d.existingReview, source: '原表' }))
);

console.log(`待导入：${merchantRows.length} 商家 / ${dishRows.length} 菜品 / ${seedReviewRows.length} 条历史评价`);

// 先读取全量目录；若同一 ID 已指向不同名称，禁止继续，避免评价串菜。
async function readAll(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data: page, error } = await sb.from(table).select(columns).order('id').range(offset, offset + 499);
    if (error) throw new Error(`读取 ${table} 失败：${error.message}`);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
const [existingMerchants, existingDishes] = await Promise.all([
  readAll('merchants', 'id,name'), readAll('dishes', 'id,name,merchant_id'),
]);
for (const [incoming, existing, label] of [[merchantRows, existingMerchants, '商家'], [dishRows, existingDishes, '菜品']]) {
  const byId = new Map(existing.map(row => [row.id, row]));
  for (const row of incoming) {
    const old = byId.get(row.id);
    if (old && (old.name !== row.name || (label === '菜品' && old.merchant_id !== row.merchant_id)))
      throw new Error(`${label} ID ${row.id} 已指向其他名称或商家，停止导入，请先人工核对`);
  }
}

let failed = false;

const { error: e1 } = await sb.from('merchants').upsert(merchantRows, { onConflict: 'id' });
if (e1) throw new Error(`商家导入失败：${e1.message}`);
else console.log('✓ merchants');

const { error: e2 } = await sb.from('dishes').upsert(dishRows, { onConflict: 'id' });
if (e2) throw new Error(`菜品导入失败：${e2.message}`);
else console.log('✓ dishes');

if (seedReviewRows.length) {
  // 历史评价允许重复导入前先清空，保证幂等
  const { error: deleteError } = await sb.from('seed_reviews').delete().neq('id', -1);
  if (deleteError) throw new Error(`清理历史评价失败：${deleteError.message}`);
  const { error: e3 } = await sb.from('seed_reviews').insert(seedReviewRows);
  if (e3) { console.error('✗ seed_reviews:', e3.message); failed = true; }
  else console.log(`✓ seed_reviews (${seedReviewRows.length})`);
}

// 回读校验，不信任 code: 0
const { data: check, error: e4 } = await sb.from('merchants').select('id').limit(100);
if (e4) { console.error('✗ 校验失败:', e4.message); process.exit(1); }
console.log(`\n校验：库中商家数 = ${check.length}（期望 ${merchantRows.length}）`);
console.log(failed ? '\n部分导入失败，请检查权限与 RLS 策略' : '\n全部导入成功 ✓');
process.exit(failed ? 1 : 0);
