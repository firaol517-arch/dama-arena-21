/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Board,
  GameConfig,
  GameState,
  KingLandingRule,
  Move,
  MoveStep,
  Piece,
  PieceColor,
  PieceType,
  Position,
  StartingLayoutPreset,
} from './types.ts';
import { DEFAULT_CONFIG } from './types.ts';

export const BOARD_SIZE = 8;

/** Check if a square is dark (active playing square) */
export function isDarkSquare(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}

/** Check if coordinates are within board bounds */
export function inBounds(r: number, c: number, boardSize: number = 8): boolean {
  return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
}

/** Convert (r, c) to 1..32 (for 8x8) or 1..50 (for 10x10) Draughts notation */
export function posToNotation(r: number, c: number, boardSize: number = 8): number | null {
  if (!isDarkSquare(r, c) || !inBounds(r, c, boardSize)) return null;
  const squaresPerRow = boardSize / 2;
  return r * squaresPerRow + Math.floor(c / 2) + 1;
}

/** Convert notation number to (r, c) */
export function notationToPos(num: number, boardSize: number = 8): Position | null {
  const squaresPerRow = boardSize / 2;
  const maxSquare = squaresPerRow * boardSize;
  if (num < 1 || num > maxSquare) return null;
  const idx = num - 1;
  const r = Math.floor(idx / squaresPerRow);
  const rem = idx % squaresPerRow;
  const c = r % 2 === 0 ? rem * 2 + 1 : rem * 2;
  return { r, c };
}

/** Clone a board deeply */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

/** Create starting piece layout based on board size and preset */
export function createInitialBoard(
  boardSize: number = 8,
  preset: StartingLayoutPreset = 'standard_12'
): Board {
  const board: Board = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null)
  );

  let idCounter = 1;

  const placePiece = (r: number, c: number, color: PieceColor) => {
    board[r][c] = {
      id: `${color[0]}_${idCounter++}`,
      color,
      type: 'man',
    };
  };

  if (boardSize === 8) {
    // "ባለ 4" Ethiopian Standard 8x8 Board (4 dark squares per row)
    if (preset === 'compact_8') {
      // 2 rows per side = 8 pieces
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'black');
        }
      }
      for (let r = 6; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'white');
        }
      }
    } else {
      // standard_12: 3 rows per side = 12 pieces per side (Rows 3 & 4 empty)
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'black');
        }
      }
      for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'white');
        }
      }
    }
  } else {
    // 10x10 Board ("ባለ 5")
    if (preset === 'tactical_15') {
      // 3 rows: 15 pieces per side
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'black');
        }
      }
      for (let r = 7; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'white');
        }
      }
    } else {
      // standard_20: 4 rows: 20 pieces per side
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'black');
        }
      }
      for (let r = 6; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, 'white');
        }
      }
    }
  }

  return board;
}

/** Check if position should promote to King */
export function isPromotionRow(pos: Position, color: PieceColor, boardSize: number = 8): boolean {
  return (color === 'white' && pos.r === 0) || (color === 'black' && pos.r === boardSize - 1);
}

/** Serialization for board state hashing (repetition check) */
export function getBoardHash(board: Board, turn: PieceColor): string {
  const boardSize = board.length;
  const parts: string[] = [turn];
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p) {
        parts.push(`${r},${c}:${p.color[0]}${p.type[0]}`);
      }
    }
  }
  return parts.join(';');
}

/** 4 diagonal directions */
const DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Check if position is in a list of positions */
function includesPos(list: Position[], pos: Position): boolean {
  return list.some((p) => p.r === pos.r && p.c === pos.c);
}

/**
 * Generate all legal capture moves (and multi-capture sequences) starting from pos
 */
export function generateCapturesForPiece(
  board: Board,
  pos: Position,
  piece: Piece,
  config: GameConfig,
  currentSteps: MoveStep[] = [],
  capturedPositions: Position[] = []
): Move[] {
  const results: Move[] = [];
  const { r, c } = pos;
  const isKing = piece.type === 'king';
  const boardSize = config.boardSize;

  let foundContinuation = false;

  if (!isKing) {
    // Ordinary piece capture: can jump adjacent enemy in diagonal directions
    for (const [dr, dc] of DIRECTIONS) {
      const midR = r + dr;
      const midC = c + dc;
      const landR = r + 2 * dr;
      const landC = c + 2 * dc;

      if (!inBounds(midR, midC, boardSize) || !inBounds(landR, landC, boardSize)) continue;

      const midPiece = board[midR][midC];
      // Target must be enemy and not already captured in current sequence
      if (!midPiece || midPiece.color === piece.color || includesPos(capturedPositions, { r: midR, c: midC })) {
        continue;
      }

      // Landing square must be empty (or the original starting square vacated during a loop)
      const landingOccupant = board[landR][landC];
      const isStartPos = currentSteps.length > 0 && currentSteps[0].from.r === landR && currentSteps[0].from.c === landC;
      if (landingOccupant && !isStartPos) continue;

      foundContinuation = true;

      // Check immediate promotion
      const landsOnPromotion = isPromotionRow({ r: landR, c: landC }, piece.color, boardSize);
      const promotedNow = config.immediatePromotionInMultiJump && landsOnPromotion;

      const nextPiece: Piece = promotedNow
        ? { ...piece, type: 'king' }
        : { ...piece };

      const step: MoveStep = {
        from: pos,
        to: { r: landR, c: landC },
        captured: { r: midR, c: midC },
        promoted: landsOnPromotion,
      };

      const newCaptured = [...capturedPositions, { r: midR, c: midC }];
      const newSteps = [...currentSteps, step];

      // Recursively search for further captures from the landing position
      const subMoves = generateCapturesForPiece(
        board,
        { r: landR, c: landC },
        nextPiece,
        config,
        newSteps,
        newCaptured
      );

      results.push(...subMoves);
    }
  } else {
    // King piece capture: flying king capture over diagonal
    for (const [dr, dc] of DIRECTIONS) {
      let stepDist = 1;
      let enemyPos: Position | null = null;

      while (true) {
        const currR = r + dr * stepDist;
        const currC = c + dc * stepDist;
        if (!inBounds(currR, currC, boardSize)) break;

        const p = board[currR][currC];
        if (p) {
          if (p.color === piece.color || includesPos(capturedPositions, { r: currR, c: currC })) {
            // Blocked by friendly piece or already jumped piece
            break;
          }
          if (enemyPos === null) {
            // First enemy piece encountered
            enemyPos = { r: currR, c: currC };
          } else {
            // Second piece in line, cannot jump two pieces in one step
            break;
          }
        } else if (enemyPos !== null) {
          // Empty square past the enemy piece!
          const landR = currR;
          const landC = currC;

          // Check if landing rule allows this square
          const distPastEnemy = stepDist - (Math.abs(enemyPos.r - r));
          if (config.kingLandingRule === 'immediate_beyond' && distPastEnemy > 1) {
            break;
          }

          foundContinuation = true;

          const step: MoveStep = {
            from: pos,
            to: { r: landR, c: landC },
            captured: enemyPos,
          };

          const newCaptured = [...capturedPositions, enemyPos];
          const newSteps = [...currentSteps, step];

          const subMoves = generateCapturesForPiece(
            board,
            { r: landR, c: landC },
            piece,
            config,
            newSteps,
            newCaptured
          );

          results.push(...subMoves);

          if (config.kingLandingRule === 'immediate_beyond') {
            break;
          }
        }

        stepDist++;
      }
    }
  }

  if (!foundContinuation && currentSteps.length > 0) {
    const firstFrom = currentSteps[0].from;
    const finalTo = currentSteps[currentSteps.length - 1].to;
    const isPromotedAtEnd = isPromotionRow(finalTo, piece.color, boardSize);
    const promotedDuringJump = currentSteps.some((s) => s.promoted);

    results.push({
      from: firstFrom,
      to: finalTo,
      steps: currentSteps,
      capturedPositions,
      isPromotion: isPromotedAtEnd || promotedDuringJump || piece.type === 'king',
      promotedDuringJump,
    });
  }

  return results;
}

/**
 * Generate quiet (non-capturing) moves for an ordinary piece or king
 */
export function generateQuietMovesForPiece(
  board: Board,
  pos: Position,
  piece: Piece,
  config: GameConfig
): Move[] {
  const moves: Move[] = [];
  const { r, c } = pos;
  const boardSize = config.boardSize;

  if (piece.type === 'man') {
    // Ordinary piece quiet move:
    // When allowManBackwardMove is false (confirmed rule): moves forward only!
    const allowedDirections = config.allowManBackwardMove
      ? DIRECTIONS
      : piece.color === 'white'
      ? [
          [-1, -1],
          [-1, 1],
        ]
      : [
          [1, -1],
          [1, 1],
        ];

    for (const [dr, dc] of allowedDirections) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc, boardSize) && isDarkSquare(nr, nc) && !board[nr][nc]) {
        const promotes = isPromotionRow({ r: nr, c: nc }, piece.color, boardSize);
        moves.push({
          from: pos,
          to: { r: nr, c: nc },
          steps: [{ from: pos, to: { r: nr, c: nc }, promoted: promotes }],
          capturedPositions: [],
          isPromotion: promotes,
          promotedDuringJump: false,
        });
      }
    }
  } else {
    // Flying king quiet moves: slides any distance along 4 diagonals
    for (const [dr, dc] of DIRECTIONS) {
      let stepDist = 1;
      while (true) {
        const nr = r + dr * stepDist;
        const nc = c + dc * stepDist;
        if (!inBounds(nr, nc, boardSize) || board[nr][nc]) break;

        moves.push({
          from: pos,
          to: { r: nr, c: nc },
          steps: [{ from: pos, to: { r: nr, c: nc } }],
          capturedPositions: [],
          isPromotion: false,
          promotedDuringJump: false,
        });

        stepDist++;
      }
    }
  }

  return moves;
}

/**
 * Get all legal moves for the current turn.
 * Enforces MANDATORY CAPTURE: if any capture move exists, returns ONLY captures!
 */
export function getLegalMoves(state: GameState): Move[] {
  const { board, turn, config, activeCapturePiece } = state;
  const boardSize = config.boardSize;
  const allCaptures: Move[] = [];
  const allQuiets: Move[] = [];

  if (activeCapturePiece) {
    const p = board[activeCapturePiece.r][activeCapturePiece.c];
    if (p && p.color === turn) {
      return generateCapturesForPiece(
        board,
        activeCapturePiece,
        p,
        config,
        [],
        state.pendingCapturedPositions
      );
    }
    return [];
  }

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p && p.color === turn) {
        const captures = generateCapturesForPiece(board, { r, c }, p, config);
        if (captures.length > 0) {
          allCaptures.push(...captures);
        } else {
          const quiets = generateQuietMovesForPiece(board, { r, c }, p, config);
          allQuiets.push(...quiets);
        }
      }
    }
  }

  if (config.captureIsMandatory && allCaptures.length > 0) {
    return allCaptures;
  }

  return allQuiets;
}

/**
 * Initialize a new game state
 */
export function createNewGame(config: Partial<GameConfig> = {}): GameState {
  const finalConfig: GameConfig = { ...DEFAULT_CONFIG, ...config };
  const board = createInitialBoard(finalConfig.boardSize, finalConfig.startingLayout);
  const initialHash = getBoardHash(board, 'white');

  return {
    board,
    turn: 'white',
    status: 'playing',
    config: finalConfig,
    moveHistory: [],
    turnCount: 1,
    halfMovesWithoutCapture: 0,
    positionHistory: [initialHash],
    pendingCapturedPositions: [],
  };
}

/**
 * Apply a complete move to a GameState.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const newBoard = cloneBoard(state.board);
  const movingPiece = newBoard[move.from.r][move.from.c];
  const boardSize = state.config.boardSize;

  if (!movingPiece) {
    throw new Error(`No piece at starting position ${move.from.r},${move.from.c}`);
  }

  newBoard[move.from.r][move.from.c] = null;

  for (const cap of move.capturedPositions) {
    newBoard[cap.r][cap.c] = null;
  }

  let finalType: PieceType = movingPiece.type;
  if (
    movingPiece.type === 'man' &&
    (move.isPromotion || move.promotedDuringJump || isPromotionRow(move.to, movingPiece.color, boardSize))
  ) {
    finalType = 'king';
  }

  newBoard[move.to.r][move.to.c] = {
    ...movingPiece,
    type: finalType,
  };

  const nextTurn: PieceColor = state.turn === 'white' ? 'black' : 'white';
  const isCapture = move.capturedPositions.length > 0;
  const halfMovesWithoutCapture = isCapture ? 0 : state.halfMovesWithoutCapture + 1;

  const nextHash = getBoardHash(newBoard, nextTurn);
  const newPosHistory = [...state.positionHistory, nextHash];
  const repetitionCount = newPosHistory.filter((h) => h === nextHash).length;

  const intermediateState: GameState = {
    board: newBoard,
    turn: nextTurn,
    status: 'playing',
    config: state.config,
    moveHistory: [...state.moveHistory, move],
    turnCount: nextTurn === 'white' ? state.turnCount + 1 : state.turnCount,
    halfMovesWithoutCapture,
    positionHistory: newPosHistory,
    pendingCapturedPositions: [],
  };

  const opponentMoves = getLegalMoves(intermediateState);

  let opponentPieceCount = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = newBoard[r][c];
      if (p && p.color === nextTurn) {
        opponentPieceCount++;
      }
    }
  }

  if (opponentPieceCount === 0) {
    return {
      ...intermediateState,
      status: state.turn === 'white' ? 'white_won' : 'black_won',
      winner: state.turn,
      statusReason: `All ${nextTurn} pieces captured!`,
    };
  }

  if (opponentMoves.length === 0) {
    if (state.config.stalemateRule === 'loss') {
      return {
        ...intermediateState,
        status: state.turn === 'white' ? 'white_won' : 'black_won',
        winner: state.turn,
        statusReason: `${nextTurn} has no legal moves remaining.`,
      };
    } else {
      return {
        ...intermediateState,
        status: 'draw',
        statusReason: `Stalemate: ${nextTurn} has no legal moves.`,
      };
    }
  }

  if (state.config.repetitionRuleEnabled && repetitionCount >= 3) {
    return {
      ...intermediateState,
      status: 'draw',
      statusReason: 'Draw by 3-fold repetition of position.',
    };
  }

  if (
    state.config.moveLimitWithoutCapture > 0 &&
    halfMovesWithoutCapture >= state.config.moveLimitWithoutCapture * 2
  ) {
    return {
      ...intermediateState,
      status: 'draw',
      statusReason: `Draw by ${state.config.moveLimitWithoutCapture}-move rule without capture.`,
    };
  }

  return intermediateState;
}

/**
 * Execute a single step in an interactive turn.
 */
export function executeInteractiveStep(
  state: GameState,
  from: Position,
  to: Position
): { nextState: GameState; turnContinues: boolean } {
  const legalMoves = getLegalMoves(state);
  const matchingMoves = legalMoves.filter(
    (m) =>
      m.from.r === from.r &&
      m.from.c === from.c &&
      (m.steps[0].to.r === to.r && m.steps[0].to.c === to.c)
  );

  if (matchingMoves.length === 0) {
    throw new Error('Illegal step attempted');
  }

  const selectedFirstStep = matchingMoves[0].steps[0];
  const isCapture = Boolean(selectedFirstStep.captured);

  const newBoard = cloneBoard(state.board);
  const piece = newBoard[from.r][from.c]!;
  newBoard[from.r][from.c] = null;

  const capturedPositions = state.pendingCapturedPositions ? [...state.pendingCapturedPositions] : [];
  if (selectedFirstStep.captured) {
    capturedPositions.push(selectedFirstStep.captured);
    newBoard[selectedFirstStep.captured.r][selectedFirstStep.captured.c] = null;
  }

  let currentType = piece.type;
  const reachedPromotion = isPromotionRow(to, piece.color, state.config.boardSize);
  if (reachedPromotion && (state.config.immediatePromotionInMultiJump || matchingMoves[0].steps.length === 1)) {
    currentType = 'king';
  }

  newBoard[to.r][to.c] = {
    ...piece,
    type: currentType,
  };

  let furtherCaptures: Move[] = [];
  if (isCapture) {
    furtherCaptures = generateCapturesForPiece(
      newBoard,
      to,
      { ...piece, type: currentType },
      state.config,
      [],
      capturedPositions
    );
  }

  if (furtherCaptures.length > 0) {
    return {
      nextState: {
        ...state,
        board: newBoard,
        activeCapturePiece: to,
        pendingCapturedPositions: capturedPositions,
      },
      turnContinues: true,
    };
  } else {
    const completedMove: Move = {
      from: state.activeCapturePiece || from,
      to,
      steps: [selectedFirstStep],
      capturedPositions,
      isPromotion: currentType === 'king' && piece.type === 'man',
      promotedDuringJump: false,
    };

    const tempState: GameState = {
      ...state,
      activeCapturePiece: undefined,
      pendingCapturedPositions: [],
    };

    return {
      nextState: applyMove(tempState, completedMove),
      turnContinues: false,
    };
  }
}
