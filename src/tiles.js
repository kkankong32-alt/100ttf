// 토지피복 → Kenney RPG Urban Pack(CC0) 타일 번호. (16 px, packed 27열)
// placeholder: true 인 항목은 전용 에셋이 없어 임시로 대체한 것 → ASSET_MANIFEST.md의 Codex 생성 목록과 대응.
export const SET = {
  grass: [0, 1, 2, 27, 28, 29, 54, 55, 56],
  concrete: [8, 9, 10, 35, 36, 37, 62, 63, 64],
  sand: [81, 82, 83, 108, 109, 110, 135, 136, 137],
  slate: [89, 90, 91, 116, 117, 118, 143, 144, 145],
  water: [170, 171, 172, 197, 198, 199, 224, 225, 226],
};
export const ASPHALT = 406, CROSSWALK = 435, PARKING_P = 442;
// 피복 코드 → { group: 같은 경계로 묶을 그룹, set, tint, placeholder }
export const LULC_STYLE = {
  1: { group: 'green', set: 'grass' },                  // 숲 바닥(나무는 객체)
  2: { group: 'green', set: 'grass' },
  3: { group: 'asphalt' },
  4: { group: 'walk', set: 'concrete' },
  5: { group: 'roof' },                                 // 건물은 객체로 그림
  6: { group: 'asphalt' },
  7: { group: 'green', set: 'grass' },
  8: { group: 'market', set: 'slate' },
  9: { group: 'perm', set: 'slate', tint: 0xb8e0c0, placeholder: 'permeable_pavers' },
  10: { group: 'lot', set: 'sand', tint: 0xd8b48c, placeholder: 'dirt_lot' },
  11: { group: 'asphalt' },
  12: { group: 'water', set: 'water' },
  13: { group: 'green', set: 'grass' },
  14: { group: 'walk', set: 'concrete' },
  15: { group: 'walk', set: 'concrete', tint: 0xfff6e8, placeholder: 'cool_pavement' },
  16: { group: 'green', set: 'grass', tint: 0x9fd6a8, placeholder: 'rain_garden' },
  17: { group: 'basin', set: 'grass', tint: 0x7fb59a, placeholder: 'detention_basin' },
};
export const TREE = { big: [232, 259], mid: [233, 260], young: [292, 292], conifer: [237, 264], forest: [[235, 236], [262, 263], [289, 290]] };
export const CHAR = { // [idle, walk1, walk2]
  hero: { down: [24, 51, 78], up: [25, 52, 79], left: [23, 50, 77] },
  granny: { down: [186, 213, 240], up: [187, 214, 241], left: [185, 212, 239] },
  worker: { down: [267, 294, 321], up: [268, 295, 322], left: [266, 293, 320] },
};
export const FACADE = { red: { wall: 72, trim: 45 }, orange: { wall: 180, trim: 153 } };
export const WINDOW = [336, 363, 417], DOOR = [283, 284, 312];
export const CARS = [[420, 421, 447, 448], [422, 423, 449, 450], [426, 427, 453, 454]];

export function autotile(set, n, s, w, e) {
  const row = !n ? 0 : (!s ? 2 : 1), col = !w ? 0 : (!e ? 2 : 1);
  return SET[set][(n || s ? row : 1) * 3 + (w || e ? col : 1)];
}
