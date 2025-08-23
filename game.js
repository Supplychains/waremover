// Глобальный лог ошибок — сразу видно, если что-то падает до переключения экранов
window.addEventListener('error', e => {
  console.error('[WareMover ERROR]', e.message, e.filename, e.lineno, e.colno);
});

class WareMoverGame {
  constructor(){
    this.canvas=null; this.ctx=null;
    this.gameState='menu'; this.gameMode=null; this.pickingMethod=null;
    this.score=0; this.startTime=0; this.gameTime=0; this.currentOrder=null; this.ordersCompleted=0; this.totalErrors=0;
    this.player={x:100,y:100,width:32,height:32,speed:3};
    this.warehouse={width:800,height:600,shelves:[],computer:{x:50,y:50,width:60,height:40}};
    this.keys={}; this.mousePos={x:0,y:0};
    this.nearInteractable=null; this.inShelfView=false; this.currentShelf=null;
    this.init();
  }

  init(){
    // проверим что экраны есть
    console.log('[WareMover] init. screens=', document.querySelectorAll('.screen').length);
    this.setupEventListeners();
    this.initializeWarehouse();
    this.showScreen('mainMenu');
  }

  getEl(id){ const el=document.getElementById(id); if(!el) console.warn('[WareMover] no element',id); return el; }

  setupEventListeners(){
    // меню
    this.getEl('startGameBtn')?.addEventListener('click',()=>this.showScreen('modeSelection'));
    this.getEl('settingsBtn')?.addEventListener('click',()=>alert('Настройки позже'));
    this.getEl('helpBtn')?.addEventListener('click',()=>this.showScreen('helpScreen'));
    // режим
    this.getEl('quickOrderBtn')?.addEventListener('click',()=>{this.gameMode='quickOrder';this.showScreen('pickingMethodSelection');});
    this.getEl('marathonBtn')?.addEventListener('click',()=>{this.gameMode='marathon';this.showScreen('pickingMethodSelection');});
    // методы
    this.getEl('pickByListBtn')?.addEventListener('click',()=>{this.pickingMethod='pickByList';this.startGame();});
    this.getEl('pickByVoiceBtn')?.addEventListener('click',()=>{this.pickingMethod='pickByVoice';this.startGame();});
    this.getEl('pickByLightBtn')?.addEventListener('click',()=>{this.pickingMethod='pickByLight';this.startGame();});
    this.getEl('pickByVisionBtn')?.addEventListener('click',()=>{this.pickingMethod='pickByVision';this.startGame();});
    // назад
    this.getEl('backToMenuBtn')?.addEventListener('click',()=>this.showScreen('mainMenu'));
    this.getEl('backToModeBtn')?.addEventListener('click',()=>this.showScreen('modeSelection'));
    this.getEl('backFromHelpBtn')?.addEventListener('click',()=>this.showScreen('mainMenu'));
    // результаты
    this.getEl('playAgainBtn')?.addEventListener('click',()=>this.showScreen('modeSelection'));
    this.getEl('backToMainBtn')?.addEventListener('click',()=>this.showScreen('mainMenu'));
    // пауза/выход
    this.getEl('pauseBtn')?.addEventListener('click',()=>this.togglePause());
    this.getEl('exitToMenuBtn')?.addEventListener('click',()=>{this.gameState='menu';this.showScreen('mainMenu');});

    // клавиатура
    document.addEventListener('keydown',(e)=>{
      this.keys[e.code]=true;
      const interact = (e.code==='KeyE') || (e.code==='Space') || (e.key===' ');
      if (interact && this.gameState==='playing'){ e.preventDefault(); this.handleInteraction(); }
      if (e.code==='Escape' && this.gameState==='playing') this.togglePause();
    });
    document.addEventListener('keyup',(e)=>{ this.keys[e.code]=false; });

    // мышь
    document.addEventListener('mousemove',(e)=>{
      const r=this.canvas?.getBoundingClientRect(); if(r){ this.mousePos.x=e.clientX-r.left; this.mousePos.y=e.clientY-r.top; }
    });

    // клик по полке в режиме склада (чтобы точно открывалось)
    this.getEl('gameCanvas')?.addEventListener('click',(e)=>{
      if (this.gameState!=='playing' || this.inShelfView) return;
      const r=this.canvas.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
      // если кликнули по прямоугольнику полки — открываем её
      const idx = this.warehouse.shelves.findIndex(s => x>=s.x && x<=s.x+s.width && y>=s.y && y<=s.y+s.height);
      if (idx>=0){ this.enterShelfView(idx); }
    });

    // клики внутри полки
    document.addEventListener('click',(e)=>{ if(this.inShelfView && this.gameState==='playing') this.handleShelfClick(e); });
    document.addEventListener('contextmenu',(e)=>{ if(this.inShelfView && this.gameState==='playing'){ e.preventDefault(); this.handleShelfRightClick(e);} });
  }

  showScreen(screenId){
    try{
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      const target=this.getEl(screenId);
      if(!target){ console.error('[WareMover] screen not found:',screenId); return; }
      target.classList.add('active');
      console.log('[WareMover] showScreen ->', screenId);

      if (screenId==='gameScreen'){
        this.canvas=this.getEl('gameCanvas');
        if(!this.canvas){ console.error('No canvas'); return; }
        this.canvas.width=this.warehouse.width; this.canvas.height=this.warehouse.height;
        this.ctx=this.canvas.getContext('2d');
        this.gameState='playing';
        this.gameLoop();
      } else {
        // выходим из режима полки при смене экрана
        this.inShelfView=false; this.currentShelf=null;
      }
    }catch(err){ console.error('[WareMover] showScreen error', err); }
  }

  // ----- склад -----
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
  generateShelfItems(){
    const a=[]; for(let p=0;p<12;p++){ const sku=p+1;
      a.push({id:`item_${Math.random().toString(36).slice(2,11)}`, sku, name:`Товар ${sku}`, quantity:Math.floor(Math.random()*5), position:p});
    } return a;
  }

  // ----- заказ -----
  generateOrder(){
    const all=Array.from({length:12},(_,i)=>i+1);
    for(let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
    const chosen=all.slice(0,8);
    const items=chosen.map(sku=>({sku, name:`Товар ${sku}`, requiredQuantity:Math.floor(Math.random()*4)+9, pickedQuantity:0, completed:false}));
    return { id:`order_${Date.now()}`, items, totalItems:items.reduce((s,i)=>s+i.requiredQuantity,0), completedItems:0 };
  }

  // ----- запуск/цикл -----
  startGame(){
    this.score=0; this.startTime=Date.now(); this.gameTime=0; this.ordersCompleted=0; this.totalErrors=0;
    this.currentOrder=this.generateOrder();
    this.player.x=100; this.player.y=100;
    this.updateHUD(); this.updateOrderPanel();
    this.showScreen('gameScreen');
  }
  gameLoop(){ if(this.gameState!=='playing') return; this.update(); this.render(); requestAnimationFrame(()=>this.gameLoop()); }

  // ----- update -----
  update(){
    if(this.gameState!=='playing') return;
    this.gameTime=Date.now()-this.startTime;
    this.updatePlayer();
    this.checkInteractions();
    this.updateHUD();
    if (this.gameMode==='marathon' && this.gameTime>=90000) this.endGame();
    else if (this.gameMode==='quickOrder' && this.isOrderCompleted()) this.endGame();
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

  // ----- взаимодействия -----
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
    if(this.nearInteractable==='computer'){
      c.innerHTML='<p>Нажмите E/Пробел, чтобы посмотреть заказ</p>';
    } else if (this.nearInteractable && this.nearInteractable.type==='shelf'){
      c.innerHTML='<p>Стеллаж рядом. E/Пробел — открыть</p><button id="openShelfBtn">Открыть</button>';
      this.getEl('openShelfBtn')?.addEventListener('click',()=>this.enterShelfView(this.nearInteractable.index));
    } else c.innerHTML='';
  }
  handleInteraction(){
    if(this.nearInteractable==='computer') this.showOrderInfo();
    else if(this.nearInteractable && this.nearInteractable.type==='shelf') this.enterShelfView(this.nearInteractable.index);
    else if(!this.inShelfView && this.currentShelf!==null) this.enterShelfView(this.currentShelf);
  }
  showOrderInfo(){ this.updateOrderPanel(); }

  // ----- полки -----
  enterShelfView(i){ console.log('[WareMover] enter shelf', i); this.inShelfView=true; this.currentShelf=i; this.renderShelfView(); }
  exitShelfView(){ this.inShelfView=false; this.currentShelf=null; }
  handleShelfClick(e){
    const r=this.canvas.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    if(x>=this.warehouse.width-100 && x<=this.warehouse.width-20 && y>=20 && y<=50){ this.exitShelfView(); return; }
    const shelf=this.warehouse.shelves[this.currentShelf]; const idx=this.getClickedItemIndex(x,y);
    if(idx!==-1) this.pickItem(shelf.items[idx]);
  }
  handleShelfRightClick(e){
    const r=this.canvas.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    const shelf=this.warehouse.shelves[this.currentShelf]; const idx=this.getClickedItemIndex(x,y);
    if(idx!==-1) this.returnItem(shelf.items[idx]);
  }
  getClickedItemIndex(x,y){ const sx=100, sy=100, w=150, h=100; const c=Math.floor((x-sx)/w), r=Math.floor((y-sy)/h); return (c>=0&&c<4&&r>=0&&r<3) ? r*4+c : -1; }

  // подбор по SKU
  pickItem(sItem){
    if(!this.currentOrder) return;
    const oItem=this.currentOrder.items.find(oi=>oi.sku===sItem.sku);
    if(!oItem){ this.totalErrors++; this.score-=10; this.updateOrderPanel(); this.updateHUD(); return; }
    if(oItem.completed){ this.totalErrors++; this.score-=5; this.updateHUD(); return; }
    if(sItem.quantity<=0){ this.totalErrors++; this.score-=3; this.updateHUD(); return; }
    sItem.quantity--; oItem.pickedQuantity++; this.score+=10;
    if(oItem.pickedQuantity>=oItem.requiredQuantity){ oItem.completed=true; this.score+=50; }
    this.updateOrderPanel(); this.updateHUD();
  }
  returnItem(sItem){
    if(!this.currentOrder) return;
    const oItem=this.currentOrder.items.find(oi=>oi.sku===sItem.sku);
    if(oItem && oItem.pickedQuantity>0){ oItem.pickedQuantity--; sItem.quantity++; oItem.completed=oItem.pickedQuantity>=oItem.requiredQuantity; this.score-=5; }
    this.updateOrderPanel(); this.updateHUD();
  }
  isOrderCompleted(){ return !!this.currentOrder && this.currentOrder.items.every(i=>i.completed); }

  // ----- UI/HUD -----
  updateHUD(){
    this.getEl('score')&&(this.getEl('score').textContent=this.score);
    this.getEl('time')&&(this.getEl('time').textContent=this.formatTime(this.gameTime));
    const names={pickByList:'Pick-by-List',pickByVoice:'Pick-by-Voice',pickByLight:'Pick-by-Light',pickByVision:'Pick-by-Vision'};
    this.getEl('currentMethod')&&(this.getEl('currentMethod').textContent=names[this.pickingMethod]||'');
    if(!this.currentOrder) return;
    const done=this.currentOrder.items.filter(i=>i.completed).length;
    this.getEl('currentItem')&&(this.getEl('currentItem').textContent=done);
    this.getEl('totalItems')&&(this.getEl('totalItems').textContent=this.currentOrder.items.length);
  }
  updateOrderPanel(){
    const c=this.getEl('orderList'); if(!c||!this.currentOrder) return; c.innerHTML='';
    this.currentOrder.items.forEach(it=>{
      const d=document.createElement('div'); d.className='order-item';
      if(it.completed) d.classList.add('completed'); else if(it.pickedQuantity>0) d.classList.add('current');
      d.innerHTML=`<span>${it.name}</span><span>${it.pickedQuantity}/${it.requiredQuantity}</span>`;
      c.appendChild(d);
    });
  }
  formatTime(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60), r=s%60; return `${m.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`; }

  // ----- завершение/пауза -----
  togglePause(){ if(this.gameState==='playing'){ this.gameState='paused'; } else if(this.gameState==='paused'){ this.gameState='playing'; this.gameLoop(); } }
  endGame(){ this.gameState='results'; this.ordersCompleted=(this.gameMode==='marathon' ? (this.isOrderCompleted()?1:0) : 1); this.showResults(); }
  showResults(){
    const set=(id,v)=>{const h=this.getEl(id); if(!h) return; const s=h.querySelector('span')||h; s.textContent=v;};
    set('finalScore',this.score); set('finalTime',this.formatTime(this.gameTime));
    const acc=this.totalErrors===0?100:Math.max(0,100-(this.totalErrors*10)); set('accuracy',`${acc}%`); set('ordersCompleted',this.ordersCompleted);
    this.showScreen('resultsScreen');
  }

  // ----- рендер -----
  render(){
    if(!this.ctx) return;
    this.ctx.fillStyle='#34495e'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
    if(this.inShelfView) this.renderShelfView(); else this.renderWarehouse();
  }
  renderWarehouse(){
    this.ctx.fillStyle='#8b4513';
    this.warehouse.shelves.forEach(s=>this.ctx.fillRect(s.x,s.y,s.width,s.height));
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
    this.ctx.fillStyle='#e74c3c'; this.ctx.fillRect(this.warehouse.width-100,20,80,30);
    this.ctx.fillStyle='#fff'; this.ctx.font='16px Arial'; this.ctx.fillText('Выход (E)', this.warehouse.width-95, 40);

    const shelf=this.warehouse.shelves[this.currentShelf];
    const sx=100, sy=100, w=150, h=100;
    shelf.items.forEach((it,i)=>{
      const c=i%4, r=Math.floor(i/4), x=sx+c*w, y=sy+r*h;
      this.ctx.fillStyle='#ecf0f1'; this.ctx.fillRect(x,y,w-10,h-10);
      this.ctx.fillStyle='#2c3e50'; this.ctx.font='14px Arial';
      this.ctx.fillText(it.name, x+10,y+25); this.ctx.fillText(`Кол-во: ${it.quantity}`, x+10,y+45);
      const o=this.currentOrder?.items.find(oi=>oi.sku===it.sku);
      if(o) this.ctx.fillText(`Собрано: ${o.pickedQuantity}/${o.requiredQuantity}`, x+10,y+65);
    });

    if(this.keys['KeyE']||this.keys['Space']){ this.exitShelfView(); this.keys['KeyE']=false; this.keys['Space']=false; }
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  window.game=new WareMoverGame();
  console.log('WareMover game loaded successfully');
});
