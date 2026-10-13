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
  }
  db.auth.getSession().then(({ data }) => { if (data.session) entrar(); });

  // abas do painel
  document.querySelectorAll('.a-abas button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.a-abas button').forEach((x) => x.classList.toggle('ativo', x === b));
    ['a-promo', 'a-cardapio', 'a-feedbacks'].forEach((id) => { $(id).hidden = id !== b.dataset.aba; });
  }));

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
    cats.forEach((c) => raiz.appendChild(secaoCategoria(c)));
  }

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
    const salvar = el('button', { type: 'button', class: 'a-btn' }, 'Salvar ' + c.titulo);
    salvar.addEventListener('click', () => salvarCategoria(c, sec, salvar));
    acoes.append(add, salvar);
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

  async function salvarCategoria(c, sec, botao) {
    const linhas = [...sec.querySelectorAll('.a-linha')];
    const existentes = [], novos = [];

    for (let i = 0; i < linhas.length; i++) {
      const r = linhas[i];
      const nome = r.querySelector('.f-nome').value.trim();
      const preco = numero(r.querySelector('.f-preco').value);
      if (!nome) return dizer('Há um item sem nome (linha ' + (i + 1) + ' de ' + c.titulo + ').', true);
      if (preco === null || preco < 0) return dizer('Preço inválido em "' + nome + '".', true);
      const promoTxt = r.querySelector('.f-promo').value.trim();
      const promo = promoTxt === '' ? null : numero(promoTxt);
      if (promoTxt !== '' && (promo === null || promo < 0)) return dizer('Preço promocional inválido em "' + nome + '".', true);
      if (promo !== null && promo >= preco) return dizer('Em "' + nome + '", o preço promocional deve ser menor que o preço normal.', true);
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
      if (r._orig.id) { reg.id = r._orig.id; existentes.push(reg); } else novos.push(reg);
    }

    // dados da categoria (preço de atacado ou texto informativo)
    const upCat = {};
    if (sec.querySelector('.c-base')) {
      upCat.preco_base = numero(sec.querySelector('.c-base').value);
      upCat.granel = numero(sec.querySelector('.c-granel').value);
    } else if (sec.querySelector('.c-info')) {
      upCat.info = sec.querySelector('.c-info').value.trim() || null;
    }

    botao.disabled = true;
    try {
      const r1 = Object.keys(upCat).length ? await db.from('categorias').update(upCat).eq('slug', c.slug) : { error: null };
      const r2 = existentes.length ? await db.from('produtos').upsert(existentes) : { error: null };
      const r3 = novos.length ? await db.from('produtos').insert(novos) : { error: null };
      const falha = r1.error || r2.error || r3.error;
      if (falha) throw falha;
      dizer(c.titulo + ' salvo!');
      await carregarCardapio();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      dizer('Não foi possível salvar: ' + ((err && err.message) || 'erro desconhecido'), true);
    } finally {
      botao.disabled = false;
    }
  }

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
    if (!fbs.length) raiz.appendChild(el('p', { class: 'a-dica' }, 'Nenhum feedback cadastrado ainda. Enquanto a lista estiver vazia, o site mostra os textos de exemplo que estão no index.html.'));
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
})();