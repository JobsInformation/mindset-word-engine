import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createInitialBoard, createShuffledTileBag } from '@/engine/boardGenerator';

export async function POST(req: NextRequest) {
  try {
    const { userId, mode = 'BLITZ_SIMULTANEOUS', vsBot = false } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!vsBot) {
      const waiting = await prisma.match.findFirst({
        where: { status: 'WAITING', mode, playerOneId: { not: userId } },
        orderBy: { createdAt: 'asc' },
      });

      if (waiting) {
        const active = await prisma.match.update({
          where: { id: waiting.id },
          data: {
            playerTwoId: userId,
            status: 'ACTIVE',
            turnExpiresAt: new Date(Date.now() + 45_000),
          },
        });
        return NextResponse.json({ status: 'MATCHED', match: active });
      }
    }

    const bag = createShuffledTileBag();
    const p1Rack = bag.splice(0, 7);
    const p2Rack = mode === 'BLITZ_SIMULTANEOUS' ? [...p1Rack] : bag.splice(0, 7);

    let botId: string | null = null;
    if (vsBot) {
      let bot = await prisma.user.findUnique({ where: { username: 'APEX_BOT_AI' } });
      if (!bot) {
        bot = await prisma.user.create({
          data: { username: 'APEX_BOT_AI', email: 'bot@mindset.local', eloRating: 1250 },
        });
      }
      botId = bot.id;
    }

    const match = await prisma.match.create({
      data: {
        mode,
        status: vsBot ? 'ACTIVE' : 'WAITING',
        playerOneId: userId,
        playerTwoId: botId,
        boardState: createInitialBoard(true) as any,
        tileBag: bag as any,
        p1Rack: p1Rack as any,
        p2Rack: p2Rack as any,
        activePlayerId: userId,
        turnExpiresAt: new Date(Date.now() + 45_000),
      },
    });

    return NextResponse.json({ status: vsBot ? 'MATCHED' : 'WAITING', match });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
