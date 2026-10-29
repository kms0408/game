// 프로시저럴 사운드 시스템 — 외부 오디오 에셋 없이 Web Audio API 신디사이저로
// 배경음악(오르골풍 앰비언트)과 효과음(타이핑, 메뉴, 타격, 시계 초침, 시간 정지 등)을 생성한다.
const MUTE_KEY = 'echo_of_self_muted_v1';

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.bgmTimer = null;
    this.clockTimer = null;
    this.currentBgm = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // localStorage 접근 불가 시 기본값 유지
    }

    // 브라우저 탭이 비활성화되면 오디오 컨텍스트를 일시정지하여 백그라운드 소음을 방지한다
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden || this.muted) {
          this.ctx.suspend().catch(() => {});
        } else if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  // 음소거 상태를 토글하고 localStorage에 저장한 뒤 현재 음소거 여부를 반환한다
  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // 무시
    }
    if (this.ctx) {
      if (this.muted) {
        this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
      }
    }
    return this.muted;
  }

  // 브라우저 오디오 컨텍스트 초기화 및 잠금 해제
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && !this.muted && !document.hidden && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // 단일 음표(오실레이터) 재생 헬퍼
  tone(freq, dur, { type = 'sine', vol = 0.08, slideTo = null, delay = 0 } = {}) {
    if (this.muted || (typeof document !== 'undefined' && document.hidden)) return;
    const ctx = this.init();
    if (!ctx) return;

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 노이즈 버스트 재생 헬퍼 (타격음, 폭발음, 시계 초침 등에 사용)
  noise(dur, { vol = 0.08, filterFreq = 1200, filterType = 'bandpass', delay = 0 } = {}) {
    if (this.muted || (typeof document !== 'undefined' && document.hidden)) return;
    const ctx = this.init();
    if (!ctx) return;

    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // 대화 타이핑 효과음 — 너무 잦지 않게 부드러운 틱 소리를 낸다
  typeBlip(speaker = '') {
    const base = speaker === '그림자' || speaker === '미래의 나' ? 210
      : speaker === '낯선 목소리' ? 520 : 390;
    const jitter = (Math.random() - 0.5) * 30;
    this.tone(base + jitter, 0.032, { type: 'triangle', vol: 0.035 });
  }

  // 메뉴 커서 이동음
  menuMove() {
    this.tone(540, 0.045, { type: 'triangle', vol: 0.05 });
  }

  // 메뉴 선택/대화 넘김 확인음
  menuConfirm() {
    this.tone(660, 0.07, { type: 'triangle', vol: 0.06, slideTo: 880 });
  }

  // 선택 불가(마나 부족, 재충전 중, 미습득 스킬 등) 거부 효과음
  menuDenied() {
    this.tone(190, 0.09, { type: 'sawtooth', vol: 0.055, slideTo: 135 });
    this.tone(145, 0.11, { type: 'triangle', vol: 0.05, delay: 0.06 });
  }

  // 기술의 접촉 순간마다 재생한다. 연속 참격은 마지막 타격에만 저음을 보탠다.
  // opts: { weak, resisted, pierce } — 상성 약점/반감 및 방어 관통에 따라 타격음 질감을 차별화한다.
  hit(fx = 'slash', last = true, opts = {}) {
    if (fx === 'heavy') {
      this.noise(0.16, { vol: 0.13, filterFreq: 650, filterType: 'lowpass' });
      this.tone(150, 0.22, { type: 'triangle', vol: 0.12, slideTo: 45 });
      this.tone(740, 0.1, { vol: 0.04, slideTo: 370 });
    } else if (fx === 'wave') {
      this.noise(0.065, { vol: 0.065, filterFreq: last ? 1500 : 2700 });
      this.tone(last ? 360 : 620, 0.09, { type: 'triangle', vol: 0.05, slideTo: 160 });
      if (last) this.tone(130, 0.14, { vol: 0.08, slideTo: 65 });
    } else if (fx === 'twin') {
      this.tone(1046, 0.2, { type: 'sine', vol: 0.06, slideTo: 523 });
      this.tone(1568, 0.13, { type: 'triangle', vol: 0.04 });
      this.noise(0.07, { vol: 0.05, filterFreq: 3200 });
    } else if (fx === 'burst') {
      this.noise(0.32, { vol: 0.12, filterFreq: 480, filterType: 'lowpass' });
      this.tone(110, 0.38, { type: 'sawtooth', vol: 0.07, slideTo: 35 });
      this.tone(440, 0.25, { type: 'triangle', vol: 0.05, slideTo: 220 });
    } else {
      this.noise(0.11, { vol: 0.09, filterFreq: opts.resisted ? 700 : 1400 });
      this.tone(opts.resisted ? 150 : 220, 0.12, { type: 'sawtooth', vol: 0.06, slideTo: opts.resisted ? 90 : 110 });
    }
    // 약점(×1.5) 또는 방어 돌파 적중 시 맑고 날카로운 크리스탈 파열음을 덧입혀 쾌감을 높인다
    if (last && (opts.weak || opts.pierce)) {
      this.tone(1174.66, 0.14, { type: 'triangle', vol: 0.055, slideTo: 1567.98, delay: 0.02 });
      this.tone(1760, 0.16, { type: 'sine', vol: 0.045, delay: 0.05 });
    }
  }

  // 시전 준비음은 실제 타격음보다 작게 두어 접촉 순간이 분명하게 들리도록 한다.
  skillWindup(fx) {
    if (fx === 'twin') this.tone(392, 0.25, { vol: 0.035, slideTo: 784 });
    else if (fx === 'burst') this.tone(90, 0.3, { type: 'triangle', vol: 0.05, slideTo: 360 });
    else if (fx === 'heavy') this.noise(0.12, { vol: 0.035, filterFreq: 1800 });
  }

  // 플레이어 피격음
  hurt() {
    this.noise(0.14, { vol: 0.1, filterFreq: 600, filterType: 'lowpass' });
    this.tone(160, 0.16, { type: 'sawtooth', vol: 0.07, slideTo: 75 });
  }

  // 방어막 전개음
  guard() {
    this.tone(440, 0.15, { type: 'sine', vol: 0.06, slideTo: 660 });
    this.tone(660, 0.2, { type: 'triangle', vol: 0.05, delay: 0.06 });
  }

  // 적 강공격 차징 경고음
  charge() {
    this.tone(180, 0.35, { type: 'sawtooth', vol: 0.07, slideTo: 420 });
    this.tone(240, 0.35, { type: 'triangle', vol: 0.06, slideTo: 560, delay: 0.08 });
  }

  // 보상/힘의 조각 획득음
  reward() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.22, { type: 'triangle', vol: 0.06, delay: i * 0.07 });
    });
  }

  // 시간 정지 연출음 — 공명하며 서서히 내려앉는 소리
  timeStop() {
    this.stopClockTick();
    this.tone(880, 0.9, { type: 'sine', vol: 0.1, slideTo: 110 });
    this.tone(440, 0.9, { type: 'triangle', vol: 0.07, slideTo: 55 });
  }

  // 시계 초침 소리 (째깍-똑딱) 시작/정지
  startClockTick(stopped = false) {
    this.stopClockTick();
    if (stopped) return; // 3장 멈춘 시계는 소리가 나지 않는다 (대비 효과)
    let high = true;
    this.clockTimer = setInterval(() => {
      this.tone(high ? 1100 : 820, 0.018, { type: 'sine', vol: 0.022 });
      high = !high;
    }, 1000);
  }

  stopClockTick() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  // 배경음악 전환 ('explore' | 'battle' | 'story' | 'none')
  playBgm(mode) {
    if (this.currentBgm === mode) return;
    this.stopBgm();
    this.currentBgm = mode;
    if (mode === 'none' || !mode) return;

    // 모드별 오르골 아르페지오 노트 시퀀스 (Hz)
    const patterns = {
      explore: {
        notes: [440, 523.25, 659.25, 587.33, 523.25, 493.88, 440, 392],
        stepMs: 650,
        vol: 0.028,
        type: 'sine'
      },
      battle: {
        notes: [220, 261.63, 329.63, 293.66, 220, 329.63, 293.66, 246.94],
        stepMs: 360,
        vol: 0.032,
        type: 'triangle'
      },
      story: {
        notes: [523.25, 659.25, 783.99, 659.25, 587.33, 493.88, 440, 392],
        stepMs: 800,
        vol: 0.026,
        type: 'sine'
      }
    };

    const cfg = patterns[mode];
    if (!cfg) return;
    let idx = 0;
    this.bgmTimer = setInterval(() => {
      const f = cfg.notes[idx % cfg.notes.length];
      idx++;
      this.tone(f, cfg.stepMs / 1000 * 0.9, { type: cfg.type, vol: cfg.vol });
    }, cfg.stepMs);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.currentBgm = null;
  }
}

export const sound = new SoundSystem();
