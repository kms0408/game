# 시간 (Echo of Self) — 구현 체크리스트

`spec.md` 명세를 기반으로 한 단계별 구현 로드맵. **한 번에 하나씩**, 위에서 아래 순서로 진행한다.
각 항목 완료 시 `[x]`로 체크하고, 인수기준을 충족하지 못하면 구현/수정 후 체크한다.

---

## Phase 0 — 프로젝트 기반

- [x] **0-1. 프로젝트 스캐폴딩**
  - `package.json`(phaser ^3.70, vite ^5), `vite.config.js`, `index.html`(`game-container`), `src/main.js`(640×480, pixelArt, Arcade 물리·중력 0, 씬 5종 등록)
  - **인수기준**: `npm install` 후 `npm run dev`로 Phaser 캔버스가 표시되고, `npm run build`가 성공한다.

## Phase 1 — 데이터·상태 (독립 모듈)

- [x] **1-1. `PlayerState` 싱글톤** (`src/systems/PlayerState.js`)
  - 필드: `chapter`/`maxHp`/`hp`/`atk`/`powerFragments`/`skills`/`flags`/`loopCount`
  - 메서드: `reset()`, `addPowerFragment()`, `learnSkill(name)`, `setFlag(key,v)`, `getFlag(key)`
  - **인수기준**: `addPowerFragment()` → 조각+1·atk+2·maxHp+10·HP 완전 회복 / `learnSkill` 중복 미허용 / `reset()` 후 기본값 복원

- [x] **1-2. 게임 데이터 정의** (`src/data/dialogues.js`, `src/data/chapters.js`)
  - `DIALOGUES` 9종(prologue1·prologue2·ch1_intro·enemy1_pre/post·ch2_intro·ch2_loop·inscription·clock_early·inner_self·ending), `SCRIPTS` 2종(prologue·ending), `CHAPTERS` 2종, `SKILL_INFO` 2종(힘의 일격 1.8×/마음의 눈 2.5×)
  - **인수기준**: 명세 §5의 모든 키가 존재하고, 코드에서 참조하는 키·플래그명과 일치한다.

## Phase 2 — 코어 시스템

- [x] **2-1. `BootScene` 프로시저럴 텍스처** (`src/scenes/BootScene.js`)
  - `px`·`drawCharacter`·`makeTexture` 헬퍼, 텍스처(hero-{dir}-{walk} 8종, inner-self, enemy1, boss, floor, wall, door, sign, clock), `hero-walk-{dir}` 애니메이션 4종(6fps·2프레임 반복)
  - **인수기준**: 외부 에셋 없이 모든 텍스처 생성, 모든 적이 주인공 동일 실루엣의 팔레트 변형, 텍스처 키가 다른 모듈 참조와 일치

- [x] **2-2. `DialogueSystem`** (`src/systems/DialogueSystem.js`)
  - `start(lines, onComplete)`/`advance()`/`finish()`, 28ms/자 타이핑, Space/Enter/클릭 진행, 하단 600×110 대화창+화자 이름표+▼ 진행 표시, `active` 플래그
  - **인수기준**: 타이핑 중 입력 → 전체 표시, 재입력 → 다음 줄, 완료 시 콜백 실행·리스너 해제

- [x] **2-3. `Player` 탐험 캐릭터** (`src/objects/Player.js`)
  - 방향키/WASD 이동 110px/s, 발 충돌 10×6 offset(3,10), `frozen` 잠금, 방향별 걷기 애니메이션 전환
  - **인수기준**: 4방향 이동·애니메이션 동작, frozen 시 이동 정지, 벽과 충돌

- [x] **2-4. `Interactable`** (`src/objects/Interactable.js`)
  - `checkProximity(player)` 반경(기본 40px) 내 프롬프트 표시, E키 입력 시 `action` 콜백
  - **인수기준**: 반경 진입 시 프롬프트 노출·이탈 시 소멸·action 실행

## Phase 3 — 씬

- [x] **3-1. `TitleScene`** (`src/scenes/TitleScene.js`)
  - 제목 "메 아 리"·부제 "ECHO OF SELF", Enter/Space/클릭 → `playerState.reset()` → `StoryScene {script:'prologue'}`
  - **인수기준**: 시작 입력 시 상태 초기화 후 프롤로그 컷신으로 진입

- [x] **3-2. `StoryScene` 컷신 인터프리터** (`src/scenes/StoryScene.js`)
  - 명령: `spawn`·`dialogue`·`quote`·`destroy`·`swap`·`fadeout`·`black`·`letter`·`goto`·`title`
  - **인수기준**: `prologue` 스크립트가 spawn→dialogue→destroy(마을 파괴 연출)→goto ExploreScene(0) 순으로 동작

- [x] **3-3. `ExploreScene` 방 구조** (`src/scenes/ExploreScene.js`)
  - floor 타일 640×480, 테두리 벽(위 중앙 296~344 문 틈), 문 판정(`y<36` && `296<x<344`), `runDialogue` 조작 잠금
  - **인수기준**: 벽 충돌 정상, 문 틈 진입 시 `onDoor` 트리거(쿨다운으로 중복 방지)

## Phase 4 — 게임플레이

- [x] **4-1. `BattleScene` 턴제 전투** (`src/scenes/BattleScene.js`)
  - 메뉴(공격/습득 스킬/방어, ↑↓·WS+Enter·Space/클릭), `dmg=atk×스킬배율±1`·적 `atk±1`·방어 시 ×0.3, 적 턴 800ms 지연, HP바·데미지 플로팅, 승리(플래그→소멸 연출→postDialogue→보상→returnScene)/패배(대화 후 재시작)
  - **인수기준**: 턴 흐름 정상, HP 0 도달 시 onWin/onLose 분기, 보상으로 힘의 조각·스킬 습득

- [x] **4-2. 챕터 1 루프** (`setupChapter1`, `onDoor`)
  - 인트로 독백 1회(`ch1_intro_done`), 적 상호작용→`enemy1_pre`→전투→승리 시 `enemy1_dead`+`enemy1_post`+보상, 미처치 시 문 잠김+`lockedMsg`
  - **인수기준**: 적 생존 시 문이 열리지 않고 메시지 표시, 처치 후 문 통과 → 챕터 2 진입

- [x] **4-3. 챕터 2 루프 + 시계 장치** (`setupChapter2`, `timeStop`, `onDoor`)
  - 문 반복(`loopCount++`·`ch2_loop` 독백 변화), 문구판(`inscription`→`read_inscription`), 시계 조건(`read_inscription` && `loopCount>=2`), `timeStop()`(플래시+회색 오버레이+inner-self 등장+`inner_self` 대화→`마음의 눈` 습득→`ch2_unlocked`)
  - **인수기준**: 조건 미충족 시 `clock_early`, 충족 시 시간 정지 연출 후 내면 대화, 이후 문 → 엔딩

- [x] **4-4. 챕터 3 + 최종보스전**
  - `CHAPTERS[3]`(보스 `finale: true`), `setupChapter3`(보스 조우→`boss_pre`→전투), 2장 해금 후 문 → 3장, 3장 문 차단(`lockedMsg`)
  - BattleScene: HP 0 시 `finalStand()` 1회 발동(힘 재탈취→`final_drain`→`alliesArrive`→`final_allies`→회복+atk 상승→재개), 승리 시 `StoryScene('reveal')`
  - **인수기준**: 보스전에서 쓰러지면 이벤트 발동 후 부활, 승리 시 반전 컷신으로 전환

- [x] **4-5. 반전 컷신 + 엔딩**
  - `StoryScene`에 `swap` 명령 추가, `SCRIPTS.reveal`(reveal1→swap→reveal2→독백 quote들→letter→title)
  - **인수기준**: 보스가 `inner-self`로 변하며 반전 대화 진행, 종료 후 타이틀 복귀

- [x] **4-6. 스토리 암시 정화**
  - `ch1_intro`·`enemy1_post`·`inner_self` 등에서 보스의 정체를 노골적으로 암시하는 대사 제거
  - **인수기준**: 최종보스전 이전에는 반전이 대사로 드러나지 않음 (시각적 실루엣 복선만 유지)

## Phase 5 — 통합 검증

- [x] **5-1. 빌드/실행 검증**: `npm run build` 성공 + `npm run preview` 스모크
  - **인수기준**: 에러 없이 빌드, 미리보기 페이지 로드

- [x] **5-2. 전체 플로우 코드 리뷰**
  - Title → prologue(평화로운 마을→파괴) → Ch0~Ch9(전투/조사/NPC 챕터) → Ch10 보스전(이벤트→승리) → reveal(미래의 자신) → Title
  - **인수기준**: 플래그 흐름이 명세 §6과 일치(`ch1_intro_done`·`enemy1_dead`·`ch2_intro_done`·`read_inscription`·`loopCount>=2`·`ch2_unlocked`·`ch3_intro_done`·`boss_dead`)

## Phase 6 — v2 확장 (10장 구조 + 전투 연출 강화)

- [x] **6-1. 챕터 데이터 주도화** (`ExploreScene.setupChapter`/`spawnObject`/`isCleared`)
  - `CHAPTERS[n].objects` 배열로 방 구성 — enemy/clock/memory/mirror/npc 종류별 상호작용
  - **인수기준**: 모든 오브젝트 플래그 충족 시 문 해금, `loops` 챕터는 문 루프 유지
- [x] **6-2. 챕터 2 간소화**: 표지판/`read_inscription` 제거, `loopCount>=1` 후 시계 조사 → `timeStop`
- [x] **6-3. 3~9장 스토리 챕터**: 3장 기억 조각, 5장 방랑자 NPC, 7장 거울, 9장 내면의 나 + 4·6·8장 전투(신규 적 텍스처 enemy2/enemy3, 6장은 2체)
- [x] **6-4. 보스 이관**: 최종보스 `finale` 이벤트를 10장으로 이동, HP 160 / ATK 18
- [x] **6-5. 스킬별 이펙트**: `SKILL_INFO.fx`(heavy/twin/wave/burst/pillar) + `hitFx()` + 스킬 배너 + 영웅 아이들 모션
- [x] **6-6. 신규 텍스처**: `enemy2`·`enemy3`·`wanderer`·`memory`·`mirror` (`BootScene`)
- [x] **6-7. 이동속도 133** (110 → 121 → 133), 빌드 검증 통과

## Phase 7 — v3 스토리 리라이팅 (폐허가 된 마을 / 미래의 자신)

- [x] **7-1. 프롤로그 리라이팅** (`dialogues.js`, `StoryScene.js`)
  - 평화로운 하루 → '그림자'의 마을 파괴 → 평화를 되찾기 위한 모험: `prologue1`(평온한 독백) → `spawn boss` → `destroy` → `prologue2`(폐허 위의 결의)
  - 컷신 명령 `drain` → `destroy` 교체, `drainPower()` → `destroyVillage()`(불길 파티클·셰이크·잿빛 오버레이·섬광·보스 확대)
  - **인수기준**: 힘 강탈 없이 마을 파괴 연출로 프롤로그 진행
- [x] **7-2. 엔딩 반전 리라이팅** (`dialogues.js`)
  - 보스의 정체 = 미래의 자신 — 수많은 좌절과 절망 끝에 세상을 파괴하려던 모습. `reveal1`/`reveal2` 화자 '미래의 나', 엔딩 독백 quote 수정("미래의 나와 마주했다" / "폐허 위에 다시 평화를")
  - **인수기준**: swap 후 '미래의 나' 대사로 반전 전개, 지금까지의 적들 = 절망의 조각들임을 밝힘
- [x] **7-3. 여정 대사 정합성** (`dialogues.js`, `BattleScene.js`, `PlayerState.js`)
  - '힘 강탈/되찾기' 프레이밍 제거: `tutorial_intro`·`tutorial_sign`·`ch1_intro`·`enemy1_pre/post`·`boss_pre`·`final_drain` 재작성, 보상 문구 "되찾았다"→"손에 넣었다/모았다"
  - **인수기준**: 주인공의 동기가 '평화를 되찾는 모험'으로 일관되게 유지
- [x] **7-4. 빌드 검증**: `npm run build` 통과
- [x] **7-5. 프롤로그 마을 씬** (`PrologueScene.js`, `BootScene.drawVillage`, `main.js`)
  - `picture/마을.jpeg` 참고 `village-bg` 프로시저럴 배경: 잔디 + 자갈길 광장 + 초가 큰집 + 파란 지붕 집 + 울타리 밭 + 나무 + 가로등 + 표지판
  - 플레이 가능한 마을 산책(구조물 충돌체·목표 체크리스트·광장 화살표) → 광장 도달 시 `bossArrives()`(하늘 어두워짐 + 보스 강림 + `prologue_boss`) → `destroyVillage()` → `prologue2` → `ExploreScene(0)`
  - `SCRIPTS.prologue`는 인용구 → `PrologueScene` 진입으로 단순화, `StoryScene`의 `destroy` 명령 제거(연출 이관)
  - **인수기준**: 마을을 걸어다니다 광장에 도달하면 습격 이벤트 → 파괴 연출 → 튜토리얼 진입. `?to=prologue` 디버그 점프 지원
- [x] **7-6. 빌드 검증**: `npm run build` 통과
- [x] **7-7. 마을 에필로그** (`PrologueScene` 에필로그 모드, `SCRIPTS.reveal`/`ending`)
  - 반전 컷신 후 평화를 되찾은 마을로 귀환 — 틴트된 주민 5명이 광장에 모여 있고 `epilogue_village` 대화 재생, E키 → `StoryScene('ending')`(독백 quote → letter → title)
  - "폐허 위에... 다시 평화를 세울 차례다." 멘트 삭제 (마을 장면이 직접 보여주도록 대체)
  - **인수기준**: reveal → 마을 에필로그 → 독백/크레딧 → 타이틀 순으로 진행
- [x] **7-8. 마을 주민·폐허 연출 보강** (`BootScene`, `PrologueScene`, `dialogues.js`)
  - 좌하단 밭을 논밭(수면 + 모 줄)으로 변경, `villager-farm`/`villager-wood`/`villager-chat` 텍스처 3종 추가
  - 프롤로그: 농부 3명(논밭 일) + 벌목꾼(우상단 나무) + 수다 2명(큰집 앞) — 각자 일하는 모션
  - 파괴: 주민들이 옆으로 쓰러지며 색이 바램 + 지붕 그을음 얼룩 + 피어오르는 연기로 실제 폐허 표현
  - 반전 `swap`: `inner-self` → `hero-down-0` — 보스가 크기를 유지한 채 주인공과 같은 색으로 변한다
  - 에필로그: 주민들이 각자 일하다가 걸어 들어오는 주인공에게 달려와 모여드는 환영 연출
  - **인수기준**: 프롤로그에서 일하는 주민이 보이고, 파괴 후 쓰러진 주민·그을음·연기로 폐허가 표현됨. 에필로그는 귀환→달려옴→대화 흐름
- [x] **7-9. 챕터 재구성 + 전투 연출 보강** (`chapters.js`, `dialogues.js`, `ExploreScene`, `BattleScene`, `BootScene`)
  - 3장 '기억의 회랑' 삭제, '멈춘 시간의 방'이 3장으로 이동 — 이후 챕터 전부 리번호링(총 0~9장), `ch3_unlocked` 등 플래그/대화 키/`bg-chN` 텍스처 일괄 정리
  - `잔상 베기` 상성 마음→시간 (컬러 금색으로 변경)
  - 전투 템포: `tweens.timeScale`·`time.timeScale` 0.55로 약 절반 속도
  - 타격 카메라 줌인: 플레이어 공격 시 적 쪽(스킬 1.3×), 적 공격 시 플레이어 쪽(1.15×) — `zoomPunch()` + 스킬 타격 지점 컬러 충격파 추가
  - **인수기준**: 0장~9장 연속 진행, 3장 시계 루프 이벤트 정상, 전투가 느려지고 공격마다 줌인됨

## Phase 8 — v4 완성도 고도화 (사운드·세이브·그래픽·스토리·전투 리모델링)

- [x] **8-1. 프로시저럴 사운드 시스템 구축** (`src/systems/SoundSystem.js`)
  - Web Audio API 신디사이저 기반 오르골 BGM 3종(`explore`/`battle`/`story`), 대화 화자별 타이핑음, 메뉴 이동/선택음, 일반/스킬 타격음, 방어음, 차징 경고음, 보상 획득음, 시간 정지음 구현
  - 시계가 있는 방에서 1초 주기 초침 소리(`startClockTick`) 재생 — 3장 멈춘 시계는 해금 전까지 정적 유지 후 해금 순간 재작동
  - **인수기준**: 외부 오디오 에셋 없이 모든 씬에서 BGM과 상황별 효과음이 정상 재생됨
- [x] **8-2. 자동 저장(체크포인트) 및 사이드 패널 개선** (`PlayerState.js`, `TitleScene.js`, `main.js`, `index.html`)
  - 1장 이상 진입 및 보상 획득 시 `localStorage` 자동 저장(`save`/`load`), 타이틀 화면에 `▶ 이어하기 (N장)` 버튼 표시
  - 좌우 사이드 패널에 현재 진행 챕터(`N장 진행 중`)와 습득 스킬별 속성 컬러 배지(`[힘]`/`[마음]`/`[시간]`), 소모 MP, 피해 배율 표시
  - **인수기준**: 새로고침 후 타이틀에서 이어하기 가능, 엔딩 도달 시 세이브 자동 정리
- [x] **8-3. 타이틀 시계 이스터에그 (모래시계 → 실시간 디지털시계)** (`BootScene.js`, `TitleScene.js`, `PlayerState.js`, `StoryScene.js`)
  - 기본 타이틀 상단에는 천천히 흐르다 뒤집히는 모래시계(`sand-flow-slow`, 1.2fps) 배치
  - 엔딩 클리어 직후 타이틀로 돌아오면(`justCleared`) 현재 시각(`HH:MM:SS`)이 실시간으로 흐르는 발광 탁상 디지털시계(`digital-clock`)와 응원 부제가 표시됨 (영구 고정되지 않고 새 게임/새로고침 시 모래시계로 복원)
  - **인수기준**: 클리어 전에는 느린 모래시계, 엔딩 직후 타이틀 복귀 시에는 실시간 디지털시계 노출
- [x] **8-4. 서사 및 대사 폴리싱** (`src/data/dialogues.js`)
  - 3장 메타 발언("다음 챕터로") 및 시계 대사 오탈자 수정, 4장 방랑자에게 '잠시 멈춰 쉬어가던 시간의 기억' 서사 부여
  - 2~8장의 노골적인 반전 스포일러 수위 조절, 9장 보스전 및 반전(`reveal2`)을 '절망했던 미래의 나를 마주하고 포용하는 감정선'으로 리라이팅, 엔딩 편지 제목을 『시간』으로 통일
  - **인수기준**: 반전이 9장에서 극적으로 드러나고, 개발자의 편지(`LETTER`)와 본편 대사의 주제가 일관됨
- [x] **8-5. 프롤로그/에필로그 광장 차원 포털 연출** (`src/scenes/PrologueScene.js`)
  - 보스 강림 및 포털 위치를 초가집 지붕 위에서 '초가집 앞 자갈길 광장 중앙(320, 212)'으로 이동해 건물 침범 제거
  - 다중 레이어 입체 포털(`createPortal`) 구현: 프롤로그에서는 보스가 포털로 사라진 뒤 주인공이 달려가 포털로 도약 진입, 에필로그에서는 광장 귀환 포털에서 주인공이 솟아올라 착지 후 주민 환영 대화 및 자동 페이드아웃 진행
  - **인수기준**: 집을 뚫고 걸어가는 현상 없이 광장 포털을 통해 입체적으로 퇴장·귀환함
- [x] **8-6. 캐릭터·실내 배경·괘종시계 그래픽 업그레이드** (`BootScene.js`, `Player.js`, `Interactable.js`, `ExploreScene.js`)
  - 캐릭터를 감성 판타지 '후드 여행자' 디자인으로 개편, 모든 캐릭터·오브젝트 발밑에 반투명 타원 그림자 추가
  - 0~9장 실내 바닥을 석재 타일 격자 + 웨인스코팅 몰딩 + 창문 사다리꼴 빛줄기(God ray)로 개선
  - 시계를 황금 시계추가 흔들리는 앤티크 괘종시계(`clock-tick`)로 변경하고, 탐험 중 적 그림자에 호흡 모션 및 어둠 입자 오라 추가, 6장 거울 조사 시 환영(`inner-self`/`boss`) 연출 추가
  - **인수기준**: 실내외 그래픽 톤앤매너가 일치하고 오브젝트 입체감과 생동감이 표현됨
- [x] **8-7. 전투씬(`BattleScene`) 리모델링 및 밸런스 개선** (`BattleScene.js`, `BootScene.js`, `chapters.js`)
  - `battle-bg`를 거대 시계판(Clockwork Arena) 마법진과 정확한 발판 스포트라이트로 업그레이드, 적 속성별 무대 색조 및 본체 추적 후광 오라(`enemyAura`) 추가
  - 전투 템포를 `0.78`로 개선하고 스킬/강공격 시에만 `setBounds` 기반의 절제된 줌펀치(`1.08×`)를 적용해 화면·이펙트 어긋남 해결
  - 적 강공격 차징 예고 패턴(3턴 주기, 방어 시 피해 대폭 경감), 체력바 데미지 잔상(`enemyHpTrail`/`playerHpTrail`), 스킬창 `▲약점` 표시 및 타격 시 `WEAK!` 팝업 추가
  - 최종전 반복 패배 시 공격력 누적 버그 수정(`initialAtk` 복원) 및 부활 이벤트 시 과거 그림자 4인(`enemy1~3`, `inner-self`) 전원 집결 연출 적용
  - **인수기준**: `npm run build` 통과, 스킬/강공격 시 화면과 이펙트 좌표가 정확히 일치함

## Phase 9 — v5 전체 디테일 폴리싱 (조작감·잠금 안전성·전투 개성·반응형 UI)

- [x] **9-1. 연속 대화 연출 중 조작 잠금 해제 틈새 수정 및 저장/재도전 안정화** (`ExploreScene.js`, `PrologueScene.js`, `BattleScene.js`)
  - `runDialogue()`에 `keepFrozen` 옵션 및 `unlockTimer` 취소 처리를 도입해 3장 시간 정지(`timeStop`) 및 오브젝트 조사 후속 대화 사이의 잠금 해제 틈새 제거
  - 전투 승리 시 처치 플래그·보상·`save()`를 원자적으로 묶어 저장 정합성 보장, 9장 최종전 부활 이벤트 이후 패배 시 재도전에서 긴 부활 컷신을 축약 처리(`finalEventSeen`)
- [x] **9-2. 조작 키 통합 및 8방향 대각선 이동 개선** (`Player.js`, `TitleScene.js`, `DialogueSystem.js`, `StoryScene.js`)
  - 탐험 이동에 `WASD` 및 8방향 대각선 속도 정규화(`Math.SQRT1_2`) 적용
  - 타이틀 화면 키보드 조작(상하 방향키/WS 포커스 이동 + E/Enter/Space 확정) 및 모래시계 전환 연출 단축(1.6초)·즉시 스킵 추가
  - 대화창(`DialogueSystem`), 인용구(`quote`), 개발자의 편지(`letter`)에서 `E`/`SPACE`/`ENTER` 및 클릭 진행 통합, 편지 스크롤 완료 시 키 리스너 정리
- [x] **9-3. 사운드 음소거(Mute) 토글 및 탭 비활성화 대응** (`SoundSystem.js`, `index.html`, `main.js`)
  - 우상단 `사운드: 켜짐/꺼짐 (M)` 버튼 및 `M` 단축키 추가 (`localStorage` 상태 유지)
  - 브라우저 탭 전환(`visibilitychange`) 시 `AudioContext` 자동 일시정지/재개로 백그라운드 소음 방지
- [x] **9-4. 스킬 설명(`desc`) 표시, 감정별 적 패턴 차별화, 3장 시계 힌트 강화** (`BattleScene.js`, `chapters.js`, `dialogues.js`, `ExploreScene.js`)
  - 전투 스킬 선택창 하단에 현재 가리키는 스킬의 설명(`SKILL_INFO.desc`) 실시간 표시
  - 5장 `분노한 그림자`(2턴 주기 빠른 차징), `두려운 그림자`(웅크리기 피해 35% 경감), 7장 `슬픈 그림자`(슬픔의 파동 마나 회복 감소) 고유 패턴 적용
  - 3장 1회 루프 직후 멈춘 시계 주변에 시간의 금빛 입자 연출 및 루프 독백 힌트 조기 노출
- [x] **9-5. 미사용 프로시저럴 텍스처 정리 및 반응형 레이아웃 적용** (`BootScene.js`, `index.html`, `spec.md`)
  - 미사용 `'memory'`, `'floor'`, `'title-clock'` 프로시저럴 텍스처 코드 정리 및 창 폭 `980px` 이하 반응형 레이아웃 적용
  - **인수기준**: `npm run build` 에러 없이 통과

## Phase 10 — 전투 흐름과 스킬 역할 개선 (2026-10-22)

- [x] 기술 접촉 순간에 피해·HP·효과음·넉백을 동기화하고, 연출과 복귀가 끝난 뒤 반격하도록 변경
- [x] 정상 배속과 55ms 타격 정지 적용, 대각선 근접 돌진과 제자리 원거리 시전 구분
- [x] 잔상 베기를 실제 4회 타격으로 변경하고, 네 기술의 시전·타격음을 분리
- [x] 시간의 칼날 삭제, 기존 저장의 진행·능력치를 유지하면서 삭제된 기술 정리
- [x] 힘의 일격 방어 관통, 마음의 눈 집중, 심연의 파동 재충전으로 역할 구분
- [x] 적 수치와 방어 효율 조정, 보스 2단계 체력 경계 및 첫 강공격 예고 적용
- [x] 마지막 스킬 선택 기억, 상성·방어·집중을 반영한 예상 피해, 창 안의 MP 부족·재충전 안내
- [x] 탐험·마을 조사에 E/Space/Enter 통합, 길게 누른 확인 키의 대화·전투 자동 실행 방지
- [x] 타격 순서·기술 효과·저장 호환·조사 키·정상 성장 전투 회귀 테스트 추가
