/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Crown, Volume2, VolumeX, Trophy, BookOpen, User, Settings, Swords, Radio, Award, Music } from 'lucide-react';
import { PlayerProfile } from '../game/types';
import { sounds } from '../utils/audio';

interface HeaderProps {
  profile: PlayerProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenModeSelect: () => void;
  onOpenTournaments: () => void;
  onOpenSpotify?: () => void;
  onOpenProfile: () => void;
  onOpenLeaderboard: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  isOnline: boolean;
  isTelegram: boolean;
  boardSize?: number;
  currentMusicTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  soundEnabled,
  onToggleSound,
  onOpenModeSelect,
  onOpenTournaments,
  onOpenSpotify,
  onOpenProfile,
  onOpenLeaderboard,
  onOpenRules,
  onOpenSettings,
  isOnline,
  isTelegram,
  boardSize = 8,
  currentMusicTitle,
}) => {
  return (
    <header className="w-full bg-[#121620]/95 backdrop-blur-md border-b border-amber-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Title */}
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={onOpenModeSelect} role="button" aria-label="Go to menu">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/40">
          <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-black drop-shadow" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-['Cinzel'] font-black text-lg sm:text-xl tracking-wider bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              DAMA ARENA
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
              {boardSize === 8 ? '8x8 (ባለ 4)' : '10x10'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Ethiopian Dama Platform</p>
        </div>
      </div>

      {/* Center Action */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onOpenTournaments}
          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
          aria-label="Tournaments"
          title="ውድድሮች (Tournaments)"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="inline">ውድድሮች</span>
        </button>

        <button
          onClick={onOpenModeSelect}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
          aria-label="New Game"
        >
          <Swords className="w-4 h-4" />
          <span className="hidden xs:inline">New Game</span>
        </button>

        <button
          onClick={onOpenLeaderboard}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-all flex items-center gap-1 text-xs"
          aria-label="Leaderboard"
          title="Leaderboard"
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline font-semibold">Rankings</span>
        </button>

        <button
          onClick={onOpenRules}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-all flex items-center gap-1 text-xs"
          aria-label="Game Rules"
          title="Game Rules"
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline font-semibold">Rules</span>
        </button>

        <button
          onClick={onToggleSound}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-all text-xs"
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>

        {onOpenSpotify && (
          <button
            onClick={onOpenSpotify}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 font-semibold text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 group"
            aria-label="Spotify Music"
            title="Spotify Music & Playlist Share"
          >
            <Music className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform animate-pulse" />
            <span className="hidden sm:inline font-bold">Spotify</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-all text-xs"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* User profile capsule */}
      <div
        onClick={onOpenProfile}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 border border-amber-500/30 cursor-pointer transition-all active:scale-95"
        role="button"
        aria-label="Player profile"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-black flex items-center justify-center font-black text-xs shadow">
          {profile.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-xs font-bold text-slate-200 truncate max-w-[90px]">
              {profile.displayName}
            </span>
            <span className="text-[10px] font-black px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              L{profile.level}
            </span>
          </div>
          <div className="text-[10px] text-amber-400/90 font-semibold">{profile.elo} ELO</div>
        </div>
      </div>
    </header>
  );
};
