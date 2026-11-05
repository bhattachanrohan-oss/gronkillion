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
     8. FOOTBALL FIELD (SVG: end zones, yard lines, numbers, hash marks,
        line of scrimmage, drive chart, football marker)
     ====================================================================== */
  const FIELD_W = 1200;
  const FIELD_H = 270;
  const fieldX = (progress) => 100 + progress * 10; // 10 units per yard, goal lines at 100 and 1100

  function fieldSVG(prefix) {
    const H = FIELD_H;
    const out = [];
    out.push(`<svg viewBox="0 0 ${FIELD_W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`);
    out.push(`<defs>
      <pattern id="${prefix}-ezl" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#12305A"/><rect width="9" height="22" fill="#18406F"/></pattern>
      <pattern id="${prefix}-ezr" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#5C400A"/><rect width="9" height="22" fill="#74530F"/></pattern>
    </defs>`);
    for (let i = 0; i < 20; i++) out.push(`<rect x="${100 + i * 50}" y="0" width="50" height="${H}" fill="${i % 2 ? '#227A3D' : '#1E6F37'}"/>`);
    out.push(`<rect x="0" y="0" width="100" height="${H}" fill="url(#${prefix}-ezl)"/>`);
    out.push(`<rect x="1100" y="0" width="100" height="${H}" fill="url(#${prefix}-ezr)"/>`);
    out.push(`<text class="ez-text ez-l" x="50" y="${H / 2}" transform="rotate(-90 50 ${H / 2})">GO DEEP</text>`);
    out.push(`<text class="ez-text ez-r" x="1150" y="${H / 2}" transform="rotate(90 1150 ${H / 2})">SCORE BIG</text>`);
    for (let yd = 5; yd < 100; yd += 5) {
      const x = fieldX(yd);
      out.push(`<line x1="${x}" y1="4" x2="${x}" y2="${H - 4}" stroke="rgba(247,249,252,.82)" stroke-width="${yd % 10 === 0 ? 3.5 : 2}"/>`);
    }
    let hash = '';
    const inTop = Math.round(H * 0.37);
    const inBot = Math.round(H * 0.63) - 10;
    for (let yd = 1; yd < 100; yd++) {
      if (yd % 5 === 0) continue;
      const x = fieldX(yd);
      hash += `M${x} 6v12M${x} ${H - 18}v12M${x} ${inTop}v10M${x} ${inBot}v10`;
    }
    out.push(`<path d="${hash}" stroke="rgba(247,249,252,.7)" stroke-width="2" fill="none"/>`);
    out.push(`<path d="M100 0V${H}M1100 0V${H}" stroke="#F7F9FC" stroke-width="5"/>`);
    out.push(`<rect x="2" y="2" width="${FIELD_W - 4}" height="${H - 4}" fill="none" stroke="#F7F9FC" stroke-width="4"/>`);
    for (let k = 1; k <= 9; k++) {
      const yd = k * 10;
      const x = fieldX(yd);
      const label = String(yd <= 50 ? yd : 100 - yd);
      [H - 44, 44].forEach((yc, row) => {
        const rot = row === 1 ? ` transform="rotate(180 ${x} ${yc})"` : '';
        out.push(`<g${rot}><text class="yd-num" x="${x - 5}" y="${yc}" text-anchor="end" dominant-baseline="central">${label[0]}</text><text class="yd-num" x="${x + 5}" y="${yc}" text-anchor="start" dominant-baseline="central">${label[1]}</text></g>`);
        if (yd !== 50) {
          const left = yd < 50;
          const ax = left ? x - 40 : x + 40;
          const pts = left ? `${ax - 6},${yc} ${ax + 6},${yc - 8} ${ax + 6},${yc + 8}` : `${ax + 6},${yc} ${ax - 6},${yc - 8} ${ax - 6},${yc + 8}`;
          out.push(`<polygon points="${pts}" fill="rgba(247,249,252,.85)"/>`);
        }
      });
    }
    out.push('<g class="drive" data-role="drive"></g>');
    out.push(`<g class="gline" data-role="gline" style="opacity:0;transform:translate(100px,0px)"><line x1="0" y1="8" x2="0" y2="${H - 8}"/></g>`);
    out.push(`<g class="ball-g no-anim" data-role="ball" style="transform:translate(100px,0px)">
      <line class="los" x1="0" y1="6" x2="0" y2="${H - 6}"/>
      <circle class="ball-ring" cx="0" cy="${H / 2}" r="40"/>
      <ellipse cx="6" cy="${H / 2 + 24}" rx="30" ry="7" fill="rgba(0,0,0,.35)"/>
      <use href="#sym-ball" x="-42" y="${H / 2 - 27}" width="84" height="54" transform="rotate(-12 0 ${H / 2})"/>
    </g>`);
    out.push('</svg>');
    return out.join('');
  }

  function driveMarkup(plays, newIndex) {
    let acc = 0;
    let out = '';
    plays.forEach((p, i) => {
      if (!p) return;
      const y = 76 + i * 20; // one lane per play, between the two rows of yard numbers
      const x0 = fieldX(fieldProgress(acc));
      const isNew = i === newIndex ? ' is-new' : '';
      if (p.points > 0 && TIERS[p.rarity]) {
        acc += p.points;
        const x1 = fieldX(fieldProgress(acc));
        const head = Math.min(12, (x1 - x0) * 0.6);
        const labelLeft = x1 > 1050;
        const lx = labelLeft ? x0 - 8 : x1 + 6;
        out += `<g class="drive-play${isNew}" data-tier="${p.rarity}">` +
          `<path class="drive-arrow" d="M${x0} ${y - 5}H${x1 - head}V${y - 9}L${x1} ${y}L${x1 - head} ${y + 9}V${y + 5}H${x0}Z"/>` +
          `<text class="drive-label" x="${lx}" y="${y}" text-anchor="${labelLeft ? 'end' : 'start'}" dominant-baseline="central">+${p.points}</text></g>`;
      } else {
        out += `<g class="drive-miss${isNew}"><path d="M${x0 - 6} ${y - 6}L${x0 + 6} ${y + 6}M${x0 + 6} ${y - 6}L${x0 - 6} ${y + 6}"/></g>`;
      }
    });
    return out;
  }

  function chipsMarkup(plays, current) {
    let out = '';
    for (let i = 0; i < CONFIG.ROUNDS; i++) {
      const p = plays[i];
      if (p) {
        const scored = p.points > 0 && TIERS[p.rarity];
        const tier = scored ? p.rarity : 'miss';
        const label = scored ? `+${p.points}` : (p.status === 'skipped' ? 'SKIP' : '0');
        const sr = scored ? `${TIERS[p.rarity].label}, ${p.points} points` : (p.status === 'skipped' ? 'skipped, no points' : 'no gain');
        out += `<li class="chip" data-state="done" data-tier="${tier}"><span class="c-num" aria-hidden="true">P${i + 1}</span><span class="c-val" aria-hidden="true">${label}</span><span class="sr-only">Play ${i + 1}: ${sr}</span></li>`;
      } else if (i === current) {
        out += `<li class="chip" data-state="current"><span class="c-num" aria-hidden="true">P${i + 1}</span><span class="c-val" aria-hidden="true">LIVE</span><span class="sr-only">Play ${i + 1}: in progress</span></li>`;
      } else {
        out += `<li class="chip" data-state="future"><span class="c-num" aria-hidden="true">P${i + 1}</span><span class="c-val" aria-hidden="true">—</span><span class="sr-only">Play ${i + 1}: not played yet</span></li>`;
      }
    }
    return out;
  }

  function createField(wrap, prefix) {
    const box = wrap.querySelector('[data-role="field"]');
    box.innerHTML = fieldSVG(prefix);
    const ball = box.querySelector('[data-role="ball"]');
    const drive = box.querySelector('[data-role="drive"]');
    const gline = box.querySelector('[data-role="gline"]');
    const zoneEl = wrap.querySelector('[data-role="zone"]');
    const markerEl = wrap.querySelector('[data-role="marker"]');
    const yardsEl = wrap.querySelector('[data-role="yards"]');
    const scoreEl = wrap.querySelector('[data-role="score"]');
    const chipsEl = wrap.querySelector('[data-role="chips"]');
    let shownScore = 0;
    return {
      render(opts) {
        const o = Object.assign({ plays: [], current: -1, animate: false, live: false, newIndex: -1 }, opts);
        const score = totalScore(o.plays);
        const progress = fieldProgress(score);
        const instant = !o.animate || prefersReducedMotion();
        ball.classList.toggle('no-anim', instant);
        gline.style.transition = instant ? 'none' : '';
        ball.style.transform = `translate(${fieldX(progress)}px, 0px)`;
        box.dataset.live = o.live ? '1' : '0';
        if (o.live && progress < 100) {
          gline.style.opacity = '1';
          gline.style.transform = `translate(${fieldX(Math.min(100, progress + 100 / 7))}px, 0px)`;
        } else {
          gline.style.opacity = '0';
        }
        drive.innerHTML = driveMarkup(o.plays, instant ? -1 : o.newIndex);
        const zone = zoneFor(progress);
        zoneEl.textContent = zone.label;
        zoneEl.dataset.zone = zone.key;
        markerEl.textContent = yardMarker(progress);
        yardsEl.textContent = yardsText(progress);
        animateNumber(scoreEl, instant ? score : shownScore, score);
        shownScore = score;
        box.setAttribute('aria-label', `Football field. ${zone.label}. Ball at ${yardMarker(progress).toLowerCase()}, ${yardsText(progress)} from your goal line. ${score} of ${CONFIG.MAX_SCORE} points.`);
        chipsEl.innerHTML = chipsMarkup(o.plays, o.current);
        return { score, progress, zone };
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

  const Confetti = {
    raf: 0,
    run(duration) {
      if (prefersReducedMotion()) return;
      const total = duration || 3800;
      const canvas = document.getElementById('confetti');
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.hidden = false;
      const colors = ['#FFC857', '#A3FF12', '#F7F9FC', '#B47CFF', '#4DA3FF', '#FF9F43'];
      const parts = Array.from({ length: 170 }, (_, i) => ({
        x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
        vx: (Math.random() - 0.5) * 3.2, vy: 2 + Math.random() * 3.5,
        w: 6 + Math.random() * 6, h: 9 + Math.random() * 9,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.28, c: colors[i % colors.length]
      }));
      cancelAnimationFrame(this.raf);
      const t0 = performance.now();
      const frame = (now) => {
        const t = now - t0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = t > total - 800 ? Math.max(0, (total - t) / 800) : 1;
        parts.forEach((p) => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.r += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
          ctx.restore();
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
  function animateNumber(node, from, to, ms) {
    const prev = counters.get(node);
    if (prev) cancelAnimationFrame(prev);
    if (from === to || prefersReducedMotion()) { node.textContent = String(to); counters.delete(node); return; }
    const duration = ms || 900;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(from + (to - from) * e));
      if (p < 1) counters.set(node, requestAnimationFrame(step)); else counters.delete(node);
    };
    node.textContent = String(from);
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
    skipArmed: false, skipTimer: 0, warned: {}, lastTick: null, lastSummary: null
  };
  const dom = {};
  let gameField = null;
  let resultsField = null;

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
    ['topGame', 'topPlay', 'topMode', 'topScoreWrap', 'topScore', 'soundBtn', 'helpBtn', 'brandBtn',
      'screen-home', 'screen-game', 'screen-results', 'kickoffBtn', 'kickoffSub', 'dailyBtn', 'unlimitedBtn', 'howBtn',
      'resumeBox', 'dailyNote', 'statHigh', 'statDaily', 'statGames', 'statTier', 'storageNote',
      'qcard', 'qCategory', 'qCount', 'timer', 'timerProg', 'timerNum', 'timerLabel', 'qPrompt', 'qScope',
      'answerForm', 'inputWrap', 'answerInput', 'submitBtn', 'feedback', 'skipBtn',
      'reveal', 'rvStatus', 'rvAnswer', 'rvTier', 'rvPoints', 'rvFlavor', 'rvNote', 'rvMore', 'nextBtn',
      'gameField', 'resField', 'resHero', 'resMode', 'resScore', 'resRank', 'resMsg', 'resBadge', 'resBest', 'resPlays',
      'replayBtn', 'shareBtn', 'resHomeBtn', 'resNext',
      'howDialog', 'tierTable', 'confirmDialog', 'confirmTitle', 'confirmText', 'confirmOk', 'confirmCancel',
      'shareDialog', 'shareText', 'shareCopy', 'kickoffFx']
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
      `<span class="mini-tier" data-tier="${stats.bestTier}"><span aria-hidden="true">${TIERS[stats.bestTier].glyph}</span> ${escapeHTML(TIERS[stats.bestTier].label)}</span>` :
      '<span class="small">None yet</span>';
    const rows = [];
    [pDaily, pUnl].forEach((p) => {
      if (!p) return;
      const label = p.mode === 'daily' ? "Today's Daily Challenge" : 'Your Unlimited drive';
      rows.push(`<div class="resume-row"><p>${label} is in progress<span>Play ${p.round + 1} of ${CONFIG.ROUNDS}, ${totalScore(p.plays)} points so far</span></p>` +
        `<button type="button" class="btn btn-primary" data-action="resume" data-mode="${p.mode}"><span>Resume</span></button>` +
        `<button type="button" class="btn btn-ghost" data-action="abandon" data-mode="${p.mode}"><span>${p.mode === 'daily' ? 'Forfeit' : 'Abandon'}</span></button></div>`);
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
    dom.topMode.textContent = state.mode === 'daily' ? 'Daily Challenge' : 'Unlimited';
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
      dom.answerInput.placeholder = 'Type your answer';
      dom.submitBtn.removeAttribute('aria-disabled');
    } else {
      dom.answerInput.setAttribute('aria-disabled', 'true');
      dom.answerInput.placeholder = 'Read the play…';
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
    resetSkip();
    dom.qcard.classList.remove('enter');
    void dom.qcard.offsetWidth;
    dom.qcard.classList.add('enter');
    renderTopbar();
  }

  const RING = 2 * Math.PI * 34;
  function renderTimer(mode, leftMs) {
    const total = mode === 'snap' ? CONFIG.PREVIEW_MS : CONFIG.ANSWER_MS;
    const secs = Math.max(0, Math.ceil(leftMs / 1000));
    const frac = Math.max(0, Math.min(1, leftMs / total));
    dom.timerProg.style.strokeDashoffset = String(RING * (1 - frac));
    let st = 'go';
    let label = 'Sec';
    if (mode === 'off') { st = 'off'; label = 'Final'; }
    else if (mode === 'snap') { st = 'snap'; label = 'Snap'; }
    else if (secs <= CONFIG.DANGER_SECONDS) { st = 'danger'; label = 'Final'; }
    else if (secs <= CONFIG.WARN_SECONDS) { st = 'warn'; label = 'Hurry'; }
    if (dom.timer.dataset.state !== st) dom.timer.dataset.state = st;
    const text = String(secs);
    if (dom.timerNum.textContent !== text) {
      dom.timerNum.textContent = text;
      dom.timer.setAttribute('aria-label', mode === 'snap' ? `Snap count: ${text}` : `Play clock: ${text} seconds left`);
    }
    if (dom.timerLabel.textContent !== label) dom.timerLabel.textContent = label;
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
    const burst = dom.reveal.querySelector('.burst');
    burst.style.animation = 'none';
    void burst.offsetWidth;
    burst.style.animation = '';

    dom.rvStatus.textContent = scored ? 'Accepted' : (play.status === 'timeout' ? "Time's up" : play.status === 'skipped' ? 'Play skipped' : 'No gain');
    dom.rvAnswer.textContent = scored ? play.canonical : (play.status === 'skipped' ? 'Punt' : 'Delay of game');
    dom.rvTier.dataset.tier = tierKey;
    dom.rvTier.innerHTML = scored ?
      `<span class="glyph" aria-hidden="true">${TIERS[play.rarity].glyph}</span><span>${escapeHTML(TIERS[play.rarity].label)}</span>` :
      '<span class="glyph" aria-hidden="true">✕</span><span>No gain</span>';
    dom.rvPoints.textContent = `+${play.points} ${play.points === 1 ? 'point' : 'points'}`;
    if (animate) { dom.rvPoints.classList.remove('pop'); void dom.rvPoints.offsetWidth; dom.rvPoints.classList.add('pop'); }
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
    setBtnLabel(dom.nextBtn, state.round >= CONFIG.ROUNDS - 1 ? 'See Final Results' : 'Next Play');

    animateNumber(dom.topScore, animate ? prevScore : state.score, state.score);
    gameField.render({ plays: state.plays, current: -1, animate, live: false, newIndex: animate ? state.round : -1 });

    const zone = zoneFor(fieldProgress(state.score));
    const summaryLine = scored ?
      `Accepted: ${play.canonical}. ${TIERS[play.rarity].label}, plus ${play.points} points.` :
      `${play.status === 'timeout' ? "Time's up" : 'Play skipped'}. No points.`;
    announce(`${summaryLine} Total ${state.score} points. ${zone.label}, ${yardMarker(fieldProgress(state.score)).toLowerCase()}.`);

    if (animate) {
      if (scored) {
        if (play.rarity === 'gronkillion') { Sound.play('gronk'); flashLights(); }
        else if (play.rarity === 'hall_of_famer' || play.rarity === 'all_pro') Sound.play('rare');
        else Sound.play('correct');
      } else {
        Sound.play('whistle');
      }
      const before = fieldProgress(prevScore);
      const after = fieldProgress(state.score);
      if (after >= 100 && before < 100) Delays.add(touchdownCelebration, 900);
      else if (after >= 80 && before < 80) Delays.add(flashLights, 900);
    }
    Delays.add(() => {
      if (state.phase === 'REVEAL') {
        try { dom.nextBtn.focus({ preventScroll: true }); } catch (err) { dom.nextBtn.focus(); }
        dom.reveal.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    }, animate ? CONFIG.NEXT_GUARD_MS : 0);
  }

  function renderResults(summary, opts) {
    const o = Object.assign({ newHigh: false, viewOnly: false }, opts);
    const rank = rankFor(summary.score);
    state.lastSummary = summary;
    dom.resHero.dataset.rank = rank.key;
    dom.resMode.textContent = summary.mode === 'daily' ?
      `Daily Challenge, ${formatDateKey(summary.dateKey)}${summary.forfeited ? ' (forfeited)' : ''}` : 'Unlimited Mode';
    dom.resRank.textContent = rank.label;
    dom.resMsg.textContent = rank.msg;
    dom.resBadge.hidden = !o.newHigh;

    const best = summary.plays.reduce((b, p) => (p && p.points > 0 && TIERS[p.rarity] && p.points > (b ? b.points : 0) ? p : b), null);
    dom.resBest.dataset.tier = best ? best.rarity : 'miss';
    dom.resBest.innerHTML = best ?
      `<h3>Best answer</h3><p>${escapeHTML(best.canonical)} <small>${escapeHTML(TIERS[best.rarity].label)}, +${best.points}</small></p>` :
      '<h3>Best answer</h3><p>No points on this drive</p>';

    dom.resPlays.innerHTML = summary.plays.map((p, i) => {
      const q = QUESTION_BY_ID.get(p ? p.qid : summary.qids[i]);
      const scored = p && p.points > 0 && TIERS[p.rarity];
      const tier = scored ? p.rarity : 'miss';
      const answer = scored ?
        `<b>${escapeHTML(p.canonical)}</b> <span class="rp-tier">${escapeHTML(TIERS[p.rarity].label)}</span>` :
        (p && p.status === 'skipped' ? 'Skipped' : p && p.status === 'forfeit' ? 'Forfeited' : 'Timed out');
      return `<li class="res-play" data-tier="${tier}"><span class="rp-num" aria-hidden="true">${i + 1}</span>` +
        `<p class="rp-q"><span class="rp-cat">${escapeHTML(q ? q.category : '')}</span>${escapeHTML(q ? q.prompt : 'Retired question')}</p>` +
        `<p class="rp-a"><span class="sr-only">Play ${i + 1}. </span>Your answer: ${answer}</p>` +
        `<span class="rp-pts">+${p ? p.points : 0}</span></li>`;
    }).join('');

    setBtnLabel(dom.replayBtn, summary.mode === 'daily' ? (loadProgress('unlimited') ? 'Resume Unlimited' : 'Play Unlimited') : 'Play Again');
    showScreen('results');
    animateNumber(dom.resScore, o.viewOnly ? summary.score : 0, summary.score, 1200);
    resultsField.render({ plays: [], current: -1, animate: false });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resultsField.render({ plays: summary.plays, current: -1, animate: !o.viewOnly, newIndex: -1 });
    }));
    try { dom.resRank.focus({ preventScroll: true }); } catch (err) { dom.resRank.focus(); }
  }

  function buildTierTable() {
    dom.tierTable.querySelector('tbody').innerHTML = TIER_ORDER.map((k) => {
      const t = TIERS[k];
      return `<tr data-tier="${k}"><td aria-hidden="true">${t.glyph}</td><td><span class="tt-name">${escapeHTML(t.label)}</span><br><span class="tt-desc">${escapeHTML(t.desc)}</span></td><td class="tt-pts">${t.points} pts</td></tr>`;
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
      finishRound({ status: 'accepted', input: raw, answer: res.answer, via: res.via });
      return;
    }
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
        if (await copying) { toast('Results copied to clipboard'); return; }
        if (err && err.name === 'AbortError') return;
        openShareDialog(text);
        return;
      }
    }
    if (await copying) toast('Results copied to clipboard'); else openShareDialog(text);
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
    });
    dom.submitBtn.addEventListener('click', (e) => { if (dom.submitBtn.getAttribute('aria-disabled') === 'true') { e.preventDefault(); setFeedback('Hold on. Answering opens after the snap.', 'info'); } });
    dom.skipBtn.addEventListener('click', onSkip);
    dom.nextBtn.addEventListener('click', onNext);

    dom.replayBtn.addEventListener('click', () => { Sound.play('click'); startNewGame('unlimited'); });
    dom.shareBtn.addEventListener('click', shareResults);
    dom.resHomeBtn.addEventListener('click', goHome);
    dom.shareCopy.addEventListener('click', async () => {
      if (await copyText(dom.shareText.value)) toast('Copied');
      else { dom.shareText.focus(); dom.shareText.select(); toast('Press Ctrl+C (or ⌘C) to copy'); }
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); else Timer.check(); });
    window.addEventListener('focus', () => Timer.check());
    window.addEventListener('pagehide', saveProgress);
  }

  function init() {
    cacheDom();
    gameField = createField(dom.gameField, 'gf');
    resultsField = createField(dom.resField, 'rf');
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
