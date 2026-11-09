import { band, grade, inPair, myPair, pairScore, RARITIES, verdict } from "./data.js?v=20261110005414";
import { esc, link, pips } from "./ui.js?v=20261110005414";

const dlg = document.getElementById("card-dialog");
const body = document.getElementById("card-dialog-body");

export function initDialog(getSet) {
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-card]");
    if (t) open(getSet(), t.dataset.card);
  });
  document.getElementById("card-dialog-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  body.addEventListener("click", e => { if (e.target.closest("a")) dlg.close(); });
}

function guideMentions(set, name) {
  const from = (route, title, secs) => (secs || []).flatMap(s => (s.cards || [])
    .filter(([n, note]) => n === name && note).map(([, note]) => ({ route, title, note })));
  return [
    ...Object.entries(set.colours).flatMap(([c, v]) => from(`colour/${c}`, c, v.sections)),
    ...set.pairList.flatMap(p => set.pairs[p].archetypes.flatMap(a => from(`pair/${p}`, `${p} ${a.name}`, a.sections))),
    ...set.pages.flatMap(p => from(p.id, p.title, p.sections)),
  ];
}

function open(set, name) {
  const c = set.byName.get(name);
  if (!c) return;
  const b = band(set, c.gih);
  const lo = set.meta.mean - 3 * set.meta.sd, hi = set.meta.mean + 3 * set.meta.sd;
  const pct = v => Math.max(2, Math.min(100, (v - lo) / (hi - lo) * 100));
  const pairs = Object.entries(c.pairs).sort((a, b) => b[1].score - a[1].score);
  const mine = myPair(set);
  const forMe = mine ? (inPair(c, mine)
    ? (() => { const v = verdict(set, pairScore(c, mine)); return `<p class="for-me verdict-${v.key}">For your ${mine} deck: <b>${v.label}</b> · grade ${grade(set, pairScore(c, mine))}</p>`; })()
    : `<p class="for-me">Not castable in ${mine}.</p>`) : "";
  const notes = guideMentions(set, name);
  const tribes = c.changeling ? ["Every tribe (changeling)"] : c.tribes;
  body.innerHTML = `
    <img src="${esc(c.image_large || c.image)}" alt="${esc(c.name)}">
    <div class="dlg-info">
      <h2>${esc(c.name)}</h2>${forMe}
      <p class="dlg-type">${pips(c.colors)} ${RARITIES[c.rarity]} · ${esc([c.types.join(" "), c.subtypes.join(" ")].filter(Boolean).join(" · "))} · mana value ${c.mv}</p>
      <dl class="stats">
        <div><dt>Grade</dt><dd>${grade(set, c.gih)}</dd><span>${b.label}</span></div>
        <div><dt>GIH win rate</dt><dd><span class="gih gih-${b.key}">${c.gih.toFixed(1)}</span></dd><span>in hand</span></div>
        <div><dt>Last seen at pick</dt><dd>${c.alsa.toFixed(1)}</dd><span>average</span></div>
        <div><dt>Gain when drawn</dt><dd>${c.iwd > 0 ? "+" : ""}${c.iwd.toFixed(1)}</dd><span>IWD</span></div>
        <div><dt>Opening hand</dt><dd>${c.oh.toFixed(1)}</dd><span>win rate</span></div>
        <div><dt>Drawn later</dt><dd>${c.gd.toFixed(1)}</dd><span>${c.oh - c.gd >= 1.5 ? "better early" : c.gd - c.oh >= 1.5 ? "better late" : "same early or late"}</span></div>
        ${c.top ? `<div><dt>Top players</dt><dd>${c.top.gih.toFixed(1)}</dd><span>pick ${c.top.alsa.toFixed(1)}</span></div>` : ""}
      </dl>
      ${set.notes[name] ? `<p class="dlg-note"><b>${esc(set.notes[name])}</b></p>` : ""}
      ${notes.filter(n => n.note !== set.notes[name]).length ? `<h3>Also in the guide</h3>${notes.filter(n => n.note !== set.notes[name]).map(n => `<p class="dlg-note">${link(set, n.route, esc(n.title))} ${esc(n.note)}</p>`).join("")}` : ""}
      ${pairs.length ? `<h3>By deck it fits</h3><div class="bars">${pairs.map(([p, d]) =>
        `<span>${set.pairs[p] ? link(set, `pair/${p}`, p) : p}</span><span class="bar"><i style="width:${pct(d.score)}%"></i><b style="left:${pct(set.meta.mean)}%"></b></span><span>${grade(set, d.score)}</span>`).join("")}</div>
        <p class="hint">Grade in each pair: overall win rate adjusted for how the card does in that pair's decks (up to two grades). Line = format average.</p>` : ""}
      ${tribes.length || c.tags.length ? `<h3>Tags</h3><p class="chips">${[...tribes, ...c.tags].map(t => `<span class="chip static">${esc(t)}</span>`).join("")}</p>` : ""}
      <h3>Rules text</h3><p class="oracle">${esc(c.text)}</p>
      <p class="hint">${c.samples.toLocaleString()} games with the card in hand.</p>
    </div>`;
  dlg.showModal();
  dlg.scrollTop = 0;
}
