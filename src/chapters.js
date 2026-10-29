// 2장·3장·엔딩의 직접 조작 활동(RPG 모드). 콘텐츠(대사·단서·카드)는 data/ch2.json·ch3.json, 규칙 좌표는 data/regions.json.
//  2장: 종이배로 물길 찾기(종이배 → 흐름 개념도), 시장길 약 배달(하수관이 꽉 찬 정도 → 물웅덩이 게임 규칙), 빗물 시설 설치(설득 + 빗물 예산 2)
//  3장: 시대 기록 정렬(백년시계 시간 창), 약속 릴레이(역할 카드 잇기, 약속 2장), 엔딩(세 축 정리·엽서)
// 과학 값은 scenario-results(SWMM)·heat.json(InVEST·수목)에서 읽기만 한다. 물 흐름 그림·관리 기록 연도는 교육용 연출이다.
import { state, $, heatKey, swmmKey, saveGame, toast } from './core.js';
import { audio } from './audio.js';
import { pick, fill, applyEffects, choicesFromRpg, promiseCount, PROMISE_MAX } from './rpg.js';
import { FIRST, futureFacts, sentences, renderFinal, saveCard } from './final.js';
import { CHAPTERS } from './story.js';
import { PLEDGES } from './textbook.js';
import { ENDINGS, kept, endingOf, foundEndings, letterLines } from './epilogue.js';

const SP = { me: '나', romi: '로미' };
const lines = (L, ctx = {}) => (L ?? []).map(([w, s]) => [SP[w] ?? w, fill(s, ctx)]);
const shuffle = (a, seed) => { const b = a.slice(); let s = seed; for (let i = b.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// 종이배로 물길 찾기 개념도 경로(구역 B 아트 좌표): 시작 → 끝. 방향 설명용이며 유속·깊이가 아님(Codex 안내 10)
const FLOW_PATHS = { pave: [[520, 520], [1000, 560]], drain: [[1020, 560], [1150, 680]], low: [[900, 760], [420, 880]] };

export const ChapterMethods = {
  // ---------- 이야기 흐름(RPG): 장 안내·장 시작 장면 ----------
  rpgStoryTick() {
    const r = state.rpg;
    if (this.busy()) return;
    for (let n = 1; n <= Math.min(r.ch, 3); n++) { this.banner(n, 'start'); if (r.ch > n) this.banner(n, 'done'); }
    if (r.ch >= 4) this.banner(4, 'start');
    this.showNextBanner();                                         // 장 안내(화면 위)는 장면 대사(화면 아래)를 막지 않음
    const sc = [[2, 'ch2_intro', 'ch2Intro'], [3, 'ch3_intro', 'ch3Intro'], [4, 'end_intro', 'endIntro']].find(([n, f]) => r.ch === n && !r.flags[f]);
    if (sc && state.year === 2126) { r.flags[sc[1]] = true; return this.runEntry(this.ch.scenes[sc[2]], '', null); }
    if (this.pendingScene) { const k = this.pendingScene; this.pendingScene = null; return this.runEntry(this.ch.scenes[k], '', null); }
  },
  // 처음 시작할 때 '이렇게 놀아요' 카드를 한 번 보여 줌(❓ 버튼으로 언제든 다시)
  maybeHelp() { if (navigator.webdriver) return; let seen = false; try { seen = localStorage.getItem('ttf.help.v1') === '1'; localStorage.setItem('ttf.help.v1', '1'); } catch { } if (!seen) $('#help').showModal(); },
  onChapter(n) { state.prog.ch1 = r1(state); if (n >= 3) state.prog.ch2 = true; this.rpgSync(); this.build(); this.updateHud(); saveGame(this); this.queueLink?.(n - 1); },   // 지난 장의 교과서 연결 카드
  // 3장: 약속 릴레이를 마치고 2126년에 오면 엔딩으로 가는 길이 열림(약속한 곳 확인은 자유)
  onArriveRpg() {
    const r = state.rpg;
    if (r.ch === 3 && r.flags.ch3_relay) { this.rpgEvents(applyEffects(r, [{ chapter: 4 }, { flag: 'end_intro' }], this.ch)); this.pendingScene = 'ch3Arrive'; }
  },
  onRegionEnter(r) { if (r !== 'A') this.lens = false; this.drawHeat?.(); },
  runGame(kind, e, who, t) {
    const [k, arg] = kind.split(':');
    if (k === 'flow') return this.playFlow(arg);
    if (k === 'deliveryB') return this.startDeliveryB();
    if (k === 'chrono') return this.openChrono(arg);
    if (k === 'relay') return this.openRelay();
    if (k === 'ending') return this.playEnding();
    if (k === 'rainView') { state.rpg.flags.rainView = !state.rpg.flags.rainView; this.rpgSync(); this.build(); this.updateHud(); saveGame(this); return toast(state.weather === 'rain' ? '⛈ 같은 미래에 집중호우가 쏟아질 때예요.' : '☀ 다시 폭염 때 모습이에요.'); }
  },
  // ---------- 2장: 종이배로 물길 찾기(종이배가 빗물을 따라 흘러가는 개념도) ----------
  playFlow(key) {
    const [[x0, y0], [x1, y1]] = FLOW_PATHS[key], a = Math.atan2(y1 - y0, x1 - x0), n = 6;
    audio.sfx('paper', 0.8);   // 종이배 띄우기: 종이 바스락
    // 종이배: 접은 종이배 모양을 한 번 그려 텍스처로(새 그림 파일 없음) — 물살을 따라 둥실 떠내려감
    if (!this.textures.exists('paperboat')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x000000, 0.18).fillEllipse(48, 54, 80, 12);                                   // 물 위 그림자
      g.fillStyle(0xf4f1e6, 1).fillPoints([{ x: 6, y: 30 }, { x: 90, y: 30 }, { x: 74, y: 50 }, { x: 22, y: 50 }], true);   // 배 몸통
      g.fillStyle(0xdcd6c4, 1).fillPoints([{ x: 22, y: 50 }, { x: 48, y: 30 }, { x: 74, y: 50 }], true);                  // 몸통 접힌 면
      g.fillStyle(0xffffff, 1).fillTriangle(48, 4, 26, 30, 48, 30).fillStyle(0xe6e1d2, 1).fillTriangle(48, 4, 70, 30, 48, 30);   // 돛(앞·뒤 면)
      g.lineStyle(2, 0x6b6250, 1).strokePoints([{ x: 6, y: 30 }, { x: 90, y: 30 }, { x: 74, y: 50 }, { x: 22, y: 50 }], true).strokeTriangle(48, 4, 26, 30, 70, 30).lineBetween(48, 4, 48, 30);
      g.generateTexture('paperboat', 96, 60); g.destroy();
    }
    const boat = this.add.image(x0, y0, 'paperboat').setDepth(6).setDisplaySize(64, 40).setAlpha(0); this.dyn.add(boat);
    this.tweens.add({ targets: boat, alpha: 1, duration: 300 });
    this.tweens.add({ targets: boat, x: x1, y: y1, delay: 200, duration: 3600, ease: 'Sine.easeInOut', onComplete: () => this.tweens.add({ targets: boat, alpha: 0, duration: 600, onComplete: () => boat.destroy() }) });
    this.tweens.add({ targets: boat, angle: { from: -7, to: 7 }, scaleY: { from: boat.scaleY * 0.94, to: boat.scaleY }, duration: 520, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(x0, y0, 'fg_water_flow').setDepth(5).setRotation(a).setDisplaySize(96, 48).setAlpha(0);
      s.play('water_flow'); this.dyn.add(s);
      this.tweens.add({ targets: s, x: x1, y: y1, alpha: { from: 0.95, to: 0.2 }, delay: i * 260, duration: 2200, onComplete: () => s.destroy() });
    }
  },
  // ---------- 2장: 시장길 약 배달(게임 규칙: 12초, 얕은 물웅덩이 느려짐, 깊은 물웅덩이 통행 불가) ----------
  startDeliveryB() {
    const D = this.regionsDef.B.delivery; this.rpgDelivery = { t: 0 }; this.player.setPosition(...D.start); this.touchTarget = null;
    $('#timer').hidden = false; this.updateHud(); audio.sfx('confirm');
  },
  tickDeliveryB(dt) {
    const d = this.rpgDelivery, D = this.regionsDef.B.delivery; d.t += dt / 1000;
    $('#timer').textContent = `약 배달 ${Math.max(0, D.timeLimitSec - d.t).toFixed(1)}초`;
    if (Math.hypot(this.player.x - D.goal[0], this.player.y - D.goal[1]) < D.goalRadius) return this.endDeliveryB(true);
    if (d.t > D.timeLimitSec) this.endDeliveryB(false);
  },
  endDeliveryB(success) {
    const r = state.rpg, lvl = this.puddleLevel(); this.rpgDelivery = null; $('#timer').hidden = true;
    state.delivery.done.push({ key: swmmKey(state.c1, state.c2, state.c3), success, reason: success ? null : lvl === 'deep' ? 'deep' : 'late' });
    const k = swmmKey(state.c1, state.c2, state.c3); if (!(r.rainFutures ??= []).includes(k)) r.rainFutures.push(k);
    const any = state.c2.permeable || state.c2.rainGarden || state.c2.basin;
    r.flags.delivery_tried = true; if (success && any) r.flags.delivered = true;      // '전달 성공' = 빗물 시설을 만든 뒤의 성공
    audio.sfx(success ? 'jingle_win' : 'jingle_hmm');
    if (!success) this.player.setPosition(...this.regionsDef.B.delivery.start);
    saveGame(this); this.updateHud();
    const sc = this.ch.scenes[success ? (lvl === 'shallow' ? (any ? 'deliverSlow' : 'deliverSlowBase') : state.c2.basin ? 'deliverOkBasin' : 'deliverOk') : (r.facts.includes('f_w_flood') ? 'deliverFailAgain' : 'deliverFail')];
    this.time.delayedCall(400, () => this.runEntry(sc, '', null));
  },
  // 구역 B 물웅덩이(게임 규칙 사각형): 하수관이 꽉 찬 정도(SWMM) → 없음/얕음/깊음
  drawRegionPuddles() {
    this.puddleRects = { shallow: [], deep: [] };
    if (!(state.year === 2126 && state.weather === 'rain')) return;
    const lvl = this.puddleLevel(), B = this.regionsDef.B; if (lvl === 'none') return;
    const rects = lvl === 'deep' ? B.puddleDeep : B.puddleShallow;
    for (const [x0, y0, x1, y1] of rects) {
      const key = lvl === 'deep' ? 'nv3_puddle_deep_pool' : 'nv3_puddle_shallow_vertical';
      this.dyn.add(this.add.image(x0 - 10, y0 - 6, key).setOrigin(0).setDisplaySize(x1 - x0 + 20, y1 - y0 + 12).setDepth(4).setAlpha(0.92));
      for (let i = 0; i < Math.max(2, Math.round((x1 - x0) * (y1 - y0) / 9000)); i++) {
        const rp = this.add.sprite(x0 + (x1 - x0) * Math.random(), y0 + (y1 - y0) * Math.random(), 'nv3_ripple').setDepth(4.1).setDisplaySize(32, 16).setAlpha(0.85);
        rp.play({ key: 'ripple', startFrame: i % 4 }); this.dyn.add(rp);
      }
      (lvl === 'deep' ? this.puddleRects.deep : this.puddleRects.shallow).push([x0, y0, x1, y1]);
    }
  },
  romiMeasureRain() {
    const d = this.swmmData(), base = this.swmm[swmmKey(state.c1, { permeable: 0, rainGarden: 0, basin: 0 }, state.c3)], load = this.drainLoad();
    const bl = Math.max(base.pipe_load.C5 ?? 0, base.pipe_load.C6 ?? 0), R = this.rules.rain, ctx = this.rpgCtx();
    const L = [['로미', `같은 상상 속 큰비(3시간 ${d.rain_mm} mm)에서 마을 밖으로 흘러나간 빗물은 ${d.runoff_mm} mm예요. (빗물 시설이 없을 때 ${base.runoff_mm} mm)`],
      ['로미', `시장길 아래 하수관이 꽉 찬 정도는 ${Math.round(load * 100)}%예요. (시설이 없을 때 ${Math.round(bl * 100)}%) — ${Math.round(R.shallowD * 100)}%를 넘으면 얕은 물웅덩이, ${Math.round(R.deepD * 100)}%를 넘으면 깊은 물웅덩이로 보여 주는 게임 규칙이에요.`],
      ['로미', '과학자들이 쓰는 빗물 계산 프로그램(SWMM)으로 계산했어요. 길에 물이 몇 cm 차는지는 계산하지 않아요.']];
    const extra = pick(this.ch.measureRain ?? [], ctx);
    this.talk([...L, ...lines(extra?.lines, ctx)], () => { if (extra?.do) this.applyDo(extra.do, null); });
  },
  // ---------- 3장: 시대 기록 정렬(백년시계 시간 창) ----------
  recordCards(id) { const rec = this.ch.records[id]; const v = pick(rec.variants, this.rpgCtx()); return v?.cards ?? []; },
  openChrono(only) {
    const r = state.rpg, dlg = $('#chrono'), found = Object.keys(r.records).filter(id => !only || id === only);
    if (!found.length) return this.talk(lines(this.ch.scenes.chronoEmpty.lines));
    let cur = found.find(id => !r.chrono[id]) ?? found[0], order = [], stage = 'order', msg = '';
    const render = () => {
      const rec = this.ch.records[cur], cards = this.recordCards(cur), sh = shuffle(cards.map((c, i) => i), 7 + cur.length * 13);
      const tabs = found.map(id => `<button type="button" class="tab${id === cur ? ' on' : ''}" data-r="${id}">${this.ch.records[id].icon} ${this.ch.records[id].title}${r.chrono[id] ? ' ✔' : ''}</button>`).join('');
      const cardHtml = sh.map(i => { const c = cards[i], pos = order.indexOf(i);
        return `<button type="button" class="rec${pos >= 0 ? ' placed' : ''}" data-i="${i}" style="background-image:url(assets/codex/fullgame-art-v1/record_${c.img ?? c.y}_v1.png)">
          <span>${c.t}</span>${pos >= 0 ? `<i>${pos + 1}</i>` : ''}</button>`; }).join('');
      dlg.querySelector('.body').innerHTML = `<div class="tabs">${tabs}</div>
        <p class="q">${stage === 'order' ? '① 기록을 오래된 것부터 순서대로 눌러 늘어놓아요.' : stage === 'gap' ? '② 관리가 끊긴 것은 어느 기록부터일까요? 그 기록을 눌러요.' : '✔ 이 장소의 100년 기록을 다 읽었어요.'}</p>
        <div class="recs">${cardHtml}</div><div class="verdict">${msg}</div><p class="note">기록 속 이야기는 상상 속 마을의 이야기예요. 나무 숫자만 과학 계산 결과예요.</p>`;
      dlg.querySelectorAll('.tab').forEach(b => b.onclick = () => { cur = b.dataset.r; order = []; stage = r.chrono[cur] ? 'done' : 'order'; msg = ''; render(); });
      dlg.querySelectorAll('.rec').forEach(b => b.onclick = () => {
        const i = +b.dataset.i, c = cards[i];
        if (stage === 'order') {
          if (order.includes(i)) return;
          const next = cards.map((x, j) => j).filter(j => !order.includes(j)).sort((a, b2) => cards[a].y - cards[b2].y)[0];
          if (i !== next) { msg = `🤖 로미: 그보다 더 오래된 기록이 있어요. 사진·글에서 시대의 단서를 찾아봐요.`; audio.sfx('talk', 0.4); return render(); }
          order.push(i); audio.sfx('confirm', 0.4); msg = '';
          if (order.length === cards.length) { stage = cards.some(x => x.gap) ? 'gap' : 'done'; if (stage === 'done') { r.chrono[cur] = true; saveGame(this); msg = rec.noGap ?? ''; } }
          return render();
        }
        if (stage === 'gap') {
          if (!c.gap) { msg = `🤖 로미: 이 기록엔 아직 ${c.y < cards.find(x => x.gap).y ? '관리한 흔적이 있어요' : '이미 끊긴 뒤의 모습이에요. 처음 끊긴 때를 찾아봐요'}.`; return render(); }
          stage = 'done'; r.chrono[cur] = true; audio.sfx('jingle_win', 0.7); msg = `🤖 로미: ${rec.gapMsg}`;
          const ev = applyEffects(r, rec.do ?? [], this.ch); this.rpgEvents(ev); saveGame(this); return render();
        }
      });
    };
    stage = r.chrono[cur] ? 'done' : 'order'; render(); dlg.showModal();
  },
  // ---------- 3장: 약속 릴레이(2026 마을정원) — 약속 카드 2장, 약속마다 역할 4개를 세대가 이어받도록 잇기 ----------
  openRelay() {
    const r = state.rpg, dlg = $('#relay'), R = this.ch.relay;
    let building = null, step = 0, msg = '';
    const render = () => {
      const p = r.promise, cnt = promiseCount(p);
      const slots = Object.entries(R.promises).map(([k, P]) => `<div class="prom${p[k] ? ' on' : ''}"><b>${P.icon} ${P.title}</b><p>${P.desc}</p>
        ${p[k] ? `<span class="ok">✔ 약속함${k === 'treeCare' && r.treeCare ? ' (1장 돌봄 팀)' : ''}</span><button type="button" data-drop="${k}">약속 내려놓기</button>`
               : `<button type="button" data-add="${k}" ${cnt >= PROMISE_MAX ? 'disabled' : ''}>릴레이 만들기</button>`}</div>`).join('');
      let chain = '';
      if (building) {
        const P = R.promises[building], S = P.steps[step];
        chain = `<div class="chain"><h3>${P.icon} ${P.title} — 릴레이 ${step + 1}/${P.steps.length}</h3>
          <div class="links">${P.steps.map((s, i) => `<span class="link${i < step ? ' done' : i === step ? ' now' : ''}">${i < step ? s.options.find(o => o.ok).t : s.label}</span>`).join('<i>→</i>')}</div>
          <p class="q">${S.q}</p><div class="opts">${S.options.map((o, i) => `<button type="button" data-o="${i}">${o.t}</button>`).join('')}</div></div>`;
      }
      dlg.querySelector('.body').innerHTML = `<p class="q">약속 카드 ${cnt}/${PROMISE_MAX}장 — 약속은 사람이 지켜요. 한 마을이 한꺼번에 지킬 수 있는 약속은 두 가지예요.</p>
        <div class="proms">${slots}</div>${chain}<div class="verdict">${msg}</div>`;
      dlg.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { building = b.dataset.add; step = 0; msg = ''; render(); });
      dlg.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
        const k = b.dataset.drop; if (!confirm(`'${R.promises[k].title}' 약속을 내려놓을까요?${k === 'treeCare' && r.treeCare ? ' 1장에서 만든 돌봄 팀이 100년 뒤까지 이어지지 않게 돼요.' : ''}`)) return;
        this.rpgEvents(applyEffects(r, [{ promise: { [k]: 0 } }], this.ch)); this.rpgSync(); saveGame(this); msg = ''; render();
      });
      dlg.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
        const P = R.promises[building], o = P.steps[step].options[+b.dataset.o];
        if (!o.ok) { msg = `🤖 로미: ${o.why}`; audio.sfx('talk', 0.4); return render(); }
        audio.sfx('confirm', 0.5); step++; msg = '';
        if (step >= P.steps.length) {
          const k = building; building = null; msg = `🤝 ${P.done}`; audio.sfx('jingle_win', 0.8);
          this.rpgEvents(applyEffects(r, [{ promise: { [k]: 1 } }, { flag: `relay_${k}` }, { flag: 'ch3_relay' }], this.ch)); this.rpgSync(); saveGame(this);
        }
        render();
      });
    };
    render(); dlg.showModal();
  },
  // ---------- 엔딩: 같은 자리에서 2026 → 2126, 세 가지 축(그늘·빗물·돌봄)과 엽서 ----------
  playEnding() {
    const cam = this.cameras.main, V = this.cc.cameraViews; this.cinematic = true; cam.stopFollow();
    audio.sfx('warp'); cam.flash(500, 255, 244, 214); cam.pan(V.gate.center[0], V.gate.center[1], 1400, 'Sine.easeInOut');
    this.time.delayedCall(1500, () => cam.pan(V.street.center[0], V.street.center[1], 1800, 'Sine.easeInOut'));
    this.time.delayedCall(3500, () => { const [c1, c2, c3] = this.endingChoices();
      this.playEpilogue(c1, c2, c3, () => { cam.startFollow(this.player, false, 0.1, 0.1); this.cinematic = false; this.openEnding(); }); });
  },
  endingChoices() { return [state.c1, state.c2, state.c3 ?? choicesFromRpg({ ...state.rpg, c3on: true }).c3]; },
  openEnding() {
    const r = state.rpg, [c1, c2, c3] = this.endingChoices(), E = endingOf(kept(c1, c2, c3)), found = foundEndings();
    const mine = futureFacts(this, c1, c2, c3, heatKey, swmmKey), first = futureFacts(this, FIRST.c1, FIRST.c2, FIRST.c3, heatKey, swmmKey), txt = sentences(c1, c2, c3, mine, first);
    const ax = (icon, name, val, base, note) => `<div class="axis"><b>${icon} ${name}</b><span class="v">${val}</span><small>처음 미래: ${base}</small><p>${note}</p></div>`;
    const careN = promiseCount(c3);
    let pics = {}; try { pics = JSON.parse(localStorage.getItem('ttf.postcards.v1') || '{}'); } catch { }
    const pcs = r.postcards.map(id => { const pc = this.ch.postcards[id]; if (!pc) return ''; const src = pc.art ? `assets/codex/fullgame-art-v1/${pc.art}.png` : pics[id];
      return `<figure>${src ? `<img alt="" src="${src}">` : ''}<figcaption>${pc.icon} ${pc.title}</figcaption></figure>`; }).join('');
    const left = txt.left.concat(txt.limit).slice(0, 1)[0];
    $('#final h2').textContent = `엔딩 · ${E.icon} ${E.name}`;
    $('#final .story').innerHTML = `<p class="ending-sub">${E.say} <small>(발견한 엔딩 ${found.length}/${ENDINGS.length} — 다른 선택을 하면 다른 엔딩을 만날 수 있어요)</small></p>
      <div class="letter-mini"><b>✉ 하늘이의 편지</b>${letterLines(c1, c2, c3).map(t => `<p>${t}</p>`).join('')}</div>
      <div class="axes">
      ${ax('🌳', '더해진 그늘', `등굣길 그늘 칸 ${mine.shade}%`, `${first.shade}%`, c1.streetTrees ? (c3.treeCare ? '가로수와 다시 심기가 100년 이어졌어요.' : '나무는 심었지만 다시 심는 사람이 없었어요.') : '가로수를 심지 않은 길이에요.')}
      ${ax('💧', '비를 다루는 길', `하수관이 꽉 찬 정도 ${Math.round(mine.load * 100)}% · 흘러간 빗물 ${mine.runoff} mm`, `${Math.round(first.load * 100)}% · 빗물 ${first.runoff} mm`, c2.permeable || c2.rainGarden || c2.basin ? (c3.facilityCare ? '빗물 시설을 세대마다 청소했어요.' : '시설은 만들었지만 청소 약속이 없었어요.') : '빗물 시설을 만들지 않았어요.')}
      ${ax('🤝', '오래 이어진 돌봄', `약속 ${careN}장 · 뒷산 ${mine.forest}`, `약속 0장 · ${first.forest}`, careN ? '약속이 사람에서 사람으로 이어졌어요.' : '약속이 없어 관리가 끊겼어요.')}</div>
      <p class="big">남은 문제 하나: ${left ?? '모든 미래엔 아직 고칠 점이 있어요.'}</p>
      ${pcs ? `<h3>내 미래 엽서 ${r.postcards.length}장</h3><div class="pcs">${pcs}</div>` : ''}
      ${this.pledgeHtml()}`;
    this.wirePledge($('#final .story'));
    renderFinal($('#final .body'), mine, first, txt);
    $('#btn-card').onclick = () => saveCard(this.game, mine, first, txt, { ending: E, axes: kept(c1, c2, c3), letter: letterLines(c1, c2, c3), pledgeText: r.pledge != null ? PLEDGES[r.pledge].join(' ') : null });
    if (!state.ending) { state.ending = true; r.flags.endingSeen = true; saveGame(this); this.banner(4, 'done'); audio.sfx('jingle_win'); }
    $('#final').showModal(); this.updateHud();
  },
};
const r1 = s => !!s.rpg?.flags?.ch1done || s.prog.ch1;
export { CHAPTERS };
