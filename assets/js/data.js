const cache = new Map();

export const COLOURS = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
const DEFAULT_PAIRS = ["WU", "UB", "BR", "RG", "GW", "WB", "UR", "BG", "RW", "GU"];
export const RARITIES = { C: "Common", U: "Uncommon", R: "Rare", M: "Mythic" };

async function json(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function loadSets() { return json("sets/sets.json"); }

export async function loadSet(code) {
  if (cache.has(code)) return cache.get(code);
  const [guide, { meta, cards }] = await Promise.all(["guide", "cards"].map(f => json(`sets/${code}/${f}.json`)));
  const set = { code, config: { name: guide.name, format: guide.format, released: guide.released }, meta, cards, guide };
  set.colours = guide.colours || {};
  const wr = p => meta.deck_wr[p] ?? 0;
  set.pairList = (Object.keys(guide.pairs || {}).length ? Object.keys(guide.pairs) : DEFAULT_PAIRS).sort((a, b) => wr(b) - wr(a));
  const colourWr = c => { const ps = set.pairList.filter(p => p.includes(c)); return ps.reduce((s, p) => s + wr(p), 0) / (ps.length || 1); };
  set.colourList = Object.keys(COLOURS).sort((a, b) => colourWr(b) - colourWr(a));
  set.colourWr = Object.fromEntries(set.colourList.map(c => [c, colourWr(c)]));
  set.pairs = Object.fromEntries(set.pairList.map(p => [p, { archetypes: [], tribes: [], ...(guide.pairs || {})[p] }]));
  set.pages = guide.pages || [];
  set.notes = { ...Object.fromEntries(set.pages.filter(p => p.group === "Card lists")
    .flatMap(p => (p.sections || []).flatMap(s => (s.cards || []).filter(([, n]) => n)))), ...guide.notes };
  set.byName = new Map(cards.map(c => [c.name, c]));
  set.page = new Map(set.pages.map(p => [p.id, p]));
  set.groups = [...new Set(set.pages.map(p => p.group))];
  set.tribes = [...new Set(set.pairList.flatMap(p => set.pairs[p].tribes))];
  set.tags = [...new Set(cards.flatMap(c => c.tags))].sort();
  cache.set(code, set);
  return set;
}

export function band(set, gih) {
  const b = set.meta.bands;
  if (gih >= b.bomb) return { key: "bomb", label: "Bomb" };
  if (gih >= b.strong) return { key: "strong", label: "Strong" };
  if (gih >= b.good) return { key: "good", label: "Above average" };
  if (gih >= b.meh) return { key: "meh", label: "Below average" };
  return { key: "weak", label: "Weak" };
}

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export function colourStats(set, colour) {
  const mono = set.cards.filter(c => c.colors === colour && c.samples >= set.meta.min_samples);
  const by = r => mono.filter(c => c.rarity === r).map(c => c.gih);
  return {
    commons: mean(by("C")), uncommons: mean(by("U")),
    strong: mono.filter(c => c.gih >= set.meta.bands.strong).length,
    cards: set.cards.filter(c => c.colors.includes(colour)).length,
  };
}

export const pairRank = set => Object.entries(set.meta.deck_wr).sort((a, b) => b[1] - a[1]).map(([p]) => p);
export const pairLabel = (set, pair) => set.pairs[pair].archetypes.map(a => a.name).join(" / ") || pair;
export const pairsWith = (set, colour) => set.pairList.filter(p => p.includes(colour));
export const fitsColours = (card, colours) => card.colors.split("").every(x => colours.includes(x));
export function inPair(card, p) { return card.fits ? card.fits.includes(p) : fitsColours(card, p); }
export function pairScore(card, p) { return card.pairs[p]?.score ?? card.gih; }

export const VERDICTS = [
  { key: "take", label: "Take", hint: "Grade A- or better. Worth taking over most things.", min: 1 },
  { key: "good", label: "Good pick", hint: "Grade B or B+. Solid cards you are happy to play.", min: 0 },
  { key: "fine", label: "Fine in the deck", hint: "Grade C+. Playable filler; take better cards first.", min: -0.5 },
  { key: "skip", label: "Skip", hint: "Grade C or worse. Only if you are short of playables.", min: -Infinity },
];
export function verdict(set, score) {
  const z = (score - set.meta.mean) / set.meta.sd;
  return VERDICTS.find(v => z >= v.min);
}

export function myPair(set, value) {
  const key = `pair:${set.code}`;
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    const p = localStorage.getItem(key);
    return set.pairs[p] ? p : "";
  } catch { return ""; }
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
export function matches(card, match) {
  const hay = `${card.name} ${card.types.join(" ")} ${card.subtypes.join(" ")} ${card.text}`.toLowerCase();
  return [].concat(match).some(phrase => new RegExp(`(^|[^a-z])${esc(phrase.toLowerCase())}([^a-z]|$)`).test(hay));
}
export function themeRole(card, theme) {
  if (!theme || theme.exclude?.includes(card.name)) return "";
  if (theme.payoff_cards?.includes(card.name)) return "payoff";
  if (theme.enabler_cards?.includes(card.name)) return "enabler";
  if (theme.payoff?.length && matches(card, theme.payoff)) return "payoff";
  if (theme.enabler?.length && matches(card, theme.enabler)) return "enabler";
  return "";
}

export function searchIndex(set) {
  const text = secs => (secs || []).flatMap(s => [s.heading, ...(s.text || []), ...(s.list || [])]);
  return [
    ...set.colourList.map(c => [c, COLOURS[c]]).map(([c, name]) => ({ route: `colour/${c}`, title: name, group: "Colours", pips: c,
      text: text(set.colours[c]?.sections) })),
    ...set.pairList.map(p => ({ route: `pair/${p}`, title: `${p} ${pairLabel(set, p)}`, group: "Colour pairs", pips: p,
      text: [...set.pairs[p].tribes, ...set.pairs[p].archetypes.flatMap(a => [a.name, a.theme?.label, ...text(a.sections)])] })),
    ...set.pages.map(p => ({ route: p.id, title: p.title, group: p.group, pips: "", text: [p.summary, p.verdict, ...text(p.sections)] })),
  ].map(e => ({ ...e, hay: [e.title, ...e.text].join(" ").toLowerCase() }));
}

const GRADES = [[2, "A+"], [1.5, "A"], [1, "A-"], [0.5, "B+"], [0, "B"], [-0.5, "C+"], [-1, "C"], [-1.5, "D"]];
export function grade(set, gih) {
  const z = (gih - set.meta.mean) / set.meta.sd;
  return (GRADES.find(([min]) => z >= min) || [0, "F"])[1];
}

export function isInstantSpeed(c) { return c.types.includes("Instant") || /(^|\n)Flash\b/.test(c.text); }
export function colouredPips(c) { return (c.cost.match(/\{[WUBRG]\}/g) || []).length; }
export const playable = set => set.cards.filter(c => c.samples >= set.meta.min_samples);
