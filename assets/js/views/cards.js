import { COLOURS, RARITIES, fitsColours } from "../data.js?v=20261110011114";
import { grade } from "../data.js?v=20261110011114";
import { esc, grid, pips } from "../ui.js?v=20261110011114";

const TYPES = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land"];
const SORTS = { gih: "Win rate (GIH)", pair: "Win rate in the chosen pair", alsa: "Pick order (ALSA)", iwd: "Gain when drawn (IWD)",
  early: "Better early (opening hand)", late: "Better late (drawn)", top: "Top players' win rate", mv: "Mana value", name: "Name" };

function chips(name, items, selected) {
  return items.map(([v, label]) =>
    `<button type="button" class="chip" data-f="${name}" data-v="${v}" aria-pressed="${selected.includes(v)}">${label}</button>`).join("");
}

const options = (items, value, any) =>
  `<option value="">${any}</option>${items.map(v => `<option${v === value ? " selected" : ""}>${esc(v)}</option>`).join("")}`;

export function renderCards(set, params) {
  const f = Object.fromEntries(params);
  const colours = (f.colour || "").split(""), rar = (f.rarity || "").split(""), types = (f.type || "").split(",");
  return `<header class="page-head"><p class="eyebrow">${esc(set.config.name)}</p><h1>Card list</h1></header>
  <form class="filters" id="filters" autocomplete="off">
    <div class="frow"><label class="lab" for="f-q">Search</label><input type="search" id="f-q" name="q" value="${esc(f.q || "")}" placeholder="Name, type or rules text (a | b for either)"></div>
    <div class="frow"><span class="lab">Colour</span>${chips("colour", [...Object.entries(COLOURS).map(([k, v]) => [k, `${pips(k)}${v}`]), ["C", `${pips("C")}Colourless`]], colours)}
      <label class="check"><input type="checkbox" id="f-gold" ${f.gold ? "checked" : ""}> Gold only</label></div>
    <div class="frow"><span class="lab">Rarity</span>${chips("rarity", Object.entries(RARITIES), rar)}</div>
    <div class="frow"><span class="lab">Type</span>${chips("type", TYPES.filter(t => set.cards.some(c => c.types.includes(t))).map(t => [t, t]), types)}</div>
    <div class="frow"><span class="lab">More</span>
      ${set.tribes.length ? `<select id="f-tribe" aria-label="Tribe">${options(set.tribes, f.tribe, "Any tribe")}</select>` : ""}
      <select id="f-tag" aria-label="Role">${options(set.tags, f.tag, "Any role")}</select>
      <select id="f-sort" aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${k === (f.sort || "gih") ? " selected" : ""}>Sort: ${v}</option>`).join("")}</select>
      <span class="view-toggle" role="group" aria-label="View">
        <button type="button" class="chip" data-view="grid" aria-pressed="${f.view !== "list"}">Cards</button>
        <button type="button" class="chip" data-view="list" aria-pressed="${f.view === "list"}">List</button>
      </span>
      <button type="button" class="linkbtn" id="f-reset">Reset</button>
    </div>
  </form>
  <p class="count" id="count" aria-live="polite"></p>
  <div id="results"></div>`;
}

function read(form) {
  const p = new URLSearchParams();
  const val = id => form.querySelector(id)?.value || "";
  const pressed = name => [...form.querySelectorAll(`[data-f="${name}"][aria-pressed="true"]`)].map(b => b.dataset.v);
  if (val("#f-q").trim()) p.set("q", val("#f-q").trim());
  if (pressed("colour").length) p.set("colour", pressed("colour").join(""));
  if (form.querySelector("#f-gold").checked) p.set("gold", "1");
  if (pressed("rarity").length) p.set("rarity", pressed("rarity").join(""));
  if (pressed("type").length) p.set("type", pressed("type").join(","));
  for (const [id, key] of [["#f-tribe", "tribe"], ["#f-tag", "tag"]]) if (val(id)) p.set(key, val(id));
  if (val("#f-sort") && val("#f-sort") !== "gih") p.set("sort", val("#f-sort"));
  if (form.querySelector('[data-view="list"]').getAttribute("aria-pressed") === "true") p.set("view", "list");
  return p;
}

function filter(set, p) {
  const q = (p.get("q") || "").toLowerCase();
  const chosen = (p.get("colour") || "").split("").filter(Boolean);
  const wubrg = chosen.filter(x => x !== "C"), colourless = chosen.includes("C");
  const rar = p.get("rarity") || "", types = (p.get("type") || "").split(",").filter(Boolean);
  const min = parseFloat(p.get("min")) || 0;
  const pair = wubrg.length === 2 ? Object.keys(set.meta.deck_wr).find(k => [...k].sort().join() === [...wubrg].sort().join()) : null;
  const list = set.cards.filter(c =>
    (!q || q.split("|").some(t => `${c.name} ${c.types.join(" ")} ${c.subtypes.join(" ")} ${c.text}`.toLowerCase().includes(t.trim())))
    && (!chosen.length || (c.colors ? wubrg.length && fitsColours(c, wubrg) : colourless))
    && (!p.get("gold") || c.colors.length > 1)
    && (!rar || rar.includes(c.rarity))
    && (!types.length || c.types.some(t => types.includes(t)))
    && (!p.get("tribe") || c.tribes.includes(p.get("tribe")))
    && (!p.get("tag") || c.tags.includes(p.get("tag")))
    && c.gih >= min);
  const sort = p.get("sort") || "gih";
  const key = { early: c => c.gd - c.oh, late: c => c.oh - c.gd, top: c => -(c.top?.gih ?? 0), gih: c => -c.gih, pair: c => -(pair ? (c.pairs[pair]?.score ?? c.gih) : c.gih), alsa: c => c.alsa, iwd: c => -c.iwd, mv: c => c.mv * 100 - c.gih };
  list.sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => key[sort](a) - key[sort](b));
  return { list, pair };
}

function table(set, list, pair) {
  const hasTop = list.some(c => c.top);
  return `<div class="table"><table class="card-table"><thead><tr><th></th><th>Card</th><th>Cost</th><th>Type</th><th>Grade</th><th>GIH</th>
    ${pair ? `<th>${pair}</th>` : ""}<th>ALSA</th>${hasTop ? "<th>Top GIH</th>" : ""}</tr></thead><tbody>${list.map(c => `<tr data-card="${esc(c.name)}">
      <td><img loading="lazy" src="${esc(c.thumb || c.image)}" alt="" width="36" height="50"></td>
      <td><b>${esc(c.name)}</b>${set.notes[c.name] ? `<small>${esc(set.notes[c.name])}</small>` : ""}</td>
      <td>${pips(c.colors)}${esc(c.cost.replace(/[{}]/g, ""))}</td><td>${esc(c.types.join(" "))}</td>
      <td><b>${grade(set, c.gih)}</b></td><td>${c.gih.toFixed(1)}</td>${pair ? `<td>${c.pairs[pair]?.score.toFixed(1) ?? ""}</td>` : ""}
      <td>${c.alsa.toFixed(1)}</td>${hasTop ? `<td>${c.top?.gih.toFixed(1) ?? ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

export function bindCards(set, params, setRoute) {
  const form = document.getElementById("filters");
  const show = p => {
    const { list, pair } = filter(set, p);
    document.getElementById("count").textContent = `${list.length} of ${set.cards.length} cards`
      + (pair ? ` · win rate shown for ${pair} decks` : p.get("sort") === "pair" ? " · pick two colours to sort by pair" : "")
      + (p.get("min") ? ` · GIH ${p.get("min")} or more` : "");
    document.getElementById("results").innerHTML = !list.length ? `<p class="empty">No cards match. Try removing a filter.</p>`
      : p.get("view") === "list" ? table(set, list, pair) : grid(set, list, { pair });
  };
  const update = () => {
    const p = read(form);
    if (params.get("min")) p.set("min", params.get("min"));
    setRoute(`cards?${p}`);
    show(p);
  };
  form.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    if (b.dataset.view) form.querySelectorAll("[data-view]").forEach(v => v.setAttribute("aria-pressed", v === b));
    else b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
    update();
  });
  form.addEventListener("input", update);
  form.addEventListener("submit", e => e.preventDefault());
  document.getElementById("f-reset").addEventListener("click", () => { params = new URLSearchParams(); setRoute("cards", true); });
  show(params);
}
