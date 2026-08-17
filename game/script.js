(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 28;

  const boardCanvas = document.getElementById('board');
  const ctx = boardCanvas.getContext('2d');
  boardCanvas.width = COLS * CELL;
  boardCanvas.height = ROWS * CELL;

  const nextCanvas = document.getElementById('next-canvas');
  const nctx = nextCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const overlayMsg = document.getElementById('overlay-msg');
  const overlayHint = document.getElementById('overlay-hint');
  const restartBtn = document.getElementById('restart-btn');
  const highScoreEl = document.getElementById('highscore');
  const overlayHighScoreEl = document.getElementById('overlay-highscore-value');

  const HIGH_SCORE_KEY = 'blockfall_highscore';
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;

  function updateHighScoreDisplay() {
    highScoreEl.textContent = highScore;
    overlayHighScoreEl.textContent = highScore;
  }

  function getVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const COLORS = {
    I: getVar('--c-I'), O: getVar('--c-O'), T: getVar('--c-T'),
    S: getVar('--c-S'), Z: getVar('--c-Z'), J: getVar('--c-J'), L: getVar('--c-L')
  };

  // Each shape defined on a 4x4 grid, one rotation state; others derived by rotating matrix.
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };

  const TYPES = Object.keys(SHAPES);

  function rotateMatrix(m) {
    const n = m.length;
    const res = [];
    for (let x = 0; x < n; x++) {
      res.push([]);
      for (let y = n - 1; y >= 0; y--) {
        res[x].push(m[y][x]);
      }
    }
    return res;
  }

  function newBag() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  let bag = newBag();
  function nextType() {
    if (bag.length === 0) bag = newBag();
    return bag.pop();
  }

  function createPiece(type) {
    return {
      type,
      matrix: SHAPES[type].map(row => [...row]),
      x: Math.floor((COLS - SHAPES[type].length) / 2),
      y: -2
    };
  }

  let grid, current, next, score, level, lines, dropInterval, dropTimer, lastTime;
  let gameOver, paused, running, started = false;
  let clearingRows = [];
  let clearAnimTimer = 0;

  function init() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = newBag();
    current = createPiece(nextType());
    next = createPiece(nextType());
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 800;
    dropTimer = 0;
    lastTime = 0;
    gameOver = false;
    paused = false;
    running = true;
    started = true;
    clearingRows = [];
    updateStats();
    overlay.classList.remove('show');
  }

  function updateStats() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      updateHighScoreDisplay();
    }
  }

  function collides(matrix, offX, offY) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const gx = offX + x;
        const gy = offY + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function merge() {
    const { matrix, x, y, type } = current;
    for (let ry = 0; ry < matrix.length; ry++) {
      for (let rx = 0; rx < matrix[ry].length; rx++) {
        if (matrix[ry][rx]) {
          const gy = y + ry;
          const gx = x + rx;
          if (gy >= 0) grid[gy][gx] = type;
        }
      }
    }
  }

  function findFullRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      if (grid[y].every(cell => cell !== null)) rows.push(y);
    }
    return rows;
  }

  function removeRows(rows) {
    rows.sort((a, b) => a - b);
    for (const r of rows) {
      grid.splice(r, 1);
      grid.unshift(Array(COLS).fill(null));
    }
    const count = rows.length;
    const points = [0, 100, 300, 500, 800][count] * level;
    score += points;
    lines += count;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = Math.max(100, 800 * Math.pow(0.9, level - 1));
    }
    updateStats();
  }

  function spawnNext() {
    current = next;
    current.x = Math.floor((COLS - current.matrix.length) / 2);
    current.y = -2;
    next = createPiece(nextType());
    if (collides(current.matrix, current.x, 0)) {
      triggerGameOver();
    }
  }

  function lockPiece() {
    merge();
    const full = findFullRows();
    if (full.length > 0) {
      clearingRows = full;
      clearAnimTimer = 220;
    } else {
      spawnNext();
    }
  }

  function triggerGameOver() {
    gameOver = true;
    running = false;
    overlayMsg.textContent = 'GAME OVER';
    overlayMsg.className = 'msg gameover';
    overlayHint.textContent = 'Rキーまたはボタンでリスタート';
    restartBtn.textContent = 'RESTART';
    overlay.classList.add('show');
  }

  function hardDrop() {
    if (!running || paused) return;
    let dist = 0;
    while (!collides(current.matrix, current.x, current.y + 1)) {
      current.y++;
      dist++;
    }
    score += dist * 2;
    updateStats();
    lockPiece();
    dropTimer = 0;
  }

  function softDrop() {
    if (!running || paused) return;
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
    dropTimer = 0;
  }

  function move(dx) {
    if (!running || paused) return;
    if (!collides(current.matrix, current.x + dx, current.y)) {
      current.x += dx;
    }
  }

  function rotate() {
    if (!running || paused) return;
    const rotated = rotateMatrix(current.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(rotated, current.x + k, current.y)) {
        current.matrix = rotated;
        current.x += k;
        return;
      }
    }
  }

  function togglePause() {
    if (!started || gameOver) return;
    paused = !paused;
    if (paused) {
      overlayMsg.textContent = 'PAUSED';
      overlayMsg.className = 'msg paused';
      overlayHint.textContent = 'Pキーで再開';
      restartBtn.textContent = 'RESTART';
      overlay.classList.add('show');
    } else {
      overlay.classList.remove('show');
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collides(current.matrix, current.x, gy + 1)) gy++;
    return gy;
  }

  function drawCell(c, x, y, color, alpha = 1) {
    const px = x * CELL;
    const py = y * CELL;
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    c.globalAlpha = alpha * 0.35;
    c.fillStyle = '#ffffff';
    c.fillRect(px + 1, py + 1, CELL - 2, 4);
    c.globalAlpha = 1;
  }

  function render() {
    ctx.fillStyle = getVar('--board-bg');
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    ctx.strokeStyle = getVar('--grid-line');
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(COLS * CELL, y * CELL + 0.5);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (cell) {
          const flashing = clearingRows.includes(y);
          drawCell(ctx, x, y, COLORS[cell], flashing ? (Math.sin(clearAnimTimer * 0.05) > 0 ? 1 : 0.25) : 1);
        }
      }
    }

    if (running && !gameOver && clearingRows.length === 0) {
      const gy = ghostY();
      const { matrix, x } = current;
      for (let ry = 0; ry < matrix.length; ry++) {
        for (let rx = 0; rx < matrix[ry].length; rx++) {
          if (matrix[ry][rx]) {
            const py = gy + ry;
            if (py >= 0) drawCell(ctx, x + rx, py, COLORS[current.type], 0.15);
          }
        }
      }

      const { matrix: cm, x: cx, y: cy } = current;
      for (let ry = 0; ry < cm.length; ry++) {
        for (let rx = 0; rx < cm[ry].length; rx++) {
          if (cm[ry][rx]) {
            const py = cy + ry;
            if (py >= 0) drawCell(ctx, cx + rx, py, COLORS[current.type]);
          }
        }
      }
    }

    nctx.fillStyle = getVar('--board-bg');
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (next) {
      const m = next.matrix;
      const size = m.length;
      const cell = 20;
      const offX = (nextCanvas.width - size * cell) / 2;
      const offY = (nextCanvas.height - size * cell) / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (m[y][x]) {
            nctx.fillStyle = COLORS[next.type];
            nctx.fillRect(offX + x * cell + 1, offY + y * cell + 1, cell - 2, cell - 2);
          }
        }
      }
    }
  }

  function loop(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (running && !paused && !gameOver) {
      if (clearingRows.length > 0) {
        clearAnimTimer -= delta;
        if (clearAnimTimer <= 0) {
          removeRows(clearingRows);
          clearingRows = [];
          spawnNext();
        }
      } else {
        dropTimer += delta;
        if (dropTimer >= dropInterval) {
          dropTimer = 0;
          if (!collides(current.matrix, current.x, current.y + 1)) {
            current.y++;
          } else {
            lockPiece();
          }
        }
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowLeft': e.preventDefault(); move(-1); break;
      case 'ArrowRight': e.preventDefault(); move(1); break;
      case 'ArrowDown': e.preventDefault(); softDrop(); break;
      case 'ArrowUp': e.preventDefault(); hardDrop(); break;
      case 'Space': e.preventDefault(); rotate(); break;
      case 'KeyP': e.preventDefault(); togglePause(); break;
      case 'KeyR': e.preventDefault(); init(); break;
    }
  });

  restartBtn.addEventListener('click', init);

  // Touch controls: swipe left/right to move, swipe down to hard drop, tap to rotate.
  const TAP_MAX_MOVE = 12;
  const TAP_MAX_TIME = 250;

  let ptrActive = false;
  let ptrId = null;
  let startX = 0, startY = 0, startTime = 0;
  let lastX = 0;
  let acted = false;
  let stepX = 24, stepY = 24;

  function onPointerDown(e) {
    if (ptrActive) return;
    ptrActive = true;
    acted = false;
    ptrId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    const rect = boardCanvas.getBoundingClientRect();
    stepX = rect.width / COLS;
    stepY = rect.height / ROWS;
    boardCanvas.setPointerCapture(ptrId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!ptrActive || e.pointerId !== ptrId || acted) return;
    const dxTotal = e.clientX - startX;
    const dyTotal = e.clientY - startY;
    const dxStep = e.clientX - lastX;

    if (Math.abs(dxTotal) > Math.abs(dyTotal) && Math.abs(dxStep) >= stepX) {
      move(dxStep > 0 ? 1 : -1);
      lastX = e.clientX;
      return;
    }

    if (dyTotal > stepY * 1.4 && Math.abs(dxTotal) < stepX) {
      hardDrop();
      acted = true;
      ptrActive = false;
    }
  }

  function onPointerUp(e) {
    if (!ptrActive || e.pointerId !== ptrId) return;
    ptrActive = false;
    if (!acted) {
      const dt = Date.now() - startTime;
      const dxTotal = e.clientX - startX;
      const dyTotal = e.clientY - startY;
      if (Math.abs(dxTotal) < TAP_MAX_MOVE && Math.abs(dyTotal) < TAP_MAX_MOVE && dt < TAP_MAX_TIME) {
        rotate();
      }
    }
  }

  boardCanvas.addEventListener('pointerdown', onPointerDown);
  boardCanvas.addEventListener('pointermove', onPointerMove);
  boardCanvas.addEventListener('pointerup', onPointerUp);
  boardCanvas.addEventListener('pointercancel', () => { ptrActive = false; });

  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  current = createPiece(nextType());
  next = createPiece(nextType());
  updateHighScoreDisplay();
  requestAnimationFrame(loop);
})();
