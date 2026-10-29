import Phaser from 'phaser';
import DialogueSystem from '../systems/DialogueSystem.js';
import { DIALOGUES } from '../data/dialogues.js';
import { SKILL_INFO, TYPES, STRONG_MULT, WEAK_MULT } from '../data/chapters.js';
import { playerState } from '../systems/PlayerState.js';
import { sound } from '../systems/SoundSystem.js';

// 턴제 전투 씬 — 방향키로 메뉴를 선택하고 Enter/Space로 실행한다.
// 승리 시 힘의 조각(성장)과 스킬을 얻고 원래 씬으로 돌아간다.
export default class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  init(data) {
    this.cfg = data;   // { enemy, flag, postDialogue, reward, returnScene, returnData, finalEventSeen }
    this.enemyHp = data.enemy.hp;
    this.guarding = false;
    this.enemyGuarding = data.enemy.pattern === 'fear'; // 두려움은 처음부터 웅크린다
    this.turnLocked = false;
    this.menuIndex = 0;
    this.finalEventDone = false;           // 최종전 패배 직전 이벤트 발동 여부
    this.finalEventSeen = !!data.finalEventSeen; // 이전 시도에서 이미 최종전 부활 연출을 보았는지 여부
    this.initialAtk = playerState.atk;     // 전투 재시작(패배) 시 복원할 초기 공격력
    this.enemyCharged = false;             // 적이 다음 턴 강공격을 준비(차징) 중인지 여부
    this.turnCount = 0;                    // 경과 턴 수 (차징 패턴 계산용)
    this.sorrowReady = false;
    this.sorrowComforted = false;
    this.battleResolved = false;
    this.attackPending = false;           // 타격·복귀가 끝날 때까지 중복 공격 방지
    this.focused = false;                 // 마음의 눈으로 준비한 다음 공격 강화
    this.burstCooldown = 0;               // 파동 재충전까지 남은 다른 행동 수
    this.prevSkillUsed = null;            // 직전 턴에 사용한 스킬 (보유 스킬 2종 이상일 때 연속 동일 스킬 감쇠용)
    this.guardShield = null;
    this.focusAura = null;                // 마음의 눈 집중 활성화 시 주인공 발밑 오라 링
  }

  create() {
    this.cameras.main.fadeIn(200, 0, 0, 0);
    // 아레나 카메라 경계를 고정하고 전투 정보창은 같은 구도에서 유지한다.
    this.cameras.main.setBounds(0, 0, 640, 480);
    sound.playBgm('battle');
    // 기본 속도는 정상 배속으로 두고 강한 타격의 접촉 순간에만 짧게 멈춘다.
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    const e = this.cfg.enemy;
    const typeColHex = e.finale ? '#ff4466' : (e.type ? TYPES[e.type].color : '#8a86b8');
    const typeColNum = parseInt(typeColHex.replace('#', ''), 16);
    this.enemyThemeColor = typeColNum;

    // 전투 아레나 배경 + 적 속성에 맞춘 색조 오버레이
    this.add.image(320, 240, 'battle-bg');
    this.add.rectangle(320, 240, 640, 480, typeColNum, e.finale ? 0.14 : 0.06);

    playerState.hp = playerState.maxHp;   // 전투 시작 시 체력·마나 회복
    playerState.mp = playerState.maxMp;
    this.dialogue = new DialogueSystem(this);

    // ── 포켓몬식 배치: 적 우상단 / 플레이어 좌하단, 각자 다중 마법진 발판 위 ──
    this.add.ellipse(470, 210, 224, 54, 0x000000, 0.45)
      .setStrokeStyle(2, typeColNum, 0.55);
    const enemyPadInner = this.add.ellipse(470, 210, 156, 34, typeColNum, 0.14)
      .setStrokeStyle(1, typeColNum, 0.4);
    this.add.ellipse(140, 336, 194, 46, 0x000000, 0.45)
      .setStrokeStyle(2, 0x7ab8ff, 0.45);
    this.add.ellipse(140, 336, 132, 28, 0x7ab8ff, 0.12);

    // 발판 마법진 맥동 애니메이션
    this.tweens.add({
      targets: enemyPadInner, scaleX: 1.08, scaleY: 1.08, alpha: 0.28,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // 적 후광 오라 + 적 스프라이트 (뒤쪽에 반투명 속성 실루엣이 일렁이며 도트 확대의 단조로움을 보완한다)
    this.enemyAura = this.add.image(470, 156, e.key)
      .setScale(6.5).setTint(typeColNum).setAlpha(0.28);
    this.enemySprite = this.add.image(470, 156, e.key).setScale(5.6);

    this.tweens.add({
      targets: this.enemyAura, scaleX: 7.0, scaleY: 7.0, alpha: 0.1,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // 적 주변에서 끊임없이 피어오르는 속성 입자
    this.time.addEvent({
      delay: 320,
      loop: true,
      callback: () => {
        if (!this.enemySprite || !this.enemySprite.active || this.enemyHp <= 0) return;
        const p = this.add.circle(
          this.enemySprite.x + Phaser.Math.Between(-42, 42),
          this.enemySprite.y + Phaser.Math.Between(-10, 44),
          Phaser.Math.Between(2, 4),
          typeColNum, 0.55
        );
        this.tweens.add({
          targets: p, y: p.y - Phaser.Math.Between(35, 65), alpha: 0,
          duration: 850, onComplete: () => p.destroy()
        });
      }
    });

    // 플레이어 스프라이트 — 좌하단에서 적을 바라본다.
    this.heroSprite = this.add.image(140, 294, 'hero-right-0').setScale(4);
    // 위치(x, y)는 고정해 돌진·피격·복귀 트윈끼리 좌표를 덮어쓰지 않게 하고, 호흡감은 미세한 스케일 맥동으로 표현한다.
    this.tweens.add({
      targets: this.heroSprite, scaleX: 4.06, scaleY: 3.92,
      duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.enemySprite, scaleX: 5.7, scaleY: 5.48,
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    // 집중(마음의 눈) 활성화 시 주인공 주변에 떠오르는 청록빛 입자 연출
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!this.focused || !this.heroSprite || !this.heroSprite.active || this.battleResolved) return;
        const fp = this.add.circle(
          this.heroSprite.x + Phaser.Math.Between(-24, 24),
          this.heroSprite.y + Phaser.Math.Between(-6, 26),
          Phaser.Math.Between(2, 3),
          0x7fffd8, 0.7
        ).setDepth(11);
        this.tweens.add({
          targets: fp, y: fp.y - Phaser.Math.Between(24, 42), alpha: 0,
          duration: 600, onComplete: () => fp.destroy()
        });
      }
    });

    // ── 적 정보창 (좌상단): 이름 + 속성 배지 + 잔상(Damage Trail) HP 바 + 수치 ──
    this.add.rectangle(16, 20, 264, 76, 0x0a0a14, 0.92).setOrigin(0, 0)
      .setStrokeStyle(2, 0x8a86b8).setDepth(30);
    this.add.text(30, 28, e.name, {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffb3b3'
    }).setDepth(31);
    if (e.type) {
      this.add.text(214, 30, `[${TYPES[e.type].name}]`, {
        fontSize: '12px', fontFamily: 'monospace', color: TYPES[e.type].color
      }).setDepth(31);
    }
    this.add.text(30, 56, 'HP', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffe9a8'
    }).setDepth(31);
    // 적 체력바 배경 + 피격 시 늦게 줄어드는 노란 잔상 바 + 실제 체력바
    this.add.rectangle(62, 58, 192, 10, 0x1a1626).setOrigin(0, 0).setDepth(31);
    this.enemyHpTrail = this.add.rectangle(62, 58, 192, 10, 0xffe9a8).setOrigin(0, 0).setDepth(31);
    this.enemyHpBar = this.add.rectangle(62, 58, 192, 10, 0xd9384a).setOrigin(0, 0).setDepth(31);
    this.add.rectangle(62, 58, 192, 10).setStrokeStyle(1, 0x8a86b8).setOrigin(0, 0).setFillStyle(0x000000, 0).setDepth(31);
    this.enemyHpText = this.add.text(62, 73, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffb3b3'
    }).setDepth(31);
    // 적 정보창 내부 우하단에 차징/방어 상태를 즉각 보여주는 배지
    this.enemyStateBadge = this.add.text(254, 73, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffe9a8'
    }).setOrigin(1, 0).setDepth(31);
    this.updateEnemyHp(true);
    this.phaseText = e.finale ? this.add.text(30, 104, '1단계 · 그림자와 마주하기', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cfc8ff'
    }).setDepth(31) : null;
    this.intentText = this.add.text(30, e.finale ? 125 : 104, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffe9a8',
      backgroundColor: '#0a0a14cc', padding: { x: 5, y: 4 }
    }).setDepth(31);
    // 플레이어 상태 배지(집중 +25% / 파동 재충전)를 플레이어 정보창 내부 상단에 깔끔하게 배치한다
    this.focusText = this.add.text(614, 258, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#7fffd8'
    }).setOrigin(1, 0).setDepth(31);
    this.updateCombatHints();

    // ── 플레이어 정보창 (우측 중단): HP/MP 잔상 바 + 수치 ──
    this.add.rectangle(344, 248, 284, 94, 0x0a0a14, 0.92).setOrigin(0, 0)
      .setStrokeStyle(2, 0x8a86b8).setDepth(30);
    this.add.text(358, 256, '나', {
      fontSize: '15px', fontFamily: 'monospace', color: '#eeeeee'
    }).setDepth(31);
    this.add.text(358, 282, 'HP', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffe9a8'
    }).setDepth(31);
    this.add.rectangle(390, 284, 150, 10, 0x1a1626).setOrigin(0, 0).setDepth(31);
    this.playerHpTrail = this.add.rectangle(390, 284, 150, 10, 0xff8888).setOrigin(0, 0).setDepth(31);
    this.playerHpBar = this.add.rectangle(390, 284, 150, 10, 0x4a90d9).setOrigin(0, 0).setDepth(31);
    this.add.rectangle(390, 284, 150, 10).setStrokeStyle(1, 0x8a86b8).setOrigin(0, 0).setFillStyle(0x000000, 0).setDepth(31);
    this.hpText = this.add.text(546, 280, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#eeeeee'
    }).setDepth(31);
    this.add.text(358, 306, 'MP', {
      fontSize: '12px', fontFamily: 'monospace', color: '#b98aff'
    }).setDepth(31);
    this.add.rectangle(390, 308, 150, 10, 0x1a1626).setOrigin(0, 0).setDepth(31);
    this.playerMpBar = this.add.rectangle(390, 308, 150, 10, 0x8a5ae0).setOrigin(0, 0).setDepth(31);
    this.add.rectangle(390, 308, 150, 10).setStrokeStyle(1, 0x8a86b8).setOrigin(0, 0).setFillStyle(0x000000, 0).setDepth(31);
    this.mpText = this.add.text(546, 304, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#eeeeee'
    }).setDepth(31);
    this.updateStatus(true);

    // ── 하단: 메시지 박스(좌) + 커맨드 메뉴 박스(우) — 포켓몬식 구성 ──
    this.add.rectangle(12, 366, 392, 102, 0x0a0a14, 0.94).setOrigin(0, 0)
      .setStrokeStyle(2, 0x8a86b8).setDepth(30);
    // 전투 로그/안내 메시지
    this.logText = this.add.text(28, 380, '무엇을 할까?', {
      fontSize: '15px', fontFamily: 'monospace', color: '#eeeeee',
      wordWrap: { width: 360 }, lineSpacing: 5
    }).setDepth(31);
    // 메인 메뉴 커서(공격/스킬/방어)의 예상 피해·회복 효과를 하단에 상시 안내한다
    this.actionHintText = this.add.text(28, 444, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a86b8'
    }).setDepth(31);

    this.add.rectangle(412, 366, 216, 102, 0x0a0a14, 0.94).setOrigin(0, 0)
      .setStrokeStyle(2, 0x8a86b8).setDepth(30);

    // 메뉴: 1장(스킬 미습득)은 공격/스킬/방어, 2장 이후(스킬 습득 후)에는 기본 공격을 제외하고 스킬/방어만 사용한다
    this.menuItems = this.getInitialMenuItems();
    this.menuY = this.menuItems.length === 2 ? 392 : 382;
    this.menuGap = this.menuItems.length === 2 ? 34 : 28;
    this.menuMode = 'main';               // 'main' | 'skill'
    this.skillIndex = 0;
    this.skillObjs = null;                // 스킬 창 오브젝트 목록
    this.menuTexts = this.menuItems.map((name, i) =>
      this.add.text(466, this.menuY + i * this.menuGap, `  ${name}`, {
        fontSize: '15px', fontFamily: 'monospace', color: '#dddddd'
      }).setDepth(31)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.turnLocked || this.dialogue.active || this.menuMode !== 'main') return;
          if (this.menuIndex !== i) {
            this.menuIndex = i;
            this.selector.y = this.menuY + i * this.menuGap;
            this.refreshMainMenuStyle();
            sound.menuMove();
          }
        })
        .on('pointerdown', () => this.selectMenu(i))
    );

    this.selector = this.add.text(444, this.menuY, '▶', {
      fontSize: '15px', color: '#ffe9a8'
    }).setDepth(31);
    this.refreshMainMenuStyle();

    this.input.keyboard.on('keydown-UP', () => this.moveSel('up'));
    this.input.keyboard.on('keydown-W', () => this.moveSel('up'));
    this.input.keyboard.on('keydown-DOWN', () => this.moveSel('down'));
    this.input.keyboard.on('keydown-S', () => this.moveSel('down'));
    this.input.keyboard.on('keydown-LEFT', () => this.moveSel('left'));
    this.input.keyboard.on('keydown-A', () => this.moveSel('left'));
    this.input.keyboard.on('keydown-RIGHT', () => this.moveSel('right'));
    this.input.keyboard.on('keydown-D', () => this.moveSel('right'));
    // 길게 누른 확인 키가 스킬 창 열기와 실행을 연달아 일으키지 않도록 한다.
    for (const key of ['ENTER', 'SPACE', 'E']) {
      this.input.keyboard.addKey(key); // 네이티브 repeat 값뿐 아니라 Phaser의 누름 상태로도 중복을 막는다.
      this.input.keyboard.on(`keydown-${key}`, event => {
        if (!event.repeat) this.confirmSel();
      });
    }
    // 스킬 창이 열려 있을 때 Q 키 또는 마우스 우클릭으로 메인 메뉴로 돌아간다
    const cancelSkill = () => {
      if (this.menuMode === 'skill') {
        sound.menuMove();
        this.closeSkillMenu();
      }
    };
    this.input.keyboard.on('keydown-Q', cancelSkill);
    this.input.mouse?.disableContextMenu?.();
    this.input.on?.('pointerdown', pointer => {
      if (pointer?.rightButtonDown?.() && this.menuMode === 'skill') cancelSkill();
    });

    // 대화 직후 넘김 키 연타로 전투 행동이 바로 실행되는 것을 막기 위해 시계 전투 도입부를 재생한다
    this.playBattleIntro();
  }

  // 스킬을 습득한 2장부터는 기본 공격을 제외하고 [스킬, 방어]만 메인 메뉴로 구성한다
  getInitialMenuItems() {
    const ch = this.cfg?.chapter ?? this.cfg?.returnData?.chapter ?? playerState.chapter ?? 1;
    if (ch >= 2 && playerState.skills.length > 0) {
      return ['스킬', '방어'];
    }
    return ['공격', '스킬', '방어'];
  }

  // 챕터 진행에 따라 옛날 시계에서 현대 시계로 진화하는 전투 도입부 시계 사양을 반환한다
  // (1장: 해시계 → 2장: 물시계 → 5장 1차: 모래시계 → 5장 2차: 회중시계 → 7장: 아날로그시계 → 9장: 디지털시계)
  getBattleClockSpec() {
    const ch = this.cfg?.chapter ?? this.cfg?.returnData?.chapter ?? playerState.chapter ?? 1;
    if (ch <= 1) {
      return { key: 'sundial', name: '해시계', texture: 'intro-sundial' };
    }
    if (ch === 2) {
      return { key: 'water', name: '물시계', texture: 'intro-water-clock' };
    }
    if (ch === 3 || ch === 4) {
      return { key: 'sand', name: '모래시계', texture: 'sand-clock-0' };
    }
    if (ch === 5) {
      const secondBattle = playerState.getFlag('rage_dead') || playerState.getFlag('fear_dead');
      return secondBattle
        ? { key: 'pocket', name: '회중시계', texture: 'intro-pocket-watch' }
        : { key: 'sand', name: '모래시계', texture: 'sand-clock-0' };
    }
    if (ch === 6) {
      return { key: 'pocket', name: '회중시계', texture: 'intro-pocket-watch' };
    }
    if (ch === 7 || ch === 8) {
      return { key: 'analog', name: '아날로그시계', texture: 'intro-analog-clock' };
    }
    return { key: 'digital', name: '디지털시계', texture: 'digital-clock' };
  }

  // 전투 도입부 연출 — 시대별 시계 장면과 '전투 준비중' 문구를 보여주며 대화 넘김 입력을 흡수한다
  playBattleIntro() {
    this.turnLocked = true;
    this.introActive = true;
    const spec = this.getBattleClockSpec();
    const introObjs = [];
    this.introObjs = introObjs;
    const addObj = obj => {
      introObjs.push(obj);
      return obj;
    };

    // 전체 화면 배경 및 클릭 차단 레이어 (depth 900 이상)
    addObj(this.add.image(320, 240, 'night-bg').setDepth(900).setInteractive());
    addObj(this.add.rectangle(320, 240, 640, 480, 0x07060f, 0.72).setDepth(900));

    // 중앙 시계 마법진 테두리
    const outerRing = addObj(this.add.ellipse(320, 195, 196, 196, 0x151026, 0.78)
      .setStrokeStyle(2, 0x8a86b8, 0.7).setDepth(901));
    addObj(this.add.ellipse(320, 195, 158, 158, 0x0a0a14, 0.88)
      .setStrokeStyle(1, 0xffe9a8, 0.42).setDepth(901));
    this.tweens.add({
      targets: outerRing, scaleX: 1.04, scaleY: 1.04,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // 전투 도입부 장면 유지 시간 (1.45초간 시계 장면을 또렷하게 보여준 뒤 페이드아웃)
    const introHoldMs = 1450;

    // 시계 종류별 메인 비주얼 및 작동 애니메이션
    if (spec.key === 'sundial') {
      addObj(this.add.image(320, 206, spec.texture).setScale(2.3).setDepth(902));
      const sunOrb = addObj(this.add.circle(272, 140, 9, 0xffe9a8, 0.92).setDepth(903));
      const shadowHand = addObj(this.add.rectangle(320, 202, 3, 28, 0x24180c, 0.8)
        .setOrigin(0.5, 1).setAngle(-35).setDepth(903));
      this.tweens.add({
        targets: sunOrb, x: 368, y: 136, duration: introHoldMs, ease: 'Sine.easeInOut'
      });
      this.tweens.add({
        targets: shadowHand, angle: 35, duration: introHoldMs, ease: 'Sine.easeInOut'
      });
    } else if (spec.key === 'water') {
      addObj(this.add.image(320, 196, spec.texture).setScale(2.25).setDepth(902));
      const drop = addObj(this.add.circle(331, 166, 3.5, 0x8ee0ff, 0.95).setDepth(903));
      const gauge = addObj(this.add.rectangle(327, 178, 5, 26, 0xffe9a8, 0.9)
        .setOrigin(0.5, 1).setDepth(903));
      this.tweens.add({
        targets: drop, y: 204, alpha: 0.2, duration: 360, repeat: 3
      });
      this.tweens.add({
        targets: gauge, y: 168, duration: introHoldMs, ease: 'Sine.easeOut'
      });
    } else if (spec.key === 'sand') {
      const makeSprite = this.add.sprite ? this.add.sprite.bind(this.add) : this.add.image.bind(this.add);
      const sand = addObj(makeSprite(320, 195, spec.texture).setScale(2.3).setDepth(902));
      sand.play?.('sand-flow');
    } else if (spec.key === 'pocket') {
      const watch = addObj(this.add.image(320, 192, spec.texture).setScale(2.25).setDepth(902));
      const hourHand = addObj(this.add.rectangle(320, 206, 3, 18, 0x2a1e14, 0.92)
        .setOrigin(0.5, 1).setAngle(30).setDepth(903));
      const minHand = addObj(this.add.rectangle(320, 206, 2, 26, 0xc03838, 0.92)
        .setOrigin(0.5, 1).setAngle(0).setDepth(903));
      this.tweens.add({
        targets: watch, angle: { from: -5, to: 5 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.tweens.add({ targets: minHand, angle: 360, duration: introHoldMs, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: hourHand, angle: 60, duration: introHoldMs, ease: 'Cubic.easeInOut' });
    } else if (spec.key === 'analog') {
      addObj(this.add.image(320, 195, spec.texture).setScale(2.25).setDepth(902));
      const hourHand = addObj(this.add.rectangle(320, 195, 4, 22, 0x182038, 0.95)
        .setOrigin(0.5, 1).setAngle(90).setDepth(903));
      const minHand = addObj(this.add.rectangle(320, 195, 3, 30, 0x182038, 0.95)
        .setOrigin(0.5, 1).setAngle(0).setDepth(903));
      const secHand = addObj(this.add.rectangle(320, 195, 2, 34, 0xd9384a, 0.95)
        .setOrigin(0.5, 1).setAngle(-60).setDepth(903));
      this.tweens.add({ targets: secHand, angle: 300, duration: introHoldMs, ease: 'Linear' });
      this.tweens.add({ targets: minHand, angle: 60, duration: introHoldMs, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: hourHand, angle: 105, duration: introHoldMs, ease: 'Sine.easeInOut' });
    } else {
      addObj(this.add.image(320, 195, spec.texture).setScale(2.2).setDepth(902));
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const dText = addObj(this.add.text(320, 194, `${hh}:${mm}:${ss}`, {
        fontSize: '23px', fontFamily: 'monospace', color: '#7fffd8',
        stroke: '#081820', strokeThickness: 2
      }).setOrigin(0.5).setDepth(903));
      this.tweens.add({
        targets: dText, alpha: 0.55, duration: 280, yoyo: true, repeat: -1
      });
    }

    // 시계 종류 명칭 및 '전투 준비중' 안내 문구
    this.introClockLabel = addObj(this.add.text(320, 314, `[ ${spec.name} ]`, {
      fontSize: '15px', fontFamily: 'monospace', color: '#ffe9a8'
    }).setOrigin(0.5).setDepth(903).setText(`[ ${spec.name} ]`));

    this.introPrepText = addObj(this.add.text(320, 350, '전투 준비중...', {
      fontSize: '20px', fontFamily: 'monospace', color: '#cfc8ff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(903).setText('전투 준비중...'));
    this.tweens.add({
      targets: this.introPrepText, alpha: 0.4, duration: 420, yoyo: true, repeat: -1
    });

    if (this.cfg?.enemy?.name) {
      addObj(this.add.text(320, 386, `— ${this.cfg.enemy.name} —`, {
        fontSize: '13px', fontFamily: 'monospace', color: '#8a86b8'
      }).setOrigin(0.5).setDepth(903));
    }

    // 1.45초 동안 도입부 장면을 보여준 뒤 페이드아웃하고 플레이어 턴 조작을 허용한다
    this.time.delayedCall(introHoldMs, () => {
      this.tweens.add({
        targets: introObjs,
        alpha: 0,
        duration: 280,
        onComplete: () => {
          introObjs.forEach(o => o.destroy?.());
          this.introObjs = null;
          this.introActive = false;
          this.turnLocked = false;
        }
      });
    });
  }

  // 매 프레임 적의 후광 오라(enemyAura)가 적 본체(enemySprite)의 위치를 정확히 따라다니도록 동기화한다
  update() {
    if (this.enemyAura && this.enemyAura.active && this.enemySprite && this.enemySprite.active) {
      this.enemyAura.setPosition(this.enemySprite.x, this.enemySprite.y);
    }
  }

  updateStatus(instant = false) {
    // 플레이어 정보창의 수치와 체력바·마나바(잔상 효과 포함)를 실시간으로 갱신한다
    this.hpText.setText(`${playerState.hp} / ${playerState.maxHp}`);
    this.mpText.setText(`${playerState.mp} / ${playerState.maxMp}`);
    const hpRatio = Math.max(0, playerState.hp / playerState.maxHp);
    const mpRatio = Math.max(0, playerState.mp / playerState.maxMp);
    this.playerHpBar.scaleX = hpRatio;
    this.playerMpBar.scaleX = mpRatio;
    this.tweens.killTweensOf(this.playerHpTrail);
    if (instant || hpRatio >= this.playerHpTrail.scaleX) {
      this.playerHpTrail.scaleX = hpRatio;
    } else {
      this.tweens.add({
        targets: this.playerHpTrail, scaleX: hpRatio,
        delay: 180, duration: 360, ease: 'Cubic.easeOut'
      });
    }
  }

  // 적 체력바 길이(잔상 효과 포함)와 HP 수치 텍스트를 현재 체력에 맞춰 갱신한다
  updateEnemyHp(instant = false) {
    const ratio = Math.max(0, this.enemyHp / this.cfg.enemy.hp);
    this.enemyHpBar.scaleX = ratio;
    this.enemyHpText.setText(`HP ${this.enemyHp} / ${this.cfg.enemy.hp}`);
    this.tweens.killTweensOf(this.enemyHpTrail);
    if (instant || ratio >= this.enemyHpTrail.scaleX) {
      this.enemyHpTrail.scaleX = ratio;
    } else {
      this.tweens.add({
        targets: this.enemyHpTrail, scaleX: ratio,
        delay: 180, duration: 400, ease: 'Cubic.easeOut'
      });
    }
  }

  // 현재 모드(메인/스킬)에 따라 커서를 움직인다 — 스킬 창은 2열이므로 상하좌우 모두 이동에 쓴다
  moveSel(dir) {
    if (this.turnLocked || this.dialogue.active) return;
    if (this.menuMode === 'skill') {
      const n = playerState.skills.length;
      const i = this.skillIndex, c = i % 2;
      let ni = i;
      if (dir === 'left' && c === 1) ni = i - 1;
      else if (dir === 'right' && c === 0 && i + 1 < n) ni = i + 1;
      else if (dir === 'up') ni = i - 2 >= 0 ? i - 2 : c + 2 * Math.floor((n - 1 - c) / 2);
      else if (dir === 'down') ni = i + 2 < n ? i + 2 : c;
      this.skillIndex = ni;
      this.skillSelector.x = 40 + (ni % 2) * 300;
      this.skillSelector.y = this.skillY + Math.floor(ni / 2) * this.skillGapY;
      this.updateSkillDesc();
      sound.menuMove();
    } else {
      if (dir !== 'up' && dir !== 'down') return;
      this.menuIndex = Phaser.Math.Wrap(this.menuIndex + (dir === 'up' ? -1 : 1), 0, this.menuItems.length);
      this.selector.y = this.menuY + this.menuIndex * this.menuGap;
      this.refreshMainMenuStyle();
      sound.menuMove();
    }
  }

  // 메인 메뉴 포커스 색상 및 하단 예상 행동 툴팁(actionHintText)을 갱신한다
  refreshMainMenuStyle() {
    if (!this.menuTexts) return;
    const hasSkills = playerState.skills.length > 0;
    this.menuTexts.forEach((t, i) => {
      if (!t || !t.active) return;
      const item = this.menuItems[i];
      const disabled = item === '스킬' && !hasSkills;
      const active = i === this.menuIndex;
      t.setColor(disabled ? '#6e6a86' : active ? '#ffe9a8' : '#dddddd');
    });
    if (!this.actionHintText || !this.actionHintText.active) return;
    if (this.menuMode !== 'main') {
      this.actionHintText.setText('');
      return;
    }
    const cur = this.menuItems[this.menuIndex];
    if (cur === '공격') {
      const min = this.attackDamage('공격', -1), max = this.attackDamage('공격', 1);
      const focusNote = this.focused ? ' · 집중 +25% 적용' : '';
      const guardNote = this.enemyGuarding ? ' · 적 방어 중' : '';
      this.actionHintText.setText(`▶ 기본 공격 · 예상 피해 ${min}~${max}${focusNote}${guardNote}`);
    } else if (cur === '스킬') {
      const anyUsable = playerState.skills.some(name => !this.skillUnavailable(name));
      this.actionHintText.setText(!hasSkills
        ? '▶ 아직 습득한 스킬이 없습니다'
        : anyUsable
          ? `▶ 습득 스킬 (${playerState.skills.length}종) · 상성 및 예상 피해 확인`
          : '▶ 마나 부족 · 이번 턴에는 방어로 MP를 회복하세요 (MP +6)');
    } else if (cur === '방어') {
      const healHp = Math.max(3, Math.round(playerState.maxHp * 0.08));
      this.actionHintText.setText(`▶ 방어 자세 · 피해 대폭 경감 + HP +${healHp}, MP +10 회복 (연속 감쇠 초기화)`);
    } else if (cur === '곁에 있기') {
      this.actionHintText.setText('▶ 검을 내려놓고 조용히 곁에 머문다');
    }
  }

  // 현재 모드의 선택을 확정한다
  confirmSel() {
    if (this.menuMode === 'skill') this.selectSkill(this.skillIndex);
    else this.selectMenu(this.menuIndex);
  }

  // 메인 메뉴 선택 → 공격 / 스킬 창 열기 / 방어
  selectMenu(i) {
    if (this.turnLocked || this.dialogue.active || this.battleResolved || !this.menuItems[i]) return;
    if (this.menuMode === 'skill') this.closeSkillMenu();   // 스킬 창이 열린 채 클릭 시 먼저 닫는다
    this.menuIndex = i;
    this.selector.y = this.menuY + i * this.menuGap;

    const choice = this.menuItems[i];
    if (choice === '곁에 있기') {
      this.comfortSorrow();
      return;
    }
    if (choice === '스킬') {
      if (!playerState.skills.length) {
        sound.menuDenied?.();
        this.logText.setText('아직 배운 스킬이 없다.');
        const skillTextObj = this.menuTexts[i];
        if (skillTextObj) {
          this.tweens.add({ targets: skillTextObj, x: 471, duration: 45, yoyo: true, repeat: 2 });
        }
        return;
      }
      sound.menuConfirm();
      this.openSkillMenu();
      return;
    }

    this.turnLocked = true;
    if (choice === '방어') {
      this.guarding = true;
      this.prevSkillUsed = null;          // 방어로 호흡을 가다듬으면 연속 스킬 감쇠도 초기화된다
      this.advanceCooldown();
      sound.guard();
      const healHp = Math.max(3, Math.round(playerState.maxHp * 0.08));
      const beforeHp = playerState.hp;
      playerState.hp = Math.min(playerState.maxHp, playerState.hp + healHp);
      const actualHeal = playerState.hp - beforeHp;
      this.updateStatus();
      if (actualHeal > 0) {
        this.floatText(this.heroSprite.x, this.heroSprite.y - 40, `+${actualHeal}`, '#7fffd8', 17);
      }
      this.logText.setText(`호흡을 가다듬고 방어 자세를 취했다. (HP +${healHp}, 마나 +10)`);
      this.guardAnim();
      this.time.delayedCall(350, () => this.enemyTurn());
    } else {
      this.hitEnemy(choice);
    }
  }

  // 마지막 선택을 기억하고 목록과 상세 정보를 나누어 읽기 쉽게 표시한다.
  openSkillMenu() {
    if (!playerState.skills.length) {
      this.logText.setText('아직 배운 스킬이 없다.');
      return;
    }
    this.menuMode = 'skill';
    this.skillIndex = Math.max(0, playerState.skills.indexOf(playerState.lastSkill));
    this.skillObjs = [];

    // 스킬 창 — 하단 전체를 덮는 2열 박스 (포켓몬의 기술 선택창, UI 레이어 위인 depth 35)
    const panel = this.add.rectangle(12, 366, 616, 102, 0x0a0a14, 1)
      .setOrigin(0, 0).setStrokeStyle(2, 0x8a86b8).setDepth(35).setInteractive();
    this.skillObjs.push(panel);
    this.skillY = 375;
    this.skillGapY = 25;

    playerState.skills.forEach((name, i) => {
      const info = SKILL_INFO[name];
      const eff = this.typeMult(info.type);
      const effTag = eff > 1 ? ' ▲' : eff < 1 ? ' ▼' : '';
      const isRepeated = this.isRepeatedSkill(name);
      const repeatTag = isRepeated ? ' [연속↓]' : '';
      const unavailable = this.skillUnavailable(name);
      const col = i % 2, row = Math.floor(i / 2);
      const t = this.add.text(56 + col * 300, this.skillY + row * this.skillGapY,
        `${name} · MP ${info.mp}${effTag}${repeatTag}${info.cooldown && this.burstCooldown ? ` (${this.burstCooldown}행동)` : ''}`, {
          fontSize: '14px', fontFamily: 'monospace',
          color: unavailable ? '#888899' : isRepeated ? '#b8a8d8' : eff > 1 ? '#ffe9a8' : '#dddddd'
        }).setDepth(36)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.skillIndex = i;
          this.skillSelector.x = 40 + (i % 2) * 300;
          this.skillSelector.y = this.skillY + Math.floor(i / 2) * this.skillGapY;
          this.updateSkillDesc();
        })
        .on('pointerdown', () => this.selectSkill(i));
      this.skillObjs.push(t);
    });

    // 스킬 창 우상단에 마우스 클릭으로도 닫을 수 있는 [× 닫기] 버튼을 배치한다
    const closeBtn = this.add.text(612, 375, '[× 닫기]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a86b8'
    }).setOrigin(1, 0).setDepth(36)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => closeBtn.setColor('#ffe9a8'))
      .on('pointerout', () => closeBtn.setColor('#8a86b8'))
      .on('pointerdown', () => {
        sound.menuMove();
        this.closeSkillMenu();
      });
    this.skillObjs.push(closeBtn);

    // 선택된 스킬의 상세 설명(desc)과 상성 안내를 패널 하단에 표시한다
    this.skillDescText = this.add.text(28, 428, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cfc8ff', lineSpacing: 3
    }).setDepth(36);
    this.skillObjs.push(this.skillDescText);

    this.skillSelector = this.add.text(40 + (this.skillIndex % 2) * 300,
      this.skillY + Math.floor(this.skillIndex / 2) * this.skillGapY, '▶', {
      fontSize: '13px', color: '#ffe9a8'
    }).setDepth(36);
    this.skillObjs.push(this.skillSelector);
    this.updateSkillDesc();
  }

  // 상성·집중·적 방어를 실제 계산과 같은 방식으로 반영한 피해 범위를 보여준다.
  updateSkillDesc() {
    if (!this.skillDescText || !this.skillDescText.scene) return;
    const name = playerState.skills[this.skillIndex];
    const info = SKILL_INFO[name];
    if (!info) return;
    const min = this.attackDamage(name, -1), max = this.attackDamage(name, 1);
    const eff = this.typeMult(info.type);
    const relation = eff > 1 ? '약점 ×1.5' : eff < 1 ? '반감 ×0.6' : '보통';
    const repeatNote = this.isRepeatedSkill(name) ? ' · 연속 사용 감쇠 ×0.65' : '';
    const status = this.skillUnavailable(name) || info.desc;
    this.skillDescText.setColor(this.skillUnavailable(name) ? '#ffb3b3' : '#cfc8ff');
    this.skillDescText.setText(
      `[${TYPES[info.type].name}] 예상 ${min}~${max}${info.hits ? ' (4회 합계)' : ''} · ${relation}${repeatNote} · Q: 뒤로\n${status}`);
  }

  closeSkillMenu() {
    this.menuMode = 'main';
    if (this.skillObjs) this.skillObjs.forEach(o => o.destroy());
    this.skillObjs = null;
    this.refreshMainMenuStyle();
  }

  // 스킬 창에서 스킬 선택 — MP가 부족하거나 재충전 중이면 거부음과 흔들림 피드백만 주고 턴을 소모하지 않는다
  selectSkill(i) {
    if (this.turnLocked || this.dialogue.active || this.menuMode !== 'skill' || this.sorrowReady) return;
    const name = playerState.skills[i];
    const info = SKILL_INFO[name];
    if (!info) return;
    this.skillIndex = i;
    if (this.skillUnavailable(name)) {
      sound.menuDenied?.();
      this.updateSkillDesc();
      if (this.skillDescText) {
        this.tweens.add({ targets: this.skillDescText, x: 33, duration: 45, yoyo: true, repeat: 2 });
      }
      return;
    }
    playerState.mp -= info.mp;
    playerState.lastSkill = name;
    this.closeSkillMenu();
    this.turnLocked = true;
    this.updateStatus();
    this.hitEnemy(name);
  }

  // 상성 배율 — 공격 타입이 적 타입을 이기면 1.5배, 지면 0.6배, 무상성은 1배
  typeMult(atkType) {
    const def = this.cfg.enemy.type;
    if (!atkType || !def) return 1;
    if (TYPES[atkType].beats === def) return STRONG_MULT;
    if (TYPES[def].beats === atkType) return WEAK_MULT;
    return 1;
  }

  // 사용 불가 이유를 목록·설명·실행 검증에서 공유하며, 실패한 선택은 턴을 쓰지 않는다.
  skillUnavailable(name) {
    const skill = SKILL_INFO[name];
    if (!skill) return '사용할 수 없는 스킬이다.';
    if (skill.cooldown && this.burstCooldown > 0) return `재충전 중: 다른 행동 ${this.burstCooldown}회 필요.`;
    if (playerState.mp < skill.mp) return `마나 부족: MP ${skill.mp} 필요 (현재 ${playerState.mp}) — 방어로 MP를 회복하세요 (Q: 뒤로).`;
    return '';
  }

  // 기본 공격·방어도 파동을 재충전한다. 메뉴 이동이나 실패한 선택은 포함하지 않는다.
  advanceCooldown() {
    this.burstCooldown = Math.max(0, this.burstCooldown - 1);
    this.updateCombatHints();
  }

  // 강공격 경고는 스킬 창을 열어도 사라지지 않으며, 집중과 재충전도 항상 표시한다.
  updateCombatHints() {
    const intent = this.enemyCharged ? '강공격 준비! 다음 행동은 방어 권장'
      : this.enemyGuarding ? '웅크리기 · 힘의 일격으로 방어 관통' : '';
    this.intentText?.setText(intent).setVisible(!!intent);
    if (this.enemyStateBadge) {
      const badge = this.enemyCharged ? '[⚡강공격 준비]' : this.enemyGuarding ? '[🛡방어 중]' : '';
      this.enemyStateBadge.setText(badge).setColor(this.enemyCharged ? '#ff7788' : '#7fffd8');
    }
    this.focusText?.setText([
      this.focused ? '집중 +25%' : '',
      this.burstCooldown ? `파동 ${this.burstCooldown}행동` : ''
    ].filter(Boolean).join(' · '));
    this.syncFocusAura();
    this.refreshMainMenuStyle();
  }

  // 마음의 눈 집중(+25%) 상태일 때 주인공 주변에 청록빛 오라 링을 유지한다
  syncFocusAura() {
    if (this.focused && !this.focusAura && this.heroSprite) {
      this.focusAura = this.add.ellipse(this.heroSprite.x, this.heroSprite.y + 34, 92, 24, 0x7fffd8, 0.14)
        .setStrokeStyle(2, 0x7fffd8, 0.85).setDepth(9);
      this.tweens.add({
        targets: this.focusAura, scaleX: 1.14, scaleY: 1.14, alpha: 0.32,
        duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else if (!this.focused && this.focusAura) {
      this.tweens.killTweensOf(this.focusAura);
      this.focusAura.destroy();
      this.focusAura = null;
    }
  }

  // 보유 스킬이 2종 이상일 때 직전 턴과 동일한 스킬을 연속 사용하는지 여부 (적의 동작 적응 감쇠)
  isRepeatedSkill(choice) {
    return !!(SKILL_INFO[choice] && playerState.skills.length >= 2 && this.prevSkillUsed === choice);
  }

  // 미리보기와 실제 타격이 같은 상성·방어·집중·연속 사용 감쇠 계산을 사용한다.
  // 단, 마음의 눈(skill.focus)을 연속으로 사용할 때는 집중 증폭(+25%)이 자기 자신에게 적용·중첩되지 않는다.
  attackDamage(choice, variance = 0) {
    const skill = SKILL_INFO[choice];
    const guardMult = !this.enemyGuarding ? 1 : skill?.pierce ? 1.5 : 0.45;
    const focusMult = (this.focused && !skill?.focus) ? 1.25 : 1;
    const repeatMult = this.isRepeatedSkill(choice) ? 0.65 : 1;
    return Math.max(1, Math.round((playerState.atk * (skill?.mult ?? 1)
      * this.typeMult(skill?.type) * focusMult * repeatMult + variance) * guardMult));
  }

  // 보스의 1단계 초과 피해로 2단계가 생략되지 않도록 체력 절반을 경계로 삼는다.
  enemyHpFloor() {
    if (this.cfg.enemy.finale && !this.finalEventDone) return Math.ceil(this.cfg.enemy.hp * 0.5);
    return this.cfg.enemy.pattern === 'sorrow' ? 1 : 0;
  }

  // 피해는 연출의 접촉 콜백에서만 반영하고, 모든 타격과 복귀 이후에 다음 턴을 시작한다.
  hitEnemy(choice) {
    if (this.sorrowReady || this.battleResolved || this.attackPending) return;
    this.attackPending = true;
    this.turnLocked = true;
    const skill = SKILL_INFO[choice];
    if (skill?.cooldown) this.burstCooldown = skill.cooldown;
    const eff = this.typeMult(skill?.type);
    const guarded = this.enemyGuarding;
    const wasFocused = this.focused && !skill?.focus;
    const wasRepeated = this.isRepeatedSkill(choice);
    const total = Math.min(this.attackDamage(choice, Phaser.Math.Between(-1, 1)),
      Math.max(0, this.enemyHp - this.enemyHpFloor()));
    this.prevSkillUsed = skill ? choice : null;
    const hits = skill?.hits ?? 1;
    let appliedHits = 0;
    let appliedDamage = 0;
    this.logText.setText(`${choice}...`);
    this.attackAnim(choice, () => {
      if (appliedHits >= hits || this.battleResolved) return;
      // 나눗셈 나머지를 마지막 타격까지 분배해 다단히트의 합계를 정확히 보존한다.
      appliedHits++;
      const cumulative = Math.floor(total * appliedHits / hits);
      const damage = cumulative - appliedDamage;
      appliedDamage = cumulative;
      this.enemyHp -= damage;
      this.updateEnemyHp();
      const pierced = guarded && !!skill?.pierce;
      if (appliedHits === 1) {
        this.enemyGuarding = false;
        this.focused = false;
        // 마음의 눈 집중 버프가 실린 첫 타격에 청록빛 집중 방출 링을 터뜨린다
        if (wasFocused) {
          const focusRing = this.add.circle(this.enemySprite.x, this.enemySprite.y, 16)
            .setStrokeStyle(3, 0x7fffd8, 0.95).setDepth(13);
          this.tweens.add({
            targets: focusRing, scale: 3.4, alpha: 0, duration: 280, ease: 'Cubic.easeOut',
            onComplete: () => focusRing.destroy()
          });
        }
      }
      if (appliedHits === hits) this.focused = !!skill?.focus;
      this.updateCombatHints();
      this.impactFeedback(this.enemySprite, skill?.fx ?? 'slash', appliedHits === hits, false, {
        weak: eff > 1,
        resisted: eff < 1 || (guarded && !skill?.pierce) || wasRepeated,
        pierce: pierced
      });
      const numColor = pierced ? '#ff9e7a' : eff > 1 ? '#ffe9a8' : eff < 1 ? '#9999aa' : '#eeeeee';
      const numSize = (hits > 1 ? 18 : 23) + (eff > 1 || pierced ? 3 : eff < 1 ? -3 : 0);
      this.floatText(this.enemySprite.x + (hits > 1 ? (appliedHits - 2.5) * 18 : 0),
        this.enemySprite.y - 42, `-${damage}`, numColor, numSize);
      if (appliedHits === hits) {
        if (pierced) {
          this.floatText(this.enemySprite.x, this.enemySprite.y - 68, 'BREAK!', '#ff9e7a', 15);
        } else if (eff > 1) {
          this.floatText(this.enemySprite.x, this.enemySprite.y - 68, 'WEAK!', '#ffe9a8', 15);
        }
        const relation = eff > 1 ? ' 약점!' : eff < 1 ? ' 반감.' : '';
        const repeatNote = wasRepeated ? ' (연속 사용으로 적이 대비해 피해 감소)' : '';
        const guardNote = guarded ? skill?.pierce ? ' 방어 돌파!' : ' 적 방어로 피해 감소.' : '';
        this.logText.setText(`${choice}! ${total}의 피해.${relation}${guardNote}${repeatNote}${skill?.focus ? '\n집중했다. 다음 공격 피해 +25%.' : ''}`);
      }
    }, () => {
      this.attackPending = false;
      if (!skill?.cooldown) this.advanceCooldown();
      else this.updateCombatHints();
      this.afterPlayerAttack();
    });
  }

  afterPlayerAttack() {
    const enemy = this.cfg.enemy;
    if (enemy.finale && !this.finalEventDone && this.enemyHp <= enemy.hp * 0.5) {
      this.finalStand();
    } else if (enemy.pattern === 'sorrow' && this.enemyHp <= enemy.hp * 0.3) {
      this.offerComfort();
    } else if (this.enemyHp <= 0) {
      this.onWin();
    } else {
      this.enemyTurn();
    }
  }

  offerComfort() {
    if (this.sorrowReady || this.battleResolved) return;
    this.sorrowReady = true;
    this.turnLocked = true;
    this.enemyCharged = false;
    this.enemyGuarding = false;
    this.clearGuard();
    this.focused = false;
    this.burstCooldown = 0;
    this.updateCombatHints();
    if (this.menuMode === 'skill') this.closeSkillMenu();
    this.enemySprite.clearTint();
    this.enemyAura.setTint(0x7fffd8);
    sound.playBgm('story');
    this.menuItems = ['곁에 있기'];
    this.menuIndex = 0;
    this.selector.y = this.menuY;
    this.menuTexts[0].setText('  곁에 있기');
    this.menuTexts.slice(1).forEach(text => text.setVisible(false).disableInteractive());
    this.logText.setText('더는 공격하지 않아도 된다.\n「곁에 있기」를 선택해 보자.');
    this.dialogue.start(DIALOGUES.sorrow_open, () => {
      this.time.delayedCall(300, () => { this.turnLocked = false; });
    });
  }

  comfortSorrow() {
    if (!this.sorrowReady || this.turnLocked || this.battleResolved) return;
    this.turnLocked = true;
    sound.menuConfirm();
    this.logText.setText('검을 내려놓고, 조용히 곁으로 다가갔다.');
    this.tweens.killTweensOf(this.heroSprite);
    this.tweens.add({
      targets: this.heroSprite, x: 370, y: 210, duration: 900, ease: 'Sine.easeInOut',
      onComplete: () => {
        this.enemySprite.setTint(0xc8e8ef);
        this.dialogue.start(DIALOGUES.sorrow_comfort, () => {
          this.sorrowComforted = true;
          this.onWin();
        });
      }
    });
  }

  // 적의 턴 — 적의 감정 특성(pattern: rage/fear/sorrow) 및 강공격 차징 패턴을 처리한다
  enemyTurn() {
    if (this.sorrowReady || this.battleResolved) return;
    this.turnLocked = true;
    this.turnCount++;
    const pattern = this.cfg.enemy.pattern;
    const canCharge = this.cfg.enemy.hp >= 60;
    // 분노한 그림자('rage')는 2턴 주기로 더 자주 강공격을 예고하고, 일반 강적은 3턴 주기로 차징한다
    const shouldCharge = canCharge && !this.enemyCharged && (
      pattern === 'rage' ? this.turnCount % 2 === 1 : this.turnCount % 3 === 2
    );
    if (shouldCharge) {
      this.prepareEnemyCharge();
      return;
    }

    const isHeavy = this.enemyCharged;
    this.enemyCharged = false;
    this.enemySprite.clearTint();

    // 두려움의 견제는 다음 공격을 방어하며, 힘의 일격으로 돌파할 수 있다.
    const isFearGuard = !isHeavy && pattern === 'fear' && this.turnCount % 3 === 1;
    if (isFearGuard) {
      this.enemyGuarding = true;
    }

    let dmg = Math.round(this.cfg.enemy.atk * (isHeavy ? 2.3 : isFearGuard ? 0.8 : 1)) + Phaser.Math.Between(-1, 1);
    if (this.guarding) dmg = Math.max(1, Math.round(dmg * (isHeavy ? 0.22 : 0.3)));

    // 피해와 마나 회복은 적의 돌진이 실제로 닿았을 때 한 번만 처리한다.
    // 자연 MP 회복을 없애고 방어 시에만 MP(+10)를 크게 회복하며, 슬픔의 파동은 비방어 시 MP를 2 감소시킨다.
    const sorrowDrain = (!isHeavy && pattern === 'sorrow' && !this.guarding && this.turnCount % 2 === 1) ? 2 : 0;
    const wasGuarding = this.guarding;
    const home = { x: this.enemySprite.x, y: this.enemySprite.y };
    this.updateCombatHints();
    const afterEnemyHit = () => {
      this.clearGuard();
      if (playerState.hp <= 0) {
        this.cfg.enemy.finale && !this.finalEventDone ? this.finalStand() : this.onLose();
      } else {
        this.turnLocked = false;
      }
    };
    // 대각선으로 접근해 같은 타격선에 도달한 후 원래 발판으로 복귀한다.
    this.tweens.add({
      targets: this.enemySprite, x: this.heroSprite.x + 54, y: this.heroSprite.y - 8,
      duration: isHeavy ? 240 : 190, ease: 'Quad.easeIn',
      onComplete: () => {
        playerState.hp = Math.max(0, playerState.hp - dmg);
        playerState.mp = Math.max(0, Math.min(playerState.maxMp, playerState.mp + (wasGuarding ? 10 : -sorrowDrain)));
        this.updateStatus();
        this.impactFeedback(this.heroSprite, isHeavy ? 'heavy' : 'slash', true, wasGuarding);
        this.floatText(this.heroSprite.x, this.heroSprite.y - 40, `-${dmg}`,
          wasGuarding ? '#7ab8ff' : '#ff8888', isHeavy ? 22 : 18);
        const atkLabel = isHeavy ? '거센 일격' : isFearGuard ? '떨리는 견제' : sorrowDrain ? '슬픔의 파동' : '공격';
        const note = wasGuarding ? ' 방어 성공! MP +10.'
          : isFearGuard ? ' 적이 다시 웅크렸다.' : sorrowDrain ? ' 마나 -2 감소.' : '';
        this.logText.setText(`${this.cfg.enemy.name}의 ${atkLabel}!\n${dmg}의 피해.${note}`);
        this.tweens.add({
          targets: this.enemySprite, ...home, delay: 130, duration: 190,
          ease: 'Sine.easeInOut', onComplete: afterEnemyHit
        });
      }
    });
  }

  // 차징 경고는 전투 로그와 고정 표시를 함께 사용하며, 2단계 시작 시에도 같은 예고를 쓴다.
  prepareEnemyCharge(recoverMana = true) {
    this.turnLocked = true;
    this.enemyCharged = true;
    if (recoverMana && this.guarding) {
      playerState.mp = Math.min(playerState.maxMp, playerState.mp + 10);
      this.updateStatus();
    }
    this.clearGuard();
    sound.charge();
    this.enemySprite.setTint(0xff6688);
    const aura = this.add.circle(this.enemySprite.x, this.enemySprite.y, 16)
      .setStrokeStyle(4, 0xff4466).setDepth(11);
    this.tweens.add({
      targets: aura, scale: 3.4, alpha: 0, duration: 450,
      onComplete: () => aura.destroy()
    });
    this.logText.setText('강한 기운을 모으고 있다!\n다음 턴 강공격 · 방어하면 피해 감소, MP +10.');
    this.updateCombatHints();
    this.time.delayedCall(500, () => { this.turnLocked = false; });
  }

  // 근접기는 적에게 접근하고, 눈과 파동은 제자리에서 시전한다. 복귀 완료가 턴의 경계다.
  attackAnim(choice, onImpact, onDone) {
    const info = SKILL_INFO[choice] || {};
    const melee = !info.fx || info.fx === 'heavy' || info.fx === 'wave';
    const home = { x: this.heroSprite.x, y: this.heroSprite.y };
    const banner = info.fx ? this.skillBanner(choice) : null;
    const fxColor = info.color ?? 0x7ab8ff;

    // 시전 순간 주인공 발판에서 퍼져 나가는 속성 마법진 파동
    const castRing = this.add.ellipse(home.x, home.y + 42, 72, 20, fxColor, 0.25)
      .setStrokeStyle(2, fxColor, 0.9).setDepth(9);
    this.tweens.add({
      targets: castRing, scaleX: 2.1, scaleY: 1.9, alpha: 0, duration: 280, ease: 'Cubic.easeOut',
      onComplete: () => castRing.destroy()
    });

    const finish = () => {
      banner?.destroy();
      if (!melee) { onDone(); return; }
      this.tweens.add({
        targets: this.heroSprite, ...home, duration: 170,
        ease: 'Sine.easeInOut', onComplete: onDone
      });
    };
    const cast = () => this.hitFx(info.fx || 'slash', info.color ?? 0xffffff, onImpact, finish);
    if (melee) {
      // 근접 스킬로 박차고 나갈 때 대시 잔상 2개를 남겨 속도감을 살린다
      if (info.fx) {
        for (let s = 1; s <= 2; s++) {
          this.time.delayedCall(s * 35, () => {
            if (!this.heroSprite?.active) return;
            const ghost = this.add.image(this.heroSprite.x, this.heroSprite.y, 'hero-right-0')
              .setScale(3.9).setTint(fxColor).setAlpha(0.45).setDepth(9);
            this.tweens.add({
              targets: ghost, alpha: 0, duration: 140,
              onComplete: () => ghost.destroy()
            });
          });
        }
      }
      this.tweens.add({
        targets: this.heroSprite, x: this.enemySprite.x - 50, y: this.enemySprite.y + 8,
        duration: info.fx === 'wave' ? 130 : 180, ease: 'Quad.easeOut', onComplete: cast
      });
    } else cast();
  }

  // 접촉 순간의 소리·넉백·흔들림·스쿼시&스트레치·십자 히트스파크를 동기화한다.
  impactFeedback(target, fx, last, blocked = false, meta = {}) {
    const playerHit = target === this.heroSprite;
    if (playerHit) blocked ? sound.guard() : sound.hurt();
    else sound.hit(fx, last, meta);
    const crit = !playerHit && last && (meta.weak || meta.pierce);
    const strong = last && (fx === 'heavy' || fx === 'burst' || crit) && !blocked;
    target.setTintFill(blocked ? 0x7ab8ff : crit ? 0xffe9a8 : 0xff9999);
    this.time.delayedCall(110, () => {
      target.clearTint();
      if (target === this.enemySprite && this.enemyCharged) target.setTint(0xff6688);
    });
    const shakeDur = fx === 'burst' ? 190 : strong ? 150 : 75;
    const shakeInt = blocked ? 0.0015 : fx === 'burst' ? 0.0085 : strong ? 0.0065 : meta.resisted ? 0.0012 : 0.0025;
    this.cameras.main.shake(shakeDur, shakeInt);

    // 넉백 이동과 함께 순간적인 스쿼시 & 스트레치(납작해졌다 복원되는 탄성)를 준다
    const baseScale = playerHit ? 4 : 5.6;
    this.tweens.add({
      targets: target,
      x: playerHit ? '-=6' : strong ? '+=12' : '+=5',
      scaleX: baseScale * (blocked ? 0.96 : strong ? 1.18 : 1.09),
      scaleY: baseScale * (blocked ? 1.04 : strong ? 0.84 : 0.92),
      duration: 42,
      yoyo: true
    });

    // 타격 지점에 날카로운 십자(Cross) 히트 플래시를 터뜨린다
    const sparkCol = blocked ? 0x7ab8ff : crit ? 0xffe9a8 : 0xffffff;
    const cross = this.add.container(target.x, target.y).setAngle(45).setDepth(14);
    const len = strong ? 44 : 26;
    cross.add([
      this.add.rectangle(0, 0, len, 4, sparkCol, 0.95),
      this.add.rectangle(0, 0, 4, len, sparkCol, 0.95)
    ]);
    this.tweens.add({
      targets: cross, scale: strong ? 1.45 : 1.2, alpha: 0, duration: 120,
      onComplete: () => cross.destroy()
    });

    // 플레이어가 적의 강공격에 방어 없이 피격당하면 화면에 붉은 위기 섬광이 스친다
    if (playerHit && fx === 'heavy' && !blocked) {
      const dangerVeil = this.add.rectangle(320, 240, 640, 480, 0xff2244, 0.24).setDepth(28);
      this.tweens.add({
        targets: dangerVeil, alpha: 0, duration: 280,
        onComplete: () => dangerVeil.destroy()
      });
    }

    if (strong) {
      // 타격 지점에 순간적인 백열 임팩트 링을 터뜨리고 히트스톱으로 묵직한 손맛을 전달한다
      const flashRing = this.add.circle(target.x, target.y, 18, 0xffffff, 0.55).setDepth(14);
      this.tweens.add({
        targets: flashRing, scale: 2.3, alpha: 0, duration: 160,
        onComplete: () => flashRing.destroy()
      });
      this.tweens.timeScale = 0;
      this.time.delayedCall(fx === 'burst' ? 95 : 80, () => { this.tweens.timeScale = 1; });
    }
  }

  // 상단 빈 공간에 기술 이름을 표시하고 해당 기술이 끝날 때 정리한다.
  skillBanner(name) {
    const info = SKILL_INFO[name] || {};
    const hex = info.color !== undefined
      ? `#${info.color.toString(16).padStart(6, '0')}` : '#ffe9a8';
    const t = this.add.text(320, 28, `「${name}」`, {
      fontSize: '18px', fontFamily: 'monospace', color: hex,
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0, 0.5).setDepth(32).setScale(0.8);
    this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
    return t;
  }

  // 각 기술이 실제 접촉과 연출 종료를 알린다. 전투 진행은 별도 고정 타이머를 쓰지 않는다.
  hitFx(fx, color, onImpact, onDone) {
    const ex = this.enemySprite.x, ey = this.enemySprite.y;
    sound.skillWindup(fx);
    const fade = (obj, dur, extra = {}, done = null) => this.tweens.add({
      targets: obj, alpha: 0, duration: dur, ...extra,
      onComplete: () => { obj.destroy(); done?.(); }
    });
    // 3중 레이어 참격 — 글로우 후광 + 본체 + 백열 코어가 겹친 빔
    const slash = (x, y, w, h, ang) => {
      const c = this.add.container(x, y).setAngle(ang).setDepth(12);
      c.add([
        this.add.rectangle(0, 0, w + 10, h + 10, color, 0.25),
        this.add.rectangle(0, 0, w + 4, h + 4, color, 0.7),
        this.add.rectangle(0, 0, w, h, 0xffffff)
      ]);
      return c;
    };
    // 도트 캐릭터와 어울리는 작은 사각 입자가 사방으로 퍼진다.
    const sparks = (x, y, n, dist, dur) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
        const s = this.add.rectangle(x, y, 4, 4, color).setDepth(11);
        this.tweens.add({
          targets: s, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist,
          alpha: 0, duration: dur, ease: 'Cubic.easeOut',
          onComplete: () => s.destroy()
        });
      }
    };
    // 지면에 퍼지는 타원형 충격파
    const shockRing = (x, y, delay = 0) => {
      const r = this.add.circle(x, y, 12).setStrokeStyle(4, color).setDepth(10);
      this.tweens.add({
        targets: r, scaleX: 5, scaleY: 2.2, alpha: 0, delay,
        duration: 280, ease: 'Cubic.easeOut', onComplete: () => r.destroy()
      });
    };

    if (fx === 'heavy') {
      // 힘의 일격 — 날렵한 테이퍼드 대검과 날개형 크로스가드를 치켜올려 기를 모은 뒤, 수직 빛기둥·대지 파편과 함께 내리꽂는다.
      const sword = this.add.container(ex, ey - 74).setDepth(13);
      sword.add([
        this.add.circle(0, -52, 5, 0xffe9a8),                             // 폼멜 보석
        this.add.rectangle(0, -42, 6, 16, 0x8a6a3a),                      // 손잡이
        this.add.rectangle(-16, -31, 24, 6, 0xd8b86a).setAngle(-12),      // 좌측 날개 코등이
        this.add.rectangle(16, -31, 24, 6, 0xd8b86a).setAngle(12),        // 우측 날개 코등이
        this.add.rectangle(0, -30, 8, 8, color).setAngle(45),             // 코등이 코어 보석
        this.add.rectangle(0, 6, 32, 74, color, 0.32),                    // 검신 오라
        this.add.rectangle(0, 4, 18, 68, 0xd9e2ec),                       // 검신 본체
        this.add.rectangle(0, 20, 14, 42, 0xe8eff5),                      // 하단 테이퍼드 단면
        this.add.rectangle(0, 6, 5, 72, 0xffffff),                        // 중심 백열 엣지
        this.add.rectangle(0, 44, 13, 13, 0xffffff).setAngle(45)          // 날카로운 검끝
      ]);
      // 예비 동작: 위로 들어 올리며 검신이 빛으로 팽창한다
      this.tweens.add({
        targets: sword, y: ey - 104, scaleX: 1.18, scaleY: 1.18, duration: 75, ease: 'Sine.easeOut',
        onComplete: () => {
          const trail = this.add.rectangle(ex, ey - 42, 24, 122, color, 0.3).setDepth(11);
          this.tweens.add({
            targets: sword, y: ey - 24, scaleX: 1, scaleY: 1, duration: 115, ease: 'Cubic.easeIn',
            onComplete: () => {
              onImpact();
              // 적을 관통해 솟구치는 2중 수직 빛기둥
              const pillar = this.add.rectangle(ex, ey - 6, 42, 144, color, 0.42).setDepth(11);
              const pillarCore = this.add.rectangle(ex, ey - 6, 14, 144, 0xffffff, 0.75).setDepth(12);
              fade(pillar, 250, { scaleX: 1.8 });
              fade(pillarCore, 190, { scaleX: 0.3 });
              // 지면에서 솟구쳐 튀어 오르는 마름모 대지/화염 파편
              for (let i = 0; i < 6; i++) {
                const dir = i < 3 ? -1 : 1;
                const shard = this.add.rectangle(ex + dir * (10 + (i % 3) * 12), ey + 24, 7, 7, i % 2 ? color : 0xffe9a8)
                  .setAngle(45).setDepth(12);
                this.tweens.add({
                  targets: shard,
                  x: shard.x + dir * (22 + (i % 3) * 14),
                  y: ey - 10 - (i % 3) * 14,
                  angle: dir * 160,
                  alpha: 0,
                  duration: 260,
                  ease: 'Quad.easeOut',
                  onComplete: () => shard.destroy()
                });
              }
              shockRing(ex, ey + 26);
              shockRing(ex, ey + 26, 70);
              sparks(ex, ey + 12, 12, 82, 260);
              fade(trail, 180);
              fade(sword, 280, {}, onDone);
            }
          });
        }
      });
    } else if (fx === 'twin') {
      // 마음의 눈 — 회전하는 기하학 마름모 테두리와 날카로운 세로 동공이 적의 빈틈을 꿰뚫는다
      const frame = this.add.rectangle(ex, ey - 8, 92, 92)
        .setStrokeStyle(2, color, 0.55).setAngle(45).setDepth(11).setScale(0.3);
      this.tweens.add({ targets: frame, scale: 1.05, angle: 135, duration: 340, ease: 'Cubic.easeOut' });

      const eye = this.add.container(ex, ey - 8).setDepth(12).setScale(1, 0.05);
      const slitPupil = this.add.ellipse(0, 0, 6, 26, 0x061016);          // 날카로운 세로 동공
      eye.add([
        this.add.ellipse(0, 0, 154, 88).setStrokeStyle(12, color, 0.22),  // 글로우 윤곽
        this.add.ellipse(0, 0, 128, 66).setStrokeStyle(4, color),         // 눈 테두리
        this.add.circle(0, 0, 20, color, 0.88),                           // 바깥 홍채
        this.add.circle(0, 0, 13, 0xd8fff4, 0.65),                        // 안쪽 발광 홍채
        slitPupil,
        this.add.circle(-6, -7, 3, 0xffffff, 0.95)                        // 반사광
      ]);
      this.tweens.add({
        targets: eye, scaleY: 1, duration: 220, ease: 'Back.easeOut',
        onComplete: () => {
          // 동공이 예리하게 수축한 뒤 교차 참격과 피해가 동시에 발생한다.
          this.tweens.add({ targets: slitPupil, scaleX: 0.45, scaleY: 1.2, duration: 120 });
          this.tweens.add({
            targets: eye, scaleX: 0.92, scaleY: 0.82, duration: 130,
            onComplete: () => {
              onImpact();
              fade(frame, 220, { scale: 1.45 });
              fade(slash(ex, ey, 114, 6, -48), 200);
              fade(slash(ex, ey, 114, 6, 48), 200);
              sparks(ex, ey, 10, 62, 220);
              // 주인공에게 깃드는 집중의 파장 연출
              const heroPulse = this.add.circle(this.heroSprite.x, this.heroSprite.y, 12)
                .setStrokeStyle(3, color, 0.9).setDepth(12);
              fade(heroPulse, 250, { scale: 3.2 });
              fade(eye, 250, { scaleY: 0.05 }, onDone);
            }
          });
        }
      });
    } else if (fx === 'wave') {
      // 잔상 베기 — 금빛 잔상 분신이 대각선 궤적으로 적을 교차 질주하며 4연속 참격을 가하고 마지막에 X자로 마무리한다.
      const cut = i => {
        const dir = i % 2 ? 1 : -1;
        const offsetY = [-20, 10, -12, 4][i] ?? 0;
        const startY = ey + offsetY - dir * 18;
        const endY = ey + offsetY + dir * 18;
        // 대각선으로 스쳐 지나가는 금빛 잔상 분신과 속도선
        const clone = this.add.image(ex - dir * 62, startY, 'hero-right-0')
          .setScale(3.85).setTint(color).setAlpha(0.76).setFlipX(dir < 0).setDepth(11);
        const speedLine = this.add.rectangle(ex, ey + offsetY, 116, 3, 0xffe9a8, 0.7)
          .setAngle(dir * 16).setDepth(11);
        fade(speedLine, 120, { scaleY: 0.2 });
        this.tweens.add({
          targets: clone, x: ex + dir * 54, y: endY, alpha: 0, duration: 145, ease: 'Cubic.easeOut',
          onComplete: () => clone.destroy()
        });
        const c = this.add.container(
          ex + dir * -28, ey + offsetY
        ).setDepth(12).setScale(0.65).setAngle(dir * -32);
        c.add([
          this.add.arc(0, 0, 46, -150, -20, false, 0, 0)
            .setStrokeStyle(10, color, 0.62).setClosePath(false),
          this.add.arc(0, 0, 46, -145, -25, false, 0, 0)
            .setStrokeStyle(4, 0xffffff, 0.96).setClosePath(false)
        ]);
        this.tweens.add({
          targets: c, angle: dir * 25, scale: i === 3 ? 1.32 : 1.04, duration: 65,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            onImpact();
            sparks(ex + dir * 8, ey + offsetY, i === 3 ? 12 : 5, i === 3 ? 74 : 38, 180);
            if (i === 3) {
              // 4번째 마무리 타격에서 금빛 X자 교차 검섬과 충격파가 함께 터진다
              fade(slash(ex, ey, 108, 6, -38), 170);
              fade(slash(ex, ey, 108, 6, 38), 170);
              shockRing(ex, ey + 24);
            }
            fade(c, i === 3 ? 150 : 70, { angle: dir * 65 }, () => {
              if (i < 3) cut(i + 1);
              else onDone();
            });
          }
        });
      };
      cut(0);
    } else if (fx === 'burst') {
      // 심연의 파동 — 다색(심연 보라+청록+백열) 회전 마법진 구체가 빛을 흡수해 날아가 대폭발을 일으킨다.
      const sx = this.heroSprite.x + 24, sy = this.heroSprite.y - 8;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const moteCol = i % 2 === 0 ? color : 0x7fffd8;
        const mote = this.add.circle(sx + Math.cos(a) * 48, sy + Math.sin(a) * 48, 3, moteCol, 0.88).setDepth(12);
        this.tweens.add({
          targets: mote, x: sx, y: sy, alpha: 0.2, duration: 220, ease: 'Quad.easeIn',
          onComplete: () => mote.destroy()
        });
      }
      const wave = this.add.container(sx, sy).setDepth(13).setScale(0.2);
      const glyphA = this.add.rectangle(0, 0, 38, 38).setStrokeStyle(2, 0x7fffd8, 0.75).setAngle(45);
      const glyphB = this.add.rectangle(0, 0, 38, 38).setStrokeStyle(2, color, 0.85);
      wave.add([
        this.add.circle(0, 0, 34, 0x2a124d, 0.55).setStrokeStyle(3, color),
        glyphA,
        glyphB,
        this.add.circle(0, 0, 15, 0xffffff, 0.95),
        this.add.arc(-8, 0, 44, -74, 74, false, 0, 0).setStrokeStyle(6, color).setClosePath(false)
      ]);
      this.tweens.add({ targets: wave, angle: 180, duration: 560 });
      this.tweens.add({
        targets: wave, scale: 1.12, duration: 260, ease: 'Sine.easeIn',
        onComplete: () => {
          // 비행 중 남는 다중 보라·청록 잔상 고리
          for (let step = 1; step <= 4; step++) {
            this.time.delayedCall(step * 55, () => {
              const ratio = step / 5;
              const ringCol = step % 2 === 0 ? 0x7fffd8 : color;
              const afterRing = this.add.circle(
                sx + (ex - sx) * ratio, sy + (ey - sy) * ratio, 16, ringCol, 0.28
              ).setStrokeStyle(2, 0xffffff, 0.65).setDepth(11);
              fade(afterRing, 180, { scale: 1.7 });
            });
          }
          this.tweens.add({
            targets: wave, x: ex, y: ey, duration: 300, ease: 'Cubic.easeIn',
            onComplete: () => {
              onImpact();
              // 적중 순간 심연 암전 대비 + 수직 심연 광선 + 다중 교차 섬광
              const dim = this.add.rectangle(320, 240, 640, 480, 0x06030e, 0.42).setDepth(8);
              const beam = this.add.rectangle(ex, ey - 10, 54, 180, color, 0.35).setDepth(11);
              fade(dim, 320);
              fade(beam, 260, { scaleX: 1.8 });
              shockRing(ex, ey + 26);
              shockRing(ex, ey + 26, 85);
              fade(slash(ex, ey, 132, 6, -35), 240);
              fade(slash(ex, ey, 132, 6, 35), 240);
              sparks(ex, ey, 20, 128, 340);
              fade(wave, 340, { scale: 3.2 }, onDone);
            }
          });
        }
      });
    } else {
      // 기본 공격 — 날렵한 초승달 베기 호와 검기, 타격 불꽃을 함께 터뜨린다
      onImpact();
      const arc = this.add.arc(ex - 6, ey, 36, -135, -15, false, 0, 0)
        .setStrokeStyle(6, 0xcfc8ff, 0.65).setClosePath(false).setDepth(11);
      fade(arc, 140, { scale: 1.25 });
      sparks(ex, ey, 5, 42, 160);
      fade(slash(ex, ey, 84, 5, -40), 150, {}, onDone);
    }
  }

  // 방어막은 적의 공격이 끝날 때까지 유지하여 피해 경감의 원인을 보여준다.
  guardAnim() {
    this.guardShield = this.add.circle(this.heroSprite.x, this.heroSprite.y, 34)
      .setStrokeStyle(3, 0x7ab8ff).setDepth(9).setAlpha(0.9);
    this.tweens.add({
      targets: this.guardShield, alpha: 0.6, scale: 1.12, duration: 250, yoyo: true, repeat: -1
    });
  }

  // 방어 상태와 지속 연출을 함께 해제한다.
  clearGuard() {
    this.guarding = false;
    if (this.guardShield) {
      this.tweens.killTweensOf(this.guardShield);
      this.guardShield.destroy();
      this.guardShield = null;
    }
  }

  // 최종전 전용 이벤트 1: 보스가 모은 힘을 빼앗는다 (붉은 입자 흡수 연출)
  // 단, 이전 시도에서 이미 부활 연출을 본 경우(finalEventSeen)에는 긴 대사를 생략하고 즉시 부활한다
  finalStand() {
    if (this.finalEventDone || this.battleResolved) return;
    this.finalEventDone = true;
    this.turnLocked = true;
    this.enemyCharged = false;
    this.enemyGuarding = false;
    this.clearGuard();
    this.turnCount = 0;
    this.focused = false;
    this.burstCooldown = 0;
    this.prevSkillUsed = null;
    this.enemyHp = Math.ceil(this.cfg.enemy.hp * 0.5);
    this.updateEnemyHp();
    this.updateCombatHints();
    this.enemySprite.clearTint();
    this.logText.setText('');
    this.phaseText?.setText('2단계 · 다시 모인 빛');

    if (this.finalEventSeen) {
      sound.reward();
      playerState.hp = playerState.maxHp;
      playerState.mp = playerState.maxMp;
      playerState.atk = this.initialAtk + 4;
      this.updateStatus();
      this.cameras.main.flash(350, 160, 200, 255);
      this.dialogue.start(DIALOGUES.final_return, () => {
        this.logText.setText('모은 힘이 하나로 모였다! (공격력 상승)');
        this.time.delayedCall(400, () => this.prepareEnemyCharge(false));
      });
      return;
    }

    this.cameras.main.flash(300, 255, 60, 60);

    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 80, () => {
        const orb = this.add.circle(
          this.heroSprite.x - 20 + Phaser.Math.Between(0, 60),
          this.heroSprite.y + Phaser.Math.Between(-15, 15),
          3, 0xff5566
        );
        this.tweens.add({
          targets: orb, x: this.enemySprite.x, y: this.enemySprite.y,
          duration: 500, ease: 'Cubic.easeIn',
          onComplete: () => orb.destroy()
        });
      });
    }
    playerState.atk = Math.max(1, playerState.atk - 4);
    playerState.hp = Math.max(1, playerState.hp);
    playerState.mp = 0;   // 모은 마나까지 함께 빼앗긴다
    this.updateStatus();

    this.time.delayedCall(1200, () =>
      this.dialogue.start(DIALOGUES.final_drain, () => this.alliesArrive()));
  }

  // 최종전 전용 이벤트 2: 지나온 모든 그림자(불안·초조·분노·두려움·슬픔·낯선 목소리)가 빛으로 나타나 주인공을 일으킨다
  alliesArrive() {
    const allySpecs = [
      { key: 'enemy1',     x: 188, y: 254, tint: 0xaac8ff }, // 불안한 그림자
      { key: 'enemy2',     x: 222, y: 274, tint: 0xffd28a }, // 초조한 그림자
      { key: 'enemy2',     x: 254, y: 260, tint: 0xff8a6a }, // 분노한 그림자
      { key: 'enemy1',     x: 204, y: 318, tint: 0x7fffd8 }, // 두려운 그림자
      { key: 'enemy3',     x: 238, y: 314, tint: 0xd2b8ff }, // 슬픈 그림자
      { key: 'inner-self', x: 274, y: 298, tint: null }      // 낯선 목소리
    ];
    const allies = allySpecs.map(s => {
      const img = this.add.image(s.x, s.y, s.key).setScale(3.6).setAlpha(0);
      if (s.tint) img.setTint(s.tint);
      return img;
    });
    this.tweens.add({ targets: allies, alpha: 0.92, duration: 1000 });

    this.time.delayedCall(1200, () => {
      this.dialogue.start(DIALOGUES.final_allies, () => {
        sound.reward();
        // 지나온 자들의 힘이 주인공에게 돌아온다 — 각자의 색 입자 + 완전 회복 + 공격력 상승
        for (let i = 0; i < 16; i++) {
          this.time.delayedCall(i * 60, () => {
            const src = allySpecs[i % allySpecs.length];
            const orb = this.add.circle(
              src.x + Phaser.Math.Between(-10, 10),
              src.y + Phaser.Math.Between(-10, 10),
              3, src.tint || 0xb8f0d8
            );
            this.tweens.add({
              targets: orb, x: this.heroSprite.x, y: this.heroSprite.y,
              duration: 480, ease: 'Cubic.easeIn',
              onComplete: () => orb.destroy()
            });
          });
        }
        // 힘을 건네준 그림자들이 서서히 빛 속으로 스며든다
        this.tweens.add({
          targets: allies, alpha: 0, duration: 900, delay: 400,
          onComplete: () => allies.forEach(a => a.destroy())
        });
        playerState.hp = playerState.maxHp;
        playerState.mp = playerState.maxMp;
        playerState.atk = this.initialAtk + 4;
        this.updateStatus();
        this.cameras.main.flash(400, 160, 200, 255);
        this.logText.setText('모은 힘이 하나로 모였다! (공격력 상승)');
        // 원군의 입자가 모두 도착한 뒤 강공격을 예고하고 플레이어에게 선택권을 돌려준다.
        this.time.delayedCall(1450, () => this.prepareEnemyCharge(false));
      });
    });
  }

  // 승리: 플래그 기록 → 대화 → 보상(힘의 조각/스킬) → 원래 씬으로
  onWin() {
    if (this.battleResolved) return;
    if (this.cfg.enemy.finale && !this.finalEventDone) {
      this.finalStand();
      return;
    }
    if (this.cfg.enemy.pattern === 'sorrow' && !this.sorrowComforted) return;
    this.battleResolved = true;
    this.turnLocked = true;
    playerState.atk = this.initialAtk;        // 최종전 임시 버프 초기화 후 보상 계산
    this.tweens.killTweensOf(this.enemySprite);
    this.tweens.killTweensOf(this.enemyAura);
    this.tweens.add({
      targets: [this.enemySprite, this.enemyAura], alpha: 0,
      y: this.sorrowComforted ? this.enemySprite.y : 210, duration: this.sorrowComforted ? 1400 : 750,
      onComplete: () => {
        this.enemySprite.destroy();
        if (this.enemyAura) this.enemyAura.destroy();
      }
    });
    this.logText.setText('');

    // 최종보스 격파 시에는 보상 대신 반전 컷신으로 넘어간다
    if (this.cfg.enemy.finale) {
      playerState.setFlag(this.cfg.flag);
      this.time.delayedCall(1000, () =>
        this.scene.start('StoryScene', { script: 'reveal' }));
      return;
    }

    this.dialogue.start(DIALOGUES[this.cfg.postDialogue], () => {
      sound.reward();
      // 전투 후 대화가 끝나는 시점에 처치 플래그·성장 보상·자동 저장을 원자적으로 함께 반영한다
      playerState.setFlag(this.cfg.flag);
      if (this.sorrowComforted) playerState.setFlag('sorrow_embraced');
      const r = this.cfg.reward;
      const rewards = [];
      if (r.fragment) {
        playerState.addPowerFragment();
        rewards.push('힘의 조각을 손에 넣었다! (공격력 +2, 최대 HP +10, 최대 MP +5)');
      }
      if (r.skill) {
        playerState.learnSkill(r.skill);
        rewards.push(`스킬 습득: ${r.skill}`);
      }
      playerState.save();
      this.dialogue.start(
        rewards.map(text => ({ speaker: '', text })),
        () => this.scene.start(this.cfg.returnScene, this.cfg.returnData)
      );
    });
  }

  // 패배: 전투 시작 전 공격력으로 복원한 뒤 전투를 다시 시작한다
  onLose() {
    playerState.atk = this.initialAtk;
    this.dialogue.start([
      { speaker: '나', text: '쓰러졌다... 하지만... 포기하지 않아.' },
      { speaker: '나', text: '다시... 일어선다.' }
    ], () => this.scene.restart({
      ...this.cfg,
      finalEventSeen: this.finalEventDone || this.finalEventSeen
    }));
  }

  // 피해 숫자는 타격 이펙트보다 앞에 표시하며, 탄성 있게 솟구치는 팝업(Pop-in) 연출을 준다.
  floatText(x, y, text, color, size = 18) {
    const t = this.add.text(x, y, text, {
      fontSize: `${size}px`, fontFamily: 'monospace', color,
      stroke: '#080810', strokeThickness: 3
    }).setOrigin(0.5).setDepth(25).setScale(0.45);
    this.tweens.add({
      targets: t, scale: 1.15, duration: 110, yoyo: true, hold: 30,
      onComplete: () => { if (t.active) t.setScale(1); }
    });
    this.tweens.add({
      targets: t, y: y - 34, alpha: 0, duration: 780, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy()
    });
  }
}
