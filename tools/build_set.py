#!/usr/bin/env python3
import sys
import json
import re
from pathlib import Path
import statistics
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
PAIRS = ["WU", "UB", "BR", "RG", "GW", "WB", "UR", "BG", "RW", "GU"]
GROUPS = ["Basics", "Mechanics", "Card lists"]
PAGE_KEYS = {"id", "title", "group", "match", "match_label", "band", "tag", "summary", "verdict", "stats", "sections"}
ARCHETYPE_KEYS = {"name", "mechanic", "theme", "key", "sections"}
SECTION_KEYS = {"heading", "text", "list", "cards"}
TAGS = {"removal": "Removal", "evasion": "Evasion", "card_advantage": "Card advantage", "lifegain": "Lifegain",
        "fixing_ramp": "Ramp / fixing", "combat_trick": "Combat trick", "mana_sink": "Mana sink", "protection": "Protection",
        "hate": "Sideboard"}
MIN_SAMPLES = 500
PAIR_SAMPLES = 200
RARE_SHARE = 0.10
SHRINK_K = 300
TOP_SAMPLES = 500


def ordered(colours):
    return "".join(c for c in "WUBRG" if c in colours)


def fits(colours, cost, pair):
    hybrid = re.findall(r"\{([WUBRG])/([WUBRG])\}", cost)
    fixed = set(re.findall(r"\{([WUBRG])\}", cost)) | (set(colours) if not hybrid and not cost else set())
    if not hybrid and not re.search(r"\{[WUBRG]", cost):
        fixed = set(colours)
    return fixed <= set(pair) and all(a in pair or b in pair for a, b in hybrid)


def buildCards(raw, tribes, combos, top=None):
    topBy = {}
    for v in (top or {}).get("card_ratings", {}).values():
        a = (v.get("deck_colors") or {}).get("All Decks") or {}
        if a.get("gihwr"):
            topBy.setdefault(v["name"], a)
    cards = {}
    for v in raw["card_ratings"].values():
        a = (v.get("deck_colors") or {}).get("All Decks") or {}
        if not a.get("gihwr") or v["name"] in cards:
            continue
        text = v.get("oracle_text") or ""
        subtypes = v.get("subtypes") or []
        image = (v.get("image") or [""])[0]
        cost = v.get("mana_cost") or ""
        colours = ordered(v.get("colors") or [])
        fit = [p for p in combos if fits(colours, cost, p)]
        pairs = {}
        total = a.get("samples") or 1
        rareIn = []
        for p in fit:
            d = v["deck_colors"].get(ordered(p)) or {}
            if d.get("samples", 0) / total < RARE_SHARE:
                rareIn.append(p)
            if d.get("gihwr") and d.get("samples", 0) >= PAIR_SAMPLES:
                pairs[p] = {"wr": round(d["gihwr"], 1), "n": d["samples"]}
        changeling = bool(re.search(r"(^|\n)Changeling\b", text))
        cards[v["name"]] = {
            "name": v["name"],
            "rarity": v["rarity"][0].upper(),
            "colors": ordered(v.get("colors") or []),
            "mv": int(float(v.get("cmc") or 0)),
            "cost": v.get("mana_cost") or "",
            "types": v.get("types") or [],
            "subtypes": subtypes,
            "text": text,
            "image": image.replace("/large/", "/normal/"),
            "thumb": image.replace("/large/", "/small/"),
            "image_large": image,
            "gih": round(a["gihwr"], 1),
            "oh": round(a.get("ohwr") or 0, 1),
            "gd": round(a.get("gdwr") or 0, 1),
            "alsa": round(a.get("alsa") or 0, 2),
            "iwd": round(a.get("iwd") or 0, 1),
            "samples": a.get("samples", 0),
            "fits": fit,
            "hybrid": "/" in cost,
            "pairs": pairs,
            "rare_in": rareIn,
            "tags": [TAGS.get(t, t.replace("_", " ").capitalize()) for t in v.get("tags") or []],
            "changeling": changeling,
            "tribes": list(tribes) if changeling else [t for t in tribes if t in subtypes],
        }
        t = topBy.get(v["name"])
        if t and t.get("samples", 0) >= TOP_SAMPLES:
            cards[v["name"]]["top"] = {"gih": round(t["gihwr"], 1), "alsa": round(t.get("alsa") or 0, 2), "n": t["samples"]}
    return sorted(cards.values(), key=lambda c: -c["gih"])


def pairScores(cards, combos, sd):
    shift = {}
    for p in combos:
        gaps = [(c["pairs"][p]["wr"] - c["gih"], c["pairs"][p]["n"]) for c in cards if p in c["pairs"]]
        shift[p] = sum(g * n for g, n in gaps) / sum(n for _, n in gaps) if gaps else 0
    for c in cards:
        for p, d in c["pairs"].items():
            n = d["n"]
            raw = d["wr"] - c["gih"] - shift[p]
            effect = max(-sd, min(sd, raw * n / (n + SHRINK_K)))
            se = 100 * (0.25 / n) ** 0.5
            d["effect"] = round(effect, 1)
            d["score"] = round(c["gih"] + effect, 1)
            d["sure"] = abs(raw) > 2 * se
    return {p: round(v, 2) for p, v in shift.items()}


def meta(raw, cards, combos, shift=None):
    g = [c["gih"] for c in cards if c["samples"] >= MIN_SAMPLES and "Land" not in c["types"]]
    mean, sd = statistics.mean(g), statistics.pstdev(g)
    cr = raw.get("color_ratings") or {}
    m = raw.get("meta") or {}
    goodAlsa = sorted(c["alsa"] for c in cards if c["samples"] >= MIN_SAMPLES and c["gih"] >= mean)
    return {
        "late_alsa": round(goodAlsa[int(len(goodAlsa) * 0.75)], 2) if goodAlsa else 99,
        "games": m.get("game_count"), "start": m.get("start_date"), "end": m.get("end_date"),
        "mean": round(mean, 1), "sd": round(sd, 1), "min_samples": MIN_SAMPLES,
        "bands": {"bomb": round(mean + 2 * sd, 1), "strong": round(mean + sd, 1), "good": round(mean, 1), "meh": round(mean - sd / 2, 1)},
        "deck_wr": {p: cr[ordered(p)] for p in combos if cr.get(ordered(p))},
        "deck_wr_all": cr.get(""),
        "pair_shift": shift or {},
        "shrink_k": SHRINK_K,
    }


def checkGuide(guide, names):
    problems, prose = [f"missing {k}" for k in ("name", "released", "format") if not guide.get(k)], []
    ids = [p.get("id") for p in guide.get("pages", [])]

    def sections(where, secs):
        for s in secs:
            problems.extend(f"{where}: unknown section key {k}" for k in s if k not in SECTION_KEYS)
            problems.extend(f"{where}: unknown card {n}" for n, _ in s.get("cards", []) if n not in names)
            prose.append((where, " ".join([s.get("heading", ""), *s.get("text", []), *s.get("list", []), *(n for _, n in s.get("cards", []))])))

    problems += [f"note for unknown card {n}" for n in guide.get("notes", {}) if n not in names]
    problems += [f"correction for unknown card {n}" for n in guide.get("corrections", {}) if n not in names]
    prose += [(f"note {n}", t) for n, t in guide.get("notes", {}).items()]
    for c, v in guide.get("colours", {}).items():
        problems += [f"colour {c} is not one of WUBRG"] if c not in "WUBRG" or len(c) != 1 else []
        sections(f"colour {c}", v.get("sections", []))
    for pair, v in guide.get("pairs", {}).items():
        problems += [f"pair {pair}: use 2 or 3 of WUBRG"] if not (2 <= len(pair) <= 3 and set(pair) <= set("WUBRG") and len(set(pair)) == len(pair)) else []
        problems += [f"pair {pair}: unknown key {k}" for k in v if k not in ("archetypes", "tribes")]
        for a in v.get("archetypes", []):
            problems += [f"pair {pair}: unknown archetype key {k}" for k in a if k not in ARCHETYPE_KEYS]
            problems += [f"pair {pair}: archetype without a name"] if not a.get("name") else []
            problems += [f"pair {pair}: mechanic {a['mechanic']} is not a page id"] if a.get("mechanic") and a["mechanic"] not in ids else []
            th = a.get("theme")
            problems += [f"pair {pair}: theme needs a label and payoff / enabler lists"] if th and (not th.get("label") or set(th) - {"label", "payoff", "enabler", "payoff_cards", "enabler_cards", "exclude"}) else []
            problems += [f"pair {pair}: theme names unknown card {n}" for k in ("payoff_cards", "enabler_cards", "exclude") for n in (th or {}).get(k, []) if n not in names]
            prose.append((f"pair {pair}", a.get("name", "")))
            problems += [f"pair {pair}: unknown key card {n}" for n, _ in a.get("key", []) if n not in names]
            prose += [(f"pair {pair} key", note) for _, note in a.get("key", [])]
            sections(f"pair {pair}", a.get("sections", []))
    for p in guide.get("pages", []):
        w = p.get("id", "?")
        problems += [f"{w}: unknown key {k}" for k in p if k not in PAGE_KEYS]
        problems += [f"{w}: missing {k}" for k in ("id", "title", "group") if k not in p]
        problems += [f"{w}: group {p.get('group')} not in {GROUPS}"] if p.get("group") not in GROUPS else []
        prose.append((w, " ".join([p.get("summary", ""), p.get("verdict", "")])))
        sections(w, p.get("sections", []))
    nameRe = [(n, re.compile(r"(?<![\w'])" + re.escape(n) + r"(?![\w])")) for n in names if len(n) > 3]
    for where, text in prose:
        problems += [f"{where}: card name in prose: {n}" for n, r in nameRe if r.search(text)]
        problems += [f"{where}: em dash"] if "\u2014" in text else []
    problems += [f"duplicate page id {i}" for i in set(ids) if ids.count(i) > 1]
    return problems


def tribes(guide):
    return list(dict.fromkeys(t for v in guide.get("pairs", {}).values() for t in v.get("tribes", [])))


def writeIndex():
    sets = []
    for f in ROOT.glob("sets/*/guide.json"):
        g = json.loads(f.read_text())
        sets.append({"code": f.parent.name, "name": g.get("name", f.parent.name), "released": g.get("released", ""), "format": g.get("format", "")})
    sets.sort(key=lambda s: s["released"], reverse=True)
    (ROOT / "sets/sets.json").write_text(json.dumps(sets, indent=1) + "\n")


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit("usage: build_set.py CODE all_data.json [top_data.json]")
    code, dataset = sys.argv[1].upper(), Path(sys.argv[2])
    top = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) == 4 else None
    d = ROOT / "sets" / code
    raw = json.loads(dataset.read_text())
    guide = json.loads((d / "guide.json").read_text())
    combos = list(guide.get("pairs") or PAIRS)
    cards = buildCards(raw, tribes(guide), combos, top)
    for c in cards:
        fix = guide.get("corrections", {}).get(c["name"])
        if fix:
            c.update(fix)
            c["fits"] = [p for p in combos if fits(c["colors"], c["cost"], p)]
            c["pairs"] = {p: d for p, d in c["pairs"].items() if p in c["fits"]}
    m0 = meta(raw, cards, combos)
    shift = pairScores(cards, combos, m0["sd"])
    out = {"meta": meta(raw, cards, combos, shift), "cards": cards}
    days = (date.fromisoformat(out["meta"]["end"][:10]) - date.fromisoformat(out["meta"]["start"][:10])).days if out["meta"].get("start") else 0
    if days > 90:
        print(f"  note: the dataset covers {days} days ({out['meta']['start']} to {out['meta']['end']}); early-format data reads differently")
    if top:
        out["meta"]["top_games"] = (top.get("meta") or {}).get("game_count")
    (d / "cards.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    writeIndex()
    problems = checkGuide(guide, {c["name"] for c in cards})
    print(f"{code}: {len(cards)} cards, {len(guide.get('pages', []))} extra pages, mean GIH {out['meta']['mean']}, SD {out['meta']['sd']}")
    for p in problems:
        print("  " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
