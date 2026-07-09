import { createInteractiveViewer } from './interactive-viewer3d.js';

const config = window.URSONINHOS_APP_CONFIG || {};
const api = window.UrsoninhosApi;

const defaultLogoUrl = config.defaultLogoUrl || '';
const backgroundUrl = config.productCardBackgroundUrl || '';

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

async function composeWithBackground(foregroundDataUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const backgroundImage = await loadImage(backgroundUrl);
  const foregroundImage = await loadImage(foregroundDataUrl);

  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(foregroundImage, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
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
    const payload = {
      title: adminTitleInput?.value.trim() || 'Modelo publico Ursoninhos',
      description: adminDescriptionInput?.value.trim() || 'Modelo publico criado no painel ADM.',
      price,
      catalogImage: state.previews.front,
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
