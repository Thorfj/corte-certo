# Deixa as páginas exatamente em 96 x 54 mm (gabarito da Printi) e marca o corte (TrimBox) e a sangria (BleedBox).
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
MM = 72 / 25.4
# uso: python3 ajusta.py arquivo.pdf [largura_mm altura_mm sangria_mm]  (padrão: 96 54 3)
arq = sys.argv[1]
lw, lh, ls = (float(x) for x in (sys.argv[2:5] if len(sys.argv) >= 5 else (96, 54, 3)))
W, H, SANGRIA = lw * MM, lh * MM, ls * MM
r = PdfReader(arq); w = PdfWriter()
for pg in r.pages:
    mw, mh = float(pg.mediabox.width), float(pg.mediabox.height)
    # centraliza: corta o excesso igualmente dos dois lados (só sai da sangria)
    x0, y0 = (mw - W) / 2, (mh - H) / 2
    caixa = RectangleObject([x0, y0, x0 + W, y0 + H])
    pg.mediabox = caixa; pg.cropbox = caixa; pg.bleedbox = caixa
    pg.trimbox = RectangleObject([x0 + SANGRIA, y0 + SANGRIA, x0 + W - SANGRIA, y0 + H - SANGRIA])
    w.add_page(pg)
w.write(arq)
