/* ===== PAINEL DA NOCA DOCES ===== */
(function () {
  const cfg = window.NOCA_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  // aviso rápido
  let tAviso;
  function dizer(msg, erro) {
    const a = $('aviso');
    a.textContent = msg;
    a.className = 'a-aviso visivel' + (erro ? ' erro' : '');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => { a.className = 'a-aviso'; }, 3500);
  }

  if (!window.supabase || !cfg.url || cfg.url.indexOf('SEU-PROJETO') !== -1) {
    $('login-erro').textContent = 'Painel ainda não configurado: preencha o config.js (veja o ADMIN-SETUP.md).';
    $('login-form').querySelector('button').disabled = true;
    return;
  }
  const db = window.supabase.createClient(cfg.url, cfg.chave);

  // cria elementos sem usar innerHTML (evita injeção de texto)
  function el(tag, attrs, ...filhos) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'for') n.htmlFor = v;
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    });
    n.append(...filhos);
    return n;
  }
  const valor = (id) => $(id).value.trim();
  const LINK_OK = /^(https?:\/\/|tel:|mailto:|#)/i;

  /* ---------- Login ---------- */
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-erro').textContent = '';
    const { error } = await db.auth.signInWithPassword({ email: valor('l-email'), password: $('l-senha').value });
    if (error) { $('login-erro').textContent = 'E-mail ou senha incorretos.'; return; }
    entrar();
  });
  $('sair').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });

  function entrar() {
    $('login').hidden = true;
    $('painel').hidden = false;
    carregarPromo();
    carregarCardapio();
    carregarFeedbacks();
    carregarNovos();
    ir('s-dashboard');
  }
  db.auth.getSession().then(({ data }) => { if (data.session) entrar(); });

  /* ---------- Promoção ---------- */
  let imagemUrl = '';

  function desenharImagem() {
    $('p-prev').hidden = !imagemUrl;
    if (imagemUrl) $('p-prev').src = imagemUrl;
    $('p-remover-img').hidden = !imagemUrl;
  }

  async function carregarPromo() {
    const { data, error } = await db.from('promo').select('*').eq('id', 1).maybeSingle();
    if (error) return dizer('Não consegui carregar a promoção.', true);
    const p = data || {};
    $('p-ativo').checked = !!p.ativo;
    $('p-titulo').value = p.titulo || '';
    $('p-texto').value = p.texto || '';
    $('p-botao').value = p.botao_texto || '';
    $('p-link').value = p.botao_link || '';
    $('p-inicio').value = p.inicio || '';
    $('p-fim').value = p.fim || '';
    imagemUrl = p.imagem_url || '';
    desenharImagem();
  }

  $('p-arquivo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return dizer('Use uma imagem PNG, JPG, WEBP ou GIF.', true);
    if (f.size > 3 * 1024 * 1024) return dizer('A imagem deve ter até 3 MB.', true);
    const ext = f.type.split('/')[1].replace('jpeg', 'jpg');
    const caminho = 'promo/promo-' + Date.now() + '.' + ext;
    dizer('Enviando imagem...');
    const { error } = await db.storage.from('imagens').upload(caminho, f, { contentType: f.type, cacheControl: '3600' });
    if (error) return dizer('Erro ao enviar a imagem.', true);
    imagemUrl = db.storage.from('imagens').getPublicUrl(caminho).data.publicUrl;
    desenharImagem();
    e.target.value = '';
    dizer('Imagem enviada. Clique em "Salvar promoção" para publicar.');
  });
  $('p-remover-img').addEventListener('click', () => { imagemUrl = ''; desenharImagem(); });

  $('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reg = {
      id: 1,
      ativo: $('p-ativo').checked,
      titulo: valor('p-titulo') || null,
      texto: valor('p-texto') || null,
      botao_texto: valor('p-botao') || null,
      botao_link: valor('p-link') || null,
      imagem_url: imagemUrl || null,
      inicio: $('p-inicio').value || null,
      fim: $('p-fim').value || null
    };
    if (reg.botao_link && !LINK_OK.test(reg.botao_link)) return dizer('O link do botão deve começar com https://', true);
    if (reg.inicio && reg.fim && reg.fim < reg.inicio) return dizer('A data final está antes da inicial.', true);
    if (reg.ativo && !reg.titulo && !reg.texto) return dizer('Escreva um título ou um texto para o banner.', true);
    const { error } = await db.from('promo').upsert(reg);
    if (error) return dizer('Não foi possível salvar. Verifique se você está logada.', true);
    dizer('Promoção salva!');
  });

  /* ---------- Cardápio ---------- */
  let cats = [];
  let prods = [];

  async function carregarCardapio() {
    const [c, p] = await Promise.all([
      db.from('categorias').select('*').order('ordem'),
      db.from('produtos').select('*').order('ordem').order('id')
    ]);
    if (c.error || p.error) return dizer('Não consegui carregar o cardápio.', true);
    cats = c.data;
    prods = p.data;
    desenharCardapio();
  }

  function desenharCardapio() {
    const raiz = $('cats');
    raiz.replaceChildren();
    cats.forEach((c) => { const s = secaoCategoria(c); s.dataset.slug = c.slug; raiz.appendChild(s); });
    if (!cats.some((c) => c.slug === abaProd)) abaProd = cats[0] ? cats[0].slug : '';
    atualizarProdutos();
  }

  /* ----- Produtos: abas por categoria, resumo e busca ----- */
  let abaProd = '';
  const linhasDe = (sec) => [...sec.querySelectorAll('.a-linha')];
  function atualizarProdutos() {
    const todas = linhasDe($('cats'));
    const conta = (f) => todas.filter(f).length;
    const card = (rot, val, cor) => el('div', { class: 'a-stat' }, el('span', { class: 'a-leg' }, rot), el('b', { style: 'color:' + cor }, String(val)));
    $('prod-cards').replaceChildren(
      card('Itens no cardápio', todas.length, 'var(--txt)'),
      card('Visíveis no site', conta((r) => r.querySelector('.f-ativo').checked), '#1a7f45'),
      card('Em promoção', conta((r) => r.querySelector('.f-promo').value.trim() !== ''), '#ff5a00'),
      card('Em destaque', conta((r) => r.querySelector('.f-destaque').checked), '#2e7cc4'));
    const barra = $('prod-abas'); barra.replaceChildren();
    [...$('cats').children].forEach((sec) => {
      const b = el('button', { type: 'button', class: 'a-tab' + (sec.dataset.slug === abaProd ? ' ativo' : ''), role: 'tab' },
        sec.querySelector('h2').textContent, el('small', {}, String(linhasDe(sec).length)));
      b.addEventListener('click', () => { abaProd = sec.dataset.slug; $('prod-busca').value = ''; mostrarProdutos(); });
      barra.appendChild(b);
    });
    mostrarProdutos();
  }
  function mostrarProdutos() {
    const q = $('prod-busca').value.trim().toLowerCase();
    [...$('cats').children].forEach((sec) => {
      let achou = 0;
      linhasDe(sec).forEach((r) => {
        const bate = !q || !r.querySelector('.f-nome').value.trim() || (r.querySelector('.f-nome').value + ' ' + r.querySelector('.f-desc').value).toLowerCase().includes(q);
        r.hidden = !bate; if (bate) achou++;
      });
      sec.hidden = q ? !achou : sec.dataset.slug !== abaProd;
    });
    [...$('prod-abas').children].forEach((b, i) => b.classList.toggle('ativo', !q && $('cats').children[i].dataset.slug === abaProd));
  }
  $('prod-busca').addEventListener('input', () => mostrarProdutos());
  // o resumo acompanha as edições (digitar, marcar caixas, adicionar ou excluir itens) sem precisar salvar
  ['input', 'change'].forEach((ev) => $('cats').addEventListener(ev, () => { clearTimeout(tResumo); tResumo = setTimeout(atualizarProdutos, 250); }));
  let tResumo;
  new MutationObserver(() => { clearTimeout(tResumo); tResumo = setTimeout(atualizarProdutos, 50); }).observe($('cats'), { childList: true, subtree: true });

  function secaoCategoria(c) {
    const sec = el('section', { class: 'a-card a-cat' });
    sec.appendChild(el('h2', {}, c.titulo));

    // preços da categoria
    const temAtacado = c.preco_base != null || c.granel != null;
    if (temAtacado) {
      const caixa = el('div', { class: 'a-atacado' });
      caixa.appendChild(el('p', { class: 'a-sub' }, 'Texto sob o título: "Unidade R$ X · 50 und · 100 und". O atacado vale a partir de 50 unidades.'));
      caixa.append(
        el('label', {}, 'Preço da unidade (R$)', el('input', { type: 'number', min: '0', step: '0.01', class: 'c-base', value: c.preco_base ?? '' })),
        el('label', {}, 'Preço por unidade no atacado (R$)', el('input', { type: 'number', min: '0', step: '0.01', class: 'c-granel', value: c.granel ?? '' }))
      );
      sec.appendChild(caixa);
    } else {
      const caixa = el('div', { class: 'a-atacado' });
      caixa.appendChild(el('label', { class: 'a-tudo' }, 'Texto sob o título da aba', el('input', { type: 'text', maxLength: 120, class: 'c-info', value: c.info || '' })));
      sec.appendChild(caixa);
    }

    const lista = el('div', { class: 'a-linhas' });
    prods.filter((p) => p.categoria === c.slug).forEach((p) => lista.appendChild(linha(p)));
    sec.appendChild(lista);

    const acoes = el('div', { class: 'a-acoes' });
    const add = el('button', { type: 'button', class: 'a-btn a-btn-claro' }, '+ Adicionar item');
    add.addEventListener('click', () => {
      const nova = linha({ categoria: c.slug, nome: '', descricao: '', preco: temAtacado && c.preco_base ? c.preco_base : 3, ativo: true, destaque: false });
      lista.appendChild(nova);
      nova.querySelector('.f-nome').focus();
    });
    acoes.append(add);
    sec.appendChild(acoes);
    return sec;
  }

  function linha(p) {
    const r = el('div', { class: 'a-linha' + (p.destaque ? ' destaque' : '') + (p.ativo === false ? ' oculto' : '') });
    r._orig = { id: p.id || null, nome: p.nome || '', descricao: p.descricao || '', pedido: p.pedido || null, categoria: p.categoria };

    const nome = el('input', { type: 'text', class: 'f-nome', value: p.nome || '', maxLength: 80, placeholder: 'Ex.: Raiz' });
    const desc = el('input', { type: 'text', class: 'f-desc', value: p.descricao || '', maxLength: 100, placeholder: 'Ex.: Brigadeiro tradicional' });
    const preco = el('input', { type: 'number', class: 'f-preco', min: '0', step: '0.01', value: p.preco ?? '', placeholder: '0,00' });
    // preço promocional (opcional): se preenchido, o site mostra o preço normal riscado e este como preço novo
    const promo = el('input', { type: 'number', class: 'f-promo', min: '0', step: '0.01', value: p.preco_promo ?? '', placeholder: 'sem promoção' });
    const campo = (cls, legenda, input) => el('label', { class: 'a-campo ' + cls }, el('span', { class: 'a-leg' }, legenda), input);

    const visivel = el('input', { type: 'checkbox', class: 'f-ativo', checked: p.ativo !== false });
    const destaque = el('input', { type: 'checkbox', class: 'f-destaque', checked: !!p.destaque });
    visivel.addEventListener('change', () => r.classList.toggle('oculto', !visivel.checked));
    destaque.addEventListener('change', () => r.classList.toggle('destaque', destaque.checked));

    const sobe = el('button', { type: 'button', class: 'a-mini', title: 'Subir', 'aria-label': 'Subir item' }, '↑');
    const desce = el('button', { type: 'button', class: 'a-mini', title: 'Descer', 'aria-label': 'Descer item' }, '↓');
    sobe.addEventListener('click', () => { const a = r.previousElementSibling; if (a) r.parentNode.insertBefore(r, a); });
    desce.addEventListener('click', () => { const b = r.nextElementSibling; if (b) r.parentNode.insertBefore(b, r); });

    const excluir = el('button', { type: 'button', class: 'a-link' }, 'Excluir');
    excluir.addEventListener('click', () => excluirItem(r));

    const opcoes = el('div', { class: 'a-opcoes' },
      el('label', {}, visivel, 'Visível'),
      el('label', {}, destaque, 'Destaque'),
      sobe, desce, excluir
    );
    r.append(
      campo('c-nome', 'Nome', nome),
      campo('c-desc', 'Descrição', desc),
      campo('c-preco', 'Preço normal (R$)', preco),
      campo('c-promo', 'Preço promocional (R$)', promo),
      opcoes
    );
    return r;
  }

  async function excluirItem(r) {
    const nome = r.querySelector('.f-nome').value.trim() || 'este item';
    if (!confirm('Excluir "' + nome + '" do cardápio? Não dá para desfazer.\n\nDica: para só esconder, desmarque "Visível".')) return;
    if (r._orig.id) {
      const { error } = await db.from('produtos').delete().eq('id', r._orig.id);
      if (error) return dizer('Não foi possível excluir.', true);
      prods = prods.filter((p) => p.id !== r._orig.id);
    }
    r.remove();
    dizer('Item excluído.');
  }

  const numero = (txt) => { const n = parseFloat(String(txt).replace(',', '.')); return Number.isFinite(n) ? n : null; };

  // lê e valida uma categoria; devolve os dados para gravar (ou null, já avisando o erro na tela)
  function coletarCategoria(c, sec) {
    const invalido = (msg) => { dizer(msg, true); return null; };
    const linhas = [...sec.querySelectorAll('.a-linha')];
    const existentes = [], novos = [], novasLinhas = [];

    for (let i = 0; i < linhas.length; i++) {
      const r = linhas[i];
      const nome = r.querySelector('.f-nome').value.trim();
      const preco = numero(r.querySelector('.f-preco').value);
      if (!nome) return invalido('Há um item sem nome (linha ' + (i + 1) + ' de ' + c.titulo + ').');
      if (preco === null || preco < 0) return invalido('Preço inválido em "' + nome + '".');
      const promoTxt = r.querySelector('.f-promo').value.trim();
      const promo = promoTxt === '' ? null : numero(promoTxt);
      if (promoTxt !== '' && (promo === null || promo < 0)) return invalido('Preço promocional inválido em "' + nome + '".');
      if (promo !== null && promo >= preco) return invalido('Em "' + nome + '", o preço promocional deve ser menor que o preço normal.');
      const descricao = r.querySelector('.f-desc').value.trim();
      const mudou = nome !== r._orig.nome || descricao !== r._orig.descricao;
      const reg = {
        categoria: c.slug,
        nome,
        descricao: descricao || null,
        preco,
        preco_promo: promo,
        destaque: r.querySelector('.f-destaque').checked,
        ativo: r.querySelector('.f-ativo').checked,
        ordem: i + 1,
        pedido: mudou ? null : r._orig.pedido   // se renomeou, o texto do WhatsApp passa a ser "Nome (descrição)"
      };
      if (r._orig.id) { reg.id = r._orig.id; existentes.push(reg); } else { novos.push(reg); novasLinhas.push(r); }
    }

    // dados da categoria (preço de atacado ou texto informativo)
    const upCat = {};
    if (sec.querySelector('.c-base')) {
      upCat.preco_base = numero(sec.querySelector('.c-base').value);
      upCat.granel = numero(sec.querySelector('.c-granel').value);
    } else if (sec.querySelector('.c-info')) {
      upCat.info = sec.querySelector('.c-info').value.trim() || null;
    }
    return { c, existentes, novos, novasLinhas, upCat };
  }

  // grava uma categoria já validada; devolve o erro (ou null se deu certo)
  async function gravarCategoria(d) {
    const r1 = Object.keys(d.upCat).length ? await db.from('categorias').update(d.upCat).eq('slug', d.c.slug) : { error: null };
    if (r1.error) return r1.error;
    const r2 = d.existentes.length ? await db.from('produtos').upsert(d.existentes) : { error: null };
    if (r2.error) return r2.error;
    if (d.novos.length) {
      const r3 = await db.from('produtos').insert(d.novos).select('id');
      if (r3.error) return r3.error;
      // os itens novos agora já existem: se outra categoria falhar e você tentar de novo, eles não duplicam
      (r3.data || []).forEach((row, i) => { if (d.novasLinhas[i]) d.novasLinhas[i]._orig.id = row.id; });
    }
    return null;
  }

  // botão único: valida TODAS as categorias antes de gravar qualquer coisa
  async function salvarTudo(botao) {
    const secoes = [...$('cats').children];
    const dados = [];
    for (let i = 0; i < secoes.length; i++) {
      const d = coletarCategoria(cats[i], secoes[i]);
      if (!d) return;
      dados.push(d);
    }
    botao.disabled = true;
    try {
      for (const d of dados) {
        const falha = await gravarCategoria(d);
        if (falha) throw falha;
      }
      dizer('Cardápio salvo!');
      await carregarCardapio();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      dizer('Não foi possível salvar: ' + ((err && err.message) || 'erro desconhecido'), true);
    } finally {
      botao.disabled = false;
    }
  }

  $('salvar-tudo').addEventListener('click', () => salvarTudo($('salvar-tudo')));

  /* ---------- Feedbacks ---------- */
  let fbs = [];

  async function carregarFeedbacks() {
    const { data, error } = await db.from('feedbacks').select('*').order('ordem').order('id');
    if (error) return dizer('Não consegui carregar os feedbacks. Você já rodou o supabase-feedbacks.sql?', true);
    fbs = data;
    desenharFeedbacks();
  }

  function desenharFeedbacks() {
    const raiz = $('fb-lista');
    raiz.replaceChildren();
    if (!fbs.length) raiz.appendChild(el('p', { class: 'a-dica' }, 'Nenhum feedback cadastrado ainda. Enquanto a lista estiver vazia, o site mostra depoimentos de exemplo.'));
    fbs.forEach((f) => raiz.appendChild(linhaFb(f)));
  }

  function linhaFb(f) {
    const r = el('div', { class: 'a-fb' + (f.ativo === false ? ' oculto' : '') });
    r._id = f.id || null;
    r._foto = f.foto_url || '';

    // foto (ou inicial do nome)
    const nome = el('input', { type: 'text', class: 'f-nome', value: f.nome || '', maxLength: 60, placeholder: 'Ex.: Maria Souza' });
    const ocasiao = el('input', { type: 'text', class: 'f-ocasiao', value: f.ocasiao || '', maxLength: 60, placeholder: 'Ex.: Aniversário' });
    const estrelas = el('select', { class: 'f-estrelas' });
    [5, 4, 3, 2, 1].forEach((n) => estrelas.appendChild(el('option', { value: String(n) }, n + (n === 1 ? ' estrela' : ' estrelas'))));
    estrelas.value = String(f.estrelas || 5);
    const texto = el('textarea', { class: 'f-texto', rows: 3, maxLength: 300, placeholder: 'O que o cliente falou sobre os docinhos' });
    texto.value = f.texto || '';

    const foto = el('div', { class: 'a-fb-foto' });
    const arquivo = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    const trocar = el('button', { type: 'button', class: 'a-link' }, 'Escolher foto');
    const tirar = el('button', { type: 'button', class: 'a-link' }, 'Remover foto');
    function desenharFoto() {
      foto.replaceChildren();
      if (r._foto) foto.appendChild(el('img', { class: 'a-fb-img', src: r._foto, alt: 'Foto do cliente' }));
      else foto.appendChild(el('span', { class: 'a-fb-ini', 'aria-hidden': 'true' }, (nome.value.trim().charAt(0) || '?').toUpperCase()));
      foto.append(trocar, arquivo);
      if (r._foto) foto.appendChild(tirar);
    }
    nome.addEventListener('input', () => { if (!r._foto) desenharFoto(); });
    trocar.addEventListener('click', () => arquivo.click());
    tirar.addEventListener('click', () => { r._foto = ''; desenharFoto(); });
    arquivo.addEventListener('change', async () => {
      const a = arquivo.files[0];
      if (!a) return;
      if (!/^image\/(png|jpeg|webp)$/.test(a.type)) return dizer('Use uma foto PNG, JPG ou WEBP.', true);
      if (a.size > 2 * 1024 * 1024) return dizer('A foto deve ter até 2 MB.', true);
      const ext = a.type.split('/')[1].replace('jpeg', 'jpg');
      const caminho = 'feedbacks/cliente-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
      dizer('Enviando foto...');
      const { error } = await db.storage.from('imagens').upload(caminho, a, { contentType: a.type, cacheControl: '3600' });
      if (error) return dizer('Erro ao enviar a foto.', true);
      r._foto = db.storage.from('imagens').getPublicUrl(caminho).data.publicUrl;
      desenharFoto();
      dizer('Foto enviada. Clique em "Salvar feedbacks" para publicar.');
    });
    desenharFoto();

    const visivel = el('input', { type: 'checkbox', class: 'f-ativo', checked: f.ativo !== false });
    visivel.addEventListener('change', () => r.classList.toggle('oculto', !visivel.checked));
    const sobe = el('button', { type: 'button', class: 'a-mini', title: 'Subir', 'aria-label': 'Subir feedback' }, '↑');
    const desce = el('button', { type: 'button', class: 'a-mini', title: 'Descer', 'aria-label': 'Descer feedback' }, '↓');
    sobe.addEventListener('click', () => { const a = r.previousElementSibling; if (a) r.parentNode.insertBefore(r, a); });
    desce.addEventListener('click', () => { const b = r.nextElementSibling; if (b) r.parentNode.insertBefore(b, r); });
    const excluir = el('button', { type: 'button', class: 'a-link' }, 'Excluir');
    excluir.addEventListener('click', () => excluirFb(r));

    const campo = (cls, legenda, input) => el('label', { class: 'a-campo ' + cls }, el('span', { class: 'a-leg' }, legenda), input);
    r.append(
      foto,
      campo('c-fb-nome', 'Nome do cliente', nome),
      campo('c-fb-oc', 'Ocasião (opcional)', ocasiao),
      campo('c-fb-est', 'Estrelas', estrelas),
      campo('c-fb-texto', 'Comentário', texto),
      el('div', { class: 'a-opcoes' }, el('label', {}, visivel, 'Visível'), sobe, desce, excluir)
    );
    return r;
  }

  async function excluirFb(r) {
    const nome = r.querySelector('.f-nome').value.trim() || 'este feedback';
    if (!confirm('Excluir o feedback de "' + nome + '"? Não dá para desfazer.\n\nDica: para só esconder, desmarque "Visível".')) return;
    if (r._id) {
      const { error } = await db.from('feedbacks').delete().eq('id', r._id);
      if (error) return dizer('Não foi possível excluir.', true);
      fbs = fbs.filter((x) => x.id !== r._id);
    }
    r.remove();
    dizer('Feedback excluído.');
  }

  $('fb-add').addEventListener('click', () => {
    const lista = $('fb-lista');
    if (!fbs.length && lista.querySelector('p.a-dica')) lista.replaceChildren();
    const nova = linhaFb({ nome: '', ocasiao: '', texto: '', estrelas: 5, ativo: true });
    lista.appendChild(nova);
    nova.querySelector('.f-nome').focus();
  });

  $('fb-salvar').addEventListener('click', async () => {
    const botao = $('fb-salvar');
    const linhas = [...$('fb-lista').querySelectorAll('.a-fb')];
    const existentes = [], novos = [];
    for (let i = 0; i < linhas.length; i++) {
      const r = linhas[i];
      const nome = r.querySelector('.f-nome').value.trim();
      const texto = r.querySelector('.f-texto').value.trim();
      if (!nome) return dizer('Há um feedback sem nome (item ' + (i + 1) + ').', true);
      if (!texto) return dizer('Escreva o comentário de "' + nome + '".', true);
      const reg = {
        nome,
        ocasiao: r.querySelector('.f-ocasiao').value.trim() || null,
        texto,
        estrelas: parseInt(r.querySelector('.f-estrelas').value, 10) || 5,
        foto_url: r._foto || null,
        ativo: r.querySelector('.f-ativo').checked,
        ordem: i + 1
      };
      if (r._id) { reg.id = r._id; existentes.push(reg); } else novos.push(reg);
    }
    botao.disabled = true;
    try {
      const r1 = existentes.length ? await db.from('feedbacks').upsert(existentes) : { error: null };
      const r2 = novos.length ? await db.from('feedbacks').insert(novos) : { error: null };
      const falha = r1.error || r2.error;
      if (falha) throw falha;
      dizer('Feedbacks salvos!');
      await carregarFeedbacks();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      dizer('Não foi possível salvar: ' + ((err && err.message) || 'erro desconhecido'), true);
    } finally {
      botao.disabled = false;
    }
  });

  /* ===== PAINEL NOVO: navegação, pedidos, estoque, financeiro, relatórios, clientes, configurações ===== */
  function ir(id) {
    document.querySelectorAll('.a-sec').forEach((s) => { s.hidden = s.id !== id; });
    document.querySelectorAll('.a-nav').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === id));
    $('app').classList.remove('aberto');
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.a-nav[data-aba]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.aba)));
  $('menu-abrir').addEventListener('click', () => $('app').classList.add('aberto'));
  $('scrim').addEventListener('click', () => $('app').classList.remove('aberto'));

  const STATUS = { novo: 'Novo', confirmado: 'Confirmado', producao: 'Em produção', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' };
  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dataBR = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
  const diaLocal = (ts) => iso(new Date(ts));
  const baixo = (x) => Number(x.minimo) > 0 && Number(x.quantidade) <= Number(x.minimo);
  const somar = (ls, f) => ls.reduce((s, x) => s + Number(f(x) || 0), 0);
  const campoE = (cls, leg, input) => el('label', { class: 'a-campo ' + cls }, el('span', { class: 'a-leg' }, leg), input);
  const vazioP = (txt) => el('p', { class: 'a-dica' }, txt);

  let pedidos = [], estoque = [], fin = [], cfgSite = {};

  async function carregarNovos() {
    db.auth.getSession().then(({ data }) => {
      const em = data.session && data.session.user.email; if (!em) return;
      const n = em.split('@')[0]; $('user-nome').textContent = n.charAt(0).toUpperCase() + n.slice(1); $('user-ini').textContent = n.charAt(0).toUpperCase();
    });
    const [p, e, f, c] = await Promise.all([
      db.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(1000),
      db.from('estoque').select('*').order('nome'),
      db.from('financeiro').select('*').order('data', { ascending: false }).order('id', { ascending: false }).limit(1000),
      db.from('configuracoes').select('*').eq('id', 1).maybeSingle()
    ]);
    if (p.error || e.error || f.error || c.error) dizer('Não consegui carregar pedidos, estoque ou financeiro. Você já rodou o supabase-painel.sql?', true);
    pedidos = p.data || []; estoque = e.data || []; fin = f.data || []; cfgSite = c.data || {};
    desenharNovos();
  }
  function desenharNovos() {
    dashboard(); listaPedidos(); listaEstoque(); listaFin(); relatorio(); listaClientes();
    $('cfg-whats').value = cfgSite.whatsapp || '';
  }

  /* ---------- Dashboard ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at, ...f) => { const n = document.createElementNS(NS, tag); Object.entries(at || {}).forEach(([k, v]) => n.setAttribute(k, v)); n.append(...f); return n; };
  function anel(pct) {
    const C = 2 * Math.PI * 34, p = Math.max(0, Math.min(100, Math.round(pct)));
    return sv('svg', { viewBox: '0 0 88 88', class: 'a-anel-svg', 'aria-hidden': 'true' },
      sv('circle', { cx: 44, cy: 44, r: 34, fill: 'none', stroke: '#e6dfd3', 'stroke-width': 9 }),
      sv('circle', { cx: 44, cy: 44, r: 34, fill: 'none', stroke: '#ff5a00', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-dasharray': (C * p / 100) + ' ' + C, transform: 'rotate(-90 44 44)' }),
      sv('text', { x: 44, y: 49, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#ff5a00' }, p + '%'));
  }
  let buscaPed = '';
  const naoCancel = () => pedidos.filter((p) => p.status !== 'cancelado');
  function noPeriodo(ls, per) {
    const hoje = iso(new Date());
    if (per === 'hoje') return ls.filter((p) => diaLocal(p.criado_em) === hoje);
    if (per === 'mes') return ls.filter((p) => diaLocal(p.criado_em).slice(0, 7) === hoje.slice(0, 7));
    const corte = iso(new Date(Date.now() - Number(per) * 86400000));
    return ls.filter((p) => diaLocal(p.criado_em) >= corte);
  }
  function desenharGrafico(raiz, rotulos, series) {
    const W = 640, H = 230, L = 62, R = 14, T = 12, B = 30, max = Math.max(1, ...series.flatMap((s) => s.v));
    const x = (i) => L + i * (W - L - R) / (rotulos.length - 1), y = (v) => T + (H - T - B) * (1 - v / max);
    const g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'a-grafico', role: 'img', 'aria-label': 'Gráfico de vendas dos últimos 6 meses' });
    for (let i = 0; i <= 4; i++) {
      const yy = T + (H - T - B) * i / 4;
      g.append(sv('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: '#e6dfd3', 'stroke-dasharray': '4 4' }),
        sv('text', { x: L - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--txt)', opacity: 0.7 }, brl(max * (4 - i) / 4).replace(',00', '')));
    }
    rotulos.forEach((r, i) => g.append(sv('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--txt)' }, r)));
    series.forEach((s, k) => {
      const pts = s.v.map((v, i) => [x(i), y(v)]);
      const linha = pts.map((p, i) => { if (!i) return 'M' + p[0] + ' ' + p[1]; const q = pts[i - 1], m = (q[0] + p[0]) / 2; return 'C' + m + ' ' + q[1] + ' ' + m + ' ' + p[1] + ' ' + p[0] + ' ' + p[1]; }).join(' ');
      const id = 'grad' + k;
      g.append(sv('defs', {}, sv('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: 0, 'stop-color': s.cor, 'stop-opacity': 0.3 }), sv('stop', { offset: 1, 'stop-color': s.cor, 'stop-opacity': 0 }))),
        sv('path', { d: linha + ' L' + pts[pts.length - 1][0] + ' ' + (H - B) + ' L' + pts[0][0] + ' ' + (H - B) + ' Z', fill: 'url(#' + id + ')' }),
        sv('path', { d: linha, fill: 'none', stroke: s.cor, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    });
    raiz.replaceChildren(g);
  }
  function dashboard() {
    const hr = new Date().getHours();
    $('d-ola').textContent = (hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite') + '!';
    const dt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('d-data').textContent = dt.charAt(0).toUpperCase() + dt.slice(1);
    const mes = iso(new Date()).slice(0, 7);
    const novos = pedidos.filter((p) => p.status === 'novo').length, lowN = estoque.filter(baixo).length;
    [['bd-ped', novos], ['bd-est', lowN], ['ico-bd', novos]].forEach(([id, n]) => { $(id).textContent = n; $(id).hidden = !n; });

    // cartões com anel
    const doMes = noPeriodo(naoCancel(), 'mes'), pct = (a, b) => (b ? a / b * 100 : 0);
    const fat = somar(fin.filter((f) => f.tipo === 'entrada' && String(f.data).slice(0, 7) === mes), (f) => f.valor);
    const cli = {};
    naoCancel().forEach((p) => { const k = (p.cliente_nome || 'Sem nome').trim().toLowerCase(); cli[k] = (cli[k] || 0) + 1; });
    const nCli = Object.keys(cli).length;
    const anelCard = (p, val, rot, sub) => el('div', { class: 'a-anelcard' }, anel(p), el('div', { class: 'a-sep' }), el('div', { class: 'a-anel-txt' }, el('b', {}, String(val)), el('span', {}, rot), el('small', { class: 'a-leg' }, sub)));
    $('d-cards').replaceChildren(
      anelCard(pct(doMes.filter((p) => p.status === 'entregue').length, doMes.length), doMes.length, 'Pedidos no mês', 'entregues'),
      anelCard(pct(doMes.filter((p) => p.pago).length, doMes.length), brl(fat), 'Recebido no mês', 'pedidos pagos'),
      anelCard(pct(Object.values(cli).filter((n) => n > 1).length, nCli), nCli, 'Clientes', 'voltaram a pedir'));

    // tabela de pedidos
    const tb = $('dp-lista'); tb.replaceChildren();
    const ls = noPeriodo(pedidos, $('dp-filtro').value).slice(0, 5);
    if (!ls.length) tb.appendChild(vazioP('Nenhum pedido neste período.'));
    ls.forEach((p) => {
      const its = Array.isArray(p.itens) ? p.itens : [], nome = its.length ? its[0].nome + (its.length > 1 ? ' +' + (its.length - 1) : '') : 'Pedido #' + p.id;
      const cls = p.status === 'entregue' ? 'd-ok' : p.status === 'cancelado' ? 'd-no' : 'd-and';
      const mais = el('button', { type: 'button', class: 'a-mais', 'aria-label': 'Ver pedido #' + p.id }, '⋮');
      mais.addEventListener('click', () => ir('s-pedidos'));
      tb.appendChild(el('div', { class: 'a-tb a-tb-l' }, el('span', {}, nome),
        el('span', { class: 'a-tb-data' }, new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
        el('span', {}, brl(p.total)), el('span', { class: 'a-dot ' + cls, title: STATUS[p.status], 'aria-label': STATUS[p.status] }), mais));
    });

    // mais vendidos (barras)
    const mapa = {};
    noPeriodo(naoCancel(), $('dt-filtro').value).forEach((p) => (Array.isArray(p.itens) ? p.itens : []).forEach((i) => { mapa[i.nome] = (mapa[i.nome] || 0) + (Number(i.qtd) || 0); }));
    const top = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 4), max = top.length ? top[0][1] : 1, bar = $('dt-barras'); bar.replaceChildren();
    if (!top.length) bar.appendChild(vazioP('Sem vendas no período.'));
    top.forEach(([n, q]) => bar.appendChild(el('div', { class: 'a-bcol' }, el('span', { class: 'a-bqtd' }, String(q)),
      el('div', { class: 'a-btrilho' }, el('div', { class: 'a-bfill', style: 'height:' + Math.max(6, Math.round(q / max * 100)) + '%' })), el('span', { class: 'a-bnome' }, n))));

    // melhores clientes
    const tc = {};
    naoCancel().forEach((p) => { const nome = (p.cliente_nome || 'Sem nome').trim(), k = nome.toLowerCase(), c = tc[k] || (tc[k] = { nome, n: 0, t: 0 }); c.n++; c.t += Number(p.total) || 0; });
    const melhores = Object.values(tc).sort((a, b) => b.t - a.t).slice(0, 3), box = $('dc-lista'); box.replaceChildren();
    if (!melhores.length) box.appendChild(vazioP('Os melhores clientes aparecem conforme chegam pedidos.'));
    melhores.forEach((c, i) => box.appendChild(el('div', { class: 'a-pessoa' }, el('span', { class: 'a-av', 'aria-hidden': 'true' }, c.nome.charAt(0).toUpperCase()),
      el('div', { class: 'a-pnome' }, c.nome, el('small', { class: 'a-leg' }, brl(c.t) + ' · ' + c.n + (c.n === 1 ? ' pedido' : ' pedidos'))), el('span', { class: 'a-medalha' }, String(i + 1)))));

    // vendas dos últimos 6 meses
    const agora = new Date(), meses = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1); meses.push({ k: iso(d).slice(0, 7), r: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }); }
    const vend = meses.map((m) => somar(naoCancel().filter((p) => diaLocal(p.criado_em).slice(0, 7) === m.k), (p) => p.total));
    const rec = meses.map((m) => somar(fin.filter((f) => f.tipo === 'entrada' && String(f.data).slice(0, 7) === m.k), (f) => f.valor));
    desenharGrafico($('dg-grafico'), meses.map((m) => m.r), [{ cor: '#ff5a00', v: vend }, { cor: '#2e7cc4', v: rec }]);
  }
  /* ----- tema claro / escuro (lembra a escolha neste navegador) ----- */
  const chave = $('tema');
  chave.setAttribute('aria-checked', String(document.documentElement.dataset.tema === 'escuro'));
  chave.addEventListener('click', () => {
    const escuro = chave.getAttribute('aria-checked') !== 'true';
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    chave.setAttribute('aria-checked', String(escuro));
    try { localStorage.setItem('noca-tema', escuro ? 'escuro' : 'claro'); } catch (e) {}
  });
  ['dp-filtro', 'dt-filtro'].forEach((id) => $(id).addEventListener('change', dashboard));
  $('ico-ped').addEventListener('click', () => ir('s-pedidos'));
  $('ico-cfg').addEventListener('click', () => ir('s-config'));
  $('top-busca').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    buscaPed = e.target.value.trim().toLowerCase(); $('ped-filtro').value = 'todos'; ir('s-pedidos'); listaPedidos();
  });

  /* ---------- Pedidos ---------- */
  const itensTxt = (p) => (Array.isArray(p.itens) ? p.itens : []).map((i) => i.qtd + '× ' + i.nome + (i.obs ? ' (' + i.obs + ')' : '')).join('; ');
  async function atualizarPedido(p, campos) {
    const { error } = await db.from('pedidos').update(campos).eq('id', p.id);
    if (error) { desenharNovos(); return dizer('Não foi possível atualizar o pedido.', true); }
    Object.assign(p, campos); desenharNovos();
  }
  // "Pago" lança (ou retira) a entrada no Financeiro
  async function marcarPago(p, v) {
    if (v) {
      const r = await db.from('financeiro').insert({ data: iso(new Date()), tipo: 'entrada', categoria: 'Pedido', descricao: 'Pedido #' + p.id + ' — ' + (p.cliente_nome || 'sem nome'), valor: p.total, pedido_id: p.id }).select().single();
      if (r.error) { desenharNovos(); return dizer('Não foi possível lançar no financeiro (total precisa ser maior que zero).', true); }
      fin.unshift(r.data);
    } else {
      const r = await db.from('financeiro').delete().eq('pedido_id', p.id);
      if (r.error) { desenharNovos(); return dizer('Não foi possível retirar o lançamento.', true); }
      fin = fin.filter((x) => x.pedido_id !== p.id);
    }
    atualizarPedido(p, { pago: v });
  }
  async function excluirPedido(p) {
    if (!confirm('Excluir o pedido #' + p.id + '? Se estiver pago, o lançamento no financeiro também sai. Não dá para desfazer.')) return;
    const { error } = await db.from('pedidos').delete().eq('id', p.id);
    if (error) return dizer('Não foi possível excluir.', true);
    pedidos = pedidos.filter((x) => x.id !== p.id); fin = fin.filter((x) => x.pedido_id !== p.id);
    desenharNovos(); dizer('Pedido excluído.');
  }
  function listaPedidos() {
    const f = $('ped-filtro').value, raiz = $('ped-lista'); raiz.replaceChildren();
    const ok = (p) => !buscaPed || ('#' + p.id + ' ' + (p.cliente_nome || '') + ' ' + itensTxt(p)).toLowerCase().includes(buscaPed);
    const ls = pedidos.filter(ok).filter((p) => f === 'todos' || (f === 'abertos' ? !['entregue', 'cancelado'].includes(p.status) : p.status === f));
    if (buscaPed) {
      const l = el('button', { type: 'button', class: 'a-link' }, 'Limpar busca');
      l.addEventListener('click', () => { buscaPed = ''; $('top-busca').value = ''; listaPedidos(); });
      raiz.appendChild(el('p', { class: 'a-dica' }, 'Mostrando pedidos com “' + buscaPed + '”. ', l));
    }
    if (!ls.length) raiz.appendChild(vazioP('Nenhum pedido aqui.'));
    ls.forEach((p) => {
      const st = el('select', {}); Object.entries(STATUS).forEach(([k, v]) => st.appendChild(el('option', { value: k }, v))); st.value = p.status;
      st.addEventListener('change', () => atualizarPedido(p, { status: st.value }));
      const pago = el('input', { type: 'checkbox', checked: !!p.pago }); pago.addEventListener('change', () => marcarPago(p, pago.checked));
      const ex = el('button', { type: 'button', class: 'a-link' }, 'Excluir'); ex.addEventListener('click', () => excluirPedido(p));
      raiz.appendChild(el('div', { class: 'a-ped' },
        el('div', { class: 'a-ped-t' }, el('b', {}, '#' + p.id + ' · ' + (p.cliente_nome || 'Sem nome')), el('span', {}, brl(p.total))),
        el('p', { class: 'a-dica' }, itensTxt(p) || '—'),
        el('p', { class: 'a-leg' }, 'Feito em ' + dataBR(diaLocal(p.criado_em)) + ' · Data desejada: ' + dataBR(p.data_desejada)),
        el('div', { class: 'a-opcoes' }, campoE('', 'Status', st), el('label', {}, pago, 'Pago'), ex)));
    });
  }
  $('ped-filtro').addEventListener('change', listaPedidos);

  /* ---------- Estoque ---------- */
  function linhaEst(x) {
    const r = el('div', { class: 'a-est' }); r._id = x.id || null;
    const nome = el('input', { type: 'text', class: 'e-nome', value: x.nome || '', maxLength: 80, placeholder: 'Ex.: Leite condensado' });
    const qtd = el('input', { type: 'number', class: 'e-qtd', min: '0', step: 'any', value: x.quantidade ?? '' });
    const un = el('input', { type: 'text', class: 'e-un', value: x.unidade || '', maxLength: 12, placeholder: 'kg, un, lata' });
    const min = el('input', { type: 'number', class: 'e-min', min: '0', step: 'any', value: x.minimo ?? '' });
    const marca = () => r.classList.toggle('baixo', baixo({ quantidade: numero(qtd.value), minimo: numero(min.value) }));
    qtd.addEventListener('input', marca); min.addEventListener('input', marca); marca();
    const ex = el('button', { type: 'button', class: 'a-link' }, 'Excluir');
    ex.addEventListener('click', async () => {
      if (!confirm('Excluir "' + (nome.value.trim() || 'este item') + '" do estoque?')) return;
      if (r._id) { const { error } = await db.from('estoque').delete().eq('id', r._id); if (error) return dizer('Não foi possível excluir.', true); estoque = estoque.filter((e) => e.id !== r._id); }
      r.remove(); dashboard();
    });
    r.append(campoE('c-e-nome', 'Item', nome), campoE('', 'Quantidade', qtd), campoE('', 'Unidade', un), campoE('', 'Avisar abaixo de', min), ex);
    return r;
  }
  function listaEstoque() {
    const raiz = $('est-lista'); raiz.replaceChildren();
    if (!estoque.length) raiz.appendChild(vazioP('Nenhum item cadastrado. Adicione ingredientes e embalagens para acompanhar o que está acabando.'));
    estoque.forEach((x) => raiz.appendChild(linhaEst(x)));
  }
  $('est-add').addEventListener('click', () => {
    const raiz = $('est-lista'); if (!estoque.length && raiz.querySelector('p.a-dica')) raiz.replaceChildren();
    const n = linhaEst({}); raiz.appendChild(n); n.querySelector('.e-nome').focus();
  });
  $('est-salvar').addEventListener('click', async () => {
    const botao = $('est-salvar'), ex = [], nv = [];
    for (const r of $('est-lista').querySelectorAll('.a-est')) {
      const nome = r.querySelector('.e-nome').value.trim(), q = numero(r.querySelector('.e-qtd').value), m = numero(r.querySelector('.e-min').value);
      if (!nome) return dizer('Há um item sem nome.', true);
      if (q === null || q < 0) return dizer('Quantidade inválida em "' + nome + '".', true);
      const reg = { nome, quantidade: q, unidade: r.querySelector('.e-un').value.trim() || null, minimo: m === null || m < 0 ? 0 : m };
      if (r._id) { reg.id = r._id; ex.push(reg); } else nv.push(reg);
    }
    botao.disabled = true;
    try {
      const r1 = ex.length ? await db.from('estoque').upsert(ex) : { error: null };
      const r2 = nv.length ? await db.from('estoque').insert(nv) : { error: null };
      if (r1.error || r2.error) throw (r1.error || r2.error);
      dizer('Estoque salvo!'); await carregarNovos();
    } catch (err) { dizer('Não foi possível salvar: ' + ((err && err.message) || 'erro desconhecido'), true); }
    finally { botao.disabled = false; }
  });

  /* ---------- Financeiro ---------- */
  function listaFin() {
    const mes = $('f-mes').value, raiz = $('fin-lista'); raiz.replaceChildren();
    const ls = fin.filter((f) => !mes || String(f.data).slice(0, 7) === mes);
    const ent = somar(ls.filter((f) => f.tipo === 'entrada'), (f) => f.valor), sai = somar(ls.filter((f) => f.tipo === 'saida'), (f) => f.valor);
    const card = (rot, val, cor) => el('div', { class: 'a-stat' }, el('span', { class: 'a-leg' }, rot), el('b', { style: 'color:' + cor }, brl(val)));
    $('fin-cards').replaceChildren(card('Entradas', ent, '#1a7f45'), card('Saídas', sai, '#c0310b'), card('Saldo', ent - sai, 'var(--txt)'));
    if (!ls.length) raiz.appendChild(vazioP('Nenhum lançamento neste mês.'));
    ls.forEach((f) => {
      const ex = el('button', { type: 'button', class: 'a-link' }, 'Excluir');
      ex.addEventListener('click', async () => {
        if (!confirm('Excluir este lançamento?')) return;
        const { error } = await db.from('financeiro').delete().eq('id', f.id);
        if (error) return dizer('Não foi possível excluir.', true);
        fin = fin.filter((x) => x.id !== f.id); desenharNovos();
      });
      raiz.appendChild(el('div', { class: 'a-lanc' }, el('span', {}, dataBR(f.data)),
        el('span', {}, f.descricao + (f.categoria ? ' · ' + f.categoria : '')),
        el('b', { class: f.tipo === 'entrada' ? 'a-ent' : 'a-sai' }, (f.tipo === 'entrada' ? '+ ' : '− ') + brl(f.valor)),
        f.pedido_id ? el('span', { class: 'a-leg' }, 'do pedido') : ex));
    });
  }
  $('f-mes').addEventListener('change', listaFin);
  $('fin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = numero($('f-valor').value);
    if (!valor('f-desc') || v === null || v <= 0) return dizer('Preencha a descrição e um valor maior que zero.', true);
    const r = await db.from('financeiro').insert({ tipo: $('f-tipo').value, descricao: valor('f-desc'), categoria: valor('f-cat') || null, valor: v, data: $('f-data').value || iso(new Date()) }).select().single();
    if (r.error) return dizer('Não foi possível lançar.', true);
    fin.unshift(r.data); $('fin-form').reset(); $('f-data').value = iso(new Date()); desenharNovos(); dizer('Lançamento salvo!');
  });
  $('f-data').value = iso(new Date()); $('f-mes').value = iso(new Date()).slice(0, 7);

  /* ---------- Relatórios ---------- */
  function pedidosNoPeriodo() {
    const dias = Number($('rel-dias').value), corte = dias ? iso(new Date(Date.now() - dias * 86400000)) : '';
    return pedidos.filter((p) => p.status !== 'cancelado' && (!corte || diaLocal(p.criado_em) >= corte));
  }
  function relatorio() {
    const ls = pedidos.length ? pedidosNoPeriodo() : [], tot = somar(ls, (p) => p.total);
    const card = (rot, val) => el('div', { class: 'a-stat' }, el('span', { class: 'a-leg' }, rot), el('b', {}, String(val)));
    $('rel-cards').replaceChildren(card('Pedidos', ls.length), card('Valor vendido', brl(tot)), card('Ticket médio', brl(ls.length ? tot / ls.length : 0)), card('Pedidos pagos', ls.filter((p) => p.pago).length));
    const mapa = {};
    ls.forEach((p) => (Array.isArray(p.itens) ? p.itens : []).forEach((i) => { const m = mapa[i.nome] || (mapa[i.nome] = { q: 0, v: 0 }); m.q += Number(i.qtd) || 0; m.v += Number(i.subtotal) || 0; }));
    const top = Object.entries(mapa).sort((a, b) => b[1].q - a[1].q).slice(0, 8), max = top.length ? top[0][1].q : 1;
    const raiz = $('rel-top'); raiz.replaceChildren();
    if (!top.length) raiz.appendChild(vazioP('Sem vendas no período.'));
    top.forEach(([nome, m]) => raiz.appendChild(el('div', { class: 'a-barra' }, el('span', {}, nome), el('b', {}, m.q + ' und'), el('i', { style: 'width:' + Math.max(4, Math.round(m.q / max * 100)) + '%' }))));
  }
  $('rel-dias').addEventListener('change', relatorio);
  // planilha segura: células que começam com = + - @ ganham um apóstrofo (evita fórmulas vindas do site)
  const celula = (t) => '"' + String(t ?? '').replace(/^[=+\-@]/, "'$&").replace(/"/g, '""') + '"';
  $('rel-csv').addEventListener('click', () => {
    const linhas = [['Pedido', 'Data', 'Cliente', 'Data desejada', 'Itens', 'Total', 'Status', 'Pago'].map(celula).join(';')];
    pedidosNoPeriodo().forEach((p) => linhas.push([p.id, dataBR(diaLocal(p.criado_em)), p.cliente_nome, dataBR(p.data_desejada), itensTxt(p), String(p.total).replace('.', ','), STATUS[p.status], p.pago ? 'sim' : 'não'].map(celula).join(';')));
    const a = el('a', { href: URL.createObjectURL(new Blob(['\ufeff' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'pedidos-noca-doces.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  });

  /* ---------- Clientes (montados a partir dos pedidos) ---------- */
  function listaClientes() {
    const busca = $('cli-busca').value.trim().toLowerCase(), mapa = {};
    pedidos.filter((p) => p.status !== 'cancelado').forEach((p) => {
      const nome = (p.cliente_nome || 'Sem nome').trim(), k = nome.toLowerCase();
      const c = mapa[k] || (mapa[k] = { nome, n: 0, total: 0, ultimo: '' });
      c.n++; c.total += Number(p.total) || 0; if (diaLocal(p.criado_em) > c.ultimo) c.ultimo = diaLocal(p.criado_em);
    });
    const ls = Object.values(mapa).filter((c) => c.nome.toLowerCase().includes(busca)).sort((a, b) => b.total - a.total);
    const raiz = $('cli-lista'); raiz.replaceChildren();
    if (!ls.length) raiz.appendChild(vazioP('Nenhum cliente ainda. Eles aparecem conforme chegam pedidos com nome.'));
    ls.forEach((c) => raiz.appendChild(el('div', { class: 'a-ped' },
      el('div', { class: 'a-ped-t' }, el('b', {}, c.nome), el('span', {}, brl(c.total))),
      el('p', { class: 'a-leg' }, c.n + (c.n === 1 ? ' pedido' : ' pedidos') + ' · último em ' + dataBR(c.ultimo)))));
  }
  $('cli-busca').addEventListener('input', listaClientes);

  /* ---------- Configurações ---------- */
  $('cfg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = valor('cfg-whats').replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(n)) return dizer('Use o número com país e DDD, só dígitos. Ex.: 5583991839139', true);
    const { error } = await db.from('configuracoes').upsert({ id: 1, whatsapp: n });
    if (error) return dizer('Não foi possível salvar. Você já rodou o supabase-painel.sql?', true);
    cfgSite.whatsapp = n; $('cfg-whats').value = n; dizer('Configurações salvas!');
  });
})();