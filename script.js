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
    trilho.style.transform = 'translateX(' + (-100 * atual) + '%)';
    [...pontos.children].forEach((p, i) => {
      p.classList.toggle('ativo', i === atual);
      p.setAttribute('aria-selected', i === atual);
    });
  }

  function iniciar() { parar(); timer = setInterval(() => ir(atual + 1), TEMPO); }
  function parar() { clearInterval(timer); }
  function reiniciar() { iniciar(); }

  document.getElementById('ant').addEventListener('click', () => { ir(atual - 1); reiniciar(); });
  document.getElementById('prox').addEventListener('click', () => { ir(atual + 1); reiniciar(); });

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

  // botão "Pedir" abre o WhatsApp com a mensagem pronta
  const NUMERO = '5583991839139';
  document.querySelectorAll('.pedir').forEach((a) => {
    const msg = 'Olá! Quero encomendar: ' + a.dataset.pedido;
    a.href = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(msg);
    a.target = '_blank';
    a.rel = 'noopener';
  });
})();