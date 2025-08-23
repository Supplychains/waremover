// ===============================
// WareMover — основной класс игры
// ===============================
class WareMoverGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;

    this.gameState = 'menu';      // menu, modeSelection, methodSelection, playing, paused, results
    this.gameMode = null;         // quickOrder, marathon
    this.pickingMethod = null;    // pickByList, pickByVoice, pickByLight, pickByVision

    this.score = 0;
    this.startTime = 0;
    this.gameTime = 0;
    this.currentOrder = null;
    this.ordersCompleted = 0;
    this.totalErrors = 0;

    this.player = { x:100, y:100, width:32, height:32, speed:3 };

    this.warehouse = {
      width: 800, height: 600,
      shelves: [],
      computer: { x:50, y:50, width:60, height:40 }
    };

    this.keys = {};
    this.mousePos = { x:0, y:0 };

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

  getEl(id){ const el = document.getElementById(id); if(!el) console.warn('No element', id); return el; }

  setupEventListeners() {
    // Главные меню
    this.getEl('startGameBtn')?.addEventListener('click', () => this.showScreen('modeSelection'));
    this.getEl('settingsBtn')?.addEventListener('click', () => alert('Настройки будут позже'));
    this.getEl('helpBtn')?.addEventListener('click', () => this.showScreen('helpScreen'));

    // Выбор режима
    this.getEl('quickOrderBtn')?.addEventListener('click', () => { this.gameMode='quickOrder'; this.showScreen('pickingMethodSelection'); });
    this.getEl('marathonBtn')?.addEventListener('click', () => { this.gameMode='marathon'; this.showScreen('pickingMethodSelection'); });

    // Методы
    this.getEl('pickByListBtn')?.addEventListener('click', () => { this.pickingMethod='pickByList'; this.startGame(); });
    this.getEl('pickByVoiceBtn')?.addEventListener('click', () => { this.pickingMethod='pickByVoice'; this.startGame(); });
    this.getEl('pickByLightBtn')?.addEventListener('click', () => { this.pickingMethod='pickByLight'; this.startGame(); });
    this.getEl('pickByVisionBtn')?.addEventListener('click', () => { this.pickingMethod='pickByVision'; this.startGame(); });

    // Назад
    this.getEl('backToMenuBtn')?.addEventListener('click', () => this.showScreen('mainMenu'));
    this.getEl('backToModeBtn')?.addEventListener('click', () => this.showScreen('modeSelection'));
    this.getEl('backFromHelpBtn')?.addEventListener('click', () => this.showScreen('mainMenu'));

    // Результаты
    this.getEl('playAgainBtn')?.addEventListener('click', () => this.showScreen('modeSelection'));
    this.getEl('backToMainBtn')?.addEventListener('click', () => this.showScreen('mainMenu'));

    // Пауза/Выход
    this.getEl('pauseBtn')?.addEventListener('click', () => this.togglePause());
    this.getEl('exitToMenuBtn')?.addEventListener('click', () => { this.gameState='menu'; this.showScreen('mainMenu'); });

    // Клавиатура (ловим пробел тоже)
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      const interactKey = (e.code === 'KeyE') || (e.code === 'Space') || (e.key === ' ');
      if (interactKey && this.gameState === 'playing') {
        e.preventDefault(); // чтобы пробел не скроллил
        this.handleInteraction();
      }
      if (e.code === 'Escape' && this.gameState === 'playing') this.togglePause();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Мышь
    document.addEventListener('mousemove', (e) => {
      const rect = this.canvas?.getBoundingClientRect();
      if (rect) { this.mousePos.x = e.clientX - rect.left; this.mousePos.y = e.clientY - rect.top; }
    });
    document.addEventListener('click', (e) => { if (this.inShelfView && this.gameState==='playing') this.handleShelfClick(e); });
    document.addEventListener('contextmenu', (e) => {
      if (this.inShelfView && this.gameState==='playing') { e.preventDefault(); this.handleShelfRightClick(e); }
    });
  }

  showScreen(screenId){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.getEl(screenId)?.classList.add('active');

    if (screenId === 'gameScreen') {
      this.canvas = this.getEl('gameCanvas');
      this.canvas.width = this.warehouse.width;
      this.canvas.height = this.warehouse.height;
      this.ctx = this.canvas.getContext('2d');
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  // ---------- Склад ----------
  initializeWarehouse(){
    this.warehouse.shelves = [
      { x:150, y:100, width:120, height:60, items:this.generateShelfItems() },
      { x:150, y:200, width:120, height:60, items:this.generateShelfItems() },
      { x:150, y:300, width:120, height:60, items:this.generateShelfItems() },
      { x:150, y:400, width:120, height:60, items:this.generateShelfItems() },
      { x:500, y:100, width:120, height:60, items:this.generateShelfItems() },
      { x:500, y:200, width:120, height:60, items:this.generateShelfItems() },
      { x:500, y:300, width:120, height:60, items:this.generateShelfItems() },
      { x:500, y:400, width:120, height:60, items:this.generateShelfItems() }
    ];
  }
  // 12 SKU на каждой полке
  generateShelfItems(){
    const arr = [];
    for (let pos=0; pos<12; pos++){
      const sku = pos+1;
      arr.push({
        id:`item_${Math.random().toString(36).slice(2,11)}`,
        sku, name:`Товар ${sku}`,
        quantity: Math.floor(Math.random()*5), // 0..4
        position: pos
      });
    }
    return arr;
  }

  // ---------- Заказ ----------
  generateOrder(){
    const order = { id:`order_${Date.now()}`, items:[], totalItems:0, completedItems:0 };
    const allSkus = Array.from({length:12}, (_,i)=>i+1);
    for (let i=allSkus.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [allSkus[i],allSkus[j]]=[allSkus[j],allSkus[i]]; }
    const chosen = allSkus.slice(0,8);
    order.items = chosen.map(sku=>({
      sku, name:`Товар ${sku}`,
      requiredQuantity: Math.floor(Math.random()*4)+9, // 9..12
      pickedQuantity: 0, completed:false
    }));
    order.totalItems = order.items.reduce((s,it)=>s+it.requiredQuantity,0);
    return order;
  }

  // ---------- Запуск/цикл ----------
  startGame(){
    this.score = 0; this.startTime = Date.now(); this.gameTime = 0;
    this.ordersCompleted = 0; this.totalErrors = 0;
    this.currentOrder = this.generateOrder();
    this.player.x = 100; this.player.y = 100;
    this.updateHUD(); this.updateOrderPanel();
    this.showScreen('gameScreen');
  }
  gameLoop(){
    if (this.gameState !== 'playing') return;
    this.update(); this.render();
    requestAnimationFrame(()=>this.gameLoop());
  }

  // ---------- Update ----------
  update(){
    this.updateGameTime();
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();
    if (this.gameMode==='marathon' && this.gameTime>=90000) this.endGame();
    else if (this.gameMode==='quickOrder' && this.isOrderCompleted()) this.endGame();
  }
  updateGameTime(){ if (this.gameState==='playing') this.gameTime = Date.now()-this.startTime; }
  updatePlayer(){
    if (this.inShelfView) return;
    let dx=0, dy=0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= this.player.speed;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += this.player.speed;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= this.player.speed;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += this.player.speed;
    const nx = this.player.x + dx, ny = this.player.y + dy;
    if (nx>=0 && nx+this.player.width<=this.warehouse.width) this.player.x = nx;
    if (ny>=0 && ny+this.player.height<=this.warehouse.height) this.player.y = ny;
  }

  // ---------- Взаимодействия ----------
  checkInteractions(){
    this.nearInteractable = null;
    if (this.isNear(this.player, this.warehouse.computer)) this.nearInteractable = 'computer';
    this.warehouse.shelves.forEach((shelf, index)=>{
      if (this.isNear(this.player, shelf)) this.nearInteractable = {type:'shelf', index};
    });

    const panel = this.getEl('interactionPanel');
    if (!panel) return;
    if (this.nearInteractable){ panel.classList.remove('hidden'); this.updateInteractionPanel(); }
    else panel.classList.add('hidden');
  }

  // Увеличен радиус до 90 для удобства
  isNear(obj1,obj2,distance=90){
    const c1x=obj1.x+obj1.width/2, c1y=obj1.y+obj1.height/2;
    const c2x=obj2.x+obj2.width/2, c2y=obj2.y+obj2.height/2;
    return Math.hypot(c2x-c1x,c2y-c1y) < distance;
  }

  updateInteractionPanel(){
    const content = this.getEl('interactionContent'); if (!content) return;
    if (this.nearInteractable === 'computer'){
      content.innerHTML = '<p>Нажмите E/Пробел, чтобы посмотреть заказ</p>';
    } else if (this.nearInteractable && this.nearInteractable.type==='shelf'){
      content.innerHTML = `
        <p>Стеллаж рядом. E/Пробел — открыть</p>
        <button id="openShelfBtn">Открыть</button>
      `;
      this.getEl('openShelfBtn')?.addEventListener('click', ()=> this.enterShelfView(this.nearInteractable.index));
    } else {
      content.innerHTML = '';
    }
  }

  handleInteraction(){
    if (this.nearInteractable === 'computer') this.showOrderInfo();
    else if (this.nearInteractable && this.nearInteractable.type==='shelf') this.enterShelfView(this.nearInteractable.index);
    else if (!this.inShelfView && this.currentShelf !== null) this.enterShelfView(this.currentShelf);
  }

  showOrderInfo(){ this.updateOrderPanel(); if (this.pickingMethod==='pickByVoice') this.speakOrderInfo(); }
  speakOrderInfo(){
    if ('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance();
      u.text = `Новый заказ. Необходимо собрать ${(this.currentOrder?.items?.length)||0} позиций.`; u.lang='ru-RU';
      speechSynthesis.speak(u);
    }
  }

  // ---------- Полки ----------
  enterShelfView(shelfIndex){ this.inShelfView = true; this.currentShelf = shelfIndex; this.renderShelfView(); }
  exitShelfView(){ this.inShelfView = false; this.currentShelf = null; }

  handleShelfClick(e){
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // Кнопка выхода
    if (x >= this.warehouse.width-100 && x <= this.warehouse.width-20 && y>=20 && y<=50){ this.exitShelfView(); return; }
    const shelf = this.warehouse.shelves[this.currentShelf];
    const idx = this.getClickedItemIndex(x,y);
    if (idx !== -1) this.pickItem(shelf.items[idx]);
  }
  handleShelfRightClick(e){
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const shelf = this.warehouse.shelves[this.currentShelf];
    const idx = this.getClickedItemIndex(x,y);
    if (idx !== -1) this.returnItem(shelf.items[idx]);
  }
  getClickedItemIndex(x,y){
    const startX=100, startY=100, itemWidth=150, itemHeight=100;
    const col = Math.floor((x-startX)/itemWidth), row = Math.floor((y-startY)/itemHeight);
    if (col>=0 && col<4 && row>=0 && row<3){ const i=row*4+col; return (i>=0 && i<12) ? i : -1; }
    return -1;
  }

  // Подбор по SKU
  pickItem(shelfItem){
    if (!this.currentOrder) return;
    const orderItem = this.currentOrder.items.find(oi => oi.sku === shelfItem.sku);
    if (!orderItem){ this.totalErrors++; this.score -= 10; this.updateOrderPanel(); this.updateHUD(); return; }
    if (orderItem.completed){ this.totalErrors++; this.score -= 5; this.updateHUD(); return; }
    if (shelfItem.quantity <= 0){ this.totalErrors++; this.score -= 3; this.updateHUD(); return; }

    shelfItem.quantity -= 1;
    orderItem.pickedQuantity += 1;
    this.score += 10;
    if (orderItem.pickedQuantity >= orderItem.requiredQuantity){ orderItem.completed = true; this.score += 50; }

    this.updateOrderPanel(); this.updateHUD();
  }
  returnItem(shelfItem){
    if (!this.currentOrder) return;
    const orderItem = this.currentOrder.items.find(oi => oi.sku === shelfItem.sku);
    if (orderItem && orderItem.pickedQuantity>0){
      orderItem.pickedQuantity -= 1; shelfItem.quantity += 1;
      orderItem.completed = orderItem.pickedQuantity >= orderItem.requiredQuantity;
      this.score -= 5;
    }
    this.updateOrderPanel(); this.updateHUD();
  }
  isOrderCompleted(){ return !!this.currentOrder && this.currentOrder.items.every(i=>i.completed); }

  // ---------- HUD/UI ----------
  updateHUD(){
    this.getEl('score') && (this.getEl('score').textContent = this.score);
    this.getEl('time') && (this.getEl('time').textContent = this.formatTime(this.gameTime));
    const names = { pickByList:'Pick-by-List', pickByVoice:'Pick-by-Voice', pickByLight:'Pick-by-Light', pickByVision:'Pick-by-Vision' };
    this.getEl('currentMethod') && (this.getEl('currentMethod').textContent = names[this.pickingMethod] || '');
    if (!this.currentOrder) return;
    const completed = this.currentOrder.items.filter(i=>i.completed).length;
    this.getEl('currentItem') && (this.getEl('currentItem').textContent = completed);
    this.getEl('totalItems') && (this.getEl('totalItems').textContent = this.currentOrder.items.length);
  }
  updateOrderPanel(){
    const cont = this.getEl('orderList'); if (!cont || !this.currentOrder) return;
    cont.innerHTML = '';
    this.currentOrder.items.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'order-item';
      if (item.completed) div.classList.add('completed');
      else if (item.pickedQuantity>0) div.classList.add('current');
      div.innerHTML = `<span>${item.name}</span><span>${item.pickedQuantity}/${item.requiredQuantity}</span>`;
      cont.appendChild(div);
    });
  }

  formatTime(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60; return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`; }

  // ---------- Завершение/пауза ----------
  togglePause(){ if (this.gameState==='playing'){ this.gameState='paused'; } else if (this.gameState==='paused'){ this.gameState='playing'; this.gameLoop(); } }
  endGame(){
    this.gameState='results';
    if (this.gameMode==='marathon'){ if (this.isOrderCompleted()) this.ordersCompleted++; }
    else this.ordersCompleted = 1;
    this.showResults();
  }
  showResults(){
    const setSpan=(id,v)=>{ const h=this.getEl(id); if(!h) return; const s=h.querySelector('span')||h; s.textContent=v; };
    setSpan('finalScore',this.score); setSpan('finalTime',this.formatTime(this.gameTime));
    const acc = this.totalErrors===0 ? 100 : Math.max(0, 100 - (this.totalErrors*10));
    setSpan('accuracy',`${acc}%`); setSpan('ordersCompleted',this.ordersCompleted);
    this.showScreen('resultsScreen');
  }

  // ---------- Рендер ----------
  render(){
    if (!this.ctx) return;
    this.ctx.fillStyle='#34495e'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
    if (this.inShelfView) this.renderShelfView(); else this.renderWarehouse();
  }
  renderWarehouse(){
    // стеллажи
    this.ctx.fillStyle='#8b4513';
    this.warehouse.shelves.forEach(s=> this.ctx.fillRect(s.x,s.y,s.width,s.height));

    // подсветка ближайшего стеллажа
    if (this.nearInteractable && this.nearInteractable.type==='shelf'){
      const s = this.warehouse.shelves[this.nearInteractable.index];
      this.ctx.strokeStyle='rgba(241,196,15,0.95)'; this.ctx.lineWidth=3;
      this.ctx.strokeRect(s.x-3, s.y-3, s.width+6, s.height+6);
    }

    // компьютер
    this.ctx.fillStyle='#2c3e50';
    this.ctx.fillRect(this.warehouse.computer.x,this.warehouse.computer.y,this.warehouse.computer.width,this.warehouse.computer.height);

    // игрок
    this.ctx.fillStyle='#e74c3c';
    this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);

    // индикатор "E"
    if (this.nearInteractable){
      this.ctx.fillStyle='rgba(241,196,15,0.9)'; this.ctx.font='16px Arial';
      this.ctx.fillText('E', this.player.x + this.player.width + 10, this.player.y + 20);
    }
  }
  renderShelfView(){
    this.ctx.fillStyle='#2c3e50'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);

    this.ctx.fillStyle='#fff'; this.ctx.font='24px Arial';
    this.ctx.fillText(`Стеллаж ${this.currentShelf+1}`, 20, 40);

    // кнопка выхода
    this.ctx.fillStyle='#e74c3c';
    this.ctx.fillRect(this.warehouse.width-100,20,80,30);
    this.ctx.fillStyle='#fff'; this.ctx.font='16px Arial';
    this.ctx.fillText('Выход (E)', this.warehouse.width-95, 40);

    const shelf = this.warehouse.shelves[this.currentShelf];
    const startX=100, startY=100, itemWidth=150, itemHeight=100;

    shelf.items.forEach((item, i)=>{
      const col=i%4, row=Math.floor(i/4);
      const x=startX+col*itemWidth, y=startY+row*itemHeight;

      this.ctx.fillStyle='#ecf0f1';
      this.ctx.fillRect(x,y,itemWidth-10,itemHeight-10);

      this.ctx.fillStyle='#2c3e50'; this.ctx.font='14px Arial';
      this.ctx.fillText(item.name, x+10, y+25);
      this.ctx.fillText(`Кол-во: ${item.quantity}`, x+10, y+45);

      const orderItem = this.currentOrder?.items.find(oi=>oi.sku===item.sku);
      if (orderItem){
        this.ctx.fillText(`Собрано: ${orderItem.pickedQuantity}/${orderItem.requiredQuantity}`, x+10, y+65);
      }
    });

    // закрытие по E/Space
    if (this.keys['KeyE'] || this.keys['Space']){
      this.exitShelfView();
      this.keys['KeyE']=false; this.keys['Space']=false;
    }
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  window.game = new WareMoverGame();
  console.log('WareMover game loaded successfully');
});
