import Phaser from 'phaser';

// 탐험 씬의 플레이어 캐릭터 — 방향키 및 WASD로 8방향(대각선 포함) 이동하는 탑다운 캐릭터
export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    // 발밑에 드리워지는 반투명 타원 그림자 — 바닥과의 일체감을 준다
    this.shadow = scene.add.ellipse(x, y + 22, 30, 11, 0x000000, 0.36).setDepth(9);
    this.sprite = scene.physics.add.sprite(x, y, 'hero-down-0').setScale(3);
    this.sprite.setDepth(10);              // 오브젝트보다 항상 앞에 그린다
    this.sprite.setCollideWorldBounds(true);
    // 발 부분만 충돌 판정 (머리는 벽에 겹쳐도 자연스럽게)
    this.sprite.body.setSize(10, 6).setOffset(3, 10);
    this.dir = 'down';
    this.frozen = false;   // 대화/연출 중 이동 잠금
    this.speed = 146;      // 이동 속도 (기본 110 대비 +33%)

    this.cursors = scene.input.keyboard.createCursorKeys();
    // 방향키뿐만 아니라 WASD 키로도 동일하게 이동할 수 있도록 등록한다
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
  }

  update() {
    if (this.shadow) {
      this.shadow.setPosition(this.sprite.x, this.sprite.y + 22);
    }
    if (this.frozen) {
      this.sprite.setVelocity(0, 0);
      this.sprite.anims.stop();
      return;
    }
    const k = this.cursors;
    const w = this.wasd;
    const left = k.left.isDown || w.left.isDown;
    const right = k.right.isDown || w.right.isDown;
    const up = k.up.isDown || w.up.isDown;
    const down = k.down.isDown || w.down.isDown;

    // 좌우·상하 입력을 독립 합산하여 대각선 이동을 지원하고, 대각선 이동 시 속도를 정규화한다
    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    // 바라보는 방향 결정: 대각선 이동 중에는 기존 진행 방향 키가 유지되면 그 방향을 유지해 깜빡임을 방지한다
    if (vx !== 0 || vy !== 0) {
      const keepCurrent =
        (this.dir === 'left' && left && !right) ||
        (this.dir === 'right' && right && !left) ||
        (this.dir === 'up' && up && !down) ||
        (this.dir === 'down' && down && !up);
      if (!keepCurrent) {
        if (vy < 0) this.dir = 'up';
        else if (vy > 0) this.dir = 'down';
        else if (vx < 0) this.dir = 'left';
        else if (vx > 0) this.dir = 'right';
      }
    }

    this.sprite.setVelocity(vx * this.speed, vy * this.speed);

    if (vx !== 0 || vy !== 0) {
      this.sprite.anims.play(`hero-walk-${this.dir}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setTexture(`hero-${this.dir}-0`);
    }
  }
}
