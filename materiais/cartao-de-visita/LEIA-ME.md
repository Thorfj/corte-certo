# Cartão de visita Barbozap

Formato da Printi: **9 x 4,8 cm, cantos arredondados, frente e verso, paisagem**.

- `cartao-barbozap-printi-9x4-8cm.pdf`: arquivo para enviar à Printi. 2 páginas (frente e verso) de
  96 x 54 mm = 9 x 4,8 cm + 3 mm de sangria em volta, igual ao gabarito deles. Textos dentro da área
  segura (5 mm do corte), fundo verde até a borda da sangria, fontes embutidas e corte marcado (TrimBox).
- `cartao-barbozap-conferencia-gabarito.png`: a arte com as linhas-guia do gabarito por cima
  (vermelho = sangria, preto = corte com cantos arredondados, azul = área segura). Só para conferir; não enviar.
- `cartao-barbozap-a4.pdf`: para imprimir em casa. Folha A4 com 10 cartões de 9 x 4,8 cm e marcas de corte.
  Página 1 = frentes, página 2 = versos (espelhados para imprimir frente e verso virando pela borda longa).
- `cartao-barbozap-previa.png`: prévia com os cantos arredondados.

O QR Code abre `https://barbozap.com.br/teste-gratis/?utm_source=cartao&utm_medium=impresso`.

As cores estão em RGB; a Printi converte para CMYK automaticamente (o verde pode sair levemente diferente da tela).

## Para mudar o texto e gerar de novo

1. `pip install segno pypdf` e baixe a Inter em TTF para `fontes/` com um `fontes/faces.css`
   (família "InterTTF", pesos 400 a 800). A Inter em TTF faz o PDF sair com fonte embutida em formato
   aceito pelas gráficas.
2. Edite os textos em `gera.py`, rode `python3 gera.py`, depois `node render.js` (precisa do Playwright)
   e por fim `python3 ajusta.py cartao-barbozap-printi-9x4-8cm.pdf` (deixa a página com a medida exata).
