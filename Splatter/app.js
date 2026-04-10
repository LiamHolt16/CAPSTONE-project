import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const viewerContainer = document.getElementById('splat-viewer');
const sceneLabel = document.getElementById('viewer-scene-label');
const loadingLabel = document.getElementById('viewer-loading');
const emptyStateLabel = document.getElementById('viewer-empty-state');
const btnResetCam = document.getElementById('btn-reset-cam');
const btnToggleOrbit = document.getElementById('btn-toggle-orbit');
const btnEnterVR = document.getElementById('btn-enter-vr');
const btnFullscreen = document.getElementById('btn-fullscreen');
const loadSceneButtons = document.querySelectorAll('.btn-load-scene');

// ── Three.js state ────────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let mixer = null; // AnimationMixer for the current scene's model.
let orbitEnabled = false;
let orbitRadius = 0;
let orbitCameraY = 0;
let orbitStartTime = 0;
let activeSceneConfig = null;

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 1.6, 5);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(isLoading) {
  loadingLabel.classList.toggle('hidden', !isLoading);
}

function setSceneLabel(text) {
  sceneLabel.textContent = text;
}

// ── Renderer ──────────────────────────────────────────────────────────────────
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);

  // Required for WebXR.
  renderer.xr.enabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  if (emptyStateLabel) emptyStateLabel.style.display = 'none';
  viewerContainer.appendChild(renderer.domElement);
}

// ── Scene / Camera / Lights ───────────────────────────────────────────────────
function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e293b); // slate-800
  scene.fog = new THREE.Fog(0x1e293b, 20, 60);

  camera = new THREE.PerspectiveCamera(
    75,
    viewerContainer.clientWidth / viewerContainer.clientHeight,
    0.1,
    1000,
  );
  camera.position.copy(DEFAULT_CAMERA_POS);

  // Ambient fill
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Key light
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  // Soft fill from below
  const fillLight = new THREE.HemisphereLight(0x6366f1, 0x1e293b, 0.4);
  scene.add(fillLight);

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.update();
}

// ── VR Button ─────────────────────────────────────────────────────────────────
function setupVRButton() {
  // VRButton from Three.js handles the full WebXR session lifecycle.
  // It auto-detects headset support and shows "Enter VR" / "Exit VR".
  const vrButton = VRButton.createButton(renderer);

  // Keep Three.js's VRButton out of the DOM. We only use it as a click
  // target so the built-in "VR NOT SUPPORTED" UI never appears.
  vrButton.style.display = 'none';

  // Enable/disable our button based on headset availability.
  if (navigator.xr) {
    navigator.xr
      .isSessionSupported('immersive-vr')
      .then((supported) => {
        btnEnterVR.disabled = !supported;
        btnEnterVR.title = supported
          ? 'Enter immersive VR mode'
          : 'No VR headset detected. Connect a headset and reload.';
        if (supported) {
          btnEnterVR.textContent = '🥽 Enter VR';
        } else {
          btnEnterVR.textContent = '🥽 VR Not Detected';
        }
      })
      .catch(() => {
        btnEnterVR.disabled = true;
        btnEnterVR.title = 'Could not query VR hardware support.';
        btnEnterVR.textContent = '🥽 VR Not Detected';
      });
  } else {
    btnEnterVR.disabled = true;
    btnEnterVR.title =
      'WebXR not supported in this browser. Try Chrome or Edge with a headset connected.';
    btnEnterVR.textContent = '🥽 VR Not Detected';
  }

  // Proxy clicks to Three.js's hidden VRButton.
  btnEnterVR.addEventListener('click', () => vrButton.click());

  renderer.xr.addEventListener('sessionstart', () => {
    if (!activeSceneConfig) return;

    // Keep VR entry stable and prevent orbit from overriding camera.
    orbitEnabled = false;
    btnToggleOrbit.textContent = 'Auto-Orbit';
    controls.enabled = true;

    applyVRSpawnOffset(activeSceneConfig);
  });
}

// ── Scene loading ─────────────────────────────────────────────────────────────
function clearScene() {
  const toRemove = [];
  scene.traverse((obj) => {
    if (obj.isMesh || obj.isGroup) toRemove.push(obj);
  });
  toRemove.forEach((obj) => {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m.dispose());
    } else {
      obj.material?.dispose();
    }
    scene.remove(obj);
  });
}

const loader = new GLTFLoader();

// Set up DRACO decompression for compressed models (like Littlest Tokyo).
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.4.3/',
);
loader.setDRACOLoader(dracoLoader);

// Official Three.js example model (Littlest Tokyo - animated city scene)
const LITTLEST_TOKYO_SCENE = {
  url: 'https://threejs.org/examples/models/gltf/LittlestTokyo.glb',
  label: 'Littlest Tokyo (Three.js official animated city)',
  scale: 0.01,
  cameraPos: new THREE.Vector3(3.2, 2, 5),
  cameraLookAt: new THREE.Vector3(0, -0.5, 0),
  // Tune these with your headset on: this controls VR spawn on entry.
  vrSpawnPos: new THREE.Vector3(1, -3.05, 0),
  vrLookAt: new THREE.Vector3(2, -1.7, 0),
};

function applyCameraFromConfig(config) {
  const position = config.cameraPos;
  const lookAt = config.cameraLookAt;

  camera.position.copy(position);
  if (lookAt) {
    controls.target.copy(lookAt);
    camera.lookAt(lookAt);
  } else {
    controls.target.set(0, 0, 0);
  }
  controls.update();
}

function applyVRSpawnOffset(config) {
  if (!config?.vrSpawnPos) return;

  const baseRefSpace = renderer.xr.getReferenceSpace();
  if (!baseRefSpace) return;

  const spawn = config.vrSpawnPos;
  const offsetTransform = new XRRigidTransform({
    x: -spawn.x,
    y: -spawn.y,
    z: -spawn.z,
  });

  const offsetRefSpace = baseRefSpace.getOffsetReferenceSpace(offsetTransform);
  renderer.xr.setReferenceSpace(offsetRefSpace);
}

function loadScene() {
  const config = LITTLEST_TOKYO_SCENE;
  setLoading(true);

  // Stop any running animation from the previous scene.
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
  }

  clearScene();

  loader.load(
    config.url,
    (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(config.scale);

      // Centre the model on the grid.
      const box = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre);
      model.position.y = 0;

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      scene.add(model);

      // Play all animations if the model has any.
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }

      // Reposition camera for this scene.
      activeSceneConfig = config;
      applyCameraFromConfig(config);

      setSceneLabel(config.label);
      setLoading(false);
    },
    undefined,
    (error) => {
      console.error('GLTF load error:', error);
      setSceneLabel('Failed to load model. Check console.');
      setLoading(false);
    },
  );
}

// ── Camera controls ───────────────────────────────────────────────────────────
function resetCamera() {
  if (activeSceneConfig) {
    applyCameraFromConfig(activeSceneConfig);
  } else {
    camera.position.copy(DEFAULT_CAMERA_POS);
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.update();
  }
}

function toggleOrbit() {
  orbitEnabled = !orbitEnabled;
  btnToggleOrbit.textContent = orbitEnabled ? 'Stop Orbit' : 'Auto-Orbit';
  controls.enabled = !orbitEnabled;

  if (orbitEnabled) {
    // Snapshot the current state so the loop uses stable, fixed values.
    orbitRadius = camera.position.distanceTo(controls.target);
    orbitCameraY = camera.position.y;
    orbitStartTime = performance.now() * 0.001;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewerContainer.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen();
  }
}

// ── Resize handler ────────────────────────────────────────────────────────────
function onWindowResize() {
  if (!renderer) return;
  camera.aspect = viewerContainer.clientWidth / viewerContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
}

// ── Render loop ───────────────────────────────────────────────────────────────
let clock = new THREE.Clock();

function animate() {
  // setAnimationLoop works for both normal and WebXR (VR) frames automatically.
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta); // advance model animations

    if (orbitEnabled) {
      const elapsed = performance.now() * 0.001 - orbitStartTime;
      camera.position.x =
        controls.target.x + Math.sin(elapsed * 0.3) * orbitRadius;
      camera.position.z =
        controls.target.z + Math.cos(elapsed * 0.3) * orbitRadius;
      camera.position.y = orbitCameraY;
      camera.lookAt(controls.target);
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
  });
}

// ── UI wiring ─────────────────────────────────────────────────────────────────
function wireUI() {
  btnResetCam.addEventListener('click', resetCamera);
  btnToggleOrbit.addEventListener('click', toggleOrbit);
  btnFullscreen.addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', onWindowResize);

  loadSceneButtons.forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('viewer').scrollIntoView({ behavior: 'smooth' });
      loadScene();
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
function init() {
  setupRenderer();
  setupScene();
  setupVRButton();
  wireUI();
  animate();
  loadScene();
}

init();
