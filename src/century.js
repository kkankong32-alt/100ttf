// 100년 변화 표현 규칙(순수 함수, Phaser 없음 — Node 테스트 공용). Codex century-change-v1 안내서 기준.
// 과학 출력(대표 나무 상태·수관)은 읽기만 한다. 시대 건물·잔재 단계는 '대표 변화 장면' 연출이며 예측이 아니다.

// 공통 세월 변화(선택과 무관): 2026–2045 원래, 2046–2085 수선·노후, 2086–2125 1차 리모델링, 2126 2차 리모델링·거리 재정비
export const eraOf = year => year >= 2126 ? 2126 : year >= 2086 ? 2086 : year >= 2046 ? 2046 : 2026;
export const ERA_CAPTION = {
  2026: '지금의 마을',
  2046: '20년 뒤 — 건물이 낡고 고쳐 써요',
  2086: '60년 뒤 — 건물을 새로 꾸몄어요',
  2126: '100년 뒤 — 거리를 다시 정비했어요',
};
// 건물 텍스처 키(전체·분할 중 MG/FG만 사용). 2086 상점은 기존 2126 원화 그대로, 학교·주택은 저장통 제거 보정본.
export function buildingKeys(key, era) {
  const sh = `${key}_${era >= 2086 ? 2126 : 2026}_shadow`;
  if (era === 2026) return { mg: `${key}_2026_mg`, fg: `${key}_2026_fg`, shadow: sh };
  if (era === 2086 && key === 'shop') return { mg: 'shop_2126_mg', fg: 'shop_2126_fg', shadow: sh };
  return { mg: `cc_${key}_${era}_mg`, fg: `cc_${key}_${era}_fg`, shadow: sh };
}

// 살아 있는 나무 단계(수관폭 m): <3 지지대 묘목, <6 어린, <10 중간, 그 이상 큰 나무
export const stageOfCrown = c => c < 3 ? 'staked' : c < 6 ? 'young' : c < 10 ? 'mid' : 'mature';
// 표시 수관폭(px) = 32 + 16 × 수관 m — 가독성용 표시 배율(실측 환산·과학 계산 아님)
export const crownPx = c => 32 + 16 * c;

// 대표 나무 → 화면 계획. tl = heat.timelapse[TC*] (10년 간격 스냅숏), slot = 가로수 번호.
// 살아 있으면 그 수관 그대로. 아니면 '이번 비수목 구간이 처음 나타난 스냅숏' 이후 경과로 잔재 단계를 고름:
// 0–9년 선 고사목, 10–19년 쓰러진 잔재, 20–39년 그루터기, 40년 이상 빈 식재 자리(실제 고사·분해 시점 예측 아님).
export function treePlan(rep, slot, year, tl) {
  if (!rep) return { stage: 'staked', crown: 1, age: 0 };
  if (rep.state === 'tree') return { stage: stageOfCrown(rep.crown_m), crown: rep.crown_m, age: rep.age ?? 0 };
  const years = Object.keys(tl || {}).map(Number).filter(y => y <= year).sort((a, b) => a - b);
  let since = year, lastCrown = 3;
  for (let i = years.length - 1; i >= 0; i--) {
    const r = tl[years[i]]?.trees?.[slot]?.rep;
    if (r?.state === 'tree') { lastCrown = r.crown_m; break; }
    since = years[i];
  }
  const el = year - since;
  return { stage: el < 10 ? 'dead' : el < 20 ? 'fallen' : el < 40 ? 'stump' : 'empty', crown: lastCrown, since, illustrative: true };
}

// 운동장 녹화 나무(모델은 나이 없는 '잔디+나무 그늘' 피복) — 심은 해는 묘목, 이후 중간 나무로 고정(연출)
export const schoolyardPlan = year => year <= 2026 ? { stage: 'staked', crown: 2 } : year < 2046 ? { stage: 'young', crown: 5 } : { stage: 'mid', crown: 8 };

// 화면에 보이는 2126 미래의 '선택 요약'(비교·발견 문구용, 수치 없음)
export function futureSummary(c1, c2, c3) {
  const care = c3 ? c3.treeCare : 1, fc = c3 ? c3.facilityCare : 1;
  return {
    trees: !c1.streetTrees ? 'none' : care ? 'cared' : 'neglected',
    water: (c2.permeable || c2.rainGarden || c2.basin) ? (fc ? 'kept' : 'clogged') : 'none',
    yard: !!c1.schoolyard,
  };
}
