/* =========================================================
   Ursoninhos — main.js
   Landing page estática + sistema de troca de estampas da
   camisa no hero (sem backend, sem checkout real).
   ========================================================= */

// Menu mobile
const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');

if (navToggle && navList) {
  navToggle.addEventListener('click', () => {
    const isOpen = navList.parentElement.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

/* ---------------------------------------------------------
   Sistema de troca de estampas da camisa (carrossel giratório)
   Todos os PNGs usados como estampa ficam na pasta
   "ARTE CAMISA/" na raiz do projeto. Para adicionar uma nova
   arte no futuro: coloque o PNG dentro de "ARTE CAMISA/" e
   acrescente um novo item neste array (name + file).
   Aceita normalmente tanto artes brancas quanto coloridas —
   nenhuma cor é forçada, cada PNG é exibido como está.
   --------------------------------------------------------- */

const shirtPrints = [
  { name: 'Coração', file: 'ARTE CAMISA/coração arte camisa.png' },
  { name: 'Coração 2', file: 'ARTE CAMISA/coração 2 arte camisa.png' },
  { name: 'Dog', file: 'ARTE CAMISA/dog arte camisa.png' },
  { name: 'Logo Ursoninhos', file: 'ARTE CAMISA/logo ursoninhos arte camisa.png' },
  { name: 'Samurai', file: 'ARTE CAMISA/samurai arte camisa.png' },
  { name: 'Silene', file: 'ARTE CAMISA/silene arte camisa.png' },
];

const shirtOverlay = document.getElementById('shirtPrintOverlay');
const printPicker = document.getElementById('printPicker');
const printPickerTrack = document.getElementById('printPickerTrack');
const printPrevBtn = document.getElementById('printPrev');
const printNextBtn = document.getElementById('printNext');
const activePrintName = document.getElementById('activePrintName');
const heroStage = document.querySelector('.hero__stage');
const heroPicker = document.querySelector('.hero__picker');

/* O card em destaque na lateral direita e a camisa do manequim ficam
   SEMPRE sincronizados: a estampa destacada é a mesma vestida no
   mockup. A cada virada, a nova arte entra na camisa com o efeito de
   "carregar para dentro" (voando da lateral). */
let queuedPrintIndex = 0; // estampa em destaque na lateral (= a da camisa)
let shirtPrintIndex = 0;  // estampa atualmente aplicada na FRENTE da camisa

/* Chave FRENTE/VERSO/MANGAS: define qual lado da camisa 3D está sendo
   editado (escolha de arte, tamanho e posição são independentes por
   lado). Verso e mangas começam sem arte até o cliente escolher. */
let activeSide = 'front';
const sideTransforms = {
  front: { scale: 1, offsetX: 0, offsetY: 0 },
  back: { scale: 1, offsetX: 0, offsetY: 0 },
  sleeveLeft: { scale: 1, offsetX: 0, offsetY: 0 },
  sleeveRight: { scale: 1, offsetX: 0, offsetY: 0 },
};
const sidePrintSelections = {
  front: 0,
  back: null,
  sleeveLeft: null,
  sleeveRight: null,
};

function normalizePrintIndex(index) {
  const total = shirtPrints.length;
  return ((index % total) + total) % total;
}

// Monta os cards do carrossel a partir de shirtPrints (uma vez, no carregamento).
function renderPrintPicker() {
  if (!printPickerTrack) return;

  printPickerTrack.innerHTML = shirtPrints
    .map((print, index) => `
      <button class="print-card" type="button" data-index="${index}" aria-label="Estampa ${print.name}">
        <span class="print-card__thumb"><img src="${print.file}" alt="Estampa ${print.name}" loading="lazy"></span>
      </button>
    `)
    .join('');

  printPickerTrack.querySelectorAll('.print-card').forEach((card) => {
    card.addEventListener('click', () => {
      // Clique num card: ele assume o destaque e veste a camisa na hora.
      rotateCarousel(Number(card.dataset.index));
      restartAutoRotate();
    });
  });
}

// Desliza a trilha para centralizar o card ativo dentro da janela do picker.
function updateTrackPosition() {
  if (!printPicker || !printPickerTrack) return;

  const activeCard = printPickerTrack.children[queuedPrintIndex];
  if (!activeCard) return;

  const viewportWidth = printPicker.clientWidth;
  const offset = activeCard.offsetLeft + activeCard.offsetWidth / 2 - viewportWidth / 2;
  printPickerTrack.style.transform = `translateX(${-offset}px)`;
}

// Aplica uma estampa na camisa do manequim com o efeito de "carregar
// para dentro": a arte entra voando da lateral direita (de onde acabou
// de sair do carrossel) até assentar no peito.
function applyPrintToShirt(index, animate = true) {
  const print = shirtPrints[index];
  if (!print) return;

  sidePrintSelections[activeSide] = index;

  // Editando a FRENTE, atualiza também o manequim 2D (fallback) e o
  // índice usado pelo carrinho; no VERSO só a projeção das costas muda.
  if (activeSide === 'front') {
    shirtPrintIndex = index;

    if (shirtOverlay) {
      shirtOverlay.style.backgroundImage = `url('${print.file}')`;
      shirtOverlay.style.display = 'block';
      // Artes da pasta ARTE CAMISA/ têm canvas preto opaco -> "screen" some
      // com a camisa preta. Fotos enviadas pelo cliente não têm esse fundo
      // preto, então usam blend normal para não estourar as cores.
      shirtOverlay.style.mixBlendMode = print.blend || 'screen';

      if (animate) {
        // Reinicia a animação de carregamento: remove a classe, força um
        // reflow e recoloca, para o efeito rodar a cada virada.
        shirtOverlay.classList.remove('is-loading-in');
        void shirtOverlay.offsetWidth;
        shirtOverlay.classList.add('is-loading-in');
      }
    }
  }

  // Manequim 3D (viewer3d.js): projeta a estampa no lado em edição.
  if (window.shirtViewer3D?.ready) {
    window.shirtViewer3D.setPrint(print.file, print.blend || 'screen', activeSide);
  }
}

// Coloca uma estampa em destaque na lateral direita (fila). Ela ainda
// NÃO vai para a camisa: só entra no mockup na próxima virada.
function setQueuedPrint(index) {
  if (!shirtPrints.length) return;

  queuedPrintIndex = normalizePrintIndex(index);
  const print = shirtPrints[queuedPrintIndex];

  if (activePrintName) {
    activePrintName.textContent = print.name;
  }

  printPickerTrack?.querySelectorAll('.print-card').forEach((card) => {
    card.classList.toggle('is-active', Number(card.dataset.index) === queuedPrintIndex);
  });

  updateTrackPosition();
}

// Uma "virada" do carrossel: destaca a nova estampa na lateral e a
// veste na camisa ao mesmo tempo (sempre a mesma imagem nos dois).
function rotateCarousel(nextIndex) {
  setQueuedPrint(nextIndex);
  applyPrintToShirt(queuedPrintIndex);
}

/* ---------------------------------------------------------
   Giro automático: o carrossel sempre avança sozinho (sentido
   único, próxima estampa). Qualquer interação do usuário (seta,
   clique num card, swipe) responde na hora e reinicia a contagem,
   para o giro automático não "brigar" com o usuário.
   --------------------------------------------------------- */

const AUTO_ROTATE_INTERVAL_MS = 4000;
let autoRotateTimer = null;

// Pausa manual do cliente (botão play/pause na base do manequim).
// Enquanto true, NADA religa o giro automático — nem hover, nem
// clique em card, nem upload — só o próprio botão de play.
let autoRotatePaused = false;

const autoRotateToggle = document.getElementById('autoRotateToggle');
const autoRotateToggleIcon = document.getElementById('autoRotateToggleIcon');

// Desenhos do ícone único do botão: barras de pause e triângulo de play.
const PAUSE_ICON_PATH = 'M6.5 5h3.4v14H6.5zM14.1 5h3.4v14h-3.4z';
const PLAY_ICON_PATH = 'M8 5.5v13a1 1 0 0 0 1.52.86l10.2-6.5a1 1 0 0 0 0-1.72L9.52 4.64A1 1 0 0 0 8 5.5z';

function startAutoRotate() {
  stopAutoRotate();
  if (autoRotatePaused) return;
  autoRotateTimer = setInterval(() => {
    rotateCarousel(queuedPrintIndex + 1);
  }, AUTO_ROTATE_INTERVAL_MS);
}

function stopAutoRotate() {
  if (autoRotateTimer) {
    clearInterval(autoRotateTimer);
    autoRotateTimer = null;
  }
}

function restartAutoRotate() {
  startAutoRotate();
}

/* Controles da estampa no mockup, a partir da base do CSS (27% x 24%
   de tamanho, topo em 46%): - e + mudam o tamanho; as setas sobem e
   descem a posição. O portal acompanha a subida/descida para a arte
   continuar centralizada no círculo de luz. */
const PRINT_BASE_WIDTH_PCT = 27;
const PRINT_BASE_HEIGHT_PCT = 24;
const PRINT_BASE_TOP_PCT = 46;
const PRINT_SCALE_STEP = 0.1;
const PRINT_SCALE_MIN = 0.6;
const PRINT_SCALE_MAX = 1.6;
const PRINT_BASE_LEFT_PCT = 50;
const PRINT_MOVE_STEP_PCT = 2;
const PRINT_MOVE_LIMIT_PCT = 14;
const PRINT_MOVE_LIMIT_X_PCT = 10;

const printSizeUpBtn = document.getElementById('printSizeUp');
const printSizeDownBtn = document.getElementById('printSizeDown');
const printMoveUpBtn = document.getElementById('printMoveUp');
const printMoveDownBtn = document.getElementById('printMoveDown');
const printMoveLeftBtn = document.getElementById('printMoveLeft');
const printMoveRightBtn = document.getElementById('printMoveRight');
const shirtPortal = document.querySelector('.shirt-print-portal');

function syncPrintTransform3D() {
  if (window.shirtViewer3D?.ready) {
    const t = sideTransforms[activeSide];
    window.shirtViewer3D.setTransform({ scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY }, activeSide);
  }
}

function applyPrintScale() {
  const t = sideTransforms[activeSide];
  if (activeSide === 'front' && shirtOverlay) {
    shirtOverlay.style.width = `${(PRINT_BASE_WIDTH_PCT * t.scale).toFixed(1)}%`;
    shirtOverlay.style.height = `${(PRINT_BASE_HEIGHT_PCT * t.scale).toFixed(1)}%`;
  }
  syncPrintTransform3D();
}

function applyPrintOffset() {
  const t = sideTransforms[activeSide];
  if (activeSide === 'front') {
    const top = `${(PRINT_BASE_TOP_PCT + t.offsetY).toFixed(1)}%`;
    const left = `${(PRINT_BASE_LEFT_PCT + t.offsetX).toFixed(1)}%`;
    if (shirtOverlay) {
      shirtOverlay.style.top = top;
      shirtOverlay.style.left = left;
    }
    if (shirtPortal) {
      shirtPortal.style.top = top;
      shirtPortal.style.left = left;
    }
  }
  syncPrintTransform3D();
}

printSizeUpBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.scale = Math.min(PRINT_SCALE_MAX, +(t.scale + PRINT_SCALE_STEP).toFixed(2));
  applyPrintScale();
});

printSizeDownBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.scale = Math.max(PRINT_SCALE_MIN, +(t.scale - PRINT_SCALE_STEP).toFixed(2));
  applyPrintScale();
});

printMoveUpBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.offsetY = Math.max(-PRINT_MOVE_LIMIT_PCT, t.offsetY - PRINT_MOVE_STEP_PCT);
  applyPrintOffset();
});

printMoveDownBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.offsetY = Math.min(PRINT_MOVE_LIMIT_PCT, t.offsetY + PRINT_MOVE_STEP_PCT);
  applyPrintOffset();
});

printMoveLeftBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.offsetX = Math.max(-PRINT_MOVE_LIMIT_X_PCT, t.offsetX - PRINT_MOVE_STEP_PCT);
  applyPrintOffset();
});

printMoveRightBtn?.addEventListener('click', () => {
  const t = sideTransforms[activeSide];
  t.offsetX = Math.min(PRINT_MOVE_LIMIT_X_PCT, t.offsetX + PRINT_MOVE_STEP_PCT);
  applyPrintOffset();
});

// Arrasto da arte direto no 3D (viewer3d.js): atualiza o estado local
// para as setas, o overlay 2D e o preview do carrinho continuarem
// coerentes. Não chama setTransform de volta — o viewer já se aplicou.
window.addEventListener('shirt3d-print-drag', (event) => {
  const { side, offsetX, offsetY } = event.detail || {};
  const t = sideTransforms[side];
  if (!t) return;
  t.offsetX = offsetX;
  t.offsetY = offsetY;

  if (side === 'front') {
    const top = `${(PRINT_BASE_TOP_PCT + offsetY).toFixed(1)}%`;
    const left = `${(PRINT_BASE_LEFT_PCT + offsetX).toFixed(1)}%`;
    if (shirtOverlay) {
      shirtOverlay.style.top = top;
      shirtOverlay.style.left = left;
    }
    if (shirtPortal) {
      shirtPortal.style.top = top;
      shirtPortal.style.left = left;
    }
  }
});

/* --- Chave FRENTE/VERSO/MANGAS ---
   Alterna qual lado da camisa os controles editam: a câmera gira para
   o lado escolhido e o carrossel/upload/estampa de texto passam a
   aplicar a arte nesse lado. Editando qualquer lado que não seja a
   frente, o giro automático pausa (retome no play).
   Ângulos de câmera: manga esquerda do manequim fica em +X (aparece à
   direita de quem olha de frente, como ao encarar uma pessoa). */
const SIDE_BUTTONS = {
  front: document.getElementById('sideFrontBtn'),
  back: document.getElementById('sideBackBtn'),
  sleeveRight: document.getElementById('sideSleeveRightBtn'),
  sleeveLeft: document.getElementById('sideSleeveLeftBtn'),
};
const SIDE_CAMERA_ANGLES = { front: 0, back: 180, sleeveLeft: 90, sleeveRight: -90 };

function setActiveSide(side) {
  if (activeSide === side || !SIDE_BUTTONS[side]) return;
  activeSide = side;

  Object.entries(SIDE_BUTTONS).forEach(([key, btn]) => {
    btn?.classList.toggle('is-active', key === side);
  });

  window.shirtViewer3D?.setCameraAngle?.(SIDE_CAMERA_ANGLES[side] || 0);

  if (side !== 'front') setAutoRotatePaused(true);
}

Object.entries(SIDE_BUTTONS).forEach(([side, btn]) => {
  btn?.addEventListener('click', () => setActiveSide(side));
});

// Centraliza o estado de pausa (usado pelo botão play/pause e pela
// chave FRENTE/VERSO, que pausa o giro ao editar o verso).
function setAutoRotatePaused(paused) {
  autoRotatePaused = paused;
  autoRotateToggle?.classList.toggle('is-paused', paused);
  autoRotateToggle?.setAttribute(
    'aria-label',
    paused ? 'Retomar troca automática de estampas' : 'Pausar troca automática de estampas'
  );

  // Troca o desenho do ícone único: girando mostra pause, pausado mostra play.
  autoRotateToggleIcon?.setAttribute('d', paused ? PLAY_ICON_PATH : PAUSE_ICON_PATH);

  if (paused) {
    stopAutoRotate();
  } else {
    startAutoRotate();
  }
}

autoRotateToggle?.addEventListener('click', () => setAutoRotatePaused(!autoRotatePaused));

printPrevBtn?.addEventListener('click', () => {
  rotateCarousel(queuedPrintIndex - 1);
  restartAutoRotate();
});

printNextBtn?.addEventListener('click', () => {
  rotateCarousel(queuedPrintIndex + 1);
  restartAutoRotate();
});

// Pausa o giro automático enquanto o mouse está sobre o carrossel.
heroPicker?.addEventListener('mouseenter', stopAutoRotate);
heroPicker?.addEventListener('mouseleave', startAutoRotate);

// Swipe/touch sobre o manequim para trocar a estampa no mobile.
let touchStartX = 0;

heroStage?.addEventListener('touchstart', (event) => {
  touchStartX = event.touches[0].clientX;
}, { passive: true });

heroStage?.addEventListener('touchend', (event) => {
  // Com o manequim 3D ativo, arrastar no palco gira o modelo — o swipe
  // de trocar estampa fica só no carrossel de miniaturas.
  if (heroStage.classList.contains('is-3d')) return;

  const deltaX = event.changedTouches[0].clientX - touchStartX;
  const SWIPE_THRESHOLD = 40;

  if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

  rotateCarousel(deltaX < 0 ? queuedPrintIndex + 1 : queuedPrintIndex - 1);
  restartAutoRotate();
}, { passive: true });

// Quando o manequim 3D termina de carregar (viewer3d.js), projeta a
// estampa atual na FRENTE com o tamanho/posição escolhidos. O verso
// começa vazio, esperando o cliente escolher pela chave FRENTE/VERSO.
window.addEventListener('shirt3d-ready', () => {
  const print = shirtPrints[shirtPrintIndex];
  if (print && window.shirtViewer3D?.ready) {
    window.shirtViewer3D.setPrint(print.file, print.blend || 'screen', 'front');
    const t = sideTransforms.front;
    window.shirtViewer3D.setTransform({ scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY }, 'front');
  }
});

// Swipe também no próprio carrossel de miniaturas (mobile).
let pickerTouchStartX = 0;

printPicker?.addEventListener('touchstart', (event) => {
  pickerTouchStartX = event.touches[0].clientX;
}, { passive: true });

printPicker?.addEventListener('touchend', (event) => {
  const deltaX = event.changedTouches[0].clientX - pickerTouchStartX;
  const SWIPE_THRESHOLD = 40;

  if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

  rotateCarousel(deltaX < 0 ? queuedPrintIndex + 1 : queuedPrintIndex - 1);
  restartAutoRotate();
}, { passive: true });

// Recalcula a posição da trilha se a janela for redimensionada.
window.addEventListener('resize', updateTrackPosition);

renderPrintPicker();
rotateCarousel(0); // camisa e lateral começam juntas na primeira arte
startAutoRotate();

/* ---------------------------------------------------------
   Upload de estampa própria via ImgBB ("Personalizar camisa")
   Mesma chave e mesmo padrão de upload client-side (fetch +
   FormData) já usados em produção no projeto NEXO vagas.
   --------------------------------------------------------- */

const IMGBB_API_KEY = 'b7150269142e0e38166f3e528598d051';
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

const personalizarCamisaBtn = document.getElementById('personalizarCamisaBtn');
const customPrintInput = document.getElementById('customPrintInput');
const uploadFeedback = document.getElementById('uploadFeedback');
let uploadFeedbackTimeoutId;

function showUploadFeedback(message, isError) {
  if (!uploadFeedback) return;

  uploadFeedback.textContent = message;
  uploadFeedback.classList.toggle('is-error', Boolean(isError));
  uploadFeedback.classList.add('is-visible');

  clearTimeout(uploadFeedbackTimeoutId);
  uploadFeedbackTimeoutId = setTimeout(() => {
    uploadFeedback.classList.remove('is-visible');
  }, 4000);
}

/* Analisa as bordas da imagem enviada (antes do upload) para descobrir
   se ela tem fundo preto chapado. Nesses casos usamos mix-blend-mode
   "screen" — a mesma mesclagem das artes da pasta ARTE CAMISA/ — e o
   preto "some" sobre a camisa preta, em vez de aparecer um retângulo.
   Fotos comuns (bordas claras/coloridas) continuam com blend normal, e
   imagens com borda transparente também (a transparência já resolve). */
function detectDarkBackground(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const SAMPLE = 64;
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;

        let opaque = 0;
        let dark = 0;
        let total = 0;

        const samplePixel = (x, y) => {
          const i = (y * SAMPLE + x) * 4;
          total++;
          if (data[i + 3] < 40) return; // transparente: já some sozinho
          opaque++;
          const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (luminance < 46) dark++;
        };

        // Duas fileiras de pixels em cada uma das quatro bordas.
        for (let x = 0; x < SAMPLE; x++) {
          [0, 1, SAMPLE - 2, SAMPLE - 1].forEach((y) => samplePixel(x, y));
        }
        for (let y = 2; y < SAMPLE - 2; y++) {
          [0, 1, SAMPLE - 2, SAMPLE - 1].forEach((x) => samplePixel(x, y));
        }

        // Borda majoritariamente transparente -> blend normal resolve.
        if (opaque / total < 0.3) {
          resolve(false);
          return;
        }
        resolve(dark / opaque > 0.85);
      } catch (error) {
        resolve(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };

    img.src = objectUrl;
  });
}

async function uploadCustomPrint(file, printName = 'Minha Arte', forcedBlend = null) {
  if (!file.type.startsWith('image/')) {
    showUploadFeedback('Escolha um arquivo de imagem (JPG, PNG, etc).', true);
    return;
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    showUploadFeedback('Imagem muito grande. Envie um arquivo de até 8MB.', true);
    return;
  }

  const previousLabel = personalizarCamisaBtn ? personalizarCamisaBtn.textContent : '';

  if (personalizarCamisaBtn) {
    personalizarCamisaBtn.disabled = true;
    personalizarCamisaBtn.textContent = 'Enviando...';
  }

  try {
    // Decide a mesclagem antes do upload: fundo preto chapado -> screen
    // (some na camisa); foto/transparência -> normal. A estampa de texto
    // força "normal" para os balões escuros não desaparecerem.
    const blend = forcedBlend || ((await detectDarkBackground(file)) ? 'screen' : 'normal');

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`,
      { method: 'POST', body: formData }
    );
    const result = await response.json();
    const url = result?.data?.display_url || result?.data?.url;

    if (!response.ok || !result.success || !url) {
      throw new Error(result?.error?.message || 'Falha no ImgBB');
    }

    // Reaproveita o mesmo slot "Minha Arte" em envios seguintes, em vez
    // de acumular um card novo para cada foto enviada.
    const existingCustomIndex = shirtPrints.findIndex((print) => print.isCustom);
    const customPrint = { name: printName, file: url, isCustom: true, blend };

    // A arte enviada entra em destaque na lateral e já veste a camisa
    // na hora (lateral e mockup sempre mostram a mesma estampa).
    if (existingCustomIndex >= 0) {
      shirtPrints[existingCustomIndex] = customPrint;
      renderPrintPicker();
      rotateCarousel(existingCustomIndex);
    } else {
      shirtPrints.push(customPrint);
      renderPrintPicker();
      rotateCarousel(shirtPrints.length - 1);
    }

    restartAutoRotate();
    showUploadFeedback('Sua estampa foi aplicada na camisa!', false);
  } catch (error) {
    console.error('Erro no upload ImgBB:', error);
    showUploadFeedback('Não foi possível enviar sua imagem agora. Tente novamente.', true);
  } finally {
    if (personalizarCamisaBtn) {
      personalizarCamisaBtn.disabled = false;
      personalizarCamisaBtn.textContent = previousLabel || 'Personalizar camisa';
    }
  }
}

personalizarCamisaBtn?.addEventListener('click', () => customPrintInput?.click());

customPrintInput?.addEventListener('change', () => {
  const file = customPrintInput.files?.[0];
  if (file) uploadCustomPrint(file);
  customPrintInput.value = ''; // permite reenviar o mesmo arquivo depois
});

/* ---------------------------------------------------------
   Estampa de texto ("Estampa de texto")
   O cliente digita uma frase (até 6 linhas) e escolhe um dos
   estilos prontos abaixo. O texto é desenhado num canvas
   transparente, vira PNG e entra no MESMO fluxo do upload de
   imagem: ImgBB -> card na fila da lateral -> camisa na
   próxima virada do carrossel.

   Os ESTILOS (TEXT_PRINT_PRESETS) e o motor de desenho
   (drawTextPrint etc.) moraram aqui e foram extraídos para
   assets/js/text-print-engine.js, compartilhado com a página
   "Camisas de Frases". Para criar um estilo novo, edite lá.
   --------------------------------------------------------- */

const textPrintBtn = document.getElementById('textPrintBtn');
const textPrintBackdrop = document.getElementById('textPrintBackdrop');
const textPrintModal = document.getElementById('textPrintModal');
const textPrintCloseBtn = document.getElementById('textPrintCloseBtn');
const textPrintInput = document.getElementById('textPrintInput');
const textPrintStyles = document.getElementById('textPrintStyles');
const textPrintPreviewCanvas = document.getElementById('textPrintPreviewCanvas');
const applyTextPrintBtn = document.getElementById('applyTextPrintBtn');
const textPrintNote = document.getElementById('textPrintNote');

let activeTextPresetId = TEXT_PRINT_PRESETS[0].id;


// Frase digitada -> linhas não vazias, no máximo 6.
function getTextPrintLines() {
  return (textPrintInput?.value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, TEXT_PRINT_MAX_LINES);
}



// Redesenha a prévia grande e todos os mini-canvas da galeria.
function renderTextPrintPreviews() {
  if (!textPrintModal?.classList.contains('is-open')) return;

  const lines = getTextPrintLines();
  const previewLines = lines.length ? lines : TEXT_PRINT_SAMPLE;

  TEXT_PRINT_PRESETS.forEach((preset) => {
    const card = textPrintStyles?.querySelector(`[data-preset="${preset.id}"]`);
    const canvas = card?.querySelector('canvas');
    if (canvas) drawTextPrint(canvas, preset, previewLines);
  });

  const activePreset = TEXT_PRINT_PRESETS.find((p) => p.id === activeTextPresetId);
  if (textPrintPreviewCanvas && activePreset) {
    drawTextPrint(textPrintPreviewCanvas, activePreset, previewLines);
  }
}

// Monta a galeria de estilos (uma vez).
function renderTextStyleCards() {
  if (!textPrintStyles) return;

  textPrintStyles.innerHTML = TEXT_PRINT_PRESETS
    .map((preset) => `
      <button class="text-style-card${preset.id === activeTextPresetId ? ' is-active' : ''}" type="button" data-preset="${preset.id}">
        <canvas width="220" height="220"></canvas>
        <span>${preset.name}</span>
      </button>
    `)
    .join('');

  textPrintStyles.querySelectorAll('.text-style-card').forEach((card) => {
    card.addEventListener('click', () => {
      activeTextPresetId = card.dataset.preset;
      textPrintStyles.querySelectorAll('.text-style-card').forEach((el) => {
        el.classList.toggle('is-active', el === card);
      });
      renderTextPrintPreviews();
    });
  });
}

function openTextPrintModal() {
  closeCart();
  closeAuth();
  textPrintModal?.classList.add('is-open');
  textPrintBackdrop?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  if (textPrintNote) textPrintNote.textContent = '';
  textFontsReady.then(renderTextPrintPreviews);
  renderTextPrintPreviews();
  textPrintInput?.focus();
}

function closeTextPrintModal() {
  textPrintModal?.classList.remove('is-open');
  textPrintBackdrop?.classList.remove('is-open');
  document.body.style.overflow = '';
}

textPrintBtn?.addEventListener('click', openTextPrintModal);
textPrintCloseBtn?.addEventListener('click', closeTextPrintModal);
textPrintBackdrop?.addEventListener('click', closeTextPrintModal);

let textPrintRenderTimeout;
textPrintInput?.addEventListener('input', () => {
  if (textPrintNote) {
    const lineCount = (textPrintInput.value.match(/\n/g) || []).length + 1;
    textPrintNote.textContent = lineCount > TEXT_PRINT_MAX_LINES
      ? `Só as ${TEXT_PRINT_MAX_LINES} primeiras linhas entram na estampa.`
      : '';
  }
  clearTimeout(textPrintRenderTimeout);
  textPrintRenderTimeout = setTimeout(renderTextPrintPreviews, 120);
});

// Gera o PNG final em alta resolução e envia pelo fluxo de upload já
// existente — a frase entra na fila da lateral como "Minha Frase".
applyTextPrintBtn?.addEventListener('click', async () => {
  const lines = getTextPrintLines();

  if (!lines.length) {
    if (textPrintNote) textPrintNote.textContent = 'Digite sua frase antes de aplicar.';
    textPrintInput?.focus();
    return;
  }

  const previousLabel = applyTextPrintBtn.textContent;
  applyTextPrintBtn.disabled = true;
  applyTextPrintBtn.textContent = 'Gerando estampa...';

  try {
    await textFontsReady;

    const preset = TEXT_PRINT_PRESETS.find((p) => p.id === activeTextPresetId) || TEXT_PRINT_PRESETS[0];
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    drawTextPrint(canvas, preset, lines);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Falha ao gerar o PNG da estampa');
    const file = new File([blob], 'minha-frase.png', { type: 'image/png' });

    closeTextPrintModal();
    await uploadCustomPrint(file, 'Minha Frase', 'normal');
  } catch (error) {
    console.error('Erro ao gerar a estampa de texto:', error);
    if (textPrintNote) textPrintNote.textContent = 'Não foi possível gerar a estampa agora. Tente novamente.';
  } finally {
    applyTextPrintBtn.disabled = false;
    applyTextPrintBtn.textContent = previousLabel;
  }
});

renderTextStyleCards();

/* ---------------------------------------------------------
   Carrinho de compras (Fase 1 do fluxo de compra)
   Só front-end: guarda os itens no localStorage do navegador.
   Login, endereço, forma de pagamento e checkout real ainda
   não existem — isso é assunto das próximas fases.
   --------------------------------------------------------- */

const shopStore = window.UrsoninhosStore;
let cart = shopStore?.loadCart() || [];

const cartToggleBtn = document.getElementById('cartToggleBtn');
const cartCloseBtn = document.getElementById('cartCloseBtn');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsEl = document.getElementById('cartItems');
const cartCountEl = document.getElementById('cartCount');
const cartTotalEl = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutNote = document.getElementById('checkoutNote');
const heroSizeSelect = document.getElementById('heroSizeSelect');
const heroQtyInput = document.getElementById('heroQtyInput');
const heroQtyDecrease = document.getElementById('heroQtyDecrease');
const heroQtyIncrease = document.getElementById('heroQtyIncrease');

function formatBRL(value) {
  return shopStore ? shopStore.formatBRL(value) : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function refreshCartState() {
  cart = shopStore?.loadCart() || [];
}

function getSelectedCoverage() {
  const hasBack = sidePrintSelections.back !== null;
  const hasSleeves = sidePrintSelections.sleeveLeft !== null || sidePrintSelections.sleeveRight !== null;

  if (!hasBack && !hasSleeves) {
    return { label: 'Frente', price: 20 };
  }

  if (hasBack && hasSleeves) {
    return { label: 'Frente, verso e laterais', price: 50 };
  }

  if (hasBack) {
    return { label: 'Frente e verso', price: 40 };
  }

  return { label: 'Frente e laterais', price: 40 };
}

function normalizeHeroQty() {
  if (!heroQtyInput) return 1;
  const qty = Math.max(1, parseInt(heroQtyInput.value || '1', 10) || 1);
  heroQtyInput.value = String(qty);
  return qty;
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

async function generateFrontPreview() {
  const frontPrint = shirtPrints[sidePrintSelections.front ?? shirtPrintIndex];
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  try {
    // Mockup da camisa preta no cabide: a estampa é desenhada no peito.
    const base = await loadImage('assets/img/camisa-modelo-card.jpg');
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    if (frontPrint?.file) {
      const printImage = await loadImage(frontPrint.file);
      const scale = sideTransforms.front.scale || 1;
      const offsetX = sideTransforms.front.offsetX || 0;
      const offsetY = sideTransforms.front.offsetY || 0;
      const printWidth = 250 * scale;
      const printHeight = 250 * scale;
      // Centro do peito da camisa no mockup (levemente à esquerda do centro).
      const x = canvas.width * 0.478 - printWidth / 2 + offsetX * 10;
      const y = canvas.height * 0.32 + offsetY * 10;
      // Artes com fundo preto chapado usam 'screen' (o preto some sobre a
      // camisa preta); as demais ficam normais — mesmo critério do overlay.
      ctx.globalCompositeOperation = (frontPrint.blend || 'screen') === 'screen' ? 'screen' : 'source-over';
      ctx.drawImage(printImage, x, y, printWidth, printHeight);
      ctx.globalCompositeOperation = 'source-over';
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Nao foi possivel gerar o preview frontal da camisa:', error);
    return 'assets/img/banner-estatico.png';
  }
}

function addToCart(item) {
  if (!shopStore) return;
  shopStore.addCartItem(item);
  refreshCartState();
  renderCart();
}

function changeQty(lineId, delta) {
  const item = cart.find((entry) => entry.lineId === lineId);
  if (!item) return;

  shopStore?.updateCartItemQuantity(lineId, item.quantity + delta);
  refreshCartState();
  renderCart();
}

function removeItem(lineId) {
  shopStore?.removeCartItem(lineId);
  refreshCartState();
  renderCart();
}

function renderCart() {
  refreshCartState();
  updateCartBadge();

  if (!cartItemsEl || !cartTotalEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.</p>';
    cartTotalEl.textContent = formatBRL(0);
    return;
  }

  cartItemsEl.innerHTML = cart
    .map((item) => {
      const thumbContent = item.previewImage
        ? `<img src="${item.previewImage}" alt="${item.title}">`
        : '🛍️';

      return `
        <div class="cart-item" data-id="${item.lineId}">
          <div class="cart-item__thumb">${thumbContent}</div>
          <div class="cart-item__info">
            <h4>${item.title}</h4>
            ${item.variantLabel ? `<p class="cart-item__variant">${item.variantLabel}</p>` : ''}
            ${item.size ? `<p class="cart-item__variant">Tamanho: ${item.size}</p>` : ''}
            <div class="cart-item__qty">
              <button type="button" data-action="decrease" aria-label="Diminuir quantidade">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <div class="cart-item__right">
            <span class="cart-item__price">${formatBRL(item.price * item.quantity)}</span>
            <button type="button" class="cart-item__remove" data-action="remove" aria-label="Remover item">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  cartItemsEl.querySelectorAll('.cart-item').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('[data-action="increase"]')?.addEventListener('click', () => changeQty(id, 1));
    el.querySelector('[data-action="decrease"]')?.addEventListener('click', () => changeQty(id, -1));
    el.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeItem(id));
  });

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotalEl.textContent = formatBRL(total);
}

function updateCartBadge() {
  if (!cartCountEl) return;

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountEl.textContent = String(totalQty);

  cartCountEl.classList.remove('is-bump');
  // Força reflow para poder reiniciar a animação de "bump" a cada clique.
  void cartCountEl.offsetWidth;
  cartCountEl.classList.add('is-bump');
}

function openCart() {
  closeAuth(); // evita os dois painéis abertos ao mesmo tempo
  showCartStep('shopping'); // sempre abre no passo de compras
  cartDrawer?.classList.add('is-open');
  cartBackdrop?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer?.classList.remove('is-open');
  cartBackdrop?.classList.remove('is-open');
  document.body.style.overflow = '';
}

function toggleCart() {
  if (cartDrawer?.classList.contains('is-open')) {
    closeCart();
  } else {
    openCart();
  }
}

cartToggleBtn?.addEventListener('click', () => {
  window.location.href = 'carrinho.html';
});
cartCloseBtn?.addEventListener('click', closeCart);
cartBackdrop?.addEventListener('click', closeCart);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeCart();
  closeAuth();
  closeTextPrintModal();
});

// Validação progressiva: cada fase do cronograma vai liberando um
// passo a mais. Quando tudo estiver ok, avança para a revisão do
// pedido (Fase 5).
checkoutBtn?.addEventListener('click', () => {
  if (!checkoutNote) return;

  if (!cart.length) {
    checkoutNote.textContent = 'Adicione algo ao carrinho antes de continuar.';
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    checkoutNote.textContent = 'Entre ou cadastre-se para continuar.';
    return;
  }

  if (!user.address) {
    checkoutNote.textContent = 'Cadastre um endereço de entrega no seu perfil para continuar.';
    return;
  }

  if (!selectedPaymentMethod) {
    checkoutNote.textContent = 'Escolha uma forma de pagamento para continuar.';
    return;
  }

  checkoutNote.textContent = '';
  goToReview(user);
});

// Botões "Adicionar" dos cards de produto em "Nossos destaques".
document.querySelectorAll('.product-card[data-price]').forEach((card) => {
  const addBtn = card.querySelector('.product-card__add');
  addBtn?.addEventListener('click', () => {
    addToCart({
      productId: `produto::${card.dataset.name}`,
      title: card.dataset.name,
      variantLabel: 'Produto pronto',
      price: parseFloat(card.dataset.price),
      size: '',
      quantity: 1,
      previewImage: '',
      metadata: { emoji: card.dataset.emoji || '' },
    });
  });
});

renderCart();

/* ---------------------------------------------------------
   Botão "Adicionar ao carrinho" do hero (camisa + estampa atual)
   --------------------------------------------------------- */

const addToCartBtn = document.getElementById('addToCartBtn');
const cartFeedback = document.getElementById('cartFeedback');
let feedbackTimeoutId;

heroQtyDecrease?.addEventListener('click', () => {
  if (!heroQtyInput) return;
  heroQtyInput.value = String(Math.max(1, normalizeHeroQty() - 1));
});

heroQtyIncrease?.addEventListener('click', () => {
  if (!heroQtyInput) return;
  heroQtyInput.value = String(normalizeHeroQty() + 1);
});

heroQtyInput?.addEventListener('change', normalizeHeroQty);

addToCartBtn?.addEventListener('click', async () => {
  // Adiciona a estampa que está VESTIDA na camisa (mockup), que não é
  // necessariamente a que está em destaque na lateral (fila).
  const print = shirtPrints[shirtPrintIndex];
  const qty = normalizeHeroQty();
  const size = heroSizeSelect?.value || 'M';
  const coverage = getSelectedCoverage();
  const previewImage = await generateFrontPreview();

  addToCart({
    productId: `camisa-personalizada::${coverage.label}`,
    title: 'Camisa Personalizada',
    variantLabel: `${coverage.label} • Estampa: ${print.name}`,
    price: coverage.price,
    size,
    quantity: qty,
    previewImage,
    previewViews: { front: previewImage },
    metadata: {
      coverage: coverage.label,
      printName: print.name,
      sides: { ...sidePrintSelections },
    },
  });

  if (!cartFeedback) return;

  cartFeedback.textContent = `${coverage.label} adicionada ao carrinho por ${formatBRL(coverage.price)} cada.`;
  cartFeedback.classList.add('is-visible');

  clearTimeout(feedbackTimeoutId);
  feedbackTimeoutId = setTimeout(() => {
    cartFeedback.classList.remove('is-visible');
  }, 2800);
});

/* ---------------------------------------------------------
   Login / Cadastro / Perfil (Fase 2 do fluxo de compra)
   Só front-end: usuários e sessão ficam no localStorage.
   ATENÇÃO: isso é um mock para demonstrar o fluxo — a senha é
   guardada em texto simples, sem nenhuma segurança real. Login
   de verdade só existe quando houver backend (Fase 6).
   --------------------------------------------------------- */

const USERS_STORAGE_KEY = 'ursoninhos_users';
const SESSION_STORAGE_KEY = 'ursoninhos_session';

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Não foi possível ler os usuários salvos:', error);
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function loadSession() {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function saveSession(email) {
  localStorage.setItem(SESSION_STORAGE_KEY, email);
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getCurrentUser() {
  const email = loadSession();
  if (!email) return null;
  return loadUsers().find((entry) => entry.email === email) || null;
}

// Atualiza (merge raso) os dados do usuário logado, ex: updateCurrentUser({ address }).
function updateCurrentUser(patch) {
  const email = loadSession();
  if (!email) return;

  const users = loadUsers();
  const index = users.findIndex((entry) => entry.email === email);
  if (index === -1) return;

  users[index] = { ...users[index], ...patch };
  saveUsers(users);
}

const authToggleBtn = document.getElementById('authToggleBtn');
const authBackdrop = document.getElementById('authBackdrop');
const authDrawer = document.getElementById('authDrawer');
const authDrawerTitle = document.getElementById('authDrawerTitle');
const authCloseBtn = document.getElementById('authCloseBtn');
const authTabLogin = document.getElementById('authTabLogin');
const authTabRegister = document.getElementById('authTabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const authGuestView = document.getElementById('authGuestView');
const authProfileView = document.getElementById('authProfileView');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const logoutBtn = document.getElementById('logoutBtn');

function openAuth() {
  closeCart(); // evita os dois painéis abertos ao mesmo tempo
  authDrawer?.classList.add('is-open');
  authBackdrop?.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeAuth() {
  authDrawer?.classList.remove('is-open');
  authBackdrop?.classList.remove('is-open');
  document.body.style.overflow = '';
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  authTabLogin?.classList.toggle('is-active', isLogin);
  authTabRegister?.classList.toggle('is-active', !isLogin);
  if (loginForm) loginForm.hidden = !isLogin;
  if (registerForm) registerForm.hidden = isLogin;
  if (loginError) loginError.textContent = '';
  if (registerError) registerError.textContent = '';
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

// Alterna entre a visão de visitante (login/cadastro) e a de cliente logado.
function renderAuthState() {
  const user = getCurrentUser();

  if (user) {
    if (authGuestView) authGuestView.hidden = true;
    if (authProfileView) authProfileView.hidden = false;
    if (authDrawerTitle) authDrawerTitle.textContent = 'Meu perfil';
    if (profileAvatar) profileAvatar.textContent = getInitials(user.name) || '?';
    if (profileName) profileName.textContent = user.name;
    if (profileEmail) profileEmail.textContent = user.email;
    if (authToggleBtn) authToggleBtn.textContent = `Olá, ${user.name.split(' ')[0]}`;
    renderAddressSection(user);
  } else {
    if (authGuestView) authGuestView.hidden = false;
    if (authProfileView) authProfileView.hidden = true;
    if (authDrawerTitle) authDrawerTitle.textContent = 'Entrar';
    if (authToggleBtn) authToggleBtn.textContent = 'Entrar / Cadastrar';
  }
}

authToggleBtn?.addEventListener('click', () => {
  renderAuthState();
  openAuth();
});
authCloseBtn?.addEventListener('click', closeAuth);
authBackdrop?.addEventListener('click', closeAuth);

authTabLogin?.addEventListener('click', () => switchAuthTab('login'));
authTabRegister?.addEventListener('click', () => switchAuthTab('register'));

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!loginError) return;

  const formData = new FormData(loginForm);
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  const user = loadUsers().find((entry) => entry.email === email);

  if (!user || user.password !== password) {
    loginError.textContent = 'E-mail ou senha incorretos.';
    return;
  }

  loginError.textContent = '';
  saveSession(user.email);
  loginForm.reset();
  renderAuthState();
});

registerForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!registerError) return;

  const formData = new FormData(registerForm);
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password !== confirmPassword) {
    registerError.textContent = 'As senhas não coincidem.';
    return;
  }

  const users = loadUsers();
  if (users.some((entry) => entry.email === email)) {
    registerError.textContent = 'Já existe uma conta com esse e-mail.';
    return;
  }

  users.push({ name, email, password });
  saveUsers(users);
  saveSession(email);

  registerError.textContent = '';
  registerForm.reset();
  renderAuthState();
});

logoutBtn?.addEventListener('click', () => {
  clearSession();
  switchAuthTab('login');
  renderAuthState();
});

/* ---------------------------------------------------------
   Endereço de entrega (Fase 3 do fluxo de compra)
   Salvo dentro do próprio usuário no localStorage. CEP é
   autopreenchido via ViaCEP (API pública, sem chave, direto
   do navegador — sem backend próprio).
   --------------------------------------------------------- */

const addressForm = document.getElementById('addressForm');
const addressError = document.getElementById('addressError');
const addressDisplay = document.getElementById('addressDisplay');
const addressText = document.getElementById('addressText');
const editAddressBtn = document.getElementById('editAddressBtn');
const cancelAddressBtn = document.getElementById('cancelAddressBtn');
const cepInput = document.getElementById('cepInput');
const cepStatus = document.getElementById('cepStatus');
const streetInput = document.getElementById('streetInput');
const numberInput = document.getElementById('numberInput');
const neighborhoodInput = document.getElementById('neighborhoodInput');
const cityInput = document.getElementById('cityInput');
const stateInput = document.getElementById('stateInput');

function formatAddress(address) {
  const complement = address.complement ? ` - ${address.complement}` : '';
  return `${address.street}, ${address.number}${complement} — ${address.neighborhood}, ${address.city}/${address.state} — CEP ${address.cep}`;
}

function fillAddressForm(address) {
  if (!addressForm) return;
  addressForm.cep.value = address?.cep || '';
  addressForm.street.value = address?.street || '';
  addressForm.number.value = address?.number || '';
  addressForm.complement.value = address?.complement || '';
  addressForm.neighborhood.value = address?.neighborhood || '';
  addressForm.city.value = address?.city || '';
  addressForm.state.value = address?.state || '';
  if (cepStatus) {
    cepStatus.textContent = '';
    cepStatus.classList.remove('is-error', 'is-success');
  }
}

function showAddressForm(hasExisting) {
  if (addressDisplay) addressDisplay.hidden = true;
  if (addressForm) addressForm.hidden = false;
  if (editAddressBtn) editAddressBtn.hidden = true;
  if (cancelAddressBtn) cancelAddressBtn.hidden = !hasExisting;
}

function showAddressDisplay(address) {
  if (addressText) addressText.textContent = formatAddress(address);
  if (addressDisplay) addressDisplay.hidden = false;
  if (addressForm) addressForm.hidden = true;
  if (editAddressBtn) editAddressBtn.hidden = false;
}

// Chamado sempre que o perfil é exibido: mostra o endereço salvo,
// ou o formulário vazio se o cliente ainda não cadastrou nenhum.
function renderAddressSection(user) {
  if (!user) return;

  if (user.address) {
    showAddressDisplay(user.address);
  } else {
    fillAddressForm(null);
    showAddressForm(false);
  }
}

function formatCep(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

async function lookupCep(cep) {
  if (!cepStatus) return;

  cepStatus.textContent = 'Buscando endereço...';
  cepStatus.classList.remove('is-error', 'is-success');

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (!response.ok || data.erro) {
      cepStatus.textContent = 'CEP não encontrado.';
      cepStatus.classList.add('is-error');
      return;
    }

    if (streetInput) streetInput.value = data.logradouro || '';
    if (neighborhoodInput) neighborhoodInput.value = data.bairro || '';
    if (cityInput) cityInput.value = data.localidade || '';
    if (stateInput) stateInput.value = data.uf || '';

    cepStatus.textContent = 'Endereço encontrado — confira e complete o número.';
    cepStatus.classList.add('is-success');
    numberInput?.focus();
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    cepStatus.textContent = 'Não foi possível buscar o CEP agora.';
    cepStatus.classList.add('is-error');
  }
}

cepInput?.addEventListener('input', () => {
  cepInput.value = formatCep(cepInput.value);
  const digits = cepInput.value.replace(/\D/g, '');
  if (digits.length === 8) lookupCep(digits);
});

editAddressBtn?.addEventListener('click', () => {
  const user = getCurrentUser();
  fillAddressForm(user?.address || null);
  showAddressForm(Boolean(user?.address));
});

cancelAddressBtn?.addEventListener('click', () => {
  const user = getCurrentUser();
  if (user?.address) showAddressDisplay(user.address);
});

addressForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!addressError) return;

  const formData = new FormData(addressForm);
  const address = {
    cep: String(formData.get('cep') || '').trim(),
    street: String(formData.get('street') || '').trim(),
    number: String(formData.get('number') || '').trim(),
    complement: String(formData.get('complement') || '').trim(),
    neighborhood: String(formData.get('neighborhood') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    state: String(formData.get('state') || '').trim().toUpperCase(),
  };

  if (!address.cep || !address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
    addressError.textContent = 'Preencha todos os campos obrigatórios.';
    return;
  }

  addressError.textContent = '';
  updateCurrentUser({ address });
  showAddressDisplay(address);
});

renderAuthState();

/* ---------------------------------------------------------
   Forma de pagamento (Fase 4 do fluxo de compra)
   Só a escolha do método fica salva (localStorage). Os campos do
   cartão são só ilustrativos: nada é validado de verdade, enviado
   ou guardado em lugar nenhum — não existe gateway de pagamento
   ainda (isso é Fase 7 do cronograma).
   --------------------------------------------------------- */

const PAYMENT_METHOD_STORAGE_KEY = 'ursoninhos_payment_method';

const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
const paymentDetailPix = document.getElementById('paymentDetailPix');
const paymentDetailCard = document.getElementById('paymentDetailCard');
const paymentDetailBoleto = document.getElementById('paymentDetailBoleto');
const pixCopyBtn = document.getElementById('pixCopyBtn');
const pixCode = document.getElementById('pixCode');

let selectedPaymentMethod = localStorage.getItem(PAYMENT_METHOD_STORAGE_KEY) || null;

function renderPaymentDetail() {
  if (paymentDetailPix) paymentDetailPix.hidden = selectedPaymentMethod !== 'pix';
  if (paymentDetailCard) paymentDetailCard.hidden = selectedPaymentMethod !== 'card';
  if (paymentDetailBoleto) paymentDetailBoleto.hidden = selectedPaymentMethod !== 'boleto';
}

// Restaura a seleção salva (se houver) ao carregar a página.
if (selectedPaymentMethod) {
  const savedRadio = document.querySelector(`input[name="paymentMethod"][value="${selectedPaymentMethod}"]`);
  if (savedRadio) savedRadio.checked = true;
}
renderPaymentDetail();

paymentRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    selectedPaymentMethod = radio.value;
    localStorage.setItem(PAYMENT_METHOD_STORAGE_KEY, selectedPaymentMethod);
    renderPaymentDetail();
  });
});

pixCopyBtn?.addEventListener('click', async () => {
  if (!pixCode) return;

  try {
    await navigator.clipboard.writeText(pixCode.value);
    const previousLabel = pixCopyBtn.textContent;
    pixCopyBtn.textContent = 'Copiado!';
    setTimeout(() => {
      pixCopyBtn.textContent = previousLabel;
    }, 2000);
  } catch (error) {
    console.error('Não foi possível copiar o código Pix:', error);
    pixCode.select();
  }
});

/* ---------------------------------------------------------
   Resumo do pedido + confirmação (Fase 5 do fluxo de compra)
   Ainda sem backend: "confirmar" só gera um número de pedido
   fake, limpa o carrinho e mostra uma tela de sucesso. Nenhum
   pedido é enviado ou guardado de verdade (Fase 6 do cronograma).
   --------------------------------------------------------- */

const cartDrawerTitle = document.getElementById('cartDrawerTitle');
const cartStepShopping = document.getElementById('cartStepShopping');
const cartStepReview = document.getElementById('cartStepReview');
const cartStepConfirmed = document.getElementById('cartStepConfirmed');
const reviewItems = document.getElementById('reviewItems');
const reviewAddress = document.getElementById('reviewAddress');
const reviewPayment = document.getElementById('reviewPayment');
const reviewTotal = document.getElementById('reviewTotal');
const confirmOrderBtn = document.getElementById('confirmOrderBtn');
const backToCartBtn = document.getElementById('backToCartBtn');
const orderNumberEl = document.getElementById('orderNumber');
const continueShoppingBtn = document.getElementById('continueShoppingBtn');

const PAYMENT_METHOD_LABELS = {
  pix: 'Pix',
  card: 'Cartão de crédito',
  boleto: 'Boleto',
};

function showCartStep(step) {
  if (cartStepShopping) cartStepShopping.hidden = step !== 'shopping';
  if (cartStepReview) cartStepReview.hidden = step !== 'review';
  if (cartStepConfirmed) cartStepConfirmed.hidden = step !== 'confirmed';

  if (cartDrawerTitle) {
    cartDrawerTitle.textContent = {
      shopping: 'Seu carrinho',
      review: 'Revisar pedido',
      confirmed: 'Pedido confirmado',
    }[step];
  }
}

function goToReview(user) {
  if (reviewItems) {
    reviewItems.innerHTML = cart
      .map((item) => `
        <p class="address-display">
          ${item.quantity}x ${item.title}${item.variantLabel ? ` (${item.variantLabel})` : ''} — ${formatBRL(item.price * item.quantity)}
        </p>
      `)
      .join('');
  }

  if (reviewAddress) reviewAddress.textContent = formatAddress(user.address);
  if (reviewPayment) reviewPayment.textContent = PAYMENT_METHOD_LABELS[selectedPaymentMethod] || '—';

  if (reviewTotal) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    reviewTotal.textContent = formatBRL(total);
  }

  showCartStep('review');
}

function generateOrderNumber() {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  const timestamp = Date.now().toString().slice(-5);
  return `URS-${timestamp}${random}`;
}

backToCartBtn?.addEventListener('click', () => showCartStep('shopping'));

confirmOrderBtn?.addEventListener('click', () => {
  if (orderNumberEl) orderNumberEl.textContent = generateOrderNumber();

  // O pedido foi "fechado": esvazia o carrinho para a próxima compra.
  shopStore?.clearCart();
  refreshCartState();
  renderCart();

  showCartStep('confirmed');
});

continueShoppingBtn?.addEventListener('click', () => {
  if (checkoutNote) checkoutNote.textContent = '';
  showCartStep('shopping');
});

/* ---------------------------------------------------------
   Camisas de Frases -> personalizador
   Chegando com index.html?frase=<id> (vitrine da página
   camisas-de-frases.html), a frase já entra vestida na camisa
   com o estilo dela, pronta para o cliente ajustar tamanho,
   posição e quantidade — e o modal "Inserir texto" abre
   pré-preenchido com a frase e o estilo para editar.
   --------------------------------------------------------- */
(function bootFraseDaVitrine() {
  const fraseId = new URLSearchParams(window.location.search).get('frase');
  if (!fraseId || !window.UrsoninhosFrases) return;

  const produto = window.UrsoninhosFrases.gerarProdutosDeFrases().find((p) => p.id === fraseId);
  if (!produto) return;

  // Modal de texto pré-preenchido: o cliente pode editar a frase
  // mantendo (ou trocando) o estilo aplicado.
  if (textPrintInput) textPrintInput.value = produto.linhas.join('\n');
  activeTextPresetId = produto.presetId;
  renderTextStyleCards();

  (async () => {
    try {
      await textFontsReady;

      const preset = TEXT_PRINT_PRESETS.find((p) => p.id === produto.presetId) || TEXT_PRINT_PRESETS[0];
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      drawTextPrint(canvas, preset, produto.linhas);
      const dataUrl = canvas.toDataURL('image/png');

      // Mesmo caminho do upload de arte, mas local (sem ImgBB): a frase
      // entra como arte em destaque na lateral e veste a camisa na hora.
      const customPrint = { name: produto.titulo, file: dataUrl, isCustom: true, blend: 'normal' };
      const existingCustomIndex = shirtPrints.findIndex((print) => print.isCustom);
      if (existingCustomIndex >= 0) {
        shirtPrints[existingCustomIndex] = customPrint;
        renderPrintPicker();
        rotateCarousel(existingCustomIndex);
      } else {
        shirtPrints.push(customPrint);
        renderPrintPicker();
        rotateCarousel(shirtPrints.length - 1);
      }
      // Giro automático pausado: a frase escolhida fica vestida até o
      // cliente decidir (retome no botão de play, como sempre).
      setAutoRotatePaused(true);
      showUploadFeedback('Frase aplicada na camisa! Ajuste como quiser ou adicione ao carrinho.', false);
    } catch (error) {
      console.error('Não foi possível aplicar a frase da vitrine:', error);
    }
  })();
})();
