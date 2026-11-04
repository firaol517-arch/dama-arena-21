/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  createNewGame,
  applyMove,
  getLegalMoves,
} from './src/game/engine.ts';
import type { GameConfig, GameState, Move, PieceColor, PlayerProfile, Tournament, TournamentMatch } from './src/game/types.ts';

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000; // In AI Studio containers, NGINX always listens on 8080 and reverse proxies to port 3000
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

const app = express();
app.use(express.json());

const server = http.createServer(app);

// Simple file-based persistence for profiles, matches, and leaderboard
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'dama_arena_data.json');

const SEED_TOURNAMENTS: Tournament[] = [
  {
    id: 'tourn_addis_gp_2026',
    title: 'የአዲስ አበባ ግራንድ ፕሪክስ (Addis Ababa Grand Prix)',
    description: 'የ 8 ምርጥ ተጫዋቾች ባለ 4 (8x8) የዳማ የጥሎ ማለፍ ውድድር። አሸናፊው 5,000 ብር እና 500 Dama Gems ይሸለማል!',
    organizer: {
      id: 'org_ethiodama',
      name: 'የኢትዮጵያ ዳማ ፌዴሬሽን',
      avatarSeed: 'Federation',
      role: 'ዋና አዘጋጅ / Organizer',
    },
    maxPlayers: 8,
    boardSize: 8,
    prizeXp: 5000,
    status: 'registering',
    registeredPlayers: [
      { id: 'guest_dama_king', name: 'Abebe B. (Dama Master)', elo: 1850, wins: 39, points: 12, avatarSeed: 'Abebe' },
      { id: 'guest_haile_g', name: 'Haile Gebrselassie', elo: 1720, wins: 24, points: 9, avatarSeed: 'Haile' },
      { id: 'guest_selam_t', name: 'Selamawit T.', elo: 1640, wins: 18, points: 6, avatarSeed: 'Selam' },
      { id: 'guest_dawit_k', name: 'Dawit Kebede', elo: 1580, wins: 15, points: 4, avatarSeed: 'Dawit' },
      { id: 'guest_almaz_a', name: 'Almaz Ayana', elo: 1610, wins: 17, points: 5, avatarSeed: 'Almaz' },
    ],
    matches: [
      {
        id: 'match_qf_1',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 1 (Quarterfinal 1)',
        player1: { id: 'guest_dama_king', name: 'Abebe B.', elo: 1850 },
        player2: { id: 'guest_dawit_k', name: 'Dawit K.', elo: 1580 },
        status: 'upcoming',
      },
      {
        id: 'match_qf_2',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 2 (Quarterfinal 2)',
        player1: { id: 'guest_haile_g', name: 'Haile G.', elo: 1720 },
        player2: { id: 'guest_almaz_a', name: 'Almaz A.', elo: 1610 },
        status: 'upcoming',
      },
      {
        id: 'match_qf_3',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 3 (Quarterfinal 3)',
        player1: { id: 'guest_selam_t', name: 'Selamawit T.', elo: 1640 },
        status: 'upcoming',
      },
      {
        id: 'match_qf_4',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 4 (Quarterfinal 4)',
        status: 'upcoming',
      },
    ],
    createdAt: Date.now() - 3600000 * 2,
  },
  {
    id: 'tourn_championship_2026',
    title: 'የኢትዮጵያ ዳማ ብሔራዊ ሻምፒዮና (National Championship)',
    description: 'የ 16 ተጫዋቾች ታላቅ የዳማ ዋንጫ ውድድር። አሸናፊው 10,000 ብር እና የክብር ወርቅ ዋንጫ ይቀበላል!',
    organizer: {
      id: 'org_championship',
      name: 'Dama Arena Premier',
      avatarSeed: 'DamaArena',
      role: 'አስተባባሪ / Coordinator',
    },
    maxPlayers: 16,
    boardSize: 8,
    prizeXp: 10000,
    status: 'registering',
    registeredPlayers: [
      { id: 'guest_dama_king', name: 'Abebe B. (Dama Master)', elo: 1850, wins: 39, points: 15, avatarSeed: 'Abebe' },
      { id: 'guest_haile_g', name: 'Haile Gebrselassie', elo: 1720, wins: 24, points: 12, avatarSeed: 'Haile' },
      { id: 'guest_selam_t', name: 'Selamawit T.', elo: 1640, wins: 18, points: 10, avatarSeed: 'Selam' },
      { id: 'p_yared', name: 'Yared Tadesse', elo: 1590, wins: 14, points: 7, avatarSeed: 'Yared' },
      { id: 'p_solomon', name: 'Solomon Bogale', elo: 1670, wins: 21, points: 11, avatarSeed: 'Solomon' },
      { id: 'p_aster', name: 'Aster Aweke', elo: 1530, wins: 11, points: 5, avatarSeed: 'Aster' },
      { id: 'p_bereket', name: 'Bereket Mengistu', elo: 1600, wins: 16, points: 8, avatarSeed: 'Bereket' },
    ],
    matches: [
      {
        id: 'champ_qf_1',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 1 (Quarterfinal 1)',
        player1: { id: 'p_yared', name: 'Yared Tadesse', elo: 1590 },
        player2: { id: 'p_solomon', name: 'Solomon Bogale', elo: 1670 },
        status: 'upcoming',
      },
      {
        id: 'champ_qf_2',
        round: 1,
        roundName: 'ሩብ ፍጻሜ 2 (Quarterfinal 2)',
        player1: { id: 'p_bereket', name: 'Bereket Mengistu', elo: 1600 },
        player2: { id: 'p_aster', name: 'Aster Aweke', elo: 1530 },
        status: 'upcoming',
      },
      {
        id: 'champ_sf_1',
        round: 2,
        roundName: 'ግማሽ ፍጻሜ (Semifinal)',
        player1: { id: 'guest_dama_king', name: 'Abebe B. (1850 ELO)', elo: 1850 },
        status: 'upcoming',
      },
      {
        id: 'champ_final',
        round: 3,
        roundName: 'ብሔራዊ ዋንጫ ፍጻሜ (Championship Final)',
        status: 'upcoming',
      },
    ],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'tourn_blitz_cup_daily',
    title: 'የሳምንቱ ፈጣን ዋንጫ (Weekly Blitz Cup)',
    description: 'የ 4 ተጫዋቾች ፈጣን የግማሽ ፍጻሜ እና የፍጻሜ ግጥሚያ። የሽልማት ፈንድ 2,500 ብር!',
    organizer: {
      id: 'org_blitz',
      name: 'Blitz League Addis',
      avatarSeed: 'Blitz',
      role: 'ውድድር መሪ / Blitz Host',
    },
    maxPlayers: 8,
    boardSize: 8,
    prizeXp: 2500,
    status: 'live',
    registeredPlayers: [
      { id: 'guest_dama_king', name: 'Abebe B.', elo: 1850, wins: 39, points: 6, avatarSeed: 'Abebe' },
      { id: 'guest_haile_g', name: 'Haile G.', elo: 1720, wins: 24, points: 6, avatarSeed: 'Haile' },
      { id: 'guest_selam_t', name: 'Selamawit T.', elo: 1640, wins: 18, points: 3, avatarSeed: 'Selam' },
      { id: 'guest_dawit_k', name: 'Dawit K.', elo: 1580, wins: 15, points: 3, avatarSeed: 'Dawit' },
    ],
    matches: [
      {
        id: 'blitz_sf_1',
        round: 1,
        roundName: 'ግማሽ ፍጻሜ 1 (Semifinal 1)',
        player1: { id: 'guest_dama_king', name: 'Abebe B.', elo: 1850 },
        player2: { id: 'guest_dawit_k', name: 'Dawit K.', elo: 1580 },
        winnerId: 'guest_dama_king',
        status: 'finished',
      },
      {
        id: 'blitz_sf_2',
        round: 1,
        roundName: 'ግማሽ ፍጻሜ 2 (Semifinal 2)',
        player1: { id: 'guest_haile_g', name: 'Haile G.', elo: 1720 },
        player2: { id: 'guest_selam_t', name: 'Selamawit T.', elo: 1640 },
        status: 'ongoing',
      },
      {
        id: 'blitz_final',
        round: 2,
        roundName: 'ዋንጫ ፍጻሜ (Grand Final)',
        player1: { id: 'guest_dama_king', name: 'Abebe B.', elo: 1850 },
        status: 'upcoming',
      },
    ],
    createdAt: Date.now() - 1800000,
  },
];

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
  tournaments: Tournament[];
}

function loadData(): StoredData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.tournaments || parsed.tournaments.length === 0) {
        parsed.tournaments = SEED_TOURNAMENTS;
        saveData(parsed);
      }
      return parsed;
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
    tournaments: SEED_TOURNAMENTS,
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

// --- REAL TOURNAMENTS API ---
app.get('/api/tournaments', (req, res) => {
  res.json(store.tournaments || SEED_TOURNAMENTS);
});

app.post('/api/tournaments/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId, displayName, elo } = req.body;
  if (!store.tournaments) store.tournaments = [...SEED_TOURNAMENTS];
  const tournament = store.tournaments.find((t) => t.id === id);
  if (!tournament) return res.status(404).json({ error: 'ውድድሩ አልተገኘም (Tournament not found)' });

  const alreadyJoined = tournament.registeredPlayers.some((p) => p.id === userId);
  if (alreadyJoined) {
    return res.json({ success: true, message: 'ቀድመው ተመዝግበዋል (Already registered)', tournament });
  }

  if (tournament.registeredPlayers.length >= tournament.maxPlayers) {
    return res.status(400).json({ error: 'ውድድሩ ሙሉ ነው (Tournament is full)' });
  }

  const newPlayer = {
    id: userId,
    name: displayName || 'Warrior',
    elo: elo || 1200,
    wins: 0,
    points: 0,
    avatarSeed: displayName || 'User',
  };
  tournament.registeredPlayers.push(newPlayer);

  // Assign to empty bracket match slot if available
  for (const m of tournament.matches) {
    if (!m.player1) {
      m.player1 = { id: userId, name: newPlayer.name, elo: newPlayer.elo };
      break;
    } else if (!m.player2 && m.player1.id !== userId) {
      m.player2 = { id: userId, name: newPlayer.name, elo: newPlayer.elo };
      break;
    }
  }

  saveData(store);
  res.json({ success: true, message: 'በውድድሩ ላይ በተሳካ ሁኔታ ተመዝግበዋል!', tournament });
});

// --- BULLETPROOF MULTIPLAYER ROOMS REST API ---
app.get('/api/rooms', (req, res) => {
  const openRooms: any[] = [];
  rooms.forEach((r) => {
    if (!r.isPrivate && !r.black && r.state.status === 'playing') {
      openRooms.push({
        id: r.id,
        hostName: r.white?.displayName || 'Dama Host',
        hostId: r.white?.userId,
        boardSize: r.config.boardSize,
        createdAt: r.createdAt,
        timerMinutes: Math.round(r.whiteTimerMs / 60000),
      });
    }
  });
  res.json(openRooms.reverse());
});

app.post('/api/rooms/create', (req, res) => {
  const { userId, displayName, config, isPrivate, timerMinutes } = req.body;
  const roomId = 'DM' + Math.floor(1000 + Math.random() * 9000);
  const state = createNewGame(config || {});

  const room: MatchRoom = {
    id: roomId,
    createdAt: Date.now(),
    config: state.config,
    white: { userId: userId || 'host', displayName: displayName || 'Host', color: 'white' },
    spectators: [],
    state,
    isPrivate: Boolean(isPrivate),
    whiteTimerMs: (timerMinutes || 10) * 60 * 1000,
    blackTimerMs: (timerMinutes || 10) * 60 * 1000,
    lastTimerTick: Date.now(),
  };

  rooms.set(roomId, room);
  res.json({ success: true, roomId, state, color: 'white' });
});

app.post('/api/rooms/join', (req, res) => {
  const { roomId, userId, displayName } = req.body;
  const cleanCode = String(roomId || '').trim().toUpperCase();
  const room = rooms.get(cleanCode);

  if (!room) {
    return res.status(404).json({ success: false, error: 'የተሳሳተ ኮድ፤ ክፍሉ አልተገኘም (Room code not found)' });
  }

  if (room.black && room.black.userId !== userId) {
    return res.status(400).json({ success: false, error: 'ክፍሉ ሙሉ ነው፤ ሌላ ተጫዋች ገብቷል (Room is already full)' });
  }

  if (!room.black) {
    room.black = { userId, displayName: displayName || 'Challenger', color: 'black' };
    broadcastToRoom(room, {
      type: 'OPPONENT_JOINED',
      opponentName: displayName || 'Challenger',
      state: room.state,
    });
  }

  res.json({
    success: true,
    roomId: room.id,
    color: room.white?.userId === userId ? 'white' : 'black',
    opponentName: room.white?.userId === userId ? room.black?.displayName : room.white?.displayName,
    state: room.state,
  });
});

app.get('/api/rooms/:id/state', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    id: room.id,
    state: room.state,
    whiteName: room.white?.displayName,
    blackName: room.black?.displayName,
    hasOpponent: Boolean(room.black),
    spotifyUri: room.spotifyUri,
    spotifyTitle: room.spotifyTitle,
  });
});

app.post('/api/rooms/:id/spotify', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { spotifyUri, spotifyTitle, sharedBy } = req.body;
  room.spotifyUri = spotifyUri;
  room.spotifyTitle = spotifyTitle;
  broadcastToRoom(room, {
    type: 'SPOTIFY_UPDATED',
    spotifyUri,
    spotifyTitle,
    sharedBy: sharedBy || 'Opponent',
  });
  res.json({ success: true, spotifyUri, spotifyTitle });
});

app.post('/api/rooms/:id/move', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { move } = req.body;
  if (!move) return res.status(400).json({ error: 'No move provided' });

  const nextState = applyMove(room.state, move);
  room.state = nextState;

  broadcastToRoom(room, {
    type: 'MOVE_APPLIED',
    move,
    state: nextState,
  });

  if (nextState.status !== 'playing') {
    broadcastToRoom(room, {
      type: 'GAME_OVER',
      status: nextState.status,
      winner: nextState.winner,
      reason: nextState.statusReason,
    });
  }

  res.json({ success: true, state: nextState });
});

// TELEGRAM BOT WEBHOOK SIMULATOR & EXPORT INFO
app.get('/api/telegram/bot-info', (req, res) => {
  res.json({
    status: 'configured',
    hasToken: Boolean(TELEGRAM_BOT_TOKEN),
    commands: [
      { command: 'start', description: 'Launch Dama Arena Web App' },
      { command: 'play', description: 'Start an Ethiopian Dama game' },
      { command: 'tournaments', description: 'Join Dama Tournaments' },
      { command: 'rooms', description: 'Active multiplayer rooms' },
      { command: 'rules', description: 'Learn confirmed Ethiopian Dama rules' },
      { command: 'profile', description: 'Check your rank and stats' },
      { command: 'leaderboard', description: 'View top Dama players' },
    ],
  });
});

// MULTIPLAYER ROOM & WEBSOCKET ENGINE
interface PlayerClient {
  ws?: WebSocket;
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
  spotifyUri?: string;
  spotifyTitle?: string;
}

const rooms = new Map<string, MatchRoom>();
let matchmakingQueue: PlayerClient[] = [];

const wss = new WebSocketServer({ noServer: true });

function broadcastToRoom(room: MatchRoom, message: object) {
  const json = JSON.stringify(message);
  if (room.white?.ws && room.white.ws.readyState === WebSocket.OPEN) {
    try { room.white.ws.send(json); } catch (_) {}
  }
  if (room.black?.ws && room.black.ws.readyState === WebSocket.OPEN) {
    try { room.black.ws.send(json); } catch (_) {}
  }
  for (const s of room.spectators) {
    if (s.ws && s.ws.readyState === WebSocket.OPEN) {
      try { s.ws.send(json); } catch (_) {}
    }
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

        case 'ATTACH_ROOM': {
          if (!clientUser) return;
          const roomId = (msg.roomId || '').toUpperCase();
          const room = rooms.get(roomId);
          if (room) {
            currentRoomId = roomId;
            if (room.white?.userId === clientUser.userId) {
              room.white.ws = ws;
            } else if (room.black?.userId === clientUser.userId) {
              room.black.ws = ws;
            } else {
              room.spectators.push({ ...clientUser, ws });
            }
            ws.send(JSON.stringify({
              type: 'ATTACH_ACK',
              roomId,
              state: room.state,
              whiteName: room.white?.displayName,
              blackName: room.black?.displayName,
              spotifyUri: room.spotifyUri,
              spotifyTitle: room.spotifyTitle,
            }));
          }
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
            if (room.white?.ws && room.white.ws.readyState === WebSocket.OPEN) {
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
            (p) => p.ws && p.ws.readyState === WebSocket.OPEN && p.userId !== clientUser!.userId
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

            if (whitePlayer.ws && whitePlayer.ws.readyState === WebSocket.OPEN) {
              whitePlayer.ws.send(
                JSON.stringify({
                  type: 'MATCH_FOUND',
                  roomId,
                  color: 'white',
                  opponentName: blackPlayer.displayName,
                  state: room.state,
                })
              );
            }

            if (blackPlayer.ws && blackPlayer.ws.readyState === WebSocket.OPEN) {
              blackPlayer.ws.send(
                JSON.stringify({
                  type: 'MATCH_FOUND',
                  roomId,
                  color: 'black',
                  opponentName: whitePlayer.displayName,
                  state: room.state,
                })
              );
            }
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

        case 'SYNC_SPOTIFY': {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          room.spotifyUri = msg.spotifyUri;
          room.spotifyTitle = msg.spotifyTitle;
          broadcastToRoom(room, {
            type: 'SPOTIFY_UPDATED',
            spotifyUri: msg.spotifyUri,
            spotifyTitle: msg.spotifyTitle,
            sharedBy: clientUser.displayName,
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
let APP_URL = process.env.PUBLIC_APP_URL || 'https://isaac-roger-occur-claims.trycloudflare.com';

export async function updateTelegramMenuButton(url: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '⚔️ Play Dama 🇪🇹',
          web_app: { url },
        },
      }),
    });
    console.log(`✅ Telegram Bot Menu Button synced to: ${url}`);
  } catch (e) {
    console.warn('Failed to sync Telegram Menu Button:', e);
  }
}

function startCloudflareTunnel() {
  const binaryPath = path.resolve(process.cwd(), 'bin', 'cloudflared');
  if (!fs.existsSync(binaryPath)) {
    console.log('Tunnel: ./bin/cloudflared not found, skipping auto-tunnel.');
    return;
  }

  console.log('🚀 Launching persistent Cloudflare Tunnel from ./bin/cloudflared...');
  const tunnel = spawn(binaryPath, ['tunnel', '--protocol', 'http2', '--url', 'http://127.0.0.1:3000', '--no-autoupdate']);

  const handleOutput = (data: Buffer) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[-a-z0-9.]*\.trycloudflare\.com/);
    if (match && match[0] && match[0] !== APP_URL) {
      APP_URL = match[0];
      console.log(`⚡ CLOUDFLARE TUNNEL LIVE: ${APP_URL}`);
      updateTelegramMenuButton(APP_URL);
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('close', (code) => {
    console.log(`Tunnel closed with code ${code}, restarting in 5s...`);
    setTimeout(startCloudflareTunnel, 5000);
  });
}

function buildTelegramKeyboard(url: string = APP_URL) {
  const v = 'v=3_0_live';
  return {
    inline_keyboard: [
      [
        {
          text: '⚔️ አሁኑኑ ተጫወት | Play Dama 🇪🇹',
          web_app: { url: `${url}?${v}&tgWebAppStartParam=play` },
        },
      ],
      [
        {
          text: '🏆 ውድድሮች | Tournaments 👑',
          web_app: { url: `${url}?${v}&mode=tournaments` },
        },
        {
          text: '👥 ከጓደኛ ጋር / ክፍሎች (Rooms)',
          web_app: { url: `${url}?${v}&mode=friend` },
        },
      ],
      [
        {
          text: '🤖 ከኮምፒውተር ጋር (vs AI)',
          web_app: { url: `${url}?${v}&mode=ai` },
        },
        {
          text: '📊 የደረጃ ሰንጠረዥ (Leaderboard)',
          web_app: { url: `${url}?${v}&mode=leaderboard` },
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

    const welcomeMsg = `<b>እንኳን ወደ DAMA ARENA በደህና መጡ! 🇪🇹👑</b>\n<b>Welcome, ${userName}!</b>\n\nትክክለኛውን የኢትዮጵያ <b>ባለ 4 ዳማ (8x8 Board)</b> ከኮምፒውተር ጋር ወይም ከጓደኛዎ ጋር በኦንላይን ይጫወቱ!\n\n✨ <b>ዋና ዋና ገጽታዎች፦</b>\n• 12 ጠጠሮች በ 3 ረድፍ (ባለ 4 ቦርድ)\n• ጠጠር ወደ ፊት ብቻ ይራመዳል (ወደ ኋላ መሄድ አይችልም)\n• ዳማ በረዥሙ ይበራል\n• የቀጥታ ውድድሮች እና የክፍት ክፍሎች ዝርዝር\n\nከታች ከቀረቡት አማራጮች የሚፈልጉትን ይምረጡ፦`;

    const keyboard = deepParam
      ? {
          inline_keyboard: [
            [{ text: '⚡ ጨዋታውን ተቀላቀል | Join Room Now', web_app: { url: launchUrl } }],
            ...buildTelegramKeyboard(APP_URL).inline_keyboard,
          ],
        }
      : buildTelegramKeyboard(APP_URL);

    await sendTelegramMessage(chatId, welcomeMsg, keyboard);
  } else if (text === '/tournaments') {
    await sendTelegramMessage(chatId, `🏆 <b>የዳማ ውድድሮች (Dama Tournaments)፦</b>\nበቀጥታ በሚተላለፉ ውድድሮች ላይ ይሳተፉ እና ትላልቅ የዋንጫ ሽልማቶችን ያሸንፉ!`, {
      inline_keyboard: [[{ text: '🏆 ውድድሮችን ክፈት | Open Tournaments', web_app: { url: `${APP_URL}?mode=tournaments` } }]],
    });
  } else if (text === '/rules') {
    const rulesMsg = `📜 <b>የኢትዮጵያ ዳማ ህጎች (Ethiopian Dama Rules):</b>\n\n• <b>ባለ 4 (8x8 ቦርድ)፦</b> በእያንዳንዱ ረድፍ 4 ጥቁር ካሬዎች (በአጠቃላይ 12 ጠጠሮች በ3 ረድፍ)።\n• <b>የጠጠር እንቅስቃሴ፦</b> ጠጠር ወደ ፊት ብቻ በሰያፍ 1 ካሬ ይራመዳል። <b>ጠጠር ወደ ኋላ መሄድ አይችልም!</b>\n• <b>መብላት (Captures)፦</b> የጠላት ጠጠርን በሰያፍ ዘሎ ክፍት ቦታ ላይ በማረፍ ይበላል።\n• <b>ዳማ መሆን፦</b> ጠጠር የመጨረሻው ረድፍ ሲደርስ ወዲያውኑ ዳማ (ንጉሥ) ይሆናል።\n• <b>የዳማ እንቅስቃሴ፦</b> ዳማ በረዥሙ ወደ የትኛውም አቅጣጫ ይበራል፤ ይበላል።`;
    await sendTelegramMessage(chatId, rulesMsg, buildTelegramKeyboard(APP_URL));
  } else if (text === '/play') {
    await sendTelegramMessage(chatId, `⚔️ <b>ጨዋታ ለመጀመር ዝግጁ ኖት?</b>\nReady for battle? Tap below to jump straight into a match!`, buildTelegramKeyboard(APP_URL));
  } else if (text === '/ai') {
    await sendTelegramMessage(chatId, `🤖 <b>ከኮምፒውተር ጋር ይጫወቱ (vs AI)፦</b>\nየችሎታ ደረጃዎን (Easy, Medium, Master) መርጠው ይወዳደሩ!`, {
      inline_keyboard: [[{ text: '🤖 ከ AI ጋር ጀምር', web_app: { url: `${APP_URL}?mode=ai` } }]],
    });
  } else if (text === '/friend' || text === '/rooms') {
    await sendTelegramMessage(chatId, `👥 <b>ከጓደኛ ጋር መጫወቻ እና ክፍሎች (Play Friend & Rooms)፦</b>\nየራስዎን ክፍል ይፍጠሩ ወይም ክፍት ክፍሎችን ተቀላቅለው ይጫወቱ!`, {
      inline_keyboard: [[{ text: '👥 ክፍሎችን ክፈት | Open Rooms', web_app: { url: `${APP_URL}?mode=friend` } }]],
    });
  } else if (text === '/leaderboard') {
    await sendTelegramMessage(chatId, `📊 <b>የደረጃ ሰንጠረዥ (Leaderboard):</b>\nከፍተኛ ደረጃ ላይ ያሉ የኢትዮጵያ ዳማ አሸናፊዎችን ይመልከቱ፦`, {
      inline_keyboard: [[{ text: '📊 ደረጃ ሰንጠረዥ ይመልከቱ', web_app: { url: `${APP_URL}?mode=leaderboard` } }]],
    });
  } else if (text === '/help') {
    const helpMsg = `<b>Dama Arena Bot Commands:</b>\n/play - ⚔️ አሁኑኑ ተጫወት (Play Now)\n/tournaments - 🏆 ውድድሮች (Tournaments)\n/friend - 👥 ከጓደኛ ጋር / ክፍሎች (Friends & Rooms)\n/ai - 🤖 ከኮምፒውተር ጋር (vs AI)\n/leaderboard - 📊 የደረጃ ሰንጠረዥ (Leaderboard)\n/rules - 📜 የዳማ ህጎች (Rules)`;
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
          text: '⚔️ Play Dama 🇪🇹',
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
          { command: 'play', description: '⚔️ አሁኑኑ ተጫወት (Play Dama)' },
          { command: 'tournaments', description: '🏆 ውድድሮች (Tournaments)' },
          { command: 'friend', description: '👥 ከጓደኛ ጋር / ክፍሎች (Friends & Rooms)' },
          { command: 'ai', description: '🤖 ከኮምፒውተር ጋር (vs AI)' },
          { command: 'leaderboard', description: '📊 የደረጃ ሰንጠረዥ (Rankings)' },
          { command: 'rules', description: '📜 የኢትዮጵያ ዳማ ህጎች (Rules)' },
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

// Ultra-fast asset delivery: Serve pre-built dist with caching if available, else Vite
async function bootstrap() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (hasDist) {
    console.log('⚡ High-Speed Mode: Serving minified production bundle from /dist with caching');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Dama Arena Server listening on port ${PORT} (prod=${isProd})`);
    initTelegramBotService();
    startCloudflareTunnel();
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

