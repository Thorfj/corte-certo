# Deixa as páginas exatamente em 96 x 54 mm (gabarito da Printi) e marca o corte (TrimBox) e a sangria (BleedBox).
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
MM = 72 / 25.4
W, H, SANGRIA = 96 * MM, 54 * MM, 3 * MM
arq = sys.argv[1]
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
