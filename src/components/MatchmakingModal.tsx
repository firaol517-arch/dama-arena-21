/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Globe, Users } from 'lucide-react';

interface MatchmakingModalProps {
  isOpen: boolean;
  queueSize?: number;
  openRoomsCount?: number;
  onCancel: () => void;
  onSwitchToRooms: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  queueSize = 1,
  openRoomsCount = 0,
  onCancel,
  onSwitchToRooms,
}) => {
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
            ተጋጣሚ እየተፈለገ ነው... በቅርቡ ይገናኛሉ።
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Waiting: {Math.max(1, queueSize)}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
              Open Rooms: {openRoomsCount}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onSwitchToRooms}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
          >
            <Users className="w-4 h-4" />
            <span>ክፍት ክፍሎችን እይ / ክፍል ፍጠር (Live Rooms)</span>
          </button>

          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95"
          >
            Cancel Matchmaking
          </button>
        </div>
      </div>
    </div>
  );
};
