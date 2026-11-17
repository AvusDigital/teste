'use strict';
// JavaScript do navegador. Sem dependências. Nunca usa innerHTML: o DOM é montado com textContent.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const digitos = v => String(v || '').replace(/\D+/g, '');

  function h(tag, props, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v != null && v !== false) el.setAttribute(k, v);
    }
    for (const f of filhos.flat()) if (f != null && f !== false) el.append(f.nodeType ? f : document.createTextNode(f));
    return el;
  }
  const limpar = el => { while (el.firstChild) el.firstChild.remove(); return el; };

  // ---------- armazenamento (à prova de falha: modo anônimo/quota) ----------
  const ls = {
    ler(k, pad) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? pad; } catch { return pad; } },
    gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    apagar(k) { try { localStorage.removeItem(k); } catch {} }
  };

  // ---------- toast ----------
  let tToast;
  function toast(msg) { const el = $('[data-toast]'); if (!el) return; el.textContent = msg; el.classList.add('on'); clearTimeout(tToast); tToast = setTimeout(() => el.classList.remove('on'), 2600); }

  // ---------- API ----------
  async function api(rota, corpo) {
    let r;
    try { r = await fetch(rota, corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) } : undefined); }
    catch { throw new Error('Sem conexão. Verifique sua internet e tente de novo.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Não foi possível concluir. Tente de novo.');
    return j;
  }

  // ---------- catálogo e carrinho ----------
  let _cat;
  const catalogo = () => _cat || (_cat = fetch('/catalogo.json').then(r => r.json()).then(l => new Map(l.map(p => [p.i, p]))));

  const Carrinho = {
    itens() { return ls.ler('arpint.carrinho', []).filter(i => Number.isInteger(i.id) && Number.isInteger(i.qtd) && i.qtd > 0).map(i => ({ id: i.id, qtd: Math.min(99, i.qtd) })); },
    salvar(l) { ls.gravar('arpint.carrinho', l); atualizarContagem(); document.dispatchEvent(new CustomEvent('carrinho')); },
    adicionar(id, qtd = 1) { const l = this.itens(), i = l.find(x => x.id === id); if (i) i.qtd = Math.min(99, i.qtd + qtd); else l.push({ id, qtd: Math.min(99, qtd) }); this.salvar(l); },
    definir(id, qtd) { const l = this.itens().map(i => i.id === id ? { id, qtd: Math.max(1, Math.min(99, qtd)) } : i); this.salvar(l); },
    remover(id) { this.salvar(this.itens().filter(i => i.id !== id)); },
    limpar() { this.salvar([]); ls.apagar('arpint.frete'); },
    total() { return this.itens().reduce((s, i) => s + i.qtd, 0); }
  };
  function atualizarContagem() { const n = Carrinho.total(); $$('[data-contagem]').forEach(el => { el.textContent = n; el.hidden = n === 0; }); }

  // ---------- comum a todas as páginas ----------
  atualizarContagem();
  document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && !t.src.endsWith('/img/placeholder.svg')) t.src = '/img/placeholder.svg'; }, true);
  // Interruptor de tema: a escolha fica salva (texto puro, o mesmo formato que tema.js lê) e vale em todas as páginas e abas.
  const aplicarTema = claro => { document.documentElement.dataset.tema = claro ? 'claro' : 'escuro'; $$('[data-tema-btn]').forEach(b => b.setAttribute('aria-checked', String(claro))); };
  aplicarTema(document.documentElement.dataset.tema === 'claro');
  $$('[data-tema-btn]').forEach(b => b.addEventListener('click', () => {
    const claro = document.documentElement.dataset.tema !== 'claro'; aplicarTema(claro);
    try { localStorage.setItem('arpint.tema', claro ? 'claro' : 'escuro'); } catch {}
  }));
  window.addEventListener('storage', e => { if (e.key === 'arpint.tema') aplicarTema(e.newValue === 'claro'); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b || b.disabled) return;
    const id = Number(b.dataset.add); const campo = b.hasAttribute('data-usar-qtd') ? $('[data-qtd]') : null;
    const qtd = campo ? Math.max(1, Math.min(99, parseInt(campo.value, 10) || 1)) : 1;
    Carrinho.adicionar(id, qtd); toast(qtd > 1 ? `${qtd} unidades no carrinho` : 'Adicionado ao carrinho');
  });
  window.addEventListener('storage', atualizarContagem);

  // ---------- máscaras ----------
  const mascaraCep = v => { const d = digitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  const mascaraFone = v => { const d = digitos(v).slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
  const mascaraDoc = v => { const d = digitos(v).slice(0, 14); if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); };
  const ligarMascara = (el, fn) => el && el.addEventListener('input', () => { el.value = fn(el.value); });

  // ================= páginas =================
  const paginas = {
    lista() {
      const grade = $('[data-grade]'), cards = $$('.card', grade).map((el, i) => ({ el, i, n: el.dataset.n, p: el.dataset.p === '' ? null : Number(el.dataset.p), nome: $('h3', el).textContent, sub: el.dataset.sub }));
      const q = $('#q'), ordem = $('#ordem'), chips = $$('.chip');
      const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      let sub = '';
      const inicial = new URLSearchParams(location.search).get('q'); if (inicial) q.value = inicial;
      function aplicar() {
        const termos = norm(q.value).split(/\s+/).filter(Boolean);
        const vis = cards.filter(c => (!sub || c.sub === sub) && termos.every(t => c.n.includes(t)));
        const o = ordem.value;
        vis.sort(o === 'menor' ? (a, b) => (a.p ?? Infinity) - (b.p ?? Infinity) : o === 'maior' ? (a, b) => (b.p ?? -1) - (a.p ?? -1) : o === 'az' ? (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') : (a, b) => a.i - b.i);
        cards.forEach(c => { c.el.hidden = !vis.includes(c); });
        vis.forEach(c => grade.append(c.el));
        $('[data-resultado]').textContent = `${vis.length} produto${vis.length !== 1 ? 's' : ''}`;
        $('[data-vazio]').hidden = vis.length > 0;
      }
      let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(aplicar, 120); });
      ordem.addEventListener('change', aplicar);
      chips.forEach(c => c.addEventListener('click', () => { sub = c.dataset.sub; chips.forEach(x => x.setAttribute('aria-pressed', String(x === c))); aplicar(); }));
      if (inicial) aplicar();
    },

    produto() {
      const raiz = $('.produto'), id = Number(raiz.dataset.id), campo = $('[data-qtd]');
      if (campo) {
        const ajustar = d => { campo.value = Math.max(1, Math.min(Number(campo.max) || 99, (parseInt(campo.value, 10) || 1) + d)); };
        $('[data-menos]').addEventListener('click', () => ajustar(-1)); $('[data-mais]').addEventListener('click', () => ajustar(1));
        campo.addEventListener('change', () => ajustar(0));
      }
      if (raiz.dataset.controlado === '1') api('/api/estoque?ids=' + id).then(e => {
        const n = e[id]; if (n == null) return;
        if (n <= 0) { $('[data-esgotado]').hidden = false; $('[data-compra]')?.setAttribute('hidden', ''); }
        else { if (campo) campo.max = n; if (n <= 5) { const el = $('[data-estoque-info]'); el.textContent = `Restam ${n} unidade${n > 1 ? 's' : ''}.`; el.hidden = false; } }
      }).catch(() => {});
    },

    async carrinho() {
      const cat = await catalogo();
      const el = { itens: $('[data-itens]'), vazio: $('[data-vazio-carrinho]'), cont: $('[data-conteudo-carrinho]'), erro: $('[data-erro]'), opcoes: $('[data-opcoes]'), cep: $('#cep'),
        sub: $('[data-subtotal]'), fr: $('[data-frete]'), tot: $('[data-total]'), go: $('[data-continuar]') };
      let cotacao = null, escolhida = ls.ler('arpint.frete', null), seq = 0;
      ligarMascara(el.cep, mascaraCep);
      if (escolhida?.cep) el.cep.value = mascaraCep(escolhida.cep);

      function itensValidos() { const todos = Carrinho.itens(), ok = todos.filter(i => cat.has(i.id)); if (ok.length !== todos.length) { Carrinho.salvar(ok); toast('Alguns itens saíram do catálogo e foram removidos.'); } return ok; }
      const subtotal = l => l.reduce((s, i) => s + (cat.get(i.id).p || 0) * i.qtd, 0);

      function desenhar() {
        const l = itensValidos();
        el.vazio.hidden = l.length > 0; el.cont.hidden = l.length === 0;
        limpar(el.itens);
        l.forEach(i => {
          const p = cat.get(i.id), campo = h('input', { type: 'number', min: 1, max: 99, value: i.qtd, inputmode: 'numeric', 'aria-label': 'Quantidade', onchange: () => Carrinho.definir(i.id, parseInt(campo.value, 10) || 1) });
          el.itens.append(h('div', { class: 'item-carrinho' },
            h('div', { class: 'foto' }, h('img', { src: p.m, alt: p.n, width: 84, height: 84, loading: 'lazy', referrerpolicy: 'no-referrer' })),
            h('div', { class: 'meio' }, h('a', { href: `/produto/${p.s}/` }, p.n),
              h('div', { class: 'qtd' }, h('button', { type: 'button', 'aria-label': 'Diminuir', onclick: () => Carrinho.definir(i.id, i.qtd - 1) }, '−'), campo, h('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => Carrinho.definir(i.id, i.qtd + 1) }, '+')),
              h('button', { class: 'link-btn', type: 'button', onclick: () => Carrinho.remover(i.id) }, 'Remover')),
            h('strong', null, brl(p.p * i.qtd))));
        });
        totais();
      }
      function totais() {
        const sub = subtotal(itensValidos()), op = cotacao?.opcoes.find(o => o.id === escolhida?.id);
        el.sub.textContent = brl(sub);
        el.fr.textContent = op ? (op.precoCent ? brl(op.precoCent) : 'Grátis') : 'Calcule pelo CEP';
        el.tot.textContent = brl(sub + (op ? op.precoCent : 0));
        el.go.setAttribute('aria-disabled', String(!op));
      }
      function mostrarOpcoes() {
        limpar(el.opcoes);
        if (!cotacao) return;
        if (cotacao.demo) el.opcoes.append(h('span', { class: 'selo' }, 'Frete simulado (demonstração)'));
        cotacao.opcoes.forEach(o => {
          const prazo = o.id === 'retirada' ? (o.endereco || 'Sem custo de frete') : (o.prazoMax ? `${o.prazoMin === o.prazoMax ? o.prazoMax : o.prazoMin + ' a ' + o.prazoMax} dias úteis` : '');
          const r = h('input', { type: 'radio', name: 'frete', value: o.id, checked: escolhida?.id === o.id, onchange: () => { escolhida = { cep: digitos(el.cep.value), id: o.id }; ls.gravar('arpint.frete', escolhida); totais(); } });
          el.opcoes.append(h('label', { class: 'opcao' }, r, h('span', null, o.nome, h('small', null, prazo)), h('strong', null, o.precoCent ? brl(o.precoCent) : 'Grátis')));
        });
      }
      async function cotar(silencioso) {
        const cep = digitos(el.cep.value), l = itensValidos(); el.erro.textContent = '';
        if (cep.length !== 8) { if (!silencioso) el.erro.textContent = 'Digite um CEP com 8 números.'; return; }
        if (!l.length) return;
        const meu = ++seq;
        try {
          const r = await api('/api/frete', { cep, itens: l });
          if (meu !== seq) return;
          cotacao = r;
          if (!r.opcoes.some(o => o.id === escolhida?.id)) escolhida = { cep, id: r.opcoes[0].id };      // pré-seleciona a mais barata
          escolhida.cep = cep; ls.gravar('arpint.frete', escolhida);
          mostrarOpcoes(); totais();
        } catch (e) { if (meu === seq) { cotacao = null; limpar(el.opcoes); el.erro.textContent = e.message; totais(); } }
      }
      $('[data-form-cep]').addEventListener('submit', e => { e.preventDefault(); cotar(false); });
      el.go.addEventListener('click', e => { if (el.go.getAttribute('aria-disabled') === 'true') { e.preventDefault(); el.erro.textContent = 'Calcule o frete e escolha uma opção para continuar.'; el.cep.focus(); } });
      let t; document.addEventListener('carrinho', () => { desenhar(); clearTimeout(t); t = setTimeout(() => cotar(true), 400); });
      desenhar(); if (escolhida?.cep) cotar(true);
    },

    async checkout() {
      const cat = await catalogo(), form = $('[data-form-checkout]'), erro = $('[data-erro]'), botao = $('[data-enviar]');
      const itens = Carrinho.itens().filter(i => cat.has(i.id)), salvo = ls.ler('arpint.frete', null);
      if (!itens.length || !salvo?.id || digitos(salvo.cep).length !== 8) { location.replace('/carrinho/'); return; }
      let opcao;
      try {
        const r = await api('/api/frete', { cep: salvo.cep, itens });
        opcao = r.opcoes.find(o => o.id === salvo.id);
        if (!opcao) { location.replace('/carrinho/'); return; }
        if (r.demo) $('[data-resumo]').before(h('span', { class: 'selo' }, 'Frete simulado'));
      } catch (e) { erro.textContent = e.message; botao.disabled = true; return; }
      const retirada = opcao.id === 'retirada';

      const sub = itens.reduce((s, i) => s + cat.get(i.id).p * i.qtd, 0), resumo = $('[data-resumo]');
      itens.forEach(i => resumo.append(h('div', { class: 'linha-valor' }, h('span', null, `${i.qtd}× ${cat.get(i.id).n}`), h('span', null, brl(cat.get(i.id).p * i.qtd)))));
      resumo.append(h('div', { class: 'linha-valor' }, h('span', null, `Frete (${opcao.nome})`), h('span', null, opcao.precoCent ? brl(opcao.precoCent) : 'Grátis')),
        h('div', { class: 'linha-valor total' }, h('span', null, 'Total'), h('span', null, brl(sub + opcao.precoCent))));

      const f = id => $('#' + id, form);
      ligarMascara(f('cep'), mascaraCep); ligarMascara(f('fone'), mascaraFone); ligarMascara(f('doc'), mascaraDoc);
      f('uf').addEventListener('input', () => { f('uf').value = f('uf').value.toUpperCase().replace(/[^A-Z]/g, ''); });
      if (retirada) { $('[data-bloco-entrega]').hidden = true; $('[data-aviso-retirada]').hidden = false; $$('[data-bloco-entrega] input').forEach(i => { i.required = false; }); }
      else {
        f('cep').value = mascaraCep(salvo.cep); f('cep').readOnly = true;                    // o frete foi calculado para este CEP; para mudar, volte ao carrinho
        f('cep').title = 'Para mudar o CEP, volte ao carrinho';
        fetch(`https://viacep.com.br/ws/${digitos(salvo.cep)}/json/`).then(r => r.json()).then(d => {
          if (d.erro) return; if (d.logradouro) f('rua').value = d.logradouro; if (d.bairro) f('bairro').value = d.bairro; if (d.localidade) f('cidade').value = d.localidade; if (d.uf) f('uf').value = d.uf;
          (f('rua').value ? f('numero') : f('rua')).focus();
        }).catch(() => {});
      }
      const salvoCli = ls.ler('arpint.cliente', null); if (salvoCli) ['nome', 'email', 'fone', 'doc'].forEach(k => { if (salvoCli[k]) f(k).value = salvoCli[k]; });

      form.addEventListener('submit', async e => {
        e.preventDefault(); erro.textContent = '';
        if (!form.reportValidity()) return;
        botao.disabled = true; botao.textContent = 'Aguarde…';
        const cliente = { nome: f('nome').value, email: f('email').value, fone: f('fone').value, doc: f('doc').value };
        try {
          const r = await api('/api/checkout', { itens, freteId: opcao.id, cliente,
            endereco: retirada ? null : { cep: f('cep').value, rua: f('rua').value, numero: f('numero').value, complemento: f('complemento').value, bairro: f('bairro').value, cidade: f('cidade').value, uf: f('uf').value } });
          ls.gravar('arpint.cliente', cliente);
          location.assign(r.url);
        } catch (err) { erro.textContent = err.message; botao.disabled = false; botao.textContent = 'Ir para o pagamento'; }
      });
      if (new URLSearchParams(location.search).get('pagamento') === 'falhou') erro.textContent = 'O pagamento não foi concluído. Confira os dados e tente de novo.';
    },

    async sucesso() {
      const q = new URLSearchParams(location.search), codigo = q.get('pedido'), t = q.get('t');
      const caixa = $('[data-status]'), titulo = $('[data-titulo]'), texto = $('[data-texto]'), marca = $('.marca', caixa), cod = $('[data-codigo]');
      const estado = (cls, icone, tit, txt) => { caixa.className = 'caixa status ' + cls; marca.textContent = icone; titulo.textContent = tit; texto.textContent = txt; };
      if (!codigo || !t) { estado('ruim', '?', 'Pedido não encontrado', 'Abra esta página pelo link que você recebeu ao finalizar o pedido.'); return; }
      const a = $('[data-wa]'); try { const u = new URL(a.href); u.searchParams.set('text', `Olá! Quero falar sobre o pedido ${codigo}.`); a.href = u.href; } catch {}
      cod.textContent = codigo; cod.hidden = false;
      async function ver(tentativa) {
        let p;
        try { p = await api(`/api/pedido?codigo=${encodeURIComponent(codigo)}&t=${encodeURIComponent(t)}`); }
        catch (e) { estado('ruim', '!', 'Não conseguimos ver o pedido', e.message); return; }
        if (p.status === 'pago') { estado('ok', '✓', 'Pagamento confirmado', 'Recebemos o seu pagamento. Vamos separar o pedido e preparar o envio. Qualquer novidade a gente avisa pelo WhatsApp e e-mail.'); Carrinho.limpar(); }
        else if (p.status === 'recusado') estado('ruim', '✕', 'Pagamento não aprovado', 'O pagamento não foi concluído. Seus itens continuam no carrinho para você tentar de novo.');
        else { estado('', '…', 'Aguardando confirmação do pagamento', 'Assim que o pagamento for confirmado (o Pix costuma cair na hora), preparamos o envio. Esta página atualiza sozinha.'); Carrinho.limpar(); if (tentativa < 24) setTimeout(() => ver(tentativa + 1), 5000); }
        const box = $('[data-resumo-pedido]'); limpar(box).hidden = false;
        box.append(h('h2', null, 'Resumo do pedido'), ...p.itens.map(i => h('div', { class: 'linha-valor' }, h('span', null, `${i.qtd}× ${i.nome}`), h('span', null, brl(i.precoCent * i.qtd)))),
          h('div', { class: 'linha-valor' }, h('span', null, `Frete (${p.frete.nome})`), h('span', null, p.frete.precoCent ? brl(p.frete.precoCent) : 'Grátis')),
          h('div', { class: 'linha-valor total' }, h('span', null, 'Total'), h('span', null, brl(p.totalCent))));
      }
      ver(0);
    },

    async 'pagamento-demo'() {
      const q = new URLSearchParams(location.search), codigo = q.get('pedido'), t = q.get('t'), erro = $('[data-erro]'), resumo = $('[data-resumo]');
      $$('[data-resultado]').forEach(b => { b.disabled = true; });
      try {
        const p = await api(`/api/pedido?codigo=${encodeURIComponent(codigo)}&t=${encodeURIComponent(t)}`);
        resumo.append(h('p', { class: 'suave' }, `Pedido ${p.codigo}`), ...p.itens.map(i => h('div', { class: 'linha-valor' }, h('span', null, `${i.qtd}× ${i.nome}`), h('span', null, brl(i.precoCent * i.qtd)))),
          h('div', { class: 'linha-valor total' }, h('span', null, 'Total'), h('span', null, brl(p.totalCent))));
        $$('[data-resultado]').forEach(b => { b.disabled = false; });
      } catch (e) { erro.textContent = e.message; return; }
      $$('[data-resultado]').forEach(b => b.addEventListener('click', async () => {
        $$('[data-resultado]').forEach(x => { x.disabled = true; }); erro.textContent = '';
        try { await api('/api/demo-pagar', { codigo, t, resultado: b.dataset.resultado }); location.assign(`/sucesso/?pedido=${encodeURIComponent(codigo)}&t=${encodeURIComponent(t)}`); }
        catch (e) { erro.textContent = e.message; $$('[data-resultado]').forEach(x => { x.disabled = false; }); }
      }));
    }
  };
  const pagina = $('main')?.dataset.pagina;
  if (paginas[pagina]) paginas[pagina]();
})();
