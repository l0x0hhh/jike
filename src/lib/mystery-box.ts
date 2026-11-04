// 盲盒从全部候选中均匀抽取，并在可能时避开上一道菜。
export function drawMysteryDish<T extends { id: number }>(dishes: readonly T[], previousId?: number): T | null {
  if (dishes.length === 0) return null;
  const candidates = dishes.length > 1 ? dishes.filter(dish => dish.id !== previousId) : dishes;
  if (candidates.length === 0) return null;

  // 时间戳只作为扰动；随机性来自浏览器的加密安全随机数，不把时间当作随机源。
  const range = 0x100000000;
  const ceiling = range - (range % candidates.length);
  const bytes = new Uint32Array(1);
  let value: number;
  do {
    globalThis.crypto.getRandomValues(bytes);
    value = (bytes[0] ^ (Date.now() >>> 0)) >>> 0;
  } while (value >= ceiling);
  return candidates[value % candidates.length];
}
