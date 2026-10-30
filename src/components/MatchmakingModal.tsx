/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Globe, X, Loader2 } from 'lucide-react';

interface MatchmakingModalProps {
  isOpen: boolean;
  onCancel: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({ isOpen, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl p-6 text-center space-y-5">
        {/* Animated Radar */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-amber-500/40 animate-pulse" />
          <div className="absolute inset-6 rounded-full border border-amber-500/60" />
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 z-10">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div>
          <h3 className="font-['Cinzel'] font-black text-lg text-amber-300">
            FINDING AN OPPONENT...
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Searching for active players in the global arena.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95"
        >
          Cancel Matchmaking
        </button>
      </div>
    </div>
  );
};
