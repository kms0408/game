import Phaser from 'phaser';
import { playerState } from '../systems/PlayerState.js';

// 부트 씬 — 외부 에셋 없이 캔버스로 픽셀 스프라이트를 프로시저럴 생성한다.
// 모든 적은 주인공과 동일한 실루엣의 색 변형이다. ("적 = 자기 자신" 반전의 시각적 복선)

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// 16x16 캐릭터 그리기 — dir: down/up/left/right, walk: 걷기 프레임(0/1)
// 감성 판타지 후드 여행자 디자인: 깊은 후드 + 따뜻한 얼굴(또는 그림자 얼굴) + 빛나는 두 눈 + 망토/스카프
function drawCharacter(ctx, o = {}) {
  const {
    dir = 'down', walk = 0,
    outline = '#14121c', helm = '#2d3148', plate = '#e8cbb1',
    cloth = '#4b5578', accent = '#ffe9a8', eye = '#241e2c', legs = '#282a3a',
    horns = false, scarf = false
  } = o;

  // 후드(두건) 외곽과 윗부분 주름
  px(ctx, 4, 0, 8, 1, outline);
  px(ctx, 3, 1, 10, 6, outline);
  px(ctx, 4, 1, 8, 3, helm);
  px(ctx, 5, 1, 6, 1, accent);                                  // 후드 앞머리 은은한 포인트 라인

  // 후드 안쪽 얼굴 (up은 뒷모습이므로 후드 천으로 덮인다)
  if (dir === 'up') {
    px(ctx, 4, 3, 8, 3, helm);
    px(ctx, 5, 4, 6, 2, outline);                               // 후드 뒷주름 음영
  } else {
    px(ctx, 4, 3, 8, 1, outline);                               // 후드 처마 그늘
    px(ctx, 4, 4, 8, 2, plate);                                 // 얼굴/가면 영역
  }

  // 눈 — 방향에 따라 위치가 달라진다 (2픽셀 세로 눈망울 또는 발광 안광)
  if (dir === 'down') {
    px(ctx, 5, 4, 2, 2, eye); px(ctx, 9, 4, 2, 2, eye);
  } else if (dir === 'left') {
    px(ctx, 4, 4, 2, 2, eye);
  } else if (dir === 'right') {
    px(ctx, 10, 4, 2, 2, eye);
  }

  // 보스용 그림자 왕관 뿔
  if (horns) {
    px(ctx, 2, 0, 2, 3, outline); px(ctx, 12, 0, 2, 3, outline);
    px(ctx, 1, -1, 1, 2, outline); px(ctx, 14, -1, 1, 2, outline);
  }

  // 붉은/따뜻한 스카프 — 목을 감싸고 옆·걸을 때 뒤로 나부낀다
  const scarfColor = scarf === true ? '#c85a5a' : (scarf || cloth);
  if (scarf) {
    px(ctx, 4, 6, 8, 2, scarfColor);
    if (dir === 'left') { px(ctx, 12, 6, 3, 2, scarfColor); px(ctx, 14, 7, 2, 2, scarfColor); }
    else if (dir === 'right') { px(ctx, 1, 6, 3, 2, scarfColor); px(ctx, 0, 7, 2, 2, scarfColor); }
    else if (walk === 1) { px(ctx, 12, 6, 2, 3, scarfColor); }
    else { px(ctx, 10, 7, 2, 2, scarfColor); }
  } else {
    px(ctx, 4, 6, 8, 1, outline);
  }

  // 몸통(여행자 외투/망토)과 소매 — 망토 여밈선과 어깨 브로치 포인트
  px(ctx, 3, 7, 10, 7, outline);
  px(ctx, 4, 8, 8, 5, cloth);
  px(ctx, 3, 8, 1, 4, cloth); px(ctx, 12, 8, 1, 4, cloth);
  px(ctx, 7, 8, 2, 5, helm);                                    // 외투 중앙 여밈
  px(ctx, 5, 8, 1, 1, accent); px(ctx, 10, 8, 1, 1, accent);    // 망토 금장 단추

  // 부츠/다리 — 걷기 프레임에 따라 보폭이 달라진다
  if (walk === 0) {
    px(ctx, 5, 14, 2, 2, legs); px(ctx, 9, 14, 2, 2, legs);
  } else {
    px(ctx, 4, 14, 2, 2, legs); px(ctx, 10, 14, 2, 2, legs);
  }
}

function makeTexture(scene, key, w, h, drawFn) {
  const tex = scene.textures.createCanvas(key, w, h);
  drawFn(tex.getContext());
  tex.refresh();
}

// 챕터별 탐험 배경 — 뒷벽 창문 너머로 시간대별 도시 풍경이 보이는 고풍스러운 실내 방
// p: { wall, trim, floorA, floorB, sky:[stops], bld, lit, sun, moon, stars, glow }
function drawRoomBg(ctx, p) {
  // 바닥 — 실내 석재 타일/마루를 격자 형태로 깔아 바깥 마을(풀밭)과 확실히 구분한다
  ctx.fillStyle = p.floorA;
  ctx.fillRect(0, 0, 640, 480);

  const tileW = 32, tileH = 24;
  for (let row = 4; row < 20; row++) {
    const y = row * tileH;
    const offset = (row % 2) * (tileW / 2);
    for (let col = -1; col < 21; col++) {
      const x = col * tileW + offset;
      // 타일마다 미세한 명도 변화와 체크 톤 교차
      ctx.fillStyle = (row + col) % 2 === 0 ? p.floorA : p.floorB;
      ctx.fillRect(x, y, tileW, tileH);
      // 타일 윗변·왼변 하이라이트와 줄눈(메지) 음영
      ctx.fillStyle = 'rgba(255,245,230,0.05)';
      ctx.fillRect(x + 1, y + 1, tileW - 2, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, tileW, 1);
      ctx.fillRect(x, y, 1, tileH);
    }
  }
  // 석재 표면의 미세한 결 점
  for (let i = 0; i < 220; i++) {
    const dx = (i * 61) % 640, dy = 118 + (i * 43) % 346;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,240,210,0.06)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(dx, dy, 2, 2);
  }

  // 뒷벽(상단 118px) + 세로 웨인스코팅(벽 패널) 디테일 + 바닥 경계 몰딩
  ctx.fillStyle = p.wall;
  ctx.fillRect(0, 0, 640, 118);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let wx = 32; wx < 640; wx += 48) {
    ctx.fillRect(wx, 8, 2, 102);
  }
  ctx.fillStyle = p.trim;
  ctx.fillRect(0, 110, 640, 8);
  ctx.fillStyle = 'rgba(255,235,200,0.12)';
  ctx.fillRect(0, 110, 640, 2);

  // 장식 요소 배치 — 챕터마다 다른 구성으로 방 분위기를 바꾼다
  //   win: 창문(도시 풍경), frame: 벽에 걸린 액자, rug: 바닥 러그
  let winIdx = 0;
  for (const d of p.decor || []) {
    if (d.t === 'win') drawWindow(ctx, p, d.x, winIdx++);
    else if (d.t === 'frame') drawFrame(ctx, d);
    else if (d.t === 'rug') drawRug(ctx, d);
  }

  // 창문에서 실내 바닥으로 비스듬히 쏟아지는 빛줄기(God ray)와 창틀 바닥 반사광
  for (const d of p.decor || []) {
    if (d.t === 'win') drawWindowLight(ctx, p, d.x);
  }

  // 사이드·하단 벽 테두리 (충돌 벽과 같은 위치의 시각 장식)
  ctx.fillStyle = p.trim;
  ctx.fillRect(0, 0, 16, 480);
  ctx.fillRect(624, 0, 16, 480);
  ctx.fillRect(0, 464, 640, 16);

  // 방 중앙에 떨어지는 챕터 분위기의 빛 웅덩이
  const gl = ctx.createRadialGradient(320, 300, 40, 320, 300, 250);
  gl.addColorStop(0, p.glow);
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, 640, 480);

  // 뒷벽 아래 그림자 — 바닥과 벽의 입체감
  const sh = ctx.createLinearGradient(0, 118, 0, 170);
  sh.addColorStop(0, 'rgba(0,0,0,0.38)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 118, 640, 52);
}

// 창문 너머의 햇살/달빛이 실내 바닥 타일 위로 사다리꼴로 쏟아지는 효과
function drawWindowLight(ctx, p, wx) {
  ctx.save();
  const rayGrad = ctx.createLinearGradient(0, 114, 0, 290);
  rayGrad.addColorStop(0, p.glow || 'rgba(255,235,200,0.14)');
  rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rayGrad;
  ctx.beginPath();
  ctx.moveTo(wx, 118);
  ctx.lineTo(wx + 120, 118);
  ctx.lineTo(wx + 148, 285);
  ctx.lineTo(wx - 28, 285);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 벽 창문 — 창 너머로 챕터 시간대의 도시 풍경이 보인다 (wx: 창 왼쪽 x, winIdx: 방 안 창문 순번)
// 창문이 2개인 방에서도 해/달은 하나만 뜨고, 창마다 서로 다른 도시 스카이라인이 이어져 보이도록 그린다
function drawWindow(ctx, p, wx, winIdx = 0) {
  ctx.fillStyle = '#14101e';
  ctx.fillRect(wx - 4, 10, 128, 96);                    // 창틀

  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, 14, 120, 88);
  ctx.clip();

  const g = ctx.createLinearGradient(0, 14, 0, 102);
  p.sky.forEach((c, i) => g.addColorStop(i / (p.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(wx, 14, 120, 88);

  if (p.stars) {                                        // 별 (창문 위치마다 다른 별자리 배치)
    ctx.fillStyle = p.stars;
    const sSeed = wx * 17 + winIdx * 53 + 31;
    for (let i = 0; i < 14; i++) {
      const sx = wx + 6 + ((sSeed + i * 43 + i * i * 7) % 108);
      const sy = 17 + ((sSeed + i * 29 + i * 13) % 34);
      const sz = (i + winIdx) % 3 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  // 해와 달은 하늘에 하나뿐이므로 첫 번째 창문(winIdx === 0)에서만 보이게 한다
  if (winIdx === 0) {
    if (p.sun) { ctx.fillStyle = p.sun; ctx.fillRect(wx + 78, 56, 26, 22); }   // 낮은 해
    if (p.moon) { ctx.fillStyle = p.moon; ctx.fillRect(wx + 88, 24, 12, 12); } // 달
  }

  // 건물 실루엣 + 건물 내부에만 켜지는 창문 불빛 (창문 위치마다 고유한 스카이라인 생성)
  let bx = wx;
  let bIdx = 0;
  const bSeed = wx * 23 + winIdx * 101;
  while (bx < wx + 120) {
    const bw = 12 + ((bSeed + bIdx * 37 + bx * 7) % 16);
    const bh = 18 + ((bSeed + bIdx * 67 + bx * 13) % 42);
    const by = 102 - bh;
    ctx.fillStyle = p.bld;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = p.lit;
    for (let wy = by + 5; wy < 98; wy += 8) {
      for (let lx = bx + 3; lx < bx + bw - 3; lx += 5) {
        if (((lx * 19 + wy * 31 + bSeed) % 11) < 3) {
          ctx.fillRect(lx, wy, 2, 3);
        }
      }
    }
    bx += bw + 2;
    bIdx++;
  }

  // 창살 — 바깥 풍경보다 앞쪽(실내 쪽)에 그려져야 자연스럽다
  ctx.fillStyle = '#14101e';
  ctx.fillRect(wx + 59, 14, 2, 88);
  ctx.fillRect(wx, 56, 120, 2);
  ctx.restore();
}

// 벽에 걸린 액자 — 작은 풍경화가 들어 있는 그림틀
function drawFrame(ctx, d) {
  const fx = d.x - d.w / 2, fy = d.y - d.h / 2;
  px(ctx, fx - 3, fy - 3, d.w + 6, d.h + 6, '#4a3826');          // 액자 외곽
  px(ctx, fx - 1, fy - 1, d.w + 2, d.h + 2, '#c9a86a');          // 금색 내부 몰딩
  const g = ctx.createLinearGradient(0, fy, 0, fy + d.h);
  g.addColorStop(0, d.art[0]); g.addColorStop(1, d.art[1]);
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, d.w, d.h);                                // 그림 하늘
  ctx.fillStyle = 'rgba(18,14,28,0.5)';
  ctx.fillRect(fx, fy + d.h * 0.62, d.w, d.h * 0.38);            // 그림 언덕
  ctx.fillStyle = '#ffe9b0';
  ctx.fillRect(fx + d.w * 0.62, fy + 4, 4, 4);                   // 그림 속 해/달
}

// 바닥 러그 — 중심 (x,y)에 깔린 직사각 카펫
function drawRug(ctx, d) {
  const rx = d.x - d.w / 2, ry = d.y - d.h / 2;
  ctx.fillStyle = d.c;
  ctx.fillRect(rx, ry, d.w, d.h);
  ctx.strokeStyle = 'rgba(255,233,168,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 5, ry + 5, d.w - 10, d.h - 10);            // 러그 테두리 문양
}

// 모래시계 한 프레임 (40x56) — phase(0~1)가 커질수록 위 모래가 줄어들고
// 아래 모래 언덕이 자라나며, 목 사이로 모래 줄기가 떨어진다.
function drawSandClock(ctx, phase) {
  const cx = 20, neck = 28, glassTop = 6, glassBot = 50;
  const sand = '#e8c878', sandDark = '#c9a050', sandLight = '#fff0c0';

  // 유리 반폭 곡선 — 목(중앙)에서 전구부로 갈수록 볼록하게 넓어진다
  const hw = y => {
    const t = y < neck
      ? (neck - y) / (neck - glassTop)
      : (y - neck) / (glassBot - neck);
    return 2.5 + 10 * Math.pow(Math.max(0, Math.min(1, t)), 1.25);
  };

  // ── 프레임: 상하 캡 + 좌우 기둥 (황동빛 나무) ──
  px(ctx, 7, 0, 26, 1, '#e8c882');                                  // 상단 캡 광택
  px(ctx, 4, 1, 32, 2, '#a8814a'); px(ctx, 2, 3, 36, 2, '#a8814a');
  px(ctx, 4, 5, 32, 1, '#6a4a22');                                  // 캡 그림자
  px(ctx, 4, 51, 32, 1, '#6a4a22');
  px(ctx, 2, 52, 36, 2, '#a8814a'); px(ctx, 4, 54, 32, 2, '#6a4a22'); // 하단 캡
  px(ctx, 4, 6, 2, 45, '#7a5a2e'); px(ctx, 34, 6, 2, 45, '#7a5a2e');  // 좌우 기둥
  px(ctx, 4, 6, 1, 45, '#c9a86a'); px(ctx, 35, 6, 1, 45, '#c9a86a');  // 기둥 광택

  // ── 유리 내부 + 모래 (유리 형태로 클립해서 그린다) ──
  ctx.save();
  ctx.beginPath();
  for (let y = glassTop; y <= glassBot; y++) ctx.lineTo(cx - hw(y), y);
  for (let y = glassBot; y >= glassTop; y--) ctx.lineTo(cx + hw(y), y);
  ctx.closePath();
  ctx.clip();

  // 푸른빛 투명 유리
  ctx.fillStyle = 'rgba(198,212,240,0.5)';
  ctx.fillRect(0, glassTop, 40, glassBot - glassTop + 1);

  // 위쪽 남은 모래 — 표면은 중앙이 파인 깔때기 모양
  const yTop = glassTop + 3 + Math.min(1, phase * 1.2) * (neck - glassTop - 5);
  const dip = 3;
  ctx.fillStyle = sand;
  for (let y = Math.floor(yTop); y <= Math.ceil(yTop + dip); y++) {
    const w = hw(Math.min(y, neck - 1));
    const inner = w * (1 - (y - yTop) / dip);
    if (inner <= 0) break;
    ctx.fillRect(cx - w, y, w - inner, 1);
    ctx.fillRect(cx + inner, y, w - inner, 1);
  }
  ctx.fillRect(0, Math.ceil(yTop + dip), 40, neck + 2 - Math.ceil(yTop + dip));

  // 아래쪽 모래 언덕 — 중앙이 높은 삼각 더미
  const pileH = 1 + phase * 16;
  for (let i = 0; i < pileH; i++) {
    const y = glassBot - i;
    const w = Math.min(hw(y) - 0.5, (pileH - i) * 1.3);
    if (w <= 0) break;
    ctx.fillRect(cx - w, y, w * 2, 1);
  }

  // 목에서 언덕까지 떨어지는 모래 줄기 — 위에 모래가 남아 있을 때만
  if (yTop < neck - 2) {
    const pileTop = glassBot - Math.ceil(pileH) + 1;
    ctx.fillStyle = sandDark;
    ctx.fillRect(cx - 1, neck - 1, 2, pileTop - neck + 1);
    ctx.fillStyle = sandLight;
    ctx.fillRect(cx - 0.5, neck - 1, 1, pileTop - neck + 1);
  }

  // 언덕 꼭대기와 유리 좌상단의 반사 하이라이트
  px(ctx, cx - 1, glassBot - Math.floor(pileH), 2, 1, sandLight);
  px(ctx, cx - hw(11) + 2, 10, 1, 7, 'rgba(255,255,255,0.7)');
  px(ctx, cx - hw(11) + 3.5, 10, 1, 4, 'rgba(255,255,255,0.35)');
  ctx.restore();

  // 유리 외곽선
  ctx.strokeStyle = '#14121e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = glassTop; y <= glassBot; y++) ctx.lineTo(cx - hw(y), y);
  for (let y = glassBot; y >= glassTop; y--) ctx.lineTo(cx + hw(y), y);
  ctx.closePath();
  ctx.stroke();
}

// 프롤로그 마을 배경 — picture/마을.jpeg의 탑다운 마을 구도를 재현한다.
// 잔디 + 회청색 자갈길 광장 + 초가 큰집 + 파란 지붕 집들 + 울타리 밭 + 나무 + 가로등
function drawVillage(ctx) {
  // ── 잔디 바탕 + 얼룩 ──
  ctx.fillStyle = '#55702f';
  ctx.fillRect(0, 0, 640, 480);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = i % 2 ? '#4a6129' : '#637c38';
    ctx.beginPath();
    ctx.ellipse((i * 137) % 640, (i * 89) % 480,
      18 + (i * 13) % 30, 8 + (i * 7) % 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 맨흙 패치 — 참고 이미지처럼 잔디 사이로 드러난 갈색 노출지
  for (const [bx, by, bw, bh] of [
    [70, 290, 80, 34], [430, 70, 70, 26], [140, 80, 60, 24], [470, 300, 60, 26], [36, 170, 46, 26]
  ]) {
    ctx.fillStyle = '#6d5738';
    ctx.beginPath(); ctx.ellipse(bx, by, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(125,100,64,0.5)';
    ctx.beginPath(); ctx.ellipse(bx + 5, by + 2, bw / 3, bh / 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 잔디 점 디테일
  for (let i = 0; i < 380; i++) {
    ctx.fillStyle = i % 3 ? 'rgba(0,0,0,0.13)' : 'rgba(220,240,170,0.13)';
    ctx.fillRect((i * 67) % 640, (i * 41) % 480, 2, 3);
  }

  // ── 자갈길: 세로길 + 가로길 + 중앙 광장 (경로 영역만 클립해서 돌을 깐다) ──
  const PATHS = [[0, 188, 640, 56], [288, 0, 64, 188], [232, 176, 176, 88]];
  ctx.save();
  ctx.beginPath();
  for (const [rx, ry, rw, rh] of PATHS) ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.fillStyle = '#75807c';                                     // 돌 틈새
  ctx.fillRect(0, 0, 640, 480);
  for (let y = 0; y < 480; y += 7) {                             // 자갈 — 줄마다 반 칸 어긋남
    const off = ((y / 7) | 0) % 2 ? 5 : 0;
    for (let x = -10; x < 640; x += 10) {
      const s = 148 + Math.abs((x * 31 + y * 17) % 36);          // 돌마다 다른 명도
      ctx.fillStyle = `rgb(${s - 8},${s + 4},${s})`;
      ctx.fillRect(x + off, y, 8, 5);
    }
  }
  ctx.restore();

  // ── 초가 큰집 (상단 중앙) ──
  ctx.fillStyle = '#e2d8c4'; ctx.fillRect(262, 108, 116, 62);    // 벽
  ctx.fillStyle = '#cbbc9e'; ctx.fillRect(262, 150, 116, 20);    // 벽 하단 음영
  ctx.fillStyle = '#8a6a44';                                     // 모서리·중앙 기둥
  ctx.fillRect(262, 108, 8, 62); ctx.fillRect(370, 108, 8, 62);
  ctx.fillRect(316, 108, 8, 62);
  for (const wx of [272, 340]) {                                 // 창문 2개
    ctx.fillStyle = '#4a3628'; ctx.fillRect(wx, 118, 22, 24);
    ctx.fillStyle = '#87a0b4'; ctx.fillRect(wx + 2, 120, 18, 20);
    ctx.fillStyle = '#aec4d4'; ctx.fillRect(wx + 2, 120, 18, 8); // 하늘 반사
    ctx.fillStyle = '#4a3628'; ctx.fillRect(wx + 10, 118, 2, 24);
  }
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(306, 124, 28, 46);     // 문
  ctx.fillStyle = '#5a3e26'; ctx.fillRect(308, 126, 24, 44);
  ctx.fillRect(319, 126, 2, 44);                                 // 문짝 이음
  ctx.fillStyle = '#c9a86a'; ctx.fillRect(326, 144, 4, 5);       // 손잡이
  // 초가 지붕 — 아래로 넓어지는 삼각 + 가로 짚 줄 + 처마 그늘
  ctx.fillStyle = '#503322';
  ctx.beginPath();
  ctx.moveTo(320, 16); ctx.lineTo(406, 110); ctx.lineTo(234, 110); ctx.closePath();
  ctx.fill();
  for (let y = 30; y < 110; y += 8) {
    const hw = 86 * (y - 14) / 96;
    ctx.fillStyle = (y % 16) ? '#64432a' : '#75522f';
    ctx.fillRect(320 - hw, y, hw * 2, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(320 - hw, y + 5, hw * 2, 2);
  }
  ctx.fillStyle = '#34200f'; ctx.fillRect(315, 12, 10, 12);      // 용마루
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(234, 104, 172, 7); // 처마 그늘

  // ── 하단 집들 (참고 이미지의 파란 기와 + 초가 부속 + 검은 굴뚝) ──
  // 파란 지붕 집 A
  ctx.fillStyle = '#d9c9a4'; ctx.fillRect(258, 402, 128, 68);
  ctx.fillStyle = '#b8a67e'; ctx.fillRect(258, 452, 128, 18);
  ctx.fillStyle = '#173a45';
  ctx.beginPath(); ctx.moveTo(252, 402); ctx.lineTo(322, 334); ctx.lineTo(392, 402); ctx.closePath(); ctx.fill();
  for (let y = 344; y < 402; y += 8) {                           // 기와 줄
    const hw = 70 * (y - 328) / 74;
    ctx.fillStyle = (y % 16) ? '#21505c' : '#2b6370';
    ctx.fillRect(322 - hw, y, hw * 2, 4);
  }
  ctx.fillStyle = '#0e2830'; ctx.fillRect(317, 328, 10, 8);      // 용마루
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(252, 398, 140, 6);
  ctx.fillStyle = '#4a3628'; ctx.fillRect(300, 428, 30, 42);     // 문
  ctx.fillStyle = '#33424e'; ctx.fillRect(268, 414, 20, 20);     // 창
  ctx.fillStyle = '#8fb0c0'; ctx.fillRect(270, 416, 16, 16);
  // 파란 지붕 집 B
  ctx.fillStyle = '#cdbb90'; ctx.fillRect(398, 402, 146, 68);
  ctx.fillStyle = '#b09e76'; ctx.fillRect(398, 452, 146, 18);
  ctx.fillStyle = '#173a45';
  ctx.beginPath(); ctx.moveTo(392, 402); ctx.lineTo(471, 340); ctx.lineTo(550, 402); ctx.closePath(); ctx.fill();
  for (let y = 350; y < 402; y += 8) {
    const hw = 79 * (y - 334) / 68;
    ctx.fillStyle = (y % 16) ? '#21505c' : '#2b6370';
    ctx.fillRect(471 - hw, y, hw * 2, 4);
  }
  ctx.fillStyle = '#0e2830'; ctx.fillRect(466, 334, 10, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(392, 398, 158, 6);
  for (const wx of [410, 500]) {                                 // 창문 2개
    ctx.fillStyle = '#4a3628'; ctx.fillRect(wx, 420, 18, 18);
    ctx.fillStyle = '#8fb0c0'; ctx.fillRect(wx + 2, 422, 14, 14);
  }
  ctx.fillStyle = '#4a3628'; ctx.fillRect(452, 424, 30, 46);     // 문
  // 초가 부속 건물 (우하단)
  ctx.fillStyle = '#bfa97a'; ctx.fillRect(552, 398, 62, 72);
  ctx.fillStyle = '#5a3c22';
  ctx.beginPath(); ctx.moveTo(544, 398); ctx.lineTo(583, 356); ctx.lineTo(622, 398); ctx.closePath(); ctx.fill();
  for (let y = 362; y < 398; y += 7) {
    const hw = 39 * (y - 350) / 48;
    ctx.fillStyle = (y % 14) ? '#6e4e2e' : '#7d5a34';
    ctx.fillRect(583 - hw, y, hw * 2, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(544, 394, 78, 6);
  // 검은 굴뚝
  ctx.fillStyle = '#17171d'; ctx.fillRect(552, 288, 26, 66);
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(552, 288, 26, 6);      // 윗면
  ctx.fillStyle = '#0d0d12'; ctx.fillRect(558, 290, 14, 3);      // 굴뚝 구멍

  // ── 논밭 (좌하단) — 물이 고인 논 + 격자로 심은 모 ──
  ctx.fillStyle = '#4a6a72'; ctx.fillRect(22, 324, 190, 142);    // 물이 찬 논바닥
  // 수면 반짝임
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(200,230,230,0.22)';
    ctx.fillRect(26 + (i * 47) % 180, 330 + (i * 29) % 130, 5, 2);
  }
  // 격자로 심은 모 — 두 가닥씩 솟은 새싹
  for (let y = 336; y < 458; y += 16) {
    for (let x = 34; x < 206; x += 18) {
      ctx.fillStyle = '#5a9a3a';
      ctx.fillRect(x, y, 2, 6); ctx.fillRect(x + 4, y - 1, 2, 7);
    }
  }
  ctx.fillStyle = '#54381f';                                     // 가로대 2줄
  ctx.fillRect(16, 330, 204, 5); ctx.fillRect(16, 404, 204, 5);
  for (let x = 20; x <= 216; x += 28) {                          // 말뚝
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(x, 318, 6, 150);
    ctx.fillStyle = '#8a6338'; ctx.fillRect(x, 318, 6, 4);
  }

  // ── 나무 (우상단 큰 나무 + 좌측 나무) ──
  const tree = (cx, cy, s) => {
    ctx.fillStyle = '#4a3320';
    ctx.fillRect(cx - 5 * s, cy + 8 * s, 10 * s, 26 * s);        // 줄기
    for (const [ox, oy, r, c] of [
      [0, -14, 30, '#3c6225'], [-18, -4, 22, '#33551f'],
      [18, -4, 22, '#33551f'], [0, 4, 24, '#3c6225'], [0, -22, 18, '#4a7830']
    ]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(cx + ox * s, cy + oy * s, r * s, r * 0.9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(160,200,110,0.35)';                    // 잎 하이라이트
    ctx.beginPath();
    ctx.ellipse(cx - 8 * s, cy - 20 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  tree(535, 78, 1.15);
  tree(62, 146, 0.9);

  // ── 가로등 — 기둥 + 가로대 + 등불 + 따뜻한 광원 글로우 ──
  const lamp = (lx, ly) => {
    const g = ctx.createRadialGradient(lx + 13, ly - 26, 3, lx + 13, ly - 26, 40);
    g.addColorStop(0, 'rgba(255,220,130,0.5)');
    g.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 27, ly - 66, 80, 80);
    ctx.fillStyle = '#4a3628';
    ctx.fillRect(lx - 2, ly - 34, 4, 40);                        // 기둥
    ctx.fillRect(lx - 2, ly - 34, 16, 3);                        // 가로대
    ctx.fillStyle = '#2a2018'; ctx.fillRect(lx + 9, ly - 32, 8, 12); // 등 틀
    ctx.fillStyle = '#ffdf8a'; ctx.fillRect(lx + 10, ly - 30, 6, 8); // 불빛
  };
  lamp(236, 210); lamp(404, 210); lamp(76, 280); lamp(560, 168);

  // ── 표지판 (밭 옆) ──
  ctx.fillStyle = '#4a3628'; ctx.fillRect(68, 288, 4, 20);       // 기둥
  ctx.fillStyle = '#6a5238'; ctx.fillRect(60, 280, 20, 10);      // 패널
  ctx.fillStyle = '#8a6a44'; ctx.fillRect(62, 282, 16, 6);
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(64, 284, 8, 2);        // 새겨진 글줄

  // ── 따스한 햇살 + 가장자리 비네팅 ──
  const sun = ctx.createRadialGradient(320, 200, 60, 320, 200, 360);
  sun.addColorStop(0, 'rgba(255,240,190,0.12)');
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, 640, 480);
  const vg = ctx.createRadialGradient(320, 240, 180, 320, 240, 430);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, 640, 480);
}

// 폐허가 된 아포칼립스 마을 배경 — 보스의 습격 직후 검게 타버린 대지·불타는 집과 나무·말라붙어 타오르는 논밭을 그린다
function drawRuinedVillage(ctx) {
  // ── 검게 그을린 잿빛 대지 + 용암빛 균열 얼룩 ──
  ctx.fillStyle = '#1b1416';
  ctx.fillRect(0, 0, 640, 480);
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = i % 3 === 0 ? '#2a1818' : (i % 2 ? '#140e10' : '#241a1c');
    ctx.beginPath();
    ctx.ellipse((i * 137) % 640, (i * 89) % 480,
      18 + (i * 13) % 30, 8 + (i * 7) % 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 타버린 잿더미와 불씨 패치
  for (const [bx, by, bw, bh] of [
    [70, 290, 80, 34], [430, 70, 70, 26], [140, 80, 60, 24], [470, 300, 60, 26], [36, 170, 46, 26]
  ]) {
    ctx.fillStyle = '#120c0e';
    ctx.beginPath(); ctx.ellipse(bx, by, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,80,30,0.28)';
    ctx.beginPath(); ctx.ellipse(bx + 3, by + 1, bw / 3, bh / 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 대지 위를 뒤덮은 재와 잔불 점
  for (let i = 0; i < 380; i++) {
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,110,40,0.35)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect((i * 67) % 640, (i * 41) % 480, 2, 3);
  }

  // ── 자갈길: 검게 그을리고 균열이 간 광장 돌바닥 ──
  const PATHS = [[0, 188, 640, 56], [288, 0, 64, 188], [232, 176, 176, 88]];
  ctx.save();
  ctx.beginPath();
  for (const [rx, ry, rw, rh] of PATHS) ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.fillStyle = '#1a1518';
  ctx.fillRect(0, 0, 640, 480);
  for (let y = 0; y < 480; y += 7) {
    const off = ((y / 7) | 0) % 2 ? 5 : 0;
    for (let x = -10; x < 640; x += 10) {
      const s = 42 + Math.abs((x * 31 + y * 17) % 26);
      ctx.fillStyle = `rgb(${s + 8},${s - 2},${s})`;
      ctx.fillRect(x + off, y, 8, 5);
    }
  }
  ctx.restore();

  // ── 불타 무너진 초가 큰집 (상단 중앙) — 검게 탄 벽과 화염이 비치는 창문 ──
  ctx.fillStyle = '#4a3834'; ctx.fillRect(262, 108, 116, 62);
  ctx.fillStyle = '#2e201e'; ctx.fillRect(262, 142, 116, 28);
  ctx.fillStyle = '#1e1412';
  ctx.fillRect(262, 108, 8, 62); ctx.fillRect(370, 108, 8, 62);
  ctx.fillRect(316, 108, 8, 62);
  for (const wx of [272, 340]) {                                 // 집 안의 불길이 새어 나오는 창문
    ctx.fillStyle = '#1a1010'; ctx.fillRect(wx, 118, 22, 24);
    ctx.fillStyle = '#d94826'; ctx.fillRect(wx + 2, 120, 18, 20);
    ctx.fillStyle = '#ffaa38'; ctx.fillRect(wx + 4, 124, 14, 14);
    ctx.fillStyle = '#1a1010'; ctx.fillRect(wx + 10, 118, 2, 24);
  }
  ctx.fillStyle = '#140c0a'; ctx.fillRect(306, 124, 28, 46);     // 부서진 문과 내부 화염광
  ctx.fillStyle = '#6a2218'; ctx.fillRect(308, 126, 24, 44);
  ctx.fillStyle = '#221410';
  ctx.beginPath();
  ctx.moveTo(320, 16); ctx.lineTo(406, 110); ctx.lineTo(234, 110); ctx.closePath();
  ctx.fill();
  for (let y = 30; y < 110; y += 8) {
    const hw = 86 * (y - 14) / 96;
    ctx.fillStyle = (y % 16) ? '#2e1c16' : '#1c1210';
    ctx.fillRect(320 - hw, y, hw * 2, 5);
    ctx.fillStyle = 'rgba(255,90,30,0.22)';
    ctx.fillRect(320 - hw * 0.6, y + 5, hw * 1.2, 2);
  }
  ctx.fillStyle = '#120a08'; ctx.fillRect(315, 12, 10, 12);

  // ── 불타는 하단 집들 (검게 그을린 지붕과 불타는 창문) ──
  // 집 A
  ctx.fillStyle = '#483a34'; ctx.fillRect(258, 402, 128, 68);
  ctx.fillStyle = '#2a201c'; ctx.fillRect(258, 446, 128, 24);
  ctx.fillStyle = '#14181e';
  ctx.beginPath(); ctx.moveTo(252, 402); ctx.lineTo(322, 334); ctx.lineTo(392, 402); ctx.closePath(); ctx.fill();
  for (let y = 344; y < 402; y += 8) {
    const hw = 70 * (y - 328) / 74;
    ctx.fillStyle = (y % 16) ? '#1c2228' : '#281c20';
    ctx.fillRect(322 - hw, y, hw * 2, 4);
  }
  ctx.fillStyle = '#1c100e'; ctx.fillRect(300, 428, 30, 42);
  ctx.fillStyle = '#1c100e'; ctx.fillRect(268, 414, 20, 20);
  ctx.fillStyle = '#ff6a2a'; ctx.fillRect(270, 416, 16, 16);
  // 집 B
  ctx.fillStyle = '#443630'; ctx.fillRect(398, 402, 146, 68);
  ctx.fillStyle = '#281e1a'; ctx.fillRect(398, 446, 146, 24);
  ctx.fillStyle = '#14181e';
  ctx.beginPath(); ctx.moveTo(392, 402); ctx.lineTo(471, 340); ctx.lineTo(550, 402); ctx.closePath(); ctx.fill();
  for (let y = 350; y < 402; y += 8) {
    const hw = 79 * (y - 334) / 68;
    ctx.fillStyle = (y % 16) ? '#1c2228' : '#281c20';
    ctx.fillRect(471 - hw, y, hw * 2, 4);
  }
  for (const wx of [410, 500]) {
    ctx.fillStyle = '#1c100e'; ctx.fillRect(wx, 420, 18, 18);
    ctx.fillStyle = '#ff6a2a'; ctx.fillRect(wx + 2, 422, 14, 14);
  }
  ctx.fillStyle = '#1c100e'; ctx.fillRect(452, 424, 30, 46);
  // 초가 부속 건물 (우하단)
  ctx.fillStyle = '#3e3028'; ctx.fillRect(552, 398, 62, 72);
  ctx.fillStyle = '#241612';
  ctx.beginPath(); ctx.moveTo(544, 398); ctx.lineTo(583, 356); ctx.lineTo(622, 398); ctx.closePath(); ctx.fill();
  // 검은 굴뚝
  ctx.fillStyle = '#0e0c10'; ctx.fillRect(552, 288, 26, 66);

  // ── 말라붙어 불타는 논밭 (좌하단) — 증발한 바닥 + 검붉게 타들어가는 작물과 울타리 ──
  ctx.fillStyle = '#221818'; ctx.fillRect(22, 324, 190, 142);
  for (let i = 0; i < 36; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,90,30,0.28)' : 'rgba(0,0,0,0.4)';
    ctx.fillRect(26 + (i * 47) % 180, 330 + (i * 29) % 130, 8, 3);
  }
  // 불타버린 모와 잔불
  for (let y = 336; y < 458; y += 16) {
    for (let x = 34; x < 206; x += 18) {
      ctx.fillStyle = (x + y) % 3 === 0 ? '#ff6a2a' : '#3a221a';
      ctx.fillRect(x, y + 1, 2, 5); ctx.fillRect(x + 4, y, 2, 6);
    }
  }
  ctx.fillStyle = '#241612';
  ctx.fillRect(16, 330, 204, 5); ctx.fillRect(16, 404, 204, 5);
  for (let x = 20; x <= 216; x += 28) {
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(x, 318, 6, 150);
    ctx.fillStyle = '#ff5a22'; ctx.fillRect(x, 318, 6, 3);
  }

  // ── 검게 탄 고목과 불길에 휩싸인 수관 (우상단 큰 나무 + 좌측 나무) ──
  const burnedTree = (cx, cy, s) => {
    ctx.fillStyle = '#1c1210';
    ctx.fillRect(cx - 5 * s, cy + 8 * s, 10 * s, 26 * s);
    for (const [ox, oy, r, c] of [
      [0, -14, 30, '#221414'], [-18, -4, 22, '#1a1010'],
      [18, -4, 22, '#2a1614'], [0, 4, 24, '#381814'], [0, -22, 18, '#5a2218']
    ]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(cx + ox * s, cy + oy * s, r * s, r * 0.9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,100,30,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - 4 * s, cy - 12 * s, 16 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  burnedTree(535, 78, 1.15);
  burnedTree(62, 146, 0.9);

  // ── 붉은 화염광으로 물든 가로등 ──
  const ruinedLamp = (lx, ly) => {
    const g = ctx.createRadialGradient(lx + 13, ly - 26, 3, lx + 13, ly - 26, 42);
    g.addColorStop(0, 'rgba(255,80,30,0.45)');
    g.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 27, ly - 66, 80, 80);
    ctx.fillStyle = '#221614';
    ctx.fillRect(lx - 2, ly - 34, 4, 40);
    ctx.fillRect(lx - 2, ly - 34, 16, 3);
    ctx.fillStyle = '#140c0c'; ctx.fillRect(lx + 9, ly - 32, 8, 12);
    ctx.fillStyle = '#ff5522'; ctx.fillRect(lx + 10, ly - 30, 6, 8);
  };
  ruinedLamp(236, 210); ruinedLamp(404, 210); ruinedLamp(76, 280); ruinedLamp(560, 168);

  // ── 그을린 표지판 ──
  ctx.fillStyle = '#221614'; ctx.fillRect(68, 288, 4, 20);
  ctx.fillStyle = '#2e1e18'; ctx.fillRect(60, 280, 20, 10);

  // ── 아포칼립스 핏빛 화염 안개 + 짙은 암흑 비네팅 ──
  const fireGlow = ctx.createRadialGradient(320, 240, 40, 320, 240, 380);
  fireGlow.addColorStop(0, 'rgba(220,50,20,0.22)');
  fireGlow.addColorStop(1, 'rgba(20,5,10,0.55)');
  ctx.fillStyle = fireGlow; ctx.fillRect(0, 0, 640, 480);
  const vg = ctx.createRadialGradient(320, 240, 140, 320, 240, 420);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(5,0,5,0.78)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, 640, 480);
}

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    // ── 주인공 4방향 x 걷기 2프레임 (닌자풍 사이보그) ──
    const heroPalette = { scarf: true };
    for (const dir of ['down', 'up', 'left', 'right']) {
      for (const walk of [0, 1]) {
        makeTexture(this, `hero-${dir}-${walk}`, 16, 16,
          ctx => drawCharacter(ctx, { dir, walk, ...heroPalette }));
      }
      this.anims.create({
        key: `hero-walk-${dir}`,
        frames: [{ key: `hero-${dir}-0` }, { key: `hero-${dir}-1` }],
        frameRate: 6, repeat: -1
      });
    }

    // ── 내면의 자신 — 주인공과 같은 형태, 창백한 색 ──
    makeTexture(this, 'inner-self', 16, 16, ctx => drawCharacter(ctx, {
      dir: 'down', outline: '#6a6a7a', helm: '#d9d4c8', plate: '#f2ece2',
      cloth: '#d9d4c8', accent: '#b8f0d8', eye: '#b8f0d8', legs: '#9a96a8'
    }));

    // ── 적: 주인공과 동일 실루엣, 어두운 색 변형 ──
    makeTexture(this, 'enemy1', 16, 16, ctx => drawCharacter(ctx, {
      outline: '#0c0a14', helm: '#1a1626', plate: '#3a3a4a',
      cloth: '#262238', accent: '#8899ff', eye: '#8899ff', legs: '#16141f'
    }));

    // ── 적 변형 2: 초조/분노의 그림자 — 호박색 바이저 ──
    makeTexture(this, 'enemy2', 16, 16, ctx => drawCharacter(ctx, {
      outline: '#140f0a', helm: '#241a12', plate: '#4a3f34',
      cloth: '#38291c', accent: '#ffb347', eye: '#ffb347', legs: '#1c1410'
    }));

    // ── 적 변형 3: 슬픔의 그림자 — 보라색 바이저 ──
    makeTexture(this, 'enemy3', 16, 16, ctx => drawCharacter(ctx, {
      outline: '#0e0d16', helm: '#1f1c2e', plate: '#464a5c',
      cloth: '#2e2a44', accent: '#b98aff', eye: '#b98aff', legs: '#191722'
    }));

    // ── 최종보스 '그림자': 같은 실루엣 + 뿔 + 붉은 바이저 ──
    makeTexture(this, 'boss', 16, 16, ctx => drawCharacter(ctx, {
      horns: true, outline: '#0a0810', helm: '#1a1428', plate: '#2e2a44',
      cloth: '#241f35', accent: '#ff3344', eye: '#ff3344', legs: '#14101e'
    }));

    // ── 방랑자 NPC: 같은 실루엣, 스카프와 따뜻한 호박색 바이저 ──
    makeTexture(this, 'wanderer', 16, 16, ctx => drawCharacter(ctx, {
      scarf: true, outline: '#141210', helm: '#3a3024', plate: '#d8cbb8',
      cloth: '#6a5238', accent: '#ffca7a', eye: '#ffd27a', legs: '#2e2418'
    }));

    // ── 마을 사람들 (프롤로그/에필로그 마을 — 따뜻한 피부톤과 소박한 의복) ──
    // 논밭에서 일하는 농부 — 밀짚모자 톤 두건과 황토빛 작업복
    makeTexture(this, 'villager-farm', 16, 16, ctx => drawCharacter(ctx, {
      dir: 'down', outline: '#241c14', helm: '#b89852', plate: '#e8c8a8',
      cloth: '#6a5a38', accent: '#f0df98', eye: '#2a2018', legs: '#4a3828'
    }));
    // 나무를 캐는 사람 — 나무를 향해 오른쪽을 보는 모습
    makeTexture(this, 'villager-wood', 16, 16, ctx => drawCharacter(ctx, {
      dir: 'right', outline: '#1c1814', helm: '#5a4230', plate: '#e4c2a2',
      cloth: '#7a5234', accent: '#d89a58', eye: '#2a2018', legs: '#34281e'
    }));
    // 수다를 떠는 사람 — 스카프가 있는 산뜻한 마을 옷차림
    makeTexture(this, 'villager-chat', 16, 16, ctx => drawCharacter(ctx, {
      dir: 'right', scarf: '#d88a7a', outline: '#1e1a20', helm: '#64547e',
      plate: '#ecd0b6', cloth: '#746490', accent: '#ffe0a8', eye: '#241c28', legs: '#38304a'
    }));

    // ── 거울 (14x22 서 있는 거울) ──
    makeTexture(this, 'mirror', 14, 22, ctx => {
      px(ctx, 1, 0, 12, 18, '#6a5238');                  // 액자
      px(ctx, 3, 2, 8, 14, '#8ea4c8');                   // 거울면
      px(ctx, 4, 3, 3, 8, '#b8c8e4');                    // 빛 반사
      px(ctx, 5, 18, 4, 4, '#4a3628');                   // 받침
    });

    // ── 벽 충돌 타일 (비가시 물리 바디용) ──
    makeTexture(this, 'wall', 16, 16, ctx => {
      px(ctx, 0, 0, 16, 16, '#3a2f4a');
      px(ctx, 0, 5, 16, 1, '#241c30'); px(ctx, 0, 11, 16, 1, '#241c30');
      px(ctx, 7, 0, 1, 5, '#241c30'); px(ctx, 3, 6, 1, 5, '#241c30'); px(ctx, 11, 6, 1, 5, '#241c30');
      px(ctx, 7, 12, 1, 4, '#241c30');
    });

    // ── 문 (뒷벽 하단 출입구) — 26x40 크기의 목조 문짝 + 문지방 ──
    makeTexture(this, 'door', 26, 40, ctx => {
      px(ctx, 0, 0, 26, 40, '#4a3628');                  // 문틀
      px(ctx, 1, 1, 24, 2, '#6a5238');                   // 상단 장식 라인
      px(ctx, 3, 4, 20, 32, '#120e18');                  // 안쪽 어둠
      px(ctx, 4, 5, 18, 30, '#3a2a1e');                  // 문짝
      // 문짝 판자 이음새 + 상하 몰딩
      px(ctx, 9, 5, 1, 30, '#2a1e14'); px(ctx, 16, 5, 1, 30, '#2a1e14');
      px(ctx, 4, 5, 18, 2, '#4a3628'); px(ctx, 4, 33, 18, 2, '#4a3628');
      px(ctx, 5, 6, 16, 1, '#5a4430');                   // 상단 하이라이트
      px(ctx, 19, 20, 2, 3, '#c9a86a');                  // 손잡이
      px(ctx, 0, 36, 26, 4, '#2a1e14');                  // 문지방
      px(ctx, 1, 36, 24, 1, '#6a5238');                  // 문지방 윗면
    });

    // ── 열린 문 — 챕터 클리어 후 문 너머로 빛이 새어 나온다 ──
    makeTexture(this, 'door-open', 26, 40, ctx => {
      px(ctx, 0, 0, 26, 40, '#4a3628');                  // 문틀
      const g = ctx.createLinearGradient(0, 4, 0, 38);
      g.addColorStop(0, '#fff8dd'); g.addColorStop(1, '#ffca7a');
      ctx.fillStyle = g;
      ctx.fillRect(3, 4, 20, 32);                        // 문 너머의 빛
      px(ctx, 3, 4, 7, 32, '#3a2a1c');                   // 반쯤 열린 문짝
      px(ctx, 4, 5, 6, 2, '#4a3628');                    // 문짝 몰딩
      px(ctx, 8, 20, 1, 3, '#c9a86a');                   // 손잡이
      px(ctx, 21, 6, 1, 28, 'rgba(255,255,255,0.55)');   // 빛 가장자리
      px(ctx, 0, 36, 26, 4, '#2a1e14');                  // 문지방
    });

    // ── 안내판 — 방 분위기에 맞는 서 있는 목조 표지판 (기둥 + 라운드 패널) ──
    makeTexture(this, 'sign', 16, 16, ctx => {
      px(ctx, 7, 9, 2, 6, '#4a3628');                    // 기둥
      px(ctx, 5, 15, 6, 1, '#3a2a1c');                   // 받침
      px(ctx, 1, 1, 14, 8, '#6a5238');                   // 패널 외곽
      px(ctx, 2, 0, 12, 1, '#6a5238');                   // 윗면 라운딩
      px(ctx, 2, 2, 12, 6, '#8a6a44');                   // 안쪽 밝은 목재면
      px(ctx, 2, 2, 1, 1, '#c9a86a'); px(ctx, 13, 2, 1, 1, '#c9a86a');  // 금속 못
      px(ctx, 4, 4, 8, 1, '#3a2a1c'); px(ctx, 4, 6, 6, 1, '#3a2a1c');   // 새겨진 글줄
    });

    // ── 앤티크 괘종시계 (16x24 — 바닥에 당당히 서 있는 키 큰 목조 시계) ──
    // swing: -1(왼쪽), 0(중앙/정지), 1(오른쪽) 시계추 위치
    const drawGrandfatherClock = (ctx, swing = 0, stopped = false) => {
      px(ctx, 4, 0, 8, 2, '#d8b86a');                    // 상단 금장 왕관 장식
      px(ctx, 2, 2, 12, 2, '#4a3220');                   // 상단 지붕 몰딩
      px(ctx, 3, 4, 10, 9, '#6a482c');                   // 시계 머리통 외곽
      px(ctx, 4, 5, 8, 7, '#f5ecd7');                    // 아이보리 시계판
      px(ctx, 4, 5, 8, 1, '#d8ccb4');                    // 시계판 윗그늘
      // 시침과 분침 — 멈춘 시계(3장)는 3시 방향에 고정, 일반 시계는 12시/4시
      px(ctx, 8, 6, 1, 3, '#1a1a28');                    // 분침
      px(ctx, 8, 8, stopped ? 3 : 2, 1, '#1a1a28');      // 시침
      px(ctx, 8, 8, 1, 1, stopped ? '#7a3040' : '#c03838'); // 중심축
      // 시계 몸통(기둥)과 유리창 속 황금 시계추
      px(ctx, 4, 13, 8, 8, '#5a3c24');                   // 기둥 본체
      px(ctx, 5, 14, 6, 6, '#1c1622');                   // 추 유리창 내부 어둠
      const pxPend = 7 + swing;                          // 추의 좌우 흔들림 좌표
      px(ctx, pxPend, 14, 1, 4, '#c9a86a');              // 시계추 줄
      px(ctx, pxPend - 1, 17, 3, 2, stopped ? '#8a7a5a' : '#ffd878'); // 시계추 원판
      // 하단 받침대(베이스)
      px(ctx, 3, 21, 10, 2, '#4a3220');
      px(ctx, 2, 23, 12, 1, '#2e1e12');
    };
    makeTexture(this, 'clock', 16, 24, ctx => drawGrandfatherClock(ctx, -1, false));
    makeTexture(this, 'clock-1', 16, 24, ctx => drawGrandfatherClock(ctx, 1, false));
    makeTexture(this, 'clock-stopped', 16, 24, ctx => drawGrandfatherClock(ctx, 0, true));
    this.anims.create({
      key: 'clock-tick',
      frames: [{ key: 'clock' }, { key: 'clock-1' }],
      frameRate: 1.5,
      repeat: -1
    });

    // ── 챕터별 방 시계 (1장~9장: 옛날 시계 → 현대 시계로 매 장마다 진화, 16x24) ──
    // 1장: 해시계 (석조 기단 위 청동 해시계 판과 영침 그림자 이동)
    const drawRoomSundial = (ctx, step = 0) => {
      px(ctx, 3, 21, 10, 2, '#3a3646');
      px(ctx, 2, 23, 12, 1, '#262232');
      px(ctx, 5, 13, 6, 8, '#5a5468');
      px(ctx, 6, 13, 2, 8, '#746e84');
      px(ctx, 2, 10, 12, 4, '#6e5838');
      px(ctx, 2, 8, 12, 4, '#c9a86a');
      px(ctx, 3, 8, 10, 3, '#e8d29e');
      // 영침 그림자 (step에 따라 각도 변화)
      px(ctx, step === 0 ? 5 : 9, 8, 2, 2, '#6e5230');
      // 중앙 황금 영침
      px(ctx, 7, 4, 2, 6, '#b8883c');
      px(ctx, 7, 4, 1, 5, '#ffd878');
      // 햇빛 반짝임
      px(ctx, step === 0 ? 4 : 11, 2, 2, 2, '#fff0b8');
    };
    makeTexture(this, 'room-clock-1', 16, 24, ctx => drawRoomSundial(ctx, 0));
    makeTexture(this, 'room-clock-1-b', 16, 24, ctx => drawRoomSundial(ctx, 1));

    // 2장: 물시계 (상단 파수호에서 하단 수수호로 물방울이 떨어지는 자격루 스타일)
    const drawRoomWaterClock = (ctx, step = 0) => {
      px(ctx, 2, 22, 12, 2, '#3a2818');
      px(ctx, 3, 4, 2, 18, '#5a3e24');
      px(ctx, 3, 2, 7, 7, '#7a5834');
      px(ctx, 2, 1, 9, 1, '#c9a86a');
      px(ctx, 4, 4, 5, 4, '#4a98e8');
      px(ctx, 4, 4, 4, 1, '#8ee0ff');
      px(ctx, 9, 6, 3, 2, '#c9a86a');
      // 떨어지는 물방울
      px(ctx, 10, step === 0 ? 9 : 12, 2, 2, '#8ee0ff');
      // 하단 수수호와 눈금 잣대
      px(ctx, 6, 14, 8, 8, '#6a4a2a');
      px(ctx, 5, 13, 10, 1, '#c9a86a');
      px(ctx, 8, 16, 4, 5, '#4a98e8');
      px(ctx, 9, step === 0 ? 10 : 9, 2, 4, '#ffe9a8');
    };
    makeTexture(this, 'room-clock-2', 16, 24, ctx => drawRoomWaterClock(ctx, 0));
    makeTexture(this, 'room-clock-2-b', 16, 24, ctx => drawRoomWaterClock(ctx, 1));

    // 3장: 모래시계 (해금 전에는 모래가 멈춰 있고, 해금 후에는 모래가 흐른다)
    const drawRoomSandClock = (ctx, step = 0, stopped = false) => {
      px(ctx, 2, 22, 12, 2, '#2e1e12');
      px(ctx, 3, 19, 10, 3, '#4a3220');
      px(ctx, 3, 2, 10, 2, '#a8814a');
      px(ctx, 3, 17, 10, 2, '#a8814a');
      px(ctx, 4, 4, 1, 13, '#c9a86a');
      px(ctx, 11, 4, 1, 13, '#c9a86a');
      // 상하 유리 전구
      px(ctx, 5, 4, 6, 5, '#6a7896');
      px(ctx, 6, 9, 4, 3, '#6a7896');
      px(ctx, 5, 12, 6, 5, '#6a7896');
      const sandCol = stopped ? '#9a8e72' : '#ffd878';
      px(ctx, 6, 6, 4, 3, sandCol);
      px(ctx, 6, 14, 4, 3, sandCol);
      if (stopped) {
        px(ctx, 7, 10, 2, 2, '#9a8e72');
      } else {
        px(ctx, 7, step === 0 ? 9 : 11, 2, 3, '#fff0b8');
      }
    };
    makeTexture(this, 'room-clock-3', 16, 24, ctx => drawRoomSandClock(ctx, 0, false));
    makeTexture(this, 'room-clock-3-b', 16, 24, ctx => drawRoomSandClock(ctx, 1, false));
    makeTexture(this, 'room-clock-3-stopped', 16, 24, ctx => drawRoomSandClock(ctx, 0, true));

    // 4장: 촛대시계 (눈금이 새겨진 양초가 타오르며 시간을 알리는 중세 화시계)
    const drawRoomCandleClock = (ctx, step = 0) => {
      px(ctx, 2, 22, 12, 2, '#3a2a18');
      px(ctx, 4, 19, 8, 3, '#a8814a');
      px(ctx, 3, 17, 10, 2, '#ffd878');
      // 눈금이 새겨진 양초 기둥
      px(ctx, 6, 7, 4, 10, '#f5ecd7');
      px(ctx, 6, 7, 1, 10, '#d8ccb4');
      px(ctx, 7, 9, 3, 1, '#6a482c');
      px(ctx, 7, 12, 3, 1, '#6a482c');
      px(ctx, 7, 15, 3, 1, '#6a482c');
      // 심지와 흔들리는 촛불
      px(ctx, 7, 5, 2, 2, '#2a1e14');
      px(ctx, 6 + step, 2, 3, 4, '#ff9922');
      px(ctx, 7, 3, 2, 2, '#fff0aa');
    };
    makeTexture(this, 'room-clock-4', 16, 24, ctx => drawRoomCandleClock(ctx, 0));
    makeTexture(this, 'room-clock-4-b', 16, 24, ctx => drawRoomCandleClock(ctx, 1));

    // 5장: 회중시계 (목조 스탠드에 걸린 황금 회중시계)
    const drawRoomPocketWatch = (ctx, step = 0) => {
      px(ctx, 2, 21, 12, 3, '#3a2618');
      px(ctx, 3, 2, 2, 19, '#5a3c24');
      px(ctx, 3, 2, 7, 2, '#c9a86a');
      px(ctx, 8, 4, 2, 2, '#ffd878');
      // 원형 황금 케이스와 문자판
      px(ctx, 4, 6, 10, 12, '#b8883c');
      px(ctx, 5, 5, 8, 14, '#ffd878');
      px(ctx, 6, 7, 6, 10, '#f7efe0');
      // 시침·분침
      px(ctx, 8, 8, 1, 4, '#1a1a28');
      px(ctx, step === 0 ? 8 : 6, 11, 3, 1, '#c03838');
    };
    makeTexture(this, 'room-clock-5', 16, 24, ctx => drawRoomPocketWatch(ctx, 0));
    makeTexture(this, 'room-clock-5-b', 16, 24, ctx => drawRoomPocketWatch(ctx, 1));

    // 7장: 아날로그시계 (깔끔한 현대식 원형 아날로그 스탠드 시계)
    const drawRoomAnalogClock = (ctx, step = 0) => {
      px(ctx, 3, 21, 10, 3, '#22263a');
      px(ctx, 6, 15, 4, 6, '#3a4266');
      px(ctx, 2, 3, 12, 12, '#3a4266');
      px(ctx, 3, 2, 10, 14, '#6a749c');
      px(ctx, 4, 4, 8, 10, '#eef2fa');
      // 시침·분침·붉은 초침
      px(ctx, 8, 5, 1, 4, '#182038');
      px(ctx, 8, 8, 3, 1, '#182038');
      px(ctx, step === 0 ? 6 : 9, step === 0 ? 10 : 6, 2, 2, '#d9384a');
    };
    makeTexture(this, 'room-clock-7', 16, 24, ctx => drawRoomAnalogClock(ctx, 0));
    makeTexture(this, 'room-clock-7-b', 16, 24, ctx => drawRoomAnalogClock(ctx, 1));

    // 8장: 플립시계 (숫자 카드가 넘어가는 레트로 모던 탁상 시계)
    const drawRoomFlipClock = (ctx, step = 0) => {
      px(ctx, 3, 21, 10, 3, '#1c2030');
      px(ctx, 6, 14, 4, 7, '#2e344e');
      px(ctx, 1, 5, 14, 9, '#2a2e48');
      px(ctx, 2, 4, 12, 1, '#6a749c');
      // 좌우 플립 숫자판
      px(ctx, 3, 6, 4, 7, '#eef2fa');
      px(ctx, 9, 6, 4, 7, '#eef2fa');
      px(ctx, 3, 9, 4, 1, '#2a2e48');
      px(ctx, 9, 9, 4, 1, '#2a2e48');
      px(ctx, 4, 7, 2, 4, '#182038');
      px(ctx, 10, step === 0 ? 7 : 8, 2, 4, '#d9384a');
    };
    makeTexture(this, 'room-clock-8', 16, 24, ctx => drawRoomFlipClock(ctx, 0));
    makeTexture(this, 'room-clock-8-b', 16, 24, ctx => drawRoomFlipClock(ctx, 1));

    // 9장: 디지털시계 (푸른 LED 숫자가 빛나는 현대 디지털시계)
    const drawRoomDigitalClock = (ctx, step = 0) => {
      px(ctx, 3, 21, 10, 3, '#121324');
      px(ctx, 6, 14, 4, 7, '#22263e');
      px(ctx, 1, 5, 14, 9, '#2a2e48');
      px(ctx, 2, 4, 12, 1, '#565e86');
      px(ctx, 2, 6, 12, 7, '#080e18');
      // 발광 디지털 숫자 및 점멸 콜론
      px(ctx, 3, 7, 3, 5, '#7fffd8');
      px(ctx, 10, 7, 3, 5, '#7fffd8');
      if (step === 0) {
        px(ctx, 7, 8, 2, 1, '#ffe9a8');
        px(ctx, 7, 10, 2, 1, '#ffe9a8');
      }
    };
    makeTexture(this, 'room-clock-9', 16, 24, ctx => drawRoomDigitalClock(ctx, 0));
    makeTexture(this, 'room-clock-9-b', 16, 24, ctx => drawRoomDigitalClock(ctx, 1));

    for (const n of [1, 2, 3, 4, 5, 7, 8, 9]) {
      this.anims.create({
        key: `room-clock-${n}-tick`,
        frames: [{ key: `room-clock-${n}` }, { key: `room-clock-${n}-b` }],
        frameRate: 1.5,
        repeat: -1
      });
    }

    // ── 비네팅 (컷신 배경용 — 가장자리가 어두워지는 방사형 그라데이션) ──
    makeTexture(this, 'vignette', 640, 480, ctx => {
      const g = ctx.createRadialGradient(320, 240, 120, 320, 240, 380);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);
    });

    // ── 밤 마을 분위기 배경 (로딩/인용구 화면용 — 어두운 돌바닥 + 따뜻한 불빛) ──
    makeTexture(this, 'night-bg', 640, 480, ctx => {
      // 밤하늘 — 위는 짙은 남색, 아래로 갈수록 보라빛
      const sky = ctx.createLinearGradient(0, 0, 0, 480);
      sky.addColorStop(0, '#07060f');
      sky.addColorStop(0.45, '#151024');
      sky.addColorStop(1, '#241a38');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 640, 480);

      // 멀리 보이는 건물 실루엣과 따뜻한 창문 불빛
      ctx.fillStyle = '#0e0b18';
      ctx.fillRect(0, 200, 640, 280);
      const buildings = [[30, 90, 90], [140, 120, 130], [270, 80, 75], [380, 140, 145], [520, 100, 105]];
      for (const [bx, bw, bh] of buildings) {
        ctx.fillStyle = '#0b0916';
        ctx.fillRect(bx, 200 - bh, bw, bh);
        ctx.shadowColor = '#ffb35c';
        ctx.shadowBlur = 7;
        ctx.fillStyle = '#ffca7a';
        for (let wy = 200 - bh + 12; wy < 192; wy += 18) {
          for (let wx = bx + 9; wx < bx + bw - 10; wx += 17) {
            if (Math.random() < 0.35) ctx.fillRect(wx, wy, 4, 6);
          }
        }
        ctx.shadowBlur = 0;
      }

      // 자갈돌 바닥 — 어두운 틈새 위에 돌을 촘촘히 깐다
      for (let y = 214; y < 480; y += 11) {
        const off = ((y / 11) | 0) % 2 ? 9 : 0;
        for (let x = -18; x < 640; x += 18) {
          const shade = 26 + Math.floor(Math.random() * 20);
          ctx.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade + 16})`;
          ctx.fillRect(x + off + 1, y + 1, 16, 9);
        }
      }

      // 중앙에 떨어지는 따뜻한 스포트라이트
      const sp = ctx.createRadialGradient(320, 290, 40, 320, 290, 300);
      sp.addColorStop(0, 'rgba(255, 222, 160, 0.26)');
      sp.addColorStop(0.6, 'rgba(255, 210, 150, 0.10)');
      sp.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sp;
      ctx.fillRect(0, 0, 640, 480);

      // 가장자리 비네팅
      const vg = ctx.createRadialGradient(320, 240, 160, 320, 240, 430);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, 640, 480);
    });

    // ── 전투 배경 — 심연의 공간 위에 거대한 시계판(Clockwork Arena) 마법진과 실제 전투 위치 조명이 펼쳐진다 ──
    makeTexture(this, 'battle-bg', 640, 480, ctx => {
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, '#07060f');
      g.addColorStop(0.55, '#151026');
      g.addColorStop(1, '#22183a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);

      // 원거리 수평선 안개 및 기둥 실루엣
      const hz = ctx.createLinearGradient(0, 120, 0, 260);
      hz.addColorStop(0, 'rgba(138,134,184,0)');
      hz.addColorStop(0.5, 'rgba(138,134,184,0.09)');
      hz.addColorStop(1, 'rgba(138,134,184,0)');
      ctx.fillStyle = hz;
      ctx.fillRect(0, 120, 640, 140);

      // 바닥 원근 그리드 + 거대 시계 다이얼 아레나 (중심 310, 260)
      const cx = 310, cy = 260, rx = 265, ry = 112;
      ctx.strokeStyle = 'rgba(150,142,205,0.32)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = 'rgba(150,142,205,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); ctx.stroke();

      // 12방향 시계 눈금과 중심 시계바늘 문양
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const cos = Math.cos(a), sin = Math.sin(a);
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,233,168,0.35)' : 'rgba(150,142,205,0.22)';
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.2;
        ctx.beginPath();
        ctx.moveTo(cx + cos * rx * 0.78, cy + sin * ry * 0.78);
        ctx.lineTo(cx + cos * rx * 0.96, cy + sin * ry * 0.96);
        ctx.stroke();
      }
      // 아레나 중앙에 새겨진 거대 시침·분침
      ctx.strokeStyle = 'rgba(255,233,168,0.16)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx + 85, cy - 28);
      ctx.moveTo(cx, cy); ctx.lineTo(cx - 55, cy + 36);
      ctx.stroke();

      // 실제 적 발판(470, 210)과 플레이어 발판(140, 336) 위치에 정확히 떨어지는 스포트라이트
      for (const [sx, sy, rad, col] of [
        [470, 204, 135, 'rgba(255,190,210,0.18)'],
        [140, 326, 125, 'rgba(170,200,255,0.18)']
      ]) {
        const sp = ctx.createRadialGradient(sx, sy, 8, sx, sy, rad);
        sp.addColorStop(0, col);
        sp.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sp;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      }

      // 공중에 떠다니는 별빛/시간 입자
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = i % 4 === 0 ? 'rgba(255,233,168,0.35)' : 'rgba(180,175,220,0.22)';
        ctx.fillRect((i * 97) % 640, (i * 53) % 380, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
    });

    // ── 챕터별 탐험 배경 — 챕터마다 다른 시간대·장식(창문/액자/러그) 배치 ──
    // p: { wall, trim, floorA, floorB, sky:[stops], bld, lit, sun, moon, stars, glow, decor }
    const ROOMS = [
      ['bg-ch0', {  // 튜토리얼 — 안개 낀 새벽
        wall: '#4a4458', trim: '#322c40', floorA: '#3e384c', floorB: '#463f52',
        sky: ['#b8b4d8', '#8a84b8'], bld: '#5a5478', lit: '#ffd9a0',
        sun: '#e8e2ff', glow: 'rgba(200,190,255,0.08)',
        decor: [
          { t: 'win', x: 140 }, { t: 'win', x: 480 },
          { t: 'rug', x: 320, y: 310, w: 150, h: 70, c: '#56486a' }
        ]
      }],
      ['bg-ch1', {  // 1장 — 분홍빛 정오
        wall: '#5a4a6a', trim: '#3a2f4a', floorA: '#4a3f56', floorB: '#544659',
        sky: ['#fbcfe0', '#d8b8ea'], bld: '#a898d0', lit: '#e8a86a',
        sun: '#fff2c8', glow: 'rgba(255,220,200,0.10)',
        decor: [
          { t: 'win', x: 430 },
          { t: 'frame', x: 120, y: 52, w: 52, h: 38, art: ['#ffd9e8', '#8a5a7a'] },
          { t: 'frame', x: 310, y: 46, w: 34, h: 44, art: ['#c8e8ff', '#4a5a8a'] },
          { t: 'rug', x: 320, y: 330, w: 170, h: 80, c: '#6a4a58' }
        ]
      }],
      ['bg-ch2', {  // 2장 — 강한 햇살의 정오 (초조) — 문(doorX: 140)과 창문(330) 사이 중앙에 액자 배치
        wall: '#6a4a4a', trim: '#4a3232', floorA: '#54423e', floorB: '#5e4a44',
        sky: ['#ffe9a8', '#ffb35c'], bld: '#b8865a', lit: '#ff8a5a',
        sun: '#ffffff', glow: 'rgba(255,240,180,0.14)',
        decor: [
          { t: 'win', x: 330 }, { t: 'win', x: 480 },
          { t: 'frame', x: 245, y: 50, w: 40, h: 30, art: ['#fff0c8', '#c88a4a'] },
          { t: 'rug', x: 400, y: 320, w: 140, h: 70, c: '#7a5240' }
        ]
      }],
      ['bg-ch3', {  // 3장 — 석양 (멈춘 시간의 방) — 창문(150~274)과 문(doorX: 440) 사이 중앙(345)에 액자 배치
        wall: '#4a2f44', trim: '#2e1e30', floorA: '#43304a', floorB: '#4c3652',
        sky: ['#ff9a5c', '#d85a7a', '#6a3a78'], bld: '#3a2444', lit: '#ffca7a',
        sun: '#ffd27a', glow: 'rgba(255,170,110,0.12)',
        decor: [
          { t: 'win', x: 150 },
          { t: 'frame', x: 345, y: 50, w: 44, h: 34, art: ['#ffca7a', '#7a3a4a'] },
          { t: 'rug', x: 230, y: 320, w: 130, h: 70, c: '#5a3a44' }
        ]
      }],
      ['bg-ch4', {  // 4장 — 청록빛 이른 아침 (방랑자)
        wall: '#3a4a52', trim: '#263238', floorA: '#324048', floorB: '#3a4a50',
        sky: ['#a8e8e0', '#5aa8b8'], bld: '#3a6a78', lit: '#ffe9a8',
        sun: '#fff8dd', glow: 'rgba(160,230,220,0.10)',
        decor: [
          { t: 'win', x: 140 },
          { t: 'frame', x: 305, y: 48, w: 40, h: 34, art: ['#a8e8e0', '#3a6a6a'] },
          { t: 'frame', x: 390, y: 52, w: 52, h: 36, art: ['#d8f0e8', '#4a7a68'] },
          { t: 'rug', x: 300, y: 320, w: 150, h: 70, c: '#3a5a58' }
        ]
      }],
      ['bg-ch5', {  // 5장 — 자줏빛 깊은 밤 (두 그림자) — 문(doorX: 320)과 우측 창문(480) 사이 빈 벽(412)에 액자 배치
        wall: '#2e2038', trim: '#1a1224', floorA: '#241c30', floorB: '#2c2238',
        sky: ['#241438', '#4a2a6a'], bld: '#181024', lit: '#ff9a7a',
        moon: '#d8c8ff', stars: '#b8a8e8', glow: 'rgba(170,120,255,0.10)',
        decor: [
          { t: 'win', x: 130 }, { t: 'win', x: 480 },
          { t: 'frame', x: 412, y: 48, w: 46, h: 36, art: ['#6a4a8a', '#2a1a3a'] },
          { t: 'rug', x: 320, y: 330, w: 200, h: 80, c: '#38284a' }
        ]
      }],
      ['bg-ch6', {  // 6장 — 흐린 흰빛 (거울의 방)
        wall: '#4c4c58', trim: '#34343e', floorA: '#40404c', floorB: '#484854',
        sky: ['#d8d8e8', '#a8a8c0'], bld: '#7878a0', lit: '#fff0c8',
        glow: 'rgba(220,220,240,0.10)',
        decor: [
          { t: 'win', x: 420 },
          { t: 'frame', x: 115, y: 50, w: 44, h: 36, art: ['#e8e8f0', '#7a7a90'] },
          { t: 'frame', x: 315, y: 46, w: 34, h: 44, art: ['#d0d0e0', '#606078'] },
          { t: 'rug', x: 320, y: 310, w: 160, h: 70, c: '#52525e' }
        ]
      }],
      ['bg-ch7', {  // 7장 — 심연의 자정 (슬픔)
        wall: '#141020', trim: '#0a0812', floorA: '#120e1c', floorB: '#181226',
        sky: ['#080612', '#1c1030'], bld: '#0a0814', lit: '#6a5aa8',
        moon: '#8a8ac8', stars: '#5a5a90', glow: 'rgba(90,80,160,0.12)',
        decor: [
          { t: 'win', x: 150 },
          { t: 'frame', x: 345, y: 50, w: 40, h: 32, art: ['#2a2444', '#0c0a18'] },
          { t: 'rug', x: 320, y: 330, w: 150, h: 70, c: '#1c1628' }
        ]
      }],
      ['bg-ch8', {  // 8장 — 동트기 직전 어스름 (문턱) — 문(doorX: 140)과 창문(330) 사이 중앙(245)에 액자 배치
        wall: '#3a2c44', trim: '#241a2e', floorA: '#2e2438', floorB: '#362a40',
        sky: ['#ff9a8a', '#6a4a7a', '#241838'], bld: '#1e1430', lit: '#ffca7a',
        moon: '#f0e8ff', glow: 'rgba(255,150,140,0.10)',
        decor: [
          { t: 'win', x: 330 }, { t: 'win', x: 480 },
          { t: 'frame', x: 245, y: 50, w: 44, h: 34, art: ['#ffb8a8', '#5a3a5a'] },
          { t: 'rug', x: 380, y: 320, w: 140, h: 70, c: '#4a3448' }
        ]
      }],
      ['bg-ch9', {  // 9장 — 붉은 심연 (최종) — 문(doorX: 320)과 우측 창문(480) 사이 빈 벽(412)에 액자 배치
        wall: '#2c1420', trim: '#180a12', floorA: '#221020', floorB: '#2a1626',
        sky: ['#3a0a14', '#6a1424'], bld: '#140810', lit: '#ff5a4a',
        sun: '#ff3a2a', glow: 'rgba(255,80,60,0.12)',
        decor: [
          { t: 'win', x: 130 }, { t: 'win', x: 480 },
          { t: 'frame', x: 412, y: 48, w: 48, h: 36, art: ['#5a1420', '#1c0a10'] },
          { t: 'rug', x: 320, y: 330, w: 180, h: 80, c: '#341620' }
        ]
      }]
    ];
    for (const [key, p] of ROOMS) {
      makeTexture(this, key, 640, 480, ctx => drawRoomBg(ctx, p));
    }

    // ── 클리어 후 타이틀 장식용 디지털시계 프레임 (88x38 — 현대적인 발광 탁상 디지털시계) ──
    makeTexture(this, 'digital-clock', 88, 38, ctx => {
      // 외부 케이스 그림자 및 베젤
      px(ctx, 2, 2, 84, 34, '#121324');
      px(ctx, 0, 3, 88, 30, '#2a2e48');
      px(ctx, 2, 1, 84, 34, '#2a2e48');
      // 상단 버튼 디테일과 금속 테두리 하이라이트
      px(ctx, 32, 0, 10, 2, '#6a749c');
      px(ctx, 46, 0, 10, 2, '#6a749c');
      px(ctx, 3, 2, 82, 1, '#565e86');
      // 내부 액정(LCD/LED) 베젤과 어두운 스크린
      px(ctx, 5, 5, 78, 26, '#080b14');
      px(ctx, 6, 6, 76, 24, '#0d1622');
      // 액정 유리 반사광 및 모서리 포인트
      px(ctx, 7, 7, 74, 1, 'rgba(127,255,216,0.22)');
      px(ctx, 8, 9, 2, 2, '#7fffd8');
      // 하단 받침 다리
      px(ctx, 12, 35, 10, 3, '#181a2c');
      px(ctx, 66, 35, 10, 3, '#181a2c');
    });

    // ── 전투 도입부 시계 텍스처 (옛날 시계 → 현대 시계 진화 연출용) ──
    // 1) 해시계 (64x64 — 석조 받침대 위의 청동 앙부일구/평면 해시계 원판과 영침)
    makeTexture(this, 'intro-sundial', 64, 64, ctx => {
      // 석조 기단 받침대
      px(ctx, 14, 52, 36, 6, '#4a4658');
      px(ctx, 10, 56, 44, 6, '#363244');
      px(ctx, 18, 44, 28, 10, '#5a5468');
      // 원형 석조/청동 해시계 판 (중심 32, 30)
      ctx.fillStyle = '#6e5838';
      ctx.beginPath(); ctx.ellipse(32, 32, 26, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a86a';
      ctx.beginPath(); ctx.ellipse(32, 29, 25, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d29e';
      ctx.beginPath(); ctx.ellipse(32, 29, 21, 13, 0, 0, Math.PI * 2); ctx.fill();
      // 12방향 시각 눈금
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x1 = 32 + Math.cos(a) * 15, y1 = 29 + Math.sin(a) * 9;
        const x2 = 32 + Math.cos(a) * 20, y2 = 29 + Math.sin(a) * 12;
        ctx.strokeStyle = i % 3 === 0 ? '#5a3a18' : '#8a6838';
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      // 중앙 청동 영침(Gnomon) 삼각 기둥
      ctx.fillStyle = '#7a5426';
      ctx.beginPath();
      ctx.moveTo(32, 14);
      ctx.lineTo(28, 30);
      ctx.lineTo(36, 30);
      ctx.closePath();
      ctx.fill();
      px(ctx, 31, 14, 2, 16, '#ffd878');
    });

    // 2) 물시계 (56x64 — 상단 파수호에서 하단 수수호로 물방울이 떨어져 잣대가 떠오르는 자격루/클렙시드라)
    makeTexture(this, 'intro-water-clock', 56, 64, ctx => {
      // 목조/청동 프레임 기둥과 받침
      px(ctx, 4, 58, 48, 4, '#3a2818');
      px(ctx, 8, 12, 4, 46, '#5a3e24');
      px(ctx, 44, 28, 4, 30, '#5a3e24');
      px(ctx, 6, 10, 26, 3, '#c9a86a');
      // 상단 물통 (파수호)
      px(ctx, 10, 4, 18, 14, '#7a5834');
      px(ctx, 8, 3, 22, 2, '#c9a86a');
      px(ctx, 12, 7, 14, 9, '#4a98e8');
      px(ctx, 13, 7, 12, 2, '#8ee0ff');
      // 물 나오는 대나무/청동 대롱
      px(ctx, 28, 14, 6, 3, '#c9a86a');
      // 하단 물통 (수수호)
      px(ctx, 20, 32, 22, 26, '#6a4a2a');
      px(ctx, 18, 30, 26, 3, '#c9a86a');
      px(ctx, 19, 44, 24, 2, '#c9a86a');
      px(ctx, 24, 36, 14, 18, '#162030');
      px(ctx, 24, 44, 14, 10, '#4a98e8');
      px(ctx, 25, 44, 12, 2, '#8ee0ff');
      // 수수호 위로 솟아오른 눈금 잣대(부표)
      px(ctx, 30, 20, 3, 14, '#ffe9a8');
      px(ctx, 30, 23, 2, 1, '#5a3a18');
      px(ctx, 30, 26, 2, 1, '#5a3a18');
      px(ctx, 30, 29, 2, 1, '#5a3a18');
    });

    // 4) 회중시계 (56x64 — 상단 용두와 사슬 고리가 달린 황금 엔틱 회중시계)
    makeTexture(this, 'intro-pocket-watch', 56, 64, ctx => {
      const cx = 28, cy = 38;
      // 상단 사슬 고리와 용두(Crown)
      ctx.strokeStyle = '#ffd878';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, 8, 5, 0, Math.PI * 2); ctx.stroke();
      px(ctx, cx - 4, 11, 8, 5, '#c9a050');
      px(ctx, cx - 2, 12, 4, 3, '#ffd878');
      // 황금 외곽 케이스
      ctx.fillStyle = '#7a5820';
      ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b25c';
      ctx.beginPath(); ctx.arc(cx, cy, 21, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff0b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 19.5, 0, Math.PI * 2); ctx.stroke();
      // 아이보리 문자판
      ctx.fillStyle = '#f7efe0';
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
      // 12방향 클래식 도트 눈금
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tx = Math.round(cx + Math.cos(a) * 13.5);
        const ty = Math.round(cy + Math.sin(a) * 13.5);
        px(ctx, tx - 1, ty - 1, 2, 2, i % 3 === 0 ? '#5a2820' : '#3a3028');
      }
      px(ctx, cx - 1, cy - 1, 2, 2, '#c03838');
    });

    // 5) 아날로그시계 (64x64 — 깔끔한 현대식 원형 아날로그 벽시계/탁상시계)
    makeTexture(this, 'intro-analog-clock', 64, 64, ctx => {
      const cx = 32, cy = 32;
      // 메탈릭 다크 블루 베젤
      ctx.fillStyle = '#181c2e';
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a4266';
      ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a749c';
      ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
      // 화이트 다이얼
      ctx.fillStyle = '#eef2fa';
      ctx.beginPath(); ctx.arc(cx, cy, 21, 0, Math.PI * 2); ctx.fill();
      // 12시간 바 눈금
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 15 : 17;
        const r2 = 19.5;
        ctx.strokeStyle = i % 3 === 0 ? '#182038' : '#566080';
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }
      px(ctx, cx - 1, cy - 1, 2, 2, '#d9384a');
    });

    // ── 프롤로그 마을 배경 & 파괴된 아포칼립스 폐허 마을 배경 ──
    makeTexture(this, 'village-bg', 640, 480, ctx => drawVillage(ctx));
    makeTexture(this, 'village-ruined-bg', 640, 480, ctx => drawRuinedVillage(ctx));

    // ── 모래시계 애니메이션 (8프레임 — 위 모래가 흘러내려 아래에 쌓인다) ──
    for (let i = 0; i < 8; i++) {
      makeTexture(this, `sand-clock-${i}`, 40, 56, ctx => drawSandClock(ctx, i / 8));
    }
    this.anims.create({
      key: 'sand-flow',
      frames: Array.from({ length: 8 }, (_, i) => ({ key: `sand-clock-${i}` })),
      frameRate: 3, repeat: -1
    });
    // 타이틀 화면 상단용 모래시계 애니메이션 — 모래가 훨씬 느리고 차분하게 떨어진다
    this.anims.create({
      key: 'sand-flow-slow',
      frames: Array.from({ length: 8 }, (_, i) => ({ key: `sand-clock-${i}` })),
      frameRate: 1.2, repeat: 0
    });

    // 디버그 점프 — ?to=N: N장으로 바로 이동, ?to=reveal: 엔딩 컷신, ?to=ending: 엔딩 크레딧, ?to=prologue: 마을 프롤로그
    const to = new URLSearchParams(location.search).get('to');
    if (to === 'prologue') {
      playerState.reset();
      this.scene.start('PrologueScene');
      return;
    }
    if (to === 'reveal') {
      this.scene.start('StoryScene', { script: 'reveal' });
      return;
    }
    if (to === 'ending') {
      // 최종 독백 인용구 + 개발자의 편지 크레딧으로 바로 진입한다
      this.scene.start('StoryScene', { script: 'ending' });
      return;
    }
    const ch = parseInt(to, 10);
    if (ch >= 0 && ch <= 9) {
      playerState.reset();
      // 해당 챕터(0~9장)까지 정상 진행했을 때의 누적 힘의 조각 수와 습득 스킬을 재현한다
      // 조각 획득 시점: 1장(+1), 2장(+1), 4장(+1), 5장(+2), 7장(+1), 8장(+1) → 최대 7개
      const frags = [0, 0, 1, 2, 2, 3, 5, 5, 6, 7][ch];
      for (let i = 0; i < frags; i++) playerState.addPowerFragment();
      // 장 선택으로 시작해도 정상 진행과 동일한 네 스킬만 지급한다.
      const skillAt = { 2: '힘의 일격', 3: '잔상 베기', 4: '마음의 눈', 9: '심연의 파동' };
      for (const [n, s] of Object.entries(skillAt)) {
        if (ch >= +n) playerState.learnSkill(s);
      }
      playerState.chapter = ch;
      this.scene.start('ExploreScene', { chapter: ch });
      return;
    }

    this.scene.start('TitleScene');
  }
}
