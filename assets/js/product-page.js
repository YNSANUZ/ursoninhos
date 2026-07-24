import { createInteractiveViewer } from './interactive-viewer3d.js?v=6';
import { createProductStlViewer } from './product-stl-viewer.js?v=2';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const api = window.UrsoninhosApi;
const store = window.UrsoninhosStore;
const layerEngine = window.UrsoninhosLayers;

const productTitle = document.getElementById('productTitle');
const productDescription = document.getElementById('productDescription');
const productPricePill = document.getElementById('productPricePill');
const productViewerEl = document.getElementById('productViewer');
const productPageCartCount = document.getElementById('productPageCartCount');
const productPageCartBtn = document.getElementById('productPageCartBtn');
const productSizeSelect = document.getElementById('productSizeSelect');
const productSizeField = document.getElementById('productSizeField');
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
const productEditorImages = document.getElementById('productEditorImages');
const productEditorGallery = document.getElementById('productEditorGallery');
const productEditorDescription = document.getElementById('productEditorDescription');
const productEditorCategories = document.getElementById('productEditorCategories');
const productEditorTags = document.getElementById('productEditorTags');
const productEditorModel = document.getElementById('productEditorModel');
const productEditorModelStatus = document.getElementById('productEditorModelStatus');
const productEditorDeleteModel = document.getElementById('productEditorDeleteModel');
const productTaxonomy = document.getElementById('productTaxonomy');
const productEditorCancelBtn = document.getElementById('productEditorCancelBtn');
const productEditorNote = document.getElementById('productEditorNote');
const productThumbs = document.querySelector('.public-product-thumbs');
const productPriceNote = document.querySelector('.public-product-price__note');
const productCustomizeLink = document.getElementById('productCustomizeLink');
const productChecklist = document.querySelector('.public-product-checklist');
const productBenefits = document.querySelector('.pf-benefits');

let viewer = null;
let currentProduct = null;
let viewerReady = false;
let editorOpen = false;
let editorGalleryUrls = [];
let editorCoverIndex = 0;
let currentProductMeta = { categories: [], tags: [], hasModel: false, modelUrl: '', modelTriangles: 0 };
const IMGBB_API_KEY = 'b7150269142e0e38166f3e528598d051';
const PRODUCT_META_URL = `${window.URSONINHOS_APP_CONFIG?.backendBaseUrl || 'https://primusdf.com.br/_ursoninhos_backend/api'}/product-meta.php`;
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
  editorGalleryUrls = Array.isArray(product.gallery)
    ? product.gallery.filter((url) => /^https:\/\//i.test(String(url || ''))).slice(0, 5)
    : [];
  if (!editorGalleryUrls.length && /^https:\/\//i.test(String(product.catalogImage || ''))) {
    editorGalleryUrls = [product.catalogImage];
  }
  editorCoverIndex = Math.min(Math.max(Number(product.coverIndex || 0), 0), Math.max(editorGalleryUrls.length - 1, 0));
  renderEditorGallery();
  if (productEditorCategories) productEditorCategories.value = (currentProductMeta.categories || []).join(', ');
  if (productEditorTags) productEditorTags.value = (currentProductMeta.tags || []).join(', ');
  renderModelStatus();
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

function splitTerms(value) {
  return [...new Set(String(value || '')
    .split(/[,;\n]+/)
    .map((term) => term.trim().toLocaleLowerCase('pt-BR'))
    .filter(Boolean))];
}

function renderTaxonomy() {
  if (!productTaxonomy) return;
  const terms = [...(currentProductMeta.categories || []), ...(currentProductMeta.tags || [])];
  productTaxonomy.innerHTML = terms.map((term) => `<span>${term}</span>`).join('');
  productTaxonomy.hidden = terms.length === 0;
}

function renderModelStatus() {
  if (!productEditorModelStatus) return;
  const label = productEditorModelStatus.querySelector('span');
  if (label) {
    label.textContent = currentProductMeta.hasModel
      ? `Prévia 3D protegida publicada (${Number(currentProductMeta.modelTriangles || 0).toLocaleString('pt-BR')} triângulos).`
      : 'Nenhum modelo 3D publicado.';
  }
  if (productEditorDeleteModel) productEditorDeleteModel.hidden = !currentProductMeta.hasModel;
}

async function readProductMeta(productId) {
  try {
    const response = await fetch(`${PRODUCT_META_URL}?id=${encodeURIComponent(productId)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok && payload?.meta) currentProductMeta = payload.meta;
  } catch (error) {
    console.warn('Metadados do produto indisponíveis:', error);
  }
  renderTaxonomy();
  renderModelStatus();
}

async function saveProductMeta() {
  const response = await fetch(`${PRODUCT_META_URL}?id=${encodeURIComponent(currentProduct.id)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(store.getAuthHeaders?.() || {}),
    },
    body: JSON.stringify({
      categories: splitTerms(productEditorCategories?.value),
      tags: splitTerms(productEditorTags?.value),
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível salvar categorias e tags.');
  currentProductMeta = payload.meta;
  renderTaxonomy();
}

async function buildProtectedStlPreview(file) {
  if (!file || !/\.stl$/i.test(file.name)) throw new Error('Selecione um arquivo STL.');
  if (file.size > 15 * 1024 * 1024) throw new Error('O STL original deve ter no máximo 15 MB.');

  let geometry = new STLLoader().parse(await file.arrayBuffer());
  geometry = mergeVertices(geometry, 0.00001);
  geometry.computeVertexNormals();
  const originalVertices = geometry.attributes.position?.count || 0;
  if (originalVertices < 9) throw new Error('O STL não possui geometria válida.');

  let previewGeometry = geometry;
  if (originalVertices > 6000) {
    const removeCount = Math.min(
      Math.floor(originalVertices * 0.05),
      Math.max(0, originalVertices - 6000),
    );
    previewGeometry = new SimplifyModifier().modify(geometry, removeCount);
    geometry.dispose();
  }
  previewGeometry = mergeVertices(previewGeometry, 0.00001);
  previewGeometry.computeVertexNormals();
  const mesh = new THREE.Mesh(previewGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
  const binary = new STLExporter().parse(mesh, { binary: true });
  const blob = new Blob([binary.buffer], { type: 'model/stl' });
  const triangles = Math.max(0, Math.floor((previewGeometry.attributes.position?.count || 0) / 3));
  mesh.material.dispose();
  previewGeometry.dispose();
  return { blob, triangles };
}

async function uploadProtectedModel() {
  const file = productEditorModel?.files?.[0];
  if (!file || !currentProduct) return;
  try {
    productEditorModel.disabled = true;
    setEditorNote('Criando uma prévia simplificada e protegida do STL...');
    const preview = await buildProtectedStlPreview(file);
    const form = new FormData();
    form.append('model', preview.blob, 'visualizacao-3d.stl');
    const response = await fetch(`${PRODUCT_META_URL}?action=model&id=${encodeURIComponent(currentProduct.id)}`, {
      method: 'POST',
      headers: { ...(store.getAuthHeaders?.() || {}) },
      body: form,
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível publicar a prévia 3D.');
    currentProductMeta = payload.meta;
    renderModelStatus();
    renderProductGallery(currentProduct, productImage?.src || currentProduct.catalogImage);
    setEditorNote(`Prévia 3D protegida publicada com ${Number(payload.meta?.modelTriangles || preview.triangles).toLocaleString('pt-BR')} triângulos.`);
  } catch (error) {
    setEditorNote(error.message || 'Não foi possível preparar o modelo 3D.', true);
  } finally {
    productEditorModel.disabled = false;
    productEditorModel.value = '';
  }
}

async function deleteProtectedModel() {
  if (!currentProductMeta.hasModel || !currentProduct) return;
  try {
    setEditorNote('Removendo prévia 3D...');
    const response = await fetch(`${PRODUCT_META_URL}?action=delete-model&id=${encodeURIComponent(currentProduct.id)}`, {
      method: 'POST',
      headers: { ...(store.getAuthHeaders?.() || {}) },
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível remover o modelo.');
    currentProductMeta = payload.meta;
    viewer?.dispose?.();
    viewer = null;
    viewerReady = false;
    renderModelStatus();
    renderProductGallery(currentProduct, productImage?.src || currentProduct.catalogImage);
    showPhotoMedia();
    setEditorNote('Modelo 3D removido.');
  } catch (error) {
    setEditorNote(error.message || 'Não foi possível remover o modelo.', true);
  }
}

function renderEditorGallery() {
  if (!productEditorGallery) return;
  productEditorGallery.innerHTML = editorGalleryUrls.map((url, index) => `
    <article class="admin-product-gallery-editor__item${index === editorCoverIndex ? ' is-cover' : ''}">
      <img src="${url}" alt="Foto ${index + 1} do produto">
      <button type="button" data-editor-cover="${index}" aria-label="Usar foto ${index + 1} como capa">★</button>
      <button type="button" data-editor-remove="${index}" aria-label="Excluir foto ${index + 1}">×</button>
      <span>${index === editorCoverIndex ? 'Capa' : `Foto ${index + 1}`}</span>
    </article>
  `).join('');

  productEditorGallery.querySelectorAll('[data-editor-cover]').forEach((button) => {
    button.addEventListener('click', () => {
      editorCoverIndex = Number(button.dataset.editorCover || 0);
      renderEditorGallery();
    });
  });
  productEditorGallery.querySelectorAll('[data-editor-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      editorGalleryUrls.splice(Number(button.dataset.editorRemove || 0), 1);
      editorCoverIndex = Math.min(editorCoverIndex, Math.max(editorGalleryUrls.length - 1, 0));
      renderEditorGallery();
    });
  });
}

async function uploadEditorPhoto(file) {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`, {
    method: 'POST',
    body: form,
  });
  const payload = await response.json();
  const url = payload?.data?.display_url || payload?.data?.url;
  if (!response.ok || !payload?.success || !url) {
    throw new Error(payload?.error?.message || 'Não foi possível enviar a foto.');
  }
  return url;
}

async function handleEditorImages() {
  const files = Array.from(productEditorImages?.files || []);
  if (!files.length) return;
  if (files.length + editorGalleryUrls.length > 5) {
    setEditorNote('O produto pode ter no máximo cinco fotos.', true);
    productEditorImages.value = '';
    return;
  }
  try {
    productEditorImages.disabled = true;
    setEditorNote('Enviando fotos...');
    for (const file of files) editorGalleryUrls.push(await uploadEditorPhoto(file));
    renderEditorGallery();
    setEditorNote('Fotos prontas. Clique em “Salvar alterações” para atualizar o produto.');
  } catch (error) {
    setEditorNote(error.message || 'Não foi possível enviar as fotos.', true);
  } finally {
    productEditorImages.disabled = false;
    productEditorImages.value = '';
  }
}

function renderProductGallery(product, fallbackPhoto) {
  if (!productThumbs || !productThumbPhoto || !productThumb3d) return;
  productThumbs.querySelectorAll('[data-gallery-photo]').forEach((item) => item.remove());

  const gallery = Array.isArray(product?.gallery)
    ? product.gallery.filter((url) => /^https:\/\//i.test(String(url || ''))).slice(0, 5)
    : [];
  const coverIndex = Math.min(Math.max(Number(product?.coverIndex || 0), 0), Math.max(gallery.length - 1, 0));
  const photos = gallery.length ? gallery : [fallbackPhoto].filter(Boolean);

  if (photos.length) {
    setPhotoPreview(photos[coverIndex] || photos[0], product.title);
  }

  photos.forEach((url, index) => {
    if (index === coverIndex) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pf-thumb';
    button.dataset.galleryPhoto = String(index);
    button.setAttribute('aria-label', `Ver foto ${index + 1}`);
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Miniatura ${index + 1} de ${product.title || 'produto'}`;
    button.appendChild(image);
    button.addEventListener('click', () => {
      setPhotoPreview(url, product.title);
      showPhotoMedia();
      productThumbs.querySelectorAll('.pf-thumb').forEach((thumb) => thumb.classList.remove('is-active'));
      button.classList.add('is-active');
    });
    productThumbs.insertBefore(button, productThumb3d);
  });

  const isPhysical = product?.productType === 'produto-3d-fisico' || product?.requiresSize === false;
  const hasShirtViewer = !isPhysical && Object.values(product?.model || {}).some(Boolean);
  productThumb3d.hidden = !(currentProductMeta.hasModel || hasShirtViewer);
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
    const sourceAspect = (printImage.naturalHeight || printImage.height) / (printImage.naturalWidth || printImage.width) || 1;
    const printHeight = printWidth * sourceAspect;
    const x = canvas.width * PREVIEW_PRINT_CENTER_X - printWidth / 2 + offsetX * 10;
    const y = canvas.height * (sourceAspect > 1.2 ? 0.24 : PREVIEW_PRINT_TOP_Y) + offsetY * 10;

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
  const frontLayers = layerEngine?.normalizeSide(frontModel) || [];
  if (frontLayers.length) {
    const composite = await layerEngine.composeLayers(frontLayers, { side: 'front' });
    const mockup = await buildFlatMockup(composite, {}, 'normal');
    if (mockup) return mockup;
  }
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

  if (currentProductMeta.hasModel && currentProductMeta.modelUrl) {
    viewer = await createProductStlViewer({
      container: productViewerEl,
      url: `${currentProductMeta.modelUrl}${currentProductMeta.modelUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(currentProductMeta.updatedAt || Date.now())}`,
    });
    viewerReady = true;
    if (productViewerLoading) productViewerLoading.hidden = true;
    if (productViewerHint) productViewerHint.hidden = false;
    document.querySelectorAll('[data-product-camera]').forEach((button) => {
      const angle = Number(button.dataset.productCamera || 0);
      if (angle === -90) button.textContent = 'Lado dir.';
      if (angle === 90) button.textContent = 'Lado esq.';
    });
    return;
  }

  viewer = await createInteractiveViewer({ container: productViewerEl, cameraDistance: 2.15 });

  const sides = [
    ['front', product.model?.front],
    ['back', product.model?.back],
    ['sleeveRight', product.model?.sleeveRight],
    ['sleeveLeft', product.model?.sleeveLeft],
  ];

  for (const [sideKey, sideState] of sides) {
    const layers = layerEngine?.normalizeSide(sideState) || [];
    if (layers.length) {
      const composite = await layerEngine.composeLayers(layers, { side: sideKey });
      await viewer.setPrint(sideKey, composite, 'normal');
      viewer.setTransform(sideKey, { scale: 1, offsetX: 0, offsetY: 0 });
      continue;
    }
    if (sideState?.url) {
      await viewer.setPrint(sideKey, sideState.url, sideState.blend || 'normal');
      if (sideState.transform) viewer.setTransform(sideKey, sideState.transform);
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
  renderProductGallery(product, photoSrc);

  const isPhysical = product?.productType === 'produto-3d-fisico' || product?.requiresSize === false;
  if (productSizeField) productSizeField.hidden = isPhysical;
  if (productCustomizeLink) productCustomizeLink.hidden = isPhysical;
  if (productPriceNote) {
    productPriceNote.textContent = isPhysical
      ? 'Produto físico pronto para compra, com fotos reais e produção sob demanda.'
      : 'Camisa pronta para compra com visual 3D e produção sob demanda.';
  }
  if (productChecklist && isPhysical) {
    productChecklist.innerHTML = `
      <li>Produto físico produzido sob demanda</li>
      <li>${currentProductMeta.hasModel ? 'Visualização 3D interativa disponível' : 'Fotos reais do produto disponíveis'}</li>
      <li>Quantidade ajustável antes da compra</li>
      <li>Envio para todo o Brasil</li>
    `;
  }
  if (productBenefits && isPhysical) {
    productBenefits.innerHTML = `
      <div class="pf-benefit"><div><strong>Envio para todo o Brasil</strong><span>Receba com segurança</span></div></div>
      <div class="pf-benefit"><div><strong>${currentProductMeta.hasModel ? 'Prévia 3D disponível' : 'Fotos reais do produto'}</strong><span>Confira antes de comprar</span></div></div>
      <div class="pf-benefit"><div><strong>Produção Ursoninhos</strong><span>Acabamento pronto para vender</span></div></div>
    `;
  }
}

function addCurrentProductToCart() {
  if (!currentProduct || !store) return;

  const quantity = normalizeQty();
  const isPhysical = currentProduct?.productType === 'produto-3d-fisico' || currentProduct?.requiresSize === false;
  const size = isPhysical ? '' : (productSizeSelect?.value || 'M');
  const gallery = Array.isArray(currentProduct.gallery) ? currentProduct.gallery : [];
  const coverIndex = Math.min(Math.max(Number(currentProduct.coverIndex || 0), 0), Math.max(gallery.length - 1, 0));
  const previewImage = gallery[coverIndex] || currentProduct.catalogImage || currentProduct.views?.front || '';

  store.addCartItem({
    productId: `publico::${currentProduct.id}`,
    title: currentProduct.title,
    variantLabel: isPhysical ? 'Produto físico 3D' : 'Modelo público',
    price: Number(currentProduct.price || 0),
    size,
    quantity,
    previewImage,
    previewViews: {
      front: currentProduct.views?.front || currentProduct.catalogImage || '',
      back: currentProduct.views?.back || '',
      right: currentProduct.views?.right || '',
      left: currentProduct.views?.left || '',
    },
    metadata: {
      productId: currentProduct.id,
      source: 'public-model',
      productType: currentProduct.productType || 'camisa-3d',
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
  const manualImage = String(productEditorCatalogImage?.value || '').trim();
  if (/^https:\/\//i.test(manualImage) && !editorGalleryUrls.includes(manualImage) && editorGalleryUrls.length < 5) {
    editorGalleryUrls.push(manualImage);
  }
  const coverIndex = Math.min(Math.max(editorCoverIndex, 0), Math.max(editorGalleryUrls.length - 1, 0));
  const coverImage = editorGalleryUrls[coverIndex] || manualImage;
  const payload = {
    title: String(productEditorTitle?.value || '').trim(),
    price: Number(productEditorPrice?.value || 0),
    creator: creatorName,
    creatorPhoto: String(productEditorCreatorPhoto?.value || '').trim(),
    catalogImage: coverImage,
    gallery: editorGalleryUrls,
    coverIndex,
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
    await saveProductMeta();
    const sheetResult = await window.UrsoninhosSheet?.push?.([currentProduct]);
    await renderProductInfo(currentProduct);
    toggleEditor(false);
    setActionNote(sheetResult?.ok === false && !sheetResult.skipped
      ? 'Produto atualizado. A planilha não confirmou a sincronização, então os dados do ADM terão prioridade.'
      : 'Produto e planilha atualizados com sucesso.');
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
  productEditorImages?.addEventListener('change', handleEditorImages);
  productEditorModel?.addEventListener('change', uploadProtectedModel);
  productEditorDeleteModel?.addEventListener('click', deleteProtectedModel);
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
  const shouldOpenEditor = new URLSearchParams(window.location.search).get('edit') === '1';
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
  await readProductMeta(currentProduct.id);

  try {
    const linhas = await window.UrsoninhosSheet?.load();
    const row = linhas?.[currentProduct.id];
    if (!currentProduct.updatedAt) {
      if (row?.preco > 0) currentProduct.price = row.preco;
      if (row?.nome) currentProduct.title = row.nome;
    }
  } catch (error) { /* segue com os dados do backend */ }

  await renderProductInfo(currentProduct);
  showPhotoMedia();

  if (isAdminUser() && shouldOpenEditor) {
    toggleEditor(true);
    productEditorForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const allProducts = await api.listProducts();
  renderRelatedProducts(allProducts);
}

init().catch((error) => {
  console.error('Nao foi possivel abrir a pagina do produto:', error);
  if (productTitle) productTitle.textContent = 'Erro ao carregar o produto';
  if (productDescription) productDescription.textContent = 'Verifique se o backend da Hostinger ja esta publicado.';
});
