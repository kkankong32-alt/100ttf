// RPG 공통 시스템(v3): 상태별 NPC 대화·배치·순찰·말풍선, 이야기 주제 고르기, 단서 골라 설득하기, 추리 노트(가설 검증),
// 작은 가방, 주민 회의(예산 = 기존 525조합 규칙), 돌봄 팀(사람·묘목·다시 심기), 로미 힌트·측정, 미래 엽서, 동행.
// 콘텐츠는 data/ch*.json, 이 파일은 엔진(2·3장에서도 그대로 재사용). 학생 조작은 이동·E·선택(숫자/클릭)·시간여행.
import { state, $, saveGame, toast, openPlanner, josa } from './core.js';
import { audio } from './audio.js';

// ---------- 순수 함수(Node 테스트) ----------
export const DEFAULT_PLAN = { forest: 'keep', streetTrees: 1, schoolyard: 0, coolPave: 0 };   // 기본 역사: 가로수 20그루만(관리 '나중에 정함')
export const DEFAULT_PLAN2 = { permeable: 0, rainGarden: 0, basin: 0 };                   // 2장 빗물 시설(기본 역사: 없음)
export const RAIN_BUDGET = 2, RAIN_COST = { permeable: 1, rainGarden: 1, basin: 2 };       // 기존 게시판 빗물 토큰 규칙(world.json COST) 그대로 → 5개 유효 Ch2 조합
export const PROMISE_MAX = 2;                                                               // 기존 약속 카드 규칙 → 7개 유효 Ch3 조합
export const newRpgState = () => ({ mode: 'rpg', ch: 1, v: 4, flags: {}, items: {}, facts: [], postcards: [], planted: [], watered: [],
  treeCare: 0, plan: { ...DEFAULT_PLAN }, care: { group: 0, replant: 0, nursery: 0 }, conclusion: null, conclusions: {}, hints: {}, futures: [], escort: null,
  plan2: { ...DEFAULT_PLAN2 }, c3on: false, promise: { treeCare: 0, facilityCare: 0, forestLaw: 0 }, records: {}, chrono: {} });
// 이전 저장(세션 7 RPG: 단서 아이템·서명) → v3 구조. 이미 이룬 결과(돌봄·운동장)는 그대로 인정
const OLD_CLUE = { photo: 'f_photo', ledger: 'f_ledger', pitnote: 'f_rings', drawing: null };
export function normalizeRpg(r) {
  if (!r || r.mode !== 'rpg' || r.v === 4) return r;
  if (r.v === 3) { const n = { ...newRpgState(), ...r, v: 4 }; if (r.flags?.ch1done && n.ch < 2) n.ch = 2; if (r.conclusion) n.conclusions = { 1: r.conclusion }; return n; }
  const n = newRpgState(); Object.assign(n, { flags: r.flags ?? {}, postcards: r.postcards ?? [], planted: r.planted ?? [], watered: r.watered ?? [], escort: null });
  for (const [k, v] of Object.entries(r.items ?? {})) { if (k in OLD_CLUE) { if (OLD_CLUE[k]) n.facts.push(OLD_CLUE[k]); if (k === 'drawing') n.items.drawing = v; } else if (['sapling'].includes(k)) n.items[k] = v; }
  if (r.flags?.posted_plan || r.treeCare) { n.care = { group: 1, replant: 1, nursery: 1 }; n.treeCare = 1; }
  if (r.schoolyard) { n.plan.schoolyard = 1; n.flags.prop_yard = true; }
  if (r.flags?.met_haneul && !n.facts.includes('f_yard')) n.facts.push('f_yard');
  n.v = 3; return normalizeRpg(n);
}
// 돌봄 팀 = 돌볼 사람(돌봄 모임) + 다시 심을 묘목(묘목밭) + 다시 심는 약속(화원). 셋이 다 있어야 모델의 '나무 돌봄(보충 심기)'=1
export const careComplete = c => !!(c?.group && c?.replant && c?.nursery);
// 조건: 모든 키를 만족해야 참
export function matches(cond = {}, ctx) {
  for (const [k, v] of Object.entries(cond)) {
    if (k === 'era' && ctx.era !== v) return false;
    if (k === 'weather' && ctx.weather !== v) return false;
    if (k === 'flags' && !v.every(f => ctx.flags[f])) return false;
    if (k === 'notFlags' && v.some(f => ctx.flags[f])) return false;
    if (k === 'items' && !v.every(i => (ctx.items[i] ?? 0) > 0)) return false;
    if (k === 'noItems' && v.some(i => (ctx.items[i] ?? 0) > 0)) return false;
    if (k === 'facts' && !v.every(f => ctx.facts.includes(f))) return false;
    if (k === 'noFacts' && v.some(f => ctx.facts.includes(f))) return false;
    if (k === 'anyFact' && !v.some(f => ctx.facts.includes(f))) return false;
    if (k === 'factsAtLeast' && (ctx.chFacts ?? ctx.facts).length < v) return false;     // 지금 장에서 알아낸 단서 수
    if (k === 'factsLess' && (ctx.chFacts ?? ctx.facts).length >= v) return false;
    if (k === 'tc' && ctx.tc !== v) return false;
    if (k === 'yard' && ctx.yard !== v) return false;
    if (k === 'T' && ctx.T !== v) return false;
    if (k === 'C' && ctx.C !== v) return false;
    if (k === 'F' && ctx.F !== v) return false;
    if (k === 'shade' && ctx.shade !== v) return false;
    if (k === 'care' && !v.every(c => ctx.care[c])) return false;
    if (k === 'noCare' && v.some(c => ctx.care[c])) return false;
    if (k === 'careDone' && careComplete(ctx.care) !== v) return false;
    if (k === 'concl' && ctx.concl !== v) return false;
    if (k === 'noConcl' && !!ctx.concl === v) return false;
    if (k === 'plantedAtLeast' && ctx.planted < v) return false;
    if (k === 'plantedLess' && ctx.planted >= v) return false;
    if (k === 'wateredAtLeast' && ctx.watered < v) return false;
    if (k === 'plantedHere' && !!ctx.plantedHere !== v) return false;
    if (k === 'wateredHere' && !!ctx.wateredHere !== v) return false;
    if (k === 'futuresAtLeast' && ctx.futures < v) return false;
    if (k === 'ch1done' && !!ctx.flags.ch1done !== v) return false;
    if (k === 'ch' && ctx.ch !== v) return false;
    if (k === 'chAtLeast' && ctx.ch < v) return false;
    if (k === 'region' && ctx.region !== v) return false;
    if (k === 'P' && ctx.P !== v) return false;
    if (k === 'R' && ctx.R !== v) return false;
    if (k === 'B' && ctx.B !== v) return false;
    if (k === 'anyRain' && !!(ctx.P || ctx.R || ctx.B) !== v) return false;
    if (k === 'c3on' && !!ctx.c3on !== v) return false;
    if (k === 'fc' && ctx.fc !== v) return false;
    if (k === 'fl' && ctx.fl !== v) return false;
    if (k === 'puddle' && ctx.puddle !== v) return false;
    if (k === 'notPuddle' && ctx.puddle === v) return false;
    if (k === 'promised' && !v.every(p => ctx.promise[p])) return false;
    if (k === 'notPromised' && v.some(p => ctx.promise[p])) return false;
    if (k === 'record' && !v.every(p => ctx.records[p])) return false;
    if (k === 'noRecord' && v.some(p => ctx.records[p])) return false;
    if (k === 'hasConcl' && !!ctx.concl !== v) return false;
    if (k === 'recordsAtLeast' && Object.keys(ctx.records ?? {}).length < v) return false;
    if (k === 'chronoAtLeast' && (ctx.chronoN ?? 0) < v) return false;
    if (k === 'itemsAtLeast' && Object.entries(v).some(([i, n]) => (ctx.items[i] ?? 0) < n)) return false;
  }
  return true;
}
export const pick = (list = [], ctx) => list.find(e => matches(e.if, ctx)) ?? null;
// 비 오는 날엔 더위 말풍선(폭염·덥다·뜨겁다·그늘이 시원…)을 띄우지 않음 — 날씨와 안 맞는 혼잣말 방지
const HEAT_WORDS = /폭염|더워|덥|뜨거|햇볕|뙤약|땡볕|시원/;
export const weatherFits = (text = '', ctx) => !(ctx.weather === 'rain' && HEAT_WORDS.test(text));
export const fill = (s, ctx) => String(s).replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
// 효과 적용(rpg 상태를 바꾸고, 화면 처리할 사건 목록을 돌려줌)
export function applyEffects(rpg, effects = [], content, at = {}) {
  const events = [];
  for (const e of effects) {
    if (e.give) { rpg.items[e.give] = (rpg.items[e.give] ?? 0) + (e.n ?? 1); events.push({ type: 'give', id: e.give, n: e.n ?? 1 }); }
    if (e.take) { rpg.items[e.take] = Math.max(0, (rpg.items[e.take] ?? 0) - (e.n ?? 1)); if (!rpg.items[e.take]) delete rpg.items[e.take]; }
    if (e.flag) rpg.flags[e.flag] = true;
    if (e.fact && !rpg.facts.includes(e.fact)) { rpg.facts.push(e.fact); events.push({ type: 'fact', id: e.fact }); }
    if (e.care) { const was = careComplete(rpg.care); Object.assign(rpg.care, e.care); rpg.treeCare = careComplete(rpg.care) ? 1 : 0; events.push({ type: 'care', care: e.care, complete: !was && careComplete(rpg.care) }); }
    if (e.plan) { Object.assign(rpg.plan, e.plan); events.push({ type: 'plan', plan: e.plan }); }
    if (e.set) { for (const [k, v] of Object.entries(e.set)) { if (k === 'schoolyard') rpg.plan.schoolyard = v; else rpg[k] = v; } events.push({ type: 'set', set: e.set }); }
    if (e.postcard && !rpg.postcards.includes(e.postcard)) { rpg.postcards.push(e.postcard); events.push({ type: 'postcard', id: e.postcard }); }
    if (e.plant && at.slot !== undefined && !rpg.planted.includes(at.slot)) { rpg.planted.push(at.slot); events.push({ type: 'plant', slot: at.slot }); }
    if (e.water && at.slot !== undefined && !rpg.watered.includes(at.slot)) { rpg.watered.push(at.slot); events.push({ type: 'water', slot: at.slot }); }
    if (e.escort) events.push({ type: 'escort', npc: e.escort });
    if (e.open) events.push({ type: 'open', what: e.open });
    if (e.say) events.push({ type: 'say', lines: e.say });
    if (e.plan2) { Object.assign(rpg.plan2, e.plan2); events.push({ type: 'plan2' }); }
    if (e.promise) { Object.assign(rpg.promise, e.promise); events.push({ type: 'promise' }); }
    if (e.c3on !== undefined) { rpg.c3on = !!e.c3on; if (rpg.c3on && rpg.treeCare) rpg.promise.treeCare = 1; events.push({ type: 'promise' }); }
    if (e.record) { rpg.records[e.record] = true; events.push({ type: 'record', id: e.record }); }
    if (e.chapter && rpg.ch < e.chapter) { rpg.ch = e.chapter; events.push({ type: 'chapter', n: e.chapter }); }
    if (e.game) events.push({ type: 'game', game: e.game });
  }
  return events;
}
// 과학 변수 대응: 1장 행동 → 기존 525개 조합의 선택 변수(새 변수 없음). 회의에서 정한 사업 + 돌봄 팀
// c2 = 2장에서 직접 설치한 빗물 시설, c3 = 3장에서 맺은 약속(3장 전에는 null = 시설 관리 지속 가정, 나무 돌봄은 1장 결과)
export function choicesFromRpg(rpg) {
  const p = { ...DEFAULT_PLAN, ...(rpg.plan ?? {}) }; if (rpg.schoolyard) p.schoolyard = 1;   // 이전 저장 호환
  const q = { ...DEFAULT_PLAN2, ...(rpg.plan2 ?? {}) }, pr = rpg.promise ?? {};
  return { c1: { forest: p.forest, streetTrees: p.streetTrees ? 1 : 0, schoolyard: p.schoolyard ? 1 : 0, coolPave: p.coolPave ? 1 : 0 }, treeCare: rpg.treeCare ? 1 : 0,
    c2: { permeable: q.permeable ? 1 : 0, rainGarden: q.rainGarden ? 1 : 0, basin: q.basin ? 1 : 0 },
    c3: rpg.c3on ? { treeCare: pr.treeCare ? 1 : 0, facilityCare: pr.facilityCare ? 1 : 0, forestLaw: pr.forestLaw ? 1 : 0 } : null };
}
// 장이 바뀌는 순간의 상태(장면 대사를 기다리지 않음): 3장 = '지금까지 한 약속만' 이어지는 미래(나무 돌봄 = 1장 돌봄 팀, 나머지 0)
export function initChapterState(r) {
  if (r.ch >= 3 && !r.flags.c3init) { r.c3on = true; if (r.treeCare) r.promise.treeCare = 1; r.flags.c3init = true; }
  return r;
}
export const rainUsed = q => Object.entries(RAIN_COST).reduce((a, [k, c]) => a + (q[k] ? c : 0), 0);
export const validPlan2 = q => rainUsed(q) <= RAIN_BUDGET;
export const promiseCount = p => (p.treeCare ? 1 : 0) + (p.facilityCare ? 1 : 0) + (p.forestLaw ? 1 : 0);
export const validPromise = p => promiseCount(p) <= PROMISE_MAX;
// 장별 콘텐츠(ch1·ch2·ch3.json)를 하나로: NPC·사물·메뉴·단서는 이름으로 합치고, 목표·힌트에는 장 조건(ch)을 붙인다
export function mergeContent(list) {
  const out = { items: {}, facts: {}, hypotheses: [], postcards: {}, menus: {}, npcs: {}, objects: {}, scenes: {}, records: {}, hints: [], goals: [], measure: [], questions: {}, titles: {}, steps: {} };
  for (const c of list) {
    const n = c.chapter, tag = e => ({ ...e, if: { ch: n, ...(e.if ?? {}) } });
    for (const [k, v] of Object.entries(c)) if (!(k in out) && !['chapter', 'title', 'question', '_note'].includes(k)) out[k] = v;   // 장 고유 항목(1장 history·meeting 등)
    for (const k of ['items', 'postcards', 'menus', 'npcs', 'objects', 'scenes', 'records']) Object.assign(out[k], c[k] ?? {});
    for (const [k, f] of Object.entries(c.facts ?? {})) out.facts[k] = { ...f, ch: f.ch ?? n };
    out.hypotheses.push(...(c.hypotheses ?? []).map(h => ({ ...h, ch: h.ch ?? n })));
    out.hints.push(...(c.hints ?? []).map(tag)); out.goals.push(...(c.goals ?? []).map(tag)); out.measure.push(...(c.measure ?? []));
    out.questions[n] = c.question; out.titles[n] = c.title; if (c.steps) Object.assign(out.steps, c.steps);
  }
  return out;
}
// 주민 회의: 예산 = 2(+뒷산 개발 1) — 기존 게시판 공사 토큰 규칙과 같아 결과는 항상 15개 Ch1 조합 안
export const meetingBudget = forest => 2 + (forest === 'parking' ? 1 : 0);
export function meetingOptions(known, forest, swapped) {
  const left = meetingBudget(forest) - 1, cand = [];                // 가로수(또는 그 대신 밝은 포장)가 1개를 씀
  if (known.yard) cand.push('schoolyard'); if (known.pave && !swapped) cand.push('coolPave');
  const subsets = [[]]; for (const c of cand) for (const s of subsets.slice()) subsets.push([...s, c]);
  return subsets.filter(s => s.length && s.length <= left);
}
export const validPlan = p => { const used = (p.streetTrees ? 1 : 0) + (p.schoolyard ? 1 : 0) + (p.coolPave ? 1 : 0); return used <= meetingBudget(p.forest) && ['keep', 'parking'].includes(p.forest); };
// 가설 검증: 찾은 단서 중 맞는 것·어긋나는 것
export function judge(h, facts) {
  const sup = h.support.filter(f => facts.includes(f)), ref = h.refute.filter(f => facts.includes(f));
  return { sup, ref, verdict: ref.length ? 'refuted' : sup.length ? 'supported' : 'unknown' };
}

// ---------- 장면 메서드(SchoolFront에 섞음) ----------
const SPEAKER = { me: '나', romi: '로미' };
const PC_ART = 'assets/codex/fullgame-art-v1/';     // Codex 대표 엽서 원화(실제 게임 화면 기반) — 얻은 순간의 화면은 작은 사진으로 함께
export const RpgMethods = {
  rpgOn() { return state.rpg?.mode === 'rpg' && state.prologue === 'done'; },
  rpgSync() {                                        // rpg 상태 → 과학 선택 변수
    if (state.rpg?.mode !== 'rpg') return;
    state.rpg = normalizeRpg(state.rpg);
    initChapterState(state.rpg);
    const ch = choicesFromRpg(state.rpg); Object.assign(state.c1, ch.c1); Object.assign(state.c2, ch.c2); state.c3 = ch.c3;
    // 날씨: 2장 동안 2126년은 아주 큰비, 그 밖엔 아주 더운 날(3장 이후엔 로미에게 '비 오는 날 보기'를 부탁할 수 있음)
    if (state.prologue === 'done') state.weather = state.year === 2126 && (state.rpg.ch === 2 || state.rpg.flags.rainView) ? 'rain' : 'heat';
  },
  rpgCtx(extra = {}) {
    const r = state.rpg, c1 = choicesFromRpg(r).c1, tc = r.treeCare ? 1 : 0, d = this.heatData?.(), trees = d?.trees ?? [];
    const live = trees.filter(t => t.rep?.state === 'tree');
    const chs = choicesFromRpg(r), c2 = chs.c2, c3 = chs.c3, tcEff = c3 ? c3.treeCare : tc, load = this.drainLoad?.() ?? 0;
    return { era: state.year, weather: state.weather, flags: r.flags, items: r.items, facts: r.facts, tc: tcEff, yard: c1.schoolyard, T: c1.streetTrees, C: c1.coolPave, F: c1.forest,
      shade: !!(c1.streetTrees && tcEff), care: r.care, concl: r.ch === 1 ? r.conclusion : r.conclusions?.[r.ch] ?? null, planted: r.planted.length, watered: r.watered.length, futures: r.futures.length,
      liveTrees: live.length, origTrees: live.filter(t => t.rep.age >= 2126 - 2026).length,
      ch: r.ch, region: this.region?.() ?? 'A', P: c2.permeable, R: c2.rainGarden, B: c2.basin, c3on: !!c3, fc: c3 ? c3.facilityCare : 1, fl: c3 ? c3.forestLaw : null,
      chFacts: r.facts.filter(id => (this.ch.facts[id]?.ch ?? 1) === Math.min(r.ch, 3)), promise: r.promise, records: r.records, chronoN: Object.keys(r.chrono ?? {}).length, puddle: this.puddleLevel?.() ?? 'none', load: Math.round(load * 100), tokens: r.items.raintoken ?? 0, ...extra };
  },
  // NPC 배치: 콘텐츠 NPC id → 공용 스프라이트(같은 스프라이트는 한 시대에 한 명만 나오도록 콘텐츠를 짬)
  rpgPlaceNPCs() {
    this.npcBlocks = []; this.rpgNpcAt = {}; this.patrols = {};
    const used = new Set(), ctx = this.rpgCtx();
    if (this.rpgOn() && state.year === 2126 && !this.timelapsing) { const k = this.heatKeyNow(); if (!state.rpg.futures.includes(k)) state.rpg.futures.push(k); }   // 다녀온 2126년 기록(노트)
    if (this.rpgOn()) for (const [id, n] of Object.entries(this.ch.npcs)) {
      if ((n.region ?? 'A') !== this.region()) continue;
      if (state.rpg.escort === id) { used.add(n.sprite); continue; }
      const pl = pick(n.place, ctx); const vis = this.vis[n.sprite]; if (!pl || !vis || used.has(n.sprite)) continue;
      used.add(n.sprite); vis.setVisible(true).place(pl.at[0], pl.at[1], pl.face); this.rpgNpcAt[id] = vis;
      if (pl.patrol) this.patrols[id] = { vis, pts: [pl.at, ...pl.patrol], i: 1, wait: 1200 };
      else if (pl.block) this.npcBlocks.push(this.npcBox(vis));
      if (pl.blockRect) this.npcBlocks.push(pl.blockRect);              // 문을 지키는 사람: 문 전체를 막음(옆 틈으로 빠져나가지 않게)
    }
    for (const [key, vis] of Object.entries(this.vis)) if (!used.has(key) && (this.rpgOn() || !(key === 'granny' || key === 'pharm'))) vis.setVisible(false);
    return used;
  },
  // 순찰(물 주러 다니기 등)과 말풍선: 매 프레임
  rpgTick(dt) {
    if (!this.rpgOn()) { this.hideBarks?.(); return; }
    const P = this.player, busy = !$('#talk').hidden || this.choosing || this.traveling || this.timelapsing || this.cinematic;
    for (const pt of Object.values(this.patrols ?? {})) {
      const v = pt.vis; if (state.mission.active && v === this.escortNpc) continue;
      const near = Math.hypot(P.x - v.x, P.y - v.y) < 90;
      if (near || busy) { v.update(v.x, v.y, dt); if (near) v.lookAt(P.x, P.y); continue; }
      if (pt.wait > 0) { pt.wait -= dt; v.update(v.x, v.y, dt); continue; }
      const [tx, ty] = pt.pts[pt.i], d = Math.hypot(tx - v.x, ty - v.y), step = 24 * dt / 1000;
      if (d <= step) { v.update(tx, ty, dt); pt.i = (pt.i + 1) % pt.pts.length; pt.wait = 1800; } else v.update(v.x + (tx - v.x) / d * step, v.y + (ty - v.y) / d * step, dt);
    }
    this.tickBarks(dt, busy);
    // 막힘 알림: 45초 동안 새로 알아낸 것·바뀐 것이 없으면 💡 힌트 버튼이 깜박이고 로미가 한 번 알려 줌
    const r = state.rpg, sig = `${r.ch}/${r.facts.length}/${Object.keys(r.flags).length}/${r.postcards.length}/${state.year}/${this.region()}/${Object.keys(r.items).length}`, now = performance.now();
    if (sig !== this.stallSig) { this.stallSig = sig; this.stallT = now; this.stallTold = false; $('#btn-romi')?.classList.remove('pulse'); }
    else if (!busy && !this.stallTold && now - this.stallT > 25000) { this.stallTold = true; $('#btn-romi')?.classList.add('pulse'); this.stepHint = { until: now + 15000 };   // 25초 동안 진행이 없으면 힌트 버튼 반짝 + 화살표 15초
      toast('🤖 로미: 화살표를 따라가 봐요! 그래도 모르겠으면 왼쪽 💡 힌트를 눌러요.', 4500); }
  },
  tickBarks(dt, busy) {
    const box = $('#barks'); if (!box) return; this.barkT ??= {}; this.barkEl ??= {};
    const P = this.player, ctx = this.rpgCtx(), now = performance.now();
    // 이미 화면에 있는 글자(살펴보기 버튼·목표 표식)와 겹치면 말풍선을 그 위로 올림 — 여러 말풍선끼리도 겹치지 않게
    const taken = ['#prompt', '#marker'].map(q => $(q)).filter(e => e && !e.hidden).map(e => e.getBoundingClientRect());
    const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
    for (const [id, vis] of Object.entries(this.rpgNpcAt ?? {})) {
      let el = this.barkEl[id]; const b = !busy && vis.sprite.visible ? pick((this.ch.npcs[id].bark ?? []).filter(x => weatherFits(x.text, ctx)), ctx) : null;
      const d = Math.hypot(P.x - vis.x, P.y - vis.y), t = this.barkT[id] ?? { until: 0, next: 0 };
      if (b && d < 190 && d > 40 && now > t.next) { t.until = now + 3200; t.next = now + 14000; t.text = fill(b.text, ctx); }
      this.barkT[id] = t;
      const show = !busy && now < t.until && vis.sprite.visible;
      if (!el && show) { el = document.createElement('div'); el.className = 'bark'; box.appendChild(el); this.barkEl[id] = el; }
      if (!el) continue;
      el.hidden = !show; if (!show) continue;
      if (el.textContent !== t.text) el.textContent = t.text;
      const [sx, sy] = this.toScreen(vis.x, vis.y - vis.height - 10); el.style.left = sx + 'px'; el.style.top = sy + 'px';
      for (let k = 0, rc = el.getBoundingClientRect(); k < 4; k++) { const o = taken.find(t => hit(rc, t)); if (!o) break;
        el.style.top = (parseFloat(el.style.top) - (rc.bottom - o.top) - 6) + 'px'; rc = el.getBoundingClientRect(); }
      taken.push(el.getBoundingClientRect());
    }
  },
  hideBarks() { for (const el of Object.values(this.barkEl ?? {})) el.hidden = true; },
  // 가까운 콘텐츠 대상(NPC·오브젝트): { kind, id, entry, at, h, label, slot }
  rpgNearby() {
    if (!this.rpgOn()) return null;
    const ctx0 = this.rpgCtx(), P = this.player, cand = [];                // 범위 안의 대상 중 가장 가까운 것(NPC와 사물 구분 없이)
    for (const [id, vis] of Object.entries(this.rpgNpcAt ?? {})) {
      const d = Math.hypot(P.x - vis.x, P.y - vis.y); if (d > this.zone.interactRadius) continue;
      if (state.mission.active && state.rpg.escort === id) continue;            // 함께 걷는 중인 사람에겐 말 걸기 버튼을 띄우지 않음
      const e = pick(this.ch.npcs[id].talk, ctx0); if (!e) continue;
      cand.push({ d, kind: 'npc', id, entry: e, at: [vis.x, vis.y], h: vis.height + 4, label: e.label ?? `${josa(this.ch.npcs[id].name, '와/과')} 이야기` });
    }
    for (const [id, o] of Object.entries(this.ch.objects)) {
      if ((o.region ?? 'A') !== this.region()) continue;
      for (const sp of this.objSpots(o)) {
        const d = Math.hypot(P.x - sp.at[0], P.y - sp.at[1]); if (d > (o.r ?? 70)) continue;
        const ctx = this.slotCtx(ctx0, sp.slot);
        const e = pick(o.talk, ctx); if (!e) continue;
        cand.push({ d, kind: 'obj', id, entry: e, at: sp.at, h: o.h ?? 40, label: e.label ?? '살펴보기', slot: sp.slot });
      }
    }
    cand.sort((a, b) => a.d - b.d); return cand[0] ?? null;
  },
  objSpots(o) { return o.slots ? this.ch[o.slots].map(s => ({ at: this.zone.trees.street.find(t => t.slot === s).foot, slot: s })) : [{ at: o.at }]; },
  slotCtx(ctx, slot) { return slot === undefined ? ctx : { ...ctx, plantedHere: state.rpg.planted.includes(slot), wateredHere: state.rpg.watered.includes(slot), replantYear: this.replantYear(slot) }; },
  replantYear(slot) { const rep = this.heatData()?.trees?.[slot]?.rep; return rep?.state === 'tree' ? 2126 - rep.age : ''; },
  // ---------- 대화: 줄 → 효과 → (주제 고르기 | 단서 고르기 | 회의 | 노트) ----------
  rpgInteract(t) {
    if (t.kind === 'npc') this.rpgNpcAt[t.id]?.greet(this.player.x, this.player.y);
    const who = t.kind === 'npc' ? this.ch.npcs[t.id].name : (t.entry.who ?? '');
    this.runEntry(t.entry, who, t);
  },
  runEntry(e, who, t) {
    const ctx = this.slotCtx(this.rpgCtx(), t?.slot), lines = (e.lines ?? []).map(([w, s]) => [SPEAKER[w] ?? w, fill(s, ctx)]);
    const after = () => {
      this.applyDo(e.do, t);
      if (e.evidence) return this.askEvidence(e.evidence, who, t);
      if (e.ask) return this.askTopics(e.ask, who, t);
      if (e.meeting) return this.runMeeting();
      if (e.slot) return this.slotInteract(e.slot, who, t);
      if (e.play) return this.runGame(e.play, e, who, t);
      if (e.notebook) return this.openNotebook();
    };
    lines.length ? this.talk(lines, after) : after();
  },
  applyDo(effects, t) {
    if (!effects?.length) return;
    const ev = applyEffects(state.rpg, effects, this.ch, { slot: t?.slot });
    this.rpgSync(); this.rpgEvents(ev); saveGame(this); this.updateHud();
  },
  askTopics(ask, who, t) {
    if (typeof ask === 'string') ask = this.ch.menus[ask];
    const ctx = this.slotCtx(this.rpgCtx(), t?.slot), opts = ask.options.filter(o => matches(o.if, ctx));
    if (!opts.length && !ask.q) return;
    const list = [...opts.map(o => ({ label: fill(o.label, ctx), done: o.doneIf && matches(o.doneIf, ctx) })), { label: ask.bye ?? '그만 이야기하기', bye: true }];
    this.choose(who, fill(ask.q ?? '무엇을 이야기할까?', ctx), list, i => { if (i < opts.length) this.runEntry(opts[i], who, t); });
  },
  factLabel(id) {
    if (id.startsWith('concl:')) { const h = this.ch.hypotheses.find(x => x.id === id.slice(6)); return `📓 내 추리: ${h.text}`; }
    const f = this.ch.facts[id]; return `${f.icon} ${f.title}`;
  },
  factPitch(id) {
    if (id.startsWith('concl:')) return this.ch.hypotheses.find(x => x.id === id.slice(6)).pitch;
    return this.ch.facts[id].pitch;
  },
  // 단서 골라 설득하기: 가진 단서(+노트의 추리) 가운데 상대의 의문에 맞는 것을 골라야 한다. 틀리면 상대가 왜 아닌지 말해 줌(벌점 없음)
  askEvidence(ev, who, t) {
    // 그 설득이 속한 장의 단서 + 그 장의 내 추리(엔딩 뒤 2장 시설을 다시 만들 때도 2장 단서를 보여 줌)
    const r = state.rpg, ech = this.ch.facts[ev.accept.find(id => !id.startsWith('concl:'))]?.ch ?? r.ch;
    const have = r.facts.filter(id => (this.ch.facts[id]?.ch ?? 1) === ech);
    const concl = ech === 1 ? r.conclusion : r.conclusions?.[ech]; if (concl) have.push(`concl:${concl}`);
    if (!have.length) return this.talk((ev.none ?? [['로미', '아직 보여 줄 단서가 없어요. 100년 뒤에서 더 알아 와요.']]).map(([w, s]) => [SPEAKER[w] ?? w, s]));
    // 고를 단서는 3개까지: 맞는 단서(가진 것 중 2개까지) + 다른 단서 1개, 섞어서 — 4학년이 긴 목록에서 헤매지 않게
    const good = have.filter(id => ev.accept.includes(id)).slice(0, 2), other = have.filter(id => !ev.accept.includes(id)).slice(0, 3 - good.length);
    const pickIds = [...good, ...other].sort((a, b) => (a + ev.key).length % 3 - (b + ev.key).length % 3 || a.localeCompare(b));
    const opts = pickIds.map(id => ({ id, label: this.factLabel(id) }));
    this.choose('나', ev.q, [...opts, { label: '아직 모르겠어요', bye: true }], i => {
      if (i >= opts.length) return;
      const id = opts[i].id, pitch = [['나', this.factPitch(id)]];
      if (ev.accept.includes(id)) { r.flags[`ev_${ev.key}`] = true; return this.runEntry({ ...ev.ok, lines: [...pitch, ...(ev.ok.lines ?? [])] }, who, t); }
      r.flags[`evmiss_${ev.key}`] = (r.flags[`evmiss_${ev.key}`] || 0) + 1;
      const no = ev.no?.[id] ?? (id.startsWith('concl:') ? ev.no?.concl : null) ?? ev.no?._ ?? [[who, '음… 그게 무슨 상관이니?']];
      this.talk([...pitch, ...no].map(([w, s]) => [SPEAKER[w] ?? w, s]), () => saveGame(this));
    });
  },
  // ---------- 주민 회의(게시판): 예산 2개(+뒷산 개발 시 1개). 결과는 항상 기존 15개 조합 ----------
  runMeeting() {
    const r = state.rpg, M = this.ch.meeting, known = { yard: r.flags.prop_yard, pave: r.flags.prop_pave, parking: r.flags.prop_parking };
    const plan = { forest: 'keep', streetTrees: 1, schoolyard: 0, coolPave: 0 }, said = [];
    const steps = [];
    if (known.parking) steps.push(next => this.choose('마을 회의', M.parkingQ, [{ label: M.parkingYes }, { label: M.parkingNo }], i => { if (i === 0) { plan.forest = 'parking'; said.push(...M.parkingSaidYes); } next(); }));
    if (known.pave) steps.push(next => this.choose('마을 회의', M.swapQ, [{ label: M.swapKeep }, { label: M.swapPave }], i => { if (i === 1) { plan.streetTrees = 0; plan.coolPave = 1; said.push(...M.swapSaid); } next(); }));
    steps.push(next => {
      const opts = meetingOptions(known, plan.forest, !plan.streetTrees);
      if (!opts.length) { if (!known.yard && !known.pave) said.push(...M.noProposals); return next(); }
      const left = meetingBudget(plan.forest) - 1, nm = { schoolyard: M.yardName, coolPave: M.paveName };
      const list = [...opts.map(s => ({ label: s.map(k => nm[k]).join(' + ') })), { label: M.saveBudget }];
      this.choose('마을 회의', fill(M.slotQ, { left }), list, i => { if (i < opts.length) for (const k of opts[i]) { plan[k] = 1; said.push(...M.said[k]); } else said.push(...M.savedSaid); next(); });
    });
    const run = k => { if (k < steps.length) return steps[k](() => run(k + 1));
      const lines = [...said, ...(r.care.group ? M.careAnnounce : [])].map(([w, s]) => [SPEAKER[w] ?? w, s]);
      this.talk(lines.length ? lines : [['마을 회의', M.nothing]], () => { this.applyDo([{ plan }, { flag: 'meeting_held' }], null); });
    };
    this.talk(M.intro.map(([w, s]) => [SPEAKER[w] ?? w, fill(s, { left: meetingBudget('keep') - 1 })]), () => run(0));
  },
  rpgEvents(ev) {
    let rebuild = false;
    for (const e of ev) {
      if (e.type === 'give') { const it = this.ch.items[e.id]; audio.sfx('confirm'); toast(`${it.icon} ${josa(it.name, '를/을')}${e.n > 1 ? ` ${e.n}개` : ''} 얻었어요`, 3000); this.invFlash(e.id); }
      if (e.type === 'fact') { const f = this.ch.facts[e.id]; audio.sfx('record'); toast(`📓 추리 노트에 적었어요: ${f.icon} ${f.title}`, 3200); this.noteFlash(); }
      if (e.type === 'care') { audio.sfx('jingle_win', 0.7); rebuild = true; if (e.complete) this.time.delayedCall(400, () => this.talk(this.ch.careComplete.map(([w, s]) => [SPEAKER[w] ?? w, s]))); }
      if (e.type === 'plan' || e.type === 'set') { audio.sfx('jingle_chapter', 0.6); rebuild = true; }
      if (e.type === 'plant' || e.type === 'water') { audio.sfx('confirm'); rebuild = true; }
      if (e.type === 'postcard') this.time.delayedCall(300, () => this.awardPostcard(e.id));
      if (e.type === 'escort') this.startEscort(e.npc);
      if (e.type === 'say') this.time.delayedCall(200, () => this.talk(e.lines.map(([w, s]) => [SPEAKER[w] ?? w, fill(s, this.rpgCtx())])));
      if (e.type === 'open' && e.what === 'planner') openPlanner();     // 1장 뒤: 2·3장 대책(빗물·약속)은 기존 게시판 화면
      if (e.type === 'open' && e.what === 'notebook') this.openNotebook();
      if (e.type === 'plan2' || e.type === 'promise') rebuild = true;
      if (e.type === 'record') { audio.sfx('record'); toast(`📒 관리 기록을 찾았어요: ${this.ch.records?.[e.id]?.title ?? e.id}`, 3200); this.noteFlash(); }
      if (e.type === 'chapter') { audio.sfx('jingle_chapter', 0.8); this.onChapter?.(e.n); }
      if (e.type === 'game') this.time.delayedCall(250, () => this.runGame(e.game, {}, '', null));
    }
    if (rebuild) { this.build(); this.ensureFree(); }
    this.renderInv();
  },
  // 목표 문장: 짧게. 화살표·표식은 처음 한 번(marker)과, 로미 힌트 마지막 단계에서만
  // 할 일 목록(장별 단계): 끝난 단계는 ✓, 첫 번째 남은 단계가 목표 문장 + 길 안내 화살표(설정에서 끌 수 있음)
  stepsNow() {
    const r = state.rpg, list = this.ch.steps?.[Math.min(r.ch, 4)] ?? [], ctx = this.rpgCtx();
    let cur = -1; const out = list.map((st, i) => { const done = matches(st.done, ctx); if (!done && cur < 0) cur = i; return { ...st, done }; });
    return { list: out, cur };
  },
  renderSteps() {
    const el = $('#steps'); if (!el) return; const on = this.rpgOn() && !this.titleOpen; el.hidden = !on; if (!on) return;
    const { list, cur } = this.stepsNow(), r = state.rpg, full = this.stepsFull, nDone = list.filter(s => s.done).length;
    el.onclick ??= () => { this.stepsFull = !this.stepsFull; this.renderSteps(); };
    // 평소엔 '지금 할 일 + 다음 할 일'만(화면을 가리지 않게), 누르면 전체 목록
    const row = (s, i) => `<div class="st${s.done ? ' done' : i === cur ? ' now' : ''}">${s.done ? '✓' : i === cur ? '▶' : '·'} ${s.text}</div>`;
    // 미션 묶음(steps의 g): 큰 미션 3~5개만 보이고, 지금 미션 안의 작은 할 일은 하나씩(초등 눈높이)
    if (list.length && list.every(s => s.g)) {
      const G = []; list.forEach((s, i) => { let g = G.find(x => x.t === s.g); if (!g) G.push(g = { t: s.g, ix: [] }); g.ix.push(i); });
      const gi = cur >= 0 ? G.findIndex(g => g.ix.includes(cur)) : G.length, g = G[gi], k = g ? g.ix.indexOf(cur) + 1 : 0;
      const head = `<b>🎯 ${r.ch >= 4 ? '엔딩' : `${r.ch}장`} 미션 ${Math.min(gi + 1, G.length)}/${G.length} <small>${full ? '접기 ▲' : '전체 ▼'}</small></b>`;
      const away = cur >= 0 && list[cur].era && list[cur].era !== state.year ? `⏳ ${list[cur].era}년에 가서: ` : '';
      const stepText = t => away ? t.replace(/^⏳\s*/, '').replace(/^\d{4}년(으로|에)\s*(다시\s*)?(가서|돌아가서|와서)[,:]?\s*/, '') : t;   // '2126년에 가서: 2126년으로 가서 …' 겹침 방지
      const now = g ? `<div class="st mission">${g.t}</div><div class="st now">▶ ${away}${stepText(list[cur].text)}${g.ix.length > 1 ? ` <small>(${k}/${g.ix.length})</small>` : ''}</div>` : '<div class="st now">✓ 이 장의 미션을 다 했어요!</div>';
      const all = G.map((x, j) => `<div class="st${j < gi ? ' done' : j === gi ? ' now' : ''}">${j < gi ? '✓' : j === gi ? '▶' : '·'} ${x.t}</div>`).join('');
      const t = head + (full ? all + (g ? `<div class="st sub">${g.ix.map(i => `${list[i].done ? '✓' : i === cur ? '▶' : '·'} ${list[i].text}`).join('<br>')}</div>` : '') : now);
      if (el.innerHTML !== t) el.innerHTML = t; return;
    }
    const body = full ? list.map(row).join('') : [cur >= 0 ? row(list[cur], cur) : '<div class="st now">✓ 이 장의 할 일을 다 했어요!</div>', cur >= 0 && list[cur + 1] ? `<div class="st">다음: ${list[cur + 1].text}</div>` : ''].join('');
    const t = `<b>📋 ${r.ch >= 4 ? '엔딩' : `${r.ch}장`} 할 일 <small>${nDone}/${list.length} · ${full ? '접기 ▲' : '전체 ▼'}</small></b>${body}`;
    if (el.innerHTML !== t) el.innerHTML = t;
  },
  rpgGoal() {
    if (state.mission.active && state.rpg.escort) return { goal: '🏠 빨간 지붕 집까지 앞장서 걸어요! 하늘이가 뒤따라와요 (그늘에선 덜 지쳐요)', target: this.escortGoal, label: '하늘이네 집', h: 40 };
    if (this.rpgDelivery) return { goal: '💊 시장 끝 빨간 지붕 집 현관까지 10초 안에!', target: this.regionsDef.B.delivery.goal, label: '시장 끝 집', h: 40 };
    const guide = this.mapCam || (this.stepHint && performance.now() < this.stepHint.until) || (() => { try { return localStorage.getItem('ttf.guide') !== '0'; } catch { return true; } })();   // 지도에서는 길잡이를 꺼도 갈 곳을 보여 줌
    const { list, cur } = this.stepsNow();
    if (cur >= 0 && list[cur].era && list[cur].era !== state.year)   // 다른 시대에서 할 일: 먼저 시간여행하라고 알려 줌(지금 시대 사람에게 엉뚱하게 가지 않게)
      return { goal: `⏳ 지금은 ${state.year}년이에요. 시간여행(T)으로 ${list[cur].era}년에 가서: ${list[cur].text.replace(/^⏳\s*/, '').replace(/^\d{4}년(으로|에)\s*(다시\s*)?(가서|돌아가서|와서)[,:]?\s*/, '')}`, pulse: '#btn-time' };
    if (cur >= 0) { const st = list[cur], ctx = this.rpgCtx();
      // 여러 곳 중 하나씩 하는 단계: 아직 안 한 곳을 차례로 가리킴(한 곳을 마치면 화살표가 다음 곳으로)
      const tgt = st.targets ? (st.targets.find(x => !matches(x.done ?? {}, ctx))?.target ?? st.target) : st.target;
      const loc = guide && tgt ? this.targetOf(tgt) : null;
      return { goal: `▶ ${st.text}`, target: loc?.at ?? null, label: loc?.label ?? '', h: loc?.h ?? 60, pulse: st.pulse ?? null }; }
    const ctx = this.rpgCtx(), g = pick(this.ch.goals, ctx); if (!g) return null;
    const ht = this.hintTarget && performance.now() < this.hintTarget.until ? this.hintTarget.target : null;
    const tgt = ht ?? (g.marker ? g.target : null), loc = tgt ? this.targetOf(tgt) : null;
    return { goal: fill(g.text, ctx), target: loc?.at ?? null, label: loc?.label ?? '', h: loc?.h ?? 60, pulse: g.pulse ?? null };
  },
  targetOf(tgt) {
    // 다른 구역에 있는 대상이면 그쪽으로 가는 표지판을 가리킴
    const want = tgt === 'clock' ? 'A' : tgt.startsWith('npc:') ? (this.ch.npcs[tgt.slice(4)]?.region ?? 'A') : tgt.startsWith('obj:') ? (this.ch.objects[tgt.slice(4)]?.region ?? 'A') : this.region();
    if (want !== this.region()) { const pt = (this.regionsDef.portals[this.region()] ?? []).find(p => p.to === want) ?? (this.regionsDef.portals[this.region()] ?? []).find(p => p.to === 'A');
      return pt ? { at: pt.at, label: pt.label, h: 30 } : null; }
    if (tgt === 'clock') return { at: this.spot('clock'), label: '백년시계', h: 118 };
    if (tgt.startsWith('npc:')) { const v = this.rpgNpcAt?.[tgt.slice(4)]; return v ? { at: [v.x, v.y], label: this.ch.npcs[tgt.slice(4)].name, h: v.height } : null; }
    if (tgt.startsWith('obj:')) { const o = this.ch.objects[tgt.slice(4)]; if (!o) return null;
      const sp = o.slots ? (this.objSpots(o).find(s => !state.rpg.planted.includes(s.slot)) ?? this.objSpots(o)[0]) : { at: o.at };
      return { at: sp.at, label: o.name ?? '', h: o.h ?? 40 }; }
    return null;
  },
  // ---------- 로미: 힌트(단계별) · 측정(모델 값) · 추리 노트 ----------
  romiMenu() {
    const canMeasure = state.year === 2126 && (this.region() === 'A' || this.region() === 'B');
    const opts = [{ label: '💡 힌트 듣기' }, ...(canMeasure ? [{ label: '📡 여기 측정하기' }] : []),
      ...(state.year === 2126 && state.rpg.ch >= 3 ? [{ label: state.rpg.flags.rainView ? '☀ 폭염 때 모습으로 돌아가기' : '⛈ 같은 미래의 집중호우 때 모습 보기' }] : []), { label: '📓 추리 노트 펼치기' }, { label: '그만', bye: true }];
    const { list, cur } = this.stepsNow(), now = cur >= 0 ? list[cur].text.replace(/^[^가-힣]*/, '') : null;   // 첫 인사도 지금 할 일에 맞춰
    this.choose('로미', `${now ? `📋 지금 할 일: ${now} — ` : `${state.year}년이에요. `}무엇을 도와줄까요?`, opts, i => {
      const l = opts[i].label; if (l.startsWith('💡')) this.romiHint(); else if (l.startsWith('📡')) this.romiMeasure(); else if (l.startsWith('📓')) this.openNotebook(); else if (l.startsWith('☀') || l.startsWith('⛈')) this.runGame('rainView');
    });
  },
  // 힌트: ① 지금 할 일(할 일 목록) ② 어디로 가면 되는지(다른 구역이면 그 방향) ③ 장 힌트 한 단계씩(끝까지 들으면 처음부터 다시)
  romiHint() {
    const r = state.rpg, lines = [], { list, cur } = this.stepsNow(), st = cur >= 0 ? list[cur] : null, ctx = this.rpgCtx();
    if (st) {
      lines.push(['로미', `📋 지금 할 일: ${st.text}`]);
      if (st.era && st.era !== state.year) { lines.push(['로미', `이건 ${st.era}년에서 할 일이에요. 오른쪽 아래 ⏳ 시간여행(T)을 눌러 ${st.era}년으로 가요!`]); return this.talk(lines); }
      const tgt = st.targets ? (st.targets.find(x => !matches(x.done ?? {}, ctx))?.target ?? st.target) : st.target, loc = tgt ? this.targetOf(tgt) : null;
      const want = tgt && (tgt.startsWith('npc:') ? this.ch.npcs[tgt.slice(4)]?.region : tgt.startsWith('obj:') ? this.ch.objects[tgt.slice(4)]?.region : 'A');
      if (want && want !== this.region()) lines.push(['로미', `그건 '${this.regionsDef.names[want]}'에 있어요. 화살표가 가리키는 표지판으로 가요. 헷갈리면 🗺️ 지도(M)의 ⭐!`]);
      else if (loc) lines.push(['로미', `${loc.label ? `'${loc.label}' 쪽이에요. ` : ''}화면의 화살표를 따라가서 E를 눌러요.`]);
      else if (st.pulse) lines.push(['로미', '반짝이는 버튼을 눌러 봐요!']);
      if (loc) this.stepHint = { until: performance.now() + 15000 };                  // 길잡이를 꺼 두었어도 15초 동안 화살표를 보여 줌
    }
    const h = pick(this.ch.hints, ctx);
    if (h?.steps?.length) { const lv = r.hints[h.id] ?? 0; lines.push(['로미', h.steps[lv % h.steps.length]]); r.hints[h.id] = lv + 1; saveGame(this);
      if (h.target && lv >= h.steps.length - 1) this.hintTarget = { target: h.target, until: performance.now() + 15000 }; }
    this.talk(lines.length ? lines : [['로미', '지금은 자유롭게 둘러봐요!']]);
  },
  romiMeasure() {
    if (state.weather === 'rain' || this.region() === 'B') return this.romiMeasureRain();
    const d = this.heatData(), s = d.summary, R = this.rules.heat, hm = this.hmAtPx(this.player.x, this.player.y) ?? 0, ctx = this.rpgCtx();
    const base = this.heat.scenarios[this.ch.history.baseKey].summary, dT = s.village_tair_mean - base.village_tair_mean;
    const here = hm >= R.shadeHM ? '🟦 그늘 칸' : hm < R.hotHM ? '🟧 뙤약볕 칸' : '⬜ 보통 칸';
    const lines = [['로미', `여기는 ${here}이에요. (시원함 점수 ${hm.toFixed(2)} · 그늘 칸 기준 ${R.shadeHM})`],
      ['로미', `학교 가는 길 전체에서 그늘 칸은 ${Math.round(s.route_shade_frac * 100)}%예요.`],
      ['로미', Math.abs(dT) < 0.02 ? '마을 평균 기온은 처음 본 2126년과 거의 같아요.' : `마을 평균 기온은 처음 본 2126년보다 ${Math.abs(dT).toFixed(2)} ℃ ${dT < 0 ? '낮아요' : '높아요'}. (컴퓨터로 계산해 비교한 값)`]];
    // 같은 선택에서 한 가지만 바꾼 모델 결과와 비교(밝은 포장 없음 / 뒷산 숲 지킴) — 효과를 '얼마나'로 확인
    const alt = sub => this.heat.scenarios[this.heatKeyNow().replace(...sub)]?.summary;
    const offC = alt(['C1', 'C0']), keepF = alt(['FP', 'FK']);
    Object.assign(ctx, { paveOn: s.route_hm_mean.toFixed(2), paveOff: offC?.route_hm_mean.toFixed(2) ?? '-', forestDT: keepF ? (s.village_tair_mean - keepF.village_tair_mean).toFixed(2) : '-' });
    const extra = pick(this.ch.measure, ctx);
    if (extra) lines.push(...extra.lines.map(([w, x]) => [SPEAKER[w] ?? w, fill(x, ctx)]));
    this.talk(lines, () => { if (extra?.do) this.applyDo(extra.do, null); });
  },
  // 추리 노트: 질문 · 알아낸 것(카드) · 가설 고르기(로미가 찾은 단서로 맞는지/어긋나는지 알려 줌) · 다녀온 미래
  openNotebook() {
    const r = state.rpg, dlg = $('#notebook'), C = this.ch, n = Math.min(r.ch, 3);
    const getC = () => n === 1 ? r.conclusion : r.conclusions?.[n], setC = v => { if (n === 1) r.conclusion = v; else (r.conclusions ??= {})[n] = v; };
    const card = id => { const f = C.facts[id]; return `<div class="fact">${f.img ? `<img class="clue" alt="" src="${PC_ART}${f.img}.png">` : ''}<b>${f.icon} ${f.title}</b><p>${f.text}</p><small>${f.src}</small></div>`; };
    const render = (msg = '') => {
      const mine = r.facts.filter(id => (C.facts[id]?.ch ?? 1) === n), old = r.facts.filter(id => (C.facts[id]?.ch ?? 1) !== n);
      const facts = mine.map(card).join('') || '<p class="empty">아직 알아낸 것이 없어요. 사람들과 이야기하고, 이상한 곳을 살펴봐요.</p>';
      const hyps = C.hypotheses.filter(h => h.ch === n);
      const hyp = hyps.map(h => { const j = judge(h, r.facts), cls = getC() === h.id ? 'mine' : j.verdict === 'refuted' && r.flags[`tried_${h.id}`] ? 'out' : '';
        return `<button type="button" class="hyp ${cls}" data-h="${h.id}">${getC() === h.id ? '✔ ' : ''}${h.text}</button>`; }).join('');
      const recs = Object.keys(r.records ?? {}).map(id => `<li>${C.records[id]?.icon ?? '📒'} ${C.records[id]?.title ?? id}</li>`).join('');
      const fut = (r.futures ?? []).map(k => `<li>${this.futureLine(k)}</li>`).join('');
      dlg.querySelector('.body').innerHTML = `<p class="q">❓ ${C.questions[n] ?? ''}</p><h3>알아낸 것 <small>${mine.length}개</small></h3><div class="facts">${facts}</div>
        ${hyps.length ? `<h3>내 추리 <small>하나를 골라 단서와 맞춰 봐요</small></h3><div class="hyps">${hyp}</div><div class="verdict">${msg}</div>` : ''}
        ${recs ? `<h3>찾은 관리 기록</h3><ul class="fut">${recs}</ul>` : ''}
        ${fut ? `<h3>내가 다녀온 2126년</h3><ul class="fut">${fut}</ul>` : ''}
        ${old.length ? `<details><summary>앞 장에서 알아낸 것 ${old.length}개</summary><div class="facts">${old.map(card).join('')}</div></details>` : ''}`;
      dlg.querySelectorAll('.hyp').forEach(b => b.onclick = () => {
        const h = C.hypotheses.find(x => x.id === b.dataset.h), j = judge(h, r.facts), nm = id => `${C.facts[id].icon} ${C.facts[id].title}`;
        r.flags[`tried_${h.id}`] = true; let m;
        if (j.verdict === 'refuted') { m = `🤖 로미: 이 추리는 ${josa(j.ref.map(nm).join(', '), '와/과')} 맞지 않아요. ${h.no}`; if (getC() === h.id) setC(null); }
        else if (j.verdict === 'supported') { setC(h.id); m = `🤖 로미: 근거가 있어요 — ${j.sup.map(nm).join(', ')}. ${h.ok}`; audio.sfx('record'); }
        else m = `🤖 로미: 아직 이 추리를 확인할 단서가 없어요. ${h.need}`;
        saveGame(this); render(m);
      });
    };
    render(); dlg.showModal();
  },
  futureLine(key) {
    const s = this.heat.scenarios[key]?.summary, [c, tcx] = key.split('|'), T = c.includes('T1'), Y = c.includes('Y1'), C = c.includes('C1'), P = c.startsWith('FP'), tc = tcx.includes('TC1');
    const what = [P && '뒷산 주차장', T ? '가로수' : '가로수 없음', Y && '운동장 숲', C && '밝은 포장', T && (tc ? '돌봄 이어짐' : '돌봄 없음')].filter(Boolean).join(' · ');
    return `${what} → 등굣길 그늘 칸 ${Math.round((s?.route_shade_frac ?? 0) * 100)}%${Y ? ', 운동장 그늘' : ''}`;
  },
  noteFlash() { const b = $('#btn-notebook'); if (!b) return; b.classList.remove('new'); void b.offsetWidth; b.classList.add('new'); },
  // ---------- 동행: 하늘이를 집까지(1장). 판정은 기존 더위 게이지 규칙(rules.heat) + InVEST HM ----------
  startEscort(id) {
    // 그늘 길이 없는 미래(가로수 + 돌봄이 아직 없음)는 처음부터 끝까지 가기 어렵다 — 실패가 단서라는 걸 미리 알려 줌
    toast(this.rpgCtx().shade ? '🏠 빨간 지붕 집까지 앞장서 걸어요! 나무 그늘(파란 칸)을 따라가면 하늘이가 덜 지쳐요. 길을 모르면 🗺️ 지도(M)!'
      : '🏠 빨간 지붕 집까지 앞장서 걸어요! 지금 길엔 그늘이 거의 없어서 끝까지 못 갈 수도 있어요 — 왜 힘든지 알아내는 것도 단서예요. 길은 🗺️ 지도(M)!', 6500);
    const vis = this.vis[this.ch.npcs[id].sprite]; state.rpg.escort = id; this.escortNpc = vis; this.escortGoal = this.ch.escortGoal;
    const m = state.mission; m.active = true; m.gauge = 0; m.lastShade = null; m.fails = 0; m.t0 = this.time.now;
    this.trail = [[vis.x, vis.y], [this.player.x, this.player.y]]; this.pathFor = null; $('#gauge').hidden = false; this.updateHud();
  },
  endEscort(success) {
    const m = state.mission; m.active = false; $('#gauge').hidden = true; state.rpg.escort = null;
    m.done.push({ key: this.heatKeyNow(), success, gauge: Math.round(m.gauge) });
    if (success) { state.rpg.flags.escorted = true; audio.sfx('jingle_win'); toast('하늘이가 무사히 집에 도착했어요!', 3000); }
    else { audio.sfx('jingle_hmm'); toast('너무 더워요! 하늘이와 학교 쉼터로 돌아왔어요.', 3200); state.rpg.flags.escort_failed = true; }
    this.build(); if (!success) this.player.setPosition(560, 700); this.ensureFree(); saveGame(this); this.updateHud();
    if (!success) { const k = state.rpg.facts.includes('f_heat') ? 'escortFailAgain' : 'escortFail'; this.time.delayedCall(500, () => this.runEntry(this.ch.scenes[k], '', null)); }
  },
  // ---------- 인벤토리·노트·엽서 UI ----------
  renderInv() {
    const el = $('#inv'); if (!el) return; const r = state.rpg; const on = this.rpgOn();
    el.hidden = !on; $('#btn-album').hidden = !on; if ($('#btn-notebook')) $('#btn-notebook').hidden = !on; if ($('#btn-romi')) $('#btn-romi').hidden = !on; if ($('#btn-map')) $('#btn-map').hidden = !on;
    if (!on) return;
    const ids = Object.keys(r.items).filter(i => r.items[i] > 0);
    el.innerHTML = ids.map(i => { const it = this.ch.items[i]; return `<button type="button" class="slot" data-i="${i}" title="${it.name}">${it.icon}${r.items[i] > 1 ? `<small>${r.items[i]}</small>` : ''}</button>`; }).join('') || '<span class="empty">가방이 비었어요</span>';
    el.querySelectorAll('.slot').forEach(b => b.onclick = () => { const it = this.ch.items[b.dataset.i];
      if (it.pic) { const d = $('#itempic'); d.querySelector('h2').textContent = `${it.icon} ${it.name}`; d.querySelector('img').src = it.pic; d.querySelector('p').textContent = it.desc; d.showModal(); return; }   // 그림이 있는 물건은 그림으로
      this.talk([[`${it.icon} ${it.name}`, it.desc]]); });
    $('#btn-album').textContent = `🖼 엽서 ${this.albumIds().length}/${Object.keys(this.ch.postcards).length}`;
    if ($('#btn-romi')) $('#btn-romi').textContent = '💡 힌트 (로미)';
    if ($('#btn-notebook')) $('#btn-notebook').textContent = `📓 추리 노트 ${r.facts.length}`;
  },
  invFlash(id) { this.time.delayedCall(50, () => { const b = document.querySelector(`#inv .slot[data-i="${id}"]`); if (b) { b.classList.remove('new'); void b.offsetWidth; b.classList.add('new'); } }); },
  // 엽서: 얻는 순간의 실제 게임 화면을 작은 사진으로 저장(진행 저장과 별도 키, 작게)
  awardPostcard(id) {
    const pc = this.ch.postcards[id]; audio.sfx('jingle_win');
    this.game.renderer.snapshot(img => {
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; cv.getContext('2d').drawImage(img, 0, 0, 320, 180);
      const url = cv.toDataURL('image/jpeg', 0.72); try { const all = JSON.parse(localStorage.getItem('ttf.postcards.v1') || '{}'); all[id] = url; localStorage.setItem('ttf.postcards.v1', JSON.stringify(all)); } catch { }
      $('#pc-new .pic').style.backgroundImage = `url(${pc.art ? PC_ART + pc.art + '.png' : url})`; $('#pc-new b').textContent = `${pc.icon} ${pc.title}`; $('#pc-new p').textContent = pc.desc;
      $('#pc-new').hidden = false; clearTimeout(this._pcT); this._pcT = setTimeout(() => { $('#pc-new').hidden = true; }, 4200);
      this.renderInv();
    });
  },
  // 앨범 = 이번 판 엽서 + 이전 판에서 모은 엽서(ttf.postcards.v1, '처음부터 다시' 해도 남음 — 교사용 '진행 초기화'만 지움)
  albumIds() { let pics = {}; try { pics = JSON.parse(localStorage.getItem('ttf.postcards.v1') || '{}'); } catch { }
    return [...new Set([...state.rpg.postcards, ...Object.keys(pics)])].filter(id => this.ch.postcards[id]); },
  openAlbum() {
    let pics = {}; try { pics = JSON.parse(localStorage.getItem('ttf.postcards.v1') || '{}'); } catch { }
    const have = this.albumIds();
    $('#album .body').innerHTML = `<p class="how">🖼 모은 엽서 ${have.length}/${Object.keys(this.ch.postcards).length}장 · 못 본 엽서는 <b>힌트</b>대로 해 보면 얻어요. 빗물 시설·약속은 2026년에서 바꿀 수 있고, 나무 심기·운동장·포장·뒷산은 '처음부터 다시'에서 골라요. 모은 엽서는 남아요.</p>` + Object.entries(this.ch.postcards).map(([id, pc]) => {
      const got = have.includes(id);
      return `<div class="card${got ? '' : ' locked'}"><div class="pic" style="${got && (pc.art || pics[id]) ? `background-image:url(${pc.art ? PC_ART + pc.art + '.png' : pics[id]})` : ''}">${got ? (pc.art && pics[id] ? `<img class="snap" alt="" src="${pics[id]}">` : '') : '?'}</div>
        <b>${got ? pc.icon + ' ' + pc.title : '아직 못 본 미래'}</b><p>${got ? pc.desc : '힌트: ' + pc.hint}</p></div>`;
    }).join('') + `<p class="note">엽서마다 서로 다른 선택이 만든 2126년이에요. 정해진 조건으로 상상해 본 미래이고, 다른 행동을 하면 다른 2126년을 볼 수 있어요.</p>`;
    $('#album').showModal();
  },
};
