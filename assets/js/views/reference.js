import { COLOURS, colouredPips, isInstantSpeed, pairLabel, playable } from "../data.js?v=20261110011114";
import { esc, gih, grid, link, pips, section } from "../ui.js?v=20261110011114";

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

function mini(set, list, empty) { return list.length ? grid(set, list, { compact: true }) : `<p class="hint">${esc(empty)}</p>`; }
const best = (list, n) => [...list].sort((a, b) => b.gih - a.gih).slice(0, n);

function colourColumn(set, pool, c) {
  const m = set.meta, mono = pool.filter(x => x.colors === c);
  const late = mono.filter(x => x.alsa >= (m.late_alsa ?? 99) && x.gih >= m.mean);
  return `<div class="partner">
    <h3>${link(set, `colour/${c}`, `${pips(c)}${COLOURS[c]}`)}</h3>
    <p class="hint">Pairs' deck win rate ${set.colourWr[c].toFixed(1)}</p>
    <h4>Best uncommons</h4>${mini(set, best(mono.filter(x => x.rarity === "U"), 3), "None stand out.")}
    <h4>Best commons</h4>${mini(set, best(mono.filter(x => x.rarity === "C"), 3), "None stand out.")}
    <h4>Good cards that go late</h4>${mini(set, best(late, 3), "Its good cards go early.")}
  </div>`;
}

export const REFERENCE = {
  "first-picks": {
    title: "First picks",
    render(set) {
      const m = set.meta, pool = playable(set);
      const bombs = best(pool.filter(c => c.gih >= m.bands.bomb), 12);
      const removal = best(pool.filter(c => c.tags.includes("Removal") && c.gih >= m.mean && !bombs.includes(c)), 10);
      const pairs = set.pairList.map(p => `<li>${link(set, `pair/${p}`, `${pips(p)}<b>${p}</b> <span>${esc(pairLabel(set, p))}</span>`)}<em>${m.deck_wr[p]?.toFixed(1) ?? "n/a"}</em></li>`).join("");
      return intro(set, "first-picks") + `<p class="lead">For the first picks, before you are in a pair. Take the strongest card,
        stay open and watch what comes late.</p>
        <div class="page-top"><div class="top-main">${section("Bombs", mini(set, bombs, "No card reaches bomb level."))}</div>
        <aside class="top-side"><h2 class="side-title">Pairs ranked</h2><ol class="pair-rank">${pairs}</ol>
        <p class="hint">Deck win rate. Format average ${m.deck_wr_all ?? "n/a"}.</p></aside></div>
        <section class="block"><h2>By colour</h2><p class="hint">Single-colour cards, colours ranked by their pairs' deck win rate.
        If the late cards of one colour keep turning up after pick ${Math.round(m.late_alsa ?? 0)}, that colour is probably open.</p>
        <div class="partners partners-5">${set.colourList.map(c => colourColumn(set, pool, c)).join("")}</div></section>`
        + (removal.length ? section("Best removal", grid(set, removal, { compact: true })) : "");
    },
  },
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
