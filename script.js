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

/* ===== VITRINE FLUTUANTE (carrossel em cascata) ===== */
(function () {
  const janela = document.getElementById('cs-janela');
  const trilho = document.getElementById('cs-trilho');
  if (!janela || !trilho) return;

  const palco = janela.parentElement;
  const botaoAnt = document.getElementById('cs-ant');
  const botaoProx = document.getElementById('cs-prox');
  const botaoPausa = document.getElementById('cs-pausa');
  const reduz = window.matchMedia('(prefers-reduced-motion: reduce)');

  const VELOCIDADE = 26;           // deslocamento automático (px por segundo)
  const originais = [...trilho.children];
  const qtd = originais.length;

  // true: quem pediu "reduzir movimento" no sistema vê os vídeos parados nos cards (ao clicar, abrem com controles)
  // false: os vídeos tocam sempre
  const VIDEO_RESPEITA_REDUCAO = true;

  // dados de cada card (imagem ou vídeo), lidos do HTML antes de qualquer clone
  const midias = originais.map((li) => {
    const v = li.querySelector('video'), img = li.querySelector('img'), cap = li.querySelector('figcaption');
    const fonte = v || img;
    return {
      tipo: v ? 'video' : 'imagem',
      src: fonte ? fonte.getAttribute('src') : '',
      alt: fonte ? (fonte.getAttribute(v ? 'aria-label' : 'alt') || '') : '',
      legenda: cap ? cap.textContent.trim() : ''
    };
  });

  // cards originais viram botões acessíveis (teclado: Enter ou Espaço amplia)
  originais.forEach((li, i) => {
    const f = li.querySelector('.cs-card-in');
    if (!f) return;
    f.tabIndex = 0;
    f.setAttribute('role', 'button');
    f.setAttribute('aria-label', 'Ampliar ' + (midias[i].tipo === 'video' ? 'vídeo' : 'imagem') + ': ' + (midias[i].alt || midias[i].legenda));
  });

  let x = 0;                       // posição atual do trilho
  let largura = 0;                 // largura de um bloco completo de cards
  let tween = null;                // deslize suave (setas e arrastar)
  let rodando = false, ultimo = 0;
  let pausaUsuario = false, pausaMouse = false, pausaFoco = false, visivel = true, arrastando = false;
  let pausaLb = false;             // lightbox aberto: carrossel e vídeos dos cards descansam

  // vídeos dos cards: só tocam os que estão na tela
  const visiveisSet = new Set();
  let ioVideo = null, autoplayBloqueado = false;

  const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const saida = (p) => 1 - Math.pow(1 - p, 3);

  // duplica os cards para o movimento nunca "acabar"
  function copiar(vezes) {
    for (let v = 0; v < vezes; v++) {
      originais.forEach((li) => {
        const c = li.cloneNode(true);
        c.classList.add('cs-clone');
        c.setAttribute('aria-hidden', 'true');
        c.querySelectorAll('img').forEach((img) => { img.alt = ''; });
        c.querySelectorAll('video').forEach((vd) => vd.removeAttribute('aria-label'));
        // clones não recebem foco nem papel de botão (só os originais)
        c.querySelectorAll('[tabindex]').forEach((n) => {
          n.removeAttribute('tabindex'); n.removeAttribute('role'); n.removeAttribute('aria-label');
        });
        trilho.appendChild(c);
      });
    }
  }

  function montar() {
    trilho.querySelectorAll('.cs-clone').forEach((n) => n.remove());
    copiar(1);
    largura = trilho.children[qtd].offsetLeft - trilho.children[0].offsetLeft;
    if (largura > 0) copiar(Math.ceil(janela.clientWidth / largura)); // blocos extras para cobrir telas largas
    prepararVideos();
  }

  // ao "dar a volta" no trilho, o vídeo que ficava na tela passa a ser o do bloco vizinho:
  // copiamos o tempo de reprodução para ele não parecer que o vídeo reiniciou
  function passarVideos(delta) {
    if (!visiveisSet.size) return;
    const filhos = [...trilho.children];
    visiveisSet.forEach((v) => {
      const card = v.closest('.cs-card');
      const alvo = filhos[filhos.indexOf(card) + delta];
      const vd = alvo && alvo.querySelector('video');
      if (vd && Math.abs(vd.currentTime - v.currentTime) > 0.25) {
        try { vd.currentTime = v.currentTime; } catch (err) {}
      }
    });
  }

  function normalizar() {
    if (largura <= 0) return;
    while (x >= largura) { x -= largura; passarVideos(-qtd); if (tween) { tween.de -= largura; tween.para -= largura; } }
    while (x < 0) { x += largura; passarVideos(qtd); if (tween) { tween.de += largura; tween.para += largura; } }
  }

  function desenhar() { trilho.style.transform = 'translate3d(' + (-x) + 'px, 0, 0)'; }

  const andando = () => !reduz.matches && !pausaUsuario && !pausaMouse && !pausaFoco && visivel && !document.hidden && !arrastando && !pausaLb;

  function quadro(t) {
    const dt = Math.min((t - ultimo) / 1000, 0.05);
    ultimo = t;
    if (tween) {
      const p = Math.min((t - tween.t0) / tween.dur, 1);
      x = tween.de + (tween.para - tween.de) * tween.ease(p);
      if (p >= 1) tween = null;
    } else if (andando()) {
      x += VELOCIDADE * dt;
    } else {
      rodando = false;   // nada para animar: o laço descansa
      return;
    }
    normalizar();
    desenhar();
    requestAnimationFrame(quadro);
  }

  function acordar() {
    if (rodando || largura <= 0) return;
    if (!tween && !andando()) return;
    rodando = true;
    ultimo = performance.now();
    requestAnimationFrame(quadro);
  }

  // setas: avançam um card por vez
  function ir(dir) {
    if (largura <= 0) return;
    const passo = largura / qtd;
    if (reduz.matches) { x += dir * passo; normalizar(); desenhar(); return; }
    const base = tween ? tween.para : x;
    tween = { de: x, para: base + dir * passo, t0: performance.now(), dur: 650, ease: suave };
    acordar();
  }
  botaoAnt.addEventListener('click', () => ir(-1));
  botaoProx.addEventListener('click', () => ir(1));

  janela.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
    // Enter ou Espaço num card em foco abre a visualização ampliada
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cs-card-in')) {
      e.preventDefault();
      abrirDoCard(e.target.closest('.cs-card'));
    }
  });

  // arrastar com o dedo / mouse
  let x0 = 0, xInicio = 0, moveu = false, vel = 0, cxAnt = 0, tAnt = 0;
  janela.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    arrastando = true; moveu = false; tween = null; vel = 0;
    x0 = cxAnt = e.clientX; xInicio = x; tAnt = e.timeStamp;
  });
  janela.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0;
    if (!moveu && Math.abs(dx) > 4) {
      moveu = true;
      janela.classList.add('arrastando');
      try { janela.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (!moveu) return;
    const dt = e.timeStamp - tAnt;
    if (dt > 0) vel = (cxAnt - e.clientX) / dt;
    cxAnt = e.clientX; tAnt = e.timeStamp;
    x = xInicio - dx;
    normalizar();
    desenhar();
  });
  function soltar() {
    if (!arrastando) return;
    arrastando = false;
    janela.classList.remove('arrastando');
    if (moveu && !reduz.matches && Math.abs(vel) > 0.1) {
      const extra = Math.max(-largura / 3, Math.min(largura / 3, vel * 260));
      tween = { de: x, para: x + extra, t0: performance.now(), dur: 800, ease: saida };
    }
    acordar();
  }
  janela.addEventListener('pointerup', soltar);
  janela.addEventListener('pointercancel', soltar);
  janela.addEventListener('dragstart', (e) => e.preventDefault());

  /* ----- VÍDEOS DOS CARDS: autoplay mudo, em loop, só os visíveis ----- */
  const videosPodem = () => !pausaUsuario && !pausaLb && !document.hidden && !(VIDEO_RESPEITA_REDUCAO && reduz.matches);

  function tocarVideo(v) {
    const p = v.play();
    // o navegador pode bloquear o autoplay (ex.: economia de bateria): guardamos o aviso
    // e tentamos de novo, para todos os vídeos de uma vez, no primeiro toque/clique em qualquer lugar da página
    if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotAllowedError') autoplayBloqueado = true; });
  }

  function atualizarVideo(v) {
    const deve = visiveisSet.has(v) && videosPodem();
    if (deve) { if (v.paused) tocarVideo(v); }
    else v.pause();
  }

  function atualizarVideos() { trilho.querySelectorAll('video').forEach(atualizarVideo); }

  // (re)liga os vídeos atuais do trilho, inclusive clones, sempre mudos e sem controles
  function prepararVideos() {
    if (ioVideo) ioVideo.disconnect();
    visiveisSet.clear();
    const vids = trilho.querySelectorAll('video');
    vids.forEach((v) => {
      v.muted = true; v.defaultMuted = true;   // clones não herdam o "muted" de forma confiável
      v.loop = true; v.playsInline = true; v.controls = false;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
    });
    if (!('IntersectionObserver' in window)) {
      vids.forEach((v) => visiveisSet.add(v));
      atualizarVideos();
      return;
    }
    ioVideo = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => { if (en.isIntersecting) visiveisSet.add(en.target); else visiveisSet.delete(en.target); });
      atualizarVideos();
    }, { threshold: 0.2 });
    vids.forEach((v) => ioVideo.observe(v));
  }

  // dados carregados: reavalia (o autoplay do navegador não deve tocar vídeo fora da tela)
  trilho.addEventListener('loadeddata', (e) => { if (e.target.tagName === 'VIDEO') atualizarVideo(e.target); }, true);

  // alternativa se o navegador bloqueou o autoplay: um único gesto do visitante libera todos
  ['pointerup', 'touchend', 'keydown', 'click'].forEach((ev) => {
    document.addEventListener(ev, () => {
      if (!autoplayBloqueado) return;
      autoplayBloqueado = false;
      atualizarVideos();
    }, { passive: true });
  });

  /* ----- LIGHTBOX (imagem ou vídeo ampliado) ----- */
  const lb = document.getElementById('lb');
  const lbPalco = document.getElementById('lb-palco');
  const lbFecharBtn = document.getElementById('lb-fechar');
  const lbAntBtn = document.getElementById('lb-ant');
  const lbProxBtn = document.getElementById('lb-prox');
  const lbLegenda = document.getElementById('lb-legenda');
  const lbContador = document.getElementById('lb-contador');
  let lbIdx = 0, lbRetorno = null, lbSwipe = false, lbX0 = null;

  function lbLimparPalco() {
    lbPalco.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
    lbPalco.replaceChildren();
  }

  function lbMostrar(i, tempo) {
    lbIdx = (i + qtd) % qtd;
    const m = midias[lbIdx];
    lbLimparPalco();
    let el;
    if (m.tipo === 'video') {
      el = document.createElement('video');
      el.src = m.src;
      el.controls = true;                       // pausar, retomar, volume e tela cheia
      el.loop = true; el.autoplay = true; el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.preload = 'auto';
      el.muted = false;                         // o clique do visitante libera o som
      if (m.alt) el.setAttribute('aria-label', m.alt);
      if (tempo > 0) el.addEventListener('loadedmetadata', () => { try { el.currentTime = tempo; } catch (err) {} }, { once: true });
      const p = el.play();
      if (p && p.catch) p.catch(() => { el.muted = true; el.play().catch(() => {}); }); // se bloquear o som, entra mudo
    } else {
      el = new Image();
      el.decoding = 'async';
      el.draggable = false;
      el.alt = m.alt;
      el.src = m.src;
    }
    el.className = 'lb-midia';
    lbPalco.appendChild(el);
    lbLegenda.textContent = m.legenda;
    lbContador.textContent = (lbIdx + 1) + ' / ' + qtd;
    // adianta o carregamento das imagens vizinhas
    [-1, 1].forEach((d) => {
      const vizinho = midias[(lbIdx + d + qtd) % qtd];
      if (vizinho.tipo === 'imagem') new Image().src = vizinho.src;
    });
  }

  function lbIr(d) { lbMostrar(lbIdx + d, 0); }

  function lbAbrir(i, tempo) {
    if (!lb) return;
    lbRetorno = document.activeElement;
    pausaLb = true;
    atualizarVideos();                          // vídeos dos cards descansam enquanto o ampliado toca
    lb.hidden = false;
    document.documentElement.classList.add('lb-aberto');
    lbMostrar(i, tempo);
    lbFecharBtn.focus({ preventScroll: true });
  }

  function lbEncerrar() {
    if (!lb || lb.hidden) return;
    lbLimparPalco();
    lb.hidden = true;
    document.documentElement.classList.remove('lb-aberto');
    pausaLb = false;
    atualizarVideos();
    acordar();
    // quem abriu pelo teclado volta para o card de onde saiu
    if (lbRetorno && lbRetorno.classList && lbRetorno.classList.contains('cs-card-in') && document.contains(lbRetorno)) {
      lbRetorno.focus({ preventScroll: true });
    }
    lbRetorno = null;
  }

  // clique no card (um arrasto não conta como clique)
  function abrirDoCard(card) {
    if (!card) return;
    const i = [...trilho.children].indexOf(card) % qtd;
    const v = card.querySelector('video');
    lbAbrir(i, v ? v.currentTime : 0);
  }
  janela.addEventListener('click', (e) => {
    if (moveu) return;
    abrirDoCard(e.target.closest('.cs-card'));
  });

  if (lb) {
    lbFecharBtn.addEventListener('click', lbEncerrar);
    lbAntBtn.addEventListener('click', () => lbIr(-1));
    lbProxBtn.addEventListener('click', () => lbIr(1));

    // clicar no fundo (fora da mídia) fecha
    lb.addEventListener('click', (e) => {
      if (lbSwipe) { lbSwipe = false; return; }
      if (e.target === lb || e.target === lbPalco) lbEncerrar();
    });

    // deslizar o dedo/mouse sobre a imagem troca de mídia (não vale sobre os controles do vídeo)
    lbPalco.addEventListener('pointerdown', (e) => {
      lbSwipe = false;
      lbX0 = e.target.closest('video') ? null : e.clientX;
    });
    lbPalco.addEventListener('pointerup', (e) => {
      if (lbX0 === null) return;
      const dx = e.clientX - lbX0;
      lbX0 = null;
      if (Math.abs(dx) > 50) { lbSwipe = true; lbIr(dx < 0 ? 1 : -1); }
    });
    lbPalco.addEventListener('pointercancel', () => { lbX0 = null; });

    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      const noVideo = e.target.tagName === 'VIDEO'; // nos controles do vídeo, as setas ficam para o próprio player
      if (e.key === 'Escape') { e.preventDefault(); lbEncerrar(); }
      else if (e.key === 'ArrowLeft' && !noVideo) { e.preventDefault(); lbIr(-1); }
      else if (e.key === 'ArrowRight' && !noVideo) { e.preventDefault(); lbIr(1); }
      else if (e.key === 'Tab') {
        // mantém o foco dentro da visualização
        const foc = [...lb.querySelectorAll('button')];
        const primeiro = foc[0], ultimoBtn = foc[foc.length - 1];
        if (!lb.contains(document.activeElement)) { e.preventDefault(); primeiro.focus(); }
        else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimoBtn.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimoBtn) { e.preventDefault(); primeiro.focus(); }
      }
    });
  }

  // pausa: mouse em cima, foco do teclado, aba escondida ou carrossel fora da tela
  janela.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pausaMouse = true; });
  janela.addEventListener('pointerleave', () => { pausaMouse = false; acordar(); });
  palco.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) pausaFoco = true; });
  palco.addEventListener('focusout', () => { pausaFoco = false; acordar(); });
  document.addEventListener('visibilitychange', () => { acordar(); atualizarVideos(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visivel = en.isIntersecting; acordar(); }, { threshold: 0.1 }).observe(janela);
  }

  // botão de pausa (quem prefere pode parar o movimento)
  botaoPausa.addEventListener('click', () => {
    pausaUsuario = !pausaUsuario;
    botaoPausa.setAttribute('aria-pressed', pausaUsuario);
    botaoPausa.textContent = pausaUsuario ? 'Retomar movimento' : 'Pausar movimento';
    palco.classList.toggle('cs-pausado', pausaUsuario);
    acordar();
    atualizarVideos();   // o botão também para/retoma os vídeos dos cards
  });

  // movimento reduzido: sem deslocamento automático e sem botão de pausa
  function aplicarMovimento() { botaoPausa.hidden = reduz.matches; acordar(); atualizarVideos(); }
  if (reduz.addEventListener) reduz.addEventListener('change', aplicarMovimento);
  else if (reduz.addListener) reduz.addListener(aplicarMovimento);

  // recalcula ao redimensionar a tela
  let tRedim;
  window.addEventListener('resize', () => {
    clearTimeout(tRedim);
    tRedim = setTimeout(() => {
      const prop = largura ? x / largura : 0;
      montar();
      x = prop * largura;
      normalizar();
      desenhar();
      acordar();
    }, 150);
  });

  montar();
  x = Math.max(largura - 60, 0);   // começa com um pouco da cascata já à esquerda
  desenhar();
  aplicarMovimento();
})();
