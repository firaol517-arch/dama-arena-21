/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewGame,
  applyMove,
  getLegalMoves,
  createInitialBoard,
  isDarkSquare,
  generateCapturesForPiece,
  BOARD_SIZE,
} from './engine';
import { Board, GameState, Move, DEFAULT_CONFIG, Position } from './types';

// Helper to create an empty board
function createEmptyBoard(size: number = 8): Board {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
}

test('1. Board initialization and layout presets: 8x8 (bale 4) and 10x10', () => {
  // Default 8x8 "ባለ 4" Ethiopian board has 12 pieces per side (3 rows of 4)
  const defaultGame = createNewGame();
  assert.equal(defaultGame.config.boardSize, 8);
  let whiteCount8 = 0;
  let blackCount8 = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = defaultGame.board[r][c];
      if (p?.color === 'white') whiteCount8++;
      if (p?.color === 'black') blackCount8++;
    }
  }
  assert.equal(whiteCount8, 12, 'Default 8x8 (bale 4) has 12 white pieces in 3 rows');
  assert.equal(blackCount8, 12, 'Default 8x8 (bale 4) has 12 black pieces in 3 rows');

  // Verify 10x10 standard_20 preset
  const stdGame = createNewGame({ boardSize: 10, startingLayout: 'standard_20' });
  let whiteCount10 = 0;
  let blackCount10 = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const p = stdGame.board[r][c];
      if (p?.color === 'white') whiteCount10++;
      if (p?.color === 'black') blackCount10++;
    }
  }
  assert.equal(whiteCount10, 20, '10x10 preset has 20 white pieces');
  assert.equal(blackCount10, 20, '10x10 preset has 20 black pieces');
});

test('2. Normal movement: ordinary piece moves diagonally forward only by default', () => {
  // Place a solitary white man at (5, 4) on dark square ((5+4)%2 === 1)
  const emptyBoard = createEmptyBoard();
  emptyBoard[5][4] = { id: 'w1', color: 'white', type: 'man' };

  const state: GameState = {
    ...createNewGame({ allowManBackwardMove: false }),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  // White piece at (5,4) moves forward only to (4,3) and (4,5) (cannot move backward)
  assert.equal(moves.length, 2, 'Ordinary piece moves forward diagonally only');
  const destinations = moves.map((m) => `${m.to.r},${m.to.c}`).sort();
  assert.deepEqual(destinations, ['4,3', '4,5']);
});

test('3. Mandatory capture enforcement', () => {
  // White at (5, 4) and (7, 6).
  // Black at (4, 3) which White at (5,4) CAN jump over to (3,2).
  // White at (7,6) only has quiet moves.
  // Rule: Captures are mandatory! Only capture moves must be returned.
  const emptyBoard = createEmptyBoard();
  emptyBoard[5][4] = { id: 'w1', color: 'white', type: 'man' };
  emptyBoard[7][6] = { id: 'w2', color: 'white', type: 'man' };
  emptyBoard[4][3] = { id: 'b1', color: 'black', type: 'man' }; // target

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  assert.equal(moves.length, 1, 'Only capture moves are returned when a capture is available');
  assert.equal(moves[0].from.r, 5);
  assert.equal(moves[0].from.c, 4);
  assert.equal(moves[0].to.r, 3);
  assert.equal(moves[0].to.c, 2);
  assert.equal(moves[0].capturedPositions.length, 1);
  assert.deepEqual(moves[0].capturedPositions[0], { r: 4, c: 3 });
});

test('4. Multiple captures (multi-jump sequence)', () => {
  // White at (6, 5).
  // Black at (5, 4) and (3, 2).
  // White jumps over (5,4) -> lands at (4,3) -> then jumps over (3,2) -> lands at (2,1).
  const emptyBoard = createEmptyBoard();
  emptyBoard[6][5] = { id: 'w1', color: 'white', type: 'man' };
  emptyBoard[5][4] = { id: 'b1', color: 'black', type: 'man' };
  emptyBoard[3][2] = { id: 'b2', color: 'black', type: 'man' };

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  assert.equal(moves.length, 1, 'Double capture sequence is generated');
  const move = moves[0];
  assert.equal(move.capturedPositions.length, 2, 'Two pieces captured in sequence');
  assert.equal(move.to.r, 2);
  assert.equal(move.to.c, 1);

  // Apply move and verify both captured pieces are removed
  const nextState = applyMove(state, move);
  assert.equal(nextState.board[5][4], null, 'First black piece removed');
  assert.equal(nextState.board[3][2], null, 'Second black piece removed');
  assert.equal(nextState.board[2][1]?.color, 'white', 'White piece at landing position');
  assert.equal(nextState.board[6][5], null, 'Original position cleared');
});

test('5. Choosing between alternative capture routes (no max capture mandate)', () => {
  // Confirmed Ethiopian Dama rule: "If multiple capture routes exist, the player may choose any legal route. Capturing the maximum possible number of pieces is NOT mandatory."
  // White at (6, 5).
  // Route A: jumps over (5, 4) to (4, 3) - single jump.
  // Route B: jumps over (5, 6) to (4, 7), then over (3, 8) to (2, 9) - double jump.
  const emptyBoard = createEmptyBoard(10);
  emptyBoard[6][5] = { id: 'w1', color: 'white', type: 'man' };
  emptyBoard[5][4] = { id: 'b1', color: 'black', type: 'man' };
  emptyBoard[5][6] = { id: 'b2', color: 'black', type: 'man' };
  emptyBoard[3][8] = { id: 'b3', color: 'black', type: 'man' };

  const state: GameState = {
    ...createNewGame({ boardSize: 10, majorityCaptureMandatory: false }),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  // Both routes must be available!
  const singleCapture = moves.find((m) => m.capturedPositions.length === 1);
  const doubleCapture = moves.find((m) => m.capturedPositions.length === 2);
  assert.ok(singleCapture, 'Single capture route is legally allowed');
  assert.ok(doubleCapture, 'Double capture route is legally allowed');
});

test('6. Promotion to King upon reaching the farthest row', () => {
  // White at (1, 2) moves diagonally forward to (0, 1) -> reaches row 0 -> becomes King
  const emptyBoard = createEmptyBoard();
  emptyBoard[1][2] = { id: 'w1', color: 'white', type: 'man' };

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  const promoMove = moves.find((m) => m.to.r === 0 && m.to.c === 1);
  assert.ok(promoMove, 'Found move reaching row 0');
  assert.equal(promoMove.isPromotion, true);

  const nextState = applyMove(state, promoMove);
  assert.equal(nextState.board[0][1]?.type, 'king', 'Piece promoted to King');
});

test('7. Immediate promotion during capture sequence & continuing capture as King', () => {
  // Confirmed Ethiopian Dama rule: "If promotion occurs during a capture sequence, the piece becomes a King immediately and can continue capturing as a King in the same turn!"
  // White man at (2, 5).
  // Black piece at (1, 4). White jumps over it and lands at row 0 (0, 3) -> PROMOTES TO KING!
  // At row 0 (0, 3), the newly promoted King looks down-left (dr=+1, dc=-1):
  // (1, 2) is empty, (2, 1) has enemy Black piece b2!
  // Flying King captures b2 at long range and lands at (3, 0)!
  const emptyBoard = createEmptyBoard();
  emptyBoard[2][5] = { id: 'w1', color: 'white', type: 'man' };
  emptyBoard[1][4] = { id: 'b1', color: 'black', type: 'man' };
  // Target for flying king along (dr=+1, dc=-1):
  emptyBoard[2][1] = { id: 'b2', color: 'black', type: 'man' };

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  // Find move that jumps over b1 to (0,3), promotes, and continues to jump b2 to (3,0)
  const multiKingMove = moves.find((m) => m.capturedPositions.length === 2);
  assert.ok(multiKingMove, 'Engine found multi-capture with immediate promotion mid-sequence');
  assert.equal(multiKingMove.promotedDuringJump, true);
  assert.equal(multiKingMove.to.r, 3);
  assert.equal(multiKingMove.to.c, 0);

  const nextState = applyMove(state, multiKingMove);
  assert.equal(nextState.board[0][3], null, 'Intermediate promotion square is vacated');
  assert.equal(nextState.board[1][4], null, 'First piece captured');
  assert.equal(nextState.board[2][1], null, 'Second piece captured by flying king');
  assert.equal(nextState.board[3][0]?.type, 'king', 'Piece ends turn as King');
});

test('8. King movement (flying king over multiple empty squares)', () => {
  // White king at (5, 4) in the middle of 10x10 empty board
  const emptyBoard = createEmptyBoard(10);
  emptyBoard[5][4] = { id: 'wk1', color: 'white', type: 'king' };

  const state: GameState = {
    ...createNewGame({ boardSize: 10 }),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  // Total quiet moves on 10x10 = 4 + 5 + 4 + 4 = 17 moves
  assert.equal(moves.length, 17, 'Flying king has full diagonal range');
});

test('9. Configurable King landing rule after long-range capture', () => {
  // White king at (7, 2). Black piece at (4, 5) on 10x10 board.
  // Beyond (4, 5) are empty squares: (3, 6), (2, 7), (1, 8), (0, 9).
  const setupBoard = () => {
    const b = createEmptyBoard(10);
    b[7][2] = { id: 'wk1', color: 'white', type: 'king' };
    b[4][5] = { id: 'b1', color: 'black', type: 'man' };
    return b;
  };

  // 9a. With 'all_beyond' rule: can land on (3,6), (2,7), (1,8), or (0,9) (4 options)
  const stateAll = {
    ...createNewGame({ boardSize: 10, kingLandingRule: 'all_beyond' }),
    board: setupBoard(),
    turn: 'white' as const,
  };
  const movesAll = getLegalMoves(stateAll);
  assert.equal(movesAll.length, 4, 'Flying king can land on all 4 squares beyond captured piece');

  // 9b. With 'immediate_beyond' rule: can only land on (3,6) (1 option)
  const stateImmediate = {
    ...createNewGame({ boardSize: 10, kingLandingRule: 'immediate_beyond' }),
    board: setupBoard(),
    turn: 'white' as const,
  };
  const movesImmediate = getLegalMoves(stateImmediate);
  assert.equal(movesImmediate.length, 1, 'Flying king can only land immediately beyond');
  assert.equal(movesImmediate[0].to.r, 3);
  assert.equal(movesImmediate[0].to.c, 6);
});

test('10. Win conditions & configurable stalemate rule', () => {
  // 10a. Win by wiping out all enemy pieces
  const emptyBoard = createEmptyBoard();
  emptyBoard[5][4] = { id: 'w1', color: 'white', type: 'man' };
  emptyBoard[4][3] = { id: 'b1', color: 'black', type: 'man' }; // only black piece

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const moves = getLegalMoves(state);
  const nextState = applyMove(state, moves[0]);
  assert.equal(nextState.status, 'white_won', 'White wins when all black pieces are captured');
  assert.equal(nextState.winner, 'white');

  // 10b. Stalemate rule configurable: 'loss' vs 'draw'
  // Create a block where black has a piece but 0 legal moves
  const blockedBoard = createEmptyBoard();
  // Black man trapped at corner (0, 1) by White at (1, 0) and (1, 2)
  // Note: if white is at (1,2) and black is at (0,1), can black jump over (1,2)?
  // Only if (2,3) is empty. If (2,3) is occupied by white, black cannot jump.
  blockedBoard[0][1] = { id: 'b1', color: 'black', type: 'man' };
  blockedBoard[1][0] = { id: 'w1', color: 'white', type: 'man' };
  blockedBoard[1][2] = { id: 'w2', color: 'white', type: 'man' };
  blockedBoard[2][3] = { id: 'w3', color: 'white', type: 'man' }; // blocks jump over (1,2)
  // And white at (6,7) to make a move that seals it
  blockedBoard[6][7] = { id: 'w4', color: 'white', type: 'man' };

  // If stalemateRule = 'loss', Black loses on no moves
  const stateLoss: GameState = {
    ...createNewGame({ stalemateRule: 'loss' }),
    board: blockedBoard,
    turn: 'white',
  };
  // White moves (6,7) to (5,6)
  const sealMove: Move = {
    from: { r: 6, c: 7 },
    to: { r: 5, c: 6 },
    steps: [{ from: { r: 6, c: 7 }, to: { r: 5, c: 6 } }],
    capturedPositions: [],
    isPromotion: false,
    promotedDuringJump: false,
  };
  const resultLoss = applyMove(stateLoss, sealMove);
  assert.equal(resultLoss.status, 'white_won', 'Black loses when trapped with stalemateRule=loss');

  // If stalemateRule = 'draw', it is a draw
  const stateDraw: GameState = {
    ...createNewGame({ stalemateRule: 'draw' }),
    board: blockedBoard,
    turn: 'white',
  };
  const resultDraw = applyMove(stateDraw, sealMove);
  assert.equal(resultDraw.status, 'draw', 'Stalemate is a draw with stalemateRule=draw');
});
