/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw, Undo2, Flag, ArrowUpDown, Bot, User, Sparkles, Clock } from 'lucide-react';
import { GameState, PieceColor } from '../game/types';
import { AiDifficulty } from '../game/ai';

interface GameHUDProps {
  state: GameState;
  gameMode: 'ai' | 'friend' | 'multiplayer' | 'local';
  playerColor: PieceColor;
  whiteName: string;
  blackName: string;
  aiDifficulty?: AiDifficulty;
  isAiThinking: boolean;
  whiteTimer: number; // in seconds
  blackTimer: number; // in seconds
  onUndo: () => void;
  canUndo: boolean;
  onRestart: () => void;
  onResign: () => void;
  onFlipBoard: () => void;
  notationType: 'draughts_50' | 'algebraic' | 'none';
  onCycleNotation: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  gameMode,
  playerColor,
  whiteName,
  blackName,
  aiDifficulty,
  isAiThinking,
  whiteTimer,
  blackTimer,
  onUndo,
  canUndo,
  onRestart,
  onResign,
  onFlipBoard,
  notationType,
  onCycleNotation,
}) => {
  // Count remaining pieces
  let whiteCount = 0;
  let blackCount = 0;
  let whiteKings = 0;
  let blackKings = 0;

  const boardSize = state.board.length;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = state.board[r]?.[c];
      if (p?.color === 'white') {
        whiteCount++;
        if (p.type === 'king') whiteKings++;
      } else if (p?.color === 'black') {
        blackCount++;
        if (p.type === 'king') blackKings++;
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isWhiteTurn = state.turn === 'white';
  const isBlackTurn = state.turn === 'black';

  return (
    <div className="w-full max-w-[560px] mx-auto flex flex-col gap-2.5 mb-2">
      {/* Player Cards Header */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Black Player Card */}
        <div
          className={`relative p-2.5 sm:p-3 rounded-xl border transition-all ${
            isBlackTurn && state.status === 'playing'
              ? 'bg-[#181F2E] border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
              : 'bg-[#121620]/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shadow">
                {gameMode === 'ai' ? (
                  <Bot className="w-4 h-4 text-amber-400" />
                ) : (
                  <User className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[100px]">
                    {blackName}
                  </span>
                  {gameMode === 'ai' && aiDifficulty && (
                    <span className="text-[9px] uppercase px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {aiDifficulty}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>
                    Pieces: <b className="text-slate-200">{blackCount}</b>
                  </span>
                  {blackKings > 0 && (
                    <span className="text-amber-400 font-bold">👑 {blackKings}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-end">
              <div
                className={`font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                  isBlackTurn
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                <Clock className="w-3 h-3" />
                {formatTime(blackTimer)}
              </div>
              {isAiThinking && isBlackTurn && (
                <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                  <Sparkles className="w-3 h-3 animate-spin" /> Thinking...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* White Player Card */}
        <div
          className={`relative p-2.5 sm:p-3 rounded-xl border transition-all ${
            isWhiteTurn && state.status === 'playing'
              ? 'bg-[#181F2E] border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
              : 'bg-[#121620]/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-200 border border-amber-300 flex items-center justify-center shadow">
                <User className="w-4 h-4 text-slate-900" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-[100px]">
                    {whiteName}
                  </span>
                  {gameMode !== 'local' && playerColor === 'white' && (
                    <span className="text-[9px] uppercase px-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      You
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>
                    Pieces: <b className="text-slate-200">{whiteCount}</b>
                  </span>
                  {whiteKings > 0 && (
                    <span className="text-amber-400 font-bold">👑 {whiteKings}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-end">
              <div
                className={`font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                  isWhiteTurn
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                <Clock className="w-3 h-3" />
                {formatTime(whiteTimer)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1 sm:gap-2">
          {canUndo && (
            <button
              onClick={onUndo}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
              aria-label="Undo move"
              title="Undo move"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Undo</span>
            </button>
          )}

          <button
            onClick={onRestart}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
            aria-label="Restart match"
            title="Restart match"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Restart</span>
          </button>

          <button
            onClick={onFlipBoard}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
            aria-label="Flip board perspective"
            title="Flip board perspective"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Flip</span>
          </button>

          <button
            onClick={onCycleNotation}
            className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 text-xs font-mono font-semibold transition-all active:scale-95"
            aria-label="Toggle notation format"
            title={`Notation: ${notationType}`}
          >
            {notationType === 'draughts_50' ? '1-50' : notationType === 'algebraic' ? 'A-J' : 'Off'}
          </button>
        </div>

        <div>
          <button
            onClick={onResign}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
            aria-label="Resign game"
            title="Resign game"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Resign</span>
          </button>
        </div>
      </div>
    </div>
  );
};
