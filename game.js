// ==================== Параметры игры ====================
const TOTAL_PRODUCTS = 12;         // всего доступных товаров
const ORDER_SIZE = 9;              // всегда 9 товаров в заказе
const ORDER_QTY_MIN = 7;           // минимальное количество наименования в заказе
const ORDER_QTY_MAX = 12;          // максимальное количество наименования в заказе
const STOCK_MULTIPLIER = 2;        // запас товаров на складе (x2 от заказа)

// Очки
const SCORE_CORRECT = 10;          // правильный товар
const SCORE_WRONG = -10;           // неправильный товар

// ==================== Состояния игры ====================
let currentOrder = [];
let playerInventory = {};
let score = 0;
let timeLeft = 0;
let timerInterval = null;

// ==================== Генерация заказа ====================
function generateOrder() {
  currentOrder = [];
  let used = new Set();

  while (currentOrder.length < ORDER_SIZE) {
    let productId = Math.floor(Math.random() * TOTAL_PRODUCTS) + 1;
    if (!used.has(productId)) {
      used.add(productId);
      let qty = Math.floor(Math.random() * (ORDER_QTY_MAX - ORDER_QTY_MIN + 1)) + ORDER_QTY_MIN;
      currentOrder.push({ id: productId, required: qty, collected: 0 });
    }
  }

  renderOrderPanel();
}

// ==================== Отрисовка панели заказа ====================
function renderOrderPanel() {
  const orderList = document.getElementById("orderList");
  orderList.innerHTML = "";

  currentOrder.forEach((item, idx) => {
    let div = document.createElement("div");
    div.className = "order-item";
    if (item.collected >= item.required) div.classList.add("completed");
    div.innerHTML = `Товар ${item.id} — ${item.collected}/${item.required}`;
    orderList.appendChild(div);
  });

  document.getElementById("currentItem").textContent = currentOrder.filter(i => i.collected >= i.required).length;
  document.getElementById("totalItems").textContent = ORDER_SIZE;
}

// ==================== Склад и товары ====================
let warehouseStock = {};

function generateStock() {
  warehouseStock = {};
  currentOrder.forEach(item => {
    warehouseStock[item.id] = item.required * STOCK_MULTIPLIER;
  });
}

// ==================== Взаимодействие с товарами ====================
function pickItem(productId) {
  let item = currentOrder.find(i => i.id === productId);
  if (!item) {
    // игрок взял товар, которого нет в заказе
    score += SCORE_WRONG;
    updateHUD();
    return;
  }

  if (item.collected < item.required) {
    if (warehouseStock[productId] > 0) {
      warehouseStock[productId]--;
      item.collected++;
      score += SCORE_CORRECT;
      renderOrderPanel();
      updateHUD();
    }
  } else {
    // если игрок пытается взять лишний товар — игнорируем
  }
}

// ==================== Таймер ====================
function startTimer(seconds) {
  timeLeft = seconds;
  timerInterval = setInterval(() => {
    timeLeft--;
    score -= 1; // каждая секунда -1 балл
    updateHUD();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

// ==================== HUD ====================
function updateHUD() {
  document.getElementById("score").textContent = score;
  document.getElementById("time").textContent = timeLeft + "s";
}

// ==================== Завершение игры ====================
function endGame() {
  clearInterval(timerInterval);
  document.getElementById("finalScore").querySelector("span").textContent = score;
  document.getElementById("finalTime").querySelector("span").textContent = timeLeft + "s";
  document.getElementById("accuracy").querySelector("span").textContent = calcAccuracy() + "%";
  document.getElementById("ordersCompleted").querySelector("span").textContent = currentOrder.filter(i => i.collected >= i.required).length;
  showScreen("resultsScreen");
}

function calcAccuracy() {
  let totalRequired = currentOrder.reduce((sum, i) => sum + i.required, 0);
  let totalCollected = currentOrder.reduce((sum, i) => sum + i.collected, 0);
  return Math.round((totalCollected / totalRequired) * 100);
}

// ==================== Навигация экранов ====================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ==================== Инициализация ====================
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startGameBtn").addEventListener("click", () => {
    score = 0;
    generateOrder();
    generateStock();
    updateHUD();
    startTimer(90); // например, марафон
    showScreen("gameScreen");
  });

  document.getElementById("pauseBtn").addEventListener("click", () => {
    endGame();
  });
});
