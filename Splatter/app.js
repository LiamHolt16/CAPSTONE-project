const viewerContainer = document.getElementById('splat-viewer');
const sceneLabel = document.getElementById('viewer-scene-label');
const loadingLabel = document.getElementById('viewer-loading');
const emptyStateLabel = document.getElementById('viewer-empty-state');
const btnResetCam = document.getElementById('btn-reset-cam');
const btnToggleOrbit = document.getElementById('btn-toggle-orbit');
const btnEnterVR = document.getElementById('btn-enter-vr');
const btnFullscreen = document.getElementById('btn-fullscreen');
const loadSceneButtons = document.querySelectorAll('.btn-load-scene');

let viewer;
let orbitEnabled = false;
let orbitCenter;
let xrSession = null;
let vrActive = false;

const CESIUM_SAMPLE_BASE = './SampleData';

const defaultCamera = {
  destination: Cesium.Cartesian3.fromDegrees(-98.5795, 39.8283, 19000000),
  orientation: {
    heading: 0,
    pitch: -Cesium.Math.PI_OVER_TWO,
    roll: 0,
  },
};

function setLoading(isLoading) {
  loadingLabel.classList.toggle('hidden', !isLoading);
}

function setSceneLabel(text) {
  sceneLabel.textContent = text;
}

function clearDataSourcesAndEntities() {
  viewer.trackedEntity = undefined;
  viewer.entities.removeAll();
  viewer.dataSources.removeAll();
}

function setupViewer() {
  viewer = new Cesium.Viewer('splat-viewer', {
    animation: false,
    timeline: false,
    geocoder: false,
    sceneModePicker: true,
    baseLayerPicker: false,
    navigationHelpButton: true,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    imageryProvider: new Cesium.TileMapServiceImageryProvider({
      // Built into Cesium assets; works without external map API keys.
      url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
    }),
  });

  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    }),
  );

  viewer.scene.globe.enableLighting = true;
  viewer.scene.skyAtmosphere.show = true;

  if (emptyStateLabel) emptyStateLabel.style.display = 'none';
}

function loadSampleSceneOne() {
  clearDataSourcesAndEntities();

  const aircraftPosition = Cesium.Cartesian3.fromDegrees(
    -123.0744619,
    44.0503706,
    5000,
  );
  orbitCenter = aircraftPosition;

  const aircraft = viewer.entities.add({
    name: 'Cesium Air (Official Sample)',
    position: aircraftPosition,
    model: {
      uri: `${CESIUM_SAMPLE_BASE}/models/CesiumAir/Cesium_Air.glb`,
      minimumPixelSize: 128,
      maximumScale: 20000,
    },
  });

  // Visible fallback marker so there is always something to select/click.
  viewer.entities.add({
    name: 'Scene 1 Anchor',
    position: aircraftPosition,
    point: {
      pixelSize: 12,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
    },
    label: {
      text: 'Cesium Air',
      fillColor: Cesium.Color.WHITE,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -16),
    },
  });

  viewer.trackedEntity = aircraft;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-123.0744619, 44.0503706, 25000),
    duration: 1.2,
  });

  setSceneLabel('Scene 1: Cesium Air model (official Cesium sample)');
}

async function loadSampleSceneTwo() {
  loadSampleSceneOne();
  setSceneLabel('Scene 2 currently uses the same preview model as Scene 1.');
}

async function loadSampleSceneThree() {
  loadSampleSceneOne();
  setSceneLabel('Scene 3 currently uses the same preview model as Scene 1.');
}

async function loadScene(sceneId) {
  setLoading(true);
  viewer.clock.shouldAnimate = false;

  try {
    if (sceneId === 'scene-1') {
      loadSampleSceneOne();
    } else if (sceneId === 'scene-2') {
      await loadSampleSceneTwo();
    } else if (sceneId === 'scene-3') {
      await loadSampleSceneThree();
    } else {
      setSceneLabel('Unknown scene id');
    }
  } catch (error) {
    console.error(error);
    setSceneLabel('Could not load sample scene. Check console.');
  } finally {
    setLoading(false);
  }
}

function resetCamera() {
  viewer.camera.flyTo({
    destination: defaultCamera.destination,
    orientation: defaultCamera.orientation,
    duration: 1.2,
  });
}

function toggleOrbit() {
  orbitEnabled = !orbitEnabled;
  btnToggleOrbit.textContent = orbitEnabled ? 'Stop Orbit' : 'Auto-Orbit';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewerContainer.requestFullscreen().catch(console.error);
  } else {
    document.exitFullscreen();
  }
}

function setupOrbitHandler() {
  viewer.clock.onTick.addEventListener(() => {
    if (!orbitEnabled) return;

    const center =
      orbitCenter || Cesium.Cartesian3.fromDegrees(-98.5795, 39.8283, 0);
    viewer.camera.rotateAround(
      center,
      new Cesium.Cartesian3(0, 0, 1),
      Cesium.Math.toRadians(0.15),
    );
  });
}

async function setupVRButton() {
  if (!navigator.xr) {
    btnEnterVR.disabled = true;
    btnEnterVR.title =
      'WebXR not supported in this browser. Try Chrome or Edge with a headset connected.';
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (supported) {
      btnEnterVR.disabled = false;
      btnEnterVR.title = 'Enter immersive VR mode';
    } else {
      btnEnterVR.disabled = true;
      btnEnterVR.title =
        'No VR headset detected. Connect a headset and reload.';
    }
  } catch (e) {
    btnEnterVR.disabled = true;
    btnEnterVR.title = 'Could not query VR hardware support.';
  }

  btnEnterVR.addEventListener('click', toggleVR);
}

function toggleVR() {
  if (vrActive) {
    exitVR();
  } else {
    enterVR();
  }
}

async function enterVR() {
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['bounded-floor', 'hand-tracking'],
    });

    viewer.scene.useWebVR = true;
    vrActive = true;
    btnEnterVR.textContent = '🥽 Exit VR';
    btnEnterVR.title = 'Exit VR mode';

    xrSession.addEventListener('end', () => {
      viewer.scene.useWebVR = false;
      xrSession = null;
      vrActive = false;
      btnEnterVR.textContent = '🥽 Enter VR';
      btnEnterVR.title = 'Enter immersive VR mode';
    });
  } catch (e) {
    console.error('VR session request failed:', e);
    // Fallback: toggle Cesium stereo preview without a real XR session.
    viewer.scene.useWebVR = !viewer.scene.useWebVR;
    vrActive = viewer.scene.useWebVR;
    xrSession = null;
    btnEnterVR.textContent = vrActive ? '🥽 Exit VR Preview' : '🥽 Enter VR';
    btnEnterVR.title = vrActive
      ? 'Stereo preview active (no headset — click to exit)'
      : 'Enter immersive VR mode';
  }
}

function exitVR() {
  if (xrSession) {
    xrSession.end(); // fires the 'end' event which resets all state
  } else {
    viewer.scene.useWebVR = false;
    vrActive = false;
    btnEnterVR.textContent = '🥽 Enter VR';
    btnEnterVR.title = 'Enter immersive VR mode';
  }
}

function wireUI() {
  btnResetCam.addEventListener('click', resetCamera);
  btnToggleOrbit.addEventListener('click', toggleOrbit);
  btnFullscreen.addEventListener('click', toggleFullscreen);

  loadSceneButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sceneId = button.dataset.scene;
      document.getElementById('viewer').scrollIntoView({ behavior: 'smooth' });
      loadScene(sceneId);
    });
  });
}

function init() {
  if (!window.Cesium || !window.Cesium.Viewer) {
    setSceneLabel('Cesium failed to load.');
    return;
  }

  try {
    setupViewer();
    setupOrbitHandler();
    setupVRButton();
    wireUI();

    loadScene('scene-1');
  } catch (error) {
    console.error(error);
    setSceneLabel('Cesium loaded, but viewer init failed. Check console.');
  }
}

init();
