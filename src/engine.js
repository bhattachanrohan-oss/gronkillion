/* ==========================================================================
   GRONKILLION — game engine
   Sections follow the build brief:
     1 Configuration        3 Answer normalization   4 Answer validation
     5 Game state & flow    6 Timer engine           7 Scoring
     8 Football field       9 Screen rendering      10 Question selection
    11 Local storage       12 Sound                 13 Sharing
    14 Events & startup
   (2, the question database, lives in GRONK_DATA above.)
   State machine: HOME → (KICKOFF) → PREVIEW → ANSWERING → REVEAL → PREVIEW … → RESULTS
   ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
     1. CONFIGURATION
     ====================================================================== */
  const CONFIG = Object.freeze({
    ROUNDS: 7,
    PREVIEW_MS: 3000,
    ANSWER_MS: 25000,
    WARN_SECONDS: 10,
    DANGER_SECONDS: 5,
    MAX_SCORE: 700,
    STORAGE_PREFIX: 'gronkillion:v1:',
    DAILY_SALT: 'gronkillion-daily-v1',
    RECENT_MEMORY: 21,
    SUBMIT_DEBOUNCE_MS: 280,
    NEXT_GUARD_MS: 450,
    CONFIRM_FLASH_MS: 380,
    KICKOFF_MS: 1150,
    RESUME_MAX_AGE_MS: 24 * 60 * 60 * 1000
  });

  const TIERS = Object.freeze({
    chalk:         { key: 'chalk',         label: 'Chalk Pick',    points: 10,  glyph: '●',   emoji: '⬜', order: 1, desc: 'Extremely obvious answer' },
    starter:       { key: 'starter',       label: 'Starter',       points: 15,  glyph: '◆',   emoji: '🟦', order: 2, desc: 'Commonly known answer' },
    pro_bowler:    { key: 'pro_bowler',    label: 'Pro Bowler',    points: 30,  glyph: '★',   emoji: '🟩', order: 3, desc: 'Good football knowledge' },
    all_pro:       { key: 'all_pro',       label: 'All-Pro',       points: 60,  glyph: '★★',  emoji: '🟧', order: 4, desc: 'Uncommon, impressive answer' },
    hall_of_famer: { key: 'hall_of_famer', label: 'Hall of Famer', points: 85,  glyph: '★★★', emoji: '🟪', order: 5, desc: 'Very obscure answer' },
    gronkillion:   { key: 'gronkillion',   label: 'GRONKILLION',   points: 100, glyph: '♛',   emoji: '🟨', order: 6, desc: 'Extremely rare, legendary answer' }
  });
  const TIER_ORDER = ['chalk', 'starter', 'pro_bowler', 'all_pro', 'hall_of_famer', 'gronkillion'];

  const RANKS = [
    { min: 0,   key: 'practice', label: 'Practice Squad',     msg: 'Rough day at the office. Hit the film room and run it back.' },
    { min: 100, key: 'rookie',   label: 'Rookie',             msg: 'Flashes of real talent. The coaching staff noticed.' },
    { min: 200, key: 'starter',  label: 'Starter',            msg: 'Solid drive. You earned your spot on the depth chart.' },
    { min: 300, key: 'probowl',  label: 'Pro Bowler',         msg: 'A Pro Bowl résumé. The fans voted you in.' },
    { min: 400, key: 'allpro',   label: 'All-Pro',            msg: 'That was an All-Pro performance.' },
    { min: 500, key: 'hof',      label: 'Hall of Famer',      msg: "You're headed to the Hall of Fame!" },
    { min: 600, key: 'legend',   label: 'GRONKILLION LEGEND', msg: 'An absolutely legendary seven-play drive.' }
  ];

  const ZONES = [
    { min: 0,   key: 'opening',  label: 'Opening Drive' },
    { min: 25,  key: 'chains',   label: 'Moving the Chains' },
    { min: 50,  key: 'midfield', label: 'Across Midfield' },
    { min: 80,  key: 'redzone',  label: 'Red Zone' },
    { min: 95,  key: 'goalline', label: 'Goal Line' },
    { min: 100, key: 'td',       label: 'TOUCHDOWN' }
  ];

  const FLAVOR = {
    chalk: ['Chalk pick. Everybody had that one.', 'The safe read. It still moves the chains.', 'Obvious, but it counts.'],
    starter: ['Solid gain.', 'Good read. Keep the drive alive.', 'A starter-level answer.'],
    pro_bowler: ['Big gain! Pro Bowl knowledge.', "Now we're talking.", "That's a Pro Bowl read."],
    all_pro: ['Explosive play! All-Pro answer.', 'Huge chunk play!', 'Film-room grinders know that one.'],
    hall_of_famer: ['What a deep cut!', 'Canton-level knowledge.', 'Few fans would pull that one.'],
    gronkillion: ['GRONKILLION! A legendary answer.', 'One in a GRONKILLION!', 'Absolutely legendary.'],
    timeout: ['The play clock beat you.', 'Delay of game. No gain on the play.'],
    skipped: ['Punt formation. No gain on the play.', 'You took a knee on this one.']
  };

  /* ---------- small helpers ---------- */
  const first = (set) => set.values().next().value;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

  /* ======================================================================
     11. LOCAL STORAGE (versioned keys, validated reads, in-memory fallback)
     ====================================================================== */
  const Store = (() => {
    const memory = new Map();
    let available = false;
    try {
      const probe = CONFIG.STORAGE_PREFIX + '__probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      available = true;
    } catch (err) {
      available = false;
    }
    const fullKey = (key) => CONFIG.STORAGE_PREFIX + key;
    function readRaw(key) {
      if (available) {
        try { return window.localStorage.getItem(fullKey(key)); } catch (err) { /* fall back to memory */ }
      }
      return memory.has(key) ? memory.get(key) : null;
    }
    return {
      get available() { return available; },
      get(key, fallback, validate) {
        const raw = readRaw(key);
        if (raw == null) return fallback;
        try {
          const value = JSON.parse(raw);
          return (!validate || validate(value)) ? value : fallback;
        } catch (err) {
          return fallback; // corrupted entry
        }
      },
      set(key, value) {
        let raw;
        try { raw = JSON.stringify(value); } catch (err) { return false; }
        memory.set(key, raw);
        if (!available) return false;
        try { window.localStorage.setItem(fullKey(key), raw); return true; } catch (err) { return false; }
      },
      remove(key) {
        memory.delete(key);
        if (available) { try { window.localStorage.removeItem(fullKey(key)); } catch (err) { /* ignore */ } }
      }
    };
  })();

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const validPlays = (arr) => Array.isArray(arr) && arr.length <= CONFIG.ROUNDS &&
    arr.every((p) => p === null || (isObj(p) && typeof p.qid === 'string' && isNum(p.points) && p.points >= 0 && p.points <= 100 &&
      (p.points === 0 || TIERS[p.rarity])));
  const validStats = (v) => isObj(v) && isNum(v.gamesPlayed) && isNum(v.unlimitedHigh);
  const validSettings = (v) => isObj(v) && typeof v.sound === 'boolean';
  const validDaily = (v) => isObj(v) && typeof v.date === 'string' && isNum(v.score) && Array.isArray(v.qids) && validPlays(v.plays);
  const validRecent = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const validProgress = (v) => isObj(v) && (v.mode === 'daily' || v.mode === 'unlimited') && Array.isArray(v.qids) &&
    v.qids.length === CONFIG.ROUNDS && isNum(v.round) && v.round >= 0 && v.round < CONFIG.ROUNDS && validPlays(v.plays) && isNum(v.savedAt);

  const defaultStats = () => ({ gamesPlayed: 0, unlimitedHigh: 0, unlimitedGames: 0, dailyGames: 0, bestTier: null });
  const loadStats = () => Object.assign(defaultStats(), Store.get('stats', null, validStats) || {});
  const loadDailyRecord = () => Store.get('daily', null, validDaily);

  /* ======================================================================
     3. ANSWER NORMALIZATION
     ====================================================================== */
  const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  const PARTICLES = new Set(['st', 'van', 'von', 'de', 'da', 'di', 'du', 'le', 'la', 'del']);

  /** Lower-case, strip accents/apostrophes/punctuation, collapse whitespace,
   *  merge initials ("J. J. Watt" → "jj watt") and drop a leading "the". */
  function normalize(input) {
    let s = String(input == null ? '' : input);
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.toLowerCase()
      .replace(/[‘’‚‛′ʼ`´']/g, '')
      .replace(/&/g, '')
      .replace(/\./g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!s) return '';
    const out = [];
    const single = [];
    s.split(' ').forEach((token) => {
      const isSingle = token.length === 1 && token >= 'a' && token <= 'z';
      if (isSingle && out.length && single[single.length - 1]) {
        out[out.length - 1] += token;
      } else {
        out.push(token);
        single.push(isSingle);
      }
    });
    if (out.length > 1 && out[0] === 'the') out.shift();
    return out.join(' ');
  }

  /** "kenneth walker iii" → "kenneth walker" (keeps at least two words). */
  function stripSuffix(n) {
    const parts = n.split(' ');
    while (parts.length > 2 && SUFFIXES.has(parts[parts.length - 1])) parts.pop();
    return parts.join(' ');
  }

  /** Surname keys for a display name, e.g. "Amon-Ra St. Brown" → ["st brown", "stbrown"]. */
  function surnameKeys(name) {
    const words = String(name).replace(/["“”]/g, ' ').trim().split(/\s+/);
    while (words.length > 2 && SUFFIXES.has(normalize(words[words.length - 1]))) words.pop();
    if (words.length < 2) return [];
    let last = words[words.length - 1];
    if (words.length >= 3 && PARTICLES.has(normalize(words[words.length - 2]))) last = words[words.length - 2] + ' ' + last;
    const key = normalize(last);
    if (!key) return [];
    return key.includes(' ') ? [key, key.replace(/ /g, '')] : [key];
  }

  /** Optimal-string-alignment (Damerau–Levenshtein) distance with early exit. */
  function osa(a, b, max) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (!la || !lb) return Math.max(la, lb);
    let p2 = new Array(lb + 1).fill(0);
    let p1 = new Array(lb + 1);
    let cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) p1[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i;
      let rowMin = i;
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const bj = b.charCodeAt(j - 1);
        let v = p1[j - 1] + (ai === bj ? 0 : 1);
        if (p1[j] + 1 < v) v = p1[j] + 1;
        if (cur[j - 1] + 1 < v) v = cur[j - 1] + 1;
        if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj && p2[j - 2] + 1 < v) v = p2[j - 2] + 1;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      const t = p2; p2 = p1; p1 = cur; cur = t;
    }
    return p1[lb];
  }

  // Conservative typo tolerance: none for short keys, one edit for 6+ chars, two for 12+.
  const typoAllowance = (len) => (len >= 12 ? 2 : len >= 6 ? 1 : 0);
  const teamAllowance = (len) => (len >= 10 ? 2 : len >= 5 ? 1 : 0);

  /* ======================================================================
     2b. QUESTION DATABASE — compile registries and runtime questions
     ====================================================================== */
  const addKey = (map, key, id) => {
    if (!key) return;
    let set = map.get(key);
    if (!set) { set = new Set(); map.set(key, set); }
    set.add(id);
  };

  // Players: every name that appears anywhere becomes a known entity.
  const PLAYERS = new Map();
  function ensurePlayer(name) {
    let p = PLAYERS.get(name);
    if (!p) {
      const full = normalize(name);
      p = { id: name, name, full, base: stripSuffix(full), aliases: [], surnames: surnameKeys(name) };
      PLAYERS.set(name, p);
    }
    return p;
  }
  GRONK_DATA.questions.forEach((src) => {
    if (src.type !== 'player') return;
    TIER_ORDER.forEach((tier) => (src.tiers[tier] || []).forEach(ensurePlayer));
    Object.keys(src.near || {}).forEach(ensurePlayer);
  });
  GRONK_DATA.extraPlayers.forEach(ensurePlayer);
  Object.keys(GRONK_DATA.playerAliases).forEach((name) => {
    const p = ensurePlayer(name);
    GRONK_DATA.playerAliases[name].forEach((alias) => p.aliases.push(alias));
  });

  const P_FULL = new Map();
  const P_ALIAS = new Map();
  const P_SURNAME = new Map();
  PLAYERS.forEach((p) => addKey(P_FULL, p.full, p.id));
  PLAYERS.forEach((p) => { if (p.base !== p.full && !P_FULL.has(p.base)) addKey(P_FULL, p.base, p.id); });
  PLAYERS.forEach((p) => p.aliases.forEach((alias) => {
    const key = normalize(alias);
    addKey(P_ALIAS, key, p.id);
    const base = stripSuffix(key);
    if (base !== key) addKey(P_ALIAS, base, p.id);
  }));
  PLAYERS.forEach((p) => p.surnames.forEach((s) => addKey(P_SURNAME, s, p.id)));
  const P_FUZZY = [];
  P_FULL.forEach((ids, key) => { if (ids.size === 1 && key.length >= 6) P_FUZZY.push([key, first(ids)]); });
  P_ALIAS.forEach((ids, key) => { if (ids.size === 1 && key.length >= 8 && !P_FULL.has(key)) P_FUZZY.push([key, first(ids)]); });
  const P_SURNAME_FUZZY = [];
  P_SURNAME.forEach((ids, key) => { if (key.length >= 7 && !key.includes(' ')) P_SURNAME_FUZZY.push([key, key]); });

  // Teams
  const TEAMS = new Map();
  const T_INDEX = new Map();
  const T_BY_NAME = new Map();
  Object.keys(GRONK_DATA.teams).forEach((code) => {
    const t = GRONK_DATA.teams[code];
    TEAMS.set(code, { id: code, name: t.name });
    T_BY_NAME.set(t.name, code);
    [t.name, code].concat(t.aliases).forEach((alias) => addKey(T_INDEX, normalize(alias), code));
  });
  Object.keys(GRONK_DATA.teamAmbiguous).forEach((label) => GRONK_DATA.teamAmbiguous[label].forEach((code) => addKey(T_INDEX, normalize(label), code)));
  const T_FUZZY = [];
  T_INDEX.forEach((ids, key) => { if (ids.size === 1 && key.length >= 5) T_FUZZY.push([key, first(ids)]); });

  // Venues
  const VENUES = new Map();
  const V_INDEX = new Map();
  Object.keys(GRONK_DATA.venues).forEach((id) => {
    const v = GRONK_DATA.venues[id];
    VENUES.set(id, { id, name: v.name, display: v.display || v.name, host: v.host !== false });
    [v.name, v.display || v.name].concat(v.aliases || []).forEach((alias) => addKey(V_INDEX, normalize(alias), id));
  });
  Object.keys(GRONK_DATA.venueAmbiguous).forEach((label) => GRONK_DATA.venueAmbiguous[label].forEach((id) => addKey(V_INDEX, normalize(label), id)));
  const V_FUZZY = [];
  V_INDEX.forEach((ids, key) => { if (ids.size === 1 && key.length >= 6) V_FUZZY.push([key, first(ids)]); });

  function buildCustom(src) {
    const index = new Map();
    const names = new Map();
    const ids = new Map();
    const near = {};
    const add = (name, aliases) => {
      const id = 'c:' + name;
      ids.set(name, id);
      names.set(id, name);
      [name].concat(aliases).forEach((alias) => addKey(index, normalize(alias), id));
      return id;
    };
    Object.keys(src.entities || {}).forEach((name) => add(name, src.entities[name]));
    Object.keys(src.decoys || {}).forEach((name) => {
      const d = src.decoys[name];
      const id = add(name, d.aliases || []);
      if (d.note) near[id] = d.note;
    });
    const fuzzy = [];
    index.forEach((set, key) => { if (set.size === 1 && key.length >= 6) fuzzy.push([key, first(set)]); });
    return { index, names, ids, near, fuzzy, entities: src.entities || {} };
  }

  function resolveRef(src, ref, custom) {
    switch (src.type) {
      case 'player': return PLAYERS.has(ref) ? ref : null;
      case 'team': return T_BY_NAME.get(ref) || (TEAMS.has(ref) ? ref : null);
      case 'venue': return VENUES.has(ref) ? ref : null;
      case 'custom': return custom.ids.get(ref) || null;
      default: return null;
    }
  }
  function entityName(type, id, custom) {
    switch (type) {
      case 'player': return PLAYERS.get(id).name;
      case 'team': return TEAMS.get(id).name;
      case 'venue': return VENUES.get(id).display;
      case 'custom': return custom.names.get(id);
      default: return String(id);
    }
  }
  function entityAliases(type, id, custom) {
    switch (type) {
      case 'player': return PLAYERS.get(id).aliases.slice();
      case 'team': return GRONK_DATA.teams[id].aliases.slice();
      case 'venue': return (GRONK_DATA.venues[id].aliases || []).slice();
      case 'custom': return (custom.entities[custom.names.get(id)] || []).slice();
      default: return [];
    }
  }

  function buildQuestion(src) {
    const custom = src.type === 'custom' ? buildCustom(src) : null;
    const answers = [];
    TIER_ORDER.forEach((tier) => (src.tiers[tier] || []).forEach((ref) => {
      const entityId = resolveRef(src, ref, custom);
      if (!entityId) { console.warn('[GRONKILLION] Unknown answer in ' + src.id + ':', ref); return; }
      if (answers.some((a) => a.entityId === entityId)) { console.warn('[GRONKILLION] Duplicate answer in ' + src.id + ':', ref); return; }
      answers.push({
        canonical: entityName(src.type, entityId, custom),
        aliases: entityAliases(src.type, entityId, custom),
        rarity: tier,
        points: TIERS[tier].points,
        entityId
      });
    }));
    const byEntity = new Map(answers.map((a) => [a.entityId, a]));
    const near = custom ? Object.assign({}, custom.near) : {};
    Object.keys(src.near || {}).forEach((ref) => {
      const id = resolveRef(src, ref, custom);
      if (!id) { console.warn('[GRONKILLION] Unknown near-miss in ' + src.id + ':', ref); return; }
      if (byEntity.has(id)) { console.warn('[GRONKILLION] Near-miss note on a qualifying answer in ' + src.id + ':', ref); return; }
      near[id] = src.near[ref];
    });
    return {
      id: src.id,
      category: src.category,
      difficulty: src.difficulty || 'medium',
      type: src.type,
      prompt: src.prompt,
      scope: src.scope,
      answers,
      byEntity,
      near,
      custom
    };
  }

  const QUESTIONS = GRONK_DATA.questions.map(buildQuestion).filter((q) => q.answers.length > 0);
  const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
  const CATEGORIES = Array.from(new Set(QUESTIONS.map((q) => q.category)));

  /* ======================================================================
     4. ANSWER VALIDATION
     Order: exact full name → alias/nickname → reversed name → unique surname
            → conservative typo match.  A name that matches more than one
            well-known entity asks for clarification instead of guessing.
     ====================================================================== */
  function outcome(q, ids, via, extra) {
    const list = Array.from(ids);
    if (list.length === 1) {
      const id = list[0];
      const answer = q.byEntity.get(id);
      if (answer) return Object.assign({ kind: 'accepted', answer, via }, extra);
      return Object.assign({ kind: 'nonqualifying', name: entityName(q.type, id, q.custom), note: q.near[id] || null, via }, extra);
    }
    if (!list.some((id) => q.byEntity.has(id))) return Object.assign({ kind: 'nonqualifying', name: null, note: null, via, group: true }, extra);
    return Object.assign({ kind: 'ambiguous', via }, extra);
  }

  function fuzzyBest(input, pool, allowFn) {
    let best = Infinity;
    let ids = new Set();
    for (let i = 0; i < pool.length; i++) {
      const key = pool[i][0];
      const allow = allowFn(key.length);
      if (!allow) continue;
      const limit = Math.min(allow, best);
      if (Math.abs(key.length - input.length) > limit) continue;
      const d = osa(input, key, limit);
      if (d > limit) continue;
      if (d < best) { best = d; ids = new Set([pool[i][1]]); } else { ids.add(pool[i][1]); }
    }
    return best !== Infinity && ids.size === 1 ? first(ids) : null;
  }

  function validatePlayer(q, n) {
    const b = stripSuffix(n);
    // Exact text (suffix kept) wins over suffix-stripped text, so "Kellen Winslow Jr." never becomes his father.
    for (const key of b === n ? [n] : [n, b]) {
      let hit = P_FULL.get(key);
      if (hit) return outcome(q, hit, 'exact');
      hit = P_ALIAS.get(key);
      if (hit) return outcome(q, hit, 'alias', { reason: 'alias' });
    }
    let ids;
    const words = b.split(' ');
    if (words.length === 2) {
      ids = P_FULL.get(words[1] + ' ' + words[0]);
      if (ids) return outcome(q, ids, 'exact');
    }
    ids = P_SURNAME.get(b);
    if (ids) return outcome(q, ids, 'surname', { reason: 'surname', surname: titleCase(b) });
    const typoId = fuzzyBest(b, P_FUZZY, typoAllowance);
    if (typoId) return outcome(q, new Set([typoId]), 'typo');
    if (!b.includes(' ') && b.length >= 7) {
      const sKey = fuzzyBest(b, P_SURNAME_FUZZY, (len) => (len >= 7 ? 1 : 0));
      if (sKey) return outcome(q, P_SURNAME.get(sKey), 'typo', { reason: 'surname', surname: titleCase(sKey) });
    }
    return { kind: 'unrecognized' };
  }

  function validateIndexed(q, n, index, fuzzy, allowFn, reason) {
    const ids = index.get(n);
    if (ids) return outcome(q, ids, 'exact', { reason });
    const id = fuzzyBest(n, fuzzy, allowFn);
    if (id) return outcome(q, new Set([id]), 'typo', { reason });
    return { kind: 'unrecognized' };
  }

  function validate(q, raw) {
    if (!q) return { kind: 'unrecognized' };
    const n = normalize(raw);
    if (!n) return { kind: 'empty' };
    switch (q.type) {
      case 'player': return validatePlayer(q, n);
      case 'team': return validateIndexed(q, n, T_INDEX, T_FUZZY, teamAllowance, 'team');
      case 'venue': return validateIndexed(q, n, V_INDEX, V_FUZZY, typoAllowance, 'venue');
      case 'custom': return validateIndexed(q, n, q.custom.index, q.custom.fuzzy, typoAllowance, 'custom');
      default: return { kind: 'unrecognized' };
    }
  }

  function feedbackFor(res, raw, q) {
    const noun = { player: 'player', team: 'team', venue: 'stadium', custom: 'answer' }[q.type] || 'answer';
    switch (res.kind) {
      case 'empty':
        return { tone: 'info', text: 'Type an answer first.' };
      case 'ambiguous':
        if (res.reason === 'surname') return { tone: 'info', text: `More than one well-known player is named ${res.surname}. Add a first name.` };
        if (res.reason === 'team') return { tone: 'info', text: 'That could mean more than one team. Add the nickname.' };
        if (res.reason === 'venue') return { tone: 'info', text: 'That could mean more than one stadium. Use the full name.' };
        return { tone: 'info', text: `“${raw.trim()}” could mean more than one player. Be more specific.` };
      case 'nonqualifying':
        if (res.name) return { tone: 'error', text: `${res.name} doesn't qualify — try another answer.`, note: res.note };
        if (res.surname) return { tone: 'error', text: `No qualifying ${noun} named ${res.surname} — try another answer.` };
        return { tone: 'error', text: `That ${noun} doesn't qualify — try another answer.` };
      default:
        return { tone: 'error', text: 'Not recognized — try another answer.' };
    }
  }

  /* ======================================================================
     10. QUESTION SELECTION (seeded daily set + varied unlimited set)
     ====================================================================== */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };

  /** Seven questions from seven different categories, ordered easy → hard. */
  function pickSeven(rng, avoid) {
    const cats = shuffle(CATEGORIES, rng).slice(0, Math.min(CONFIG.ROUNDS, CATEGORIES.length));
    const chosen = cats.map((cat) => {
      const pool = QUESTIONS.filter((q) => q.category === cat);
      const fresh = pool.filter((q) => !avoid.has(q.id));
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(rng() * from.length)];
    });
    while (chosen.length < CONFIG.ROUNDS) {
      const rest = QUESTIONS.filter((q) => chosen.indexOf(q) === -1);
      chosen.push(rest[Math.floor(rng() * rest.length)]);
    }
    return chosen
      .map((q, i) => ({ q, i }))
      .sort((x, y) => (DIFFICULTY_RANK[x.q.difficulty] - DIFFICULTY_RANK[y.q.difficulty]) || (x.i - y.i))
      .map((x) => x.q);
  }
  const dailyQuestions = (dateKey) => pickSeven(mulberry32(hashString(CONFIG.DAILY_SALT + '|' + dateKey)), new Set());
  const unlimitedQuestions = () => pickSeven(Math.random, new Set(Store.get('recent', [], validRecent)));

  const utcDateKey = (d) => (d || new Date()).toISOString().slice(0, 10);
  function nextUtcMidnight(now) {
    const d = new Date(now || Date.now());
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  }
  function formatDateKey(key) {
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some((x) => !isFinite(x))) return String(key);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const pad = (x) => String(x).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  const localResetTime = () => new Date(nextUtcMidnight()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  /* ======================================================================
     7. SCORING
     ====================================================================== */
  const totalScore = (plays) => plays.reduce((sum, p) => sum + (p ? p.points : 0), 0);
  const fieldProgress = (score) => Math.max(0, Math.min(100, (score / CONFIG.MAX_SCORE) * 100));
  function zoneFor(progress) {
    let zone = ZONES[0];
    ZONES.forEach((z) => { if (progress >= z.min) zone = z; });
    return zone;
  }
  function rankFor(score) {
    let rank = RANKS[0];
    RANKS.forEach((r) => { if (score >= r.min) rank = r; });
    return rank;
  }
  function yardMarker(progress) {
    if (progress <= 0) return 'Own goal line';
    if (progress >= 100) return 'End zone';
    const r = Math.round(progress);
    if (r < 50) return `Own ${Math.max(1, r)}`;
    if (r === 50) return 'Midfield';
    return `Opp ${Math.max(1, 100 - r)}`;
  }
  function yardsText(progress) {
    const y = Math.round(progress * 10) / 10;
    return `${Number.isInteger(y) ? y : y.toFixed(1)} ${y === 1 ? 'yard' : 'yards'}`;
  }
  function bestTierOf(plays) {
    let best = null;
    plays.forEach((p) => { if (p && p.points > 0 && TIERS[p.rarity] && (!best || TIERS[p.rarity].order > TIERS[best].order)) best = p.rarity; });
    return best;
  }

  /* ======================================================================
     6. TIMER ENGINE (deadline-based; one active job; generation-guarded)
     ====================================================================== */
  const Timer = {
    job: null, raf: 0, interval: 0, gen: 0,
    run(job) {
      this.stop();
      const gen = ++this.gen;
      this.job = Object.assign({ done: false }, job);
      const loop = () => {
        if (gen !== this.gen) return;
        this.check();
        if (gen === this.gen && this.job) this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
      this.interval = setInterval(() => { if (gen === this.gen) this.check(); }, 200);
      this.check();
    },
    check() {
      const job = this.job;
      if (!job || job.done) return;
      const left = job.endAt - Date.now();
      if (job.onTick) job.onTick(Math.max(0, left));
      if (left <= 0 && this.job === job) {
        job.done = true;
        const done = job.onDone;
        this.stop();
        if (done) done();
      }
    },
    stop() {
      this.gen++;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.interval) clearInterval(this.interval);
      this.raf = 0;
      this.interval = 0;
      this.job = null;
    }
  };

  /** One-off UI delays, cleared together whenever the player leaves a game. */
  const Delays = {
    ids: new Set(),
    add(fn, ms) {
      const id = setTimeout(() => { this.ids.delete(id); fn(); }, ms);
      this.ids.add(id);
      return id;
    },
    clear() { this.ids.forEach((id) => clearTimeout(id)); this.ids.clear(); }
  };

  /* ======================================================================
     12. SOUND (Web Audio synthesis; muted until the player turns it on)
     ====================================================================== */
  const Sound = {
    ctx: null, master: null, enabled: false,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.6;
          this.master.connect(this.ctx.destination);
        } catch (err) { this.ctx = null; return null; }
      }
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    tone(freq, opts) {
      const o = Object.assign({ type: 'sine', at: 0, dur: 0.14, gain: 0.16, to: null }, opts);
      const ctx = this.ctx;
      const t0 = ctx.currentTime + o.at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type;
      osc.frequency.setValueAtTime(freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + o.dur + 0.03);
    },
    noise(opts) {
      const o = Object.assign({ at: 0, dur: 1.2, gain: 0.08, freq: 900 }, opts);
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * o.dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = o.freq;
      filter.Q.value = 0.6;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + o.at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(filter); filter.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + o.dur);
    },
    play(name) {
      if (!this.enabled || !this.ensure()) return;
      try {
        switch (name) {
          case 'click': this.tone(520, { type: 'square', dur: 0.05, gain: 0.05 }); break;
          case 'kickoff':
            this.tone(2300, { dur: 0.12, gain: 0.07 });
            this.tone(2050, { at: 0.13, dur: 0.12, gain: 0.07 });
            this.tone(2300, { at: 0.26, dur: 0.22, gain: 0.07 });
            this.tone(110, { at: 0.6, dur: 0.25, gain: 0.35, to: 45 });
            break;
          case 'snap':
            this.tone(880, { type: 'triangle', dur: 0.08, gain: 0.12 });
            this.tone(1320, { type: 'triangle', at: 0.08, dur: 0.12, gain: 0.12 });
            break;
          case 'tick': this.tone(1000, { type: 'square', dur: 0.035, gain: 0.04 }); break;
          case 'correct': [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, { type: 'triangle', at: i * 0.08, dur: 0.18, gain: 0.14 })); break;
          case 'rare': [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => this.tone(f, { type: 'triangle', at: i * 0.07, dur: 0.24, gain: 0.13 })); break;
          case 'gronk':
            [[523.25, 659.25, 783.99], [587.33, 739.99, 880], [783.99, 987.77, 1174.66, 1567.98]].forEach((chord, i) =>
              chord.forEach((f) => this.tone(f, { type: 'sawtooth', at: i * 0.18, dur: i === 2 ? 0.7 : 0.16, gain: 0.05 })));
            this.noise({ at: 0.3, dur: 1.4, gain: 0.05, freq: 1200 });
            break;
          case 'wrong': this.tone(196, { type: 'sawtooth', dur: 0.22, gain: 0.07, to: 130 }); break;
          case 'nudge':
            this.tone(440, { type: 'triangle', dur: 0.08, gain: 0.1 });
            this.tone(494, { type: 'triangle', at: 0.09, dur: 0.1, gain: 0.1 });
            break;
          case 'whistle':
            this.tone(2400, { dur: 0.35, gain: 0.07, to: 2200 });
            this.tone(330, { type: 'square', at: 0.05, dur: 0.3, gain: 0.04, to: 165 });
            break;
          case 'touchdown':
            [[392, 493.88, 587.33], [523.25, 659.25, 783.99], [659.25, 783.99, 1046.5]].forEach((chord, i) =>
              chord.forEach((f) => this.tone(f, { type: 'square', at: i * 0.22, dur: i === 2 ? 0.9 : 0.2, gain: 0.045 })));
            this.noise({ at: 0.1, dur: 2.4, gain: 0.08, freq: 900 });
            break;
          default: break;
        }
      } catch (err) { /* sound is optional */ }
    }
  };

  /* ======================================================================
     8. FOOTBALL FIELD (pixel-art SVG: turf, yard lines, numbers, end zones,
        yard ruler, ball carrier, QB, pass, tier lines, drive bars)
     ====================================================================== */
  const SPR = GRONK_SPRITES;
  const FIELD_W = 240;
  const FIELD_H = 80;
  const TURF_Y = 12;         // ruler strip above the turf
  const TURF_H = 64;
  const FEET_Y = 59;         // where sprites stand
  const fieldX = (progress) => 20 + progress * 2; // 2 units per yard, goal lines at 20 and 220
  const yardsFor = (points) => (points * 100) / CONFIG.MAX_SCORE;
  const fmtYards = (v) => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const BIG_PLAY = new Set(['all_pro', 'hall_of_famer', 'gronkillion']);
  const ZONE_CAPS = { chains: 'Own 25', midfield: 'Midfield', redzone: 'Red Zone', goalline: 'Goal Line' };
  const tx = (x, y) => `translate(${x}px, ${y || 0}px)`;
  const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const run = (x, y, w, h) => `M${x} ${y}h${w}v${h}h-${w}z`;

  function checker(x0, w, a, b) {
    let d = '';
    for (let y = 0; y < TURF_H; y += 4) for (let x = 0; x < w; x += 4) if (((x + y) / 4) % 2) d += run(x0 + x, TURF_Y + y, 4, 4);
    return rect(x0, TURF_Y, w, TURF_H, a) + `<path fill="${b}" d="${d}"/>`;
  }

  function fieldSVG() {
    const o = [];
    const bottom = TURF_Y + TURF_H;
    o.push(`<svg viewBox="0 0 ${FIELD_W} ${FIELD_H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`);
    o.push(rect(0, 0, FIELD_W, TURF_Y, '#0B1322'), rect(0, bottom, FIELD_W, FIELD_H - bottom, '#0B1322'));
    for (let i = 0; i < 20; i++) o.push(rect(20 + i * 10, TURF_Y, 10, TURF_H, i % 2 ? '#2A8443' : '#1F6B34'));
    o.push(checker(0, 20, '#12305A', '#18406F'), checker(220, 20, '#A8771A', '#C99327'));
    const ezL = 'GO DEEP';
    const ezR = 'SCORE BIG';
    o.push(`<g transform="translate(8 ${TURF_Y + TURF_H / 2 + Math.round(SPR.textWidth(ezL) / 2)}) rotate(-90)"><path fill="#C9D3E2" d="${SPR.textPath(ezL, 0, 0)}"/></g>`);
    o.push(`<g transform="translate(233 ${TURF_Y + TURF_H / 2 - Math.round(SPR.textWidth(ezR) / 2)}) rotate(90)"><path fill="#3A2A06" d="${SPR.textPath(ezR, 0, 0)}"/></g>`);
    // yard lines, goal lines, hash marks
    let lines5 = '';
    let lines10 = '';
    let hash = '';
    for (let yd = 1; yd < 100; yd++) {
      const x = fieldX(yd);
      if (yd % 10 === 0) lines10 += run(x, TURF_Y, 1, TURF_H);
      else if (yd % 5 === 0) lines5 += run(x, TURF_Y, 1, TURF_H);
      else hash += run(x, TURF_Y + 1, 1, 2) + run(x, bottom - 3, 1, 2) + run(x, TURF_Y + 25, 1, 1) + run(x, TURF_Y + 38, 1, 1);
    }
    o.push(`<path fill="rgba(232,241,255,.55)" d="${lines5}"/>`, `<path fill="rgba(232,241,255,.85)" d="${lines10}"/>`, `<path fill="rgba(232,241,255,.6)" d="${hash}"/>`);
    o.push(`<path fill="#F4F7FF" d="${run(19, TURF_Y, 2, TURF_H)}${run(219, TURF_Y, 2, TURF_H)}"/>`);
    // yard numbers (3×5 pixel digits) near both sidelines
    let nums = '';
    for (let k = 1; k <= 9; k++) {
      const yd = k * 10;
      const x = fieldX(yd);
      const label = String(yd <= 50 ? yd : 100 - yd);
      [TURF_Y + 5, bottom - 10].forEach((y) => { nums += SPR.textPath(label[0], x - 4, y) + SPR.textPath(label[1], x + 2, y); });
    }
    o.push(`<path fill="rgba(244,247,255,.8)" d="${nums}"/>`);
    // yard ruler along the top sideline
    let t1 = '';
    let t5 = '';
    let t10 = '';
    for (let yd = 0; yd <= 100; yd++) {
      const x = fieldX(yd);
      if (yd % 10 === 0) t10 += run(x, TURF_Y - 5, 1, 5);
      else if (yd % 5 === 0) t5 += run(x, TURF_Y - 3, 1, 3);
      else t1 += run(x, TURF_Y - 2, 1, 2);
    }
    o.push(`<path fill="#2E4A72" d="${t1}"/>`, `<path fill="#5E7899" d="${t5}"/>`, `<path fill="#8FA3C4" d="${t10}"/>`);
    o.push('<g class="drive" data-role="drive"></g>');
    o.push(`<g class="gline" data-role="gline" style="opacity:0;transform:translate(20px,0px)"><line x1=".5" y1="${TURF_Y}" x2=".5" y2="${bottom}"/></g>`);
    o.push('<g data-role="tiers"></g>');
    o.push(`<g class="qb" data-role="qb" style="opacity:0;transform:translate(20px,0px)"><g transform="translate(-8 ${FEET_Y - 20})">${SPR.frames(['qb-set', 'qb-throw'])}</g></g>`);
    o.push(`<g class="carrier" data-role="carrier" style="transform:translate(20px,0px)">` +
      `<g class="you-flag">${rect(0, 1, 1, TURF_Y - 1, '#A3FF12')}${rect(1, 1, 13, 7, '#A3FF12')}<path fill="#07130A" d="${SPR.textPath('YOU', 2, 2)}"/>` +
      `<path fill="rgba(163,255,18,.45)" d="${(() => { let d = ''; for (let y = TURF_Y + 1; y < FEET_Y - 21; y += 3) d += run(0, y, 1, 1); return d; })()}"/></g>` +
      `<g class="runner" data-role="runner" transform="translate(-8 ${FEET_Y - 20})">` +
      `<g class="set-idle">${SPR.frames(['rb-idle1', 'rb-idle2'])}</g><g class="set-run">${SPR.frames(['rb-run1', 'rb-run2', 'rb-run3', 'rb-run4'])}</g>` +
      `<use class="tuck" href="#spr-rb-tuck" width="16" height="14"/></g>` +
      `<g data-role="dust" transform="translate(-15 ${FEET_Y - 5})">${SPR.frames(['dust-1', 'dust-2', 'dust-3'])}</g></g>`);
    o.push(`<g data-role="pass" style="opacity:0"><g data-role="passy"><g class="spin" transform="translate(-4 -3)">${SPR.frames(['ball-1', 'ball-2', 'ball-3'])}</g></g></g>`);
    o.push(`<g data-role="pflag" style="opacity:0"><g transform="translate(-6 ${FEET_Y - 12})"><use href="#spr-flag" width="12" height="12"/></g></g>`);
    o.push('</svg>');
    return o.join('');
  }

  /** Thin tier-coloured bars, one lane per play: the drive's history. */
  function driveMarkup(plays) {
    let acc = 0;
    let bars = '';
    plays.forEach((p, i) => {
      if (!p) return;
      const y = TURF_Y + 14 + i * 4;
      const x0 = fieldX(fieldProgress(acc));
      if (p.points > 0 && TIERS[p.rarity]) {
        acc += p.points;
        const w = Math.max(1, Math.round(fieldX(fieldProgress(acc)) - x0));
        bars += `<rect class="drive-bar" data-i="${i}" data-tier="${p.rarity}" x="${Math.round(x0)}" y="${y}" width="${w}" height="2"/>`;
      } else {
        bars += `<path class="drive-miss" d="${run(Math.round(x0) - 1, y - 1, 1, 1)}${run(Math.round(x0) + 1, y - 1, 1, 1)}${run(Math.round(x0), y, 1, 1)}${run(Math.round(x0) - 1, y + 1, 1, 1)}${run(Math.round(x0) + 1, y + 1, 1, 1)}"/>`;
      }
    });
    return bars;
  }

  /** HUD pips: one square per play, filled with its tier colour. */
  function pipsMarkup(plays, current) {
    let out = '';
    for (let i = 0; i < CONFIG.ROUNDS; i++) {
      const p = plays[i];
      if (p) {
        const scored = p.points > 0 && TIERS[p.rarity];
        const sr = scored ? `${TIERS[p.rarity].label}, ${p.points} points` : (p.status === 'skipped' ? 'skipped, no points' : 'no gain');
        out += `<li class="pip" data-state="done" data-tier="${scored ? p.rarity : 'miss'}"><span class="sr-only">Play ${i + 1}: ${sr}</span></li>`;
      } else if (i === current) {
        out += `<li class="pip" data-state="current"><span class="sr-only">Play ${i + 1}: in progress</span></li>`;
      } else {
        out += `<li class="pip" data-state="future"><span class="sr-only">Play ${i + 1}: not played yet</span></li>`;
      }
    }
    return out;
  }

  function createField(wrap, hud) {
    const box = wrap.querySelector('[data-role="field"]');
    box.innerHTML = fieldSVG();
    const part = (role) => box.querySelector(`[data-role="${role}"]`);
    const carrier = part('carrier');
    const runner = part('runner');
    const dust = part('dust');
    const drive = part('drive');
    const gline = part('gline');
    const tiersG = part('tiers');
    const qb = part('qb');
    const pass = part('pass');
    const passY = part('passy');
    const pflag = part('pflag');
    const overlay = wrap.querySelector('[data-role="overlay"]');
    const zoneEl = wrap.querySelector('[data-role="zone"]');
    const markerEl = wrap.querySelector('[data-role="marker"]');
    const zonesEl = wrap.querySelector('[data-role="zones"]');
    zonesEl.innerHTML = ZONES.filter((z) => ZONE_CAPS[z.key]).map((z, i) =>
      `<span class="zone-cap z-${z.key} row-${i % 2}" data-min="${z.min}" style="left:${(((fieldX(z.min) + 0.5) / FIELD_W) * 100).toFixed(2)}%">${ZONE_CAPS[z.key]}</span>`).join('');
    const caps = Array.from(zonesEl.children);
    let shownProgress = 0;
    let anims = [];
    let timers = [];

    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
    const anim = (el, keyframes, opts) => {
      if (!el.animate) return null;
      const a = el.animate(keyframes, opts);
      anims.push(a);
      return a;
    };
    function stop() {
      timers.forEach(clearTimeout);
      timers = [];
      anims.forEach((a) => { try { a.cancel(); } catch (err) { /* already gone */ } });
      anims = [];
      runner.classList.remove('is-running', 'no-ball');
      qb.classList.remove('thrown');
      qb.style.opacity = '0';
      pass.style.opacity = '0';
      pflag.style.opacity = '0';
      tiersG.innerHTML = '';
      overlay.innerHTML = '';
    }
    function puff() {
      Array.from(dust.children).forEach((f, i) => anim(f, [{ opacity: 1 }, { opacity: 1 }], { duration: 110, delay: i * 110 }));
    }
    function dropFlag(x, animate) {
      pflag.style.transform = tx(x + 9);
      pflag.style.opacity = '1';
      if (animate) anim(pflag, [{ transform: tx(x + 9, -34) }, { transform: tx(x + 9) }], { duration: 380, easing: 'cubic-bezier(.5,0,1,.6)' });
    }

    /** Tier lines ahead of the ball, the run (or pass) to the earned one, then the others fade. */
    function playGain(play, p0, p1, newIndex) {
      const x0 = fieldX(p0);
      const x1 = fieldX(p1);
      const big = BIG_PLAY.has(play.rarity);
      const earned = TIER_ORDER.indexOf(play.rarity);
      const rows = TIER_ORDER.map((k, i) => ({ k, i, x: fieldX(Math.min(100, p0 + yardsFor(TIERS[k].points))) }));
      tiersG.innerHTML = rows.map((r) => `<g class="tl" data-tier="${r.k}" style="transform:${tx(r.x)}"><line x1=".5" y1="${TURF_Y}" x2=".5" y2="${TURF_Y + TURF_H}"/></g>`).join('');
      overlay.innerHTML = rows.map((r) => {
        const left = ((r.x + 0.5) / FIELD_W) * 100;
        const top = ((TURF_Y + 6 + (5 - r.i) * 10.4) / FIELD_H) * 100;
        return `<span class="tl-label${left > 62 ? ' flip' : ''}" data-tier="${r.k}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%">${escapeHTML(TIERS[r.k].label)} · ${TIERS[r.k].points}</span>`;
      }).join('');
      const lines = Array.from(tiersG.children);
      const labels = Array.from(overlay.children);
      [lines, labels].forEach((list) => list.forEach((el, i) =>
        anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: i * 55, easing: 'steps(2, end)', fill: 'forwards' })));

      const t0 = 400;
      const D = Math.round(Math.min(1250, Math.max(560, 420 + (p1 - p0) * 58)));
      const bar = drive.querySelector(`[data-i="${newIndex}"]`);
      if (bar) anim(bar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: D, delay: t0, easing: big ? 'linear' : 'cubic-bezier(.25,.6,.35,1)', fill: 'backwards' });
      carrier.style.transform = tx(x1);
      anim(carrier, [{ transform: tx(x0) }, { transform: tx(x1) }], { duration: D, delay: t0, easing: big ? 'linear' : 'cubic-bezier(.25,.6,.35,1)', fill: 'backwards' });
      later(() => runner.classList.add('is-running'), t0);

      if (big) {
        // Quarterback drops in behind the line, throws a spiral that lands on the receiver's run.
        runner.classList.add('no-ball');
        qb.style.transform = tx(x0 - 7);
        anim(qb, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 160, easing: 'steps(2, end)', fill: 'forwards' });
        const throwAt = t0 + 240;
        const flight = D - 240;
        const yHand = FEET_Y - 19;
        const yCatch = FEET_Y - 10;
        const apex = Math.min(30, 10 + (x1 - x0) * 0.6);
        later(() => qb.classList.add('thrown'), throwAt);
        anim(pass, [{ opacity: 1, transform: tx(x0 - 4, yHand) }, { opacity: 1, transform: tx(x1 + 3, yCatch) }], { duration: flight, delay: throwAt, easing: 'linear', fill: 'forwards' });
        anim(passY, [
          { transform: tx(0, 0), easing: 'cubic-bezier(.2,.6,.4,1)' },
          { transform: tx(0, -apex), offset: 0.5, easing: 'cubic-bezier(.6,0,.8,.4)' },
          { transform: tx(0, 0) }
        ], { duration: flight, delay: throwAt });
        anim(qb, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: t0 + D + 500, easing: 'steps(3, end)', fill: 'forwards' });
      }

      later(() => {
        runner.classList.remove('is-running', 'no-ball');
        anims.filter((a) => a.effect && a.effect.target === pass).forEach((a) => a.cancel());
        puff();
        lines.forEach((el, i) => {
          if (i === earned) { el.classList.add('earned'); labels[i].classList.add('earned'); return; }
          anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'steps(3, end)', fill: 'forwards' });
          anim(labels[i], [{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: 'steps(3, end)', fill: 'forwards' });
        });
        [lines[earned], labels[earned]].forEach((el) => anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 2200, easing: 'steps(4, end)', fill: 'forwards' }));
      }, t0 + D);
      return t0 + D;
    }

    return {
      render(opts) {
        const o = Object.assign({ plays: [], current: -1, animate: false, live: false, newIndex: -1 }, opts);
        stop();
        const score = totalScore(o.plays);
        const progress = fieldProgress(score);
        const reduced = prefersReducedMotion();
        const instant = !o.animate || reduced;
        const play = o.newIndex >= 0 ? o.plays[o.newIndex] : null;
        const scored = !!(play && play.points > 0 && TIERS[play.rarity]);
        let arriveMs = 0;
        box.dataset.live = o.live ? '1' : '0';
        gline.style.transition = instant ? 'none' : '';
        if (o.live && progress < 100) {
          gline.style.opacity = '1';
          gline.style.transform = tx(fieldX(Math.min(100, progress + 100 / CONFIG.ROUNDS)));
        } else {
          gline.style.opacity = '0';
        }
        drive.innerHTML = driveMarkup(o.plays);
        const zone = zoneFor(progress);
        zoneEl.textContent = zone.label;
        zoneEl.dataset.zone = zone.key;
        markerEl.textContent = yardMarker(progress);
        document.body.dataset.zone = zone.key;
        caps.forEach((c) => c.classList.toggle('passed', progress >= Number(c.dataset.min)));
        if (hud) {
          hud.pips.innerHTML = pipsMarkup(o.plays, o.current);
          animateNumber(hud.yards, instant ? progress : shownProgress, progress, 900, 1);
        }
        box.setAttribute('aria-label', `Football field. ${zone.label}. Ball at ${yardMarker(progress).toLowerCase()}, ${yardsText(progress)} from your goal line. ${score} of ${CONFIG.MAX_SCORE} points.`);
        if (play && o.animate && !scored) {
          carrier.style.transform = tx(fieldX(progress));
          dropFlag(fieldX(progress), !reduced);
        } else if (instant || !scored) {
          carrier.style.transform = tx(fieldX(progress));
        } else {
          arriveMs = playGain(play, fieldProgress(score - play.points), progress, o.newIndex);
        }
        shownProgress = progress;
        return { score, progress, zone, arriveMs };
      }
    };
  }

  /* ---------- effects: lights, confetti, counters, toast, announcements ---------- */
  function flashLights() {
    if (prefersReducedMotion()) return;
    const el = document.getElementById('lights');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  /** Pixel confetti (square particles only) plus pixel fireworks, drawn on a
   *  low-resolution canvas that CSS scales up with crisp pixels. */
  const Confetti = {
    raf: 0,
    run(duration) {
      if (prefersReducedMotion()) return;
      const total = duration || 3800;
      const canvas = document.getElementById('confetti');
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      const P = 4; // one canvas pixel = 4 CSS pixels
      const W = Math.ceil(window.innerWidth / P);
      const H = Math.ceil(window.innerHeight / P);
      canvas.width = W;
      canvas.height = H;
      canvas.hidden = false;
      ctx.imageSmoothingEnabled = false;
      const colors = ['#FFC857', '#A3FF12', '#F3E9D2', '#FF4D57', '#4DA3FF', '#B47CFF', '#FF9F43'];
      const bits = Array.from({ length: 150 }, (_, i) => ({
        x: Math.random() * W, y: -Math.random() * H * 0.8,
        vx: (Math.random() - 0.5) * 0.35, vy: 0.3 + Math.random() * 0.5,
        s: Math.random() < 0.3 ? 2 : 1, c: colors[i % colors.length], ph: Math.random() * 6.28
      }));
      const bursts = Array.from({ length: 7 }, (_, i) => ({
        at: 120 + i * 430 + Math.random() * 180, x: W * (0.15 + Math.random() * 0.7), y: H * (0.1 + Math.random() * 0.28),
        c: colors[(i * 3) % colors.length], parts: null
      }));
      cancelAnimationFrame(this.raf);
      const t0 = performance.now();
      let last = t0;
      const frame = (now) => {
        const t = now - t0;
        const k = Math.min(3, (now - last) / 16.7);
        last = now;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = t > total - 700 ? (t > total - 350 ? 0.35 : 0.7) : 1;
        bits.forEach((b) => {
          b.x += (b.vx + Math.sin(b.ph + t / 320) * 0.12) * k;
          b.y += b.vy * k;
          ctx.fillStyle = b.c;
          ctx.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s);
        });
        bursts.forEach((br) => {
          if (t < br.at) return;
          if (!br.parts) {
            br.parts = Array.from({ length: 26 }, (_, i) => {
              const a = (i / 26) * Math.PI * 2;
              const v = 0.55 + Math.random() * 0.35;
              return { x: br.x, y: br.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
            });
          }
          const life = (t - br.at) / 1100;
          if (life >= 1) return;
          const alpha = ctx.globalAlpha;
          ctx.globalAlpha = alpha * (life < 0.55 ? 1 : life < 0.8 ? 0.6 : 0.3);
          ctx.fillStyle = life < 0.15 ? '#FFFFFF' : br.c;
          br.parts.forEach((p) => {
            p.x += p.vx * k;
            p.y += p.vy * k;
            p.vy += 0.012 * k;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          });
          ctx.globalAlpha = alpha;
        });
        if (t < total) {
          this.raf = requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, W, H);
          canvas.hidden = true;
        }
      };
      this.raf = requestAnimationFrame(frame);
    }
  };

  const counters = new WeakMap();
  /** Count a number up; `decimals` (0 or 1) formats yard values like "12.9". */
  function animateNumber(node, from, to, ms, decimals) {
    const fmt = decimals ? fmtYards : (v) => String(Math.round(v));
    const prev = counters.get(node);
    if (prev) cancelAnimationFrame(prev);
    if (from === to || prefersReducedMotion()) { node.textContent = fmt(to); counters.delete(node); return; }
    const duration = ms || 900;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (p < 1) counters.set(node, requestAnimationFrame(step)); else counters.delete(node);
    };
    node.textContent = fmt(from);
    counters.set(node, requestAnimationFrame(step));
  }

  let toastTimer = 0;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function announce(message, assertive) {
    const el = document.getElementById(assertive ? 'srAssert' : 'srPolite');
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 40);
  }

  function touchdownCelebration() {
    flashLights();
    Confetti.run(4200);
    document.body.classList.add('td-party');
    setTimeout(() => document.body.classList.remove('td-party'), 4200);
    Sound.play('touchdown');
    announce('Touchdown!');
  }

  /* ======================================================================
     5. GAME STATE
     ====================================================================== */
  const TRANSITIONS = {
    HOME: ['KICKOFF', 'PREVIEW', 'ANSWERING', 'REVEAL', 'RESULTS'],
    KICKOFF: ['PREVIEW', 'HOME'],
    PREVIEW: ['ANSWERING', 'HOME'],
    ANSWERING: ['REVEAL', 'HOME'],
    REVEAL: ['PREVIEW', 'RESULTS', 'HOME'],
    RESULTS: ['HOME', 'KICKOFF', 'PREVIEW', 'ANSWERING', 'REVEAL']
  };
  const IN_GAME = ['KICKOFF', 'PREVIEW', 'ANSWERING', 'REVEAL'];

  const state = {
    phase: 'HOME', mode: null, dateKey: null, questions: [], round: 0, plays: [], score: 0,
    attempts: 0, deadline: 0, startedAt: 0, revealAt: 0, lastSubmitAt: 0,
    skipArmed: false, skipTimer: 0, warned: {}, lastTick: null, lastSummary: null, typo: null
  };
  const dom = {};
  let gameField = null;

  function setPhase(next) {
    if (next === state.phase) return next === 'HOME';
    const allowed = TRANSITIONS[state.phase] || [];
    if (allowed.indexOf(next) === -1) {
      console.warn(`[GRONKILLION] Ignored transition ${state.phase} → ${next}`);
      return false;
    }
    state.phase = next;
    document.body.dataset.phase = next.toLowerCase();
    if (dom.qcard) dom.qcard.dataset.phase = next.toLowerCase();
    return true;
  }
  const currentQuestion = () => state.questions[state.round];

  // In-progress drives are saved per mode so a refresh never breaks the game.
  const progressKey = (mode) => 'progress-' + mode;
  function saveProgress() {
    if (!state.mode || IN_GAME.indexOf(state.phase) === -1) return;
    Store.set(progressKey(state.mode), {
      v: 1, mode: state.mode, dateKey: state.dateKey,
      qids: state.questions.map((q) => q.id), round: state.round, phase: state.phase,
      deadline: state.deadline, plays: state.plays.slice(0, CONFIG.ROUNDS).map((p) => p || null),
      attempts: state.attempts, startedAt: state.startedAt, savedAt: Date.now()
    });
  }
  function loadProgress(mode) {
    const p = Store.get(progressKey(mode), null, validProgress);
    if (!p) return null;
    const stale = Date.now() - p.savedAt > CONFIG.RESUME_MAX_AGE_MS;
    const wrongDay = mode === 'daily' && p.dateKey !== utcDateKey();
    const missing = p.qids.some((id) => !QUESTION_BY_ID.has(id));
    const rec = mode === 'daily' ? loadDailyRecord() : null;
    const alreadyDone = !!(rec && rec.date === p.dateKey);
    if (stale || wrongDay || missing || alreadyDone || p.mode !== mode) {
      Store.remove(progressKey(mode));
      return null;
    }
    return p;
  }
  const clearProgress = (mode) => Store.remove(progressKey(mode));

  function recordFinishedGame(summary) {
    const stats = loadStats();
    stats.gamesPlayed += 1;
    const best = bestTierOf(summary.plays);
    if (best && (!stats.bestTier || !TIERS[stats.bestTier] || TIERS[best].order > TIERS[stats.bestTier].order)) stats.bestTier = best;
    let newHigh = false;
    if (summary.mode === 'unlimited') {
      stats.unlimitedGames = (stats.unlimitedGames || 0) + 1;
      if (summary.score > (stats.unlimitedHigh || 0)) { newHigh = true; stats.unlimitedHigh = summary.score; }
      const recent = Store.get('recent', [], validRecent);
      Store.set('recent', summary.qids.concat(recent.filter((id) => summary.qids.indexOf(id) === -1)).slice(0, CONFIG.RECENT_MEMORY));
    } else {
      stats.dailyGames = (stats.dailyGames || 0) + 1;
      Store.set('daily', {
        date: summary.dateKey, score: summary.score, qids: summary.qids, plays: summary.plays,
        finishedAt: summary.finishedAt, forfeited: !!summary.forfeited
      });
    }
    Store.set('stats', stats);
    return { newHigh: newHigh && summary.score > 0 };
  }

  /* ======================================================================
     9. SCREEN RENDERING
     ====================================================================== */
  function cacheDom() {
    ['topGame', 'topPlay', 'topMode', 'topScoreWrap', 'topScore', 'hudYards', 'hudPips', 'soundBtn', 'helpBtn', 'brandBtn',
      'screen-home', 'screen-game', 'screen-results', 'kickoffBtn', 'kickoffSub', 'dailyBtn', 'unlimitedBtn', 'howBtn',
      'resumeBox', 'homeMeta', 'homeRunner', 'dailyNote', 'statHigh', 'statDaily', 'statGames', 'statTier', 'storageNote',
      'qcard', 'qCategory', 'qCount', 'snapCap', 'snapNum', 'timer', 'timerDial', 'timerNum', 'clockFill', 'qPrompt', 'qScope',
      'answerForm', 'typoChip', 'typoFrom', 'typoTo', 'inputWrap', 'answerInput', 'submitBtn', 'feedback', 'skipBtn',
      'reveal', 'rvStatus', 'rvMascot', 'rvAnswer', 'rvTier', 'rvPoints', 'rvFlavor', 'rvNote', 'rvMore', 'nextBtn',
      'gameField', 'resHero', 'resMode', 'resScore', 'resYard', 'resRank', 'resMsg', 'resBadge', 'resLog', 'resLegend', 'resPlays',
      'copyBtn', 'replayBtn', 'shareBtn', 'resHomeBtn', 'resHowBtn', 'resNext',
      'howDialog', 'tierTable', 'confirmDialog', 'confirmTitle', 'confirmText', 'confirmOk', 'confirmCancel',
      'shareDialog', 'shareText', 'shareCopy', 'kickoffFx', 'koKicker', 'koBall', 'flashes']
      .forEach((id) => { dom[id.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = document.getElementById(id); });
  }
  const setBtnLabel = (btn, text) => { const span = btn.querySelector('span'); if (span) span.textContent = text; };

  let tickerId = 0;
  function startTicker(fn) { stopTicker(); fn(); tickerId = setInterval(fn, 1000); }
  function stopTicker() { if (tickerId) clearInterval(tickerId); tickerId = 0; }

  function showScreen(name) {
    dom.screenHome.hidden = name !== 'home';
    dom.screenGame.hidden = name !== 'game';
    dom.screenResults.hidden = name !== 'results';
    dom.topGame.hidden = name !== 'game';
    dom.topScoreWrap.hidden = name !== 'game';
    if (name === 'home') {
      document.body.dataset.zone = 'home';
      let lastKey = utcDateKey();
      startTicker(() => {
        if (utcDateKey() !== lastKey) { lastKey = utcDateKey(); renderHome(); }
        updateDailyNote();
      });
    } else if (name === 'results') {
      startTicker(updateResultsNext);
    } else {
      stopTicker();
    }
    window.scrollTo(0, 0);
  }

  function kickoffTarget() {
    const rec = loadDailyRecord();
    const doneToday = !!(rec && rec.date === utcDateKey());
    if (loadProgress('daily')) return { mode: 'daily', resume: true, label: "Resume today's Daily Challenge" };
    if (!doneToday) return { mode: 'daily', resume: false, label: "Today's Daily Challenge" };
    if (loadProgress('unlimited')) return { mode: 'unlimited', resume: true, label: 'Resume your Unlimited drive' };
    return { mode: 'unlimited', resume: false, label: 'Unlimited Mode' };
  }

  function renderHome() {
    const stats = loadStats();
    const rec = loadDailyRecord();
    const doneToday = !!(rec && rec.date === utcDateKey());
    const pDaily = loadProgress('daily');
    const pUnl = loadProgress('unlimited');
    dom.statHigh.textContent = String(stats.unlimitedHigh || 0);
    dom.statGames.textContent = String(stats.gamesPlayed || 0);
    dom.statDaily.innerHTML = doneToday ? `${rec.score}<span class="small"> / 700</span>` :
      (pDaily ? '<span class="small">In progress</span>' : '<span class="small">Not played</span>');
    dom.statTier.innerHTML = stats.bestTier && TIERS[stats.bestTier] ?
      `<span class="mini-tier" data-tier="${stats.bestTier}">${SPR.svg(SPR.TIER_MASCOT[stats.bestTier])}${escapeHTML(TIERS[stats.bestTier].label)}</span>` :
      '<span class="small">None yet</span>';
    // No streak data is stored, so the meta line is just today's (UTC) date.
    dom.homeMeta.textContent = formatDateKey(utcDateKey());
    const rows = [];
    [pDaily, pUnl].forEach((p) => {
      if (!p) return;
      const label = p.mode === 'daily' ? "Today's Daily Challenge" : 'Your Unlimited drive';
      rows.push(`<div class="resume-row"><p>${label} is in progress<span>Play ${p.round + 1} of ${CONFIG.ROUNDS}, ${totalScore(p.plays)} points so far</span></p>` +
        `<button type="button" class="btn btn-primary btn-sm" data-action="resume" data-mode="${p.mode}"><span>Resume</span></button>` +
        `<button type="button" class="btn btn-ghost btn-sm" data-action="abandon" data-mode="${p.mode}"><span>${p.mode === 'daily' ? 'Forfeit' : 'Abandon'}</span></button></div>`);
    });
    dom.resumeBox.innerHTML = rows.join('');
    dom.resumeBox.hidden = rows.length === 0;
    dom.kickoffSub.textContent = kickoffTarget().label;
    setBtnLabel(dom.dailyBtn, doneToday ? "Today's Results" : (pDaily ? 'Resume Daily' : 'Daily Challenge'));
    setBtnLabel(dom.unlimitedBtn, pUnl ? 'Resume Unlimited' : 'Unlimited Mode');
    dom.storageNote.hidden = Store.available;
    updateDailyNote();
  }

  function updateDailyNote() {
    const rec = loadDailyRecord();
    const done = !!(rec && rec.date === utcDateKey());
    const left = formatCountdown(nextUtcMidnight() - Date.now());
    const local = escapeHTML(localResetTime());
    dom.dailyNote.innerHTML = done ?
      `Daily complete. The next Daily Challenge starts in <strong>${left}</strong> (${local} your time).` :
      `Today's Daily Challenge resets in <strong>${left}</strong> (${local} your time).`;
  }

  function updateResultsNext() {
    const s = state.lastSummary;
    if (!s) { dom.resNext.textContent = ''; return; }
    dom.resNext.innerHTML = s.mode === 'daily' ?
      `The next Daily Challenge starts in <strong>${formatCountdown(nextUtcMidnight() - Date.now())}</strong> (${escapeHTML(localResetTime())} your time).` :
      'Unlimited Mode never closes. Run it back whenever you like.';
  }

  function renderTopbar() {
    dom.topPlay.textContent = `Play ${state.round + 1} of ${CONFIG.ROUNDS}`;
    dom.topMode.textContent = state.mode === 'daily' ? 'Daily' : 'Unlimited';
  }

  /* Autocorrect confirm: a typo match is shown as a chip and needs a second submit. */
  function showTypo(input, canonical) {
    state.typo = { input, canonical };
    dom.typoFrom.textContent = `“${input}”`;
    dom.typoTo.textContent = `“${canonical}”`;
    dom.typoChip.hidden = false;
  }
  function clearTypo() {
    state.typo = null;
    dom.typoChip.hidden = true;
  }

  function setFeedback(text, tone, note) {
    dom.feedback.className = 'feedback' + (tone ? ' is-' + tone : '');
    dom.feedback.innerHTML = text ? escapeHTML(text) + (note ? `<span class="fb-note">${escapeHTML(note)}</span>` : '') : '';
  }

  function resetSkip() {
    state.skipArmed = false;
    clearTimeout(state.skipTimer);
    dom.skipBtn.textContent = 'Skip play';
    dom.skipBtn.classList.remove('armed');
  }

  function setAnswerEnabled(enabled) {
    if (enabled) {
      dom.answerInput.removeAttribute('aria-disabled');
      dom.answerInput.placeholder = 'type one answer…';
      dom.submitBtn.removeAttribute('aria-disabled');
    } else {
      dom.answerInput.setAttribute('aria-disabled', 'true');
      dom.answerInput.placeholder = 'read the play…';
      dom.submitBtn.setAttribute('aria-disabled', 'true');
    }
    dom.skipBtn.disabled = !enabled;
  }

  function renderQuestion() {
    const q = currentQuestion();
    dom.qCategory.textContent = q.category;
    dom.qCount.textContent = `Play ${state.round + 1} of ${CONFIG.ROUNDS}`;
    dom.qPrompt.textContent = q.prompt;
    dom.qScope.textContent = q.scope;
    dom.answerForm.hidden = false;
    dom.reveal.hidden = true;
    dom.answerInput.value = '';
    setFeedback('', null);
    dom.inputWrap.classList.remove('ok', 'bad', 'shake');
    clearTypo();
    resetSkip();
    dom.qcard.classList.remove('enter');
    void dom.qcard.offsetWidth;
    dom.qcard.classList.add('enter');
    renderTopbar();
  }

  // Pixel dial: 24 square segments around the clock face, lit clockwise from the top.
  const DIAL_SEGS = 24;
  let dialSegs = [];
  let dialLit = -1;
  function buildDial() {
    let out = '';
    for (let i = 0; i < DIAL_SEGS; i++) {
      const a = ((i / DIAL_SEGS) * 360 - 90) * (Math.PI / 180);
      out += `<rect class="seg" x="${Math.round(15 + Math.cos(a) * 13)}" y="${Math.round(15 + Math.sin(a) * 13)}" width="2" height="2"/>`;
    }
    dom.timerDial.innerHTML = out;
    dialSegs = Array.from(dom.timerDial.children);
  }

  function renderTimer(mode, leftMs) {
    const total = mode === 'snap' ? CONFIG.PREVIEW_MS : CONFIG.ANSWER_MS;
    const secs = Math.max(0, Math.ceil(leftMs / 1000));
    const frac = Math.max(0, Math.min(1, leftMs / total));
    dom.clockFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    const lit = Math.ceil(frac * DIAL_SEGS);
    if (lit !== dialLit) {
      dialLit = lit;
      dialSegs.forEach((seg, i) => seg.classList.toggle('on', i < lit));
    }
    let st = 'go';
    if (mode === 'off') st = 'off';
    else if (mode === 'snap') st = 'snap';
    else if (secs <= CONFIG.DANGER_SECONDS) st = 'danger';
    else if (secs <= CONFIG.WARN_SECONDS) st = 'warn';
    if (dom.timer.dataset.state !== st) { dom.timer.dataset.state = st; dom.answerForm.dataset.clock = st; }
    const text = String(secs);
    if (dom.timerNum.textContent !== text) {
      dom.timerNum.textContent = text;
      dom.timer.setAttribute('aria-label', mode === 'snap' ? `Snap count: ${text}` : `Play clock: ${text} seconds left`);
    }
    if (mode === 'snap' && dom.snapNum.textContent !== text) dom.snapNum.textContent = text;
  }

  function suggestionsFor(q, excludeCanonical) {
    const pool = q.answers.filter((a) => a.canonical !== excludeCanonical);
    const out = [];
    for (let i = TIER_ORDER.length - 1; i >= 0 && out.length < 3; i--) {
      const inTier = pool.filter((a) => a.rarity === TIER_ORDER[i]);
      if (inTier.length) out.push(pick(inTier));
    }
    return out;
  }

  function renderReveal(play, q, opts) {
    const animate = !!opts.animate;
    const prevScore = opts.prevScore;
    const scored = play.status === 'accepted' && play.points > 0 && TIERS[play.rarity];
    const tierKey = scored ? play.rarity : 'miss';
    dom.answerForm.hidden = true;
    dom.reveal.hidden = false;
    dom.reveal.classList.toggle('is-miss', !scored);
    dom.reveal.dataset.tier = tierKey;

    dom.rvStatus.textContent = scored ? 'Accepted' : (play.status === 'timeout' ? "Time's up" : play.status === 'skipped' ? 'Play skipped' : 'No gain');
    dom.rvMascot.innerHTML = SPR.svg(SPR.TIER_MASCOT[tierKey]);
    dom.rvAnswer.textContent = scored ? play.canonical : (play.status === 'skipped' ? 'Punt' : 'Delay of game');
    dom.rvTier.dataset.tier = tierKey;
    dom.rvTier.textContent = scored ? TIERS[play.rarity].label : 'No gain';
    dom.rvPoints.innerHTML = `<b>+${play.points} PTS</b> · ${scored ? `+${fmtYards(yardsFor(play.points))} YDS` : 'NO GAIN'}`;
    dom.rvFlavor.textContent = pick(FLAVOR[scored ? play.rarity : play.status] || FLAVOR.timeout);

    let note = '';
    if (scored && play.input && normalize(play.input) !== normalize(play.canonical)) note = `You typed “${play.input}”, accepted as ${play.canonical}.`;
    if (!scored && play.pending && TIERS[play.pending.rarity]) note = `So close: “${play.pending.input}” would have scored +${play.pending.points} (${TIERS[play.pending.rarity].label}). Submit before the clock hits zero.`;
    if (scored && play.attempts > 0) note += (note ? ' ' : '') + `Locked in after ${play.attempts} ${play.attempts === 1 ? 'miss' : 'misses'}.`;
    dom.rvNote.textContent = note;
    dom.rvNote.hidden = !note;

    const others = suggestionsFor(q, scored ? play.canonical : null);
    dom.rvMore.innerHTML = `<h3>${scored ? 'Other deep cuts' : 'Answers that would have worked'} (${q.answers.length} accepted answers in all)</h3>` +
      `<ul>${others.map((a) => `<li data-tier="${a.rarity}">${escapeHTML(a.canonical)} <small>${escapeHTML(TIERS[a.rarity].label)}</small></li>`).join('')}</ul>`;
    dom.rvMore.hidden = others.length === 0;
    setBtnLabel(dom.nextBtn, state.round >= CONFIG.ROUNDS - 1 ? 'Final Whistle ▶' : 'Next Play ▶');

    animateNumber(dom.topScore, animate ? prevScore : state.score, state.score);
    const drawn = gameField.render({ plays: state.plays, current: -1, animate, live: false, newIndex: animate ? state.round : -1 });
    const arrive = Math.max(300, drawn.arriveMs || 0); // celebrate when the ball carrier gets there

    const zone = zoneFor(fieldProgress(state.score));
    const summaryLine = scored ?
      `Accepted: ${play.canonical}. ${TIERS[play.rarity].label}, plus ${play.points} points.` :
      `${play.status === 'timeout' ? "Time's up" : 'Play skipped'}. No points.`;
    announce(`${summaryLine} Total ${state.score} points. ${zone.label}, ${yardMarker(fieldProgress(state.score)).toLowerCase()}.`);

    if (animate) {
      if (scored) {
        if (play.rarity === 'gronkillion') { Sound.play('gronk'); Delays.add(flashLights, arrive); }
        else if (play.rarity === 'hall_of_famer' || play.rarity === 'all_pro') Sound.play('rare');
        else Sound.play('correct');
      } else {
        Sound.play('whistle');
      }
      const before = fieldProgress(prevScore);
      const after = fieldProgress(state.score);
      if (after >= 100 && before < 100) Delays.add(touchdownCelebration, arrive);
      else if (after >= 80 && before < 80) Delays.add(flashLights, arrive);
    }
    Delays.add(() => {
      if (state.phase === 'REVEAL') {
        try { dom.nextBtn.focus({ preventScroll: true }); } catch (err) { dom.nextBtn.focus(); }
        dom.reveal.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }, animate ? CONFIG.NEXT_GUARD_MS : 0);
  }

  /** Drive log: one stem per play, height = yards gained, topped with the tier mascot. */
  function driveLogMarkup(plays, grow) {
    const MAX = 16; // yards; a 100-point play gains 14.3
    const ticks = [0, 5, 10, 15];
    const cols = [];
    const spoken = [];
    for (let i = 0; i < CONFIG.ROUNDS; i++) {
      const p = plays[i];
      if (p && p.points > 0 && TIERS[p.rarity]) {
        const yd = yardsFor(p.points);
        cols.push(`<div class="log-col" data-tier="${p.rarity}"><span class="log-bar" style="--h:${((yd / MAX) * 100).toFixed(2)};--i:${i}">${SPR.svg(SPR.TIER_MASCOT[p.rarity])}</span></div>`);
        spoken.push(`play ${i + 1}, ${fmtYards(yd)} yards, ${TIERS[p.rarity].label}`);
      } else {
        cols.push('<div class="log-col"><span class="log-miss">✕</span></div>');
        spoken.push(`play ${i + 1}, no gain`);
      }
    }
    dom.resLog.setAttribute('role', 'img');
    dom.resLog.setAttribute('aria-label', `Drive log: ${spoken.join('; ')}.`);
    return `<div class="log-y">${ticks.map((t) => `<span style="bottom:${(t / MAX) * 100}%">${t}</span>`).join('')}</div>` +
      `<div class="log-plot${grow ? ' grow' : ''}">${ticks.slice(1).map((t) => `<span class="log-grid" style="bottom:${(t / MAX) * 100}%"></span>`).join('')}` +
      `<div class="log-cols">${cols.join('')}</div></div>` +
      `<div class="log-x">${Array.from({ length: CONFIG.ROUNDS }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>`;
  }

  function legendMarkup(rank) {
    return RANKS.map((r, i) => {
      const hi = RANKS[i + 1] ? RANKS[i + 1].min - 1 : CONFIG.MAX_SCORE;
      const you = r.key === rank.key;
      return `<tr${you ? ' class="is-you" aria-current="true"' : ''}><td class="lg-range">${r.min}–${hi}</td>` +
        `<td class="lg-title">${escapeHTML(r.label)}</td><td class="lg-msg">${escapeHTML(r.msg)}</td></tr>`;
    }).join('');
  }

  function renderResults(summary, opts) {
    const o = Object.assign({ newHigh: false, viewOnly: false }, opts);
    const rank = rankFor(summary.score);
    const progress = fieldProgress(summary.score);
    state.lastSummary = summary;
    dom.resHero.dataset.rank = rank.key;
    dom.resMode.textContent = summary.mode === 'daily' ?
      `Daily · ${formatDateKey(summary.dateKey)}${summary.forfeited ? ' (forfeited)' : ''}` : 'Unlimited';
    dom.resYard.textContent = yardMarker(progress);
    dom.resRank.textContent = rank.label;
    dom.resMsg.textContent = rank.msg;
    dom.resBadge.hidden = !o.newHigh;
    dom.resLog.innerHTML = driveLogMarkup(summary.plays, !o.viewOnly);
    dom.resLegend.querySelector('tbody').innerHTML = legendMarkup(rank);

    dom.resPlays.innerHTML = summary.plays.map((p, i) => {
      const q = QUESTION_BY_ID.get(p ? p.qid : summary.qids[i]);
      const scored = p && p.points > 0 && TIERS[p.rarity];
      const tier = scored ? p.rarity : 'miss';
      const answer = scored ?
        `<b>${escapeHTML(p.canonical)}</b> <span class="rp-tier">${escapeHTML(TIERS[p.rarity].label)}</span>` :
        (p && p.status === 'skipped' ? 'Skipped' : p && p.status === 'forfeit' ? 'Forfeited' : 'Timed out');
      return `<li class="res-play notch" data-tier="${tier}"><span class="rp-num" aria-hidden="true">${i + 1}</span>` +
        `<p class="rp-q"><span class="rp-cat">${escapeHTML(q ? q.category : '')}</span>${escapeHTML(q ? q.prompt : 'Retired question')}</p>` +
        `<p class="rp-a"><span class="sr-only">Play ${i + 1}. </span>Your answer: ${answer}</p>` +
        `<span class="rp-pts">+${p ? p.points : 0}</span></li>`;
    }).join('');

    setBtnLabel(dom.replayBtn, summary.mode === 'daily' ? (loadProgress('unlimited') ? 'Resume Unlimited ▶' : 'Play Unlimited ▶') : 'Play Again ▶');
    showScreen('results');
    document.body.dataset.zone = zoneFor(progress).key;
    animateNumber(dom.resScore, o.viewOnly ? summary.score : 0, summary.score, 1200);
    try { dom.resRank.focus({ preventScroll: true }); } catch (err) { dom.resRank.focus(); }
  }

  function buildTierTable() {
    dom.tierTable.querySelector('tbody').innerHTML = TIER_ORDER.map((k) => {
      const t = TIERS[k];
      return `<tr data-tier="${k}"><td>${SPR.svg(SPR.TIER_MASCOT[k])}</td><td><span class="tt-name">${escapeHTML(t.label)}</span><br><span class="tt-desc">${escapeHTML(t.desc)}</span></td><td class="tt-pts">${t.points} pts</td></tr>`;
    }).join('');
  }

  /* ======================================================================
     5b. GAME FLOW
     ====================================================================== */
  function focusAnswer() {
    try { dom.answerInput.focus({ preventScroll: true }); } catch (err) { dom.answerInput.focus(); }
  }

  function startNewGame(mode) {
    if (state.phase !== 'HOME' && state.phase !== 'RESULTS') return;
    const today = utcDateKey();
    if (mode === 'daily') {
      const rec = loadDailyRecord();
      if (rec && rec.date === today) { showDailyResults(rec); return; }
      if (loadProgress('daily')) { resumeGame('daily'); return; }
    } else if (loadProgress('unlimited')) {
      resumeGame('unlimited');
      return;
    }
    Object.assign(state, {
      mode, dateKey: mode === 'daily' ? today : null,
      questions: mode === 'daily' ? dailyQuestions(today) : unlimitedQuestions(),
      round: 0, plays: [], score: 0, attempts: 0, deadline: 0, startedAt: Date.now(), revealAt: 0
    });
    if (!setPhase('KICKOFF')) return;
    showScreen('game');
    renderTopbar();
    dom.qCategory.textContent = 'Kickoff';
    dom.qCount.textContent = `Play 1 of ${CONFIG.ROUNDS}`;
    dom.qPrompt.textContent = 'Get ready…';
    dom.qScope.textContent = '';
    dom.answerForm.hidden = false;
    dom.reveal.hidden = true;
    setFeedback('', null);
    setAnswerEnabled(false);
    renderTimer('snap', CONFIG.PREVIEW_MS);
    animateNumber(dom.topScore, 0, 0);
    gameField.render({ plays: [], current: 0, animate: false });
    saveProgress();
    Sound.play('kickoff');
    announce(mode === 'daily' ? "Kickoff! Today's Daily Challenge." : 'Kickoff! Unlimited Mode.');
    runKickoff(startRound);
  }

  function runKickoff(done) {
    if (prefersReducedMotion()) { Delays.add(done, 150); return; }
    const fx = dom.kickoffFx;
    fx.hidden = false;
    fx.classList.remove('run');
    void fx.offsetWidth;
    fx.classList.add('run');
    Delays.add(() => { fx.hidden = true; fx.classList.remove('run'); done(); }, CONFIG.KICKOFF_MS);
  }

  function startRound() {
    if (!setPhase('PREVIEW')) return;
    Timer.stop();
    Object.assign(state, { attempts: 0, deadline: 0, lastSubmitAt: 0, warned: {}, lastTick: null });
    renderQuestion();
    setAnswerEnabled(false);
    gameField.render({ plays: state.plays, current: state.round, animate: false, live: true });
    renderTimer('snap', CONFIG.PREVIEW_MS);
    saveProgress();
    const q = currentQuestion();
    announce(`Play ${state.round + 1} of ${CONFIG.ROUNDS}. ${q.category}. ${q.prompt} Answering opens in 3 seconds.`);
    focusAnswer();
    Timer.run({ endAt: Date.now() + CONFIG.PREVIEW_MS, onTick: (left) => renderTimer('snap', left), onDone: () => beginAnswering() });
  }

  function beginAnswering(resumeDeadline) {
    if (!setPhase('ANSWERING')) return;
    state.deadline = resumeDeadline || (Date.now() + CONFIG.ANSWER_MS);
    if (!resumeDeadline) dom.answerInput.value = '';
    setAnswerEnabled(true);
    saveProgress();
    Sound.play('snap');
    announce(resumeDeadline ? `Back in the huddle. ${Math.ceil((state.deadline - Date.now()) / 1000)} seconds left.` : 'Go! 25 seconds.');
    focusAnswer();
    Timer.run({ endAt: state.deadline, onTick: onAnswerTick, onDone: onTimeUp });
  }

  function onAnswerTick(left) {
    renderTimer('answer', left);
    const secs = Math.ceil(left / 1000);
    if (secs <= CONFIG.WARN_SECONDS && !state.warned.warn) { state.warned.warn = true; announce(`${CONFIG.WARN_SECONDS} seconds left.`); }
    if (secs <= CONFIG.DANGER_SECONDS && !state.warned.danger) { state.warned.danger = true; announce(`${CONFIG.DANGER_SECONDS} seconds left.`, true); }
    if (secs <= CONFIG.DANGER_SECONDS && secs > 0 && state.lastTick !== secs) { state.lastTick = secs; Sound.play('tick'); }
  }

  function onTimeUp() {
    if (state.phase !== 'ANSWERING') return;
    const q = currentQuestion();
    const raw = dom.answerInput.value;
    const res = validate(q, raw);
    const pending = res.kind === 'accepted' ? { input: raw.trim().slice(0, 64), canonical: res.answer.canonical, rarity: res.answer.rarity, points: res.answer.points } : null;
    renderTimer('off', 0);
    announce("Time's up.", true);
    finishRound({ status: 'timeout', pending });
  }

  function onSubmit(event) {
    event.preventDefault();
    if (state.phase === 'PREVIEW' || state.phase === 'KICKOFF') { setFeedback('Hold on. Answering opens after the snap.', 'info'); return; }
    if (state.phase !== 'ANSWERING') return;
    const now = Date.now();
    if (now - state.lastSubmitAt < CONFIG.SUBMIT_DEBOUNCE_MS) return; // double-submit guard
    state.lastSubmitAt = now;
    if (now >= state.deadline) { Timer.check(); return; }
    const q = currentQuestion();
    const raw = dom.answerInput.value;
    const res = validate(q, raw);
    if (res.kind === 'accepted') {
      // A typo correction is never locked in on the first submit: show it, and let a
      // second submit of the same text confirm it. Exact/alias/surname matches go straight through.
      const typed = raw.trim();
      const confirmed = state.typo && state.typo.input === typed && state.typo.canonical === res.answer.canonical;
      if (res.via === 'typo' && !confirmed) {
        showTypo(typed, res.answer.canonical);
        setFeedback('', null);
        dom.inputWrap.classList.remove('shake', 'bad');
        Sound.play('nudge');
        announce(`Did you mean ${res.answer.canonical}? Submit again to confirm, or edit your answer.`);
        focusAnswer();
        return;
      }
      finishRound({ status: 'accepted', input: raw, answer: res.answer, via: res.via });
      return;
    }
    clearTypo();
    const fb = feedbackFor(res, raw, q);
    setFeedback(fb.text, fb.tone, fb.note);
    if (res.kind === 'empty') { focusAnswer(); return; }
    dom.inputWrap.classList.remove('shake', 'bad');
    void dom.inputWrap.offsetWidth;
    if (fb.tone === 'error') {
      state.attempts += 1;
      dom.inputWrap.classList.add('shake', 'bad');
      Sound.play('wrong');
    } else {
      Sound.play('nudge');
    }
    saveProgress();
    focusAnswer();
    dom.answerInput.select();
  }

  function onSkip() {
    if (state.phase !== 'ANSWERING') return;
    if (!state.skipArmed) {
      state.skipArmed = true;
      dom.skipBtn.textContent = 'Tap again to skip';
      dom.skipBtn.classList.add('armed');
      clearTimeout(state.skipTimer);
      state.skipTimer = setTimeout(resetSkip, 2600);
      return;
    }
    finishRound({ status: 'skipped' });
  }

  function finishRound(result) {
    if (state.phase !== 'ANSWERING') return;
    if (!setPhase('REVEAL')) return;
    Timer.stop();
    resetSkip();
    clearTypo();
    const q = currentQuestion();
    const prevScore = state.score;
    const a = result.answer || null;
    const play = {
      qid: q.id, status: result.status, input: String(result.input || '').trim().slice(0, 64),
      canonical: a ? a.canonical : null, rarity: a ? a.rarity : null, points: a ? a.points : 0,
      via: result.via || null, attempts: state.attempts, pending: result.pending || null
    };
    state.plays[state.round] = play;
    state.score = totalScore(state.plays);
    state.revealAt = Date.now();
    saveProgress();
    if (a) {
      // Green confirmation on the input, then the reveal.
      dom.inputWrap.classList.remove('bad', 'shake');
      dom.inputWrap.classList.add('ok');
      setFeedback('Accepted!', 'ok');
      Delays.add(() => { if (state.phase === 'REVEAL') renderReveal(play, q, { prevScore, animate: true }); }, prefersReducedMotion() ? 0 : CONFIG.CONFIRM_FLASH_MS);
    } else {
      renderReveal(play, q, { prevScore, animate: true });
    }
  }

  function onNext(event) {
    if (state.phase !== 'REVEAL') return;
    // Keyboard activations (detail 0) right after the reveal are usually the same Enter press repeating.
    const keyboard = !event || event.detail === 0;
    if (keyboard && Date.now() - state.revealAt < CONFIG.NEXT_GUARD_MS) return;
    if (dom.reveal.hidden) return; // confirmation still showing
    if (state.round >= CONFIG.ROUNDS - 1) { finishGame(); return; }
    state.round += 1;
    startRound();
  }

  function finishGame() {
    if (!setPhase('RESULTS')) return;
    Timer.stop();
    const summary = {
      mode: state.mode, dateKey: state.dateKey, qids: state.questions.map((q) => q.id),
      plays: state.plays.slice(0, CONFIG.ROUNDS), score: totalScore(state.plays), finishedAt: Date.now()
    };
    const outcomeInfo = recordFinishedGame(summary);
    clearProgress(state.mode);
    renderResults(summary, { newHigh: outcomeInfo.newHigh });
    const rank = rankFor(summary.score);
    announce(`Final score: ${summary.score} out of ${CONFIG.MAX_SCORE}. Rank: ${rank.label}. ${rank.msg}`);
    if (summary.score >= CONFIG.MAX_SCORE) Delays.add(touchdownCelebration, 700);
    else if (summary.score >= 500) { Delays.add(flashLights, 500); Sound.play('rare'); }
    else Sound.play('whistle');
  }

  function showDailyResults(rec) {
    if (!setPhase('RESULTS')) return;
    renderResults({ mode: 'daily', dateKey: rec.date, qids: rec.qids, plays: rec.plays, score: rec.score, finishedAt: rec.finishedAt, forfeited: rec.forfeited }, { viewOnly: true });
  }

  function resumeGame(mode) {
    if (state.phase !== 'HOME' && state.phase !== 'RESULTS') return;
    const p = loadProgress(mode);
    if (!p) { renderHome(); return; }
    const questions = p.qids.map((id) => QUESTION_BY_ID.get(id));
    const plays = p.plays.slice(0, CONFIG.ROUNDS);
    Object.assign(state, {
      mode: p.mode, dateKey: p.dateKey, questions, round: p.round, plays, score: totalScore(plays),
      attempts: p.attempts || 0, deadline: 0, startedAt: p.startedAt || Date.now(), revealAt: 0, lastSubmitAt: 0, warned: {}, lastTick: null
    });
    showScreen('game');
    renderTopbar();
    animateNumber(dom.topScore, state.score, state.score);
    const q = currentQuestion();
    if (plays[p.round]) {
      if (!setPhase('REVEAL')) return;
      renderQuestion();
      renderReveal(plays[p.round], q, { prevScore: state.score, animate: false });
      return;
    }
    if (p.phase === 'ANSWERING' && p.deadline) {
      renderQuestion();
      gameField.render({ plays, current: p.round, animate: false, live: true });
      if (Date.now() < p.deadline - 300) {
        beginAnswering(p.deadline);
      } else if (setPhase('ANSWERING')) {
        onTimeUp(); // the play clock ran out while the player was away
      }
      return;
    }
    startRound();
  }

  function goHome() {
    Timer.stop();
    Delays.clear();
    resetSkip();
    clearTypo();
    document.body.classList.remove('td-party');
    dom.kickoffFx.hidden = true;
    dom.kickoffFx.classList.remove('run');
    setPhase('HOME');
    renderHome();
    showScreen('home');
  }

  async function requestExit() {
    if (IN_GAME.indexOf(state.phase) !== -1) {
      const clockRunning = state.phase !== 'REVEAL';
      const ok = await confirmAction({
        title: 'Leave this drive?',
        text: clockRunning ? 'Your drive is saved, but the play clock keeps running while you are away. Resume it from the home screen.' : 'Your drive is saved. Resume it from the home screen.',
        ok: 'Leave', cancel: 'Keep playing'
      });
      if (!ok) return;
      saveProgress();
    }
    goHome();
  }

  async function abandonProgress(mode) {
    const p = loadProgress(mode);
    if (!p) { renderHome(); return; }
    if (mode === 'daily') {
      const ok = await confirmAction({
        title: "Forfeit today's Daily?",
        text: "You get one scored Daily Challenge per day. Forfeiting locks in your current score and ends today's attempt.",
        ok: 'Forfeit', cancel: 'Keep it'
      });
      if (!ok) return;
      const plays = p.qids.map((qid, i) => p.plays[i] || { qid, status: 'forfeit', input: '', canonical: null, rarity: null, points: 0 });
      recordFinishedGame({ mode: 'daily', dateKey: p.dateKey, qids: p.qids, plays, score: totalScore(plays), finishedAt: Date.now(), forfeited: true });
    } else {
      const ok = await confirmAction({ title: 'Abandon this drive?', text: 'Your Unlimited drive will be cleared. Only finished drives count toward your high score.', ok: 'Abandon', cancel: 'Keep it' });
      if (!ok) return;
    }
    clearProgress(mode);
    renderHome();
  }

  function confirmAction(o) {
    const dlg = dom.confirmDialog;
    if (typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(o.title + '\n\n' + o.text));
    if (dlg.open) dlg.close('cancel');
    dom.confirmTitle.textContent = o.title;
    dom.confirmText.textContent = o.text;
    setBtnLabel(dom.confirmOk, o.ok || 'OK');
    setBtnLabel(dom.confirmCancel, o.cancel || 'Cancel');
    dlg.returnValue = '';
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
      dom.confirmCancel.focus();
    });
  }

  function openDialog(dlg) {
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  }

  function setSound(on, fromUser) {
    Sound.enabled = !!on;
    dom.soundBtn.setAttribute('aria-pressed', String(!!on));
    dom.soundBtn.title = on ? 'Sound on' : 'Sound off';
    if (fromUser) {
      Store.set('settings', { sound: !!on });
      if (on) { Sound.ensure(); Sound.play('click'); }
      toast(on ? 'Sound on' : 'Sound off');
    }
  }

  /* ======================================================================
     13. SHARING (Web Share API when available, clipboard fallback)
     ====================================================================== */
  function shareTextFor(summary) {
    const rank = rankFor(summary.score);
    const squares = Array.from({ length: CONFIG.ROUNDS }, (_, i) => {
      const p = summary.plays[i];
      return p && p.points > 0 && TIERS[p.rarity] ? TIERS[p.rarity].emoji : '⬛';
    }).join(' ');
    const mode = summary.mode === 'daily' ? `Daily Challenge, ${formatDateKey(summary.dateKey)}` : 'Unlimited Mode';
    return ['GRONKILLION 🏈', mode, '', '7 Plays. One Legendary Drive.', '', `Score: ${summary.score}/${CONFIG.MAX_SCORE}`, '',
      `🏈 ${squares}`, '', `Rank: ${rank.label.toUpperCase()}`, '', 'Think NFL. Go Deep. Score Big.'].join('\n');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (err) { /* fall back below */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (err) {
      return false;
    }
  }

  function openShareDialog(text) {
    dom.shareText.value = text;
    openDialog(dom.shareDialog);
    dom.shareText.focus();
    dom.shareText.select();
  }

  async function copyResults() {
    const summary = state.lastSummary;
    if (!summary) return;
    const text = shareTextFor(summary);
    if (await copyText(text)) toast('Result copied to clipboard'); else openShareDialog(text);
  }

  async function shareResults() {
    const summary = state.lastSummary;
    if (!summary) return;
    const text = shareTextFor(summary);
    const copying = copyText(text); // start inside the click so the clipboard keeps user activation
    if (navigator.share) {
      try {
        await navigator.share({ title: 'GRONKILLION', text });
        toast((await copying) ? 'Shared, and copied to your clipboard' : 'Shared!');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    // No share sheet: show the text so it can be pasted anywhere (it's on the clipboard too when allowed).
    await copying;
    openShareDialog(text);
  }

  /* ======================================================================
     14. EVENTS & STARTUP (listeners are bound exactly once)
     ====================================================================== */
  function bindEvents() {
    dom.kickoffBtn.addEventListener('click', () => {
      Sound.play('click');
      const target = kickoffTarget();
      if (target.resume) resumeGame(target.mode); else startNewGame(target.mode);
    });
    dom.dailyBtn.addEventListener('click', () => { Sound.play('click'); startNewGame('daily'); });
    dom.unlimitedBtn.addEventListener('click', () => { Sound.play('click'); startNewGame('unlimited'); });
    dom.howBtn.addEventListener('click', () => openDialog(dom.howDialog));
    dom.helpBtn.addEventListener('click', () => openDialog(dom.howDialog));
    dom.soundBtn.addEventListener('click', () => setSound(!Sound.enabled, true));
    dom.brandBtn.addEventListener('click', () => {
      if (state.phase === 'HOME') return;
      if (state.phase === 'RESULTS') goHome(); else requestExit();
    });
    dom.resumeBox.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'resume') resumeGame(btn.dataset.mode); else abandonProgress(btn.dataset.mode);
    });

    dom.answerForm.addEventListener('submit', onSubmit);
    // Typing is locked during the snap count; the field clears when answering opens.
    // (Enter arrives as "insertLineBreak"; cancelling it would also cancel the form submit.)
    dom.answerInput.addEventListener('beforeinput', (e) => { if (state.phase !== 'ANSWERING' && e.inputType !== 'insertLineBreak') e.preventDefault(); });
    dom.answerInput.addEventListener('keydown', (e) => { if (state.phase !== 'ANSWERING' && e.key && e.key.length === 1) e.preventDefault(); });
    dom.answerInput.addEventListener('paste', (e) => { if (state.phase !== 'ANSWERING') e.preventDefault(); });
    dom.answerInput.addEventListener('input', () => {
      if (state.phase !== 'ANSWERING') { dom.answerInput.value = ''; return; }
      dom.inputWrap.classList.remove('bad');
      if (state.typo && dom.answerInput.value.trim() !== state.typo.input) clearTypo(); // editing clears the chip
    });
    dom.submitBtn.addEventListener('click', (e) => { if (dom.submitBtn.getAttribute('aria-disabled') === 'true') { e.preventDefault(); setFeedback('Hold on. Answering opens after the snap.', 'info'); } });
    dom.skipBtn.addEventListener('click', onSkip);
    dom.nextBtn.addEventListener('click', onNext);

    dom.replayBtn.addEventListener('click', () => { Sound.play('click'); startNewGame('unlimited'); });
    dom.copyBtn.addEventListener('click', copyResults);
    dom.shareBtn.addEventListener('click', shareResults);
    dom.resHomeBtn.addEventListener('click', goHome);
    dom.resHowBtn.addEventListener('click', () => openDialog(dom.howDialog));
    dom.shareCopy.addEventListener('click', async () => {
      if (await copyText(dom.shareText.value)) toast('Copied');
      else { dom.shareText.focus(); dom.shareText.select(); toast('Press Ctrl+C (or ⌘C) to copy'); }
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); else Timer.check(); });
    window.addEventListener('focus', () => Timer.check());
    window.addEventListener('pagehide', saveProgress);
  }

  /** Inject sprites into the static markup: wordmarks, stadium, home runner, kickoff scene. */
  function decorate() {
    SPR.install();
    document.querySelectorAll('[data-wordmark]').forEach((el) => { el.innerHTML = SPR.wordmark(el.dataset.wordmark === 'big'); });
    document.querySelectorAll('[data-sprite]').forEach((el) => { el.innerHTML = SPR.svg(el.dataset.sprite); });
    const root = document.documentElement.style;
    [['--stars', SPR.stars()], ['--crowd-dim', SPR.crowd('dim')], ['--crowd-hot', SPR.crowd('hot')], ['--crowd-dense', SPR.crowd('dense')]]
      .forEach(([name, url]) => { if (url) root.setProperty(name, `url("${url}")`); });
    let flashes = '';
    for (let i = 0; i < 16; i++) {
      flashes += `<span style="left:${(4 + ((i * 37) % 92)).toFixed(0)}%;top:${10 + ((i * 23) % 70)}%;--d:${(1.6 + ((i * 7) % 10) / 6).toFixed(2)}s;--delay:${(-((i * 13) % 20) / 10).toFixed(1)}s"></span>`;
    }
    dom.flashes.innerHTML = flashes;
    dom.homeRunner.innerHTML = SPR.runner();
    dom.koKicker.innerHTML = `<svg class="spr" viewBox="0 0 16 20" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${SPR.frames(['kick-1', 'kick-2'])}</svg>`;
    dom.koBall.innerHTML = `<svg class="spr spin" viewBox="0 0 8 6" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${SPR.frames(['ball-1', 'ball-2', 'ball-3'])}</svg>`;
  }

  function init() {
    cacheDom();
    decorate();
    buildDial();
    gameField = createField(dom.gameField, { pips: dom.hudPips, yards: dom.hudYards });
    buildTierTable();
    setSound(Store.get('settings', { sound: false }, validSettings).sound, false);
    bindEvents();
    document.body.dataset.phase = 'home';
    renderHome();
    showScreen('home');

    // Read-only handle for debugging and automated checks.
    window.GRONKILLION = Object.freeze({
      version: 1,
      questions: QUESTIONS,
      categories: CATEGORIES,
      normalize,
      validate: (qid, text) => validate(QUESTION_BY_ID.get(qid), text),
      dailyQuestionIds: (dateKey) => dailyQuestions(dateKey || utcDateKey()).map((q) => q.id),
      getState: () => ({
        phase: state.phase, mode: state.mode, round: state.round, score: state.score,
        questionIds: state.questions.map((q) => q.id), plays: state.plays.slice(), deadline: state.deadline
      })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
