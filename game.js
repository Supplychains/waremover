// ====== Конфигурация ======
const ROWS = 3;
const COLS = 3;
const TOTAL_SHELVES = ROWS * COLS;
const TOTAL_ITEMS = 12;
const ORDER_SIZE = 9;

// ====== Игровые данные ======
let shelves = [];
let order = {};
let orderListDiv = null;
let shelfModal = null;
let shelfItemsDiv = null;

let player = {x:0, y:0, size:40, speed:40};
let currentShelfIndex = null;
let score = 0;
let time = 0;
let timerInterval = null;

// ====== Запуск ======
window.addEventListener("DOMContentLoaded", () => {
  orderListDiv = document.getElementById("orderList");
  shelfModal = document.getElementById("shelfModal");
  shelfItemsDiv = document.getElementById("shelfItems");

  generateShelves();
  generateOrder();
  renderOrder();
  updateOrderTotals();

  document.addEventListener("keydown", handleKey);
  const closeBtn = document.getElementById("closeShelfBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeShelf);

  setInterval(draw, 100);
  timerInterval = setInterval(() => {
    time++;
    const t = document.getElementById("time");
    if (t) t.textContent = formatTime(time);
    score--; // штраф за время
    const s = document.getElementById("score");
    if (s) s.textContent = score;
  }, 1000);
});

// ====== Генерация ======
function generateShelves() {
  shelves = [];
  for (let i=0; i<TOTAL_SHELVES; i++) {
    let items = {};
    let available = shuffle([...Array(TOTAL_ITEMS).keys()]);
    let count = rand(8,10);
    for (let j=0;j<count;j++){
      let item = available[j];
      items[item] = rand(1,5);
    }
    shelves.push(items);
  }
}

function generateOrder() {
  order = {};
  let chosen = shuffle([...Array(TOTAL_ITEMS).keys()]).slice(0, ORDER_SIZE);
  for (let item of chosen){
    order[item] = {required: rand(10,14), collected:0};
  }
}

// ====== Агрегаты по заказу ======
function computeTotals(){
  let requiredTotal = 0, collectedTotal = 0;
  for (const id in order){
    requiredTotal += order[id].required;
    collectedTotal += order[id].collected;
  }
  return {
    requiredTotal,
    collectedTotal,
    remaining: Math.max(0, requiredTotal - collectedTotal)
  };
}

function updateOrderTotals(){
  const {requiredTotal, collectedTotal, remaining} = computeTotals();
  const rt = document.getElementById("requiredTotal");
  const ct = document.getElementById("collectedTotal");
  const rem = document.getElementById("remainingTotal");
  if (rt) rt.textContent = requiredTotal;
  if (ct) ct.textContent = collectedTotal;
  if (rem) rem.textContent = remaining;
}

// ====== Рендер заказа ======
function renderOrder() {
  if (!orderListDiv) return;
  orderListDiv.innerHTML = "";
  for (let id in order) {
    let o = order[id];
    let div = document.createElement("div");
    div.className = "order-item";
    if (o.collected >= o.required) div.classList.add("completed");
    div.innerHTML = `Товар ${parseInt(id)+1} — ${o.collected}/${o.required}`;
    orderListDiv.appendChild(div);
  }
  const s = document.getElementById("score");
  if (s) s.textContent = score;
  updateOrderTotals();
}

// ====== Работа с полкой ======
function openShelf(index) {
  currentShelfIndex = index;
  if (!shelfModal || !shelfItemsDiv) return;

  shelfItemsDiv.innerHTML = "";
  let shelf = shelves[index];
  for (let i=0;i<TOTAL_ITEMS;i++){
    let cell = document.createElement("div");
    if (shelf[i]){
      cell.className = "shelf-item";
      cell.textContent = `Т${i+1} (${shelf[i]})`;
      cell.onclick = () => pickItem(i);
    } else {
      cell.className = "shelf-item empty";
      cell.textContent = `—`;
    }
    shelfItemsDiv.appendChild(cell);
  }
  shelfModal.classList.remove("hidden");
}

function closeShelf() {
  if (!shelfModal) return;
  shelfModal.classList.add("hidden");
  currentShelfIndex = null;
}

function pickItem(itemId){
  let shelf = shelves[currentShelfIndex];
  if (!shelf[itemId] || shelf[itemId]<=0) return;

  if (order[itemId]){
    let o = order[itemId];
    if (o.collected < o.required){
      o.collected++;
      shelf[itemId]--;
      score += 10;
      renderOrder();
      if (o.collected >= o.required) checkOrderComplete();
      return;
    } else {
      return; // лишнее игнорируем
    }
  } else {
    score -= 10; // штраф
    const s = document.getElementById("score");
    if (s) s.textContent = score;
  }
}

// ====== Проверка завершения ======
function checkOrderComplete() {
  const done = Object.values(order).every(o => o.collected>=o.required);
  if (done){
    clearInterval(timerInterval);
    alert("Заказ собран! Ваш счёт: " + score);
  }
}

// ====== Управление игроком ======
function handleKey(e){
  if (shelfModal && !shelfModal.classList.contains("hidden")){
    if (e.code==="Space"||e.code==="KeyE"){ closeShelf(); }
    return;
  }
  if (e.code==="ArrowUp"||e.code==="KeyW"){ if (player.y>0) player.y--; }
  if (e.code==="ArrowDown"||e.code==="KeyS"){ if (player.y<ROWS-1) player.y++; }
  if (e.code==="ArrowLeft"||e.code==="KeyA"){ if (player.x>0) player.x--; }
  if (e.code==="ArrowRight"||e.code==="KeyD"){ if (player.x<COLS-1) player.x++; }
  if (e.code==="Space"||e.code==="KeyE"){
    let index = player.y*COLS+player.x;
    openShelf(index);
  }
}

// ====== Отрисовка ======
function draw(){
  let canvas = document.getElementById("gameCanvas");
  if (!canvas) return;
  let ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  let w = canvas.width/COLS;
  let h = canvas.height/ROWS;

  // полки
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (player.x===c && player.y===r){
        ctx.fillStyle = "#1abc9c";
      } else {
        ctx.fillStyle = "#2c3e50";
      }
      ctx.fillRect(c*w+5, r*h+5, w-10,h-10);
    }
  }

  // игрок
  ctx.fillStyle = "yellow";
  ctx.fillRect(
    player.x*w + w/2 - player.size/2,
    player.y*h + h/2 - player.size/2,
    player.size, player.size
  );
}

// ====== Утилиты ======
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function shuffle(arr){ return arr.sort(()=>Math.random()-0.5); }
function formatTime(t){
  let m=Math.floor(t/60).toString().padStart(2,"0");
  let s=(t%60).toString().padStart(2,"0");
  return m+":"+s;
}
