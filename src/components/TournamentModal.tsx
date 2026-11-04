/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Users, Swords, Calendar, Clock, Award, CheckCircle2, ChevronRight, X, Sparkles, Shield, AlertCircle } from 'lucide-react';
import { Tournament, TournamentMatch, PlayerProfile } from '../game/types';

interface TournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: PlayerProfile;
  onEnterTournamentMatch: (tournamentId: string, match: TournamentMatch) => void;
}

export const TournamentModal: React.FC<TournamentModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onEnterTournamentMatch,
}) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tournaments' | 'bracket' | 'players'>('tournaments');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinSuccessMsg, setJoinSuccessMsg] = useState<string | null>(null);

  // Fetch real tournaments from API
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tournaments');
      if (res.ok) {
        const data: Tournament[] = await res.json();
        setTournaments(data);
        if (!selectedTournament && data.length > 0) {
          setSelectedTournament(data[0]);
        } else if (selectedTournament) {
          const updated = data.find((t) => t.id === selectedTournament.id);
          if (updated) setSelectedTournament(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTournaments();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle 1-Click Tournament Registration
  const handleRegister = async (t: Tournament) => {
    try {
      setJoiningId(t.id);
      const res = await fetch(`/api/tournaments/${t.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          displayName: currentUser.displayName,
          elo: currentUser.elo,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setJoinSuccessMsg('🎉 በውድድሩ ላይ በተሳካ ሁኔታ ተመዝግበዋል! (Successfully registered!)');
        setTimeout(() => setJoinSuccessMsg(null), 4000);
        await fetchTournaments();
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
    } finally {
      setJoiningId(null);
    }
  };

  const isUserRegistered = (t: Tournament) => {
    return t.registeredPlayers.some((p) => p.id === currentUser.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#121620] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#181F2E] to-[#121620]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-black flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-['Cinzel'] font-black text-amber-300">
                  DAMA TOURNAMENTS
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ቀጥታ ውድድሮች
                </span>
              </div>
              <p className="text-xs text-slate-400">Official Ethiopian Dama Cups & Grand Prix</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {joinSuccessMsg && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-2 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{joinSuccessMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0F131C] px-3 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'tournaments'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>ውድድሮች (Tournaments)</span>
          </button>
          <button
            onClick={() => setActiveTab('bracket')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'bracket'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>የጥሎ ማለፍ ሰንጠረዥ (Bracket)</span>
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'players'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>ተወዳዳሪዎች (Warriors)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {activeTab === 'tournaments' && (
            <div className="space-y-3">
              {tournaments.map((t) => {
                const registered = isUserRegistered(t);
                const isSelected = selectedTournament?.id === t.id;
                const percentFull = Math.round((t.registeredPlayers.length / t.maxPlayers) * 100);

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTournament(t)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#1B2233] to-[#141A28] border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-slate-100">{t.title}</h3>
                          {t.status === 'live' && (
                            <span className="flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              LIVE
                            </span>
                          )}
                          {t.status === 'registering' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ምዝገባ ላይ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                      </div>

                      {/* Prize Capsule */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 bg-slate-950/60 p-2 sm:p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Prize Pool:</span>
                        <span className="text-xs sm:text-sm font-black text-amber-400 flex items-center gap-1 font-mono">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          {t.prizeXp.toLocaleString()} XP + ዋንጫ
                        </span>
                      </div>
                    </div>

                    {/* Progress & Registration Action */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex-1">
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>የተመዘገቡ ተጫዋቾች ({t.registeredPlayers.length}/{t.maxPlayers})</span>
                          <span className="font-bold text-amber-300">{percentFull}% Full</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all"
                            style={{ width: `${percentFull}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {registered ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTournament(t);
                              const myMatch = t.matches.find(
                                (m) => (m.player1?.id === currentUser.id || m.player2?.id === currentUser.id) && m.status !== 'finished'
                              ) || t.matches.find((m) => m.status !== 'finished');
                              if (myMatch) {
                                onClose();
                                onEnterTournamentMatch(t.id, myMatch);
                              } else {
                                setActiveTab('bracket');
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            <span>🎮 ግጥሚያ ጀምር | Play Match</span>
                          </button>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleRegister(t);
                              setSelectedTournament(t);
                              setActiveTab('bracket');
                            }}
                            disabled={joiningId === t.id}
                            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                          >
                            {joiningId === t.id ? 'በመመዝገብ ላይ...' : 'ተመዝገብ እና ተጫወት | Join & Play'}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedTournament(t);
                            setActiveTab('bracket');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700"
                        >
                          <span>ሰንጠረዥ</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'bracket' && selectedTournament && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-amber-300">{selectedTournament.title}</h3>
                  <p className="text-[11px] text-slate-400">የጥሎ ማለፍ የግጥሚያ ሰንጠረዥ (Knockout Brackets)</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30">
                  {selectedTournament.status === 'live' ? '🟢 በሂደት ላይ' : '⏳ በመዘጋጀት ላይ'}
                </span>
              </div>

              {/* Bracket Matches List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTournament.matches.map((m) => {
                  const isUserMatch = m.player1?.id === currentUser.id || m.player2?.id === currentUser.id;

                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isUserMatch
                          ? 'bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-2 pb-1.5 border-b border-slate-800">
                        <span>{m.roundName}</span>
                        {m.status === 'finished' && <span className="text-emerald-400">ተጠናቋል (Finished)</span>}
                        {m.status === 'ongoing' && <span className="text-amber-400 animate-pulse">🔴 በመጫወት ላይ</span>}
                        {m.status === 'upcoming' && <span className="text-slate-500">ቀጣይ ግጥሚያ</span>}
                      </div>

                      {/* Players Row */}
                      <div className="space-y-1.5 text-xs">
                        <div
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            m.winnerId === m.player1?.id
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                              : 'bg-slate-950 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-amber-300">
                              1
                            </span>
                            <span className="font-semibold">{m.player1?.name || 'በመጠበቅ ላይ (Waiting...)'}</span>
                          </div>
                          {m.player1 && <span className="text-[10px] text-slate-400 font-mono">{m.player1.elo} ELO</span>}
                        </div>

                        <div
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            m.winnerId === m.player2?.id
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                              : 'bg-slate-950 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              2
                            </span>
                            <span className="font-semibold">{m.player2?.name || 'በመጠበቅ ላይ (Waiting...)'}</span>
                          </div>
                          {m.player2 && <span className="text-[10px] text-slate-400 font-mono">{m.player2.elo} ELO</span>}
                        </div>
                      </div>

                      {/* Action for User Match or Any Playable Tournament Match */}
                      {m.status !== 'finished' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 font-mono">
                            {isUserMatch ? '⭐ የእርስዎ ግጥሚያ' : 'የውድድር ግጥሚያ'}
                          </span>
                          <button
                            onClick={() => {
                              onClose();
                              onEnterTournamentMatch(selectedTournament.id, m);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            <span>{isUserMatch ? 'ወደ ግጥሚያ ግባ | Play Match' : 'ይህንን ግጥሚያ ተጫወት | Play This Match'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'players' && selectedTournament && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>የተመዘገቡ ተጫዋቾች ({selectedTournament.registeredPlayers.length})</span>
                <span className="text-amber-400 font-bold">Max: {selectedTournament.maxPlayers}</span>
              </div>

              <div className="divide-y divide-slate-800/80 bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                {selectedTournament.registeredPlayers.map((p, idx) => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold font-mono">
                        {idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-black flex items-center justify-center font-bold text-xs shadow">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-200">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.wins} wins in arena</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-amber-400">{p.elo} ELO</div>
                      <div className="text-[10px] text-slate-500">ተወዳዳሪ</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
