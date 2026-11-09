import { COLOURS, colouredPips, isInstantSpeed, playable } from "../data.js?v=20261110003004";
import { esc, gih, grid, link, pips, section } from "../ui.js?v=20261110003004";

function block(headingHtml, body, extra = "") { return `<section class="block"><h2>${headingHtml}</h2>${body}${extra}</section>`; }

const GROUPS = [...Object.entries(COLOURS), ["M", "Gold"], ["", "Colourless"]];
function byColour(c) { return c.colors.length > 1 ? "M" : c.colors; }

export function rows(set, cards, extra = () => "") {
  return grid(set, cards.map(c => ({ card: c, tags: extra(c) ? `<span class="tag">${esc(extra(c))}</span>` : "" })), { compact: true });
}

function byColourSheet(set, cards, extra) {
  return GROUPS.map(([k, name]) => {
    const list = cards.filter(c => byColour(c) === k).sort((a, b) => a.mv - b.mv || b.gih - a.gih);
    return list.length ? block(`${k.length === 1 ? pips(k) : ""}${esc(name)} <small>${list.length}</small>`, rows(set, list, extra)) : "";
  }).join("");
}

function intro(set, id) {
  const page = set.page.get(id);
  return (page?.sections || []).flatMap(s => s.text || []).map(t => `<p class="lead">${esc(t)}</p>`).join("");
}

const kind = c => /counter target/i.test(c.text) ? "Counter"
  : c.tags.includes("Removal") ? "Removal"
  : c.types.includes("Creature") ? "Flash creature"
  : c.tags.includes("Combat trick") ? "Trick" : "Other";

function rankOf(list, key) {
  const sorted = [...list].sort((a, b) => key(b) - key(a));
  return new Map(sorted.map((c, i) => [c.name, i + 1]));
}

export const REFERENCE = {
  removal: {
    title: "Removal",
    render(set) {
      const cards = set.cards.filter(c => c.tags.includes("Removal"));
      const good = cards.filter(c => c.gih >= set.meta.mean), weak = cards.filter(c => c.gih < set.meta.mean);
      return intro(set, "removal") + `<p class="hint">Removal graded B or better, by colour and mana value. Weaker removal is folded away at the bottom.</p>`
        + byColourSheet(set, good)
        + (weak.length ? `<details class="verdict"><summary><h3>Weaker removal <small>${weak.length}</small></h3></summary>${rows(set, weak.sort((a, b) => b.gih - a.gih))}</details>` : "");
    },
  },
  "instant-speed": {
    title: "Instant speed",
    render(set) {
      const cards = set.cards.filter(isInstantSpeed);
      return `<p class="lead">Everything your opponent can do on your turn: instants and flash creatures, by colour and mana value.
        Check it against the mana they leave open.</p>` + byColourSheet(set, cards, kind);
    },
  },
  sleepers: {
    title: "Sleepers and overrated",
    render(set) {
      const pool = playable(set).filter(c => !c.types.includes("Land") || c.gih > set.meta.mean);
      const winRank = rankOf(pool, c => c.gih), pickRank = rankOf(pool, c => -c.alsa);
      const gap = c => pickRank.get(c.name) - winRank.get(c.name);
      const note = c => `Win rate rank ${winRank.get(c.name)}, pick order rank ${pickRank.get(c.name)} of ${pool.length}`;
      const sleepers = pool.filter(c => c.gih >= set.meta.bands.good).sort((a, b) => gap(b) - gap(a)).slice(0, 12);
      const over = pool.filter(c => c.gih < set.meta.bands.good).sort((a, b) => gap(a) - gap(b)).slice(0, 12);
      return `<p class="lead">Pick order against win rate. Sleepers win like early picks but get taken late, so you can often
        wait for them, and seeing them late hints that their colour is open. Overrated cards are taken early and win less.</p>`
        + section("Sleepers", grid(set, sleepers.map(c => ({ card: c, note: note(c) }))))
        + section("Overrated", grid(set, over.map(c => ({ card: c, note: note(c) }))));
    },
  },
  "top-players": {
    title: "Top players",
    when: set => set.cards.some(c => c.top),
    render(set) {
      const withTop = playable(set).filter(c => c.top);
      const lift = withTop.reduce((s, c) => s + c.top.gih - c.gih, 0) / withTop.length;
      const se = c => 100 * Math.sqrt(0.25 / c.top.n + 0.25 / c.samples);
      const gap = c => c.top.gih - c.gih - lift;
      const gains = withTop.filter(c => gap(c) > 2 * se(c)).sort((a, b) => gap(b) - gap(a)).slice(0, 10);
      const losses = withTop.filter(c => gap(c) < -2 * se(c)).sort((a, b) => gap(a) - gap(b)).slice(0, 10);
      const n = (c, txt) => ({ card: c, note: txt });
      return `<p class="lead">17Lands' top players (${set.meta.top_games?.toLocaleString() ?? "?"} games) compared with everyone.
        Top players win ${lift.toFixed(1)} points more with the average card, so the gaps below are on top of that. Cards here need
        skill to play well, or only work in the decks good players put them in.</p>`
        + (gains.length ? section("Better in good hands", grid(set, gains.map(c => n(c, `${c.top.gih.toFixed(1)} for top players vs ${c.gih.toFixed(1)}, ${(c.top.gih - c.gih - lift).toFixed(1)} above the usual gap`)))) : "")
        + (losses.length ? section("Worse in good hands", grid(set, losses.map(c => n(c, `${c.top.gih.toFixed(1)} for top players vs ${c.gih.toFixed(1)}, ${(c.top.gih - c.gih - lift).toFixed(1)} against the usual gap`)))) : "")
        + (gains.length || losses.length ? "" : `<p class="hint">No card's gap is clearly beyond noise.</p>`);
    },
  },
  splash: {
    title: "Splash",
    render(set) {
      const bombs = set.cards.filter(c => c.colors.length === 1 && colouredPips(c) === 1 && c.gih >= set.meta.bands.strong);
      const fixing = set.cards.filter(c => (c.types.includes("Land") || c.types.includes("Artifact")) && !c.types.includes("Creature")
        && /add one mana of any|mana of any color|chosen color|add \{[WUBRG]\} or \{[WUBRG]\}|search your library for a basic land/i.test(c.text));
      return `<p class="lead">Strong cards with a single coloured mana symbol, the only ones worth splashing, and the fixing
        that makes a splash work.</p>`
        + section("Worth splashing", grid(set, bombs))
        + section("Fixing", fixing.length ? grid(set, fixing.sort((a, b) => b.gih - a.gih)) : `<p class="hint">No fixing in this set.</p>`);
    },
  },
};

export const referenceList = set => Object.entries(REFERENCE).filter(([, r]) => !r.when || r.when(set));

export function renderReference(set, id) {
  const r = REFERENCE[id];
  return `<header class="page-head"><p class="eyebrow">Reference</p><h1>${esc(r.title)}</h1></header>${r.render(set)}`;
}
