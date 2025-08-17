// Основной класс игры WareMover
class WareMoverGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.gameState = 'menu'; // menu, modeSelection, methodSelection, playing, paused, results
    this.gameMode = null;    // quickOrder, marathon
    this.pickingMethod = null; // pickByList, pickByVoice, pickByLight, pickByVision

    // Игровые переменные
    this.score = 0;
    this.startTime = 0;
    this.gameTime = 0;
    this.currentOrder = null;
    this.ordersCompleted = 0;
    this.totalErrors = 0;

    // Игрок
    this.player = { x: 100, y: 100, width: 32, height: 32, speed: 3 };

    // Склад
    this.warehouse = {
      width: 800,
      height: 600,
      shelves: [],
      computer: { x: 50, y: 50, width: 60, height: 40 }
    };

    // Управление
    this.keys = {};
    this.mousePos = { x: 0, y: 0 };

    // Взаимодействие
    this.nearInteractable = null;
    this.inShelfView = false;
    this.currentShelf = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeWarehouse();
    this.showScreen('mainMenu');
  }

  setupEventListeners() {
    // Кнопки меню
    document.getElementById('startGameBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    document.getElementById('settingsBtn')?.addEventListener('click', () => {
      alert('Настройки будут добавлены в следующей версии');
    });

    document.getElementById('helpBtn')?.addEventListener('click', () => {
      this.showScreen('helpScreen');
    });

    // Выбор режима
    document.getElementById('quickOrderBtn')?.addEventListener('click', () => {
      this.gameMode = 'quickOrder';
      this.showScreen('pickingMethodSelection');
    });

    document.getElementById('marathonBtn')?.addEventListener('click', () => {
      this.gameMode = 'marathon';
      this.showScreen('pickingMethodSelection');
    });

    // Выбор метода комплектования
    document.getElementById('pickByListBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByList';
      this.startGame();
    });

    document.getElementById('pickByVoiceBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByVoice';
      this.startGame();
    });

    document.getElementById('pickByLightBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByLight';
      this.startGame();
    });

    document.getElementById('pickByVisionBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByVision';
      this.startGame();
    });

    // Назад
    document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    document.getElementById('backToModeBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    document.getElementById('backFromHelpBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    // Результаты
    document.getElementById('playAgainBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    document.getElementById('backToMainBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    // Кнопка "Выйти" (вместо паузы)
    document.getElementById('pauseBtn')?.addEventListener('click', () => {
      this.inShelfView = false;
      this.currentShelf = null;
      this.gameState = 'menu';
      this.showScreen('mainMenu');
    });

    // Клавиатура
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // E/F/Space — вход/выход из стеллажа (без автоповтора)
      if (!e.repeat && ['KeyE', 'KeyF', 'Space'].includes(e.code) && this.gameState === 'playing') {
        if (this.inShelfView) {
          this.exitShelfView();
        } else {
          this.handleInteraction();
        }
      }

      // Escape — пауза (оставил на случай будущего экрана паузы)
      if (e.code === 'Escape' && this.gameState === 'playing') {
        this.togglePause();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Мышь
    document.addEventListener('mousemove', (e) => {
      const rect = this.canvas?.getBoundingClientRect();
      if (rect) {
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
      }
    });

    document.addEventListener('click', (e) => {
      if (this.inShelfView && this.gameState === 'playing') this.handleShelfClick(e);
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.inShelfView && this.gameState === 'playing') {
        e.preventDefault();
        this.handleShelfRightClick(e);
      }
    });
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');

    if (screenId === 'gameScreen') {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  // -----------------------------
  // Склад и генерация товаров
  // -----------------------------
  initializeWarehouse() {
    this.warehouse.shelves = [
      // Левая сторона
      { x: 150, y: 100, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 200, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 300, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 400, width: 120, height: 60, items: this.generateShelfItems() },
      // Правая сторона
      { x: 500, y: 100, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 200, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 300, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 400, width: 120, height: 60, items: this.generateShelfItems() }
    ];
  }

  generateShelfItems() {
    /*
     * На полке 12 ячеек (4x3). Случайно заполняем 5–8 из них товарами.
     * Остальные ячейки остаются пустыми (null).
     * quantity каждого товара: 1–4.
     * Имена "Товар 1..12" общие для всех полок.
     */
    const totalPositions = 12;
    const items = new Array(totalPositions).fill(null);
    const itemTypes = ['box', 'bottle', 'folder', 'package', 'container'];

    const names = Array.from({ length: totalPositions }, (_, i) => `Товар ${i + 1}`);

    // Сколько ячеек заполняем
    const numItems = 5 + Math.floor(Math.random() * 4); // 5..8

    // Случайно выбираем имена (без повторов)
    const availableNames = names.slice();
    const selectedNames = [];
    for (let i = 0; i < numItems && availableNames.length > 0; i++) {
      const idx = Math.floor(Math.random() * availableNames.length);
      selectedNames.push(availableNames.splice(idx, 1)[0]);
    }

    // Случайно расставляем по позициям
    const positions = Array.from({ length: totalPositions }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Заполняем
    for (let i = 0; i < selectedNames.length; i++) {
      const pos = positions[i];
      items[pos] = {
        id: `item_${Math.random().toString(36).slice(2, 11)}`,
        type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
        name: selectedNames[i],
        quantity: 1 + Math.floor(Math.random() * 4) // 1..4
      };
    }

    return items;
  }

  // -----------------------------
  // Генерация заказа (по именам)
  // -----------------------------
  generateOrder() {
    const order = { id: `order_${Date.now()}`, items: [], totalItems: 0, completedItems: 0 };

    // Все валидные позиции со склада
    const allItems = [];
    (this.warehouse.shelves || []).forEach(shelf => {
      (shelf.items || []).forEach(item => {
        if (item && typeof item.name === 'string' && item.name && (item.quantity || 0) > 0) {
          allItems.push(item);
        }
      });
    });

    // Уникальные имена
    let uniqueNames = Array.from(new Set(allItems.map(i => i.name)));

    // Подстраховка — если пусто
    if (!Array.isArray(uniqueNames) || uniqueNames.length === 0) {
      uniqueNames = ['Товар 1'];
      allItems.push({ name: 'Товар 1', quantity: 1 });
    }

    // Минимум 5, максимум 9 строк заказа (но не больше доступных уникальных имён)
    const MIN_LINES = 5;
    const MAX_LINES = 9;

    // Перемешаем
    for (let i = uniqueNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueNames[i], uniqueNames[j]] = [uniqueNames[j], uniqueNames[i]];
    }

    const lines = Math.min(MAX_LINES, Math.max(Math.min(uniqueNames.length, MAX_LINES), Math.min(uniqueNames.length, MIN_LINES)));
    const selectedNames = uniqueNames.slice(0, lines);

    // Строки заказа: required 1..min(4, доступно)
    order.items = selectedNames.map(name => {
      const totalUnits = allItems
        .filter(it => it.name === name)
        .reduce((sum, it) => sum + (it.quantity || 0), 0);

      const available = Math.max(1, totalUnits);
      const required = Math.min(available, 1 + Math.floor(Math.random() * Math.min(available, 4)));

      order.totalItems += required;
      return { name, requiredQuantity: required, pickedQuantity: 0, completed: false };
    });

    return order;
  }

  // -----------------------------
  // Старт / цикл игры
  // -----------------------------
  startGame() {
    // сброс стейта
    this.score = 0;
    this.startTime = Date.now();
    this.gameTime = 0;
    this.ordersCompleted = 0;
    this.totalErrors = 0;
    this.inShelfView = false;
    this.currentShelf = null;

    // ВАЖНО: сначала склад, потом заказ
    this.initializeWarehouse();
    this.currentOrder = this.generateOrder();

    // Позиция игрока
    this.player.x = 100;
    this.player.y = 100;

    this.updateHUD();
    this.updateOrderPanel();
    this.showScreen('gameScreen');
  }

  gameLoop() {
    if (this.gameState !== 'playing') return;
    this.update();
    this.render();
    requestAnimationFrame(() => this.gameLoop());
  }

  update() {
    this.updateGameTime();
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();

    if (this.gameMode === 'marathon' && this.gameTime >= 90000) {
      this.endGame();
    } else if (this.gameMode === 'quickOrder' && this.isOrderCompleted()) {
      this.endGame();
    }
  }

  updateGameTime() {
    if (this.gameState === 'playing') this.gameTime = Date.now() - this.startTime;
  }

  updatePlayer() {
    if (this.inShelfView) return;

    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= this.player.speed;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += this.player.speed;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= this.player.speed;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += this.player.speed;

    const newX = this.player.x + dx;
    const newY = this.player.y + dy;

    if (newX >= 0 && newX + this.player.width <= this.warehouse.width) this.player.x = newX;
    if (newY >= 0 && newY + this.player.height <= this.warehouse.height) this.player.y = newY;
  }

  // -----------------------------
  // Взаимодействие
  // -----------------------------
  checkInteractions() {
    this.nearInteractable = null;

    if (this.isNear(this.player, this.warehouse.computer)) this.nearInteractable = 'computer';

    this.warehouse.shelves.forEach((shelf, index) => {
      if (this.isNear(this.player, shelf)) this.nearInteractable = { type: 'shelf', index };
    });

    const panel = document.getElementById('interactionPanel');
    if (panel) {
      if (this.nearInteractable) {
        panel.classList.remove('hidden');
        this.updateInteractionPanel();
      } else {
        panel.classList.add('hidden');
      }
    }
  }

  isNear(a, b, distance = 50) {
    const c1x = a.x + a.width / 2, c1y = a.y + a.height / 2;
    const c2x = b.x + b.width / 2, c2y = b.y + b.height / 2;
    const dist = Math.hypot(c2x - c1x, c2y - c1y);
    return dist < distance;
  }

  updateInteractionPanel() {
    const content = document.getElementById('interactionContent');
    if (!content) return;

    if (this.nearInteractable === 'computer') {
      content.innerHTML = '<p>Нажмите E, чтобы получить заказ</p>';
    } else if (this.nearInteractable && this.nearInteractable.type === 'shelf') {
      content.innerHTML = '<p>Нажмите E, чтобы просмотреть стеллаж</p>';
    }
  }

  handleInteraction() {
    if (this.nearInteractable === 'computer') {
      this.showOrderInfo();
    } else if (this.nearInteractable && this.nearInteractable.type === 'shelf') {
      this.enterShelfView(this.nearInteractable.index);
    }
  }

  showOrderInfo() {
    this.updateOrderPanel();
    if (this.pickingMethod === 'pickByVoice') this.speakOrderInfo();
  }

  speakOrderInfo() {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance();
      u.text = `Новый заказ. Необходимо собрать ${this.currentOrder.items.length} позиций.`;
      u.lang = 'ru-RU';
      speechSynthesis.speak(u);
    }
  }

  enterShelfView(shelfIndex) {
    this.inShelfView = true;
    this.currentShelf = shelfIndex;
    this.renderShelfView();
  }

  exitShelfView() {
    this.inShelfView = false;
    this.currentShelf = null;
  }

  handleShelfClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const shelf = this.warehouse.shelves[this.currentShelf];
    const itemIndex = this.getClickedItemIndex(x, y);

    if (itemIndex !== -1) {
      const item = (shelf.items || [])[itemIndex];
      if (item) this.pickItem(item);
    }
  }

  handleShelfRightClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const shelf = this.warehouse.shelves[this.currentShelf];
    const itemIndex = this.getClickedItemIndex(x, y);

    if (itemIndex !== -1) {
      const item = (shelf.items || [])[itemIndex];
      if (item) this.returnItem(item);
    }
  }

  getClickedItemIndex(x, y) {
    const startX = 100, startY = 100, itemWidth = 150, itemHeight = 100;
    const col = Math.floor((x - startX) / itemWidth);
    const row = Math.floor((y - startY) / itemHeight);
    if (col >= 0 && col < 4 && row >= 0 && row < 3) return row * 4 + col;
    return -1;
  }

  // -----------------------------
  // Логика взятия/возврата
  // -----------------------------
  pickItem(item) {
    const orderItem = this.currentOrder.items.find(oi => oi.name === item.name);

    // нет запаса на полке
    if (!item || (item.quantity || 0) <= 0) {
      this.totalErrors++;
      this.score -= 5;
      this.updateOrderPanel(); this.updateHUD(); return;
    }

    if (orderItem && !orderItem.completed) {
      if (orderItem.pickedQuantity < orderItem.requiredQuantity) {
        item.quantity -= 1;
        orderItem.pickedQuantity += 1;
        this.score += 10;

        if (orderItem.pickedQuantity >= orderItem.requiredQuantity) {
          orderItem.completed = true;
          this.score += 50; // бонус за завершение позиции
        }
      } else {
        // взяли лишнее
        this.totalErrors++;
        this.score -= 5;
      }
    } else {
      // не тот товар
      this.totalErrors++;
      this.score -= 10;
    }

    this.updateOrderPanel();
    this.updateHUD();
    this.render();

    if (this.currentOrder.items.every(p => p.pickedQuantity >= p.requiredQuantity)) {
      this.finishOrder();
    }
  }

  returnItem(item) {
    const orderItem = this.currentOrder.items.find(oi => oi.name === item.name);
    if (orderItem && orderItem.pickedQuantity > 0) {
      orderItem.pickedQuantity -= 1;
      orderItem.completed = orderItem.pickedQuantity >= orderItem.requiredQuantity;
      this.score -= 5;
      item.quantity += 1;
    }
    this.updateOrderPanel();
    this.updateHUD();
    this.render();
  }

  isOrderCompleted() {
    return this.currentOrder.items.every(i => i.completed);
  }

  // -----------------------------
  // HUD и панель заказа
  // -----------------------------
  updateHUD() {
    const byId = (id) => document.getElementById(id);
    const cI = this.currentOrder?.items?.filter(i => i.completed).length || 0;
    byId('score') && (byId('score').textContent = this.score);
    byId('time') && (byId('time').textContent = this.formatTime(this.gameTime));
    byId('currentItem') && (byId('currentItem').textContent = cI);
    byId('totalItems') && (byId('totalItems').textContent = this.currentOrder?.items?.length || 0);

    const methodNames = {
      pickByList: 'Pick-by-List',
      pickByVoice: 'Pick-by-Voice',
      pickByLight: 'Pick-by-Light',
      pickByVision: 'Pick-by-Vision'
    };
    byId('currentMethod') && (byId('currentMethod').textContent = methodNames[this.pickingMethod] || '');
  }

  updateOrderPanel() {
    const orderList = document.getElementById('orderList');
    if (!orderList) return;
    orderList.innerHTML = '';

    (this.currentOrder.items || []).forEach(item => {
      const div = document.createElement('div');
      div.className = 'order-item';
      if (item.completed) div.classList.add('completed');
      else if (item.pickedQuantity > 0) div.classList.add('current');

      div.innerHTML = `
        <span>${item.name}</span>
        <span>${item.pickedQuantity}/${item.requiredQuantity}</span>
      `;
      orderList.appendChild(div);
    });

    // Показать все строки без прокрутки
    const rowHeight = 36;
    orderList.style.maxHeight = `${(this.currentOrder.items.length * rowHeight) + 20}px`;
    orderList.style.overflowY = 'hidden';
  }

  formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
  }

  togglePause() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
    } else if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  endGame() {
    this.gameState = 'results';
    if (this.gameMode === 'marathon') {
      if (this.isOrderCompleted()) this.ordersCompleted++;
    } else {
      this.ordersCompleted = 1;
    }
    this.showResults();
  }

  showResults() {
    const byId = (id) => document.getElementById(id);
    byId('finalScore')?.querySelector('span') && (byId('finalScore').querySelector('span').textContent = this.score);
    byId('finalTime')?.querySelector('span') && (byId('finalTime').querySelector('span').textContent = this.formatTime(this.gameTime));
    const accuracy = this.totalErrors === 0 ? 100 : Math.max(0, 100 - (this.totalErrors * 10));
    byId('accuracy')?.querySelector('span') && (byId('accuracy').querySelector('span').textContent = `${accuracy}%`);
    byId('ordersCompleted')?.querySelector('span') && (byId('ordersCompleted').querySelector('span').textContent = this.ordersCompleted);
    this.showScreen('resultsScreen');
  }

  // -----------------------------
  // Рендер
  // -----------------------------
  render() {
    if (!this.ctx) return;

    // Очистка
    this.ctx.fillStyle = '#34495e';
    this.ctx.fillRect(0, 0, this.warehouse.width, this.warehouse.height);

    if (this.inShelfView) this.renderShelfView();
    else this.renderWarehouse();
  }

  renderWarehouse() {
    // Стеллажи
    this.ctx.fillStyle = '#8b4513';
    this.warehouse.shelves.forEach(shelf => {
      this.ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);

      // Pick-by-Light — подсвечиваем только СТЕЛЛАЖ, если на нём есть нужные позиции
      if (this.pickingMethod === 'pickByLight') {
        const hasRequiredItem = (shelf.items || []).some(item =>
          item &&
          item.quantity > 0 &&
          this.currentOrder.items.some(oi =>
            oi.name === item.name &&
            oi.pickedQuantity < oi.requiredQuantity
          )
        );
        if (hasRequiredItem) {
          this.ctx.strokeStyle = '#f39c12';
          this.ctx.lineWidth = 3;
          this.ctx.strokeRect(shelf.x - 2, shelf.y - 2, shelf.width + 4, shelf.height + 4);
        }
      }
    });

    // Компьютер
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(
      this.warehouse.computer.x,
      this.warehouse.computer.y,
      this.warehouse.computer.width,
      this.warehouse.computer.height
    );

    // Игрок
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

    // Индикатор взаимодействия
    if (this.nearInteractable) {
      this.ctx.fillStyle = 'rgba(241, 196, 15, 0.8)';
      this.ctx.font = '16px Arial';
      this.ctx.fillText('E', this.player.x + this.player.width + 10, this.player.y + 20);
    }
  }

  renderShelfView() {
    // Фон
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.warehouse.width, this.warehouse.height);

    // Заголовок "Стеллаж X/8"
    this.ctx.fillStyle = 'white';
    this.ctx.font = '24px Arial';
    const totalShelves = this.warehouse.shelves.length;
    this.ctx.fillText(`Стеллаж ${this.currentShelf + 1}/${totalShelves}`, 20, 40);

    // Кнопка выхода-подсказка
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.fillRect(this.warehouse.width - 100, 20, 80, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Выход (E)', this.warehouse.width - 95, 40);

    // Сетка 4x3
    const shelf = this.warehouse.shelves[this.currentShelf];
    const startX = 100, startY = 100, itemWidth = 150, itemHeight = 100;

    (shelf.items || []).forEach((item, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = startX + col * itemWidth;
      const y = startY + row * itemHeight;

      if (!item) {
        this.ctx.fillStyle = '#bdc3c7';
        this.ctx.fillRect(x, y, itemWidth - 10, itemHeight - 10);
        return;
      }

      // Карточка товара (без подсветки "нужен/не нужен")
      this.ctx.fillStyle = '#ecf0f1';
      this.ctx.fillRect(x, y, itemWidth - 10, itemHeight - 10);

      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(item.name, x + 10, y + 25);
      this.ctx.fillText(`Кол-во: ${item.quantity}`, x + 10, y + 45);

      const oi = this.currentOrder.items.find(oi => oi.name === item.name);
      if (oi) {
        this.ctx.fillText(`Собрано: ${oi.pickedQuantity}/${oi.requiredQuantity}`, x + 10, y + 65);
      }
    });
  }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  window.game = new WareMoverGame();
});

// Отладка
console.log('WareMover game loaded successfully');
