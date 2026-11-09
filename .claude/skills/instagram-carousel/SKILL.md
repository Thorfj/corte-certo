---
name: instagram-carousel
description: |
  Cria carrosséis do Instagram do Barbozap (@barbo_zap_) em PNG 1080x1080px, empacotados em ZIP. Use SEMPRE que pedirem carrossel, slides pro Instagram, post em imagem ou conteúdo visual em lote para exportar como PNG. Também cobre PDFs ricos com marca d'água (guias, checklists, ebooks para barbearia). Pipeline: HTML/CSS por slide → Playwright → PNG 1080x1080 → ZIP.
---

# Skill: Carrossel do Instagram + PDF rico — Barbozap

O pedido (tema, nº de slides, palavra-chave do CTA) vem nos argumentos. Se vier
vazio ou "ideias", proponha 5 temas (título + ângulo + palavra-chave) e espere a escolha.

## 1. QUEM É O BARBOZAP

O Barbozap (barbozap.com.br) **agenda clientes de barbearia sozinho pelo
WhatsApp**. Quem lê é **dono ou profissional de barbearia**: gente prática, que
rola o feed entre um corte e outro. Cada carrossel resolve uma dor real (faltas,
horário vazio, cliente que some, tempo perdido respondendo "tem horário?") e só
no final mostra que o Barbozap automatiza aquilo.

### Fatos do produto (só use estes, ou o que confirmar no código)

- Agendamento no WhatsApp: pergunta o nome, o cliente escolhe serviço,
  profissional e dia/horário (só horários livres), recebe o resumo e confirma.
- Lembretes automáticos: um dia antes e uma hora antes.
- NPS de 1 a 5 após o atendimento; follow-ups personalizados.
- Painel: Atendimentos, Agenda (todos os profissionais), Contatos (histórico,
  NPS médio, status) e Relatórios (faturamento, atendimentos, clientes, NPS).
- Página da barbearia num link só (`barbozap.com.br/b/sua-barbearia`) com
  serviços, preços, horários e botão "Agendar horário".
- Plano único **R$67/mês**, tudo ilimitado. **Teste 14 dias grátis, sem cartão**
  (`barbozap.com.br/teste-gratis`).

**Nunca invente funcionalidade, preço, depoimento ou estatística.** Se o tema
citar uma função, confira em `index.html`, `app/` ou `app/ajuda/`. Números só se
forem contas mostradas no slide ("30 msgs/dia × 2 min = 1 hora perdida").

### Tom

- Português do Brasil conversado: "você", "pra", frases curtas. Nada de
  corporativês ("alavancar", "otimizar processos", "soluções").
- Dia a dia real: sexta lotada, cliente que não vem, celular apitando no meio do corte.
- Pouco texto: cada slide lido em 3 segundos no celular.
- Vírgula ou hífen simples no lugar de travessão (—) nos slides.

## 2. IDENTIDADE VISUAL

Vem de `assets/css/global.css`; se o CSS mudar, ele manda.

```
Handle:   @barbo_zap_          Site: barbozap.com.br
Logo:     selo "BZ" verde (#17493c) arredondado + palavra "Barbozap"
CTA DMs:  palavra-chave em caixa alta (AGENDA, LEMBRETE, TESTE, CHECKLIST, PDF...)
CTA site: "Teste 14 dias grátis, sem cartão" → barbozap.com.br/teste-gratis
```

**Paleta clara (padrão, igual ao site):** fundo `#ffffff`, painel `#f4f7f5`,
texto `#0f1a17`, apoio `#5d6b66`, linha `#e6ebe8`, verde `#0f8a4f`, verde
escuro `#0a6b3c`, verde suave `#e8f6ee`, WhatsApp `#25d366` (só detalhes),
tijolo `#b3261e` (erro, "antes", o que não fazer).

**Paleta escura (capas e CTA, para variar o feed):** fundo `#0a1f18`, painel
`#10332a`, texto `#f4f7f5`, apoio `#9fb3ab`, destaque `#25d366`, linha `rgba(255,255,255,.08)`.

**Gradiente de destaque** (como no hero do site):
`background:linear-gradient(90deg,#0f8a4f,#25d366); -webkit-background-clip:text; background-clip:text; color:transparent;`

### Fontes (as do site; não use outras)

| Papel | Fonte | Uso |
|-------|-------|-----|
| Display | Fraunces 500/600, itálico p/ ênfase | Títulos, números grandes |
| Corpo | Inter 400–700 | Texto, listas, cards |
| Técnico | JetBrains Mono 400/500 | Handle, eyebrow, rótulos, numeração |

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Elementos recorrentes

```css
/* logo: <div class="brand"><span class="badge">BZ</span> Barbozap</div> */
.brand { display:flex; align-items:center; gap:8px; font:700 15px Inter; }
.badge { width:26px; height:26px; border-radius:8px; background:#17493c; color:#fff;
         display:grid; place-items:center; font:700 11px Inter; }
.eyebrow { font:500 11px 'JetBrains Mono'; letter-spacing:.12em; text-transform:uppercase; color:var(--green); }
/* luz verde, como atrás do celular no site */
.glow { position:absolute; width:380px; height:380px; top:-120px; right:-140px; filter:blur(10px); z-index:0;
  background:radial-gradient(circle at 60% 40%, rgba(37,211,102,.28), rgba(15,138,79,.10) 45%, transparent 70%); }
/* card: sem borda, sombra suave */
.card { background:#fff; border-radius:20px;
  box-shadow:0 1px 2px rgba(15,26,23,.04), 0 16px 36px -18px rgba(15,26,23,.18); }
/* conversa de WhatsApp (cores clássicas) */
.chat { background:#efe8d9; border-radius:14px; padding:12px; }
.msg-in, .msg-out { max-width:78%; padding:7px 10px; font:400 12px/1.35 Inter; color:#24211d; margin-bottom:6px; }
.msg-in  { background:#fff; border-radius:10px 10px 10px 2px; }
.msg-out { background:#d9fdd3; border-radius:10px 10px 2px 10px; margin-left:auto; }
```
As mensagens do chat seguem o fluxo real do bot (seção 1).

## 3. STACK E ONDE SALVAR

`HTML/CSS por slide → Playwright → Pillow → ZIP`

O Chromium já está em `/opt/pw-browsers/chromium`: **não rode `playwright install`**.
Se faltar o módulo Python: `pip install playwright pillow` e lance com
`executable_path='/opt/pw-browsers/chromium'` (fora deste ambiente: `playwright
install chromium` e `launch()` sem argumentos).

O repositório é o site publicado: **não salve nem commite PNG/ZIP nele.** Use a
pasta de rascunho (scratchpad) da sessão.

## 4. REGRA CRÍTICA — UM HTML POR SLIDE

Nunca um HTML único com JS de navegação: o Playwright captura o estado atual e
todos os frames saem iguais ao último.

```python
from playwright.sync_api import sync_playwright
from PIL import Image
import os, zipfile

OUT = os.path.join(SCRATCH, 'carrossel-<slug>')   # SCRATCH = scratchpad da sessão
os.makedirs(OUT, exist_ok=True)
SLIDES = [(html_01, 'slide_01.png'), (html_02, 'slide_02.png')]  # ...

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    # 540×540 CSS × scale 2 = 1080×1080 exatos
    page = browser.new_page(viewport={'width': 540, 'height': 540}, device_scale_factor=2)
    for html, fname in SLIDES:
        page.set_content(html, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUT}/{fname}')
    browser.close()

pngs = sorted(f for f in os.listdir(OUT) if f.endswith('.png'))
for f in pngs:
    img = Image.open(f'{OUT}/{f}')
    if img.size != (1080, 1080):
        img.resize((1080, 1080), Image.LANCZOS).save(f'{OUT}/{f}', 'PNG', optimize=True)
with zipfile.ZipFile(f'{OUT}.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in pngs:
        zf.write(f'{OUT}/{f}', f)
```

Se a rede bloquear o Google Fonts, avise: o slide cai em fonte de sistema e sai da marca.

## 5. TEMPLATE DE SLIDE

```html
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<!-- link das fontes (seção 2) -->
<style>
:root { --bg:#fff; --bg-2:#f4f7f5; --ink:#0f1a17; --muted:#5d6b66; --line:#e6ebe8;
        --green:#0f8a4f; --green-soft:#e8f6ee; --whatsapp:#25d366; --brick:#b3261e; }
* { box-sizing:border-box; margin:0; padding:0; }
body { width:540px; height:540px; overflow:hidden; background:var(--bg); color:var(--ink);
       font-family:Inter, sans-serif; -webkit-font-smoothing:antialiased; }
.wrap { position:relative; width:540px; height:540px; overflow:hidden; padding:34px 36px;
        display:flex; flex-direction:column; justify-content:space-between; }
.top, .foot { display:flex; justify-content:space-between; align-items:center; position:relative; z-index:2; }
.handle, .num { font:500 11px 'JetBrains Mono'; color:var(--muted); }
h1 { font:600 44px/1.04 Fraunces, serif; letter-spacing:-.01em; }
h1 em { font-style:italic; color:var(--green); }
p  { font-size:16px; line-height:1.45; color:var(--muted); }
</style></head>
<body><div class="wrap">
  <div class="top"><!-- brand + handle --></div>
  <main><!-- conteúdo --></main>
  <div class="foot"><span class="handle">@barbo_zap_</span><span class="num">02/07</span></div>
</div></body></html>
```

## 6. ESTRUTURA (6 a 8 slides)

**01 — Capa:** brand BZ no topo esquerdo, `@barbo_zap_` no direito; eyebrow do
tema (`AGENDA · FALTAS`); título em Fraunces com a palavra-chave em itálico
verde ou gradiente ("Cliente que *não aparece* custa mais do que você pensa");
uma linha de apoio; rodapé "Arrasta pro lado →". Alterne capa clara e escura.

*Foto de fundo (só com direito de uso: do usuário ou Unsplash livre):* use
`<img>` com `src` base64 JPEG (data URI em CSS `background` não renderiza),
`object-fit:cover`, overlay em `<div>` absoluto
(`linear-gradient(180deg, rgba(10,31,24,.1), rgba(10,31,24,.85))`), rosto/corte
livre e texto embaixo. Redimensione para 1080 de largura com Pillow, JPEG q86.

**02 a N-1 — Conteúdo:** número do passo (Fraunces) ou eyebrow + título curto;
linha fina; um bloco por slide: lista (até 4 itens), card, "antes × depois"
(antes em tijolo, depois em verde), conta simples ou conversa de WhatsApp.
Rodapé com handle e `02/07`. O penúltimo pode ligar a dor à função real do Barbozap.

**N — CTA:** pergunta direta ("Quantos clientes faltaram essa semana?"), caixa
com a palavra-chave, o que a pessoa recebe, e embaixo "Ou teste 14 dias grátis,
sem cartão · barbozap.com.br".

```html
<div class="cta-box"><span class="label">COMENTA AQUI</span>
  <span class="keyword">AGENDA</span><span class="sub">que eu te mando o passo a passo no direct</span></div>
```
```css
.cta-box { background:var(--green-soft); border-radius:20px; padding:22px 24px; display:flex; flex-direction:column; gap:4px; }
.cta-box .label { font:500 11px 'JetBrains Mono'; letter-spacing:.12em; color:var(--green); }
.cta-box .keyword { font:600 64px/1 Fraunces; color:var(--green); }
.cta-box .sub { font:500 15px Inter; }
```
Combine com o usuário o que é entregue no direct antes de usar palavra nova.

## 7. CONTRASTE

- Fundo claro: texto de apoio e handle no mínimo `#5d6b66`.
- Fundo escuro: corpo `#c9d6d0` ou mais claro; apagado nunca abaixo de `#9fb3ab`.
- `#25d366` nunca como texto sobre branco: texto verde é `#0f8a4f`.
- Texto mínimo 13px CSS; título legível como miniatura do feed.

## 8. PDF RICO (REPORTLAB)

Para guias, checklists e ebooks entregues no direct. Fontes da marca: baixe os TTF
e registre com `pdfmetrics.registerFont(TTFont(...))`; sem isso, Helvetica.

Cada dica: `[NUM] TÍTULO` + descrição; box `#f4f7f5` **NA PRÁTICA** (passo a
passo na barbearia); box `#e8f6ee` **MENSAGEM** (texto pronto pro WhatsApp);
box branco com borda `#0f8a4f` **✦ DICA PRO**. Última página: CTA do teste grátis.

```python
def build_page(c, doc):
    w, h = A4
    c.setFillColor(colors.HexColor('#0f8a4f')); c.rect(0, h - 5*mm, w, 5*mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#17493c')); c.rect(0, 0, w, 9*mm, fill=1, stroke=0)
    c.saveState()
    c.setFont('Helvetica-Bold', 48); c.setFillColor(colors.HexColor('#0f1a17')); c.setFillAlpha(0.035)
    c.translate(w/2, h/2); c.rotate(35); c.drawCentredString(0, 0, '@barbo_zap_')
    c.restoreState()
    c.setFillColor(colors.white); c.setFont('Helvetica', 7)
    c.drawString(18*mm, 3.2*mm, '@barbo_zap_ · barbozap.com.br')
    c.drawRightString(w - 18*mm, 3.2*mm, f'Página {doc.page}')
```

## 9. FLUXO

1. Ler o pedido; conferir no código qualquer função citada.
2. Roteiro (slides, textos, palavra-chave); mostrar ao usuário se ele não pediu direto.
3. Um HTML por slide; render com `device_scale_factor=1` e **olhar cada PNG** (Read).
4. Corrigir cortes e textos apertados; render final com scale 2; gerar ZIP.
5. Entregar (SendUserFile) o ZIP + capa como prévia, com legenda sugerida
   (2–4 linhas, CTA da palavra-chave, 3–5 hashtags de barbearia).

## 10. CHECKLIST

- [ ] Nada inventado; ortografia e acentos revisados.
- [ ] Nada cortado (padding ≥ 32px); contraste conforme a seção 7.
- [ ] Fontes da marca carregadas (não fonte de sistema).
- [ ] `@barbo_zap_` em todos os slides; numeração 01/N certa.
- [ ] CTA com palavra-chave + teste grátis.
- [ ] PNGs 1080×1080, ZIP completo e em ordem, nada salvo no repo.

## 11. ERROS COMUNS

| Erro | Solução |
|------|---------|
| Slides iguais ao último | Um HTML standalone por slide |
| Foto não aparece | `<img>` com base64, não CSS `background` |
| Fonte de sistema | `wait_until='networkidle'` + `document.fonts.ready` |
| Imagem borrada | 540×540 × scale 2, sem ampliar |
| Texto cortado | Cortar texto, não baixar a fonte de 13px |
| Verde ilegível | Texto `#0f8a4f`; `#25d366` só em detalhe ou fundo escuro |
| Espaço vazio embaixo | `justify-content:space-between` ou `flex:1` no miolo |
