/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, BOARD_SIZE } from './engine';
import { findBestMove, evaluatePosition, DIFFICULTY_PRESETS } from './ai';
import { Board, GameState } from './types';

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

test('AI evaluates material advantage correctly', () => {
  const emptyBoard = createEmptyBoard();
  emptyBoard[5][4] = { id: 'w1', color: 'white', type: 'king' };
  emptyBoard[2][3] = { id: 'b1', color: 'black', type: 'man' };

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'white',
  };

  const whiteEval = evaluatePosition(state, 'white');
  const blackEval = evaluatePosition(state, 'black');

  assert.ok(whiteEval > 0, 'White evaluation is positive with king vs man');
  assert.ok(blackEval < 0, 'Black evaluation is negative with king vs man');
});

test('AI executes mandatory capture when faced with choice', () => {
  const emptyBoard = createEmptyBoard();
  // Black piece to move
  emptyBoard[4][3] = { id: 'b1', color: 'black', type: 'man' };
  // White piece that can be captured
  emptyBoard[5][4] = { id: 'w1', color: 'white', type: 'man' };

  const state: GameState = {
    ...createNewGame(),
    board: emptyBoard,
    turn: 'black',
  };

  const { move } = findBestMove(state, 'medium');
  assert.equal(move.capturedPositions.length, 1, 'AI makes mandatory capture');
  assert.equal(move.to.r, 6);
  assert.equal(move.to.c, 5);
});

test('AI responds quickly within time limit', () => {
  const state = createNewGame({ startingLayout: 'compact_8' });
  const start = Date.now();
  const result = findBestMove(state, 'easy');
  const elapsed = Date.now() - start;

  assert.ok(result.move, 'AI returns valid move');
  assert.ok(elapsed < 1000, `AI searched within budget, took ${elapsed}ms`);
});
