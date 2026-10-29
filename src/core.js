// 공통 상태·저장·화면 UI(DOM). 장면(그래픽)과 무관한 게임 논리. 이전 main.js에서 그대로 옮김(논리 변경 없음).
import { scenarioKey } from './world.js';
import { audio } from './audio.js';

export const $ = s => document.querySelector(s);
// 현재 게임 장면(시험 연결 없이도 쓰도록)
export let SCENE = null; export const setScene = sc => { SCENE = sc; };
// 받침에 맞는 조사: josa('주무관', '와/과') → '주무관과' (끝 글자가 한글이 아니면 뒤쪽 형태)
export const josa = (w, pair) => { const [a, b] = pair.split('/'), c = String(w).trim().slice(-1).charCodeAt(0) - 0xAC00, has = c >= 0 && c <= 11171 && c % 28 !== 0;
  const vowelFirst = ['가', '를', '는', '와', '로', '랑', '예요'].includes(a); return w + (vowelFirst ? (has ? b : a) : (has ? a : b)); };
export const state = {
  year: 2026,
  c1: { forest: 'keep', streetTrees: 0, schoolyard: 0, coolPave: 0 },
  c2: { permeable: 0, rainGarden: 0, basin: 0 },
  c3: null,            // null = 아직 약속 없음 → '현재 수준 관리 지속' 가정
  weather: 'heat',     // 2126 장면: 'heat'(가상 폭염일) | 'rain'(가상 집중호우)
  delivery: { active: false, done: [] },
  prologue: 'start',   // start → found(백년시계 조사) → met(2126 로미) → done
  visited2126: [],
  mission: { active: false, gauge: 0, done: [], lastShade: null },
  planned: false,      // 게시판을 한 번이라도 열었는지(안내 화살표용)
  lastFuture: null,    // 마지막으로 본 2126의 선택 {c1,c2,c3} — 비교 기능용
  prog: { ch1: false, ch2: false },   // 1장(할머니 동행)·2장(약 배달)을 한 번 이상 해 봤는지(성공·실패 무관)
  ch3: { phase: 'locked', before: {}, after: {}, saved: null },   // 3장 단계: locked → explore(약속 없는 미래 조사) → plan(2026 약속) → verify(약속한 미래 조사) → done
  ending: false,       // 엔딩(내 미래 보고서)을 3장 뒤에 열어 봤는지
  banners: [],         // 이미 보여 준 장 시작·완료 안내
  region: 'A',         // 지금 구역: A 학교 앞 · B 시장길 · C 뒷산 숲길 · D 마을정원(regions.js)
  rpg: null,           // RPG 진행(rpg.js newRpgState): 단서·아이템·플래그·엽서·내가 심은 자리, 1장 결과(treeCare·schoolyard)
};
// 열 결과 키: Ch1 선택 + (나무 돌봄, 숲 조례). 약속 전에는 관리 지속(TC1·FL1) 가정.
// c3가 없으면(3장 약속 전) 나무 돌봄은 1장 결과(rpg.treeCare)를, 그 밖의 약속은 '관리 지속' 가정을 쓴다.
export const heatKey = (c1, c3) => `${scenarioKey(c1)}|TC${c3 ? c3.treeCare : (state.rpg?.mode === 'rpg' ? (state.rpg.treeCare ? 1 : 0) : 1)}FL${c3 ? c3.forestLaw : 1}`;
// 빗물 결과 키(SWMM): Ch1+Ch2 (+Ch3 약속이 있으면 포함)
export const swmmKey = (c1, c2, c3) => scenarioKey(c1, c2, c3);

// ---------- 저장(브라우저 로컬, 개인정보 없음) ----------
export const SAVE_KEY = 'ttf.save.v1';
export function saveGame(scene) {
  try {
    const p = scene?.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, zone: scene?.zoneId || 'legacy', year: state.year, c1: state.c1, c3: state.c3, visited2126: state.visited2126,
      c2: state.c2, prologue: state.prologue, weather: state.weather, deliveries: state.delivery.done, done: state.mission.done, player: p ? [Math.round(p.x), Math.round(p.y)] : null, planned: state.planned, lastFuture: state.lastFuture,
      prog: state.prog, ch3: state.ch3, ending: state.ending, banners: state.banners, rpg: state.rpg, region: state.region ?? 'A', savedAt: Date.now() }));
  } catch { /* 저장 불가(사생활 보호 모드 등) — 게임은 계속 */ }
}
export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d || d.version !== 1) return null;
    Object.assign(state.c1, d.c1); if (d.c2) Object.assign(state.c2, d.c2); state.prologue = d.prologue || 'done'; state.weather = d.weather === 'rain' ? 'rain' : 'heat'; state.delivery.done = d.deliveries || []; state.c3 = d.c3; state.year = d.year === 2126 ? 2126 : 2026; state.visited2126 = d.visited2126 || []; state.mission.done = d.done || []; state.planned = !!d.planned || state.mission.done.length > 0; state.lastFuture = d.lastFuture || null;
    state.prog = { ch1: !!d.prog?.ch1 || state.mission.done.length > 0, ch2: !!d.prog?.ch2 || state.delivery.done.length > 0 };
    if (d.ch3) state.ch3 = { before: {}, after: {}, saved: null, ...d.ch3 }; state.ending = !!d.ending; state.banners = d.banners || [];
    state.rpg = d.rpg ?? { mode: 'legacy' };       // 이전 베타 저장은 기존 방식 그대로 이어서
    state.region = ['A', 'B', 'C', 'D'].includes(d.region) ? d.region : 'A';
    return d;
  } catch { return null; }
}

// ---------- DOM UI ----------
export function toast(msg, ms = 3000) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
export function openPlanner() {
  const c = state.c1; const dlg = $('#planner');
  const budget = () => 2 + (c.forest === 'parking' ? 1 : 0), used = () => c.streetTrees + c.schoolyard + c.coolPave;
  // RPG: 선택은 게임 세계의 행동으로만 바뀌므로(1장 주민 회의 · 2장 시장길 시설 자리 · 3장 약속 릴레이 판) 게시판은 지금 계획을 보여 주기만 함
  if (state.rpg?.mode === 'rpg') {
    const r = state.rpg, c2 = state.c2, p = state.c3, yes = v => v ? '✔' : '—';
    dlg.querySelector('.body').innerHTML = `<p>지금까지 정한 마을 계획이에요. 바꾸는 곳은 오른쪽에 적혀 있어요.</p>
      <h3>1장 마을 공사 <small>바꾸려면: 처음부터 다시 하기</small></h3>
      <p>뒷산: <b>${c.forest === 'parking' ? '주차장 개발' : '숲 지킴'}</b> · 가로수 ${yes(c.streetTrees)} · 운동장 숲 ${yes(c.schoolyard)} · 밝은 포장 ${yes(c.coolPave)} · 나무 돌봄 팀 ${yes(r.treeCare)}</p>
      <h3>2장 빗물 시설 <small>바꾸려면: 2장 동안, 또는 엔딩 뒤 2026년 시장길 시설 자리</small></h3>
      <p>물이 스미는 바닥 ${yes(c2.permeable)} · 빗물정원 ${yes(c2.rainGarden)} · 빗물 연못 ${yes(c2.basin)}</p>
      <h3>3장 100년의 약속 <small>바꾸려면: 3장 동안, 또는 엔딩 뒤 2026년 마을정원 약속 릴레이 판</small></h3>
      <p>${p ? `나무 돌봄 ${yes(p.treeCare)} · 시설 청소 ${yes(p.facilityCare)} · 숲 지키는 마을 규칙 ${yes(p.forestLaw)}` : '아직 정하지 않았어요(3장에서 정해요).'}</p>`;
    dlg.classList.remove('ch3'); dlg.showModal(); return;
  }
  const render = () => {
    const p = state.c3;
    const rpgMode = state.rpg?.mode === 'rpg';      // RPG에선 마을 공사(1장)가 게임 세계의 행동으로 정해지므로 게시판에서 고르지 않음
    dlg.querySelector('.body').innerHTML = `${rpgMode ? '' : `
      <h3>마을 공사 <small>공사 토큰 <b>${budget() - used()}</b> / ${budget()}</small></h3>
      <label class="opt"><input type="checkbox" data-k="forestDev" ${c.forest === 'parking' ? 'checked' : ''}> 뒷산 숲을 주차장으로 개발 <small>주민 요청 · 토큰 +1</small></label>
      <label class="opt"><input type="checkbox" data-k="streetTrees" ${c.streetTrees ? 'checked' : ''}> 등굣길에 느티나무 가로수 20그루 심기 <small>토큰 1</small></label>
      <label class="opt"><input type="checkbox" data-k="schoolyard" ${c.schoolyard ? 'checked' : ''}> 운동장 일부를 숲·잔디로 <small>토큰 1</small></label>
      <label class="opt"><input type="checkbox" data-k="coolPave" ${c.coolPave ? 'checked' : ''}> 등굣길 밝은 색 포장 <small>토큰 1</small></label>`}
      <h3>빗물 대책 <small>빗물 토큰 <b>${2 - (state.c2.permeable + state.c2.rainGarden + 2 * state.c2.basin)}</b> / 2</small></h3>
      <label class="opt"><input type="checkbox" data-w="permeable" ${state.c2.permeable ? 'checked' : ''}> 시장길을 물이 스며드는 포장으로 <small>토큰 1</small></label>
      <label class="opt"><input type="checkbox" data-w="rainGarden" ${state.c2.rainGarden ? 'checked' : ''}> 집 앞 빗물정원 12곳 <small>토큰 1</small></label>
      <label class="opt"><input type="checkbox" data-w="basin" ${state.c2.basin ? 'checked' : ''}> 저지대 빈 땅에 빗물 연못 <small>토큰 2 · 안 고르면 2126년엔 주차장</small></label>
      <h3>100년의 약속 <small>${p ? `약속 카드 ${2 - (p.treeCare + p.facilityCare + p.forestLaw)} / 2` : '정하지 않으면 지금 수준의 관리가 계속된다고 가정'}</small></h3>
      <label class="opt"><input type="checkbox" data-k="usePromise" ${p ? 'checked' : ''}> 약속 정하기(정하지 않은 약속은 지켜지지 않음)</label>
      ${p ? `<label class="opt"><input type="checkbox" data-p="treeCare" ${p.treeCare ? 'checked' : ''}> 나무 돌봄: 죽은 나무 자리에 다시 심기</label>
      <label class="opt"><input type="checkbox" data-p="facilityCare" ${p.facilityCare ? 'checked' : ''}> 시설 청소: 빗물 시설 관리</label>
      <label class="opt"><input type="checkbox" data-p="forestLaw" ${p.forestLaw ? 'checked' : ''}> 숲 지키는 마을 규칙</label>` : ''}`;
    dlg.querySelectorAll('input').forEach(i => i.onchange = () => {
      const k = i.dataset.k, pk = i.dataset.p, wk = i.dataset.w;
      if (wk) { state.c2[wk] = i.checked ? 1 : 0; if (state.c2.permeable + state.c2.rainGarden + 2 * state.c2.basin > 2) { state.c2[wk] = 0; toast('빗물 토큰이 부족해요.'); } render(); SCENE.build(); saveGame(SCENE); return; }
      if (k === 'forestDev') { c.forest = i.checked ? 'parking' : 'keep'; if (used() > budget()) { c.forest = 'keep'; toast('토큰이 부족해져요. 다른 공사를 먼저 취소하세요.'); } }
      else if (k === 'usePromise') state.c3 = i.checked ? { treeCare: 0, facilityCare: 0, forestLaw: 0 } : null;
      else if (pk) { state.c3[pk] = i.checked ? 1 : 0; if (state.c3.treeCare + state.c3.facilityCare + state.c3.forestLaw > 2) { state.c3[pk] = 0; toast('약속 카드는 2장까지예요.'); } }
      else { c[k] = i.checked ? 1 : 0; if (used() > budget()) { c[k] = 0; toast('토큰이 부족해요.'); } }
      render(); SCENE.build(); saveGame(SCENE);
    });
  };
  render(); dlg.classList.toggle('ch3', state.ch3.phase === 'plan'); dlg.showModal(); state.planned = true;
}
// 두 미래 비교 카드(초등 눈높이): 큰 숫자 + 막대 + 한 줄 뜻. 값은 모델 결과 그대로, 출처·한계는 접힌 '자세히'에
function cmpRows(rows) {
  return `<div class="cmp-head"><span></span><b class="me">🧒 지금 내 미래</b><b class="base">아무것도 안 한 미래</b></div>` + rows.map(r => {
    const bar = v => `<i style="width:${Math.max(2, Math.min(100, v / r.max * 100)).toFixed(0)}%"></i>`;
    const diff = r.mine - r.base, same = Math.abs(diff) < (r.eps ?? 0.5), good = same ? null : (diff > 0) === (r.better === 'up');
    return `<div class="cmp-row"><div class="lab">${r.icon} ${r.label}<small>${r.hint}</small></div>
      <div class="val me">${r.fmt(r.mine)}<span class="bar">${bar(r.mine)}</span></div><div class="val base">${r.fmt(r.base)}<span class="bar">${bar(r.base)}</span></div>
      <div class="say ${same ? '' : good ? 'good' : 'bad'}">${same ? '➖ 아무것도 안 한 미래와 같아요' : good ? '👍 ' + r.good : '⚠️ ' + r.bad}</div></div>`;
  }).join('');
}
export function showRainResult(scene, success, reason) {
  const d = scene.swmmData(), b = scene.swmm['FKT0Y0C0-P0R0B0'], R = scene.rules.rain; const D = scene.drainLoad(), Db = Math.max(b.pipe_load.C5, b.pipe_load.C6);
  $('#result h2').textContent = '같은 양의 큰비, 두 미래';
  const head = success === null ? '' : `<p class="big">${success ? '약을 제때 전했어요!' : reason === 'deep' ? '물이 깊게 고여 길을 건너지 못했어요.' : '물을 피해 돌아가느라 늦었어요.'}</p><p class="note">↑ 게임 결과(10초 배달 규칙)예요.</p>`;
  $('#result .body').innerHTML = `${head}
    ${cmpRows([
      { icon: '💧', label: '마을 밖으로 흘러간 빗물', hint: '적을수록 땅이 빗물을 잘 품었어요', mine: d.runoff_mm, base: b.runoff_mm, max: Math.max(d.runoff_mm, b.runoff_mm), better: 'down', eps: 0.5, fmt: v => `${(+v).toFixed(1)}<small> mm</small>`, good: '빗물이 덜 흘러넘쳤어요', bad: '빗물이 더 많이 흘렀어요' },
      { icon: '🚰', label: '하수관이 꽉 찬 정도', hint: '100%가 되면 넘쳐서 길에 물이 고여요', mine: Math.round(D * 100), base: Math.round(Db * 100), max: 100, better: 'down', eps: 1, fmt: v => `${v}<small>%</small>`, good: '하수관에 여유가 생겼어요', bad: '하수관이 더 꽉 찼어요' }])}
    <details class="more"><summary>🔬 자세히 (과학 계산 근거)</summary>
    <p>하천으로 가장 많이 흐를 때: 지금 ${d.peak_outflow_cms.toFixed(3)} m³/s · 아무것도 안 한 미래 ${b.peak_outflow_cms.toFixed(3)} m³/s</p>
    <p class="note">같은 '2126년 가상 집중호우(3시간 100.1 mm)'에서 땅 쓰임만 바꿔 EPA SWMM 5.2로 계산했어요(하수관 넘침 0). SWMM은 길에 고인 물의 깊이를 계산하지 않아요 — 물웅덩이는 하수관이 꽉 찬 정도가 ${Math.round(R.shallowD * 100)}%를 넘으면 얕게, ${Math.round(R.deepD * 100)}%를 넘으면 깊게 보여 주는 게임 표현이고, 실제로 물이 얼마나 차는지 예측한 것이 아니에요.</p></details>`;
  $('#result').showModal();
}
export function showResult(scene, key, success) {
  $('#result h2').textContent = '같은 폭염, 두 미래';
  const d = scene.heat.scenarios[key], base = scene.heat.scenarios['FKT0Y0C0|TC1FL1'];
  const s = d.summary, b = base.summary; const sens = scene.heat.sensitivity?.[key];
  const dt = (s.route_tair_mean - b.route_tair_mean);
  $('#result .body').innerHTML = `
    ${success === null ? '' : `<p class="big">${success ? '쉼터에 무사히 도착했어요!' : '그늘이 부족해 여러 번 쉬어야 했어요.'}</p><p class="note">↑ 게임 결과(더위 게이지 규칙)예요. 실제 사람의 안전을 판단한 것이 아니에요.</p>`}
    ${cmpRows([
      { icon: '🌳', label: '등굣길 그늘', hint: '나무 그늘이 덮은 칸이 많을수록 시원해요', mine: Math.round(s.route_shade_frac * 100), base: Math.round(b.route_shade_frac * 100), max: 100, better: 'up', eps: 1, fmt: v => `${v}<small>%</small>`, good: '그늘이 더 많아졌어요', bad: '그늘이 더 줄었어요' },
      { icon: '🧊', label: '시원함 점수', hint: '0~1 사이, 클수록 시원한 길이에요', mine: +s.route_hm_mean.toFixed(2), base: +b.route_hm_mean.toFixed(2), max: 1, better: 'up', eps: 0.01, fmt: v => v.toFixed(2), good: '길이 더 시원해졌어요', bad: '길이 더 뜨거워졌어요' }])}
    <p class="tdiff">🌡 아무것도 안 한 미래와 비교한 등굣길 기온: <b>${dt <= 0 ? '' : '+'}${dt.toFixed(1)} ℃</b> <small>(비교용 계산 값 · 일기예보가 아니에요)</small></p>
    <details class="more"><summary>🔬 자세히 (과학 계산 근거)</summary>
    ${sens ? `<p class="note">나무 자료·고사율을 바꿔 계산해도 그늘 칸 ${Math.round(sens.route_shade_frac_range[0] * 100)}–${Math.round(sens.route_shade_frac_range[1] * 100)}% 범위예요.</p>` : ''}
    <p class="note">같은 '2126년 가상 폭염일' 조건에서 땅 쓰임만 바꿔 InVEST 도시 냉각 모델로 계산했어요. 가로수는 느티나무 성장 자료(미국 도시 가로수, USDA)와 해마다 일부가 죽고 다시 심는 과정을 반영했어요. 햇살마을은 가상 마을이고, 기온은 정확한 예보가 아니라 비교용이에요. '그늘 칸'(냉각지수 HM ≥ 0.35)과 더위 게이지는 게임 규칙이에요.</p></details>`;
  $('#result').showModal();
}
export function sfxWarp() { audio.sfx('warp'); }

// 자세히 보기: 기본 화면에서 숨긴 과학 수치를 출처·의미·한계와 함께
export function showInfo(scene) {
  if (state.year !== 2126) return;
  if (state.weather === 'rain') return showRainResult(scene, null);
  showResult(scene, heatKey(state.c1, state.c3), null);
  $('#result h2').textContent = '2126년 이 미래의 자료';
}
