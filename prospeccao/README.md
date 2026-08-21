# Prospecção de Barbearias - Corte Certo

Aplicação Streamlit para prospecção comercial de barbearias no Google Maps,
com foco em identificar estabelecimentos que ainda **não usam agendamento
online** — o público ideal para venda do Corte Certo.

## Estrutura

```
prospeccao/
├── streamlit_app.py       # Interface (Streamlit), tema alinhado ao global.css do Corte Certo
├── app/
│   ├── database.py         # Modelo Prospect + SQLite (dedup e upsert)
│   ├── scraper.py           # Busca e extração de perfis no Google Maps (Playwright)
│   ├── enrichment.py        # Extração de e-mail/instagram/whatsapp do site do perfil
│   ├── qualification.py     # Detecção de plataformas de agendamento (Trinks, Booksy, Fresha etc.)
│   └── exporter.py          # Exportação CSV / Excel
├── data/
│   └── prospeccao_barbearias.db  # Banco SQLite local (gerado em runtime)
└── requirements.txt
```

## Como rodar

```bash
pip install -r requirements.txt
playwright install chromium
streamlit run streamlit_app.py
```

## Regras principais

- **Busca**: por tipo de estabelecimento (Barbearia, Barbearia e Salão Masculino,
  Barber Shop / Vintage) + Bairro + Cidade.
- **Validação mínima**: um registro só é salvo se tiver Nome + (Telefone Principal
  ou WhatsApp) + Cidade.
- **Antiduplicação**: chave única por URL do perfil no Google Maps (ou
  Nome+Cidade+Telefone como fallback). Registros existentes são atualizados
  somente quando há dado novo (email, whatsapp, instagram etc.).
- **Qualificação (invertida)**: analisa descrição/avaliações/site em busca de
  plataformas de agendamento conhecidas (Trinks, Booksy, Fresha, Salão VIP,
  Zenoti, iSalão, SimplesAgenda) e termos genéricos ("agendamento online",
  "marque seu horário" etc.):
  - 🟢 **Alta Oportunidade - Sem Agendamento Online**: não foi encontrada
    nenhuma plataforma → lead ideal para o Corte Certo.
  - 🟡 **Já usa Agendamento Online**: já usa algum concorrente/sistema →
    lead frio ou para observação.