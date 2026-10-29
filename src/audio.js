// 사운드: 배경음악(곡 바꿀 때 교차 페이드)·효과음, 켜기/끄기·음량(진행 저장과 별도로 기억). 출처·라이선스: assets/audio/LICENSES.md(전부 CC0).
// 브라우저 자동재생 제한: 첫 클릭·키 입력 전에는 소리를 내지 않고, 그때 요청된 곡을 기억했다가 시작한다.
const BGM = { title: 'assets/audio/bgm/title_happy.ogg', town: 'assets/audio/bgm/town_calm.ogg', future: 'assets/audio/bgm/future_sunless.ogg' };
// 상황별 소리(세션 10): 성공 = 올라가는 jingle_win, 이야기 속 실패(단서가 되는 실패) = 가벼운 '어?' jingle_hmm.
// 예전 jingle_success(PIZZI01)는 음이 10반음 내려가 '탈락'처럼 들렸고, jingle_soft(PIZZI07)는 '빠밤빠~' 하강 실패음이라 쓰지 않음(파일은 보존)
const SFX = ['click', 'open', 'close', 'confirm', 'error', 'talk', 'warp', 'record', 'jingle_win', 'jingle_hmm', 'jingle_chapter', 'paper'];
const KEY = 'ttf.settings.v1';
const BGM_GAIN = { title: 0.8, town: 0.7, future: 0.55 };   // 곡마다 녹음 크기가 달라 체감 음량을 맞춤

function loadSettings() {
  const d = { bgmOn: true, sfxOn: true, bgm: 0.5, sfx: 0.7 };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return d; }
}

export const audio = {
  settings: loadSettings(), unlocked: false, want: null, current: null, el: null, pool: {},
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { } },
  unlock() {
    if (this.unlocked) return; this.unlocked = true;
    for (const n of SFX) { const a = new Audio(`assets/audio/sfx/${n}.ogg`); a.preload = 'auto'; this.pool[n] = a; }
    if (this.want) this.playBgm(this.want, true);
  },
  bgmVolume(name) { return this.settings.bgmOn ? this.settings.bgm * (BGM_GAIN[name] ?? 0.7) : 0; },
  playBgm(name, force = false) {
    this.want = name; if (!this.unlocked || (!force && this.current === name)) return;
    const old = this.el, next = new Audio(BGM[name]); next.loop = true; next.volume = 0; this.el = next; this.current = name;
    next.play().catch(() => { });
    const t0 = performance.now(), from = old ? old.volume : 0;
    const step = () => {                                   // 0.8초 교차 페이드
      const k = Math.min(1, (performance.now() - t0) / 800);
      if (this.el === next) next.volume = this.bgmVolume(name) * k;      // 페이드 중에 음량·끄기를 바꿔도 바로 반영
      if (old) old.volume = Math.max(0, from * (1 - k));
      if (k < 1) requestAnimationFrame(step); else if (old) { old.pause(); old.src = ''; }
    };
    requestAnimationFrame(step);
  },
  sfx(name, vol = 1) {
    if (!this.unlocked || !this.settings.sfxOn) return; const a = this.pool[name]; if (!a) return;
    const c = a.cloneNode(); c.volume = Math.min(1, this.settings.sfx * vol); c.play().catch(() => { });
  },
  set(k, v) { this.settings[k] = v; this.save(); if (this.el && this.current) this.el.volume = this.bgmVolume(this.current); },
  get state() { return { unlocked: this.unlocked, current: this.current, playing: !!this.el && !this.el.paused, volume: this.el?.volume ?? 0, ...this.settings }; },
};

// 첫 사용자 입력에서 소리 잠금 해제, 버튼 클릭음, 대화창 열고 닫는 소리
export function wireAudio() {
  const go = () => audio.unlock();
  addEventListener('pointerdown', go, { capture: true }); addEventListener('keydown', go, { capture: true });
  addEventListener('click', e => { if (e.target.closest?.('button')) audio.sfx('click', 0.6); }, { capture: true });
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { audio.sfx('open', 0.7); return show.call(this); };
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => audio.sfx('close', 0.6)));
}
