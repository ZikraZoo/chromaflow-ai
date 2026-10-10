"use strict";

// The browser edition follows the Python game's 15x8, six-color flood-fill rules.
const WIDTH = 15;
const HEIGHT = 8;
const CELL_COUNT = WIDTH * HEIGHT;
const SEARCH_NODE_LIMIT = 15000;
const COLORS = ["red", "green", "blue", "yellow", "cyan", "purple"];
const COLOR_KEYS = ["R", "G", "B", "Y", "C", "P"];
const NAMES = ["RED", "GREEN", "BLUE", "YELLOW", "CYAN", "PURPLE"];
const state = {
  board: null,
  initial: null,
  seed: null,
  targetPath: null,
  targetFallback: false,
  targetExpanded: 0,
  searchProgress: 0,
  moves: [],
  playerMoves: [],
  gameOver: false,
  playback: false,
  playbackPaused: false,
  solverPath: null,
  solverStep: 0,
  stepRequested: false,
  playbackWaiters: [],
  mode: "human",
  replay: null,
  generation: 0,
  playbackToken: 0,
  hint: null
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wakePlaybackWaiters() {
  const waiters = state.playbackWaiters.splice(0);
  waiters.forEach((resolve) => resolve());
}

function renderSolverPlaybackControls() {
  const panel = $("solverPlaybackControls");
  panel.classList.toggle("hidden", !state.playback);
  $("solverPauseButton").textContent = state.playbackPaused ? "Resume playback" : "Pause playback";
  $("solverPauseButton").disabled = !state.playback;
  $("solverStepBackButton").disabled = !state.playback || !state.playbackPaused || state.solverStep <= 0;
  $("solverStepButton").disabled = !state.playback || !state.playbackPaused || !state.solverPath || state.solverStep >= state.solverPath.length;
  $("solverPlaybackStatus").textContent = state.playback
    ? `${state.mode} · MOVE ${state.solverStep} / ${state.solverPath.length} · ${state.playbackPaused ? "PAUSED" : "PLAYING"}`
    : "READY";
}

// Wait for the selected delay. If paused, stop advancing until the player
// resumes or requests exactly one move.
async function waitForPlaybackAction(token) {
  while (token === state.playbackToken) {
    if (state.playbackPaused) {
      if (state.stepRequested) {
        state.stepRequested = false;
        return true;
      }
      await new Promise((resolve) => state.playbackWaiters.push(resolve));
      continue;
    }

    const interval = Math.max(100, Number($("solverSpeed").value) || 1200);
    const deadline = Date.now() + interval;
    while (token === state.playbackToken && !state.playbackPaused && Date.now() < deadline) {
      await wait(Math.min(50, Math.max(1, deadline - Date.now())));
    }
    if (token !== state.playbackToken) return false;
    if (state.playbackPaused) continue;
    return true;
  }
  return false;
}

// A small seeded generator keeps a shown browser seed reproducible in this edition.
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeBoard(seed) {
  const random = seededRandom(seed);
  const board = new Uint8Array(CELL_COUNT);

  // Match the Python generator's column-first fill order and right-neighbor smoothing.
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      board[y * WIDTH + x] = Math.floor(random() * COLORS.length);
    }
  }
  for (let i = 0; i < CELL_COUNT; i++) {
    const x = Math.floor(random() * (WIDTH - 1));
    const y = Math.floor(random() * HEIGHT);
    board[y * WIDTH + x + 1] = board[y * WIDTH + x];
  }
  return board;
}

function clone(board) {
  return board.slice();
}

// Return indices in the top-left connected component. Marking cells when enqueued
// avoids duplicate queue entries and keeps the search faster than string coordinates.
function blobCells(board) {
  const target = board[0];
  const seen = new Uint8Array(CELL_COUNT);
  const queue = new Int16Array(CELL_COUNT);
  let head = 0;
  let tail = 0;
  queue[tail++] = 0;
  seen[0] = 1;

  while (head < tail) {
    const index = queue[head++];
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);

    if (y > 0) enqueue(index - WIDTH);
    if (x < WIDTH - 1) enqueue(index + 1);
    if (y < HEIGHT - 1) enqueue(index + WIDTH);
    if (x > 0) enqueue(index - 1);

    function enqueue(next) {
      if (!seen[next] && board[next] === target) {
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return queue.subarray(0, tail);
}

function floodedSize(board) {
  return blobCells(board).length;
}

function isSolved(board) {
  return floodedSize(board) === CELL_COUNT;
}

function boardKey(board) {
  // Tile values are single digits from 0 to 5, so this is an unambiguous compact key.
  return board.join("");
}

function flood(board, color) {
  const next = clone(board);
  for (const index of blobCells(board)) next[index] = color;
  return next;
}

function uniqueRemaining(board, cells) {
  const inBlob = new Uint8Array(CELL_COUNT);
  for (const index of cells) inBlob[index] = 1;
  const colors = new Uint8Array(COLORS.length);
  let count = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!inBlob[i] && !colors[board[i]]) {
      colors[board[i]] = 1;
      count++;
    }
  }
  return count;
}

function comparePriority(a, b) {
  return a.f - b.f || a.g - b.g || a.sequence - b.sequence;
}

// A binary min-heap avoids sorting the full A* frontier after every expansion.
class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (comparePriority(items[parent], value) <= 0) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const root = items[0];
    const last = items.pop();
    if (items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        let child = left;
        if (right < items.length && comparePriority(items[right], items[left]) < 0) child = right;
        if (comparePriority(last, items[child]) <= 0) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return root;
  }
}

function greedy(startBoard, random = seededRandom(0xC01DF100)) {
  let board = clone(startBoard);
  const path = [];
  let guard = 0;
  while (!isSolved(board) && guard < CELL_COUNT * COLORS.length) {
    guard++;
    const currentColor = board[0];
    let bestColor = currentColor;
    let bestSize = floodedSize(board);
    for (let color = 0; color < COLORS.length; color++) {
      if (color === currentColor) continue;
      const next = flood(board, color);
      const size = floodedSize(next);
      if (size > bestSize) {
        bestSize = size;
        bestColor = color;
      }
    }
    // As in the Python version, change color even when no immediate blob growth occurs.
    if (bestColor === currentColor) {
      const choices = COLORS.map((_, color) => color).filter((color) => color !== currentColor);
      bestColor = choices[Math.floor(random() * choices.length)];
    }
    path.push(bestColor);
    board = flood(board, bestColor);
  }
  return path;
}

async function astar(startBoard, maxNodes = SEARCH_NODE_LIMIT, onProgress = null, shouldCancel = () => false) {
  const initial = clone(startBoard);
  const startCells = blobCells(initial);
  const startH = uniqueRemaining(initial, startCells);
  const frontier = new MinHeap();
  let sequence = 0;
  frontier.push({ f: startH, g: 0, sequence, board: initial, path: [] });
  const visited = new Set([boardKey(initial)]);
  let expanded = 0;

  while (frontier.size) {
    if (shouldCancel()) return { path: [], expanded, fallback: false, cancelled: true };
    const current = frontier.pop();
    expanded++;

    if (expanded > maxNodes) {
      const fallbackRandom = seededRandom((startBoard[0] + expanded + 0xA57A) >>> 0);
      return {
        path: current.path.concat(greedy(current.board, fallbackRandom)),
        expanded,
        fallback: true,
        cancelled: false
      };
    }
    if (isSolved(current.board)) {
      return { path: current.path, expanded, fallback: false, cancelled: false };
    }

    const currentColor = current.board[0];
    for (let color = 0; color < COLORS.length; color++) {
      if (color === currentColor) continue;
      const nextBoard = flood(current.board, color);
      const key = boardKey(nextBoard);
      if (visited.has(key)) continue;
      visited.add(key);
      const g = current.g + 1;
      const h = uniqueRemaining(nextBoard, blobCells(nextBoard));
      sequence++;
      frontier.push({ f: g + h, g, sequence, board: nextBoard, path: current.path.concat(color) });
    }

    // Yield regularly so rendering and user input remain responsive while A* searches.
    if (expanded % 80 === 0) {
      if (onProgress) onProgress(expanded);
      await wait(0);
    }
  }
  return { path: [], expanded, fallback: false, cancelled: false };
}

function renderBoard(element, board) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < CELL_COUNT; index++) {
    const tile = document.createElement("div");
    tile.className = `tile ${COLORS[board[index]]}${index === 0 ? " start-tile" : ""}`;
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", `${NAMES[board[index]]}${index === 0 ? ", flood start" : ""}`);
    if (index === 0) tile.title = "Flood starts here";
    fragment.appendChild(tile);
  }
  element.replaceChildren(fragment);
}

function renderMain() {
  renderBoard($("board"), state.board);
  $("seed").textContent = state.seed;
  $("target").textContent = state.targetPath
    ? `${state.targetPath.length}${state.targetFallback ? "*" : ""} moves`
    : state.searchProgress ? `${state.searchProgress.toLocaleString()} nodes` : "Searching…";
  $("moves").textContent = state.moves.length;
  $("movesLabel").textContent = state.mode === "human" ? "YOUR MOVES" : `${state.mode.toUpperCase()} MOVES`;
  $("tiles").textContent = `${floodedSize(state.board)} / ${CELL_COUNT}`;

  const pill = $("statusPill");
  pill.classList.toggle("is-solved", state.gameOver);
  pill.classList.toggle("is-working", state.playback || !state.targetPath);
  pill.textContent = state.playback ? `${state.mode.toUpperCase()} PLAYBACK` : state.gameOver ? "SOLVED" : state.mode === "human" ? "YOUR TURN" : "SOLVER FINISHED";

  document.querySelectorAll(".color-btn").forEach((button) => {
    const color = Number(button.dataset.color);
    button.disabled = state.gameOver || state.playback || state.mode !== "human" || color === state.board[0];
    button.classList.toggle("suggested", state.hint === color && !button.disabled);
  });
  $("undoButton").disabled = state.mode !== "human" || state.playerMoves.length === 0 || state.playback;
  $("replayButton").disabled = !state.targetPath || state.playerMoves.length === 0 || state.playback;
  $("astarSolveButton").disabled = !state.targetPath || state.playback;
  $("greedySolveButton").disabled = state.playback;
  renderSolverPlaybackControls();
}

function setupColors() {
  const container = $("colors");
  container.replaceChildren();
  COLORS.forEach((colorName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-btn ${colorName}`;
    button.dataset.color = String(index);
    button.textContent = `${COLOR_KEYS[index]} · ${NAMES[index]}`;
    button.setAttribute("aria-label", `Choose ${NAMES[index]} using ${COLOR_KEYS[index]}`);
    button.addEventListener("click", () => play(index));
    container.appendChild(button);
  });
}

function clearHint() {
  state.hint = null;
  document.querySelectorAll(".color-btn").forEach((button) => button.classList.remove("suggested"));
}

function play(color) {
  if (state.gameOver || state.playback || state.mode !== "human" || color === state.board[0]) return;
  clearHint();
  state.board = flood(state.board, color);
  state.moves.push(color);
  state.playerMoves = state.moves.slice();
  renderMain();
  if (isSolved(state.board)) {
    state.gameOver = true;
    renderMain();
    const baseline = state.targetPath ? state.targetPath.length : null;
    const scoreText = baseline === null ? "The A* reference is still being calculated." : `The A* reference path uses ${baseline} moves${state.targetFallback ? " (with Greedy completion)" : ""}.`;
    $("message").textContent = `Solved in ${state.moves.length} moves. ${scoreText}`;
  } else {
    $("message").textContent = `Good move. Your flooded region now contains ${floodedSize(state.board)} of ${CELL_COUNT} tiles.`;
  }
}

function undoMove() {
  if (state.mode !== "human" || !state.playerMoves.length || state.playback) return;
  state.playerMoves.pop();
  state.moves = state.playerMoves.slice();
  state.board = boardAt(state.initial, state.moves, state.moves.length);
  state.gameOver = false;
  clearHint();
  renderMain();
  $("message").textContent = "Last move undone. Try a different color.";
}

function boardAt(start, path, step) {
  let board = clone(start);
  for (let i = 0; i < Math.min(step, path.length); i++) board = flood(board, path[i]);
  return board;
}

function hintMove() {
  if (state.gameOver || state.playback) return;
  const random = seededRandom((state.seed ^ (state.moves.length + 0x6A09E667)) >>> 0);
  const path = greedy(state.board, random);
  const color = path[0];
  state.hint = color;
  renderMain();
  $("message").textContent = `Greedy suggests ${NAMES[color]}. It chooses the move with the largest immediate gain in captured tiles.`;
}

async function playSolver(path, label) {
  if (state.playback || !path || !path.length) return;
  const token = ++state.playbackToken;
  wakePlaybackWaiters();
  state.playback = true;
  state.playbackPaused = false;
  state.solverPath = path.slice();
  state.solverStep = 0;
  state.stepRequested = false;
  state.mode = label;
  state.board = clone(state.initial);
  state.moves = [];
  state.gameOver = false;
  state.hint = null;
  $("replayPanel").classList.add("hidden");
  $("message").textContent = `${label} playback is starting. Adjust the speed, or pause and step through one move at a time.`;
  renderMain();
  $("board").scrollIntoView({ behavior: "smooth", block: "center" });

  while (state.solverStep < state.solverPath.length) {
    const mayAdvance = await waitForPlaybackAction(token);
    if (!mayAdvance || token !== state.playbackToken) return;

    state.solverStep += 1;
    state.board = boardAt(state.initial, state.solverPath, state.solverStep);
    state.moves = state.solverPath.slice(0, state.solverStep);
    renderMain();
    const playedColor = NAMES[state.solverPath[state.solverStep - 1]];
    $("message").textContent = `${label} · move ${state.solverStep} of ${state.solverPath.length}: chose ${playedColor}. Pause to inspect this board or step backward to review earlier moves.`;
  }

  if (token !== state.playbackToken) return;
  state.playback = false;
  state.playbackPaused = false;
  state.stepRequested = false;
  state.gameOver = isSolved(state.board);
  wakePlaybackWaiters();
  renderMain();
  $("message").textContent = `${label} completed the board in ${state.moves.length} moves. Your human move sequence is retained for comparison.`;
  if (!state.gameOver) $("message").textContent += " The search returned an incomplete path; try a new board or inspect the solver limit.";
}
function newGame() {
  state.generation++;
  const generation = state.generation;
  state.playbackToken++;
  state.playback = false;
  state.playbackPaused = false;
  state.solverPath = null;
  state.solverStep = 0;
  state.stepRequested = false;
  wakePlaybackWaiters();
  state.seed = Math.floor(Math.random() * 999999) + 1;
  state.initial = makeBoard(state.seed);
  state.board = clone(state.initial);
  state.targetPath = null;
  state.targetFallback = false;
  state.targetExpanded = 0;
  state.searchProgress = 0;
  state.moves = [];
  state.playerMoves = [];
  state.gameOver = false;
  state.mode = "human";
  state.replay = null;
  state.hint = null;
  $("replayPanel").classList.add("hidden");
  $("message").textContent = "Choose a color to grow the flooded region. The A* reference is calculating in the background.";
  $("baselineNote").textContent = "A* reference is being calculated. You can start playing while it searches.";
  renderMain();

  // Capture this board so rapid clicks on New Board cannot start duplicate searches
  // against a later board by accident.
  const initialForSearch = clone(state.initial);

  // Give the browser one paint before starting the CPU work.
  setTimeout(async () => {
    const result = await astar(
      initialForSearch,
      SEARCH_NODE_LIMIT,
      (expanded) => {
        if (generation !== state.generation) return;
        state.searchProgress = expanded;
        $("target").textContent = `${expanded.toLocaleString()} nodes`;
      },
      () => generation !== state.generation
    );
    if (generation !== state.generation || result.cancelled) return;
    state.targetPath = result.path;
    state.targetFallback = result.fallback;
    state.targetExpanded = result.expanded;
    state.searchProgress = result.expanded;
    $("baselineNote").textContent = result.fallback
      ? `Search reached its ${SEARCH_NODE_LIMIT.toLocaleString()}-node limit and used Greedy for the rest. The reference is not guaranteed optimal.`
      : `A* found a path within the ${SEARCH_NODE_LIMIT.toLocaleString()}-node limit (${result.expanded.toLocaleString()} expanded nodes).`;
    renderMain();
  }, 30);
}

function restartGame() {
  if (!state.initial) return;
  state.playbackToken++;
  state.playback = false;
  state.playbackPaused = false;
  state.solverPath = null;
  state.solverStep = 0;
  state.stepRequested = false;
  wakePlaybackWaiters();
  state.board = clone(state.initial);
  state.moves = [];
  state.playerMoves = [];
  state.gameOver = false;
  state.mode = "human";
  state.hint = null;
  state.replay = null;
  $("replayPanel").classList.add("hidden");
  $("message").textContent = "Board reset. Try a new strategy.";
  renderMain();
}

function openReplay() {
  if (!state.targetPath || state.playerMoves.length === 0) return;
  state.replay = { ai: state.targetPath.slice(), human: state.playerMoves.slice(), step: 0 };
  $("aiMoveCount").textContent = `${state.replay.ai.length} moves${state.targetFallback ? "*" : ""}`;
  $("humanMoveCount").textContent = `${state.replay.human.length} moves`;
  $("replayPanel").classList.remove("hidden");
  renderReplay();
  $("replayPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReplay() {
  if (!state.replay) return;
  const replay = state.replay;
  const maxStep = Math.max(replay.ai.length, replay.human.length);
  replay.step = Math.max(0, Math.min(replay.step, maxStep));
  renderBoard($("aiBoard"), boardAt(state.initial, replay.ai, replay.step));
  renderBoard($("humanBoard"), boardAt(state.initial, replay.human, replay.step));
  $("stepLabel").textContent = `STEP ${replay.step} / ${maxStep}`;
  $("prevStep").disabled = replay.step === 0;
  $("nextStep").disabled = replay.step === maxStep;
  const aiColor = replay.step > 0 && replay.step <= replay.ai.length ? NAMES[replay.ai[replay.step - 1]] : replay.step > replay.ai.length ? "FINISHED" : "START";
  const humanColor = replay.step > 0 && replay.step <= replay.human.length ? NAMES[replay.human[replay.step - 1]] : replay.step > replay.human.length ? "FINISHED" : "START";
  $("replayText").textContent = `Step ${replay.step}: A* chose ${aiColor}; your play chose ${humanColor}.`;
}

$("newGame").addEventListener("click", newGame);
$("restartGame").addEventListener("click", restartGame);
$("undoButton").addEventListener("click", undoMove);
$("hintButton").addEventListener("click", hintMove);
$("replayButton").addEventListener("click", openReplay);
$("closeReplayButton").addEventListener("click", () => $("replayPanel").classList.add("hidden"));
$("prevStep").addEventListener("click", () => { if (state.replay) { state.replay.step--; renderReplay(); } });
$("nextStep").addEventListener("click", () => { if (state.replay) { state.replay.step++; renderReplay(); } });
$("solverPauseButton").addEventListener("click", () => {
  if (!state.playback) return;
  state.playbackPaused = !state.playbackPaused;
  if (!state.playbackPaused) wakePlaybackWaiters();
  renderMain();
});
$("solverStepButton").addEventListener("click", () => {
  if (!state.playback || !state.playbackPaused || !state.solverPath || state.solverStep >= state.solverPath.length) return;
  state.stepRequested = true;
  wakePlaybackWaiters();
  renderMain();
});
$("solverStepBackButton").addEventListener("click", () => {
  if (!state.playback || !state.playbackPaused || !state.solverPath || state.solverStep <= 0) return;
  state.stepRequested = false;
  state.solverStep--;
  state.board = boardAt(state.initial, state.solverPath, state.solverStep);
  state.moves = state.solverPath.slice(0, state.solverStep);
  state.gameOver = false;
  renderMain();
  $("message").textContent = `Paused at move ${state.solverStep} of ${state.solverPath.length}. Use Step next to replay the next color.`;
});
$("greedySolveButton").addEventListener("click", () => {
  const path = greedy(state.initial, seededRandom((state.seed ^ 0x6D2B79F5) >>> 0));
  playSolver(path, "Greedy");
});
$("astarSolveButton").addEventListener("click", () => playSolver(state.targetPath, "A*"));

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  const keyMap = { r: 0, g: 1, b: 2, y: 3, c: 4, p: 5 };
  const color = keyMap[event.key.toLowerCase()];
  if (color !== undefined) play(color);
});

setupColors();
newGame();
