// ==================== Констаны ====================
const TOTAL_PRODUCTS = 12;
const ORDER_SIZE = 9;
const ORDER_QTY_MIN = 7;
const ORDER_QTY_MAX = 12;
const STOCK_MULTIPLIER = 2;

const SCORE_CORRECT = 10;
const SCORE_WRONG = -10;

// ==================== Переменные ====================
let currentOrder = [];
let warehouseStock = {};
let score = 0;
let timeLeft = 0;
let timerInterval = null;
let gameLoopId = null;
let gameStarted = false;
let currentMethod = "—";

// canvas
let canvas, ctx;

// Игрок
let player = { x: 50, y: 50, w: 20, h: 20, speed: 4 };

// Полки
const shelves = [];

// Звуки
const soundCorrect = new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg");
const soundWrong = new Audio("https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg");

// ==================== Утилиты ====================
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ==================== Заказы и склад ====================
function generateOrder() {
  currentOrder = [];
  const used = new Set();
  while (currentOrder.length < ORDER_SIZE) {
    const pid = rnd(1, TOTAL_PRODUCTS);
    if (!used.has(pid)) {
      used.add(pid);
      currentOrder.push({ id: pid, required: rnd(ORDER_QTY_MIN, ORDER_QTY_MAX), collected: 0 });
    }
  }
  renderOrderPanel();
}

function generateStock() {
  warehouseStock = {};
  currentOrder.forEach(item => {
    warehouseStock[item.id] = item.required * STOCK_MULTIPLIER;
  });
  for (let pid = 1; pid <= TOTAL_PRODUCTS; pid++) {
    if (!warehouseStock[pid]) warehouseStock[pid] = rnd(5, 15);
  }
}

// ==================== HUD ====================
function updateHUD() {
  document.getElementById("score").textContent = score;
  document.getElementById("time").textContent = formatTime(timeLeft);
  document.getElementById("currentItem").textContent = currentOrder.filter(i => i.collected >= i.required).length;
  document.getElementById("totalItems").textContent = ORDER_SIZE;
  document.getElementById("currentMethod").textContent = currentMethod;
}

function renderOrderPanel() {
  const orderList = document.getElementById("orderList");
  orderList.innerHTML = "";
  currentOrder.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-item";
    if (item.collected >= item.required) div.classList.add("completed");
    div.textContent = `Товар ${item.id} — ${item.collected}/${item.required}`;
    orderList.appendChild(div);
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// ==================== Игровая логика ====================
function interact() {
  for (const s of shelves) {
    if (isNear(player, s)) {
      pickItem(s.id, s);
      break;
    }
  }
}

function pickItem(productId, shelf) {
  const orderItem = currentOrder.find(i => i.id === productId);
  if (!orderItem) {
    score += SCORE_WRONG;
    soundWrong.play();
    flashShelf(shelf, "red");
    updateHUD();
    return;
  }
  if (orderItem.collected >= orderItem.required) return;
  if (warehouseStock[productId] > 0) {
    warehouseStock[productId]--;
    orderItem.collected++;
    score += SCORE_CORRECT;
    soundCorrect.play();
    flashShelf(shelf, "green");
    renderOrderPanel();
    updateHUD();
    checkOrderComplete();
  }
}

function checkOrderComplete() {
  const allDone = currentOrder.every(i => i.collected >= i.required);
  if (allDone) endGame();
}

// ==================== Таймер ====================
function startTimer(seconds) {
  timeLeft = seconds;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    score -= 1;
    updateHUD();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ==================== Рендеринг ====================
function initShelves() {
  shelves.length = 0;
  const cols = 4, rows = 3;
  const startX = 80, startY = 80, gapX = 160, gapY = 140, w = 120, h = 80;
  let pid = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      shelves.push({ id: pid, x: startX + c * gapX, y: startY + r * gapY, w, h, flash: null });
      pid++;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#203040";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#dbeafe";
  ctx.font = "16px system-ui";
  ctx.fillText("Управление: WASD/стрелки + E (взять)", 16, 24);

  shelves.forEach(s => {
    ctx.fillStyle = s.flash || "#374151";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(s.x, s.y, s.w, s.h);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "14px system-ui";
    ctx.fillText(`Товар ${s.id}`, s.x + 8, s.y + 24);
    ctx.fillText(`Ост: ${warehouseStock[s.id]}`, s.x + 8, s.y + 46);

    if (currentMethod === "Pick-by-Light") {
      const inOrder = currentOrder.find(i => i.id === s.id && i.collected < i.required);
      if (inOrder) {
        ctx.strokeStyle = Math.random() > 0.5 ? "#f59e0b" : "#0000";
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
      }
    }
    if (currentMethod === "Pick-by-Vision") {
      const inOrder = currentOrder.find(i => i.id === s.id && i.collected < i.required);
      if (inOrder) {
        ctx.fillStyle = "lime";
        ctx.beginPath();
        ctx.moveTo(s.x + s.w / 2, s.y - 15);
        ctx.lineTo(s.x + s.w / 2 - 10, s.y - 5);
        ctx.lineTo(s.x + s.w / 2 + 10, s.y - 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  });

  ctx.fillStyle = "blue";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  if (gameStarted) gameLoopId = requestAnimationFrame(draw);
}

// ==================== Анимация ====================
function flashShelf(shelf, color) {
  shelf.flash = color === "green" ? "#14532d" : "#7f1d1d";
  setTimeout(() => { shelf.flash = null; }, 300);
}

// ==================== Игрок ====================
const keys = {};
window.addEventListener("keydown", e => { keys[e.key] = true; if (e.key === " " || e.key === "E" || e.key === "e") interact(); });
window.addEventListener("keyup", e => { keys[e.key] = false; });

function updatePlayer() {
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) player.y -= player.speed;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) player.y += player.speed;
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) player.x += player.speed;
  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));
}

function isNear(p, s) {
  return (
    p.x + p.w > s.x - 10 &&
    p.x < s.x + s.w + 10 &&
    p.y + p.h > s.y - 10 &&
    p.y < s.y + s.h + 10
  );
}

// ==================== Голосовые подсказки ====================
let voiceInterval = null;
function startVoice() {
  stopVoice();
  let idx = 0;
  voiceInterval = setInterval(() => {
    if (idx >= currentOrder.length) idx = 0;
    const item = currentOrder[idx];
    if (item.collected < item.required) {
      const utter = new SpeechSynthesisUtterance(`Возьмите товар ${item.id}`);
      speechSynthesis.speak(utter);
    }
    idx++;
  }, 3000);
}
function stopVoice() {
  clearInterval(voiceInterval);
  voiceInterval = null;
  speechSynthesis.cancel();
}

// ==================== Старт/стоп игры ====================
function startGame(seconds = 90) {
  score = 0;
  player.x = 50; player.y = 50;
  generateOrder();
  generateStock();
  updateHUD();
  initShelves();
  showScreen("gameScreen");
  gameStarted = true;
  cancelAnimationFrame(gameLoopId);
  draw();

  if (currentMethod === "Pick-by-Voice") startVoice();
  else stopVoice();

  startTimer(seconds);
}

function endGame() {
  if (!gameStarted) return;
  gameStarted = false;
  stopTimer();
  stopVoice();
  cancelAnimationFrame(gameLoopId);
  const totalRequired = currentOrder.reduce((s, i) => s + i.required, 0);
  const totalCollected = currentOrder.reduce((s, i) => s + i.collected, 0);
  const acc = totalRequired > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0;
  document.getElementById("finalScore").querySelector("span").textContent = score;
  document.getElementById("finalTime").querySelector("span").textContent = formatTime(timeLeft);
  document.getElementById("accuracy").querySelector("span").textContent = `${acc}%`;
  document.getElementById("ordersCompleted").querySelector("span").textContent =
    currentOrder.every(i => i.collected >= i.required) ? 1 : 0;
  showScreen("resultsScreen");
}

// ==================== UI ====================
window.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");

  function loop() {
    if (gameStarted) updatePlayer();
    requestAnimationFrame(loop);
  }
  loop();

  document.getElementById("startGameBtn").addEventListener("click", () => { showScreen("modeSelection"); });
  document.getElementById("quickOrderBtn").addEventListener("click", () => { window.__seconds = 120; showScreen("pickingMethodSelection"); });
  document.getElementById("marathonBtn").addEventListener("click", () => { window.__seconds = 90; showScreen("pickingMethodSelection"); });
  document.getElementById("backToMenuBtn").addEventListener("click", () => { showScreen("mainMenu"); });

  document.getElementById("pickByListBtn").addEventListener("click", () => { currentMethod = "Pick-by-List"; startGame(window.__seconds ?? 90); });
  document.getElementById("pickByVoiceBtn").addEventListener("click", () => { currentMethod = "Pick-by-Voice"; startGame(window.__seconds ?? 90); });
  document.getElementById("pickByLightBtn").addEventListener("click", () => { currentMethod = "Pick-by-Light"; startGame(window.__seconds ?? 90); });
  document.getElementById("pickByVisionBtn").addEventListener("click", () => { currentMethod = "Pick-by-Vision"; startGame(window.__seconds ?? 90); });
  document.getElementById("backToModeBtn").addEventListener("click", () => { showScreen("modeSelection"); });

  document.getElementById("pauseBtn").addEventListener("click", () => { endGame(); });
  document.getElementById("playAgainBtn").addEventListener("click", () => { showScreen("modeSelection"); });
  document.getElementById("backToMainBtn").addEventListener("click", () => { showScreen("mainMenu"); });

  showScreen("mainMenu");
  updateHUD();
});
