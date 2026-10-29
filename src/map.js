// 전체 지도(M 키·🗺️ 버튼): 지금 구역 전체를 두 번째 카메라로 축소해 보여 주고, 나·지금 갈 곳·주요 장소·사람·다른 구역 길을 표시한다.
// 게임 그림을 그대로 쓰므로 새 그림·새 규칙 없음. 지도가 열린 동안은 dialog[open]이라 이동·대화가 멈춘다.
import { state, $ } from './core.js';

const PLACES_A = [[324, 120, '🏫 학교'], [1412, 110, '🏠 빨간 지붕 집 (하늘이네)']];
const AROUND = { A: [1, 1], B: [2, 1], C: [1, 0], D: [0, 1] };      // 마을 안내도에서 구역 자리(가운데 = 학교 앞)

export const MapMethods = {
  toggleMap() { if (this.mapCam) this.closeMap(); else this.openMap(); },
  openMap() {
    if (this.mapCam || this.titleOpen || this.traveling || this.timelapsing || this.cinematic || !$('#talk').hidden || document.querySelector('dialog[open]')) return;
    const r = this.region(), [W, H] = r === 'A' ? this.zone.canvas : this.fg.regions[r].size;
    const GW = this.scale.width, GH = this.scale.height, top = 44, pad = 10;
    const z = Math.min((GW - pad * 2) / W, (GH - top - pad) / H), vw = W * z, vh = H * z, vx = (GW - vw) / 2, vy = top + (GH - top - pad - vh) / 2;
    this.mapShade = this.add.rectangle(0, 0, GW, GH, 0x0b0a18, 0.92).setOrigin(0).setScrollFactor(0).setDepth(1e6);
    const cam = this.cameras.add(vx, vy, vw, vh).setZoom(z).setBounds(0, 0, W, H);
    cam.centerOn(W / 2, H / 2);
    for (const o of this.children.list) if (o.scrollFactorX === 0) cam.ignore(o);   // 화면 고정 효과(비 그림 등)는 지도에 넣지 않음
    this.mapCam = cam; this.mapView = { vx, vy, z };
    this.idle?.(); this.touchTarget = null;
    document.body.classList.add('mapopen'); $('#mapdlg').show(); this.drawMapMarks(r);
  },
  closeMap() {
    if (!this.mapCam) return;
    this.cameras.remove(this.mapCam); this.mapCam = null; this.mapShade?.destroy(); this.mapShade = null;
    document.body.classList.remove('mapopen'); $('#mapdlg').close(); $('#map-marks').innerHTML = '';
  },
  drawMapMarks(r) {
    const rect = this.game.canvas.getBoundingClientRect(), s = rect.width / this.scale.width, { vx, vy, z } = this.mapView;
    const css = (x, y) => [Math.min(innerWidth - 120, Math.max(120, rect.left + (vx + x * z) * s)), rect.top + (vy + y * z) * s];   // 가장자리 이름표가 잘리지 않게
    const marks = [], add = (x, y, text, cls) => { const [l, t] = css(x, y); marks.push(`<div class="mk ${cls}" style="left:${l}px;top:${t}px"><span>${text}</span></div>`); };
    const names = this.regionsDef.names;
    if (r === 'A') { for (const [x, y, t] of PLACES_A) add(x, y, t, 'place'); add(...this.spot('clock'), '⏳ 백년시계', 'place'); }
    if (r === 'B' && this.regionsDef.B.delivery?.goal) { const [gx, gy] = this.regionsDef.B.delivery.goal; add(gx, gy - 150, '🏠 시장 끝 빨간 지붕 집', 'place'); }
    for (const p of this.regionsDef.portals[r] ?? []) add(p.at[0], p.at[1], `🚪 ${names[p.to]} 가는 길`, 'portal');
    for (const [id, v] of Object.entries(this.rpgNpcAt ?? {})) if (v?.sprite?.visible && this.ch.npcs[id]) add(v.x, v.y - v.height, this.ch.npcs[id].name, 'npc');
    // 지금 갈 곳: 다른 구역이면 그 구역으로 가는 길을 가리킴
    const ob = this.objective?.(); let goalRegion = null;
    if (ob?.target) {
      const pt = (this.regionsDef.portals[r] ?? []).find(p => p.at[0] === ob.target[0] && p.at[1] === ob.target[1]);
      goalRegion = pt?.to ?? r;
      add(ob.target[0], ob.target[1], pt ? `⭐ 여기로! (${names[pt.to]}에 갈 곳이 있어요)` : `⭐ 지금 갈 곳${ob.label ? ': ' + ob.label : ''}`, 'goal');
    }
    add(this.player.x, this.player.y, '🧒 나', 'me');
    $('#map-marks').innerHTML = marks.join('');
    $('#map-title').textContent = `🗺️ ${names[r]} 지도 ${state.year}년`;
    $('#map-goal').textContent = ob?.goal ? ob.goal.replace(/^▶\s*/, '') : '';
    // 마을 안내도: 네 구역의 자리, 지금 있는 곳·갈 곳 표시
    $('#map-mini').innerHTML = Object.entries(AROUND).map(([k, [c, row]]) =>
      `<div class="${k === r ? 'here' : ''} ${k === goalRegion && k !== r ? 'want' : ''}" style="grid-column:${c + 1};grid-row:${row + 1}">${names[k]}${k === r ? '<br>🧒' : k === goalRegion ? '<br>⭐' : ''}</div>`).join('');
  },
};
