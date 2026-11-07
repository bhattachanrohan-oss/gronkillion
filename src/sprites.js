/* ==========================================================================
   GRONKILLION — pixel sprites
   Every sprite is a small character grid. Each grid is rendered ONCE into an
   SVG <symbol> (one merged path per colour, crispEdges) and reused through
   <use>. Background tiles (crowd, stars) are rendered once to a canvas and
   reused as data URLs. All art is original; nothing is loaded from outside.
   ========================================================================== */
const GRONK_SPRITES = (function () {
  'use strict';

  /* ---------- palette ---------- */
  const PAL = {
    k: '#0A0F1A', // outline
    n: '#22385A', // navy detail
    N: '#101C2E', // deep navy
    w: '#F4F7FF', // white
    c: '#E8F1FF', // cream
    g: '#B9C4D6', // silver
    G: '#7C8BA3', // silver shade
    m: '#3A4458', // facemask
    s: '#D9A066', // skin
    S: '#A86B3C', // skin shade
    j: '#E8EEF8', // jersey
    J: '#A9B6CC', // jersey shade
    p: '#8FA0B8', // pants
    P: '#5E6C84', // pants shade
    b: '#9A5226', // ball
    B: '#5A2A0E', // ball shade
    o: '#FF8A1F', // cone orange
    O: '#C4560A', // cone shade
    y: '#FFC857', // gold
    Y: '#B9861C', // gold shade
    z: '#FFF0B8', // gold highlight
    r: '#FF4D57', // red
    R: '#A3242C', // red shade
    u: '#4DA3FF', // blue
    U: '#2457A8', // blue shade
    q: '#FF9F43', // all-pro orange
    Q: '#B8661A', // all-pro shade
    v: '#B47CFF', // purple
    L: '#A3FF12', // lime
    l: '#5E9A00', // lime shade
    d: '#C9D3E2', // dust light
    D: '#8FA3C4'  // dust shade
  };

  /* ---------- grids ---------- */
  // Player parts are composed so the run cycle shares one upper body.
  const HEAD = [
    '.....kkkkk......',
    '....kgggwwk.....',
    '...kggggggwk....',
    '...kgggggggkk...',
    '...kGgggggkmmk..',
    '...kGggggkssmk..',
    '...kGGgggkssmk..',
    '....kkkkkkkkk...'
  ];
  const BODY = [
    '...kjjjjjjjk....',
    '..kjjjjjjjjjk...',
    '..kJjnnnjjjjk...',
    '..kJjjjnjjjjk...',
    '..kJjjnjjjjjk...',
    '...kJnjjjjjk....'
  ];
  const BODY_DOWN = BODY; // same torso, drawn 1px lower in the bob frames
  const LEGS = {
    stand: [
      '....kkkkkkkk....',
      '....kppppppk....',
      '....kpPkkppk....',
      '....kwwk.kwwk...',
      '....kwwk.kwwk...',
      '...kkkkk.kkkkk..'
    ],
    runA: [
      '...kkkkkkkkk....',
      '..kpppppppppk...',
      '.kPPk...kpppk...',
      'kwwk......kwwk..',
      'kwk........kwwk.',
      'kk..........kkk.'
    ],
    runB: [
      '....kkkkkkkk....',
      '....kpppppppk...',
      '.....kPPkpppk...',
      '.....kwwkkwwk...',
      '......kkkwwk....',
      '.........kkk....'
    ],
    runC: [
      '...kkkkkkkkk....',
      '..kPPPPPkpppk...',
      '..kppk...kPPk...',
      '.kwwk.....kwwk..',
      'kwwk.......kwk..',
      'kkk.........kk..'
    ],
    runD: [
      '....kkkkkkkk....',
      '...kppppppppk...',
      '...kpppkPPk.....',
      '...kwwkkwwk.....',
      '....kwwkkk......',
      '....kkk.........'
    ]
  };
  const BLANK16 = '................';
  const rbFrame = (legs, bob) => (bob ? [BLANK16] : []).concat(HEAD, BODY, legs).concat(bob ? [] : [BLANK16]).slice(0, 20);

  // QB: throwing arm cocked back with the ball, then extended forward.
  const QB_SET = [
    '.....kkkkk......',
    '..kkkgggwwk.....',
    '.kbbkgggggwk....',
    '.kbBkggggggkk...',
    '..kskGgggkkmmk..',
    '..kskGgggkssmk..',
    '..kjkGGggkssmk..',
    '..kjkkkkkkkkk...',
    '...kjjjjjjjk....',
    '..kjjjjjjjjjk...',
    '..kJjnnnjjsjk...',
    '..kJjjjnjjsk....',
    '..kJjjnjjjjk....',
    '...kJnjjjjk.....'
  ].concat(LEGS.stand);
  const QB_THROW = [
    '.....kkkkk......',
    '....kgggwwk.....',
    '...kggggggwk....',
    '...kgggggggkk...',
    '...kGgggggkmmk..',
    '...kGggggkssmk..',
    '...kGGgggkssmkk.',
    '....kkkkkkkkksk.',
    '...kjjjjjjjjjsk.',
    '..kjjjjjjjjjkk..',
    '..kJjnnnjjjjk...',
    '..kJjjjnjjjjk...',
    '..kJjjnjjjjjk...',
    '...kJnjjjjjk....'
  ].concat(LEGS.runB);

  // Kicker: planted approach, then the leg swinging through.
  const KICK_A = HEAD.concat([
    '...kjjjjjjjk....',
    '..kjjjjjjjjjk...',
    '.ksJjnnnjjjjk...',
    '.kkJjjjnjjjjsk..',
    '..kJjjnjjjjjkk..',
    '...kJnjjjjjk....',
    '...kkkkkkkkk....',
    '..kPPPkppppk....',
    '.kPPk..kppk.....',
    'kwwk...kwwk.....',
    'kwk....kwwk.....',
    'kk....kkkkk.....'
  ]);
  const KICK_B = HEAD.concat([
    '...kjjjjjjjk....',
    '..kjjjjjjjjjk...',
    'ksjJjnnnjjjjk...',
    'kkkJjjjnjjjjk...',
    '..kJjjnjjjjjk...',
    '...kJnjjjjjkkkk.',
    '...kkkkkkkppppk.',
    '....kppppppkkwwk',
    '....kppk.....kkk',
    '....kwwk........',
    '....kwwk........',
    '...kkkkk........'
  ]);

  const G = {
    'rb-idle1': rbFrame(LEGS.stand, false),
    'rb-idle2': rbFrame(LEGS.stand, true),
    'rb-run1': rbFrame(LEGS.runA, false),
    'rb-run2': rbFrame(LEGS.runB, true),
    'rb-run3': rbFrame(LEGS.runC, false),
    'rb-run4': rbFrame(LEGS.runD, true),
    // Ball tucked under the near arm (separate so the receiver can run without it).
    'rb-tuck': [
      BLANK16, BLANK16, BLANK16, BLANK16, BLANK16, BLANK16, BLANK16, BLANK16, BLANK16, BLANK16,
      '........kkkk....',
      '.......kbbwbk...',
      '.......kbBbsk...',
      '........kkkk....'
    ],
    'qb-set': QB_SET,
    'qb-throw': QB_THROW,
    'kick-1': KICK_A,
    'kick-2': KICK_B,
    // Spiral frames for a ball in flight (8×6).
    'ball-1': [
      '..kkkk..',
      '.kbbbbk.',
      'kbbwbwbk',
      'kbbbbbBk',
      '.kbbBBk.',
      '..kkkk..'
    ],
    'ball-2': [
      '..kkkk..',
      '.kbwbbk.',
      'kbbbbbbk',
      'kbbbbBBk',
      '.kBBBBk.',
      '..kkkk..'
    ],
    'ball-3': [
      '........',
      '.kkkkkk.',
      'kbbbbbbk',
      'kBwBwBBk',
      '.kkkkkk.',
      '........'
    ],
    'dust-1': [
      '..........',
      '..........',
      '...dd.....',
      '..dDDd.dd.',
      '.dDDDDdDDd'
    ],
    'dust-2': [
      '..........',
      '.d....dd..',
      'dDd..dDDd.',
      '.d.dd.dd..',
      '..dDDd...d'
    ],
    'dust-3': [
      'd.......d.',
      '..........',
      '.d..d.....',
      '........d.',
      '...d...d..'
    ],

    /* ----- tier mascots (16×16) ----- */
    cone: [
      '................',
      '.......kk.......',
      '......kook......',
      '......kooOk.....',
      '.....kwwwwk.....',
      '.....kwwwwwk....',
      '....kooooOOk....',
      '....koooooOk....',
      '...kwwwwwwwwk...',
      '...kwwwwwwwwk...',
      '..kooooooooOOk..',
      '..koooooooooOk..',
      '.kkkkkkkkkkkkkk.',
      'kOOOOOOOOOOOOOOk',
      'kkkkkkkkkkkkkkkk',
      '................'
    ],
    helmet: [
      '................',
      '.....kkkkkk.....',
      '...kkuuuwwukk...',
      '..kuuuuuuwwuuk..',
      '.kuuuuuuuuuuuuk.',
      '.kUuuuuuuuuuuuk.',
      'kUUuuukkuuuuuuuk',
      'kUuuukwwkuuukkkk',
      'kUuuukwwkuukmmmk',
      'kUUuuukkuuukmkmk',
      '.kUUuuuuuuukmmmk',
      '.kkUUUUuuuukmkmk',
      '..kkkkUUUUkkmmk.',
      '......kkkkk.kk..',
      '................',
      '................'
    ],
    football: [
      '................',
      '................',
      '................',
      '.....kkkkkk.....',
      '...kkbbbbbbkk...',
      '..kbwbbbbbbwbk..',
      '.kbbwbbbbbbwbBk.',
      'kbbbwbwbwbbwbbBk',
      'kbbbwbwwwwbwbbBk',
      '.kbbwbwbwbbwbBk.',
      '..kBwbbbbbbwBk..',
      '...kkBBBBBBkk...',
      '.....kkkkkk.....',
      '................',
      '................',
      '................'
    ],
    jersey: [
      '................',
      '...kkkk..kkkk...',
      '..kqqqqkkqqqqk..',
      '.kqqqqqwwqqqqqk.',
      'kqqqqqqqqqqqqqqk',
      'kqqkqqqqqqqqkqqk',
      'kqk.kqqqwqqk.kqk',
      'kk..kqqwwwqk..kk',
      '....kwwwwwwk....',
      '....kqwwwwqk....',
      '....kqwqqwqk....',
      '....kwqqqqwk....',
      '....kqqqqqQk....',
      '....kQQQQQQk....',
      '....kkkkkkkk....',
      '................'
    ],
    jacket: [
      '................',
      '....kkk..kkk....',
      '...kyyykkyyyk...',
      '..kyyzkwwkzyyk..',
      '.kyyyykwwkyyyyk.',
      '.kyyyyyknkyyyyk.',
      'kyyykyyknkyykyyk',
      'kyyk.kyknkyk.kyk',
      'kyyk.kyyknyk.kyk',
      'kYyk.kyyknyk.kYk',
      'kkk..kyykyyk..kk',
      '.....kyyyyyk....',
      '.....kyyyyYk....',
      '.....kYYYYYk....',
      '.....kkkkkkk....',
      '................'
    ],
    trophy: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kkyzzyyyyyyykk.',
      'kykkzyyyyyyyykyk',
      'ky.kyzyyyyyyYk.k',
      'kyk.kyyyyyyYk.ky',
      '.kykkyyyyyyYkkyk',
      '..kkkyyyyyyYkkk.',
      '.....kyyyyYk....',
      '......kyyYk.....',
      '.......kyk......',
      '.......kyk......',
      '.....kkyyykk....',
      '....kyyyyyyYk...',
      '....kYYYYYYYk...',
      '....kkkkkkkkk...'
    ],
    flag: [
      '................',
      '.......kk.......',
      '......kRRk......',
      '.....kkrrkk.....',
      '....krrwrrrk....',
      '...krrwrrrrrk...',
      '..krrrrrrrrrrk..',
      '..krrrrrrrrrrRk.',
      '.krrrrrrrrrrrRk.',
      '.krrrrrrrrrrRRk.',
      '.krrrrrrrRrrRk..',
      '..krrrRrrrRRk...',
      '..kkrrRkrrRk....',
      '...kkkk.kkk.....',
      '................',
      '................'
    ],

    /* ----- stadium ----- */
    tower: [
      'kkkkkkkkkkkkkkkkkkkk',
      'kNNNNNNNNNNNNNNNNNNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNkkkkkkkkkkkkkkkkNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNkkkkkkkkkkkkkkkkNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNwwkwwkwwkwwkwwkwNk',
      'kNNNNNNNNNNNNNNNNNNk',
      'kkkkkkkkkkkkkkkkkkkk',
      '........knnk........',
      '.......knNNnk.......',
      '.......kn..nk.......',
      '.......knnnnk.......',
      '.......kNn.nk.......',
      '.......kn.nNk.......',
      '.......knnnnk.......',
      '.......kn..nk.......',
      '.......knNNnk.......',
      '.......knnnnk.......',
      '.......kNn.nk.......',
      '.......kn.nNk.......',
      '.......knnnnk.......',
      '.......kn..nk.......',
      '.......knNNnk.......',
      '.......knnnnk.......',
      '.......kNn.nk.......',
      '.......kn.nNk.......',
      '.......knnnnk.......',
      '.......kn..nk.......',
      '.......knNNnk.......',
      '.......knnnnk.......',
      '.......kNn.nk.......',
      '.......kn.nNk.......',
      '.......knnnnk.......',
      '......knnnnnnk......',
      '.....knnnnnnnnk.....',
      '....kkkkkkkkkkkk....'
    ]
  };

  const TIER_MASCOT = {
    chalk: 'cone', starter: 'helmet', pro_bowler: 'football',
    all_pro: 'jersey', hall_of_famer: 'jacket', gronkillion: 'trophy', miss: 'flag'
  };

  /* ---------- grid → merged SVG paths ---------- */
  function sizeOf(rows) {
    return { w: rows.reduce((m, r) => Math.max(m, r.length), 0), h: rows.length };
  }
  function gridPaths(rows, pal) {
    const byColor = {};
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '.' || ch === ' ' || !pal[ch]) { x++; continue; }
        let end = x + 1;
        while (end < row.length && row[end] === ch) end++;
        (byColor[ch] = byColor[ch] || []).push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        x = end;
      }
    });
    return Object.keys(byColor).map((ch) => `<path fill="${pal[ch]}" d="${byColor[ch].join('')}"/>`).join('');
  }

  /* ---------- 3×5 pixel font (field numbers, flags, end zones) ---------- */
  const FONT3 = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', ' ': '000000000000000'
  };
  /** Path data for pixel text starting at (x, y); each glyph is 3 wide plus 1 space. */
  function textPath(str, x0, y0) {
    let d = '';
    String(str).toUpperCase().split('').forEach((ch, i) => {
      const bits = FONT3[ch] || FONT3[' '];
      for (let row = 0; row < 5; row++) {
        let col = 0;
        while (col < 3) {
          if (bits[row * 3 + col] !== '1') { col++; continue; }
          let end = col + 1;
          while (end < 3 && bits[row * 3 + end] === '1') end++;
          d += `M${x0 + i * 4 + col} ${y0 + row}h${end - col}v1h-${end - col}z`;
          col = end;
        }
      }
    });
    return d;
  }
  const textWidth = (str) => Math.max(0, String(str).length * 4 - 1);

  /* ---------- wordmark (5×7 letters, hollow at 3×, chromatic via CSS) ---------- */
  const FONT5 = {
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####']
  };
  // The first O is a football: cream outline, brown leather, white laces.
  const BALL_BIG = [
    '......ccc......',
    '.....cbbbc.....',
    '....cbbbbbc....',
    '...cbbbbbbbc...',
    '...ccccccccc...',
    '..cbbbbbbbbbc..',
    '..cbbbbbbbbbc..',
    '.cbbbbbwbbbbbc.',
    '.cbbbbwwwbbbbc.',
    '.cbbbbbwbbbbbc.',
    '.cbbbbwwwbbbbc.',
    '.cbbbbbwbbbbbc.',
    '.cbbbbwwwbbbbc.',
    '.cbbbbbwbbbbbc.',
    '..cbbbbbbbbbc..',
    '..cbbbbbbbbbc..',
    '...ccccccccc...',
    '...cbbbbbbbc...',
    '....cbbbbbc....',
    '.....cbbbc.....',
    '......ccc......'
  ];
  const BALL_SMALL = ['..c..', '.cbc.', 'cbwbc', 'cbbbc', 'cbwbc', '.cbc.', '..c..'];

  function hollow(glyph, scale) {
    const h = glyph.length * scale;
    const w = glyph[0].length * scale;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && glyph[Math.floor(y / scale)][Math.floor(x / scale)] === '#';
    const rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        let edge = false;
        if (on(x, y)) {
          for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!on(x + dx, y + dy)) { edge = true; break; }
        }
        row += edge ? 'c' : '.';
      }
      rows.push(row);
    }
    return rows;
  }
  function solid(glyph) { return glyph.map((r) => r.replace(/#/g, 'c')); }

  function wordmarkRows(big) {
    const scale = big ? 3 : 1;
    const gap = big ? 3 : 1;
    const letters = 'GRONKILLION'.split('');
    const glyphs = letters.map((ch, i) => (i === 2 ? (big ? BALL_BIG : BALL_SMALL) : (big ? hollow(FONT5[ch], scale) : solid(FONT5[ch]))));
    const h = 7 * scale;
    const rows = Array.from({ length: h }, () => '');
    glyphs.forEach((g, i) => {
      for (let y = 0; y < h; y++) rows[y] += g[y] + (i < glyphs.length - 1 ? '.'.repeat(gap) : '');
    });
    return rows;
  }
  const WM_PAL = { c: '#F3E9D2', b: '#9A5226', w: '#FFFFFF' };
  const wmCache = {};
  /** Inline SVG wordmark. The red/lime split comes from CSS drop-shadows, so offsets stay in screen px. */
  function wordmark(big) {
    const key = big ? 'big' : 'small';
    if (!wmCache[key]) {
      const rows = wordmarkRows(big);
      const { w, h } = sizeOf(rows);
      wmCache[key] = `<svg class="wm-svg wm-${key}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${gridPaths(rows, WM_PAL)}</svg>`;
    }
    return wmCache[key];
  }

  /* ---------- symbol install + <use> markup ---------- */
  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    const symbols = Object.keys(G).map((name) => {
      const { w, h } = sizeOf(G[name]);
      return `<symbol id="spr-${name}" viewBox="0 0 ${w} ${h}">${gridPaths(G[name], PAL)}</symbol>`;
    }).join('');
    const holder = document.createElement('div');
    holder.innerHTML = `<svg class="svg-defs" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><defs>${symbols}</defs></svg>`;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  }
  const size = (name) => sizeOf(G[name]);
  /** Standalone decorative <svg> for one sprite. */
  function svg(name, cls) {
    const { w, h } = sizeOf(G[name]);
    return `<svg class="spr ${cls || ''}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><use href="#spr-${name}" width="${w}" height="${h}"/></svg>`;
  }
  /** <use> elements for an animated frame set inside an existing 16×20 viewBox. */
  function frames(names, extraCls) {
    return names.map((name, i) => {
      const { w, h } = sizeOf(G[name]);
      return `<use class="fr fr-${i + 1} ${extraCls || ''}" href="#spr-${name}" width="${w}" height="${h}"/>`;
    }).join('');
  }
  /** The running back with idle + run frames and the tucked ball, as a standalone <svg>. */
  function runner(cls) {
    return `<svg class="spr runner ${cls || ''}" viewBox="0 0 16 20" shape-rendering="crispEdges" aria-hidden="true" focusable="false">` +
      `<g class="set-idle">${frames(['rb-idle1', 'rb-idle2'])}</g>` +
      `<g class="set-run">${frames(['rb-run1', 'rb-run2', 'rb-run3', 'rb-run4'])}</g>` +
      `<use class="tuck" href="#spr-rb-tuck" width="16" height="14"/></svg>`;
  }

  /* ---------- canvas tiles (rendered once, cached as data URLs) ---------- */
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const tileCache = {};
  function tile(key, w, h, draw) {
    if (tileCache[key] !== undefined) return tileCache[key];
    let url = '';
    try {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      if (ctx) { draw(ctx); url = cv.toDataURL('image/png'); }
    } catch (err) { url = ''; }
    tileCache[key] = url;
    return url;
  }
  // Crowd: three stepped rows of fans. "dim" is the base, "hot" is brighter, "dense" fills gaps.
  const CROWD_W = 96;
  const CROWD_H = 30;
  function crowd(variant) {
    return tile('crowd-' + variant, CROWD_W, CROWD_H, (ctx) => {
      const rnd = seeded(variant === 'dim' ? 11 : variant === 'hot' ? 23 : 37);
      const shirts = {
        dim: ['#1A2944', '#22385A', '#2A3550', '#2C2A44', '#1E3040'],
        hot: ['#E8F1FF', '#A3FF12', '#FFC857', '#FF4D57', '#4DA3FF', '#FF9F43', '#B47CFF', '#8FA3C4'],
        dense: ['#C9D3E2', '#A3FF12', '#FFC857', '#FF4D57', '#4DA3FF', '#E8F1FF']
      }[variant];
      const skins = variant === 'dim' ? ['#3A3040', '#4A3A3A', '#33303E'] : ['#D9A066', '#A86B3C', '#7A4A2A', '#F0C090'];
      if (variant === 'dim') {
        // stepped concrete rows behind the fans
        ['#0D1626', '#101C2E', '#13213A'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 10, CROWD_W, 10); });
        ctx.fillStyle = '#0A1220';
        for (let i = 0; i < 3; i++) ctx.fillRect(0, i * 10 + 9, CROWD_W, 1);
      }
      const fill = variant === 'dim' ? 0.62 : variant === 'hot' ? 0.5 : 0.42;
      for (let row = 0; row < 3; row++) {
        const y = row * 10 + 3;
        for (let x = (row % 2) * 2; x < CROWD_W - 2; x += 4) {
          if (rnd() > fill) continue;
          ctx.fillStyle = skins[Math.floor(rnd() * skins.length)];
          ctx.fillRect(x, y, 2, 2);
          ctx.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
          ctx.fillRect(x - (rnd() < 0.5 ? 1 : 0), y + 2, 3, 4);
          if (variant !== 'dim' && rnd() < 0.18) { ctx.fillRect(x + 2, y - 2, 1, 3); } // raised arm
        }
      }
    });
  }
  function stars() {
    return tile('stars', 160, 90, (ctx) => {
      const rnd = seeded(5);
      for (let i = 0; i < 52; i++) {
        const b = rnd();
        ctx.fillStyle = b > 0.92 ? '#FFF0B8' : b > 0.6 ? '#8FA3C4' : '#3E4C66';
        ctx.fillRect(Math.floor(rnd() * 160), Math.floor(rnd() * 90), 1, 1);
      }
    });
  }

  return {
    PAL, TIER_MASCOT, CROWD_W, CROWD_H,
    install, size, svg, frames, runner, textPath, textWidth, wordmark, crowd, stars,
    names: () => Object.keys(G)
  };
})();
