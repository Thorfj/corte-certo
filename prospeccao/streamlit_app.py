"""Interface Streamlit: Prospeccao de Barbearias - Corte Certo."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import streamlit as st

from app.database import get_conn, upsert_prospect, fetch_filtered
from app.exporter import rows_to_dataframe, to_csv_bytes, to_xlsx_bytes
from app.scraper import buscar_perfis, montar_prospect

st.set_page_config(page_title="Corte Certo | Prospecção", page_icon="✂️", layout="wide")

# ------------------------------------------------------------------
# Tema visual alinhado ao global.css do Corte Certo (crm/css/global.css)
# ------------------------------------------------------------------
CUSTOM_CSS = """
<style>
:root {
    --brand: #0f6e56;
    --brand-dark: #085041;
    --brand-light: #d8f0e6;
    --bg-sidebar: #f7f2e9;
    --bg-page: #faf7f0;
    --bg-card: #ffffff;
    --text-primary: #1c1c1a;
    --text-secondary: #6b6a63;
    --text-muted: #a3a196;
    --border: rgba(28, 28, 26, 0.08);
    --radius-md: 12px;
    --radius-lg: 16px;
}

html, body, .stApp {
    background: var(--bg-page) !important;
    color: var(--text-primary) !important;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

/* Sidebar */
section[data-testid="stSidebar"] {
    background: var(--bg-sidebar) !important;
    border-right: 1px solid var(--border);
}
section[data-testid="stSidebar"] h2, section[data-testid="stSidebar"] label {
    color: var(--text-primary) !important;
}

/* Titulo e texto */
h1, h2, h3 { color: var(--text-primary) !important; font-weight: 600 !important; }
p, span, label { color: var(--text-secondary); }

/* Inputs */
.stTextInput input, .stSelectbox div[data-baseweb="select"] > div {
    border-radius: var(--radius-md) !important;
    border: 1px solid var(--border) !important;
    background: var(--bg-card) !important;
}

/* Botao primario */
button[kind="primary"] {
    background: var(--brand) !important;
    border-color: var(--brand) !important;
    border-radius: var(--radius-md) !important;
    color: #ffffff !important;
}
button[kind="primary"]:hover {
    background: var(--brand-dark) !important;
    border-color: var(--brand-dark) !important;
}

/* Botoes secundarios (download etc.) */
.stDownloadButton button, button[kind="secondary"] {
    border-radius: var(--radius-md) !important;
    border: 1px solid var(--border) !important;
    background: var(--bg-card) !important;
    color: var(--text-primary) !important;
}

/* Metricas */
[data-testid="stMetric"] {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 12px 16px;
}
[data-testid="stMetricValue"] { color: var(--brand-dark) !important; }
[data-testid="stMetricLabel"] { color: var(--text-secondary) !important; }

/* Progresso */
.stProgress > div > div { background: var(--brand) !important; }

/* Radio (filtro) */
.stRadio label { color: var(--text-primary) !important; }

/* Tabela */
[data-testid="stDataFrame"] { border-radius: var(--radius-lg); overflow: hidden; }

/* Divider */
hr { border-color: var(--border) !important; }
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


@st.cache_resource
def garantir_chromium_instalado() -> None:
    """Instala o navegador Chromium do Playwright na primeira execucao do app."""
    marcador = Path.home() / ".cache" / "ms-playwright" / ".chromium_ok"
    if marcador.exists():
        return
    with st.spinner("Preparando navegador para extracao (primeira execucao pode demorar)..."):
        subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            check=True,
        )
    marcador.parent.mkdir(parents=True, exist_ok=True)
    marcador.touch()


garantir_chromium_instalado()

TIPOS_ESTABELECIMENTO = [
    "Barbearia",
    "Barbearia e Salão Masculino",
    "Barber Shop / Vintage",
]

st.title("✂️ Prospecção de Barbearias — Corte Certo")
st.caption("Encontre barbearias por bairro e cidade e identifique quem ainda não usa agendamento online.")

with st.sidebar:
    st.header("Parâmetros de Busca")
    tipo = st.selectbox("Tipo de estabelecimento", TIPOS_ESTABELECIMENTO)
    bairro = st.text_input("Bairro", placeholder="Ex: Batel")
    cidade = st.text_input("Cidade", placeholder="Ex: Curitiba - PR")
    quantidade = st.selectbox("Quantidade por lote", [20, 50, 100], index=0)
    iniciar = st.button("🔎 Iniciar Extração", type="primary", use_container_width=True)

if "resumo" not in st.session_state:
    st.session_state.resumo = None

if iniciar:
    if not cidade.strip():
        st.error("Informe pelo menos a Cidade antes de iniciar a extração.")
    else:
        progresso = st.progress(0, text="Iniciando...")
        contadores = {"oportunidades": 0, "ja_usam": 0, "atualizados": 0, "ignorados": 0, "invalidos": 0}

        def on_progress(atual: int, total: int, _link: str) -> None:
            progresso.progress(atual / max(total, 1), text=f"Analisando perfil {atual}/{total}")

        with get_conn() as conn:
            for listing in buscar_perfis(tipo, bairro.strip(), cidade.strip(), quantidade, on_progress=on_progress):
                prospect = montar_prospect(listing, tipo, bairro.strip(), cidade.strip())

                if not prospect.is_valid():
                    contadores["invalidos"] += 1
                    continue

                status = upsert_prospect(conn, prospect)
                if status == "Novo Cadastro":
                    if prospect.tag_qualificacao.startswith("🟢"):
                        contadores["oportunidades"] += 1
                    else:
                        contadores["ja_usam"] += 1
                elif status == "Atualizado":
                    contadores["atualizados"] += 1
                else:
                    contadores["ignorados"] += 1

        progresso.progress(1.0, text="Extração concluída")
        st.session_state.resumo = contadores

if st.session_state.resumo:
    c = st.session_state.resumo
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("🟢 Oportunidades (sem agendamento)", c["oportunidades"])
    col2.metric("🟡 Já usam agendamento", c["ja_usam"])
    col3.metric("🔵 Atualizados", c["atualizados"])
    col4.metric("⚪ Ignorados", c["ignorados"])
    if c["invalidos"]:
        st.caption(f"{c['invalidos']} perfis descartados por falta de dados mínimos (nome, telefone/whatsapp e cidade).")

st.divider()
st.subheader("Base de Prospecção")

filtro = st.radio(
    "Filtro para visualização / exportação",
    ["Base Completa", "Apenas Novos/Atualizados da ultima busca", "Apenas Alta Oportunidade (sem agendamento online)"],
    horizontal=True,
)

with get_conn() as conn:
    rows = fetch_filtered(conn, filtro)

df = rows_to_dataframe(rows)
st.dataframe(df, use_container_width=True, hide_index=True)

col_a, col_b = st.columns(2)
with col_a:
    st.download_button(
        "⬇️ Exportar CSV",
        data=to_csv_bytes(df),
        file_name="prospeccao_barbearias.csv",
        mime="text/csv",
        use_container_width=True,
        disabled=df.empty,
    )
with col_b:
    st.download_button(
        "⬇️ Exportar Excel (.xlsx)",
        data=to_xlsx_bytes(df),
        file_name="prospeccao_barbearias.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
        disabled=df.empty,
    )