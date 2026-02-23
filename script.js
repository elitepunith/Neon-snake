'use strict';

// ─── Canvas setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

const COLS = 25;
const ROWS = 25;

let CELL = 20;

function sizeCanvas() {
  const wrapper  = document.getElementById('canvas-wrapper');
  const app      = document.getElementById('app');
  const header   = document.querySelector('header');
  const footer   = document.querySelector('footer');
  const touch    = document.getElementById('touch-controls');

  const isMobile = window.innerWidth <= 600 || (window.innerWidth <= 900 && 'ontouchstart' in window);

  const touchH = isMobile && touch ? touch.offsetHeight + 8 : 0;
  const footerH = !isMobile && footer ? footer.offsetHeight + 8 : 0;

  const availW = app.clientWidth - 32;
  const availH = window.innerHeight
    - (header.offsetHeight + 8)
    - touchH
    - footerH
    - 32;

  const maxByWidth  = Math.floor(availW / COLS);
  const maxByHeight = Math.floor(availH / ROWS);
  CELL = Math.max(10, Math.min(maxByWidth, maxByHeight, 24));

  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIR = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x: 1,  y:  0 }
};

const OPPOSITES = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
};

const KEY_MAP = {
  ArrowUp:    'UP',   w: 'UP',   W: 'UP',
  ArrowDown:  'DOWN', s: 'DOWN', S: 'DOWN',
  ArrowLeft:  'LEFT', a: 'LEFT', A: 'LEFT',
  ArrowRight: 'RIGHT',d: 'RIGHT',D: 'RIGHT'
};

const C = {
  bg:      '#060d14',
  grid:    'rgba(0,255,159,0.035)',
  green:   '#00ff9f',
  greenDim:'#00cc7a',
  pink:    '#ff2d78',
  blue:    '#00d4ff',
  yellow:  '#ffe44d',
  dark:    '#020408'
};

// ─── Audio engine ─────────────────────────────────────────────────────────────

const audio = (function() {
  let ac = null;

  function ctx() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) {
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, type, dur, vol, at) {
    const c = ctx();
    if (!c) return;
    try {
      const t   = c.currentTime + (at || 0);
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(Math.min(vol, 0.3), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch(e) {}
  }

  function noise(dur, vol) {
    const c = ctx();
    if (!c) return;
    try {
      const len  = Math.floor(c.sampleRate * dur);
      const buf  = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      src.connect(g);
      g.connect(c.destination);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      src.start();
      src.stop(c.currentTime + dur + 0.02);
    } catch(e) {}
  }

  return {
    eat()     { tone(440,'square',0.06,0.14); tone(660,'square',0.06,0.10,0.05); },
    special() { tone(523,'sawtooth',0.07,0.12); tone(659,'sawtooth',0.07,0.11,0.06); tone(880,'sawtooth',0.1,0.13,0.13); },
    die()     { tone(220,'sawtooth',0.12,0.18); tone(170,'sawtooth',0.15,0.14,0.1); tone(120,'sawtooth',0.2,0.12,0.22); noise(0.35,0.07); },
    turn()    { tone(280,'square',0.02,0.03); },
    levelUp() { [392,523,659,784].forEach((f,i) => tone(f,'square',0.09,0.14,i*0.09)); }
  };
})();

// ─── Particles ───────────────────────────────────────────────────────────────

const particles = [];

function spawnParticles(gx, gy, color, count) {
  const cx = gx * CELL + CELL / 2;
  const cy = gy * CELL + CELL / 2;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.6;
    const speed = 1.2 + Math.random() * 2.8;
    particles.push({
      x:     cx,
      y:     cy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      life:  1,
      decay: 0.035 + Math.random() * 0.04,
      size:  1.5 + Math.random() * 2.5,
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.07;
    p.vx   *= 0.98;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha  = p.life * p.life;
    ctx.fillStyle    = p.color;
    ctx.shadowBlur   = 5;
    ctx.shadowColor  = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

// ─── Game state ──────────────────────────────────────────────────────────────

const game = {
  snake:        [],
  dir:          DIR.RIGHT,
  nextDir:      DIR.RIGHT,
  dirName:      'RIGHT',
  food:         null,
  special:      null,
  specialTicks: 0,
  score:        0,
  best:         parseInt(localStorage.getItem('neon-snake-best') || '0', 10),
  level:        1,
  foodEaten:    0,
  tickMs:       120,
  state:        'idle',
  loopId:       null,
  rafId:        null,
  flashAlpha:   0,
  deathAlpha:   0,
  deathActive:  false
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
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
  let attempts = 0;
  do {
    cell = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    };
    attempts++;
    if (attempts > COLS * ROWS) break;
  } while (exclude.some(p => p.x === cell.x && p.y === cell.y));
  return cell;
}

// ─── Game logic ──────────────────────────────────────────────────────────────

function initSnake() {
  const mx = Math.floor(COLS / 2);
  const my = Math.floor(ROWS / 2);
  game.snake   = [ {x: mx, y: my}, {x: mx-1, y: my}, {x: mx-2, y: my} ];
  game.dir     = DIR.RIGHT;
  game.nextDir = DIR.RIGHT;
  game.dirName = 'RIGHT';
}

function placeFood() {
  game.food = randomCell(game.snake);
}

function trySpawnSpecial() {
  if (!game.special && Math.random() < 0.18) {
    const exclude = [...game.snake, game.food];
    game.special      = randomCell(exclude);
    game.specialTicks = 60 + Math.floor(Math.random() * 50);
  }
}

function startGame() {
  clearInterval(game.loopId);
  game.score        = 0;
  game.level        = 1;
  game.foodEaten    = 0;
  game.tickMs       = 120;
  game.special      = null;
  game.specialTicks = 0;
  game.flashAlpha   = 0;
  game.deathAlpha   = 0;
  game.deathActive  = false;
  particles.length  = 0;

  initSnake();
  placeFood();

  game.state = 'running';
  showScreen(null);

  setEl('score-display', fmt(0));
  setEl('level-display', String(game.level).padStart(2, '0'));
  setEl('best-display', fmt(game.best));

  game.loopId = setInterval(tick, game.tickMs);
}

function tick() {
  if (game.state !== 'running') return;

  game.dir = game.nextDir;

  const head = game.snake[0];
  const next = {
    x: (head.x + game.dir.x + COLS) % COLS,
    y: (head.y + game.dir.y + ROWS) % ROWS
  };

  // Collision with self — skip the tail tip since it will move away
  const selfHit = game.snake.slice(0, -1).some(s => s.x === next.x && s.y === next.y);
  if (selfHit) {
    die();
    return;
  }

  game.snake.unshift(next);

  let grew = false;

  if (next.x === game.food.x && next.y === game.food.y) {
    grew = true;
    game.score     += game.level * 10;
    game.foodEaten += 1;
    spawnParticles(next.x, next.y, C.pink, 12);
    audio.eat();
    placeFood();
    trySpawnSpecial();
    checkLevel();
  }

  if (game.special && next.x === game.special.x && next.y === game.special.y) {
    grew = true;
    game.score        += game.level * 50;
    game.foodEaten    += 1;
    spawnParticles(next.x, next.y, C.yellow, 20);
    audio.special();
    game.special      = null;
    game.specialTicks = 0;
    game.flashAlpha   = 0.25;
    checkLevel();
  }

  if (!grew) game.snake.pop();

  if (game.special) {
    game.specialTicks--;
    if (game.specialTicks <= 0) {
      game.special = null;
    }
  }

  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem('neon-snake-best', String(game.best));
    setEl('best-display', fmt(game.best));
  }

  setEl('score-display', fmt(game.score));
}

function checkLevel() {
  const thresholds = [5, 10, 16, 23, 31, 40, 50, 61, 73, 86, 100];
  let newLevel = thresholds.findIndex(t => game.foodEaten < t) + 1;
  if (newLevel === 0) newLevel = thresholds.length + 1;

  if (newLevel > game.level) {
    game.level = newLevel;
    clearInterval(game.loopId);
    game.tickMs = Math.max(48, 120 - (game.level - 1) * 7);
    game.loopId = setInterval(tick, game.tickMs);
    setEl('level-display', String(game.level).padStart(2, '0'));
    audio.levelUp();
    game.flashAlpha = 0.18;
  }
}

function die() {
  game.state = 'dead';
  clearInterval(game.loopId);
  audio.die();

  game.deathActive = true;
  game.deathAlpha  = 0;

  game.snake.forEach((seg, i) => {
    setTimeout(() => {
      spawnParticles(seg.x, seg.y, C.green, 5);
    }, i * 15);
  });

  const isNewBest = game.score > 0 && game.score >= game.best;
  setEl('final-score', fmt(game.score));
  const badge = document.getElementById('new-best-badge');
  isNewBest ? badge.classList.remove('hidden') : badge.classList.add('hidden');

  setTimeout(() => {
    game.deathActive = false;
    showScreen('gameover');
  }, 900);
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
  if (name === OPPOSITES[game.dirName]) return;
  if (name === game.dirName) return;
  game.nextDir = DIR[name];
  game.dirName = name;
  audio.turn();
}

// ─── Rendering ───────────────────────────────────────────────────────────────

let foodPulse    = 0;
let specialPulse = 0;
let time         = 0;

function drawGrid() {
  ctx.strokeStyle = C.grid;
  ctx.lineWidth   = 0.5;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(canvas.width, y * CELL);
    ctx.stroke();
  }
}

function drawFood() {
  foodPulse += 0.07;
  const pulse = 0.72 + Math.sin(foodPulse) * 0.28;
  const r     = (CELL / 2 - 2) * pulse;
  const cx    = game.food.x * CELL + CELL / 2;
  const cy    = game.food.y * CELL + CELL / 2;

  ctx.save();
  ctx.shadowBlur  = 18 * pulse;
  ctx.shadowColor = C.pink;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,45,120,${0.25 * pulse})`;
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Main circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.pink;
  ctx.fill();

  // Specular dot
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  ctx.restore();
}

function drawSpecial() {
  if (!game.special) return;

  specialPulse += 0.1;
  const pulse   = 0.78 + Math.sin(specialPulse) * 0.22;
  const urgency = game.specialTicks < 20
    ? (Math.sin(Date.now() / 80) * 0.5 + 0.5)
    : 1;
  const size    = (CELL - 4) * pulse;
  const sp      = game.special;
  const cx      = sp.x * CELL + CELL / 2;
  const cy      = sp.y * CELL + CELL / 2;

  ctx.save();
  ctx.globalAlpha = urgency;
  ctx.translate(cx, cy);
  ctx.rotate(specialPulse * 0.6);

  ctx.shadowBlur  = 22 * pulse;
  ctx.shadowColor = C.yellow;
  ctx.fillStyle   = C.yellow;
  ctx.fillRect(-size / 2, -size / 2, size, size);

  // Inner highlight
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-size * 0.15, -size * 0.15, size * 0.3, size * 0.3);

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
      const pad  = 1;
      ctx.fillRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2);

      // Head border
      ctx.strokeStyle = 'rgba(0,30,20,0.6)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, CELL - pad * 2 - 1, CELL - pad * 2 - 1);

      // Eyes
      drawEyes(px, py);

    } else {
      const t     = i / len;
      const alpha = 1 - t * 0.55;
      const g     = Math.floor(lerp(200, 80, t));
      const b     = Math.floor(lerp(120, 40, t));

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
  const s = Math.max(2, Math.floor(CELL / 7));
  const m = Math.floor(CELL / 4);

  let positions;
  if (d === DIR.RIGHT) {
    positions = [ [px + CELL - m,     py + m],
                  [px + CELL - m,     py + CELL - m - s] ];
  } else if (d === DIR.LEFT) {
    positions = [ [px + m - s,        py + m],
                  [px + m - s,        py + CELL - m - s] ];
  } else if (d === DIR.UP) {
    positions = [ [px + m,            py + m - s],
                  [px + CELL - m - s, py + m - s] ];
  } else {
    positions = [ [px + m,            py + CELL - m],
                  [px + CELL - m - s, py + CELL - m] ];
  }

  ctx.fillStyle = C.dark;
  positions.forEach(([ex, ey]) => ctx.fillRect(ex, ey, s, s));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawDeathEffect() {
  if (!game.deathActive) return;
  game.deathAlpha = Math.min(game.deathAlpha + 0.04, 0.55);

  ctx.save();
  ctx.globalAlpha = game.deathAlpha;
  ctx.fillStyle   = C.pink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawFlash() {
  if (game.flashAlpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = game.flashAlpha;
  ctx.fillStyle   = C.green;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  game.flashAlpha = Math.max(0, game.flashAlpha - 0.025);
}

function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  time++;

  drawGrid();

  if (game.food)    drawFood();
  if (game.special) drawSpecial();

  if (game.snake.length > 0) drawSnake();

  drawParticles();
  updateParticles();

  drawFlash();
  drawDeathEffect();

  game.rafId = requestAnimationFrame(render);
}

// ─── Input — keyboard ────────────────────────────────────────────────────────

document.addEventListener('keydown', function(e) {
  const dir = KEY_MAP[e.key];

  if (dir) {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    if (game.state === 'running') changeDir(dir);
    if (game.state === 'idle')    startGame();
    return;
  }

  if (e.key === 'p' || e.key === 'P') {
    pause();
    return;
  }

  if (e.key === 'Escape') {
    if (game.state === 'running' || game.state === 'paused') {
      game.state = 'idle';
      clearInterval(game.loopId);
      startGame();
    }
    return;
  }

  if ((e.key === ' ' || e.key === 'Enter') && game.state === 'idle') {
    e.preventDefault();
    startGame();
  }
});

// ─── Input — touch (swipe on canvas) ─────────────────────────────────────────

let touchStartX = null;
let touchStartY = null;

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if (touchStartX === null) return;

  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (Math.max(absDx, absDy) < 10) return;

  if (absDx > absDy) {
    changeDir(dx > 0 ? 'RIGHT' : 'LEFT');
  } else {
    changeDir(dy > 0 ? 'DOWN' : 'UP');
  }

  touchStartX = null;
  touchStartY = null;
}, { passive: false });

// ─── Input — touch buttons ────────────────────────────────────────────────────

function bindTouchBtn(id, action) {
  const el = document.getElementById(id);
  if (!el) return;

  function press(e) {
    e.preventDefault();
    el.classList.add('pressed');
    action();
  }

  function release(e) {
    e.preventDefault();
    el.classList.remove('pressed');
  }

  el.addEventListener('touchstart', press,   { passive: false });
  el.addEventListener('touchend',   release, { passive: false });
  el.addEventListener('mousedown',  press);
  el.addEventListener('mouseup',    release);
  el.addEventListener('mouseleave', release);
}

bindTouchBtn('touch-up',    () => { if (game.state === 'running') changeDir('UP'); });
bindTouchBtn('touch-down',  () => { if (game.state === 'running') changeDir('DOWN'); });
bindTouchBtn('touch-left',  () => { if (game.state === 'running') changeDir('LEFT'); });
bindTouchBtn('touch-right', () => { if (game.state === 'running') changeDir('RIGHT'); });
bindTouchBtn('touch-pause', () => pause());

// ─── UI button bindings ──────────────────────────────────────────────────────

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-restart-pause').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', resume);

// ─── Resize handling ─────────────────────────────────────────────────────────

let resizeTimer = null;

window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    sizeCanvas();
  }, 80);
});

// ─── Init ────────────────────────────────────────────────────────────────────

sizeCanvas();
setEl('best-display', fmt(game.best));
showScreen('start');
render();
