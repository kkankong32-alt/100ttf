// 학교 앞 구역 런타임 에셋 등록부(Codex 승인 패키지 참조, 원본 수정 없음).
// 원점은 실제 알파 경계에서 잰 발밑 값(tests/sf_assets.test.mjs가 파일 존재·크기 검사).
const SF = 'assets/codex/schoolfront-pack-v1/', CV = 'assets/codex/choice-variants-animation-v1/', RT = 'assets/runtime/';

export const IMAGES = {
  bg: RT + 'schoolfront_bg_v1.jpg',                        // 원본 schoolfront_2026_bg_v1.png(2026·2126 공통, 불투명)의 JPG q92 사본: 3.4→0.54 MB
  grass_repeat: SF + 'ground_grass_v1_repeat.png',
  puddle: SF + 'ground_shallow_puddle_v1.png',
  permeable: RT + 'permeable_market_v1_crop.png',
  permeable_clogged: RT + 'permeable_market_clogged_v1_crop.png',
  gate: SF + 'school_gate_module_v1.png',
  board: SF + 'planning_board_v1.png',
  clock: SF + 'century_clock_v1.png',
  drain: SF + 'storm_drain_v1.png',
  drain_clogged: CV + 'drain_clogged_v1.png',
  garden: SF + 'rain_garden_module_v1.png',
  garden_neglected: CV + 'rain_garden_neglected_v1.png',
  pergola_mg: SF + 'shade_pergola_v1_mg.png', pergola_fg: SF + 'shade_pergola_v1_fg.png',
  basin_parking: CV + 'basin_absent_parking_v1.png', basin_dry: CV + 'basin_dry_v1.png', basin_wet: CV + 'basin_wet_illustrative_v1.png', basin_sediment: CV + 'basin_sediment_v1.png',
  granny: SF + 'npc_grandmother_candidate_v1.png', pharm: SF + 'npc_pharmacist_candidate_v1.png',
  shadow_player: CV + 'player_ground_shadow_v1.png', shadow_romi: CV + 'romi_ground_shadow_v1.png',
  watering_bag: CV + 'watering_bag_v1.png', watering_bag_shadow: CV + 'watering_bag_shadow_v1.png',
  planting_empty: CV + 'planting_empty_v1.png',
  stump: CV + 'tree_stump_v1.png', stump_shadow: CV + 'tree_stump_shadow_v1.png',
};
for (const era of ['2026', '2126']) for (const b of ['school_facade', 'shop', 'house']) for (const part of ['mg', 'fg', 'shadow']) IMAGES[`${b}_${era}_${part}`] = `${SF}${b}_${era}_v1_${part}.png`;
// 나무 단계: [파일 접두, 원본 크기, 발밑 원점]
export const TREE_STAGES = {
  staked: { pre: SF + 'tree_replacement_staked_v1', size: [160, 224], origin: [0.52, 0.969] },
  young: { pre: SF + 'tree_zelkova_young_v1', size: [192, 256], origin: [0.504, 0.969] },
  mid: { pre: SF + 'tree_zelkova_mid_v1', size: [256, 320], origin: [0.517, 0.975] },
  mature: { pre: SF + 'tree_zelkova_mature_v1', size: [384, 448], origin: [0.492, 0.984] },
  dead: { pre: CV + 'tree_dead', size: [384, 448], origin: [0.49, 0.98], suffix: '_v1' },
};
for (const [k, s] of Object.entries(TREE_STAGES)) for (const part of ['mg', 'fg', 'shadow']) IMAGES[`tree_${k}_${part}`] = s.suffix ? `${s.pre}_${part}${s.suffix}.png` : `${s.pre}_${part}.png`;
export const SHEETS = {
  player_walk: { path: CV + 'player_walk_sheet_v1.png', frameWidth: 128, frameHeight: 192 },
  player_idle: { path: CV + 'player_idle_sheet_v1.png', frameWidth: 128, frameHeight: 192 },
  romi_move: { path: CV + 'romi_move_sheet_v1.png', frameWidth: 128, frameHeight: 128 },
  romi_idle: { path: CV + 'romi_idle_sheet_v1.png', frameWidth: 128, frameHeight: 128 },
};
// 행 순서 down,left,right,up (좌우 별도 원화, flipX 없음)
export const DIRS = ['down', 'left', 'right', 'up'];
export const ORIGIN = { player: [0.5, 0.9375], romi: [0.5, 0.92], board: [0.497, 0.969], clock: [0.44, 0.973], granny: [0.44, 0.964], pharm: [0.566, 0.964],
  stump: [0.52, 0.93], planting_empty: [0.49, 0.906], watering_bag: [0.536, 0.953] };
// 건물·고정물 배치(scene_layout.json 좌상단 x,y·표시 크기, depth_anchor_y)
export const BUILDINGS = [
  { key: 'school_facade', x: 24, y: 16, w: 600, h: 350, anchor: 366, shadow: [38, 338, 600, 48] },
  { key: 'shop', x: 1016, y: 32, w: 224, h: 314, anchor: 346, shadow: [1030, 318, 224, 48] },
  { key: 'house', x: 1300, y: 40, w: 224, h: 314, anchor: 354, shadow: [1314, 326, 224, 48] },
];
export const GATE = { x: 344, y: 482, w: 280, h: 158, anchor: 640 };
export const PERGOLA = { x: 350, y: 406, w: 256, h: 192, anchor: 598 };

// ---- Codex century-change-v1(100년 공통 세월 변화·수목 지면 접합) — 원본 수정 없음, 배치값은 패키지 매니페스트에서 읽음 ----
const CC = 'assets/codex/century-change-v1/';
export const CC_MANIFEST = CC + 'century_change_manifest_v1.json';
for (const [b, eras] of [['school_facade', [2046, 2086, 2126]], ['shop', [2046, 2126]], ['house', [2046, 2086, 2126]]])
  for (const e of eras) for (const part of ['mg', 'fg']) IMAGES[`cc_${b}_${e}_${part}`] = `${CC}${b}_${e}_century_v1_${part}.png`;
for (const k of ['tree_pit_flush', 'tree_pit_flush_lip', 'tree_mulch_lawn', 'tree_fallen', 'information_post_2126', 'street_renewal_2126_overlay'])
  IMAGES[`cc_${k}`] = `${CC}${k}_v1.png`;
for (const s of ['staked', 'young', 'mid', 'mature', 'dead']) IMAGES[`cc_shadow_${s}`] = `${CC}tree_${s}_registered_shadow_v1.png`;
// 2126 차도 재포장 오버레이: 원본 PNG(2.7 MB)의 WebP 사본(알파 무손실, RGB 평균 오차 2/255, 74 KB)
IMAGES.cc_street_renewal_2126_overlay = RT + 'street_renewal_2126_overlay_v1.webp';

// ---- Codex npc-environment-v3-v1(NPC 4방향 애니메이션·운동장 녹화·저지대·물고임·보식·UI·시간여행 효과) — 원본 수정 없음 ----
const NV = 'assets/codex/npc-environment-v3-v1/';
for (const who of ['granny', 'pharm']) {
  for (const mode of ['walk', 'idle']) SHEETS[`nv3_${who}_${mode}`] = { path: `${NV}${who}_${mode}_sheet_v1.png`, frameWidth: 128, frameHeight: 192 };
  IMAGES[`nv3_${who}_greet`] = `${NV}${who}_greet_v1.png`; IMAGES[`nv3_${who}_shadow`] = `${NV}${who}_shadow_v1.png`;
}
SHEETS.nv3_ripple = { path: NV + 'rain_ripple_sheet_v1.png', frameWidth: 64, frameHeight: 32 };
SHEETS.nv3_ring = { path: NV + 'century_ring_expand_sheet_v1.png', frameWidth: 512, frameHeight: 512 };
for (const k of ['schoolyard_green_2026', 'schoolyard_green_2046', 'puddle_shallow_vertical', 'puddle_deep_vertical', 'puddle_deep_pool', 'tree_replant_event', 'century_screen_border'])
  IMAGES[`nv3_${k}`] = `${NV}${k}_v1.png`;
IMAGES.nv3_lowland = RT + 'lowland_base_2026_v1.jpg';           // 불투명 PNG(1.0 MB)의 JPG q90 사본
IMAGES.nv3_wet_paving = RT + 'wet_paving_overlay_v1.webp';      // 3.0 MB PNG의 WebP 사본(알파 무손실)
// HTML UI(CSS)에서 쓰는 이미지(로더 대상 아님)
export const UI_IMG = { arrow: NV + 'goal_arrow_badge_v1.png', tail: NV + 'goal_tail_v1.png', inspect: NV + 'inspect_icon_v1.png', talk: NV + 'talk_icon_v1.png', button: NV + 'button_9slice_v1.png' };
// v3 이후 쓰지 않는 이전 임시 표현은 내려받지 않음(파일은 보존): 정지 NPC 원화, 반복 잔디, 자동 물웅덩이 재질, 미사용 그림자·빈 구덩이
for (const k of ['granny', 'pharm', 'grass_repeat', 'puddle', 'stump_shadow', 'planting_empty', 'watering_bag_shadow']) delete IMAGES[k];
// 캐릭터 시트 런타임 사본: 프레임별로 1/2 축소(128×192 → 64×96, 로미 128×128 → 64×64). 화면 표시(40–44 px 폭)보다 커서 화질 손실 없이
// 내려받기 3.1 MB → 1.1 MB, GPU 텍스처 약 38 MB → 9.5 MB(학교 PC용). 원본 시트는 보존.
for (const k of ['player_walk', 'player_idle', 'romi_move', 'romi_idle', 'nv3_granny_walk', 'nv3_granny_idle', 'nv3_pharm_walk', 'nv3_pharm_idle']) {
  const s = SHEETS[k]; s.path = RT + s.path.split('/').pop().replace('.png', '_half.png'); s.frameWidth /= 2; s.frameHeight /= 2;
}
SHEETS.nv3_ring.path = RT + 'century_ring_expand_sheet_v1.webp';          // 815 KB → 252 KB(알파 무손실 WebP)
IMAGES.nv3_century_screen_border = RT + 'century_screen_border_v1.webp';

// Codex fullgame-art-v1 신규 8인(정식 원화, 4방향 걷기·대기): 런타임 1/2 사본(tools/make_runtime_fullgame.py). 세션 7 색 변형본은 더 이상 내려받지 않음(파일 보존)
// 2126년 공통 세월 변화 소품(Topview GPT Image 2, tools/cut_props2126.py) — 배치는 data/regions.json future
for (const k of ['market_stall', 'solar_lamp', 'shuttle_stop', 'bike_dock', 'ev_charger', 'planter_bench', 'forest_shelter', 'trail_sign', 'birdhouse', 'rain_barrel', 'weed_patch', 'ev_car']) IMAGES[`fut2126_${k}`] = `${RT}fut2126_${k}.png`;
export const NEW_NPCS = ['haneul', 'park', 'chorok', 'merchant', 'yunseo', 'pharmacist2126', 'merchant2126', 'caretaker2026'];
for (const who of NEW_NPCS) for (const mode of ['walk', 'idle']) SHEETS[`nv3_${who}_${mode}`] = { path: `${RT}fg_${who}_${mode}_half.png`, frameWidth: 64, frameHeight: 96 };
// 하늘이 v3(세션 10): 하늘이 원화 윗몸 + 주인공 리그 다리(tools/make_haneul_from_player.py). v1(다리 끌림)·v2(AI 칸별 재작화, 머리 떨림) 파일은 보존
for (const mode of ['walk', 'idle']) SHEETS[`nv3_haneul_${mode}`].path = `${RT}fg_haneul_${mode}_v3_half.png`;
