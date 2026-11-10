import { COLOURS, colourStats, pairLabel, pairRank } from "../data.js?v=20261110011114";
import { esc, link, pips } from "../ui.js?v=20261110011114";

const firstSentence = secs => ((secs || []).flatMap(s => s.text || [])[0] || "").split(/(?<=\.)\s/)[0];

function table(head, rows) {
  return `<div class="table"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

const views = {
  Colours(set) {
    return table(["Colour", "Pairs' deck WR", "Commons", "Uncommons", "Strong cards", "In short"], set.colourList.map(c => {
      const st = colourStats(set, c);
      return [link(set, `colour/${c}`, `${pips(c)}${COLOURS[c]}`), set.colourWr[c].toFixed(1), st.commons.toFixed(1), st.uncommons.toFixed(1), st.strong,
        esc(firstSentence(set.colours[c]?.sections))];
    })) + `<p class="hint">Ranked by the average deck win rate of the pairs that include the colour. Commons / uncommons: mean GIH of that colour's cards. Strong = GIH ${set.meta.bands.strong} or more.</p>`;
  },
  "Colour pairs"(set) {
    const rank = pairRank(set);
    const sorted = [...set.pairList].sort((a, b) => (rank.indexOf(a) + 99) % 99 - (rank.indexOf(b) + 99) % 99);
    return table(["Pair", "Deck WR", "Archetype", "Tribe", "Plan"], sorted.map(p => {
      const { archetypes, tribes } = set.pairs[p];
      return [link(set, `pair/${p}`, `${pips(p)}${p}`), set.meta.deck_wr[p]?.toFixed(1) ?? "n/a", esc(pairLabel(set, p)),
        esc(tribes.join(", ")), esc(firstSentence(archetypes[0]?.sections))];
    })) + `<p class="hint">Deck win rate across all 17Lands decks of that pair. Format average ${set.meta.deck_wr_all ?? "n/a"}.</p>`;
  },
  Mechanics(set, pages) {
    return table(["Mechanic", "What it does", "How it plays"], pages.map(p => [link(set, p.id, esc(p.title)), esc(p.summary || ""), esc(p.verdict || "")]));
  },
};

export function renderOverview(set, group) {
  const pages = set.pages.filter(p => p.group === group);
  const body = views[group] ? views[group](set, pages)
    : `<ul class="page-list">${pages.map(p => `<li>${link(set, p.id, esc(p.title))}<span>${esc(firstSentence(p.sections))}</span></li>`).join("")}</ul>`;
  return `<header class="page-head"><p class="eyebrow">${esc(set.config.name)}</p><h1>${esc(group)}</h1></header>${body}`;
}
