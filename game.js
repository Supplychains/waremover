// ===============================
// WareMover — основной класс игры
// ===============================
class WareMoverGame {
  constructor() {
    // Canvas/рендер
    this.canvas = null;
    this.ctx = null;

    // Состояние игры
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
    this.player = {
      x: 100,
      y: 100,
      width: 32,
      height: 32,
      speed: 3
    };

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

    // Инициализация
    this.init();
  }

  // ----------------------------
  // Инициализация
  // ----------------------------
  init() {
    this.setupEventListeners();
    this.initializeWarehouse();
    this.showScreen('mainMenu');
  }

  // Безопасное получение элемента
  getEl(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('[WareMover] Элемент не найден:', id);
    return el;
  }

  setupEventListeners() {
    // Кнопки главного меню
    this.getEl('startGameBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    this.getEl('settingsBtn')?.addEventListener('click', () => {
      alert('Настройки будут добавлены в следующей версии');
    });

    this.getEl('helpBtn')?.addEventListener('click', () => {
      this.showScreen('helpScreen');
    });

    // Выбор режима
    this.getEl('quickOrderBtn')?.addEventListener('click', () => {
      this.gameMode = 'quickOrder';
      this.showScreen('pickingMethodSelection');
    });

    this.getEl('marathonBtn')?.addEventListener('click', () => {
      this.gameMode = 'marathon';
      this.showScreen('pickingMethodSelection');
    });

    // Выбор метода комплектования
    this.getEl('pickByListBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByList';
      console.log('[WareMover] Pick-by-List clicked → startGame');
      this.startGame();
    });

    this.getEl('pickByVoiceBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByVoice';
      this.startGame();
    });

    this.getEl('pickByLightBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByLight';
      this.startGame();
    });

    this.getEl('pickByVisionBtn')?.addEventListener('click', () => {
      this.pickingMethod = 'pickByVision';
      this.startGame();
    });

    // Назад
    this.getEl('backToMenuBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    this.getEl('backToModeBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    this.getEl('backFromHelpBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    // Результаты
    this.getEl('playAgainBtn')?.addEventListener('click', () => {
      this.showScreen('modeSelection');
    });

    this.getEl('backToMainBtn')?.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    // Пауза
    this.getEl('pauseBtn')?.addEventListener('click', () => {
      this.togglePause();
    });

    // Клавиатура
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if ((e.code === 'KeyE' || e.code === 'Space') && this.gameState === 'playing') {
        this.handleInteraction();
      }

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
      if (this.inShelfView && this.gameState === 'playing') {
        this.handleShelfClick(e);
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.inShelfView && this.gameState === 'playing') {
        e.preventDefault();
        this.handleShelfRightClick(e);
      }
    });
  }

  showScreen(screenId) {
    // Скрыть все экраны
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Показать нужный
    this.getEl(screenId)?.classList.add('active');

    if (screenId === 'gameScreen') {
      this.canvas = this.getEl('gameCanvas');
      if (!this.canvas) {
        console.error('[WareMover] Не найден canvas #gameCanvas');
        return;
      }
      // Подгоняем размер канвы под склад
      this.canvas.width = this.warehouse.width;
      this.canvas.height = this.warehouse.height;

      this.ctx = this.canvas.getContext('2d');
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  // ----------------------------
  // Генерация склада/товаров
  // ----------------------------
  initializeWarehouse() {
    // 8 стеллажей: 4 слева, 4 справа
    this.warehouse.shelves = [
      { x: 150, y: 100, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 200, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 300, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 150, y: 400, width: 120, height: 60, items: this.generateShelfItems() },

      { x: 500, y: 100, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 200, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 300, width: 120, height: 60, items: this.generateShelfItems() },
      { x: 500, y: 400, width: 120, height: 60, items: this.generateShelfItems() }
    ];
  }

  generateShelfItems() {
    const itemTypes = ['box', 'bottle', 'folder', 'package', 'container'];
    const items = [];
    for (let i = 0; i < 12; i++) {
      items.push({
        id: `item_${Math.random().toString(36).slice(2, 11)}`,
        type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
        name: `Товар ${i + 1}`,
        quantity: Math.floor(Math.random() * 5), // 0..4
        position: i
      });
    }
    return items;
  }

  // ----------------------------
  // Генерация заказа
  // ----------------------------
  generateOrder() {
    const order = {
      id: `order_${Date.now()}`,
      items: [],
      totalItems: 0,
      completedItems: 0
    };

    // Соберём все товары по полкам
    const allItems = [];
    this.warehouse.shelves.forEach((shelf, shelfIndex) => {
      shelf.items.forEach(item => {
        allItems.push({ ...item, shelfIndex });
      });
    });

    // Выбираем 8 уникальных позиций, каждая с требуемым количеством 9..12
    const selectedPositions = [];
    const available = [...allItems];

    while (selectedPositions.length < 8 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      const picked = available.splice(idx, 1)[0];

      selectedPositions.push({
        ...picked,
        requiredQuantity: Math.floor(Math.random() * 4) + 9, // 9..12
        pickedQuantity: 0,
        completed: false
      });
    }

    order.items = selectedPositions;
    order.totalItems = selectedPositions.reduce((sum, it) => sum + it.requiredQuantity, 0);
    return order; // ВАЖНО!
  }

  // ----------------------------
  // Запуск/цикл
  // ----------------------------
  startGame() {
    console.log('[WareMover] startGame');
    this.score = 0;
    this.startTime = Date.now();
    this.gameTime = 0;
    this.ordersCompleted = 0;
    this.totalErrors = 0;

    this.currentOrder = this.generateOrder();
    console.log('[WareMover] generated order:', this.currentOrder);

    // Сброс позиции игрока
    this.player.x = 100;
    this.player.y = 100;

    this.updateHUD();
    this.updateOrderPanel();
    this.showScreen('gameScreen');
    console.log('[WareMover] game screen shown');
  }

  gameLoop() {
    if (this.gameState !== 'playing') return;

    this.update();
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  // ----------------------------
  // Обновления
  // ----------------------------
  update() {
    this.updateGameTime();
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();

    // Условия завершения
    if (this.gameMode === 'marathon' && this.gameTime >= 90000) {
      this.endGame();
    } else if (this.gameMode === 'quickOrder' && this.isOrderCompleted()) {
      this.endGame();
    }
  }

  updateGameTime() {
    if (this.gameState === 'playing') {
      this.gameTime = Date.now() - this.startTime;
    }
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

    if (newX >= 0 && newX + this.player.width <= this.warehouse.width) {
      this.player.x = newX;
    }
    if (newY >= 0 && newY + this.player.height <= this.warehouse.height) {
      this.player.y = newY;
    }
  }

  // ----------------------------
  // Взаимодействия
  // ----------------------------
  checkInteractions() {
    this.nearInteractable = null;

    // Компьютер
    if (this.isNear(this.player, this.warehouse.computer)) {
      this.nearInteractable = 'computer';
    }

    // Стеллажи
    this.warehouse.shelves.forEach((shelf, index) => {
      if (this.isNear(this.player, shelf)) {
        this.nearInteractable = { type: 'shelf', index };
      }
    });

    // Панель взаимодействия
    const panel = this.getEl('interactionPanel');
    if (panel) {
      if (this.nearInteractable) {
        panel.classList.remove('hidden');
        this.updateInteractionPanel();
      } else {
        panel.classList.add('hidden');
      }
    }
  }

  isNear(obj1, obj2, distance = 50) {
    const c1x = obj1.x + obj1.width / 2;
    const c1y = obj1.y + obj1.height / 2;
    const c2x = obj2.x + obj2.width / 2;
    const c2y = obj2.y + obj2.height / 2;

    const dist = Math.hypot(c2x - c1x, c2y - c1y);
    return dist < distance;
  }

  updateInteractionPanel() {
    const content = this.getEl('interactionContent');
    if (!content) return;

    if (this.nearInteractable === 'computer') {
      content.innerHTML = '<p>Нажмите E, чтобы получить/просмотреть заказ</p>';
    } else if (this.nearInteractable && this.nearInteractable.type === 'shelf') {
      content.innerHTML = '<p>Нажмите E, чтобы просмотреть стеллаж</p>';
    } else {
      content.innerHTML = '';
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
    if (this.pickingMethod === 'pickByVoice') {
      this.speakOrderInfo();
    }
  }

  speakOrderInfo() {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance();
      const count = this.currentOrder?.items?.length ?? 0;
      utterance.text = `Новый заказ. Необходимо собрать ${count} позиций.`;
      utterance.lang = 'ru-RU';
      speechSynthesis.speak(utterance);
    }
  }

  // ----------------------------
  // Полки (Shelf View)
  // ----------------------------
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

    // Проверка клика по кнопке "Выход"
    if (x >= this.warehouse.width - 100 && x <= this.warehouse.width - 20 &&
        y >= 20 && y <= 50) {
      this.exitShelfView();
      return;
    }

    const shelf = this.warehouse.shelves[this.currentShelf];
    const itemIndex = this.getClickedItemIndex(x, y);
    if (itemIndex !== -1) {
      this.pickItem(shelf.items[itemIndex]);
    }
  }

  handleShelfRightClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const shelf = this.warehouse.shelves[this.currentShelf];
    const itemIndex = this.getClickedItemIndex(x, y);
    if (itemIndex !== -1) {
      this.returnItem(shelf.items[itemIndex]);
    }
  }

  getClickedItemIndex(x, y) {
    // Сетка 4x3
    const startX = 100, startY = 100;
    const itemWidth = 150, itemHeight = 100;

    const col = Math.floor((x - startX) / itemWidth);
    const row = Math.floor((y - startY) / itemHeight);

    if (col >= 0 && col < 4 && row >= 0 && row < 3) {
      const index = row * 4 + col;
      return index >= 0 && index < 12 ? index : -1;
    }
    return -1;
  }

  pickItem(item) {
    if (!this.currentOrder) return;

    const orderItem = this.currentOrder.items.find(oi => oi.id === item.id);

    if (orderItem && !orderItem.completed) {
      if (orderItem.pickedQuantity < orderItem.requiredQuantity) {
        // Нельзя забирать со стеллажа меньше 0
        if (item.quantity > 0) {
          orderItem.pickedQuantity++;
          item.quantity--;
          this.score += 10;

          if (orderItem.pickedQuantity >= orderItem.requiredQuantity) {
            orderItem.completed = true;
            this.score += 50; // бонус за закрытие позиции
          }
        } else {
          // Ошибка — полка пустая
          this.totalErrors++;
          this.score -= 3;
        }
      } else {
        // Взяли больше, чем нужно
        this.totalErrors++;
        this.score -= 5;
      }
    } else {
      // Не тот товар
      this.totalErrors++;
      this.score -= 10;
    }

    this.updateOrderPanel();
    this.updateHUD();
  }

  returnItem(item) {
    if (!this.currentOrder) return;

    const orderItem = this.currentOrder.items.find(oi => oi.id === item.id);
    if (orderItem && orderItem.pickedQuantity > 0) {
      orderItem.pickedQuantity--;
      item.quantity++;
      orderItem.completed = orderItem.pickedQuantity >= orderItem.requiredQuantity;
      this.score -= 5; // Штраф за возврат
    }

    this.updateOrderPanel();
    this.updateHUD();
  }

  isOrderCompleted() {
    return !!this.currentOrder && this.currentOrder.items.every(i => i.completed);
  }

  // ----------------------------
  // HUD / UI
  // ----------------------------
  updateHUD() {
    this.getEl('score') && (this.getEl('score').textContent = this.score);
    this.getEl('time') && (this.getEl('time').textContent = this.formatTime(this.gameTime));

    const methodNames = {
      pickByList: 'Pick-by-List',
      pickByVoice: 'Pick-by-Voice',
      pickByLight: 'Pick-by-Light',
      pickByVision: 'Pick-by-Vision'
    };
    if (this.getEl('currentMethod')) {
      this.getEl('currentMethod').textContent = methodNames[this.pickingMethod] || '';
    }

    if (!this.currentOrder) return;

    const completedItems = this.currentOrder.items.filter(i => i.completed).length;
    this.getEl('currentItem') && (this.getEl('currentItem').textContent = completedItems);
    this.getEl('totalItems') && (this.getEl('totalItems').textContent = this.currentOrder.items.length);
  }

  updateOrderPanel() {
    const container = this.getEl('orderList');
    if (!container || !this.currentOrder) return;

    container.innerHTML = '';

    this.currentOrder.items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'order-item';
      if (item.completed) div.classList.add('completed');
      else if (item.pickedQuantity > 0) div.classList.add('current');

      div.innerHTML = `
        <span>${item.name}</span>
        <span>${item.pickedQuantity}/${item.requiredQuantity}</span>
      `;
      container.appendChild(div);
    });
  }

  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // ----------------------------
  // Завершение/пауза
  // ----------------------------
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
    const setSpan = (id, value) => {
      const holder = this.getEl(id);
      if (!holder) return;
      const span = holder.querySelector('span') || holder;
      span.textContent = value;
    };

    setSpan('finalScore', this.score);
    setSpan('finalTime', this.formatTime(this.gameTime));

    const accuracy = this.totalErrors === 0 ? 100 : Math.max(0, 100 - (this.totalErrors * 10));
    setSpan('accuracy', `${accuracy}%`);
    setSpan('ordersCompleted', this.ordersCompleted);

    this.showScreen('resultsScreen');
  }

  // ----------------------------
  // Рендер
  // ----------------------------
  render() {
    if (!this.ctx) return;

    // Фон
    this.ctx.fillStyle = '#34495e';
    this.ctx.fillRect(0, 0, this.warehouse.width, this.warehouse.height);

    if (this.inShelfView) {
      this.renderShelfView();
    } else {
      this.renderWarehouse();
    }
  }

  renderWarehouse() {
    // Стеллажи
    this.ctx.fillStyle = '#8b4513';
    this.warehouse.shelves.forEach(shelf => {
      this.ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
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

    // Индикатор "E"
    if (this.nearInteractable) {
      this.ctx.fillStyle = 'rgba(241, 196, 15, 0.9)';
      this.ctx.font = '16px Arial';
      this.ctx.fillText('E', this.player.x + this.player.width + 10, this.player.y + 20);
    }
  }

  renderShelfView() {
    // Заливка
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.warehouse.width, this.warehouse.height);

    // Заголовок
    this.ctx.fillStyle = 'white';
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`Стеллаж ${this.currentShelf + 1}`, 20, 40);

    // Кнопка выхода
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.fillRect(this.warehouse.width - 100, 20, 80, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('Выход (E)', this.warehouse.width - 95, 40);

    // Товары 4x3
    const shelf = this.warehouse.shelves[this.currentShelf];
    const startX = 100, startY = 100;
    const itemWidth = 150, itemHeight = 100;

    shelf.items.forEach((item, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = startX + col * itemWidth;
      const y = startY + row * itemHeight;

      // Карточка
      this.ctx.fillStyle = '#ecf0f1';
      this.ctx.fillRect(x, y, itemWidth - 10, itemHeight - 10);

      this.ctx.fillStyle = '#2c3e50';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(item.name, x + 10, y + 25);
      this.ctx.fillText(`Кол-во: ${item.quantity}`, x + 10, y + 45);

      // Прогресс по заказу
      const orderItem = this.currentOrder?.items.find(oi => oi.id === item.id);
      if (orderItem) {
        this.ctx.fillText(
          `Собрано: ${orderItem.pickedQuantity}/${orderItem.requiredQuantity}`,
          x + 10, y + 65
        );
      }
    });

    // Быстрый выход через E
    if (this.keys['KeyE']) {
      this.exitShelfView();
      this.keys['KeyE'] = false;
    }
  }
}

// ----------------------------
// Инициализация на загрузке
// ----------------------------
document.addEventListener('DOMContentLoaded', () => {
  window.game = new WareMoverGame();
  console.log('WareMover game loaded successfully');
});
