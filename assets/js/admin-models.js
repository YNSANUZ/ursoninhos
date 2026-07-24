import { createInteractiveViewer } from './interactive-viewer3d.js?v=6';

const config = window.URSONINHOS_APP_CONFIG || {};
const api = window.UrsoninhosApi;
const store = window.UrsoninhosStore;

const defaultLogoUrl = config.defaultLogoUrl || '';
// Mockup da camisa preta no cabide usado na imagem de card do catálogo.
const CARD_MOCKUP_URL = 'assets/img/camisa-modelo-card.jpg';

const adminViewerEl = document.getElementById('adminViewer');
const adminPublishForm = document.getElementById('adminPublishForm');
const adminPublishNote = document.getElementById('adminPublishNote');
const adminTitleInput = document.getElementById('adminTitleInput');
const adminDescriptionInput = document.getElementById('adminDescriptionInput');
const adminFrontUrl = document.getElementById('adminFrontUrl');
const adminBackUrl = document.getElementById('adminBackUrl');
const adminRightUrl = document.getElementById('adminRightUrl');
const adminLeftUrl = document.getElementById('adminLeftUrl');
const previewFront = document.getElementById('previewFront');
const previewBack = document.getElementById('previewBack');
const previewRight = document.getElementById('previewRight');
const previewLeft = document.getElementById('previewLeft');
const applyDefaultLogoBtn = document.getElementById('applyDefaultLogoBtn');
const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
const layerEngine = window.UrsoninhosLayers;
const textEngine = window.UrsoninhosTextPrint;
const adminArtworkLibrary = document.getElementById('adminArtworkLibrary');
const adminProductList = document.getElementById('adminProductList');
const adminLayerEditor = document.getElementById('adminLayerEditor');
const adminLayerSides = document.getElementById('adminLayerSides');
const adminEditingTitle = document.getElementById('adminEditingTitle');
const adminEditTitle = document.getElementById('adminEditTitle');
const adminEditPrice = document.getElementById('adminEditPrice');
const adminEditDescription = document.getElementById('adminEditDescription');
const adminLayerEditorNote = document.getElementById('adminLayerEditorNote');
const refreshAdminLibraryBtn = document.getElementById('refreshAdminLibraryBtn');
const closeAdminLayerEditorBtn = document.getElementById('closeAdminLayerEditorBtn');
const previewAdminLayersBtn = document.getElementById('previewAdminLayersBtn');
const adminSaveProductBtn = document.getElementById('adminSaveProductBtn');
const ADMIN_EMAILS = ['ynsanuz@gmail.com', 'obstruir#gmail.com'];
const IMGBB_API_KEY = 'b7150269142e0e38166f3e528598d051';
const physicalProductForm = document.getElementById('adminPhysicalProductForm');
const physicalProductImages = document.getElementById('physicalProductImages');
const physicalProductGallery = document.getElementById('physicalProductGallery');
const physicalProductNote = document.getElementById('physicalProductNote');
const publishPhysicalProductBtn = document.getElementById('publishPhysicalProductBtn');
let physicalGalleryUrls = [];
let physicalCoverIndex = 0;

const CAMERA_BY_SIDE = {
  front: 0,
  back: 180,
  right: -90,
  left: 90,
};

const state = {
  previews: {
    front: '',
    back: '',
    right: '',
    left: '',
  },
};

let viewer = null;
let adminProducts = [];
let editingProduct = null;
let editingLayers = { front: [], back: [], sleeveRight: [], sleeveLeft: [] };

const ADMIN_SIDE_LABELS = {
  front: 'Frente',
  back: 'Verso',
  sleeveRight: 'Manga direita',
  sleeveLeft: 'Manga esquerda',
};

function isAuthorizedAdmin(user) {
  if (user?.role === 'admin') return true;
  const email = String(user?.email || '').trim().toLowerCase();
  return ADMIN_EMAILS.includes(email);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setNote(message, isError = false) {
  if (!adminPublishNote) return;
  adminPublishNote.textContent = message;
  adminPublishNote.style.color = isError ? '#e08a7a' : '';
}

function syncDefaultInputs() {
  if (adminFrontUrl && !adminFrontUrl.value) adminFrontUrl.value = defaultLogoUrl;
  if (adminBackUrl && !adminBackUrl.value) adminBackUrl.value = defaultLogoUrl;
  if (adminRightUrl && !adminRightUrl.value) adminRightUrl.value = defaultLogoUrl;
  if (adminLeftUrl && !adminLeftUrl.value) adminLeftUrl.value = defaultLogoUrl;
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// Fundo marrom claro com degradê leve atrás das capturas 3D do manequim.
function paintCardBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#dcbb93');
  gradient.addColorStop(1, '#bd9166');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

async function composeWithBackground(foregroundDataUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  paintCardBackground(ctx, canvas.width, canvas.height);
  const foregroundImage = await loadImage(foregroundDataUrl);
  ctx.drawImage(foregroundImage, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.9);
}

// Remove o fundo preto chapado de uma arte, transformando-o em
// transparência. O alpha de cada pixel acompanha o brilho (o maior entre
// R, G e B): preto vira transparente, cores ficam opacas, com uma rampa
// suave nas bordas. Assim a estampa entra no mockup sem o quadrado preto
// do desenho normal e sem o aspecto "vazado" da mesclagem screen — o
// traço preto interno da arte continua visível sobre a camisa preta.
// Se a arte for de outro domínio sem CORS, o canvas fica "tainted" e o
// getImageData falha: nesse caso devolvemos a imagem original (fallback).
function keyOutBlackBackground(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const octx = off.getContext('2d');
  octx.drawImage(image, 0, 0, width, height);
  try {
    const imageData = octx.getImageData(0, 0, width, height);
    const px = imageData.data;
    for (let i = 0; i < px.length; i += 4) {
      const max = Math.max(px[i], px[i + 1], px[i + 2]);
      const alpha = Math.max(0, Math.min(1, (max - 10) / 60));
      px[i + 3] = Math.round(px[i + 3] * alpha);
    }
    octx.putImageData(imageData, 0, 0);
    return off;
  } catch (error) {
    console.warn('Nao foi possivel remover o fundo da arte (CORS?); usando imagem original.', error);
    return image;
  }
}

// Imagem do card do catálogo: estampa frontal aplicada no peito do mockup
// da camisa no cabide (mesmo visual dos thumbs do carrinho).
async function composeCardImage(printUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const base = await loadImage(CARD_MOCKUP_URL);
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

  if (printUrl) {
    const printImage = await loadImage(printUrl);
    const printSize = canvas.width * 0.3;
    const sourceAspect = (printImage.naturalHeight || printImage.height) / (printImage.naturalWidth || printImage.width) || 1;
    const printHeight = printSize * sourceAspect;
    const x = canvas.width * 0.478 - printSize / 2;
    const y = canvas.height * (sourceAspect > 1.2 ? 0.25 : 0.32);
    // Tira o fundo preto da arte antes de aplicar: estampa nítida e opaca,
    // sem o quadrado preto sobre a camisa.
    const keyedPrint = keyOutBlackBackground(printImage);
    ctx.drawImage(keyedPrint, x, y, printSize, printHeight);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}

async function applyCurrentPrints() {
  if (!viewer) return;

  await Promise.all([
    viewer.setPrint('front', adminFrontUrl?.value.trim() || defaultLogoUrl),
    viewer.setPrint('back', adminBackUrl?.value.trim() || defaultLogoUrl),
    viewer.setPrint('sleeveRight', adminRightUrl?.value.trim() || defaultLogoUrl),
    viewer.setPrint('sleeveLeft', adminLeftUrl?.value.trim() || defaultLogoUrl),
  ]);

  viewer.setTransform('front', { scale: 1, offsetX: 0, offsetY: 0 });
  viewer.setTransform('back', { scale: 1, offsetX: 0, offsetY: 0 });
  viewer.setTransform('sleeveRight', { scale: 1, offsetX: 0, offsetY: 0 });
  viewer.setTransform('sleeveLeft', { scale: 1, offsetX: 0, offsetY: 0 });
}

function setLayerEditorNote(message, isError = false) {
  if (!adminLayerEditorNote) return;
  adminLayerEditorNote.textContent = message;
  adminLayerEditorNote.style.color = isError ? '#e08a7a' : '';
}

function editableLayer(layer, side, index) {
  const normalized = layerEngine?.normalizeLayer(layer, index) || layer;
  return {
    id: normalized?.id || `${side}-${Date.now()}-${index + 1}`,
    name: normalized?.name || `Camada ${index + 1}`,
    type: normalized?.type || 'image',
    url: normalized?.url || '',
    blend: normalized?.blend || 'normal',
    transform: layerEngine?.normalizeTransform(normalized?.transform) || { scale: 1, offsetX: 0, offsetY: 0 },
    textData: normalized?.textData || null,
  };
}

function renderTextPresetOptions(selectedId) {
  return (textEngine?.presets || []).map((preset) =>
    `<option value="${escapeHtml(preset.id)}"${preset.id === selectedId ? ' selected' : ''}>${escapeHtml(preset.label || preset.id)}</option>`
  ).join('');
}

async function uploadAdminArtwork(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`,
    { method: 'POST', body: formData }
  );
  const payload = await response.json();
  const url = payload?.data?.display_url || payload?.data?.url;
  if (!response.ok || !payload.success || !url) {
    throw new Error(payload?.error?.message || 'Não foi possível enviar a imagem.');
  }
  return url;
}

function setPhysicalProductNote(message, isError = false) {
  if (!physicalProductNote) return;
  physicalProductNote.textContent = message;
  physicalProductNote.style.color = isError ? '#e08a7a' : '';
}

function renderPhysicalGallery() {
  if (!physicalProductGallery) return;
  physicalProductGallery.innerHTML = physicalGalleryUrls.map((url, index) => `
    <article class="admin-product-gallery-editor__item${index === physicalCoverIndex ? ' is-cover' : ''}">
      <img src="${escapeHtml(url)}" alt="Foto ${index + 1} do produto">
      <button type="button" data-cover-image="${index}" title="Usar como foto de capa" aria-label="Usar foto ${index + 1} como capa">★</button>
      <button type="button" data-remove-image="${index}" title="Remover foto" aria-label="Remover foto ${index + 1}">×</button>
      <span>${index === physicalCoverIndex ? 'Capa' : `Foto ${index + 1}`}</span>
    </article>
  `).join('');
  physicalProductGallery.querySelectorAll('[data-cover-image]').forEach((button) => {
    button.addEventListener('click', () => {
      physicalCoverIndex = Number(button.dataset.coverImage || 0);
      renderPhysicalGallery();
    });
  });
  physicalProductGallery.querySelectorAll('[data-remove-image]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeImage || 0);
      physicalGalleryUrls.splice(index, 1);
      physicalCoverIndex = Math.min(physicalCoverIndex, Math.max(0, physicalGalleryUrls.length - 1));
      renderPhysicalGallery();
    });
  });
}

physicalProductImages?.addEventListener('change', async () => {
  const files = Array.from(physicalProductImages.files || []);
  if (!files.length) return;
  if (files.length + physicalGalleryUrls.length > 5) {
    setPhysicalProductNote('Escolha no máximo cinco fotos.', true);
    physicalProductImages.value = '';
    return;
  }
  try {
    physicalProductImages.disabled = true;
    for (let index = 0; index < files.length; index += 1) {
      setPhysicalProductNote(`Enviando foto ${index + 1} de ${files.length}…`);
      physicalGalleryUrls.push(await uploadAdminArtwork(files[index]));
      renderPhysicalGallery();
    }
    setPhysicalProductNote('Fotos enviadas. Toque na estrela para escolher a capa.');
  } catch (error) {
    setPhysicalProductNote(error.message || 'Não foi possível enviar as fotos.', true);
  } finally {
    physicalProductImages.disabled = false;
    physicalProductImages.value = '';
  }
});

document.getElementById('clearPhysicalProductImages')?.addEventListener('click', () => {
  physicalGalleryUrls = [];
  physicalCoverIndex = 0;
  renderPhysicalGallery();
  setPhysicalProductNote('');
});

physicalProductForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (physicalGalleryUrls.length < 1) {
    setPhysicalProductNote('Envie pelo menos uma foto do produto.', true);
    return;
  }
  try {
    publishPhysicalProductBtn.disabled = true;
    setPhysicalProductNote('Publicando produto e sincronizando a planilha…');
    const product = await api.createPhysicalProduct({
      title: document.getElementById('physicalProductTitle').value.trim(),
      description: document.getElementById('physicalProductDescription').value.trim(),
      price: Number(document.getElementById('physicalProductPrice').value || 0),
      gallery: physicalGalleryUrls,
      coverIndex: physicalCoverIndex,
    });
    setPhysicalProductNote(`Produto publicado: ${product.title}. O valor foi enviado à planilha.`);
    physicalProductForm.reset();
    physicalGalleryUrls = [];
    physicalCoverIndex = 0;
    renderPhysicalGallery();
    await loadAdminLibrary();
  } catch (error) {
    setPhysicalProductNote(error.message || 'Não foi possível publicar o produto.', true);
  } finally {
    publishPhysicalProductBtn.disabled = false;
  }
});

function renderAdminLayerSides() {
  if (!adminLayerSides) return;
  adminLayerSides.innerHTML = Object.entries(ADMIN_SIDE_LABELS).map(([side, label]) => {
    const layers = editingLayers[side] || [];
    const rows = layers.map((layer, index) => `
      <div class="admin-layer-row" data-side="${side}" data-layer-index="${index}">
        <label class="form-field">
          <span>Tipo</span>
          <select data-field="type">
            <option value="image"${layer.type === 'image' ? ' selected' : ''}>Imagem</option>
            <option value="text"${layer.type === 'text' ? ' selected' : ''}>Texto editável</option>
          </select>
        </label>
        <label class="form-field admin-layer-row__url">
          <span>Imagem/PNG</span>
          <input type="text" data-field="url" value="${escapeHtml(layer.url)}" placeholder="https://...">
        </label>
        <label class="form-field">
          <span>Substituir arquivo</span>
          <input type="file" data-layer-file accept="image/*">
        </label>
        <label class="form-field admin-layer-row__text"${layer.type === 'text' ? '' : ' hidden'}>
          <span>Texto</span>
          <textarea data-field="text" rows="2">${escapeHtml(layer.textData?.text || '')}</textarea>
        </label>
        <label class="form-field"${layer.type === 'text' ? '' : ' hidden'}>
          <span>Estilo</span>
          <select data-field="presetId">${renderTextPresetOptions(layer.textData?.presetId || 'statement')}</select>
        </label>
        <label class="form-field"><span>Tamanho</span><input type="number" data-field="scale" min="0.22" max="2.35" step="0.05" value="${layer.transform.scale}"></label>
        <label class="form-field"><span>Horizontal</span><input type="number" data-field="offsetX" min="-24" max="24" step="1" value="${layer.transform.offsetX}"></label>
        <label class="form-field"><span>Vertical <small>(negativo sobe)</small></span><input type="number" data-field="offsetY" min="-24" max="24" step="1" value="${layer.transform.offsetY}"></label>
        <div class="admin-layer-nudges" aria-label="Ajuste rápido da posição">
          <button type="button" data-nudge-field="offsetY" data-nudge-value="-2" title="Subir">↑ Subir</button>
          <button type="button" data-nudge-field="offsetY" data-nudge-value="2" title="Descer">↓ Descer</button>
          <button type="button" data-nudge-field="offsetX" data-nudge-value="-2" title="Mover para esquerda">← Esquerda</button>
          <button type="button" data-nudge-field="offsetX" data-nudge-value="2" title="Mover para direita">→ Direita</button>
        </div>
        <button type="button" class="admin-layer-row__remove" data-remove-layer>Remover</button>
      </div>
    `).join('');
    return `
      <section class="admin-layer-side" data-layer-side="${side}">
        <div class="admin-layer-side__head">
          <div><strong>${label}</strong><span> ${layers.length}/3 camadas</span></div>
          <button type="button" data-add-layer="${side}"${layers.length >= 3 ? ' disabled' : ''}>Adicionar camada</button>
        </div>
        ${rows || '<p>Nenhuma estampa neste lado.</p>'}
      </section>
    `;
  }).join('');

  adminLayerSides.querySelectorAll('[data-field]').forEach((control) => {
    control.addEventListener('input', () => {
      const row = control.closest('.admin-layer-row');
      const layer = editingLayers[row.dataset.side]?.[Number(row.dataset.layerIndex)];
      if (!layer) return;
      const field = control.dataset.field;
      if (['scale', 'offsetX', 'offsetY'].includes(field)) {
        layer.transform[field] = Number(control.value);
      } else if (field === 'text') {
        layer.textData = layer.textData || { text: '', lines: [], presetId: 'statement' };
        layer.textData.text = control.value;
        layer.textData.lines = control.value.split('\n').map((line) => line.trim()).filter(Boolean);
      } else if (field === 'presetId') {
        layer.textData = layer.textData || { text: '', lines: [], presetId: 'statement' };
        layer.textData.presetId = control.value;
      } else {
        layer[field] = control.value;
      }
      if (field === 'type') {
        if (control.value === 'text') {
          layer.textData = layer.textData || { text: '', lines: [], presetId: 'statement' };
        }
        renderAdminLayerSides();
      }
    });
  });

  adminLayerSides.querySelectorAll('[data-layer-file]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const row = input.closest('.admin-layer-row');
      const layer = editingLayers[row.dataset.side]?.[Number(row.dataset.layerIndex)];
      if (!layer) return;
      try {
        input.disabled = true;
        setLayerEditorNote('Enviando nova imagem...');
        layer.url = await uploadAdminArtwork(file);
        layer.type = 'image';
        layer.textData = null;
        renderAdminLayerSides();
        setLayerEditorNote('Imagem substituída. Clique em salvar para atualizar o produto.');
      } catch (error) {
        setLayerEditorNote(error.message, true);
      } finally {
        input.disabled = false;
      }
    });
  });

  adminLayerSides.querySelectorAll('[data-nudge-field]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.admin-layer-row');
      const layer = editingLayers[row.dataset.side]?.[Number(row.dataset.layerIndex)];
      if (!layer) return;
      const field = button.dataset.nudgeField;
      const next = Math.max(-24, Math.min(24,
        Number(layer.transform[field] || 0) + Number(button.dataset.nudgeValue || 0)
      ));
      layer.transform[field] = next;
      const input = row.querySelector(`[data-field="${field}"]`);
      if (input) input.value = String(next);
      setLayerEditorNote('Posição ajustada. Use “Visualizar no manequim” antes de salvar.');
    });
  });

  adminLayerSides.querySelectorAll('[data-add-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const side = button.dataset.addLayer;
      if (editingLayers[side].length >= 3) return;
      editingLayers[side].push(editableLayer({ name: `Camada ${editingLayers[side].length + 1}` }, side, editingLayers[side].length));
      updateAdminLayerPrice();
      renderAdminLayerSides();
    });
  });

  adminLayerSides.querySelectorAll('[data-remove-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.admin-layer-row');
      editingLayers[row.dataset.side].splice(Number(row.dataset.layerIndex), 1);
      updateAdminLayerPrice();
      renderAdminLayerSides();
    });
  });
}

function getEditingLayerCounts() {
  return Object.keys(editingLayers).reduce((counts, side) => {
    counts[side] = editingLayers[side].filter((layer) => layer.url || layer.type === 'text').length;
    return counts;
  }, {});
}

function updateAdminLayerPrice() {
  if (!adminEditPrice || !store?.getStandardShirtPrice) return;
  const counts = getEditingLayerCounts();
  const sides = {
    front: true,
    back: counts.back > 0,
    sleeveRight: counts.sleeveRight > 0,
    sleeveLeft: counts.sleeveLeft > 0,
  };
  adminEditPrice.value = store.getStandardShirtPrice(sides, counts).toFixed(2);
}

function renderEditableTextLayer(layer) {
  const lines = (layer.textData?.lines?.length
    ? layer.textData.lines
    : String(layer.textData?.text || '').split('\n'))
    .map((line) => String(line).trim())
    .filter(Boolean);
  if (!lines.length || !textEngine?.draw) return layer.url;
  const preset = textEngine.presets.find((item) => item.id === layer.textData?.presetId) || textEngine.presets[0];
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  textEngine.draw(canvas, preset, lines);
  layer.textData = { text: lines.join('\n'), lines, presetId: preset.id };
  layer.url = canvas.toDataURL('image/png');
  return layer.url;
}

async function prepareEditingModel() {
  Object.values(editingLayers).flat().forEach((layer) => {
    if (layer.type === 'text') renderEditableTextLayer(layer);
  });
  return layerEngine.serializeModel(editingLayers);
}

async function previewEditingProduct() {
  if (!viewer) return;
  const model = await prepareEditingModel();
  for (const side of layerEngine.SIDES) {
    const layers = layerEngine.normalizeSide(model[side]);
    if (!layers.length) {
      viewer.clearPrint?.(side);
      continue;
    }
    const composite = await layerEngine.composeLayers(layers, { side });
    await viewer.setPrint(side, composite, 'normal');
    viewer.setTransform(side, { scale: 1, offsetX: 0, offsetY: 0 });
  }
  viewer.setCameraAngle(0);
  setLayerEditorNote('Camadas aplicadas ao manequim. Confira os quatro lados.');
}

function openProductEditor(product) {
  editingProduct = product;
  editingLayers = layerEngine.normalizeModel(product.model);
  Object.keys(editingLayers).forEach((side) => {
    editingLayers[side] = editingLayers[side].map((layer, index) => editableLayer(layer, side, index));
  });
  if (adminEditingTitle) adminEditingTitle.textContent = `Editar: ${product.title}`;
  if (adminEditTitle) adminEditTitle.value = product.title || '';
  if (adminEditDescription) adminEditDescription.value = product.description || '';
  if (adminEditPrice) adminEditPrice.value = Number(product.price || 0).toFixed(2);
  renderAdminLayerSides();
  adminLayerEditor.hidden = false;
  adminLayerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAdminLibrary() {
  if (adminProductList) {
    adminProductList.innerHTML = adminProducts.map((product) => `
      <article class="admin-product-library-card">
        <img src="${escapeHtml(product.catalogImage || product.views?.front || '')}" alt="${escapeHtml(product.title)}">
        <strong>${escapeHtml(product.title)}</strong>
        <span>${Number(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        <button type="button" data-edit-product="${escapeHtml(product.id)}">Editar produto e camadas</button>
      </article>
    `).join('') || '<p>Nenhum produto publicado.</p>';
    adminProductList.querySelectorAll('[data-edit-product]').forEach((button) => {
      button.addEventListener('click', () => {
        const product = adminProducts.find((item) => String(item.id) === button.dataset.editProduct);
        if (product) openProductEditor(product);
      });
    });
  }

  if (adminArtworkLibrary) {
    const unique = new Map();
    adminProducts.forEach((product) => {
      const model = layerEngine.normalizeModel(product.model);
      Object.entries(model).forEach(([side, layers]) => layers.forEach((layer) => {
        if (!unique.has(layer.url)) unique.set(layer.url, { ...layer, side, productTitle: product.title });
      }));
    });
    adminArtworkLibrary.innerHTML = [...unique.values()].map((layer) => `
      <article class="admin-artwork-card">
        <img src="${escapeHtml(layer.url)}" alt="${escapeHtml(layer.name)}">
        <strong>${escapeHtml(layer.name)}</strong>
        <span>${escapeHtml(ADMIN_SIDE_LABELS[layer.side])} • ${layer.type === 'text' ? 'Texto editável' : 'Imagem'} • ${escapeHtml(layer.productTitle)}</span>
      </article>
    `).join('') || '<p>As estampas dos produtos aparecerão aqui.</p>';
  }
}

async function loadAdminLibrary() {
  if (!api || !layerEngine) return;
  try {
    adminProducts = await api.listProducts();
    renderAdminLibrary();
  } catch (error) {
    if (adminProductList) adminProductList.innerHTML = '<p>Não foi possível carregar os produtos.</p>';
  }
}

async function saveEditingProduct() {
  if (!editingProduct) return;
  try {
    await store?.refreshSession();
    if (!isAuthorizedAdmin(store?.getCurrentUser())) {
      throw new Error('Entre com a conta Gestor administradora para salvar alterações.');
    }
    adminSaveProductBtn.disabled = true;
    setLayerEditorNote('Salvando produto e camadas...');
    const model = await prepareEditingModel();
    const frontLayers = layerEngine.normalizeSide(model.front);
    const frontComposite = frontLayers.length ? await layerEngine.composeLayers(frontLayers, { side: 'front' }) : '';
    const catalogImage = frontComposite ? await composeCardImage(frontComposite) : editingProduct.catalogImage;
    const rawDescription = adminEditDescription.value.trim();
    const searchableDescription = layerEngine.addTextToDescription?.(rawDescription, model)
      || rawDescription;
    const payload = {
      title: adminEditTitle.value.trim(),
      description: searchableDescription,
      tags: layerEngine.extractTextValues?.(model) || [],
      price: Number(adminEditPrice.value || 0),
      catalogImage,
      views: { ...(editingProduct.views || {}), front: catalogImage },
      model,
      creator: editingProduct.creator || '',
      creatorPhoto: editingProduct.creatorPhoto || '',
    };
    editingProduct = await api.updateProduct(editingProduct.id, payload);
    const index = adminProducts.findIndex((item) => item.id === editingProduct.id);
    if (index >= 0) adminProducts[index] = editingProduct;
    renderAdminLibrary();
    setLayerEditorNote('Produto atualizado sem alterar o ID ou o link.');
  } catch (error) {
    console.error('Não foi possível atualizar as camadas:', error);
    setLayerEditorNote(error.message || 'Não foi possível salvar as alterações.', true);
  } finally {
    adminSaveProductBtn.disabled = false;
  }
}

adminLayerEditor?.addEventListener('submit', (event) => {
  event.preventDefault();
  saveEditingProduct();
});
adminSaveProductBtn?.addEventListener('click', saveEditingProduct);

previewAdminLayersBtn?.addEventListener('click', previewEditingProduct);
refreshAdminLibraryBtn?.addEventListener('click', loadAdminLibrary);
closeAdminLayerEditorBtn?.addEventListener('click', () => {
  adminLayerEditor.hidden = true;
  editingProduct = null;
});

async function generatePreviews() {
  if (!viewer) return;

  setNote('Gerando previews do produto...');
  await applyCurrentPrints();

  const previewMap = [
    ['front', previewFront],
    ['back', previewBack],
    ['right', previewRight],
    ['left', previewLeft],
  ];

  for (const [sideKey, imageEl] of previewMap) {
    viewer.setCameraAngle(CAMERA_BY_SIDE[sideKey]);
    await wait(260);
    const rawPng = viewer.capturePng();
    const composedPng = await composeWithBackground(rawPng);
    state.previews[sideKey] = composedPng;
    if (imageEl) imageEl.src = composedPng;
  }

  viewer.setCameraAngle(0);
  setNote('Previews atualizados. Agora voce pode publicar o modelo.');
}

async function publishModel(event) {
  event.preventDefault();
  if (!api) return;

  try {
    if (!state.previews.front) {
      await generatePreviews();
    }

    const price = store?.getStandardShirtPrice
      ? store.getStandardShirtPrice(
          { front: true, back: true, sleeveRight: true, sleeveLeft: true },
          { front: 1, back: 1, sleeveRight: 1, sleeveLeft: 1 }
        )
      : 83.9;
    const catalogImage = await composeCardImage(adminFrontUrl?.value.trim() || defaultLogoUrl);
    const payload = {
      title: adminTitleInput?.value.trim() || 'Modelo publico Ursoninhos',
      description: adminDescriptionInput?.value.trim() || 'Modelo publico criado no painel ADM.',
      price,
      catalogImage,
      views: {
        front: state.previews.front,
        back: state.previews.back,
        right: state.previews.right,
        left: state.previews.left,
      },
      model: {
        front: {
          url: adminFrontUrl?.value.trim() || defaultLogoUrl,
          blend: 'normal',
          transform: { scale: 1, offsetX: 0, offsetY: 0 },
        },
        back: {
          url: adminBackUrl?.value.trim() || defaultLogoUrl,
          blend: 'normal',
          transform: { scale: 1, offsetX: 0, offsetY: 0 },
        },
        sleeveRight: {
          url: adminRightUrl?.value.trim() || defaultLogoUrl,
          blend: 'normal',
          transform: { scale: 1, offsetX: 0, offsetY: 0 },
        },
        sleeveLeft: {
          url: adminLeftUrl?.value.trim() || defaultLogoUrl,
          blend: 'normal',
          transform: { scale: 1, offsetX: 0, offsetY: 0 },
        },
      },
    };

    const product = await api.createProduct(payload);
    setNote(
      `Modelo publicado com sucesso por ${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. ` +
      `Link curto: ${product.shortPath || `/${product.shortId || product.id}/`}`
    );
  } catch (error) {
    console.error('Nao foi possivel publicar o modelo:', error);
    setNote('Nao foi possivel publicar o modelo agora. Verifique o backend e tente novamente.', true);
  }
}

async function init() {
  if (!adminViewerEl) return;
  await store?.refreshSession();
  if (!isAuthorizedAdmin(store?.getCurrentUser())) {
    adminPublishForm?.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
    physicalProductForm?.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
    if (refreshAdminLibraryBtn) refreshAdminLibraryBtn.disabled = true;
    if (adminProductList) adminProductList.innerHTML = '<p>Entre com a conta Gestor administradora para editar produtos.</p>';
    setNote('Acesso restrito aos administradores autorizados.', true);
    setPhysicalProductNote('Acesso restrito aos administradores autorizados.', true);
    return;
  }
  await loadAdminLibrary();
  syncDefaultInputs();
  viewer = await createInteractiveViewer({ container: adminViewerEl, cameraDistance: 2.2 });
  await generatePreviews();

  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => {
      viewer?.setCameraAngle(Number(button.dataset.camera || 0));
    });
  });

  applyDefaultLogoBtn?.addEventListener('click', async () => {
    adminFrontUrl.value = defaultLogoUrl;
    adminBackUrl.value = defaultLogoUrl;
    adminRightUrl.value = defaultLogoUrl;
    adminLeftUrl.value = defaultLogoUrl;
    await generatePreviews();
  });

  refreshPreviewBtn?.addEventListener('click', async () => {
    await generatePreviews();
  });

  adminPublishForm?.addEventListener('submit', publishModel);
}

init().catch((error) => {
  console.error('Falha ao iniciar o painel ADM:', error);
  setNote('Nao foi possivel iniciar o viewer 3D do painel ADM.', true);
});

/* ---------------------------------------------------------
   Sincronizar produtos com a planilha Google
   Monta a lista COMPLETA de produtos do site — as camisas de
   frases (cada frase é um produto, camisa preta) e os modelos
   públicos do backend — e envia para a planilha via Web App
   (upsert por id; preço editado na planilha é preservado).
   --------------------------------------------------------- */

const SITE_URL = 'https://ursoninhos.com';
const sheetSyncBtn = document.getElementById('sheetSyncBtn');
const sheetSyncNote = document.getElementById('sheetSyncNote');

if (sheetSyncBtn && !window.UrsoninhosSheet?.canWrite) {
  sheetSyncBtn.disabled = true;
  sheetSyncBtn.title = 'Publique e configure o Web App do Google antes de sincronizar';
}

function setSyncNote(message, isError = false) {
  if (!sheetSyncNote) return;
  sheetSyncNote.textContent = message;
  sheetSyncNote.style.color = isError ? '#e08a7a' : '';
}

// Nome do produto = "Camisa Preta" + a frase (ou o começo dela).
function nomeDeFrase(frase) {
  const limpa = String(frase).replace(/\s+/g, ' ').trim();
  const parte = limpa.length > 70 ? `${limpa.slice(0, 67).trim()}…` : limpa;
  return `Camisa Preta — "${parte}"`;
}

async function montarTodosOsProdutos() {
  const linhas = [];
  const produtosBase = [
    {
      id: 'camisa-anime-personalizada',
      nome: 'Camisa Anime Personalizada',
      tipo: 'camisa',
      cor: 'Preta',
      preco: 49.9,
      link: `${SITE_URL}/index.html#destaques`,
    },
    {
      id: 'estatua-3d-colecionavel',
      nome: 'Estátua 3D Colecionável',
      tipo: '3d',
      cor: '',
      preco: 1.99,
      link: `${SITE_URL}/index.html#destaques`,
    },
    {
      id: 'suporte-gamer-tematico',
      nome: 'Suporte Gamer Temático',
      tipo: 'acessorio-3d',
      cor: '',
      preco: 89.9,
      link: `${SITE_URL}/index.html#destaques`,
    },
    {
      id: 'acessorio-geek-personalizado',
      nome: 'Acessório Geek Personalizado',
      tipo: 'acessorio',
      cor: '',
      preco: 39.9,
      link: `${SITE_URL}/index.html#destaques`,
    },
  ];

  produtosBase.forEach((produto) => {
    linhas.push(produto);
  });

  const frases = window.UrsoninhosFrases?.gerarProdutosDeFrases() || [];
  frases.forEach((produto) => {
    linhas.push({
      id: produto.id,
      nome: nomeDeFrase(produto.frase),
      tipo: 'camisa-frase',
      cor: 'Preta',
      preco: produto.preco,
      link: `${SITE_URL}${produto.shortPath}`,
    });
  });

  try {
    const publicos = await api.listProducts();
    publicos
      .filter((p) => String(p.catalogImage || '').startsWith('data:') || String(p.catalogImage || '').startsWith('http'))
      .forEach((produto) => {
        linhas.push({
          id: produto.id,
          nome: produto.title,
          tipo: 'camisa-modelo-publico',
          cor: 'Preta',
          preco: Number(produto.price || 0),
          link: `${SITE_URL}${produto.shortPath || `/produto.html?id=${encodeURIComponent(produto.id)}`}`,
        });
      });
  } catch (error) {
    console.warn('Backend de modelos publicos indisponivel; sincronizando so as frases.', error);
  }

  return linhas;
}

sheetSyncBtn?.addEventListener('click', async () => {
  await store?.refreshSession();
  if (!isAuthorizedAdmin(store?.getCurrentUser())) {
    setSyncNote('Entre com uma conta administradora autorizada.', true);
    return;
  }
  const sheet = window.UrsoninhosSheet;
  if (!sheet?.canWrite) {
    setSyncNote('A sincronização segura com a planilha ainda não foi configurada no backend da Hostinger.', true);
    return;
  }

  sheetSyncBtn.disabled = true;
  setSyncNote('Enviando produtos para a planilha…');

  try {
    const linhas = await montarTodosOsProdutos();
    const resultado = await sheet.push(linhas);
    if (resultado?.ok) {
      setSyncNote(`Planilha sincronizada: ${resultado.created || 0} produtos novos, ${resultado.updated || 0} atualizados (total enviado: ${linhas.length}).`);
    } else {
      setSyncNote(resultado?.error || 'A planilha nao confirmou a gravacao.', true);
    }
  } catch (error) {
    console.error('Falha ao sincronizar a planilha:', error);
    setSyncNote('Nao foi possivel sincronizar agora. Confira a URL do Web App.', true);
  } finally {
    sheetSyncBtn.disabled = false;
  }
});
