import Phaser from 'phaser';
import Player from '../objects/Player.js';
import Interactable from '../objects/Interactable.js';
import DialogueSystem from '../systems/DialogueSystem.js';
import { DIALOGUES } from '../data/dialogues.js';
import { CHAPTERS } from '../data/chapters.js';
import { playerState } from '../systems/PlayerState.js';
import { sound } from '../systems/SoundSystem.js';

// 탐험 씬 — 챕터 설정에 따라 방을 구성하고, 이동/상호작용/챕터 전환을 처리한다.
export default class ExploreScene extends Phaser.Scene {
  constructor() { super('ExploreScene'); }

  init(data) {
    this.chapter = data.chapter ?? 1;
    playerState.chapter = this.chapter;      // 사이드 패널 표시 기준 (1장부터 표시)
    playerState.save();                      // 챕터 진입 시 체크포인트 자동 저장
    this.interactables = [];
    this.uiBusy = false;
    this.doorCooldown = false;
    this.timeStopBusy = false;               // 3장 시간 정지 이벤트 진행 여부
    this.lastDoorOpen = null;                // 문 텍스처 중복 갱신 방지용 캐시
    this.unlockTimer = null;                 // 대화 종료 후 조작 잠금 해제 타이머
  }

  create() {
    this.conf = CHAPTERS[this.chapter];
    this.cameras.main.fadeIn(600, 0, 0, 0);
    sound.playBgm('explore');
    // 시계가 있는 방에서는 초침 소리를 재생하되, 3장('멈춘 시간의 방')은 해금 전까지 정적만 흐른다
    const hasClock = (this.conf?.objects || []).some(o => o.kind === 'clock');
    if (hasClock) {
      const stopped = this.chapter === 3 && !playerState.getFlag('ch3_unlocked');
      sound.startClockTick(stopped);
    } else {
      sound.stopClockTick();
    }
    this.events.once('shutdown', () => sound.stopClockTick());

    this.buildRoom();

    this.dialogue = new DialogueSystem(this);
    this.player = new Player(this, 320, 400);
    this.physics.add.collider(this.player.sprite, this.walls);

    this.keyE = this.input.keyboard.addKey('E');
    this.keySpace = this.input.keyboard.addKey('SPACE');
    this.keyEnter = this.input.keyboard.addKey('ENTER');

    if (this.chapter === 0) this.setupTutorial();
    else this.setupChapter();

    // 배치된 오브젝트들과 플레이어가 충돌하도록 한다 (Interactable에 정적 바디 존재)
    for (const it of this.interactables) {
      this.physics.add.collider(this.player.sprite, it.sprite);
    }

    // 챕터 타이틀 표시
    const title = this.add.text(320, 60, this.conf ? this.conf.title : '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#cfc8ff',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: title, alpha: 1, duration: 800, yoyo: true, hold: 1600
    });
  }

  update() {
    this.player.update();
    // 대화 중 입력도 소비하여 대화를 닫은 키가 다음 조사를 다시 열지 않도록 한다.
    const interactPressed = [this.keyE, this.keySpace, this.keyEnter]
      .filter(Boolean).map(key => Phaser.Input.Keyboard.JustDown(key)).some(Boolean);
    // 튜토리얼: 첫 이동을 감지해 목표에 체크한다
    if (this.chapter === 0 && this.goalText && this.tutGoals && !this.tutGoals.move &&
        (this.player.sprite.body.velocity.x !== 0 ||
         this.player.sprite.body.velocity.y !== 0)) {
      this.tutGoals.move = true;
      this.refreshGoals();
    }
    if (this.uiBusy) return;

    // 가까운 상호작용 오브젝트 안내 표시
    let nearObj = null;
    for (const it of this.interactables) {
      if (it.checkProximity(this.player)) nearObj = it;
    }
    if (nearObj && interactPressed) {
      this.uiBusy = true;
      this.player.frozen = true;
      nearObj.action();
      return;
    }

    // 문 열림 표시 — 진행 조건이 충족되거나 반복(loops) 챕터이면 열린 문으로 표시한다 (상태 변경 시에만 텍스처 교체)
    const doorOpen = this.chapter === 0
      ? !!(this.tutGoals && this.tutGoals.move && this.tutGoals.sign)
      : (this.conf.loops || this.isCleared());
    if (doorOpen !== this.lastDoorOpen) {
      this.lastDoorOpen = doorOpen;
      this.doorSprite.setTexture(doorOpen ? 'door-open' : 'door');
      this.doorGlow.setAlpha(doorOpen ? 0.28 : 0);
    }

    // 문 판정: 뒷벽 아래 문 앞 공간(배리어 틈)으로 들어가면 챕터 전환
    const doorX = this.conf.doorX || 320;
    // 위쪽 이동 중 문 틈 모서리(±24~38px)에 살짝 걸렸을 때 문 중심 쪽으로 부드럽게 미끄러지듯 유도한다
    const dxDoor = doorX - this.player.sprite.x;
    if (!this.doorCooldown && this.player.sprite.y < 130 &&
        this.player.cursors && (this.player.cursors.up.isDown || this.player.wasd?.up.isDown) &&
        Math.abs(dxDoor) >= 18 && Math.abs(dxDoor) <= 38) {
      this.player.sprite.x += Math.sign(dxDoor) * 1.8;
    }
    if (!this.doorCooldown && this.player.sprite.y < 116 &&
        Math.abs(this.player.sprite.x - doorX) < 24) {
      this.doorCooldown = true;
      this.onDoor();
    }
  }

  // 방 생성: 챕터 배경 + 테두리 벽 충돌체 (챕터별 문 위치에 틈)
  buildRoom() {
    this.add.image(320, 240, this.conf.bg || 'bg-ch1');
    this.walls = this.physics.add.staticGroup();
    const doorX = this.conf.doorX || 320;

    for (let x = 8; x < 640; x += 16) {
      // 위쪽 벽 — 문 위치(doorX ±24)는 비워둔다
      if (x < doorX - 24 || x > doorX + 24) this.walls.create(x, 8, 'wall').setScale(1).refreshBody();
      this.walls.create(x, 472, 'wall').refreshBody();
    }
    for (let y = 24; y < 464; y += 16) {
      this.walls.create(8, y, 'wall').refreshBody();
      this.walls.create(632, y, 'wall').refreshBody();
    }
    // 뒷벽 하단 배리어 — 벽면(창문/액자) 위로 걸을 수 없도록 바닥 경계를 막는다.
    // 문 위치만 비워두어 그 틈이 출입구가 된다
    for (let x = 8; x < 640; x += 16) {
      if (x < doorX - 24 || x > doorX + 24) {
        this.walls.create(x, 118, 'wall').refreshBody();
      }
    }
    // 벽 충돌체는 배경 테두리가 시각적으로 대신하므로 숨긴다
    this.walls.getChildren().forEach(w => w.setVisible(false));
    // 문 — 뒷벽 하단의 출입구 위치에 배치. 클리어 시 'door-open'으로 바뀐다
    this.doorSprite = this.add.image(doorX, 80, 'door').setScale(2);
    this.doorGlow = this.add.ellipse(doorX, 132, 90, 40, 0xffe9a8, 0);
  }

  // 대화를 띄우는 동안 플레이어 조작을 잠근다.
  // opts.keepFrozen이 true이면 대화 종료 후에도 후속 연출을 위해 잠금을 유지한다.
  runDialogue(keyOrLines, onDone, opts = {}) {
    const lines = Array.isArray(keyOrLines) ? keyOrLines : DIALOGUES[keyOrLines];
    if (this.unlockTimer) {
      this.unlockTimer.remove();
      this.unlockTimer = null;
    }
    this.uiBusy = true;
    this.player.frozen = true;
    this.dialogue.start(lines, () => {
      if (!opts.keepFrozen) {
        // 대화를 닫은 키 입력이 곧바로 상호작용 재실행으로 이어지지 않도록 최소한의 프레임 간격만 둔다
        this.unlockTimer = this.time.delayedCall(60, () => {
          this.unlockTimer = null;
          this.uiBusy = false;
          this.player.frozen = false;
        });
      }
      if (onDone) onDone();
    });
  }

  // ── 튜토리얼: 방향키 이동·E키 조사 안내 ──
  setupTutorial() {
    if (!playerState.getFlag('tut_intro_done')) {
      this.time.delayedCall(700, () =>
        this.runDialogue('tutorial_intro', () => playerState.setFlag('tut_intro_done')));
    }

    // 목표 체크리스트 — 조작을 하나씩 익히게 한다 (좌측 상단에 고정해 안내판과 겹치지 않게)
    this.tutGoals = { move: false, sign: false };
    this.createGoalBox();

    // 문을 가리키는 화살표 — 문 아래쪽에서 위로 솟았다 내려온다
    const arrow = this.add.text(this.conf.doorX || 320, 150, '▲', {
      fontSize: '18px', color: '#ffe9a8'
    }).setOrigin(0.5);
    this.tweens.add({ targets: arrow, y: 140, duration: 500, yoyo: true, repeat: -1 });

    // 조작 방법이 적힌 안내판
    this.interactables.push(new Interactable(
      this, 150, 140, 'sign', 'E: 읽어보기',
      () => this.runDialogue('tutorial_sign', () => {
        this.tutGoals.sign = true;
        this.refreshGoals();
      }),
      { scale: 3 }
    ));
  }

  // 좌측 상단 목표창 생성 및 초기 갱신
  createGoalBox() {
    this.goalText = this.add.text(20, 18, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cfc8ff',
      backgroundColor: '#00000088', padding: { x: 8, y: 6 }, lineSpacing: 5
    }).setDepth(50);
    this.refreshGoals();
  }

  // 챕터별 목표 체크리스트 갱신 (0장 튜토리얼 및 1~9장 공통)
  refreshGoals() {
    if (!this.goalText) return;
    const mark = done => (done ? '[✓]' : '[ ]');
    if (this.chapter === 0) {
      this.goalText.setText(
        '목표\n' +
        `${mark(this.tutGoals?.move)} 방향키로 이동해 보기\n` +
        `${mark(this.tutGoals?.sign)} 안내판 읽기 (E)\n` +
        '[ ] 위쪽 문으로 나가기'
      );
      return;
    }

    const lines = ['목표'];
    if (this.chapter === 3) {
      // 3장은 플레이어가 직접 시계를 둘러보며 찾아야 하므로 간접적으로 안내한다
      lines.push(`${mark(playerState.getFlag('ch3_unlocked'))} 주위를 둘러보자`);
      lines.push('[ ] 위쪽 문으로 나가기');
      this.goalText.setText(lines.join('\n'));
      return;
    }

    const objects = this.conf?.objects || [];
    const mirrors = objects.filter(o => o.kind === 'mirror');
    if (mirrors.length > 0) {
      const doneCount = mirrors.filter(o => playerState.getFlag(o.flag)).length;
      const allDone = doneCount === mirrors.length;
      lines.push(`${mark(allDone)} 거울 들여다보기 (${doneCount}/${mirrors.length}) (E)`);
    }

    for (const o of objects) {
      if (o.kind === 'enemy') {
        lines.push(`${mark(playerState.getFlag(o.flag))} ${o.name} 마주하기 (E)`);
      } else if (o.kind === 'npc') {
        lines.push(`${mark(playerState.getFlag(o.flag))} ${o.name}에게 말 걸기 (E)`);
      }
    }

    if (!objects.some(o => o.finale)) {
      lines.push('[ ] 위쪽 문으로 나가기');
    }

    this.goalText.setText(lines.join('\n'));
  }

  // ── 일반 챕터 구성: 챕터 데이터의 objects를 순회하며 배치한다 ──
  setupChapter() {
    const c = this.conf;
    const introFlag = `ch${this.chapter}_intro_done`;

    this.createGoalBox();

    // 인트로 독백 — 반복 챕터는 두 번째 입장부터 loopDialogue로 바뀐다
    if (c.loops && playerState.loopCount > 0) {
      const lines = DIALOGUES[c.loopDialogue];
      const line = lines[Math.min(playerState.loopCount - 1, lines.length - 1)];
      this.time.delayedCall(700, () => this.runDialogue([line]));
    } else if (c.introDialogue && !playerState.getFlag(introFlag)) {
      this.time.delayedCall(700, () =>
        this.runDialogue(c.introDialogue, () => playerState.setFlag(introFlag)));
    }

    for (const o of c.objects || []) {
      // 이미 쓰러뜨린 적은 방에서 사라진다
      if (o.kind === 'enemy' && playerState.getFlag(o.flag)) continue;
      this.spawnObject(o);
    }
  }

  // 챕터별로 옛날 시계에서 현대 시계로 변화하는 방 시계 사양을 반환한다
  // (1장: 해시계 → 2장: 물시계 → 3장: 모래시계 → 4장: 촛대시계 → 5장: 회중시계 → 6장: 괘종시계 → 7장: 아날로그시계 → 8장: 플립시계 → 9장: 디지털시계)
  getRoomClockSpec(ch = this.chapter) {
    const specs = {
      1: {
        key: 'sundial', name: '해시계',
        tex: 'room-clock-1', anim: 'room-clock-1-tick',
        dialogue: [{ speaker: '나', text: '오래된 해시계야. 창문으로 들어온 빛을 받아 영침의 그림자가 천천히 움직이고 있어.' }]
      },
      2: {
        key: 'water', name: '물시계',
        tex: 'room-clock-2', anim: 'room-clock-2-tick',
        dialogue: [{ speaker: '나', text: '물시계네. 위쪽 그릇에서 물방울이 일정한 간격으로 똑, 똑 떨어지고 있어.' }]
      },
      3: {
        key: 'sand', name: '모래시계',
        tex: 'room-clock-3', stoppedTex: 'room-clock-3-stopped', anim: 'room-clock-3-tick',
        dialogue: DIALOGUES.clock_normal
      },
      4: {
        key: 'candle', name: '촛대시계',
        tex: 'room-clock-4', anim: 'room-clock-4-tick',
        dialogue: [{ speaker: '나', text: '눈금이 새겨진 촛대시계야. 불꽃이 잔잔하게 타오르며 시간이 흐르고 있어.' }]
      },
      5: {
        key: 'pocket', name: '회중시계',
        tex: 'room-clock-5', anim: 'room-clock-5-tick',
        dialogue: [{ speaker: '나', text: '거치대에 걸린 황금 회중시계네. 째깍거리는 태엽 소리가 또렷하게 들려.' }]
      },
      6: {
        key: 'grandfather', name: '괘종시계',
        tex: 'clock', anim: 'clock-tick',
        dialogue: DIALOGUES.clock_normal
      },
      7: {
        key: 'analog', name: '아날로그시계',
        tex: 'room-clock-7', anim: 'room-clock-7-tick',
        dialogue: [{ speaker: '나', text: '깔끔한 아날로그 시계야. 붉은 초침이 쉼 없이 원을 그리며 돌아가고 있어.' }]
      },
      8: {
        key: 'flip', name: '플립시계',
        tex: 'room-clock-8', anim: 'room-clock-8-tick',
        dialogue: [{ speaker: '나', text: '숫자판이 넘어가는 플립시계네. 내가 살던 시간과 점점 가까워지고 있어.' }]
      },
      9: {
        key: 'digital', name: '디지털시계',
        tex: 'room-clock-9', anim: 'room-clock-9-tick',
        dialogue: [{ speaker: '나', text: '푸른 빛의 디지털시계야. 지금 이 순간의 시간이 선명한 숫자로 깜빡이고 있어.' }]
      }
    };
    return specs[ch] || specs[6];
  }

  // 챕터 오브젝트 배치 — 종류에 따라 상호작용 내용과 시각 연출이 다르다
  spawnObject(o) {
    if (o.kind === 'enemy') {
      const enemyObj = new Interactable(
        this, o.x, o.y, o.key, 'E: 마주하기',
        () => this.runDialogue(o.preDialogue, () => this.scene.start('BattleScene', {
          chapter: this.chapter,
          enemy: o,
          flag: o.flag,
          postDialogue: o.postDialogue,
          reward: o.reward,
          returnScene: 'ExploreScene',
          returnData: { chapter: this.chapter }
        }), { keepFrozen: true }),
        { scale: o.scale || 3, radius: o.radius || 44 }
      );
      // 적 그림자 생동감 연출 — 정적 충돌 바디와 어긋나지 않도록 위치(y)는 고정하고 스케일로 호흡감을 준다
      const baseEnemyScale = o.scale || 3;
      this.tweens.add({
        targets: enemyObj.sprite,
        scaleY: baseEnemyScale * 1.04,
        duration: 1100 + Math.random() * 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.time.addEvent({
        delay: 480,
        loop: true,
        callback: () => {
          if (!enemyObj.sprite.scene) return;
          const wisp = this.add.circle(
            o.x + Phaser.Math.Between(-16, 16),
            o.y + Phaser.Math.Between(-6, 14),
            Phaser.Math.Between(2, 4),
            o.key === 'boss' ? 0xff3344 : 0x6a6090,
            0.4
          ).setDepth(7);
          this.tweens.add({
            targets: wisp,
            y: wisp.y - Phaser.Math.Between(18, 32),
            alpha: 0,
            duration: 900,
            onComplete: () => wisp.destroy()
          });
        }
      });
      this.interactables.push(enemyObj);
    } else if (o.kind === 'clock') {
      // 다음 장으로 넘어갈 때마다 옛날 시계에서 현대 시계로 바뀌며, 3장의 시계만 해금 전까지 멈춰 있다
      const spec = this.getRoomClockSpec(this.chapter);
      const isStopped = this.chapter === 3 && !playerState.getFlag('ch3_unlocked');
      const texKey = isStopped ? (spec.stoppedTex || 'clock-stopped') : spec.tex;
      const clock = new Interactable(
        this, o.x, o.y, texKey, `E: ${spec.name}`,
        () => {
          if (this.chapter === 3) {
            // 해금 이후(또는 이벤트 진행 중)에는 반응하지 않는다 — E키 연타 시 대화 중복 방지
            if (playerState.getFlag('ch3_unlocked') || this.timeStopBusy) {
              this.uiBusy = false;
              this.player.frozen = false;
              return;
            }
            // 한 번 이상 맴돈 뒤 조사하면 시간 정지 이벤트
            return playerState.loopCount >= 1
              ? this.timeStop()
              : this.runDialogue('clock_early');
          }
          this.runDialogue(spec.dialogue);
        },
        { scale: 2.6 }
      );
      if (!isStopped) {
        clock.sprite.play(spec.anim);
      } else if (playerState.loopCount >= 1) {
        // 3장에서 1회 이상 방을 맴돈 뒤에는 멈춘 시계 주변에 시간의 파동이 은은하게 피어올라 조사를 유도한다
        this.clockHintTimer = this.time.addEvent({
          delay: 650,
          loop: true,
          callback: () => {
            if (!clock.sprite.scene || playerState.getFlag('ch3_unlocked')) return;
            const spark = this.add.circle(
              o.x + Phaser.Math.Between(-14, 14),
              o.y + Phaser.Math.Between(-18, 12),
              Phaser.Math.Between(2, 3),
              0xffe9a8, 0.65
            ).setDepth(9);
            this.tweens.add({
              targets: spark,
              y: spark.y - Phaser.Math.Between(14, 24),
              alpha: 0,
              duration: 750,
              onComplete: () => spark.destroy()
            });
          }
        });
      }
      // 이미 해금된 3장 시계는 처음부터 비활성화한다
      if (this.chapter === 3) {
        this.stopClock = clock;
        if (playerState.getFlag('ch3_unlocked')) clock.disable();
      }
      this.interactables.push(clock);
    } else {
      // npc / mirror — 조사하면 대화가 재생되고 플래그·보상이 처리된다
      const label = o.kind === 'npc' ? 'E: 말 걸기'
        : o.kind === 'mirror' ? 'E: 들여다보기' : 'E: 조사하기';
      const it = new Interactable(
        this, o.x, o.y, o.key, label,
        () => {
          // 6장 거울 조사 시 거울 표면 위로 '내면의 나' 또는 '미래의 나(보스)' 환영이 스쳐 지나가는 연출
          if (o.kind === 'mirror') this.showMirrorReflection(o);
          this.runDialogue(o.dialogue, () => this.onObjectDone(o, it), { keepFrozen: true });
        },
        { scale: o.scale || 3 }
      );
      // NPC는 충돌 바디와 위치가 어긋나지 않도록 제자리에서 미세한 스케일 호흡 모션을 준다
      if (o.kind === 'npc') {
        const baseNpcScale = o.scale || 3;
        this.tweens.add({
          targets: it.sprite,
          scaleY: baseNpcScale * 1.03,
          duration: 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
      // 한 번 대화한 오브젝트는 다시 반응하지 않는다 — 보상 중복 지급 방지 (3장 시계와 동일)
      if (o.flag && playerState.getFlag(o.flag)) it.disable();
      this.interactables.push(it);
    }
  }

  // 6장 거울 연출 — 거울 속에 주인공이 아닌 다른 실루엣(내면의 나 / 그림자)이 일렁이며 비친다
  showMirrorReflection(o) {
    const ghostKey = o.dialogue === 'mirror3' ? 'boss' : 'inner-self';
    const ghost = this.add.image(o.x, o.y - 6, ghostKey)
      .setScale(2.4).setAlpha(0).setDepth(15).setTint(0xcfc8ff);
    this.tweens.add({
      targets: ghost, alpha: o.dialogue === 'mirror3' ? 0.22 : 0.4,
      duration: 350, yoyo: true, hold: o.dialogue === 'mirror3' ? 150 : 650,
      onComplete: () => ghost.destroy()
    });
  }

  // 조사 오브젝트 상호작용 완료 — 플래그 기록, 보상 지급, 해금 안내 후 오브젝트 비활성화
  onObjectDone(o, it) {
    if (o.flag) {
      playerState.setFlag(o.flag);
      it.disable();   // 플래그 있는 오브젝트는 한 번만 반응한다
      this.refreshGoals();
    }
    if (o.reward && (o.reward.fragment || o.reward.skill)) {
      sound.reward();
      const texts = [];
      if (o.reward.fragment) {
        playerState.addPowerFragment();
        texts.push('힘의 조각이 스며든다. (공격력 +2, 최대 HP +10, 최대 MP +5)');
      }
      if (o.reward.skill) {
        playerState.learnSkill(o.reward.skill);
        texts.push(`스킬 습득: ${o.reward.skill}`);
      }
      playerState.save();
      this.time.delayedCall(350, () => this.runDialogue(
        texts.map(text => ({ speaker: '', text }))));
    } else if (o.flag && this.isCleared()) {
      playerState.save();
      this.time.delayedCall(350, () => this.runDialogue([
        { speaker: '나', text: '...문 쪽에서 빛이 새어 나온다. 나아갈 수 있어.' }
      ]));
    } else {
      playerState.save();
      // 후속 안내 대화가 없는 경우에만 조작 잠금을 즉시 해제한다
      this.unlockTimer = this.time.delayedCall(60, () => {
        this.unlockTimer = null;
        this.uiBusy = false;
        this.player.frozen = false;
      });
    }
  }

  // 챕터 클리어 여부 — 모든 오브젝트 플래그가 차면 문이 열린다
  isCleared() {
    const c = this.conf;
    const objectsDone = (c.objects || [])
      .every(o => !o.flag || playerState.getFlag(o.flag));
    return objectsDone && (!c.unlockFlag || playerState.getFlag(c.unlockFlag));
  }

  // 시간 정지 연출 → 내면의 자신과 대화 → 진행 해금
  timeStop() {
    if (this.timeStopBusy) return;           // 이벤트 중복 실행 방지
    this.timeStopBusy = true;
    sound.timeStop();
    this.cameras.main.flash(500, 255, 255, 255);
    // 세상이 회색으로 멈춘다
    this.overlay = this.add.rectangle(320, 240, 640, 480, 0x888899, 0.45)
      .setDepth(500).setAlpha(0);
    this.tweens.add({ targets: this.overlay, alpha: 0.45, duration: 800 });

    // 내면의 자신이 나타나 주인공을 마주본다 (같은 실루엣 — 반전 복선)
    const px = this.player.sprite.x, py = this.player.sprite.y;
    this.innerSelf = this.add.image(px, py - 70, 'inner-self').setScale(3).setAlpha(0);
    this.tweens.add({ targets: this.innerSelf, alpha: 1, duration: 1200 });

    this.time.delayedCall(1400, () => {
      this.runDialogue('inner_self', () => {
        sound.reward();
        playerState.learnSkill('마음의 눈');
        playerState.setFlag('ch3_unlocked');
        playerState.save();
        this.refreshGoals();
        // 해금된 순간부터 시계는 더 이상 상호작용하지 않고, 멈췄던 시계추와 초침이 다시 움직이기 시작한다
        if (this.clockHintTimer) {
          this.clockHintTimer.remove();
          this.clockHintTimer = null;
        }
        if (this.stopClock) {
          const spec = this.getRoomClockSpec(3);
          this.stopClock.disable();
          this.stopClock.sprite.setTexture(spec.tex);
          this.stopClock.sprite.play(spec.anim);
        }
        sound.startClockTick(false);
        // 시간이 다시 흐른다 — 내면의 자신은 사라지고 문이 열린다
        this.tweens.add({ targets: this.overlay, alpha: 0, duration: 800 });
        this.tweens.add({
          targets: this.innerSelf, alpha: 0, duration: 1200,
          onComplete: () => this.innerSelf.destroy()
        });
        this.time.delayedCall(900, () =>
          this.runDialogue([
            { speaker: '', text: '스킬 습득: 마음의 눈' },
            { speaker: '나', text: '...멈춰 있던 모래시계가 다시 흘러내리기 시작했어. 이제 진짜로 나아갈 수 있겠어.' }
          ]));
      }, { keepFrozen: true });
    });
  }

  // 문으로 나갈 때의 분기 처리.
  // 잠긴 문은 불필요한 암전(페이드아웃) 없이 즉시 플레이어를 물러서게 하고 안내 대사를 띄운다.
  onDoor() {
    this.uiBusy = true;
    this.player.frozen = true;

    const canProceed = this.chapter === 0
      ? !!(this.tutGoals && this.tutGoals.move && this.tutGoals.sign)
      : (this.isCleared() || !!this.conf.loops);

    if (!canProceed) {
      this.player.sprite.y = 132;
      if (this.player.shadow) {
        this.player.shadow.setPosition(this.player.sprite.x, this.player.sprite.y + 22);
      }
      this.doorCooldown = false;
      const msg = this.chapter === 0
        ? '아직 이 방에서 할 게 남아 있어. 왼쪽 위의 목표를 먼저 끝내자.'
        : this.conf.lockedMsg;
      this.runDialogue([{ speaker: '나', text: msg }]);
      return;
    }

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.chapter === 0 || this.isCleared()) {
        // 클리어: 다음 챕터로 진행
        this.scene.start('ExploreScene', { chapter: this.chapter + 1 });
        return;
      }
      if (this.conf.loops) {
        // 반복: 같은 방으로 되돌아온다
        playerState.loopCount++;
        this.scene.start('ExploreScene', { chapter: this.chapter });
      }
    });
  }
}
