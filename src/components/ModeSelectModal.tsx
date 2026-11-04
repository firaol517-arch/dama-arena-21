/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bot, Users, Globe, Smartphone, X, ChevronRight, Shield, Zap, Sparkles, Trophy } from 'lucide-react';
import { AiDifficulty } from '../game/ai';
import { PieceColor } from '../game/types';

interface ModeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAi: (difficulty: AiDifficulty, playerColor: PieceColor) => void;
  onOpenFriendRoom: () => void;
  onOpenTournaments: () => void;
  onStartMatchmaking: () => void;
  onStartLocal: () => void;
}

export const ModeSelectModal: React.FC<ModeSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectAi,
  onOpenFriendRoom,
  onOpenTournaments,
  onStartMatchmaking,
  onStartLocal,
}) => {
  const [selectedAiDiff, setSelectedAiDiff] = useState<AiDifficulty>('medium');
  const [aiColor, setAiColor] = useState<PieceColor>('white');
  const [subView, setSubView] = useState<'main' | 'ai_config'>('main');

  if (!isOpen) return null;

  const aiDifficulties: Array<{
    id: AiDifficulty;
    name: string;
    desc: string;
    badge: string;
    color: string;
  }> = [
    {
      id: 'beginner',
      name: 'Beginner',
      desc: 'Casual & exploratory play. Great for learning Ethiopian Dama rules.',
      badge: 'Depth 1-2',
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-400',
    },
    {
      id: 'easy',
      name: 'Easy',
      desc: 'Basic tactics with fundamental forward and backward captures.',
      badge: 'Depth 2-3',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-400',
    },
    {
      id: 'medium',
      name: 'Medium',
      desc: 'Tactical positional heuristics, center control, and multi-captures.',
      badge: 'Balanced',
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/40 text-amber-400',
    },
    {
      id: 'hard',
      name: 'Hard',
      desc: 'Iterative deepening, transposition tables, and aggressive King hunts.',
      badge: 'Advanced',
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/40 text-purple-400',
    },
    {
      id: 'expert',
      name: 'Grandmaster (Expert)',
      desc: 'Nigerian Draughts inspired deep search, quiescence on captures, zero blunders.',
      badge: 'Master',
      color: 'from-red-500/20 to-red-600/10 border-red-500/40 text-red-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#181F2E] to-[#121620]">
          <div>
            <h2 className="text-lg sm:text-xl font-['Cinzel'] font-black tracking-wide text-amber-300">
              {subView === 'main' ? 'CHOOSE GAME MODE' : 'AI OPPONENT DIFFICULTY'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {subView === 'main'
                ? 'Select how you want to battle in Dama Arena'
                : 'Configure AI engine strength and your starting side'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {subView === 'main' ? (
            <>
              {/* Option 1: Play vs AI */}
              <div
                onClick={() => setSubView('ai_config')}
                className="group relative p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#181F2E] border border-amber-500/30 hover:border-amber-400 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99] flex items-center justify-between"
                role="button"
                aria-label="Play vs AI"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center shadow-md">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                        Play vs AI
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        5 Levels
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Minimax & Alpha-Beta with Nigerian draughts strategic techniques.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>

              {/* Option 2: Live Tournaments */}
              <div
                onClick={() => {
                  onClose();
                  onOpenTournaments();
                }}
                className="group relative p-4 rounded-xl bg-gradient-to-r from-[#1E192B] via-[#1B1828] to-[#121620] border-2 border-amber-500/50 hover:border-amber-400 cursor-pointer transition-all hover:shadow-xl hover:shadow-amber-500/15 active:scale-[0.99] flex items-center justify-between"
                role="button"
                aria-label="Live Tournaments"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-black flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Trophy className="w-6 h-6 drop-shadow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-amber-300 group-hover:text-amber-200 transition-colors">
                        🏆 ውድድሮች (Tournaments)
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                        LIVE
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      የአዲስ አበባ ግራንድ ፕሪክስ እና የብሔራዊ ዋንጫ የጥሎ ማለፍ ውድድሮች።
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Option 3: Play with Friend & Rooms */}
              <div
                onClick={() => {
                  onClose();
                  onOpenFriendRoom();
                }}
                className="group relative p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#181F2E] border border-slate-700/80 hover:border-amber-400 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99] flex items-center justify-between"
                role="button"
                aria-label="Play with Friend"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                        Play with Friend
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Private Room
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create a room, share code or invite via Telegram.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>

              {/* Option 3: Online Matchmaking */}
              <div
                onClick={() => {
                  onClose();
                  onStartMatchmaking();
                }}
                className="group relative p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#181F2E] border border-slate-700/80 hover:border-amber-400 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99] flex items-center justify-between"
                role="button"
                aria-label="Online Matchmaking"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                        Online Matchmaking
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Live 1v1
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Automatic matchmaking with live WebSocket move sync.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>

              {/* Option 4: Local Two-Player */}
              <div
                onClick={() => {
                  onClose();
                  onStartLocal();
                }}
                className="group relative p-4 rounded-xl bg-gradient-to-r from-slate-900 to-[#181F2E] border border-slate-700/80 hover:border-amber-400 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-500/10 active:scale-[0.99] flex items-center justify-between"
                role="button"
                aria-label="Local Two-Player"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                        Local Two-Player
                      </span>
                      <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Pass & Play
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Battle face-to-face on the same phone or laptop.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
            </>
          ) : (
            <>
              {/* AI Difficulty Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Select Difficulty:
                </label>
                {aiDifficulties.map((diff) => (
                  <div
                    key={diff.id}
                    onClick={() => setSelectedAiDiff(diff.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedAiDiff === diff.id
                        ? `bg-gradient-to-r ${diff.color} ring-2 ring-amber-400/50`
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{diff.name}</span>
                        <span className="text-[9px] uppercase font-mono px-1 rounded bg-black/40 text-slate-300 border border-slate-700">
                          {diff.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{diff.desc}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedAiDiff === diff.id ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                      }`}
                    >
                      {selectedAiDiff === diff.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Side Choice */}
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Play As:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAiColor('white')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      aiColor === 'white'
                        ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-400 shadow" />
                    <span>White (First)</span>
                  </button>

                  <button
                    onClick={() => setAiColor('black')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      aiColor === 'black'
                        ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-600 shadow" />
                    <span>Black (Second)</span>
                  </button>
                </div>
              </div>

              {/* Start AI Match Button */}
              <div className="pt-3 flex gap-2">
                <button
                  onClick={() => setSubView('main')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onSelectAi(selectedAiDiff, aiColor);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>START BATTLE</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
