import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { matchId, playerId } = await req.json();
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Active match not found' }, { status: 404 });
    }

    const isP1 = match.playerOneId === playerId;
    const tileBag = [...(match.tileBag as any[])];
    const currentRack = [...((isP1 ? match.p1Rack : match.p2Rack) as any[])];

    if (tileBag.length < 7) {
      return NextResponse.json({ error: 'Not enough tiles left in the treasure bag to swap!' }, { status: 400 });
    }

    const newRack = tileBag.splice(0, 7);
    tileBag.push(...currentRack);
    // Shuffle bag
    for (let i = tileBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileBag[i], tileBag[j]] = [tileBag[j], tileBag[i]];
    }

    const updated = await prisma.match.update({
      where: { id: match.id },
      data: {
        tileBag: tileBag as any,
        p1Rack: isP1 ? (newRack as any) : (match.p1Rack as any),
        p2Rack: !isP1 ? (newRack as any) : (match.p2Rack as any),
        p1SharkStreak: isP1 ? 0 : match.p1SharkStreak,
        p2SharkStreak: !isP1 ? 0 : match.p2SharkStreak,
      },
    });

    return NextResponse.json({ match: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
