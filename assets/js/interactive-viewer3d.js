import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL = 'assets/3d/manequim-web.glb';
const DRACO_DECODER_URL = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/';
const CHEST_HEIGHT_FRACTION = 0.52;
const SLEEVE_HEIGHT_FRACTION = 0.63;
const HEAD_HEIGHT_FRACTION = 0.9;
const OFFSET_X_M_PER_PCT = 0.006;
const OFFSET_Y_M_PER_PCT = 0.008;

const SIDE_CONFIG = {
  front: { rotY: 0, baseWidth: 0.26, depth: 0.15, offsetXDir: [1, 0, 0] },
  back: { rotY: Math.PI, baseWidth: 0.26, depth: 0.15, offsetXDir: [-1, 0, 0] },
  sleeveLeft: { rotY: Math.PI / 2, baseWidth: 0.11, depth: 0.08, offsetXDir: [0, 0, -1] },
  sleeveRight: { rotY: -Math.PI / 2, baseWidth: 0.11, depth: 0.08, offsetXDir: [0, 0, 1] },
};

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const makeSideState = () => ({
  url: null,
  blend: 'normal',
  texture: null,
  aspect: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeAnchors(mannequinMesh, model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const chestY = box.min.y + size.y * CHEST_HEIGHT_FRACTION;
  const sleeveY = box.min.y + size.y * SLEEVE_HEIGHT_FRACTION;
  const headY = box.min.y + size.y * HEAD_HEIGHT_FRACTION;

  const raycaster = new THREE.Raycaster();
  const headXs = [];
  for (let x = -0.15; x <= 0.15; x += 0.005) {
    raycaster.set(new THREE.Vector3(x, headY, box.max.z + 1), new THREE.Vector3(0, 0, -1));
    if (raycaster.intersectObject(mannequinMesh, true)[0]) headXs.push(x);
  }
  const centerX = headXs.length ? (Math.min(...headXs) + Math.max(...headXs)) / 2 : 0;

  const hitAt = (origin, dir) => {
    raycaster.set(origin, dir);
    const hit = raycaster.intersectObject(mannequinMesh, true)[0];
    return hit ? hit.point.clone() : null;
  };

  const sleeveAnchor = (fromX, dirX) => {
    const hits = [];
    for (let z = -0.16; z <= 0.16; z += 0.01) {
      raycaster.set(new THREE.Vector3(fromX, sleeveY, z), new THREE.Vector3(dirX, 0, 0));
      const hit = raycaster.intersectObject(mannequinMesh, true)[0];
      if (hit && Math.abs(hit.point.x) > 0.15) hits.push(hit.point);
    }
    if (!hits.length) return null;

    const zs = hits.map((point) => point.z);
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    let best = hits[0];
    hits.forEach((point) => {
      if (Math.abs(point.z - midZ) < Math.abs(best.z - midZ)) best = point;
    });
    const anchor = best.clone();
    anchor.z = midZ;
    return anchor;
  };

  return {
    boxSize: size,
    front: hitAt(new THREE.Vector3(centerX, chestY, box.max.z + 1), new THREE.Vector3(0, 0, -1)),
    back: hitAt(new THREE.Vector3(centerX, chestY, box.min.z - 1), new THREE.Vector3(0, 0, 1)),
    sleeveLeft: sleeveAnchor(box.max.x + 1, -1),
    sleeveRight: sleeveAnchor(box.min.x - 1, 1),
  };
}

export async function createInteractiveViewer({ container, cameraDistance = 2.3 }) {
  const state = {
    front: makeSideState(),
    back: makeSideState(),
    sleeveLeft: makeSideState(),
    sleeveRight: makeSideState(),
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const keyLight = new THREE.DirectionalLight(0xffe0b2, 1.4);
  keyLight.position.set(0.6, 1.6, 1.2);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xc98f4d, 0.25));

  const camera = new THREE.PerspectiveCamera(28, (container.clientWidth || 1) / (container.clientHeight || 1), 0.01, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.6;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_URL);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  let mannequinMesh = null;
  let model = null;
  let anchors = null;
  let decals = [];
  let rebuildQueued = false;

  const rebuildDecals = () => {
    decals.forEach((decal) => {
      decal.geometry.dispose();
      decal.material.dispose();
      scene.remove(decal);
    });
    decals = [];

    if (!anchors || !mannequinMesh) return;

    Object.keys(SIDE_CONFIG).forEach((sideKey) => {
      const sideState = state[sideKey];
      const config = SIDE_CONFIG[sideKey];
      const point = anchors[sideKey];
      if (!sideState.texture || !point) return;

      const boxSide = config.baseWidth * sideState.scale;
      let width = boxSide;
      let height = boxSide * sideState.aspect;
      if (sideState.aspect > 1) {
        height = boxSide;
        width = boxSide / sideState.aspect;
      }
      const size = new THREE.Vector3(width, height, config.depth);

      const material = new THREE.MeshStandardMaterial({
        map: sideState.texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        roughness: 0.85,
        metalness: 0,
      });

      const position = point.clone();
      const [dx, , dz] = config.offsetXDir;
      position.x += dx * sideState.offsetX * OFFSET_X_M_PER_PCT;
      position.z += dz * sideState.offsetX * OFFSET_X_M_PER_PCT;
      position.y -= sideState.offsetY * OFFSET_Y_M_PER_PCT;

      const orientation = new THREE.Euler(0, config.rotY, 0);
      const geometry = new DecalGeometry(mannequinMesh, position, orientation, size);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 2;
      scene.add(mesh);
      decals.push(mesh);
    });
  };

  const queueRebuild = () => {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => {
      rebuildQueued = false;
      rebuildDecals();
    });
  };

  const setPrint = (side, url, blend = 'normal') => {
    if (!state[side] || !url) return Promise.resolve();

    state[side].url = url;
    state[side].blend = blend;

    return new Promise((resolve, reject) => {
      textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          state[side].texture = texture;
          state[side].aspect = clamp(texture.image.height / texture.image.width, 0.2, 5);
          queueRebuild();
          resolve();
        },
        undefined,
        reject
      );
    });
  };

  const setTransform = (side, transform) => {
    if (!state[side]) return;
    state[side].scale = typeof transform.scale === 'number' ? transform.scale : state[side].scale;
    state[side].offsetX = typeof transform.offsetX === 'number' ? transform.offsetX : state[side].offsetX;
    state[side].offsetY = typeof transform.offsetY === 'number' ? transform.offsetY : state[side].offsetY;
    queueRebuild();
  };

  const setCameraAngle = (degrees) => {
    const radius = camera.position.distanceTo(controls.target);
    const rad = (degrees * Math.PI) / 180;
    camera.position.set(
      controls.target.x + radius * Math.sin(rad),
      camera.position.y,
      controls.target.z + radius * Math.cos(rad)
    );
    controls.update();
  };

  const capturePng = () => renderer.domElement.toDataURL('image/png');

  await new Promise((resolve, reject) => {
    gltfLoader.load(
      MODEL_URL,
      (gltf) => {
        model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh && !mannequinMesh) mannequinMesh = child;
        });
        if (!mannequinMesh) {
          reject(new Error('Modelo 3D sem malha principal.'));
          return;
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box.min.y;
        model.rotation.y = -Math.PI / 2;
        model.updateMatrixWorld(true);
        scene.add(model);

        anchors = computeAnchors(mannequinMesh, model);
        const size = anchors.boxSize || new THREE.Vector3(1, 1, 1);
        camera.position.set(0, size.y * 0.55, size.y * cameraDistance);
        controls.target.set(0, size.y * 0.5, 0);
        controls.minDistance = size.y * 0.9;
        controls.maxDistance = size.y * 3.2;
        controls.update();
        resolve();
      },
      undefined,
      reject
    );
  });

  const resize = () => {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  new ResizeObserver(resize).observe(container);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    setPrint,
    setTransform,
    setCameraAngle,
    capturePng,
    state,
    controls,
  };
}
