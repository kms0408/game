import Phaser from 'phaser';
import { sound } from './SoundSystem.js';

// 대화창 시스템 — 화면 하단에 대화창을 띄우고 타이핑 효과로 텍스트를 출력한다.
// 상호작용키(E)로 진행. 어떤 씬에서든 new DialogueSystem(scene)으로 사용.
export default class DialogueSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.lines = [];
    this.index = 0;
    this.onComplete = null;
    this.objects = [];
    this.timer = null;
    this.typing = false;
  }

  // 대화 시작. lines: [{speaker, text}, ...], onComplete: 종료 시 콜백
  start(lines, onComplete) {
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete;
    this.active = true;
    this.createUI();
    this.showLine();
  }

  createUI() {
    const s = this.scene;
    // 대화창 배경과 테두리 (클릭으로도 대화를 넘길 수 있도록 interactive 부여)
    const bg = s.add.rectangle(320, 415, 600, 110, 0x0a0a14, 0.92)
      .setStrokeStyle(2, 0x8a86b8).setScrollFactor(0).setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.advance());
    this.nameBox = s.add.rectangle(68, 358, 136, 26, 0x1a1a2e, 0.95)
      .setStrokeStyle(1, 0x8a86b8).setScrollFactor(0).setDepth(1000);
    this.nameText = s.add.text(68, 358, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#cfc8ff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    this.bodyText = s.add.text(35, 385, '', {
      fontSize: '15px', fontFamily: 'monospace', color: '#eeeeee',
      wordWrap: { width: 570 }, lineSpacing: 6
    }).setScrollFactor(0).setDepth(1001);
    // 다중 대사일 때 우상단에 현재 줄 순번(예: 1/3)을 은은하게 표시한다
    this.pageText = s.add.text(605, 372, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#6e6a96'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
    // 진행 안내 문구 — E, Space, Enter 또는 클릭으로 다음 대화로 넘긴다
    this.hint = s.add.text(605, 462, 'E / SPACE: 다음 ▶', {
      fontSize: '12px', color: '#8a86b8'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(1001);
    s.tweens.add({ targets: this.hint, y: 458, duration: 400, yoyo: true, repeat: -1 });

    this.objects = [bg, this.nameBox, this.nameText, this.bodyText, this.pageText, this.hint];

    // 진행 입력: 상호작용키(E) 및 Space / Enter 통합 지원
    // 길게 누른 키의 자동 반복으로 대사가 연속해서 넘어가지 않게 한다.
    s.input.keyboard.addKeys('E,SPACE,ENTER');
    this.keyHandler = event => { if (!event.repeat) this.advance(); };
    s.input.keyboard.on('keydown-E', this.keyHandler);
    s.input.keyboard.on('keydown-SPACE', this.keyHandler);
    s.input.keyboard.on('keydown-ENTER', this.keyHandler);
  }

  // 화자 이름에 어울리는 포인트 컬러를 반환한다
  speakerColor(speaker = '') {
    if (!speaker) return '#cfc8ff';
    if (speaker === '나') return '#d8e6ff';
    if (speaker === '나래' || speaker === '방랑자' || speaker === '마을 사람') return '#ffe9a8';
    if (speaker === '낯선 목소리' || speaker === '???') return '#7fffd8';
    if (speaker === '그림자' || speaker === '미래의 나') return '#ff9aa8';
    if (speaker.includes('그림자')) return '#dcb8ff';
    return '#cfc8ff';
  }

  showLine() {
    const line = this.lines[this.index];
    const hasSpeaker = !!(line.speaker && line.speaker.trim());
    // 화자가 없는 내레이션/보상 안내 줄에서는 빈 이름표 박스를 숨겨 깔끔하게 표시한다
    this.nameBox.setVisible(hasSpeaker);
    this.nameText.setVisible(hasSpeaker);
    this.nameText.setText(line.speaker || '');
    this.nameText.setColor(this.speakerColor(line.speaker));
    this.pageText.setText(this.lines.length > 1 ? `${this.index + 1}/${this.lines.length}` : '');
    this.bodyText.setText('');
    // 타이핑 효과: 글자를 하나씩 출력
    let i = 0;
    this.typing = true;
    if (this.timer) this.timer.remove();
    this.timer = this.scene.time.addEvent({
      delay: 55,
      repeat: line.text.length - 1,
      callback: () => {
        this.bodyText.setText(line.text.slice(0, ++i));
        // 공백/문장부호가 아닐 때 2글자마다 타이핑 효과음을 재생한다
        const ch = line.text[i - 1];
        if (i % 2 === 1 && ch && ch.trim() && ch !== '.') {
          sound.typeBlip(line.speaker);
        }
        if (i >= line.text.length) this.typing = false;
      }
    });
  }

  advance() {
    if (!this.active) return;
    const line = this.lines[this.index];
    // 타이핑 중이면 전체를 즉시 표시
    if (this.typing) {
      if (this.timer) this.timer.remove();
      this.bodyText.setText(line.text);
      this.typing = false;
      return;
    }
    sound.menuMove();
    this.index++;
    if (this.index >= this.lines.length) {
      this.finish();
    } else {
      this.showLine();
    }
  }

  finish() {
    this.active = false;
    this.scene.input.keyboard.off('keydown-E', this.keyHandler);
    this.scene.input.keyboard.off('keydown-SPACE', this.keyHandler);
    this.scene.input.keyboard.off('keydown-ENTER', this.keyHandler);
    if (this.timer) this.timer.remove();
    this.objects.forEach(o => o.destroy());
    if (this.onComplete) this.onComplete();
  }
}
