/* =========================================================
   Ursoninhos — frase-produto.js
   Página de detalhes estilo marketplace para uma camisa de
   frase (produto-frase.html?id=<id>). O produto vem de
   gerarProdutosDeFrases() (frases-data.js) e o mockup é
   desenhado em canvas com o motor de texto compartilhado.

   Avaliações/nota são ILUSTRATIVAS (fase de testes da loja):
   geradas de forma determinística a partir do id do produto,
   para cada camisa mostrar sempre os mesmos números.
   ========================================================= */

(function () {
  const store = window.UrsoninhosStore;
  const frases = window.UrsoninhosFrases;
  if (!store || !frases) return;

  const produtos = frases.gerarProdutosDeFrases();
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || params.get('frase') || '';
  const produto = produtos.find((p) => p.id === id);

  if (!produto) {
    window.location.replace('camisas-de-frases.html');
    return;
  }

  // Mesmo enquadramento dos thumbs do carrinho/vitrine.
  const MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';
  const PRINT_CENTER_X = 0.478;
  const PRINT_TOP_Y = 0.30;
  const PRINT_SIZE = 0.34;

  let tamanhoSelecionado = 'M';
  let mockupDataUrl = '';

  // Número estável por produto (nota, quantidade de avaliações etc.).
  const hash = Array.from(produto.id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const nota = 4.6 + (hash % 5) * 0.1; // 4,6 a 5,0
  const totalAvaliacoes = 80 + (hash % 220);

  function formatNota(value) {
    return value.toFixed(1).replace('.', ',');
  }

  function atualizarContadorCarrinho() {
    const el = document.getElementById('pfCartCount');
    if (el) el.textContent = String(store.getCartCount());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function carregarImagem(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function gerarMockup(alvo, tamanhoCanvas = 1024) {
    await textFontsReady;
    const base = await carregarImagem(MOCKUP_URL);
    const preset = TEXT_PRINT_PRESETS.find((p) => p.id === alvo.presetId) || TEXT_PRINT_PRESETS[0];

    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 1024;
    drawTextPrint(textCanvas, preset, alvo.linhas);

    const canvas = document.createElement('canvas');
    canvas.width = tamanhoCanvas;
    canvas.height = tamanhoCanvas;
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

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  function preencherCabecalhoProduto() {
    document.title = `Camisa de Frase "${produto.frase}" | Ursoninhos`;

    const titleEl = document.getElementById('pfTitle');
    if (titleEl) titleEl.textContent = produto.frase;

    const starsFill = document.getElementById('pfStarsFill');
    if (starsFill) starsFill.style.width = `${(nota / 5) * 100}%`;
    const ratingText = document.getElementById('pfRatingText');
    if (ratingText) ratingText.textContent = `${formatNota(nota)} (${totalAvaliacoes} avaliações)`;

    const priceEl = document.getElementById('pfPrice');
    if (priceEl) priceEl.textContent = store.formatBRL(produto.preco);
    const installmentsEl = document.getElementById('pfInstallments');
    if (installmentsEl) installmentsEl.textContent = `ou 3x de ${store.formatBRL(produto.preco / 3)} sem juros`;

    const styleEl = document.getElementById('pfStyleName');
    if (styleEl) styleEl.textContent = produto.presetName;

    const customizeLink = document.getElementById('pfCustomizeLink');
    if (customizeLink) customizeLink.href = `index.html?frase=${encodeURIComponent(produto.id)}#hero`;

    const breadcrumbCurrent = document.querySelector('.pf-breadcrumb__current');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = produto.titulo;
  }

  function preencherAbas() {
    const descricao = document.getElementById('pfPanelDescricao');
    if (descricao) {
      descricao.innerHTML = `
        <p>A Camisa de Frase <strong>“${escapeHtml(produto.frase)}”</strong> é perfeita para quem curte frases sarcásticas e diretas.</p>
        <p>Produzida com materiais premium, ela oferece conforto, durabilidade e um caimento impecável.</p>
        <p>Ideal para o dia a dia, a estampa em alta definição no estilo <strong>${escapeHtml(produto.presetName)}</strong> ainda garante que sua mensagem seja resistente à lavagem.</p>
      `;
    }

    const detalhes = document.getElementById('pfPanelDetalhes');
    if (detalhes) {
      detalhes.innerHTML = `
        <ul class="pf-details-list">
          <li><strong>Categoria:</strong> Camisas de Frases (frases desmotivacionais)</li>
          <li><strong>Frase:</strong> ${escapeHtml(produto.frase)}</li>
          <li><strong>Estilo da estampa:</strong> ${escapeHtml(produto.presetName)}</li>
          <li><strong>Malha:</strong> 100% algodão fio 30.1 penteado</li>
          <li><strong>Tamanhos:</strong> P, M, G, GG e XGG</li>
          <li><strong>Impressão:</strong> alta definição, resistente à lavagem</li>
          <li><strong>Produção:</strong> própria, Ursoninhos</li>
        </ul>
      `;
    }

    const tabAvaliacoes = document.getElementById('pfTabAvaliacoes');
    if (tabAvaliacoes) tabAvaliacoes.textContent = `Avaliações (${totalAvaliacoes})`;

    const avaliacoes = document.getElementById('pfPanelAvaliacoes');
    if (avaliacoes) {
      const POOL = [
        { nome: 'Marina S.', nota: 5, texto: 'A frase rendeu risadas no trabalho inteiro. Qualidade da malha surpreendeu, super macia.' },
        { nome: 'Carlos H.', nota: 5, texto: 'Estampa muito bem feita, não desbotou depois de várias lavagens. Recomendo.' },
        { nome: 'Paula R.', nota: 4, texto: 'Caimento ótimo e a frase é exatamente o meu humor. Só achei que demorou um pouco a entrega.' },
        { nome: 'Diego M.', nota: 5, texto: 'Comprei de presente e a pessoa amou. O estilo do texto ficou idêntico ao do site.' },
        { nome: 'Fernanda L.', nota: 5, texto: 'Já é minha segunda camisa de frase. Viciante, quero a coleção inteira.' },
        { nome: 'Rafael T.', nota: 4, texto: 'Tecido de qualidade e tamanho fiel à tabela. A frase abre conversa em qualquer lugar.' },
      ];
      const selecionadas = [0, 1, 2].map((i) => POOL[(hash + i * 2) % POOL.length]);
      avaliacoes.innerHTML = `
        ${selecionadas.map((r) => `
          <article class="pf-review">
            <header>
              <strong>${r.nome}</strong>
              <span class="pf-stars pf-stars--small" aria-label="${r.nota} de 5 estrelas"><span class="pf-stars__fill" style="width:${(r.nota / 5) * 100}%">★★★★★</span>★★★★★</span>
            </header>
            <p>${r.texto}</p>
          </article>
        `).join('')}
        <p class="pf-reviews-note">Avaliações ilustrativas da fase de testes da loja.</p>
      `;
    }
  }

  function configurarAbas() {
    const botoes = document.querySelectorAll('.pf-tabs__nav button');
    const paineis = document.querySelectorAll('.pf-tabs__panel');
    botoes.forEach((botao) => {
      botao.addEventListener('click', () => {
        botoes.forEach((b) => b.classList.toggle('is-active', b === botao));
        paineis.forEach((p) => { p.hidden = p.dataset.panel !== botao.dataset.tab; });
      });
    });
  }

  function configurarOpcoes() {
    document.querySelectorAll('#pfSizeButtons button').forEach((botao) => {
      botao.addEventListener('click', () => {
        tamanhoSelecionado = botao.dataset.size;
        document.querySelectorAll('#pfSizeButtons button').forEach((b) => b.classList.toggle('is-active', b === botao));
      });
    });

    const guideToggle = document.getElementById('pfSizeGuideToggle');
    const guide = document.getElementById('pfSizeGuide');
    guideToggle?.addEventListener('click', () => { if (guide) guide.hidden = !guide.hidden; });

    const qtyInput = document.getElementById('pfQtyInput');
    document.getElementById('pfQtyDecrease')?.addEventListener('click', () => {
      qtyInput.value = String(Math.max(1, parseInt(qtyInput.value || '1', 10) - 1));
    });
    document.getElementById('pfQtyIncrease')?.addEventListener('click', () => {
      qtyInput.value = String(Math.max(1, parseInt(qtyInput.value || '1', 10) + 1));
    });
  }

  function adicionarAoCarrinho() {
    const qty = Math.max(1, parseInt(document.getElementById('pfQtyInput')?.value || '1', 10) || 1);
    store.addCartItem({
      productId: `camisa-frase::${produto.id}`,
      title: 'Camisa de Frase',
      variantLabel: `Frase: ${produto.titulo}`,
      price: produto.preco,
      size: tamanhoSelecionado,
      quantity: qty,
      previewImage: mockupDataUrl,
      previewViews: { front: mockupDataUrl },
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

  function configurarAcoes() {
    const note = document.getElementById('pfActionNote');
    document.getElementById('pfAddToCartBtn')?.addEventListener('click', () => {
      adicionarAoCarrinho();
      if (note) note.textContent = `Adicionada ao carrinho (tamanho ${tamanhoSelecionado}).`;
    });
    document.getElementById('pfBuyNowBtn')?.addEventListener('click', () => {
      adicionarAoCarrinho();
      window.location.href = 'carrinho.html';
    });
    document.getElementById('pfCartBtn')?.addEventListener('click', () => {
      window.location.href = 'carrinho.html';
    });

    const searchForm = document.getElementById('pfSearchForm');
    searchForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const termo = document.getElementById('pfSearchInput')?.value.trim() || '';
      window.location.href = `camisas-de-frases.html${termo ? `?busca=${encodeURIComponent(termo)}` : ''}`;
    });
  }

  // Alterna o visual principal entre o manequim 3D e a foto do cabide.
  function configurarGaleria() {
    const thumb3d = document.getElementById('pfThumb3d');
    const thumbPhoto = document.getElementById('pfThumbPhoto');
    const mediaViewer = document.getElementById('pfMediaViewer');
    const mediaPhoto = document.getElementById('pfMediaPhoto');

    const mostrar = (qual) => {
      if (mediaViewer) mediaViewer.hidden = qual !== '3d';
      if (mediaPhoto) mediaPhoto.hidden = qual !== 'foto';
      thumb3d?.classList.toggle('is-active', qual === '3d');
      thumbPhoto?.classList.toggle('is-active', qual === 'foto');
    };

    thumb3d?.addEventListener('click', () => mostrar('3d'));
    thumbPhoto?.addEventListener('click', () => mostrar('foto'));
  }

  async function renderImagemPrincipal() {
    try {
      // Estampa da frase (PNG transparente) — também alimenta o manequim
      // 3D, que projeta este mesmo desenho no peito da camisa.
      await textFontsReady;
      const preset = TEXT_PRINT_PRESETS.find((p) => p.id === produto.presetId) || TEXT_PRINT_PRESETS[0];
      const textCanvas = document.createElement('canvas');
      textCanvas.width = 1024;
      textCanvas.height = 1024;
      drawTextPrint(textCanvas, preset, produto.linhas);
      const estampaDataUrl = textCanvas.toDataURL('image/png');

      window.UrsoninhosFraseProdutoAtual = { produto, estampaDataUrl };
      window.dispatchEvent(new Event('frase-produto-pronto'));

      mockupDataUrl = await gerarMockup(produto);
      const img = document.getElementById('pfImage');
      const loading = document.getElementById('pfImageLoading');
      if (img) {
        img.src = mockupDataUrl;
        img.alt = `Camisa preta com a frase: ${produto.frase}`;
        img.hidden = false;
      }
      if (loading) loading.hidden = true;

      // Miniatura da foto do cabide, logo abaixo do manequim 3D.
      const thumbPhoto = document.getElementById('pfThumbPhoto');
      if (thumbPhoto) {
        thumbPhoto.innerHTML = `<img src="${mockupDataUrl}" alt="Miniatura: camisa no cabide com a frase">`;
      }
    } catch (error) {
      console.error('Não foi possível gerar o mockup do produto:', error);
    }
  }

  async function renderRelacionados() {
    const grid = document.getElementById('pfRelatedGrid');
    if (!grid) return;

    const relacionados = [1, 2, 3, 4].map((i) => produtos[(produtos.indexOf(produto) + i) % produtos.length]);
    grid.innerHTML = relacionados.map((p) => `
      <article class="product-card frase-card" data-product-id="${p.id}">
        <a class="product-card__thumb product-card__thumb--catalog frase-card__thumb" href="produto-frase.html?id=${encodeURIComponent(p.id)}" aria-label="Ver produto: ${escapeHtml(p.frase)}">
          <span class="frase-card__loading">Gerando…</span>
        </a>
        <h3 title="${escapeHtml(p.frase)}">${escapeHtml(p.titulo)}</h3>
        <p class="product-card__price">${store.formatBRL(p.preco)}</p>
        <p class="product-card__meta">Estilo: ${escapeHtml(p.presetName)}</p>
      </article>
    `).join('');

    relacionados.forEach(async (p) => {
      try {
        const imagem = await gerarMockup(p, 640);
        const thumb = grid.querySelector(`[data-product-id="${p.id}"] .frase-card__thumb`);
        if (thumb) thumb.innerHTML = `<img src="${imagem}" alt="Camisa com a frase: ${escapeHtml(p.frase)}" loading="lazy">`;
      } catch (error) {
        console.error('Não foi possível gerar o mockup relacionado:', p.id, error);
      }
    });
  }

  preencherCabecalhoProduto();
  preencherAbas();
  configurarAbas();
  configurarOpcoes();
  configurarAcoes();
  configurarGaleria();
  atualizarContadorCarrinho();
  renderImagemPrincipal();
  renderRelacionados();
})();
