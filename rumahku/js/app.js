/* Rumahku — engine game desain ruangan 3D.
   Keputusan desain yang menjawab riset:
   - dua mode (template + bebas), template tidak mengunci item
   - undo/redo, auto-save, katalog besar + filter + pencarian
   - semua aset & warna gratis, tanpa iklan/koin/timer/energi
   - foto HD gratis (watermark opsional dihilangkan; ini milik pengguna)
   - responsif: mouse, trackpad, sentuh satu/dua jari */
(function () {
  'use strict';

  window.__errors = [];
  window.addEventListener('error', function (e) { window.__errors.push(String(e.message)); });
  window.addEventListener('unhandledrejection', function (e) { window.__errors.push('promise: ' + String(e.reason)); });

  const K = window.KATALOG;
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // ---------------------------------------------------------------- state
  const state = {
    room: { w: 6, d: 5, wall: '#efe7dc', floor: 'oak', outdoor: false },
    items: [],
    selectedId: null,
    mode: 'free',
    challenge: null,
    grid: true,
    nextId: 1
  };
  let history = [];
  let future = [];
  let pending = null;
  let activeCat = 'all';
  let activeTab = 'item';
  let saveTimer = null;

  // ---------------------------------------------------------------- renderer
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dfe7ea');
  scene.fog = new THREE.Fog('#dfe7ea', 26, 55);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 160);

  const hemi = new THREE.HemisphereLight('#ffffff', '#c9c2b4', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6e8', 2.1);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  scene.add(sun);
  const ambient = new THREE.AmbientLight('#ffffff', 0.28);
  scene.add(ambient);
  const lamp = new THREE.PointLight('#ffcf94', 0, 18, 2);
  lamp.position.set(0, 3.4, 0);
  scene.add(lamp);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: '#cdd8c9', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------------------------------------------------------------- tema gelap / terang
  const THEME_KEY = 'rumahku.theme.v1';
  const SCENE_THEME = {
    dark: {
      bg: '#0b1312', fogNear: 16, fogFar: 42, ground: '#0a1211',
      hemiSky: '#cfe9e2', hemiGround: '#16241f', hemi: 0.42, sun: 1.2, ambient: 0.1,
      exposure: 0.93, lamp: 1.35,
      gridMajor: '#3d5a52', gridMinor: '#2b423c', outline: 0x2dd4bf
    },
    light: {
      bg: '#dfe7ea', fogNear: 26, fogFar: 55, ground: '#cdd8c9',
      hemiSky: '#ffffff', hemiGround: '#c9c2b4', hemi: 0.85, sun: 2.1, ambient: 0.28,
      exposure: 1.02, lamp: 0,
      gridMajor: '#9fb0ac', gridMinor: '#c3cfca', outline: 0x0f766e
    }
  };
  let theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

  function themeCfg() { return SCENE_THEME[theme]; }

  function applyTheme(next, announce) {
    theme = next === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    const c = themeCfg();
    scene.background = new THREE.Color(c.bg);
    scene.fog = new THREE.Fog(c.bg, c.fogNear, c.fogFar);
    ground.material.color.set(c.ground);
    hemi.color.set(c.hemiSky);
    hemi.groundColor.set(c.hemiGround);
    hemi.intensity = c.hemi;
    sun.intensity = c.sun;
    ambient.intensity = c.ambient;
    renderer.toneMappingExposure = c.exposure;
    lamp.intensity = c.lamp;
    if (selectionHelper) selectionHelper.material.color.setHex(c.outline);
    refreshGrid();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0f0e' : '#f1eee7');
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    const btn = document.getElementById('btn-theme');
    if (btn) btn.title = theme === 'dark' ? 'Mode terang' : 'Mode gelap';
    if (announce) toast(theme === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif');
  }

  function toggleTheme() { applyTheme(theme === 'dark' ? 'light' : 'dark', true); }

  const roomGroup = new THREE.Group();
  const itemsGroup = new THREE.Group();
  const helperGroup = new THREE.Group();
  scene.add(roomGroup, itemsGroup, helperGroup);

  let selectionHelper = null;
  let gridHelper = null;

  // ---------------------------------------------------------------- tekstur lantai prosedural
  const texCache = {};
  function makeFloorTexture(kind) {
    if (texCache[kind]) return texCache[kind];
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    let t;

    if (kind === 'oak' || kind === 'concrete') {
      const base = kind === 'oak' ? '#c9a274' : '#b9b7b1';
      g.fillStyle = base; g.fillRect(0, 0, size, size);
      const rows = kind === 'oak' ? 8 : 4;
      for (let i = 0; i < rows; i++) {
        const y = i * (size / rows);
        for (let j = 0; j < 60; j++) {
          const alpha = kind === 'oak' ? 0.05 + Math.random() * 0.07 : 0.02 + Math.random() * 0.03;
          g.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '90,60,35' : '255,235,205') + ',' + alpha + ')';
          g.fillRect(0, y + Math.random() * (size / rows), size, 1 + Math.random() * 2);
        }
        g.fillStyle = 'rgba(70,45,25,0.20)';
        g.fillRect(0, y, size, 1.5);
        if (kind === 'oak') {
          const offset = (i % 2) * (size / 4);
          for (let k = 0; k < 4; k++) {
            g.fillStyle = 'rgba(70,45,25,0.16)';
            g.fillRect((offset + k * (size / 2)) % size, y, 1.5, size / rows);
          }
        }
      }
      if (kind === 'concrete') {
        for (let i = 0; i < 900; i++) {
          g.fillStyle = 'rgba(80,80,80,' + (Math.random() * 0.05) + ')';
          g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
        }
      }
    } else if (kind === 'marble') {
      g.fillStyle = '#eceae5'; g.fillRect(0, 0, size, size);
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        g.strokeStyle = 'rgba(120,125,130,' + (0.05 + Math.random() * 0.12) + ')';
        g.lineWidth = 0.6 + Math.random() * 1.6;
        let x = Math.random() * size, y = Math.random() * size;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.strokeStyle = 'rgba(150,150,150,0.35)'; g.lineWidth = 2;
      g.strokeRect(0, 0, size, size);
    } else if (kind === 'tile') {
      g.fillStyle = '#e4e1da'; g.fillRect(0, 0, size, size);
      const n = 4, cell = size / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const shade = 232 + Math.floor(Math.random() * 10);
          g.fillStyle = 'rgb(' + shade + ',' + (shade - 2) + ',' + (shade - 8) + ')';
          g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
        }
      }
      g.strokeStyle = 'rgba(150,148,140,0.5)'; g.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke();
        g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke();
      }
    } else if (kind === 'carpet') {
      g.fillStyle = '#cfc4b4'; g.fillRect(0, 0, size, size);
      for (let i = 0; i < 12000; i++) {
        g.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '90,80,70') + ',' + (Math.random() * 0.12) + ')';
        g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
      }
    } else { // grass
      g.fillStyle = '#8fae72'; g.fillRect(0, 0, size, size);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '60,100,50' : '190,215,150') + ',' + (Math.random() * 0.25) + ')';
        g.fillRect(Math.random() * size, Math.random() * size, 2, 3 + Math.random() * 3);
      }
    }

    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    texCache[kind] = t;
    return t;
  }

  let floorMesh = null;
  let floorTex = null;
  let wallMeshes = [];
  let baseboards = [];

  function buildRoom() {
    // bersihkan
    while (roomGroup.children.length) {
      const ch = roomGroup.children.pop();
      ch.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
    }
    wallMeshes = []; baseboards = [];
    const r = state.room;
    const h = 2.75;
    const outdoor = !!r.outdoor;

    const kind = outdoor ? 'grass' : r.floor;
    floorTex = makeFloorTexture(kind);
    floorTex.repeat.set(r.w / 1.6, r.d / 1.6);
    floorTex.needsUpdate = true;
    floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r.w, r.d),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.02 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    if (!outdoor) {
      const wallMat = new THREE.MeshStandardMaterial({ color: r.wall, roughness: 0.94 });
      const back = new THREE.Mesh(new THREE.BoxGeometry(r.w, h, 0.12), wallMat);
      back.position.set(0, h / 2, -r.d / 2 - 0.06);
      back.receiveShadow = true; back.castShadow = true;
      roomGroup.add(back); wallMeshes.push(back);

      const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, r.d), wallMat);
      left.position.set(-r.w / 2 - 0.06, h / 2, 0);
      left.receiveShadow = true; left.castShadow = true;
      roomGroup.add(left); wallMeshes.push(left);

      const baseMat = new THREE.MeshStandardMaterial({ color: '#f6f3ec', roughness: 0.7 });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.09, 0.05), baseMat);
      b1.position.set(0, 0.045, -r.d / 2 + 0.02);
      roomGroup.add(b1); baseboards.push(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, r.d), baseMat);
      b2.position.set(-r.w / 2 + 0.02, 0.045, 0);
      roomGroup.add(b2); baseboards.push(b2);
    }

    refreshGrid();

    // bayangan matahari mengikuti ukuran ruangan
    const s = sun.shadow.camera;
    const ext = Math.max(r.w, r.d) * 0.9 + 2;
    s.left = -ext; s.right = ext; s.top = ext; s.bottom = -ext;
    s.updateProjectionMatrix();
  }

  function refreshGrid() {
    if (gridHelper) { scene.remove(gridHelper); gridHelper.geometry.dispose(); gridHelper.material.dispose(); gridHelper = null; }
    const r = state.room;
    if (!state.grid || r.outdoor) return;
    const c = themeCfg();
    gridHelper = new THREE.GridHelper(Math.max(r.w, r.d), Math.round(Math.max(r.w, r.d) * 2), c.gridMajor, c.gridMinor);
    gridHelper.position.y = 0.004;
    gridHelper.material.opacity = theme === 'dark' ? 0.6 : 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
  }

  // ---------------------------------------------------------------- item
  function defOf(rec) { return K.byKey[rec.key]; }

  function buildMesh(rec) {
    const def = defOf(rec);
    if (!def) return null;
    const g = new THREE.Group();
    def.build(g, def.palette[rec.color] || def.palette[0]);
    const sc = rec.scale || 1;
    g.scale.setScalar(sc);
    g.position.set(rec.x, rec.y || 0, rec.z);
    g.rotation.y = rec.rot || 0;
    g.traverse(function (o) { o.userData.itemId = rec.id; });
    g.userData.itemId = rec.id;
    return g;
  }

  function rebuildItems() {
    while (itemsGroup.children.length) {
      const ch = itemsGroup.children.pop();
      ch.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    state.items.forEach(function (rec) {
      const mesh = buildMesh(rec);
      if (mesh) itemsGroup.add(mesh);
    });
    updateSelectionHelper();
    evaluateGoals();
  }

  function getItem(id) {
    for (let i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }
  function meshOf(id) {
    for (let i = 0; i < itemsGroup.children.length; i++) {
      if (itemsGroup.children[i].userData.itemId === id) return itemsGroup.children[i];
    }
    return null;
  }

  function updateSelectionHelper() {
    if (selectionHelper) { helperGroup.remove(selectionHelper); selectionHelper.geometry.dispose(); selectionHelper = null; }
    if (!state.selectedId) return;
    const mesh = meshOf(state.selectedId);
    if (!mesh) return;
    selectionHelper = new THREE.BoxHelper(mesh, 0x14b8a6);
    selectionHelper.material.depthTest = false;
    selectionHelper.material.transparent = true;
    selectionHelper.renderOrder = 5;
    helperGroup.add(selectionHelper);
  }

  function clampItem(rec) {
    const def = defOf(rec);
    if (!def) return;
    const sc = rec.scale || 1;
    const halfW = (def.size[0] * sc) / 2;
    const halfD = (def.size[1] * sc) / 2;
    if (def.wall) {
      snapWall(rec);
      return;
    }
    const pad = 0.04;
    rec.x = clamp(rec.x, -state.room.w / 2 + halfW + pad, state.room.w / 2 - halfW - pad);
    rec.z = clamp(rec.z, -state.room.d / 2 + halfD + pad, state.room.d / 2 - halfD - pad);
    rec.y = clamp(rec.y || 0, 0, 2);
  }

  function snapWall(rec) {
    const def = defOf(rec);
    if (!def || !def.wall) return;
    const r = state.room;
    const sc = rec.scale || 1;
    const halfW = (def.size[0] * sc) / 2;
    const halfD = (def.size[1] * sc) / 2;
    const dBack = Math.abs(rec.z + r.d / 2);
    const dLeft = Math.abs(rec.x + r.w / 2);
    if (dBack <= dLeft) {
      rec.z = -r.d / 2 + halfD + 0.03;
      rec.x = clamp(rec.x, -r.w / 2 + halfW, r.w / 2 - halfW);
      rec.rot = 0;
    } else {
      rec.x = -r.w / 2 + halfD + 0.03;
      rec.z = clamp(rec.z, -r.d / 2 + halfW, r.d / 2 - halfW);
      rec.rot = Math.PI / 2;
    }
    rec.y = def.wallY || 1.5;
  }

  function findSpot(def) {
    const r = state.room;
    const halfW = def.size[0] / 2, halfD = def.size[1] / 2;
    const maxX = Math.max(0.2, r.w / 2 - halfW - 0.2);
    const maxZ = Math.max(0.2, r.d / 2 - halfD - 0.2);
    const candidates = [[0, 0]];
    for (let rad = 0.7; rad < 5; rad += 0.55) {
      for (let a = 0; a < 16; a++) {
        candidates.push([Math.cos((a / 16) * Math.PI * 2) * rad, Math.sin((a / 16) * Math.PI * 2) * rad]);
      }
    }
    for (let i = 0; i < candidates.length; i++) {
      const x = candidates[i][0], z = candidates[i][1];
      if (Math.abs(x) > maxX || Math.abs(z) > maxZ) continue;
      let free = true;
      for (let j = 0; j < state.items.length; j++) {
        const it = state.items[j];
        if (Math.hypot(it.x - x, it.z - z) < 0.62) { free = false; break; }
      }
      if (free) return [x, z];
    }
    return [0, 0];
  }

  function addItem(key, opts) {
    const def = K.byKey[key];
    if (!def) return null;
    opts = opts || {};
    const rec = {
      id: 'i' + (state.nextId++),
      key: key,
      x: opts.x === undefined ? 0 : opts.x,
      z: opts.z === undefined ? 0 : opts.z,
      rot: opts.rot || 0,
      scale: opts.scale || 1,
      color: opts.color === undefined ? 0 : opts.color,
      y: opts.y || 0
    };
    if (opts.x === undefined) {
      const spot = findSpot(def);
      rec.x = spot[0]; rec.z = spot[1];
    }
    if (def.wall) snapWall(rec); else clampItem(rec);
    state.items.push(rec);
    const mesh = buildMesh(rec);
    if (mesh) itemsGroup.add(mesh);
    select(rec.id);
    updateSelectionHelper();
    evaluateGoals();
    return rec;
  }

  // ---------------------------------------------------------------- history
  function snap() {
    return JSON.stringify({ room: state.room, items: state.items, nextId: state.nextId });
  }
  function begin() { if (pending === null) pending = snap(); }
  function commit() {
    if (pending === null) return;
    const now = snap();
    if (now !== pending) {
      history.push(pending);
      if (history.length > 80) history.shift();
      future.length = 0;
    }
    pending = null;
    saveSoon();
    updateUndoUI();
  }
  function applySnapshot(obj) {
    state.room = obj.room;
    state.items = obj.items;
    state.nextId = obj.nextId || state.nextId;
    if (!state.items.some(function (i) { return i.id === state.selectedId; })) state.selectedId = null;
    buildRoom();
    rebuildItems();
    syncUI();
  }
  function undo() {
    if (!history.length) { toast('Tidak ada langkah untuk dibatalkan'); return; }
    const cur = snap();
    const prev = history.pop();
    future.push(cur);
    applySnapshot(JSON.parse(prev));
    saveSoon(); updateUndoUI();
  }
  function redo() {
    if (!future.length) { toast('Tidak ada langkah untuk diulang'); return; }
    const cur = snap();
    const next = future.pop();
    history.push(cur);
    applySnapshot(JSON.parse(next));
    saveSoon(); updateUndoUI();
  }
  function updateUndoUI() {
    $('#btn-undo').disabled = history.length === 0;
    $('#btn-redo').disabled = future.length === 0;
  }

  // ---------------------------------------------------------------- camera controls
  const cam = { radius: 11, theta: 0.42, phi: 1.0, target: new THREE.Vector3(0, 0.9, 0) };

  function fitCamera() {
    const r = Math.max(state.room.w, state.room.d);
    cam.radius = r * 1.45 + 1.6;
    cam.theta = 0.4;
    cam.phi = 1.0;
    cam.target.set(0, 0.85, 0);
  }

  function updateCamera() {
    cam.radius = clamp(cam.radius, 2.6, 30);
    cam.theta = clamp(cam.theta, -1.0, 1.0);
    cam.phi = clamp(cam.phi, 0.3, 1.34);
    cam.target.x = clamp(cam.target.x, -state.room.w * 0.6, state.room.w * 0.6);
    cam.target.z = clamp(cam.target.z, -state.room.d * 0.6, state.room.d * 0.6);
    const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
    camera.position.set(
      cam.target.x + cam.radius * sp * Math.sin(cam.theta),
      cam.target.y + cam.radius * cp,
      cam.target.z + cam.radius * sp * Math.cos(cam.theta)
    );
    camera.lookAt(cam.target);
  }

  function resize() {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- input
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointers = new Map();
  let action = null; // {type:'orbit'|'pan'|'drag'|'pinch', ...}

  function setNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function pickItem(e) {
    setNDC(e);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(itemsGroup.children, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o && !o.userData.itemId) o = o.parent;
      if (o) return o.userData.itemId;
    }
    return null;
  }
  function floorPoint(e) {
    setNDC(e);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(floorPlane, p) ? p : null;
  }

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    hideHint();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hideHint();

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      action = {
        type: 'pinch',
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        radius: cam.radius,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        target: cam.target.clone()
      };
      return;
    }

    if (e.button === 2 || e.button === 1 || e.shiftKey) {
      action = { type: 'pan', x: e.clientX, y: e.clientY, target: cam.target.clone() };
      return;
    }

    const id = pickItem(e);
    if (id) {
      select(id);
      const rec = getItem(id);
      const p = floorPoint(e);
      action = {
        type: 'drag', id: id, moved: false,
        offsetX: p ? rec.x - p.x : 0,
        offsetZ: p ? rec.z - p.z : 0,
        startX: e.clientX, startY: e.clientY
      };
      begin();
    } else {
      select(null);
      action = { type: 'orbit', x: e.clientX, y: e.clientY, theta: cam.theta, phi: cam.phi };
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!action) return;

    if (action.type === 'pinch' && pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      cam.radius = action.radius * (action.dist / Math.max(1, dist));
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      cam.target.x = action.target.x - (mid.x - action.mid.x) * 0.008 * cam.radius;
      cam.target.z = action.target.z - (mid.y - action.mid.y) * 0.008 * cam.radius;
      return;
    }

    if (action.type === 'orbit') {
      cam.theta = action.theta - (e.clientX - action.x) * 0.006;
      cam.phi = action.phi - (e.clientY - action.y) * 0.005;
      return;
    }

    if (action.type === 'pan') {
      const k = cam.radius * 0.0016;
      cam.target.x = action.target.x - (e.clientX - action.x) * k;
      cam.target.z = action.target.z - (e.clientY - action.y) * k;
      return;
    }

    if (action.type === 'drag') {
      const rec = getItem(action.id);
      if (!rec) return;
      const p = floorPoint(e);
      if (!p) return;
      const dx = Math.abs(e.clientX - action.startX), dy = Math.abs(e.clientY - action.startY);
      if (dx + dy > 3) action.moved = true;
      rec.x = p.x + action.offsetX;
      rec.z = p.z + action.offsetZ;
      const def = defOf(rec);
      if (!def.wall) clampItem(rec);
      const mesh = meshOf(rec.id);
      if (mesh) { mesh.position.x = rec.x; mesh.position.z = rec.z; }
      if (selectionHelper) selectionHelper.setFromObject(mesh);
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!action) return;
    if (action.type === 'drag') {
      const rec = getItem(action.id);
      if (rec) {
        const def = defOf(rec);
        if (def.wall) snapWall(rec);
        clampItem(rec);
        const mesh = meshOf(rec.id);
        if (mesh) { mesh.position.set(rec.x, rec.y, rec.z); mesh.rotation.y = rec.rot; }
        updateSelectionHelper();
        syncItemPanel();
        evaluateGoals();
      }
      commit();
    }
    if (pointers.size === 0) action = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', function (e) { pointers.delete(e.pointerId); });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.radius *= Math.exp(e.deltaY * 0.0012);
  }, { passive: false });

  canvas.addEventListener('dblclick', function (e) {
    const id = pickItem(e);
    if (!id) return;
    const rec = getItem(id);
    begin();
    rec.rot = (rec.rot || 0) + Math.PI / 4;
    const mesh = meshOf(id);
    if (mesh) mesh.rotation.y = rec.rot;
    commit(); syncItemPanel(); updateSelectionHelper();
  });

  // ---------------------------------------------------------------- selection & UI
  function select(id) {
    state.selectedId = id;
    updateSelectionHelper();
    if (id) {
      activeTab = 'item';
      setTab('item');
      if (window.matchMedia('(max-width: 900px)').matches) openSheet('side');
    }
    syncItemPanel();
  }

  function syncItemPanel() {
    const rec = state.selectedId ? getItem(state.selectedId) : null;
    $('#item-empty').hidden = !!rec;
    $('#item-controls').hidden = !rec;
    if (!rec) return;
    const def = defOf(rec);
    $('#item-name').textContent = def.name;
    $('#item-size').textContent = def.size[0].toFixed(2) + ' × ' + def.size[1].toFixed(2) + ' m · ' +
      (def.wall ? 'menempel dinding' : 'berdiri di lantai');
    $('#rot').value = Math.round(((rec.rot || 0) * 180 / Math.PI) % 360 / 15) * 15;
    $('#rot-val').textContent = Math.round(((rec.rot || 0) * 180 / Math.PI) % 360) + '°';
    $('#scale').value = Math.round((rec.scale || 1) * 100);
    $('#scale-val').textContent = Math.round((rec.scale || 1) * 100) + '%';
    $('#height').value = Math.round((rec.y || 0) * 100);
    $('#height-val').textContent = (rec.y || 0).toFixed(2) + ' m';

    const pal = def.palette;
    const sw = $('#item-colors');
    sw.innerHTML = pal.map(function (col, i) {
      return '<button class="swatch' + (i === (rec.color || 0) ? ' is-active' : '') +
        '" style="background:' + col + '" data-color="' + i + '" aria-label="Warna ' + (i + 1) + '"></button>';
    }).join('');
  }

  function setTab(tab) {
    activeTab = tab;
    $$('.side-tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
    ['item', 'room', 'goals'].forEach(function (t) {
      const el = document.getElementById('tab-' + t);
      if (el) el.hidden = t !== tab;
    });
    if (typeof syncMobileTabs === 'function') syncMobileTabs();
  }

  function renderChips() {
    const el = $('#cats');
    const all = [{ key: 'all', label: 'Semua' }].concat(K.cats);
    el.innerHTML = all.map(function (c) {
      return '<button class="chip' + (activeCat === c.key ? ' is-active' : '') + '" data-cat="' + c.key + '">' + c.label + '</button>';
    }).join('');
  }

  function renderCatalog() {
    const q = ($('#search').value || '').trim().toLowerCase();
    const list = K.items.filter(function (it) {
      if (activeCat !== 'all' && it.cat !== activeCat) return false;
      if (!q) return true;
      return it.name.toLowerCase().indexOf(q) >= 0 || it.key.indexOf(q) >= 0;
    });
    $('#catalog-count').textContent = '(' + list.length + ')';
    if (!list.length) {
      $('#items').innerHTML = '<p class="empty-mini">Tidak ada aset yang cocok. Coba kata lain.</p>';
      return;
    }
    $('#items').innerHTML = list.map(function (it) {
      const p = it.palette;
      return '<button class="item-card" data-key="' + it.key + '">' +
        '<span class="thumb" style="background:linear-gradient(135deg,' + p[0] + ' 0%,' + p[0] + ' 55%,' + (p[1] || p[0]) + ' 55%,' + (p[1] || p[0]) + ' 100%)"></span>' +
        '<span class="meta"><span class="nm">' + it.name + '</span>' +
        '<span class="dim">' + it.size[0].toFixed(1) + ' × ' + it.size[1].toFixed(1) + ' m</span></span>' +
        '<span class="free">gratis</span></button>';
    }).join('');
  }

  function renderWallColors() {
    const cols = ['#efe7dc', '#e9e3d6', '#dfe7ea', '#e7dfe9', '#dfe9df', '#f2efe8', '#cbb7a0', '#3f4a52'];
    $('#wall-colors').innerHTML = cols.map(function (c) {
      return '<button class="swatch' + (state.room.wall === c ? ' is-active' : '') +
        '" style="background:' + c + '" data-wall="' + c + '" aria-label="Warna dinding ' + c + '"></button>';
    }).join('');
  }

  function renderFloors() {
    const floors = [['oak', 'Kayu Oak'], ['marble', 'Marmer'], ['tile', 'Keramik'], ['concrete', 'Beton'], ['carpet', 'Karpet'], ['grass', 'Rumput']];
    $('#floors').innerHTML = floors.map(function (f) {
      return '<button class="floor-btn' + (state.room.floor === f[0] ? ' is-active' : '') + '" data-floor="' + f[0] + '">' + f[1] + '</button>';
    }).join('');
  }

  function syncUI() {
    $('#room-w').value = state.room.w;
    $('#room-d').value = state.room.d;
    $('#w-val').textContent = state.room.w.toFixed(1) + ' m';
    $('#d-val').textContent = state.room.d.toFixed(1) + ' m';
    $('#outdoor').checked = !!state.room.outdoor;
    renderWallColors();
    renderFloors();
    renderCatalog();
    syncItemPanel();
    renderGoals();
    updateUndoUI();
    setTab(activeTab);
    $$('.mode-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === state.mode); });
  }

  // ---------------------------------------------------------------- templates & challenges
  const TEMPLATES = [
    {
      key: 'kamar', name: 'Kamar Tidur Modern', desc: 'Queen bed, nakas, lemari, karpet, tanaman. 9 item.',
      room: { w: 5.2, d: 4.6, wall: '#efe7dc', floor: 'oak', outdoor: false },
      items: [
        { key: 'bed_queen', x: 0, z: -1.3, rot: 0, color: 0 },
        { key: 'nightstand', x: -1.25, z: -1.95, rot: 0, color: 0 },
        { key: 'nightstand', x: 1.25, z: -1.95, rot: 0, color: 0 },
        { key: 'table_lamp', x: -1.25, z: -1.95, rot: 0, color: 0, y: 0.57 },
        { key: 'wardrobe', x: 2.15, z: 0.2, rot: -Math.PI / 2, color: 0 },
        { key: 'rug_rect', x: 0, z: 0.5, rot: 0, color: 0 },
        { key: 'plant_pot', x: -2.1, z: 1.35, rot: 0, color: 0 },
        { key: 'wall_art', x: 0, z: -2.3, rot: 0, color: 1 },
        { key: 'dresser', x: -2.45, z: -0.7, rot: Math.PI / 2, color: 1 }
      ]
    },
    {
      key: 'tamu', name: 'Ruang Tamu Skandinavia', desc: 'Sofa 3 dudukan, kursi malas, meja kopi, TV, karpet. 10 item.',
      room: { w: 6.4, d: 5, wall: '#e9e3d6', floor: 'oak', outdoor: false },
      items: [
        { key: 'sofa3', x: 0, z: -1.55, rot: 0, color: 0 },
        { key: 'coffee_table', x: 0, z: 0.15, rot: 0, color: 0 },
        { key: 'rug_rect', x: 0, z: 0.1, rot: 0, color: 0 },
        { key: 'armchair', x: 1.95, z: 0.95, rot: -0.7, color: 3 },
        { key: 'tv_console', x: 0, z: 2.05, rot: Math.PI, color: 0 },
        { key: 'floor_lamp', x: -2.45, z: -1.7, rot: 0, color: 0 },
        { key: 'plant_tall', x: 2.55, z: -1.75, rot: 0, color: 0 },
        { key: 'side_table', x: 2.1, z: 1.3, rot: 0, color: 0 },
        { key: 'wall_art', x: -0.1, z: -2.5, rot: 0, color: 1 },
        { key: 'wall_clock', x: 1.9, z: -2.5, rot: 0, color: 0 }
      ]
    },
    {
      key: 'dapur', name: 'Dapur Minimalis', desc: 'Island, kabinet, kulkas, kompor, meja makan 4 kursi. 13 item.',
      room: { w: 5.4, d: 4.6, wall: '#dfe7ea', floor: 'tile', outdoor: false },
      items: [
        { key: 'kitchen_island', x: 0, z: 0.2, rot: 0, color: 0 },
        { key: 'cabinet_base', x: -1.9, z: -1.9, rot: 0, color: 0 },
        { key: 'cabinet_base', x: 0.1, z: -1.9, rot: 0, color: 0 },
        { key: 'stove', x: -0.95, z: -1.9, rot: 0, color: 0 },
        { key: 'sink', x: 1.15, z: -1.9, rot: 0, color: 0 },
        { key: 'fridge', x: 2.35, z: -1.9, rot: 0, color: 0 },
        { key: 'cabinet_wall', x: -1.9, z: -2.15, rot: 0, color: 0 },
        { key: 'cabinet_wall', x: 0.1, z: -2.15, rot: 0, color: 0 },
        { key: 'dining_table', x: 0, z: 1.45, rot: 0, color: 0 },
        { key: 'dining_chair', x: -0.5, z: 2.05, rot: 0, color: 0 },
        { key: 'dining_chair', x: 0.5, z: 2.05, rot: 0, color: 0 },
        { key: 'dining_chair', x: -0.5, z: 0.85, rot: Math.PI, color: 0 },
        { key: 'plant_pot', x: -2.35, z: 1.7, rot: 0, color: 0 }
      ]
    },
    {
      key: 'mandi', name: 'Kamar Mandi Spa', desc: 'Bathtub, shower kaca, wastafel, toilet, tanaman. 7 item.',
      room: { w: 3.8, d: 3.6, wall: '#dfe9df', floor: 'marble', outdoor: false },
      items: [
        { key: 'bathtub', x: 0.55, z: -1.05, rot: 0, color: 0 },
        { key: 'shower', x: -1.35, z: -1.25, rot: 0, color: 0 },
        { key: 'vanity', x: -1.7, z: 0.75, rot: Math.PI / 2, color: 1 },
        { key: 'toilet', x: 1.45, z: 1.1, rot: -Math.PI / 2, color: 0 },
        { key: 'plant_pot', x: 1.5, z: -1.3, rot: 0, color: 0 },
        { key: 'towel_rack', x: -1.85, z: -0.4, rot: Math.PI / 2, color: 0 },
        { key: 'rug_round', x: 0.1, z: 0.7, rot: 0, color: 1 }
      ]
    },
    {
      key: 'taman', name: 'Taman Belakang', desc: 'Pohon, semak, bangku, planter, lampu taman, batu setapak. 10 item.',
      room: { w: 8, d: 6, wall: '#dfe7ea', floor: 'grass', outdoor: true },
      items: [
        { key: 'tree_big', x: -2.8, z: -1.6, rot: 0, color: 0 },
        { key: 'tree_small', x: 2.6, z: -2.1, rot: 0, color: 1 },
        { key: 'tree_small', x: 1.9, z: 1.9, rot: 0, color: 2 },
        { key: 'bush', x: -1.1, z: 1.7, rot: 0, color: 0 },
        { key: 'bush', x: 0.8, z: -1.2, rot: 0, color: 1 },
        { key: 'garden_bench', x: 0, z: 0.7, rot: Math.PI, color: 0 },
        { key: 'planter', x: -2.9, z: 1.5, rot: 0, color: 0 },
        { key: 'garden_lamp', x: -1.2, z: -1.9, rot: 0, color: 0 },
        { key: 'garden_lamp', x: 2.3, z: 0.7, rot: 0, color: 0 },
        { key: 'stone_path', x: 0, z: 2.4, rot: 0, color: 0 }
      ]
    }
  ];

  const CHALLENGES = [
    {
      key: 'c1', name: 'Kamar Tidur Hangat', room: { w: 5.2, d: 4.6, wall: '#efe7dc', floor: 'oak', outdoor: false },
      brief: 'Buat kamar tidur untuk satu orang: tempat tidur queen/king, dua sumber cahaya, tanaman, karpet, minimal 8 item.',
      goals: [
        { label: 'Tempat tidur queen atau king', test: function (its) { return its.some(function (i) { return i.key === 'bed_queen' || i.key === 'bed_king'; }); } },
        { label: 'Minimal 2 lampu', test: function (its) { return its.filter(function (i) { return i.key.indexOf('lamp') >= 0; }).length >= 2; } },
        { label: 'Ada tanaman', test: function (its) { return its.some(function (i) { return i.key.indexOf('plant') >= 0; }); } },
        { label: 'Ada karpet', test: function (its) { return its.some(function (i) { return i.key.indexOf('rug') >= 0; }); } },
        { label: 'Minimal 8 item', test: function (its) { return its.length >= 8; } }
      ]
    },
    {
      key: 'c2', name: 'Ruang Tamu untuk Tamu', room: { w: 6.4, d: 5, wall: '#e9e3d6', floor: 'oak', outdoor: false },
      brief: 'Ruang tamu yang bisa menampung 4 orang duduk, ada permukaan untuk menaruh minuman, hiburan, dan pencahayaan malam.',
      goals: [
        { label: 'Tempat duduk untuk 4+ orang', test: function (its) { return its.filter(function (i) { return ['sofa3', 'sofa2', 'armchair', 'dining_chair'].indexOf(i.key) >= 0; }).length >= 2; } },
        { label: 'Meja kopi atau meja samping', test: function (its) { return its.some(function (i) { return i.key === 'coffee_table' || i.key === 'side_table'; }); } },
        { label: 'Ada TV atau rak buku', test: function (its) { return its.some(function (i) { return i.key === 'tv_console' || i.key === 'bookshelf'; }); } },
        { label: 'Lampu lantai atau lampu meja', test: function (its) { return its.some(function (i) { return i.key.indexOf('lamp') >= 0; }); } },
        { label: 'Ada karpet', test: function (its) { return its.some(function (i) { return i.key.indexOf('rug') >= 0; }); } }
      ]
    },
    {
      key: 'c3', name: 'Dapur Kecil Fungsional', room: { w: 5.4, d: 4.6, wall: '#dfe7ea', floor: 'tile', outdoor: false },
      brief: 'Dapur 5×4 m: area masak, area cuci, penyimpanan dingin, dan meja makan untuk 2 orang. Semua harus muat tanpa menghalangi jalan.',
      goals: [
        { label: 'Kompor', test: function (its) { return its.some(function (i) { return i.key === 'stove'; }); } },
        { label: 'Wastafel dapur', test: function (its) { return its.some(function (i) { return i.key === 'sink'; }); } },
        { label: 'Kulkas', test: function (its) { return its.some(function (i) { return i.key === 'fridge'; }); } },
        { label: 'Meja makan + 2 kursi', test: function (its) { return its.some(function (i) { return i.key === 'dining_table'; }) && its.filter(function (i) { return i.key === 'dining_chair'; }).length >= 2; } },
        { label: 'Ada kabinet penyimpanan', test: function (its) { return its.some(function (i) { return i.key.indexOf('cabinet') >= 0; }); } }
      ]
    },
    {
      key: 'c4', name: 'Taman Kecil di Belakang', room: { w: 7, d: 5.5, wall: '#dfe7ea', floor: 'grass', outdoor: true },
      brief: 'Taman belakang 7×5.5 m: minimal 3 pohon, tempat duduk, pencahayaan, dan jalur setapak. Tidak ada batas biaya.',
      goals: [
        { label: 'Minimal 3 pohon', test: function (its) { return its.filter(function (i) { return i.key.indexOf('tree') >= 0; }).length >= 3; } },
        { label: 'Ada tempat duduk', test: function (its) { return its.some(function (i) { return i.key === 'garden_bench'; }); } },
        { label: 'Minimal 2 lampu taman', test: function (its) { return its.filter(function (i) { return i.key === 'garden_lamp'; }).length >= 2; } },
        { label: 'Jalur setapak', test: function (its) { return its.some(function (i) { return i.key === 'stone_path'; }); } },
        { label: 'Ada semak atau planter', test: function (its) { return its.some(function (i) { return i.key === 'bush' || i.key === 'planter'; }); } }
      ]
    }
  ];

  function applyTemplate(tpl) {
    begin();
    state.room = JSON.parse(JSON.stringify(tpl.room));
    state.items = tpl.items.map(function (it) {
      const def = K.byKey[it.key];
      const rec = {
        id: 'i' + (state.nextId++), key: it.key,
        x: it.x, z: it.z, rot: it.rot || 0, color: it.color || 0,
        scale: it.scale || 1, y: it.y || 0
      };
      if (def.wall && !rec.y) rec.y = def.wallY || 1.5;
      return rec;
    });
    state.selectedId = null;
    state.challenge = null;
    state.mode = 'free';
    fitCamera();
    buildRoom();
    rebuildItems();
    syncUI();
    commit();
    closeModal();
    toast('Template "' + tpl.name + '" dimuat — semua item bebas diubah');
  }

  function startChallenge(ch) {
    begin();
    state.room = JSON.parse(JSON.stringify(ch.room));
    state.items = [];
    state.selectedId = null;
    state.challenge = ch.key;
    state.mode = 'challenge';
    fitCamera();
    buildRoom();
    rebuildItems();
    syncUI();
    activeTab = 'goals';
    setTab('goals');
    commit();
    closeModal();
    if (window.matchMedia('(max-width: 900px)').matches) openSheet('side');
    toast('Tantangan dimulai: ' + ch.name);
  }

  function renderGoals() {
    const ch = CHALLENGES.filter(function (c) { return c.key === state.challenge; })[0];
    const nameEl = $('#challenge-name');
    const briefEl = $('#challenge-brief');
    const listEl = $('#goals-list');
    if (!ch) {
      nameEl.textContent = 'Belum ada tantangan';
      briefEl.textContent = 'Pilih tantangan untuk mulai. Target dinilai otomatis, tanpa hadiah berbayar.';
      listEl.innerHTML = '';
      return;
    }
    nameEl.textContent = ch.name;
    briefEl.textContent = ch.brief;
    listEl.innerHTML = ch.goals.map(function (g, i) {
      const done = g.test(state.items);
      return '<div class="goal' + (done ? ' is-done' : '') + '"><span class="tick">' + (done ? '✓' : '') + '</span><span>' + g.label + '</span></div>';
    }).join('');
  }

  function evaluateGoals() {
    const ch = CHALLENGES.filter(function (c) { return c.key === state.challenge; })[0];
    if (!ch) return;
    renderGoals();
    const allDone = ch.goals.every(function (g) { return g.test(state.items); });
    if (allDone && !ch._celebrated) {
      ch._celebrated = true;
      toast('Semua target selesai. Desainmu bisa langsung difoto HD.');
    }
    if (!allDone) ch._celebrated = false;
  }

  // ---------------------------------------------------------------- modal
  function openModal(kind) {
    const modal = $('#modal');
    const list = $('#modal-list');
    modal.hidden = false;
    if (kind === 'challenge') {
      $('#modal-title').textContent = 'Tantangan desain';
      $('#modal-sub').textContent = 'Semua tantangan gratis. Target dinilai otomatis; tidak ada hadiah berbayar atau timer.';
      list.innerHTML = CHALLENGES.map(function (c) {
        return '<button class="card" data-challenge="' + c.key + '"><b>' + c.name + '</b><span>' + c.brief + '</span><em>' + c.goals.length + ' target · ' + c.room.w + '×' + c.room.d + ' m</em></button>';
      }).join('');
    } else {
      $('#modal-title').textContent = 'Template ruangan';
      $('#modal-sub').textContent = 'Mulai dari template, lalu ubah apa pun sesukamu — template tidak mengunci item.';
      list.innerHTML = TEMPLATES.map(function (t) {
        return '<button class="card" data-template="' + t.key + '"><b>' + t.name + '</b><span>' + t.desc + '</span><em>' + t.room.w + '×' + t.room.d + ' m · ' + t.items.length + ' item</em></button>';
      }).join('');
    }
  }
  function closeModal() { $('#modal').hidden = true; }

  // ---------------------------------------------------------------- toast & hint
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }
  function hideHint() {
    const h = $('#hint');
    if (h && !h.classList.contains('is-off')) {
      h.classList.add('is-off');
      setTimeout(function () { h.style.display = 'none'; }, 400);
    }
  }

  // ---------------------------------------------------------------- sheets (mobile)
  function syncMobileTabs() {
    const cat = $('#panel-catalog').classList.contains('is-open');
    const side = $('#panel-side').classList.contains('is-open');
    $$('.mobile-tabs button').forEach(function (b) {
      let on;
      if (b.dataset.open === 'catalog') on = cat;
      else on = side && (b.dataset.tab || 'item') === activeTab;
      b.classList.toggle('is-active', !!on);
    });
  }
  function openSheet(which) {
    closeSheet(which === 'catalog' ? 'side' : 'catalog');
    const el = which === 'catalog' ? $('#panel-catalog') : $('#panel-side');
    el.classList.add('is-open');
    if (which === 'side') setTab(activeTab);
    syncMobileTabs();
  }
  function closeSheet(which) {
    const el = which === 'catalog' ? $('#panel-catalog') : $('#panel-side');
    el.classList.remove('is-open');
    syncMobileTabs();
  }

  // ---------------------------------------------------------------- persistence
  const SAVE_KEY = 'rumahku.save.v1';
  function saveNow(silent) {
    try {
      localStorage.setItem(SAVE_KEY, snap());
      if (!silent) toast('Tersimpan di perangkat ini');
    } catch (err) {
      toast('Gagal menyimpan: penyimpanan browser penuh');
    }
  }
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(true); }, 700);
  }
  function loadSaved() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || !obj.room || !Array.isArray(obj.items)) return false;
      state.room = obj.room;
      state.items = obj.items;
      state.nextId = obj.nextId || (obj.items.length + 1);
      return true;
    } catch (err) { return false; }
  }

  // ---------------------------------------------------------------- photo
  function renderPhotoData() {
    const oldW = renderer.domElement.width / renderer.getPixelRatio();
    const oldH = renderer.domElement.height / renderer.getPixelRatio();
    const oldAspect = camera.aspect;
    const W = 1920, H = 1080;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (selectionHelper) selectionHelper.visible = false;
    if (gridHelper) gridHelper.visible = false;
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    if (selectionHelper) selectionHelper.visible = true;
    if (gridHelper) gridHelper.visible = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(oldW, oldH, false);
    camera.aspect = oldAspect;
    camera.updateProjectionMatrix();
    return url;
  }

  function photo() {
    const url = renderPhotoData();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rumahku-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Foto HD 1920×1080 diunduh — gratis, tanpa watermark');
  }

  // ---------------------------------------------------------------- events
  $('#cats').addEventListener('click', function (e) {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    activeCat = b.dataset.cat;
    renderChips();
    renderCatalog();
  });

  $('#search').addEventListener('input', renderCatalog);

  $('#items').addEventListener('click', function (e) {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    begin();
    const rec = addItem(b.dataset.key);
    commit();
    if (rec) toast(defOf(rec).name + ' ditambahkan — geser untuk atur');
    if (window.matchMedia('(max-width: 900px)').matches) closeSheet('catalog');
  });

  $('#item-colors').addEventListener('click', function (e) {
    const b = e.target.closest('[data-color]');
    if (!b || !state.selectedId) return;
    const rec = getItem(state.selectedId);
    begin();
    rec.color = parseInt(b.dataset.color, 10);
    const old = meshOf(rec.id);
    if (old) itemsGroup.remove(old);
    const mesh = buildMesh(rec);
    if (mesh) itemsGroup.add(mesh);
    updateSelectionHelper();
    commit();
    syncItemPanel();
  });

  ['rot', 'scale', 'height'].forEach(function (key) {
    const el = $('#' + key);
    el.addEventListener('pointerdown', begin);
    el.addEventListener('input', function () {
      if (!state.selectedId) return;
      const rec = getItem(state.selectedId);
      if (!rec) return;
      if (key === 'rot') rec.rot = parseFloat(el.value) * Math.PI / 180;
      if (key === 'scale') rec.scale = parseFloat(el.value) / 100;
      if (key === 'height') rec.y = parseFloat(el.value) / 100;
      const def = defOf(rec);
      if (key === 'scale' && !def.wall) clampItem(rec);
      const mesh = meshOf(rec.id);
      if (mesh) {
        mesh.rotation.y = rec.rot;
        mesh.scale.setScalar(rec.scale);
        mesh.position.set(rec.x, rec.y, rec.z);
      }
      if (key === 'rot') $('#rot-val').textContent = Math.round(parseFloat(el.value)) + '°';
      if (key === 'scale') $('#scale-val').textContent = el.value + '%';
      if (key === 'height') $('#height-val').textContent = (parseFloat(el.value) / 100).toFixed(2) + ' m';
      updateSelectionHelper();
      evaluateGoals();
    });
    el.addEventListener('change', commit);
  });

  $('#btn-duplicate').addEventListener('click', function () {
    const rec = state.selectedId ? getItem(state.selectedId) : null;
    if (!rec) return;
    begin();
    const copy = JSON.parse(JSON.stringify(rec));
    copy.id = 'i' + (state.nextId++);
    copy.x += 0.45; copy.z += 0.45;
    if (defOf(copy).wall) snapWall(copy); else clampItem(copy);
    state.items.push(copy);
    const mesh = buildMesh(copy);
    if (mesh) itemsGroup.add(mesh);
    select(copy.id);
    commit();
    evaluateGoals();
    toast('Item diduplikat');
  });

  $('#btn-delete').addEventListener('click', function () {
    const id = state.selectedId;
    if (!id) return;
    begin();
    state.items = state.items.filter(function (i) { return i.id !== id; });
    const mesh = meshOf(id);
    if (mesh) { itemsGroup.remove(mesh); }
    state.selectedId = null;
    updateSelectionHelper();
    syncItemPanel();
    commit();
    evaluateGoals();
    toast('Item dihapus — Ctrl+Z untuk kembalikan');
  });

  $('#room-w').addEventListener('input', function () { $('#w-val').textContent = parseFloat(this.value).toFixed(1) + ' m'; });
  $('#room-d').addEventListener('input', function () { $('#d-val').textContent = parseFloat(this.value).toFixed(1) + ' m'; });
  ['room-w', 'room-d'].forEach(function (id) {
    const el = $('#' + id);
    el.addEventListener('pointerdown', begin);
    el.addEventListener('change', function () {
      state.room.w = parseFloat($('#room-w').value);
      state.room.d = parseFloat($('#room-d').value);
      state.items.forEach(clampItem);
      buildRoom();
      rebuildItems();
      commit();
      fitCamera();
    });
  });

  $('#wall-colors').addEventListener('click', function (e) {
    const b = e.target.closest('[data-wall]');
    if (!b) return;
    begin();
    state.room.wall = b.dataset.wall;
    state.room.outdoor = false;
    buildRoom();
    renderWallColors();
    $('#outdoor').checked = false;
    commit();
  });

  $('#floors').addEventListener('click', function (e) {
    const b = e.target.closest('[data-floor]');
    if (!b) return;
    begin();
    state.room.floor = b.dataset.floor;
    state.room.outdoor = b.dataset.floor === 'grass';
    buildRoom();
    renderFloors();
    $('#outdoor').checked = state.room.outdoor;
    commit();
  });

  $('#outdoor').addEventListener('change', function () {
    begin();
    state.room.outdoor = this.checked;
    if (this.checked) state.room.floor = 'grass';
    buildRoom();
    renderFloors();
    commit();
  });

  $('#btn-clear').addEventListener('click', function () {
    if (!state.items.length) return;
    begin();
    state.items = [];
    state.selectedId = null;
    rebuildItems();
    syncItemPanel();
    commit();
    toast('Ruangan dikosongkan — Ctrl+Z untuk kembalikan');
  });

  $('#btn-photo').addEventListener('click', photo);
  $('#btn-save').addEventListener('click', function () { saveNow(false); });
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-grid').addEventListener('click', function () {
    state.grid = !state.grid;
    buildRoom();
    toast(state.grid ? 'Grid aktif' : 'Grid disembunyikan');
  });

  $$('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.mode = b.dataset.mode;
      $$('.mode-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      if (state.mode === 'template') openModal('template');
      else if (state.mode === 'challenge') openModal('challenge');
      else { closeModal(); toast('Mode desain bebas: semua aset terbuka'); }
    });
  });

  $('#modal-list').addEventListener('click', function (e) {
    const t = e.target.closest('[data-template]');
    const c = e.target.closest('[data-challenge]');
    if (t) {
      const tpl = TEMPLATES.filter(function (x) { return x.key === t.dataset.template; })[0];
      if (tpl) applyTemplate(tpl);
    } else if (c) {
      const ch = CHALLENGES.filter(function (x) { return x.key === c.dataset.challenge; })[0];
      if (ch) startChallenge(ch);
    }
  });
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  $('#btn-open-challenges').addEventListener('click', function () { openModal('challenge'); });

  $$('.side-tab').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });

  $$('.mobile-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.open === 'catalog') openSheet('catalog');
      else { activeTab = b.dataset.tab || 'item'; setTab(activeTab); openSheet('side'); }
    });
  });

  $$('.sheet-close').forEach(function (b) {
    b.addEventListener('click', function () { closeSheet(b.dataset.close); });
  });

  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#hint-close').addEventListener('click', hideHint);
  $('#hint').addEventListener('click', function (e) { if (e.target.id === 'hint') hideHint(); });

  window.addEventListener('keydown', function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(false); return; }
    if (!meta && e.key.toLowerCase() === 't') { toggleTheme(); return; }
    if (!state.selectedId) return;
    const rec = getItem(state.selectedId);
    if (!rec) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#btn-delete').click(); }
    else if (e.key.toLowerCase() === 'r') {
      begin(); rec.rot = (rec.rot || 0) + Math.PI / 8;
      const mesh = meshOf(rec.id); if (mesh) mesh.rotation.y = rec.rot;
      commit(); syncItemPanel(); updateSelectionHelper();
    } else if (e.key.toLowerCase() === 'd') { $('#btn-duplicate').click(); }
    else if (e.key === 'Escape') { select(null); closeSheet('catalog'); closeSheet('side'); closeModal(); }
  });

  // ---------------------------------------------------------------- loop
  function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    if (selectionHelper) selectionHelper.setFromObject(meshOf(state.selectedId) || new THREE.Object3D());
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    resize();
    const loaded = loadSaved();
    if (!loaded) {
      state.room = JSON.parse(JSON.stringify(TEMPLATES[0].room));
      state.items = TEMPLATES[0].items.map(function (it) {
        const def = K.byKey[it.key];
        const rec = {
          id: 'i' + (state.nextId++), key: it.key, x: it.x, z: it.z,
          rot: it.rot || 0, color: it.color || 0, scale: 1, y: it.y || 0
        };
        if (def.wall && !rec.y) rec.y = def.wallY || 1.5;
        return rec;
      });
    }
    renderChips();
    buildRoom();
    rebuildItems();
    fitCamera();
    applyTheme(theme, false);
    syncUI();
    updateUndoUI();
    animate();
    setTimeout(function () { if (!loaded) toast('Contoh kamar dimuat — semua item bisa diubah'); }, 900);
    setTimeout(hideHint, window.matchMedia('(max-width: 900px)').matches ? 7000 : 14000);
  }

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

  // API untuk pengujian otomatis / console
  window.RUMAHKU = {
    state: state,
    cam: cam,
    camera: camera,
    renderer: renderer,
    fitCamera: fitCamera,
    addItem: function (key, opts) { begin(); const r = addItem(key, opts); commit(); return r; },
    remove: function (id) { begin(); state.items = state.items.filter(function (i) { return i.id !== id; }); rebuildItems(); commit(); },
    select: select,
    undo: undo, redo: redo,
    template: function (k) { const t = TEMPLATES.filter(function (x) { return x.key === k; })[0]; if (t) applyTemplate(t); },
    challenge: function (k) { const c = CHALLENGES.filter(function (x) { return x.key === k; })[0]; if (c) startChallenge(c); },
    setRoom: function (w, d, wall, floor, outdoor) {
      begin();
      state.room = { w: w, d: d, wall: wall || state.room.wall, floor: floor || state.room.floor, outdoor: !!outdoor };
      buildRoom(); rebuildItems(); fitCamera(); syncUI(); commit();
    },
    photo: photo,
    renderPhoto: renderPhotoData,
    setTheme: function (t) { applyTheme(t, false); },
    toggleTheme: toggleTheme,
    theme: function () { return theme; },
    save: function () { saveNow(true); },
    counts: function () { return { items: state.items.length, cat: K.items.length }; },
    goals: function () {
      const ch = CHALLENGES.filter(function (c) { return c.key === state.challenge; })[0];
      return ch ? ch.goals.map(function (g) { return { label: g.label, done: g.test(state.items) }; }) : [];
    },
    errors: window.__errors
  };

  boot();
})();
