// Deterministic shuffle for "randomise question order". The seed is the respondent's response id,
// so each respondent gets their own order, and it stays the same across refreshes, resumes and
// edits (and on another device) instead of reshuffling under them mid-answer.
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a shuffled copy (Fisher-Yates) that is the same every time for the same seed. */
export function seededShuffle(items, seed) {
  const rand = mulberry32(hash(String(seed))());
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffles the questions inside each page; sections (pages) keep their order, as Google Forms does. */
export function shufflePages(pages, seed) {
  return pages.map((p) => ({ ...p, questions: seededShuffle(p.questions, `${seed}:${p.id}`) }));
}
