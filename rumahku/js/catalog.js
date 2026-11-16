/* Rumahku — katalog aset prosedural.
   Semua furnitur dibangun dari geometri Three.js, jadi nol file model eksternal:
   app tetap ringan, jalan offline, dan tiap item bisa ganti warna tanpa download aset. */
(function () {
  'use strict';

  const N = {
    white: '#f4f1ea', cream: '#e9e0d1', wood: '#a9784f', woodDark: '#6d4830',
    dark: '#2c3237', metal: '#a9b2ba', fabric: '#d8d0c3', glass: '#c3dae3',
    leaf: '#4e7d4a', leafDark: '#3a6039', soil: '#5a4433', stone: '#cfcac2'
  };

  const matCache = new Map();
  function M(color, o) {
    o = o || {};
    const rough = o.rough === undefined ? 0.72 : o.rough;
    const metal = o.metal === undefined ? 0 : o.metal;
    const op = o.opacity === undefined ? 1 : o.opacity;
    const em = o.emissive || '';
    const key = color + '|' + rough + '|' + metal + '|' + op + '|' + em;
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), roughness: rough, metalness: metal,
      transparent: op < 1, opacity: op
    });
    if (em) { m.emissive = new THREE.Color(em); m.emissiveIntensity = o.emissiveIntensity || 0.6; }
    if (op < 1) m.depthWrite = false;
    matCache.set(key, m);
    return m;
  }

  function tint(hex, amt) {
    const c = new THREE.Color(hex);
    const t = new THREE.Color(amt > 0 ? '#ffffff' : '#000000');
    c.lerp(t, Math.abs(amt));
    return '#' + c.getHexString();
  }

  function B(p, w, h, d, color, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, o));
    mesh.position.set(x || 0, y || 0, z || 0);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.noShadow ? false : true;
    mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }

  function C(p, rt, rb, h, color, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 18), M(color, o));
    mesh.position.set(x || 0, y || 0, z || 0);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = true; mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }

  function S(p, r, color, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg || 16, o.seg2 || 12), M(color, o));
    mesh.position.set(x || 0, y || 0, z || 0);
    if (o.sy) mesh.scale.y = o.sy;
    if (o.sx) mesh.scale.x = o.sx;
    mesh.castShadow = true; mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }

  function Cone(p, r, h, color, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg || 10), M(color, o));
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }

  function Ring(p, r, tube, color, x, y, z, o) {
    o = o || {};
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, o.seg || 26), M(color, o));
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.rotation.x = o.rx === undefined ? Math.PI / 2 : o.rx;
    mesh.castShadow = true; mesh.receiveShadow = true;
    p.add(mesh);
    return mesh;
  }

  // ---------- helper komposit ----------
  function legs(p, w, d, h, color, inset) {
    inset = inset === undefined ? 0.08 : inset;
    const xs = [-w / 2 + inset, w / 2 - inset];
    const zs = [-d / 2 + inset, d / 2 - inset];
    xs.forEach(function (x) { zs.forEach(function (z) { C(p, 0.03, 0.025, h, color, x, h / 2, z, { seg: 8 }); }); });
  }

  function cushion(p, w, h, d, color, x, y, z) {
    const m = B(p, w, h, d, color, x, y, z, { rough: 0.95 });
    m.geometry = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    return m;
  }

  function frame(p, w, h, d, color, x, y, z) {
    // bingkai kayu + isi (untuk lukisan/cermin)
    const t = 0.035;
    B(p, w, h, d, color, x, y, z);
    B(p, w - t * 2, h - t * 2, d * 0.6, tint(color, 0.35), x, y, z + d * 0.35, { rough: 0.6 });
    return p;
  }

  function pottedPlant(p, c, scale) {
    scale = scale || 1;
    C(p, 0.16 * scale, 0.13 * scale, 0.26 * scale, N.stone, 0, 0.13 * scale, 0, { rough: 0.9 });
    C(p, 0.14 * scale, 0.14 * scale, 0.03 * scale, N.soil, 0, 0.26 * scale, 0, {});
    C(p, 0.015 * scale, 0.02 * scale, 0.5 * scale, N.leafDark, 0, 0.5 * scale, 0, { seg: 6 });
    S(p, 0.2 * scale, N.leaf, 0, 0.68 * scale, 0, { sy: 0.75 });
    S(p, 0.14 * scale, N.leafDark, 0.12 * scale, 0.55 * scale, 0.05 * scale, { sy: 0.8 });
    S(p, 0.12 * scale, N.leaf, -0.1 * scale, 0.58 * scale, -0.08 * scale, { sy: 0.85 });
  }

  function tree(p, c, scale) {
    scale = scale || 1;
    C(p, 0.11 * scale, 0.16 * scale, 1.5 * scale, N.woodDark, 0, 0.75 * scale, 0, { seg: 8 });
    C(p, 0.07 * scale, 0.09 * scale, 0.7 * scale, N.woodDark, 0.16 * scale, 1.3 * scale, 0, { seg: 6, rz: -0.5 });
    Cone(p, 0.95 * scale, 1.5 * scale, tint(c, -0.05), 0, 2.1 * scale, 0, { seg: 12 });
    Cone(p, 0.78 * scale, 1.3 * scale, c, 0, 2.75 * scale, 0, { seg: 12 });
    Cone(p, 0.58 * scale, 1.05 * scale, tint(c, 0.12), 0, 3.35 * scale, 0, { seg: 12 });
  }

  function seat(p, w, d, c, backH) {
    backH = backH === undefined ? 0.55 : backH;
    B(p, w, 0.16, d, tint(c, -0.05), 0, 0.36, 0, { rough: 0.95 });
    cushion(p, w - 0.08, 0.14, d - 0.12, c, 0, 0.5, 0.02);
    B(p, w, backH, 0.16, c, 0, 0.36 + backH / 2, -d / 2 + 0.08, { rough: 0.95 });
  }

  // ---------- definisi katalog ----------
  const ITEMS = [
    // ============ KAMAR TIDUR ============
    {
      key: 'bed_single', name: 'Tempat Tidur Single', cat: 'kamar', size: [1.05, 2.05], wall: false,
      palette: ['#c8a279', '#9c9c9c', '#e6e1d6', '#7b5b43'],
      build: function (p, c) {
        B(p, 1.05, 0.28, 2.05, tint(c, -0.1), 0, 0.22, 0);
        legs(p, 1.05, 2.05, 0.2, N.woodDark, 0.07);
        B(p, 1.05, 1.0, 0.1, c, 0, 0.62, -1.0, { rough: 0.8 });
        B(p, 0.95, 0.22, 1.9, N.white, 0, 0.47, 0.02, { rough: 0.95 });
        B(p, 0.95, 0.08, 1.1, tint(c, 0.22), 0, 0.6, 0.34, { rough: 0.98 });
        B(p, 0.62, 0.13, 0.34, N.white, 0, 0.63, -0.78, { rough: 0.95, ry: 0.05 });
      }
    },
    {
      key: 'bed_queen', name: 'Tempat Tidur Queen', cat: 'kamar', size: [1.75, 2.15], wall: false,
      palette: ['#c8a279', '#8f9aa3', '#efe9dd', '#6f4a33'],
      build: function (p, c) {
        B(p, 1.75, 0.3, 2.15, tint(c, -0.08), 0, 0.23, 0);
        legs(p, 1.75, 2.15, 0.2, N.woodDark, 0.09);
        B(p, 1.75, 1.15, 0.12, c, 0, 0.7, -1.04, { rough: 0.82 });
        B(p, 1.6, 0.24, 2.0, N.white, 0, 0.5, 0.02, { rough: 0.95 });
        B(p, 1.62, 0.09, 1.25, tint(c, 0.24), 0, 0.64, 0.35, { rough: 0.98 });
        B(p, 0.66, 0.14, 0.36, N.white, -0.4, 0.66, -0.8, { rough: 0.95, ry: 0.06 });
        B(p, 0.66, 0.14, 0.36, N.white, 0.4, 0.66, -0.8, { rough: 0.95, ry: -0.06 });
        B(p, 1.2, 0.06, 0.7, tint(c, 0.32), 0, 0.66, 0.6, { rough: 0.98 });
      }
    },
    {
      key: 'bed_king', name: 'Tempat Tidur King', cat: 'kamar', size: [2.05, 2.2], wall: false,
      palette: ['#b9a48c', '#5d6b74', '#efe9dd', '#8a6a4f'],
      build: function (p, c) {
        B(p, 2.05, 0.32, 2.2, tint(c, -0.12), 0, 0.24, 0);
        legs(p, 2.05, 2.2, 0.2, N.woodDark, 0.1);
        // headboard berpanel
        for (let i = -1; i <= 1; i++) {
          B(p, 0.6, 1.3, 0.14, tint(c, i === 0 ? 0.06 : -0.04), i * 0.63, 0.78, -1.07, { rough: 0.9 });
        }
        B(p, 1.9, 0.26, 2.05, N.white, 0, 0.52, 0.02, { rough: 0.95 });
        B(p, 1.92, 0.1, 1.35, tint(c, 0.26), 0, 0.67, 0.3, { rough: 0.98 });
        [-0.5, 0, 0.5].forEach(function (x) {
          B(p, 0.6, 0.15, 0.36, N.white, x, 0.69, -0.82, { rough: 0.95 });
        });
        B(p, 1.5, 0.07, 0.8, tint(c, 0.34), 0, 0.7, 0.62, { rough: 0.98 });
      }
    },
    {
      key: 'nightstand', name: 'Nakas Laci', cat: 'kamar', size: [0.5, 0.45], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 0.5, 0.5, 0.45, c, 0, 0.32, 0);
        legs(p, 0.5, 0.45, 0.12, N.woodDark, 0.05);
        B(p, 0.42, 0.03, 0.02, tint(c, -0.35), 0, 0.4, 0.23, { metal: 0.6, rough: 0.35 });
        B(p, 0.42, 0.03, 0.02, tint(c, -0.35), 0, 0.26, 0.23, { metal: 0.6, rough: 0.35 });
      }
    },
    {
      key: 'wardrobe', name: 'Lemari Pakaian', cat: 'kamar', size: [1.6, 0.62], wall: false,
      palette: ['#cbb8a1', '#f2efe8', '#5b4632', '#8c9aa3'],
      build: function (p, c) {
        B(p, 1.6, 2.1, 0.62, c, 0, 1.05, 0);
        legs(p, 1.6, 0.62, 0.1, N.woodDark, 0.06);
        B(p, 0.02, 1.95, 0.02, tint(c, -0.3), 0, 1.1, 0.32);
        [-0.42, 0.42].forEach(function (x) {
          B(p, 0.03, 0.34, 0.03, N.metal, x, 1.1, 0.34, { metal: 0.8, rough: 0.25 });
        });
        B(p, 0.72, 0.05, 0.02, tint(c, -0.18), -0.4, 1.95, 0.32);
        B(p, 0.72, 0.05, 0.02, tint(c, -0.18), 0.4, 1.95, 0.32);
      }
    },
    {
      key: 'dresser', name: 'Meja Rias + Cermin', cat: 'kamar', size: [1.15, 0.5], wall: true, wallY: 1.55,
      palette: ['#d6c3ad', '#f3efe7', '#7b5b43', '#9aa6ad'],
      build: function (p, c) {
        B(p, 1.15, 0.05, 0.5, tint(c, 0.05), 0, 0.76, 0);
        B(p, 0.5, 0.55, 0.45, c, -0.3, 0.48, 0);
        B(p, 0.5, 0.55, 0.45, c, 0.3, 0.48, 0);
        legs(p, 1.15, 0.5, 0.2, N.woodDark, 0.06);
        B(p, 0.9, 0.75, 0.04, tint(c, -0.25), 0, 1.2, -0.2);
        B(p, 0.78, 0.63, 0.02, N.glass, 0, 1.2, -0.17, { rough: 0.1, metal: 0.3, opacity: 0.55 });
        B(p, 0.16, 0.22, 0.16, N.white, -0.36, 0.9, 0.06, { rough: 0.6 });
      }
    },
    {
      key: 'desk', name: 'Meja Belajar', cat: 'kamar', size: [1.2, 0.6], wall: false,
      palette: ['#c8a279', '#f1ede5', '#3b4248', '#8d6b4e'],
      build: function (p, c) {
        B(p, 1.2, 0.05, 0.6, c, 0, 0.75, 0);
        legs(p, 1.2, 0.6, 0.72, N.woodDark, 0.06);
        B(p, 0.4, 0.45, 0.55, tint(c, 0.1), 0.35, 0.5, 0);
        B(p, 0.36, 0.02, 0.02, tint(c, -0.3), 0.35, 0.5, 0.29);
        B(p, 0.5, 0.02, 0.34, N.dark, -0.2, 0.79, 0, { metal: 0.4, rough: 0.4 });
        B(p, 0.5, 0.32, 0.02, N.dark, -0.2, 0.95, -0.16, { metal: 0.4, rough: 0.35 });
        C(p, 0.09, 0.09, 0.02, N.metal, 0.22, 0.79, 0.12, { metal: 0.7, rough: 0.3 });
      }
    },
    {
      key: 'chair', name: 'Kursi Kayu', cat: 'kamar', size: [0.48, 0.5], wall: false,
      palette: ['#c8a279', '#f1ede5', '#3b4248', '#8d6b4e'],
      build: function (p, c) {
        B(p, 0.46, 0.05, 0.46, c, 0, 0.45, 0);
        legs(p, 0.46, 0.46, 0.45, N.woodDark, 0.05);
        B(p, 0.46, 0.5, 0.05, c, 0, 0.7, -0.2);
        B(p, 0.05, 0.28, 0.05, c, -0.2, 0.58, -0.2);
        B(p, 0.05, 0.28, 0.05, c, 0.2, 0.58, -0.2);
      }
    },
    {
      key: 'bookshelf', name: 'Rak Buku', cat: 'kamar', size: [0.9, 0.35], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 0.9, 1.8, 0.35, c, 0, 0.9, 0);
        B(p, 0.82, 1.68, 0.3, tint(c, -0.42), 0, 0.9, 0.02);
        for (let i = 0; i < 4; i++) {
          B(p, 0.82, 0.04, 0.3, c, 0, 0.28 + i * 0.42, 0.02);
          for (let j = 0; j < 5; j++) {
            if (Math.random() < 0.25) continue;
            const col = ['#b45309', '#0f766e', '#7c3aed', '#be123c', '#1d4ed8', '#a16207'][(i * 5 + j) % 6];
            B(p, 0.09, 0.26, 0.2, col, -0.32 + j * 0.14, 0.44 + i * 0.42, 0.04, { rough: 0.85 });
          }
        }
      }
    },

    // ============ RUANG TAMU ============
    {
      key: 'sofa3', name: 'Sofa 3 Dudukan', cat: 'tamu', size: [2.15, 0.92], wall: false,
      palette: ['#8d9aa3', '#c9b7a4', '#4b5563', '#a3b18a'],
      build: function (p, c) {
        B(p, 2.15, 0.3, 0.92, tint(c, -0.2), 0, 0.22, 0);
        legs(p, 2.15, 0.92, 0.14, N.woodDark, 0.1);
        B(p, 2.15, 0.55, 0.18, c, 0, 0.62, -0.37, { rough: 0.95 });
        B(p, 0.18, 0.45, 0.92, c, -0.99, 0.5, 0, { rough: 0.95 });
        B(p, 0.18, 0.45, 0.92, c, 0.99, 0.5, 0, { rough: 0.95 });
        for (let i = -1; i <= 1; i++) cushion(p, 0.6, 0.16, 0.72, tint(c, 0.05), i * 0.63, 0.46, 0.05);
        cushion(p, 0.42, 0.3, 0.14, tint(c, 0.18), -0.6, 0.62, -0.2);
        cushion(p, 0.42, 0.3, 0.14, tint(c, 0.12), 0.6, 0.62, -0.2);
      }
    },
    {
      key: 'sofa2', name: 'Sofa 2 Dudukan', cat: 'tamu', size: [1.55, 0.9], wall: false,
      palette: ['#8d9aa3', '#c9b7a4', '#4b5563', '#a3b18a'],
      build: function (p, c) {
        B(p, 1.55, 0.3, 0.9, tint(c, -0.2), 0, 0.22, 0);
        legs(p, 1.55, 0.9, 0.14, N.woodDark, 0.1);
        B(p, 1.55, 0.55, 0.18, c, 0, 0.62, -0.36, { rough: 0.95 });
        B(p, 0.18, 0.45, 0.9, c, -0.69, 0.5, 0, { rough: 0.95 });
        B(p, 0.18, 0.45, 0.9, c, 0.69, 0.5, 0, { rough: 0.95 });
        cushion(p, 0.58, 0.16, 0.7, tint(c, 0.05), -0.3, 0.46, 0.05);
        cushion(p, 0.58, 0.16, 0.7, tint(c, 0.05), 0.3, 0.46, 0.05);
      }
    },
    {
      key: 'armchair', name: 'Kursi Malas', cat: 'tamu', size: [0.92, 0.92], wall: false,
      palette: ['#b45309', '#8d9aa3', '#4b5563', '#a3b18a'],
      build: function (p, c) {
        B(p, 0.9, 0.3, 0.9, tint(c, -0.2), 0, 0.24, 0);
        legs(p, 0.9, 0.9, 0.16, N.woodDark, 0.1);
        B(p, 0.9, 0.62, 0.18, c, 0, 0.66, -0.36, { rough: 0.95 });
        B(p, 0.16, 0.42, 0.9, c, -0.37, 0.52, 0, { rough: 0.95 });
        B(p, 0.16, 0.42, 0.9, c, 0.37, 0.52, 0, { rough: 0.95 });
        cushion(p, 0.62, 0.16, 0.7, tint(c, 0.06), 0, 0.46, 0.04);
      }
    },
    {
      key: 'coffee_table', name: 'Meja Kopi', cat: 'tamu', size: [1.1, 0.6], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 1.1, 0.06, 0.6, c, 0, 0.42, 0);
        legs(p, 1.1, 0.6, 0.4, N.woodDark, 0.07);
        B(p, 0.9, 0.04, 0.45, tint(c, -0.25), 0, 0.16, 0);
        B(p, 0.3, 0.04, 0.22, N.white, -0.2, 0.47, 0, { rough: 0.6 });
        C(p, 0.06, 0.05, 0.12, N.stone, 0.25, 0.51, 0.02);
      }
    },
    {
      key: 'tv_console', name: 'TV + Kabinet', cat: 'tamu', size: [1.8, 0.45], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 1.8, 0.5, 0.45, c, 0, 0.3, 0);
        legs(p, 1.8, 0.45, 0.1, N.woodDark, 0.07);
        B(p, 0.85, 0.04, 0.02, tint(c, -0.35), -0.45, 0.3, 0.23);
        B(p, 0.85, 0.04, 0.02, tint(c, -0.35), 0.45, 0.3, 0.23);
        B(p, 1.3, 0.75, 0.06, N.dark, 0, 1.0, 0.05);
        B(p, 1.22, 0.67, 0.01, '#101619', 0, 1.0, 0.09, { rough: 0.25, metal: 0.2 });
        C(p, 0.04, 0.04, 0.14, N.dark, 0, 0.6, 0.05, { seg: 8 });
        B(p, 0.2, 0.2, 0.2, N.dark, -0.3, 0.65, 0.02, { metal: 0.3, rough: 0.5 });
      }
    },
    {
      key: 'side_table', name: 'Meja Samping', cat: 'tamu', size: [0.45, 0.45], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        C(p, 0.22, 0.22, 0.04, c, 0, 0.5, 0);
        C(p, 0.04, 0.04, 0.5, N.woodDark, 0, 0.25, 0);
        C(p, 0.2, 0.2, 0.03, tint(c, -0.2), 0, 0.02, 0);
      }
    },
    {
      key: 'floor_lamp', name: 'Lampu Lantai', cat: 'dekor', size: [0.42, 0.42], wall: false,
      palette: ['#f5e6c8', '#e7d9bd', '#d9c7a5', '#f2f0ea'],
      build: function (p, c) {
        C(p, 0.16, 0.18, 0.03, N.dark, 0, 0.02, 0, { metal: 0.5, rough: 0.4 });
        C(p, 0.02, 0.02, 1.5, N.metal, 0, 0.77, 0, { metal: 0.8, rough: 0.3 });
        C(p, 0.2, 0.14, 0.26, c, 0, 1.55, 0, { rough: 0.9, emissive: '#ffe9b8', emissiveIntensity: 0.35 });
        S(p, 0.05, '#fff4d6', 0, 1.55, 0, { emissive: '#ffe9b8', emissiveIntensity: 1 });
      }
    },
    {
      key: 'table_lamp', name: 'Lampu Meja', cat: 'dekor', size: [0.3, 0.3], wall: false,
      palette: ['#f5e6c8', '#e7d9bd', '#d9c7a5', '#f2f0ea'],
      build: function (p, c) {
        C(p, 0.1, 0.12, 0.02, N.dark, 0, 0.01, 0, { metal: 0.5, rough: 0.4 });
        C(p, 0.015, 0.015, 0.34, N.metal, 0, 0.18, 0, { metal: 0.8, rough: 0.3 });
        C(p, 0.15, 0.11, 0.2, c, 0, 0.42, 0, { rough: 0.9, emissive: '#ffe9b8', emissiveIntensity: 0.4 });
      }
    },
    {
      key: 'rug_rect', name: 'Karpet Persegi', cat: 'dekor', size: [2.4, 1.7], wall: false, flat: true,
      palette: ['#cbb7a0', '#8d9aa3', '#b45309', '#4b5563'],
      build: function (p, c) {
        B(p, 2.4, 0.02, 1.7, c, 0, 0.011, 0, { rough: 1 });
        B(p, 2.2, 0.022, 1.5, tint(c, 0.18), 0, 0.012, 0, { rough: 1 });
        B(p, 2.0, 0.024, 1.3, tint(c, -0.05), 0, 0.013, 0, { rough: 1 });
      }
    },
    {
      key: 'rug_round', name: 'Karpet Bulat', cat: 'dekor', size: [1.9, 1.9], wall: false, flat: true,
      palette: ['#cbb7a0', '#8d9aa3', '#b45309', '#4b5563'],
      build: function (p, c) {
        C(p, 0.95, 0.95, 0.02, c, 0, 0.011, 0, { seg: 40, rough: 1 });
        C(p, 0.82, 0.82, 0.022, tint(c, 0.2), 0, 0.012, 0, { seg: 40, rough: 1 });
      }
    },
    {
      key: 'wall_art', name: 'Lukisan Dinding', cat: 'dekor', size: [0.9, 0.06], wall: true, wallY: 1.6,
      palette: ['#b45309', '#0f766e', '#1d4ed8', '#7c3aed'],
      build: function (p, c) {
        frame(p, 0.9, 0.66, 0.05, tint(c, -0.3), 0, 0, 0);
        B(p, 0.78, 0.54, 0.01, c, 0, 0, 0.032, { rough: 0.9 });
        S(p, 0.16, tint(c, 0.35), -0.14, 0.02, 0.04, { sy: 0.7 });
        B(p, 0.3, 0.12, 0.01, tint(c, -0.2), 0.12, -0.1, 0.042);
      }
    },
    {
      key: 'wall_clock', name: 'Jam Dinding', cat: 'dekor', size: [0.36, 0.06], wall: true, wallY: 1.9,
      palette: ['#2c3237', '#a9784f', '#f0ece4', '#0f766e'],
      build: function (p, c) {
        C(p, 0.18, 0.18, 0.04, c, 0, 0, 0, { rx: Math.PI / 2, seg: 28 });
        C(p, 0.15, 0.15, 0.045, N.white, 0, 0, 0.005, { rx: Math.PI / 2, seg: 28, rough: 0.5 });
        B(p, 0.012, 0.1, 0.01, N.dark, 0, 0.03, 0.03);
        B(p, 0.07, 0.012, 0.01, N.dark, 0.03, 0, 0.03);
      }
    },
    {
      key: 'mirror', name: 'Cermin Dinding', cat: 'dekor', size: [0.8, 0.06], wall: true, wallY: 1.55,
      palette: ['#a9784f', '#2c3237', '#f0ece4', '#c8b49a'],
      build: function (p, c) {
        frame(p, 0.8, 1.15, 0.05, c, 0, 0, 0);
        B(p, 0.68, 1.03, 0.01, N.glass, 0, 0, 0.034, { rough: 0.08, metal: 0.9 });
      }
    },
    {
      key: 'plant_pot', name: 'Tanaman Pot', cat: 'dekor', size: [0.55, 0.55], wall: false,
      palette: ['#4e7d4a', '#6b8f5e', '#3a6039', '#7a9a52'],
      build: function (p, c) { pottedPlant(p, c, 1); }
    },
    {
      key: 'plant_tall', name: 'Tanaman Tinggi', cat: 'dekor', size: [0.7, 0.7], wall: false,
      palette: ['#4e7d4a', '#6b8f5e', '#3a6039', '#7a9a52'],
      build: function (p, c) {
        C(p, 0.2, 0.16, 0.4, N.stone, 0, 0.2, 0, { rough: 0.9 });
        C(p, 0.03, 0.04, 1.1, N.woodDark, 0, 0.95, 0, { seg: 7 });
        S(p, 0.42, c, 0, 1.6, 0, { sy: 0.85 });
        S(p, 0.3, tint(c, -0.12), 0.26, 1.32, 0.1, { sy: 0.9 });
        S(p, 0.26, tint(c, 0.1), -0.24, 1.4, -0.08, { sy: 0.9 });
        S(p, 0.2, tint(c, -0.05), 0.05, 1.95, 0.12, { sy: 0.9 });
      }
    },
    {
      key: 'curtain', name: 'Tirai Jendela', cat: 'dekor', size: [1.6, 0.2], wall: true, wallY: 1.55,
      palette: ['#e8dfd1', '#8d9aa3', '#cbb7a0', '#4b5563'],
      build: function (p, c) {
        C(p, 0.02, 0.02, 1.7, N.metal, 0, 0.85, 0, { rz: Math.PI / 2, metal: 0.8, rough: 0.3 });
        for (let i = 0; i < 7; i++) {
          const x = -0.7 + i * 0.235;
          B(p, 0.2, 1.6, 0.06, tint(c, i % 2 ? 0.05 : -0.05), x, 0, 0.04, { rough: 1 });
        }
      }
    },
    {
      key: 'room_divider', name: 'Partisi Ruangan', cat: 'dekor', size: [1.2, 0.25], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 1.2, 0.05, 0.25, tint(c, -0.1), 0, 0.02, 0);
        B(p, 1.2, 0.05, 0.25, c, 0, 1.75, 0);
        for (let i = 0; i < 6; i++) {
          B(p, 0.06, 1.7, 0.06, c, -0.5 + i * 0.2, 0.88, 0);
        }
      }
    },

    // ============ DAPUR & MAKAN ============
    {
      key: 'kitchen_island', name: 'Kitchen Island', cat: 'dapur', size: [1.9, 0.95], wall: false,
      palette: ['#e6e1d6', '#8d9aa3', '#3a4147', '#a9784f'],
      build: function (p, c) {
        B(p, 1.9, 0.88, 0.95, c, 0, 0.44, 0);
        B(p, 1.98, 0.06, 1.02, N.stone, 0, 0.91, 0, { rough: 0.35 });
        B(p, 0.8, 0.03, 0.02, tint(c, -0.3), -0.45, 0.6, 0.48, { metal: 0.6, rough: 0.3 });
        B(p, 0.8, 0.03, 0.02, tint(c, -0.3), 0.45, 0.6, 0.48, { metal: 0.6, rough: 0.3 });
        B(p, 0.42, 0.16, 0.34, N.metal, -0.3, 0.99, 0, { metal: 0.7, rough: 0.3 });
        C(p, 0.02, 0.02, 0.22, N.metal, -0.3, 1.14, -0.06, { metal: 0.9, rough: 0.2 });
      }
    },
    {
      key: 'cabinet_base', name: 'Kabinet Bawah', cat: 'dapur', size: [1.2, 0.62], wall: false,
      palette: ['#e6e1d6', '#8d9aa3', '#3a4147', '#a9784f'],
      build: function (p, c) {
        B(p, 1.2, 0.85, 0.62, c, 0, 0.44, 0);
        B(p, 1.26, 0.05, 0.68, N.stone, 0, 0.89, 0, { rough: 0.35 });
        for (let i = -1; i <= 1; i++) {
          B(p, 0.34, 0.6, 0.02, tint(c, 0.06), i * 0.38, 0.48, 0.31);
          B(p, 0.14, 0.02, 0.03, N.metal, i * 0.38, 0.72, 0.34, { metal: 0.8, rough: 0.25 });
        }
      }
    },
    {
      key: 'cabinet_wall', name: 'Kabinet Dinding', cat: 'dapur', size: [1.2, 0.35], wall: true, wallY: 1.85,
      palette: ['#e6e1d6', '#8d9aa3', '#3a4147', '#a9784f'],
      build: function (p, c) {
        B(p, 1.2, 0.7, 0.35, c, 0, 0, 0);
        for (let i = -1; i <= 1; i++) {
          B(p, 0.34, 0.58, 0.02, tint(c, 0.06), i * 0.38, 0, 0.18);
          B(p, 0.12, 0.02, 0.03, N.metal, i * 0.38, -0.22, 0.2, { metal: 0.8, rough: 0.25 });
        }
      }
    },
    {
      key: 'fridge', name: 'Kulkas', cat: 'dapur', size: [0.75, 0.72], wall: false,
      palette: ['#dfe3e6', '#3a4147', '#c9c2b4', '#8d9aa3'],
      build: function (p, c) {
        B(p, 0.75, 1.85, 0.72, c, 0, 0.93, 0, { metal: 0.25, rough: 0.4 });
        B(p, 0.73, 0.02, 0.02, tint(c, -0.25), 0, 1.18, 0.36);
        B(p, 0.03, 0.5, 0.03, N.metal, 0.28, 1.45, 0.37, { metal: 0.8, rough: 0.2 });
        B(p, 0.03, 0.35, 0.03, N.metal, 0.28, 0.85, 0.37, { metal: 0.8, rough: 0.2 });
      }
    },
    {
      key: 'stove', name: 'Kompor + Oven', cat: 'dapur', size: [0.65, 0.62], wall: false,
      palette: ['#dfe3e6', '#3a4147', '#c9c2b4', '#8d9aa3'],
      build: function (p, c) {
        B(p, 0.65, 0.85, 0.62, c, 0, 0.44, 0);
        B(p, 0.65, 0.04, 0.62, N.dark, 0, 0.88, 0, { metal: 0.4, rough: 0.35 });
        for (let i = -1; i <= 1; i += 2) {
          for (let j = -1; j <= 1; j += 2) {
            C(p, 0.09, 0.09, 0.02, N.dark, i * 0.16, 0.91, j * 0.15, { metal: 0.6, rough: 0.3 });
          }
        }
        B(p, 0.55, 0.42, 0.02, N.dark, 0, 0.5, 0.31, { metal: 0.5, rough: 0.3 });
        B(p, 0.4, 0.02, 0.03, N.metal, 0, 0.7, 0.34, { metal: 0.9, rough: 0.2 });
        for (let i = 0; i < 3; i++) C(p, 0.03, 0.03, 0.03, N.metal, -0.2 + i * 0.2, 0.79, 0.33, { rx: Math.PI / 2, metal: 0.8, rough: 0.2 });
      }
    },
    {
      key: 'sink', name: 'Wastafel Dapur', cat: 'dapur', size: [0.9, 0.62], wall: false,
      palette: ['#dfe3e6', '#8d9aa3', '#c9c2b4', '#3a4147'],
      build: function (p, c) {
        B(p, 0.9, 0.82, 0.62, c, 0, 0.42, 0);
        B(p, 0.94, 0.05, 0.66, N.stone, 0, 0.86, 0, { rough: 0.35 });
        B(p, 0.6, 0.14, 0.4, N.metal, 0, 0.8, 0.02, { metal: 0.8, rough: 0.25 });
        C(p, 0.02, 0.02, 0.3, N.metal, 0, 1.0, -0.2, { metal: 0.9, rough: 0.15 });
        C(p, 0.02, 0.02, 0.16, N.metal, 0, 1.14, -0.12, { rx: Math.PI / 2, metal: 0.9, rough: 0.15 });
      }
    },
    {
      key: 'dining_table', name: 'Meja Makan', cat: 'dapur', size: [1.65, 0.95], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 1.65, 0.07, 0.95, c, 0, 0.74, 0);
        legs(p, 1.65, 0.95, 0.7, N.woodDark, 0.1);
        B(p, 0.32, 0.03, 0.24, N.white, -0.35, 0.79, 0, { rough: 0.6 });
        B(p, 0.32, 0.03, 0.24, N.white, 0.35, 0.79, 0, { rough: 0.6 });
        C(p, 0.05, 0.04, 0.14, N.stone, 0, 0.84, 0);
      }
    },
    {
      key: 'dining_chair', name: 'Kursi Makan', cat: 'dapur', size: [0.48, 0.5], wall: false,
      palette: ['#a9784f', '#f0ece4', '#3a4147', '#c8b49a'],
      build: function (p, c) {
        B(p, 0.46, 0.06, 0.46, c, 0, 0.45, 0);
        legs(p, 0.46, 0.46, 0.45, N.woodDark, 0.05);
        B(p, 0.46, 0.5, 0.05, c, 0, 0.7, -0.2);
        B(p, 0.38, 0.24, 0.02, tint(c, -0.12), 0, 0.72, -0.16);
      }
    },
    {
      key: 'bar_stool', name: 'Kursi Bar', cat: 'dapur', size: [0.42, 0.42], wall: false,
      palette: ['#3a4147', '#a9784f', '#c8b49a', '#f0ece4'],
      build: function (p, c) {
        C(p, 0.2, 0.2, 0.07, c, 0, 0.68, 0, { rough: 0.85 });
        C(p, 0.03, 0.03, 0.64, N.metal, 0, 0.35, 0, { metal: 0.8, rough: 0.3 });
        Ring(p, 0.16, 0.012, N.metal, 0, 0.22, 0, { metal: 0.8, rough: 0.3 });
        C(p, 0.18, 0.2, 0.03, N.metal, 0, 0.02, 0, { metal: 0.6, rough: 0.4 });
      }
    },

    // ============ KAMAR MANDI ============
    {
      key: 'bathtub', name: 'Bathtub', cat: 'mandi', size: [1.7, 0.8], wall: false,
      palette: ['#f4f1ea', '#c9c2b4', '#8d9aa3', '#2c3237'],
      build: function (p, c) {
        B(p, 1.7, 0.55, 0.8, c, 0, 0.28, 0, { rough: 0.35 });
        B(p, 1.5, 0.42, 0.62, tint(c, -0.06), 0, 0.38, 0, { rough: 0.35 });
        B(p, 1.38, 0.3, 0.5, '#dbe7ea', 0, 0.36, 0, { rough: 0.1, metal: 0.2, opacity: 0.75 });
        legs(p, 1.7, 0.8, 0.12, N.metal, 0.12);
        C(p, 0.02, 0.02, 0.3, N.metal, 0.78, 0.68, 0, { metal: 0.9, rough: 0.15 });
        C(p, 0.02, 0.02, 0.14, N.metal, 0.72, 0.82, 0, { rz: Math.PI / 2, metal: 0.9, rough: 0.15 });
      }
    },
    {
      key: 'shower', name: 'Shower + Kaca', cat: 'mandi', size: [0.95, 0.95], wall: false,
      palette: ['#dfe3e6', '#8d9aa3', '#c9c2b4', '#2c3237'],
      build: function (p, c) {
        B(p, 0.95, 0.06, 0.95, c, 0, 0.03, 0, { rough: 0.5 });
        B(p, 0.05, 2.0, 0.95, N.glass, 0.45, 1.05, 0, { rough: 0.05, metal: 0.4, opacity: 0.28 });
        B(p, 0.95, 2.0, 0.05, N.glass, 0, 1.05, -0.45, { rough: 0.05, metal: 0.4, opacity: 0.28 });
        C(p, 0.02, 0.02, 1.1, N.metal, -0.4, 1.55, -0.4, { metal: 0.9, rough: 0.15 });
        C(p, 0.1, 0.1, 0.03, N.metal, -0.3, 2.05, -0.4, { rz: Math.PI / 2, metal: 0.9, rough: 0.15 });
        C(p, 0.03, 0.03, 0.03, N.metal, -0.2, 1.0, -0.4, { rx: Math.PI / 2, metal: 0.9, rough: 0.2 });
      }
    },
    {
      key: 'toilet', name: 'Toilet', cat: 'mandi', size: [0.45, 0.7], wall: false,
      palette: ['#f4f1ea', '#dfe3e6', '#c9c2b4', '#2c3237'],
      build: function (p, c) {
        B(p, 0.4, 0.4, 0.5, c, 0, 0.2, 0.05, { rough: 0.3 });
        C(p, 0.19, 0.21, 0.14, c, 0, 0.46, 0.05, { seg: 22, rough: 0.3 });
        C(p, 0.2, 0.2, 0.02, tint(c, -0.05), 0, 0.54, 0.05, { seg: 22, rough: 0.3 });
        B(p, 0.42, 0.5, 0.18, c, 0, 0.42, -0.24, { rough: 0.3 });
        B(p, 0.42, 0.03, 0.2, tint(c, 0.1), 0, 0.69, -0.24, { rough: 0.3 });
      }
    },
    {
      key: 'vanity', name: 'Wastafel + Cermin', cat: 'mandi', size: [0.9, 0.55], wall: false,
      palette: ['#a9784f', '#f4f1ea', '#3a4147', '#c9c2b4'],
      build: function (p, c) {
        B(p, 0.9, 0.78, 0.55, c, 0, 0.4, 0);
        B(p, 0.94, 0.06, 0.6, N.stone, 0, 0.82, 0, { rough: 0.3 });
        C(p, 0.2, 0.16, 0.12, N.white, 0, 0.9, 0, { seg: 24, rough: 0.25 });
        C(p, 0.02, 0.02, 0.24, N.metal, 0, 1.0, -0.16, { metal: 0.9, rough: 0.15 });
        C(p, 0.02, 0.02, 0.12, N.metal, 0, 1.12, -0.1, { rx: Math.PI / 2, metal: 0.9, rough: 0.15 });
        B(p, 0.72, 0.85, 0.04, tint(c, -0.15), 0, 1.55, -0.24);
        B(p, 0.62, 0.75, 0.01, N.glass, 0, 1.55, -0.21, { rough: 0.05, metal: 0.9 });
      }
    },
    {
      key: 'towel_rack', name: 'Rak Handuk', cat: 'mandi', size: [0.6, 0.15], wall: true, wallY: 1.4,
      palette: ['#c9c2b4', '#a9784f', '#2c3237', '#f4f1ea'],
      build: function (p, c) {
        B(p, 0.6, 0.04, 0.04, c, 0, 0, 0, { metal: 0.7, rough: 0.3 });
        B(p, 0.22, 0.55, 0.06, '#e9e0d1', -0.16, -0.3, 0.02, { rough: 1 });
        B(p, 0.22, 0.45, 0.06, '#cfd8dc', 0.16, -0.26, 0.02, { rough: 1 });
      }
    },

    // ============ TAMAN ============
    {
      key: 'tree_big', name: 'Pohon Besar', cat: 'taman', size: [2.0, 2.0], wall: false,
      palette: ['#4e7d4a', '#5c8a4e', '#3a6039', '#7a9a52'],
      build: function (p, c) { tree(p, c, 1.15); }
    },
    {
      key: 'tree_small', name: 'Pohon Kecil', cat: 'taman', size: [1.2, 1.2], wall: false,
      palette: ['#4e7d4a', '#5c8a4e', '#3a6039', '#7a9a52'],
      build: function (p, c) { tree(p, c, 0.7); }
    },
    {
      key: 'bush', name: 'Semak', cat: 'taman', size: [0.9, 0.9], wall: false,
      palette: ['#4e7d4a', '#5c8a4e', '#3a6039', '#7a9a52'],
      build: function (p, c) {
        S(p, 0.34, c, 0, 0.3, 0, { sy: 0.85 });
        S(p, 0.26, tint(c, -0.08), 0.28, 0.24, 0.08, { sy: 0.85 });
        S(p, 0.24, tint(c, 0.1), -0.24, 0.22, -0.06, { sy: 0.85 });
      }
    },
    {
      key: 'planter', name: 'Planter Box', cat: 'taman', size: [1.2, 0.45], wall: false,
      palette: ['#a9784f', '#c9c2b4', '#3a4147', '#8d9aa3'],
      build: function (p, c) {
        B(p, 1.2, 0.4, 0.45, c, 0, 0.2, 0);
        B(p, 1.1, 0.04, 0.35, N.soil, 0, 0.41, 0);
        for (let i = -2; i <= 2; i++) {
          C(p, 0.012, 0.012, 0.4, N.leafDark, i * 0.22, 0.62, 0, { seg: 6 });
          S(p, 0.14, i % 2 ? N.leaf : tint(N.leaf, 0.12), i * 0.22, 0.85, 0, { sy: 0.8 });
        }
      }
    },
    {
      key: 'garden_bench', name: 'Bangku Taman', cat: 'taman', size: [1.5, 0.6], wall: false,
      palette: ['#a9784f', '#3a4147', '#c9c2b4', '#8d9aa3'],
      build: function (p, c) {
        B(p, 1.5, 0.06, 0.5, c, 0, 0.45, 0);
        for (let i = -1; i <= 1; i++) B(p, 1.5, 0.08, 0.12, tint(c, -0.06), 0, 0.6 + i * 0.13, -0.22, { rx: -0.08 });
        B(p, 0.06, 0.45, 0.5, N.metal, -0.6, 0.22, 0, { metal: 0.6, rough: 0.4 });
        B(p, 0.06, 0.45, 0.5, N.metal, 0.6, 0.22, 0, { metal: 0.6, rough: 0.4 });
      }
    },
    {
      key: 'garden_lamp', name: 'Lampu Taman', cat: 'taman', size: [0.28, 0.28], wall: false,
      palette: ['#2c3237', '#a9784f', '#c9c2b4', '#3a4147'],
      build: function (p, c) {
        C(p, 0.02, 0.02, 0.9, c, 0, 0.45, 0, { metal: 0.7, rough: 0.4 });
        C(p, 0.1, 0.06, 0.16, '#ffeec2', 0, 0.98, 0, { rough: 0.6, emissive: '#ffd98a', emissiveIntensity: 0.6 });
        Cone(p, 0.14, 0.1, c, 0, 1.1, 0, { seg: 12 });
      }
    },
    {
      key: 'stone_path', name: 'Batu Taman', cat: 'taman', size: [1.6, 0.7], wall: false, flat: true,
      palette: ['#cfcac2', '#a9b2ba', '#8d9aa3', '#6d4830'],
      build: function (p, c) {
        for (let i = 0; i < 4; i++) {
          const x = -0.6 + i * 0.4;
          C(p, 0.2, 0.21, 0.05, tint(c, i % 2 ? 0.08 : -0.05), x, 0.03, (i % 2 ? 0.1 : -0.1), { seg: 12, rough: 0.95 });
        }
      }
    }
  ];

  const CATS = [
    { key: 'kamar', label: 'Kamar Tidur' },
    { key: 'tamu', label: 'Ruang Tamu' },
    { key: 'dapur', label: 'Dapur & Makan' },
    { key: 'mandi', label: 'Kamar Mandi' },
    { key: 'dekor', label: 'Dekorasi' },
    { key: 'taman', label: 'Taman & Outdoor' }
  ];

  const byKey = {};
  ITEMS.forEach(function (it) { byKey[it.key] = it; });

  window.KATALOG = { items: ITEMS, cats: CATS, byKey: byKey, N: N, tint: tint };
})();
