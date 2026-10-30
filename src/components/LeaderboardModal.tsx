/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Trophy, X, Medal, Flame } from 'lucide-react';
import { PlayerProfile } from '../game/types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [leaders, setLeaders] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/leaderboard')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setLeaders(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-[#181F2E] to-[#121620]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-['Cinzel'] font-black text-amber-300">
                GLOBAL LEADERBOARD
              </h2>
              <p className="text-[11px] text-slate-400">Top Ethiopian Dama Grandmasters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-xs animate-pulse">
              Loading rankings...
            </div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">No champions recorded yet.</div>
          ) : (
            leaders.map((player, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const medalColor =
                rank === 1
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/40'
                  : rank === 2
                  ? 'text-slate-300 bg-slate-400/10 border-slate-400/40'
                  : rank === 3
                  ? 'text-amber-700 bg-amber-800/10 border-amber-800/40'
                  : 'text-slate-500 bg-slate-900 border-slate-800';

              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isTop3
                      ? 'bg-gradient-to-r from-slate-900 via-[#181F2E] to-slate-900 border-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg border font-black text-xs flex items-center justify-center ${medalColor}`}
                    >
                      {rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-200">{player.displayName}</span>
                        <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                          L{player.level}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{player.wins}W / {player.losses}L</span>
                        {player.winStreak > 0 && (
                          <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                            <Flame className="w-3 h-3" /> {player.winStreak} streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-black text-sm text-amber-400">{player.elo}</div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">ELO</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
