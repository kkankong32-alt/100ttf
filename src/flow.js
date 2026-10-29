// 이야기 흐름: 장 시작·완료 안내, 3장 《100년의 약속》, 목표 안내, 엔딩 이야기, 시작 화면, 설정(소리), 교사용 메뉴.
// SchoolFront 장면에 메서드로 섞어 쓴다(Object.assign). 과학 값은 기존 결과 데이터에서 읽기만 한다.
import { state, $, heatKey, swmmKey, saveGame, toast, SAVE_KEY, josa } from './core.js';
import { FIRST, futureFacts, sentences } from './final.js';
import { audio } from './audio.js';
import { CHAPTERS, chapterOf, NO_PROMISE, PLACES, PLACE_NAME, hasPromise, ch3Record } from './story.js';

const clone = o => JSON.parse(JSON.stringify(o));
const C1_LABEL = c => [c.forest === 'parking' && '숲→주차장', c.streetTrees && '가로수', c.schoolyard && '운동장 녹화', c.coolPave && '밝은 포장'].filter(Boolean).join('+') || '대책 없음';
const C2_LABEL = c => [c.permeable && '물이 스미는 바닥', c.rainGarden && '빗물정원', c.basin && '빗물 연못'].filter(Boolean).join('+') || '빗물 대책 없음';
const C3_LABEL = c => c === null ? '약속 전(관리 지속 가정)' : [c.treeCare && '나무 돌봄', c.facilityCare && '시설 청소', c.forestLaw && '숲 지키는 마을 규칙'].filter(Boolean).join('+') || '약속 없음(관리 끊김)';

export const FlowMethods = {
  busy() { return this.titleOpen || this.traveling || this.timelapsing || this.cinematic || !$('#talk').hidden || !!document.querySelector('dialog[open]'); },

  // ---------- 장 안내 ----------
  banner(n, kind) {
    const id = `${n}-${kind}`; if (state.banners.includes(id)) return;
    state.banners.push(id); saveGame(this); (this.bannerQ ??= []).push([n, kind]);
  },
  showNextBanner() {
    if (this.bannerOn || !this.bannerQ?.length) return;
    const [n, kind] = this.bannerQ.shift(), el = $('#chapter'), ch = CHAPTERS[n];
    el.querySelector('small').textContent = n === 4 ? (kind === 'done' ? '엔딩' : '마지막') : kind === 'done' ? `${n}장 완료!` : `${n}장`;
    el.querySelector('b').textContent = ch.title; el.querySelector('span').textContent = kind === 'done' ? (n === 4 ? '100년의 이야기를 끝까지 따라왔어요!' : '잘했어요! 다음 이야기로 가요') : ch.start;
    el.hidden = true; void el.offsetWidth; el.hidden = false; this.bannerOn = true; document.body.classList.add('banner'); audio.sfx('jingle_chapter', 0.8);
    setTimeout(() => { el.hidden = true; this.bannerOn = false; document.body.classList.remove('banner'); }, 3600);
  },
  // 매 프레임(한가할 때만): 장 안내 차례대로, 3장 시작 조건 확인
  storyTick() {
    if (this.rpgOn?.()) return this.rpgStoryTick();                 // RPG: 장 안내·장 시작 장면(chapters.js)
    if (state.ch3.phase === 'intro' && !this.ch3Intro) state.ch3.phase = 'locked';      // 소개 대화 중 저장된 상태 복구
    if (this.busy()) return;
    if (state.prologue === 'done') this.banner(1, 'start');
    if (state.prog.ch1) { this.banner(1, 'done'); this.banner(2, 'start'); }
    if (state.prog.ch2 && state.prog.ch1) this.banner(2, 'done');
    if (this.pendingTip && !this.bannerOn) { const t = this.pendingTip; this.pendingTip = null; return this.talk([['로미', t]]); }   // 실패 뒤 다음에 해 볼 것(질문 형태)
    this.showNextBanner();
    if (state.prog.ch1 && state.prog.ch2 && state.ch3.phase === 'locked' && state.year === 2126 && !state.mission.active && !state.delivery.active && !this.bannerOn && !this.bannerQ?.length) this.startCh3();
  },

  // ---------- 3장 《100년의 약속》 ----------
  // 지금까지(1·2장)는 '지금 수준의 관리가 100년 계속' 가정. 로미가 약속이 하나도 없는 미래(c3 = 0,0,0, 525개 조합 안의 실제 결과)를 보여 준다.
  startCh3() {
    state.ch3.phase = 'intro'; this.ch3Intro = true;
    this.talk([['로미', '할머니를 돕고 약도 전해 줬군요. 고마워요!'], ['로미', '그런데 지금까지 본 미래는 "100년 동안 지금처럼 나무와 시설을 계속 돌본다"고 가정한 미래였어요.'],
               ['로미', '만약 아무도 약속하지 않고, 돌보지 않는다면? 그 100년 뒤를 보여 줄게요!']], () => {
      state.ch3.saved = state.c3 ? clone(state.c3) : null; state.c3 = clone(NO_PROMISE);
      state.weather = 'heat'; state.ch3.phase = 'explore'; state.ch3.before = {}; state.ch3.after = {}; this.ch3Intro = false;
      this.ring.setVisible(true).play('century_ring'); audio.sfx('warp'); this.cameras.main.flash(500, 255, 244, 214);
      this.build(state.year, null, 600); this.ensureFree(); saveGame(this); this.banner(3, 'start');
      this.time.delayedCall(700, () => this.talk([['로미', '여기는 100년 동안 아무도 약속하지 않은 2126년이에요.'],
        ['로미', '가로수 길, 빗물 시설, 안내판(뒷산 소식)을 조사해서 📒 약속 기록장을 채워 봐요!']]));
    });
  },
  ch3Column() { return state.ch3.phase === 'explore' ? 'before' : state.ch3.phase === 'verify' ? 'after' : null; },
  ch3Interactable() {
    const col = this.ch3Column(); if (!col || state.year !== 2126) return null;
    const mark = p => state.ch3[col][p] ? ' ✓' : '';
    if (this.near('board')) return { id: 'ch3hill', place: 'hill', at: this.spot('board'), h: 114, label: `안내판: 뒷산 소식 기록하기${mark('hill')}` };
    if (this.near('ch3Trees', 60)) return { id: 'ch3trees', place: 'trees', at: this.spot('ch3Trees'), h: 30, label: `가로수 길 조사하기${mark('trees')}` };
    if (this.near('ch3Water', 60)) return { id: 'ch3water', place: 'water', at: this.spot('ch3Water'), h: 30, label: `빗물 시설 조사하기${mark('water')}` };
    return null;
  },
  ch3Record(place) {
    const col = this.ch3Column(); if (!col) return;
    const r = ch3Record(place, state.c1, state.c2, state.c3, this.heatData(), this.swmmData());
    state.ch3[col][place] = r; audio.sfx('record'); toast(`📒 ${PLACE_NAME[place]} — ${r.icon} ${r.text}`, 5200); saveGame(this); this.updateHud();
    if (!PLACES.every(p => state.ch3[col][p])) return;
    if (col === 'before') {
      state.ch3.phase = 'plan'; saveGame(this);
      this.time.delayedCall(400, () => this.talk([['로미', '기록장 세 곳을 다 채웠어요. 돌보지 않은 100년은 이렇게 달라졌네요.'],
        ['로미', '이런 미래가 되지 않으려면 2026년에 어떤 약속을 해야 할까요?'], ['로미', '⏳ 시간여행으로 돌아가 게시판의 "100년의 약속"에서 약속 카드를 골라 보세요(최대 2장).']], () => this.openJournal()));
    } else {
      state.ch3.phase = 'done'; saveGame(this); this.banner(3, 'done'); audio.sfx('jingle_win');
      this.time.delayedCall(400, () => this.talk([['로미', '약속을 지킨 100년과 약속이 없던 100년, 기록장에서 나란히 비교해 봐요!'],
        ['로미', '이제 📜 내 미래 보고서에서 내가 만든 2126년을 되돌아봐요.']], () => this.openJournal()));
    }
  },
  planClosed() {
    if (state.ch3.phase !== 'plan' || state.year !== 2026) return;
    if (hasPromise(state.c3)) { state.ch3.phase = 'verify'; saveGame(this); toast('약속을 정했어요! ⏳ 100년 뒤, 약속의 결과를 보러 가요.'); audio.sfx('confirm'); }
    else toast('"100년의 약속"에서 약속 카드를 1장 이상 골라 보세요.');
    this.updateHud();
  },
  openJournal() {
    const row = p => { const b = state.ch3.before[p], a = state.ch3.after[p];
      const cell = r => r ? `<td class="i">${r.icon}</td><td>${r.text}</td>` : '<td class="i"></td><td class="todo">아직 조사 전</td>';
      return `<tr><th colspan="4">${PLACE_NAME[p]}</th></tr><tr>${cell(b)}${cell(a)}</tr>`; };
    $('#journal .body').innerHTML = `<p>아무도 돌보지 않은 100년(왼쪽)과 약속을 지킨 100년(오른쪽)을 같은 장소에서 비교해요.</p>
      <table><colgroup><col style="width:34px"><col><col style="width:34px"><col></colgroup><tr><th colspan="2">약속 없는 2126년</th><th colspan="2">약속한 2126년 <small>${state.ch3.phase === 'verify' || state.ch3.phase === 'done' ? C3_LABEL(state.c3) : ''}</small></th></tr>${PLACES.map(row).join('')}</table>
      <p class="note">문장의 수치는 이 미래의 계산 결과(대표 나무·그늘 칸: InVEST·수목 모델, 빗물: EPA SWMM)예요. 관리하지 않으면 성능이 떨어진다는 것과 숲 개발은 모델의 가정이에요.</p>`;
    $('#journal').showModal();
  },

  // ---------- 목표 안내(프롤로그 이후) ----------
  flowObjective() {
    const M = state.mission, D = state.delivery, ch3 = state.ch3, col = this.ch3Column();
    if (M.active) return { goal: '🌳 그늘로 걸어 학교 정문 쉼터까지!', target: this.spot('heatGoal'), label: '쉼터', h: 20 };
    if (D.active) return { goal: '💊 빨간 지붕 집 현관까지 약을 전해요!', target: this.spot('deliveryGoal'), label: '빨간 지붕 집', h: 20 };
    if (state.year === 2026) {
      if (ch3.phase === 'plan') return hasPromise(state.c3) ? { goal: '⏳ 100년 뒤, 약속의 결과를 보러 가요', pulse: '#btn-time' }
        : { goal: '📜 게시판의 "100년의 약속"에서 약속 카드를 골라요', target: this.spot('board'), label: '계획 게시판', h: 114 };
      if (col || ch3.phase === 'verify') return { goal: '⏳ 100년 뒤, 약속의 결과를 보러 가요', pulse: '#btn-time' };
      return state.planned ? { goal: '⏳ 시간여행으로 100년 뒤 마을을 보러 가요', pulse: '#btn-time' }
        : { goal: '📋 계획 게시판에서 우리 마을을 바꿔 봐요', target: this.spot('board'), label: '계획 게시판', h: 114 };
    }
    const next = col && PLACES.find(p => !state.ch3[col][p]);
    if (next) {
      const n = PLACES.filter(p => state.ch3[col][p]).length;
      const T = { trees: [this.spot('ch3Trees'), '가로수 길', 30], water: [this.spot('ch3Water'), '빗물 시설', 30], hill: [this.spot('board'), '안내판', 114] }[next];
      return { goal: `📒 약속 기록장 (${n}/3): ${josa(PLACE_NAME[next], '를/을')} 조사해요`, target: T[0], label: T[1], h: T[2] };
    }
    if (ch3.phase === 'plan') return { goal: '⏳ 2026년으로 돌아가 100년의 약속을 정해요', pulse: '#btn-time' };
    if (!state.prog.ch1) return state.weather === 'rain' ? { goal: '☀ 폭염 때 모습으로 돌아가 할머니를 도와요', pulse: '#btn-weather' }
      : { goal: '👵 할머니를 도와 학교 쉼터까지 함께 걸어요', target: [this.granny.x, this.granny.y], label: '할머니', h: this.granny.height };
    if (!state.prog.ch2) return state.weather === 'rain' ? { goal: '⛈ 약국 사장님이 도움을 기다려요', target: [this.pharm.x, this.pharm.y], label: '약국 사장님', h: this.pharm.height }
      : { goal: '⛈ 집중호우 때 모습으로 바꿔 약국에 가 봐요', pulse: '#btn-weather' };
    if (ch3.phase === 'done' && !state.ending) return { goal: '📜 내 미래 보고서에서 100년 이야기를 되돌아봐요', pulse: '#btn-final' };
    return { goal: '다른 미래도 만들어 볼까요? ⏳ 2026년으로', pulse: '#btn-time' };
  },

  // ---------- 엔딩: 나의 100년 이야기 ----------
  renderStory(mine, first) {
    const m = state.mission.done.at(-1), d = state.delivery.done.at(-1), J = state.ch3;
    // 성취: '아무것도 안 한 미래'보다 나아진 점(계산된 값의 비교만)
    const wins = [mine.shade > first.shade && `등굣길 그늘 칸 ${first.shade}% → ${mine.shade}%`, mine.runoff < first.runoff && `큰비가 올 때 흘러간 빗물 ${first.runoff} → ${mine.runoff} mm`,
      mine.load < first.load && `하수관이 꽉 찬 정도 ${Math.round(first.load * 100)} → ${Math.round(mine.load * 100)}%`, mine.forest !== first.forest && mine.forest === '숲 유지' && '뒷산 숲을 지켰어요',
      mine.lowland === '빗물 연못' && '저지대에 빗물 연못이 남았어요'].filter(Boolean);
    const head = wins.length ? `<p class="big">🎉 내 선택이 바꾼 2126년: ${wins.join(' · ')}</p>` : '<p class="big">아직 아무것도 하지 않은 미래와 같아요. 2026년으로 돌아가 다른 선택을 해 볼까요?</p>';
    const ch3 = J.phase === 'done' ? PLACES.map(p => `${PLACE_NAME[p]} ${J.before[p]?.icon ?? ''}→${J.after[p]?.icon ?? ''}`).join(' · ') : '아직 진행 중이에요';
    $('#final .story').innerHTML = `${head}<h3>나의 100년 이야기</h3><ul class="chap">
      <li>🌳 1장 뜨거운 등굣길 — ${m ? (m.success ? '할머니와 그늘길로 쉼터에 도착했어요.' : '그늘이 부족해 여러 번 쉬어야 했어요.') : '아직 해 보지 않았어요.'}</li>
      <li>⛈ 2장 집중호우 — ${d ? (d.success ? '물웅덩이를 지나 약을 제때 전했어요.' : '물이 고여 약을 제때 전하지 못했어요.') : '아직 해 보지 않았어요.'}</li>
      <li>📒 3장 100년의 약속 — ${ch3}</li></ul>`;
    if (J.phase === 'done' && !state.ending) { state.ending = true; saveGame(this); this.banner(4, 'done'); audio.sfx('jingle_win'); }
  },

  // ---------- 시작 화면·설정·교사용 ----------
  setupUI(saved, jump) {
    const q = new URLSearchParams(location.search);
    this.titleOpen = true;
    $('#title').hidden = !this.titleOpen;
    // 시작 화면: 이어하기(저장이 있을 때만) · 처음부터 시작하기(진행만 지우고 모은 엽서 ttf.postcards.v1은 남김)
    const tail = '';
    $('#btn-continue').disabled = !saved; $('#btn-continue').classList.toggle('main', !!saved); $('#btn-start').classList.toggle('main', !saved);
    $('#btn-continue').title = saved ? '' : '저장된 기록이 없어요';
    const begin = () => { if (!this.titleOpen) return; this.titleOpen = false; $('#title').hidden = true; audio.unlock(); this.syncBgm(); this.updateHud(); this.maybeHelp(); };
    const fresh = () => { if (!this.titleOpen) return;
      if (!saved) return begin();
      if (!confirm('처음부터 시작할까요? 지금까지의 진행은 지워지지만, 모은 미래 엽서는 앨범에 남아요.')) return;
      try { localStorage.removeItem(SAVE_KEY); } catch { } location.href = location.pathname + '?new' + tail; };
    $('#btn-help').onclick = () => $('#help').showModal();
    try { $('#s-guide').checked = localStorage.getItem('ttf.guide') !== '0'; } catch { }
    $('#s-guide').onchange = e => { try { localStorage.setItem('ttf.guide', e.target.checked ? '1' : '0'); } catch { } $('#steps').style.display = e.target.checked ? '' : 'none'; this.updateHud(); };
    $('#btn-continue').onclick = () => { if (saved) begin(); }; $('#btn-start').onclick = fresh; this.input.keyboard.on('keydown-ENTER', () => (saved ? begin() : fresh()));
    if (q.has('new') && !saved && this.titleOpen) { history.replaceState(null, '', location.pathname + (tail ? '?' + tail.slice(1) : '')); this.time.delayedCall(100, begin); }   // '처음부터' 확인 뒤 다시 누르지 않아도 바로 시작
    if (this.titleOpen) audio.playBgm('title'); else this.syncBgm();
    // 설정: 배경음악·효과음 켜기/끄기·음량, 전체 화면
    const S = audio.settings;
    $('#s-bgm-on').checked = S.bgmOn; $('#s-sfx-on').checked = S.sfxOn; $('#s-bgm').value = S.bgm; $('#s-sfx').value = S.sfx;
    $('#s-bgm-on').onchange = e => audio.set('bgmOn', e.target.checked); $('#s-sfx-on').onchange = e => audio.set('sfxOn', e.target.checked);
    $('#s-bgm').oninput = e => audio.set('bgm', +e.target.value); $('#s-sfx').oninput = e => audio.set('sfx', +e.target.value);
    const fs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => { });
    $('#btn-fs2').onclick = fs;
    $('#btn-set-help').onclick = () => { $('#settings').close(); $('#help').showModal(); };
    $('#btn-title-help').onclick = () => $('#help').showModal();
    $('#btn-journal').onclick = () => this.openJournal();
    $('#btn-again').onclick = () => { $('#final').close(); if (state.year === 2126) this.timeTravel(); };
    $('#btn-again-album').onclick = () => { $('#final').close(); this.openAlbum(); };
    // 엔딩 뒤 마치기: 끝 인사 화면 → 시작 화면(진행·엽서는 저장됨) 또는 계속 둘러보기
    const quit = () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); saveGame(this); $('#finish').hidden = false; audio.sfx('jingle_win', 0.6); };
    $('#btn-quit').onclick = quit; $('#btn-quit2').onclick = quit;
    $('#fin-title').onclick = () => { location.href = location.pathname; };
    $('#fin-stay').onclick = () => { $('#finish').hidden = true; };
    $('#btn-again-start').onclick = () => { if (confirm('처음부터 다른 선택으로 다시 할까요? 진행은 처음으로 돌아가지만 모은 엽서는 앨범에 남아요.')) { try { localStorage.removeItem(SAVE_KEY); } catch { } location.href = location.pathname; } };
  },
  syncBgm() { if (!this.titleOpen) audio.playBgm(this.timelapsing || state.year === 2126 ? 'future' : 'town'); },
};
