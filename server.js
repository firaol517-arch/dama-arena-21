// server.ts
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

// src/game/types.ts
var DEFAULT_CONFIG = {
  boardSize: 8,
  // "ባለ 4" Ethiopian standard 8x8 board
  startingLayout: "standard_12",
  // 3 rows of 4 = 12 pieces per side
  kingLandingRule: "all_beyond",
  stalemateRule: "loss",
  moveLimitWithoutCapture: 40,
  repetitionRuleEnabled: true,
  captureIsMandatory: true,
  majorityCaptureMandatory: false,
  allowManBackwardMove: false,
  // Ordinary piece cannot move backward (forward only)
  immediatePromotionInMultiJump: true
};

// src/game/engine.ts
function isDarkSquare(r, c) {
  return (r + c) % 2 === 1;
}
function inBounds(r, c, boardSize = 8) {
  return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
}
function cloneBoard(board) {
  return board.map((row) => row.map((cell) => cell ? { ...cell } : null));
}
function createInitialBoard(boardSize = 8, preset = "standard_12") {
  const board = Array.from(
    { length: boardSize },
    () => Array.from({ length: boardSize }, () => null)
  );
  let idCounter = 1;
  const placePiece = (r, c, color) => {
    board[r][c] = {
      id: `${color[0]}_${idCounter++}`,
      color,
      type: "man"
    };
  };
  if (boardSize === 8) {
    if (preset === "compact_8") {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "black");
        }
      }
      for (let r = 6; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "white");
        }
      }
    } else {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "black");
        }
      }
      for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "white");
        }
      }
    }
  } else {
    if (preset === "tactical_15") {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "black");
        }
      }
      for (let r = 7; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "white");
        }
      }
    } else {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "black");
        }
      }
      for (let r = 6; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isDarkSquare(r, c)) placePiece(r, c, "white");
        }
      }
    }
  }
  return board;
}
function isPromotionRow(pos, color, boardSize = 8) {
  return color === "white" && pos.r === 0 || color === "black" && pos.r === boardSize - 1;
}
function getBoardHash(board, turn) {
  const boardSize = board.length;
  const parts = [turn];
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p) {
        parts.push(`${r},${c}:${p.color[0]}${p.type[0]}`);
      }
    }
  }
  return parts.join(";");
}
var DIRECTIONS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
];
function includesPos(list, pos) {
  return list.some((p) => p.r === pos.r && p.c === pos.c);
}
function generateCapturesForPiece(board, pos, piece, config, currentSteps = [], capturedPositions = []) {
  const results = [];
  const { r, c } = pos;
  const isKing = piece.type === "king";
  const boardSize = config.boardSize;
  let foundContinuation = false;
  if (!isKing) {
    for (const [dr, dc] of DIRECTIONS) {
      const midR = r + dr;
      const midC = c + dc;
      const landR = r + 2 * dr;
      const landC = c + 2 * dc;
      if (!inBounds(midR, midC, boardSize) || !inBounds(landR, landC, boardSize)) continue;
      const midPiece = board[midR][midC];
      if (!midPiece || midPiece.color === piece.color || includesPos(capturedPositions, { r: midR, c: midC })) {
        continue;
      }
      const landingOccupant = board[landR][landC];
      const isStartPos = currentSteps.length > 0 && currentSteps[0].from.r === landR && currentSteps[0].from.c === landC;
      if (landingOccupant && !isStartPos) continue;
      foundContinuation = true;
      const landsOnPromotion = isPromotionRow({ r: landR, c: landC }, piece.color, boardSize);
      const promotedNow = config.immediatePromotionInMultiJump && landsOnPromotion;
      const nextPiece = promotedNow ? { ...piece, type: "king" } : { ...piece };
      const step = {
        from: pos,
        to: { r: landR, c: landC },
        captured: { r: midR, c: midC },
        promoted: landsOnPromotion
      };
      const newCaptured = [...capturedPositions, { r: midR, c: midC }];
      const newSteps = [...currentSteps, step];
      const subMoves = generateCapturesForPiece(
        board,
        { r: landR, c: landC },
        nextPiece,
        config,
        newSteps,
        newCaptured
      );
      results.push(...subMoves);
    }
  } else {
    for (const [dr, dc] of DIRECTIONS) {
      let stepDist = 1;
      let enemyPos = null;
      while (true) {
        const currR = r + dr * stepDist;
        const currC = c + dc * stepDist;
        if (!inBounds(currR, currC, boardSize)) break;
        const p = board[currR][currC];
        if (p) {
          if (p.color === piece.color || includesPos(capturedPositions, { r: currR, c: currC })) {
            break;
          }
          if (enemyPos === null) {
            enemyPos = { r: currR, c: currC };
          } else {
            break;
          }
        } else if (enemyPos !== null) {
          const landR = currR;
          const landC = currC;
          const distPastEnemy = stepDist - Math.abs(enemyPos.r - r);
          if (config.kingLandingRule === "immediate_beyond" && distPastEnemy > 1) {
            break;
          }
          foundContinuation = true;
          const step = {
            from: pos,
            to: { r: landR, c: landC },
            captured: enemyPos
          };
          const newCaptured = [...capturedPositions, enemyPos];
          const newSteps = [...currentSteps, step];
          const subMoves = generateCapturesForPiece(
            board,
            { r: landR, c: landC },
            piece,
            config,
            newSteps,
            newCaptured
          );
          results.push(...subMoves);
          if (config.kingLandingRule === "immediate_beyond") {
            break;
          }
        }
        stepDist++;
      }
    }
  }
  if (!foundContinuation && currentSteps.length > 0) {
    const firstFrom = currentSteps[0].from;
    const finalTo = currentSteps[currentSteps.length - 1].to;
    const isPromotedAtEnd = isPromotionRow(finalTo, piece.color, boardSize);
    const promotedDuringJump = currentSteps.some((s) => s.promoted);
    results.push({
      from: firstFrom,
      to: finalTo,
      steps: currentSteps,
      capturedPositions,
      isPromotion: isPromotedAtEnd || promotedDuringJump || piece.type === "king",
      promotedDuringJump
    });
  }
  return results;
}
function generateQuietMovesForPiece(board, pos, piece, config) {
  const moves = [];
  const { r, c } = pos;
  const boardSize = config.boardSize;
  if (piece.type === "man") {
    const allowedDirections = config.allowManBackwardMove ? DIRECTIONS : piece.color === "white" ? [
      [-1, -1],
      [-1, 1]
    ] : [
      [1, -1],
      [1, 1]
    ];
    for (const [dr, dc] of allowedDirections) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc, boardSize) && isDarkSquare(nr, nc) && !board[nr][nc]) {
        const promotes = isPromotionRow({ r: nr, c: nc }, piece.color, boardSize);
        moves.push({
          from: pos,
          to: { r: nr, c: nc },
          steps: [{ from: pos, to: { r: nr, c: nc }, promoted: promotes }],
          capturedPositions: [],
          isPromotion: promotes,
          promotedDuringJump: false
        });
      }
    }
  } else {
    for (const [dr, dc] of DIRECTIONS) {
      let stepDist = 1;
      while (true) {
        const nr = r + dr * stepDist;
        const nc = c + dc * stepDist;
        if (!inBounds(nr, nc, boardSize) || board[nr][nc]) break;
        moves.push({
          from: pos,
          to: { r: nr, c: nc },
          steps: [{ from: pos, to: { r: nr, c: nc } }],
          capturedPositions: [],
          isPromotion: false,
          promotedDuringJump: false
        });
        stepDist++;
      }
    }
  }
  return moves;
}
function getLegalMoves(state) {
  const { board, turn, config, activeCapturePiece } = state;
  const boardSize = config.boardSize;
  const allCaptures = [];
  const allQuiets = [];
  if (activeCapturePiece) {
    const p = board[activeCapturePiece.r][activeCapturePiece.c];
    if (p && p.color === turn) {
      return generateCapturesForPiece(
        board,
        activeCapturePiece,
        p,
        config,
        [],
        state.pendingCapturedPositions
      );
    }
    return [];
  }
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = board[r][c];
      if (p && p.color === turn) {
        const captures = generateCapturesForPiece(board, { r, c }, p, config);
        if (captures.length > 0) {
          allCaptures.push(...captures);
        } else {
          const quiets = generateQuietMovesForPiece(board, { r, c }, p, config);
          allQuiets.push(...quiets);
        }
      }
    }
  }
  if (config.captureIsMandatory && allCaptures.length > 0) {
    return allCaptures;
  }
  return allQuiets;
}
function createNewGame(config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const board = createInitialBoard(finalConfig.boardSize, finalConfig.startingLayout);
  const initialHash = getBoardHash(board, "white");
  return {
    board,
    turn: "white",
    status: "playing",
    config: finalConfig,
    moveHistory: [],
    turnCount: 1,
    halfMovesWithoutCapture: 0,
    positionHistory: [initialHash],
    pendingCapturedPositions: []
  };
}
function applyMove(state, move) {
  const newBoard = cloneBoard(state.board);
  const movingPiece = newBoard[move.from.r][move.from.c];
  const boardSize = state.config.boardSize;
  if (!movingPiece) {
    throw new Error(`No piece at starting position ${move.from.r},${move.from.c}`);
  }
  newBoard[move.from.r][move.from.c] = null;
  for (const cap of move.capturedPositions) {
    newBoard[cap.r][cap.c] = null;
  }
  let finalType = movingPiece.type;
  if (movingPiece.type === "man" && (move.isPromotion || move.promotedDuringJump || isPromotionRow(move.to, movingPiece.color, boardSize))) {
    finalType = "king";
  }
  newBoard[move.to.r][move.to.c] = {
    ...movingPiece,
    type: finalType
  };
  const nextTurn = state.turn === "white" ? "black" : "white";
  const isCapture = move.capturedPositions.length > 0;
  const halfMovesWithoutCapture = isCapture ? 0 : state.halfMovesWithoutCapture + 1;
  const nextHash = getBoardHash(newBoard, nextTurn);
  const newPosHistory = [...state.positionHistory, nextHash];
  const repetitionCount = newPosHistory.filter((h) => h === nextHash).length;
  const intermediateState = {
    board: newBoard,
    turn: nextTurn,
    status: "playing",
    config: state.config,
    moveHistory: [...state.moveHistory, move],
    turnCount: nextTurn === "white" ? state.turnCount + 1 : state.turnCount,
    halfMovesWithoutCapture,
    positionHistory: newPosHistory,
    pendingCapturedPositions: []
  };
  const opponentMoves = getLegalMoves(intermediateState);
  let opponentPieceCount = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const p = newBoard[r][c];
      if (p && p.color === nextTurn) {
        opponentPieceCount++;
      }
    }
  }
  if (opponentPieceCount === 0) {
    return {
      ...intermediateState,
      status: state.turn === "white" ? "white_won" : "black_won",
      winner: state.turn,
      statusReason: `All ${nextTurn} pieces captured!`
    };
  }
  if (opponentMoves.length === 0) {
    if (state.config.stalemateRule === "loss") {
      return {
        ...intermediateState,
        status: state.turn === "white" ? "white_won" : "black_won",
        winner: state.turn,
        statusReason: `${nextTurn} has no legal moves remaining.`
      };
    } else {
      return {
        ...intermediateState,
        status: "draw",
        statusReason: `Stalemate: ${nextTurn} has no legal moves.`
      };
    }
  }
  if (state.config.repetitionRuleEnabled && repetitionCount >= 3) {
    return {
      ...intermediateState,
      status: "draw",
      statusReason: "Draw by 3-fold repetition of position."
    };
  }
  if (state.config.moveLimitWithoutCapture > 0 && halfMovesWithoutCapture >= state.config.moveLimitWithoutCapture * 2) {
    return {
      ...intermediateState,
      status: "draw",
      statusReason: `Draw by ${state.config.moveLimitWithoutCapture}-move rule without capture.`
    };
  }
  return intermediateState;
}

// server.ts
var PORT = parseInt(process.env.PORT || "3000", 10);
var isProd = process.env.NODE_ENV === "production";
var TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
var app = express();
app.use(express.json());
var server = http.createServer(app);
var DATA_DIR = path.resolve(process.cwd(), "data");
var DATA_FILE = path.join(DATA_DIR, "dama_arena_data.json");
function loadData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Error loading data file, initializing fresh store:", err);
  }
  const initial = {
    users: {
      "guest_dama_king": {
        id: "guest_dama_king",
        username: "Abebe_Bikila",
        displayName: "Abebe B. (Dama Master)",
        avatarSeed: "Abebe",
        elo: 1850,
        matchesPlayed: 48,
        wins: 39,
        losses: 7,
        draws: 2,
        winStreak: 6,
        bestStreak: 12,
        level: 14,
        xp: 4200,
        createdAt: Date.now() - 864e5 * 30,
        badges: ["Grandmaster", "10-Streak", "Tactician", "Dama Pioneer"]
      },
      "guest_haile_g": {
        id: "guest_haile_g",
        username: "Haile_G",
        displayName: "Haile Gebrselassie",
        avatarSeed: "Haile",
        elo: 1720,
        matchesPlayed: 32,
        wins: 24,
        losses: 6,
        draws: 2,
        winStreak: 3,
        bestStreak: 8,
        level: 10,
        xp: 2850,
        createdAt: Date.now() - 864e5 * 20,
        badges: ["Endurance", "Sharpshooter"]
      },
      "guest_selam_t": {
        id: "guest_selam_t",
        username: "Selam_T",
        displayName: "Selamawit T.",
        avatarSeed: "Selam",
        elo: 1640,
        matchesPlayed: 25,
        wins: 18,
        losses: 5,
        draws: 2,
        winStreak: 4,
        bestStreak: 7,
        level: 8,
        xp: 2100,
        createdAt: Date.now() - 864e5 * 15,
        badges: ["Rising Star", "Strategist"]
      }
    },
    matches: []
  };
  saveData(initial);
  return initial;
}
function saveData(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save data store:", err);
  }
}
var store = loadData();
function getOrCreateUser(userId, username) {
  if (store.users[userId]) {
    return store.users[userId];
  }
  const name = username || `Player_${Math.floor(1e3 + Math.random() * 9e3)}`;
  const newUser = {
    id: userId,
    username: name.toLowerCase().replace(/[^a-z0-9_]/g, ""),
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
    badges: ["Recruit"]
  };
  store.users[userId] = newUser;
  saveData(store);
  return newUser;
}
function verifyTelegramInitData(initDataStr, botToken) {
  if (!botToken || !initDataStr) {
    return { isValid: false };
  }
  try {
    const params = new URLSearchParams(initDataStr);
    const hash = params.get("hash");
    if (!hash) return { isValid: false };
    params.delete("hash");
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (computedHash === hash) {
      const userParam = params.get("user");
      const userData = userParam ? JSON.parse(userParam) : void 0;
      return { isValid: true, userData };
    }
  } catch (err) {
    console.error("Error verifying Telegram initData:", err);
  }
  return { isValid: false };
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: Date.now(), uptime: process.uptime() });
});
app.post("/api/auth/guest", (req, res) => {
  const { id, username } = req.body;
  const userId = id || `guest_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  const profile = getOrCreateUser(userId, username);
  res.json({ success: true, profile });
});
app.post("/api/telegram/validate-session", (req, res) => {
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
      const userParam = params.get("user");
      if (userParam) {
        userData = JSON.parse(userParam);
      }
    } catch (e) {
    }
  }
  if (userData && userData.id) {
    const userId = `tg_${userData.id}`;
    const displayName = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || userData.username || "Telegram Player";
    const profile = getOrCreateUser(userId, displayName);
    return res.json({ success: true, profile, telegramUser: userData });
  }
  return res.status(400).json({ success: false, error: "No Telegram user information found" });
});
app.get("/api/profile/:id", (req, res) => {
  const profile = store.users[req.params.id];
  if (!profile) return res.status(404).json({ error: "User not found" });
  res.json(profile);
});
app.get("/api/leaderboard", (req, res) => {
  const allUsers = Object.values(store.users);
  const sorted = allUsers.sort((a, b) => b.elo - a.elo).slice(0, 50);
  res.json(sorted);
});
app.get("/api/matches", (req, res) => {
  const recent = store.matches.slice(-30).reverse();
  res.json(recent);
});
app.post("/api/matches/record", (req, res) => {
  const { mode, whitePlayer, blackPlayer, winner, reason, totalTurns, difficulty } = req.body;
  const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
  const matchRecord = {
    id: matchId,
    mode: mode || "ai",
    whitePlayer: whitePlayer || "White",
    blackPlayer: blackPlayer || "Black",
    winner,
    reason,
    totalTurns: totalTurns || 1,
    playedAt: Date.now(),
    difficulty
  };
  store.matches.push(matchRecord);
  const updatePlayerStats = (playerId, isWinner, isDraw) => {
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
      user.level = Math.floor(user.xp / 250) + 1;
      if (user.wins >= 5 && !user.badges.includes("Veteran")) user.badges.push("Veteran");
      if (user.winStreak >= 5 && !user.badges.includes("Streak Master")) user.badges.push("Streak Master");
      if (user.level >= 5 && !user.badges.includes("Tactician")) user.badges.push("Tactician");
    }
  };
  if (winner) {
    if (winner === "white") {
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
app.get("/api/telegram/bot-info", (req, res) => {
  res.json({
    status: "configured",
    hasToken: Boolean(TELEGRAM_BOT_TOKEN),
    commands: [
      { command: "start", description: "Launch Dama Arena Web App" },
      { command: "play", description: "Start an Ethiopian Dama game" },
      { command: "rules", description: "Learn confirmed Ethiopian Dama rules" },
      { command: "profile", description: "Check your rank and stats" },
      { command: "leaderboard", description: "View top Dama players" }
    ]
  });
});
var rooms = /* @__PURE__ */ new Map();
var matchmakingQueue = [];
var wss = new WebSocketServer({ noServer: true });
function broadcastToRoom(room, message) {
  const json = JSON.stringify(message);
  if (room.white?.ws.readyState === WebSocket.OPEN) room.white.ws.send(json);
  if (room.black?.ws.readyState === WebSocket.OPEN) room.black.ws.send(json);
  for (const s of room.spectators) {
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(json);
  }
}
wss.on("connection", (ws) => {
  let clientUser = null;
  let currentRoomId = null;
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case "INIT_CLIENT": {
          clientUser = {
            ws,
            userId: msg.userId || `user_${Math.floor(Math.random() * 1e5)}`,
            displayName: msg.displayName || "Player"
          };
          ws.send(JSON.stringify({ type: "INIT_ACK", userId: clientUser.userId }));
          break;
        }
        case "CREATE_ROOM": {
          if (!clientUser) return;
          const roomId = msg.roomId || Math.random().toString(36).substring(2, 8).toUpperCase();
          const config = msg.config || {};
          const state = createNewGame(config);
          const room = {
            id: roomId,
            createdAt: Date.now(),
            config: state.config,
            white: { ...clientUser, color: "white" },
            spectators: [],
            state,
            isPrivate: Boolean(msg.isPrivate),
            whiteTimerMs: (msg.timerMinutes || 10) * 60 * 1e3,
            blackTimerMs: (msg.timerMinutes || 10) * 60 * 1e3,
            lastTimerTick: Date.now()
          };
          rooms.set(roomId, room);
          currentRoomId = roomId;
          ws.send(
            JSON.stringify({
              type: "ROOM_CREATED",
              roomId,
              color: "white",
              state: room.state
            })
          );
          break;
        }
        case "JOIN_ROOM": {
          if (!clientUser) return;
          const roomId = (msg.roomId || "").toUpperCase();
          const room = rooms.get(roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Room not found" }));
            return;
          }
          currentRoomId = roomId;
          if (!room.black) {
            room.black = { ...clientUser, color: "black" };
            ws.send(
              JSON.stringify({
                type: "ROOM_JOINED",
                roomId,
                color: "black",
                whiteName: room.white?.displayName,
                state: room.state
              })
            );
            if (room.white?.ws.readyState === WebSocket.OPEN) {
              room.white.ws.send(
                JSON.stringify({
                  type: "OPPONENT_JOINED",
                  opponentName: clientUser.displayName,
                  state: room.state
                })
              );
            }
          } else {
            room.spectators.push(clientUser);
            ws.send(
              JSON.stringify({
                type: "ROOM_SPECTATING",
                roomId,
                state: room.state,
                whiteName: room.white?.displayName,
                blackName: room.black?.displayName
              })
            );
          }
          break;
        }
        case "FIND_MATCH": {
          if (!clientUser) return;
          matchmakingQueue = matchmakingQueue.filter(
            (p) => p.ws.readyState === WebSocket.OPEN && p.userId !== clientUser.userId
          );
          if (matchmakingQueue.length > 0) {
            const opponent = matchmakingQueue.shift();
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const state = createNewGame();
            const isClientWhite = Math.random() > 0.5;
            const whitePlayer = isClientWhite ? { ...clientUser, color: "white" } : { ...opponent, color: "white" };
            const blackPlayer = isClientWhite ? { ...opponent, color: "black" } : { ...clientUser, color: "black" };
            const room = {
              id: roomId,
              createdAt: Date.now(),
              config: state.config,
              white: whitePlayer,
              black: blackPlayer,
              spectators: [],
              state,
              isPrivate: false,
              whiteTimerMs: 10 * 60 * 1e3,
              blackTimerMs: 10 * 60 * 1e3,
              lastTimerTick: Date.now()
            };
            rooms.set(roomId, room);
            whitePlayer.ws.send(
              JSON.stringify({
                type: "MATCH_FOUND",
                roomId,
                color: "white",
                opponentName: blackPlayer.displayName,
                state: room.state
              })
            );
            blackPlayer.ws.send(
              JSON.stringify({
                type: "MATCH_FOUND",
                roomId,
                color: "black",
                opponentName: whitePlayer.displayName,
                state: room.state
              })
            );
          } else {
            matchmakingQueue.push(clientUser);
            ws.send(JSON.stringify({ type: "MATCHMAKING_WAITING" }));
          }
          break;
        }
        case "CANCEL_MATCHMAKING": {
          if (!clientUser) return;
          matchmakingQueue = matchmakingQueue.filter((p) => p.userId !== clientUser.userId);
          ws.send(JSON.stringify({ type: "MATCHMAKING_CANCELLED" }));
          break;
        }
        case "PLAY_MOVE": {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const movingPlayerColor = room.white?.userId === clientUser.userId ? "white" : room.black?.userId === clientUser.userId ? "black" : null;
          if (!movingPlayerColor || room.state.turn !== movingPlayerColor) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Not your turn" }));
            return;
          }
          const move = msg.move;
          if (!move) return;
          const legalMoves = getLegalMoves(room.state);
          const isLegal = legalMoves.some(
            (m) => m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c && m.capturedPositions.length === move.capturedPositions.length
          );
          if (!isLegal) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Illegal move rejected by server engine" }));
            return;
          }
          const nextState = applyMove(room.state, move);
          room.state = nextState;
          broadcastToRoom(room, {
            type: "MOVE_APPLIED",
            move,
            state: nextState
          });
          if (nextState.status !== "playing") {
            broadcastToRoom(room, {
              type: "GAME_OVER",
              status: nextState.status,
              winner: nextState.winner,
              reason: nextState.statusReason
            });
          }
          break;
        }
        case "SEND_CHAT": {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          broadcastToRoom(room, {
            type: "CHAT_MESSAGE",
            sender: clientUser.displayName,
            senderId: clientUser.userId,
            text: String(msg.text || "").substring(0, 160),
            timestamp: Date.now()
          });
          break;
        }
        case "REMATCH_OFFER": {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          broadcastToRoom(room, {
            type: "REMATCH_OFFERED",
            fromUser: clientUser.displayName
          });
          break;
        }
        case "REMATCH_ACCEPT": {
          if (!currentRoomId || !clientUser) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const oldWhite = room.white;
          const oldBlack = room.black;
          if (oldWhite && oldBlack) {
            room.white = { ...oldBlack, color: "white" };
            room.black = { ...oldWhite, color: "black" };
          }
          room.state = createNewGame(room.config);
          broadcastToRoom(room, {
            type: "REMATCH_STARTED",
            state: room.state,
            whiteName: room.white?.displayName,
            blackName: room.black?.displayName
          });
          break;
        }
      }
    } catch (err) {
      console.error("Error handling WebSocket message:", err);
    }
  });
  ws.on("close", () => {
    if (clientUser) {
      matchmakingQueue = matchmakingQueue.filter((p) => p.userId !== clientUser.userId);
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          broadcastToRoom(room, {
            type: "PLAYER_DISCONNECTED",
            userId: clientUser.userId,
            name: clientUser.displayName
          });
        }
      }
    }
  });
});
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});
var APP_URL = process.env.PUBLIC_APP_URL || "https://ais-pre-37d6qzhtee3lmd2myppu6s-865179148767.europe-west2.run.app";
function buildTelegramKeyboard(url = APP_URL) {
  return {
    inline_keyboard: [
      [
        {
          text: "\u2694\uFE0F Play Dama Arena \u{1F1EA}\u{1F1F9}",
          web_app: { url: `${url}?tgWebAppStartParam=play` }
        }
      ],
      [
        {
          text: "\u{1F916} Play vs AI",
          web_app: { url: `${url}?mode=ai` }
        },
        {
          text: "\u{1F465} Play with Friend",
          web_app: { url: `${url}?mode=friend` }
        }
      ],
      [
        {
          text: "\u{1F310} Online Multiplayer",
          web_app: { url: `${url}?mode=multiplayer` }
        },
        {
          text: "\u{1F3C6} Leaderboard",
          web_app: { url: `${url}?mode=leaderboard` }
        }
      ],
      [
        {
          text: "\u{1F464} My Profile",
          web_app: { url: `${url}?mode=profile` }
        },
        {
          text: "\u{1F4DC} Game Rules",
          web_app: { url: `${url}?mode=rules` }
        }
      ]
    ]
  };
}
async function sendTelegramMessage(chatId, text, replyMarkup) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      })
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}
async function handleTelegramUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from?.first_name || "Champion";
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const deepParam = parts.length > 1 ? parts[1] : "";
    const launchUrl = deepParam ? `${APP_URL}?tgWebAppStartParam=${deepParam}` : APP_URL;
    const welcomeMsg = `<b>\u12A5\u1295\u12B3\u1295 \u12C8\u12F0 DAMA ARENA \u1260\u12F0\u1205\u1293 \u1218\u1321! \u{1F1EA}\u{1F1F9}\u{1F451}</b>
<b>Welcome to DAMA ARENA, ${userName}!</b>

Play authentic Ethiopian Dama, challenge tactical AI, and compete with friends in real-time matches.

Tap below to launch the arena!`;
    const keyboard = deepParam ? {
      inline_keyboard: [
        [{ text: "\u26A1 Join Room Now", web_app: { url: launchUrl } }],
        ...buildTelegramKeyboard(APP_URL).inline_keyboard
      ]
    } : buildTelegramKeyboard(APP_URL);
    await sendTelegramMessage(chatId, welcomeMsg, keyboard);
  } else if (text === "/rules") {
    const rulesMsg = `<b>\u12E8\u12A2\u1275\u12EE\u1335\u12EB \u12F3\u121B \u1205\u130E\u127D (Ethiopian Dama Rules):</b>

\u2022 <b>10x10 Board:</b> Played on dark squares.
\u2022 <b>Ordinary Pieces:</b> Move 1 square diagonally forward OR backward.
\u2022 <b>Captures:</b> Jump diagonally forward or backward over adjacent enemy.
\u2022 <b>Mandatory Captures:</b> Any available capture must be taken. Multi-captures are mandatory.
\u2022 <b>Free Choice of Routes:</b> Max captures is NOT mandatory; choose any legal route!
\u2022 <b>Immediate Promotion:</b> Reaching farthest row promotes immediately (even mid-sequence) and continues as King!
\u2022 <b>Flying Kings:</b> Long-range movement and capture over diagonals.`;
    await sendTelegramMessage(chatId, rulesMsg, buildTelegramKeyboard(APP_URL));
  } else if (text === "/play") {
    await sendTelegramMessage(chatId, `\u2694\uFE0F <b>\u1328\u12CB\u1273 \u1208\u1218\u1300\u1218\u122D \u12DD\u130D\u1301 \u1296\u1275?</b>
Ready for battle? Tap below to jump straight into a match!`, buildTelegramKeyboard(APP_URL));
  } else if (text === "/profile") {
    await sendTelegramMessage(chatId, `\u{1F464} View your ELO rating, level, badges, and win streak inside the app:`, buildTelegramKeyboard(APP_URL));
  } else if (text === "/leaderboard") {
    await sendTelegramMessage(chatId, `\u{1F3C6} See where you rank against the top Ethiopian Dama grandmasters:`, buildTelegramKeyboard(APP_URL));
  } else if (text === "/help") {
    const helpMsg = `<b>Dama Arena Commands:</b>
/start - Open main menu & game
/play - Start a match
/rules - Ethiopian Dama official rules
/profile - Check your profile & stats
/leaderboard - Top ranked players
/help - Show this guide`;
    await sendTelegramMessage(chatId, helpMsg, buildTelegramKeyboard(APP_URL));
  }
}
app.post("/api/telegram/webhook", (req, res) => {
  handleTelegramUpdate(req.body).catch((e) => console.error(e));
  res.json({ ok: true });
});
async function initTelegramBotService() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "MY_TELEGRAM_BOT_TOKEN") {
    console.log("Telegram bot service: No TELEGRAM_BOT_TOKEN configured.");
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "\u2694\uFE0F Play Dama",
          web_app: { url: APP_URL }
        }
      })
    });
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "play", description: "\u2694\uFE0F Launch Dama Arena" },
          { command: "start", description: "\u{1F451} Open Main Menu & Play" },
          { command: "rules", description: "\u{1F4DC} Ethiopian Dama Rules" },
          { command: "leaderboard", description: "\u{1F3C6} Global Rankings" },
          { command: "profile", description: "\u{1F464} My Profile & Stats" },
          { command: "help", description: "\u2753 Help and Game Guide" }
        ]
      })
    });
    console.log("Telegram bot menu button and commands verified.");
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
      }
      setTimeout(pollUpdates, 1e3);
    };
    pollUpdates();
    console.log("Telegram bot polling active for @Letsdamabot");
  } catch (err) {
    console.error("Error starting Telegram bot service:", err);
  }
}
async function bootstrap() {
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
        watch: process.env.DISABLE_HMR === "true" ? null : {}
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Dama Arena Server listening on port ${PORT} (prod=${isProd})`);
    initTelegramBotService();
  });
}
bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
