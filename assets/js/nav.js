import { COLOURS, pairLabel } from "./data.js?v=20261110011114";
import { esc, pips } from "./ui.js?v=20261110011114";
import { REFERENCE, referenceList } from "./views/reference.js?v=20261110011114";

const opened = new Set();
const closed = new Set();

export function bindNav(nav) {
  nav.addEventListener("click", e => {
    const d = e.target.closest("summary")?.parentElement;
    if (!d) return;
    const name = d.dataset.group, opening = !d.open;
    if (opening) { opened.add(name); closed.delete(name); } else { closed.add(name); opened.delete(name); }
  });
}

export function renderNav(set, current) {
  const href = r => `#/${set.code}/${r}`;
  const item = (route, label, icon = "", note = "") => ({
    route,
    html: `<a href="${href(route)}"${route === current ? ' aria-current="page"' : ""}>${icon ? pips(icon) : ""}<span>${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ""}</a>`,
  });
  const group = (name, items, overview = true) => {
    if (overview) items = [item(`group/${name}`, "Overview"), ...items];
    const here = items.some(i => i.route === current);
    if (here) closed.delete(name);
    const open = here || (opened.has(name) && !closed.has(name));
    return `<details class="nav-group" data-group="${esc(name)}"${open ? " open" : ""}>
      <summary class="nav-head">${esc(name)}</summary>${items.map(i => i.html).join("")}</details>`;
  };
  const pagesIn = g => set.pages.filter(p => p.group === g && !REFERENCE[p.id]).map(p => item(p.id, p.title));
  return [
    set.groups.includes("Basics") ? group("Basics", pagesIn("Basics"), false) : "",
    group("Colours", set.colourList.map(c => item(`colour/${c}`, COLOURS[c], c))),
    group("Colour pairs", set.pairList.map(p => item(`pair/${p}`, pairLabel(set, p), p, set.pairs[p].tribes.join(", ")))),
    ...set.groups.filter(g => g !== "Basics" && pagesIn(g).length).map(g => group(g, pagesIn(g), g === "Mechanics")),
    group("Reference", [item("cards", "Card list"), ...referenceList(set).map(([id, r]) => item(id, r.title))], false),
  ].join("");
}
