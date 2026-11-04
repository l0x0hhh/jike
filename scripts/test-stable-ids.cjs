// 验证目录重排、新增和不确定删除不会改变已发布的菜品身份。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dish-ids-'));
try {
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.copyFileSync(path.join(__dirname, 'parse.cjs'), path.join(root, 'scripts', 'parse.cjs'));
  const catalog = { merchants: [{ id: 3, name: '商家甲', dishes: [
    { id: 40, merchant_id: 3, name: '菜甲' },
    { id: 41, merchant_id: 3, name: '菜乙' },
  ] }] };
  const dest = path.join(root, 'data', 'dishes.json');
  fs.writeFileSync(dest, JSON.stringify(catalog));
  const input = path.join(root, 'input.json');
  const run = rows => {
    fs.writeFileSync(input, JSON.stringify({ name: '测试', content: rows.join('\n') }));
    return spawnSync(process.execPath, [path.join(root, 'scripts', 'parse.cjs'), input], { encoding: 'utf8' });
  };
  const good = run(['| 商家 | 菜品 | 价格 | 评价 |', '| 商家甲 | 菜乙 | 2 元 | |', '| | 菜丙 | 3 元 | |', '| | 菜甲 | 1 元 | |']);
  assert.equal(good.status, 0, good.stderr);
  const result = JSON.parse(fs.readFileSync(dest, 'utf8'));
  assert.deepEqual(result.merchants[0].dishes.map(d => [d.name, d.id]), [['菜乙', 41], ['菜丙', 42], ['菜甲', 40]]);
  const before = fs.readFileSync(dest, 'utf8');
  const bad = run(['| 商家 | 菜品 | 价格 | 评价 |', '| 商家甲 | 菜乙 | 2 元 | |']);
  assert.notEqual(bad.status, 0, '删除或改名必须停止');
  assert.equal(fs.readFileSync(dest, 'utf8'), before, '失败不能覆盖目录');
  console.log('稳定 ID 测试通过：重排、新增、删除保护');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
