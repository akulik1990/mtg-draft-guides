const KEY = "theme";
const media = matchMedia("(prefers-color-scheme: dark)");
const LABELS = { system: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };
const NEXT = { system: "light", light: "dark", dark: "system" };

const saved = () => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } };

function apply(pref) {
  const dark = pref === "dark" || (pref === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const btn = document.getElementById("theme");
  if (btn) {
    btn.textContent = LABELS[pref];
    btn.title = `Theme: ${pref}. Click to change.`;
  }
}

export function initTheme() {
  apply(saved());
  media.addEventListener("change", () => apply(saved()));
  document.getElementById("theme").addEventListener("click", () => {
    const pref = NEXT[saved()];
    try { localStorage.setItem(KEY, pref); } catch { /* private mode: still switches for this visit */ }
    apply(pref);
  });
}
