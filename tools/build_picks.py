"""Bundle the round 4 pick page into one file: tools/style-picks-r4.html (published as an Artifact).

It inlines the game's own art (characters, monsters and mounts with their alternatives) so every face and creature
is drawn live, plus tools/picks-r4/data.json: screenshots of the rooms and the names of the alternatives, written by
`node tools/picks-r4/capture.js` with the game served at http://127.0.0.1:8767/.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "picks-r4")
ART = ["js/art/mobs.js", "js/art/alt_mounts.js", "js/art/alt_bosses.js", "js/art/characters.js"]


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def script(code, label):
    safe = code.replace("</script", "<\\/script")
    return f"<script>/* {label} */\n{safe}\n</script>"


def main():
    page = read(os.path.join(SRC, "page.html"))
    parts = [script(read(os.path.join(ROOT, p)), p) for p in ART]
    data_path = os.path.join(SRC, "data.json")
    data = json.loads(read(data_path)) if os.path.exists(data_path) else {}
    take = json.loads(read(os.path.join(SRC, "take.json")))
    parts.append(script("window.PICK_DATA = " + json.dumps(data, separators=(",", ":")) + ";\nwindow.PICK_TAKE = " + json.dumps(take, ensure_ascii=False) + ";", "screenshots, names and my picks"))
    parts.append(script(read(os.path.join(SRC, "page.js")), "the page"))
    out = os.path.join(ROOT, "tools", "style-picks-r4.html")
    html = page.replace("<!--SCRIPTS-->", "\n".join(parts))
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"style-picks-r4.html: {len(html.encode('utf-8')) / 1024:.0f} KB, {len(data.get('shots', {}))} screenshots")


if __name__ == "__main__":
    main()
