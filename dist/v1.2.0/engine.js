export const COLS = 7, ROWS = 6, COLORS = 6;
export const validIndex = i => Number.isInteger(i) && i >= 0 && i < COLS * ROWS;
export const adjacent = (a, b) => validIndex(a) && validIndex(b) && Math.abs(a % COLS - b % COLS) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) === 1;
export function swap(board, a, b) {
  const next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
export function findMatches(board) {
  const found = new Set();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col, value = board[i];
      if (value === null || value === undefined) continue;
      if (col <= COLS - 3 && board[i + 1] === value && board[i + 2] === value) {
        for (let c = col; c < COLS && board[row * COLS + c] === value; c++) found.add(row * COLS + c);
      }
      if (row <= ROWS - 3 && board[i + COLS] === value && board[i + COLS * 2] === value) {
        for (let r = row; r < ROWS && board[r * COLS + col] === value; r++) found.add(r * COLS + col);
      }
    }
  }
  return [...found].sort((a, b) => a - b);
}
export function legalMoves(board) {
  const moves = [];
  for (let a = 0; a < ROWS * COLS; a++) {
    for (const b of [a + 1, a + COLS]) {
      if (adjacent(a, b) && board[a] !== board[b] && findMatches(swap(board, a, b)).length) moves.push([a, b]);
    }
  }
  return moves;
}
const randomColor = rng => Math.min(COLORS - 1, Math.max(0, Math.floor(rng() * COLORS)));
export function collapse(board, matched, rng = Math.random) {
  const removed = new Set(matched), next = new Array(ROWS * COLS), drops = [];
  for (let col = 0; col < COLS; col++) {
    let targetRow = ROWS - 1;
    for (let row = ROWS - 1; row >= 0; row--) {
      const from = row * COLS + col;
      if (!removed.has(from)) {
        const to = targetRow-- * COLS + col;
        next[to] = board[from];
        drops.push({from, to});
      }
    }
    const missing = targetRow + 1;
    for (let row = targetRow; row >= 0; row--) {
      const to = row * COLS + col;
      next[to] = randomColor(rng);
      drops.push({from: (row - missing) * COLS + col, to});
    }
  }
  return {board: next, drops};
}
// Deterministic fallback also guarantees progress for pathological random sources.
function guaranteedBoard() {
  const board = Array.from({length: ROWS * COLS}, (_, i) => (Math.floor(i / COLS) * 2 + i % COLS) % COLORS);
  board[0] = 0; board[1] = 1; board[2] = 0; board[COLS + 1] = 0;
  return board;
}
export function createBoard(rng = Math.random) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const board = [];
    for (let i = 0; i < ROWS * COLS; i++) {
      let value = randomColor(rng);
      while ((i % COLS >= 2 && board[i - 1] === value && board[i - 2] === value) || (i >= 2 * COLS && board[i - COLS] === value && board[i - COLS * 2] === value)) value = (value + 1) % COLORS;
      board.push(value);
    }
    if (legalMoves(board).length) return board;
  }
  return guaranteedBoard();
}
export function shuffleBoard(board, rng = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = [...board];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (!findMatches(next).length && legalMoves(next).length) return next;
  }
  // A degenerate color distribution cannot always be permuted into a playable board.
  return createBoard(rng);
}
export const pointsFor = (count, chain) => count * 10 * chain;
export function validateSnapshot(data) {
  return !!data && data.version === 2 && data.cols === COLS && data.rows === ROWS && Array.isArray(data.board) && data.board.length === ROWS * COLS && data.board.every(c => Number.isInteger(c) && c >= 0 && c < COLORS) && Number.isSafeInteger(data.score) && data.score >= 0 && Number.isSafeInteger(data.best) && data.best >= data.score && !findMatches(data.board).length;
}
export function parseSnapshot(raw) {
  try { const data = JSON.parse(raw); return validateSnapshot(data) ? data : null; } catch { return null; }
}
export class Game {
  constructor({board = createBoard(), score = 0, best = 0, rng = Math.random, onPhase = async () => {}, onSave = () => {}, canMove = () => true, canScore = () => true} = {}) {
    this.board = [...board]; this.score = score; this.best = Math.max(best, score);
    this.canMove = canMove; this.canScore = canScore;
    this.rng = rng; this.onPhase = onPhase; this.onSave = onSave; this.locked = false;
  }
  snapshot() { return {version: 2, cols: COLS, rows: ROWS, board: [...this.board], score: this.score, best: this.best}; }
  async move(a, b) {
    if (this.locked || !this.canMove() || !adjacent(a, b)) return {accepted: false, reason: 'locked-or-invalid'};
    this.locked = true;
    const previous = this.snapshot();
    try {
      this.board = swap(this.board, a, b);
      await this.onPhase({type: 'swap', a, b});
      let matched = findMatches(this.board);
      if (!matched.length) {
        this.board = previous.board;
        await this.onPhase({type: 'revert', a, b});
        return {accepted: false, reason: 'no-match'};
      }
      let chain = 0, total = 0;
      while (matched.length) {
        chain++;
        const points = this.canScore() ? pointsFor(matched.length, chain) : 0;
        this.score += points; this.best = Math.max(this.best, this.score); total += matched.length;
        await this.onPhase({type: 'clear', matched, chain, points});
        const result = collapse(this.board, matched, this.rng);
        this.board = result.board;
        await this.onPhase({type: 'fall', drops: result.drops});
        matched = findMatches(this.board);
        // Prevent a broken/custom RNG from causing an infinite turn.
        if (chain >= 100 && matched.length) { this.board = createBoard(this.rng); await this.onPhase({type: 'shuffle'}); break; }
      }
      if (!legalMoves(this.board).length) { this.board = shuffleBoard(this.board, this.rng); await this.onPhase({type: 'shuffle'}); }
      this.onSave(this.snapshot());
      return {accepted: true, chain, cleared: total};
    } catch (error) {
      this.board = previous.board; this.score = previous.score; this.best = previous.best;
      throw error;
    } finally { this.locked = false; }
  }
}
