"""Bundle Nightvale into single-file pages.

dist/nightvale.html          - standalone page you can double-click to play
dist/nightvale-artifact.html - the same game as page content for claude.ai Artifacts
                               (no doctype/html/head/body: the Artifact host adds them)
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def main():
    index = read("play.html")
    css = read("css/game.css")
    scripts = re.findall(r'<script src="([^"]+)"></script>', index)
    parts = []
    for src in scripts:
        path = os.path.join(ROOT, src)
        if not os.path.exists(path):
            print("missing (skipped):", src, file=sys.stderr)
            continue
        js = read(src).replace("</script", "<\\/script")
        parts.append(f"<script>/* {src} */\n{js}\n</script>")
    fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
             '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
             '<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap" rel="stylesheet">')
    body = ('<canvas id="game" aria-label="Nightvale game world"></canvas>\n<div id="ui"></div>\n' + "\n".join(parts))
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                  f'<title>Nightvale</title>\n{fonts}\n<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')
    artifact = f'<title>Nightvale</title>\n{fonts}\n<style>\n{css}\n</style>\n{body}\n'
    for name, text in (("nightvale.html", standalone), ("nightvale-artifact.html", artifact)):
        out = os.path.join(ROOT, "dist", name)
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"{name}: {len(text.encode('utf-8')) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
