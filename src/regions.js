// 구역 A~D: A(학교 앞)는 기존 장면 코드 그대로, B(시장길)·C(뒷산 숲길)·D(마을정원)는 Codex fullgame-art-v1 매니페스트의 배치를 읽어 그린다.
// 그림 조건(시대 공통 / 선택 결과)은 기존 c1·c2·c3 상태에서만 정한다 — 새 과학 계산 없음(layout_contract.json, ASSET_INTEGRATION_GUIDE.md).
import { state, $, saveGame } from './core.js';
import { audio } from './audio.js';

export const FG_MANIFEST = 'assets/codex/fullgame-art-v1/fullgame_art_manifest_v1.json';
// 불투명 구역 바닥은 JPG 런타임 사본(tools/make_runtime_fullgame.py)
const RUNTIME = { market_ground_v1: 'assets/runtime/fg_market_ground_v1.jpg', forest_ground_v1: 'assets/runtime/fg_forest_ground_v1.jpg', garden_ground_v1: 'assets/runtime/fg_garden_ground_v1.jpg' };
export const assetUrl = a => RUNTIME[a.id] ?? a.file.replace(/^game\//, '');

// 그림 조건(Codex candidate_adapter.matchesCondition과 같은 뜻). s = { era, c1, c2, tree, facility, law, rain, replant }
//  tree/facility: 지금 미래의 관리 상태(c3 없으면 나무 = 1장 돌봄 결과, 시설 = 관리 지속 가정), law: c3 없으면 null(숲 조례 '정하지 않음')
export function artCond(name, s) {
  const fut = s.era === 2126, c1 = s.c1, c2 = s.c2, keep = c1.forest === 'keep';
  switch (name) {
    case 'always': return true;
    case 'era2026': return !fut; case 'era2126': return fut;
    case 'noTrees': return !c1.streetTrees;
    case 'cool2026': return !fut && !!c1.coolPave; case 'cool2126': return fut && !!c1.coolPave;
    case 'yard2026': return !fut && !!c1.schoolyard; case 'yard2126': return fut && !!c1.schoolyard;
    case 'planted2026': return !fut && !!c1.streetTrees;
    case 'managed2126': return fut && !!c1.streetTrees && !!s.tree; case 'unmanaged2126': return fut && !!c1.streetTrees && !s.tree;
    case 'facilityGood': return !fut || !!s.facility; case 'facilityBad': return fut && !s.facility;
    case 'permeableGood': return !!c2.permeable && (!fut || !!s.facility); case 'permeableBad': return !!c2.permeable && fut && !s.facility;
    case 'gardenGood': return !!c2.rainGarden && (!fut || !!s.facility); case 'gardenBad': return !!c2.rainGarden && fut && !s.facility;
    case 'basinGood': return !!c2.basin && (!fut || !!s.facility); case 'basinBad': return !!c2.basin && fut && !s.facility;
    case 'noBasinFuture': return fut && !c2.basin;
    case 'forestLeftKept': return !fut || keep;
    case 'forestRightKept': return !fut || (keep && (s.law === null || s.law === 1));
    case 'forestLeftDeveloped': return fut && !keep;
    case 'forestRightDeveloped': return fut && (!keep || s.law === 0);      // 조례를 정하지 않음(null)은 '관리 지속' 가정 → 개발 없음
    case 'nurseryActive': return !fut || !!s.tree; case 'nurseryNeglect': return fut && !s.tree;
    case 'nursery2126': return fut && !!s.tree;
    case 'rainOnly': return !!s.rain; case 'replantEvent': return !!s.replant;
  }
  throw new Error(`Unknown art condition ${name}`);
}

export const RegionMethods = {
  region() { return state.region ?? 'A'; },
  artState(year = state.year) {
    const care = this.care();
    return { era: year >= 2126 ? 2126 : 2026, c1: state.c1, c2: state.c2, tree: care.tree, facility: care.facility, law: state.c3 ? state.c3.forestLaw : null,
      rain: year >= 2126 && state.weather === 'rain', replant: false };
  },
  // 이 구역에 필요한 그림만(구역별 지연 로딩, QA_REPORT 권장)
  regionAssetIds(r) { return [...new Set(this.fg.regions[r].placements.map(p => p.asset))]; },
  ensureRegionAssets(r) {
    if (r === 'A') return Promise.resolve();
    const byId = Object.fromEntries(this.fg.assets.map(a => [a.id, a]));
    const need = this.regionAssetIds(r).filter(id => !this.textures.exists(id));
    if (!need.length) return Promise.resolve();
    return new Promise(res => { for (const id of need) this.load.image(id, assetUrl(byId[id])); this.load.once('complete', res); this.load.start(); });
  },
  // 학교 PC·태블릿 그래픽 메모리 보호: 지금 구역(과 A)에 쓰지 않는 다른 구역 그림은 내려놓음(다시 오면 브라우저 캐시에서 금방 다시 불러옴)
  unloadOtherRegions(r) {
    const keep = new Set(r === 'A' ? [] : this.regionAssetIds(r));
    for (const R of ['B', 'C', 'D']) if (R !== r) for (const id of this.regionAssetIds(R)) if (!keep.has(id) && this.textures.exists(id)) this.textures.remove(id);
  },
  // B·C·D 그리기: 배경 → 지면 → 그림자 → 발 기준 물체(footY×10) → 캐릭터(+1) → 지붕·수관(+2). 매니페스트 원점·크기·깊이 그대로
  buildRegion(year, add) {
    const r = this.region(), R = this.fg.regions[r], s = this.artState(year);
    const hide = new Set(s.era === 2126 ? (this.regionsDef.future?.[r] ?? []).filter(f => !f.when || artCond(f.when, s)).flatMap(f => f.hides ?? []) : []);   // 2126 새 소품이 대신하는 옛 그림
    for (const p of R.placements) {
      if (!artCond(p.when, s) || hide.has(p.asset)) continue;
      const im = add(p.asset, p.x, p.y, { origin: p.origin, w: p.width, h: p.height, depth: p.depth });
      if (p.layer === 'fg') { const b = im.getBounds(); this.occluders.push({ im, box: [b.x + b.width * 0.08, b.y, b.right - b.width * 0.08, (p.footY ?? p.y) - 4], foot: p.footY ?? p.y }); }
    }
    for (const c of R.collisions) if (artCond(c.when, s)) { const [x, y, w, h] = c.rect; this.extraBlocked.push([x, y, x + w, y + h]); }
    for (const b of this.regionsDef.extraBlocked[r] ?? []) this.extraBlocked.push(b);
    // 시장길 가게 사이 담: 막혀 있는 곳이 눈에 보이도록 낮은 돌담을 그림(위 가장자리 담은 화면 밖이라 생략). 24px 조각마다 발 기준 깊이
    if (r === 'B') for (const [x0, y0, x1, y1] of this.regionsDef.extraBlocked.B) { if (x1 - x0 > 40) continue;
      for (let y = y0; y < y1; y += 24) { const h = Math.min(24, y1 - y), g = this.add.graphics().setDepth((y + h) * 10);
        g.fillStyle(0x000000, 0.16).fillRect(x1, y + 4, 7, h);                                   // 오른쪽 아래 그림자(광원 왼쪽 위)
        g.fillStyle(0xb9ad97, 1).fillRect(x0 - 2, y, x1 - x0 + 4, h).fillStyle(0xd8cfbc, 1).fillRect(x0 - 2, y, x1 - x0 + 4, 4);
        g.lineStyle(1, 0x7c705c, 0.9).strokeRect(x0 - 2, y, x1 - x0 + 4, h); this.dyn.add(g); } }
    // 이야기 소품(이미 승인된 원화 재사용: 계획 게시판 등) — regions.json props
    for (const p of this.regionsDef.props?.[r] ?? []) if (artCond(p.when ?? 'always', s)) add(p.key, p.at[0], p.at[1], { origin: p.origin, w: p.w, h: p.h, depth: p.at[1] * 10 });
    this.buildFuture(r, add, s);
    if (r === 'B' && state.c2.basin) this.extraBlocked.push(this.regionsDef.B.basinBlock);   // 저류지 안으로는 못 들어감
    this.regionSize = R.size;
  },
  // 2126년 공통 세월 변화 소품(태양광 가판대·가로등·셔틀 정류장 등, Topview GPT Image 2 원화): 선택과 무관, 2126년에만. regions.json future
  buildFuture(r, add, s) {
    if (s.era !== 2126) return;
    for (const f of this.regionsDef.future?.[r] ?? []) {
      if (!this.textures.exists(f.key) || (f.when && !artCond(f.when, s))) continue;   // when: 기존 그림 조건(숲 보존·개발, 나무 돌봄 등)과 같은 규칙
      const [x, y] = f.at, src = this.textures.get(f.key).getSourceImage(), h = f.h, w = f.w ?? h * src.width / src.height;
      if (f.ground) { add(f.key, x, y, { origin: [0.5, 0.5], w, h, depth: 3 }); continue; }   // 바닥에 깔리는 그림(잡초 덮인 빈 화단 등): 그림자·충돌 없음
      const g = this.add.graphics().setDepth(y * 10 - 1); g.fillStyle(0x2a2418, 0.2).fillEllipse(x + w * 0.04, y - 2, w * (f.shadowW ?? 0.9), Math.max(8, w * 0.16)); this.dyn.add(g);   // 발밑 그림자
      const im = add(f.key, x, y, { origin: [0.5, f.foot ?? 0.98], w, h, depth: y * 10 });
      if (f.block) { const [bw, bh] = f.block; this.extraBlocked.push([x - bw / 2, y - bh, x + bw / 2, y]); }
      if (h > 90) this.occluders.push({ im, box: [x - w * 0.42, y - h, x + w * 0.42, y - 4], foot: y });   // 큰 소품 뒤로 가면 반투명
    }
  },
  regionFree(x, y, extra) {
    const [W, H] = this.regionSize ?? [1536, 1024];
    if (x < 8 || y < 8 || x > W - 8 || y > H - 4) return false;
    for (const [x0, y0, x1, y1] of extra) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return false;
    return true;
  },
  // 구역 사이 이동: 연결 지점(표지판)에 닿으면 짧게 어두워졌다가 다음 구역(같은 시대)으로
  drawPortals(add) {
    for (const pt of this.regionsDef.portals[this.region()] ?? []) {
      const t = this.add.text(pt.at[0], pt.at[1] - 34, pt.label, { fontFamily: 'Malgun Gothic', fontSize: '15px', fontStyle: 'bold', color: '#fffdf5', backgroundColor: '#1d2b2acc', padding: { x: 8, y: 4 } })
        .setOrigin(0.5, 1).setDepth(59000); this.dyn.add(t);
    }
  },
  checkPortals() {
    if (this.switching || state.mission.active || state.delivery.active || this.rpgDelivery) return;
    const P = this.player;
    for (const pt of this.regionsDef.portals[this.region()] ?? []) if (Math.hypot(P.x - pt.at[0], P.y - pt.at[1]) < pt.r) return this.enterRegion(pt.to, pt.arrive);
  },
  async enterRegion(r, at) {
    if (this.switching) return; this.switching = true; this.touchTarget = null; this.cinematic = true;
    const cam = this.cameras.main; cam.fadeOut(220, 20, 30, 32); audio.sfx('talk', 0.4);
    await new Promise(res => this.time.delayedCall(230, res));
    await this.ensureRegionAssets(r);
    state.region = r; this.player.setPosition(...at); this.romi.setPosition(at[0] - 40, at[1] + 14); this.trail = [];
    this.rpgSync?.(); this.build(); this.ensureFree();
    this.unloadOtherRegions(r);
    const [W, H] = r === 'A' ? this.zone.canvas : this.fg.regions[r].size; cam.setBounds(0, 0, W, H); cam.centerOn(this.player.x, this.player.y);
    cam.fadeIn(260, 20, 30, 32); this.cinematic = false; this.switching = false;
    saveGame(this); this.updateHud(); this.onRegionEnter?.(r);
  },
};
