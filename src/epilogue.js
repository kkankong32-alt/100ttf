// 엔딩 에필로그: 결과 보고서 전에 '100년 뒤에서 온 편지'와 엔딩 이름을 보여 준다.
// 편지 문장은 고른 선택(그늘·빗물·숲)에 따라 바뀌고, 과학 계산 값은 쓰지 않는다(값은 보고서에서만).
import { state, $ } from './core.js';
import { audio } from './audio.js';

// 네 가지 엔딩: 100년 동안 이어진 것(그늘·빗물·숲)이 몇 가지인지로 정함
export const ENDINGS = [
  { id: 'e0', icon: '⏳', name: '아직 기다리는 마을', say: '100년이 지나도 마을은 아직 더위와 큰비를 버티고 있어요. 하지만 미래는 정해지지 않았어요.' },
  { id: 'e1', icon: '🌱', name: '이제 막 시작된 마을', say: '한 가지가 100년을 이어 왔어요. 작은 선택 하나가 마을의 한 부분을 바꿨어요.' },
  { id: 'e2', icon: '🌿', name: '함께 자라는 마을', say: '두 가지가 100년을 이어 왔어요. 사람들이 서로 이어받은 덕분이에요.' },
  { id: 'e3', icon: '🌈', name: '100년을 이은 마을', say: '그늘도, 빗물 길도, 숲도 100년을 이어 왔어요. 심고, 만들고, 돌보는 일이 끊기지 않았어요.' },
];
const KEY = 'ttf.endings.v1';
export const kept = (c1, c2, c3) => ({
  shade: !!(c1.streetTrees && c3.treeCare),
  water: !!(c2.basin || ((c2.permeable || c2.rainGarden) && c3.facilityCare)),
  forest: c1.forest !== 'parking' && !!c3.forestLaw,
});
export const endingOf = k => ENDINGS[(k.shade ? 1 : 0) + (k.water ? 1 : 0) + (k.forest ? 1 : 0)];
export const foundEndings = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const remember = id => { const f = foundEndings(); if (!f.includes(id)) { f.push(id); try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { } } return f; };

// 하늘이가 100년 전의 나에게 쓰는 편지(선택마다 한 줄씩)
export function letterLines(c1, c2, c3) {
  const k = kept(c1, c2, c3), L = [];
  if (k.shade) L.push('오늘도 나무 그늘 아래로 걸어서 집에 왔어. 할머니가 그러는데, 이 나무들은 100년 동안 누군가가 계속 돌보고 다시 심어 온 거래.');
  else if (c1.streetTrees) L.push('학교 앞에는 빈 나무 자리가 많아. 누군가 계속 돌봤다면 지금쯤 그늘이 있었을까, 가끔 생각해.');
  else if (c1.coolPave) L.push('등굣길 바닥은 밝은 색이라 덜 뜨거워. 그래도 그늘이 없어서 여름엔 모자를 꼭 써.');
  else L.push('등굣길은 아직 그늘이 없어서 여름엔 모자를 꼭 써.');
  if (k.water) L.push('큰비가 오는 날에도 시장길 약국에 갈 수 있어. 빗물이 갈 곳이 마련되어 있거든.');
  else if (c2.permeable || c2.rainGarden) L.push('큰비가 오면 시장길에 물이 고여. 누군가 빗물 시설을 계속 청소해 주면 좋겠어.');
  else L.push('큰비가 오는 날엔 시장길에 물이 많이 고여서 다들 집에 있어.');
  if (k.forest) L.push('주말엔 뒷산 숲길에서 새소리를 들어. 마을 사람들이 규칙을 정해서 숲을 지켜 왔대.');
  else if (c1.forest === 'parking') L.push('뒷산은 주차장이 됐어. 숲이 어땠는지는 사진으로만 봤어.');
  else L.push('뒷산 숲은 절반만 남았어. 남은 숲은 이제 우리가 지키고 있어.');
  return L;
}

export const EpilogueMethods = {
  // done: 에필로그가 끝나면 부를 함수(보고서 열기)
  playEpilogue(c1, c2, c3, done) {
    const el = $('#epilogue'), k = kept(c1, c2, c3), E = endingOf(k), found = remember(E.id);
    const hello = '100년 뒤의 하늘이가 너에게 편지를 보냈어요.';
    const pages = [
      `<p class="ep-place">2126년 여름, 학교 앞</p><p class="ep-line">${hello}</p>`,
      `<div class="ep-letter"><h3>100년 전의 너에게</h3>${letterLines(c1, c2, c3).map(t => `<p>${t}</p>`).join('')}
        <p>여름은 지금도 더워. 폭염이 더 심해지지 않게 하는 건 온 세상 사람들이 함께 생활을 바꿔야 하는 일이래. 너도 같이 해 줄래?</p>
        <p>네가 2026년에 한 선택이, 지금 내가 걷는 길이 됐어. 고마워.</p><p class="sign">— 2126년, 하늘이가</p></div>`,
      `<div class="ep-end"><small>${ENDINGS.length}가지 엔딩 중 하나</small><b>${E.icon} ${E.name}</b><p>${E.say}</p>
        <div class="ep-found">${ENDINGS.map(e => `<span class="${found.includes(e.id) ? 'on' : ''}" title="${found.includes(e.id) ? e.name : '아직 못 본 엔딩'}">${found.includes(e.id) ? e.icon : '?'}</span>`).join('')}<em>발견한 엔딩 ${found.length}/${ENDINGS.length}</em></div>
        <p class="ep-now">이 마을의 미래는 정해지지 않았어요.<br>너의 2026년도, 지금 시작이에요.</p></div>`,
      `<div class="ep-credit"><b>100 투 더 퓨처</b><p>기획·제작 <strong>쓰로인훈쌤 김종훈</strong></p><p>함께한 사람들: 하늘이 · 로미 · 약국 사장님 · 박 주무관 · 마을 사람들</p>
        <p class="sm">마을의 그늘·빗물 계산: InVEST 도시 냉각 모델 · EPA SWMM (가상 마을, 예측이 아니에요)</p><p class="sm">초등 4학년 과학 「기후변화와 우리 생활」</p></div>`,
    ];
    let i = -1; this.cinematic = true; document.body.classList.add('cine', 'epi');
    const next = () => {
      i++;
      if (i >= pages.length) { el.hidden = true; el.onclick = null; window.removeEventListener('keydown', key, true); document.body.classList.remove('cine', 'epi'); this.cinematic = false; return done(); }
      el.querySelector('.ep-page').innerHTML = pages[i]; el.querySelector('.ep-page').classList.remove('in'); void el.offsetWidth; el.querySelector('.ep-page').classList.add('in');
      el.querySelector('.ep-next').textContent = i === pages.length - 1 ? '📜 내 미래 보고서 보기' : '다음 ▶';
      audio.sfx(i === 2 ? 'jingle_win' : 'paper', i === 2 ? 0.8 : 0.5);
    };
    const key = e => { if (['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); next(); } };
    el.onclick = e => { if (e.target.closest('.ep-skip')) i = pages.length - 1; next(); };   // 건너뛰기: 바로 보고서로
    window.addEventListener('keydown', key, true); el.hidden = false; next();
  },
};
