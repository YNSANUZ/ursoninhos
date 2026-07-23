/* =========================================================
   Ursoninhos — frase-produto-3d.js
   Manequim 3D LIMPO da página de produto de frase: só o
   manequim vestindo a camisa com a frase, sobre o fundo
   caramelo — sem botões de câmera nem controles de edição
   (o da home continua com tudo; este é apenas para o cliente
   girar e ver frente e verso do que está comprando).

   Recebe a estampa do frase-produto.js (script clássico) via
   window.UrsoninhosFraseProdutoAtual + evento
   'frase-produto-pronto'.
   ========================================================= */

import { createInteractiveViewer } from './interactive-viewer3d.js?v=4';

const container = document.getElementById('pfViewer3d');
const loading = document.getElementById('pfViewerLoading');
const hint = document.getElementById('pfViewerHint');

let iniciado = false;

async function iniciarViewer() {
  if (iniciado || !container) return;
  const atual = window.UrsoninhosFraseProdutoAtual;
  if (!atual?.estampaDataUrl) return;
  iniciado = true;

  try {
    const viewer = await createInteractiveViewer({ container, cameraDistance: 2.1 });
    await viewer.setPrint('front', atual.estampaDataUrl, 'normal');
    viewer.setCameraAngle(0);

    if (loading) loading.hidden = true;
    if (hint) hint.hidden = false;
  } catch (error) {
    console.error('Manequim 3D indisponível na página do produto:', error);
    // Sem WebGL: esconde o slot 3D e deixa a foto do cabide como principal.
    if (loading) loading.textContent = 'Visualização 3D indisponível neste aparelho.';
    document.getElementById('pfThumbPhoto')?.click();
  }
}

if (window.UrsoninhosFraseProdutoAtual) {
  iniciarViewer();
} else {
  window.addEventListener('frase-produto-pronto', iniciarViewer, { once: true });
}
