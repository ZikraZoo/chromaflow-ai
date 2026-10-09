const WIDTH = 15;
const HEIGHT = 8;
const COLORS = ['r','g','b','y','c','p'];
const NAMES = ['RED','GREEN','BLUE','YELLOW','CYAN','PURPLE'];
const state = { board:null, initial:null, seed:null, target:0, moves:[], gameOver:false, replay:null };

const $ = id => document.getElementById(id);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}
function makeBoard(seed) {
  const rand = seededRandom(seed), b = Array.from({length:HEIGHT}, () => Array(WIDTH).fill(0));
  for (let y=0;y<HEIGHT;y++) for (let x=0;x<WIDTH;x++) b[y][x] = Math.floor(rand()*6);
  for (let i=0;i<WIDTH*HEIGHT;i++) {
    const x = Math.floor(rand()*(WIDTH-1)), y = Math.floor(rand()*HEIGHT);
    b[y][x+1] = b[y][x];
  }
  return b;
}
function clone(b) { return b.map(row => row.slice()); }
function neighbors(x,y) { return [[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>nx>=0&&nx<WIDTH&&ny>=0&&ny<HEIGHT); }
function blob(b) {
  const target=b[0][0], seen=new Set(), q=[[0,0]];
  while(q.length){ const [x,y]=q.shift(), k=`${x},${y}`; if(seen.has(k)) continue; seen.add(k); for(const [nx,ny] of neighbors(x,y)) if(b[ny][nx]===target&&!seen.has(`${nx},${ny}`)) q.push([nx,ny]); }
  return seen;
}
function flood(b,color) { const out=clone(b), cells=blob(out); for(const k of cells){const [x,y]=k.split(',').map(Number); out[y][x]=color;} return out; }
function solved(b) { return blob(b).size === WIDTH*HEIGHT; }
function key(b) { return b.flat().join(''); }
function uniqueRemaining(b,cells) { const set=new Set(); for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) if(!cells.has(`${x},${y}`)) set.add(b[y][x]); return set.size; }

function greedy(b) {
  let cur=clone(b), path=[];
  while(!solved(cur)) {
    const current=cur[0][0]; let best=current, bestSize=blob(cur).size;
    for(let c=0;c<6;c++) if(c!==current){ const next=flood(cur,c), size=blob(next).size; if(size>bestSize){bestSize=size;best=c;} }
    if(best===current){ const choices=[0,1,2,3,4,5].filter(c=>c!==current); best=choices[Math.floor(Math.random()*choices.length)]; }
    path.push(best); cur=flood(cur,best);
  }
  return path;
}
function astar(start,maxNodes=15000) {
  const initial=clone(start), h0=uniqueRemaining(initial,blob(initial));
  let queue=[{f:h0,g:0,b:initial,path:[]}], visited=new Set([key(initial)]), expanded=0;
  while(queue.length){
    queue.sort((a,b)=>a.f-b.f || a.g-b.g);
    const cur=queue.shift(); expanded++;
    if(expanded>maxNodes) return cur.path.concat(greedy(cur.b));
    if(solved(cur.b)) return cur.path;
    const color=cur.b[0][0];
    for(let c=0;c<6;c++) if(c!==color){
      const nb=flood(cur.b,c), k=key(nb); if(visited.has(k)) continue;
      visited.add(k); const g=cur.g+1, h=uniqueRemaining(nb,blob(nb));
      queue.push({f:g+h,g,b:nb,path:cur.path.concat(c)});
    }
  }
  return [];
}

function renderBoard(el,b) {
  el.innerHTML='';
  for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++){
    const d=document.createElement('div'); d.className=`tile ${COLORS[b[y][x]]}`; el.appendChild(d);
  }
}
function renderMain() {
  renderBoard($('board'),state.board);
  $('seed').textContent=state.seed;
  $('target').textContent=`${state.target} moves`;
  $('moves').textContent=state.moves.length;
  $('tiles').textContent=`${blob(state.board).size} / ${WIDTH*HEIGHT}`;
  document.querySelectorAll('.color-btn').forEach(b=>b.disabled=state.gameOver || Number(b.dataset.color)===state.board[0][0]);
}
function setupColors(){
  const el=$('colors'); el.innerHTML='';
  COLORS.forEach((c,i)=>{const b=document.createElement('button'); b.className=`color-btn ${c}`; b.dataset.color=i; b.textContent=`[${NAMES[i][0]}] ${NAMES[i]}`; b.onclick=()=>play(i); el.appendChild(b);});
}
function play(color){
  if(state.gameOver || color===state.board[0][0]) return;
  state.board=flood(state.board,color); state.moves.push(color); renderMain();
  if(solved(state.board)) finish(); else $('message').textContent=`Nice. ${blob(state.board).size} tiles captured.`;
}
function finish(){
  state.gameOver=true; renderMain(); $('replayBtn').disabled=false;
  const diff=state.moves.length-state.target;
  $('message').textContent=diff<=0 ? `INCREDIBLE — you matched or beat the A* target of ${state.target} moves!` : `Solved in ${state.moves.length} moves. A* did it in ${state.target}. You were ${diff} move${diff===1?'':'s'} away.`;
}
function newGame(){
  state.seed=Math.floor(Math.random()*100000)+1; state.board=makeBoard(state.seed); state.initial=clone(state.board); state.moves=[]; state.gameOver=false; state.replay=null;
  state.target=astar(state.initial).length; $('replayBtn').disabled=true; $('replayPanel').classList.add('hidden'); $('message').textContent='Flood the board from the top-left corner.'; renderMain();
}

function openReplay(){
  state.replay={ai:astar(state.initial),human:state.moves.slice(),step:0}; $('replayPanel').classList.remove('hidden'); renderReplay(); $('replayPanel').scrollIntoView({behavior:'smooth'});
}
function boardAt(path,step){ let b=clone(state.initial); for(let i=0;i<Math.min(step,path.length);i++) b=flood(b,path[i]); return b; }
function renderReplay(){
  const r=state.replay, max=Math.max(r.ai.length,r.human.length); r.step=Math.max(0,Math.min(r.step,max));
  renderBoard($('aiBoard'),boardAt(r.ai,r.step)); renderBoard($('humanBoard'),boardAt(r.human,r.step));
  $('stepLabel').textContent=`STEP ${r.step} / ${max}`;
  $('prevStep').disabled=r.step===0; $('nextStep').disabled=r.step===max;
  const ai=r.step>0&&r.step<=r.ai.length?NAMES[r.ai[r.step-1]]:'START'; const hu=r.step>0&&r.step<=r.human.length?NAMES[r.human[r.step-1]]:'START';
  $('replayText').textContent=`Step ${r.step}: A* chose ${ai}; you chose ${hu}.`;
}
$('newGame').onclick=newGame; $('replayBtn').onclick=openReplay; $('closeReplay').onclick=()=> $('replayPanel').classList.add('hidden');
$('prevStep').onclick=()=>{state.replay.step--;renderReplay()}; $('nextStep').onclick=()=>{state.replay.step++;renderReplay()};
document.addEventListener('keydown',e=>{const map={r:0,g:1,b:2,y:3,c:4,p:5}; if(map[e.key.toLowerCase()]!==undefined) play(map[e.key.toLowerCase()]);});
setupColors(); newGame();
