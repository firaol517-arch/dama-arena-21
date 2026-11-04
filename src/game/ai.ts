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
  randomness: number; // 0 (tactical master) to 0.25 (gentle beginner)
}

export const DIFFICULTY_PRESETS: Record<AiDifficulty, AiConfig> = {
  beginner: {
    maxDepth: 2,
    useQuiescence: false,
    timeLimitMs: 150,
    randomness: 0.25,
  },
  easy: {
    maxDepth: 3,
    useQuiescence: true,
    timeLimitMs: 250,
    randomness: 0.1,
  },
  medium: {
    maxDepth: 4,
    useQuiescence: true,
    timeLimitMs: 400,
    randomness: 0,
  },
  hard: {
    maxDepth: 6,
    useQuiescence: true,
    timeLimitMs: 750,
    randomness: 0,
  },
  expert: {
    maxDepth: 7,
    useQuiescence: true,
    timeLimitMs: 1200,
    randomness: 0,
  },
};

// Strategic weights for Ethiopian Dama
// In Ethiopian Dama, a King flies freely across the entire diagonal; it is extremely powerful.
const MAN_VALUE = 100;
const KING_VALUE = 480;
const CENTER_BONUS = 25;
const ADVANCE_BONUS = 14;
const BACK_RANK_DEFENSE = 35;
const MULTI_CAPTURE_BONUS = 150;
const PROMOTION_THREAT_BONUS = 180;

function isCenterSquare(r: number, c: number, boardSize: number = 8): boolean {
  if (boardSize === 8) {
    return (r === 3 || r === 4) && (c >= 2 && c <= 5);
  }
  return (r === 4 || r === 5) && (c >= 3 && c <= 6);
}

/**
 * Heuristic static evaluation function
 * Evaluates from the perspective of active color (+ means winning)
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
        // Center control (central squares control board diagonals)
        if (isCenterSquare(r, c, boardSize)) {
          pieceScore += CENTER_BONUS;
        }

        // Advance towards promotion (exponential as it gets closer to last row)
        if (isWhite) {
          const distToPromotion = r; // white moves upward towards r = 0
          const rankAdvance = boardSize - 1 - r;
          pieceScore += rankAdvance * ADVANCE_BONUS;
          if (distToPromotion === 1) pieceScore += PROMOTION_THREAT_BONUS;

          // Back rank defense bonus (protect against king infiltration)
          if (r === boardSize - 1) pieceScore += BACK_RANK_DEFENSE;
          whiteMen++;
        } else {
          const distToPromotion = boardSize - 1 - r; // black moves downward towards r = boardSize - 1
          pieceScore += r * ADVANCE_BONUS;
          if (distToPromotion === 1) pieceScore += PROMOTION_THREAT_BONUS;

          if (r === 0) pieceScore += BACK_RANK_DEFENSE;
          blackMen++;
        }
      } else {
        if (isWhite) whiteKings++;
        else blackKings++;

        // King mobility and diagonal dominance
        if (isCenterSquare(r, c, boardSize)) pieceScore += CENTER_BONUS * 2;
      }

      if (isWhite) {
        score += pieceScore;
      } else {
        score -= pieceScore;
      }
    }
  }

  // Active mobility reward (number of available legal moves)
  const legalMoves = getLegalMoves(state);
  const activeMobility = legalMoves.length * 8;
  if (state.turn === 'white') {
    score += activeMobility;
  } else {
    score -= activeMobility;
  }

  return forColor === 'white' ? score : -score;
}

/**
 * Move ordering function:
 * Captures first (highest number of captured pieces first, kings first), then promotions, then center control.
 */
function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    // Multi-captures highest priority
    const capDiff = b.capturedPositions.length - a.capturedPositions.length;
    if (capDiff !== 0) return capDiff;

    // Promotion next
    if (a.isPromotion !== b.isPromotion) {
      return a.isPromotion ? -1 : 1;
    }

    // Center squares
    const aCenter = isCenterSquare(a.to.r, a.to.c) ? 1 : 0;
    const bCenter = isCenterSquare(b.to.r, b.to.c) ? 1 : 0;
    return bCenter - aCenter;
  });
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
  bestMove?: Move;
}

const transpositionTable = new Map<string, TTEntry>();

export function resetTranspositionTable(): void {
  transpositionTable.clear();
}

/**
 * Quiescence search to prevent horizon effect on capture chains
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
      return { score: quiescence(state, alpha, beta, aiColor, 4, deadline) };
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

  // Mandatory capture rule enforcement: If captures exist, MUST evaluate captures!
  const captureMoves = legalMoves.filter((m) => m.capturedPositions.length > 0);
  const candidateMoves = captureMoves.length > 0 ? captureMoves : legalMoves;

  const ordered = orderMoves(candidateMoves);
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
 * Master search routine: Iterative Deepening Minimax with Absolute Capture Enforcement
 */
export function findBestMove(
  state: GameState,
  difficulty: AiDifficulty = 'medium'
): AiSearchResult | null {
  const legalMoves = getLegalMoves(state);
  if (legalMoves.length === 0) {
    return null;
  }

  // Ethiopian Dama Rule: If any piece can capture an opponent piece, AI MUST ALWAYS CAPTURE!
  const captureMoves = legalMoves.filter((m) => m.capturedPositions.length > 0);
  const movesToConsider = captureMoves.length > 0 ? captureMoves : legalMoves;

  const cfg = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;
  const startTime = Date.now();
  const deadline = startTime + cfg.timeLimitMs;

  // If only one candidate move, return immediately!
  if (movesToConsider.length === 1) {
    return {
      move: movesToConsider[0],
      depthReached: 1,
      score: evaluatePosition(state, state.turn),
      timeTakenMs: Date.now() - startTime,
    };
  }

  // Beginner randomness jitter (only amongst safe moves, but still captures if possible)
  if (cfg.randomness > 0 && Math.random() < cfg.randomness) {
    const ordered = orderMoves(movesToConsider);
    const pickRange = Math.min(3, ordered.length);
    const randomPick = ordered[Math.floor(Math.random() * pickRange)];
    return {
      move: randomPick,
      depthReached: 1,
      score: evaluatePosition(state, state.turn),
      timeTakenMs: Date.now() - startTime,
    };
  }

  let overallBestMove = movesToConsider[0];
  let overallScore = 0;
  let maxDepthReached = 1;

  resetTranspositionTable();

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
      // Ensure bestMove belongs to candidate moves
      const isValidCandidate = movesToConsider.some(
        (m) =>
          m.from.r === bestMove.from.r &&
          m.from.c === bestMove.from.c &&
          m.to.r === bestMove.to.r &&
          m.to.c === bestMove.to.c
      );

      if (isValidCandidate) {
        overallBestMove = bestMove;
        overallScore = score;
        maxDepthReached = currentDepth;
      }
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
 * Async wrapper that yields to event loop with failsafe error handling so UI never locks up
 */
export async function getAiMoveAsync(
  state: GameState,
  difficulty: AiDifficulty = 'medium'
): Promise<AiSearchResult | null> {
  const minDelay = 100;
  const start = Date.now();

  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const result = findBestMove(state, difficulty);
        const elapsed = Date.now() - start;
        const remainingDelay = Math.max(0, minDelay - elapsed);
        setTimeout(() => resolve(result), remainingDelay);
      } catch (err) {
        console.error('Error in AI calculation:', err);
        const legal = getLegalMoves(state);
        if (legal.length > 0) {
          const captures = legal.filter((m) => m.capturedPositions.length > 0);
          resolve({
            move: captures.length > 0 ? captures[0] : legal[0],
            depthReached: 1,
            score: 0,
            timeTakenMs: 0,
          });
        } else {
          resolve(null);
        }
      }
    }, 15);
  });
}
