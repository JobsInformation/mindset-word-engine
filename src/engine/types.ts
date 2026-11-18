export type BonusType = 'NONE' | 'DL' | 'TL' | 'DW' | 'TW' | 'STAR' | 'TRAP';

export interface RackTile {
  id: string;
  letter: string;
  points: number;
  isBlank?: boolean;
}

export interface PlacedTile {
  row: number;
  col: number;
  letter: string;
  points: number;
  isBlank?: boolean;
}

export interface BoardCell {
  row: number;
  col: number;
  bonus: BonusType;
  tile: PlacedTile | null;
  bonusUsed: boolean;
}

export type BoardMatrix = BoardCell[][];

export interface MoveValidationInput {
  boardState: BoardMatrix;
  placedTiles: PlacedTile[];
  decisionTimeMs: number;
  currentStreak: number;
  isFirstTurn: boolean;
}

export interface MoveValidationResult {
  isValid: boolean;
  error?: string;
  primaryWord?: string;
  formedWords?: string[];
  baseScore?: number;
  sharkMultiplier?: number;
  nextStreak?: number;
  trapPenalty?: number;
  bingoBonus?: number;
  finalScore?: number;
}
