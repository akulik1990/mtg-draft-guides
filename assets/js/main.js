import { loadSet, loadSets, myPair } from "./data.js?v=20261110005414";
import { initDialog } from "./dialog.js?v=20261110005414";
import { bindNav, renderNav } from "./nav.js?v=20261110005414";
import { initSearch } from "./search.js?v=20261110005414";
import { initTheme } from "./theme.js?v=20261110005414";
import { esc } from "./ui.js?v=20261110005414";
import { bindCards, renderCards } from "./views/cards.js?v=20261110005414";
import { renderOverview } from "./views/overview.js?v=20261110005414";
import { colourPage, guidePage, pairPage } from "./views/page.js?v=20261110005414";
import { REFERENCE, renderReference } from "./views/reference.js?v=20261110005414";

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const picker = document.getElementById("set-picker");
let sets = [], current = null;

function parse() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [code, ...rest] = path.split("/");
  return { code: code || sets[0]?.code, route: decodeURIComponent(rest.join("/")), params: new URLSearchParams(query) };
}

function go(route, replace = false) {
  const url = `#/${current.code}/${route}`;
  replace ? history.replaceState(null, "", url) : (location.hash = url);
  if (replace) render();
}

function setRoute(route, rerender = false) {
  history.replaceState(null, "", `#/${current.code}/${route}`);
  if (rerender) render();
}

async function render() {
  const { code, route, params } = parse();
  if (!sets.some(s => s.code === code)) { location.hash = `#/${sets[0].code}/`; return; }
  try {
    current = await loadSet(code);
  } catch (err) {
    main.innerHTML = `<p class="empty">Could not load ${esc(code)}: ${esc(err.message)}</p>`;
    return;
  }
  picker.value = code;
  document.title = `${current.config.name} draft guide`;
  const id = route || current.pages[0]?.id || "group/Colour pairs";
  const navKey = id.startsWith("cards") ? "cards" : id;
  if (id === "cards") {
    main.innerHTML = renderCards(current, params);
    bindCards(current, params, setRoute);
  } else if (id.startsWith("group/")) {
    main.innerHTML = renderOverview(current, id.slice(6));
  } else if (REFERENCE[id]) {
    main.innerHTML = renderReference(current, id);
  } else if (/^colour\/[WUBRG]$/.test(id)) {
    main.innerHTML = colourPage(current, id.slice(7));
  } else if (id.startsWith("pair/") && current.pairs[id.slice(5)]) {
    myPair(current, id.slice(5));
    main.innerHTML = pairPage(current, id.slice(5));
  } else if (current.page.has(id)) {
    main.innerHTML = guidePage(current, current.page.get(id));
  } else {
    main.innerHTML = `<p class="empty">There is no page called “${esc(id)}” in ${esc(current.config.name)}.</p>`;
  }
  const keep = nav.scrollTop;
  nav.innerHTML = renderNav(current, navKey);
  nav.scrollTop = keep;
  const cur = nav.querySelector('[aria-current="page"]');
  if (cur && (cur.offsetTop < nav.scrollTop || cur.offsetTop + cur.offsetHeight > nav.scrollTop + nav.clientHeight)) {
    nav.scrollTop = cur.offsetTop - nav.clientHeight / 3;
  }
  document.body.classList.remove("nav-open");
  window.scrollTo(0, 0);
}

async function boot() {
  sets = await loadSets();
  picker.innerHTML = sets.map(s => `<option value="${esc(s.code)}">${esc(s.name)} (${esc(s.code)})</option>`).join("");
  picker.addEventListener("change", () => { location.hash = `#/${picker.value}/`; });
  document.getElementById("menu").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  initTheme();
  bindNav(nav);
  initDialog(() => current);
  initSearch(() => current, route => go(route));
  const setOpen = (v, open) => {
    v.querySelector(".verdict-cards").hidden = !open;
    v.querySelector(".verdict-label").setAttribute("aria-expanded", open);
  };
  const applyGuide = guide => {
    const r = guide.querySelector(".guide-rarity")?.value || "all";
    const q = (guide.querySelector(".guide-q")?.value || "").trim().toLowerCase();
    const picks = [".guide-type", ".guide-theme"].map(sel => guide.querySelector(sel)?.value).filter(Boolean);
    const on = [...guide.querySelectorAll('[data-filter][aria-pressed="true"]')].map(b => b.dataset.filter).concat(picks);
    const splashOn = on.includes("splash"), need = on.filter(f => f !== "splash");
    const active = q || need.length || r !== "all" || splashOn;
    guide.querySelectorAll(".verdict").forEach(v => {
      const isSplash = "splash" in v.dataset;
      let shown = 0;
      v.querySelectorAll(".tile").forEach(t => {
        const f = (t.dataset.f || "").split(" ");
        const ok = (!splashOn || isSplash) && (r === "all" || t.dataset.r === r) && (!q || t.dataset.n.includes(q)) && need.every(x => f.includes(x));
        t.hidden = !ok; if (ok) shown++;
      });
      v.hidden = !shown;
      v.querySelector("h3 small").textContent = shown;
      setOpen(v, active ? shown > 0 : v.dataset.open === "true");
    });
    guide.querySelector(".empty").hidden = [...guide.querySelectorAll(".verdict")].some(v => !v.hidden);
  };
  main.addEventListener("click", e => {
    const l = e.target.closest(".verdict-label");
    if (!l) return;
    const v = l.closest(".verdict"), open = l.getAttribute("aria-expanded") !== "true";
    setOpen(v, open);
    v.dataset.open = open;
  });
  main.addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
    applyGuide(b.closest(".pick-guide"));
  });
  main.addEventListener("input", e => { if (e.target.matches(".guide-q, .guide-rarity, .guide-type, .guide-theme")) applyGuide(e.target.closest(".pick-guide")); });
  window.addEventListener("hashchange", render);
  render();
}

boot().catch(err => { main.innerHTML = `<p class="empty">Could not start: ${esc(err.message)}</p>`; });
