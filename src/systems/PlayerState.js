import { SKILL_INFO } from '../data/chapters.js';

// 플레이어 상태 관리 — 챕터 진행, 성장 수치, 스토리 플래그, 자동 저장(localStorage)을 한곳에서 관리한다.
const SAVE_KEY = 'echo_of_self_save_v1';
const LEGACY_CLEARED_KEY = 'echo_of_self_cleared_v1';

export const playerState = {
  chapter: 0,
  maxHp: 30,
  hp: 30,
  maxMp: 20,           // 스킬 사용에 쓰는 마나 (전투에서 턴마다 조금씩 회복)
  mp: 20,
  atk: 6,
  powerFragments: 0,   // 모은 '힘의 조각' 개수 (= 성장)
  skills: [],          // 전투에서 사용 가능한 스킬 이름 목록
  lastSkill: null,      // 마지막으로 사용한 스킬을 다음 메뉴에서도 선택한다
  flags: {},           // 스토리 진행 플래그 (enemy1_dead, ch3_unlocked 등)
  loopCount: 0,        // 챕터 3에서 같은 방을 맴돈 횟수
  justCleared: false,  // 방금 엔딩을 보고 타이틀로 돌아왔는지 여부 (영구 저장 대신 1회성 이스터에그로 동작)

  // 힘의 조각을 모을 때마다 성장한다
  addPowerFragment() {
    this.powerFragments++;
    this.atk += 2;
    this.maxHp += 10;
    this.maxMp += 5;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  },

  // 현재 게임에 존재하는 스킬만 습득한다.
  learnSkill(name) {
    if (Object.hasOwn(SKILL_INFO, name) && !this.skills.includes(name)) this.skills.push(name);
  },

  setFlag(key, value = true) { this.flags[key] = value; },
  getFlag(key) { return !!this.flags[key]; },

  // 현재 진행 상태를 localStorage에 체크포인트로 자동 저장한다 (1장 이상일 때만)
  save() {
    if (this.chapter < 1) return;
    try {
      const data = {
        chapter: this.chapter,
        maxHp: this.maxHp,
        hp: this.hp,
        maxMp: this.maxMp,
        mp: this.mp,
        atk: this.atk,
        powerFragments: this.powerFragments,
        skills: [...this.skills],
        lastSkill: this.lastSkill,
        flags: { ...this.flags },
        loopCount: this.loopCount
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 시크릿 모드 등 localStorage 접근 불가 환경 무시
    }
  },

  // 저장된 체크포인트 존재 여부를 반환한다
  hasSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return typeof data?.chapter === 'number' && data.chapter >= 1;
    } catch {
      return false;
    }
  },

  // 저장된 체크포인트의 챕터 번호를 조회한다 (타이틀 이어하기 표시용)
  getSavedChapter() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? (JSON.parse(raw)?.chapter ?? null) : null;
    } catch {
      return null;
    }
  },

  // 저장된 체크포인트를 불러와 현재 상태에 반영한다
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.chapter = data.chapter ?? 1;
      this.maxHp = data.maxHp ?? 30;
      this.hp = data.hp ?? this.maxHp;
      this.maxMp = data.maxMp ?? 20;
      this.mp = data.mp ?? this.maxMp;
      this.atk = data.atk ?? 6;
      this.powerFragments = data.powerFragments ?? 0;
      // 이전 저장의 삭제된 스킬은 제거하고 챕터·성장·진행 플래그는 그대로 유지한다.
      this.skills = Array.isArray(data.skills)
        ? [...new Set(data.skills.filter(name => Object.hasOwn(SKILL_INFO, name)))] : [];
      this.lastSkill = this.skills.includes(data.lastSkill) ? data.lastSkill : (this.skills[0] ?? null);
      this.flags = data.flags && typeof data.flags === 'object' ? { ...data.flags } : {};
      this.loopCount = data.loopCount ?? 0;
      return true;
    } catch {
      return false;
    }
  },

  // 엔딩 도달 시 저장 데이터를 정리한다
  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // 무시
    }
  },

  // 엔딩 도달 후 타이틀 복귀 시에만 디지털시계 이스터에그를 활성화한다
  // (localStorage에 영구 저장하지 않아 새로 접속하거나 새 게임을 시작하면 다시 모래시계로 돌아온다)
  markCleared() {
    this.justCleared = true;
    try {
      localStorage.removeItem(LEGACY_CLEARED_KEY);
    } catch {
      // 무시
    }
  },

  // 현재 타이틀에서 클리어 후 디지털시계를 보여줄지 여부를 반환한다
  isGameCleared() {
    try {
      localStorage.removeItem(LEGACY_CLEARED_KEY);
    } catch {
      // 무시
    }
    return !!this.justCleared;
  },

  reset() {
    this.chapter = 0;
    this.maxHp = 30;
    this.hp = 30;
    this.maxMp = 20;
    this.mp = 20;
    this.atk = 6;
    this.powerFragments = 0;
    this.skills = [];
    this.lastSkill = null;
    this.flags = {};
    this.loopCount = 0;
  }
};
