# Cartão de visita Barbozap

Formato da Printi: **9 x 4,8 cm, cantos arredondados, frente e verso, paisagem**. No envio, a Printi pede o PDF em **9 x 5 cm**.

- `cartao-barbozap-printi-9x5cm.pdf`: arquivo para enviar à Printi. 2 páginas (frente e verso) de exatamente
  90 x 50 mm. Fundo verde até a borda; logo, textos e QR a 6 mm ou mais das bordas (cabem no corte de 4,8 cm
  e longe dos cantos arredondados). Fontes embutidas.
- `cartao-barbozap-conferencia-gabarito.png`: a arte com as linhas-guia do gabarito da Printi por cima
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
   e por fim `python3 ajusta.py cartao-barbozap-printi-9x5cm.pdf 90 50 0` (deixa a página com a medida exata).
