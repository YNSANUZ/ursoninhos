/* =========================================================
   Ursoninhos — header-search.js
   Buscador universal da home. Fica escondido atrás de uma
   lupa ao lado da logo; ao clicar, expande o campo. Busca ao
   vivo em: frases (camisas de frases), modelos públicos e
   categorias/atalhos. Enter leva à busca completa de frases.

   Depende de: UrsoninhosFrases (frases-data.js) e
   UrsoninhosApi (public-api.js) — ambos carregados antes.
   Tudo com proteção: se um deles faltar, o resto funciona.
   ========================================================= */
(function () {
  const wrap = document.getElementById('headerSearch');
  const toggle = document.getElementById('headerSearchToggle');
  const input = document.getElementById('headerSearchInput');
  const results = document.getElementById('headerSearchResults');
  if (!wrap || !toggle || !input || !results) return;

  // Normaliza para comparar sem acento e sem caixa ("impressão" == "impressao").
  const norm = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Atalhos por palavra-chave para as seções/categorias da loja.
  const atalhos = [
    { label: 'Camisas de Frases', sub: 'Categoria', href: 'camisas-de-frases.html', keys: 'frase frases camisa camisas desmotivacional humor engracada' },
    { label: 'Criar Camisa Personalizada', sub: 'Categoria', href: 'index.html#hero', keys: 'camisa personalizada personalizar criar estampa arte upload imagem texto manequim' },
    { label: 'Impressão 3D', sub: 'Categoria', href: 'index.html#destaques', keys: 'impressao 3d tres dimensoes modelo produto premium' },
    { label: 'Nossos produtos em destaque', sub: 'Categoria', href: 'index.html#destaques', keys: 'produtos catalogo destaques loja comprar modelos publicos' },
  ];

  // Frases: geradas no cliente (sem rede).
  let frasesProdutos = [];
  try { frasesProdutos = (window.UrsoninhosFrases && window.UrsoninhosFrases.gerarProdutosDeFrases()) || []; }
  catch (error) { frasesProdutos = []; }

  // Modelos públicos: carregados sob demanda na primeira abertura.
  let modelos = [];
  let modelosCarregados = false;
  async function carregarModelos() {
    if (modelosCarregados) return;
    modelosCarregados = true;
    try {
      const lista = window.UrsoninhosApi && window.UrsoninhosApi.listProducts
        ? await window.UrsoninhosApi.listProducts()
        : [];
      // só produtos com imagem de verdade (filtra registros de teste)
      modelos = (lista || []).filter((m) => {
        const img = String(m.catalogImage || '');
        return m.title && (img.startsWith('data:') || img.startsWith('http'));
      });
      // se o campo já estiver aberto e com texto, re-renderiza com os modelos
      if (wrap.classList.contains('is-open') && input.value.trim()) render(input.value);
    } catch (error) {
      modelos = [];
    }
  }

  function abrir() {
    wrap.classList.add('is-open');
    carregarModelos();
    // foco após a transição começar
    window.setTimeout(() => input.focus(), 50);
  }

  function fechar() {
    wrap.classList.remove('is-open');
    results.hidden = true;
  }

  function pathDoModelo(m) {
    try {
      if (window.UrsoninhosApi && window.UrsoninhosApi.getProductPath) return window.UrsoninhosApi.getProductPath(m);
    } catch (error) { /* fallback abaixo */ }
    return `produto.html?id=${encodeURIComponent(m.id || '')}`;
  }

  function textoDoModelo(model) {
    try {
      return (window.UrsoninhosLayers?.extractTextValues?.(model) || []).join(' ');
    } catch (error) {
      return '';
    }
  }

  function render(termo) {
    const q = norm(termo).trim();
    if (!q) { results.hidden = true; results.innerHTML = ''; return; }

    const linhas = [];

    atalhos
      .filter((a) => norm(a.keys).includes(q) || norm(a.label).includes(q))
      .forEach((a) => linhas.push({ label: a.label, sub: a.sub, href: a.href }));

    frasesProdutos
      .filter((p) => norm(`${p.frase} ${p.titulo} ${(p.tags || []).join(' ')}`).includes(q))
      .slice(0, 8)
      .forEach((p) => linhas.push({
        label: p.frase,
        sub: 'Camisa de Frase',
        href: p.shortPath || `produto-frase.html?frase=${encodeURIComponent(p.id)}`,
      }));

    modelos
      .filter((m) => norm([
        m.title,
        m.description,
        Array.isArray(m.tags) ? m.tags.join(' ') : m.tags,
        textoDoModelo(m.model),
      ].join(' ')).includes(q))
      .slice(0, 6)
      .forEach((m) => linhas.push({ label: m.title, sub: 'Modelo', href: pathDoModelo(m) }));

    const buscaCompleta = `camisas-de-frases.html?busca=${encodeURIComponent(termo.trim())}`;

    if (!linhas.length) {
      results.innerHTML = `<a class="header-search__all" href="${buscaCompleta}">Buscar "${escapeHtml(termo.trim())}" em todas as camisas de frases →</a>`;
      results.hidden = false;
      return;
    }

    results.innerHTML = linhas.slice(0, 12).map((r) => `
      <a href="${r.href}">
        <strong>${escapeHtml(r.label)}</strong>
        <span>${escapeHtml(r.sub)}</span>
      </a>
    `).join('') + `<a class="header-search__all" href="${buscaCompleta}">Ver todos os resultados →</a>`;
    results.hidden = false;
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (wrap.classList.contains('is-open')) fechar();
    else abrir();
  });

  // Clicar fora fecha; clicar dentro (input/resultados) mantém aberto.
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) fechar();
  });

  input.addEventListener('input', () => render(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const termo = input.value.trim();
      if (termo) window.location.href = `camisas-de-frases.html?busca=${encodeURIComponent(termo)}`;
    } else if (event.key === 'Escape') {
      fechar();
      toggle.focus();
    }
  });
})();
