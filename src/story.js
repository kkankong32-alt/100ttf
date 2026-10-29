// 이야기 흐름(순수 함수, Node 테스트 공용): 장 구성, 현재 장, 3장 '약속 기록장' 문장.
// 기록장 문장은 이미 계산된 결과(heat.json 대표 나무·그늘 칸, scenario-results 유출)와 선택 상태에서만 만든다 — 새 수치 없음.
// 받침에 맞는 조사(core.js josa와 같음 — 이 파일은 Node 테스트에서도 쓰여 DOM 모듈을 가져오지 않음)
const josa = (w, pair) => { const [a, b] = pair.split('/'), c = String(w).trim().slice(-1).charCodeAt(0) - 0xAC00, has = c >= 0 && c <= 11171 && c % 28 !== 0;
  return w + (['가', '를', '는', '와', '로', '랑', '예요'].includes(a) ? (has ? b : a) : (has ? a : b)); };
export const CHAPTERS = {
  1: { title: '그늘이 사라진 등굣길', start: '100년 뒤 폭염 속 하늘이를 돕고, 그늘이 사라진 이유를 찾아요' },
  2: { title: '빗물이 돌아오는 길', start: '100년 뒤 큰비가 오는 날, 시장길 물길을 찾고 빗물 시설을 만들어요' },
  3: { title: '100년의 약속', start: '돌봄이 끊긴 흔적을 찾고, 다음 세대로 이어지는 약속을 만들어요' },
  4: { title: '우리가 남긴 마을', start: '백년시계 앞에서 내가 바꾼 100년 뒤를 돌아봐요' },
};
// 지금 진행 중인 장(0 = 프롤로그)
export function chapterOf(s) {
  if (s.prologue !== 'done') return 0;
  if (!s.prog.ch1) return 1;
  if (!s.prog.ch2) return 2;
  if (s.ch3.phase !== 'done') return 3;
  return 4;
}
export const NO_PROMISE = { treeCare: 0, facilityCare: 0, forestLaw: 0 };
export const PLACES = ['trees', 'water', 'hill'];
export const PLACE_NAME = { trees: '가로수 길', water: '빗물 시설', hill: '뒷산(안내판 소식)' };
const promiseCount = c3 => c3 ? c3.treeCare + c3.facilityCare + c3.forestLaw : 0;
export const hasPromise = c3 => promiseCount(c3) > 0;

// 한 장소의 기록: { grade: good|mid|bad|none, icon, text }. heatScenario = heat.json scenarios[키], swmm = scenario-results 한 행
export function ch3Record(place, c1, c2, c3, heatScenario, swmm) {
  const care = c3 ?? { treeCare: 1, facilityCare: 1, forestLaw: 1 };
  if (place === 'trees') {
    if (!c1.streetTrees) return { grade: 'none', icon: '⬜', text: '가로수를 심지 않은 길이에요. 그늘이 거의 없어요.' };
    const live = heatScenario.trees.filter(t => t.rep.state === 'tree').length, all = heatScenario.trees.length;
    const shade = Math.round(heatScenario.summary.route_shade_frac * 100);
    if (live >= all * 0.7) return { grade: 'good', icon: '🌳', text: `나이가 다른 가로수가 줄지어 있어요(대표 나무 ${live}/${all}). 죽은 자리에 다시 심어 그늘이 이어졌어요. 등굣길 그늘 칸 ${shade}%.` };
    if (live >= all * 0.25) return { grade: 'mid', icon: '🌱', text: `가로수가 군데군데 남았어요(대표 나무 ${live}/${all}). 등굣길 그늘 칸 ${shade}%.` };
    return { grade: 'bad', icon: '🍂', text: `빈 나무 자리만 남았어요(대표 나무 ${live}/${all}). 죽은 나무 자리에 다시 심지 않았어요. 등굣길 그늘 칸 ${shade}%.` };
  }
  if (place === 'water') {
    const built = c2.permeable || c2.rainGarden || c2.basin, mm = swmm.runoff_mm;
    const names = [c2.permeable && '물이 스미는 바닥', c2.rainGarden && '빗물정원', c2.basin && '빗물 연못'].filter(Boolean).join('·');
    if (!built) return { grade: 'none', icon: '⬜', text: `빗물 시설을 만들지 않았어요. 큰비가 올 때 마을에서 흘러간 빗물 ${mm} mm.` };
    if (care.facilityCare) return { grade: 'good', icon: '💧', text: `${josa(names, '를/을')} 청소해 빗물을 받아요. 큰비가 올 때 흘러간 빗물 ${mm} mm.` };
    return { grade: 'bad', icon: '🟫', text: `${josa(names, '가/이')} 흙과 낙엽으로 막혔어요(게임 속 가정: 효과가 거의 없어져요). 흘러간 빗물 ${mm} mm.` };
  }
  if (c1.forest === 'parking') return { grade: 'bad', icon: '🅿', text: '안내판: 2026년에 뒷산 숲을 주차장으로 개발했어요.' };
  if (care.forestLaw) return { grade: 'good', icon: '🌲', text: '안내판: 숲 지키는 마을 규칙 덕분에 뒷산 숲이 그대로 남았어요.' };
  return { grade: 'bad', icon: '🏗', text: '안내판: 지키는 약속이 없어 뒷산 숲의 절반이 개발됐어요(게임 속 가정이에요).' };
}
