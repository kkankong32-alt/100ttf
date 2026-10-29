// 교과서 연결(초등 4학년 과학 「기후변화와 우리 생활」, 교과서 84~99쪽): 장을 마칠 때 보여 주는 카드와 엔딩의 '나의 실천' 고르기.
// 문장은 교과서에 실린 내용(쪽수)만 짧게 옮겨 게임 장면과 이어 준다. 과학 계산 값은 쓰지 않음.
import { state, $, saveGame } from './core.js';
import { audio } from './audio.js';

export const LINKS = {
  1: { title: '1장 다 했어요! 교과서와 이어 보기', rows: [
    ['🌡 기후변화 현상', '오랜 기간 평균 날씨가 변하는 것이 기후변화예요. 우리나라는 <b>폭염</b>이 점점 잦아지고 있어요.'],
    ['🌳 대응: 적응하도록 대비', '폭염에 사람들이 적응할 수 있도록 미리 대비해요. 게임에서는 <b>나무 그늘</b>을 만들고, 나무를 <b>계속 돌볼 사람</b>을 정했어요.'],
    ['🙋 나라면?', '나무를 많이 심고 가꾸는 것은 환경을 보호하는 행동이에요. 학교 나무 돌보기부터 해 볼까요?']] },
  2: { title: '2장 다 했어요! 교과서와 이어 보기', rows: [
    ['🌧 기후변화 현상', '짧은 시간 동안 비가 많이 내려서(집중호우) <b>홍수</b>가 나기도 해요.'],
    ['💧 대응: 적응하도록 대비', '홍수에 대비해요. 게임에서는 빗물이 <b>땅으로 스며들거나 잠시 모이는 곳</b>을 만들어 길에 물이 덜 고이게 했어요.'],
    ['🙋 나라면?', '물과 에너지를 낭비하는 것도 기후변화에 영향을 주는 인간의 활동이에요. 물을 아껴 써요.']] },
  3: { title: '3장 다 했어요! 교과서와 이어 보기', rows: [
    ['🪓 인간의 활동', '땅을 개발하려고 나무를 베는 <b>산림 훼손</b>도 기후변화에 영향을 주는 인간의 활동이에요. 뒷산 숲을 주차장으로 바꾸는 선택이 그 예예요.'],
    ['🌲 대응: 숲 보존', '국가와 사회는 숲 같은 자연환경을 <b>보존</b>해요. 게임의 \'숲 지키는 마을 규칙\'이 그런 약속이에요.'],
    ['🤝 꾸준히 실천하기', '기후변화 대응은 여러 사람이 함께, <b>꾸준히</b> 실천해야 해요. 약속을 다음 사람에게 이어 준 것처럼요.']] },
};
// 엔딩: 교과서 97쪽 '기후변화에 대응하는 방법'(걷기·자전거, 전기, 일회용품, 분리배출) + 86쪽 '나무를 많이 심어요' + 98쪽 알림 활동
export const PLEDGES = [
  ['🚶', '가까운 거리는 걷거나 자전거 타기'], ['💡', '전기 아껴 쓰기'], ['🥤', '일회용품·비닐 적게 쓰기'],
  ['♻️', '재활용품 분리배출하기'], ['🌱', '나무 심고 가꾸기'], ['📣', '기후변화 대응 방법을 친구·가족에게 알리기'],
];

export const TextbookMethods = {
  // 장이 바뀐 뒤, 대화·장면·장 제목이 끝나면 지난 장의 교과서 연결 카드를 띄움
  queueLink(n) { if (!LINKS[n]) return; this.linkQ = n; this.time.delayedCall(800, () => this.tryLink()); },
  tryLink() {
    const n = this.linkQ; if (!n) return;
    const busy = this.titleOpen || this.traveling || this.timelapsing || this.cinematic || this.bannerOn || !$('#talk').hidden || document.querySelector('dialog[open]') || this.mapCam;
    if (busy) return void this.time.delayedCall(1000, () => this.tryLink());
    this.linkQ = null; const L = LINKS[n];
    $('#link h2').textContent = `📘 ${L.title}`;
    $('#link .body').innerHTML = L.rows.map(([h, t]) => `<div class="lrow"><b>${h}</b><p>${t}</p></div>`).join('');
    audio.sfx('record', 0.6); $('#link').showModal();
  },
  // 엔딩 화면 아래: 원인 줄이기(교과서 90~91·97쪽) + 나의 실천 하나 고르기
  pledgeHtml() {
    const mine = state.rpg?.pledge;
    return `<div class="pledge"><h3>📘 교과서 연결 · 나의 실천 고르기</h3>
      <p>마을의 대책은 기후변화에 <b>적응</b>하는 방법이었어요. 폭염과 큰비가 더 심해지지 않게 하려면, 기후변화에 영향을 주는 <b>인간의 활동</b>(에너지·물 낭비, 교통수단, 쓰레기, 산림 훼손)을 줄여야 해요.</p>
      <p>내가 일주일 동안 해 볼 실천 하나를 골라요.</p>
      <div class="pl">${PLEDGES.map(([i, t], k) => `<button type="button" data-p="${k}" class="${mine === k ? 'on' : ''}">${i} ${t}</button>`).join('')}</div>
      <p class="mine">${mine != null ? `✅ 나의 실천: ${PLEDGES[mine][0]} ${PLEDGES[mine][1]}` : ''}</p></div>`;
  },
  wirePledge(root) {
    root.querySelectorAll('.pledge [data-p]').forEach(b => b.onclick = () => {
      state.rpg.pledge = +b.dataset.p; saveGame(this); audio.sfx('confirm', 0.6);
      root.querySelector('.pledge').outerHTML = this.pledgeHtml(); this.wirePledge(root);
    });
  },
};
