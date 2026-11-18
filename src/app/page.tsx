'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { BinaryTrieEngine } from '@/engine/trieEngine';
import { BoardMatrix, PlacedTile, RackTile } from '@/engine/types';

function playSound(type: 'pop' | 'success' | 'error' | 'hint' | 'shuffle') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'shuffle') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(480, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'hint') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.5, now + 0.3);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Ignore autoplay restrictions
  }
}

interface HintSuggestion {
  word: string;
  placements: (PlacedTile & { rackId: string })[];
}

export default function MindsetKidsArena() {
  const [username, setUsername] = useState('');
  const [user, setUser] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [board, setBoard] = useState<BoardMatrix | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [selectedRackIdx, setSelectedRackIdx] = useState<number | null>(null);
  const [draftTiles, setDraftTiles] = useState<(PlacedTile & { rackId: string })[]>([]);
  const [mascotSpeech, setMascotSpeech] = useState({
    animal: '🦁',
    name: 'Captain Leo',
    text: 'Pick a cool explorer name to jump into Word Island!',
  });
  const [timeLeft, setTimeLeft] = useState(45);
  const [turnStartMs, setTurnStartMs] = useState<number>(0);
  const [soundOn, setSoundOn] = useState(true);
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(null);
  const [eagleHints, setEagleHints] = useState<HintSuggestion[]>([]);
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

  const liveWordPreview = useMemo(() => {
    if (!board || draftTiles.length === 0) return null;
    const sorted = [...draftTiles].sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
    const candidate = sorted.map((t) => t.letter).join('');
    const isKnown = candidate.length >= 2 && trieRef.current ? trieRef.current.hasWord(candidate) : false;
    return { word: candidate, isKnown };
  }, [board, draftTiles]);

  function triggerSound(type: 'pop' | 'success' | 'error' | 'hint' | 'shuffle') {
    if (soundOn) playSound(type);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    triggerSound('pop');
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setMascotSpeech({
        animal: '🦈',
        name: 'Speedy Shark',
        text: `Awesome to meet you, ${data.user.username}! Ready for a word adventure?`,
      });
    }
  }

  async function startMatch(vsBot: boolean) {
    if (!user) return;
    triggerSound('pop');
    setMascotSpeech({
      animal: '🦊',
      name: 'Clever Fox',
      text: 'Building your treasure board with secret Fox Traps and Star bonuses...',
    });

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
      setEagleHints([]);
      setTimeLeft(45);
      setTurnStartMs(Date.now());
      setMascotSpeech({
        animal: '⭐',
        name: 'Star Guide',
        text: 'Tap a letter tile below, then tap the middle Gold Star (★) — or tap 🦅 Hint! for ideas!',
      });
    }
  }

  function handleCellClick(r: number, c: number) {
    if (!board) return;

    const existingDraftIdx = draftTiles.findIndex((d) => d.row === r && d.col === c);
    if (existingDraftIdx !== -1) {
      triggerSound('pop');
      const updated = [...draftTiles];
      updated.splice(existingDraftIdx, 1);
      setDraftTiles(updated);
      return;
    }

    if (selectedRackIdx === null || board[r][c].tile) return;

    const chosen = rack[selectedRackIdx];
    if (!chosen) return;

    triggerSound('pop');
    setDraftTiles([...draftTiles, { row: r, col: c, letter: chosen.letter, points: chosen.points, rackId: chosen.id }]);

    const nextUsed = new Set([...draftTiles.map((d) => d.rackId), chosen.id]);
    const nextIdx = rack.findIndex((t, i) => i > selectedRackIdx && !nextUsed.has(t.id));
    const fallbackIdx = rack.findIndex((t) => !nextUsed.has(t.id));
    setSelectedRackIdx(nextIdx !== -1 ? nextIdx : fallbackIdx !== -1 ? fallbackIdx : null);
  }

  function recallTiles() {
    triggerSound('shuffle');
    setDraftTiles([]);
    setSelectedRackIdx(0);
  }

  function shuffleRack() {
    triggerSound('shuffle');
    const copy = [...rack];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setRack(copy);
    setSelectedRackIdx(null);
  }

  // Board-Aware Eagle Hint Finder: finds valid placements on the Star (Turn 1) or hooked to existing board letters!
  function askEagleForHint() {
    if (!trieRef.current || !board || rack.length === 0) return;
    triggerSound('hint');

    const suggestions: HintSuggestion[] = [];
    const seenWords = new Set<string>();
    const isBoardEmpty = board[7][7].tile === null;

    if (isBoardEmpty) {
      // Turn 1: Find words from the 7-tile rack and place horizontally across (7,7)
      const searchRack = (chosen: RackTile[], usedMask: number) => {
        if (chosen.length >= 2) {
          const word = chosen.map((t) => t.letter.toUpperCase()).join('');
          if (!seenWords.has(word) && trieRef.current!.hasWord(word)) {
            seenWords.add(word);
            const placements = chosen.map((tile, idx) => ({
              row: 7,
              col: 7 + idx,
              letter: tile.letter,
              points: tile.points,
              rackId: tile.id,
            }));
            suggestions.push({ word, placements });
          }
        }
        if (chosen.length >= 5 || suggestions.length >= 6) return;
        for (let i = 0; i < rack.length; i++) {
          if ((usedMask & (1 << i)) === 0) {
            searchRack([...chosen, rack[i]], usedMask | (1 << i));
          }
        }
      };
      searchRack([], 0);
    } else {
      // Subsequent turns: Try hooking 1–3 rack letters after or before existing tiles on the board
      for (let r = 0; r < 15 && suggestions.length < 5; r++) {
        for (let c = 0; c < 15 && suggestions.length < 5; c++) {
          const anchorTile = board[r][c].tile;
          if (!anchorTile) continue;

          // Try extending horizontally to the right of (r, c)
          if (c > 0 && board[r][c - 1].tile === null) {
            for (let i = 0; i < rack.length; i++) {
              if (c + 1 < 15 && board[r][c + 1].tile === null && (c + 2 >= 15 || board[r][c + 2].tile === null)) {
                const word2 = `${anchorTile.letter}${rack[i].letter}`.toUpperCase();
                if (!seenWords.has(word2) && trieRef.current!.hasWord(word2)) {
                  seenWords.add(word2);
                  suggestions.push({
                    word: word2,
                    placements: [{ row: r, col: c + 1, letter: rack[i].letter, points: rack[i].points, rackId: rack[i].id }],
                  });
                }
              }
              // Try 2 letters after anchor
              for (let j = 0; j < rack.length; j++) {
                if (i === j) continue;
                if (c + 2 < 15 && board[r][c + 1].tile === null && board[r][c + 2].tile === null && (c + 3 >= 15 || board[r][c + 3].tile === null)) {
                  const word3 = `${anchorTile.letter}${rack[i].letter}${rack[j].letter}`.toUpperCase();
                  if (!seenWords.has(word3) && trieRef.current!.hasWord(word3)) {
                    seenWords.add(word3);
                    suggestions.push({
                      word: word3,
                      placements: [
                        { row: r, col: c + 1, letter: rack[i].letter, points: rack[i].points, rackId: rack[i].id },
                        { row: r, col: c + 2, letter: rack[j].letter, points: rack[j].points, rackId: rack[j].id },
                      ],
                    });
                  }
                }
              }
            }
          }

          // Try extending vertically below (r, c)
          if (r > 0 && board[r - 1][c].tile === null) {
            for (let i = 0; i < rack.length; i++) {
              if (r + 1 < 15 && board[r + 1][c].tile === null && (r + 2 >= 15 || board[r + 2][c].tile === null)) {
                const word2 = `${anchorTile.letter}${rack[i].letter}`.toUpperCase();
                if (!seenWords.has(word2) && trieRef.current!.hasWord(word2)) {
                  seenWords.add(word2);
                  suggestions.push({
                    word: word2,
                    placements: [{ row: r + 1, col: c, letter: rack[i].letter, points: rack[i].points, rackId: rack[i].id }],
                  });
                }
              }
            }
          }
        }
      }
    }

    const topHints = suggestions.sort((a, b) => b.word.length - a.word.length).slice(0, 4);
    setEagleHints(topHints);
    setMascotSpeech({
      animal: '🦅',
      name: 'Professor Eagle',
      text:
        topHints.length > 0
          ? `I spotted ${topHints.length} playable words! Tap any purple hint pill below to place it on the board!`
          : 'No easy match right now — tap 🔀 Mix Letters or try building off a different letter!',
    });
  }

  function applyHint(hint: HintSuggestion) {
    triggerSound('pop');
    setDraftTiles(hint.placements);
    setSelectedRackIdx(null);
    setMascotSpeech({
      animal: '🦅',
      name: 'Professor Eagle',
      text: `"${hint.word}" is placed on the board! Tap ✅ Play Word! to score your points!`,
    });
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
      triggerSound('error');
      setMascotSpeech({
        animal: '🐜',
        name: 'Helper Ant',
        text: `Oops! ${data.error} Tap your yellow tiles or click 🦅 Hint! for help!`,
      });
      return;
    }

    triggerSound('success');
    const v = data.validation;
    setMatch(data.match);
    setBoard(data.match.boardState);
    setRack(data.match.playerOneId === user.id ? data.match.p1Rack : data.match.p2Rack);
    setDraftTiles([]);
    setEagleHints([]);
    setTimeLeft(45);
    setTurnStartMs(Date.now());

    setCelebrationBanner(`🎉 +${v.finalScore} STARS! "${v.primaryWord}"`);
    setTimeout(() => setCelebrationBanner(null), 3000);

    setMascotSpeech({
      animal: v.nextStreak > 0 ? '🦈' : '🦅',
      name: v.nextStreak > 0 ? 'Speedy Shark' : 'Professor Eagle',
      text:
        v.nextStreak > 0
          ? `SUPER FAST! "${v.primaryWord}" earned +${v.finalScore} points with a ${v.sharkMultiplier}x Shark Speed Boost!`
          : `Great spelling! "${v.primaryWord}" scored +${v.finalScore} points!`,
    });
  }

  const usedRackIds = new Set(draftTiles.map((d) => d.rackId));
  const timerPercent = Math.max(5, Math.round((timeLeft / 45) * 100));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-900 via-indigo-950 to-slate-950 text-white p-3 sm:p-5 flex flex-col items-center select-none">
      {celebrationBanner && (
        <div className="fixed top-6 z-50 animate-bounce bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 font-black text-lg sm:text-2xl px-6 py-3 rounded-full shadow-2xl border-4 border-white">
          {celebrationBanner}
        </div>
      )}

      <header className="max-w-3xl w-full flex flex-wrap items-center justify-between gap-2 mb-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">🏝️</span>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-wide text-amber-300">
              5-Mindset Word Island
            </h1>
            <p className="text-[11px] text-sky-200 font-medium">
              🦈 Shark • 🦅 Eagle • 🦬 Bison • 🦊 Fox • 🐜 Ant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition"
          >
            {soundOn ? '🔊 Sound ON' : '🔇 Muted'}
          </button>
          {user && (
            <div className="flex items-center gap-2 text-xs bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 rounded-xl font-bold text-emerald-200">
              <span>Explorer {user.username}</span>
              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">⭐ {user.eloRating}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl w-full flex items-center gap-3 bg-gradient-to-r from-indigo-600/60 to-purple-600/60 border-2 border-indigo-400/50 rounded-2xl p-3 mb-4 shadow-xl">
        <div className="text-4xl sm:text-5xl bg-white/15 p-2 rounded-2xl shadow-inner shrink-0">
          {mascotSpeech.animal}
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-amber-300">
            {mascotSpeech.name} says:
          </div>
          <p className="text-sm sm:text-base font-semibold text-white leading-snug">
            {mascotSpeech.text}
          </p>
        </div>
      </div>

      {!user ? (
        <form
          onSubmit={handleLogin}
          className="flex flex-col sm:flex-row gap-3 mt-6 bg-white/10 p-6 rounded-3xl border border-white/20 shadow-2xl"
        >
          <input
            type="text"
            required
            placeholder="Type your Explorer Name..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-5 py-3 rounded-2xl bg-slate-900/90 border-2 border-sky-400 text-white text-base font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-base shadow-lg border-b-4 border-orange-700 active:translate-y-0.5 transition"
          >
            🚀 Start Adventure!
          </button>
        </form>
      ) : !match ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 max-w-xl w-full">
          <button
            onClick={() => startMatch(true)}
            className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-gradient-to-b from-emerald-400 to-teal-600 hover:from-emerald-300 hover:to-teal-500 text-slate-950 font-black shadow-xl border-b-4 border-teal-800 active:translate-y-0.5 transition"
          >
            <span className="text-4xl">🤖</span>
            <span className="text-lg">Play vs Friendly Bot</span>
            <span className="text-xs font-bold text-slate-900/80">Practice spelling & earn Shark boosts!</span>
          </button>
          <button
            onClick={() => startMatch(false)}
            className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-gradient-to-b from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-black shadow-xl border-b-4 border-blue-800 active:translate-y-0.5 transition"
          >
            <span className="text-4xl">🌍</span>
            <span className="text-lg">Play with a Friend</span>
            <span className="text-xs font-bold text-sky-100">Join the live Word Island queue!</span>
          </button>
        </div>
      ) : (
        board && (
          <div className="flex flex-col items-center gap-3 w-full max-w-3xl">
            <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-white/15">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏅</span>
                <span className="text-sm font-bold text-sky-200">Your Stars:</span>
                <span className="text-2xl font-black text-amber-400">{match.p1Score}</span>
                {match.p1SharkStreak > 0 && (
                  <span className="text-xs bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full animate-pulse">
                    🦈 x{(1 + match.p1SharkStreak * 0.1).toFixed(1)} Speed!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <span className="text-sm">🦬</span>
                <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                  <div
                    style={{ width: `${timerPercent}%` }}
                    className={`h-full transition-all duration-1000 rounded-full ${
                      timeLeft > 20
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                        : timeLeft > 10
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-amber-200 w-8">{timeLeft}s</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm font-bold text-purple-300">
                <span>🤖 Bot:</span>
                <span className="text-lg font-black">{match.p2Score}</span>
              </div>
            </div>

            {liveWordPreview && (
              <div
                className={`px-4 py-1 rounded-full text-xs font-black tracking-wide border transition ${
                  liveWordPreview.isKnown
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                }`}
              >
                🐜 Ant Scanner: &ldquo;{liveWordPreview.word}&rdquo;{' '}
                {liveWordPreview.isKnown ? '✅ Awesome Word!' : '⏳ Keep adding letters...'}
              </div>
            )}

            <div
              style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
              className="grid gap-0.5 sm:gap-1 bg-indigo-950/90 p-2 rounded-2xl shadow-2xl border-2 border-indigo-400/40"
            >
              {board.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const draft = draftTiles.find((d) => d.row === rIdx && d.col === cIdx);
                  const activeTile = draft || cell.tile;
                  const bonusStyles: Record<string, string> = {
                    STAR: 'bg-amber-400 text-slate-950 animate-pulse shadow-inner',
                    TW: 'bg-rose-500/80 text-white',
                    DW: 'bg-pink-400/70 text-slate-950',
                    TL: 'bg-sky-500/80 text-white',
                    DL: 'bg-teal-400/70 text-slate-950',
                    TRAP: 'bg-purple-700/80 text-amber-200 border border-purple-400/50',
                    NONE: 'bg-slate-800/90 hover:bg-slate-700 text-slate-500',
                  };

                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      className={`w-6 h-6 sm:w-9 sm:h-9 flex items-center justify-center text-[11px] sm:text-sm font-black rounded-md sm:rounded-lg transition-transform active:scale-90 ${
                        activeTile
                          ? draft
                            ? 'bg-yellow-300 text-slate-950 border-b-2 border-amber-600 scale-105 shadow-md'
                            : 'bg-amber-100 text-slate-950 border-b-2 border-amber-400'
                          : bonusStyles[cell.bonus]
                      }`}
                    >
                      {activeTile
                        ? activeTile.letter
                        : cell.bonus === 'STAR'
                        ? '★'
                        : cell.bonus === 'TRAP'
                        ? '🦊'
                        : cell.bonus === 'NONE'
                        ? ''
                        : cell.bonus}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-1 bg-amber-950/60 px-4 py-3 rounded-2xl border-2 border-amber-700/60 shadow-inner">
              {rack.map((tile, idx) => {
                const isUsed = usedRackIds.has(tile.id);
                const isSelected = selectedRackIdx === idx;
                return (
                  <button
                    key={tile.id}
                    disabled={isUsed}
                    onClick={() => {
                      triggerSound('pop');
                      setSelectedRackIdx(isSelected ? null : idx);
                    }}
                    className={`w-11 h-14 sm:w-13 sm:h-15 rounded-xl font-black text-xl sm:text-2xl flex flex-col items-center justify-center transition-all ${
                      isUsed
                        ? 'opacity-20 bg-slate-800 scale-90'
                        : isSelected
                        ? 'bg-yellow-300 text-slate-950 -translate-y-2 scale-110 ring-4 ring-sky-400 border-b-4 border-amber-600 shadow-xl'
                        : 'bg-amber-100 hover:bg-amber-200 text-slate-950 border-b-4 border-amber-500 shadow-md'
                    }`}
                  >
                    <span>{tile.letter}</span>
                    <span className="text-[10px] font-bold text-amber-800 leading-none">{tile.points}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-2.5 mt-1">
              <button
                onClick={shuffleRack}
                className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-extrabold border-b-4 border-sky-800 active:translate-y-0.5 transition"
              >
                🔀 Mix Letters
              </button>
              <button
                onClick={recallTiles}
                className="px-4 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-xs sm:text-sm font-extrabold border-b-4 border-slate-900 active:translate-y-0.5 transition"
              >
                ↩️ Take Back
              </button>
              <button
                onClick={askEagleForHint}
                className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-extrabold border-b-4 border-purple-900 active:translate-y-0.5 transition animate-pulse"
              >
                🦅 Hint!
              </button>
              <button
                onClick={submitWord}
                disabled={draftTiles.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 disabled:opacity-40 text-slate-950 text-sm sm:text-base font-black border-b-4 border-green-800 shadow-lg active:translate-y-0.5 transition"
              >
                ✅ Play Word!
              </button>
            </div>

            {eagleHints.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {eagleHints.map((hint) => (
                  <button
                    key={hint.word}
                    onClick={() => applyHint(hint)}
                    className="px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 border-2 border-purple-300 text-xs sm:text-sm font-black text-white shadow-md transition active:scale-95"
                  >
                    💡 Place &ldquo;{hint.word}&rdquo;
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </main>
  );
}
