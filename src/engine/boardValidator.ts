import { BinaryTrieEngine } from './trieEngine';
import { BoardMatrix, MoveValidationInput, MoveValidationResult, PlacedTile } from './types';

export function validateAndScoreMove(
  trie: BinaryTrieEngine,
  input: MoveValidationInput
): MoveValidationResult {
  const { boardState, placedTiles, decisionTimeMs, currentStreak, isFirstTurn } = input;

  if (!placedTiles || placedTiles.length === 0) {
    return { isValid: false, error: 'Place at least one tile on the board.' };
  }

  const rows = new Set<number>();
  const cols = new Set<number>();

  for (const t of placedTiles) {
    if (t.row < 0 || t.row > 14 || t.col < 0 || t.col > 14) {
      return { isValid: false, error: 'Tile out of bounds.' };
    }
    if (boardState[t.row][t.col].tile !== null) {
      return { isValid: false, error: 'Cell is already occupied.' };
    }
    rows.add(t.row);
    cols.add(t.col);
  }

  if (rows.size > 1 && cols.size > 1) {
    return { isValid: false, error: 'Tiles must align in a single row or column.' };
  }

  const newMap = new Map<string, PlacedTile>();
  placedTiles.forEach((t) => newMap.set(`${t.row},${t.col}`, t));

  const getTileAt = (r: number, c: number): PlacedTile | null => {
    if (r < 0 || r > 14 || c < 0 || c > 14) return null;
    return newMap.get(`${r},${c}`) ?? boardState[r][c].tile;
  };

  if (isFirstTurn) {
    if (!newMap.has('7,7')) {
      return { isValid: false, error: 'First word must cover the center Star (7,7).' };
    }
    if (placedTiles.length < 2) {
      return { isValid: false, error: 'Opening word must be at least 2 letters.' };
    }
  } else {
    const touchesExisting = placedTiles.some((t) =>
      [
        [t.row - 1, t.col],
        [t.row + 1, t.col],
        [t.row, t.col - 1],
        [t.row, t.col + 1],
      ].some(([nr, nc]) => nr >= 0 && nr <= 14 && nc >= 0 && nc <= 14 && boardState[nr][nc].tile !== null)
    );
    if (!touchesExisting) {
      return { isValid: false, error: 'Word must connect to an existing board tile.' };
    }
  }

  const anchor = placedTiles[0];
  const hasHorizNeighbor =
    (anchor.col > 0 && boardState[anchor.row][anchor.col - 1].tile !== null) ||
    (anchor.col < 14 && boardState[anchor.row][anchor.col + 1].tile !== null);
  const isHorizontal = rows.size === 1 && (cols.size > 1 || hasHorizNeighbor);

  const formedWords: { word: string; score: number }[] = [];

  const scoreLine = (startR: number, startC: number, dR: number, dC: number) => {
    let r = startR;
    let c = startC;
    while (getTileAt(r - dR, c - dC) !== null) {
      r -= dR;
      c -= dC;
    }
    let word = '';
    let wordSum = 0;
    let wordMult = 1;

    while (getTileAt(r, c) !== null) {
      const tile = getTileAt(r, c)!;
      const isNew = newMap.has(`${r},${c}`);
      const cell = boardState[r][c];
      let letterScore = tile.isBlank ? 0 : tile.points;

      if (isNew && !cell.bonusUsed) {
        if (cell.bonus === 'DL') letterScore *= 2;
        if (cell.bonus === 'TL') letterScore *= 3;
        if (cell.bonus === 'DW' || cell.bonus === 'STAR') wordMult *= 2;
        if (cell.bonus === 'TW') wordMult *= 3;
      }

      word += tile.letter.toUpperCase();
      wordSum += letterScore;
      r += dR;
      c += dC;
    }
    return { word, score: wordSum * wordMult };
  };

  const primary = isHorizontal
    ? scoreLine(anchor.row, anchor.col, 0, 1)
    : scoreLine(anchor.row, anchor.col, 1, 0);

  const spanCount = isHorizontal
    ? Math.max(...cols) - Math.min(...cols) + 1
    : Math.max(...rows) - Math.min(...rows) + 1;

  if (primary.word.length < spanCount) {
    return { isValid: false, error: 'No empty gaps allowed between tiles.' };
  }

  formedWords.push(primary);

  for (const t of placedTiles) {
    const cross = isHorizontal ? scoreLine(t.row, t.col, 1, 0) : scoreLine(t.row, t.col, 0, 1);
    if (cross.word.length > 1) formedWords.push(cross);
  }

  for (const entry of formedWords) {
    if (!trie.hasWord(entry.word)) {
      return { isValid: false, error: `"${entry.word}" is not in the dictionary.` };
    }
  }

  const baseScore = formedWords.reduce((acc, w) => acc + w.score, 0);
  const bingoBonus = placedTiles.length === 7 ? 50 : 0;
  const isFastTurn = decisionTimeMs <= 30_000;
  const nextStreak = isFastTurn ? Math.min(currentStreak + 1, 3) : 0;
  const sharkMultiplier = 1 + nextStreak * 0.1;

  const uniqueTraps = placedTiles.filter(
    (t) => boardState[t.row][t.col].bonus === 'TRAP' && !boardState[t.row][t.col].bonusUsed
  ).length;
  const trapPenalty = uniqueTraps * 5;

  const finalScore = Math.max(0, Math.round((baseScore + bingoBonus) * sharkMultiplier) - trapPenalty);

  return {
    isValid: true,
    primaryWord: primary.word,
    formedWords: formedWords.map((w) => w.word),
    baseScore,
    sharkMultiplier,
    nextStreak,
    trapPenalty,
    bingoBonus,
    finalScore,
  };
}
