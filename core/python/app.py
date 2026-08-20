"""
Base de Prospecção — Barbearias (Corte Certo)

App Streamlit que busca barbearias no Google Maps (via scraper.py),
filtra as que já estão no CRM (tabela `leads` do Supabase) e permite
selecionar quais adicionar direto ao funil de vendas do central.html.

Rodar localmente:
    pip install -r requirements.txt
    playwright install chromium
    streamlit run app.py

Deploy: Streamlit Community Cloud, apontando pra esta pasta `python/`
dentro do repositório. Veja o README.md pra configurar os secrets do
Supabase.
"""

from __future__ import annotations

import subprocess
import sys

import pandas as pd
import streamlit as st

from scraper import buscar_barbearias
import supabase_sync as db


st.set_page_config(page_title="Prospecção de Barbearias — Corte Certo", layout="wide")


@st.cache_resource
def _garantir_chromium_instalado():
    """Garante que o navegador do Playwright está baixado.
    Só roda de fato na primeira vez (cache_resource), evita repetir
    a cada interação do usuário na tela."""
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=False)
    return True


_garantir_chromium_instalado()

if "resultados" not in st.session_state:
    st.session_state.resultados = []

with st.sidebar:
    st.title("Parâmetros de Busca")

    categoria = st.selectbox(
        "Categoria",
        ["Barbearia", "Barbearia masculina", "Barber shop"],
    )
    cidade = st.text_input("Cidade", placeholder="Ex: Curitiba")
    bairro = st.text_input("Bairro", placeholder="Ex: Água Verde (opcional)")
    quantidade = st.selectbox("Quantidade por lote", [10, 20, 30, 50], index=1)

    buscar = st.button("🔍 Iniciar Extração", type="primary", use_container_width=True)

st.title("Base de Prospecção — Barbearias")
st.caption(
    "Leads que já estão no CRM (tabela `leads`, mesma base do central.html) "
    "são filtrados automaticamente e não aparecem aqui."
)

if buscar:
    if not cidade:
        st.warning("Informe pelo menos a cidade.")
    else:
        with st.spinner("Buscando no Google Maps... isso pode levar um minuto."):
            try:
                encontrados = buscar_barbearias(cidade, bairro, categoria, quantidade)
            except Exception as e:
                st.error(f"Erro na busca: {e}")
                encontrados = []

            try:
                client = db.get_client()
                chaves = db.carregar_leads_existentes(client)
                novos = [l for l in encontrados if not db.eh_duplicado(l, chaves)]
            except Exception as e:
                st.error(f"Erro ao consultar o CRM pra filtrar duplicados: {e}")
                novos = encontrados

            st.session_state.resultados = novos

        st.success(
            f"{len(encontrados)} encontrado(s) no Maps · {len(novos)} novo(s) (fora do CRM)."
        )

if st.session_state.resultados:
    df = pd.DataFrame(
        [
            {
                "selecionar": True,
                "nome": l.nome,
                "categoria": l.categoria,
                "telefone": l.telefone or "",
                "endereco": l.endereco or "",
                "site": l.site or "",
                "bairro": l.bairro,
                "cidade": l.cidade,
            }
            for l in st.session_state.resultados
        ]
    )

    editado = st.data_editor(
        df,
        column_config={"selecionar": st.column_config.CheckboxColumn("Selecionar")},
        disabled=[c for c in df.columns if c != "selecionar"],
        hide_index=True,
        use_container_width=True,
    )

    selecionados_idx = editado.index[editado["selecionar"]].tolist()
    st.caption(f"{len(selecionados_idx)} selecionado(s)")

    col1, _ = st.columns([1, 3])
    with col1:
        adicionar = st.button(
            "➕ Adicionar selecionados ao CRM",
            type="primary",
            use_container_width=True,
            disabled=len(selecionados_idx) == 0,
        )

    if adicionar:
        leads_para_inserir = [st.session_state.resultados[i] for i in selecionados_idx]
        try:
            client = db.get_client()
            inseridos, erros = db.inserir_leads(client, leads_para_inserir)
            st.success(
                f"{inseridos} lead(s) adicionado(s) ao CRM "
                "(aparecem na aba Funil de Vendas da Central Interna)."
            )
            if erros:
                st.error("Alguns leads deram erro ao salvar:\n" + "\n".join(erros))

            # remove da tela os que sobraram sem erro (evita reenviar duplicado)
            restantes_idx = [
                i for i in range(len(st.session_state.resultados)) if i not in selecionados_idx
            ]
            st.session_state.resultados = [st.session_state.resultados[i] for i in restantes_idx]
            st.rerun()
        except Exception as e:
            st.error(f"Erro ao conectar no Supabase: {e}")
else:
    st.info("Configure os parâmetros na barra lateral e clique em **Iniciar Extração**.")