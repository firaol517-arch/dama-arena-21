/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Crown, AlertCircle } from 'lucide-react';
import { Board, GameState, Move, PieceColor, Position } from '../game/types';
import { BOARD_SIZE, inBounds, isDarkSquare, posToNotation } from '../game/engine';

interface DamaBoardProps {
  state: GameState;
  legalMoves: Move[];
  selectedPos: Position | null;
  onSelectPiece: (pos: Position) => void;
  onExecuteMove: (from: Position, to: Position) => void;
  flipped?: boolean;
  notationType: 'draughts_50' | 'algebraic' | 'none';
  disabled?: boolean;
}

export const DamaBoard: React.FC<DamaBoardProps> = ({
  state,
  legalMoves,
  selectedPos,
  onSelectPiece,
  onExecuteMove,
  flipped = false,
  notationType,
  disabled = false,
}) => {
  const { board, turn, activeCapturePiece } = state;

  // Find all pieces that have legal captures (for mandatory capture indicators)
  const piecesWithCaptures = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      if (m.capturedPositions.length > 0) {
        set.add(`${m.from.r},${m.from.c}`);
      }
    }
    return set;
  }, [legalMoves]);

  const hasMandatoryCapture = piecesWithCaptures.size > 0;

  // Filter legal moves for currently selected piece or ongoing multi-capture piece
  const effectivePos = activeCapturePiece || selectedPos;

  const selectedPieceMoves = useMemo(() => {
    if (!effectivePos) return [];
    return legalMoves.filter(
      (m) => m.from.r === effectivePos.r && m.from.c === effectivePos.c
    );
  }, [legalMoves, effectivePos]);

  // Valid landing target positions from first step
  const validTargets = useMemo(() => {
    const targets = new Map<string, { to: Position; isCapture: boolean }>();
    for (const m of selectedPieceMoves) {
      const step = m.steps[0];
      const key = `${step.to.r},${step.to.c}`;
      targets.set(key, { to: step.to, isCapture: Boolean(step.captured) });
    }
    return targets;
  }, [selectedPieceMoves]);

  // Last executed move for highlight trail
  const lastMove = state.moveHistory[state.moveHistory.length - 1];

  // Board dimension
  const boardSize = state.config.boardSize || board.length;
  const indices = Array.from({ length: boardSize }, (_, i) => i);
  const rowIndices = flipped ? [...indices].reverse() : indices;
  const colIndices = flipped ? [...indices].reverse() : indices;

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  const handleSquareClick = (r: number, c: number) => {
    if (disabled) return;

    const clickedPiece = board[r][c];

    // If active capture sequence is ongoing
    if (activeCapturePiece) {
      // Allow clicking the active piece itself to keep it selected
      if (r === activeCapturePiece.r && c === activeCapturePiece.c) {
        onSelectPiece(activeCapturePiece);
        return;
      }
      const target = validTargets.get(`${r},${c}`);
      if (target) {
        onExecuteMove(activeCapturePiece, { r, c });
      }
      return;
    }

    // If clicking a valid target square for selected piece
    if (effectivePos && validTargets.has(`${r},${c}`)) {
      onExecuteMove(effectivePos, { r, c });
      return;
    }

    // If clicking a friendly piece with legal moves
    if (clickedPiece && clickedPiece.color === turn) {
      // If mandatory captures exist, only allow selecting pieces that can capture
      if (hasMandatoryCapture && !piecesWithCaptures.has(`${r},${c}`)) {
        return;
      }
      onSelectPiece({ r, c });
    }
  };

  const gridClass = boardSize === 8 ? 'grid-cols-8 grid-rows-8' : 'grid-cols-10 grid-rows-10';

  return (
    <div className="relative flex flex-col items-center select-none w-full max-w-[min(490px,65vh)] mx-auto">
      {/* Mandatory capture banner reminder */}
      {hasMandatoryCapture && (
        <div className="mb-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-md animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>⚠️ መብላት ግዴታ ነው! የሚያበራውን ጠጠር ይምረጡ | Capture is Mandatory!</span>
        </div>
      )}

      {/* Board frame with wood/granite luxury border */}
      <div className="relative p-2 sm:p-2.5 rounded-2xl bg-gradient-to-b from-[#1E2638] via-[#151B27] to-[#0F131C] shadow-2xl border-2 border-amber-500/30 w-full aspect-square">
        {/* Board inner grid */}
        <div className={`grid ${gridClass} w-full h-full rounded-xl overflow-hidden border border-slate-700/80 shadow-inner bg-[#222A38]`}>
          {rowIndices.map((r) =>
            colIndices.map((c) => {
              const isDark = isDarkSquare(r, c);
              const piece = board[r][c];
              const isSelected = selectedPos?.r === r && selectedPos?.c === c;
              const notationNum = posToNotation(r, c, boardSize);
              const target = validTargets.get(`${r},${c}`);
              const canCaptureNow = piecesWithCaptures.has(`${r},${c}`);
              const isLastMoveFrom = lastMove?.from.r === r && lastMove?.from.c === c;
              const isLastMoveTo = lastMove?.to.r === r && lastMove?.to.c === c;

              // Square background theme
              let squareBg = isDark
                ? 'bg-[#1E2430]' // Dark square where game is played
                : 'bg-[#D1D5DB]/90'; // Light square (inactive)

              if (isLastMoveFrom || isLastMoveTo) {
                squareBg = isDark ? 'bg-amber-950/60' : 'bg-amber-200/90';
              }

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleSquareClick(r, c)}
                  className={`relative flex items-center justify-center transition-colors duration-150 ${squareBg} ${
                    isDark ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                  }`}
                  data-testid={`square-${r}-${c}`}
                >
                  {/* Square Draughts notation badge in top corner */}
                  {notationType === 'draughts_50' && isDark && notationNum && (
                    <span className="absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-mono text-slate-500/80 font-bold select-none pointer-events-none">
                      {notationNum}
                    </span>
                  )}

                  {/* Algebraic rank/file labels on board borders */}
                  {notationType === 'algebraic' && (
                    <>
                      {c === (flipped ? boardSize - 1 : 0) && (
                        <span className="absolute top-0.5 left-0.5 text-[8px] font-mono text-slate-400 font-bold select-none pointer-events-none">
                          {boardSize - r}
                        </span>
                      )}
                      {r === (flipped ? 0 : boardSize - 1) && (
                        <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono text-slate-400 font-bold select-none pointer-events-none">
                          {colLetters[c]}
                        </span>
                      )}
                    </>
                  )}

                  {/* Valid move target markers */}
                  {target && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      {target.isCapture ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-red-500 bg-red-500/30 animate-ping flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-amber-400/80 shadow-md shadow-amber-400/50 hover:scale-125 transition-transform" />
                      )}
                    </div>
                  )}

                  {/* Render piece */}
                  {piece && (
                    <div
                      className={`relative w-[82%] h-[82%] rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
                        isSelected
                          ? 'scale-105 ring-4 ring-amber-400 shadow-2xl'
                          : canCaptureNow && state.turn === piece.color
                          ? 'ring-2 ring-amber-400/80 animate-pulse'
                          : 'shadow-lg hover:scale-105'
                      }`}
                    >
                      {/* Piece Body */}
                      {piece.color === 'white' ? (
                        // White / Gold Marble Piece
                        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#FFFFFF] via-[#F1F5F9] to-[#CBD5E1] border-2 border-amber-300 shadow-[0_4px_8px_rgba(0,0,0,0.5)] flex items-center justify-center">
                          {/* Inner concentric ring */}
                          <div className="w-[72%] h-[72%] rounded-full border border-amber-400/60 flex items-center justify-center bg-gradient-to-tr from-slate-100 to-white shadow-inner">
                            {piece.type === 'king' && (
                              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 drop-shadow animate-pulse" />
                            )}
                          </div>
                        </div>
                      ) : (
                        // Black / Obsidian Slate Piece
                        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#334155] via-[#1E293B] to-[#0F172A] border-2 border-amber-600/70 shadow-[0_4px_8px_rgba(0,0,0,0.7)] flex items-center justify-center">
                          {/* Inner concentric ring */}
                          <div className="w-[72%] h-[72%] rounded-full border border-amber-600/40 flex items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-800 shadow-inner">
                            {piece.type === 'king' && (
                              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 drop-shadow animate-pulse" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
