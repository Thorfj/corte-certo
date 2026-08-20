"""
Sincronização com a tabela `leads` do Supabase — a MESMA base usada pelo
central.js/central.html do Corte Certo (core/js/central.js).

Isso permite:
  - checar quais leads já existem no CRM antes de mostrar resultados novos
    de uma busca (evita duplicar barbearia que já está no funil);
  - inserir direto na tabela `leads` os leads selecionados na tela.

Credenciais:
  Lê SUPABASE_URL e SUPABASE_SERVICE_KEY de variável de ambiente OU de
  st.secrets (quando rodando no Streamlit / Streamlit Cloud).

  Use a SERVICE ROLE KEY aqui (não a anon key). Esse script roda no seu
  servidor/máquina, não no navegador do usuário — então é seguro, e é
  necessário porque a tabela `leads` deve ter RLS restrita à equipe
  interna (checada via login em central.js), e este app não passa por
  esse login.
"""

from __future__ import annotations

import os
import re
from typing import Optional

from supabase import create_client, Client

try:
    import streamlit as st
except ImportError:  # permite rodar fora do Streamlit (ex.: scripts/testes)
    st = None


def _get_secret(key: str) -> str:
    if key in os.environ:
        return os.environ[key]
    if st is not None:
        try:
            return st.secrets[key]
        except Exception:
            pass
    return ""


def get_client() -> Client:
    url = _get_secret("SUPABASE_URL")
    key = _get_secret("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Defina SUPABASE_URL e SUPABASE_SERVICE_KEY em .streamlit/secrets.toml "
            "(local) ou em Settings > Secrets (Streamlit Cloud). Veja o README.md."
        )
    return create_client(url, key)


def _normalizar_telefone(telefone: Optional[str]) -> Optional[str]:
    if not telefone:
        return None
    apenas_digitos = re.sub(r"\D", "", telefone)
    return apenas_digitos or None


def carregar_leads_existentes(client: Client) -> set[str]:
    """
    Devolve um conjunto de "chaves" dos leads que já estão na tabela `leads`:
    uma chave por telefone normalizado (mais confiável) e uma por
    nome+cidade em minúsculo (fallback pra quando não tem telefone).
    """
    resp = client.table("leads").select("nome_barbearia, cidade, telefone").execute()
    chaves: set[str] = set()
    for row in resp.data or []:
        tel = _normalizar_telefone(row.get("telefone"))
        if tel:
            chaves.add(f"tel:{tel}")
        nome = (row.get("nome_barbearia") or "").strip().lower()
        cidade = (row.get("cidade") or "").strip().lower()
        if nome:
            chaves.add(f"nome:{nome}|{cidade}")
    return chaves


def eh_duplicado(lead, chaves_existentes: set[str]) -> bool:
    tel = _normalizar_telefone(lead.telefone)
    if tel and f"tel:{tel}" in chaves_existentes:
        return True
    nome = (lead.nome or "").strip().lower()
    cidade = (lead.cidade or "").strip().lower()
    return f"nome:{nome}|{cidade}" in chaves_existentes


def inserir_leads(client: Client, leads: list) -> tuple[int, list[str]]:
    """Insere os leads selecionados na tabela `leads`.
    Devolve (quantidade inserida, lista de mensagens de erro)."""
    inseridos = 0
    erros: list[str] = []

    for lead in leads:
        payload = {
            "nome_barbearia": lead.nome,
            "cidade": lead.cidade or None,
            "bairro": lead.bairro or None,
            "telefone": lead.telefone,
            "origem": "google_maps",
            "status": "novo_lead",
            "notas": f"Endereço: {lead.endereco or '—'} | Site: {lead.site or '—'}",
        }
        try:
            client.table("leads").insert(payload).execute()
            inseridos += 1
        except Exception as e:  # segue tentando os próximos mesmo se um falhar
            erros.append(f"{lead.nome}: {e}")

    return inseridos, erros