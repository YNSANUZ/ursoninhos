import { createInteractiveViewer } from './interactive-viewer3d.js';

const api = window.UrsoninhosApi;
const store = window.UrsoninhosStore;

const productTitle = document.getElementById('productTitle');
const productDescription = document.getElementById('productDescription');
const productPricePill = document.getElementById('productPricePill');
const productViewerEl = document.getElementById('productViewer');
const productPageCartCount = document.getElementById('productPageCartCount');
const productPageCartBtn = document.getElementById('productPageCartBtn');
const productSizeSelect = document.getElementById('productSizeSelect');
const productQtyInput = document.getElementById('productQtyInput');
const productQtyDecrease = document.getElementById('productQtyDecrease');
const productQtyIncrease = document.getElementById('productQtyIncrease');
const productAddToCartBtn = document.getElementById('productAddToCartBtn');
const productActionNote = document.getElementById('productActionNote');
const relatedProductsGrid = document.getElementById('relatedProductsGrid');

let viewer = null;
let currentProduct = null;

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function updateCartCount() {
  if (!productPageCartCount || !store) return;
  productPageCartCount.textContent = String(store.getCartCount());
}

function normalizeQty() {
  const value = Math.max(1, parseInt(productQtyInput?.value || '1', 10) || 1);
  if (productQtyInput) productQtyInput.value = String(value);
  return value;
}

function setActionNote(message) {
  if (productActionNote) productActionNote.textContent = message;
}

async function loadProduct3d(product) {
  if (!productViewerEl) return;

  viewer = await createInteractiveViewer({ container: productViewerEl, cameraDistance: 2.15 });

  const sides = [
    ['front', product.model?.front],
    ['back', product.model?.back],
    ['sleeveRight', product.model?.sleeveRight],
    ['sleeveLeft', product.model?.sleeveLeft],
  ];

  for (const [sideKey, sideState] of sides) {
    if (!sideState?.url) continue;
    await viewer.setPrint(sideKey, sideState.url, sideState.blend || 'normal');
    if (sideState.transform) {
      viewer.setTransform(sideKey, sideState.transform);
    }
  }

  if (viewer.controls) {
    viewer.controls.autoRotate = true;
    viewer.controls.autoRotateSpeed = 0.7;
  }
}

function renderProductInfo(product) {
  // A descrição pode carregar o marcador [criador:Nome]; separa o
  // texto limpo do crédito antes de exibir.
  const { description, creator } = store.parseCreator(product.description);

  if (productTitle) productTitle.textContent = product.title;
  if (productDescription) productDescription.textContent = description;
  if (productPricePill) productPricePill.textContent = store.formatBRL(product.price);
  document.title = `Ursoninhos | ${product.title}`;

  const creditsEl = document.getElementById('productCredits');
  const creatorEl = document.getElementById('productCreator');
  const salesEl = document.getElementById('productSales');
  if (creditsEl && creatorEl) {
    creatorEl.textContent = creator || 'Loja Ursoninhos';
    creditsEl.hidden = false;
  }
  // Vendas: backend (futuro campo "sales") + vendas locais; só mostra ≥1.
  const sales = Number(product.sales || 0) + store.getLocalSales(product.id);
  if (salesEl) {
    salesEl.textContent = `${sales} ${sales === 1 ? 'venda' : 'vendas'}`;
    salesEl.hidden = sales < 1;
  }
}

function addCurrentProductToCart() {
  if (!currentProduct || !store) return;

  const quantity = normalizeQty();
  const size = productSizeSelect?.value || 'M';

  store.addCartItem({
    productId: `publico::${currentProduct.id}`,
    title: currentProduct.title,
    variantLabel: 'Modelo publico',
    price: Number(currentProduct.price || 0),
    size,
    quantity,
    previewImage: currentProduct.catalogImage,
    previewViews: {
      front: currentProduct.views?.front || currentProduct.catalogImage,
      back: currentProduct.views?.back || '',
      right: currentProduct.views?.right || '',
      left: currentProduct.views?.left || '',
    },
    metadata: {
      productId: currentProduct.id,
      source: 'public-model',
    },
  });

  updateCartCount();
  setActionNote('Produto adicionado ao carrinho com sucesso.');
}

function bindControls() {
  productQtyDecrease?.addEventListener('click', () => {
    productQtyInput.value = String(Math.max(1, normalizeQty() - 1));
  });

  productQtyIncrease?.addEventListener('click', () => {
    productQtyInput.value = String(normalizeQty() + 1);
  });

  productQtyInput?.addEventListener('change', normalizeQty);
  productAddToCartBtn?.addEventListener('click', addCurrentProductToCart);
  productPageCartBtn?.addEventListener('click', () => {
    window.location.href = 'carrinho.html';
  });

  document.querySelectorAll('[data-product-camera]').forEach((button) => {
    button.addEventListener('click', () => {
      viewer?.setCameraAngle(Number(button.dataset.productCamera || 0));
    });
  });
}

function renderRelatedProducts(products) {
  if (!relatedProductsGrid) return;

  const others = products
    .filter((product) => product.id !== currentProduct?.id)
    .filter((product) => String(product.catalogImage || '').startsWith('data:') || String(product.catalogImage || '').startsWith('http'))
    .slice(0, 4);

  if (!others.length) {
    relatedProductsGrid.innerHTML = '<p class="catalog-placeholder">Publique mais modelos para aparecerem aqui.</p>';
    return;
  }

  relatedProductsGrid.innerHTML = others.map((product) => `
    <article class="product-card public-product-card" data-related-id="${product.id}">
      <button type="button" class="product-card__thumb product-card__thumb--catalog" data-action="open">
        <img src="${product.catalogImage}" alt="${product.title}">
      </button>
      <h3>${product.title}</h3>
      <p class="product-card__price">${store.formatBRL(product.price)}</p>
      <p class="product-card__meta">${store.parseCreator(product.description).description}</p>
      <div class="product-card__actions">
        <button type="button" class="product-card__add" data-action="open">Ver produto</button>
      </div>
    </article>
  `).join('');

  relatedProductsGrid.querySelectorAll('[data-action="open"]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-related-id]');
      if (!card) return;
      window.location.href = `produto.html?id=${encodeURIComponent(card.dataset.relatedId)}`;
    });
  });
}

async function init() {
  const productId = getProductId();
  if (!productId || !api || !store) {
    if (productTitle) productTitle.textContent = 'Produto nao encontrado';
    if (productDescription) productDescription.textContent = 'Abra um produto a partir da home para ver os detalhes.';
    return;
  }

  updateCartCount();
  bindControls();

  currentProduct = await api.getProduct(productId);
  renderProductInfo(currentProduct);
  await loadProduct3d(currentProduct);

  const allProducts = await api.listProducts();
  renderRelatedProducts(allProducts);
}

init().catch((error) => {
  console.error('Nao foi possivel abrir a pagina do produto:', error);
  if (productTitle) productTitle.textContent = 'Erro ao carregar o produto';
  if (productDescription) productDescription.textContent = 'Verifique se o backend da Hostinger ja esta publicado.';
});
