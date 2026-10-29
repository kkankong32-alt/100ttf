// NPC 시각(할머니·약사): Codex npc-environment-v3-v1 4방향 걷기·대기 시트(행 down/left/right/up, 좌우 반전 없음).
// 게임 규칙(위치·충돌·미션 속도)은 main.js가 정하고, 여기서는 실제 이동량으로 방향·걷기/대기·발걸음 속도만 맞춘다.
export const NPC_DIRS = ['down', 'left', 'right', 'up'];
// 화면 크기(px): 세 사람 원화의 몸 높이는 프레임의 84/96로 같으므로 표시 높이 비율 = 키 비율.
// 주인공(초등 4학년) 66 기준 → 할머니(노년 성인) ×1.10, 약사(성인) ×1.24. 원본 프레임(96 px 사본)보다 작게 그려 흐려지지 않음.
// fullgame-art-v1 신규 8인: 성인 82, 윤서(노년) 73, 하늘 66 — Codex animation_metadata.displayHeight와 같음
export const NPC_SIZE = { granny: [48, 73], pharm: [55, 82], haneul: [44, 66], park: [55, 82], chorok: [55, 82], merchant: [55, 82], yunseo: [48, 73], pharmacist2126: [55, 82], merchant2126: [55, 82], caretaker2026: [55, 82] };
export const NPC_KEYS = Object.keys(NPC_SIZE);
const SHADOW = { granny: 'nv3_granny_shadow', pharm: 'nv3_pharm_shadow', haneul: 'shadow_player', yunseo: 'nv3_granny_shadow' };   // 나머지 성인 = 약사 그림자
// 걷기 15fps 시트에서 발이 미끄러지지 않는 기준 속도(px/s). Codex 메타데이터(표시 높이 60 px 기준 28·35)를 표시 크기에 비례해 환산.
// Codex 기준 속도(28·35 px/s, 표시 60 px) → 표시 크기 비례. 신규 시트도 같은 기준(animation_metadata.referenceSpeedPxSec)
const REF_SPEED = Object.fromEntries(Object.entries(NPC_SIZE).map(([k, [, h]]) => [k, (['granny', 'yunseo', 'haneul'].includes(k) ? 28 : 35) * h / 60]));
// 하늘이 v3 시트는 다리가 주인공 리그(같은 키 66px·15fps)라 발걸음 기준도 주인공과 같게(zone movement.walkAnimRef 60) — 30.8로 두면 다리가 두 배 빨라 종종걸음이 됨
REF_SPEED.haneul = 60;

export function registerNPCAnims(scene) {
  for (const who of NPC_KEYS) for (const mode of ['walk', 'idle']) NPC_DIRS.forEach((d, r) => {
    const key = `${who}_${mode}_${d}`; if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(`nv3_${who}_${mode}`, { start: r * 12, end: r * 12 + 11 }), frameRate: mode === 'walk' ? 15 : 8, repeat: -1 });
  });
}
// 방향: 수평·수직 중 뚜렷한 쪽(1.15배 이력)으로, 애매하면 이전 방향 유지
export function dirOf(vx, vy, prev = 'down') {
  if (Math.abs(vx) > Math.abs(vy) * 1.15) return vx < 0 ? 'left' : 'right';
  if (Math.abs(vy) > Math.abs(vx) * 1.15) return vy < 0 ? 'up' : 'down';
  return prev;
}

export class NPCVisual {
  constructor(scene, who, x, y, facing = 'down') {
    this.scene = scene; this.who = who; this.facing = facing; this.mode = 'idle'; this.still = 999; this.blend = 0; this.greetMs = 0; this.key = '';
    const [W, H] = this.size = NPC_SIZE[who];
    this.sprite = scene.add.sprite(x, y, `nv3_${who}_idle`, 0).setOrigin(0.5, 0.9375).setDisplaySize(W, H);
    this.ghost = scene.add.sprite(x, y, `nv3_${who}_idle`, 0).setOrigin(0.5, 0.9375).setDisplaySize(W, H).setVisible(false);
    this.shadow = scene.add.image(x, y, SHADOW[who] ?? 'nv3_pharm_shadow').setOrigin(0.5, 0.5).setDisplaySize(W, W / 4).setDepth(10);
    this.hasGreet = scene.textures.exists(`nv3_${who}_greet`);
    this.px = x; this.py = y; this.speed = 0; this.place(x, y); this.play();
  }
  get x() { return this.px; } get y() { return this.py; }
  get height() { return this.size[1]; }
  // 순간 이동(장면 재조립·쉼터에서 쉬기 등): 걷기 애니메이션 없이 대기
  place(x, y, facing) { this.px = x; this.py = y; this.speed = 0; this.still = 999; if (facing) this.facing = facing; this.mode = 'idle'; this.sync(); this.play(); return this; }
  // 매 프레임 실제 위치로: 이동량 → 속도·방향·걷기/대기
  update(x, y, dt) {
    const vx = (x - this.px) * 1000 / Math.max(dt, 1), vy = (y - this.py) * 1000 / Math.max(dt, 1), sp = Math.hypot(vx, vy);
    this.px = x; this.py = y; this.speed = this.speed * 0.8 + sp * 0.2;   // 프레임 간 흔들림을 줄인 이동 속도(발걸음 재생 속도용)
    // 걷기 시작하면 인사 포즈 즉시 해제
    if (sp > 3) { this.still = 0; this.greetMs = 0; this.facing = dirOf(vx, vy, this.facing); this.mode = 'walk'; } else { this.still += dt; if (this.still > 100) this.mode = 'idle'; }
    this.greetMs = Math.max(0, this.greetMs - dt);
    this.play(); this.sync(dt);
  }
  // 멈춰 있을 때 상대(주인공)를 바라봄
  lookAt(tx, ty) { if (this.mode !== 'idle' || this.greetMs > 0) return; const d = dirOf(tx - this.px, ty - this.py, this.facing); if (d !== this.facing) { this.facing = d; this.play(); } }
  // 인사: 주인공 쪽으로 돌아선다. 손 인사 원화는 정면(아래) 1장뿐이라, 정면을 볼 때만 손 인사 포즈를 쓰고 옆·뒤를 볼 때는 그 방향 대기 동작을 유지.
  greet(tx, ty, ms = 900) {
    if (tx !== undefined) this.facing = dirOf(tx - this.px, ty - this.py, this.facing);
    this.greetMs = this.facing === 'down' && this.hasGreet ? ms : 0; this.mode = 'idle'; this.play();
  }
  play() {
    const [W, H] = this.size;
    if (this.greetMs > 0) { if (this.key !== 'greet') { this.fadeFrom(); this.sprite.anims.stop(); this.sprite.setTexture(`nv3_${this.who}_greet`).setDisplaySize(W, H); this.key = 'greet'; } return; }
    const key = `${this.who}_${this.mode}_${this.facing}`;
    if (key !== this.key) { const wasGreet = this.key === 'greet'; this.fadeFrom(); this.sprite.play(key); if (wasGreet) this.sprite.setDisplaySize(W, H); this.key = key; }
    // 발걸음 재생 속도 = 실제 이동 속도 / 기준 속도(0.6–1.8배)
    this.sprite.anims.timeScale = this.mode === 'walk' ? Math.min(1.8, Math.max(0.6, this.speed / REF_SPEED[this.who])) : 1;
  }
  fadeFrom() { if (!this.sprite.frame) return; this.ghost.setTexture(this.sprite.texture.key, this.sprite.frame.name).setDisplaySize(...this.size).setVisible(this.sprite.visible); this.blend = 100; }
  sync(dt = 0) {
    this.blend = Math.max(0, this.blend - dt); const a = this.blend / 100, d = Math.round(this.py) * 10 + 1;
    this.sprite.setPosition(this.px, this.py).setDepth(d).setAlpha(1 - a * 0.999);
    this.ghost.setPosition(this.px, this.py).setDepth(d + 0.5).setAlpha(a).setVisible(a > 0 && this.sprite.visible);
    this.shadow.setPosition(this.px + 3, this.py);                   // 광원(왼쪽 위) 쪽으로 살짝
  }
  setVisible(v) { this.sprite.setVisible(v); this.shadow.setVisible(v); if (!v) this.ghost.setVisible(false); return this; }
  get refSpeed() { return REF_SPEED[this.who]; }
  get anim() { return { key: this.key, facing: this.facing, mode: this.mode, speed: this.speed, timeScale: this.sprite.anims.timeScale, frame: this.sprite.frame?.name, displayH: this.sprite.displayHeight, displayW: this.sprite.displayWidth }; }
}
