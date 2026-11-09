import { inPair, myPair, pairScore, searchIndex, verdict } from "./data.js?v=20261110005414";
import { esc, pips } from "./ui.js?v=20261110005414";

const indexes = new WeakMap();

export function initSearch(getSet, go) {
  const input = document.getElementById("search");
  const box = document.getElementById("search-results");
  const close = () => { box.hidden = true; };

  input.addEventListener("input", () => {
    const set = getSet(), q = input.value.trim().toLowerCase();
    if (q.length < 2 || !set) return close();
    if (!indexes.has(set)) indexes.set(set, searchIndex(set));
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z])${safe}`);
    const word = new RegExp(`(^|[^a-z])${safe}(s|es)?([^a-z]|$)`);
    const pages = indexes.get(set).filter(e => word.test(e.hay))
      .sort((a, b) => b.title.toLowerCase().includes(q) - a.title.toLowerCase().includes(q)).slice(0, 6);
    const cards = set.cards.filter(c => re.test(c.name.toLowerCase())).slice(0, 8);
    const mine = myPair(set);
    box.innerHTML = (pages.length ? `<p class="sr-head">Guide</p>${pages.map(p =>
      `<a href="#/${set.code}/${p.route}">${p.pips ? pips(p.pips) : ""}${esc(p.title)}<small>${esc(p.group)}</small></a>`).join("")}` : "")
      + (cards.length ? `<p class="sr-head">Cards${mine ? ` · verdict for ${mine}` : ""}</p>${cards.map(c => {
        const v = mine ? (inPair(c, mine) ? verdict(set, pairScore(c, mine)).label : `not ${mine}`) : verdict(set, c.gih).label;
        return `<button type="button" data-card="${esc(c.name)}">${pips(c.colors)}${esc(c.name)}<small>${esc(v)}</small></button>`;
      }).join("")}` : "")
      + `<a class="sr-all" href="#/${set.code}/cards?${new URLSearchParams({ q: input.value.trim() })}">Search all cards: “${esc(input.value.trim())}”</a>`;
    box.hidden = false;
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { go(`cards?${new URLSearchParams({ q: input.value.trim() })}`); close(); input.blur(); }
    if (e.key === "Escape") { close(); input.blur(); }
  });
  box.addEventListener("click", () => { close(); input.value = ""; });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) close(); });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); input.focus(); }
  });
}
