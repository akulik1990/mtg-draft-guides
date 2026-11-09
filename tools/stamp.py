#!/usr/bin/env python3
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAMP = time.strftime("%Y%m%d%H%M%S")

REF = re.compile(r'''((?:href|src)="assets/[^"?]+\.(?:css|js)|from "\.{1,2}/[^"?]+\.js)(?:\?v=\d+)?(")''')

for path in [ROOT / "index.html", *ROOT.glob("assets/js/**/*.js")]:
    text = path.read_text()
    new = REF.sub(rf"\1?v={STAMP}\2", text)
    if new != text:
        path.write_text(new)
print(f"stamped {STAMP}")
