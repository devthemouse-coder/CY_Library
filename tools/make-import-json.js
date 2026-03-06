const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Input TXT paths (from your attachments)
const inputs = [
  {
    file: String.raw`C:\Users\jmkim1\Downloads\0_인쇄 건(정정 및 추가로 변경)_260228\국내작품1.txt`,
    category: 'kr'
  },
  {
    file: String.raw`C:\Users\jmkim1\Downloads\0_인쇄 건(정정 및 추가로 변경)_260228\영미작품 .txt`,
    category: 'en'
  },
  {
    file: String.raw`C:\Users\jmkim1\Downloads\0_인쇄 건(정정 및 추가로 변경)_260228\유럽,일본작품.txt`,
    category: 'mixed-eu-jp'
  }
];

function toLogicalLines(text) {
  const raw = text.replace(/\r/g, '').split('\n');
  const lines = [];
  let current = '';

  for (const line of raw) {
    const l = line.replace(/\uFEFF/g, '');

    if (!l.trim()) {
      if (current) {
        lines.push(current.trim());
        current = '';
      }
      lines.push('');
      continue;
    }

    // Indented lines are treated as a continuation of the previous line
    if (/^\s+/.test(l) && current) {
      current += ' ' + l.trim();
    } else {
      if (current) lines.push(current.trim());
      current = l.trim();
    }
  }

  if (current) lines.push(current.trim());
  return lines;
}

function splitBlocks(lines) {
  // Split by 2+ consecutive blank lines
  const blocks = [];
  let current = [];
  let emptyStreak = 0;

  for (const line of lines) {
    if (line === '') {
      emptyStreak += 1;
      if (emptyStreak >= 2) {
        if (current.some((x) => x.trim())) blocks.push(current.filter((x) => x.trim()));
        current = [];
      }
      continue;
    }

    emptyStreak = 0;
    current.push(line);
  }

  if (current.some((x) => x.trim())) blocks.push(current.filter((x) => x.trim()));
  return blocks;
}

function uuidFromKey(key) {
  const hex = crypto.createHash('sha1').update(key, 'utf8').digest('hex').slice(0, 32).split('');
  // Make it look like UUID v4-ish
  hex[12] = '4';
  hex[16] = (((parseInt(hex[16], 16) & 0x3) | 0x8) >>> 0).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function parseSegment(seg) {
  const s = String(seg || '').trim();
  if (!s) return [];

  // Handles cases where multiple "author:..." are accidentally glued together
  const matches = [...s.matchAll(/([^:\/]+):/g)];
  if (matches.length === 0) return [];

  const out = [];
  for (let i = 0; i < matches.length; i += 1) {
    const author = matches[i][1].trim();
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : s.length;
    const worksPart = s.slice(start, end).trim();
    if (!author || !worksPart) continue;
    out.push({ author, worksPart });
  }

  return out;
}

function splitTitles(worksPart) {
  return String(worksPart || '')
    .split(',')
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .map((t) => t.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean);
}

const booksByGuid = new Map();
function addBook(category, author, title) {
  const c = category || 'kr';
  const a = String(author || '').trim() || '저자 미상';
  const t = String(title || '').trim();
  if (!t) return;

  const guid = uuidFromKey(`${c}|${a}|${t}`);
  if (booksByGuid.has(guid)) return;

  booksByGuid.set(guid, {
    guid,
    category: c,
    title: t,
    authors: a,
    finishedAt: '',
    note: '',
    source: 'import'
  });
}

for (const input of inputs) {
  const text = fs.readFileSync(input.file, 'utf8');
  const lines = toLogicalLines(text);

  if (input.category === 'mixed-eu-jp') {
    const blocks = splitBlocks(lines);

    const euBlock = blocks[0] || [];
    const jpBlock = blocks.slice(1).flat();

    for (const [block, cat] of [
      [euBlock, 'eu'],
      [jpBlock, 'jp']
    ]) {
      for (const line of block) {
        for (const seg of line.split('/')) {
          for (const entry of parseSegment(seg)) {
            for (const title of splitTitles(entry.worksPart)) {
              addBook(cat, entry.author, title);
            }
          }
        }
      }
    }

    continue;
  }

  for (const line of lines) {
    if (!line) continue;
    for (const seg of line.split('/')) {
      for (const entry of parseSegment(seg)) {
        for (const title of splitTitles(entry.worksPart)) {
          addBook(input.category, entry.author, title);
        }
      }
    }
  }
}

const payload = {
  app: 'B.CY Library',
  version: 1,
  exportedAt: new Date().toISOString(),
  books: [...booksByGuid.values()]
};

const outName = 'bcy-library-import-20260306.json';
const outPath = path.join(process.cwd(), outName);
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

console.log(`Wrote ${payload.books.length} books -> ${outName}`);
