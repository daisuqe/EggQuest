'use strict';
const COLS = 10, ROWS = 20, CELL = 30;
const cv = document.getElementById('board'), ctx = cv.getContext('2d');
const nv = document.getElementById('next'), nctx = nv.getContext('2d');
const fieldCv = document.getElementById('field'), fctx = fieldCv.getContext('2d');

// ミノ定義 (SRS 初期向き)。[x, y, 穴か]
const H = 1;
const SHAPES = {   // 卵(H)は各ミノに1個
  I: { n: 4, color: '#2fd0e8', cells: [[0,1,0],[1,1,0],[2,1,0],[3,1,H]] },
  J: { n: 3, color: '#3a5be0', cells: [[0,0,0],[0,1,0],[1,1,0],[2,1,H]] },   // 長いほうの先
  L: { n: 3, color: '#f08a1c', cells: [[2,0,H],[0,1,0],[1,1,0],[2,1,0]] },   // 短いほうの先
  S: { n: 3, color: '#46c43c', cells: [[1,0,0],[2,0,H],[0,1,0],[1,1,0]] },
  Z: { n: 3, color: '#e04040', cells: [[0,0,H],[1,0,0],[1,1,0],[2,1,0]] },
  T: { n: 3, color: '#a443d4', cells: [[1,0,H],[0,1,0],[1,1,0],[2,1,0]] },   // 凸の上の部分
  O: { n: 2, color: '#e8d02f', cells: [[0,0,H],[1,0,0],[0,1,0],[1,1,0]] },
};
const NAMES = Object.keys(SHAPES);

// SRS キック表 (y は下向きに変換済み: 元表の dy を反転)
function k(list) { return list.map(([x, y]) => [x, -y]); }
const KICK_JLSTZ = {
  '0>1': k([[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]),
  '1>0': k([[0,0],[1,0],[1,-1],[0,2],[1,2]]),
  '1>2': k([[0,0],[1,0],[1,-1],[0,2],[1,2]]),
  '2>1': k([[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]),
  '2>3': k([[0,0],[1,0],[1,1],[0,-2],[1,-2]]),
  '3>2': k([[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]),
  '3>0': k([[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]),
  '0>3': k([[0,0],[1,0],[1,1],[0,-2],[1,-2]]),
};
const KICK_I = {
  '0>1': k([[0,0],[-2,0],[1,0],[-2,-1],[1,2]]),
  '1>0': k([[0,0],[2,0],[-1,0],[2,1],[-1,-2]]),
  '1>2': k([[0,0],[-1,0],[2,0],[-1,2],[2,-1]]),
  '2>1': k([[0,0],[1,0],[-2,0],[1,-2],[-2,1]]),
  '2>3': k([[0,0],[2,0],[-1,0],[2,1],[-1,-2]]),
  '3>2': k([[0,0],[-2,0],[1,0],[-2,-1],[1,2]]),
  '3>0': k([[0,0],[1,0],[-2,0],[1,-2],[-2,1]]),
  '0>3': k([[0,0],[-1,0],[2,0],[-1,2],[2,-1]]),
};

// 盤面セル: null | { color, hole, rivet, under }
let board, cur, queue, bag, score, lines, level, over, paused;
let overReason = null;
let stage = 1;          // ステージ(扉を開けるたびに1つ進む)
let stageClear = false, stageClearT = 0;   // ステージクリアの演出中(ブロックも止まる)  // ゲームオーバーの理由: 'stack'(ブロックが積み上がった) / 'enemy'(敵がルネリアに届いた) / 'clear'(扉を開けた)
let monsters = [];
let dropTimer, lockTimer, lockResets, moveDir, dasTimer, softDrop, flash;

function newBag() {
  const a = NAMES.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function takeNext() {
  while (queue.length < 5) queue.push(...newBag());
  return queue.shift();
}
function spawn() {
  const name = takeNext();
  const s = SHAPES[name];
  cur = {
    name, n: s.n, color: s.color, r: 0,
    cells: s.cells.map(c => c.slice()),
    x: Math.floor((COLS - s.n) / 2),
    y: name === 'I' ? -1 : 0,
  };
  dropTimer = 0; lockTimer = 0; lockResets = 0;
  if (check(cur.cells, cur.x, cur.y) === null) over = true;
}

function reset() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  queue = []; score = 0; lines = 0; level = 1;
  over = false; paused = false; moveDir = 0; dasTimer = 0; softDrop = false;
  flash = []; monsters = []; enemies = []; enemyTimer = 0; fx = []; popups = []; hatchlings = []; overReason = null; stage = 1; resetStage();
  clearing = null; parts = []; cv.style.transform = '';
  spawn();
  updateHud();
}

// 戻り値: null=置けない / 数値=穴同士の重なり数 (0なら通常の空き)
function check(cells, ox, oy) {
  let overlaps = 0;
  for (const [cx, cy, hole] of cells) {
    const x = ox + cx, y = oy + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return null;
    if (y < 0) continue;
    const b = board[y][x];
    if (!b) continue;
    if (hole && b.hole && !b.rivet) overlaps++;
    else return null;
  }
  return overlaps;
}

function lockPiece(kind) {
  sfx(kind === 'land' ? 'land' : 'touch');
  const info = shapeItems(cur.cells, cur.color);
  for (const [i, [cx, cy, hole]] of cur.cells.entries()) {
    const x = cur.x + cx, y = cur.y + cy;
    if (y < 0) { over = true; continue; }
    const b = board[y][x];
    const links = info[i].links;
    if (b && b.hole && hole) {
      detachNeighbors(x, y, b.links || 0); // 重なった古いマスは、周りとのつながりを切る
      board[y][x] = { color: cur.color, hole: false, rivet: true, under: b.color, name: cur.name, underName: b.name, links };
      flash.push({ x, y, t: 0 });
    } else {
      board[y][x] = { color: cur.color, hole: !!hole, rivet: false, under: null, name: cur.name, links };
    }
  }
  const rows = [];
  for (let y = 0; y < ROWS; y++) if (board[y].every(c => c)) rows.push(y);
  if (rows.length && !over) { startClear(rows); return; }
  if (!over) spawn();
}

// (x,y) のマスがもっていたつながり(links)の相手側から、このマスへのつながりを外す
function detachNeighbors(x, y, links) {
  const nb = [[LU, 0, -1, LD], [LR, 1, 0, LL], [LD, 0, 1, LU], [LL, -1, 0, LR]];
  for (const [bit, dx, dy, back] of nb) {
    if (!(links & bit)) continue;
    const n = (board[y + dy] || [])[x + dx];
    if (n) n.links &= ~back;
  }
}

// ---- ライン消去の演出(ゲームは止まる): 白く点滅 → 粒になって弾ける → 行が消える ----
let clearing = null, parts = [];
function startClear(rows) {
  const keys = [], eggPos = [];
  for (const y of rows) board[y].forEach((c, x) => {
    if (!c.rivet) return;
    const k = monsterKey(c.name, c.underName);
    keys.push(k); eggPos.push({ key: k, x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });
  });
  const eggs = keys.length;
  // 得点: n = 卵の数 + 消したライン数 で 10 x 2^(n-1)
  const n = eggs + rows.length;
  clearing = { rows, eggs, keys, eggPos, n, points: eggScore(n), t: 0, dur: CLEAR_MS, burst: false, confetti: [] };
  parts = [];
  cur = null;
  sfx('clear', rows.length);
}
// ---- 卵からモンスターが生まれる演出(盤面の上) ----
// 弾けた瞬間、卵の位置に白く光るモンスター(左向き) → だんだん本来の色になりながら少し沈む →
// スッと下まで落ちる → トコトコ左へはける → はけたら召喚(上のダンジョンへ)
const HATCH_POP = 250, HATCH_TURN = 1400;   // 現れるまで / 本来の色になりきるまで(ミリ秒)
const HATCH_SINK = 14;      // 色が変わる間に沈む速さ(px/秒)
const HATCH_G = 2200;       // 落ちるときの重力(px/秒²)
const HATCH_WALK = 95;      // 左へはける速さ(px/秒)
const HATCH_HOP_KEYS = [];       // 左へはけるとき、ピョンピョン跳ねるモンスター(ほかは跳ねずに歩く。飛ぶものは、ふわふわ)
const HATCH_HOP_MS = 440;   // トコトコ歩きの、1歩の長さ(ミリ秒)
const HATCH_H = 80, HATCH_W = 116;  // 盤面での大きさの上限
let hatchlings = [];
function hatchEggs(list) {
  list.forEach((e, i) => {
    if (!MONSTERS[e.key]) return;
    hatchlings.push({ key: e.key, x: e.x, cy: e.y, vy: 0, t: -i * 60, state: 'turn', walkT: 0, batch: list.length, delay: i * 140 });
  });
}
function hatchSize(h) {
  const img = monsterImgs[h.key], iw = img.naturalWidth || 40, ih = img.naturalHeight || 40;
  const k = Math.min(HATCH_H / ih, HATCH_W / iw);
  return { w: iw * k, h: ih * k, k };
}
function updateHatch(dt) {
  const floor = ROWS * CELL;   // 盤面の下の端が地面
  for (const h of hatchlings) {
    h.t += dt;
    if (h.t < 0) continue;
    const { w, h: hh } = hatchSize(h);
    if (h.state === 'turn') {               // 白から本来の色へ、ゆっくり沈む
      h.cy += HATCH_SINK * dt / 1000;
      if (h.t >= HATCH_TURN) h.state = MONSTERS[h.key].float > 0 ? 'fly' : 'fall';   // 飛ぶものは落ちずに、そのまま左へ
    } else if (h.state === 'fall') {        // スッと落ちる
      h.vy += HATCH_G * dt / 1000;
      h.cy += h.vy * dt / 1000;
      if (h.cy + hh / 2 >= floor) { h.cy = floor - hh / 2; h.state = 'land'; h.landT = 0; }
    } else if (h.state === 'land') {        // 着地して、少し待ってから歩き出す(順番に)
      h.landT += dt;
      if (h.landT >= 120 + h.delay) h.state = 'walk';
    } else {                                // トコトコ左へ(飛ぶものは、ふわふわ左へ)
      h.walkT += dt;
      h.x -= HATCH_WALK * dt / 1000;
      if (h.x + w / 2 < 0) { h.gone = true; spawnMonsters([h.key], h.batch); }
    }
  }
  hatchlings = hatchlings.filter(h => !h.gone);
}
const whiteSil = new Map();
function whiteSilhouette(img) {   // 絵の形だけの白いシルエット
  let c = whiteSil.get(img);
  if (c || !img.naturalWidth) return c;
  c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const t = c.getContext('2d');
  t.drawImage(img, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = '#ffffff'; t.fillRect(0, 0, c.width, c.height);
  whiteSil.set(img, c);
  return c;
}
function drawHatch(g) {
  for (const h of hatchlings) {
    if (h.t < 0) continue;
    const img = monsterImgs[h.key];
    if (!img.complete || !img.naturalWidth) continue;
    const { w, h: hh, k } = hatchSize(h);
    const pop = Math.min(1, h.t / HATCH_POP), sc = 0.4 + 0.6 * (1 - Math.pow(1 - pop, 3));   // ぽんっと現れる
    const turn = Math.max(0, Math.min(1, (h.t - HATCH_POP) / (HATCH_TURN - HATCH_POP)));    // 0=白 1=本来の色
    const bob = h.state === 'walk' && HATCH_HOP_KEYS.includes(h.key) ? -Math.abs(Math.sin(h.walkT / HATCH_HOP_MS * Math.PI)) * 5   // トコトコ
              : h.state === 'fly' ? Math.sin(h.walkT / 300) * 2 : 0;                                  // ふわふわ
    const dw = w * sc, dh = hh * sc;
    g.save();
    g.translate(Math.round(h.x), Math.round(h.cy + bob));
    g.scale(-1, 1);                                     // 左向き(元の絵は右向き)
    if (turn < 1) {                                     // 白く光る姿
      g.globalAlpha = 1 - turn;
      g.shadowColor = 'rgba(255,255,255,0.95)'; g.shadowBlur = 16 * (1 - turn);
      g.drawImage(pixSrc(g, whiteSilhouette(img), k * sc)[0], -dw / 2, -dh / 2, dw, dh);
      g.shadowBlur = 0;
    }
    if (turn > 0) { g.globalAlpha = turn; g.drawImage(pixSrc(g, img, k * sc)[0], -dw / 2, -dh / 2, dw, dh); }
    g.restore();
  }
}

// 得点: n で 10 x 2^(n-1) 点(n=1 で10点、2で20点 … 9で2560点)。n は卵の数 + 消したライン数
function eggScore(n) { return n > 0 ? 10 * Math.pow(2, n - 1) : 0; }
function finishClear() {
  const { rows, eggs, keys } = clearing;
  for (const y of rows) // 消える行をまたぐつながりを切る(消えたあとで隣り合っても、つながって見えないように)
    for (let x = 0; x < COLS; x++) {
      const b = board[y][x];
      if (b) detachNeighbors(x, y, b.links || 0);
    }
  rows.slice().sort((a, b) => a - b).forEach(y => { board.splice(y, 1); board.unshift(Array(COLS).fill(null)); });
  lines += rows.length;
  score += clearing.points;
  level = Math.floor(lines / 10) + 1;
  clearing = null; parts = []; flash = [];
  cv.style.transform = '';
  updateHud();
  spawn();
}
const BURST = 0.3;          // 光ってから、粒になって弾けるまでの割合
const CLEAR_MS = 2000;      // ラインが消え終わるまで
function updateClear(dt) {
  const c = clearing, n = c.rows.length;
  c.t += dt;
  const p = Math.min(1, c.t / c.dur);
  if (!c.burst && p >= BURST) { // 行のブロックを粒にして中心から外へ飛ばす
    c.burst = true;
    hatchEggs(c.eggPos);
    // 紙ふぶき(めでたい!): 得点の文字のまわりから、色とりどりに舞い上がって落ちる
    const cols = ['#ffe27a', '#ff7a8a', '#7ad8ff', '#9aff8a', '#d89aff', '#ffffff', '#ffb04a'];
    const cy = clearTextY(c), cnt = 30 + 12 * Math.min(6, c.n);
    for (let i = 0; i < cnt; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 180 + Math.random() * 260;
      c.confetti.push({ x: COLS * CELL / 2 + (Math.random() - 0.5) * 120, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, color: cols[i % cols.length], w: 4 + Math.random() * 3 });
    }
    const mx = COLS * CELL / 2, my = (c.rows.reduce((a, b) => a + b, 0) / n + 0.5) * CELL;
    for (const r of c.rows) for (let col = 0; col < COLS; col++) {
      const b = board[r][col];
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.6) continue;
        const x = col * CELL + Math.random() * CELL, y = r * CELL + Math.random() * CELL;
        const ang = Math.atan2(y - my, x - mx) + (Math.random() - 0.5) * 1.4;
        const spd = (80 + Math.random() * 140 + 20 * n) * 0.315;
        parts.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          s: 6 + Math.random() * 4.8, life: 0.4 + Math.random() * 0.2, age: 0, color: b.color });
      }
    }
  }
  for (const pt of parts) { pt.age += dt / 1000; pt.x += pt.vx * dt / 1000; pt.y += pt.vy * dt / 1000; }
  for (const f of c.confetti) {   // 紙ふぶき: 空気でゆっくりになりながら落ちる
    f.vx *= Math.pow(0.35, dt / 1000); f.vy = f.vy * Math.pow(0.35, dt / 1000) + 420 * dt / 1000;
    f.x += f.vx * dt / 1000; f.y += f.vy * dt / 1000; f.rot += f.vr * dt / 1000;
  }
  // 盤面を、はじめだけ少し揺らす(行が多いほど大きく)
  cv.style.transform = !c.burst
    ? `translate(${((Math.random() - 0.5) * (2 + n * 1.5)).toFixed(1)}px, ${((Math.random() - 0.5) * (2 + n * 1.5)).toFixed(1)}px)` : '';
  if (p >= 1) finishClear();
}
function drawClearFx() {
  const c = clearing, n = c.rows.length, p = Math.min(1, c.t / c.dur);
  if (!c.burst) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 8 + 14 * (p / BURST);   // 光る
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.55 + p / BURST * 0.6)})`;
    for (const r of c.rows) ctx.fillRect(0, r * CELL, COLS * CELL, CELL);
    ctx.restore();
  } else {
    const q = (p - BURST) / (1 - BURST);
    ctx.fillStyle = `rgba(255,255,255,${1 - q * q})`;
    for (const r of c.rows) ctx.fillRect(0, r * CELL + CELL * q * 0.5, COLS * CELL, CELL * (1 - q));
    for (const pt of parts) {
      if (pt.age >= pt.life) continue;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s);
    }
  }
  // 紙ふぶき
  for (const f of c.confetti) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    ctx.fillStyle = f.color; ctx.fillRect(-f.w / 2, -1.5, f.w * Math.abs(Math.cos(f.rot * 1.7)) + 1, 3);
    ctx.restore();
  }
  // 得点を大きく、めでたく: 弾けた瞬間にどーんと出て、少し上へ浮きながら最後に消える
  if (c.burst) {
    const q = (p - BURST) / (1 - BURST), x = COLS * CELL / 2, y = clearTextY(c) - q * 24;
    const pop = q < 0.12 ? 1.9 - 0.9 * (q / 0.12) : 1 + 0.04 * Math.sin(q * 30) * (1 - q);   // ぽんっと大きく出て、少し揺れる
    const a = q > 0.8 ? 1 - (q - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(x, y); ctx.scale(pop, pop);
    ctx.font = pixFont(16);
    const info = 'ライン×' + c.rows.length + (c.eggs ? '　タマゴ×' + c.eggs : '');
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(info, 0, -30);
    ctx.fillStyle = '#ffffff'; ctx.fillText(info, 0, -30);
    ctx.font = pixFont(48);
    const txt = '+' + c.points;
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(60,20,0,0.9)'; ctx.strokeText(txt, 0, 4);
    ctx.shadowColor = 'rgba(255,200,60,0.9)'; ctx.shadowBlur = 18;
    ctx.fillStyle = (Math.floor(c.t / 90) % 2) ? '#ffe27a' : '#fff4b8';   // きらきら
    ctx.fillText(txt, 0, 4);
    ctx.restore();
  }
}
function clearTextY(c) {   // 得点を出す高さ: 消えるラインのあたり(盤面からはみ出さないように)
  const mid = c.rows.reduce((a, b) => a + b, 0) / c.rows.length;
  return Math.max(110, Math.min(ROWS * CELL - 70, mid * CELL));
}

// ---- 効果音(WebAudioで合成。PartlyRainy と同じやわらかい矩形波) ----
let actx = null, sfxOut = null, sfxWave = null;
function ensureCtx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
// [開始Hz, 終了Hz, 長さ(秒), 音量, 開始の遅れ(秒)]
const SFX = {
  move:   [[392, 392, .06, .085]],
  rotate: [[523, 523, .05, .08], [659, 659, .08, .08, .05]],
  soft:   [[262, 247, .045, .05]],
  hard:   [[587, 175, .16, .09]],
  touch:  [[165, 110, .13, .16]],
  land:   [[131, 73, .22, .20], [262, 147, .10, .04]],
  merge:  [[660, 1320, .12, .08], [990, 1980, .16, .07, .09]],   // 同じモンスターに体力が加わったとき(ピローん)
  clear: n => {
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093], k = Math.min(notes.length, 2 + n), out = [];
    for (let i = 0; i < k; i++) out.push([notes[i], notes[i], i === k - 1 ? .34 : .1, .09, i * .085]);
    if (n >= 3) out.push([262, 262, .3, .07, (k - 1) * .085]);
    if (n >= 4) out.unshift([130, 65, .25, .18, 0]);
    return out;
  },
};
function sfxWaveFor(ctx) {
  if (sfxWave && sfxWave.ctx === ctx) return sfxWave.w;
  const N = 16, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n += 2) im[n] = (4 / (Math.PI * n)) * Math.exp(-Math.pow((n - 1) / 2, 1.5));
  sfxWave = { ctx, w: ctx.createPeriodicWave(re, im) };
  return sfxWave.w;
}
function sfx(name, arg) {
  const ctx = ensureCtx(); if (!ctx || ctx.state !== 'running') return;
  if (!sfxOut) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = .4;
    const g = ctx.createGain(); g.gain.value = .7;
    lp.connect(g); g.connect(ctx.destination); sfxOut = lp;
  }
  const t0 = ctx.currentTime, wave = sfxWaveFor(ctx);
  const spec = typeof SFX[name] === 'function' ? SFX[name](arg) : SFX[name];
  for (const [f0, f1, dur, vol, delay = 0] of spec) {
    const t = t0 + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.setTargetAtTime(0, t + .012 + dur * .25, dur * .3);
    o.connect(g); g.connect(sfxOut);
    o.start(t); o.stop(t + dur * 2.2 + .06);
  }
}

// ---- BGM: music/bgm_score.js の楽譜(MIDI から作ったもの)を、やわらかいチップ音のオーケストラで鳴らす ----
// 最初にキーかボタンを押したときに鳴りはじめる(ブラウザは操作の前に音を出せない)。
// 楽譜が読めないときは、MP3(BGM_MP3)をループで鳴らす
const BGM_MP3 = 'music/Luneria-adventure-orchestra.mp3';
const BGM_VOL = 0.45;             // BGM の音量
const BGM_FADE = 0.4;             // ポーズ・ゲームオーバーで音を小さくするときの速さ(秒)
const BGM_AHEAD = 1.5;            // 何秒先までの音を予約しておくか(タブが裏にあっても途切れないように)
// パートごとの音色: wave = 波形, gain = 音量, a/r = 立ち上がり/余韻(秒), sus = 持続の音量, lp = こもらせる周波数(Hz),
// vib = ビブラート(半音), det = 2つ重ねて少しずらす(セント)
const BGM_VOICES = {               // 全パート、やわらかい矩形波(8ビット)。打楽器も矩形波で、ノイズは使わない
  trumpet:  { wave: 'pulse', gain: 0.20, a: 0.025, r: 0.10, lp: 2200, vib: 0.10, sus: 0.8 },
  horn:     { wave: 'pulse', gain: 0.22, a: 0.04,  r: 0.14, lp: 1300, sus: 0.85 },
  strings:  { wave: 'pulse', gain: 0.40, a: 0.10,  r: 0.28, lp: 1800, det: 7, vib: 0.06, sus: 1 },
  bass:     { wave: 'pulse', gain: 0.45, a: 0.01,  r: 0.07, lp: 900,  sus: 0.75 },
  woodwind: { wave: 'pulse', gain: 0.40, a: 0.02,  r: 0.10, lp: 2600, vib: 0.12, sus: 0.9 },
  chip:     { wave: 'pulse', gain: 1.40, a: 0.005, r: 0.05, lp: 3000, sus: 0.6 },
  timpani:  { drum: 'timp',  gain: 0.90 },
  snare:    { drum: 'snare', gain: 0.80 },
};
const bgmWaves = new WeakMap();   // オーディオの環境ごとに作った波形
function bgmCache(ctx) { let m = bgmWaves.get(ctx); if (!m) bgmWaves.set(ctx, m = {}); return m; }
function bgmWave(ctx, kind) {
  const m = bgmCache(ctx);
  if (m[kind]) return m[kind];
  const N = 24, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    const soft = Math.exp(-Math.pow((n - 1) / 3, 1.4));        // 高い倍音ほど弱く(耳ざわりにならないように)
    if (kind === 'pulse' && n % 2) im[n] = soft / n;            // 矩形波(8ビットらしさ)をやわらかく
    if (kind === 'tri' && n % 2) im[n] = (n % 4 === 1 ? 1 : -1) / (n * n);
    if (kind === 'saw') im[n] = soft / n;
    if (kind === 'flute') im[n] = n === 1 ? 1 : n === 2 ? 0.25 : n === 3 ? 0.08 : 0;
  }
  return m[kind] = ctx.createPeriodicWave(re, im);
}
// 1音を鳴らす。out に音をつなぎ、止めるための音源を list に入れる
function bgmNote(ctx, out, name, t, dur, note, vel, list) {
  const v = BGM_VOICES[name];
  if (!v) return;
  const amp = v.gain * vel / 127, f = 440 * Math.pow(2, (note - 69) / 12);
  const env = ctx.createGain(); env.connect(out);
  if (v.drum) {                                                  // 打楽器も矩形波: 音程がすっと下がる短い音(こもらせて、やわらかく)
    const snare = v.drum === 'snare';
    const o = ctx.createOscillator(); o.setPeriodicWave(bgmWave(ctx, 'pulse'));
    const f0 = snare ? 330 : f * 1.3, f1 = snare ? 160 : f, len = snare ? 0.05 : 0.16;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = snare ? 1800 : 900; lp.Q.value = 0.3;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(amp, t + 0.006);
    env.gain.setTargetAtTime(0, t + 0.01, len / 2);
    o.connect(lp); lp.connect(env); o.start(t); o.stop(t + len * 4 + 0.1); list.push(o);
    return;
  }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = v.lp; lp.Q.value = 0.3;
  lp.connect(env);
  const end = t + Math.max(dur, v.a + 0.02);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(amp, t + v.a);
  env.gain.setTargetAtTime(amp * v.sus, t + v.a, 0.12);
  env.gain.setTargetAtTime(0, end, v.r / 3);
  for (const c of (v.det ? [-v.det, v.det] : [0])) {
    const o = ctx.createOscillator();
    o.setPeriodicWave(bgmWave(ctx, v.wave));
    o.frequency.value = f; o.detune.value = c;
    if (v.vib && dur > 0.3) {                                    // 長い音にだけ、少し遅れてビブラート
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(v.vib * 100, t + 0.35);
      lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(end + v.r + 0.1); list.push(lfo);
    }
    o.connect(lp); o.start(t); o.stop(end + v.r + 0.1); list.push(o);
  }
}
// 曲全体の音を、時間順に1列に並べる
// ステージの曲: window.BGM_SCORES[属性](music/bgm_score_<名前>.js)。なければ共通の曲(window.BGM_SCORE)
function bgmScore() { return (window.BGM_SCORES || {})[stageAttr()] || window.BGM_SCORE || null; }
const bgmNotesCache = new Map();
function bgmScoreNotes(sc = bgmScore()) {
  if (!sc) return null;
  let notes = bgmNotesCache.get(sc);
  if (notes) return notes;
  notes = [];
  for (const tr of sc.tracks) for (const [t, d, n, v] of tr.notes) notes.push({ t, d, n, v, name: tr.name });
  notes.sort((a, b) => a.t - b.t);
  bgmNotesCache.set(sc, notes);
  return notes;
}
// 出口: こもらせて(耳ざわりな高音をけずる)、音割れしないようにまとめる
function bgmMaster(ctx, dest) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500; lp.Q.value = 0.3;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  lp.connect(comp); comp.connect(dest);
  return lp;
}
let bgm = null;                   // { gain, synth } または { gain, src }(MP3)または { el }(<audio>)
let bgmMuted = false;             // M キーで消す/鳴らす
function bgmWanted() { return !bgmMuted && !paused && !over; }
function bgmSchedule() {          // 少し先までの音を予約する(曲の最後まで行ったら頭に戻ってループ)
  const s = bgm && bgm.synth;
  if (!s) return;
  const notes = bgmScoreNotes(s.score), len = s.score.len, now = actx.currentTime, until = now + BGM_AHEAD;
  if (s.next < now) { s.next = now; s.k = Math.max(s.k, Math.floor((now - s.start) / len) - 1); }   // 長く止まっていたときは、いまから続ける
  s.live = s.live.filter(o => o.stopAt > now);
  // 何周目かは数えて持つ(時間から割り算で求めると、曲の切れ目で小数の誤差により進まなくなり、固まるため)
  while (s.next < until) {
    const base = s.start + s.k * len;
    if (s.next >= base + len) { s.k++; continue; }
    const to = Math.min(until, base + len);
    if (to <= s.next) break;   // 念のため: 進めないときは、次の予約にまわす
    for (const n of notes) {
      const t = base + n.t;
      if (t < s.next || t >= to) continue;
      const list = [];
      bgmNote(actx, s.out, n.name, t, n.d, n.n, n.v, list);
      for (const o of list) { o.stopAt = t + n.d + 1.5; s.live.push(o); }
    }
    s.next = to;
  }
}
async function startBgm() {
  if (bgm) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
  if (bgmScoreNotes() && !/mp3/.test(location.search)) {   // index.html?mp3 で開くと、くらべるために MP3 で鳴らす
    const out = bgmMaster(ctx, gain), start = ctx.currentTime + 0.1;
    bgm = { gain, synth: { out, start, next: start, k: 0, live: [], score: bgmScore() } };
    bgm.synth.timer = setInterval(bgmSchedule, 200);
    bgmSchedule();
  } else {
    bgm = { loading: true };
    try {
      const res = await fetch(BGM_MP3);
      if (!res.ok) throw new Error(res.status);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start();
      bgm = { gain, src };
    } catch (err) {
      const el = new Audio(BGM_MP3); el.loop = true; el.volume = 0;
      el.play().catch(() => {});
      bgm = { el };
    }
  }
  updateBgm();
}
function restartBgm() {           // リスタート: 曲の頭から(ステージの曲に切りかえる)
  if (!bgm || bgm.loading) return;
  if (bgm.synth) {
    const s = bgm.synth;
    for (const o of s.live) { try { o.stop(); } catch (e) {} }
    s.live = []; s.start = s.next = actx.currentTime + 0.1; s.k = 0; s.score = bgmScore();
    bgmSchedule();
  } else if (bgm.src) {
    const buf = bgm.src.buffer; bgm.src.stop();
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(bgm.gain); src.start();
    bgm.src = src;
  } else if (bgm.el) bgm.el.currentTime = 0;
}
const BGM_SWITCH_FADE = 0.5;      // ステージで曲が変わるとき、前の曲を消す時間(秒)
function switchBgm() {            // 次のステージの曲がちがえば、前の曲を少しで消して、新しい曲を頭から鳴らす
  const s = bgm && bgm.synth;
  if (!s || s.score === bgmScore() || s.switching) return;
  s.switching = true;
  const t = actx.currentTime;
  bgm.gain.gain.cancelScheduledValues(t);
  bgm.gain.gain.setTargetAtTime(0, t, BGM_SWITCH_FADE / 4);
  setTimeout(() => { s.switching = false; restartBgm(); updateBgm(); }, BGM_SWITCH_FADE * 1000);
}
function updateBgm() {            // 鳴らす/小さくする(状態が変わったときに呼ぶ)
  if (!bgm || bgm.loading) return;
  const v = bgmWanted() ? BGM_VOL : 0;
  if (bgm.gain) {
    const t = actx.currentTime;
    bgm.gain.gain.cancelScheduledValues(t);
    bgm.gain.gain.setTargetAtTime(v, t, BGM_FADE / 3);
  } else if (bgm.el) {
    bgm.el.volume = v;
    if (v > 0 && bgm.el.paused) bgm.el.play().catch(() => {});
  }
}
let bgmLastWanted = null;
function watchBgm() {             // 毎フレーム: ポーズ・ゲームオーバーの切り替わりで音量を変える
  const w = bgmWanted();
  if (w !== bgmLastWanted) { bgmLastWanted = w; updateBgm(); }
}

// 移動を試みる。穴が重なったらその位置に移動して固定。
function tryMove(dx, dy) {
  if (!cur) return false;
  const res = check(cur.cells, cur.x + dx, cur.y + dy);
  if (res === null) return false;
  cur.x += dx; cur.y += dy;
  if (res > 0) lockPiece();
  else if (dx !== 0) { resetLock(); sfx('move'); }
  return true;
}
function resetLock() {
  if (check(cur.cells, cur.x, cur.y + 1) === null && lockResets < 15) {
    lockTimer = 0; lockResets++;
  }
}

function rotate(dir) {
  const n = cur.n;
  const cells = cur.cells.map(([x, y, h]) =>
    dir > 0 ? [n - 1 - y, x, h] : [y, n - 1 - x, h]);
  const nr = (cur.r + dir + 4) % 4;
  const table = cur.name === 'I' ? KICK_I : KICK_JLSTZ;
  // O は位置を動かさず穴の位置だけ回す
  const kicks = cur.name === 'O' ? [[0, 0]] : table[cur.r + '>' + nr];
  for (const [kx, ky] of kicks) {
    const res = check(cells, cur.x + kx, cur.y + ky);
    if (res !== 0) continue; // 回転では穴同士の重なりは不可(そのキックは無効)
    cur.cells = cells; cur.r = nr; cur.x += kx; cur.y += ky;
    resetLock(); sfx('rotate');
    return;
  }
}

function hardDrop() {
  let d = 0;
  while (!over && cur) {
    const res = check(cur.cells, cur.x, cur.y + 1);
    if (res === null) break;
    cur.y++; d++;
    if (res > 0) { if (d > 0) sfx('hard'); lockPiece('land'); updateHud(); return; }
  }
  if (d > 0) sfx('hard');
  lockPiece('land');
  updateHud();
}

function gravityInterval() { return Math.max(70, 800 - (level - 1) * 70) / 0.3; }

function update(dt) {
  if (over || paused || stageClear) return;
  if (clearing) { updateClear(dt); return; }
  // 横方向オートリピート
  if (moveDir) {
    dasTimer += dt;
    while (dasTimer >= 150 + 40 && !over) { dasTimer -= 40; tryMove(moveDir, 0); }
  }
  if (clearing) return;
  const grounded = check(cur.cells, cur.x, cur.y + 1) === null;
  if (grounded) {
    lockTimer += dt;
    if (lockTimer >= 500) lockPiece();
    return;
  }
  lockTimer = 0;
  dropTimer += dt;
  const iv = softDrop ? Math.min(150, gravityInterval()) : gravityInterval();
  dropTimer = Math.min(dropTimer, iv * 2); // 溜まった通常落下の時間を一気に消費しない
  while (dropTimer >= iv && cur && !over) {
    dropTimer -= iv;
    // ソフトドロップでは、卵同士が重なる位置へは進まない(固定しない)。離すと通常の落下で重なる
    if (softDrop && check(cur.cells, cur.x, cur.y + 1) > 0) { dropTimer = 0; break; }
    const before = cur;
    if (!tryMove(0, 1)) break;
    if (softDrop) sfx('soft');
    if (cur !== before) break;
  }
}

function updateHud() {
  document.getElementById('score').textContent = score;
  document.getElementById('stage').textContent = stage;
}

// ---- 描画 ----
// 文字はドットフォント: 英字・数字・記号は Yodaka、日本語は美咲ゴシック。16px の倍数にそろえるとどちらもくっきり出る
function pixFont(px) { return Math.max(16, Math.round(px / 16) * 16) + "px Yodaka, Misaki, sans-serif"; }
// 英字は全角にする(A→Ａ、!→!、空白→全角空白)。数字と記号 + - / はそのまま
function zen(str) { return String(str).replace(/[A-Za-z!?]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)).replace(/ /g, '　'); }
function shade(hex, amt) {
  const v = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, c + amt));
  return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

// 白に向けて混ぜる (amt=1で元の色, 0で白)
function tint(hex, amt) {
  const v = parseInt(hex.slice(1), 16);
  const f = c => Math.round(255 + (c - 255) * amt);
  return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

// ---- ブロック描画: ミノ単位でつなげて描く ----
// links: そのマスがつながっている方向 (U/R/D/L のビット)。conc: 内側の角(凹角)のビット
const LU = 1, LR = 2, LD = 4, LL = 8;
const CTL = 1, CTR = 2, CBR = 4, CBL = 8;
const OUTLINE = 2;
const DIVIDER_ALPHA = 0.25; // 区切り線の濃さ(輪郭線に対する割合)

// 輪郭線の色: 白とセルの色の中間
const OUTLINE_MIX = 0.7; // 0=セルの色, 1=白
const outlineCache = new Map();
function outlineColor(hex) {
  let c = outlineCache.get(hex);
  if (c) return c;
  const v = parseInt(hex.slice(1), 16);
  const f = ch => Math.round(ch + (255 - ch) * OUTLINE_MIX);
  c = `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
  outlineCache.set(hex, c);
  return c;
}

// 塗りの色: 輪郭や卵の色はそのままで、ブロックの塗りだけ少し暗くする
const FILL_DARK = 0.85; // 1=そのまま
const fillCache = new Map();
function fillColor(hex) {
  let c = fillCache.get(hex);
  if (c) return c;
  const v = parseInt(hex.slice(1), 16);
  const f = ch => Math.round(ch * FILL_DARK);
  c = `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
  fillCache.set(hex, c);
  return c;
}

// ミノのマス配列 [[x,y,hole],...] からつながり情報を作る
function shapeItems(cells, color) {
  const has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
  return cells.map(([x, y, h]) => {
    const u = has(x, y - 1), r = has(x + 1, y), d = has(x, y + 1), l = has(x - 1, y);
    return {
      x, y, color, hole: !!h, rivet: false, under: null,
      links: (u ? LU : 0) | (r ? LR : 0) | (d ? LD : 0) | (l ? LL : 0),
      conc: (u && l && !has(x - 1, y - 1) ? CTL : 0) | (u && r && !has(x + 1, y - 1) ? CTR : 0) |
            (d && r && !has(x + 1, y + 1) ? CBR : 0) | (d && l && !has(x - 1, y + 1) ? CBL : 0),
    };
  });
}

// 盤面のマスのつながり情報から、内側の角を求める
function boardConc(x, y, b) {
  const at = (xx, yy) => (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS) ? board[yy][xx] : null;
  const u = at(x, y - 1), d = at(x, y + 1), k = b.links;
  return (k & LU && k & LL && !(u && u.links & LL) ? CTL : 0) | (k & LU && k & LR && !(u && u.links & LR) ? CTR : 0) |
         (k & LD && k & LR && !(d && d.links & LR) ? CBR : 0) | (k & LD && k & LL && !(d && d.links & LL) ? CBL : 0);
}

// 1マス分の形。phase 0 = 輪郭色の面、phase 1 = 塗り(つながった辺は枠いっぱいまで)
function drawCell(g, px, py, s, color, links, conc, phase, lw = OUTLINE, ocol = null) {
  const r = s * 0.25;
  const u = links & LU, rt = links & LR, d = links & LD, l = links & LL;
  const rad = (a, b) => (!a && !b) ? r : 0;   // 角丸は、どちらの隣ともつながっていない外側の角だけ
  const tl = rad(u, l), tr = rad(u, rt), br = rad(d, rt), bl = rad(d, l);
  g.beginPath();
  if (phase === 0) {
    g.roundRect(px, py, s, s, [tl, tr, br, bl]);
    g.fillStyle = (ocol || outlineColor(color)); g.fill();
  } else {
    const x0 = px + (l ? 0 : lw), y0 = py + (u ? 0 : lw), x1 = px + s - (rt ? 0 : lw), y1 = py + s - (d ? 0 : lw);
    const m = v => Math.max(0, v - lw);
    g.roundRect(x0, y0, x1 - x0, y1 - y0, [m(tl), m(tr), m(br), m(bl)]);
    g.fillStyle = fillColor(color); g.fill();
  }
  // 内側の角: 空きマス側へ丸くふくらませる
  const corners = [[CTL, -1, -1, px, py], [CTR, 1, -1, px + s, py], [CBR, 1, 1, px + s, py + s], [CBL, -1, 1, px, py + s]];
  for (const [bit, sx, sy, cx, cy] of corners) {
    if (!(conc & bit)) continue;
    const ccx = cx + sx * r, ccy = cy + sy * r;            // 丸みの中心(空きマス側)
    const ext = phase === 0 ? 0 : lw, rr = r + ext;         // 塗りは、輪郭の分だけ内側(となり側)へ広げる
    const qx = cx - sx * ext, qy = cy - sy * ext;           // 角の手前の点
    const a0 = Math.atan2(-sy, 0), a1 = Math.atan2(0, -sx);
    let dl = a1 - a0; while (dl > Math.PI) dl -= Math.PI * 2; while (dl <= -Math.PI) dl += Math.PI * 2;
    g.beginPath();                                          // 四角から1/4円を引いた形を、1本の経路で描く(継ぎ目を出さない)
    g.moveTo(qx, qy); g.lineTo(ccx, qy);
    g.arc(ccx, ccy, rr, a0, a1, dl < 0);
    g.closePath();
    g.fillStyle = phase === 0 ? (ocol || outlineColor(color)) : fillColor(color); g.fill();
  }
}

function drawEgg(g, cx, cy, color, hole, rivet, under) {
  if (!hole && !rivet) return;
  const es = rivet ? EGG_PX * RIVET_EGG_K : EGG_PX;   // 水玉の卵(合体した卵)は大きく
  const x0 = Math.round(cx - es / 2), y0 = Math.round(cy - es / 2);
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  if (!rivet) { // 合体前の卵は彩度を下げる
    const b = desatBase();
    if (b) g.drawImage(b, x0, y0, es, es);
  } else if (IMG.base.complete) g.drawImage(IMG.base, x0, y0, es, es);
  if (rivet) {
    const m1 = coloredMask(IMG.mask1, color), m2 = coloredMask(IMG.mask2, under || color);
    if (m1) g.drawImage(m1, x0, y0, es, es);
    if (m2) g.drawImage(m2, x0, y0, es, es);
  }
  g.imageSmoothingEnabled = smooth;
}

// ---- 生まれそうな卵: 横のラインがあと少しでそろうとき、そのラインの卵がときどき左右にぷるっとふるえる ----
// [空きマスの数]: 平均の間隔(ミリ秒)、ふれ幅(px)
const WOBBLE = { 2: { itv: 8000, amp: 2 }, 1: { itv: 5000, amp: 4 } };
const WOBBLE_MS = 420;            // 1回のぷるっの長さ
const WOBBLE_HZ = 4;              // ぷるっの往復の回数(この時間のあいだ)
// 色のついた(水玉の)卵だけ。卵ごとにばらばらのタイミングで、同時にふるえるのは1つだけ(操作のじゃまにならないように)
let wobbling = null;              // いまふるえている卵(盤面のマス)
function wobbleWait(itv) { return itv * (0.5 + Math.random()); }   // 間隔は平均の半分〜1.5倍でばらつかせる
function updateWobble(dt) {
  if (wobbling) {
    wobbling.wob.t += dt;
    if (wobbling.wob.t >= WOBBLE_MS) { wobbling.wob.t = -1; wobbling.wob.wait = wobbleWait(WOBBLE[wobbling.wob.empty].itv); wobbling = null; }
  }
  let found = false;
  for (let y = 0; y < ROWS; y++) {
    const empty = board[y].filter(c => !c).length, w = WOBBLE[empty];
    for (const c of board[y]) {
      if (!c || !c.rivet) continue;
      if (!w || !c.wob || c.wob.empty !== empty) { if (c === wobbling) wobbling = null; }
      if (!w) { c.wob = null; continue; }
      if (!c.wob || c.wob.empty !== empty) c.wob = { empty, wait: wobbleWait(w.itv), t: -1 };
      if (c === wobbling) { found = true; continue; }
      if ((c.wob.wait -= dt) <= 0) {
        if (!wobbling) { wobbling = c; c.wob.t = 0; found = true; }
        else c.wob.wait = 300 + Math.random() * 1500;   // 別の卵がふるえ中: 少しあとにずらす
      }
    }
  }
  if (wobbling && !found) wobbling = null;   // ラインが消えるなどして、盤面からいなくなった
}
function wobbleX(c) {             // その卵の、いまの横のずれ(px)
  const r = c.wob;
  if (c !== wobbling || !r || r.t < 0) return 0;
  const q = r.t / WOBBLE_MS;
  return Math.round(WOBBLE[r.empty].amp * Math.sin(q * Math.PI * 2 * WOBBLE_HZ) * (1 - q));
}

// items: {px,py,s,color,hole,rivet,under,links,conc}。全マスの輪郭面 → 塗り → 卵の順に描く(継ぎ目を出さないため)
let scratch = null;
function drawGroup(g, items, alpha = 1) {
  if (!items.length) return;
  let t = g;
  if (alpha < 1) {
    if (!scratch) scratch = document.createElement('canvas');
    scratch.width = g.canvas.width; scratch.height = g.canvas.height;
    t = scratch.getContext('2d');
  }
  for (let phase = 0; phase < 2; phase++)
    for (const it of items) drawCell(t, it.px, it.py, it.s, it.color, it.links, it.conc, phase);
  for (const it of items) { // ミノ内のマスの境目にも、輪郭と同じ太さの線を引く
    t.fillStyle = outlineColor(it.color);
    t.globalAlpha = DIVIDER_ALPHA;
    if (it.links & LR) t.fillRect(it.px + it.s - OUTLINE / 2, it.py, OUTLINE, it.s);
    if (it.links & LD) t.fillRect(it.px, it.py + it.s - OUTLINE / 2, it.s, OUTLINE);
    t.globalAlpha = 1;
  }
  for (const it of items) { // 凹み角では、2本の境目の線の端がL字に残るので、角のまわりを塗りつぶして消す
    if (!it.conc) continue;
    t.fillStyle = fillColor(it.color);
    const cs = [[CTL, -1, -1, it.px, it.py], [CTR, 1, -1, it.px + it.s, it.py],
                [CBR, 1, 1, it.px + it.s, it.py + it.s], [CBL, -1, 1, it.px, it.py + it.s]];
    for (const [bit, sx, sy, cx, cy] of cs) {
      if (!(it.conc & bit)) continue;
      const xa = cx - sx * OUTLINE, xb = cx + sx * (OUTLINE / 2), ya = cy - sy * OUTLINE, yb = cy + sy * (OUTLINE / 2);
      t.fillRect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya));
    }
  }
  for (const it of items) drawEgg(t, it.px + it.s / 2 + (it.dx || 0), it.py + it.s / 2, it.color, it.hole, it.rivet, it.under);
  if (t !== g) { g.globalAlpha = alpha; g.drawImage(scratch, 0, 0); g.globalAlpha = 1; }
}
// 落下予定: ミノの外形(角丸・凹み角つき)をブロックの色の1pxの線で、卵は白い線の円で表す
function drawGhost(g, items) {
  if (!items.length) return;
  if (!scratch) scratch = document.createElement('canvas');
  scratch.width = g.canvas.width; scratch.height = g.canvas.height;
  const t = scratch.getContext('2d');
  for (const it of items) drawCell(t, it.px, it.py, it.s, it.color, it.links, it.conc, 0, OUTLINE, it.color); // 外形をブロックの色(白をまぜない)で塗り
  t.globalCompositeOperation = 'destination-out';
  for (const it of items) drawCell(t, it.px, it.py, it.s, it.color, it.links, it.conc, 1, 1);             // 1px内側を抜く → 1pxの線
  t.globalCompositeOperation = 'source-over';
  g.drawImage(scratch, 0, 0);
  g.strokeStyle = '#fff'; g.lineWidth = 1;
  for (const it of items) {
    if (!it.hole) continue;
    g.beginPath(); g.arc(it.px + it.s / 2, it.py + it.s / 2, EGG_PX / 2 - 1, 0, Math.PI * 2); g.stroke();
  }
}
// ミノのマスを画面位置つきの描画項目にする
function pieceItems(cells, color, ox, oy, s, skipAbove) {
  const out = [];
  for (const it of shapeItems(cells, color)) {
    const py = oy + it.y * s;
    if (skipAbove && py < 0) continue;
    out.push({ ...it, px: ox + it.x * s, py, s });
  }
  return out;
}

// ---- 画像 ----
const EGG_PX = 20; // 卵画像の原寸(等倍で表示)
const RIVET_EGG_K = 1.5;  // 水玉の卵の表示の倍率
function loadImg(src) { const i = new Image(); i.src = src; return i; }
const IMG = {
  base: loadImg('image/color_egg_base.png'),
  mask1: loadImg('image/color_egg_color1.png'),
  mask2: loadImg('image/color_egg_color2.png'),
};
const EGG_DESAT = 0.6; // 合体前の卵の彩度をどれだけ下げるか(0=そのまま, 1=無彩色)
let desatCanvas = null;
function desatBase() {
  const img = IMG.base;
  if (!img.complete || !img.naturalWidth) return null;
  if (!desatCanvas) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = EGG_DESAT; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0); // 透明部分を元に戻す
    desatCanvas = c;
  }
  return desatCanvas;
}
const maskCache = new Map();
function coloredMask(img, color) {
  if (!img.complete || !img.naturalWidth) return null;
  const key = img.src + color;
  let c = maskCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    maskCache.set(key, c);
  }
  return c;
}

// ---- モンスター: 水玉卵(2色の組み合わせ)ごとに、画面下を左から右へ ----
// 拡大率(scale)と浮遊の高さ(float, px)。画像は image/<キー>.png (右向き)
const MONSTERS = {"ZZ":{"scale":1.3,"float":45,"hp":160,"atk":28,"def":5,"spd":24,"itv":1.0,"rng":30,"eva":5,"tackle":22,"style":"magic"},"ZJ":{"scale":1.02,"float":0,"hp":90,"atk":12,"def":8,"spd":22,"itv":1.1,"rng":30,"eva":5,"tackle":9,"style":"magic"},"ZS":{"scale":1.02,"float":0,"hp":95,"atk":12,"def":10,"spd":21,"itv":1.1,"rng":30,"eva":2,"tackle":14,"style":"magic"},"ZO":{"scale":0.72,"float":40,"hp":80,"atk":13,"def":5,"spd":29,"itv":0.9,"rng":30,"eva":8,"tackle":14,"style":"magic"},"ZI":{"scale":1.1,"float":55,"hp":75,"atk":12,"def":5,"spd":26,"itv":1.0,"rng":55,"eva":15,"tackle":8,"style":"magic"},"ZL":{"scale":1.0,"float":0,"hp":115,"atk":14,"def":15,"spd":19,"itv":1.2,"rng":25,"eva":2,"tackle":18,"style":"tackle"},"ZT":{"scale":0.95,"float":0,"hp":85,"atk":12,"def":8,"spd":23,"itv":1.1,"rng":50,"eva":10,"tackle":8,"style":"magic"},"JJ":{"scale":1.3,"float":0,"hp":200,"atk":20,"def":10,"spd":20,"itv":1.1,"rng":25,"eva":5,"tackle":14,"style":"magic"},"JS":{"scale":1.0,"float":0,"hp":105,"atk":10,"def":12,"spd":19,"itv":1.1,"rng":25,"eva":2,"tackle":12,"style":"magic"},"JO":{"scale":0.76,"float":0,"hp":90,"atk":11,"def":8,"spd":27,"itv":1.0,"rng":30,"eva":8,"tackle":12,"style":"magic"},"JI":{"scale":1.2,"float":30,"hp":85,"atk":10,"def":8,"spd":24,"itv":1.1,"rng":50,"eva":15,"tackle":6,"style":"magic"},"JL":{"scale":1.1,"float":0,"hp":125,"atk":12,"def":18,"spd":17,"itv":1.2,"rng":20,"eva":2,"tackle":16,"style":"tackle"},"JT":{"scale":1.105,"float":0,"hp":95,"atk":10,"def":10,"spd":21,"itv":1.1,"rng":50,"eva":10,"tackle":6,"style":"magic"},"SS":{"scale":1.248,"float":0,"hp":220,"atk":20,"def":15,"spd":18,"itv":1.2,"rng":25,"eva":0,"tackle":32,"style":"tackle"},"SO":{"scale":1.1,"float":0,"hp":95,"atk":11,"def":10,"spd":26,"itv":1.0,"rng":30,"eva":5,"tackle":17,"style":"tackle"},"SI":{"scale":0.88,"float":28,"hp":90,"atk":10,"def":10,"spd":23,"itv":1.1,"rng":50,"eva":12,"tackle":10,"style":"magic"},"SL":{"scale":1.21,"float":0,"hp":130,"atk":12,"def":20,"spd":16,"itv":1.3,"rng":20,"eva":0,"tackle":20,"style":"tackle"},"ST":{"scale":1.1,"float":0,"hp":100,"atk":10,"def":12,"spd":20,"itv":1.1,"rng":50,"eva":8,"tackle":11,"style":"magic"},"OO":{"scale":1.3585,"float":0,"hp":160,"atk":24,"def":5,"spd":34,"itv":0.8,"rng":30,"eva":10,"tackle":36,"style":"tackle"},"OI":{"scale":1.089,"float":35,"hp":75,"atk":10,"def":5,"spd":31,"itv":0.9,"rng":55,"eva":18,"tackle":12,"style":"magic"},"OL":{"scale":1.089,"float":0,"hp":115,"atk":12,"def":15,"spd":24,"itv":1.1,"rng":25,"eva":5,"tackle":21,"style":"tackle"},"OT":{"scale":0.9,"float":0,"hp":85,"atk":12,"def":8,"spd":28,"itv":1.0,"rng":50,"eva":12,"tackle":12,"style":"magic"},"II":{"scale":0.858,"float":37,"hp":140,"atk":18,"def":5,"spd":28,"itv":1.0,"rng":80,"eva":25,"tackle":10,"style":"magic"},"IL":{"scale":1.265,"float":0,"hp":110,"atk":11,"def":15,"spd":21,"itv":1.2,"rng":50,"eva":12,"tackle":14,"style":"tackle"},"IT":{"scale":0.9,"float":50,"hp":80,"atk":10,"def":8,"spd":25,"itv":1.1,"rng":75,"eva":20,"tackle":6,"style":"magic"},"LL":{"scale":1.17,"float":0,"hp":300,"atk":26,"def":25,"spd":14,"itv":1.4,"rng":20,"eva":0,"tackle":48,"style":"tackle"},"LT":{"scale":1.089,"float":0,"hp":120,"atk":12,"def":18,"spd":18,"itv":1.2,"rng":45,"eva":8,"tackle":15,"style":"tackle"},"TT":{"scale":0.7092,"float":35,"hp":180,"atk":22,"def":10,"spd":22,"itv":1.1,"rng":70,"eva":15,"tackle":12,"style":"magic"}};
const MON_ORDER = 'ZJSOILT'; // キー(ミノ2文字)の並び順。Z=火 J=水 S=草 O=雷 I=氷 L=地 T=闇
const MON_SPEED = 70 * 0.3; // 以前の3割
const MON_MOVE_RATE = 0.5;  // 全個体の移動速度を半分にする
const FIELD_W = 500, FIELD_H = 120, FEET_Y = 112; // フィールドの大きさと、足元の高さ
function monsterKey(a, b) {
  return MON_ORDER.indexOf(a) <= MON_ORDER.indexOf(b) ? a + b : b + a;
}
const monsterImgs = {};
for (const k in MONSTERS) monsterImgs[k] = loadImg('image/monster/' + k + '.png');
const MON_GROW = 1.2;       // 同じモンスターが加わるたびに大きくなる倍率
const MON_GROW_MAX = 1.8;   // 大きくなる上限(元の大きさに対する倍率)
function spawnMonsters(keys, batchN = keys.length) {
  // まとめて発生させたモンスター(batchN 体)は、全員の攻撃力が (n-1) x 10% 上がる
  const atkMul = 1 + (batchN - 1) * 0.1;
  // 速いモンスターから先に出す
  const order = keys.filter(k => MONSTERS[k]).sort((a, b) => MONSTERS[b].spd - MONSTERS[a].spd);
  for (const k of order) {
    // 同じモンスターがもういれば、新しく出さずに、その体力を足して少し大きくする
    const ex = monsters.find(m => m.key === k && !m.dead);
    if (ex) {
      const add = MONSTERS[k].hp;
      ex.hp += add; ex.maxHp += add;
      ex.size = Math.min(MON_GROW_MAX, (ex.size || 1) * MON_GROW);
      ex.atkMul = Math.max(ex.atkMul || 1, atkMul);
      popups.push({ unit: ex, text: '+' + add, color: '#7dff8a', t: 0, life: 1800, big: true });
      sfx('merge');
      continue;
    }
    monsters.push({ key: k, x: 0, t: 0, started: false, hp: MONSTERS[k].hp, maxHp: MONSTERS[k].hp, cd: 400, size: 1, atkMul });
  }
}
const MON_SIZE = 0.77;      // モンスターの表示サイズ(全体の倍率。浮く高さも同じ割合で縮める)
const MON_OWN = 0.25;       // 各モンスターが自分だけで持つ幅の割合(これより奥へは重ならせない)
const MON_DEPART = 0.25;    // 出発のとき、前のモンスターと自分の幅のどれだけ重なったら出るか
// 小さく見えるモンスターだけ大きくする: 見た目の大きさ(幅x高さの平方根)が SMALL_LO 以下なら x1.2、SMALL_HI 以上はそのまま(間はなめらかに)
const SMALL_LO = 50, SMALL_HI = 62, SMALL_BOOST = 1.2;
function monBoost(key) {
  const img = monsterImgs[key];
  if (!img.naturalWidth) return 1;
  const sc = MONSTERS[key].scale * MON_SIZE, size = Math.sqrt(img.naturalWidth * sc * img.naturalHeight * sc);
  const q = Math.max(0, Math.min(1, (SMALL_HI - size) / (SMALL_HI - SMALL_LO)));
  return 1 + (SMALL_BOOST - 1) * q;
}
function monScale(m) { return MONSTERS[m.key].scale * MON_SIZE * monBoost(m.key) * (m.size || 1); }
function monWidth(m) { return (monsterImgs[m.key].naturalWidth || 100) * monScale(m); }
function monSpeed(m) { return (MONSTERS[m.key].spd || MON_SPEED) * MON_MOVE_RATE; }
// 呼び出したモンスターの幅のぶんだけ、敵(ボス)を後ろへ押し戻す(扉から出すぎない範囲で)
const PUSH_ZAKO = 0.3, PUSH_BOSS = 0.03;   // 押し戻す量(呼び出したモンスターの幅に対する割合)。ボスはほとんど動かない
function pushBackEnemies(w) {
  for (const e of enemies) {
    if (e.dead) continue;
    const cap = DOOR_X - enemySize(e)[0] * 0.5;
    if (e.x < cap) e.x = Math.min(cap, e.x + w * (e.boss ? PUSH_BOSS : PUSH_ZAKO));
  }
}
function updateMonsters(dt) {
  if (stageClear) {                // ステージクリア: 扉を通って右へはける
    if (exiting()) for (const m of monsters) { m.x += EXIT_SPEED * dt / 1000; m.t += dt; }
    monsters = monsters.filter(m => m.x < FIELD_W + 4);
    return;
  }
  // 出発: ルネリアの杖の先から出てくる。前のモンスターが進んで、自分の幅の1/4ぶん重なる位置まで空いたら次が出る。
  // 1体出すたびに、ルネリアが杖をふる(3体なら3回)
  let prev = null;
  for (const m of monsters) {
    if (!m.started) {
      const w = monWidth(m), sx = staffTipX() - w / 2;
      if (prev && (!prev.started || prev.x < sx + (1 - MON_DEPART) * w)) break;
      m.started = true; m.x = sx; m.pop = POP_MS;
      summonT = SUMMON_MS;
      pushBackEnemies(w);
    }
    prev = m;
  }
  // 行き止まり: 右端。敵がいるときは敵の体が壁になり、敵が進むと押し戻される
  const endX = allyEndX();
  const e0 = frontEnemy();
  // 移動中は独立して進み、速い個体は遅い個体を追い越せる。攻撃が届く敵がいれば、止まって戦う。
  // 行き止まりに着いたものだけ、着いた順に、専有幅を確保して並ぶ
  const act = monsters.filter(m => m.started && !m.dead);
  const queued = act.filter(m => m.queueOrder !== undefined).sort((a, b) => a.queueOrder - b.queueOrder);
  let frontX = null;
  let nextOrder = queued.length ? queued[queued.length - 1].queueOrder + 1 : 0;
  for (const m of queued) {
    const w = monWidth(m);
    const target = frontX === null ? endX - w : frontX - MON_OWN * w;
    // 押し戻されるときはすぐ、前が空いたときは自分の速さで詰める
    m.x = target < m.x ? target : Math.min(m.x + monSpeed(m) * dt / 1000, target);
    frontX = m.x;
  }
  const moving = act.filter(m => m.queueOrder === undefined);
  const destinations = new Map(moving.map(m => [m, (e0 && allyInRange(m, e0)) ? m.x : m.x + monSpeed(m) * dt / 1000]));
  moving.sort((a, b) => (destinations.get(b) + monWidth(b)) - (destinations.get(a) + monWidth(a)));
  for (const m of moving) {
    const w = monWidth(m);
    const limit = frontX === null ? endX - w : Math.min(endX - w, frontX - MON_OWN * w);
    const destination = destinations.get(m);
    m.x = Math.min(destination, limit);
    if (destination >= limit) {
      m.queueOrder = nextOrder++;
      frontX = m.x;
    }
  }
  for (const m of monsters) if (m.started) m.t += dt;
}
function monBox(m) {
  const img = monsterImgs[m.key], sc = monScale(m), fl = MONSTERS[m.key].float * MON_SIZE;
  const w = (img.naturalWidth || 100) * sc, h = (img.naturalHeight || 100) * sc;
  const sway = fl ? Math.sin(m.t / 400) * 3 : exitHop(m.t); // 浮遊するものだけ、ゆっくり上下にゆれる(地上は、はけるときだけトコトコ跳ねる)
  return { x: m.x + lungeOffset(m), y: FEET_Y - h - fl - sway, w, h, fl };
}
function drawMonsters(g) {
  g.imageSmoothingEnabled = false;   // ドット絵は補間せず、ぼかさずに拡大・縮小する
  // 右(前)のモンスターが、左(後ろ)のモンスターより手前に見えるように、左から順に描く
  const list = monsters.filter(m => m.started).sort((a, b) => a.x - b.x);
  for (const m of list) {
    const img = monsterImgs[m.key];
    if (!img.complete || !img.naturalWidth) continue;
    const b = monBox(m);
    g.globalAlpha = unitAlpha(m);
    const [src] = pixSrc(g, img, b.w / img.naturalWidth * FIELD_SCALE);
    g.drawImage(src, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
    g.globalAlpha = 1;
    if (!m.dead && m.hp < m.maxHp) drawHpBar(g, b.x + b.w / 2, b.y - 4, Math.min(30, b.w), m.hp / m.maxHp, '#5fd35f');
  }
}

// ---- 敵: 1ステージは ザコ10体 → ボス1体 ----
// ザコ: image/enemy/enemy_<名前>.png(左向き)。属性なし。強さで3段階(tier)に分け、ステージが進むほど強いものが多く出る。
// ボス: image/boss/BOSS_<キー>.png(左向き)。ステータスは同じキーのモンスター(MONSTERS)を巨大にしたもの
const ENEMY_KEYS = ['ZZ', 'JJ', 'SS', 'OO', 'II', 'LL', 'TT'];   // ボスになるキー
const ENEMY_H = 103;              // ボスの高さ(px)
const ENEMY_SPEED_RATE = 1 / 8;   // ボスの速さ: こちらのモンスターの速さに対する倍率
const ENEMY_HP_MUL = 14;          // ボスのHPは14倍
const BOSS_MOVE = 1.5;            // ボスの移動の速さの倍率
const BOSS_FAST = { OO: 2, II: 2 };   // 足の速そうなボス(雷・氷)は2倍。そのかわり攻撃力は 1.5/2 = 0.75倍
const ENEMY_ATK_MUL = 3;          // ボスの攻撃力・体当たり力は3倍
const ENEMY_ITV_MUL = 1.4;        // ボスの攻撃の間隔は1.4倍(ゆっくり)
const ENEMY_RANGE_MUL = 0.5;      // ボスの魔法の届く距離は半分(味方の魔法が先に届くように)
const ALLY_ATK_MUL = 1.5;         // 味方の攻撃力・体当たり力の全体倍率(ゲームバランス用)
const ENEMY_SPLASH = 0.6;         // ボスの攻撃は、届く範囲の味方みんなに当たる(狙った相手以外はこの割合)
const ENEMY_RESPAWN = 5000;       // ステージが始まってから、最初の敵が出るまで(ミリ秒)
const ENEMY_WALL = 0.12;          // こちらのモンスターが、敵の体にどれだけ重なれるか(敵の幅の割合)
const ENEMY_IN = 0.6;             // 敵の体がこの割合まで扉から出たら、腰を据えて戦う
const BOSS_FLOAT = { TT: 6 };     // ボスの浮く高さ(px)
const BOSS_SINK = { SS: 5, II: 3, ZZ: 3 };   // 絵の下の余白(根の先など)で浮いて見えるボスを、この分だけ下げる(px)
const BOSS_ENTER_SHOW = 0.3;      // ボスは、体のこの割合が開いた扉(手前の扉板)から見えるまでは、
const BOSS_ENTER_SPEED = 3;       // この倍の速さで出てくる(止まらず、こちらのモンスターを押しのける)
const DOOR_FRONT_L = 123;         // 開いた扉の手前の扉板の左端(絵の中の横の位置)     // ボスの浮く高さ(px)
const ZAKO_PER_STAGE = 5;         // 1ステージのザコの数(2種類が交互に出る)
const ZAKO_TIERS = [[1, 1], [1, 2], [2, 2], [2, 3], [2, 3], [3, 3], [3, 3]];   // ステージごとの、2種類のザコの強さの段階
const ZAKO_MIX = [0, 0, 1, 0, 1];                    // 出てくる順(0 = 1種類目、1 = 2種類目)
const ZAKO_INTERVAL = 6000;       // ザコが次々に出てくる間隔(ミリ秒)
const ZAKO_SCALE = 1.69;          // ザコの表示の大きさ(下の表の高さ h に対する倍率)
const ZAKO_HP_MUL = 4;            // ザコの体力の倍率(下の表の hp に対して)
const ZAKO_ALIVE = 3;             // 同時にいるザコの上限
const ZAKO_BONUS = 50;            // ザコを倒した得点 x ステージ
// ザコの表: 名前(英, 日), 強さの段階, 表示の高さ h(px), 体力, 攻撃力, 防御%, 速さ(px/秒), 攻撃間隔(秒), 攻撃方法, 射程, 浮く高さ, 魔法の見た目
const ZAKO = {
  slime:    { en: 'Slime', ja: 'スライム', tier: 1, h: 20, hp: 60, atk: 7, def: 0, spd: 7, itv: 1.2, style: 'tackle' },
  blue:     { en: 'Blue Ooze', ja: 'ブルーウーズ', tier: 1, h: 22, hp: 75, atk: 7, def: 10, spd: 6, itv: 1.3, style: 'tackle' },
  bat:      { en: 'Cave Bat', ja: 'ケイブバット', tier: 1, h: 22, hp: 45, atk: 8, def: 0, spd: 14, itv: 0.9, style: 'tackle', float: 22 },
  rockling: { en: 'Rockling', ja: 'ロックリング', tier: 1, h: 33.6, hp: 110, atk: 8, def: 30, spd: 5, itv: 1.5, style: 'tackle' },
  servant:  { en: 'Bone Servant', ja: 'ボーンサーヴァント', tier: 1, h: 30, hp: 70, atk: 10, def: 5, spd: 9, itv: 1.1, style: 'tackle' },
  crawler:  { en: 'Eye Crawler', ja: 'アイクローラー', tier: 2, h: 22, hp: 90, atk: 11, def: 5, spd: 6, itv: 1.3, style: 'magic', rng: 50, fx: '闇' },
  goblin:   { en: 'Goblin', ja: 'ゴブリン', tier: 2, h: 27, hp: 110, atk: 13, def: 5, spd: 10, itv: 1.0, style: 'tackle' },
  kobold:   { en: 'Kobold', ja: 'コボルト', tier: 2, h: 34, hp: 100, atk: 14, def: 5, spd: 12, itv: 1.0, style: 'tackle' },
  wolf:     { en: 'Dire Wolf', ja: 'ダイアウルフ', tier: 2, h: 28, hp: 100, atk: 15, def: 5, spd: 16, itv: 0.8, style: 'tackle' },
  scorpion: { en: 'Scorpion', ja: 'スコーピオン', tier: 2, h: 30, hp: 120, atk: 14, def: 20, spd: 8, itv: 1.1, style: 'tackle' },
  orc:      { en: 'Orc', ja: 'オーク', tier: 3, h: 40, hp: 220, atk: 22, def: 15, spd: 7, itv: 1.4, style: 'tackle' },
  mummy:    { en: 'Mummy', ja: 'マミー', tier: 3, h: 35, hp: 240, atk: 16, def: 10, spd: 5, itv: 1.3, style: 'tackle' },
  spider:   { en: 'Giant Spider', ja: 'ジャイアントスパイダー', tier: 3, h: 39.6, hp: 200, atk: 18, def: 10, spd: 9, itv: 1.1, style: 'tackle' },
  ghost:    { en: 'Ghost', ja: 'ゴースト', tier: 3, h: 39.2, hp: 160, atk: 18, def: 0, spd: 6, itv: 1.2, style: 'magic', rng: 60, float: 6, fx: '闇' },
  harpy:    { en: 'Harpy', ja: 'ハーピー', tier: 3, h: 37.44, hp: 170, atk: 17, def: 5, spd: 12, itv: 1.1, style: 'magic', rng: 55, float: 14, fx: '氷' },
  mimic:    { en: 'Mimic', ja: 'ミミック', tier: 3, h: 42, hp: 260, atk: 24, def: 25, spd: 4, itv: 1.5, style: 'tackle' },
};
for (const k in ZAKO) { ZAKO[k].zako = true; ZAKO[k].tackle = ZAKO[k].atk; ZAKO[k].eva = 0; }
// 敵のステータス(ボスは同じキーのモンスター、ザコは ZAKO 表)
function stats(key) { return MONSTERS[key] || ZAKO[key]; }
const enemyImgs = {};
for (const k of ENEMY_KEYS) enemyImgs[k] = loadImg('image/boss/BOSS_' + k + '.png');
for (const k in ZAKO) enemyImgs[k] = loadImg('image/enemy/enemy_' + k + '.png');
function enemyImage(key) {        // 敵の絵(もとから左向き)。読み込み前は null
  const img = enemyImgs[key];
  return img && img.complete && img.naturalWidth ? img : null;
}
function enemyInField(e) { return e.x + enemySize(e)[0] * ENEMY_IN <= DOOR_X; }
let enemies = [], enemyTimer = 0, stageQueue = [];
function enemySize(e) {
  const img = enemyImgs[e.key], H = e.boss ? ENEMY_H : ZAKO[e.key].h * ZAKO_SCALE;
  const k = H / (img.naturalHeight || H);
  return [(img.naturalWidth || H) * k, H];
}
function enemyBox(e) {
  const [w, h] = enemySize(e);
  const want = e.boss ? (BOSS_FLOAT[e.key] || 0) : (ZAKO[e.key].float || 0);
  const fl = Math.max(0, Math.min(want, FEET_Y - h - 2));   // 浮くものも、廊下の高さに収める
  const sway = fl ? Math.sin(e.t / 600) * 2 : 0;
  const jump = e.stomp > 0 ? Math.sin(e.stomp / STOMP_MS * Math.PI) * STOMP_H : 0;   // ドスンの小ジャンプ
  const sink = e.boss ? (BOSS_SINK[e.key] || 0) : 0;
  return { x: e.x + lungeOffset(e), y: FEET_Y - h - fl - sway - jump + sink, w, h, fl: fl + jump };
}
// ステージの敵の顔ぶれ: ザコ10体(弱い順)→ ボス。進むほど強いザコが増える
function buildStageQueue() {
  const tier = t => Object.keys(ZAKO).filter(k => ZAKO[k].tier === t);
  const pick = (list, n) => { const out = []; for (let i = 0; i < n; i++) out.push(list[Math.floor(Math.random() * list.length)]); return out; };
  // 1ステージに出るザコは2種類。ステージが進むほど強い段階から選ぶ(弱いほうが先・多め)
  const tiers = ZAKO_TIERS[Math.min(stage, ZAKO_TIERS.length) - 1];
  const a = pick(tier(tiers[0]), 1)[0];
  let b = a;
  while (b === a) b = pick(tier(tiers[1]), 1)[0];
  stageQueue = [];
  for (let i = 0; i < ZAKO_PER_STAGE; i++) stageQueue.push(ZAKO_MIX[i % ZAKO_MIX.length] ? b : a);
  stageQueue.push(door.key);   // ボスは扉と同じ属性
}
const ENEMY_PEEK = 2;              // 敵が出てくるとき、開いた扉の手前の扉板から最初に見えている幅(px)
function doorEdgeX() { return FIELD_W - DOOR_DRAW_W + DOOR_FRONT_L * DOOR_DRAW_W / DOOR_IMG_W; }   // 開いた扉の手前の扉板の左端
function bossEntering(e) {         // ボスが扉から出てくる途中(体の3割が見えるまで)
  const edge = doorEdgeX();
  return e.boss && edge - e.x < enemySize(e)[0] * BOSS_ENTER_SHOW;
}
function spawnEnemy(key) {
  const boss = !ZAKO[key], p = stats(key), mul = stageMul();
  const hp = Math.round(p.hp * (boss ? ENEMY_HP_MUL : ZAKO_HP_MUL) * mul);
  // 出発位置: 開いた扉の手前の扉板から、ぎりぎり見えるところ(扉のない最終ステージは画面の右の外から)
  const x = door.none ? FIELD_W : doorEdgeX() - ENEMY_PEEK;
  enemies.push({ key, boss, x, t: 0, hp, maxHp: hp, cd: 1500, enemy: true,
                 atkMul: (boss ? ENEMY_ATK_MUL * BOSS_MOVE / bossMove(key) : 1) * mul, itvMul: boss ? ENEMY_ITV_MUL : 1 });
}
function bossMove(key) { return BOSS_FAST[key] || BOSS_MOVE; }
function enemySpeed(e) {
  const p = stats(e.key);
  return e.boss ? (p.spd || MON_SPEED) * MON_MOVE_RATE * ENEMY_SPEED_RATE * bossMove(e.key) : p.spd;
}
function updateEnemies(dt) {
  // 出てくる: ザコは一定の間隔で(同時に ZAKO_ALIVE 体まで)。ボスはザコを全部倒してから
  const alive = enemies.filter(e => !e.dead);
  enemyTimer -= dt;
  if (stageQueue.length && enemyTimer <= 0) {
    const next = stageQueue[0];
    if (ZAKO[next] ? alive.length < ZAKO_ALIVE + (stage >= 2 ? ZAKO_ALIVE_UP : 0) : alive.length === 0) {
      spawnEnemy(stageQueue.shift());
      enemyTimer = ZAKO_INTERVAL;
    }
  }
  // 進む: 前(左)の敵を追い越さず、その後ろに並ぶ。届く相手がいれば止まって戦う。ルネリアの手前で止まる
  const list = alive.sort((a, b) => a.x - b.x);
  let prev = null;
  for (const e of list) {
    if (bossEntering(e)) e.x -= enemySpeed(e) * BOSS_ENTER_SPEED * dt / 1000;
    else if (!(enemyInField(e) && enemyTarget(e))) e.x -= enemySpeed(e) * dt / 1000;
    e.x = Math.max(HERO_LINE, e.x);
    if (prev) e.x = Math.max(e.x, prev.x + enemySize(prev)[0] * 0.55);
    prev = e;
  }
  for (const e of enemies) e.t += dt;
}
function drawEnemies(g) {
  // 奥(右)の敵から描く
  for (const e of enemies.slice().sort((a, b) => b.x - a.x)) {
    const c = enemyImage(e.key);
    if (!c) continue;
    const b = enemyBox(e);
    g.globalAlpha = unitAlpha(e);
    const [src] = pixSrc(g, c, b.w / (c.naturalWidth || c.width) * FIELD_SCALE);
    g.drawImage(src, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
    g.globalAlpha = 1;
    if (!e.dead) drawHpBar(g, b.x + b.w / 2, Math.max(4, b.y - 4), e.boss ? 60 : 24, e.hp / e.maxHp, e.boss ? ATTR_COLOR[ATTR[e.key[0]]] : '#e0504a');
  }
}

// ---- 戦闘 ----
// 攻撃の方法は MONSTERS[key].style: 体当たり(tackle)か魔法(magic)。体当たりは相性なしで、ぶつかる距離まで近づく。
// 魔法は、自分の2つの属性のうち相手によく効くほうで撃ち、相性表(type_chart.csv)の倍率がかかる。
// ダメージ = 攻撃力(または体当たり力) x 相性 x (1 - 相手の防御%)。回避(%)の確率で外れる(敵は巨大なので回避しない)
const ATTR = { Z: '火', J: '水', S: '草', O: '雷', I: '氷', L: '地', T: '闇' };
const TYPE_CHART = {   // 攻撃 → 防御。書いていない組み合わせは 1倍
  '火': { '火': 0.5, '水': 0.5, '草': 2, '氷': 2, '地': 0.5 },
  '水': { '火': 2, '水': 0.5, '草': 0.5, '地': 2 },
  '草': { '火': 0.5, '水': 2, '草': 0.5, '氷': 0.5, '地': 2, '闇': 2 },
  '雷': { '水': 2, '草': 0.5, '雷': 0.5, '氷': 2, '地': 0 },
  '氷': { '火': 0.5, '水': 0.5, '草': 2, '氷': 0.5, '地': 2 },
  '地': { '火': 2, '草': 0.5, '雷': 2, '氷': 0.5, '闇': 2 },
  '闇': { '雷': 2, '氷': 2, '地': 0.5, '闇': 0.5 },
};
const TACKLE_RANGE = 4;           // 体当たりが届く距離(px)
const MAGIC_MIN_RANGE = 40;       // 魔法の届く距離の最小値(体当たりより後ろから撃てるように)
const LUNGE_MS = 240;             // 体当たりで前へ出て戻るまでの時間
// 攻撃のエフェクト: 属性ごと。proj=飛ぶ弾、ground=相手の足元から出る。ax, ay は弾の中心にするコマ内の位置、gy は地面の線
const EFFECT_SCALE = 0.55;
const EFX = {
  '火': { src: 'image/effect_fireball.png', fw: 64, n: 6, ms: 90, kind: 'proj', ax: 40, ay: 32 },
  '水': { src: 'image/effect_water.png', fw: 64, n: 6, ms: 90, kind: 'proj', ax: 31, ay: 31 },
  '草': { src: 'image/effect_vines.png', fw: 77, n: 8, ms: 60, kind: 'ground', gy: 74 },
  '雷': { src: 'image/effect_thunder.png', fw: 64, n: 1, ms: 90, kind: 'proj', ax: 18, ay: 32 },
  '氷': { src: 'image/effect_ice.png', fw: 64, n: 1, ms: 90, kind: 'proj', ax: 34, ay: 32 },
  '地': { src: 'image/effect_earth.png', fw: 64, n: 1, ms: 90, kind: 'ground', gy: 61, dur: 450 },
  '闇': { src: 'image/effect_dark.png', fw: 64, n: 1, ms: 90, kind: 'proj', ax: 40, ay: 32 },
};
for (const k in EFX) EFX[k].img = loadImg(EFX[k].src);
let fx = [], popups = [];

function typeMul(atkAttr, defKey) {
  let m = 1;
  for (const ch of new Set(defKey)) { const v = TYPE_CHART[atkAttr][ATTR[ch]]; m *= v === undefined ? 1 : v; }
  return m;
}
function bestAttr(atkKey, defKey) {   // 自分の2つの属性のうち、相手によく効くほう(ザコは属性なし)
  if (ZAKO[atkKey]) return [ZAKO[atkKey].fx || '闇', 1];
  let best = null;
  for (const ch of new Set(atkKey)) {
    const a = ATTR[ch], m = typeMul(a, defKey);
    if (!best || m > best[1]) best = [a, m];
  }
  return best;
}
function unitBox(u) { return u.hero ? heroBox() : u.door ? doorBox() : u.enemy ? enemyBox(u) : monBox(u); }
function lungeOffset(u) {
  if (!(u.lunge > 0)) return 0;
  const p = 1 - u.lunge / LUNGE_MS;
  return Math.sin(Math.PI * p) * 7 * (u.enemy ? -1 : 1);
}
function unitAlpha(u) {
  if (u.dead) return Math.max(0, u.fade / 500);
  if (u.pop > 0) return 1 - u.pop / POP_MS;   // 杖の先から、ふわっと現れる
  return u.flash > 0 && Math.floor(u.flash / 60) % 2 === 0 ? 0.45 : 1;   // 攻撃を受けると点滅
}
function attackRange(key, isEnemy) {
  const p = stats(key);
  if (p.style === 'tackle') return TACKLE_RANGE;
  return Math.max(MAGIC_MIN_RANGE, p.rng) * (isEnemy && !p.zako ? ENEMY_RANGE_MUL : 1);
}
function frontEnemy() {               // いちばん左(こちらに近い)の、生きている敵
  let f = null;
  for (const e of enemies) if (!e.dead && (!f || e.x < f.x)) f = e;
  return f;
}
function allyEndX() {
  const e = frontEnemy(), end = door.open ? FIELD_W : DOOR_X + 2;
  if (!e) return end;
  return Math.min(end, e.x + enemySize(e)[0] * ENEMY_WALL);
}
// 敵の体が扉から少しでも出ていれば戦える(扉から出てくる途中でも、ぶつかっている味方は攻撃する)
function enemyVisible(e) { return e.x < DOOR_X; }
function allyInRange(m, e) { return enemyVisible(e) && e.x - (m.x + monWidth(m)) <= attackRange(m.key, false); }
function enemyTarget(e) {             // 攻撃が届く味方のうち、いちばん前(右)のもの。味方がいなければルネリア
  const r = attackRange(e.key, true);
  let t = null;
  for (const m of monsters) {
    if (!m.started || m.dead) continue;
    const front = m.x + monWidth(m);
    if (e.x - front <= r && (!t || front > t.x + monWidth(t))) t = m;
  }
  if (!t && heroLose <= 0 && e.x - HERO_LINE <= Math.max(r, 2)) t = hero;
  return t;
}
// 地の利: 味方は左の1/4(ルネリアの近く)、敵は右の1/4(扉の近く)にいると強くなる
const ZONE_ALLY = 1.3, ZONE_ENEMY = 1.2;
function zoneMul(a) {
  const b = unitBox(a), cx = b.x + b.w / 2;
  if (a.enemy) return cx > FIELD_W * 3 / 4 ? ZONE_ENEMY : 1;
  return cx < FIELD_W / 4 ? ZONE_ALLY : 1;
}
function attack(a, target) {
  const p = stats(a.key), isEnemy = !!a.enemy;
  const mul = (isEnemy ? a.atkMul : ALLY_ATK_MUL * (a.atkMul || 1)) * zoneMul(a);
  a.cd = p.itv * 1000 * (isEnemy ? a.itvMul : 1);
  if (p.style === 'tackle') {
    a.lunge = LUNGE_MS;
    fx.push({ kind: 'tackle', t: 0, hitAt: LUNGE_MS / 2, dur: LUNGE_MS / 2, target, power: (p.tackle || p.atk) * mul, mult: 1,
              splash: isEnemy && a.boss ? monsters.filter(m => m !== target && m.started && !m.dead && a.x - (m.x + monWidth(m)) <= TACKLE_RANGE + 24) : [] });
    return;
  }
  const splash = isEnemy && a.boss ? monsters.filter(m => m !== target && m.started && !m.dead && a.x - (m.x + monWidth(m)) <= attackRange(a.key, true)) : [];
  const [attr, mult] = target.hero ? (ZAKO[a.key] ? [ZAKO[a.key].fx || '闇', 1] : [ATTR[a.key[0]], 1]) : bestAttr(a.key, target.key);
  const ef = EFX[attr], sb = unitBox(a), tb = unitBox(target);
  const x0 = isEnemy ? sb.x + sb.w * 0.15 : sb.x + sb.w * 0.85, y0 = sb.y + sb.h * 0.5;
  const x1 = tb.x + tb.w / 2, y1 = tb.y + tb.h * 0.5;
  if (ef.kind === 'ground') {
    fx.push({ kind: 'ground', attr, t: 0, hitAt: 250, dur: ef.dur || ef.n * ef.ms, flip: isEnemy, gx: isEnemy ? tb.x + tb.w : tb.x, target, power: p.atk * mul, mult, splash, atkKey: a.key });
  } else {
    const dur = Math.max(160, Math.min(420, Math.abs(x1 - x0) * 3));
    fx.push({ kind: 'proj', attr, t: 0, hitAt: dur, dur, flip: isEnemy, x0, y0, x1, y1, target, power: p.atk * mul, mult, splash, atkKey: a.key });
  }
}
function applyHit(f) {
  for (const o of f.splash || []) {   // 巨大な敵の攻撃: まわりの味方にも
    const mult = f.atkKey ? typeMul(bestAttr(f.atkKey, o.key)[0], o.key) : 1;
    hitUnit(o, f.power * ENEMY_SPLASH, mult);
  }
  hitUnit(f.target, f.power, f.mult);
}
function hitUnit(t, power, mult) {
  const f = { power, mult };
  if (!t || t.dead) return;
  if (t.hero) {   // ルネリアが攻撃を受けた
    if (heroLose > 0 || over) return;
    const dmg = Math.max(1, Math.round(power * mult)), b = heroBox();
    hero.hp -= dmg; hero.hurt = HERO_HURT_MS; hero.shown = true;
    popups.push({ x: b.x + b.w / 2, y: Math.max(10, b.y), text: String(dmg), color: '#ff8080', t: 0 });
    sfx('land');
    if (hero.hp <= 0) { hero.hp = 0; heroLose = HERO_LOSE_MS; }
    return;
  }
  const p = t.door ? { eva: 0, def: DOOR_DEF } : stats(t.key), b = unitBox(t);
  const px = b.x + b.w / 2, py = Math.max(10, b.y);
  if (!t.enemy && !t.door && Math.random() * 100 < p.eva) { popups.push({ x: px, y: py, text: 'MISS', color: '#c8d0e0', t: 0 }); return; }
  if (f.mult === 0) { popups.push({ x: px, y: py, text: '0', color: '#8890a0', t: 0 }); return; }
  const dmg = Math.max(1, Math.round(f.power * f.mult * (1 - p.def / 100)));
  t.hp -= dmg; t.flash = 240;
  popups.push({ x: px, y: py, text: String(dmg), color: f.mult > 1 ? '#ffd84a' : f.mult < 1 ? '#a8b0c0' : '#ffffff', t: 0 });
  if (t.door) { if (t.hp <= 0) { t.hp = 0; openDoor(); } return; }
  if (t.hp <= 0) {
    t.hp = 0; t.dead = true; t.fade = 500;
    if (t.enemy) {   // 敵を倒した。ボスなら、ルネリアの体力表示はいったん消す
      if (t.boss) { hero.shown = false; door.unlocked = true; if (door.none) startEnding(); }   // ボスを倒すと、扉を攻撃できるようになる(ラスボスならエンディング)
      const bonus = (t.boss ? ENEMY_BONUS : ZAKO_BONUS) * stage;
      score += bonus; updateHud();
      popups.push({ x: px, y: Math.max(16, b.y + 14), text: '+' + bonus, color: '#ffe27a', t: 0, life: 1600, size: 14 });
      sfx('clear', t.boss ? 3 : 1);
    }
  }
}
function updateBattle(dt) {
  for (const u of monsters.concat(enemies)) {
    if (u.cd > 0) u.cd -= dt;
    if (u.lunge > 0) u.lunge -= dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.pop > 0) u.pop -= dt;
    if (u.dead) u.fade -= dt;
  }
  const e0 = frontEnemy();
  for (const m of monsters) {
    if (!m.started || m.dead || m.cd > 0) continue;
    if (e0 && allyInRange(m, e0)) attack(m, e0);
    else if (door.unlocked && !door.none && !door.open && door.hp > 0 && DOOR_X - (m.x + monWidth(m)) <= attackRange(m.key, false)) attack(m, door);
  }
  for (const e of enemies) {
    if (e.dead || e.cd > 0 || !enemyVisible(e)) continue;
    const t = enemyTarget(e);
    if (t) attack(e, t);
  }
  for (const f of fx) { f.t += dt; if (!f.done && f.t >= f.hitAt) { f.done = true; applyHit(f); } }
  fx = fx.filter(f => f.t < f.dur);
  for (const p of popups) p.t += dt;
  popups = popups.filter(p => p.t < (p.life || 700) && !(p.unit && p.unit.dead && p.unit.fade <= 0));
  monsters = monsters.filter(m => !(m.dead && m.fade <= 0));
  const n = enemies.length;
  enemies = enemies.filter(e => !(e.dead && e.fade <= 0));
  if (enemies.length < n) enemyTimer = ENEMY_RESPAWN;
}
function drawHpBar(g, cx, y, w, r, col) {
  const H = 4;                      // バーの太さ(px)
  const x = Math.round(cx - w / 2), yy = Math.max(1, Math.round(y) - H / 2);   // 太くしたぶん上へ(下の端の位置はそのまま)
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, yy - 1, w + 2, H + 2);
  g.fillStyle = col; g.fillRect(x, yy, Math.max(0, Math.round(w * r)), H);
}
function drawFx(g) {
  g.imageSmoothingEnabled = false;   // ドット絵は補間せず、ぼかさずに拡大・縮小する
  for (const f of fx) {
    if (f.kind === 'tackle') continue;
    const ef = EFX[f.attr], img = ef.img;
    if (!img.complete || !img.naturalWidth) continue;
    const fr = Math.floor(f.t / ef.ms) % ef.n, s = EFFECT_SCALE;
    const fh = img.naturalHeight, dw = ef.fw * s, dh = fh * s;
    let ax, ay;   // コマの基準点を置く画面の位置
    if (f.kind === 'proj') {
      const q = Math.min(1, f.t / f.hitAt);
      ax = f.x0 + (f.x1 - f.x0) * q; ay = f.y0 + (f.y1 - f.y0) * q;
    } else { ax = f.gx; ay = FEET_Y; }
    const ox = f.kind === 'proj' ? ef.ax * s : dw * 0.25, oy = f.kind === 'proj' ? ef.ay * s : ef.gy * s;
    g.save();
    g.translate(Math.round(ax), Math.round(ay));
    if (f.flip) g.scale(-1, 1);   // 敵の攻撃は左向き
    const [src, n] = pixSrc(g, img, s * FIELD_SCALE);
    g.drawImage(src, fr * ef.fw * n, 0, ef.fw * n, fh * n, -ox, -oy, dw, dh);
    g.restore();
  }
  g.textAlign = 'center';
  for (const p of popups) {
    const life = p.life || 700, a = 1 - Math.max(0, p.t - (life - 300)) / 300;
    let x = p.x, y, size = 16;
    if (p.unit) {   // キャラクターの上について動く。ピョンと跳ねて出て、しばらく残る
      const b = unitBox(p.unit);
      x = b.x + b.w / 2;
      const q = Math.min(1, p.t / 260);
      y = Math.max(12, b.y) - 6 - 10 * Math.sin(Math.PI * q) * (1 - q * 0.6);
      size = p.big ? (p.t < 160 ? 32 : 16) : 16;
    } else y = p.still ? p.y : p.y - 2 - p.t / life * 12;
    if (p.size) size = p.size;
    g.font = pixFont(size);
    g.globalAlpha = a;
    const tx = zen(p.text);
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 3; g.strokeText(tx, x, y);
    g.fillStyle = p.color; g.fillText(tx, x, y);
  }
  g.globalAlpha = 1;
}

// ---- ステージ: 左端にルネリア、右端に属性つきの扉 ----
// 扉の体力を0にすると扉が開いてステージクリア。敵が左端のルネリアに届くとゲームオーバー
const DOOR_W = Math.round(FIELD_H * (337 - 44) / 695), DOOR_X = FIELD_W - DOOR_W, DOOR_H = 96;   // 扉の絵(閉じた扉)の幅
const DOOR_HP = 3000;             // 扉の体力。ステージごとに +20%
const STAGE_UP = 0.15;            // ステージが1つ進むごとに、敵の体力・攻撃力が +15%
const STAGE_STEP = 0.3;           // ステージ2からは、さらに +30%(1ステージ目だけやさしく)
const ZAKO_ALIVE_UP = 1;          // ステージ2からは、同時に出るザコを1体増やす
const ENEMY_BONUS = 500;          // 敵(ボス)を倒した得点 x ステージ
const STAGE_BONUS = 3000;         // ステージクリアの得点 x ステージ
const CLEAR_SHOW_MS = 2600;       // 扉が開いてから、QUEST CLEAR を見せる時間
function stageMul() { return 1 + STAGE_UP * (stage - 1) + (stage >= 2 ? STAGE_STEP : 0); }
const DOOR_DEF = 20;              // 扉の防御(%)
const DOOR_OPEN_MS = 1000;        // 扉が開ききるまで
const ATTR_COLOR = { '火': '#e04040', '水': '#3a5be0', '草': '#46c43c', '雷': '#e8d02f', '氷': '#2fd0e8', '地': '#f08a1c', '闇': '#a443d4' };
let door = { door: true, key: 'ZZ', attr: '火', hp: DOOR_HP, maxHp: DOOR_HP, open: false, openT: 0, flash: 0, ajar: 0 };
// ステージの順番: 1 草(森) → 2 水 → 3 氷 → 4 地 → 5 火 → 6 雷 → 7 闇(毒)。最後はラスボスで扉はなく、倒すとエンディング
const STAGE_ORDER = 'SJILZOT';
function stageAttr() { return STAGE_ORDER[Math.min(stage, STAGE_ORDER.length) - 1]; }
function isFinalStage() { return stage >= STAGE_ORDER.length; }
const ENDING_BONUS = 10000;       // ラスボスを倒したときのボーナス
function startEnding() {          // ラスボスを倒した: 戦場を一掃してエンディング
  over = true; overReason = 'ending'; cur = null; moveDir = 0; softDrop = false;
  const bonus = ENDING_BONUS;
  score += bonus; updateHud();
  popups.push({ x: FIELD_W / 2, y: FIELD_H / 2 + 34, text: 'BONUS +' + bonus, color: '#ffe27a', t: 0, life: 4000, size: 16, still: true });
  for (const u of enemies) if (!u.dead) { u.dead = true; u.fade = 700; }
  sfx('clear', 4);
}
function resetStage() {
  const ch = stageAttr();            // ステージの属性(背景・扉・ボス)は決まった順
  const hp = Math.round(DOOR_HP * (1 + 0.2 * (stage - 1)));
  door = { door: true, key: ch + ch, attr: ATTR[ch], hp, maxHp: hp, open: false, openT: 0, flash: 0, ajar: 0, none: isFinalStage() };
  hero = { hero: true, hp: HERO_HP, maxHp: HERO_HP, shown: false, hurt: 0 };
  summonT = 0; heroLose = 0; heroBack = 0; stageClear = false;
  buildStageQueue(); enemyTimer = ENEMY_RESPAWN; stageClearT = 0; stageIntroT = 2000;
}
function doorBox() { return { x: DOOR_X, y: FEET_Y - DOOR_H, w: DOOR_W, h: DOOR_H }; }
function openDoor() {               // 扉が開いた: ステージクリア。ボーナスを入れて、戦場を一掃する
  if (door.open) return;
  door.open = true; door.openT = 0;
  stageClear = true; stageClearT = DOOR_OPEN_MS + CLEAR_SHOW_MS;
  const bonus = STAGE_BONUS * stage;
  score += bonus; updateHud();
  popups.push({ x: FIELD_W / 2, y: FIELD_H / 2 + 34, text: 'BONUS +' + bonus, color: '#ffe27a', t: 0, life: stageClearT, size: 16, still: true });
  for (const u of enemies) if (!u.dead) { u.dead = true; u.fade = 700; }
  monsters = monsters.filter(m => m.started && !m.dead);   // 味方はみんなで扉を通って右へはける(まだ出発していないものは消す)
  exitT = 0;
  fx = [];
  // ブロックの盤面はそのまま残す(演出の間は止まり、次のステージで続きから)
  moveDir = 0; softDrop = false;
  sfx('clear', 4);
}
function nextStage() {             // 次のステージへ: 戦場(モンスター・敵・扉)だけ新しくする。ブロックの盤面・得点はそのまま続く
  stage++;
  monsters = []; enemies = []; enemyTimer = ENEMY_RESPAWN; fx = []; popups = [];
  resetStage();
  if (!cur && !clearing) spawn();
  updateHud();
  switchBgm();
}

// ルネリア: ふだんは fight、モンスターを出すときは fight2、敵に届かれたら damage → down、クリアで happy
const HERO_IMG = {};
for (const k of ['fight', 'fight2', 'damage', 'happy', 'down']) HERO_IMG[k] = loadImg('image/Luneria_' + k + '.png');
const HERO_K = 0.658;             // 表示の倍率(元の絵の65.8%。fight の高さ106px → 約70px)
const HERO_X = -9.3;               // 絵の左端の位置(絵の左側の余白ぶん外へ出す)
const HERO_FOOT = { fight: 104, fight2: 104, damage: 106, happy: 126, down: 101 };   // 絵の中の足元の高さ
const HERO_LINE = 44;             // 敵がここまで来たら、ルネリアに届いた(ルネリアの右端あたり)
const HERO_LOSE_MS = 700;         // 届かれてから倒れるまで(ダメージの絵を見せる)
const HERO_TIP_X = 88;            // fight2 の絵の中の、杖の先(三日月)の横の位置
const SUMMON_MS = 350;            // モンスターを1体出すときの、杖をふるポーズの長さ
const POP_MS = 250;               // 出てきたモンスターが、ふわっと現れるまで
const EXIT_SPEED = 120;           // ステージクリアで、みんなが右へはける速さ(px/秒)
const EXIT_WAIT = 700;            // 扉が開いてから歩き出すまで(ミリ秒)
const EXIT_MAX = 12000;           // はけ終わらなくても、この時間で次のステージへ
const EXIT_HOP_MS = 440, EXIT_HOP_H = 2;   // はけるときのトコトコ(1歩の長さ、跳ねる高さ)
let exitT = 0;
function exiting() { return stageClear && exitT > EXIT_WAIT; }
function exitHop(t) { return exiting() ? Math.abs(Math.sin(t / EXIT_HOP_MS * Math.PI)) * EXIT_HOP_H : 0; }
const HERO_BACK_SPEED = 22;       // ブロックが積み上がったとき、ルネリアが左へあとずさりする速さ(px/秒)
function heroX() { return HERO_X - heroBack; }
function staffTipX() { return heroX() + HERO_TIP_X * HERO_K; }
let summonT = 0, heroLose = 0, stageIntroT = 0, heroBack = 0;
// ブロックが積み上がったとき: ルネリアを追いかけて、敵も左へ走り去る。味方のモンスターは消える
const CHASE_ZAKO = 45;            // ザコの追いかける速さ(px/秒)。足の速いザコはもっと速い
const CHASE_BOSS = 64;            // ボスの追いかける速さ(px/秒)
const STOMP_MS = 280, STOMP_H = 7;   // ボスは追いかけながら、ときどきドスンと小ジャンプ(長さ ミリ秒 / 高さ px)
const STOMP_WAIT = [700, 1600];   // 次のジャンプまでの間隔(ミリ秒、この範囲でばらつく)
let fieldShake = 0;               // ドスンで廊下がゆれる残り時間(ミリ秒)
function updateChase(dt) {
  for (const m of monsters) {
    if (!m.dead) { m.dead = true; m.fade = 500; }
    m.fade -= dt;
  }
  monsters = monsters.filter(m => m.fade > 0);
  for (const e of enemies) {
    e.t += dt;
    if (e.dead) { e.fade -= dt; continue; }
    const v = e.boss ? CHASE_BOSS : Math.max(CHASE_ZAKO, stats(e.key).spd * 3);
    e.x -= v * dt / 1000;
    if (e.boss) {                   // ドスン、ドスン
      if (e.stomp === undefined) { e.stomp = -1; e.stompWait = 300; }
      if (e.stomp >= 0) {
        e.stomp += dt;
        if (e.stomp >= STOMP_MS) { e.stomp = -1; e.stompWait = STOMP_WAIT[0] + Math.random() * (STOMP_WAIT[1] - STOMP_WAIT[0]); fieldShake = 160; sfx('land'); }
      } else if ((e.stompWait -= dt) <= 0) e.stomp = 0;
    }
  }
  enemies = enemies.filter(e => !(e.dead && e.fade <= 0) && e.x + enemySize(e)[0] > -10);
}
function stackOut() { return over && overReason !== 'enemy' && overReason !== 'clear' && overReason !== 'ending'; }   // ブロックが積み上がって終わった
function heroPose() {
  if (over && overReason === 'enemy') return 'down';
  if (heroLose > 0 || hero.hurt > 0 || stackOut()) return 'damage';
  if (door.open || (over && overReason === 'ending')) return 'happy';
  if (summonT > 0) return 'fight2';
  return 'fight';
}
function updateStage(dt) {
  if (summonT > 0) summonT -= dt;
  if (hero.hurt > 0) hero.hurt -= dt;
  if (door.flash > 0) door.flash -= dt;
  if (door.open) door.openT += dt;
  updateDoorAjar(dt);
  if (stackOut()) { heroBack += HERO_BACK_SPEED * dt / 1000; updateChase(dt); }   // 画面の左へ消えるまで、あとずさり。敵が追いかける
  if (stageIntroT > 0) stageIntroT -= dt;
  if (stageClear) {                // 扉が開いたら、ルネリアとモンスターがみんなで扉を通って右へはける。全員はけたら次のステージ
    stageClearT -= dt; exitT += dt;
    if (exitT > EXIT_WAIT) heroBack -= EXIT_SPEED * dt / 1000;
    const gone = heroX() > FIELD_W && !monsters.length;
    if ((stageClearT <= 0 && gone) || exitT > EXIT_MAX) nextStage();
  }
  if (heroLose > 0) {
    heroLose -= dt;
    if (heroLose <= 0 && !over) { over = true; overReason = 'enemy'; cur = null; }
  }
}
// ルネリアの体力: 攻撃を受けると表示が出る(ボスを倒すと表示は消える)。0になると倒れてゲームオーバー。
// ルネリアは攻撃しない(モンスターを呼び出すだけ)
const HERO_HP = 600;
const HERO_HURT_MS = 450;         // 攻撃を受けたときの、ダメージの絵を見せる時間
let hero = { hero: true, hp: HERO_HP, maxHp: HERO_HP, shown: false, hurt: 0 };
function heroBox() {
  return { x: heroX() + 19 * HERO_K, y: FEET_Y + 2 - 104 * HERO_K, w: 71 * HERO_K, h: 104 * HERO_K };
}
function drawHero(g) {
  const pose = heroPose(), img = HERO_IMG[pose];
  if (!img.complete || !img.naturalWidth) return;
  g.imageSmoothingEnabled = false;   // ドット絵は補間せず、ぼかさずに拡大・縮小する
  const w = img.naturalWidth * HERO_K, h = img.naturalHeight * HERO_K;
  const blink = (heroLose > 0 && Math.floor(heroLose / 70) % 2 === 0) || (hero.hurt > 0 && Math.floor(hero.hurt / 70) % 2 === 0);
  g.globalAlpha = blink ? 0.5 : 1;
  const [src] = pixSrc(g, img, HERO_K * FIELD_SCALE);
  const bob = stackOut() ? Math.abs(Math.sin(heroBack / 6)) * 1.5 : exitHop(exitT);   // あとずさり・はけるときの足どり
  g.drawImage(src, Math.round(heroX()), Math.round(FEET_Y + 2 - HERO_FOOT[pose] * HERO_K - bob), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
  if (hero.shown && !(over && overReason === 'enemy')) {
    const b = heroBox();
    drawHpBar(g, b.x + b.w / 2, Math.max(4, b.y - 4), 34, hero.hp / hero.maxHp, '#ffb0e0');
  }
}

// 扉の絵: 閉じた扉 / 開いた扉の奥側(キャラより向こう)/ 開いた扉の手前側(キャラより手前)。
// 絵の上・下・右の端をフィールドの上・下・右の端にぴったり合わせて描く。元は赤(火)で、属性の色へ色相を回す
const DOOR_SRC = { close: loadImg('image/close_red.png'), back: loadImg('image/open_back_red.png'), front: loadImg('image/open_front_red.png') };
const DOOR_IMG_W = 337, DOOR_IMG_H = 695, DOOR_IMG_L = 44;   // 絵の大きさと、閉じた扉の左端
const DOOR_DRAW_W = DOOR_IMG_W * FIELD_H / DOOR_IMG_H;       // フィールド上の絵の幅
// 扉の明るさ(背景に合わせる。ステージの属性ごと)
const DOOR_BRIGHTS = { S: 0.8, J: 0.9, I: 0.95, L: 0.7, Z: 0.7, O: 0.7, T: 0.7 };
function doorBright() { return DOOR_BRIGHTS[door.key[0]] || 0.7; }
// 背景になじませる色の調整(ステージの属性ごと): hue = 色相(度。なければ属性の色), sat = 彩度の倍率, lift = 白をまぜる割合
const DOOR_LOOK = { I: { hue: 205, sat: 1.3, lift: 0.1, con: 1.35 } };   // con = コントラストの倍率
function doorLook() { return DOOR_LOOK[door.key[0]] || {}; }
const DOOR_AJAR_MS = 500;         // 敵が出てきたあと、扉を開けておく時間
const doorTinted = {};            // 属性ごとに色を変えた扉の絵(作ったら使い回す)
function hexHue(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function tintHue(img, deg, bright = 1, sat = 1, lift = 0, con = 1) {   // 絵の色相を deg 度回し、明るさを bright 倍、彩度を sat 倍、コントラストを con 倍にし、白を lift の割合まぜる
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = c.getContext('2d');
  t.drawImage(img, 0, 0);
  if (!deg && bright === 1 && sat === 1 && !lift && con === 1) return c;
  let d;
  try { d = t.getImageData(0, 0, w, h); }
  catch (err) {
    // file:// で開いたときなどは画像のピクセルを読めないので、canvas のフィルタで色を変える(少し色味が変わる)
    t.clearRect(0, 0, w, h);
    t.filter = 'hue-rotate(' + deg + 'deg) saturate(' + sat + ') contrast(' + con + ') brightness(' + (bright * (1 + lift)) + ')';
    t.drawImage(img, 0, 0);
    t.filter = 'none';
    return c;
  }
  const p = d.data, sh = deg / 60;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), c0 = mx - mn;
    const out = (v) => ((v - 128) * con + 128) * bright * (1 - lift) + 255 * lift;
    if (!c0) { p[i] = out(r); p[i + 1] = out(g); p[i + 2] = out(b); continue; }
    let hh = mx === r ? (g - b) / c0 : mx === g ? (b - r) / c0 + 2 : (r - g) / c0 + 4;
    hh = ((hh + sh) % 6 + 6) % 6;
    const cs = c0 * sat, m2 = mx - cs;                  // 彩度: 明るさ(いちばん強い色)はそのままで、色の幅を sat 倍
    const x = cs * (1 - Math.abs(hh % 2 - 1)), k = Math.floor(hh);
    const [r1, g1, b1] = k === 0 ? [cs, x, 0] : k === 1 ? [x, cs, 0] : k === 2 ? [0, cs, x] : k === 3 ? [0, x, cs] : k === 4 ? [x, 0, cs] : [cs, 0, x];
    p[i] = out(r1 + m2); p[i + 1] = out(g1 + m2); p[i + 2] = out(b1 + m2);
  }
  t.putImageData(d, 0, 0);
  return c;
}
function doorImage(part) {
  const img = DOOR_SRC[part];
  if (!img.complete || !img.naturalWidth) return null;
  const id = part + door.key + doorBright();
  if (!doorTinted[id]) {
    const L = doorLook();
    doorTinted[id] = tintHue(img, L.hue !== undefined ? L.hue : hexHue(ATTR_COLOR[door.attr]), doorBright(), L.sat || 1, L.lift || 0, L.con || 1);
  }
  return doorTinted[id];
}
// 扉が開いているか: ステージクリアのとき、または敵が扉から出てくるあいだ
function doorAjar() {
  return door.open || door.ajar > 0;
}
function updateDoorAjar(dt) {
  const coming = enemies.some(e => !e.dead && e.x + enemySize(e)[0] * 0.5 > DOOR_X);
  if (coming) door.ajar = DOOR_AJAR_MS; else if (door.ajar > 0) door.ajar -= dt;
}
function drawDoorPart(g, part) {
  const c = doorImage(part);
  if (!c) return;
  const x = FIELD_W - DOOR_DRAW_W;
  pixelSmooth(g, DOOR_DRAW_W / DOOR_IMG_W);
  g.drawImage(c, x, 0, DOOR_DRAW_W, FIELD_H);
  if (door.flash > 0 && part === 'close') {   // 攻撃を受けたら白く光る
    g.globalAlpha = 0.3; g.globalCompositeOperation = 'lighter';
    g.drawImage(c, x, 0, DOOR_DRAW_W, FIELD_H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}
function drawDoorBack(g) {          // キャラより向こう側: 閉じた扉、または開いた扉の奥側
  if (door.none) return;
  drawDoorPart(g, doorAjar() ? 'back' : 'close');
}
function drawDoorFront(g) {         // キャラより手前: 開いた扉の手前側。体力のバー
  if (door.none) return;
  if (doorAjar()) drawDoorPart(g, 'front');
  if (door.unlocked && !door.open) drawHpBar(g, DOOR_X + DOOR_W / 2, 6, DOOR_W - 8, door.hp / door.maxHp, ATTR_COLOR[door.attr]);
}
// ---- タイトル画面: 読み込んだら最初に出す。キー・ボタン・画面のタップで始まる ----
const GAME_TITLE = 'EGG QUEST';
let titleScreen = true, titleT = 0;
function startGame() {
  titleScreen = false;
  stageIntroT = 2000;               // 「STAGE 1」を見せてから始める
  sfx('clear', 1);
}
// フィールドの上: 背景・ルネリアの上に、ロゴ(1文字ずつ属性の色で、ふわふわ上下)
function drawTitleField(g) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, FIELD_W, FIELD_H);
  const cols = ['#46c43c', '#3a5be0', '#2fd0e8', '#f08a1c', '#e04040', '#e8d02f', '#a443d4'];   // ステージの順の色
  g.font = pixFont(48); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const chars = [...zen(GAME_TITLE)], widths = chars.map(c => g.measureText(c).width);
  let x = (FIELD_W - widths.reduce((a, b) => a + b, 0)) / 2;
  let ci = 0;
  chars.forEach((c, i) => {
    const y = 62 + Math.sin(titleT / 380 - i * 0.6) * 3;
    if (c !== '　') {
      g.lineWidth = 8; g.strokeStyle = 'rgba(20,12,30,0.95)'; g.strokeText(c, x, y);
      g.fillStyle = cols[ci++ % cols.length]; g.fillText(c, x, y);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillText(c, x, y - 2);   // 上側を少し明るく(立体感)
      g.fillStyle = cols[(ci - 1) % cols.length]; g.globalAlpha = 0.85; g.fillText(c, x, y); g.globalAlpha = 1;
    }
    x += widths[i];
  });
  g.textAlign = 'center'; g.font = pixFont(16);
  g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText('ルネリアと たまごの ぼうけん', FIELD_W / 2, 88);
  g.fillStyle = '#ffe9a8'; g.fillText('ルネリアと たまごの ぼうけん', FIELD_W / 2, 88);
}
// 盤面の上: 7色の水玉の卵が順にぴょこぴょこ跳ねる。スタートの案内と操作
function drawTitleBoard(g) {
  g.fillStyle = 'rgba(8,10,16,0.82)'; g.fillRect(0, 0, cv.width, cv.height);
  const names = 'SJILZOT', nx = names.length;
  for (let i = 0; i < nx; i++) {
    const sh = SHAPES[names[i]], under = SHAPES[names[(i + 3) % nx]];
    const ph = ((titleT / 900) - i / nx) % 1, hop = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) * 10 : 0;
    drawEgg(g, cv.width / 2 + (i - (nx - 1) / 2) * 38, 150 - hop, sh.color, false, true, under.color);
  }
  g.textAlign = 'center';
  g.fillStyle = '#ffe27a'; g.font = pixFont(32);
  g.fillText(zen('EGG QUEST'), cv.width / 2, 100);
  if (Math.floor(titleT / 600) % 2 === 0) {
    g.fillStyle = '#ffffff'; g.font = pixFont(16);
    g.fillText(zen('PRESS ANY KEY'), cv.width / 2, 232);
  }
  g.fillStyle = '#c8d0e0'; g.font = pixFont(16);
  g.fillText('スマホは がめんを タップ', cv.width / 2, 258);
  const help = [['← →', 'いどう'], ['↑ ' + zen('X') + ' / ' + zen('Z'), 'かいてん'], ['↓', 'はやく おとす'], [zen('SPACE'), 'すぐ おとす'],
                [zen('P'), 'ポーズ'], [zen('M'), zen('BGM') + ' オン/オフ'], [zen('R'), 'リスタート']];
  let y = 320;
  g.font = pixFont(16);
  for (const [k, v] of help) {
    g.textAlign = 'right'; g.fillStyle = '#ffe27a'; g.fillText(k, cv.width / 2 - 12, y);
    g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.fillText(v, cv.width / 2 + 4, y);
    y += 26;
  }
  g.textAlign = 'center'; g.fillStyle = '#9aa3b8';
  g.fillText('たまごを かさねて ラインを けそう', cv.width / 2, y + 22);
}
function drawStageText(g) {
  if (titleScreen) return;
  let text = null, col = '#ffffff';
  if (stageClear) { text = 'QUEST CLEAR!'; col = '#ffe27a'; }
  else if (over && overReason === 'enemy') { text = 'QUEST FAILED'; col = '#ff6a6a'; }
  else if (over && overReason === 'ending') { text = 'ALL CLEAR!'; col = '#ffe27a'; }
  else if (stageIntroT > 0) { text = isFinalStage() ? 'FINAL STAGE' : 'STAGE ' + stage; g.globalAlpha = Math.min(1, stageIntroT / 500); }
  if (!text) return;
  text = zen(text);
  g.textAlign = 'center'; g.font = pixFont(32);
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 5; g.strokeText(text, FIELD_W / 2, FIELD_H / 2 + 8);
  g.fillStyle = col; g.fillText(text, FIELD_W / 2, FIELD_H / 2 + 8);
  g.globalAlpha = 1;
}

// ---- ボスの情報(右の欄の角丸の枠) ----
const BOSS_NAME = {
  ZZ: ['Burning Wyvern', 'バーニングワイバーン'], JJ: ['King Slime', 'キングスライム'], SS: ['Mega Tail', 'メガテイル'],
  OO: ['Twin Horn', 'ツインホーン'], II: ['Frost Wing', 'フロストウィング'], LL: ['Rock Brute', 'ロックブルート'], TT: ['Big Eye', 'ビッグアイ'],
};
const bossEl = id => document.getElementById(id);
let bossShown = null;   // いま表示しているボス(変わったときだけ絵や名前を書き直す)
function attrChip(a) { return '<span class="attr" style="background:' + ATTR_COLOR[a] + '">' + a + '</span>'; }
const CARD_ZAKO_K = 0.7, CARD_BOSS_K = 1.15;   // カードの絵の大きさ(枠に収めた大きさに対する倍率)
function updateBossCard() {
  const e = frontEnemy();
  const card = bossEl('boss');
  if (!card) return;
  if (!e) {
    if (bossShown !== 'none') {
      bossShown = 'none'; card.className = 'none';
      bossEl('bossEn').textContent = '-'; bossEl('bossJa').textContent = stageQueue.length ? 'つぎの敵を待っています' : '';
      for (const id of ['bossAttr', 'bossWeak', 'bossHp', 'bossAtk']) bossEl(id).textContent = '';
      const c = bossEl('bossImg'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }
    return;
  }
  if (bossShown !== e) {
    const img = enemyImage(e.key);
    if (!img) return;   // 絵の読み込みを待つ
    bossShown = e; card.className = '';
    const p = stats(e.key);
    const [en, ja] = e.boss ? (BOSS_NAME[e.key] || [e.key, '']) : [p.en, p.ja];
    bossEl('bossEn').textContent = en;   // 敵の英語名は半角のまま
    bossEl('bossJa').textContent = '(' + ja + ')' + (e.boss ? ' ボス' : '');
    if (e.boss) {
      const attr = ATTR[e.key[0]];
      bossEl('bossAttr').innerHTML = attrChip(attr);
      const weak = Object.keys(TYPE_CHART).filter(a => TYPE_CHART[a][attr] === 2);
      bossEl('bossWeak').innerHTML = weak.length ? weak.map(attrChip).join(' ') : 'なし';
    } else {   // ザコは属性なし
      bossEl('bossAttr').innerHTML = '<span class="attr" style="background:#9aa0ae">無</span>';
      bossEl('bossWeak').innerHTML = 'なし';
    }
    const tackle = p.style === 'tackle';
    bossEl('bossAtk').textContent = Math.round((tackle ? p.tackle : p.atk) * e.atkMul) + (tackle ? '(体当たり)' : '(魔法)');
    // 絵: 枠に収まるように縮める(縮めるときはなめらかに、拡大するときはドットのまま)
    const c = bossEl('bossImg'), g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    // ザコは7割、ボスは1.15倍の大きさで(はみ出さない範囲で)
    const fit = Math.min((c.width - 8) / img.width, (c.height - 8) / img.height);
    const k = e.boss ? Math.min(fit * CARD_BOSS_K, c.width / img.width, c.height / img.height) : fit * CARD_ZAKO_K;
    const [src] = pixSrc(g, img, k);
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    // ザコは小さいので、枠の少し下寄りに置く
    const y = e.boss ? (c.height - h) / 2 : (c.height - h) * 0.75;
    g.drawImage(src, Math.round((c.width - w) / 2), Math.round(y), w, h);
  }
  const hpText = Math.max(0, Math.ceil(e.hp)) + ' / ' + e.maxHp;
  if (bossEl('bossHp').textContent !== hpText) bossEl('bossHp').textContent = hpText;
}

// ---- フィールド: ステージの属性ごとの背景(画像を横にタイリング) ----
const WALL_IMGS = {};
for (const ch of STAGE_ORDER) WALL_IMGS[ch] = loadImg('image/bg/wall_' + ch + '.png');
let fieldScroll = 0; // 廊下の横移動量(px)。壁は左右どちらにも途切れず続く
let wallTiles = {};   // 背景の画像を、フィールドの高さに縮めたもの(属性ごと)
let FIELD_SCALE = 1.25;     // ダンジョンの表示エリア全体の拡大率(中の座標は FIELD_W x FIELD_H のまま)。下のエリアの幅に合わせて決める(fitField)
// ドット絵の描き方: 画面上で縮めるときはなめらかに(アンチエイリアス)、拡大するときは補間せずドットのまま
function pixelSmooth(g, scale) {
  const shrink = scale * FIELD_SCALE < 1;
  g.imageSmoothingEnabled = shrink;
  if (shrink) g.imageSmoothingQuality = 'high';
}
// ドット絵を拡大して描くとき: まず補間なしで整数倍に拡大した絵を作り、それを少しだけ縮めて描く。
// ドットの形はくっきり残り、ドットの境目にだけ軽いアンチエイリアスがかかる(ぼやけない)。
// scale = 画面上での拡大率。戻り値 [描く絵, 元の絵に対する倍率](絵の一部を切り出すときは、切り出す座標にこの倍率をかける)
const pixUp = new WeakMap();
function pixSrc(g, img, scale) {
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (!(scale > 1)) return [img, 1];               // 縮めるときは、なめらかに
  const n = Math.ceil(scale - 0.02);
  if (n <= 1) { g.imageSmoothingEnabled = false; return [img, 1]; }
  let m = pixUp.get(img);
  if (!m) pixUp.set(img, m = {});
  if (!m[n]) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = document.createElement('canvas'); c.width = w * n; c.height = h * n;
    const t = c.getContext('2d'); t.imageSmoothingEnabled = false;
    t.drawImage(img, 0, 0, w * n, h * n);
    m[n] = c;
  }
  return [m[n], n];
}
// ---- 地面の影: 絵の形(アルファ)をそのまま黒く塗り、縦につぶしてぼかし、足元に置く ----
const SHADOW_H = 0.14;      // 影の高さ(絵の高さに対する割合)
const SHADOW_ALPHA = 0.5;   // 影の濃さ
const SHADOW_BLUR = 1.5;    // ぼかし(px)
const silhouettes = new Map();
function silhouette(img) {  // 絵の形だけの黒いシルエット(作ったら使い回す)
  let c = silhouettes.get(img);
  if (c) return c;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = c.getContext('2d');
  t.drawImage(img, 0, 0);
  t.globalCompositeOperation = 'source-in'; t.fillStyle = '#000'; t.fillRect(0, 0, w, h);
  silhouettes.set(img, c);
  return c;
}
function drawShadow(g, img, x, w, h, lift, alpha) {
  const sil = silhouette(img);
  if (!sil) return;
  const sh = Math.max(3, h * SHADOW_H) * (1 - Math.min(0.5, lift / 120));   // 浮いているものほど、影は小さく薄く
  const sw = w * (1 - Math.min(0.3, lift / 200));
  g.save();
  g.globalAlpha = SHADOW_ALPHA * alpha * (1 - Math.min(0.6, lift / 100));
  g.filter = 'blur(' + SHADOW_BLUR + 'px)';
  g.imageSmoothingEnabled = true;
  g.drawImage(sil, x + (w - sw) / 2, FEET_Y - sh / 2, sw, sh);
  g.restore();
}
// 扉の落ち影(疑似): 扉の形を床に寝かせて(縦につぶして左へ倒し)、ぼかして置く
const DOOR_SHADOW_H = 0.17;       // 影の高さ(扉の高さに対する割合)
const DOOR_SHADOW_LEAN = 1.0;     // 影を左へ倒す量(影の高さ1pxあたり、左へずらすpx)
function drawDoorShadow(g) {
  if (door.none) return;
  const parts = doorAjar() ? ['back', 'front'] : ['close'];
  const x = FIELD_W - DOOR_DRAW_W, h = FIELD_H * DOOR_SHADOW_H;
  g.save();
  g.globalAlpha = SHADOW_ALPHA;
  g.filter = 'blur(' + SHADOW_BLUR + 'px)';
  g.imageSmoothingEnabled = true;
  // 絵の下の端(y=FIELD_H)を軸に、上を左へ倒して縦につぶす
  g.transform(1, 0, DOOR_SHADOW_LEAN, 1, -FIELD_H * DOOR_SHADOW_LEAN, 0);
  for (const part of parts) {
    const img = DOOR_SRC[part];
    if (!img.complete || !img.naturalWidth) continue;
    const sil = silhouette(img);
    if (sil) g.drawImage(sil, x, FIELD_H - h, DOOR_DRAW_W, h);
  }
  g.restore();
}
function drawShadows(g) {
  drawDoorShadow(g);
  // ルネリア
  const pose = heroPose(), himg = HERO_IMG[pose];
  if (himg.complete && himg.naturalWidth) drawShadow(g, himg, heroX(), himg.naturalWidth * HERO_K, himg.naturalHeight * HERO_K, 0, 1);
  // 敵
  for (const e of enemies) {
    const c = enemyImage(e.key);
    if (!c) continue;
    const b = enemyBox(e);
    drawShadow(g, c, b.x, b.w, b.h, b.fl, unitAlpha(e));
  }
  // 味方のモンスター
  for (const m of monsters) {
    if (!m.started) continue;
    const img = monsterImgs[m.key];
    if (!img.complete || !img.naturalWidth) continue;
    const b = monBox(m);
    drawShadow(g, img, b.x, b.w, b.h, b.fl, unitAlpha(m));
  }
}
function drawField() {
  const g = fctx;
  if (fieldShake > 0) fieldShake -= 16;
  const shakeY = fieldShake > 0 ? Math.round(Math.sin(fieldShake / 20) * 1.5) : 0;   // ドスンで少しゆれる
  g.setTransform(FIELD_SCALE, 0, 0, FIELD_SCALE, 0, shakeY * FIELD_SCALE);
  g.imageSmoothingEnabled = false;   // ドット絵は補間せず、ぼかさずに拡大・縮小する
  g.fillStyle = '#23262e'; g.fillRect(0, 0, FIELD_W, FIELD_H);
  const WALL_IMG = WALL_IMGS[stageAttr()];
  if (WALL_IMG.complete && WALL_IMG.naturalWidth) {
    let wallTile = wallTiles[stageAttr()];
    if (!wallTile) {   // 壁は、拡大後の大きさで縮めておく(拡大でぼやけないように)
      const k = FIELD_H * FIELD_SCALE / WALL_IMG.naturalHeight;
      wallTile = wallTiles[stageAttr()] = document.createElement('canvas');
      wallTile.width = Math.round(WALL_IMG.naturalWidth * k); wallTile.height = Math.round(FIELD_H * FIELD_SCALE);
      const t = wallTile.getContext('2d');
      t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';   // 縮めるのでなめらかに(アンチエイリアス)
      t.drawImage(WALL_IMG, 0, 0, wallTile.width, wallTile.height);
    }
    const tw = wallTile.width / FIELD_SCALE;
    const first = Math.floor(-fieldScroll / tw) - 1, last = Math.ceil((FIELD_W - fieldScroll) / tw);
    for (let i = first; i <= last; i++) g.drawImage(wallTile, i * tw + fieldScroll, 0, tw, FIELD_H);
  }
  drawShadows(g);
  if (stageClear) {                // はけるとき: みんな開いた扉の奥側と手前の扉板の間を通る
    drawDoorBack(g); drawEnemies(g); drawHero(g); drawMonsters(g); drawDoorFront(g);
  } else {
    drawHero(g);
    drawDoorBack(g);
    drawEnemies(g);
    drawDoorFront(g);
    drawMonsters(g);
  }
  drawFx(g);
  drawStageText(g);
  if (titleScreen) drawTitleField(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function drawPiece(g, name, ox, oy, s, alpha = 1) {
  const sh = SHAPES[name];
  drawGroup(g, pieceItems(sh.cells, sh.color, ox, oy, s, false), alpha);
}

function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#1b1e27'; ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke(); }
  for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke(); }

  const items = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const b = board[y][x];
      if (clearing && clearing.burst && clearing.rows.includes(y)) continue; // 粒になった行は描かない
      if (b) items.push({ px: x * CELL, py: y * CELL, s: CELL, color: b.color, hole: b.hole, rivet: b.rivet,
                          under: b.under, links: b.links || 0, conc: boardConc(x, y, b), dx: wobbleX(b) });
    }
  drawGroup(ctx, items);

  if (!over && cur) {
    // ゴースト(通常の着地点まで。穴の重なりは手前で止める)
    let gy = cur.y;
    while (true) {
      const res = check(cur.cells, cur.x, gy + 1);
      if (res === null) break;
      gy++;
      if (res > 0) break;
    }
    drawGhost(ctx, pieceItems(cur.cells, cur.color, cur.x * CELL, gy * CELL, CELL, true));
    drawGroup(ctx, pieceItems(cur.cells, cur.color, cur.x * CELL, cur.y * CELL, CELL, true));
  }

  if (clearing) drawClearFx();
  drawHatch(ctx);

  // リベット打ち演出
  for (const f of flash) {
    const a = 1 - f.t / 300;
    if (a <= 0) continue;
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL * (0.3 + f.t / 300 * 0.6), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2; ctx.stroke();
  }

  nctx.clearRect(0, 0, nv.width, nv.height);
  {
    const name = queue[0], sh = SHAPES[name];
    drawPiece(nctx, name, (nv.width - sh.n * 24) / 2, 10, 24);
  }


  if (stageClear) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#ffe27a'; ctx.textAlign = 'center'; ctx.font = pixFont(32);
    ctx.fillText(zen('QUEST CLEAR'), cv.width / 2, cv.height / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = pixFont(16); ctx.fillText('次のステージへ', cv.width / 2, cv.height / 2 + 20);
  }
  if (over || paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = pixFont(32);
    ctx.fillText(zen(!over ? 'PAUSE' : overReason === 'ending' ? 'THE END' : overReason === 'clear' ? 'QUEST CLEAR' : 'QUEST FAILED'), cv.width / 2, cv.height / 2 - 10);
    if (over) {
      ctx.font = pixFont(16);
      const why = overReason === 'ending' ? 'ラスボスをたおした! ぼうけんクリア!' : overReason === 'clear' ? '扉が開いた!' : overReason === 'enemy' ? '' : 'ブロックが積み上がった';
      if (why) ctx.fillText(why, cv.width / 2, cv.height / 2 + 20);
      ctx.font = pixFont(16); ctx.fillText(zen('R') + 'でリスタート', cv.width / 2, cv.height / 2 + 46);
    }
  }
  if (titleScreen) drawTitleBoard(ctx);
}

// ---- 入力 ----
const NUMPAD = {
  Numpad4: 'ArrowLeft', Numpad6: 'ArrowRight', Numpad2: 'ArrowDown',
  Numpad0: ' ', Numpad5: 'x', Numpad3: 'x', Numpad1: 'z',
};
// キーを押した・離したときの動き(キーボードとスマホのボタンで共通)
function keyDown(key, repeat) {
  startBgm();
  if (key === 'm' || key === 'M') { if (!repeat) { bgmMuted = !bgmMuted; updateBgm(); } return; }
  if (titleScreen) { if (!repeat) startGame(); return; }   // タイトル画面: どのキーでも始まる
  if (key === 'r' || key === 'R') { reset(); restartBgm(); return; }
  if (repeat) return;
  if (key === 'p' || key === 'P') { if (!over) paused = !paused; return; }
  if (over || paused || clearing || stageClear) return;
  if (key === 'ArrowLeft') { moveDir = -1; dasTimer = 0; tryMove(-1, 0); }
  else if (key === 'ArrowRight') { moveDir = 1; dasTimer = 0; tryMove(1, 0); }
  else if (key === 'ArrowDown') softDrop = true;
  else if (key === ' ') hardDrop();
  else if (key === 'ArrowUp' || key === 'x' || key === 'X') rotate(1);
  else if (key === 'z' || key === 'Z') rotate(-1);
}
function keyUp(key) {
  if (key === 'ArrowLeft' && moveDir === -1) moveDir = 0;
  else if (key === 'ArrowRight' && moveDir === 1) moveDir = 0;
  else if (key === 'ArrowDown') softDrop = false;
}
addEventListener('keydown', e => {
  const key = NUMPAD[e.code] || e.key;
  if (NUMPAD[e.code]) e.preventDefault();
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(key)) e.preventDefault();
  keyDown(key, e.repeat);
});
addEventListener('keyup', e => keyUp(NUMPAD[e.code] || e.key));
// スマホのボタン(data-key に、押したことにするキーを書いておく)
for (const btn of document.querySelectorAll ? document.querySelectorAll('[data-key]') : []) {
  const key = btn.dataset.key;
  const up = e => { e.preventDefault(); btn.classList.remove('on'); keyUp(key); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('on'); keyDown(key, false); });
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
}

// ---- 画面の大きさ ----
// 上のダンジョンの表示エリアは、下のエリア(盤面と右の欄)の幅に合わせる
function fitField() {
  const main = document.getElementById('main');
  if (!main || !main.offsetWidth) return;
  const w = main.offsetWidth - 4;   // キャンバスの枠(左右2pxずつ)を除く
  FIELD_SCALE = w / FIELD_W;
  fieldCv.width = w; fieldCv.height = Math.round(FIELD_H * FIELD_SCALE);
  wallTiles = {};                    // 背景は新しい大きさで作り直す
}
// 画面に収まらないとき(スマホなど)は、全体を縮めて表示する
function fitScreen() {
  const wrap = document.getElementById('wrap');
  if (!wrap || !wrap.offsetWidth) return;
  wrap.style.transform = ''; wrap.style.margin = '';
  const W = wrap.offsetWidth, H = wrap.offsetHeight;
  const k = Math.min(1, (innerWidth - 8) / W, (innerHeight - 8) / H);
  wrap.style.transformOrigin = 'top center';
  wrap.style.transform = 'scale(' + k + ')';
  // 縮めたぶん、まわりの余白も詰める(横スクロールや、下の空白が出ないように)
  wrap.style.margin = '0 ' + (W * (k - 1) / 2) + 'px ' + (H * (k - 1)) + 'px';
}
function fitAll() { fitField(); fitScreen(); }
addEventListener('resize', fitAll);
addEventListener('orientationchange', fitAll);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
fitAll();

let last = performance.now();
function loop(t) {
  const dt = Math.min(100, t - last); last = t;
  titleT += dt;
  if (titleScreen) { draw(); drawField(t); requestAnimationFrame(loop); return; }   // タイトル画面: ゲームは止めておく
  update(dt);
  if (!paused && !over && !clearing) updateWobble(dt);
  if (!paused && (!over || overReason === 'ending')) { if (!stageClear && !over) updateHatch(dt); updateMonsters(dt); updateEnemies(dt); updateBattle(dt); }
  if (!paused) updateStage(dt);
  updateBossCard();
  watchBgm();
  for (const f of flash) f.t += dt;
  flash = flash.filter(f => f.t < 300);
  draw();
  drawField(t);
  requestAnimationFrame(loop);
}
reset();
for (const el of [cv, fieldCv]) el.addEventListener('pointerdown', () => { if (titleScreen) startGame(); });   // タイトル画面は、画面のタップでも始まる
requestAnimationFrame(loop);
