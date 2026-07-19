import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DOWN = new THREE.Vector3(0, -1, 0);
const EYE_HEIGHT = 1.6; // metres — walking eye height (person size is FIXED; the world scales, not the person)

// Immersion multiplier: scale the whole world (mesh + collider + walk profile) up so a
// fixed-size 1.75 m visitor + companions feel small inside a big environment. Preserves every
// relative proportion (unlike the old bbox renormalise) — only changes how big the world is.
const scaleProfile = (p, k) => (!p ? null : {
  spawn: { x: p.spawn.x * k, z: p.spawn.z * k },
  groundY: p.groundY * k,
  bounds: p.bounds ? { minX: p.bounds.minX * k, maxX: p.bounds.maxX * k, minZ: p.bounds.minZ * k, maxZ: p.bounds.maxZ * k } : null,
  yaw: p.yaw,
  cameraFar: p.cameraFar * Math.max(1, k),
});

export class Museum3D {
  constructor({ container, artworks, companions = [], onArtworkFocus, onReady, onWorldReady = null, world = null }) {
    this.container = container;
    this.artworks = artworks;
    this.companions = companions;
    this.onArtworkFocus = onArtworkFocus;
    this.onReady = onReady;
    this.onWorldReady = onWorldReady;
    // Marble world descriptor (config/worlds.js). Everything is derived from it; null -> box gallery.
    this.world = world;
    this.worldMeshUrl = world?.meshUrl || null;
    this.worldSplatUrl = world?.splatUrl || null;
    this.worldColliderUrl = world?.colliderUrl || null;
    this.worldScale = world?.worldScale || 1;
    this.worldProfile = scaleProfile(world?.profile || null, this.worldScale);
    this.worldRender = world?.render || (world?.meshUrl ? "mesh" : world?.splatUrl ? "splat" : null);
    this.usingSplat = this.worldRender === "splat" && !!this.worldSplatUrl;
    this.worldReady = false;
    this.worldFallback = false; // set true when the world render fails and the box gallery is restored
    this.worldMesh = null;
    this.worldSplat = null;
    this.worldCollider = null;
    this.keys = new Set();
    this.paintings = [];
    this.companionModels = [];
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.yaw = 0;
    this.pitch = 0;
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.disposed = false;
    this.frame = 0;
  }

  mount() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe1ddd3);
    this.scene.fog = new THREE.FogExp2(0xe1ddd3, 0.014);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
    this.camera.position.set(0, 2.35, 12);
    this.camera.rotation.order = "YXZ";

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.usingSplat, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.usingSplat ? 1.5 : 1.8));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Marble .spz gaussian colors are final baked radiance, not HDR needing a filmic grade —
    // the official Marble web viewer renders splats with no tone mapping (docs.worldlabs.ai/api/rendering-spz:
    // colors are final; the viewer applies only the 180-degree X rotation). Filmic ACES + 0.92
    // exposure darkened and color-shifted every splat world vs. the source model. Mesh/box-gallery
    // display walls still look better with the filmic grade, so only splat mode skips it.
    this.renderer.toneMapping = this.usingSplat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.usingSplat ? 1.0 : 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "museum-3d-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Walkable three-dimensional museum gallery");
    this.container.prepend(this.renderer.domElement);

    this.buildArchitecture();
    if (this.world) {
      // World mode: never flash the ivory box gallery while the Marble splat/mesh streams in.
      // Hide all box scenery and start on a dark void so the first frames (behind the loading
      // veil) are black, not the procedural gallery. applyWorldFraming() reveals the real world;
      // buildWorldEnvironment() restores this box look if the load fails.
      this.setGallerySceneryVisible(false);
      this.scene.background = new THREE.Color(0x05070a);
      this.scene.fog = null;
    }
    this.buildWorldEnvironment();
    this.buildGallery(this.artworks);
    this.loadCompanionModels(this.companions);
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
    this.onReady?.();
  }

  buildArchitecture() {
    this.architectureShell = [];
    // All box-gallery scenery lives under one Group so world mode hides it with a single
    // switch (setGallerySceneryVisible) — otherwise the ivory floor z-fights the Marble
    // ground and columns float inside the real world. Lights stay on the scene (below).
    const scenery = this.galleryScenery = new THREE.Group();
    this.scene.add(scenery);
    const ivory = new THREE.MeshStandardMaterial({ color: 0xd8ceba, roughness: 0.82, metalness: 0.02 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xbcae98, roughness: 0.92 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x9c7a43, roughness: 0.38, metalness: 0.72 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcde6e7, transparent: true, opacity: 0.16, roughness: 0.08, transmission: 0.42, side: THREE.DoubleSide });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 74), new THREE.MeshStandardMaterial({ color: 0xc7baa7, roughness: 0.58, metalness: 0.04 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -18;
    floor.receiveShadow = true;
    scenery.add(floor);

    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 70), new THREE.MeshStandardMaterial({ color: 0xe4daca, roughness: 0.48 }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, 0.012, -18);
    scenery.add(aisle);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 7.8, 72), ivory);
      wall.position.set(side * 7.35, 3.9, -18);
      scenery.add(wall);
      this.architectureShell.push(wall);

      for (let z = 12; z >= -50; z -= 6.2) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 7.7, 18), stone);
        column.position.set(side * 6.85, 3.85, z);
        scenery.add(column);
        const capital = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.8), brass);
        capital.position.set(side * 6.85, 7.15, z);
        scenery.add(capital);
      }
    }

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14.8, 8, 0.35), ivory);
    backWall.position.set(0, 4, -53.5);
    scenery.add(backWall);
    this.architectureShell.push(backWall);

    for (let z = 12; z >= -50; z -= 6.2) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.12, 0.12), brass);
      beam.position.set(0, 7.45, z);
      scenery.add(beam);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(7.05, 0.075, 10, 56, Math.PI), brass);
      arch.scale.y = 0.34;
      arch.position.set(0, 7.25, z);
      scenery.add(arch);
    }

    const roofLeft = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 72), glass);
    roofLeft.rotation.set(Math.PI / 2, 0, Math.PI / 4.5);
    roofLeft.position.set(-3.55, 7.6, -18);
    scenery.add(roofLeft);
    this.architectureShell.push(roofLeft);
    const roofRight = roofLeft.clone();
    roofRight.rotation.z = -Math.PI / 4.5;
    roofRight.position.x = 3.55;
    scenery.add(roofRight);
    this.architectureShell.push(roofRight);

    // Ambient + key light stay on the scene root: the unlit world mesh ignores them, but the
    // PBR companion models still need lighting when the box gallery is hidden.
    const hemi = new THREE.HemisphereLight(0xf7fbff, 0x76644e, 2.25);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
    sun.position.set(-8, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    for (let z = 7; z >= -48; z -= 10) {
      const glow = new THREE.PointLight(0xffd8a8, 18, 16, 2);
      glow.position.set(0, 6.3, z);
      scenery.add(glow);
    }

    const petalGeometry = new THREE.BufferGeometry();
    const petalPositions = new Float32Array(270 * 3);
    for (let i = 0; i < 270; i += 1) {
      petalPositions[i * 3] = (Math.random() - 0.5) * 13;
      petalPositions[i * 3 + 1] = 0.2 + Math.random() * 7;
      petalPositions[i * 3 + 2] = 13 - Math.random() * 66;
    }
    petalGeometry.setAttribute("position", new THREE.BufferAttribute(petalPositions, 3));
    this.petals = new THREE.Points(petalGeometry, new THREE.PointsMaterial({ color: 0xe7a9b6, size: 0.045, transparent: true, opacity: 0.65 }));
    scenery.add(this.petals);
  }

  // ---- World Labs (Marble) world loading — NATIVE metric scale (see config/worlds.js) ----
  // Every Marble GLB's root matrix already bakes metric_scale_factor · Rx(π) + ground_offset,
  // so we render at native scale with ZERO renormalisation (the old fixed-span Box3 rescale
  // was THE proportion bug). mesh: GLTFLoader applies the baked matrix. splat: reproduce it by
  // hand (scale=s, Rx(π), y=ty). collider: loaded hidden, drives ground-snap + walk bounds.
  async buildWorldEnvironment() {
    if (!this.world) return;
    await this.loadWorldCollider();
    let ok = false;
    if (this.worldRender === "mesh" && this.worldMeshUrl) ok = await this.buildWorldMesh();
    else if (this.worldRender === "splat" && this.worldSplatUrl) ok = await this.buildWorldSplat();
    if (!ok && this.worldSplatUrl && !this.worldSplat) ok = await this.buildWorldSplat();
    if (!ok && this.worldMeshUrl && !this.worldMesh) ok = await this.buildWorldMesh();
    if (ok) { this.applyWorldFraming(); return; }
    // Render failed: restore the box gallery we hid + the ivory background/fog we darkened in
    // mount() for world mode, hang the box-gallery paintings, and signal ready (fallback) so the
    // UI dismisses the loading veil instead of trapping the visitor in the dark void.
    console.warn("World render failed for", this.world?.key, "— box gallery remains.");
    this.worldFallback = true;
    this.setGallerySceneryVisible(true);
    this.scene.background = new THREE.Color(0xe1ddd3);
    this.scene.fog = new THREE.FogExp2(0xe1ddd3, 0.014);
    this.buildGallery(this.artworks);
    this.onWorldReady?.({ key: this.world?.key, render: "fallback", fallback: true });
  }

  async loadWorldCollider() {
    if (!this.worldColliderUrl) return;
    try {
      const gltf = await new GLTFLoader().loadAsync(this.worldColliderUrl);
      if (this.disposed) return;
      const collider = gltf.scene;
      // Shares the mesh/splat baked root matrix -> auto-aligns. Kept invisible: raycast only
      // (three.js raycasts invisible meshes, so this still drives ground-snap + collision).
      collider.traverse((o) => { if (o.isMesh) o.visible = false; });
      if (this.world?.rawMarble) {
        // Raw Marble collider (opencv y-down, no baked matrix): apply the SAME metric transform
        // as the splat (scale · Rx(π) + ty) so collider and splat align.
        const m = this.world.metric || { scale: 1, ty: 0 };
        collider.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        collider.scale.setScalar(m.scale * this.worldScale);
        collider.position.set(0, m.ty * this.worldScale, 0);
      } else if (this.worldScale !== 1) {
        collider.scale.setScalar(this.worldScale); // stay aligned with the scaled mesh
      }
      collider.updateMatrixWorld(true);
      this.worldCollider = collider;
      this.scene.add(collider);
    } catch (error) {
      console.warn("World collider unavailable; walking uses the profile ground plane only.", error);
      this.worldCollider = null;
    }
  }

  async buildWorldMesh() {
    try {
      const gltf = await new GLTFLoader().loadAsync(this.worldMeshUrl);
      if (this.disposed) return false;
      const mesh = gltf.scene;
      // NO manual scale / rotation / translation — the root node matrix is baked and
      // GLTFLoader applies it. KHR_materials_unlit texture is pre-lit, so opt each material
      // out of ACES tone mapping + fog to match the Marble web viewer 1:1.
      mesh.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m) { m.toneMapped = false; m.fog = false; } });
      });
      if (this.worldScale !== 1) mesh.scale.setScalar(this.worldScale); // immersion scale-up
      mesh.updateMatrixWorld(true);
      this.worldMesh = mesh;
      this.scene.add(mesh);
      return true;
    } catch (error) {
      console.warn("World mesh unavailable.", error);
      this.worldMesh = null;
      return false;
    }
  }

  async buildWorldSplat() {
    try {
      const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");
      if (this.disposed) return false;
      if (!this.spark) { this.spark = new SparkRenderer({ renderer: this.renderer }); this.scene.add(this.spark); }
      const splat = new SplatMesh({ url: this.worldSplatUrl, lodScale: 2 });
      // .spz is raw marble_opencv. Reproduce the GLB root matrix exactly: scale = metric.scale,
      // rotation = Rx(π) (proper rotation, det +1 -> no covariance mirroring), y = metric.ty.
      const metric = this.world?.metric || { scale: 1, ty: 0 };
      splat.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      splat.scale.setScalar(metric.scale * this.worldScale);
      splat.position.set(0, metric.ty * this.worldScale, 0);
      this.worldSplat = splat;
      this.scene.add(splat);
      return true;
    } catch (error) {
      console.warn("World splat unavailable.", error);
      this.worldSplat = null;
      return false;
    }
  }

  // Frame the visitor into the loaded world: spawn at the collider p50 centroid + eye height,
  // face the world, drop the box gallery, adopt the reference viewer's black + fog-free look.
  applyWorldFraming() {
    const p = this.worldProfile || { spawn: { x: 0, z: 0 }, groundY: 0, bounds: null, yaw: 0, cameraFar: 300 };
    this.worldReady = true;
    this.setGallerySceneryVisible(false);
    this.placeArtworksInWorld(this.artworks); // spec: artworks become clickable planes IN the world
    this.camera.position.set(p.spawn.x, p.groundY + EYE_HEIGHT, p.spawn.z);
    this.yaw = p.yaw || 0;
    this.pitch = 0;
    this.camera.far = p.cameraFar || 300;
    this.camera.updateProjectionMatrix();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = null;
    // Neutral white key light riding with the visitor so companions read as recognisable
    // figures (faces lit) instead of being dyed gold by the world's own colour. The unlit
    // world mesh ignores it; only the PBR companion models pick it up.
    if (!this.companionLight) {
      this.companionLight = new THREE.PointLight(0xffffff, 2.4, 16, 2);
      this.scene.add(this.companionLight);
    }
    this.onWorldReady?.({ key: this.world?.key, render: this.worldRender });
  }

  setGallerySceneryVisible(visible) {
    if (this.galleryScenery) this.galleryScenery.visible = visible;
  }

  buildGallery(artworks) {
    this.artworks = artworks;
    // In a loaded Marble world, artworks live as clickable planes embedded IN the world
    // (spec) — not on the box-gallery walls. This also handles the async AIC rebuild.
    if (this.worldReady) { this.placeArtworksInWorld(artworks); return; }
    // World still streaming behind the loading veil: don't hang box-gallery paintings — they'd
    // float in the dark void. applyWorldFraming() places them in the world once ready; on a
    // failed load buildWorldEnvironment() sets worldFallback and re-runs this to hang them.
    if (this.world && !this.worldFallback) return;
    this.paintings.forEach(({ group }) => this.scene.remove(group));
    this.paintings = [];
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    const safeArtworks = artworks.length ? artworks : [];
    const repeated = Array.from({ length: Math.max(12, safeArtworks.length) }, (_, index) => safeArtworks[index % safeArtworks.length]).filter(Boolean);

    repeated.forEach((artwork, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const z = 7.5 - row * 8.6;
      const group = new THREE.Group();
      group.position.set(side * 7.12, 3.35, z);
      group.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(3.55, 2.65, 0.18),
        new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0xa98249 : 0xbda36d, roughness: 0.32, metalness: 0.62 })
      );
      group.add(frame);

      const matte = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.4), new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.78 }));
      matte.position.z = 0.101;
      group.add(matte);

      const paintingMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d1c4, side: THREE.DoubleSide });
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(3.02, 2.12), paintingMaterial);
      painting.position.z = 0.112;
      painting.userData.artwork = artwork;
      group.add(painting);
      textureLoader.load(artwork.image, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        paintingMaterial.map = texture;
        paintingMaterial.color.set(0xffffff);
        paintingMaterial.needsUpdate = true;
      });

      this.scene.add(group);
      this.paintings.push({ group, painting, artwork });
    });
  }

  // Terrain height at (x,z): raycast the hidden collider (falls back to the flat profile
  // ground). Foots the camera, companions, and artworks on the real undulating world surface.
  groundAt(x, z) {
    const gy0 = this.worldProfile?.groundY || 0;
    if (!this.worldCollider) return gy0;
    this.raycaster.set(new THREE.Vector3(x, gy0 + 300, z), DOWN);
    this.raycaster.far = 600;
    const hits = this.raycaster.intersectObject(this.worldCollider, true);
    this.raycaster.far = Infinity;
    // Collider junk geometry below the real floor made feet sink half-body in van-gogh/floral
    // (feedback #11): pick the HIGHEST hit inside an asymmetric window instead of the first hit.
    // Small up-window so doorway arches/ceiling are never picked; wide down-window tolerates
    // uneven floors. If nothing lands in the window, fall back to the flat profile ground.
    // Up-window is capped in absolute metres (feedback #12): at worldScale 1.7 the old
    // 1.2*ws window was ~2.04m, wide enough for a mezzanine/arch collider fragment above the
    // real floor to win and lift companions off the ground (van-gogh central slot). Real
    // steps/platforms never exceed ~0.6m, so scale never grows the window past that.
    const ws = this.worldScale || 1;
    let best = null;
    for (const h of hits) {
      const y = h.point.y;
      if (y < gy0 - 2.0 * ws || y > gy0 + Math.min(1.2 * ws, 0.6)) continue;
      if (best === null || y > best) best = y;
    }
    return best === null ? gy0 : best;
  }

  // Build the gallery INSIDE the world's interior with freestanding display walls: solid
  // partition panels stand on the floor along both sides of the walk path, each holding a
  // framed painting at eye height facing the path. This is robust in ANY world (a curved
  // sphere tunnel has no flat wall to hang on, an open world has no wall at all) and reads
  // as a real exhibition. Artworks stay clickable runtime planes with live metadata (spec).
  placeArtworksInWorld(artworks) {
    this.paintings.forEach(({ group }) => this.scene.remove(group));
    this.paintings = [];
    const b = this.worldProfile?.bounds;
    const list = (artworks || []).filter(Boolean);
    if (!b || !list.length) return;
    const alongX = (b.maxX - b.minX) >= (b.maxZ - b.minZ); // long axis of the corridor
    const longMin = alongX ? b.minX : b.minZ;
    const longMax = alongX ? b.maxX : b.maxZ;
    const shortCenter = alongX ? this.worldProfile.spawn.z : this.worldProfile.spawn.x;
    const shortHalf = (alongX ? (b.maxZ - b.minZ) : (b.maxX - b.minX)) / 2;
    const lateral = Math.max(1.5, shortHalf * 0.85); // how far to the side the display walls stand
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const perSideCap = Math.max(2, Math.floor((longMax - longMin) / 5)); // ~5m min spacing per side
    const n = Math.min(list.length, 8, perSideCap * 2);
    const perSide = Math.ceil(n / 2);
    for (let i = 0; i < n; i += 1) {
      const artwork = list[i];
      const onA = i % 2 === 0;
      const sideSign = onA ? -1 : 1;                     // alternate the two sides of the path
      const t = (Math.floor(i / 2) + 1) / (perSide + 1);
      const along = longMin + t * (longMax - longMin);
      // In off-center worlds (spawn far from the short-axis midpoint) the 0.85·shortHalf lateral
      // bump can push a wall past the walk bounds (yellow ~1m, van-gogh ~1.8m out). Clamp into
      // the short axis inset 0.4 m — Z when the corridor runs along X, else X.
      const sxRaw = shortCenter + sideSign * lateral;
      const sx = alongX ? clamp(sxRaw, b.minZ + 0.4, b.maxZ - 0.4) : clamp(sxRaw, b.minX + 0.4, b.maxX - 0.4);
      const px = alongX ? along : sx;
      const pz = alongX ? sx : along;

      const group = new THREE.Group();
      group.position.set(px, this.groundAt(px, pz), pz);                    // foot on the floor
      group.rotation.y = alongX ? (onA ? 0 : Math.PI) : (onA ? Math.PI / 2 : -Math.PI / 2); // face the path

      // Freestanding dark display wall (its +z face is turned toward the path).
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.85, metalness: 0.05 }));
      panel.position.set(0, 1.25, 0);
      panel.userData.artwork = artwork;
      group.add(panel);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.06), new THREE.MeshStandardMaterial({ color: 0xbda36d, roughness: 0.34, metalness: 0.6 }));
      frame.scale.set(1.3, 0.98, 1);
      frame.position.set(0, 1.5, 0.08);
      frame.userData.artwork = artwork;
      group.add(frame);
      const paintingMat = new THREE.MeshBasicMaterial({ color: 0xd8d1c4, side: THREE.DoubleSide, toneMapped: false });
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), paintingMat);
      painting.position.set(0, 1.5, 0.11);
      painting.scale.set(1.18, 0.86, 1);
      painting.userData.artwork = artwork;
      group.add(painting);

      loader.load(artwork.image, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        paintingMat.map = texture;
        paintingMat.color.set(0xffffff);
        paintingMat.needsUpdate = true;
        const img = texture.image;
        const aspect = img && img.width && img.height ? img.width / img.height : 1.3;
        const L = 1.15;
        const w = aspect >= 1 ? L : L * aspect;
        const h = aspect >= 1 ? L / aspect : L;
        painting.scale.set(w, h, 1);
        frame.scale.set(w + 0.12, h + 0.12, 1);
      });

      this.scene.add(group);
      this.paintings.push({ group, painting, artwork });
    }
  }

  buildCompanionMarkers(companions) {
    this.companionSprites?.forEach(sprite => this.scene.remove(sprite));
    this.companionSprites = [];
    const loader = new THREE.TextureLoader();
    companions.filter(item => item.portrait).slice(0, 3).forEach((companion, index) => {
      const material = new THREE.SpriteMaterial({ map: loader.load(companion.portrait), transparent: true, opacity: 0.92, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.72, 0.72, 1);
      sprite.position.set(-0.9 + index * 0.9, 1.55 + index * 0.12, 10.2 - index * 0.55);
      sprite.userData.companion = companion;
      this.scene.add(sprite);
      this.companionSprites.push(sprite);
    });
  }

  loadCompanionModels(companions) {
    this.companionParty = [];
    const modelCompanions = companions.filter(item => item.model).slice(0, 3);
    if (!modelCompanions.length) return;

    const loader = new GLTFLoader();
    modelCompanions.forEach((companion, index) => {
      loader.load(
        companion.model,
        gltf => {
          if (this.disposed) return;
          const avatar = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(avatar);
          const size = bounds.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.y) || size.y <= 0) return;

          // Normalise every character to human height (1.75 m) — we never need the GLB's
          // native scale, only its bounding box. In the true-metric world this makes the
          // figure sit at the right size automatically.
          avatar.scale.setScalar(1.75 / size.y);
          const scaledBounds = new THREE.Box3().setFromObject(avatar);
          const footOffset = -scaledBounds.min.y; // add to a ground Y so the feet sit on it
          avatar.userData.companion = companion;
          avatar.traverse(object => {
            if (!object.isMesh) return;
            object.castShadow = false;
            object.receiveShadow = false;
            // KHR_materials_volume -> MeshPhysicalMaterial with transmission>0 forces a
            // per-frame full-scene transmission pre-pass (very expensive); disable it.
            const mats = Array.isArray(object.material) ? object.material : [object.material];
            mats.forEach(m => { if (m && m.transmission > 0) { m.transmission = 0; m.transparent = false; } });
            // feedback #12 defect A: the yellow-polka-dot room's emissive gold texture dyes
            // every companion into an unrecognisable gold/black blob. Self-light them by their
            // own albedo so identity survives regardless of ambient/emissive room lighting.
            if (this.world?.companionBoost) {
              mats.forEach(m => {
                if (!m) return;
                if (m.map) { m.emissiveMap = m.map; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.55; }
                else { m.emissive = m.color ? m.color.clone() : new THREE.Color(0x888888); m.emissiveIntensity = 0.35; }
              });
            }
          });
          // Slots are camera-relative; negative back = metres AHEAD of the camera. Pulled from
          // point-blank 1.6m to a 2.7-3.4m mid-shot per acceptance feedback #11 — at point-blank
          // the figures filled the frame and made every world feel cramped; at ~3m they read as
          // half/three-quarter figures and the world depth shows, while staying recognisable.
          const slots = [{ back: -2.7, side: -1.6 }, { back: -2.7, side: 1.6 }, { back: -3.4, side: 0.0 }];
          if (this.worldProfile) {
            // Marble world: stand near the spawn; animate() makes them walk WITH the visitor.
            const slot = slots[index % slots.length];
            const s = this.worldProfile.spawn;
            const cx = s.x + slot.side;
            const cz = s.z + 1.2 + index * 0.3;
            avatar.position.set(cx, this.groundAt(cx, cz) + footOffset, cz);
            this.companionParty.push({ avatar, footOffset, back: slot.back, side: slot.side });
          } else {
            // Box-gallery fallback: original static placement + one-time shadow bake.
            avatar.position.set(-1.45 + index * 1.45, footOffset, 7.6 + (index % 2) * 0.45);
            avatar.rotation.y = Math.PI;
            if (this.renderer) { this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true; }
          }
          this.scene.add(avatar);
          this.companionModels.push(avatar);
        },
        undefined,
        error => console.warn(`Companion model unavailable for ${companion.fullName}`, error)
      );
    });
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    this.handlers = {
      pointerdown: event => {
        this.dragging = true;
        this.lastPointer = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId);
      },
      pointermove: event => {
        if (!this.dragging) return;
        this.yaw -= (event.clientX - this.lastPointer.x) * 0.0038;
        this.pitch = clamp(this.pitch - (event.clientY - this.lastPointer.y) * 0.0028, -0.42, 0.42);
        this.lastPointer = { x: event.clientX, y: event.clientY };
      },
      pointerup: event => {
        const moved = Math.hypot(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
        this.dragging = false;
        canvas.releasePointerCapture?.(event.pointerId);
        if (moved < 8) this.pick(event);
      },
      wheel: event => {
        event.preventDefault();
        this.camera.position.z = clamp(this.camera.position.z + event.deltaY * 0.012, -25, 13);
      },
      keydown: event => this.keys.add(event.key.toLowerCase()),
      keyup: event => this.keys.delete(event.key.toLowerCase())
    };
    canvas.addEventListener("pointerdown", this.handlers.pointerdown);
    canvas.addEventListener("pointermove", this.handlers.pointermove);
    canvas.addEventListener("pointerup", this.handlers.pointerup);
    canvas.addEventListener("wheel", this.handlers.wheel, { passive: false });
    addEventListener("keydown", this.handlers.keydown);
    addEventListener("keyup", this.handlers.keyup);
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Intersect the whole display group recursively so the entire 1.8x2.5m wall is the hit area,
    // not just the small painting plane (acceptance feedback #10: judges could not hit the painting).
    const hit = this.raycaster.intersectObjects(this.paintings.map(item => item.group), true)[0];
    if (hit?.object?.userData?.artwork) this.onArtworkFocus?.(hit.object.userData.artwork);
  }

  resize() {
    if (!this.renderer || !this.container.clientWidth || !this.container.clientHeight) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const speed = this.keys.has("shift") ? 0.16 : 0.085;
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    let mx = 0, mz = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) { mx += forward.x * speed; mz += forward.z * speed; }
    if (this.keys.has("s") || this.keys.has("arrowdown")) { mx -= forward.x * speed; mz -= forward.z * speed; }
    if (this.keys.has("a") || this.keys.has("arrowleft")) { mx -= right.x * speed; mz -= right.z * speed; }
    if (this.keys.has("d") || this.keys.has("arrowright")) { mx += right.x * speed; mz += right.z * speed; }
    if (this.worldReady && this.worldProfile) {
      // Wall collision: never step INTO the world surface (stops the camera clipping through
      // the mesh — e.g. walking into the sphere-tunnel walls). Keep ~0.45 m of personal space.
      const solid = this.worldMesh || this.worldCollider;
      if ((mx || mz) && solid) {
        const len = Math.hypot(mx, mz);
        this.raycaster.set(this.camera.position, new THREE.Vector3(mx / len, 0, mz / len));
        this.raycaster.far = len + 0.45;
        const blocked = this.raycaster.intersectObject(solid, true).length > 0;
        this.raycaster.far = Infinity;
        if (blocked) { mx = 0; mz = 0; }
      }
      this.camera.position.x += mx;
      this.camera.position.z += mz;
      const b = this.worldProfile.bounds;
      if (b) {
        this.camera.position.x = clamp(this.camera.position.x, b.minX, b.maxX);
        this.camera.position.z = clamp(this.camera.position.z, b.minZ, b.maxZ);
      }
      // Snap to the real (undulating) terrain height under the camera.
      this.camera.position.y = this.groundAt(this.camera.position.x, this.camera.position.z) + EYE_HEIGHT;
      this.companionLight?.position.set(this.camera.position.x, this.camera.position.y + 0.4, this.camera.position.z);
    } else {
      this.camera.position.x += mx;
      this.camera.position.z += mz;
      this.camera.position.x = clamp(this.camera.position.x, -5.5, 5.5);
      this.camera.position.z = clamp(this.camera.position.z, -25, 13);
      this.camera.position.y = 2.35;
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.petals) {
      this.petals.rotation.y += 0.00022;
      this.petals.position.y = Math.sin(performance.now() * 0.00035) * 0.12;
    }
    this.updateCompanions();
    this.renderer.render(this.scene, this.camera);
  };

  // Companions walk WITH the visitor: each holds a slot behind + beside the camera, is
  // damped toward it every frame, snapped to the collider ground, and faces the walk
  // direction. Only active once the world is ready (fallback keeps them static).
  updateCompanions() {
    if (!this.worldReady || !this.companionParty?.length) return;
    const yaw = this.yaw;
    const fwdX = Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rgtX = Math.cos(yaw), rgtZ = Math.sin(yaw);
    const cam = this.camera.position;
    const wb = this.worldProfile?.bounds;
    for (const c of this.companionParty) {
      const a = c.avatar;
      let tx = cam.x - fwdX * c.back + rgtX * c.side;
      let tz = cam.z - fwdZ * c.back + rgtZ * c.side;
      if (wb) { // wider CHANGE-1 side slots must not shove a companion into a wall at the corridor edge
        tx = clamp(tx, wb.minX + 0.35, wb.maxX - 0.35);
        tz = clamp(tz, wb.minZ + 0.35, wb.maxZ - 0.35);
      }
      a.position.x += (tx - a.position.x) * 0.08;
      a.position.z += (tz - a.position.z) * 0.08;
      a.position.y = this.groundAt(a.position.x, a.position.z) + c.footOffset;
      a.rotation.y = Math.atan2(cam.x - a.position.x, cam.z - a.position.z); // face the visitor (show faces)
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    const canvas = this.renderer?.domElement;
    if (canvas && this.handlers) {
      canvas.removeEventListener("pointerdown", this.handlers.pointerdown);
      canvas.removeEventListener("pointermove", this.handlers.pointermove);
      canvas.removeEventListener("pointerup", this.handlers.pointerup);
      canvas.removeEventListener("wheel", this.handlers.wheel);
      removeEventListener("keydown", this.handlers.keydown);
      removeEventListener("keyup", this.handlers.keyup);
    }
    this.scene?.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
    this.worldSplat?.dispose?.();
    this.renderer?.dispose();
    canvas?.remove();
  }
}
