const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

function displayObject(x = 0, y = 0) {
  const object = {
    x, y, active: true, visible: true, text: '', scene: {},
    anims: { stop() {}, play() {} },
    setText(text) { this.text = text; return this; },
    setColor(color) { this.color = color; return this; },
    add() { return this; },
    on() { return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.active = false; }
  };
  for (const method of [
    'setTint', 'clearTint', 'setTintFill', 'setScale', 'setAlpha', 'setDepth',
    'setStrokeStyle', 'setOrigin', 'setAngle', 'setTexture', 'setVelocity',
    'disableInteractive', 'setInteractive', 'setFlipX', 'setClosePath'
  ]) object[method] = () => object;
  return object;
}

async function loadGame() {
  const storage = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    }
  });
  const phaser = {
    Scene: class {},
    Math: {
      Between: (min, max) => Math.max(min, Math.min(max, 0)),
      FloatBetween: () => 0,
      Wrap: (value, min, max) => ((value - min) % (max - min) + max - min) % (max - min) + min,
      Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) }
    },
    Input: { Keyboard: { JustDown: key => {
      const pressed = !!key?.pressed;
      if (key) key.pressed = false;
      return pressed;
    } } }
  };
  const sound = new Proxy({}, { get: () => () => {} });
  const modules = new Map();
  const load = async filename => {
    if (modules.has(filename)) return modules.get(filename);
    const isPhaser = filename === 'phaser';
    const isSound = filename.endsWith(`${path.sep}SoundSystem.js`);
    const module = isPhaser || isSound
      ? new vm.SyntheticModule([isPhaser ? 'default' : 'sound'], function () {
        this.setExport(isPhaser ? 'default' : 'sound', isPhaser ? phaser : sound);
      }, { context, identifier: filename })
      : new vm.SourceTextModule(await readFile(filename, 'utf8'), { context, identifier: filename });
    modules.set(filename, module);
    await module.link((specifier, parent) =>
      load(specifier === 'phaser' ? specifier : path.resolve(path.dirname(parent.identifier), specifier)));
    return module;
  };
  const imports = {};
  for (const [name, filename] of Object.entries({
    BattleScene: 'scenes/BattleScene.js',
    PrologueScene: 'scenes/PrologueScene.js',
    ExploreScene: 'scenes/ExploreScene.js',
    state: 'systems/PlayerState.js',
    data: 'data/chapters.js',
    story: 'data/dialogues.js'
  })) {
    const module = await load(path.join(root, 'src', filename));
    await module.evaluate();
    imports[name] = module.namespace.default ?? module.namespace;
  }
  const interMod = await load(path.join(root, 'src', 'objects/Interactable.js'));
  await interMod.evaluate();
  imports.Interactable = interMod.namespace.default;
  return { ...imports, playerState: imports.state.playerState, storage, phaser };
}

function attachScene(scene) {
  const pending = [];
  let now = 0;
  scene.time = {
    delayedCall(delay, callback) {
      const timer = { at: now + delay, callback, removed: false, remove() { this.removed = true; } };
      pending.push(timer);
      return timer;
    }
  };
  scene.tweens = {
    killTweensOf() {},
    add(config) {
      if (config.onComplete && config.repeat !== -1) {
        scene.time.delayedCall((config.delay ?? 0) + (config.duration ?? 0) * (config.yoyo ? 2 : 1), config.onComplete);
      }
      return config;
    }
  };
  scene.add = Object.fromEntries(['circle', 'image', 'rectangle', 'text', 'container', 'ellipse', 'arc']
    .map(type => [type, displayObject]));
  scene.cameras = { main: { flash() {}, shake() {}, fadeOut() {}, once() {} } };
  scene.scene = {
    start(...args) { scene.started = args; },
    restart(config) { scene.restarted = config; }
  };
  scene.dialogue = {
    active: false,
    start(lines, onComplete) {
      assert.ok(lines?.length, '대화가 비어 있으면 안 됩니다.');
      this.active = true;
      this.lines = lines;
      this.onComplete = onComplete;
    }
  };
  scene.finishDialogue = () => {
    assert.ok(scene.dialogue.active, '진행 중인 대화가 있어야 합니다.');
    scene.dialogue.active = false;
    scene.dialogue.onComplete?.();
  };
  // 실제 지연 순서로 실행하여 타격 전에 HP가 줄거나 연출 도중 반격하는 회귀를 잡는다.
  scene.advanceTime = duration => {
    const end = now + duration;
    let count = 0;
    while (pending.length) {
      pending.sort((a, b) => a.at - b.at);
      if (pending[0].at > end) break;
      assert.ok(count++ < 500, '타이머가 무한 반복하면 안 됩니다.');
      const timer = pending.shift();
      now = timer.at;
      if (!timer.removed) timer.callback();
    }
    if (Number.isFinite(end)) now = end;
  };
  scene.flushTimers = () => scene.advanceTime(Infinity);
  return scene;
}

function battle(game, chapter) {
  const enemy = game.data.CHAPTERS[chapter].objects.find(o => o.kind === 'enemy');
  const scene = attachScene(new game.BattleScene());
  const state = game.playerState;
  state.reset();
  state.chapter = chapter;
  state.atk = 20;
  state.maxHp = state.hp = 100;
  state.maxMp = state.mp = 55;
  state.skills = Object.keys(game.data.SKILL_INFO);
  scene.init({
    enemy, flag: enemy.flag, reward: enemy.reward, postDialogue: enemy.postDialogue,
    returnScene: 'ExploreScene', returnData: { chapter }
  });
  scene.logText = displayObject();
  scene.heroSprite = displayObject(140, 294);
  scene.enemySprite = displayObject(470, 156);
  scene.enemyAura = displayObject();
  scene.selector = displayObject();
  scene.menuItems = ['공격', '스킬', '방어'];
  scene.menuTexts = scene.menuItems.map(() => displayObject());
  scene.menuMode = 'main';
  scene.menuY = 382;
  scene.menuGap = 28;
  scene.updateEnemyHp = scene.updateStatus = scene.floatText = scene.impactFeedback = () => {};
  // 일반 흐름 테스트에서도 타격과 복귀 완료는 비동기 경계로 유지한다.
  scene.attackAnim = (choice, impact, done) => {
    const hits = game.data.SKILL_INFO[choice]?.hits ?? 1;
    for (let i = 0; i < hits; i++) scene.time.delayedCall(180 + i * 100, impact);
    scene.time.delayedCall(400 + hits * 100, done);
  };
  scene.guardAnim = () => {};
  return scene;
}

function village(game, epilogue = false) {
  const scene = attachScene(new game.PrologueScene());
  scene.init({ epilogue });
  scene.eventStarted = false;
  scene.player = { sprite: displayObject(320, 260), frozen: false, update() {} };
  scene.friend = {
    sprite: displayObject(400, 310), shadow: displayObject(), promptText: displayObject(),
    checkProximity: () => false,
    disable() { this.disabled = true; }
  };
  scene.friendName = displayObject();
  scene.goalText = displayObject();
  scene.goalArrow = displayObject();
  scene.villagers = [];
  scene.keyE = { pressed: false };
  scene.bossArrives = () => { scene.eventStarted = true; };
  return scene;
}

test('최종보스 체력 절반에서 플레이어가 살아 있어도 원군 이벤트가 시작된다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyHp = 230;
  scene.enemyCharged = true;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.finalEventDone, true);
  assert.equal(scene.enemyCharged, false);
  assert.equal(scene.turnLocked, true);
  assert.equal(game.playerState.hp, 100);
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.final_drain);
  assert.equal(scene.started, undefined);
});

test('한 번에 보스를 쓰러뜨릴 피해도 이벤트를 건너뛰지 않는다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  game.playerState.atk = 9999;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.enemyHp, 210);
  assert.equal(scene.finalEventDone, true);
  assert.equal(scene.started, undefined);
});

test('약점 스킬로 절반을 넘겨도 원군 이벤트가 시작되며 연타는 추가 MP를 쓰지 않는다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyHp = 230;
  scene.menuMode = 'skill';
  scene.selectSkill(0);
  scene.selectSkill(0);
  assert.equal(game.playerState.mp, 48);
  assert.equal(scene.enemyHp, 230);
  scene.flushTimers();
  assert.equal(scene.enemyHp, 210);
  assert.equal(scene.finalEventDone, true);
  assert.equal(game.playerState.hp, 100);
});

test('보스 체력이 절반보다 많으면 일반 턴 흐름을 유지한다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.enemyHp, 400);
  assert.equal(scene.finalEventDone, false);
  assert.equal(game.playerState.hp, 73);
  assert.equal(scene.turnLocked, false);
});

test('원군 합류는 한 번만 발생하고 이후 보스를 쓰러뜨리면 반전으로 넘어간다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyHp = 230;
  scene.selectMenu(0);
  scene.flushTimers();
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.final_allies);
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(game.playerState.atk, 24);
  assert.equal(scene.turnLocked, false);
  assert.equal(scene.enemyCharged, true, '2단계 첫 행동 전에 강공격을 예고해야 합니다.');
  scene.finalStand();
  assert.equal(scene.dialogue.active, false);
  scene.enemyHp = 1;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.started[0], 'StoryScene');
  assert.equal(scene.started[1].script, 'reveal');
  assert.equal(game.playerState.atk, 20);
});

test('보스에게 먼저 쓰러져도 원군 이벤트가 발생하며 재도전 버프는 누적되지 않는다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  game.playerState.hp = 1;
  scene.enemyTurn();
  scene.flushTimers();
  assert.equal(scene.finalEventDone, true);
  scene.finishDialogue();
  scene.flushTimers();
  scene.finishDialogue();
  scene.flushTimers();
  scene.onLose();
  scene.finishDialogue();
  assert.equal(scene.restarted.finalEventSeen, true);
  assert.equal(game.playerState.atk, 20);
  scene.init(scene.restarted);
  scene.finalStand();
  assert.equal(game.playerState.atk, 24);
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(scene.turnLocked, false);
});

test('일반 적의 승리와 보상 흐름은 유지된다', async () => {
  const game = await loadGame();
  const scene = battle(game, 1);
  scene.enemyHp = 1;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.enemy1_post);
  scene.finishDialogue();
  assert.equal(game.playerState.powerFragments, 1);
  scene.finishDialogue();
  assert.equal(scene.started[0], 'ExploreScene');
});

test('슬픈 그림자는 치명적인 피해에도 살아남고 곁에 있기 전에는 보상을 주지 않는다', async () => {
  const game = await loadGame();
  const scene = battle(game, 7);
  game.playerState.atk = 9999;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.enemyHp, 1);
  assert.equal(scene.sorrowReady, true);
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.sorrow_open);
  assert.equal(game.playerState.getFlag('enemy3_dead'), false);
  assert.equal(game.playerState.powerFragments, 0);
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(scene.menuItems.join(','), '곁에 있기');
  assert.equal(scene.menuTexts[1].visible, false);
  assert.equal(scene.menuTexts[2].visible, false);
});

test('곁에 있기는 확인키로 실행되며 연타해도 성장과 저장은 한 번만 처리된다', async () => {
  const game = await loadGame();
  const scene = battle(game, 7);
  scene.enemyHp = 50;
  scene.selectMenu(0);
  scene.flushTimers();
  scene.finishDialogue();
  scene.flushTimers();
  scene.confirmSel();
  scene.confirmSel();
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.sorrow_comfort);
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.enemy3_post);
  scene.finishDialogue();
  assert.equal(game.playerState.getFlag('sorrow_embraced'), true);
  assert.equal(game.playerState.getFlag('enemy3_dead'), true);
  assert.equal(game.playerState.powerFragments, 1);
  scene.onWin();
  scene.finishDialogue();
  assert.equal(game.playerState.powerFragments, 1);
  assert.equal(scene.started[1].chapter, 7);
  game.playerState.reset();
  assert.equal(game.playerState.load(), true);
  assert.equal(game.playerState.getFlag('sorrow_embraced'), true);
});

test('슬픔 전환 전에는 싸움이 이어지고 전환 뒤에는 차징과 추가 공격이 멈춘다', async () => {
  const game = await loadGame();
  const scene = battle(game, 7);
  scene.enemyHp = 74;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.sorrowReady, false);
  assert.equal(scene.enemyHp, 54);
  const hp = game.playerState.hp;
  scene.enemyCharged = true;
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.sorrowReady, true);
  assert.equal(scene.enemyCharged, false);
  assert.equal(game.playerState.hp, hp);
  scene.finishDialogue();
  scene.flushTimers();
  const enemyHp = scene.enemyHp;
  const mp = game.playerState.mp;
  scene.hitEnemy('공격');
  scene.selectSkill(0);
  scene.enemyTurn();
  assert.equal(scene.enemyHp, enemyHp);
  assert.equal(game.playerState.mp, mp);
  assert.equal(game.playerState.hp, hp);
});

test('마을 습격은 친구와의 약속과 대화 종료 이후에만 시작된다', async () => {
  const game = await loadGame();
  const scene = village(game);
  scene.update();
  assert.equal(scene.eventStarted, false);
  game.playerState.setFlag('village_promise');
  scene.uiBusy = true;
  scene.update();
  assert.equal(scene.eventStarted, false);
  scene.uiBusy = false;
  scene.update();
  assert.equal(scene.eventStarted, true);
});

test('친구와의 대화를 마치면 약속을 기록하고 광장 목표를 안내한다', async () => {
  const game = await loadGame();
  const scene = village(game);
  scene.talkToFriend();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.village_promise);
  assert.equal(game.playerState.getFlag('village_promise'), false);
  scene.finishDialogue();
  scene.flushTimers();
  assert.equal(game.playerState.getFlag('village_promise'), true);
  assert.equal(scene.friend.disabled, true);
  assert.match(scene.goalText.text, /광장/);
  assert.equal(scene.goalArrow.visible, true);
});

test('에필로그 이후 다시 시작한 프롤로그는 이전 조작 잠금을 물려받지 않는다', async () => {
  const game = await loadGame();
  const scene = village(game, true);
  scene.uiBusy = true;
  scene.enteringVillage = true;
  scene.unlockTimer = {};
  scene.init({});
  assert.equal(scene.epilogue, false);
  assert.equal(scene.uiBusy, false);
  assert.equal(scene.enteringVillage, false);
  assert.equal(scene.unlockTimer, null);
});

test('새 약속은 저장되며 에필로그에서 회수하고 기존 저장은 자연스러운 환영 대화를 쓴다', async () => {
  const game = await loadGame();
  const scene = village(game, true);
  scene.villagersRunToHero();
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.epilogue_village);
  game.playerState.setFlag('village_promise');
  game.playerState.chapter = 1;
  game.playerState.save();
  game.playerState.reset();
  assert.equal(game.playerState.load(), true);
  const replay = village(game, true);
  replay.villagersRunToHero();
  replay.flushTimers();
  assert.equal(replay.dialogue.lines, game.story.DIALOGUES.epilogue_promise);
});

test('반전 이전 대사와 표시 이름은 인물의 정체를 확정하지 않는다', async () => {
  const game = await loadGame();
  const beforeReveal = Object.entries(game.story.DIALOGUES)
    .filter(([key]) => key !== 'reveal2' && !key.startsWith('epilogue'));
  for (const [key, lines] of beforeReveal) {
    for (const line of lines) {
      assert.doesNotMatch(`${line.speaker} ${line.text}`,
        /내면의 나|미래의 나|나는 너다|네가 외면해 온, 너 자신|내가 지나온 감정|네가.*삼켜온 눈물|우리는.*감정들/,
        `${key}에서 정체를 너무 일찍 설명합니다.`);
    }
  }
  assert.equal(game.data.CHAPTERS[8].objects[0].name, '낯선 목소리');
  assert.doesNotMatch(game.data.CHAPTERS[8].lockedMsg, /나 자신/);
  assert.doesNotMatch(game.data.SKILL_INFO['마음의 눈'].desc, /자신을 마주한/);
});

test('추격 전에 나래의 상태를 확인하며 대화 사이에 조작 잠금이 풀리지 않는다', async () => {
  const game = await loadGame();
  const scene = village(game);
  scene.eventStarted = true;
  scene.bossLeaves = () => { scene.bossLeft = true; };
  scene.checkOnFriend();
  scene.flushTimers();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.village_aftermath);
  assert.equal(scene.player.frozen, true);
  assert.equal(scene.bossLeft, undefined);
  scene.finishDialogue();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.prologue2_boss);
  scene.flushTimers();
  assert.equal(scene.player.frozen, true);
  scene.finishDialogue();
  assert.equal(scene.bossLeft, true);
});

test('거울의 마지막 복선은 짧고 희미하며 정체를 설명하는 목소리가 없다', async () => {
  const game = await loadGame();
  const scene = attachScene(new game.ExploreScene());
  let effect;
  scene.tweens.add = config => { effect = config; };
  scene.showMirrorReflection({ x: 440, y: 150, dialogue: 'mirror3' });
  assert.ok(effect.alpha <= 0.3);
  assert.ok(effect.hold <= 250);
  assert.ok(game.story.DIALOGUES.mirror3.every(line => line.speaker === '나'));
  assert.doesNotMatch(game.story.DIALOGUES.mirror3.map(line => line.text).join(' '), /끝에서 기다리|내 그림자/);
});

test('모든 챕터와 컷신에서 참조하는 대화가 존재하고 얼굴 공개 후에만 반전이 나온다', async () => {
  const game = await loadGame();
  const { DIALOGUES, SCRIPTS } = game.story;
  for (const chapter of Object.values(game.data.CHAPTERS)) {
    const references = [chapter.introDialogue, chapter.loopDialogue];
    for (const object of chapter.objects || []) {
      references.push(object.dialogue, object.preDialogue, object.postDialogue);
    }
    for (const key of references.filter(Boolean)) assert.ok(DIALOGUES[key]?.length, key);
  }
  for (const script of Object.values(SCRIPTS)) {
    for (const command of script) {
      if (command.type === 'dialogue') assert.ok(DIALOGUES[command.key]?.length, command.key);
    }
  }
  const swapIndex = SCRIPTS.reveal.findIndex(command => command.type === 'swap');
  const revealIndex = SCRIPTS.reveal.findIndex(command => command.key === 'reveal2');
  assert.ok(swapIndex >= 0 && swapIndex < revealIndex);
  for (const [key, lines] of Object.entries(DIALOGUES)) {
    for (const line of lines) {
      assert.equal(typeof line.speaker, 'string', key);
      assert.ok(typeof line.text === 'string' && line.text.trim(), key);
    }
  }
});

test('재도전 원군 대사는 생존 상태에서도 자연스럽고 정체를 누설하지 않는다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.finalEventSeen = true;
  scene.finalStand();
  assert.equal(scene.dialogue.lines, game.story.DIALOGUES.final_return);
  const lines = [...scene.dialogue.lines, ...game.story.DIALOGUES.final_allies];
  assert.doesNotMatch(lines.map(line => `${line.speaker} ${line.text}`).join(' '), /내면의 나|일어나라|일어날게/);
});

test('모든 기술은 접촉할 때 피해를 주고 마지막 타격과 복귀가 끝난 뒤에만 반격한다', async () => {
  const game = await loadGame();
  for (const choice of ['공격', ...Object.keys(game.data.SKILL_INFO)]) {
    const scene = battle(game, 9);
    const before = scene.enemyHp;
    const expected = scene.attackDamage(choice);
    const events = [];
    scene.attackAnim = game.BattleScene.prototype.attackAnim;
    scene.impactFeedback = () => events.push({ type: 'hit', hp: scene.enemyHp });
    scene.enemyTurn = () => events.push({ type: 'enemy', hp: scene.enemyHp });
    scene.hitEnemy(choice);
    assert.equal(scene.enemyHp, before, `${choice}: 선택 직후에는 HP가 변하면 안 됩니다.`);
    assert.equal(scene.turnLocked, true);
    scene.flushTimers();
    assert.equal(scene.enemyHp, before - expected, choice);
    assert.equal(events.filter(e => e.type === 'hit').length, game.data.SKILL_INFO[choice]?.hits ?? 1, choice);
    assert.equal(events.at(-1).type, 'enemy', choice);
    assert.equal(events.filter(e => e.type === 'enemy').length, 1, choice);
    assert.equal(scene.attackPending, false, choice);
  }
});

test('적의 피해와 방어 시 MP 회복은 접촉까지 지연되고 비방어 시에는 자연 MP 회복이 없다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  game.playerState.mp = 10;
  scene.enemyTurn();
  scene.advanceTime(189);
  assert.equal(game.playerState.hp, 100);
  assert.equal(game.playerState.mp, 10);
  scene.advanceTime(1);
  assert.equal(game.playerState.hp, 73);
  assert.equal(game.playerState.mp, 10, '비방어 시 자연 MP 회복은 없어야 합니다.');
  assert.equal(scene.turnLocked, true);
  scene.flushTimers();
  assert.equal(scene.turnLocked, false);

  // 방어 시 적 타격 접촉 순간에 MP +10 회복
  scene.turnCount = 0;
  scene.guarding = true;
  scene.enemyTurn();
  scene.advanceTime(189);
  assert.equal(game.playerState.mp, 10);
  scene.advanceTime(1);
  assert.equal(game.playerState.mp, 20);
  scene.flushTimers();
});

test('방어 상태를 반영한 예상 피해가 실제 피해와 같고 힘의 일격은 방어를 돌파한다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyGuarding = true;
  scene.focused = true;
  scene.enemyTurn = () => {};
  const expected = scene.attackDamage('힘의 일격');
  assert.ok(scene.attackDamage('힘의 일격', -1) <= expected);
  assert.ok(scene.attackDamage('힘의 일격', 1) >= expected);
  assert.ok(expected > 20 * 1.8 * 1.5 * 1.25, '방어 중인 적에게는 추가 피해를 줍니다.');
  const before = scene.enemyHp;
  scene.hitEnemy('힘의 일격');
  scene.flushTimers();
  assert.equal(before - scene.enemyHp, expected);
  assert.equal(scene.enemyGuarding, false);
  assert.equal(scene.focused, false);
});

test('마음의 눈의 집중은 방어 동안 유지되고 다음 공격 한 번에 소비되며 연속 동일 스킬은 감쇠된다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyTurn = () => { scene.turnLocked = false; scene.clearGuard(); };
  const baseMindEyeDmg = scene.attackDamage('마음의 눈');
  scene.openSkillMenu();
  scene.selectSkill(game.playerState.skills.indexOf('마음의 눈'));
  scene.flushTimers();
  assert.equal(scene.focused, true);
  assert.ok(scene.attackDamage('마음의 눈') < baseMindEyeDmg, '보유 스킬이 2종 이상일 때 연속 동일 스킬은 감쇠(×0.65)되며 집중도 받지 않습니다.');
  scene.openSkillMenu();
  scene.selectSkill(game.playerState.skills.indexOf('마음의 눈'));
  scene.flushTimers();
  assert.equal(scene.focused, true);
  assert.equal(scene.attackDamage('공격'), 25, '연속 사용해도 집중 증폭량은 +25%로 중첩되지 않습니다.');
  scene.selectMenu(2);
  scene.flushTimers();
  assert.equal(scene.focused, true);
  assert.equal(scene.prevSkillUsed, null, '방어 후에는 연속 스킬 감쇠가 초기화됩니다.');
  assert.equal(scene.attackDamage('공격'), 25);
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.focused, false);
  assert.equal(scene.attackDamage('공격'), 20);
});

test('파동은 다른 행동 두 번 후 재사용되며 부족·재충전 안내는 열린 창에서 보인다', async () => {
  const game = await loadGame();
  const scene = battle(game, 9);
  scene.enemyTurn = () => { scene.turnLocked = false; scene.clearGuard(); };
  const index = game.playerState.skills.indexOf('심연의 파동');
  scene.openSkillMenu();
  game.playerState.mp = 0;
  scene.selectSkill(index);
  assert.match(scene.skillDescText.text, /마나 부족/);
  assert.equal(scene.menuMode, 'skill');
  assert.equal(scene.turnLocked, false);
  game.playerState.mp = 55;
  scene.selectSkill(index);
  scene.flushTimers();
  assert.equal(scene.burstCooldown, 2);
  assert.equal(game.playerState.mp, 37);
  scene.openSkillMenu();
  assert.equal(scene.skillIndex, index, '마지막 사용 기술을 기억해야 합니다.');
  scene.selectSkill(index);
  assert.match(scene.skillDescText.text, /다른 행동 2회/);
  assert.equal(game.playerState.mp, 37);
  scene.selectMenu(2);
  scene.flushTimers();
  assert.equal(scene.burstCooldown, 1);
  scene.selectMenu(0);
  scene.flushTimers();
  assert.equal(scene.burstCooldown, 0);
  assert.equal(scene.skillUnavailable('심연의 파동'), '');
});

test('이전 저장에서 삭제된 기술만 정리하고 진행·능력치·보유 기술은 유지한다', async () => {
  const game = await loadGame();
  game.storage.set('echo_of_self_save_v1', JSON.stringify({
    chapter: 8, maxHp: 90, hp: 72, maxMp: 50, mp: 35, atk: 18, powerFragments: 6,
    skills: ['힘의 일격', '잔상 베기', '마음의 눈', '시간의 칼날'],
    lastSkill: '시간의 칼날', flags: { enemy3_dead: true, sorrow_embraced: true }
  }));
  assert.equal(game.playerState.load(), true);
  assert.equal(game.playerState.chapter, 8);
  assert.equal(game.playerState.hp, 72);
  assert.equal(game.playerState.atk, 18);
  assert.equal(game.playerState.powerFragments, 6);
  assert.equal(game.playerState.skills.join(','), '힘의 일격,잔상 베기,마음의 눈');
  assert.equal(game.playerState.lastSkill, '힘의 일격');
  assert.equal(game.playerState.getFlag('sorrow_embraced'), true);
  game.playerState.save();
  assert.doesNotMatch(game.storage.get('echo_of_self_save_v1'), /시간의 칼날/);
  for (const chapter of Object.values(game.data.CHAPTERS)) {
    for (const object of chapter.objects ?? []) {
      if (object.reward?.skill) assert.ok(game.data.SKILL_INFO[object.reward.skill]);
    }
  }
});

test('탐험과 마을에서 E·Space·Enter가 조사되며 대화 중 입력은 재사용되지 않는다', async () => {
  const game = await loadGame();
  for (const key of ['keyE', 'keySpace', 'keyEnter']) {
    const scene = attachScene(new game.ExploreScene());
    scene.player = { update() {}, sprite: {}, frozen: false };
    scene[key] = { pressed: true };
    let count = 0;
    scene.interactables = [{ checkProximity: () => true, action: () => { count++; } }];
    scene.update();
    assert.equal(count, 1, key);
    scene[key].pressed = true;
    scene.update();
    assert.equal(count, 1);
    assert.equal(scene[key].pressed, false);
    const town = village(game);
    town.friend.checkProximity = () => true;
    town.friend.action = () => { count++; };
    town[key] = { pressed: true };
    town.update();
    assert.equal(count, 2, key);
  }
});

test('정상 성장과 예고 방어로 모든 전투를 완료하며 5장 순서를 바꿔도 막히지 않는다', async () => {
  const game = await loadGame();
  // 챕터, 해당 방의 적 순번, 입장 시 조각 수, 보유 스킬 수
  const encounters = [[1, 0, 0, 0], [2, 0, 1, 1], [5, 0, 3, 3], [5, 1, 4, 3],
    [5, 1, 3, 3], [5, 0, 4, 3], [7, 0, 5, 3], [9, 0, 7, 4]];
  for (const [chapter, index, fragments, skillCount] of encounters) {
    for (let seed = 1; seed <= 20; seed++) {
      let random = seed;
      game.phaser.Math.Between = (min, max) => {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        return min + Math.floor(random / 4294967296 * (max - min + 1));
      };
      const scene = battle(game, chapter), state = game.playerState;
      const enemy = game.data.CHAPTERS[chapter].objects.filter(o => o.kind === 'enemy')[index];
      state.reset();
      state.chapter = chapter;
      for (let i = 0; i < fragments; i++) state.addPowerFragment();
      state.skills = Object.keys(game.data.SKILL_INFO).slice(0, skillCount);
      scene.init({ enemy, flag: enemy.flag, reward: enemy.reward, postDialogue: enemy.postDialogue });
      let won = false, turns = 0, guards = 0;
      scene.onWin = () => { won = true; scene.battleResolved = true; };
      scene.onLose = () => { scene.battleResolved = true; };
      while (!scene.battleResolved && turns < 20) {
        if (scene.sorrowReady) scene.comfortSorrow();
        else if (scene.enemyCharged) {
          scene.selectMenu(2);
          guards++;
        } else {
          const choices = (chapter >= 2 ? [] : ['공격'])
            .concat(state.skills.filter(name => !scene.skillUnavailable(name)));
          if (!choices.length) {
            scene.selectMenu(scene.menuItems.indexOf('방어'));
            guards++;
          } else {
            choices.sort((a, b) => scene.attackDamage(b) - scene.attackDamage(a));
            if (choices[0] === '공격') scene.selectMenu(0);
            else {
              scene.menuMode = 'skill';
              scene.selectSkill(state.skills.indexOf(choices[0]));
            }
          }
        }
        scene.flushTimers();
        while (scene.dialogue.active) {
          scene.finishDialogue();
          scene.flushTimers();
        }
        turns++;
      }
      assert.ok(won, `${enemy.name}, 조각 ${fragments}, 시드 ${seed}`);
      assert.ok(turns <= 12, `${enemy.name}: 전투가 불필요하게 길어지면 안 됩니다.`);
      if (chapter >= 2) assert.ok(guards > 0, `${enemy.name}: 주요 패턴을 경험해야 합니다.`);
      if (enemy.finale) assert.equal(scene.finalEventDone, true);
    }
  }
});

test('방어 선택 시 최대 체력의 일부를 회복하며 잠긴 문은 페이드아웃 없이 즉시 안내한다', async () => {
  const game = await loadGame();
  const scene = battle(game, 5);
  scene.enemyTurn = () => {};
  game.playerState.maxHp = 60;
  game.playerState.hp = 40;
  scene.selectMenu(2);
  assert.ok(game.playerState.hp > 40 && game.playerState.hp <= 60);
  assert.match(scene.logText.text, /HP \+/);

  const explore = attachScene(new game.ExploreScene());
  explore.chapter = 1;
  explore.conf = game.data.CHAPTERS[1];
  explore.player = { sprite: displayObject(200, 110), shadow: displayObject(), frozen: false };
  let fadedOut = false;
  explore.cameras.main.fadeOut = () => { fadedOut = true; };
  explore.onDoor();
  assert.equal(fadedOut, false, '잠긴 문은 카메라 페이드아웃 없이 즉시 대사를 띄워야 합니다.');
  assert.equal(explore.player.sprite.y, 132);
  assert.equal(explore.dialogue.active, true);
});

test('큰 오브젝트의 발밑 거리 판정과 집중 오라 동기화가 정상 동작한다', async () => {
  const game = await loadGame();
  const scene = attachScene(new game.BattleScene());
  scene.heroSprite = displayObject(140, 294);
  scene.focused = true;
  scene.updateCombatHints();
  assert.ok(scene.focusAura, '집중 활성화 시 오라 링이 생성되어야 합니다.');
  scene.focused = false;
  scene.updateCombatHints();
  assert.equal(scene.focusAura, null, '집중 해제 시 오라 링이 정리되어야 합니다.');

  const dummyScene = {
    add: {
      sprite: (x, y) => {
        const obj = displayObject(x, y);
        obj.displayWidth = 48;
        obj.displayHeight = 120;
        return obj;
      },
      ellipse: displayObject,
      text: displayObject
    },
    physics: { add: { existing(s) { s.body = { setSize() { return this; }, setOffset() { return this; } }; } } }
  };
  const inter = new game.Interactable(dummyScene, 320, 150, 'mirror', 'E: 조사', () => {}, { radius: 40 });
  const player = { sprite: { x: 320, y: 196 } }; // 중심 거리는 46(>40)이지만 발밑 거리는 가까움
  assert.equal(inter.checkProximity(player), true);
});

test('1장부터 목표창이 표시되며 3장은 시계를 직접 언급하지 않고 주위를 둘러보자고 안내한다', async () => {
  const game = await loadGame();
  const state = game.playerState;

  for (let ch = 1; ch <= 9; ch++) {
    state.reset();
    const explore = attachScene(new game.ExploreScene());
    explore.init({ chapter: ch });
    explore.conf = game.data.CHAPTERS[ch];
    explore.spawnObject = () => {};
    explore.setupChapter();
    assert.ok(explore.goalText, `${ch}장에 목표창이 생성되어야 합니다.`);
    assert.match(explore.goalText.text, /^목표\n/, `${ch}장 목표창 헤더 확인`);
    if (ch === 3) {
      assert.doesNotMatch(explore.goalText.text, /시계/, '3장 목표창은 시계를 직접 언급하면 안 됩니다.');
      assert.match(explore.goalText.text, /\[ \] 주위를 둘러보자/);
      state.setFlag('ch3_unlocked');
      explore.refreshGoals();
      assert.match(explore.goalText.text, /\[✓\] 주위를 둘러보자/);
    }
  }

  // 1장 적 처치 반영 확인
  state.reset();
  const ch1 = attachScene(new game.ExploreScene());
  ch1.init({ chapter: 1 });
  ch1.conf = game.data.CHAPTERS[1];
  ch1.spawnObject = () => {};
  ch1.setupChapter();
  assert.match(ch1.goalText.text, /\[ \] 불안한 그림자 마주하기 \(E\)/);
  state.setFlag('enemy1_dead');
  ch1.refreshGoals();
  assert.match(ch1.goalText.text, /\[✓\] 불안한 그림자 마주하기 \(E\)/);

  // 6장 거울 진행도 반영 확인
  state.reset();
  const ch6 = attachScene(new game.ExploreScene());
  ch6.init({ chapter: 6 });
  ch6.conf = game.data.CHAPTERS[6];
  ch6.spawnObject = () => {};
  ch6.setupChapter();
  assert.match(ch6.goalText.text, /\[ \] 거울 들여다보기 \(0\/3\) \(E\)/);
  state.setFlag('ch6_m1');
  state.setFlag('ch6_m2');
  state.setFlag('ch6_m3');
  ch6.refreshGoals();
  assert.match(ch6.goalText.text, /\[✓\] 거울 들여다보기 \(3\/3\) \(E\)/);
});

test('전투 도입부는 시계 장면과 전투 준비중 문구를 띄우며 종료 전까지 전투 행동을 차단한다', async () => {
  const game = await loadGame();
  const state = game.playerState;
  state.reset();

  const scene = battle(game, 1);
  const initialHp = scene.enemyHp;
  scene.playBattleIntro();

  assert.equal(scene.introActive, true);
  assert.equal(scene.turnLocked, true);
  assert.match(scene.introPrepText.text, /전투 준비중/);

  // 대화 넘김 키 연타로 공격이 실행되지 않아야 함
  scene.confirmSel();
  scene.selectMenu(0);
  assert.equal(scene.enemyHp, initialHp, '전투 도입부 중에는 공격이 실행되면 안 됩니다.');

  // 도입부 종료 후 조작 잠금 해제 및 공격 가능 확인
  scene.advanceTime(1200);
  assert.equal(scene.introActive, true, '1.25~1.5초 유지 시간 동안에는 도입부가 유지되어야 합니다.');
  scene.advanceTime(600);
  assert.equal(scene.introActive, false);
  assert.equal(scene.turnLocked, false);

  // 각 장을 넘어갈수록 옛날 시계에서 현대 시계로 진화하는지 확인
  const checks = [
    { ch: 1, flags: {}, expected: '해시계' },
    { ch: 2, flags: {}, expected: '물시계' },
    { ch: 5, flags: {}, expected: '모래시계' },
    { ch: 5, flags: { rage_dead: true }, expected: '회중시계' },
    { ch: 7, flags: {}, expected: '아날로그시계' },
    { ch: 9, flags: {}, expected: '디지털시계' }
  ];
  for (const { ch, flags, expected } of checks) {
    const s = battle(game, ch);
    for (const [k, v] of Object.entries(flags)) state.setFlag(k, v);
    assert.equal(s.getBattleClockSpec().name, expected, `${ch}장 시계 종류 확인`);
  }

  // 각 장의 방에 놓인 시계가 다음 장으로 넘어갈 때마다 옛날 시계에서 현대 시계로 바뀌는지 확인
  const explore = attachScene(new game.ExploreScene());
  const expectedRoomClocks = [
    '해시계', '물시계', '모래시계', '촛대시계', '회중시계', '괘종시계', '아날로그시계', '플립시계', '디지털시계'
  ];
  const actualRoomClocks = [];
  for (let ch = 1; ch <= 9; ch++) {
    actualRoomClocks.push(explore.getRoomClockSpec(ch).name);
  }
  assert.deepEqual(actualRoomClocks, expectedRoomClocks);

  // 1장(스킬 미습득)은 기본 공격을 포함하고, 2장 이후(스킬 습득 후)에는 [스킬, 방어]만 표시하는지 확인
  state.reset();
  const b1 = battle(game, 1);
  state.skills = [];
  assert.equal(b1.getInitialMenuItems().join(','), '공격,스킬,방어');
  const b2 = battle(game, 2);
  assert.equal(b2.getInitialMenuItems().join(','), '스킬,방어');
  state.mp = 0;
  assert.match(b2.skillUnavailable('힘의 일격'), /방어로 MP를 회복하세요 \(Q: 뒤로\)/);
});




