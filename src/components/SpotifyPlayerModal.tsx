/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Music,
  X,
  Share2,
  Sparkles,
  Radio,
  ExternalLink,
  Wifi,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { openTelegramExternalLink } from '../utils/telegram';

export interface SpotifyTrackInfo {
  title: string;
  category: string;
  embedUrl: string;
  spotifyUrl: string;
  uriScheme?: string; // spotify:playlist:...
  artist?: string;
}

export const SPOTIFY_PRESETS: SpotifyTrackInfo[] = [
  {
    title: 'Ethio-Jazz & Mulatu Classics',
    artist: 'Mulatu Astatke & Legends',
    category: '🇪🇹 Ethio Jazz',
    embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4UtSsGT1Sbe?utm_source=generator&theme=0',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX4UtSsGT1Sbe',
    uriScheme: 'spotify:playlist:37i9dQZF1DX4UtSsGT1Sbe',
  },
  {
    title: 'Addis Coffee & Lo-Fi Beats',
    artist: 'Habesha Chill Lounge',
    category: '☕ Lo-Fi Chill',
    embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXc8kgYqQLMfH?utm_source=generator&theme=0',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXc8kgYqQLMfH',
    uriScheme: 'spotify:playlist:37i9dQZF1DXc8kgYqQLMfH',
  },
  {
    title: 'Grandmaster Deep Focus',
    artist: 'Chess & Strategy Instrumental',
    category: '🧠 Focus & Chess',
    embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator&theme=0',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
    uriScheme: 'spotify:playlist:37i9dQZF1DWZeKCadgRdKQ',
  },
  {
    title: 'Battle Arena & Adrenaline Rush',
    artist: 'Synthwave & Electronic Pulse',
    category: '🔥 Tournament Hype',
    embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXdLEN7aqioXM?utm_source=generator&theme=0',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM',
    uriScheme: 'spotify:playlist:37i9dQZF1DXdLEN7aqioXM',
  },
  {
    title: 'Ethiopian Traditional Krar & Masinko',
    artist: 'Traditional Masters',
    category: '🎻 ባህላዊ ቅኝት',
    embedUrl: 'https://open.spotify.com/embed/track/2t9a826PfgSjG1E37j3i7c?utm_source=generator&theme=0',
    spotifyUrl: 'https://open.spotify.com/track/2t9a826PfgSjG1E37j3i7c',
    uriScheme: 'spotify:track:2t9a826PfgSjG1E37j3i7c',
  },
];

interface SpotifyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string | null;
  onShareToRoom?: (track: SpotifyTrackInfo) => void;
  syncedTrack?: SpotifyTrackInfo | null;
}

export const SpotifyPlayerModal: React.FC<SpotifyPlayerModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onShareToRoom,
  syncedTrack,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrackInfo>(() => {
    const saved = localStorage.getItem('dama_last_spotify');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return SPOTIFY_PRESETS[0];
  });

  const [customLinkInput, setCustomLinkInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [sharedSuccess, setSharedSuccess] = useState(false);
  const [connectedToDevice, setConnectedToDevice] = useState(false);

  useEffect(() => {
    if (syncedTrack && syncedTrack.embedUrl !== selectedTrack.embedUrl) {
      setSelectedTrack(syncedTrack);
    }
  }, [syncedTrack]);

  useEffect(() => {
    try {
      localStorage.setItem('dama_last_spotify', JSON.stringify(selectedTrack));
    } catch (_) {}
  }, [selectedTrack]);

  const handleSpotifyConnect = () => {
    setConnectedToDevice(true);
    openTelegramExternalLink(selectedTrack.spotifyUrl);
  };

  const parseSpotifyUrl = (rawUrl: string): SpotifyTrackInfo | null => {
    try {
      const trimmed = rawUrl.trim();
      let type = 'playlist';
      let id = '';

      if (trimmed.startsWith('spotify:')) {
        const parts = trimmed.split(':');
        if (parts.length >= 3) {
          type = parts[1];
          id = parts[2];
        }
      } else {
        const url = new URL(trimmed);
        if (url.hostname.includes('spotify.com')) {
          const pathParts = url.pathname.split('/').filter(Boolean);
          if (pathParts.length >= 2) {
            type = pathParts[0];
            id = pathParts[1].split('?')[0];
          }
        }
      }

      if (type && id) {
        return {
          title: `Custom ${type.toUpperCase()}`,
          artist: 'Shared Track',
          category: '🔗 Custom Spotify',
          embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
          spotifyUrl: `https://open.spotify.com/${type}/${id}`,
          uriScheme: `spotify:${type}:${id}`,
        };
      }
    } catch (_) {}
    return null;
  };

  const handleApplyCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    if (!customLinkInput.trim()) return;

    const parsed = parseSpotifyUrl(customLinkInput);
    if (!parsed) {
      setInputError('እባክዎ ትክክለኛ የSpotify Link (track, playlist ወይም album) ያስገቡ።');
      return;
    }

    setSelectedTrack(parsed);
    setCustomLinkInput('');
  };

  const handleShareToOpponent = () => {
    if (!currentRoomId || !onShareToRoom) return;
    onShareToRoom(selectedTrack);
    setSharedSuccess(true);
    setTimeout(() => setSharedSuccess(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121622] border border-emerald-500/40 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden shadow-emerald-950/50">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-[#121622] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center shadow-lg shadow-[#1DB954]/10">
              <Music className="w-5 h-5 text-[#1DB954] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Cinzel'] font-bold text-base sm:text-lg text-emerald-300">
                  Spotify Music & Connect
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40">
                  Live Vibe
                </span>
              </div>
              <p className="text-xs text-slate-400">
                የSpotify ፕሌይሊስት ይምረጡ ወይም የራስዎን ሊንክ ይጫኑ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-300">
          {/* SPOTIFY CONNECT HERO BUTTON */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#1DB954]/20 via-emerald-950/40 to-slate-900 border border-[#1DB954]/40 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1DB954] flex items-center justify-center text-black shadow">
                  <Wifi className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    Spotify Connect
                    {connectedToDevice && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                        ተገናኝቷል ✓
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    በስልክዎ Spotify መተግበሪያ ላይ ሙዚቃውን በጀርባ ያገናኙ!
                  </p>
                </div>
              </div>

              <button
                onClick={handleSpotifyConnect}
                className="px-4 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#1DB954]/30 transition-all active:scale-95 shrink-0"
              >
                <Smartphone className="w-4 h-4" />
                <span>ከSpotify ጋር አገናኝ (Connect)</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-black/40 p-2 rounded-lg border border-slate-800/80 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
              <span>
                ይህን ሲጫኑ በስልክዎ የSpotify አፕ ውስጥ ሙዚቃው ይከፈታል፤ ስልኩ ቢቆለፍም ሙዚቃው በጀርባ አይቋረጥም!
              </span>
            </div>
          </div>

          {/* SPOTIFY EMBED (In-App Web Player) */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-[#1DB954]" />
              በጨዋታው ውስጥ ማጫወቻ (Web Player)
            </span>
            <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-[#0B0E14] shadow-inner p-1">
              <iframe
                src={selectedTrack.embedUrl}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="Spotify Main Player"
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Room Sync & Share Banner */}
          {currentRoomId ? (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#1DB954] animate-pulse shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    በክፍል {currentRoomId} ውስጥ ናችሁ
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ሙዚቃውን ለተቃዋሚዎ ያጋሩ
                  </div>
                </div>
              </div>
              <button
                onClick={handleShareToOpponent}
                className="px-3 py-1.5 bg-[#1DB954] text-black font-bold text-xs rounded-lg flex items-center gap-1"
              >
                {sharedSuccess ? 'ተጋርቷል!' : 'ለክፍሉ አጋራ'}
              </button>
            </div>
          ) : null}

          {/* Curated Presets Selection */}
          <div>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              የተመረጡ የSpotify ፕሌይሊስቶች (Featured Playlists)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {SPOTIFY_PRESETS.map((track) => (
                <button
                  key={track.title}
                  onClick={() => setSelectedTrack(track)}
                  className={`p-2 rounded-xl border text-left transition ${
                    selectedTrack.embedUrl === track.embedUrl
                      ? 'bg-emerald-950/50 border-emerald-500 text-white'
                      : 'bg-slate-800/60 border-slate-700/70 text-slate-300'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-slate-900 text-emerald-400">
                    {track.category}
                  </span>
                  <h4 className="font-bold text-xs truncate mt-1">{track.title}</h4>
                  <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom link input */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              የራስዎን Spotify Link እዚህ ያስገቡ
            </span>
            <form onSubmit={handleApplyCustomLink} className="flex gap-2">
              <input
                type="text"
                placeholder="https://open.spotify.com/playlist/..."
                value={customLinkInput}
                onChange={(e) => setCustomLinkInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 text-black font-bold text-xs rounded-lg"
              >
                ጫን
              </button>
            </form>
            {inputError && <p className="text-xs text-rose-400">{inputError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#0E121B] flex items-center justify-between gap-3 text-xs">
          <button
            onClick={() => {
              if (onShareToRoom) onShareToRoom(selectedTrack);
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold flex items-center gap-2 shadow-lg shadow-[#1DB954]/20 transition active:scale-95"
          >
            <span>ይህን ፕሌይሊስት አጫውት (Play Track)</span>
          </button>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
          >
            ዝጋ (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
