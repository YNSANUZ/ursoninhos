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

const MODEL_URL = 'assets/3d/manequim-web.glb?v=2';
const DRACO_DECODER_URL = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/';

// Alturas como fração da altura total do modelo (busto com base).
const CHEST_HEIGHT_FRACTION = 0.52;  // peito/costas
const SLEEVE_HEIGHT_FRACTION = 0.63; // meio da manga
const HEAD_HEIGHT_FRACTION = 0.9;    // cabeça (referência da linha central)
// Conversão dos passos dos botões (em "%") para metros no tecido.
const OFFSET_X_M_PER_PCT = 0.009;
const OFFSET_Y_M_PER_PCT = 0.011;

/* Configuração de cada lado editável da camisa:
   - rotY: orientação do projetor do decal (0 projeta no peito, PI nas
     costas, ±PI/2 nas mangas);
   - baseWidth: largura base da estampa em metros (mangas são estreitas);
   - depth: profundidade da projeção (menor nas mangas para o decal não
     "vazar" para o outro lado do braço);
   - offsetXDir: para onde a seta -> move a arte NO MUNDO, de modo que na
     tela (com a câmera virada para esse lado) ela ande para a direita. */
const SIDE_CONFIG = {
  front: { rotY: 0, baseWidth: 0.3, depth: 0.16, offsetXDir: [1, 0, 0] },
  back: { rotY: Math.PI, baseWidth: 0.3, depth: 0.16, offsetXDir: [-1, 0, 0] },
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
let scene = null;
let camera = null;
let controls = null;
let mannequinMesh = null;
let anchors = null; // pontos do peito (frente/costas) achados por raycast
let decals = [];
let rebuildQueued = false;
let lastVisibleSide = null;

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
    const boxSide = config.baseWidth * sideState.scale;
    let width = boxSide;
    let height = boxSide * sideState.aspect;
    if (sideState.aspect > 1) {
      height = boxSide;
      width = boxSide / sideState.aspect;
    }
    const size = new THREE.Vector3(width, height, config.depth);

    // "screen" (artes em fundo preto): material SEM iluminação + blend
    // aditivo — o preto soma zero e desaparece no tecido, como o
    // mix-blend-mode do manequim 2D. Com material iluminado, o reflexo
    // do ambiente criaria um retângulo acinzentado ao redor da arte.
    // "normal" (fotos e frases): material iluminado, integrado ao tecido.
    const material = sideState.blend === 'screen'
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
   1. A linha central REAL do manequim é medida varrendo a CABEÇA (a
      forma mais simétrica e limpa do modelo) — braços e base puxam a
      caixa envolvente para o lado e enganavam a centralização antiga.
   2. Peito e costas são ancorados exatamente nessa linha central.
   3. Cada manga é varrida de fora para dentro e ancorada no meio do
      braço (eixo Z). */
function computeAnchors(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const chestY = box.min.y + size.y * CHEST_HEIGHT_FRACTION;
  const sleeveY = box.min.y + size.y * SLEEVE_HEIGHT_FRACTION;
  const headY = box.min.y + size.y * HEAD_HEIGHT_FRACTION;

  const raycaster = new THREE.Raycaster();

  // 1) Linha central pela cabeça
  const headXs = [];
  for (let x = -0.15; x <= 0.15; x += 0.005) {
    raycaster.set(new THREE.Vector3(x, headY, box.max.z + 1), new THREE.Vector3(0, 0, -1));
    if (raycaster.intersectObject(mannequinMesh, true)[0]) headXs.push(x);
  }
  const centerX = headXs.length ? (Math.min(...headXs) + Math.max(...headXs)) / 2 : 0;

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
const DRAG_LIMIT_X_PCT = 22;
const DRAG_LIMIT_Y_PCT = 24;
const SCALE_WHEEL_STEP = 0.08;
const SCALE_MIN = 0.22;
const SCALE_MAX = 2.35;

function setupDecalDrag() {
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

  const setRayFromEvent = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
  };

  const decalSideAt = (event) => {
    if (!camera || !decals.length) return null;
    setRayFromEvent(event);
    const hit = raycaster.intersectObjects(decals, false)[0];
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

  renderer.domElement.addEventListener('pointerdown', (event) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
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
    renderer.domElement.style.cursor = 'grabbing';
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointerId sintético em testes não suporta captura */
    }
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
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
    renderer.domElement.style.cursor = decalSideAt(event) ? 'move' : '';
  });

  const endDrag = (event) => {
    activePointers.delete(event.pointerId);
    if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
      const releasedSide = pinchState.side;
      pinchState = null;
      dragSide = null;
      activePointerId = null;
      if (controls) controls.enabled = true;
      renderer.domElement.style.cursor = '';
      queueRebuild(releasedSide);
      return;
    }
    if (!dragSide || event.pointerId !== activePointerId) return;
    const releasedSide = dragSide;
    dragSide = null;
    activePointerId = null;
    if (controls) controls.enabled = true;
    renderer.domElement.style.cursor = '';
    // Agora sim: reprojeta o decal na posição final, assentado no tecido.
    queueRebuild(releasedSide);
  };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  renderer.domElement.addEventListener('wheel', (event) => {
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

  // Registrado ANTES do OrbitControls: no clique sobre a arte, este
  // handler roda primeiro e desliga o giro antes de o controle reagir.
  setupDecalDrag();

  scene = new THREE.Scene();

  // Ambiente de estúdio para o brilho do manequim e o dourado da base.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const keyLight = new THREE.DirectionalLight(0xffe0b2, 1.4);
  keyLight.position.set(0.6, 1.6, 1.2);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xc98f4d, 0.25));

  camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.01, 20);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true; // roda do mouse / pinça aproxima e afasta
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.6;

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

      // Centraliza o modelo no chão da cena (x/z no zero, base em y=0).
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      // A frente deste modelo aponta para +X (verificado por raycast e
      // câmera); -90° em Y faz o peito encarar a câmera (+Z).
      model.rotation.y = -Math.PI / 2;
      model.updateMatrixWorld(true);

      scene.add(model);

      const sized = new THREE.Box3().setFromObject(model);
      const size = sized.getSize(new THREE.Vector3());

      // Enquadra o manequim INTEIRO (da base ao topo da cabeça) e
      // define os limites do zoom: aproximar até o peito, afastar até
      // ver a estátua com folga.
      camera.position.set(0, size.y * 0.55, size.y * 2.3);
      controls.target.set(0, size.y * 0.5, 0);
      controls.minDistance = size.y * 0.9;
      controls.maxDistance = size.y * 3.2;
      controls.update();
      emitVisibleSideChange(true);

      computeAnchors(model);

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

function capturePng() {
  if (!renderer?.domElement) return '';
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

window.shirtViewer3D = { ready: false, setPrint, setTransform, clearPrint, setCameraAngle, capturePng };

try {
  init();
} catch (error) {
  console.warn('WebGL indisponível, mantendo o manequim 2D:', error);
  window.dispatchEvent(new Event('shirt3d-error'));
}
