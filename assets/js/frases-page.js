/* =========================================================
   Ursoninhos — frases-page.js
   Vitrine "Camisas de Frases": monta o grid a partir de
   gerarProdutosDeFrases() (frases-data.js) e desenha cada
   mockup em canvas — a frase é renderizada pelo MESMO motor
   do modal de texto (text-print-engine.js) e composta sobre
   o mockup da camisa no cabide, igual ao preview do carrinho.

   Ordem dos scripts na página: app-config -> shop-store ->
   text-print-engine -> frases-data -> este arquivo.
   ========================================================= */

(function () {
  const store = window.UrsoninhosStore;
  const frases = window.UrsoninhosFrases;
  const grid = document.getElementById('frasesProductsGrid');
  const cartCount = document.getElementById('frasesCartCount');
  const cartBtn = document.getElementById('frasesCartBtn');

  if (!store || !frases || !grid) return;

  const MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';
  // Mesmo enquadramento do preview do carrinho (main.js/admin-models.js):
  // estampa centrada no peito, levemente à esquerda do centro da imagem.
  const PRINT_CENTER_X = 0.478;
  const PRINT_TOP_Y = 0.30;
  const PRINT_SIZE = 0.34;

  // Busca (?busca=termo): filtra por frase, título, estilo ou tags —
  // sem acentos, para "desmotivacionais" achar "desmotivacionáis" etc.
  const normalizar = (texto) => String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const termoBusca = new URLSearchParams(window.location.search).get('busca') || '';
  const todos = frases.gerarProdutosDeFrases();
  const produtos = termoBusca
    ? todos.filter((p) => normalizar(`${p.frase} ${p.titulo} ${p.presetName} ${p.tags.join(' ')}`).includes(normalizar(termoBusca)))
    : todos;

  const mockupsProntos = {}; // id -> dataURL (reusado no "Adicionar ao carrinho")

  function atualizarContadorCarrinho() {
    if (cartCount) cartCount.textContent = String(store.getCartCount());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const mockupBase = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = MOCKUP_URL;
  });

  /* Desenha frase + estilo sobre a camisa e devolve um dataURL. O texto
     é gerado num canvas transparente pelo drawTextPrint (que já ajusta
     o tamanho da fonte para caber) e composto no peito do mockup. */
  async function gerarMockupDeFrase(produto) {
    await textFontsReady;
    const base = await mockupBase;

    const preset = TEXT_PRINT_PRESETS.find((p) => p.id === produto.presetId) || TEXT_PRINT_PRESETS[0];

    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 1024;
    drawTextPrint(textCanvas, preset, produto.linhas);

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    const printSize = canvas.width * PRINT_SIZE;
    ctx.drawImage(
      textCanvas,
      canvas.width * PRINT_CENTER_X - printSize / 2,
      canvas.height * PRINT_TOP_Y,
      printSize,
      printSize
    );

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  function adicionarAoCarrinho(produto, imagem) {
    store.addCartItem({
      productId: `camisa-frase::${produto.id}`,
      title: 'Camisa de Frase',
      variantLabel: `Frase: ${produto.titulo}`,
      price: produto.preco,
      size: 'M',
      quantity: 1,
      previewImage: imagem || '',
      previewViews: { front: imagem || '' },
      metadata: {
        categoria: produto.categoria,
        tags: produto.tags,
        frase: produto.frase,
        presetId: produto.presetId,
        presetName: produto.presetName,
      },
    });
    atualizarContadorCarrinho();
  }

  function renderGrid() {
    if (termoBusca && !produtos.length) {
      grid.innerHTML = `<p class="catalog-placeholder">Nenhuma camisa encontrada para "${escapeHtml(termoBusca)}". <a href="camisas-de-frases.html">Ver todas as camisas de frases</a>.</p>`;
      return;
    }

    grid.innerHTML = produtos.map((produto) => `
      <article class="product-card frase-card" data-product-id="${produto.id}" data-tags="${escapeHtml(produto.tags.join(', '))}">
        <a class="product-card__thumb product-card__thumb--catalog frase-card__thumb" href="produto-frase.html?id=${encodeURIComponent(produto.id)}" aria-label="Ver produto: ${escapeHtml(produto.frase)}">
          <span class="frase-card__loading">Gerando mockup…</span>
        </a>
        <h3 title="${escapeHtml(produto.frase)}">${escapeHtml(produto.titulo)}</h3>
        <p class="product-card__price">${store.formatBRL(produto.preco)}</p>
        <p class="product-card__meta">Estilo: ${escapeHtml(produto.presetName)}</p>
        <div class="product-card__actions">
          <a class="product-card__add" href="produto-frase.html?id=${encodeURIComponent(produto.id)}">Ver produto</a>
          <button type="button" class="product-card__quick-add" data-action="add" aria-label="Adicionar ao carrinho" disabled>+</button>
        </div>
      </article>
    `).join('');

    produtos.forEach(async (produto) => {
      const card = grid.querySelector(`[data-product-id="${produto.id}"]`);
      if (!card) return;

      try {
        const imagem = await gerarMockupDeFrase(produto);
        mockupsProntos[produto.id] = imagem;

        const thumb = card.querySelector('.frase-card__thumb');
        if (thumb) thumb.innerHTML = `<img src="${imagem}" alt="Camisa com a frase: ${escapeHtml(produto.frase)}" loading="lazy">`;

        const addBtn = card.querySelector('[data-action="add"]');
        if (addBtn) {
          addBtn.disabled = false;
          addBtn.addEventListener('click', () => {
            adicionarAoCarrinho(produto, imagem);
            addBtn.textContent = '✓';
            setTimeout(() => { addBtn.textContent = '+'; }, 1200);
          });
        }
      } catch (error) {
        console.error('Não foi possível gerar o mockup da frase:', produto.id, error);
      }
    });
  }

  cartBtn?.addEventListener('click', () => { window.location.href = 'carrinho.html'; });

  // Busca do cabeçalho: recarrega a vitrine filtrada (?busca=termo).
  const searchForm = document.getElementById('frasesSearchForm');
  const searchInput = document.getElementById('frasesSearchInput');
  if (searchInput && termoBusca) searchInput.value = termoBusca;
  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const termo = searchInput?.value.trim() || '';
    window.location.href = `camisas-de-frases.html${termo ? `?busca=${encodeURIComponent(termo)}` : ''}`;
  });

  atualizarContadorCarrinho();
  renderGrid();
})();
