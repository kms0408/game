import Phaser from 'phaser';

// 상호작용 오브젝트 — 플레이어가 가까이 가면 안내 문구를 띄우고 E키/스페이스로 실행
export default class Interactable {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x, y 위치
   * @param {string} texture 표시할 텍스처 키
   * @param {string} prompt 근접 시 보여줄 안내 (예: 'E: 조사하기')
   * @param {function} action 상호작용 실행 함수
   * @param {object} opts { scale, radius }
   */
  constructor(scene, x, y, texture, prompt, action, opts = {}) {
    this.scene = scene;
    this.action = action;
    this.radius = opts.radius || 40;
    this.disabled = false;   // true면 프롬프트도 뜨지 않고 상호작용도 불가
    const scale = opts.scale || 3;
    // 스프라이트 애니메이션 재생이 필요한 경우(예: 괘종시계)를 위해 sprite로 생성한다
    this.sprite = scene.add.sprite(x, y, texture).setScale(scale).setDepth(8);
    const dw = this.sprite.displayWidth, dh = this.sprite.displayHeight;
    // 오브젝트 발밑 그림자 — 바닥 위에 자연스럽게 안착된 입체감을 부여한다
    this.shadow = scene.add.ellipse(x, y + dh * 0.46, dw * 0.78, Math.max(10, dw * 0.28), 0x000000, 0.36)
      .setDepth(7);

    this.promptText = scene.add.text(x, y - dh * 0.55 - 8, prompt, {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffe9a8',
      backgroundColor: '#000000aa', padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // 충돌 바디 — 플레이어 상체 높이와 오브젝트 전체 영역을 함께 감싸 캐릭터와 오브젝트가 겹치지 않도록 한다
    // (StaticBody의 setSize/setOffset은 표시 크기 기준 월드 픽셀 단위)
    scene.physics.add.existing(this.sprite, true);
    this.sprite.body.setSize(dw + 8, dh + 24, false);
    this.sprite.body.setOffset(-4, 0);
  }

  // 상호작용 불가 상태로 만든다 (예: 3장 시계 — 해금 후 재실행 방지)
  disable() {
    this.disabled = true;
    this.promptText.setVisible(false);
  }

  // 플레이어와의 거리를 보고 안내 표시 여부를 갱신한다.
  // 충돌 바디 외곽(상하좌우)에 닿았을 때도 안내 문구가 안정적으로 뜨도록 중심·발밑·정면 거리를 함께 확인한다.
  checkProximity(player) {
    if (this.disabled) {
      this.promptText.setVisible(false);
      return false;
    }
    const px = player.sprite.x, py = player.sprite.y;
    const ox = this.sprite.x, oy = this.sprite.y;
    const dh = this.sprite.displayHeight || 0;
    const centerDist = Phaser.Math.Distance.Between(px, py, ox, oy);
    const footDist = Phaser.Math.Distance.Between(px, py + 12, ox, oy + dh * 0.35);
    const frontDist = Phaser.Math.Distance.Between(px, py - 18, ox, oy + dh * 0.45);
    const topDist = Phaser.Math.Distance.Between(px, py + 24, ox, oy - dh * 0.45);
    const d = Math.min(centerDist, footDist, frontDist, topDist);
    this.promptText.setVisible(d < this.radius);
    return d < this.radius;
  }

  destroy() {
    if (this.shadow) this.shadow.destroy();
    this.sprite.destroy();
    this.promptText.destroy();
  }
}
