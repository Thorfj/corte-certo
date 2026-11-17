# Vídeo de onboarding (passo a passo)

`barbozap-passo-a-passo-matriz.mp4` (70 s, vertical 1080 x 1920, com música): passo a passo para a
Barbearia Matriz terminar a configuração, feito com as telas reais do CRM no tamanho de iPhone.

1. Onde você está: WhatsApp conectado e horário conferido.
2. Passo 1 · Serviços: Novo Serviço, preencher nome, preço, duração e recorrência, Salvar.
3. Passo 2 · Google Agenda: Conectar de novo, marcar a caixinha das agendas, Continuar.
4. Passo 3 · Robô ligado: Fluxo ativo verde em Mensagens.
5. Passo 4 · Teste: mandar "Oi" de outro celular e ver o robô responder.

## Para gerar de novo (ou para outra barbearia)

1. `captura.js`: tira as telas do CRM (servidor local na raiz do projeto, porta 8765, Supabase simulado).
   Troque o nome e o e-mail da barbearia no começo do arquivo.
2. `video.html`: a animação (textos, toques e conversa). As fontes vêm de `../cartao-de-visita/fontes/`
   (Inter TTF; ver o LEIA-ME do cartão).
3. `node render.js` gera os quadros; `python3 trilha.py 70` gera a música; depois:
   `ffmpeg -framerate 30 -i frames/%05d.jpg -c:v libx264 -crf 20 -pix_fmt yuv420p sem-musica.mp4`
   e `ffmpeg -i sem-musica.mp4 -i trilha.wav -c:v copy -c:a aac -shortest video.mp4`.
