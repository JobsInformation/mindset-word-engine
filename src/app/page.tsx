'use client';

import React, { useEffect, useState, useRef } from 'react';
import { BinaryTrieEngine } from '@/engine/trieEngine';
import { BoardMatrix, PlacedTile, RackTile } from '@/engine/types';

export default function MindsetWordGame() {
  const [username, setUsername] = useState('');
  const [user, setUser] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [board, setBoard] = useState<BoardMatrix | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [draftTiles, setDraftTiles] = useState<(PlacedTile & { rackId: string })[]>([]);
  const [statusMsg, setStatusMsg] = useState('Enter a username to start playing');
  const [timeLeft, setTimeLeft] = useState(45);
  const [turnStartMs, setTurnStartMs] = useState<number>(0);
  const trieRef = useRef<BinaryTrieEngine | null>(null);

  useEffect(() => {
    fetch('/dict.bin')
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        trieRef.current = new BinaryTrieEngine(buf);
      })
      .catch(() => console.warn('dict.bin not loaded yet'));
  }, []);

  useEffect(() => {
    if (!match || match.status !== 'ACTIVE') return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 45));
    }, 1000);
    return () => clearInterval(interval);
  }, [match]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setStatusMsg(`Welcome ${data.user.username} (Elo: ${data.user.eloRating})`);
    }
  }

  async function startMatch(vsBot: boolean) {
    if (!user) return;
    setStatusMsg(vsBot ? 'Generating Fox Procedural Board...' : 'Searching Elo Matchmaking Queue...');
    const res = await fetch('/api/match/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, mode: 'BLITZ_SIMULTANEOUS', vsBot }),
    });
    const data = await res.json();
    if (data.match) {
      setMatch(data.match);
      setBoard(data.match.boardState);
      setRack(data.match.playerOneId === user.id ? data.match.p1Rack : data.match.p2Rack);
      setDraftTiles([]);
      setTimeLeft(45);
      setTurnStartMs(Date.now());
      setStatusMsg(
        data.status === 'MATCHED'
          ? 'Match Active! Cover the center ★ square first.'
          : 'Waiting for opponent in queue...'
      );
    }
  }

  function handleCellClick(r: number, c: number) {
    if (!board || selectedRackIdx === null) return;
    if (board[r][c].tile || draftTiles.some((d) => d.row === r && d.col === c)) return;

    const chosen = rack[selectedRackIdx];
    if (!chosen) return;

    setDraftTiles([...draftTiles, { row: r, col: c, letter: chosen.letter, points: chosen.points, rackId: chosen.id }]);
    setSelectedRackIdx(null);
  }

  function recallTiles() {
    setDraftTiles([]);
    setSelectedRackIdx(null);
  }

  async function submitWord() {
    if (!match || !user || draftTiles.length === 0) return;
    const decisionTimeMs = Date.now() - turnStartMs;

    const res = await fetch('/api/match/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: match.id,
        playerId: user.id,
        placedTiles: draftTiles,
        decisionTimeMs,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(`❌ ${data.error}`);
      return;
    }

    const v = data.validation;
    setMatch(data.match);
    setBoard(data.match.boardState);
    setRack(data.match.playerOneId === user.id ? data.match.p1Rack : data.match.p2Rack);
    setDraftTiles([]);
    setTimeLeft(45);
    setTurnStartMs(Date.now());
    setStatusMsg(
      `✅ "${v.primaryWord}" (+${v.finalScore} pts | Shark ${v.sharkMultiplier}x | Traps -${v.trapPenalty})`
    );
  }

  const usedRackIds = new Set(draftTiles.map((d) => d.rackId));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col items-center">
      <header className="max-w-3xl w-full flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-400">5-Mindset Word Engine</h1>
          <p className="text-xs text-slate-400">Shark • Eagle • Bison • Fox • Ant</p>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="font-semibold text-emerald-400">{user.username}</span>
            <span>Elo: {user.eloRating}</span>
            {match && <span className="text-amber-300 font-mono">⏱ {timeLeft}s</span>}
          </div>
        )}
      </header>

      <div className="max-w-3xl w-full bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-2 mb-4 text-sm text-center text-cyan-300">
        {statusMsg}
      </div>

      {!user ? (
        <form onSubmit={handleLogin} className="flex gap-2 mt-8">
          <input
            type="text"
            required
            placeholder="Enter Player Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
          >
            Enter Arena
          </button>
        </form>
      ) : !match ? (
        <div className="flex gap-4 mt-8">
          <button
            onClick={() => startMatch(true)}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg"
          >
            ⚡ Bison Blitz vs AI Bot
          </button>
          <button
            onClick={() => startMatch(false)}
            className="px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold shadow-lg"
          >
            🌐 Online Elo Matchmaking
          </button>
        </div>
      ) : (
        board && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6 text-sm font-semibold">
              <div className="bg-slate-900 px-4 py-2 rounded-lg border border-emerald-500/40">
                You: <span className="text-emerald-400 text-lg">{match.p1Score}</span>
                <span className="ml-2 text-xs text-amber-400">🦈 x{(1 + match.p1SharkStreak * 0.1).toFixed(1)}</span>
              </div>
              <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                Opponent: <span className="text-rose-400 text-lg">{match.p2Score}</span>
              </div>
            </div>

            <div
              style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
              className="grid gap-0.5 bg-slate-800 p-1.5 rounded-lg shadow-2xl border border-slate-700"
            >
              {board.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const draft = draftTiles.find((d) => d.row === rIdx && d.col === cIdx);
                  const activeTile = draft || cell.tile;
                  const bonusColors: Record<string, string> = {
                    STAR: 'bg-amber-500/30 text-amber-300',
                    TW: 'bg-rose-600/40 text-rose-200',
                    DW: 'bg-pink-500/30 text-pink-200',
                    TL: 'bg-sky-600/40 text-sky-200',
                    DL: 'bg-teal-500/30 text-teal-200',
                    TRAP: 'bg-purple-900/60 text-purple-300 border border-purple-500/40',
                    NONE: 'bg-slate-900 text-slate-600',
                  };

                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold rounded-sm transition ${
                        activeTile
                          ? draft
                            ? 'bg-amber-300 text-slate-950 ring-2 ring-white'
                            : 'bg-amber-100 text-slate-950'
                          : bonusColors[cell.bonus]
                      }`}
                    >
                      {activeTile
                        ? activeTile.letter
                        : cell.bonus === 'STAR'
                        ? '★'
                        : cell.bonus === 'NONE'
                        ? ''
                        : cell.bonus}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 mt-1">
              {rack.map((tile, idx) => {
                const isUsed = usedRackIds.has(tile.id);
                const isSelected = selectedRackIdx === idx;
                return (
                  <button
                    key={tile.id}
                    disabled={isUsed}
                    onClick={() => setSelectedRackIdx(isSelected ? null : idx)}
                    className={`w-10 h-12 rounded-lg font-extrabold text-lg flex flex-col items-center justify-center shadow transition ${
                      isUsed
                        ? 'opacity-25 bg-slate-800'
                        : isSelected
                        ? 'bg-amber-400 text-slate-950 -translate-y-1.5 ring-2 ring-white'
                        : 'bg-amber-100 text-slate-900 hover:bg-amber-200'
                    }`}
                  >
                    <span>{tile.letter}</span>
                    <span className="text-[9px] font-normal leading-none">{tile.points}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={recallTiles}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
              >
                Recall Tiles
              </button>
              <button
                onClick={submitWord}
                disabled={draftTiles.length === 0}
                className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-sm font-bold"
              >
                Submit Word
              </button>
            </div>
          </div>
        )
      )}
    </main>
  );
}
