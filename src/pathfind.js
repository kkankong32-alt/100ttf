// 터치 이동용 길찾기(Phaser 의존 없음, Node 테스트 공용). free(x,y) = 그 발밑 위치에 설 수 있는지.
export function lineFree(free, [x0, y0], [x1, y1], step = 4) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 1; i <= n; i++) if (!free(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
  return true;
}
// 격자 A*(8방향, 모서리 끼어들기 금지) → 시야가 트인 점만 남겨 매끈한 경유점 목록. 목표가 막힌 칸이면 가장 가까운 빈 칸으로.
export function findPath(free, start, goal, [W, H], C = 16) {
  const gw = Math.ceil(W / C), gh = Math.ceil(H / C), idx = (i, j) => j * gw + i, ctr = (i, j) => [i * C + C / 2, j * C + C / 2];
  const cache = new Map(), ok = (i, j) => { if (i < 0 || j < 0 || i >= gw || j >= gh) return false; const k = idx(i, j); if (!cache.has(k)) cache.set(k, free(...ctr(i, j))); return cache.get(k); };
  const cell = ([x, y]) => [Math.floor(x / C), Math.floor(y / C)];
  let [gi, gj] = cell(goal);
  if (!ok(gi, gj)) { let best = null; for (let r = 1; r <= 6 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && ok(gi + di, gj + dj)) { const d = Math.hypot(di, dj); if (!best || d < best[2]) best = [gi + di, gj + dj, d]; } if (!best) return null; [gi, gj] = best; }
  const [si, sj] = cell(start), G = new Map([[idx(si, sj), 0]]), from = new Map(), open = [[0, si, sj]], closed = new Set();
  const h = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  let found = false, guard = 0;
  while (open.length && guard++ < 20000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0], k0 = idx(i, j); if (closed.has(k0)) continue; closed.add(k0);
    if (i === gi && j === gj) { found = true; break; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!ok(ni, nj) || (di && dj && (!ok(i + di, j) || !ok(i, j + dj)))) continue;
      const k = idx(ni, nj), g = G.get(k0) + (di && dj ? 1.414 : 1);
      if (g < (G.get(k) ?? Infinity)) { G.set(k, g); from.set(k, k0); open.push([g + h(ni, nj), ni, nj]); }
    }
  }
  if (!found) return null;
  const cells = []; for (let k = idx(gi, gj); k !== undefined; k = from.get(k)) { cells.push(ctr(k % gw, Math.floor(k / gw))); if (k === idx(si, sj)) break; }
  cells.reverse(); cells[0] = start;
  const end = ok(...cell(goal)) && free(...goal) ? goal : cells[cells.length - 1]; cells[cells.length - 1] = end;
  const out = []; let a = cells[0];
  for (let i = 1; i < cells.length; i++) if (!lineFree(free, a, cells[i]) ) { a = cells[i - 1]; out.push(a); }
  out.push(end); return out;
}
