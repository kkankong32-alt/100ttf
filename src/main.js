// 《100 투 더 퓨처》 — 학교 앞 구역(Codex 2.5D 아트) 장면. 게임 논리는 core.js, 과학 값은 논리 격자(heat.json·scenario-results.json)에서 읽기만 한다.
// 레이어: BG(0) · 도로 갱신(1) · 지면 변화(2) · 식재 자리(3) · 물고임(4) · 그림자(10) · 그늘 지도(11) · 물체 발밑y×10 · 수관/지붕 +2 · 인물 +1 · 화면 효과(59999+)
import { state, $, heatKey, swmmKey, saveGame, loadGame, toast, setScene, SCENE, openPlanner, showResult, showRainResult, showInfo, sfxWarp, SAVE_KEY } from './core.js';
import { FIRST, futureFacts, sentences, renderFinal, saveCard } from './final.js';
import { IMAGES, SHEETS, TREE_STAGES, DIRS, ORIGIN, BUILDINGS, GATE, PERGOLA, CC_MANIFEST, UI_IMG, NEW_NPCS } from './sf_assets.js';
import { RegionMethods, FG_MANIFEST, artCond, assetUrl } from './regions.js';
import { ChapterMethods } from './chapters.js';
import { MapMethods } from './map.js';
import { TextbookMethods } from './textbook.js';
import { EpilogueMethods } from './epilogue.js';
import { makeZone } from './zone_map.js';
import { eraOf, ERA_CAPTION, buildingKeys, treePlan, crownPx, schoolyardPlan, futureSummary } from './century.js';
import { findPath, lineFree } from './pathfind.js';
import { NPCVisual, registerNPCAnims } from './npc.js';
import { audio, wireAudio } from './audio.js';
import { FlowMethods } from './flow.js';
import { NO_PROMISE } from './story.js';
import { RpgMethods, newRpgState, mergeContent } from './rpg.js';

const PLAYER_H = 66, ROMI_H = 40, NPC_H = 60;
// 동행 걸음 배속(하늘이와 걸을 때만): 걷는 속도와 더위 게이지 변화(초당)를 같은 배수로 → 같은 거리를 걸을 때 쌓이는 더위는 rules.heat 그대로(성공·실패 판정 불변), 걸리는 시간만 절반.
// 할머니 동행(이전 방식)은 1배 그대로 — 2배면 할머니 발걸음(최대 1.8배 재생)이 몸 이동을 못 따라가 미끄러짐
const ESCORT_PACE = 2, escortPace = () => (state.rpg?.escort ? ESCORT_PACE : 1);
const FACILITY_DECLINE_YEAR = 2066;   // 시설 청소 약속이 없을 때 막힘·퇴적 모습이 나타나는 연출 시점(예측 아님)
const T0 = performance.now();
const clone = o => JSON.parse(JSON.stringify(o));
const patrolledG = sc => Object.values(sc.patrols ?? {}).some(p => p.vis === sc.granny);
const patrolled0 = (sc, v) => Object.values(sc.patrols ?? {}).some(p => p.vis === v);

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    const bar = $('#loadbar i'), box = $('#loading');
    this.load.on('progress', v => { if (bar) bar.style.width = Math.round(v * 100) + '%'; });
    this.load.json('world', 'data/world.json');
    this.load.json('heat', 'data/heat.json');
    this.load.json('rules', 'data/rules.json');
    this.load.json('zone', 'data/zone_schoolfront.json');
    this.load.json('results', 'data/scenario-results.json');   // 배포본: 빌드가 data/ 안으로 복사(게임 폴더 밖 경로 없음)
    this.load.json('cc', CC_MANIFEST);
    this.load.json('ch1', 'data/ch1.json'); this.load.json('ch2', 'data/ch2.json'); this.load.json('ch3', 'data/ch3.json');
    this.load.json('fg', FG_MANIFEST); this.load.json('regions', 'data/regions.json');
    this.load.spritesheet('fg_water_flow', 'assets/codex/fullgame-art-v1/water_observation_flow_sheet_v1.png', { frameWidth: 128, frameHeight: 64 });
    for (const [k, p] of Object.entries(IMAGES)) this.load.image(k, p);
    for (const [k, s] of Object.entries(SHEETS)) this.load.spritesheet(k, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    this.load.once('complete', () => { if (box) box.hidden = true; });
  }
  create() {
    for (const who of ['player', 'romi']) for (const [sheet, rate] of who === 'player' ? [['walk', 15], ['idle', 8]] : [['move', 15], ['idle', 8]]) DIRS.forEach((d, r) =>
      this.anims.create({ key: `${who}_${sheet}_${d}`, frames: this.anims.generateFrameNumbers(`${who}_${sheet}`, { start: r * 12, end: r * 12 + 11 }), frameRate: rate, repeat: -1 }));
    registerNPCAnims(this);
    this.anims.create({ key: 'ripple', frames: this.anims.generateFrameNumbers('nv3_ripple', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'century_ring', frames: this.anims.generateFrameNumbers('nv3_ring', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
    this.anims.create({ key: 'water_flow', frames: this.anims.generateFrameNumbers('fg_water_flow', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    // 나무 줄기를 새 식재면에 잇는 '지면 접합' 프레임(원본 파일은 그대로, 뿌리 끝을 잘라 쓰는 프레임만 추가)
    for (const [stage, t] of Object.entries(this.cache.json.get('cc').trees)) { const tex = this.textures.get(`tree_${stage}_mg`); if (!tex.has('grounded')) tex.add('grounded', 0, ...t.mgFrame); }
    this.makeBuildingShadows();
    window.__perf = { loadMs: Math.round(performance.now() - T0) };
    this.scene.start('schoolfront');
  }
}

// 광원: 왼쪽 위(나무 등록 그림자와 같은 방향). 높이 h인 점의 그림자 = 발밑에서 (KX·h, KY·h)만큼 오른쪽 아래.
const SHADOW_KX = 0.5, SHADOW_KY = 0.21, SHADOW_PAD = 12;
Boot.prototype.makeBuildingShadows = function () {
  const keys = new Set();
  for (const b of BUILDINGS) for (const era of [2026, 2046, 2086, 2126]) keys.add(JSON.stringify([b.key, buildingKeys(b.key, era).mg]));
  for (const j of keys) {
    const [bk, mg] = JSON.parse(j), b = BUILDINGS.find(x => x.key === bk), src = this.textures.get(mg).getSourceImage();
    const H0 = b.anchor - b.y, W = Math.ceil(b.w + SHADOW_KX * H0 + SHADOW_PAD * 2), H = Math.ceil(SHADOW_KY * H0 + SHADOW_PAD * 2);
    const sil = document.createElement('canvas'); sil.width = b.w; sil.height = b.h; const sc = sil.getContext('2d');
    sc.drawImage(src, 0, 0, b.w, b.h); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = '#000'; sc.fillRect(0, 0, b.w, b.h);
    const t = this.textures.createCanvas(`bshadow_${mg}`, W, H), ctx = t.getContext();
    ctx.filter = 'blur(3px)'; ctx.globalAlpha = 0.34;
    ctx.setTransform(1, 0, -SHADOW_KX, -SHADOW_KY, SHADOW_KX * H0 + SHADOW_PAD, SHADOW_KY * H0 + SHADOW_PAD);   // 지붕일수록 멀리
    ctx.drawImage(sil, 0, 0); t.refresh();
  }
  // 벽 밑 접지(AO) 띠: 위는 투명 → 바닥선에서 가장 진함
  const ao = this.textures.createCanvas('ao_band', 4, 32), a = ao.getContext(), g = a.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(20,16,12,0)'); g.addColorStop(1, 'rgba(20,16,12,0.42)'); a.fillStyle = g; a.fillRect(0, 0, 4, 32); ao.refresh();
};

class SchoolFront extends Phaser.Scene {
  constructor() { super('schoolfront'); this.zoneId = 'schoolfront'; }
  create() {
    this.world = this.cache.json.get('world'); this.heat = this.cache.json.get('heat'); this.rules = this.cache.json.get('rules');
    this.zone = this.cache.json.get('zone'); this.swmm = this.cache.json.get('results').stormwater.results; this.cc = this.cache.json.get('cc');
    this.ccShadow = Object.fromEntries(this.cc.assets.filter(a => a.id.endsWith('_registered_shadow_v1')).map(a => [a.id.split('_')[1], a.size]));
    this.zm = makeZone(this.zone, this.world);
    const [CW, CH] = this.zone.canvas, [, AH] = this.zone.artCanvas;
    this.bgA = this.add.image(0, 0, 'bg').setOrigin(0).setDepth(0);
    this.lowA = this.add.image(0, AH, 'nv3_lowland').setOrigin(0).setDisplaySize(CW, CH - AH).setDepth(0.5);   // 남쪽 저지대 원화(반복 잔디·경계 띠 대체)
    this.dyn = this.add.group();
    // 그늘 지도: 32px 칸마다 1픽셀 캔버스를 선형 확대(칸 경계가 부드럽게). 기본은 숨김, 학생이 켤 때만 범례와 함께.
    this.lensC = 32; this.lensTex = this.textures.createCanvas('heatlens', Math.ceil(CW / this.lensC), Math.ceil(CH / this.lensC));
    this.lensImg = this.add.image(0, 0, 'heatlens').setOrigin(0).setScale(this.lensC).setDepth(11).setAlpha(0.45);
    this.lens = false;
    this.rainTint = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x4f6478, 0.2).setOrigin(0).setScrollFactor(0).setDepth(60000).setVisible(false);
    this.rainGfx = this.add.graphics().setScrollFactor(0).setDepth(60001);
    this.drops = Array.from({ length: 260 }, () => ({ x: Math.random() * this.scale.width, y: Math.random() * this.scale.height, v: 520 + Math.random() * 260 }));
    this.heatTint = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffb070, 0.07).setOrigin(0).setScrollFactor(0).setDepth(59999).setVisible(false);
    this.player = this.add.sprite(0, 0, 'player_idle', 0).setOrigin(...ORIGIN.player).setScale(PLAYER_H / SHEETS.player_idle.frameHeight);
    this.playerShadow = this.add.image(0, 0, 'shadow_player').setDisplaySize(44, 11).setDepth(10);
    this.romi = this.add.sprite(0, 0, 'romi_idle', 0).setOrigin(...ORIGIN.romi).setScale(ROMI_H / SHEETS.romi_idle.frameHeight).setVisible(false);
    this.romiShadow = this.add.image(0, 0, 'shadow_romi').setDisplaySize(34, 9).setDepth(10).setVisible(false);
    this.facing = 'down'; this.romiFacing = 'down'; this.trail = [];
    // NPC: 장면 재조립과 무관하게 한 번만 만든다(중복 생성 방지). 위치·충돌 규칙은 이전과 같음.
    this.granny = new NPCVisual(this, 'granny', ...this.zone.spots.granny, 'left');
    this.pharm = new NPCVisual(this, 'pharm', ...this.zone.spots.pharm, 'down');
    this.ch = mergeContent(['ch1', 'ch2', 'ch3'].map(k => this.cache.json.get(k)));      // 세 장의 콘텐츠를 하나로(장 조건은 각 항목에)
    this.fg = this.cache.json.get('fg'); this.regionsDef = this.cache.json.get('regions');   // Codex 전체 구역 매니페스트 + 구역 게임 규칙
    this.vis = { granny: this.granny, pharm: this.pharm };
    for (const k of NEW_NPCS) this.vis[k] = new NPCVisual(this, k, 0, 0, 'down').setVisible(false);
    // 시간여행 효과: 백년시계 빛 고리 + 화면 테두리(시간여행 동안만)
    this.ring = this.add.sprite(this.scale.width / 2, this.scale.height / 2, 'nv3_ring', 7).setScrollFactor(0).setDepth(60002).setVisible(false);
    this.ring.on('animationcomplete', () => this.ring.setVisible(false));
    // 화면 고정 효과는 카메라 확대를 되돌려 화면에 꼭 맞게
    this.border = this.add.image(this.scale.width / 2, this.scale.height / 2, 'nv3_century_screen_border').setDisplaySize(this.scale.width / 1.2, this.scale.height / 1.2).setScrollFactor(0).setDepth(60003).setAlpha(0);
    // 화면 비율이 바뀌면(태블릿 돌리기·창 크기) 화면 고정 효과도 새 크기에 맞춤
    const fitFx = () => { const W = this.scale.width, H = this.scale.height; this.rainTint.setSize(W, H); this.heatTint.setSize(W, H); this.ring.setPosition(W / 2, H / 2);
      this.border.setPosition(W / 2, H / 2).setDisplaySize(W / 1.2, H / 1.2); };
    this.scale.on('resize', fitFx); this.events.once('shutdown', () => this.scale.off('resize', fitFx));
    const saved = loadGame();
    if (state.rpg?.escort && !state.mission.active) state.rpg.escort = null;   // 동행 중에 새로고침·종료하면 저장엔 "동행 중"만 남아 하늘이가 사라지던 문제: 동행은 저장하지 않으므로 풀어 줌
    this.player.setPosition(...((saved?.zone === this.zoneId && saved.player) ? saved.player : this.zone.spots.start));
    const savedRegion = state.region ?? 'A', savedPos = [this.player.x, this.player.y]; state.region = 'A';   // 다른 구역 저장은 A를 조립한 뒤 그 구역으로 이동
    setScene(this);
    if (!saved) state.rpg = newRpgState();
    this.rpgSync();
    wireAudio(); const jump = null;
    this.talkQ = [];
    $('#talk').onclick = () => this.nextTalk();
    // 떨림 원인: 카메라 스크롤과 각 물체를 따로 정수 반올림(roundPixels) → 화면상 ±1px 흔들림. 서브픽셀로 그리면 사라짐.
    this.baseZoom = 1.2;                                        // 캐릭터를 조금 더 크게, 빈 공간을 덜 보이게(원본 해상도 안)
    const cam = this.cameras.main; cam.setBounds(0, 0, CW, CH).setZoom(this.baseZoom).startFollow(this.player, false, 0.1, 0.1).setRoundPixels(false);
    this.look = { x: 0, y: 80 };                                // 처음엔 화면을 위로 조금 올려 게시판·모래시계가 다 보이게
    cam.setFollowOffset(0, 80);
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,T,L');
    this.build(); this.ensureFree();
    if (saved) toast('저장된 곳에서 이어서 시작해요. (⚙ 설정에서 처음부터 할 수 있어요)');
    this.input.keyboard.on('keydown-T', () => this.timeTravel());
    // 대화를 닫은 직후 0.3초 동안은 E를 새 상호작용으로 받지 않음(연타로 다음 대화가 저절로 시작되는 것 방지)
    const act = () => { if (this.timelapsing || this.cinematic) return; if (this.choosing) return this.pickChoice(this.choiceSel); if (this.talkQ.length || !$('#talk').hidden) return this.nextTalk(); if (performance.now() - (this.talkClosedAt ?? 0) < 300) return; this.interact(); };
    this.input.keyboard.on('keydown-E', act); this.input.keyboard.on('keydown-SPACE', act);
    this.input.keyboard.on('keydown-L', () => this.toggleLens());
    this.input.keyboard.on('keydown-M', () => { if (this.rpgOn()) this.toggleMap(); }); this.input.keyboard.on('keydown-ESC', () => this.closeMap());
    $('#btn-map').onclick = () => this.toggleMap(); $('#mapdlg').onclick = () => this.closeMap(); addEventListener('resize', () => this.closeMap());
    this.input.keyboard.on('keydown', e => {                       // 선택지: 숫자키로 바로, 위·아래로 고르고 E로 확정
      if (!this.choosing) { if (e.key === 'n' || e.key === 'N') { if (this.rpgOn() && $('#talk').hidden && !document.querySelector('dialog[open]')) this.openNotebook(); } return; }
      const n = this.choosing.options.length;
      if (/^[1-9]$/.test(e.key) && +e.key <= n) return this.pickChoice(+e.key - 1);
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { this.choiceSel = (this.choiceSel + n - 1) % n; this.markChoice(); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { this.choiceSel = (this.choiceSel + 1) % n; this.markChoice(); }
    });
    $('#btn-time').onclick = () => this.timeTravel(); $('#btn-act').onclick = () => this.interact(); $('#prompt').onclick = () => this.interact();
    $('#btn-lens').onclick = () => this.toggleLens(); $('#btn-weather').onclick = () => this.toggleWeather(); $('#btn-final').onclick = () => this.openFinal();
    $('#btn-info').onclick = () => showInfo(this); $('#btn-album').onclick = () => this.openAlbum();
    $('#btn-notebook').onclick = () => this.openNotebook(); $('#btn-romi').onclick = () => { $('#btn-romi').classList.remove('pulse'); if ($('#talk').hidden && !this.traveling && !this.timelapsing) this.romiMenu(); };
    $('#btn-set').onclick = () => $('#settings').showModal();
    $('#planner').addEventListener('close', () => { saveGame(this); this.planClosed(); this.updateHud(); });
    $('#btn-compare').onclick = () => this.openCompare('street');
    $('#btn-discover-close').onclick = () => { $('#discover').hidden = true; };
    document.querySelectorAll('#compare .views button').forEach(b => b.onclick = () => this.openCompare(b.dataset.v));
    const rng = $('#cmp-range'); rng.oninput = () => this.setCompareSplit(+rng.value);
    this.touchTarget = null;
    this.input.on('pointerdown', p => {
      if (p.event?.target?.closest?.('button,dialog') || this.timelapsing || this.cinematic) return;
      if (this.choosing) return;                                  // 고르는 중엔 선택지 버튼으로만
      if (!$('#talk').hidden) { this.touchTarget = null; this.autoInteract = null; return this.nextTalk(); }   // 대화 중 화면을 누르면 다음 대사(걸어가지 않음)
      const hit = this.interactableAt(p.worldX, p.worldY);
      this.autoInteract = hit?.id ?? null;                       // 대상(게시판·시계·사람)을 누르면 그 앞까지 걸어가서 자동으로 살펴보기
      this.touchTarget = hit ? { x: hit.x, y: hit.y } : { x: p.worldX, y: p.worldY };
      if (hit && this.interactable()?.id === hit.id) { this.touchTarget = null; this.autoInteract = null; this.interact(); }
    });
    this.setupUI(saved, jump);
    if (savedRegion !== 'A') this.enterRegion(savedRegion, savedPos);
    this.fps = { frames: [], t0: performance.now() };
  }
  spot(n) { return this.zone.spots[n]; }
  heatData() { return this.heat.scenarios[heatKey(state.c1, state.c3)]; }
  care() { return { tree: state.c3 ? state.c3.treeCare : (state.rpg?.mode === 'rpg' ? (state.rpg.treeCare ? 1 : 0) : 1), facility: state.c3 ? state.c3.facilityCare : 1 }; }  // c3 null = 나무 돌봄은 1장 결과, 나머지는 관리 지속 가정

  // ---------- 장면 조립 ----------
  // year: 화면 연도(타임랩스 중간 연도 포함), trees: 슬롯별 대표 나무(tree_cohort 스냅숏), fade: 이전 장면을 서서히 사라지게
  build(year = state.year, trees = null, fade = 0) {
    (this.liveTweens || []).forEach(t => t.remove()); this.liveTweens = [];
    (this.retired || []).forEach(o => o.destroy()); this.retired = [];          // 이전 전환에서 사라지던 물체는 확실히 제거
    if (fade) { const old = this.dyn.getChildren().slice(); this.dyn.clear(false, false); this.retired = old; this.tweens.add({ targets: old, alpha: 0, duration: fade }); }
    else this.dyn.clear(true, true);
    this.viewYear = year;
    const era = eraOf(year), care = this.care(), worn = year >= FACILITY_DECLINE_YEAR && !care.facility;
    const add = (key, x, y, o = {}) => { const im = this.add.image(x, y, key, o.frame); im.setOrigin(...(o.origin ?? [0, 0])); if (o.w) im.setDisplaySize(o.w, o.h); im.setDepth(o.depth ?? 0); this.dyn.add(im); return im; };
    this.extraBlocked = []; this.occluders = [];
    const inA = this.region() === 'A'; this.bgA.setVisible(inA); this.lowA.setVisible(inA);
    if (!inA) { this.buildRegion(year, add); this.drawPortals(add); return this.buildTail(year, era, fade); }
    this.regionSize = this.zone.canvas;
    this.drawPortals(add); this.drawAOverlays(year, add);
    const Wt = this.zone.water;
    if (era === 2126) add('cc_street_renewal_2126_overlay', 0, 0, { w: 1536, h: 1024, depth: 1 });   // 2126 차도 재포장(공통)
    if (year === 2126 && state.year === 2126 && state.weather === 'rain') add('nv3_wet_paving', 0, 0, { w: 1536, h: 1024, depth: 1.5 });   // 호우 날 젖은 포장(잔디·흙 제외)
    // 운동장 녹화(선택했을 때만): 2046 전은 새로 조성한 잔디, 이후는 자란 잔디·낙엽 피복 — 모델 피복은 같은 yard_green
    if (state.c1.schoolyard) add(year < 2046 ? 'nv3_schoolyard_green_2026' : 'nv3_schoolyard_green_2046', 32, 355, { w: 544, h: 256, depth: 2 });
    const legacyWater = !this.rpgOn();     // RPG: 빗물 시설·저지대는 시장길(B) 구역에 있음
    if (legacyWater && state.c2.permeable) { const [x, y, w, h] = Wt.permeable; add(worn ? 'permeable_clogged' : 'permeable', x, y, { w, h, depth: 2 }); }
    // 건물: 시대별 원화(선택과 무관한 공통 세월 변화)
    for (const b of BUILDINGS) {
      const k = buildingKeys(b.key, era);
      // 실루엣 투영 그림자(바닥선에 정확히 붙음, 나무와 같은 광원) + 벽 밑 접지 띠(공중에 뜬 느낌 제거)
      add(`bshadow_${k.mg}`, b.x - SHADOW_PAD, b.anchor - SHADOW_PAD, { depth: 10 });
      add('ao_band', b.x + 6, b.anchor - 26, { w: b.w - 12, h: 26, depth: b.anchor * 10 + 1 }).setBlendMode(Phaser.BlendModes.MULTIPLY);
      add(k.mg, b.x, b.y, { w: b.w, h: b.h, depth: b.anchor * 10 });
      this.occluders.push({ im: add(k.fg, b.x, b.y, { w: b.w, h: b.h, depth: b.anchor * 10 + 2 }), box: [b.x + 8, b.y, b.x + b.w - 8, b.anchor], foot: b.anchor });
    }
    this.buildFuture('A', add, { era });
    add('gate', GATE.x, GATE.y, { w: GATE.w, h: GATE.h, depth: GATE.anchor * 10 });
    if (era >= 2086) { add('pergola_mg', PERGOLA.x, PERGOLA.y, { w: PERGOLA.w, h: PERGOLA.h, depth: PERGOLA.anchor * 10 }); add('pergola_fg', PERGOLA.x, PERGOLA.y, { w: PERGOLA.w, h: PERGOLA.h, depth: PERGOLA.anchor * 10 + 2 }); }
    const [bx, by] = this.spot('board'), [cx, cy] = this.spot('clock');
    if (era === 2126) add('cc_information_post_2126', bx, by, { origin: [0.5, 0.96], w: 70, h: 112, depth: by * 10 });
    else add('board', bx, by, { origin: ORIGIN.board, w: 96, h: 112, depth: by * 10 });
    this.clockImg = add('clock', cx, cy, { origin: ORIGIN.clock, w: 72, h: 116, depth: cy * 10 });
    if (state.prologue === 'start') this.liveTweens.push(this.tweens.add({ targets: this.clockImg, alpha: 0.6, yoyo: true, repeat: -1, duration: 650 }));
    for (const [x, y, w, h] of Wt.drains) add(worn ? 'drain_clogged' : 'drain', x, y, { w, h, depth: 2 });
    if (legacyWater && state.c2.rainGarden) for (const [x, y, w, h] of Wt.gardens) {
      add(worn ? 'garden_neglected' : 'garden', x, y, { w, h, depth: (y + h) * 10 });
      this.extraBlocked.push([x + 14, y + h * 0.45, x + w - 14, y + h - 8]);
    }
    // 남쪽 저지대: 저류지(마름/호우 연출/퇴적) 또는 저류지가 없을 때 개발된 주차장(장기 개발 가정)
    const [lx, ly, lw, lh] = Wt.basin;
    if (!legacyWater) { /* B 구역에서 */ } else if (state.c2.basin) {
      const k = worn ? 'basin_sediment' : (state.year === 2126 && state.weather === 'rain' && year === 2126 ? 'basin_wet' : 'basin_dry');
      add(k, lx, ly, { w: lw, h: lh, depth: 3 }); this.extraBlocked.push(Wt.basinBlock);
    } else if (era >= 2086) add('basin_parking', lx, ly, { w: lw, h: lh, depth: 2 });
    this.drawTrees(year, trees, add);
    this.drawNursery(year, add);
    // NPC(이전 방식 = RPG가 아닐 때): 미션 중이 아니면 할머니는 집 앞, 약사는 약국 앞. RPG에선 콘텐츠가 배치(rpgPlaceNPCs)
    if (!this.rpgOn()) {
      const [px, py] = this.spot('pharm');
      if (!state.mission.active) this.granny.setVisible(true).place(...this.spot(state.year === 2126 && state.weather === 'rain' ? 'grannyRain' : 'granny'), state.weather === 'rain' && state.year === 2126 ? 'down' : 'left');
      this.pharm.setVisible(true); this.pharm.place(px, py); this.extraBlocked.push(this.npcBox(this.pharm));
    }
    this.buildTail(year, era, fade);
  }
  buildTail(year, era, fade) {
    if (fade) for (const o of this.dyn.getChildren()) { const a = o.alpha; o.setAlpha(0); this.tweens.add({ targets: o, alpha: a, duration: fade }); }
    if (this.rpgOn()) this.rpgPlaceNPCs(); else { this.npcBlocks = []; for (const k of NEW_NPCS) this.vis[k].setVisible(false); }
    this.renderInv();
    const showRomi = this.rpgOn() ? !this.timelapsing : (era === 2126 && state.year === 2126);
    this.romi.setVisible(showRomi); this.romiShadow.setVisible(showRomi);
    if (showRomi && !this.romiPlaced) { this.romi.setPosition(this.player.x - 40, this.player.y + 14); this.romiPlaced = true; }
    if (!showRomi) this.romiPlaced = false;
    this.heatTint.setVisible(state.year === 2126 && state.weather === 'heat' && !this.timelapsing);
    this.drawPuddles(); this.drawHeat(); this.drawRainTint(); this.updateHud();
    this.pathFor = null;   // 장애물이 바뀌었으니 경로 다시 계산
    this.unstick();
  }
  // A 구역의 선택 결과 바닥(Codex fullgame-art-v1): 밝은 포장 3시기, 가로수를 심지 않은 보도 마감. 필요할 때만 내려받음
  drawAOverlays(year, add) {
    const s = this.artState(year), byId = this.fgA ??= Object.fromEntries(this.fg.assets.map(a => [a.id, a]));
    const want = [['A_unplanted_finish_v1', artCond('noTrees', s)], [`A_cool_pavement_${year >= 2126 ? 2126 : year >= 2046 ? 2046 : 2026}_v1`, !!state.c1.coolPave]].filter(([, on]) => on).map(([id]) => id);
    const miss = want.filter(id => !this.textures.exists(id));
    if (miss.length) { if (!this.loadingA) { this.loadingA = true; miss.forEach(id => this.load.image(id, assetUrl(byId[id]))); this.load.once('complete', () => { this.loadingA = false; this.build(); }); this.load.start(); } return; }
    for (const id of want) add(id, 0, 0, { w: 1536, h: 1024, depth: 2 });
  }
  // 가로수 20자리(논리 슬롯과 같은 칸) + 운동장 녹화 나무. 크기·생사는 대표 나무(tree_cohort)를 읽기만 한다.
  drawTrees(year, trees, add) {
    this.treeInfo = []; const T = this.zone.trees, care = this.care();
    const tc = `TC${care.tree}`, tl = this.heat.timelapse?.[tc] ?? {};
    const reps = trees ?? (year >= 2126 ? this.heatData()?.trees : tl[year]?.trees);
    if (state.c1.streetTrees) T.street.forEach(sp => {
      let plan = year <= 2026 && !trees ? { stage: 'staked', crown: 1, age: 0 } : treePlan(reps?.[sp.slot]?.rep, sp.slot, year, tl);
      const mine = state.rpg?.mode === 'rpg' && this.ch.playerSlots.includes(sp.slot);
      if (mine && year <= 2026 && !trees) plan = state.rpg.planted.includes(sp.slot) ? { stage: 'staked', crown: 1, age: state.rpg.watered.includes(sp.slot) ? 1 : 0, mine: true } : { stage: 'empty', mine: true };
      // 보식 장면(타임랩스): 대표 나이가 지난 스냅숏 이후 경과보다 작으면 그 사이 새로 심은 세대 → 보식 원화로 잠시 대체(실제 보식 연도 예측 아님)
      const prev = this.prevTl?.trees?.[sp.slot]?.rep, cur = reps?.[sp.slot]?.rep;
      if (trees && prev && cur?.state === 'tree' && plan.stage === 'staked' && (prev.state !== 'tree' || cur.age < (prev.age ?? 0) + (year - this.prevTl.year) - 1)) plan.replant = true;
      const paved = !this.zm.rectHit([916, 466, 1004, 712], ...sp.foot);   // 동쪽 화단 안은 잔디 멀칭, 나머지는 보도 나무 자리
      this.drawTree(sp.foot, plan, paved, plan.mine ? 1 : care.tree, add); this.treeInfo.push({ id: `s${sp.slot}`, slot: sp.slot, foot: sp.foot, ...plan });
    });
    if (state.c1.schoolyard) T.schoolyard.forEach((f, i) => { const plan = schoolyardPlan(year); this.drawTree(f, plan, false, 0, add); this.treeInfo.push({ id: `y${i}`, foot: f, yard: true, ...plan }); });
  }
  drawNursery(year, add) {
    const r = state.rpg; if (!this.rpgOn() || !r.care?.nursery) return;
    if (year > 2026 && !r.treeCare) return;                          // 돌볼 사람이 없으면 묘목밭은 문을 닫음(연출) — 모델 값과 무관한 화단
    for (const [i, x] of [270, 318, 366, 414].entries()) this.drawTree([x, 690 + (i % 2) * 4], { stage: 'staked', crown: 1, age: 0 }, false, 0, add);
  }
  drawTree([x, y], plan, paved, careTree, add) {
    const [b0, b1, b2, b3] = this.zone.trees.trunkBox;
    add(paved ? 'cc_tree_pit_flush' : 'cc_tree_mulch_lawn', x, y, { origin: [0.5, 0.52], w: 80, h: 40, depth: 3 });
    if (plan.stage === 'empty') return;
    this.extraBlocked.push([x + b0, y + b1, x + b2, y + b3]);
    if (plan.stage === 'stump') { add('stump', x, y, { origin: [0.52, 0.93], w: 56, h: 45, depth: y * 10 }); return; }
    if (plan.stage === 'fallen') { add('cc_tree_fallen', x, y, { origin: [0.16, 0.7], w: 110, h: 46, depth: y * 10 }); return; }
    const t = this.cc.trees[plan.stage], s = crownPx(plan.crown) / t.canopyWidth, [W, H] = t.size, sh = this.ccShadow[plan.stage];
    if (plan.replant) {   // 막 심은 묘목·흙더미, 지지대 나무와 같은 배율·그림자
      add('cc_shadow_staked', x, y, { origin: t.shadowOrigin, w: sh[0] * s, h: sh[1] * s, depth: 10 });
      add('nv3_tree_replant_event', x, y, { origin: [0.52, 0.969], w: 160 * s, h: 224 * s, depth: y * 10 + 2 });
      if (paved) add('cc_tree_pit_flush_lip', x, y, { origin: [0.5, 0.52], w: 80, h: 40, depth: y * 10 + 3 });
      return;
    }
    add(`cc_shadow_${plan.stage}`, x, y, { origin: t.shadowOrigin, w: sh[0] * s, h: sh[1] * s, depth: 10 });
    add(`tree_${plan.stage}_mg`, x, y, { frame: 'grounded', origin: [t.originX, 1], w: W * s, h: t.groundY * s, depth: y * 10 });
    const fg = add(`tree_${plan.stage}_fg`, x, y, { origin: t.fgOrigin, w: W * s, h: H * s, depth: y * 10 + 2 }), bb = fg.getBounds();
    this.occluders?.push({ im: fg, box: [bb.x + bb.width * 0.12, bb.y, bb.right - bb.width * 0.12, y - 6], foot: y });
    if (paved) add('cc_tree_pit_flush_lip', x, y, { origin: [0.5, 0.52], w: 80, h: 40, depth: y * 10 + 3 });
    if (careTree && plan.age > 0 && plan.age < 10) add('watering_bag', x + 12, y, { origin: ORIGIN.watering_bag, w: 24, h: 48, depth: y * 10 + 4 });
  }
  // ---------- 그늘 지도(InVEST HM, 논리 격자에서 읽음) ----------
  hmAtPx(x, y) { const d = this.heatData(); if (!d || this.region() !== 'A') return null; const [cx, cy] = this.zm.cellAt(x, y); return d.hm[cy * this.world.W + cx]; }
  drawHeat() {
    const on = state.year === 2126 && this.lens && state.weather !== 'rain' && !this.timelapsing && !this.cinematic && this.region() === 'A';
    this.lensImg.setVisible(on); $('#legend').hidden = !on; $('#btn-lens').classList.toggle('off', !this.lens);
    if (!on) return;
    const R = this.rules.heat, C = this.lensC, cv = this.lensTex.getSourceImage(), ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height), px = img.data;
    for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) {
      const x = i * C + C / 2, y = j * C + C / 2, o = (j * cv.width + i) * 4;
      if (!this.zm.isFree(x, y)) continue;
      const hm = this.hmAtPx(x, y);
      if (hm < R.hotHM) px.set([255, 122, 50, 255], o); else if (hm >= R.shadeHM) px.set([70, 170, 255, 255], o);
    }
    ctx.putImageData(img, 0, 0); this.lensTex.refresh();
  }
  toggleLens() { if (state.year !== 2126 || state.weather === 'rain' || this.region() !== 'A') return; this.lens = !this.lens; this.drawHeat(); }
  // ---------- 빗물(SWMM, 2126 가상 집중호우) ----------
  swmmData() { return this.swmm[swmmKey(state.c1, state.c2, state.c3)]; }
  drainLoad() { const d = this.swmmData(); return d ? Math.max(d.pipe_load.C5 ?? 0, d.pipe_load.C6 ?? 0) : 0; }
  puddleLevel() { const D = this.drainLoad(), R = this.rules.rain; return D >= R.deepD ? 'deep' : D >= R.shallowD ? 'shallow' : 'none'; }
  drawPuddles() {
    if (this.region() === 'B') return this.drawRegionPuddles();
    if (this.region() !== 'A' || (this.rpgOn() && state.rpg.ch >= 2)) { this.puddleRects = { shallow: [], deep: [] }; return; }   // RPG 2장 이후 물웅덩이는 시장길(B)에서
    this.puddleRects = { shallow: [], deep: [] };
    if (!(state.year === 2126 && state.weather === 'rain')) return;
    const lvl = this.puddleLevel(); if (lvl === 'none') return;
    const rects = lvl === 'deep' ? this.zone.water.puddleDeep : this.zone.water.puddleShallow;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Codex 물고임 원화(규칙 사각형에 맞춰) + 빗방울 파문. 충돌·감속 사각형은 그대로, 게임 표시일 뿐 침수 깊이 예측 아님.
    rects.forEach(([x, y, w, h]) => {
      const key = lvl === 'shallow' ? 'nv3_puddle_shallow_vertical' : h / w > 3 ? 'nv3_puddle_deep_vertical' : 'nv3_puddle_deep_pool';
      this.dyn.add(this.add.image(x, y, key).setOrigin(0).setDisplaySize(w, h).setDepth(4));
      for (let k = 0, n = Math.max(2, Math.round(w * h / 9000)); k < n; k++) {
        const r = this.add.sprite(x + w * (0.25 + 0.5 * rnd()), y + h * (0.12 + 0.76 * rnd()), 'nv3_ripple').setDepth(4.1).setDisplaySize(32, 16).setAlpha(0.85);
        r.play({ key: 'ripple', startFrame: Math.floor(rnd() * 4) }); r.anims.timeScale = 0.8 + rnd() * 0.5; this.dyn.add(r);
      }
      (lvl === 'deep' ? this.puddleRects.deep : this.puddleRects.shallow).push([x, y, x + w, y + h]);
    });
  }
  drawRainTint() { this.rainTint.setVisible(state.year === 2126 && state.weather === 'rain' && !this.timelapsing); if (!this.rainTint.visible) this.rainGfx.clear(); }
  onPuddle() { const { x, y } = this.player; return (this.puddleRects?.shallow || []).some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]); }
  toggleWeather() {
    if (state.year !== 2126 || state.mission.active || state.delivery.active || this.timelapsing) return;
    state.weather = state.weather === 'rain' ? 'heat' : 'rain'; this.build(); this.ensureFree(); saveGame(this);
    toast(state.weather === 'rain' ? '2126년, 집중호우가 쏟아져요(짧은 시간에 비가 아주 많이 와요). 약국 사장님을 찾아가 봐요.' : '2126년, 폭염이 이어지고 있어요.');
  }
  // ---------- 이동·충돌 ----------
  isFree(x, y) {
    const npc = [...(this.npcBlocks || [])];
    if (this.granny?.sprite.visible && !this.rpgOn()) npc.push(this.npcBox(this.granny));
    // 함께 걷는 사람(하늘이·할머니)은 뒤따라오므로 길을 막지 않음 — 겹친 채 동행이 시작되면 주인공이 꼼짝 못 하던 문제
    const extra = this.extraBlocked.concat(npc, this.puddleRects?.deep || []);
    return this.region() === 'A' ? this.zm.isFree(x, y, extra) : this.regionFree(x, y, extra);
  }
  // 안전장치: 시대·사람 배치가 바뀌어 주인공이 빠져나올 수 없는 곳(예: 문이 닫힌 운동장 안)에 갇히면 로미가 열린 곳으로 데려다줌
  unstick() {
    if (!this.rpgOn?.() || this.timelapsing || state.mission.active || this.rpgDelivery || !this.player) return;
    const safe = this.region() === 'A' ? [700, 770] : this.fg.regions[this.region()].spawn, size = this.region() === 'A' ? this.zone.canvas : this.regionSize;
    if (Math.hypot(this.player.x - safe[0], this.player.y - safe[1]) < 40) return;
    if (findPath((x, y) => this.isFree(x, y), [this.player.x, this.player.y], safe, size, 16)) return;
    this.player.setPosition(...safe); this.romi.setPosition(safe[0] - 40, safe[1] + 14); this.touchTarget = null;
    this.time.delayedCall(300, () => toast('🤖 로미: 길이 막혀서 열린 곳으로 데려왔어요!', 3200));
  }
  npcBox(n) { const hw = Math.round(n.size[0] / 3); return [n.x - hw, n.y - 8, n.x + hw, n.y + 2]; }   // 발밑 상자: 표시 폭의 2/3
  ensureFree() {
    const p = this.player; if (this.isFree(p.x, p.y)) return;
    for (let r = 8; r < 400; r += 8) for (let a = 0; a < 16; a++) { const x = p.x + Math.cos(a / 16 * 6.283) * r, y = p.y + Math.sin(a / 16 * 6.283) * r; if (this.isFree(x, y)) { p.setPosition(x, y); return; } }
  }
  near(name, r = this.zone.interactRadius) { const [x, y] = this.spot(name); return Math.hypot(this.player.x - x, this.player.y - y) < r; }
  nearObj(o, r = this.zone.interactRadius) { return o && Math.hypot(this.player.x - o.x, this.player.y - o.y) < r; }
  // 지금 가까이에서 살펴볼 수 있는 대상(우선순위는 interact()와 같음)
  interactable() {
    if (this.traveling || this.timelapsing || this.cinematic) return null;
    const inA = this.region() === 'A', nearBoardFirst = inA && state.prologue !== 'start' && this.near('board');
    if (inA && !nearBoardFirst && this.near('clock')) return { id: 'clock', at: this.spot('clock'), h: 118, label: state.prologue === 'start' ? '빛나는 모래시계 살펴보기' : '백년시계' };
    const ci = this.ch3Interactable(); if (ci) return ci;           // 3장: 가로수 길·빗물 시설·안내판 조사
    const ri = this.rpgNearby(); if (ri) return { id: 'rpg', t: ri, at: ri.at, h: ri.h, label: ri.label, talk: ri.kind === 'npc' };   // RPG 콘텐츠(NPC·오브젝트)
    if (inA && this.near('board')) return { id: 'board', at: this.spot('board'), h: 114, label: state.year === 2026 ? '마을 계획 게시판 열기' : '2126 안내판 보기' };
    if (!this.rpgOn() && this.nearObj(this.pharm) && !state.delivery.active) return { id: 'pharm', at: [this.pharm.x, this.pharm.y], h: this.pharm.height + 4, label: '약국 사장님과 이야기' };
    if (!this.rpgOn() && this.nearObj(this.granny) && !state.mission.active) return { id: 'granny', at: [this.granny.x, this.granny.y], h: this.granny.height + 4, label: '할머니와 이야기' };
    if (this.romi.visible && !state.mission.active && !state.delivery.active && !this.rpgDelivery && this.nearObj(this.romi, 60)) return { id: 'romi', at: [this.romi.x, this.romi.y], h: 44, label: '로미와 이야기' };
    return null;
  }
  interactableAt(x, y) {
    const objs = [...(this.region() === 'A' ? [['clock', ...this.spot('clock'), 60], ['board', ...this.spot('board'), 60]] : []),
      ...(this.rpgOn() ? [] : [['pharm', this.pharm.x, this.pharm.y, this.pharm.height / 1.9], ['granny', this.granny.x, this.granny.y, this.granny.height / 1.9]]),
      ...Object.values(this.rpgNpcAt ?? {}).map(v => ['rpg', v.x, v.y, v.height / 1.9])];
    for (const [id, ox, oy, h] of objs) if (Math.abs(x - ox) < 36 && y < oy + 10 && y > oy - h * 1.9) return { id, x: ox, y: oy + 14 };
    if (this.rpgOn()) for (const o of Object.values(this.ch.objects)) {           // 오브젝트(빈 나무 자리·게시판·운동장 숲)도 누르면 그 앞까지
      if ((o.region ?? 'A') !== this.region()) continue;
      const pts = o.slots ? this.ch[o.slots].map(sl => this.zone.trees.street.find(t => t.slot === sl).foot) : [o.at];
      for (const [ox, oy] of pts) if (Math.hypot(x - ox, y - oy) < 40) return { id: 'rpg', x: ox, y: oy + 24 };
    }
    return null;
  }
  // ---------- 목표 안내(처음 30초 안에 어디로 갈지 알 수 있게) ----------
  objective() {
    const M = state.mission, D = state.delivery, hk = heatKey(state.c1, state.c3), sk = swmmKey(state.c1, state.c2, state.c3);
    if (state.prologue === 'start') return { goal: '✨ 반짝이는 모래시계를 찾아 살펴봐요', target: this.spot('clock'), label: '모래시계', h: 118 };
    if (state.prologue === 'found') return { goal: '⏳ 시간여행 버튼을 눌러요', pulse: '#btn-time' };
    if (state.prologue === 'met') return { goal: state.year === 2126 ? '⏳ 시간여행으로 2026년에 돌아가요' : '', pulse: '#btn-time' };
    if (this.rpgOn()) return this.rpgGoal() ?? { goal: '' };      // RPG: 장별 목표(ch1~3.json goals)
    return this.flowObjective();                                   // 2·3장·엔딩 목표(flow.js)
  }
  toScreen(x, y) {
    const cam = this.cameras.main, r = this.game.canvas.getBoundingClientRect(), k = r.width / this.scale.width;
    return [r.left + (x - cam.worldView.x) * cam.zoom * k, r.top + (y - cam.worldView.y) * cam.zoom * k, r];
  }
  updateGuide() {
    const busy = this.timelapsing || this.cinematic || this.traveling || !$('#talk').hidden || document.querySelector('dialog[open]');
    const nav = $('#nav'), mk = $('#marker'), pr = $('#prompt');
    const it = busy ? null : this.interactable();
    if (it) { const [sx, sy] = this.toScreen(it.at[0], it.at[1] - it.h - 6); pr.hidden = false; pr.style.left = sx + 'px'; pr.style.top = sy + 'px';
      const icon = ['granny', 'pharm', 'romi'].includes(it.id) || it.talk ? 'talk' : 'inspect';
      const t = `<img class="ic" alt="" src="${UI_IMG[icon]}">${this.touchUI ? '' : '<kbd>E</kbd>'}${it.label}`; if (pr.innerHTML !== t) pr.innerHTML = t; } else pr.hidden = true;
    const o = busy ? null : this.objective();
    // 목표 글·할 일 목록은 상태가 바뀌면 곧바로(추리 노트에서 원인을 고른 뒤 등 — 장소를 옮기지 않아도). 0.3초마다 비교
    if (o && (this.goalT = (this.goalT ?? 0) + 1) % 18 === 0) { if ($('#goal').textContent !== o.goal) $('#goal').textContent = o.goal; this.renderSteps?.(); }
    document.querySelectorAll('.pulse').forEach(b => { if (!o || o.pulse !== '#' + b.id) b.classList.remove('pulse'); });
    if (o?.pulse) $(o.pulse)?.classList.add('pulse');
    if (!o?.target || (it && Math.hypot(it.at[0] - o.target[0], it.at[1] - o.target[1]) < 30)) { nav.hidden = mk.hidden = true; return; }
    const [tx, ty] = o.target, [fx, fy, r] = this.toScreen(tx, ty), [sx, sy] = this.toScreen(tx, ty - (o.h ?? 0) - 8), m = 40;
    if (fx > r.left + m && fx < r.right - m && fy > r.top + 30 && fy < r.bottom - m) {
      nav.hidden = true; mk.hidden = false; mk.style.left = sx + 'px'; mk.style.top = Math.max(r.top + 52, sy) + 'px'; mk.querySelector('b').textContent = o.label;
    } else {
      mk.hidden = true; nav.hidden = false;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((r.width / 2 - 60) / Math.abs(Math.cos(a) || 1e-6), (r.height / 2 - 70) / Math.abs(Math.sin(a) || 1e-6));
      let nx = cx + Math.cos(a) * k, ny = cy + Math.sin(a) * k;
      if (nx > r.right - 200 && ny > r.bottom - 330) nx = r.right - 200;          // 오른쪽 아래 버튼 줄을 가리지 않게
      const sp = $('#steps'); if (sp && !sp.hidden) { const q = sp.getBoundingClientRect(); if (nx > q.left - 50 && ny < q.bottom + 40) ny = q.bottom + 50; }   // 할 일 목록을 가리지 않게
      nav.style.left = nx + 'px'; nav.style.top = ny + 'px';
      nav.querySelector('img').style.transform = `rotate(${a + Math.PI / 2}rad)`; nav.querySelector('span').textContent = o.label;   // 배지 기본 방향 = 위
    }
  }
  // ---------- FINAL ----------
  openFinal() {
    if (this.rpgOn()) return this.openEnding();                     // RPG: 세 축 엔딩(chapters.js)
    const mine = futureFacts(this, state.c1, state.c2, state.c3, heatKey, swmmKey), first = futureFacts(this, FIRST.c1, FIRST.c2, FIRST.c3, heatKey, swmmKey);
    this.renderStory(mine, first);
    const txt = sentences(state.c1, state.c2, state.c3, mine, first);
    renderFinal($('#final .body'), mine, first, txt); this.finalData = { mine, first, txt };
    $('#btn-card').onclick = () => saveCard(this.game, mine, first, txt);
    $('#final').showModal();
  }
  // ---------- 시간여행 ----------
  warpFx(from, to) {
    const w = $('#warp'), b = w.querySelector('b'); w.classList.remove('on'); void w.offsetWidth; w.classList.add('on');
    const t0 = performance.now(), roll = () => { const k = Math.min(1, (performance.now() - t0) / 700); b.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(roll); };
    roll();
  }
  timeTravel() {
    if (this.traveling || this.timelapsing || !$('#talk').hidden) return;
    if (state.prologue === 'start') return toast('아직 시간을 건널 방법이 없어요. 반짝이는 모래시계를 찾아보세요.');
    if (state.ch3.phase === 'explore' && state.year === 2126) return toast('먼저 📒 약속 기록장의 세 곳을 조사해요!');
    if (state.ch3.phase === 'intro') return;
    if (state.delivery.active || this.rpgDelivery) return toast('약 배달 중이에요!');
    if (state.mission.active) return toast('지금은 할머니와 함께 걷는 중이에요. 쉼터에 도착한 뒤 이동할 수 있어요.');
    this.traveling = true; this.touchTarget = null; $('#discover').hidden = true;
    const to = state.year === 2026 ? 2126 : 2026, cam = this.cameras.main;
    sfxWarp(to === 2126); this.warpFx(state.year, to);
    this.ring.setVisible(true).play('century_ring'); this.border.setAlpha(1); this.tweens.add({ targets: this.border, alpha: 0, delay: 300, duration: 700 });
    cam.shake(380, 0.004);
    this.tweens.add({ targets: cam, zoom: this.baseZoom * 1.06, duration: 380, ease: 'Quad.easeIn', yoyo: true, onComplete: () => cam.setZoom(this.baseZoom) });
    this.time.delayedCall(380, () => {
      state.year = to; if (this.rpgOn()) state.rpg.flags[`v${to}_${state.rpg.ch}`] = true;   // 할 일: '2026년에 가요' 등
      this.rpgSync(); this.build(); this.ensureFree();   // RPG: 시대가 바뀌면 날씨(2장 큰비)·과학 변수 다시 맞춤
      cam.flash(420, 255, 255, 255);
      const k = heatKey(state.c1, state.c3);
      if (state.prologue === 'found' && to === 2126) { this.traveling = false; return this.prologueMeet(); }
      if (state.prologue === 'met' && to === 2026) { this.traveling = false; state.prologue = 'done'; saveGame(this); this.updateHud(); return this.talk([['로미', '돌아왔군요! 바로 옆 계획 게시판에서 마을을 바꿀 수 있어요.'], ['로미', '바꾼 다음 다시 100년 뒤로 와서 무엇이 달라졌는지 찾아봐요!']]); }
      if (to === 2126 && !state.visited2126.includes(k)) { state.visited2126.push(k); saveGame(this); return this.playTimelapse(() => this.arriveFuture()); }
      this.traveling = false; saveGame(this);
      if (to === 2126) this.arriveFuture();
    });
  }
  // 100년 타임랩스: 공통 세월 변화(건물·거리) + 선택한 대책의 대표 변화 장면. 화면 연도와 HUD 연도를 맞추고, 도중에는 조작을 막는다.
  playTimelapse(done) {
    const tl = this.heat.timelapse?.[`TC${this.care().tree}`] ?? {};
    const years = Object.keys(tl).map(Number).sort((a, b) => a - b);
    const box = $('#timelapse'), cam = this.cameras.main, V = this.cc.cameraViews;
    box.hidden = false; this.timelapsing = true; this.traveling = true; document.body.classList.add('cine');
    this.heatTint.setVisible(false); this.drawHeat(); this.drawRainTint();
    cam.stopFollow(); cam.pan(V.gate.center[0], V.gate.center[1] + 60, 500, 'Sine.easeInOut');
    let i = 0, ended = false, prev = null, prevEra = null; const timers = []; this.prevTl = null;
    const finish = () => {
      if (ended) return; ended = true; timers.forEach(t => t.remove()); box.hidden = true;
      this.input.keyboard.off('keydown-SPACE', finish); box.onclick = null; $('#tl-skip').onclick = null; this.prevTl = null;
      this.timelapsing = false; this.traveling = false; document.body.classList.remove('cine'); this.build(); this.ensureFree();
      cam.pan(this.player.x, this.player.y, 450, 'Sine.easeInOut', true, (c, p) => { if (p === 1) { c.startFollow(this.player, true, 0.1, 0.1); done?.(); } });
    };
    this.input.keyboard.once('keydown-SPACE', finish); box.onclick = finish; $('#tl-skip').onclick = e => { e.stopPropagation(); finish(); };
    const step = () => {
      if (ended) return;
      if (i >= years.length) { timers.push(this.time.delayedCall(700, finish)); return; }
      const y = years[i++], era = eraOf(y), trees = tl[y]?.trees ?? null;
      $('#tl-year').textContent = y; $('#year').textContent = y; document.body.dataset.year = y >= 2126 ? 2126 : 2026;
      $('#tl-bar').style.width = ((y - 2026) / 100 * 100) + '%';
      $('#tl-cap').textContent = ERA_CAPTION[era];
      const eraChange = prevEra !== null && era !== prevEra;
      if (eraChange) cam.flash(380, 255, 244, 214);
      this.build(y, trees, i === 1 ? 0 : eraChange ? 520 : 320); this.timelapsing = true; this.prevTl = { year: y, trees };
      $('#tl-trees').textContent = this.treeStory(prev, this.treeInfo, y);
      prev = this.treeInfo.map(t => ({ ...t })); prevEra = era;
      // 카메라: 학교·건물 쪽에서 시작해 가로수 길로 천천히 이동(같은 장소의 변화를 보여 줌)
      if (y === 2066) cam.pan(V.street.center[0], V.street.center[1] - 40, 2600, 'Sine.easeInOut');
      const hold = y === 2026 ? 1300 : [2046, 2086, 2126].includes(y) ? 1700 : 650;
      timers.push(this.time.delayedCall(hold, step));
    };
    step();
  }
  // 타임랩스 한 줄 설명: 대표 나무들의 변화(수치 대신 말로). 대표 장면임을 전제로 한다.
  treeStory(prev, cur, y) {
    if (!state.c1.streetTrees) return state.c1.schoolyard ? '🌱 운동장에 나무와 잔디를 가꿔요 · 가로수는 심지 않았어요' : '가로수를 심지 않은 거리예요';
    const live = cur.filter(t => !t.yard && ['staked', 'young', 'mid', 'mature'].includes(t.stage)).length, all = cur.filter(t => !t.yard).length;
    if (!prev || y === 2026) return `🌱 가로수 ${all}그루를 막 심었어요`;
    const P = Object.fromEntries(prev.map(t => [t.id, t])); let grow = 0, die = 0, replant = 0, clear = 0;
    for (const t of cur) { const p = P[t.id]; if (!p || t.yard) continue; const alive = t.crown && !t.illustrative, palive = p.crown && !p.illustrative;
      if (t.replant || (alive && !palive)) replant++; else if (alive && t.crown > p.crown) grow++; else if (!alive && palive) die++; else if (!alive && t.stage !== p.stage) clear++; }
    const parts = [];
    if (grow) parts.push('나무가 자라요'); if (replant) parts.push('죽은 자리에 새로 심었어요'); if (die) parts.push('돌보지 않은 나무가 죽었어요'); if (clear) parts.push('쓰러진 나무와 그루터기가 남아요');
    if (!parts.length) parts.push(live ? '나이가 다른 나무들이 자리를 지켜요' : '빈 나무 자리만 남았어요');
    return `🌳 살아 있는 가로수 ${live}/${all} · ${parts.join(' · ')}`;
  }
  // 미래 도착: 지난번(또는 아무것도 안 한) 미래와 다르면 같은 장소를 잠깐 보여 주고 비교를 권한다.
  arriveFuture() {
    if (this.rpgOn()) { const k = heatKey(state.c1, state.c3); if (!state.rpg.futures.includes(k)) state.rpg.futures.push(k); state.lastFuture = { c1: clone(state.c1), c2: clone(state.c2), c3: clone(state.c3) }; this.onArriveRpg?.(); saveGame(this); return; }   // RPG: 비교 안내 없이 직접 발견
    const cur = { c1: clone(state.c1), c2: clone(state.c2), c3: clone(state.c3) }, keyOf = f => `${heatKey(f.c1, f.c3)}/${swmmKey(f.c1, f.c2, f.c3)}`;
    const prev = state.lastFuture; state.lastFuture = cur; saveGame(this);
    const none = { c1: clone(FIRST.c1), c2: clone(FIRST.c2), c3: clone(FIRST.c3) };
    let base = null, msg = '';
    const a = futureSummary(cur.c1, cur.c2, cur.c3);
    const say = s => ({ none: '가로수가 없는 길', cared: '돌본 가로수 길', neglected: '돌보지 않은 가로수 자리' }[s.trees]);
    if (prev && keyOf(prev) !== keyOf(cur)) { base = { f: prev, label: '지난번 2126년' }; const b = futureSummary(prev.c1, prev.c2, prev.c3);
      msg = b.trees !== a.trees ? `지난번 2126년은 '${say(b)}'. 이번에는 어떻게 달라졌을까요?` : '지난번 2126년과 무엇이 달라졌는지 찾아봐요!'; }
    else if (!prev && keyOf(none) !== keyOf(cur)) { base = { f: none, label: '아무것도 안 한 2126년' }; msg = '내 선택으로 바뀐 100년 뒤예요. 아무것도 안 한 미래와 비교해 볼까요?'; }
    if (state.ch3.phase === 'verify') { base = { f: { c1: clone(state.c1), c2: clone(state.c2), c3: clone(NO_PROMISE) }, label: '약속이 없던 2126년' };
      msg = '약속을 지킨 100년이에요! 약속이 없던 미래와 같은 자리를 비교하고, 세 곳을 다시 조사해 봐요.'; }
    this.compareBase = base;
    if (!base) return;
    $('#discover p').textContent = msg; $('#discover').hidden = false;
    clearTimeout(this._discT); this._discT = setTimeout(() => { $('#discover').hidden = true; }, 15000);
    // 같은 장소를 잠깐 보여 줌(이동하면 바로 끝)
    const cam = this.cameras.main, V = this.cc.cameraViews.street; this.cinematic = true; cam.stopFollow();
    cam.pan(V.center[0], V.center[1], 900, 'Sine.easeInOut');
    const end = () => { if (!this.cinematic) return; this.cinematic = false; this.input.keyboard.off('keydown', end); cam.startFollow(this.player, true, 0.06, 0.06); this.time.delayedCall(800, () => cam.setLerp(0.1, 0.1)); };
    this.time.delayedCall(2600, end); this.input.keyboard.once('keydown', end);
  }
  // 같은 카메라 구도의 두 미래 스냅숏 비교(밀어서 보기)
  async openCompare(view = 'street') {
    if (!this.compareBase || this.snapping) return; this.snapping = true;
    const cam = this.cameras.main, V = this.cc.cameraViews[view], keep = { c1: clone(state.c1), c2: clone(state.c2), c3: clone(state.c3), lens: this.lens, weather: state.weather };
    const snap = () => new Promise(res => this.time.delayedCall(80, () => this.game.renderer.snapshot(img => res(img.src))));
    this.cinematic = true; this.lens = false; state.weather = 'heat'; cam.stopFollow(); cam.centerOn(...V.center);
    const hide = [$('#nav'), $('#marker'), $('#prompt')]; hide.forEach(e => e.hidden = true);
    this.build(); this.heatTint.setVisible(false); const a = await snap();
    Object.assign(state, { c1: Object.assign(state.c1, this.compareBase.f.c1), c2: Object.assign(state.c2, this.compareBase.f.c2) }); state.c3 = clone(this.compareBase.f.c3);
    this.build(); this.heatTint.setVisible(false); const b = await snap();
    Object.assign(state.c1, keep.c1); Object.assign(state.c2, keep.c2); state.c3 = keep.c3; state.weather = keep.weather; this.lens = keep.lens;
    this.build(); cam.startFollow(this.player, true, 0.1, 0.1); this.cinematic = false; this.snapping = false;
    $('#cmp-a').src = a; $('#cmp-b').src = b; $('#cmp-la').textContent = '◀ 지금 만든 2126년'; $('#cmp-lb').textContent = this.compareBase.label + ' ▶';
    document.querySelectorAll('#compare .views button').forEach(x => x.classList.toggle('on', x.dataset.v === view));
    this.setCompareSplit(+$('#cmp-range').value); $('#discover').hidden = true;
    if (!$('#compare').open) $('#compare').showModal();
  }
  setCompareSplit(v) { $('#cmp-a').style.clipPath = `inset(0 ${100 - v}% 0 0)`; $('#compare .handle').style.left = v + '%'; }
  // ---------- 프롤로그·대화 ----------
  talk(lines, after) { this.talkQ.push(...lines); this.talkAfter = after; this.nextTalk(); }
  nextTalk() {
    if (this.choosing) return;
    const box = $('#talk');
    if (!this.talkQ.length) { box.hidden = true; this.talkClosedAt = performance.now(); const f = this.talkAfter; this.talkAfter = null; this.updateHud(); if (f) f(); return; }
    const [who, text] = this.talkQ.shift(); box.hidden = false; $('#talk-who').textContent = who; $('#talk-text').textContent = text; audio.sfx('talk', 0.5);
  }
  // 선택지: 대화 상자 안 버튼(숫자키·위아래+E·클릭). 고르면 cb(i)
  choose(who, q, options, cb) {
    const box = $('#talk'), list = $('#talk-choices'); this.talkQ = []; this.choosing = { options, cb }; this.choiceSel = 0; this.touchTarget = null;
    box.hidden = false; box.classList.add('choosing'); $('#talk-who').textContent = who; $('#talk-text').textContent = q;
    list.innerHTML = options.map((o, i) => `<button type="button" data-i="${i}" class="${o.bye ? 'bye' : ''}"><kbd>${i + 1}</kbd>${o.label}</button>`).join('');
    list.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); this.pickChoice(+b.dataset.i); });
    this.markChoice(); audio.sfx('talk', 0.5);
  }
  markChoice() { $('#talk-choices').querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === this.choiceSel)); }
  pickChoice(i) {
    const c = this.choosing; if (!c || !c.options[i]) return;
    this.choosing = null; $('#talk').classList.remove('choosing'); $('#talk-choices').innerHTML = ''; $('#talk').hidden = true; this.talkClosedAt = performance.now();
    audio.sfx('confirm', 0.4); this.updateHud(); c.cb(i);
  }
  prologueFind() {
    state.prologue = 'found'; saveGame(this); this.updateHud();
    this.talk([['나', '이게 뭐지? 모래시계가 빛나고 있어…'], ['???', '…들리나요? 100년 뒤에서 보내는 신호예요. 버튼을 눌러 주세요!']], () => this.timeTravel());
  }
  prologueMeet() {
    if (state.rpg?.mode !== 'rpg') {
      state.prologue = 'met'; saveGame(this); this.updateHud();
      return this.talk([['로미', '반가워요! 저는 2126년 햇살마을의 관리 로봇 로미예요.'], ['로미', '여기는 100년 뒤 같은 자리예요. 여름이 너무 뜨겁고, 큰비가 오면 길이 잠겨요.'],
               ['로미', '2026년에 사는 당신이 마을을 바꾸면 이 미래도 달라질 수 있어요. 시간여행으로 돌아가 볼래요?']]);
    }
    // 로미가 '저기 아이가 있어요'라고 말하기 전에 하늘이를 먼저 세움(말과 화면이 맞게). 주인공이 그 자리에 서 있으면 한 걸음 비켜 줌
    state.prologue = 'done'; this.rpgSync(); this.build(); saveGame(this);
    const h = this.vis.haneul; if (h?.sprite.visible && Math.hypot(this.player.x - h.x, this.player.y - h.y) < 40) this.player.setPosition(h.x + 60, h.y + 40);
    this.ensureFree(); this.updateHud();
    this.talk([['로미', '반가워요! 저는 2126년 햇살마을의 관리 로봇 로미예요. 여기는 100년 뒤 같은 자리예요.'], ['로미', '여름이 너무 뜨거워서 이 마을 아이들은 학교에 못 오는 날이 많아요.'],
               ['로미', '저기 학교 문 앞에 아이가 있어요(머리 위에 이름표). 가까이 가서 E를 눌러 말을 걸어 봐요!']], () => this.updateHud());
  }
  // ---------- 상호작용 ----------
  interact() {
    if (this.traveling || this.timelapsing || this.cinematic) return;
    const it = this.interactable(); if (!it) return;
    if (it.id === 'clock') {
      if (state.prologue === 'start') return this.prologueFind();
      if (this.rpgOn() && state.year === 2126 && state.rpg.ch === 3) return this.openChrono();      // 3장: 백년시계 시간 창(시대 기록 정렬)
      if (this.rpgOn() && state.year === 2126 && state.rpg.ch >= 4) return this.playEnding();       // 엔딩
      return toast(state.year === 2126 ? '로미: "시계는 언제든 ⏳ 버튼(T)으로 쓸 수 있어요."' : '백년시계가 조용히 빛나고 있어요. ⏳ 버튼(T)을 누르면 100년 뒤로 가요.');
    }
    if (it.id === 'rpg') return this.rpgInteract(it.t);
    if (it.id.startsWith('ch3')) return this.ch3Record(it.place);
    if (it.id === 'board') return state.year === 2026 ? openPlanner() : showInfo(this);
    if (it.id === 'pharm' || it.id === 'granny') this[it.id].greet(this.player.x, this.player.y);   // 주인공을 보고 손 인사
    if (it.id === 'pharm') {
      if (state.year === 2126 && state.weather === 'rain') return this.startDelivery();
      return this.talk([['약국 사장님', state.year === 2126 ? '비가 많이 오는 날(⛈ 버튼)에 도와줄 일이 있단다.' : '요즘은 소나기가 한꺼번에 쏟아지더구나.']]);
    }
    if (it.id === 'granny') {
      if (state.year === 2126 && state.weather === 'heat') { toast('할머니: "얘야, 학교 정문 쉼터까지 같이 가 주겠니? 너무 더우면 그늘에서 쉬어야 해."'); return this.startMission(); }
      return this.talk([['할머니', state.year === 2026 ? '요즘 여름이 점점 더워지는 것 같아.' : '오늘은 비가 엄청 오는구나.']]);
    }
    if (it.id === 'romi' && this.rpgOn() && !state.rpg.flags.ch1done) return this.romiMenu();
    if (it.id === 'romi') return this.talk([['로미', state.ch3.phase === 'explore' ? '아무도 돌보지 않은 100년 뒤예요. 가로수 길, 빗물 시설, 안내판을 조사해 봐요.'
      : '같은 날씨라도 마을을 어떻게 가꾸느냐에 따라 미래가 달라져요. 할머니와 약국 사장님을 만나 봐요.']]);
  }
  // ---------- Ch1 폭염 동행(rules.json 그대로, 속도만 아트 단위 환산) ----------
  startMission() {
    this.escortNpc = this.granny; this.escortGoal = null;           // 이전 방식(할머니 → 학교 쉼터)
    const m = state.mission; m.active = true; m.gauge = 0; m.lastShade = null; m.fails = 0; m.t0 = this.time.now;
    $('#gauge').hidden = false; this.updateHud(); this.trail = [[this.granny.x, this.granny.y], [this.player.x, this.player.y]]; this.pathFor = null;
  }
  endMission(success) {
    const m = state.mission; m.active = false; $('#gauge').hidden = true;
    // 성공: 쉼터에서 주인공 곁에 서서 인사(다음 장면 조립 때 집 앞으로). 실패: 집에서 쉬러 돌아감.
    if (success) this.granny.place(this.granny.x, this.granny.y).greet(this.player.x, this.player.y, 1200); else this.granny.place(...this.spot('granny'), 'left');
    const k = heatKey(state.c1, state.c3); m.done.push({ key: k, success, gauge: Math.round(m.gauge) }); state.prog.ch1 = true;
    audio.sfx(success ? 'jingle_win' : 'jingle_hmm');
    if (!success) this.pendingTip = state.c1.streetTrees ? (state.c3 && !state.c3.treeCare ? '심은 나무를 돌보지 않아 그늘이 사라졌어요. 3장에서 "나무 돌봄" 약속을 알아봐요.' : '그늘이 조금 모자랐어요. 운동장 숲도 함께 만들면 어떨까요?')
      : '걷는 길에 그늘이 하나도 없었어요. 2026년 게시판에서 가로수를 심으면 달라질까요?';
    this.updateHud(); showResult(this, k, success); saveGame(this);
  }
  tickMission(dt) {
    const m = state.mission, R = this.rules.heat;
    const hm = this.hmAtPx(this.player.x, this.player.y) ?? 0;
    const kind = hm < R.hotHM ? 'hot' : hm >= R.shadeHM ? 'shade' : 'neutral';
    m.gauge = Math.max(0, m.gauge + R.gaugePerSec[kind] * escortPace() * dt / 1000);
    if (kind === 'shade') m.lastShade = [this.player.x, this.player.y];
    $('#gauge-fill').style.width = Math.min(100, m.gauge) + '%'; $('#gauge-fill').dataset.kind = kind;
    $('#gauge-txt').textContent = kind === 'shade' ? '그늘 — 시원해요' : kind === 'hot' ? '뙤약볕 — 더워요' : '조금 더워요';
    this.followGranny(dt);
    if (m.gauge >= 100 && state.rpg?.escort) return this.endEscort(false);     // 1장: 지치면 쉼터로 돌아감(실패 이유를 단서로)
    if (m.gauge >= 100) {
      const [rx, ry] = m.lastShade ?? this.spot('granny');
      toast(m.lastShade ? '너무 더워요! 마지막 그늘에서 잠깐 쉬었다 가요.' : '너무 더워요! 그늘이 없어 집에서 쉬었다 다시 출발해요.');
      this.player.setPosition(rx, ry);
      const [gx, gy] = [[34, 14], [-34, 14], [34, -14], [-34, -14], [0, 30]].map(([dx, dy]) => [rx + dx, ry + dy]).find(([x, y]) => this.zm.isFree(x, y, this.extraBlocked)) ?? [rx + 34, ry];
      this.granny.place(gx, gy, gx > rx ? 'left' : 'right'); this.trail = [[gx, gy], [rx, ry]]; m.gauge = R.failRestartGauge; m.fails = (m.fails || 0) + 1;
      this.touchTarget = null;
      if (m.fails >= 3) this.endMission(false);
    }
    if (state.rpg?.escort) { const [ex, ey] = this.escortGoal; if (Math.hypot(this.player.x - ex, this.player.y - ey) < 50) this.endEscort(true); return; }
    const [gx, gy] = this.spot('heatGoal'); if (Math.hypot(this.player.x - gx, this.player.y - gy) < 40) this.endMission(true);
  }
  // 할머니는 주인공이 실제로 지나간 길(2px 간격 기록)을 따라 FOLLOW px 뒤에서 걷는다(주인공이 지난 길이라 장애물 회피 유지).
  // 속도는 동행 속도(rules.escortSpeed 환산)의 1.15배 이내 — 주인공이 멈추면 거리만큼 다가온 뒤 함께 멈춘다.
  followGranny(dt) {
    const T = this.trail, p = this.player, g = this.escortNpc ?? this.granny, FOLLOW = 40;
    const last = T[T.length - 1]; if (!last || Math.hypot(p.x - last[0], p.y - last[1]) >= 2) T.push([p.x, p.y]);
    let len = 0, ax = g.x, ay = g.y; for (const [tx, ty] of T) { len += Math.hypot(tx - ax, ty - ay); ax = tx; ay = ty; }
    // 멈춤 판정 이력: 간격이 6px 넘게 벌어지면 걷기 시작, 0.5px 안으로 좁혀지면 멈춤(제자리 미세 이동 방지)
    // 주인공이 움직이는 동안은 간격을 좁혀도 계속 걷고(멈칫거림 방지), 주인공이 멈춘 뒤 간격에 닿으면 멈춤
    const pm = Math.hypot(p.x - (this.lastP?.[0] ?? p.x), p.y - (this.lastP?.[1] ?? p.y)); this.lastP = [p.x, p.y];
    this.pStill = pm < 0.01 ? (this.pStill || 0) + dt : 0;
    const gap = len - FOLLOW; if (this.gWalk ? gap < 0.5 && this.pStill > 60 : gap > 6) this.gWalk = !this.gWalk;
    let budget = this.gWalk ? Math.min(gap, this.rules.heat.escortSpeed * escortPace() * this.zone.movement.artPerLogicalPx * 1.15 * dt / 1000) : 0, x = g.x, y = g.y;
    while (budget > 0 && T.length) {
      const [tx, ty] = T[0], d = Math.hypot(tx - x, ty - y);
      if (d <= budget) { x = tx; y = ty; budget -= d; T.shift(); } else { x += (tx - x) / d * budget; y += (ty - y) / d * budget; budget = 0; }
    }
    if (!T.length) T.push([p.x, p.y]);
    // 주인공이 되돌아와 직선거리가 간격보다 가까우면 멈추고, 지나온 길 기록을 지워 다음엔 주인공 쪽으로 곧장 따라감
    if (Math.hypot(p.x - g.x, p.y - g.y) < FOLLOW - 2) { x = g.x; y = g.y; T.length = 0; T.push([p.x, p.y]); this.gWalk = false; }
    g.update(x, y, dt); if (g.mode === 'idle') g.lookAt(p.x, p.y);
  }
  // ---------- Ch2 약 배달 ----------
  startDelivery() { const d = state.delivery; d.active = true; d.t = 0; $('#timer').hidden = false; this.updateHud(); toast('약국 사장님: "할머니 댁(빨간 지붕 집)에 약을 10초 안에 전해 주렴!"'); }
  endDelivery(success, reason) {
    const d = state.delivery; d.active = false; $('#timer').hidden = true;
    d.done.push({ key: swmmKey(state.c1, state.c2, state.c3), success, reason }); state.prog.ch2 = true;
    audio.sfx(success ? 'jingle_win' : 'jingle_hmm');
    if (!success) this.pendingTip = '길에 물이 깊게 고였어요. 2026년에 빗물정원이나 빗물 연못을 만들면 하수관이 버틸 수 있을까요?';
    if (success) this.granny.greet(this.player.x, this.player.y, 1200);
    this.updateHud(); showRainResult(this, success, reason); saveGame(this);
  }
  tickDelivery(dt) {
    const d = state.delivery, R = this.rules.rain; d.t += dt / 1000;
    $('#timer').textContent = `약 배달 ${Math.max(0, R.timeLimitSec - d.t).toFixed(1)}초`;
    const [gx, gy] = this.spot('deliveryGoal'); if (Math.hypot(this.player.x - gx, this.player.y - gy) < 40) return this.endDelivery(true);
    if (d.t > R.timeLimitSec) this.endDelivery(false, this.puddleLevel() === 'deep' ? 'deep' : 'late');
  }
  updateHud() {
    if (!this.timelapsing) { $('#year').textContent = state.year; document.body.dataset.year = state.year; }
    $('#btn-time').hidden = state.prologue === 'start';
    const f = state.year === 2126 && state.prologue === 'done', rpg = this.rpgOn(), ch1 = rpg && state.rpg.ch === 1;   // RPG: 날씨는 장이 정함, 보고서는 엔딩 뒤
    $('#btn-lens').hidden = !f || state.weather === 'rain' || this.region() !== 'A'; $('#btn-weather').hidden = !f || rpg; $('#btn-final').hidden = !f || (rpg && !state.ending); $('#btn-info').hidden = !f || ch1;
    $('#btn-quit2').hidden = !state.ending;
    $('#btn-weather').textContent = state.weather === 'rain' ? '☀ 폭염 때 모습 보기' : '⛈ 집중호우 때 모습 보기';
    if (state.rpg?.flags?.ch1done && !state.prog.ch1) state.prog.ch1 = true;   // 1장(RPG) 완료 → 기존 2·3장 흐름으로
    $('#goal').textContent = this.objective().goal; this.renderSteps?.();
    $('#btn-journal').hidden = !['explore', 'plan', 'verify', 'done'].includes(state.ch3.phase);
    this.renderInv?.();
    this.syncBgm();
  }
  // ---------- 매 프레임 ----------
  update(t, dt) {
    this.fps.frames.push(dt); if (this.fps.frames.length > 240) this.fps.frames.shift();
    this.animRain(dt);
    this.storyTick();
    if (this.titleOpen) { this.idle(); return; }
    this.rpgTick(dt);
    if ((!state.mission.active || this.escortNpc !== this.granny) && !patrolledG(this)) { this.granny.update(this.granny.x, this.granny.y, dt); if (this.nearObj(this.granny, 110)) this.granny.lookAt(this.player.x, this.player.y); }
    if (!patrolled0(this, this.pharm)) this.pharm.update(this.pharm.x, this.pharm.y, dt); if (this.nearObj(this.pharm, 110)) this.pharm.lookAt(this.player.x, this.player.y);
    const patrolled = new Set(Object.values(this.patrols ?? {}).map(p => p.vis));
    for (const k of NEW_NPCS) { const v = this.vis[k]; if (!v.sprite.visible || patrolled.has(v) || (state.mission.active && v === this.escortNpc)) continue; v.update(v.x, v.y, dt); if (this.nearObj(v, 110)) v.lookAt(this.player.x, this.player.y); }
    if (this.traveling || this.timelapsing || this.cinematic || this.choosing || this.mapCam || !$('#talk').hidden) { this.idle(); this.updateGuide(); return; }   // 대화 중엔 멈춤
    const k = this.keys; let vx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown), vy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
    if (vx || vy) { this.touchTarget = null; this.autoInteract = null; this.touchUI = false; }
    const M = this.zone.movement, p = this.player;
    const speed = (state.mission.active ? this.rules.heat.escortSpeed * escortPace() * M.artPerLogicalPx : M.walkSpeed) * (this.onPuddle() ? this.rules.rain.shallowSpeedFactor : 1);
    const sp = speed * dt / 1000;
    if (!vx && !vy && this.touchTarget) {
      const tt = this.touchTarget;
      if (this.pathFor !== tt) { this.pathFor = tt; this.path = this.planPath(tt); if (!this.path) { this.touchTarget = null; this.autoInteract = null; } }
      const wp = this.path?.[0];
      if (wp) {
        const dx = wp[0] - p.x, dy = wp[1] - p.y, d = Math.hypot(dx, dy);
        if (d <= Math.max(3, sp)) { if (this.isFree(wp[0], wp[1])) p.setPosition(wp[0], wp[1]); this.path.shift(); if (!this.path.length) { this.touchTarget = null; this.arrived(); } }
        else { vx = dx / d; vy = dy / d; }
      }
    }
    if (vx || vy) {
      const n = Math.hypot(vx, vy), ux = vx / n * sp, uy = vy / n * sp; let moved = false;
      if (this.isFree(p.x + ux, p.y)) { p.x += ux; moved = true; }
      if (this.isFree(p.x, p.y + uy)) { p.y += uy; moved = true; }
      if (!moved && this.touchTarget) { this.touchTarget = null; this.autoInteract = null; }
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
      p.anims.play(`player_walk_${this.facing}`, true); p.anims.timeScale = Math.min(1.9, Math.max(0.7, speed / M.walkAnimRef));
      // 걷는 방향으로 카메라를 살짝 앞세움
      const L = { right: [-70, 0], left: [70, 0], down: [0, -40], up: [0, 40] }[this.facing];
      this.look.x += (L[0] - this.look.x) * 0.04; this.look.y += (L[1] - this.look.y) * 0.04;
    } else this.idle();
    // 카메라 추적을 프레임 시간에 맞춤: 고정 lerp(0.1/프레임)는 프레임이 길어지면 주인공이 화면에서 튀어 보임 → 1-(0.9)^(dt/16.7)
    if (!this.cinematic && !this.timelapsing) { const l = 1 - Math.pow(0.9, dt / 16.67); this.cameras.main.setLerp(l, l); }
    this.cameras.main.setFollowOffset(this.look.x, this.look.y);
    p.setDepth(Math.round(p.y) * 10 + 1); this.playerShadow.setPosition(p.x + 3, p.y);
    this.fadeOccluders(dt);
    this.followRomi(dt);
    if (state.mission.active) this.tickMission(dt);
    if (state.delivery.active) this.tickDelivery(dt);
    if (this.rpgDelivery) this.tickDeliveryB(dt);
    this.checkPortals();
    this.updateGuide();
  }
  // 주인공(머리~발)이 수관·지붕에 가려지면 그 물체를 0.45까지 서서히 투명하게, 벗어나면 되돌림
  fadeOccluders(dt) {
    const p = this.player, k = Math.min(1, dt / 120);
    for (const o of this.occluders ?? []) {
      if (!o.im.active) continue; const [x0, y0, x1, y1] = o.box;
      const hid = p.x > x0 && p.x < x1 && p.y < o.foot && p.y > y0 + 20 && p.y - PLAYER_H * 0.5 < y1;
      const a = hid ? 0.45 : 1; if (Math.abs(o.im.alpha - a) > 0.01) o.im.setAlpha(o.im.alpha + (a - o.im.alpha) * k);
    }
  }
  // 누른 곳까지 경로: 곧은 길이 비어 있으면 그대로, 아니면 16px 격자 A*(대상이 막힌 칸이면 가장 가까운 빈 칸)
  planPath(tt) {
    const free = (x, y) => this.isFree(x, y), p = this.player;
    if (lineFree(free, [p.x, p.y], [tt.x, tt.y])) return [[tt.x, tt.y]];
    return findPath(free, [p.x, p.y], [tt.x, tt.y], this.zone.canvas, 16);
  }
  arrived() { const id = this.autoInteract; this.autoInteract = null; if (id && this.interactable()?.id === id) this.interact(); }
  heatKeyNow() { return heatKey(state.c1, state.c3); }
  idle() { this.player.anims.play(`player_idle_${this.facing}`, true); this.player.anims.timeScale = 1; }
  followRomi(dt) {
    if (!this.romi.visible) return;
    const r = this.romi, p = this.player; const tx = p.x + (this.facing === 'left' ? 40 : -40), ty = p.y + 14;
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
    if (d > 26) {
      const v = Math.min(d, (d > 160 ? 260 : 120) * dt / 1000); r.x += dx / d * v; r.y += dy / d * v;
      this.romiFacing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      r.anims.play(`romi_move_${this.romiFacing}`, true);
    } else r.anims.play(`romi_idle_${this.romiFacing}`, true);
    r.setDepth(Math.round(r.y) * 10 + 1); this.romiShadow.setPosition(r.x, r.y - 1);
  }
  animRain(dt) {
    if (!this.rainTint.visible) return;
    const g = this.rainGfx.clear().lineStyle(1.5, 0xd8e8f5, 0.55), H = this.scale.height, W = this.scale.width;
    for (const d of this.drops) { d.y += d.v * dt / 1000; d.x -= 70 * dt / 1000; if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 60); } g.lineBetween(d.x, d.y, d.x + 3, d.y + 12); }
  }
}

Object.assign(SchoolFront.prototype, FlowMethods, RpgMethods, RegionMethods, ChapterMethods, MapMethods, TextbookMethods, EpilogueMethods);
addEventListener('touchstart', () => { if (SCENE) SCENE.touchUI = true; }, { passive: true });
// 게임 화면 크기: 기기 화면 비율에 맞춰 검은 여백 없이 채움(가로 화면은 높이 540 기준, 세로 화면은 너비 600 기준)
const fitSize = () => { const a = innerWidth / Math.max(1, innerHeight);
  return a >= 1 ? [Math.round(Math.min(1280, Math.max(720, 540 * a))), 540] : [600, Math.round(Math.min(1200, 600 / a))]; };
const [GW0, GH0] = fitSize();
addEventListener('resize', () => { const g = window.__phaser; if (!g) return; const [w, h] = fitSize(); if (w !== g.scale.width || h !== g.scale.height) g.scale.setGameSize(w, h); });
window.__phaser = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: GW0, height: GH0, backgroundColor: '#20302e', antialias: true, pixelArt: false, roundPixels: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, SchoolFront],
});
