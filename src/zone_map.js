// 아트 좌표(px) ↔ 논리 격자(60×40 타일) 매핑과 충돌 검사. 브라우저·Node 테스트 공용(Phaser 의존 없음).
const pw = (knots, v) => {
  if (v <= knots[0][0]) return knots[0][1];
  for (let i = 0; i < knots.length - 1; i++) {
    const [a, la] = knots[i], [b, lb] = knots[i + 1];
    if (v <= b) return la + (lb - la) * (v - a) / (b - a);
  }
  return knots[knots.length - 1][1];
};
const inv = knots => knots.map(([a, l]) => [l, a]);

export function makeZone(zone, world) {
  const W = world?.W ?? 60, H = world?.H ?? 40;
  const kx = zone.artToLogical.x, ky = zone.artToLogical.y;
  const toLogical = (x, y) => [pw(kx, x), pw(ky, y)];                 // 연속 타일 좌표
  const toArt = (tx, ty) => [pw(inv(kx), tx), pw(inv(ky), ty)];        // 타일 → 아트(역매핑)
  const cellAt = (x, y) => { const [lx, ly] = toLogical(x, y); return [Math.min(W - 1, Math.max(0, Math.floor(lx))), Math.min(H - 1, Math.max(0, Math.floor(ly)))]; };
  const rectHit = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const [CW, CH] = zone.canvas;
  // 발밑 상자(footBox)가 막힌 사각형과 겹치면 이동 불가
  const isFree = (x, y, extra = []) => {
    const [bx0, by0, bx1, by1] = zone.movement.footBox;
    if (x + bx0 < 0 || x + bx1 > CW || y + by0 < 0 || y + by1 > CH) return false;
    const rects = zone.blocked.concat(extra);
    for (const r of rects) if (x + bx1 > r[0] && x + bx0 < r[2] && y + by1 > r[1] && y + by0 < r[3]) return false;
    return true;
  };
  return { toLogical, toArt, cellAt, isFree, rectHit, W, H };
}

// 경로(아트 좌표 꺾은선)를 따라 걸을 때 지나는 칸의 열 분류 시간 비율 — 테스트·검증용
export function routeHeatProfile(zoneMap, route, hm, W, rules, speed) {
  const R = rules.heat; let t = 0, gauge = 0, fails = 0, hot = 0, shade = 0, n = 0; const dt = 0.05;
  for (let i = 0; i < route.length - 1; i++) {
    const [x0, y0] = route[i], [x1, y1] = route[i + 1]; const L = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(L / (speed * dt));
    for (let s = 0; s < steps; s++) {
      const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps; const [cx, cy] = zoneMap.cellAt(x, y); const v = hm[cy * W + cx];
      const kind = v < R.hotHM ? 'hot' : v >= R.shadeHM ? 'shade' : 'neutral'; n++; if (kind === 'hot') hot++; if (kind === 'shade') shade++;
      gauge = Math.max(0, gauge + R.gaugePerSec[kind] * dt); t += dt;
      if (gauge >= 100) { fails++; gauge = R.failRestartGauge; }
    }
  }
  return { seconds: +t.toFixed(1), hotFrac: +(hot / n).toFixed(2), shadeFrac: +(shade / n).toFixed(2), peakFails: fails, finalGauge: Math.round(gauge) };
}
