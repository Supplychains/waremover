// Глобальный лог ошибок
window.addEventListener('error', e => {
  console.error('[WareMover ERROR]', e.message, e.filename, e.lineno, e.colno);
});

class WareMoverGame {
  constructor(){
    this.canvas=null; this.ctx=null;

    this.gameState='menu';
    this.gameMode='quickOrder';
    this.pickingMethod='pickByList';

    this.score=0; this.startTime=0; this.gameTime=0;
    this.currentOrder=null; this.ordersCompleted=0; this.totalErrors=0;

    this.player={x:100,y:100,width:32,height:32,speed:3};
    this.warehouse={width:800,height:600,shelves:[],computer:{x:50,y:50,width:60,height:40}};

    this.keys={}; this.mousePos={x:0,y:0};
    this.nearInteractable=null; this.inShelfView=false; this.currentShelf=null;

    // обработчики полки
    this._onCanvasShelfClick=null;
    this._onCanvasShelfTouch=null;
    this._onCanvasShelfContext=null;

    // скоринг
    this.SECONDS_PER_UNIT=2.5;
    this.WEIGHT_COMPLETION=0.6;
    this.WEIGHT_TIME=0.25;
    this.WEIGHT_SHELF=0.15;

    // метрики по стеллажам
    this.uniqueShelvesOpened=new Set();
    this.totalShelfOpens=0;
    this.relevantShelfOpens=0;

    // уголок «+»
    this.cornerW=28;
    this.cornerH=24;
    this.cornerHitSlop=8;
    this.cornerOffsetX=35;
    this.cornerOffsetY=5;

    // auth-минимум (можно убрать если не используешь)
    this.auth={currentUser:{login:'guest'}};

    this.init();
  }

  init(){
    this.setupEventListeners();
    this.initializeWarehouse();
    this.showScreen('mainMenu');
  }

  getEl(id){ return document.getElementById(id); }

  setupEventListeners(){
    this.getEl('startGameBtn')?.addEventListener('click',()=>this.startGame());
    this.getEl('helpBtn')?.addEventListener('click',()=>this.showScreen('helpScreen'));
    this.getEl('backFromHelpBtn')?.addEventListener('click',()=>this.showScreen('mainMenu'));
    this.getEl('playAgainBtn')?.addEventListener('click',()=>this.startGame());
    this.getEl('backToMainBtn')?.addEventListener('click',()=>this.showScreen('mainMenu'));
    this.getEl('pauseBtn')?.addEventListener('click',()=>this.togglePause());
    this.getEl('exitToMenuBtn')?.addEventListener('click',()=>{this.gameState='menu';this.showScreen('mainMenu');});

    document.addEventListener('keydown',(e)=>{
      this.keys[e.code]=true;
      const interact=(e.code==='KeyE')||(e.code==='Space')||(e.key===' ');
      if(interact && this.gameState==='playing'){ e.preventDefault(); this.handleInteraction(); }
      if(e.code==='Escape' && this.gameState==='playing') this.togglePause();
    },{capture:true});
    document.addEventListener('keyup',(e)=>{ this.keys[e.code]=false; });

    document.addEventListener('mousemove',(e)=>{
      if(!this.canvas) return;
      const r=this.canvas.getBoundingClientRect();
      const sx=this.canvas.width/r.width, sy=this.canvas.height/r.height;
      this.mousePos.x=(e.clientX-r.left)*sx;
      this.mousePos.y=(e.clientY-r.top)*sy;
    });

    this.getEl('gameCanvas')?.addEventListener('click',(e)=>{
      if(this.gameState!=='playing' || this.inShelfView || !this.canvas) return;
      const {x,y}=this._pointerXY(e);
      const idx=this.warehouse.shelves.findIndex(s=>x>=s.x&&x<=s.x+s.width&&y>=s.y&&y<=s.y+s.height);
      if(idx>=0) this.enterShelfView(idx);
    });
  }

  showScreen(screenId){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    this.getEl(screenId)?.classList.add('active');

    if(screenId==='gameScreen'){
      this.canvas=this.getEl('gameCanvas');
      this.canvas.width=this.warehouse.width;
      this.canvas.height=this.warehouse.height;
      this.ctx=this.canvas.getContext('2d');
      this.canvas.tabIndex=0; this.canvas.focus();
      this.canvas.style.touchAction='none';
      this.gameState='playing';
      this.gameLoop();
    } else {
      this.exitShelfView();
    }
  }

  _pointerXY(e){
    if(!this.canvas) return {x:0,y:0};
    const rect=this.canvas.getBoundingClientRect();
    const sx=this.canvas.width/rect.width, sy=this.canvas.height/rect.height;
    const cx=(e.touches&&e.touches[0])?e.touches[0].clientX:e.clientX;
    const cy=(e.touches&&e.touches[0])?e.touches[0].clientY:e.clientY;
    return {x:(cx-rect.left)*sx, y:(cy-rect.top)*sy};
  }

  // --- склад ---
  initializeWarehouse(){
    this.warehouse.shelves=[
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
  shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  generateShelfItems(){
    // 12 товаров со SKU 1..12, случайный порядок на КАЖДОМ стеллаже
    const items=[];
    for(let p=0;p<12;p++){
      const sku=p+1;
      items.push({id:`item_${Math.random().toString(36).slice(2,11)}`, sku, name:`Товар ${sku}`, quantity:Math.floor(Math.random()*5), position:p});
    }
    return this.shuffle(items);
  }

  // --- заказ ---
  generateOrder(){
    const all=Array.from({length:12},(_,i)=>i+1);
    this.shuffle(all);
    const chosen=all.slice(0,8);
    const items=chosen.map(sku=>({sku,name:`Товар ${sku}`,requiredQuantity:Math.floor(Math.random()*4)+9,pickedQuantity:0,completed:false}));
    return {id:`order_${Date.now()}`,items,totalItems:items.reduce((s,i)=>s+i.requiredQuantity,0),completedItems:0};
  }

  // --- запуск ---
  startGame(){
    if(!this.auth.currentUser){ this.showScreen('mainMenu'); return; }
    this.score=0; this.startTime=Date.now(); this.gameTime=0; this.ordersCompleted=0; this.totalErrors=0;
    this.currentOrder=this.generateOrder();
    this.player.x=100; this.player.y=100;

    this.uniqueShelvesOpened.clear(); this.totalShelfOpens=0; this.relevantShelfOpens=0;

    this.updateHUD(); this.updateOrderPanel();
    this.showScreen('gameScreen');
  }
  gameLoop(){ if(this.gameState!=='playing') return; this.update(); this.render(); requestAnimationFrame(()=>this.gameLoop()); }

  update(){
    if(this.gameState!=='playing') return;
    this.gameTime=Date.now()-this.startTime;
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();
    if(this.gameMode==='marathon' && this.gameTime>=90000) this.endGame();
    else if(this.gameMode==='quickOrder' && this.isOrderCompleted()) this.endGame();
  }
  updatePlayer(){
    if(this.inShelfView) return;
    let dx=0,dy=0;
    if(this.keys['KeyW']||this.keys['ArrowUp']) dy-=this.player.speed;
    if(this.keys['KeyS']||this.keys['ArrowDown']) dy+=this.player.speed;
    if(this.keys['KeyA']||this.keys['ArrowLeft']) dx-=this.player.speed;
    if(this.keys['KeyD']||this.keys['ArrowRight']) dx+=this.player.speed;
    const nx=this.player.x+dx, ny=this.player.y+dy;
    if(nx>=0 && nx+this.player.width<=this.warehouse.width) this.player.x=nx;
    if(ny>=0 && ny+this.player.height<=this.warehouse.height) this.player.y=ny;
  }

  // --- взаимодействия ---
  checkInteractions(){
    this.nearInteractable=null;
    if(this.isNear(this.player,this.warehouse.computer)) this.nearInteractable='computer';
    this.warehouse.shelves.forEach((s,i)=>{ if(this.isNear(this.player,s)) this.nearInteractable={type:'shelf',index:i}; });
    const panel=this.getEl('interactionPanel');
    if(panel){ if(this.nearInteractable){ panel.classList.remove('hidden'); this.updateInteractionPanel(); } else panel.classList.add('hidden'); }
  }
  isNear(a,b,dist=90){
    const ax=a.x+a.width/2, ay=a.y+a.height/2, bx=b.x+b.width/2, by=b.y+b.height/2;
    return Math.hypot(bx-ax,by-ay)<dist;
  }
  updateInteractionPanel(){
    const c=this.getEl('interactionContent'); if(!c) return;
    if(this.nearInteractable==='computer') c.innerHTML='<p>Нажмите E/Пробел, чтобы посмотреть заказ</p>';
    else if(this.nearInteractable && this.nearInteractable.type==='shelf') c.innerHTML='<p>Стеллаж рядом. E/Пробел — открыть</p>';
    else c.innerHTML='';
  }
  handleInteraction(){
    if(this.inShelfView){ this.exitShelfView(); return; }
    if(this.nearInteractable==='computer') this.showOrderInfo();
    else if(this.nearInteractable && this.nearInteractable.type==='shelf') this.enterShelfView(this.nearInteractable.index);
  }
  showOrderInfo(){ this.updateOrderPanel(); }

  // --- полки ---
  enterShelfView(index){
    this.inShelfView=true; this.currentShelf=index;

    // учёт открытий
    this.totalShelfOpens++; this.uniqueShelvesOpened.add(index);
    const shelf=this.warehouse.shelves[index];
    const orderSkus=new Set(this.currentOrder.items.map(i=>i.sku));
    if(shelf.items.some(it=>orderSkus.has(it.sku))) this.relevantShelfOpens++;

    if(this.canvas){
      this._onCanvasShelfClick=(e)=>this.handleShelfCanvasPointer(e);
      this._onCanvasShelfTouch=(e)=>{ e.preventDefault(); this.handleShelfCanvasPointer(e); };
      this._onCanvasShelfContext=(e)=>e.preventDefault();
      this.canvas.addEventListener('click',this._onCanvasShelfClick);
      this.canvas.addEventListener('touchstart',this._onCanvasShelfTouch,{passive:false});
      this.canvas.addEventListener('contextmenu',this._onCanvasShelfContext);
    }
    this.renderShelfView();
  }
  exitShelfView(){
    this.inShelfView=false; this.currentShelf=null;
    if(this.canvas && this._onCanvasShelfClick){ this.canvas.removeEventListener('click',this._onCanvasShelfClick); this._onCanvasShelfClick=null; }
    if(this.canvas && this._onCanvasShelfTouch){ this.canvas.removeEventListener('touchstart',this._onCanvasShelfTouch); this._onCanvasShelfTouch=null; }
    if(this.canvas && this._onCanvasShelfContext){ this.canvas.removeEventListener('contextmenu',this._onCanvasShelfContext); this._onCanvasShelfContext=null; }
  }

  handleShelfCanvasPointer(e){
    if(!this.inShelfView) return;
    const {x,y}=this._pointerXY(e);

    // кнопка выхода
    if(x>=this.warehouse.width-100 && x<=this.warehouse.width-20 && y>=20 && y<=50){ this.exitShelfView(); return; }

    const idx=this.getClickedItemIndex(x,y);
    if(idx===-1) return;

    // зона уголка (всегда активная)
    const sx=100, sy=100, w=150, h=100;
    const col=idx%4, row=Math.floor(idx/4);
    const cardX=sx+col*w, cardY=sy+row*h;

    const cx1=cardX+w-this.cornerOffsetX;
    const cy1=cardY+this.cornerOffsetY;
    const cx2=cx1+this.cornerW;
    const cy2=cy1+this.cornerH;
    const hs=this.cornerHitSlop;
    const inCorner=(x>=cx1-hs && x<=cx2+hs && y>=cy1-hs && y<=cy2+hs);
    if(!inCorner) return;

    const shelf=this.warehouse.shelves[this.currentShelf];
    const shelfItem=shelf.items[idx];
    const orderItem=this.currentOrder?.items.find(oi=>oi.sku===shelfItem.sku);

    // если товара нет в заказе — это ошибка, но клик разрешён
    if(!orderItem){ this.totalErrors++; this.score-=10; this.updateOrderPanel(); this.updateHUD(); return; }
    if(orderItem.completed) return;

    // забираем столько, сколько можем (до остатка по заказу и наличию)
    const remaining=orderItem.requiredQuantity-orderItem.pickedQuantity;
    const take=Math.min(remaining, shelfItem.quantity);
    if(take<=0) return;

    this.pickItem(shelfItem,take);
  }

  getClickedItemIndex(x,y){
    const startX=100,startY=100,itemW=150,itemH=100;
    const col=Math.floor((x-startX)/itemW), row=Math.floor((y-startY)/itemH);
    return (col>=0&&col<4&&row>=0&&row<3)? row*4+col : -1;
  }

  pickItem(shelfItem,amount=1){
    if(!this.currentOrder) return;
    const orderItem=this.currentOrder.items.find(oi=>oi.sku===shelfItem.sku);
    if(!orderItem){ this.totalErrors++; this.score-=10; this.updateOrderPanel(); this.updateHUD(); return; }

    const remaining=orderItem.requiredQuantity-orderItem.pickedQuantity;
    const canTake=Math.min(amount, remaining, shelfItem.quantity);
    if(canTake<=0) return;

    shelfItem.quantity-=canTake;
    orderItem.pickedQuantity+=canTake;
    this.score+=10*canTake;

    if(!orderItem.completed && orderItem.pickedQuantity>=orderItem.requiredQuantity){
      orderItem.completed=true; this.score+=50;
    }

    this.updateOrderPanel(); this.updateHUD();
  }

  returnItem(shelfItem){
    if(!this.currentOrder) return;
    const orderItem=this.currentOrder.items.find(oi=>oi.sku===shelfItem.sku);
    if(orderItem && orderItem.pickedQuantity>0){
      orderItem.pickedQuantity--; shelfItem.quantity++;
      orderItem.completed=orderItem.pickedQuantity>=orderItem.requiredQuantity;
      this.score-=5;
      this.updateOrderPanel(); this.updateHUD();
    }
  }

  isOrderCompleted(){ return !!this.currentOrder && this.currentOrder.items.every(i=>i.completed); }

  // --- метрики ---
  calculateCompletion(){ if(!this.currentOrder) return 0; const tr=this.currentOrder.items.reduce((s,i)=>s+i.requiredQuantity,0)||1; const tp=this.currentOrder.items.reduce((s,i)=>s+i.pickedQuantity,0); return Math.min(1,tp/tr); }
  calculateTimeEfficiency(){ if(!this.currentOrder) return 0; const tr=this.currentOrder.items.reduce((s,i)=>s+i.requiredQuantity,0); const t=Math.max(1,Math.floor(this.gameTime/1000)); const par=Math.max(1,Math.round(tr*this.SECONDS_PER_UNIT)); const eff=par/t; return Math.max(0,Math.min(1,eff)); }
  getRequiredShelvesSet(){ const skus=new Set(this.currentOrder.items.map(i=>i.sku)); const set=new Set(); this.warehouse.shelves.forEach((s,idx)=>{ if(s.items.some(it=>skus.has(it.sku))) set.add(idx); }); return set; }
  calculateShelfEfficiency(){ const req=this.getRequiredShelvesSet().size||1; const open=this.uniqueShelvesOpened.size||1; return Math.max(0,Math.min(1,req/open)); }
  calculateShelfPrecision(){ const eff=this.relevantShelfOpens/Math.max(1,this.totalShelfOpens); return Math.max(0,Math.min(1,eff)); }
  calculateShelfComposite(){ return this.calculateShelfEfficiency()*0.6 + this.calculateShelfPrecision()*0.4; }
  calculateFinalPercent(){ const c=this.calculateCompletion(), t=this.calculateTimeEfficiency(), s=this.calculateShelfComposite(); return Math.round((this.WEIGHT_COMPLETION*c + this.WEIGHT_TIME*t + this.WEIGHT_SHELF*s)*100); }

  // --- UI/HUD ---
  updateHUD(){
    this.getEl('score')&&(this.getEl('score').textContent=this.score);
    this.getEl('time')&&(this.getEl('time').textContent=this.formatTime(this.gameTime));
    this.getEl('currentMethod')&&(this.getEl('currentMethod').textContent='Pick-by-List');
    if(!this.currentOrder) return;
    const done=this.currentOrder.items.filter(i=>i.completed).length;
    this.getEl('currentItem')&&(this.getEl('currentItem').textContent=done);
    this.getEl('totalItems')&&(this.getEl('totalItems').textContent=this.currentOrder.items.length);
  }
  updateOrderPanel(){
    const cont=this.getEl('orderList'); if(!cont||!this.currentOrder) return; cont.innerHTML='';
    this.currentOrder.items.forEach(item=>{
      const d=document.createElement('div'); d.className='order-item';
      if(item.completed) d.classList.add('completed'); else if(item.pickedQuantity>0) d.classList.add('current');
      d.innerHTML=`<span>${item.name}</span><span>${item.pickedQuantity}/${item.requiredQuantity}</span>`;
      cont.appendChild(d);
    });
  }
  formatTime(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60; return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`; }

  togglePause(){ if(this.gameState==='playing'){ this.gameState='paused'; } else if(this.gameState==='paused'){ this.gameState='playing'; this.gameLoop(); } }
  endGame(){ this.gameState='results'; this.ordersCompleted=(this.gameMode==='marathon'?(this.isOrderCompleted()?1:0):1); this.showResults(); }
  showResults(){
    const set=(id,v)=>{ const h=this.getEl(id); if(!h) return; const s=h.querySelector('span')||h; s.textContent=v; };
    set('finalScore',this.score);
    set('finalTime',this.formatTime(this.gameTime));
    const acc=this.totalErrors===0?100:Math.max(0,100-(this.totalErrors*10));
    set('accuracy',`${acc}%`);
    set('ordersCompleted',this.ordersCompleted);
    set('completionPercent',Math.round(this.calculateCompletion()*100)+'%');
    set('timeEfficiency',Math.round(this.calculateTimeEfficiency()*100)+'%');
    set('shelfEff',Math.round(this.calculateShelfComposite()*100)+'%');
    set('finalPercent',this.calculateFinalPercent()+'%');
    this.showScreen('resultsScreen');
  }

  render(){
    if(!this.ctx) return;
    this.ctx.fillStyle='#34495e'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
    if(this.inShelfView) this.renderShelfView(); else this.renderWarehouse();
  }
  renderWarehouse(){
    this.ctx.fillStyle='#8b4513'; this.warehouse.shelves.forEach(s=>this.ctx.fillRect(s.x,s.y,s.width,s.height));
    if(this.nearInteractable && this.nearInteractable.type==='shelf'){
      const s=this.warehouse.shelves[this.nearInteractable.index];
      this.ctx.strokeStyle='rgba(241,196,15,.95)'; this.ctx.lineWidth=3; this.ctx.strokeRect(s.x-3,s.y-3,s.width+6,s.height+6);
    }
    this.ctx.fillStyle='#2c3e50'; this.ctx.fillRect(this.warehouse.computer.x,this.warehouse.computer.y,this.warehouse.computer.width,this.warehouse.computer.height);
    this.ctx.fillStyle='#e74c3c'; this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);
    if(this.nearInteractable){ this.ctx.fillStyle='rgba(241,196,15,.9)'; this.ctx.font='16px Arial'; this.ctx.fillText('E', this.player.x+this.player.width+10, this.player.y+20); }
  }
  renderShelfView(){
    this.ctx.fillStyle='#2c3e50'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
    this.ctx.fillStyle='#fff'; this.ctx.font='24px Arial'; this.ctx.fillText(`Стеллаж ${this.currentShelf+1}`,20,40);

    // кнопка выхода
    this.ctx.fillStyle='#e74c3c'; this.ctx.fillRect(this.warehouse.width-100,20,80,30);
    this.ctx.fillStyle='#fff'; this.ctx.font='16px Arial'; this.ctx.fillText('Выход (E)', this.warehouse.width-95, 40);

    const shelf=this.warehouse.shelves[this.currentShelf];
    const sx=100, sy=100, w=150, h=100;

    shelf.items.forEach((it,i)=>{
      const col=i%4, row=Math.floor(i/4), x=sx+col*w, y=sy+row*h;

      // карточка (везде одинаковая)
      this.ctx.fillStyle='#ecf0f1'; this.ctx.fillRect(x,y,w-10,h-10);
      this.ctx.fillStyle='#2c3e50'; this.ctx.font='14px Arial';
      this.ctx.fillText(it.name, x+10, y+25);
      this.ctx.fillText(`Кол-во: ${it.quantity}`, x+10, y+45);

      const o=this.currentOrder?.items.find(oi=>oi.sku===it.sku);
      if(o) this.ctx.fillText(`Собрано: ${o.pickedQuantity}/${o.requiredQuantity}`, x+10, y+65);

      // одинаковый уголок «+» на ВСЕХ ячейках
      this.ctx.fillStyle='#c0392b';
      this.ctx.fillRect(x + w - this.cornerOffsetX, y + this.cornerOffsetY, this.cornerW, this.cornerH);
      this.ctx.fillStyle='#fff'; this.ctx.font='bold 14px Arial';
      this.ctx.fillText('+', x + w - this.cornerOffsetX + 9, y + this.cornerOffsetY + 15);

      // подсветка уголка при наведении (десктоп)
      if(this.mousePos){
        const cx1=x+w-this.cornerOffsetX, cy1=y+this.cornerOffsetY, cx2=cx1+this.cornerW, cy2=cy1+this.cornerH;
        const over=this.mousePos.x>=cx1 && this.mousePos.x<=cx2 && this.mousePos.y>=cy1 && this.mousePos.y<=cy2;
        if(over){ this.ctx.strokeStyle='rgba(241,196,15,0.9)'; this.ctx.lineWidth=2; this.ctx.strokeRect(cx1-1,cy1-1,this.cornerW+2,this.cornerH+2); }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  window.game=new WareMoverGame();
  console.log('WareMover game loaded');
});
