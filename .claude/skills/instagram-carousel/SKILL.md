---
name: instagram-carousel
description: |
  Cria carrosséis do Instagram do Barbozap (@barbo_zap_) em PNG 1080x1080, empacotados em ZIP. Use sempre que pedirem carrossel, slides ou post em imagem para o Instagram. Pipeline: um HTML por slide → Playwright → PNG → ZIP.
---

# Carrossel de Instagram do Barbozap

O leitor é **dono ou profissional de barbearia**: gente prática, que vê o post
no celular entre um corte e outro. Cada carrossel resolve um problema real dele
e só no último slide mostra que o Barbozap automatiza aquilo.

## 1. Identidade

```
Handle:  @barbo_zap_
Site:    barbozap.com.br
Logo:    quadrado verde (#17493c, raio 9px) com "BZ" em JetBrains Mono branco + "Barbozap" em Inter 700
CTA:     "Teste 14 dias grátis, sem cartão" → "link na bio" / barbozap.com.br/teste-gratis
```

Tokens (os mesmos de `assets/css/global.css`):

```css
--cream: #f6f1e7;   /* fundo padrão */
--cream-2: #efe8d9; /* cards */
--green: #17493c;   /* destaque principal */
--green-dark: #0e2f27; /* fundo dos slides escuros (capa/CTA) */
--ink: #24211d;     /* texto */
--muted: #726c5f;   /* texto secundário, mínimo permitido no creme */
--brick: #9b3b30;   /* alerta / palavra de dor, usar pouco */
--line: #dcd4c3;    /* bordas e divisórias */
```

Fontes (só estas três):

| Papel | Fonte |
|---|---|
| Títulos, números grandes, palavra em itálico de destaque | Fraunces (500/600, itálico) |
| Texto corrido | Inter (400/500/700) |
| Rótulos, eyebrow, @, numeração 01/N | JetBrains Mono (400/500) |

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Em slide escuro (`#0e2f27`), texto `#f6f1e7` e secundário `#b9cbc4` no mínimo.
Card claro dentro de slide escuro volta a usar `--muted` (o `#b9cbc4` some no creme).

## 2. Conteúdo: fatos do produto (só use estes, ou o que confirmar no código)

- Agendamento automático no WhatsApp: pergunta o nome, o cliente escolhe serviço,
  profissional e dia/horário (só aparecem horários livres), recebe o resumo e confirma.
- Lembretes automáticos: um dia antes e uma hora antes.
- NPS de 1 a 5 depois do atendimento; follow-ups personalizados (quantidade configurável).
- Painel: Atendimentos, Agenda (todos os profissionais), Contatos (histórico, NPS
  médio, status) e Relatórios (faturamento, atendimentos, clientes, NPS).
- Plano único R$69/mês, atendimentos, agenda e funcionários ilimitados.
  Teste 14 dias grátis, sem cartão.

**Nunca invente funcionalidade, preço ou estatística.** Os números da
"Barbearia do Zé" no site são demonstração: se aparecerem, rotule como exemplo.
As telas `financeiro`, `pagamentos` e `assinaturas` do app não são divulgadas
no site; não anuncie sem o usuário confirmar.

Tom: português do Brasil conversado ("você", "pra"), frases curtas, nada de
"alavancar"/"otimizar". Sem travessão (—) no texto dos slides. Pautas boas
saem dos posts do blog (`assets/js/posts-data.js`).

## 3. Estrutura

- **01 Capa** (fundo verde-escuro): logo + @ no topo, título grande em Fraunces
  com a palavra-chave em itálico, subtítulo curto, rodapé "Arrasta pro lado →".
- **02 a N-1 Conteúdo** (fundo creme): eyebrow mono (`DICA 01`), título Fraunces,
  texto Inter de 2 a 4 linhas, um elemento visual (card, mini-chat, lista).
  Rodapé: `@barbo_zap_` à esquerda, `02/N` à direita.
- **N CTA** (fundo verde-escuro): pergunta ou frase de fechamento, ligação com
  uma função real do Barbozap, box "Teste 14 dias grátis · sem cartão", "link na bio".

5 a 8 slides. No máximo ~35 palavras por slide de conteúdo.

## 4. Renderização

- **Um HTML standalone por slide** (nunca um HTML só com JS de navegação).
- `body` e `.wrap` com `width/height: 540px; overflow: hidden`, padding ≥ 36px.
- Playwright: viewport 540×540, `device_scale_factor=2` → PNG 1080×1080 direto.
- Chromium já está em `/opt/pw-browsers/chromium` (o `render.py` usa ele via `executable_path`); **não rode `playwright install`**.
  Se faltar o pacote: `pip install playwright pillow`.
- Espere as fontes: `page.evaluate("document.fonts.ready")` + `wait_for_timeout(800)`.
- Foto: use `<img src="data:image/jpeg;base64,...">`, não `background` em CSS.
- Saída no scratchpad da sessão (`<scratchpad>/carrossel-<slug>/` + `.zip`),
  nunca commitar PNG no repositório.

O script `render.py` desta pasta faz tudo isso:
`python3 .claude/skills/instagram-carousel/render.py <pasta-com-slide_XX.html> <pasta-saida>`

## 5. Checklist antes de entregar

- [ ] Abrir cada PNG e conferir visualmente (Read na imagem).
- [ ] Nada cortado ou encostado nas bordas; nada saindo do quadro.
- [ ] Texto secundário nunca mais claro que `#726c5f` no creme.
- [ ] Fontes carregaram (Fraunces com serifa, não Times).
- [ ] `@barbo_zap_` e numeração `NN/N` corretos em todos os slides de conteúdo.
- [ ] Último slide com CTA de teste grátis.
- [ ] Nenhum fato inventado; ortografia revisada.
- [ ] ZIP gerado; enviar ZIP + legenda sugerida (com hashtags) ao usuário.
