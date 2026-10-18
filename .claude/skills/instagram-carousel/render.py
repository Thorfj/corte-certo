"""Renderiza slide_XX.html de uma pasta em PNG 1080x1080 e gera o ZIP.

Uso: python3 render.py <pasta_html> <pasta_saida>
"""
import os
import pathlib
import sys
import zipfile

from playwright.sync_api import sync_playwright

src = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)

slides = sorted(src.glob("slide_*.html"))
if not slides:
    sys.exit(f"nenhum slide_*.html em {src}")

with sync_playwright() as p:
    # Chromium da imagem; evita depender da versão baixada pelo pacote
    exe = "/opt/pw-browsers/chromium"
    browser = p.chromium.launch(executable_path=exe if os.path.exists(exe) else None)
    page = browser.new_page(viewport={"width": 540, "height": 540}, device_scale_factor=2)
    for html in slides:
        page.goto(html.as_uri())
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(800)
        page.screenshot(path=str(out / f"{html.stem}.png"))
        print("ok", html.stem)
    browser.close()

zip_path = out.with_suffix(".zip")
with zipfile.ZipFile(zip_path, "w") as zf:
    for png in sorted(out.glob("slide_*.png")):
        zf.write(png, png.name)
print("zip", zip_path)
