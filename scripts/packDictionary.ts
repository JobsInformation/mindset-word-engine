import * as fs from 'fs';
import * as path from 'path';

const STARTER_WORDS = [
  'SHARK', 'EAGLE', 'BISON', 'FOX', 'ANT', 'WORD', 'PLAY', 'GAME', 'FAST', 'CODE',
  'MIND', 'STAR', 'TRAP', 'BLITZ', 'SCORE', 'BOARD', 'TILE', 'RACK', 'WIN', 'ACE',
  'APEX', 'BOLD', 'CLAW', 'DART', 'EDGE', 'FLOW', 'GRIT', 'HUNT', 'IRON', 'JOLT',
  'KEEN', 'LEAP', 'MOVE', 'NEST', 'ORBIT', 'PACK', 'QUEST', 'RUSH', 'SOAR', 'TRACK',
  'UNIT', 'VIBE', 'WAVE', 'ZERO', 'ZONE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM',
  'AIR', 'ALL', 'AND', 'ANY', 'ARC', 'ARE', 'ARM', 'ART', 'ASK', 'ATE', 'AWE', 'AXE',
  'BAD', 'BAG', 'BAN', 'BAR', 'BAT', 'BAY', 'BED', 'BEE', 'BET', 'BIG', 'BIN', 'BIT',
  'BOW', 'BOX', 'BOY', 'BUD', 'BUG', 'BUS', 'BUT', 'BUY', 'CAN', 'CAP', 'CAR', 'CAT',
  'COB', 'COD', 'COG', 'COP', 'COT', 'COW', 'CRY', 'CUB', 'CUP', 'CUT', 'DAB', 'DAM',
  'DAY', 'DEN', 'DEW', 'DIG', 'DIM', 'DIP', 'DOG', 'DOT', 'DRY', 'DUB', 'DUG', 'EAR',
  'EAT', 'EEL', 'EGG', 'END', 'ERA', 'EVE', 'EYE', 'FAN', 'FAR', 'FAT', 'FED', 'FEE',
  'FEW', 'FIG', 'FIN', 'FIT', 'FIX', 'FLY', 'FOE', 'FOG', 'FOR', 'FUN', 'FUR', 'GAP',
  'GAS', 'GEM', 'GET', 'GIG', 'GOD', 'GOT', 'GUM', 'GUN', 'GUT', 'GUY', 'GYM', 'HAD',
  'HAM', 'HAS', 'HAT', 'HEN', 'HER', 'HID', 'HIM', 'HIP', 'HIS', 'HIT', 'HOG', 'HOP',
  'HOT', 'HOW', 'HUB', 'HUG', 'HUT', 'ICE', 'ICY', 'ILL', 'INK', 'INN', 'ION', 'IVY',
  'JAM', 'JAR', 'JAW', 'JET', 'JOB', 'JOG', 'JOY', 'JUG', 'KEY', 'KID', 'KIN', 'KIT',
  'LAB', 'LAD', 'LAG', 'LAP', 'LAW', 'LAY', 'LED', 'LEG', 'LET', 'LID', 'LIE', 'LIP',
  'LIT', 'LOG', 'LOT', 'LOW', 'MAD', 'MAN', 'MAP', 'MAT', 'MAY', 'MEN', 'MET', 'MIX',
  'MOB', 'MOP', 'MUD', 'MUG', 'NAP', 'NET', 'NEW', 'NOD', 'NOR', 'NOT', 'NOW', 'NUT',
  'OAK', 'OAR', 'OAT', 'ODD', 'OFF', 'OIL', 'OLD', 'ONE', 'OPT', 'ORB', 'ORE', 'OUR',
  'OUT', 'OWL', 'OWN', 'PAD', 'PAN', 'PAT', 'PAW', 'PAY', 'PEA', 'PEN', 'PET', 'PIE',
  'PIG', 'PIN', 'PIT', 'POD', 'POP', 'POT', 'PRO', 'PUB', 'PUN', 'PUP', 'PUT', 'RAG',
  'RAM', 'RAN', 'RAP', 'RAT', 'RAW', 'RAY', 'RED', 'RIB', 'RID', 'RIM', 'RIP', 'ROB',
  'ROD', 'ROT', 'ROW', 'RUB', 'RUG', 'RUN', 'SAD', 'SAT', 'SAW', 'SAY', 'SEA', 'SEE',
  'SET', 'SEW', 'SHE', 'SHY', 'SIN', 'SIP', 'SIT', 'SIX', 'SKI', 'SKY', 'SLY', 'SOB',
  'SON', 'SOW', 'SPY', 'SUM', 'SUN', 'TAB', 'TAG', 'TAN', 'TAP', 'TAR', 'TAX', 'TEA',
  'TEN', 'THE', 'TIE', 'TIN', 'TIP', 'TOE', 'TON', 'TOO', 'TOP', 'TOW', 'TOY', 'TRY',
  'TUB', 'TUG', 'TWO', 'USE', 'VAN', 'VAT', 'VET', 'VOW', 'WAG', 'WAR', 'WAX', 'WAY',
  'WEB', 'WED', 'WET', 'WHO', 'WHY', 'WIG', 'WIT', 'WOE', 'WON', 'YES', 'YET', 'YOU', 'ZAP', 'ZIP', 'ZOO'
];

class BuildNode {
  children = new Map<number, BuildNode>();
  isEnd = false;
  id = 0;
}

const wordSet = new Set<string>(STARTER_WORDS);
const root = new BuildNode();
const allNodes: BuildNode[] = [root];

for (const word of wordSet) {
  let curr = root;
  for (let i = 0; i < word.length; i++) {
    const charIdx = word.charCodeAt(i) - 65;
    let next = curr.children.get(charIdx);
    if (!next) {
      next = new BuildNode();
      next.id = allNodes.length;
      allNodes.push(next);
      curr.children.set(charIdx, next);
    }
    curr = next;
  }
  curr.isEnd = true;
}

const records: number[] = [];
const nodeOffsets = new Int32Array(allNodes.length);

for (const node of allNodes) {
  nodeOffsets[node.id] = records.length;
  let mask = node.isEnd ? (1 << 26) : 0;
  const sortedChars = Array.from(node.children.keys()).sort((a, b) => a - b);
  for (const c of sortedChars) mask |= (1 << c);
  records.push(mask);
  for (const c of sortedChars) records.push(node.children.get(c)!.id);
}

for (const node of allNodes) {
  const offset = nodeOffsets[node.id];
  const sortedChars = Array.from(node.children.keys()).sort((a, b) => a - b);
  for (let i = 0; i < sortedChars.length; i++) {
    records[offset + 1 + i] = nodeOffsets[node.children.get(sortedChars[i])!.id];
  }
}

const outPath = path.join(process.cwd(), 'public', 'dict.bin');
fs.writeFileSync(outPath, Buffer.from(Uint32Array.from(records).buffer));
console.log(`Packed ${wordSet.size} words into ${outPath}`);
