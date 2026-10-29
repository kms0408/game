import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import StoryScene from './scenes/StoryScene.js';
import PrologueScene from './scenes/PrologueScene.js';
import ExploreScene from './scenes/ExploreScene.js';
import BattleScene from './scenes/BattleScene.js';
import { playerState } from './systems/PlayerState.js';
import { sound } from './systems/SoundSystem.js';
import { SKILL_INFO, TYPES } from './data/chapters.js';

// Phaser 게임 설정 — 탑다운 픽셀 RPG
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 640,
  height: 480,
  pixelArt: true,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [BootScene, TitleScene, StoryScene, PrologueScene, ExploreScene, BattleScene]
};

new Phaser.Game(config);

// 캔버스 좌우 사이드 패널에 플레이어 상태를 반영한다 (값이 변경되었을 때만 DOM을 갱신)
const el = id => document.getElementById(id);

// 사운드 음소거 토글 버튼 및 단축키(M) 연동
const soundBtn = el('sound-toggle');
const updateSoundBtn = () => {
  if (!soundBtn) return;
  soundBtn.textContent = sound.muted ? '사운드: 꺼짐 (M)' : '사운드: 켜짐 (M)';
};
updateSoundBtn();
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    sound.toggleMute();
    updateSoundBtn();
    soundBtn.blur();
  });
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM' && !e.repeat) {
    sound.toggleMute();
    updateSoundBtn();
  }
});
let lastSnapshot = '';
setInterval(() => {
  const snapshot = JSON.stringify({
    ch: playerState.chapter,
    hp: playerState.hp,
    maxHp: playerState.maxHp,
    mp: playerState.mp,
    maxMp: playerState.maxMp,
    atk: playerState.atk,
    frag: playerState.powerFragments,
    skills: playerState.skills
  });
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;

  // 패널은 1장 시작부터 표시한다 (타이틀/튜토리얼에서는 숨김)
  document.querySelectorAll('.side-panel')
    .forEach(p => p.classList.toggle('hidden', playerState.chapter < 1));
  el('stat-chapter').textContent = `${playerState.chapter}장 진행 중`;
  el('stat-hp').textContent = `HP ${playerState.hp} / ${playerState.maxHp}`;
  el('stat-mp').textContent = `MP ${playerState.mp} / ${playerState.maxMp}`;
  el('stat-atk').textContent = `공격력 ${playerState.atk}`;
  el('stat-frag').textContent = `힘의 조각 ${playerState.powerFragments}`;
  el('skill-list').innerHTML = playerState.skills.length
    ? playerState.skills.map(name => {
      const info = SKILL_INFO[name];
      if (!info) return name;
      const t = TYPES[info.type];
      return `<div class="skill-item"><span style="color:${t.color}">[${t.name}]</span> ${name}<br><span class="dim">MP ${info.mp} · ×${info.mult}</span></div>`;
    }).join('')
    : '없음';
}, 200);
