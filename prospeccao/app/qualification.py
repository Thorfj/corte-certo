"""Analise textual para qualificar oportunidade de venda do Corte Certo.

A logica e invertida em relacao a um app de "afinidade": aqui o lead
QUENTE e a barbearia que AINDA NAO usa nenhum sistema de agendamento
online (oportunidade de venda do Corte Certo). Quando detectamos que ela
ja usa uma plataforma concorrente, ela vira lead frio/observacao.
"""
from __future__ import annotations

import re

# Termos que indicam que a barbearia ja possui algum sistema de agendamento
KEYWORDS = [
    "trinks",
    "booksy",
    "fresha",
    "salao vip",
    "salaovip",
    "agenda barber",
    "agendabarber",
    "isalao",
    "zenoti",
    "simplesagenda",
    "agendamento online",
    "agende pelo site",
    "agende pelo whatsapp",
    "agende seu horario",
    "marque seu horario",
    "reserve seu horario",
    "reserve seu horario online",
    "app de agendamento",
]

# Dominios de plataformas de agendamento conhecidas (checados na URL do site/perfil)
PLATAFORMAS_DOMINIOS = {
    "trinks.com": "Trinks",
    "booksy.com": "Booksy",
    "fresha.com": "Fresha",
    "salaovip.com": "Salão VIP",
    "zenoti.com": "Zenoti",
    "isalao.com": "iSalão",
    "simplesagenda.com": "SimplesAgenda",
}

TAG_OPORTUNIDADE = "🟢 Alta Oportunidade - Sem Agendamento Online"
TAG_JA_USA_AGENDAMENTO = "🟡 Já usa Agendamento Online"


def _normalize(text: str) -> str:
    text = text.lower()
    return re.sub(r"[áàâã]", "a", re.sub(r"[éê]", "e", re.sub(r"[íî]", "i",
        re.sub(r"[óôõ]", "o", re.sub(r"[úû]", "u", re.sub(r"[ç]", "c", text))))))


def detectar_plataforma_na_url(url: str) -> list[str]:
    """Verifica se o site/perfil aponta direto para uma plataforma de agendamento conhecida."""
    if not url:
        return []
    url_low = url.lower()
    return [nome for dominio, nome in PLATAFORMAS_DOMINIOS.items() if dominio in url_low]


def analisar_texto(*textos: str) -> tuple[str, list[str]]:
    """Recebe descricao/avaliacoes/site e retorna (tag, palavras-chave encontradas)."""
    conteudo = _normalize(" \n ".join(t for t in textos if t))
    encontradas = []
    for kw in KEYWORDS:
        if _normalize(kw) in conteudo:
            encontradas.append(kw)

    tag = TAG_JA_USA_AGENDAMENTO if encontradas else TAG_OPORTUNIDADE
    return tag, sorted(set(encontradas))


def combinar_com_plataforma_url(tag: str, encontradas: list[str], site_url: str) -> tuple[str, list[str]]:
    """Funde o resultado textual com a deteccao de plataforma na URL do site."""
    plataformas = detectar_plataforma_na_url(site_url)
    if not plataformas:
        return tag, encontradas
    todas = sorted(set(encontradas) | set(plataformas))
    return TAG_JA_USA_AGENDAMENTO, todas