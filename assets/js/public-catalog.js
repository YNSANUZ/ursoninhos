(function () {
  const api = window.UrsoninhosApi;
  const store = window.UrsoninhosStore;
  const grid = document.getElementById('publicProductsGrid');

  if (!api || !store || !grid) return;

  function addProductToCart(product, quantity = 1) {
    store.addCartItem({
      productId: `publico::${product.id}`,
      title: product.title,
      variantLabel: 'Modelo publico',
      price: Number(product.price || 0),
      size: 'M',
      quantity,
      previewImage: product.catalogImage,
      previewViews: {
        front: product.views?.front || product.catalogImage,
        back: product.views?.back || '',
        right: product.views?.right || '',
        left: product.views?.left || '',
      },
      metadata: {
        productId: product.id,
        source: 'public-model',
      },
    });
  }

  function bindCardEvents(products) {
    grid.querySelectorAll('.public-product-card').forEach((card) => {
      const product = products.find((entry) => entry.id === card.dataset.productId);
      if (!product) return;

      card.querySelector('[data-action="details"]')?.addEventListener('click', () => {
        window.location.href = `produto.html?id=${encodeURIComponent(product.id)}`;
      });

      card.querySelector('[data-action="add"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        addProductToCart(product, 1);
      });

      card.querySelector('[data-action="plus"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        addProductToCart(product, 1);
      });
    });
  }

  // Produto válido tem imagem de card de verdade (dataURL ou http) —
  // isso filtra registros de teste/quebrados do backend.
  function isValidProduct(product) {
    const image = String(product.catalogImage || '');
    return image.startsWith('data:') || image.startsWith('http');
  }

  // Vendas exibidas = campo do backend (futuro) + vendas locais. Só
  // aparece a partir de 1 venda; 0 fica oculto.
  function getDisplaySales(product) {
    return Number(product.sales || 0) + store.getLocalSales(product.id);
  }

  async function renderPublicProducts() {
    try {
      const products = (await api.listProducts()).filter(isValidProduct);

      if (!products.length) {
        grid.innerHTML = '<p class="catalog-placeholder">Nenhum modelo publico foi publicado ainda.</p>';
        return;
      }

      grid.innerHTML = products.map((product) => {
        const { description, creator } = store.parseCreator(product.description);
        const sales = getDisplaySales(product);
        return `
        <article class="product-card public-product-card" data-product-id="${product.id}">
          <button type="button" class="product-card__thumb product-card__thumb--catalog" data-action="details">
            <img src="${product.catalogImage}" alt="${product.title}" loading="lazy">
          </button>
          <h3>${product.title}</h3>
          <p class="product-card__price">${store.formatBRL(product.price)}</p>
          <p class="product-card__meta">${description}</p>
          <p class="product-card__creator">Criado por <strong>${creator || 'Loja Ursoninhos'}</strong></p>
          ${sales >= 1 ? `<span class="product-card__sales">${sales} ${sales === 1 ? 'venda' : 'vendas'}</span>` : ''}
          <div class="product-card__actions">
            <button type="button" class="product-card__add" data-action="add">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h3l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 6H6"/></svg>
              Adicionar x1
            </button>
            <button type="button" class="product-card__quick-add" data-action="plus" aria-label="Adicionar mais uma unidade">+</button>
          </div>
        </article>
      `;
      }).join('');

      bindCardEvents(products);
    } catch (error) {
      console.error('Nao foi possivel carregar os modelos publicos:', error);
      grid.innerHTML = '<p class="catalog-placeholder">Nao foi possivel carregar os modelos publicos agora.</p>';
    }
  }

  // Permite ao main.js (botão "Incluir modelo para venda pública")
  // atualizar a vitrine logo após publicar.
  window.UrsoninhosCatalog = { refresh: renderPublicProducts };

  renderPublicProducts();
})();
