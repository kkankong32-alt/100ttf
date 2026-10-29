// 마을 토지피복 계산 — tools/world_def.py lulc_grid()와 1:1 동일해야 한다(tests/lulc-parity.test.mjs가 전 조합 해시로 검사).
export function scenarioKey(c1, c2 = null, c3 = null) {
  let s = `F${c1.forest === 'keep' ? 'K' : 'P'}T${c1.streetTrees}Y${c1.schoolyard}C${c1.coolPave}`;
  if (c2) s += `-P${c2.permeable}R${c2.rainGarden}B${c2.basin}`;
  if (c3) s += `-TC${c3.treeCare}FC${c3.facilityCare}FL${c3.forestLaw}`;
  return s;
}

export function lulcGrid(world, c1, c2 = null, year = 2126, c3 = null) {
  const { W, H } = world; const g = new Int16Array(W * H).fill(2);
  const rect = (x, y, w, h, v) => { for (let r = y; r < Math.min(H, y + h); r++) for (let c = x; c < Math.min(W, x + w); c++) g[r * W + c] = v; };
  for (const [, x, y, w, h, code] of world.ZONES) rect(x, y, w, h, code);
  for (const [x, y, w, h] of world.HOUSES) rect(x, y, w, h, 5);
  const developed = c1.forest === 'parking';
  if (year === 2126 && c3 && !c3.forestLaw && !developed) rect(17, 0, 17, 7, 11);
  if (developed) rect(0, 0, 34, 7, 11);
  if (c1.schoolyard) rect(2, 17, 14, 7, 7);
  if (c1.coolPave) {
    for (let r = 10; r < 31; r++) if (g[r * W + 19] === 4) g[r * W + 19] = 15;
    for (let c = 0; c < 60; c++) if (g[30 * W + c] === 4) g[30 * W + c] = 15;
  }
  if (c2) {
    if (c2.permeable) rect(26, 10, 4, 21, 9);
    if (c2.rainGarden) for (const [x, y, w, h] of world.RAIN_GARDENS) rect(x, y, w, h, 16);
    rect(2, 34, 20, 6, c2.basin ? 17 : (year === 2126 ? 11 : 10));
  }
  if (c1.streetTrees) for (const [x, y] of world.STREET_TREE_SLOTS) g[y * W + x] = 14;
  return g;
}
