# 시간 (Echo of Self) — 소프트웨어 기술 명세서

## 1. 프로젝트 개요

### 1.1 프로젝트 목표
"To The Moon" 스타일의 탑다운 2D 픽셀 스토리 RPG. 평화로운 마을이 최종보스 '그림자'에 의해 폐허가 되고, 주인공이 평화를 되찾기 위해 모험을 떠나며 적들을 쓰러뜨리고 성장합니다. 최종적으로 "보스의 정체는 미래의 자신이었다"는 반전을 통해 자기 자신을 마주하는 이야기를 담은 인디 스토리 게임을 구축합니다.

### 1.2 스토리 컨셉

```
프롤로그: 평화로운 하루를 보내던 날
   → 최종보스 '그림자'로 인해 마을이 폐허가 됨
   → 주인공은 평화를 되찾기 위해 모험을 떠난다
   ↓
챕터 진행: 적들을 쓰러뜨리며 '힘의 조각'을 모으고 성장
   ↓
반복 챕터: 문으로 나가도 같은 방으로 돌아옴
   → 시계 상호작용 → 시간 정지 → 내면의 자신과 대화 → 성찰을 통한 성장
   ↓
최종보스전: 도중 모은 힘 탈취 → 과거에 쓰러뜨린 적들이 아군으로 등장 → 승리
   ↓
반전: 최종보스는 미래의 자신이었다
   → 삶을 살아가며 수많은 좌절과 절망을 겪은 미래의 자신이 세상을 파괴하려 했던 것
   → 지금까지 쓰러뜨린 모든 적도 그 안의 절망의 조각들이었다
   → 교훈 메시지: "당신들의 인생도 포기하지 않고 꼭 나아가시길 바랍니다"
```

### 1.3 현재 구현 범위
- 타이틀 화면: 클리어 전 모래시계(`sand-clock`) 애니메이션 / 엔딩 직후 타이틀 복귀 시 실시간 디지털시계(`digital-clock`, `HH:MM:SS`) 이스터에그 표시 + 체크포인트 `이어하기` 버튼 지원
- 프롤로그 (플레이 가능한 탑다운 마을 산책 → 보스 습격 → 마을 파괴 → 광장 차원 포털 생성 및 보스 퇴장 → 주인공의 포털 도약 추격 연출)
- 0장: 튜토리얼 (이동·안내판 조사 목표 체크리스트)
- 1장: 탐험 + 첫 턴제 전투 + 성장 (`힘의 일격` 습득)
- 2장: 초조한 그림자 전투 (`잔상 베기` 습득, 강공격 차징 패턴 도입)
- 3장: 반복되는 방 + 멈춘 괘종시계 장치(초침 정적) + 시간 정지 및 내면 대화 (`마음의 눈` 습득, 해금 후 시계추·초침 재작동)
- 4~8장: 방랑자/내면 NPC 스토리 챕터 + 5장·7장 전투 챕터 + 6장 거울 환영(`inner-self`/`boss` 실루엣) 조사 챕터
- 9장: 최종보스전 (패배 직전 이벤트 → 과거 모든 그림자 `enemy1~3` + `inner-self` 4인 집결 원군) + '미래의 자신' 반전/포용 컷신 + 광장 귀환 포털 에필로그 + 엔딩 크레딧(`LETTER`)
- Web Audio API 프로시저럴 사운드 시스템 (`SoundSystem.js`): 탐험/전투/스토리 오르골 BGM 및 타이핑·메뉴·타격·차징·시계 초침·시간 정지 효과음

### 1.4 기술 스택

| 항목 | 내용 |
|------|------|
| 게임엔진 | Phaser 3.70+ |
| 빌드 도구 | Vite 5 |
| 언어 | 순수 JavaScript (ES Modules) |
| 물리 | Arcade Physics (중력 없음, 탑다운) |
| 해상도 | 640 × 480, pixelArt 렌더링 |
| 에셋 | 캔버스 프로시저럴 픽셀 아트 + Web Audio API 프로시저럴 사운드 + 타이틀 배경 이미지 (`public/assets/title-bg.webp`) |

## 2. 시스템 아키텍처

### 2.1 디렉토리 구조

```
project(game)/
├── index.html                  # 진입점, 게임 컨테이너 및 좌우 상태/스킬 사이드 패널
├── package.json
├── vite.config.js
├── docs/
│   ├── spec.md                 # 본 기술 명세서
│   └── todo.md                 # 단계별 구현 체크리스트
└── src/
    ├── main.js                 # Phaser 게임 설정, 씬 등록, 사이드 패널 DOM 동기화
    ├── scenes/
    │   ├── BootScene.js        # 프로시저럴 스프라이트/배경/애니메이션 생성, 디버그 점프
    │   ├── TitleScene.js       # 타이틀 화면 (새 게임 / 이어하기 / 클리어 시계 이스터에그)
    │   ├── StoryScene.js       # 컷신 스크립트 인터프리터
    │   ├── PrologueScene.js    # 프롤로그/에필로그 마을 (산책 → 보스 습격 → 포털 추격 / 포털 귀환)
    │   ├── ExploreScene.js     # 탑다운 탐험 (방, 이동, 상호작용, 시계/거울 연출)
    │   └── BattleScene.js      # 턴제 전투 (상성, 스킬 이펙트, 적 차징, 최종전 원군)
    ├── data/
    │   ├── chapters.js         # 챕터(0~9장) 설정, 스킬 정보(SKILL_INFO), 상성(TYPES)
    │   └── dialogues.js        # 대화(DIALOGUES), 컷신(SCRIPTS), 개발자의 편지(LETTER)
    ├── systems/
    │   ├── DialogueSystem.js   # 대화창 + 타이핑 효과 + 화자별 타이핑 사운드
    │   ├── PlayerState.js      # 플레이어 상태 싱글톤 + localStorage 자동 저장/불러오기
    │   └── SoundSystem.js      # Web Audio API 기반 BGM 및 효과음 신디사이저
    └── objects/
        ├── Player.js           # 탐험 캐릭터 (이동/애니메이션/발밑 그림자)
        └── Interactable.js     # 상호작용 오브젝트 (충돌 바디/발밑 그림자/프롬프트)
```

### 2.2 씬 전환 플로우

```
BootScene (텍스처·애니메이션 생성)
   ↓
TitleScene ──▶ 이어하기(저장 존재 시) ──→ ExploreScene(저장된 chapter)
   │
   └──▶ 시작하기/처음부터 ──→ 모래시계 로딩(약 3초) → StoryScene('prologue')
                              ↓ quote 인용구 → goto
                          PrologueScene — 마을 산책(목표: 광장 도달)
                              ↓ 광장 도달 시: 보스 강림 → 마을 파괴 → 보스 포털 퇴장 → 주인공 포털 도약 추격
                          ExploreScene(chapter=0, 튜토리얼)
                              ↓  문 (이동·안내판 목표 달성 시)
                          ExploreScene(chapter=1~2) — 그림자 전투 → 힘의 조각·스킬 습득 (자동 저장)
                              ↓  문 (모든 오브젝트 플래그 필요)
                          ExploreScene(chapter=3) ⟲── 열린 문 → loopCount++ → 같은 방 재시작
                              │  멈춘 괘종시계 조사(1회 이상 루프 후): 시간 정지 → 내면 대화 → ch3_unlocked & 시계 재작동
                              ↓  문
                          ExploreScene(chapter=4~8) — 챕터마다 배치가 다르다 (자동 저장)
                              │  4장·8장 NPC 대화 / 5장·7장 전투 / 6장 거울 환영 조사
                              ↓  문
                          ExploreScene(chapter=9) → 보스 조우 → BattleScene(최종전)
                              │  HP 0 도달 시 1회: 모은 힘 탈취 → 지나온 모든 그림자(4인) 원군 등장 → 부활
                              ↓  승리
                          StoryScene('reveal') → '미래의 자신' 반전 및 포용 컷신
                              ↓  fadeout → goto
                          PrologueScene(에필로그) — 광장 귀환 포털에서 등장 → 주민들 환영 대화 → 자동 페이드아웃
                              ↓
                          StoryScene('ending') → 최종 독백 quote → letter 크레딧 → TitleScene(디지털시계 이스터에그)
```

### 2.3 씬 간 데이터 전달

| 방식 | 용도 |
|------|------|
| `scene.start(key, data)` 파라미터 | 컷신 스크립트명, 챕터 번호, 전투 설정, 복귀 씬 정보 |
| `playerState` 싱글톤 (import) | HP/공격력/스킬/스토리 플래그 등 영속 상태 |

## 3. 씬 상세 명세

### 3.1 BootScene (`src/scenes/BootScene.js`)

외부 에셋 없이 `createCanvas`로 모든 텍스처를 런타임 생성한다.

**핵심 함수**
- `px(ctx, x, y, w, h, color)`: 픽셀 사각형 헬퍼
- `drawCharacter(ctx, opts)`: 16×16 캐릭터 그리기 — 감성 판타지 후드 여행자 디자인(깊은 후드·따뜻한 얼굴/그림자 얼굴·눈망울/안광·붉은 스카프·금장 외투). `opts`로 방향(`dir`), 걷기 프레임(`walk`), 팔레트(outline/helm/plate/cloth/accent/eye/legs), 뿔(`horns`), 스카프(`scarf`) 지정
- `drawRoomBg(ctx, p)` & `drawWindowLight(ctx, p, wx)`: 실내 석재 타일 격자 바닥 + 뒷벽 웨인스코팅 몰딩 + 창문에서 바닥으로 쏟아지는 사다리꼴 빛줄기(God ray)
- `makeTexture(scene, key, w, h, drawFn)`: 캔버스 텍스처 생성 래퍼

**생성 텍스처 목록**

| 키 | 설명 |
|----|------|
| `hero-{dir}-{walk}` | 주인공 4방향 × 2프레임 (8종) |
| `inner-self` | 내면의 자신 — 주인공과 동일 실루엣, 창백한 팔레트 |
| `enemy1` | 불안/두려움의 그림자 — 동일 실루엣, 푸른 팔레트 |
| `enemy2` | 초조/분노의 그림자 — 동일 실루엣, 호박색 팔레트 |
| `enemy3` | 슬픔의 그림자 — 동일 실루엣, 보라색 팔레트 |
| `boss` | 최종보스 — 동일 실루엣 + 그림자 왕관 뿔 + 붉은 안광 |
| `wanderer` | 방랑자 NPC — 동일 실루엣 + 스카프, 따뜻한 팔레트 |
| `mirror` | 서 있는 거울 (6장 조사 오브젝트) |
| `wall` | 16×16 비가시 충돌 바디용 벽 타일 |
| `door` / `door-open` | 26×40 목조 출구 문 (닫힌 문 / 빛이 새어 나오는 열린 문) |
| `sign` | 서 있는 목조 안내판 |
| `clock` / `clock-1` / `clock-stopped` | 16×24 앤티크 괘종시계 (좌우로 흔들리는 황금 시계추 2프레임 + 3장 전용 멈춘 시계) |
| `digital-clock` | 클리어 후 타이틀 이스터에그용 발광 탁상 디지털시계 프레임 (88×38) |
| `sand-clock-0~7` | 모래가 흘러내리는 모래시계 8프레임 (40×56) |
| `night-bg` / `vignette` | 밤 마을 분위기 배경 640×480 및 비네팅 오버레이 |
| `bg-ch0`~`bg-ch9` | 챕터별 실내 탐험 배경 640×480 — 시간대별 창밖 도시 풍경 + 석재 타일 바닥 + 창문 빛줄기(God ray) + 액자/러그 |
| `battle-bg` | 전투 아레나 배경 640×480 — 거대 시계판(Clockwork Arena, 12방향 눈금·시침/분침) 마법진 + 적/플레이어 발판 스포트라이트 |
| `village-bg` | 프롤로그 마을 배경 640×480 — 잔디 + 자갈길 광장 + 초가 큰집 + 파란 지붕 집들 + 울타리 논밭 + 나무 + 가로등 |
| `villager-farm` / `villager-wood` / `villager-chat` | 마을 사람 — 같은 실루엣, 따뜻한 피부톤과 농부·나무꾼·이웃 의복 팔레트 |

**애니메이션**:
- `hero-walk-{dir}` (4종, 6fps, 2프레임 반복)
- `clock-tick` (괘종시계 시계추 왕복, 1.5fps, 반복)
- `sand-flow` (로딩 모래시계, 3fps) / `sand-flow-slow` (타이틀 상단 모래시계, 1.2fps)

**설계 의도**: 모든 적이 주인공과 동일한 실루엣의 팔레트 변형이다. "적 = 자기 자신" 반전의 시각적 복선.

### 3.2 TitleScene (`src/scenes/TitleScene.js`)

- 제목 "시 간" + 상단 시계 장식 표시:
  - **기본 상태**: 옛날 모래시계(`sand-clock`)가 약 6.7초 주기로 천천히 흐르며 180° 뒤집힌다.
  - **엔딩 직후 복귀 상태 (`playerState.justCleared`)**: 모래시계 대신 현대적인 디지털시계(`digital-clock`)가 나타나 플레이어의 실제 현재 시각(`HH:MM:SS`)을 1초마다 실시간으로 표시하고, *"— 지금, 당신의 시간이 흐르고 있습니다 —"* 부제를 노출한다. (영구 고정되지 않으며 새 게임 시작이나 새로고침 시 다시 모래시계로 돌아온다.)
- 저장된 체크포인트(`localStorage`)가 존재할 경우 상단에 `▶ 이어하기 (N장)` 버튼이 추가로 노출되어 즉시 해당 챕터로 복귀할 수 있다. (마우스 클릭 및 방향키/WASD + E/Enter/Space 키보드 조작 모두 지원)
- 새 게임(`▶ 시작하기` / `▶ 처음부터`) 클릭 → 상태 및 세이브 초기화 → `night-bg` 배경 위 모래시계 전환 연출(약 1.6초, 키/클릭으로 즉시 스킵 가능) → `StoryScene`에 `{ script: 'prologue' }` 전달

### 3.3 StoryScene (`src/scenes/StoryScene.js`)

`SCRIPTS`에 정의된 명령 배열을 순서대로 실행하는 컷신 인터프리터 (`story` 오르골 BGM 재생).

**명령 타입**

| type | 파라미터 | 동작 |
|------|----------|------|
| `spawn` | id, key, x, y, scale | 액터 스프라이트 배치 (`this.actors[id]`에 저장) |
| `dialogue` | key | `DIALOGUES[key]` 대화 재생, 완료 시 다음 명령 |
| `quote` | text | `night-bg` 배경 위 중앙에 인용구 표시, E키 입력 시 다음 명령 |
| `swap` | id, key | 액터 텍스처 교체 (섬광 후 `setTexture`) — 반전 연출용 |
| `fadeout` | — | 카메라 페이드아웃 후 다음 명령 |
| `black` | — | 검은 오버레이 페이드인 후 다음 명령 |
| `letter` | — | 개발자의 편지(`LETTER`) 상향 스크롤 크레딧 (SPACE 길게 눌러 빨리 감기) |
| `goto` | scene, data | 다른 씬으로 전환 |
| `title` | — | 페이드아웃 후 `playerState.markCleared()`(디지털시계 이스터에그 활성화) 및 세이브 초기화 후 타이틀 복귀 |

### 3.4 PrologueScene (`src/scenes/PrologueScene.js`)

평화로운 마을을 직접 걸어다니는 플레이 가능한 프롤로그 (참고 이미지 `picture/마을.jpeg`의 탑다운 마을 구도 재현).

**흐름**
1. `village-bg` 배경 + `Player` 생성(320, 300, 발밑 그림자 포함) + 건물/울타리/나무 충돌체(비가시 정적 그룹)
2. `setupVillagers()`: 일상을 보내는 마을 사람 6명(발밑 그림자 포함) — 논밭 농부 3명 + 우상단 나무 앞 벌목꾼 + 큰집 앞 수다 2명
3. 목표 체크리스트 + 광장 방향 화살표(320, 210) 표시, `prologue1` 독백 재생
4. 광장 남쪽 입구(x 230~410, y<268) 도달 → `bossArrives()`: 플레이어 동결·위 응시 → 하늘 어두워짐(veil) → 초가집 앞 자갈길 광장 중앙(320, 192)으로 `boss` 강림 트윈(바닥 그림자 확대) → `prologue_boss` 대화
5. `destroyVillage()` 폐허 연출: 주민들이 옆으로 쓰러지며 색이 바램 + 건물 지붕에 그을음 얼룩 + 잿빛 오버레이 + 불길 파티클 + 피어오르는 연기 + 붉은 섬광 + 보스 확대 → `prologue2_boss` 대화
6. `bossLeaves()` & `leaveVillage()`: 광장 중앙 돌바닥(320, 212)에 입체적인 3중 타원 차원 포털(`createPortal`)이 열리고 보스가 그 안으로 빨려 들어가 사라짐 → 주인공 결의 대화(`prologue2_chase`) → 주인공이 자갈길 위를 달려가 포털 위로 도약·진입하는 입체 연출 후 `ExploreScene(chapter=0)` 전환

- 디버그 점프: `?to=prologue`

**에필로그 모드** (`data.epilogue: true`)
- 습격 이벤트 없이 평화를 되찾은 마을을 보여준다 — 주민 6명이 각자 일상으로 돌아와 일하고 있다.
- 광장 중앙(320, 212)에 따뜻한 청록·금빛 귀환 포털이 열리고, 주인공이 포털 중심에서 솟아올라 착지한 뒤 광장 남쪽(y: 268)으로 걸어 나온다.
- 주민들이 하던 일을 멈추고 달려와 주변으로 모여든다 (`villagersRunToHero()`).
- `epilogue_village` 대화가 끝나면 별도 키 입력 없이 0.6초 여운 후 자동 페이드아웃되어 `StoryScene('ending')`으로 전환된다.

### 3.5 ExploreScene (`src/scenes/ExploreScene.js`)

챕터 번호(`data.chapter`)를 받아 `CHAPTERS` 설정으로 방을 구성하며, 진입 시 `playerState.save()`로 체크포인트를 자동 저장한다.

**방 구조**
- 배경: 챕터별 실내 텍스처(`conf.bg`, `bg-ch0`~`bg-ch9`) 640×480
- 벽: 테두리 및 뒷벽 하단(y=118) 정적 물리 그룹(비가시), 챕터별 `doorX` 위치(±24px)에 문 틈
- 문: 클리어 시(또는 `loops: true` 반복 챕터 시) 열린 문(`door-open`)과 바닥 빛무리(`doorGlow`) 표시 (상태 변화 시에만 텍스처 갱신)
- 사운드: `explore` BGM 재생 + 시계가 있는 방에서는 1초 주기 초침 소리(`startClockTick`) 재생 (단, 3장 멈춘 시계는 해금 전까지 무음)

**주요 메서드**

| 메서드 | 역할 |
|--------|------|
| `buildRoom()` | 배경/벽/문 스프라이트 생성 |
| `runDialogue(keyOrLines, onDone)` | 대화 재생 중 플레이어 조작 잠금 |
| `setupTutorial()` | 0장: 목표 체크리스트, 문 화살표, 안내판 배치 |
| `setupChapter()` | 1~9장 공통: 인트로/루프 독백 + `conf.objects` 순회 배치 |
| `spawnObject(o)` | 오브젝트 종류별 배치 (적 호흡 모션·어둠 입자, 일반 괘종시계 `clock-tick` vs 3장 멈춘 시계 `clock-stopped`) |
| `showMirrorReflection(o)` | 6장 거울 조사 시 거울 표면에 `inner-self` / `boss` 실루엣이 스쳐 지나가는 연출 |
| `onObjectDone(o, it)` | 조사 완료 처리 — 플래그, 힘의 조각/스킬 보상, 자동 저장, 해금 안내 |
| `isCleared()` | 모든 오브젝트 플래그 + `unlockFlag` 충족 여부 |
| `timeStop()` | 시간 정지 사운드 + 회색 오버레이 + 내면의 자신 등장 + 대화 → `마음의 눈` 습득 & `ch3_unlocked` & 시계추/초침 재작동 |
| `onDoor()` | 문 분기 (클리어 → 다음 챕터 / 반복 챕터 → 루프 / 잠김 → `lockedMsg`) |

### 3.6 BattleScene (`src/scenes/BattleScene.js`)

턴제 전투. 기본 배속은 1이며, 강한 타격의 접촉 순간에만 트윈을 55ms 멈춘다. 근접 공격은 적을 향해 대각선으로 접근하고 원래 위치로 복귀하며, 마음의 눈·심연의 파동은 제자리에서 시전한다.
- **아레나 연출**: `battle-bg`(거대 시계판 마법진) 위에 적의 속성(`time`/`power`/`mind`/`finale`) 색조 베일과 맥동하는 이중 마법진 발판이 깔리며, 적 본체 뒤에는 본체 좌표를 실시간 추적하는 반투명 후광 실루엣(`enemyAura`)과 피어오르는 속성 입자가 렌더링된다.
- **타격과 턴 동기화**: `hitFx()`의 접촉 콜백에서 HP·피해 숫자·기술별 소리·넉백·흔들림을 함께 처리한다. 연속 참격은 총피해를 네 번에 나누며, 마지막 효과와 캐릭터 복귀가 모두 끝난 뒤 반격한다. 카메라 팬·줌과 반복적인 전체 화면 섬광 대신 표적 주변 연출을 사용한다.
- **스킬 선택**: 마지막 사용 기술을 기억하고, 목록에는 이름·MP·상성 표시를 배치한다. 하단에는 상성·집중·적 방어를 적용한 예상 피해 범위와 설명을 보여준다. MP 부족과 재충전 안내도 열린 스킬 창 안에 표시한다.
- **자원과 역할**: 적 턴에 MP +2(슬픔의 파동은 +1), 방어하면 MP +6. 힘의 일격은 방어를 관통하며 방어 중인 적에게 1.5배 피해, 마음의 눈은 다음 공격을 35% 강화한다. 집중은 방어 중 유지되며 다음 공격에 소비된다. 심연의 파동은 사용 후 다른 행동 두 번이 필요하다.

**적 강공격 차징 및 감정별 고유 패턴 (`enemyTurn`)**
- 2장 이후의 강적(`hp >= 60`)은 불길한 기운을 모으며 다음 턴 `2.3배` 피해의 **거센 일격**을 예고한다. 예고는 스킬 창을 열어도 보이는 고정 표시로 유지된다. 방어하면 강공격 피해는 `0.22배`, 일반 피해는 `0.3배`가 되고 MP +6을 회복한다. 방어막은 적의 행동이 끝날 때까지 유지된다.
- 감정별 적 특수 패턴(`pattern`):
  - `rage` (`분노한 그림자`): 분노로 들끓어 일반 강적(3턴 주기)보다 빠른 **2턴 주기**로 강공격 차징을 시도한다.
  - `fear` (`두려운 그림자`): 전투 시작부터 웅크리며, 견제 턴에도 다음 1회 받는 피해를 55% 경감한다. 힘의 일격으로 방어를 돌파할 수 있다.
  - `sorrow` (`슬픈 그림자`): 슬픔의 파동으로 비방어 시 플레이어의 턴당 자연 마나 회복량을 감소시킨다.

**최종전 (`enemy.finale: true`)**
- 전투 진입 시 초기 공격력(`this.initialAtk`)을 백업하여 반복 패배 후 재도전 시에도 공격력이 비정상 누적되지 않도록 보장한다.
- 보스 HP가 절반에 도달하거나 플레이어가 먼저 쓰러지면 `finalStand()`가 한 번 발동한다. 1단계 피해는 절반까지만 반영하고, 2단계는 보스 HP 절반에서 시작한다. 힘 탈취 → 원군 합류 → 플레이어 HP/MP 완전 회복과 공격력 +4 → 강공격 예고 순서로 진행한다. 집중·파동 재충전은 초기화되며, 재도전에서는 긴 원군 대화를 생략해도 강공격 예고를 유지한다.
- 승리 시 보상 대신 `StoryScene('reveal')` 반전 컷신으로 전환

## 4. 시스템 명세

### 4.1 DialogueSystem (`src/systems/DialogueSystem.js`)

어떤 씬에든 부착 가능한 대화창 시스템.

| 메서드 | 설명 |
|--------|------|
| `start(lines, onComplete)` | 대화 시작. `lines`: `[{speaker, text}]` |
| `advance()` | 타이핑 중이면 전체 표시, 아니면 다음 줄 (`sound.menuMove()`) |
| `finish()` | UI 정리 + 리스너 해제 + 완료 콜백 |

- 타이핑 속도: 55ms/자 (2글자마다 화자별 음높이가 다른 `sound.typeBlip(speaker)` 재생)
- 진행 입력: `E` / `SPACE` / `ENTER` 또는 대화창 클릭 — 대화창 우하단에 `"E / SPACE: 다음 ▶"` 안내 표시

### 4.2 PlayerState (`src/systems/PlayerState.js`)

모듈 싱글톤 상태 저장소 및 `localStorage` 체크포인트 관리.

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `chapter` | 0 | 현재 챕터 |
| `maxHp` / `hp` | 30 | 체력 |
| `maxMp` / `mp` | 20 | 마나 |
| `atk` | 6 | 공격력 |
| `powerFragments` | 0 | 모은 힘의 조각 수 |
| `skills` | [] | 습득 스킬 목록 |
| `lastSkill` | null | 마지막으로 사용한 유효한 스킬 |
| `flags` | {} | 스토리 플래그 맵 |
| `loopCount` | 0 | 3장 방 맴돈 횟수 |
| `justCleared` | false | 엔딩 직후 타이틀 복귀 여부 (1회성 디지털시계 이스터에그용) |

| 메서드 | 설명 |
|--------|------|
| `addPowerFragment()` | 조각 +1, atk +2, maxHp +10, maxMp +5, HP/MP 완전 회복 |
| `learnSkill(name)` | 스킬 중복 없이 습득 |
| `setFlag(key, v)` / `getFlag(key)` | 플래그 설정/조회 |
| `save()` / `load()` / `hasSave()` / `clearSave()` | `localStorage` 기반 체크포인트 자동 저장·불러오기·초기화 |
| `markCleared()` / `isGameCleared()` | 엔딩 직후 타이틀 디지털시계 이스터에그 활성화/조회 |
| `reset()` | 새 게임 시 초기화 |

### 4.3 SoundSystem (`src/systems/SoundSystem.js`)

외부 오디오 파일 없이 Web Audio API(`OscillatorNode`, `BiquadFilterNode`, 노이즈 버퍼)로 구현한 프로시저럴 사운드 싱글톤.
- `playBgm(mode)` / `stopBgm()`: `explore` / `battle` / `story` 모드별 오르골 아르페지오 배경음
- `startClockTick(stopped)` / `stopClockTick()`: 시계가 있는 방의 1초 주기 초침 소리 (3장 해금 전에는 무음)
- `toggleMute()`: 사운드 음소거 토글 (`localStorage` 영속화 및 우상단 버튼·`M` 단축키 연동, 브라우저 탭 비활성화 시 `visibilitychange` 자동 일시정지 지원)
- 효과음: `typeBlip()`, `menuMove()`, `menuConfirm()`, `hit(isSkill)`, `hurt()`, `guard()`, `charge()`, `reward()`, `timeStop()`

### 4.4 Player (`src/objects/Player.js`) & Interactable (`src/objects/Interactable.js`)

- `Player`: 방향키 및 WASD 8방향 이동(대각선 속도 정규화, 속도 146px/s), 발 부분 충돌 판정(10×6px, offset 3,10), 발밑 반투명 타원 그림자(`this.shadow`) 실시간 위치 동기화
- `Interactable`: 스프라이트(`scene.add.sprite` — 애니메이션 재생 지원) + 발밑 비례 그림자(`this.shadow`) + 근접 프롬프트 표시 + `disable()` 비활성화 지원

## 5. 데이터 명세

### 5.1 DIALOGUES (`src/data/dialogues.js`)

`{ speaker, text }` 배열의 맵. 정의된 대화 키:

| 키 | 사용 시점 |
|----|-----------|
| `prologue1` / `prologue_boss` / `prologue2_boss` / `prologue2_chase` | 프롤로그 (평화로운 하루 / 보스 강림 / 마을 파괴 직후 보스 퇴장 / 포털 추격 결의) |
| `tutorial_intro` / `tutorial_sign` | 0장 튜토리얼 첫 입장 / 안내판 조사 |
| `ch1_intro` | 1장 첫 입장 |
| `enemy1_pre` / `enemy1_post` | 1장 전투 전/후 |
| `ch2_intro`, `enemy2_pre/post` | 2장 첫 입장 + 초조한 그림자 전투 전/후 |
| `ch3_intro` | 3장 첫 입장 |
| `ch3_loop` | 3장 맴돌이 독백 (loopCount에 따라 다른 줄) |
| `clock_normal` / `clock_early` | 일반 챕터 괘종시계 조사 / 3장 루프 전 멈춘 시계 조사 |
| `inner_self` | 3장 시간 정지 후 내면의 자신과 대화 |
| `ch4_intro`, `wanderer` | 4장 첫 입장 + 방랑자(쉬어가던 시간의 기억) 대화 |
| `ch5_intro`, `enemy_rage_pre/post`, `enemy_fear_pre/post` | 5장 첫 입장 + 두 그림자 전투 전/후 |
| `ch6_intro`, `mirror1~3` | 6장 첫 입장 + 거울 3종 조사 |
| `ch7_intro`, `enemy3_pre/post` | 7장 첫 입장 + 슬픈 그림자 전투 전/후 |
| `ch8_intro`, `inner_return` | 8장 첫 입장 + 내면의 나 재회 대화 |
| `ch9_intro` | 9장 첫 입장 |
| `boss_pre` | 최종보스 조우 |
| `final_drain` / `final_allies` | 최종전 이벤트 (힘 탈취 → 과거 그림자 4인 집결) |
| `reveal1` / `reveal2` | '미래의 자신' 반전 및 포용 컷신 |
| `epilogue_village` | 에필로그 — 귀환 포털을 통해 돌아온 마을 사람들과의 대화 |

### 5.2 SCRIPTS (`src/data/dialogues.js`)

컷신 명령 시퀀스. 현재 3종 정의:
- `prologue`: 인용구 → `PrologueScene` 진입
- `reveal`: 반전 컷신 → `PrologueScene` 에필로그 모드로 전환
- `ending`: 최종 독백 quote들 → `letter` 크레딧 → `title` 복귀

### 5.3 CHAPTERS (`src/data/chapters.js`)

각 챕터는 `objects` 배열로 방을 구성한다. 문은 모든 오브젝트 `flag`(+ `unlockFlag`)가 채워져야 열린다.

| 챕터 | 제목 | objects | 비고 |
|------|------|---------|------|
| 0 | 튜토리얼 | — | `tutorial: true`, 조작 안내 전용 |
| 1 | 빛을 잃은 자 | enemy(불안한 그림자, 26/5) | 스킬 `힘의 일격` 보상 |
| 2 | 초조한 마음 | enemy(초조한 그림자, 96/9) | 스킬 `잔상 베기` 보상 |
| 3 | 멈춘 시간의 방 | clock | `loops: true`, 시계 조사(루프 후) → `ch3_unlocked`, 스킬 `마음의 눈` 보상 |
| 4 | 낯선 방랑자 | npc(방랑자) | 대화 + 힘의 조각 보상 |
| 5 | 두 개의 그림자 | enemy(분노 146/23) + enemy(두려움 128/18) | 순서 자유, 각각 힘의 조각 보상 |
| 6 | 거울의 방 | mirror ×3 | 전부 조사하면 해금 (거울 속 환영 복선) |
| 7 | 침묵의 심연 | enemy(슬픈 그림자, 170/22) | HP 30% 이하에서 ‘곁에 있기’로 마무리, 힘의 조각 보상 |
| 8 | 마지막 문턱 | npc(내면의 나) | 대화 + 힘의 조각 + 스킬 `심연의 파동` 보상 |
| 9 | 그림자의 심연 | enemy(그림자, 420/27, `finale`) | HP 절반에서 2단계 전환 |

### 5.4 SKILL_INFO (`src/data/chapters.js`)

| 스킬 | 속성 | MP | 배율 | 이펙트(`fx`) | 습득 시점 |
|------|------|----|------|--------------|-----------|
| `힘의 일격` | 힘 | 4 | 1.8× | heavy (거검 낙하, 방어 관통·방어 중인 적에게 추가 피해) | 1장 승리 보상 |
| `잔상 베기` | 시간 | 6 | 2.3× | wave (초승달 참격 4연타) | 2장 승리 보상 |
| `마음의 눈` | 마음 | 7 | 1.8× | twin (눈이 집중한 뒤 교차 참격, 다음 공격 +35%) | 3장 내면 대화 완료 |
| `심연의 파동` | 힘 | 18 | 3.5× | burst (빛 응축 → 표적 도달 → 충격파, 다른 행동 2회로 재충전) | 8장 내면의 나 대화 보상 |

기존 저장 데이터에서 삭제된 스킬은 로드할 때 제거하며 진행·능력치·플래그는 보존한다. 마지막 사용 스킬도 저장하고, 해당 기술이 제거되었으면 첫 번째 보유 기술을 선택한다.

## 6. 스토리 플래그 명세

| 플래그 | 설정 조건 | 영향 |
|--------|-----------|------|
| `tut_intro_done` | 0장 인트로 대화 완료 | 재입장 시 독백 생략 |
| `ch1_intro_done` | 1장 인트로 대화 완료 | 재입장 시 독백 생략 |
| `enemy1_dead` | 1장 전투 승리 | 1장 문 해금 |
| `ch2_intro_done` | 2장 인트로 완료 | 독백 중복 방지 |
| `enemy2_dead` | 2장 전투 승리 | 2장 문 해금 |
| `loopCount >= 1` | 3장 문으로 1회 이상 루프 | 시계 작동 조건 |
| `ch3_unlocked` | 내면 대화 완료 | 3장 문 → 4장으로 전환 |
| `ch4_met` | 4장 방랑자 대화 완료 | 4장 문 해금 |
| `rage_dead` / `fear_dead` | 5장 각 전투 승리 | 둘 다 충족 시 문 해금 |
| `ch6_m1~3` | 6장 거울 조사 | 6장 문 해금 |
| `enemy3_dead` | 7장 전투 승리 | 7장 문 해금 |
| `ch8_met` | 8장 내면의 나 대화 완료 | 8장 문 해금 |
| `ch{N}_intro_done` | 각 장 인트로 완료 | 독백 중복 방지 |
| `boss_dead` | 최종보스전 승리 | 반전 컷신으로 전환 |

## 7. 조작 / UI 명세

| 상황 | 입력 | 동작 |
|------|------|------|
| 탐험 | 방향키 / WASD | 8방향 이동 (대각선 속도 정규화) |
| 탐험 / 마을 | E / Space / Enter | 상호작용 (조사/마주하기/시계) |
| 탐험 | 문 위치로 이동 | 챕터 전환 |
| 대화 / 인용구 | E / Space / Enter / 클릭 | 타이핑 스킵 → 다음 줄 |
| 전투 | 방향키 / WASD + E·Enter·Space / 클릭 | 메뉴 및 스킬 선택 (ESC: 스킬창 닫기) |
| 타이틀 | 방향키 / WASD + E·Enter·Space / 클릭 | 이어하기 / 새 게임 시작 |
| 공통 | M / 우상단 사운드 버튼 클릭 | 사운드 음소거(Mute) 켜기/끄기 |

## 8. 실행 및 빌드

```bash
npm install      # 의존성 설치 (phaser, vite)
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

## 9. 향후 확장 계획

| 항목 | 내용 |
|------|------|
| 챕터 추가 | 추가 적/스킬, 서브 에피소드 확장 |
| 다국어 지원 | 한국어/영어 대사 전환 옵션 |
| 대화 로그 | 지나간 대화 다시 보기 |
