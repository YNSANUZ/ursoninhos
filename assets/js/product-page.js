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
const productShareBtn = document.getElementById('productShareBtn');
const mediaPhoto = document.getElementById('publicProductMediaPhoto');
const mediaViewer = document.getElementById('publicProductMediaViewer');
const productImage = document.getElementById('publicProductImage');
const productImageLoading = document.getElementById('publicProductImageLoading');
const productThumbPhoto = document.getElementById('publicProductThumbPhoto');
const productThumbPhotoLoading = document.getElementById('publicProductThumbPhotoLoading');
const productThumb3d = document.getElementById('publicProductThumb3d');
const productViewerLoading = document.getElementById('publicProductViewerLoading');
const productViewerHint = document.getElementById('publicProductViewerHint');
const productCameras = document.getElementById('publicProductCameras');
const productAdminActions = document.getElementById('productAdminActions');
const productEditToggleBtn = document.getElementById('productEditToggleBtn');
const productDeleteBtn = document.getElementById('productDeleteBtn');
const productEditorForm = document.getElementById('productEditorForm');
const productEditorTitle = document.getElementById('productEditorTitle');
const productEditorPrice = document.getElementById('productEditorPrice');
const productEditorCreator = document.getElementById('productEditorCreator');
const productEditorCreatorPhoto = document.getElementById('productEditorCreatorPhoto');
const productEditorCatalogImage = document.getElementById('productEditorCatalogImage');
const productEditorDescription = document.getElementById('productEditorDescription');
const productEditorCancelBtn = document.getElementById('productEditorCancelBtn');
const productEditorNote = document.getElementById('productEditorNote');

let viewer = null;
let currentProduct = null;
let viewerReady = false;
let editorOpen = false;
const CARD_MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';
const PREVIEW_CANVAS_SIZE = 900;
const PREVIEW_PRINT_CENTER_X = 0.478;
const PREVIEW_PRINT_TOP_Y = 0.30;
const PREVIEW_PRINT_SIZE = 0.34;
const previewCache = new Map();

function getProductKey() {
  const shortPathMatch = window.location.pathname.match(/^\/(\d{4})\/?$/);
  if (shortPathMatch) return shortPathMatch[1];
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function syncShortUrl(product) {
  const shortPath = product?.shortPath || (product?.shortId ? `/${product.shortId}/` : '');
  if (!shortPath) return;
  if (window.location.pathname === shortPath && !window.location.search) return;
  window.history.replaceState({}, '', shortPath);
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

function setEditorNote(message, isError = false) {
  if (!productEditorNote) return;
  productEditorNote.textContent = message;
  productEditorNote.style.color = isError ? '#e08a7a' : '';
}

function isAdminUser() {
  return store?.getCurrentUser?.()?.role === 'admin';
}

function creatorAvatarMarkup(product, creatorName) {
  const accountUi = window.UrsoninhosAccountUI;
  if (accountUi?.buildAvatarMarkup) {
    return accountUi.buildAvatarMarkup({
      name: creatorName,
      photoUrl: product?.creatorPhoto || '',
    }, 'public-product-avatar');
  }

  const initials = String(creatorName || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
  const image = product?.creatorPhoto
    ? `<img class="public-product-avatar__image" src="${product.creatorPhoto}" alt="${creatorName}">`
    : '';

  return `
    <span class="public-product-avatar">
      <span class="public-product-avatar__fallback">${initials}</span>
      ${image}
    </span>
  `;
}

function showPhotoMedia() {
  mediaPhoto?.removeAttribute('hidden');
  mediaViewer?.setAttribute('hidden', '');
  productCameras?.setAttribute('hidden', '');
  productThumbPhoto?.classList.add('is-active');
  productThumb3d?.classList.remove('is-active');
}

function showViewerMedia() {
  if (!viewerReady) return;
  mediaViewer?.removeAttribute('hidden');
  mediaPhoto?.setAttribute('hidden', '');
  productCameras?.removeAttribute('hidden');
  productThumb3d?.classList.add('is-active');
  productThumbPhoto?.classList.remove('is-active');
}

function fillEditor(product) {
  if (!productEditorForm) return;
  productEditorTitle.value = product.title || '';
  productEditorPrice.value = String(Number(product.price || 0).toFixed(2));
  productEditorCreator.value = product.creator || store.parseCreator(product.description).creator || '';
  productEditorCreatorPhoto.value = product.creatorPhoto || '';
  productEditorCatalogImage.value = product.catalogImage || '';
  productEditorDescription.value = store.parseCreator(product.description).description || '';
}

function toggleEditor(force) {
  if (!productEditorForm) return;
  editorOpen = typeof force === 'boolean' ? force : !editorOpen;
  productEditorForm.hidden = !editorOpen;
  if (editorOpen && currentProduct) fillEditor(currentProduct);
  if (!editorOpen) setEditorNote('');
}

function setPhotoPreview(src, title) {
  if (!productImage || !productThumbPhoto) return;
  const fallback = 'assets/img/banner-estatico.jpg';
  const finalSrc = src || fallback;
  productImage.src = finalSrc;
  productImage.alt = title ? `${title} - foto principal` : 'Foto principal do produto';
  productImage.hidden = false;
  if (productImageLoading) productImageLoading.hidden = true;
  if (productThumbPhotoLoading) productThumbPhotoLoading.hidden = true;
  productThumbPhoto.innerHTML = `<img src="${finalSrc}" alt="${title ? `Miniatura ${title}` : 'Miniatura do produto'}">`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function buildFlatMockup(printUrl, transform = {}, blend = 'screen') {
  if (!printUrl) return '';

  const cacheKey = JSON.stringify({ printUrl, transform, blend });
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);

  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_CANVAS_SIZE;
    canvas.height = PREVIEW_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    const base = await loadImage(CARD_MOCKUP_URL);
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    const printImage = await loadImage(printUrl);
    const scale = Number(transform.scale || 1);
    const offsetX = Number(transform.offsetX || 0);
    const offsetY = Number(transform.offsetY || 0);
    const printWidth = canvas.width * PREVIEW_PRINT_SIZE * scale;
    const printHeight = canvas.height * PREVIEW_PRINT_SIZE * scale;
    const x = canvas.width * PREVIEW_PRINT_CENTER_X - printWidth / 2 + offsetX * 10;
    const y = canvas.height * PREVIEW_PRINT_TOP_Y + offsetY * 10;

    ctx.globalCompositeOperation = blend === 'screen' ? 'screen' : 'source-over';
    ctx.drawImage(printImage, x, y, printWidth, printHeight);
    ctx.globalCompositeOperation = 'source-over';

    return canvas.toDataURL('image/jpeg', 0.9);
  })().catch(() => '');

  previewCache.set(cacheKey, promise);
  return promise;
}

async function resolvePrimaryPhoto(product) {
  const frontModel = product?.model?.front;
  if (frontModel?.url) {
    const mockup = await buildFlatMockup(
      frontModel.url,
      frontModel.transform || {},
      frontModel.blend || 'screen',
    );
    if (mockup) return mockup;
  }

  return product?.views?.front || product?.catalogImage || 'assets/img/banner-estatico.jpg';
}

async function ensureViewer(product) {
  if (viewerReady || !productViewerEl) return;

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

  viewerReady = true;
  if (productViewerLoading) productViewerLoading.hidden = true;
  if (productViewerHint) productViewerHint.hidden = false;
}

async function renderProductInfo(product) {
  const { description, creator } = store.parseCreator(product.description);
  const creatorName = creator || product.creator || 'Loja Ursoninhos';

  if (productTitle) productTitle.textContent = product.title;
  if (productDescription) productDescription.textContent = description;
  if (productPricePill) productPricePill.textContent = store.formatBRL(product.price);
  document.title = `Ursoninhos | ${product.title}`;

  const creditsEl = document.getElementById('productCredits');
  const creatorEl = document.getElementById('productCreator');
  const creatorAvatarEl = document.getElementById('productCreatorAvatar');
  const salesEl = document.getElementById('productSales');
  if (creditsEl && creatorEl) {
    creatorEl.textContent = creatorName;
    if (creatorAvatarEl) creatorAvatarEl.innerHTML = creatorAvatarMarkup(product, creatorName);
    creditsEl.hidden = false;
  }

  const sales = Number(product.sales || 0) + store.getLocalSales(product.id);
  if (salesEl) {
    salesEl.textContent = `${sales} ${sales === 1 ? 'venda' : 'vendas'}`;
    salesEl.hidden = sales < 1;
  }

  const photoSrc = await resolvePrimaryPhoto(product);
  setPhotoPreview(photoSrc, product.title);
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
    previewImage: currentProduct.catalogImage || currentProduct.views?.front || '',
    previewViews: {
      front: currentProduct.views?.front || currentProduct.catalogImage || '',
      back: currentProduct.views?.back || '',
      right: currentProduct.views?.right || '',
      left: currentProduct.views?.left || '',
    },
    metadata: {
      productId: currentProduct.id,
      source: 'public-model',
      productPath: api.getProductPath(currentProduct),
    },
  });

  updateCartCount();
  setActionNote('Produto adicionado ao carrinho com sucesso.');
}

async function shareCurrentProduct() {
  if (!currentProduct || !api) return;
  const url = new URL(api.getProductPath(currentProduct), window.location.origin).toString();
  const title = currentProduct.title || 'Produto Ursoninhos';
  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text: `Olha esse modelo da comunidade Ursoninhos: ${title}`,
        url,
      });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setActionNote('Link copiado para compartilhar.');
      return;
    } else {
      setActionNote(url);
      return;
    }
    setActionNote('Link pronto para compartilhar.');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setActionNote('Nao foi possivel abrir o compartilhamento agora.');
    }
  }
}

async function saveAdminEdits(event) {
  event.preventDefault();
  if (!currentProduct || !api || !isAdminUser()) return;

  const creatorName = String(productEditorCreator?.value || '').trim() || 'Loja Ursoninhos';
  const plainDescription = String(productEditorDescription?.value || '').trim();
  const payload = {
    title: String(productEditorTitle?.value || '').trim(),
    price: Number(productEditorPrice?.value || 0),
    creator: creatorName,
    creatorPhoto: String(productEditorCreatorPhoto?.value || '').trim(),
    catalogImage: String(productEditorCatalogImage?.value || '').trim(),
    description: store.embedCreator(plainDescription, creatorName),
  };

  if (!payload.title) {
    setEditorNote('Informe um nome para o produto.', true);
    return;
  }
  if (!payload.catalogImage) {
    setEditorNote('Informe a imagem principal do produto.', true);
    return;
  }
  if (!(payload.price > 0)) {
    setEditorNote('Informe um preço válido.', true);
    return;
  }

  try {
    setEditorNote('Salvando alterações...');
    currentProduct = await api.updateProduct(currentProduct.id, payload);
    await renderProductInfo(currentProduct);
    toggleEditor(false);
    setActionNote('Produto atualizado com sucesso.');
  } catch (error) {
    setEditorNote(error.message || 'Nao foi possivel salvar agora.', true);
  }
}

async function deleteCurrentProduct() {
  if (!currentProduct || !api || !isAdminUser()) return;
  const confirmed = window.confirm(`Apagar o produto "${currentProduct.title}"?`);
  if (!confirmed) return;

  try {
    await api.deleteProduct(currentProduct.id);
    window.location.href = 'index.html#destaques';
  } catch (error) {
    setActionNote(error.message || 'Nao foi possivel apagar o produto.');
  }
}

function bindControls() {
  productQtyDecrease?.addEventListener('click', () => {
    if (!productQtyInput) return;
    productQtyInput.value = String(Math.max(1, normalizeQty() - 1));
  });

  productQtyIncrease?.addEventListener('click', () => {
    if (!productQtyInput) return;
    productQtyInput.value = String(normalizeQty() + 1);
  });

  productQtyInput?.addEventListener('change', normalizeQty);
  productAddToCartBtn?.addEventListener('click', addCurrentProductToCart);
  productShareBtn?.addEventListener('click', shareCurrentProduct);
  productPageCartBtn?.addEventListener('click', () => {
    window.location.href = 'carrinho.html';
  });

  productThumbPhoto?.addEventListener('click', showPhotoMedia);
  productThumb3d?.addEventListener('click', async () => {
    if (!currentProduct) return;
    await ensureViewer(currentProduct);
    showViewerMedia();
  });

  document.querySelectorAll('[data-product-camera]').forEach((button) => {
    button.addEventListener('click', () => {
      viewer?.setCameraAngle(Number(button.dataset.productCamera || 0));
    });
  });

  productEditToggleBtn?.addEventListener('click', () => toggleEditor());
  productEditorCancelBtn?.addEventListener('click', () => toggleEditor(false));
  productEditorForm?.addEventListener('submit', saveAdminEdits);
  productDeleteBtn?.addEventListener('click', deleteCurrentProduct);
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
      const product = others.find((entry) => entry.id === card.dataset.relatedId);
      if (!product) return;
      window.location.href = api.getProductPath(product);
    });
  });
}

function setupAdminUi() {
  if (!productAdminActions) return;
  productAdminActions.hidden = !isAdminUser();
}

async function init() {
  const productKey = getProductKey();
  if (!productKey || !api || !store) {
    if (productTitle) productTitle.textContent = 'Produto nao encontrado';
    if (productDescription) productDescription.textContent = 'Abra um produto a partir da home para ver os detalhes.';
    return;
  }

  updateCartCount();
  window.addEventListener('ursoninhos-cart-changed', updateCartCount);
  window.addEventListener('ursoninhos-auth-changed', setupAdminUi);
  bindControls();
  setupAdminUi();

  currentProduct = await api.getProduct(productKey);
  syncShortUrl(currentProduct);

  try {
    const linhas = await window.UrsoninhosSheet?.load();
    const row = linhas?.[currentProduct.id];
    if (row?.preco > 0) currentProduct.price = row.preco;
    if (row?.nome) currentProduct.title = row.nome;
  } catch (error) { /* segue com os dados do backend */ }

  await renderProductInfo(currentProduct);
  showPhotoMedia();

  const allProducts = await api.listProducts();
  renderRelatedProducts(allProducts);
}

init().catch((error) => {
  console.error('Nao foi possivel abrir a pagina do produto:', error);
  if (productTitle) productTitle.textContent = 'Erro ao carregar o produto';
  if (productDescription) productDescription.textContent = 'Verifique se o backend da Hostinger ja esta publicado.';
});
