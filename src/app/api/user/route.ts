import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    const cleanName = (username || `Player_${Math.floor(1000 + Math.random() * 9000)}`).trim();

    let user = await prisma.user.findUnique({ where: { username: cleanName } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: cleanName,
          email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@mindset.local`,
        },
      });
    }
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
