// Codex로 교체할 이미지 등록부. game/assets/codex/index.json 의 files 에 올라간(검수 통과) 파일만 불러오고,
// 없으면 코드로 만든 임시 그림을 쓴다. id는 codex_manifest.json 의 asset_id 와 같다.
export const CODEX = {
  V07: { key: 'stump', file: 'tree_stump.png' },
  V04: { key: 'tree_mature', file: 'tree_zelkova_mature.png' },
  C02: { key: 'romi', file: 'romi_robot.png' },          // 임시: 코드로 그린 둥근 로봇(정지 1프레임)
  O01: { key: 'clock', file: 'obj_century_clock.png' },   // 임시: 코드로 그린 받침대+빛나는 모래시계
};

export function queueCodex(scene, index) {
  const have = new Set(index?.files || []); const loaded = new Set();
  for (const [id, v] of Object.entries(CODEX)) if (have.has(v.file)) { scene.load.image(v.key, 'assets/codex/' + v.file); loaded.add(id); }
  return loaded;
}

// 임시 그림(코드 생성) — Codex 파일이 등록되면 그쪽이 우선.
export function makePlaceholders(scene, loaded) {
  const g = scene.add.graphics();
  if (!loaded.has('V07')) { g.clear(); g.fillStyle(0x5b3a24).fillCircle(8, 9, 5); g.fillStyle(0xc89a62).fillCircle(8, 8, 4); g.lineStyle(1, 0x7a5232).strokeCircle(8, 8, 2); g.generateTexture('stump', 16, 16); }
  if (!loaded.has('C02')) { g.clear(); g.fillStyle(0x23404a).fillEllipse(8, 15, 10, 3); g.fillStyle(0x2b3a40).fillCircle(8, 7, 6); g.fillStyle(0xf2f6f5).fillCircle(8, 7, 5); g.fillStyle(0x2fb3a8).fillRoundedRect(5, 5, 6, 4, 1); g.fillStyle(0xffffff).fillRect(7, 6, 1, 1); g.lineStyle(1, 0x2b3a40).lineBetween(8, 1, 8, 2); g.fillStyle(0x2fb3a8).fillRect(7, 0, 2, 1); g.generateTexture('romi', 16, 16); }
  if (!loaded.has('O01')) { g.clear(); g.fillStyle(0x6b6f73).fillRect(3, 18, 10, 6); g.fillStyle(0x8c9094).fillRect(4, 17, 8, 2); g.fillStyle(0x3b2a1a).fillRect(4, 2, 8, 2).fillRect(4, 15, 8, 2); g.fillStyle(0xb88a3e).fillRect(5, 4, 1, 11).fillRect(10, 4, 1, 11); g.fillStyle(0x9fe8e0).fillTriangle(6, 5, 10, 5, 8, 9).fillTriangle(6, 14, 10, 14, 8, 10); g.fillStyle(0x2fb3a8).fillRect(7, 12, 2, 2); g.generateTexture('clock', 16, 24); }
  // 수관 그림자(부드러운 원) — 코드 효과, Codex 대상 아님
  g.clear(); for (let r = 16; r > 0; r--) g.fillStyle(0x0d2a1c, 0.06).fillCircle(16, 16, r); g.generateTexture('canopy', 32, 32);
  g.destroy();
}
