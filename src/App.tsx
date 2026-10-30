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

import {
  createNewGame,
  applyMove,
  getLegalMoves,
  executeInteractiveStep,
} from './game/engine';
import {
  GameConfig,
  GameState,
  Move,
  PieceColor,
  PlayerProfile,
  Position,
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
  const [waitingForFriend, setWaitingForFriend] = useState(false);

  // Modals
  const [modeSelectOpen, setModeSelectOpen] = useState(false);
  const [friendRoomOpen, setFriendRoomOpen] = useState(false);
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);

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

  // Initialize Telegram & User Profile
  useEffect(() => {
    initTelegramUI();
    const inTg = isTelegramWebApp();
    setIsTelegram(inTg);

    const initData = getTelegramInitData();
    const tgUser = getTelegramUser();
    if (initData || tgUser) {
      // Authenticate seamlessly with Telegram user name
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
      // Restore guest or create
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
      if (startParam.startsWith('join_') || startParam.length === 6) {
        const cleanCode = startParam.replace('join_', '').toUpperCase();
        setRoomId(cleanCode);
        setFriendRoomOpen(true);
      } else if (startParam === 'ai') {
        setModeSelectOpen(true);
      } else if (startParam === 'rules') {
        setRulesOpen(true);
      } else if (startParam === 'leaderboard') {
        setLeaderboardOpen(true);
      }
    }
  }, []);

  // Connect WebSocket for multiplayer / room synchronization
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
      socket.send(
        JSON.stringify({
          type: 'INIT_CLIENT',
          userId: profile.id,
          displayName: profile.displayName,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'ROOM_CREATED':
            setRoomId(msg.roomId);
            setIsHost(true);
            setWaitingForFriend(true);
            setPlayerColor('white');
            setFlipped(false);
            setGameState(msg.state);
            break;

          case 'ROOM_JOINED':
            setRoomId(msg.roomId);
            setIsHost(false);
            setWaitingForFriend(false);
            setPlayerColor('black');
            setFlipped(true);
            setOpponentName(msg.whiteName || 'Host');
            setGameState(msg.state);
            setFriendRoomOpen(false);
            setGameMode('friend');
            break;

          case 'OPPONENT_JOINED':
            setWaitingForFriend(false);
            setOpponentName(msg.opponentName || 'Challenger');
            setGameState(msg.state);
            setFriendRoomOpen(false);
            setGameMode('friend');
            break;

          case 'MATCH_FOUND':
            setMatchmakingOpen(false);
            setRoomId(msg.roomId);
            setPlayerColor(msg.color);
            setFlipped(msg.color === 'black');
            setOpponentName(msg.opponentName || 'Online Champion');
            setGameState(msg.state);
            setGameMode('multiplayer');
            break;

          case 'MOVE_APPLIED':
            setGameState(msg.state);
            if (msg.move?.capturedPositions?.length > 0) {
              sounds.playCapture();
            } else {
              sounds.playMove();
            }
            if (msg.move?.isPromotion) {
              sounds.playPromotion();
            }
            break;

          case 'GAME_OVER':
            setGameState((prev) => ({
              ...prev,
              status: msg.status,
              winner: msg.winner,
              statusReason: msg.reason,
            }));
            setGameOverOpen(true);
            break;

          case 'REMATCH_STARTED':
            setGameState(msg.state);
            setGameOverOpen(false);
            setPlayerColor((prev) => (prev === 'white' ? 'black' : 'white'));
            setFlipped((prev) => !prev);
            break;

          case 'PLAYER_DISCONNECTED':
            if (gameState.status === 'playing') {
              setGameState((prev) => ({
                ...prev,
                status: playerColor === 'white' ? 'white_won' : 'black_won',
                winner: playerColor,
                statusReason: `${msg.name} disconnected. Victory by forfeit!`,
              }));
              setGameOverOpen(true);
            }
            break;
        }
      } catch (err) {
        console.error('WebSocket receive error:', err);
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [profile.id, profile.displayName]);

  // Turn Timer Countdown
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    const interval = setInterval(() => {
      if (gameState.turn === 'white') {
        setWhiteTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState((curr) => ({
              ...curr,
              status: 'black_won',
              winner: 'black',
              statusReason: 'White ran out of time!',
            }));
            setGameOverOpen(true);
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState((curr) => ({
              ...curr,
              status: 'white_won',
              winner: 'white',
              statusReason: 'Black ran out of time!',
            }));
            setGameOverOpen(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, gameState.turn]);

  // AI Turn Handling
  useEffect(() => {
    if (gameMode !== 'ai') return;
    if (gameState.status !== 'playing') return;

    const isAiTurn = gameState.turn !== playerColor;
    if (!isAiTurn) return;

    let active = true;
    setIsAiThinking(true);

    getAiMoveAsync(gameState, aiDifficulty).then(({ move }) => {
      if (!active) return;
      setIsAiThinking(false);

      if (move) {
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
      }
    });

    return () => {
      active = false;
      setIsAiThinking(false);
    };
  }, [gameState, gameMode, playerColor, aiDifficulty]);

  // Handle Game End Record & Rewards
  const handleGameEnd = (finalState: GameState) => {
    setGameOverOpen(true);

    const whitePlayerName = gameMode === 'ai' ? (playerColor === 'white' ? profile.displayName : 'AI') : 'White';
    const blackPlayerName = gameMode === 'ai' ? (playerColor === 'black' ? profile.displayName : `AI (${aiDifficulty})`) : 'Black';

    fetch('/api/matches/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: gameMode,
        whitePlayer: whitePlayerName,
        blackPlayer: blackPlayerName,
        winner: finalState.winner,
        reason: finalState.statusReason,
        totalTurns: finalState.turnCount,
        difficulty: gameMode === 'ai' ? aiDifficulty : undefined,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        // Refresh local player profile
        fetch(`/api/profile/${profile.id}`)
          .then((r) => r.json())
          .then((updated) => {
            if (updated && updated.id) setProfile(updated);
          })
          .catch(() => {});
      })
      .catch(() => {});
  };

  // Human player executes a move or step
  const handleHumanStep = (from: Position, to: Position) => {
    if (gameState.status !== 'playing') return;

    // Check if it's the human's turn in online/AI modes
    if (gameMode === 'ai' && gameState.turn !== playerColor) return;
    if ((gameMode === 'friend' || gameMode === 'multiplayer') && gameState.turn !== playerColor) return;

    try {
      const { nextState, turnContinues } = executeInteractiveStep(gameState, from, to);

      setHistoryStack((prev) => [...prev, gameState]);
      setGameState(nextState);

      // Play sound
      const didCapture = Boolean(nextState.activeCapturePiece || nextState.pendingCapturedPositions.length > 0);
      if (didCapture) {
        sounds.playCapture();
        triggerHaptic('medium');
      } else {
        sounds.playMove();
        triggerHaptic('light');
      }

      if (turnContinues) {
        // Multi-capture continuation: keep the active piece selected
        setSelectedPos(to);
      } else {
        setSelectedPos(null);

        // If online multiplayer, synchronize authoritative move with server
        if ((gameMode === 'friend' || gameMode === 'multiplayer') && wsRef.current) {
          const executedMove = nextState.moveHistory[nextState.moveHistory.length - 1];
          wsRef.current.send(
            JSON.stringify({
              type: 'PLAY_MOVE',
              move: executedMove,
            })
          );
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

  // Start new match
  const startNewMatch = (
    mode: GameMode,
    newConfig: Partial<GameConfig> = {},
    color: PieceColor = 'white',
    difficulty: AiDifficulty = 'medium'
  ) => {
    const mergedConfig = { ...gameConfig, ...newConfig };
    const newGame = createNewGame(mergedConfig);

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
      // In AI mode, undo twice to step back to before human move
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
    const resigning = gameState.turn;
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
        onOpenProfile={() => setProfileOpen(true)}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        isOnline={wsConnected}
        isTelegram={isTelegram}
        boardSize={gameState.config.boardSize}
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
          disabled={isAiThinking || gameState.status !== 'playing'}
        />
      </main>

      {/* Modals */}
      <ModeSelectModal
        isOpen={modeSelectOpen}
        onClose={() => setModeSelectOpen(false)}
        onSelectAi={(diff, color) => startNewMatch('ai', gameConfig, color, diff)}
        onOpenFriendRoom={() => setFriendRoomOpen(true)}
        onStartMatchmaking={() => {
          setMatchmakingOpen(true);
          wsRef.current?.send(JSON.stringify({ type: 'FIND_MATCH' }));
        }}
        onStartLocal={() => startNewMatch('local', gameConfig, 'white')}
      />

      <FriendRoomModal
        isOpen={friendRoomOpen}
        onClose={() => setFriendRoomOpen(false)}
        roomId={roomId}
        isHost={isHost}
        waitingForOpponent={waitingForFriend}
        onCreateRoom={() => {
          wsRef.current?.send(
            JSON.stringify({
              type: 'CREATE_ROOM',
              config: gameConfig,
            })
          );
        }}
        onJoinRoom={(code) => {
          wsRef.current?.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              roomId: code,
            })
          );
        }}
      />

      <MatchmakingModal
        isOpen={matchmakingOpen}
        onCancel={() => {
          wsRef.current?.send(JSON.stringify({ type: 'CANCEL_MATCHMAKING' }));
          setMatchmakingOpen(false);
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
            // If changing starting layout, restart board
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
          if (gameMode === 'friend' && wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'REMATCH_ACCEPT' }));
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
