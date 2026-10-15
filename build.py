#!/usr/bin/env python3
"""Inline web/ into dist/escape-room.html (offline single-file snapshot)."""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
DIST = os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)
html = open(os.path.join(WEB, "index.html"), encoding="utf-8").read()
css = open(os.path.join(WEB, "app.css"), encoding="utf-8").read()
js = open(os.path.join(WEB, "app.js"), encoding="utf-8").read()
# Use callable replacements so re.sub does not reinterpret backslashes in css/js
# (e.g. JS string "\\n" must stay as backslash-n, not become a real newline).
out = html
out = re.sub(
    r'<link\s+rel="stylesheet"\s+href="app\.css"\s*/?>',
    lambda _m: f"<style>\n{css}\n</style>",
    out,
)
out = re.sub(
    r'<script\s+src="app\.js"\s*>\s*</script>',
    lambda _m: f"<script>\n{js}\n</script>",
    out,
)
path = os.path.join(DIST, "escape-room.html")
open(path, "w", encoding="utf-8").write(out)
open(os.path.join(DIST, "index.html"), "w", encoding="utf-8").write(out)
print(f"wrote {path} ({os.path.getsize(path)} bytes)")
