/* ============================================================
   BARBOZAP — LP-CORES.JS
   Cores da landing page da barbearia (/b/<link>).
   O dono escolhe só duas cores: o FUNDO e o DESTAQUE (botão, preços,
   links). Todo o resto (texto, cartões, linhas, texto sobre o botão)
   é calculado aqui para manter o contraste legível (WCAG AA, 4.5:1).
   Usado pela página pública (landing.js) e pela prévia do CRM.
   ============================================================ */

(function () {
  const PADRAO = { fundo: "#ffffff", destaque: "#0f8a4f" };
  const TEXTO_ESCURO = "#0f1a17";
  const TEXTO_CLARO = "#ffffff";
  const HEX = /^#[0-9a-f]{6}$/i;

  function valido(hex) {
    return HEX.test(String(hex || ""));
  }

  function rgb(hex) {
    const h = hex.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  function hex([r, g, b]) {
    return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
  }

  // mistura a com b: t = 0 dá a, t = 1 dá b
  function misturar(a, b, t) {
    const x = rgb(a);
    const y = rgb(b);
    return hex(x.map((v, i) => v + (y[i] - v) * t));
  }

  function luminancia(cor) {
    const [r, g, b] = rgb(cor).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contraste(a, b) {
    const la = luminancia(a);
    const lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // texto claro ou escuro, o que tiver mais contraste com o fundo dado
  function textoSobre(cor) {
    return contraste(cor, TEXTO_ESCURO) >= contraste(cor, TEXTO_CLARO) ? TEXTO_ESCURO : TEXTO_CLARO;
  }

  // empurra a cor em direção a "alvo" até ter o contraste mínimo com "fundo"
  function garantirContraste(cor, fundo, alvo, minimo) {
    if (contraste(cor, fundo) >= minimo) return cor;
    for (let t = 0.05; t <= 1; t += 0.05) {
      const c = misturar(cor, alvo, t);
      if (contraste(c, fundo) >= minimo) return c;
    }
    return alvo;
  }

  function gerarTema(fundoEscolhido, destaqueEscolhido) {
    const fundo = valido(fundoEscolhido) ? fundoEscolhido.toLowerCase() : PADRAO.fundo;
    const destaque = valido(destaqueEscolhido) ? destaqueEscolhido.toLowerCase() : PADRAO.destaque;
    const escuro = textoSobre(fundo) === TEXTO_CLARO;

    // cartões: um pouco mais claros que o fundo (no fundo branco, brancos mesmo)
    const superficie = escuro ? misturar(fundo, "#ffffff", 0.07) : fundo === "#ffffff" ? "#ffffff" : misturar(fundo, "#ffffff", 0.65);
    const texto = textoSobre(superficie);
    const suave = garantirContraste(misturar(texto, superficie, 0.4), superficie, texto, 4.5);
    const linha = misturar(texto, superficie, escuro ? 0.82 : 0.88);

    // destaque como texto (preço, links) precisa ler bem sobre o cartão
    const destaqueTexto = garantirContraste(destaque, superficie, texto, 4.5);
    const sobreDestaque = textoSobre(destaque);
    // destaque quase igual ao fundo: o botão ganha uma borda para não sumir
    const bordaBotao = contraste(destaque, fundo) < 1.6 ? texto : "transparent";
    const [r, g, b] = rgb(fundo);
    const [dr, dg, db] = rgb(destaque);

    return {
      fundo,
      destaque,
      escuro,
      vars: {
        "--cream": fundo,
        "--ink": texto,
        "--muted": suave,
        "--line": linha,
        "--green": destaque,
        "--lp-superficie": superficie,
        "--lp-destaque-texto": destaqueTexto,
        "--lp-sobre-destaque": sobreDestaque,
        "--lp-borda-botao": bordaBotao,
        "--lp-fundo-transparente": `rgba(${r}, ${g}, ${b}, 0)`,
        "--lp-sombra-botao": `0 8px 24px rgba(${dr}, ${dg}, ${db}, 0.3)`,
      },
      parecidas: contraste(destaque, fundo) < 1.6,
    };
  }

  function aplicar(elemento, fundo, destaque) {
    const tema = gerarTema(fundo, destaque);
    Object.entries(tema.vars).forEach(([k, v]) => elemento.style.setProperty(k, v));
    return tema;
  }

  window.LPCores = { PADRAO, valido, gerarTema, aplicar, contraste };
})();
