import { band, grade } from "./data.js?v=20261110003004";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export const pips = colours =>
  `<span class="pips" aria-hidden="true">${(colours || "C").split("").map(x => `<i class="pip pip-${x}"></i>`).join("")}</span>`;

export function link(set, route, label, cls = "") { return `<a class="${cls}" href="#/${set.code}/${route}">${label}</a>`; }

export const cardsLink = (set, params, label) =>
  link(set, `cards?${new URLSearchParams(params)}`, `${esc(label)}`, "more");

export function gih(set, value) {
  const b = band(set, value);
  return `<span class="gih gih-${b.key}" title="${b.label}">${grade(set, value)}&nbsp; ${value.toFixed(1)}</span>`;
}

export function tile(set, card, { note = "", pair = "", score, tags = "", flags = "", compact = false } = {}) {
  note ||= set.notes[card.name] || "";
  const inPair = !compact && pair && card.pairs[pair] ? `<span class="in-pair">${pair} ${card.pairs[pair].wr.toFixed(1)}</span>` : "";
  return `<button class="tile${compact ? " tile-compact" : ""}" data-card="${esc(card.name)}" data-r="${card.rarity === "M" ? "R" : card.rarity}" data-n="${esc(card.name.toLowerCase())}"${flags ? ` data-f="${esc(flags)}"` : ""}>
    <img loading="lazy" src="${esc(card.image)}" alt="${esc(card.name)}" width="488" height="680">
    <span class="tile-meta">${gih(set, score ?? card.gih)}<span>${card.rarity}</span>${compact ? "" : `<span>ALSA ${card.alsa.toFixed(1)}</span>`}${inPair}</span>
    ${tags ? `<span class="tags">${tags}</span>` : ""}
    ${note && !compact ? `<span class="tile-note">${esc(note)}</span>` : ""}
  </button>`;
}

export function grid(set, items, opts = {}) {
  if (!items.length) return `<p class="empty">No cards here yet.</p>`;
  return `<div class="grid${opts.compact ? " grid-compact" : ""}">${items.map(it => it.card ? tile(set, it.card, { ...opts, ...it }) : tile(set, it, opts)).join("")}</div>`;
}

export function section(heading, body, extra = "") {
  return `<section class="block">${heading ? `<h2>${esc(heading)}</h2>` : ""}${body}${extra}</section>`;
}

export function statStrip(stats) {
  return `<dl class="stats">${stats.map(([label, value, hint]) =>
    `<div><dt>${esc(label)}</dt><dd>${value}</dd>${hint ? `<span>${esc(hint)}</span>` : ""}</div>`).join("")}</dl>`;
}
