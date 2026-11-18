/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { DamaBoard } from './components/DamaBoard';
import { GameHUD } from './components/GameHUD';
import { ModeSelectModal } from './components/ModeSelectModal';
import { FriendRoomModal } from './components/FriendRoomModal';
import { MatchmakingModal } from './components/MatchmakingModal';
import { ProfileModal } from './components/ProfileModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { TournamentModal } from './components/TournamentModal';
import {
  SpotifyPlayerModal,
  SPOTIFY_PRESETS,
  SpotifyTrackInfo,
} from './components/SpotifyPlayerModal';
import { InGameSpotifyDock } from './components/InGameSpotifyDock';
import { Music } from 'lucide-react';

import {
  createNewGame,
  applyMove,
  getLegalMoves,
  executeInteractiveStep,
} from './game/engine';
import {
  GameConfig,
  GameState,
  PieceColor,
  PlayerProfile,
  Position,
  TournamentMatch,
  DEFAULT_CONFIG,
} from './game/types';
import { AiDifficulty, getAiMoveAsync } from './game/ai';
import { sounds, triggerHaptic } from './utils/audio';
import {
  getTelegramInitData,
  getTelegramStartParam,
  getTelegramUser,
  initTelegramUI,
  isTelegramWebApp,
} from './utils/telegram';

type GameMode = 'ai' | 'friend' | 'multiplayer' | 'local';

const DEFAULT_PROFILE: PlayerProfile = {
  id: 'guest_local',
  username: 'Arena_Warrior',
  displayName: 'Arena Warrior',
  avatarSeed: 'Warrior',
  elo: 1200,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  winStreak: 0,
  bestStreak: 0,
  level: 1,
  xp: 0,
  createdAt: Date.now(),
  badges: ['Recruit'],
};

export default function App() {
  // Profiles and user state
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [isTelegram, setIsTelegram] = useState(false);

  // Configuration and preferences
  const [gameConfig, setGameConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notationType, setNotationType] = useState<'draughts_50' | 'algebraic' | 'none'>('draughts_50');
  const [flipped, setFlipped] = useState(false);

  // Game session state
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('medium');
  const [playerColor, setPlayerColor] = useState<PieceColor>('white');
  const [gameState, setGameState] = useState<GameState>(() => createNewGame(DEFAULT_CONFIG));
  const [historyStack, setHistoryStack] = useState<GameState[]>([]);

  // Board interaction
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Timers (in seconds)
  const [whiteTimer, setWhiteTimer] = useState(600);
  const [blackTimer, setBlackTimer] = useState(600);

  // Multiplayer / WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [waitingForFriend, setWaitingForFriend] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [prefillJoinCode, setPrefillJoinCode] = useState<string | null>(null);
  const [matchmakingQueueSize, setMatchmakingQueueSize] = useState(1);
  const [openRoomsCount, setOpenRoomsCount] = useState(0);
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<{
    tournamentId: string;
    match: TournamentMatch;
  } | null>(null);

  // Modals
  const [modeSelectOpen, setModeSelectOpen] = useState(false);
  const [friendRoomOpen, setFriendRoomOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [currentSpotifyTrack, setCurrentSpotifyTrack] = useState<SpotifyTrackInfo | null>(SPOTIFY_PRESETS[0]);
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);

  // Latest state refs (prevents stale closures in WS handlers)
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const gameModeRef = useRef(gameMode);
  gameModeRef.current = gameMode;
  const playerColorRef = useRef(playerColor);
  playerColorRef.current = playerColor;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const waitingForFriendRef = useRef(waitingForFriend);
  waitingForFriendRef.current = waitingForFriend;
  const opponentNameRef = useRef(opponentName);
  opponentNameRef.current = opponentName;
  const opponentIdRef = useRef(opponentId);
  opponentIdRef.current = opponentId;
  const activeTournamentMatchRef = useRef(activeTournamentMatch);
  activeTournamentMatchRef.current = activeTournamentMatch;
  const currentSpotifyTrackRef = useRef(currentSpotifyTrack);
  currentSpotifyTrackRef.current = currentSpotifyTrack;
  const aiDifficultyRef = useRef(aiDifficulty);
  aiDifficultyRef.current = aiDifficulty;
  const recordedMatchKeyRef = useRef<string | null>(null);

  const safeWsSend = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  // Calculate legal moves for active turn
  const legalMoves = useMemo(() => {
    return getLegalMoves(gameState);
  }, [gameState]);

  // Handle sound mute/unmute
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // Handle Game End Record & Rewards (deduplicated per match)
  const handleGameEnd = useCallback((finalState: GameState) => {
    setGameOverOpen(true);

    const mode = gameModeRef.current;
    const pColor = playerColorRef.current;
    const prof = profileRef.current;
    const rId = roomIdRef.current;
    const key = `${rId || mode}:${finalState.moveHistory.length}:${finalState.status}`;

    if (recordedMatchKeyRef.current === key) {
      return;
    }
    recordedMatchKeyRef.current = key;

    const whitePlayerName =
      mode === 'ai'
        ? pColor === 'white'
          ? prof.displayName
          : 'AI'
        : mode === 'friend' || mode === 'multiplayer'
        ? pColor === 'white'
          ? prof.displayName
          : opponentNameRef.current
        : 'White';

    const blackPlayerName =
      mode === 'ai'
        ? pColor === 'black'
          ? prof.displayName
          : `AI (${aiDifficultyRef.current})`
        : mode === 'friend' || mode === 'multiplayer'
        ? pColor === 'black'
          ? prof.displayName
          : opponentNameRef.current
        : 'Black';

    const whitePlayerId =
      mode === 'local'
        ? undefined
        : pColor === 'white'
        ? prof.id
        : opponentIdRef.current || undefined;
    const blackPlayerId =
      mode === 'local'
        ? undefined
        : pColor === 'black'
        ? prof.id
        : opponentIdRef.current || undefined;

    fetch('/api/matches/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        whitePlayer: whitePlayerName,
        blackPlayer: blackPlayerName,
        whitePlayerId,
        blackPlayerId,
        winner: finalState.winner,
        reason: finalState.statusReason,
        totalTurns: finalState.turnCount,
        difficulty: mode === 'ai' ? aiDifficultyRef.current : undefined,
        dedupKey: rId ? key : undefined,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        fetch(`/api/profile/${prof.id}`)
          .then((r) => r.json())
          .then((updated) => {
            if (updated && updated.id) setProfile(updated);
          })
          .catch(() => {});
      })
      .catch(() => {});

    // Persist tournament bracket result if this match came from a tournament
    const tourneyCtx = activeTournamentMatchRef.current;
    if (tourneyCtx) {
      const playerWon = finalState.winner === pColor;
      const oppObj =
        tourneyCtx.match.player1?.id === prof.id
          ? tourneyCtx.match.player2
          : tourneyCtx.match.player1;
      const winnerId = playerWon ? prof.id : oppObj?.id || 'opponent_rival';
      const winnerName = playerWon ? prof.displayName : oppObj?.name || opponentNameRef.current;
      const winnerElo = playerWon ? prof.elo : oppObj?.elo || 1500;

      fetch(
        `/api/tournaments/${tourneyCtx.tournamentId}/matches/${tourneyCtx.match.id}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winnerId, winnerName, winnerElo }),
        }
      )
        .then(() => {
          setActiveTournamentMatch(null);
        })
        .catch(() => {});
    }
  }, []);

  const applyMatchFound = useCallback(
    (payload: { roomId: string; color: PieceColor; opponentName?: string; state: GameState }) => {
      recordedMatchKeyRef.current = null;
      setMatchmakingOpen(false);
      setFriendRoomOpen(false);
      setRoomId(payload.roomId);
      setIsHost(payload.color === 'white');
      setWaitingForFriend(false);
      setOpponentConnected(true);
      setOpponentId(null);
      setPlayerColor(payload.color);
      setFlipped(payload.color === 'black');
      setOpponentName(payload.opponentName || 'Online Champion');
      setGameState(payload.state);
      setHistoryStack([]);
      setSelectedPos(null);
      setWhiteTimer(600);
      setBlackTimer(600);
      setGameOverOpen(false);
      setGameMode('multiplayer');
      safeWsSend({ type: 'ATTACH_ROOM', roomId: payload.roomId });
    },
    [safeWsSend]
  );

  // Initialize Telegram & User Profile
  useEffect(() => {
    initTelegramUI();
    const inTg = isTelegramWebApp();
    setIsTelegram(inTg);

    const initData = getTelegramInitData();
    const tgUser = getTelegramUser();
    if (initData || tgUser) {
      fetch('/api/telegram/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, unsafeUser: tgUser }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
            localStorage.setItem('dama_user_id', data.profile.id);
            localStorage.setItem('dama_user_name', data.profile.displayName);
          }
        })
        .catch((err) => console.warn('Telegram auth fallback:', err));
    } else {
      const storedId = localStorage.getItem('dama_user_id');
      const storedName = localStorage.getItem('dama_user_name');
      fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storedId, username: storedName || undefined }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.profile) {
            setProfile(data.profile);
            localStorage.setItem('dama_user_id', data.profile.id);
            localStorage.setItem('dama_user_name', data.profile.displayName);
          }
        })
        .catch(() => {});
    }

    // Check deep-linking parameter
    const startParam = getTelegramStartParam();
    if (startParam) {
      if (
        startParam.startsWith('join_') ||
        (startParam.length === 6 && !['leader', 'multi_', 'tourna'].includes(startParam.slice(0, 6)))
      ) {
        const cleanCode = startParam.replace('join_', '').toUpperCase();
        setPrefillJoinCode(cleanCode);
        setFriendRoomOpen(true);
      } else if (startParam === 'ai') {
        setModeSelectOpen(true);
      } else if (startParam === 'friend') {
        setFriendRoomOpen(true);
      } else if (startParam === 'multiplayer') {
        setMatchmakingOpen(true);
      } else if (startParam === 'profile') {
        setProfileOpen(true);
      } else if (startParam === 'rules') {
        setRulesOpen(true);
      } else if (startParam === 'tournaments' || startParam === 'tournament') {
        setTournamentOpen(true);
      } else if (startParam === 'music' || startParam === 'spotify') {
        setSpotifyOpen(true);
      } else if (startParam === 'leaderboard') {
        setLeaderboardOpen(true);
      }
    }
  }, []);

  // Single persistent WebSocket with auto-reconnect and keepalive
  useEffect(() => {
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let activeSocket: WebSocket | null = null;

    const connect = () => {
      if (!mounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      activeSocket = socket;
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mounted) return;
        setWsConnected(true);
        const prof = profileRef.current;
        try {
          socket.send(
            JSON.stringify({
              type: 'INIT_CLIENT',
              userId: prof.id,
              displayName: prof.displayName,
            })
          );
          if (roomIdRef.current) {
            socket.send(
              JSON.stringify({
                type: 'ATTACH_ROOM',
                roomId: roomIdRef.current,
              })
            );
          }
        } catch {
          // ignore
        }

        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: 'PING' }));
            } catch {
              // ignore
            }
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'ROOM_CREATED':
              recordedMatchKeyRef.current = null;
              setRoomId(msg.roomId);
              setIsHost(true);
              setWaitingForFriend(true);
              setOpponentConnected(false);
              setPlayerColor('white');
              setFlipped(false);
              setGameState(msg.state);
              setGameMode('friend');
              break;

            case 'ROOM_JOINED':
              recordedMatchKeyRef.current = null;
              setRoomId(msg.roomId);
              setIsHost(false);
              setWaitingForFriend(false);
              setOpponentConnected(true);
              setPlayerColor('black');
              setFlipped(true);
              setOpponentName(msg.whiteName || 'Host');
              setGameState(msg.state);
              setFriendRoomOpen(false);
              setGameMode('friend');
              break;

            case 'ATTACH_ACK': {
              if (msg.myColor && msg.myColor !== playerColorRef.current) {
                setPlayerColor(msg.myColor);
                setFlipped(msg.myColor === 'black');
              }
              if (msg.hasOpponent) {
                setWaitingForFriend(false);
                setOpponentConnected(true);
                setFriendRoomOpen(false);
                const opp =
                  (msg.myColor || playerColorRef.current) === 'white'
                    ? msg.blackName
                    : msg.whiteName;
                if (opp) setOpponentName(opp);
              }
              if (msg.state) {
                const cur = gameStateRef.current;
                if (
                  msg.state.moveHistory?.length !== cur.moveHistory.length ||
                  msg.state.turn !== cur.turn ||
                  msg.state.status !== cur.status
                ) {
                  setGameState(msg.state);
                  setSelectedPos(null);
                  if (msg.state.status !== 'playing') {
                    handleGameEnd(msg.state);
                  }
                }
              }
              if (typeof msg.whiteTimerMs === 'number') {
                setWhiteTimer(Math.ceil(msg.whiteTimerMs / 1000));
              }
              if (typeof msg.blackTimerMs === 'number') {
                setBlackTimer(Math.ceil(msg.blackTimerMs / 1000));
              }
              break;
            }

            case 'OPPONENT_JOINED':
              setWaitingForFriend(false);
              setOpponentConnected(true);
              setOpponentName(msg.opponentName || 'Challenger');
              setGameState(msg.state);
              setFriendRoomOpen(false);
              setGameMode('friend');
              break;

            case 'OPPONENT_STATUS':
              if (msg.userId && msg.userId !== profileRef.current.id) {
                setOpponentConnected(Boolean(msg.connected));
              }
              break;

            case 'MATCH_FOUND':
              applyMatchFound(msg);
              break;

            case 'MOVE_APPLIED':
              setGameState(msg.state);
              setSelectedPos(null);
              if (typeof msg.whiteTimerMs === 'number') {
                setWhiteTimer(Math.ceil(msg.whiteTimerMs / 1000));
              }
              if (typeof msg.blackTimerMs === 'number') {
                setBlackTimer(Math.ceil(msg.blackTimerMs / 1000));
              }
              if (msg.move?.capturedPositions?.length > 0) {
                sounds.playCapture();
              } else {
                sounds.playMove();
              }
              if (msg.move?.isPromotion) {
                sounds.playPromotion();
              }
              if (msg.state && msg.state.status !== 'playing') {
                handleGameEnd(msg.state);
              }
              break;

            case 'GAME_OVER': {
              const finalState: GameState = msg.state || {
                ...gameStateRef.current,
                status: msg.status,
                winner: msg.winner,
                statusReason: msg.reason,
              };
              setGameState(finalState);
              handleGameEnd(finalState);
              break;
            }

            case 'REMATCH_STARTED': {
              recordedMatchKeyRef.current = null;
              const myId = profileRef.current.id;
              let nextColor: PieceColor =
                playerColorRef.current === 'white' ? 'black' : 'white';
              if (msg.whiteId && msg.whiteId === myId) nextColor = 'white';
              else if (msg.blackId && msg.blackId === myId) nextColor = 'black';

              setPlayerColor(nextColor);
              setFlipped(nextColor === 'black');
              if (nextColor === 'white' && msg.blackName) {
                setOpponentName(msg.blackName);
              } else if (nextColor === 'black' && msg.whiteName) {
                setOpponentName(msg.whiteName);
              }
              setGameState(msg.state);
              setHistoryStack([]);
              setSelectedPos(null);
              setWhiteTimer(600);
              setBlackTimer(600);
              setGameOverOpen(false);
              break;
            }

            case 'SPOTIFY_UPDATED':
              if (msg.spotifyUri) {
                setCurrentSpotifyTrack({
                  title: msg.spotifyTitle || 'Shared Music',
                  category: `Shared by ${msg.sharedBy || 'Opponent'}`,
                  embedUrl: msg.spotifyUri,
                  spotifyUrl: msg.spotifyUri,
                  artist: msg.sharedBy || 'Opponent',
                });
              }
              break;
          }
        } catch (err) {
          console.error('WebSocket receive error:', err);
        }
      };

      socket.onclose = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (!mounted) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingInterval) clearInterval(pingInterval);
      if (activeSocket) {
        try {
          activeSocket.close();
        } catch {
          // ignore
        }
      }
    };
  }, [applyMatchFound, handleGameEnd]);

  // Re-identify socket whenever profile resolves (without tearing down WebSocket)
  useEffect(() => {
    if (safeWsSend({ type: 'INIT_CLIENT', userId: profile.id, displayName: profile.displayName })) {
      if (roomIdRef.current) {
        safeWsSend({ type: 'ATTACH_ROOM', roomId: roomIdRef.current });
      }
    }
  }, [profile.id, profile.displayName, safeWsSend]);

  // Periodic room polling fallback (mobile networks / Telegram WebView resilient)
  useEffect(() => {
    if (!roomId || (gameMode !== 'friend' && gameMode !== 'multiplayer')) return;

    const pollRoom = () => {
      fetch(`/api/rooms/${roomId}/state?userId=${encodeURIComponent(profileRef.current.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.state) return;

          if (data.hasOpponent) {
            if (waitingForFriendRef.current) {
              setWaitingForFriend(false);
              setOpponentConnected(true);
              setFriendRoomOpen(false);
            }
            const myCol = data.myColor || playerColorRef.current;
            const oppN = myCol === 'white' ? data.blackName : data.whiteName;
            const oppI = myCol === 'white' ? data.blackId : data.whiteId;
            if (oppN) setOpponentName(oppN);
            if (oppI) setOpponentId(oppI);
          }

          if (data.myColor && data.myColor !== playerColorRef.current) {
            setPlayerColor(data.myColor);
            setFlipped(data.myColor === 'black');
          }

          const cur = gameStateRef.current;
          const serverMoves = data.state.moveHistory?.length ?? 0;
          if (
            serverMoves !== cur.moveHistory.length ||
            data.state.turn !== cur.turn ||
            data.state.status !== cur.status
          ) {
            setGameState(data.state);
            setSelectedPos(null);
            if (data.state.status !== 'playing') {
              handleGameEnd(data.state);
            } else if (serverMoves === 0 && cur.moveHistory.length > 0) {
              // Rematch detected via polling
              recordedMatchKeyRef.current = null;
              setGameOverOpen(false);
              setHistoryStack([]);
              setWhiteTimer(600);
              setBlackTimer(600);
            }
          }

          if (data.hasOpponent && data.state.status === 'playing') {
            if (typeof data.whiteTimerMs === 'number') {
              setWhiteTimer(Math.ceil(data.whiteTimerMs / 1000));
            }
            if (typeof data.blackTimerMs === 'number') {
              setBlackTimer(Math.ceil(data.blackTimerMs / 1000));
            }
          }

          if (
            data.spotifyUri &&
            (!currentSpotifyTrackRef.current ||
              currentSpotifyTrackRef.current.embedUrl !== data.spotifyUri)
          ) {
            setCurrentSpotifyTrack({
              title: data.spotifyTitle || 'Room Track',
              category: 'Shared in Room',
              embedUrl: data.spotifyUri,
              spotifyUrl: data.spotifyUri,
            });
          }
        })
        .catch(() => {});
    };

    pollRoom();
    const pollInterval = setInterval(pollRoom, 2000);
    return () => clearInterval(pollInterval);
  }, [roomId, gameMode, handleGameEnd]);

  // Matchmaking polling fallback while searching
  useEffect(() => {
    if (!matchmakingOpen) return;

    const pollMatchmaking = () => {
      fetch(`/api/matchmaking/status?userId=${encodeURIComponent(profileRef.current.id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.matched && data.roomId && data.state) {
            applyMatchFound(data);
          } else {
            if (typeof data.queueSize === 'number') setMatchmakingQueueSize(data.queueSize);
            if (typeof data.openRoomsCount === 'number') setOpenRoomsCount(data.openRoomsCount);
          }
        })
        .catch(() => {});
    };

    pollMatchmaking();
    const interval = setInterval(pollMatchmaking, 2000);
    return () => clearInterval(interval);
  }, [matchmakingOpen, applyMatchFound]);

  // Turn Timer Countdown (paused while waiting for opponent in online rooms)
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    if ((gameMode === 'friend' || gameMode === 'multiplayer') && waitingForFriend) return;

    const interval = setInterval(() => {
      if (gameState.turn === 'white') {
        setWhiteTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            const timeoutState: GameState = {
              ...gameStateRef.current,
              status: 'black_won',
              winner: 'black',
              statusReason: 'White ran out of time!',
            };
            setGameState(timeoutState);
            handleGameEnd(timeoutState);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            const timeoutState: GameState = {
              ...gameStateRef.current,
              status: 'white_won',
              winner: 'white',
              statusReason: 'Black ran out of time!',
            };
            setGameState(timeoutState);
            handleGameEnd(timeoutState);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, gameState.turn, gameMode, waitingForFriend, handleGameEnd]);

  // AI Turn Handling
  useEffect(() => {
    if (gameMode !== 'ai') return;
    if (gameState.status !== 'playing') return;

    const isAiTurn = gameState.turn !== playerColor;
    if (!isAiTurn) return;

    let active = true;
    setIsAiThinking(true);

    getAiMoveAsync(gameState, aiDifficulty)
      .then((res) => {
        if (!active) return;
        setIsAiThinking(false);

        if (!res || !res.move) {
          const humanColor = playerColor;
          const wonState: GameState = {
            ...gameState,
            status: humanColor === 'white' ? 'white_won' : 'black_won',
            winner: humanColor,
            statusReason: 'AI has no legal moves remaining. Victory by stalemate!',
          };
          setGameState(wonState);
          handleGameEnd(wonState);
          return;
        }

        const move = res.move;
        setHistoryStack((prev) => [...prev, gameState]);
        const next = applyMove(gameState, move);
        setGameState(next);

        if (move.capturedPositions.length > 0) {
          sounds.playCapture();
        } else {
          sounds.playMove();
        }
        if (move.isPromotion) {
          sounds.playPromotion();
        }

        if (next.status !== 'playing') {
          handleGameEnd(next);
        }
      })
      .catch((err) => {
        if (!active) return;
        setIsAiThinking(false);
        console.error('Safely recovered AI error:', err);
      });

    return () => {
      active = false;
      setIsAiThinking(false);
    };
  }, [gameState, gameMode, playerColor, aiDifficulty, handleGameEnd]);

  // Human player executes a move or step
  const handleHumanStep = (from: Position, to: Position) => {
    if (gameState.status !== 'playing') return;

    if (gameMode === 'ai' && gameState.turn !== playerColor) return;
    if (gameMode === 'friend' || gameMode === 'multiplayer') {
      if (waitingForFriend) return;
      if (gameState.turn !== playerColor) return;
    }

    try {
      const { nextState, turnContinues } = executeInteractiveStep(gameState, from, to);

      setHistoryStack((prev) => [...prev, gameState]);
      setGameState(nextState);

      const didCapture = Boolean(
        nextState.activeCapturePiece || nextState.pendingCapturedPositions.length > 0
      );
      if (didCapture) {
        sounds.playCapture();
        triggerHaptic('medium');
      } else {
        sounds.playMove();
        triggerHaptic('light');
      }

      if (turnContinues) {
        setSelectedPos(to);
      } else {
        setSelectedPos(null);

        // If online multiplayer, synchronize authoritative move once via REST (which broadcasts via WS)
        if (gameMode === 'friend' || gameMode === 'multiplayer') {
          const executedMove = nextState.moveHistory[nextState.moveHistory.length - 1];
          const expectedMoveCount = Math.max(0, nextState.moveHistory.length - 1);

          if (roomId) {
            fetch(`/api/rooms/${roomId}/move`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: profile.id,
                move: executedMove,
                expectedMoveCount,
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data?.state) {
                  setGameState(data.state);
                  if (data.state.status !== 'playing') {
                    handleGameEnd(data.state);
                  }
                }
              })
              .catch(() => {
                safeWsSend({
                  type: 'PLAY_MOVE',
                  roomId,
                  move: executedMove,
                  expectedMoveCount,
                });
              });
          } else {
            safeWsSend({
              type: 'PLAY_MOVE',
              move: executedMove,
              expectedMoveCount,
            });
          }
        }

        if (nextState.status !== 'playing') {
          handleGameEnd(nextState);
        }
      }
    } catch (err) {
      sounds.playError();
      triggerHaptic('error');
      console.warn('Illegal step rejected:', err);
    }
  };

  // Start matchmaking (REST + WS unified)
  const handleStartMatchmaking = () => {
    setMatchmakingOpen(true);
    setMatchmakingQueueSize(1);
    fetch('/api/matchmaking/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        displayName: profile.displayName,
        config: gameConfig,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.matched && data.roomId && data.state) {
          applyMatchFound(data);
        } else if (typeof data.queueSize === 'number') {
          setMatchmakingQueueSize(data.queueSize);
        }
      })
      .catch(() => {
        safeWsSend({ type: 'FIND_MATCH', config: gameConfig });
      });
  };

  const handleCancelMatchmaking = () => {
    setMatchmakingOpen(false);
    fetch('/api/matchmaking/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id }),
    }).catch(() => {});
    safeWsSend({ type: 'CANCEL_MATCHMAKING' });
  };

  // Start new match
  const startNewMatch = (
    mode: GameMode,
    newConfig: Partial<GameConfig> = {},
    color: PieceColor = 'white',
    difficulty: AiDifficulty = 'medium'
  ) => {
    recordedMatchKeyRef.current = null;
    const mergedConfig = { ...gameConfig, ...newConfig };
    const newGame = createNewGame(mergedConfig);

    if (mode === 'ai' || mode === 'local') {
      setRoomId(null);
      setIsHost(false);
      setWaitingForFriend(false);
      setOpponentConnected(true);
      setOpponentId(null);
      setActiveTournamentMatch(null);
    }

    setGameMode(mode);
    setPlayerColor(color);
    setFlipped(color === 'black');
    setAiDifficulty(difficulty);
    setGameState(newGame);
    setHistoryStack([]);
    setSelectedPos(null);
    setWhiteTimer(600);
    setBlackTimer(600);
    setGameOverOpen(false);
  };

  // Undo move
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    if (gameMode === 'ai') {
      if (historyStack.length >= 2) {
        const target = historyStack[historyStack.length - 2];
        setGameState(target);
        setHistoryStack((prev) => prev.slice(0, -2));
      } else if (historyStack.length === 1) {
        const target = historyStack[0];
        setGameState(target);
        setHistoryStack([]);
      }
    } else if (gameMode === 'local') {
      const target = historyStack[historyStack.length - 1];
      setGameState(target);
      setHistoryStack((prev) => prev.slice(0, -1));
    }
    setSelectedPos(null);
  };

  // Resign match
  const handleResign = () => {
    if (gameState.status !== 'playing') return;

    if ((gameMode === 'friend' || gameMode === 'multiplayer') && roomId) {
      fetch(`/api/rooms/${roomId}/resign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.state) {
            setGameState(data.state);
            handleGameEnd(data.state);
          }
        })
        .catch(() => {
          safeWsSend({ type: 'RESIGN', roomId });
        });
      return;
    }

    const resigning: PieceColor = gameMode === 'local' ? gameState.turn : playerColor;
    const winner: PieceColor = resigning === 'white' ? 'black' : 'white';
    const resignedState: GameState = {
      ...gameState,
      status: winner === 'white' ? 'white_won' : 'black_won',
      winner,
      statusReason: `${resigning.toUpperCase()} resigned the match.`,
    };
    setGameState(resignedState);
    handleGameEnd(resignedState);
  };

  // Cycle notation
  const cycleNotation = () => {
    if (notationType === 'draughts_50') setNotationType('algebraic');
    else if (notationType === 'algebraic') setNotationType('none');
    else setNotationType('draughts_50');
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#E2E8F0] flex flex-col justify-between selection:bg-amber-500/30">
      {/* Top Navigation Bar */}
      <Header
        profile={profile}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenModeSelect={() => setModeSelectOpen(true)}
        onOpenTournaments={() => setTournamentOpen(true)}
        onOpenSpotify={() => setSpotifyOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        isOnline={wsConnected}
        isTelegram={isTelegram}
        boardSize={gameState.config.boardSize}
        currentMusicTitle={currentSpotifyTrack?.title}
      />

      {/* Main Playing Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 w-full max-w-2xl mx-auto">
        <GameHUD
          state={gameState}
          gameMode={gameMode}
          playerColor={playerColor}
          whiteName={
            gameMode === 'ai'
              ? playerColor === 'white'
                ? profile.displayName
                : 'Dama AI'
              : gameMode === 'friend' || gameMode === 'multiplayer'
              ? playerColor === 'white'
                ? profile.displayName
                : opponentName
              : 'White (Local)'
          }
          blackName={
            gameMode === 'ai'
              ? playerColor === 'black'
                ? profile.displayName
                : 'Dama AI'
              : gameMode === 'friend' || gameMode === 'multiplayer'
              ? playerColor === 'black'
                ? profile.displayName
                : opponentName
              : 'Black (Local)'
          }
          aiDifficulty={aiDifficulty}
          isAiThinking={isAiThinking}
          whiteTimer={whiteTimer}
          blackTimer={blackTimer}
          roomId={roomId}
          waitingForOpponent={waitingForFriend}
          opponentConnected={opponentConnected}
          onUndo={handleUndo}
          canUndo={(gameMode === 'ai' || gameMode === 'local') && historyStack.length > 0}
          onRestart={() => startNewMatch(gameMode, gameConfig, playerColor, aiDifficulty)}
          onResign={handleResign}
          onFlipBoard={() => setFlipped((prev) => !prev)}
          notationType={notationType}
          onCycleNotation={cycleNotation}
        />

        <DamaBoard
          state={gameState}
          legalMoves={legalMoves}
          selectedPos={selectedPos}
          onSelectPiece={(pos) => setSelectedPos(pos)}
          onExecuteMove={(from, to) => handleHumanStep(from, to)}
          flipped={flipped}
          notationType={notationType}
          disabled={
            isAiThinking ||
            gameState.status !== 'playing' ||
            ((gameMode === 'friend' || gameMode === 'multiplayer') &&
              (waitingForFriend || gameState.turn !== playerColor))
          }
        />

        {/* On-Board / In-Game Spotify Player */}
        <InGameSpotifyDock
          currentTrack={currentSpotifyTrack || SPOTIFY_PRESETS[0]}
          onSelectTrack={(track) => {
            setCurrentSpotifyTrack(track);
            if (roomId) {
              fetch(`/api/rooms/${roomId}/spotify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  spotifyUri: track.embedUrl,
                  spotifyTitle: track.title,
                  sharedBy: profile.displayName,
                }),
              }).catch(() => {});
              safeWsSend({
                type: 'SYNC_SPOTIFY',
                roomId,
                spotifyUri: track.embedUrl,
                spotifyTitle: track.title,
              });
            }
          }}
          roomId={roomId}
        />
      </main>

      {/* Floating Spotify Quick Access Pill */}
      <button
        onClick={() => setSpotifyOpen(true)}
        className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-30 px-3 py-2 rounded-full bg-[#121620]/95 hover:bg-[#161c28] border border-emerald-500/50 shadow-xl shadow-black/60 flex items-center gap-2 group backdrop-blur-md transition-all active:scale-95 text-xs"
        aria-label="Spotify Music Lounge"
        title="Open Spotify Lounge"
      >
        <div className="w-5 h-5 rounded-full bg-[#1DB954] flex items-center justify-center text-black">
          <Music className="w-3 h-3 fill-current" />
        </div>
        <span className="font-bold text-emerald-300 hidden sm:inline max-w-[130px] truncate">
          {currentSpotifyTrack?.title || 'Spotify Music'}
        </span>
        <div className="flex items-end gap-0.5 h-3">
          <span className="w-0.5 h-full bg-[#1DB954] rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-0.5 h-2/3 bg-[#1DB954] rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-0.5 h-4/5 bg-[#1DB954] rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </button>

      {/* Modals */}
      <ModeSelectModal
        isOpen={modeSelectOpen}
        onClose={() => setModeSelectOpen(false)}
        onOpenTournaments={() => {
          setModeSelectOpen(false);
          setTournamentOpen(true);
        }}
        onSelectAi={(diff, color) => startNewMatch('ai', gameConfig, color, diff)}
        onOpenFriendRoom={() => setFriendRoomOpen(true)}
        onStartMatchmaking={handleStartMatchmaking}
        onStartLocal={() => startNewMatch('local', gameConfig, 'white')}
      />

      <FriendRoomModal
        isOpen={friendRoomOpen}
        onClose={() => {
          setFriendRoomOpen(false);
          setPrefillJoinCode(null);
        }}
        currentUser={profile}
        gameConfig={gameConfig}
        currentRoomId={roomId}
        waitingForOpponent={waitingForFriend}
        prefillCode={prefillJoinCode}
        onRoomCreated={(id, state, color) => {
          recordedMatchKeyRef.current = null;
          setRoomId(id);
          setIsHost(true);
          setWaitingForFriend(true);
          setOpponentConnected(false);
          setOpponentName('Waiting...');
          setOpponentId(null);
          setPlayerColor(color);
          setFlipped(false);
          setGameState(state);
          setHistoryStack([]);
          setSelectedPos(null);
          setWhiteTimer(600);
          setBlackTimer(600);
          setGameOverOpen(false);
          setGameMode('friend');
          safeWsSend({ type: 'ATTACH_ROOM', roomId: id });
        }}
        onRoomJoined={(id, state, color, oppName) => {
          recordedMatchKeyRef.current = null;
          setRoomId(id);
          setIsHost(color === 'white');
          setWaitingForFriend(false);
          setOpponentConnected(true);
          setPlayerColor(color);
          setFlipped(color === 'black');
          setOpponentName(oppName);
          setGameState(state);
          setHistoryStack([]);
          setSelectedPos(null);
          setWhiteTimer(600);
          setBlackTimer(600);
          setGameOverOpen(false);
          setFriendRoomOpen(false);
          setPrefillJoinCode(null);
          setGameMode('friend');
          safeWsSend({ type: 'ATTACH_ROOM', roomId: id });
        }}
        onLeaveRoom={() => {
          setRoomId(null);
          setIsHost(false);
          setWaitingForFriend(false);
          setOpponentConnected(true);
          setOpponentId(null);
        }}
      />

      <TournamentModal
        isOpen={tournamentOpen}
        onClose={() => setTournamentOpen(false)}
        currentUser={profile}
        onEnterTournamentMatch={(tId, match) => {
          recordedMatchKeyRef.current = null;
          setTournamentOpen(false);
          setRoomId(null);
          setWaitingForFriend(false);
          setActiveTournamentMatch({ tournamentId: tId, match });
          const isPlayer1 = match.player1?.id === profile.id;
          const oppName = isPlayer1
            ? match.player2?.name || 'Grandmaster Rival'
            : match.player1?.name || 'Grandmaster Rival';
          setOpponentName(oppName);
          setPlayerColor(isPlayer1 ? 'white' : 'black');
          setFlipped(!isPlayer1);
          setGameMode('ai');
          setAiDifficulty('hard');
          setGameState(createNewGame(gameConfig));
          setHistoryStack([]);
          setSelectedPos(null);
          setWhiteTimer(300);
          setBlackTimer(300);
          setGameOverOpen(false);
        }}
      />

      <SpotifyPlayerModal
        isOpen={spotifyOpen}
        onClose={() => setSpotifyOpen(false)}
        currentRoomId={roomId}
        syncedTrack={currentSpotifyTrack}
        onShareToRoom={(track) => {
          setCurrentSpotifyTrack(track);
          if (roomId) {
            fetch(`/api/rooms/${roomId}/spotify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                spotifyUri: track.embedUrl,
                spotifyTitle: track.title,
                sharedBy: profile.displayName,
              }),
            }).catch(() => {});

            safeWsSend({
              type: 'SYNC_SPOTIFY',
              roomId,
              spotifyUri: track.embedUrl,
              spotifyTitle: track.title,
            });
          }
        }}
      />

      <MatchmakingModal
        isOpen={matchmakingOpen}
        queueSize={matchmakingQueueSize}
        openRoomsCount={openRoomsCount}
        onCancel={handleCancelMatchmaking}
        onSwitchToRooms={() => {
          handleCancelMatchmaking();
          setFriendRoomOpen(true);
        }}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
      />

      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />

      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={gameConfig}
        onUpdateConfig={(newCfg) => {
          setGameConfig((prev) => {
            const updated = { ...prev, ...newCfg };
            if (newCfg.startingLayout && newCfg.startingLayout !== prev.startingLayout) {
              setGameState(createNewGame(updated));
            }
            return updated;
          });
        }}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        notationType={notationType}
        onChangeNotation={setNotationType}
      />

      <GameOverModal
        isOpen={gameOverOpen}
        status={gameState.status}
        winner={gameState.winner}
        reason={gameState.statusReason}
        totalTurns={gameState.turnCount}
        playerColor={playerColor}
        onRematch={() => {
          if ((gameMode === 'friend' || gameMode === 'multiplayer') && roomId) {
            fetch(`/api/rooms/${roomId}/rematch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: profile.id }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data?.success && data.state) {
                  recordedMatchKeyRef.current = null;
                  setGameState(data.state);
                  setHistoryStack([]);
                  setSelectedPos(null);
                  setWhiteTimer(600);
                  setBlackTimer(600);
                  setGameOverOpen(false);
                  if (data.color) {
                    setPlayerColor(data.color);
                    setFlipped(data.color === 'black');
                  }
                  if (data.opponentName) setOpponentName(data.opponentName);
                }
              })
              .catch(() => {
                safeWsSend({ type: 'REMATCH_ACCEPT', roomId });
              });
          } else {
            startNewMatch(gameMode, gameConfig, playerColor, aiDifficulty);
          }
        }}
        onNewGame={() => {
          setGameOverOpen(false);
          setModeSelectOpen(true);
        }}
      />
    </div>
  );
}
