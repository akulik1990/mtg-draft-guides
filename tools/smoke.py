#!/usr/bin/env python3
import functools
import http.server
import json
import re
import shutil
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = shutil.which("google-chrome-stable") or shutil.which("google-chrome") or shutil.which("chromium")
COLOURS = "WUBRG"
REFERENCE = ["first-picks", "cards", "cards?view=list", "removal", "instant-speed", "sleepers", "top-players", "splash"]


# Every page a set has
def routes(code):
    guide = json.loads((ROOT / "sets" / code / "guide.json").read_text())
    pairs = list(guide.get("pairs") or ["WU", "UB", "BR", "RG", "GW", "WB", "UR", "BG", "RW", "GU"])
    pages = [p["id"] for p in guide.get("pages", [])]
    groups = {p["group"] for p in guide.get("pages", [])}
    return ["", *pages, *(f"colour/{c}" for c in COLOURS), *(f"pair/{p}" for p in pairs),
            "group/Colours", "group/Colour%20pairs", *(f"group/{g.replace(' ', '%20')}" for g in groups), *REFERENCE]


# Load a page headless, return the text of <main>
def mainText(url):
    out = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=2500", "--dump-dom", url],
                         capture_output=True, text=True, timeout=60).stdout
    m = re.search(r'<main id="main"[^>]*>(.*?)</main>', out, re.S)
    return re.sub(r"<[^>]+>", " ", m.group(1)) if m else ""


def main():
    if not CHROME:
        sys.exit("needs google-chrome or chromium on PATH")
    if not (ROOT / "sets/sets.json").exists():
        sys.exit("no sets/sets.json, run build_set.py first")
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    handler.log_message = lambda *a: None
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    todo = [(s["code"], r) for s in json.loads((ROOT / "sets/sets.json").read_text()) for r in routes(s["code"])]

    def check(item):
        code, r = item
        text = " ".join(mainText(f"http://127.0.0.1:{port}/#/{code}/{r}").split())
        bad = not text or "Loading" in text[:20] or "Could not" in text or "There is no page" in text or len(text) < 40
        return f"{code}/{r}: {text[:80] or '(empty)'}" if bad else None

    with ThreadPoolExecutor(10) as pool:
        failures = [f for f in pool.map(check, todo) if f]
    total = len(todo)
    server.shutdown()
    for f in failures:
        print("FAIL", f)
    print(f"{total - len(failures)} of {total} pages render")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
