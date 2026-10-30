/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  createNewGame,
  applyMove,
  getLegalMoves,
} from './src/game/engine.ts';
import type { GameConfig, GameState, Move, PieceColor, PlayerProfile } from './src/game/types.ts';

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? parseInt(process.env.PORT || '8080', 10) : 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

const app = express();
app.use(express.json());

const server = http.createServer(app);

// Simple file-based persistence for profiles, matches, and leaderboard
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'dama_arena_data.json');

interface StoredData {
  users: Record<string, PlayerProfile>;
  matches: Array<{
    id: string;
    mode: 'ai' | 'friend' | 'multiplayer' | 'local';
    whitePlayer: string;
    blackPlayer: string;
    winner?: PieceColor;
    reason?: string;
    totalTurns: number;
    playedAt: number;
    difficulty?: string;
  }>;
}

function loadData(): StoredData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error loading data file, initializing fresh store:', err);
  }

  // Initial seed with sample leaderboard champions
  const initial: StoredData = {
    users: {
      'guest_dama_king': {
        id: 'guest_dama_king',
        username: 'Abebe_Bikila',
        displayName: 'Abebe B. (Dama Master)',
        avatarSeed: 'Abebe',
        elo: 1850,
        matchesPlayed: 48,
        wins: 39,
        losses: 7,
        draws: 2,
        winStreak: 6,
        bestStreak: 12,
        level: 14,
        xp: 4200,
        createdAt: Date.now() - 86400000 * 30,
        badges: ['Grandmaster', '10-Streak', 'Tactician', 'Dama Pioneer'],
      },
      'guest_haile_g': {
        id: 'guest_haile_g',
        username: 'Haile_G',
        displayName: 'Haile Gebrselassie',
        avatarSeed: 'Haile',
        elo: 1720,
        matchesPlayed: 32,
        wins: 24,
        losses: 6,
        draws: 2,
        winStreak: 3,
        bestStreak: 8,
        level: 10,
        xp: 2850,
        createdAt: Date.now() - 86400000 * 20,
        badges: ['Endurance', 'Sharpshooter'],
      },
      'guest_selam_t': {
        id: 'guest_selam_t',
        username: 'Selam_T',
        displayName: 'Selamawit T.',
        avatarSeed: 'Selam',
        elo: 1640,
        matchesPlayed: 25,
        wins: 18,
        losses: 5,
        draws: 2,
        winStreak: 4,
        bestStreak: 7,
        level: 8,
        xp: 2100,
        createdAt: Date.now() - 86400000 * 15,
        badges: ['Rising Star', 'Strategist'],
      },
    },
    matches: [],
  };
  saveData(initial);
  return initial;
}

function saveData(data: StoredData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data store:', err);
  }
}

let store = loadData();

// Helper to get or create guest profile
function getOrCreateUser(userId: string, username?: string): PlayerProfile {
  if (store.users[userId]) {
    return store.users[userId];
  }
  const name = username || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
  const newUser: PlayerProfile = {
    id: userId,
    username: name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
    displayName: name,
    avatarSeed: name,
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
  store.users[userId] = newUser;
  saveData(store);
  return newUser;
}

// Telegram initData verification per official Telegram specification
function verifyTelegramInitData(initDataStr: string, botToken: string): { isValid: boolean; userData?: any } {
  if (!botToken || !initDataStr) {
    return { isValid: false };
  }
  try {
    const params = new URLSearchParams(initDataStr);
    const hash = params.get('hash');
    if (!hash) return { isValid: false };

    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');

    // Secret key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash === hash) {
      const userParam = params.get('user');
      const userData = userParam ? JSON.parse(userParam) : undefined;
      return { isValid: true, userData };
    }
  } catch (err) {
    console.error('Error verifying Telegram initData:', err);
  }
  return { isValid: false };
}

// REST API ROUTES
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), uptime: process.uptime() });
});

// Profile endpoints
app.post('/api/auth/guest', (req, res) => {
  const { id, username } = req.body;
  const userId = id || `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const profile = getOrCreateUser(userId, username);
  res.json({ success: true, profile });
});

app.post('/api/telegram/validate-session', (req, res) => {
  const { initData, unsafeUser } = req.body;
  let userData = unsafeUser;

  if (TELEGRAM_BOT_TOKEN && initData) {
    const verified = verifyTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
    if (verified.isValid && verified.userData) {
      userData = verified.userData;
    }
  } else if (initData) {
    try {
      const params = new URLSearchParams(initData);
      const userParam = params.get('user');
      if (userParam) {
        userData = JSON.parse(userParam);
      }
    } catch (e) {
      // ignore
    }
  }

  if (userData && userData.id) {
    const userId = `tg_${userData.id}`;
    const displayName =
      [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
      userData.username ||
      'Telegram Player';
    const profile = getOrCreateUser(userId, displayName);
    return res.json({ success: true, profile, telegramUser: userData });
  }

  return res.status(400).json({ success: false, error: 'No Telegram user information found' });
});

app.get('/api/profile/:id', (req, res) => {
  const profile = store.users[req.params.id];
  if (!profile) return res.status(404).json({ error: 'User not found' });
  res.json(profile);
});

app.get('/api/leaderboard', (req, res) => {
  const allUsers = Object.values(store.users);
  const sorted = allUsers.sort((a, b) => b.elo - a.elo).slice(0, 50);
  res.json(sorted);
});

app.get('/api/matches', (req, res) => {
  const recent = store.matches.slice(-30).reverse();
  res.json(recent);
});

app.post('/api/matches/record', (req, res) => {
  const { mode, whitePlayer, blackPlayer, winner, reason, totalTurns, difficulty } = req.body;
  const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const matchRecord = {
    id: matchId,
    mode: mode || 'ai',
    whitePlayer: whitePlayer || 'White',
    blackPlayer: blackPlayer || 'Black',
    winner,
    reason,
    totalTurns: totalTurns || 1,
    playedAt: Date.now(),
    difficulty,
  };

  store.matches.push(matchRecord);

  // Update player profile stats if recorded for registered user
  const updatePlayerStats = (playerId: string, isWinner: boolean, isDraw: boolean) => {
    const user = store.users[playerId];
    if (user) {
      user.matchesPlayed++;
      if (isDraw) {
        user.draws++;
        user.xp += 25;
      } else if (isWinner) {
        user.wins++;
        user.winStreak++;
        if (user.winStreak > user.bestStreak) user.bestStreak = user.winStreak;
        user.elo += 20;
        user.xp += 75;
      } else {
        user.losses++;
        user.winStreak = 0;
        user.elo = Math.max(100, user.elo - 15);
        user.xp += 15;
      }

      // Level calculation: 1 level per 250 XP
      user.level = Math.floor(user.xp / 250) + 1;

      // Badge triggers
      if (user.wins >= 5 && !user.badges.includes('Veteran')) user.badges.push('Veteran');
      if (user.winStreak >= 5 && !user.badges.includes('Streak Master')) user.badges.push('Streak Master');
      if (user.level >= 5 && !user.badges.includes('Tactician')) user.badges.push('Tactician');
    }
  };

  if (winner) {
    if (winner === 'white') {
      updatePlayerStats(whitePlayer, true, false);
      updatePlayerStats(blackPlayer, false, false);
    } else {
      updatePlayerStats(whitePlayer, false, false);
      updatePlayerStats(blackPlayer, true, false);
    }
  } else {
    updatePlayerStats(whitePlayer, false, true);
    updatePlayerStats(blackPlayer, false, true);
  }

  saveData(store);
  res.json({ success: true, matchId });
});

// TELEGRAM BOT WEBHOOK SIMULATOR & EXPORT INFO
app.get('/api/telegram/bot-info', (req, res) => {
  res.json({
    status: 'configured',
    hasToken: Boolean(TELEGRAM_BOT_TOKEN),
    commands: [
      { command: 'start', description: 'Launch Dama Arena Web App' },
      { command: 'play', description: 'Start an Ethiopian Dama game' },
      { command: 'rules', description: 'Learn confirmed Ethiopian Dama rules' },
      { command: 'profile', description: 'Check your rank and stats' },
      { command: 'leaderboard', description: 'View top Dama players' },
    ],
  });
});

// MULTIPLAYER ROOM & WEBSOCKET ENGINE
interface PlayerClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  color?: PieceColor;
}

interface MatchRoom {
  id: string;
  createdAt: number;
  config: GameConfig;
  white?: PlayerClient;
  black?: PlayerClient;
  spectators: PlayerClient[];
  state: GameState;
  isPrivate: boolean;
  whiteTimerMs: number;
  blackTimerMs: number;
  lastTimerTick: number;
}

const rooms = new Map<string, MatchRoom>();
let matchmakingQueue: PlayerClient[] = [];

const wss = new WebSocketServer({ noServer: true });

function broadcastToRoom(room: MatchRoom, message: object) {
  const json = JSON.stringify(message);
  if (room.white?.ws.readyState === WebSocket.OPEN) room.white.ws.send(json);
  if (room.black?.ws.readyState === WebSocket.OPEN) room.black.ws.send(json);
  for (const s of room.spectators) {
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(json);
  }
}

wss.on('connection', (ws: WebSocket) => {
  let clientUser: PlayerClient | null = null;
  let currentRoomId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'INIT_CLIENT': {
          clientUser = {
            ws,
            userId: msg.userId || `user_${Math.floor(Math.random() * 100000)}`,
            displayName: msg.displayName || 'Player',
          };
          ws.send(JSON.stringify({ type: 'INIT_ACK', userId: clientUser.userId }));
          break;
        }

        case 'CREATE_ROOM': {
          if (!clientUser) return;
          const roomId = msg.roomId || Math.random().toString(36).substring(2, 8).toUpperCase();
          const config = msg.config || {};
          const state = createNewGame(config);

          const room: MatchRoom = {
            id: roomId,
            createdAt: Date.now(),
            config: state.config,
            white: { ...clientUser, color: 'white' },
            spectators: [],
            state,
            isPrivate: Boolean(msg.isPrivate),
            whiteTimerMs: (msg.timerMinutes || 10) * 60 * 1000,
            blackTimerMs: (msg.timerMinutes || 10) * 60 * 1000,
            lastTimerTick: Date.now(),
          };

          rooms.set(roomId, room);
          currentRoomId = roomId;

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomId,
              color: 'white',
              state: room.state,
            })
          );
          break;
        }

        case 'JOIN_ROOM': {
          if (!clientUser) return;
          const roomId = (msg.roomId || '').toUpperCase();
          const room = rooms.get(roomId);

          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
            return;
          }

          currentRoomId = roomId;

          if (!room.black) {
            room.black = { ...clientUser, color: 'black' };
            ws.send(
              JSON.stringify({
                type: 'ROOM_JOINED',
                roomId,
                color: 'black',
                whiteName: room.white?.displayName,
                state: room.state,
              })
            );

            // Inform white player that opponent joined
            if (room.white?.ws.readyState === WebSocket.OPEN) {
              room.white.ws.send(
                JSON.stringify({
                  type: 'OPPONENT_JOINED',
                  opponentName: clientUser.displayName,
                  state: room.state,
                })
              );
            }
          } else {
            // Join as spectator
            room.spectators.push(clientUser);
            ws.send(
              JSON.stringify({
                type: 'ROOM_SPECTATING',
                roomId,
                state: room.state,
                whiteName: room.white?.displayName,
                blackName: room.black?.displayName,
              })
            );
          }
          break;
        }

        case 'FIND_MATCH': {
          if (!clientUser) return;
          // Filter stale matchmaking queue
          matchmakingQueue = matchmakingQueue.filter(
            (p) => p.ws.readyState === WebSocket.OPEN && p.userId !== clientUser!.userId
          );

          if (matchmakingQueue.length > 0) {
            const opponent = matchmakingQueue.shift()!;
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const state = createNewGame();

            const isClientWhite = Math.random() > 0.5;
            const whitePlayer = isClientWhite ? { ...clientUser, color: 'white' as PieceColor } : { ...opponent, color: 'white' as PieceColor };
            const blackPlayer = isClientWhite ? { ...opponent, color: 'black' as PieceColor } : { ...clientUser, color: 'black' as PieceColor };

            const room: MatchRoom = {
              id: roomId,
              createdAt: Date.now(),
              config: state.config,
              white: whitePlayer,
              black: blackPlayer,
              spectators: [],
              state,
              isPrivate: false,
              whiteTimerMs: 10 * 60 * 1000,
              blackTimerMs: 10 * 60 * 1000,
              lastTimerTick: Date.now(),
            };

            rooms.set(roomId, room);

            whitePlayer.ws.send(
              JSON.stringify({
                type: 'MATCH_FOUND',
                roomId,
                color: 'white',
                opponentName: blackPlayer.displayName,
                state: room.state,
              })
            );

            blackPlayer.ws.send(
              JSON.stringify({
                type: 'MATCH_FOUND',
                roomId,
                color: 'black',
                opponentName: whitePlayer.displayName,
                state: room.state,
              })
            );
          } else {
            matchmakingQueue.push(clientUser);
            ws.send(JSON.stringify({ type: 'MATCHMAKING_WAITING' }));
          }
          break;
        }

        case 'CANCEL_MATCHMAKING': {
          if (!clientUser) return;
          matchmakingQueue = matchmakingQueue.filter((p) => p.userId !== clientUser!.userId);
          ws.send(JSON.stringify({ type: 'MATCHMAKING_CANCELLED' }));
          break;
        }

        case 'PLAY_MOVE': {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const movingPlayerColor = room.white?.userId === clientUser.userId ? 'white' : room.black?.userId === clientUser.userId ? 'black' : null;

          if (!movingPlayerColor || room.state.turn !== movingPlayerColor) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn' }));
            return;
          }

          const move: Move = msg.move;
          if (!move) return;

          // SERVER-SIDE VALIDATION: verify move is strictly in legal moves!
          const legalMoves = getLegalMoves(room.state);
          const isLegal = legalMoves.some(
            (m) =>
              m.from.r === move.from.r &&
              m.from.c === move.from.c &&
              m.to.r === move.to.r &&
              m.to.c === move.to.c &&
              m.capturedPositions.length === move.capturedPositions.length
          );

          if (!isLegal) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Illegal move rejected by server engine' }));
            return;
          }

          // Apply move using authoritative engine
          const nextState = applyMove(room.state, move);
          room.state = nextState;

          broadcastToRoom(room, {
            type: 'MOVE_APPLIED',
            move,
            state: nextState,
          });

          // Check for game end
          if (nextState.status !== 'playing') {
            broadcastToRoom(room, {
              type: 'GAME_OVER',
              status: nextState.status,
              winner: nextState.winner,
              reason: nextState.statusReason,
            });
          }
          break;
        }

        case 'SEND_CHAT': {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: 'CHAT_MESSAGE',
            sender: clientUser.displayName,
            senderId: clientUser.userId,
            text: String(msg.text || '').substring(0, 160),
            timestamp: Date.now(),
          });
          break;
        }

        case 'REMATCH_OFFER': {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: 'REMATCH_OFFERED',
            fromUser: clientUser.displayName,
          });
          break;
        }

        case 'REMATCH_ACCEPT': {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          // Swap sides for rematch
          const oldWhite = room.white;
          const oldBlack = room.black;
          if (oldWhite && oldBlack) {
            room.white = { ...oldBlack, color: 'white' };
            room.black = { ...oldWhite, color: 'black' };
          }
          room.state = createNewGame(room.config);

          broadcastToRoom(room, {
            type: 'REMATCH_STARTED',
            state: room.state,
            whiteName: room.white?.displayName,
            blackName: room.black?.displayName,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (clientUser) {
      matchmakingQueue = matchmakingQueue.filter((p) => p.userId !== clientUser!.userId);
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          broadcastToRoom(room, {
            type: 'PLAYER_DISCONNECTED',
            userId: clientUser.userId,
            name: clientUser.displayName,
          });
        }
      }
    }
  });
});

// Upgrade HTTP server to WebSocket on /ws
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// TELEGRAM BOT AUTOMATION & POLLING
const APP_URL = process.env.PUBLIC_APP_URL || 'https://ais-pre-37d6qzhtee3lmd2myppu6s-865179148767.europe-west2.run.app';

function buildTelegramKeyboard(url: string = APP_URL) {
  return {
    inline_keyboard: [
      [
        {
          text: '⚔️ Play Dama Arena 🇪🇹',
          web_app: { url: `${url}?tgWebAppStartParam=play` },
        },
      ],
      [
        {
          text: '🤖 Play vs AI',
          web_app: { url: `${url}?mode=ai` },
        },
        {
          text: '👥 Play with Friend',
          web_app: { url: `${url}?mode=friend` },
        },
      ],
      [
        {
          text: '🌐 Online Multiplayer',
          web_app: { url: `${url}?mode=multiplayer` },
        },
        {
          text: '🏆 Leaderboard',
          web_app: { url: `${url}?mode=leaderboard` },
        },
      ],
      [
        {
          text: '👤 My Profile',
          web_app: { url: `${url}?mode=profile` },
        },
        {
          text: '📜 Game Rules',
          web_app: { url: `${url}?mode=rules` },
        },
      ],
    ],
  };
}

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: object) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}

async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from?.first_name || 'Champion';

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const deepParam = parts.length > 1 ? parts[1] : '';
    const launchUrl = deepParam ? `${APP_URL}?tgWebAppStartParam=${deepParam}` : APP_URL;

    const welcomeMsg = `<b>እንኳን ወደ DAMA ARENA በደህና መጡ! 🇪🇹👑</b>\n<b>Welcome to DAMA ARENA, ${userName}!</b>\n\nPlay authentic Ethiopian Dama, challenge tactical AI, and compete with friends in real-time matches.\n\nTap below to launch the arena!`;

    const keyboard = deepParam
      ? {
          inline_keyboard: [
            [{ text: '⚡ Join Room Now', web_app: { url: launchUrl } }],
            ...buildTelegramKeyboard(APP_URL).inline_keyboard,
          ],
        }
      : buildTelegramKeyboard(APP_URL);

    await sendTelegramMessage(chatId, welcomeMsg, keyboard);
  } else if (text === '/rules') {
    const rulesMsg = `<b>የኢትዮጵያ ዳማ ህጎች (Ethiopian Dama Rules):</b>\n\n• <b>10x10 Board:</b> Played on dark squares.\n• <b>Ordinary Pieces:</b> Move 1 square diagonally forward OR backward.\n• <b>Captures:</b> Jump diagonally forward or backward over adjacent enemy.\n• <b>Mandatory Captures:</b> Any available capture must be taken. Multi-captures are mandatory.\n• <b>Free Choice of Routes:</b> Max captures is NOT mandatory; choose any legal route!\n• <b>Immediate Promotion:</b> Reaching farthest row promotes immediately (even mid-sequence) and continues as King!\n• <b>Flying Kings:</b> Long-range movement and capture over diagonals.`;
    await sendTelegramMessage(chatId, rulesMsg, buildTelegramKeyboard(APP_URL));
  } else if (text === '/play') {
    await sendTelegramMessage(chatId, `⚔️ <b>ጨዋታ ለመጀመር ዝግጁ ኖት?</b>\nReady for battle? Tap below to jump straight into a match!`, buildTelegramKeyboard(APP_URL));
  } else if (text === '/profile') {
    await sendTelegramMessage(chatId, `👤 View your ELO rating, level, badges, and win streak inside the app:`, buildTelegramKeyboard(APP_URL));
  } else if (text === '/leaderboard') {
    await sendTelegramMessage(chatId, `🏆 See where you rank against the top Ethiopian Dama grandmasters:`, buildTelegramKeyboard(APP_URL));
  } else if (text === '/help') {
    const helpMsg = `<b>Dama Arena Commands:</b>\n/start - Open main menu & game\n/play - Start a match\n/rules - Ethiopian Dama official rules\n/profile - Check your profile & stats\n/leaderboard - Top ranked players\n/help - Show this guide`;
    await sendTelegramMessage(chatId, helpMsg, buildTelegramKeyboard(APP_URL));
  }
}

// Webhook endpoint
app.post('/api/telegram/webhook', (req, res) => {
  handleTelegramUpdate(req.body).catch((e) => console.error(e));
  res.json({ ok: true });
});

// Configure bot metadata with Telegram and start polling
async function initTelegramBotService() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'MY_TELEGRAM_BOT_TOKEN') {
    console.log('Telegram bot service: No TELEGRAM_BOT_TOKEN configured.');
    return;
  }

  try {
    // 1. Configure Bot Menu Button
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '⚔️ Play Dama',
          web_app: { url: APP_URL },
        },
      }),
    });

    // 2. Configure Bot Commands
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'play', description: '⚔️ Launch Dama Arena' },
          { command: 'start', description: '👑 Open Main Menu & Play' },
          { command: 'rules', description: '📜 Ethiopian Dama Rules' },
          { command: 'leaderboard', description: '🏆 Global Rankings' },
          { command: 'profile', description: '👤 My Profile & Stats' },
          { command: 'help', description: '❓ Help and Game Guide' },
        ],
      }),
    });

    console.log('Telegram bot menu button and commands verified.');

    // 3. Start Long Polling
    let offset = 0;
    const pollUpdates = async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=25`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            await handleTelegramUpdate(update);
          }
        }
      } catch (err) {
        // quiet network retry
      }
      setTimeout(pollUpdates, 1000);
    };

    pollUpdates();
    console.log('Telegram bot polling active for @Letsdamabot');
  } catch (err) {
    console.error('Error starting Telegram bot service:', err);
  }
}

// Launch Vite in middleware mode during development or serve dist in production
async function bootstrap() {
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Dama Arena Server listening on port ${PORT} (prod=${isProd})`);
    initTelegramBotService();
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

