/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send, Users, ArrowRight } from 'lucide-react';

interface FriendRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  isHost: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  waitingForOpponent: boolean;
}

export const FriendRoomModal: React.FC<FriendRoomModalProps> = ({
  isOpen,
  onClose,
  roomId,
  isHost,
  onCreateRoom,
  onJoinRoom,
  waitingForOpponent,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = roomId
    ? `${window.location.origin}?room=${roomId}`
    : '';

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleTelegramShare = () => {
    if (!roomId) return;
    const tgText = encodeURIComponent(`⚔️ Challenge me to an Ethiopian Dama match on Dama Arena! Room Code: ${roomId}`);
    const tgUrl = encodeURIComponent(shareUrl);
    window.open(`https://t.me/share/url?url=${tgUrl}&text=${tgText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121620] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#181F2E] to-[#121620]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-['Cinzel'] font-black text-amber-300">
                PLAY WITH FRIEND
              </h2>
              <p className="text-[11px] text-slate-400">Challenge a friend via link or room code</p>
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
        <div className="p-4 sm:p-5 space-y-4">
          {roomId ? (
            /* Room Created / Active */
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 shadow-inner">
                <span className="text-xs uppercase font-bold text-slate-400 block mb-1">
                  Your Room Code:
                </span>
                <div className="text-3xl font-mono font-black text-amber-400 tracking-widest selection:bg-amber-400 selection:text-black">
                  {roomId}
                </div>
              </div>

              {waitingForOpponent && (
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-300 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for your friend to enter the arena...</span>
                </div>
              )}

              {/* Share Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleTelegramShare}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1E8BC3] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Share on Telegram</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Invitation Link'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Choose to Create or Join */
            <div className="space-y-5">
              {/* Create Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-center space-y-2.5">
                <h3 className="font-bold text-sm text-slate-200">Host a New Match</h3>
                <p className="text-xs text-slate-400">
                  Generate a private room and invite anyone to battle.
                </p>
                <button
                  onClick={onCreateRoom}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all active:scale-95"
                >
                  CREATE ROOM
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] uppercase font-bold text-slate-500">OR</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Join Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <h3 className="font-bold text-sm text-slate-200 text-center">Join Existing Room</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-CHAR CODE"
                    maxLength={8}
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-center font-mono font-bold text-sm text-amber-300 placeholder:text-slate-600 focus:outline-none uppercase"
                  />
                  <button
                    onClick={() => {
                      if (inputCode.trim()) {
                        onJoinRoom(inputCode.trim());
                      }
                    }}
                    disabled={!inputCode.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    <span>JOIN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
