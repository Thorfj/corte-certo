---
name: instagram-carousel
description: |
  Cria carrosséis do Instagram do Barbozap (@barbo_zap_) em PNG 1080x1080px, empacotados em ZIP. Use SEMPRE que pedirem carrossel, slides pro Instagram, post em imagem ou conteúdo visual em lote para exportar como PNG. Também cobre PDFs ricos com marca d'água (guias, checklists, ebooks para barbearia). Pipeline: HTML/CSS por slide → Playwright → PNG 1080x1080 → ZIP.
---

# Skill: Carrossel do Instagram + PDF rico — Barbozap

Pipeline para criar carrosséis do Instagram (PNG 1080×1080 em ZIP) e PDFs de
conteúdo rico com a identidade visual do Barbozap.

O pedido do usuário (tema, número de slides, palavra-chave do CTA) vem nos
argumentos. Se vier vazio ou como "ideias", proponha 5 temas de carrossel
(título + ângulo em uma linha + palavra-chave de CTA) e espere a escolha.

---

## 1. QUEM É O BARBOZAP (leia antes de escrever)

O Barbozap (barbozap.com.br) é um sistema que **agenda clientes de barbearia
sozinho pelo WhatsApp**. Quem lê os carrosséis é **dono ou profissional de
barbearia**: gente prática, sem tempo, que rola o feed entre um corte e outro.

Cada carrossel resolve uma dor real da barbearia (faltas, horário vazio,
cliente que some, tempo perdido respondendo "tem horário?") e só no final
mostra que o Barbozap automatiza aquilo.

### Fatos do produto (só use estes, ou o que confirmar no código)

- Agendamento automático no WhatsApp: pergunta o nome, o cliente escolhe o
  serviço, o profissional e o dia/horário (só aparecem horários livres),
  recebe o resumo e confirma.
- Lembretes automáticos: um dia antes e uma hora antes.
- NPS de 1 a 5 depois do atendimento; follow-ups personalizados (quantidade configurável).
- Painel: Atendimentos, Agenda (de todos os profissionais), Contatos
  (histórico, NPS médio, status) e Relatórios (faturamento, atendimentos, clientes, NPS).
- Landing page da barbearia num link só (`barbozap.com.br/b/sua-barbearia`),
  com serviços, preços, horários e botão "Agendar horário".
- Plano único: **R$67/mês**, atendimentos, agenda e funcionários ilimitados.
  **Teste de 14 dias grátis, sem cartão** (`barbozap.com.br/teste-gratis`).

**Nunca invente funcionalidade, preço, depoimento ou estatística.** Se o tema
citar uma função, confira em `index.html`, `app/` ou `app/ajuda/` que ela existe.
Números só se forem contas mostradas no próprio slide ("30 mensagens/dia × 2 min
= 1 hora perdida"), nunca "estudos mostram" sem fonte.

### Tom

- Português do Brasil, conversado: "você", "pra", frases curtas.
- Nada de corporativês ("alavancar", "otimizar processos", "soluções").
- Exemplos do dia a dia: sexta à tarde lotada, cliente que marca e não vem,
  barbeiro parado esperando, celular apitando no meio do corte.
- Pouco texto por slide: o slide tem que ser lido em 3 segundos no celular.
- Use vírgula ou hífen simples no lugar de travessão (—) nos textos dos slides.

---

## 2. IDENTIDADE VISUAL

Tudo abaixo vem de `assets/css/global.css` e do site. Se o CSS mudar, ele manda.

```
Handle:    @barbo_zap_
Marca:     Barbozap  (logo: selo "BZ" verde arredondado + palavra "Barbozap")
Site:      barbozap.com.br
Nicho:     Agendamento e atendimento de barbearia no WhatsApp
CTA DMs:   Palavra-chave em caixa alta (AGENDA, LEMBRETE, TESTE, CHECKLIST, PDF...)
CTA site:  "Teste 14 dias grátis, sem cartão" → barbozap.com.br/teste-gratis
```

### Paletas

**Clara (padrão, igual ao site):**
```css
--bg: #ffffff;          /* --cream */
--bg-2: #f4f7f5;        /* --cream-2 / painéis e cards */
--ink: #0f1a17;         /* texto principal */
--muted: #5d6b66;       /* texto de apoio */
--line: #e6ebe8;        /* divisórias */
--green: #0f8a4f;       /* destaque principal */
--green-dark: #0a6b3c;
--green-soft: #e8f6ee;  /* fundo de destaque suave */
--whatsapp: #25d366;    /* só em detalhes: gradiente, bolha, ícone */
--brick: #b3261e;       /* "erro", "antes", o que NÃO fazer */
```

**Escura (capas e CTA para variar o feed):**
```css
--bg: #0a1f18;          /* verde quase preto */
--bg-2: #10332a;
--ink: #f4f7f5;
--muted: #9fb3ab;       /* nunca mais escuro que isso no fundo escuro */
--green: #25d366;       /* no escuro o destaque é o verde WhatsApp */
--line: rgba(255,255,255,.08);
```

**Verde do logo** (selo BZ e fundos de marca): `#17493c`.

**Gradiente de destaque** (palavra-chave do título, como no hero do site):
```css
.hl {
  background: linear-gradient(90deg, #0f8a4f, #25d366);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
```

### Fontes (as mesmas do site, 3 famílias)

| Papel | Fonte | Uso |
|-------|-------|-----|
| Display/Editorial | Fraunces (500/600, itálico para ênfase) | Títulos, números grandes, palavra em destaque |
| Corpo | Inter (400–700) | Texto corrido, listas, cards, títulos curtos em 700 |
| Técnico | JetBrains Mono (400/500) | Handle, eyebrow, rótulos, numeração, rodapé |

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Não traga fontes de fora da marca (Bebas Neue, Playfair, Space Mono etc.).

### Elementos visuais recorrentes

**Logo BZ (HTML, sem precisar de imagem):**
```html
<div class="brand"><span class="badge">BZ</span> Barbozap</div>
```
```css
.brand { display:flex; align-items:center; gap:8px; font:700 15px Inter; color:var(--ink); }
.badge { width:26px; height:26px; border-radius:8px; background:#17493c; color:#fff;
         display:grid; place-items:center; font:700 11px Inter; letter-spacing:.02em; }
```

**Eyebrow (rótulo acima do título):**
```css
.eyebrow { font:500 11px 'JetBrains Mono'; letter-spacing:.12em; text-transform:uppercase; color:var(--green); }
```

**Luz verde (como atrás do celular no site):**
```css
.glow {
  position:absolute; width:380px; height:380px; top:-120px; right:-140px;
  background: radial-gradient(circle at 60% 40%, rgba(37,211,102,.28), rgba(15,138,79,.10) 45%, transparent 70%);
  filter: blur(10px); pointer-events:none; z-index:0;
}
```

**Card (sem borda, só sombra suave, raio 20px como no site):**
```css
.card { background:#fff; border-radius:20px;
        box-shadow: 0 1px 2px rgba(15,26,23,.04), 0 16px 36px -18px rgba(15,26,23,.18); }
```

**Bolha de WhatsApp** (para mostrar a conversa do bot; cores clássicas do WhatsApp):
```css
.chat { background:#efe8d9; border-radius:14px; padding:12px; }
.msg-in  { background:#fff;    border-radius:10px 10px 10px 2px; }
.msg-out { background:#d9fdd3; border-radius:10px 10px 2px 10px; margin-left:auto; }
.msg-in, .msg-out { max-width:78%; padding:7px 10px; font:400 12px/1.35 Inter; color:#24211d; margin-bottom:6px; }
```
As mensagens têm que refletir o fluxo real do bot (seção 1), sem prometer o que ele não faz.

---

## 3. STACK TÉCNICA

```
HTML/CSS por slide → Playwright (render) → Pillow (resize) → ZIP
```

Neste ambiente o Chromium já vem instalado em `/opt/pw-browsers/chromium`:
**não rode `playwright install`**. Se o módulo Python faltar, rode só
`pip install playwright pillow` e lance o navegador apontando para ele:
`p.chromium.launch(executable_path='/opt/pw-browsers/chromium')`.
(Fora deste ambiente: `playwright install chromium` e `launch()` sem argumentos.)

### Onde salvar

Este repositório é o site publicado (GitHub Pages). **Não salve PNG/ZIP
dentro do repo nem commite os slides.** Use a pasta de rascunho da sessão
(scratchpad) ou outra pasta fora do site, e entregue o ZIP ao usuário.

---

## 4. REGRA CRÍTICA — RENDERIZAÇÃO

**NUNCA use um único HTML com JS de navegação para vários slides.** O Playwright
captura o estado atual da página, e todos os frames saem iguais ao último.

**SEMPRE um HTML standalone por slide:**

```python
from playwright.sync_api import sync_playwright
from PIL import Image
import os, zipfile

OUT = os.path.join(SCRATCH, 'carrossel-<slug>')   # SCRATCH = pasta de rascunho da sessão
os.makedirs(OUT, exist_ok=True)

SLIDES = [(html_01, 'slide_01.png'), (html_02, 'slide_02.png')]  # ...

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    # 540×540 CSS × device_scale_factor=2 = 1080×1080 exatos, sem resize
    page = browser.new_page(viewport={'width': 540, 'height': 540}, device_scale_factor=2)
    for html, fname in SLIDES:
        page.set_content(html, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUT}/{fname}')
    browser.close()

# Garantia de tamanho final 1080×1080
for fname in os.listdir(OUT):
    if fname.endswith('.png'):
        path = f'{OUT}/{fname}'
        img = Image.open(path)
        if img.size != (1080, 1080):
            img = img.resize((1080, 1080), Image.LANCZOS)
        img.save(path, 'PNG', optimize=True)

zip_path = f'{OUT}.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for fname in sorted(os.listdir(OUT)):
        if fname.endswith('.png'):
            zf.write(f'{OUT}/{fname}', fname)
```

Se a rede bloquear o Google Fonts, avise o usuário: o slide cai em fonte de
sistema e fica fora da marca. Não entregue assim sem combinar.

---

## 5. TEMPLATE DE SLIDE HTML

```html
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root { --bg:#ffffff; --bg-2:#f4f7f5; --ink:#0f1a17; --muted:#5d6b66; --line:#e6ebe8;
        --green:#0f8a4f; --green-soft:#e8f6ee; --whatsapp:#25d366; --brick:#b3261e; }
* { box-sizing:border-box; margin:0; padding:0; }
body { width:540px; height:540px; overflow:hidden; background:var(--bg);
       color:var(--ink); font-family:Inter, sans-serif; -webkit-font-smoothing:antialiased; }
.wrap { position:relative; width:540px; height:540px; overflow:hidden;
        display:flex; flex-direction:column; justify-content:space-between;
        padding:34px 36px; }
.top, .foot { display:flex; justify-content:space-between; align-items:center; position:relative; z-index:2; }
.handle, .num { font:500 11px 'JetBrains Mono'; color:var(--muted); letter-spacing:.04em; }
h1 { font-family:Fraunces, serif; font-weight:600; font-size:44px; line-height:1.04; letter-spacing:-.01em; }
h1 em { font-style:italic; color:var(--green); }
p  { font-size:16px; line-height:1.45; color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><!-- brand + handle --></div>
  <main><!-- conteúdo --></main>
  <div class="foot"><span class="handle">@barbo_zap_</span><span class="num">02/07</span></div>
</div>
</body></html>
```

**Fixos:** `body` e `.wrap` com 540×540 e `overflow:hidden`; padding mínimo 32px.

---

## 6. ESTRUTURA PADRÃO DO CARROSSEL (6 a 8 slides)

### Slide 01 — CAPA
- Brand BZ no topo esquerdo, `@barbo_zap_` no topo direito.
- Eyebrow com o tema (ex.: `AGENDA · FALTAS`).
- Título grande em Fraunces com a palavra-chave em itálico verde ou no gradiente
  (ex.: "Cliente que *não aparece* custa mais do que você pensa").
- Uma linha de apoio em Inter.
- Rodapé: "Arrasta pro lado →" e "Salva esse post".
- Variar entre capa clara e escura para o feed não ficar repetitivo.

**Foto de fundo (se o usuário mandar uma):**
- Injete como `<img>` com `src` base64 JPEG (não use data URI em CSS `background`).
- Overlay de gradiente em `<div>` absoluto (ex.: `linear-gradient(180deg, rgba(10,31,24,.1), rgba(10,31,24,.85))`).
- Deixe o rosto/corte livre, texto na parte de baixo.
- Só fotos com direito de uso (do próprio usuário ou Unsplash com licença livre).

```python
import base64, io
from PIL import Image
photo = Image.open('/caminho/foto.jpg').convert('RGB')
w, h = photo.size
buf = io.BytesIO()
photo.resize((1080, int(1080 * h / w)), Image.LANCZOS).save(buf, 'JPEG', quality=86)
b64 = base64.b64encode(buf.getvalue()).decode()
# <img src="data:image/jpeg;base64,{b64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
```

### Slides 02 a N-1 — CONTEÚDO
- Topo: eyebrow ou número grande do passo (Fraunces) + título curto.
- Linha fina `var(--line)` separando.
- Um bloco por slide: lista curta (até 4 itens), card, "antes × depois"
  (antes em `--brick`, depois em `--green`), conta simples, ou conversa de WhatsApp.
- Rodapé: `@barbo_zap_` à esquerda, numeração `02/07` à direita.
- O penúltimo slide pode ligar a dor à função real do Barbozap.

### Slide N — CTA FINAL
- Pergunta direta ("Quantos clientes faltaram essa semana?").
- Caixa com a palavra-chave em destaque (Fraunces grande, verde).
- Sub-texto dizendo o que a pessoa recebe.
- Linha secundária: "Ou teste 14 dias grátis, sem cartão · barbozap.com.br".

```html
<div class="cta-box">
  <span class="label">COMENTA AQUI</span>
  <span class="keyword">AGENDA</span>
  <span class="sub">que eu te mando o passo a passo no direct</span>
</div>
```
```css
.cta-box { background:var(--green-soft); border-radius:20px; padding:22px 24px; display:flex; flex-direction:column; gap:4px; }
.cta-box .label { font:500 11px 'JetBrains Mono'; letter-spacing:.12em; color:var(--green); }
.cta-box .keyword { font:600 64px/1 Fraunces; color:var(--green); }
.cta-box .sub { font:500 15px Inter; color:var(--ink); }
```

Combine com o usuário o que é entregue no direct para cada palavra-chave
(link, PDF, vídeo) antes de usar uma palavra nova.

---

## 7. CONTRASTE E LEGIBILIDADE

| Situação | Cor mínima |
|----------|------------|
| Corpo em fundo claro | `#5d6b66` (`--muted`) ou mais escuro |
| Rodapé/handle em fundo claro | `#5d6b66`, nunca mais claro que `#8a9690` |
| Corpo em fundo escuro | `#c9d6d0` ou mais claro |
| Texto apagado em fundo escuro | `#9fb3ab`, nunca mais escuro |
| Verde sobre branco | `#0f8a4f` (o `#25d366` em texto sobre branco fica ilegível: use só em detalhes) |

Texto mínimo de 13px CSS (26px no PNG final). Título legível como miniatura do feed.

---

## 8. PDF RICO COM REPORTLAB

Para materiais extensos (guia, checklist, ebook para barbearia) entregues no direct:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, HRFlowable, PageBreak, KeepTogether, Spacer
from reportlab.lib.styles import ParagraphStyle
```

Para usar Inter/Fraunces no PDF, baixe os TTF (Google Fonts) e registre com
`pdfmetrics.registerFont(TTFont(...))`; sem isso, use Helvetica.

**Estrutura de cada dica (4 camadas):**
```
[NUM] TÍTULO
Descrição curta

[NA PRÁTICA]   box cinza-verde (#f4f7f5) com o passo a passo na barbearia
[MENSAGEM]     box verde-claro (#e8f6ee) com o texto pronto pra mandar no WhatsApp
[✦ DICA PRO]   box branco com borda verde (#0f8a4f) com o atalho avançado
```

**Página com marca d'água + header/footer:**
```python
def build_page(c, doc):
    w, h = A4
    c.setFillColor(colors.HexColor('#ffffff')); c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#0f8a4f')); c.rect(0, h - 5*mm, w, 5*mm, fill=1, stroke=0)   # barra verde topo
    c.setFillColor(colors.HexColor('#17493c')); c.rect(0, 0, w, 9*mm, fill=1, stroke=0)          # barra verde-logo base
    c.saveState()                                                                                  # marca d'água
    c.setFont('Helvetica-Bold', 48); c.setFillColor(colors.HexColor('#0f1a17')); c.setFillAlpha(0.035)
    c.translate(w/2, h/2); c.rotate(35); c.drawCentredString(0, 0, '@barbo_zap_')
    c.restoreState()
    c.setFillColor(colors.HexColor('#ffffff')); c.setFont('Helvetica', 7)
    c.drawString(18*mm, 3.2*mm, '@barbo_zap_ · barbozap.com.br')
    c.drawRightString(w - 18*mm, 3.2*mm, f'Página {doc.page}')
```

Última página do PDF: CTA para o teste grátis de 14 dias.

---

## 9. FLUXO COMPLETO

1. Ler o pedido; se faltar tema, propor 5 ideias.
2. Conferir fatos do produto no código se o tema citar alguma função.
3. Definir roteiro: N slides, título e texto de cada um, palavra-chave do CTA.
   Mostrar o roteiro ao usuário antes de renderizar, se ele não pediu direto.
4. Criar um HTML standalone por slide.
5. Renderizar em 540×540 com `device_scale_factor=1` e **olhar cada PNG** (Read na imagem).
6. Corrigir o que estiver cortado, apertado ou ilegível.
7. Render final com `device_scale_factor=2` (1080×1080).
8. Gerar o ZIP.
9. Entregar ao usuário (SendUserFile) o ZIP + a capa como prévia, e a legenda
   sugerida para o post (2–4 linhas, CTA da palavra-chave, 3–5 hashtags de barbearia).

---

## 10. CHECKLIST DE QUALIDADE

- [ ] Nenhuma funcionalidade, preço ou estatística inventada.
- [ ] Ortografia e acentuação revisadas.
- [ ] Nada cortado nas bordas (padding ≥ 32px) nem saindo do frame.
- [ ] Contraste conforme a tabela da seção 7.
- [ ] Fontes da marca carregaram (Fraunces/Inter/JetBrains Mono, não fonte de sistema).
- [ ] `@barbo_zap_` no rodapé de todos os slides (exceto onde já está no topo da capa).
- [ ] Numeração certa (01/N, 02/N...).
- [ ] CTA final com palavra-chave clara + menção ao teste grátis.
- [ ] Todos os PNG com 1080×1080 e o ZIP abre com todos os slides em ordem.
- [ ] Nenhum PNG/ZIP salvo ou commitado dentro do repositório.

---

## 11. ERROS COMUNS E SOLUÇÕES

| Erro | Causa | Solução |
|------|-------|---------|
| Todos os slides iguais ao último | JS de navegação num HTML só | Um HTML standalone por slide |
| Foto não aparece | data URI no CSS `background` | `<img>` com `src` base64 |
| Fonte de sistema no lugar da Fraunces | Fonte não carregou a tempo | `wait_until='networkidle'` + `document.fonts.ready` |
| Imagem borrada | Viewport pequeno ampliado | 540×540 × `device_scale_factor=2`, sem upscale |
| Texto cortado | Conteúdo maior que o frame | `overflow:hidden` + reduzir texto, não a fonte abaixo de 13px |
| Verde ilegível | `#25d366` como cor de texto no branco | Texto em `#0f8a4f`; `#25d366` só em detalhe ou fundo escuro |
| Espaço vazio embaixo | Layout sem distribuição | `justify-content:space-between` no `.wrap` ou `flex:1` no miolo |
| ZIP vazio | Pasta errada | `os.makedirs(OUT, exist_ok=True)` e conferir o caminho |
