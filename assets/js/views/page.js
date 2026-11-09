import { COLOURS, RARITIES, VERDICTS, colourStats, inPair, matches, pairLabel, pairRank, pairScore, pairsWith, themeRole, verdict } from "../data.js?v=20261110003004";
import { esc, gih, grid, link, pips, section, statStrip } from "../ui.js?v=20261110003004";
import { rows } from "./reference.js?v=20261110003004";

const TOP = 8;

function sections(set, secs = []) {
  return secs.map(s => {
    const text = (s.text || []).map(t => `<p>${esc(t)}</p>`).join("");
    const list = s.list ? `<ul>${s.list.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
    const cards = s.cards ? grid(set, s.cards.map(([n, note]) => ({ card: set.byName.get(n), note }))) : "";
    return section(s.heading, text + list + cards);
  }).join("");
}

const named = secs => new Set((secs || []).flatMap(s => (s.cards || []).map(([n]) => n)));
const head = (eyebrow, title, icon = "", extra = "", sub = "") =>
  `<header class="page-head"><p class="eyebrow">${esc(eyebrow)}</p><h1>${icon ? pips(icon) : ""}${esc(title)}</h1>${sub ? `<p class="subtitle">${esc(sub)}</p>` : ""}${extra}</header>`;
function chips(items) { return items.length ? `<p class="chips">${items.join("")}</p>` : ""; }
const pairChip = (set, p) => link(set, `pair/${p}`,
  `${pips(p)}${p} ${esc(pairLabel(set, p))}${set.pairs[p].tribes.length ? ` · ${esc(set.pairs[p].tribes.join(", "))}` : ""}`, "chip");

function curve(set, cards, p) {
  const good = cards.filter(x => pairScore(x, p) >= set.meta.bands.good && !x.types.includes("Land"));
  const buckets = [1, 2, 3, 4, 5, 6].map(mv => {
    const at = good.filter(x => (mv === 6 ? x.mv >= 6 : x.mv === mv));
    return { mv: mv === 6 ? "6+" : mv, creatures: at.filter(x => x.types.includes("Creature")).length, spells: at.filter(x => !x.types.includes("Creature")).length };
  });
  const max = Math.max(...buckets.map(b => b.creatures + b.spells), 1);
  return `<div class="curve-box"><p class="curve-title">Good cards by mana value</p><div class="curve">${buckets.map(b => `<div class="curve-col">
      <div class="curve-bar" style="height:${(b.creatures + b.spells) / max * 100}%"><i style="height:${b.creatures / Math.max(b.creatures + b.spells, 1) * 100}%"></i></div>
      <b>${b.creatures + b.spells}</b><span>${b.mv}</span></div>`).join("")}</div>
    <p class="legend"><span><i class="sw sw-creature"></i>Creatures</span><span><i class="sw sw-spell"></i>Spells</span><span>grade B or better</span></p></div>`;
}

const TYPES = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land", "Planeswalker"];
const bestPair = c => Object.entries(c.pairs).filter(([, d]) => d.sure && d.effect >= 1).sort((a, b) => b[1].effect - a[1].effect)[0]?.[0] || "";
function pickGuide(set, key, cards, archetypes, { scoreOf, scope, title, splash = [] }) {
  const m = set.meta, pairData = set.pairs[key];
  const themes = archetypes.map(a => a.theme).filter(Boolean);
  const isBomb = c => scoreOf(c) >= m.bands.bomb;
  const tileFor = c => {
    const score = scoreOf(c);
    const role = themes.map(t => [themeRole(c, t), t]).find(([r]) => r);
    const tribes = c.changeling ? [] : c.tribes.filter(t => !pairData || pairData.tribes.includes(t));
    const instant = c.types.includes("Instant") || /(^|\n)Flash\b/.test(c.text);
    const late = c.alsa >= (m.late_alsa ?? 99) && score >= m.mean;
    const flags = [
      isBomb(c) && "bomb", c.tags.includes("Removal") && "removal", instant && "instant",
      role && role[0], ...tribes.map(t => `tribe-${t}`), ...c.types.map(t => `type-${t}`), late && "late",
    ].filter(Boolean).join(" ");
    const tags = [
      role?.[0] === "payoff" ? `<span class="tag tag-payoff">Needs ${esc(role[1].label)}</span>` : "",
      role?.[0] === "enabler" ? `<span class="tag tag-enabler">Feeds ${esc(role[1].label)}</span>` : "",
      ...tribes.map(t => `<span class="tag">${esc(t)}</span>`),
      c.tags.includes("Removal") ? `<span class="tag">Removal</span>` : "",
      !pairData && bestPair(c) ? `<span class="tag tag-plus">Best in ${bestPair(c)}</span>` : "",
      late ? `<span class="tag tag-wheel" title="Good card that drafters usually let go late (last seen around pick ${Math.round(c.alsa)})">Taken late</span>` : "",
      pairData && (c.rare_in || []).includes(key) ? `<span class="tag tag-rare">Rarely played in ${key}</span>` : "",
    ].join("");
    return { card: c, score, tags, flags };
  };
  const band = (cls, label, list, hint, { open = true, splash = false } = {}) => !list.length ? "" : `
    <section class="verdict ${cls}"${splash ? " data-splash" : ""} data-open="${open}">
      <button type="button" class="verdict-label" aria-expanded="${open}"><h3>${label} <small>${list.length}</small></h3><span class="hint">${esc(hint)}</span></button>
      <div class="verdict-cards"${open ? "" : " hidden"}>${grid(set, list.map(tileFor), { compact: true })}</div></section>`;
  const sorted = cards.filter(c => c.colors || !pairData).sort((a, b) => scoreOf(b) - scoreOf(a));
  const by = key => sorted.filter(c => !isBomb(c) && verdict(set, scoreOf(c)).key === key);
  const skip = by("skip");
  const medianPick = [...cards].map(c => c.alsa).sort((a, b) => a - b)[Math.floor(cards.length / 2)] || 5;
  const traps = skip.filter(c => c.alsa < medianPick), weak = skip.filter(c => c.alsa >= medianPick);
  const colourless = pairData ? cards.filter(c => !c.colors).sort((a, b) => scoreOf(b) - scoreOf(a)) : [];

  const tips = { late: `Good cards drafters let go late: last seen around pick ${(m.late_alsa ?? 0).toFixed(1)} or later. You can often take something else first.`,
    splash: "Off-colour cards worth splashing: one coloured mana symbol, strong rares or good removal, nothing tied to another deck.", bomb: "Cards graded A+ in this deck." };
  const chip = (f, label) => `<button type="button" class="chip" data-filter="${esc(f)}" aria-pressed="false"${tips[f] ? ` title="${esc(tips[f])}"` : ""}>${esc(label)}</button>`;
  const presentTypes = TYPES.filter(t => cards.some(c => c.types.includes(t)));
  const roles = [chip("bomb", "Bombs"), chip("removal", "Removal"), chip("instant", "Instant speed"), chip("late", "Taken late"),
    splash.length ? chip("splash", "Splash") : ""].join("");
  const themeOpts = themes.flatMap(t => [
    ...(t.payoff?.length || t.payoff_cards ? [["payoff", `Needs ${t.label}`]] : []),
    ...(t.enabler?.length || t.enabler_cards ? [["enabler", `Feeds ${t.label}`]] : [])]);
  const tribeChips = (pairData?.tribes || []).map(t => chip(`tribe-${t}`, t)).join("");
  const select = (cls, any, opts) => `<select class="${cls}" aria-label="${any}"><option value="">${any}</option>${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`;

  return `<section class="block pick-guide" id="pick-guide">
    <h2>${title}</h2>
    <div class="toolbar">
      <input type="search" class="guide-q" placeholder="Find a card" aria-label="Find a card in this list">
      ${select("guide-rarity", "Any rarity", [["C", "Commons"], ["U", "Uncommons"], ["R", "Rares and mythics"]])}
      ${select("guide-type", "Any type", presentTypes.map(t => [`type-${t}`, t]))}
      ${themeOpts.length ? select("guide-theme", `Any card for ${key}`, themeOpts) : ""}
      <span class="chips" role="group" aria-label="Role">${roles}</span>
      ${tribeChips ? `<span class="chips" role="group" aria-label="Tribe">${tribeChips}</span>` : ""}
    </div>
    <p class="hint">${scope} Click a band's title to open or close it.</p>
    ${band("verdict-bomb", "Bombs", sorted.filter(isBomb), "Take over almost anything.")}
    ${band("verdict-take", "Take", by("take"), "Grade A- or better.")}
    ${band("verdict-good", "Good pick", by("good"), "Grade B or B+. Happy to play these.")}
    ${band("verdict-fine", "Fine", by("fine"), "Grade C+. Filler for the end of each pack.", { open: false })}
    ${band("verdict-skip", "Traps", traps, "Picked early by many drafters, but weak.", { open: false })}
    ${band("verdict-skip", "Weak", weak, "Grade C or worse. Only if short of playables.", { open: false })}
    ${band("verdict-splash", "Splash options", splash, "One coloured mana symbol: strong rares and good removal that work in any deck.", { open: false, splash: true })}
    ${band("verdict-colourless", "Colourless", colourless, "Artifacts and lands any deck can play.", { open: false })}
    <p class="empty" hidden>No cards match.</p></section>`;
}

function partners(set, c) {
  const rank = pairRank(set);
  const mini = (list, p) => list.length ? grid(set, list.map(x => ({ card: x, score: pairScore(x, p) })), { compact: true }) : `<p class="hint">None stand out.</p>`;
  const cols = set.pairList.filter(p => p.includes(c)).map(p => {
    const other = p.replace(c, "");
    const gold = set.cards.filter(x => x.colors.length > 1 && inPair(x, p) && pairScore(x, p) >= set.meta.mean).sort((a, b) => pairScore(b, p) - pairScore(a, p)).slice(0, 3);
    const theirs = set.cards.filter(x => x.colors === other && pairScore(x, p) >= set.meta.bands.strong).sort((a, b) => pairScore(b, p) - pairScore(a, p)).slice(0, 3);
    const mine = set.cards.filter(x => x.colors === c && bestPair(x) === p).sort((a, b) => pairScore(b, p) - pairScore(a, p)).slice(0, 3);
    const wr = set.meta.deck_wr[p];
    return `<div class="partner">
      <h3>${link(set, `pair/${p}`, `${pips(p)}${p} ${esc(pairLabel(set, p))}`)}</h3>
      <p class="hint">Deck win rate ${wr ? wr.toFixed(1) : "n/a"}, rank ${rank.indexOf(p) + 1} of ${rank.length}${set.pairs[p].tribes.length ? `. ${esc(set.pairs[p].tribes.join(", "))} tribe` : ""}</p>
      <h4>Gold cards</h4>${mini(gold, p)}
      <h4>Best ${COLOURS[other].toLowerCase()} cards here</h4>${mini(theirs, p)}
      <h4>Your ${COLOURS[c].toLowerCase()} cards that fit best here</h4>${mini(mine, p)}
    </div>`;
  }).join("");
  return `<section class="block"><h2>Finding a second colour</h2>
    <p class="hint">Pairs with ${COLOURS[c].toLowerCase()}, best deck win rate first. Strong cards from a column still coming late in the pack point to that pair being open.</p>
    <div class="partners">${cols}</div></section>`;
}

function numbers(set) {
  const m = set.meta, b = m.bands;
  return section("Reading the numbers", `
    <p>GIH is the win rate in games where the card was drawn or in the opening hand. ALSA is the average pick at which the card
    was last seen in a pack, so lower means people take it earlier.</p>
    ${statStrip([["Format average GIH", m.mean.toFixed(1), `SD ${m.sd}`], ["Bomb", `${b.bomb}+`, "2 SD above"],
      ["Strong", `${b.strong}+`, "1 SD above"], ["Rather not play", `< ${b.meh}`, "half an SD below"]])}
    <p class="hint">${m.games ? `${m.games.toLocaleString()} games of ${esc(set.config.format || "draft")}` : ""}${m.start ? `, ${m.start} to ${m.end}` : ""}. Source: 17Lands.</p>
    <p>Grades: B is the format average and each step is half a standard deviation: A+ (2 SD above), A, A-, B+, B, C+, C, D, F.</p>`);
}

function top(left, right, middle = "") { return `<div class="page-top${middle ? " has-middle" : ""}"><div class="top-main">${left}</div>${middle ? `<div class="top-middle">${middle}</div>` : ""}<aside class="top-side">${right}</aside></div>`; }

export function colourPage(set, c) {
  const secs = set.colours[c]?.sections, st = colourStats(set, c);
  const name = COLOURS[c].toLowerCase();
  const own = set.cards.filter(x => x.colors === c || (x.hybrid && x.colors.includes(c)));
  const goodRemoval = set.cards.filter(x => x.colors.includes(c) && x.tags.includes("Removal") && x.gih >= set.meta.mean);
  const stats = statStrip([["Commons", st.commons.toFixed(1), "mean GIH"], ["Uncommons", st.uncommons.toFixed(1), "mean GIH"],
    ["Strong cards", st.strong, `GIH ${set.meta.bands.strong}+`], ["Cards", st.cards, "including gold"]]);
  const pairs = `<p class="subtitle">${pairsWith(set, c).map(p => link(set, `pair/${p}`, `${pips(p)}${p} ${esc(pairLabel(set, p))}`, "sub-link")).join("")}</p>`;
  return top(head("Colours", COLOURS[c], c, pairs) + sections(set, secs), stats)
    + partners(set, c)
    + pickGuide(set, c, own, [], { scoreOf: x => x.gih, title: `${COLOURS[c]} cards`,
      scope: `Ranked by overall win rate. ${COLOURS[c]} cards only; gold cards are on the pair pages.` })
    + (goodRemoval.length ? section(`Good ${name} removal`, grid(set, goodRemoval, { compact: true })) : "");
}

export function pairPage(set, p) {
  const { archetypes, tribes } = set.pairs[p];
  const rank = pairRank(set);
  const fits = set.cards.filter(x => inPair(x, p));
  const wr = set.meta.deck_wr[p];
  const members = t => set.cards.filter(x => x.tribes.includes(t) && !x.changeling).length;
  const stats = statStrip([["Deck win rate", wr ? wr.toFixed(1) : "n/a", `format ${set.meta.deck_wr_all ?? "n/a"}`],
    ["Rank", rank.includes(p) ? `${rank.indexOf(p) + 1} of ${rank.length}` : "n/a", "by deck win rate"],
    ...tribes.map(t => [`${t} cards`, members(t), "in the set"])]);
  const links = set.colourList.filter(c => p.includes(c)).map(c => link(set, `colour/${c}`, `${pips(c)}${COLOURS[c]}`, "sub-link"));
  const textOnly = secs => (secs || []).filter(s => !s.cards);

  const plan = archetypes.map(a => {
    const mech = a.mechanic && set.page.get(a.mechanic);
    return `${archetypes.length > 1 ? `<h2>${esc(a.name)}</h2>` : ""}${sections(set, textOnly(a.sections))}
      ${mech ? chips([link(set, mech.id, `Mechanic: ${esc(mech.title)}`, "chip")]) : ""}`;
  }).join("") || `<p class="hint">No archetype written up for this pair yet. The cards below come from the data.</p>`;
  const keyCards = archetypes.flatMap(a => a.key || []);
  const signBlock = keyCards.length ? `<div class="signposts"><h3>Key cards</h3><p class="hint">What the deck is built around. Seeing these late hints the pair is open.</p>
    ${grid(set, keyCards.map(([n, note]) => ({ card: set.byName.get(n), score: pairScore(set.byName.get(n), p), note })), { compact: true })}</div>` : "";
  const tribeWords = set.tribes.flatMap(t => [t, t === "Mouse" ? "Mice" : `${t}s`]);
  const tribeRe = tribeWords.length ? new RegExp(`\\b(${tribeWords.join("|")})\\b`) : null;
  const payoffThemes = set.pairList.flatMap(q => set.pairs[q].archetypes.map(a => a.theme).filter(Boolean));
  const splash = set.cards.filter(x => !inPair(x, p) && x.colors.length === 1 && (x.cost.match(/\{[WUBRG]\}/g) || []).length === 1
    && (x.tags.includes("Removal") ? x.gih >= set.meta.mean : (x.rarity === "R" || x.rarity === "M") && x.gih >= set.meta.bands.strong)
    && !(tribeRe && tribeRe.test(x.text)) && !payoffThemes.some(t => themeRole(x, t) === "payoff"))
    .sort((a, b) => b.gih - a.gih);
  const sub = `<p class="subtitle">${tribes.length ? `${esc(tribes.join(" and "))} tribe · ` : ""}${links.join("")}</p>`;
  const side = stats.replace('<dl class="stats">', '<dl class="stats stats-side">') + curve(set, fits, p);
  return top(head("Colour pairs", `${p} ${pairLabel(set, p)}`, p, sub) + plan, side, signBlock)
    + pickGuide(set, p, fits, archetypes, { scoreOf: x => pairScore(x, p), title: `Pick guide for ${p}`, splash,
      scope: `Ranked by overall win rate, adjusted for how the card actually does in ${p} decks (up to two grades either way).` });
}

function extras(set, page) {
  const seen = named(page.sections);
  if (page.group === "Mechanics") {
    const all = page.match ? set.cards.filter(x => matches(x, page.match)) : [];
    const users = set.pairList.filter(p => set.pairs[p].archetypes.some(a => a.mechanic === page.id));
    return {
      top: (page.summary ? `<p class="callout"><b>What it does.</b> ${esc(page.summary)}</p>` : "")
        + (page.verdict ? `<p class="callout"><b>How it plays.</b> ${esc(page.verdict)}</p>` : "")
        + chips(users.map(p => pairChip(set, p))),
      bottom: all.length ? section(`All ${all.length} cards with ${page.title.toLowerCase()}`, rows(set, [...all].sort((a, b) => b.gih - a.gih))) : "",
    };
  }
  let pool = [];
  if (page.tag) pool = set.cards.filter(x => x.tags.includes(page.tag));
  if (page.band) pool = set.cards.filter(x => x.gih >= set.meta.bands[page.band]);
  const rest = pool.filter(x => !seen.has(x.name));
  return {
    top: "",
    bottom: rest.length ? section(seen.size ? "The rest" : "All of them", grid(set, rest, { compact: true })) : "",
  };
}

export function guidePage(set, page) {
  const { top, bottom } = extras(set, page);
  const stats = page.stats ? statStrip(page.stats.map(([l, v, h]) => [l, esc(v), h])) : "";
  return head(page.group, page.title, "", top + stats) + sections(set, page.sections) + (set.pages[0] === page ? numbers(set) : "") + bottom;
}
