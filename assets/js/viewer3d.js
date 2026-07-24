/* =========================================================
   Ursoninhos — viewer3d.js
   Manequim 3D no hero (three.js). A estampa selecionada é
   projetada como DECAL sobre a superfície da camisa (frente
   e costas), então ela acompanha o tecido quando o cliente
   arrasta para girar. Usamos decal em vez de editar a textura
   porque o UV deste modelo é fragmentado (fotogrametria).

   Conversa com o main.js por window.shirtViewer3D:
     - setPrint(url, blend)  troca a arte projetada
     - setTransform({scale, offsetX, offsetY}) tamanho/posição
   e avisa que está pronto com o evento "shirt3d-ready".
   Se WebGL ou o carregamento falharem, nada acontece e o
   manequim 2D (foto) continua como está — fallback natural.
   ========================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Sem isto o TextureLoader baixa a MESMA estampa de novo a cada volta
// do carrossel (o giro automático reaplica a arte o tempo todo).
THREE.Cache.enabled = true;

const MODEL_URL = 'assets/3d/camisa-flutuante-web.glb?v=1';
const DRACO_DECODER_URL = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/';

// Alturas como fração da altura total do modelo (camisa flutuante:
// barra em 0, ombro/gola em 1 — não há mais cabeça nem pedestal).
const CHEST_HEIGHT_FRACTION = 0.6;   // peito/costas
const SLEEVE_HEIGHT_FRACTION = 0.8;  // meio da manga

// Cores do tecido (troca num clique). A textura de cor original do
// modelo é um cinza uniforme gerado por IA, então usamos cor sólida
// no material e mantemos só o normal map (dobras do tecido).
const SHIRT_COLORS = { black: 0x181818, white: 0xf2f2f2 };

// Rótulo da gola: etiqueta da marca estampada por padrão na parte
// INTERNA da nuca (como numa camisa de verdade). É um decal projetado
// na superfície de dentro das costas, logo abaixo da gola.
const NECK_LABEL_URL = 'assets/3d/rotulo-gola.png?v=2';
// Procura automaticamente o ponto mais alto que ainda pertence ao tecido
// interno da gola. Assim a etiqueta encosta no limite superior sem sumir
// acima da malha em modelos ou tamanhos de tela diferentes.
const NECK_LABEL_MAX_HEIGHT_FRACTION = 0.985;
const NECK_LABEL_MIN_HEIGHT_FRACTION = 0.9;
const NECK_LABEL_WIDTH = 0.085;          // ~8,5 cm de largura no tecido
// A arte do rótulo é clara (feita para tecido escuro); na camisa
// branca ela é escurecida para continuar legível.
const NECK_LABEL_TINT = { black: 0xffffff, white: 0x555555 };
// Conversão dos passos dos botões (em "%") para metros no tecido.
const OFFSET_X_M_PER_PCT = 0.009;
const OFFSET_Y_M_PER_PCT = 0.011;
// Folga de enquadramento do editor. A distância anterior (2.3) deixava
// estampas grandes ou movidas para perto da gola ultrapassarem o canvas,
// parecendo cortadas. Esta distância mantém a camisa e toda a faixa de
// personalização visíveis, sem reduzir os limites livres de movimento.
const EDITOR_CAMERA_DISTANCE = 2.9;
const EDITOR_CAMERA_MAX_DISTANCE = 4.2;

/* Configuração de cada lado editável da camisa:
   - rotY: orientação do projetor do decal (0 projeta no peito, PI nas
     costas, ±PI/2 nas mangas);
   - baseWidth: largura base da estampa em metros (mangas são estreitas);
   - depth: profundidade da projeção (menor nas mangas para o decal não
     "vazar" para o outro lado do braço);
   - offsetXDir: para onde a seta -> move a arte NO MUNDO, de modo que na
     tela (com a câmera virada para esse lado) ela ande para a direita. */
const SIDE_CONFIG = {
  front: { rotY: 0, baseWidth: 0.3, portraitHeight: 0.58, depth: 0.16, offsetXDir: [1, 0, 0] },
  back: { rotY: Math.PI, baseWidth: 0.3, portraitHeight: 0.58, depth: 0.16, offsetXDir: [-1, 0, 0] },
  sleeveLeft: { rotY: Math.PI / 2, baseWidth: 0.16, depth: 0.1, offsetXDir: [0, 0, -1] },
  sleeveRight: { rotY: -Math.PI / 2, baseWidth: 0.16, depth: 0.1, offsetXDir: [0, 0, 1] },
};
const SIDE_CAMERA_ANGLES = { front: 0, back: 180, sleeveLeft: 90, sleeveRight: -90 };

const container = document.getElementById('shirtViewer3d');
const stage = document.querySelector('.hero__stage');

// Estado independente por lado da camisa (chave FRENTE/VERSO/MANGAS):
// cada lado tem a própria arte, mesclagem, tamanho e posição.
const makeSideState = () => ({ url: null, blend: 'screen', texture: null, aspect: 1, scale: 1, offsetX: 0, offsetY: 0 });
const state = {
  front: makeSideState(),
  back: makeSideState(),
  sleeveLeft: makeSideState(),
  sleeveRight: makeSideState(),
};

let renderer = null;
let interactionSurface = null;
let scene = null;
let camera = null;
let controls = null;
let shirtColor = 'black';    // cor atual do tecido (padrão do site)
let shirtMaterial = null;    // material da camisa, trocado num clique
let neckLabelMesh = null;    // etiqueta da nuca (decal fixo, não editável)
let neckLabelTexture = null;
let mannequinMesh = null;
let anchors = null; // pontos do peito (frente/costas) achados por raycast
let decals = [];
let rebuildQueued = false;
let lastVisibleSide = null;
let modelSize = null;
let defaultCameraPosition = null;
let defaultCameraTarget = null;

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function getVisibleSideFromCamera() {
  if (!camera || !controls) return 'front';
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  const angle = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
  let bestSide = 'front';
  let bestDistance = Infinity;

  Object.entries(SIDE_CAMERA_ANGLES).forEach(([side, sideAngle]) => {
    const distance = Math.abs(normalizeDegrees(angle - sideAngle));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSide = side;
    }
  });

  return bestSide;
}

function emitVisibleSideChange(force = false) {
  const side = getVisibleSideFromCamera();
  if (!force && side === lastVisibleSide) return;
  lastVisibleSide = side;
  window.dispatchEvent(new CustomEvent('shirt3d-visible-side-change', {
    detail: { side },
  }));
}

// A etiqueta fica na parte interna da nuca. Ela deve permanecer visível
// mesmo quando a câmera chega bem perto da gola; por isso verificamos
// somente o hemisfério observado, sem uma margem mínima de distância.
function updateNeckLabelVisibility() {
  if (!neckLabelMesh || !camera || !controls) return;
  const frontDepth = camera.position.z - controls.target.z;
  neckLabelMesh.visible = frontDepth > 0;
}

// Mantém a navegação livre o suficiente para inspecionar gola e mangas,
// mas impede que um pan longo faça a camisa desaparecer completamente.
function clampCameraTarget() {
  if (!camera || !controls || !modelSize) return;
  const previousTarget = controls.target.clone();
  controls.target.x = clamp(controls.target.x, -modelSize.x * 0.68, modelSize.x * 0.68);
  controls.target.y = clamp(controls.target.y, modelSize.y * 0.08, modelSize.y * 0.96);
  controls.target.z = clamp(controls.target.z, -modelSize.z * 0.45, modelSize.z * 0.45);

  // Corrige câmera e alvo juntos: o enquadramento não dá um salto quando
  // o usuário alcança um dos limites.
  camera.position.add(controls.target.clone().sub(previousTarget));
}

function resetView() {
  if (!camera || !controls || !defaultCameraPosition || !defaultCameraTarget) return;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultCameraTarget);
  controls.update();
  emitVisibleSideChange(true);
  renderer?.render?.(scene, camera);
}

function setPrint(url, blend, side = 'front') {
  const sideState = state[side];
  if (!sideState) return;

  sideState.url = url;
  sideState.blend = blend || 'screen';

  textureLoader.load(
    url,
    (texture) => {
      if (sideState.url !== url) return; // chegou depois de outra troca
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
      sideState.texture = texture;
      // Proporção REAL da imagem (altura/largura), sem forçar formato:
      // o decal usa uma caixa "contain", então nada amassa nem estica.
      sideState.aspect = clamp(texture.image.height / texture.image.width, 0.2, 5);
      queueRebuild(side);
    },
    undefined,
    (error) => console.error('Não foi possível carregar a estampa no 3D:', error)
  );
}

function setTransform({ scale, offsetX, offsetY }, side = 'front') {
  const sideState = state[side];
  if (!sideState) return;

  if (typeof scale === 'number') sideState.scale = scale;
  if (typeof offsetX === 'number') sideState.offsetX = offsetX;
  if (typeof offsetY === 'number') sideState.offsetY = offsetY;
  queueRebuild(side);
}

// Troca a cor do tecido (camisa preta <-> branca) num clique, sem
// trocar de modelo nem baixar nada: só a cor do material muda.
function setShirtColor(color) {
  if (!SHIRT_COLORS[color] || color === shirtColor) return;
  shirtColor = color;
  if (shirtMaterial) shirtMaterial.color.setHex(SHIRT_COLORS[color]);
  if (neckLabelMesh) neckLabelMesh.material.color.setHex(NECK_LABEL_TINT[color]);
  // As artes "screen" mudam de desenho conforme a cor do tecido
  // (ver makeDecal) — reprojeta todos os lados.
  queueRebuild();
}

/* Etiqueta da nuca: projeta o rótulo na superfície INTERNA das costas.
   O raio parte do eixo central, dentro da camisa, e anda para trás até
   acertar o tecido das costas por dentro. O decal usa side: BackSide —
   a malha da camisa é uma casca sem espessura, então os triângulos das
   costas "olham" para fora; renderizar só o verso deles faz o rótulo
   aparecer APENAS para quem olha por dentro da gola, nunca no lado de
   fora da camisa. */
function buildNeckLabel() {
  if (!mannequinMesh || !neckLabelTexture) return;

  if (neckLabelMesh) {
    neckLabelMesh.geometry.dispose();
    neckLabelMesh.material.dispose();
    scene.remove(neckLabelMesh);
    neckLabelMesh = null;
  }

  const box = new THREE.Box3().setFromObject(mannequinMesh);
  const raycaster = new THREE.Raycaster();
  let hit = null;
  for (
    let fraction = NECK_LABEL_MAX_HEIGHT_FRACTION;
    fraction >= NECK_LABEL_MIN_HEIGHT_FRACTION && !hit;
    fraction -= 0.005
  ) {
    const labelY = box.min.y + (box.max.y - box.min.y) * fraction;
    raycaster.set(new THREE.Vector3(0, labelY, 0), new THREE.Vector3(0, 0, -1));
    hit = raycaster.intersectObject(mannequinMesh, true)[0] || null;
  }
  if (!hit) return;

  const material = new THREE.MeshStandardMaterial({
    map: neckLabelTexture,
    color: NECK_LABEL_TINT[shirtColor],
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: 0.85,
    metalness: 0,
    side: THREE.BackSide,
  });

  const size = new THREE.Vector3(NECK_LABEL_WIDTH, NECK_LABEL_WIDTH, 0.04);
  const geometry = new DecalGeometry(mannequinMesh, hit.point, new THREE.Euler(0, 0, 0), size);
  neckLabelMesh = new THREE.Mesh(geometry, material);
  neckLabelMesh.renderOrder = 1; // abaixo das estampas editáveis
  // Fica FORA do array decals: o arrasto de estampas não pode pegá-la.
  scene.add(neckLabelMesh);
}

// Remove a arte de um lado (ex.: verso ainda sem estampa escolhida).
function clearPrint(side) {
  const sideState = state[side];
  if (!sideState) return;
  sideState.url = null;
  sideState.texture = null;
  queueRebuild(side);
}

// Agrupa várias mudanças no mesmo frame numa única reconstrução,
// porque gerar o decal varre a malha inteira do manequim (que é
// pesada — fotogrametria). Só os lados alterados são refeitos.
const pendingSides = new Set();
function queueRebuild(side) {
  if (side) pendingSides.add(side);
  else Object.keys(SIDE_CONFIG).forEach((key) => pendingSides.add(key));
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    const sides = [...pendingSides];
    pendingSides.clear();
    rebuildDecals(sides);
  });
}

function rebuildDecals(sides = Object.keys(SIDE_CONFIG)) {
  if (!anchors || !mannequinMesh) return;

  // Remove apenas os decals dos lados que serão refeitos.
  decals = decals.filter((decal) => {
    if (!sides.includes(decal.userData.side)) return true;
    decal.geometry.dispose();
    decal.material.dispose();
    scene.remove(decal);
    return false;
  });

  const makeDecal = (sideKey) => {
    const sideState = state[sideKey];
    const config = SIDE_CONFIG[sideKey];
    const point = anchors[sideKey];
    if (!sideState || !config || !point || !sideState.texture) return;

    // Caixa "contain": a imagem cabe num quadrado do tamanho escolhido
    // mantendo a proporção original — imagem alta fica estreita, imagem
    // larga fica baixa; nunca amassa nem estica.
    // As composições novas de frente/costas são verticais, seguindo a
    // área útil da prensa. Imagens quadradas antigas mantêm a escala
    // anterior para preservar produtos já publicados.
    const baseBox = config.portraitHeight && sideState.aspect > 1.2
      ? config.portraitHeight
      : config.baseWidth;
    const boxSide = baseBox * sideState.scale;
    let width = boxSide;
    let height = boxSide * sideState.aspect;
    if (sideState.aspect > 1) {
      height = boxSide;
      width = boxSide / sideState.aspect;
    }
    // Frente e costas alcançam até o centro da espessura do tronco.
    // Assim uma arte deslocada para a borda acompanha a curva lateral
    // da camisa, sem atravessar o volume inteiro e duplicar no lado oposto.
    const projectionDepth = (
      (sideKey === 'front' || sideKey === 'back') && modelSize
    )
      ? Math.max(config.depth, modelSize.z * 1.05)
      : config.depth;
    const size = new THREE.Vector3(width, height, projectionDepth);

    // "screen" (artes em fundo preto): material SEM iluminação + blend
    // aditivo — o preto soma zero e desaparece no tecido, como o
    // mix-blend-mode do manequim 2D. Com material iluminado, o reflexo
    // do ambiente criaria um retângulo acinzentado ao redor da arte.
    // "normal" (fotos e frases): material iluminado, integrado ao tecido.
    // Na camisa BRANCA o blend aditivo apagaria a arte (somar cor sobre
    // branco não muda nada), então ela vira "normal": o fundo preto da
    // arte aparece — como numa estampa real impressa em tecido claro.
    const useScreen = sideState.blend === 'screen' && shirtColor !== 'white';
    const material = useScreen
      ? new THREE.MeshBasicMaterial({
          map: sideState.texture,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          blending: THREE.AdditiveBlending,
        })
      : new THREE.MeshStandardMaterial({
          map: sideState.texture,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          roughness: 0.85,
          metalness: 0,
        });

    const position = point.clone();
    // offsetXDir aponta para onde a seta -> move a arte no mundo, de
    // modo que na tela (câmera virada para o lado em edição) ela ande
    // sempre para a direita de quem olha.
    const [dx, , dz] = config.offsetXDir;
    position.x += dx * sideState.offsetX * OFFSET_X_M_PER_PCT;
    position.z += dz * sideState.offsetX * OFFSET_X_M_PER_PCT;
    position.y -= sideState.offsetY * OFFSET_Y_M_PER_PCT;

    const orientation = new THREE.Euler(0, config.rotY, 0);
    const geometry = new DecalGeometry(mannequinMesh, position, orientation, size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.userData.side = sideKey; // usado pelo arrasto para saber qual lado editar
    mesh.userData.builtScale = sideState.scale;
    // Offsets com que a geometria foi projetada: durante o arrasto o
    // decal desliza (posição do mesh) relativo a estes valores, e a
    // reprojeção de verdade só acontece ao soltar.
    mesh.userData.builtOffsetX = sideState.offsetX;
    mesh.userData.builtOffsetY = sideState.offsetY;
    scene.add(mesh);
    decals.push(mesh);
  };

  sides.forEach(makeDecal);
}

/* Acha os pontos de ancoragem das estampas por raycast:
   1. A camisa flutuante é simétrica e o modelo é recentralizado na
      origem após carregar, então a linha central é simplesmente x=0
      (o manequim antigo precisava medir a cabeça por causa da base).
   2. Peito e costas são ancorados exatamente nessa linha central.
   3. Cada manga é varrida de fora para dentro e ancorada no meio do
      braço (eixo Z). */
function computeAnchors(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const chestY = box.min.y + size.y * CHEST_HEIGHT_FRACTION;
  const sleeveY = box.min.y + size.y * SLEEVE_HEIGHT_FRACTION;

  const raycaster = new THREE.Raycaster();

  // 1) Linha central: centro do modelo (já recentralizado na origem)
  const centerX = 0;

  // 2) Peito e costas na linha central
  const hitAt = (origin, dir) => {
    raycaster.set(origin, dir);
    const hit = raycaster.intersectObject(mannequinMesh, true)[0];
    return hit ? hit.point.clone() : null;
  };
  const front = hitAt(new THREE.Vector3(centerX, chestY, box.max.z + 1), new THREE.Vector3(0, 0, -1));
  const back = hitAt(new THREE.Vector3(centerX, chestY, box.min.z - 1), new THREE.Vector3(0, 0, 1));

  // 3) Mangas: |x| > 0.15 garante que o raio pegou o braço, não o tronco
  const sleeveAnchor = (fromX, dirX) => {
    const hits = [];
    for (let z = -0.16; z <= 0.16; z += 0.01) {
      raycaster.set(new THREE.Vector3(fromX, sleeveY, z), new THREE.Vector3(dirX, 0, 0));
      const hit = raycaster.intersectObject(mannequinMesh, true)[0];
      if (hit && Math.abs(hit.point.x) > 0.15) hits.push(hit.point);
    }
    if (!hits.length) return null;

    const zs = hits.map((p) => p.z);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    let best = hits[0];
    hits.forEach((p) => {
      if (Math.abs(p.z - midZ) < Math.abs(best.z - midZ)) best = p;
    });
    const anchor = best.clone();
    anchor.z = midZ;
    return anchor;
  };

  anchors = {
    front,
    back,
    sleeveLeft: sleeveAnchor(box.max.x + 1, -1),  // braço esquerdo do manequim (+X)
    sleeveRight: sleeveAnchor(box.min.x - 1, 1),  // braço direito (-X)
  };

  // Depuração no console (ex.: window.shirtViewer3D._anchors)
  window.shirtViewer3D._anchors = anchors;
  window.shirtViewer3D._centerX = centerX;
  window.shirtViewer3D._boxSize = size;
}

/* --- Arrastar a arte com o mouse/dedo ---
   Segurar o clique EXATAMENTE sobre a estampa arrasta a arte pelo
   tecido (o giro do manequim pausa durante o arrasto); clicar fora
   da arte gira o manequim normalmente. O movimento é relativo ao
   ponto onde o dedo pegou a arte, então ela não "pula" no clique.
   Os limites espelham os das setas no main.js. */
const DRAG_LIMIT_X_PCT = 70;
const DRAG_LIMIT_Y_PCT = 100;
// Passos menores permitem encontrar tamanhos intermediários da arte com
// precisão, especialmente em mouses que enviam pulsos grandes de scroll.
const SCALE_WHEEL_STEP = 0.01;
const SCALE_MIN = 0.22;
const SCALE_MAX = 2.35;

function setupDecalDrag() {
  if (!interactionSurface) return;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let dragSide = null;
  let activePointerId = null;
  let startClientX = 0;
  let startClientY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let worldPerPixel = 0;
  let wheelRebuildTimer = null;
  let pinchState = null;
  const activePointers = new Map();
  const hitCanvasByImage = new WeakMap();

  const setRayFromEvent = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
  };

  // O decal inclui uma margem transparente para permitir ampliar, girar e
  // mover a arte sem cortes. O raycaster enxerga toda essa geometria; por
  // isso conferimos o alpha do pixel clicado e só capturamos a interação
  // quando há imagem realmente visível naquele ponto.
  const hitHasVisiblePixel = (hit) => {
    const texture = hit?.object?.material?.map;
    const image = texture?.image;
    const uv = hit?.uv;
    if (!image || !uv) return false;

    try {
      let hitCanvas = hitCanvasByImage.get(image);
      if (!hitCanvas) {
        hitCanvas = document.createElement('canvas');
        hitCanvas.width = image.naturalWidth || image.videoWidth || image.width;
        hitCanvas.height = image.naturalHeight || image.videoHeight || image.height;
        const context = hitCanvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, hitCanvas.width, hitCanvas.height);
        hitCanvasByImage.set(image, hitCanvas);
      }

      const x = clamp(Math.floor(uv.x * hitCanvas.width), 0, hitCanvas.width - 1);
      const y = clamp(Math.floor((1 - uv.y) * hitCanvas.height), 0, hitCanvas.height - 1);
      return hitCanvas.getContext('2d').getImageData(x, y, 1, 1).data[3] > 20;
    } catch (error) {
      // Se uma imagem externa impedir a leitura por CORS, mantém o
      // comportamento anterior em vez de bloquear completamente a edição.
      return true;
    }
  };

  const decalSideAt = (event) => {
    if (!camera || !decals.length) return null;
    setRayFromEvent(event);
    const hit = raycaster.intersectObjects(decals, false).find(hitHasVisiblePixel);
    return hit ? hit.object.userData.side : null;
  };

  const emitScale = (side) => {
    window.dispatchEvent(new CustomEvent('shirt3d-print-scale', {
      detail: { side, scale: state[side]?.scale },
    }));
  };

  const emitDrag = () => {
    window.dispatchEvent(new CustomEvent('shirt3d-print-drag', {
      detail: { side: dragSide, offsetX: state[dragSide]?.offsetX, offsetY: state[dragSide]?.offsetY },
    }));
  };

  const applyScalePreview = (side) => {
    const decal = decals.find((mesh) => mesh.userData.side === side);
    const sideState = state[side];
    if (!decal || !sideState) return;
    const builtScale = decal.userData.builtScale || 1;
    const factor = builtScale ? sideState.scale / builtScale : 1;
    decal.scale.setScalar(factor);
  };

  const scheduleScaleRebuild = (side) => {
    clearTimeout(wheelRebuildTimer);
    wheelRebuildTimer = setTimeout(() => queueRebuild(side), 120);
  };

  const applyScaleDelta = (side, delta) => {
    const sideState = state[side];
    if (!sideState) return;
    sideState.scale = clamp(+(sideState.scale + delta).toFixed(2), SCALE_MIN, SCALE_MAX);
    applyScalePreview(side);
    emitScale(side);
    scheduleScaleRebuild(side);
  };

  /* Durante o arrasto NADA de raycast nem reprojeção: o movimento do
     ponteiro na tela é convertido direto para os "%" das setas
     (worldPerPixel = metros de tecido por pixel na distância atual da
     câmera) e o decal existente apenas DESLIZA (posição do mesh) — uma
     operação instantânea. A reprojeção na malha (cara: varre o
     manequim inteiro) acontece uma única vez, ao soltar. */
  const applyDragAt = (event) => {
    const sideState = state[dragSide];
    const config = SIDE_CONFIG[dragSide];
    if (!sideState || !config) return;

    const deltaX = ((event.clientX - startClientX) * worldPerPixel) / OFFSET_X_M_PER_PCT;
    const deltaY = ((event.clientY - startClientY) * worldPerPixel) / OFFSET_Y_M_PER_PCT;

    sideState.offsetX = clamp(startOffsetX + deltaX, -DRAG_LIMIT_X_PCT, DRAG_LIMIT_X_PCT);
    sideState.offsetY = clamp(startOffsetY + deltaY, -DRAG_LIMIT_Y_PCT, DRAG_LIMIT_Y_PCT);

    const decal = decals.find((mesh) => mesh.userData.side === dragSide);
    if (decal) {
      const [dx, , dz] = config.offsetXDir;
      const slideX = (sideState.offsetX - decal.userData.builtOffsetX) * OFFSET_X_M_PER_PCT;
      const slideY = (sideState.offsetY - decal.userData.builtOffsetY) * OFFSET_Y_M_PER_PCT;
      decal.position.set(dx * slideX, -slideY, dz * slideX);
    }

    // Mantém o main.js em dia: setas, overlay 2D e preview do carrinho
    // continuam coerentes com a posição arrastada.
    emitDrag();
  };

  interactionSurface.addEventListener('pointerdown', (event) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    // Botão central/direito e Shift/Ctrl + clique pertencem à câmera,
    // mesmo quando o ponteiro está sobre a estampa.
    if (
      event.pointerType === 'mouse'
      && (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey)
    ) return;
    const side = decalSideAt(event);
    if (!side) return;

    if (event.pointerType === 'touch' && dragSide && activePointerId !== null && activePointerId !== event.pointerId) {
      pinchState = {
        side: dragSide,
        pointerIds: [activePointerId, event.pointerId],
        startDistance: Math.hypot(event.clientX - startClientX, event.clientY - startClientY) || 1,
        startScale: state[dragSide].scale,
      };
      if (controls) controls.enabled = false;
      return;
    }

    dragSide = side;
    activePointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startOffsetX = state[side].offsetX;
    startOffsetY = state[side].offsetY;
    // Metros de mundo por pixel de tela na distância atual da câmera.
    const rect = renderer.domElement.getBoundingClientRect();
    const dist = camera.position.distanceTo(controls ? controls.target : new THREE.Vector3());
    worldPerPixel = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / rect.height;
    if (controls) controls.enabled = false; // pausa o giro durante o arrasto
    interactionSurface.style.cursor = 'grabbing';
    try {
      interactionSurface.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointerId sintético em testes não suporta captura */
    }
  });

  interactionSurface.addEventListener('pointermove', (event) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    }
    if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
      const [aId, bId] = pinchState.pointerIds;
      const a = activePointers.get(aId);
      const b = activePointers.get(bId);
      if (a && b) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y) || pinchState.startDistance;
        state[pinchState.side].scale = clamp(
          +(pinchState.startScale * (distance / pinchState.startDistance)).toFixed(2),
          SCALE_MIN,
          SCALE_MAX
        );
        applyScalePreview(pinchState.side);
        emitScale(pinchState.side);
      }
      return;
    }
    if (dragSide) {
      if (event.pointerId === activePointerId) applyDragAt(event);
      return;
    }
    // Fora do arrasto, o cursor indica quando o ponteiro está sobre a arte.
    interactionSurface.style.cursor = decalSideAt(event) ? 'move' : '';
  });

  const endDrag = (event) => {
    activePointers.delete(event.pointerId);
    if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
      const releasedSide = pinchState.side;
      pinchState = null;
      dragSide = null;
      activePointerId = null;
      if (controls) controls.enabled = true;
      interactionSurface.style.cursor = '';
      queueRebuild(releasedSide);
      return;
    }
    if (!dragSide || event.pointerId !== activePointerId) return;
    const releasedSide = dragSide;
    dragSide = null;
    activePointerId = null;
    if (controls) controls.enabled = true;
    interactionSurface.style.cursor = '';
    // Agora sim: reprojeta o decal na posição final, assentado no tecido.
    queueRebuild(releasedSide);
  };
  interactionSurface.addEventListener('pointerup', endDrag);
  interactionSurface.addEventListener('pointercancel', endDrag);

  interactionSurface.addEventListener('wheel', (event) => {
    const side = decalSideAt(event);
    if (!side) return;
    event.preventDefault();
    applyScaleDelta(side, event.deltaY < 0 ? SCALE_WHEEL_STEP : -SCALE_WHEEL_STEP);
  }, { passive: false });
}

function init() {
  if (!container || !stage) return;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Uma camada transparente ultrapassa discretamente o retângulo visível
  // do canvas. Ela recebe giro, zoom e toque sem alterar a câmera, o tamanho
  // do manequim ou o cenário renderizado.
  interactionSurface = document.createElement('div');
  interactionSurface.className = 'hero__stage-interaction';
  interactionSurface.setAttribute('aria-hidden', 'true');
  container.appendChild(interactionSurface);

  // Registrado ANTES do OrbitControls: no clique sobre a arte, este
  // handler roda primeiro e desliga o giro antes de o controle reagir.
  setupDecalDrag();

  scene = new THREE.Scene();

  // Ambiente de estúdio para o brilho do manequim e o dourado da base.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const keyLight = new THREE.DirectionalLight(0xffe0b2, 1.32);
  keyLight.position.set(0.6, 1.6, 1.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffe6c7, 0.68);
  fillLight.position.set(-0.55, 1.2, 1.05);
  scene.add(fillLight);
  const backLight = new THREE.DirectionalLight(0xffe1bf, 1.26);
  backLight.position.set(0.08, 1.4, -1.02);
  scene.add(backLight);
  scene.add(new THREE.AmbientLight(0xcf9551, 0.42));

  camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.01, 20);

  controls = new OrbitControls(camera, interactionSurface);
  controls.enableZoom = true; // roda do mouse / pinça aproxima e afasta
  // Zoom deliberadamente fino: cada pulso do scroll percorre uma fração
  // pequena da distância, oferecendo muitos níveis intermediários.
  // Alguns mouses enviam vários eventos para um único movimento da roda.
  // Uma velocidade bem baixa evita que esses pulsos acumulados lancem a
  // câmera de muito perto para muito longe.
  controls.zoomSpeed = 0.04;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  // Scroll pressionado ou botão direito deslocam a visão. Shift + botão
  // esquerdo também é convertido em pan pelo próprio OrbitControls.
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // Arco vertical amplo para admirar a peça: quase vista superior total
  // e quase vista inferior total, sem ultrapassar os polos e inverter os
  // comandos da câmera.
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_URL);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // Avisa a página do andamento do download do modelo (a barra de
  // progresso do palco escuta estes eventos). total pode vir 0 em
  // servidores sem Content-Length — aí a barra fica indeterminada.
  const reportProgress = (percent) => {
    window.dispatchEvent(new CustomEvent('shirt3d-progress', { detail: { percent } }));
  };

  gltfLoader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;

      model.traverse((child) => {
        if (child.isMesh && !mannequinMesh) mannequinMesh = child;
      });
      if (!mannequinMesh) return;

      // Material próprio no lugar do que veio no arquivo: a textura de
      // cor original é um cinza uniforme (gerado por IA) com um brilho
      // especular exagerado. Cor sólida (preta/branca, trocável num
      // clique) + normal map original (dobras do tecido) ficam fiéis
      // e deixam o setShirtColor instantâneo.
      const originalMaterial = mannequinMesh.material;
      shirtMaterial = new THREE.MeshStandardMaterial({
        color: SHIRT_COLORS[shirtColor],
        normalMap: originalMaterial?.normalMap || null,
        roughness: 0.88,
        metalness: 0,
      });
      mannequinMesh.material = shirtMaterial;
      // Libera da memória as texturas que não usamos (cor e rugosidade).
      if (originalMaterial) {
        originalMaterial.map?.dispose();
        originalMaterial.roughnessMap?.dispose();
        originalMaterial.metalnessMap?.dispose();
      }

      // Centraliza o modelo no chão da cena (x/z no zero, base em y=0).
      // O peito desta camisa já aponta para +Z (a câmera) — sem giro.
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      model.updateMatrixWorld(true);

      scene.add(model);

      const sized = new THREE.Box3().setFromObject(model);
      const size = sized.getSize(new THREE.Vector3());
      modelSize = size.clone();

      // Enquadra a camisa inteira, mirando no centro dela (sem cabeça
      // nem pedestal, o meio do modelo é o meio da própria camisa).
      camera.position.set(0, size.y * 0.52, size.y * EDITOR_CAMERA_DISTANCE);
      controls.target.set(0, size.y * 0.5, 0);
      // Permite chegar perto da gola. O near plane da câmera continua em
      // 0,01, portanto o tecido não é recortado prematuramente.
      controls.minDistance = size.y * 0.24;
      controls.maxDistance = size.y * EDITOR_CAMERA_MAX_DISTANCE;
      controls.update();
      defaultCameraPosition = camera.position.clone();
      defaultCameraTarget = controls.target.clone();
      emitVisibleSideChange(true);

      computeAnchors(model);

      // Etiqueta da marca na nuca (interior da gola), sempre presente.
      textureLoader.load(NECK_LABEL_URL, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        neckLabelTexture = texture;
        buildNeckLabel();
      });

      stage.classList.add('is-3d');
      window.shirtViewer3D.ready = true;
      window.dispatchEvent(new Event('shirt3d-ready'));
    },
    (xhr) => {
      if (xhr.total > 0) reportProgress(Math.round((xhr.loaded / xhr.total) * 100));
    },
    (error) => {
      console.warn('Manequim 3D indisponível, mantendo o manequim 2D:', error);
      window.dispatchEvent(new Event('shirt3d-error'));
    }
  );

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  new ResizeObserver(resize).observe(container);

  renderer.setAnimationLoop(() => {
    controls.update();
    clampCameraTarget();
    updateNeckLabelVisibility();
    emitVisibleSideChange();
    renderer.render(scene, camera);
  });
}

// Gira a câmera ao redor do manequim (0 = frente, 180 = costas).
function setCameraAngle(degrees) {
  if (!camera || !controls) return;
  const radius = camera.position.distanceTo(controls.target);
  const rad = (degrees * Math.PI) / 180;
  camera.position.set(
    controls.target.x + radius * Math.sin(rad),
    camera.position.y,
    controls.target.z + radius * Math.cos(rad)
  );
  controls.update();
  renderer?.render?.(scene, camera);
  emitVisibleSideChange(true);
}

function applyPreviewCamera(side = 'front') {
  if (!camera || !controls || !modelSize) return;
  const previewConfig = {
    front: { targetX: 0, targetY: 0.5, cameraY: 0.52, radius: 2.75 },
    back: { targetX: 0, targetY: 0.5, cameraY: 0.52, radius: 2.75 },
    sleeveLeft: { targetX: 0, targetY: 0.5, cameraY: 0.52, radius: 2.8 },
    sleeveRight: { targetX: 0, targetY: 0.5, cameraY: 0.52, radius: 2.8 },
  }[side] || { targetX: 0, targetY: 0.5, cameraY: 0.52, radius: 2.75 };

  const targetX = modelSize.x * previewConfig.targetX;
  const targetY = modelSize.y * previewConfig.targetY;
  const cameraY = modelSize.y * previewConfig.cameraY;
  const radius = modelSize.y * previewConfig.radius;
  const angle = SIDE_CAMERA_ANGLES[side] ?? 0;
  const rad = (angle * Math.PI) / 180;

  controls.target.set(targetX, targetY, 0);
  camera.position.set(
    targetX + Math.sin(rad) * radius,
    cameraY,
    Math.cos(rad) * radius
  );
  camera.lookAt(targetX, targetY, 0);
  controls.update();
}

function capturePng() {
  if (!renderer?.domElement) return '';
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

function capturePreview(side = 'front') {
  if (!renderer || !camera || !controls) return capturePng();

  const previousPosition = camera.position.clone();
  const previousTarget = controls.target.clone();
  const previousAspect = camera.aspect;
  const previousSize = renderer.getSize(new THREE.Vector2());

  try {
    renderer.setSize(1024, 1024, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    applyPreviewCamera(side);
    updateNeckLabelVisibility();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    renderer.setSize(previousSize.x, previousSize.y, false);
    camera.aspect = previousAspect;
    camera.position.copy(previousPosition);
    controls.target.copy(previousTarget);
    camera.updateProjectionMatrix();
    controls.update();
    renderer.render(scene, camera);
  }
}

window.shirtViewer3D = {
  ready: false,
  setPrint,
  setTransform,
  clearPrint,
  setCameraAngle,
  setShirtColor,
  resetView,
  capturePng,
  capturePreview,
};

try {
  init();
} catch (error) {
  console.warn('WebGL indisponível, mantendo o manequim 2D:', error);
  window.dispatchEvent(new Event('shirt3d-error'));
}
