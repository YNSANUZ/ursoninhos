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
        <span class="print-card__label">${print.name}</span>
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

   Cada estilo é um objeto de configuração; `line(i, n)` devolve
   como a linha i (de n) deve ser desenhada. Para criar um estilo
   novo (11, 12...), basta acrescentar um objeto neste array.
   --------------------------------------------------------- */

const TEXT_SANS = 'Arial, Helvetica, sans-serif';
const TEXT_SERIF = "Georgia, 'Times New Roman', serif";
const TEXT_CURSIVE = "'Dancing Script', cursive";
const TEXT_CONDENSED = "'Bebas Neue', sans-serif";
const TEXT_ANTON = "'Anton', sans-serif";
const TEXT_PACIFICO = "'Pacifico', cursive";
const TEXT_CAVEAT = "'Caveat', cursive";
const TEXT_MARKER = "'Permanent Marker', cursive";
const TEXT_AMATIC = "'Amatic SC', cursive";
const TEXT_VIBES = "'Great Vibes', cursive";
const TEXT_LOBSTER = "'Lobster', cursive";
const TEXT_OSWALD = "'Oswald', sans-serif";
const TEXT_PLAYFAIR = "'Playfair Display', serif";
const TEXT_TYPEWRITER = "'Special Elite', 'Courier New', monospace";

const TEXT_PRINT_PRESETS = [
  {
    id: 'whatsapp',
    name: 'Balões WhatsApp',
    type: 'bubbles', // renderizador próprio (balões agrupados à esquerda)
  },
  {
    id: 'branco',
    name: 'Branco sólido',
    line: () => ({ font: TEXT_SANS, mul: 1, lh: 1.5 }),
  },
  {
    id: 'statement',
    name: 'Statement',
    line: () => ({ font: TEXT_CONDENSED, mul: 1.7, lh: 1.04, spacing: 0.03, upper: true }),
  },
  {
    id: 'contorno',
    name: 'Só contorno',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 1.1, lh: 1.32, mode: 'stroke', upper: true }),
  },
  {
    id: 'misto',
    name: 'Sólido + contorno',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid
        ? { font: TEXT_SANS, weight: 'bold', mul: 1.45, lh: 1.22, mode: 'stroke', upper: true }
        : { font: TEXT_SANS, weight: 'bold', mul: 0.95, lh: 1.4, upper: true };
    },
  },
  {
    id: 'cursiva',
    name: 'Cursiva',
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.35, lh: 1.3 }),
  },
  {
    id: 'mix',
    name: 'Arial + cursiva',
    line: (i) => (i % 2
      ? { font: TEXT_CURSIVE, weight: '600', mul: 2, lh: 1.12 }
      : { font: TEXT_SANS, mul: 0.68, lh: 1.7, spacing: 0.26, upper: true }),
  },
  {
    id: 'serif',
    name: 'Editorial',
    line: () => ({ font: "Georgia, 'Times New Roman', serif", italic: true, mul: 1, lh: 1.5 }),
  },
  {
    id: 'maquina',
    name: 'Máquina de escrever',
    line: (i, n) => ({ font: "'Courier New', monospace", mul: 0.85, lh: 1.62, lower: true, suffix: i === n - 1 ? '_' : '' }),
  },
  {
    id: 'dourado',
    name: 'Destaque dourado',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.42, upper: true, color: i === mid ? '#d9a75c' : '#ffffff' };
    },
  },

  /* --- Estilos 11 a 40, inspirados nas referências do Pinterest ---
     Recursos extras que o motor entende: bg (tarja atrás da linha),
     strike (palavra riscada), underline, glow (neon), rotate (linha
     inclinada), frame no preset (moldura) e decoTop/decoBottom
     (enfeites como corações, borboletas e coroa via emoji). */
  {
    id: 'marca-texto',
    name: 'Marca-texto',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid
        ? { font: TEXT_ANTON, mul: 1.1, lh: 1.32, upper: true, bg: '#b6e63e', color: '#141414' }
        : { font: TEXT_ANTON, mul: 1.1, lh: 1.32, upper: true };
    },
  },
  {
    id: 'coracao',
    name: 'Caligrafia + coração',
    line: (i, n) => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.3, lh: 1.28, suffix: i === n - 1 ? ' ❤️' : '' }),
  },
  {
    id: 'pincel-duo',
    name: 'Pincel duotone',
    line: (i) => ({ font: TEXT_MARKER, mul: 1.1, lh: 1.3, upper: true, color: i % 2 ? '#e24b4a' : '#ffffff' }),
  },
  {
    id: 'script-inclinado',
    name: 'Script inclinado',
    line: () => ({ font: TEXT_PACIFICO, mul: 1.3, lh: 1.5, color: '#e05545', rotate: -8 }),
  },
  {
    id: 'maquina-titulo',
    name: 'Máquina com título',
    line: (i) => (i === 0
      ? { font: TEXT_TYPEWRITER, mul: 1.4, lh: 1.4, spacing: 0.18 }
      : { font: TEXT_TYPEWRITER, mul: 0.66, lh: 1.7 }),
  },
  {
    id: 'borboletas',
    name: 'Borboletas',
    decoTop: { text: '🦋', style: { font: TEXT_SANS, mul: 0.9, lh: 1.5 } },
    decoBottom: { text: '🦋', style: { font: TEXT_SANS, mul: 0.9, lh: 1.5 } },
    line: (i) => (i % 2
      ? { font: TEXT_SANS, mul: 0.7, lh: 1.6, spacing: 0.24, upper: true }
      : { font: TEXT_VIBES, mul: 1.7, lh: 1.18 }),
  },
  {
    id: 'retro-teal',
    name: 'Retrô colorido',
    line: (i, n) => ({ font: TEXT_LOBSTER, mul: 1.35, lh: 1.35, color: '#35b5a5', suffix: i === n - 1 ? ' 📍' : '' }),
  },
  {
    id: 'empilhado',
    name: 'Empilhado dramático',
    decoTop: { text: '♛', style: { font: TEXT_SANS, mul: 0.7, lh: 1.4, color: '#d9a75c' } },
    line: (i) => (i % 2
      ? { font: TEXT_OSWALD, weight: '500', mul: 1.6, lh: 1.1, upper: true }
      : { font: TEXT_OSWALD, weight: '500', mul: 0.8, lh: 1.28, upper: true, spacing: 0.12, color: '#cfcfcf' }),
  },
  {
    id: 'caps-script',
    name: 'Caps + script final',
    line: (i, n) => (i === n - 1 && n > 1
      ? { font: TEXT_PACIFICO, mul: 1.7, lh: 1.4, color: '#d9a75c' }
      : { font: TEXT_SANS, weight: 'bold', mul: 0.8, lh: 1.5, upper: true, spacing: 0.08 }),
  },
  {
    id: 'emoldurado',
    name: 'Emoldurado',
    frame: { pad: 0.6 },
    line: () => ({ font: TEXT_SERIF, mul: 0.95, lh: 1.55, upper: true, spacing: 0.06 }),
  },
  {
    id: 'riscado',
    name: 'Riscado',
    line: (i, n) => {
      const mid = Math.floor((n - 1) / 2);
      return i === mid && n > 1
        ? { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.4, upper: true, color: '#8f8f8f', strike: '#e24b4a' }
        : { font: TEXT_SANS, weight: 'bold', mul: 1.15, lh: 1.35, upper: true };
    },
  },
  {
    id: 'giz',
    name: 'Giz de quadro',
    line: () => ({ font: TEXT_AMATIC, weight: '700', mul: 1.9, lh: 1.05, upper: true }),
  },
  {
    id: 'gigante',
    name: 'Gigante quebrado',
    line: () => ({ font: TEXT_ANTON, mul: 2.1, lh: 1, upper: true }),
  },
  {
    id: 'destaque-final',
    name: 'Destaque na última',
    line: (i, n) => (i === n - 1 && n > 1
      ? { font: TEXT_SANS, weight: 'bold', mul: 1.1, lh: 1.55, upper: true, bg: '#ffffff', color: '#111111' }
      : { font: TEXT_SANS, weight: 'bold', mul: 1, lh: 1.45, upper: true }),
  },
  {
    id: 'marcador',
    name: 'Marcador',
    line: () => ({ font: TEXT_MARKER, mul: 1.05, lh: 1.4 }),
  },
  {
    id: 'chuva-coracoes',
    name: 'Chuva de corações',
    decoBottom: { text: '❤️ ❤️ ❤️', style: { font: TEXT_SANS, mul: 0.55, lh: 1.6 } },
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.3, lh: 1.3 }),
  },
  {
    id: 'editorial-luxo',
    name: 'Editorial de luxo',
    line: () => ({ font: TEXT_PLAYFAIR, weight: '600', italic: true, mul: 1, lh: 1.5 }),
  },
  {
    id: 'caligrafia-ouro',
    name: 'Caligrafia dourada',
    line: () => ({ font: TEXT_VIBES, mul: 1.6, lh: 1.28, color: '#d9a75c' }),
  },
  {
    id: 'neon-rosa',
    name: 'Neon rosa',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 1.05, lh: 1.45, upper: true, color: '#ff6ec7', glow: '#ff2fa0' }),
  },
  {
    id: 'neon-azul',
    name: 'Neon azul cursiva',
    line: () => ({ font: TEXT_CURSIVE, weight: '600', mul: 1.35, lh: 1.3, color: '#7fe3ff', glow: '#20b9e8' }),
  },
  {
    id: 'taxi',
    name: 'Placa amarela',
    line: () => ({ font: TEXT_ANTON, mul: 1, lh: 1.55, upper: true, bg: '#f2c230', color: '#141414' }),
  },
  {
    id: 'etiquetas',
    name: 'Etiquetas brancas',
    line: () => ({ font: TEXT_SANS, weight: 'bold', mul: 0.95, lh: 1.65, upper: true, bg: '#ffffff', color: '#141414' }),
  },
  {
    id: 'sublinhado',
    name: 'Sublinhado',
    line: (i, n) => (i === n - 1
      ? { font: TEXT_OSWALD, weight: '500', mul: 1.25, lh: 1.32, upper: true, underline: '#d9a75c' }
      : { font: TEXT_OSWALD, weight: '500', mul: 1.25, lh: 1.32, upper: true }),
  },
  {
    id: 'minimal-espacado',
    name: 'Minimal espaçado',
    line: () => ({ font: TEXT_SANS, mul: 0.62, lh: 2, spacing: 0.5, upper: true }),
  },
  {
    id: 'classico-duplo',
    name: 'Clássico duplo',
    line: (i) => (i % 2
      ? { font: TEXT_SANS, mul: 0.7, lh: 1.55, upper: true, spacing: 0.2, color: '#cfcfcf' }
      : { font: TEXT_SERIF, italic: true, mul: 1.25, lh: 1.32 }),
  },
  {
    id: 'manuscrito',
    name: 'Manuscrito rápido',
    line: () => ({ font: TEXT_CAVEAT, weight: '600', mul: 1.5, lh: 1.18 }),
  },
  {
    id: 'cartaz-vintage',
    name: 'Cartaz vintage',
    frame: { pad: 0.7, double: true },
    line: () => ({ font: TEXT_PLAYFAIR, weight: '600', mul: 0.95, lh: 1.45, upper: true, spacing: 0.05 }),
  },
  {
    id: 'assinatura',
    name: 'Assinatura',
    line: () => ({ font: TEXT_VIBES, mul: 1.5, lh: 1.28, rotate: -5 }),
  },
  {
    id: 'pop-colorido',
    name: 'Pop colorido',
    line: (i) => ({ font: TEXT_PACIFICO, mul: 1.25, lh: 1.42, color: ['#ff6ec7', '#35b5a5', '#f2c230'][i % 3] }),
  },
  {
    id: 'grito',
    name: 'Grito',
    line: (i) => ({ font: TEXT_ANTON, mul: 1.5, lh: 1.08, upper: true, color: i % 2 ? '#ffffff' : '#e24b4a' }),
  },
];

const TEXT_PRINT_MAX_LINES = 6;
const TEXT_PRINT_SAMPLE = ['Toda vez que eu', 'olho pros meus pais,', 'vejo um milhão', 'de motivos'];

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

// Garante que as fontes do Google estejam prontas antes de desenhar no
// canvas (senão o navegador desenha com a fonte fallback).
const textFontsReady = Promise.all([
  document.fonts.load("600 100px 'Dancing Script'"),
  document.fonts.load("100px 'Bebas Neue'"),
  document.fonts.load("100px 'Anton'"),
  document.fonts.load("100px 'Pacifico'"),
  document.fonts.load("600 100px 'Caveat'"),
  document.fonts.load("100px 'Permanent Marker'"),
  document.fonts.load("700 100px 'Amatic SC'"),
  document.fonts.load("100px 'Great Vibes'"),
  document.fonts.load("100px 'Lobster'"),
  document.fonts.load("500 100px 'Oswald'"),
  document.fonts.load("italic 600 100px 'Playfair Display'"),
  document.fonts.load("100px 'Special Elite'"),
]).catch(() => {});

// Frase digitada -> linhas não vazias, no máximo 6.
function getTextPrintLines() {
  return (textPrintInput?.value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, TEXT_PRINT_MAX_LINES);
}

function textForLine(line, style) {
  let text = line;
  if (style.upper) text = text.toUpperCase();
  if (style.lower) text = text.toLowerCase();
  return text + (style.suffix || '');
}

function fontStringFor(style, size) {
  const italic = style.italic ? 'italic ' : '';
  const weight = style.weight ? `${style.weight} ` : '';
  return `${italic}${weight}${Math.round(size)}px ${style.font}`;
}

/* Motor de desenho. Tudo é medido numa fonte-base de 100px e depois
   escalado para caber na área útil do canvas — é isso que faz frase
   curta ficar grande e frase longa diminuir para caber. */
function drawTextPrint(canvas, preset, lines) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lines.length) return;

  const margin = canvas.width * 0.09;
  const availW = canvas.width - margin * 2;
  const availH = canvas.height - margin * 2;

  if (preset.type === 'bubbles') {
    drawBubblePrint(ctx, canvas, lines, availW, availH);
    return;
  }

  const BASE = 100;
  const n = lines.length;

  // Mede uma linha (texto do cliente ou enfeite) já com a folga da
  // tarja de fundo, quando houver.
  const makeSpec = (text, style) => {
    ctx.font = fontStringFor(style, BASE * style.mul);
    try { ctx.letterSpacing = `${(style.spacing || 0) * BASE * style.mul}px`; } catch (e) { /* sem suporte */ }
    let width = ctx.measureText(text).width;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* idem */ }
    if (style.bg) width += BASE * style.mul * 0.7;
    return { style, text, width, advance: BASE * style.mul * (style.lh || 1.3) };
  };

  const specs = [];
  if (preset.decoTop) specs.push(makeSpec(preset.decoTop.text, preset.decoTop.style));
  lines.forEach((line, i) => {
    const style = preset.line(i, n);
    specs.push(makeSpec(textForLine(line, style), style));
  });
  if (preset.decoBottom) specs.push(makeSpec(preset.decoBottom.text, preset.decoBottom.style));

  // Moldura reserva parte da área útil para não encostar no texto.
  const frameShrink = preset.frame ? 0.82 : 1;
  const maxWidth = Math.max(...specs.map((s) => s.width));
  const totalHeight = specs.reduce((sum, s) => sum + s.advance, 0);
  const scale = Math.min((availW * frameShrink) / maxWidth, (availH * frameShrink) / totalHeight);

  if (preset.frame) {
    const padF = BASE * scale * (preset.frame.pad || 0.6);
    const frameW = maxWidth * scale + padF * 2;
    const frameH = totalHeight * scale + padF * 2;
    const frameX = (canvas.width - frameW) / 2;
    const frameY = (canvas.height - frameH) / 2;
    ctx.strokeStyle = preset.frame.color || '#ffffff';
    ctx.lineWidth = Math.max(2, BASE * scale * 0.05);
    ctx.strokeRect(frameX, frameY, frameW, frameH);
    if (preset.frame.double) {
      const inset = ctx.lineWidth * 2.6;
      ctx.lineWidth = Math.max(1, ctx.lineWidth * 0.5);
      ctx.strokeRect(frameX + inset, frameY + inset, frameW - inset * 2, frameH - inset * 2);
    }
  }

  let y = (canvas.height - totalHeight * scale) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  specs.forEach((spec) => {
    const style = spec.style;
    const size = BASE * style.mul * scale;
    const textWidth = (spec.width - (style.bg ? BASE * style.mul * 0.7 : 0)) * scale;
    const baseline = y + size * 0.82;
    const cx = canvas.width / 2;

    ctx.save();

    // Linha inclinada (ex.: scripts com rotação leve).
    if (style.rotate) {
      const pivotY = baseline - size * 0.35;
      ctx.translate(cx, pivotY);
      ctx.rotate((style.rotate * Math.PI) / 180);
      ctx.translate(-cx, -pivotY);
    }

    ctx.font = fontStringFor(style, size);
    try { ctx.letterSpacing = `${(style.spacing || 0) * size}px`; } catch (e) { /* sem suporte */ }

    // Tarja de fundo (marca-texto / etiqueta / placa).
    if (style.bg) {
      const padH = size * 0.35;
      ctx.fillStyle = style.bg;
      ctx.fillRect(cx - textWidth / 2 - padH, baseline - size * 0.86, textWidth + padH * 2, size * 1.14);
    }

    // Brilho neon: sombra colorida + segunda passada do texto.
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = size * 0.45;
    }

    if (style.mode === 'stroke') {
      ctx.strokeStyle = style.color || '#ffffff';
      ctx.lineWidth = Math.max(1.2, size * 0.05);
      ctx.strokeText(spec.text, cx, baseline);
    } else {
      ctx.fillStyle = style.color || '#ffffff';
      ctx.fillText(spec.text, cx, baseline);
      if (style.glow) ctx.fillText(spec.text, cx, baseline);
    }

    ctx.shadowBlur = 0;

    if (style.strike) {
      ctx.strokeStyle = style.strike;
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx - textWidth / 2 - size * 0.1, baseline - size * 0.28);
      ctx.lineTo(cx + textWidth / 2 + size * 0.1, baseline - size * 0.28);
      ctx.stroke();
    }

    if (style.underline) {
      ctx.strokeStyle = style.underline;
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.beginPath();
      ctx.moveTo(cx - textWidth / 2, baseline + size * 0.14);
      ctx.lineTo(cx + textWidth / 2, baseline + size * 0.14);
      ctx.stroke();
    }

    ctx.restore();
    y += spec.advance * scale;
  });
}

/* Balões estilo WhatsApp: cada linha vira um balão com a largura do
   próprio texto, todos alinhados à esquerda. Lado direito sempre bem
   redondo; no lado esquerdo, só o topo do primeiro e a base do último
   têm curva grande — os cantos onde os balões se encostam são curtos,
   como nas mensagens agrupadas do WhatsApp (igual ao print). */
function drawBubblePrint(ctx, canvas, lines, availW, availH) {
  const BASE = 100;
  ctx.font = `${BASE}px ${TEXT_SANS}`;

  const padH = BASE * 0.62;
  const padV = BASE * 0.42;
  const gap = BASE * 0.22;
  const bubbleH = BASE + padV * 2;

  const widths = lines.map((line) => ctx.measureText(line).width + padH * 2);
  const maxBubbleW = Math.max(...widths);
  const totalH = lines.length * bubbleH + (lines.length - 1) * gap;
  const scale = Math.min(availW / maxBubbleW, availH / totalH);

  const x0 = (canvas.width - maxBubbleW * scale) / 2;
  let y = (canvas.height - totalH * scale) / 2;

  const rBig = bubbleH * scale * 0.5;
  const rSmall = bubbleH * scale * 0.14;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const w = widths[i] * scale;
    const h = bubbleH * scale;
    const first = i === 0;
    const last = i === lines.length - 1;
    // Cantos: [sup-esq, sup-dir, inf-dir, inf-esq]
    const corners = [first ? rBig : rSmall, rBig, rBig, last ? rBig : rSmall];

    ctx.fillStyle = '#2e2e30';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x0, y, w, h, corners);
    } else {
      ctx.rect(x0, y, w, h); // fallback simples para navegadores antigos
    }
    ctx.fill();

    ctx.fillStyle = '#f7f7f7';
    ctx.font = `${BASE * scale}px ${TEXT_SANS}`;
    ctx.fillText(line, x0 + padH * scale, y + h / 2 + BASE * scale * 0.06);

    y += h + gap * scale;
  });
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

const CART_STORAGE_KEY = 'ursoninhos_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Não foi possível ler o carrinho salvo:', error);
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

let cart = loadCart();

const cartToggleBtn = document.getElementById('cartToggleBtn');
const cartCloseBtn = document.getElementById('cartCloseBtn');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsEl = document.getElementById('cartItems');
const cartCountEl = document.getElementById('cartCount');
const cartTotalEl = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutNote = document.getElementById('checkoutNote');

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function addToCart({ id, name, variant, price, thumbType, thumb }) {
  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, variant: variant || null, price, thumbType, thumb, qty: 1 });
  }

  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((entry) => entry.id !== id);
  }

  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter((entry) => entry.id !== id);
  saveCart();
  renderCart();
}

function renderCart() {
  updateCartBadge();

  if (!cartItemsEl || !cartTotalEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.</p>';
    cartTotalEl.textContent = formatBRL(0);
    return;
  }

  cartItemsEl.innerHTML = cart
    .map((item) => {
      const thumbContent = item.thumbType === 'image'
        ? `<img src="${item.thumb}" alt="${item.name}">`
        : (item.thumb || '🛍️');

      return `
        <div class="cart-item" data-id="${item.id}">
          <div class="cart-item__thumb">${thumbContent}</div>
          <div class="cart-item__info">
            <h4>${item.name}</h4>
            ${item.variant ? `<p class="cart-item__variant">Estampa: ${item.variant}</p>` : ''}
            <div class="cart-item__qty">
              <button type="button" data-action="decrease" aria-label="Diminuir quantidade">−</button>
              <span>${item.qty}</span>
              <button type="button" data-action="increase" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <div class="cart-item__right">
            <span class="cart-item__price">${formatBRL(item.price * item.qty)}</span>
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

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  cartTotalEl.textContent = formatBRL(total);
}

function updateCartBadge() {
  if (!cartCountEl) return;

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
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

cartToggleBtn?.addEventListener('click', toggleCart);
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
      id: `produto::${card.dataset.name}`,
      name: card.dataset.name,
      variant: null,
      price: parseFloat(card.dataset.price),
      thumbType: 'emoji',
      thumb: card.dataset.emoji,
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

addToCartBtn?.addEventListener('click', () => {
  // Adiciona a estampa que está VESTIDA na camisa (mockup), que não é
  // necessariamente a que está em destaque na lateral (fila).
  const print = shirtPrints[shirtPrintIndex];

  addToCart({
    id: `camisa-personalizada::${print.name}`,
    name: 'Camisa Personalizada',
    variant: print.name,
    price: 49.90,
    thumbType: 'image',
    thumb: print.file,
  });

  if (!cartFeedback) return;

  cartFeedback.textContent = `Estampa "${print.name}" adicionada ao carrinho.`;
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
          ${item.qty}x ${item.name}${item.variant ? ` (${item.variant})` : ''} — ${formatBRL(item.price * item.qty)}
        </p>
      `)
      .join('');
  }

  if (reviewAddress) reviewAddress.textContent = formatAddress(user.address);
  if (reviewPayment) reviewPayment.textContent = PAYMENT_METHOD_LABELS[selectedPaymentMethod] || '—';

  if (reviewTotal) {
    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
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
  cart = [];
  saveCart();
  renderCart();

  showCartStep('confirmed');
});

continueShoppingBtn?.addEventListener('click', () => {
  if (checkoutNote) checkoutNote.textContent = '';
  showCartStep('shopping');
});
