// FINAL — 내가 만든 2126년: '처음 미래'(선택·약속 없음)와 '내 미래'를 같은 기후 조건에서 비교. 점수 대신 잘된 점·한계·남은 문제.
// 문장 규칙: SCENARIO_MATRIX.md §4. 수치는 scenario-results(SWMM)·heat.json(InVEST)에서만 가져온다.
export const FIRST = { c1: { forest: 'keep', streetTrees: 0, schoolyard: 0, coolPave: 0 }, c2: { permeable: 0, rainGarden: 0, basin: 0 }, c3: { treeCare: 0, facilityCare: 0, forestLaw: 0 } };

export function futureFacts(scene, c1, c2, c3, heatKey, swmmKey) {
  const h = scene.heat.scenarios[heatKey(c1, c3)].summary, s = scene.swmm[swmmKey(c1, c2, c3)];
  const forestHalf = c1.forest === 'keep' && c3 && !c3.forestLaw;
  return {
    forest: c1.forest === 'parking' ? '주차장' : forestHalf ? '절반만 남음' : '숲 유지',
    shade: Math.round(h.route_shade_frac * 100), hm: h.route_hm_mean, tair: h.route_tair_mean,
    runoff: s.runoff_mm, peak: s.peak_outflow_cms, load: Math.max(s.pipe_load.C5 ?? 0, s.pipe_load.C6 ?? 0),
    lowland: c2.basin ? '빗물 연못' : '주차장',
  };
}

export function sentences(c1, c2, c3, mine, first) {
  const care = c3 ? c3 : { treeCare: 1, facilityCare: 1, forestLaw: 1 };
  const good = [], limit = [], left = [];
  if (c1.streetTrees && care.treeCare) good.push('등굣길 그늘이 100년 동안 이어졌어요. 죽은 나무 자리에 계속 다시 심었기 때문이에요.');
  if (c1.streetTrees && !care.treeCare) limit.push('나무를 심었지만 죽은 자리에 다시 심지 않아 100년 뒤엔 대부분 빈 나무 자리만 남았어요(게임 속 가정이에요).');
  if (!c1.streetTrees) left.push('등굣길에는 아직 그늘이 거의 없어요.');
  if (mine.load < 0.90) good.push('같은 양의 큰비가 와도 하수관이 버틸 여유가 있었어요.');
  else if (mine.load < 0.95) limit.push('큰비가 올 때 하수관이 거의 가득 차서 얕은 물웅덩이가 생겨요.');
  else left.push('큰비가 올 때 하수관이 넘치기 직전이라 길에 물이 깊게 고여요.');
  if (c2.basin && !c2.permeable && !c2.rainGarden) limit.push('빗물 연못이 물이 한꺼번에 몰리는 것은 막았지만, 흘러가는 빗물의 양은 그대로예요.');
  if ((c2.permeable || c2.rainGarden) && c3 && !care.facilityCare) limit.push('빗물 시설을 청소하지 않아 100년 뒤엔 효과가 많이 줄었어요(게임 속 가정이에요).');
  if (c1.forest === 'parking') limit.push('주차장이 생긴 대신 마을이 조금 더 덥고 빗물이 많이 흘렀어요.');
  else if (c3 && !care.forestLaw) limit.push('숲을 지키는 약속이 없어 숲의 절반이 개발되었어요(게임 속 가정이에요).');
  else good.push('뒷산 숲이 남아 있어요.');
  if (c1.coolPave && !c1.streetTrees) limit.push('밝은 포장은 조금 덜 뜨겁게 했지만 그늘을 만들지는 못했어요.');
  left.push('폭염과 큰비의 세기는 전 세계의 온실가스 배출이 정해요. 마을의 대책은 기후변화에 맞춰 사는 \'적응\'이에요.');
  return { good, limit, left };
}

export function renderFinal(el, mine, first, txt) {
  const row = (label, a, b) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td></tr>`;
  el.innerHTML = `
    <table>
      <tr><th></th><th>내 미래</th><th>처음 미래<br><small>(아무것도 안 함·약속 없음)</small></th></tr>
      ${row('뒷산', mine.forest, first.forest)}
      ${row('등굣길 그늘 칸', mine.shade + '%', first.shade + '%')}
      ${row('큰비가 올 때 흘러간 빗물', mine.runoff + ' mm', first.runoff + ' mm')}
      ${row('하수관이 가장 꽉 찬 정도', Math.round(mine.load * 100) + '%', Math.round(first.load * 100) + '%')}
      ${row('저지대 빈 땅', mine.lowland, first.lowland)}
    </table>
    <h3>잘된 점</h3><ul>${txt.good.map(s => `<li>${s}</li>`).join('') || '<li>아직 없어요.</li>'}</ul>
    <h3>한계</h3><ul>${txt.limit.map(s => `<li>${s}</li>`).join('') || '<li>—</li>'}</ul>
    <h3>남은 문제</h3><ul>${txt.left.map(s => `<li>${s}</li>`).join('')}</ul>
    <p class="note">같은 2126년의 폭염과 집중호우(짧은 시간에 아주 많은 비)를 상상해 InVEST·EPA SWMM으로 계산한 가상 마을의 비교예요. 미래를 확정하는 예측이 아니에요.</p>`;
}

// 내 미래 카드(PNG, 1600×900): 게임 화면(비율 유지, 가운데 잘라 채움) + 엔딩 이름 + 세 가지 결과 + 하늘이의 편지 + 나의 실천 + 만든 사람
export function saveCard(game, mine, first, txt, extra = {}) {
  game.renderer.snapshot(img => {
    const W = 1600, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const F = (w, px) => `${w} ${px}px "Malgun Gothic", "Segoe UI Emoji", sans-serif`;
    const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    const wrap = (text, x, y, maxW, lh, maxLines = 9) => {   // 띄어쓰기 단위로 줄바꿈(한 단어가 너무 길 때만 글자 단위)
      const lines = []; let line = '';
      for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w;
        if (g.measureText(t).width <= maxW) { line = t; continue; } if (line) lines.push(line); line = w;
        while (g.measureText(line).width > maxW) { let k = line.length; while (k > 1 && g.measureText(line.slice(0, k)).width > maxW) k--; lines.push(line.slice(0, k)); line = line.slice(k); } }
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach((l, i) => { g.fillText(i === maxLines - 1 && lines.length > maxLines ? l.replace(/.$/, '…') : l, x, y); y += lh; }); return y; };
    g.fillStyle = '#f7f1e3'; g.fillRect(0, 0, W, H);
    // 머리글
    g.fillStyle = '#2b1640'; g.fillRect(0, 0, W, 92);
    g.fillStyle = '#ffe08a'; g.font = F(900, 40); g.textBaseline = 'middle'; g.fillText('100 투 더 퓨처', 40, 47);
    g.fillStyle = '#fff'; g.font = F(700, 26); g.fillText('내가 만든 2126년', 340, 49);
    const E = extra.ending; if (E) { g.textAlign = 'right'; g.fillStyle = '#7ff3e0'; g.font = F(900, 32); g.fillText(`엔딩 · ${E.icon} ${E.name}`, W - 40, 48); g.textAlign = 'left'; }
    g.textBaseline = 'alphabetic';
    // 게임 화면: 16:9 칸에 비율을 지키며 채움(가운데 기준으로 잘라냄)
    const bx = 40, by = 120, bw = 960, bh = 540, sr = Math.max(bw / img.width, bh / img.height), sw = bw / sr, sh = bh / sr;
    g.save(); round(bx, by, bw, bh, 18); g.clip(); g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, bx, by, bw, bh); g.restore();
    g.lineWidth = 6; g.strokeStyle = '#2b1640'; round(bx, by, bw, bh, 18); g.stroke();
    // 하늘이의 편지(첫 두 줄)
    g.fillStyle = '#fffaf0'; round(40, 684, 960, 176, 16); g.fill(); g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeStyle = '#d9b98a'; g.stroke(); g.setLineDash([]);
    g.fillStyle = '#7a4a1f'; g.font = F(800, 22); g.fillText('✉ 100년 뒤 하늘이가 보낸 편지', 64, 720);
    g.fillStyle = '#2b1d10'; g.font = F(400, 21); let y = 756; for (const t of (extra.letter ?? []).slice(0, 2)) y = wrap(t, 64, y, 912, 30, 2) + 4;
    // 세 가지 결과
    const ax = extra.axes ?? {}, rows = [
      ['🌳', '등굣길 그늘', `그늘 칸 ${mine.shade}%`, `처음 미래 ${first.shade}%`, ax.shade],
      ['💧', '비를 다루는 길', `하수관 ${Math.round(mine.load * 100)}% · 빗물 ${mine.runoff}mm`, `처음 미래 ${Math.round(first.load * 100)}% · ${first.runoff}mm`, ax.water],
      ['🌲', '뒷산 숲', mine.forest, `처음 미래 ${first.forest}`, ax.forest]];
    rows.forEach(([ic, name, v, b, ok], k) => { const x = 1036, yy = 120 + k * 148;
      g.fillStyle = ok ? '#e3f4ea' : '#fff'; round(x, yy, 524, 132, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = ok ? '#2f8a4a' : '#d8d0bd'; g.stroke();
      g.font = F(400, 40); g.fillStyle = '#000'; g.fillText(ic, x + 20, yy + 58);
      g.font = F(800, 24); g.fillStyle = '#2b1640'; g.fillText(name, x + 80, yy + 44);
      g.font = F(900, 26); g.fillStyle = ok ? '#11704a' : '#a3341f'; g.fillText(ok ? '✔ 100년 이어짐' : '△ 끊김·없음', x + 300, yy + 44);
      g.font = F(800, 26); g.fillStyle = '#1d2b2a'; g.fillText(v, x + 80, yy + 86);
      g.font = F(400, 18); g.fillStyle = '#777'; g.fillText(b, x + 80, yy + 114); });
    // 나의 실천
    g.fillStyle = '#eef6fb'; round(1036, 568, 524, 292, 16); g.fill(); g.lineWidth = 3; g.strokeStyle = '#2f5d8a'; g.stroke();
    g.fillStyle = '#2f5d8a'; g.font = F(900, 24); g.fillText('🙋 나의 실천', 1060, 608);
    g.fillStyle = '#1d2b2a'; g.font = F(800, 26); y = wrap(extra.pledgeText ?? '엔딩 화면에서 나의 실천을 골라 보세요.', 1060, 652, 476, 36, 3);
    g.font = F(400, 19); g.fillStyle = '#444'; wrap(E ? E.say : '', 1060, Math.max(y + 10, 740), 476, 28, 4);
    // 바닥글
    g.font = F(700, 17); g.fillStyle = '#555'; g.fillText('기획·제작 쓰로인훈쌤 김종훈 · 초등 4학년 과학 「기후변화와 우리 생활」', 40, 888);
    g.textAlign = 'right'; g.font = F(400, 15); g.fillText('가상 마을 · InVEST 도시 냉각 / EPA SWMM 계산 비교 · 예측이 아니에요', W - 40, 888); g.textAlign = 'left';
    const a = document.createElement('a'); a.download = 'my_2126.png'; a.href = cv.toDataURL('image/png'); a.click();
  });
}
