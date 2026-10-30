/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Swords, Flame, Sparkles } from 'lucide-react';
import { GameStatus, PieceColor } from '../game/types';
import { sounds } from '../utils/audio';

interface GameOverModalProps {
  isOpen: boolean;
  status: GameStatus;
  winner?: PieceColor;
  reason?: string;
  totalTurns: number;
  playerColor: PieceColor;
  onRematch: () => void;
  onNewGame: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  status,
  winner,
  reason,
  totalTurns,
  playerColor,
  onRematch,
  onNewGame,
}) => {
  useEffect(() => {
    if (isOpen) {
      if (winner === playerColor || (!winner && status === 'draw')) {
        sounds.playVictory();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#D4AF37', '#FCD34D', '#10B981'],
        });
      }
    }
  }, [isOpen, winner, playerColor, status]);

  if (!isOpen) return null;

  const isWin = winner === playerColor;
  const isDraw = status === 'draw';

  const title = isDraw
    ? 'PEACEFUL DRAW'
    : isWin
    ? 'VICTORY ACHIEVED!'
    : 'DEFEAT';

  const xpEarned = isWin ? 75 : isDraw ? 25 : 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#121620] border-2 border-amber-500/40 rounded-2xl shadow-2xl p-6 text-center space-y-5">
        {/* Victory Icon / Trophy */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 text-black flex items-center justify-center shadow-xl shadow-amber-500/30 border-2 border-amber-200">
          <Trophy className="w-8 h-8 drop-shadow" />
        </div>

        <div>
          <h2 className="font-['Cinzel'] font-black text-2xl tracking-wide bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-xs text-slate-300 font-medium mt-1">
            {reason || (isDraw ? 'Game concluded in a draw' : `${winner?.toUpperCase()} emerged victorious`)}
          </p>
        </div>

        {/* Rewards pill */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-around text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Turns</span>
            <span className="font-mono font-bold text-slate-100">{totalTurns}</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-[10px] text-amber-400 uppercase font-semibold block flex items-center justify-center gap-0.5">
              <Sparkles className="w-3 h-3 text-amber-400" /> XP Earned
            </span>
            <span className="font-mono font-black text-amber-300">+{xpEarned} XP</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onRematch}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>PLAY REMATCH</span>
          </button>

          <button
            onClick={onNewGame}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95"
          >
            <span>Return to Modes Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
