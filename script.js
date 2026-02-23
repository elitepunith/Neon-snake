'use strict';

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

const COLS = 25;
const ROWS = 25;
let   CELL = 20;

// ─── Canvas sizing ────────────────────────────────────────────────────────────
//
// Must run AFTER fonts and layout are painted.
// We measure with fixed logical heights instead of reading DOM offsets,
// because offsetHeight can return 0 if called before the first paint.
//
function sizeCanvas() {
  const HEADER_H  = 52;
  const FOOTER_H  = 28;
  const PAD_V     = 20;   // top + bottom padding combined
  const DPAD_H    = 175;  // d-pad + its top-padding, only on touch
  const isTouch   = window.matchMedia('(hover:none) and (pointer:coarse)').matches
                    || window.innerWidth <= 480;

  const usedV = HEADER_H + PAD_V + (isTouch ? DPAD_H : FOOTER_H);

  const availW = window.innerWidth  - 32;
  const availH = (window.innerHeight || document.documentElement.clientHeight) - usedV;

  const byW = Math.floor(availW / COLS);
  const byH = Math.floor(availH / ROWS);
  CELL = Math.max(10, Math.min(byW, byH, 26));

  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
}

// ─── Direction constants ──────────────────────────────────────────────────────

const DIR = {
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 }
};

const OPPOSITE = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
};

const KEY_MAP = {
  ArrowUp:   'UP',    w: 'UP',    W: 'UP',
  ArrowDown: 'DOWN',  s: 'DOWN',  S: 'DOWN',
  ArrowLeft: 'LEFT',  a: 'LEFT',  A: 'LEFT',
  ArrowRight:'RIGHT', d: 'RIGHT', D: 'RIGHT'
};

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg:      '#060d14',
  grid:    'rgba(0,255,159,0.032)',
  green:   '#00ff9f',
  pink:    '#ff2d78',
  blue:    '#00d4ff',
  yellow:  '#ffe44d',
  dark:    '#020408'
};

// ─── Procedural audio ─────────────────────────────────────────────────────────

const audio = (function() {
  let ac = null;

  function getAc() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { return null; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, type, dur, vol, delay) {
    const a = getAc();
    if (!a) return;
    try {
      const t   = a.currentTime + (delay || 0);
      const osc = a.createOscillator();
      const g   = a.createGain();
      osc.connect(g);
      g.connect(a.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(Math.min(vol, 0.28), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch(e) {}
  }

  function noise(dur, vol) {
    const a = getAc();
    if (!a) return;
    try {
      const len  = Math.ceil(a.sampleRate * dur);
      const buf  = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      src.connect(g);
      g.connect(a.destination);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      src.start();
      src.stop(a.currentTime + dur + 0.02);
    } catch(e) {}
  }

  return {
    eat()     { tone(440,'square',0.06,0.13); tone(660,'square',0.06,0.10,0.055); },
    special() { tone(523,'sawtooth',0.07,0.11); tone(659,'sawtooth',0.07,0.10,0.065); tone(880,'sawtooth',0.1,0.12,0.13); },
    die()     { tone(220,'sawtooth',0.12,0.17); tone(170,'sawtooth',0.14,0.14,0.11); tone(120,'sawtooth',0.2,0.11,0.22); noise(0.35,0.065); },
    turn()    { tone(260,'square',0.02,0.025); },
    levelUp() { [392,523,659,784].forEach((f,i) => tone(f,'square',0.09,0.13,i*0.09)); }
  };
})();

// ─── Particles ────────────────────────────────────────────────────────────────

const particles = [];

function spawnParticles(gx, gy, color, count) {
  const cx = gx * CELL + CELL / 2;
  const cy = gy * CELL + CELL / 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
    const speed = 1.4 + Math.random() * 2.6;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      size: 1.5 + Math.random() * 2.5,
      color
    });
  }
}

function tickParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.06;
    p.vx   *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life * p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowBlur  = 5;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

// ─── Game state ───────────────────────────────────────────────────────────────

const game = {
  snake:       [],
  dir:         DIR.RIGHT,
  nextDir:     DIR.RIGHT,
  dirName:     'RIGHT',   // actual direction the snake is currently moving
  pendingName: null,      // direction queued since last tick, not yet applied
  food:        null,
  special:     null,
  specialLife: 0,
  score:       0,
  best:        parseInt(localStorage.getItem('neon-snake-best') || '0', 10),
  level:       1,
  eaten:       0,
  tickMs:      120,
  state:       'idle',    // 'idle' | 'running' | 'paused' | 'dead'
  loopId:      null,
  rafId:       null,
  flash:       0,
  deathFlash:  0
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad6(n) {
  return String(Math.floor(n)).padStart(6, '0');
}

function setEl(id, val) {
  document.getElementById(id).textContent = val;
}

function showScreen(name) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
  if (name) {
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
  }
}

function randomCell(exclude) {
  let cell;
  let tries = 0;
  do {
    cell  = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    tries++;
    if (tries > COLS * ROWS) break;
  } while (exclude.some(p => p.x === cell.x && p.y === cell.y));
  return cell;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ─── Game flow ────────────────────────────────────────────────────────────────

function initSnake() {
  const mx = Math.floor(COLS / 2);
  const my = Math.floor(ROWS / 2);
  game.snake       = [ {x: mx, y: my}, {x: mx - 1, y: my}, {x: mx - 2, y: my} ];
  game.dir         = DIR.RIGHT;
  game.nextDir     = DIR.RIGHT;
  game.dirName     = 'RIGHT';
  game.pendingName = null;
}

function startGame() {
  clearInterval(game.loopId);

  game.score       = 0;
  game.level       = 1;
  game.eaten       = 0;
  game.tickMs      = 120;
  game.special     = null;
  game.specialLife = 0;
  game.flash       = 0;
  game.deathFlash  = 0;
  particles.length = 0;

  initSnake();
  game.food = randomCell(game.snake);

  game.state = 'running';
  showScreen(null);

  setEl('score-display', pad6(0));
  setEl('level-display', String(1).padStart(2, '0'));
  setEl('best-display',  pad6(game.best));

  game.loopId = setInterval(tick, game.tickMs);
}

function tick() {
  if (game.state !== 'running') return;

  // Apply the direction queued since the last tick.
  // We validate here against game.dirName (actual current movement) as a
  // final safety net — this catches rapid double-presses that slipped through.
  if (game.pendingName) {
    if (game.pendingName !== OPPOSITE[game.dirName]) {
      game.nextDir = DIR[game.pendingName];
      game.dirName = game.pendingName;
    }
    game.pendingName = null;
  }

  game.dir = game.nextDir;

  const head = game.snake[0];
  const next = {
    x: (head.x + game.dir.x + COLS) % COLS,
    y: (head.y + game.dir.y + ROWS) % ROWS
  };

  // Check self-collision: exclude the tail tip because it vacates this tick
  const selfHit = game.snake.slice(0, -1).some(s => s.x === next.x && s.y === next.y);
  if (selfHit) { die(); return; }

  game.snake.unshift(next);

  let grew = false;

  // Food
  if (next.x === game.food.x && next.y === game.food.y) {
    grew = true;
    game.score += game.level * 10;
    game.eaten += 1;
    spawnParticles(next.x, next.y, C.pink, 12);
    audio.eat();
    game.food = randomCell(game.snake);
    maybeSpawnSpecial();
    checkLevel();
  }

  // Special
  if (game.special && next.x === game.special.x && next.y === game.special.y) {
    grew = true;
    game.score       += game.level * 50;
    game.eaten       += 1;
    game.flash        = 0.22;
    spawnParticles(next.x, next.y, C.yellow, 20);
    audio.special();
    game.special     = null;
    game.specialLife = 0;
    checkLevel();
  }

  if (!grew) game.snake.pop();

  // Age the special item
  if (game.special) {
    game.specialLife--;
    if (game.specialLife <= 0) game.special = null;
  }

  // Update best
  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem('neon-snake-best', String(game.best));
    setEl('best-display', pad6(game.best));
  }

  setEl('score-display', pad6(game.score));
}

function maybeSpawnSpecial() {
  if (!game.special && Math.random() < 0.18) {
    game.special     = randomCell([...game.snake, game.food]);
    game.specialLife = 65 + Math.floor(Math.random() * 45);
  }
}

function checkLevel() {
  // Each threshold = cumulative food needed to reach the next level
  const thresholds = [5, 10, 16, 23, 31, 40, 50, 61, 73, 86, 100];
  let next = thresholds.findIndex(t => game.eaten < t);
  if (next === -1) next = thresholds.length;
  const newLevel = next + 1;

  if (newLevel > game.level) {
    game.level = newLevel;
    setEl('level-display', String(game.level).padStart(2, '0'));
    clearInterval(game.loopId);
    game.tickMs = Math.max(48, 120 - (game.level - 1) * 7);
    game.loopId = setInterval(tick, game.tickMs);
    audio.levelUp();
    game.flash = 0.16;
  }
}

function die() {
  game.state = 'dead';
  clearInterval(game.loopId);
  audio.die();

  // Stagger death particles along the body
  game.snake.forEach((seg, i) => {
    setTimeout(() => spawnParticles(seg.x, seg.y, C.green, 4), i * 18);
  });

  game.deathFlash = 0.45;

  const isNewBest = game.score > 0 && game.score >= game.best;
  setEl('final-score', pad6(game.score));
  const badge = document.getElementById('new-best-badge');
  isNewBest ? badge.classList.remove('hidden') : badge.classList.add('hidden');

  setTimeout(() => showScreen('gameover'), 850);
}

function pause() {
  if (game.state === 'running') {
    game.state = 'paused';
    clearInterval(game.loopId);
    showScreen('paused');
  } else if (game.state === 'paused') {
    resume();
  }
}

function resume() {
  if (game.state !== 'paused') return;
  game.state = 'running';
  game.loopId = setInterval(tick, game.tickMs);
  showScreen(null);
}

function changeDir(name) {
  if (game.state !== 'running') return;

  // Validate against whatever direction the snake will actually be moving
  // when this input is applied. If a turn is already pending this tick, the
  // snake will have taken that turn by the time this one is processed, so
  // check against pendingName first. Falls back to the real current direction.
  const checkAgainst = game.pendingName || game.dirName;

  if (name === OPPOSITE[checkAgainst]) return;  // would drive straight into body
  if (name === checkAgainst) return;            // same direction, ignore

  game.pendingName = name;
  audio.turn();
}

// ─── Rendering ────────────────────────────────────────────────────────────────

let foodPulse    = 0;
let specialPulse = 0;

function drawGrid() {
  ctx.strokeStyle = C.grid;
  ctx.lineWidth   = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
  }
}

function drawFood() {
  foodPulse += 0.07;
  const pulse = 0.72 + Math.sin(foodPulse) * 0.28;
  const r  = (CELL / 2 - 2) * pulse;
  const cx = game.food.x * CELL + CELL / 2;
  const cy = game.food.y * CELL + CELL / 2;

  ctx.save();
  ctx.shadowBlur  = 18 * pulse;
  ctx.shadowColor = C.pink;

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,45,120,${0.22 * pulse})`;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.pink;
  ctx.fill();

  // Specular
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  ctx.restore();
}

function drawSpecial() {
  if (!game.special) return;

  specialPulse += 0.1;
  const pulse   = 0.8 + Math.sin(specialPulse) * 0.2;
  const urgency = game.specialLife < 18 ? (Math.sin(Date.now() / 75) * 0.5 + 0.5) : 1;
  const size    = (CELL - 4) * pulse;
  const cx      = game.special.x * CELL + CELL / 2;
  const cy      = game.special.y * CELL + CELL / 2;

  ctx.save();
  ctx.globalAlpha = urgency;
  ctx.translate(cx, cy);
  ctx.rotate(specialPulse * 0.55);
  ctx.shadowBlur  = 20 * pulse;
  ctx.shadowColor = C.yellow;
  ctx.fillStyle   = C.yellow;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = 'rgba(255,255,255,0.22)';
  ctx.fillRect(-size * 0.16, -size * 0.16, size * 0.32, size * 0.32);
  ctx.restore();
}

function drawSnake() {
  const len = game.snake.length;

  for (let i = len - 1; i >= 0; i--) {
    const seg    = game.snake[i];
    const isHead = i === 0;
    const px     = seg.x * CELL;
    const py     = seg.y * CELL;

    ctx.save();

    if (isHead) {
      ctx.shadowBlur  = 18;
      ctx.shadowColor = C.green;
      ctx.fillStyle   = C.green;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = 'rgba(0,20,14,0.55)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
      drawEyes(px, py);
    } else {
      const t     = i / len;
      const alpha = 1 - t * 0.58;
      const g     = Math.round(lerp(195, 75, t));
      const b     = Math.round(lerp(115, 38, t));
      ctx.shadowBlur  = lerp(10, 2, t);
      ctx.shadowColor = C.green;
      ctx.fillStyle   = `rgba(0,${g},${b},${alpha})`;
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    }

    ctx.restore();
  }
}

function drawEyes(px, py) {
  ctx.shadowBlur = 0;
  const d = game.dir;
  const s = Math.max(2, Math.floor(CELL * 0.15));
  const m = Math.floor(CELL * 0.26);
  let p;

  if      (d === DIR.RIGHT) p = [ [px + CELL - m,     py + m],         [px + CELL - m,     py + CELL - m - s] ];
  else if (d === DIR.LEFT)  p = [ [px + m - s,        py + m],         [px + m - s,        py + CELL - m - s] ];
  else if (d === DIR.UP)    p = [ [px + m,            py + m - s],     [px + CELL - m - s, py + m - s]        ];
  else                      p = [ [px + m,            py + CELL - m],  [px + CELL - m - s, py + CELL - m]     ];

  ctx.fillStyle = C.dark;
  p.forEach(([ex, ey]) => ctx.fillRect(ex, ey, s, s));
}

function drawScreenFlash() {
  if (game.flash > 0) {
    ctx.save();
    ctx.globalAlpha = game.flash;
    ctx.fillStyle   = C.green;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    game.flash = Math.max(0, game.flash - 0.022);
  }

  if (game.deathFlash > 0) {
    ctx.save();
    ctx.globalAlpha = game.deathFlash;
    ctx.fillStyle   = C.pink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    game.deathFlash = Math.max(0, game.deathFlash - 0.018);
  }
}

function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  if (game.food)    drawFood();
  if (game.special) drawSpecial();
  if (game.snake.length) drawSnake();
  drawParticles();
  tickParticles();
  drawScreenFlash();

  game.rafId = requestAnimationFrame(render);
}

// ─── Keyboard input ───────────────────────────────────────────────────────────

document.addEventListener('keydown', function(e) {
  const dir = KEY_MAP[e.key];

  if (dir) {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    changeDir(dir);
    if (game.state === 'idle') startGame();
    return;
  }

  switch (e.key) {
    case 'p': case 'P':
      pause();
      break;
    case 'Escape':
      if (game.state === 'running' || game.state === 'paused') startGame();
      break;
    case ' ': case 'Enter':
      e.preventDefault();
      if (game.state === 'idle' || game.state === 'dead') startGame();
      break;
  }
});

// ─── Swipe on canvas ──────────────────────────────────────────────────────────

let swipeX = null;
let swipeY = null;

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  swipeX = e.touches[0].clientX;
  swipeY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if (swipeX === null) return;
  const dx = e.changedTouches[0].clientX - swipeX;
  const dy = e.changedTouches[0].clientY - swipeY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) { swipeX = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) {
    changeDir(dx > 0 ? 'RIGHT' : 'LEFT');
  } else {
    changeDir(dy > 0 ? 'DOWN' : 'UP');
  }
  if (game.state === 'idle') startGame();
  swipeX = null;
  swipeY = null;
}, { passive: false });

// ─── D-pad buttons ────────────────────────────────────────────────────────────

function bindDpad(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;

  function down(e) {
    e.preventDefault();
    el.classList.add('pressed');
    fn();
  }
  function up(e) {
    e.preventDefault();
    el.classList.remove('pressed');
  }

  el.addEventListener('touchstart',  down, { passive: false });
  el.addEventListener('touchend',    up,   { passive: false });
  el.addEventListener('touchcancel', up,   { passive: false });
  el.addEventListener('mousedown',   down);
  el.addEventListener('mouseup',     up);
  el.addEventListener('mouseleave',  up);
}

bindDpad('touch-up',    () => changeDir('UP'));
bindDpad('touch-down',  () => changeDir('DOWN'));
bindDpad('touch-left',  () => changeDir('LEFT'));
bindDpad('touch-right', () => changeDir('RIGHT'));
bindDpad('touch-pause', () => pause());

// ─── UI buttons ───────────────────────────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-restart-pause').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', resume);

// ─── Window resize ────────────────────────────────────────────────────────────

let resizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(sizeCanvas, 100);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

// Wait for fonts so header text is sized correctly, then size canvas.
// Double-rAF ensures the browser has painted at least one frame.
function boot() {
  sizeCanvas();
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      sizeCanvas(); // second pass after paint — catches any layout shift
      setEl('best-display', pad6(game.best));
      showScreen('start');
      render();
    });
  });
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(boot);
} else {
  window.addEventListener('load', boot);
}
