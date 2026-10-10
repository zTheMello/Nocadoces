/* ===== SLIDES ===== */
(function () {
  const slider = document.getElementById('slider');
  if (!slider) return;

  const trilho = document.getElementById('slides');
  const total = trilho.children.length;
  const pontos = document.getElementById('pontos');
  const TEMPO = 5000; // troca automática (ms)
  let atual = 0;
  let timer = null;

  // cria os pontinhos
  for (let i = 0; i < total; i++) {
    const p = document.createElement('button');
    p.className = 'ponto';
    p.setAttribute('role', 'tab');
    p.setAttribute('aria-label', 'Ir para o slide ' + (i + 1));
    p.addEventListener('click', () => { ir(i); reiniciar(); });
    pontos.appendChild(p);
  }

  function ir(n) {
    atual = (n + total) % total;
    trilho.querySelectorAll('video').forEach((v) => v.pause());
    trilho.style.transform = 'translateX(' + (-100 * atual) + '%)';
    const v = trilho.children[atual].querySelector('video');
    if (v) { v.currentTime = 0; v.play().catch(() => {}); }
    [...pontos.children].forEach((p, i) => {
      p.classList.toggle('ativo', i === atual);
      p.setAttribute('aria-selected', i === atual);
    });
  }

  let tocando = false; // há vídeo tocando? então não troca de slide sozinho
  function iniciar() { parar(); if (tocando) return; timer = setInterval(() => ir(atual + 1), TEMPO); }
  function parar() { clearInterval(timer); }
  function reiniciar() { iniciar(); }

  document.getElementById('ant').addEventListener('click', () => { ir(atual - 1); reiniciar(); });
  document.getElementById('prox').addEventListener('click', () => { ir(atual + 1); reiniciar(); });

  // vídeo tocando segura o carrossel; ao pausar/terminar, ele volta a rodar
  slider.addEventListener('play', (e) => { if (e.target.tagName === 'VIDEO') { tocando = true; parar(); } }, true);
  slider.addEventListener('pause', (e) => {
    if (e.target.tagName === 'VIDEO') { tocando = false; iniciar(); }
  }, true);
  slider.addEventListener('ended', (e) => {
    if (e.target.tagName === 'VIDEO') { tocando = false; ir(atual + 1); iniciar(); }
  }, true);

  // pausa ao passar o mouse
  slider.addEventListener('mouseenter', parar);
  slider.addEventListener('mouseleave', iniciar);

  // teclado (setas) quando o slider está em foco
  slider.tabIndex = 0;
  slider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { ir(atual - 1); reiniciar(); }
    if (e.key === 'ArrowRight') { ir(atual + 1); reiniciar(); }
  });

  // arrastar com o dedo / mouse
  let x0 = null;
  slider.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  slider.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) > 50) { ir(atual + (dx < 0 ? 1 : -1)); reiniciar(); }
    x0 = null;
  });
  slider.addEventListener('pointercancel', () => { x0 = null; });

  // só roda sozinho quando está visível na tela
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => (en.isIntersecting ? iniciar() : parar()), { threshold: 0.3 }).observe(slider);
  } else {
    iniciar();
  }

  ir(0);
})();

/* ===== MENU FLUTUANTE ===== */
(function () {
  const menu = document.getElementById('menu');
  const botao = document.getElementById('menu-botao');
  if (!menu || !botao) return;

  const links = [...menu.querySelectorAll('.menu-lista a[href^="#"]')];
  const hero = document.getElementById('inicio');

  function abrir(abrir) {
    menu.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', abrir);
    botao.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
  }

  botao.addEventListener('click', () => abrir(!menu.classList.contains('aberto')));

  // fecha ao clicar num link, fora do menu ou com Esc
  links.forEach((a) => a.addEventListener('click', () => abrir(false)));
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) abrir(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });

  // o menu aparece depois que o visitante rola um pouco
  function mostrar() {
    const limite = hero ? hero.offsetHeight * 0.4 : 300;
    const visivel = window.scrollY > limite;
    menu.classList.toggle('visivel', visivel);
    if (!visivel) abrir(false);
  }
  window.addEventListener('scroll', mostrar, { passive: true });
  mostrar();

  // destaca no menu a seção que está na tela
  const alvos = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    alvos.forEach((s) => obs.observe(s));
  }
})();

/* ===== FEEDBACKS: se a foto do cliente não existir, mostra a inicial do nome ===== */
(function () {
  document.querySelectorAll('.feedback-foto').forEach((img) => {
    function trocar() {
      const s = document.createElement('span');
      s.className = 'feedback-foto inicial';
      s.textContent = (img.dataset.nome || '?').trim().charAt(0).toUpperCase();
      s.setAttribute('aria-hidden', 'true');
      img.replaceWith(s);
    }
    img.addEventListener('error', trocar, { once: true });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) trocar();
  });
})();

/* ===== CARRINHO ===== */
(function () {
  const NUMERO = '5583991839139';
  const CHAVE = 'nocadoces-carrinho';
  const $ = (id) => document.getElementById(id);
  const botao = $('carrinho-botao'), gaveta = $('carrinho'), fundo = $('carrinho-fundo');
  if (!botao || !gaveta) return;
  const lista = $('carrinho-lista'), vazio = $('carrinho-vazio'), contador = $('carrinho-qtd');
  const totalEl = $('c-total'), nomeEl = $('c-nome'), dataEl = $('c-data'), aviso = $('aviso');
  const enviar = $('c-enviar'), limpar = $('c-limpar'), fechar = $('carrinho-fechar');

  let itens = [];
  try { itens = JSON.parse(localStorage.getItem(CHAVE)) || []; } catch (e) { itens = []; }
  if (!Array.isArray(itens)) itens = [];

  const reais = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) {} };

  // a partir de 50 unidades vale o preço de atacado (ex.: 50 clássicos = R$ 65)
  function subtotal(it) {
    const u = it.granel && it.qtd >= 50 ? it.granel : it.unit;
    return (u || 0) * it.qtd;
  }

  // data mínima: hoje
  const hoje = new Date();
  dataEl.min = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

  function atualizarResumo() {
    const qtd = itens.reduce((s, i) => s + i.qtd, 0);
    contador.textContent = qtd;
    contador.hidden = qtd === 0;
    botao.setAttribute('aria-label', qtd ? 'Abrir carrinho, ' + qtd + ' unidades' : 'Abrir carrinho');
    totalEl.textContent = reais(itens.reduce((s, i) => s + subtotal(i), 0));
    vazio.hidden = itens.length > 0;
    enviar.disabled = limpar.disabled = itens.length === 0;
  }

  function render() {
    lista.innerHTML = '';
    itens.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'c-item';
      li.dataset.i = i;
      li.innerHTML =
        '<div class="c-topo"><b></b><button type="button" class="c-remover" data-acao="remover">Remover</button></div>' +
        '<div class="c-linha"><div class="c-qtd">' +
          '<button type="button" data-acao="menos" aria-label="Diminuir quantidade">&minus;</button>' +
          '<input type="number" min="1" inputmode="numeric" aria-label="Quantidade">' +
          '<button type="button" data-acao="mais" aria-label="Aumentar quantidade">+</button>' +
        '</div><span class="c-preco"></span></div>' +
        '<label class="c-obs">Personalização<input type="text" maxlength="120" placeholder="Ex.: sem granulado, para presente"></label>';
      li.querySelector('b').textContent = it.nome;
      li.querySelector('.c-remover').setAttribute('aria-label', 'Remover ' + it.nome);
      li.querySelector('.c-qtd input').value = it.qtd;
      li.querySelector('.c-preco').textContent = reais(subtotal(it));
      li.querySelector('.c-obs input').value = it.obs || '';
      lista.appendChild(li);
    });
    atualizarResumo();
    salvar();
  }

  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-acao]');
    if (!b) return;
    const i = +b.closest('.c-item').dataset.i, it = itens[i], passo = it.passo || 5;
    if (b.dataset.acao === 'remover') itens.splice(i, 1);
    if (b.dataset.acao === 'mais') it.qtd += passo;
    if (b.dataset.acao === 'menos') it.qtd = Math.max(1, it.qtd - passo);
    render();
  });
  lista.addEventListener('change', (e) => {
    if (!e.target.matches('.c-qtd input')) return;
    const it = itens[+e.target.closest('.c-item').dataset.i];
    it.qtd = Math.max(1, parseInt(e.target.value, 10) || 1);
    render();
  });
  lista.addEventListener('input', (e) => {
    if (!e.target.matches('.c-obs input')) return;
    itens[+e.target.closest('.c-item').dataset.i].obs = e.target.value;
    salvar();
  });

  // aviso rápido
  let tAviso;
  function dizer(msg) {
    aviso.textContent = msg;
    aviso.classList.add('visivel');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => aviso.classList.remove('visivel'), 2200);
  }

  document.addEventListener('carrinho:add', (e) => {
    const d = e.detail;
    const ja = itens.find((i) => i.nome === d.nome);
    if (ja) ja.qtd += d.qtd;
    else itens.push({ nome: d.nome, qtd: d.qtd, unit: d.unit, granel: d.granel, passo: d.passo, obs: '' });
    render();
    dizer(d.qtd + ' × ' + d.nome + ' no carrinho');
  });

  function abrir(sim) {
    gaveta.classList.toggle('aberta', sim);
    gaveta.setAttribute('aria-hidden', !sim);
    fundo.hidden = !sim;
    botao.setAttribute('aria-expanded', sim);
    document.body.style.overflow = sim ? 'hidden' : '';
    (sim ? fechar : botao).focus();
  }
  document.addEventListener('carrinho:abrir', () => abrir(true));
  botao.addEventListener('click', () => abrir(!gaveta.classList.contains('aberta')));
  fechar.addEventListener('click', () => abrir(false));
  fundo.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && gaveta.classList.contains('aberta')) abrir(false); });

  limpar.addEventListener('click', () => { itens = []; render(); });

  enviar.addEventListener('click', () => {
    if (!itens.length) return;
    let msg = 'Olá! Quero fazer este pedido:\n';
    itens.forEach((it) => {
      msg += '\n• ' + it.qtd + (it.qtd === 1 ? ' unidade' : ' unidades') + ' de ' + it.nome;
      if (it.obs && it.obs.trim()) msg += '\n   Personalização: ' + it.obs.trim();
    });
    msg += '\n\nValor estimado: ' + totalEl.textContent;
    if (nomeEl.value.trim()) msg += '\nNome: ' + nomeEl.value.trim();
    if (dataEl.value) msg += '\nData desejada: ' + dataEl.value.split('-').reverse().join('/');
    window.open('https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  render();
})();

/* ===== CARDÁPIO ===== */
(function () {
  const abas = [...document.querySelectorAll('.aba')];
  const paineis = [...document.querySelectorAll('.painel')];
  if (!abas.length) return;

  // troca de abas
  abas.forEach((aba) => {
    aba.addEventListener('click', () => {
      abas.forEach((a) => {
        const ativa = a === aba;
        a.classList.toggle('ativo', ativa);
        a.setAttribute('aria-selected', ativa);
      });
      paineis.forEach((p) => {
        const ativo = p.id === aba.dataset.alvo;
        p.classList.toggle('ativo', ativo);
        p.hidden = !ativo;
      });
    });
  });

  // botão "Adicionar" abre uma lista de quantidades; cada uma coloca o item no carrinho
  const PADRAO = '10,25,50,100';

  function fecharOpcoes() {
    document.querySelectorAll('.opcoes.aberto').forEach((o) => {
      o.classList.remove('aberto');
      o.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.pedir').forEach((btn) => {
    const painel = btn.closest('.painel');
    const unidades = (painel.dataset.unidades || PADRAO).split(',').map((s) => s.trim());
    const passo = parseInt(painel.dataset.passo || '5', 10);
    const granel = parseFloat(painel.dataset.granel) || 0;
    const unit = parseFloat(btn.closest('.item').querySelector('.preco').textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const nome = btn.dataset.pedido;

    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    const lista = document.createElement('ul');
    lista.className = 'opcoes';

    function adicionar(qtd, abrirCarrinho) {
      document.dispatchEvent(new CustomEvent('carrinho:add', { detail: { nome, qtd, unit, granel, passo } }));
      if (abrirCarrinho) document.dispatchEvent(new Event('carrinho:abrir'));
      fecharOpcoes();
    }

    function opcao(texto, qtd, abrirCarrinho) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      b.addEventListener('click', (e) => { e.stopPropagation(); adicionar(qtd, abrirCarrinho); });
      li.appendChild(b);
      lista.appendChild(li);
    }

    unidades.forEach((q) => opcao(q === '1' ? '1 unidade' : q + ' unidades', parseInt(q, 10), false));
    opcao('Outra quantidade', passo, true); // abre o carrinho para ajustar

    btn.after(lista);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const abrir = !lista.classList.contains('aberto');
      fecharOpcoes();
      lista.classList.toggle('aberto', abrir);
      btn.setAttribute('aria-expanded', abrir);
    });
  });

  document.addEventListener('click', fecharOpcoes);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharOpcoes(); });
})();