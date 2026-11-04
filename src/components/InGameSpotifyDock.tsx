/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Music,
  Youtube,
  Disc,
  Share2,
  Sparkles,
  Link as LinkIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Play,
  X,
} from 'lucide-react';
import { SpotifyTrackInfo } from './SpotifyPlayerModal';

interface InGameMediaDockProps {
  currentTrack?: SpotifyTrackInfo;
  onSelectTrack?: (track: SpotifyTrackInfo) => void;
  roomId: string | null;
}

export type MediaSourceType = 'youtube' | 'spotify';

export interface MediaItem {
  id: string;
  title: string;
  artist: string;
  type: MediaSourceType;
  embedUrl: string;
  category: string;
}

export const FEATURED_MEDIA: MediaItem[] = [
  {
    id: 'yt_mulatu',
    title: 'Mulatu Astatke - Yèkèrmo Sèw (Ethio-Jazz Masterpiece)',
    artist: 'ሙላቱ አስታጥቄ (ሙሉ ዘፈን - Full Track)',
    type: 'youtube',
    embedUrl: 'https://www.youtube.com/embed/jwdBRqIsVUY?autoplay=1&playsinline=1',
    category: '🇪🇹 Mulatu Jazz (Full)',
  },
  {
    id: 'yt_teddy_afro',
    title: 'Teddy Afro - Non-Stop Visualizer Album',
    artist: 'ቴዲ አፍሮ (ሙሉ አልበም - Non-Stop Full Music)',
    type: 'youtube',
    embedUrl: 'https://www.youtube.com/embed/-qUZFnbAoT0?autoplay=1&playsinline=1',
    category: '🇪🇹 ቴዲ አፍሮ (Full Album)',
  },
  {
    id: 'yt_lofi',
    title: 'Lofi Hip Hop Radio - Beats to Relax/Study to',
    artist: 'Lofi Girl (24/7 Non-Stop Beats)',
    type: 'youtube',
    embedUrl: 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&playsinline=1',
    category: '☕ 24/7 Lo-Fi Chill',
  },
  {
    id: 'yt_mulatu_stereo',
    title: 'Mulatu Astatke - Mulatu (Stereo Master)',
    artist: 'ሙላቱ አስታጥቄ እና አንጋፋዎቹ',
    type: 'youtube',
    embedUrl: 'https://www.youtube.com/embed/kRXirMgQ-JM?autoplay=1&playsinline=1',
    category: '🎷 Mulatu Classics',
  },
  {
    id: 'sp_ethio_jazz',
    title: 'Spotify: Ethio-Jazz & Mulatu Classics',
    artist: 'Mulatu Astatke Playlist',
    type: 'spotify',
    embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4UtSsGT1Sbe?utm_source=generator&theme=0',
    category: '🟢 Spotify Jazz',
  },
];

export const InGameSpotifyDock: React.FC<InGameMediaDockProps> = ({
  roomId,
}) => {
  const [activeMedia, setActiveMedia] = useState<MediaItem>(FEATURED_MEDIA[0]);
  const [urlInput, setUrlInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Parse any YouTube or Spotify link
  const parseMediaUrl = (raw: string): MediaItem | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      // 1. YouTube links
      if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
        let videoId = '';
        let listId = '';

        if (trimmed.includes('youtu.be/')) {
          const parts = trimmed.split('youtu.be/')[1].split('?');
          videoId = parts[0];
        } else {
          const urlObj = new URL(trimmed);
          videoId = urlObj.searchParams.get('v') || '';
          listId = urlObj.searchParams.get('list') || '';
        }

        if (videoId) {
          return {
            id: `yt_${videoId}`,
            title: 'Custom YouTube Music',
            artist: 'YouTube Video',
            type: 'youtube',
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`,
            category: '▶️ YouTube',
          };
        }

        if (listId) {
          return {
            id: `yt_list_${listId}`,
            title: 'Custom YouTube Playlist',
            artist: 'YouTube Playlist',
            type: 'youtube',
            embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&playsinline=1`,
            category: '▶️ YouTube Playlist',
          };
        }
      }

      // 2. Spotify links
      if (trimmed.includes('spotify.com') || trimmed.startsWith('spotify:')) {
        let type = 'playlist';
        let id = '';

        if (trimmed.startsWith('spotify:')) {
          const parts = trimmed.split(':');
          if (parts.length >= 3) {
            type = parts[1];
            id = parts[2];
          }
        } else {
          const urlObj = new URL(trimmed);
          const parts = urlObj.pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            type = parts[0];
            id = parts[1].split('?')[0];
          }
        }

        if (type && id) {
          return {
            id: `sp_${id}`,
            title: `Custom Spotify ${type.toUpperCase()}`,
            artist: 'Spotify Share',
            type: 'spotify',
            embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
            category: '🟢 Spotify',
          };
        }
      }
    } catch (_) {}

    return null;
  };

  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    if (!urlInput.trim()) return;

    const parsed = parseMediaUrl(urlInput);
    if (!parsed) {
      setInputError('ትክክለኛ የYouTube ወይም የSpotify ሊንክ ያስገቡ (ለምሳሌ፦ youtube.com/watch?v=... ወይም spotify.com/...)');
      return;
    }

    setActiveMedia(parsed);
    setUrlInput('');
    setIsExpanded(true);
  };

  const handleShareToRoom = () => {
    if (!roomId) return;
    setShared(true);
    setTimeout(() => setShared(false), 2500);
  };

  return (
    <div className="w-full mt-3 p-3 rounded-2xl bg-gradient-to-b from-[#121622]/95 to-[#0A0D14]/95 border border-emerald-500/40 shadow-2xl shadow-black/80 backdrop-blur-md">
      {/* HEADER: Media Title & Controls */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
              activeMedia.type === 'youtube'
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 shadow-rose-950/40'
                : 'bg-[#1DB954]/20 border border-[#1DB954]/50 text-[#1DB954] shadow-[#1DB954]/10'
            }`}
          >
            {activeMedia.type === 'youtube' ? (
              <Youtube className="w-4 h-4 fill-current" />
            ) : (
              <Music className="w-4 h-4 text-[#1DB954] animate-pulse" />
            )}
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-white truncate max-w-[160px] sm:max-w-[280px]">
                {activeMedia.title}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full border shrink-0 ${
                  activeMedia.type === 'youtube'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/40'
                }`}
              >
                {activeMedia.type === 'youtube' ? 'YouTube 100% ሙሉ ዘፈን' : 'Spotify'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {activeMedia.artist}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {roomId && (
            <button
              onClick={handleShareToRoom}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] flex items-center gap-1 transition active:scale-95"
            >
              {shared ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              <span className="hidden xs:inline">{shared ? 'ተጋርቷል' : 'ለክፍሉ አጋራ'}</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] transition"
            title={isExpanded ? 'አሳንስ' : 'አሳድግ'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* UNIVERSAL LINK PASTE BAR (YouTube or Spotify Link) */}
      <form onSubmit={handleApplyLink} className="pt-2.5 pb-1.5 flex gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="የYouTube ወይም የSpotify ሊንክ እዚህ Paste ያድርጉ..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none pr-8"
          />
          {urlInput && (
            <button
              type="button"
              onClick={() => setUrlInput('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-[#1DB954] hover:opacity-95 text-black font-extrabold text-xs rounded-xl transition active:scale-95 flex items-center gap-1 shadow-lg shadow-emerald-950/50 shrink-0"
        >
          <Play className="w-3 h-3 fill-current ml-0.5" />
          <span>ጫን እና አጫውት</span>
        </button>
      </form>
      {inputError && (
        <p className="text-[10px] text-rose-400 font-medium pb-1 px-1">{inputError}</p>
      )}

      {/* QUICK PRESET BUTTONS (YouTube Full Songs & Spotify) */}
      <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto no-scrollbar">
        {FEATURED_MEDIA.map((item) => {
          const isSelected = activeMedia.id === item.id;
          const isYt = item.type === 'youtube';
          return (
            <button
              key={item.id}
              onClick={() => setActiveMedia(item)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 shrink-0 ${
                isSelected
                  ? isYt
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-950/40'
                    : 'bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              {isYt ? (
                <Youtube className="w-3 h-3 fill-current" />
              ) : (
                <Music className="w-3 h-3" />
              )}
              <span>{item.category}</span>
            </button>
          );
        })}
      </div>

      {/* EMBEDDED PLAYER (100% on the game screen, plays full music from YouTube or Spotify) */}
      {isExpanded && (
        <div className="mt-1 rounded-xl overflow-hidden bg-black border border-emerald-500/30 shadow-inner">
          <iframe
            src={activeMedia.embedUrl}
            width="100%"
            height={activeMedia.type === 'youtube' ? '200' : '152'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="eager"
            title="In-Game Music Player"
            className="rounded-lg transition-all"
          />
        </div>
      )}

      {/* Helpful Info Tip */}
      <div className="mt-1.5 text-[10px] text-slate-400 flex items-center justify-between px-1">
        <span className="text-emerald-400 font-semibold">
          💡 YouTube ምንም አይነት የ 30 ሰከንድ ገደብ ሳይኖርበት ሙሉ ዘፈኖችን 100% እዛው ያጫውታል!
        </span>
        <span className="text-slate-500 hidden sm:inline">
          ማንኛውንም ሊንክ ለጥፈው መጫወት ይችላሉ
        </span>
      </div>
    </div>
  );
};
