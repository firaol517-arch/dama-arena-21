/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  applyMove,
  BOARD_SIZE,
  getBoardHash,
  getLegalMoves,
  isDarkSquare,
} from './engine';
import { GameState, Move, PieceColor } from './types';

export type AiDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export interface AiConfig {
  maxDepth: number;
  useQuiescence: boolean;
  timeLimitMs: number;
  randomness: number; // 0 (deterministic) to 1 (high jitter for beginner)
}

export const DIFFICULTY_PRESETS: Record<AiDifficulty, AiConfig> = {
  beginner: {
    maxDepth: 1,
    useQuiescence: false,
    timeLimitMs: 250,
    randomness: 0.35,
  },
  easy: {
    maxDepth: 2,
    useQuiescence: false,
    timeLimitMs: 400,
    randomness: 0.15,
  },
  medium: {
    maxDepth: 3,
    useQuiescence: true,
    timeLimitMs: 800,
    randomness: 0.05,
  },
  hard: {
    maxDepth: 5,
    useQuiescence: true,
    timeLimitMs: 1500,
    randomness: 0,
  },
  expert: {
    maxDepth: 7,
    useQuiescence: true,
    timeLimitMs: 2500,
    randomness: 0,
  },
};

// Material weights
const MAN_VALUE = 100;
const KING_VALUE = 340;
const CENTER_BONUS = 15;
const ADVANCE_BONUS = 8;
const BACK_RANK_DEFENSE = 20;

// Center squares on 10x10 dark board (rows 4, 5 and cols 3, 4, 5, 6)
function isCenterSquare(r: number, c: number, boardSize: number = 8): boolean {
  if (boardSize === 8) {
    return (r === 3 || r === 4) && (c >= 2 && c <= 5);
  }
  return (r === 4 || r === 5) && (c >= 3 && c <= 6);
}

/**
 * Heuristic static evaluation function
 * Evaluates from the perspective of active color (+ means active color winning)
 */
export function evaluatePosition(state: GameState, forColor: PieceColor): number {
  if (state.status === 'white_won') {
    return forColor === 'white' ? 100000 : -100000;
  }
  if (state.status === 'black_won') {
    return forColor === 'black' ? 100000 : -100000;
  }
  if (state.status === 'draw') {
    return 0;
  }

  const { board } = state;
  const boardSize = state.config.boardSize || board.length;
  let score = 0;

  let whiteMen = 0;
  let whiteKings = 0;
  let blackMen = 0;
  let blackKings = 0;

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (!p) continue;

      const isWhite = p.color === 'white';
      const isKing = p.type === 'king';
      const val = isKing ? KING_VALUE : MAN_VALUE;

      let pieceScore = val;

      if (!isKing) {
        // Center control
        if (isCenterSquare(r, c, boardSize)) {
          pieceScore += CENTER_BONUS;
        }

        // Advance towards promotion
        if (isWhite) {
          pieceScore += (boardSize - 1 - r) * ADVANCE_BONUS;
          // Back rank defense bonus (protect against king infiltration)
          if (r === boardSize - 1) pieceScore += BACK_RANK_DEFENSE;
          whiteMen++;
        } else {
          pieceScore += r * ADVANCE_BONUS;
          if (r === 0) pieceScore += BACK_RANK_DEFENSE;
          blackMen++;
        }
      } else {
        if (isWhite) whiteKings++;
        else blackKings++;

        // King center mobility bonus
        if (isCenterSquare(r, c, boardSize)) pieceScore += CENTER_BONUS * 1.5;
      }

      if (isWhite) {
        score += pieceScore;
      } else {
        score -= pieceScore;
      }
    }
  }

  // Quick mobility estimation
  const legalMoves = getLegalMoves(state);
  const activeMobility = legalMoves.length * 6;
  if (state.turn === 'white') {
    score += activeMobility;
  } else {
    score -= activeMobility;
  }

  return forColor === 'white' ? score : -score;
}

/**
 * Move ordering function:
 * Captures first (multi-captures highest), then promotions, then center moves.
 */
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    // Multi-captures first
    const capDiff = b.capturedPositions.length - a.capturedPositions.length;
    if (capDiff !== 0) return capDiff;

    // Promotion next
    if (a.isPromotion !== b.isPromotion) {
      return a.isPromotion ? -1 : 1;
    }

    // Move to center squares
    const aCenter = isCenterSquare(a.to.r, a.to.c) ? 1 : 0;
    const bCenter = isCenterSquare(b.to.r, b.to.c) ? 1 : 0;
    return bCenter - aCenter;
  });
}

/**
 * Simple in-memory Transposition Table for current search
 */
interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove?: Move;
}

const transpositionTable = new Map<string, TTEntry>();

/** Clear transposition table between independent game evaluations */
export function resetTranspositionTable(): void {
  transpositionTable.clear();
}

/**
 * Quiescence search to avoid the horizon effect on capture sequences
 */
function quiescence(
  state: GameState,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  depth: number,
  deadline: number
): number {
  if (Date.now() > deadline || depth <= 0) {
    return evaluatePosition(state, aiColor);
  }

  const standPat = evaluatePosition(state, aiColor);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;

  const legalMoves = getLegalMoves(state);
  // Only evaluate captures in quiescence
  const captureMoves = legalMoves.filter((m) => m.capturedPositions.length > 0);
  if (captureMoves.length === 0) return standPat;

  const orderedCaptures = orderMoves(captureMoves);

  for (const move of orderedCaptures) {
    const nextState = applyMove(state, move);
    const score = -quiescence(nextState, -beta, -alpha, aiColor, depth - 1, deadline);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * Minimax with Alpha-Beta Pruning, Transposition Table, and Move Ordering
 */
function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiColor: PieceColor,
  deadline: number,
  useQuiescence: boolean
): { score: number; bestMove?: Move } {
  if (Date.now() > deadline) {
    return { score: evaluatePosition(state, aiColor) };
  }

  if (state.status !== 'playing') {
    return { score: evaluatePosition(state, aiColor) };
  }

  if (depth === 0) {
    if (useQuiescence) {
      return { score: quiescence(state, alpha, beta, aiColor, 3, deadline) };
    }
    return { score: evaluatePosition(state, aiColor) };
  }

  const hash = getBoardHash(state.board, state.turn);
  const ttHit = transpositionTable.get(hash);
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.flag === 'exact') return { score: ttHit.score, bestMove: ttHit.bestMove };
    if (ttHit.flag === 'lower' && ttHit.score > alpha) alpha = ttHit.score;
    if (ttHit.flag === 'upper' && ttHit.score < beta) beta = ttHit.score;
    if (alpha >= beta) return { score: ttHit.score, bestMove: ttHit.bestMove };
  }

  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) {
    return { score: evaluatePosition(state, aiColor) };
  }

  const ordered = orderMoves(legalMoves);
  let bestMove: Move = ordered[0];
  let maxScore = -Infinity;
  const originalAlpha = alpha;

  for (const move of ordered) {
    const nextState = applyMove(state, move);
    const result = alphaBeta(nextState, depth - 1, -beta, -alpha, aiColor, deadline, useQuiescence);
    const score = -result.score;

    if (score > maxScore) {
      maxScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      break; // Alpha-beta cutoff
    }
  }

  // Store in TT
  let flag: 'exact' | 'lower' | 'upper' = 'exact';
  if (maxScore <= originalAlpha) flag = 'upper';
  else if (maxScore >= beta) flag = 'lower';

  transpositionTable.set(hash, {
    depth,
    score: maxScore,
    flag,
    bestMove,
  });

  return { score: maxScore, bestMove };
}

export interface AiSearchResult {
  move: Move;
  depthReached: number;
  score: number;
  timeTakenMs: number;
}

/**
 * Master search routine: Iterative Deepening Minimax
 */
export function findBestMove(
  state: GameState,
  difficulty: AiDifficulty = 'medium'
): AiSearchResult {
  const cfg = DIFFICULTY_PRESETS[difficulty];
  const startTime = Date.now();
  const deadline = startTime + cfg.timeLimitMs;

  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) {
    throw new Error('No legal moves available for AI');
  }

  // If only one legal move (e.g. single mandatory capture), return immediately!
  if (legalMoves.length === 1) {
    return {
      move: legalMoves[0],
      depthReached: 1,
      score: evaluatePosition(state, state.turn),
      timeTakenMs: Date.now() - startTime,
    };
  }

  // Beginner / Easy randomness jitter
  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    // Pick among top 3 or random legal move
    const ordered = orderMoves(legalMoves);
    const pickRange = Math.min(3, ordered.length);
    const randomPick = ordered[Math.floor(Math.random() * pickRange)];
    return {
      move: randomPick,
      depthReached: 1,
      score: evaluatePosition(state, state.turn),
      timeTakenMs: Date.now() - startTime,
    };
  }

  let overallBestMove = legalMoves[0];
  let overallScore = 0;
  let maxDepthReached = 1;

  resetTranspositionTable();

  // Iterative deepening from depth 1 up to cfg.maxDepth
  for (let currentDepth = 1; currentDepth <= cfg.maxDepth; currentDepth++) {
    if (Date.now() > deadline && currentDepth > 1) {
      break;
    }

    const { score, bestMove } = alphaBeta(
      state,
      currentDepth,
      -Infinity,
      Infinity,
      state.turn,
      deadline,
      cfg.useQuiescence
    );

    if (bestMove) {
      overallBestMove = bestMove;
      overallScore = score;
      maxDepthReached = currentDepth;
    }

    if (Date.now() > deadline) break;
  }

  return {
    move: overallBestMove,
    depthReached: maxDepthReached,
    score: overallScore,
    timeTakenMs: Date.now() - startTime,
  };
}

/**
 * Async wrapper that yields to event loop so browser UI never freezes
 */
export async function getAiMoveAsync(
  state: GameState,
  difficulty: AiDifficulty = 'medium'
): Promise<AiSearchResult> {
  // Add a minimum aesthetic thinking delay (400ms) for human comfort
  const minDelay = 400;
  const start = Date.now();

  return new Promise((resolve) => {
    setTimeout(() => {
      const result = findBestMove(state, difficulty);
      const elapsed = Date.now() - start;
      const remainingDelay = Math.max(0, minDelay - elapsed);

      setTimeout(() => {
        resolve(result);
      }, remainingDelay);
    }, 20);
  });
}
