import Phaser from 'phaser';
import Player from '../objects/Player.js';
import Interactable from '../objects/Interactable.js';
import DialogueSystem from '../systems/DialogueSystem.js';
import { DIALOGUES } from '../data/dialogues.js';
import { playerState } from '../systems/PlayerState.js';
import { sound } from '../systems/SoundSystem.js';

// 프롤로그 씬 — 평화로운 마을을 직접 걸어다니다가 '그림자'의 습격으로
// 마을이 폐허가 되는 것을 목격한다 (참고 이미지: picture/마을.jpeg).
// 흐름: 마을 산책 → 광장 도달 → 보스 강림 → 마을 파괴 연출 → 결의 대화 → 0장으로
export default class PrologueScene extends Phaser.Scene {
  constructor() { super('PrologueScene'); }

  init(data) {
    // epilogue: true로 시작하면 습격 이벤트 없이 평화를 되찾은 마을을 보여준다
    this.epilogue = !!(data && data.epilogue);
    this.enteringVillage = false;
    this.checkingFriend = false;
    this.uiBusy = false;
    this.unlockTimer = null;
  }

  create() {
    playerState.chapter = 0;                     // 사이드 패널 숨김 유지
    this.cameras.main.fadeIn(800, 0, 0, 0);
    sound.playBgm(this.epilogue ? 'story' : 'explore');
    this.bgImage = this.add.image(320, 240, 'village-bg');
    this.eventStarted = false;

    // 마을 구조물 충돌체 — village-bg에 그려진 건물/울타리 위치와 일치시킨다
    this.walls = this.physics.add.staticGroup();
    const SOLIDS = [
      [234, 98, 172, 76],    // 초가 큰집 (처마 아래~벽 하단)
      [252, 396, 140, 74],   // 파란 지붕 집 A
      [392, 396, 158, 74],   // 파란 지붕 집 B
      [544, 390, 78, 80],    // 초가 부속 건물
      [550, 284, 30, 70],    // 검은 굴뚝
      [14, 314, 210, 158],   // 울타리 밭
      [526, 92, 18, 28],     // 우상단 나무 줄기
      [54, 150, 16, 22],     // 좌측 나무 줄기
      [232, 204, 8, 12],     // 가로등 1 기둥
      [400, 204, 8, 12],     // 가로등 2 기둥
      [72, 274, 8, 12],      // 가로등 3 기둥
      [556, 162, 8, 12],     // 가로등 4 기둥
      [64, 286, 12, 24]      // 표지판 기둥
    ];
    for (const [rx, ry, rw, rh] of SOLIDS) {
      for (let y = ry + 8; y < ry + rh; y += 16) {
        for (let x = rx + 8; x < rx + rw; x += 16) {
          this.walls.create(x, y, 'wall').refreshBody();
        }
      }
    }
    // 충돌체는 배경이 시각적으로 대신하므로 숨긴다
    this.walls.getChildren().forEach(w => w.setVisible(false));

    this.dialogue = new DialogueSystem(this);
    this.player = new Player(this, 320, 300);
    this.physics.add.collider(this.player.sprite, this.walls);
    this.keyE = this.input.keyboard.addKey('E');
    this.keySpace = this.input.keyboard.addKey('SPACE');
    this.keyEnter = this.input.keyboard.addKey('ENTER');

    if (this.epilogue) {
      this.setupEpilogue();
      return;
    }

    this.setupVillagers();   // 각자 일상을 보내는 마을 사람들

    // 목표 안내 — 튜토리얼과 같은 좌측 상단 체크리스트 스타일
    this.goalText = this.add.text(20, 18, '목표\n[ ] 오른쪽의 소꿉친구 나래에게 인사하기 (E)\n[ ] 마을 광장으로 가 보기', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cfc8ff',
      backgroundColor: '#00000088', padding: { x: 8, y: 6 }, lineSpacing: 5
    }).setDepth(50);
    // 광장 방향을 가리키는 화살표 (초가 큰집 앞 자갈길 광장 중앙)
    const arrow = this.add.text(320, 210, '▲', {
      fontSize: '18px', color: '#ffe9a8'
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: arrow, y: 200, duration: 500, yoyo: true, repeat: -1 });
    this.goalArrow = arrow;
    this.goalArrow.setVisible(false);
    if (playerState.getFlag('village_promise')) this.showSquareGoal();

    // 평화로운 하루 독백 — 입장 직후 1회 재생
    this.uiBusy = true;
    this.player.frozen = true;
    this.time.delayedCall(700, () => this.runDialogue('prologue1'));
  }

  /** 마을 사람들을 배치한다 — 각자 자리에서 하던 일을 하고 있다 */
  setupVillagers() {
    this.villagers = [];
    const addVillager = (vx, vy, key, flip = false) => {
      this.add.ellipse(vx, vy + 22, 28, 10, 0x000000, 0.32).setDepth(8);
      const v = this.add.image(vx, vy, key).setScale(3).setDepth(9).setFlipX(flip);
      return v;
    };

    // 논밭에서 일하는 농부들 — 몸을 숙였다 펴는 일하는 모션
    for (const [vx, vy] of [[80, 370], [140, 420], [185, 345]]) {
      const v = addVillager(vx, vy, 'villager-farm');
      this.tweens.add({ targets: v, y: vy - 2, duration: 550 + Math.random() * 300, yoyo: true, repeat: -1 });
      this.villagers.push(v);
    }

    // 나무를 캐는 사람 — 나무를 향해 몸을 기울여 도끼를 내리치고 다시 돌아오는 벌목 모션
    const w = addVillager(492, 112, 'villager-wood');
    this.tweens.add({
      targets: w, angle: 7, x: 495,
      duration: 300, yoyo: true, repeat: -1, repeatDelay: 650,
      ease: 'Quad.easeOut'
    });
    this.villagers.push(w);

    // 집 앞에 나와서 수다를 떠는 사람들 — 서로 마주 보는 구도
    const c1 = addVillager(292, 190, 'villager-chat');
    this.friend = new Interactable(
      this, 400, 310, 'villager-chat', 'E: 나래와 이야기하기',
      () => this.talkToFriend(), { scale: 3, radius: 58 }
    );
    const c2 = this.friend.sprite.setFlipX(true).setTint(0xffe9a8);
    this.friendName = this.add.text(c2.x, c2.y - 52, '나래', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffe9a8',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(20);
    if (this.epilogue || playerState.getFlag('village_promise')) this.friend.disable();
    if (!this.epilogue) this.physics.add.collider(this.player.sprite, c2);
    this.tweens.add({ targets: c1, y: 188, duration: 700, yoyo: true, repeat: -1 });
    this.villagers.push(c1, c2);
  }

  talkToFriend() {
    if (this.uiBusy || this.eventStarted || this.epilogue || playerState.getFlag('village_promise')) return;
    this.friend.promptText.setVisible(false);
    this.runDialogue('village_promise', () => {
      playerState.setFlag('village_promise');
      this.showSquareGoal();
    });
  }

  showSquareGoal() {
    this.friend.disable();
    this.goalText.setText('목표\n[✓] 나래와 저녁 약속하기\n[ ] 마을 광장으로 가 보기');
    this.goalArrow.setVisible(true);
  }

  update() {
    // 탐험과 같은 확인 키를 쓰며, 연출 중 누른 입력은 다음 대화로 넘기지 않는다.
    const interactPressed = [this.keyE, this.keySpace, this.keyEnter]
      .filter(Boolean).map(key => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    if (this.friend) {
      this.friend.shadow.setPosition(this.friend.sprite.x, this.friend.sprite.y + 22);
      this.friendName.setPosition(this.friend.sprite.x, this.friend.sprite.y - 52);
    }
    if (!this.enteringVillage) this.player.update();
    if (this.epilogue || this.eventStarted || this.uiBusy) {
      this.friend?.promptText.setVisible(false);
      return;
    }
    if (this.friend.checkProximity(this.player) && interactPressed) {
      this.friend.action();
      return;
    }
    // 광장 남쪽 입구(y < 268)에 도달하면 습격 이벤트가 시작된다 (초가집과 겹치지 않는 자갈길 광장)
    const p = this.player.sprite;
    if (playerState.getFlag('village_promise') && p.y < 268 && p.x > 230 && p.x < 410) this.bossArrives();
  }

  // 광장 바닥(x, y)에 입체적인 차원 포털(바닥 그림자 + 다중 타원 소용돌이 + 수직 빛기둥)을 생성한다
  createPortal(x, y, { coreColor = 0x090514, rimColor = 0x9a4aff, innerColor = 0xd8b0ff, pillarColor = 0x7a38cc } = {}) {
    const container = this.add.container(x, y).setDepth(19);
    // 1) 돌바닥에 드리워지는 넓은 타원형 어둠/빛 그림자 (바닥 밀착감)
    const groundShadow = this.add.ellipse(0, 6, 118, 42, 0x000000, 0.55);
    // 2) 포털 위로 솟구치는 반투명 에너지 기둥 (수직 입체감)
    const pillar = this.add.rectangle(0, -34, 72, 76, pillarColor, 0.18);
    // 3) 바깥 테두리 발광 링 (원근감을 위해 납작한 타원 비율 적용)
    const outerRing = this.add.ellipse(0, 0, 96, 34, coreColor, 0.92)
      .setStrokeStyle(3, rimColor, 0.95);
    // 4) 안쪽 회전 소용돌이 링
    const innerRing = this.add.ellipse(0, 0, 62, 22, coreColor, 0.95)
      .setStrokeStyle(2, innerColor, 0.85);
    // 5) 중심 심연 코어
    const core = this.add.ellipse(0, 0, 30, 10, innerColor, 0.55);

    container.add([groundShadow, pillar, outerRing, innerRing, core]);
    container.setScale(0.05);

    // 포털이 바닥에서 스르륵 펼쳐지며 맥동하는 애니메이션
    this.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.easeOut'
    });
    this.tweens.add({
      targets: [outerRing, innerRing],
      scaleX: 1.08,
      scaleY: 0.92,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: pillar,
      alpha: 0.06,
      scaleX: 0.85,
      duration: 520,
      yoyo: true,
      repeat: -1
    });

    return container;
  }

  // 에필로그 구성 — 광장 한가운데 열린 귀환 포털에서 주인공이 걸어 나오고, 주민들이 달려와 반겨준다
  setupEpilogue() {
    this.setupVillagers();   // 프롤로그와 같은 평화로운 일상 (농사·벌목·수다)

    this.enteringVillage = true;
    this.player.frozen = true;
    const p = this.player.sprite;
    const sh = this.player.shadow;

    // 포털 위치: 초가 큰집(y <= 174) 앞의 탁 트인 자갈길 광장 한가운데 (320, 212)
    const portalX = 320, portalY = 212;
    p.setPosition(portalX, portalY - 12).setScale(0.4).setAlpha(0);
    p.setTexture('hero-down-0');
    if (sh) sh.setPosition(portalX, portalY + 10).setScale(0.3).setAlpha(0);

    // 따뜻한 빛의 귀환 포털이 광장 돌바닥 위에 열린다
    const returnPortal = this.createPortal(portalX, portalY, {
      coreColor: 0x182638,
      rimColor: 0x7fffd8,
      innerColor: 0xffe9a8,
      pillarColor: 0x7fffd8
    });

    // 포털 속에서 주인공이 솟아오르듯 착지한 뒤, 광장 앞쪽으로 자연스럽게 걸어 나온다 (집과 전혀 겹치지 않음)
    this.time.delayedCall(650, () => {
      sound.reward();
      this.cameras.main.flash(280, 200, 255, 240);
      this.tweens.add({
        targets: p,
        y: portalY,
        scale: 3,
        alpha: 1,
        duration: 550,
        ease: 'Back.easeOut'
      });
      if (sh) {
        this.tweens.add({
          targets: sh,
          y: portalY + 22,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: 550
        });
      }

      // 착지 후 포털이 닫히고 주인공이 광장 남쪽(y: 268)으로 몇 걸음 걸어 나온다
      this.time.delayedCall(650, () => {
        this.tweens.add({
          targets: returnPortal,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          duration: 450,
          onComplete: () => returnPortal.destroy()
        });
        p.anims.play('hero-walk-down', true);
        this.tweens.add({
          targets: p,
          y: 268,
          duration: 1100,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            if (sh) sh.setPosition(p.x, p.y + 22);
          },
          onComplete: () => {
            p.anims.stop();
            p.setTexture('hero-down-0');
            this.enteringVillage = false;
            this.villagersRunToHero();
          }
        });
      });
    });
  }

  // 하던 일을 멈춘 주민들이 주인공에게 달려와 모여드는 연출
  villagersRunToHero() {
    const SPOTS = [[268, 268], [372, 268], [250, 312], [390, 312], [300, 240], [345, 240]];
    this.villagers.forEach((v, i) => {
      this.tweens.killTweensOf(v);
      v.setAngle(0);
      const [tx, ty] = SPOTS[i % SPOTS.length];
      const dist = Phaser.Math.Distance.Between(v.x, v.y, tx, ty);
      this.tweens.add({
        targets: v, x: tx, y: ty,
        duration: 350 + dist * 2.4, ease: 'Cubic.easeOut'
      });
      // 달려오는 통통 튀는 모션
      this.tweens.add({
        targets: v, scaleY: 2.5, duration: 140, yoyo: true,
        repeat: Math.max(2, Math.floor(dist / 60))
      });
    });

    // 주민들이 모여든 뒤 대화 → 대화가 끝나면 짧은 여운 후 자동으로 페이드아웃되어 엔딩 독백/크레딧으로 넘어간다
    const dialogueKey = playerState.getFlag('village_promise') ? 'epilogue_promise' : 'epilogue_village';
    this.time.delayedCall(1900, () => this.runDialogue(dialogueKey, () => {
      this.time.delayedCall(600, () => {
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('StoryScene', { script: 'ending' }));
      });
    }));
  }

  // 대화 재생 — 이벤트 진행 중에는 대화가 끝나도 조작이 풀리지 않는다
  runDialogue(keyOrLines, onDone) {
    const lines = Array.isArray(keyOrLines) ? keyOrLines : DIALOGUES[keyOrLines];
    if (this.unlockTimer) {
      this.unlockTimer.remove();
      this.unlockTimer = null;
    }
    this.uiBusy = true;
    this.player.frozen = true;
    this.dialogue.start(lines, () => {
      if (!this.eventStarted && !this.epilogue) {
        this.unlockTimer = this.time.delayedCall(60, () => {
          this.unlockTimer = null;
          this.uiBusy = false;
          this.player.frozen = false;
        });
      }
      if (onDone) onDone();
    });
  }

  // 보스 강림 — 하늘이 어두워지고 '그림자'가 초가집 앞 광장 중앙으로 내려온다
  bossArrives() {
    if (this.eventStarted || this.uiBusy) return;
    this.eventStarted = true;
    this.friend.disable();
    this.friendName.setVisible(false);
    const p = this.player.sprite;
    this.player.frozen = true;
    p.setVelocity(0, 0);
    p.anims.stop();
    p.setTexture('hero-up-0');                   // 광장 중앙에 내려앉는 존재를 올려다본다
    if (this.goalText) this.goalText.setVisible(false);
    if (this.goalArrow) this.goalArrow.destroy();

    // 마을 위로 짙은 그늘이 드리운다 (대화창 depth 1000 아래)
    this.veil = this.add.rectangle(320, 240, 640, 480, 0x0a0a1e, 0).setDepth(20);
    this.tweens.add({ targets: this.veil, alpha: 0.5, duration: 1600 });

    // 보스의 광장 바닥 그림자 — 하늘에서 내려올수록 점점 커지며 입체감을 준다
    this.bossShadow = this.add.ellipse(320, 224, 68, 22, 0x000000, 0.45)
      .setDepth(20).setScale(0.2);
    this.tweens.add({
      targets: this.bossShadow, scaleX: 1, scaleY: 1, duration: 1800, ease: 'Cubic.easeOut'
    });

    // 보스가 집 지붕 위가 아닌 초가집 앞 광장 한가운데(320, 192)로 강림한다
    this.boss = this.add.image(320, -50, 'boss').setScale(5.5).setDepth(21);
    this.cameras.main.shake(900, 0.004);
    this.tweens.add({
      targets: this.boss, y: 192, duration: 1800, ease: 'Cubic.easeOut',
      onComplete: () => this.runDialogue('prologue_boss', () => this.destroyVillage())
    });
  }

  // 마을 파괴 연출 — 배경 자체가 검게 불타는 아포칼립스 폐허로 변하고, 집·나무·논밭 전체가 지속해서 타오른다
  destroyVillage() {
    sound.hit('burst');
    this.cameras.main.shake(1800, 0.015);

    // 폐허가 된 마을 배경을 페이드인하여 잔디·집·논밭·나무가 전부 검게 타버린 아포칼립스 풍경으로 전환한다
    const ruinedBg = this.add.image(320, 240, 'village-ruined-bg').setDepth(1).setAlpha(0);
    this.tweens.add({ targets: ruinedBg, alpha: 1, duration: 900 });

    // 하늘을 뒤덮는 검붉은 묵시록 암운 오버레이
    if (this.veil) {
      this.veil.setFillStyle(0x18060a, 0.5);
      this.tweens.add({ targets: this.veil, alpha: 0.62, duration: 1200 });
    }

    // 일하던 마을 사람들이 쓰러진다 — 옆으로 누우며 색이 바랜다
    for (const v of this.villagers || []) {
      this.tweens.killTweensOf(v);
      this.tweens.add({ targets: v, angle: 90, duration: 300 });
      v.setTint(0x4a383c);
      const shroud = this.add.ellipse(v.x, v.y + 8, 72, 32, 0x110e20, 0.7)
        .setStrokeStyle(2, 0x70528f, 0.65).setDepth(19);
      this.tweens.add({
        targets: shroud, alpha: 0.4, scaleX: 1.1,
        duration: 1100, yoyo: true, repeat: -1
      });
    }

    // 집(초가 큰집, 파란 지붕 집 A/B, 부속 건물), 나무(우상단, 좌측), 논밭(좌하단) 위치에 지속해서 타오르는 화염 거점 배치
    const fireSpots = [
      // 초가 큰집 지붕과 처마
      [290, 96, 1.3], [350, 88, 1.2], [320, 62, 1.4],
      // 우상단 큰 나무와 좌측 나무
      [535, 72, 1.35], [518, 92, 1.0], [62, 140, 1.15],
      // 좌하단 논밭 곳곳
      [65, 360, 1.0], [125, 395, 1.15], [175, 355, 0.95], [95, 435, 1.1],
      // 하단 집들 (파란 지붕 집 A/B, 우하단 초가)
      [295, 378, 1.2], [355, 392, 1.0], [450, 376, 1.25], [515, 390, 1.1], [583, 378, 1.15]
    ];

    for (const [fx, fy, s] of fireSpots) {
      // 화염 바닥 열기 후광
      const glow = this.add.ellipse(fx, fy + 6, 36 * s, 18 * s, 0xff3311, 0.32).setDepth(18);
      // 바깥 불길 + 안쪽 주황 불길 + 중심 백열 불꽃
      const outerFlame = this.add.ellipse(fx, fy, 16 * s, 26 * s, 0xff4411, 0.85).setDepth(18);
      const midFlame = this.add.ellipse(fx, fy + 2, 10 * s, 18 * s, 0xff9922, 0.9).setDepth(18);
      const coreFlame = this.add.ellipse(fx, fy + 5, 5 * s, 10 * s, 0xfff0aa, 0.95).setDepth(18);

      this.tweens.add({
        targets: [outerFlame, midFlame],
        scaleX: { from: 0.85, to: 1.18 },
        scaleY: { from: 0.9, to: 1.28 },
        y: fy - 4 * s,
        duration: 180 + Math.floor(Math.random() * 140),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.tweens.add({
        targets: [coreFlame, glow],
        alpha: { from: 0.55, to: 1 },
        scaleY: { from: 0.8, to: 1.15 },
        duration: 140 + Math.floor(Math.random() * 120),
        yoyo: true,
        repeat: -1
      });
    }

    // 씬이 끝날 때까지 마을 전역(집·논밭·나무)에서 끊임없이 솟구치는 불티와 검은 연기 이펙트
    this.apocalypseTimer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        const [bx, by] = Phaser.Math.RND.pick(fireSpots);
        const ember = this.add.circle(
          bx + Phaser.Math.Between(-24, 24),
          by + Phaser.Math.Between(-10, 12),
          Phaser.Math.Between(2, 4),
          Phaser.Math.RND.pick([0xff4411, 0xff8822, 0xffdd55])
        ).setDepth(23);
        this.tweens.add({
          targets: ember,
          x: ember.x + Phaser.Math.Between(-18, 18),
          y: ember.y - Phaser.Math.Between(55, 130),
          alpha: 0,
          duration: Phaser.Math.Between(550, 1000),
          onComplete: () => ember.destroy()
        });

        const smoke = this.add.circle(
          bx + Phaser.Math.Between(-20, 20),
          by - 8,
          Phaser.Math.Between(5, 9),
          0x1a1216, 0.48
        ).setDepth(22);
        this.tweens.add({
          targets: smoke,
          x: smoke.x + Phaser.Math.Between(-14, 14),
          y: smoke.y - Phaser.Math.Between(70, 140),
          scale: 2.3,
          alpha: 0,
          duration: Phaser.Math.Between(1100, 1700),
          onComplete: () => smoke.destroy()
        });
      }
    });
    this.events.once('shutdown', () => {
      if (this.apocalypseTimer) this.apocalypseTimer.remove();
    });

    // 강렬한 진홍빛 섬광 뒤 보스가 더 크게 부각되며 대화를 남기고 어둠 너머로 떠난다
    this.cameras.main.flash(350, 255, 70, 20);
    this.time.delayedCall(900, () => this.cameras.main.flash(300, 255, 40, 30));
    this.time.delayedCall(1500, () => {
      this.cameras.main.flash(400, 255, 50, 50);
      this.tweens.add({ targets: this.boss, scale: 6.2, duration: 600 });
      this.time.delayedCall(900, () => this.checkOnFriend());
    });
  }

  checkOnFriend() {
    if (this.checkingFriend) return;
    this.checkingFriend = true;
    this.uiBusy = true;
    this.player.frozen = true;
    this.enteringVillage = true;
    const p = this.player.sprite;
    p.setVelocity(0, 0).setDepth(22);
    p.anims.play('hero-walk-right', true);
    this.tweens.add({
      targets: p, x: this.friend.sprite.x - 42, y: this.friend.sprite.y,
      duration: 800, ease: 'Sine.easeInOut',
      onUpdate: () => this.player.shadow?.setPosition(p.x, p.y + 22),
      onComplete: () => {
        this.enteringVillage = false;
        p.anims.stop();
        p.setTexture('hero-right-0');
        this.tweens.add({
          targets: this.friend.sprite, x: '+=2',
          duration: 100, yoyo: true, repeat: 2
        });
        this.runDialogue('village_aftermath', () =>
          this.runDialogue('prologue2_boss', () => this.bossLeaves()));
      }
    });
  }

  // 보스가 초가집 앞 광장 바닥(320, 212)에 입체적인 어둠의 포털을 열고 그 안으로 가라앉듯 사라지는 연출
  bossLeaves() {
    const portalX = 320, portalY = 212;
    this.portal = this.createPortal(portalX, portalY);
    const threads = this.add.graphics().setDepth(21);
    threads.lineStyle(2, 0x70528f, 0.45);
    for (const v of this.villagers) {
      threads.lineBetween(v.x, v.y + 8, portalX, portalY);
    }
    let sourceIndex = 0;
    this.time.addEvent({
      delay: 350, loop: true,
      callback: () => {
        const v = this.villagers[sourceIndex++ % this.villagers.length];
        const mote = this.add.circle(v.x, v.y + 8, 3, 0x9a72bb, 0.6).setDepth(21);
        this.tweens.add({
          targets: mote, x: portalX, y: portalY, alpha: 0,
          duration: 1000, onComplete: () => mote.destroy()
        });
      }
    });

    // 보스가 광장 바닥의 포털 중심부로 빨려 들어가며 잔상을 남기고 사라진다
    this.time.delayedCall(500, () => {
      sound.timeStop();
      for (let i = 0; i < 12; i++) {
        const darkOrb = this.add.circle(
          this.boss.x + Phaser.Math.Between(-26, 26),
          this.boss.y + Phaser.Math.Between(-24, 24),
          Phaser.Math.Between(3, 6),
          0x9a4aff, 0.75
        ).setDepth(22);
        this.tweens.add({
          targets: darkOrb,
          x: portalX, y: portalY, alpha: 0,
          duration: 480 + i * 30,
          onComplete: () => darkOrb.destroy()
        });
      }
      if (this.bossShadow) {
        this.tweens.add({
          targets: this.bossShadow, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 700,
          onComplete: () => this.bossShadow.destroy()
        });
      }
      this.tweens.add({
        targets: this.boss,
        x: portalX,
        y: portalY - 6,
        scale: 0.4,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.boss.destroy();
          // 보스가 떠난 뒤 주인공이 결의를 다지고 광장 포털로 달려간다
          this.runDialogue('prologue2_chase', () => this.leaveVillage());
        }
      });
    });
  }

  // 주인공이 집을 침범하지 않고 자갈길 광장 중앙의 포털(320, 212)까지 달려가 뛰어드는 입체 연출
  leaveVillage() {
    const portalX = 320, portalY = 212;
    const p = this.player.sprite;
    const sh = this.player.shadow;
    p.setDepth(22);
    p.anims.play('hero-walk-up', true);

    // 1단계: 현재 위치에서 광장 포털 앞(320, 222)까지 돌바닥 위를 달려간다
    this.tweens.add({
      targets: p,
      x: portalX,
      y: portalY + 10,
      duration: 750,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        if (sh) sh.setPosition(p.x, p.y + 22);
      },
      onComplete: () => {
        p.anims.stop();
        // 2단계: 포털 위로 도약(위로 살짝 솟았다가 포털 중심 속으로 작아지며 빨려 들어감)하여 입체감을 준다
        if (sh) {
          this.tweens.add({
            targets: sh, x: portalX, y: portalY + 4, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 480
          });
        }
        this.tweens.add({
          targets: p,
          y: portalY - 18,
          scaleX: 3.3,
          scaleY: 3.3,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.cameras.main.flash(260, 180, 140, 255);
            this.tweens.add({
              targets: p,
              y: portalY,
              scaleX: 0.3,
              scaleY: 0.3,
              alpha: 0,
              duration: 320,
              ease: 'Cubic.easeIn',
              onComplete: () => {
                if (this.portal) {
                  this.tweens.add({
                    targets: this.portal, scaleX: 0, scaleY: 0, alpha: 0, duration: 380
                  });
                }
                this.cameras.main.fadeOut(650, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () =>
                  this.scene.start('ExploreScene', { chapter: 0 }));
              }
            });
          }
        });
      }
    });
  }
}
