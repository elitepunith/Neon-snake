const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const CELL = 20;
const COLS = 25;
const ROWS = 25;

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const DIR = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x: 1,  y:  0 }
};

const KEY_MAP = {
  ArrowUp:    'UP',    w: 'UP',    W: 'UP',
  ArrowDown:  'DOWN',  s: 'DOWN',  S: 'DOWN',
  ArrowLeft:  'LEFT',  a: 'LEFT',  A: 'LEFT',
  ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT'
};

const OPPOSITES = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

const Colors = {
  bg:           '#060d14',
  gridLine:     'rgba(0,255,159,0.04)',
  snakeHead:    '#00ff9f',
  snakeBody:    '#00cc7a',
  snakeBorder:  '#003322',
  food:         '#ff2d78',
  foodGlow:     'rgba(255,45,120,0.6)',
  special:      '#f9f002',
  specialGlow:  'rgba(249,240,2,0.6)',
  particleGreen:'#00ff9f',
  particlePink: '#ff2d78',
  text:         '#00ff9f'
};

const audio = (function() {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function tone(freq, type, duration, vol, delay) {
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + (delay || 0));
      gain.gain.setValueAtTime(vol, ac.currentTime + (delay || 0));
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + (delay || 0) + duration);
      osc.start(ac.currentTime + (delay || 0));
      osc.stop(ac.currentTime + (delay || 0) + duration + 0.01);
    } catch(e) {}
  }

  function noise(duration, vol) {
    try {
      const ac = getCtx();
      const bufSize = ac.sampleRate * duration;
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      src.connect(gain);
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      src.start();
      src.stop(ac.currentTime + duration + 0.01);
    } catch(e) {}
  }

  return {
    eat() {
      tone(440, 'square', 0.06, 0.15);
      tone(660, 'square', 0.06, 0.12, 0.05);
    },
    special() {
      tone(523, 'sawtooth', 0.08, 0.12);
      tone(659, 'sawtooth', 0.08, 0.12, 0.06);
      tone(784, 'sawtooth', 0.12, 0.14, 0.12);
    },
    die() {
      tone(220, 'sawtooth', 0.12, 0.2);
      tone(180, 'sawtooth', 0.15, 0.18, 0.08);
      tone(140, 'sawtooth', 0.2,  0.15, 0.18);
      noise(0.3, 0.08);
    },
    turn() {
      tone(300, 'square', 0.02, 0.04);
    },
    levelUp() {
      tone(392, 'square', 0.08, 0.15);
      tone(523, 'square', 0.08, 0.15, 0.08);
      tone(659, 'square', 0.1,  0.15, 0.16);
      tone(784, 'square', 0.12, 0.15, 0.24);
    }
  };
})();

const particles = [];

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x: x * CELL + CELL / 2,
      y: y * CELL + CELL / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.04 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  });
}

const game = {
  snake: [],
  dir: DIR.RIGHT,
  nextDir: DIR.RIGHT,
  currentDirName: 'RIGHT',
  food: null,
  special: null,
  specialTimer: 0,
  score: 0,
  best: parseInt(localStorage.getItem('neon-snake-best') || '0'),
  level: 1,
  foodEaten: 0,
  speed: 120,
  state: 'idle',
  loopTimer: null,
  animFrame: null,
  flashAlpha: 0
};

function formatScore(n) {
  return String(n).padStart(6, '0');
}

function setDisplay(id, val) {
  document.getElementById(id).textContent = val;
}

function showScreen(name) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
  if (name) document.getElementById('screen-' + name).classList.add('active');
}

function initSnake() {
  game.snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 }
  ];
  game.dir = DIR.RIGHT;
  game.nextDir = DIR.RIGHT;
  game.currentDirName = 'RIGHT';
}

function randomCell(exclude) {
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    };
  } while (exclude.some(p => p.x === pos.x && p.y === pos.y));
  return pos;
}

function placeFood() {
  game.food = randomCell(game.snake);
}

function tryPlaceSpecial() {
  if (!game.special && Math.random() < 0.15) {
    game.special = randomCell([...game.snake, game.food]);
    game.specialTimer = 80 + Math.floor(Math.random() * 40);
  }
}

function startGame() {
  game.score = 0;
  game.level = 1;
  game.foodEaten = 0;
  game.speed = 120;
  game.special = null;
  game.specialTimer = 0;
  particles.length = 0;
  initSnake();
  placeFood();
  game.state = 'running';
  showScreen(null);
  setDisplay('score-display', formatScore(0));
  setDisplay('level-display', String(game.level).padStart(2, '0'));
  setDisplay('best-display', formatScore(game.best));
  clearInterval(game.loopTimer);
  game.loopTimer = setInterval(step, game.speed);
  render();
}

function step() {
  if (game.state !== 'running') return;

  game.dir = game.nextDir;

  const head = game.snake[0];
  const next = {
    x: (head.x + game.dir.x + COLS) % COLS,
    y: (head.y + game.dir.y + ROWS) % ROWS
  };

  const hitSelf = game.snake.some(seg => seg.x === next.x && seg.y === next.y);
  if (hitSelf) {
    triggerDeath();
    return;
  }

  game.snake.unshift(next);

  let ate = false;

  if (next.x === game.food.x && next.y === game.food.y) {
    ate = true;
    const points = game.level * 10;
    game.score += points;
    game.foodEaten++;
    spawnParticles(next.x, next.y, Colors.particlePink, 12);
    audio.eat();
    placeFood();
    tryPlaceSpecial();
    checkLevelUp();
  }

  if (game.special && next.x === game.special.x && next.y === game.special.y) {
    ate = true;
    const points = game.level * 50;
    game.score += points;
    game.foodEaten++;
    spawnParticles(next.x, next.y, Colors.special, 20);
    audio.special();
    game.special = null;
    game.specialTimer = 0;
    game.flashAlpha = 0.3;
  }

  if (!ate) game.snake.pop();

  if (game.special) {
    game.specialTimer--;
    if (game.specialTimer <= 0) game.special = null;
  }

  setDisplay('score-display', formatScore(game.score));

  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem('neon-snake-best', game.best);
    setDisplay('best-display', formatScore(game.best));
  }
}

function checkLevelUp() {
  const thresholds = [5, 10, 16, 23, 31, 40, 50, 61, 73, 86];
  const newLevel = thresholds.findIndex(t => game.foodEaten < t);
  const level = newLevel === -1 ? thresholds.length + 1 : newLevel + 1;
  if (level > game.level) {
    game.level = level;
    setDisplay('level-display', String(game.level).padStart(2, '0'));
    clearInterval(game.loopTimer);
    game.speed = Math.max(50, 120 - (game.level - 1) * 8);
    game.loopTimer = setInterval(step, game.speed);
    audio.levelUp();
    game.flashAlpha = 0.2;
  }
}

function triggerDeath() {
  game.state = 'dead';
  clearInterval(game.loopTimer);
  audio.die();
  game.snake.forEach(seg => spawnParticles(seg.x, seg.y, Colors.particleGreen, 4));

  const isNewBest = game.score >= game.best && game.score > 0;
  setDisplay('final-score', formatScore(game.score));
  const badge = document.getElementById('new-best-badge');
  isNewBest ? badge.classList.remove('hidden') : badge.classList.add('hidden');

  setTimeout(() => showScreen('gameover'), 600);
}

function pause() {
  if (game.state !== 'running' && game.state !== 'paused') return;
  if (game.state === 'running') {
    game.state = 'paused';
    clearInterval(game.loopTimer);
    showScreen('paused');
  } else {
    resume();
  }
}

function resume() {
  if (game.state !== 'paused') return;
  game.state = 'running';
  game.loopTimer = setInterval(step, game.speed);
  showScreen(null);
}

function drawGrid() {
  ctx.strokeStyle = Colors.gridLine;
  ctx.lineWidth = 0.5;
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

function drawSnake() {
  game.snake.forEach((seg, i) => {
    const isHead = i === 0;
    const px = seg.x * CELL;
    const py = seg.y * CELL;
    const pad = isHead ? 1 : 2;
    const size = CELL - pad * 2;

    ctx.save();
    if (isHead) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = Colors.snakeHead;
      ctx.fillStyle = Colors.snakeHead;
    } else {
      const fade = 1 - (i / game.snake.length) * 0.6;
      ctx.shadowBlur = 8;
      ctx.shadowColor = Colors.snakeBody;
      ctx.fillStyle = `rgba(0, ${Math.floor(180 * fade + 40)}, ${Math.floor(100 * fade)}, ${fade})`;
    }
    ctx.fillRect(px + pad, py + pad, size, size);

    if (isHead) {
      ctx.strokeStyle = Colors.snakeBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + pad, py + pad, size, size);

      ctx.fillStyle = Colors.bg;
      const eyeSize = 3;
      const offset = 4;
      const d = game.dir;
      let ex1, ey1, ex2, ey2;

      if (d === DIR.RIGHT) { ex1 = px + CELL - offset; ey1 = py + offset; ex2 = px + CELL - offset; ey2 = py + CELL - offset - eyeSize; }
      else if (d === DIR.LEFT) { ex1 = px + offset - eyeSize; ey1 = py + offset; ex2 = px + offset - eyeSize; ey2 = py + CELL - offset - eyeSize; }
      else if (d === DIR.UP) { ex1 = px + offset; ey1 = py + offset - eyeSize; ex2 = px + CELL - offset - eyeSize; ey2 = py + offset - eyeSize; }
      else { ex1 = px + offset; ey1 = py + CELL - offset; ex2 = px + CELL - offset - eyeSize; ey2 = py + CELL - offset; }

      ctx.shadowBlur = 0;
      ctx.fillRect(ex1, ey1, eyeSize, eyeSize);
      ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
    }
    ctx.restore();
  });
}

let foodPulse = 0;

function drawFood() {
  foodPulse += 0.08;
  const pulse = 0.7 + Math.sin(foodPulse) * 0.3;
  const fp = game.food;
  const cx = fp.x * CELL + CELL / 2;
  const cy = fp.y * CELL + CELL / 2;
  const r = (CELL / 2 - 3) * pulse;

  ctx.save();
  ctx.shadowBlur = 20 * pulse;
  ctx.shadowColor = Colors.food;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = Colors.food;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  ctx.restore();
}

let specialPulse = 0;

function drawSpecial() {
  if (!game.special) return;
  specialPulse += 0.12;
  const pulse = 0.75 + Math.sin(specialPulse) * 0.25;
  const sp = game.special;
  const px = sp.x * CELL;
  const py = sp.y * CELL;
  const pad = 3;
  const size = (CELL - pad * 2) * pulse;
  const offset = (CELL - size) / 2;

  const urgency = game.specialTimer < 25 ? Math.sin(Date.now() / 100) * 0.5 + 0.5 : 1;

  ctx.save();
  ctx.globalAlpha = urgency;
  ctx.shadowBlur = 20 * pulse;
  ctx.shadowColor = Colors.special;
  ctx.fillStyle = Colors.special;

  ctx.save();
  ctx.translate(px + CELL / 2, py + CELL / 2);
  ctx.rotate(specialPulse * 0.5);
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();

  ctx.restore();
}

function drawFlash() {
  if (game.flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = game.flashAlpha;
  ctx.fillStyle = '#00ff9f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  game.flashAlpha -= 0.03;
  if (game.flashAlpha < 0) game.flashAlpha = 0;
}

function render() {
  ctx.fillStyle = Colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawFood();
  drawSpecial();
  drawSnake();
  drawParticles();
  drawFlash();
  updateParticles();

  game.animFrame = requestAnimationFrame(render);
}

document.addEventListener('keydown', function(e) {
  const dir = KEY_MAP[e.key];

  if (dir && game.state === 'running') {
    if (dir !== OPPOSITES[game.currentDirName]) {
      game.nextDir = DIR[dir];
      game.currentDirName = dir;
      audio.turn();
    }
    e.preventDefault();
    return;
  }

  if (e.key === 'p' || e.key === 'P') {
    pause();
    return;
  }

  if (e.key === 'Escape') {
    if (game.state === 'running' || game.state === 'paused') {
      game.state = 'idle';
      clearInterval(game.loopTimer);
      startGame();
    }
  }

  if ((e.key === ' ' || e.key === 'Enter') && game.state === 'idle') {
    startGame();
  }
});

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-restart-pause').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', resume);

setDisplay('best-display', formatScore(game.best));
showScreen('start');
render();
