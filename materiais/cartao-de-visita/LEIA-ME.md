# Cartão de visita Barbozap

- `cartao-barbozap-grafica.pdf`: para a gráfica. 2 páginas (frente e verso) de 96 x 56 mm,
  que é o cartão de 90 x 50 mm com 3 mm de sangria em volta. Fontes embutidas.
- `cartao-barbozap-a4.pdf`: para imprimir em casa. Folha A4 com 10 cartões, com marcas de corte.
  Página 1 = frentes, página 2 = versos (já espelhados para frente e verso virando pela borda longa).
- `cartao-barbozap-previa.png`: prévia da frente e do verso.

O QR Code abre `https://barbozap.com.br/teste-gratis/?utm_source=cartao&utm_medium=impresso`.

## Para mudar o texto e gerar de novo

1. `pip install segno` e baixe a Inter em TTF para `fontes/` com um `fontes/faces.css`
   (família "InterTTF", pesos 400 a 800). A Inter em TTF faz o PDF sair com fonte embutida
   em formato aceito pelas gráficas.
2. Edite os textos em `gera.py` e rode `python3 gera.py` e depois `node render.js`
   (precisa do Playwright).
