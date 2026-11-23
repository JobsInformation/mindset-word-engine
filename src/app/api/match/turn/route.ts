import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/prisma';
import { BinaryTrieEngine } from '@/engine/trieEngine';
import { validateAndScoreMove } from '@/engine/boardValidator';
import { BoardMatrix, PlacedTile, RackTile } from '@/engine/types';

let cachedTrie: BinaryTrieEngine | null = null;
function getTrie(): BinaryTrieEngine {
  if (!cachedTrie) {
    const dictPath = path.join(process.cwd(), 'public', 'dict.bin');
    cachedTrie = new BinaryTrieEngine(fs.readFileSync(dictPath));
  }
  return cachedTrie;
}

// Autonomous AI Bot Move Finder
function findBotMove(trie: BinaryTrieEngine, board: BoardMatrix, botRack: RackTile[]): PlacedTile[] | null {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const anchor = board[r][c].tile;
      if (!anchor) continue;

      // Try placing 1 or 2 tiles horizontally to the right of anchor
      if ((c === 0 || board[r][c - 1].tile === null) && c + 1 < 15 && board[r][c + 1].tile === null) {
        for (let i = 0; i < botRack.length; i++) {
          if (c + 2 >= 15 || board[r][c + 2].tile === null) {
            const w2 = `${anchor.letter}${botRack[i].letter}`.toUpperCase();
            if (trie.hasWord(w2)) {
              return [{ row: r, col: c + 1, letter: botRack[i].letter, points: botRack[i].points }];
            }
          }
          for (let j = 0; j < botRack.length; j++) {
            if (i === j) continue;
            if (c + 2 < 15 && board[r][c + 2].tile === null && (c + 3 >= 15 || board[r][c + 3].tile === null)) {
              const w3 = `${anchor.letter}${botRack[i].letter}${botRack[j].letter}`.toUpperCase();
              if (trie.hasWord(w3)) {
                return [
                  { row: r, col: c + 1, letter: botRack[i].letter, points: botRack[i].points },
                  { row: r, col: c + 2, letter: botRack[j].letter, points: botRack[j].points },
                ];
              }
            }
          }
        }
      }

      // Try placing 1 tile vertically below anchor
      if ((r === 0 || board[r - 1][c].tile === null) && r + 1 < 15 && board[r + 1][c].tile === null) {
        if (r + 2 >= 15 || board[r + 2][c].tile === null) {
          for (let i = 0; i < botRack.length; i++) {
            const w2 = `${anchor.letter}${botRack[i].letter}`.toUpperCase();
            if (trie.hasWord(w2)) {
              return [{ row: r + 1, col: c, letter: botRack[i].letter, points: botRack[i].points }];
            }
          }
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { matchId, playerId, placedTiles, decisionTimeMs } = (await req.json()) as {
      matchId: string;
      playerId: string;
      placedTiles: PlacedTile[];
      decisionTimeMs: number;
    };

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { playerTwo: true, playerOne: true },
    });
    if (!match || match.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Active match not found' }, { status: 404 });
    }

    const trie = getTrie();
    const isP1 = match.playerOneId === playerId;
    const boardState = match.boardState as unknown as BoardMatrix;
    const currentStreak = isP1 ? match.p1SharkStreak : match.p2SharkStreak;
    const isFirstTurn = match.currentTurnNum === 1;

    const validation = validateAndScoreMove(trie, {
      boardState,
      placedTiles,
      decisionTimeMs,
      currentStreak,
      isFirstTurn,
    });

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }

    for (const t of placedTiles) {
      boardState[t.row][t.col].tile = t;
      boardState[t.row][t.col].bonusUsed = true;
    }

    const tileBag = [...(match.tileBag as unknown as RackTile[])];
    const currentRack = [...((isP1 ? match.p1Rack : match.p2Rack) as unknown as RackTile[])];
    for (const p of placedTiles) {
      const idx = currentRack.findIndex((r) => r.letter.toUpperCase() === p.letter.toUpperCase());
      if (idx !== -1) currentRack.splice(idx, 1);
    }
    const drawn = tileBag.splice(0, Math.max(0, 7 - currentRack.length));
    const updatedPlayerRack = [...currentRack, ...drawn];

    let p1Score = isP1 ? match.p1Score + validation.finalScore! : match.p1Score;
    let p2Score = !isP1 ? match.p2Score + validation.finalScore! : match.p2Score;
    let p2Rack = (match.p2Rack as unknown as RackTile[]);
    let botMoveSummary: { word: string; score: number } | null = null;

    // Trigger AI Bot counter-move if playing against APEX_BOT_AI
    const isVsBot = match.playerTwo?.username === 'APEX_BOT_AI';
    if (isVsBot && isP1) {
      const botTiles = findBotMove(trie, boardState, p2Rack);
      if (botTiles) {
        const botVal = validateAndScoreMove(trie, {
          boardState,
          placedTiles: botTiles,
          decisionTimeMs: 12000,
          currentStreak: 0,
          isFirstTurn: false,
        });
        if (botVal.isValid && botVal.finalScore !== undefined) {
          for (const bt of botTiles) {
            boardState[bt.row][bt.col].tile = bt;
            boardState[bt.row][bt.col].bonusUsed = true;
          }
          const nextBotRack = [...p2Rack];
          for (const bt of botTiles) {
            const idx = nextBotRack.findIndex((r) => r.letter.toUpperCase() === bt.letter.toUpperCase());
            if (idx !== -1) nextBotRack.splice(idx, 1);
          }
          const botDrawn = tileBag.splice(0, Math.max(0, 7 - nextBotRack.length));
          p2Rack = [...nextBotRack, ...botDrawn];
          p2Score += botVal.finalScore;
          botMoveSummary = { word: botVal.primaryWord!, score: botVal.finalScore };
        }
      }
    }

    // Complete match after 5 player rounds (or if bag is empty)
    const nextTurnNum = match.currentTurnNum + 1;
    const isMatchOver = nextTurnNum > 5 || tileBag.length === 0;
    const winnerId = isMatchOver
      ? p1Score >= p2Score
        ? match.playerOneId
        : match.playerTwoId
      : null;

    const eloDelta = isMatchOver ? (p1Score >= p2Score ? 24 : -12) : 0;

    const updatedMatch = await prisma.$transaction(async (tx) => {
      await tx.turn.create({
        data: {
          matchId: match.id,
          playerId,
          turnNumber: match.currentTurnNum,
          wordPlayed: validation.primaryWord!,
          placedTiles: placedTiles as any,
          baseScore: validation.baseScore!,
          sharkMultiplier: validation.sharkMultiplier!,
          trapPenalty: validation.trapPenalty!,
          finalScore: validation.finalScore!,
          decisionTimeMs,
        },
      });

      if (botMoveSummary && match.playerTwoId) {
        await tx.turn.create({
          data: {
            matchId: match.id,
            playerId: match.playerTwoId,
            turnNumber: match.currentTurnNum,
            wordPlayed: botMoveSummary.word,
            placedTiles: [] as any,
            baseScore: botMoveSummary.score,
            sharkMultiplier: 1.0,
            trapPenalty: 0,
            finalScore: botMoveSummary.score,
            decisionTimeMs: 4000,
          },
        });
      }

      if (isMatchOver) {
        await tx.user.update({
          where: { id: match.playerOneId },
          data: {
            eloRating: { increment: eloDelta },
            gamesPlayed: { increment: 1 },
            gamesWon: p1Score >= p2Score ? { increment: 1 } : undefined,
          },
        });
      }

      return tx.match.update({
        where: { id: match.id },
        data: {
          status: isMatchOver ? 'COMPLETED' : 'ACTIVE',
          winnerId,
          boardState: boardState as any,
          tileBag: tileBag as any,
          p1Rack: isP1 ? (updatedPlayerRack as any) : (match.p1Rack as any),
          p2Rack: isVsBot ? (p2Rack as any) : !isP1 ? (updatedPlayerRack as any) : (match.p2Rack as any),
          p1Score,
          p2Score,
          p1SharkStreak: isP1 ? validation.nextStreak! : match.p1SharkStreak,
          p2SharkStreak: !isP1 ? validation.nextStreak! : match.p2SharkStreak,
          currentTurnNum: nextTurnNum,
          turnExpiresAt: new Date(Date.now() + 45_000),
        },
      });
    });

    return NextResponse.json({
      validation,
      botMove: botMoveSummary,
      eloDelta,
      match: updatedMatch,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
