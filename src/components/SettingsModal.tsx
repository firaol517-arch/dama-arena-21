/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings as SettingsIcon, X, Sliders, Volume2, ShieldCheck, Check } from 'lucide-react';
import { GameConfig, KingLandingRule, StalemateRule, StartingLayoutPreset } from '../game/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GameConfig;
  onUpdateConfig: (newConfig: Partial<GameConfig>) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  notationType: 'draughts_50' | 'algebraic' | 'none';
  onChangeNotation: (type: 'draughts_50' | 'algebraic' | 'none') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  soundEnabled,
  onToggleSound,
  notationType,
  onChangeNotation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-[#181F2E] to-[#121620]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-['Cinzel'] font-black text-amber-300">
                ARENA SETTINGS
              </h2>
              <p className="text-[11px] text-slate-400">Configure rules, board, and audio</p>
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

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Board Dimension Selection */}
          <div>
            <label className="font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              የቦርድ መጠን (Board Dimension):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  onUpdateConfig({
                    boardSize: 8,
                    startingLayout: 'standard_12',
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.boardSize === 8
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">ባለ 4 (8x8 ቦርድ) 🇪🇹</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  12 ጠጠሮች (3 ረድፍ) - ክላሲክ የኢትዮጵያ ዳማ
                </div>
              </button>

              <button
                onClick={() =>
                  onUpdateConfig({
                    boardSize: 10,
                    startingLayout: 'tactical_15',
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.boardSize === 10
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">ባለ 5 (10x10 ቦርድ)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  15/20 ጠጠሮች - ዓለም አቀፍ ዳማ
                </div>
              </button>
            </div>
          </div>

          {/* Ordinary Piece Movement */}
          <div>
            <label className="font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              የጠጠር እንቅስቃሴ (Ordinary Piece Move):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ allowManBackwardMove: false })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  !config.allowManBackwardMove
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">ወደ ፊት ብቻ (Forward Only)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ጠጠር ወደ ኋላ መሄድ አይችልም
                </div>
              </button>

              <button
                onClick={() => onUpdateConfig({ allowManBackwardMove: true })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.allowManBackwardMove
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">ወደ ፊትና ኋላ (Both Ways)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ወደ ኋላም መንቀሳቀስ ይፈቀዳል
                </div>
              </button>
            </div>
          </div>

          {/* King Landing Rule */}
          <div>
            <label className="font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              King Landing Square After Long-Range Capture:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ kingLandingRule: 'all_beyond' })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.kingLandingRule === 'all_beyond'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">All Beyond</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  King may land on any vacant square past enemy
                </div>
              </button>

              <button
                onClick={() => onUpdateConfig({ kingLandingRule: 'immediate_beyond' })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.kingLandingRule === 'immediate_beyond'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Immediate Beyond</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Must land exactly 1 square past enemy
                </div>
              </button>
            </div>
          </div>

          {/* Stalemate Rule */}
          <div>
            <label className="font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              Stalemate (No Legal Moves Left):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ stalemateRule: 'loss' })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.stalemateRule === 'loss'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Loss</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Player with no moves loses</div>
              </button>

              <button
                onClick={() => onUpdateConfig({ stalemateRule: 'draw' })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  config.stalemateRule === 'draw'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">Draw</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Stalemate counted as draw</div>
              </button>
            </div>
          </div>

          {/* Board Notation Format */}
          <div>
            <label className="font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              Board Notation Style:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onChangeNotation('draughts_50')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  notationType === 'draughts_50'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">1 - 50</div>
                <div className="text-[9px] text-slate-500">Draughts</div>
              </button>

              <button
                onClick={() => onChangeNotation('algebraic')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  notationType === 'algebraic'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">A - J / 1-10</div>
                <div className="text-[9px] text-slate-500">Algebraic</div>
              </button>

              <button
                onClick={() => onChangeNotation('none')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  notationType === 'none'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold">Hidden</div>
                <div className="text-[9px] text-slate-500">Clean Board</div>
              </button>
            </div>
          </div>

          {/* Audio Sound Toggle */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-200 block">Synthesized Audio FX</span>
              <span className="text-[11px] text-slate-500">Web Audio piece move and capture chimes</span>
            </div>
            <button
              onClick={onToggleSound}
              className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-all ${
                soundEnabled
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
