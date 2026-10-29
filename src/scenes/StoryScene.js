import Phaser from 'phaser';
import DialogueSystem from '../systems/DialogueSystem.js';
import { DIALOGUES, SCRIPTS, LETTER } from '../data/dialogues.js';
import { playerState } from '../systems/PlayerState.js';
import { sound } from '../systems/SoundSystem.js';

// 컷신 씬 — SCRIPTS에 정의된 명령을 순서대로 실행한다.
// 명령 종류: spawn / dialogue / quote / swap / fadeout / goto / black / letter / title
export default class StoryScene extends Phaser.Scene {
  constructor() { super('StoryScene'); }

  init(data) {
    this.script = SCRIPTS[data.script] || [];
    this.step = 0;
    this.actors = {};
  }

  create() {
    this.buildBackground();
    this.cameras.main.fadeIn(800, 0, 0, 0);
    sound.playBgm('story');
    this.dialogue = new DialogueSystem(this);
    this.time.delayedCall(850, () => this.next());
  }

  // 컷신 배경: 밤 도시 분위기 배경을 어둡게 톤다운하고 비네팅·먼지 입자로 공허한 분위기를 낸다
  buildBackground() {
    this.add.image(320, 240, 'night-bg').setTint(0x8888aa);

    // 화면 가장자리를 어둡게 하는 비네팅 (배경 위, 액터 아래)
    this.add.image(320, 240, 'vignette');

    // 천천히 떠오르는 먼지 입자
    for (let i = 0; i < 18; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(24, 616), Phaser.Math.Between(24, 456),
        1, 0x8a86b8, Phaser.Math.FloatBetween(0.15, 0.35)
      );
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(30, 70),
        alpha: 0,
        duration: Phaser.Math.Between(2500, 5000),
        delay: Phaser.Math.Between(0, 2500),
        repeat: -1,
        onRepeat: () => {
          mote.x = Phaser.Math.Between(24, 616);
          mote.y = Phaser.Math.Between(240, 456);
          mote.setAlpha(Phaser.Math.FloatBetween(0.15, 0.35));
        }
      });
    }
  }

  // 다음 스크립트 명령 실행
  next() {
    if (this.step >= this.script.length) return;
    const cmd = this.script[this.step++];

    switch (cmd.type) {
      case 'spawn': {
        const actor = this.add.image(cmd.x, cmd.y, cmd.key).setScale(cmd.scale || 1);
        this.actors[cmd.id] = actor;
        this.next();
        break;
      }
      case 'dialogue': {
        this.dialogue.start(DIALOGUES[cmd.key], () => this.next());
        break;
      }
      case 'quote': {
        this.showQuote(cmd.text);
        break;
      }
      case 'swap': {
        // 액터의 외형을 다른 텍스처로 교체한다 (반전 연출용)
        const actor = this.actors[cmd.id];
        if (actor) {
          this.cameras.main.flash(500, 255, 255, 255);
          this.time.delayedCall(250, () => actor.setTexture(cmd.key));
          this.time.delayedCall(1200, () => this.next());
        } else {
          this.next();
        }
        break;
      }
      case 'fadeout': {
        this.cameras.main.fadeOut(900, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.next());
        break;
      }
      case 'black': {
        // 화면을 검게 덮어 액터와 배경을 숨긴다 — 이후 quote/letter가 이 위에서 재생된다
        const cover = this.add.rectangle(320, 240, 640, 480, 0x000000)
          .setDepth(490).setAlpha(0);
        this.tweens.add({
          targets: cover, alpha: 1, duration: 900,
          onComplete: () => this.next()
        });
        break;
      }
      case 'letter': {
        this.showLetter();
        break;
      }
      case 'goto': {
        this.scene.start(cmd.scene, cmd.data);
        break;
      }
      case 'title': {
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          // 게임 클리어 후 타이틀 복귀 — 클리어 기록을 남겨 타이틀 시계를 디지털시계로 바꾸고 상태를 초기화한다
          playerState.markCleared();
          playerState.reset();
          playerState.clearSave();
          this.scene.start('TitleScene');
        });
        break;
      }
      default:
        this.next();
    }
  }

  // 인용구 표시: 밤 배경 위에 중앙 문구를 띄운 뒤 E / SPACE / ENTER 또는 클릭 입력을 기다린다
  showQuote(text) {
    const { width, height } = this.scale;

    const veil = this.add.rectangle(320, 240, 640, 480, 0x0a0a14)
      .setDepth(499).setAlpha(0)
      .setInteractive({ useHandCursor: true });
    const quote = this.add.text(width / 2, height / 2 - 40, text, {
      fontSize: '19px', fontFamily: 'monospace', color: '#e8e4ff',
      align: 'center', lineSpacing: 10, stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0).setDepth(500);
    const hint = this.add.text(width / 2, height - 80, 'E / SPACE: 계속 ▶', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8a86b8'
    }).setOrigin(0.5).setAlpha(0).setDepth(500);

    this.tweens.add({ targets: [veil, quote], alpha: 1, duration: 1200 });
    this.tweens.add({ targets: hint, alpha: 1, duration: 600, delay: 1200 });

    let done = false;
    const proceed = () => {
      if (done) return;
      done = true;
      sound.menuMove();
      this.input.keyboard.off('keydown-E', proceed);
      this.input.keyboard.off('keydown-SPACE', proceed);
      this.input.keyboard.off('keydown-ENTER', proceed);
      this.tweens.add({
        targets: [veil, quote, hint], alpha: 0, duration: 400,
        onComplete: () => {
          veil.destroy(); quote.destroy(); hint.destroy();
          this.next();
        }
      });
    };
    this.input.keyboard.on('keydown-E', proceed);
    this.input.keyboard.on('keydown-SPACE', proceed);
    this.input.keyboard.on('keydown-ENTER', proceed);
    veil.on('pointerdown', proceed);
  }

  // 개발자의 편지 — 검은 화면 위에서 편지가 아래에서 위로 흐르는 크레딧 연출.
  // SPACE/E를 누르는 동안 빠르게 감고, 끝까지 재생된 뒤에는 키 입력으로 다음으로 진행한다
  showLetter() {
    this.add.rectangle(320, 240, 640, 480, 0x050508).setDepth(495);

    const body = this.add.text(320, 480, LETTER.join('\n'), {
      fontSize: '18px', fontFamily: 'monospace', color: '#cfc6b8',
      align: 'left', lineSpacing: 10, wordWrap: { width: 560, useAdvancedWrap: true }
    }).setOrigin(0.5, 0).setDepth(496);

    const hint = this.add.text(320, 452, 'SPACE / E — 길게 누르면 빨리 감기', {
      fontSize: '13px', fontFamily: 'monospace', color: '#6b6255'
    }).setOrigin(0.5).setDepth(497);

    const endY = -body.height - 40;
    const scroll = this.tweens.add({
      targets: body, y: endY,
      duration: (480 - endY) * 44,   // 약 22px/s — 이전의 절반 속도
      ease: 'Linear'
    });

    const speedUp = () => { scroll.timeScale = 4; };
    const speedNormal = () => { scroll.timeScale = 1; };
    this.input.keyboard.on('keydown-SPACE', speedUp);
    this.input.keyboard.on('keyup-SPACE', speedNormal);
    this.input.keyboard.on('keydown-E', speedUp);
    this.input.keyboard.on('keyup-E', speedNormal);

    // 스크롤이 끝나면 속도 조절 리스너를 정리하고 진행 안내로 바꾼다
    scroll.on('complete', () => {
      this.input.keyboard.off('keydown-SPACE', speedUp);
      this.input.keyboard.off('keyup-SPACE', speedNormal);
      this.input.keyboard.off('keydown-E', speedUp);
      this.input.keyboard.off('keyup-E', speedNormal);
      hint.setText('E / SPACE — 계속');
      let advanced = false;
      const finishLetter = () => {
        if (advanced) return;
        advanced = true;
        this.input.keyboard.off('keydown-SPACE', finishLetter);
        this.input.keyboard.off('keydown-E', finishLetter);
        this.input.keyboard.off('keydown-ENTER', finishLetter);
        this.next();
      };
      this.input.keyboard.on('keydown-SPACE', finishLetter);
      this.input.keyboard.on('keydown-E', finishLetter);
      this.input.keyboard.on('keydown-ENTER', finishLetter);
    });
  }
}
