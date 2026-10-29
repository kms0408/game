// 챕터별 방 구성 데이터. ExploreScene이 이 설정을 읽어 방을 만든다.
// objects 종류:
//   enemy  — 전투 상대. flag가 서면 사라지고, 모든 flag가 차면 문이 열린다
//   clock  — 3장 전용 시계 장치 (조사 시 시간 정지 이벤트)
//   memory / mirror / npc — 조사·대화 오브젝트. flag와 선택적 보상을 가진다
export const CHAPTERS = {
  0: {
    id: 0,
    title: '튜토리얼',
    tutorial: true,                       // 조작법 안내만 있는 방
    bg: 'bg-ch0',
    doorX: 320
  },
  1: {
    id: 1,
    title: '1장 — 빛을 잃은 자',
    bg: 'bg-ch1',
    doorX: 200,
    introDialogue: 'ch1_intro',
    objects: [{
      kind: 'enemy', key: 'enemy1', name: '불안한 그림자',
      x: 320, y: 170, hp: 26, atk: 5, type: 'time',
      preDialogue: 'enemy1_pre', postDialogue: 'enemy1_post',
      reward: { fragment: true, skill: '힘의 일격' },
      flag: 'enemy1_dead'
    },
    { kind: 'clock', x: 545, y: 130 }],
    lockedMsg: '문이 열리지 않는다. 저 그림자가... 길을 막고 있는 것 같다.'
  },
  2: {
    id: 2,
    title: '2장 — 초조한 마음',
    bg: 'bg-ch2',
    doorX: 140,
    introDialogue: 'ch2_intro',
    objects: [{
      kind: 'enemy', key: 'enemy2', name: '초조한 그림자',
      x: 320, y: 170, hp: 78, atk: 9, type: 'time',
      preDialogue: 'enemy2_pre', postDialogue: 'enemy2_post',
      reward: { fragment: true, skill: '잔상 베기' },
      flag: 'enemy2_dead'
    },
    { kind: 'clock', x: 545, y: 140 }],
    lockedMsg: '아직이다. 저 그림자의 시선이... 여전히 나를 쫓고 있어.'
  },
  3: {
    id: 3,
    title: '3장 — 멈춘 시간의 방',
    bg: 'bg-ch3',
    doorX: 440,
    loops: true,                          // 문을 나가도 같은 방으로 돌아온다
    introDialogue: 'ch3_intro',
    loopDialogue: 'ch3_loop',             // 맴돌 때마다 바뀌는 독백
    unlockFlag: 'ch3_unlocked',           // 시계 이벤트 후 진행 해금
    // 이 시계만 '멈춰' 있다 — 다른 챕터의 시계는 전부 정상 작동한다
    objects: [{ kind: 'clock', x: 90, y: 130 }]
  },
  4: {
    id: 4,
    title: '4장 — 낯선 방랑자',
    bg: 'bg-ch4',
    doorX: 500,
    introDialogue: 'ch4_intro',
    objects: [{
      kind: 'npc', key: 'wanderer', name: '방랑자',
      x: 320, y: 160, dialogue: 'wanderer', flag: 'ch4_met',
      reward: { fragment: true }, scale: 3
    },
    { kind: 'clock', x: 85, y: 300 }],
    lockedMsg: '문이 움직이지 않아... 저 방랑자가 무언가 말하려는 것 같다.'
  },
  5: {
    id: 5,
    title: '5장 — 두 개의 그림자',
    bg: 'bg-ch5',
    doorX: 320,
    introDialogue: 'ch5_intro',
    objects: [
      {
        kind: 'enemy', key: 'enemy2', name: '분노한 그림자',
        x: 230, y: 170, hp: 146, atk: 23, type: 'power', pattern: 'rage',
        preDialogue: 'enemy_rage_pre', postDialogue: 'enemy_rage_post',
        reward: { fragment: true },
        flag: 'rage_dead'
      },
      {
        kind: 'enemy', key: 'enemy1', name: '두려운 그림자',
        x: 410, y: 170, hp: 128, atk: 18, type: 'mind', pattern: 'fear',
        preDialogue: 'enemy_fear_pre', postDialogue: 'enemy_fear_post',
        reward: { fragment: true },
        flag: 'fear_dead'
      },
      { kind: 'clock', x: 555, y: 140 }
    ],
    lockedMsg: '두 그림자가 길을 막고 있다. 둘 다 마주해야 해.'
  },
  6: {
    id: 6,
    title: '6장 — 거울의 방',
    bg: 'bg-ch6',
    doorX: 200,
    introDialogue: 'ch6_intro',
    objects: [
      // 문(200) 앞 통로를 막지 않도록 왼쪽 거울은 아래로 내린다
      { kind: 'mirror', key: 'mirror', x: 200, y: 240, dialogue: 'mirror1', flag: 'ch6_m1' },
      { kind: 'mirror', key: 'mirror', x: 320, y: 150, dialogue: 'mirror2', flag: 'ch6_m2' },
      { kind: 'mirror', key: 'mirror', x: 440, y: 150, dialogue: 'mirror3', flag: 'ch6_m3' },
      { kind: 'clock', x: 555, y: 310 }
    ],
    lockedMsg: '문이 굳게 닫혀 있다. 거울들이... 날 보고 있는 것 같다.'
  },
  7: {
    id: 7,
    title: '7장 — 침묵의 심연',
    bg: 'bg-ch7',
    doorX: 440,
    introDialogue: 'ch7_intro',
    objects: [{
      kind: 'enemy', key: 'enemy3', name: '슬픈 그림자',
      x: 320, y: 170, hp: 170, atk: 22, scale: 4, radius: 50, type: 'mind', pattern: 'sorrow',
      preDialogue: 'enemy3_pre', postDialogue: 'enemy3_post',
      reward: { fragment: true },
      flag: 'enemy3_dead'
    },
    { kind: 'clock', x: 85, y: 150 }],
    lockedMsg: '문이 열리지 않아. 저 울음소리가 신경 쓰여. 가까이 가 보자.'
  },
  8: {
    id: 8,
    title: '8장 — 마지막 문턱',
    bg: 'bg-ch8',
    doorX: 140,
    introDialogue: 'ch8_intro',
    objects: [{
      kind: 'npc', key: 'inner-self', name: '낯선 목소리',
      x: 320, y: 160, dialogue: 'inner_return', flag: 'ch8_met',
      // 보스전 직전에 최종 필살기 '심연의 파동'을 건네준다
      reward: { fragment: true, skill: '심연의 파동' }, scale: 3
    },
    { kind: 'clock', x: 545, y: 140 }],
    lockedMsg: '문이 움직이지 않아. 시계 옆에서 만났던 이에게 먼저 물어보자.'
  },
  9: {
    id: 9,
    title: '9장 — 그림자의 심연',
    bg: 'bg-ch9',
    doorX: 320,
    introDialogue: 'ch9_intro',
    objects: [{
      kind: 'enemy', key: 'boss', name: '그림자',
      x: 320, y: 170, hp: 420, atk: 27, scale: 5, radius: 60, type: 'time',
      preDialogue: 'boss_pre',
      flag: 'boss_dead',
      finale: true                          // 패배 직전 이벤트 + 승리 시 반전 컷신
    },
    { kind: 'clock', x: 85, y: 140 }],
    lockedMsg: '뒤로 물러날 곳은 없다. 저 그림자를... 마주해야 한다.'
  }
};

// 전투 스킬 정보 — 스토리 진행에 따라 하나씩 해금된다.
// mult: 공격력 대비 피해 배율 / mp: 사용 시 소모하는 마나 / type: 상성 타입 (TYPES 참조)
// fx: 타격 연출 / pierce: 방어 관통 / focus: 다음 공격 강화 / cooldown: 재사용 전 필요한 다른 행동 수
export const SKILL_INFO = {
  '힘의 일격': { mult: 1.8, mp: 7, type: 'power', desc: '적의 방어를 관통하며, 방어 중인 적에게 피해 1.5배.', fx: 'heavy', color: 0xff8a6a, pierce: true },
  '잔상 베기': { mult: 2.3, mp: 10, type: 'time', desc: '빠르게 네 번 벤다. 표시 피해는 네 타격의 합계.', fx: 'wave', color: 0xffd27a, hits: 4 },
  '마음의 눈': { mult: 1.8, mp: 8, type: 'mind', desc: '공격 후 집중: 다음 공격 피해 +25% (연속 사용 시 중첩 불가, 방어 유지).', fx: 'twin', color: 0x7fffd8, focus: true },
  '심연의 파동': { mult: 3.5, mp: 18, type: 'power', desc: '빛을 모아 쏜다. 사용 후 다른 행동 2회로 재충전.', fx: 'burst', color: 0xb98aff, cooldown: 2 }
};

// 상성 삼각관계 — 힘 ▶ 시간 ▶ 마음 ▶ 힘 (공격 타입이 방어 타입을 이긴다)
// beats: 이 타입의 공격이 강점을 찌르는 방어 타입
export const TYPES = {
  power: { name: '힘',   color: '#ff8a6a', beats: 'time' },
  mind:  { name: '마음', color: '#7fffd8', beats: 'power' },
  time:  { name: '시간', color: '#ffd27a', beats: 'mind' }
};
export const STRONG_MULT = 1.5;   // 상성 우위 피해 배율
export const WEAK_MULT = 0.6;     // 상성 불리 피해 배율
