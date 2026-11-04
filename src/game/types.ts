/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PieceColor = 'white' | 'black';
export type PieceType = 'man' | 'king';

export interface Position {
  r: number;
  c: number;
}

export interface Piece {
  id: string;
  color: PieceColor;
  type: PieceType;
}

export type Board = (Piece | null)[][];

export type KingLandingRule = 'all_beyond' | 'immediate_beyond';
export type StalemateRule = 'loss' | 'draw';
export type StartingLayoutPreset = 'standard_12' | 'compact_8' | 'standard_20' | 'tactical_15';

export interface GameConfig {
  boardSize: 8 | 10; // 8 = "ባለ 4" (Ethiopian 8x8, 4 playable squares per row), 10 = 10x10
  startingLayout: StartingLayoutPreset;
  kingLandingRule: KingLandingRule;
  stalemateRule: StalemateRule;
  moveLimitWithoutCapture: number;
  repetitionRuleEnabled: boolean;
  captureIsMandatory: boolean;
  majorityCaptureMandatory: boolean;
  allowManBackwardMove: boolean; // false = ordinary piece cannot move backward (forward only)
  immediatePromotionInMultiJump: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
  boardSize: 8, // "ባለ 4" Ethiopian standard 8x8 board
  startingLayout: 'standard_12', // 3 rows of 4 = 12 pieces per side
  kingLandingRule: 'all_beyond',
  stalemateRule: 'loss',
  moveLimitWithoutCapture: 40,
  repetitionRuleEnabled: true,
  captureIsMandatory: true, // Strictly mandatory in Ethiopian Dama (መብላት ግዴታ ነው)
  majorityCaptureMandatory: false,
  allowManBackwardMove: false, // Ordinary piece cannot move backward (forward only)
  immediatePromotionInMultiJump: true,
};

export interface MoveStep {
  from: Position;
  to: Position;
  captured?: Position;
  promoted?: boolean;
}

export interface Move {
  from: Position;
  to: Position;
  steps: MoveStep[];
  capturedPositions: Position[];
  isPromotion: boolean;
  promotedDuringJump: boolean;
}

export type GameStatus = 'playing' | 'white_won' | 'black_won' | 'draw';

export interface GameState {
  board: Board;
  turn: PieceColor;
  status: GameStatus;
  winner?: PieceColor;
  statusReason?: string;
  config: GameConfig;
  moveHistory: Move[];
  turnCount: number;
  halfMovesWithoutCapture: number;
  positionHistory: string[];
  activeCapturePiece?: Position;
  pendingCapturedPositions: Position[];
}

export interface PlayerProfile {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestStreak: number;
  level: number;
  xp: number;
  createdAt: number;
  badges: string[];
}

export interface TournamentMatch {
  id: string;
  round: number; // 1 = QF, 2 = SF, 3 = Final
  roundName: string;
  player1?: { id: string; name: string; elo: number };
  player2?: { id: string; name: string; elo: number };
  winnerId?: string;
  status: 'upcoming' | 'ongoing' | 'finished';
}

export interface Tournament {
  id: string;
  title: string;
  description: string;
  organizer: {
    id: string;
    name: string;
    avatarSeed: string;
    role: string; // "መሪ / Organizer"
  };
  maxPlayers: number;
  boardSize: 8 | 10;
  prizeXp: number;
  status: 'registering' | 'live' | 'completed';
  registeredPlayers: Array<{
    id: string;
    name: string;
    elo: number;
    wins: number;
    points: number;
    avatarSeed: string;
  }>;
  matches: TournamentMatch[];
  champion?: string;
  createdAt: number;
}
