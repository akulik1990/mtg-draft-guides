#!/usr/bin/env python3
# Offline PDF of one set's guide: every page printed by headless Chrome, contents pages with links, a Contents button on
# every page, bookmarks grouped like the site menu.
# usage: uv run --no-project --with pypdf --with pillow --with reportlab python tools/pdf.py CODE out.pdf
import functools
import http.server
import io
import json
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

from smoke import CHROME, routes

ROOT = Path(__file__).resolve().parent.parent
W, H = 612, 792
COLOURS = {"W": "White", "U": "Blue", "B": "Black", "R": "Red", "G": "Green"}
REF = {"first-picks": "First picks", "cards?view=list": "All cards with notes", "instant-speed": "Instant speed",
       "sleepers": "Sleepers and overrated", "top-players": "Top players", "splash": "Splash"}
BLUE, GREY = HexColor("#1f5fa8"), HexColor("#6b7a72")


# Print each page
def render(code, tmp):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    todo = list(dict.fromkeys(r for r in routes(code) if r != "cards"))

    def one(r):
        f = tmp / f"{abs(hash(r))}.pdf"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000",
                        "--run-all-compositor-stages-before-draw", f"--print-to-pdf={f}", f"http://127.0.0.1:{port}/#/{code}/{r}"],
                       capture_output=True, timeout=180)
        return r, f

    with ThreadPoolExecutor(6) as pool:
        done = dict(pool.map(one, todo))
    server.shutdown()
    return {("home" if r == "" else r): f for r, f in done.items() if f.exists() and f.stat().st_size}


# Site menu order
def menu(guide):
    group = lambda g: [(p["title"], p["id"]) for p in guide["pages"] if p["group"] == g]
    pairName = {p: v["archetypes"][0]["name"] if v.get("archetypes") else "" for p, v in guide["pairs"].items()}
    return [("", [("Start", "home")]),
            ("Basics", group("Basics")),
            ("Colours", [("Overview", "group/Colours")] + [(COLOURS[c], f"colour/{c}") for c in "WUBRG"]),
            ("Colour pairs", [("Overview", "group/Colour%20pairs")] + [(f"{p}  {pairName[p]}".strip(), f"pair/{p}") for p in guide["pairs"]]),
            ("Mechanics", [("Overview", "group/Mechanics")] + group("Mechanics")),
            ("Card lists", [("Overview", "group/Card%20lists")] + group("Card lists")),
            ("Reference", [(t, k) for k, t in REF.items()])]


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: pdf.py CODE out.pdf")
    code, out = sys.argv[1].upper(), Path(sys.argv[2])
    guide = json.loads((ROOT / "sets" / code / "guide.json").read_text())
    with tempfile.TemporaryDirectory() as t:
        files = render(code, Path(t))
        parts = {r: PdfReader(str(f)) for r, f in files.items()}
        sections = [(g, [(title, r) for title, r in items if r in parts]) for g, items in menu(guide)]
        sections = [(g, items) for g, items in sections if items]

        # Lay out the contents, then number the pages
        LINE, HEAD, TOP, BOTTOM = 22, 34, 80, 50
        layout, page, y = [], 0, H - TOP
        for g, items in sections:
            if g:
                if y - HEAD - LINE < BOTTOM:
                    page, y = page + 1, H - TOP
                layout.append((page, y - 12, g, None))
                y -= HEAD
            for title, r in items:
                if y - LINE < BOTTOM:
                    page, y = page + 1, H - TOP
                layout.append((page, y, title, r))
                y -= LINE
        nToc = page + 1
        start, p = {}, nToc
        for g, items in sections:
            for title, r in items:
                start[r] = p
                p += len(parts[r].pages)

        # Contents pages
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(W, H))
        for pg in range(nToc):
            c.setFont("Helvetica-Bold", 22)
            c.drawString(48, H - 52, f"{guide['name']} draft guide" + ("" if pg == 0 else " (continued)"))
            for lp, ly, text, r in layout:
                if lp != pg:
                    continue
                if r is None:
                    c.setFillColor(GREY)
                    c.setFont("Helvetica-Bold", 12)
                    c.drawString(48, ly, text.upper())
                else:
                    c.setFillColor(BLUE)
                    c.setFont("Helvetica", 15)
                    c.drawString(64, ly, text)
                    c.setFillColor(GREY)
                    c.drawRightString(W - 48, ly, str(start[r] + 1))
            c.setFillColor(HexColor("#000000"))
            c.showPage()
        c.save()

        # Contents button
        sb = io.BytesIO()
        s = canvas.Canvas(sb, pagesize=(W, H))
        s.setFillColor(BLUE)
        s.roundRect(W - 128, H - 30, 108, 22, 6, fill=1, stroke=0)
        s.setFillColor(HexColor("#ffffff"))
        s.setFont("Helvetica-Bold", 12)
        s.drawCentredString(W - 74, H - 23, "Contents")
        s.showPage()
        s.save()
        stamp = PdfReader(io.BytesIO(sb.getvalue())).pages[0]

        w = PdfWriter()
        for pg in PdfReader(io.BytesIO(buf.getvalue())).pages:
            w.add_page(pg)
        for g, items in sections:
            for title, r in items:
                for pg in parts[r].pages:
                    w.add_page(pg)
                    w.pages[-1].merge_page(stamp)
                    w.add_annotation(len(w.pages) - 1, Link(rect=(W - 128, H - 30, W - 20, H - 8), target_page_index=0))
        for lp, ly, text, r in layout:
            if r:
                w.add_annotation(lp, Link(rect=(56, ly - 6, W - 40, ly + 16), target_page_index=start[r]))
        w.add_outline_item(title="Contents", page_number=0)
        for g, items in sections:
            parent = w.add_outline_item(title=g, page_number=start[items[0][1]]) if g else None
            for title, r in items:
                w.add_outline_item(title=title, page_number=start[r], parent=parent)

        # Size: shared images once, recompressed, compressed page streams
        w.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
        for pg in w.pages:
            for img in pg.images:
                try:
                    img.replace(img.image, quality=60)
                except Exception:
                    pass
            pg.compress_content_streams(level=9)
        w.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
        w.write(str(out))
    print(f"{out}: {len(w.pages)} pages, {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
