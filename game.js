// Основной класс игры WareMover
class WareMoverGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameState = 'menu'; // menu, modeSelection, methodSelection, playing, paused, results
        this.gameMode = null; // quickOrder, marathon
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
        
        // Состояние взаимодействия
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
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.showScreen('modeSelection');
        });
        
        document.getElementById('settingsBtn').addEventListener('click', () => {
            // TODO: Реализовать настройки
            alert('Настройки будут добавлены в следующей версии');
        });
        
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showScreen('helpScreen');
        });
        
        // Выбор режима
        document.getElementById('quickOrderBtn').addEventListener('click', () => {
            this.gameMode = 'quickOrder';
            this.showScreen('pickingMethodSelection');
        });
        
        document.getElementById('marathonBtn').addEventListener('click', () => {
            this.gameMode = 'marathon';
            this.showScreen('pickingMethodSelection');
        });
        
        // Выбор метода комплектования
        document.getElementById('pickByListBtn').addEventListener('click', () => {
            this.pickingMethod = 'pickByList';
            this.startGame();
        });
        
        document.getElementById('pickByVoiceBtn').addEventListener('click', () => {
            this.pickingMethod = 'pickByVoice';
            this.startGame();
        });
        
        document.getElementById('pickByLightBtn').addEventListener('click', () => {
            this.pickingMethod = 'pickByLight';
            this.startGame();
        });
        
        document.getElementById('pickByVisionBtn').addEventListener('click', () => {
            this.pickingMethod = 'pickByVision';
            this.startGame();
        });
        
        // Кнопки "Назад"
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        document.getElementById('backToModeBtn').addEventListener('click', () => {
            this.showScreen('modeSelection');
        });
        
        document.getElementById('backFromHelpBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        // Результаты
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.showScreen('modeSelection');
        });
        
        document.getElementById('backToMainBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        // Пауза
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
        
        // Управление клавиатурой
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (e.code === 'KeyE' && this.gameState === 'playing') {
                this.handleInteraction();
            }
            
            if (e.code === 'Escape' && this.gameState === 'playing') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Управление мышью
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
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Показать нужный экран
        document.getElementById(screenId).classList.add('active');
        
        if (screenId === 'gameScreen') {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.gameState = 'playing';
            this.gameLoop();
        }
    }
    
    initializeWarehouse() {
        // Создание стеллажей
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
        const itemTypes = ['box', 'bottle', 'folder', 'package', 'container'];
        const items = [];
        
        for (let i = 0; i < 12; i++) {
            items.push({
                id: `item_${Math.random().toString(36).substr(2, 9)}`,
                type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
                name: `Товар ${i + 1}`,
                quantity: Math.floor(Math.random() * 10) + 1,
                position: i
            });
        }
        
        return items;
    }
    
    generateOrder() {
        const order = {
            id: `order_${Date.now()}`,
            items: [],
            totalItems: 20,
            completedItems: 0
        };
        
        // Выбираем случайные товары из стеллажей
        const allItems = [];
        this.warehouse.shelves.forEach((shelf, shelfIndex) => {
            shelf.items.forEach(item => {
                allItems.push({ ...item, shelfIndex });
            });
        });
        
        // Создаем заказ из 20 предметов (8 позиций)
        const selectedPositions = [];
        while (selectedPositions.length < 8) {
            const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
            if (!selectedPositions.find(p => p.id === randomItem.id)) {
                selectedPositions.push({
                    ...randomItem,
                    requiredQuantity: Math.floor(Math.random() * 3) + 1,
                    pickedQuantity: 0,
                    completed: false
                });
            }
        }
        
        order.items = selectedPositions;
        return order;
    }
    
    startGame() {
        this.score = 0;
        this.startTime = Date.now();
        this.gameTime = 0;
        this.ordersCompleted = 0;
        this.totalErrors = 0;
        this.currentOrder = this.generateOrder();
        
        // Сброс позиции игрока
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
        
        // Проверка завершения игры
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
        
        let dx = 0;
        let dy = 0;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= this.player.speed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += this.player.speed;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= this.player.speed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += this.player.speed;
        
        // Проверка коллизий со стенами
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        if (newX >= 0 && newX + this.player.width <= this.warehouse.width) {
            this.player.x = newX;
        }
        
        if (newY >= 0 && newY + this.player.height <= this.warehouse.height) {
            this.player.y = newY;
        }
    }
    
    checkInteractions() {
        this.nearInteractable = null;
        
        // Проверка близости к компьютеру
        if (this.isNear(this.player, this.warehouse.computer)) {
            this.nearInteractable = 'computer';
        }
        
        // Проверка близости к стеллажам
        this.warehouse.shelves.forEach((shelf, index) => {
            if (this.isNear(this.player, shelf)) {
                this.nearInteractable = { type: 'shelf', index };
            }
        });
        
        // Показать/скрыть панель взаимодействия
        const panel = document.getElementById('interactionPanel');
        if (this.nearInteractable) {
            panel.classList.remove('hidden');
            this.updateInteractionPanel();
        } else {
            panel.classList.add('hidden');
        }
    }
    
    isNear(obj1, obj2, distance = 50) {
        const centerX1 = obj1.x + obj1.width / 2;
        const centerY1 = obj1.y + obj1.height / 2;
        const centerX2 = obj2.x + obj2.width / 2;
        const centerY2 = obj2.y + obj2.height / 2;
        
        const dist = Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
        return dist < distance;
    }
    
    updateInteractionPanel() {
        const content = document.getElementById('interactionContent');
        
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
        // Показать информацию о заказе в зависимости от метода комплектования
        this.updateOrderPanel();
        
        if (this.pickingMethod === 'pickByVoice') {
            this.speakOrderInfo();
        }
    }
    
    speakOrderInfo() {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance();
            utterance.text = `Новый заказ. Необходимо собрать ${this.currentOrder.items.length} позиций.`;
            utterance.lang = 'ru-RU';
            speechSynthesis.speak(utterance);
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
        // Обработка клика по товару в стеллаже
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Определить, на какой товар кликнули
        const shelf = this.warehouse.shelves[this.currentShelf];
        const itemIndex = this.getClickedItemIndex(x, y);
        
        if (itemIndex !== -1) {
            this.pickItem(shelf.items[itemIndex]);
        }
    }
    
    handleShelfRightClick(e) {
        // Обработка правого клика (возврат товара)
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
        // Простая сетка 4x3 для товаров
        const startX = 100;
        const startY = 100;
        const itemWidth = 150;
        const itemHeight = 100;
        
        const col = Math.floor((x - startX) / itemWidth);
        const row = Math.floor((y - startY) / itemHeight);
        
        if (col >= 0 && col < 4 && row >= 0 && row < 3) {
            return row * 4 + col;
        }
        
        return -1;
    }
    
    pickItem(item) {
        // Найти этот товар в текущем заказе
        const orderItem = this.currentOrder.items.find(oi => oi.id === item.id);
        
        if (orderItem && !orderItem.completed) {
            if (orderItem.pickedQuantity < orderItem.requiredQuantity) {
                orderItem.pickedQuantity++;
                this.score += 10;
                
                if (orderItem.pickedQuantity >= orderItem.requiredQuantity) {
                    orderItem.completed = true;
                    this.score += 50; // Бонус за завершение позиции
                }
            } else {
                // Ошибка - взяли больше чем нужно
                this.totalErrors++;
                this.score -= 5;
            }
        } else {
            // Ошибка - взяли не тот товар
            this.totalErrors++;
            this.score -= 10;
        }
        
        this.updateOrderPanel();
        this.updateHUD();
    }
    
    returnItem(item) {
        // Найти этот товар в текущем заказе
        const orderItem = this.currentOrder.items.find(oi => oi.id === item.id);
        
        if (orderItem && orderItem.pickedQuantity > 0) {
            orderItem.pickedQuantity--;
            orderItem.completed = false;
            this.score -= 5; // Штраф за возврат
        }
        
        this.updateOrderPanel();
        this.updateHUD();
    }
    
    isOrderCompleted() {
        return this.currentOrder.items.every(item => item.completed);
    }
    
    updateHUD() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('time').textContent = this.formatTime(this.gameTime);
        
        const completedItems = this.currentOrder.items.filter(item => item.completed).length;
        document.getElementById('currentItem').textContent = completedItems;
        document.getElementById('totalItems').textContent = this.currentOrder.items.length;
        
        const methodNames = {
            'pickByList': 'Pick-by-List',
            'pickByVoice': 'Pick-by-Voice',
            'pickByLight': 'Pick-by-Light',
            'pickByVision': 'Pick-by-Vision'
        };
        document.getElementById('currentMethod').textContent = methodNames[this.pickingMethod];
    }
    
    updateOrderPanel() {
        const orderList = document.getElementById('orderList');
        orderList.innerHTML = '';
        
        this.currentOrder.items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'order-item';
            
            if (item.completed) {
                div.classList.add('completed');
            } else if (item.pickedQuantity > 0) {
                div.classList.add('current');
            }
            
            div.innerHTML = `
                <span>${item.name}</span>
                <span>${item.pickedQuantity}/${item.requiredQuantity}</span>
            `;
            
            orderList.appendChild(div);
        });
    }
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            // Показать меню паузы
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.gameLoop();
        }
    }
    
    endGame() {
        this.gameState = 'results';
        
        if (this.gameMode === 'marathon') {
            // Подсчет завершенных заказов
            if (this.isOrderCompleted()) {
                this.ordersCompleted++;
            }
        } else {
            this.ordersCompleted = 1;
        }
        
        this.showResults();
    }
    
    showResults() {
        document.getElementById('finalScore').querySelector('span').textContent = this.score;
        document.getElementById('finalTime').querySelector('span').textContent = this.formatTime(this.gameTime);
        
        const accuracy = this.totalErrors === 0 ? 100 : Math.max(0, 100 - (this.totalErrors * 10));
        document.getElementById('accuracy').querySelector('span').textContent = `${accuracy}%`;
        document.getElementById('ordersCompleted').querySelector('span').textContent = this.ordersCompleted;
        
        this.showScreen('resultsScreen');
    }
    
    render() {
        if (!this.ctx) return;
        
        // Очистка canvas
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(0, 0, this.warehouse.width, this.warehouse.height);
        
        if (this.inShelfView) {
            this.renderShelfView();
        } else {
            this.renderWarehouse();
        }
    }
    
    renderWarehouse() {
        // Рендер стеллажей
        this.ctx.fillStyle = '#8b4513';
        this.warehouse.shelves.forEach(shelf => {
            this.ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
            
            // Подсветка для Pick-by-Light
            if (this.pickingMethod === 'pickByLight') {
                const hasRequiredItem = shelf.items.some(item => 
                    this.currentOrder.items.some(orderItem => 
                        orderItem.id === item.id && !orderItem.completed
                    )
                );
                
                if (hasRequiredItem) {
                    this.ctx.strokeStyle = '#f39c12';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(shelf.x - 2, shelf.y - 2, shelf.width + 4, shelf.height + 4);
                }
            }
        });
        
        // Рендер компьютера
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(
            this.warehouse.computer.x, 
            this.warehouse.computer.y, 
            this.warehouse.computer.width, 
            this.warehouse.computer.height
        );
        
        // Рендер игрока
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
        // Очистка
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
        
        // Рендер товаров в сетке 4x3
        const shelf = this.warehouse.shelves[this.currentShelf];
        const startX = 100;
        const startY = 100;
        const itemWidth = 150;
        const itemHeight = 100;
        
        shelf.items.forEach((item, index) => {
            const col = index % 4;
            const row = Math.floor(index / 4);
            const x = startX + col * itemWidth;
            const y = startY + row * itemHeight;
            
            // Фон товара
            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.fillRect(x, y, itemWidth - 10, itemHeight - 10);
            
            // Подсветка для нужных товаров
            const orderItem = this.currentOrder.items.find(oi => oi.id === item.id);
            if (orderItem && !orderItem.completed) {
                this.ctx.strokeStyle = '#f39c12';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(x - 2, y - 2, itemWidth - 6, itemHeight - 6);
            }
            
            // Название товара
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(item.name, x + 10, y + 25);
            
            // Количество
            this.ctx.fillText(`Кол-во: ${item.quantity}`, x + 10, y + 45);
            
            // Прогресс сбора
            if (orderItem) {
                this.ctx.fillText(
                    `Собрано: ${orderItem.pickedQuantity}/${orderItem.requiredQuantity}`, 
                    x + 10, 
                    y + 65
                );
            }
        });
        
        // Проверка клика на кнопку выхода
        if (this.keys['KeyE']) {
            this.exitShelfView();
            this.keys['KeyE'] = false;
        }
    }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.game = new WareMoverGame();
});



// Добавляем отладочную информацию в конец файла
console.log('WareMover game loaded successfully');

