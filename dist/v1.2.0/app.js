import {COLS, ROWS, Game, createBoard, parseSnapshot, legalMoves, shuffleBoard, adjacent} from './engine.js';
import {RoundClock} from './clock.js';
import {theme} from './theme.js';
const VERSION = '1.2.0', ROOT = new URL('../', import.meta.url);
const $ = id => document.getElementById(id), boardEl = $('board'), buttons = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = `posse-pop:v2:${ROOT.pathname}`;
let saveWarning = '', bests = {endless:0,rush:0}, endlessSave = null, rushSave = null;
let mode = 'endless', clock = null, game, hasBegun = false, selected = null, pointer = null, resultShown = false, rushComplete = false;
let installPrompt = null, audio = null, soundOn = true, offlineReady = false, lastCount = '';
const validScore = n => Number.isSafeInteger(n) && n >= 0;
try {
  const rawEndless = localStorage.getItem(storageKey + ':endless');
  endlessSave = parseSnapshot(rawEndless);
  if (rawEndless && !endlessSave) saveWarning = '保存データを読めなかったため、新しく開始します';
  const savedBests = JSON.parse(localStorage.getItem(storageKey + ':bests') || '{}');
  for (const key of ['endless','rush']) if (validScore(savedBests?.[key])) bests[key] = savedBests[key];
  const rawRush = JSON.parse(localStorage.getItem(storageKey + ':rush') || 'null');
  if (rawRush && parseSnapshot(JSON.stringify(rawRush.snapshot)) && RoundClock.restore(rawRush.clock) && typeof rawRush.complete === 'boolean') rushSave = rawRush;
  bests.endless = Math.max(bests.endless,endlessSave?.best || 0);
  bests.rush = Math.max(bests.rush,rushSave?.snapshot.best || 0);
  soundOn = (localStorage.getItem(storageKey + ':sound') ?? localStorage.getItem(`iroha-match3:v1:${ROOT.pathname}:sound`)) !== 'off';
} catch { saveWarning = '保存を利用できないか、一部の記録を読めませんでした'; }
function persist(key, value) {
  try { localStorage.setItem(storageKey + ':' + key, JSON.stringify(value)); return true; }
  catch { saveWarning = '保存できません。閉じると進行が失われます'; return false; }
}
function showSaveState() {
  $('save-state').textContent = saveWarning || '✓ この端末に自動保存済み';
  $('save-state').classList.toggle('warning',!!saveWarning);
}
function saveBest() {
  bests[mode] = Math.max(bests[mode],game.best,game.score);
  persist('bests',bests); showSaveState();
}
function save(snapshot) {
  saveBest();
  if (mode === 'endless') { endlessSave = snapshot; persist('endless',snapshot); }
  else if (clock) { rushSave = {snapshot,clock:clock.snapshot(),complete:rushComplete}; persist('rush',rushSave); }
  showSaveState();
}
function unlockAudio() {
  if (!soundOn) return;
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(()=>{}); } catch { /* Sound is optional. */ }
}
function tone(kind, chain = 1) {
  if (!soundOn || !audio || audio.state !== 'running') return;
  try {
    const osc=audio.createOscillator(), gain=audio.createGain(), start=audio.currentTime;
    const frequency = kind==='clear' ? Math.min(1600,420+chain*110) : kind==='revert' ? 170 : kind==='count' ? 600 : 310;
    osc.type='sine';osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(frequency*(kind==='revert'?.6:1.35),start+.12);
    gain.gain.setValueAtTime(.045,start);gain.gain.exponentialRampToValueAtTime(.001,start+.16);osc.connect(gain).connect(audio.destination);osc.start(start);osc.stop(start+.17);
  } catch { /* Sound failure never blocks a move. */ }
}
const modalOpen = () => !!document.querySelector('dialog[open]');
const withinTime = () => mode !== 'rush' || !!clock?.canPlay(Date.now());
const canInteract = () => hasBegun && !game.locked && !modalOpen() && withinTime();
const quickFinish = () => reducedMotion.matches || (mode === 'rush' && clock?.at(Date.now()).phase === 'ended');
const wait = ms => new Promise(resolve=>setTimeout(resolve,quickFinish()?0:ms));
function setMessage(message) { $('message').textContent = message; }
for (let i=0;i<COLS*ROWS;i++) {
  const button=document.createElement('button');button.className='tile';button.type='button';button.dataset.index=i;
  button.style.setProperty('--x',i%COLS);button.style.setProperty('--y',Math.floor(i/COLS));boardEl.append(button);buttons.push(button);
}
function buildGame(snapshot) {
  const board = snapshot?.board ?? createBoard();
  const instance = new Game({board,score:snapshot?.score ?? 0,best:Math.max(bests[mode],snapshot?.best ?? 0),onSave:save,onPhase:animatePhase,canMove:canInteract,canScore:withinTime});
  if (!legalMoves(instance.board).length) instance.board=shuffleBoard(instance.board);
  return instance;
}
function render() {
  game.board.forEach((color,i)=>{
    const button=buttons[i],item=theme[color];button.classList.remove('clearing');button.classList.toggle('selected',selected===i);button.style.setProperty('--color',item.color);
    button.setAttribute('aria-label',`${Math.floor(i/COLS)+1}行${i%COLS+1}列 ${item.name}`);button.setAttribute('aria-pressed',String(selected===i));button.tabIndex=(selected===null?i===0:i===selected)?0:-1;
    const face=document.createElement('span');face.className='tile-face';face.setAttribute('aria-hidden','true');
    if(item.image){const image=document.createElement('img');image.src=new URL(item.image,import.meta.url).href;image.alt='';image.draggable=false;image.addEventListener('error',()=>{face.innerHTML=`<svg viewBox="0 0 32 32">${item.shape}</svg>`;},{once:true});face.append(image);}
    else face.innerHTML=`<svg viewBox="0 0 32 32">${item.shape}</svg>`;
    button.replaceChildren(face);
  });
  $('score').textContent=game.score.toLocaleString('ja-JP');$('best').textContent=Math.max(game.best,bests[mode]).toLocaleString('ja-JP');
}
function updateLock(locked) {
  boardEl.setAttribute('aria-busy',String(locked));
  for(const id of ['new-game','mode-menu','fullscreen'])$(id).disabled=locked;
}
async function animatePhase(phase) {
  render();
  if(phase.type==='swap'||phase.type==='revert'){
    tone(phase.type);const size=buttons[0].getBoundingClientRect().width,dx=(phase.b%COLS-phase.a%COLS)*size,dy=(Math.floor(phase.b/COLS)-Math.floor(phase.a/COLS))*size;
    await Promise.all([[phase.a,dx,dy],[phase.b,-dx,-dy]].map(([index,x,y])=>buttons[index].animate([{transform:`translate(${x}px,${y}px)`},{transform:'translate(0,0)'}],{duration:quickFinish()?0:160,easing:'ease-in-out'}).finished));
    if(phase.type==='revert')setMessage('');
  }else if(phase.type==='clear'){
    if(phase.points){saveBest();$('chain-label').textContent='NICE FLOW';$('chain').textContent=`${phase.chain}連鎖  ＋${phase.points.toLocaleString('ja-JP')}点`;setMessage(`${phase.matched.length}個消去 · ${phase.chain}連鎖`);tone('clear',phase.chain);}
    if(!quickFinish())phase.matched.forEach(i=>buttons[i].classList.add('clearing'));
    await wait(280);
  }else if(phase.type==='fall'){
    const size=buttons[0].getBoundingClientRect().height;
    await Promise.all(phase.drops.filter(d=>d.from!==d.to).map(d=>buttons[d.to].animate([{transform:`translateY(${(Math.floor(d.from/COLS)-Math.floor(d.to/COLS))*size}px)`},{transform:'translateY(0)'}],{duration:quickFinish()?0:260,easing:'cubic-bezier(.3,.5,.5,1)'}).finished));await wait(70);
  }else if(phase.type==='shuffle'){setMessage('手詰まりのためシャッフルしました');await wait(250);}
}
async function attemptMove(a,b) {
  if(!canInteract())return;selected=null;updateLock(true);
  try {const result=await game.move(a,b);if(result.accepted&&withinTime()){$('chain-label').textContent=result.chain>1?'POSSE CHAIN':'NICE FLOW';$('chain').textContent=`${result.chain}連鎖 · ${result.cleared}個消去`;setMessage('');}}
  catch {save(game.snapshot());setMessage('直前の盤面に戻しました。もう一度どうぞ');}
  finally {render();updateLock(false);tick();}
}
function choose(index){if(!canInteract())return;if(selected!==null&&adjacent(selected,index)){void attemptMove(selected,index);return;}selected=selected===index?null:index;render();}
boardEl.addEventListener('pointerdown',event=>{
  if(!canInteract()||pointer||!event.isPrimary||event.button!==0)return;const target=event.target.closest('.tile');if(!target)return;
  unlockAudio();pointer={id:event.pointerId,x:event.clientX,y:event.clientY,index:Number(target.dataset.index)};boardEl.setPointerCapture(event.pointerId);event.preventDefault();
});
boardEl.addEventListener('pointerup',event=>{
  if(!pointer||pointer.id!==event.pointerId)return;const start=pointer;pointer=null;if(boardEl.hasPointerCapture(event.pointerId))boardEl.releasePointerCapture(event.pointerId);if(!canInteract())return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y,threshold=Math.max(8,Math.min(18,buttons[0].getBoundingClientRect().width*.22));
  if(Math.max(Math.abs(dx),Math.abs(dy))<threshold){choose(start.index);return;}const offset=Math.abs(dx)>Math.abs(dy)?Math.sign(dx):Math.sign(dy)*COLS,to=start.index+offset;if(adjacent(start.index,to))void attemptMove(start.index,to);
});
for(const type of ['pointercancel','lostpointercapture'])boardEl.addEventListener(type,()=>{pointer=null;});
boardEl.addEventListener('click',event=>{if(event.detail===0){const target=event.target.closest('.tile');if(target){unlockAudio();choose(Number(target.dataset.index));}}});
boardEl.addEventListener('keydown',event=>{
  const target=event.target.closest('.tile');if(!target||!canInteract())return;const index=Number(target.dataset.index),offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-COLS,ArrowDown:COLS};
  if(event.key in offsets){event.preventDefault();unlockAudio();const to=index+offsets[event.key];if(adjacent(index,to))void attemptMove(index,to);}if(event.key==='Escape'){selected=null;render();}
});
function closeDialogs(){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
function activateMode(next,{fresh=false}={}) {
  if(game?.locked)return;
  if(hasBegun)save(game.snapshot());closeDialogs();mode=next;selected=null;pointer=null;resultShown=false;rushComplete=false;lastCount='';hasBegun=true;
  if(mode==='endless'){clock=null;game=buildGame(fresh?null:endlessSave);}
  else if(!fresh&&rushSave&&!rushSave.complete){clock=RoundClock.restore(rushSave.clock);game=buildGame(rushSave.snapshot);}
  else {clock=RoundClock.prepare();game=buildGame(null);}
  if(mode==='rush')clock.pauseCountdown(Date.now());
  $('timer-panel').hidden=mode!=='rush';$('howto').hidden=mode==='rush';$('mode-label').textContent=mode==='rush'?'POSSE RUSH 60':'ENDLESS';$('best-label').textContent=mode==='rush'?'RUSH 60 BEST':'ENDLESS BEST';
  $('chain-label').textContent='CHAIN';$('chain').textContent='';render();updateLock(false);save(game.snapshot());setMessage('');tick();
}
function showModeMenu(){
  if(hasBegun&&mode==='rush'&&clock?.pauseCountdown(Date.now())){save(game.snapshot());tick();}
  $('endless-record').textContent=`BEST ${bests.endless.toLocaleString('ja-JP')}${endlessSave?` · 続き ${endlessSave.score.toLocaleString('ja-JP')}点`:''}`;
  const activeRush=rushSave&&!rushSave.complete,remaining=activeRush?RoundClock.restore(rushSave.clock).at(Date.now()).seconds:0;
  $('rush-record').textContent=`BEST ${bests.rush.toLocaleString('ja-JP')}${activeRush?remaining?` · 続き ${remaining}秒`:' · 前回の結果を表示':''}`;
  const rushPhase=mode==='rush'?clock?.at(Date.now()).phase:null;
  $('resume-note').textContent=rushPhase==='ready'?'戻ってタップするとカウントを開始・再開します。':rushPhase==='playing'?'プレイ開始後は、モード選択中も時計が進みます。':'記録はモード別。ENDLESSは続きから遊べます。';
  $('close-mode').hidden=!hasBegun;$('mode-dialog').showModal();
}
function finishRush(){
  if(resultShown||game.locked)return;resultShown=true;rushComplete=true;selected=null;pointer=null;save(game.snapshot());render();closeDialogs();
  $('result-score').textContent=game.score.toLocaleString('ja-JP');$('result-best').textContent=`RUSH 60 BEST ${bests.rush.toLocaleString('ja-JP')}`;setMessage('TIME’S UP — また次のセッションで！');$('result-dialog').showModal();
}
function tick(){
  if(!hasBegun||mode!=='rush'||!clock){$('start-rush').hidden=true;$('countdown').hidden=true;return;}const state=clock.at(Date.now());
  $('start-rush').hidden=state.phase!=='ready';
  $('seconds').textContent=String(state.seconds);$('time-bar').style.width=`${state.remaining/600}%`;$('timer-panel').classList.toggle('urgent',state.phase==='playing'&&state.seconds<=10);
  $('countdown').hidden=state.phase!=='countdown';
  if(state.phase==='ready'){lastCount='';setMessage('');}
  else if(state.phase==='countdown'){const value=String(state.count);if(value!==lastCount){lastCount=value;$('count').textContent=value;tone('count');}}
  else if(state.phase==='ended'){if(game.locked)setMessage('TIME’S UP — 盤面を整理しています');else finishRush();}
  else if(lastCount){lastCount='';setMessage('LET’S POP!');tone('clear');}
}
$('start-rush').addEventListener('click',()=>{
  unlockAudio();if(mode!=='rush'||modalOpen()||!clock?.startCountdown(Date.now()))return;
  save(game.snapshot());tick();
});
$('choose-endless').addEventListener('click',()=>{unlockAudio();activateMode('endless');});
$('choose-rush').addEventListener('click',()=>{unlockAudio();activateMode('rush');});
$('mode-menu').addEventListener('click',()=>{if(!game.locked)showModeMenu();});
$('close-mode').addEventListener('click',()=>$('mode-dialog').close());
$('mode-dialog').addEventListener('cancel',event=>{if(!hasBegun)event.preventDefault();});
$('result-mode').addEventListener('click',()=>{$('result-dialog').close();showModeMenu();});
$('retry-rush').addEventListener('click',()=>{unlockAudio();activateMode('rush',{fresh:true});});
$('result-dialog').addEventListener('cancel',event=>{event.preventDefault();$('result-dialog').close();showModeMenu();});
$('sound').addEventListener('click',()=>{soundOn=!soundOn;updateSound();unlockAudio();if(soundOn)tone('swap');try{localStorage.setItem(storageKey+':sound',soundOn?'on':'off');}catch{saveWarning='効果音設定を保存できませんでした';showSaveState();}});
function updateSound(){$('sound').textContent=`♪ 効果音 ${soundOn?'ON':'OFF'}`;$('sound').setAttribute('aria-pressed',String(soundOn));}
$('new-game').addEventListener('click',()=>{if(!game.locked)$('reset-dialog').showModal();});
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{if(!game.locked)activateMode(mode,{fresh:true});});
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{await document.documentElement.requestFullscreen();try{await screen.orientation.lock('landscape');}catch{}}}catch{setMessage('端末を横向きにしてお楽しみください');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ 全画面を終了':'⛶ 全画面で遊ぶ';});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});
$('install').addEventListener('click',async()=>{if(!installPrompt)return;try{await installPrompt.prompt();await installPrompt.userChoice;}catch{setMessage('ブラウザのメニューからホーム画面へ追加できます');}finally{installPrompt=null;$('install').hidden=true;}});
window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
function updateNetwork(){$('network').textContent=!navigator.onLine?(offlineReady?'オフラインでプレイ中':'オフライン'):(offlineReady?'オフライン準備完了':'オフライン準備中');}
window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
async function checkWorker(){
  const worker=navigator.serviceWorker?.controller;if(!worker)return;
  const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();},1500);
  channel.port1.onmessage=event=>{clearTimeout(timeout);channel.port1.close();if(event.data?.version===VERSION){offlineReady=true;updateNetwork();}};
  worker.postMessage({type:'GET_VERSION'},[channel.port2]);
}
if('serviceWorker' in navigator&&isSecureContext){
  navigator.serviceWorker.addEventListener('controllerchange',checkWorker);
  navigator.serviceWorker.register(new URL('sw.js',ROOT),{scope:ROOT.href,updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(checkWorker).catch(()=>{$('network').textContent='オフライン準備に失敗・オンラインで利用可';});
}else $('network').textContent='オフライン利用にはHTTPSが必要';
document.addEventListener('visibilitychange',tick);window.addEventListener('pageshow',tick);setInterval(tick,80);
game=buildGame(endlessSave);updateSound();render();showSaveState();showModeMenu();
