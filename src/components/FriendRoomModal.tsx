/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Send, Users, Globe, PlusCircle, RefreshCw, KeyRound, Sparkles, ArrowRight } from 'lucide-react';
import { PlayerProfile } from '../game/types';

interface OpenRoomInfo {
  id: string;
  hostName: string;
  hostId?: string;
  boardSize: number;
  createdAt: number;
  timerMinutes: number;
}

interface FriendRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PlayerProfile;
  currentRoomId: string | null;
  waitingForOpponent: boolean;
  onRoomCreated: (roomId: string, state: any, color: 'white') => void;
  onRoomJoined: (roomId: string, state: any, color: 'black', opponentName: string) => void;
}

export const FriendRoomModal: React.FC<FriendRoomModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRoomId,
  waitingForOpponent,
  onRoomCreated,
  onRoomJoined,
}) => {
  const [activeTab, setActiveTab] = useState<'lobby' | 'create' | 'join'>('lobby');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [openRooms, setOpenRooms] = useState<OpenRoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch open public rooms
  const fetchOpenRooms = async () => {
    try {
      setLoadingRooms(true);
      setErrorMsg(null);
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setOpenRooms(data);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOpenRooms();
      const interval = setInterval(fetchOpenRooms, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Direct REST Room Creation (100% Reliable!)
  const handleCreateRoom = async (isPrivate: boolean = false) => {
    try {
      setCreating(true);
      setErrorMsg(null);
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          displayName: currentUser.displayName,
          isPrivate,
          timerMinutes: 10,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onRoomCreated(data.roomId, data.state, 'white');
        setActiveTab('create');
      } else {
        setErrorMsg(data.error || 'Failed to create room');
      }
    } catch (err) {
      setErrorMsg('የኔትወርክ ችግር፤ እባክዎ እንደገና ይሞክሩ (Network error)');
    } finally {
      setCreating(false);
    }
  };

  // Direct REST Room Join (100% Reliable!)
  const handleJoinRoom = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      setJoining(true);
      setErrorMsg(null);
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: cleanCode,
          userId: currentUser.id,
          displayName: currentUser.displayName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onRoomJoined(data.roomId, data.state, data.color, data.opponentName);
        onClose();
      } else {
        setErrorMsg(data.error || 'ክፍሉ አልተገኘም (Room not found)');
      }
    } catch (err) {
      setErrorMsg('የኔትወርክ ችግር፤ እባክዎ እንደገና ይሞክሩ (Network error)');
    } finally {
      setJoining(false);
    }
  };

  const shareTelegramLink = (code: string) => {
    const directUrl = `${window.location.origin}?room=${code}`;
    const botUrl = `https://t.me/Letsdamabot?startapp=join_${code}`;
    const tgText = encodeURIComponent(`⚔️ ከእኔ ጋር የኢትዮጵያ ዳማ ይጫወቱ! (Challenge me on Dama Arena!)\nክፍል ኮድ (Room Code): ${code}\nወዲያውኑ ለመጫወት ሊንኩን ይጫኑ፦\n${botUrl}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${tgText}`, '_blank');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121620] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#162033] to-[#121620]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-['Cinzel'] font-black text-blue-300">
                  FRIEND & ONLINE ROOMS
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  የቀጥታ ክፍሎች
                </span>
              </div>
              <p className="text-xs text-slate-400">Play real-time multiplayer with friends or online warriors</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-red-500/20 border-b border-red-500/40 px-4 py-2.5 text-red-300 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0F131C] px-3 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('lobby')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'lobby'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ክፍት ክፍሎች (Live Lobby)</span>
            {openRooms.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-black text-[10px] font-black flex items-center justify-center">
                {openRooms.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>ክፍል ፍጠር (Create Room)</span>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'join'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>በኮድ ግባ (Join by Code)</span>
          </button>
        </div>

        {/* Tab 1: Live Lobby (The "Lela Way") */}
        {activeTab === 'lobby' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
              <span>በመጫወት ላይ ያሉ ክፍት ክፍሎች (Waiting Opponents)</span>
              <button
                onClick={fetchOpenRooms}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRooms ? 'animate-spin' : ''}`} />
                <span>አድስ</span>
              </button>
            </div>

            {openRooms.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                  <Globe className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-200">በአሁኑ ሰዓት ክፍት ክፍል የለም</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    የመጀመሪያውን ክፍል እርስዎ ይፍጠሩ እና ጓደኛዎን በቴሌግራም ይጋብዙ!
                  </p>
                </div>
                <button
                  onClick={() => handleCreateRoom(false)}
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {creating ? 'በመፍጠር ላይ...' : '⚡ አዲስ ክፍል ፍጠር (Create Room)'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {openRooms.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between gap-3 shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-400 text-white font-black text-sm flex items-center justify-center shadow">
                        {r.hostName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-100">{r.hostName}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            {r.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">ባለ 4 ዳማ (8x8) • {r.timerMinutes} ደቂቃ ሰዓት</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(r.id)}
                      disabled={joining}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black text-xs flex items-center gap-1 shadow transition-all active:scale-95 shrink-0"
                    >
                      <span>ተቀላቀል | Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create Room */}
        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {currentRoomId ? (
              <div className="space-y-4 text-center">
                <div className="p-5 rounded-2xl bg-gradient-to-b from-[#18233C] to-[#101726] border-2 border-blue-500/40 shadow-inner">
                  <span className="text-xs uppercase font-bold text-blue-300 block mb-1">
                    የክፍልዎ ኮድ (Your Room Code):
                  </span>
                  <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400 tracking-wider">
                    {currentRoomId}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">ይህን ኮድ ለጓደኛዎ ይላኩ ወይም በቴሌግራም አጋሩ</p>
                </div>

                {waitingForOpponent && (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-300 animate-pulse bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                    <span>ጓደኛዎ እስኪገባ እየተጠበቀ ነው... (Waiting for friend to enter...)</span>
                  </div>
                )}

                {/* Share Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => shareTelegramLink(currentRoomId)}
                    className="w-full py-3 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1E8BC3] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>በቴሌግራም ጋብዝ (Share on Telegram)</span>
                  </button>

                  <button
                    onClick={() => copyCode(currentRoomId)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'ኮዱ ኮፒ ተደርጓል! (Code Copied)' : 'ኮዱን ኮፒ አድርግ (Copy Room Code)'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <h3 className="font-bold text-sm text-slate-100">አዲስ የዳማ ክፍል ፍጠር</h3>
                  <p className="text-xs text-slate-400">
                    ክፍል ፈጥረው የፈለጉትን ሰው በመጋበዝ በቀጥታ መጫወት ይችላሉ።
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCreateRoom(false)}
                    disabled={creating}
                    className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                  >
                    <Globe className="w-6 h-6" />
                    <span>ይፋዊ ክፍል (Public Room)</span>
                    <span className="text-[10px] text-blue-200 font-normal">ክፍት ክፍሎች ላይ ይታያል</span>
                  </button>

                  <button
                    onClick={() => handleCreateRoom(true)}
                    disabled={creating}
                    className="p-4 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700 text-slate-100 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Users className="w-6 h-6 text-amber-400" />
                    <span>የግል ክፍል (Private)</span>
                    <span className="text-[10px] text-slate-400 font-normal">በኮድ ብቻ የሚገባ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Join by Code */}
        {activeTab === 'join' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-slate-100">በጓደኛዎ ክፍል ኮድ ይግቡ</h3>
              <p className="text-xs text-slate-400">
                ጓደኛዎ የላከሎትን የ 6-ሆሄያት ወይም የቁጥር ክፍል ኮድ እዚህ ያስገቡ።
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="ለምሳሌ፦ DM4829 ወይም 68492"
                maxLength={8}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-blue-400 rounded-xl px-4 py-3 text-center font-mono font-black text-lg text-amber-400 placeholder:text-slate-600 focus:outline-none uppercase"
              />

              <button
                onClick={() => handleJoinRoom(inputCode)}
                disabled={joining || !inputCode.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                {joining ? 'በመግባት ላይ...' : 'ወደ ክፍሉ ግባ | Join Room'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
