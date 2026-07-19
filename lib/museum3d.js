import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DOWN = new THREE.Vector3(0, -1, 0);
const EYE_HEIGHT = 1.6; // metres — walking eye height in the native-scale world (ref kit uses 1.5)

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
    this.worldProfile = world?.profile || null;
    this.worldRender = world?.render || (world?.meshUrl ? "mesh" : world?.splatUrl ? "splat" : null);
    this.usingSplat = this.worldRender === "splat" && !!this.worldSplatUrl;
    this.worldReady = false;
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "museum-3d-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Walkable three-dimensional museum gallery");
    this.container.prepend(this.renderer.domElement);

    this.buildArchitecture();
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
    if (ok) this.applyWorldFraming();
    else console.warn("World render failed for", this.world?.key, "— box gallery remains.");
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
      splat.scale.setScalar(metric.scale);
      splat.position.set(0, metric.ty, 0);
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
    (this.paintings || []).forEach(({ group }) => { group.visible = false; }); // P2 re-places these in-world
    this.camera.position.set(p.spawn.x, p.groundY + EYE_HEIGHT, p.spawn.z);
    this.yaw = p.yaw || 0;
    this.pitch = 0;
    this.camera.far = p.cameraFar || 300;
    this.camera.updateProjectionMatrix();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = null;
    this.onWorldReady?.({ key: this.world?.key, render: this.worldRender });
  }

  setGallerySceneryVisible(visible) {
    if (this.galleryScenery) this.galleryScenery.visible = visible;
  }

  buildGallery(artworks) {
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
    // In world mode the box-wall paintings float outside the real room. applyWorldFraming
    // hides the initial set; this also covers the async AIC rebuild that recreates them
    // after the world has already loaded (P2 will re-place them at in-world anchors).
    if (this.worldReady) this.paintings.forEach(({ group }) => { group.visible = false; });
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

          const targetHeight = 1.75;
          avatar.scale.setScalar(targetHeight / size.y);
          const scaledBounds = new THREE.Box3().setFromObject(avatar);
          avatar.position.set(-1.45 + index * 1.45, -scaledBounds.min.y, 7.6 + (index % 2) * 0.45);
          avatar.rotation.y = Math.PI;
          avatar.userData.companion = companion;
          avatar.traverse(object => {
            if (!object.isMesh) return;
            object.castShadow = true;
            object.receiveShadow = true;
            // KHR_materials_volume -> MeshPhysicalMaterial with transmission>0 forces a
            // per-frame full-scene transmission pre-pass (very expensive); disable it.
            const mats = Array.isArray(object.material) ? object.material : [object.material];
            mats.forEach(m => { if (m && m.transmission > 0) { m.transmission = 0; m.transparent = false; } });
          });
          this.scene.add(avatar);
          this.companionModels.push(avatar);
          // Static scene: bake the shadow map once instead of re-rendering ~6M tris/frame.
          if (this.renderer) { this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true; }
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
    const hit = this.raycaster.intersectObjects(this.paintings.map(item => item.painting), false)[0];
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
    if (this.keys.has("w") || this.keys.has("arrowup")) this.camera.position.addScaledVector(forward, speed);
    if (this.keys.has("s") || this.keys.has("arrowdown")) this.camera.position.addScaledVector(forward, -speed);
    if (this.keys.has("a") || this.keys.has("arrowleft")) this.camera.position.addScaledVector(right, -speed);
    if (this.keys.has("d") || this.keys.has("arrowright")) this.camera.position.addScaledVector(right, speed);
    if (this.worldReady && this.worldProfile) {
      const b = this.worldProfile.bounds;
      if (b) {
        this.camera.position.x = clamp(this.camera.position.x, b.minX, b.maxX);
        this.camera.position.z = clamp(this.camera.position.z, b.minZ, b.maxZ);
      }
      // Snap to the hidden collider ground (fall back to the profile's flat ground plane).
      let floorY = this.worldProfile.groundY;
      if (this.worldCollider) {
        this.raycaster.set(new THREE.Vector3(this.camera.position.x, floorY + EYE_HEIGHT + 1.0, this.camera.position.z), DOWN);
        this.raycaster.far = 6;
        const hit = this.raycaster.intersectObject(this.worldCollider, true)[0];
        this.raycaster.far = Infinity; // restore for pick()
        if (hit) floorY = hit.point.y;
      }
      this.camera.position.y = floorY + EYE_HEIGHT;
    } else {
      this.camera.position.x = clamp(this.camera.position.x, -5.5, 5.5);
      this.camera.position.z = clamp(this.camera.position.z, -25, 13);
      this.camera.position.y = 2.35;
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.petals) {
      this.petals.rotation.y += 0.00022;
      this.petals.position.y = Math.sin(performance.now() * 0.00035) * 0.12;
    }
    this.renderer.render(this.scene, this.camera);
  };

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
