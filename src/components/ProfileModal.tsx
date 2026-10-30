/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Award, Flame, Trophy, Swords, Calendar, Zap, CheckCircle2 } from 'lucide-react';
import { PlayerProfile } from '../game/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, profile }) => {
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/matches')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setRecentMatches(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const xpCurrent = profile.xp % 250;
  const xpNext = 250;
  const xpPercent = Math.min(100, Math.floor((xpCurrent / xpNext) * 100));

  const winRate =
    profile.matchesPlayed > 0
      ? Math.round((profile.wins / profile.matchesPlayed) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Banner */}
        <div className="relative p-5 bg-gradient-to-r from-amber-950/60 via-[#181F2E] to-[#121620] border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 border-2 border-amber-200">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">{profile.displayName}</h2>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  LEVEL {profile.level}
                </span>
              </div>
              <p className="text-xs text-amber-400 font-semibold tracking-wide mt-0.5">
                {profile.elo} ELO RATING
              </p>
            </div>
          </div>

          {/* XP Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
              <span>EXP: {xpCurrent} / {xpNext} XP</span>
              <span className="text-amber-400 font-bold">{xpPercent}% to Level {profile.level + 1}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Matches</span>
              <span className="text-lg font-bold text-slate-100">{profile.matchesPlayed}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Wins</span>
              <span className="text-lg font-bold text-emerald-300">{profile.wins}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Win Rate</span>
              <span className="text-lg font-bold text-amber-300">{winRate}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" /> Streak
              </span>
              <span className="text-lg font-bold text-amber-400">{profile.winStreak}</span>
            </div>
          </div>

          {/* Achievement Badges */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Achievement Badges</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.badges.map((badge, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Match History */}
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>Recent Arena Matches</span>
            </h3>
            {recentMatches.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No recorded matches yet. Play a match to build history!</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentMatches.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        {m.whitePlayer} <span className="text-slate-500">vs</span> {m.blackPlayer}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Mode: <span className="uppercase text-amber-400">{m.mode}</span> {m.difficulty && `(${m.difficulty})`} • {m.totalTurns} turns
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          m.winner
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {m.winner ? `${m.winner.toUpperCase()} WON` : 'DRAW'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
