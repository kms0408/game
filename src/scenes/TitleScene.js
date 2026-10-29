import Phaser from 'phaser';
import { playerState } from '../systems/PlayerState.js';
import { sound } from '../systems/SoundSystem.js';

// 타이틀 화면 — 새 게임 시작 및 저장된 체크포인트 이어하기를 제공한다
export default class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  preload() {
    // 타이틀 배경 이미지 로드 (노을 도시 실루엣)
    this.load.image('title-bg', 'assets/title-bg.webp');
  }

  create() {
    this.started = false;
    sound.stopBgm();
    sound.stopClockTick();
    const { width, height } = this.scale;

    // 배경을 화면 전체에 덮도록 확대 (비율 유지, 좌우 여분은 크롭)
    const bg = this.add.image(width / 2, height / 2, 'title-bg');
    bg.setScale(Math.max(width / bg.width, height / bg.height));

    // 텍스트 가독성을 위한 어두운 오버레이
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35);

    const isCleared = playerState.isGameCleared();

    // 제목 위 시계 장식:
    // - 클리어 전: 과거에 갇힌 시간을 상징하는 옛날 시계(모래시계)가 흐른다
    // - 클리어 후: '지금 나의 시간'을 상징하는 현재의 디지털시계(실시간 시각 표시)로 변경된다
    if (isCleared) {
      const dClock = this.add.image(width / 2, 74, 'digital-clock').setScale(2);
      // 디지털 액정 위에 플레이어의 실제 현재 시각(HH:MM:SS)을 실시간으로 표시한다
      const formatNow = () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      };
      const timeText = this.add.text(width / 2, 73, formatNow(), {
        fontSize: '21px', fontFamily: 'monospace', color: '#7fffd8',
        stroke: '#081820', strokeThickness: 2
      }).setOrigin(0.5);
      // डिजिटल 시계 특유의 은은한 발광 맥동과 1초 주기 실시간 갱신
      this.tweens.add({
        targets: [dClock, timeText], y: '-=2', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => { if (timeText.scene) timeText.setText(formatNow()); }
      });
    } else {
      const hourglass = this.add.sprite(width / 2, 72, 'sand-clock-0').setScale(1.35);
      // 모래가 약 6.6초 동안 천천히 다 떨어지면 부드럽게 180° 뒤집히며 다시 흐른다
      const flipTitleHourglass = () => {
        this.tweens.add({
          targets: hourglass,
          angle: '+=180',
          duration: 1100,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            hourglass.setAngle(0);
            hourglass.play('sand-flow-slow');
          }
        });
      };
      hourglass.on('animationcomplete', flipTitleHourglass);
      hourglass.play('sand-flow-slow');
      this.tweens.add({
        targets: hourglass, y: 69, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    this.add.text(width / 2, 152, '시 간', {
      fontSize: '52px', fontFamily: 'monospace', color: '#cfc8ff',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    if (isCleared) {
      this.add.text(width / 2, 198, '— 지금, 당신의 시간이 흐르고 있습니다 —', {
        fontSize: '13px', fontFamily: 'monospace', color: '#ffe9a8',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);
    }

    const hasSave = playerState.hasSave();
    const savedChapter = playerState.getSavedChapter();

    // 이어하기 액션과 새 게임 시작 액션 정의
    const continueGame = () => {
      if (this.started) return;
      this.started = true;
      sound.menuConfirm();
      if (playerState.load()) {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('ExploreScene', { chapter: playerState.chapter }));
      }
    };

    const startNewGame = () => {
      if (this.started) return;          // 중복 클릭 방지
      this.started = true;
      sound.menuConfirm();
      playerState.justCleared = false;   // 새 게임 시작 시 클리어 이스터에그 초기화
      playerState.reset();
      playerState.clearSave();
      this.showLoading();
    };

    // 타이틀 메뉴 버튼 목록 (마우스 호버/클릭 및 키보드 방향키 + E/Enter/Space 모두 지원)
    this.menuActions = [];
    this.menuBgs = [];
    this.selectedIdx = 0;

    // 이어하기 버튼 — 저장된 체크포인트가 있을 때만 상단에 추가 배치한다
    if (hasSave) {
      const contBtn = this.add.container(width / 2, 344);
      const contBg = this.add.rectangle(0, 0, 240, 44, 0x261d4a, 0.92)
        .setStrokeStyle(2, 0xffe9a8)
        .setInteractive({ useHandCursor: true });
      const contText = this.add.text(0, 0, `▶ 이어하기 (${savedChapter}장)`, {
        fontSize: '18px', fontFamily: 'monospace', color: '#ffe9a8'
      }).setOrigin(0.5);
      contBtn.add([contBg, contText]);
      const idx = this.menuActions.length;
      this.menuActions.push(continueGame);
      this.menuBgs.push({ bg: contBg, baseFill: 0x261d4a, hoverFill: 0x3f3078, stroke: 0xffe9a8 });
      contBg.on('pointerover', () => this.highlightMenu(idx));
      contBg.on('pointerdown', continueGame);
    }

    // 시작하기(새 게임) 버튼 — 배경 박스 + 텍스트 컨테이너로 하단에 눈에 띄게 배치
    const btnY = hasSave ? 404 : 400;
    const btn = this.add.container(width / 2, btnY);
    const btnBg = this.add.rectangle(0, 0, 240, 48, 0x1b1437, 0.9)
      .setStrokeStyle(2, 0xcfc8ff)
      .setInteractive({ useHandCursor: true });
    const startText = this.add.text(0, 0, hasSave ? '▶ 처음부터' : '▶ 시작하기', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);
    btn.add([btnBg, startText]);

    const newIdx = this.menuActions.length;
    this.menuActions.push(startNewGame);
    this.menuBgs.push({ bg: btnBg, baseFill: 0x1b1437, hoverFill: 0x3a2a6d, stroke: 0xcfc8ff });
    btnBg.on('pointerover', () => this.highlightMenu(newIdx));
    btnBg.on('pointerdown', startNewGame);

    // 버튼 깜빡임 효과
    this.tweens.add({
      targets: btn, alpha: 0.65, duration: 800, yoyo: true, repeat: -1
    });

    this.highlightMenu(0, true);

    // 키보드로도 타이틀 메뉴를 이동·선택할 수 있도록 지원한다
    const moveUp = () => {
      if (this.started || this.menuActions.length <= 1) return;
      this.highlightMenu((this.selectedIdx - 1 + this.menuActions.length) % this.menuActions.length);
    };
    const moveDown = () => {
      if (this.started || this.menuActions.length <= 1) return;
      this.highlightMenu((this.selectedIdx + 1) % this.menuActions.length);
    };
    const confirmKey = () => {
      if (this.started) return;
      this.menuActions[this.selectedIdx]();
    };
    this.input.keyboard.on('keydown-UP', moveUp);
    this.input.keyboard.on('keydown-W', moveUp);
    this.input.keyboard.on('keydown-DOWN', moveDown);
    this.input.keyboard.on('keydown-S', moveDown);
    this.input.keyboard.on('keydown-ENTER', confirmKey);
    this.input.keyboard.on('keydown-SPACE', confirmKey);
    this.input.keyboard.on('keydown-E', confirmKey);
  }

  // 타이틀 메뉴 포커스 하이라이트 갱신
  highlightMenu(idx, silent = false) {
    if (this.selectedIdx !== idx && !silent) sound.menuMove();
    this.selectedIdx = idx;
    this.menuBgs.forEach((item, i) => {
      const active = i === idx;
      item.bg.setFillStyle(active ? item.hoverFill : item.baseFill, active ? 0.96 : 0.9);
      item.bg.setStrokeStyle(active ? 3 : 2, active ? 0xffe9a8 : item.stroke);
    });
  }

  // 시작 클릭 후 모래시계 전환 연출을 약 1.6초 보여주고 프롤로그 컷신으로 넘어간다 (키/클릭으로 즉시 스킵 가능)
  showLoading() {
    const { width, height } = this.scale;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // 타이틀 UI를 가리는 밤 배경 위에 모래시계와 전환 문구 표시
      const bg = this.add.image(width / 2, height / 2, 'night-bg')
        .setInteractive({ useHandCursor: true });
      // 모래가 실시간으로 흘러내리는 모래시계 애니메이션
      const sand = this.add.sprite(width / 2, 200, 'sand-clock-0');
      sand.setScale(200 / sand.height);
      const flipSand = () => {
        this.tweens.add({
          targets: sand,
          angle: '+=180',
          duration: 660,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            sand.setAngle(0);
            sand.play({ key: 'sand-flow', repeat: 0 });
          }
        });
      };
      sand.on('animationcomplete', flipSand);
      sand.play({ key: 'sand-flow', repeat: 0 });
      const loadingText = this.add.text(width / 2, 340, '시간을 되감는 중...', {
        fontSize: '17px', fontFamily: 'monospace', color: '#cfc8ff'
      }).setOrigin(0.5);
      this.tweens.add({
        targets: loadingText, alpha: 0.35, duration: 500, yoyo: true, repeat: -1
      });

      let transitioning = false;
      const goPrologue = () => {
        if (transitioning) return;
        transitioning = true;
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () =>
          this.scene.start('StoryScene', { script: 'prologue' }));
      };

      this.cameras.main.fadeIn(350, 0, 0, 0);
      this.time.delayedCall(1600, goPrologue);
      this.input.keyboard.once('keydown-E', goPrologue);
      this.input.keyboard.once('keydown-SPACE', goPrologue);
      this.input.keyboard.once('keydown-ENTER', goPrologue);
      bg.once('pointerdown', goPrologue);
    });
  }
}
