"""Assemble the single-file GRONKILLION game from its source parts."""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

shell = (SRC / "shell.html").read_text(encoding="utf-8")
css = (SRC / "styles.css").read_text(encoding="utf-8")
js = (SRC / "data.js").read_text(encoding="utf-8") + "\n\n" + (SRC / "engine.js").read_text(encoding="utf-8")

assert "/*__CSS__*/" in shell and "/*__JS__*/" in shell
assert "</script" not in js.lower(), "inline script must not contain a closing script tag"
out = shell.replace("/*__CSS__*/", css.strip()).replace("/*__JS__*/", js.strip())
(ROOT / "index.html").write_text(out, encoding="utf-8")
print(f"index.html written: {len(out.encode('utf-8')) / 1024:.1f} KB")
