/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, X, Check, ShieldAlert, Sparkles, Sliders } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-[#181F2E] to-[#121620]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-['Cinzel'] font-black text-amber-300">
                ETHIOPIAN DAMA RULES
              </h2>
              <p className="text-[11px] text-slate-400">Official rules & configurable parameters</p>
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Confirmed Rules */}
          <div className="space-y-2">
            <h3 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 text-sm">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Confirmed Authoritative Rules</span>
            </h3>

            <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">ባለ 4 (8x8 ቦርድ):</strong> 8 ረድፍ እና 4 ንቁ ጥቁር ካሬዎች በረድፍ (በአጠቃላይ 12 ጠጠሮች በ3 ረድፍ)። 10x10 አማራጭም በቅንብሮች ውስጥ ይገኛል።
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">የጠጠር እንቅስቃሴ (Ordinary Pieces):</strong> ጠጠር ወደ ፊት ብቻ በሰያፍ (diagonally forward) 1 ካሬ ይራመዳል። <strong className="text-amber-300">ጠጠር ወደ ኋላ መሄድ አይችልም!</strong>
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Captures:</strong> Jump diagonally forward or backward over an adjacent enemy piece onto the empty square immediately beyond.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Mandatory Captures:</strong> If any capture is available, the player must take a capture move. Multi-captures must be continued until no more jumps can be made with that piece.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Free Choice of Routes:</strong> Capturing the maximum possible number of pieces is <strong className="text-amber-300">NOT mandatory</strong>. You are free to choose whichever legal capture sequence you prefer.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Immediate Promotion (Mid-Sequence):</strong> An ordinary piece reaching the farthest row becomes a King immediately. If promotion occurs in the middle of a capture sequence, the piece becomes a King on that square and can continue capturing as a King in the same turn!
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Kings (Dama):</strong> Flying Kings that move diagonally over multiple empty squares and capture enemy pieces at long range.
                </p>
              </div>
            </div>
          </div>

          {/* Configurable Rules */}
          <div className="space-y-2">
            <h3 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 text-sm">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Configurable Game Rules</span>
            </h3>

            <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p className="text-slate-400">
                The following unconfirmed aspects are completely configurable in Settings:
              </p>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Starting Piece Count:</strong> Standard 20 (4 rows), Tactical 15 (3 rows), Compact 16, or Quick 10.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">King Landing Rule:</strong> Choose between landing on <em>any empty square beyond the captured enemy</em> (All Beyond) vs <em>only immediately beyond</em>.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Stalemate Rule:</strong> When a player has pieces but no legal moves, decide whether it is a <em>Loss</em> or a <em>Draw</em>.
                </p>
              </div>

              <div className="flex gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <p>
                  <strong className="text-slate-100">Draw Triggers:</strong> 3-fold position repetition and move limits without capture.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
