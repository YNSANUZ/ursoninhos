import { createInteractiveViewer } from './interactive-viewer3d.js';

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
    const x = canvas.width * 0.478 - printSize / 2;
    const y = canvas.height * 0.32;
    ctx.drawImage(printImage, x, y, printSize, printSize);
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

    const price = Number((Math.random() * 30 + 20).toFixed(2));
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
    setNote(`Modelo publicado com sucesso por ${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. ID: ${product.id}`);
  } catch (error) {
    console.error('Nao foi possivel publicar o modelo:', error);
    setNote('Nao foi possivel publicar o modelo agora. Verifique o backend e tente novamente.', true);
  }
}

async function init() {
  if (!adminViewerEl) return;
  await store?.refreshSession();
  if (store?.getCurrentUser()?.role !== 'admin') {
    adminPublishForm?.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
    setNote('Acesso restrito ao administrador configurado no backend.', true);
    return;
  }
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

  const frases = window.UrsoninhosFrases?.gerarProdutosDeFrases() || [];
  frases.forEach((produto) => {
    linhas.push({
      id: produto.id,
      nome: nomeDeFrase(produto.frase),
      tipo: 'camisa-frase',
      cor: 'Preta',
      preco: produto.preco,
      link: `${SITE_URL}/produto-frase.html?id=${encodeURIComponent(produto.id)}`,
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
          tipo: 'modelo-publico',
          cor: 'Preta',
          preco: Number(produto.price || 0),
          link: `${SITE_URL}/produto.html?id=${encodeURIComponent(produto.id)}`,
        });
      });
  } catch (error) {
    console.warn('Backend de modelos publicos indisponivel; sincronizando so as frases.', error);
  }

  return linhas;
}

sheetSyncBtn?.addEventListener('click', async () => {
  await store?.refreshSession();
  if (store?.getCurrentUser()?.role !== 'admin') {
    setSyncNote('Entre com a conta administradora configurada no backend.', true);
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
