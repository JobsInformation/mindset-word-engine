import { BoardMatrix, BonusType, RackTile } from './types';

const TILE_DISTRIBUTION: [string, number, number][] = [
  ['A', 1, 9], ['B', 3, 2], ['C', 3, 2], ['D', 2, 4], ['E', 1, 12],
  ['F', 4, 2], ['G', 2, 3], ['H', 4, 2], ['I', 1, 9], ['J', 8, 1],
  ['K', 5, 1], ['L', 1, 4], ['M', 3, 2], ['N', 1, 6], ['O', 1, 8],
  ['P', 3, 2], ['Q', 10, 1], ['R', 1, 6], ['S', 1, 4], ['T', 1, 6],
  ['U', 1, 4], ['V', 4, 2], ['W', 4, 2], ['X', 8, 1], ['Y', 4, 2],
  ['Z', 10, 1],
];

export function createShuffledTileBag(): RackTile[] {
  const bag: RackTile[] = [];
  let idx = 0;
  for (const [letter, points, count] of TILE_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      bag.push({ id: `tile_${idx++}_${letter}`, letter, points });
    }
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function createInitialBoard(proceduralTraps = true): BoardMatrix {
  const board: BoardMatrix = Array.from({ length: 15 }, (_, r) =>
    Array.from({ length: 15 }, (_, c) => ({
      row: r,
      col: c,
      bonus: getStandardBonus(r, c),
      tile: null,
      bonusUsed: false,
    }))
  );

  if (proceduralTraps) {
    let placed = 0;
    while (placed < 4) {
      const r = Math.floor(Math.random() * 7);
      const c = Math.floor(Math.random() * 15);
      if (board[r][c].bonus === 'NONE' && !(r === 7 && c === 7)) {
        board[r][c].bonus = 'TRAP';
        board[14 - r][14 - c].bonus = 'TRAP';
        placed++;
      }
    }
  }

  return board;
}

function getStandardBonus(r: number, c: number): BonusType {
  if (r === 7 && c === 7) return 'STAR';
  const tw = ['0,0', '0,7', '0,14', '7,0', '7,14', '14,0', '14,7', '14,14'];
  if (tw.includes(`${r},${c}`)) return 'TW';
  if (r === c || r + c === 14) {
    if ([1, 2, 3, 4, 10, 11, 12, 13].includes(r)) return 'DW';
    if ([5, 9].includes(r)) return 'TL';
    if ([6, 8].includes(r)) return 'DL';
  }
  return 'NONE';
}
