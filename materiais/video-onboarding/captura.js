const { chromium } = require('playwright');
const OUT = __dirname + '/telas/';
const stub = (estado) => `
(function(){
  const E = ${JSON.stringify(estado)};
  const T = {
    barbearias: [Object.assign({ id: 16, empresa: 'Barbearia Matriz', email: 'matrizbarbearia305@gmail.com', whatsapp: '5548996722998', whatsapp_barbearia: '5548996722998', cliente: false, google_calendar_status: 'sem_permissao', google_calendar_email: 'matrizbarbearia305@gmail.com', horario_funcionamento: {"0": null, "1": ["09:00","19:30"], "2": ["09:00","19:30"], "3": ["09:00","19:30"], "4": ["09:00","19:30"], "5": ["09:00","19:30"], "6": ["09:00","19:00"]}, status_fluxo: 'Não', status_assinatura: 'SEM_COBRANCA', retomada_tempos: [15,15,15], criado_em: new Date().toISOString(), trial_iniciado_em: null }, E.barbearia || {})],
    profissionais: [{ id: 18, barbearia_id: 16, acesso: 'admin', tema: 'light', nome: 'Matriz', email: 'matrizbarbearia305@gmail.com', atende_clientes: true, agendas: null }],
    servicos: E.servicos || [],
    fluxo_mensagens: [{ id_msg: '00101', etapa: 'Primeiro contato', mensagem: 'Olá! 👋 Que bom ter você por aqui. Eu sou o assistente de agendamentos e vou te ajudar a marcar seu horário em poucos passos. Para começar, qual é o seu nome?' }, { id_msg: '00201', etapa: 'Escolha de Serviço', mensagem: 'Qual serviço você quer agendar? ✂️ Responda com o número.' }, { id_msg: '00301', etapa: 'Escolha do profissional', mensagem: 'Com quem você prefere ser atendido?' }, { id_msg: '00401', etapa: 'Marcar o dia', mensagem: 'Para qual dia você quer marcar? (ex: amanhã, sexta ou 25/11)' }], fluxo_followup: [], mensagem_padrao_fluxo: [], atendimentos: [], clientes: [], bloqueios_agenda: []
  };
  const chain = (tab, single) => new Proxy(function(){}, {
    get(t, k) {
      if (k === 'then') return (r) => { const d = T[tab] || []; r({ data: single ? (d[0] || null) : d, error: null, count: d.length }); };
      if (k === 'single' || k === 'maybeSingle') return () => chain(tab, true);
      return chain(tab, single);
    },
    apply() { return chain(tab, single); }
  });
  const sess = { user: { id: 'u', email: 'matrizbarbearia305@gmail.com' }, access_token: 'x' };
  window.supabase = { createClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: sess } }), getUser: () => Promise.resolve({ data: { user: sess.user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
    from: (t) => chain(t, false), rpc: () => chain('', false), channel: () => chain('', false), removeChannel(){}
  }) };
})();`;
const SERVICOS = [
  { id: 1, sku: 'S001', nome: 'Corte', preco: 45, duracao_min: 30, recorrencia: 30 },
  { id: 2, sku: 'S002', nome: 'Barba', preco: 35, duracao_min: 30, recorrencia: 15 },
  { id: 3, sku: 'S003', nome: 'Corte + Barba', preco: 70, duracao_min: 60, recorrencia: 30 },
];
(async () => {
  const b = await chromium.launch();
  async function tela(nome, url, estado, acao) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    p.on('pageerror', e => console.log(nome, 'ERR', e.message));
    await p.route('**/supabase-js@2*', r => r.fulfill({ contentType: 'application/javascript', body: stub(estado) }));
    await p.route('**/n8n.srv2088418.hstgr.cloud/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ estado: 'open', numero: '5548996722998' }) }));
    await p.goto('http://localhost:8765' + url);
    await p.waitForTimeout(1500);
    if (acao) await acao(p);
    await p.waitForTimeout(400);
    const caixas = {};
    for (const sel of ['#novo-servico-btn', '#sv-nome', '#sv-preco', '#sv-duracao', '#sv-recorrencia', '#sv-salvar-btn', '#google-conectar-btn', '#google-status-badge', '#toggle-fluxo-btn', '.onb-item, .primeiros-passos li']) {
      const el = await p.$(sel); if (!el) continue; const bb = await el.boundingBox(); if (bb) caixas[sel] = bb;
    }
    const extra = await p.evaluate(() => {
      const r = {};
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && /^(Cadastrar os serviços|Conectar o Google Agenda|Ligar o bot|Conectar o WhatsApp da barbearia|Conferir o horário de funcionamento)$/.test(el.textContent.trim())) {
          const linha = el.closest('li, .onb-passo, .onboarding-item, div');
          let alvo = linha; for (let i = 0; i < 4 && alvo && !alvo.querySelector('a, button'); i++) alvo = alvo.parentElement;
          const bt = alvo && alvo.querySelector('a, button');
          const b1 = el.getBoundingClientRect(); r[el.textContent.trim()] = { x: b1.x, y: b1.y, width: b1.width, height: b1.height };
          if (bt) { const b2 = bt.getBoundingClientRect(); r['botao: ' + el.textContent.trim()] = { x: b2.x, y: b2.y, width: b2.width, height: b2.height }; }
        }
      });
      return r;
    });
    Object.assign(caixas, extra);
    require('fs').writeFileSync(OUT + nome + '.json', JSON.stringify(caixas));
    await p.screenshot({ path: OUT + nome + '.png' });
    await p.close();
    console.log('ok', nome);
  }
  await tela('01-inicio', '/app/', {});
  await tela('02-servicos-vazio', '/app/servicos/', {});
  await tela('03-servicos-form', '/app/servicos/', {}, async (p) => {
    await p.click('#novo-servico-btn'); await p.waitForTimeout(300);
    await p.fill('#sv-nome', 'Corte'); await p.fill('#sv-preco', '45'); await p.fill('#sv-duracao', '30'); await p.fill('#sv-recorrencia', '30');
  });
  await tela('04-servicos-lista', '/app/servicos/', { servicos: SERVICOS });
  await tela('05-google-sem-permissao', '/app/configuracoes/', { servicos: SERVICOS }, async (p) => { await p.evaluate(() => { const c = document.getElementById('card-google'); const y = c.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo(0, y); document.querySelectorAll('.main-content, main, .content').forEach(m => { if (m.scrollHeight > m.clientHeight) m.scrollTop = c.offsetTop - 70; }); }); });
  await tela('06-google-conectado', '/app/configuracoes/', { servicos: SERVICOS, barbearia: { google_calendar_status: 'conectado' } }, async (p) => { await p.evaluate(() => { const c = document.getElementById('card-google'); const y = c.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo(0, y); document.querySelectorAll('.main-content, main, .content').forEach(m => { if (m.scrollHeight > m.clientHeight) m.scrollTop = c.offsetTop - 70; }); }); });
  await tela('07-mensagens-bot', '/app/mensagens/', { servicos: SERVICOS, barbearia: { status_fluxo: 'Sim', google_calendar_status: 'conectado' } });
  await tela('08-inicio-pronto', '/app/', { servicos: SERVICOS, barbearia: { status_fluxo: 'Sim', google_calendar_status: 'conectado' } });
  await b.close();
})();
