// Глобальный лог ошибок — чтобы сразу увидеть падения
window.addEventListener('error', e => {
  console.error('[WareMover ERROR]', e.message, e.filename, e.lineno, e.colno);
});

class WareMoverGame {
  constructor(){
    this.canvas = null; this.ctx = null;

    this.gameState = 'menu';
    this.gameMode = 'quickOrder';        // дефолт
    this.pickingMethod = 'pickByList';   // дефолт

    this.score = 0; this.startTime = 0; this.gameTime = 0;
    this.currentOrder = null; this.ordersCompleted = 0; this.totalErrors = 0;

    this.player = { x:100, y:100, width:32, height:32, speed:3 };

    this.warehouse = { width:800, height:600, shelves:[], computer:{x:50,y:50,width:60,height:40} };

    this.keys = {}; this.mousePos = { x:0, y:0 };
    this.nearInteractable = null;
    this.inShelfView = false;
    this.currentShelf = null;

    // обработчики для режима полки (навешиваются/снимаются динамически)
    this._onCanvasShelfClick = null;
    this._onCanvasShelfContext = null;

    // константы уголка
    this.cornerW = 25;
    this.cornerH = 20;
    this.cornerOffsetX = 35; // от правого края карточки
    this.cornerOffsetY = 5;  // от верхнего края карточки

    this.init();
  }

  init(){
    console.log('[WareMover] init. screens=', document.querySelectorAll('.screen').length);
    this.setupEventListeners();
    this.initializeWarehouse();
    this.showScreen('mainMenu');
  }

  getEl(id){ const el=document.getElementById(id); if(!el) console.warn('[WareMover] no element', id); return el; }

  setupEventListeners(){
    // меню
    this.getEl('startGameBtn')?.addEventListener('click', ()=> this.startGame());
    this.getEl('helpBtn')?.addEventListener('click', ()=> this.showScreen('helpScreen'));
    this.getEl('backFromHelpBtn')?.addEventListener('click', ()=> this.showScreen('mainMenu'));

    // результаты / выход
    this.getEl('playAgainBtn')?.addEventListener('click', ()=> this.startGame());
    this.getEl('backToMainBtn')?.addEventListener('click', ()=> this.showScreen('mainMenu'));
    this.getEl('pauseBtn')?.addEventListener('click', ()=> this.togglePause());
    this.getEl('exitToMenuBtn')?.addEventListener('click', ()=>{ this.gameState='menu'; this.showScreen('mainMenu'); });

    // клавиатура (тоггл E/Space)
    document.addEventListener('keydown', (e)=>{
      this.keys[e.code] = true;
      const interact = (e.code==='KeyE') || (e.code==='Space') || (e.key===' ');
      if (interact && this.gameState==='playing'){
        e.preventDefault();
        this.handleInteraction(); // открыть/закрыть полку
      }
      if (e.code==='Escape' && this.gameState==='playing') this.togglePause();
    }, {capture:true});
    document.addEventListener('keyup', (e)=>{ this.keys[e.code] = false; });

    // мышь — позиция (подсветка)
    document.addEventListener('mousemove', (e)=>{
      const r=this.canvas?.getBoundingClientRect();
      if (r){ this.mousePos.x=e.clientX-r.left; this.mousePos.y=e.clientY-r.top; }
    });

    // Открытие полки кликом по канвасу (в виде склада)
    this.getEl('gameCanvas')?.addEventListener('click', (e)=>{
      if (this.gameState!=='playing' || this.inShelfView || !this.canvas) return;
      const r=this.canvas.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
      const idx=this.warehouse.shelves.findIndex(s=>x>=s.x&&x<=s.x+s.width&&y>=s.y&&y<=s.y+s.height);
      if (idx>=0) this.enterShelfView(idx);
    });
  }

  showScreen(screenId){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const target=this.getEl(screenId);
    if (!target){ console.error('[WareMover] screen not found:', screenId); return; }
    target.classList.add('active');
    console.log('[WareMover] showScreen ->', screenId);

    if (screenId==='gameScreen'){
      this.canvas=this.getEl('gameCanvas');
      if (!this.canvas){ console.error('No canvas'); return; }
      this.canvas.width=this.warehouse.width;
      this.canvas.height=this.warehouse.height;
      this.ctx=this.canvas.getContext('2d');
      this.canvas.tabIndex=0; this.canvas.focus();

      this.gameState='playing';
      this.gameLoop();
    } else {
      this.exitShelfView(); // на всякий снятие обработчиков
    }
  }

  // ---------- склад ----------
  initializeWarehouse(){
    this.warehouse.shelves = [
      {x:150,y:100,width:120,height:60,items:this.generateShelfItems()},
      {x:150,y:200,width:120,height:60,items:this.generateShelfItems()},
      {x:150,y:300,width:120,height:60,items:this.generateShelfItems()},
      {x:150,y:400,width:120,height:60,items:this.generateShelfItems()},
      {x:500,y:100,width:120,height:60,items:this.generateShelfItems()},
      {x:500,y:200,width:120,height:60,items:this.generateShelfItems()},
      {x:500,y:300,width:120,height:60,items:this.generateShelfItems()},
      {x:500,y:400,width:120,height:60,items:this.generateShelfItems()},
    ];
  }
  generateShelfItems(){
    const a=[];
    for (let p=0; p<12; p++){
      const sku=p+1;
      a.push({ id:`item_${Math.random().toString(36).slice(2,11)}`, sku, name:`Товар ${sku}`, quantity:Math.floor(Math.random()*5), position:p });
    }
    return a;
  }

  // ---------- заказ ----------
  generateOrder(){
    const all=Array.from({length:12},(_,i)=>i+1);
    for (let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
    const chosen = all.slice(0,8);
    const items = chosen.map(sku=>({ sku, name:`Товар ${sku}`, requiredQuantity:Math.floor(Math.random()*4)+9, pickedQuantity:0, completed:false }));
    return { id:`order_${Date.now()}`, items, totalItems:items.reduce((s,i)=>s+i.requiredQuantity,0), completedItems:0 };
  }

  // ---------- запуск/цикл ----------
  startGame(){
    this.score=0; this.startTime=Date.now(); this.gameTime=0;
    this.ordersCompleted=0; this.totalErrors=0;
    this.currentOrder=this.generateOrder();
    this.player.x=100; this.player.y=100;
    this.updateHUD(); this.updateOrderPanel();
    this.showScreen('gameScreen');
  }
  gameLoop(){ if (this.gameState!=='playing') return; this.update(); this.render(); requestAnimationFrame(()=>this.gameLoop()); }

  // ---------- update ----------
  update(){
    if (this.gameState!=='playing') return;
    this.gameTime = Date.now() - this.startTime;
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();
    if (this.gameMode==='marathon' && this.gameTime>=90000) this.endGame();
    else if (this.gameMode==='quickOrder' && this.isOrderCompleted()) this.endGame();
  }
  updatePlayer(){
    if (this.inShelfView) return;
    let dx=0, dy=0;
    if (this.keys['KeyW']||this.keys['ArrowUp']) dy -= this.player.speed;
    if (this.keys['KeyS']||this.keys['ArrowDown']) dy += this.player.speed;
    if (this.keys['KeyA']||this.keys['ArrowLeft']) dx -= this.player.speed;
    if (this.keys['KeyD']||this.keys['ArrowRight']) dx += this.player.speed;
    const nx=this.player.x+dx, ny=this.player.y+dy;
    if (nx>=0 && nx+this.player.width<=this.warehouse.width) this.player.x=nx;
    if (ny>=0 && ny+this.player.height<=this.warehouse.height) this.player.y=ny;
  }

  // ---------- взаимодействия ----------
  checkInteractions(){
    this.nearInteractable=null;
    if (this.isNear(this.player, this.warehouse.computer)) this.nearInteractable='computer';
    this.warehouse.shelves.forEach((s,i)=>{ if (this.isNear(this.player,s)) this.nearInteractable={type:'shelf', index:i}; });

    const panel=this.getEl('interactionPanel');
    if (panel){
      if (this.nearInteractable){ panel.classList.remove('hidden'); this.updateInteractionPanel(); }
      else panel.classList.add('hidden');
    }
  }
  isNear(a,b,dist=90){
    const ax=a.x+a.width/2, ay=a.y+a.height/2, bx=b.x+b.width/2, by=b.y+b.height/2;
    return Math.hypot(bx-ax,by-ay) < dist;
  }
  updateInteractionPanel(){
    const c=this.getEl('interactionContent'); if(!c) return;
    if (this.nearInteractable==='computer'){
      c.innerHTML='<p>Нажмите E/Пробел, чтобы посмотреть заказ</p>';
    } else if (this.nearInteractable && this.nearInteractable.type==='shelf'){
      c.innerHTML='<p>Стеллаж рядом. E/Пробел — открыть</p><button id="openShelfBtn">Открыть</button>';
      const btn=this.getEl('openShelfBtn'); if (btn) btn.onclick=()=>this.enterShelfView(this.nearInteractable.index);
    } else c.innerHTML='';
  }

  // ТОГГЛ: E/Space
  handleInteraction(){
    if (this.inShelfView){ this.exitShelfView(); return; }
    if (this.nearInteractable==='computer') this.showOrderInfo();
    else if (this.nearInteractable && this.nearInteractable.type==='shelf') this.enterShelfView(this.nearInteractable.index);
  }

  showOrderInfo(){ this.updateOrderPanel(); }

  // ---------- полки ----------
  enterShelfView(index){
    console.log('[WareMover] enter shelf', index);
    this.inShelfView=true; this.currentShelf=index;

    if (this.canvas){
      this._onCanvasShelfClick = (e)=>this.handleShelfCanvasClick(e);
      this._onCanvasShelfContext = (e)=>{ e.preventDefault(); this.handleShelfRightClick(e); };
      this.canvas.addEventListener('click', this._onCanvasShelfClick);
      this.canvas.addEventListener('contextmenu', this._onCanvasShelfContext);
    }
    this.renderShelfView();
  }
  exitShelfView(){
    this.inShelfView=false; this.currentShelf=null;
    if (this.canvas && this._onCanvasShelfClick){
      this.canvas.removeEventListener('click', this._onCanvasShelfClick);
      this._onCanvasShelfClick=null;
    }
    if (this.canvas && this._onCanvasShelfContext){
      this.canvas.removeEventListener('contextmenu', this._onCanvasShelfContext);
      this._onCanvasShelfContext=null;
    }
  }

  // Клик по канвасу в режиме полки — учитываем только попадание в «уголок»
  handleShelfCanvasClick(e){
    if (!this.inShelfView) return;
    const r=this.canvas.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;

    // кнопка выхода
    if (x>=this.warehouse.width-100 && x<=this.warehouse.width-20 && y>=20 && y<=50){
      this.exitShelfView(); return;
    }

    const shelf=this.warehouse.shelves[this.currentShelf];
    const idx=this.getClickedItemIndex(x,y);
    if (idx===-1) return;

    // координаты карточки и "уголка"
    const sx=100, sy=100, w=150, h=100;
    const col=idx%4, row=Math.floor(idx/4);
    const cardX=sx+col*w, cardY=sy+row*h;

    const cornerX1 = cardX + w - this.cornerOffsetX;
    const cornerY1 = cardY + this.cornerOffsetY;
    const cornerX2 = cornerX1 + this.cornerW;
    const cornerY2 = cornerY1 + this.cornerH;

    // клик должен быть ИМЕННО по уголку
    const inCorner = x>=cornerX1 && x<=cornerX2 && y>=cornerY1 && y<=cornerY2;
    if (!inCorner) return;

    const shelfItem=shelf.items[idx];
    const orderItem=this.currentOrder?.items.find(oi=>oi.sku===shelfItem.sku);

    if (!orderItem){ this.totalErrors++; this.score-=10; this.updateOrderPanel(); this.updateHUD(); return; }
    if (orderItem.completed) return;

    // забираем всё из ячейки, но не больше остатка по заказу
    const remainingToPick = orderItem.requiredQuantity - orderItem.pickedQuantity;
    const take = Math.min(remainingToPick, shelfItem.quantity);
    if (take<=0) return;

    this.pickItem(shelfItem, take);
  }

  handleShelfRightClick(e){
    if (!this.inShelfView) return;
    const r=this.canvas.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const shelf=this.warehouse.shelves[this.currentShelf];
    const idx=this.getClickedItemIndex(x,y);
    if (idx===-1) return;
    this.returnItem(shelf.items[idx]);
  }

  getClickedItemIndex(x,y){
    const startX=100, startY=100, itemW=150, itemH=100;
    const col=Math.floor((x-startX)/itemW), row=Math.floor((y-startY)/itemH);
    return (col>=0&&col<4&&row>=0&&row<3) ? row*4+col : -1;
  }

  // Фактический перенос штук
  pickItem(shelfItem, amount=1){
    if (!this.currentOrder) return;
    const orderItem=this.currentOrder.items.find(oi=>oi.sku===shelfItem.sku);
    if (!orderItem){ this.totalErrors++; this.score-=10; this.updateOrderPanel(); this.updateHUD(); return; }

    const remainingToPick = orderItem.requiredQuantity - orderItem.pickedQuantity;
    const canTake = Math.min(amount, remainingToPick, shelfItem.quantity);
    if (canTake<=0) return;

    shelfItem.quantity -= canTake;
    orderItem.pickedQuantity += canTake;
    this.score += 10 * canTake;

    if (!orderItem.completed && orderItem.pickedQuantity >= orderItem.requiredQuantity){
      orderItem.completed = true;
      this.score += 50;
    }

    this.updateOrderPanel();
    this.updateHUD();
  }

  returnItem(shelfItem){
    if (!this.currentOrder) return;
    const orderItem=this.currentOrder.items.find(oi=>oi.sku===shelfItem.sku);
    if (orderItem && orderItem.pickedQuantity>0){
      orderItem.pickedQuantity--; shelfItem.quantity++;
      orderItem.completed = orderItem.pickedQuantity >= orderItem.requiredQuantity;
      this.score -= 5;
      this.updateOrderPanel(); this.updateHUD();
    }
  }

  isOrderCompleted(){ return !!this.currentOrder && this.currentOrder.items.every(i=>i.completed); }

  // ---------- HUD/UI ----------
  updateHUD(){
    const names={pickByList:'Pick-by-List',pickByVoice:'Pick-by-Voice',pickByLight:'Pick-by-Light',pickByVision:'Pick-by-Vision'};
    this.getEl('score')&&(this.getEl('score').textContent=this.score);
    this.getEl('time')&&(this.getEl('time').textContent=this.formatTime(this.gameTime));
    this.getEl('currentMethod')&&(this.getEl('currentMethod').textContent=names[this.pickingMethod]||'');
    if (!this.currentOrder) return;
    const done=this.currentOrder.items.filter(i=>i.completed).length;
    this.getEl('currentItem')&&(this.getEl('currentItem').textContent=done);
    this.getEl('totalItems')&&(this.getEl('totalItems').textContent=this.currentOrder.items.length);
  }

  updateOrderPanel(){
    const cont=this.getEl('orderList'); if(!cont||!this.currentOrder) return;
    cont.innerHTML='';
    this.currentOrder.items.forEach(item=>{
      const div=document.createElement('div');
      div.className='order-item';
      if (item.completed) div.classList.add('completed');
      else if (item.pickedQuantity>0) div.classList.add('current');
      div.innerHTML=`<span>${item.name}</span><span>${item.pickedQuantity}/${item.requiredQuantity}</span>`;
      cont.appendChild(div);
    });
  }

  formatTime(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60; return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`; }

  // ---------- завершение/пауза ----------
  togglePause(){ if (this.gameState==='playing'){ this.gameState='paused'; } else if (this.gameState==='paused'){ this.gameState='playing'; this.gameLoop(); } }
  endGame(){ this.gameState='results'; this.ordersCompleted=(this.gameMode==='marathon' ? (this.isOrderCompleted()?1:0) : 1); this.showResults(); }
  showResults(){
    const set=(id,v)=>{ const h=this.getEl(id); if(!h) return; const s=h.querySelector('span')||h; s.textContent=v; };
    set('finalScore',this.score); set('finalTime',this.formatTime(this.gameTime));
    const acc=this.totalErrors===0?100:Math.max(0,100-(this.totalErrors*10));
    set('accuracy',`${acc}%`); set('ordersCompleted',this.ordersCompleted);
    this.showScreen('resultsScreen');
  }

  // ---------- рендер ----------
  render(){
    if (!this.ctx) return;
    this.ctx.fillStyle='#34495e'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
    if (this.inShelfView) this.renderShelfView(); else this.renderWarehouse();
  }

  renderWarehouse(){
    // полки
    this.ctx.fillStyle='#8b4513';
    this.warehouse.shelves.forEach(s=>this.ctx.fillRect(s.x,s.y,s.width,s.height));

    // подсветка активной полки
    if (this.nearInteractable && this.nearInteractable.type==='shelf'){
      const s=this.warehouse.shelves[this.nearInteractable.index];
      this.ctx.strokeStyle='rgba(241,196,15,.95)'; this.ctx.lineWidth=3;
      this.ctx.strokeRect(s.x-3,s.y-3,s.width+6,s.height+6);
    }

    // компьютер
    this.ctx.fillStyle='#2c3e50';
    this.ctx.fillRect(this.warehouse.computer.x,this.warehouse.computer.y,this.warehouse.computer.width,this.warehouse.computer.height);

    // игрок
    this.ctx.fillStyle='#e74c3c';
    this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);

    // индикатор "E"
    if (this.nearInteractable){
      this.ctx.fillStyle='rgba(241,196,15,.9)'; this.ctx.font='16px Arial';
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

    // сетка 4x3
    const shelf=this.warehouse.shelves[this.currentShelf];
    const sx=100, sy=100, w=150, h=100;

    shelf.items.forEach((it,i)=>{
      const col=i%4, row=Math.floor(i/4);
      const x=sx+col*w, y=sy+row*h;

      // карточка
      this.ctx.fillStyle='#ecf0f1';
      this.ctx.fillRect(x,y,w-10,h-10);

      this.ctx.fillStyle='#2c3e50'; this.ctx.font='14px Arial';
      this.ctx.fillText(it.name, x+10, y+25);
      this.ctx.fillText(`Кол-во: ${it.quantity}`, x+10, y+45);

      const o=this.currentOrder?.items.find(oi=>oi.sku===it.sku);
      if (o) this.ctx.fillText(`Собрано: ${o.pickedQuantity}/${o.requiredQuantity}`, x+10, y+65);

      // --- уголок: кликабельная зона ---
      const remaining = o ? (o.requiredQuantity - o.pickedQuantity) : 0;

      if (o?.completed){
        // зелёный уголок = позиция заказа закрыта
        this.ctx.fillStyle='rgba(46,204,113,0.8)';
        this.ctx.fillRect(x + w - this.cornerOffsetX, y + this.cornerOffsetY, this.cornerW, this.cornerH);
        this.ctx.fillStyle='#fff'; this.ctx.font='12px Arial';
        this.ctx.fillText('✔', x + w - this.cornerOffsetX + 7, y + this.cornerOffsetY + 15);
      } else if (it.quantity>0 && remaining>0){
        // красный уголок с "+N", где N = сколько возьмётся
        const take = Math.min(it.quantity, remaining);
        this.ctx.fillStyle='#c0392b';
        this.ctx.fillRect(x + w - this.cornerOffsetX, y + this.cornerOffsetY, this.cornerW, this.cornerH);
        this.ctx.fillStyle='#fff'; this.ctx.font='12px Arial';
        this.ctx.fillText('+'+take, x + w - this.cornerOffsetX + 2, y + this.cornerOffsetY + 15);
      } else {
        // серый уголок = пусто/не требуется
        this.ctx.fillStyle='rgba(0,0,0,0.3)';
        this.ctx.fillRect(x + w - this.cornerOffsetX, y + this.cornerOffsetY, this.cornerW, this.cornerH);
        this.ctx.fillStyle='#fff'; this.ctx.font='11px Arial';
        this.ctx.fillText('-', x + w - this.cornerOffsetX + 9, y + this.cornerOffsetY + 15);
      }

      // визуальная подсветка уголка при наведении
      if (this.mousePos){
        const cx1 = x + w - this.cornerOffsetX;
        const cy1 = y + this.cornerOffsetY;
        const cx2 = cx1 + this.cornerW;
        const cy2 = cy1 + this.cornerH;
        const over = this.mousePos.x>=cx1 && this.mousePos.x<=cx2 && this.mousePos.y>=cy1 && this.mousePos.y<=cy2;
        if (over){
          this.ctx.strokeStyle='rgba(241,196,15,0.9)';
          this.ctx.lineWidth=2;
          this.ctx.strokeRect(cx1-1, cy1-1, this.cornerW+2, this.cornerH+2);
        }
      }

      // Полезные оверлеи
      if (o?.completed){
        this.ctx.fillStyle='rgba(46,204,113,0.25)'; this.ctx.fillRect(x,y,w-10,h-10);
        this.ctx.fillStyle='#fff'; this.ctx.font='bold 14px Arial'; this.ctx.fillText('Готово', x+10, y+85);
      } else if (it.quantity===0){
        this.ctx.fillStyle='rgba(0,0,0,0.2)'; this.ctx.fillRect(x,y,w-10,h-10);
        this.ctx.fillStyle='#fff'; this.ctx.font='bold 14px Arial'; this.ctx.fillText('Пусто', x+10, y+85);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  window.game = new WareMoverGame();
  console.log('WareMover game loaded successfully');
});
