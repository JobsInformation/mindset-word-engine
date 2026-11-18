import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/prisma';
import { BinaryTrieEngine } from '@/engine/trieEngine';
import { validateAndScoreMove } from '@/engine/boardValidator';
import { BoardMatrix, PlacedTile } from '@/engine/types';

let cachedTrie: BinaryTrieEngine | null = null;
function getTrie(): BinaryTrieEngine {
  if (!cachedTrie) {
    const dictPath = path.join(process.cwd(), 'public', 'dict.bin');
    cachedTrie = new BinaryTrieEngine(fs.readFileSync(dictPath));
  }
  return cachedTrie;
}

export async function POST(req: NextRequest) {
  try {
    const { matchId, playerId, placedTiles, decisionTimeMs } = (await req.json()) as {
      matchId: string;
      playerId: string;
      placedTiles: PlacedTile[];
      decisionTimeMs: number;
    };

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Active match not found' }, { status: 404 });
    }

    const isP1 = match.playerOneId === playerId;
    const boardState = match.boardState as unknown as BoardMatrix;
    const currentStreak = isP1 ? match.p1SharkStreak : match.p2SharkStreak;
    const isFirstTurn = match.currentTurnNum === 1;

    const validation = validateAndScoreMove(getTrie(), {
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

    const tileBag = match.tileBag as any[];
    const currentRack = (isP1 ? match.p1Rack : match.p2Rack) as any[];
    const remaining = [...currentRack];
    for (const p of placedTiles) {
      const idx = remaining.findIndex((r) => r.letter.toUpperCase() === p.letter.toUpperCase());
      if (idx !== -1) remaining.splice(idx, 1);
    }
    const drawn = tileBag.splice(0, Math.max(0, 7 - remaining.length));
    const updatedRack = [...remaining, ...drawn];

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

      return tx.match.update({
        where: { id: match.id },
        data: {
          boardState: boardState as any,
          tileBag: tileBag as any,
          p1Rack: isP1 ? (updatedRack as any) : (match.p1Rack as any),
          p2Rack: !isP1 ? (updatedRack as any) : (match.p2Rack as any),
          p1Score: isP1 ? match.p1Score + validation.finalScore! : match.p1Score,
          p2Score: !isP1 ? match.p2Score + validation.finalScore! : match.p2Score,
          p1SharkStreak: isP1 ? validation.nextStreak! : match.p1SharkStreak,
          p2SharkStreak: !isP1 ? validation.nextStreak! : match.p2SharkStreak,
          currentTurnNum: match.currentTurnNum + 1,
          turnExpiresAt: new Date(Date.now() + 45_000),
        },
      });
    });

    return NextResponse.json({ validation, match: updatedMatch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
