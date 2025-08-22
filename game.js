// Основной класс игры WareMover
class WareMoverGame {
    getElByIdSafe(id) {
        const el = document.getElementById(id);
        if (!el) { console.warn('[WareMover] Элемент не найден:', id); }
        return el;
    }
    onClick(id, handler) {
        const el = this.getElByIdSafe(id);
        if (el) el.addEventListener('click', handler);
    }

    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameState = 'menu'; 
        this.gameMode = null; 
        this.pickingMethod = null; 
        
        this.score = 0;
        this.startTime = 0;
        this.gameTime = 0;
        this.currentOrder = null;
        this.ordersCompleted = 0;
        this.totalErrors = 0;
        
        this.player = { x:100,y:100,width:32,height:32,speed:3 };
        this.warehouse = { width:800,height:600,shelves:[],computer:{x:50,y:50,width:60,height:40} };
        this.keys = {};
        this.mousePos = {x:0,y:0};
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
        try {
            this.onClick('startGameBtn', () => this.showScreen('modeSelection'));
            this.onClick('settingsBtn', () => alert('Настройки будут позже'));
            this.onClick('helpBtn', () => this.showScreen('helpScreen'));
            this.onClick('quickOrderBtn', () => { this.gameMode='quickOrder'; this.showScreen('pickingMethodSelection'); });
            this.onClick('marathonBtn', () => { this.gameMode='marathon'; this.showScreen('pickingMethodSelection'); });
            this.onClick('pickByListBtn', () => { this.pickingMethod='pickByList'; this.startGame(); });
            this.onClick('pickByVoiceBtn', () => { this.pickingMethod='pickByVoice'; this.startGame(); });
            this.onClick('pickByLightBtn', () => { this.pickingMethod='pickByLight'; this.startGame(); });
            this.onClick('pickByVisionBtn', () => { this.pickingMethod='pickByVision'; this.startGame(); });
            this.onClick('backToMenuBtn', () => this.showScreen('mainMenu'));
            this.onClick('backToModeBtn', () => this.showScreen('modeSelection'));
            this.onClick('backFromHelpBtn', () => this.showScreen('mainMenu'));
            this.onClick('playAgainBtn', () => this.showScreen('modeSelection'));
            this.onClick('backToMainBtn', () => this.showScreen('mainMenu'));
            this.onClick('pauseBtn', () => this.togglePause());

            document.addEventListener('keydown', (e) => {
                this.keys[e.code] = true;
                if (this.gameState === 'playing' && (e.code === 'KeyE' || e.code === 'Space')) {
                    if (this.inShelfView) this.exitShelfView();
                    else this.handleInteraction();
                }
                if (e.code === 'Escape' && this.gameState === 'playing') this.togglePause();
            });
            document.addEventListener('keyup', (e)=>{ this.keys[e.code]=false; });
        } catch (err) {
            console.error('[WareMover] Ошибка setupEventListeners:', err);
        }
    }

    showScreen(id){
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if (id==='gameScreen'){
            this.canvas=document.getElementById('gameCanvas');
            this.ctx=this.canvas.getContext('2d');
            this.gameState='playing';
            this.gameLoop();
        }
    }

    // --- Дальше идёт упрощённая версия движка (отрисовка, заказы, очки) ---
    initializeWarehouse(){
        this.warehouse.shelves=[
            {x:150,y:100,width:120,height:60,items:this.generateShelfItems()},
            {x:500,y:100,width:120,height:60,items:this.generateShelfItems()}
        ];
    }
    generateShelfItems(){
        const t=['box','bottle','folder']; const items=[];
        for(let i=0;i<6;i++){items.push({id:`itm${Math.random()}`,name:`Товар ${i+1}`,quantity:5});}
        return items;
    }
    generateOrder(){
        return {id:`ord${Date.now()}`,items:[...this.warehouse.shelves[0].items.slice(0,2)],completed:false};
    }
    startGame(){
        this.score=0; this.startTime=Date.now(); this.gameTime=0; this.currentOrder=this.generateOrder();
        this.player.x=100; this.player.y=100;
        this.updateHUD();
        this.showScreen('gameScreen');
    }
    gameLoop(){
        if(this.gameState!=='playing') return;
        this.update(); this.render();
        requestAnimationFrame(()=>this.gameLoop());
    }
    update(){ this.gameTime=Date.now()-this.startTime; this.updateHUD(); }
    render(){
        if(!this.ctx) return;
        this.ctx.fillStyle='#34495e'; this.ctx.fillRect(0,0,this.warehouse.width,this.warehouse.height);
        this.ctx.fillStyle='#e74c3c'; this.ctx.fillRect(this.player.x,this.player.y,this.player.width,this.player.height);
    }
    updateHUD(){
        document.getElementById('score').textContent=this.score;
        document.getElementById('time').textContent=this.formatTime(this.gameTime);
        document.getElementById('currentItem').textContent=0;
        document.getElementById('totalItems').textContent=this.currentOrder.items.length;
        document.getElementById('currentMethod').textContent=this.pickingMethod;
    }
    formatTime(ms){ const s=Math.floor(ms/1000);const m=Math.floor(s/60);return `${m.toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
    togglePause(){ if(this.gameState==='playing'){this.gameState='paused';} else {this.gameState='playing'; this.gameLoop();} }
}

// Инициализация
document.addEventListener('DOMContentLoaded',()=>{ window.game=new WareMoverGame(); });
console.log('WareMover game loaded successfully');
