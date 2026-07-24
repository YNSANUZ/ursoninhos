import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export async function createProductStlViewer({ container, url }) {
  if (!container || !url) throw new Error('Modelo 3D não informado.');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.replaceChildren(renderer.domElement);

  const environment = new RoomEnvironment(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment).texture;
  environment.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x5b351d, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd8a563, 1.4);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  let geometry = await new STLLoader().loadAsync(url);
  geometry = mergeVertices(geometry, 0.00001);
  geometry.deleteAttribute('normal');
  geometry.computeVertexNormals();
  geometry.center();
  const material = new THREE.MeshStandardMaterial({
    color: 0xf5f2eb,
    roughness: 0.58,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const bounds = new THREE.Box3().setFromObject(mesh);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  mesh.scale.setScalar(1.65 / maxDimension);
  mesh.rotation.x = -Math.PI / 2;

  camera.position.set(0, 0.65, 2.75);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.enablePan = false;
  controls.minDistance = 1.4;
  controls.maxDistance = 5;
  controls.target.set(0, 0, 0);

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let active = true;
  function animate() {
    if (!active) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  return {
    controls,
    setCameraAngle(degrees) {
      const radius = camera.position.length();
      const angle = THREE.MathUtils.degToRad(degrees);
      camera.position.set(Math.sin(angle) * radius, 0.65, Math.cos(angle) * radius);
      camera.lookAt(controls.target);
    },
    dispose() {
      active = false;
      observer.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
