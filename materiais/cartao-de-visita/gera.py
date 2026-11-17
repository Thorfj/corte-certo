import segno, io
URL = 'https://barbozap.com.br/teste-gratis/?utm_source=cartao&utm_medium=impresso'
qr = segno.make(URL, error='m')
buf = io.BytesIO()
qr.save(buf, kind='svg', scale=1, border=0, dark='#0f1a17', light=None, xmldecl=False, svgns=True, omitsize=True)
svg = buf.getvalue().decode()
print('versao', qr.version, 'modulos', qr.symbol_size(border=0))

FRENTE = '''
<div class="card frente">
  <div class="circulo c1"></div><div class="circulo c2"></div>
  <div class="conteudo">
    <div class="marca"><span class="badge">BZ</span><span class="nome">Barbozap</span></div>
    <p class="titulo">Sua barbearia agenda sozinha no WhatsApp.</p>
    <p class="sub">Atende, marca o horário e lembra o cliente, 24&nbsp;horas por dia.</p>
  </div>
</div>'''

VERSO = '''
<div class="card verso">
  <div class="conteudo">
    <div class="texto">
      <p class="tag">Teste grátis por 14 dias</p>
      <p class="oferta">Sem cartão.<br>Configura em 5 minutos.</p>
      <p class="preco">R$ 67/mês · barbeiros ilimitados</p>
      <div class="contato">
        <p><b>Thor</b> · Barbozap</p>
        <p>WhatsApp (41) 3795-2535</p>
        <p>barbozap.com.br · @barbo_zap_</p>
      </div>
    </div>
    <div class="qr">
      <div class="qr-box">QRSVG</div>
      <p>Aponte a câmera<br>e teste grátis</p>
    </div>
  </div>
</div>'''.replace('QRSVG', svg)

CSS = open('fontes/faces.css').read() + '''
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --verde: #0f8a4f; --verde-esc: #0a5f37; --verde-claro: #e8f6ee; --tinta: #0f1a17; --cinza: #5d6b66; }
body { font-family: "InterTTF", sans-serif; color: var(--tinta); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.card { position: relative; width: 90mm; height: 50mm; overflow: hidden; }
.sangria .card { width: 96mm; height: 56mm; }
.sangria .card .conteudo { position: absolute; inset: 3mm; }
.card .conteudo { position: absolute; inset: 0; }

/* frente */
.frente { background: var(--verde); color: #fff; }
.frente .circulo { position: absolute; border-radius: 50%; background: rgba(255,255,255,.07); }
.frente .c1 { width: 62mm; height: 62mm; right: -18mm; top: -22mm; }
.frente .c2 { width: 40mm; height: 40mm; right: 6mm; bottom: -24mm; background: rgba(0,0,0,.08); }
.frente .conteudo { padding: 6.5mm 7mm; display: flex; flex-direction: column; justify-content: space-between; }
.sangria .frente .conteudo { padding: 6.5mm 7mm; }
.marca { display: flex; align-items: center; gap: 2.4mm; }
.badge { width: 9mm; height: 9mm; border-radius: 2.6mm; background: #fff; color: var(--verde); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 3.6mm; letter-spacing: .1mm; }
.nome { font-weight: 700; font-size: 4.6mm; letter-spacing: -.1mm; }
.titulo { font-weight: 700; font-size: 5.4mm; line-height: 1.12; letter-spacing: -.15mm; max-width: 62mm; }
.sub { font-size: 2.6mm; line-height: 1.35; opacity: .88; max-width: 62mm; margin-top: 1.6mm; }

/* verso */
.verso { background: #fff; }
.verso .conteudo { padding: 5.5mm 6mm; display: flex; gap: 5mm; align-items: center; }
.verso .texto { flex: 1; min-width: 0; }
.tag { display: inline-block; background: var(--verde-claro); color: var(--verde-esc); font-weight: 700; font-size: 2.3mm; letter-spacing: .25mm; text-transform: uppercase; padding: .9mm 2mm; border-radius: 10mm; }
.oferta { font-weight: 700; font-size: 3.9mm; line-height: 1.2; margin-top: 2.2mm; letter-spacing: -.05mm; }
.preco { font-size: 2.45mm; color: var(--verde-esc); font-weight: 600; margin-top: 1.4mm; }
.contato { margin-top: 3mm; padding-top: 2.2mm; border-top: .25mm solid #e6ebe8; font-size: 2.35mm; line-height: 1.5; color: var(--cinza); }
.contato b { color: var(--tinta); }
.qr { width: 27mm; text-align: center; flex-shrink: 0; }
.qr-box { width: 27mm; height: 27mm; padding: 1.8mm; border: .35mm solid var(--verde); border-radius: 2.4mm; background: #fff; }
.qr-box svg { width: 100%; height: 100%; display: block; }
.qr p { font-size: 2.1mm; line-height: 1.3; color: var(--cinza); margin-top: 1.4mm; font-weight: 500; }
'''

def doc(body, page_css):
    return f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>{CSS}{page_css}</style></head><body>{body}</body></html>'

# 1) arquivo para gráfica: 2 páginas de 96 x 56 mm (3 mm de sangria em volta)
grafica = doc(f'<div class="sangria pg">{FRENTE}</div><div class="sangria pg">{VERSO}</div>',
  '@page { size: 96mm 56mm; margin: 0; } .pg { page-break-after: always; }')
open('grafica.html','w').write(grafica)

# 2) folha A4 para imprimir em casa: 10 cartões, frente e verso (verso espelhado para duplex na borda longa), com marcas de corte
def folha(card, espelhar):
    cel = []
    for linha in range(5):
        for col in range(2):
            c = 1 - col if espelhar else col
            x = 15 + c * 90; y = 23.5 + linha * 50
            cel.append(f'<div class="cel" style="left:{x}mm;top:{y}mm">{card}</div>')
    marcas = []
    for x in (15, 105, 195):
        for y0, y1 in ((13.5, 21.5), (275.5, 283.5)):
            marcas.append(f'<div class="mv" style="left:{x}mm;top:{y0}mm;height:{y1-y0}mm"></div>')
    for y in [23.5 + i*50 for i in range(6)]:
        for x0, x1 in ((5, 13), (197, 205)):
            marcas.append(f'<div class="mh" style="top:{y}mm;left:{x0}mm;width:{x1-x0}mm"></div>')
    return '<div class="a4">' + ''.join(cel) + ''.join(marcas) + '</div>'
a4 = doc(folha(FRENTE, False) + folha(VERSO, True),
  '''@page { size: A4; margin: 0; }
  .a4 { position: relative; width: 210mm; height: 297mm; page-break-after: always; }
  .cel { position: absolute; width: 90mm; height: 50mm; }
  .mv { position: absolute; width: 0; border-left: .2mm solid #999; }
  .mh { position: absolute; height: 0; border-top: .2mm solid #999; }''')
open('a4.html','w').write(a4)

# 3) prévia (frente e verso lado a lado, sem sangria)
prev = doc(f'<div class="prev">{FRENTE}{VERSO}</div>', 'body{background:#eef1ef} .prev{display:flex;gap:8mm;padding:8mm} .card{box-shadow:0 2mm 6mm rgba(0,0,0,.15);border-radius:1.5mm}')
open('previa.html','w').write(prev)
