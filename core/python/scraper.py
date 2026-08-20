"""
Scraper de barbearias no Google Maps.

Usa Playwright (Chromium headless) pra abrir uma busca no Google Maps,
rolar a lista de resultados e extrair nome, telefone, endereço e site
de cada estabelecimento encontrado.

⚠️ Isso NÃO usa a API oficial do Google (que é paga). É scraping da página
pública do Maps, então:
  - pode quebrar se o Google mudar o HTML/seletores da página;
  - não é endossado pelos Termos de Uso do Google;
  - é mais lento (abre um navegador de verdade) e menos previsível que uma
    API paga.

Se isso virar um processo crítico do negócio e começar a falhar com
frequência, vale considerar migrar pra Google Places API — ela tem uma
cota gratuita mensal (crédito de uso) que provavelmente cobre esse volume
de buscas em lotes pequenos.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeout


@dataclass
class LeadEncontrado:
    nome: str
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    site: Optional[str] = None
    categoria: str = "Barbearia"
    cidade: str = ""
    bairro: str = ""


def _montar_query(categoria: str, bairro: str, cidade: str) -> str:
    local = ", ".join([p for p in [bairro, cidade] if p])
    return f"{categoria} em {local}" if local else categoria


def _extrair_telefone(texto: str) -> Optional[str]:
    match = re.search(r"(\(?\d{2}\)?\s?9?\d{4}-?\d{4})", texto or "")
    return match.group(1) if match else None


def _rolar_resultados(page: Page, quantidade: int, max_tentativas_sem_mudanca: int = 8) -> None:
    """Rola o painel de resultados do Maps até ter `quantidade` cards ou
    até parar de carregar coisa nova (fim da lista / bloqueio)."""
    painel = page.locator('div[role="feed"]')
    anterior = 0
    tentativas_sem_mudanca = 0

    while tentativas_sem_mudanca < max_tentativas_sem_mudanca:
        cards = painel.locator('div[role="article"]')
        total = cards.count()
        if total >= quantidade:
            break

        painel.evaluate("(el) => el.scrollBy(0, 900)")
        page.wait_for_timeout(1000)

        if total == anterior:
            tentativas_sem_mudanca += 1
        else:
            tentativas_sem_mudanca = 0
        anterior = total


def buscar_barbearias(
    cidade: str,
    bairro: str = "",
    categoria: str = "Barbearia",
    quantidade: int = 20,
    headless: bool = True,
) -> list[LeadEncontrado]:
    """Busca estabelecimentos no Google Maps e devolve uma lista de leads.

    Parâmetros:
        cidade: obrigatório, ex. "Curitiba"
        bairro: opcional, ex. "Água Verde" — refina a busca
        categoria: termo de busca, ex. "Barbearia"
        quantidade: quantos resultados tentar coletar no lote
    """
    query = _montar_query(categoria, bairro, cidade)
    resultados: list[LeadEncontrado] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page(locale="pt-BR")

        try:
            page.goto(f"https://www.google.com/maps/search/{query}", timeout=60000)
            page.wait_for_selector('div[role="feed"]', timeout=15000)
        except PlaywrightTimeout:
            browser.close()
            return resultados

        _rolar_resultados(page, quantidade)

        cards = page.locator('div[role="feed"] div[role="article"]')
        total = min(cards.count(), quantidade)

        for i in range(total):
            card = cards.nth(i)
            try:
                nome = card.locator("div.fontHeadlineSmall").first.inner_text(timeout=5000).strip()
            except PlaywrightTimeout:
                continue
            if not nome:
                continue

            try:
                card.click()
                page.wait_for_timeout(1800)
            except Exception:
                continue

            telefone = None
            endereco = None
            site = None

            try:
                bloco = page.locator('button[data-item-id^="phone:"]').first
                if bloco.count() > 0:
                    label = bloco.get_attribute("aria-label") or ""
                    telefone = _extrair_telefone(label) or label or None
            except Exception:
                pass

            try:
                bloco = page.locator('button[data-item-id="address"]').first
                if bloco.count() > 0:
                    label = bloco.get_attribute("aria-label") or ""
                    endereco = label.replace("Endereço: ", "").strip() or None
            except Exception:
                pass

            try:
                bloco = page.locator('a[data-item-id="authority"]').first
                if bloco.count() > 0:
                    site = bloco.get_attribute("href")
            except Exception:
                pass

            resultados.append(
                LeadEncontrado(
                    nome=nome,
                    telefone=telefone,
                    endereco=endereco,
                    site=site,
                    categoria=categoria,
                    cidade=cidade,
                    bairro=bairro,
                )
            )

        browser.close()

    return resultados